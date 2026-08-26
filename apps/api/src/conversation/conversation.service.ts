import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationRepository } from './conversation.repository';
import type { ConversationSession, ConversationTurn, OrchestratedTurnResult } from './conversation.types';
import { DataApiError } from './supabase-data-api.service';
import { ConversationOrchestratorService } from './conversation-orchestrator.service';
import { CorrelationService } from '../observability/correlation.service';

@Injectable()
export class ConversationService {
  constructor(private readonly repository: ConversationRepository, private readonly orchestrator: ConversationOrchestratorService,private readonly correlation:CorrelationService) {}

  // userId stays in the signature for the authenticated controller contract,
  // but it is never serialized as mutation authority: the database derives the
  // session owner from auth.uid() on the caller token (migration 0030).
  async createSession(_userId: string, accessToken: string): Promise<ConversationSession> {
    const session=await this.repository.createSession(accessToken, randomUUID());
    this.correlation.bindCanonical(session.id);
    return session;
  }

  async resumeSession(userId: string, accessToken: string, sessionId: string): Promise<ConversationSession> {
    const session = await this.repository.findSession(accessToken, sessionId, userId);
    if (!session) throw new NotFoundException('Conversation session was not found.');
    this.correlation.bindCanonical(session.id);
    return session;
  }

  async createTurn(userId: string, accessToken: string, sessionId: string, body: unknown): Promise<OrchestratedTurnResult> {
    const input = this.validateTurnInput(body);
    const session = await this.resumeSession(userId, accessToken, sessionId);
    // The database definer command is authoritative for ACTIVE/TEXT admission
    // (migration 0030). This pre-check mirrors that predicate exactly — it adds
    // no weaker or different rule — so an inadmissible parent session maps to a
    // stable 409 instead of a raw data-api failure.
    if (session.status !== 'ACTIVE' || session.channel !== 'TEXT') {
      throw new ConflictException('Conversation session does not accept new turns.');
    }
    if (input.idempotencyKey) {
      const existing = await this.repository.findTurnByIdempotencyKey(accessToken, sessionId, userId, input.idempotencyKey);
      if (existing){this.correlation.bindCanonical(existing.session_id,existing.id);return this.orchestrator.orchestrate(accessToken, userId, existing);}
    }
    try {
      const turn = await this.repository.createTurn(accessToken, {
        id: randomUUID(), sessionId, userId, content: input.content, idempotencyKey: input.idempotencyKey,
      });
      this.correlation.bindCanonical(turn.session_id,turn.id);
      return this.orchestrator.orchestrate(accessToken, userId, turn);
    } catch (error) {
      if (input.idempotencyKey && error instanceof DataApiError && error.status === 409) {
        const winner = await this.repository.findTurnByIdempotencyKey(accessToken, sessionId, userId, input.idempotencyKey);
        if (winner){this.correlation.bindCanonical(winner.session_id,winner.id);return this.orchestrator.orchestrate(accessToken, userId, winner);}
      }
      throw error;
    }
  }

  async cancelTurn(userId: string, accessToken: string, sessionId: string, turnId: string): Promise<ConversationTurn> {
    await this.resumeSession(userId, accessToken, sessionId);
    const turn = await this.repository.cancelTurn(accessToken, sessionId, turnId, userId);
    if (!turn) throw new ConflictException('Turn is missing or already terminal.');
    this.correlation.bindCanonical(turn.session_id,turn.id);
    return turn;
  }

  private validateTurnInput(body: unknown): { content: string; idempotencyKey?: string } {
    if (!body || typeof body !== 'object') throw new BadRequestException('Request body is required.');
    const value = body as Record<string, unknown>;
    if (typeof value.content !== 'string' || value.content.trim().length === 0 || value.content.length > 20000) {
      throw new BadRequestException('content must contain between 1 and 20000 characters.');
    }
    if (value.idempotencyKey !== undefined &&
      (typeof value.idempotencyKey !== 'string' || value.idempotencyKey.length < 1 || value.idempotencyKey.length > 128)) {
      throw new BadRequestException('idempotencyKey must contain between 1 and 128 characters.');
    }
    const allowed = new Set(['content', 'idempotencyKey']);
    if (Object.keys(value).some((key) => !allowed.has(key))) {
      throw new BadRequestException('Request contains unsupported fields.');
    }
    return { content: value.content, ...(typeof value.idempotencyKey === 'string' ? { idempotencyKey: value.idempotencyKey } : {}) };
  }
}
