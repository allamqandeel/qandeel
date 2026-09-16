// I-06B - Replay Preview / Finalization Runtime: the secret-free structural
// contract for migration 0103.
//
// Live semantics - which source classes can be projected, what a sealed
// coordinate means, idempotency and the race matrix - are proven by
// database/verify-migration-0103.mjs against real PostgreSQL. What is proven
// HERE is the structure a migration must already have before it deploys: that
// the analytical projection CONSUMES the canonical historical projection at the
// exact represented Session Position and computes nothing itself; that an
// unsupported source class, a LEGACY UNCOVERED Session and an open Live Head
// all fail closed rather than being synthesized; that no model runs over
// historical source anywhere; that the canonicalization structurally cannot see
// the source payload; that preview and finalization widen no audience, claim no
// Safety or Launch clearance and create no distribution state; and that the
// Replay is always the first lock.
//
// ## The self-assertion simulator
//
// Both migrations refuse to deploy unless a long list of regular expressions
// holds of their OWN function bodies. On a host with no PostgreSQL that list is
// unverifiable until CI runs it, and it has two silent failure modes that look
// identical from the outside: an anchor that matches NOTHING (so the invariant
// is never actually checked) and a ban that matches the migration's own PROSE
// (so the migration refuses itself at deploy). `simulateSelfAssertions` below
// evaluates every one of them against the bodies the migration actually
// declares, with the subject each check is scoped to, and reports both.
//
// ## Why the slice-wide probe lives in this file and not in both
//
// A mirror-based probe is expensive. The probe at the end mirrors once and runs
// BOTH I-06B contracts against a mutated tree, so the property each must have -
// this is a contract, not a ceiling on the roadmap - is proven for both from
// one place.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createHarnessMirror, removeHarnessMirror } from '../../tests/harness-temp-dir.mjs';
import { FROZEN_PREDECESSORS } from './replay-frozen-predecessors.mjs';
import { I06A_FROZEN } from './replay-version-frozen-predecessors.mjs';

const rootPath = fileURLToPath(new URL('../../', import.meta.url));
/** Set in the child runs of the probe, so a probe never recurses into itself. */
const PROBE_CHILD = 'QANDEEL_I06B_REPLAY_FORWARD_SAFETY_CHILD';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

const MIGRATION_NAME = '0103_replay_preview_finalization_runtime_v1.sql';
const PART_A_NAME = '0102_replay_analytical_projection_render_contract_versioning_v1.sql';
const migration = read(`../migrations/${MIGRATION_NAME}`);
const partA = read(`../migrations/${PART_A_NAME}`);
const verifier = read('../verify-migration-0103.mjs');
const support = read('../replay-version-verifier-support.mjs');
const readme = read('../README.md');
const doc = read('../../docs/replay-runtime-v1.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');
const focused = read('../focused-verifiers.json');

const executableSql = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const SELF_ASSERT_START = executableSql.lastIndexOf('DO $$\nDECLARE');
const selfAssertions = executableSql.slice(SELF_ASSERT_START);
const installedSql = executableSql.slice(0, SELF_ASSERT_START);

const FAMILY = 'replay_canonical_projection_family_v1';
const POINT_DIGEST = 'replay_analytical_projection_point_digest_v1';
const VERSION_DIGEST = 'replay_analytical_projection_version_digest_v1';
const CONTRACT_DIGEST = 'replay_render_contract_digest_v1';
const CUT = 'derive_replay_semantic_cut_safety_v1';
const GAP = 'derive_replay_temporal_discontinuities_v1';
const PROJECTION = 'build_replay_analytical_projection_v1';
const CONTRACT = 'build_replay_render_contract_v1';
const TRUTH = 'derive_replay_version_truth_currency_v1';
const PREVIEW = 'prepare_replay_preview_v1';
const FINALIZE = 'finalize_replay_version_v1';
const REOPEN = 'reopen_replay_for_revision_v1';
const RESOLVER = 'resolve_replay_current_version_v1';
const HUMAN = [PREVIEW, FINALIZE, REOPEN];
const CORES = [CUT, GAP, PROJECTION, CONTRACT];
const PURE = [FAMILY, POINT_DIGEST, VERSION_DIGEST, CONTRACT_DIGEST];
const OWN_TABLES = ['replay_preview_commands', 'replay_finalization_commands',
  'replay_revision_reopen_commands'];
const OWN_SCRIPT = 'verify:replay-preview-finalization-runtime:integration';
const PART_A_SCRIPT = 'verify:replay-analytical-projection-render-contract:integration';

/**
 * The EXACT input list of the projection canonicalization.
 *
 * Pinned here as well as in the migration, because the structural exclusion of
 * the source-event payload is a property of this list and of nothing else: if
 * `p_moments` or `p_committed_text` could be passed, `committedText` could
 * reach a digest that claims to be analysis.
 */
const CANONICALIZER_INPUTS = ['p_represented_session_position', 'p_emerging_focuses', 'p_live_focus',
  'p_threads', 'p_thread_reading_appearances', 'p_readings', 'p_reading_relations',
  'p_evidence_participations', 'p_materials', 'p_gaps', 'p_questions',
  'p_question_appearances', 'p_confidences'];

const signatureEnd = (source, name) => {
  const start = source.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.ok(start >= 0, `the migration creates ${name}`);
  let depth = 1; let i = start + `CREATE FUNCTION public.${name}(`.length;
  while (i < source.length && depth > 0) {
    if (source[i] === '(') depth += 1; else if (source[i] === ')') depth -= 1;
    i += 1;
  }
  return { start, open: start + `CREATE FUNCTION public.${name}(`.length, close: i };
};
const functionBody = (name, source = migration) => {
  const { close } = signatureEnd(source, name);
  const open = source.indexOf('AS $$', close);
  const end = source.indexOf('$$;', open + 5);
  assert.ok(open > close && end > open, `${name} has a terminated dollar-quoted body`);
  return { header: source.slice(close, open), body: source.slice(open + 'AS $$'.length, end) };
};
const inputParameters = (name, source = migration) => {
  const { open, close } = signatureEnd(source, name);
  return [...source.slice(open, close - 1).matchAll(/(p_\w+)\s+(?:uuid\[\]|text\[\]|integer\[\]|uuid|text|integer|bigint|boolean|timestamptz|jsonb)/gu)]
    .map((m) => m[1]);
};
const resultColumns = (name) => {
  const { header } = functionBody(name);
  const table = /RETURNS TABLE\(([\s\S]*?)\)\s*\nLANGUAGE/u.exec(header);
  assert.ok(table, `${name} declares a RETURNS TABLE result`);
  return [...table[1].matchAll(/(\w+)\s+(?:uuid\[\]|text\[\]|uuid|text|integer|bigint|boolean|timestamptz)/gu)].map((m) => m[1]);
};
const tableBlock = (table) => {
  const start = executableSql.indexOf(`CREATE TABLE public.${table} (`);
  assert.ok(start >= 0, `0103 creates ${table}`);
  return executableSql.slice(start, executableSql.indexOf('\n);', start));
};

/** Result columns no Replay read boundary may ever declare. */
const DISCLOSURE_BAN = /user_id|auth_subject|email|phone|contact|credential|session|turn|conversation_unit|shared_|material|history_item|availability|context_ref|world_id|provenance|digest|fingerprint|audio|transcript|body|package_item|experience|staleness|divergence/u;

// ---------------------------------------------------------------------------
// The self-assertion simulator.
// ---------------------------------------------------------------------------

/** Every function one migration declares, by name, with its body. */
function declaredFunctions(source) {
  const bodies = new Map();
  for (const match of source.matchAll(/CREATE FUNCTION public\.(\w+)\(/gu)) {
    const open = source.indexOf('AS $$', match.index);
    if (open < 0) continue;
    const end = source.indexOf('$$;', open + 5);
    bodies.set(match[1], source.slice(open + 'AS $$'.length, end < 0 ? undefined : end));
  }
  return bodies;
}

/** A PostgreSQL single-quoted literal, unescaped. */
const unquote = (literal) => literal.slice(1, -1).replace(/''/gu, "'");

/**
 * Evaluates every `prosrc` regular expression a migration's self-assertion
 * block applies to its own functions, against the bodies it actually declares.
 *
 * Returns one finding per check that would behave differently in PostgreSQL
 * than the author intended:
 *
 *   unmatched-anchor   a `!~` check (the invariant MUST be present) whose
 *                      pattern matches nothing in its subject, so the invariant
 *                      is never actually checked and a weakening would deploy
 *   self-match         a `~` check (the shape is FORBIDDEN) whose pattern
 *                      matches its subject, so the migration refuses ITSELF at
 *                      deploy - usually because a ban over `prosrc` is also a
 *                      ban on the prose inside the function
 *
 * The subject of a check is the function the block most recently selected into
 * `p`, or every function of the array the enclosing FOREACH walks.
 */
export function simulateSelfAssertions(source) {
  const bodies = declaredFunctions(source);
  const block = source.slice(source.lastIndexOf('DO $$\nDECLARE'));
  const findings = [];
  /** How many `prosrc` checks were actually evaluated: the simulator's own anti-vacuity number. */
  let evaluated = 0;

  // `<var> text := 'public.name(args)';` and `<var> text[] := ARRAY[...]` /
  // `<var> := <expr>;` - resolved to the function NAMES they denote.
  const named = new Map();
  for (const match of block.matchAll(/(\w+)\s+text\s*:=\s*'public\.(\w+)\(/gu)) named.set(match[1], [match[2]]);
  const resolve = (expression) => {
    const names = [];
    for (const token of expression.split(/[\s,[\]|]+/u).filter(Boolean)) {
      // `everything := pure || cores || human || ARRAY[truth_fn, resolver];`
      if (token === 'ARRAY') continue;
      if (named.has(token)) names.push(...named.get(token));
      else if (/^'public\.(\w+)\(/u.test(token)) names.push(/^'public\.(\w+)\(/u.exec(token)[1]);
      else if (bodies.has(token)) names.push(token);
      else return null; // not a list of functions - a role list, a table list
    }
    return names.length > 0 ? names : null;
  };
  for (const match of block.matchAll(/^\s*(\w+)\s*:=\s*([^;']+);$/gmu)) {
    const names = resolve(match[2].replace(/^ARRAY\[|\]$/gu, ''));
    if (names) named.set(match[1], names);
  }
  // The single-function subject form, and the `prosrc INTO a variable` form.
  const subjectOf = new Map();
  for (const match of block.matchAll(/WHERE pr\.oid = (\w+)::regprocedure/gu)) {
    subjectOf.set(match.index, named.get(match[1]) ?? null);
  }
  for (const match of block.matchAll(/p\.proname = '(\w+)'/gu)) {
    subjectOf.set(match.index, bodies.has(match[1]) ? [match[1]] : null);
  }

  const stack = [];
  let current = null;
  const lines = block.split('\n');
  let offset = 0;
  for (const line of lines) {
    const start = offset;
    offset += line.length + 1;
    const loop = /FOREACH \w+ IN ARRAY (ARRAY\[[^\]]*\]|\w+) LOOP/u.exec(line);
    if (loop) { stack.push(resolve(loop[1].replace(/^ARRAY\[|\]$/gu, ''))); continue; }
    if (/END LOOP;/u.test(line)) { stack.pop(); continue; }
    for (const [at, subject] of subjectOf) {
      if (at >= start && at < offset) current = subject;
    }
    const scoped = [...stack].reverse().find((frame) => frame !== null) ?? current;
    if (!scoped) continue;
    for (const match of line.matchAll(/\bp(?:\.prosrc)?\s*(!~\*?|~\*?)\s*('(?:[^']|'')*')/gu)) {
      const [, operator, literal] = match;
      const pattern = new RegExp(unquote(literal), operator.endsWith('*') ? 'iu' : 'u');
      const required = operator.startsWith('!');
      evaluated += 1;
      for (const name of scoped) {
        const body = bodies.get(name);
        if (body === undefined) continue;
        const matched = pattern.test(body);
        if (required && !matched) {
          findings.push({ kind: 'unmatched-anchor', fn: name, pattern: pattern.source,
            detail: 'the invariant this anchor checks is never actually checked, so a weakening would deploy' });
        }
        if (!required && matched) {
          findings.push({ kind: 'self-match', fn: name, pattern: pattern.source,
            detail: 'this migration refuses ITSELF at deploy: the banned shape matches its own text' });
        }
      }
    }
    // `guard !~ '...'` / `guard ~ '...'`, the single-variable form 0102 uses.
    for (const match of line.matchAll(/\bguard\s*(!~\*?|~\*?)\s*('(?:[^']|'')*')/gu)) {
      const [, operator, literal] = match;
      const pattern = new RegExp(unquote(literal), operator.endsWith('*') ? 'iu' : 'u');
      const required = operator.startsWith('!');
      evaluated += 1;
      for (const name of scoped) {
        const body = bodies.get(name);
        if (body === undefined) continue;
        const matched = pattern.test(body);
        if (required && !matched) findings.push({ kind: 'unmatched-anchor', fn: name, pattern: pattern.source, detail: 'anchor matches nothing' });
        if (!required && matched) findings.push({ kind: 'self-match', fn: name, pattern: pattern.source, detail: 'the migration refuses itself' });
      }
    }
  }
  return { findings, evaluated };
}

// ---------------------------------------------------------------------------

test('0103 is the forward migration after 0102, every frozen predecessor is byte-identical, and nothing predecessor is rewritten', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.ok(migrations.includes(MIGRATION_NAME));
  assert.equal(migrations.filter((n) => n.startsWith('0103_')).length, 1, 'exactly one migration carries the 0103 number');
  assert.ok(migrations.indexOf(MIGRATION_NAME) > migrations.indexOf(PART_A_NAME));
  assert.match(migration, /^BEGIN;/mu);
  assert.match(migration, /COMMIT;\s*$/u);
  assert.equal((migration.match(/^BEGIN;$/gmu) ?? []).length, 1, 'one transaction');
  for (const [name, blob] of [...FROZEN_PREDECESSORS, ...I06A_FROZEN]) {
    assert.equal(gitBlobId(read(`../migrations/${name}`)), blob, `${name} is byte-identical`);
  }
  assert.doesNotMatch(executableSql, /\bDROP\s+(?:TABLE|FUNCTION|INDEX|POLICY|TRIGGER|COLUMN|CONSTRAINT|TYPE|SCHEMA)\b/iu,
    '0103 drops nothing');
  for (const [, altered] of executableSql.matchAll(/ALTER TABLE (?:ONLY )?public\.(\w+)/gu)) {
    assert.ok(OWN_TABLES.includes(altered), `0103 alters only its own command relations, not ${altered}`);
  }
  assert.doesNotMatch(executableSql, /CREATE OR REPLACE FUNCTION/u, '0103 replaces no predecessor function');
  for (const [, created] of executableSql.matchAll(/CREATE TABLE public\.(\w+)/gu)) {
    assert.ok(OWN_TABLES.includes(created), `0103 creates only its three command relations, not ${created}`);
  }
});

test('BOTH I-06B migrations pass their own deploy-time self-assertions', () => {
  let total = 0;
  for (const [name, source] of [[PART_A_NAME, partA], [MIGRATION_NAME, migration]]) {
    const { findings, evaluated } = simulateSelfAssertions(source);
    total += evaluated;
    assert.deepEqual(findings, [],
      `${name} would not deploy:\n${findings.map((f) => `  ${f.kind}  ${f.fn}  /${f.pattern}/  ${f.detail}`).join('\n')}`);
  }
  // THE SIMULATOR'S OWN ANTI-VACUITY NUMBER. A simulator that resolved no
  // subject would report zero findings over zero checks and read exactly like a
  // clean run; the whole `everything` loop was silently skipped that way once.
  assert.ok(total >= 60, `the simulator must actually evaluate the checks; it evaluated ${total}`);
  // And it must FIND something in a tree where a required anchor no longer
  // matches, and in one where a ban matches the migration's own prose.
  const anchorRemoved = migration.replace('IF NOT projected.sealed THEN', 'IF NOT projected.is_sealed THEN');
  assert.ok(simulateSelfAssertions(anchorRemoved).findings.some((f) => f.kind === 'unmatched-anchor'),
    'the simulator catches an anchor that stopped matching');
  const prosePlanted = migration.replace('  -- STEP 5: where the real gaps are.',
    '  -- STEP 5: where the real gaps are, and none of them is DISTRIBUT.');
  assert.ok(simulateSelfAssertions(prosePlanted).findings.some((f) => f.kind === 'self-match'),
    'the simulator catches a ban that matches the migration own prose');
});

test('the analytical projection consumes the canonical historical truth and computes none of it', () => {
  const { body } = functionBody(PROJECTION);
  // K(TC) at the EXACT represented Session Position, and no other analytical input.
  assert.match(body, /public\.get_session_historical_projection_v1\(manifest\.personal_session_id, item\.represented_tc\)/u,
    'the Personal projection consumes the canonical historical projection at the exact represented coordinate');
  assert.doesNotMatch(body, /session_historical_coverage|historical_reading_events|historical_material_events|historical_gap_events|hypotheses|memories|information_gaps|confidence_evaluations/u,
    'and never reads the historical substrate directly, which would be a second projection authority');
  // NO CURRENT-MODEL RE-ANALYSIS PATH EXISTS ANYWHERE IN THE SLICE. Scoped to
  // the INSTALLED structure on purpose: the self-assertion block names those
  // same words in order to FORBID them, and a whole-file ban would therefore be
  // satisfied by the guard against itself.
  assert.doesNotMatch(installedSql, /\b(?:openai|anthropic|claude|gpt-|llm|prompt|completion|provider_model|inference|embedding)\b/iu,
    'no model, provider or prompt is reachable from any I-06B function');
  assert.ok(selfAssertions.includes('must run no model over historical source and synthesize no original medium'),
    'and the deploy-time guard refuses a migration where one appears');
  // THE THREE FAIL-CLOSED REFUSALS.
  assert.match(body, /manifest\.source_class <> 'MY_WORLD'/u);
  assert.match(body, /REPLAY_ANALYTICAL_PROJECTION_UNAVAILABLE' USING ERRCODE='0A000'/u);
  assert.match(body, /EXCEPTION WHEN OTHERS THEN\s*\n\s*RAISE EXCEPTION 'REPLAY_ANALYTICAL_PROJECTION_UNAVAILABLE'/u,
    'every raise of the canonical projection - a LEGACY UNCOVERED Session included - is a capability absence and never an error a caller can read');
  assert.match(body, /IF NOT projected\.sealed THEN\s*\n\s*RAISE EXCEPTION 'REPLAY_ANALYTICAL_PROJECTION_OPEN_HEAD'/u,
    'an open Live Head is retried later and never frozen as historical truth');
  // NOTHING IS WRITTEN UNTIL EVERY POINT IS DERIVED, so no append-only guard is
  // ever lifted to backfill a digest.
  assert.ok(body.indexOf('FOR item IN') < body.indexOf('INSERT INTO public.replay_analytical_projection_versions'),
    'every point is derived before the version row exists');
  assert.doesNotMatch(migration, /DISABLE TRIGGER|ENABLE TRIGGER/u,
    'no I-06B function lifts an append-only guard to write its own truth');
});

test('the projection canonicalization is deterministic, versioned, and structurally blind to the source payload', () => {
  assert.deepEqual(inputParameters(POINT_DIGEST), CANONICALIZER_INPUTS,
    'the canonicalization declares an EXACT input list: `moments` is not in it and cannot be added without changing this contract');
  const { body } = functionBody(POINT_DIGEST);
  assert.match(body, /QANDEEL_REPLAY_ANALYTICAL_PROJECTION_V1/u, 'the schema identity is part of the digested text');
  assert.match(body, /'tc=' \|\| p_represented_session_position::text/u, 'and so is the represented coordinate');
  // THE WALL-CLOCK EXPIRY MAPPING IS THE ONE THING REMOVED FROM A FAMILY, and
  // it is removed from `materials` alone.
  assert.match(body, /public\.replay_canonical_projection_family_v1\('materials', p_materials, ARRAY\['expiry'\]\)/u);
  assert.equal((body.match(/ARRAY\['expiry'\]/gu) ?? []).length, 1,
    'nothing but the wall-clock expiry mapping is dropped from any family');
  assert.ok(migration.includes('It is NEVER compared to TC'),
    'and the migration quotes the canonical rule it is honouring rather than asserting its own');
  // Every analytical family of K(TC) reaches the digest.
  for (const family of ['emergingFocuses', 'liveFocus', 'threads', 'threadReadingAppearances', 'readings',
    'readingRelations', 'evidenceParticipations', 'materials', 'gaps', 'questions',
    'questionAppearances', 'confidences']) {
    assert.ok(body.includes(`'${family}`), `the digest commits ${family}`);
  }
  // STABLE UNDER ORDERING, and dependent on no language runtime.
  const family = functionBody(FAMILY).body;
  assert.match(family, /ORDER BY \(e - p_drop\)::text COLLATE "C"/u,
    'elements are sorted by their own canonical text, so the digest is a property of the SET');
  assert.doesNotMatch(migration, /JSON\.stringify|to_json\(/u,
    'no unversioned language-runtime serialization is the truth identity');
  for (const name of PURE) {
    assert.match(functionBody(name).header, /LANGUAGE sql IMMUTABLE SET search_path=''/u,
      `${name} is IMMUTABLE, or the same truth could digest differently`);
  }
});

test('Semantic Cut Safety and the discontinuities are derived, never caller-authored', () => {
  const cut = functionBody(CUT).body;
  assert.match(cut, /CASE WHEN si\.anchor_kind = 'WHOLE_ITEM' THEN 'SAFE' ELSE 'UNPROVEN' END/u,
    'the result is derived from the immutable anchor kind of the selection and from nothing a caller said');
  assert.match(cut, /'QANDEEL_REPLAY_SEMANTIC_CUT_SAFETY_V1'/u, 'the algorithm identity is versioned');
  assert.doesNotMatch(inputParameters(CUT).join(' '), /result|assessment|safe/u,
    'no caller supplies a safety result');
  const gap = functionBody(GAP).body;
  assert.match(gap, /pair\.right_rank > pair\.left_rank \+ 1/u,
    'a discontinuity is derived from the captured source-universe ranks');
  assert.doesNotMatch(gap, /body_text|committed_text|public_text_body|transcript_text|digest/u,
    'and reads nothing about what was omitted');
  // THE SELECTION IS NEVER SILENTLY WIDENED. An expansion is a new explicit
  // selection revision through the frozen I-06A draft path.
  assert.doesNotMatch(migration, /(?:INSERT INTO|UPDATE) public\.replay_selection_spec/u,
    'no I-06B function writes a selection: widening is an explicit I-06A draft revision');
  assert.ok(migration.includes('a Replay never widens a selection silently'));
});

test('preview and finalization widen no audience, fabricate no clearance and create no distribution state', () => {
  // NOT ONE I-06C OBJECT EXISTS IN THE SLICE.
  for (const forbidden of ['REPLAY_DISTRIBUTION_PACKAGE_VERSION', 'REQUIRED_REPLAY_DISTRIBUTION_APPROVER_SET',
    'PUBLISH_TO_PUBLIC_WORLD', 'SHARE_EXTERNALLY', 'EXPORT_PRIVACY_SANITIZATION',
    'SAFETY_ALLOW', 'MODERATION_ALLOW', 'ENTITLED', 'FEATURE_ENABLED', 'LAUNCH_CLEARED',
    'PUBLIC_LAUNCH_READY']) {
    assert.ok(!installedSql.includes(forbidden),
      `0103 must never create ${forbidden}: that is I-06C / CW2-08, and architecture complete is not public launch ready`);
  }
  // Preview and finalization reference no relation that could carry a package,
  // an approver, a World membership or a public surface.
  for (const name of [PREVIEW, FINALIZE, REOPEN]) {
    assert.doesNotMatch(functionBody(name).body, /public\.(?:publication_|public_experience|public_world|public_identit|shared_world)/u,
      `${name} touches no package, approval, membership or public surface relation`);
  }
  // No grant reaches an application role, and exactly one read boundary is
  // granted at all.
  const grants = [...executableSql.matchAll(/GRANT EXECUTE ON FUNCTION %s TO (\w+)/gu)].map((m) => m[1]);
  assert.deepEqual(grants, ['service_role'], 'exactly one grant exists in 0103, to the service tier read boundary');
  assert.ok(executableSql.includes("'public.prepare_replay_preview_v1(uuid, uuid, bigint, uuid, uuid, uuid)'"),
    'the preview primitive is in the explicitly revoked internal list');
  assert.ok(executableSql.includes("REVOKE ALL ON FUNCTION %s FROM service_role"),
    'and the service tier is an executor, never the human consent principal');
});

test('the human is derived, the Replay is the first lock, and every consequential command is durably idempotent', () => {
  for (const name of [...CORES, ...HUMAN]) {
    assert.match(functionBody(name).body, /u uuid := auth\.uid\(\);/u,
      `${name} derives the human from auth.uid() and never from a parameter`);
    assert.doesNotMatch(inputParameters(name).join(' '),
      /actor|creator|owner|user_id|approver|authority|audience|viewer|visib|publish|distribut|lifecycle|clear|launch|safety|entitle|allow|ordinal|contiguous|digest|fingerprint|medium|availability|sealed|coverage|discontinuit/u,
      `${name} accepts no actor, authority, audience, safety, digest or coverage parameter`);
  }
  for (const name of HUMAN) {
    const { body } = functionBody(name);
    // ONE database clock read, and no caller clock.
    assert.equal((body.match(/clock_timestamp\(\)/gu) ?? []).length, 1, `${name} reads the database clock exactly once`);
    assert.doesNotMatch(inputParameters(name).join(' '), /instant|timestamp|_at$/u, `${name} accepts no clock`);
    // Durable idempotency, before any lock and again under it.
    assert.ok((body.match(/WHERE c\.id = p_command_id/gu) ?? []).length >= 2,
      `${name} checks durable idempotency before any lock and again under it`);
    assert.match(body, /committed\.request_ref <> request/u, `${name} decides retry equivalence on the whole request identity`);
    assert.match(body, /REPLAY_COMMAND_ID_CONFLICT/u, `${name} refuses a reused command identity carrying a different request`);
    // REPLAY FIRST, ALWAYS.
    const lock = body.indexOf('FROM public.replays r WHERE r.id = p_replay_id FOR UPDATE');
    assert.ok(lock > 0, `${name} takes the Replay row FOR UPDATE`);
    assert.match(body, /replay\.created_by_user_id <> u/u, `${name} answers the exact creator and nobody else`);
    assert.match(body, /REPLAY_NOT_AVAILABLE/u, `a stranger and a nonexistent Replay reach ONE class in ${name}`);
    // The LOCKING statement, not the DECLARE that names the same relation as a
    // row type: a declaration is always above the lock and would make this
    // ordering check pass for a body that never locks at all.
    for (const later of ['replay_lock_source_manifest_v1', 'FROM public.replay_current_version_state s',
      'INSERT INTO public.replay_lifecycle_events']) {
      const at = body.indexOf(later);
      if (at >= 0) assert.ok(at > lock, `${name} reaches ${later} only after the Replay is locked`);
    }
    assert.doesNotMatch(body, /pg_advisory|LOCK TABLE/u, `${name} takes no advisory or table lock`);
  }
  // The preview compares and swaps the exact draft revision, and revalidates
  // the source through the ONE frozen I-06A derivation.
  //
  // Each gate is pinned as the EXACT CONDITION, not only as the name of the
  // function it consults or the class it raises: `IF false THEN` beside an
  // untouched RAISE leaves both of those in place while the gate never fires,
  // and a contract that checked only those would call that a pass.
  const preview = functionBody(PREVIEW).body;
  assert.match(preview, /state\.draft_revision <> p_expected_draft_revision/u);
  assert.match(preview, /REPLAY_DRAFT_STALE/u);
  assert.match(preview, /derive_replay_source_manifest_currency_v1/u);
  assert.match(preview, /IF currency IS DISTINCT FROM 'CURRENT' THEN/u,
    'a preview refuses on any source currency but CURRENT');
  assert.match(preview, /REPLAY_SOURCE_STALE/u);
  assert.match(preview, /IF safety\.unsafe_count > 0 THEN/u,
    'and refuses any cut that is not proven SAFE');
  assert.ok(preview.indexOf('replay_lock_source_manifest_v1') < preview.indexOf('derive_replay_source_manifest_currency_v1'),
    'the source is stabilized before it is asked whether it is still current');
  assert.doesNotMatch(migration, /CREATE FUNCTION public\.\w*(?:source_currency|source_availability|manifest_currency)\w*/u,
    'no competing source-currency evaluator is created');
});

test('finalization revalidates every frozen truth and builds nothing; a reopen mutates no old version', () => {
  const finalize = functionBody(FINALIZE).body;
  assert.match(finalize, /pointer\.current_replay_version_id <> p_expected_replay_version_id/u);
  assert.match(finalize, /REPLAY_VERSION_STALE/u);
  assert.match(finalize, /replay_lock_source_manifest_v1/u);
  assert.match(finalize, /IF currency IS DISTINCT FROM 'CURRENT' THEN/u,
    'finalization refuses on any source currency but CURRENT');
  assert.match(finalize, /derive_replay_version_truth_currency_v1/u);
  assert.match(finalize, /WHERE t\.currency_state = 'DIVERGED';/u,
    'and acts on the divergence the truth revalidation actually reports');
  for (const refusal of ['REPLAY_SOURCE_STALE', 'REPLAY_ANALYTICAL_PROJECTION_STALE',
    'REPLAY_RENDER_CONTRACT_STALE', 'REPLAY_SEMANTIC_CUT_UNSAFE']) {
    assert.ok(finalize.includes(refusal), `finalization refuses ${refusal}`);
  }
  assert.match(finalize, /INSERT INTO public\.replay_version_finalizations/u,
    'finalization appends exact-version evidence I-06C can read directly');
  assert.doesNotMatch(finalize, /INSERT INTO public\.replay_analytical_projection|INSERT INTO public\.replay_render_contract/u,
    'finalization never silently builds a new Replay Version: if truth changed it fails');
  assert.doesNotMatch(finalize, /INSERT INTO public\.replay_versions\b/u);
  // The truth revalidation re-derives the projection at every represented
  // coordinate and the contract from its own bound composition.
  const truth = functionBody(TRUTH).body;
  assert.match(truth, /get_session_historical_projection_v1\(manifest\.personal_session_id, point\.represented_session_position\)/u);
  assert.match(truth, /recomputed IS DISTINCT FROM point\.point_digest/u);
  assert.match(truth, /recomputed IS DISTINCT FROM contract\.contract_digest/u);
  assert.match(functionBody(TRUTH).header, /LANGUAGE plpgsql SECURITY DEFINER STABLE/u);
  // A reopen returns the STABLE Replay to DRAFT and leaves every version alone.
  const reopen = functionBody(REOPEN).body;
  assert.match(reopen, /NOT IN \('PREVIEW_READY', 'FINALIZED'\)/u);
  assert.match(reopen, /SET current_lifecycle = 'DRAFT'/u);
  assert.doesNotMatch(reopen, /UPDATE public\.replay_versions|DELETE FROM public\.replay_version|UPDATE public\.replay_analytical|UPDATE public\.replay_render/u,
    'a previously finalized version stays historically finalized after later editing');
});

test('the ONE read boundary is creator-exact, service-role only and discloses no source identity', () => {
  const { body, header } = functionBody(RESOLVER);
  assert.match(header, /LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=''/u);
  assert.match(body, /r\.created_by_user_id = p_user_id/u, 'a stranger receives zero rows');
  for (const column of resultColumns(RESOLVER)) {
    assert.doesNotMatch(column, DISCLOSURE_BAN, `the resolver must not return ${column}`);
  }
  assert.ok(resultColumns(RESOLVER).length >= 10, 'and it does answer the composition shape');
  // It deliberately reports no analytical truth currency, and says why: the
  // canonical historical projection is owner-scoped on auth.uid() itself.
  assert.ok(!resultColumns(RESOLVER).includes('truth_currency_state'));
  assert.ok(migration.includes('owner-scoped on auth.uid() itself'),
    'the migration explains the asymmetry rather than leaving a silent gap');
  assert.doesNotMatch(body, /FOR UPDATE|FOR SHARE|INSERT INTO|DELETE FROM/u, 'it writes nothing and locks nothing');
});

test('the command history is narrow, sealed and structurally bound to the creator', () => {
  for (const table of OWN_TABLES) {
    const block = tableBlock(table);
    assert.match(block, /FOREIGN KEY \(replay_id, actor_user_id\)\s*\n\s*REFERENCES public\.replays \(id, created_by_user_id\)/u,
      `${table} binds its actor to the exact Replay creator through the 0100 identity key`);
    assert.match(block, /CHECK \(request_ref ~ '\^sha256:\[0-9a-f\]\{64\}\$'\)/u,
      `${table} binds the whole immutable request`);
    assert.doesNotMatch(block, /^\s+\w*(?:body|content|payload|reason|note|safety|launch|entitle|approv|distribut|share|download|export)\w*\s+\w/mu,
      `${table} carries no content, reason, clearance or distribution column`);
    assert.doesNotMatch(block, /\b(?:json|jsonb|bytea)\b/u);
    assert.ok(executableSql.includes(`ALTER TABLE public.${table} OWNER TO postgres;`));
    assert.ok(executableSql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`));
  }
  assert.doesNotMatch(executableSql, /CREATE POLICY/u, 'zero policies');
  // One committed preview per exact version, one finalization per exact version.
  assert.match(tableBlock('replay_preview_commands'), /UNIQUE \(resulting_replay_version_id\)/u);
  assert.match(tableBlock('replay_finalization_commands'), /UNIQUE \(replay_version_id\)/u);
});

test('the self-assertions refuse to deploy a migration that lost any of this, and ban nothing the roadmap needs', () => {
  assert.ok(SELF_ASSERT_START > 0, '0103 carries a deploy-time self-assertion block');
  for (const phrase of [
    'must derive the human from auth.uid() and never from a parameter',
    'may not accept an actor authority audience safety digest discontinuity or coverage parameter',
    'accepts no clock: the ONE instant is read from the database',
    'must read the database clock exactly once for every authoritative moment',
    'must check durable idempotency before any lock and again under it',
    'must take the Replay row FOR UPDATE first',
    'a stranger and a nonexistent Replay must reach ONE bounded class in %',
    'declares an EXACT input list and no source payload',
    'the wall-clock Material expiry mapping must be excluded from the sealed historical digest',
    'must be stable under element ordering',
    'must run no model over historical source and synthesize no original medium',
    'must never read a wall-clock creation time as a temporal anchor',
    'must mutate no Personal Shared Public or historical relation',
    'must never rewrite a frozen I-06A component',
    'must carry no distribution action: finalized is not distributed',
    'must claim no Safety Launch or entitlement clearance',
    'a preview locks the Replay first, stabilizes the source second',
    'must revalidate source currency through the ONE frozen I-06A derivation',
    'competing previews must compare and swap the exact draft revision',
    'only a proven-safe cut may enter a complete Replay Version',
    'must reference no package approval membership or public surface relation',
    'must consume the canonical historical projection at the exact represented Session Position',
    'an unsupported source class must fail closed with one bounded capability-unavailable class',
    'an open Live Head can never be frozen as historical analytical truth',
    'must not read the historical substrate directly',
    'must refuse an unproven cut and a medium with no authorized delivery path',
    'finalization must bind the EXACT current previewed version',
    'finalization must revalidate the analytical projection commitment and the render contract integrity',
    'finalization must append exact-version evidence',
    'finalization must never silently build a new Replay Version',
    'a reopen must never mutate an old Replay Version or its finalization evidence',
    'must disclose no source identity no private path and no internal divergence cause',
    'must bind its actor to the exact Replay creator through the identity key',
    'the frozen CW2-08 prerequisite seam must still answer NOT_EVALUATED',
  ]) {
    assert.ok(selfAssertions.includes(phrase), `the self-assertions refuse a migration missing: ${phrase}`);
  }
  for (const future of ['distribution_package', 'distribution_approval', 'required_approver',
    'source_loss', 'launch_gate', 'republish']) {
    assert.doesNotMatch(selfAssertions, new RegExp(`RAISE EXCEPTION[^;]*${future}`, 'iu'),
      `no self-assertion may forbid a later reviewed ${future}`);
  }
});

test('0103 is registered in the toolchain, the focused gate, the I-06B CI group, the README and the phase document', () => {
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --env-file-if-exists=\\.env database/verify-migration-0103\\.mjs"`, 'u'));
  assert.match(readme, /0103_replay_preview_finalization_runtime_v1\.sql/u);
  assert.ok(readme.includes(`npm run ${OWN_SCRIPT}`), 'the README records the verifier command');
  assert.match(verifier, /verifier for migration 0103/iu);
  const groups = JSON.parse(focused).groups;
  assert.ok(groups['i06b-0103'], 'the focused gate can select 0103 alone');
  assert.deepEqual(groups['i06b-all'].verifiers,
    ['database/verify-migration-0102.mjs', 'database/verify-migration-0103.mjs']);
  assert.ok(workflow.includes(`if npm run ${OWN_SCRIPT}; then result_0103=PASS; else status=1; fi`));
  assert.ok(workflow.includes(`if npm run ${PART_A_SCRIPT}; then result_0102=PASS; else status=1; fi`),
    'both I-06B verifiers run, and one failing never silently skips the other');
  const step = workflow.slice(workflow.indexOf('- name: Verify the two I-06B Replay analytical projection and preview finalization verifiers'));
  const body = step.slice(0, step.indexOf('\n      - '));
  assert.ok(body.includes('exit "$status"'), 'the grouped I-06B step fails the job when either verifier failed');
  assert.ok(body.indexOf(PART_A_SCRIPT) < body.indexOf(OWN_SCRIPT), '0102 is reported before 0103');
  assert.doesNotMatch(workflow, /^\s*continue-on-error\s*:/mu);
  // The phase document tells the truth about where I-06 stands.
  assert.ok(doc.includes('I-06') && doc.includes('ACTIVE'), 'the phase document records I-06 as ACTIVE');
  assert.ok(doc.includes('I-06A') && doc.includes('CLOSED'), 'and I-06A as closed and merged');
  assert.ok(doc.includes('CANDIDATE'), 'and I-06B as a candidate awaiting independent review');
  assert.doesNotMatch(doc, /^\s*`?I-06`?\s+(?:is\s+)?(?:CLOSED|FROZEN)/mu, 'and never claims I-06 is closed or frozen');
  // The capability matrix is documented exactly, with no optimistic parity.
  for (const phrase of ['PERSONAL_SESSION_HISTORICAL_PROJECTION', 'LEGACY_UNCOVERED',
    'REPLAY_ANALYTICAL_PROJECTION_UNAVAILABLE', 'FINALIZED is not distributed',
    'I-06C', 'I-06D']) {
    assert.ok(doc.includes(phrase), `the phase document records ${phrase}`);
  }
});

test('the verifier proves the scenario matrix, the refused weakenings and the race matrix', () => {
  // The DECLARED scenario, not a code and not the phrase: a code survives
  // deleting the proof under it, and the verifier's own header describes every
  // scenario in prose, so a bare phrase is satisfied by the description of a
  // scenario that no longer runs.
  for (const scenario of [
    'P01 a covered sealed Personal selection previews into ONE complete Replay Version',
    'P02 a stranger and a nonexistent Replay reach ONE bounded class',
    'P03 an unsupported source class fails closed and its DRAFT survives',
    'P04 a LEGACY UNCOVERED Personal Session fails closed',
    'P05 the open Live Head can never be frozen as historical truth',
    'P06 an unproven partial cut cannot preview',
    'P07 a stale bound source cannot preview',
    'P08 no application role can execute any I-06B primitive',
    'A01 every point binds the canonical projection at the selected item own position',
    'A02 an earlier represented point contains no later knowledge',
    'A03 the same sealed state digests identically',
    'A04 a different represented coordinate digests differently',
    'A05 a world advance that adds no knowledge leaves a sealed digest unchanged',
    'A06 the frozen truth revalidates, and diverges when the canonical answer moves',
    'C01 a non-contiguous selection produces exact discontinuity facts',
    'C02 a discontinuity names no omitted item and copies no content',
    'C03 the render contract binds the exact composition and its digest recomputes',
    'C04 an audio-bearing selection cannot build a render contract',
    'L01 a preview retry is idempotent and a reused command id conflicts',
    'L02 finalization requires the EXACT current previewed version',
    'L03 finalization evidence is append-only and a retry is idempotent',
    'L04 a reopen mutates no old Replay Version and erases no finalization',
    'L05 the next preview after a revision creates a NEW Replay Version',
    'R01 competing previews serialize and the stale loser fails',
    'R02 a source deletion racing finalization cannot commit',
    'R03 competing finalizations cannot both commit',
  ]) {
    assert.ok(verifier.includes(`report.isolated('${scenario}'`) || verifier.includes(`report.section('${scenario}'`),
      `the 0103 verifier RUNS the scenario: ${scenario}`);
  }
  for (const needle of [
    'f1 a projection over an unsupported source class is a regression',
    'f2 a frozen open-head projection is a regression',
    'f3 a blindly safe partial cut is a regression',
    'f4 a preview that commits over a stale source is a regression',
    'f5 a finalization that skips projection revalidation is a regression',
    'f6 a preview reachable by an application role is a regression',
    'f7 a read boundary that answers a stranger is a regression',
    'anti-vacuity', 'SAVEPOINT forward_safety',
    'REPLAY_ANALYTICAL_PROJECTION_UNAVAILABLE',
    'REPLAY_ANALYTICAL_PROJECTION_OPEN_HEAD',
    'REPLAY_ANALYTICAL_PROJECTION_STALE',
    'REPLAY_SEMANTIC_CUT_UNSAFE',
    'REPLAY_SOURCE_STALE', 'REPLAY_VERSION_STALE', 'REPLAY_DRAFT_STALE',
    'REPLAY_LIFECYCLE_INVALID', 'REPLAY_COMMAND_ID_CONFLICT']) {
    assert.ok(verifier.includes(needle), `the 0103 verifier proves ${needle}`);
  }
  // EVERY PROBE REPORTS ITS OWN OUTCOME IN ONE INVOCATION, through the permanent
  // scenario aggregator, so one defect cannot hide every later scenario.
  assert.match(verifier, /createScenarioReport/u, 'the verifier reports scenarios independently');
  assert.match(verifier, /assertAllPassed\(\)/u, 'and fails once at the end, naming every scenario that failed');
  // Every planted weakening must be PROVEN to land before a refusal is expected.
  // The probes share ONE helper, so the landing proof is written once and can
  // never be forgotten by a later probe rather than repeated seven times.
  const forwardSafety = verifier.slice(verifier.indexOf('async function verifyForwardSafety'),
    verifier.indexOf('async function verifyConcurrency'));
  assert.match(forwardSafety, /assert\.notEqual\(weakened, pristine\[from\]/u,
    'the shared probe helper proves every weakening changed the text');
  assert.match(forwardSafety, /assert\.ok\(weakened\.includes\(marker\)/u,
    'and that it introduced what the probe says it introduced');
  assert.equal((forwardSafety.match(/await probe\('f\d/gu) ?? []).length, 7, 'all seven probes run');
  assert.ok(forwardSafety.indexOf('pristine[name] =') < forwardSafety.indexOf("probe('f1"),
    'the pristine definitions are read before the first probe mutates anything');
  // A refusal inside an open transaction must be taken through the
  // savepoint-holding helper: a bare rejection leaves the transaction ABORTED
  // and every later statement in that scenario fails 25P02 instead.
  assert.doesNotMatch(forwardSafety, /assert\.rejects\(\(\) => rt\./u,
    'an expected database refusal is taken through rejected(), which holds a savepoint');
  assert.match(verifier, /\}, \(\) => rt\.client\.end\(\)\.catch\(\(\) => undefined\)\);\s*$/u,
    'the verifier ends its database client through the envelope on every path');
  // Every launched blocking promise is awaited only after the release edge, or
  // the verifier deadlocks against itself instead of proving a race.
  for (const [launched, release] of [['loser', "await q('COMMIT')"], ['finalizing', "await q('COMMIT')"]]) {
    const launch = verifier.indexOf(`const ${launched} = q2`);
    assert.ok(launch > 0, `${launched} is LAUNCHED on the second connection rather than awaited inline`);
    const released = verifier.indexOf(release, launch);
    const settled = Math.min(...[`await ${launched}`, `assert.rejects(${launched}`, `(await ${launched})`]
      .map((s) => verifier.indexOf(s, launch)).filter((i) => i > 0));
    assert.ok(released > launch && settled > released,
      `${launched} is awaited only after the other connection released`);
  }
  // R02 inverts the roles - the SECOND connection holds the source removal and
  // the FIRST one finalizes - so its release edge is the other commit.
  const r02 = verifier.indexOf('R02 a source deletion racing finalization');
  const launchedFinalize = verifier.indexOf('const finalizing = q(', r02);
  const releasedDelete = verifier.indexOf("await q2('COMMIT')", launchedFinalize);
  assert.ok(launchedFinalize > r02 && releasedDelete > launchedFinalize
    && verifier.indexOf('assert.rejects(finalizing', releasedDelete) > releasedDelete,
  'R02 awaits the blocked finalization only after the removing connection released');
  // The PROOF, not the sentence it prints: `assert.equal(true, true, "…back")`
  // keeps the message and proves nothing.
  assert.ok(support.includes('removeCommittedReplayVersions'), 'the I-06B harness owns the new teardown');
  assert.ok(support.includes('assert.equal(await rt.triggerEnabled(table, trigger), true,'),
    'and PROVES every append-only guard it lifted back, so a teardown can never leave one disabled');
  assert.ok(support.includes('DISABLE TRIGGER') && support.includes('ENABLE TRIGGER'),
    'inside ONE transaction');
});

// ---------------------------------------------------------------------------
// Forward safety and anti-vacuity for the WHOLE I-06B slice.
// ---------------------------------------------------------------------------

const I06B_CONTRACTS = [
  'database/tests/replay-analytical-projection-render-contract-v1.test.mjs',
  'database/tests/replay-preview-finalization-runtime-v1.test.mjs',
];
const MIRRORED = ['.github', 'database', 'tests', 'package.json'];
const SKIP = /(?:^|[\\/])(?:node_modules|\.git|\.expo|\.turbo|coverage)(?:[\\/]|$)/u;

function buildMirror() {
  const mirror = createHarnessMirror('qandeel-i06b-replay-');
  for (const entry of MIRRORED) {
    const from = join(rootPath, entry);
    if (!existsSync(from)) continue;
    cpSync(from, join(mirror, entry), { recursive: true, filter: (src) => !SKIP.test(src.slice(rootPath.length)) });
  }
  // The 0103 contract reads the phase document, which is not otherwise mirrored.
  mkdirSync(join(mirror, 'docs'), { recursive: true });
  writeFileSync(join(mirror, 'docs/replay-runtime-v1.md'), doc);
  return mirror;
}
const write = (mirror, relative, text) => {
  mkdirSync(dirname(join(mirror, relative)), { recursive: true });
  writeFileSync(join(mirror, relative), text);
};
function patch(mirror, relative, from, to) {
  const target = join(mirror, relative);
  const text = readFileSync(target, 'utf8');
  assert.ok(text.includes(from), `the mirrored ${relative} contains the text to patch; it does not contain:\n${from}`);
  assert.equal(text.indexOf(from), text.lastIndexOf(from),
    `the patch anchor for ${relative} occurs more than once, so the mutation would land somewhere unintended`);
  writeFileSync(target, text.replace(from, to));
}
function runInMirror(mirror) {
  const env = { ...process.env, [PROBE_CHILD]: '1' };
  delete env.NODE_TEST_CONTEXT;
  const files = I06B_CONTRACTS.map((relative) => join(mirror, relative));
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files],
    { cwd: mirror, encoding: 'utf8', env, maxBuffer: 128 * 1024 * 1024 });
  assert.equal(result.error, undefined, `the mirrored contracts could not be started: ${result.error?.message}`);
  assert.notEqual(result.status, null, 'the mirrored contracts did not exit normally');
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  assert.match(output, /# pass \d+/u, `the mirrored contracts reported no results:\n${output.slice(-1500)}`);
  assert.doesNotMatch(output, /# pass 0\b/u, 'the mirrored contracts executed nothing');
  return { ok: result.status === 0, output };
}

const M102 = `database/migrations/${PART_A_NAME}`;
const M103 = `database/migrations/${MIGRATION_NAME}`;
const SUPPORT = 'database/replay-version-verifier-support.mjs';
const V102 = 'database/verify-migration-0102.mjs';
const V103 = 'database/verify-migration-0103.mjs';
const CI = '.github/workflows/api-ci.yml';
const GROUP_STEP = '      - name: Verify the two I-06B Replay analytical projection and preview finalization verifiers against real PostgreSQL as one reported group';

test('every authorized later addition leaves both I-06B contracts passing',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
    const mirror = buildMirror();
    try {
      // The roadmap, as a real migration: the I-06C distribution package bound
      // to an exact complete Replay Version, its required approver set and
      // approvals, the three distinct destination acts, an export sanitizer, an
      // I-06D source-loss record and withdrawal rule, a reviewed CW2-08 wrapper
      // that is itself grantable, and additive columns and indexes.
      write(mirror, 'database/migrations/0104_replay_distribution_and_source_loss_v1.sql',
        'BEGIN;\n'
        + 'CREATE TABLE public.replay_distribution_package_versions (id uuid PRIMARY KEY,\n'
        + '  replay_version_id uuid NOT NULL REFERENCES public.replay_versions (id) ON DELETE RESTRICT,\n'
        + '  destination_class text NOT NULL, prepared_at timestamptz NOT NULL);\n'
        + 'CREATE TABLE public.replay_distribution_required_approvers (package_version_id uuid NOT NULL\n'
        + '  REFERENCES public.replay_distribution_package_versions (id) ON DELETE RESTRICT,\n'
        + '  approver_user_id uuid NOT NULL, PRIMARY KEY (package_version_id, approver_user_id));\n'
        + 'CREATE TABLE public.replay_distribution_approvals (id uuid PRIMARY KEY,\n'
        + '  package_version_id uuid NOT NULL REFERENCES public.replay_distribution_package_versions (id) ON DELETE RESTRICT,\n'
        + '  approver_user_id uuid NOT NULL, approved_at timestamptz NOT NULL);\n'
        + "CREATE FUNCTION public.publish_replay_to_public_world_v1(p_command_id uuid, p_package_version_id uuid)\n"
        + "  RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$\n"
        + "  BEGIN RETURN 'PUBLISH_TO_PUBLIC_WORLD'; END$fn$;\n"
        + "CREATE FUNCTION public.share_replay_externally_v1(p_command_id uuid) RETURNS text\n"
        + "  LANGUAGE sql SET search_path='' AS $fn$ SELECT 'SHARE_EXTERNALLY'::text $fn$;\n"
        + "CREATE FUNCTION public.download_replay_v1(p_command_id uuid) RETURNS text\n"
        + "  LANGUAGE sql SET search_path='' AS $fn$ SELECT 'DOWNLOAD'::text $fn$;\n"
        + "CREATE FUNCTION public.replay_export_privacy_sanitization_v1(p_package_version_id uuid) RETURNS text\n"
        + "  LANGUAGE sql SET search_path='' AS $fn$ SELECT 'EXPORT_PRIVACY_SANITIZATION'::text $fn$;\n"
        + 'CREATE TABLE public.replay_source_loss_records (source_manifest_version_id uuid PRIMARY KEY\n'
        + '  REFERENCES public.replay_source_manifest_versions (id) ON DELETE RESTRICT, noted_at timestamptz NOT NULL);\n'
        + 'CREATE TABLE public.replay_distribution_withdrawals (package_version_id uuid PRIMARY KEY\n'
        + '  REFERENCES public.replay_distribution_package_versions (id) ON DELETE RESTRICT, withdrawn_at timestamptz NOT NULL);\n'
        + 'ALTER TABLE public.replay_preview_commands ADD COLUMN client_ref text;\n'
        + 'CREATE INDEX replay_versions_created_idx ON public.replay_versions (created_at);\n'
        + 'CREATE FUNCTION public.launch_gated_prepare_replay_preview_v1(p_command_id uuid, p_replay_id uuid)\n'
        + "  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$ BEGIN PERFORM 1; END$fn$;\n"
        + 'GRANT EXECUTE ON FUNCTION public.launch_gated_prepare_replay_preview_v1(uuid, uuid) TO authenticated;\n'
        + 'COMMIT;\n');
      write(mirror, 'database/verify-migration-0104.mjs', '// A later verifier.\nimport process from "node:process";\nprocess.exitCode = 0;\n');
      write(mirror, 'database/tests/replay-distribution-v1.test.mjs',
        "import test from 'node:test';\ntest('a later slice has its own contract', () => {});\n");
      patch(mirror, CI, GROUP_STEP,
        '      - {name: Verify a later reviewed Replay distribution slice, run: npm run verify:replay-distribution:integration}\n' + GROUP_STEP);
      const { ok, output } = runInMirror(mirror);
      assert.ok(ok,
        'the I-06C distribution package, its approver set and approvals, the three destination acts, an export '
        + 'sanitizer, an I-06D source-loss record and withdrawal rule, a reviewed CW2-08 wrapper, additive columns, '
        + 'an index and a new CI gate must all leave I-06B passing:\n' + output.slice(-2500));
    } finally {
      removeHarnessMirror(mirror);
    }
  });

test('the contracts are not vacuous: every deliberate weakening of I-06B is refused by at least one of them',
  { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
    const regressions = [
      // --- 0102: a Replay Version stops binding all four truths as one composition
      ['a Replay Version component becomes nullable', M102,
        '    analytical_projection_version_id uuid NOT NULL,\n    render_contract_version_id uuid NOT NULL,\n    created_at timestamptz NOT NULL,\n    CONSTRAINT replay_versions_pk',
        '    analytical_projection_version_id uuid,\n    render_contract_version_id uuid,\n    created_at timestamptz NOT NULL,\n    CONSTRAINT replay_versions_pk'],
      ['the render contract binding weakens into an independent key', M102,
        '    CONSTRAINT replay_versions_contract_fk\n        FOREIGN KEY (render_contract_version_id, analytical_projection_version_id,\n                     selection_spec_version_id, source_manifest_version_id, replay_id)',
        '    CONSTRAINT replay_versions_contract_fk\n        FOREIGN KEY (render_contract_version_id)'],
      ['an open Live Head becomes freezable as history', M102,
        '    CONSTRAINT replay_analytical_projection_points_sealed_check CHECK (projection_sealed),',
        '    CONSTRAINT replay_analytical_projection_points_sealed_check CHECK (projection_sealed IS NOT NULL),'],
      ['the represented TC stops being the item own canonical Session Position', M102,
        '    CONSTRAINT replay_analytical_projection_points_manifest_position_fk\n        FOREIGN KEY (source_manifest_version_id, source_item_ordinal, represented_session_position)\n        REFERENCES public.replay_source_manifest_items\n          (manifest_version_id, source_item_ordinal, personal_session_position)\n        ON DELETE RESTRICT',
        '    CONSTRAINT replay_analytical_projection_points_manifest_position_fk\n        FOREIGN KEY (source_manifest_version_id, source_item_ordinal)\n        REFERENCES public.replay_source_manifest_items\n          (manifest_version_id, source_item_ordinal)\n        ON DELETE RESTRICT'],
      ['a partial text cut becomes markable SAFE', M102,
        "    CONSTRAINT replay_semantic_cut_assessments_safe_check\n        CHECK (assessment_result <> 'SAFE' OR anchor_kind = 'WHOLE_ITEM'),",
        '    CONSTRAINT replay_semantic_cut_assessments_safe_check\n        CHECK (assessment_result IS NOT NULL),'],
      ['a partial range stops being pinned to UNPROVEN or REJECTED', M102,
        "    CONSTRAINT replay_semantic_cut_assessments_partial_check\n        CHECK (anchor_kind <> 'TEXT_CODE_POINT_RANGE' OR assessment_result IN ('UNPROVEN', 'REJECTED')),",
        '    CONSTRAINT replay_semantic_cut_assessments_partial_check\n        CHECK (anchor_kind IS NOT NULL),'],
      ['the omitted gap count becomes a written column instead of a derived one', M102,
        '    omitted_source_item_count integer\n        GENERATED ALWAYS AS (right_source_universe_rank - left_source_universe_rank - 1) STORED,',
        '    omitted_source_item_count integer NOT NULL,'],
      ['a discontinuity grows a column describing what was omitted', M102,
        '    right_source_universe_rank integer NOT NULL,\n    omitted_source_item_count',
        '    right_source_universe_rank integer NOT NULL,\n    omitted_body_text text,\n    omitted_source_item_count'],
      ['the render contract grows a codec column', M102,
        '    discontinuity_count integer NOT NULL,\n    contract_digest text NOT NULL,',
        '    discontinuity_count integer NOT NULL,\n    codec text,\n    contract_digest text NOT NULL,'],
      ['an audio-bearing source becomes renderable without an authorized media path', M102,
        "    CONSTRAINT replay_render_contract_versions_medium_check\n        CHECK (source_medium_class = 'ORIGINAL_TEXT_ONLY'",
        "    CONSTRAINT replay_render_contract_versions_medium_check\n        CHECK (source_medium_class IN ('ORIGINAL_TEXT_ONLY', 'ORIGINAL_AUDIO_BEARING')"],
      ['a Shared or Public manifest can carry a Personal historical projection', M102,
        "        CHECK (projection_capability = 'PERSONAL_SESSION_HISTORICAL_PROJECTION' AND source_class = 'MY_WORLD'),",
        '        CHECK (projection_capability IS NOT NULL),'],
      ['a truth component becomes mutable', M102,
        'CREATE TRIGGER replay_versions_immutable', 'CREATE TRIGGER replay_versions_later'],
      ['the lifecycle can jump straight from DRAFT to FINALIZED', M102,
        "       OR (OLD.current_lifecycle = 'PREVIEW_READY' AND NEW.current_lifecycle = 'FINALIZED')\n       OR (OLD.current_lifecycle = 'PREVIEW_READY' AND NEW.current_lifecycle = 'DRAFT')",
        "       OR (OLD.current_lifecycle = 'DRAFT' AND NEW.current_lifecycle = 'FINALIZED')\n       OR (OLD.current_lifecycle = 'PREVIEW_READY' AND NEW.current_lifecycle = 'DRAFT')"],
      ['finalization evidence stops being keyed by the exact version', M102,
        '    CONSTRAINT replay_version_finalizations_pk PRIMARY KEY (replay_version_id),',
        '    CONSTRAINT replay_version_finalizations_pk PRIMARY KEY (replay_version_id, finalized_at),'],
      ['a Replay Version foreign key stops being restrictive', M102,
        '    CONSTRAINT replay_versions_replay_fk\n        FOREIGN KEY (replay_id) REFERENCES public.replays (id) ON DELETE RESTRICT,',
        '    CONSTRAINT replay_versions_replay_fk\n        FOREIGN KEY (replay_id) REFERENCES public.replays (id) ON DELETE CASCADE,'],

      // --- 0103: the runtime stops enforcing truth, authority or privacy
      ['the analytical projection stops consuming the canonical historical projection', M103,
        'FROM public.get_session_historical_projection_v1(manifest.personal_session_id, item.represented_tc);',
        'FROM public.get_session_historical_projection_v1(manifest.personal_session_id, 1);'],
      ['an unsupported source class stops failing closed', M103,
        "  IF manifest.source_class <> 'MY_WORLD' THEN", '  IF false THEN'],
      ['an open Live Head becomes freezable by the runtime', M103,
        '    IF NOT projected.sealed THEN', '    IF false THEN'],
      ['the projection canonicalization takes the source payload', M103,
        '  p_represented_session_position integer,\n  p_emerging_focuses jsonb,',
        '  p_represented_session_position integer,\n  p_moments jsonb,\n  p_emerging_focuses jsonb,'],
      ['the wall-clock expiry mapping enters the sealed historical digest', M103,
        "public.replay_canonical_projection_family_v1('materials', p_materials, ARRAY['expiry'])",
        "public.replay_canonical_projection_family_v1('materials', p_materials, ARRAY[]::text[])"],
      ['the canonicalization stops being stable under element ordering', M103,
        'ORDER BY (e - p_drop)::text COLLATE "C"', 'ORDER BY 1'],
      ['a partial cut is blindly marked safe by the runtime', M103,
        "         CASE WHEN si.anchor_kind = 'WHOLE_ITEM' THEN 'SAFE' ELSE 'UNPROVEN' END,",
        "         'SAFE',"],
      ['a preview stops gating on semantic cut safety', M103,
        '  IF safety.unsafe_count > 0 THEN', '  IF false THEN'],
      ['a preview stops revalidating source currency before it commits', M103,
        "  IF currency IS DISTINCT FROM 'CURRENT' THEN\n    RAISE EXCEPTION 'REPLAY_SOURCE_STALE' USING ERRCODE='40001',\n      DETAIL='A bound source changed, became unavailable, is no longer visible to the creator or is no longer the eligible version; a Replay Version cannot be built over it.';",
        '  IF false THEN\n    RAISE EXCEPTION \'REPLAY_SOURCE_STALE\' USING ERRCODE=\'40001\';'],
      ['competing previews stop comparing and swapping the draft revision', M103,
        '  IF state.draft_revision <> p_expected_draft_revision THEN', '  IF false THEN'],
      ['finalization stops revalidating the frozen analytical truth', M103,
        "  SELECT t.divergence_class INTO divergence\n    FROM public.derive_replay_version_truth_currency_v1(p_expected_replay_version_id) t\n   WHERE t.currency_state = 'DIVERGED';",
        "  SELECT t.divergence_class INTO divergence\n    FROM public.derive_replay_version_truth_currency_v1(p_expected_replay_version_id) t\n   WHERE false;"],
      // The reopen path checks the same pointer, so the anchor carries the
      // finalization's own DETAIL to stay unique to the function under probe.
      ['finalization stops binding the exact current previewed version', M103,
        "  IF pointer.current_replay_version_id <> p_expected_replay_version_id THEN\n    RAISE EXCEPTION 'REPLAY_VERSION_STALE' USING ERRCODE='40001',\n      DETAIL='The Replay Version this finalization names is not the current previewed version.';",
        "  IF false THEN\n    RAISE EXCEPTION 'REPLAY_VERSION_STALE' USING ERRCODE='40001';"],
      ['a mutation accepts a caller-supplied actor', M103,
        'CREATE FUNCTION public.prepare_replay_preview_v1(\n  p_command_id uuid,',
        'CREATE FUNCTION public.prepare_replay_preview_v1(\n  p_actor_user_id uuid,\n  p_command_id uuid,'],
      ['the read boundary answers a stranger', M103,
        '     WHERE r.id = p_replay_id AND r.created_by_user_id = p_user_id;', '     WHERE r.id = p_replay_id;'],
      ['every consequential primitive becomes application-reachable before the Launch Gate', M103,
        "      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', fn);",
        "      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);"],
      ['a reopen silently mutates the old Replay Version', M103,
        "  UPDATE public.replays r SET current_lifecycle = 'DRAFT' WHERE r.id = p_replay_id;\n\n  INSERT INTO public.replay_revision_reopen_commands",
        "  UPDATE public.replays r SET current_lifecycle = 'DRAFT' WHERE r.id = p_replay_id;\n  UPDATE public.replay_versions v SET created_at = instant WHERE v.id = p_expected_replay_version_id;\n\n  INSERT INTO public.replay_revision_reopen_commands"],
      ['a command stops binding its actor to the exact Replay creator', M103,
        '    CONSTRAINT replay_preview_commands_creator_fk\n        FOREIGN KEY (replay_id, actor_user_id)\n        REFERENCES public.replays (id, created_by_user_id) ON DELETE RESTRICT,',
        '    CONSTRAINT replay_preview_commands_creator_fk\n        FOREIGN KEY (actor_user_id)\n        REFERENCES public.users (id) ON DELETE RESTRICT,'],

      // --- the gates themselves
      ['a frozen I-06A migration is edited', M102.replace(PART_A_NAME, '0101_replay_authorized_draft_runtime_v1.sql'),
        'BEGIN;', 'BEGIN;\n-- edited\n'],
      ['the focused selector for the slice is removed', 'database/focused-verifiers.json',
        '"i06b-all"', '"i06b-none"'],
      ['the CI step that runs an I-06B verifier is removed', CI,
        `if npm run ${OWN_SCRIPT}; then result_0103=PASS; else status=1; fi`,
        'if npm run test:toolchain; then result_0103=PASS; else status=1; fi'],
      ['the grouped I-06B CI step stops failing the job when a verifier fails', CI,
        '"$result_0102" "$result_0103" >> "$GITHUB_STEP_SUMMARY"\n          fi\n          exit "$status"\n',
        '"$result_0102" "$result_0103" >> "$GITHUB_STEP_SUMMARY"\n          fi\n          exit 0\n'],
      ['a failing I-06B verifier is swallowed instead of recorded', CI,
        `if npm run ${PART_A_SCRIPT}; then result_0102=PASS; else status=1; fi`,
        `npm run ${PART_A_SCRIPT} || true`],
      ['a failed I-06B verifier hangs its CI step instead of exiting', V103,
        '}, () => rt.client.end().catch(() => undefined));\n', '  await rt.client.end();\n});\n'],
      ['the 0102 verifier stops proving that only a sealed coordinate is representable', V102,
        "'V04 an unsealed represented point is unrepresentable'", "'V04 skipped'"],
      ['the I-06B teardown stops proving the immutability guards back', SUPPORT,
        'assert.equal(await rt.triggerEnabled(table, trigger), true,', 'assert.equal(true, true,'],
    ];
    for (const [reason, file, from, to] of regressions) {
      const fresh = buildMirror();
      try {
        patch(fresh, file, from, to);
        const { ok, output } = runInMirror(fresh);
        assert.equal(ok, false,
          `a repository where ${reason} must break at least one I-06B contract; both passed:\n${output.slice(-1500)}`);
      } finally {
        removeHarnessMirror(fresh);
      }
    }
  });
