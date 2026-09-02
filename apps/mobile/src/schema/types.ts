/**
 * Types transcribed from `qandeel_analysis_schema_pack` (WORKING DRAFT — NOT CANONICAL):
 *   01_ANALYSIS_EVENT_SCHEMA_WORKING_DRAFT.md
 *   02_ANALYSIS_BEAT_SCHEMA_WORKING_DRAFT.md
 *   03_ANALYSIS_OBJECT_ENVELOPE_WORKING_DRAFT.md
 *   05_BEAT_TO_VISUAL_PRIMITIVE_MAPPING.md
 *
 * Where this file departs from the pack, the comment says so and the departure is
 * repeated in the task report. Nothing here invents a new top-level field silently.
 */

export type AnalysisLevel = 'OBSERVED' | 'DERIVED' | 'INFERRED';

export type BeatKind =
  | 'CAPTURE'
  | 'RECALL'
  | 'CONNECT'
  | 'CONTRAST'
  | 'SUPPORT'
  | 'CONTRADICT'
  | 'READING_EMERGENCE'
  | 'UNKNOWN_OPENING'
  | 'QUESTION_FORMATION'
  | 'FOCUS'
  | 'RETURN'
  | 'REPLAY_HIGHLIGHT';

export type PrimitiveKind =
  | 'ANCHOR'
  | 'CARD'
  | 'THREAD'
  | 'METER'
  | 'SPINE'
  | 'EMERGING_FRAME'
  | 'OPEN_GAP';

export type PrimitiveRole = 'CURRENT' | 'PAST' | 'AGGREGATE';

export type AnchorWeight = 'LOW' | 'MEDIUM' | 'HIGH';

export type ThreadStyle = 'SUPPORT' | 'CONTRADICT' | 'EVOLVE' | 'CONNECT';

export type DeltaHint = 'UP' | 'DOWN' | 'UNCHANGED';

/** `05_BEAT_TO_VISUAL_PRIMITIVE_MAPPING.md` — additive on `AnalysisBeat.presentation`. */
export interface VisualRenderBinding {
  primitives: Array<{
    primitive: PrimitiveKind;
    object_ref: string;
    role?: PrimitiveRole;
  }>;
  anchor_weight?: AnchorWeight;
  thread_style?: ThreadStyle;
  meter_binding?: {
    meter_key: string;
    delta_hint: DeltaHint;
    cause_object_ref: string;
  };
}

/** `03_ANALYSIS_OBJECT_ENVELOPE_WORKING_DRAFT.md` — the confidence sub-object only. */
export interface EnvelopeConfidence {
  available: boolean;
  score?: number;
  band?: string;
}

export interface BeatUserMeaning {
  short_label?: string;
  must_show_in_words: boolean;
  text_refs?: string[];
}

export interface BeatSemantics {
  relation_types: string[];
  directionality?: 'NONE' | 'SOURCE_TO_TARGET' | 'BIDIRECTIONAL';
  temporal_semantics?: string;
  strength_semantics: 'NONE' | string;
}

export type MotionIntent =
  | 'REVEAL'
  | 'RECALL'
  | 'FOCUS'
  | 'RETURN'
  | 'VIEWPORT_ADAPTATION'
  | 'BINARY_NARRATION_EMPHASIS';

export interface BeatPresentation {
  live_eligible: boolean;
  replay_eligible: boolean;
  object_permanence_key?: string;
  allowed_motion_intents: MotionIntent[];
  forbidden_implications: string[];
  /** Added by doc 05. */
  render?: VisualRenderBinding;
}

/** The full candidate shape from doc 02, for reference and for future runtime wiring. */
export interface AnalysisBeat {
  beat_id: string;
  schema_version: string;
  conversation_id: string;
  event_ids: string[];
  beat_kind: BeatKind;
  start_offset_ms?: number;
  end_offset_ms?: number;
  primary_object_refs: string[];
  supporting_object_refs: string[];
  analysis_levels_present: AnalysisLevel[];
  user_meaning: BeatUserMeaning;
  semantics: BeatSemantics;
  presentation: BeatPresentation;
  lifecycle: {
    stable: boolean;
    reversible: boolean;
    superseded_by_beat_id?: string;
  };
}

/**
 * What `06_CASE_STUDY_SAMPLE_BEATS.json` actually carries: a reduced `AnalysisBeat`.
 * `semantics`, `presentation`, `lifecycle`, `schema_version`, `conversation_id` and the
 * offset fields are absent from every beat in the fixture, and `render` sits at the beat
 * root rather than under `presentation` as doc 05 specifies. Both placements are read.
 */
export interface CaseStudyBeat {
  beat_id: string;
  beat_kind: BeatKind;
  event_ids?: string[];
  primary_object_refs: string[];
  supporting_object_refs?: string[];
  analysis_levels_present: AnalysisLevel[];
  user_meaning: BeatUserMeaning;
  render?: VisualRenderBinding;
  presentation?: Partial<BeatPresentation>;
  /** Not present in the sample fixture; read when a future fixture supplies it. */
  confidence?: EnvelopeConfidence;
  semantics?: Partial<BeatSemantics>;
}

export interface TranscriptSpan {
  span_id: string;
  text: string;
}

export interface CaseStudyEvent {
  event_id: string;
  event_type: string;
  analysis_level: AnalysisLevel;
  source_span_ids: string[];
}

export interface CaseStudyFixture {
  schema_version: string;
  conversation_id: string;
  transcript: TranscriptSpan[];
  events: CaseStudyEvent[];
  beats: CaseStudyBeat[];
}

/** Doc 05 puts `render` under `presentation`; the sample fixture puts it at the root. */
export function renderBindingOf(beat: CaseStudyBeat): VisualRenderBinding | undefined {
  return beat.render ?? beat.presentation?.render;
}
