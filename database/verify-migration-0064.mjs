// Real-PostgreSQL verifier for migration 0064 - Committed Conversational Unit
// Constitution + Commitment Producer + Durable Substrate v1.
//
// Proves against live semantics, never grep alone: the frozen UTF-8/code-point/
// SHA-256 contract with JS parity; DB-derived canonical source authority (a
// privileged caller cannot forge role, modality, digest, committed wording or
// speaker state); the forward-only committed source frontier that makes
// `ordinal_within_turn` global canonical source order across batches;
// REV03A1-06's strict separation of existing-batch replay from new-batch
// commit; DB-derived batch identity with tuple-by-tuple stored-row comparison;
// append-only protection against UPDATE/DELETE/delete-reinsert; the
// production-inert activation gate; and that no SP/LH/Moment/outbox artefact is
// produced anywhere. Every fixture is rolled back or explicitly removed.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required in the ignored local .env file.');
const client = new Client({ connectionString: databaseUrl });
let stage = 'connect';

const q = (text, values = []) => client.query(text, values);
const rows = async (text, values = []) => (await q(text, values)).rows;

async function identity(role, uid = null) {
  await q('RESET ROLE');
  if (role !== 'postgres') await q(`SET LOCAL ROLE ${role}`);
  await q("SELECT set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, role }) : '']);
}

async function rejected(operation, token, codes = ['22023']) {
  await q('SAVEPOINT s');
  let error;
  try { await operation(); } catch (caught) { error = caught; } finally {
    await q('ROLLBACK TO SAVEPOINT s'); await q('RELEASE SAVEPOINT s');
  }
  assert.ok(error, `operation unexpectedly succeeded (wanted ${token})`);
  assert.ok(codes.includes(error.code), `unexpected SQLSTATE ${error.code} for ${token}: ${error.message}`);
  assert.ok(String(error.message).includes(token), `expected ${token}, got: ${error.message}`);
}

const PRODUCER = 'public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text)';
const PROVENANCE = ['cu-anchor-mapper-v1', 'stage-1.2-cu-commitment-v1', 'OPENAI', 'gpt-5-mini', 'cu-segmentation-anchored-v1'];
const ROUTE = ['FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT'];

// Stage 1.2 worked-case fixtures, used verbatim.
const E1 = 'أنا سبت الشغل امبارح. وبالمناسبة أحمد كلمني. ممكن نرجع لموضوع السفر؟';
const CODE_SWITCH = 'أنا كنت okay في الأول بس then I panicked لما المدير كلمني.';
const SELF_CORRECTION = 'أنا كلمت أحمد امبارح... لا، قصدي حسام.';
const REPEATED = 'أحمد كلمني امبارح. بعدها خالد سافر. أحمد كلمني امبارح.';
const EMOJI = 'الاجتماع كان 😀 كويس. بس المدير زعل 👍 بعدين.';
const COMBINING = 'قَالَ لِي أَحْمَد. ثُمَّ سَافَرَ خَالِد.';

const points = (value) => Array.from(value);
const cpLength = (value) => points(value).length;
const spanOf = (content, excerpt, occurrence = 1) => {
  const source = points(content);
  const needle = points(excerpt);
  let seen = 0;
  for (let start = 0; start + needle.length <= source.length; start += 1) {
    if (needle.every((ch, offset) => source[start + offset] === ch)) {
      seen += 1;
      if (seen === occurrence) return { start, end: start + needle.length };
    }
  }
  throw new Error(`fixture excerpt not found: ${excerpt}`);
};
const unit = (content, excerpt, occurrence = 1, id = randomUUID()) => {
  const { start, end } = spanOf(content, excerpt, occurrence);
  return { unit_id: id, span_start: start, span_end: end };
};

const commit = (session, user, turn, batch, units, provenance = PROVENANCE) =>
  rows('SELECT * FROM commit_conversation_units_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)',
    [session, user, turn, batch, JSON.stringify(units), ...provenance]);
const unitsOfTurn = (turn) =>
  rows('SELECT * FROM public.conversation_units WHERE source_turn_id=$1 ORDER BY ordinal_within_turn', [turn]);
const unitsOfBatch = (batch) =>
  rows('SELECT * FROM public.conversation_units WHERE commit_batch_id=$1 ORDER BY ordinal_within_turn', [batch]);
const snapshot = async (turn) =>
  (await rows('SELECT to_jsonb(cu) row FROM public.conversation_units cu WHERE source_turn_id=$1 ORDER BY ordinal_within_turn', [turn])).map((r) => r.row);

async function completedTurns(owner, session, content) {
  await identity('authenticated', owner);
  const userTurn = randomUUID();
  await rows('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [userTurn, session, content, null]);
  await identity('service_role');
  await rows('SELECT * FROM claim_conversation_turn($1,$2,$3,$4,$5)', [session, owner, userTurn, ...ROUTE]);
  const assistantTurn = randomUUID();
  const finalized = await rows('SELECT * FROM finalize_conversation_turn_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [session, owner, userTurn, assistantTurn, 'رد المساعد على الموضوع.', 'ALLOW', randomUUID(), null, null, null]);
  assert.equal(finalized.length, 1, 'fixture exchange finalized');
  await identity('postgres');
  return { userTurn, assistantTurn };
}

// ---------------------------------------------------------------- static gate
async function verifyEnvironmentContract() {
  stage = 'frozen environment contract (case 40)';
  const [{ encoding }] = await rows("SELECT current_setting('server_encoding') encoding");
  assert.equal(encoding, 'UTF8', 'the frozen coordinate and digest contract requires a UTF8 server encoding');

  for (const sample of [E1, CODE_SWITCH, SELF_CORRECTION, REPEATED, EMOJI, COMBINING]) {
    const [row] = await rows('SELECT length($1::text) len, sha256(convert_to($1::text,$2::name)) digest', [sample, 'UTF8']);
    assert.equal(Number(row.len), cpLength(sample),
      'PostgreSQL length(text) must count characters exactly as JavaScript counts code points');
    assert.equal(row.digest.toString('hex'), createHash('sha256').update(Buffer.from(sample, 'utf8')).digest('hex'),
      'sha256(convert_to(content,UTF8)) must equal the SHA-256 of the UTF-8 bytes');
  }
  // Supplementary-plane parity: a naive UTF-16 length would report 2 here.
  const [{ emoji_len }] = await rows("SELECT length('😀'::text) emoji_len");
  assert.equal(Number(emoji_len), 1, 'a supplementary-plane character is exactly one character');
  assert.equal('😀'.length, 2, 'the same character is two UTF-16 code units, which is why offsets are code points');

  // Slicing parity across all fixtures.
  for (const [content, excerpt, occurrence] of [
    [E1, 'وبالمناسبة أحمد كلمني.', 1], [EMOJI, 'بس المدير زعل 👍 بعدين.', 1],
    [COMBINING, 'ثُمَّ سَافَرَ خَالِد.', 1], [REPEATED, 'أحمد كلمني امبارح.', 2],
  ]) {
    const { start, end } = spanOf(content, excerpt, occurrence);
    // The integer arguments are cast explicitly: with untyped parameters
    // PostgreSQL resolves substring(text FROM ... FOR ...) to the SQL-regex
    // overload, where the third argument is an escape string.
    const [{ sliced }] = await rows('SELECT substring($1::text from $2::integer for $3::integer) sliced',
      [content, start + 1, end - start]);
    assert.equal(sliced, excerpt, 'PostgreSQL character slicing must equal the JavaScript code-point slice');
  }
}

async function verifyStaticAuthority() {
  stage = 'static authority (cases 25, 28, 29, 35, 36, 41, 42)';
  const [presence] = await rows('SELECT to_regprocedure($1) IS NOT NULL present', [PRODUCER]);
  assert.equal(presence.present, true, 'the producer exists with the exact ten-parameter signature');
  const [contract] = await rows(
    'SELECT pg_get_functiondef(p.oid) definition, pg_get_userbyid(p.proowner) owner, p.prosecdef definer, p.proconfig config, p.proargnames argnames FROM pg_proc p WHERE p.oid = to_regprocedure($1)',
    [PRODUCER]);
  assert.ok(contract, 'the producer definition was read');
  assert.equal(contract.owner, 'postgres');
  assert.equal(contract.definer, true, 'the producer is SECURITY DEFINER');
  assert.match(contract.definition, /search_path TO ''/u, 'the producer search path is fixed empty');
  assert.ok(Array.isArray(contract.config) && contract.config.some((entry) => entry.startsWith('search_path=')),
    'the empty search path is recorded on the function');

  // Case 35/36: no caller-authoritative parameter exists at all.
  for (const forbidden of ['fingerprint', 'committed_text', 'text', 'source_role', 'role', 'speaker', 'modality', 'digest', 'sha', 'ordinal', 'sp', 'session_position', 'live_head']) {
    assert.ok(!contract.argnames.some((name) => name.replace(/^p_/u, '') === forbidden),
      `the producer must expose no caller-authoritative "${forbidden}" parameter`);
  }
  assert.deepEqual(contract.argnames, ['p_session_id', 'p_user_id', 'p_source_turn_id', 'p_batch_id', 'p_units',
    'p_evaluator_version', 'p_policy_version', 'p_segmentation_provider', 'p_segmentation_model', 'p_segmentation_prompt_version'],
    'the exact authorized parameter surface');
  // Case 30/26: no provider concept and no whole-turn fallback exists in SQL.
  assert.doesNotMatch(contract.definition, /openai|anthropic|gemini|http|fetch|prompt_text|paraphrase/iu,
    'the durable producer carries no provider concept: replay never re-runs inference');
  assert.doesNotMatch(contract.definition, /md5|byte_offset|octet_length/iu, 'no MD5 or byte-offset path exists');
  assert.match(contract.definition, /sha256\(convert_to\(/u, 'the canonical digest is SHA-256 over explicit UTF-8 bytes');
  // Case 15: UNRESOLVED is representable in the domain but unreachable in v1.
  assert.doesNotMatch(contract.definition, /'UNRESOLVED'/u, 'no producer path can write an unresolved speaker state');
  assert.match(contract.definition, /derived_speaker constant text := 'RESOLVED'/u, 'speaker state is derived, never asserted');

  // Case 25/28: the T-03A1 activation gate, re-anchored to the post-activation
  // world. T-03A2 (migration 0065) performed the ONE authorized activation act:
  // it granted EXECUTE on the producer to `service_role` and to no other role,
  // in the same migration that made SP allocation part of commitment. What
  // T-03A1 froze and what still binds here is unchanged: `anon` and
  // `authenticated` may never execute the producer, PUBLIC may never execute
  // it, and NO application role - service_role included - may write either CU
  // table directly. The complete post-activation ACL matrix, including the
  // service_role grant itself, is proven by verify-migration-0065.mjs.
  for (const role of ['anon', 'authenticated']) {
    const [{ allowed }] = await rows("SELECT has_function_privilege($1::name,$2::text,'EXECUTE') allowed", [role, PRODUCER]);
    assert.equal(allowed, false, `${role} must not hold EXECUTE on the commitment producer`);
  }
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const table of ['public.conversation_units', 'public.conversation_unit_commit_batches']) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        const [{ granted }] = await rows('SELECT has_table_privilege($1::name,$2::text,$3::text) granted', [role, table, privilege]);
        assert.equal(granted, false, `${role} must not hold ${privilege} on ${table}`);
      }
    }
  }
  const [{ allowed: publicExecute }] = await rows("SELECT has_function_privilege('public'::name,$1::text,'EXECUTE') allowed", [PRODUCER]);
  assert.equal(publicExecute, false, 'PUBLIC must not hold EXECUTE on the commitment producer');

  // RLS, ownership, immutability triggers and the required structural constraint.
  for (const table of ['conversation_units', 'conversation_unit_commit_batches']) {
    const [meta] = await rows('SELECT c.relrowsecurity rls, pg_get_userbyid(c.relowner) owner FROM pg_class c WHERE c.oid=$1::regclass', [`public.${table}`]);
    assert.deepEqual(meta, { rls: true, owner: 'postgres' }, `${table} is owner-held with RLS enabled`);
    const [{ count: triggers }] = await rows(
      "SELECT count(*) count FROM pg_trigger WHERE tgrelid=$1::regclass AND NOT tgisinternal AND tgname LIKE '%immutable%'", [`public.${table}`]);
    assert.equal(Number(triggers), 1, `${table} carries its append-only immutability trigger`);
    // Case 42: no exclusion constraint was introduced.
    const [{ count: exclusions }] = await rows("SELECT count(*) count FROM pg_constraint WHERE conrelid=$1::regclass AND contype='x'", [`public.${table}`]);
    assert.equal(Number(exclusions), 0, `${table} uses no exclusion constraint`);
  }
  const [{ count: ordinalUnique }] = await rows(
    "SELECT count(*) count FROM pg_constraint WHERE conrelid='public.conversation_units'::regclass AND contype='u' AND conname='conversation_units_turn_ordinal_unique'");
  assert.equal(Number(ordinalUnique), 1, 'UNIQUE(source_turn_id, ordinal_within_turn) exists');

  // Case 42: no extension was created by T-03A1.
  const [{ count: gist }] = await rows("SELECT count(*) count FROM pg_extension WHERE extname IN ('btree_gist','btree_gin')");
  assert.equal(Number(gist), 0, 'T-03A1 introduces no PostgreSQL extension');

  // Case 29/10: no LH/status/function/normalized/updated_at column, and exactly
  // one span pair, so a non-contiguous CU is unrepresentable.
  //
  // `session_position` is the ONE column T-03A2 (migration 0065) added, and it
  // is the authorized activation itself: the Session Position is born
  // atomically with the CU under the Session Semantic Clock lock. Every other
  // Moment-adjacent shape T-03A1 excluded is still excluded, and there is still
  // no second head authority, no status column and no lifecycle field.
  const columns = (await rows(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('conversation_units','conversation_unit_commit_batches')"))
    .map((row) => `${row.table_name}.${row.column_name}`);
  for (const column of columns) {
    if (column === 'conversation_units.session_position') continue;
    assert.doesNotMatch(column, /session_position|live_head|(^|[._])lh([._]|$)|(^|[._])sp([._]|$)|moment|updated_at|[._]status$|normalized|function|dialogue|act$/iu,
      `${column} must not exist in the T-03A1 substrate`);
  }
  const [spColumn] = await rows(
    "SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='conversation_units' AND column_name='session_position'");
  assert.deepEqual(spColumn, { is_nullable: 'NO' },
    'after T-03A2 activation a committed CU without a Session Position is unrepresentable');
  assert.deepEqual(columns.filter((c) => c.includes('span')).sort(),
    ['conversation_units.source_span_end', 'conversation_units.source_span_start'],
    'exactly one contiguous span pair exists per committed unit');

  // Case 41: conversation_turns was not altered.
  const turnColumns = (await rows(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='conversation_turns' ORDER BY column_name")).map((r) => r.column_name);
  assert.deepEqual(turnColumns, ['completed_at', 'content', 'created_at', 'generation_claimed_at', 'generation_lease_expires_at',
    'id', 'idempotency_key', 'processing_path', 'role', 'routing_reason', 'session_id', 'source_turn_id', 'status', 'updated_at', 'user_id'],
    'conversation_turns keeps exactly its pre-0064 columns');
  const [{ count: turnConstraints }] = await rows(
    "SELECT count(*) count FROM pg_constraint WHERE conrelid='public.conversation_turns'::regclass AND conname LIKE '%conversation_unit%'");
  assert.equal(Number(turnConstraints), 0, 'no T-03A1 constraint was added to conversation_turns');
  const [{ count: turnTriggers }] = await rows(
    "SELECT count(*) count FROM pg_trigger WHERE tgrelid='public.conversation_turns'::regclass AND NOT tgisinternal AND tgname LIKE '%unit%'");
  assert.equal(Number(turnTriggers), 0, 'no T-03A1 trigger was added to conversation_turns');
}

// ------------------------------------------------------------ commit semantics
async function verifyBasicCommitment(owner, session) {
  stage = 'CU constitution (cases 1, 2, 3, 5, 6, 8, 13, 15, 27, 29, 37, 38)';
  const { userTurn, assistantTurn } = await completedTurns(owner, session, E1);

  // Case 2: one turn -> three independently addressable committed CUs.
  const batch = randomUUID();
  const proposed = [unit(E1, 'أنا سبت الشغل امبارح.'), unit(E1, 'وبالمناسبة أحمد كلمني.'), unit(E1, 'ممكن نرجع لموضوع السفر؟')];
  const committed = await commit(session, owner, userTurn, batch, proposed);
  assert.equal(committed.length, 3, 'a multi-CU batch commits every unit atomically');
  assert.deepEqual(committed.map((row) => row.ordinal_within_turn), [0, 1, 2], 'contiguous ordinals in canonical source order');
  assert.deepEqual(committed.map((row) => row.committed_text),
    ['أنا سبت الشغل امبارح.', 'وبالمناسبة أحمد كلمني.', 'ممكن نرجع لموضوع السفر؟'],
    'committed wording is the exact committed surface form, sliced by the database');
  // Case 27: ordinals are monotone in source position.
  for (let i = 1; i < committed.length; i += 1) {
    assert.ok(committed[i].source_span_start >= committed[i - 1].source_span_end, 'spans are ascending and non-overlapping');
    assert.equal(committed[i].ordinal_within_turn, committed[i - 1].ordinal_within_turn + 1, 'ordinals are contiguous');
  }
  // Case 13/15/36: every canonical field is DB-derived.
  const expectedDigest = createHash('sha256').update(Buffer.from(E1, 'utf8')).digest('hex');
  for (const row of committed) {
    assert.equal(row.source_role, 'USER');
    assert.equal(row.speaker_state, 'RESOLVED');
    assert.equal(row.source_modality, 'TEXT');
    assert.equal(row.user_id, owner);
    assert.equal(row.session_id, session);
    assert.equal(row.source_turn_id, userTurn);
    assert.equal(row.source_content_sha256.toString('hex'), expectedDigest, 'the stored digest is the DB-computed source digest');
    assert.equal(row.committed_text, points(E1).slice(row.source_span_start, row.source_span_end).join(''),
      'committed wording equals the canonical source slice at the stored span');
  }
  // Case 29: no outbox event and no client-facing artefact is produced.
  const [{ count: events }] = await rows('SELECT count(*) count FROM public.runtime_event_outbox WHERE subject_turn_id=$1 AND event_type<>$2', [userTurn, 'ConversationTurnCompleted']);
  assert.equal(Number(events), 0, 'commitment produces no runtime event of any kind');

  // Case 3: USER and ASSISTANT source never merge into one CU.
  const assistantBatch = randomUUID();
  const [{ content: assistantContent }] = await rows('SELECT content FROM public.conversation_turns WHERE id=$1', [assistantTurn]);
  const assistantCommitted = await commit(session, owner, assistantTurn, assistantBatch, [unit(assistantContent, assistantContent)]);
  assert.equal(assistantCommitted.length, 1);
  assert.equal(assistantCommitted[0].source_role, 'ASSISTANT', 'assistant source commits under its own role');
  assert.equal(assistantCommitted[0].ordinal_within_turn, 0, 'the assistant turn has its own independent ordinal sequence');
  assert.equal(assistantCommitted[0].source_turn_id, assistantTurn);
  const merged = await rows('SELECT count(DISTINCT source_turn_id) turns FROM public.conversation_units WHERE commit_batch_id=ANY($1)', [[batch, assistantBatch]]);
  assert.equal(Number(merged[0].turns), 2, 'no CU spans both the USER and the ASSISTANT turn');
  return { userTurn, assistantTurn };
}

async function verifySegmentationRestraint(owner, session) {
  stage = 'segmentation restraint (cases 5, 6, 8, 37, 38)';
  // Case 6: a code-switching report may remain exactly one CU.
  const switched = await completedTurns(owner, session, CODE_SWITCH);
  const switchedRows = await commit(session, owner, switched.userTurn, randomUUID(), [unit(CODE_SWITCH, CODE_SWITCH)]);
  assert.equal(switchedRows.length, 1, 'Arabic/English code-switching alone creates no boundary');
  assert.equal(switchedRows[0].committed_text, CODE_SWITCH);

  // Case 5: internal punctuation alone forces no split - one CU spans it.
  const punctuated = await completedTurns(owner, session, SELF_CORRECTION);
  const wholeRows = await commit(session, owner, punctuated.userTurn, randomUUID(), [unit(SELF_CORRECTION, SELF_CORRECTION)]);
  assert.equal(wholeRows.length, 1, 'commas and ellipses alone do not force a boundary');

  // Case 8: genuine self-correction survives as committed source on a second
  // turn, unchanged and with no supersession semantics anywhere.
  const corrected = await completedTurns(owner, session, SELF_CORRECTION);
  const correctionRows = await commit(session, owner, corrected.userTurn, randomUUID(), [
    unit(SELF_CORRECTION, 'أنا كلمت أحمد امبارح...'), unit(SELF_CORRECTION, 'لا، قصدي حسام.')]);
  assert.deepEqual(correctionRows.map((r) => r.committed_text), ['أنا كلمت أحمد امبارح...', 'لا، قصدي حسام.'],
    'both the original report and the corrective material remain committed source');

  // Case 37: a repeated identical phrase commits at both exact locations.
  const repeated = await completedTurns(owner, session, REPEATED);
  const repeatedRows = await commit(session, owner, repeated.userTurn, randomUUID(), [
    unit(REPEATED, 'أحمد كلمني امبارح.', 1), unit(REPEATED, 'بعدها خالد سافر.', 1), unit(REPEATED, 'أحمد كلمني امبارح.', 2)]);
  assert.equal(repeatedRows.length, 3);
  assert.equal(repeatedRows[0].committed_text, repeatedRows[2].committed_text, 'both repetitions carry identical wording');
  assert.notEqual(repeatedRows[0].source_span_start, repeatedRows[2].source_span_start, 'at distinct canonical source positions');

  // Case 38: Arabic + supplementary-plane and combining-mark parity end to end.
  for (const content of [EMOJI, COMBINING]) {
    const fixture = await completedTurns(owner, session, content);
    const [first, second] = content === EMOJI
      ? ['الاجتماع كان 😀 كويس.', 'بس المدير زعل 👍 بعدين.']
      : ['قَالَ لِي أَحْمَد.', 'ثُمَّ سَافَرَ خَالِد.'];
    const stored = await commit(session, owner, fixture.userTurn, randomUUID(), [unit(content, first), unit(content, second)]);
    assert.deepEqual(stored.map((r) => r.committed_text), [first, second], 'no offset drift across supplementary-plane or combining characters');
    for (const row of stored) {
      assert.equal(row.committed_text, points(content).slice(row.source_span_start, row.source_span_end).join(''));
    }
  }
}

async function verifyZeroUnitBatch(owner, session) {
  stage = 'zero-CU batch (case 4)';
  const { userTurn } = await completedTurns(owner, session, E1);
  const batch = randomUUID();
  const result = await commit(session, owner, userTurn, batch, []);
  assert.deepEqual(result, [], 'a zero-CU batch commits no unit');
  const [row] = await rows('SELECT * FROM public.conversation_unit_commit_batches WHERE id=$1', [batch]);
  assert.equal(row.unit_count, 0, 'the batch is recorded, so "evaluated and found nothing" differs from "never evaluated"');
  assert.equal((await unitsOfTurn(userTurn)).length, 0);

  // A zero-CU batch does not advance the frontier: a later batch may still
  // commit from position zero.
  const later = await commit(session, owner, userTurn, randomUUID(), [unit(E1, 'أنا سبت الشغل امبارح.')]);
  assert.equal(later[0].source_span_start, 0, 'the zero-CU batch left the committed source frontier at 0');
  assert.equal(later[0].ordinal_within_turn, 0);
}

async function verifyRejections(owner, other, session, otherSession) {
  stage = 'fail-closed rejections (cases 9, 11, 12, 19, 20, 21, 39, 43)';
  const { userTurn } = await completedTurns(owner, session, E1);
  const length = cpLength(E1);

  // Case 12: out-of-range spans.
  await rejected(() => commit(session, owner, userTurn, randomUUID(), [{ unit_id: randomUUID(), span_start: 0, span_end: length + 1 }]), 'SPAN_OUT_OF_RANGE');
  await rejected(() => commit(session, owner, userTurn, randomUUID(), [{ unit_id: randomUUID(), span_start: 5, span_end: 5 }]), 'SPAN_OUT_OF_RANGE');
  await rejected(() => commit(session, owner, userTurn, randomUUID(), [{ unit_id: randomUUID(), span_start: 9, span_end: 4 }]), 'SPAN_OUT_OF_RANGE');

  // Case 9: a span sized for another turn's longer source is out of range here,
  // and a foreign turn/session fails closed before any span is considered.
  const longer = await completedTurns(owner, session, `${E1} ${E1}`);
  const longSpan = { unit_id: randomUUID(), span_start: 0, span_end: cpLength(`${E1} ${E1}`) };
  await rejected(() => commit(session, owner, userTurn, randomUUID(), [longSpan]), 'SPAN_OUT_OF_RANGE');
  await rejected(() => commit(otherSession, other, userTurn, randomUUID(), [unit(E1, 'أنا سبت الشغل امبارح.')]), 'FORBIDDEN', ['42501']);
  await rejected(() => commit(session, other, userTurn, randomUUID(), []), 'FORBIDDEN', ['42501']);
  assert.equal((await unitsOfTurn(longer.userTurn)).length, 0, 'no rejected attempt wrote anything');

  // Case 11: intra-batch overlap and backward order.
  const a = spanOf(E1, 'أنا سبت الشغل امبارح.');
  const b = spanOf(E1, 'وبالمناسبة أحمد كلمني.');
  await rejected(() => commit(session, owner, userTurn, randomUUID(), [
    { unit_id: randomUUID(), span_start: a.start, span_end: b.start + 3 },
    { unit_id: randomUUID(), span_start: b.start, span_end: b.end }]), 'SPAN_NOT_FORWARD_ORDERED');
  await rejected(() => commit(session, owner, userTurn, randomUUID(), [
    { unit_id: randomUUID(), span_start: b.start, span_end: b.end },
    { unit_id: randomUUID(), span_start: a.start, span_end: a.end }]), 'SPAN_NOT_FORWARD_ORDERED');

  // Case 39: a widened or malformed unit payload.
  for (const payload of [
    [{ unit_id: randomUUID(), span_start: 0, span_end: 5, offset: 0 }],
    [{ unit_id: randomUUID(), span_start: 0 }],
    [{ unit_id: 'not-a-uuid', span_start: 0, span_end: 5 }],
    [{ unit_id: randomUUID(), span_start: '0', span_end: 5 }],
    [{ unit_id: randomUUID(), span_start: 0.5, span_end: 5 }],
    [{ unit_id: randomUUID(), span_start: -1, span_end: 5 }],
    ['not an object'],
  ]) {
    await rejected(() => commit(session, owner, userTurn, randomUUID(), payload), 'INVALID_UNIT_PAYLOAD');
  }
  const duplicate = randomUUID();
  await rejected(() => commit(session, owner, userTurn, randomUUID(), [
    { unit_id: duplicate, span_start: a.start, span_end: a.end },
    { unit_id: duplicate, span_start: b.start, span_end: b.end }]), 'INVALID_UNIT_PAYLOAD');
  await rejected(() => commit(session, owner, userTurn, randomUUID(), [unit(E1, 'أنا')], ['', ...PROVENANCE.slice(1)]), 'INVALID_COMMIT_PROVENANCE');

  // Cases 19/20/21: provisional, cancelled, failed and superseded source.
  await identity('authenticated', owner);
  const cancelled = randomUUID();
  await rows('SELECT * FROM create_user_conversation_turn($1,$2,$3,$4)', [cancelled, session, E1, null]);
  await rows('SELECT * FROM cancel_conversation_turn($1,$2,$3,$4,$5,$6)', [session, owner, cancelled, randomUUID(), null, null]);
  await identity('postgres');
  await rejected(() => commit(session, owner, cancelled, randomUUID(), [unit(E1, 'أنا سبت الشغل امبارح.')]), 'SOURCE_TURN_NOT_COMMITTABLE', ['55000']);

  const failed = await createRawTurn(owner, session, E1, 'FAILED');
  await rejected(() => commit(session, owner, failed, randomUUID(), [unit(E1, 'أنا سبت الشغل امبارح.')]), 'SOURCE_TURN_NOT_COMMITTABLE', ['55000']);
  const superseded = await createRawTurn(owner, session, E1, 'SUPERSEDED');
  await rejected(() => commit(session, owner, superseded, randomUUID(), [unit(E1, 'أنا سبت الشغل امبارح.')]), 'SOURCE_TURN_NOT_COMMITTABLE', ['55000']);
  const received = await createRawTurn(owner, session, E1, 'RECEIVED');
  await rejected(() => commit(session, owner, received, randomUUID(), [unit(E1, 'أنا سبت الشغل امبارح.')]), 'SOURCE_TURN_NOT_COMMITTABLE', ['55000']);

  // Case 43: SYSTEM source is not committable in v1.
  const system = await createRawTurn(owner, session, E1, 'COMPLETED', 'SYSTEM');
  await rejected(() => commit(session, owner, system, randomUUID(), [unit(E1, 'أنا سبت الشغل امبارح.')]), 'UNSUPPORTED_SOURCE_ROLE');

  // Modality: a non-TEXT session cannot commit.
  const voiceSession = randomUUID();
  await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','VOICE')", [voiceSession, owner]);
  const voiceTurn = await createRawTurn(owner, voiceSession, E1, 'COMPLETED');
  await rejected(() => commit(voiceSession, owner, voiceTurn, randomUUID(), [unit(E1, 'أنا سبت الشغل امبارح.')]), 'UNSUPPORTED_SOURCE_MODALITY');
}

async function createRawTurn(owner, session, content, status, role = 'USER') {
  // Verifier-only fixture under postgres authority: the runtime has no producer
  // for SUPERSEDED or SYSTEM, so those states must be constructed directly.
  const id = randomUUID();
  await q('INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content) VALUES($1,$2,$3,$4,$5,$6)',
    [id, session, owner, role, status, content]);
  return id;
}

async function verifySourceIntegrityGuard(owner, session) {
  stage = 'source integrity guard (cases 7, 18, 36)';
  const { userTurn } = await completedTurns(owner, session, E1);
  const batch = randomUUID();
  const proposed = [unit(E1, 'أنا سبت الشغل امبارح.')];
  await commit(session, owner, userTurn, batch, proposed);

  // Case 7: if the canonical source were ever to change after commitment, the
  // DB-derived digest no longer matches and a replay fails closed - a committed
  // CU is never rewritten to match newer wording. (The runtime has no path that
  // mutates content; this fixture forces the condition under owner authority.)
  await q('UPDATE public.conversation_turns SET content=$2 WHERE id=$1', [userTurn, `${E1} إضافة`]);
  await rejected(() => commit(session, owner, userTurn, batch, proposed), 'COMMIT_BATCH_PAYLOAD_CONFLICT');
  const stored = await unitsOfTurn(userTurn);
  assert.equal(stored.length, 1, 'the committed unit survived untouched');
  assert.equal(stored[0].committed_text, 'أنا سبت الشغل امبارح.', 'committed wording was not rewritten');
  await q('UPDATE public.conversation_turns SET content=$2 WHERE id=$1', [userTurn, E1]);
}

async function verifyRetryAndConflict(owner, session) {
  stage = 'DB-derived idempotency (cases 16, 17, 18, 35)';
  const { userTurn } = await completedTurns(owner, session, E1);
  const batch = randomUUID();
  const unitId = randomUUID();
  const proposed = [unit(E1, 'أنا سبت الشغل امبارح.', 1, unitId)];

  const first = await commit(session, owner, userTurn, batch, proposed);
  const before = await snapshot(userTurn);

  // Case 16: exact retry returns the stored rows with zero mutation.
  const replay = await commit(session, owner, userTurn, batch, proposed);
  assert.deepEqual(replay.map((r) => r.id), first.map((r) => r.id), 'the retry returns exactly the stored units');
  assert.deepEqual(await snapshot(userTurn), before, 'the retry mutated nothing');
  const [{ count: batches }] = await rows('SELECT count(*) count FROM public.conversation_unit_commit_batches WHERE id=$1', [batch]);
  assert.equal(Number(batches), 1, 'no duplicate batch was created');

  // Case 18/35: the same batch id with any changed payload fails closed. There
  // is no fingerprint channel to replay, so the database re-derives identity.
  for (const changed of [
    [{ ...proposed[0], unit_id: randomUUID() }],
    [unit(E1, 'وبالمناسبة أحمد كلمني.', 1, unitId)],
    [...proposed, unit(E1, 'وبالمناسبة أحمد كلمني.')],
    [],
  ]) {
    await rejected(() => commit(session, owner, userTurn, batch, changed), 'COMMIT_BATCH_PAYLOAD_CONFLICT');
  }
  for (const provenance of [
    ['cu-anchor-mapper-v2', ...PROVENANCE.slice(1)],
    [PROVENANCE[0], 'stage-1.2-cu-commitment-v2', ...PROVENANCE.slice(2)],
    [...PROVENANCE.slice(0, 3), 'gpt-4o-mini', PROVENANCE[4]],
  ]) {
    await rejected(() => commit(session, owner, userTurn, batch, proposed, provenance), 'COMMIT_BATCH_PAYLOAD_CONFLICT');
  }
  assert.deepEqual(await snapshot(userTurn), before, 'every conflict left zero mutation');

  // Case 17: a distinct, forward batch for the same turn is permitted.
  const second = await commit(session, owner, userTurn, randomUUID(), [unit(E1, 'وبالمناسبة أحمد كلمني.')]);
  assert.equal(second.length, 1);
  assert.equal(second[0].ordinal_within_turn, 1, 'the second batch continues the global ordinal sequence');
  return { userTurn, batchA: batch, unitId };
}

async function verifyFrontierAndReplaySplit(owner, session) {
  stage = 'REV03A1-06 replay vs frontier (cases 31, 32, 33, 34, 44, 45, 46)';
  const { userTurn } = await completedTurns(owner, session, E1);
  const first = spanOf(E1, 'أنا سبت الشغل امبارح.');
  const second = spanOf(E1, 'وبالمناسبة أحمد كلمني.');
  const third = spanOf(E1, 'ممكن نرجع لموضوع السفر؟');

  const batchA = randomUUID();
  const unitA = randomUUID();
  const payloadA = [{ unit_id: unitA, span_start: first.start, span_end: first.end }];
  const committedA = await commit(session, owner, userTurn, batchA, payloadA);
  assert.equal(committedA[0].ordinal_within_turn, 0);

  // Case 33: a later suffix batch after a gap is permitted.
  const batchB = randomUUID();
  const committedB = await commit(session, owner, userTurn, batchB, [{ unit_id: randomUUID(), span_start: third.start, span_end: third.end }]);
  assert.equal(committedB[0].ordinal_within_turn, 1, 'the suffix batch continues the global ordinal sequence');
  assert.ok(committedB[0].source_span_start >= committedA[0].source_span_end, 'gaps are allowed, overlap is not');

  const afterTwoBatches = await snapshot(userTurn);

  // Case 31: a later disjoint-but-earlier batch is rejected.
  await rejected(() => commit(session, owner, userTurn, randomUUID(), [{ unit_id: randomUUID(), span_start: first.start, span_end: first.end }]),
    'SPAN_BEFORE_SOURCE_FRONTIER');
  // Case 32/46: a later batch landing in the earlier source gap, before the
  // current frontier, is rejected - the replay path never weakened this.
  await rejected(() => commit(session, owner, userTurn, randomUUID(), [{ unit_id: randomUUID(), span_start: second.start, span_end: second.end }]),
    'SPAN_BEFORE_SOURCE_FRONTIER');
  assert.deepEqual(await snapshot(userTurn), afterTwoBatches, 'every frontier rejection left zero mutation');

  // Case 44: replaying batch A EXACTLY, after batch B advanced the frontier,
  // succeeds and returns the exact stored A rows with zero mutation. Today's
  // frontier is never applied to a historical batch.
  const replayA = await commit(session, owner, userTurn, batchA, payloadA);
  assert.equal(replayA.length, 1, 'the historical batch replay succeeded despite the advanced frontier');
  assert.equal(replayA[0].id, unitA);
  assert.equal(replayA[0].ordinal_within_turn, 0, 'stored ordinals were returned, never re-derived from MAX(ordinal)+1');
  assert.equal(replayA[0].source_span_start, first.start);
  assert.equal(replayA[0].committed_text, 'أنا سبت الشغل امبارح.');
  assert.deepEqual(await snapshot(userTurn), afterTwoBatches, 'the historical replay mutated nothing');
  assert.deepEqual(replayA.map((r) => r.id), (await unitsOfBatch(batchA)).map((r) => r.id));

  // Case 45: replaying batch A with a changed CU id or span conflicts.
  await rejected(() => commit(session, owner, userTurn, batchA, [{ unit_id: randomUUID(), span_start: first.start, span_end: first.end }]),
    'COMMIT_BATCH_PAYLOAD_CONFLICT');
  await rejected(() => commit(session, owner, userTurn, batchA, [{ unit_id: unitA, span_start: first.start, span_end: first.end - 1 }]),
    'COMMIT_BATCH_PAYLOAD_CONFLICT');
  await rejected(() => commit(session, owner, userTurn, batchA, [{ unit_id: unitA, span_start: second.start, span_end: second.end }]),
    'COMMIT_BATCH_PAYLOAD_CONFLICT');
  assert.deepEqual(await snapshot(userTurn), afterTwoBatches, 'every replay conflict left zero mutation');

  // Case 27/46: after all of that, global source order is still monotone.
  const finalRows = await unitsOfTurn(userTurn);
  assert.deepEqual(finalRows.map((r) => r.ordinal_within_turn), [0, 1]);
  assert.ok(finalRows[1].source_span_start >= finalRows[0].source_span_end, 'ordinal order still follows canonical source order');
}

async function verifyAppendOnly(owner, session) {
  stage = 'append-only protection (cases 22, 23, 24)';
  const { userTurn } = await completedTurns(owner, session, E1);
  const batch = randomUUID();
  const committed = await commit(session, owner, userTurn, batch, [unit(E1, 'أنا سبت الشغل امبارح.')]);
  const target = committed[0].id;
  const before = await snapshot(userTurn);

  // Cases 22/23: even the table owner cannot rewrite or remove committed source.
  for (const attempt of [
    () => q('UPDATE public.conversation_units SET committed_text=$2 WHERE id=$1', [target, 'rewritten']),
    () => q('UPDATE public.conversation_units SET source_span_start=0, source_span_end=3 WHERE id=$1', [target]),
    () => q("UPDATE public.conversation_units SET source_role='ASSISTANT' WHERE id=$1", [target]),
    () => q("UPDATE public.conversation_units SET speaker_state='UNRESOLVED' WHERE id=$1", [target]),
    () => q('UPDATE public.conversation_units SET source_turn_id=$2 WHERE id=$1', [target, userTurn]),
    () => q('UPDATE public.conversation_units SET ordinal_within_turn=7 WHERE id=$1', [target]),
    () => q('DELETE FROM public.conversation_units WHERE id=$1', [target]),
    () => q('UPDATE public.conversation_unit_commit_batches SET policy_version=$2 WHERE id=$1', [batch, 'rewritten']),
    () => q('DELETE FROM public.conversation_unit_commit_batches WHERE id=$1', [batch]),
  ]) {
    await rejected(attempt, 'COMMITTED_CONVERSATIONAL_UNIT_IS_IMMUTABLE', ['55000']);
  }
  assert.deepEqual(await snapshot(userTurn), before, 'no mutation attempt changed anything');

  // Case 24: delete/reinsert identity rewriting. The delete is impossible, a
  // same-id reinsert violates the primary key, and a new-id reinsert is refused
  // by the forward-only frontier rule.
  await rejected(() => commit(session, owner, userTurn, randomUUID(), [
    { unit_id: target, span_start: 0, span_end: 5 }]), 'SPAN_BEFORE_SOURCE_FRONTIER');
  assert.deepEqual(await snapshot(userTurn), before, 'the substrate is append-only end to end');
}

async function verifyRuntimeAcl(owner, session) {
  stage = 'runtime ACL (cases 25, 28)';
  const { userTurn } = await completedTurns(owner, session, E1);
  const proposed = [unit(E1, 'أنا سبت الشغل امبارح.')];
  // `anon` and `authenticated` remain unable to reach the substrate at all, and
  // NO application role - service_role included - may read or write either CU
  // table directly. `service_role` may execute only the canonical producer,
  // granted by the T-03A2 activation migration; that grant and its complete
  // post-activation matrix are proven by verify-migration-0065.mjs.
  for (const role of ['authenticated', 'anon']) {
    await identity(role, role === 'authenticated' ? owner : null);
    await rejected(() => commit(session, owner, userTurn, randomUUID(), proposed), 'permission denied', ['42501']);
  }
  for (const role of ['authenticated', 'service_role', 'anon']) {
    await identity(role, role === 'authenticated' ? owner : null);
    await rejected(() => q('SELECT count(*) FROM public.conversation_units'), 'permission denied', ['42501']);
    await rejected(() => q('SELECT count(*) FROM public.conversation_unit_commit_batches'), 'permission denied', ['42501']);
    await rejected(() => q("INSERT INTO public.conversation_units(id,user_id,session_id,source_turn_id,commit_batch_id,source_role,speaker_state,source_modality,ordinal_within_turn,source_span_start,source_span_end,committed_text,source_content_sha256,session_position) VALUES($1,$2,$3,$4,$5,'USER','RESOLVED','TEXT',0,0,3,'أنا',sha256(convert_to('x','UTF8')),1)",
      [randomUUID(), owner, session, userTurn, randomUUID()]), 'permission denied', ['42501']);
  }
  await identity('postgres');
  assert.equal((await unitsOfTurn(userTurn)).length, 0, 'no application role produced a committed CU');
}

// --------------------------------------------------------------- concurrency
async function verifyConcurrency() {
  stage = 'concurrency (cases 34, 47)';
  const raceUser = randomUUID(), raceSession = randomUUID();
  const raceTurn = randomUUID();
  const clientA = new Client({ connectionString: databaseUrl });
  const clientB = new Client({ connectionString: databaseUrl });
  const first = spanOf(E1, 'أنا سبت الشغل امبارح.');
  const second = spanOf(E1, 'وبالمناسبة أحمد كلمني.');
  const third = spanOf(E1, 'ممكن نرجع لموضوع السفر؟');
  const batchA = randomUUID(), unitA = randomUUID();
  const payloadA = [{ unit_id: unitA, span_start: first.start, span_end: first.end }];
  const CALL = 'SELECT * FROM commit_conversation_units_v1($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)';
  const argsFor = (batch, units) => [raceSession, raceUser, raceTurn, batch, JSON.stringify(units), ...PROVENANCE];
  try {
    await q('INSERT INTO auth.users(id) VALUES($1)', [raceUser]);
    await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT')", [raceSession, raceUser]);
    await q("INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content) VALUES($1,$2,$3,'USER','COMPLETED',$4)", [raceTurn, raceSession, raceUser, E1]);
    await q(CALL, argsFor(batchA, payloadA));

    await clientA.connect(); await clientB.connect();

    // Case 47: a concurrent exact replay of the historical batch A and a new
    // forward suffix commit are serialized by the source-turn row lock. The
    // replay is unchanged, the suffix stays globally ordered, and no duplicate
    // or ordinal drift appears.
    await clientA.query('BEGIN');
    const suffix = await clientA.query(CALL, argsFor(randomUUID(), [{ unit_id: randomUUID(), span_start: second.start, span_end: second.end }]));
    assert.equal(suffix.rows.length, 1, 'the suffix commit succeeded inside the open transaction');
    assert.equal(suffix.rows[0].ordinal_within_turn, 1);

    const pendingReplay = clientB.query(CALL, argsFor(batchA, payloadA));
    pendingReplay.catch(() => undefined);
    const raced = await Promise.race([
      pendingReplay.then(() => 'COMPLETED', () => 'COMPLETED'),
      new Promise((resolve) => setTimeout(() => resolve('BLOCKED'), 750)),
    ]);
    assert.equal(raced, 'BLOCKED', 'the concurrent commit blocks on the source-turn row lock instead of racing');
    await clientA.query('COMMIT');

    const replayed = await pendingReplay;
    assert.equal(replayed.rows.length, 1, 'the historical replay still succeeds after the concurrent suffix committed');
    assert.equal(replayed.rows[0].id, unitA, 'the replay returned the exact stored unit');
    assert.equal(replayed.rows[0].ordinal_within_turn, 0, 'the replay did not drift to a new ordinal');
    assert.equal(replayed.rows[0].source_span_start, first.start);

    // Case 34: a NEW batch proposing source before the now-advanced frontier is
    // still refused, so the replay path did not weaken new-write ordering.
    await assert.rejects(
      clientB.query(CALL, argsFor(randomUUID(), [{ unit_id: randomUUID(), span_start: first.start, span_end: first.end }])),
      (error) => String(error.message).includes('SPAN_BEFORE_SOURCE_FRONTIER'));

    const final = (await q('SELECT * FROM public.conversation_units WHERE source_turn_id=$1 ORDER BY ordinal_within_turn', [raceTurn])).rows;
    assert.deepEqual(final.map((r) => r.ordinal_within_turn), [0, 1], 'exactly two units survived, contiguously numbered');
    assert.ok(final[1].source_span_start >= final[0].source_span_end, 'global source order survived the race');
    assert.equal(new Set(final.map((r) => r.id)).size, 2, 'no duplicate unit identity was created');

    // A further forward suffix still commits cleanly after the race.
    const tail = (await q(CALL, argsFor(randomUUID(), [{ unit_id: randomUUID(), span_start: third.start, span_end: third.end }]))).rows;
    assert.equal(tail[0].ordinal_within_turn, 2, 'the global ordinal sequence continued without drift');
  } finally {
    await clientA.end().catch(() => undefined);
    await clientB.end().catch(() => undefined);
    // Cleanup must bypass the append-only trigger. session_replication_role is
    // superuser-only, session-scoped, and changes no schema.
    await q("SET session_replication_role = 'replica'").catch(() => undefined);
    // The T-03A2 delivery events and the Session Semantic Clock row are removed
    // with the rest of the fixture, so the proof still leaves zero residue.
    await q('DELETE FROM public.conversation_unit_commit_events WHERE session_id=$1', [raceSession]).catch(() => undefined);
    await q('DELETE FROM public.conversation_units WHERE source_turn_id=$1', [raceTurn]).catch(() => undefined);
    await q('DELETE FROM public.conversation_unit_commit_batches WHERE source_turn_id=$1', [raceTurn]).catch(() => undefined);
    await q('DELETE FROM public.session_semantic_clocks WHERE session_id=$1', [raceSession]).catch(() => undefined);
    await q('DELETE FROM public.conversation_turns WHERE id=$1', [raceTurn]).catch(() => undefined);
    await q('DELETE FROM public.conversation_sessions WHERE id=$1', [raceSession]).catch(() => undefined);
    await q('DELETE FROM public.users WHERE id=$1', [raceUser]).catch(() => undefined);
    await q('DELETE FROM auth.users WHERE id=$1', [raceUser]).catch(() => undefined);
    await q("SET session_replication_role = 'origin'").catch(() => undefined);
    const [{ count: residue }] = await rows('SELECT count(*) count FROM public.conversation_units WHERE source_turn_id=$1', [raceTurn]);
    assert.equal(Number(residue), 0, 'the concurrency proof left zero fixture residue');
  }
}

async function main() {
  try {
    await client.connect();
    await verifyEnvironmentContract();
    await verifyStaticAuthority();
    await q('BEGIN');
    try {
      await identity('postgres');
      const owner = randomUUID(), other = randomUUID();
      const session = randomUUID(), otherSession = randomUUID();
      await q('INSERT INTO auth.users(id) VALUES($1),($2)', [owner, other]);
      await q("INSERT INTO public.conversation_sessions(id,user_id,status,channel) VALUES($1,$2,'ACTIVE','TEXT'),($3,$4,'ACTIVE','TEXT')",
        [session, owner, otherSession, other]);

      await verifyBasicCommitment(owner, session);
      await verifySegmentationRestraint(owner, session);
      await verifyZeroUnitBatch(owner, session);
      await verifyRejections(owner, other, session, otherSession);
      await verifySourceIntegrityGuard(owner, session);
      await verifyRetryAndConflict(owner, session);
      await verifyFrontierAndReplaySplit(owner, session);
      await verifyAppendOnly(owner, session);
      await verifyRuntimeAcl(owner, session);
      await identity('postgres');
    } finally { await q('ROLLBACK'); }
    await verifyConcurrency();
    console.log('Verified migration 0064: UTF-8/code-point/SHA-256 contract with JS parity, DB-derived canonical source authority with no caller forgery channel, forward-only committed source frontier making ordinal_within_turn global source order, REV03A1-06 replay/new-batch separation, DB-derived batch identity with tuple-by-tuple comparison, append-only protection, an activation gate that still bars anon/authenticated/PUBLIC and every direct table write, a NOT NULL session_position, zero outbox artefacts, and zero fixture residue.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const code = typeof error?.code === 'string' ? error.code : 'verification';
  console.error(`Committed conversational unit substrate verification failed at ${stage} (${code}): ${error?.message ?? error}`);
  process.exitCode = 1;
});
