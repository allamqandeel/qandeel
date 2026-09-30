import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

// W3-MEGA-U U3 — explicit user disagreement → Contested / Under Review, with real re-evaluation and reliance
// (E2E-D-15; PG-01). Static contract. Every detector passes on the shipped source and fails on a planted defect.

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`])\/\/[^\n]*/gu, '$1').replace(/^\s*--[^\n]*$/gmu, '');
const MIGRATION = 'database/migrations/0127_understanding_contest_v1.sql';
const src = {
  migration: read(MIGRATION),
  service: read('apps/api/src/understanding/understanding.service.ts'),
  confidence: read('apps/api/src/hypothesis/confidence.service.ts'),
  otherMigrations: readdirSync(new URL('database/migrations/', root)).filter((name) => name.endsWith('.sql') && !MIGRATION.endsWith(name))
    .map((name) => read(`database/migrations/${name}`)).join('\n'),
  mobileUnderstanding: ['apps/mobile/src/understanding', 'apps/mobile/src/runtime-entry'].flatMap((dir) =>
    readdirSync(new URL(dir, root), { recursive: true })
      .filter((name) => /\.tsx?$/u.test(name) && !/__tests__/u.test(name))
      .map((name) => read(`${dir}/${String(name).replace(/\\/gu, '/')}`))).join('\n'),
  projection: read('apps/api/src/understanding/understanding-projection.ts'),
  reasoning: read('apps/api/src/hypothesis/hypothesis-reasoning-context.service.ts'),
  signals: read('apps/api/src/hypothesis/hypothesis-user-signal.repository.ts'),
  guidance: read('apps/api/src/model-router/model-router.types.ts'),
  controller: read('apps/mobile/src/understanding/understanding-controller.ts'),
  api: read('apps/mobile/src/runtime-entry/understanding-api.ts'),
  strip: read('apps/mobile/src/understanding/UnderstandingDiscussionStrip.tsx'),
  // The Conversation turn path, API and mobile: where keyword interception of a disagreement would have to live.
  conversationPath: ['apps/api/src/conversation', 'apps/mobile/src/conversation'].flatMap((dir) =>
    readdirSync(new URL(dir, root), { recursive: true })
      .filter((name) => /\.tsx?$/u.test(name) && !/spec|test|__fixtures__/u.test(name))
      .map((name) => read(`${dir}/${String(name).replace(/\\/gu, '/')}`))).join('\n'),
};
const plant = (key, from, to) => {
  assert.ok(src[key].includes(from), `planting anchor missing in ${key}: ${from}`);
  return { ...src, [key]: src[key].replace(from, to) };
};
const fnBody = (sql, name) => {
  const start = sql.indexOf(`CREATE FUNCTION ${name}(`);
  return start < 0 ? '' : sql.slice(start, sql.indexOf('$$;', start));
};

// ---------------------------------------------------------------------------------------------------------------
// Detectors.

function privilegeViolations(world) {
  const out = [];
  const sql = code(world.migration);
  const definers = [...sql.matchAll(/CREATE FUNCTION (\w+)\.(\w+)\([^)]*\)[\s\S]*?SECURITY (DEFINER|INVOKER)/gu)];
  if (definers.length === 0) out.push('no function found');
  for (const [, schema, name, kind] of definers) if (kind === 'DEFINER' && schema !== 'understanding_private') out.push(`DEFINER ${schema}.${name} in an exposed schema`);
  if (!/CREATE FUNCTION public\.record_understanding_disagreement_v1\([\s\S]*?SECURITY INVOKER/u.test(sql)) out.push('the Product RPC is not INVOKER');
  if (/GRANT [^;]*\b(?:INSERT|UPDATE|DELETE|ALL|TRUNCATE)\b[^;]*ON TABLE public\.understanding_contests/u.test(sql)) out.push('a client write grant on contests');
  if (/GRANT[^;]*TO (?:anon|service_role|PUBLIC)/iu.test(sql)) out.push('a grant to anon, service_role or PUBLIC');
  if (/p_user_id|p_owner/u.test(sql)) out.push('a caller-supplied owner');
  if (!/v_user uuid := \(SELECT auth\.uid\(\)\);/u.test(sql)) out.push('the owner is not auth.uid()');
  return out;
}

function noTextViolations(world) {
  const out = [];
  const table = code(world.migration).match(/CREATE TABLE public\.understanding_contests \(([\s\S]*?)\n\);/u)?.[1] ?? '';
  const columns = [...table.matchAll(/^\s{2}(\w+) (\w+)/gmu)].map((m) => m[1]).filter((name) => name !== 'CONSTRAINT');
  if (columns.length === 0) out.push('no table found');
  for (const column of columns) if (/message|content|text|reason|rationale|statement|note|payload|score|band|weight/iu.test(column)) out.push(`a content or score column: ${column}`);
  if (/content|message/iu.test(code(world.api).match(/JSON\.stringify\(\{ commandId, revision \}\)/u)?.[0] ?? 'missing')) out.push('the disagreement carries text');
  if (!/body: JSON\.stringify\(\{ commandId, revision \}\)/u.test(world.api)) out.push('the disagreement body is not exactly the command and the revision');
  if (!/Object\.keys\(value\)\.length !== 2/u.test(world.service)) out.push('the server accepts a widened disagreement body');
  return out;
}

function reevaluationViolations(world) {
  const out = [];
  const body = code(fnBody(world.migration, 'understanding_private.record_understanding_disagreement_v1'));
  if (!/public\.transition_hypothesis_core_v1\(v_user, v_item\.id, v_item\.version, 'MIXED', 'AUTHENTICATED_TRANSITION'\)/u.test(body)) out.push('the re-evaluation does not go through the audited lifecycle core at the exact version');
  if (/UPDATE public\.hypotheses|INSERT INTO public\.hypothesis_lifecycle_transitions/u.test(body)) out.push('a second, unaudited Hypothesis mutation path');
  if (!/await this\.confidenceRuntime\.ensureHypothesisVersionEvaluation\(userId, token, hypothesisId, version, evaluationId\);/u.test(world.service)) out.push('no exact-version Confidence re-evaluation');
  if (!/await this\.reevaluateConfidence\(userId, token, hypothesis\.id, row\.reevaluated_version as number, row\.confidence_evaluation_id\);/u.test(world.service)) out.push('Confidence is not evaluated at the re-evaluated version');
  return out;
}

// R2 — one durable Confidence evaluation identity per contest, and every retry path converges on it.
function exactlyOnceConfidenceViolations(world) {
  const out = [];
  const sql = code(world.migration);
  const table = sql.match(/CREATE TABLE public\.understanding_contests \(([\s\S]*?)\n\);/u)?.[1] ?? '';
  if (!/^\s{2}confidence_evaluation_id uuid NOT NULL,$/mu.test(table)) out.push('the contest has no durable Confidence evaluation identity');
  if (!/CONSTRAINT understanding_contests_confidence_evaluation_key UNIQUE \(confidence_evaluation_id\)/u.test(table)) out.push('two contests could share an evaluation identity');
  const body = code(fnBody(world.migration, 'understanding_private.record_understanding_disagreement_v1'));
  if (!/v_evaluation uuid := pg_catalog\.gen_random_uuid\(\);/u.test(body) || !/v_after_version, v_evaluation, clock_timestamp\(\)\);/u.test(body)) out.push('the identity is not generated by the database once, with the contest');
  const answers = [...body.matchAll(/RETURN QUERY SELECT '(RECORDED|ALREADY_UNDER_REVIEW)'::text, ([^;]*);/gu)].map((m) => [m[1], m[2].split(',').at(-1).trim()]);
  const expected = [['RECORDED', 'v_prior.confidence_evaluation_id'], ['ALREADY_UNDER_REVIEW', 'v_prior.confidence_evaluation_id'], ['RECORDED', 'v_evaluation']];
  if (JSON.stringify(answers) !== JSON.stringify(expected)) out.push('a replay or an already-under-review answer does not return the contest’s own identity');
  if (!/CREATE TRIGGER understanding_contests_facts_immutable\s+BEFORE UPDATE ON public\.understanding_contests/u.test(sql) ||
    !/NEW\.confidence_evaluation_id, NEW\.created_at\)\s+IS DISTINCT FROM/u.test(sql)) out.push('the evaluation identity can be changed after it was recorded');
  // The contest workflow ENSURES under that identity; it never reads "any exact-version row" and creates a random one.
  const reevaluate = code(world.service).match(/private async reevaluateConfidence\([\s\S]*?\n {2}\}/u)?.[0] ?? '';
  if (/listExactVersionsForTargets|evaluateHypothesisVersion\(/u.test(reevaluate) || !reevaluate) out.push('the contest uses a read-then-create-random Confidence pattern');
  if (/confidenceRuntime\.evaluateHypothesisVersion/u.test(code(world.service))) out.push('the contest workflow can create a Confidence row under a fresh identity');
  const ensure = code(world.confidence).match(/async ensureHypothesisVersionEvaluation\([\s\S]*?\n {2}\}/u)?.[0] ?? '';
  if (!/this\.repository\.create\(token, \{ \.\.\.evaluation, id: evaluationId, target_version: targetVersion \}\)/u.test(ensure)) out.push('the canonical create is not made under the contest’s identity, so concurrent creates can duplicate');
  if ((ensure.match(/await this\.repository\.find\(token, userId, evaluationId\)/gu) ?? []).length !== 2) out.push('the ensure does not look up, and then converge on, the same identity');
  if (/randomUUID/u.test(ensure)) out.push('the ensure mints a fresh identity');
  if (!/const \{ evaluation \} = await this\.snapshot\(userId, token, hypothesisId\);/u.test(ensure)) out.push('the ensure does not use the Confidence Runtime’s canonical snapshot');
  // Confidence history keeps its semantics: no (target, version) uniqueness anywhere.
  const confidenceUnique = /CREATE UNIQUE INDEX[^;]*ON public\.confidence_evaluations|ALTER TABLE public\.confidence_evaluations[^;]*UNIQUE[^;]*target_version/iu;
  if (confidenceUnique.test(sql) || confidenceUnique.test(code(world.otherMigrations))) out.push('a global Confidence (target, version) uniqueness shortcut');
  // Internal ids stay on the server.
  if (/confidence_evaluation_id|evaluationId/u.test(code(world.mobileUnderstanding))) out.push('the mobile client handles the evaluation identity');
  if (!/return \{ underReview: true, revision: understandingRevision\(userId, hypothesisId, version\) \};/u.test(world.service)) out.push('the disagreement answer is not exactly { underReview, revision }');
  return out;
}

function exactVersionViolations(world) {
  const out = [];
  const body = code(fnBody(world.migration, 'understanding_private.record_understanding_disagreement_v1'));
  if (!/FOR UPDATE;/u.test(body)) out.push('the item is not locked before the checks');
  if (!/IF v_item\.version <> p_expected_version THEN\s*RETURN QUERY SELECT 'STALE'/u.test(body)) out.push('a stale version is not refused');
  if (!/CREATE UNIQUE INDEX understanding_contests_one_under_review_idx\s+ON public\.understanding_contests \(user_id, hypothesis_id\) WHERE lifecycle = 'UNDER_REVIEW';/u.test(world.migration)) out.push('two contests under review could exist for one item');
  if (!/CONSTRAINT understanding_contests_command_key UNIQUE \(user_id, command_id\)/u.test(world.migration)) out.push('a command could be recorded twice');
  if (!/transport\.disagree\(ref, commandId, revision\)/u.test(world.controller)) out.push('the mobile act is not bound to the revision shown');
  if (!/if \(command === null \|\| command\.ref !== ref \|\| command\.revision !== revision\) command = \{ ref, revision, id: newCommandId\(\) \};/u.test(world.controller)) out.push('a retry is not the same command');
  return out;
}

function noDeletionViolations(world) {
  const out = [];
  const sql = code(world.migration);
  if (/DELETE FROM public\.hypotheses|'REJECTED'|'RETIRED'|DROP /u.test(sql)) out.push('a disagreement deletes, rejects or retires the item');
  if (/lifecycle IN \('UNDER_REVIEW'[^)]*'(?:RESOLVED|CLEARED|CLOSED)/u.test(sql) || /SET lifecycle/u.test(sql)) out.push('an automatic resolution of the contest');
  return out;
}

function relianceViolations(world) {
  const out = [];
  if (!/contested: context\.contests\.has\(hypothesis\.id\),/u.test(world.service)) out.push('the Product projection ignores the contest');
  if (!/if \(facts\.contested\) return 'MIXED';/u.test(world.projection)) out.push('a contested item is not Mixed');
  if (!/if \(value\.underReview === true && value\.confidence !== 'MIXED'\) reject\(\);/u.test(world.projection)) out.push('an item under review could be shown as anything but Mixed');
  if (!/\.\.\.\(underReview\.has\(candidate\.id\) \? \{ userContest: 'UNDER_REVIEW' as const \} : \{\}\),/u.test(world.reasoning)) out.push('the provider context does not carry the contest');
  // R1: contests never lapse, so every contest read is bound to the exact current ids — never a capped window.
  if (!/hypothesis_id: `in\.\(\$\{hypothesisIds\.join\(','\)\}\)`/u.test(world.signals)) out.push('the provider-side contest read is not bound to the current items');
  if (/limit: '64'/u.test(world.signals)) out.push('a capped contest window');
  if (!/this\.signals \? this\.signals\.listUnderReview\(token, userId, candidates\.map\(\(\{ id \}\) => id\)\)/u.test(world.reasoning)) out.push('the provider context does not read the contests');
  if (!/userContest UNDER_REVIEW is one the user has explicitly disagreed with: it is contested and under review, so do not rely on it/u.test(world.guidance)) out.push('the guidance does not reduce reliance on a contested item');
  if (/userContest[^.]*(?:certain|confirmed|true)/iu.test(world.guidance.match(/A hypothesis carrying userContest[^.]*\.[^.]*\./u)?.[0] ?? '')) out.push('the guidance turns a contest into certainty');
  return out;
}

function explicitTriggerViolations(world) {
  const out = [];
  // No keyword interception: nothing in the Conversation turn path looks at what the reader typed for a disagreement.
  if (world.conversationPath.length < 1000) out.push('the conversation path was not read');
  if (/disagree|contest|I see it differently|أراه بشكل مختلف/iu.test(code(world.conversationPath))) out.push('the conversation path interprets what the reader says as a disagreement');
  if (!/onPress=\{\(\) => \{\n\s*void controller\.disagree\(\);/u.test(world.strip)) out.push('the act is not one explicit control');
  return out;
}

const DETECTORS = { privilegeViolations, noTextViolations, reevaluationViolations, exactlyOnceConfidenceViolations, exactVersionViolations, noDeletionViolations, relianceViolations, explicitTriggerViolations };

test('0127 directly follows 0126 and is additive', () => {
  const names = readdirSync(new URL('database/migrations/', root)).filter((name) => name.endsWith('.sql')).sort();
  assert.equal(names[names.indexOf('0126_understanding_discussion_focus_v1.sql') + 1], '0127_understanding_contest_v1.sql');
  assert.doesNotMatch(code(src.migration), /DROP |CREATE OR REPLACE|ALTER TABLE public\.hypotheses/u, 'nothing existing is dropped, replaced or altered');
});

test('the shipped runtime is clean under every detector', () => {
  for (const [name, detector] of Object.entries(DETECTORS)) assert.deepEqual(detector(src), [], name);
});

const PLANTED = [
  ['a DEFINER in the exposed schema', 'privilegeViolations', () => plant('migration', 'LANGUAGE sql\nVOLATILE\nSECURITY INVOKER', 'LANGUAGE sql\nVOLATILE\nSECURITY DEFINER')],
  ['a client write grant', 'privilegeViolations', () => plant('migration', 'GRANT SELECT ON TABLE public.understanding_contests TO authenticated;', 'GRANT SELECT, INSERT ON TABLE public.understanding_contests TO authenticated;')],
  ['a caller-supplied owner', 'privilegeViolations', () => plant('migration', 'p_command_id uuid, p_hypothesis_id uuid, p_expected_version integer\n) RETURNS TABLE', 'p_command_id uuid, p_hypothesis_id uuid, p_expected_version integer, p_user_id uuid\n) RETURNS TABLE')],
  ['the reader’s message stored', 'noTextViolations', () => plant('migration', '  created_at timestamptz NOT NULL,\n  CONSTRAINT understanding_contests_owner_fk', '  created_at timestamptz NOT NULL,\n  message text,\n  CONSTRAINT understanding_contests_owner_fk')],
  ['the reader’s words sent', 'noTextViolations', () => plant('api', 'body: JSON.stringify({ commandId, revision })', 'body: JSON.stringify({ commandId, revision, content })')],
  ['a cosmetic re-evaluation (no lifecycle step)', 'reevaluationViolations', () => plant('migration', "FROM public.transition_hypothesis_core_v1(v_user, v_item.id, v_item.version, 'MIXED', 'AUTHENTICATED_TRANSITION') t;", 'FROM (SELECT v_item.version + 1 AS version) t;')],
  ['an unaudited status write', 'reevaluationViolations', () => plant('migration', '  INSERT INTO public.understanding_contests (', "  UPDATE public.hypotheses SET status = 'MIXED' WHERE id = v_item.id;\n  INSERT INTO public.understanding_contests (")],
  ['no Confidence re-evaluation', 'reevaluationViolations', () => plant('service', 'await this.confidenceRuntime.ensureHypothesisVersionEvaluation(userId, token, hypothesisId, version, evaluationId);', 'return;')],
  ['R2: a contest with no durable Confidence evaluation identity', 'exactlyOnceConfidenceViolations', () => plant('migration', '  confidence_evaluation_id uuid NOT NULL,\n', '')],
  ['R2: a replay that generates a fresh evaluation identity', 'exactlyOnceConfidenceViolations', () => plant('migration', "RETURN QUERY SELECT 'RECORDED'::text, v_prior.contested_version, v_prior.reevaluation_after_version, v_prior.confidence_evaluation_id;", "RETURN QUERY SELECT 'RECORDED'::text, v_prior.contested_version, v_prior.reevaluation_after_version, pg_catalog.gen_random_uuid();")],
  ['R2: an already-under-review repair under a fresh identity', 'exactlyOnceConfidenceViolations', () => plant('migration', "RETURN QUERY SELECT 'ALREADY_UNDER_REVIEW'::text, v_prior.contested_version, v_prior.reevaluation_after_version, v_prior.confidence_evaluation_id;", "RETURN QUERY SELECT 'ALREADY_UNDER_REVIEW'::text, v_prior.contested_version, v_prior.reevaluation_after_version, pg_catalog.gen_random_uuid();")],
  ['R2: a mutable evaluation identity', 'exactlyOnceConfidenceViolations', () => plant('migration', 'CREATE TRIGGER understanding_contests_facts_immutable', 'CREATE TRIGGER understanding_contests_audit')],
  ['R2: read any exact-version row, then create under a random id', 'exactlyOnceConfidenceViolations', () => plant('service', 'await this.confidenceRuntime.ensureHypothesisVersionEvaluation(userId, token, hypothesisId, version, evaluationId);', "const existing = await this.confidence.listExactVersionsForTargets(token, userId, [{ id: hypothesisId, version }]);\n      if (existing.length > 0) return;\n      await this.confidenceRuntime.evaluateHypothesisVersion(userId, token, hypothesisId, version);")],
  ['R2: concurrent creates that can each insert their own row', 'exactlyOnceConfidenceViolations', () => plant('confidence', '{ ...evaluation, id: evaluationId, target_version: targetVersion }', '{ ...evaluation, target_version: targetVersion }')],
  ['R2: a loser that never converges on the winner’s row', 'exactlyOnceConfidenceViolations', () => plant('confidence', "      const winner = await this.repository.find(token, userId, evaluationId);\n      if (!winner) throw error;\n      return this.exactEvaluation(winner, userId, hypothesisId, targetVersion, evaluationId);", '      throw error;')],
  ['R2: a global (target, version) Confidence uniqueness shortcut', 'exactlyOnceConfidenceViolations', () => plant('migration', 'ALTER TABLE public.understanding_contests OWNER TO postgres;', 'CREATE UNIQUE INDEX confidence_one_per_version ON public.confidence_evaluations (user_id, target_id, target_version);\nALTER TABLE public.understanding_contests OWNER TO postgres;')],
  ['R2: the evaluation identity sent to mobile', 'exactlyOnceConfidenceViolations', () => plant('service', 'return { underReview: true, revision: understandingRevision(userId, hypothesisId, version) };', 'return { underReview: true, revision: understandingRevision(userId, hypothesisId, version), evaluationId: hypothesisId };')],
  ['Confidence evaluated at a later version', 'reevaluationViolations', () => plant('service', 'await this.reevaluateConfidence(userId, token, hypothesis.id, row.reevaluated_version as number, row.confidence_evaluation_id);', 'await this.reevaluateConfidence(userId, token, hypothesis.id, hypothesis.version, row.confidence_evaluation_id);')],
  ['the objection applied to a newer interpretation', 'exactVersionViolations', () => plant('migration', "  IF v_item.version <> p_expected_version THEN\n    RETURN QUERY SELECT 'STALE'", "  IF false THEN\n    RETURN QUERY SELECT 'STALE'")],
  ['two contests under review for one item', 'exactVersionViolations', () => plant('migration', "ON public.understanding_contests (user_id, hypothesis_id) WHERE lifecycle = 'UNDER_REVIEW';", 'ON public.understanding_contests (user_id, hypothesis_id, command_id);')],
  ['a retry that is a new command', 'exactVersionViolations', () => plant('controller', 'if (command === null || command.ref !== ref || command.revision !== revision) command = { ref, revision, id: newCommandId() };', 'command = { ref, revision, id: newCommandId() };')],
  ['a disagreement that deletes the item', 'noDeletionViolations', () => plant('migration', '  INSERT INTO public.understanding_contests (', "  DELETE FROM public.hypotheses WHERE id = v_item.id;\n  INSERT INTO public.understanding_contests (")],
  ['a disagreement that rejects the item', 'noDeletionViolations', () => plant('migration', "v_item.id, v_item.version, 'MIXED', 'AUTHENTICATED_TRANSITION'", "v_item.id, v_item.version, 'REJECTED', 'AUTHENTICATED_TRANSITION'")],
  ['a contest auto-resolved', 'noDeletionViolations', () => plant('migration', "CHECK (lifecycle IN ('UNDER_REVIEW'))", "CHECK (lifecycle IN ('UNDER_REVIEW', 'RESOLVED'))")],
  ['a decorative badge (projection ignores it)', 'relianceViolations', () => plant('service', 'contested: context.contests.has(hypothesis.id),', 'contested: false,')],
  ['a capped, unfiltered contest window', 'relianceViolations', () => plant('signals', "hypothesis_id: `in.(${hypothesisIds.join(',')})`, limit: String(hypothesisIds.length),", "limit: '64',")],
  ['the provider never told', 'relianceViolations',() => plant('reasoning', "...(underReview.has(candidate.id) ? { userContest: 'UNDER_REVIEW' as const } : {}),", '')],
  ['guidance that keeps relying on it', 'relianceViolations', () => plant('guidance', 'so do not rely on it', 'so rely on it as usual')],
  ['keyword interception in the conversation path', 'explicitTriggerViolations', () => ({ ...src, conversationPath: `${src.conversationPath}\nif (/I disagree|that is wrong/i.test(content)) await understanding.disagree(ref);` })],
  ['a disagreement not made by one explicit control', 'explicitTriggerViolations', () => plant('strip', 'void controller.disagree();', 'void controller.endDiscussion();')],
];

for (const [name, detector, world] of PLANTED) {
  test(`planted defect is rejected: ${name}`, () => {
    assert.notDeepEqual(DETECTORS[detector](world()), [], `${detector} missed: ${name}`);
  });
}

test('PG-01 is claimed only by this runtime; PG-02 and PG-04 are not claimed', () => {
  const record = read('docs/e2e/QANDEEL_W3_MEGA_U_UNDERSTANDING_CONTESTED_IMPLEMENTATION_RECORD_v1.md');
  assert.match(record, /PG-01/u);
  const overclaim = (text) => /PG-0[24][^\n.]*\b(?:CLOSED|IMPLEMENTED|closed|implemented)\b(?![^\n.]*\bnot\b)/u.test(text.replace(/(?:is|are|remain|remains|stays|stay) (?:NOT|not)[^\n.]*/gu, ''));
  assert.equal(overclaim(record), false);
  assert.equal(overclaim(`${record}\nPG-04 is implemented here.`), true, 'a planted over-claim is detected');
});

test('the contract and the verifier are registered', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['test:w3-mega-u3-contested-runtime-contract'], 'node --test tests/w3-mega-u3-contested-runtime-contract.test.mjs');
  assert.equal(pkg.scripts['verify:understanding-contest:integration'], 'node --env-file-if-exists=.env database/verify-migration-0127.mjs');
  const ci = read('.github/workflows/api-ci.yml');
  assert.match(ci, /run: npm run test:w3-mega-u3-contested-runtime-contract\}/u);
  assert.match(ci, /run: npm run verify:understanding-contest:integration/u);
});
