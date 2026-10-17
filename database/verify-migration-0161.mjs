// S6-05 / migration 0161 - real-PostgreSQL proof of END and the closed Introduction history (CP4).
//
//   A  posture: one authenticated-only STABLE reader, postgres-owned, DEFINER, pinned; the frozen authority it composes
//      (the material resolver, the one historical entry point, the closed resolver, END, owner deletion, the CP3
//      boundaries, the Stage 4 closed readers) byte-identical to its defining migrations; exactly the client's inputs;
//      the caller's own entitlement decided before any history is read; no membership, reply, analysis, Activity, gate,
//      account Name, grant or Personal Context; 0161 creates exactly its one function
//   B  END, reused unchanged: either human ends alone, with no consent of the other and the CW2-08 seam fail-closed; a
//      retry is the same END; the other human is ALREADY_SETTLED; a reused id, an outsider and an unknown World are
//      UNAVAILABLE; exactly one terminal outcome and exactly two frozen entitlements
//   C  the closed history: each human reads, by keyset page, exactly what their own frozen entitlement holds; the two
//      entitlements are independent; a row written after closure never widens one; an outsider, a member of another
//      Introduction, an unknown World, a live Introduction and a World SUCCESS made Standard read nothing; only human
//      words are messages
//   D  owner deletion, reused unchanged (R-5): the author finds their own message ids in the history and deletes them
//      after END; the message is gone for BOTH and never comes back; nobody deletes another's words; a message deleted
//      before END never enters either history
//   E  after END: no send, no re-opening, no Stage 4 path; no reply, QANDEEL material, Activity or Push; no
//      entitlement, item or grant is created or widened by reading or deleting
//   G  races, on two real connections: END against END (one ENDED, one ALREADY_SETTLED); the same END twice at once;
//      deletion against END in both orders (the message is gone from both histories either way)
//
// In-transaction scenarios run in their own SAVEPOINT inside one transaction that is rolled back, with the CW2-08 and
// I-07D seams replaced for the run and restored byte for byte. The races commit their fixtures and remove them.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { APP_ROLES, D, DFN, PFN, createIntroductionRuntime, runVerifier, terminalIds } from './introduction-lifecycle-verifier-support.mjs';
import { createScenarioReport } from './verifier-scenarios.mjs';

const rt = createIntroductionRuntime(process.env.DATABASE_URL);
const { q, rows, asRole, rejected } = rt;

const HISTORY = 'public.read_my_introduction_history_v1(uuid,timestamptz,uuid,integer)';
const CLOSED_RESOLVER = 'public.resolve_shared_world_closed_history_visibility_v1(uuid,uuid)';
/** The frozen authority 0161 composes or leaves beside it: [schema, name] -> the migration whose LAST definition must be live. */
const FROZEN = [
  ['public', 'resolve_shared_world_material_v1', '0089_shared_world_material_persistence_v1.sql'],
  ['public', 'resolve_shared_world_history_visibility_v1', '0119_shared_historical_authority_remediation_v1.sql'],
  // RE-ANCHORED by ACCT-DEL-01 (Product Owner decisions P-2 / P-4, migration 0164): the closed resolver's Introduction
  // branch, the CP3 discovery and the CP3 live read accept the counterpart's retained view after the other human's
  // account erasure. 0164 is now their defining migration; the pin is as strict as before, byte for byte.
  ['public', 'resolve_shared_world_closed_history_visibility_v1', '0164_account_deletion_matching_introductions_v1.sql'],
  ['public', 'commit_introduction_end_v1', '0116_introduction_terminal_lifecycle_v1.sql'],
  ['public', 'end_own_introduction_v1', '0155_introduction_privacy_isolation_end_boundary_v1.sql'],
  ['public', 'delete_own_shared_world_material_v1', '0139_shared_world_conversation_material_v1.sql'],
  ['public', 'delete_shared_world_owned_material_v1', '0143_public_authoring_rights_privacy_v1.sql'],
  ['public', 'list_my_introduction_worlds_v1', '0164_account_deletion_matching_introductions_v1.sql'],
  ['public', 'read_my_introduction_messages_v1', '0164_account_deletion_matching_introductions_v1.sql'],
  ['public', 'send_my_introduction_text_v1', '0160_introduction_world_human_messaging_v1.sql'],
  ['shared_private', 'list_own_closed_shared_world_material_v1', '0155_introduction_privacy_isolation_end_boundary_v1.sql'],
  ['shared_private', 'list_own_closed_shared_world_members_v1', '0155_introduction_privacy_isolation_end_boundary_v1.sql'],
];
const MIGRATIONS = new URL('./migrations/', import.meta.url);
const M0161 = '0161_introduction_closed_history_v1.sql';
const EMPTY = { introduction_state: 'ENDED', material_id: null, established_at: null, is_self: null, text_body: null };

// ------------------------------------------------------------------ helpers
/** The body of the LAST `CREATE [OR REPLACE] FUNCTION <schema>.<name>(` in the named migration, CR-free. */
function definingBody(file, schema, name) {
  const text = readFileSync(new URL(file, MIGRATIONS), 'utf8').replace(/\r\n/gu, '\n');
  let found = null;
  for (const match of text.matchAll(new RegExp(String.raw`CREATE (?:OR REPLACE )?FUNCTION ${schema}\.${name}\(`, 'gu'))) {
    const tail = text.slice(match.index);
    const open = /\bAS\s+(\$[A-Za-z_]*\$)/u.exec(tail);
    const start = open.index + open[0].length;
    found = tail.slice(start, tail.indexOf(open[1], start));
  }
  assert.ok(found, `${file} defines ${schema}.${name}`);
  return found;
}
const as = (uid) => asRole('authenticated', uid);
const owner = () => asRole('postgres');
const count = async (sql, values = []) => { await owner(); return Number((await rows(sql, values))[0].n); };
async function facts(pairs) {
  for (const [human, sex, firstName] of pairs) await rt.recordFacts(human, { sex, firstName });
}
async function introduction(first, candidate) {
  await facts([[first, 'FEMALE', 'Mona'], [candidate, 'MALE', 'Omar']]);
  const f = await rt.bringToIntroduction(first, candidate);
  await owner();
  return f;
}

// ---- the reused boundaries and the new reader, called exactly as the client calls them
async function historyOf(uid, world, before = null, limit = 50) {
  await as(uid);
  try {
    return await rows(`SELECT introduction_state, material_id, established_at::text AS established_at, is_self, text_body
                         FROM public.read_my_introduction_history_v1($1, $2, $3, $4)`, [world, before?.at ?? null, before?.id ?? null, limit]);
  } finally { await owner(); }
}
async function endAs(uid, world, command = randomUUID()) {
  await as(uid);
  try { return (await rows('SELECT * FROM public.end_own_introduction_v1($1, $2)', [command, world]))[0].outcome; } finally { await owner(); }
}
async function sendOf(uid, world, text, command = randomUUID()) {
  await as(uid);
  try { return { ...(await rows('SELECT * FROM public.send_my_introduction_text_v1($1, $2, $3)', [command, world, text]))[0], command }; } finally { await owner(); }
}
async function readOf(uid, world) {
  await as(uid);
  try { return await rows('SELECT * FROM public.read_my_introduction_messages_v1($1, NULL, NULL, 50)', [world]); } finally { await owner(); }
}
async function listOf(uid) {
  await as(uid);
  try { return await rows('SELECT * FROM public.list_my_introduction_worlds_v1()'); } finally { await owner(); }
}
async function deleteOwn(uid, world, material, command = randomUUID()) {
  await as(uid);
  try { return (await rows('SELECT * FROM public.delete_own_shared_world_material_v1($1, $2, $3)', [command, world, material]))[0].outcome; } finally { await owner(); }
}
const words = (page) => page.filter((r) => r.material_id !== null).map((r) => `${r.is_self}:${r.text_body}`).sort();
/** Everything END, a read or a deletion could write about one World and its two humans. */
async function footprint(world, humans) {
  return {
    entitlements: await count(`SELECT count(*) n FROM ${D.ENTITLEMENTS} WHERE world_id = $1`, [world]),
    entitlementItems: await count(`SELECT count(*) n FROM ${D.ENTITLEMENT_ITEMS} WHERE world_id = $1`, [world]),
    terminal: await count(`SELECT count(*) n FROM ${D.TERMINAL} t JOIN public.introduction_records r ON r.id = t.introduction_record_id WHERE r.world_id = $1`, [world]),
    ended: await count('SELECT count(*) n FROM public.introduction_ended_events WHERE world_id = $1', [world]),
    materials: await count('SELECT count(*) n FROM public.shared_world_materials WHERE world_id = $1', [world]),
    items: await count('SELECT count(*) n FROM public.shared_world_history_items WHERE world_id = $1', [world]),
    standardEntitlements: await count('SELECT count(*) n FROM public.shared_world_standard_closed_view_entitlements WHERE world_id = $1', [world]),
    historyGrants: await count('SELECT count(*) n FROM public.shared_world_history_access_grants WHERE world_id = $1', [world]),
    leases: await count('SELECT count(*) n FROM shared_private.shared_qandeel_reply_work_leases WHERE world_id = $1', [world]),
    activity: await count('SELECT count(*) n FROM public.activity_items WHERE user_id = ANY($1::uuid[])', [humans]),
    push: await count('SELECT count(*) n FROM public.push_delivery_attempts WHERE user_id = ANY($1::uuid[])', [humans]),
  };
}
/**
 * A history item and its text-bodied material seen ONLY by `viewers` - the shape verify-0116 E09 uses for a divergent set.
 * `author` null makes it a QANDEEL_OUTPUT (a text body no human wrote), which the reader must never show as a message.
 */
async function privateText(world, author, viewers, body) {
  await owner();
  const item = randomUUID();
  const material = randomUUID();
  await q(`INSERT INTO ${D.ITEMS} (id, world_id, occurred_at, authority_requirement_mode, availability_state, availability_revision, registered_at)
           VALUES ($1, $2, clock_timestamp(), 'NO_HUMAN_APPROVAL_REQUIRED', 'AVAILABLE', 1, clock_timestamp())`, [item, world]);
  for (const viewer of [viewers].flat()) await q(`INSERT INTO ${D.VIEWERS} (history_item_id, user_id) VALUES ($1, $2)`, [item, viewer]);
  await q(`INSERT INTO public.shared_world_materials (id, world_id, history_item_id, material_kind, producer_kind, body_form, author_user_id, established_at)
           VALUES ($1, $2, $3, $4, $5, 'TEXT', $6, clock_timestamp())`,
  [material, world, item, author ? 'HUMAN_TEXT' : 'QANDEEL_OUTPUT', author ? 'HUMAN' : 'QANDEEL', author]);
  await q(`INSERT INTO public.shared_world_text_material_bodies (material_id, body_form, body_text) VALUES ($1, 'TEXT', $2)`, [material, body]);
  return { item, material };
}

// ------------------------------------------------------------------ A. posture
async function verifyPosture(report) {
  await report.section('A01 one authenticated-only STABLE reader, postgres-owned, DEFINER, pinned; the closed resolver it composes still closed', async () => {
    const p = await rt.functionPosture(HISTORY);
    assert.equal(p.owner, 'postgres', 'A01 postgres-owned');
    assert.equal(p.secdef, true, 'A01 SECURITY DEFINER');
    assert.deepEqual(p.config, ['search_path=""'], 'A01 an empty search_path');
    const [{ volatility }] = await rows('SELECT p.provolatile volatility FROM pg_proc p WHERE p.oid = $1::regprocedure', [HISTORY]);
    assert.equal(volatility, 's', 'A01 STABLE: it can write nothing');
    assert.equal(await rt.canExecute('authenticated', HISTORY), true, 'A01 authenticated executes it');
    for (const role of ['public', 'anon', 'service_role']) assert.equal(await rt.canExecute(role, HISTORY), false, `A01 ${role} must not execute it`);
    const [{ n }] = await rows(`SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
      WHERE s.nspname = 'public' AND p.proname = 'read_my_introduction_history_v1'`);
    assert.equal(n, 1, 'A01 no overload');
    for (const role of ['public', ...APP_ROLES]) assert.equal(await rt.canExecute(role, CLOSED_RESOLVER), false, `A01 ${role} must not execute the closed resolver`);
  });

  await report.section('A02 exactly the client\'s inputs; the human is auth.uid(); the own entitlement first; visibility is the frozen resolver\'s', async () => {
    assert.deepEqual(await rt.inputParameters(HISTORY), ['p_world_id', 'p_before_established_at', 'p_before_material_id', 'p_limit']);
    assert.deepEqual(await rt.resultColumns(HISTORY), ['introduction_state', 'material_id', 'established_at', 'is_self', 'text_body'],
      'A02 the same row shape as the CP3 read');
    const src = (await rt.functionPosture(HISTORY)).prosrc.replace(/--[^\n]*/gu, '');
    assert.match(src, /v_user uuid := \(SELECT auth\.uid\(\)\);/u, 'A02 the human is auth.uid()');
    assert.match(src, /WHERE ent\.world_id = p_world_id AND ent\.user_id = v_user/u, 'A02 the caller\'s OWN entitlement');
    assert.ok(src.indexOf('public.introduction_closed_view_entitlements ent') < src.indexOf('public.resolve_shared_world_material_v1(p_world_id, v_user)'),
      'A02 no entitlement is answered before any history is read');
    assert.match(src, /m\.material_kind = 'HUMAN_TEXT' AND m\.author_user_id IS NOT NULL AND m\.text_body IS NOT NULL/u, 'A02 human words only');
    assert.doesNotMatch(src, /membership_episodes|qandeel|semantic|analysis|activity|alert|launch_gate|_capability|public\.users|context_grant|personal|memory/iu,
      'A02 no membership, reply, analysis, Activity, gate, account Name, grant or Personal Context');
    assert.doesNotMatch(src, /INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM|EXECUTE\s|RAISE;|ISOLATION|FOR\s+UPDATE/iu, 'A02 writes and locks nothing');
  });

  await report.section('A03 the authority 0161 composes or sits beside is its defining body byte for byte; 0161 creates exactly its one function', async () => {
    for (const [schema, name, file] of FROZEN) {
      const found = await rows(`SELECT p.prosrc FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
        WHERE s.nspname = $1 AND p.proname = $2 ORDER BY p.oid`, [schema, name]);
      assert.equal(found.length, 1, `A03 ${schema}.${name} has exactly one definition`);
      const [{ prosrc }] = found;
      assert.equal(prosrc.replace(/\r\n/gu, '\n'), definingBody(file, schema, name), `A03 ${schema}.${name} is the ${file} body byte for byte`);
    }
    const text = readFileSync(new URL(M0161, MIGRATIONS), 'utf8');
    assert.deepEqual([...text.matchAll(/CREATE (?:OR REPLACE )?FUNCTION ([a-z_.0-9]+)\(/gu)].map((m) => m[1]), ['public.read_my_introduction_history_v1'],
      'A03 0161 creates its one function and replaces nothing');
    assert.doesNotMatch(text, /CREATE OR REPLACE|ALTER TABLE|CREATE TABLE|DROP |CREATE TRIGGER|CREATE POLICY|CREATE INDEX/u, 'A03 no existing object is replaced or altered');
  });
}

// ------------------------------------------------------------------ B .. E, inside one rolled-back transaction
async function verifyBehaviour(report, H) {
  const [first, a, b, outsider] = H;
  await owner();
  await q('BEGIN');
  try {
    await report.isolated('B01 the first recipient ends alone: ENDED, with no consent of the other and every CW2-08 / I-07D seam fail-closed', async () => {
      const f = await introduction(first, a);
      for (const seam of capturedSeams) await rt.restoreMatchingSeam(seam);
      for (const seam of SEAMS) {
        assert.equal(await rt.seamClearance(seam.slice(0, seam.indexOf('('))), 'NOT_EVALUATED', `B01 ${seam} is fail-closed for this END`);
      }
      const before = await footprint(f.world, [first, a]);
      assert.equal(await endAs(first, f.world), 'ENDED', 'B01 one call by one human ends it');
      const [w] = await rows('SELECT lifecycle, phase FROM public.shared_worlds WHERE id = $1', [f.world]);
      assert.deepEqual(w, { lifecycle: 'READ_ONLY_CLOSED', phase: 'INTRODUCTION' }, 'B01 the World is closed and is still an Introduction');
      const after = await footprint(f.world, [first, a]);
      assert.deepEqual([after.entitlements - before.entitlements, after.terminal - before.terminal, after.ended - before.ended], [2, 1, 1],
        'B01 exactly two frozen entitlements and one terminal outcome');
      for (const human of [first, a]) assert.ok(await rt.entitlementOf(f.world, human), 'B01 each of the two holds their own entitlement');
      for (const human of [b, outsider]) assert.equal(await rt.entitlementOf(f.world, human), null, 'B01 and nobody else');
    });

    await report.isolated('B02 the second human (the candidate) ends alone just the same; the first then reads ALREADY_SETTLED', async () => {
      const f = await introduction(first, a);
      assert.equal(await endAs(a, f.world), 'ENDED', 'B02 the candidate ends it');
      assert.equal(await endAs(first, f.world), 'ALREADY_SETTLED', 'B02 the other human is told it is already settled');
      assert.equal((await listOf(first))[0].introduction_state, 'ENDED', 'B02 and both lists say ENDED');
      assert.equal((await listOf(a))[0].introduction_state, 'ENDED');
    });

    await report.isolated('B03 a retry is the same END; a reused id, an outsider and an unknown World are UNAVAILABLE; nothing more is written', async () => {
      const f = await introduction(first, a);
      const command = randomUUID();
      assert.equal(await endAs(first, f.world, command), 'ENDED');
      const settled = await footprint(f.world, [first, a]);
      assert.equal(await endAs(first, f.world, command), 'ENDED', 'B03 the retry answers the committed END');
      assert.equal(await endAs(a, f.world, command), 'UNAVAILABLE', 'B03 the same command id by the other human');
      for (const human of [b, outsider]) assert.equal(await endAs(human, f.world), 'UNAVAILABLE', 'B03 not one of the two: never told it ended');
      assert.equal(await endAs(first, randomUUID()), 'UNAVAILABLE', 'B03 an unknown World is the same answer');
      assert.deepEqual(await footprint(f.world, [first, a]), settled, 'B03 nothing more is written');
    });

    await report.isolated('C01 each human reads the closed history by keyset page, newest first; an empty page is one ENDED row', async () => {
      const f = await introduction(first, a);
      const said = [await sendOf(first, f.world, 'one'), await sendOf(a, f.world, 'two'), await sendOf(first, f.world, 'three')];
      for (const s of said) assert.equal(s.outcome, 'COMMITTED');
      assert.equal(await endAs(a, f.world), 'ENDED');
      const newest = (await rows(`SELECT m.id::text id FROM public.shared_world_materials m WHERE m.world_id = $1
                                    ORDER BY m.established_at DESC, m.id DESC`, [f.world])).map((r) => r.id);
      const all = await historyOf(first, f.world);
      assert.ok(all.every((r) => r.introduction_state === 'ENDED'), 'C01 every row carries ENDED');
      assert.deepEqual(all.map((r) => r.material_id), newest, 'C01 newest first, by (instant, id)');
      assert.deepEqual(words(all), ['false:two', 'true:one', 'true:three'], 'C01 the first recipient\'s history, each marked as theirs or not');
      assert.deepEqual(words(await historyOf(a, f.world)), ['false:one', 'false:three', 'true:two'], 'C01 the candidate\'s, the same words from their side');
      const [page1] = await historyOf(first, f.world, null, 1);
      const rest = await historyOf(first, f.world, { at: page1.established_at, id: page1.material_id }, 50);
      assert.deepEqual([page1, ...rest].map((r) => r.material_id), newest, 'C01 the keyset page continues exactly where the first ended');
      const last = rest.at(-1);
      assert.deepEqual(await historyOf(first, f.world, { at: last.established_at, id: last.material_id }, 50), [EMPTY], 'C01 past the oldest: one empty ENDED row');
      const g = await introduction(b, outsider);
      assert.equal(await endAs(b, g.world), 'ENDED');
      for (const human of [b, outsider]) assert.deepEqual(await historyOf(human, g.world), [EMPTY], 'C01 an Introduction ended with no words: one empty ENDED row');
      assert.deepEqual(await readOf(first, f.world), [EMPTY], 'C01 the CP3 read is unchanged: one ENDED row, no message');
    });

    await report.isolated('C02 each human reads their OWN frozen entitlement: two different sets stay different, and nothing written after closure widens either', async () => {
      const f = await introduction(first, a);
      await sendOf(a, f.world, 'seen by both');
      const onlyFirst = await privateText(f.world, a, first, 'seen only by the first recipient');
      assert.equal(await endAs(a, f.world), 'ENDED');
      assert.ok((await rt.entitlementItemsOf(f.world, first)).includes(onlyFirst.item), 'C02 the first recipient\'s entitlement holds the item');
      assert.ok(!(await rt.entitlementItemsOf(f.world, a)).includes(onlyFirst.item), 'C02 the candidate\'s does not');
      assert.deepEqual(words(await historyOf(first, f.world)), ['false:seen by both', 'false:seen only by the first recipient']);
      assert.deepEqual(words(await historyOf(a, f.world)), ['true:seen by both'], 'C02 the candidate never reads what they could not see');
      await privateText(f.world, first, a, 'written after the closure');
      assert.deepEqual(words(await historyOf(a, f.world)), ['true:seen by both'], 'C02 a row written after closure never widens a frozen entitlement');
      assert.deepEqual(words(await historyOf(first, f.world)), ['false:seen by both', 'false:seen only by the first recipient']);
    });

    await report.isolated('C03 no entitlement, no row: an outsider, a member of another Introduction, an unknown World, a live Introduction', async () => {
      const f = await introduction(first, a);
      await sendOf(first, f.world, 'private to the two of them');
      assert.deepEqual(await historyOf(first, f.world), [], 'C03 a live Introduction has no closed history yet');
      assert.equal(await endAs(first, f.world), 'ENDED');
      const g = await introduction(b, outsider);
      assert.equal(await endAs(outsider, g.world), 'ENDED');
      for (const human of [b, outsider]) {
        assert.deepEqual(await historyOf(human, f.world), [], 'C03 a member of another (ended) Introduction reads nothing of this one');
      }
      assert.deepEqual(await historyOf(first, g.world), [], 'C03 nor the other way');
      assert.deepEqual(await historyOf(first, randomUUID()), [], 'C03 an unknown World: the same no row');
    });

    await report.isolated('C04 refusals: anon is denied, a claim-less caller is 42501, a malformed page request is 22023', async () => {
      const f = await introduction(first, a);
      assert.equal(await endAs(first, f.world), 'ENDED');
      await asRole('anon');
      await rejected(() => q('SELECT * FROM public.read_my_introduction_history_v1($1, NULL, NULL, 10)', [f.world]), ['42501'], /permission denied/u);
      await asRole('authenticated');
      await rejected(() => q('SELECT * FROM public.read_my_introduction_history_v1($1, NULL, NULL, 10)', [f.world]), ['42501'], /INTRODUCTION_AUTHENTICATION_REQUIRED/u);
      await as(first);
      for (const args of [[null, null, null, 10], [f.world, null, null, 0], [f.world, null, null, 201], [f.world, null, null, null],
        [f.world, '2026-10-16T00:00:00Z', null, 10], [f.world, null, randomUUID(), 10]]) {
        await rejected(() => q('SELECT * FROM public.read_my_introduction_history_v1($1, $2, $3, $4)', args), ['22023'], /INTRODUCTION_HISTORY_READ_INVALID/u);
      }
      await owner();
    });

    await report.isolated('C05 only human words are messages: neither a disclosure nor a text-bodied QANDEEL material in the same closed history is one', async () => {
      const f = await introduction(first, a);
      const { answer } = await rt.discloseAs(first, f.world, 'FULL_NAME', { text: 'Mona Disclosed Fullname' });
      assert.ok(answer, 'C05 a real EXPLICIT_DISCLOSURE was committed into the same history');
      const machine = await privateText(f.world, null, [first, a], 'a QANDEEL text body');
      await sendOf(a, f.world, 'hello');
      assert.equal(await endAs(a, f.world), 'ENDED');
      for (const human of [first, a]) {
        assert.ok((await rt.entitlementItemsOf(f.world, human)).includes(machine.item), 'C05 the QANDEEL text IS in the frozen entitlement and available');
        const page = await historyOf(human, f.world);
        assert.deepEqual(page.filter((r) => r.material_id !== null).map((r) => r.text_body), ['hello'], 'C05 the message, and nothing else');
        assert.ok(!JSON.stringify(page).includes('Mona Disclosed Fullname'), 'C05 the disclosed value never appears');
        assert.ok(!page.some((r) => r.material_id === machine.material), 'C05 a text body nobody human wrote is never a message');
      }
    });

    await report.isolated('C06 a World SUCCESS made Standard is not an ended Introduction: no closed history here', async () => {
      await facts([[first, 'FEMALE', 'Mona'], [a, 'MALE', 'Omar']]);
      const s = await rt.bringToSuccessApproved(first, a);
      await owner();
      await sendOf(a, s.world, 'said during the Introduction');
      await rt.commitSuccess(terminalIds(), s.version);
      for (const human of [first, a]) assert.deepEqual(await historyOf(human, s.world), [], 'C06 no row for either human');
    });

    await report.isolated('D01 after END the author finds their own message in the history and deletes it: gone for BOTH, for good; nobody deletes another\'s words', async () => {
      const f = await introduction(first, a);
      const mine = await sendOf(first, f.world, 'mine, deleted after the end');
      const theirs = await sendOf(a, f.world, 'theirs');
      assert.equal(await endAs(a, f.world), 'ENDED');
      const own = (await historyOf(first, f.world)).filter((r) => r.is_self === true);
      assert.deepEqual(own.map((r) => r.material_id), [mine.material_id], 'D01 the author learns exactly their own message id from the history');
      const before = await footprint(f.world, [first, a]);
      assert.equal(await deleteOwn(a, f.world, mine.material_id), 'UNAVAILABLE', 'D01 not the other human');
      assert.equal(await deleteOwn(outsider, f.world, mine.material_id), 'UNAVAILABLE', 'D01 not an outsider');
      assert.equal(await deleteOwn(first, f.world, theirs.material_id), 'UNAVAILABLE', 'D01 never another\'s message');
      const command = randomUUID();
      assert.equal(await deleteOwn(first, f.world, mine.material_id, command), 'DELETED', 'D01 the author deletes it through the existing route (R-5)');
      for (const human of [first, a]) {
        assert.deepEqual(words(await historyOf(human, f.world)), [human === a ? 'true:theirs' : 'false:theirs'], 'D01 gone from both histories');
      }
      assert.equal((await rt.itemRow((await rt.materialRow(mine.material_id)).history_item_id)).availability_state, 'DELETED_BY_OWNER', 'D01 the item is DELETED_BY_OWNER');
      assert.equal(await deleteOwn(first, f.world, mine.material_id, command), 'DELETED', 'D01 a retry of the deletion is the same answer');
      for (const human of [first, a]) {
        const page = await historyOf(human, f.world);
        assert.ok(!JSON.stringify(page).includes('mine, deleted after the end'), 'D01 and it never comes back');
        assert.ok(!page.some((r) => r.material_id === mine.material_id), 'D01 not even its id');
      }
      const after = await footprint(f.world, [first, a]);
      assert.deepEqual({ ...after, materials: before.materials }, before, 'D01 deletion removes no entitlement, item or grant and writes no Activity');
    });

    await report.isolated('D02 a message deleted before END never enters either history', async () => {
      const f = await introduction(first, a);
      const gone = await sendOf(a, f.world, 'deleted while it was live');
      await sendOf(first, f.world, 'kept');
      assert.equal(await deleteOwn(a, f.world, gone.material_id), 'DELETED');
      assert.equal(await endAs(first, f.world), 'ENDED');
      for (const human of [first, a]) {
        const page = await historyOf(human, f.world);
        assert.deepEqual(page.filter((r) => r.material_id !== null).map((r) => r.text_body), ['kept'], 'D02 only the kept words');
        assert.ok(!page.some((r) => r.material_id === gone.material_id), 'D02 the deleted message is in neither history');
      }
    });

    await report.isolated('E01 after END nothing re-opens it: no send, no second END, no Stage 4 path; the Stage 4 closed readers still never show it', async () => {
      const f = await introduction(first, a);
      await sendOf(first, f.world, 'before the end');
      assert.equal(await endAs(first, f.world), 'ENDED');
      const closed = await footprint(f.world, [first, a]);
      for (const human of [first, a]) {
        assert.equal((await sendOf(human, f.world, 'after the end')).outcome, 'ENDED', 'E01 a member\'s send is ENDED');
        assert.equal(await endAs(human, f.world), 'ALREADY_SETTLED', 'E01 a second END re-opens nothing');
        await as(human);
        assert.equal((await rows('SELECT * FROM public.send_shared_world_human_text_v1($1, $2, $3)', [randomUUID(), f.world, 'through Stage 4']))[0].outcome,
          'UNAVAILABLE', 'E01 the Stage 4 send is still refused');
        assert.equal((await rows('SELECT * FROM public.resolve_own_shared_world_entry_v1($1)', [f.world]))[0].outcome, 'UNAVAILABLE', 'E01 no Stage 4 entry');
        assert.deepEqual(await rows('SELECT * FROM public.list_own_closed_shared_world_material_v1($1, NULL, NULL, 50)', [f.world]), [],
          'E01 the Stage 4 closed reader returns nothing for it (its STANDARD fence is pinned byte for byte by A03)');
        assert.ok((await rows('SELECT * FROM public.list_own_closed_shared_world_members_v1()')).every((m) => m.world_id !== f.world),
          'E01 and no Stage 4 closed member list holds it');
        await owner();
      }
      const [w] = await rows('SELECT lifecycle, phase FROM public.shared_worlds WHERE id = $1', [f.world]);
      assert.deepEqual(w, { lifecycle: 'READ_ONLY_CLOSED', phase: 'INTRODUCTION' }, 'E01 still closed');
      assert.deepEqual(await footprint(f.world, [first, a]), closed, 'E01 nothing written');
    });

    await report.isolated('E02 no reply, QANDEEL material, Activity or Push; reading and deleting create or widen no entitlement, item or grant', async () => {
      const f = await introduction(first, a);
      const said = await sendOf(first, f.world, 'hello');
      await sendOf(a, f.world, 'hello back');
      assert.equal(await endAs(a, f.world), 'ENDED');
      const closed = await footprint(f.world, [first, a]);
      assert.deepEqual([closed.leases, closed.activity, closed.push, closed.standardEntitlements, closed.historyGrants], [0, 0, 0, 0, 0],
        'E02 no reply work, no Activity, no Push, no Standard entitlement and no history grant');
      assert.equal(await count(`SELECT count(*) n FROM public.shared_world_materials WHERE world_id = $1 AND producer_kind = 'QANDEEL'`, [f.world]), 0,
        'E02 no QANDEEL material');
      for (let round = 0; round < 3; round += 1) for (const human of [first, a, b, outsider]) await historyOf(human, f.world);
      assert.deepEqual(await footprint(f.world, [first, a]), closed, 'E02 reading writes nothing');
      assert.equal(await deleteOwn(first, f.world, said.material_id), 'DELETED');
      const deleted = await footprint(f.world, [first, a]);
      assert.deepEqual({ ...deleted, materials: closed.materials }, closed, 'E02 deleting removes no entitlement or item and adds nothing');
      await asRole('service_role');
      assert.deepEqual(await rows('SELECT * FROM public.server_read_shared_activity_source_v1($1, $2)', ['HUMAN_TEXT', said.material_id]), [],
        'E02 no Activity source row (R-7)');
      await owner();
    });
  } finally {
    await q('ROLLBACK');
    await owner();
  }
}

// ------------------------------------------------------------------ G. races on two real connections
async function verifyRaces(report, H) {
  const [one, two] = H;
  const endSql = (world, command = randomUUID()) => ({ sql: 'SELECT * FROM public.end_own_introduction_v1($1, $2)', values: [command, world] });
  const deleteSql = (world, material) => ({ sql: 'SELECT * FROM public.delete_own_shared_world_material_v1($1, $2, $3)', values: [randomUUID(), world, material] });
  /** The primary runs `mine` as `mineAs` inside an open transaction; the extra connection runs `theirs` and must wait on it. */
  async function contend(label, { mineAs, mine, theirsAs, theirs }) {
    const extra = await rt.openExtra();
    try {
      await q('BEGIN');
      await as(mineAs);
      const [first] = await rows(mine.sql, mine.values);
      await owner();
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

  await race('G01 END against END by the two humans: one ENDED, the other ALREADY_SETTLED, one terminal outcome', async () => {
    const f = await introduction(one, two);
    const { first, late } = await contend('G01', { mineAs: one, mine: endSql(f.world), theirsAs: two, theirs: endSql(f.world) });
    assert.deepEqual([first.outcome, late.outcome], ['ENDED', 'ALREADY_SETTLED']);
    const after = await footprint(f.world, [one, two]);
    assert.deepEqual([after.entitlements, after.terminal, after.ended], [2, 1, 1], 'G01 exactly one END, two entitlements');
  });

  await race('G02 the same END twice at once: both answers ENDED, one terminal outcome', async () => {
    const f = await introduction(one, two);
    const command = randomUUID();
    const { first, late } = await contend('G02', { mineAs: one, mine: endSql(f.world, command), theirsAs: one, theirs: endSql(f.world, command) });
    assert.deepEqual([first.outcome, late.outcome], ['ENDED', 'ENDED']);
    const after = await footprint(f.world, [one, two]);
    assert.deepEqual([after.entitlements, after.terminal, after.ended], [2, 1, 1], 'G02 exactly one END');
  });

  await race('G03 the deletion first, END waiting: END freezes nothing of it, and neither history shows it', async () => {
    const f = await introduction(one, two);
    await as(one);
    const [sent] = await rows('SELECT * FROM public.send_my_introduction_text_v1($1, $2, $3)', [randomUUID(), f.world, 'taken back']);
    await owner();
    const item = (await rt.materialRow(sent.material_id)).history_item_id;
    const { first, late } = await contend('G03', { mineAs: one, mine: deleteSql(f.world, sent.material_id), theirsAs: two, theirs: endSql(f.world) });
    assert.deepEqual([first.outcome, late.outcome], ['DELETED', 'ENDED']);
    for (const human of [one, two]) {
      assert.ok(!(await rt.entitlementItemsOf(f.world, human)).includes(item), 'G03 the deleted item is in no frozen entitlement');
      assert.deepEqual(await historyOf(human, f.world), [EMPTY], 'G03 and in neither history');
    }
  });

  await race('G04 END first, the deletion waiting: the deletion still lands, and the message is gone from both histories', async () => {
    const f = await introduction(one, two);
    await as(one);
    const [sent] = await rows('SELECT * FROM public.send_my_introduction_text_v1($1, $2, $3)', [randomUUID(), f.world, 'taken back after']);
    await owner();
    const item = (await rt.materialRow(sent.material_id)).history_item_id;
    const { first, late } = await contend('G04', { mineAs: two, mine: endSql(f.world), theirsAs: one, theirs: deleteSql(f.world, sent.material_id) });
    assert.deepEqual([first.outcome, late.outcome], ['ENDED', 'DELETED']);
    for (const human of [one, two]) {
      assert.ok((await rt.entitlementItemsOf(f.world, human)).includes(item), 'G04 END froze the item into both entitlements');
      assert.deepEqual(await historyOf(human, f.world), [EMPTY], 'G04 yet availability dominates: gone from both histories');
    }
  });
}

// ------------------------------------------------------------------ the run
const humans = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const raceHumans = [randomUUID(), randomUUID()];
const SEAMS = [PFN.PREREQUISITES, DFN.DISCLOSURE_GATE, DFN.SUCCESS_GATE, DFN.REACTIVATION_GATE];
const capturedSeams = [];
await runVerifier('0161', async (setStage) => {
  await rt.client.connect();
  await q("SET lock_timeout = '10s'");
  await q("SET statement_timeout = '60s'");
  setStage('fixtures');
  await rt.provisionHumans([...humans, ...raceHumans]);
  const report = createScenarioReport('0161', { query: q, restore: () => owner() });

  setStage('posture');
  await verifyPosture(report);

  for (const fn of SEAMS) capturedSeams.push(await rt.captureMatchingSeam(fn));
  try {
    await rt.clearProposalPrerequisites();
    await rt.clearAllSeams();
    setStage('behaviour');
    await verifyBehaviour(report, humans);
    setStage('races');
    await verifyRaces(report, raceHumans);
  } finally {
    await owner();
    for (const seam of capturedSeams) await rt.restoreMatchingSeam(seam);
  }
  report.print();
  report.assertAllPassed();

  setStage('teardown');
  for (const seam of SEAMS) {
    assert.equal(await rt.seamClearance(seam.slice(0, seam.indexOf('('))), 'NOT_EVALUATED', `${seam} is fail-closed again`);
  }
  await rt.cleanupIntroductionRace([...humans, ...raceHumans]);
  await rt.removeFixtureHumans([...humans, ...raceHumans]);
  const [{ residue }] = await rows(`SELECT (SELECT count(*) FROM public.users WHERE id = ANY($1::uuid[]))
      + (SELECT count(*) FROM public.introduction_records WHERE lower_user_id = ANY($1::uuid[]) OR higher_user_id = ANY($1::uuid[])) AS residue`,
  [[...humans, ...raceHumans]]);
  assert.equal(Number(residue), 0, 'the run leaves nothing behind');
}, () => rt.client.end().catch(() => undefined));
