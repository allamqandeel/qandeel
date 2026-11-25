// INTEL-LIVE-01 CP1 — the iOS World gate's impact analysis (PO direction of 2026-11-25 on the CP1 resolution; backlog
// BG-10 clarification): the gate runs whenever a change can reach what it proves, is skipped only on a literal
// NOT_AFFECTED, and every doubt answers RUN. The gate's suites, cases and assertions are not touched here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseModule, planWorldGate, protectedClosure, PROTECTED_ROOTS, TARGETED_SURFACES } from '../scripts/cosmos-ios-world/world-gate-impact.mjs';
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
    /xcodebuild test-without-building -xctestrun/u, /\[ -f "\$f" \] && ! tail -n \+2 "\$f" \| awk -F'\\t' '\$2 != "PASS"' \| grep -q \./u]) assert.match(wf, kept);
  // BG-10's permanent matrix: defined once in the plan step, and the matrix's fallback (a plan that answered nothing) is
  // exactly that full list.
  const full = JSON.parse(/CELLS_FULL: >-\n((?:\s+[^\n]+\n)+?)\s+run: \|/u.exec(wf)[1].replace(/\s*\n\s*/gu, ' '));
  assert.deepEqual(full.map((c) => c.cell), ['i17-en', 'i17-ar', 'small-en']);
  assert.equal(full.find((c) => c.cell === 'i17-ar').langtag, 'ar-EG', 'the right-to-left cell is kept');
  const fallback = JSON.parse(/include: \$\{\{ fromJSON\(needs\.plan\.outputs\.cells \|\| '([^']+)'\) \}\}/u.exec(wf)[1]);
  assert.deepEqual(fallback, full, 'a plan that answered nothing runs every cell');
});

test('the functional scope: a surface with its own targeted gate runs only the COSMOS cases it can affect', () => {
  const call = 'apps/mobile/src/call/CallViews.tsx';
  const cosmos = 'apps/mobile/src/cosmos/product/CosmosWorldView.tsx';
  const closure = new Set([call, cosmos]);
  const scope = (files) => decide(files, closure).scope;
  assert.equal(scope([call]), 'COSMOS_CASES', 'a call client the Analysis mounts');
  assert.equal(decide([call], closure).decision, 'RUN', 'COSMOS_CASES is a run, never a skip');
  assert.equal(scope(['apps/mobile/modules/qandeel-voice-call/ios/Core/CallCoordinator.swift']), 'COSMOS_CASES', "the call engine's own Swift");
  assert.equal(scope(['apps/mobile/modules/qandeel-voice-call/ios/opus/celt/bands.c']), 'FULL', 'the vendored codec changes how the binary builds');
  assert.equal(scope(['apps/mobile/src/call/call-text-transport.ts']), 'NOT_AFFECTED', 'a call source no protected surface reaches');
  // The widest scope wins: a protected surface, a shared dependency or any doubt alongside it is FULL.
  for (const other of [cosmos, 'package-lock.json', 'apps/mobile/some-new-config.cfg', 'apps/mobile/src/cosmos/removed-in-this-change.ts']) {
    assert.equal(scope([call, other]), 'FULL', `${other} alongside the call is FULL`);
  }
  assert.equal(scope([cosmos]), 'FULL');
  assert.equal(scope(['docs/x.md']), 'NOT_AFFECTED');
  assert.equal(decide([]).scope, 'FULL');
  assert.equal(planWorldGate([cosmos], { closure: { has: () => { throw new Error('planted'); } } }).scope, 'FULL');

  // Every targeted surface is really proven by its own gate: the gate's pull_request AND push paths carry its paths.
  for (const surface of TARGETED_SURFACES) {
    const gate = read(surface.gate);
    for (const event of ['pull_request', 'push']) {
      const block = new RegExp(`\\n  ${event}:\\n[\\s\\S]*?\\n    paths:\\n((?:\\s+(?:-\\s+'[^']+'|#[^\\n]*)\\n)+)`, 'u').exec(gate);
      const paths = block ? [...block[1].matchAll(/-\s+'([^']+)'/gu)].map((m) => m[1]) : [];
      for (const p of surface.paths) assert.ok(paths.includes(p), `${surface.gate} ${event} runs for ${p}`);
    }
  }

  // The workflow and the runner: COSMOS_CASES is the reference cell, P-TAP and F1-RESOLVED, no native gesture run.
  const wf = read('.github/workflows/cosmos-ios-world-gate.yml');
  assert.match(wf, /scope=FULL\n/u, 'the scope defaults to FULL');
  assert.match(wf, /\.scope === "COSMOS_CASES" \? 0 : 1/u, 'only the literal COSMOS_CASES narrows it');
  assert.match(wf, /c\.filter\(\(x\) => x\.cell === "i17-en"\)/u, 'COSMOS_CASES runs the reference cell');
  assert.match(wf, /WORLD_GATE_SCOPE: "\$\{\{ needs\.plan\.outputs\.scope \|\| 'FULL' \}\}"/u);
  assert.equal((wf.match(/&& needs\.plan\.outputs\.scope != 'COSMOS_CASES' \}\}/gu) ?? []).length, 2, 'the native gestures and their classification are skipped only for COSMOS_CASES');
  assert.match(wf, /the other cells, Worlds, pans and native gestures did NOT run \(not passed\)/u);
  const runner = read('scripts/cosmos-ios-world/run-world-gate.sh');
  const block = /if \[ "\$\{WORLD_GATE_SCOPE:-FULL\}" = COSMOS_CASES \]; then\n([\s\S]*?)\n {2}exit \$\?\nfi\n/u.exec(runner)?.[1] ?? '';
  assert.match(block, /! enter pc;/u);
  assert.match(block, /elif sleep 5; ! initstage pc; then\n\s+for c in P-TAP F1-RESOLVED; do result "\$c" 'NOT TESTED'/u, 'the stage is initialized first: P-TAP is never its first touch');
  assert.ok(block.indexOf('initstage pc') < block.indexOf('tapcase P-TAP pc-tap "$pt" f1'), 'the initialization precedes the tap case');
  assert.match(block, /grep -q \$'\^P-TAP\\tPASS' "\$RES" && grep -q \$'\^F1-RESOLVED\\tPASS' "\$RES"/u, 'both cases must PASS');
  assert.doesNotMatch(block, /pancase|landcase|shared_enter/u, 'no pan, landscape or other World in the COSMOS cases');
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
  // A protected surface can never be narrowed to COSMOS_CASES, and neither can a call change beside one.
  const closureWith = new Set(['apps/mobile/src/call/CallViews.tsx', 'apps/mobile/src/cosmos/product/CosmosWorldView.tsx']);
  assert.notEqual(planWorldGate(['apps/mobile/src/cosmos/product/CosmosWorldView.tsx'], { closure: closureWith }).scope, 'COSMOS_CASES');
  assert.notEqual(planWorldGate(['apps/mobile/src/call/CallViews.tsx', 'apps/mobile/src/cosmos/product/CosmosWorldView.tsx'], { closure: closureWith }).scope, 'COSMOS_CASES');
});
