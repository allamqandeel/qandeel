import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationRepository } from './conversation.repository';
import type { ConversationSession, ConversationTurn, OrchestratedTurnResult } from './conversation.types';
import { DataApiError } from './supabase-data-api.service';
import { ConversationOrchestratorService } from './conversation-orchestrator.service';
import { ConversationSemanticEstablishmentService } from '../live-focus/conversation-semantic-establishment.service';
import { CorrelationService } from '../observability/correlation.service';

// T-03A2 / T-03D: turn handling is TWO distinct technical phases.
//
//   1. GENERATION / FINALIZATION - owned entirely by the orchestrator. Its
//      failure path is the only one that may mark a turn FAILED, call
//      `fail_conversation_turn` or record a generation-failure outcome.
//   2. POST-FINALIZATION SEMANTIC ESTABLISHMENT - owned by
//      ConversationSemanticEstablishmentService (the FINAL B1 + B2 + B3 +
//      effective-LF chain, T-03D) and reached only AFTER phase 1 has already
//      produced durable COMPLETED turns. T-03D replaced the temporary
//      T-03A2-only temporal establishment here; there is deliberately NO
//      temporal-only fallback path, because a fallback would seal Session
//      Positions without Live Focus.
//
// The two phases are separated structurally rather than by convention: the
// establishment call sits outside the orchestrator entirely, so a semantic
// establishment failure has NO code path through which it could falsify the
// conversation lifecycle - it cannot mark an already-COMPLETED turn FAILED,
// cannot record a false generation-failure outcome, cannot regenerate an
// assistant response, and is never reinterpreted as a semantic NO / NONE. It
// surfaces as a retryable service-unavailable response while the durable
// completed turns stay completed, and an idempotent replay re-enters
// establishment.

@Injectable()
export class ConversationService {
  constructor(private readonly repository: ConversationRepository, private readonly orchestrator: ConversationOrchestratorService,private readonly correlation:CorrelationService,private readonly semantic: ConversationSemanticEstablishmentService) {}

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
    // Idempotent replay is resolved first: a turn that was already admitted
    // durably under this key is returned regardless of the session's later
    // lifecycle state — replay recovers existing history, it is not a new
    // turn admission.
    if (input.idempotencyKey) {
      const existing = await this.repository.findTurnByIdempotencyKey(accessToken, sessionId, userId, input.idempotencyKey);
      if (existing){this.correlation.bindCanonical(existing.session_id,existing.id);return this.establishSemanticChain(userId, await this.orchestrator.orchestrate(accessToken, userId, existing));}
    }
    // Only NEW turn creation requires an ACTIVE/TEXT parent. The database
    // definer command (migration 0030) is authoritative for this admission;
    // this pre-check mirrors that predicate exactly — it adds no weaker or
    // different rule — so an inadmissible parent session maps to a stable 409
    // instead of a raw data-api failure.
    if (session.status !== 'ACTIVE' || session.channel !== 'TEXT') {
      throw new ConflictException('Conversation session does not accept new turns.');
    }
    // Only the durable admission is guarded here: the unique-violation race
    // path stays exactly as it was, and a later generation or semantic failure
    // is never mistaken for a duplicate-key race.
    let turn: ConversationTurn;
    try {
      turn = await this.repository.createTurn(accessToken, {
        id: randomUUID(), sessionId, userId, content: input.content, idempotencyKey: input.idempotencyKey,
      });
    } catch (error) {
      if (input.idempotencyKey && error instanceof DataApiError && error.status === 409) {
        const winner = await this.repository.findTurnByIdempotencyKey(accessToken, sessionId, userId, input.idempotencyKey);
        if (winner){this.correlation.bindCanonical(winner.session_id,winner.id);return this.establishSemanticChain(userId, await this.orchestrator.orchestrate(accessToken, userId, winner));}
      }
      throw error;
    }
    this.correlation.bindCanonical(turn.session_id,turn.id);
    return this.establishSemanticChain(userId, await this.orchestrator.orchestrate(accessToken, userId, turn));
  }

  /**
   * Phase 2. A completed exchange - new or idempotently replayed - re-enters
   * the FINAL semantic establishment, so a turn that finalized durably but
   * never established its Session time / semantics / Live Focus recovers on
   * replay, and an exchange that already has its canonical batches returns
   * the stored delivery with zero provider calls. Anything that is not a
   * completed USER + ASSISTANT pair passes through untouched.
   */
  private establishSemanticChain(userId: string, result: OrchestratedTurnResult): Promise<OrchestratedTurnResult> {
    return this.semantic.establish(userId, result);
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
