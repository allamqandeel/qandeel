// S6-05 / migration 0160 - real-PostgreSQL proof of the Introduction World's reading and human messaging (CP3).
//
//   A  posture: three authenticated-only boundaries, postgres-owned, DEFINER, pinned; the frozen cores they compose still
//      executable by no application role and byte-identical to their defining migrations; exactly the client's inputs;
//      the human is auth.uid(); nothing reaches a reply, weaving, analysis, Activity, a gate, an account Name, a grant or
//      Personal Context; the send calls the frozen human text core exactly once and answers a non-member before any lock
//   B  discovery: after the REAL CP2 acceptance BOTH humans - the first recipient included - find the one World, its
//      proposal, ACTIVE and the other's handoff first name; nobody else finds anything; the Stage 4 list still does not
//   C  reading: the two humans read each other's words, newest first, by keyset page; an empty page is one ACTIVE row;
//      an outsider, an unknown World and an invalid request read nothing; only human words are messages
//   D  sending: COMMITTED under the Stage 4 derivation function with Introduction-only namespaces; visible to exactly the two; no reply work, no QANDEEL material,
//      no Activity source row, no grant moved; a retry is the same message; a reused command id is COMMAND_CONFLICT;
//      outsiders and malformed requests change nothing; the S6-02 fence still refuses every Stage 4 path
//   E  END and after: ENDED to the two humans only (list, read and send), never to anyone else; a retry of a message sent
//      before END is still that message; the owner deletes their own message through the existing route (R-5), before
//      and after END, and nobody else can; after SUCCESS the World is Standard and no longer an Introduction here
//   G  races, on two real connections: a message against END in both orders (it commits and END freezes it, or it is
//      ENDED and nothing is written); the same command twice at once (one message); a message against SUCCESS (never
//      a message in the now-Standard World through this path)
//
// In-transaction scenarios run in their own SAVEPOINT inside one transaction that is rolled back, with the CW2-08 and
// I-07D seams replaced for the run and restored byte for byte. The races commit their fixtures and remove them.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { APP_ROLES, DFN, PFN, createIntroductionRuntime, runVerifier, terminalIds } from './introduction-lifecycle-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';

const rt = createIntroductionRuntime(process.env.DATABASE_URL);
const { q, rows, asRole, rejected } = rt;

const FN = Object.freeze({
  LIST: 'public.list_my_introduction_worlds_v1()',
  READ: 'public.read_my_introduction_messages_v1(uuid,timestamptz,uuid,integer)',
  SEND: 'public.send_my_introduction_text_v1(uuid,uuid,text)',
});
const BOUNDARIES = Object.values(FN);
/** The frozen cores 0160 composes: name -> the migration whose LAST definition must still be the live body. */
const FROZEN = {
  commit_shared_world_human_text_v1: '0090_shared_world_material_commit_owner_deletion_v1.sql',
  commit_shared_world_human_material_v1: '0118_introduction_ordinary_shared_material_v1.sql',
  resolve_shared_world_material_v1: '0089_shared_world_material_persistence_v1.sql',
  delete_own_shared_world_material_v1: '0139_shared_world_conversation_material_v1.sql',
  end_own_introduction_v1: '0155_introduction_privacy_isolation_end_boundary_v1.sql',
};
const HIDDEN = ['public.commit_shared_world_human_text_v1(uuid,uuid,uuid,uuid,text)',
  'public.commit_shared_world_human_material_v1(uuid,uuid,uuid,uuid,text,text,text,text,integer)',
  'shared_private.derive_shared_conversation_identity_v1(text,uuid)', 'shared_private.shared_person_name_v1(uuid,uuid,uuid)'];
const SENT = ['COMMITTED', 'ENDED', 'UNAVAILABLE', 'COMMAND_CONFLICT'];
const nameOf = (fn) => fn.slice(fn.indexOf('.') + 1, fn.indexOf('('));
const MIGRATIONS = new URL('./migrations/', import.meta.url);
const M0160 = '0160_introduction_world_human_messaging_v1.sql';

// ------------------------------------------------------------------ helpers
/** The Stage 4 (0139) identity derivation, recomputed independently: the send reuses it, so a retry is the same message. */
function derive(namespace, command) {
  const h = createHash('sha256').update(['QANDEEL_S4_02_SHARED_CONVERSATION_IDENTITY_V1', namespace, command.toLowerCase()].join('\n'), 'utf8').digest('hex');
  const x = `${h.slice(0, 12)}4${h.slice(13, 16)}8${h.slice(17, 20)}${h.slice(20, 32)}`;
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
/** The body of the LAST `CREATE [OR REPLACE] FUNCTION public.<name>(` in the named migration, CR-free. */
function definingBody(file, name) {
  const text = readFileSync(new URL(file, MIGRATIONS), 'utf8').replace(/\r\n/gu, '\n');
  let found = null;
  for (const match of text.matchAll(new RegExp(String.raw`CREATE (?:OR REPLACE )?FUNCTION public\.${name}\(`, 'gu'))) {
    const tail = text.slice(match.index);
    const open = /\bAS\s+(\$[A-Za-z_]*\$)/u.exec(tail);
    const start = open.index + open[0].length;
    found = tail.slice(start, tail.indexOf(open[1], start));
  }
  assert.ok(found, `${file} defines public.${name}`);
  return found;
}
const as = (uid) => asRole('authenticated', uid);
const owner = () => asRole('postgres');
const count = async (sql, values = []) => { await owner(); return Number((await rows(sql, values))[0].n); };
async function facts(pairs) {
  for (const [human, sex, firstName] of pairs) await rt.recordFacts(human, { sex, firstName });
}

// ---- the three boundaries, called exactly as the client calls them
async function listOf(uid) {
  await as(uid);
  try { return await rows('SELECT * FROM public.list_my_introduction_worlds_v1()'); } finally { await owner(); }
}
async function readOf(uid, world, before = null, limit = 50) {
  await as(uid);
  try {
    return await rows(`SELECT introduction_state, material_id, established_at::text AS established_at, is_self, text_body
                         FROM public.read_my_introduction_messages_v1($1, $2, $3, $4)`, [world, before?.at ?? null, before?.id ?? null, limit]);
  } finally { await owner(); }
}
async function sendOf(uid, world, text, command = randomUUID()) {
  await as(uid);
  try {
    const [answer] = await rows('SELECT * FROM public.send_my_introduction_text_v1($1, $2, $3)', [command, world, text]);
    assert.deepEqual(Object.keys(answer), ['outcome', 'material_id', 'established_at'], 'the send answers exactly { outcome, material_id, established_at }');
    assert.ok(SENT.includes(answer.outcome), `the send answers one fixed word, not ${answer.outcome}`);
    if (answer.outcome !== 'COMMITTED') assert.deepEqual([answer.material_id, answer.established_at], [null, null], 'only COMMITTED names a message');
    return { ...answer, command };
  } finally { await owner(); }
}
async function endAs(uid, world) {
  await as(uid);
  try { return (await rows('SELECT * FROM public.end_own_introduction_v1($1, $2)', [randomUUID(), world]))[0].outcome; } finally { await owner(); }
}
async function deleteOwn(uid, world, material) {
  await as(uid);
  try { return (await rows('SELECT * FROM public.delete_own_shared_world_material_v1($1, $2, $3)', [randomUUID(), world, material]))[0].outcome; } finally { await owner(); }
}
const messages = (page) => page.filter((r) => r.material_id !== null).map((r) => [r.is_self, r.text_body]);
/** Everything a send could write about one World. */
async function footprint(world) {
  return {
    commands: await count('SELECT count(*) n FROM public.shared_world_material_commit_commands WHERE world_id = $1', [world]),
    materials: await count('SELECT count(*) n FROM public.shared_world_materials WHERE world_id = $1', [world]),
    items: await count('SELECT count(*) n FROM public.shared_world_history_items WHERE world_id = $1', [world]),
    leases: await count('SELECT count(*) n FROM shared_private.shared_qandeel_reply_work_leases WHERE world_id = $1', [world]),
  };
}
async function introduction(first, candidate) {
  await facts([[first, 'FEMALE', 'Mona'], [candidate, 'MALE', 'Omar']]);
  const f = await rt.bringToIntroduction(first, candidate);
  await owner();
  return f;
}

// ------------------------------------------------------------------ A. posture
async function verifyPosture(report) {
  await report.section('A01 three authenticated-only boundaries, postgres-owned, DEFINER, pinned; every frozen core they compose still closed', async () => {
    for (const fn of BOUNDARIES) {
      const p = await rt.functionPosture(fn);
      assert.equal(p.owner, 'postgres', `A01 ${fn} is postgres-owned`);
      assert.equal(p.secdef, true, `A01 ${fn} is SECURITY DEFINER`);
      assert.deepEqual(p.config, ['search_path=""'], `A01 ${fn} pins an empty search_path`);
      assert.equal(await rt.canExecute('authenticated', fn), true, `A01 authenticated executes ${fn}`);
      for (const role of ['public', 'anon', 'service_role']) assert.equal(await rt.canExecute(role, fn), false, `A01 ${role} must not execute ${fn}`);
      const [{ n }] = await rows(`SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
        WHERE s.nspname = 'public' AND p.proname = $1`, [nameOf(fn)]);
      assert.equal(n, 1, `A01 ${fn} has no overload`);
    }
    for (const fn of HIDDEN) {
      for (const role of ['public', ...APP_ROLES]) assert.equal(await rt.canExecute(role, fn), false, `A01 ${role} must not execute ${fn}`);
    }
  });

  await report.section('A02 exactly the client\'s inputs; the human is auth.uid(); human words only, and no lock before the membership answer', async () => {
    assert.deepEqual(await rt.inputParameters(FN.LIST), []);
    assert.deepEqual(await rt.resultColumns(FN.LIST), ['world_id', 'matching_proposal_id', 'introduction_state', 'other_first_name']);
    assert.deepEqual(await rt.inputParameters(FN.READ), ['p_world_id', 'p_before_established_at', 'p_before_material_id', 'p_limit']);
    assert.deepEqual(await rt.resultColumns(FN.READ), ['introduction_state', 'material_id', 'established_at', 'is_self', 'text_body']);
    assert.deepEqual(await rt.inputParameters(FN.SEND), ['p_command_id', 'p_world_id', 'p_content']);
    assert.deepEqual(await rt.resultColumns(FN.SEND), ['outcome', 'material_id', 'established_at']);
    for (const fn of BOUNDARIES) {
      const src = (await rt.functionPosture(fn)).prosrc.replace(/--[^\n]*/gu, '');
      assert.match(src, /v_user uuid := \(SELECT auth\.uid\(\)\);/u, `A02 ${fn} derives the human from auth.uid()`);
      assert.match(src, /v_user IN \(r\.lower_user_id, r\.higher_user_id\)/u, `A02 ${fn} decides membership from the Introduction Record`);
      assert.doesNotMatch(src, /qandeel|semantic|analysis|activity|alert|launch_gate|_capability|public\.users|context_grant|personal|memory/iu,
        `A02 ${fn} reaches no reply, weaving, analysis, Activity, gate, account Name, grant or Personal Context`);
      assert.doesNotMatch(src, /INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM|EXECUTE\s|RAISE;|ISOLATION/iu, `A02 ${fn} writes nothing itself`);
    }
    const send = (await rt.functionPosture(FN.SEND)).prosrc.replace(/--[^\n]*/gu, '');
    assert.equal(send.split('public.commit_shared_world_human_text_v1(').length - 1, 1, 'A02 the frozen human text core, exactly once');
    assert.ok(send.indexOf('v_user IN (r.lower_user_id, r.higher_user_id)') < send.indexOf('FOR UPDATE'), 'A02 a non-member is answered before any lock');
    assert.ok(send.indexOf('FOR UPDATE') < send.indexOf('public.commit_shared_world_human_text_v1('), 'A02 the World row is locked before the core');
    for (const namespace of ["'INTRODUCTION_HUMAN_TEXT_MATERIAL'", "'INTRODUCTION_HUMAN_TEXT_HISTORY_ITEM'"]) {
      assert.ok(send.includes(`shared_private.derive_shared_conversation_identity_v1(${namespace}, p_command_id)`), `A02 the Introduction-only ${namespace} derivation`);
    }
    const read = (await rt.functionPosture(FN.READ)).prosrc.replace(/--[^\n]*/gu, '');
    assert.match(read, /public\.resolve_shared_world_material_v1\(p_world_id, v_user\)/u, 'A02 the frozen material resolver decides visibility');
    assert.match(read, /m\.material_kind = 'HUMAN_TEXT'/u, 'A02 human words only');
    const list = (await rt.functionPosture(FN.LIST)).prosrc.replace(/--[^\n]*/gu, '');
    assert.match(list, /shared_private\.shared_person_name_v1\(/u, 'A02 the name is the S6-02 projection, never the account Name');
  });

  await report.section('A03 every frozen boundary 0160 composes is its defining body (the whole files are pinned by the static contract); 0160 creates exactly its three functions', async () => {
    for (const [name, file] of Object.entries(FROZEN)) {
      const [{ prosrc }] = await rows(`SELECT p.prosrc FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
        WHERE s.nspname = 'public' AND p.proname = $1`, [name]);
      assert.equal(prosrc.replace(/\r\n/gu, '\n'), definingBody(file, name), `A03 ${name} is the ${file} body byte for byte`);
    }
    const text = readFileSync(new URL(M0160, MIGRATIONS), 'utf8');
    assert.deepEqual([...text.matchAll(/CREATE (?:OR REPLACE )?FUNCTION ([a-z_.0-9]+)\(/gu)].map((m) => m[1]).sort(), BOUNDARIES.map((fn) => fn.slice(0, fn.indexOf('('))).sort(),
      'A03 0160 creates its three functions and replaces nothing');
    assert.doesNotMatch(text, /CREATE OR REPLACE|ALTER TABLE|CREATE TABLE|DROP |CREATE TRIGGER|CREATE POLICY/u, 'A03 no existing object is replaced or altered');
  });
}

// ------------------------------------------------------------------ B .. E, inside one rolled-back transaction
async function verifyBehaviour(report, H) {
  const [first, a, b, outsider] = H;
  await owner();
  await q('BEGIN');
  try {
    await report.isolated('B01 after the REAL acceptance both humans find the one World - the first recipient included - and nobody else does', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
      const f = await rt.bringToForwarded(first, a);
      await as(a);
      const [accepted] = await rows('SELECT * FROM public.accept_my_matching_proposal_v1($1, $2, $3)', [randomUUID(), f.proposal, f.secondView]);
      await owner();
      assert.equal(accepted.outcome, 'MATCHED', 'B01 the CP2 acceptance bore the World');
      const world = accepted.introduction_world_id;
      assert.deepEqual(await listOf(first), [{ world_id: world, matching_proposal_id: f.proposal, introduction_state: 'ACTIVE', other_first_name: 'Omar' }],
        'B01 the first recipient arrives into the World that already exists');
      assert.deepEqual(await listOf(a), [{ world_id: world, matching_proposal_id: f.proposal, introduction_state: 'ACTIVE', other_first_name: 'Mona' }],
        'B01 the accepting human finds it the same way');
      for (const human of [b, outsider]) assert.deepEqual(await listOf(human), [], 'B01 nobody else finds anything');
      await as(first);
      assert.ok((await rows('SELECT * FROM public.list_own_shared_worlds_v1()')).every((w) => w.world_id !== world), 'B01 the S6-02 fence: no Stage 4 list holds it');
      await owner();
    });

    await report.isolated('B02 anonymous and claim-less callers are refused; a human with no Introduction lists nothing', async () => {
      assert.deepEqual(await listOf(b), []);
      await asRole('anon');
      for (const sql of ['SELECT * FROM public.list_my_introduction_worlds_v1()',
        'SELECT * FROM public.read_my_introduction_messages_v1(gen_random_uuid(), NULL, NULL, 10)',
        "SELECT * FROM public.send_my_introduction_text_v1(gen_random_uuid(), gen_random_uuid(), 'x')"]) {
        await rejected(() => q(sql), ['42501'], /permission denied/u);
      }
      await asRole('authenticated');
      for (const sql of ['SELECT * FROM public.list_my_introduction_worlds_v1()',
        'SELECT * FROM public.read_my_introduction_messages_v1(gen_random_uuid(), NULL, NULL, 10)',
        "SELECT * FROM public.send_my_introduction_text_v1(gen_random_uuid(), gen_random_uuid(), 'x')"]) {
        await rejected(() => q(sql), ['42501'], /INTRODUCTION_AUTHENTICATION_REQUIRED/u);
      }
      await owner();
    });

    await report.isolated('C01 the two humans read each other\'s words, newest first, by keyset page; an empty page is one ACTIVE row', async () => {
      const f = await introduction(first, a);
      assert.deepEqual(await readOf(first, f.world), [{ introduction_state: 'ACTIVE', material_id: null, established_at: null, is_self: null, text_body: null }],
        'C01 an empty Introduction is one ACTIVE row with no message');
      const one = await sendOf(first, f.world, 'one');
      const two = await sendOf(a, f.world, 'two');
      const three = await sendOf(first, f.world, 'three');
      for (const sent of [one, two, three]) assert.equal(sent.outcome, 'COMMITTED');
      const all = await readOf(first, f.world);
      assert.ok(all.every((r) => r.introduction_state === 'ACTIVE'), 'C01 every row carries the state');
      const newest = (await rows(`SELECT m.id::text id FROM public.shared_world_materials m WHERE m.world_id = $1
                                    ORDER BY m.established_at DESC, m.id DESC`, [f.world])).map((r) => r.id);
      assert.deepEqual(all.map((r) => r.material_id), newest, 'C01 newest first, by (instant, id)');
      assert.deepEqual(new Set(messages(all).map(([, text]) => text)), new Set(['one', 'two', 'three']));
      assert.deepEqual(messages(await readOf(a, f.world)).map(([self, text]) => `${self}:${text}`).sort(),
        ['false:one', 'false:three', 'true:two'], 'C01 the other human reads the same words, each marked as theirs or not');
      const [page1] = await readOf(first, f.world, null, 1);
      const rest = await readOf(first, f.world, { at: page1.established_at, id: page1.material_id }, 50);
      assert.deepEqual([page1, ...rest].map((r) => r.material_id), newest, 'C01 the keyset page continues exactly where the first ended');
      const last = rest.at(-1);
      assert.deepEqual(await readOf(first, f.world, { at: last.established_at, id: last.material_id }, 50),
        [{ introduction_state: 'ACTIVE', material_id: null, established_at: null, is_self: null, text_body: null }], 'C01 past the oldest: one empty ACTIVE row');
    });

    await report.isolated('C02 an outsider - even one in another Introduction -, an unknown World and an invalid request read nothing', async () => {
      const f = await introduction(first, a);
      const g = await introduction(outsider, b);
      await sendOf(first, f.world, 'private to the two of them');
      for (const human of [b, outsider]) {
        assert.deepEqual(await readOf(human, f.world), [], 'C02 not one of the two humans: no row');
        assert.equal((await sendOf(human, f.world, 'from another Introduction')).outcome, 'UNAVAILABLE', 'C02 nor a message');
        assert.deepEqual((await listOf(human)).map((w) => w.world_id), [g.world], 'C02 their own Introduction, and only it');
      }
      assert.deepEqual(await readOf(first, randomUUID()), [], 'C02 an unknown World: the same no row');
      await as(first);
      for (const args of [[null, null, null, 10], [f.world, null, null, 0], [f.world, null, null, 201], [f.world, null, null, null],
        [f.world, '2026-10-16T00:00:00Z', null, 10], [f.world, null, randomUUID(), 10]]) {
        await rejected(() => q('SELECT * FROM public.read_my_introduction_messages_v1($1, $2, $3, $4)', args), ['22023'], /INTRODUCTION_MESSAGE_READ_INVALID/u);
      }
      await owner();
    });

    await report.isolated('C03 only human words are messages: a disclosure in the same World is not one', async () => {
      const f = await introduction(first, a);
      const { answer } = await rt.discloseAs(first, f.world, 'FULL_NAME', { text: 'Mona Disclosed Fullname' });
      assert.ok(answer, 'C03 a real EXPLICIT_DISCLOSURE was committed into the same history');
      await sendOf(a, f.world, 'hello');
      for (const human of [first, a]) {
        const page = await readOf(human, f.world);
        assert.deepEqual(messages(page).map(([, text]) => text), ['hello'], 'C03 the message, and nothing of the disclosure');
        assert.ok(!JSON.stringify(page).includes('Mona Disclosed Fullname'), 'C03 the disclosed value never appears');
      }
    });

    await report.isolated('D01 COMMITTED under the Introduction-only derivation, visible to exactly the two; no reply, no QANDEEL, no Activity, no grant moved', async () => {
      const f = await introduction(first, a);
      const grants = await count('SELECT count(*) n FROM public.matching_context_grants WHERE grantor_user_id = ANY($1::uuid[])', [[first, a]]);
      const sent = await sendOf(a, f.world, 'Hello Mona');
      assert.equal(sent.outcome, 'COMMITTED');
      assert.equal(sent.material_id, derive('INTRODUCTION_HUMAN_TEXT_MATERIAL', sent.command), 'D01 the material identity is the Introduction-only derivation, never a Stage 4 message identity');
      const material = await rt.materialRow(sent.material_id);
      assert.deepEqual([material.world_id, material.material_kind, material.producer_kind, material.author_user_id, material.history_item_id],
        [f.world, 'HUMAN_TEXT', 'HUMAN', a, derive('INTRODUCTION_HUMAN_TEXT_HISTORY_ITEM', sent.command)], 'D01 one human text by the sender, in this World');
      assert.deepEqual((await rt.baselineViewersOf(material.history_item_id)).sort(), [first, a].sort(), 'D01 exactly the two humans see it');
      assert.deepEqual(await footprint(f.world), { commands: 1, materials: 1, items: 1, leases: 0 }, 'D01 one message, and no QANDEEL reply work');
      assert.equal(await count(`SELECT count(*) n FROM public.shared_world_materials WHERE world_id = $1 AND producer_kind = 'QANDEEL'`, [f.world]), 0,
        'D01 no QANDEEL material: no reply, no weaving, no analysis');
      await asRole('service_role');
      assert.deepEqual(await rows('SELECT * FROM public.server_read_shared_activity_source_v1($1, $2)', ['HUMAN_TEXT', sent.material_id]), [],
        'D01 no Activity source row (R-7)');
      await owner();
      assert.equal(await count('SELECT count(*) n FROM public.matching_context_grants WHERE grantor_user_id = ANY($1::uuid[])', [[first, a]]), grants,
        'D01 no Matching Context Grant is created, copied or moved');
      assert.equal(await count('SELECT count(*) n FROM public.shared_world_standing_context_grants WHERE world_id = $1', [f.world]), 0,
        'D01 no Shared standing grant');
      assert.ok(!JSON.stringify(sent).includes(first), 'D01 the answer names nobody');
    });

    await report.isolated('D02 a retry is the same message; a reused command id is COMMAND_CONFLICT and writes nothing', async () => {
      const f = await introduction(first, a);
      const sent = await sendOf(a, f.world, 'once');
      const again = await sendOf(a, f.world, 'once', sent.command);
      assert.deepEqual([again.outcome, again.material_id, String(again.established_at)], ['COMMITTED', sent.material_id, String(sent.established_at)],
        'D02 the retry answers the committed message');
      const before = await footprint(f.world);
      assert.equal((await sendOf(a, f.world, 'different words', sent.command)).outcome, 'COMMAND_CONFLICT', 'D02 the same command, other words');
      assert.equal((await sendOf(first, f.world, 'once', sent.command)).outcome, 'COMMAND_CONFLICT', 'D02 the same command, the other human');
      assert.deepEqual(await footprint(f.world), before, 'D02 nothing written');
    });

    await report.isolated('D03 an outsider, an unknown World and malformed requests change nothing', async () => {
      const f = await introduction(first, a);
      const before = await footprint(f.world);
      for (const human of [b, outsider]) assert.equal((await sendOf(human, f.world, 'let me in')).outcome, 'UNAVAILABLE', 'D03 not one of the two humans');
      assert.equal((await sendOf(first, randomUUID(), 'nowhere')).outcome, 'UNAVAILABLE', 'D03 an unknown World is the same answer');
      assert.deepEqual(await footprint(f.world), before, 'D03 nothing written');
      await as(first);
      for (const args of [[null, f.world, 'x'], [randomUUID(), null, 'x'], [randomUUID(), f.world, null], [randomUUID(), f.world, ''],
        [randomUUID(), f.world, '   '], [randomUUID(), f.world, 'x'.repeat(20001)]]) {
        await rejected(() => q('SELECT * FROM public.send_my_introduction_text_v1($1, $2, $3)', args), ['22023'], /INTRODUCTION_MESSAGE_COMMAND_INVALID/u);
      }
      await owner();
      assert.equal((await sendOf(first, f.world, 'x'.repeat(20000))).outcome, 'COMMITTED', 'D03 the bound itself is accepted');
    });

    await report.isolated('D04 the S6-02 fence still refuses every Stage 4 path into the Introduction World', async () => {
      const f = await introduction(first, a);
      const sent = await sendOf(first, f.world, 'through the Introduction boundary');
      await as(first);
      const [stage4] = await rows('SELECT * FROM public.send_shared_world_human_text_v1($1, $2, $3)', [randomUUID(), f.world, 'through Stage 4']);
      assert.equal(stage4.outcome, 'UNAVAILABLE', 'D04 the Stage 4 send is still refused');
      assert.deepEqual(await rows('SELECT * FROM public.list_own_shared_world_material_v1($1, NULL, NULL, 50)', [f.world]), [], 'D04 the Stage 4 read is still empty');
      assert.equal((await rows('SELECT * FROM public.resolve_own_shared_world_entry_v1($1)', [f.world]))[0].outcome, 'UNAVAILABLE', 'D04 no Stage 4 entry');
      await asRole('service_role');
      const [work] = await rows('SELECT * FROM public.begin_shared_qandeel_reply_work_v1($1, $2, $3)', [sent.command, f.world, first]);
      assert.equal(work.work_outcome, 'UNAVAILABLE', 'D04 no QANDEEL reply work starts for an Introduction message');
      await owner();
      assert.deepEqual(await footprint(f.world), { commands: 1, materials: 1, items: 1, leases: 0 });
    });

    await report.isolated('E01 after END: ENDED to the two humans only (list, read, send); a retry of an earlier message is still that message', async () => {
      const f = await introduction(first, a);
      const before = await sendOf(first, f.world, 'said before the end');
      assert.equal(await endAs(a, f.world), 'ENDED', 'E01 S6-02 END, unchanged');
      for (const [human, other] of [[first, 'Omar'], [a, 'Mona']]) {
        assert.deepEqual(await listOf(human), [{ world_id: f.world, matching_proposal_id: f.proposal, introduction_state: 'ENDED', other_first_name: other }],
          'E01 the member sees ENDED');
        assert.deepEqual(await readOf(human, f.world), [{ introduction_state: 'ENDED', material_id: null, established_at: null, is_self: null, text_body: null }],
          'E01 the read is one ENDED row and no message (the closed history is CP4)');
      }
      const written = await footprint(f.world);
      for (const human of [first, a]) assert.equal((await sendOf(human, f.world, 'after the end')).outcome, 'ENDED', 'E01 a member\'s send is ENDED');
      for (const human of [b, outsider]) {
        assert.deepEqual(await listOf(human), [], 'E01 an outsider lists nothing');
        assert.deepEqual(await readOf(human, f.world), [], 'E01 an outsider reads nothing: not even that it ended');
        assert.equal((await sendOf(human, f.world, 'after the end')).outcome, 'UNAVAILABLE', 'E01 an outsider is never told it ended');
      }
      assert.deepEqual(await footprint(f.world), written, 'E01 nothing written after END');
      const retry = await sendOf(first, f.world, 'said before the end', before.command);
      assert.deepEqual([retry.outcome, retry.material_id], ['COMMITTED', before.material_id], 'E01 the retry is the committed message, not ENDED');
    });

    await report.isolated('E02 the owner deletes their own message through the existing route (R-5), before and after END; nobody else can', async () => {
      const f = await introduction(first, a);
      const mine = await sendOf(first, f.world, 'mine, to delete');
      const kept = await sendOf(first, f.world, 'mine, deleted after the end');
      const theirs = await sendOf(a, f.world, 'theirs');
      assert.equal(await deleteOwn(a, f.world, mine.material_id), 'UNAVAILABLE', 'E02 not the other human');
      assert.equal(await deleteOwn(outsider, f.world, mine.material_id), 'UNAVAILABLE', 'E02 not an outsider');
      assert.equal(await deleteOwn(first, f.world, mine.material_id), 'DELETED', 'E02 the author, in the ACTIVE Introduction');
      for (const human of [first, a]) {
        assert.deepEqual(new Set(messages(await readOf(human, f.world)).map(([, text]) => text)), new Set(['mine, deleted after the end', 'theirs']),
          'E02 a deleted message is gone for both');
      }
      assert.equal(await deleteOwn(first, f.world, theirs.material_id), 'UNAVAILABLE', 'E02 never another\'s message');
      assert.equal(await endAs(first, f.world), 'ENDED');
      assert.equal(await deleteOwn(first, f.world, kept.material_id), 'DELETED', 'E02 the author still deletes after END');
      assert.equal((await rt.itemRow(derive('INTRODUCTION_HUMAN_TEXT_HISTORY_ITEM', kept.command))).availability_state, 'DELETED_BY_OWNER');
    });

    await report.isolated('E03 after SUCCESS the World is Standard: no longer an Introduction here, nothing is sent into it, and an Introduction command never becomes a Stage 4 message', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
      const f = await rt.bringToSuccessApproved(first, a);
      await owner();
      const said = await sendOf(a, f.world, 'said during the Introduction');
      await rt.commitSuccess(terminalIds(), f.version);
      const [w] = await rows('SELECT lifecycle, phase FROM public.shared_worlds WHERE id = $1', [f.world]);
      assert.deepEqual(w, { lifecycle: 'ACTIVE', phase: 'STANDARD' }, 'E03 SUCCESS continued the World as Standard');
      const before = await footprint(f.world);
      const again = await sendOf(a, f.world, 'said during the Introduction', said.command);
      assert.deepEqual([again.outcome, again.material_id], ['COMMITTED', said.material_id], 'E03 a retry is still the Introduction message it was');
      // The same command id through the Stage 4 send, which starts a QANDEEL reply, weaving and Activity on a COMMITTED
      // answer: the Introduction-only identities make it the core's command conflict, never a Stage 4 message.
      await as(a);
      await rejected(() => q('SELECT * FROM public.send_shared_world_human_text_v1($1, $2, $3)', [said.command, f.world, 'said during the Introduction']),
        ['23505'], /SHARED_WORLD_MATERIAL_COMMAND_ID_CONFLICT/u);
      await owner();
      for (const human of [first, a]) {
        assert.deepEqual(await listOf(human), [], 'E03 not an Introduction any more');
        assert.deepEqual(await readOf(human, f.world), [], 'E03 nothing read here');
        assert.equal((await sendOf(human, f.world, 'into the Standard World')).outcome, 'UNAVAILABLE', 'E03 the Stage 4 send owns it now');
      }
      assert.deepEqual(await footprint(f.world), before, 'E03 nothing written');
    });
  } finally {
    await q('ROLLBACK');
    await owner();
  }
}

// ------------------------------------------------------------------ G. races on two real connections
async function verifyRaces(report, H) {
  const [one, two] = H;
  const sendSql = (command, world, text) => ({ sql: 'SELECT * FROM public.send_my_introduction_text_v1($1, $2, $3)', values: [command, world, text] });
  const endSql = (world) => ({ sql: 'SELECT * FROM public.end_own_introduction_v1($1, $2)', values: [randomUUID(), world] });
  /** The primary runs `mine` as `mineAs` inside an open transaction; the extra connection runs `theirs` and must wait on it. */
  async function contend(label, { mineAs, mine, theirsAs, theirs }) {
    const extra = await rt.openExtra();
    try {
      await q('BEGIN');
      let first;
      if (mineAs) {
        await as(mineAs);
        [first] = await rows(mine.sql, mine.values);
        await owner();
      } else {
        first = await mine();
      }
      await extra.qx('BEGIN');
      await extra.qx('SET LOCAL ROLE authenticated');
      await extra.qx("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: theirsAs, role: 'authenticated' })]);
      const pending = extra.qx(theirs.sql, theirs.values).then((r) => r.rows[0], (error) => error);
      assert.equal(await rt.waitForLockWait((t, v) => q(t, v), extra.pid), true, `${label}: the second attempt is in a lock wait`);
      await q('COMMIT');
      const late = await pending;
      await extra.qx('COMMIT');
      assert.ok(!(late instanceof Error), `${label}: the waiting attempt is answered, not failed: ${late?.code ?? ''} ${late?.message ?? ''}`);
      return { first, late };
    } finally {
      await q('ROLLBACK').catch(() => undefined);
      await owner();
      await extra.close();
    }
  }
  const race = (name, body) => report.section(name, async () => {
    try { await body(); } finally {
      await owner();
      await rt.cleanupIntroductionRace([one, two]);
    }
  });

  await race('G01 the message first, END waiting: the message commits and END freezes it into both closed views', async () => {
    const f = await introduction(one, two);
    const command = randomUUID();
    const { first, late } = await contend('G01', { mineAs: one, mine: sendSql(command, f.world, 'just in time'), theirsAs: two, theirs: endSql(f.world) });
    assert.deepEqual([first.outcome, late.outcome], ['COMMITTED', 'ENDED']);
    const item = derive('INTRODUCTION_HUMAN_TEXT_HISTORY_ITEM', command);
    for (const human of [one, two]) assert.ok((await rt.entitlementItemsOf(f.world, human)).includes(item), 'G01 END\'s closed-view snapshot holds the message');
  });

  await race('G02 END first, the message waiting: ENDED, and nothing is written', async () => {
    const f = await introduction(one, two);
    const { first, late } = await contend('G02', { mineAs: one, mine: endSql(f.world), theirsAs: two, theirs: sendSql(randomUUID(), f.world, 'too late') });
    assert.deepEqual([first.outcome, late.outcome], ['ENDED', 'ENDED']);
    assert.deepEqual(await footprint(f.world), { commands: 0, materials: 0, items: 0, leases: 0 }, 'G02 nothing written');
  });

  await race('G03 the same command twice at once: one message, and both answers name it', async () => {
    const f = await introduction(one, two);
    const command = randomUUID();
    const { first, late } = await contend('G03', { mineAs: one, mine: sendSql(command, f.world, 'once'), theirsAs: one, theirs: sendSql(command, f.world, 'once') });
    assert.deepEqual([first.outcome, late.outcome], ['COMMITTED', 'COMMITTED']);
    assert.equal(late.material_id, first.material_id, 'G03 the same message');
    assert.deepEqual(await footprint(f.world), { commands: 1, materials: 1, items: 1, leases: 0 }, 'G03 exactly one');
  });

  await race('G04 SUCCESS first, the message waiting: never a message in the now-Standard World through this path', async () => {
    await facts([[one, 'FEMALE', 'Mona'], [two, 'MALE', 'Omar']]);
    const f = await rt.bringToSuccessApproved(one, two);
    await owner();
    const { late } = await contend('G04', {
      mine: async () => { await owner(); return (await rt.commitSuccess(terminalIds(), f.version))[0]; },
      theirsAs: two, theirs: sendSql(randomUUID(), f.world, 'during SUCCESS'),
    });
    assert.equal(late.outcome, 'UNAVAILABLE', 'G04 the waiting message is refused under the lock');
    const [w] = await rows('SELECT lifecycle, phase FROM public.shared_worlds WHERE id = $1', [f.world]);
    assert.deepEqual(w, { lifecycle: 'ACTIVE', phase: 'STANDARD' });
    assert.deepEqual(await footprint(f.world), { commands: 0, materials: 0, items: 0, leases: 0 }, 'G04 nothing written');
  });
}

// ------------------------------------------------------------------ the run
const humans = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const raceHumans = [randomUUID(), randomUUID()];
await runVerifier('0160', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '60s'");
  setStage('fixtures');
  await rt.provisionHumans([...humans, ...raceHumans]);
  const report = createScenarioReport('0160', { query: q, restore: () => owner() });

  setStage('posture');
  await verifyPosture(report);

  const seams = [];
  for (const fn of [PFN.PREREQUISITES, DFN.DISCLOSURE_GATE, DFN.SUCCESS_GATE, DFN.REACTIVATION_GATE]) seams.push(await rt.captureMatchingSeam(fn));
  try {
    await rt.clearProposalPrerequisites();
    await rt.clearAllSeams();
    setStage('behaviour');
    await verifyBehaviour(report, humans);
    setStage('races');
    await verifyRaces(report, raceHumans);
  } finally {
    await owner();
    for (const seam of seams) await rt.restoreMatchingSeam(seam);
  }
  report.print();
  report.assertAllPassed();

  setStage('teardown');
  for (const seam of [PFN.PREREQUISITES, DFN.DISCLOSURE_GATE, DFN.SUCCESS_GATE, DFN.REACTIVATION_GATE]) {
    assert.equal(await rt.seamClearance(seam.slice(0, seam.indexOf('('))), 'NOT_EVALUATED', `${seam} is fail-closed again`);
  }
  await rt.cleanupIntroductionRace([...humans, ...raceHumans]);
  await rt.removeFixtureHumans([...humans, ...raceHumans]);
  const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
      + (SELECT count(*) FROM public.introduction_records WHERE lower_user_id = ANY($1::uuid[]) OR higher_user_id = ANY($1::uuid[])) AS residue`,
  [[...humans, ...raceHumans]]);
  assert.equal(Number(residue), 0, 'the run leaves nothing behind');
}, () => rt.client.end().catch(() => undefined));
