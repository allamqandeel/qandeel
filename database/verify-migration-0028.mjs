// Canonical Evidence Eligibility (migration 0028) adversarial verifier.
//
// Runs against a fully migrated database. It proves that one SQL primitive now
// decides Evidence membership; that the primitive is behaviourally identical to
// the TypeScript EvidenceService contract, including the 64-candidate window
// taken before filtering and deduplication and the exact NFKC/whitespace
// normalization (against the same golden fixture file the Jest parity spec
// uses); that the pre-0028 per-row rule really did accept Evidence the
// canonical projection rejects; that all five SQL consumers now make the same
// membership decision; that everything else about those consumers is unchanged;
// and that upgrading a pre-0028 database rewrites no historical row and removes
// no existing Evidence link. Every fixture is rolled back; no data is retained.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Add it to the ignored local .env file.');

const migrationSql = await readFile(new URL('./migrations/0028_canonical_evidence_eligibility_v1.sql', import.meta.url), 'utf8');
// Migration 0032 factored the Update Loop mutation body into one internal core
// with a server-authorized background wrapper. The upgrade simulation below
// rebuilds the true pre-0028 schema from the live post-0032 state and
// re-applies both migrations to return to it.
const serverInvocationSql = await readFile(new URL('./migrations/0032_server_authorized_hypothesis_update_invocation_v1.sql', import.meta.url), 'utf8');
const fixtures = JSON.parse(await readFile(new URL('./fixtures/canonical-evidence-normalization-v1.json', import.meta.url), 'utf8'));
const fixtureByName = new Map(fixtures.normalization.map((row) => [row.name, row]));
const historical = Object.fromEntries(await Promise.all([
  ['h0005', '0005_hypothesis_runtime.sql'],
  ['h0006', '0006_confidence_runtime.sql'],
  ['h0008', '0008_hypothesis_update_loop.sql'],
  ['h0021', '0021_background_intelligence_repository_adapters_v1.sql'],
].map(async ([key, file]) => [key, await readFile(new URL(`./migrations/${file}`, import.meta.url), 'utf8')])));

const client = new Client({ connectionString: process.env.DATABASE_URL });
let stage = 'connect';
const legacyNormalizationGaps = [];

const q = (text, values = []) => client.query(text, values);
const rows = async (text, values = []) => (await q(text, values)).rows;

async function identity(role, uid = null) {
  await q('RESET ROLE');
  if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
  await q("SELECT set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, role }) : '']);
}

async function rejected(operation, codes = ['22023']) {
  await q('SAVEPOINT s');
  let error;
  try { await operation(); } catch (caught) { error = caught; } finally {
    await q('ROLLBACK TO SAVEPOINT s'); await q('RELEASE SAVEPOINT s');
  }
  assert.ok(error, 'operation unexpectedly succeeded');
  assert.ok(codes.includes(error.code), `unexpected rejection code ${error.code} (wanted ${codes.join(',')})`);
}

const HELPER = 'public.canonical_eligible_memory_ids_v1(uuid,timestamptz)';
const KEY = 'public.canonical_evidence_content_key_v1(text)';
const ATTACH = 'public.attach_hypothesis_evidence(uuid,text,text)';
const UPDATE_LOOP = 'public.apply_hypothesis_evidence_update(uuid,uuid,integer,text,text)';
const BACKGROUND_ATTACH = 'public.background_attach_hypothesis_evidence_v1(uuid,uuid,text,text)';
const BACKGROUND_CONFIDENCE = 'public.background_create_confidence_evaluation_v1(uuid,uuid,uuid,integer)';
const CONFIDENCE = 'public.create_confidence_evaluation(jsonb)';

const ATTACH_CALL = 'SELECT * FROM public.attach_hypothesis_evidence($1,$2,$3)';
const UPDATE_LOOP_CALL = 'SELECT * FROM public.apply_hypothesis_evidence_update($1,$2,$3,$4,$5)';
const BACKGROUND_ATTACH_CALL = 'SELECT * FROM public.background_attach_hypothesis_evidence_v1($1,$2,$3,$4)';
const BACKGROUND_CONFIDENCE_CALL = 'SELECT * FROM public.background_create_confidence_evaluation_v1($1,$2,$3,$4)';
const CONFIDENCE_CALL = 'SELECT * FROM public.create_confidence_evaluation($1::jsonb)';
const HELPER_CALL = 'SELECT memory_id, evidence_id FROM public.canonical_eligible_memory_ids_v1($1, CURRENT_TIMESTAMP)';

// The exact per-row predicate every pre-0028 consumer used. It is reproduced
// here verbatim so "the old rule accepted this" is demonstrated, not asserted.
const LEGACY_ROW_RULE = `SELECT count(*)::int accepted FROM public.memories
  WHERE id=$1 AND user_id=$2 AND status='ACTIVE'
    AND source IN ('USER_STATED','USER_CONFIRMED') AND type<>'DERIVED_INSIGHT'
    AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP)`;

async function newUser() {
  const id = randomUUID();
  await q('INSERT INTO auth.users(id) VALUES($1)', [id]);
  return id;
}

async function seedMemory(user, options = {}) {
  const {
    id = randomUUID(), content = 'canonical content', type = 'PERSONAL_FACT', source = 'USER_STATED',
    status = 'ACTIVE', minutesAgo = 0, expiresAt = null, createdMinutesAgo = 10_000,
  } = options;
  await q(
    `INSERT INTO public.memories(id,user_id,scope,type,content,source,confidence,importance,status,created_at,updated_at,expires_at)
     VALUES($1,$2,'USER',$3,$4,$5,0.9,0.6,$6,
       CURRENT_TIMESTAMP - make_interval(mins => $7),
       CURRENT_TIMESTAMP - make_interval(mins => $8), $9)`,
    [id, user, type, content, source, status, createdMinutesAgo, minutesAgo, expiresAt],
  );
  return id;
}

async function seedHypothesis(user, options = {}) {
  const { id = randomUUID(), supporting = [], contradicting = [], assumptions = [], competitors = [], version = 1, status = 'ACTIVE' } = options;
  await q(
    `INSERT INTO public.hypotheses(id,user_id,statement,type,domain,scope,origin,status,version,
       supporting_evidence_ids,contradicting_evidence_ids,competing_hypothesis_ids,assumptions)
     VALUES($1,$2,'fixture hypothesis','CAUSAL','GENERAL','fixture scope','HUMAN_REVIEWED',$3,$4,$5,$6,$7::uuid[],$8)`,
    [id, user, status, version, supporting, contradicting, competitors, assumptions],
  );
  return id;
}

const evidence = (memoryId) => `memory:${memoryId}`;

async function canonicalIds(user) {
  return (await rows(HELPER_CALL, [user])).map((row) => row.memory_id);
}

async function executeGrantees(signature) {
  return (await rows(
    `SELECT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END grantee
       FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      WHERE p.oid=$1::regprocedure AND a.privilege_type='EXECUTE' ORDER BY 1`, [signature],
  )).map((row) => row.grantee);
}

// Section 12: the primitive is internal and no consumer ACL widened.
async function verifyEffectiveAcls() {
  stage = 'effective ACLs';
  await identity('postgres');
  for (const signature of [HELPER, KEY]) {
    for (const role of ['authenticated', 'anon', 'service_role']) {
      const [{ allowed }] = await rows('SELECT has_function_privilege($1,$2,$3) allowed', [role, signature, 'EXECUTE']);
      assert.equal(allowed, false, `${role} must not EXECUTE ${signature}`);
    }
    // PUBLIC has no has_function_privilege spelling, so the ACL is read directly.
    assert.deepEqual(await executeGrantees(signature), ['postgres'], `${signature} EXECUTE holders`);
    const [{ owner, definer, config }] = await rows(
      'SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef definer, p.proconfig config FROM pg_proc p WHERE p.oid=$1::regprocedure',
      [signature],
    );
    assert.equal(owner, 'postgres', `${signature} owner`);
    assert.equal(definer, false, `${signature} stays SECURITY INVOKER - it adds no privilege of its own`);
    assert.ok(Array.isArray(config) && config.length === 1 && config[0].startsWith('search_path='), `${signature} search_path`);
  }
  // Consumer ACLs are exactly what migrations 0005, 0006, 0008 and 0021 granted.
  const expected = [
    [ATTACH, { authenticated: true, anon: false, service_role: false }],
    [UPDATE_LOOP, { authenticated: true, anon: false, service_role: false }],
    [CONFIDENCE, { authenticated: true, anon: false, service_role: false }],
    [BACKGROUND_ATTACH, { authenticated: false, anon: false, service_role: true }],
    [BACKGROUND_CONFIDENCE, { authenticated: false, anon: false, service_role: true }],
  ];
  for (const [signature, matrix] of expected) {
    for (const [role, allowedExpected] of Object.entries(matrix)) {
      const [{ allowed }] = await rows('SELECT has_function_privilege($1,$2,$3) allowed', [role, signature, 'EXECUTE']);
      assert.equal(allowed, allowedExpected, `${role} EXECUTE ${signature}`);
    }
    const [{ owner, definer, config }] = await rows(
      'SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef definer, p.proconfig config FROM pg_proc p WHERE p.oid=$1::regprocedure',
      [signature],
    );
    assert.equal(owner, 'postgres', `${signature} owner`);
    assert.equal(definer, true, `${signature} stays SECURITY DEFINER`);
    assert.ok(Array.isArray(config) && config.length === 1 && config[0].startsWith('search_path='), `${signature} search_path`);
    assert.ok(!(await executeGrantees(signature)).includes('PUBLIC'), `${signature} is not PUBLIC executable`);
  }
  // One SQL source of truth: exactly these five functions decide Evidence
  // membership, and every one of them reaches it through the primitive.
  const users = (await rows(
    `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prokind='f'
        AND pg_get_functiondef(p.oid) ~ 'canonical_eligible_memory_ids_v1'
        AND p.proname <> 'canonical_eligible_memory_ids_v1'
      ORDER BY p.proname`,
  )).map((row) => row.proname);
  // Migration 0032 moved the Update Loop's membership test into the shared
  // internal mutation core, so the core - not the thin authenticated wrapper -
  // is the primitive's consumer. Still exactly five, still one SQL source of
  // truth.
  assert.deepEqual(users, [
    'apply_hypothesis_evidence_update_core_v1', 'attach_hypothesis_evidence',
    'background_attach_hypothesis_evidence_v1', 'background_create_confidence_evaluation_v1',
    'create_confidence_evaluation',
  ], 'canonical primitive consumers');
  // No function still carries its own copy of the eligibility predicate: the
  // exact conjunction every pre-0028 consumer used appears nowhere.
  const stragglers = (await rows(
    `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prokind='f'
        AND pg_get_functiondef(p.oid) ~ 'public\\.memories'
        AND pg_get_functiondef(p.oid) ~ 'source IN \\(''USER_STATED'',''USER_CONFIRMED''\\)'
      ORDER BY p.proname`,
  )).map((row) => row.proname);
  assert.deepEqual(stragglers, ['canonical_eligible_memory_ids_v1'],
    'the canonical primitive is the only SQL implementation of Evidence eligibility');
}

// Section 7: JavaScript / SQL exact-normalization parity, proven against the
// same golden file the Jest parity spec asserts the TypeScript half with.
async function verifyNormalizationParity() {
  stage = 'JS/SQL normalization parity';
  await identity('postgres');
  for (const row of fixtures.normalization) {
    const [{ key }] = await rows('SELECT public.canonical_evidence_content_key_v1($1) key', [row.raw]);
    assert.equal(key, row.expected, `SQL normalization parity for fixture ${row.name}`);
    // The pre-0028 expression from migration 0008 for the same input. Its
    // whitespace class is `\s`, whose multibyte membership comes from the
    // server ctype rather than the ECMAScript set, so any divergence here is
    // exactly the drift the canonical primitive removes.
    const [{ legacy }] = await rows(
      `SELECT regexp_replace(regexp_replace(normalize($1,NFKC), '^\\s+|\\s+$', '', 'g'), '\\s+', ' ', 'g') legacy`,
      [row.raw],
    );
    if (legacy !== row.expected) legacyNormalizationGaps.push(row.name);
  }
  // Fixtures that share a normalized key must share it in SQL too - that is the
  // membership-level parity claim, not just a string claim.
  for (const group of fixtures.duplicateGroups) {
    const keys = [];
    for (const name of group) {
      const [{ key }] = await rows('SELECT public.canonical_evidence_content_key_v1($1) key', [fixtureByName.get(name).raw]);
      keys.push(key);
    }
    assert.equal(new Set(keys).size, 1, `duplicate group ${group[0]} collapses to one SQL key`);
  }
  const [{ conflict }] = await rows('SELECT public.canonical_evidence_content_key_v1($1) conflict', [fixtureByName.get('semantic-conflict').raw]);
  const [{ canonical }] = await rows('SELECT public.canonical_evidence_content_key_v1($1) canonical', [fixtureByName.get('already-canonical').raw]);
  assert.notEqual(conflict, canonical, 'a semantic conflict is never deduplicated');
}

// Section 10.B: the candidate window is exactly 64, taken before filtering and
// deduplication, with id DESC as the candidate tie-break.
async function verifyCandidateWindow() {
  stage = 'candidate window exactness';
  await identity('postgres');

  const exact = await newUser();
  const exactIds = [];
  for (let index = 0; index < 64; index += 1) {
    exactIds.push(await seedMemory(exact, { content: `candidate ${index}`, minutesAgo: index }));
  }
  assert.equal((await canonicalIds(exact)).length, 64, 'exactly 64 candidates all survive');

  // The 65th, oldest, row falls out of the window even though it satisfies the
  // per-row eligibility rule on its own.
  const outside = await seedMemory(exact, { content: 'candidate 64 outside', minutesAgo: 64 });
  const after65 = await canonicalIds(exact);
  assert.equal(after65.length, 64, 'the window stays bounded at 64');
  assert.ok(!after65.includes(outside), 'the 65th oldest candidate is outside the window');
  assert.deepEqual([...after65].sort(), [...exactIds].sort(), 'the 64 newest candidates are the window');
  const [{ accepted }] = await rows(LEGACY_ROW_RULE, [outside, exact]);
  assert.equal(accepted, 1, 'the pre-0028 per-row rule accepted the out-of-window Memory');

  // 70 candidates: still 64, still the newest.
  for (let index = 65; index < 70; index += 1) {
    await seedMemory(exact, { content: `candidate ${index}`, minutesAgo: index });
  }
  assert.equal((await canonicalIds(exact)).length, 64, 'more than 65 candidates stay bounded at 64');

  // Candidate tie-break on equal updated_at is id DESC: with 65 rows sharing a
  // timestamp the LOWEST id is the one pushed out of the window.
  const tied = await newUser();
  const tiedIds = Array.from({ length: 65 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`);
  for (const [index, id] of tiedIds.entries()) {
    await seedMemory(tied, { id, content: `tied ${index}`, minutesAgo: 5 });
  }
  const tiedWindow = await canonicalIds(tied);
  assert.equal(tiedWindow.length, 64);
  assert.ok(!tiedWindow.includes(tiedIds[0]), 'equal updated_at breaks toward the higher id (ORDER BY id DESC)');
  assert.ok(tiedWindow.includes(tiedIds[64]), 'the highest id stays inside the window');

  // Ineligible rows still consume candidate slots, because the LIMIT is applied
  // before source/type filtering. This is the observable consequence of the
  // ordering the contract requires, so it is asserted rather than assumed.
  const consumed = await newUser();
  const wanted = await seedMemory(consumed, { content: 'the only eligible row', minutesAgo: 100 });
  for (let index = 0; index < 64; index += 1) {
    await seedMemory(consumed, { content: `ineligible ${index}`, source: 'IMPORTED', minutesAgo: index });
  }
  assert.deepEqual(await canonicalIds(consumed), [],
    'ineligible rows occupy candidate slots: LIMIT 64 precedes source filtering');
  await q('DELETE FROM public.memories WHERE user_id=$1 AND id<>$2', [consumed, wanted]);
  assert.deepEqual(await canonicalIds(consumed), [wanted], 'with the window free the eligible row returns');
}

// Section 10.C.
async function verifyEligibilityFilters() {
  stage = 'eligibility filters';
  await identity('postgres');
  const owner = await newUser();
  const other = await newUser();

  const accepted = [];
  for (const type of ['PERSONAL_FACT', 'STABLE_PREFERENCE', 'GOAL', 'DECISION_COMMITMENT', 'RELATIONSHIP_CONTEXT', 'INTERACTION_PREFERENCE', 'TEMPORARY_STATE']) {
    accepted.push(await seedMemory(owner, { content: `accepted ${type}`, type, source: 'USER_STATED' }));
    accepted.push(await seedMemory(owner, { content: `accepted confirmed ${type}`, type, source: 'USER_CONFIRMED' }));
  }
  // An unexpired expiry is accepted; expiry is evaluated against p_now.
  accepted.push(await seedMemory(owner, {
    content: 'accepted future expiry', type: 'TEMPORARY_STATE',
    expiresAt: new Date(Date.now() + 86_400_000),
  }));

  const rejectedIds = {
    'cross-user': await seedMemory(other, { content: 'other tenant row' }),
    'status SUPERSEDED': await seedMemory(owner, { content: 'superseded', status: 'SUPERSEDED' }),
    'status DELETED': await seedMemory(owner, { content: 'deleted', status: 'DELETED' }),
    'status DISABLED': await seedMemory(owner, { content: 'disabled', status: 'DISABLED' }),
    'status EXPIRED': await seedMemory(owner, { content: 'expired status', status: 'EXPIRED' }),
    'status PENDING_CONFIRMATION': await seedMemory(owner, { content: 'pending', status: 'PENDING_CONFIRMATION' }),
    // memories_derived_authority_check forbids an ACTIVE SYSTEM_DERIVED row, so
    // SYSTEM_DERIVED is only representable in a non-ACTIVE state.
    'source SYSTEM_DERIVED': await seedMemory(owner, { content: 'derived', source: 'SYSTEM_DERIVED', status: 'PENDING_CONFIRMATION', type: 'DERIVED_INSIGHT' }),
    'source IMPORTED': await seedMemory(owner, { content: 'imported', source: 'IMPORTED' }),
    'source ADMIN_CONTROLLED': await seedMemory(owner, { content: 'admin', source: 'ADMIN_CONTROLLED' }),
    'type DERIVED_INSIGHT': await seedMemory(owner, { content: 'insight', type: 'DERIVED_INSIGHT' }),
    'expired at now': await seedMemory(owner, {
      content: 'already expired', type: 'TEMPORARY_STATE',
      createdMinutesAgo: 2880, expiresAt: new Date(Date.now() - 86_400_000),
    }),
  };

  const canonical = new Set(await canonicalIds(owner));
  for (const id of accepted) assert.ok(canonical.has(id), `canonical Evidence accepted (${id})`);
  assert.equal(canonical.size, accepted.length, 'exactly the eligible rows are canonical');
  for (const [label, id] of Object.entries(rejectedIds)) {
    assert.ok(!canonical.has(id), `${label} is excluded from canonical Evidence`);
  }
  assert.ok(!(await canonicalIds(other)).some((id) => accepted.includes(id)), 'tenant isolation inside the primitive');
}

// Section 10.D.
async function verifyExactNormalizedDedup() {
  stage = 'exact normalized deduplication';
  await identity('postgres');

  const user = await newUser();
  const canonicalRaw = fixtureByName.get('already-canonical').raw;
  const newest = await seedMemory(user, { content: canonicalRaw, minutesAgo: 1 });
  const loser = await seedMemory(user, { content: fixtureByName.get('ascii-leading-trailing').raw, minutesAgo: 2 });
  const conflict = await seedMemory(user, { content: fixtureByName.get('semantic-conflict').raw, minutesAgo: 3 });
  const otherSource = await seedMemory(user, { content: canonicalRaw, source: 'USER_CONFIRMED', minutesAgo: 4 });
  const otherType = await seedMemory(user, { content: canonicalRaw, type: 'GOAL', minutesAgo: 5 });
  const canonical = new Set(await canonicalIds(user));
  assert.ok(canonical.has(newest), 'the newest member of a duplicate group wins');
  assert.ok(!canonical.has(loser), 'an exact normalized duplicate is removed');
  assert.ok(canonical.has(conflict), 'a semantic conflict is retained');
  assert.ok(canonical.has(otherSource), 'a different source is a different Evidence key');
  assert.ok(canonical.has(otherType), 'a different type is a different Evidence key');
  const [{ accepted }] = await rows(LEGACY_ROW_RULE, [loser, user]);
  assert.equal(accepted, 1, 'the pre-0028 per-row rule accepted the losing normalized duplicate');

  // Equal updated_at: the LOWEST id wins the duplicate group (ORDER BY id ASC),
  // which is the opposite tie-break from the candidate window.
  const tied = await newUser();
  const low = '00000000-0000-4000-8000-0000000000aa';
  const high = '00000000-0000-4000-8000-0000000000bb';
  await seedMemory(tied, { id: high, content: fixtureByName.get('ascii-repeated-interior').raw, minutesAgo: 7 });
  await seedMemory(tied, { id: low, content: canonicalRaw, minutesAgo: 7 });
  assert.deepEqual(await canonicalIds(tied), [low], 'equal updated_at breaks toward the lower id inside a duplicate group');

  // Every Unicode duplicate group in the golden file collapses to one row, and
  // the winner is the newest member.
  for (const group of fixtures.duplicateGroups) {
    const groupUser = await newUser();
    const seeded = [];
    for (const [index, name] of group.entries()) {
      seeded.push(await seedMemory(groupUser, { content: fixtureByName.get(name).raw, minutesAgo: index + 1 }));
    }
    assert.deepEqual(await canonicalIds(groupUser), [seeded[0]],
      `Unicode duplicate group ${group[0]} collapses to its newest member`);
  }
}

// Section 10.A and 10.E: the reproduction and the five-consumer parity, on one
// fixture set so "same decision" is literally the same Evidence identifier.
async function verifyConsumerParity() {
  stage = 'consumer parity';
  await identity('postgres');
  const owner = await newUser();
  const other = await newUser();

  // member: canonical. outside: eligible per row but outside the top-64 window.
  // duplicate: eligible per row but the loser of an exact normalized group.
  const member = await seedMemory(owner, { content: 'canonical member', minutesAgo: 1 });
  const duplicateWinner = await seedMemory(owner, { content: fixtureByName.get('already-canonical').raw, minutesAgo: 2 });
  const duplicate = await seedMemory(owner, { content: fixtureByName.get('mixed-unicode-whitespace-nfkc').raw, minutesAgo: 3 });
  for (let index = 0; index < 62; index += 1) {
    await seedMemory(owner, { content: `filler ${index}`, minutesAgo: 4 + index });
  }
  const outside = await seedMemory(owner, { content: 'outside the window', minutesAgo: 5000 });

  const canonical = new Set(await canonicalIds(owner));
  assert.ok(canonical.has(member) && canonical.has(duplicateWinner), 'canonical members are members');
  assert.ok(!canonical.has(outside), 'the out-of-window row is not a member');
  assert.ok(!canonical.has(duplicate), 'the losing normalized duplicate is not a member');
  for (const id of [outside, duplicate]) {
    const [{ accepted }] = await rows(LEGACY_ROW_RULE, [id, owner]);
    assert.equal(accepted, 1, 'the pre-0028 per-row rule accepted this non-canonical Evidence');
  }

  // 1. attach_hypothesis_evidence.
  const attachTarget = await seedHypothesis(owner);
  await identity('authenticated', owner);
  const [attached] = await rows(ATTACH_CALL, [attachTarget, evidence(member), 'SUPPORTING']);
  assert.deepEqual(attached.supporting_evidence_ids, [evidence(member)], 'a canonical member is accepted');
  assert.equal(attached.version, 2);
  await rejected(() => q(ATTACH_CALL, [attachTarget, evidence(outside), 'SUPPORTING']));
  await rejected(() => q(ATTACH_CALL, [attachTarget, evidence(duplicate), 'CONTRADICTING']));

  // 2. apply_hypothesis_evidence_update.
  await identity('postgres');
  const updateTarget = await seedHypothesis(owner);
  await identity('authenticated', owner);
  const [applied] = await rows(UPDATE_LOOP_CALL, [randomUUID(), updateTarget, 1, evidence(duplicateWinner), 'SUPPORTING']);
  assert.deepEqual(applied.hypothesis.supporting_evidence_ids, [evidence(duplicateWinner)]);
  await rejected(() => q(UPDATE_LOOP_CALL, [randomUUID(), updateTarget, 2, evidence(outside), 'SUPPORTING']));
  await rejected(() => q(UPDATE_LOOP_CALL, [randomUUID(), updateTarget, 2, evidence(duplicate), 'SUPPORTING']));

  // 3. background_attach_hypothesis_evidence_v1.
  await identity('postgres');
  const backgroundTarget = await seedHypothesis(owner);
  await identity('service_role');
  const [backgroundAttached] = await rows(BACKGROUND_ATTACH_CALL, [owner, backgroundTarget, evidence(member), 'SUPPORTING']);
  assert.deepEqual(backgroundAttached.supporting_evidence_ids, [evidence(member)]);
  await rejected(() => q(BACKGROUND_ATTACH_CALL, [owner, backgroundTarget, evidence(outside), 'SUPPORTING']));
  await rejected(() => q(BACKGROUND_ATTACH_CALL, [owner, backgroundTarget, evidence(duplicate), 'SUPPORTING']));

  // 4/5. Both Confidence commands keep exactly the linked canonical members, in
  // the Hypothesis array's own order, and drop the linked non-members.
  await identity('postgres');
  const evaluated = await seedHypothesis(owner, {
    supporting: [evidence(outside), evidence(member), evidence(duplicateWinner)],
    contradicting: [evidence(duplicate)],
  });
  await identity('service_role');
  const [backgroundEvaluation] = await rows(BACKGROUND_CONFIDENCE_CALL, [owner, randomUUID(), evaluated, 1]);
  assert.deepEqual(backgroundEvaluation.supporting_evidence_ids, [evidence(member), evidence(duplicateWinner)],
    'background Confidence keeps linked canonical members in Hypothesis array order');
  assert.deepEqual(backgroundEvaluation.contradicting_evidence_ids, [],
    'background Confidence drops a linked non-member');
  await identity('authenticated', owner);
  const [authenticatedEvaluation] = await rows(CONFIDENCE_CALL, [{ id: randomUUID(), target_id: evaluated, target_version: 1 }]);
  assert.deepEqual(authenticatedEvaluation.supporting_evidence_ids, backgroundEvaluation.supporting_evidence_ids,
    'both Confidence commands make the same membership decision');
  assert.deepEqual(authenticatedEvaluation.contradicting_evidence_ids, backgroundEvaluation.contradicting_evidence_ids);

  // A cross-tenant caller cannot borrow the owner's membership: the primitive
  // is evaluated for the caller's own user, so the owner's canonical Evidence
  // is simply not eligible for anyone else.
  await identity('postgres');
  const otherHypothesis = await seedHypothesis(other);
  await seedMemory(other, { content: 'other tenant evidence' });
  await identity('authenticated', other);
  await rejected(() => q(ATTACH_CALL, [otherHypothesis, evidence(member), 'SUPPORTING']));
  await rejected(() => q(ATTACH_CALL, [attachTarget, evidence(member), 'CONTRADICTING']));
  // Ownership is still enforced after membership: the owner's own canonical
  // Evidence cannot be attached to another tenant's Hypothesis, which returns
  // no row rather than mutating anything.
  await identity('authenticated', owner);
  assert.equal((await rows(ATTACH_CALL, [otherHypothesis, evidence(member), 'SUPPORTING'])).length, 0,
    'cross-tenant attachment finds no Hypothesis and mutates nothing');
  await identity('postgres');
  const [untouched] = await rows('SELECT supporting_evidence_ids, version FROM public.hypotheses WHERE id=$1', [otherHypothesis]);
  assert.deepEqual(untouched, { supporting_evidence_ids: [], version: 1 });
}

// Section 10.F.
async function verifyRegression() {
  stage = 'consumer regression';
  await identity('postgres');
  const owner = await newUser();
  const member = await seedMemory(owner, { content: 'regression evidence', minutesAgo: 1 });
  const second = await seedMemory(owner, { content: 'regression evidence two', minutesAgo: 2 });
  const target = await seedHypothesis(owner, { assumptions: ['fixed assumption'] });

  await identity('authenticated', owner);
  // Role disjointness and duplicate rejection are unchanged.
  await rows(ATTACH_CALL, [target, evidence(member), 'SUPPORTING']);
  await rejected(() => q(ATTACH_CALL, [target, evidence(member), 'SUPPORTING']));
  await rejected(() => q(ATTACH_CALL, [target, evidence(member), 'CONTRADICTING']));
  await rejected(() => q(ATTACH_CALL, [target, evidence(second), 'WITNESS']));
  await rejected(() => q(ATTACH_CALL, [target, 'not-evidence', 'SUPPORTING']));

  // Update Loop expected-version semantics and audit are unchanged, and the
  // stale-version guard still takes precedence over the membership test.
  const updateId = randomUUID();
  const [applied] = await rows(UPDATE_LOOP_CALL, [updateId, target, 2, evidence(second), 'CONTRADICTING']);
  assert.equal(applied.update.before_version, 2);
  assert.equal(applied.update.after_version, 3);
  assert.equal(applied.update.source, 'QANDEEL_HYPOTHESIS_UPDATE_LOOP');
  assert.equal(applied.update.evidence_role, 'CONTRADICTING');
  assert.deepEqual(applied.hypothesis.contradicting_evidence_ids, [evidence(second)]);
  await rejected(() => q(UPDATE_LOOP_CALL, [randomUUID(), target, 2, evidence(member), 'SUPPORTING']), ['40001']);
  // A stale version with Evidence that is ALSO non-canonical still fails as
  // 40001, so migration 0028 did not reorder the Update Loop's guards.
  await rejected(() => q(UPDATE_LOOP_CALL, [randomUUID(), target, 99, `memory:${randomUUID()}`, 'SUPPORTING']), ['40001']);
  await rejected(() => q(UPDATE_LOOP_CALL, [randomUUID(), target, 0, evidence(member), 'SUPPORTING']), ['22023']);
  const [{ audits }] = await rows('SELECT count(*)::int audits FROM public.hypothesis_updates WHERE hypothesis_id=$1', [target]);
  assert.equal(audits, 1, 'exactly one immutable audit row was written');
  await rejected(() => q(
    "INSERT INTO public.hypothesis_updates(id,user_id,hypothesis_id,before_version,after_version,evidence_id,evidence_role,source) VALUES($1,$2,$3,9,10,$4,'SUPPORTING','forged')",
    [randomUUID(), owner, target, evidence(member)],
  ), ['42501']);

  // Confidence target-version validation and missing-information behaviour.
  const [{ version }] = await rows('SELECT version FROM public.hypotheses WHERE id=$1', [target]);
  await rejected(() => q(CONFIDENCE_CALL, [{ id: randomUUID(), target_id: target, target_version: version - 1 }]));
  const [evaluation] = await rows(CONFIDENCE_CALL, [{ id: randomUUID(), target_id: target, target_version: version }]);
  assert.deepEqual(evaluation.supporting_evidence_ids, [evidence(member)]);
  assert.deepEqual(evaluation.contradicting_evidence_ids, [evidence(second)]);
  assert.deepEqual(evaluation.assumptions, ['fixed assumption']);
  assert.deepEqual(evaluation.missing_information_codes, ['UNVERIFIED_ASSUMPTIONS', 'CONFIDENCE_MODEL_UNCALIBRATED']);
  assert.equal(evaluation.policy_version, 'confidence-foundation-v1');
  assert.equal(evaluation.provenance, 'QANDEEL_CONFIDENCE_RUNTIME');
  assert.equal(evaluation.calibration_state, 'UNCALIBRATED');
  assert.equal(evaluation.numeric_score, null);

  // When canonical membership legitimately empties the linked set, and only
  // then, NO_ELIGIBLE_EVIDENCE appears.
  await identity('postgres');
  await q("UPDATE public.memories SET status='DELETED' WHERE user_id=$1", [owner]);
  await identity('authenticated', owner);
  const [emptied] = await rows(CONFIDENCE_CALL, [{ id: randomUUID(), target_id: target, target_version: version }]);
  assert.deepEqual(emptied.supporting_evidence_ids, []);
  assert.deepEqual(emptied.missing_information_codes, ['UNVERIFIED_ASSUMPTIONS', 'NO_ELIGIBLE_EVIDENCE', 'CONFIDENCE_MODEL_UNCALIBRATED']);
  // The Hypothesis itself still holds its historical Evidence links: a
  // membership decision never rewrites stored history.
  await identity('postgres');
  const [stored] = await rows('SELECT supporting_evidence_ids, contradicting_evidence_ids FROM public.hypotheses WHERE id=$1', [target]);
  assert.deepEqual(stored.supporting_evidence_ids, [evidence(member)]);
  assert.deepEqual(stored.contradicting_evidence_ids, [evidence(second)]);
}

const HISTORICAL_DEFINITIONS = [
  ['h0005', 'attach_hypothesis_evidence'],
  ['h0008', 'apply_hypothesis_evidence_update'],
  ['h0021', 'background_attach_hypothesis_evidence_v1'],
  ['h0021', 'background_create_confidence_evaluation_v1'],
  ['h0006', 'create_confidence_evaluation'],
];

function historicalDefinition(key, name) {
  const sql = historical[key];
  const start = sql.indexOf(`CREATE FUNCTION public.${name}(`);
  assert.notEqual(start, -1, `historical ${name}`);
  const terminator = 'END; $$;';
  const end = sql.indexOf(terminator, start) + terminator.length;
  return sql.slice(start, end).replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION');
}

// Sections 10.A and 11: a database in the pre-0028 state really does accept
// non-canonical Evidence, upgrades cleanly, and keeps every historical row.
async function verifyUpgradePath() {
  stage = 'upgrade from the pre-canonical schema';
  await q('SAVEPOINT upgrade');
  await identity('postgres');
  for (const [key, name] of HISTORICAL_DEFINITIONS) await q(historicalDefinition(key, name));
  // The 0032 server-invocation surface postdates 0028 and is removed the same
  // way so the reconstructed baseline is the true pre-0028 schema.
  await q('DROP FUNCTION public.background_apply_hypothesis_evidence_update_v1(uuid,uuid,uuid,uuid,integer,text,text)');
  await q('DROP FUNCTION public.apply_hypothesis_evidence_update_core_v1(uuid,uuid,uuid,integer,text,text)');
  await q(`DROP FUNCTION ${HELPER}`);
  await q(`DROP FUNCTION ${KEY}`);

  const owner = await newUser();
  const member = await seedMemory(owner, { content: 'upgrade member', minutesAgo: 1 });
  const duplicateWinner = await seedMemory(owner, { content: fixtureByName.get('already-canonical').raw, minutesAgo: 2 });
  const duplicate = await seedMemory(owner, { content: fixtureByName.get('nbsp-u00a0').raw, minutesAgo: 3 });
  for (let index = 0; index < 62; index += 1) {
    await seedMemory(owner, { content: `upgrade filler ${index}`, minutesAgo: 4 + index });
  }
  const outside = await seedMemory(owner, { content: 'upgrade outside the window', minutesAgo: 9000 });

  // Pre-0028 the weaker consumers accept both non-canonical rows.
  const legacyTarget = await seedHypothesis(owner);
  await identity('authenticated', owner);
  const [legacyAttached] = await rows(ATTACH_CALL, [legacyTarget, evidence(outside), 'SUPPORTING']);
  assert.deepEqual(legacyAttached.supporting_evidence_ids, [evidence(outside)],
    'pre-0028: attach_hypothesis_evidence accepted an out-of-window Memory');
  const [legacySecond] = await rows(ATTACH_CALL, [legacyTarget, evidence(duplicate), 'CONTRADICTING']);
  assert.deepEqual(legacySecond.contradicting_evidence_ids, [evidence(duplicate)],
    'pre-0028: attach_hypothesis_evidence accepted a losing normalized duplicate');
  await identity('service_role');
  const legacyBackgroundTarget = await (async () => {
    await identity('postgres');
    const id = await seedHypothesis(owner);
    await identity('service_role');
    return id;
  })();
  const [legacyBackground] = await rows(BACKGROUND_ATTACH_CALL, [owner, legacyBackgroundTarget, evidence(outside), 'SUPPORTING']);
  assert.deepEqual(legacyBackground.supporting_evidence_ids, [evidence(outside)],
    'pre-0028: the background attachment accepted an out-of-window Memory');
  const [legacyEvaluation] = await rows(BACKGROUND_CONFIDENCE_CALL, [owner, randomUUID(), legacyTarget, 3]);
  assert.deepEqual(legacyEvaluation.supporting_evidence_ids, [evidence(outside)],
    'pre-0028: Confidence counted an out-of-window Memory as current Evidence');
  assert.deepEqual(legacyEvaluation.contradicting_evidence_ids, [evidence(duplicate)],
    'pre-0028: Confidence counted a losing normalized duplicate as current Evidence');

  // Capture every historical row the upgrade must not touch.
  await identity('postgres');
  const beforeHypotheses = await rows('SELECT * FROM public.hypotheses WHERE user_id=$1 ORDER BY id', [owner]);
  const beforeMemories = await rows('SELECT * FROM public.memories WHERE user_id=$1 ORDER BY id', [owner]);
  const beforeUpdates = await rows('SELECT * FROM public.hypothesis_updates ORDER BY id');
  const beforeConfidence = await rows('SELECT * FROM public.confidence_evaluations ORDER BY id');
  const [{ total: memoriesBefore }] = await rows('SELECT count(*)::int total FROM public.memories');

  await q(migrationSql.replace(/^\s*BEGIN;/mu, '').replace(/^\s*COMMIT;\s*$/mu, ''));

  assert.deepEqual(await rows('SELECT * FROM public.hypotheses WHERE user_id=$1 ORDER BY id', [owner]), beforeHypotheses,
    'the upgrade leaves Hypothesis rows - including non-canonical Evidence links - byte-identical');
  assert.deepEqual(await rows('SELECT * FROM public.memories WHERE user_id=$1 ORDER BY id', [owner]), beforeMemories,
    'the upgrade leaves Memory rows byte-identical');
  assert.deepEqual(await rows('SELECT * FROM public.hypothesis_updates ORDER BY id'), beforeUpdates,
    'the upgrade leaves the hypothesis_updates audit byte-identical');
  assert.deepEqual(await rows('SELECT * FROM public.confidence_evaluations ORDER BY id'), beforeConfidence,
    'the upgrade leaves Confidence history byte-identical');
  const [{ total: memoriesAfter }] = await rows('SELECT count(*)::int total FROM public.memories');
  assert.equal(memoriesAfter, memoriesBefore, 'the upgrade deletes nothing');

  // Migration 0032 follows 0028 on the canonical chain, so re-applying it
  // returns the schema to the live final state before it is re-verified. It
  // touches no existing row.
  await q(serverInvocationSql.replace(/^\s*BEGIN;/mu, '').replace(/^\s*COMMIT;\s*$/mu, ''));
  assert.deepEqual(await rows('SELECT * FROM public.hypotheses WHERE user_id=$1 ORDER BY id', [owner]), beforeHypotheses,
    'migration 0032 also leaves Hypothesis rows byte-identical');
  assert.deepEqual(await rows('SELECT * FROM public.hypothesis_updates ORDER BY id'), beforeUpdates,
    'migration 0032 also leaves the hypothesis_updates audit byte-identical');

  // The upgraded database reaches the hardened contract.
  await verifyEffectiveAcls();
  stage = 'upgrade from the pre-canonical schema';
  const canonical = new Set(await canonicalIds(owner));
  assert.ok(canonical.has(member) && canonical.has(duplicateWinner));
  assert.ok(!canonical.has(outside) && !canonical.has(duplicate));
  await identity('postgres');
  const upgradedTarget = await seedHypothesis(owner);
  await identity('authenticated', owner);
  await rejected(() => q(ATTACH_CALL, [upgradedTarget, evidence(outside), 'SUPPORTING']));
  await rejected(() => q(ATTACH_CALL, [upgradedTarget, evidence(duplicate), 'SUPPORTING']));
  const [upgradedAttached] = await rows(ATTACH_CALL, [upgradedTarget, evidence(member), 'SUPPORTING']);
  assert.deepEqual(upgradedAttached.supporting_evidence_ids, [evidence(member)]);
  await identity('service_role');
  await rejected(() => q(BACKGROUND_ATTACH_CALL, [owner, legacyBackgroundTarget, evidence(duplicate), 'SUPPORTING']));
  // The Confidence snapshot taken after the upgrade drops the links that are no
  // longer canonical, while the Hypothesis keeps them.
  await identity('postgres');
  const [{ version }] = await rows('SELECT version FROM public.hypotheses WHERE id=$1', [legacyTarget]);
  await identity('service_role');
  const [upgradedEvaluation] = await rows(BACKGROUND_CONFIDENCE_CALL, [owner, randomUUID(), legacyTarget, version]);
  assert.deepEqual(upgradedEvaluation.supporting_evidence_ids, [], 'the out-of-window link is no longer current Evidence');
  assert.deepEqual(upgradedEvaluation.contradicting_evidence_ids, [], 'the duplicate link is no longer current Evidence');
  assert.ok(upgradedEvaluation.missing_information_codes.includes('NO_ELIGIBLE_EVIDENCE'));

  await identity('postgres');
  const [stillLinked] = await rows('SELECT supporting_evidence_ids, contradicting_evidence_ids FROM public.hypotheses WHERE id=$1', [legacyTarget]);
  assert.deepEqual(stillLinked.supporting_evidence_ids, [evidence(outside)], 'historical Evidence links are not retroactively removed');
  assert.deepEqual(stillLinked.contradicting_evidence_ids, [evidence(duplicate)]);

  await q('ROLLBACK TO SAVEPOINT upgrade');
  await q('RELEASE SAVEPOINT upgrade');
}

async function main() {
  try {
    await client.connect();
    await q('BEGIN');
    await identity('postgres');

    await verifyEffectiveAcls();
    await verifyNormalizationParity();
    await verifyCandidateWindow();
    await verifyEligibilityFilters();
    await verifyExactNormalizedDedup();
    await verifyConsumerParity();
    await verifyRegression();
    await verifyUpgradePath();

    await identity('postgres');
    const legacyNote = legacyNormalizationGaps.length === 0
      ? 'the pre-0028 regex-class normalization agreed with JavaScript on every golden fixture in this environment (its whitespace class is still ctype dependent, which is why the canonical primitive enumerates the ECMAScript set by code point)'
      : `the pre-0028 regex-class normalization disagreed with JavaScript on: ${legacyNormalizationGaps.join(', ')}`;
    console.log(`Verified migration 0028: one canonical SQL Evidence-membership primitive, JS/SQL exact-normalization parity across ${fixtures.normalization.length} golden fixtures, the 64-candidate window applied before eligibility filtering and deduplication with id DESC / id ASC tie-breaks, canonical eligibility and exact normalized dedup, the pre-0028 per-row rule reproduced accepting out-of-window and losing-duplicate Evidence, identical membership decisions across all five SQL consumers, unchanged Update Loop version/audit, background authority and Confidence semantics, internal-only helper ACLs, and a clean upgrade that leaves every historical row byte-identical; ${legacyNote}.`);
  } finally {
    try { await q('ROLLBACK'); } catch { /* ignore */ }
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Canonical Evidence eligibility verification failed at ${stage} (${code}): ${error?.message ?? 'unknown assertion'}. Connection details were suppressed.`);
  process.exitCode = 1;
});
