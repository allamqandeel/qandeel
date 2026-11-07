/**
 * S7-03 — the governed projection adapter: ONE Replay moment's historical truth, handed to the existing Living Analysis
 * Map as the disclosure `V` that Map already knows how to draw.
 *
 *   Replay historical truth (S7-01: version · moments · moment analysis)  →  THIS adapter  →  T-04 `MapSurface`
 *
 * Product Owner decision (S7-03): «Replay يملك الحقيقة التاريخية وترتيب اللحظات، لكن الجرافيك ملك نظام Living Analysis
 * الحالي». So this adapter decides nothing about graphics — no position, colour, size, emphasis or motion — and the
 * Replay engine knows nothing about graphics: what crosses here is the frozen T-03C shape the Map already consumes, so a
 * later Living Analysis change needs no change to Replay, to its history, or to this file.
 *
 * What it does, and the refusals that make it governed rather than a convenience:
 *
 *   - the version's render truth contract is honoured or the version is not rendered at all (an unknown schema, policy
 *     word or medium class is refused — it is never "rendered close enough");
 *   - a moment whose medium is not original text is refused under ORIGINAL_TEXT_ONLY (Stage 7 is text only; nothing is
 *     synthesised); under ORIGINAL_MEDIA_PRESERVED (S8B-07, V2) a moment is original text or original audio, and a MIXED
 *     one is refused (0195 never selects it);
 *   - an analysis is used only for its own moment (the same ordinal AND the same TC) and only while that moment's exact
 *     text is viewable: no analysis without its moment;
 *   - every Session Position in it is re-checked to be at or before the moment's TC (the client already refused any that
 *     is not; this is the adapter's own guard, so no later knowledge can reach an earlier moment through it);
 *   - the families are carried AS DISCLOSED: nothing is added, merged, inferred or filled in. A family the Replay wire
 *     withholds by design is carried EMPTY, never fabricated (below).
 *
 * The narrower wire, and the smallest bridge (record §5, gap G-1):
 *
 *   `HistoricalDisclosure` carries a K(TC) header the Replay wire deliberately withholds (S7-01: no Session, no Live
 *   Head, no revision), plus three families the Replay wire narrows (the Session's Moments, the Turns a Question was asked
 *   in, a Material's wall-clock expiry). The bridge sets:
 *
 *     sessionId            the Replay viewpoint key `replay:<replayId>:<versionId>` — never the conversation's Session;
 *     liveHead             the version's own horizon, `lastTc` — the Replay knows nothing later;
 *     sealed               true — S7-01 refuses a version over an unsealed moment (MOMENT_NOT_SEALED);
 *     revision             Replay-local (`liveHead` = horizon, `worldVersion` = the version revision, no pending expiry);
 *     session.moments      [] — the version's moments are the source layer, read apart and shown as text;
 *     questionAppearances  [] — their Turn ids are withheld;
 *     materials            [] — their expiry is withheld (hindsight at TC);
 *     inspection           null.
 *
 *   T-04 reads none of the emptied families to draw (it reads Threads, Thread–Reading appearances, Emerging Focuses and
 *   Readings), and no T-04 consumer reads `scene.liveHead` or `scene.sealed` (pinned by the S7-03 contract). They are
 *   read only by inspection, which the Replay viewpoint store does not authorise: no Map act can land, so no reader can
 *   be shown an emptied family as if it were the history.
 */
import type { HistoricalDisclosure, HistoricalSemanticDepth } from '@qandeel/runtime';

import type { HistoricalDisclosureEntry } from '../projection';
import type { ReplayHistoryMoment, ReplayHistoryVersion, ReplayMomentAnalysis } from '../runtime-entry';

/** The text render truth contract (S7-01 §11, I-06B). With V2 below, the only two this composite honours; anything else is refused whole. */
export const REPLAY_RENDER_CONTRACT_V1 = Object.freeze({
  schema: 'QANDEEL_REPLAY_RENDER_CONTRACT_V1',
  sourceMediumClass: 'ORIGINAL_TEXT_ONLY',
  policies: Object.freeze({
    originalMedium: 'PRESERVE_ORIGINAL_MEDIUM_ONLY',
    sourceText: 'EXACT_SOURCE_TEXT',
    semanticCut: 'WHOLE_ITEM_ONLY_PROVEN_SAFE',
    temporalDiscontinuity: 'PERCEPTIBLE_DISCONTINUITY_REQUIRED',
    timingIntegrity: 'PRESENTATION_PACING_DECLARED',
    analyticalProjection: 'BOUND_HISTORICAL_PROJECTION_DIGEST',
    cameraEmphasis: 'EMPHASIS_WITHOUT_MEANING_CREATION',
    motion: 'EXPLANATORY_MOTION_ONLY',
    captionProvenance: 'DERIVED_CAPTION_DISTINCT_FROM_SOURCE',
    accessibilityParity: 'EQUIVALENT_TRUTH_REQUIRED',
    reducedMotionParity: 'EQUIVALENT_TRUTH_REQUIRED',
    editorialAnnotation: 'NO_EDITORIAL_ANNOTATION',
  }),
});

/**
 * S8B-07 CP1-B: the original-media contract, the mirror of the API's tuple value for value (0195, D-04; `replay.service.ts`
 * RENDER_CONTRACTS): the V1 policies except the source text (an audio moment's text is a DERIVED transcript) and the timing
 * (the original source clock, with the declared reading pace for text).
 */
export const REPLAY_RENDER_CONTRACT_V2 = Object.freeze({
  schema: 'QANDEEL_REPLAY_RENDER_CONTRACT_V2',
  sourceMediumClass: 'ORIGINAL_MEDIA_PRESERVED',
  policies: Object.freeze({
    ...REPLAY_RENDER_CONTRACT_V1.policies,
    sourceText: 'EXACT_SOURCE_TEXT_AUDIO_TRANSCRIPT_DERIVED',
    timingIntegrity: 'ORIGINAL_SOURCE_CLOCK_WITH_DECLARED_TEXT_PACING',
  }),
});

const CONTRACTS = Object.freeze({ V1: REPLAY_RENDER_CONTRACT_V1, V2: REPLAY_RENDER_CONTRACT_V2 });

const DEPTHS: readonly HistoricalSemanticDepth[] = ['WORLD', 'THREAD', 'SESSION', 'ANALYTICAL_OBJECT', 'SOURCE_PROVENANCE'];

/** Which of the two approved contracts the version carries, exactly, or null (refused whole). */
export function renderContractOf(version: ReplayHistoryVersion): 'V1' | 'V2' | null {
  const contract = version.renderContract;
  for (const name of ['V1', 'V2'] as const) {
    const approved = CONTRACTS[name];
    if (contract.schema !== approved.schema || contract.sourceMediumClass !== approved.sourceMediumClass) continue;
    const keys = Object.keys(approved.policies) as (keyof typeof approved.policies)[];
    return keys.every((key) => contract.policies[key] === approved.policies[key]) ? name : null;
  }
  return null;
}

/** Whether this composite can render the version under the version's own contract. */
export function honoursRenderContract(version: ReplayHistoryVersion): boolean {
  return renderContractOf(version) !== null;
}

/** Under ORIGINAL_TEXT_ONLY a moment is renderable only in its original text; under V2, in its original text or audio. */
export function isRenderableMedium(moment: ReplayHistoryMoment, version?: ReplayHistoryVersion): boolean {
  if (moment.originalMedium === 'ORIGINAL_TEXT') return true;
  return version !== undefined && renderContractOf(version) === 'V2' && moment.originalMedium === 'ORIGINAL_AUDIO';
}

/** The Replay viewpoint's own key: a Replay version is not the conversation's Session, and never borrows its id. */
export function replayViewpointKey(version: Pick<ReplayHistoryVersion, 'replayId' | 'versionId'>): string {
  return `replay:${version.replayId}:${version.versionId}`;
}

export type ReplayDisclosureRefusal =
  | 'RENDER_CONTRACT_NOT_HONOURED'
  | 'MEDIUM_NOT_RENDERABLE'
  | 'NOT_VIEWABLE'
  | 'NO_MOMENT_TEXT'
  | 'NOT_THIS_MOMENT'
  | 'BEYOND_THE_MOMENT'
  | 'OUTSIDE_THE_VERSION';

export type ReplayMomentDisclosure =
  | { readonly status: 'DISCLOSED'; readonly entry: Extract<HistoricalDisclosureEntry, { status: 'FETCHED' }> }
  | { readonly status: 'REFUSED'; readonly reason: ReplayDisclosureRefusal };

type AvailableAnalysis = Extract<ReplayMomentAnalysis, { outcome: 'AVAILABLE' }>;

const refused = (reason: ReplayDisclosureRefusal): ReplayMomentDisclosure => ({ status: 'REFUSED', reason });

/** Every Session Position the Map could be shown, at or before `tc` — the adapter's own no-hindsight guard. */
function positionsAtOrBefore(analysis: AvailableAnalysis, tc: number): boolean {
  const positions: (number | null)[] = [analysis.world.liveFocus.atSp, ...analysis.world.threads.map((thread) => thread.establishedSp)];
  if (analysis.thread.status === 'DISCLOSED') positions.push(...analysis.thread.value.threadReadingAppearances.map((appearance) => appearance.boundSp));
  if (analysis.session.status === 'DISCLOSED') {
    for (const focus of analysis.session.value.emergingFocuses) positions.push(focus.startedSp, focus.lastAttentionSp);
    positions.push(...analysis.session.value.questionAppearances.map((appearance) => appearance.appearedAtSp));
  }
  if (analysis.analyticalObject.status === 'DISCLOSED') {
    for (const reading of analysis.analyticalObject.value.readings) positions.push(...reading.subjectGroundings.map((grounding) => grounding.groundedAtSp));
  }
  return positions.every((position) => position === null || position <= tc);
}

/**
 * ONE moment's analysis as the disclosure the Living Analysis Map draws — or the typed reason it may not be drawn. The
 * depth law is the client's (every rung above the requested depth is DEPTH_WITHHELD) and is carried unchanged.
 */
export function discloseReplayMoment(version: ReplayHistoryVersion, moment: ReplayHistoryMoment, analysis: AvailableAnalysis): ReplayMomentDisclosure {
  if (!honoursRenderContract(version)) return refused('RENDER_CONTRACT_NOT_HONOURED');
  if (!isRenderableMedium(moment, version)) return refused('MEDIUM_NOT_RENDERABLE');
  if (version.viewing.state !== 'VIEWABLE') return refused('NOT_VIEWABLE');
  if (moment.text === null) return refused('NO_MOMENT_TEXT');
  if (analysis.ordinal !== moment.ordinal || analysis.tc !== moment.tc) return refused('NOT_THIS_MOMENT');
  if (moment.tc < version.firstTc || moment.tc > version.lastTc) return refused('OUTSIDE_THE_VERSION');
  if (!positionsAtOrBefore(analysis, moment.tc)) return refused('BEYOND_THE_MOMENT');
  if (!DEPTHS.includes(analysis.depth)) return refused('NOT_THIS_MOMENT');

  const disclosure: HistoricalDisclosure = Object.freeze({
    sessionId: replayViewpointKey(version),
    liveHead: version.lastTc,
    tc: moment.tc,
    sealed: true,
    depth: analysis.depth,
    revision: Object.freeze({ liveHead: version.lastTc, worldVersion: version.revision, pendingExpiries: 0 }),
    world: analysis.world,
    thread: analysis.thread,
    session: analysis.session.status === 'DISCLOSED'
      ? Object.freeze({ status: 'DISCLOSED', value: Object.freeze({ moments: [], emergingFocuses: analysis.session.value.emergingFocuses, questionAppearances: [] }) })
      : analysis.session,
    analyticalObject: analysis.analyticalObject.status === 'DISCLOSED'
      ? Object.freeze({ status: 'DISCLOSED', value: Object.freeze({ ...analysis.analyticalObject.value, materials: [] }) })
      : analysis.analyticalObject,
    sourceProvenance: analysis.sourceProvenance,
    inspection: null,
  });
  return { status: 'DISCLOSED', entry: Object.freeze({ status: 'FETCHED', value: disclosure, sealed: true }) };
}
