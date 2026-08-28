// QHIA-005 Session Reflection Consumption v1.
//
// Server-owned deterministic conversational-exploration guidance derived from
// the validated one-metric CONVERSATION_SESSION Reflection selection
// (hbs.reflection@1, read through the QHIA-004 selective current-intelligence
// boundary). Reflection measures context-bound deliberate reflective
// engagement as a process, never an outcome: this guidance is NOT an insight,
// wisdom, intelligence, self-awareness, or mindfulness score, NOT a
// rumination/overthinking diagnosis, NOT a Safety, Question Runtime,
// Recommendation, Hypothesis, Trend, or FAST/DEEP routing authority, and its
// direction carries no valence - higher is not better and lower is not worse.

export type HimSessionReflectionDirective =
  | 'DEFAULT'
  | 'GENTLE_REFLECTION_INVITATION'
  | 'AVOID_REDUNDANT_REFLECTION';

export interface HimSessionReflectionGuidance {
  contractVersion: 1;
  guidanceState: 'NONE' | 'ACTIVE';
  directive: HimSessionReflectionDirective;
}
