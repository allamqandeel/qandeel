-- T-03A1 - Committed Conversational Unit Constitution + Commitment Producer +
-- Durable Substrate v1.
--
-- Stage 1.2 (INPUT-01) freezes the Conversational Unit as "the smallest
-- contiguous span of committed conversational source material that constitutes
-- one independently addressable conversational contribution". Stage 6 freezes
-- `1 committed CU = 1 Moment` and `1 turn = 0..N committed CUs`. This migration
-- creates the first durable substrate for that truth.
--
-- What this migration is NOT:
--   * it is not SP, LH, the Session Semantic Clock, or any Moment
--     addressability - those are T-03A2 and no column here can express them;
--   * it introduces no temporary Product state (there is no SP_PENDING,
--     PRE_MOMENT, PENDING_MOMENT or COMMITTED_WITHOUT_SP, and no status column
--     at all in which such a state could live);
--   * it does not redefine conversation_turns, which remains the operational
--     runtime envelope. `conversation_turn.status = COMPLETED` is used only as
--     the CURRENT TEXT-runtime eligibility signal; the Product definition of
--     commitment remains the four INPUT-01 source-level conditions, each
--     re-established inside the producer transaction below. `completed_at`
--     stays audit/runtime metadata and is never read here.
--
-- Production-inert by construction: the producer is owned by postgres, is
-- SECURITY DEFINER, and is granted to NO application role. The API process
-- holds no PostgreSQL driver and reaches the database only through PostgREST as
-- `authenticated` or `service_role`, so no code path reachable from the
-- deployed product can invoke it. The CI verifier connects as the migration
-- owner and proves the whole producer. T-03A2 alone performs the one-migration
-- activation act (SP allocation/sealing inside the same transaction, plus the
-- EXECUTE grant). Migrations 0001-0063 are untouched, and conversation_turns is
-- not altered.

BEGIN;

-- 0. Frozen environment contract. The canonical span coordinate system is
--    Unicode code points over conversation_turns.content exactly as stored, and
--    the canonical source digest is SHA-256 over the explicit UTF-8 encoding of
--    that content. Both depend on a UTF-8 server encoding. There is no
--    byte-offset fallback and no MD5 fallback: a database that cannot honour
--    the contract must stop, not silently change it.
DO $$BEGIN
  IF current_setting('server_encoding') <> 'UTF8' THEN
    RAISE EXCEPTION 'T-03A1 requires a UTF8 server encoding; found %', current_setting('server_encoding')
      USING ERRCODE='0A000';
  END IF;
END$$;

-- 1. The commitment batch. A source-finalization operation may produce 0..N
--    committed CUs, and the frozen grammar does NOT guarantee one durable
--    commit operation per source turn: there is deliberately no
--    UNIQUE(source_turn_id) here, so several valid forward batches may exist
--    for one turn. Canonical retry identity is the batch id plus the
--    DB-DERIVED canonical fingerprint below - never a caller-supplied hash, and
--    never the runtime_event_outbox UNIQUE(event_type,subject_turn_id) or the
--    single-turn post-response dispatch ledger, both of which are structurally
--    one-row-per-turn and are left untouched.
--
--    Every identity-bearing column is derived by the producer from the locked
--    authoritative source row. `committed_at` is audit metadata only: it is not
--    SP, not KF/VF/VT, and not the Session Semantic Clock.
CREATE TABLE public.conversation_unit_commit_batches (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  source_turn_id uuid NOT NULL,
  canonical_fingerprint bytea NOT NULL,
  source_content_sha256 bytea NOT NULL,
  unit_count integer NOT NULL,
  evaluator_version text NOT NULL,
  policy_version text NOT NULL,
  segmentation_provider text NOT NULL,
  segmentation_model text NOT NULL,
  segmentation_prompt_version text NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT conversation_unit_commit_batches_user_fk
    FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
  CONSTRAINT conversation_unit_commit_batches_session_user_fk
    FOREIGN KEY (session_id, user_id)
    REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT conversation_unit_commit_batches_source_turn_fk
    FOREIGN KEY (source_turn_id) REFERENCES public.conversation_turns (id) ON DELETE RESTRICT,
  CONSTRAINT conversation_unit_commit_batches_unit_count_check CHECK (unit_count >= 0),
  CONSTRAINT conversation_unit_commit_batches_digest_check
    CHECK (length(canonical_fingerprint) = 32 AND length(source_content_sha256) = 32),
  CONSTRAINT conversation_unit_commit_batches_provenance_check CHECK (
    length(btrim(evaluator_version)) > 0 AND length(evaluator_version) <= 64 AND
    length(btrim(policy_version)) > 0 AND length(policy_version) <= 64 AND
    length(btrim(segmentation_provider)) > 0 AND length(segmentation_provider) <= 64 AND
    length(btrim(segmentation_model)) > 0 AND length(segmentation_model) <= 128 AND
    length(btrim(segmentation_prompt_version)) > 0 AND length(segmentation_prompt_version) <= 64)
);

-- 2. The committed Conversational Unit. Canonical, immutable, append-only
--    historical source truth.
--
--    `ordinal_within_turn` means GLOBAL canonical source order across every
--    committed CU of the source turn - not commit-arrival order. The producer
--    can only ever assign it that way (section 6, the forward-only frontier
--    rule), and UNIQUE(source_turn_id, ordinal_within_turn) is the structural
--    backstop.
--
--    `committed_text` is the exact committed surface wording (Stage 1.2 D8): it
--    is sliced by the database from the locked canonical source and is never
--    normalized, so dialectal particles, negation morphology, code-switching,
--    hesitation, correction cues and ambiguity-bearing surface forms survive
--    byte-exact. There is deliberately no normalized-text column.
--
--    Deliberately absent: SP, LH, any status/lifecycle field, any
--    function/dialogue-act field (Stage 1.2 CU-04/CU-05 functions are derived
--    interpretation and belong to a later table keyed on this identity, which
--    needs no change here), and `updated_at` (nothing ever updates a row).
--
--    `source_role` is USER/ASSISTANT only. No code path creates a SYSTEM turn,
--    so admitting one would be guessing; this is a deliberate fail-closed
--    narrowing, reopenable when an authoritative SYSTEM source producer exists.
--    `speaker_state` keeps UNRESOLVED representable because Stage 1.2 D3/CU-08
--    freeze it as legitimate committed state, but it is not executable in
--    T-03A1: the producer derives RESOLVED from the server-forced turn role and
--    has no parameter through which a caller could claim otherwise.
CREATE TABLE public.conversation_units (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  source_turn_id uuid NOT NULL,
  commit_batch_id uuid NOT NULL,
  source_role text NOT NULL,
  speaker_state text NOT NULL,
  source_modality text NOT NULL,
  ordinal_within_turn integer NOT NULL,
  source_span_start integer NOT NULL,
  source_span_end integer NOT NULL,
  committed_text text NOT NULL,
  source_content_sha256 bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT conversation_units_user_fk
    FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
  CONSTRAINT conversation_units_session_user_fk
    FOREIGN KEY (session_id, user_id)
    REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT conversation_units_source_turn_fk
    FOREIGN KEY (source_turn_id) REFERENCES public.conversation_turns (id) ON DELETE RESTRICT,
  CONSTRAINT conversation_units_batch_fk
    FOREIGN KEY (commit_batch_id)
    REFERENCES public.conversation_unit_commit_batches (id) ON DELETE RESTRICT,
  CONSTRAINT conversation_units_source_role_check CHECK (source_role IN ('USER', 'ASSISTANT')),
  CONSTRAINT conversation_units_speaker_state_check CHECK (speaker_state IN ('RESOLVED', 'UNRESOLVED')),
  CONSTRAINT conversation_units_source_modality_check CHECK (source_modality = 'TEXT'),
  CONSTRAINT conversation_units_ordinal_check CHECK (ordinal_within_turn >= 0),
  CONSTRAINT conversation_units_span_check
    CHECK (source_span_start >= 0 AND source_span_end > source_span_start),
  CONSTRAINT conversation_units_committed_text_span_check
    CHECK (length(committed_text) = source_span_end - source_span_start),
  CONSTRAINT conversation_units_digest_check CHECK (length(source_content_sha256) = 32),
  CONSTRAINT conversation_units_turn_ordinal_unique UNIQUE (source_turn_id, ordinal_within_turn)
);

CREATE INDEX conversation_units_source_order_idx
  ON public.conversation_units (session_id, source_turn_id, ordinal_within_turn);
CREATE INDEX conversation_units_batch_idx
  ON public.conversation_units (commit_batch_id, ordinal_within_turn);

-- 3. Append-only enforcement. Committed batch and unit rows are canonical
--    historical source truth: they are never renumbered, reordered, rewritten,
--    resegmented, rebound, or deleted. A BEFORE trigger is used deliberately
--    rather than privileges alone, because privileges do not bind the table
--    owner and a future accidental GRANT would otherwise reopen mutation.
--    Delete/reinsert identity rewriting is impossible for the same reason: the
--    original row cannot be removed, a same-id reinsert violates the primary
--    key, and a new-id reinsert is refused by the forward-only frontier rule
--    and the (source_turn_id, ordinal_within_turn) uniqueness.
CREATE FUNCTION public.reject_committed_conversational_unit_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'COMMITTED_CONVERSATIONAL_UNIT_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='Committed conversational source is append-only: UPDATE and DELETE are refused for every role, including the table owner.';
END;$$;

CREATE TRIGGER conversation_units_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_units
  FOR EACH ROW EXECUTE FUNCTION public.reject_committed_conversational_unit_mutation_v1();

CREATE TRIGGER conversation_unit_commit_batches_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_unit_commit_batches
  FOR EACH ROW EXECUTE FUNCTION public.reject_committed_conversational_unit_mutation_v1();

-- 4. The commitment producer. One call = one batch = one transaction.
--
--    The caller may identify the source turn and the batch, and may propose
--    unit ids and source-span coordinates. It is authority for NOTHING else:
--    there is no parameter for a fingerprint, committed wording, source role,
--    speaker state, source modality, source digest, ordinal, or SP. Every
--    canonical value is derived here from the locked authoritative source row,
--    so a privileged application caller cannot forge conversational history.
--
--    The four INPUT-01 commitment conditions are re-established inside this
--    transaction rather than assumed from the eligibility signal:
--      source stability     - conversation_turns.content is write-once (no
--                             migration updates it and no role holds UPDATE),
--                             and the derived digest must still match the batch;
--      boundary stability   - a turn has no continuation mechanism, and only a
--                             turn that terminalized as COMPLETED entered the
--                             conversation at all;
--      speaker-state stab.  - role is server-forced and immutable, and speaker
--                             state is derived from it, never asserted;
--      provenance stability - locked parent turn, span bounded by the canonical
--                             content, and DB-sliced committed wording.
CREATE FUNCTION public.commit_conversation_units_v1(
  p_session_id uuid,
  p_user_id uuid,
  p_source_turn_id uuid,
  p_batch_id uuid,
  p_units jsonb,
  p_evaluator_version text,
  p_policy_version text,
  p_segmentation_provider text,
  p_segmentation_model text,
  p_segmentation_prompt_version text
) RETURNS SETOF public.conversation_units
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  uuid_shape constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  max_units constant integer := 64;
  session_row public.conversation_sessions;
  turn_row public.conversation_turns;
  batch_row public.conversation_unit_commit_batches;
  derived_digest bytea;
  derived_modality constant text := 'TEXT';
  derived_speaker constant text := 'RESOLVED';
  source_length integer;
  unit_count integer;
  unit jsonb;
  idx integer;
  unit_ids uuid[] := ARRAY[]::uuid[];
  span_starts integer[] := ARRAY[]::integer[];
  span_ends integer[] := ARRAY[]::integer[];
  cursor_pos integer;
  frontier integer;
  next_ordinal integer;
  canonical jsonb;
  fingerprint bytea;
  is_replay boolean := false;
  inserted_batches integer;
  stored_count integer;
BEGIN
  ---------------------------------------------------------------------------
  -- COMMON SETUP (both paths): parameter structure, identity, source lock,
  -- canonical derivation, and structural validation of the ordered payload.
  ---------------------------------------------------------------------------
  IF p_session_id IS NULL OR p_user_id IS NULL OR p_source_turn_id IS NULL OR p_batch_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;
  IF p_units IS NULL OR jsonb_typeof(p_units) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF p_evaluator_version IS NULL OR length(btrim(p_evaluator_version)) = 0 OR length(p_evaluator_version) > 64
     OR p_policy_version IS NULL OR length(btrim(p_policy_version)) = 0 OR length(p_policy_version) > 64
     OR p_segmentation_provider IS NULL OR length(btrim(p_segmentation_provider)) = 0 OR length(p_segmentation_provider) > 64
     OR p_segmentation_model IS NULL OR length(btrim(p_segmentation_model)) = 0 OR length(p_segmentation_model) > 128
     OR p_segmentation_prompt_version IS NULL OR length(btrim(p_segmentation_prompt_version)) = 0
     OR length(p_segmentation_prompt_version) > 64 THEN
    RAISE EXCEPTION 'INVALID_COMMIT_PROVENANCE' USING ERRCODE='22023';
  END IF;

  unit_count := jsonb_array_length(p_units);
  IF unit_count > max_units THEN
    RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023',
      DETAIL='A commitment batch carries at most 64 committed conversational units.';
  END IF;

  -- Owner-scoped session. Ownership is checked on the owned row alone so a
  -- cross-user or nonexistent session fails closed without leaking existence.
  SELECT * INTO session_row FROM public.conversation_sessions s
    WHERE s.id = p_session_id AND s.user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  -- The one serialization point for this source turn. Every batch for the turn
  -- - new or replayed - passes through this lock, so concurrent commits cannot
  -- interleave, duplicate an ordinal, or invert source order.
  SELECT * INTO turn_row FROM public.conversation_turns t
    WHERE t.id = p_source_turn_id AND t.session_id = p_session_id AND t.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  -- Canonical source derivation. None of these values is caller-supplied.
  IF turn_row.role NOT IN ('USER', 'ASSISTANT') THEN
    RAISE EXCEPTION 'UNSUPPORTED_SOURCE_ROLE' USING ERRCODE='22023',
      DETAIL='Only USER and ASSISTANT conversational source is committable in v1.';
  END IF;
  IF turn_row.status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'SOURCE_TURN_NOT_COMMITTABLE' USING ERRCODE='55000',
      DETAIL='Provisional, cancelled, failed and superseded source never becomes committed conversational truth.';
  END IF;
  IF session_row.channel <> 'TEXT' THEN
    RAISE EXCEPTION 'UNSUPPORTED_SOURCE_MODALITY' USING ERRCODE='22023';
  END IF;
  derived_digest := sha256(convert_to(turn_row.content, 'UTF8'));
  source_length := length(turn_row.content);

  -- Structural validation of the ordered payload. This is source-relative and
  -- therefore identical for a new commit and for an existing-batch replay: it
  -- never consults the current frontier.
  cursor_pos := 0;
  FOR idx IN 0 .. unit_count - 1 LOOP
    unit := p_units -> idx;
    -- The object check is its own statement: SQL does not guarantee that OR
    -- short-circuits, and jsonb_object_keys raises on a scalar.
    IF jsonb_typeof(unit) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023';
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(unit)) <> 3
       OR NOT (unit ? 'unit_id') OR NOT (unit ? 'span_start') OR NOT (unit ? 'span_end')
       OR jsonb_typeof(unit -> 'unit_id') <> 'string'
       OR jsonb_typeof(unit -> 'span_start') <> 'number'
       OR jsonb_typeof(unit -> 'span_end') <> 'number'
       OR (unit ->> 'unit_id') !~* uuid_shape
       OR (unit ->> 'span_start') !~ '^[0-9]{1,9}$'
       OR (unit ->> 'span_end') !~ '^[0-9]{1,9}$' THEN
      RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023';
    END IF;
    unit_ids := array_append(unit_ids, (unit ->> 'unit_id')::uuid);
    span_starts := array_append(span_starts, (unit ->> 'span_start')::integer);
    span_ends := array_append(span_ends, (unit ->> 'span_end')::integer);

    IF span_ends[idx + 1] <= span_starts[idx + 1] OR span_ends[idx + 1] > source_length THEN
      RAISE EXCEPTION 'SPAN_OUT_OF_RANGE' USING ERRCODE='22023';
    END IF;
    -- Strict ascent and pairwise non-overlap inside the batch. A CU is one
    -- contiguous interval, so non-contiguity is unrepresentable rather than
    -- rejected.
    IF idx > 0 AND span_starts[idx + 1] < cursor_pos THEN
      RAISE EXCEPTION 'SPAN_NOT_FORWARD_ORDERED' USING ERRCODE='22023';
    END IF;
    cursor_pos := span_ends[idx + 1];
  END LOOP;
  IF unit_count > 1 AND (SELECT count(DISTINCT d.u) FROM unnest(unit_ids) AS d(u)) <> unit_count THEN
    RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023',
      DETAIL='Unit identities inside a commitment batch must be distinct.';
  END IF;

  -- The DB-derived canonical fingerprint. Every input is either derived above
  -- or is the caller's proposed identity/coordinate/provenance; no caller hash
  -- participates. jsonb text serialization normalizes object key order and
  -- preserves array order, so the same canonical content always hashes the
  -- same. Ordinals are deliberately EXCLUDED: ordered ids plus ordered spans
  -- already distinguish the commit decision, and excluding ordinals is what
  -- makes an existing-batch replay independent of today's frontier.
  canonical := jsonb_build_object(
    'batch_id', p_batch_id,
    'user_id', turn_row.user_id,
    'session_id', turn_row.session_id,
    'source_turn_id', turn_row.id,
    'source_role', turn_row.role,
    'speaker_state', derived_speaker,
    'source_modality', derived_modality,
    'source_content_sha256', encode(derived_digest, 'hex'),
    'evaluator_version', p_evaluator_version,
    'policy_version', p_policy_version,
    'segmentation_provider', p_segmentation_provider,
    'segmentation_model', p_segmentation_model,
    'segmentation_prompt_version', p_segmentation_prompt_version,
    'unit_count', unit_count,
    'units', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'unit_id', unit_ids[g.i],
               'span_start', span_starts[g.i],
               'span_end', span_ends[g.i]) ORDER BY g.i)
        FROM generate_series(1, unit_count) AS g(i)), '[]'::jsonb));
  fingerprint := sha256(convert_to(canonical::text, 'UTF8'));

  SELECT * INTO batch_row FROM public.conversation_unit_commit_batches b WHERE b.id = p_batch_id;
  IF FOUND THEN is_replay := true; END IF;

  ---------------------------------------------------------------------------
  -- PATH B - NEW BATCH COMMIT. The forward-only source frontier applies to new
  -- writes only.
  ---------------------------------------------------------------------------
  IF NOT is_replay THEN
    SELECT COALESCE(MAX(cu.source_span_end), 0), COALESCE(MAX(cu.ordinal_within_turn) + 1, 0)
      INTO frontier, next_ordinal
      FROM public.conversation_units cu WHERE cu.source_turn_id = turn_row.id;

    -- A later batch may only append source material after everything already
    -- committed for this turn. Gaps are allowed; overlap and backward or
    -- in-between insertion are not. Because the frontier is at or after the end
    -- of every committed CU, this single check also subsumes cross-batch
    -- overlap, and combined with the strict ascent proven above it makes
    -- `ordinal_within_turn` global canonical source order rather than
    -- commit-arrival order.
    IF unit_count > 0 AND span_starts[1] < frontier THEN
      RAISE EXCEPTION 'SPAN_BEFORE_SOURCE_FRONTIER' USING ERRCODE='22023',
        DETAIL='A later commitment batch may only append source material after the committed source frontier of its turn.';
    END IF;

    INSERT INTO public.conversation_unit_commit_batches (
      id, user_id, session_id, source_turn_id, canonical_fingerprint, source_content_sha256,
      unit_count, evaluator_version, policy_version,
      segmentation_provider, segmentation_model, segmentation_prompt_version)
    VALUES (
      p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, fingerprint, derived_digest,
      unit_count, p_evaluator_version, p_policy_version,
      p_segmentation_provider, p_segmentation_model, p_segmentation_prompt_version)
    ON CONFLICT (id) DO NOTHING;
    GET DIAGNOSTICS inserted_batches = ROW_COUNT;

    IF inserted_batches = 0 THEN
      -- A concurrent transaction created this batch id. Fall through to the
      -- replay path, which verifies historical identity instead of appending.
      SELECT * INTO batch_row FROM public.conversation_unit_commit_batches b WHERE b.id = p_batch_id;
      is_replay := true;
    ELSE
      INSERT INTO public.conversation_units (
        id, user_id, session_id, source_turn_id, commit_batch_id,
        source_role, speaker_state, source_modality,
        ordinal_within_turn, source_span_start, source_span_end,
        committed_text, source_content_sha256)
      SELECT unit_ids[g.i], turn_row.user_id, turn_row.session_id, turn_row.id, p_batch_id,
             turn_row.role, derived_speaker, derived_modality,
             next_ordinal + g.i - 1, span_starts[g.i], span_ends[g.i],
             substring(turn_row.content from span_starts[g.i] + 1 for span_ends[g.i] - span_starts[g.i]),
             derived_digest
        FROM generate_series(1, unit_count) AS g(i);

      RETURN QUERY SELECT cu.* FROM public.conversation_units cu
        WHERE cu.commit_batch_id = p_batch_id ORDER BY cu.ordinal_within_turn;
      RETURN;
    END IF;
  END IF;

  ---------------------------------------------------------------------------
  -- PATH A - EXISTING BATCH REPLAY. Historical identity verification, never a
  -- new append request. The current frontier is NOT applied to historical batch
  -- spans and ordinals are NOT re-derived from today's MAX(ordinal)+1, so an
  -- exact replay of an earlier batch still succeeds after later batches have
  -- advanced the frontier. Zero mutation.
  ---------------------------------------------------------------------------
  IF batch_row.user_id <> turn_row.user_id
     OR batch_row.session_id <> turn_row.session_id
     OR batch_row.source_turn_id <> turn_row.id
     OR batch_row.source_content_sha256 IS DISTINCT FROM derived_digest
     OR batch_row.evaluator_version <> p_evaluator_version
     OR batch_row.policy_version <> p_policy_version
     OR batch_row.segmentation_provider <> p_segmentation_provider
     OR batch_row.segmentation_model <> p_segmentation_model
     OR batch_row.segmentation_prompt_version <> p_segmentation_prompt_version
     OR batch_row.unit_count <> unit_count
     OR batch_row.canonical_fingerprint IS DISTINCT FROM fingerprint THEN
    RAISE EXCEPTION 'COMMIT_BATCH_PAYLOAD_CONFLICT' USING ERRCODE='22023',
      DETAIL='A commitment batch identity is immutable: the same batch id can never be replayed with different content.';
  END IF;

  SELECT count(*) INTO stored_count FROM public.conversation_units cu WHERE cu.commit_batch_id = p_batch_id;
  IF stored_count <> unit_count THEN
    RAISE EXCEPTION 'COMMIT_BATCH_PAYLOAD_CONFLICT' USING ERRCODE='22023';
  END IF;

  -- Tuple-by-tuple comparison of the stored rows against this call's payload
  -- and against freshly re-derived canonical source values. The hash alone is
  -- never the protection.
  IF EXISTS (
    SELECT 1 FROM (
      SELECT cu.*, row_number() OVER (ORDER BY cu.ordinal_within_turn) AS rn
        FROM public.conversation_units cu WHERE cu.commit_batch_id = p_batch_id) st
    WHERE st.id <> unit_ids[st.rn::integer]
       OR st.source_span_start <> span_starts[st.rn::integer]
       OR st.source_span_end <> span_ends[st.rn::integer]
       OR st.user_id <> turn_row.user_id
       OR st.session_id <> turn_row.session_id
       OR st.source_turn_id <> turn_row.id
       OR st.source_role <> turn_row.role
       OR st.speaker_state <> derived_speaker
       OR st.source_modality <> derived_modality
       OR st.source_content_sha256 IS DISTINCT FROM derived_digest
       OR st.committed_text <> substring(turn_row.content from st.source_span_start + 1
                                         for st.source_span_end - st.source_span_start)) THEN
    RAISE EXCEPTION 'COMMIT_BATCH_PAYLOAD_CONFLICT' USING ERRCODE='22023';
  END IF;

  -- Stored ordinal integrity: contiguous inside the batch and monotone in
  -- source position. This is what allows ordinals to be omitted from the
  -- fingerprint without weakening identity.
  IF EXISTS (
    SELECT 1 FROM (
      SELECT cu.ordinal_within_turn AS ordinal, cu.source_span_start AS span_start,
             lag(cu.ordinal_within_turn) OVER (ORDER BY cu.ordinal_within_turn) AS prev_ordinal,
             lag(cu.source_span_end) OVER (ORDER BY cu.ordinal_within_turn) AS prev_end
        FROM public.conversation_units cu WHERE cu.commit_batch_id = p_batch_id) q
    WHERE q.prev_ordinal IS NOT NULL
      AND (q.ordinal <> q.prev_ordinal + 1 OR q.span_start < q.prev_end)) THEN
    RAISE EXCEPTION 'COMMIT_BATCH_ORDINAL_INTEGRITY' USING ERRCODE='55000';
  END IF;

  RETURN QUERY SELECT cu.* FROM public.conversation_units cu
    WHERE cu.commit_batch_id = p_batch_id ORDER BY cu.ordinal_within_turn;
  RETURN;
END;$$;

-- 5. Ownership, search_path hardening, and least privilege. The substrate is
--    unreachable: no application role may read or write either table, and the
--    producer is granted to NO role at all. This is the T-03A1 activation gate.
--    Because apps/api holds no PostgreSQL driver and reaches the database only
--    through PostgREST as `authenticated` or `service_role`, no code path in
--    the deployed product can execute the producer. T-03A2 owns the single
--    activation act that adds SP allocation/sealing and grants EXECUTE in the
--    same migration, so temporal establishment and executability arrive
--    together.
ALTER TABLE public.conversation_unit_commit_batches OWNER TO postgres;
ALTER TABLE public.conversation_units OWNER TO postgres;
ALTER TABLE public.conversation_unit_commit_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_units ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.conversation_unit_commit_batches, public.conversation_units
  FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.reject_committed_conversational_unit_mutation_v1() OWNER TO postgres;
ALTER FUNCTION public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reject_committed_conversational_unit_mutation_v1()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text)
  FROM PUBLIC, anon, authenticated;

DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.conversation_unit_commit_batches, public.conversation_units FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.reject_committed_conversational_unit_mutation_v1() FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text) FROM service_role';
END IF;END$$;

-- 6. Terminal self-assertions. The migration refuses to deploy a substrate that
--    is production-reachable or that carries a Moment-adjacent field, so drift
--    cannot pass silently.
DO $$
DECLARE
  producer constant text := 'public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text)';
  target_role text;
  target_table text;
  target_privilege text;
BEGIN
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
      IF has_function_privilege(target_role, producer, 'EXECUTE') THEN
        RAISE EXCEPTION 'T-03A1 is production-inert: % must not hold EXECUTE on the commitment producer', target_role;
      END IF;
      FOREACH target_table IN ARRAY ARRAY['public.conversation_units','public.conversation_unit_commit_batches'] LOOP
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'T-03A1 substrate must be unreachable: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END LOOP;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name IN ('conversation_units','conversation_unit_commit_batches')
       AND (c.column_name ~* 'session_position|live_head|(^|_)lh($|_)|(^|_)sp($|_)|moment|updated_at|(^|_)status($|_)')
  ) THEN
    RAISE EXCEPTION 'T-03A1 must introduce no SP/LH/Moment/status column';
  END IF;

  IF (SELECT count(*) FROM public.conversation_units) <> 0
     OR (SELECT count(*) FROM public.conversation_unit_commit_batches) <> 0 THEN
    RAISE EXCEPTION 'T-03A1 creates a forward-only substrate and backfills nothing';
  END IF;
END$$;

COMMIT;
