/**
 * T-08 — `IF_ref` in, `IF_render` out.
 *
 * `IF_ref` is the exact thing the reader asked to inspect. It lives in canonical state, only the
 * inspection acts of T-04 may change it, and nothing here writes, repairs, re-elects or "rescues"
 * it: a projection change can make a reference unrenderable, and that is a fact about the
 * projection, never a reason to quietly inspect something else.
 *
 * `IF_render` is what the SELECTED historical disclosure can legitimately render of it right now.
 * It is derived from exactly two inputs and no third:
 *
 *   - the decoded `IF_ref`, which supplies what was REQUESTED — family, id, version intent and
 *     contextual route. This is the reader's own request being read back to them;
 *   - the disclosure's own `HistoricalInspectionResolution`, which supplies the three orthogonal
 *     ANSWERS — knowledge, context and disclosure — and decides what of the request may be shown.
 *
 * ## The one rule
 *
 * An identity may be NAMED only where the resolution says `knowledge != UNKNOWN_AT_TC`.
 *
 * Where `K(TC)` does confirm the identity, echoing the reader's own request back to them discloses
 * nothing they did not already supply. Where it does not, the identity may be a future object, and
 * naming it — or drawing a placeholder shaped like it, or holding a space where it would go, or
 * counting it — would confirm that a future object exists to a reader standing before it did. So
 * `IDENTITY_UNKNOWN_AT_TC` is a member with no fields at all: there is nothing on it to render.
 *
 * ## Five technical states that are not absences
 *
 * A disclosure that was never fetched, one the server refused, one that is not this viewpoint's, one
 * that carries no answer about this inspection, and one whose answer is not a legal resolution are
 * five facts about the client and the transport. None becomes `IDENTITY_UNKNOWN_AT_TC`, none becomes
 * `DEPTH_WITHHELD`, and none is presented as an absence in the world.
 */
import type { HistoricalInspectionResolution } from '../projection';
import { decodeInspectionRef, type DecodedInspectionRef, type MapInspectionContext } from '../map';
import { SEMANTIC_DEPTHS, type InspectionRef, type SemanticDepth } from '../state';
import type { ContextStep, ContextStepKind, InspectionRenderState, NoncurrentVersionState } from './types';

/** The frozen inspectable families, as the routes spell them. Nothing outside this set parses. */
const OBJECT_TOKENS: readonly string[] = Object.freeze([
  'THREAD',
  'EMERGING_FOCUS',
  'MOMENT',
  'READING',
  'MATERIAL',
  'GAP',
  'QUESTION',
  'CONFIDENCE',
]);

/** The rung names a route may contain as a structural step. `WORLD` is handled as its own kind. */
const RUNG_TOKENS: readonly string[] = Object.freeze(SEMANTIC_DEPTHS.filter((depth) => depth !== 'WORLD'));

const EMPTY_LINEAGE: readonly ContextStep[] = Object.freeze([]);

function classify(token: string, id: string | null, last: boolean): ContextStepKind | null {
  // The terminal step is always the inspected object itself.
  if (last) return id !== null && OBJECT_TOKENS.includes(token) ? 'OBJECT' : null;
  if (token === 'WORLD') return id === null ? 'WORLD' : null;
  if (id === null) return RUNG_TOKENS.includes(token) ? 'RUNG' : null;
  if (token === 'THREAD') return 'THREAD';
  if (token === 'THREAD_READING') return 'THREAD_READING';
  if (token === 'QUESTION_TURN') return 'QUESTION_TURN';
  return null;
}

/**
 * Parses the disclosed contextual route into steps.
 *
 * The route is the one T-04 minted from `V` when it admitted this target, so every step is disclosed
 * truth. A route that does not parse yields NO path — an unparsed segment is not rendered as an
 * opaque crumb, because a crumb the Product cannot explain still reads as hierarchy.
 */
export function contextLineage(route: string): readonly ContextStep[] {
  if (typeof route !== 'string' || route.length === 0) return EMPTY_LINEAGE;
  const segments = route.split('/');
  const steps: ContextStep[] = [];
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const colon = segment.indexOf(':');
    const token = colon < 0 ? segment : segment.slice(0, colon);
    const id = colon < 0 ? null : segment.slice(colon + 1);
    if (id !== null && id.length === 0) return EMPTY_LINEAGE;
    const kind = classify(token, id, index === segments.length - 1);
    if (kind === null) return EMPTY_LINEAGE;
    steps.push(Object.freeze({ kind, token, id }));
  }
  return Object.freeze(steps);
}

const KNOWLEDGE = Object.freeze(['UNKNOWN_AT_TC', 'KNOWN_AND_CURRENT_AT_TC', 'KNOWN_NONCURRENT_AT_TC']);
const CONTEXT_ANSWERS = Object.freeze(['NOT_REQUESTED', 'CONTEXT_AVAILABLE_AT_TC', 'CONTEXT_UNAVAILABLE_AT_TC']);
const DISCLOSURE_ANSWERS = Object.freeze(['AVAILABLE_AND_RENDERABLE', 'AVAILABLE_BUT_DEPTH_WITHHELD']);
const NONCURRENT = Object.freeze(['PREVALID', 'SUPERSEDED']);

/**
 * Whether a value is a legal `HistoricalInspectionResolution`. A shape that is not one is refused
 * rather than partially believed: half-reading an answer is how a technical defect becomes a
 * confident statement about the world.
 */
function isLegalResolution(value: unknown): value is HistoricalInspectionResolution {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.knowledge !== 'string' || !KNOWLEDGE.includes(candidate.knowledge)) return false;
  if (candidate.knowledge === 'UNKNOWN_AT_TC') return true;
  if (candidate.noncurrent !== null && (typeof candidate.noncurrent !== 'string' || !NONCURRENT.includes(candidate.noncurrent))) return false;
  if (typeof candidate.context !== 'string' || !CONTEXT_ANSWERS.includes(candidate.context)) return false;
  if (typeof candidate.disclosure !== 'string' || !DISCLOSURE_ANSWERS.includes(candidate.disclosure)) return false;
  if (typeof candidate.requiredDepth !== 'string' || !(SEMANTIC_DEPTHS as readonly string[]).includes(candidate.requiredDepth)) return false;
  return true;
}

/**
 * Derives `IF_render` for a projection that has ALREADY been proven to be this viewpoint's.
 *
 * The freshness proof is the caller's, and it happens before this function is reached: deriving a
 * semantic answer from an unproven projection is the defect the gate exists to prevent, so this
 * module is never handed a context it can ask a semantic question of prematurely.
 */
export function inspectionRender(ref: InspectionRef | null, context: MapInspectionContext): InspectionRenderState {
  const resolution = context.disclosure.inspection;
  if (ref === null) {
    // A disclosure that answers about an inspection the reader does not hold does not agree with
    // canonical state; nothing semantic may be read out of that disagreement.
    return resolution === null ? { kind: 'NO_INSPECTION' } : { kind: 'RESOLUTION_MALFORMED' };
  }
  const decoded = decodeInspectionRef(ref);
  if (decoded === null) return { kind: 'RESOLUTION_MALFORMED' };
  // The reader holds an inspection this disclosure was not asked about. A missing answer is a
  // technical gap in what the client fetched, and never evidence that the target is not there.
  if (resolution === null) return { kind: 'INSPECTION_NOT_RESOLVED' };
  if (!isLegalResolution(resolution)) return { kind: 'RESOLUTION_MALFORMED' };

  // THE rule: no branch below this line may name the identity.
  if (resolution.knowledge === 'UNKNOWN_AT_TC') return { kind: 'IDENTITY_UNKNOWN_AT_TC' };

  const noncurrent: NoncurrentVersionState = resolution.knowledge === 'KNOWN_NONCURRENT_AT_TC' ? resolution.noncurrent : null;

  if (resolution.disclosure === 'AVAILABLE_BUT_DEPTH_WITHHELD') {
    // Withheld, not absent. The rung that would disclose it is named; its content is not, and the
    // contextual route is not either, because a route is itself disclosed at a deeper rung.
    return Object.freeze({
      kind: 'DEPTH_WITHHELD' as const,
      family: decoded.family,
      id: decoded.id,
      requiredDepth: resolution.requiredDepth as SemanticDepth,
    });
  }

  if (resolution.context === 'CONTEXT_UNAVAILABLE_AT_TC') {
    // The identity is part of `K(TC)` and may be named. The unavailable context may not be named,
    // and no other disclosed appearance is put in its place: a substitution would be a different
    // Product fact presented as the requested one.
    return Object.freeze({
      kind: 'CONTEXT_UNAVAILABLE_AT_TC' as const,
      family: decoded.family,
      id: decoded.id,
      versionIntent: decoded.version,
      noncurrent,
    });
  }

  return Object.freeze({
    kind: 'RENDERABLE' as const,
    family: decoded.family,
    id: decoded.id,
    // The requested version intent, retained exactly: `null` means "the then-current one at TC",
    // which is a different request from naming that same number explicitly.
    versionIntent: decoded.version,
    noncurrent,
    lineage: contextLineage(decoded.lineage),
    contextRequested: resolution.context !== 'NOT_REQUESTED',
  });
}

/**
 * The requested identity in Map terms, for the surfaces that may offer a contextual choice.
 *
 * It is deliberately derived from the RENDER state and not from `IF_ref`: a decoded reference always
 * carries a family and an id, so reading the identity straight off it would name an identity in
 * exactly the branches that may not name one.
 */
export function renderableIdentity(render: InspectionRenderState): { readonly family: DecodedInspectionRef['family']; readonly id: string } | null {
  return render.kind === 'RENDERABLE' ? { family: render.family, id: render.id } : null;
}
