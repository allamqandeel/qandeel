// I-07D - Introduction lifecycle, progressive disclosure and I-07 closure v1:
// secret-free structural contract over migrations 0115, 0116, 0117 and 0118.
//
// ONE file for three migrations, as the I-07C contract is one file for two and
// the I-07B contract is one for three: the properties worth a static contract
// are slice-wide - "the chain is forward-only and every frozen predecessor is
// byte-identical", "no command anywhere accepts a counterpart or an actor",
// "the two terminal cores take the published cross-domain lock order and read
// exactly one clock", "nothing in the slice can spell a relationship status",
// "the frozen vocabularies are identical in PostgreSQL and in TypeScript" - and
// splitting them would either repeat each one or leave each file checking half
// a property. Live semantics - refusals, ACL behaviour, trigger behaviour,
// races, the no-ghost rollbacks - are proven by the three real PostgreSQL
// verifiers this file also pins into the toolchain, CI and the database README.
//
// Prose comments explain WHY a construct is forbidden and therefore name it;
// every "must not contain" assertion runs against EXECUTABLE SQL only, and never
// against a terminal self-assertion block, which names the words it refuses and
// would otherwise make every such assertion match itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const NAMES = {
  '0115': '0115_introduction_progressive_disclosure_history_visibility_v1.sql',
  '0116': '0116_introduction_terminal_lifecycle_v1.sql',
  '0117': '0117_post_introduction_matching_reactivation_v1.sql',
  '0118': '0118_introduction_ordinary_shared_material_v1.sql',
};
const SOURCE = Object.fromEntries(Object.entries(NAMES).map(([n, file]) => [n, read(`../migrations/${file}`)]));
const VERIFIER = Object.fromEntries(Object.keys(NAMES).map((n) => [n, read(`../verify-migration-${n}.mjs`)]));
const PREDECESSOR = Object.fromEntries(
  ['0087', '0088', '0089', '0090', '0108', '0109', '0113', '0114'].map((n) => [n, read(`../verify-migration-${n}.mjs`)]));
const support = read('../introduction-lifecycle-verifier-support.mjs');
const setupSupport = read('../matching-setup-verifier-support.mjs');
const readme = read('../README.md');
const packageJson = read('../../package.json');
const workflow = read('../../.github/workflows/api-ci.yml');
const vocabulary = read('../../apps/api/src/connected-worlds/matching/matching-introduction-lifecycle.types.ts');

const stripComments = (sql) => sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const EXECUTABLE = Object.fromEntries(Object.entries(SOURCE).map(([n, sql]) => [n, stripComments(sql)]));
/** One migration's text between two markers, comments and COMMENT literals removed. */
const sliceOf = (source, from, to) => {
  const start = source.indexOf(from);
  assert.ok(start >= 0, `the source contains "${from}"`);
  const end = source.indexOf(to, start);
  assert.ok(end > start, `the source contains "${to}" after "${from}"`);
  return stripComments(source.slice(start, end)).replace(/COMMENT ON [\s\S]*?';\n/gu, '');
};
/** The executable statements of one migration, its terminal self-assertions excluded. */
const bodyOf = (n) => sliceOf(SOURCE[n], 'BEGIN;', 'Terminal self-assertions');
/** One function's declaration through to the statement that follows it. */
const functionOf = (n, signature, until) => sliceOf(SOURCE[n], signature, until);
/** The literals of one IN-list CHECK constraint. */
const vocabularyOf = (source, constraint) => {
  const match = stripComments(source).match(new RegExp(`CONSTRAINT ${constraint}\\s+CHECK \\([^)]*IN\\s*\\(([^)]+)\\)\\)`, 'u'));
  assert.ok(match, `${constraint} exists as an IN-list CHECK`);
  return [...match[1].matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]);
};
/** The literals of one TypeScript `as const` array. */
const typescriptVocabularyOf = (name) => {
  const match = vocabulary.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`, 'u'));
  assert.ok(match, `the vocabulary module exports ${name}`);
  return [...match[1].matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]);
};
/** The git blob id of one file's LF content: what `git rev-parse HEAD:<path>` prints. */
const blobIdOf = (content) => createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex');

const TABLES = {
  '0115': ['introduction_closed_view_entitlement_items', 'introduction_closed_view_entitlements',
    'introduction_disclosure_commands', 'introduction_disclosure_granted_events',
    'introduction_disclosure_media_payloads', 'introduction_disclosure_resource_versions',
    'introduction_disclosure_text_payloads'],
  '0116': ['introduction_completed_events', 'introduction_ended_events',
    'introduction_success_approval_events', 'introduction_success_approval_state',
    'introduction_success_required_approvers', 'introduction_success_transition_versions',
    'introduction_terminal_commits'],
  '0117': ['matching_introduction_reactivation_commands'],
  // 0118 creates NOTHING. It replaces two frozen commit cores forward-only so
  // they serve both World modes, which is exactly why ordinary Introduction
  // material needed no store, no history model and no producer of its own.
  '0118': [],
};

/** The three fail-closed CW2-08 seams this slice creates, and the ONE answer each may give. */
const SEAMS = [
  ['0115', 'resolve_introduction_disclosure_prerequisites_v1'],
  ['0116', 'resolve_introduction_success_prerequisites_v1'],
  ['0117', 'resolve_matching_reactivation_prerequisites_v1'],
];

/** Every consequential boundary the slice creates: none may be executable by an application role. */
const BOUNDARIES = [
  ['0115', 'commit_introduction_progressive_disclosure_v1'],
  ['0116', 'prepare_introduction_success_transition_v1'],
  ['0116', 'record_introduction_success_approval_core_v1'],
  ['0116', 'approve_introduction_success_v1'],
  ['0116', 'withdraw_introduction_success_approval_v1'],
  ['0116', 'commit_introduction_success_v1'],
  ['0116', 'commit_introduction_end_v1'],
  ['0117', 'reactivate_matching_after_introduction_v1'],
];

/**
 * The frozen predecessors this slice reads, reconciles against and may not edit,
 * pinned by git blob id: a byte changed anywhere in one of them fails here before
 * any database is involved.
 *
 * The three earlier Matching vocabulary modules are frozen records of their own
 * slices and are pinned the same way - I-07D adds a sibling rather than editing
 * any of them.
 */
const FROZEN = {
  '../migrations/0075_connected_worlds_shared_persistence_foundation_v1.sql': '3119d34a4edd4c934067393eb278077fd294852b',
  '../migrations/0087_shared_world_selective_history_access_v1.sql': '46606903867c8cc3570d61ee068d0baf6b9d65d8',
  '../migrations/0088_shared_world_standard_closure_v1.sql': 'dff71de8fbfc2f834d2d267949359d2ebbd3effe',
  '../migrations/0089_shared_world_material_persistence_v1.sql': '82d6d5f0c293528649198efee2305ca0baa7b685',
  '../migrations/0090_shared_world_material_commit_owner_deletion_v1.sql': 'c65bb170449e98454b4ba248dad3793b6ea363f8',
  '../migrations/0108_matching_participation_private_setup_foundation_v1.sql': '88845e0290809d1fd9949db1a5ebf3973bacdbb3',
  '../migrations/0109_matching_setup_human_authority_commands_v1.sql': '030de6db8d7982a4503cc2200927511f1c212e60',
  '../migrations/0110_matching_pair_eligibility_proposal_persistence_v1.sql': '5cf4dab35b921fa1d2f60a2875a5863964ca9139',
  '../migrations/0111_matching_candidate_evaluation_disclosure_gate_v1.sql': '7e2df716f935b1f8be378c0c1fd1d232b6165956',
  '../migrations/0112_matching_proposal_choreography_runtime_v1.sql': 'd806ddf5683048a830638bd264282fee09f39d53',
  '../../apps/api/src/connected-worlds/matching/matching-proposal.types.ts': 'd23da2af56b727f90e5b717f6c2e97b575d7d335',
  '../../apps/api/src/connected-worlds/matching/matching-setup.types.ts': '946731fbd8c869529bc3bcb8c363926e94bed619',
};

test('the four migrations order directly after the reviewed 0114 tip and are forward-only', () => {
  const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort();
  assert.equal(migrations.indexOf(NAMES['0115']),
    migrations.indexOf('0114_matching_mutual_match_commit_transaction_v1.sql') + 1,
    '0115 orders directly after the reviewed 0114 tip');
  assert.equal(migrations.indexOf(NAMES['0116']), migrations.indexOf(NAMES['0115']) + 1, '0116 follows 0115');
  assert.equal(migrations.indexOf(NAMES['0117']), migrations.indexOf(NAMES['0116']) + 1, '0117 follows 0116');
  assert.equal(migrations.indexOf(NAMES['0118']), migrations.indexOf(NAMES['0117']) + 1, '0118 follows 0117');
  // I-07D ENDS AT 0118. A tip assertion is only true until the next reviewed
  // slice lands, and it would then be repaired by whichever task happened to
  // trip it rather than by the one that owns the claim - the repair the I-07A
  // and I-07C contracts each already made. The claim itself survives: no
  // migration after 0118 belongs to I-07D.
  for (const later of migrations.slice(migrations.indexOf(NAMES['0118']) + 1)) {
    assert.doesNotMatch(read(`../migrations/${later}`), /^-- I-07D/u, `${later} is a later slice, not an I-07D migration`);
  }
  // Every "must not contain" assertion runs against the executable body with the
  // TERMINAL SELF-ASSERTIONS excluded: those blocks NAME the words they refuse -
  // "TRUNCATE", "jsonb", "relationship" - and would otherwise make every such
  // assertion match itself and pass for the wrong reason.
  for (const [n, file] of Object.entries(NAMES)) {
    const body = bodyOf(n);
    assert.equal(migrations.filter((name) => name.startsWith(`${n}_`)).length, 1, `exactly one migration carries ${n}`);
    assert.match(SOURCE[n], /^-- I-07D/u, `${file} declares its slice`);
    assert.equal((SOURCE[n].match(/\nBEGIN;\n/gu) ?? []).length, 1, `${file} is one transaction`);
    assert.match(SOURCE[n], /COMMIT;\n$/u, `${file} commits`);
    assert.doesNotMatch(body, /DROP (?:TABLE|FUNCTION|TRIGGER|POLICY|INDEX|COLUMN|CONSTRAINT|SCHEMA|ROLE)/iu,
      `${file} drops no object`);
    assert.doesNotMatch(body, /ADD COLUMN|DROP COLUMN|ALTER COLUMN|RENAME/iu,
      `${file} adds, drops, alters or renames no column`);
    assert.doesNotMatch(body, /CREATE (?:POLICY|VIEW|MATERIALIZED VIEW|EXTENSION|TYPE)|EXCLUDE USING/iu,
      `${file} introduces no policy, view, extension or enum type`);
    assert.doesNotMatch(body, /TRUNCATE/iu, `${file} truncates nothing`);
  }
  // NO PREDECESSOR RELATION IS ALTERED AT ALL. The slice is purely additive in
  // schema: its three replaced functions are replaced forward-only through
  // CREATE OR REPLACE, and the files that declared them are untouched.
  const OWN = new Set([...TABLES['0115'], ...TABLES['0116'], ...TABLES['0117']]);
  for (const n of Object.keys(NAMES)) {
    const altered = [...bodyOf(n).matchAll(/ALTER TABLE public\.(\w+)/gu)].map((m) => m[1]);
    for (const table of altered) {
      assert.ok(OWN.has(table),
        `${NAMES[n]} alters no predecessor relation: every schema change is its own, but it touched ${table}`);
    }
  }
  // THE FROZEN PREDECESSORS ARE BYTE-IDENTICAL. The four Shared predecessors
  // this slice reconciles against are pinned by content equality with the
  // reviewed baseline rather than by a literal id, because their blob ids are
  // already pinned by their own slices' contracts; what matters here is that
  // I-07D edited none of them, which the migration-file check above and the
  // absence of any edit in the diff both carry.
  for (const [path, blob] of Object.entries(FROZEN)) {
    if (blob === null) {
      assert.ok(read(path).length > 0, `${path.split('/').pop()} is present and readable`);
      continue;
    }
    assert.equal(blobIdOf(read(path)), blob,
      `${path.split('/').pop()} is exactly the frozen file this slice was reconciled against`);
  }
});

test('every identifier the four migrations create fits the PostgreSQL 63-byte limit and is unique', () => {
  for (const [n, file] of Object.entries(NAMES)) {
    const identifiers = [...bodyOf(n).matchAll(
      /(?:CREATE TABLE public\.|(?<!DROP )CONSTRAINT |CREATE (?:UNIQUE )?INDEX |CREATE TRIGGER |CREATE (?:OR REPLACE )?FUNCTION public\.)(\w+)/gu)]
      .map((m) => m[1]);
    // A migration that creates relations names many objects; one that only
    // replaces functions forward-only names exactly those functions. Both must
    // name them EXPLICITLY - no generated or interpolated identifier anywhere -
    // so the floor scales with what the migration actually creates.
    const floor = TABLES[n].length > 0 ? 5 : 2;
    assert.ok(identifiers.length >= floor, `${file} names its objects explicitly, found ${identifiers.length}`);
    for (const identifier of identifiers) {
      assert.ok(Buffer.byteLength(identifier) <= 63,
        `${identifier} (${Buffer.byteLength(identifier)} bytes) would be silently truncated by PostgreSQL`);
    }
    assert.equal(new Set(identifiers).size, identifiers.length, `every identifier ${file} creates is unique`);
  }
});

test('the four migrations create exactly their declared relations, all sealed and blob-free', () => {
  for (const [n, expected] of Object.entries(TABLES)) {
    const tables = [...EXECUTABLE[n].matchAll(/CREATE TABLE public\.(\w+)/gu)].map((m) => m[1]).sort();
    assert.deepEqual(tables, expected, `${NAMES[n]} creates exactly its declared relations`);
    for (const table of tables) {
      assert.match(EXECUTABLE[n], new RegExp(`ALTER TABLE %s OWNER TO postgres|ALTER TABLE public\\.${table} OWNER TO postgres`, 'u'),
        `${table} is postgres-owned`);
    }
    // A migration that creates NO relation has nothing to seal, and demanding a
    // sealing statement from it would only invite a decorative one. What matters
    // for such a migration is that it opened nothing, which the grant census
    // below covers for the whole slice at once.
    if (tables.length === 0) {
      assert.doesNotMatch(EXECUTABLE[n], /CREATE TABLE|ENABLE ROW LEVEL SECURITY|CREATE POLICY/u,
        `${NAMES[n]} creates and seals no relation because it creates none`);
      continue;
    }
    // Every relation is sealed through the same loop or the same explicit pair.
    assert.match(EXECUTABLE[n], /ENABLE ROW LEVEL SECURITY/u, `${NAMES[n]} enables RLS`);
    assert.match(EXECUTABLE[n], /REVOKE ALL ON TABLE %s FROM PUBLIC, anon, authenticated|REVOKE ALL ON TABLE public\.\w+ FROM PUBLIC, anon, authenticated/u,
      `${NAMES[n]} revokes every application role from every relation`);
    // NO JSON, BINARY OR ARRAY COLUMN, asserted over the CREATE TABLE blocks
    // themselves rather than over the whole file: a `text[]` local variable in a
    // posture loop is not a column, and the self-assertion block names the very
    // types it refuses.
    for (const block of EXECUTABLE[n].match(/CREATE TABLE public\.\w+ \([\s\S]*?\n\);/gu) ?? []) {
      assert.doesNotMatch(block, /\b(?:jsonb?|bytea|xml|hstore)\b|\w+\s+\w+\[\]/u,
        `${NAMES[n]} stores no JSON, binary or array payload in a relation`);
    }
  }
  // THE ONE GRANT IN THE WHOLE SLICE is service_role EXECUTE on the narrow
  // read-only disclosure resolver. Every consequential boundary is executable by
  // nobody, because the frozen CW2-08 Launch Gate does not exist.
  const grants = Object.values(EXECUTABLE).flatMap((sql) => [...sql.matchAll(/GRANT EXECUTE ON FUNCTION ([\w.]+)/gu)].map((m) => m[1]));
  assert.deepEqual([...new Set(grants)], ['public.resolve_shared_world_introduction_disclosure_v1'],
    'the slice grants EXECUTE on exactly the one narrow read resolver, and on nothing else');
  assert.doesNotMatch(Object.values(EXECUTABLE).join('\n'), /GRANT (?:SELECT|INSERT|UPDATE|DELETE|ALL)/u,
    'and no direct table privilege of any kind is opened');
});

test('no command anywhere in the slice accepts a counterpart, an owner, an actor or a clock', () => {
  // THE WHOLE POINT of Decision B: the owner is auth.uid() and the counterpart
  // is DERIVED from the exact Introduction Record, so a disclosure cannot be
  // rerouted to a third human however the caller is composed.
  const BANNED = /\bp_(?:\w*counterpart\w*|\w*recipient\w*|\w*audience\w*|\w*actor\w*|owner\w*|\w*_user_id|\w*human\w*|\w*subject\w*|\w*on_behalf\w*|\w*timestamp\w*|\w*instant\w*|\w*_at)\b/u;
  for (const [n, name] of BOUNDARIES) {
    const declaration = SOURCE[n].slice(SOURCE[n].indexOf(`CREATE FUNCTION public.${name}(`));
    const signature = declaration.slice(0, declaration.indexOf(') RETURNS'));
    assert.ok(signature.length > 0, `${name} declares a signature`);
    const parameters = [...signature.matchAll(/\bp_\w+\b/gu)].map((m) => m[0]);
    assert.ok(parameters.length > 0, `${name} takes parameters, so the ban is not vacuous`);
    for (const parameter of parameters) {
      assert.doesNotMatch(parameter, BANNED,
        `${name} must not accept ${parameter}: the human is auth.uid() and every other identity is derived`);
    }
  }
  // Every HUMAN act derives its human; the two SYSTEM boundaries derive none.
  for (const [n, name] of [['0115', 'commit_introduction_progressive_disclosure_v1'],
    ['0116', 'record_introduction_success_approval_core_v1'],
    ['0116', 'commit_introduction_end_v1'],
    ['0117', 'reactivate_matching_after_introduction_v1']]) {
    assert.match(SOURCE[n].slice(SOURCE[n].indexOf(`CREATE FUNCTION public.${name}(`)), /u uuid := auth\.uid\(\);/u,
      `${name} derives its human from the session subject`);
  }
  for (const [n, name] of [['0116', 'prepare_introduction_success_transition_v1'],
    ['0116', 'commit_introduction_success_v1']]) {
    const body = functionOf(n, `CREATE FUNCTION public.${name}(`, `-- ${n === '0116' ? '' : ''}`.length ? 'END$$;' : 'END$$;');
    assert.doesNotMatch(body, /auth\.uid/u,
      `${name} derives no actor: a proposal is not consent and system execution is not authority`);
  }
});

test('the disclosure vocabulary is closed, structural and carries no generic kind', () => {
  const types = vocabularyOf(SOURCE['0115'], 'introduction_disclosure_resource_versions_type_check');
  assert.deepEqual(types.sort(),
    ['CONTACT_METHOD', 'DEEPER_PERSONAL_FIELD', 'FULL_IMAGE', 'FULL_NAME', 'PARTIAL_IMAGE'],
    'exactly the frozen five broad categories are representable');
  assert.deepEqual(vocabularyOf(SOURCE['0115'], 'introduction_disclosure_text_payloads_type_check').sort(),
    ['CONTACT_METHOD', 'DEEPER_PERSONAL_FIELD', 'FULL_NAME'], 'the text payload accepts exactly the three text types');
  assert.deepEqual(vocabularyOf(SOURCE['0115'], 'introduction_disclosure_media_payloads_type_check').sort(),
    ['FULL_IMAGE', 'PARTIAL_IMAGE'], 'and the media payload exactly the two image types');
  // THE TYPE-TO-PAYLOAD BINDING IS STRUCTURAL: each payload composite-binds the
  // version's own type, so a text payload on an image version is a constraint
  // violation rather than a procedural check somebody remembered to write.
  for (const payload of ['text', 'media']) {
    assert.match(EXECUTABLE['0115'], new RegExp(
      `CONSTRAINT introduction_disclosure_${payload}_payloads_version_fk\\s+FOREIGN KEY \\(resource_version_id, resource_type\\)\\s+REFERENCES public\\.introduction_disclosure_resource_versions \\(id, resource_type\\)`, 'u'),
    `the ${payload} payload binds BOTH the version and its exact type`);
  }
  assert.match(EXECUTABLE['0115'], /CONSTRAINT introduction_disclosure_resource_versions_type_key UNIQUE \(id, resource_type\)/u,
    'and the version exposes that composite identity for them to bind');
  // A FIELD KEY EXISTS EXACTLY FOR THE ONE TYPE THAT HAS ONE, and can never name
  // a contact route: CONTACT_METHOD is the ONE reviewed way to disclose one.
  assert.match(EXECUTABLE['0115'], /\(field_key IS NOT NULL\) = \(resource_type = 'DEEPER_PERSONAL_FIELD'\)/u,
    'a field key exists exactly for a deeper personal field');
  assert.match(EXECUTABLE['0115'], /whatsapp\|telegram\|instagram/u,
    'and a deeper personal field can never become a second unreviewed contact route');
  // AN IMAGE REFERENCE IS OPAQUE: not a URL, no query, no fragment, no credential.
  assert.match(EXECUTABLE['0115'], /media_object_ref !~ ':\/\/'/u, 'a media reference is never a URL');
  assert.match(EXECUTABLE['0115'], /media_object_ref !~ '\[\?#\]'/u, 'and carries no query or fragment');
  assert.match(EXECUTABLE['0115'], /media_object_ref !~\* '\(token\|signature/u, 'and no credential-shaped token');
  // NO GENERIC KIND, NO JSON, NO STANDING PERMISSION anywhere in the slice.
  assert.doesNotMatch(bodyOf('0115'), /resource_kind|RESOURCE_KIND|payload_json|jsonb/u,
    'there is no generic resource kind and no JSON payload');
  assert.doesNotMatch(bodyOf('0115'), /reusable|standing_disclosure|suggested|suggestion|reciprocal/u,
    'and no suggestion, standing permission or reciprocal bundle object');
});

test('the terminal winner is ONE unique key, and both outcomes converge on it', () => {
  assert.match(EXECUTABLE['0116'],
    /CONSTRAINT introduction_terminal_commits_record_key UNIQUE \(introduction_record_id\)/u,
    'one Introduction Record has at most one terminal commit, by unique key');
  assert.deepEqual(vocabularyOf(SOURCE['0116'], 'introduction_terminal_commits_outcome_check').sort(),
    ['CLOSED', 'COMPLETED'], 'and exactly two outcomes are representable');
  // Both cores insert into that one relation, LAST.
  for (const core of ['commit_introduction_success_v1', 'commit_introduction_end_v1']) {
    const body = sliceOf(SOURCE['0116'], `CREATE FUNCTION public.${core}(`, 'END$$;');
    assert.match(body, /INSERT INTO public\.introduction_terminal_commits/u, `${core} writes the one terminal winner`);
    const writePosition = body.indexOf('INSERT INTO public.introduction_terminal_commits');
    for (const earlier of ['UPDATE public.introduction_records', 'UPDATE public.matching_active_introduction_claims']) {
      assert.ok(body.indexOf(earlier) >= 0 && body.indexOf(earlier) < writePosition,
        `${core} performs ${earlier} BEFORE the terminal commit row, so the guard sees a complete transaction`);
    }
  }
  // The terminal truth guard refuses a hybrid outcome in both directions.
  const guard = sliceOf(SOURCE['0116'], 'CREATE FUNCTION public.introduction_terminal_commit_truth_v1()', 'END$$;');
  assert.equal((guard.match(/INTRODUCTION_TERMINAL_OUTCOME_IS_HYBRID/gu) ?? []).length, 2,
    'the terminal truth guard refuses the other outcome in both directions');
});

test('the two terminal cores take the published cross-domain lock order and read exactly one clock', () => {
  for (const core of ['commit_introduction_success_v1', 'commit_introduction_end_v1']) {
    const body = sliceOf(SOURCE['0116'], `CREATE FUNCTION public.${core}(`, 'END$$;');
    const at = (needle) => {
      const position = body.indexOf(needle);
      assert.ok(position >= 0, `${core} carries ${needle}`);
      return position;
    };
    const world = at('FROM public.shared_worlds w WHERE w.id = ');
    const record = at('FROM public.introduction_records r');
    const pair = at('PERFORM public.lock_matching_pair_humans_v1(lo, hi)');
    const episodes = at('ORDER BY e.id FOR UPDATE');
    const pointers = at('ORDER BY s.participant_user_id FOR UPDATE');
    const clock = at('terminal_instant := clock_timestamp()');
    const write = at('INSERT INTO public.introduction_terminal_commits');
    assert.ok(world < record && record < pair && pair < episodes && episodes < pointers && pointers < clock && clock < write,
      `${core} locks the World, the exact Record, BOTH setup locks in canonical order, the episodes, the pointers, then one instant, then the terminal commit`);
    assert.equal((body.match(/clock_timestamp\(\)/gu) ?? []).length, 1, `${core} reads exactly one clock`);
    assert.doesNotMatch(body, /CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp/iu,
      `${core} reads no transaction clock: a settled clock predates the lock wait it must decide after`);
    assert.doesNotMatch(body, /pg_advisory|LOCK TABLE|DELETE FROM/u,
      `${core} takes no advisory lock, no table lock, and deletes nothing`);
    assert.doesNotMatch(body, /INSERT INTO public\.matching_setup_locks/u,
      `${core} reaches both setup locks only through the frozen canonical two-human helper`);
  }
  // DISCLOSURE IS WORLD-LOCAL: it takes the World row and the exact Record, and
  // acquires NO Matching setup lock merely because the World was born from a Match.
  const disclosure = sliceOf(SOURCE['0115'], 'CREATE FUNCTION public.commit_introduction_progressive_disclosure_v1(', 'END$$;');
  assert.doesNotMatch(disclosure, /matching_setup_locks|lock_matching_pair_humans_v1/u,
    'progressive disclosure acquires no Matching setup lock');
  assert.ok(disclosure.indexOf('FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE')
    < disclosure.indexOf('WHERE r.world_id = p_world_id FOR UPDATE'),
  'and takes the World row before the exact Introduction Record');
  assert.equal((disclosure.match(/clock_timestamp\(\)/gu) ?? []).length, 1, 'reading exactly one clock');
  // REACTIVATION IS A ONE-HUMAN ACT: no Shared World lock, no second human.
  const reactivation = sliceOf(SOURCE['0117'], 'CREATE FUNCTION public.reactivate_matching_after_introduction_v1(', 'END$$;');
  assert.doesNotMatch(reactivation, /shared_worlds|lock_matching_pair_humans_v1/u,
    'reactivation locks no Shared World and no second human');
  assert.equal((reactivation.match(/clock_timestamp\(\)/gu) ?? []).length, 1, 'and reads exactly one clock');
});

test('an exit can never be gated, and every other gated action requires CLEARED as its LAST gate', () => {
  // The three seams answer NOT_EVALUATED and can spell nothing else.
  for (const [n, seam] of SEAMS) {
    const body = sliceOf(SOURCE[n], `CREATE FUNCTION public.${seam}(`, 'END$$;');
    assert.match(body, /'NOT_EVALUATED'/u, `${seam} answers NOT_EVALUATED`);
    assert.doesNotMatch(body, /'CLEARED'/u, `${seam} never answers CLEARED before CW2-08 exists`);
    assert.match(body, /STABLE/u, `${seam} is STABLE`);
  }
  // The three gated boundaries require exactly CLEARED.
  for (const [n, name, seam] of [
    ['0115', 'commit_introduction_progressive_disclosure_v1', 'resolve_introduction_disclosure_prerequisites_v1'],
    ['0116', 'commit_introduction_success_v1', 'resolve_introduction_success_prerequisites_v1'],
    ['0117', 'reactivate_matching_after_introduction_v1', 'resolve_matching_reactivation_prerequisites_v1'],
  ]) {
    const body = sliceOf(SOURCE[n], `CREATE FUNCTION public.${name}(`, 'END$$;');
    assert.match(body, new RegExp(`public\\.${seam}\\(`, 'u'), `${name} consults its seam`);
    assert.match(body, /gate\.clearance <> 'CLEARED'/u, `${name} requires exactly CLEARED`);
    assert.ok(body.indexOf(seam) > body.indexOf('FOR UPDATE'),
      `${name} reads the gate AFTER it has locked and revalidated, so it is the LAST gate`);
    assert.ok(body.indexOf(seam) < body.indexOf('clock_timestamp()'),
      `and before it captures the one instant, so a refusal writes nothing`);
  }
  // AND THE EXIT IS NOT ONE OF THEM. Ending an Introduction is a privacy act; a
  // gate that could ever refuse it would make a human unable to leave.
  const ending = sliceOf(SOURCE['0116'], 'CREATE FUNCTION public.commit_introduction_end_v1(', 'END$$;');
  assert.doesNotMatch(ending, /prerequisite|clearance|CLEARED|NOT_EVALUATED|launch|safety/u,
    'the END core consults no system, safety or launch clearance at all');
  assert.doesNotMatch(ending, /introduction_success_approval|introduction_success_transition_versions/u,
    'and requires no counterpart approval');
});

test('nothing in the slice can spell a relationship, engagement, exclusivity or marriage status', () => {
  const inferred = /(relationship|engagement|engaged|marriage|married|fiance|spouse|exclusiv|boyfriend|girlfriend|partner_status|legal_status)/iu;
  for (const [n, file] of Object.entries(NAMES)) {
    // The executable body, its terminal self-assertions excluded: those NAME the
    // words they refuse and would otherwise make this assertion match itself.
    const body = bodyOf(n);
    assert.doesNotMatch(body, inferred,
      `${file} encodes no relationship, engagement, exclusivity, marriage or legal status`);
  }
  // The vocabulary module's own prose EXPLAINS what is absent and therefore
  // names it, exactly as these migrations' self-assertions do, so the executable
  // half is what is scanned.
  const executableVocabulary = vocabulary.split('\n')
    .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*'))
    .join('\n');
  assert.ok(executableVocabulary.includes('as const'), 'the vocabulary module has an executable half to scan');
  assert.doesNotMatch(executableVocabulary, inferred, 'and neither does the TypeScript vocabulary module');
  // The canonical result of a completed Introduction is exactly one thing.
  assert.match(SOURCE['0116'].replace(/\n--\s*/gu, ' '), /both humans approved leaving guided Introduction mode/u,
    'the migration states the only Product truth a completion carries');
});

test('the slice creates no candidate list, ranking, score or generic contact path', () => {
  const ranked = /(leaderboard|ranking|rank_|_rank\b|score|percentile|weight_|compatibility_score|candidate_list|directory|search_index)/iu;
  for (const [n, file] of Object.entries(NAMES)) {
    assert.doesNotMatch(bodyOf(n), ranked, `${file} creates no candidate list, ranking or score`);
  }
  // No Matching authority, proposal, private reasoning or participation state
  // crosses into Shared disclosure, in either direction.
  const disclosure = sliceOf(SOURCE['0115'], 'CREATE FUNCTION public.commit_introduction_progressive_disclosure_v1(', 'END$$;');
  assert.doesNotMatch(disclosure,
    /matching_context_grants|pre_match_disclosure|matching_proposal|matching_recipient|matching_private|matching_participation|matching_match_handoff/u,
    'a disclosure reads and mutates no Matching state of any kind');
  assert.doesNotMatch(disclosure, /shared_world_standing_context_grants/u,
    'and manufactures no Shared Standing Context Grant: direct disclosure is not private reasoning authority');
  // Neither terminal core depends on Matching setup authority.
  for (const core of ['commit_introduction_success_v1', 'commit_introduction_end_v1']) {
    assert.doesNotMatch(sliceOf(SOURCE['0116'], `CREATE FUNCTION public.${core}(`, 'END$$;'),
      /matching_context_grants|pre_match_disclosure|introduction_profile|matching_requirement/u,
      `${core} depends on no Matching setup authority: the Shared World is independent after the Match`);
  }
});

test('the generic I-07A resume is not widened, and exactly one boundary crosses a reserved pause', () => {
  // I-07D creates the two reserved post-terminal pauses and resumes NEITHER
  // through the generic path. The 0116 and 0117 deploy-time assertions prove
  // this on the live catalog; here it is proven from the text that must carry it.
  assert.match(SOURCE['0116'], /the generic I-07A resume must remain USER_PAUSED-only/u,
    '0116 refuses to deploy against a widened generic resume');
  assert.match(SOURCE['0117'], /the generic I-07A resume must remain USER_PAUSED-only/u,
    'and 0117 asserts it again at the tip of the chain');
  assert.match(SOURCE['0117'], /MATCHING_REACTIVATION_REQUIRES_REVALIDATION/u,
    '0117 proves the frozen I-07A activation ceiling still refuses the OFF lineage');
  const reactivation = sliceOf(SOURCE['0117'], 'CREATE FUNCTION public.reactivate_matching_after_introduction_v1(', 'END$$;');
  // LINEAGE IS EXACT IDENTITY, never time and never a latest-record inference.
  assert.doesNotMatch(reactivation, /ORDER BY|MAX\(|max\(|LIMIT|occurred_at >|occurred_at </u,
    'eligibility is proven from exact immutable identity, never by ordering or time comparison');
  assert.match(reactivation, /introduction_terminal_commits/u, 'from the exact I-07D terminal linkage');
  assert.match(reactivation, /matching_match_commits/u, 'composed with the exact I-07C Match/pause linkage');
  assert.match(reactivation, /resolve_matching_active_introduction_v1/u,
    'and it consumes the canonical active-Introduction truth rather than re-implementing it');
  assert.match(reactivation, /resolve_matching_setup_state_v1/u, 'and the canonical setup state');
  // IT REVIVES NOTHING.
  assert.doesNotMatch(reactivation, /matching_proposal|matching_recipient_proposal|matching_eligibility_snapshots|matching_pairs/u,
    'reactivation changes participation only: it revives, clones and creates no proposal');
  assert.doesNotMatch(reactivation, /UPDATE public\.introduction_records|UPDATE public\.matching_active_introduction_claims|UPDATE public\.shared_worlds/u,
    'and reopens no Introduction, no claim and no World');
});

test('the PostgreSQL and TypeScript vocabularies are identical', () => {
  assert.deepEqual(typescriptVocabularyOf('INTRODUCTION_DISCLOSURE_RESOURCE_TYPES').sort(),
    vocabularyOf(SOURCE['0115'], 'introduction_disclosure_resource_versions_type_check').sort(),
    'the five disclosure resource types are the same in both places');
  assert.deepEqual(typescriptVocabularyOf('INTRODUCTION_DISCLOSURE_TEXT_RESOURCE_TYPES').sort(),
    vocabularyOf(SOURCE['0115'], 'introduction_disclosure_text_payloads_type_check').sort(),
    'and so are the three text-backed types');
  assert.deepEqual(typescriptVocabularyOf('INTRODUCTION_DISCLOSURE_IMAGE_RESOURCE_TYPES').sort(),
    vocabularyOf(SOURCE['0115'], 'introduction_disclosure_media_payloads_type_check').sort(),
    'and the two image-backed types');
  assert.deepEqual(typescriptVocabularyOf('INTRODUCTION_TERMINAL_OUTCOMES').sort(),
    vocabularyOf(SOURCE['0116'], 'introduction_terminal_commits_outcome_check').sort(),
    'and the two terminal outcomes');
  assert.deepEqual(typescriptVocabularyOf('INTRODUCTION_SUCCESS_APPROVAL_ACTS').sort(),
    vocabularyOf(SOURCE['0116'], 'introduction_success_approval_events_act_check').sort(),
    'and the two approval acts');
  assert.deepEqual(typescriptVocabularyOf('INTRODUCTION_SUCCESS_APPROVAL_STATES').sort(),
    vocabularyOf(SOURCE['0116'], 'introduction_success_approval_events_state_check').sort(),
    'and the two approval states');
  assert.deepEqual(typescriptVocabularyOf('POST_INTRODUCTION_REACTIVATION_ACTS').sort(),
    vocabularyOf(SOURCE['0117'], 'matching_introduction_reactivation_commands_act_check').sort(),
    'and the two reactivation acts');
  // The two reserved pause reasons are the I-07A vocabulary's, not a second copy.
  assert.deepEqual(typescriptVocabularyOf('POST_TERMINAL_INTRODUCTION_PAUSE_REASONS').sort(),
    ['POST_INTRODUCTION', 'POST_SUCCESS'],
    'and the two reserved post-terminal pause reasons are exactly the ones I-07A reserved');
  assert.match(SOURCE['0116'], /'POST_SUCCESS'/u, '0116 writes POST_SUCCESS');
  assert.match(SOURCE['0116'], /'POST_INTRODUCTION'/u, 'and 0116 writes POST_INTRODUCTION');
});

test('the predecessor forward seams are reconciled in the predecessors themselves', () => {
  // 0087: the ONE entry point learned Introduction, and its Standard semantics
  // are proven unchanged in 0087's OWN verifier rather than only in I-07D's.
  assert.match(PREDECESSOR['0087'], /RECONCILED BY I-07D/u, 'the 0087 verifier records the reconciliation');
  assert.match(PREDECESSOR['0087'], /the explicit history-grant basis appears exactly once/u,
    'and proves the Introduction branch did not inherit selective-history semantics');
  assert.match(PREDECESSOR['0087'], /world\\\.phase = 'INTRODUCTION'|world\\.phase = 'INTRODUCTION'/u,
    'and that the reviewed Introduction branch is present');
  // 0088: absence became exact ownership.
  assert.match(PREDECESSOR['0088'], /C23, RECONCILED BY I-07D/u, 'the 0088 verifier records the reconciliation');
  assert.match(PREDECESSOR['0088'], /commit_introduction_end_v1/u,
    'and names the exact reviewed producer of the Introduction closed-view entitlement');
  assert.match(PREDECESSOR['0088'], /commit_shared_world_standard_end_v1/u,
    'while the Standard entitlement family stays Standard-owned');
  // 0090: owner deletion learned exactly one branch.
  assert.match(PREDECESSOR['0090'], /RECONCILED BY I-07D/u, 'the 0090 verifier records the reconciliation');
  assert.match(PREDECESSOR['0090'], /introduction_disclosure_media_payloads', 'introduction_disclosure_text_payloads'/u,
    'and its DELETE census names the exact new targets');
  assert.match(PREDECESSOR['0090'], /WORLD_EVENT_DERIVED_MATERIAL/u,
    'and proves no OTHER reserved kind became deletable');
  // 0108 / 0109: the reserved pauses gained exactly the reviewed producers.
  assert.match(PREDECESSOR['0108'], /RECONCILED BY I-07D/u, 'the 0108 verifier records the reconciliation');
  assert.match(PREDECESSOR['0108'], /SYSTEM_POLICY still has no producer at all/u,
    'and proves SYSTEM_POLICY was not weakened');
  assert.match(PREDECESSOR['0109'], /RECONCILED BY I-07D/u, 'the 0109 verifier records the reconciliation');
  // 0113 / 0114: exact producer ownership on the UPDATE side.
  assert.match(PREDECESSOR['0113'], /THE FORWARD SEAM, RECONCILED BY I-07D/u, 'the 0113 verifier records it');
  assert.match(PREDECESSOR['0113'], /one durable terminal-winner substrate keyed by the exact Introduction Record/u,
    'and proves both terminal cores converge on one winner');
  assert.match(PREDECESSOR['0114'], /RECONCILED BY I-07D/u, 'the 0114 verifier records it');
  assert.match(PREDECESSOR['0114'], /PRODUCES the ACTIVE_INTRODUCTION pause/u,
    'and separates producing the pause from reading it');
  // The shared census list names the one I-07D relation any census can reach.
  const start = setupSupport.indexOf('export const I07D_LIFECYCLE_RELATIONS = [');
  assert.ok(start >= 0, 'the setup support names the I-07D half of the shared census list');
  const listed = [...setupSupport.slice(start, setupSupport.indexOf('];', start)).matchAll(/^ {2}'([a-z_]+)',$/gmu)].map((m) => m[1]);
  assert.deepEqual(listed, ['introduction_terminal_commits'],
    'exactly the one I-07D relation a lifecycle census predicate can reach is named, and nothing else is');
  // NON-VACUITY: it really does carry a census word, and the others really do not.
  const WORDS = /(candidate|proposal|pair|mutual|commit|slot|snapshot|eligibility|compatib|leaderboard|rank|score)/u;
  assert.ok(WORDS.test('introduction_terminal_commits'), 'the named relation really does carry a census word');
  for (const table of [...TABLES['0115'], ...TABLES['0116'], ...TABLES['0117']]) {
    if (table === 'introduction_terminal_commits') continue;
    if (!/^(matching_|introduction_|pre_match_)/u.test(table)) continue;
    assert.ok(!WORDS.test(table), `${table} carries no census word, so no census can reach it and none demands it`);
  }
});

test('the four verifiers are wired into the toolchain, API CI after the I-07C group, and the database README', () => {
  const SCRIPTS = {
    '0115': 'verify:introduction-progressive-disclosure:integration',
    '0116': 'verify:introduction-terminal-lifecycle:integration',
    '0117': 'verify:post-introduction-matching-reactivation:integration',
    '0118': 'verify:introduction-ordinary-shared-material:integration',
  };
  for (const [n, script] of Object.entries(SCRIPTS)) {
    assert.match(packageJson, new RegExp(`"${script}": "node --env-file-if-exists=\\.env database/verify-migration-${n}\\.mjs"`, 'u'),
      `${script} runs exactly the ${n} verifier`);
    assert.match(workflow, new RegExp(`npm run ${script}`, 'u'), `and API CI runs it`);
    assert.match(readme, new RegExp(`npm run ${script}`, 'u'), 'and the database README documents it');
  }
  // ONE reported group, after the I-07C group, so a failure in the first does
  // not skip the others and cost a whole round per finding.
  assert.ok(workflow.indexOf('four I-07D Introduction lifecycle') > workflow.indexOf('two I-07C Matching Mutual Match'),
    'the I-07D group runs after the I-07C group');
  assert.match(workflow, /result_0115=FAIL\n\s+result_0116=FAIL\n\s+result_0117=FAIL\n\s+result_0118=FAIL/u,
    'each exit code is captured so one failure does not hide the others');
  assert.match(workflow, /I-07D real-PostgreSQL verifier results/u, 'and all four outcomes are reported');
  assert.match(readme, /^## I-07D - Introduction Lifecycle, Progressive Disclosure and I-07 Closure v1 \(migrations 0115-0118\)$/mu,
    'the database README carries the I-07D section');
  assert.match(readme, /### I-07D - the published cross-domain lock order/u,
    'including the published lock order, which is the thing a reviewer needs to find');
  // The focused database gate needs no edit: a new migration is selectable
  // generically as migration-NNNN.
  const focused = read('../focused-verifiers.json');
  assert.doesNotMatch(focused, /011[5678]/u,
    'focused-verifiers.json needs no edit: a new migration is selectable generically as migration-NNNN');
});

test('the four verifiers prove the behaviour families the task requires', () => {
  for (const family of ['PD01', 'PD05', 'PD07', 'PD10', 'PD13', 'PD14', 'PD17', 'PD18', 'V01', 'V04', 'G01']) {
    assert.match(VERIFIER['0115'], new RegExp(`'${family} `, 'u'), `the 0115 verifier proves ${family}`);
  }
  for (const family of ['S01', 'S04', 'S05', 'S07', 'S08', 'S15', 'S18', 'S19', 'S20',
    'E01', 'E02', 'E04', 'E09', 'E10', 'T01', 'T02', 'K01', 'G01', 'G02',
    'C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09']) {
    assert.match(VERIFIER['0116'], new RegExp(`(?:'|\`)${family}\\b`, 'u'), `the 0116 verifier proves ${family}`);
  }
  for (const family of ['R01', 'R03', 'R04', 'R06', 'R07', 'R09', 'R10', 'R11', 'R12', 'R14', 'F01', 'C10', 'C11']) {
    assert.match(VERIFIER['0117'], new RegExp(`(?:'|\`)${family}\\b`, 'u'), `the 0117 verifier proves ${family}`);
  }
  for (const family of ['M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08',
    'T01', 'T02', 'T03', 'C01', 'C02', 'G01']) {
    assert.match(VERIFIER['0118'], new RegExp(`(?:'|\`)${family}\\b`, 'u'), `the 0118 verifier proves ${family}`);
  }
  // I07D-IDEM-01: the reactivation command identity binds the WHOLE immutable
  // request. The channel is compared on BOTH idempotency passes - one pass alone
  // would leave the other as an open door - and the migration, its verifier and
  // this contract all pin the same count rather than merely its presence.
  const CHANNEL_BOUND = /e\.activation_entry_channel IS NOT DISTINCT FROM p_entry_channel/gu;
  assert.equal((SOURCE['0117'].match(CHANNEL_BOUND) ?? []).length, 2,
    'both reactivation idempotency passes bind the requested entry channel to the exact committed act');
  assert.match(SOURCE['0117'], /both reactivation idempotency passes must bind the requested entry channel/u,
    'and the migration refuses to deploy if either one stops doing so');
  assert.match(VERIFIER['0117'], CHANNEL_BOUND, 'and the verifier proves it against the live stored body');
  // I07D-SCOPE-01: ONE canonical Shared truth model serves both World modes.
  assert.match(SOURCE['0118'], /CREATE OR REPLACE FUNCTION public\.commit_shared_world_human_material_v1/u,
    '0118 extends the frozen human commit core forward-only rather than adding a second one');
  assert.match(SOURCE['0118'], /CREATE OR REPLACE FUNCTION public\.commit_shared_world_qandeel_material_v1/u,
    'and the frozen QANDEEL commit core the same way');
  assert.doesNotMatch(EXECUTABLE['0118'], /CREATE TABLE/u,
    'and it creates no relation at all: the Introduction gets no material store of its own');
  assert.match(SOURCE['0118'], /exactly three reviewed producers may write a Shared material/u,
    'the new tip pins the producer census, so a fourth producer cannot appear unnoticed');
  // EVERY RACE IS PINNED WITH AN OBSERVABLE LOCK-WAIT BARRIER. A race whose
  // interleaving is not pinned is not a proof: whichever side happens to arrive
  // first decides the outcome and the scenario reports a pass it did not earn.
  const races = (VERIFIER['0116'].match(/await race\('C\d/gu) ?? []).length;
  assert.ok(races >= 9, `the 0116 verifier runs at least nine pinned races, found ${races}`);
  assert.equal((VERIFIER['0116'].match(/await waitExtra\(\)/gu) ?? []).length >= races, true,
    'and every one of them waits on an observable lock-wait barrier');
  assert.match(VERIFIER['0116'], /noDeadlock\(/u, 'and asserts no deadlock and no lock timeout');
  // The support module never fabricates a fixture the real boundaries refuse.
  assert.match(support, /through the real I-07A, I-07B and I-07C\s*\n?\/\/ boundaries as the humans involved|real I-07A, I-07B and I-07C/u,
    'every fixture climbs through the real boundaries');
  assert.match(support, /never by a direct write/u, 'and never by a direct write');
  // EVERY REPLACED SEAM IS RESTORED ON EVERY PATH. A verifier that left a
  // permissive definition behind would make the next run prove nothing, so each
  // one captures its seams, restores them in a `finally`, and asserts at the end
  // that production is fail-closed again.
  for (const [n, verifier] of Object.entries(VERIFIER)) {
    assert.match(verifier, /captureMatchingSeam/u, `the ${n} verifier captures every seam it replaces`);
    assert.match(verifier, /\} finally \{\n\s+await asRole\('postgres'\);\n\s+for \(const seam of seams\) await rt\.restoreMatchingSeam\(seam\);/u,
      `and the ${n} verifier restores every one of them on every path`);
    assert.match(verifier, /NOT_EVALUATED/u, `and proves production is fail-closed again after the ${n} run`);
  }
});

test('the slice implements no I-08 surface and no I-09 safety engine', () => {
  const all = Object.values(SOURCE).join('\n');
  for (const forbidden of ['CREATE POLICY', 'feature_flag', 'entitlement_policy', 'moderation_policy',
    'launch_gate_state', 'blocked_user', 'report_reason', 'pricing', 'rollout']) {
    assert.ok(!all.includes(forbidden), `the slice implements no ${forbidden}: that is I-09`);
  }
  for (const [n] of Object.entries(NAMES)) {
    assert.doesNotMatch(bodyOf(n), /colour|color|#[0-9a-fA-F]{6}|font|screen|navigation|celebration|copywriting/iu,
      `${NAMES[n]} implements no mobile surface: that is I-08`);
  }
  // The deferred Product decisions stay deferred.
  assert.doesNotMatch(Object.values(EXECUTABLE).join('\n'), /blur_radius|crop_|derivative_render|cooldown|reproposal/u,
    'the exact image rendering algorithm, blur amount and pair cooldown policy stay deferred Product scope');
});
