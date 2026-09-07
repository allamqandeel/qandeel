/**
 * T-10.0 MOTION LAB — which nodes are on the plane, and how each one got there, in plain data.
 *
 * The presented set is always a function of the entitled scene the Map derived from `V` (or from
 * `K(PTC)` while a preview is open) — never of the animation. A node that stops being entitled
 * leaves; a node that becomes entitled enters; a node present in both keeps its identity, and its
 * canonical position, across the change. The ONLY thing decided here is whether a leaving node is
 * removed on the next frame or may play a short exit, and that depends on WHY it left:
 *
 *   TEMPORAL  the effective `TC` (or the Session) changed: the old disclosure is not this Map any
 *             more, so its objects are removed immediately — nothing of the future or of another
 *             position is ever ghosted (T-10.0 §3);
 *   DEPTH     the semantic depth changed: the identities are still known at `TC`, only the depth
 *             withheld their render, so the direction may fold them back briefly;
 *   CAMERA    only the camera moved: nothing enters or leaves for that reason (culling is paint).
 */
import type { PlacedNode } from '../../map';

import type { MotionProfile, PresenceRecipe } from './profiles';

export type PresenceChange = 'INITIAL' | 'TEMPORAL' | 'DEPTH' | 'CAMERA' | 'LIVE_ADVANCE';

export type PresencePhase = 'PRESENT' | 'ENTERING' | 'EXITING';

export interface PresentedNode {
  readonly key: string;
  readonly node: PlacedNode;
  readonly phase: PresencePhase;
  /** The recipe this node entered or is leaving under. */
  readonly recipe: PresenceRecipe;
  /** Ordinal among the nodes entering together, for a stagger. */
  readonly enterOrdinal: number;
  /** Where this node unfolds from: its host Home for a contextual appearance, its own place otherwise. */
  readonly host: { readonly x: number; readonly y: number };
  /** Whether this arrival legitimately became known through a live advance — the only Ignition candidate. */
  readonly ignite: boolean;
  /** Monotonic token: a new value means "start the enter choreography again" (a node re-entered). */
  readonly entryToken: number;
}

/** Where a node unfolds from: the placed host Home of a contextual appearance, its own place otherwise. */
export function hostOf(node: PlacedNode, nodes: readonly PlacedNode[]): { readonly x: number; readonly y: number } {
  if (node.region !== 'WORLD_PLANE' || node.locus === null || node.locus.kind !== 'CONTEXTUAL_APPEARANCE') return { x: node.x, y: node.y };
  const threadId = node.locus.threadId;
  const host = nodes.find((candidate) => candidate.region === 'WORLD_PLANE' && candidate.locus?.kind === 'THREAD_HOME' && candidate.locus.threadId === threadId);
  return host === undefined ? { x: node.x, y: node.y } : { x: host.x, y: host.y };
}

function recipeFor(profile: MotionProfile, change: PresenceChange): PresenceRecipe {
  return change === 'TEMPORAL' || change === 'LIVE_ADVANCE' ? profile.temporal : profile.disclosure;
}

/**
 * The next presented set from the previous one and the scene's placed nodes. Exiting nodes are
 * retained only when the recipe allows an exit AND the change is not temporal; a caller removes an
 * exiting node when its exit finishes (`removeExited`).
 */
export function presentNodes(
  previous: readonly PresentedNode[],
  nodes: readonly PlacedNode[],
  change: PresenceChange,
  profile: MotionProfile,
  token: number,
): readonly PresentedNode[] {
  const recipe = recipeFor(profile, change);
  const byKey = new Map(previous.map((entry) => [entry.key, entry] as const));
  const next: PresentedNode[] = [];
  const seen = new Set<string>();
  let entering = 0;

  for (const node of nodes) {
    seen.add(node.key);
    const before = byKey.get(node.key);
    if (before !== undefined && before.phase !== 'EXITING') {
      // Present already: keep its identity and its choreography; only the canonical position moves.
      next.push({ ...before, node, host: hostOf(node, nodes) });
      continue;
    }
    const ignite = change === 'LIVE_ADVANCE';
    next.push({
      key: node.key,
      node,
      phase: change === 'INITIAL' ? 'PRESENT' : 'ENTERING',
      recipe,
      enterOrdinal: entering,
      host: hostOf(node, nodes),
      ignite,
      entryToken: token,
    });
    entering += 1;
  }

  const allowExit = change === 'DEPTH' && recipe.exit !== 'instant';
  for (const before of previous) {
    if (seen.has(before.key)) continue;
    if (before.phase === 'EXITING' && allowExit) {
      next.push(before);
      continue;
    }
    if (!allowExit) continue;
    next.push({ ...before, phase: 'EXITING', recipe });
  }
  return next;
}

export function removeExited(presented: readonly PresentedNode[], key: string): readonly PresentedNode[] {
  const index = presented.findIndex((entry) => entry.key === key && entry.phase === 'EXITING');
  return index < 0 ? presented : [...presented.slice(0, index), ...presented.slice(index + 1)];
}

/** Classifies what changed between two canonical viewpoints for the presented set. */
export function classifyChange(
  before: { readonly sessionId: string; readonly tc: number | null; readonly depth: string; readonly liveHead: number | null } | null,
  after: { readonly sessionId: string; readonly tc: number | null; readonly depth: string; readonly liveHead: number | null },
  liveAdvanced: boolean,
): PresenceChange {
  if (before === null) return 'INITIAL';
  if (before.sessionId !== after.sessionId || before.tc !== after.tc) return liveAdvanced ? 'LIVE_ADVANCE' : 'TEMPORAL';
  if (before.depth !== after.depth) return 'DEPTH';
  return 'CAMERA';
}
