import { BadRequestException, Injectable } from '@nestjs/common';
import { HimSessionContextBindingService } from '../human-model/him-session-context-binding.service';
import {
  CONVERSATION_CONTEXT_ACTIVATION_SOURCE,
  HIM_CROSS_CONTEXT_KINDS,
  type ConversationActiveContext,
  type ConversationContextActivationClearResult,
  type ConversationContextActivationReadResult,
  type ConversationContextActivationSetResult,
  type HimCrossContextKind,
} from './conversation-context-activation.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVATION_REQUEST_FIELDS = Object.freeze(['contextId']);

// QHIA-011A: the narrow product-facing facade over the EXISTING QHIA-006
// explicit relevance authority.
//
// It does exactly four things:
//
//   1. structural route-kind validation (exactly the four cross-context kinds);
//   2. exact set-body validation (exactly one field, exactly one UUID);
//   3. ONE delegation per command to HimSessionContextBindingService;
//   4. minimal product projection.
//
// It owns NO relevance rule of its own. It performs no target lookup, no
// target listing, no target search, no label match, no fuzzy match, no
// embedding, no similarity, no "latest/first/only/most recently measured"
// selection, no topic detection, no model or provider call, no conversation
// read, no Memory/Hypothesis/Recommendation read, and no measurement or target
// creation. Ownership, kind, session runtime state, target existence,
// same-target idempotency, atomic replacement, append-only history and
// advisory-lock race safety all remain the migration-0055 authority's, reached
// through the one existing QHIA-006 service and its one existing repository.
//
// Deliberately absent, and structurally impossible here:
//
//   * read-before-write. Set delegates ONE setBinding call. Nothing is read
//     first, so the authority can never be raced against a stale local view.
//   * clear-then-set replacement. Replacing the active context of a kind is
//     the SAME single set call: migration 0055 retires the previous ACTIVE row
//     and creates the next version atomically under its advisory lock. A
//     clear+set pair here would open a window in which the session has no
//     active context at all.
//   * any automatic path. This service is reachable from the authenticated
//     activation controller only - never from ConversationService.createTurn,
//     the Conversation Orchestrator, the ContextBuilder, the Model Router, any
//     provider, Memory, Hypothesis, Recommendation, the Question runtime,
//     Background or Post-Response Intelligence, or any HIM foreground consumer.
@Injectable()
export class ConversationContextActivationService {
  constructor(private readonly bindings: HimSessionContextBindingService) {}

  // Set or replace the exact active context of exactly one kind for one owned
  // ACTIVE session. Exactly ONE QHIA-006 set command is issued, whether this is
  // a first activation, an idempotent replay of the same target, or a
  // replacement by a different target of the same kind.
  async activateContext(
    userId: string,
    accessToken: string,
    sessionId: string,
    contextKind: string,
    body: unknown,
  ): Promise<ConversationContextActivationSetResult> {
    const kind = this.requireContextKind(contextKind);
    const session = this.requireSessionId(sessionId);
    const contextId = this.requireActivationBody(body);
    const result = await this.bindings.setBinding(userId, accessToken, session, kind, contextId);
    return {
      contractVersion: 1,
      source: CONVERSATION_CONTEXT_ACTIVATION_SOURCE,
      sessionId: result.sessionId,
      activeBinding: this.project(result.binding),
    };
  }

  // Clear the active context of exactly one kind. The command carries only the
  // authenticated identity, the exact session and the exact route kind: there
  // is no body, no target id, and no "clear all" semantics. Clearing an
  // already-clear kind writes nothing and reports cleared:false.
  async deactivateContext(
    userId: string,
    accessToken: string,
    sessionId: string,
    contextKind: string,
  ): Promise<ConversationContextActivationClearResult> {
    const kind = this.requireContextKind(contextKind);
    const session = this.requireSessionId(sessionId);
    const result = await this.bindings.clearBinding(userId, accessToken, session, kind);
    // The retired binding identity the QHIA-006 result carries is deliberately
    // not projected: Product asked to clear a kind, and the answer is whether
    // an active context of that kind existed.
    return {
      contractVersion: 1,
      source: CONVERSATION_CONTEXT_ACTIVATION_SOURCE,
      sessionId: result.sessionId,
      contextKind: kind,
      cleared: result.cleared,
    };
  }

  // Read the exact ACTIVE contexts of one owned ACTIVE session, in the
  // canonical fixed kind order the QHIA-006 read authority already validated.
  // Nothing is re-sorted, re-ranked, deduplicated, filtered to a primary
  // context, or joined against target text.
  async readActiveContexts(
    userId: string,
    accessToken: string,
    sessionId: string,
  ): Promise<ConversationContextActivationReadResult> {
    const session = this.requireSessionId(sessionId);
    const result = await this.bindings.readActiveBindings(userId, accessToken, session);
    return {
      contractVersion: 1,
      source: CONVERSATION_CONTEXT_ACTIVATION_SOURCE,
      sessionId: result.sessionId,
      bindingCount: result.bindingCount,
      bindings: result.bindings.map((binding) => this.project(binding)),
    };
  }

  // The minimal projection: exact kind and exact context id. Every internal
  // binding lifecycle fact the QHIA-006 service validated - binding id,
  // binding version, binding source, canonical provenance, created_at,
  // retired_at - stops here and never reaches Product.
  private project(binding: ConversationActiveContext): ConversationActiveContext {
    return { contextKind: binding.contextKind, contextId: binding.contextId };
  }

  private requireContextKind(contextKind: string): HimCrossContextKind {
    if (typeof contextKind !== 'string' || !HIM_CROSS_CONTEXT_KINDS.includes(contextKind as HimCrossContextKind)) {
      throw new BadRequestException('contextKind must be one of GOAL, SITUATION, DECISION, RELATIONSHIP.');
    }
    return contextKind as HimCrossContextKind;
  }

  private requireSessionId(sessionId: string): string {
    if (typeof sessionId !== 'string' || !UUID.test(sessionId)) {
      throw new BadRequestException('sessionId must be a conversation session identifier.');
    }
    return sessionId;
  }

  // The exact set body: an object carrying exactly one key, contextId, whose
  // value is an exact target identifier. Prose, a display label, a reason, a
  // confidence, a source selector, a suggestion payload, or any additional key
  // is rejected BEFORE transport - it is never trimmed, coerced, ignored, or
  // silently dropped on the way to the authority.
  private requireActivationBody(body: unknown): string {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Request body is required.');
    }
    const value = body as Record<string, unknown>;
    const keys = Object.keys(value);
    if (keys.some((key) => !ACTIVATION_REQUEST_FIELDS.includes(key))) {
      throw new BadRequestException('Request contains unsupported fields.');
    }
    if (typeof value.contextId !== 'string' || !UUID.test(value.contextId)) {
      throw new BadRequestException('contextId must be an exact context identifier.');
    }
    return value.contextId;
  }
}
