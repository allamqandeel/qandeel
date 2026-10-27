// S8A-05 CP2 — Public World «Publish from QANDEEL»: the real-PostgreSQL verifier for migration 0180.
//
// It proves, against a fully migrated database, with synthetic humans and synthetic conversations only:
//   1. the boundary: every CP2 function is a pinned postgres-owned `public_compose_source_private` SECURITY DEFINER or a
//      pinned `public` INVOKER wrapper; `authenticated` executes exactly the seven commands; the package preparation,
//      the projection, the Understanding state and the bounded model inputs are executable by no application role; the
//      two relations are RLS-on, privilege-free and postgres-owned; the freeze seam still answers NOT_EVALUATED and is
//      asked first; exactly five functions move a Public lifecycle; the declared limits are the recorded ones;
//   2. the source (production posture, freeze CLOSED): a whole conversation, a contiguous range, separate whole
//      messages, emphasized messages, with and without QANDEEL's replies, resolved by the server from references only;
//      every refusal of the closed list (not whole messages, not mine, missing, an invalid message, nothing selected,
//      above the envelope; an Understanding item changed, under review, withheld or not current) answers with nothing
//      written; the paged dry run gives each whole unit once, in true Session Position order, with its speaker, message,
//      emphasis and honest gap; the preview reads every item for the deterministic warnings and asks for the one
//      acknowledgement when QANDEEL material is included, bound to one draft revision; no other human reaches any of
//      it; the closed freeze writes nothing; no Public Identity exists after any of it; Export My Data prints the source
//      as a reference, never a copied text; a Shared QANDEEL output and a QANDEEL reply through the older path stay
//      refused;
//   3. the controlled path (the freeze seam replaced inside this rolled-back transaction, then restored byte for byte):
//      the freeze seals exactly the previewed pages (A-3: the author's messages source content, QANDEEL's replies and the
//      Understanding summary analytical, the author the sole approver, the written text first); a retry answers the
//      first result; a source missing, changed or above the envelope at freeze is refused with nothing written; the
//      sealed order and presentation are immutable; published through the simulated CW2-08 seam a reader pages the
//      served items and search reads the bounded document; the bounded model inputs never exceed 24 KB / 6 KB; a
//      never-published discard erases every Public byte, digest, source pointer, title and search document of every
//      class, leaving the words only in the author's own conversation;
//   4. concurrency (committed fixtures, freeze closed): two sessions changing one draft's source serialize on the draft,
//      the second answering STALE; launch closure: the freeze seam and the CW2-08 seam answer NOT_EVALUATED again.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';
import { APP_ROLES, T, createRuntime, runVerifier } from './public-runtime-verifier-support.mjs';

const rt = createRuntime(process.env.DATABASE_URL);
const { q, rows, asRole, rejected } = rt;
const own = async (text, values = []) => { await asRole('postgres'); return rows(text, values); };
const as = async (uid) => asRole('authenticated', uid);
const first = async (text, values = []) => (await rows(text, values))[0];
/** A unique letters-only marker: a UUID's digits could read as a phone number to the privacy notes. */
const marker = () => randomUUID().replace(/[^a-f]/gu, '').slice(0, 12);
const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

const SCHEMA = 'public_compose_source_private';
const COMPOSE = 'public_compose_private';
const FREEZE_SEAM = 'public_compose_private.resolve_topic_freeze_clearance_v1()';
const COMMANDS = {
  set_own_topic_conversation_source_v1: 'uuid, bigint, uuid, integer, integer, boolean, integer[], integer[]',
  set_own_topic_understanding_source_v1: 'uuid, bigint, uuid, integer',
  clear_own_topic_source_v1: 'uuid, bigint',
  acknowledge_own_topic_source_v1: 'uuid, bigint',
  read_own_topic_source_v1: 'uuid',
  read_own_topic_items_v1: 'uuid, integer',
  read_public_topic_items_v1: 'uuid, integer',
};
const INTERNAL = ['reject_presentation_mutation_v1', 'reject_search_document_mutation_v1', 'envelope_units_v1',
  'envelope_bytes_v1', 'page_size_v1', 'search_document_bytes_v1', 'interpreter_input_bytes_v1', 'qandeel_context_bytes_v1',
  'bounded_text_v1', 'understanding_state_v1', 'draft_source_items_v1', 'draft_source_outcome_v1', 'sourced_readiness_v1',
  'prepare_sourced_package_v1', 'bounded_package_input_v1', 'interpreter_input_v1', 'qandeel_context_v1'];
const UNREACHABLE = [
  `${SCHEMA}.prepare_sourced_package_v1(uuid, uuid, uuid, uuid, uuid, ${COMPOSE}.topic_drafts, text, integer)`,
  `${SCHEMA}.draft_source_items_v1(uuid, ${COMPOSE}.topic_drafts)`,
  `${SCHEMA}.draft_source_outcome_v1(uuid, ${COMPOSE}.topic_drafts)`,
  `${SCHEMA}.understanding_state_v1(uuid, uuid, integer)`,
  `${SCHEMA}.bounded_package_input_v1(uuid, integer)`,
  `${SCHEMA}.interpreter_input_v1(uuid)`,
  `${SCHEMA}.qandeel_context_v1(uuid)`,
];
const RELATIONS = ['item_presentation', 'version_search_documents'];
const WORLD = ['-4611686018427387904', '-4611686018427387904', '4611686018427387903', '4611686018427387903'];

// ---- the owner commands, as the human's own application role
const setConversation = async (uid, draft, revision, session, firstSp, lastSp, includeQandeel = true, excluded = [], emphasized = []) => {
  await as(uid);
  return first('SELECT * FROM public.set_own_topic_conversation_source_v1($1, $2, $3, $4, $5, $6, $7::int[], $8::int[])',
    [draft, revision, session, firstSp, lastSp, includeQandeel, excluded, emphasized]);
};
const setUnderstanding = async (uid, draft, revision, hypothesis, version) => {
  await as(uid);
  return first('SELECT * FROM public.set_own_topic_understanding_source_v1($1, $2, $3, $4)', [draft, revision, hypothesis, version]);
};
const clearSource = async (uid, draft, revision) => { await as(uid); return first('SELECT * FROM public.clear_own_topic_source_v1($1, $2)', [draft, revision]); };
const acknowledge = async (uid, draft, revision) => { await as(uid); return first('SELECT * FROM public.acknowledge_own_topic_source_v1($1, $2)', [draft, revision]); };
const readSource = async (uid, draft) => { await as(uid); return rows('SELECT * FROM public.read_own_topic_source_v1($1)', [draft]); };
const itemsPage = async (uid, draft, page = 1) => { await as(uid); return first('SELECT * FROM public.read_own_topic_items_v1($1, $2)', [draft, page]); };
const publicPage = async (uid, experience, page = 1) => { await as(uid); return first('SELECT * FROM public.read_public_topic_items_v1($1, $2)', [experience, page]); };
const save = async (uid, draft, revision, title, body, section = null) => {
  await as(uid);
  return first('SELECT * FROM public.save_own_topic_draft_v1($1, $2, $3, $4, $5)', [draft, revision, title, body, section]);
};
const readDraft = async (uid, draft) => { await as(uid); return rows('SELECT * FROM public.read_own_topic_draft_v1($1)', [draft]); };
const preview = async (uid, draft) => { await as(uid); return first('SELECT * FROM public.preview_own_topic_draft_v1($1)', [draft]); };
const freeze = async (uid, draft, revision, command = randomUUID()) => {
  await as(uid);
  return first('SELECT * FROM public.freeze_own_topic_draft_v1($1, $2, $3)', [command, draft, revision]);
};
const discard = async (uid, experience) => {
  await as(uid);
  return (await first('SELECT * FROM public.discard_own_unpublished_topic_v1($1, $2)', [randomUUID(), experience])).outcome;
};
/** Every page of a topic's items, with each page's own metadata checked on the way. */
async function allPages(read) {
  const pages = [];
  for (let page = 1; ; page += 1) {
    const p = await read(page);
    pages.push(p);
    if (page >= Math.max(1, p.page_count)) break;
  }
  return pages;
}

// ---- the S5-03A / S5-03B paths a sourced topic reuses unchanged
const requestProposal = async (uid, experience) => { await as(uid); return first('SELECT * FROM public.request_own_public_semantic_proposal_v1($1, $2)', [randomUUID(), experience]); };
const recordOutcome = async (work, lens, meaning, primary) => {
  await asRole('service_role');
  return (await first('SELECT * FROM public.record_public_semantic_work_outcome_v1($1, $2, $3, $4, $5::text[], $6::text[], $7)',
    [work, 'PROPOSED', lens, meaning, primary, [], 'The words describe the situation the author wrote about.'])).outcome;
};
const commitWork = async (uid, work) => { await as(uid); return first('SELECT * FROM public.commit_own_public_semantic_work_v1($1)', [work]); };
const acceptSemantic = async (uid, experience, interpretation) => {
  await as(uid); return (await first('SELECT * FROM public.accept_own_public_semantic_proposal_v1($1, $2, $3)', [randomUUID(), experience, interpretation])).outcome;
};
const requestPlace = async (uid, experience) => { await as(uid); return first('SELECT * FROM public.request_own_public_spatial_placement_v1($1, $2)', [randomUUID(), experience]); };
const commitPlace = async (request, x, y) => {
  await asRole('service_role');
  return (await first('SELECT * FROM public.commit_public_spatial_placement_v1($1, $2, $3, $4)', [request, 'test.layout.v1', x, y])).outcome;
};
const fieldSearch = async (uid, query) => {
  await as(uid);
  return rows('SELECT * FROM public.search_public_semantic_field_v1($1)', [query]).then((r) => r.map((m) => m.experience_id));
};
const sectionMatches = async (uid, query, section) => {
  await as(uid);
  return rows('SELECT * FROM public.read_public_section_topic_matches_v1($1, $2)', [query, section]).then((r) => r.map((m) => m.experience_id));
};

const footprint = async (uid) => (await own(`SELECT
    (SELECT count(*) FROM ${T.IDENTITIES} WHERE user_id = $1)::int identities,
    (SELECT count(*) FROM ${T.CONTROLLERS} WHERE controller_user_id = $1)::int experiences,
    (SELECT count(*) FROM ${T.MANIFESTS} WHERE publisher_user_id = $1)::int manifests,
    (SELECT count(*) FROM public.public_identity_commands WHERE actor_user_id = $1)::int identity_commands`, [uid]))[0];
const packageOf = async (experience) => own(`SELECT it.package_item_id, it.item_ordinal, it.derivative_classification,
    it.public_body_digest, it.content_state, it.content_erased_at, p.source_class, p.personal_conversation_unit_id unit,
    p.personal_owner_user_id owner, p.captured_source_digest, p.captured_digest_erased_at, b.public_text_body body,
    a.resolution_state, a.required_approver_count, ip.display_position, ip.item_role, ip.source_session_position sp,
    ip.message_ordinal, ip.emphasized, ip.gap_before
  FROM ${T.ITEMS} it JOIN ${T.PROVENANCE} p ON p.package_item_id = it.package_item_id
  JOIN ${T.ITEM_AUTHORITY} a ON a.package_item_id = it.package_item_id
  LEFT JOIN ${T.BODIES} b ON b.package_item_id = it.package_item_id
  LEFT JOIN ${SCHEMA}.item_presentation ip ON ip.package_item_id = it.package_item_id
  WHERE it.experience_id = $1 ORDER BY it.item_ordinal`, [experience]);
const experienceOf = async (experience) => (await own(`SELECT e.current_lifecycle, e.current_experience_version_id v,
    ve.package_manifest_version_id m FROM ${T.EXPERIENCES} e LEFT JOIN ${T.VERSIONS} ve ON ve.id = e.current_experience_version_id
   WHERE e.id = $1`, [experience]))[0];

/** Every text-like column of every application relation, asked for the exact bytes and their SHA-256 hex digest. */
async function censusOf(text) {
  await asRole('postgres');
  const hex = sha(text);
  const columns = await rows(`SELECT n.nspname s, c.relname t, a.attname col, format_type(a.atttypid, a.atttypmod) ty
      FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind IN ('r', 'p') AND a.attnum > 0 AND NOT a.attisdropped
       AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
       AND a.atttypid IN ('text'::regtype, 'varchar'::regtype, 'bpchar'::regtype, 'bytea'::regtype, 'jsonb'::regtype, 'json'::regtype)`);
  const hits = [];
  for (const { s, t, col, ty } of columns) {
    const ident = `"${s}"."${t}"`;
    const sql = ty === 'bytea'
      ? `SELECT count(*) n FROM ${ident} WHERE "${col}" = decode($1, 'hex')`
      : `SELECT count(*) n FROM ${ident} WHERE strpos("${col}"::text, $2) > 0 OR strpos("${col}"::text, $1) > 0`;
    const [{ n }] = await rows(sql, ty === 'bytea' ? [hex] : [hex, text]);
    if (Number(n) > 0) hits.push(`${s}.${t}.${col}`);
  }
  return hits.sort();
}

// ---- synthetic Personal conversations, in the exact shape the commit path leaves behind
/** messages: [{ role: 'USER' | 'ASSISTANT', units: [text, ...] }]. One turn per message; units in Session Position order. */
async function conversation(uid, messages) {
  await asRole('postgres');
  const session = randomUUID();
  await q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [session, uid]);
  let sp = 0;
  const units = [];
  for (const [index, message] of messages.entries()) {
    const turn = randomUUID();
    const batch = randomUUID();
    await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content)
             VALUES ($1, $2, $3, $4, 'COMPLETED', 'turn')`, [turn, session, uid, message.role]);
    await q(`INSERT INTO public.conversation_unit_commit_batches
               (id, user_id, session_id, source_turn_id, canonical_fingerprint, source_content_sha256, unit_count,
                evaluator_version, policy_version, segmentation_provider, segmentation_model, segmentation_prompt_version)
             VALUES ($1, $2, $3, $4, sha256(convert_to($5, 'UTF8')), sha256(convert_to($6, 'UTF8')), $7, 'v1', 'v1', 'PROBE', 'probe', 'v1')`,
    [batch, uid, session, turn, `fp ${turn}`, `t ${turn}`, message.units.length]);
    for (const [ordinal, text] of message.units.entries()) {
      sp += 1;
      const id = randomUUID();
      await q(`INSERT INTO public.conversation_units
                 (id, user_id, session_id, source_turn_id, commit_batch_id, source_role, speaker_state, source_modality,
                  ordinal_within_turn, source_span_start, source_span_end, committed_text, source_content_sha256, session_position)
               VALUES ($1, $2, $3, $4, $5, $6, 'RESOLVED', 'TEXT', $7, 0, $8, $9, sha256(convert_to($9, 'UTF8')), $10)`,
      [id, uid, session, turn, batch, message.role, ordinal, [...text].length, text, sp]);
      units.push({ id, sp, role: message.role, text, message: index + 1, firstOfMessage: ordinal === 0 });
    }
  }
  await q('UPDATE public.session_semantic_clocks SET current_sp = $2 WHERE session_id = $1', [session, sp]);
  return { session, units, last: sp };
}
/** A long synthetic conversation, written set-based: <messages> messages of one unit each, USER / ASSISTANT alternating. */
async function longConversation(uid, messages, bytesPerUnit) {
  await asRole('postgres');
  const session = randomUUID();
  await q("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [session, uid]);
  await q(`INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content)
           SELECT md5($1::text || m)::uuid, $1::uuid, $2, CASE WHEN m % 2 = 1 THEN 'USER' ELSE 'ASSISTANT' END, 'COMPLETED', 'turn'
             FROM generate_series(1, $3::int) m`, [session, uid, messages]);
  await q(`INSERT INTO public.conversation_unit_commit_batches
             (id, user_id, session_id, source_turn_id, canonical_fingerprint, source_content_sha256, unit_count,
              evaluator_version, policy_version, segmentation_provider, segmentation_model, segmentation_prompt_version)
           SELECT md5('b' || $1::text || m)::uuid, $2, $1::uuid, md5($1::text || m)::uuid, sha256(convert_to('fp' || m, 'UTF8')),
                  sha256(convert_to('t' || m, 'UTF8')), 1, 'v1', 'v1', 'PROBE', 'probe', 'v1'
             FROM generate_series(1, $3::int) m`, [session, uid, messages]);
  await q(`INSERT INTO public.conversation_units
             (id, user_id, session_id, source_turn_id, commit_batch_id, source_role, speaker_state, source_modality,
              ordinal_within_turn, source_span_start, source_span_end, committed_text, source_content_sha256, session_position)
           SELECT gen_random_uuid(), $2, $1::uuid, md5($1::text || m)::uuid, md5('b' || $1::text || m)::uuid,
                  CASE WHEN m % 2 = 1 THEN 'USER' ELSE 'ASSISTANT' END, 'RESOLVED', 'TEXT', 0, 0, char_length(x.t), x.t,
                  sha256(convert_to(x.t, 'UTF8')), m
             FROM generate_series(1, $3::int) m
            CROSS JOIN LATERAL (SELECT rpad('رسالة ' || m || ' ', $4::int / 2, 'ك') AS t) x`, [session, uid, messages, bytesPerUnit]);
  await q('UPDATE public.session_semantic_clocks SET current_sp = $2 WHERE session_id = $1', [session, messages]);
  return { session, last: messages };
}
async function hypothesis(uid, statement, { status = 'ACTIVE', withheld = false } = {}) {
  await asRole('postgres');
  const [h] = await rows(`INSERT INTO public.hypotheses (id, user_id, statement, type, domain, scope, origin, status,
      supporting_evidence_ids, contradicting_evidence_ids, assumptions)
    VALUES (gen_random_uuid(), $1, $2, 'BEHAVIORAL', 'WORK', 'verifier-0180 scope', 'SYSTEM_GENERATED', $3, $4, '{}',
            ARRAY['verifier-0180 assumption never published']) RETURNING id, version`,
  [uid, statement, status, withheld ? [`memory:${randomUUID()}`] : []]);
  return h;
}

// --------------------------------------------------------------------------------------------------------- 1. boundary
async function verifyBoundary() {
  await asRole('postgres');
  const fns = await rows(`SELECT p.proname, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) owner
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = $1 ORDER BY 1`, [SCHEMA]);
  assert.deepEqual(fns.map((f) => f.proname).sort(), [...Object.keys(COMMANDS), ...INTERNAL].sort(),
    'B01 the source schema holds exactly the S8A-05 CP2 functions, one overload each');
  for (const f of fns) {
    assert.equal(f.prosecdef, true, `B01 ${f.proname} is a definer`);
    assert.equal(f.owner, 'postgres', `B01 ${f.proname} is postgres-owned`);
    // The package preparation also pins its plan shape: with the statistics of a near-empty package table PostgreSQL
    // plans each foreign-key check as a scan over the rows this very statement wrote (quadratic at 10,000 items).
    // The projection (B.4) and the preparation hold up to the 8 MB envelope in memory (work_mem 32MB, the 3 s gate).
    const pinned = { prepare_sourced_package_v1: ['search_path=""', 'enable_seqscan=off', 'work_mem=32MB'],
      draft_source_items_v1: ['search_path=""', 'work_mem=32MB'] };
    assert.deepEqual(f.proconfig, pinned[f.proname] ?? ['search_path=""'], `B01 ${f.proname} pins an empty search_path`);
  }
  for (const [name, args] of Object.entries(COMMANDS)) {
    const wrapper = await rt.functionPosture(`public.${name}(${args})`);
    assert.equal(wrapper.secdef, false, `B02 public.${name} is an INVOKER wrapper`);
    assert.deepEqual(wrapper.config, ['search_path=""']);
    assert.ok(wrapper.prosrc.includes(`${SCHEMA}.${name}(`), `B02 public.${name} is one call into its definer`);
    for (const p of await rt.inputParameters(`public.${name}(${args})`)) {
      assert.doesNotMatch(p, /user|account|actor|owner|ref|label|approver|authority|audience|identity|publisher|controller|text|body|role|speaker|order/u,
        `B02 ${name} accepts no ${p}: the human is auth.uid(), and no text, speaker or order is ever the client's`);
    }
  }
  const executable = await rows(`SELECT r.rolname, n.nspname || '.' || p.proname fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (SELECT unnest($2::text[]) rolname) r
    WHERE EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r.rolname)
      AND (n.nspname = $3 OR (n.nspname = 'public' AND p.proname = ANY($1::text[])))
      AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2`, [Object.keys(COMMANDS), APP_ROLES, SCHEMA]);
  assert.deepEqual(executable.map((e) => `${e.rolname} ${e.fn}`).sort(),
    Object.keys(COMMANDS).flatMap((n) => [`authenticated public.${n}`, `authenticated ${SCHEMA}.${n}`]).sort(),
    'B03 authenticated runs the seven commands only; anon and the server channel run nothing; no helper is reachable');
  for (const role of ['public', ...APP_ROLES]) {
    for (const fn of UNREACHABLE) assert.equal(await rt.canExecute(role, fn), false, `B03 ${role} must not execute ${fn}`);
  }
  for (const rel of RELATIONS) {
    const [c] = await rows(`SELECT c.relrowsecurity rls, pg_get_userbyid(c.relowner) owner,
        (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) policies
      FROM pg_class c WHERE c.oid = $1::regclass`, [`${SCHEMA}.${rel}`]);
    assert.deepEqual(c, { rls: true, owner: 'postgres', policies: 0 }, `B04 ${rel} is RLS-on, policy-free, postgres-owned`);
    for (const role of APP_ROLES) {
      const [{ any }] = await rows(`SELECT has_table_privilege($1, $2, 'SELECT') OR has_table_privilege($1, $2, 'INSERT')
        OR has_table_privilege($1, $2, 'UPDATE') OR has_table_privilege($1, $2, 'DELETE') AS any`, [role, `${SCHEMA}.${rel}`]);
      assert.equal(any, false, `B04 ${role} holds no privilege on ${rel}`);
    }
  }
  // B05 no CP2 relation names an account, and nothing references a draft: the drafts keep the CP1 deletion posture.
  assert.deepEqual(await rows(`SELECT c.conrelid::regclass::text rel FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace WHERE c.contype = 'f' AND n.nspname = $1
      AND c.confrelid IN ('public.users'::regclass, 'public.conversation_units'::regclass, 'public.hypotheses'::regclass,
                          'public_compose_private.topic_drafts'::regclass)`, [SCHEMA]), [],
  'B05 no CP2 relation references an account, a unit, an Understanding item or a draft');
  // B06 the freeze is closed and asks the seam first; the declared limits are the recorded ones.
  assert.ok((await rt.functionPosture(FREEZE_SEAM)).prosrc.includes('NOT_EVALUATED'), 'B06 the freeze seam answers NOT_EVALUATED');
  const freezeBody = (await rt.functionPosture(`${COMPOSE}.freeze_own_topic_draft_v1(uuid, uuid, bigint)`)).prosrc;
  assert.ok(freezeBody.indexOf('resolve_topic_freeze_clearance_v1') < freezeBody.indexOf('account_deletion_pending_v1')
    && freezeBody.indexOf('resolve_topic_freeze_clearance_v1') < freezeBody.indexOf('draft_source_outcome_v1'),
  'B06 the freeze asks the seam before it locks, reads or resolves anything');
  const [limits] = await rows(`SELECT ${SCHEMA}.envelope_units_v1() u, ${SCHEMA}.envelope_bytes_v1() b, ${SCHEMA}.page_size_v1() p,
    ${SCHEMA}.search_document_bytes_v1() s, ${SCHEMA}.interpreter_input_bytes_v1() i, ${SCHEMA}.qandeel_context_bytes_v1() c`);
  assert.deepEqual(limits, { u: 10000, b: 8388608, p: 50, s: 8192, i: 24576, c: 6144 }, 'B06 the declared limits');
  // B07 nothing CP2 owns reaches publication, the CW2-08 seam, placement or a semantic request.
  for (const b of await rows(`SELECT p.proname, p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = $1`, [SCHEMA])) {
    assert.doesNotMatch(b.prosrc, /publish_public_experience_v1|resolve_public_publication_prerequisites_v1|commit_public_spatial_placement_v1|request_own_public_spatial_placement_v1|request_own_public_semantic_proposal_v1|'PUBLISHED'/u,
      `B07 ${b.proname} reaches nothing beyond READY_FOR_REVIEW`);
  }
  const writers = await rows(`SELECT pr.proname FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
      WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
        AND (pr.prosrc ~ 'UPDATE public\\.public_experiences e\\s+SET current_lifecycle = '''
          OR pr.prosrc ~ 'INSERT INTO public\\.public_experiences\\s+\\(id, public_world_singleton') ORDER BY 1`);
  assert.equal(writers.length, 5, 'B07 still exactly five functions move a Public Experience lifecycle');
}

// ------------------------------------------------------------------------------------------- 2. the source, gate closed
async function verifySource(f) {
  const before = await footprint(f.mohamed);
  assert.deepEqual(before, { identities: 0, experiences: 0, manifests: 0, identity_commands: 0 }, 'fixture: no Public footprint');
  const c = f.chat;
  const all = c.units;
  const firstOf = (message) => all.find((u) => u.message === message).sp;

  // S01 the whole conversation with QANDEEL's replies: created from references only, every whole unit once, in order.
  f.dc = randomUUID();
  assert.deepEqual(await setConversation(f.mohamed, f.dc, 0, c.session, 1, c.last), { outcome: 'CREATED', draft_revision: '1' }, 'S01 created');
  const [src] = await readSource(f.mohamed, f.dc);
  assert.deepEqual([src.source_kind, src.session_id, src.first_sp, src.last_sp, src.include_qandeel, src.excluded_sps, src.emphasized_sps, src.acknowledged],
    ['CONVERSATION', c.session, 1, c.last, true, [], [], false], 'S01 the reference, nothing else');
  const whole = await itemsPage(f.mohamed, f.dc);
  assert.deepEqual([whole.draft_state, whole.outcome, whole.item_count, whole.page, whole.page_count], ['EDITING', 'RESOLVED', all.length, 1, 1]);
  assert.deepEqual(whole.items.map((i) => [i.position, i.role, i.sessionPosition, i.message, i.emphasized, i.gapBefore, i.text]),
    all.map((u, k) => [k + 1, u.role === 'USER' ? 'YOUR_MESSAGE' : 'QANDEEL_REPLY', u.sp, u.message, false, false, u.text]),
    'S01 one item per whole committed unit, true Session Position order, its speaker and its message, the exact text');
  assert.equal(Number(whole.text_bytes), all.reduce((n, u) => n + Buffer.byteLength(u.text), 0), 'S01 the exact size');
  // S02 compare-and-set: an equivalent retry answers the revision it produced; a different change on the old one is STALE.
  assert.deepEqual(await setConversation(f.mohamed, f.dc, 0, c.session, 1, c.last), { outcome: 'SAVED', draft_revision: '1' }, 'S02 retry');
  assert.deepEqual(await setConversation(f.mohamed, f.dc, 0, c.session, 1, firstOf(3) - 1), { outcome: 'STALE', draft_revision: '1' }, 'S02 STALE');
  // S03 a contiguous range of whole messages; and the selection refusals, each writing nothing.
  const rangeEnd = firstOf(4) - 1;
  assert.deepEqual(await setConversation(f.mohamed, f.dc, 1, c.session, firstOf(2), rangeEnd), { outcome: 'SAVED', draft_revision: '2' }, 'S03 a range');
  const range = await itemsPage(f.mohamed, f.dc);
  assert.deepEqual(range.items.map((i) => i.sessionPosition), all.filter((u) => u.sp >= firstOf(2) && u.sp <= rangeEnd).map((u) => u.sp), 'S03 exactly the range');
  assert.equal(range.items[0].message, 1, 'S03 the first message of the topic is message 1');
  const refusals = [
    [[c.session, 2, c.last], 'NOT_WHOLE_MESSAGES', 'starts inside a message'],
    [[c.session, 1, firstOf(4)], 'NOT_WHOLE_MESSAGES', 'ends inside a message'],
    [[c.session, 1, c.last + 1], 'SOURCE_UNAVAILABLE', 'beyond the conversation'],
    [[f.hadirChat.session, 1, f.hadirChat.last], 'SOURCE_UNAVAILABLE', 'another human\'s conversation (one neutral answer)'],
    [[randomUUID(), 1, 3], 'SOURCE_UNAVAILABLE', 'no such conversation'],
    [[c.session, 1, c.last, true, [2]], 'SELECTION_INVALID', 'an excluded position inside a message'],
    [[c.session, 1, c.last, true, [], [c.last + 5]], 'SELECTION_INVALID', 'an emphasized position outside the range'],
    [[c.session, 1, c.last, true, [...new Set(all.map((u) => firstOf(u.message)))]], 'NOTHING_SELECTED', 'every message left out'],
    [[c.session, firstOf(2), firstOf(2), false], 'NOTHING_SELECTED', 'only a QANDEEL reply, without QANDEEL'],
  ];
  for (const [[session, a, b, qandeel = true, excluded = [], emphasized = []], outcome, why] of refusals) {
    assert.deepEqual(await setConversation(f.mohamed, f.dc, 2, session, a, b, qandeel, excluded, emphasized), { outcome, draft_revision: '2' }, `S03 ${why}`);
  }
  assert.equal((await readSource(f.mohamed, f.dc))[0].first_sp, firstOf(2), 'S03 a refused selection changed nothing');
  assert.equal((await setConversation(f.mohamed, randomUUID(), 0, c.session, 0, 3)).outcome, 'INVALID', 'S03 positions start at 1');
  assert.equal((await setConversation(f.mohamed, randomUUID(), 0, c.session, 1, c.last, true, Array.from({ length: 10001 }, (_, k) => k + 1))).outcome,
    'INVALID', 'S03 a list is bounded');

  // S04 separate whole messages (everything else excluded) with QANDEEL's replies left out, and an emphasis: honest gaps.
  const excluded = [firstOf(3)];
  const emphasized = [firstOf(5)];
  assert.deepEqual(await setConversation(f.mohamed, f.dc, 2, c.session, 1, c.last, false, [...excluded, excluded[0]], emphasized),
    { outcome: 'SAVED', draft_revision: '3' }, 'S04 separate messages, without QANDEEL, one emphasized');
  assert.deepEqual((await readSource(f.mohamed, f.dc))[0].excluded_sps, excluded, 'S04 the list is stored once, sorted');
  const chosen = all.filter((u) => u.role === 'USER' && u.message !== 3);
  const picked = await itemsPage(f.mohamed, f.dc);
  assert.deepEqual(picked.items.map((i) => [i.sessionPosition, i.role, i.emphasized]),
    chosen.map((u) => [u.sp, 'YOUR_MESSAGE', u.message === 5]), 'S04 only my chosen messages, the emphasis on its message (every unit of it)');
  assert.deepEqual(picked.items.map((i) => i.gapBefore), chosen.map((u, k) => k > 0 && chosen[k - 1].sp !== u.sp - 1),
    'S04 a gap «…» exactly where something between two kept units was left out');
  // S05 the preview: readiness in order, every item read for the warnings, the acknowledgement only for QANDEEL material.
  let p = await preview(f.mohamed, f.dc);
  assert.equal(p.readiness, 'TITLE_TOO_SHORT', 'S05 a sourced draft still needs its title');
  assert.deepEqual(p.privacy_notes, ['CONTACT_NUMBER'], 'S05 the number inside one of my messages is noted');
  assert.deepEqual(await save(f.mohamed, f.dc, 3, f.titleC, '', 'family'), { outcome: 'SAVED', draft_revision: '4' }, 'S05 the title and section (the CP1 save)');
  assert.equal((await readSource(f.mohamed, f.dc))[0].source_kind, 'CONVERSATION', 'S05 the CP1 save keeps the source');
  p = await preview(f.mohamed, f.dc);
  assert.deepEqual([p.readiness, p.title, p.body, p.section_key], ['READY', f.titleC, '', 'family'], 'S05 my own words only: no acknowledgement asked');
  assert.deepEqual(await setConversation(f.mohamed, f.dc, 4, c.session, 1, c.last, true, [], emphasized), { outcome: 'SAVED', draft_revision: '5' });
  p = await preview(f.mohamed, f.dc);
  assert.equal(p.readiness, 'ACKNOWLEDGEMENT_REQUIRED', 'S05 QANDEEL material: the one acknowledgement is asked');
  assert.deepEqual(p.privacy_notes, ['CONTACT_NUMBER', 'EMAIL_ADDRESS', 'LINK'], 'S05 QANDEEL\'s replies are read for the warnings too');
  assert.deepEqual(await acknowledge(f.mohamed, f.dc, 4), { outcome: 'STALE', draft_revision: '5' }, 'S05 bound to the current revision');
  assert.deepEqual(await acknowledge(f.mohamed, f.dc, 5), { outcome: 'ACKNOWLEDGED', draft_revision: '5' }, 'S05 acknowledged');
  assert.deepEqual(await acknowledge(f.mohamed, f.dc, 5), { outcome: 'ACKNOWLEDGED', draft_revision: '5' }, 'S05 idempotent, not an edit');
  assert.equal((await preview(f.mohamed, f.dc)).readiness, 'READY', 'S05 ready');
  assert.deepEqual(await save(f.mohamed, f.dc, 5, f.titleC, f.writtenC, 'family'), { outcome: 'SAVED', draft_revision: '6' });
  assert.equal((await preview(f.mohamed, f.dc)).readiness, 'ACKNOWLEDGEMENT_REQUIRED', 'S05 any change needs it again');
  assert.equal((await acknowledge(f.mohamed, f.dc, 6)).outcome, 'ACKNOWLEDGED');
  const written = await itemsPage(f.mohamed, f.dc);
  assert.deepEqual([written.items[0].role, written.items[0].text, written.items[0].position], ['WRITTEN', f.writtenC.trim(), 1],
    'S05 my written text is the first item, in its public form');
  assert.equal(written.item_count, all.length + 1);

  // S06 no other human reaches my draft's source, items, preview or acknowledgement; nobody reaches the relations.
  assert.deepEqual(await readSource(f.hadir, f.dc), [], 'S06 Hadir reads no source');
  assert.equal(await itemsPage(f.hadir, f.dc), undefined, 'S06 nor its items');
  assert.equal(await preview(f.hadir, f.dc), undefined, 'S06 nor its preview');
  assert.equal((await acknowledge(f.hadir, f.dc, 6)).outcome, 'NOT_FOUND', 'S06 nor acknowledges for me');
  assert.equal((await setConversation(f.hadir, f.dc, 6, f.hadirChat.session, 1, f.hadirChat.last)).outcome, 'NOT_FOUND', 'S06 nor changes it');
  assert.equal((await clearSource(f.hadir, f.dc, 6)).outcome, 'NOT_FOUND', 'S06 nor clears it');
  await as(f.hadir);
  await rejected(() => q(`SELECT * FROM ${SCHEMA}.item_presentation`), ['42501']);
  await asRole('anon');
  await rejected(() => q('SELECT * FROM public.read_own_topic_items_v1($1, 1)', [f.dc]), ['42501']);
  await asRole('service_role');
  await rejected(() => q('SELECT * FROM public.read_own_topic_source_v1($1)', [f.dc]), ['42501']);
  await as(f.mohamed);
  for (const page of [0, 1001, null]) await rejected(() => q('SELECT * FROM public.read_own_topic_items_v1($1, $2)', [f.dc, page]), ['22023']);

  // S07 a «فهم قنديل» item, at its exact version: shown, changed, under review, withheld, withdrawn, another human's.
  f.du = randomUUID();
  assert.deepEqual(await setUnderstanding(f.mohamed, f.du, 0, f.shown.id, f.shown.version), { outcome: 'CREATED', draft_revision: '1' }, 'S07 shown');
  const u1 = await itemsPage(f.mohamed, f.du);
  assert.deepEqual(u1.items.map((i) => [i.role, i.text, i.sessionPosition]), [['QANDEEL_UNDERSTANDING', f.shownStatement, null]],
    'S07 the summary text exactly as shown, read by the server');
  for (const [h, version, outcome] of [[f.shown, f.shown.version + 1, 'UNDERSTANDING_CHANGED'], [f.contested, f.contested.version, 'UNDERSTANDING_UNDER_REVIEW'],
    [f.withheld, f.withheld.version, 'UNDERSTANDING_WITHHELD'], [f.withdrawn, f.withdrawn.version, 'SOURCE_UNAVAILABLE'],
    [f.hadirsUnderstanding, f.hadirsUnderstanding.version, 'SOURCE_UNAVAILABLE'], [{ id: randomUUID() }, 1, 'SOURCE_UNAVAILABLE']]) {
    assert.deepEqual(await setUnderstanding(f.mohamed, f.du, 1, h.id, version), { outcome, draft_revision: '1' }, `S07 ${outcome}`);
  }
  await save(f.mohamed, f.du, 1, f.titleU, '', 'inner_self');
  assert.equal((await preview(f.mohamed, f.du)).readiness, 'ACKNOWLEDGEMENT_REQUIRED', 'S07 QANDEEL\'s understanding is QANDEEL material');
  await asRole('postgres');
  await q('UPDATE public.hypotheses SET version = version + 1 WHERE id = $1', [f.shown.id]);
  assert.equal((await preview(f.mohamed, f.du)).readiness, 'UNDERSTANDING_CHANGED', 'S07 the item moved after it was chosen: re-derived, refused');
  assert.equal((await itemsPage(f.mohamed, f.du)).outcome, 'UNDERSTANDING_CHANGED', 'S07 and its items with it');
  assert.deepEqual(await setUnderstanding(f.mohamed, f.du, 2, f.shown.id, f.shown.version + 1), { outcome: 'SAVED', draft_revision: '3' }, 'S07 re-chosen');
  f.shown.version += 1;

  // S08 the closed freeze, a cleared source, the drafts limit and Export My Data.
  assert.equal((await freeze(f.mohamed, f.dc, 6)).outcome, 'PUBLICATION_NOT_OPEN', 'S08 production: preparing for publication is not open');
  const dx = randomUUID();
  await setConversation(f.mohamed, dx, 0, c.session, 1, c.last);
  assert.deepEqual(await clearSource(f.mohamed, dx, 1), { outcome: 'SAVED', draft_revision: '2' }, 'S08 a source is removed');
  assert.deepEqual(await clearSource(f.mohamed, dx, 1), { outcome: 'SAVED', draft_revision: '2' }, 'S08 idempotent');
  assert.deepEqual([(await itemsPage(f.mohamed, dx)).outcome, (await preview(f.mohamed, dx)).readiness], ['NO_SOURCE', 'TITLE_TOO_SHORT'],
    'S08 and the draft is a written draft again');
  await asRole('postgres');
  const [{ x }] = await rows('SELECT personal_data_private.build_personal_export_v1($1) x', [f.mohamed]);
  const exportedC = x.publicTopicDrafts.find((d) => d.title === f.titleC);
  assert.deepEqual(exportedC.source, { kind: 'conversation', conversationStartedAt: exportedC.source.conversationStartedAt, firstPosition: 1,
    lastPosition: c.last, includesQandeelReplies: true, excludedMessagePositions: [], emphasizedMessagePositions: emphasized },
  'S08 Export My Data prints the source as a REFERENCE');
  assert.ok(exportedC.source.conversationStartedAt, 'S08 named by when the conversation started');
  assert.deepEqual(x.publicTopicDrafts.find((d) => d.title === f.titleU).source, { kind: 'qandeel understanding', understandingVersion: f.shown.version });
  const printed = JSON.stringify(x.publicTopicDrafts);
  for (const u of all) assert.ok(!printed.includes(u.text), 'S08 never a copied conversation text');
  assert.ok(!printed.includes(f.shownStatement), 'S08 never a copied Understanding summary');
  assert.equal(x.publicTopicDrafts.find((d) => d.title === '').source, null, 'S08 a draft without a source prints none');

  // S09 A-3 scope: a Shared QANDEEL output and a QANDEEL reply through the older path stay refused.
  assert.deepEqual(await footprint(f.mohamed), before, 'S09 choosing, previewing, acknowledging and the closed freeze provisioned nothing');
  await as(f.mohamed);
  const [{ experience_id: legacy }] = await rows('SELECT * FROM public.start_own_public_experience_draft_v1($1)', [randomUUID()]);
  const started = await footprint(f.mohamed);
  const refusedLegacy = async (units, worlds, materials) => {
    await as(f.mohamed);
    try {
      await q('SAVEPOINT legacy');
      const r = await first('SELECT * FROM public.prepare_own_public_experience_package_v1($1, $2, $3::uuid[], $4::uuid[], $5::uuid[])',
        [randomUUID(), legacy, units, worlds, materials]);
      await q('ROLLBACK TO SAVEPOINT legacy');
      return r.outcome;
    } catch (error) {
      await q('ROLLBACK TO SAVEPOINT legacy');
      return `ERROR ${error.code}`;
    }
  };
  // QANDEEL's Shared output in the shape the frozen I-04G core records it (an additional human requirement left
  // unresolved, 0119) stays refused; CP2 adds no path that can name Shared material at all (B02).
  assert.notEqual(await refusedLegacy([], [f.world], [f.unresolvedMaterial]), 'PREPARED', 'S09 a Shared QANDEEL analysis stays unpublishable');
  assert.notEqual(await refusedLegacy([f.assistantUnit], [], []), 'PREPARED', 'S09 a QANDEEL reply is admitted only through the CP2 source');
  assert.deepEqual(await footprint(f.mohamed), started, 'S09 and the refused preparations wrote nothing');
}

// ------------------------------------------------------------------------- 3. the controlled verification environment
async function openFreeze() {
  await asRole('postgres');
  const [seam] = await rows('SELECT pg_get_functiondef(p.oid) d, p.prosrc FROM pg_proc p WHERE p.oid = $1::regprocedure', [FREEZE_SEAM]);
  await q(`CREATE OR REPLACE FUNCTION ${FREEZE_SEAM.replace('()', '')}()
           RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $probe$
             SELECT 'CLEARED'::text -- S8A-05 CP2 VERIFIER PROBE: inside a rolled-back verifier transaction only
           $probe$`);
  return seam;
}
async function closeFreeze(seam) {
  await asRole('postgres');
  await q(seam.d);
  const [{ prosrc }] = await rows('SELECT p.prosrc FROM pg_proc p WHERE p.oid = $1::regprocedure', [FREEZE_SEAM]);
  assert.equal(prosrc, seam.prosrc, 'the production freeze seam is restored byte for byte');
}

async function verifyControlled(f, cw208) {
  const frozen = await openFreeze();
  try {
    // F01 THE FREEZE SEALS EXACTLY THE PREVIEWED PAGES.
    const shownPages = await allPages((page) => itemsPage(f.mohamed, f.dc, page));
    const command = randomUUID();
    const prepared = await freeze(f.mohamed, f.dc, 6, command);
    assert.deepEqual([prepared.outcome, prepared.current_lifecycle], ['PREPARED', 'READY_FOR_REVIEW'], 'F01 prepared, never PUBLISHED');
    f.tc = prepared.experience_id;
    const sealedPages = await allPages((page) => itemsPage(f.mohamed, f.dc, page));
    assert.deepEqual(sealedPages.map((s) => s.items), shownPages.map((s) => s.items), 'F01 THE PREVIEW EQUALS THE SEALED PACKAGE, item for item');
    assert.deepEqual([sealedPages[0].draft_state, sealedPages[0].outcome], ['PREPARED', 'PREPARED']);
    const pkg = await packageOf(f.tc);
    const units = f.chat.units;
    assert.equal(pkg.length, units.length + 1, 'F01 the written text and one item per unit');
    assert.deepEqual([pkg[0].item_role, pkg[0].source_class, pkg[0].derivative_classification, pkg[0].unit, pkg[0].owner],
      ['WRITTEN', 'PUBLIC_AUTHORED', 'SOURCE_CONTENT_BEARING_DERIVATIVE', null, null], 'F01 the written text is the first, authored item');
    for (const [k, u] of units.entries()) {
      const it = pkg[k + 1];
      assert.deepEqual([it.item_ordinal, it.display_position, it.sp, it.item_role, it.source_class, it.unit, it.owner, it.body,
        it.derivative_classification, it.resolution_state, it.required_approver_count],
      [k + 2, k + 2, u.sp, u.role === 'USER' ? 'YOUR_MESSAGE' : 'QANDEEL_REPLY', 'MY_WORLD', u.id, f.mohamed, u.text,
        u.role === 'USER' ? 'SOURCE_CONTENT_BEARING_DERIVATIVE' : 'ANALYTICAL_DERIVATIVE', 'RESOLVED_EXACT_HUMAN_REQUIREMENT', 1],
      `F01 item ${k + 2}: the exact unit, its class, its sealed position (A-3 2(a), 4)`);
      assert.deepEqual([it.public_body_digest, it.captured_source_digest], [`sha256:${sha(u.text)}`, `sha256:${sha(u.text)}`]);
    }
    const ex = await experienceOf(f.tc);
    f.tcv = ex.v; f.tcm = ex.m;
    await asRole('postgres');
    const [authority] = await rt.deriveAuthority(f.tcm);
    assert.deepEqual(authority.required_approvers, [f.mohamed], 'F01 the author alone approves QANDEEL material (A-3 4)');
    const [doc] = await own(`SELECT document FROM ${SCHEMA}.version_search_documents WHERE experience_version_id = $1`, [f.tcv]);
    const emphasizedText = units.filter((u) => u.message === 5).map((u) => u.text);
    assert.equal(doc.document, [f.titleC, f.writtenC.trim(), ...emphasizedText].join('\n'),
      'F01 the bounded search document: the title, the written text and the emphasized message');
    // F02 a retry answers the first result; a prepared draft's source is read-only.
    assert.deepEqual(await freeze(f.mohamed, f.dc, 6, command), { outcome: 'ALREADY_PREPARED', experience_id: f.tc, current_lifecycle: 'READY_FOR_REVIEW' });
    assert.equal((await freeze(f.mohamed, f.dc, 6)).outcome, 'ALREADY_PREPARED', 'F02 any second command too');
    assert.equal((await setConversation(f.mohamed, f.dc, 6, f.chat.session, 1, f.chat.last)).outcome, 'PREPARED', 'F02 read-only');
    assert.equal((await acknowledge(f.mohamed, f.dc, 6)).outcome, 'PREPARED');
    // F03 the sealed presentation and the search document are immutable for every role.
    await asRole('postgres');
    await rejected(() => q(`UPDATE ${SCHEMA}.item_presentation SET emphasized = NOT emphasized WHERE manifest_version_id = $1`, [f.tcm]), ['55000']);
    await rejected(() => q(`DELETE FROM ${SCHEMA}.item_presentation WHERE manifest_version_id = $1`, [f.tcm]), ['55000']);
    await rejected(() => q(`TRUNCATE ${SCHEMA}.item_presentation`), ['55000']);
    await rejected(() => q(`UPDATE ${SCHEMA}.version_search_documents SET document = 'x' WHERE experience_version_id = $1`, [f.tcv]), ['55000']);
    await rejected(() => q(`UPDATE ${SCHEMA}.version_search_documents SET document = NULL, document_erased_at = now() WHERE experience_version_id = $1`, [f.tcv]), ['55000']);

    // F04 the acknowledgement and the source are re-established AT FREEZE; refused with nothing written.
    const counts = async () => (await own(`SELECT (SELECT count(*) FROM ${T.EXPERIENCES})::int e, (SELECT count(*) FROM ${T.MANIFESTS})::int m,
      (SELECT count(*) FROM ${T.ITEMS})::int i, (SELECT count(*) FROM ${SCHEMA}.item_presentation)::int p`))[0];
    const was = await counts();
    const da = randomUUID();
    await setConversation(f.mohamed, da, 0, f.chat.session, 1, f.chat.last);
    await save(f.mohamed, da, 1, f.titleC, '', 'family');
    assert.equal((await freeze(f.mohamed, da, 2)).outcome, 'ACKNOWLEDGEMENT_REQUIRED', 'F04 no acknowledgement, no freeze');
    await acknowledge(f.mohamed, f.du, 3);
    await asRole('postgres');
    await q('UPDATE public.hypotheses SET version = version + 1 WHERE id = $1', [f.shown.id]);
    assert.equal((await freeze(f.mohamed, f.du, 3)).outcome, 'UNDERSTANDING_CHANGED', 'F04 an Understanding item changed after the preview');
    await asRole('postgres');
    await q(`INSERT INTO public.understanding_contests (id, user_id, hypothesis_id, command_id, contested_version, lifecycle,
        reevaluation_before_status, reevaluation_after_status, reevaluation_after_version, confidence_evaluation_id, created_at)
      VALUES (gen_random_uuid(), $1, $2, gen_random_uuid(), $3, 'UNDER_REVIEW', 'MIXED', 'MIXED', $3, gen_random_uuid(), clock_timestamp())`,
    [f.mohamed, f.shown.id, f.shown.version + 1]);
    assert.deepEqual(await setUnderstanding(f.mohamed, f.du, 3, f.shown.id, f.shown.version + 1), { outcome: 'UNDERSTANDING_UNDER_REVIEW', draft_revision: '3' });
    // A source that is missing at freeze (the stored reference no longer resolves: positions past the end).
    const dm = randomUUID();
    await asRole('postgres');
    await q(`INSERT INTO ${COMPOSE}.topic_drafts (id, user_id, draft_revision, title, body, section_key, source_kind, source_session_id,
        source_first_sp, source_last_sp, source_include_qandeel, source_excluded_sps, source_emphasized_sps)
      VALUES ($1, $2, 1, $3, '', 'family', 'CONVERSATION', $4, 1, $5, false, '{}', '{}')`, [dm, f.mohamed, f.titleC, f.chat.session, f.chat.last + 3]);
    assert.equal((await freeze(f.mohamed, dm, 1)).outcome, 'SOURCE_UNAVAILABLE', 'F04 a missing source: refused, never a partial topic');
    assert.deepEqual(await counts(), was, 'F04 nothing was written by any refused freeze');

    // F05 THE PROCESSING ENVELOPE: above 10,000 units, refused before any write, with its size; nothing cut.
    const huge = await longConversation(f.mohamed, 10001, 40);
    const dh = randomUUID();
    assert.deepEqual(await setConversation(f.mohamed, dh, 0, huge.session, 1, huge.last, true), { outcome: 'TOO_LARGE', draft_revision: null },
      'F05 the selection is refused when it is chosen');
    await asRole('postgres');
    await q(`INSERT INTO ${COMPOSE}.topic_drafts (id, user_id, draft_revision, title, body, section_key, source_kind, source_session_id,
        source_first_sp, source_last_sp, source_include_qandeel, source_excluded_sps, source_emphasized_sps, source_acknowledged_revision)
      VALUES ($1, $2, 1, $3, '', 'family', 'CONVERSATION', $4, 1, $5, true, '{}', '{}', 1)`, [dh, f.mohamed, f.titleC, huge.session, huge.last]);
    const tooLarge = await itemsPage(f.mohamed, dh);
    assert.deepEqual([tooLarge.outcome, tooLarge.item_count, tooLarge.items], ['TOO_LARGE', 10001, []], 'F05 the size is told, nothing is listed');
    assert.equal((await freeze(f.mohamed, dh, 1)).outcome, 'TOO_LARGE', 'F05 and the freeze refuses it');
    assert.deepEqual(await counts(), was, 'F05 nothing written');
    assert.equal((await setConversation(f.mohamed, randomUUID(), 0, huge.session, 1, 10000, true)).outcome, 'CREATED', 'F05 10,000 fit');

    // F06 A LONG TOPIC: 120 messages, paged by 50, each item once, in order; the bounded model inputs.
    const long = await longConversation(f.mohamed, 120, 1600);
    const dl = randomUUID();
    assert.equal((await setConversation(f.mohamed, dl, 0, long.session, 1, long.last, true, [], [61])).outcome, 'CREATED', 'F06 a long source');
    await save(f.mohamed, dl, 1, f.titleL, f.writtenL, 'open');
    await acknowledge(f.mohamed, dl, 2);
    const preLong = await allPages((page) => itemsPage(f.mohamed, dl, page));
    assert.deepEqual(preLong.map((pg2) => [pg2.page, pg2.page_count, pg2.items.length]), [[1, 3, 50], [2, 3, 50], [3, 3, 21]], 'F06 pages of 50');
    const positions = preLong.flatMap((pg2) => pg2.items.map((i) => i.position));
    assert.deepEqual(positions, Array.from({ length: 121 }, (_, k) => k + 1), 'F06 every item exactly once, no gap, no repeat');
    assert.deepEqual((await itemsPage(f.mohamed, dl, 4)).items, [], 'F06 past the last page: nothing');
    const pl = await freeze(f.mohamed, dl, 2);
    assert.equal(pl.outcome, 'PREPARED', 'F06 the long topic is prepared');
    assert.deepEqual((await allPages((page) => itemsPage(f.mohamed, dl, page))).map((s) => s.items), preLong.map((s) => s.items), 'F06 sealed as previewed');
    const lm = (await experienceOf(pl.experience_id)).m;
    await asRole('postgres');
    const [inputs] = await rows(`SELECT ${SCHEMA}.interpreter_input_v1($1) i, ${SCHEMA}.qandeel_context_v1($1) c`, [lm]);
    assert.ok(Buffer.byteLength(inputs.i) <= 24576 && Buffer.byteLength(inputs.c) <= 6144, 'F06 the inputs never exceed 24 KB / 6 KB');
    assert.ok(Buffer.byteLength(inputs.i) > 20000, 'F06 the interpreter budget is used, not wasted');
    assert.ok(inputs.i.startsWith(`TITLE: ${f.titleL}\nAUTHOR_TEXT: ${f.writtenL}`), 'F06 the title and the written text first');
    assert.ok(inputs.i.includes('AUTHOR [EMPHASIZED]: رسالة 61 ') || inputs.i.includes('QANDEEL [EMPHASIZED]: رسالة 61 '), 'F06 then the emphasized message');
    assert.ok(inputs.i.includes(': رسالة 1 ') && inputs.i.includes(': رسالة 120 '), 'F06 then the conversation from both ends');
    assert.ok(inputs.c.startsWith(`TITLE: ${f.titleL}\nAUTHOR_TEXT: `), 'F06 the @qandeel context keeps the same priority');
    const lines = inputs.i.split('\n').slice(1).map((l) => Number(/رسالة (\d+) /u.exec(l)?.[1] ?? 0)).filter(Boolean);
    assert.deepEqual(lines, [...lines].sort((a, b) => a - b), 'F06 the chosen items are given in display order');

    // F07 AN UNDERSTANDING TOPIC: one analytical item, its summary, no unit, the author its approver.
    const du2 = randomUUID();
    const h2 = await hypothesis(f.mohamed, f.shownStatement2);
    assert.equal((await setUnderstanding(f.mohamed, du2, 0, h2.id, h2.version)).outcome, 'CREATED', 'F07 the Understanding source');
    await save(f.mohamed, du2, 1, f.titleU, '', 'inner_self');
    await acknowledge(f.mohamed, du2, 2);
    const pu = await freeze(f.mohamed, du2, 2);
    assert.equal(pu.outcome, 'PREPARED', 'F07 prepared');
    f.tu = pu.experience_id;
    const upkg = await packageOf(f.tu);
    assert.deepEqual(upkg.map((i) => [i.item_role, i.source_class, i.unit, i.owner, i.derivative_classification, i.body, i.captured_source_digest]),
      [['QANDEEL_UNDERSTANDING', 'MY_WORLD', null, f.mohamed, 'ANALYTICAL_DERIVATIVE', f.shownStatement2, `sha256:${sha(f.shownStatement2)}`]],
      'F07 A-3 2(b): the summary exactly as shown, its own sealed source, the author its one rightsholder');

    // F08 published through the simulated CW2-08 seam: a reader pages the served items; search reads the bounded document.
    const work = (await requestProposal(f.mohamed, f.tc)).work_id;
    assert.equal(await recordOutcome(work, 'family.care', f.meaningC, ['family']), 'RECORDED');
    const committed = await commitWork(f.mohamed, work);
    assert.equal(await acceptSemantic(f.mohamed, f.tc, committed.interpretation_id), 'ACCEPTED');
    const opened = await requestPlace(f.mohamed, f.tc);
    assert.equal(await commitPlace(opened.request_id, '1300000', '2300000'), 'PLACED');
    assert.equal(await publicPage(f.reader, f.tc), undefined, 'F08 nothing before publication');
    await asRole('postgres');
    const [published] = await rt.publishCleared(cw208, f.mohamed, randomUUID(), f.tc, f.tcv);
    assert.equal(published.outcome, 'PUBLISHED', 'fixture: a sourced topic publishes through the unchanged frozen path');
    const served = await allPages((page) => publicPage(f.reader, f.tc, page));
    // The reader sees what the author previewed — everything but the private Session Position, which is never public.
    const withoutPosition = ({ sessionPosition, ...rest }) => rest;
    assert.deepEqual(served.flatMap((s) => s.items), sealedPages.flatMap((s) => s.items).map(withoutPosition), 'F08 THE READER SEES WHAT THE AUTHOR PREVIEWED');
    assert.ok(served.flatMap((s) => s.items).every((item) => !('sessionPosition' in item)), 'F08 no Session Position reaches a reader');
    assert.equal(await publicPage(f.hadir, randomUUID()), undefined, 'F08 an unknown topic: nothing');
    const emphasizedWord = f.emphasisWord;
    assert.deepEqual(await fieldSearch(f.reader, emphasizedWord), [f.tc], 'F08 search finds an emphasized message');
    assert.deepEqual(await sectionMatches(f.reader, emphasizedWord, 'family'), [f.tc], 'F08 and inside its section');
    assert.deepEqual(await fieldSearch(f.reader, f.plainWord), [], 'F08 a word only an unemphasized message holds is not in the bounded document');
    await asRole('anon');
    await rejected(() => q('SELECT * FROM public.read_public_topic_items_v1($1, 1)', [f.tc]), ['42501']);
    assert.equal(await discard(f.mohamed, f.tc), 'NOT_DISCARDABLE', 'F08 a published topic is never discarded here');

    // F09 DISCARD a never-published topic of EVERY class: every Public byte, digest, pointer, title and search document.
    const dd = randomUUID();
    assert.equal((await setConversation(f.mohamed, dd, 0, f.chat2.session, 1, f.chat2.last, true, [], [f.chat2.units[3].sp])).outcome, 'CREATED', 'F09 the source');
    await save(f.mohamed, dd, 1, f.titleD, f.writtenD, 'family');
    await acknowledge(f.mohamed, dd, 2);
    const pd = await freeze(f.mohamed, dd, 2);
    assert.equal(pd.outcome, 'PREPARED', 'F09 prepared');
    const work2 = (await requestProposal(f.mohamed, pd.experience_id)).work_id;
    assert.equal(await recordOutcome(work2, 'family.care', f.meaningD, ['family']), 'RECORDED');
    await commitWork(f.mohamed, work2);
    const secret = f.chat2.units.find((u) => u.role === 'ASSISTANT').text;
    assert.ok((await censusOf(secret)).includes('public.public_experience_text_derivative_bodies.public_text_body'), 'fixture: the public copy exists');
    assert.equal(await discard(f.mohamed, pd.experience_id), 'DISCARDED', 'F09 a topic holding MY_WORLD material is discarded (A-2(c) as narrowed by CP2)');
    const after = await packageOf(pd.experience_id);
    const [{ at }] = await own(`SELECT occurred_at at FROM ${COMPOSE}.discard_commands WHERE experience_id = $1`, [pd.experience_id]);
    assert.ok(after.every((i) => i.content_state === 'ERASED_BY_OWNER' && i.public_body_digest === null && i.captured_source_digest === null
      && i.body === null && i.unit === null && i.owner === null && i.content_erased_at.getTime() === at.getTime()),
    'F09 every item: no body, no digest of either kind, no source pointer, at the discard instant');
    assert.ok(after.every((i) => i.display_position !== null), 'F09 the order rows stay (identifiers and positions only, no text)');
    assert.deepEqual(await own(`SELECT document, document_erased_at FROM ${SCHEMA}.version_search_documents WHERE experience_id = $1`, [pd.experience_id]),
      [{ document: null, document_erased_at: at }], 'F09 the search document is erased at the same instant');
    for (const u of f.chat2.units) {
      assert.deepEqual(await censusOf(u.text), ['public.conversation_units.committed_text', 'public.conversation_units.source_content_sha256'],
        `F09 sp ${u.sp}: only in my own conversation (its text and its own digest)`);
    }
    for (const text of [f.titleD, f.writtenD.trim()]) {
      assert.deepEqual(await censusOf(text), [`${COMPOSE}.topic_drafts.${text === f.titleD ? 'title' : 'body'}`], 'F09 my words only in my draft');
    }
    assert.equal((await experienceOf(pd.experience_id)).current_lifecycle, 'ABSENT_FROM_PUBLIC_WORLD', 'F09 DRAFT|READY → ABSENT');
    const [back] = await readDraft(f.mohamed, dd);
    assert.deepEqual([back.draft_state, back.experience_id], ['EDITING', null], 'F09 the draft returns to editing');
    assert.equal((await readSource(f.mohamed, dd))[0].source_kind, 'CONVERSATION', 'F09 with its source reference');
    // The Understanding topic too: the summary remains only in the Understanding item.
    assert.equal(await discard(f.mohamed, f.tu), 'DISCARDED', 'F09 an Understanding topic is discarded');
    assert.deepEqual(await censusOf(f.shownStatement2), ['public.hypotheses.statement'], 'F09 the summary only where QANDEEL keeps it');
    // F10 the guard still refuses an unproven erasure of a MY_WORLD item and its pointers.
    await asRole('postgres');
    await rejected(() => q(`UPDATE ${T.PROVENANCE} SET captured_source_digest = NULL, captured_digest_erased_at = now(),
      personal_conversation_unit_id = NULL, personal_owner_user_id = NULL WHERE package_item_id = $1`, [pkg[1].package_item_id]), ['55000']);
    await rejected(() => q(`UPDATE ${T.ITEMS} SET content_state = 'ERASED_BY_OWNER', public_body_digest = NULL, content_erased_at = now()
      WHERE package_item_id = $1`, [pkg[1].package_item_id]), ['55000']);
  } catch (error) {
    frozen.failed = true;
    throw error;
  } finally {
    if (!frozen.failed) await closeFreeze(frozen);
  }
  assert.equal((await freeze(f.mohamed, f.dc, 6)).outcome, 'PUBLICATION_NOT_OPEN', 'L01 closed again: the gate answers first');
}

// ------------------------------------------------------------------------------------- 4. two sessions, one draft
async function verifyConcurrency() {
  const human = randomUUID();
  const draft = randomUUID();
  await asRole('postgres');
  await q('INSERT INTO auth.users(id) VALUES ($1)', [human]);
  await q(`INSERT INTO ${COMPOSE}.topic_drafts (id, user_id, draft_revision, title, body, source_kind, source_session_id, source_first_sp,
      source_last_sp, source_include_qandeel, source_excluded_sps, source_emphasized_sps)
    VALUES ($1, $2, 1, '', '', 'CONVERSATION', $3, 1, 2, true, '{}', '{}')`, [draft, human, randomUUID()]);
  const second = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await second.connect();
    const asHuman = async (c) => {
      await c.query('BEGIN');
      await c.query('SET LOCAL ROLE authenticated');
      await c.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: human, role: 'authenticated' })]);
    };
    await asRole('postgres');
    await asHuman(rt.client);
    const [a] = await rows('SELECT * FROM public.clear_own_topic_source_v1($1, 1)', [draft]);
    assert.deepEqual(a, { outcome: 'SAVED', draft_revision: '2' }, 'C01 the first session removes the source');
    await asHuman(second);
    const racing = second.query('SELECT * FROM public.clear_own_topic_source_v1($1, 1)', [draft]);
    assert.equal(await rt.stillPending(racing), true, 'C01 the second session waits on the draft');
    await q('COMMIT');
    const { rows: [b] } = await racing;
    assert.deepEqual(b, { outcome: 'SAVED', draft_revision: '2' }, 'C01 then answers the revision the equivalent change produced');
    const { rows: [c] } = await second.query('SELECT * FROM public.acknowledge_own_topic_source_v1($1, 1)', [draft]);
    assert.deepEqual(c, { outcome: 'NO_SOURCE', draft_revision: '2' }, 'C01 and sees the committed state: no lost update');
    await second.query('ROLLBACK');
    await asRole('postgres');
    assert.deepEqual(await rows(`SELECT draft_revision::int r, source_kind FROM ${COMPOSE}.topic_drafts WHERE id = $1`, [draft]),
      [{ r: 2, source_kind: null }], 'C01 exactly one change happened');
  } finally {
    await q('ROLLBACK').catch(() => undefined);
    await second.end().catch(() => undefined);
    await asRole('postgres');
    await q('DELETE FROM public.users WHERE id = $1', [human]);
    await q('DELETE FROM auth.users WHERE id = $1', [human]);
  }
  assert.equal((await own(`SELECT count(*)::int n FROM ${COMPOSE}.topic_drafts WHERE id = $1`, [draft]))[0].n, 0,
    'C02 the draft went with its account: nothing committed remains');
}

// ---------------------------------------------------------------------------------------------------------- fixture
async function fixture() {
  const f = rt.newFixture();
  await asRole('postgres');
  await rt.provision(f);
  f.emphasisWord = marker();
  f.plainWord = marker();
  f.chat = await conversation(f.mohamed, [
    { role: 'USER', units: [`بدأت أشعر أنني أطلب المساعدة متأخرًا دائمًا ${marker()}`, `حتى مع أقرب الناس ${marker()}`] },
    { role: 'ASSISTANT', units: [`يبدو أن الطلب نفسه يثقل عليك أكثر من الحاجة ${marker()}`] },
    { role: 'USER', units: [`أخي قال لي مرة إنني عنيد ${f.plainWord}`] },
    { role: 'ASSISTANT', units: [`ماذا حدث بعد أن قال ذلك؟ ${marker()}`, `يمكنك مراسلتي على help@example.com ${marker()}`] },
    { role: 'USER', units: [`تعلمت أن أتصل بأمي قبل أن ينهار كل شيء ${f.emphasisWord}`] },
    { role: 'ASSISTANT', units: [`هذا تغيير مهم ${marker()}`] },
    { role: 'USER', units: [`رقمي القديم كان 0101 234 5678 ${marker()}`] },
  ]);
  f.chat2 = await conversation(f.mohamed, [
    { role: 'USER', units: [`محادثة سألغي موضوعها ${marker()}`] },
    { role: 'ASSISTANT', units: [`رد قنديل في محادثة الإلغاء ${marker()}`, `ووحدة ثانية من الرد ${marker()}`] },
    { role: 'USER', units: [`رسالة مبرزة في محادثة الإلغاء ${marker()}`] },
  ]);
  f.hadirChat = await conversation(f.hadir, [{ role: 'USER', units: [`محادثة حاضر الخاصة ${marker()}`] }]);
  f.shownStatement = `يبدو أنك تؤجل طلب المساعدة حتى اللحظة الأخيرة ${marker()}`;
  f.shownStatement2 = `يبدو أن العمل يأخذ مكان الراحة عندك ${marker()}`;
  f.shown = await hypothesis(f.mohamed, f.shownStatement);
  f.contested = await hypothesis(f.mohamed, `فهم قيد المراجعة ${marker()}`);
  await q(`INSERT INTO public.understanding_contests (id, user_id, hypothesis_id, command_id, contested_version, lifecycle,
      reevaluation_before_status, reevaluation_after_status, reevaluation_after_version, confidence_evaluation_id, created_at)
    VALUES (gen_random_uuid(), $1, $2, gen_random_uuid(), $3, 'UNDER_REVIEW', 'MIXED', 'MIXED', $3, gen_random_uuid(), clock_timestamp())`,
  [f.mohamed, f.contested.id, f.contested.version]);
  f.withheld = await hypothesis(f.mohamed, `فهم محجوب ${marker()}`, { withheld: true });
  f.withdrawn = await hypothesis(f.mohamed, `فهم مسحوب ${marker()}`, { status: 'REJECTED' });
  f.hadirsUnderstanding = await hypothesis(f.hadir, `فهم حاضر ${marker()}`);
  f.titleC = 'كيف تعلمت أن أطلب المساعدة';
  f.writtenC = `  أنشر هذه المحادثة لأنها غيرت شيئًا فيّ ${marker()}  `;
  f.titleU = 'ما فهمه قنديل عني';
  f.titleL = 'محادثة طويلة مع قنديل عن العمل';
  f.writtenL = `كتبت هذا قبل أن أنشر ${marker()}`;
  f.titleD = `موضوع سألغيه قبل نشره ${marker()}`;
  f.writtenD = `كلمات سأمحوها من العالم العام ${marker()}`;
  f.meaningC = 'Learning to ask for help before things fall apart';
  f.meaningD = 'A conversation about asking for help';
  assert.equal((await rt.admission(f.reader))[0].admission, 'ADMITTED', 'fixture: an admitted registered viewer');
  return f;
}

await runVerifier('0180', async (stage) => {
  await rt.client.connect();
  stage('boundary');
  await verifyBoundary();
  stage('concurrency');
  await verifyConcurrency();
  await q('BEGIN');
  try {
    stage('fixture');
    const cw208 = await rt.captureSeam();
    const f = await fixture();
    stage('the source');
    await verifySource(f);
    stage('controlled environment');
    await verifyControlled(f, cw208);
    stage('launch closure');
    const [{ n }] = await own(`SELECT count(*)::int n FROM ${T.EXPERIENCES} WHERE current_lifecycle = 'PUBLISHED'
      AND id NOT IN (SELECT experience_id FROM ${T.PUBLICATION_STATE} s WHERE s.prerequisite_clearance_basis LIKE 'I-05B VERIFIER PROBE%')`);
    assert.equal(n, 0, 'L02 nothing is PUBLISHED except through the in-transaction probe');
  } finally {
    await q('ROLLBACK');
  }
  await asRole('postgres');
  assert.ok((await rt.functionPosture(FREEZE_SEAM)).prosrc.includes('NOT_EVALUATED'), 'L03 after rollback the freeze seam is closed');
  console.log('Verified migration 0180: a topic is made from my own conversation (whole, a range, separate whole messages, emphasized, with or without QANDEEL\'s replies) or from a «فهم قنديل» item exactly as shown, from references the server resolves itself; every refusal of the closed list writes nothing; the paged preview is the sealed package; QANDEEL material needs one acknowledgement bound to the revision; the freeze stays closed in production and, in a controlled environment, seals every whole unit once in true order with the author its sole approver, refuses a changed, missing or oversized source with nothing written, serves readers the same pages, searches a bounded document and bounds the model inputs; a never-published discard erases every class of Public text, digest, pointer, title and search document, leaving the words only in the author\'s own conversation.');
}, async () => { await rt.client.end().catch(() => undefined); });
