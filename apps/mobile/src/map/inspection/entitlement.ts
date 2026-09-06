/**
 * T-04 — entitlement: the ONLY place an inspection reference can be minted, and it can only be
 * minted from the disclosed projection `V`.
 *
 * Knowing an identifier entitles nobody to anything. A target is admitted here only when `V`
 * itself discloses it at `TC`, at a rung the current semantic depth actually earned, with the
 * exact contextual appearance and version the request named. Everything else is refused with a
 * typed reason:
 *
 *   - a rung that is `DEPTH_WITHHELD` is withheld, not empty: an identity that would live there
 *     is off-depth and is refused, never rendered dimmed, never hidden with opacity, never
 *     enumerated "for accessibility";
 *   - an identity absent from a DISCLOSED rung is `UNKNOWN_AT_TC`: it may be a future object, it
 *     may never exist, and either way it is not admitted;
 *   - a version beyond the then-current one is future truth and is refused; a version the
 *     disclosed lineage records is known at `TC` and is admitted exactly as requested;
 *   - a contextual appearance is legitimate only if `V` discloses that exact binding.
 *
 * The minted value is branded at runtime, not merely typed: a structurally identical object that
 * this module did not produce is not an entitlement, so a forged target cannot reach an act.
 * The reference itself is a plain, frozen `InspectionRef` — the canonical kernel stores it as
 * the exact requested inspection and retains it even when a later projection says it is
 * unavailable, which is the frozen behaviour of `IF_ref`.
 */
import type {
  HistoricalAppearanceKind,
  HistoricalDisclosure,
  HistoricalFamily,
} from '@qandeel/runtime';

import { opaqueRef, type InspectionRef, type SemanticDepth } from '../../state';
import type { DisclosedProjectionTuple } from '../projection';

export const INSPECTABLE_FAMILIES: readonly HistoricalFamily[] = Object.freeze([
  'THREAD',
  'EMERGING_FOCUS',
  'MOMENT',
  'READING',
  'MATERIAL',
  'GAP',
  'QUESTION',
  'CONFIDENCE',
]);

export interface InspectionAppearanceRequest {
  readonly kind: HistoricalAppearanceKind;
  readonly bindingId: string;
}

export interface InspectionRequest {
  readonly family: HistoricalFamily;
  readonly id: string;
  /** Absent means the then-current version at `TC`; the kernel stores that absence exactly. */
  readonly version?: number;
  readonly appearance?: InspectionAppearanceRequest;
}

export interface EntitledInspection {
  readonly family: HistoricalFamily;
  readonly id: string;
  readonly version: number | null;
  readonly appearance: InspectionAppearanceRequest | null;
  /** The rung of `V` that disclosed this identity at `TC`. */
  readonly disclosedAtDepth: SemanticDepth;
  /** The exact contextual route to this target; never a guess and never a default. */
  readonly lineage: string;
  /**
   * The canonical projection tuple this entitlement was minted from (R2-01). An entitlement is
   * authority for exactly that `(Session, TC, depth)` and for no other, so any route that holds
   * one — including a shortcut that never sees the context — can be checked against the store's
   * current tuple by the one shared freshness rule.
   */
  readonly projection: DisclosedProjectionTuple;
  readonly ref: InspectionRef;
}

export type EntitlementRejectionReason =
  | 'INVALID_REQUEST'
  | 'DEPTH_WITHHELD'
  | 'UNKNOWN_AT_TC'
  | 'CONTEXT_UNAVAILABLE_AT_TC'
  | 'VERSION_NOT_KNOWN_AT_TC';

export interface EntitlementRefusal {
  readonly ok: false;
  readonly reason: EntitlementRejectionReason;
  readonly detail: string;
}

export type EntitlementResolution = { readonly ok: true; readonly entitled: EntitledInspection } | EntitlementRefusal;

const minted = new WeakSet<object>();

/** True only for a value this module produced. A structural look-alike is not an entitlement. */
export function isEntitledInspection(value: unknown): value is EntitledInspection {
  return typeof value === 'object' && value !== null && minted.has(value as object);
}

const refuse = (reason: EntitlementRejectionReason, detail: string): EntitlementRefusal => ({ ok: false, reason, detail });

interface FamilyResolution {
  readonly ok: true;
  /** The versions of this identity that `V` records as known at `TC`; empty when it has none. */
  readonly knownVersions: readonly number[];
  readonly disclosedAtDepth: SemanticDepth;
}

function resolveFamily(disclosure: HistoricalDisclosure, family: HistoricalFamily, id: string): FamilyResolution | EntitlementRefusal {
  switch (family) {
    case 'THREAD': {
      // The WORLD rung is the floor of every disclosure and is always present.
      if (!disclosure.world.threads.some((candidate) => candidate.id === id)) {
        return refuse('UNKNOWN_AT_TC', `THREAD ${id} is not part of K(TC)`);
      }
      return { ok: true, knownVersions: [], disclosedAtDepth: 'WORLD' };
    }
    case 'EMERGING_FOCUS':
    case 'MOMENT': {
      if (disclosure.session.status !== 'DISCLOSED') {
        return refuse('DEPTH_WITHHELD', `the SESSION rung is withheld at depth ${disclosure.depth}`);
      }
      const known =
        family === 'MOMENT'
          ? disclosure.session.value.moments.some((moment) => moment.id === id)
          : disclosure.session.value.emergingFocuses.some((focus) => focus.id === id);
      if (!known) return refuse('UNKNOWN_AT_TC', `${family} ${id} is not part of K(TC)`);
      return { ok: true, knownVersions: [], disclosedAtDepth: 'SESSION' };
    }
    case 'READING': {
      // A Reading is disclosed as an identity by the THREAD rung too, as the endpoint of a
      // disclosed contextual appearance — with no analytical content attached to it there.
      if (disclosure.analyticalObject.status === 'DISCLOSED') {
        const reading = disclosure.analyticalObject.value.readings.find((candidate) => candidate.id === id);
        if (reading !== undefined) {
          const versions = new Set<number>([reading.versionAtTc, ...reading.lineage.map((step) => step.toVersion)]);
          return {
            ok: true,
            knownVersions: [...versions].filter((version) => version <= reading.versionAtTc).sort((a, b) => a - b),
            disclosedAtDepth: 'ANALYTICAL_OBJECT',
          };
        }
      }
      if (disclosure.thread.status === 'DISCLOSED' && disclosure.thread.value.threadReadingAppearances.some((appearance) => appearance.readingId === id)) {
        return { ok: true, knownVersions: [], disclosedAtDepth: 'THREAD' };
      }
      if (disclosure.analyticalObject.status !== 'DISCLOSED' && disclosure.thread.status !== 'DISCLOSED') {
        return refuse('DEPTH_WITHHELD', `no rung that discloses a Reading is available at depth ${disclosure.depth}`);
      }
      return refuse('UNKNOWN_AT_TC', `READING ${id} is not part of K(TC)`);
    }
    case 'MATERIAL':
    case 'GAP':
    case 'QUESTION':
    case 'CONFIDENCE': {
      if (disclosure.analyticalObject.status !== 'DISCLOSED') {
        return refuse('DEPTH_WITHHELD', `the ANALYTICAL_OBJECT rung is withheld at depth ${disclosure.depth}`);
      }
      const rung = disclosure.analyticalObject.value;
      if (family === 'MATERIAL') {
        const material = rung.materials.find((candidate) => candidate.id === id);
        if (material === undefined) return refuse('UNKNOWN_AT_TC', `MATERIAL ${id} is not part of K(TC)`);
        return { ok: true, knownVersions: [material.version], disclosedAtDepth: 'ANALYTICAL_OBJECT' };
      }
      const known =
        family === 'GAP'
          ? rung.gaps.some((gap) => gap.id === id)
          : family === 'QUESTION'
            ? rung.questions.some((question) => question.id === id)
            : rung.confidences.some((confidence) => confidence.id === id);
      if (!known) return refuse('UNKNOWN_AT_TC', `${family} ${id} is not part of K(TC)`);
      return { ok: true, knownVersions: [], disclosedAtDepth: 'ANALYTICAL_OBJECT' };
    }
    default: {
      const exhaustive: never = family;
      return refuse('INVALID_REQUEST', `unknown family ${String(exhaustive)}`);
    }
  }
}

/**
 * Validates the requested contextual appearance against the disclosed bindings and returns the
 * exact contextual route it establishes. No appearance is ever inferred, defaulted or elected.
 */
function resolveAppearance(
  disclosure: HistoricalDisclosure,
  family: HistoricalFamily,
  id: string,
  appearance: InspectionAppearanceRequest,
): { readonly ok: true; readonly route: string } | EntitlementRefusal {
  if (appearance.kind === 'THREAD_READING') {
    if (disclosure.thread.status !== 'DISCLOSED') {
      return refuse('DEPTH_WITHHELD', `the THREAD rung is withheld at depth ${disclosure.depth}; its bindings are not disclosed`);
    }
    if (family !== 'READING') {
      return refuse('INVALID_REQUEST', 'a THREAD_READING appearance belongs to a Reading');
    }
    const binding = disclosure.thread.value.threadReadingAppearances.find((candidate) => candidate.bindingId === appearance.bindingId);
    if (binding === undefined || binding.readingId !== id) {
      return refuse('CONTEXT_UNAVAILABLE_AT_TC', `the THREAD_READING binding ${appearance.bindingId} is not a disclosed appearance of READING ${id} at TC`);
    }
    return { ok: true, route: `WORLD/THREAD:${binding.threadId}/THREAD_READING:${binding.bindingId}/READING:${id}` };
  }
  if (appearance.kind === 'QUESTION_TURN') {
    if (disclosure.session.status !== 'DISCLOSED') {
      return refuse('DEPTH_WITHHELD', `the SESSION rung is withheld at depth ${disclosure.depth}; its bindings are not disclosed`);
    }
    const binding = disclosure.session.value.questionAppearances.find((candidate) => candidate.bindingId === appearance.bindingId);
    if (binding === undefined) {
      return refuse('CONTEXT_UNAVAILABLE_AT_TC', `the QUESTION_TURN binding ${appearance.bindingId} is not disclosed at TC`);
    }
    // Only the two endpoints the binding itself names are legitimate; nothing is inferred from
    // a question type, a gap epoch or a turn ordinal.
    const belongs = (family === 'GAP' && binding.gapId === id) || (family === 'READING' && binding.readingId === id);
    if (!belongs) {
      return refuse('CONTEXT_UNAVAILABLE_AT_TC', `the QUESTION_TURN binding ${appearance.bindingId} is not a disclosed appearance of ${family} ${id} at TC`);
    }
    return { ok: true, route: `WORLD/SESSION/QUESTION_TURN:${binding.bindingId}/${family}:${id}` };
  }
  return refuse('INVALID_REQUEST', `unknown contextual appearance kind ${String(appearance.kind)}`);
}

function defaultRoute(family: HistoricalFamily, id: string, depth: SemanticDepth): string {
  return depth === 'WORLD' ? `WORLD/${family}:${id}` : `WORLD/${depth}/${family}:${id}`;
}

function buildInspectionRef(
  family: HistoricalFamily,
  id: string,
  version: number | null,
  appearance: InspectionAppearanceRequest | null,
  depth: SemanticDepth,
  lineage: string,
): InspectionRef {
  const base = {
    canonicalIdentity: opaqueRef('CANONICAL_IDENTITY', { family, id }),
    depth,
    lineage: opaqueRef('LINEAGE', { route: lineage }),
  };
  const withAppearance =
    appearance === null ? base : { ...base, contextualAppearance: opaqueRef('CONTEXTUAL_APPEARANCE', { kind: appearance.kind, bindingId: appearance.bindingId }) };
  const ref = version === null ? withAppearance : { ...withAppearance, version: opaqueRef('VERSION', { version }) };
  return Object.freeze(ref);
}

/**
 * Resolves one inspection request against `V`. `depth` of the resulting reference is the rung
 * that disclosed the identity, not the camera's rung: the reference records what was actually
 * earned.
 */
export function resolveEntitledInspection(disclosure: HistoricalDisclosure, request: InspectionRequest): EntitlementResolution {
  if (request === null || typeof request !== 'object') return refuse('INVALID_REQUEST', 'a request is required');
  if (!INSPECTABLE_FAMILIES.includes(request.family)) return refuse('INVALID_REQUEST', `unknown family ${String(request.family)}`);
  if (typeof request.id !== 'string' || request.id.length === 0) return refuse('INVALID_REQUEST', 'a non-empty canonical identity is required');
  if (request.version !== undefined && (!Number.isSafeInteger(request.version) || request.version < 1)) {
    return refuse('INVALID_REQUEST', 'a requested version is an integer >= 1');
  }

  const resolved = resolveFamily(disclosure, request.family, request.id);
  if (!resolved.ok) return resolved;

  if (request.version !== undefined && !resolved.knownVersions.includes(request.version)) {
    return refuse(
      'VERSION_NOT_KNOWN_AT_TC',
      `version ${request.version} of ${request.family} ${request.id} is not recorded as known at TC ${disclosure.tc}`,
    );
  }

  let lineage = defaultRoute(request.family, request.id, resolved.disclosedAtDepth);
  if (request.appearance !== undefined) {
    const appearance = resolveAppearance(disclosure, request.family, request.id, request.appearance);
    if (!appearance.ok) return appearance;
    lineage = appearance.route;
  }

  const version = request.version ?? null;
  const entitled: EntitledInspection = Object.freeze({
    family: request.family,
    id: request.id,
    version,
    appearance: request.appearance === undefined ? null : Object.freeze({ ...request.appearance }),
    disclosedAtDepth: resolved.disclosedAtDepth,
    lineage,
    // Recorded from the disclosure that admitted this target, never from the store.
    projection: Object.freeze({ sessionId: disclosure.sessionId, tc: disclosure.tc, depth: disclosure.depth }),
    ref: buildInspectionRef(request.family, request.id, version, request.appearance ?? null, resolved.disclosedAtDepth, lineage),
  });
  minted.add(entitled);
  return { ok: true, entitled };
}

export interface DecodedInspectionRef {
  readonly family: HistoricalFamily;
  readonly id: string;
  readonly version: number | null;
  readonly appearance: InspectionAppearanceRequest | null;
  readonly depth: SemanticDepth;
  readonly lineage: string;
}

/**
 * Reads back a reference this module minted. It decodes an ENCODING that T-04 owns; it grants
 * nothing, and a reference that decodes cleanly is still not entitled at another `TC` — the
 * kernel keeps `IF_ref` exactly as requested even when a later projection cannot render it.
 */
export function decodeInspectionRef(ref: InspectionRef | null): DecodedInspectionRef | null {
  if (ref === null) return null;
  const identity = ref.canonicalIdentity.value;
  if (typeof identity === 'string') return null;
  const family = identity.family;
  const id = identity.id;
  if (typeof family !== 'string' || !INSPECTABLE_FAMILIES.includes(family as HistoricalFamily)) return null;
  if (typeof id !== 'string' || id.length === 0) return null;

  let appearance: InspectionAppearanceRequest | null = null;
  if (ref.contextualAppearance !== undefined) {
    const value = ref.contextualAppearance.value;
    if (typeof value === 'string') return null;
    const kind = value.kind;
    const bindingId = value.bindingId;
    if ((kind !== 'THREAD_READING' && kind !== 'QUESTION_TURN') || typeof bindingId !== 'string') return null;
    appearance = { kind, bindingId };
  }

  let version: number | null = null;
  if (ref.version !== undefined) {
    const value = ref.version.value;
    if (typeof value === 'string' || typeof value.version !== 'number') return null;
    version = value.version;
  }

  const lineageValue = ref.lineage.value;
  const lineage = typeof lineageValue === 'string' ? lineageValue : typeof lineageValue.route === 'string' ? lineageValue.route : null;
  if (lineage === null) return null;

  return { family: family as HistoricalFamily, id, version, appearance, depth: ref.depth, lineage };
}
