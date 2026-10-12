import { execFileSync } from 'node:child_process';
import { BehavioralResponsePolicyService } from '../conversation/behavioral-response-policy.service';
import { CLAUDE_MAX_OUTPUT_TOKENS, CLAUDE_MAX_RETRIES } from '../model-router/providers/anthropic/claude-model-router.config';
import { OPENAI_MAX_OUTPUT_TOKENS, OPENAI_MAX_RETRIES } from '../model-router/providers/openai/openai-model-router.config';
import { resolveConversationLocale } from '../conversation/conversation-turn-locale';
import { SafetyResponseGateService } from '../conversation/safety-response-gate.service';
import {
  DEFAULT_INTERACTION_PREFERENCES, INTERACTION_PREFERENCE_VALUES, PREFERENCE_KEY, type InteractionPreferences,
} from '../interaction-preferences/interaction-preferences.types';
import { evaluationGuidance, evaluationSafetyGuidance, expectedRequestCount } from './brain-eval.harness';
import { REPOSITORY_ROOT } from './brain-eval.paths';
import { EVALUATION_PRICING } from './brain-eval.pricing';
import { GOLDEN_CONVERSATION_RUBRIC, RUBRIC, STYLE_FOCUS, type BrainEvaluationCase } from './brain-eval.types';

export interface ValidationReport { caseCount: number; fastCount: number; deepCount: number; expectedPaidRequests: number; warnings: string[] }

export function validateEvaluationSuite(cases: ReadonlyArray<BrainEvaluationCase>): ValidationReport {
  if (cases.length < 20 || cases.length > 30) throw new Error('Evaluation suite must contain 20-30 cases.');
  const ids = new Set<string>();
  for (const testCase of cases) {
    if (!/^(fast|deep)-[a-z0-9-]+$/u.test(testCase.id)) throw new Error(`Invalid stable case id: ${testCase.id}`);
    if (ids.has(testCase.id)) throw new Error(`Duplicate case id: ${testCase.id}`);
    ids.add(testCase.id);
    if (!testCase.context.length || testCase.context.at(-1)?.role !== 'USER') throw new Error(`${testCase.id} must end in a USER message.`);
    if (!testCase.reviewNotes.length) throw new Error(`${testCase.id} requires human-review notes.`);
  }
  if (!new BehavioralResponsePolicyService().buildTextGuidance().trim()) throw new Error('Production Behavioral Response Policy returned empty guidance.');
  if (CLAUDE_MAX_OUTPUT_TOKENS !== OPENAI_MAX_OUTPUT_TOKENS) throw new Error('Provider output token bounds differ.');
  if (CLAUDE_MAX_RETRIES !== 0 || OPENAI_MAX_RETRIES !== 0) throw new Error('Evaluation requires zero hidden retries.');
  const ignored = execFileSync('git', ['-C', REPOSITORY_ROOT, 'check-ignore', '-q', 'artifacts/evals/probe.json'], { stdio: 'ignore' });
  void ignored;
  const warnings = Object.values(EVALUATION_PRICING).flatMap((paths) => Object.values(paths)).filter((price) => !price.verified).map((price) => price.note);
  return {
    caseCount: cases.length,
    fastCount: cases.filter(({ path }) => path === 'FAST').length,
    deepCount: cases.filter(({ path }) => path === 'DEEP').length,
    expectedPaidRequests: expectedRequestCount(cases),
    warnings: [...new Set(warnings)],
  };
}

/** Minimum Golden cases whose expected behaviour is an explicit FAIL condition (negative controls, P8). */
export const MIN_GOLDEN_NEGATIVE_CONTROLS = 4;

const isDefault = (preferences: InteractionPreferences) =>
  (Object.keys(PREFERENCE_KEY) as Array<keyof typeof PREFERENCE_KEY>).every((field) => preferences[PREFERENCE_KEY[field]] === 'DEFAULT');

/**
 * ACE-01 (WP3) — the Golden Conversations suite: everything the shared validator checks (the 20–30 bound, stable ids,
 * USER-final contexts, review notes, production guidance, zero hidden retries, git-ignored artifacts), plus the
 * structural truths a Golden case must hold before Stage 8A may score it. Deterministic; it constructs no provider.
 */
export function validateGoldenConversationSuite(cases: ReadonlyArray<BrainEvaluationCase>): ValidationReport {
  const report = validateEvaluationSuite(cases);
  if (GOLDEN_CONVERSATION_RUBRIC.length !== RUBRIC.length + 4 || !RUBRIC.every((name, index) => GOLDEN_CONVERSATION_RUBRIC[index] === name)) {
    throw new Error('The Golden rubric must keep the nine shared dimensions, in order, and add exactly four.');
  }
  const covered = new Set<string>();
  let negativeControls = 0;
  const gate = new SafetyResponseGateService();
  for (const testCase of cases) {
    if (!/^(fast|deep)-golden-[a-z0-9-]+$/u.test(testCase.id)) throw new Error(`${testCase.id} is not a Golden case id.`);
    if (!testCase.styleFocus?.length) throw new Error(`${testCase.id} requires a styleFocus.`);
    for (const focus of testCase.styleFocus) {
      if (!(STYLE_FOCUS as readonly string[]).includes(focus)) throw new Error(`${testCase.id} has an unknown styleFocus ${focus}.`);
      covered.add(focus);
    }
    const preferences = testCase.interactionPreferences ?? DEFAULT_INTERACTION_PREFERENCES;
    for (const [field, key] of Object.entries(PREFERENCE_KEY) as Array<[keyof typeof INTERACTION_PREFERENCE_VALUES, keyof InteractionPreferences]>) {
      if (!(INTERACTION_PREFERENCE_VALUES[field] as readonly string[]).includes(preferences[key])) throw new Error(`${testCase.id} carries a non-canonical ${field}.`);
    }
    // A declared preference is canonical authority, never a line of dialogue.
    if (testCase.styleFocus.includes('DECLARED_PREFERENCES') === isDefault(preferences)) {
      throw new Error(`${testCase.id}: DECLARED_PREFERENCES requires, and only allows, a non-DEFAULT canonical preference.`);
    }
    if (testCase.styleFocus.includes('NEGATIVE_CONTROL')) {
      negativeControls += 1;
      if (!testCase.reviewNotes.some((note) => note.startsWith('FAIL if '))) throw new Error(`${testCase.id} is a negative control without an explicit FAIL condition.`);
    }
    // Safety is the production gate's decision: GUIDED exactly where labelled, never BLOCK (BLOCK never reaches a model).
    const current = testCase.context.at(-1)?.content ?? '';
    const disposition = gate.evaluate(current, testCase.context).disposition;
    if (disposition !== (testCase.safety === 'GUIDED' ? 'GUIDED' : 'ALLOW')) throw new Error(`${testCase.id}: the production Safety gate decides ${disposition}.`);
    evaluationSafetyGuidance(testCase);
    // The case locale is the production locale for that turn (ACE-01 WP2), never a hand-picked dialect.
    if (testCase.locale !== resolveConversationLocale({ currentUserContent: current, preferences })) throw new Error(`${testCase.id}: locale differs from the production locale.`);
    if (!evaluationGuidance(testCase).trim()) throw new Error(`${testCase.id}: empty production guidance.`);
  }
  const missing = STYLE_FOCUS.filter((focus) => !covered.has(focus));
  if (missing.length) throw new Error(`The Golden suite does not cover: ${missing.join(', ')}.`);
  if (negativeControls < MIN_GOLDEN_NEGATIVE_CONTROLS) throw new Error('The Golden suite needs explicit negative controls.');
  return report;
}

export function assertPaidRunAllowed(environment: NodeJS.ProcessEnv): void {
  if (environment.QANDEEL_ALLOW_PAID_EVAL !== '1') throw new Error('NOT RUN: QANDEEL_ALLOW_PAID_EVAL=1 is required. No paid evaluation ran.');
  if (!environment.ANTHROPIC_API_KEY?.trim()) throw new Error('NOT RUN: ANTHROPIC_API_KEY is required. No provider calls were made.');
  if (!environment.OPENAI_API_KEY?.trim()) throw new Error('NOT RUN: OPENAI_API_KEY is required. No provider calls were made.');
}
