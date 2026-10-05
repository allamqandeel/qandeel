// S4-02 — the request-driven Shared QANDEEL reply: the frozen I-03 / I-04G chain, composed for one human request.
//
// One accepted human text submission may produce at most ONE QANDEEL reply (S4-02 §1.2). This service is the only place
// that produces one, and it adds no authority of its own — it runs the frozen boundaries in their frozen order and lets
// the database decide:
//
//   0  the work lease (migration 0139)   no provider work runs unless the database grants this human command its one
//                                         live lease — at most one generation per command, two per requesting human and
//                                         a rolling work-start budget, across every API instance (the PROD-SEC-02
//                                         principle); the lease is returned however the request ends
//   1  EffectiveContext (I-03E)          exact World state (READ_ONLY_CLOSED blocks) + exact current audience; NO private
//                                         candidate is offered, so no Personal context can enter (see the types file)
//   2  Shared history for the audience    the requester's Product read (migration 0139), intersected with what EVERY human
//                                         of that exact audience may see through the frozen 0089 resolver (CW2-02 §15):
//                                         hidden and deleted material never reach the model
//   3  generation                         the Shared World boundary's generator over the provider-neutral Model Router
//   4  delivery readiness (I-03G → I-03F) the Source Disclosure Gate, then authority / audience revalidation, in order
//   5  the commit binding (I-04G FIX-B)   `bindSharedQandeelMaterialCommit` refuses evidence of another World, another
//                                         output, another operation or another audience
//   6  the server-owned commit (0139)     the conversation gate, the current lease holder only, one reply per human
//                                         command, QANDEEL_OUTPUT only; the frozen 0090 core re-derives the audience and
//                                         recomputes every digest itself
//
// A refusal at any step commits nothing and fabricates nothing: the human's message is already committed and stays.
// No content, provider output or private context is logged, persisted or returned outside the canonical material body.

import { Inject, Injectable } from '@nestjs/common';
import { SupabaseServiceRoleApiService } from '../../conversation/supabase-service-role-api.service';
import { SharedHumanAudienceResolverService } from '../audience/shared-human-audience-resolver.service';
import { SharedDeliveryAuthorityRevalidatorService } from '../delivery-authority/shared-delivery-authority-revalidator.service';
import { SharedEffectiveContextService } from '../effective-context/shared-effective-context.service';
import type { SharedWorldId } from '../kernel/world.types';
import { SharedPrivacyAuthorityDeliveryReadinessService } from '../source-disclosure/shared-privacy-authority-delivery-readiness.service';
import { bindSharedQandeelMaterialCommit } from './shared-qandeel-material-commit-binding';
import {
  SHARED_QANDEEL_REPLY_GENERATOR,
  type SharedConversationMaterial,
  type SharedQandeelReplyGenerator,
  type SharedQandeelReplyOutcome,
  type SharedQandeelReplyRefusal,
} from './shared-qandeel-reply.types';

/** The frozen 0089 material read boundary (service_role only) and the 0139 server-owned reply work. */
export const SHARED_MATERIAL_VISIBILITY_RPC = 'resolve_shared_world_material_v1' as const;
export const SHARED_QANDEEL_REPLY_WORK_BEGIN_RPC = 'begin_shared_qandeel_reply_work_v1' as const;
export const SHARED_QANDEEL_REPLY_WORK_END_RPC = 'end_shared_qandeel_reply_work_v1' as const;
export const SHARED_QANDEEL_REPLY_COMMIT_RPC = 'complete_shared_world_qandeel_reply_v1' as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function refused(reason: SharedQandeelReplyRefusal): SharedQandeelReplyOutcome {
  return Object.freeze({ state: 'UNAVAILABLE', reason } as const);
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export interface SharedQandeelReplyRequest {
  readonly worldId: string;
  /** The committed HUMAN_TEXT command this reply answers; the 0139 commit derives the reply's identities from it. */
  readonly humanCommandId: string;
  /** The material that command committed: the message being answered. */
  readonly humanMaterialId: string;
  /** The requesting human (authenticated by the route) — only to attribute provider spend. */
  readonly requesterUserId: string;
  /** The requesting member's own Product read of this exact World (0139), newest first. */
  readonly requesterView: ReadonlyArray<SharedConversationMaterial>;
}

@Injectable()
export class SharedQandeelReplyService {
  constructor(
    private readonly effectiveContext: SharedEffectiveContextService,
    private readonly readiness: SharedPrivacyAuthorityDeliveryReadinessService,
    private readonly revalidator: SharedDeliveryAuthorityRevalidatorService,
    private readonly audience: SharedHumanAudienceResolverService,
    private readonly server: SupabaseServiceRoleApiService,
    @Inject(SHARED_QANDEEL_REPLY_GENERATOR) private readonly generator: SharedQandeelReplyGenerator,
  ) {}

  /** Never throws: every failure is one bounded refusal, and nothing is committed by a refusal. */
  async reply(request: SharedQandeelReplyRequest): Promise<SharedQandeelReplyOutcome> {
    try {
      return await this.compose(request);
    } catch {
      return refused('COMMIT_REFUSED');
    }
  }

  private async compose(request: SharedQandeelReplyRequest): Promise<SharedQandeelReplyOutcome> {
    if (![request.worldId, request.humanCommandId, request.humanMaterialId, request.requesterUserId].every((id) => typeof id === 'string' && UUID.test(id))) {
      return refused('MALFORMED_REQUEST');
    }
    // The identity names a born World: the human's message was just committed into it by the frozen 0090 core, and the
    // World-state resolver below re-establishes it canonically before anything else is read.
    const worldId = request.worldId.toLowerCase() as SharedWorldId;

    // 0. The work lease. Nothing below — no read, no provider call — runs without it.
    const begun = await this.server.rpc<unknown>(SHARED_QANDEEL_REPLY_WORK_BEGIN_RPC, {
      p_human_command_id: request.humanCommandId,
      p_world_id: worldId,
      p_requester_user_id: request.requesterUserId,
    });
    const work = Array.isArray(begun) ? begun[0] : undefined;
    if (!isRecord(work)) return refused('WORK_UNAVAILABLE');
    if (work.work_outcome === 'ALREADY_COMMITTED' && typeof work.reply_material_id === 'string' && UUID.test(work.reply_material_id)) {
      return Object.freeze({ state: 'COMMITTED', materialId: work.reply_material_id } as const);
    }
    if (work.work_outcome === 'IN_PROGRESS') return refused('WORK_IN_PROGRESS');
    if (work.work_outcome === 'LIMITED') return refused('WORK_LIMITED');
    if (work.work_outcome !== 'GRANTED' || typeof work.work_lease_id !== 'string' || !UUID.test(work.work_lease_id)) return refused('WORK_UNAVAILABLE');
    const leaseId = work.work_lease_id;
    try {
      return await this.composeUnderLease(request, worldId, leaseId);
    } finally {
      // Completing already returned it; otherwise the slot is freed now rather than at expiry. Best effort: a lost
      // return still expires on its own.
      await this.server.rpc<unknown>(SHARED_QANDEEL_REPLY_WORK_END_RPC, { p_human_command_id: request.humanCommandId, p_lease_id: leaseId }).catch(() => undefined);
    }
  }

  private async composeUnderLease(request: SharedQandeelReplyRequest, worldId: SharedWorldId, leaseId: string): Promise<SharedQandeelReplyOutcome> {

    // 1. The pre-model envelope. No private candidate is offered: Personal context never enters a Shared call here.
    const context = await this.effectiveContext.resolve(worldId, []);
    if (context.state !== 'READY' || context.effectiveContext.privateReasoningContexts.length !== 0) return refused('CONTEXT_NOT_READY');
    const envelope = context.effectiveContext;

    // 2. The Shared history EVERY current recipient may see (CW2-02 §15), in canonical order.
    const visibleToAll = await this.visibleToEveryRecipient(worldId, envelope.audienceSnapshot.humans.map((human) => human.humanId));
    if (visibleToAll === null) return refused('HISTORY_UNRESOLVED');
    const conversation = [...request.requesterView]
      .filter((material) => visibleToAll.has(material.materialId.toLowerCase()))
      .sort((left, right) => (left.establishedAt < right.establishedAt ? -1 : left.establishedAt > right.establishedAt ? 1 : left.materialId < right.materialId ? -1 : 1));
    const answered = conversation.at(-1);
    if (answered === undefined || answered.materialId.toLowerCase() !== request.humanMaterialId.toLowerCase() || answered.producer !== 'HUMAN') {
      return refused('HISTORY_UNRESOLVED');
    }

    // 3. The words.
    const generated = await this.generator.generate(Object.freeze({
      requesterUserId: request.requesterUserId,
      conversation: Object.freeze(conversation.map((material) => Object.freeze({ producer: material.producer, authorName: material.authorName, text: material.text }))),
    }));
    if (generated.state !== 'GENERATED' || generated.text.trim().length === 0) return refused('GENERATION_UNAVAILABLE');
    const text = generated.text;

    // 4. Delivery readiness in the frozen order, then the revalidation the binder checks it against.
    const readiness = await this.readiness.evaluate(envelope, text);
    if (readiness.state !== 'READY_FOR_LATER_DELIVERY_GATES') return refused('DELIVERY_NOT_READY');
    const revalidation = await this.revalidator.revalidate(envelope, text);
    const current = await this.audience.resolveCurrent(worldId);
    if (current.state !== 'RESOLVED') return refused('DELIVERY_NOT_READY');

    // 5. The commit inputs, or a refusal. No material and no reasoning dependency: a conversational reply reproduces no
    //    source material (so an owner's later deletion of a message leaves the reply as historical discussion, CW2-02
    //    §27) and no private context was admitted.
    const binding = bindSharedQandeelMaterialCommit({
      targetWorldId: worldId,
      materialKind: 'QANDEEL_OUTPUT',
      outputText: text,
      currentAudienceSnapshotRef: current.snapshot.snapshotRef,
      revalidation,
      readiness,
      materialSourceIds: [],
      reasoningSourceRefs: [],
    });
    if (binding.state !== 'BOUND') return refused('BINDING_REFUSED');
    const input = binding.input;

    // 6. The server's commit. The database re-checks everything it can see and refuses stale evidence on its own.
    const rows = await this.server.rpc<unknown>(SHARED_QANDEEL_REPLY_COMMIT_RPC, {
      p_lease_id: leaseId,
      p_human_command_id: request.humanCommandId,
      p_world_id: input.worldId,
      p_body_text: input.bodyText,
      p_effective_context_ref: input.effectiveContextRef,
      p_output_digest: input.outputDigest,
      p_source_disclosure_gate_ref: input.sourceDisclosureGateRef,
      p_authority_revalidation_ref: input.authorityRevalidationRef,
      p_readiness_ref: input.readinessRef,
      p_audience_snapshot_ref: input.audienceSnapshotRef,
      p_material_source_ids: [...input.materialSourceIds],
      p_reasoning_source_refs: [...input.reasoningSourceRefs],
    });
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!isRecord(row)) return refused('COMMIT_REFUSED');
    if (row.outcome === 'MATERIAL_COMMITTED' && typeof row.material_id === 'string' && UUID.test(row.material_id)) {
      return Object.freeze({ state: 'COMMITTED', materialId: row.material_id } as const);
    }
    return refused(row.outcome === 'STALE' ? 'COMMIT_STALE' : 'COMMIT_REFUSED');
  }

  /** The material ids every human of the audience may see, through the frozen resolver; null when any read fails. */
  private async visibleToEveryRecipient(worldId: SharedWorldId, humanIds: ReadonlyArray<string>): Promise<Set<string> | null> {
    let intersection: Set<string> | null = null as Set<string> | null;
    for (const humanId of humanIds) {
      const rows = await this.server.rpc<unknown>(SHARED_MATERIAL_VISIBILITY_RPC, { p_world_id: worldId, p_user_id: humanId });
      if (!Array.isArray(rows)) return null;
      const visible = new Set<string>();
      for (const row of rows) {
        if (!isRecord(row) || typeof row.material_id !== 'string' || row.world_id !== worldId) return null;
        visible.add(row.material_id.toLowerCase());
      }
      const previous: Set<string> | null = intersection;
      intersection = previous === null ? visible : new Set([...previous].filter((id: string) => visible.has(id)));
    }
    return intersection;
  }
}
