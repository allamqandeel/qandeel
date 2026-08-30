import {
  RUNTIME_ROUTING_POLICY_VERSION,
  type RuntimeRoutingDecision,
  type RuntimeRoutingPath,
  type RuntimeRoutingSignals,
  type RuntimeRoutingV2Reason,
} from './fast-deep-routing-contract';

// QIR-002 — FAST / DEEP Runtime Decision Policy v2.
//
// Replaces the pre-QIR-002 `content.length >= 1000` rule with a deterministic,
// explainable, Unicode-aware, provider-neutral structural policy.
//
// HARD BOUNDARY. `decideFastDeepRoute` is synchronous, deterministic, CPU-only
// and side-effect-free. It contains no async/await, Promise, timer, database,
// network, Redis, provider, model-registry, Memory, HIM, Hypothesis,
// Confidence, Recommendation, Question, Safety or telemetry call, reads no
// ambient state, and mutates nothing — including the canonical user content,
// which is normalized only into a local analysis string.
//
// NOT SEMANTICS. The signals are structural counts, never understanding. This
// policy performs no sentiment, stakes, emotion, urgency, risk, diagnosis,
// personality, clinical or intent inference, consults no keyword list, and uses
// no classifier, embedding or vendor tokenizer. FAST/DEEP remains EXECUTION
// authority only: the chosen path grants no subsystem semantic authority and
// the reason is explanatory metadata, never a truth, Safety or product claim.

/** Any input at or above this many code points is DEEP unconditionally. */
const DEEP_INPUT_SCALE_CODE_POINTS = 1000;
/** Input-scale point bands. */
const INPUT_SCALE_BANDS = Object.freeze([300, 600, DEEP_INPUT_SCALE_CODE_POINTS] as const);
/** A turn is DEEP at or above this composite structural score. */
const DEEP_COMPLEXITY_SCORE = 3;

/** Exactly `?` (U+003F) and Arabic question mark `؟` (U+061F). Nothing else. */
const QUESTION_MARKS: ReadonlySet<string> = new Set(['?', '؟']);

/**
 * Logical-unit separators: `.` `!` `?` `؟` `;` `؛` `…` and newline. Runs of one
 * or more separators split once, so `?!` or `...` is a single boundary.
 */
const LOGICAL_UNIT_SEPARATORS = /[.!?؟;؛…\r\n]+/u;

/**
 * Provider-neutral normalization for ANALYSIS ONLY. Unicode NFC so canonically
 * equivalent inputs decide identically, then Unicode whitespace trimmed. The
 * canonical user content is never mutated: this returns a new local string.
 */
function normalizeForRouting(content: string): string {
  return content.normalize('NFC').trim();
}

function readSignals(normalized: string): RuntimeRoutingSignals {
  // Array.from iterates CODE POINTS, so a surrogate pair (emoji, astral script)
  // counts as one, not two UTF-16 code units.
  const codePoints = Array.from(normalized);
  let questionCount = 0;
  for (const codePoint of codePoints) if (QUESTION_MARKS.has(codePoint)) questionCount += 1;
  const logicalUnitCount = normalized
    .split(LOGICAL_UNIT_SEPARATORS)
    .filter((unit) => unit.trim().length > 0).length;
  return Object.freeze({ codePointCount: codePoints.length, questionCount, logicalUnitCount });
}

/** <300 -> 0, 300-599 -> 1, 600-999 -> 2, >=1000 -> 3. */
function inputScalePoints(codePointCount: number): number {
  let points = 0;
  for (const band of INPUT_SCALE_BANDS) if (codePointCount >= band) points += 1;
  return points;
}

/** <2 -> 0, exactly 2 -> 1, >=3 -> 2. */
function questionPoints(questionCount: number): number {
  if (questionCount >= 3) return 2;
  return questionCount === 2 ? 1 : 0;
}

/** <4 -> 0, 4-6 -> 1, >=7 -> 2. */
function logicalBreadthPoints(logicalUnitCount: number): number {
  if (logicalUnitCount >= 7) return 2;
  return logicalUnitCount >= 4 ? 1 : 0;
}

/**
 * DEEP reason precedence, applied in this exact order and no other:
 *   1. raw input scale, 2. multi-question, 3. multi-part, 4. composite.
 */
function deepReason(codePointCount: number, questions: number, breadth: number): RuntimeRoutingV2Reason {
  if (codePointCount >= DEEP_INPUT_SCALE_CODE_POINTS) return 'RUNTIME_ROUTING_V2_DEEP_INPUT_SCALE';
  if (questions >= 2) return 'RUNTIME_ROUTING_V2_DEEP_MULTI_QUESTION';
  if (breadth >= 2) return 'RUNTIME_ROUTING_V2_DEEP_MULTI_PART';
  return 'RUNTIME_ROUTING_V2_DEEP_COMPOSITE';
}

/**
 * The one FAST/DEEP decision function. Pure, synchronous, deterministic.
 *
 * DEEP when EITHER the raw input reaches 1000 CODE POINTS OR the bounded
 * structural complexity score reaches 3. Otherwise FAST.
 *
 * The retired policy thresholded JavaScript UTF-16 `content.length`, so it is
 * SUPERSEDED, not reproduced: `'\u{1F600}'.repeat(500)` has `.length === 1000`
 * and was routed DEEP by the old rule, while v2 correctly counts 500 code
 * points and routes it by the v2 policy. That divergence on surrogate-pair
 * input is the intended Unicode correction. The v2 invariant is only that every
 * input with `codePointCount >= 1000` is unconditionally DEEP.
 */
export function decideFastDeepRoute(content: string): RuntimeRoutingDecision {
  const signals = readSignals(normalizeForRouting(content));
  const questions = questionPoints(signals.questionCount);
  const breadth = logicalBreadthPoints(signals.logicalUnitCount);
  const complexityScore = inputScalePoints(signals.codePointCount) + questions + breadth;
  const deep = signals.codePointCount >= DEEP_INPUT_SCALE_CODE_POINTS || complexityScore >= DEEP_COMPLEXITY_SCORE;
  const path: RuntimeRoutingPath = deep ? 'DEEP' : 'FAST';
  return Object.freeze({
    policyVersion: RUNTIME_ROUTING_POLICY_VERSION,
    path,
    reason: deep
      ? deepReason(signals.codePointCount, questions, breadth)
      : ('RUNTIME_ROUTING_V2_FAST_DEFAULT' as const),
    complexityScore,
    signals,
  });
}
