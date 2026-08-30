import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfidenceRepository } from '../hypothesis/confidence.repository';
import { HypothesisService } from '../hypothesis/hypothesis.service';
import { QuestionRepository } from './question.repository';
import { MAX_GAP_TEXT_LENGTH, MAX_QUESTION_DEPENDENCIES, MAX_QUESTION_TARGET_HYPOTHESES, MAX_QUESTION_TEXT_LENGTH, QUESTION_ANSWER_FORMATS, QUESTION_TYPES, type CreateInformationGapInput, type InformationGapRecord, type QuestionCandidateGenerator, type QuestionCandidateProposal, type QuestionCandidateRecord } from './question.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PROPOSAL_KEYS = new Set(['questionText','questionType','informationGapId','targetHypothesisIds','informationNeeded','answerFormat','dependencyIds']);
const CREDENTIAL_REQUEST = /\b(password|passcode|api[ -]?key|private key|secret|credential|access token|refresh token)\b/iu;
const normalize = (value: string) => value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US');
const bounded = (value: unknown, max: number, field: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) throw new BadRequestException(`${field} is invalid.`);
  return value.trim();
};
const uuidArray = (value: unknown, max: number, field: string): string[] => {
  if (!Array.isArray(value) || value.length > max || new Set(value).size !== value.length || value.some((id) => typeof id !== 'string' || !UUID.test(id))) throw new BadRequestException(`${field} is invalid.`);
  return value;
};

@Injectable()
export class QuestionService {
  constructor(private readonly hypotheses: HypothesisService, private readonly confidence: ConfidenceRepository, private readonly repository: QuestionRepository) {}

  async createGap(userId: string, token: string, input: CreateInformationGapInput): Promise<InformationGapRecord> {
    const informationNeeded = bounded(input.informationNeeded, MAX_GAP_TEXT_LENGTH, 'informationNeeded');
    const whyItMatters = bounded(input.whyItMatters, MAX_GAP_TEXT_LENGTH, 'whyItMatters');
    const hypothesisIds = uuidArray(input.relatedHypothesisIds, MAX_QUESTION_TARGET_HYPOTHESES, 'relatedHypothesisIds');
    await Promise.all(hypothesisIds.map((id) => this.hypotheses.find(userId, token, id)));
    if (input.preferredQuestionType && !QUESTION_TYPES.includes(input.preferredQuestionType)) throw new BadRequestException('preferredQuestionType is invalid.');
    if (input.userAnswerability && !['UNASSESSED','USER_CAN_ANSWER','USER_CANNOT_ANSWER'].includes(input.userAnswerability)) throw new BadRequestException('userAnswerability is invalid.');
    if (input.confidenceEvaluationId) {
      if (!UUID.test(input.confidenceEvaluationId)) throw new BadRequestException('confidenceEvaluationId is invalid.');
      const evaluation = await this.confidence.find(token, userId, input.confidenceEvaluationId);
      if (!evaluation) throw new NotFoundException('Confidence evaluation not found.');
      if (evaluation.target_type === 'HYPOTHESIS' && !hypothesisIds.includes(evaluation.target_id)) throw new BadRequestException('Confidence target must be one of the gap hypotheses.');
      if (evaluation.missing_information_codes.length === 1 && evaluation.missing_information_codes[0] === 'CONFIDENCE_MODEL_UNCALIBRATED') throw new BadRequestException('Model calibration is not a user-answerable information gap.');
    }
    return this.repository.createGap(token, { id: randomUUID(), information_needed: informationNeeded, why_it_matters: whyItMatters, related_hypothesis_ids: hypothesisIds, confidence_evaluation_id: input.confidenceEvaluationId ?? null, user_answerability: input.userAnswerability ?? 'UNASSESSED', preferred_question_type: input.preferredQuestionType ?? null });
  }

  async generateValidated(userId: string, token: string, gapId: string, generator: QuestionCandidateGenerator): Promise<QuestionCandidateRecord[]> {
    if (!UUID.test(gapId)) throw new BadRequestException('gapId is invalid.');
    const gap = await this.repository.findGap(token, userId, gapId);
    if (!gap) throw new NotFoundException('Information gap not found.');
    // QIR-006 compatibility: a closed gap (RESOLVED or SUPERSEDED by the
    // canonical migration-0063 lifecycle) is no longer a valid candidate
    // generation target. Fail closed rather than generating against a stale
    // information need.
    if (gap.status !== 'OPEN') throw new BadRequestException('Information gap is not open.');
    const proposals = await generator.generate(Object.freeze({ ...gap, related_hypothesis_ids: Object.freeze([...gap.related_hypothesis_ids]) as unknown as string[] }));
    if (!Array.isArray(proposals) || proposals.length > 16) throw new BadRequestException('Generator result is invalid.');
    const seen = new Set<string>();
    for (const proposal of proposals) this.validateProposal(proposal, gap, seen);
    return Promise.all(proposals.map((proposal) => this.repository.createCandidate(token, randomUUID(), proposal)));
  }

  private validateProposal(proposal: QuestionCandidateProposal, gap: InformationGapRecord, seen: Set<string>): void {
    if (!proposal || typeof proposal !== 'object' || Object.keys(proposal).some((key) => !PROPOSAL_KEYS.has(key))) throw new BadRequestException('Proposal contains forbidden fields.');
    bounded(proposal.questionText, MAX_QUESTION_TEXT_LENGTH, 'questionText'); bounded(proposal.informationNeeded, MAX_GAP_TEXT_LENGTH, 'informationNeeded');
    if (CREDENTIAL_REQUEST.test(proposal.questionText) || CREDENTIAL_REQUEST.test(proposal.informationNeeded)) throw new BadRequestException('Candidate must not request secrets or credentials.');
    if (!QUESTION_TYPES.includes(proposal.questionType) || !QUESTION_ANSWER_FORMATS.includes(proposal.answerFormat)) throw new BadRequestException('Proposal taxonomy is invalid.');
    if (proposal.informationGapId !== gap.id) throw new BadRequestException('Explicit information gap linkage is required.');
    const targets = uuidArray(proposal.targetHypothesisIds, MAX_QUESTION_TARGET_HYPOTHESES, 'targetHypothesisIds');
    if (targets.some((id) => !gap.related_hypothesis_ids.includes(id))) throw new BadRequestException('Proposal target is outside the information gap.');
    uuidArray(proposal.dependencyIds ?? [], MAX_QUESTION_DEPENDENCIES, 'dependencyIds');
    const key = normalize(proposal.questionText); if (seen.has(key)) throw new BadRequestException('Duplicate candidate for information gap.'); seen.add(key);
  }
}
