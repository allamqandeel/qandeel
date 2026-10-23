import { execFileSync } from 'node:child_process';
import { BehavioralResponsePolicyService } from '../conversation/behavioral-response-policy.service';
import { resolveConversationLocale } from '../conversation/conversation-turn-locale';
import { SafetyResponseGateService } from '../conversation/safety-response-gate.service';
import {
  DEFAULT_INTERACTION_PREFERENCES, INTERACTION_PREFERENCE_VALUES, PREFERENCE_KEY, type InteractionPreferences,
} from '../interaction-preferences/interaction-preferences.types';
import { evaluationGuidance, evaluationSafetyGuidance, expectedRequestCount } from './brain-eval.harness';
import { REPOSITORY_ROOT } from './brain-eval.paths';
import { EVALUATION_PRICING } from './brain-eval.pricing';
import { worldCurrentMessage, worldEvaluationRequest } from './brain-eval.worlds';
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
  const { covered, negativeControls } = assertGoldenCases(cases);
  const missing = STYLE_FOCUS.filter((focus) => !covered.has(focus));
  if (missing.length) throw new Error(`The Golden suite does not cover: ${missing.join(', ')}.`);
  if (negativeControls < MIN_GOLDEN_NEGATIVE_CONTROLS) throw new Error('The Golden suite needs explicit negative controls.');
  return report;
}

/** The structural truths every Golden case holds, case by case (ids, focus, canonical preferences, Safety, World input). */
function assertGoldenCases(cases: ReadonlyArray<BrainEvaluationCase>): { covered: Set<string>; negativeControls: number } {
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
    const current = testCase.world === undefined ? testCase.context.at(-1)?.content ?? '' : worldCurrentMessage(testCase);
    const disposition = gate.evaluate(current, testCase.context).disposition;
    if (disposition !== (testCase.safety === 'GUIDED' ? 'GUIDED' : 'ALLOW')) throw new Error(`${testCase.id}: the production Safety gate decides ${disposition}.`);
    evaluationSafetyGuidance(testCase);
    if (testCase.world !== undefined) {
      // S8A-02: a World case is exactly what that World's assembler sends: no Personal preference, `und`, same context.
      if (testCase.interactionPreferences !== undefined) throw new Error(`${testCase.id}: a World case carries no Personal preference.`);
      const request = worldEvaluationRequest(testCase, evaluationSafetyGuidance(testCase));
      if (testCase.locale !== 'und' || request.locale !== 'und') throw new Error(`${testCase.id}: a World case has the World locale und.`);
      if (JSON.stringify(request.context) !== JSON.stringify(testCase.context)) throw new Error(`${testCase.id}: context differs from the ${testCase.world.kind} assembler's.`);
    } else if (testCase.locale !== resolveConversationLocale({ currentUserContent: current, preferences })) {
      // The case locale is the production locale for that turn (ACE-01 WP2), never a hand-picked dialect.
      throw new Error(`${testCase.id}: locale differs from the production locale.`);
    }
    if (!evaluationGuidance(testCase).trim()) throw new Error(`${testCase.id}: empty production guidance.`);
  }
  return { covered, negativeControls };
}

/**
 * S8A-02 Round 2 — a targeted Golden suite: every per-case Golden truth and the shared validator's checks, but not the full
 * style-focus coverage a complete Golden suite must show (a targeted round covers what was weak, by design). It runs only on
 * the DeepSeek-only path, so one run of it is one request per case per repeat (not the historical two-provider count).
 */
export function validateGoldenTargetedSuite(cases: ReadonlyArray<BrainEvaluationCase>): ValidationReport {
  const report = validateEvaluationSuite(cases);
  assertGoldenCases(cases);
  return { ...report, expectedPaidRequests: cases.length };
}

/**
 * S8A-02 Round 2 — the FAST / DEEP pairs: each stem exactly once on each path, with identical content, so the only
 * difference between the two replies is the path. Fewer than 20 cases by design; every per-case Golden truth still holds.
 */
export function validateGoldenPathPairSuite(cases: ReadonlyArray<BrainEvaluationCase>): ValidationReport {
  const ids = new Set(cases.map((testCase) => testCase.id));
  if (ids.size !== cases.length) throw new Error('Duplicate case id in the path-pair suite.');
  const stems = new Map<string, BrainEvaluationCase[]>();
  for (const testCase of cases) {
    const match = /^(fast|deep)-golden-pathcmp-([a-z0-9-]+)$/u.exec(testCase.id);
    if (match === null) throw new Error(`${testCase.id} is not a path-pair case id.`);
    if (!testCase.reviewNotes.length || testCase.context.at(-1)?.role !== 'USER') throw new Error(`${testCase.id} needs review notes and a USER-final context.`);
    stems.set(match[2], [...(stems.get(match[2]) ?? []), testCase]);
  }
  for (const [stem, pair] of stems) {
    const paths = pair.map((testCase) => testCase.path).sort().join(',');
    if (paths !== 'DEEP,FAST') throw new Error(`${stem}: needs exactly one FAST and one DEEP case.`);
    const [first, second] = pair;
    const { id: _a, path: _b, ...firstRest } = first;
    const { id: _c, path: _d, ...secondRest } = second;
    void _a; void _b; void _c; void _d;
    if (JSON.stringify(firstRest) !== JSON.stringify(secondRest)) throw new Error(`${stem}: the FAST and DEEP cases differ in more than the path.`);
  }
  assertGoldenCases(cases);
  return {
    caseCount: cases.length, fastCount: cases.filter(({ path }) => path === 'FAST').length, deepCount: cases.filter(({ path }) => path === 'DEEP').length,
    expectedPaidRequests: cases.length, warnings: [],
  };
}

/**
 * S8A-02 (Product Owner D3) — the DeepSeek-only paid run: synthetic qualification mode, never production, the guard preload
 * in place, no other provider's key in the process, and the explicit paid-evaluation switch. The key's value is never read here.
 */
export function assertDeepSeekRunAllowed(environment: NodeJS.ProcessEnv, guardPreloaded: boolean): void {
  if (environment.QANDEEL_ALLOW_PAID_EVAL !== '1') throw new Error('NOT RUN: QANDEEL_ALLOW_PAID_EVAL=1 is required. No paid evaluation ran.');
  if (environment.NODE_ENV === 'production') throw new Error('NOT RUN: DeepSeek is qualification-only and never runs in production.');
  if (environment.DEEPSEEK_QUALIFICATION_MODE?.trim() !== 'SYNTHETIC_ONLY') throw new Error('NOT RUN: DEEPSEEK_QUALIFICATION_MODE=SYNTHETIC_ONLY is required.');
  if (!environment.DEEPSEEK_API_KEY?.trim()) throw new Error('NOT RUN: DEEPSEEK_API_KEY is required. No provider calls were made.');
  const others = Object.keys(environment).filter((name) => /^(?:OPENAI|ANTHROPIC|GEMINI|GOOGLE)_/u.test(name));
  if (others.length) throw new Error(`NOT RUN: another provider's variables are present (${others.join(', ')}); this run is DeepSeek only.`);
  if (!guardPreloaded) throw new Error('NOT RUN: the S8A-02 network and spend guard (scripts/s8a-02/network-guard.cjs) is not preloaded.');
}

/**
 * S8A-02 CP3 — the Personal qualification suite: up to the 44 approved Golden cases, each on its production route. The same
 * per-case truths as every Golden suite (stable unique ids, USER-final contexts, review notes, canonical preferences, the
 * production Safety gate's decision); no coverage floor, because the set is fixed by the preregistration, not grown.
 */
export function validateGoldenQualificationSuite(cases: ReadonlyArray<BrainEvaluationCase>): ValidationReport {
  if (cases.length < 1 || cases.length > 44) throw new Error('The qualification suite holds 1-44 cases.');
  const ids = new Set<string>();
  for (const testCase of cases) {
    if (ids.has(testCase.id)) throw new Error(`Duplicate case id: ${testCase.id}`);
    ids.add(testCase.id);
    if (!testCase.context.length || testCase.context.at(-1)?.role !== 'USER') throw new Error(`${testCase.id} must end in a USER message.`);
    if (!testCase.reviewNotes.length) throw new Error(`${testCase.id} requires human-review notes.`);
    if (testCase.world !== undefined) throw new Error(`${testCase.id}: the qualification suite is Personal only.`);
  }
  assertGoldenCases(cases);
  return {
    caseCount: cases.length, fastCount: cases.filter(({ path }) => path === 'FAST').length, deepCount: cases.filter(({ path }) => path === 'DEEP').length,
    expectedPaidRequests: cases.length, warnings: [],
  };
}

/**
 * S8A-02 Round 3 — a focused Golden suite: a handful of cases on one rule set, below the 20–30 bound by design. It keeps the
 * shared per-case checks (stable unique ids, USER-final contexts, review notes) and every per-case Golden truth.
 */
export function validateGoldenFocusedSuite(cases: ReadonlyArray<BrainEvaluationCase>): ValidationReport {
  if (cases.length < 1 || cases.length > 12) throw new Error('A focused suite holds 1-12 cases.');
  const ids = new Set<string>();
  for (const testCase of cases) {
    if (!/^(fast|deep)-[a-z0-9-]+$/u.test(testCase.id)) throw new Error(`Invalid stable case id: ${testCase.id}`);
    if (ids.has(testCase.id)) throw new Error(`Duplicate case id: ${testCase.id}`);
    ids.add(testCase.id);
    if (!testCase.context.length || testCase.context.at(-1)?.role !== 'USER') throw new Error(`${testCase.id} must end in a USER message.`);
    if (!testCase.reviewNotes.length) throw new Error(`${testCase.id} requires human-review notes.`);
  }
  assertGoldenCases(cases);
  return {
    caseCount: cases.length, fastCount: cases.filter(({ path }) => path === 'FAST').length, deepCount: cases.filter(({ path }) => path === 'DEEP').length,
    expectedPaidRequests: cases.length, warnings: [],
  };
}
