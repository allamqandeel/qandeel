// INTEL-LIVE-01 CP1 — the iOS World gate's impact analysis (PO direction of 2026-11-25 on the CP1 resolution; backlog
// BG-10 clarification): the gate runs whenever a change can reach what it proves, is skipped only on a literal
// NOT_AFFECTED, and every doubt answers RUN. The gate's suites, cases and assertions are not touched here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseModule, planWorldGate, protectedClosure, PROTECTED_ROOTS } from '../scripts/cosmos-ios-world/world-gate-impact.mjs';
import { references } from '../scripts/validation/change-planner.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const decide = (files, closure = new Set()) => planWorldGate(files, { closure });

test('the module graph follows runtime imports only, and barrels per symbol', () => {
  const m = parseModule(`
    import type { A } from './types';
    import { type B, C, D as E } from './c';
    import F, { G } from './f';
    import * as NS from './ns';
    import './side';
    export type { T } from './t';
    export { H, I as J } from './h';
    export * from './star';
    export * as K from './k';
    export const L = 1;
    export function M() { return require('./req'); }
    // import { Nope } from './commented';
  `);
  const imports = Object.fromEntries(m.imports.map((i) => [i.spec, i.names === 'ALL' ? 'ALL' : [...i.names].sort()]));
  assert.equal(imports['./types'], undefined, 'a type-only import carries no runtime code');
  assert.deepEqual(imports['./c'], ['C', 'D']);
  assert.deepEqual(imports['./f'], ['G', 'default']);
  assert.equal(imports['./ns'], 'ALL');
  assert.equal(imports['./side'], 'ALL');
  assert.equal(imports['./req'], 'ALL');
  assert.equal(imports['./commented'], undefined);
  assert.ok(!m.reexports.some((r) => r.spec === './t'), 'a type-only re-export is not followed');
  const h = m.reexports.find((r) => r.spec === './h');
  assert.deepEqual([...h.map.entries()], [['H', 'H'], ['J', 'I']]);
  assert.ok(m.reexports.some((r) => r.spec === './star' && r.star));
  assert.ok(m.reexports.some((r) => r.spec === './k' && r.starAs === 'K'));
  assert.ok(m.locals.has('L') && m.locals.has('M'));
});

test('decisions: RUN for anything that can reach the gate, NOT_AFFECTED only when nothing can', () => {
  const protectedFile = 'apps/mobile/src/cosmos/product/CosmosWorldView.tsx';
  const unreached = 'apps/mobile/src/call/call-text-transport.ts';
  const closure = new Set([protectedFile]);
  for (const [files, decision, cls] of [
    [['apps/api/src/live-attention/call-attention.tracker.ts', 'database/migrations/0204_intel_live_01_call_attention_v1.sql', 'docs/qandeel-canonical-backlog-v1.md'], 'NOT_AFFECTED', 'OUTSIDE_BINARY'],
    [[protectedFile], 'RUN', 'PROTECTED_SURFACE'],
    [[unreached], 'NOT_AFFECTED', 'UNREACHED_SOURCE'],
    [['apps/mobile/src/cosmos/product/CosmosWorldView.test.tsx'], 'NOT_AFFECTED', 'TEST_ONLY'],
    [['apps/mobile/.maestro/itg-call-tap.yaml'], 'NOT_AFFECTED', 'NOT_IN_BINARY'],
    [['apps/mobile/modules/qandeel-voice-call/android/src/main/java/expo/modules/qandeelvoicecall/QandeelVoiceCallModule.kt'], 'NOT_AFFECTED', 'NOT_IN_BINARY'],
    [['apps/mobile/modules/qandeel-voice-call/ios/QandeelVoiceCallModule.swift'], 'RUN', 'SHARED_DEPENDENCY'],
    [['package-lock.json'], 'RUN', 'SHARED_DEPENDENCY'],
    [['packages/runtime/src/index.ts'], 'RUN', 'SHARED_DEPENDENCY'],
    [['apps/mobile/app.json'], 'RUN', 'SHARED_DEPENDENCY'],
    [['apps/mobile/assets/fonts/estedad/Estedad-Regular.ttf'], 'RUN', 'SHARED_DEPENDENCY'],
    [['scripts/cosmos-ios-world/flows/p-tap.yaml'], 'RUN', 'GATE_OWN'],
    [['.github/workflows/cosmos-ios-world-gate.yml'], 'RUN', 'GATE_OWN'],
    [['apps/mobile/src/integration/__validation__/s401-proof-entry.tsx'], 'RUN', 'GATE_OWN'],
    [['apps/mobile/src/cosmos/removed-in-this-change.ts'], 'RUN', 'DELETED_SOURCE'],
    [['apps/mobile/some-new-config.cfg'], 'RUN', 'UNKNOWN_MOBILE'],
    [['some-new-root-file.cfg'], 'RUN', 'UNKNOWN'],
  ]) {
    const result = decide(files, closure);
    assert.equal(result.decision, decision, `${files.join(', ')} → ${decision}`);
    assert.ok(result.reasons.some((r) => r.class === cls), `${files[0]} is classed ${cls}: ${JSON.stringify(result.reasons)}`);
  }
  // One reaching file decides the whole change; an empty change set runs.
  assert.equal(decide(['docs/x.md', protectedFile], closure).decision, 'RUN');
  assert.equal(decide([]).decision, 'RUN');
});

test('the real protected closure: COSMOS and navigation are in it, tests and other proofs are not', () => {
  const closure = protectedClosure();
  for (const f of [
    'apps/mobile/src/cosmos/product/CosmosWorldView.tsx',
    'apps/mobile/src/integration/composition/DepthComposition.tsx',
    'apps/mobile/src/integration/composition/LivingAnalysisMap.tsx',
    'apps/mobile/src/integration/__validation__/s401-proof-world.ts',
  ]) assert.ok(closure.has(f), `${f} is protected`);
  for (const f of closure) {
    assert.doesNotMatch(f, /\.test\.|__tests__/u, `${f}: a test is never part of the binary's closure`);
    // The S401 world's own fixtures (which it imports) are this gate's app; another proof's entry or root never is.
    if (f.includes('/__validation__/')) assert.doesNotMatch(f, /(?:-entry.tsx|ProofRoot.tsx|AcceptanceRoot.tsx)$/u, `${f}: another proof's entry or root is not this gate's app`);
  }
  // Something real is left out (the analysis is not "everything"), and what it leaves out is a source no protected
  // surface imports.
  const unreached = 'apps/mobile/src/call/call-text-transport.ts';
  assert.equal(closure.has(unreached), false, `${unreached} is reached by no protected surface`);
  assert.ok(PROTECTED_ROOTS.includes('apps/mobile/src/cosmos/'));
});

test('the workflow skips the gate only on the plan\'s literal NOT_AFFECTED, for pull requests and pushes to main', () => {
  const wf = read('.github/workflows/cosmos-ios-world-gate.yml');
  assert.match(wf, /jobs:\n {2}plan:\n/u);
  assert.match(wf, /node scripts\/cosmos-ios-world\/world-gate-impact\.mjs/u);
  assert.match(wf, /\[ "\$decision" = NOT_AFFECTED \] \|\| decision=RUN/u, 'anything but NOT_AFFECTED is RUN');
  assert.match(wf, /needs: \[plan\]\n\s+# [^\n]*\n\s+if: \$\{\{ !cancelled\(\) && needs\.plan\.outputs\.decision != 'NOT_AFFECTED' \}\}/u,
    'the gate runs when the plan failed or printed nothing');
  assert.match(wf, /push\) if \[ -n "\$PUSH_BEFORE" \]/u, 'a push to main is planned on its own change');
  assert.match(wf, /The World gate did NOT run \(not passed\)/u, 'a skipped gate is never reported as passed');
  assert.doesNotMatch(wf.replace(/^\s*#[^\n]*$/gmu, ''), /'apps\/api\/\*\*'|'database\/\*\*'/u);
  // The gate itself is unchanged: its cases, its native run and its pass rule.
  for (const kept of [/run: bash scripts\/cosmos-ios-world\/run-world-gate\.sh/u, /run: npm run test:cosmos-ios-world-gate-composition-contract/u,
    /xcodebuild test-without-building -xctestrun/u, /\[ -f "\$f" \] && ! tail -n \+2 "\$f" \| awk -F'\\t' '\$2 != "PASS"' \| grep -q \./u,
    /cell: i17-en/u, /cell: i17-ar/u, /cell: small-en/u]) assert.match(wf, kept);
});

test('the analysis classifies prose without naming it, so a docs-only delta keeps its VAL-01 carry-forward', () => {
  // VAL-01 counts a non-contract file that names a doc (or the `.md` extension) as a reader of it, and a read doc runs
  // the heavy API and Mobile gates. The analysis takes "prose" from VAL-01's own classifier instead.
  const script = 'scripts/cosmos-ios-world/world-gate-impact.mjs';
  const source = read(script);
  for (const doc of ['docs/e2e/ANY_RECORD_v1.md', 'AGENTS.md', 'apps/mobile/README.md']) {
    assert.equal(references(script, source, doc), false, `${script} must not bind ${doc}`);
  }
  assert.equal(decide(['AGENTS.md', 'apps/mobile/README.md', 'docs/e2e/ANY_RECORD_v1.md']).decision, 'NOT_AFFECTED');
});

test('each refusal is real: planted regressions are caught', () => {
  const closure = new Set();
  // A lockfile or a shared package must never be NOT_AFFECTED.
  assert.notEqual(decide(['package-lock.json'], closure).decision, 'NOT_AFFECTED');
  assert.notEqual(decide(['packages/runtime/src/index.ts'], closure).decision, 'NOT_AFFECTED');
  // The fail-safe holds when the analysis cannot be computed.
  const failing = planWorldGate(['apps/mobile/src/cosmos/product/CosmosWorldView.tsx'], { closure: { has: () => { throw new Error('planted'); } } });
  assert.equal(failing.decision, 'RUN');
  assert.equal(failing.reasons[0].class, 'ANALYSIS_FAILED');
  const wf = read('.github/workflows/cosmos-ios-world-gate.yml');
  const weakened = wf.replace("if: ${{ !cancelled() && needs.plan.outputs.decision != 'NOT_AFFECTED' }}", "if: ${{ needs.plan.outputs.decision == 'RUN' }}");
  assert.notEqual(weakened, wf, 'the plant anchor exists');
  assert.doesNotMatch(weakened, /needs\.plan\.outputs\.decision != 'NOT_AFFECTED'/u, 'a gate that runs only on RUN would skip on a failed plan; the wiring test refuses it');
});
