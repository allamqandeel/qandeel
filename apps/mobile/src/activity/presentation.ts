/**
 * A3-01 — the device half of the Product attention decision (P3 §7–§9, §15; I-08N-01 D51).
 *
 * The server decides what is ELIGIBLE to interrupt by everything it owns (preferences, mutes, Quiet Hours and Snooze in
 * the device's zone, staleness, the absent Proactive Gate). This decides, from what only the device knows, what is
 * PRESENTED now — and nothing else:
 *
 *   - the app is in the foreground;
 *   - which Product surface is in front: the Analysis, or a non-Analysis surface (the Personal Conversation, Activity,
 *     General Settings, QANDEEL Understanding). It is the composition's own `depth` / overlay state — the real
 *     navigation truth — never a parallel navigation state and never P3-A's proof-context `view` field;
 *   - whether that surface IS the event's originating context (then the event is there in place: no strip, D51);
 *   - whether a Live Call is known to be active (`call-truth.ts`; production knows none);
 *   - at most ONE transient presentation per evaluation, and never a second while one shows.
 *
 * Inside the Analysis ordinary attention WAITS (P3 §8): no strip, no transient region, no announcement — the items
 * stay in Activity with their mark. Leaving the Analysis re-reads current truth and evaluates again, and at most one
 * strip may follow; every other then-eligible candidate is SETTLED (stays in Activity, never strips later): no dump.
 */
import type { InterruptionCandidate } from '../runtime-entry';
import type { CallTruth } from './call-truth';

/** The Product surface in front of the reader — the composition's own state. S4-01 adds the Shared area and S5-01 the Public area, non-Analysis surfaces. */
export type ProductSurface = 'CONVERSATION' | 'ANALYSIS' | 'ACTIVITY' | 'SETTINGS' | 'UNDERSTANDING' | 'SHARED_WORLD' | 'PUBLIC_WORLD';

export interface PresentationContext {
  readonly foreground: boolean;
  readonly surface: ProductSurface;
  readonly call: CallTruth;
  /** A strip (ordinary or call-safe) is showing now. */
  readonly showing: boolean;
}

export type PresentationDecision =
  /** Nothing is presented and nothing is settled: the candidates wait for the next evaluation (Analysis, a call, background). */
  | { readonly kind: 'WAIT' }
  /** Nothing to present; these are settled (in place, or already represented where the reader is). */
  | { readonly kind: 'SETTLE'; readonly settled: readonly InterruptionCandidate[] }
  /** One strip; the rest settled. `form` is the ordinary strip, or — only during a known Live Call — the call-safe one. */
  | { readonly kind: 'PRESENT'; readonly form: 'ORDINARY' | 'CALL_SAFE'; readonly presented: InterruptionCandidate; readonly settled: readonly InterruptionCandidate[] };

/** The originating context IS the surface in front: the event lands there in place (P3 §15). */
export function isInPlace(candidate: InterruptionCandidate, surface: ProductSurface): boolean {
  // Activity represents every item in place. The Personal Conversation is the Personal context's own surface.
  return surface === 'ACTIVITY' || (surface === 'CONVERSATION' && candidate.contextKind === 'PERSONAL');
}

/**
 * Implementation choice, not Product law (P3 §8 leaves the tie-break to I-08N-01 D11, whose ranking is not frozen): the
 * lowest Interruption Class first, then the freshest occurrence — the same order the server's own `chooseOne` uses.
 */
export function rank(candidates: readonly InterruptionCandidate[]): InterruptionCandidate[] {
  return [...candidates].sort((a, b) => a.interruptionClass - b.interruptionClass || Date.parse(b.item.at) - Date.parse(a.item.at) || a.item.id.localeCompare(b.item.id));
}

export function decidePresentation(candidates: readonly InterruptionCandidate[], context: PresentationContext): PresentationDecision {
  if (!context.foreground || candidates.length === 0 || context.showing) return { kind: 'WAIT' };
  if (context.call.kind === 'ACTIVE') {
    // P3 §9: during a Live Call ordinary attention waits; only the two call-safe exceptions may be presented, as the
    // dismiss-only call-safe strip, on either surface. Nothing is settled: the rest is re-evaluated when the call ends.
    const safe = rank(candidates.filter((candidate) => candidate.callSafe));
    return safe.length === 0 ? { kind: 'WAIT' } : { kind: 'PRESENT', form: 'CALL_SAFE', presented: safe[0], settled: [] };
  }
  // P3 §8: inside the Analysis ordinary attention — critical security outside a call included — waits.
  if (context.surface === 'ANALYSIS') return { kind: 'WAIT' };
  const inPlace = candidates.filter((candidate) => isInPlace(candidate, context.surface));
  const strip = rank(candidates.filter((candidate) => !isInPlace(candidate, context.surface)));
  if (strip.length === 0) return { kind: 'SETTLE', settled: inPlace };
  return { kind: 'PRESENT', form: 'ORDINARY', presented: strip[0], settled: [...inPlace, ...strip.slice(1)] };
}
