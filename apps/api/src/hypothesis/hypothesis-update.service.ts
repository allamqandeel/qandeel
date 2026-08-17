import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfidenceService } from './confidence.service';
import { HypothesisUpdateRepository } from './hypothesis-update.repository';
import type { HypothesisUpdateRequest, HypothesisUpdateResult } from './hypothesis-update.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class HypothesisUpdateService {
  constructor(private readonly repository: HypothesisUpdateRepository, private readonly confidence: ConfidenceService) {}

  async apply(userId: string, token: string, request: HypothesisUpdateRequest): Promise<HypothesisUpdateResult> {
    this.validate(request);
    const mutation = await this.repository.apply(token, randomUUID(), request);
    if (!mutation || mutation.hypothesis.user_id !== userId || mutation.update.user_id !== userId) {
      throw new NotFoundException('Hypothesis update target not found.');
    }
    try {
      const confidenceEvaluation = await this.confidence.evaluateHypothesis(userId, token, request.hypothesisId);
      return { ...mutation, confidenceStatus: 'EVALUATED', confidenceEvaluation };
    } catch {
      return { ...mutation, confidenceStatus: 'PENDING_RETRY', confidenceEvaluation: null };
    }
  }

  private validate(request: HypothesisUpdateRequest): void {
    if (!request || !UUID.test(request.hypothesisId) || !/^memory:[0-9a-f-]{36}$/i.test(request.evidenceId)) {
      throw new BadRequestException('Malformed hypothesis update identifiers.');
    }
    if (!Number.isSafeInteger(request.expectedVersion) || request.expectedVersion < 1) {
      throw new BadRequestException('Expected version must be a positive integer.');
    }
    if (request.evidenceRole !== 'SUPPORTING' && request.evidenceRole !== 'CONTRADICTING') {
      throw new BadRequestException('Invalid evidence role.');
    }
  }
}
