/**
 * T-10 — how something that is legitimately present in the CURRENT `V` arrives, in plain
 * arithmetic.
 *
 * The asymmetry is the whole point, and it is architectural rather than stylistic:
 *
 *   **departures are hard.** There is no exit recipe in this file, no exit component in this
 *   owner, and no presented-set anywhere in production. An object that is not in the current `V`
 *   is not rendered, so React unmounts it in the same commit that removed it. It cannot fade, fold
 *   back, ghost, trail or linger for a frame, because there is no code path that could make it;
 *
 *   **arrivals are earned.** An object that IS in the current `V` may resolve into legibility —
 *   but only because it BECAME part of `V`, never because it happened to appear on the glass.
 *
 * R1 corrected exactly that second half. Eligibility used to be "this node just mounted", and a
 * node mounts whenever culling lets it back in — so panning the camera over an already-disclosed
 * Home dressed ordinary navigation in the grammar of semantic disclosure. Eligibility is now a
 * MEMBERSHIP TRANSITION in the authoritative placement: present now, absent in the previous
 * commit's full `V`-derived node set. Viewport entry, culling entry, camera travel and remount all
 * fail that test, and correctly.
 *
 * An arrival never invents a relationship. It travels from a host only when that host is disclosed
 * RIGHT NOW, in the same placement, along the same tether the renderer is drawing — and when there
 * is no such host it resolves where it belongs, which is the truthful answer rather than a
 * fallback. And it never invents an order: every arrival of one truth starts at the same instant,
 * because the record says these things became known together and a stagger would say otherwise.
 */
import { DISCLOSURE_ENTRY_SCALE, MOTION_DURATIONS_MS } from '../tokens';

export interface DisclosureArrivalInput {
  /**
   * Whether this locus became part of the current `V` in THIS commit.
   *
   * Not "did it mount", not "is it on screen": those are questions about the viewport, and the
   * viewport decides nothing about meaning. The first painted frame is never an arrival either —
   * there is no previous `V` to have joined, so nothing animates into place from nowhere on mount.
   */
  readonly newlyDisclosed: boolean;
  /**
   * The host's offset from this object, in points, or `null` when no host is disclosed here.
   *
   * Supplied by the renderer from the SAME placement it paints the tether from, so a from-host
   * arrival and the line explaining it can never disagree.
   */
  readonly hostOffset: { readonly x: number; readonly y: number } | null;
  readonly reducedMotion: boolean;
}

export interface DisclosureArrivalPlan {
  /** Whether anything animates at all. */
  readonly animated: boolean;
  /** Where the local resolve starts. Never zero, and never near it. */
  readonly fromScale: number;
  /** The host-relative starting offset. Zero unless a currently disclosed host justifies one. */
  readonly fromX: number;
  readonly fromY: number;
  readonly durationMs: number;
}

/** How an arrival is presented at a given progress: the exact numbers paint and pointer share. */
export interface ArrivalPresentation {
  readonly dx: number;
  readonly dy: number;
  readonly scale: number;
}

const PLACED: DisclosureArrivalPlan = Object.freeze({ animated: false, fromScale: 1, fromX: 0, fromY: 0, durationMs: 0 });

export const ARRIVAL_AT_REST: ArrivalPresentation = Object.freeze({ dx: 0, dy: 0, scale: 1 });

export function disclosureArrivalPlan(input: DisclosureArrivalInput): DisclosureArrivalPlan {
  if (!input.newlyDisclosed) return PLACED;
  if (input.reducedMotion) {
    // Fewer and gentler, not none. Movement goes; the opacity bridge stays, because an object
    // blinking into a dense analytical surface is a harsher transition than one resolving into it.
    return Object.freeze({ animated: true, fromScale: 1, fromX: 0, fromY: 0, durationMs: MOTION_DURATIONS_MS.reducedResolve });
  }
  const host = input.hostOffset;
  const travels = host !== null && Number.isFinite(host.x) && Number.isFinite(host.y) && (host.x !== 0 || host.y !== 0);
  // EVERY standard-motion arrival carries the entry scale, travelling or not.
  //
  // An earlier pass reserved the scale for the travelling case, on the argument that an object
  // which merely became legible did not "grow". `/review-animations` refused it, and correctly: a
  // pure opacity fade with no initial transform is a comes-from-nowhere, and the eye reads it as an
  // object materialising rather than resolving. The two kinds of arrival are already legibly
  // different — one travels along a real tether and one does not — and that difference is carried
  // by the travel itself, which is the part the record actually justifies.
  return Object.freeze({
    animated: true,
    fromScale: DISCLOSURE_ENTRY_SCALE,
    fromX: travels ? host.x : 0,
    fromY: travels ? host.y : 0,
    durationMs: travels ? MOTION_DURATIONS_MS.disclosure : MOTION_DURATIONS_MS.localResolve,
  });
}

/**
 * Where an arriving object is, and how big it is, at a given progress.
 *
 * ONE function, read by the renderer to draw and by the pointer route to hit-test, from the SAME
 * progress value. That is what makes "painted position equals pointer target" an identity rather
 * than an approximation: there is no second copy of this arithmetic to drift from.
 */
export function arrivalPresentation(plan: DisclosureArrivalPlan, progress: number): ArrivalPresentation {
  'worklet';
  if (!plan.animated) return ARRIVAL_AT_REST;
  const done = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 1;
  const remaining = 1 - done;
  return {
    dx: plan.fromX * remaining,
    dy: plan.fromY * remaining,
    scale: plan.fromScale + (1 - plan.fromScale) * done,
  };
}

/**
 * Which loci became part of `V` in this commit.
 *
 * `previous` is the FULL placement key set of the last commit — every locus the projection
 * disclosed, culled or not — so a node that was merely off the glass is not new when it returns.
 * `null` is the first painted frame: nothing is an arrival, because there is no earlier `V` for
 * anything to have joined.
 */
export function newlyDisclosedKeys(previous: ReadonlySet<string> | null, currentKeys: readonly string[]): ReadonlySet<string> {
  if (previous === null) return EMPTY_KEYS;
  const fresh = new Set<string>();
  for (const key of currentKeys) if (!previous.has(key)) fresh.add(key);
  return fresh;
}

const EMPTY_KEYS: ReadonlySet<string> = Object.freeze(new Set<string>());
