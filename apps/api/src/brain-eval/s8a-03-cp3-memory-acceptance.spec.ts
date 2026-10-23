import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { memoryRetrievalTerms } from '../memory/memory-retrieval-terms';
import { capturableMessage } from '../personal-understanding/personal-understanding-capture.service';
import { REPOSITORY_ROOT } from './brain-eval.paths';

// S8A-03 CP3 — the Focused Real-Model Memory Acceptance harness (scripts/s8a-03), pinned before the one paid run. Founder CP3
// Final Preparation Approval, 2026-10-23: 14 fixed cases, 41 attempts and USD 0.15 at most, no retries; the case set never
// changes once fixed. Every check here is deterministic and makes no provider call.
const read = (...path: string[]) => readFileSync(join(REPOSITORY_ROOT, ...path), 'utf8');
const suite = JSON.parse(read('scripts', 's8a-03', 'cp3-cases.json'));
/** The canonical hash PREREGISTRATION_CP3.md records (the parsed content, so a checkout's line endings cannot move it). */
const CP3_CASES_SHA256 = '9b6ec9be3ed6842db28de0f7be708fa699ae9b4b0c4fd0f544ee24ec728773e2';

describe('S8A-03 CP3 memory acceptance harness', () => {
  it('the case set is exactly the preregistered one', () => {
    expect(createHash('sha256').update(JSON.stringify(suite)).digest('hex')).toBe(CP3_CASES_SHA256);
    expect(suite.cases.map((testCase: { id: string }) => testCase.id)).toEqual(
      ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'C12', 'C13', 'C14']);
  });

  it('carries the preregistered criteria: 17 key facts, 13 retrieval checks (C07 mandatory), 10 graded replies', () => {
    const cases = suite.cases as Array<Record<string, any>>;
    expect(cases.flatMap((testCase) => testCase.keyFacts ?? [])).toHaveLength(17);
    const retrieval = cases.flatMap((testCase) => (testCase.retrieval ?? []).filter((check: { targets: string[] }) => check.targets.length > 0)
      .map((check: Record<string, unknown>) => ({ id: testCase.id, ...check })));
    expect(retrieval).toHaveLength(13);
    expect(retrieval.filter((check) => check.mandatory)).toEqual([expect.objectContaining({ id: 'C07', outsideRecent32: true })]);
    expect(cases.filter((testCase) => testCase.reply).map((testCase) => testCase.id)).toEqual(['C01', 'C04', 'C05', 'C07', 'C08', 'C10', 'C11', 'C12', 'C13', 'C14']);
    // C07: more filler Memories than the recent window, so the squash Memory can be found only through the index.
    expect(suite.fillers).toHaveLength(34);
  });

  it('asks every question in a new session B, after the acquisition and control turns of session A', () => {
    for (const testCase of suite.cases) {
      const sessions = testCase.turns.map((turn: { session: string }) => turn.session).join('');
      expect(sessions).toMatch(/^A+B*$/u);
      for (const turn of testCase.turns) expect(Boolean(turn.question)).toBe(turn.session === 'B');
    }
  });

  it('fits the call cap exactly: one capture at most per turn plus one real reply per graded question = 41', () => {
    const turns = suite.cases.flatMap((testCase: { turns: unknown[] }) => testCase.turns);
    expect(turns).toHaveLength(31);
    expect(turns.filter((turn: { graded?: boolean }) => turn.graded)).toHaveLength(10);
  });

  it('the preregistered deterministic facts still hold: the pre-screen and the question terms (PREREGISTRATION §3)', () => {
    const notSent = suite.cases.flatMap((testCase: { id: string; turns: Array<{ text: string; session: string }> }) =>
      testCase.turns.flatMap((turn, index) => (capturableMessage(turn.text) === null ? [`${testCase.id}/${index + 1}`] : [])));
    expect(notSent).toEqual(['C03/2', 'C10/2', 'C11/2']);
    const terms = Object.fromEntries(suite.cases.map((testCase: { id: string; turns: Array<{ text: string; question?: boolean }> }) =>
      [testCase.id, testCase.turns.filter((turn) => turn.question).map((turn) => memoryRetrievalTerms(turn.text))]));
    expect(terms).toEqual({
      C01: [['مهنت']], C02: [['كام', 'عيل']], C03: [['تعلم', 'لغه', 'حاليا']], C04: [['ظيفت']], C05: [['شرب', 'سجاير']], C06: [],
      C07: [['مارس', 'رياض']], C08: [['ظيفت', 'حالي'], ['معلم', 'عيال']], C09: [['شغلانت']], C10: [['عايش']], C11: [['شتغل']],
      C12: [['شتغل']], C13: [['مرب', 'حيوان', 'اليف']], C14: [['مقيم', 'انه', 'مدين']],
    });
  });

  it('the guard holds round 11 at 41 attempts and USD 0.15 (lock lifted for the one paid run, Founder authorization 2026-10-23)', () => {
    const caps = /const ROUND_CAPS = \{([\s\S]*?)\} \};/u.exec(read('scripts', 's8a-02', 'network-guard.cjs'))?.[1] ?? '';
    expect(caps).toMatch(/\b11: \{ maxAttempts: 41, costCapUsd: 0\.15 $/u);
    const driver = read('scripts', 's8a-03', 'cp3-memory-acceptance.ts');
    expect(driver).toContain('const MAX_ATTEMPTS = 41;');
    expect(driver).toContain('const COST_CAP_USD = 0.15;');
    const launcher = read('scripts', 's8a-03', 'cp3-launch.mjs');
    expect(launcher).toContain('const ROUND = 11;');
    expect(launcher).toContain("if (dirty && live) refuse('tracked changes are present; the code under test must be a commit');");
  });
});
