import { Injectable } from '@nestjs/common';
import { HimSessionContextBindingRepository } from './him-session-context-binding.repository';
import {
  HIM_CROSS_CONTEXT_KINDS,
  HIM_SESSION_CONTEXT_BINDING_PROVENANCE,
  HIM_SESSION_CONTEXT_BINDING_SOURCE,
  type HimActiveSessionContextBinding,
  type HimActiveSessionContextBindings,
  type HimCrossContextKind,
  type HimRetiredSessionContextBinding,
  type HimSessionContextBindingClearResult,
  type HimSessionContextBindingSetResult,
  type HimSessionContextBindingSourceRow,
} from './him-session-context-binding.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// QHIA-006: the explicit session-to-cross-context Runtime relevance boundary.
// Every command and read receives EXACT IDs - never prose, labels, provider
// output, or any inferred selection - and every database row is validated
// fail-closed before projection. This service decides nothing about which
// context is relevant: it transports and verifies the explicit authenticated
// authority the migration-0055 commands established. An ACTIVE binding grants
// no metric consumption authority, implies no KNOWN metric, and changes no
// question, recommendation, safety, or FAST/DEEP behavior. No clock, no
// randomness, no provider, and no fallback of any kind exists here: an
// absent binding stays absent.
@Injectable()
export class HimSessionContextBindingService {
  constructor(private readonly repository: HimSessionContextBindingRepository) {}

  async setBinding(
    userId: string,
    token: string,
    sessionId: string,
    contextKind: HimCrossContextKind,
    contextId: string,
  ): Promise<HimSessionContextBindingSetResult> {
    this.validateIdentity(userId, sessionId);
    this.validateKind(contextKind);
    if (typeof contextId !== 'string' || !UUID.test(contextId)) throw new Error('INVALID_SESSION_CONTEXT_BINDING_REQUEST');
    const row = await this.repository.setBinding(token, userId, sessionId, contextKind, contextId);
    const binding = this.validateActiveRow(row, userId, sessionId);
    // The command answers for exactly the requested binding: a returned row
    // carrying any other kind or target is a fail-closed integrity breach,
    // never a substitution to accept.
    if (binding.contextKind !== contextKind || binding.contextId !== contextId) throw new Error('INTEGRITY_FAILURE');
    return {
      contractVersion: 1,
      source: HIM_SESSION_CONTEXT_BINDING_SOURCE,
      sessionId,
      binding,
    };
  }

  async clearBinding(
    userId: string,
    token: string,
    sessionId: string,
    contextKind: HimCrossContextKind,
  ): Promise<HimSessionContextBindingClearResult> {
    this.validateIdentity(userId, sessionId);
    this.validateKind(contextKind);
    const row = await this.repository.clearBinding(token, userId, sessionId, contextKind);
    if (row === undefined) {
      // Idempotent already-clear: the database wrote nothing and returned
      // zero rows.
      return { contractVersion: 1, source: HIM_SESSION_CONTEXT_BINDING_SOURCE, sessionId, cleared: false, retiredBinding: null };
    }
    const retired = this.validateRetiredRow(row, userId, sessionId);
    if (retired.contextKind !== contextKind) throw new Error('INTEGRITY_FAILURE');
    return { contractVersion: 1, source: HIM_SESSION_CONTEXT_BINDING_SOURCE, sessionId, cleared: true, retiredBinding: retired };
  }

  async readActiveBindings(
    userId: string,
    token: string,
    sessionId: string,
  ): Promise<HimActiveSessionContextBindings> {
    this.validateIdentity(userId, sessionId);
    const rows = await this.repository.readActiveBindings(token, userId, sessionId);
    if (!Array.isArray(rows) || rows.length > HIM_CROSS_CONTEXT_KINDS.length) throw new Error('INTEGRITY_FAILURE');
    const bindings: HimActiveSessionContextBinding[] = [];
    let previousKindIndex = -1;
    for (const row of rows) {
      const binding = this.validateActiveRow(row, userId, sessionId);
      // The database read must arrive in the canonical fixed kind order with
      // no duplicate kind. A reordered, duplicated, or oversized result is
      // never silently sorted, deduplicated, or repaired into correctness.
      const kindIndex = HIM_CROSS_CONTEXT_KINDS.indexOf(binding.contextKind);
      if (kindIndex <= previousKindIndex) throw new Error('INTEGRITY_FAILURE');
      previousKindIndex = kindIndex;
      bindings.push(binding);
    }
    return {
      contractVersion: 1,
      source: HIM_SESSION_CONTEXT_BINDING_SOURCE,
      sessionId,
      bindingCount: bindings.length,
      bindings,
    };
  }

  private validateIdentity(userId: string, sessionId: string): void {
    if (typeof userId !== 'string' || !UUID.test(userId)) throw new Error('INVALID_SESSION_CONTEXT_BINDING_REQUEST');
    if (typeof sessionId !== 'string' || !UUID.test(sessionId)) throw new Error('INVALID_SESSION_CONTEXT_BINDING_REQUEST');
  }

  private validateKind(contextKind: HimCrossContextKind): void {
    if (!HIM_CROSS_CONTEXT_KINDS.includes(contextKind)) throw new Error('INVALID_SESSION_CONTEXT_BINDING_REQUEST');
  }

  // Shared structural validation of one source row against the exact request
  // identity; the lifecycle expectation differs per path.
  private validateRow(
    row: HimSessionContextBindingSourceRow,
    userId: string,
    sessionId: string,
  ): { bindingId: string; bindingVersion: number; contextKind: HimCrossContextKind; contextId: string } {
    if (row === null || typeof row !== 'object') throw new Error('INTEGRITY_FAILURE');
    if (row.user_id !== userId || row.conversation_session_id !== sessionId) throw new Error('INTEGRITY_FAILURE');
    if (!HIM_CROSS_CONTEXT_KINDS.includes(row.context_kind as HimCrossContextKind)) throw new Error('INTEGRITY_FAILURE');
    if (typeof row.id !== 'string' || !UUID.test(row.id)) throw new Error('INTEGRITY_FAILURE');
    if (typeof row.context_id !== 'string' || !UUID.test(row.context_id)) throw new Error('INTEGRITY_FAILURE');
    if (!Number.isSafeInteger(row.binding_version) || row.binding_version <= 0) throw new Error('INTEGRITY_FAILURE');
    if (row.binding_source !== HIM_SESSION_CONTEXT_BINDING_SOURCE) throw new Error('INTEGRITY_FAILURE');
    if (row.canonical_provenance !== HIM_SESSION_CONTEXT_BINDING_PROVENANCE) throw new Error('INTEGRITY_FAILURE');
    if (typeof row.created_at !== 'string' || row.created_at.length === 0) throw new Error('INTEGRITY_FAILURE');
    return {
      bindingId: row.id,
      bindingVersion: row.binding_version,
      contextKind: row.context_kind as HimCrossContextKind,
      contextId: row.context_id,
    };
  }

  private validateActiveRow(
    row: HimSessionContextBindingSourceRow,
    userId: string,
    sessionId: string,
  ): HimActiveSessionContextBinding {
    const binding = this.validateRow(row, userId, sessionId);
    if (row.status !== 'ACTIVE' || row.retired_at !== null) throw new Error('INTEGRITY_FAILURE');
    return binding;
  }

  private validateRetiredRow(
    row: HimSessionContextBindingSourceRow,
    userId: string,
    sessionId: string,
  ): HimRetiredSessionContextBinding {
    const binding = this.validateRow(row, userId, sessionId);
    if (row.status !== 'RETIRED' || typeof row.retired_at !== 'string' || row.retired_at.length === 0)
      throw new Error('INTEGRITY_FAILURE');
    return binding;
  }
}
