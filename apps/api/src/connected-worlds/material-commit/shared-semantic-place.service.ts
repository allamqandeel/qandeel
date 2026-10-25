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
//   3  the reading                        the provider-neutral Shared interpreter (S8A-04 CP1: DeepSeek Flash), told who
//                                         wrote each contribution by request-local speaker tokens from the author the
//                                         frozen resolver holds, inside the AI-COST-01 scope of the verified sender
//   4  the place                          the provider-neutral Shared placer: ONE call names each new meaning's anchors,
//                                         and the server's pure geometry derives its point (S8A-04 CP2 §4); unbound in
//                                         production until the CP2 §11 conditions hold
//   5  delivery readiness (I-03G → I-03F) the Source Disclosure Gate, then authority / audience revalidation, per meaning
//   6  the commit binding (I-04G FIX-B)   QANDEEL_ANALYSIS with the exact source identities
//   7  the server-owned commit (0175)     the conversation gate, the current lease holder only; the frozen 0090 core
//                                         re-derives the audience and approvers and refuses stale evidence on its own;
//                                         S8A-04 CP2: the place, its attribution, its people and its revision are ONE write,
//                                         which re-checks every attribution rule and refuses rather than substitutes
//
// S8A-04 CP2 (Shared Social Memory Controlled Amendment §2, §3.2.6, §4): the reading is given the World's saved positions —
// the ones the reply was given, those resting on the window and those of the window's people, at most 200 and 24 KB, only
// what every current recipient may see — with their attribution in this reading's tokens, and answers whose each place is.
//
// A refusal at any step commits nothing and fabricates nothing; the human's message and QANDEEL's reply are already
// committed and stay. While the placer has no provider (production until S8A-04 CP2), the pass returns before step 0: no
// lease, no read, no spend. No content, provider output or private context is logged, persisted or returned outside the canonical body.

import { Inject, Injectable } from '@nestjs/common';
import { SharedHumanAudienceResolverService } from '../audience/shared-human-audience-resolver.service';
import { SharedDeliveryAuthorityRevalidatorService } from '../delivery-authority/shared-delivery-authority-revalidator.service';
import { SharedEffectiveContextService } from '../effective-context/shared-effective-context.service';
import type { SharedWorldId } from '../kernel/world.types';
import { bindSharedQandeelMaterialCommit } from './shared-qandeel-material-commit-binding';
import { SharedPrivacyAuthorityDeliveryReadinessService } from '../source-disclosure/shared-privacy-authority-delivery-readiness.service';
import { SupabaseServiceRoleApiService } from '../../conversation/supabase-service-role-api.service';
import { runWithAiUsageAttribution, type AiUsageAttribution } from '../../ai-usage/ai-usage-attribution';
import { escapeDeepSeekData } from '../../model-router/providers/deepseek/deepseek-client';
import { sharedConversationLabels } from '../../shared-world/shared-conversation-model-input';
import { SHARED_FIELD_LAYOUT_VERSION, compareCodePoints, inMeaningOrder, placeNewMeanings, type ExistingFieldPlace } from '../../shared-world/shared-field-geometry';
import {
  SHARED_SEMANTIC_CONTRIBUTIONS_MAX, SHARED_SEMANTIC_EXISTING_BYTES, SHARED_SEMANTIC_EXISTING_MAX, SHARED_SEMANTIC_INTERPRETATION_CONTRACT,
  SHARED_SEMANTIC_INTERPRETER, UnconfiguredSharedSemanticInterpreter, decodeSharedSemanticReading, sharedSemanticReadingLabels,
  type SharedSemanticExistingMeaning, type SharedSemanticInput, type SharedSemanticInterpreter,
} from '../../shared-world/shared-semantic-interpreter';
import {
  SHARED_PLACEMENT_DATA_BYTES_MAX, SHARED_PLACEMENT_MAP_MAX, SHARED_PLACEMENT_REGIONS_MAX, SHARED_SPATIAL_PLACEMENT_CONTRACT, SHARED_SPATIAL_PLACER,
  UnconfiguredSharedSpatialPlacer, decodeSharedSpatialPlacement, type SharedSpatialPlacementInput, type SharedSpatialPlacer,
} from '../../shared-world/shared-spatial-placer';
import { extendSharedLabels } from '../../shared-world/shared-world-knowledge';

export const SHARED_SEMANTIC_WORK_BEGIN_RPC = 'begin_shared_semantic_work_v1' as const;
/** S8A-04 CP2 (0175): the attributed context and the atomic V2 write; their v1 versions are executable by no role. */
export const SHARED_SEMANTIC_CONTEXT_RPC = 'read_shared_semantic_context_v2' as const;
export const SHARED_SEMANTIC_PLACE_COMMIT_RPC = 'complete_shared_semantic_place_v2' as const;
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
  | { readonly state: 'REFUSED'; readonly reason: 'CONTEXT_NOT_READY' | 'HISTORY_UNRESOLVED' | 'SENDER_UNVERIFIED' | 'READING_UNAVAILABLE' | 'PLACEMENT_UNAVAILABLE'
    | 'DELIVERY_NOT_READY' | 'BINDING_REFUSED' | 'ATTRIBUTION_REFUSED' | 'COMMIT_STALE' | 'COMMIT_REFUSED' };

export interface SharedSemanticPassRequest {
  readonly worldId: string;
  /** The committed HUMAN_TEXT command this pass rides on (the pass identity). */
  readonly humanCommandId: string;
  /** S8A-04 CP1: that command's material, and the authenticated member who sent it (the reading is their AI-COST-01 work). */
  readonly humanMaterialId: string;
  readonly requesterUserId: string;
  /**
   * S8A-04 CP1: the visible Names of the sender's own Product read, per material. A Name only labels an author the resolver
   * already identified; it never decides who wrote anything.
   */
  readonly authorNames: ReadonlyArray<{ readonly materialId: string; readonly authorName: string | null }>;
  /**
   * S8A-04 CP2 §3.2.6: the saved positions the reply was given. Only ids; the pass gives the reading those of them it may
   * show (every current recipient sees them and they are still current), and nothing else.
   */
  readonly recalledPlaceIds?: ReadonlyArray<string>;
}

/** One saved position as the attributed context read returns it (0175 `read_shared_semantic_context_v2`). */
interface ContextPlace {
  readonly placeId: string; readonly meaning: string; readonly nature: 'VIEW' | 'CLAIM'; readonly absentHolder: string | null; readonly hedged: boolean;
  readonly standing: 'CURRENT' | 'SUPERSEDED'; readonly people: ReadonlyArray<{ role: 'HOLDER' | 'RELAYER' | 'ABOUT'; userId: string; name: string | null }>;
  readonly laterPlaceId: string | null; readonly sourceIds: ReadonlyArray<string>; readonly region: string;
  readonly x: bigint; readonly y: bigint; readonly order: number;
}

interface VisibleMaterial {
  readonly materialId: string; readonly kind: string; readonly text: string | null; readonly establishedAt: string;
  /** The author identity the frozen resolver holds for this material (null: QANDEEL). It never leaves this composition. */
  readonly author: string | null;
}

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
    if (![request.worldId, request.humanCommandId, request.humanMaterialId, request.requesterUserId].every((id) => typeof id === 'string' && UUID.test(id))
      || !Array.isArray(request.authorNames)) {
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
        const outcome = await this.composeUnderLease(request, worldId, leaseId);
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

  private async composeUnderLease(request: SharedSemanticPassRequest, worldId: SharedWorldId, leaseId: string): Promise<SharedSemanticPassOutcome> {
    const passCommandId = request.humanCommandId;
    // 1. The pre-model envelope. No private candidate is offered: Personal context never enters a Shared reading.
    const context = await this.effectiveContext.resolve(worldId, []);
    if (context.state !== 'READY' || context.effectiveContext.privateReasoningContexts.length !== 0) return refused('CONTEXT_NOT_READY');
    const envelope = context.effectiveContext;

    // 2. What EVERY current recipient may see, in canonical order; the eligible sources are its human text.
    const visible = await this.visibleToEveryRecipient(worldId, envelope.audienceSnapshot.humans.map((human) => human.humanId));
    if (visible === null) return refused('HISTORY_UNRESOLVED');
    // S8A-04 CP1: a person's text has its author and QANDEEL's material none; anything else is a history no reading can trust.
    if (visible.some((material) => (material.kind === 'HUMAN_TEXT' && material.author === null)
      || (material.kind.startsWith('QANDEEL_') && material.author !== null))) return refused('HISTORY_UNRESOLVED');
    // The reading is the sender's AI-COST-01 work only when the resolver itself names them the author of the message it rides on.
    const payer = request.requesterUserId.toLowerCase();
    const trigger = visible.find((material) => material.materialId === request.humanMaterialId.toLowerCase());
    if (trigger === undefined || trigger.kind !== 'HUMAN_TEXT' || trigger.author !== payer) return refused('SENDER_UNVERIFIED');
    const eligible = visible.filter((material) => material.kind === 'HUMAN_TEXT' && typeof material.text === 'string' && material.text.trim().length > 0)
      .slice(-SHARED_SEMANTIC_CONTRIBUTIONS_MAX);
    if (eligible.length === 0) return woven([]);
    const speakers = sharedSemanticSpeakers(eligible, visible, request.authorNames);
    const refOf = new Map(eligible.map((material, index) => [material.materialId, index + 1]));
    const saved = decodeContext(await this.server.rpc<unknown>(SHARED_SEMANTIC_CONTEXT_RPC, { p_lease_id: leaseId, p_world_id: worldId, p_viewer_user_id: payer }));
    if (saved === null) return refused('HISTORY_UNRESOLVED');
    // Only a saved position every current recipient may see — itself and every source — is shown to the reader or the placer:
    // anything else could carry what someone may not see into the new reading.
    const visibleIds = new Set(visible.map((material) => material.materialId));
    const shown = saved.filter((place) => visibleIds.has(place.placeId) && place.sourceIds.every((id) => visibleIds.has(id)));
    const windowPeople = new Set(eligible.map((material) => material.author as string));
    const existingPlaces = chooseExisting(shown, new Set((request.recalledPlaceIds ?? []).map((id) => String(id).toLowerCase())), refOf, windowPeople);
    // Every person a token stands for: the writers (S8A-04 CP1), then the members the existing meanings name.
    const userOf = new Map<string, string>();
    const tokenOf = new Map<string, string>();
    eligible.forEach((material, index) => { if (!tokenOf.has(material.author as string)) { tokenOf.set(material.author as string, speakers.tokens[index]); userOf.set(speakers.tokens[index], material.author as string); } });
    const taken = new Map([...tokenOf].map(([user, token]) => [user, speakers.writers.find((writer) => writer.speaker === token)?.name as string]));
    const named = existingPlaces.flatMap((place) => place.people.filter((person) => !tokenOf.has(person.userId)));
    const labelOf = extendSharedLabels(taken, named);
    const extra: { speaker: string; name: string }[] = [];
    for (const person of named) {
      if (tokenOf.has(person.userId)) continue;
      const token = `S${tokenOf.size + 1}`;
      tokenOf.set(person.userId, token);
      userOf.set(token, person.userId);
      extra.push({ speaker: token, name: labelOf.get(person.userId) as string });
    }
    const tokensOf = (place: ContextPlace, role: 'HOLDER' | 'RELAYER' | 'ABOUT') => place.people.filter((person) => person.role === role).map((person) => tokenOf.get(person.userId) as string);
    const existing: SharedSemanticExistingMeaning[] = existingPlaces.map((place, index) => Object.freeze({
      ref: `E${index + 1}`, meaning: place.meaning, nature: place.nature, holders: Object.freeze(tokensOf(place, 'HOLDER')), absentHolder: place.absentHolder,
      relayedBy: Object.freeze(tokensOf(place, 'RELAYER')), about: Object.freeze(tokensOf(place, 'ABOUT')), hedged: place.hedged,
      sourceRefs: Object.freeze(place.sourceIds.flatMap((id) => (refOf.has(id) ? [refOf.get(id) as number] : [])).sort((a, b) => a - b)),
    }));
    const input: SharedSemanticInput = Object.freeze({
      contract: SHARED_SEMANTIC_INTERPRETATION_CONTRACT,
      writers: Object.freeze([...speakers.writers, ...extra.map((writer) => Object.freeze(writer))]),
      contributions: Object.freeze(eligible.map((material, index) => Object.freeze({ ref: index + 1, from: speakers.tokens[index], text: material.text as string }))),
      existing: Object.freeze(existing),
    });

    // 3. The reading, charged to the verified sender and correlated with their message (AI-COST-01, CP2 §5).
    const scope: AiUsageAttribution = { userId: payer, sourceWorldId: worldId, sourceSharedMaterialId: request.humanMaterialId.toLowerCase() };
    const reading = decodeSharedSemanticReading(
      await withTimeout((signal) => runWithAiUsageAttribution(scope, () => this.interpreter.read(input, signal))), input);
    if (reading === null) return refused('READING_UNAVAILABLE');
    if (reading.places.length === 0) return woven([]);

    // 4. ONE placement call for the pass's new meanings; the server derives every point from the anchors (CP2 §4).
    const news = inMeaningOrder(reading.places.map((proposal, index) => ({ index, meaning: proposal.meaning, region: proposal.lensKey })))
      .map((entry, order) => ({ ...entry, ref: `N${order + 1}` }));
    const placementInput = placementRequest(shown, news, new Set((request.recalledPlaceIds ?? []).map((id) => String(id).toLowerCase())), windowPeople);
    const anchors = decodeSharedSpatialPlacement(
      await withTimeout((signal) => runWithAiUsageAttribution(scope, () => this.placer.place(placementInput.input, signal))), placementInput.input);
    if (anchors === null) return refused('PLACEMENT_UNAVAILABLE');
    const occupied: ExistingFieldPlace[] = saved.map((place) => ({
      ref: placementInput.refOf.get(place.placeId) ?? place.placeId, point: { x: place.x, y: place.y }, region: place.region, order: place.order,
    }));
    const points = placeNewMeanings(occupied, news, anchors);
    if (points === null) return refused('PLACEMENT_UNAVAILABLE');
    const pointOf = new Map(news.map((entry) => [entry.index, points.get(entry.ref)]));
    const readingLabels = sharedSemanticReadingLabels(input);
    const placeOfExisting = new Map(existingPlaces.map((place, index) => [`E${index + 1}`, place.placeId]));

    const placeIds: string[] = [];
    for (const [index, proposal] of reading.places.entries()) {
      const point = pointOf.get(index);
      if (point === undefined) return refused('PLACEMENT_UNAVAILABLE');
      const users = (tokens: ReadonlyArray<string>) => tokens.map((token) => userOf.get(token));
      const holders = users(proposal.attribution.holders);
      const relayers = users(proposal.attribution.relayedBy);
      const about = users(proposal.attribution.about);
      // Every token stands for the identity the server derived it from; one that does not refuses this place (§2.2.1).
      if ([...holders, ...relayers, ...about].some((user) => user === undefined)) return refused('ATTRIBUTION_REFUSED');

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
        p_semantic_region: proposal.lensKey, p_world_x: point.x.toString(), p_world_y: point.y.toString(),
        p_nature: proposal.attribution.nature, p_holder_user_ids: holders, p_absent_holder_label: proposal.attribution.absentHolder,
        p_relayer_user_ids: relayers, p_about_user_ids: about, p_hedged: proposal.attribution.hedged,
        p_revises_place_id: proposal.revises === null ? null : placeOfExisting.get(proposal.revises) ?? null, p_reading_labels: readingLabels,
      });
      const row = Array.isArray(rows) ? rows[0] : undefined;
      if (!isRecord(row)) return refused('COMMIT_REFUSED');
      if (row.outcome === 'STALE') return refused('COMMIT_STALE');
      if (row.outcome === 'ATTRIBUTION_REFUSED') return refused('ATTRIBUTION_REFUSED');
      if (row.outcome !== 'MATERIAL_COMMITTED' || typeof row.material_id !== 'string' || !UUID.test(row.material_id)) return refused('COMMIT_REFUSED');
      placeIds.push(row.material_id);
    }
    return woven(placeIds);
  }

  /**
   * The material every human of the audience may see, through the frozen resolver, oldest first, each with the author that
   * resolver holds for it. Null when any read fails, a row carries no valid author field, or two reads disagree about one
   * material's author.
   */
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
        const author = row.author_user_id;
        if (author !== null && (typeof author !== 'string' || !UUID.test(author))) return null;
        const id = row.material_id.toLowerCase();
        visible.set(id, {
          materialId: id, kind: row.material_kind, text: typeof row.text_body === 'string' ? row.text_body : null, establishedAt: row.established_at,
          author: author === null ? null : author.toLowerCase(),
        });
      }
      const previous: Map<string, VisibleMaterial> | null = intersection;
      if (previous !== null && [...previous].some(([id, material]) => visible.has(id) && visible.get(id)?.author !== material.author)) return null;
      intersection = previous === null ? visible : new Map([...previous.entries()].filter(([id]) => visible.has(id)));
    }
    return [...(intersection ?? new Map<string, VisibleMaterial>()).values()]
      .sort((l, r) => (l.establishedAt < r.establishedAt ? -1 : l.establishedAt > r.establishedAt ? 1 : l.materialId < r.materialId ? -1 : 1));
  }
}

/**
 * S8A-04 CP1 — who wrote each contribution, for this one reading. The speaker is the author the frozen resolver holds
 * (`S1`, `S2`, … by first appearance among the contributions), never a Name or the words. Each speaker's label is the
 * visible Name the sender's own read shows on their messages, or `A participant`, numbered by the S8A-02 reply's own
 * rule (`sharedConversationLabels`) when different people share it. Only tokens and labels leave; no identity does.
 */
export function sharedSemanticSpeakers(
  eligible: ReadonlyArray<VisibleMaterial>, visible: ReadonlyArray<VisibleMaterial>, authorNames: SharedSemanticPassRequest['authorNames'],
): { readonly tokens: ReadonlyArray<string>; readonly writers: ReadonlyArray<{ readonly speaker: string; readonly name: string }> } {
  const authorOf = new Map(visible.map((material) => [material.materialId, material.author]));
  const nameOf = new Map<string, string>();
  for (const entry of authorNames) {
    const author = typeof entry?.materialId === 'string' ? authorOf.get(entry.materialId.toLowerCase()) : undefined;
    if (typeof author === 'string' && typeof entry.authorName === 'string' && entry.authorName.trim().length > 0) nameOf.set(author, entry.authorName);
  }
  const tokenOf = new Map<string, string>();
  for (const material of eligible) if (!tokenOf.has(material.author as string)) tokenOf.set(material.author as string, `S${tokenOf.size + 1}`);
  const tokens = eligible.map((material) => tokenOf.get(material.author as string) as string);
  const labels = sharedConversationLabels(eligible.map((material, index) => ({
    producer: 'HUMAN' as const, authorName: nameOf.get(material.author as string) ?? null, text: material.text ?? '', speakerRef: tokens[index],
  })));
  const writers = new Map<string, string>();
  tokens.forEach((token, index) => { if (!writers.has(token)) writers.set(token, labels[index] as string); });
  return Object.freeze({
    tokens: Object.freeze(tokens),
    writers: Object.freeze([...writers].map(([speaker, name]) => Object.freeze({ speaker, name }))),
  });
}

const PERSON_ROLES = new Set(['HOLDER', 'RELAYER', 'ABOUT']);
const COORDINATE = /^-?(0|[1-9][0-9]{0,18})$/u;

/** The attributed context rows, in commit order, or null when any row is not exactly its shape. */
function decodeContext(rows: unknown): ContextPlace[] | null {
  if (!Array.isArray(rows)) return null;
  const places: ContextPlace[] = [];
  for (const [order, row] of rows.entries()) {
    if (!isRecord(row) || typeof row.material_id !== 'string' || !UUID.test(row.material_id) || typeof row.meaning !== 'string'
      || (row.nature !== 'VIEW' && row.nature !== 'CLAIM') || (row.standing !== 'CURRENT' && row.standing !== 'SUPERSEDED') || typeof row.hedged !== 'boolean'
      || (row.absent_holder_label !== null && typeof row.absent_holder_label !== 'string') || !Array.isArray(row.people) || !Array.isArray(row.source_material_ids)
      || (row.later_place_id !== null && (typeof row.later_place_id !== 'string' || !UUID.test(row.later_place_id)))
      || typeof row.semantic_region !== 'string' || typeof row.world_x !== 'string' || typeof row.world_y !== 'string'
      || !COORDINATE.test(row.world_x) || !COORDINATE.test(row.world_y)) return null;
    const people: ContextPlace['people'][number][] = [];
    for (const person of row.people) {
      if (!isRecord(person) || !PERSON_ROLES.has(person.role as string) || typeof person.user !== 'string' || !UUID.test(person.user)
        || (person.name !== null && typeof person.name !== 'string')) return null;
      people.push({ role: person.role as 'HOLDER' | 'RELAYER' | 'ABOUT', userId: person.user.toLowerCase(), name: typeof person.name === 'string' && person.name.trim() !== '' ? person.name : null });
    }
    if (!row.source_material_ids.every((id) => typeof id === 'string' && UUID.test(id))) return null;
    places.push({
      placeId: row.material_id.toLowerCase(), meaning: row.meaning, nature: row.nature, absentHolder: row.absent_holder_label as string | null, hedged: row.hedged,
      standing: row.standing, people, laterPlaceId: row.later_place_id === null ? null : (row.later_place_id as string).toLowerCase(),
      sourceIds: (row.source_material_ids as string[]).map((id) => id.toLowerCase()), region: row.semantic_region,
      x: BigInt(row.world_x), y: BigInt(row.world_y), order,
    });
  }
  return places;
}

const renderedBytes = (value: unknown) => Buffer.byteLength(escapeDeepSeekData(value), 'utf8');
const newestFirst = (places: ReadonlyArray<ContextPlace>) => [...places].sort((l, r) => r.order - l.order);

/**
 * S8A-04 CP2 §3.2.6 — the existing meanings a reading is shown: the CURRENT positions with no successor (the only ones a new
 * place may revise), taken first from those the reply was given, then those resting on the window, then those of the
 * window's people, each newest first, while they fit 200 entries and 24 KB; presented in commit order.
 */
function chooseExisting(shown: ReadonlyArray<ContextPlace>, recalled: ReadonlySet<string>, refOf: ReadonlyMap<string, number>, windowPeople: ReadonlySet<string>): ContextPlace[] {
  const open = shown.filter((place) => place.standing === 'CURRENT' && place.laterPlaceId === null);
  const tiers = [
    open.filter((place) => recalled.has(place.placeId)),
    open.filter((place) => place.sourceIds.some((id) => refOf.has(id))),
    open.filter((place) => place.people.some((person) => windowPeople.has(person.userId))),
  ];
  const chosen = new Map<string, ContextPlace>();
  let used = 2;
  for (const tier of tiers) {
    for (const place of newestFirst(tier)) {
      if (chosen.has(place.placeId) || chosen.size >= SHARED_SEMANTIC_EXISTING_MAX) continue;
      // Measured as the model receives it, generously: every token a two-digit one.
      const size = renderedBytes({ ref: 'E000', meaning: place.meaning, nature: place.nature, holders: place.people.map(() => 'S00'),
        ...(place.absentHolder === null ? {} : { absentHolder: place.absentHolder }), relayedBy: [], about: [], hedged: place.hedged,
        sourceRefs: place.sourceIds.map(() => 40) }) + 1;
      if (used + size > SHARED_SEMANTIC_EXISTING_BYTES) continue;
      used += size;
      chosen.set(place.placeId, place);
    }
  }
  return [...chosen.values()].sort((l, r) => l.order - r.order);
}

/**
 * S8A-04 CP2 §4.1 / §10 M4 — the placement request: the new meanings (N1…, Unicode order), a map of at most 60 places
 * (the recalled positions, then the places of the new meanings' regions, then those of the window's people, newest first;
 * presented by region, then commit) and at most 40 regions (the new meanings' first, then by size), within 16 KB.
 */
function placementRequest(
  shown: ReadonlyArray<ContextPlace>, news: ReadonlyArray<{ ref: string; meaning: string; region: string }>, recalled: ReadonlySet<string>, windowPeople: ReadonlySet<string>,
): { input: SharedSpatialPlacementInput; refOf: Map<string, string> } {
  const newRegions = new Set(news.map((entry) => entry.region));
  const byRegion = new Map<string, ContextPlace[]>();
  for (const place of shown) byRegion.set(place.region, [...(byRegion.get(place.region) ?? []), place]);
  let regions = [...byRegion].sort(([lk, lp], [rk, rp]) => Number(newRegions.has(rk)) - Number(newRegions.has(lk)) || rp.length - lp.length || compareCodePoints(lk, rk))
    .slice(0, SHARED_PLACEMENT_REGIONS_MAX)
    .map(([region, places]) => Object.freeze({ region, count: places.length, examples: Object.freeze(newestFirst(places).slice(0, 2).map((place) => place.meaning)) }));
  const priority = [
    ...newestFirst(shown.filter((place) => recalled.has(place.placeId))),
    ...newestFirst(shown.filter((place) => newRegions.has(place.region))),
    ...newestFirst(shown.filter((place) => place.people.some((person) => windowPeople.has(person.userId)))),
  ];
  let mapped = [...new Map(priority.map((place) => [place.placeId, place])).values()].slice(0, SHARED_PLACEMENT_MAP_MAX);
  const newData = news.map((entry) => Object.freeze({ ref: entry.ref, region: entry.region, meaning: entry.meaning }));
  const build = () => {
    const ordered = [...mapped].sort((l, r) => compareCodePoints(l.region, r.region) || l.order - r.order);
    const refOf = new Map(ordered.map((place, index) => [place.placeId, `P${index + 1}`]));
    const input: SharedSpatialPlacementInput = Object.freeze({
      contract: SHARED_SPATIAL_PLACEMENT_CONTRACT, regions: Object.freeze(regions),
      map: Object.freeze(ordered.map((place) => Object.freeze({ ref: refOf.get(place.placeId) as string, region: place.region, meaning: place.meaning }))),
      new: Object.freeze(newData),
    });
    return { input, refOf };
  };
  let built = build();
  const size = () => Buffer.byteLength(JSON.stringify({ regions: built.input.regions, map: built.input.map, new: built.input.new }), 'utf8');
  while (size() > SHARED_PLACEMENT_DATA_BYTES_MAX && (mapped.length > 0 || regions.length > 0)) {
    if (mapped.length > 0) mapped = mapped.slice(0, -1); else regions = regions.slice(0, -1);
    built = build();
  }
  return built;
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
