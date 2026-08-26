import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfidenceService } from './confidence.service';
import { validateHypothesisUpdateRequest } from './hypothesis-update.policy';
import { HypothesisUpdateRepository } from './hypothesis-update.repository';
import type { HypothesisUpdateRequest, HypothesisUpdateResult } from './hypothesis-update.types';

@Injectable()
export class HypothesisUpdateService {
  constructor(private readonly repository: HypothesisUpdateRepository, private readonly confidence: ConfidenceService) {}

  async apply(userId: string, token: string, request: HypothesisUpdateRequest): Promise<HypothesisUpdateResult> {
    validateHypothesisUpdateRequest(request);
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
}
