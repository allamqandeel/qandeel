// I-01A - membership vs historical access, provenance, content availability,
// and the Replay artifact boundary.
//
// Three separations are load-bearing here and are kept apart by TYPE, not by
// comment:
//
//   1. MEMBERSHIP_EPISODE  !=  HISTORY_ACCESS_GRANT          (CW2-01 §11-§13, A9, A10)
//      Current membership does not imply entitlement to all historical World
//      material. A newly joining member defaults to FROM_JOIN_FORWARD; past
//      access is a separate explicit object.
//
//   2. REASONING_DEPENDENCY  !=  MATERIAL_DEPENDENCY          (I-00 §12)
//      Authorized source context influencing QANDEEL reasoning did not copy or
//      disclose the source material, and is never material consent.
//
//   3. content availability  !=  provenance identity          (I-00 §13, CW2-01 §25)
//      Provenance may keep identifying that a dependency existed after the
//      source content is deleted or unavailable; that identity never makes the
//      content reconstructable.
//
// No persistence, no deletion workflow, no grant-authorization rule, no
// history-access composition rule and no Replay rendering/export is
// implemented here. Those belong to CW2-03 / CW2-05 and I-03 onwards.

import type { HumanPrincipal } from './principal.types';
import type { SharedWorldId, WorldRef } from './world.types';

// ---------------------------------------------------------------------------
// Membership episodes and historical access grants.
// ---------------------------------------------------------------------------

/**
 * One episode of a human's membership in a Shared World. A member who leaves
 * and later rejoins has TWO episodes, never one episode with a gap. Timestamps
 * are ISO-8601 strings supplied by the caller; the kernel generates none.
 */
export interface MembershipEpisode {
  readonly architectureClass: 'USER_STATE';
  readonly kind: 'MEMBERSHIP_EPISODE';
  readonly worldId: SharedWorldId;
  readonly member: HumanPrincipal;
  readonly joinedAt: string;
  /** `null` while the episode is current. */
  readonly endedAt: string | null;
}

/** The frozen default a new member receives on joining (CW2-01 §12, CW2-02 §28). */
export const HISTORY_ACCESS_DEFAULT_ON_JOIN = 'FROM_JOIN_FORWARD' as const;

/** What a membership episode gives BY ITSELF: material from its own join forward, nothing earlier. */
export interface HistoryAccessDefault {
  readonly scope: typeof HISTORY_ACCESS_DEFAULT_ON_JOIN;
  readonly fromInclusive: string;
}

/**
 * An independent grant of access to historical World material. It is a
 * separate object from any membership episode. Its bounded historical scope
 * and authority basis are deliberately not modelled yet (CW2-01 §12: "Exact
 * schema belongs later").
 */
export interface HistoryAccessGrant {
  readonly architectureClass: 'USER_STATE';
  readonly kind: 'HISTORY_ACCESS_GRANT';
  readonly grantId: string;
  readonly worldId: SharedWorldId;
  readonly grantee: HumanPrincipal;
}

export const MEMBERSHIP_EPISODE_REJECTIONS = [
  'NON_HUMAN_MEMBER',
  'UNPARSEABLE_TIMESTAMP',
  'ENDED_BEFORE_JOINED',
  'MULTIPLE_OPEN_EPISODES',
  'OVERLAPPING_EPISODES',
] as const;
export type MembershipEpisodeRejection = (typeof MEMBERSHIP_EPISODE_REJECTIONS)[number];

export type MembershipEpisodeValidation =
  | { readonly valid: true }
  | { readonly valid: false; readonly rejection: MembershipEpisodeRejection };

// ---------------------------------------------------------------------------
// Dependency / provenance semantics.
// ---------------------------------------------------------------------------

export const DEPENDENCY_KINDS = [
  'MATERIAL_DEPENDENCY',
  'REASONING_DEPENDENCY',
  'INDEPENDENT_TARGET_TRUTH',
] as const;
export type DependencyKind = (typeof DEPENDENCY_KINDS)[number];

/** A reference to one piece of source material and the World it originates in. */
export interface SourceMaterialRef {
  readonly materialId: string;
  readonly originWorld: WorldRef;
}

/** A reference to a context whose authorized content influenced reasoning. */
export interface SourceContextRef {
  readonly contextId: string;
  readonly originWorld: WorldRef;
}

/** The context in which target material or truth was established. */
export interface TargetContextRef {
  readonly contextId: string;
  readonly world: WorldRef;
}

/** Target material reproduces, represents or contains source material. Source-material rights may need to propagate. */
export interface MaterialDependency {
  readonly kind: 'MATERIAL_DEPENDENCY';
  readonly source: SourceMaterialRef;
  readonly target: TargetContextRef;
}

/** Authorized source context influenced QANDEEL reasoning. The source material was NOT thereby copied or disclosed. */
export interface ReasoningDependency {
  readonly kind: 'REASONING_DEPENDENCY';
  readonly source: SourceContextRef;
  readonly target: TargetContextRef;
}

/** The target context independently established its own authorized truth / material. There is no source. */
export interface IndependentTargetTruth {
  readonly kind: 'INDEPENDENT_TARGET_TRUTH';
  readonly target: TargetContextRef;
}

export type ProvenanceRecord = MaterialDependency | ReasoningDependency | IndependentTargetTruth;

// ---------------------------------------------------------------------------
// Content availability, independent of provenance identity.
// ---------------------------------------------------------------------------

/**
 * Task vocabulary for CW2-01 §25's MATERIAL_AVAILABLE / MATERIAL_OWNER_DELETED /
 * SOURCE_UNAVAILABLE. The names differ; the meaning does not.
 */
export const CONTENT_AVAILABILITIES = ['AVAILABLE', 'DELETED_BY_OWNER', 'UNAVAILABLE'] as const;
export type ContentAvailability = (typeof CONTENT_AVAILABILITIES)[number];

/**
 * What a reader of a provenance record may see of its source. The dependency's
 * existence stays identified whatever the availability; the content is only
 * ever `PRESENT` when the source is `AVAILABLE`.
 */
export interface SourceMaterialView {
  readonly dependencyIdentified: true;
  readonly content: 'PRESENT' | 'WITHHELD';
  readonly availability: ContentAvailability;
}

// ---------------------------------------------------------------------------
// Replay - a source-bound derived artifact. REPLAY != WORLD (CW2-01 §31-§32).
// ---------------------------------------------------------------------------

/**
 * A Replay artifact. It is bound to the World(s) it was derived from and to
 * the human whose creation authority produced it. It carries NO distribution
 * field: creation authority and distribution / audience-expansion authority
 * are separate architecture concepts (CW2-01 A22, CW2-02 B25), and a created
 * Replay does not thereby become distributable.
 */
export interface ReplayArtifact {
  readonly architectureClass: 'MATERIAL_ARTIFACT';
  readonly kind: 'REPLAY_ARTIFACT';
  readonly replayId: string;
  readonly sourceWorlds: ReadonlyArray<WorldRef>;
  readonly createdBy: HumanPrincipal;
}
