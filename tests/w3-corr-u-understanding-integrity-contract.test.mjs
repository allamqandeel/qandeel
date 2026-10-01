import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

// W3-CORR-U — Understanding Integrity (U-1 focus continuity, U-2 contest resolution, U-3 no discussion prerequisite,
// U-4 regression, U-5 bounded provider priority). Static contract. Every detector passes on the shipped source and
// fails on each planted defect of the task's §18 list; the real-PostgreSQL behaviour is database/verify-migration-0134.mjs.

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (text) => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const ts = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`])\/\/[^\n]*/gu, '$1');
const sql = (text) => text.replace(/^\s*--[^\n]*$/gmu, '');
const MIGRATION = 'database/migrations/0134_understanding_integrity_v1.sql';
const src = {
  migration: read(MIGRATION),
  migration0127: read('database/migrations/0127_understanding_contest_v1.sql'),
  service: read('apps/api/src/understanding/understanding.service.ts'),
  repository: read('apps/api/src/understanding/understanding.repository.ts'),
  controller: read('apps/api/src/understanding/understanding.controller.ts'),
  reasoning: read('apps/api/src/hypothesis/hypothesis-reasoning-context.service.ts'),
  reasoningTypes: read('apps/api/src/hypothesis/hypothesis-reasoning-context.types.ts'),
  api: read('apps/mobile/src/runtime-entry/understanding-api.ts'),
  mobileController: read('apps/mobile/src/understanding/understanding-controller.ts'),
  strip: read('apps/mobile/src/understanding/UnderstandingDiscussionStrip.tsx'),
  copy: read('apps/mobile/src/understanding/copy.ts'),
};
const plant = (key, from, to) => {
  assert.ok(src[key].includes(from), `planting anchor missing in ${key}: ${from}`);
  return { ...src, [key]: src[key].replace(from, to) };
};
/** One plpgsql function's text, from its header to its closing `$$;` (CREATE or CREATE OR REPLACE). */
const fnBody = (text, name) => {
  const start = text.search(new RegExp(`CREATE (?:OR REPLACE )?FUNCTION ${name.replace(/\./gu, '\\.')}\\(`, 'u'));
  return start < 0 ? '' : text.slice(start, text.indexOf('$$;', start));
};
/** A TypeScript method's text, from its name to the next method at the same indentation. */
const method = (text, header) => {
  const start = text.indexOf(header);
  if (start < 0) return '';
  const next = text.slice(start + header.length).search(/\n {2}(?:private |async |[a-z]\w*\()/u);
  return next < 0 ? text.slice(start) : text.slice(start, start + header.length + next);
};
const RECORD = 'understanding_private.record_understanding_disagreement_v1';
const RESOLVE = 'understanding_private.resolve_understanding_disagreement_v1';
const focusUpdates = (text) => [...sql(text).matchAll(/UPDATE public\.understanding_discussion_focus f[\s\S]*?;/gu)].map((m) => m[0]);

// ---------------------------------------------------------------------------------------------------------------
// Detectors.

/** U-1 — the open focus follows the disagreement's own version step, atomically, and nothing else moves it. */
function focusContinuityViolations(world) {
  const out = [];
  const record = sql(fnBody(world.migration, RECORD));
  if (!/IF v_after_version <> v_item\.version THEN\s+UPDATE public\.understanding_discussion_focus f\s+SET hypothesis_version = v_after_version\s+WHERE f\.user_id = v_user AND f\.hypothesis_id = v_item\.id AND f\.closed_at IS NULL\s+AND f\.hypothesis_version = v_item\.version;/u.test(record)) {
    out.push('the disagreement does not re-bind the reader’s open focus on this item at the contested version (1)');
  }
  const updates = focusUpdates(world.migration);
  if (updates.length !== 4) out.push(`expected exactly four guarded focus UPDATEs (record, two repairs, one reconciliation), found ${updates.length}`);
  for (const update of updates) {
    if (/opened_at|closed_at\s*=/u.test(update.replace(/WHERE[\s\S]*$/u, ''))) out.push('a focus UPDATE resets opened_at or closed_at (2/3)');
    if (!/f\.closed_at IS NULL/u.test(update)) out.push('a focus UPDATE can match a closed focus (3)');
    if (!/f\.hypothesis_id = /u.test(update) || !/f\.user_id = /u.test(update)) out.push('a focus UPDATE is not bound to the same reader and item (5)');
    if (!/SET hypothesis_version = /u.test(update) || /SET[^W]*hypothesis_id\s*=/u.test(update)) out.push('a focus UPDATE moves the focus to another item');
  }
  // The two repairs: exactly the contest's lawful after-version, one step past the contested one, the item exactly there.
  const repairs = updates.filter((update) => /v_prior\./u.test(update));
  if (repairs.length !== 2 || repairs.some((r) => !/AND f\.hypothesis_version = v_prior\.contested_version/u.test(r) ||
    !/AND v_prior\.reevaluation_after_version = v_prior\.contested_version \+ 1/u.test(r) || !/AND v_item\.version = v_prior\.reevaluation_after_version/u.test(r) ||
    !/f\.hypothesis_id = v_prior\.hypothesis_id/u.test(r))) out.push('a replay or ALREADY_UNDER_REVIEW repair can move a focus that does not meet the exact facts (5)');
  // Nothing outside the commands and the one reconciliation moves a focus: no trigger on Hypotheses (4).
  if (/ON public\.hypotheses\b/u.test(sql(world.migration)) || /CREATE TRIGGER[^;]*understanding_discussion_focus/u.test(sql(world.migration))) out.push('an arbitrary Hypothesis update can slide a focus (4)');
  return out;
}

/** U-2 — UNDER_REVIEW → RESOLVED, forward-only, history preserved, nothing manufactured. */
function lifecycleViolations(world) {
  const out = [];
  const m = sql(world.migration);
  if (!/ADD CONSTRAINT understanding_contests_lifecycle_check\s+CHECK \(lifecycle IN \('UNDER_REVIEW', 'RESOLVED'\)\);/u.test(m)) out.push('the lifecycle is not exactly UNDER_REVIEW | RESOLVED');
  if (/\bDELETE\b|DROP (?:TABLE|INDEX|TRIGGER|FUNCTION|POLICY)|TRUNCATE/u.test(m)) out.push('history can be deleted, or a guard dropped (6/7/16)');
  if (/CREATE OR REPLACE FUNCTION understanding_private\.understanding_contest_facts_immutable_v1/u.test(m)) out.push('the original facts trigger is rewritten (7)');
  if (!/IF OLD\.lifecycle = 'RESOLVED' THEN\s+RAISE EXCEPTION 'UNDERSTANDING_CONTEST_RESOLUTION_FINAL'/u.test(m) ||
    !/CREATE TRIGGER understanding_contests_lifecycle_forward_only\s+BEFORE UPDATE ON public\.understanding_contests/u.test(m)) out.push('a resolved contest can move again (15)');
  if (/SET lifecycle = 'UNDER_REVIEW'|lifecycle\s*=\s*'UNDER_REVIEW',/u.test(m)) out.push('a contest is reopened instead of a new row (15)');
  if (!/understanding_contests_resolution_check CHECK \(/u.test(m) || !/resolved_at >= created_at/u.test(m) || !/resolved_version >= reevaluation_after_version/u.test(m) ||
    !/\(resolution_reason = 'USER_CONFIRMED_CURRENT_INTERPRETATION' AND resolution_command_id IS NOT NULL\)/u.test(m) ||
    !/\(resolution_reason = 'INTERPRETATION_WITHDRAWN' AND resolution_command_id IS NULL\)/u.test(m)) out.push('the resolution facts are not shaped by the database');
  // 0127's one-under-review index is kept, untouched.
  if (!/CREATE UNIQUE INDEX understanding_contests_one_under_review_idx\s+ON public\.understanding_contests \(user_id, hypothesis_id\) WHERE lifecycle = 'UNDER_REVIEW';/u.test(world.migration0127)) out.push('two contests under review could exist (16)');
  const resolve = sql(fnBody(world.migration, RESOLVE));
  if (!resolve) out.push('no resolution command');
  if (/transition_hypothesis|UPDATE public\.hypotheses|INSERT INTO public\.(?:hypothes|confidence)|create_confidence_evaluation/u.test(resolve)) out.push('the resolution moves the Hypothesis or manufactures Confidence (10)');
  const set = resolve.match(/UPDATE public\.understanding_contests c\s+SET ([\s\S]*?)\s+WHERE/u)?.[1] ?? '';
  const columns = [...set.matchAll(/(\w+) = /gu)].map((x) => x[1]).sort();
  if (JSON.stringify(columns) !== JSON.stringify(['lifecycle', 'resolution_command_id', 'resolution_reason', 'resolved_at', 'resolved_version'])) out.push(`the resolution writes more than the resolution facts: ${columns}`);
  if (!/resolution_reason = 'USER_CONFIRMED_CURRENT_INTERPRETATION', resolution_command_id = p_command_id/u.test(resolve)) out.push('the reason is not server-owned (13)');
  if (!/CREATE FUNCTION understanding_private\.resolve_understanding_disagreement_v1\(\n  p_command_id uuid, p_hypothesis_id uuid, p_expected_version integer\n\) RETURNS TABLE/u.test(world.migration)) out.push('the resolution accepts more than a command, an item and a version (13)');
  if (!/IF v_item\.version <> p_expected_version THEN\s+RETURN QUERY SELECT 'STALE'/u.test(resolve)) out.push('a stale revision can be resolved (12)');
  const replay = resolve.indexOf('c.resolution_command_id = p_command_id');
  if (replay < 0 || replay > resolve.indexOf("'NOT_FOUND'") || !/CONSTRAINT understanding_contests_resolution_command_key\s+UNIQUE \(user_id, resolution_command_id\)/u.test(m)) out.push('the resolution command is not idempotent (14)');
  if (!/FOR UPDATE;/u.test(resolve.slice(0, resolve.indexOf('c.resolution_command_id')))) out.push('the item is not locked before the resolution checks');
  return out;
}

/** Withdrawal resolves; system confidence never does. */
function withdrawalViolations(world) {
  const out = [];
  const m = sql(world.migration);
  if (!/CREATE TRIGGER hypothesis_lifecycle_transitions_withdraw_understanding_contest\s+AFTER INSERT ON public\.hypothesis_lifecycle_transitions\s+FOR EACH ROW WHEN \(NEW\.after_status IN \('REJECTED', 'RETIRED'\)\)/u.test(m)) out.push('withdrawal is not exactly REJECTED / RETIRED (9)');
  if (/ON public\.confidence_evaluations|ON public\.hypothesis_updates/u.test(m)) out.push('system Confidence or Evidence can resolve a contest (8)');
  const withdraw = sql(fnBody(world.migration, 'understanding_private.resolve_withdrawn_understanding_contest_v1'));
  if (!/resolution_reason = 'INTERPRETATION_WITHDRAWN'/u.test(withdraw) || /resolution_command_id/u.test(withdraw)) out.push('a withdrawal is attributed to the reader (26)');
  // The API: the only path to a resolution is the reader's own command.
  if ((ts(world.service).match(/this\.repository\.resolveDisagreement\(/gu) ?? []).length !== 1) out.push('a resolution is reachable outside the explicit command (8)');
  return out;
}

/** The API and mobile boundary of the explicit resolution. */
function resolutionBoundaryViolations(world) {
  const out = [];
  const body = ts(method(world.service, 'async resolveDisagreement('));
  if (!body) out.push('no resolution in the service');
  if (/confidenceRuntime|reevaluateConfidence|telemetry|recordReevaluation|ModelRouter|provider/iu.test(body)) out.push('the resolution calls a provider, Confidence or telemetry (11/24)');
  if (!/this\.validateDisagreementBody\(body\)/u.test(body)) out.push('the resolution body is not exactly a command and a revision (13)');
  if (!/const seen = seenVersion\(hypothesis\.version, \(version\) => understandingRevision\(userId, hypothesis\.id, version\) === revision\);\n\s+if \(seen === undefined\) throw this\.changed\(\);\n\s+const rows = await this\.repository\.resolveDisagreement\(token, commandId, hypothesis\.id, seen\);/u.test(body) ||
    !/if \(row\.resolved_version !== seen\) this\.reject\(\);/u.test(body)) out.push('the API resolves a revision the reader did not see (12)');
  if (!/return \{ underReview: false, revision: understandingRevision\(userId, hypothesis\.id, hypothesis\.version\) \};/u.test(body)) out.push('the resolution answer is not exactly { underReview, revision }');
  if (!/@Post\('items\/:ref\/disagreement\/resolve'\)/u.test(world.controller)) out.push('no resolution route');
  if (!/'rpc\/resolve_understanding_disagreement_v1', \{\n\s+method: 'POST', body: JSON\.stringify\(\{ p_command_id: commandId, p_hypothesis_id: hypothesisId, p_expected_version: expectedVersion \}\),/u.test(world.repository)) out.push('the repository sends more than the command, the item and the version (13)');
  const mobile = ts(method(world.api, 'async resolveDisagreement('));
  if (!/body: JSON\.stringify\(\{ commandId, revision \}\)/u.test(mobile) || /reason|userId|user_id/u.test(mobile)) out.push('the mobile request carries a reason or an identity (13)');
  // U-4: telemetry stays exactly PROD-OPS-01's one content-free re-evaluation signal.
  if ((ts(world.service).match(/this\.telemetry\.recordOperationalOutcome\(/gu) ?? []).length !== 1) out.push('Confidence telemetry duplicated (24)');
  return out;
}

/** U-3 — no server-side discussion prerequisite for a disagreement. */
function noPrerequisiteViolations(world) {
  const out = [];
  const record = sql(fnBody(world.migration, RECORD));
  const beforeRecord = record.slice(0, record.indexOf('INSERT INTO public.understanding_contests'));
  if (/FROM public\.understanding_discussion_focus|EXISTS \([^)]*understanding_discussion_focus/u.test(beforeRecord)) out.push('an open discussion became a prerequisite for disagreement (18)');
  const disagree = ts(method(world.service, 'async disagree('));
  if (/iscussion|focus/iu.test(disagree)) out.push('the API disagreement depends on the discussion (19)');
  return out;
}

/** U-5 — bounded priority: focus, then contests, then the repository order; nothing else. */
function providerPriorityViolations(world) {
  const out = [];
  const code = ts(world.reasoning);
  if (!/const ordered = \[\n\s+\.\.\.candidates\.filter\(\(\{ id \}\) => id === discussedId\),\n\s+\.\.\.candidates\.filter\(\(\{ id \}\) => id !== discussedId && underReview\.has\(id\)\),\n\s+\.\.\.candidates\.filter\(\(\{ id \}\) => id !== discussedId && !underReview\.has\(id\)\),\n\s+\];/u.test(code)) out.push('contests have no priority over ordinary items (20)');
  if (!/export const MAX_MODEL_HYPOTHESES = 8;/u.test(world.reasoningTypes) || !/export const MAX_HYPOTHESIS_CONTEXT_STRING_CHARS = 24_000;/u.test(world.reasoningTypes)) out.push('the hard bound was raised (21)');
  if (!/if \(included\.length === MAX_MODEL_HYPOTHESES\) break;/u.test(code) || !/if \(chars \+ itemChars > MAX_HYPOTHESIS_CONTEXT_STRING_CHARS\) break;/u.test(code)) out.push('the bound is not enforced — every hypothesis can be sent (22)');
  if (/embedding|similarity|cosine|relevance|\.sort\(|\brank\w*\(|\bscore\w*\(/iu.test(code)) out.push('relevance ranking smuggled in (23)');
  // U-1's exact-version rule stays: the focus is honoured only at the exact version the database holds.
  if (!/candidates\.some\(\(\{ id, version \}\) => id === focus\.hypothesis_id && version === focus\.hypothesis_version\)/u.test(code)) out.push('the focus is silently rebound in the API instead of the database');
  return out;
}

/** History stays: YOU_DISAGREED for every contest, the agreement only for the reader's own act. */
function historyViolations(world) {
  const out = [];
  const code = ts(world.service);
  if (!/const contested = contests\.flatMap\(\(row\): UnderstandingEvolutionEntry\[\] => \[\n\s+\{ kind: 'YOU_DISAGREED', at: row\.created_at \},/u.test(code)) out.push('YOU_DISAGREED disappears after resolution (25)');
  if (!/row\.lifecycle === 'RESOLVED' && row\.resolution_reason === 'USER_CONFIRMED_CURRENT_INTERPRETATION' && row\.resolved_at !== null/u.test(code)) out.push('a withdrawal is told as the reader agreeing (26)');
  const history = method(world.repository, 'listContestHistory(');
  if (!history || /lifecycle: 'eq\./u.test(history)) out.push('the evolution reads only open contests (25)');
  if (/resolution_reason|resolutionReason|USER_CONFIRMED|INTERPRETATION_WITHDRAWN/u.test(ts(world.api) + ts(world.mobileController) + ts(world.strip))) out.push('the internal reason reaches the client');
  return out;
}

/** Mobile: one durable command per attempt, independent of the disagreement's; exact copy. */
function mobileViolations(world) {
  const out = [];
  const agree = ts(method(world.mobileController, 'async agree('));
  if (!/if \(resolutionCommand === null \|\| resolutionCommand\.ref !== ref \|\| resolutionCommand\.revision !== revision\) \{\n\s+resolutionCommand = \{ ref, revision, id: newCommandId\(\) \};/u.test(agree)) out.push('a retry mints a new resolution command (27)');
  const failed = agree.match(/case 'FAILED':[\s\S]*?return 'FAILED';/u)?.[0] ?? '';
  if (!failed || /resolutionCommand = null/u.test(failed)) out.push('an unknown failure forgets the command (27)');
  if (/\bcommand\??\.id\b/u.test(agree)) out.push('the resolution reuses the disagreement’s command identity');
  if (!/if \(!live\(\) \|\| agreeing \|\| discussion === null \|\| !discussion\.underReview\) return null;/u.test(agree)) out.push('more than one resolution in flight, or offered when not under review');
  if (!/accessibilityState=\{\{ busy: agreeing, disabled: agreeing \}\}/u.test(world.strip) || !/void controller\.agree\(\);/u.test(world.strip)) out.push('the act is not one accessible explicit control');
  const block = (lang) => world.copy.slice(world.copy.indexOf(`const ${lang}: UnderstandingCopy`));
  if (!block('AR').includes("agree: 'أوافق عليه الآن'") || !block('AR').includes("YOU_RESOLVED_DISAGREEMENT: 'وافقت لاحقًا على هذا الفهم'")) out.push('the Arabic copy differs from the approved corrective strings (28)');
  if (!block('EN').includes("agree: 'I agree with this now'") || !block('EN').includes("YOU_RESOLVED_DISAGREEMENT: 'You later agreed with this understanding'")) out.push('the English copy differs from the approved corrective strings (28)');
  if (/\bundo\b|تراجع/iu.test(ts(world.copy))) out.push('a generic Undo');
  return out;
}

/** Privileges after 0133: every grant explicit, nothing for anon, PUBLIC or service_role, no client write. */
function privilegeViolations(world) {
  const out = [];
  const m = sql(world.migration);
  for (const [, schema, name, kind] of m.matchAll(/CREATE (?:OR REPLACE )?FUNCTION (\w+)\.(\w+)\([^)]*\)[\s\S]*?(?:SECURITY (DEFINER|INVOKER)|AS \$\$)/gu)) {
    if (kind === 'DEFINER' && schema !== 'understanding_private') out.push(`DEFINER ${schema}.${name} in an exposed schema (17)`);
  }
  if (/GRANT [^;]*\b(?:INSERT|UPDATE|DELETE|ALL|TRUNCATE)\b[^;]*ON TABLE/u.test(m)) out.push('a client write grant (17/29)');
  if (/GRANT[^;]*TO (?:anon|service_role|PUBLIC)/iu.test(m)) out.push('a grant to anon, service_role or PUBLIC (27)');
  const grants = [...m.matchAll(/GRANT ([^;]*);/gu)].map((g) => g[1]);
  for (const grant of grants) if (!/^(?:SELECT ON TABLE public\.understanding_(?:contests|discussion_focus)|EXECUTE ON FUNCTION (?:public|understanding_private)\.(?:record|resolve)_understanding_disagreement_v1\(uuid, uuid, integer\)) TO authenticated$/u.test(grant)) out.push(`an unexpected grant: ${grant}`);
  for (const fn of ['understanding_private.understanding_contest_lifecycle_forward_only_v1()', 'understanding_private.resolve_withdrawn_understanding_contest_v1()',
    'understanding_private.resolve_understanding_disagreement_v1(uuid, uuid, integer)', 'public.resolve_understanding_disagreement_v1(uuid, uuid, integer)',
    'understanding_private.record_understanding_disagreement_v1(uuid, uuid, integer)', 'public.record_understanding_disagreement_v1(uuid, uuid, integer)']) {
    if (!m.includes(`REVOKE ALL ON FUNCTION ${fn} FROM PUBLIC, anon, authenticated;`)) out.push(`${fn} is not revoked by name`);
  }
  if (!/v_user uuid := \(SELECT auth\.uid\(\)\);[\s\S]*v_user uuid := \(SELECT auth\.uid\(\)\);/u.test(m) || /p_user_id|p_owner|p_reason/u.test(m)) out.push('the owner or the reason is caller-supplied');
  if (!/CREATE FUNCTION public\.resolve_understanding_disagreement_v1\([\s\S]*?SECURITY INVOKER/u.test(m)) out.push('the Product RPC is not INVOKER');
  return out;
}

const DETECTORS = {
  focusContinuityViolations, lifecycleViolations, withdrawalViolations, resolutionBoundaryViolations, noPrerequisiteViolations,
  providerPriorityViolations, historyViolations, mobileViolations, privilegeViolations,
};

test('0134 directly follows 0133, is the only 0134, and 0036 / 0126 / 0127 are byte-identical', () => {
  const names = readdirSync(new URL('database/migrations/', root)).filter((name) => name.endsWith('.sql')).sort();
  assert.equal(names[names.indexOf('0133_supabase_default_privilege_drift_closure_v1.sql') + 1], '0134_understanding_integrity_v1.sql');
  assert.equal(names.filter((name) => name.startsWith('0134_')).length, 1);
  for (const [path, blob] of [
    ['database/migrations/0036_hypothesis_lifecycle_completion_v1.sql', 'fc92d4d59112bbce442cc96343cec0e6b1a413ed'],
    ['database/migrations/0126_understanding_discussion_focus_v1.sql', 'b94bc8c45f8c61a4d39658fd8b7d19138f1a7634'],
    ['database/migrations/0127_understanding_contest_v1.sql', '128e7a96ea980a8e744404fd49d37cdfbfe7188d'],
  ]) assert.equal(gitBlobId(read(path)), blob, `${path} is unchanged: the lifecycle core and the U2/U3 migrations are extended forward, never edited`);
  // The lifecycle core is not redefined (stop condition 3): withdrawal hooks the audit row, never the core.
  assert.doesNotMatch(src.migration, /FUNCTION public\.transition_hypothesis_core_v1/u);
});

test('the shipped runtime is clean under every detector', () => {
  for (const [name, detector] of Object.entries(DETECTORS)) assert.deepEqual(detector(src), [], name);
});

const RECORD_REBIND = "  IF v_after_version <> v_item.version THEN\n    UPDATE public.understanding_discussion_focus f\n       SET hypothesis_version = v_after_version\n     WHERE f.user_id = v_user AND f.hypothesis_id = v_item.id AND f.closed_at IS NULL\n       AND f.hypothesis_version = v_item.version;\n  END IF;\n";
const PLANTED = [
  ['1 the focus stays on the contested old version', 'focusContinuityViolations', () => plant('migration', RECORD_REBIND, '')],
  ['2 the disagreement resets opened_at and extends the window', 'focusContinuityViolations', () => plant('migration', '       SET hypothesis_version = v_after_version\n', '       SET hypothesis_version = v_after_version, opened_at = clock_timestamp()\n')],
  ['3 the disagreement reopens a closed focus', 'focusContinuityViolations', () => plant('migration', 'WHERE f.user_id = v_user AND f.hypothesis_id = v_item.id AND f.closed_at IS NULL', 'WHERE f.user_id = v_user AND f.hypothesis_id = v_item.id')],
  ['4 any Hypothesis version change slides the focus', 'focusContinuityViolations', () => plant('migration', 'COMMIT;', "CREATE TRIGGER slide AFTER UPDATE ON public.hypotheses FOR EACH ROW EXECUTE FUNCTION understanding_private.slide();\nCOMMIT;")],
  ['5 a replay moves an unrelated focus', 'focusContinuityViolations', () => plant('migration', '     WHERE f.user_id = v_user AND f.hypothesis_id = v_prior.hypothesis_id AND f.closed_at IS NULL\n       AND f.hypothesis_version = v_prior.contested_version\n', '     WHERE f.user_id = v_user AND f.closed_at IS NULL\n')],
  ['6 the resolution deletes the contest history', 'lifecycleViolations', () => plant('migration', "  RETURN QUERY SELECT 'RESOLVED'::text, v_item.version;", "  DELETE FROM public.understanding_contests c WHERE c.id = v_contest.id;\n  RETURN QUERY SELECT 'RESOLVED'::text, v_item.version;")],
  ['7 an undo rewrites the original disagreement row', 'lifecycleViolations', () => plant('migration', "resolution_reason = 'USER_CONFIRMED_CURRENT_INTERPRETATION', resolution_command_id = p_command_id", "resolution_reason = 'USER_CONFIRMED_CURRENT_INTERPRETATION', resolution_command_id = p_command_id, contested_version = v_item.version")],
  ['8 system Confidence alone resolves the reader’s disagreement', 'withdrawalViolations', () => plant('migration', 'COMMIT;', 'CREATE TRIGGER confident AFTER INSERT ON public.confidence_evaluations FOR EACH ROW EXECUTE FUNCTION understanding_private.resolve_withdrawn_understanding_contest_v1();\nCOMMIT;')],
  ['9 SUPPORTED resolves a contest', 'withdrawalViolations', () => plant('migration', "WHEN (NEW.after_status IN ('REJECTED', 'RETIRED'))", "WHEN (NEW.after_status IN ('REJECTED', 'RETIRED', 'SUPPORTED'))")],
  ['10 the resolution forces the Hypothesis to SUPPORTED', 'lifecycleViolations', () => plant('migration', "  RETURN QUERY SELECT 'RESOLVED'::text, v_item.version;", "  PERFORM public.transition_hypothesis_core_v1(v_user, v_item.id, v_item.version, 'SUPPORTED', 'AUTHENTICATED_TRANSITION');\n  RETURN QUERY SELECT 'RESOLVED'::text, v_item.version;")],
  ['11 the resolution calls the provider / Confidence', 'resolutionBoundaryViolations', () => plant('service', "        case 'RESOLVED':\n          if (row.resolved_version !== seen) this.reject();", "        case 'RESOLVED':\n          await this.confidenceRuntime.ensureHypothesisVersionEvaluation(userId, token, hypothesis.id, hypothesis.version, commandId);\n          if (row.resolved_version !== seen) this.reject();")],
  ['12 the resolution accepts a stale revision (database)', 'lifecycleViolations', () => plant('migration', "  -- The reader agrees with the interpretation they SEE: never with a newer one they were not shown.\n  IF v_item.version <> p_expected_version THEN", "  IF false THEN")],
  ['12b the resolution accepts a stale revision (API)', 'resolutionBoundaryViolations', () => plant('service', 'this.repository.resolveDisagreement(token, commandId, hypothesis.id, seen)', 'this.repository.resolveDisagreement(token, commandId, hypothesis.id, hypothesis.version)')],
  ['13 the client supplies the resolution reason', 'resolutionBoundaryViolations', () => plant('api', "body: JSON.stringify({ commandId, revision }),\n      });\n    } catch {\n      return { kind: 'FAILED' };\n    }\n    if (response.status === 404) return { kind: 'GONE' };\n    let body: unknown;\n    try {\n      body = await response.json();\n    } catch {\n      return { kind: 'FAILED' };\n    }\n    if (response.status === 409) {\n      const code = isRecord(body) && isRecord(body.message) ? body.message.code : isRecord(body) ? body.code : undefined;\n      if (code === 'UNDERSTANDING_ITEM_CHANGED') return { kind: 'CHANGED' };\n      if (code === 'UNDERSTANDING_NOT_UNDER_REVIEW')", "body: JSON.stringify({ commandId, revision, reason: 'USER_CONFIRMED_CURRENT_INTERPRETATION' }),\n      });\n    } catch {\n      return { kind: 'FAILED' };\n    }\n    if (response.status === 404) return { kind: 'GONE' };\n    let body: unknown;\n    try {\n      body = await response.json();\n    } catch {\n      return { kind: 'FAILED' };\n    }\n    if (response.status === 409) {\n      const code = isRecord(body) && isRecord(body.message) ? body.message.code : isRecord(body) ? body.code : undefined;\n      if (code === 'UNDERSTANDING_ITEM_CHANGED') return { kind: 'CHANGED' };\n      if (code === 'UNDERSTANDING_NOT_UNDER_REVIEW')")],
  ['13b the database takes a reason parameter', 'lifecycleViolations', () => plant('migration', 'CREATE FUNCTION understanding_private.resolve_understanding_disagreement_v1(\n  p_command_id uuid, p_hypothesis_id uuid, p_expected_version integer\n)', 'CREATE FUNCTION understanding_private.resolve_understanding_disagreement_v1(\n  p_command_id uuid, p_hypothesis_id uuid, p_expected_version integer, p_reason text\n)')],
  ['14 the resolution command is not idempotent', 'lifecycleViolations', () => plant('migration', '   WHERE c.user_id = v_user AND c.resolution_command_id = p_command_id;', '   WHERE false;')],
  ['15 a resolved contest is reopened instead of a new row', 'lifecycleViolations', () => plant('migration', "  IF OLD.lifecycle = 'RESOLVED' THEN\n    RAISE EXCEPTION 'UNDERSTANDING_CONTEST_RESOLUTION_FINAL'", "  IF false THEN\n    RAISE EXCEPTION 'UNDERSTANDING_CONTEST_RESOLUTION_FINAL'")],
  ['16 multiple contests under review for one item', 'lifecycleViolations', () => plant('migration', 'COMMIT;', 'DROP INDEX public.understanding_contests_one_under_review_idx;\nCOMMIT;')],
  ['17 another user can mutate a contest', 'privilegeViolations', () => plant('migration', 'GRANT SELECT ON TABLE public.understanding_contests TO authenticated;', 'GRANT SELECT, UPDATE ON TABLE public.understanding_contests TO authenticated;')],
  ['18 an open discussion becomes a prerequisite for disagreement', 'noPrerequisiteViolations', () => plant('migration', "  -- Never applied to a different interpretation than the one the reader disagreed with.\n  IF v_item.version <> p_expected_version THEN\n    RETURN QUERY SELECT 'STALE'::text, NULL::integer, NULL::integer, NULL::uuid;", "  IF NOT EXISTS (SELECT 1 FROM public.understanding_discussion_focus f WHERE f.user_id = v_user AND f.closed_at IS NULL) THEN\n    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::integer, NULL::integer, NULL::uuid; RETURN;\n  END IF;\n  IF v_item.version <> p_expected_version THEN\n    RETURN QUERY SELECT 'STALE'::text, NULL::integer, NULL::integer, NULL::uuid;")],
  ['19 the direct exact-owned disagreement is broken by an API prerequisite', 'noPrerequisiteViolations', () => plant('service', '      const rows = await this.repository.recordDisagreement(token, commandId, hypothesis.id, seen);', "      if ((await this.repository.openDiscussion(token, hypothesis.id, seen)) !== 'OPENED') throw new NotFoundException('Understanding item not found.');\n      const rows = await this.repository.recordDisagreement(token, commandId, hypothesis.id, seen);")],
  ['20 contests have no priority over ordinary items', 'providerPriorityViolations', () => plant('reasoning', '      ...candidates.filter(({ id }) => id !== discussedId && underReview.has(id)),\n      ...candidates.filter(({ id }) => id !== discussedId && !underReview.has(id)),\n', '      ...candidates.filter(({ id }) => id !== discussedId),\n')],
  ['21 MAX_MODEL_HYPOTHESES raised to hide the bug', 'providerPriorityViolations', () => plant('reasoningTypes', 'export const MAX_MODEL_HYPOTHESES = 8;', 'export const MAX_MODEL_HYPOTHESES = 32;')],
  ['22 all 32 hypotheses are sent', 'providerPriorityViolations', () => plant('reasoning', '      if (included.length === MAX_MODEL_HYPOTHESES) break;\n', '')],
  ['23 relevance ranking smuggled in', 'providerPriorityViolations', () => plant('reasoning', '    const eligibleIds = new Set(', '    ordered.sort((left, right) => relevance(right) - relevance(left));\n    const eligibleIds = new Set(')],
  ['24 U-4 telemetry duplicated on the resolution', 'resolutionBoundaryViolations', () => plant('service', "        case 'NOT_UNDER_REVIEW':\n", "        case 'NOT_UNDER_REVIEW':\n          this.telemetry.recordOperationalOutcome('UNDERSTANDING_CONFIDENCE', 'confidence_reevaluate', 'success');\n")],
  ['25 YOU_DISAGREED disappears after resolution', 'historyViolations', () => plant('service', 'const contested = contests.flatMap(', "const contested = contests.filter((row) => row.lifecycle === 'UNDER_REVIEW').flatMap(")],
  ['25b the evolution reads only open contests', 'historyViolations', () => plant('repository', "      user_id: `eq.${userId}`, hypothesis_id: `eq.${hypothesisId}`, order: 'created_at.desc,id.asc', limit: String(MAX_DETAIL_EVOLUTION),\n    });\n    return this.dataApi.request<UnderstandingContestHistoryRow[]>", "      user_id: `eq.${userId}`, hypothesis_id: `eq.${hypothesisId}`, lifecycle: 'eq.UNDER_REVIEW', order: 'created_at.desc,id.asc', limit: String(MAX_DETAIL_EVOLUTION),\n    });\n    return this.dataApi.request<UnderstandingContestHistoryRow[]>")],
  ['26 a withdrawal falsely says the reader agreed (projection)', 'historyViolations', () => plant('service', "row.lifecycle === 'RESOLVED' && row.resolution_reason === 'USER_CONFIRMED_CURRENT_INTERPRETATION' && row.resolved_at !== null", "row.lifecycle === 'RESOLVED' && row.resolved_at !== null")],
  ['26b a withdrawal falsely says the reader agreed (database)', 'withdrawalViolations', () => plant('migration', "         resolution_reason = 'INTERPRETATION_WITHDRAWN'\n   WHERE c.user_id = NEW.user_id", "         resolution_reason = 'USER_CONFIRMED_CURRENT_INTERPRETATION', resolution_command_id = NEW.id\n   WHERE c.user_id = NEW.user_id")],
  ['27 a mobile retry mints a new command after an unknown failure', 'mobileViolations', () => plant('mobileController', "            // Unknown: the SAME command is sent again next time, so it is resolved at most once.\n            updateDiscussion(ref, { resolution: 'FAILED' });", "            // Unknown: the SAME command is sent again next time, so it is resolved at most once.\n            resolutionCommand = null;\n            updateDiscussion(ref, { resolution: 'FAILED' });")],
  ['27b the resolution reuses the disagreement command', 'mobileViolations', () => plant('mobileController', '      const commandId = resolutionCommand.id;', '      const commandId = command?.id ?? resolutionCommand.id;')],
  ['28 the Arabic copy differs from the approved string', 'mobileViolations', () => plant('copy', "agree: 'أوافق عليه الآن'", "agree: 'أوافق الآن'")],
  ['28b the English evolution copy differs from the approved string', 'mobileViolations', () => plant('copy', "YOU_RESOLVED_DISAGREEMENT: 'You later agreed with this understanding'", "YOU_RESOLVED_DISAGREEMENT: 'You changed your mind'")],
  ['a DEFINER in the exposed schema', 'privilegeViolations', () => plant('migration', 'LANGUAGE sql\nVOLATILE\nSECURITY INVOKER', 'LANGUAGE sql\nVOLATILE\nSECURITY DEFINER')],
  ['a grant to anon', 'privilegeViolations', () => plant('migration', 'GRANT EXECUTE ON FUNCTION public.resolve_understanding_disagreement_v1(uuid, uuid, integer) TO authenticated;', 'GRANT EXECUTE ON FUNCTION public.resolve_understanding_disagreement_v1(uuid, uuid, integer) TO authenticated, anon;')],
];

for (const [name, detector, world] of PLANTED) {
  test(`planted defect is rejected: ${name}`, () => {
    assert.notDeepEqual(DETECTORS[detector](world()), [], `${detector} missed: ${name}`);
  });
}

test('the contract and the verifier are registered, and the verifier runs after every migration is applied', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['test:w3-corr-u-understanding-integrity-contract'], 'node --test tests/w3-corr-u-understanding-integrity-contract.test.mjs');
  assert.equal(pkg.scripts['verify:understanding-integrity:integration'], 'node --env-file-if-exists=.env database/verify-migration-0134.mjs');
  const ci = read('.github/workflows/api-ci.yml');
  assert.match(ci, /run: npm run test:w3-corr-u-understanding-integrity-contract\}/u);
  assert.ok(ci.indexOf('run: npm run verify:understanding-integrity:integration') > ci.indexOf('Apply all migrations to fresh PostgreSQL'));
  // The combined proof runs the REAL compiled context service, which API CI builds before the database steps.
  assert.ok(ci.indexOf('run: npm run verify:him-measurement-preflight') < ci.indexOf('Apply all migrations to fresh PostgreSQL'));
  assert.match(pkg.scripts['verify:him-measurement-preflight'], /npm run build:api$/u);
  assert.match(read('database/verify-migration-0134.mjs'), /apps\/api\/dist\/hypothesis\/hypothesis-reasoning-context\.service\.js/u);
});
