// SHARED-VIS-01 — QANDEEL weaving the Shared World's semantic places: the frozen I-03 / I-04G chain, composed for ONE pass.
//
// A pass rides on one committed human message of the World. It produces zero to three places — each ONE QANDEEL_ANALYSIS
// material with exact MATERIAL_DEPENDENCY sources, plus its stable World-local placement — and adds no authority of its
// own: it runs the same frozen boundaries, in the same order, as the S4-02 reply (`connected-worlds/material-commit`):
//
//   0  the pass lease (migration 0148)    no provider work runs unless the database grants this World its one live pass
//   1  EffectiveContext (I-03E)          exact World state + exact current audience; NO private candidate is offered
//   2  what EVERY recipient may see       the frozen 0089 resolver for each human of that audience, intersected (CW2-02
//                                         §15): hidden, deleted and partially visible material never reaches the reader;
//                                         only HUMAN_TEXT is an eligible source (QANDEEL's own output is UNRESOLVED, 0119)
//   3  the reading                        the provider-neutral Shared interpreter (refuses until Stage 8A)
//   4  the place                          the provider-neutral Shared placer (refuses until Stage 8A)
//   5  delivery readiness (I-03G → I-03F) the Source Disclosure Gate, then authority / audience revalidation, per meaning
//   6  the commit binding (I-04G FIX-B)   QANDEEL_ANALYSIS with the exact source identities
//   7  the server-owned commit (0148)     the conversation gate, the current lease holder only; the frozen 0090 core
//                                         re-derives the audience and approvers and refuses stale evidence on its own
//
// A refusal at any step commits nothing and fabricates nothing; the human's message and QANDEEL's reply are already
// committed and stay. While no provider is bound (production today), the pass returns before step 0: no lease, no read,
// no spend. No content, provider output or private context is logged, persisted or returned outside the canonical body.

import { Inject, Injectable } from '@nestjs/common';
import { SharedHumanAudienceResolverService } from '../connected-worlds/audience/shared-human-audience-resolver.service';
import { SharedDeliveryAuthorityRevalidatorService } from '../connected-worlds/delivery-authority/shared-delivery-authority-revalidator.service';
import { SharedEffectiveContextService } from '../connected-worlds/effective-context/shared-effective-context.service';
import type { SharedWorldId } from '../connected-worlds/kernel/world.types';
import { bindSharedQandeelMaterialCommit } from '../connected-worlds/material-commit/shared-qandeel-material-commit-binding';
import { SharedPrivacyAuthorityDeliveryReadinessService } from '../connected-worlds/source-disclosure/shared-privacy-authority-delivery-readiness.service';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import {
  SHARED_SEMANTIC_CONTRIBUTIONS_MAX, SHARED_SEMANTIC_INTERPRETATION_CONTRACT, SHARED_SEMANTIC_INTERPRETER, UnconfiguredSharedSemanticInterpreter,
  decodeSharedSemanticReading, type SharedSemanticInput, type SharedSemanticInterpreter,
} from './shared-semantic-interpreter';
import {
  SHARED_SPATIAL_PLACEMENT_CONTRACT, SHARED_SPATIAL_PLACER, UnconfiguredSharedSpatialPlacer, decodeSharedSpatialPlacement, type SharedSpatialPlacer,
} from './shared-spatial-placer';

export const SHARED_SEMANTIC_WORK_BEGIN_RPC = 'begin_shared_semantic_work_v1' as const;
export const SHARED_SEMANTIC_CONTEXT_RPC = 'read_shared_semantic_context_v1' as const;
export const SHARED_SEMANTIC_PLACE_COMMIT_RPC = 'complete_shared_semantic_place_v1' as const;
export const SHARED_SEMANTIC_WORK_END_RPC = 'end_shared_semantic_work_v1' as const;
const SHARED_MATERIAL_VISIBILITY_RPC = 'resolve_shared_world_material_v1' as const;
/** One reading is given a bounded time; the lease outlives it. */
const READING_TIMEOUT_MS = 30_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** What one pass did. Bounded internal classes; never user-facing, never a participant or a source. */
export type SharedSemanticPassOutcome =
  | { readonly state: 'WOVEN'; readonly placeIds: ReadonlyArray<string> }
  | { readonly state: 'NOT_RUN'; readonly reason: 'NO_PROVIDER' | 'MALFORMED_REQUEST' | 'DONE' | 'IN_PROGRESS' | 'LIMITED' | 'UNAVAILABLE' }
  | { readonly state: 'REFUSED'; readonly reason: 'CONTEXT_NOT_READY' | 'HISTORY_UNRESOLVED' | 'READING_UNAVAILABLE' | 'PLACEMENT_UNAVAILABLE'
    | 'DELIVERY_NOT_READY' | 'BINDING_REFUSED' | 'COMMIT_STALE' | 'COMMIT_REFUSED' };

export interface SharedSemanticPassRequest {
  readonly worldId: string;
  /** The committed HUMAN_TEXT command this pass rides on (the pass identity). */
  readonly humanCommandId: string;
}

interface VisibleMaterial { readonly materialId: string; readonly kind: string; readonly text: string | null; readonly establishedAt: string }

@Injectable()
export class SharedSemanticPlaceService {
  constructor(
    private readonly effectiveContext: SharedEffectiveContextService,
    private readonly readiness: SharedPrivacyAuthorityDeliveryReadinessService,
    private readonly revalidator: SharedDeliveryAuthorityRevalidatorService,
    private readonly audience: SharedHumanAudienceResolverService,
    private readonly server: SupabaseServiceRoleApiService,
    @Inject(SHARED_SEMANTIC_INTERPRETER) private readonly interpreter: SharedSemanticInterpreter,
    @Inject(SHARED_SPATIAL_PLACER) private readonly placer: SharedSpatialPlacer,
  ) {}

  /** Never throws: every failure is one bounded outcome, and nothing is committed by a refusal. */
  async weave(request: SharedSemanticPassRequest): Promise<SharedSemanticPassOutcome> {
    // Production today: no provider is bound, so nothing is leased, read or spent.
    if (this.interpreter instanceof UnconfiguredSharedSemanticInterpreter || this.placer instanceof UnconfiguredSharedSpatialPlacer) {
      return Object.freeze({ state: 'NOT_RUN', reason: 'NO_PROVIDER' } as const);
    }
    if (![request.worldId, request.humanCommandId].every((id) => typeof id === 'string' && UUID.test(id))) {
      return Object.freeze({ state: 'NOT_RUN', reason: 'MALFORMED_REQUEST' } as const);
    }
    const worldId = request.worldId.toLowerCase() as SharedWorldId;
    try {
      const begun = await this.server.rpc<unknown>(SHARED_SEMANTIC_WORK_BEGIN_RPC, { p_pass_command_id: request.humanCommandId, p_world_id: worldId });
      const work = Array.isArray(begun) ? begun[0] : undefined;
      if (!isRecord(work)) return notRun('UNAVAILABLE');
      if (work.work_outcome === 'DONE' || work.work_outcome === 'IN_PROGRESS' || work.work_outcome === 'LIMITED') return notRun(work.work_outcome);
      if (work.work_outcome !== 'GRANTED' || typeof work.work_lease_id !== 'string' || !UUID.test(work.work_lease_id)) return notRun('UNAVAILABLE');
      const leaseId = work.work_lease_id;
      let completed = false;
      try {
        const outcome = await this.composeUnderLease(request.humanCommandId, worldId, leaseId);
        completed = outcome.state === 'WOVEN';
        return outcome;
      } finally {
        // A completed pass is recorded (a retry starts nothing again); otherwise the World's slot is freed now. Best effort:
        // a lost return still expires on its own.
        await this.server.rpc<unknown>(SHARED_SEMANTIC_WORK_END_RPC, { p_pass_command_id: request.humanCommandId, p_lease_id: leaseId, p_completed: completed })
          .catch(() => undefined);
      }
    } catch {
      return refused('COMMIT_REFUSED');
    }
  }

  private async composeUnderLease(passCommandId: string, worldId: SharedWorldId, leaseId: string): Promise<SharedSemanticPassOutcome> {
    // 1. The pre-model envelope. No private candidate is offered: Personal context never enters a Shared reading.
    const context = await this.effectiveContext.resolve(worldId, []);
    if (context.state !== 'READY' || context.effectiveContext.privateReasoningContexts.length !== 0) return refused('CONTEXT_NOT_READY');
    const envelope = context.effectiveContext;

    // 2. What EVERY current recipient may see, in canonical order; the eligible sources are its human text.
    const visible = await this.visibleToEveryRecipient(worldId, envelope.audienceSnapshot.humans.map((human) => human.humanId));
    if (visible === null) return refused('HISTORY_UNRESOLVED');
    const eligible = visible.filter((material) => material.kind === 'HUMAN_TEXT' && typeof material.text === 'string' && material.text.trim().length > 0)
      .slice(-SHARED_SEMANTIC_CONTRIBUTIONS_MAX);
    if (eligible.length === 0) return woven([]);
    const refOf = new Map(eligible.map((material, index) => [material.materialId, index + 1]));
    const existingRows = await this.server.rpc<unknown>(SHARED_SEMANTIC_CONTEXT_RPC, { p_lease_id: leaseId, p_world_id: worldId });
    if (!Array.isArray(existingRows)) return refused('HISTORY_UNRESOLVED');
    const existing: { meaning: string; sourceRefs: number[] }[] = [];
    for (const row of existingRows) {
      if (!isRecord(row) || typeof row.meaning !== 'string' || !Array.isArray(row.source_material_ids)) return refused('HISTORY_UNRESOLVED');
      const sourceRefs = row.source_material_ids.flatMap((id) => (typeof id === 'string' && refOf.has(id.toLowerCase()) ? [refOf.get(id.toLowerCase()) as number] : []));
      // Only a meaning read entirely from what every current recipient may see (and is given now) is shown to the reader: a
      // meaning resting on anything else could carry it into the new reading.
      if (sourceRefs.length > 0 && sourceRefs.length === row.source_material_ids.length) existing.push({ meaning: row.meaning, sourceRefs });
    }
    const input: SharedSemanticInput = Object.freeze({
      contract: SHARED_SEMANTIC_INTERPRETATION_CONTRACT,
      contributions: Object.freeze(eligible.map((material, index) => Object.freeze({ ref: index + 1, text: material.text as string }))),
      existing: Object.freeze(existing.map((meaning) => Object.freeze({ meaning: meaning.meaning, sourceRefs: Object.freeze(meaning.sourceRefs) }))),
    });

    // 3. The reading.
    const reading = decodeSharedSemanticReading(await withTimeout((signal) => this.interpreter.read(input, signal)), input);
    if (reading === null) return refused('READING_UNAVAILABLE');

    const placeIds: string[] = [];
    for (const [index, proposal] of reading.places.entries()) {
      // 4. The place, in this World's own geography.
      const placement = decodeSharedSpatialPlacement(await withTimeout((signal) => this.placer.place(Object.freeze({
        contract: SHARED_SPATIAL_PLACEMENT_CONTRACT, worldId, meaning: proposal.meaning,
        primaryThemes: proposal.primaryThemes, secondaryThemes: proposal.secondaryThemes, semanticRegion: proposal.lensKey,
      }), signal)));
      if (placement === null) return refused('PLACEMENT_UNAVAILABLE');

      // 5. Delivery readiness in the frozen order, then the revalidation the binder checks it against.
      const readiness = await this.readiness.evaluate(envelope, proposal.meaning);
      if (readiness.state !== 'READY_FOR_LATER_DELIVERY_GATES') return refused('DELIVERY_NOT_READY');
      const revalidation = await this.revalidator.revalidate(envelope, proposal.meaning);
      const current = await this.audience.resolveCurrent(worldId);
      if (current.state !== 'RESOLVED') return refused('DELIVERY_NOT_READY');

      // 6. The commit inputs: QANDEEL_ANALYSIS over the exact sources it was read from; no reasoning dependency.
      const sourceIds = proposal.sourceRefs.map((ref) => eligible[ref - 1].materialId);
      const binding = bindSharedQandeelMaterialCommit({
        targetWorldId: worldId, materialKind: 'QANDEEL_ANALYSIS', outputText: proposal.meaning,
        currentAudienceSnapshotRef: current.snapshot.snapshotRef, revalidation, readiness, materialSourceIds: sourceIds, reasoningSourceRefs: [],
      });
      if (binding.state !== 'BOUND') return refused('BINDING_REFUSED');
      const bound = binding.input;

      // 7. The server's commit. The database re-checks everything it can see and refuses stale evidence on its own.
      const rows = await this.server.rpc<unknown>(SHARED_SEMANTIC_PLACE_COMMIT_RPC, {
        p_lease_id: leaseId, p_pass_command_id: passCommandId, p_place_ordinal: index + 1, p_world_id: bound.worldId, p_meaning: bound.bodyText,
        p_effective_context_ref: bound.effectiveContextRef, p_output_digest: bound.outputDigest, p_source_disclosure_gate_ref: bound.sourceDisclosureGateRef,
        p_authority_revalidation_ref: bound.authorityRevalidationRef, p_readiness_ref: bound.readinessRef, p_audience_snapshot_ref: bound.audienceSnapshotRef,
        p_material_source_ids: [...bound.materialSourceIds], p_primary_themes: [...proposal.primaryThemes], p_secondary_themes: [...proposal.secondaryThemes],
        p_semantic_region: proposal.lensKey, p_layout_version: placement.layoutVersion, p_world_x: placement.x, p_world_y: placement.y,
      });
      const row = Array.isArray(rows) ? rows[0] : undefined;
      if (!isRecord(row)) return refused('COMMIT_REFUSED');
      if (row.outcome === 'STALE') return refused('COMMIT_STALE');
      if (row.outcome !== 'MATERIAL_COMMITTED' || typeof row.material_id !== 'string' || !UUID.test(row.material_id)) return refused('COMMIT_REFUSED');
      placeIds.push(row.material_id);
    }
    return woven(placeIds);
  }

  /** The material every human of the audience may see, through the frozen resolver, oldest first; null when any read fails. */
  private async visibleToEveryRecipient(worldId: SharedWorldId, humanIds: ReadonlyArray<string>): Promise<VisibleMaterial[] | null> {
    if (humanIds.length === 0) return null;
    let intersection = null as Map<string, VisibleMaterial> | null;
    for (const humanId of humanIds) {
      const rows = await this.server.rpc<unknown>(SHARED_MATERIAL_VISIBILITY_RPC, { p_world_id: worldId, p_user_id: humanId });
      if (!Array.isArray(rows)) return null;
      const visible = new Map<string, VisibleMaterial>();
      for (const row of rows) {
        if (!isRecord(row) || typeof row.material_id !== 'string' || row.world_id !== worldId || typeof row.material_kind !== 'string'
          || typeof row.established_at !== 'string') return null;
        const id = row.material_id.toLowerCase();
        visible.set(id, { materialId: id, kind: row.material_kind, text: typeof row.text_body === 'string' ? row.text_body : null, establishedAt: row.established_at });
      }
      intersection = intersection === null ? visible : new Map([...intersection.entries()].filter(([id]) => visible.has(id)));
    }
    return [...(intersection ?? new Map<string, VisibleMaterial>()).values()]
      .sort((l, r) => (l.establishedAt < r.establishedAt ? -1 : l.establishedAt > r.establishedAt ? 1 : l.materialId < r.materialId ? -1 : 1));
  }
}

function notRun(reason: Extract<SharedSemanticPassOutcome, { state: 'NOT_RUN' }>['reason']): SharedSemanticPassOutcome {
  return Object.freeze({ state: 'NOT_RUN', reason } as const);
}
function refused(reason: Extract<SharedSemanticPassOutcome, { state: 'REFUSED' }>['reason']): SharedSemanticPassOutcome {
  return Object.freeze({ state: 'REFUSED', reason } as const);
}
function woven(placeIds: ReadonlyArray<string>): SharedSemanticPassOutcome {
  return Object.freeze({ state: 'WOVEN', placeIds: Object.freeze([...placeIds]) } as const);
}
async function withTimeout(run: (signal: AbortSignal) => Promise<unknown>): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), READING_TIMEOUT_MS);
  try {
    return await run(controller.signal);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
