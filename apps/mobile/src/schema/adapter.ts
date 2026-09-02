/**
 * The schema-driven part of the engine.
 *
 * `project(fixture, cursor)` folds the first `cursor` beats of a case study into a flat,
 * render-ready state. This is the ONLY module that knows the wire shape: every component
 * downstream consumes the view models below, so re-pointing the spike at a real runtime
 * feed means rewriting this file and nothing else.
 *
 * Two things it deliberately does not do:
 *   - it never invents a primitive the beat did not ask for, except the CARD that doc 05
 *     makes mandatory on `CONTRADICT` ("a contradiction must never be silent"), and that
 *     addition is recorded as a note;
 *   - it never raises emphasis. Every weight goes through `honesty.ts`.
 */

import {
  decideAnchorWeight,
  emergingFrameThresholdMet,
  threadStrokeWidth,
  type WeightDecision,
} from './honesty';
import {
  renderBindingOf,
  type AnalysisLevel,
  type BeatKind,
  type CaseStudyBeat,
  type CaseStudyFixture,
  type DeltaHint,
  type PrimitiveKind,
  type PrimitiveRole,
  type ThreadStyle,
} from './types';

export interface AnchorVM {
  key: string;
  beatId: string;
  spanId: string;
  role: PrimitiveRole;
  weight: WeightDecision;
  beatKind: BeatKind;
  label?: string;
}

export interface CardVM {
  key: string;
  beatId: string;
  objectRef: string;
  text: string;
  levels: AnalysisLevel[];
  /** True when doc 05 made the card mandatory rather than the beat asking for it. */
  mandatory: boolean;
}

export interface ThreadVM {
  key: string;
  beatId: string;
  fromRef: string;
  toRef: string;
  style: ThreadStyle;
  strokeWidth: number;
  levels: AnalysisLevel[];
  beatKind: BeatKind;
}

export interface MeterStepVM {
  beatId: string;
  delta: DeltaHint;
  causeRef: string;
  levels: AnalysisLevel[];
}

export interface MeterVM {
  key: string;
  meterKey: string;
  steps: MeterStepVM[];
}

export interface SpineMarkerVM {
  beatId: string;
  beatKind: BeatKind;
  levels: AnalysisLevel[];
  label?: string;
  /** The beat explicitly asked for a SPINE dot, over and above the default marker. */
  emphasized: boolean;
}

export interface FrameVM {
  key: string;
  beatId: string;
  objectRef: string;
  text: string;
  levels: AnalysisLevel[];
  memberRefs: string[];
}

export interface GapVM {
  key: string;
  beatId: string;
  objectRef: string;
  text: string;
  variant: 'UNKNOWN' | 'QUESTION';
  levels: AnalysisLevel[];
}

export type HonestyNote =
  | {
      kind: 'CAPPED';
      primitive: PrimitiveKind;
      beatId: string;
      asked: string;
      drawn: string;
      levels: AnalysisLevel[];
    }
  | {
      kind: 'DROPPED';
      primitive: PrimitiveKind;
      beatId: string;
      reason: 'FRAME_THRESHOLD' | 'NO_STYLE' | 'NO_WORDS' | 'NO_ENDS';
    }
  | { kind: 'MANDATORY_ADDED'; primitive: PrimitiveKind; beatId: string };

export interface RenderState {
  anchors: AnchorVM[];
  cards: CardVM[];
  threads: ThreadVM[];
  meters: MeterVM[];
  spine: SpineMarkerVM[];
  frames: FrameVM[];
  gaps: GapVM[];
  notes: HonestyNote[];
  /** Set by presentation-only FOCUS / RETURN beats. User taps drive the same field. */
  beatDrivenFocus: string | null;
}

/** Fallback thread style per doc 05's mapping table, used only when the beat omits one. */
const THREAD_STYLE_BY_KIND: Partial<Record<BeatKind, ThreadStyle>> = {
  RECALL: 'CONNECT',
  CONNECT: 'CONNECT',
  SUPPORT: 'SUPPORT',
  CONTRADICT: 'CONTRADICT',
  CONTRAST: 'CONTRADICT',
};

/**
 * The sample fixture writes a THREAD's two ends as one `object_ref`, `"s2:s4"`. That
 * convention is not in any pack document — it is read off `06_CASE_STUDY_SAMPLE_BEATS.json`
 * and reported as an assumption. Source is the left side (the current anchor), target the
 * right (the past one), matching `directionality: "SOURCE_TO_TARGET"`.
 */
function threadEnds(objectRef: string, beat: CaseStudyBeat): [string, string] | null {
  const parts = objectRef.split(':').filter(Boolean);
  if (parts.length === 2 && parts[0] && parts[1]) return [parts[0], parts[1]];

  const from = beat.supporting_object_refs?.[0];
  const to = beat.primary_object_refs[0];
  if (from && to) return [from, to];
  return null;
}

function gapVariant(kind: BeatKind): 'UNKNOWN' | 'QUESTION' {
  return kind === 'QUESTION_FORMATION' ? 'QUESTION' : 'UNKNOWN';
}

/**
 * Doc 05's mapping table, used when a beat carries no `render` binding at all. The sample
 * fixture always carries one, so this path exists for future beats produced by a runtime
 * that has not yet been taught the binding.
 */
function fallbackPrimitives(beat: CaseStudyBeat): Array<{
  primitive: PrimitiveKind;
  object_ref: string;
  role?: PrimitiveRole;
}> {
  const primary = beat.primary_object_refs[0];
  if (!primary) return [];

  switch (beat.beat_kind) {
    case 'CAPTURE':
      return [
        { primitive: 'ANCHOR', object_ref: primary, role: 'CURRENT' },
        { primitive: 'SPINE', object_ref: primary },
      ];
    case 'RECALL':
      return [
        { primitive: 'ANCHOR', object_ref: primary, role: 'PAST' },
        { primitive: 'THREAD', object_ref: primary },
      ];
    case 'CONNECT':
    case 'SUPPORT':
    case 'CONTRADICT':
    case 'CONTRAST':
      return [{ primitive: 'THREAD', object_ref: primary }];
    case 'READING_EMERGENCE':
      return [{ primitive: 'EMERGING_FRAME', object_ref: primary, role: 'AGGREGATE' }];
    case 'UNKNOWN_OPENING':
    case 'QUESTION_FORMATION':
      return [{ primitive: 'OPEN_GAP', object_ref: primary }];
    default:
      return [];
  }
}

export function project(fixture: CaseStudyFixture, cursor: number): RenderState {
  const state: RenderState = {
    anchors: [],
    cards: [],
    threads: [],
    meters: [],
    spine: [],
    frames: [],
    gaps: [],
    notes: [],
    beatDrivenFocus: null,
  };

  const meterIndex = new Map<string, MeterVM>();
  const visible = fixture.beats.slice(0, Math.max(0, Math.min(cursor, fixture.beats.length)));

  for (const beat of visible) {
    const binding = renderBindingOf(beat);
    const levels = beat.analysis_levels_present;
    const label = beat.user_meaning.short_label;

    // FOCUS / RETURN create no primitive (doc 05) — they only move presentation state.
    if (beat.beat_kind === 'FOCUS') {
      state.beatDrivenFocus = beat.primary_object_refs[0] ?? null;
    } else if (beat.beat_kind === 'RETURN') {
      state.beatDrivenFocus = null;
    }

    const declared = binding?.primitives ?? fallbackPrimitives(beat);
    const kinds = new Set(declared.map((p) => p.primitive));

    // Every beat leaves a mark on the persistent strip; a declared SPINE primitive is the
    // beat asking for that mark to carry extra weight.
    state.spine.push({
      beatId: beat.beat_id,
      beatKind: beat.beat_kind,
      levels,
      label,
      emphasized: kinds.has('SPINE'),
    });

    for (const entry of declared) {
      const key = `${beat.beat_id}:${entry.primitive}:${entry.object_ref}`;

      switch (entry.primitive) {
        case 'ANCHOR': {
          const weight = decideAnchorWeight(binding?.anchor_weight, levels, beat.confidence);
          if (weight.capped) {
            state.notes.push({
              kind: 'CAPPED',
              primitive: 'ANCHOR',
              beatId: beat.beat_id,
              asked: weight.asked,
              drawn: weight.drawn,
              levels: [...levels],
            });
          }
          state.anchors.push({
            key,
            beatId: beat.beat_id,
            spanId: entry.object_ref,
            role: entry.role ?? 'CURRENT',
            weight,
            beatKind: beat.beat_kind,
            label,
          });
          break;
        }

        case 'CARD': {
          // Task 01 §4: a CARD renders only when the beat says the meaning must be words.
          if (!beat.user_meaning.must_show_in_words || !label) {
            state.notes.push({
              kind: 'DROPPED',
              primitive: 'CARD',
              beatId: beat.beat_id,
              reason: 'NO_WORDS',
            });
            break;
          }
          state.cards.push({
            key,
            beatId: beat.beat_id,
            objectRef: entry.object_ref,
            text: label,
            levels: [...levels],
            mandatory: beat.beat_kind === 'CONTRADICT',
          });
          break;
        }

        case 'THREAD': {
          const style = binding?.thread_style ?? THREAD_STYLE_BY_KIND[beat.beat_kind];
          if (!style) {
            state.notes.push({
              kind: 'DROPPED',
              primitive: 'THREAD',
              beatId: beat.beat_id,
              reason: 'NO_STYLE',
            });
            break;
          }
          const ends = threadEnds(entry.object_ref, beat);
          if (!ends) {
            state.notes.push({
              kind: 'DROPPED',
              primitive: 'THREAD',
              beatId: beat.beat_id,
              reason: 'NO_ENDS',
            });
            break;
          }
          state.threads.push({
            key,
            beatId: beat.beat_id,
            fromRef: ends[0],
            toRef: ends[1],
            style,
            strokeWidth: threadStrokeWidth(levels, beat.beat_kind),
            levels: [...levels],
            beatKind: beat.beat_kind,
          });
          break;
        }

        case 'METER': {
          const bindingMeter = binding?.meter_binding;
          const meterKey = bindingMeter?.meter_key ?? entry.object_ref;
          const step: MeterStepVM = {
            beatId: beat.beat_id,
            delta: bindingMeter?.delta_hint ?? 'UNCHANGED',
            // `cause_object_ref` is what makes the change traceable rather than floating.
            causeRef: bindingMeter?.cause_object_ref ?? '',
            levels: [...levels],
          };
          const existing = meterIndex.get(meterKey);
          if (existing) {
            existing.steps.push(step);
          } else {
            const meter: MeterVM = { key: `meter:${meterKey}`, meterKey, steps: [step] };
            meterIndex.set(meterKey, meter);
            state.meters.push(meter);
          }
          break;
        }

        case 'EMERGING_FRAME': {
          if (!emergingFrameThresholdMet(beat.primary_object_refs, levels)) {
            state.notes.push({
              kind: 'DROPPED',
              primitive: 'EMERGING_FRAME',
              beatId: beat.beat_id,
              reason: 'FRAME_THRESHOLD',
            });
            break;
          }
          if (!label) {
            state.notes.push({
              kind: 'DROPPED',
              primitive: 'EMERGING_FRAME',
              beatId: beat.beat_id,
              reason: 'NO_WORDS',
            });
            break;
          }
          state.frames.push({
            key,
            beatId: beat.beat_id,
            objectRef: entry.object_ref,
            text: label,
            levels: [...levels],
            memberRefs: [...beat.primary_object_refs],
          });
          break;
        }

        case 'OPEN_GAP': {
          if (!label) {
            state.notes.push({
              kind: 'DROPPED',
              primitive: 'OPEN_GAP',
              beatId: beat.beat_id,
              reason: 'NO_WORDS',
            });
            break;
          }
          state.gaps.push({
            key,
            beatId: beat.beat_id,
            objectRef: entry.object_ref,
            text: label,
            variant: gapVariant(beat.beat_kind),
            levels: [...levels],
          });
          break;
        }

        case 'SPINE':
          // Already folded into the persistent strip above.
          break;
      }
    }

    // Doc 05: on CONTRADICT the card is mandatory. If the beat forgot to declare one, the
    // engine adds it rather than letting a contradiction pass silently.
    if (beat.beat_kind === 'CONTRADICT' && !kinds.has('CARD') && label) {
      state.cards.push({
        key: `${beat.beat_id}:CARD:mandatory`,
        beatId: beat.beat_id,
        objectRef: beat.primary_object_refs[0] ?? '',
        text: label,
        levels: [...levels],
        mandatory: true,
      });
      state.notes.push({ kind: 'MANDATORY_ADDED', primitive: 'CARD', beatId: beat.beat_id });
    }
  }

  return state;
}
