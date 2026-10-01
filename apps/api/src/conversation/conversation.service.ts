import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationRepository } from './conversation.repository';
import { ConversationTurnWorkRepository } from './conversation-turn-work.repository';
import type {
  ConversationHistoryExchange,
  ConversationHistoryPage,
  ConversationSession,
  ConversationTurn,
  OrchestratedTurnResult,
} from './conversation.types';
import { DataApiError, readDataApiUpstreamIdentity } from './supabase-data-api.service';
import { foregroundTurnWorkDeadlineMs, runForegroundTurnWork, type ForegroundTurnWorkGate } from './foreground-turn-work';
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

/** W1A-01: one history page by default, and a hard ceiling a caller cannot raise. */
const HISTORY_DEFAULT_LIMIT = 50;
const HISTORY_MAX_LIMIT = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * PROD-SEC-02: the one machine-readable refusal of a NEW turn admission (HTTP 429). It names the condition and
 * nothing else - no counter, window, limit, other session or other user - and it is only ever answered when the
 * database committed nothing, so the client may offer the same words again later as a new command.
 */
export const TURN_ADMISSION_LIMITED = 'TURN_ADMISSION_LIMITED';

/** The exact database refusal of migration 0131 (`RAISE ... USING ERRCODE = 'PT429'`), and nothing broader. */
function isTurnAdmissionLimited(error: unknown): boolean {
  if (!(error instanceof DataApiError) || error.status !== 429) return false;
  const identity = readDataApiUpstreamIdentity(error);
  return identity.databaseCode === 'PT429' && identity.databaseMessage === TURN_ADMISSION_LIMITED;
}

@Injectable()
export class ConversationService {
  constructor(private readonly repository: ConversationRepository, private readonly orchestrator: ConversationOrchestratorService,private readonly correlation:CorrelationService,private readonly semantic: ConversationSemanticEstablishmentService, private readonly turnWork: ConversationTurnWorkRepository) {}

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

  /**
   * PROD-SEC-02: the whole request runs inside ONE foreground work scope - one bounded work deadline, and the
   * database work lease of the exchange it advances, returned however the request ends. The admission bound
   * itself lives in `create_user_conversation_turn` (migration 0131); a refused NEW admission commits nothing
   * and answers the typed 429 below, before any orchestration, provider or semantic work.
   */
  async createTurn(userId: string, accessToken: string, sessionId: string, body: unknown): Promise<OrchestratedTurnResult> {
    const input = this.validateTurnInput(body);
    const gate: ForegroundTurnWorkGate = {
      begin: (workSessionId, userTurnId) => this.turnWork.begin(workSessionId, userId, userTurnId),
      end: (userTurnId, leaseId) => this.turnWork.end(userId, userTurnId, leaseId),
    };
    return runForegroundTurnWork(gate, foregroundTurnWorkDeadlineMs(), () => this.admitAndRunTurn(userId, accessToken, sessionId, input));
  }

  private async admitAndRunTurn(userId: string, accessToken: string, sessionId: string, input: { content: string; idempotencyKey?: string }): Promise<OrchestratedTurnResult> {
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
      if (isTurnAdmissionLimited(error)) throw new HttpException({ code: TURN_ADMISSION_LIMITED }, HttpStatus.TOO_MANY_REQUESTS);
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

  /**
   * W1A-01 (E2E-B-04) — the authoritative conversation-so-far of one owned Session.
   *
   * A pure read: it admits nothing, claims nothing, recovers nothing and never reaches the
   * orchestrator, so reading history can never create, regenerate or terminalize a turn. Ownership
   * is the same `resumeSession` check every Session route uses (404 when not the caller's), and
   * every row is read with the caller's token under row-level security.
   *
   * Pagination walks backwards over committed USER turns with an exclusive `before` cursor (a user
   * turn id the caller already holds), so the newest page loads first and older pages load on
   * demand. The page itself is returned oldest to newest.
   */
  async listTurns(userId: string, accessToken: string, sessionId: string, query: unknown): Promise<ConversationHistoryPage> {
    const { limit, before } = this.validateHistoryQuery(query);
    await this.resumeSession(userId, accessToken, sessionId);
    let cursor: { createdAt: string; id: string } | undefined;
    if (before !== undefined) {
      const anchor = await this.repository.findTurn(accessToken, sessionId, userId, before);
      if (!anchor || anchor.role !== 'USER') throw new BadRequestException('before must name a user turn of this session.');
      cursor = { createdAt: anchor.created_at, id: anchor.id };
    }
    const newestFirst = await this.repository.findUserTurnsPage(accessToken, sessionId, userId, limit + 1, cursor);
    const hasOlder = newestFirst.length > limit;
    const users = newestFirst.slice(0, limit).reverse();
    const assistants = await this.repository.findCompletedAssistantsForSources(
      accessToken, sessionId, userId, users.map((turn) => turn.id),
    );
    const replyBySource = new Map(assistants.map((turn) => [turn.source_turn_id, turn]));
    const exchanges = users.map((userTurn): ConversationHistoryExchange => {
      const reply = replyBySource.get(userTurn.id);
      return {
        userTurn: { id: userTurn.id, content: userTurn.content, idempotencyKey: userTurn.idempotency_key, createdAt: userTurn.created_at },
        // A reply exists only as a COMPLETED assistant turn, and FAILED is the committed turn's own
        // terminal state. Anything else is still outstanding — never reported as failed or answered.
        replyState: reply ? 'COMPLETED' : userTurn.status === 'FAILED' ? 'FAILED' : 'PENDING',
        assistantTurn: reply ? { id: reply.id, content: reply.content, createdAt: reply.created_at } : null,
      };
    });
    return { exchanges, hasOlder };
  }

  private validateHistoryQuery(query: unknown): { limit: number; before?: string } {
    const value = (query && typeof query === 'object' ? query : {}) as Record<string, unknown>;
    const allowed = new Set(['limit', 'before']);
    if (Object.keys(value).some((key) => !allowed.has(key))) {
      throw new BadRequestException('Request contains unsupported query parameters.');
    }
    let limit = HISTORY_DEFAULT_LIMIT;
    if (value.limit !== undefined) {
      if (typeof value.limit !== 'string' || !/^[1-9][0-9]{0,2}$/u.test(value.limit) || Number(value.limit) > HISTORY_MAX_LIMIT) {
        throw new BadRequestException(`limit must be an integer between 1 and ${HISTORY_MAX_LIMIT}.`);
      }
      limit = Number(value.limit);
    }
    if (value.before !== undefined && (typeof value.before !== 'string' || !UUID_PATTERN.test(value.before))) {
      throw new BadRequestException('before must be a turn id.');
    }
    return { limit, ...(typeof value.before === 'string' ? { before: value.before } : {}) };
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
