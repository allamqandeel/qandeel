/**
 * T-08 — the ONE place any word a reader can see or hear is written.
 *
 * Everything the chrome says passes through here, which is what makes the rule below checkable
 * rather than aspirational: no engineering vocabulary reaches the Product surface.
 *
 * Never spoken and never drawn:
 *
 *   - transport and projection refusal codes (`HISTORICAL_COVERAGE_UNAVAILABLE`, …). A reader is
 *     told the Product cannot show them something; the code belongs in the typed model and the logs;
 *   - raw `HistoricalFamily` tokens (`ANALYTICAL_OBJECT`, `EMERGING_FOCUS`, …) — the frozen wire
 *     vocabulary is not English;
 *   - raw semantic-depth enum names — the reader knows rungs as what they disclose, not as constants;
 *   - opaque identifiers of any kind: canonical ids, binding ids, locus keys, lineage tokens. None of
 *     them means anything to a reader, and several of them are internal handles.
 *
 * What IS spoken is the small set of things the frozen Product contract already treats as
 * reader-facing: a Session Position ("moment 4"), a version number of a disclosed lineage, and the
 * plain-language name of a family or a rung.
 *
 * The typed distinctions behind the words are untouched. Two states may legitimately share a
 * sentence — the four technical projection states say a similar thing to a reader, because to a
 * reader they ARE the same thing — while remaining different members of the union, so no code path
 * can collapse them.
 */
import type { SemanticDepth } from '../state';
import type { HistoricalFamily } from '../projection';
import type { ContextStep, InspectionRenderState, LiveChrome, NoncurrentVersionState, SpatialChrome, TemporalChrome } from './types';

/** The frozen families, in plain language. Never the wire token. */
const FAMILY: Readonly<Record<HistoricalFamily, string>> = Object.freeze({
  THREAD: 'a thread',
  EMERGING_FOCUS: 'an emerging focus',
  MOMENT: 'a moment',
  READING: 'a reading',
  MATERIAL: 'a material',
  GAP: 'a gap',
  QUESTION: 'a question',
  CONFIDENCE: 'a confidence',
});

/** The frozen disclosure lineage, named by what each rung discloses. Never the enum. */
const DEPTH: Readonly<Record<SemanticDepth, string>> = Object.freeze({
  WORLD: 'the whole world',
  THREAD: 'threads',
  SESSION: 'the conversation',
  ANALYTICAL_OBJECT: 'readings and findings',
  SOURCE_PROVENANCE: 'sources',
});

/** The structural role of one route step, in plain language. Never the identity it names. */
const STEP: Readonly<Record<ContextStep['kind'], string>> = Object.freeze({
  WORLD: 'the world',
  RUNG: 'a rung',
  THREAD: 'a thread',
  THREAD_READING: 'a context',
  QUESTION_TURN: 'a question',
  OBJECT: 'here',
});

function versionSentence(versionIntent: number | null, noncurrent: NoncurrentVersionState): string {
  const asked = versionIntent === null ? '' : ` You asked for version ${versionIntent} of it.`;
  if (noncurrent === 'SUPERSEDED') return `${asked} It had already been replaced by this moment.`;
  if (noncurrent === 'PREVALID') return `${asked} It was not yet in use at this moment.`;
  return asked;
}

/**
 * What the reader is inspecting, in one sentence.
 *
 * The branch structure is the firewall, unchanged: only a state that carries an identity can say
 * anything about one, and the identity it says is the plain-language FAMILY, never the id.
 */
export function inspectionSentence(render: InspectionRenderState): string {
  switch (render.kind) {
    case 'NO_INSPECTION':
      return 'Nothing is being inspected.';
    case 'RENDERABLE':
      return `You are inspecting ${FAMILY[render.family]}.${versionSentence(render.versionIntent, render.noncurrent)}`;
    case 'IDENTITY_UNKNOWN_AT_TC':
      // No family, no name, no shape. This moment simply does not know it.
      return 'This moment does not know what you asked to inspect.';
    case 'CONTEXT_UNAVAILABLE_AT_TC':
      return `You are inspecting ${FAMILY[render.family]}.${versionSentence(render.versionIntent, render.noncurrent)} The context you asked for is not part of this moment.`;
    case 'DEPTH_WITHHELD':
      // Withheld, not absent. The reader is told where it would be disclosed, in plain language.
      return `You are inspecting ${FAMILY[render.family]}. Go deeper to see it: it is disclosed with ${DEPTH[render.requiredDepth]}.`;
    case 'PROJECTION_NOT_FETCHED':
      return 'This moment has not been loaded yet.';
    case 'PROJECTION_UNAVAILABLE':
      // The typed code stays in the model. A reader is never shown a transport code.
      return 'This moment cannot be shown right now.';
    case 'PROJECTION_STALE':
      return 'Catching up with where you are.';
    case 'PROJECTION_INCOHERENT':
      return 'This moment cannot be shown right now.';
    case 'INSPECTION_NOT_RESOLVED':
      return 'This view does not cover what you are inspecting.';
    case 'RESOLUTION_MALFORMED':
      return 'What you are inspecting cannot be described here.';
    default: {
      const exhaustive: never = render;
      return exhaustive;
    }
  }
}

/** Where the reader stands in conversational time. A Session Position is reader-facing Product truth. */
export function temporalSentence(temporal: TemporalChrome): string {
  if (temporal.mode === 'FOLLOW_LIVE') {
    return temporal.liveHeadEstablished ? 'Following the conversation as it continues.' : 'The conversation has not started yet.';
  }
  return `Reading at moment ${temporal.at}.`;
}

/** The camera's own orientation, named by what the rung discloses rather than by its constant. */
export function spatialSentence(spatial: SpatialChrome): string {
  return spatial.atWorldViewpoint ? 'Looking at the whole world.' : `Showing ${DEPTH[spatial.depth]}.`;
}

/**
 * Everything a historical reader may be told about Live: that it moved on, and nothing about where.
 */
export function liveSentence(live: LiveChrome): string | null {
  return live.advancedWhileHistorical ? 'The conversation has continued since this moment.' : null;
}

/** One step of the disclosed route, as its structural role. The identity it names is never spoken. */
export const contextStepWord = (step: ContextStep): string => STEP[step.kind];

/**
 * The route in words: what the reader is inside, without naming anything inside it.
 *
 * The terminal step is dropped — it is the object itself, which the inspection sentence has already
 * named — so this answers "what contextualizes this" and nothing else. An empty route says nothing.
 */
export function contextPathSentence(lineage: readonly ContextStep[]): string | null {
  const inside = lineage.filter((step) => step.kind !== 'OBJECT' && step.kind !== 'WORLD');
  if (inside.length === 0) return null;
  return `Inside ${inside.map(contextStepWord).join(', inside ')}.`;
}

/**
 * How one disclosed contextual appearance is offered.
 *
 * The only distinguishers are ones the reader already has: whether this is the context they are
 * looking through now, and the Moment the appearance was taken up at. No binding id, no Thread id,
 * no locus key. When two appearances cannot be told apart this way the chooser fails closed rather
 * than inventing a label or falling back to an internal handle.
 */
export function contextChoiceLabel(current: boolean, boundAtMoment: number): string {
  return current ? 'The context you are looking through now' : `Taken up at moment ${boundAtMoment}`;
}

export const CONTEXT_CHOICE_TITLE = 'This appears in more than one context';
