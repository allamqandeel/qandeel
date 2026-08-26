import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfidenceService } from './confidence.service';
import { isCanonicalHypothesisUpdateMutation, validateHypothesisUpdateRequest } from './hypothesis-update.policy';
import { HypothesisUpdateRepository } from './hypothesis-update.repository';
import type { HypothesisUpdateRequest, HypothesisUpdateResult } from './hypothesis-update.types';

@Injectable()
export class HypothesisUpdateService {
  constructor(private readonly repository: HypothesisUpdateRepository, private readonly confidence: ConfidenceService) {}

  async apply(userId: string, token: string, request: HypothesisUpdateRequest): Promise<HypothesisUpdateResult> {
    validateHypothesisUpdateRequest(request);
    const updateId = randomUUID();
    const mutation = await this.repository.apply(token, updateId, request);
    if (!mutation || mutation.hypothesis.user_id !== userId || mutation.update.user_id !== userId) {
      throw new NotFoundException('Hypothesis update target not found.');
    }
    // Finding 09 (QAN-AUD-07): the returned tuple must be exactly the canonical
    // mutation this invocation asked for before any Confidence runs, and its
    // update.after_version is the ONLY post-update Confidence target - never a
    // later ID-only re-read. A Confidence failure (the exact version no longer
    // being current included) leaves the committed mutation untouched and
    // degrades to PENDING_RETRY; it never evaluates a later version and never
    // replays the mutation.
    if (!isCanonicalHypothesisUpdateMutation(mutation, userId, updateId, request)) {
      throw new Error('HYPOTHESIS_UPDATE_INTEGRITY');
    }
    try {
      const confidenceEvaluation = await this.confidence.evaluateHypothesisVersion(
        userId, token, request.hypothesisId, mutation.update.after_version,
      );
      return { ...mutation, confidenceStatus: 'EVALUATED', confidenceEvaluation };
    } catch {
      return { ...mutation, confidenceStatus: 'PENDING_RETRY', confidenceEvaluation: null };
    }
  }
}
