// T-03C - Layer B: `V = Disclose(K(TC), semanticDepth, inspectionContext)`.
//
// A pure function over the typed knowledge of ONE Session at ONE TC. It adds
// nothing to `K(TC)`: it decides which rungs of the frozen disclosure lineage
// (World -> Thread -> Session -> Analytical object -> Source / Provenance) the
// requested depth earns, and it answers the requested inspection along three
// orthogonal axes that the frozen constitution keeps apart:
//
//   * historically unavailable  - the identity is not part of K(TC)
//                                 (UNKNOWN_AT_TC), or its requested contextual
//                                 appearance is not (CONTEXT_UNAVAILABLE_AT_TC);
//   * known but noncurrent      - the identity is known and the requested
//                                 version is not the then-current one
//                                 (PREVALID beyond it, SUPERSEDED before it);
//   * withheld at this depth    - known and current, but the requested depth
//                                 did not earn its rung (AVAILABLE_BUT_DEPTH_WITHHELD).
//
// Depth is monotonic: every rung at or below the requested depth is
// disclosed; a rung above it is DEPTH_WITHHELD, never an empty list. The
// WORLD rung is the floor of every disclosure. No score, rank, label, camera
// or Product action is produced here.

import type {
  HistoricalDisclosure,
  HistoricalFamily,
  HistoricalInspectionRequest,
  HistoricalInspectionResolution,
  HistoricalRung,
  HistoricalSemanticDepth,
} from '@qandeel/runtime';
import type { HistoricalKnowledge } from './historical-projection.types';

export const HISTORICAL_SEMANTIC_DEPTHS: readonly HistoricalSemanticDepth[] = Object.freeze(['WORLD', 'THREAD', 'SESSION', 'ANALYTICAL_OBJECT', 'SOURCE_PROVENANCE']);
export const HISTORICAL_FAMILIES: readonly HistoricalFamily[] = Object.freeze(['THREAD', 'EMERGING_FOCUS', 'MOMENT', 'READING', 'MATERIAL', 'GAP', 'QUESTION', 'CONFIDENCE']);

export function isHistoricalSemanticDepth(value: unknown): value is HistoricalSemanticDepth {
  return typeof value === 'string' && (HISTORICAL_SEMANTIC_DEPTHS as readonly string[]).includes(value);
}
export function isHistoricalFamily(value: unknown): value is HistoricalFamily {
  return typeof value === 'string' && (HISTORICAL_FAMILIES as readonly string[]).includes(value);
}

const levelOf = (depth: HistoricalSemanticDepth): number => HISTORICAL_SEMANTIC_DEPTHS.indexOf(depth);
const deeper = (a: HistoricalSemanticDepth, b: HistoricalSemanticDepth): HistoricalSemanticDepth => (levelOf(a) >= levelOf(b) ? a : b);

/** The rung each family discloses at (Stage 4.2 / S34-WORLD-03: Reading is an analytical object, never a depth of its own). */
export const FAMILY_DEPTH: Readonly<Record<HistoricalFamily, HistoricalSemanticDepth>> = Object.freeze({
  THREAD: 'WORLD',
  EMERGING_FOCUS: 'SESSION',
  MOMENT: 'SESSION',
  READING: 'ANALYTICAL_OBJECT',
  MATERIAL: 'ANALYTICAL_OBJECT',
  GAP: 'ANALYTICAL_OBJECT',
  QUESTION: 'ANALYTICAL_OBJECT',
  CONFIDENCE: 'ANALYTICAL_OBJECT',
});

function rung<T>(disclosed: boolean, value: () => T): HistoricalRung<T> {
  return disclosed ? { status: 'DISCLOSED', value: value() } : { status: 'DEPTH_WITHHELD' };
}

/** The then-current version of a known identity at TC, or null for a family that is not versioned. */
function knownVersion(knowledge: HistoricalKnowledge, family: HistoricalFamily, id: string): { readonly known: boolean; readonly version: number | null } {
  switch (family) {
    case 'THREAD': return { known: knowledge.threads.some((thread) => thread.id === id), version: null };
    case 'EMERGING_FOCUS': return { known: knowledge.emergingFocuses.some((focus) => focus.id === id), version: null };
    case 'MOMENT': return { known: knowledge.moments.some((moment) => moment.id === id), version: null };
    case 'READING': {
      const reading = knowledge.readings.find((entry) => entry.id === id);
      return { known: reading !== undefined, version: reading?.versionAtTc ?? null };
    }
    case 'MATERIAL': {
      const material = knowledge.materials.find((entry) => entry.id === id);
      return { known: material !== undefined, version: material?.version ?? null };
    }
    case 'GAP': {
      const gap = knowledge.gaps.find((entry) => entry.id === id);
      return { known: gap !== undefined, version: gap?.openEpochAtTc ?? null };
    }
    case 'QUESTION': return { known: knowledge.questions.some((question) => question.id === id), version: null };
    case 'CONFIDENCE': return { known: knowledge.confidences.some((confidence) => confidence.id === id), version: null };
    default: {
      const exhaustive: never = family;
      return exhaustive;
    }
  }
}

/** Whether the requested contextual appearance of this identity is part of K(TC), and the rung it discloses at. */
function appearanceOf(knowledge: HistoricalKnowledge, request: HistoricalInspectionRequest): { readonly available: boolean; readonly depth: HistoricalSemanticDepth } | null {
  if (!request.appearance) return null;
  if (request.appearance.kind === 'THREAD_READING') {
    const bindingId = request.appearance.bindingId;
    const available = knowledge.threadReadingAppearances.some((appearance) => appearance.bindingId === bindingId
      && (request.family === 'THREAD' ? appearance.threadId === request.id : request.family === 'READING' ? appearance.readingId === request.id : false));
    return { available, depth: 'THREAD' };
  }
  const bindingId = request.appearance.bindingId;
  const available = knowledge.questionAppearances.some((appearance) => appearance.bindingId === bindingId
    && (request.family === 'GAP' ? appearance.gapId === request.id : request.family === 'READING' ? appearance.readingId === request.id : false));
  return { available, depth: 'SESSION' };
}

/** Resolves ONE requested inspection against K(TC) at the requested depth. */
export function resolveInspection(knowledge: HistoricalKnowledge, depth: HistoricalSemanticDepth, request: HistoricalInspectionRequest): HistoricalInspectionResolution {
  const { known, version } = knownVersion(knowledge, request.family, request.id);
  if (!known) return { knowledge: 'UNKNOWN_AT_TC' };
  let noncurrent: 'PREVALID' | 'SUPERSEDED' | null = null;
  if (request.version !== undefined && version !== null && request.version !== version) {
    noncurrent = request.version > version ? 'PREVALID' : 'SUPERSEDED';
  }
  const appearance = appearanceOf(knowledge, request);
  const requiredDepth = appearance ? deeper(FAMILY_DEPTH[request.family], appearance.depth) : FAMILY_DEPTH[request.family];
  return {
    knowledge: noncurrent === null ? 'KNOWN_AND_CURRENT_AT_TC' : 'KNOWN_NONCURRENT_AT_TC',
    noncurrent,
    context: appearance === null ? 'NOT_REQUESTED' : appearance.available ? 'CONTEXT_AVAILABLE_AT_TC' : 'CONTEXT_UNAVAILABLE_AT_TC',
    disclosure: levelOf(depth) >= levelOf(requiredDepth) ? 'AVAILABLE_AND_RENDERABLE' : 'AVAILABLE_BUT_DEPTH_WITHHELD',
    requiredDepth,
  };
}

/** `V = Disclose(K(TC), semanticDepth, inspectionContext)`. Pure; adds nothing to K(TC). */
export function disclose(knowledge: HistoricalKnowledge, depth: HistoricalSemanticDepth, inspection: HistoricalInspectionRequest | null = null): HistoricalDisclosure {
  const level = levelOf(depth);
  return {
    sessionId: knowledge.sessionId,
    liveHead: knowledge.liveHead,
    tc: knowledge.tc,
    sealed: knowledge.sealed,
    depth,
    revision: knowledge.revision,
    world: { threads: knowledge.threads, liveFocus: knowledge.liveFocus },
    thread: rung(level >= levelOf('THREAD'), () => ({ threadReadingAppearances: knowledge.threadReadingAppearances })),
    session: rung(level >= levelOf('SESSION'), () => ({
      moments: knowledge.moments, emergingFocuses: knowledge.emergingFocuses, questionAppearances: knowledge.questionAppearances,
    })),
    analyticalObject: rung(level >= levelOf('ANALYTICAL_OBJECT'), () => ({
      readings: knowledge.readings, readingRelations: knowledge.readingRelations, materials: knowledge.materials,
      gaps: knowledge.gaps, questions: knowledge.questions, confidences: knowledge.confidences,
    })),
    sourceProvenance: rung(level >= levelOf('SOURCE_PROVENANCE'), () => ({ evidenceParticipations: knowledge.evidenceParticipations })),
    inspection: inspection === null ? null : resolveInspection(knowledge, depth, inspection),
  };
}
