// MEM-AR-01C — Memory Subject Identity, Atomicity & Evidence Protection: static contract (matrix rows H-5, W-1 static,
// G-1, and the shape of the R2 guard, CC-M1, CC-H1 and MF-1).
//
// Each detector guards one property the slice froze, runs clean on the shipped source, and is proven able to fail by
// planted defects below. Behaviour is proven elsewhere (API Jest on the production route and the R2 route; real
// PostgreSQL in database/verify-migration-0152.mjs); this contract keeps the SHAPE from drifting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/gu, '\n');
function walk(dir) {
  const out = [];
  for (const name of readdirSync(join(root, dir))) {
    const path = `${dir}/${name}`;
    if (statSync(join(root, path)).isDirectory()) { if (name !== 'node_modules' && name !== 'dist') out.push(...walk(path)); } else out.push(path);
  }
  return out;
}
const runtimeSources = (prefix) => walk(prefix).filter((path) => /\.ts$/u.test(path) && !/\.spec\.ts$/u.test(path));

const shipped = Object.freeze({
  migration: read('database/migrations/0152_memory_subject_identity_atomicity_v1.sql'),
  // Every runtime TypeScript file of the API, plus the smoke and CI-01 harnesses that drive the production modules.
  runtime: Object.fromEntries([...runtimeSources('apps/api/src'), ...runtimeSources('apps/api/scripts'), ...runtimeSources('scripts/ci-01')].map((path) => [path, read(path)])),
  conversationRepository: read('apps/api/src/conversation/conversation.repository.ts'),
  backgroundData: read('apps/api/src/background-intelligence/background-intelligence-data-api.service.ts'),
  enrichment: read('apps/api/src/background-intelligence/background-intelligence-enrichment.service.ts'),
  evidence: read('apps/api/src/memory/evidence.service.ts'),
  policy: read('apps/api/src/hypothesis/hypothesis-generation.policy.ts'),
  copy: read('apps/api/src/memory/memory-control.copy.ts'),
  retriever: read('apps/api/src/memory/memory-retriever.service.ts'),
  modelRouter: read('apps/api/src/model-router/model-router.types.ts'),
  subject: read('apps/api/src/memory/memory-subject.ts'),
  packageJson: read('package.json'),
  ci: read('.github/workflows/api-ci.yml'),
});
const sqlFunction = (sql, name) => {
  const start = sql.indexOf(`CREATE FUNCTION public.${name}(`);
  return start < 0 ? '' : sql.slice(start, sql.indexOf('$$;', start) + 3);
};
const code = (text) => text.replace(/\/\/.*$/gmu, '').replace(/\/\*[\s\S]*?\*\//gu, '');
const LEGACY_WRITERS = ['server_create_memory_v1', 'server_create_memory_for_execution_v1', 'server_supersede_memory_v1',
  'server_mark_memory_deleted_v1', 'server_disable_memory_v1', 'server_finalize_memory_control_turn_v1'];

// W-1 (static): the six legacy writers are revoked from service_role, and no runtime code calls any of them. The only
// Memory writers the runtime calls are v2 (the Conversation repository) and background_record_memory_v1 (the background
// data port, mirrored by the A2 smoke adapter).
function writerSurfaceViolations(w) {
  const out = [];
  for (const writer of LEGACY_WRITERS) {
    if (!new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${writer}\\([^)]*\\) FROM service_role;`, 'u').test(w.migration)) out.push(`0152 does not revoke ${writer} from service_role`);
  }
  if (/GRANT [^;]*(?:INSERT|UPDATE|DELETE|ALL)[^;]* ON (?:TABLE )?public\.(?:memories|memory_subject_attributions|memory_equivalence_dispositions)/iu.test(w.migration)) out.push('0152 grants a table write');
  if (/GRANT EXECUTE ON FUNCTION public\.(?:server_create_memory|server_supersede_memory|server_mark_memory_deleted|server_disable_memory|server_finalize_memory_control_turn_v1|memory_status_only_supersede|memory_dispose_equivalent)/u.test(w.migration)) out.push('0152 grants an internal writer');
  for (const [path, text] of Object.entries(w.runtime)) {
    for (const writer of LEGACY_WRITERS) if (new RegExp(`['"/]${writer}['"(]`, 'u').test(code(text))) out.push(`${path} calls the revoked ${writer}`);
    if (/server_finalize_memory_control_turn_v2/u.test(code(text)) && !/conversation\.repository\.ts$|scripts\/ci-01\//u.test(path)) out.push(`${path} calls finalize v2 outside the Conversation repository`);
    if (/background_record_memory_v1/u.test(code(text)) && !/background-intelligence-data-api\.service\.ts$|a2-e2e-smoke\/pg-background-intelligence-data\.adapter\.ts$/u.test(path)) out.push(`${path} calls the background writer outside the background data port`);
  }
  if (!/'server_finalize_memory_control_turn_v2'/u.test(w.conversationRepository)) out.push('the Conversation repository does not finalize through v2');
  if (!/'rpc\/background_record_memory_v1'/u.test(w.backgroundData)) out.push('the background data port does not write through background_record_memory_v1');
  if (/p_user_id/u.test(w.backgroundData.slice(w.backgroundData.indexOf('async recordMemory('), w.backgroundData.indexOf('async readCanonicalSourceTurn(')))) out.push('the background writer is told the owner instead of deriving it from the execution');
  return out;
}

// R2 (PD-7): background_record_memory_v1 refuses a turn a Memory command already answered, from the committed command
// row bound to that source turn - never from the words - BEFORE anything is created; the TypeScript maps every non-write
// answer to "no fresh Evidence".
function r2Violations(w) {
  const out = [];
  const writer = sqlFunction(w.migration, 'background_record_memory_v1');
  const guard = writer.indexOf("'SKIPPED_COMMAND_TURN'");
  if (guard < 0 || !/EXISTS \(SELECT 1 FROM public\.memory_control_commands c\s+WHERE c\.source_turn_id = p_source_turn_id AND c\.user_id = execution_row\.user_id\)/u.test(writer)) out.push('the R2 guard is not the committed command row of this source turn');
  if (guard < 0 || guard > writer.indexOf('server_create_memory_v1(')) out.push('the R2 guard does not run before the Memory is created');
  if (/content|p_content/u.test(writer.slice(writer.lastIndexOf('IF EXISTS', guard), guard))) out.push('the R2 guard reads the words');
  for (const outcome of ['SUPERSEDED_BY_LATER_COMMAND', 'EQUIVALENT_EXISTS', 'ALREADY_RECORDED']) if (!writer.includes(`'${outcome}'`)) out.push(`the background writer lost ${outcome}`);
  if (!/MEMORY_WRITE_EXECUTION_NOT_ASSOCIATED/u.test(writer) || !/f\.effect_key = 'MEMORY_WRITE' AND f\.state = 'CLAIMED'/u.test(writer)) out.push('the background writer lost the 0072 association check');
  if (!/if\(recorded\.outcome!=='CREATED'&&recorded\.outcome!=='ALREADY_RECORDED'\)return\{decision:'SKIP'/u.test(w.enrichment)) out.push('a non-write answer of the background writer is not a SKIP');
  return out;
}

// CC-M1 / CC-H1 / MF-1: subject-safe Evidence in SQL and TypeScript, zero-support candidates refused in both places, and
// the model-facing reading of the about field.
function evidenceViolations(w) {
  const out = [];
  if (!/attribution\.subject='SELF'\)\s*-- MEM-AR-01C CC-M1 \(0152\)/u.test(w.migration)) out.push('L2 Step B is not SELF-only');
  if (!/memory\.subject === 'SELF' &&/u.test(code(w.evidence))) out.push('projectEligibleEvidence admits a Memory that is not about the user');
  if (!/'NOT_SELF','UNATTRIBUTED'\)\)\) AS tainted/u.test(w.migration)) out.push('the subject standings do not taint');
  const standing = w.migration.slice(w.migration.indexOf('CREATE OR REPLACE FUNCTION public.personal_evidence_standing_v1'));
  if (!(standing.indexOf("THEN 'NOT_SELF'") < standing.indexOf("THEN 'LAPSED'") && standing.indexOf("THEN 'UNATTRIBUTED'") < standing.indexOf("THEN 'LAPSED'"))) out.push('expiry can turn a subject taint into LAPSED');
  if (!/jsonb_array_length\(candidate\.value->'supportingEvidenceIds'\)=0\) THEN RAISE EXCEPTION 'CANDIDATE_WITHOUT_SUPPORT' USING ERRCODE='22023'/u.test(w.migration)) out.push('the SQL completion accepts a zero-support candidate');
  const policy = code(w.policy);
  const role = policy.indexOf("return'EVIDENCE_ROLE_CONFLICT'");
  const support = policy.indexOf("if(value.supportingEvidenceIds.length===0)return'NO_SUPPORTING_EVIDENCE'");
  if (support < 0 || support < role || support < policy.indexOf("return'EVIDENCE_OUTSIDE_REQUEST'")) out.push('NO_SUPPORTING_EVIDENCE is missing or precedes an earlier rejection');
  if (!/about: aboutOf\(memory\)/u.test(w.retriever) || !/'SELF' \? 'USER' : memory\.subject === 'OTHER' \? 'SOMEONE_ELSE' : 'NOT_RECORDED'/u.test(w.retriever)) out.push('a served Memory does not say whom it concerns');
  if (!/NOT_RECORDED means whom it concerns was not established, which neither shows that the user asked to store it nor makes it a personal fact about the user/u.test(w.modelRouter)
    || !/never attribute that person's preferences, intentions or feelings to the user/u.test(w.modelRouter)) out.push('MF-1 lost its corrected wording (RC-2)');
  if (!/subject === 'SELF' \|\| subject === 'OTHER' \? subject : null/u.test(w.subject)) out.push('an unknown subject value is read as established');
  return out;
}

// H-5: no runtime caller creates a Hypothesis outside the persistence core (A2 §G1.1). The two TypeScript wrappers of the
// creation commands may exist, but nothing reachable calls them: the background one is called by no one, and the
// authenticated one only by HypothesisGenerationService, which nothing outside its module wiring references.
const CREATION_WRAPPERS = ['apps/api/src/hypothesis/hypothesis.repository.ts', 'apps/api/src/background-intelligence/background-intelligence-data-api.service.ts'];
function hypothesisCreationViolations(w) {
  const out = [];
  // Runtime only: the smoke scripts build their fixtures with these commands on their own superuser harness.
  for (const [path, text] of Object.entries(w.runtime).filter(([path]) => path.startsWith('apps/api/src/'))) {
    const source = code(text);
    if (/server_create_hypothesis_v1|background_create_system_hypothesis_v1/u.test(source) && !CREATION_WRAPPERS.includes(path)) out.push(`${path} calls a Hypothesis creation command`);
    if (/\.createSystemHypothesis\(/u.test(source)) out.push(`${path} creates a system Hypothesis outside persistence`);
    if (/\bhypotheses\.create\(/u.test(source) && !path.endsWith('hypothesis/hypothesis-generation.service.ts')) out.push(`${path} creates a Hypothesis through HypothesisService`);
    if (/\bHypothesisGenerationService\b/u.test(source) && !/hypothesis\/hypothesis(?:-generation\.service|\.module)\.ts$/u.test(path)) out.push(`${path} reaches HypothesisGenerationService`);
  }
  return out;
}

// G-1: the Product Owner's locked copy, byte-exact, and the CQ-1 first-section form.
const LOCKED = [
  ["subjectQuestion: { ar: 'المعلومة دي عنك إنت، ولا عن حد تاني؟', en: 'Is this about you or someone else?' }", 'the subject question'],
  ["ar: 'وفيه كمان حاجات حكيتلي عنها تخص ناس تانية:',\n    en: \"And here are some things you've told me about other people:\",", 'the other-people heading'],
  ["ar: 'فيه حاجات حكيتلي عنها تخص ناس تانية:',\n    en: \"Here are some things you've told me about other people:\",", 'the other-people heading with no section before it (CQ-1)'],
];
function copyViolations(w) {
  const out = [];
  for (const [text, label] of LOCKED) if (!w.copy.includes(text)) out.push(`${label} is not the locked copy`);
  if (!/lines\.push\(relied\.length > 0 \? LINES\.inspectAboutOthers\[language\] : LINES\.inspectAboutOthersFirst\[language\]\)/u.test(w.copy)) out.push('the other-people heading is not placed after the user\'s own section');
  return out;
}

function wiringViolations(w) {
  const out = [];
  if (!/"verify:memory-subject-identity:integration": "node --env-file-if-exists=\.env database\/verify-migration-0152\.mjs"/u.test(w.packageJson)) out.push('verify-0152 has no package script');
  if (!/run: npm run verify:memory-subject-identity:integration/u.test(w.ci)) out.push('API CI does not run verify-0152');
  if (!/run: npm run test:mem-ar-01-memory-subject-identity-contract/u.test(w.ci)) out.push('API CI does not run this contract');
  return out;
}

const detectors = { writerSurfaceViolations, r2Violations, evidenceViolations, hypothesisCreationViolations, copyViolations, wiringViolations };

test('the shipped source satisfies every MEM-AR-01C detector', () => {
  for (const [name, detect] of Object.entries(detectors)) assert.deepEqual(detect(shipped), [], name);
});

const conversationRepositoryPath = 'apps/api/src/conversation/conversation.repository.ts';
const backgroundDataPath = 'apps/api/src/background-intelligence/background-intelligence-data-api.service.ts';
const planted = [
  ['a runtime file calls a revoked writer again', 'writerSurfaceViolations', (w) => ({ ...w, runtime: { ...w.runtime, [backgroundDataPath]: `${w.runtime[backgroundDataPath]}\nconst x='rpc/server_create_memory_v1';` } })],
  ['the Conversation repository goes back to v1', 'writerSurfaceViolations', (w) => ({ ...w, conversationRepository: w.conversationRepository.replace("'server_finalize_memory_control_turn_v2'", "'server_finalize_memory_control_turn_v1'"), runtime: { ...w.runtime, [conversationRepositoryPath]: w.runtime[conversationRepositoryPath].replace("'server_finalize_memory_control_turn_v2'", "'server_finalize_memory_control_turn_v1'") } })],
  ['0152 forgets one revocation', 'writerSurfaceViolations', (w) => ({ ...w, migration: w.migration.replace(/REVOKE EXECUTE ON FUNCTION public\.server_disable_memory_v1\(uuid,uuid\) FROM service_role;/u, '') })],
  ['0152 grants a table write', 'writerSurfaceViolations', (w) => ({ ...w, migration: `${w.migration}\nGRANT INSERT ON TABLE public.memory_subject_attributions TO service_role;` })],
  ['the background writer is told the owner', 'writerSurfaceViolations', (w) => ({ ...w, backgroundData: w.backgroundData.replace('p_source_turn_id: context.sourceTurnId,', 'p_source_turn_id: context.sourceTurnId, p_user_id: context.userId,') })],
  ['the R2 guard reads the words', 'r2Violations', (w) => ({ ...w, migration: w.migration.replace("WHERE c.source_turn_id = p_source_turn_id AND c.user_id = execution_row.user_id) THEN", "WHERE c.source_turn_id = p_source_turn_id AND c.user_id = execution_row.user_id) AND p_content LIKE '%' THEN") })],
  ['the R2 guard is removed', 'r2Violations', (w) => ({ ...w, migration: w.migration.replace("'SKIPPED_COMMAND_TURN'::text", "'SKIPPED'::text") })],
  ['the background writer drops the stale-capture rule', 'r2Violations', (w) => ({ ...w, migration: w.migration.replace("'SUPERSEDED_BY_LATER_COMMAND'::text", "'STALE'::text") })],
  ['a skipped capture becomes fresh Evidence', 'r2Violations', (w) => ({ ...w, enrichment: w.enrichment.replace("if(recorded.outcome!=='CREATED'&&recorded.outcome!=='ALREADY_RECORDED')return{decision:'SKIP'", "if(false)return{decision:'SKIP'") })],
  ['L2 admits every subject again', 'evidenceViolations', (w) => ({ ...w, migration: w.migration.replace("attribution.subject='SELF') -- MEM-AR-01C CC-M1 (0152)", "attribution.subject IN ('SELF','OTHER')) -- MEM-AR-01C CC-M1 (0152)") })],
  ['the TypeScript projection drops the subject filter', 'evidenceViolations', (w) => ({ ...w, evidence: w.evidence.replace("memory.subject === 'SELF' &&", '') })],
  ['UNATTRIBUTED stops tainting', 'evidenceViolations', (w) => ({ ...w, migration: w.migration.replace("'NOT_SELF','UNATTRIBUTED'))) AS tainted", "'NOT_SELF'))) AS tainted") })],
  ['the SQL completion accepts zero support', 'evidenceViolations', (w) => ({ ...w, migration: w.migration.replace("THEN RAISE EXCEPTION 'CANDIDATE_WITHOUT_SUPPORT'", "THEN NULL; -- 'CANDIDATE_WITHOUT_SUPPORT'") })],
  ['NO_SUPPORTING_EVIDENCE moves ahead of the outside-request check', 'evidenceViolations', (w) => ({ ...w, policy: w.policy.replace(" if(value.supportingEvidenceIds.length===0)return'NO_SUPPORTING_EVIDENCE';", '').replace("const allowed=new Set(", "if(value.supportingEvidenceIds.length===0)return'NO_SUPPORTING_EVIDENCE';const allowed=new Set(") })],
  ['MF-1 claims an unattributed Memory was asked for', 'evidenceViolations', (w) => ({ ...w, modelRouter: w.modelRouter.replace('which neither shows that the user asked to store it nor makes it a personal fact about the user', 'which the user asked to store') })],
  ['a runtime path creates a Hypothesis directly', 'hypothesisCreationViolations', (w) => ({ ...w, runtime: { ...w.runtime, [conversationRepositoryPath]: `${w.runtime[conversationRepositoryPath]}\nawait this.serviceApi.rpc('server_create_hypothesis_v1',{});` } })],
  ['a runtime path starts calling the background creation wrapper', 'hypothesisCreationViolations', (w) => ({ ...w, runtime: { ...w.runtime, 'apps/api/src/background-intelligence/background-intelligence-enrichment.service.ts': `${w.enrichment}\nawait this.data.createSystemHypothesis(context, input);` } })],
  ['the locked subject question drifts', 'copyViolations', (w) => ({ ...w, copy: w.copy.replace('المعلومة دي عنك إنت، ولا عن حد تاني؟', 'ده عنك ولا عن حد تاني؟') })],
  ['the CQ-1 heading keeps «كمان»', 'copyViolations', (w) => ({ ...w, copy: w.copy.replace("ar: 'فيه حاجات حكيتلي عنها تخص ناس تانية:'", "ar: 'فيه كمان حاجات حكيتلي عنها تخص ناس تانية:'") })],
  ['API CI stops running verify-0152', 'wiringViolations', (w) => ({ ...w, ci: w.ci.replace('run: npm run verify:memory-subject-identity:integration', 'run: npm run verify:nothing') })],
];
for (const [label, detector, mutate] of planted) {
  test(`planted defect is refused: ${label}`, () => {
    const mutated = mutate(shipped);
    assert.notDeepEqual(detectors[detector](mutated), [], `${detector} must refuse: ${label}`);
  });
}
