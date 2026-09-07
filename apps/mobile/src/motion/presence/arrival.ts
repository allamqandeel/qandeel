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
 *   **arrivals are earned.** An object that IS in the current `V` is already legitimate, so it may
 *   resolve into legibility rather than appear at full weight in one frame.
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
   * Whether the surface has already painted.
   *
   * The first frame is not an arrival. Nothing animates into place from nowhere on mount, or on
   * the first mirrored scene: the objects are simply where they belong, exactly as T-06's markers
   * are placed rather than animated to on their first Moment.
   */
  readonly established: boolean;
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

const PLACED: DisclosureArrivalPlan = Object.freeze({ animated: false, fromScale: 1, fromX: 0, fromY: 0, durationMs: 0 });

export function disclosureArrivalPlan(input: DisclosureArrivalInput): DisclosureArrivalPlan {
  if (!input.established) return PLACED;
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
