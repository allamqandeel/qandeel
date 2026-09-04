-- T-03A2 - Session Semantic Clock + SP Allocation/Sealing + LH Establishment +
-- Committed-CU Delivery v1.
--
-- Stage 6 freezes:
--
--   ONE COMMITTED CU = ONE MOMENT
--   SP(m)            = per-Session ordinal of the committed CU
--   LH               = greatest committed CU SP in the current Session
--
-- T-03A1 (migration 0064) built the committed-CU substrate and deliberately
-- granted its producer to NO application role, so no SP could be allocated and
-- no CU could be produced. This migration is the ONE activation act: it adds
-- the server-owned Session Semantic Clock, makes `session_position` born
-- atomically with every committed CU, derives LH from the clock, publishes the
-- durable `ConversationalUnitsCommitted` delivery surface, and only then grants
-- EXECUTE on the producer to `service_role`. Commitment and temporal
-- establishment therefore become executable together: there is no window in
-- which a committed CU can exist without an SP, and no state named
-- COMMITTED_WITHOUT_SP, SP_PENDING, PRE_MOMENT or PENDING_MOMENT is created.
--
-- What this migration is NOT:
--   * it is not Emerging Focus, Thread lifecycle, LF, Reading/Evidence/Memory/
--     Question/Confidence historical integration, K(TC)/V, KF/VF/VT, Timeline,
--     Map, Preview, RH or recovery persistence - none of those has a column,
--     a function or a wire field here;
--   * it manufactures no historical baseline membership and compares no
--     timestamp to decide PRE_FIRST_SP: T-03C owns historical projection and
--     complete-coverage enablement, and a Session that receives SPs here is not
--     thereby declared historical-enabled;
--   * it does not rewrite migration 0064, does not touch
--     `runtime_event_outbox` or the post-response dispatch ledger, and does not
--     alter `conversation_turns`, `conversation_sessions` or
--     `finalize_conversation_turn_v2`.
--
-- A timestamp is never SP. `current_sp` is an integer ordinal allocated under a
-- row lock; nothing here reads a clock time to decide a Session Position.

BEGIN;

-- 0. Activation preconditions.
--
--    The frozen UTF-8 environment contract of 0064 still binds (committed
--    wording is sliced by the database from the canonical source inside the
--    producer rewritten below), and `conversation_units` MUST still be empty:
--    T-03A1 granted the producer to no application role precisely so that
--    T-03A2 would never have to guess an SP for a pre-existing row. If any CU
--    row exists, this migration refuses to activate rather than backfill a
--    fabricated Session Position.
DO $$BEGIN
  IF current_setting('server_encoding') <> 'UTF8' THEN
    RAISE EXCEPTION 'T-03A2 requires a UTF8 server encoding; found %', current_setting('server_encoding')
      USING ERRCODE='0A000';
  END IF;
  IF (SELECT count(*) FROM public.conversation_units) <> 0 THEN
    RAISE EXCEPTION 'T-03A2 refuses to activate over pre-existing committed conversational units'
      USING ERRCODE='55000',
            DETAIL='session_position is born atomically with the CU. Guessed or backfilled Session Positions are not canonical Session time.';
  END IF;
  IF (SELECT count(*) FROM public.conversation_unit_commit_batches) <> 0 THEN
    RAISE EXCEPTION 'T-03A2 refuses to activate over pre-existing commitment batches'
      USING ERRCODE='55000',
            DETAIL='A pre-existing batch would have no derivable delivery event and no derivable SP range.';
  END IF;
END$$;

-- 1. The Session Semantic Clock. One row per Session, server-owned.
--
--    `current_sp IS NULL` means exactly one thing: no user-addressable
--    committed CU / SP exists yet in this Session. It is NOT SP(0), NOT
--    PRE_FIRST_SP as a Product state, NOT a Moment and NOT a temporal mode -
--    there is no column here in which such a state could live.
--
--    `same_sp_event_sequence` is the INTERNAL sequencing seam for later
--    Stage-6 semantic writers that must order several events inside one open
--    SP. It is never a Moment, never addressable and never client-visible.
--
--    There is deliberately no `live_head` column: LH is DERIVED from
--    `current_sp`, so a second mutable head authority cannot drift from it.
--    There is deliberately no timestamp column at all: an audit time here would
--    invite a wall-clock read into a Session Position decision.
CREATE TABLE public.session_semantic_clocks (
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  current_sp integer,
  same_sp_event_sequence bigint NOT NULL DEFAULT 0,
  CONSTRAINT session_semantic_clocks_session_user_fk
    FOREIGN KEY (session_id, user_id)
    REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT session_semantic_clocks_current_sp_check
    CHECK (current_sp IS NULL OR current_sp >= 1),
  CONSTRAINT session_semantic_clocks_event_sequence_check
    CHECK (same_sp_event_sequence >= 0)
);

-- Every Session that already exists receives its clock, with no SP: nothing is
-- backfilled, because no committed CU exists anywhere.
INSERT INTO public.session_semantic_clocks (session_id, user_id)
SELECT s.id, s.user_id FROM public.conversation_sessions s;

-- Every FUTURE Session receives its clock atomically with its own insertion.
-- The trigger function is SECURITY DEFINER because `authenticated` may insert
-- an owned session row directly (migration 0002) and holds no privilege on the
-- clock table; the clock must still appear, and only with the session's own
-- server-derived owner. ON CONFLICT DO NOTHING keeps the one-row invariant
-- under any duplicate or concurrent same-identity attempt.
CREATE FUNCTION public.provision_session_semantic_clock_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO public.session_semantic_clocks (session_id, user_id)
  VALUES (NEW.id, NEW.user_id)
  ON CONFLICT (session_id) DO NOTHING;
  RETURN NULL;
END;$$;

CREATE TRIGGER conversation_sessions_provision_semantic_clock
  AFTER INSERT ON public.conversation_sessions
  FOR EACH ROW EXECUTE FUNCTION public.provision_session_semantic_clock_v1();

-- 2. `session_position` on the committed CU: born atomically with the row.
--
--    NOT NULL with no default and no backfill is possible only because the
--    table is empty (asserted above). After this migration no committed CU can
--    ever exist without an SP. The row is immutable by the 0064 append-only
--    trigger, so `session_position` is immutable for free: no writer, owner
--    included, can renumber a Moment.
ALTER TABLE public.conversation_units
  ADD COLUMN session_position integer NOT NULL,
  ADD CONSTRAINT conversation_units_session_position_check CHECK (session_position >= 1),
  ADD CONSTRAINT conversation_units_session_sp_unique UNIQUE (session_id, session_position);

-- 3. The dedicated `ConversationalUnitsCommitted` durable delivery surface.
--
--    `runtime_event_outbox` is structurally incompatible and is NOT reused: it
--    is UNIQUE(event_type, subject_turn_id), i.e. one row per source turn,
--    while the frozen CU grammar allows several valid commitment batches per
--    source turn. This table is keyed on the BATCH, so multiple batches for one
--    turn produce separate events and the forbidden one-event-per-turn
--    assumption cannot return.
--
--    One row per NON-ZERO committed batch. The table name encodes the event
--    type - no generic event ontology, no `event_type` column, no `payload`
--    column. It carries no committed text, no analysis, no Reading, no Thread,
--    no LF, no K/V and no future material: its only purpose is to deliver
--    authoritative committed-CU / SP advancement. `created_at` is audit
--    metadata and is never temporal authority.
CREATE TABLE public.conversation_unit_commit_events (
  commit_batch_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  source_turn_id uuid NOT NULL,
  first_sp integer NOT NULL,
  last_sp integer NOT NULL,
  unit_count integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT conversation_unit_commit_events_batch_fk
    FOREIGN KEY (commit_batch_id)
    REFERENCES public.conversation_unit_commit_batches (id) ON DELETE RESTRICT,
  CONSTRAINT conversation_unit_commit_events_session_user_fk
    FOREIGN KEY (session_id, user_id)
    REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
  CONSTRAINT conversation_unit_commit_events_turn_fk
    FOREIGN KEY (source_turn_id) REFERENCES public.conversation_turns (id) ON DELETE RESTRICT,
  CONSTRAINT conversation_unit_commit_events_range_check CHECK (
    first_sp >= 1 AND last_sp >= first_sp AND unit_count = last_sp - first_sp + 1)
);

CREATE INDEX conversation_unit_commit_events_session_idx
  ON public.conversation_unit_commit_events (session_id, first_sp);

CREATE FUNCTION public.reject_conversation_unit_commit_event_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'CONVERSATIONAL_UNITS_COMMITTED_EVENT_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='A committed-CU delivery event is append-only: UPDATE and DELETE are refused for every role, including the table owner.';
END;$$;

CREATE TRIGGER conversation_unit_commit_events_immutable
  BEFORE UPDATE OR DELETE ON public.conversation_unit_commit_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_conversation_unit_commit_event_mutation_v1();

-- 4. AF66-01 same-SP sequencing seam for later Stage-6 semantic writers.
--
--    T-03B1 / T-03B2 / T-03D and later historical semantic writers need to
--    order several events inside the SAME open Session Position without
--    inventing a sub-Moment coordinate. This helper is the ONE place that does
--    it, and it enforces the frozen lock order: the Session Semantic Clock is
--    acquired FIRST, and the row lock is held until the calling semantic
--    transaction ends.
--
--    It is INTERNAL: server-owned, non-addressable, not a Moment, not
--    client-visible, not an API transport cursor, and granted to no application
--    role. A later task calls it from inside its own SECURITY DEFINER
--    transaction.
--
--    Before the first SP it fails closed. `SESSION_POSITION_NOT_ESTABLISHED` is
--    a technical absence, not PRE_FIRST_SP membership: no Product state is
--    invented here.
CREATE FUNCTION public.reserve_session_same_sp_event_v1(
  p_session_id uuid,
  p_user_id uuid
) RETURNS TABLE(session_position integer, event_sequence bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  clock_row public.session_semantic_clocks;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;
  SELECT * INTO clock_row FROM public.session_semantic_clocks c
    WHERE c.session_id = p_session_id AND c.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF clock_row.current_sp IS NULL THEN
    RAISE EXCEPTION 'SESSION_POSITION_NOT_ESTABLISHED' USING ERRCODE='55000',
      DETAIL='No user-addressable committed Session Position exists yet in this Session.';
  END IF;
  UPDATE public.session_semantic_clocks c
     SET same_sp_event_sequence = c.same_sp_event_sequence + 1
   WHERE c.session_id = p_session_id
   RETURNING c.current_sp, c.same_sp_event_sequence
    INTO session_position, event_sequence;
  RETURN NEXT;
END;$$;

-- 5. The rewritten commitment producer.
--
--    The ENTIRE 0064 rejection / idempotency / source-frontier contract is
--    preserved verbatim; the only additions are the clock lock, SP allocation,
--    SP integrity verification on replay, and the durable delivery event.
--
--    AF66-01 lock order, load-bearing and provable from the body below:
--
--      Session Semantic Clock  ->  source turn  ->  other T-03A2-owned rows
--
--    The clock lock is taken BEFORE the source-turn lock and is held for the
--    whole semantic transaction. Exactly one Session clock is acquired per
--    semantic transaction in v1. This is a disciplined, single-direction lock
--    order, not a claim that arbitrary database deadlocks are impossible.
CREATE OR REPLACE FUNCTION public.commit_conversation_units_v1(
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
  clock_row public.session_semantic_clocks;
  session_row public.conversation_sessions;
  turn_row public.conversation_turns;
  batch_row public.conversation_unit_commit_batches;
  event_row public.conversation_unit_commit_events;
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
  next_sp integer;
  last_sp integer;
  stored_first_sp integer;
  stored_last_sp integer;
  canonical jsonb;
  fingerprint bytea;
  is_replay boolean := false;
  inserted_batches integer;
  stored_count integer;
BEGIN
  ---------------------------------------------------------------------------
  -- COMMON SETUP (both paths): parameter structure, THE SESSION CLOCK LOCK,
  -- identity, source lock, canonical derivation, and structural validation of
  -- the ordered payload.
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

  -- AF66-01: the Session Semantic Clock is the FIRST lock of the semantic
  -- transaction, taken before the source turn and before any other T-03A2 row.
  -- It doubles as the owner-scoped Session gate: a cross-user or nonexistent
  -- Session fails closed here without leaking existence.
  SELECT * INTO clock_row FROM public.session_semantic_clocks c
    WHERE c.session_id = p_session_id AND c.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  SELECT * INTO session_row FROM public.conversation_sessions s
    WHERE s.id = p_session_id AND s.user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  -- The one serialization point for this source turn, acquired AFTER the clock.
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

  -- Structural validation of the ordered payload. Source-relative and therefore
  -- identical for a new commit and for an existing-batch replay.
  cursor_pos := 0;
  FOR idx IN 0 .. unit_count - 1 LOOP
    unit := p_units -> idx;
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
    IF idx > 0 AND span_starts[idx + 1] < cursor_pos THEN
      RAISE EXCEPTION 'SPAN_NOT_FORWARD_ORDERED' USING ERRCODE='22023';
    END IF;
    cursor_pos := span_ends[idx + 1];
  END LOOP;
  IF unit_count > 1 AND (SELECT count(DISTINCT d.u) FROM unnest(unit_ids) AS d(u)) <> unit_count THEN
    RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023',
      DETAIL='Unit identities inside a commitment batch must be distinct.';
  END IF;

  -- The DB-derived canonical fingerprint, unchanged from 0064: no caller hash
  -- participates, and SP is deliberately EXCLUDED exactly as ordinals are. A
  -- historical batch replay must therefore stay independent of today's clock.
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
  -- writes only. SP allocation, clock advance and delivery-event insertion all
  -- happen inside this ONE transaction under the clock lock taken above.
  ---------------------------------------------------------------------------
  IF NOT is_replay THEN
    SELECT COALESCE(MAX(cu.source_span_end), 0), COALESCE(MAX(cu.ordinal_within_turn) + 1, 0)
      INTO frontier, next_ordinal
      FROM public.conversation_units cu WHERE cu.source_turn_id = turn_row.id;

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
      -- A ZERO-CU batch is a valid committed evaluation batch. It receives no
      -- CU, allocates no SP, does not change current_sp, does not change LH and
      -- creates no advancement event.
      IF unit_count = 0 THEN
        RETURN;
      END IF;

      -- SP allocation. `COALESCE(current_sp, 0) + 1` is arithmetic INSIDE the
      -- allocator before SP(1); it creates no SP(0) and no Product state.
      next_sp := COALESCE(clock_row.current_sp, 0) + 1;
      last_sp := next_sp + unit_count - 1;

      INSERT INTO public.conversation_units (
        id, user_id, session_id, source_turn_id, commit_batch_id,
        source_role, speaker_state, source_modality,
        ordinal_within_turn, source_span_start, source_span_end,
        committed_text, source_content_sha256, session_position)
      SELECT unit_ids[g.i], turn_row.user_id, turn_row.session_id, turn_row.id, p_batch_id,
             turn_row.role, derived_speaker, derived_modality,
             next_ordinal + g.i - 1, span_starts[g.i], span_ends[g.i],
             substring(turn_row.content from span_starts[g.i] + 1 for span_ends[g.i] - span_starts[g.i]),
             derived_digest, next_sp + g.i - 1
        FROM generate_series(1, unit_count) AS g(i);

      -- SP sealing is DERIVED, never a second mutable flag: after this advance
      -- every SP(n) with n < current_sp is sealed, and only the final head SP
      -- remains open. For a multi-CU block SP(a)..SP(b), every position before
      -- SP(b) seals inside this same atomic transaction.
      UPDATE public.session_semantic_clocks c
         SET current_sp = last_sp, same_sp_event_sequence = 0
       WHERE c.session_id = turn_row.session_id;

      INSERT INTO public.conversation_unit_commit_events (
        commit_batch_id, user_id, session_id, source_turn_id, first_sp, last_sp, unit_count)
      VALUES (p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, next_sp, last_sp, unit_count);

      RETURN QUERY SELECT cu.* FROM public.conversation_units cu
        WHERE cu.commit_batch_id = p_batch_id ORDER BY cu.ordinal_within_turn;
      RETURN;
    END IF;
  END IF;

  ---------------------------------------------------------------------------
  -- PATH A - EXISTING BATCH REPLAY. Historical identity verification, never a
  -- new append request: zero clock mutation, zero SP mutation, zero event
  -- mutation, zero ordinal reallocation, and no recheck of historical spans
  -- against today's frontier.
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

  -- Stored SP integrity. A replay VALIDATES the stored Session Positions; it
  -- never recomputes them. They must be a contiguous ascending block in the
  -- same order as the ordinals, and none may sit beyond the current head.
  IF unit_count > 0 THEN
    SELECT MIN(cu.session_position), MAX(cu.session_position)
      INTO stored_first_sp, stored_last_sp
      FROM public.conversation_units cu WHERE cu.commit_batch_id = p_batch_id;
    IF stored_first_sp IS NULL OR stored_first_sp < 1
       OR clock_row.current_sp IS NULL OR stored_last_sp > clock_row.current_sp
       OR stored_last_sp - stored_first_sp + 1 <> unit_count THEN
      RAISE EXCEPTION 'COMMIT_BATCH_SESSION_POSITION_INTEGRITY' USING ERRCODE='55000';
    END IF;
    IF EXISTS (
      SELECT 1 FROM (
        SELECT cu.session_position AS sp,
               lag(cu.session_position) OVER (ORDER BY cu.ordinal_within_turn) AS prev_sp
          FROM public.conversation_units cu WHERE cu.commit_batch_id = p_batch_id) p
      WHERE p.prev_sp IS NOT NULL AND p.sp <> p.prev_sp + 1) THEN
      RAISE EXCEPTION 'COMMIT_BATCH_SESSION_POSITION_INTEGRITY' USING ERRCODE='55000';
    END IF;

    -- A non-zero batch MUST already carry exactly one durable delivery event,
    -- and it must agree with the stored unit SPs.
    SELECT * INTO event_row FROM public.conversation_unit_commit_events e
      WHERE e.commit_batch_id = p_batch_id;
    IF NOT FOUND
       OR event_row.user_id <> turn_row.user_id
       OR event_row.session_id <> turn_row.session_id
       OR event_row.source_turn_id <> turn_row.id
       OR event_row.first_sp <> stored_first_sp
       OR event_row.last_sp <> stored_last_sp
       OR event_row.unit_count <> unit_count THEN
      RAISE EXCEPTION 'COMMIT_BATCH_DELIVERY_INTEGRITY' USING ERRCODE='55000';
    END IF;
  ELSIF EXISTS (SELECT 1 FROM public.conversation_unit_commit_events e WHERE e.commit_batch_id = p_batch_id) THEN
    -- A zero-CU batch advances nothing, so it must carry no advancement event.
    RAISE EXCEPTION 'COMMIT_BATCH_DELIVERY_INTEGRITY' USING ERRCODE='55000';
  END IF;

  RETURN QUERY SELECT cu.* FROM public.conversation_units cu
    WHERE cu.commit_batch_id = p_batch_id ORDER BY cu.ordinal_within_turn;
  RETURN;
END;$$;

-- 6. The atomic USER -> ASSISTANT finalized-exchange coordinator.
--
--    `finalize_conversation_turn_v2` completes the USER source turn and inserts
--    the ASSISTANT turn together operationally. They remain TWO separate source
--    turns and TWO separate commitment batches: there is no USER+ASSISTANT
--    combined CU and no combined Moment. The frozen consequence is
--
--      USER CU(s)  then  ASSISTANT CU(s)
--
--    with no interleaving SP inside the finalized exchange.
--
--    This coordinator reuses the canonical producer above rather than
--    duplicating weaker validation. It takes the Session clock FIRST (AF66-01)
--    and holds it across BOTH blocks, so no other Session SP writer can
--    interleave between them; either block failing rolls the whole exchange
--    back; and an exact replay returns the stored canonical pair with zero
--    mutation.
--
--    FIX-T03A2-01. The PARAMETER NAMES ARE NOT AUTHORITY. The canonical producer
--    proves that each source turn is one of USER|ASSISTANT and derives the role
--    stored on every CU from the locked row, but it cannot prove that the FIRST
--    argument names the USER source, that the SECOND names the ASSISTANT
--    source, or that the two are one finalized exchange. Without that proof a
--    privileged caller could hand in a swapped pair, or two unrelated completed
--    turns of the same Session, and this coordinator would allocate Session
--    Positions in a false exchange order and present unrelated source as one
--    atomic finalized exchange.
--
--    So the RELATION is derived from the locked source rows below, before any
--    commitment block runs. `conversation_turns.source_turn_id` is UNIQUE
--    (migration 0003, `conversation_turns_one_assistant_per_source`), so
--    `assistant.source_turn_id = user.id` identifies exactly one finalized
--    response; and the canonical USER-turn creator
--    (`create_user_conversation_turn`, migration 0030) always writes
--    `source_turn_id = NULL`, so requiring it asserts the existing contract
--    rather than inventing a broader one.
CREATE FUNCTION public.commit_finalized_exchange_conversation_units_v1(
  p_session_id uuid,
  p_user_id uuid,
  p_user_source_turn_id uuid,
  p_user_batch_id uuid,
  p_user_units jsonb,
  p_assistant_source_turn_id uuid,
  p_assistant_batch_id uuid,
  p_assistant_units jsonb,
  p_evaluator_version text,
  p_policy_version text,
  p_segmentation_provider text,
  p_segmentation_model text,
  p_segmentation_prompt_version text
) RETURNS TABLE(
  live_head integer,
  user_units jsonb,
  assistant_units jsonb,
  user_event jsonb,
  assistant_event jsonb
) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  clock_row public.session_semantic_clocks;
  user_turn_row public.conversation_turns;
  assistant_turn_row public.conversation_turns;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL
     OR p_user_source_turn_id IS NULL OR p_assistant_source_turn_id IS NULL
     OR p_user_batch_id IS NULL OR p_assistant_batch_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;
  IF p_user_source_turn_id = p_assistant_source_turn_id OR p_user_batch_id = p_assistant_batch_id THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023',
      DETAIL='A finalized exchange carries two distinct source turns and two distinct commitment batches.';
  END IF;

  -- AF66-01: exactly ONE Session clock, acquired FIRST and held for the whole
  -- exchange transaction. The nested producer calls re-acquire the same row
  -- lock, which is already held, so no second lock order exists.
  SELECT * INTO clock_row FROM public.session_semantic_clocks c
    WHERE c.session_id = p_session_id AND c.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  -- FIX-T03A2-01: the finalized-exchange RELATION, derived from the locked
  -- source rows and never from the parameter names. Both rows are locked after
  -- the clock and in the deterministic USER-then-ASSISTANT order the exchange
  -- itself uses, so this adds no second lock order. An owner-scoped miss fails
  -- closed as FORBIDDEN without leaking whether the turn exists elsewhere,
  -- exactly as the canonical producer does.
  SELECT * INTO user_turn_row FROM public.conversation_turns t
    WHERE t.id = p_user_source_turn_id AND t.session_id = p_session_id AND t.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  SELECT * INTO assistant_turn_row FROM public.conversation_turns t
    WHERE t.id = p_assistant_source_turn_id AND t.session_id = p_session_id AND t.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  IF user_turn_row.role <> 'USER'
     OR user_turn_row.status <> 'COMPLETED'
     OR user_turn_row.source_turn_id IS NOT NULL
     OR assistant_turn_row.role <> 'ASSISTANT'
     OR assistant_turn_row.status <> 'COMPLETED'
     OR assistant_turn_row.source_turn_id IS DISTINCT FROM user_turn_row.id THEN
    RAISE EXCEPTION 'INVALID_FINALIZED_EXCHANGE_RELATION' USING ERRCODE='22023',
      DETAIL='A finalized exchange is one COMPLETED USER source turn and the COMPLETED ASSISTANT turn finalized as its response, in that order.';
  END IF;

  -- USER block first, ASSISTANT block second: canonical conversational order.
  SELECT COALESCE(jsonb_agg(to_jsonb(u) ORDER BY u.ordinal_within_turn), '[]'::jsonb)
    INTO user_units
    FROM public.commit_conversation_units_v1(
      p_session_id, p_user_id, p_user_source_turn_id, p_user_batch_id, p_user_units,
      p_evaluator_version, p_policy_version, p_segmentation_provider,
      p_segmentation_model, p_segmentation_prompt_version) u;

  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.ordinal_within_turn), '[]'::jsonb)
    INTO assistant_units
    FROM public.commit_conversation_units_v1(
      p_session_id, p_user_id, p_assistant_source_turn_id, p_assistant_batch_id, p_assistant_units,
      p_evaluator_version, p_policy_version, p_segmentation_provider,
      p_segmentation_model, p_segmentation_prompt_version) a;

  SELECT c.current_sp INTO live_head FROM public.session_semantic_clocks c
    WHERE c.session_id = p_session_id;
  SELECT to_jsonb(e) INTO user_event FROM public.conversation_unit_commit_events e
    WHERE e.commit_batch_id = p_user_batch_id;
  SELECT to_jsonb(e) INTO assistant_event FROM public.conversation_unit_commit_events e
    WHERE e.commit_batch_id = p_assistant_batch_id;
  RETURN NEXT;
END;$$;

-- 7. Narrow service-role batch/source snapshot read.
--
--    The runtime must be able to ask the database whether the deterministic
--    automatic batch for a finalized source turn ALREADY exists before it
--    invokes the segmentation provider, so a successful commitment is never
--    re-inferred on retry. It also returns the committed source frontier of
--    that turn, so the evaluator never trusts a stale caller value. The
--    frontier is source-span ordering data - it is NOT SP and NOT LH.
--
--    A committed ZERO-CU batch also counts as complete: it exists, carries no
--    unit and carries no event.
--
--    Ownership is validated explicitly inside the definer body because the
--    caller is `service_role`, whose supplied user id is never authorization on
--    its own.
CREATE FUNCTION public.get_conversation_unit_commit_batch_snapshot_v1(
  p_session_id uuid,
  p_user_id uuid,
  p_source_turn_id uuid,
  p_batch_id uuid
) RETURNS TABLE(
  batch_exists boolean,
  committed_unit_count integer,
  units jsonb,
  event jsonb,
  source_frontier integer,
  live_head integer
) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  batch_row public.conversation_unit_commit_batches;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL OR p_source_turn_id IS NULL OR p_batch_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversation_sessions s
                  WHERE s.id = p_session_id AND s.user_id = p_user_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversation_turns t
                  WHERE t.id = p_source_turn_id AND t.session_id = p_session_id AND t.user_id = p_user_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;

  SELECT COALESCE(MAX(cu.source_span_end), 0) INTO source_frontier
    FROM public.conversation_units cu WHERE cu.source_turn_id = p_source_turn_id;
  -- Derived LH for this Session, read in the same statement snapshot. It is
  -- NULL, never 0, when no user-addressable committed CU exists yet.
  SELECT c.current_sp INTO live_head FROM public.session_semantic_clocks c
    WHERE c.session_id = p_session_id;

  SELECT * INTO batch_row FROM public.conversation_unit_commit_batches b WHERE b.id = p_batch_id;
  IF NOT FOUND THEN
    batch_exists := false;
    committed_unit_count := 0;
    units := '[]'::jsonb;
    event := NULL;
    RETURN NEXT;
    RETURN;
  END IF;
  IF batch_row.user_id <> p_user_id OR batch_row.session_id <> p_session_id
     OR batch_row.source_turn_id <> p_source_turn_id THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;

  batch_exists := true;
  committed_unit_count := batch_row.unit_count;
  SELECT COALESCE(jsonb_agg(to_jsonb(cu) ORDER BY cu.ordinal_within_turn), '[]'::jsonb) INTO units
    FROM public.conversation_units cu WHERE cu.commit_batch_id = p_batch_id;
  SELECT to_jsonb(e) INTO event FROM public.conversation_unit_commit_events e
    WHERE e.commit_batch_id = p_batch_id;
  RETURN NEXT;
END;$$;

-- 8. The authenticated temporal read surface.
--
--    LH is DERIVED: `LH(session) = session_semantic_clocks.current_sp`. A
--    Session with no committed CU returns NULL, never 0 - the API and the
--    client never receive a zero sentinel. Ownership is server-derived from
--    `auth.uid()`; a caller-supplied user id is never client authorization.
CREATE FUNCTION public.get_session_temporal_state_v1(p_session_id uuid)
RETURNS TABLE(session_id uuid, live_head integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  caller uuid;
BEGIN
  caller := (SELECT auth.uid());
  IF caller IS NULL OR p_session_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
    SELECT c.session_id, c.current_sp
      FROM public.session_semantic_clocks c
     WHERE c.session_id = p_session_id AND c.user_id = caller;
END;$$;

-- Owner-scoped committed-CU delivery catch-up. This is a DELIVERY/RECOVERY
-- transport for LH, never a Timeline API: it carries no committed text, no
-- analysis and no historical projection, and T-03C alone owns history.
--
-- `p_after_sp` omitted (NULL) means "from the start of available delivery
-- events". When supplied it must be an integer >= 1: SP(0) is not a cursor and
-- cannot be expressed here.
CREATE FUNCTION public.get_conversational_units_committed_events_v1(
  p_session_id uuid,
  p_after_sp integer DEFAULT NULL,
  p_limit integer DEFAULT 64
) RETURNS TABLE(
  commit_batch_id uuid,
  session_id uuid,
  source_turn_id uuid,
  first_sp integer,
  last_sp integer,
  unit_count integer
) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  caller uuid;
  effective_limit integer;
BEGIN
  caller := (SELECT auth.uid());
  IF caller IS NULL OR p_session_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;
  IF p_after_sp IS NOT NULL AND p_after_sp < 1 THEN
    RAISE EXCEPTION 'INVALID_DELIVERY_CURSOR' USING ERRCODE='22023',
      DETAIL='A delivery cursor is an addressable Session Position >= 1; SP(0) does not exist.';
  END IF;
  effective_limit := COALESCE(p_limit, 64);
  IF effective_limit < 1 OR effective_limit > 256 THEN
    RAISE EXCEPTION 'INVALID_DELIVERY_LIMIT' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversation_sessions s
                  WHERE s.id = p_session_id AND s.user_id = caller) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
    SELECT e.commit_batch_id, e.session_id, e.source_turn_id, e.first_sp, e.last_sp, e.unit_count
      FROM public.conversation_unit_commit_events e
     WHERE e.session_id = p_session_id
       AND e.user_id = caller
       AND (p_after_sp IS NULL OR e.first_sp > p_after_sp)
     ORDER BY e.first_sp
     LIMIT effective_limit;
END;$$;

-- 9. Ownership, search_path hardening, and the ACTIVATION grants.
--
--    This is the exact point at which CU commitment and SP allocation become
--    executable together. The canonical producer and the exchange coordinator
--    are granted to `service_role` ONLY - never `anon`, never `authenticated` -
--    and no direct INSERT/UPDATE/DELETE is granted on the CU, clock or event
--    tables to any role, so table mutation stays unavailable and every write
--    passes through the definer authority above.
ALTER TABLE public.session_semantic_clocks OWNER TO postgres;
ALTER TABLE public.conversation_unit_commit_events OWNER TO postgres;
ALTER TABLE public.session_semantic_clocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_unit_commit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.session_semantic_clocks, public.conversation_unit_commit_events
  FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.provision_session_semantic_clock_v1() OWNER TO postgres;
ALTER FUNCTION public.reject_conversation_unit_commit_event_mutation_v1() OWNER TO postgres;
ALTER FUNCTION public.reserve_session_same_sp_event_v1(uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text)
  OWNER TO postgres;
ALTER FUNCTION public.commit_finalized_exchange_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,uuid,uuid,jsonb,text,text,text,text,text)
  OWNER TO postgres;
ALTER FUNCTION public.get_conversation_unit_commit_batch_snapshot_v1(uuid,uuid,uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.get_session_temporal_state_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.get_conversational_units_committed_events_v1(uuid,integer,integer) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.provision_session_semantic_clock_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_conversation_unit_commit_event_mutation_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_session_same_sp_event_v1(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_finalized_exchange_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,uuid,uuid,jsonb,text,text,text,text,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_conversation_unit_commit_batch_snapshot_v1(uuid,uuid,uuid,uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_session_temporal_state_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_conversational_units_committed_events_v1(uuid,integer,integer)
  FROM PUBLIC, anon, authenticated;

DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.session_semantic_clocks, public.conversation_unit_commit_events FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.provision_session_semantic_clock_v1() FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.reject_conversation_unit_commit_event_mutation_v1() FROM service_role';
  -- The same-SP sequencing seam stays INTERNAL: it is executable by no
  -- application role, service_role included. Later semantic writers call it
  -- from inside their own SECURITY DEFINER transaction.
  EXECUTE 'REVOKE ALL ON FUNCTION public.reserve_session_same_sp_event_v1(uuid,uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.get_session_temporal_state_v1(uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.get_conversational_units_committed_events_v1(uuid,integer,integer) FROM service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text) TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.commit_finalized_exchange_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,uuid,uuid,jsonb,text,text,text,text,text) TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_conversation_unit_commit_batch_snapshot_v1(uuid,uuid,uuid,uuid) TO service_role';
END IF;END$$;

GRANT EXECUTE ON FUNCTION public.get_session_temporal_state_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversational_units_committed_events_v1(uuid,integer,integer) TO authenticated;

-- 10. Terminal self-assertions. The migration refuses to deploy an activation
--     that is temporally incoherent, over-granted, or that disturbed the
--     existing runtime event contract.
DO $$
DECLARE
  producer constant text := 'public.commit_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text)';
  coordinator constant text := 'public.commit_finalized_exchange_conversation_units_v1(uuid,uuid,uuid,uuid,jsonb,uuid,uuid,jsonb,text,text,text,text,text)';
  same_sp_helper constant text := 'public.reserve_session_same_sp_event_v1(uuid,uuid)';
  target_role text;
  target_table text;
  target_privilege text;
  producer_row pg_proc;
BEGIN
  -- The activation left the substrate empty: nothing was backfilled.
  IF (SELECT count(*) FROM public.conversation_units) <> 0
     OR (SELECT count(*) FROM public.conversation_unit_commit_events) <> 0 THEN
    RAISE EXCEPTION 'T-03A2 activates a forward-only clock and backfills no Session Position';
  END IF;

  -- session_position exists, is NOT NULL, and Session-SP uniqueness exists.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns c
                  WHERE c.table_schema='public' AND c.table_name='conversation_units'
                    AND c.column_name='session_position' AND c.is_nullable='NO') THEN
    RAISE EXCEPTION 'T-03A2 requires a NOT NULL session_position on every committed conversational unit';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint k
                  WHERE k.conrelid='public.conversation_units'::regclass AND k.contype='u'
                    AND k.conname='conversation_units_session_sp_unique') THEN
    RAISE EXCEPTION 'T-03A2 requires UNIQUE(session_id, session_position)';
  END IF;

  -- Exactly one clock row per Session, and no zero Session Position anywhere.
  IF EXISTS (SELECT 1 FROM public.conversation_sessions s
              WHERE NOT EXISTS (SELECT 1 FROM public.session_semantic_clocks c WHERE c.session_id = s.id)) THEN
    RAISE EXCEPTION 'T-03A2 requires exactly one Session Semantic Clock row per Session';
  END IF;
  IF (SELECT count(*) FROM public.session_semantic_clocks) <> (SELECT count(*) FROM public.conversation_sessions) THEN
    RAISE EXCEPTION 'T-03A2 requires exactly one Session Semantic Clock row per Session';
  END IF;
  IF EXISTS (SELECT 1 FROM public.session_semantic_clocks c WHERE c.current_sp IS NOT NULL AND c.current_sp < 1) THEN
    RAISE EXCEPTION 'SP(0) is not a Session Position';
  END IF;

  -- No second mutable head authority, and no client-visible same-SP sequence.
  IF EXISTS (SELECT 1 FROM information_schema.columns c
              WHERE c.table_schema='public'
                AND c.table_name IN ('session_semantic_clocks','conversation_units','conversation_unit_commit_events')
                AND c.column_name ~* 'live_head|(^|_)lh($|_)|sealed|pre_first_sp|moment') THEN
    RAISE EXCEPTION 'T-03A2 derives LH and sealing; it creates no second mutable authority';
  END IF;

  -- The delivery event carries no semantic content of any kind.
  IF EXISTS (SELECT 1 FROM information_schema.columns c
              WHERE c.table_schema='public' AND c.table_name='conversation_unit_commit_events'
                AND (c.data_type IN ('text','jsonb','json','bytea')
                     OR c.column_name ~* 'text|payload|content|analysis|reading|thread|focus|confidence|evidence')) THEN
    RAISE EXCEPTION 'the committed-CU delivery event carries no content, analysis or future material';
  END IF;

  -- Producer identity, security posture and search path.
  SELECT * INTO producer_row FROM pg_proc WHERE oid = to_regprocedure(producer);
  IF NOT FOUND THEN RAISE EXCEPTION 'the canonical commitment producer is missing'; END IF;
  -- PostgreSQL stores the fixed empty search path as `search_path=""`, so the
  -- entry is matched by prefix rather than by exact element equality.
  IF pg_get_userbyid(producer_row.proowner) <> 'postgres' OR NOT producer_row.prosecdef
     OR NOT EXISTS (SELECT 1 FROM unnest(producer_row.proconfig) AS entry(setting)
                     WHERE entry.setting LIKE 'search_path=%') THEN
    RAISE EXCEPTION 'the canonical commitment producer must stay postgres-owned, SECURITY DEFINER and search_path-fixed';
  END IF;

  -- Activation grants: the producer and coordinator are executable by
  -- service_role ONLY; the same-SP seam by no application role at all.
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
      IF has_function_privilege(target_role, same_sp_helper, 'EXECUTE') THEN
        RAISE EXCEPTION 'the internal same-SP sequencing seam must not be executable by %', target_role;
      END IF;
      IF target_role = 'service_role' THEN
        IF NOT has_function_privilege(target_role, producer, 'EXECUTE')
           OR NOT has_function_privilege(target_role, coordinator, 'EXECUTE') THEN
          RAISE EXCEPTION 'T-03A2 activation requires service_role EXECUTE on the producer and the exchange coordinator';
        END IF;
      ELSE
        IF has_function_privilege(target_role, producer, 'EXECUTE')
           OR has_function_privilege(target_role, coordinator, 'EXECUTE') THEN
          RAISE EXCEPTION 'the canonical producer must never be executable by %', target_role;
        END IF;
      END IF;
      -- No application role may direct-write the clock, CU or event tables.
      FOREACH target_table IN ARRAY ARRAY['public.conversation_units','public.conversation_unit_commit_batches',
                                          'public.session_semantic_clocks','public.conversation_unit_commit_events'] LOOP
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'the temporal substrate must stay unreachable: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END LOOP;
    END IF;
  END LOOP;

  -- The delivery event table is append-only.
  IF NOT EXISTS (SELECT 1 FROM pg_trigger t
                  WHERE t.tgrelid='public.conversation_unit_commit_events'::regclass
                    AND NOT t.tgisinternal AND t.tgname='conversation_unit_commit_events_immutable') THEN
    RAISE EXCEPTION 'the committed-CU delivery event table must be append-only';
  END IF;

  -- The pre-existing runtime event outbox contract is untouched: still exactly
  -- the three conversation event types and still one row per source turn.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint k
                  WHERE k.conrelid='public.runtime_event_outbox'::regclass AND k.contype='u'
                    AND pg_get_constraintdef(k.oid) LIKE 'UNIQUE (event_type, subject_turn_id)%') THEN
    RAISE EXCEPTION 'the runtime_event_outbox one-row-per-turn contract must remain untouched';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint k
                  WHERE k.conrelid='public.runtime_event_outbox'::regclass AND k.contype='c'
                    AND pg_get_constraintdef(k.oid) LIKE '%ConversationTurnCompleted%')
     OR EXISTS (SELECT 1 FROM pg_constraint k
                 WHERE k.conrelid='public.runtime_event_outbox'::regclass AND k.contype='c'
                   AND pg_get_constraintdef(k.oid) LIKE '%ConversationalUnitsCommitted%') THEN
    RAISE EXCEPTION 'the runtime_event_outbox event-type contract must remain untouched';
  END IF;
END$$;

COMMIT;
