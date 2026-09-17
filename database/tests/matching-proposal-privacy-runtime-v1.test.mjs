// I-07B - Candidate eligibility, proposal and privacy runtime v1: secret-free
// structural contract over migrations 0110, 0111 and 0112.
//
// ONE file for three migrations, deliberately. The properties worth a static
// contract here are repository-wide rather than per-migration - "nothing in
// I-07B can spell a second acceptance", "no application role gains EXECUTE
// anywhere in the slice", "every regex built by concatenation is parenthesized"
// - and splitting them three ways would either repeat each one three times or
// leave each file checking a third of a property. Live semantics - rejections,
// ACL behaviour, trigger behaviour, races, rollback - are proven by the three
// real PostgreSQL verifiers this file also pins into the toolchain and CI.
//
// Prose comments explain WHY a construct is forbidden and therefore name it;
// every "must not contain" assertion runs against EXECUTABLE SQL only, because a
// terminal self-assertion block names the words it refuses and would otherwise
// make every such assertion match itself.
//
// The load-bearing cross-check is the last test: the frozen I-07B vocabularies
// exist in TWO places - a PostgreSQL CHECK constraint and a TypeScript const
// array - and nothing but this file would notice if one of them drifted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const NAMES = {
  '0110': '0110_matching_pair_eligibility_proposal_persistence_v1.sql',
  '0111': '0111_matching_candidate_evaluation_disclosure_gate_v1.sql',
  '0112': '0112_matching_proposal_choreography_runtime_v1.sql',
};
const SOURCE = Object.fromEntries(Object.entries(NAMES).map(([n, file]) => [n, read(`../migrations/${file}`)]));
const VERIFIER = Object.fromEntries(Object.keys(NAMES).map((n) => [n, read(`../verify-migration-${n}.mjs`)]));
const support = read('../matching-proposal-verifier-support.mjs');
const setupSupport = read('../matching-setup-verifier-support.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');
const vocabulary = read('../../apps/api/src/connected-worlds/matching/matching-proposal.types.ts');
const setupVocabulary = read('../../apps/api/src/connected-worlds/matching/matching-setup.types.ts');

const stripComments = (sql) => sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const EXECUTABLE = Object.fromEntries(Object.entries(SOURCE).map(([n, sql]) => [n, stripComments(sql)]));
/** One migration's CREATION statements, with COMMENT literals and self-assertions removed. */
const ddlOf = (n, from, to) => {
  const start = SOURCE[n].indexOf(from);
  assert.ok(start >= 0, `${n} contains "${from}"`);
  const end = SOURCE[n].indexOf(to, start);
  assert.ok(end > start, `${n} contains "${to}" after "${from}"`);
  return stripComments(SOURCE[n].slice(start, end)).replace(/COMMENT ON [\s\S]*?';\n/gu, '');
};
/** The literals of one IN-list CHECK constraint. */
const vocabularyOf = (n, constraint) => {
  const match = EXECUTABLE[n].match(new RegExp(`CONSTRAINT ${constraint}\\s+CHECK \\([^)]*IN\\s*\\(([^)]+)\\)\\)`, 'u'));
  assert.ok(match, `${constraint} exists as an IN-list CHECK in ${n}`);
  return [...match[1].matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]);
};
/** The literals of one TypeScript `as const` array. */
const typescriptVocabularyOf = (name, source = vocabulary) => {
  const match = source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`, 'u'));
  assert.ok(match, `the vocabulary module exports ${name}`);
  return [...match[1].matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]);
};

const TABLES_0110 = [
  'matching_eligibility_snapshots', 'matching_hard_requirement_results', 'matching_pairs',
  'matching_permitted_safe_conclusions', 'matching_private_reasoning_notes',
  'matching_proposal_policy_state', 'matching_proposal_policy_versions',
  'matching_proposal_safe_field_keys', 'matching_proposal_transitions', 'matching_proposals',
  'matching_recipient_proposal_view_fields', 'matching_recipient_proposal_view_state',
  'matching_recipient_proposal_views', 'matching_safe_conclusion_candidates',
  'matching_sensitive_filter_refusals',
];

test('the three migrations order directly after the reviewed 0109 tip and edit no historical migration', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.equal(migrations.indexOf(NAMES['0110']),
    migrations.indexOf('0109_matching_setup_human_authority_commands_v1.sql') + 1,
    '0110 orders directly after the reviewed 0109 tip');
  assert.equal(migrations.indexOf(NAMES['0111']), migrations.indexOf(NAMES['0110']) + 1, '0111 follows 0110');
  assert.equal(migrations.indexOf(NAMES['0112']), migrations.indexOf(NAMES['0111']) + 1, '0112 follows 0111');
  for (const [n, file] of Object.entries(NAMES)) {
    assert.equal(migrations.filter((name) => name.startsWith(`${n}_`)).length, 1, `exactly one migration carries ${n}`);
    assert.match(SOURCE[n], /^-- I-07B/u, `${file} declares its slice`);
    assert.match(SOURCE[n], /\nBEGIN;\n/u, `${file} is one transaction`);
    assert.match(SOURCE[n], /COMMIT;\n$/u, `${file} commits`);
    // FORWARD ONLY: nothing existing is dropped, altered, rewritten or renumbered.
    assert.doesNotMatch(EXECUTABLE[n], /DROP (?:TABLE|FUNCTION|TRIGGER|CONSTRAINT|POLICY|INDEX|COLUMN)/iu,
      `${file} drops nothing`);
    assert.doesNotMatch(EXECUTABLE[n], /CREATE (?:POLICY|VIEW|MATERIALIZED VIEW|EXTENSION|TYPE)|EXCLUDE USING/iu,
      `${file} introduces no policy, view, extension or enum type`);
    assert.doesNotMatch(EXECUTABLE[n], /ALTER TABLE public\.(?!matching_)/u,
      `${file} restructures no predecessor relation`);
  }
  // 0108 and 0109 are untouched by this slice: the only I-07A files it changes
  // are the two VERIFIERS whose census now names the relations I-07B adds.
  const historical = read('../migrations/0108_matching_participation_private_setup_foundation_v1.sql');
  assert.match(historical, /^-- I-07A/u, 'migration 0108 is still the I-07A migration it was');
});

test('every identifier the three migrations create fits the PostgreSQL 63-byte limit', () => {
  for (const [n, file] of Object.entries(NAMES)) {
    const identifiers = [...EXECUTABLE[n].matchAll(
      /(?:CREATE TABLE public\.|CONSTRAINT |CREATE (?:UNIQUE )?INDEX |CREATE TRIGGER |CREATE FUNCTION public\.)(\w+)/gu)]
      .map((m) => m[1]);
    assert.ok(identifiers.length >= 15, `${file} names its objects explicitly, found ${identifiers.length}`);
    for (const identifier of identifiers) {
      assert.ok(Buffer.byteLength(identifier) <= 63,
        `${identifier} (${Buffer.byteLength(identifier)} bytes) would be silently truncated by PostgreSQL`);
    }
    assert.equal(new Set(identifiers).size, identifiers.length, `every identifier ${file} creates is unique`);
  }
});

test('0110 introduces exactly the fifteen I-07B relations and no Mutual Match or Introduction state', () => {
  const tables = [...EXECUTABLE['0110'].matchAll(/CREATE TABLE public\.(\w+)/gu)].map((m) => m[1]).sort();
  assert.deepEqual(tables, TABLES_0110);
  assert.doesNotMatch(EXECUTABLE['0110'],
    /public\.(?:\w*mutual_match\w*|\w*match_commit\w*|\w*introduction_slot\w*|\w*introduction_record\w*|\w*match_handoff\w*)\b/iu,
    'no Mutual Match, match commit, Introduction slot, Introduction record or handoff relation');
  // 0110 IS PERSISTENCE: only trigger functions, and no callable boundary.
  const functions = [...EXECUTABLE['0110'].matchAll(/CREATE FUNCTION public\.(\w+)\(\)\nRETURNS (\w+)/gu)];
  assert.equal(functions.length, 7, '0110 creates exactly seven functions');
  for (const [, , returns] of functions) assert.equal(returns, 'trigger', 'and every one of them is a trigger function');
  assert.doesNotMatch(EXECUTABLE['0110'], /SECURITY DEFINER/u, '0110 creates no callable boundary at all');
  assert.doesNotMatch(EXECUTABLE['0110'], /\bGRANT\b/u, 'and no GRANT of any kind');
});

test('no I-07B migration grants EXECUTE to any application role', () => {
  // THE PRE-LAUNCH PROPERTY, as one repository-wide statement. Pre-Match proposal
  // delivery and human proposal decisions are consequential disclosure about two
  // humans, and the CW2-08 Launch Gate that must clear them does not exist here,
  // so nothing in this slice may hand a production caller a path around it.
  let revocations = 0;
  for (const [n, file] of Object.entries(NAMES)) {
    const grants = [...EXECUTABLE[n].matchAll(/GRANT\s+EXECUTE\s+ON\s+FUNCTION[\s\S]{0,120}?TO\s+(\w+)/giu)];
    assert.deepEqual(grants.map((m) => m[1]), [], `${file} grants EXECUTE to nobody`);
    assert.doesNotMatch(EXECUTABLE[n], /GRANT\s+(SELECT|INSERT|UPDATE|DELETE|ALL)\s+ON\s+TABLE/iu,
      `${file} grants no direct table privilege`);
    revocations += (EXECUTABLE[n].match(/REVOKE ALL ON FUNCTION/gu) ?? []).length;
  }
  // NON-VACUITY: the slice really does issue revocations, so "no grants" is a
  // statement about a file that revokes rather than about a file that is empty.
  assert.ok(revocations >= 2, `the slice revokes function execution explicitly, found ${revocations} statements`);
  for (const n of ['0111', '0112']) {
    assert.match(EXECUTABLE[n], /REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated/u,
      `${n} revokes PUBLIC, anon and authenticated`);
    assert.match(EXECUTABLE[n], /REVOKE ALL ON FUNCTION %s FROM service_role/u,
      `${n} revokes service_role too: a system credential never manufactures human Matching consent`);
  }
});

test('there is no SECOND_ACCEPTED anywhere in I-07B, in any spelling', () => {
  // The state the architecture deliberately does not have. Second-party
  // acceptance must revalidate its exact view AND converge atomically with the
  // Mutual Match / two-slot / Introduction-birth transaction, so a durable
  // "accepted but not matched" state would be the thing that makes splitting it
  // across two slices look possible.
  const forbidden = ['SECOND_ACCEPTED', 'ACCEPTED_PENDING_MATCH', 'MATCH_PENDING', 'INTRODUCTION_RESERVED'];
  for (const [n, file] of Object.entries(NAMES)) {
    for (const state of forbidden) {
      // The 0110 and 0112 self-assertions NAME these words in order to refuse
      // them, so the search runs over the DDL and the function bodies rather
      // than over the assertion blocks that spell them.
      const body = n === '0110'
        ? ddlOf('0110', 'BEGIN;', '-- 7. IMMUTABILITY AND TRUTH TRIGGERS.')
        : stripComments(SOURCE[n].slice(0, SOURCE[n].indexOf('TERMINAL SELF-ASSERTIONS')));
      assert.ok(!body.includes(state), `${file} cannot spell ${state}`);
    }
  }
  // NON-VACUITY: the vocabulary the CHECK really carries is the eleven frozen
  // states, so "no acceptance state" is a statement about a real list.
  assert.equal(vocabularyOf('0110', 'matching_proposals_state_check').length, 11,
    'the proposal state vocabulary is exactly the eleven frozen CW2-06 states');
  // ... and the two reserved I-07C states are among them, so no ceiling has to
  // be relaxed by the slice that needs them.
  for (const reserved of ['CANCELLED_BY_COMPETING_MATCH', 'MUTUAL_MATCH_COMMITTED']) {
    assert.ok(vocabularyOf('0110', 'matching_proposals_state_check').includes(reserved),
      `${reserved} stays representable for I-07C`);
  }
});

test('no I-07B relation or column can carry a visible ranking, score or percentage', () => {
  const ddl = ddlOf('0110', 'BEGIN;', '-- 7. IMMUTABILITY AND TRUTH TRIGGERS.');
  const columns = [...ddl.matchAll(/^ {4}(\w+) (uuid|text|timestamptz|integer|boolean)\b/gmu)].map((m) => m[1]);
  assert.ok(columns.length > 80, `the I-07B relations declare columns to check, found ${columns.length}`);
  const RANKED = /(^|_)(score|rank|ranking|weight|weighted|priority|percent|percentage|rating|percentile|leaderboard|ordinal|position)(_|$)/u;
  for (const column of columns) {
    assert.doesNotMatch(column, RANKED, `${column} is a ranking column and Matching v1 has no ranking Product`);
  }
  // ... and no JSON, array or blob column through which one could be smuggled.
  assert.doesNotMatch(ddl, /\b(jsonb?|bytea)\b/iu, 'no untyped payload column exists');
  assert.doesNotMatch(ddl, /\w+\s+(uuid|text|integer)\[\]/u, 'and no array column');
  // NON-VACUITY: the detector really fires on the shape it claims to refuse.
  assert.match('compatibility_score', RANKED, 'the ranking detector is exercised rather than vacuous');
  assert.match('match_percentage', RANKED, 'and matches a percentage column too');
});

test('no I-07B function can create a Shared World an Introduction or a Match', () => {
  for (const [n, file] of Object.entries(NAMES)) {
    const bodies = stripComments(SOURCE[n].slice(0, SOURCE[n].indexOf('TERMINAL SELF-ASSERTIONS')));
    assert.doesNotMatch(bodies, /INSERT INTO public\.shared_worlds/u, `${file} creates no Shared World`);
    assert.doesNotMatch(bodies, /INSERT INTO public\.shared_world_membership_episodes/u,
      `${file} creates no Introduction membership`);
    assert.doesNotMatch(bodies, /MATCH_HANDOFF/iu, `${file} creates no Match handoff package`);
  }
  // The ONE place a Shared World relation may be named is the read-only
  // Introduction resolver, which derives a fact from the canonical substrate
  // 0075 owns and writes nothing.
  const resolver = SOURCE['0111'].slice(
    SOURCE['0111'].indexOf('CREATE FUNCTION public.resolve_matching_active_introduction_v1'),
    SOURCE['0111'].indexOf('-- 3. THE TWO FAIL-CLOSED SEAMS.'));
  assert.match(resolver, /SELECT 1 FROM public\.shared_world_membership_episodes/u,
    'the active-Introduction resolver reads the canonical Shared World substrate');
  assert.doesNotMatch(stripComments(resolver), /INSERT|UPDATE|DELETE/iu, 'and writes nothing at all');
});

test('the two fail-closed seams answer only their refusal', () => {
  const seam = (name, from, to) => stripComments(
    SOURCE['0111'].slice(SOURCE['0111'].indexOf(from), SOURCE['0111'].indexOf(to)));
  const prerequisites = seam('prerequisites',
    'CREATE FUNCTION public.resolve_matching_proposal_prerequisites_v1',
    'CREATE FUNCTION public.resolve_matching_canonical_first_name_v1');
  assert.match(prerequisites, /'NOT_EVALUATED'::text/u, 'the CW2-08 seam answers NOT_EVALUATED');
  assert.doesNotMatch(prerequisites, /'CLEARED'/u, 'and can never answer CLEARED while no canonical gate exists');
  const firstName = seam('first name',
    'CREATE FUNCTION public.resolve_matching_canonical_first_name_v1',
    '-- 4. THE TWO-HUMAN LOCK.');
  assert.match(firstName, /'UNRESOLVED_NO_CANONICAL_SOURCE'::text/u, 'the first-name seam answers UNRESOLVED');
  assert.doesNotMatch(firstName, /'RESOLVED'/u, 'and can never answer RESOLVED while no canonical source exists');
  // It also reads no Public identity: a Public display label belongs to a
  // different capability and would move a PUBLIC fact into private Matching.
  assert.doesNotMatch(firstName, /public_identit|display_label/u,
    'and never reads a Public World display label');
  // NON-VACUITY: the five consequential boundaries really do require CLEARED, so
  // the seam is a gate rather than an unused function.
  const gated = (SOURCE['0112'].match(/gate\.clearance <> 'CLEARED'/gu) ?? []).length;
  assert.equal(gated, 5, `exactly the five consequential boundaries require CLEARED, found ${gated}`);
});

test('every regex whose pattern is built by concatenation parenthesizes it', () => {
  // PostgreSQL puts `~`, `~*`, `!~`, `!~*` and `||` in the SAME "any other
  // operator" precedence class, so they associate LEFT TO RIGHT and
  // `col ~* 'A' || 'B'` parses as `(col ~* 'A') || 'B'` - a text value where a
  // boolean belongs. It is accepted by every static check and by every reading,
  // and it fails only when the statement actually runs. I-07A lost a focused
  // round to exactly this.
  //
  // Comments are BLANKED rather than deleted so offsets stay true, and because
  // the prose above necessarily spells the broken shape.
  const executableOnly = (sql) => sql.split('\n')
    .map((line) => (line.trim().startsWith('--') ? ' '.repeat(line.length) : line)).join('\n');
  const endOfLiteral = (text, from) => {
    for (let i = from + 1; i < text.length; i += 1) {
      if (text[i] !== "'") continue;
      if (text[i + 1] === "'") { i += 1; continue; }
      return i + 1;
    }
    return -1;
  };
  const offenders = [];
  let concatenated = 0;
  for (const [n, file] of Object.entries(NAMES)) {
    const text = executableOnly(SOURCE[n]);
    for (const match of text.matchAll(/(!?~\*?)(\s*)(\(?)\s*'/gu)) {
      const quoteAt = match.index + match[0].length - 1;
      const after = endOfLiteral(text, quoteAt);
      if (after < 0 || !/^\s*\|\|/u.test(text.slice(after, after + 40))) continue;
      concatenated += 1;
      if (match[3] !== '(') {
        offenders.push(`${file} line ${text.slice(0, match.index).split('\n').length}: ${match[1]}`);
      }
    }
  }
  assert.ok(concatenated >= 8,
    `the detector found ${concatenated} concatenated pattern(s), so it is exercised rather than vacuous`);
  assert.deepEqual(offenders, [],
    'a regex pattern built by concatenation must be parenthesized, or it parses as (regex-match) || text');
});

test('every human decision enters the serialized region before it checks the exact view', () => {
  // THE ORDERING IS THE PROPERTY. `materialize_matching_recipient_view_core_v1`
  // supersedes a recipient view while holding the canonical two-human lock, so a
  // decision that checked the view BEFORE taking that lock leaves a window: it
  // accepts V1, a concurrent materialization commits V2 and releases, and the
  // decision then acts on a view that is no longer current. The compare-and-swap
  // on the proposal state does not close it, because materializing a view does
  // not change the proposal state.
  //
  // The real PostgreSQL race (0112 scenario E06) is the authority; this only
  // stops the order drifting back between runs of it.
  const bodies = [...SOURCE['0112'].matchAll(
    /CREATE FUNCTION public\.((?:decline|approve|withdraw)_matching_[a-z_]+_v1)\(([\s\S]*?)\nEND\$\$;/gu)];
  assert.equal(bodies.length, 4, `the four human decision bodies are found, got ${bodies.length}`);
  for (const [, name, body] of bodies) {
    const executable = stripComments(body);
    const entry = executable.indexOf('enter_matching_proposal_decision_v1');
    const check = executable.indexOf('assert_matching_recipient_view_current_v1');
    assert.ok(entry >= 0, `${name} enters through the serialized decision entry point`);
    assert.ok(check >= 0, `${name} checks the exact recipient view version`);
    assert.ok(entry < check,
      `${name} must take the canonical two-human lock BEFORE it checks the exact recipient view`);
    // And it never takes that lock a second way, which would make the order above
    // true of one call and false of the real one.
    assert.doesNotMatch(executable, /lock_matching_pair_humans_v1/u,
      `${name} reaches the two-human lock only through the one entry point`);
  }
  // The entry point really is the thing that locks, and it answers the bounded
  // not-found BEFORE locking so a caller who is no part of the proposal never
  // causes a serialization row to be written.
  const entryBody = stripComments(SOURCE['0112'].slice(
    SOURCE['0112'].indexOf('CREATE FUNCTION public.enter_matching_proposal_decision_v1'),
    SOURCE['0112'].indexOf('COMMENT ON FUNCTION public.enter_matching_proposal_decision_v1')));
  assert.ok(entryBody.indexOf('MATCHING_PROPOSAL_NOT_FOUND') < entryBody.indexOf('lock_matching_pair_humans_v1'),
    'the bounded not-found is answered before any lock is taken');
  assert.equal((entryBody.match(/MATCHING_PROPOSAL_NOT_FOUND/gu) ?? []).length, 2,
    'a nonexistent proposal and one this human is no part of are the SAME bounded answer');
});

test('the disclosed field needs both gates and the value ban is structural', () => {
  const fields = ddlOf('0110', 'CREATE TABLE public.matching_recipient_proposal_view_fields',
    'CREATE TABLE public.matching_recipient_proposal_view_state');
  // GATE ONE: the subject human approved this exact key on this exact authority.
  assert.match(fields, /REFERENCES public\.pre_match_disclosure_authority_fields \(authority_id, field_key\)/u,
    'a disclosed field is bound to a real approved field of a real authority');
  // GATE TWO: Product permits this exact key before a Mutual Match.
  assert.match(fields, /REFERENCES public\.matching_proposal_safe_field_keys \(policy_version_id, field_key\)/u,
    'and to a key the current Product proposal-safety policy permits');
  // THE VALUE IS BOUNDED TOO: I-07A bans a contact-route KEY, and a value is
  // free text, so a benign key may not smuggle a route through it.
  assert.match(fields, /matching_recipient_view_fields_route_ban_check/u, 'the disclosed value carries a route ban');
  assert.match(fields, /matching_recipient_view_fields_provenance_ban_check/u, 'and a source-identifier ban');
  // NON-VACUITY: both gates really are FOREIGN KEYS rather than comments.
  assert.equal((fields.match(/FOREIGN KEY/gu) ?? []).length, 4,
    'the field row carries four foreign keys: its view twice, the human authority and the Product policy');
});

test('the frozen I-07B vocabularies are identical in the database and in the TypeScript contract', () => {
  // The load-bearing cross-check. Each vocabulary lives in a PostgreSQL CHECK and
  // in a TypeScript const array, and nothing but this assertion would notice if
  // one of them drifted from the other.
  assert.deepEqual(vocabularyOf('0110', 'matching_proposals_state_check'),
    typescriptVocabularyOf('MATCHING_PROPOSAL_STATES'));
  assert.deepEqual(vocabularyOf('0110', 'matching_hard_requirement_results_outcome_check'),
    typescriptVocabularyOf('MATCHING_HARD_REQUIREMENT_OUTCOMES'));
  assert.deepEqual(vocabularyOf('0110', 'matching_hard_requirement_results_source_check'),
    typescriptVocabularyOf('MATCHING_EVIDENCE_SOURCE_CLASSES'));
  assert.deepEqual(vocabularyOf('0110', 'matching_proposal_policy_versions_kind_check'),
    typescriptVocabularyOf('MATCHING_PROPOSAL_POLICY_KINDS'));
  assert.deepEqual(vocabularyOf('0110', 'matching_recipient_proposal_views_role_check'),
    typescriptVocabularyOf('MATCHING_RECIPIENT_ROLES'));
  assert.deepEqual(vocabularyOf('0110', 'matching_sensitive_filter_refusals_class_check'),
    typescriptVocabularyOf('MATCHING_FILTER_REFUSAL_CLASSES'));
  assert.deepEqual(vocabularyOf('0110', 'matching_proposal_transitions_reason_check'),
    typescriptVocabularyOf('MATCHING_PROPOSAL_PRIVATE_REASONS'));

  // The nine produced states and the two reserved ones partition the eleven, as
  // NARROWED TYPES rather than comments, so a later caller cannot pass a reserved
  // state to an I-07B producer by accident.
  const all = typescriptVocabularyOf('MATCHING_PROPOSAL_STATES');
  const produced = typescriptVocabularyOf('I07B_PRODUCED_PROPOSAL_STATES');
  const reserved = typescriptVocabularyOf('I07C_RESERVED_PROPOSAL_STATES');
  assert.deepEqual([...produced, ...reserved].sort(), [...all].sort(),
    'the produced and reserved states partition the eleven frozen states exactly');
  assert.equal(produced.filter((s) => reserved.includes(s)).length, 0, 'and the two sets are disjoint');
  assert.deepEqual(reserved, ['CANCELLED_BY_COMPETING_MATCH', 'MUTUAL_MATCH_COMMITTED'],
    'the two reserved states have no I-07B producer');
  // The live states are exactly the ones the one-live-per-pair index names.
  const indexPredicate = EXECUTABLE['0110'].match(
    /matching_proposals_one_live_per_pair_idx[\s\S]*?WHERE proposal_state IN \(([^)]+)\)/u);
  assert.ok(indexPredicate, 'the one-live-per-pair index exists');
  assert.deepEqual([...indexPredicate[1].matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]),
    typescriptVocabularyOf('MATCHING_LIVE_PROPOSAL_STATES'),
    'the four live states are the same in the index predicate and in the TypeScript contract');
  // The neutral outcomes are the same in the projection and in the contract.
  const projection = SOURCE['0112'].slice(
    SOURCE['0112'].indexOf('CREATE FUNCTION public.resolve_matching_proposal_neutral_outcome_v1'),
    SOURCE['0112'].indexOf('CREATE FUNCTION public.resolve_my_matching_proposal_v1'));
  for (const outcome of typescriptVocabularyOf('MATCHING_NEUTRAL_PROPOSAL_OUTCOMES')) {
    assert.ok(stripComments(projection).includes(`'${outcome}'`),
      `the neutral projection really can answer ${outcome}`);
  }

  // The vocabulary module is import-closed and evaluates nothing.
  assert.doesNotMatch(vocabulary, /^import\b/mu, 'the vocabulary module imports nothing at all');
  assert.doesNotMatch(vocabulary, /\bfunction\b|=>|\bclass\b|\brequire\(/u, 'and defines no behaviour');
  // Over the EXECUTABLE TypeScript only: the header prose names the deferred
  // I-07C and I-07D concepts precisely in order to say they are absent.
  const executableTypescript = vocabulary.split('\n').filter((line) => !line.trim().startsWith('*')
    && !line.trim().startsWith('//') && !line.trim().startsWith('/*')).join('\n');
  // The test is over the EXPORTED NAMES rather than over every character,
  // because `VISIBLE_RANKING` is a legitimate value: it is the private class of
  // a filter REFUSAL, which is the opposite of a ranking Product. A detector
  // that banned the substring would refuse the thing that refuses ranking.
  const exported = [...executableTypescript.matchAll(/export (?:const|type|interface) (\w+)/gu)].map((m) => m[1]);
  assert.ok(exported.length >= 20, `the vocabulary module exports names to check, found ${exported.length}`);
  for (const name of exported) {
    assert.doesNotMatch(name, /Score|SCORE|Rank(?!ing)|RANK(?!ING)|Percent|PERCENT|Weight|WEIGHT|Leaderboard|LEADERBOARD/u,
      `${name} would be a ranking identifier, and Matching v1 has no ranking Product`);
  }
  // The I-07C concept names are matched in FULL. A bare `MATCH_COMMIT` is a
  // prefix of `MUTUAL_MATCH_COMMITTED`, which is a legitimately REPRESENTABLE
  // reserved state, so the short form would refuse the very thing that keeps
  // I-07C from having to relax a ceiling.
  assert.doesNotMatch(executableTypescript,
    /SECOND_ACCEPTED|ACCEPTED_PENDING_MATCH|MATCH_PENDING|MATCH_COMMIT_ID|ACTIVE_INTRODUCTION_SLOT|MATCH_HANDOFF/u,
    'and no second-acceptance, match-commit, Introduction-slot or handoff value exists');
  assert.ok(executableTypescript.includes('MUTUAL_MATCH_COMMITTED'),
    'while the reserved I-07C state itself stays representable, which is the point of the full-name match above');
  // NON-VACUITY: a compatibility percentage really would be caught.
  assert.match('MatchingCompatibilityScore', /Score|SCORE/u, 'the ranking-identifier detector is exercised');
  // The I-07A vocabulary module is UNCHANGED: I-07B is its sibling, not its
  // extension, and I-07A still invents no proposal word.
  assert.doesNotMatch(
    setupVocabulary.split('\n').filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//')).join('\n'),
    /score|rank|percent|compatib|PAIR_KEY|proposal|candidate/iu,
    'the frozen I-07A vocabulary module is untouched and still invents no candidate or proposal vocabulary');
  assert.deepEqual(typescriptVocabularyOf('MATCHING_PARTICIPATION_STATES', setupVocabulary), ['OFF', 'ACTIVE', 'PAUSED'],
    'and still carries the I-07A participation vocabulary exactly as I-07A froze it');
});

test('the three real-PostgreSQL verifiers are pinned into the toolchain and into CI', () => {
  for (const [n, script] of [
    ['0110', 'verify:matching-pair-eligibility-proposal-persistence:integration'],
    ['0111', 'verify:matching-candidate-evaluation-disclosure-gate:integration'],
    ['0112', 'verify:matching-proposal-choreography-runtime:integration'],
  ]) {
    assert.ok(packageJson.includes(`"${script}"`), `${script} exists in package.json`);
    assert.ok(packageJson.includes(`database/verify-migration-${n}.mjs`), `and runs the ${n} verifier`);
    assert.ok(workflow.includes(`npm run ${script}`), `${script} runs in API CI`);
    assert.ok(readme.includes(NAMES[n]), `${NAMES[n]} is documented in the database README`);
    // Each verifier aggregates its scenarios, so one defect cannot hide the rest.
    assert.match(VERIFIER[n], /createScenarioReport/u, `the ${n} verifier reports every scenario independently`);
    assert.match(VERIFIER[n], /report\.assertAllPassed\(\)/u, `and fails once with all of them named`);
  }
  // The I-07B group runs after the canonical I-07A group, as one reported group.
  assert.ok(workflow.indexOf('verify:matching-pair-eligibility-proposal-persistence:integration')
    > workflow.indexOf('verify:matching-setup-human-authority-commands:integration'),
  'the I-07B verifier group runs after the I-07A group in API CI');
});

test('the I-07A censuses name the relations I-07B adds rather than being dodged', () => {
  // A CENSUS COMPARES THE LIVE CATALOG, which is what lets it catch a lifecycle
  // relation nobody declared - and I-07B legitimately adds eleven to the same
  // namespace. The intended answer is to put them IN the census, exactly as
  // I-06C put its new outward Public resolver into the I-05C one. Renaming out
  // of the pattern is the dodge a census exists to prevent, and this asserts
  // that the list is complete rather than that it merely exists.
  // Since I-07C the shared list is the UNION of one array per reviewed slice,
  // so the I-07B half is read from its own named array: every lifecycle-shaped
  // relation 0110 creates is named there, and nothing else is. The union itself
  // is asserted to be built from exactly the per-slice arrays, so a relation
  // cannot enter the census without being owned by a named slice.
  const i07bStart = setupSupport.indexOf('export const I07B_LIFECYCLE_RELATIONS = [');
  assert.ok(i07bStart >= 0, 'the setup support names the I-07B half of the shared census list');
  const i07bBlock = setupSupport.slice(i07bStart, setupSupport.indexOf('];', i07bStart));
  const listed = [...i07bBlock.matchAll(/^ {2}'(matching_[a-z_]+)',$/gmu)].map((m) => m[1]);
  const declared = TABLES_0110.filter((name) =>
    /(candidate|proposal|pair|mutual|commit|slot|snapshot|eligibility|compatib|leaderboard|rank|score)/u.test(name));
  assert.deepEqual(listed.sort(), declared.sort(),
    'every lifecycle-shaped relation 0110 creates is named in the I-07B half of the shared census list, and nothing else is');
  assert.match(setupSupport,
    /export const LATER_SLICE_LIFECYCLE_RELATIONS = \[\.\.\.I07B_LIFECYCLE_RELATIONS, \.\.\.I07C_LIFECYCLE_RELATIONS\]\.sort\(\);/u,
    'the shared census list is exactly the union of the two reviewed per-slice arrays');
  for (const n of ['0108', '0109']) {
    const verifier = read(`../verify-migration-${n}.mjs`);
    assert.match(verifier, /LATER_SLICE_LIFECYCLE_RELATIONS/u,
      `the ${n} verifier census asserts an equality against the named list`);
    assert.match(verifier, /MATCHING_LIFECYCLE_WORDS/u,
      `and still proves that none of them is an I-07A relation`);
  }
  // NON-VACUITY: the four relations whose names carry NO lifecycle word are
  // deliberately absent from the census, so the list is a filter and not a copy.
  assert.deepEqual(TABLES_0110.filter((name) => !declared.includes(name)).sort(),
    ['matching_hard_requirement_results', 'matching_permitted_safe_conclusions',
      'matching_private_reasoning_notes', 'matching_sensitive_filter_refusals'],
    'the census names exactly the relations the census regex can reach');
});

test('the verifier support module names every boundary and every relation the slice creates', () => {
  for (const table of TABLES_0110) {
    assert.ok(support.includes(`public.${table}`), `the support module names ${table}`);
  }
  const boundaries = [
    ...[...EXECUTABLE['0111'].matchAll(/CREATE FUNCTION public\.(\w+)\(/gu)].map((m) => m[1]),
    ...[...EXECUTABLE['0112'].matchAll(/CREATE FUNCTION public\.(\w+)\(/gu)].map((m) => m[1]),
  ];
  assert.ok(boundaries.length >= 30, `the two runtime migrations create boundaries, found ${boundaries.length}`);
  for (const boundary of boundaries) {
    assert.ok(support.includes(`public.${boundary}(`), `the support module names ${boundary}, so no boundary is unverified`);
  }
});
