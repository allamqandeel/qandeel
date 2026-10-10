// Static contract for INTEL-TM-01 — Personal Evidence Truth Maintenance (PG-02, QAN-BL-INTEL-01).
//
// What it pins (file reads only; no database, no network, no `.env`):
//   * migration 0151: forward-only, raises no retryable or PROD-RETRY-01-tracked SQLSTATE, writes no lifecycle status,
//     the selector carries exactly the three marked reliance lines, the bind-time guard fires only on SELECTED -> BOUND,
//     the link-removal guard fires only on a removal, and the L1 standing / L3 reliance predicates are referenced by no
//     other migration;
//   * every provider-facing consumer reads reliance (reasoning context, generation, association; background and
//     authenticated), and the raw active list is read only by the owner view and the reliable list itself;
//   * Understanding: the withheld shape (`summary: null` exactly when withheld), its audit, Needs more for a withheld item,
//     no discussion focus on a withheld item; mobile decodes the same shape strictly, shows and announces the approved line
//     instead of the statement, and offers no talk;
//   * the dispatcher's one fail-soft step and its bounded telemetry relation;
//   * the verifier, the CI steps, the record, the backlog and the locators; the CI-01 F1 re-run recorded on the
//     implementation SHA.
// Each detector returns a list of violations; planted defects prove the detectors are not vacuous.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/gu, '\n');
const readIfPresent = (path) => (existsSync(join(root, path)) ? read(path) : null);
const MIGRATIONS = 'database/migrations';
const M0151 = '0151_personal_evidence_truth_maintenance_v1.sql';
const RECORD = 'docs/e2e/QANDEEL_INTEL_TM_01_PERSONAL_EVIDENCE_TRUTH_MAINTENANCE_IMPLEMENTATION_RECORD_v1.md';
const MARK = ' -- INTEL-TM-01 (0151)';
const AR = Object.freeze({
  REVIEW_PENDING: 'هذا الاستنتاج يحتاج إلى مراجعة بعد تغيير معلومات كان يعتمد عليها.',
  NO_REMAINING_SUPPORT: 'لا توجد حاليًا معلومات مؤهلة تدعم هذا الاستنتاج، ولذلك لن يعتمد عليه قنديل.',
});
const EN = Object.freeze({
  REVIEW_PENDING: 'This conclusion needs review after a change to information it relied on.',
  NO_REMAINING_SUPPORT: "No eligible information currently supports this conclusion, so QANDEEL won't rely on it.",
});

/** Every non-spec TypeScript file under apps/api/src, by path. */
function apiSources() {
  const out = {};
  const walk = (dir) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) out[path] = read(path);
    }
  };
  walk('apps/api/src');
  return out;
}

const shipped = Object.freeze({
  migrations: readdirSync(join(root, MIGRATIONS)).filter((name) => name.endsWith('.sql')).sort(),
  m0151: read(`${MIGRATIONS}/${M0151}`),
  m0063: read(`${MIGRATIONS}/0063_question_information_gap_closed_loop_v1.sql`),
  otherMigrationTexts: readdirSync(join(root, MIGRATIONS)).filter((name) => name.endsWith('.sql') && name !== M0151).map((name) => read(`${MIGRATIONS}/${name}`)).join('\n'),
  api: apiSources(),
  mobileApi: read('apps/mobile/src/runtime-entry/understanding-api.ts'),
  mobileCopy: read('apps/mobile/src/understanding/copy.ts'),
  mobileSurface: read('apps/mobile/src/understanding/UnderstandingSurface.tsx'),
  mobileController: read('apps/mobile/src/understanding/understanding-controller.ts'),
  verifier: read('database/verify-migration-0151.mjs'),
  packageJson: read('package.json'),
  apiCi: read('.github/workflows/api-ci.yml'),
  record: read(RECORD),
  backlog: read('docs/qandeel-canonical-backlog-v1.md'),
  currentState: readIfPresent('QANDEEL_CURRENT_STATE.md'),
  projectMap: readIfPresent('QANDEEL_PROJECT_MAP.md'),
});
const api = (world, file) => world.api[`apps/api/src/${file}`] ?? '';
const code = (text) => text.replace(/--[^\n]*/gu, '');

// ---------------------------------------------------------------------------------------------------------------
// Detectors.

function migrationViolations(world) {
  const out = [];
  if (!world.migrations.includes(M0151)) out.push('migration 0151 is missing');
  const m = code(world.m0151);
  if (/ERRCODE\s*=\s*'(?:40001|40P01|PT409)'/u.test(m)) out.push('0151 raises a retryable or PROD-RETRY-01-tracked SQLSTATE');
  if (/'(?:REJECTED|RETIRED)'/u.test(m)) out.push('0151 writes a lifecycle status');
  if (/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.finalize_conversation_turn_v2\b/u.test(m)) out.push('finalize v2 is redefined');
  if (/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.canonical_eligible_memory_ids_v1\b/u.test(m)) out.push('the canonical Evidence projection (L2) is redefined');
  if (!/^CREATE FUNCTION public\.select_formal_question_opportunity_v1\(/mu.test(world.m0063)) out.push('0063 no longer defines the selector (historical migration edited)');
  if (world.m0151.split('\n').filter((line) => line.endsWith(MARK)).length !== 3) out.push('the selector does not carry exactly three marked reliance lines');
  if (!/CREATE TRIGGER formal_question_turn_binding_reliance_guard\s+BEFORE UPDATE ON public\.formal_question_turn_bindings\s+FOR EACH ROW WHEN \(OLD\.state = 'SELECTED' AND NEW\.state = 'BOUND'\)/u.test(world.m0151)) out.push('the bind-time guard is not exactly SELECTED -> BOUND');
  if (!/RAISE EXCEPTION 'QUESTION_BINDING_RELIANCE_WITHHELD' USING ERRCODE='42501'/u.test(world.m0151)) out.push('the bind refusal is not the 42501 family');
  if (!/WHEN \(NOT \(OLD\.supporting_evidence_ids <@ NEW\.supporting_evidence_ids AND OLD\.contradicting_evidence_ids <@ NEW\.contradicting_evidence_ids\)\)/u.test(world.m0151)) out.push('the link-removal guard does not fire on every removal');
  if (!/GRANT EXECUTE ON FUNCTION public\.hypothesis_evidence_reliance_v1\(uuid\[\]\) TO authenticated;/u.test(world.m0151)) out.push('the authenticated reliance read is not granted');
  if ((world.m0151.match(/^GRANT EXECUTE ON FUNCTION /gmu) ?? []).length !== 4) out.push('0151 grants EXECUTE on something beyond the three entry points and the unchanged selector');
  if (/personal_evidence_standing_v1|hypothesis_evidence_change_core_v1/u.test(world.otherMigrationTexts)) out.push('another migration references the L1 / L3 predicates');
  return out;
}

function consumerViolations(world) {
  const out = [];
  const reasoning = api(world, 'hypothesis/hypothesis-reasoning-context.service.ts');
  if (!reasoning.includes('this.hypotheses.readEvidenceReliance(token, candidates)')) out.push('the reasoning context does not read reliance');
  if (!reasoning.includes('const reliable = reliableOnly(candidates, reliance);')) out.push('the reasoning context does not keep only reliable items');
  if (!reasoning.includes('const discussedId = this.discussedHypothesisId(focus, reliable);')) out.push('a withheld item can still be the discussed item');
  if (/\.\.\.candidates\.filter\(/u.test(reasoning)) out.push('the reasoning context orders unfiltered candidates');
  const generation = api(world, 'hypothesis/hypothesis-generation.service.ts');
  if (!generation.includes('this.hypotheses.listReliableActiveForUser(userId, accessToken)') || generation.includes('listActiveForUser(')) out.push('authenticated generation sees withheld items');
  const authority = api(world, 'hypothesis/hypothesis-evidence-association-authority.service.ts');
  if ((authority.match(/listReliableActiveForUser\(/gu) ?? []).length !== 2 || authority.includes('listActiveForUser(')) out.push('authenticated association sees withheld items');
  const enrichment = api(world, 'background-intelligence/background-intelligence-enrichment.service.ts');
  if (!enrichment.includes('existingActiveHypotheses:await this.listReliableActiveHypotheses(context)')) out.push('background generation sees withheld items');
  if ((enrichment.match(/this\.data\.listActiveHypotheses\(/gu) ?? []).length !== 1 || /\basync listActiveHypotheses\(/u.test(enrichment)) out.push('the background raw list is read outside the reliable list');
  const association = api(world, 'post-response-intelligence/model-assisted-hypothesis-association.service.ts');
  if ((association.match(/listReliableActiveHypotheses\(/gu) ?? []).length !== 2 || association.includes('listActiveHypotheses(')) out.push('background association sees withheld items');
  const rawReaders = Object.entries(world.api).filter(([, text]) => text.includes('.listActiveForUser(')).map(([path]) => path.replace('apps/api/src/', '')).sort();
  if (JSON.stringify(rawReaders) !== JSON.stringify(['hypothesis/hypothesis-reasoning-context.service.ts', 'hypothesis/hypothesis.service.ts', 'understanding/understanding.service.ts', 'memory/evidence.service.ts', 'memory/memory-retriever.service.ts', 'memory/memory-runtime.service.ts', 'memory/memory-write.service.ts'].sort())) {
    out.push(`unexpected raw active-list readers: ${rawReaders}`);
  }
  return out;
}

function understandingViolations(world) {
  const out = [];
  const service = api(world, 'understanding/understanding.service.ts');
  const projection = api(world, 'understanding/understanding-projection.ts');
  if (!service.includes("summary: change === 'NONE' ? hypothesis.statement : null,")) out.push('a withheld statement can be shown');
  if (!service.includes('withheld: change !== \'NONE\',')) out.push('the confidence projection does not know the item is withheld');
  if (!/const alternatives = withheld \? \[\] : hypothesis\.competing_hypothesis_ids\s+\.flatMap\(\(id\) => context\.surfaced\.filter\(\(value\) => value\.id === id && this\.evidenceChange\(value, context\) === 'NONE'\)/u.test(service)) out.push('alternatives can name a withheld item');
  const open = service.indexOf('async openDiscussion(');
  const guard = service.indexOf("(await this.hypotheses.readEvidenceReliance(token, [hypothesis])).get(hypothesis.id) !== 'NONE'", open);
  const write = service.indexOf('this.repository.openDiscussion(', open);
  if (open < 0 || guard < 0 || write < 0 || guard > write) out.push('a withheld item can become the discussion focus');
  const mixed = projection.indexOf("if (facts.status === 'MIXED') return 'MIXED';");
  const withheld = projection.indexOf("if (facts.withheld) return 'NEEDS_MORE';");
  const rule3 = projection.indexOf("if (facts.eligibleSupporting > 0 && facts.eligibleContradicting > 0) return 'MIXED';");
  if (mixed < 0 || withheld < mixed || rule3 < withheld) out.push('a withheld item can be projected as Clear, Taking shape or rule-3 Mixed');
  if (!projection.includes("} else if (value.summary !== null || (value.confidence !== 'MIXED' && value.confidence !== 'NEEDS_MORE')) reject();")) out.push('the outbound audit admits a withheld statement or an optimistic state');
  if (!projection.includes("if (value.evidenceChange !== 'NONE' && [value.evidence, value.contradictions, value.alternatives, value.unresolved]")) out.push('the outbound audit admits withheld detail text');
  return out;
}

function mobileViolations(world) {
  const out = [];
  if (!world.mobileApi.includes("const EVIDENCE_CHANGES: readonly string[] = Object.freeze(['NONE', 'REVIEW_PENDING', 'NO_REMAINING_SUPPORT']);")) out.push('the decoder does not know the three evidence changes');
  if (!world.mobileApi.includes("if (evidenceChange === 'NONE' ? !isText(summary) : summary !== null || (confidence !== 'MIXED' && confidence !== 'NEEDS_MORE')) return null;")) out.push('the decoder admits a withheld statement or an optimistic state');
  if (!world.mobileApi.includes("if (summary.evidenceChange !== 'NONE' && [evidence, contradictions, alternatives, unresolved].some((list) => list.length > 0)) return null;")) out.push('the decoder admits withheld detail text');
  for (const [key, text] of Object.entries(AR)) if (!world.mobileCopy.includes(`${key}: '${text}'`)) out.push(`the approved Arabic ${key} line drifted`);
  for (const [key, text] of Object.entries(EN)) if (!world.mobileCopy.includes(`${key}: ${JSON.stringify(text)}`) && !world.mobileCopy.includes(`${key}: '${text}'`)) out.push(`the English ${key} line drifted`);
  if (world.mobileSurface.split('\n').some((line) => line.includes('accessibilityLabel=') && /\b(?:item|view|discussion)\.summary\b/u.test(line))) {
    out.push('a screen reader can be given the statement field directly');
  }
  if (!world.mobileSurface.includes('{withheld ? null : <View style={{ paddingTop: 24 }}>')) out.push('a withheld item offers talk');
  if (!world.mobileController.includes("if (view.evidenceChange !== 'NONE' || view.summary === null) return null;")) out.push('the controller can open a discussion of a withheld item');
  return out;
}

function dispatcherViolations(world) {
  const out = [];
  const dispatcher = api(world, 'post-response-intelligence/post-response-intelligence-dispatcher.service.ts');
  const reread = "if(turn.processing_path!==execution.processing_path)return this.terminal(execution,'QUARANTINED','CANONICAL_MISMATCH','CANONICAL_REREAD');";
  const at = dispatcher.indexOf(reread);
  const step = dispatcher.indexOf('await this.maintainWithdrawnEvidence(context);');
  if (at < 0 || step < at || dispatcher.slice(at + reread.length, step).replace(/\/\/[^\n]*/gu, '').trim() !== '') out.push('the housekeeping is not the step right after the canonical reread');
  const body = dispatcher.match(/private async maintainWithdrawnEvidence\([^)]*\):Promise<void>\{([\s\S]*?)\n \}/u)?.[1] ?? null;
  if (body === null) out.push('the housekeeping step is missing');
  else {
    if (!/try\{await this\.enrichment\.reevaluateWithdrawnHypothesisEvidence\(context\);\}catch/u.test(body)) out.push('a housekeeping failure is not caught');
    if (/return false|this\.terminal\(|throw /u.test(body)) out.push('a housekeeping failure can quarantine, redeliver or end the execution');
  }
  if (!api(world, 'observability/telemetry.service.ts').includes("['PERSONAL_EVIDENCE_TRUTH_MAINTENANCE',new Map([['withdrawal_reevaluate',new Set(['success',...OPERATION_FAILURES])]])],")) out.push('the housekeeping telemetry relation drifted');
  return out;
}

function registrationViolations(world) {
  const out = [];
  const pkg = JSON.parse(world.packageJson);
  if (pkg.scripts['verify:personal-evidence-truth-maintenance:integration'] !== 'node --env-file-if-exists=.env database/verify-migration-0151.mjs') out.push('the verifier script is not registered');
  if (pkg.scripts['test:intel-tm-01-personal-evidence-truth-maintenance-contract'] !== 'node --test tests/intel-tm-01-personal-evidence-truth-maintenance-contract.test.mjs') out.push('this contract is not registered');
  if (world.apiCi.split('run: npm run verify:personal-evidence-truth-maintenance:integration\n').length !== 2) out.push('API CI does not run the verifier exactly once');
  const contractStep = 'run: npm run test:intel-tm-01-personal-evidence-truth-maintenance-contract}';
  if (world.apiCi.split(contractStep).length !== 2 || world.apiCi.indexOf(contractStep) > world.apiCi.indexOf('run: npm run test:forward-safety-contract}')) out.push('API CI does not run this contract once, before the forward-safety gate');
  for (const proof of ['T12 race: a forget in flight during the bind', 'T13 race: the bind commits first', 'T15: the governed erasure removes the records', 'catalog: the selector is 0063 plus exactly the three marked lines']) {
    if (!world.verifier.includes(proof)) out.push(`the verifier lost: ${proof}`);
  }
  return out;
}

function recordViolations(world) {
  const out = [];
  if (!/^\*\*Status:\*\* `INTEL-TM-01` — \*\*(?:IMPLEMENTED|CLOSED|MERGED)/mu.test(world.record)) out.push('the record carries no lifecycle banner');
  for (const section of ['**CC-1 — Evidence withdrawal and provenance**', '**CC-2 — Understanding**', '**CC-3 — Question safety**', '**CC-4 — Background housekeeping**', '- **L-1:**', '- **L-2:**', '**R3-G — general question-finalization version recheck']) {
    if (!world.record.includes(section)) out.push(`the record lost: ${section}`);
  }
  if (!/\| `QAN-BL-INTEL-01` \| Personal Evidence Invalidation/u.test(world.backlog)) out.push('QAN-BL-INTEL-01 left the backlog index');
  if (!world.backlog.includes('- **Current truth (INTEL-TM-01, 2026-10-10;')) out.push('the backlog does not record the repository resolution of QAN-BL-INTEL-01');
  if (!world.backlog.includes('- **Triggered check (INTEL-TM-01, 2026-10-10):**')) out.push('the backlog does not record the QAN-BL-INTEL-02 triggered check');
  if (world.currentState !== null && !world.currentState.includes('| INTEL-TM-01 — Personal Evidence Truth Maintenance (PG-02) (migration `0151`) |')) out.push('Current State has no INTEL-TM-01 row');
  if (world.projectMap !== null && !world.projectMap.includes('### INTEL-TM-01 implementation checkpoint')) out.push('the Project Map has no INTEL-TM-01 checkpoint');
  return out;
}

function rerunViolations(world) {
  const out = [];
  const line = world.record.match(/^- \*\*CI-01 F1 re-run:\*\* `scripts\/ci-01\/results\/([0-9a-f]{40})\.json`/mu);
  if (!line) return ['the record names no CI-01 F1 re-run on the implementation SHA'];
  const path = `scripts/ci-01/results/${line[1]}.json`;
  if (!existsSync(join(root, path))) return [`${path} is missing`];
  const results = JSON.parse(read(path));
  if (results.repository?.head !== line[1]) out.push('the re-run is not named after the SHA it measured');
  const f1 = results.scenarios?.F1?.yields;
  if (!f1?.pg02 || f1.pg02.reliedOnAfterWithdrawal !== 0) out.push('a Hypothesis depending on forgotten or disabled Memory was still relied on');
  if (!(f1?.pg02?.dependedOnWithdrawnOrCorrected > 0)) out.push('the F1 re-run is vacuous: no Hypothesis depended on withdrawn Memory');
  if (f1?.forget?.hypothesisInjectedAfterForget !== 0) out.push('a withheld Hypothesis was injected after forget');
  if (!existsSync(join(root, 'scripts/ci-01/results/6a5fa42186c880d8c8cb2eee88f7b2b97cf44b24.json'))) out.push('the CI-01 baseline results were removed');
  return out;
}

const DETECTORS = { migrationViolations, consumerViolations, understandingViolations, mobileViolations, dispatcherViolations, registrationViolations, recordViolations, rerunViolations };

for (const [name, detector] of Object.entries(DETECTORS)) {
  test(`the shipped repository is clean: ${name}`, () => {
    assert.deepEqual(detector(shipped), [], name);
  });
}

const plant = (key, from, to) => {
  const text = key.startsWith('api:') ? shipped.api[`apps/api/src/${key.slice(4)}`] : shipped[key];
  assert.ok(text.includes(from), `planting anchor missing in ${key}: ${from.slice(0, 80)}`);
  const replaced = text.replace(from, to);
  return key.startsWith('api:') ? { ...shipped, api: { ...shipped.api, [`apps/api/src/${key.slice(4)}`]: replaced } } : { ...shipped, [key]: replaced };
};

const PLANTED = [
  ['the bind refusal becomes PT409', 'migrationViolations', () => plant('m0151', "RAISE EXCEPTION 'QUESTION_BINDING_RELIANCE_WITHHELD' USING ERRCODE='42501',", "RAISE EXCEPTION 'QUESTION_BINDING_RELIANCE_WITHHELD' USING ERRCODE='PT409',")],
  ['the bind guard fires on every update', 'migrationViolations', () => plant('m0151', "FOR EACH ROW WHEN (OLD.state = 'SELECTED' AND NEW.state = 'BOUND')", 'FOR EACH ROW')],
  ['a selector reliance line is dropped', 'migrationViolations', () => plant('m0151', MARK, '')],
  ['the reasoning context stops reading reliance', 'consumerViolations', () => plant('api:hypothesis/hypothesis-reasoning-context.service.ts', 'this.hypotheses.readEvidenceReliance(token, candidates)', 'Promise.resolve(new Map())')],
  ['generation reads the raw list', 'consumerViolations', () => plant('api:hypothesis/hypothesis-generation.service.ts', 'listReliableActiveForUser(userId, accessToken)', 'listActiveForUser(userId, accessToken)')],
  ['background association reads the raw list', 'consumerViolations', () => plant('api:post-response-intelligence/model-assisted-hypothesis-association.service.ts', 'this.enrichment.listReliableActiveHypotheses(context)', 'this.enrichment.listActiveHypotheses(context)')],
  ['a withheld statement is shown', 'understandingViolations', () => plant('api:understanding/understanding.service.ts', "summary: change === 'NONE' ? hypothesis.statement : null,", 'summary: hypothesis.statement,')],
  ['a withheld item may be Clear', 'understandingViolations', () => plant('api:understanding/understanding-projection.ts', "  if (facts.withheld) return 'NEEDS_MORE';\n", '')],
  ['the mobile decoder accepts a withheld statement', 'mobileViolations', () => plant('mobileApi', "summary !== null || (confidence !== 'MIXED' && confidence !== 'NEEDS_MORE')", "(confidence !== 'MIXED' && confidence !== 'NEEDS_MORE')")],
  ['the Arabic line is reworded', 'mobileViolations', () => plant('mobileCopy', AR.REVIEW_PENDING, 'جاري إعادة تقييم الاستنتاج.')],
  ['the screen reader reads the statement field', 'mobileViolations', () => plant('mobileSurface', 'accessibilityLabel={item.underReview ? `${title}, ${line}', 'accessibilityLabel={item.underReview ? `${title}, ${item.summary}')],
  ['a housekeeping failure redelivers', 'dispatcherViolations', () => plant('api:post-response-intelligence/post-response-intelligence-dispatcher.service.ts', "outcome=classifyOperationalFailure(error)==='TRANSPORT'?'transport_failure':'integrity_failure';", 'return false;')],
  ['the record drops CC-3', 'recordViolations', () => plant('record', '**CC-3 — Question safety**', '**CC-3 — retired**')],
];

for (const [name, detector, world] of PLANTED) {
  test(`planted defect is rejected: ${name}`, () => {
    assert.notDeepEqual(DETECTORS[detector](world()), [], `${detector} missed: ${name}`);
  });
}
