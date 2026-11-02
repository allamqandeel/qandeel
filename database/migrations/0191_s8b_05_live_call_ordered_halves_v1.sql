-- S8B-05 CP3 — Ordered Half-Exchange Establishment, the durable ordered analysis worker's authority, the shared session
-- lock, the shared background provider permits and the call's end closing its last exchange, under the Integrated Live
-- Call Contract v1.2 FINAL (Part A → A1 → v1.1 → v1.0; the Product Owner's CP3 execution task of 2026-11-02). Not
-- hosted: every voice gate stays DISABLED.
--
-- ## What is added
--
--   A. The analysis policy (constants; L5, B3, L2) and the background permit policy (controlled configuration, calibrated
--      in S8B-08; A1 §3).
--   B. voice_private.call_analysis_queue grows the worker's states (R7′, L4, L5, B1 – B4): PENDING → CLAIMED (a lease)
--      → COMPLETE, or RETRY_WAIT (provider failure, bounded backoff), PARKED (attempts or the daily budget exhausted; never
--      dropped), ABANDONED_INTEGRITY (a permanent integrity failure, confirmed once; declared, counted, never established
--      later). A third kind of item, EXCHANGE, is a pre-call exchange adopted at the head of the call (O3b), numbered
--      below 1. The ONE order of a session's items: earlier calls first, then (call_turn_index, USER before ASSISTANT).
--      Never a timestamp between two turns of a call (0071 "No timestamp decides … ordering"); calls of one person are
--      strictly sequential (0189: one unended call per person), so a call's creation orders whole calls only.
--   C. The half coordinator, commit_conversation_units_call_half_v1 (CA-05-01 R3; the D-05 amendment of v1.1 §1.5:
--      a second committing function, for numbered call turns only). It reuses the 0071 batch writer as it is, takes the
--      Session Semantic Clock FIRST (AF66-01), replays a COMPLETE batch from storage with no token check, refuses any half
--      that is not the head of its session's order (O1, O2, B1: retryable, nothing written), checks the same two stale
--      tokens as the full coordinator (PT409, 0150) and completes the queue item in the SAME transaction as the batch.
--   D. The worker's commands: claim the head of a session (the session lease + the item lease, the daily attempt budget),
--      settle it (COMPLETE / RELEASE / PROVIDER_FAILURE / INTEGRITY_FAILURE), list the sessions with runnable work.
--   E. The shared session lock (v1.1 §1.6, L3): one lease per session, held by the call analysis worker for one item or
--      by one post-response execution of a session with call analysis work; a waiting post-response execution reserves
--      the next turn of the lease, so the drain never starves it.
--   F. The shared background provider permits (A1 §3, L3 as superseded by A4): one row per granted permit, an adaptive cap
--      max(B_min, B_total − k × live call generations in flight), two per person, a lease; L2 (the person's critical
--      window: from a spoken turn's commit until its reply's first heard or registered audio, bounded) is answered by
--      the same acquire, so a background unit asks once. Nothing on the live reply path calls any of it.
--   G. The call's end and S3 (R5′, P2, A3.1): end_call_v1 closes the open exchange by the ONE close in the same
--      transaction when its Safety is stored; an exchange whose Safety was never stored stays OPEN after the END (the
--      gate is TypeScript), and the sweep's three server commands let the API recompute it with the same gate over the
--      same reader (call_context_exchanges_v1 itself, read on the server channel), store it once through 0190's command
--      and close it CALL_ENDING.
--   H. The forward replacements (database/live-call-0191-substitutions.mjs, each the latest statement verbatim with only
--      the declared edits): the writer (INPUT-01: a numbered USER turn is committable while GENERATING), the full
--      coordinator (O3a, B3), 0190's close (R7′: the ASSISTANT half queued by the close), 0190's commit (O3b: the first
--      turn adopts the unestablished pre-call exchanges), 0189's end (G).
--
-- ## What is deliberately NOT here
--
--   * No barge-in, no P4 / P5, no TEXT_TURN client path, no 60-minute events (CP4). No gate is opened; nothing is applied
--     to a hosted database. The live reply path gains no call: the commit, the reply and the close are unchanged except
--     the queue rows they write in their own transactions.

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. POLICIES (A).
-- ---------------------------------------------------------------------------------------------------------------------
-- L5: three provider attempts per half, backoff 2 s then 4 s, then PARKED and retried every 5 min within the person's
-- daily budget of the analysis lock class. B3: an integrity failure is confirmed by one repeat. The item and session
-- leases outlast one half's bounded work. L2: the critical window never holds background work past 10 s.
CREATE FUNCTION voice_private.call_analysis_policy_v1(
  OUT max_provider_attempts integer, OUT retry_base_seconds integer, OUT parked_retry_seconds integer,
  OUT daily_attempt_budget integer, OUT integrity_confirmations integer, OUT item_lease_seconds integer,
  OUT critical_window_seconds integer, OUT reservation_seconds integer)
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT 3, 2, 300, 2000, 2, 120, 10, 10;
$$;

CREATE TABLE voice_private.background_permit_policy (
  singleton boolean NOT NULL DEFAULT true,
  total_permits integer NOT NULL,
  minimum_permits integer NOT NULL,
  live_generation_weight integer NOT NULL,
  per_user_permits integer NOT NULL,
  lease_seconds integer NOT NULL,
  policy_version bigint NOT NULL,
  decided_by text NOT NULL,
  policy_basis text NOT NULL,
  decided_at timestamptz NOT NULL,
  CONSTRAINT background_permit_policy_pk PRIMARY KEY (singleton),
  CONSTRAINT background_permit_policy_singleton_check CHECK (singleton),
  CONSTRAINT background_permit_policy_bounds_check CHECK (
    total_permits BETWEEN 1 AND 64 AND minimum_permits BETWEEN 1 AND total_permits AND live_generation_weight BETWEEN 0 AND 16
    AND per_user_permits BETWEEN 1 AND total_permits AND lease_seconds BETWEEN 30 AND 600 AND policy_version >= 1
    AND length(decided_by) BETWEEN 1 AND 200 AND length(policy_basis) BETWEEN 1 AND 2000)
);
INSERT INTO voice_private.background_permit_policy (total_permits, minimum_permits, live_generation_weight, per_user_permits,
                                                    lease_seconds, policy_version, decided_by, policy_basis, decided_at)
VALUES (16, 2, 2, 2, 120, 1, 'S8B-05 CP3 migration 0191',
        'contract v1.2 A1 §3 (B_total 16, B_min 2, k 2, two permits per person, a 120 s lease; calibrated in S8B-08)', clock_timestamp());

CREATE FUNCTION voice_private.background_permit_policy_v1() RETURNS voice_private.background_permit_policy
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p FROM voice_private.background_permit_policy p WHERE p.singleton;
$$;

-- An operator act (no role executes it), like the live call policy setter: the values follow S8B-08's calibration.
CREATE FUNCTION voice_private.set_background_permit_policy_v1(p_total_permits integer, p_minimum_permits integer,
  p_live_generation_weight integer, p_per_user_permits integer, p_lease_seconds integer, p_decided_by text, p_policy_basis text)
RETURNS bigint
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_version bigint;
BEGIN
  UPDATE voice_private.background_permit_policy p
     SET total_permits = p_total_permits, minimum_permits = p_minimum_permits, live_generation_weight = p_live_generation_weight,
         per_user_permits = p_per_user_permits, lease_seconds = p_lease_seconds, policy_version = p.policy_version + 1,
         decided_by = p_decided_by, policy_basis = p_policy_basis, decided_at = clock_timestamp()
   WHERE p.singleton
  RETURNING p.policy_version INTO v_version;
  RETURN v_version;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. THE QUEUE'S STATES AND ITS ORDER (B).
-- ---------------------------------------------------------------------------------------------------------------------
ALTER TABLE voice_private.call_analysis_queue DROP CONSTRAINT call_analysis_queue_state_check;
ALTER TABLE voice_private.call_analysis_queue DROP CONSTRAINT call_analysis_queue_half_check;
ALTER TABLE voice_private.call_analysis_queue
  -- EXCHANGE items only: the adopted pre-call exchange's reply (turn_id is its USER turn).
  ADD COLUMN assistant_turn_id uuid,
  ADD COLUMN attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN integrity_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN claim_token uuid,
  ADD COLUMN lease_until timestamptz,
  ADD COLUMN next_attempt_at timestamptz,
  -- A code, never content.
  ADD COLUMN last_failure text,
  ADD COLUMN first_claimed_at timestamptz,
  ADD COLUMN settled_at timestamptz,
  ADD CONSTRAINT call_analysis_queue_assistant_fk FOREIGN KEY (assistant_turn_id) REFERENCES public.conversation_turns (id) ON DELETE CASCADE,
  ADD CONSTRAINT call_analysis_queue_half_check CHECK (CASE half
    WHEN 'EXCHANGE' THEN call_turn_index < 1 AND assistant_turn_id IS NOT NULL
    WHEN 'USER' THEN call_turn_index >= 1 AND assistant_turn_id IS NULL
    WHEN 'ASSISTANT' THEN call_turn_index >= 1 AND assistant_turn_id IS NULL
    ELSE false END),
  ADD CONSTRAINT call_analysis_queue_state_check CHECK (
    queue_state IN ('PENDING', 'CLAIMED', 'RETRY_WAIT', 'PARKED', 'COMPLETE', 'ABANDONED_INTEGRITY')),
  ADD CONSTRAINT call_analysis_queue_shape_check CHECK (
    attempt_count >= 0 AND integrity_failures >= 0
    AND (queue_state = 'CLAIMED') = (claim_token IS NOT NULL) AND (claim_token IS NULL) = (lease_until IS NULL)
    AND (queue_state IN ('RETRY_WAIT', 'PARKED')) = (next_attempt_at IS NOT NULL)
    AND (queue_state IN ('COMPLETE', 'ABANDONED_INTEGRITY')) = (settled_at IS NOT NULL)
    AND (last_failure IS NULL OR last_failure ~ '^[A-Z][A-Z0-9_]{0,63}$'));
CREATE INDEX call_analysis_queue_open_idx ON voice_private.call_analysis_queue (session_id)
  WHERE queue_state NOT IN ('COMPLETE', 'ABANDONED_INTEGRITY');
CREATE INDEX call_analysis_queue_turn_idx ON voice_private.call_analysis_queue (turn_id);

-- The head of a session's analysis order: its first item that is not terminal (B1). Earlier calls first (one unended call
-- per person makes a person's calls strictly sequential), then the call's order by its numbers: the adopted pre-call
-- exchanges (below 1), then each turn's USER half before its ASSISTANT half.
CREATE FUNCTION voice_private.call_analysis_head_v1(p_session_id uuid) RETURNS voice_private.call_analysis_queue
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT q.* FROM voice_private.call_analysis_queue q JOIN voice_private.calls c ON c.id = q.call_id
   WHERE q.session_id = p_session_id AND q.queue_state NOT IN ('COMPLETE', 'ABANDONED_INTEGRITY')
   ORDER BY c.created_at, c.id, q.call_turn_index, CASE q.half WHEN 'EXCHANGE' THEN 0 WHEN 'USER' THEN 1 ELSE 2 END
   LIMIT 1;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. THE SHARED SESSION LOCK (E) AND THE DAILY ATTEMPT BUDGET.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.session_semantic_leases (
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  holder uuid,
  holder_kind text,
  lease_until timestamptz,
  acquired_at timestamptz,
  reserved_by uuid,
  reserved_until timestamptz,
  CONSTRAINT session_semantic_leases_pk PRIMARY KEY (session_id),
  CONSTRAINT session_semantic_leases_session_fk FOREIGN KEY (session_id, user_id)
    REFERENCES public.conversation_sessions (id, user_id) ON DELETE CASCADE,
  CONSTRAINT session_semantic_leases_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT session_semantic_leases_shape_check CHECK (
    (holder IS NULL) = (holder_kind IS NULL) AND (holder IS NULL) = (lease_until IS NULL) AND (holder IS NULL) = (acquired_at IS NULL)
    AND (holder_kind IS NULL OR holder_kind IN ('CALL_ANALYSIS', 'POST_RESPONSE'))
    AND (reserved_by IS NULL) = (reserved_until IS NULL))
);
CREATE INDEX session_semantic_leases_user_idx ON voice_private.session_semantic_leases (user_id);

-- Takes the session's lease for `p_holder` when it is free, lapsed or already its own, and no other live holder has
-- reserved the next turn. A taker that held the reservation clears it.
CREATE FUNCTION voice_private.take_session_semantic_lease_v1(p_session_id uuid, p_user_id uuid, p_holder uuid, p_kind text,
  p_seconds integer)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_taken boolean;
BEGIN
  INSERT INTO voice_private.session_semantic_leases AS l (session_id, user_id, holder, holder_kind, lease_until, acquired_at)
  VALUES (p_session_id, p_user_id, p_holder, p_kind, clock_timestamp() + make_interval(secs => p_seconds), clock_timestamp())
  ON CONFLICT (session_id) DO UPDATE
     SET holder = EXCLUDED.holder, holder_kind = EXCLUDED.holder_kind, lease_until = EXCLUDED.lease_until,
         acquired_at = CASE WHEN l.holder = EXCLUDED.holder THEN l.acquired_at ELSE EXCLUDED.acquired_at END,
         reserved_by = CASE WHEN l.reserved_by = EXCLUDED.holder OR l.reserved_until <= clock_timestamp() THEN NULL ELSE l.reserved_by END,
         reserved_until = CASE WHEN l.reserved_by = EXCLUDED.holder OR l.reserved_until <= clock_timestamp() THEN NULL ELSE l.reserved_until END
   WHERE (l.holder IS NULL OR l.lease_until <= clock_timestamp() OR l.holder = EXCLUDED.holder)
     AND NOT coalesce(l.reserved_until > clock_timestamp() AND l.reserved_by <> EXCLUDED.holder, false)
  RETURNING true INTO v_taken;
  RETURN coalesce(v_taken, false);
END$$;

CREATE FUNCTION voice_private.drop_session_semantic_lease_v1(p_session_id uuid, p_holder uuid) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  UPDATE voice_private.session_semantic_leases l SET holder = NULL, holder_kind = NULL, lease_until = NULL, acquired_at = NULL
   WHERE l.session_id = p_session_id AND l.holder = p_holder;
$$;

CREATE TABLE voice_private.call_analysis_attempt_days (
  user_id uuid NOT NULL,
  attempt_day date NOT NULL,
  attempts integer NOT NULL,
  CONSTRAINT call_analysis_attempt_days_pk PRIMARY KEY (user_id, attempt_day),
  CONSTRAINT call_analysis_attempt_days_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT call_analysis_attempt_days_attempts_check CHECK (attempts >= 0)
);

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. THE SHARED BACKGROUND PROVIDER PERMITS (F).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.background_provider_permits (
  slot integer NOT NULL,
  user_id uuid NOT NULL,
  work_kind text NOT NULL,
  holder uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  lease_until timestamptz NOT NULL,
  CONSTRAINT background_provider_permits_pk PRIMARY KEY (slot),
  CONSTRAINT background_provider_permits_holder_key UNIQUE (holder),
  CONSTRAINT background_provider_permits_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT background_provider_permits_shape_check CHECK (
    slot BETWEEN 1 AND 64 AND lease_until > granted_at
    AND work_kind IN ('CALL_ANALYSIS', 'TEXT_SEMANTIC_ANALYSIS', 'POST_RESPONSE_INTELLIGENCE'))
);
CREATE INDEX background_provider_permits_user_idx ON voice_private.background_provider_permits (user_id);

-- L2: the person's critical window — a spoken turn of theirs is committed and its reply is still generating with nothing
-- heard and no segment registered yet, for at most the policy's window. Read from what CP2 already writes (the open
-- exchange, its playout mark, its segments): the live reply path writes nothing for it.
CREATE FUNCTION voice_private.user_in_critical_window_v1(p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM voice_private.call_exchanges e
     WHERE e.user_id = p_user_id AND e.exchange_state = 'OPEN' AND e.generation_state = 'GENERATING' AND e.playout_mark_ms = 0
       AND e.committed_at > clock_timestamp() - make_interval(secs => (SELECT p.critical_window_seconds FROM voice_private.call_analysis_policy_v1() p))
       AND NOT EXISTS (SELECT 1 FROM voice_private.call_reply_segments s WHERE s.call_id = e.call_id AND s.call_turn_index = e.call_turn_index));
$$;

-- One permit per unit of background provider work (a call analysis half, a text exchange's semantic establishment, a
-- post-response execution), asked once before the unit reads its semantic context. GRANTED (idempotent per holder: the
-- lease is renewed), WAIT_CRITICAL_WINDOW (L2, only when asked to respect it), WAIT_USER_LIMIT, WAIT_CAPACITY. The cap
-- shrinks while live call replies are generating (CP2's OPEN + GENERATING exchanges, bounded to two minutes so a stale
-- one cannot pin it); a lapsed permit frees its slot. Nothing is cancelled and nothing is dropped: the caller waits.
CREATE FUNCTION public.server_acquire_background_permit_v1(p_user_id uuid, p_work_kind text, p_holder uuid,
  p_respect_critical_window boolean)
RETURNS TABLE (outcome text, slot integer, lease_until timestamptz, capacity integer, live_generations integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  v_policy voice_private.background_permit_policy := voice_private.background_permit_policy_v1();
  v_live integer;
  v_cap integer;
  v_slot integer;
  v_until timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_holder IS NULL OR p_respect_critical_window IS NULL OR p_work_kind IS NULL
     OR p_work_kind NOT IN ('CALL_ANALYSIS', 'TEXT_SEMANTIC_ANALYSIS', 'POST_RESPONSE_INTELLIGENCE') THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_respect_critical_window AND voice_private.user_in_critical_window_v1(p_user_id) THEN
    RETURN QUERY SELECT 'WAIT_CRITICAL_WINDOW'::text, NULL::integer, NULL::timestamptz, NULL::integer, NULL::integer; RETURN;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qandeel.background-provider-permits.v1', 0));
  DELETE FROM voice_private.background_provider_permits p WHERE p.lease_until <= clock_timestamp();
  SELECT count(*)::integer INTO v_live FROM voice_private.call_exchanges e
   WHERE e.exchange_state = 'OPEN' AND e.generation_state = 'GENERATING' AND e.committed_at > clock_timestamp() - interval '2 minutes';
  v_cap := greatest(v_policy.minimum_permits, v_policy.total_permits - v_policy.live_generation_weight * v_live);
  v_until := clock_timestamp() + make_interval(secs => v_policy.lease_seconds);
  UPDATE voice_private.background_provider_permits p SET lease_until = v_until
   WHERE p.holder = p_holder AND p.user_id = p_user_id
  RETURNING p.slot INTO v_slot;
  IF v_slot IS NOT NULL THEN
    RETURN QUERY SELECT 'GRANTED'::text, v_slot, v_until, v_cap, v_live; RETURN;
  END IF;
  IF (SELECT count(*) FROM voice_private.background_provider_permits p WHERE p.user_id = p_user_id) >= v_policy.per_user_permits THEN
    RETURN QUERY SELECT 'WAIT_USER_LIMIT'::text, NULL::integer, NULL::timestamptz, v_cap, v_live; RETURN;
  END IF;
  SELECT min(s) INTO v_slot FROM generate_series(1, v_cap) s
   WHERE NOT EXISTS (SELECT 1 FROM voice_private.background_provider_permits p WHERE p.slot = s);
  IF v_slot IS NULL THEN
    RETURN QUERY SELECT 'WAIT_CAPACITY'::text, NULL::integer, NULL::timestamptz, v_cap, v_live; RETURN;
  END IF;
  INSERT INTO voice_private.background_provider_permits (slot, user_id, work_kind, holder, lease_until)
  VALUES (v_slot, p_user_id, p_work_kind, p_holder, v_until);
  RETURN QUERY SELECT 'GRANTED'::text, v_slot, v_until, v_cap, v_live;
END$$;

CREATE FUNCTION public.server_release_background_permit_v1(p_holder uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_holder IS NULL THEN RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
  DELETE FROM voice_private.background_provider_permits p WHERE p.holder = p_holder;
  RETURN QUERY SELECT CASE WHEN FOUND THEN 'RELEASED' ELSE 'NOT_HELD' END;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. O3b: THE PRE-CALL EXCHANGES ADOPTED AT THE HEAD OF A CALL.
-- ---------------------------------------------------------------------------------------------------------------------
-- The session's completed exchanges (a COMPLETED USER turn and its COMPLETED reply) that are not call turns, have no
-- commitment batch yet, follow the session's last established exchange (an older gap is the text path's own existing
-- backlog, unchanged by this contract: v1.1 §1.4) and are in no queue yet: in their current order (the text context's
-- created_at, id), numbered 1 - n … 0.
CREATE FUNCTION voice_private.adopt_pre_call_exchanges_v1(p_call_id uuid, p_user_id uuid, p_session_id uuid) RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_last_at timestamptz;
  v_last_id uuid;
  v_count integer;
BEGIN
  SELECT u.created_at, u.id INTO v_last_at, v_last_id
    FROM public.conversation_turns u
   WHERE u.session_id = p_session_id AND u.user_id = p_user_id AND u.role = 'USER'
     AND EXISTS (SELECT 1 FROM public.conversation_unit_commit_batches b WHERE b.source_turn_id = u.id)
   ORDER BY u.created_at DESC, u.id DESC
   LIMIT 1;
  WITH pending AS (
    SELECT u.id AS user_turn_id, a.id AS assistant_turn_id,
           row_number() OVER (ORDER BY u.created_at, u.id) AS n, count(*) OVER () AS total
      FROM public.conversation_turns u
      JOIN public.conversation_turns a ON a.source_turn_id = u.id AND a.role = 'ASSISTANT' AND a.status = 'COMPLETED'
                                      AND a.session_id = p_session_id
     WHERE u.session_id = p_session_id AND u.user_id = p_user_id AND u.role = 'USER' AND u.status = 'COMPLETED'
       AND NOT EXISTS (SELECT 1 FROM public.conversation_call_turns ct WHERE ct.turn_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.conversation_unit_commit_batches b WHERE b.source_turn_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM voice_private.call_analysis_queue q WHERE q.turn_id = u.id)
       AND (v_last_at IS NULL OR (u.created_at, u.id) > (v_last_at, v_last_id)))
  INSERT INTO voice_private.call_analysis_queue (call_id, call_turn_index, half, user_id, session_id, turn_id, assistant_turn_id)
  SELECT p_call_id, (p.n - p.total)::integer, 'EXCHANGE', p_user_id, p_session_id, p.user_turn_id, p.assistant_turn_id
    FROM pending p;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. THE FORWARD REPLACEMENTS (H). Each is its latest statement verbatim with only the edits declared in
--    database/live-call-0191-substitutions.mjs.
-- ---------------------------------------------------------------------------------------------------------------------
-- Forward-replaced from 0183_s8b_02_voice_foundation_v1.sql (substitution "writer-input-01" in database/live-call-0191-substitutions.mjs).
CREATE OR REPLACE FUNCTION public.commit_conversation_units_with_full_semantic_chain_v1(
  p_session_id uuid,
  p_user_id uuid,
  p_source_turn_id uuid,
  p_batch_id uuid,
  p_units jsonb,
  p_evaluator_version text,
  p_policy_version text,
  p_segmentation_provider text,
  p_segmentation_model text,
  p_segmentation_prompt_version text,
  p_focus_units jsonb,
  p_focus_evaluator_version text,
  p_focus_policy_version text,
  p_focus_provider text,
  p_focus_model text,
  p_focus_prompt_version text,
  p_focus_schema_version integer,
  p_thread_units jsonb,
  p_thread_evaluator_version text,
  p_thread_policy_version text,
  p_thread_provider text,
  p_thread_model text,
  p_thread_prompt_version text,
  p_thread_schema_version integer,
  p_lifecycle_units jsonb,
  p_continuity_evaluator_version text,
  p_continuity_policy_version text,
  p_continuity_provider text,
  p_continuity_model text,
  p_continuity_prompt_version text,
  p_continuity_schema_version integer,
  p_lifecycle_reducer_version text,
  p_live_focus_units jsonb,
  p_lf_reducer_version text
) RETURNS SETOF public.conversation_units
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  uuid_shape constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  max_units constant integer := 64;
  clock_row public.session_semantic_clocks;
  session_row public.conversation_sessions;
  turn_row public.conversation_turns;
  identity_row public.conversation_world_thread_identity_clocks;
  authority_row public.conversation_world_spatial_authorities;
  lf_batch_row public.conversation_live_focus_commit_batches;
  transition_row public.conversation_live_focus_transitions;
  inserted_cu public.conversation_units;
  derived_digest bytea;
  derived_modality text := 'TEXT';
  derived_speaker constant text := 'RESOLVED';
  source_length integer;
  unit_count integer;
  establishment_count integer := 0;
  continuity_count integer := 0;
  lifecycle_count integer := 0;
  ambiguous_count integer := 0;
  transition_count integer := 0;
  unit jsonb;
  decision jsonb;
  lifecycle jsonb;
  lf_unit jsonb;
  outcome text;
  idx integer;
  unit_ids uuid[] := ARRAY[]::uuid[];
  span_starts integer[] := ARRAY[]::integer[];
  span_ends integer[] := ARRAY[]::integer[];
  cursor_pos integer;
  frontier integer;
  next_ordinal integer;
  first_sp integer;
  this_sp integer;
  reserved_sp integer;
  reserved_sequence bigint;
  has_change boolean;
  lf_decision record;
  canonical jsonb;
  fingerprint bytea;
  focus_canonical jsonb;
  focus_fingerprint bytea;
  thread_canonical jsonb;
  thread_fingerprint bytea;
  lifecycle_canonical jsonb;
  lifecycle_fingerprint bytea;
  lf_canonical jsonb;
  lf_fingerprint bytea;
  batch_state text;
  canonical_thread_id uuid;
  world_thread_ids text[];
  world_x numeric[];
  world_y numeric[];
  origin_ids text[];
  placement record;
BEGIN
  ---------------------------------------------------------------------------
  -- COMMON SETUP. Identical structure and identical rejections to 0070, plus
  -- the LF payload and provenance. THE SESSION CLOCK IS THE FIRST LOCK.
  ---------------------------------------------------------------------------
  IF p_session_id IS NULL OR p_user_id IS NULL OR p_source_turn_id IS NULL OR p_batch_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;
  IF p_units IS NULL OR jsonb_typeof(p_units) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF p_focus_units IS NULL OR jsonb_typeof(p_focus_units) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF p_thread_units IS NULL OR jsonb_typeof(p_thread_units) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_THREAD_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF p_lifecycle_units IS NULL OR jsonb_typeof(p_lifecycle_units) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF p_live_focus_units IS NULL OR jsonb_typeof(p_live_focus_units) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_LIVE_FOCUS_PAYLOAD' USING ERRCODE='22023';
  END IF;
  IF p_lf_reducer_version IS NULL OR length(btrim(p_lf_reducer_version)) = 0 OR length(p_lf_reducer_version) > 64 THEN
    RAISE EXCEPTION 'INVALID_LIVE_FOCUS_PROVENANCE' USING ERRCODE='22023';
  END IF;
  IF p_continuity_evaluator_version IS NULL OR length(btrim(p_continuity_evaluator_version)) = 0 OR length(p_continuity_evaluator_version) > 64
     OR p_continuity_policy_version IS NULL OR length(btrim(p_continuity_policy_version)) = 0 OR length(p_continuity_policy_version) > 64
     OR p_continuity_provider IS NULL OR length(btrim(p_continuity_provider)) = 0 OR length(p_continuity_provider) > 64
     OR p_continuity_model IS NULL OR length(btrim(p_continuity_model)) = 0 OR length(p_continuity_model) > 128
     OR p_continuity_prompt_version IS NULL OR length(btrim(p_continuity_prompt_version)) = 0 OR length(p_continuity_prompt_version) > 64
     OR p_continuity_schema_version IS NULL OR p_continuity_schema_version < 1
     OR p_lifecycle_reducer_version IS NULL OR length(btrim(p_lifecycle_reducer_version)) = 0 OR length(p_lifecycle_reducer_version) > 64 THEN
    RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PROVENANCE' USING ERRCODE='22023';
  END IF;
  IF p_thread_evaluator_version IS NULL OR length(btrim(p_thread_evaluator_version)) = 0 OR length(p_thread_evaluator_version) > 64
     OR p_thread_policy_version IS NULL OR length(btrim(p_thread_policy_version)) = 0 OR length(p_thread_policy_version) > 64
     OR p_thread_provider IS NULL OR length(btrim(p_thread_provider)) = 0 OR length(p_thread_provider) > 64
     OR p_thread_model IS NULL OR length(btrim(p_thread_model)) = 0 OR length(p_thread_model) > 128
     OR p_thread_prompt_version IS NULL OR length(btrim(p_thread_prompt_version)) = 0 OR length(p_thread_prompt_version) > 64
     OR p_thread_schema_version IS NULL OR p_thread_schema_version < 1 THEN
    RAISE EXCEPTION 'INVALID_THREAD_PROVENANCE' USING ERRCODE='22023';
  END IF;
  IF p_evaluator_version IS NULL OR length(btrim(p_evaluator_version)) = 0 OR length(p_evaluator_version) > 64
     OR p_policy_version IS NULL OR length(btrim(p_policy_version)) = 0 OR length(p_policy_version) > 64
     OR p_segmentation_provider IS NULL OR length(btrim(p_segmentation_provider)) = 0 OR length(p_segmentation_provider) > 64
     OR p_segmentation_model IS NULL OR length(btrim(p_segmentation_model)) = 0 OR length(p_segmentation_model) > 128
     OR p_segmentation_prompt_version IS NULL OR length(btrim(p_segmentation_prompt_version)) = 0
     OR length(p_segmentation_prompt_version) > 64 THEN
    RAISE EXCEPTION 'INVALID_COMMIT_PROVENANCE' USING ERRCODE='22023';
  END IF;
  IF p_focus_evaluator_version IS NULL OR length(btrim(p_focus_evaluator_version)) = 0 OR length(p_focus_evaluator_version) > 64
     OR p_focus_policy_version IS NULL OR length(btrim(p_focus_policy_version)) = 0 OR length(p_focus_policy_version) > 64
     OR p_focus_provider IS NULL OR length(btrim(p_focus_provider)) = 0 OR length(p_focus_provider) > 64
     OR p_focus_model IS NULL OR length(btrim(p_focus_model)) = 0 OR length(p_focus_model) > 128
     OR p_focus_prompt_version IS NULL OR length(btrim(p_focus_prompt_version)) = 0 OR length(p_focus_prompt_version) > 64
     OR p_focus_schema_version IS NULL OR p_focus_schema_version < 1 THEN
    RAISE EXCEPTION 'INVALID_FOCUS_PROVENANCE' USING ERRCODE='22023';
  END IF;

  unit_count := jsonb_array_length(p_units);
  IF unit_count > max_units THEN
    RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023',
      DETAIL='A commitment batch carries at most 64 committed conversational units.';
  END IF;
  IF jsonb_array_length(p_focus_units) <> unit_count THEN
    RAISE EXCEPTION 'FOCUS_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_thread_units) <> unit_count THEN
    RAISE EXCEPTION 'THREAD_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_lifecycle_units) <> unit_count THEN
    RAISE EXCEPTION 'THREAD_LIFECYCLE_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_live_focus_units) <> unit_count THEN
    RAISE EXCEPTION 'LIVE_FOCUS_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023',
      DETAIL='Exactly one canonical LF decision corresponds to exactly one proposed committed CU, in the same order.';
  END IF;

  -- AF66-01: the Session Semantic Clock is the FIRST lock of the semantic
  -- transaction, taken before the source turn, before any semantic row, before
  -- the user/world identity version and long before the spatial authority.
  SELECT * INTO clock_row FROM public.session_semantic_clocks c
    WHERE c.session_id = p_session_id AND c.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  SELECT * INTO session_row FROM public.conversation_sessions s
    WHERE s.id = p_session_id AND s.user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  SELECT * INTO turn_row FROM public.conversation_turns t
    WHERE t.id = p_source_turn_id AND t.session_id = p_session_id AND t.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  IF turn_row.role NOT IN ('USER', 'ASSISTANT') THEN
    RAISE EXCEPTION 'UNSUPPORTED_SOURCE_ROLE' USING ERRCODE='22023';
  END IF;
  -- S8B-05 CP3 (0191, CA-05-01 INPUT-01 / R2′): a live call's USER turn is final-content at its commit and only ever becomes
  -- COMPLETED, so it is committable while GENERATING; only the half coordinator reaches here with one.
  IF turn_row.status <> 'COMPLETED' AND NOT (turn_row.status = 'GENERATING' AND turn_row.role = 'USER'
       AND EXISTS (SELECT 1 FROM public.conversation_call_turns ct WHERE ct.turn_id = turn_row.id AND ct.turn_role = 'USER')) THEN
    RAISE EXCEPTION 'SOURCE_TURN_NOT_COMMITTABLE' USING ERRCODE='55000',
      DETAIL='Provisional, cancelled, failed and superseded source never becomes committed conversational truth.';
  END IF;
  IF session_row.channel <> 'TEXT' THEN
    RAISE EXCEPTION 'UNSUPPORTED_SOURCE_MODALITY' USING ERRCODE='22023';
  END IF;
  -- S8B-02 (0183, VA-3): the modality is the turn's voice source, read under the turn lock; a turn with none is TEXT.
  SELECT vs.source_modality INTO derived_modality FROM public.conversation_turn_voice_sources vs
   WHERE vs.turn_id = turn_row.id FOR KEY SHARE;
  IF NOT FOUND THEN derived_modality := 'TEXT'; END IF;
  derived_digest := sha256(convert_to(turn_row.content, 'UTF8'));
  source_length := length(turn_row.content);

  -- The 1:1 mapping between the five payloads, in order.
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

    unit := p_focus_units -> idx;
    IF jsonb_typeof(unit) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_FOCUS_PAYLOAD' USING ERRCODE='22023';
    END IF;
    IF NOT (unit ? 'unit_id') OR jsonb_typeof(unit -> 'unit_id') <> 'string'
       OR (unit ->> 'unit_id') !~* uuid_shape OR (unit ->> 'unit_id')::uuid <> unit_ids[idx + 1] THEN
      RAISE EXCEPTION 'FOCUS_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023';
    END IF;

    decision := p_thread_units -> idx;
    IF jsonb_typeof(decision) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_THREAD_PAYLOAD' USING ERRCODE='22023';
    END IF;
    IF NOT (decision ? 'unit_id') OR jsonb_typeof(decision -> 'unit_id') <> 'string'
       OR (decision ->> 'unit_id') !~* uuid_shape OR (decision ->> 'unit_id')::uuid <> unit_ids[idx + 1] THEN
      RAISE EXCEPTION 'THREAD_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023';
    END IF;
    IF (decision ->> 'decision') = 'ESTABLISH_THREAD' THEN
      establishment_count := establishment_count + 1;
    END IF;

    lifecycle := p_lifecycle_units -> idx;
    IF jsonb_typeof(lifecycle) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_THREAD_LIFECYCLE_PAYLOAD' USING ERRCODE='22023';
    END IF;
    IF NOT (lifecycle ? 'unit_id') OR jsonb_typeof(lifecycle -> 'unit_id') <> 'string'
       OR (lifecycle ->> 'unit_id') !~* uuid_shape OR (lifecycle ->> 'unit_id')::uuid <> unit_ids[idx + 1] THEN
      RAISE EXCEPTION 'THREAD_LIFECYCLE_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023';
    END IF;
    -- The B2 decision and the final outcome of one CU must agree before any batch row exists.
    IF ((decision ->> 'decision') = 'ESTABLISH_THREAD') <> ((lifecycle ->> 'outcome') = 'ESTABLISH_NEW') THEN
      RAISE EXCEPTION 'THREAD_ESTABLISHMENT_CONTINUITY_MISMATCH' USING ERRCODE='22023',
        DETAIL='ESTABLISH_NEW is truthful exactly when the B2 decision establishes and the continuity resolution is DISTINCT_NEW; a BIND or AMBIGUOUS continuity outcome forbids a new Thread.';
    END IF;
    IF (lifecycle ->> 'outcome') = 'ACTIVATE_EXISTING_IN_SESSION' THEN continuity_count := continuity_count + 1; END IF;
    IF (lifecycle ->> 'outcome') = 'IDENTITY_AMBIGUOUS' THEN ambiguous_count := ambiguous_count + 1; END IF;
    IF jsonb_typeof(lifecycle -> 'lifecycle_transitions') = 'array' THEN
      lifecycle_count := lifecycle_count + jsonb_array_length(lifecycle -> 'lifecycle_transitions');
    END IF;

    -- The LF decision: exact shape and 1:1 mapping now; its truth is proven
    -- against the DB derivation per CU below.
    lf_unit := p_live_focus_units -> idx;
    IF jsonb_typeof(lf_unit) <> 'object' OR (SELECT count(*) FROM jsonb_object_keys(lf_unit)) <> 6
       OR NOT (lf_unit ? 'unit_id') OR NOT (lf_unit ? 'effective_kind') OR NOT (lf_unit ? 'effective_ref')
       OR NOT (lf_unit ? 'transition') OR NOT (lf_unit ? 'reason_code') OR NOT (lf_unit ? 'transition_event_id') THEN
      RAISE EXCEPTION 'INVALID_LIVE_FOCUS_PAYLOAD' USING ERRCODE='22023',
        DETAIL='A canonical LF decision carries exactly unit_id, effective_kind, effective_ref, transition, reason_code and transition_event_id.';
    END IF;
    IF jsonb_typeof(lf_unit -> 'unit_id') <> 'string'
       OR (lf_unit ->> 'unit_id') !~* uuid_shape OR (lf_unit ->> 'unit_id')::uuid <> unit_ids[idx + 1] THEN
      RAISE EXCEPTION 'LIVE_FOCUS_UNIT_MAPPING_MISMATCH' USING ERRCODE='22023';
    END IF;
    IF jsonb_typeof(lf_unit -> 'effective_kind') <> 'string' OR (lf_unit ->> 'effective_kind') NOT IN ('NONE', 'EMERGING', 'THREAD')
       OR jsonb_typeof(lf_unit -> 'transition') <> 'boolean'
       OR ((lf_unit ->> 'effective_kind') = 'NONE') <> (jsonb_typeof(lf_unit -> 'effective_ref') = 'null')
       OR (jsonb_typeof(lf_unit -> 'effective_ref') NOT IN ('null', 'string'))
       OR (jsonb_typeof(lf_unit -> 'effective_ref') = 'string' AND (lf_unit ->> 'effective_ref') !~ uuid_shape) THEN
      RAISE EXCEPTION 'INVALID_LIVE_FOCUS_PAYLOAD' USING ERRCODE='22023',
        DETAIL='Exactly three LF values are representable: NONE without a reference, EMERGING(emerging_focus_id), THREAD(thread_id).';
    END IF;
    IF (lf_unit -> 'transition')::boolean THEN
      IF jsonb_typeof(lf_unit -> 'reason_code') <> 'string'
         OR (lf_unit ->> 'reason_code') NOT IN ('NEW_INDEPENDENT_FOCUS', 'THREAD_PROMOTION', 'RETURN_TO_THREAD', 'FOCUS_REPLACEMENT', 'STABLE_DEPARTURE_NO_REPLACEMENT')
         OR jsonb_typeof(lf_unit -> 'transition_event_id') <> 'string' OR (lf_unit ->> 'transition_event_id') !~ uuid_shape THEN
        RAISE EXCEPTION 'INVALID_LIVE_FOCUS_PAYLOAD' USING ERRCODE='22023',
          DETAIL='An LF transition carries exactly one of the five frozen reasons and its derived identity.';
      END IF;
      transition_count := transition_count + 1;
    ELSIF jsonb_typeof(lf_unit -> 'reason_code') <> 'null' OR jsonb_typeof(lf_unit -> 'transition_event_id') <> 'null' THEN
      RAISE EXCEPTION 'INVALID_LIVE_FOCUS_PAYLOAD' USING ERRCODE='22023',
        DETAIL='An unchanged LF carries neither a reason nor a transition identity.';
    END IF;
  END LOOP;
  IF unit_count > 1 AND (SELECT count(DISTINCT d.u) FROM unnest(unit_ids) AS d(u)) <> unit_count THEN
    RAISE EXCEPTION 'INVALID_UNIT_PAYLOAD' USING ERRCODE='22023',
      DETAIL='Unit identities inside a commitment batch must be distinct.';
  END IF;

  -- The DB-derived canonical fingerprints, byte-identical to 0065 / 0066 /
  -- 0068 / 0070 so every writer recognises the same batch identity.
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
  focus_canonical := jsonb_build_object(
    'batch_id', p_batch_id,
    'user_id', turn_row.user_id,
    'session_id', turn_row.session_id,
    'source_turn_id', turn_row.id,
    'focus_evaluator_version', p_focus_evaluator_version,
    'focus_policy_version', p_focus_policy_version,
    'focus_provider', p_focus_provider,
    'focus_model', p_focus_model,
    'focus_prompt_version', p_focus_prompt_version,
    'focus_schema_version', p_focus_schema_version,
    'unit_count', unit_count,
    'focus_units', p_focus_units);
  focus_fingerprint := sha256(convert_to(focus_canonical::text, 'UTF8'));
  thread_canonical := jsonb_build_object(
    'batch_id', p_batch_id,
    'user_id', turn_row.user_id,
    'session_id', turn_row.session_id,
    'source_turn_id', turn_row.id,
    'thread_evaluator_version', p_thread_evaluator_version,
    'thread_policy_version', p_thread_policy_version,
    'thread_provider', p_thread_provider,
    'thread_model', p_thread_model,
    'thread_prompt_version', p_thread_prompt_version,
    'thread_schema_version', p_thread_schema_version,
    'unit_count', unit_count,
    'establishment_count', establishment_count,
    'thread_units', p_thread_units);
  thread_fingerprint := sha256(convert_to(thread_canonical::text, 'UTF8'));
  lifecycle_canonical := jsonb_build_object(
    'batch_id', p_batch_id,
    'user_id', turn_row.user_id,
    'session_id', turn_row.session_id,
    'source_turn_id', turn_row.id,
    'continuity_evaluator_version', p_continuity_evaluator_version,
    'continuity_policy_version', p_continuity_policy_version,
    'continuity_provider', p_continuity_provider,
    'continuity_model', p_continuity_model,
    'continuity_prompt_version', p_continuity_prompt_version,
    'continuity_schema_version', p_continuity_schema_version,
    'lifecycle_reducer_version', p_lifecycle_reducer_version,
    'unit_count', unit_count,
    'establishment_count', establishment_count,
    'continuity_binding_count', continuity_count,
    'lifecycle_transition_count', lifecycle_count,
    'ambiguous_count', ambiguous_count,
    'lifecycle_units', p_lifecycle_units);
  lifecycle_fingerprint := sha256(convert_to(lifecycle_canonical::text, 'UTF8'));
  -- The DB-derived canonical LF capture fingerprint: the ordered canonical LF
  -- decisions plus the reducer identity; SP, sequence and timestamp excluded.
  lf_canonical := jsonb_build_object(
    'batch_id', p_batch_id,
    'user_id', turn_row.user_id,
    'session_id', turn_row.session_id,
    'source_turn_id', turn_row.id,
    'lf_reducer_version', p_lf_reducer_version,
    'unit_count', unit_count,
    'transition_count', transition_count,
    'live_focus_units', p_live_focus_units);
  lf_fingerprint := sha256(convert_to(lf_canonical::text, 'UTF8'));

  -- The ONE full-chain completeness authority decides the path.
  batch_state := public.conversation_full_semantic_batch_state_v1(p_session_id, p_user_id, p_source_turn_id, p_batch_id);

  ---------------------------------------------------------------------------
  -- PATH B - NEW INTEGRATED BATCH. Allowed only when NO layer exists yet.
  ---------------------------------------------------------------------------
  IF batch_state = 'ABSENT' THEN
    SELECT COALESCE(MAX(cu.source_span_end), 0), COALESCE(MAX(cu.ordinal_within_turn) + 1, 0)
      INTO frontier, next_ordinal
      FROM public.conversation_units cu WHERE cu.source_turn_id = turn_row.id;
    IF unit_count > 0 AND span_starts[1] < frontier THEN
      RAISE EXCEPTION 'SPAN_BEFORE_SOURCE_FRONTIER' USING ERRCODE='22023';
    END IF;

    INSERT INTO public.conversation_unit_commit_batches (
      id, user_id, session_id, source_turn_id, canonical_fingerprint, source_content_sha256,
      unit_count, evaluator_version, policy_version,
      segmentation_provider, segmentation_model, segmentation_prompt_version)
    VALUES (
      p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, fingerprint, derived_digest,
      unit_count, p_evaluator_version, p_policy_version,
      p_segmentation_provider, p_segmentation_model, p_segmentation_prompt_version);
    INSERT INTO public.conversation_focus_commit_batches (
      commit_batch_id, user_id, session_id, source_turn_id, unit_count, canonical_fingerprint,
      focus_evaluator_version, focus_policy_version, focus_provider, focus_model,
      focus_prompt_version, focus_schema_version)
    VALUES (
      p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, unit_count, focus_fingerprint,
      p_focus_evaluator_version, p_focus_policy_version, p_focus_provider, p_focus_model,
      p_focus_prompt_version, p_focus_schema_version);
    INSERT INTO public.conversation_thread_commit_batches (
      commit_batch_id, user_id, session_id, source_turn_id, unit_count, establishment_count,
      canonical_fingerprint, thread_evaluator_version, thread_policy_version,
      thread_provider, thread_model, thread_prompt_version, thread_schema_version)
    VALUES (
      p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, unit_count, establishment_count,
      thread_fingerprint, p_thread_evaluator_version, p_thread_policy_version,
      p_thread_provider, p_thread_model, p_thread_prompt_version, p_thread_schema_version);
    INSERT INTO public.conversation_thread_semantic_commit_batches (
      commit_batch_id, user_id, session_id, source_turn_id, unit_count, establishment_count,
      continuity_binding_count, lifecycle_transition_count, ambiguous_count, canonical_fingerprint,
      continuity_evaluator_version, continuity_policy_version, continuity_provider, continuity_model,
      continuity_prompt_version, continuity_schema_version, lifecycle_reducer_version)
    VALUES (
      p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, unit_count, establishment_count,
      continuity_count, lifecycle_count, ambiguous_count, lifecycle_fingerprint,
      p_continuity_evaluator_version, p_continuity_policy_version, p_continuity_provider, p_continuity_model,
      p_continuity_prompt_version, p_continuity_schema_version, p_lifecycle_reducer_version);
    -- H (up front): the technical LF capture identity of the whole batch.
    INSERT INTO public.conversation_live_focus_commit_batches (
      commit_batch_id, user_id, session_id, source_turn_id, unit_count, transition_count,
      canonical_fingerprint, lf_reducer_version)
    VALUES (
      p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, unit_count, transition_count,
      lf_fingerprint, p_lf_reducer_version);

    -- A ZERO-CU batch is a complete evaluation batch at all five layers:
    -- no SP, no same-SP sequence, no LF transition, LF unchanged.
    IF unit_count = 0 THEN
      RETURN;
    END IF;

    this_sp := COALESCE(clock_row.current_sp, 0);
    FOR idx IN 1 .. unit_count LOOP
      -- A: this CU is born at the next Session Position.
      this_sp := this_sp + 1;
      IF idx = 1 THEN first_sp := this_sp; END IF;
      INSERT INTO public.conversation_units (
        id, user_id, session_id, source_turn_id, commit_batch_id,
        source_role, speaker_state, source_modality,
        ordinal_within_turn, source_span_start, source_span_end,
        committed_text, source_content_sha256, session_position)
      VALUES (unit_ids[idx], turn_row.user_id, turn_row.session_id, turn_row.id, p_batch_id,
        turn_row.role, derived_speaker, derived_modality,
        next_ordinal + idx - 1, span_starts[idx], span_ends[idx],
        substring(turn_row.content from span_starts[idx] + 1 for span_ends[idx] - span_starts[idx]),
        derived_digest, this_sp)
      RETURNING * INTO inserted_cu;

      -- B: this SP becomes the open head; every earlier SP is sealed. Then the
      -- ONE same-SP sequence authority: B1 is always sequence 1.
      UPDATE public.session_semantic_clocks c
         SET current_sp = this_sp, same_sp_event_sequence = 0
       WHERE c.session_id = turn_row.session_id;
      SELECT r.session_position, r.event_sequence INTO reserved_sp, reserved_sequence
        FROM public.reserve_session_same_sp_event_v1(p_session_id, p_user_id) r;
      IF reserved_sp IS DISTINCT FROM this_sp OR reserved_sequence IS DISTINCT FROM 1::bigint THEN
        RAISE EXCEPTION 'SAME_SP_SEQUENCE_INTEGRITY' USING ERRCODE='55000',
          DETAIL='The first Stage-6 semantic layer after commitment is sequence 1 on the SP the CU was born at.';
      END IF;
      PERFORM public.persist_conversation_unit_focus_semantics_v1(
        inserted_cu, p_batch_id, p_focus_units -> (idx - 1), reserved_sequence);

      decision := p_thread_units -> (idx - 1);
      lifecycle := p_lifecycle_units -> (idx - 1);
      lf_unit := p_live_focus_units -> (idx - 1);
      outcome := lifecycle ->> 'outcome';

      -- C: the deterministic DB gates of the B2 and B3 layers (0068 / 0070),
      -- against the rows this transaction has already made durable at this
      -- exact SP; then the FINAL Thread layer, at sequence 2 or not at all.
      PERFORM public.validate_conversation_thread_decision_v1(inserted_cu, decision);
      PERFORM public.validate_conversation_thread_lifecycle_decision_v1(inserted_cu, decision, lifecycle);

      has_change := outcome IN ('ESTABLISH_NEW', 'ACTIVATE_EXISTING_IN_SESSION')
        OR jsonb_array_length(lifecycle -> 'lifecycle_transitions') > 0;

      IF has_change THEN
        -- A dossier change locks the user/world Thread Identity Clock -
        -- after the Session clock, before the spatial authority.
        IF outcome IN ('ESTABLISH_NEW', 'ACTIVATE_EXISTING_IN_SESSION') THEN
          INSERT INTO public.conversation_world_thread_identity_clocks (user_id)
          VALUES (turn_row.user_id)
          ON CONFLICT (user_id) DO NOTHING;
          SELECT * INTO identity_row FROM public.conversation_world_thread_identity_clocks w
            WHERE w.user_id = turn_row.user_id
            FOR UPDATE;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'WORLD_THREAD_IDENTITY_CLOCK_MISSING' USING ERRCODE='55000';
          END IF;
        END IF;

        -- A NEW establishment locks the spatial authority and computes the
        -- canonical Home against the locked world, exactly as 0068 / 0070 do.
        IF (decision ->> 'decision') = 'ESTABLISH_THREAD' THEN
          INSERT INTO public.conversation_world_spatial_authorities (user_id, address_scheme)
          VALUES (turn_row.user_id, 'QANDEEL_OSDAP_V1')
          ON CONFLICT (user_id) DO NOTHING;
          SELECT * INTO authority_row FROM public.conversation_world_spatial_authorities w
            WHERE w.user_id = turn_row.user_id
            FOR UPDATE;
          IF NOT FOUND OR authority_row.address_scheme <> 'QANDEEL_OSDAP_V1' THEN
            RAISE EXCEPTION 'CANONICAL_WORLD_AUTHORITY_MISSING' USING ERRCODE='55000';
          END IF;
          SELECT COALESCE(array_agg(h.thread_id::text ORDER BY h.thread_id), ARRAY[]::text[]),
                 COALESCE(array_agg(h.placement_x ORDER BY h.thread_id), ARRAY[]::numeric[]),
                 COALESCE(array_agg(h.placement_y ORDER BY h.thread_id), ARRAY[]::numeric[])
            INTO world_thread_ids, world_x, world_y
            FROM public.conversation_thread_homes h
           WHERE h.user_id = turn_row.user_id AND h.address_scheme = authority_row.address_scheme;
          SELECT COALESCE(array_agg(m.value #>> '{}' ORDER BY m.ordinality), ARRAY[]::text[])
            INTO origin_ids
            FROM jsonb_array_elements(decision -> 'origin_thread_ids') WITH ORDINALITY AS m(value, ordinality);
          SELECT c.thread_id INTO canonical_thread_id
            FROM public.canonical_thread_identities_v1(turn_row.user_id, (decision ->> 'emerging_focus_id')::uuid) c;
          SELECT p.placement_x, p.placement_y, p.placement_attempt, p.base_x, p.base_y, p.world_fingerprint, p.origin_fingerprint
            INTO placement
            FROM public.compute_canonical_home_placement_v1(
                   turn_row.user_id::text, canonical_thread_id::text, (decision ->> 'origin_state'),
                   origin_ids, world_thread_ids, world_x, world_y) p;
        END IF;

        -- The ONE same-SP sequence authority, ONCE for the whole Thread layer.
        SELECT r.session_position, r.event_sequence INTO reserved_sp, reserved_sequence
          FROM public.reserve_session_same_sp_event_v1(p_session_id, p_user_id) r;
        IF reserved_sp IS DISTINCT FROM this_sp OR reserved_sequence IS DISTINCT FROM 2::bigint THEN
          RAISE EXCEPTION 'SAME_SP_SEQUENCE_INTEGRITY' USING ERRCODE='55000',
            DETAIL='The final Thread layer is the second Stage-6 semantic layer on the SP the CU was born at, reserved exactly once, and B1 must already hold sequence 1 there.';
        END IF;

        -- Every Thread-layer row of this CU at (this_sp, 2).
        IF (decision ->> 'decision') = 'ESTABLISH_THREAD' THEN
          PERFORM public.persist_conversation_thread_establishment_v1(
            inserted_cu, p_batch_id, decision, reserved_sequence,
            placement.placement_x, placement.placement_y, placement.placement_attempt,
            placement.base_x, placement.base_y, placement.world_fingerprint, placement.origin_fingerprint);
        END IF;
        PERFORM public.persist_conversation_thread_lifecycle_layer_v1(inserted_cu, p_batch_id, lifecycle, reserved_sequence);
      ELSE
        PERFORM public.persist_conversation_thread_lifecycle_layer_v1(inserted_cu, p_batch_id, lifecycle, NULL);
      END IF;

      -- D + E: the effective LF, derived AFTER the FINAL Thread-layer truth of
      -- this CU, compared with the prior effective LF, and proven against the
      -- canonical LF decision the application proposed.
      SELECT * INTO lf_decision FROM public.validate_conversation_live_focus_decision_v1(inserted_cu, lf_unit);

      IF lf_decision.changed THEN
        -- F: the ONE same-SP sequence authority, ONCE for the LF transition:
        -- exactly 2 when the Thread layer reserved nothing, exactly 3 after
        -- a Thread-layer sequence 2.
        SELECT r.session_position, r.event_sequence INTO reserved_sp, reserved_sequence
          FROM public.reserve_session_same_sp_event_v1(p_session_id, p_user_id) r;
        IF reserved_sp IS DISTINCT FROM this_sp
           OR reserved_sequence IS DISTINCT FROM (CASE WHEN has_change THEN 3::bigint ELSE 2::bigint END) THEN
          RAISE EXCEPTION 'SAME_SP_SEQUENCE_INTEGRITY' USING ERRCODE='55000',
            DETAIL='An LF transition is sequence 2 on a Moment with no Thread-layer event and sequence 3 after the Thread-layer sequence 2, reserved exactly once, on the SP the CU was born at.';
        END IF;
        PERFORM public.persist_conversation_live_focus_transition_v1(
          inserted_cu, p_batch_id, lf_decision.prior_kind, lf_decision.prior_ref,
          lf_decision.effective_kind, lf_decision.effective_ref, lf_decision.reason_code, reserved_sequence);
      END IF;
      -- G: an unchanged LF reserved nothing. I: only now may the next CU
      -- advance the clock and seal this SP.
    END LOOP;

    INSERT INTO public.conversation_unit_commit_events (
      commit_batch_id, user_id, session_id, source_turn_id, first_sp, last_sp, unit_count)
    VALUES (p_batch_id, turn_row.user_id, turn_row.session_id, turn_row.id, first_sp, this_sp, unit_count);

    RETURN QUERY SELECT cu.* FROM public.conversation_units cu
      WHERE cu.commit_batch_id = p_batch_id ORDER BY cu.ordinal_within_turn;
    RETURN;
  END IF;

  ---------------------------------------------------------------------------
  -- PATH A - REPLAY. Every layer must be COMPLETE by the ONE full-chain
  -- authority: a batch that carries CU + B1 + B2 + B3 truth but no LF capture
  -- is PARTIAL / LEGACY state whose SP may already be sealed, and it is never
  -- upgraded, backfilled or completed here.
  ---------------------------------------------------------------------------
  IF batch_state <> 'COMPLETE' THEN
    RAISE EXCEPTION 'FULL_SEMANTIC_BATCH_INTEGRITY' USING ERRCODE='55000',
      DETAIL='This commitment batch is structurally partial at the commitment, B1, B2, B3 or LF layer; partial, corrupted or legacy state is never repaired, upgraded, replayed or backfilled from today''s inference.';
  END IF;

  -- The frozen 0070 writer verifies the CU, B1, B2 and B3 layers tuple by
  -- tuple with ZERO mutation; then the LF capture identity must match exactly.
  PERFORM * FROM public.commit_conversation_units_with_focus_thread_lifecycle_v1(
    p_session_id, p_user_id, p_source_turn_id, p_batch_id, p_units,
    p_evaluator_version, p_policy_version, p_segmentation_provider,
    p_segmentation_model, p_segmentation_prompt_version,
    p_focus_units, p_focus_evaluator_version, p_focus_policy_version,
    p_focus_provider, p_focus_model, p_focus_prompt_version, p_focus_schema_version,
    p_thread_units, p_thread_evaluator_version, p_thread_policy_version,
    p_thread_provider, p_thread_model, p_thread_prompt_version, p_thread_schema_version,
    p_lifecycle_units, p_continuity_evaluator_version, p_continuity_policy_version,
    p_continuity_provider, p_continuity_model, p_continuity_prompt_version, p_continuity_schema_version,
    p_lifecycle_reducer_version);

  SELECT * INTO lf_batch_row FROM public.conversation_live_focus_commit_batches l WHERE l.commit_batch_id = p_batch_id;
  IF lf_batch_row.user_id <> turn_row.user_id
     OR lf_batch_row.session_id <> turn_row.session_id
     OR lf_batch_row.source_turn_id <> turn_row.id
     OR lf_batch_row.unit_count <> unit_count
     OR lf_batch_row.transition_count <> transition_count
     OR lf_batch_row.lf_reducer_version <> p_lf_reducer_version
     OR lf_batch_row.canonical_fingerprint IS DISTINCT FROM lf_fingerprint THEN
    RAISE EXCEPTION 'LIVE_FOCUS_BATCH_PAYLOAD_CONFLICT' USING ERRCODE='22023',
      DETAIL='An LF capture identity is immutable: the same batch id can never be replayed with a different effective LF, transition, reason, identity or reducer provenance.';
  END IF;

  -- Payload-level replay identity beyond the fingerprint: every stored
  -- transition is exactly what this canonical payload names.
  FOR idx IN 1 .. unit_count LOOP
    lf_unit := p_live_focus_units -> (idx - 1);
    SELECT * INTO transition_row FROM public.conversation_live_focus_transitions t WHERE t.cu_id = unit_ids[idx];
    IF (lf_unit -> 'transition')::boolean THEN
      IF transition_row.event_id IS NULL OR transition_row.commit_batch_id <> p_batch_id
         OR transition_row.event_id IS DISTINCT FROM (lf_unit ->> 'transition_event_id')::uuid
         OR transition_row.to_kind <> (lf_unit ->> 'effective_kind')
         OR transition_row.to_ref IS DISTINCT FROM (lf_unit ->> 'effective_ref')::uuid
         OR transition_row.reason_code <> (lf_unit ->> 'reason_code') THEN
        RAISE EXCEPTION 'FULL_SEMANTIC_BATCH_INTEGRITY' USING ERRCODE='55000',
          DETAIL='The stored LF transition of this CU is not the transition this canonical payload names; nothing is replayed over a different effective Live Focus.';
      END IF;
    ELSIF transition_row.event_id IS NOT NULL THEN
      RAISE EXCEPTION 'FULL_SEMANTIC_BATCH_INTEGRITY' USING ERRCODE='55000',
        DETAIL='A stored LF transition exists where this canonical payload names an unchanged Live Focus.';
    END IF;
  END LOOP;

  RETURN QUERY SELECT cu.* FROM public.conversation_units cu
    WHERE cu.commit_batch_id = p_batch_id ORDER BY cu.ordinal_within_turn;
  RETURN;
END;$$;

-- Forward-replaced from 0150_data_api_stale_state_non_retryable_sqlstate_v1.sql (substitution "full-coordinator-o3a" in database/live-call-0191-substitutions.mjs).
CREATE OR REPLACE FUNCTION public.commit_finalized_exchange_with_full_semantic_chain_v1(
  p_session_id uuid,
  p_user_id uuid,
  p_user_source_turn_id uuid,
  p_user_batch_id uuid,
  p_user_units jsonb,
  p_user_focus_units jsonb,
  p_user_thread_units jsonb,
  p_user_lifecycle_units jsonb,
  p_user_live_focus_units jsonb,
  p_assistant_source_turn_id uuid,
  p_assistant_batch_id uuid,
  p_assistant_units jsonb,
  p_assistant_focus_units jsonb,
  p_assistant_thread_units jsonb,
  p_assistant_lifecycle_units jsonb,
  p_assistant_live_focus_units jsonb,
  p_evaluator_version text,
  p_policy_version text,
  p_segmentation_provider text,
  p_segmentation_model text,
  p_segmentation_prompt_version text,
  p_focus_evaluator_version text,
  p_focus_policy_version text,
  p_focus_provider text,
  p_focus_model text,
  p_focus_prompt_version text,
  p_focus_schema_version integer,
  p_thread_evaluator_version text,
  p_thread_policy_version text,
  p_thread_provider text,
  p_thread_model text,
  p_thread_prompt_version text,
  p_thread_schema_version integer,
  p_continuity_evaluator_version text,
  p_continuity_policy_version text,
  p_continuity_provider text,
  p_continuity_model text,
  p_continuity_prompt_version text,
  p_continuity_schema_version integer,
  p_lifecycle_reducer_version text,
  p_lf_reducer_version text,
  p_expected_current_sp integer,
  p_expected_same_sp_event_sequence bigint,
  p_expected_world_thread_identity_version bigint
) RETURNS TABLE(
  live_head integer,
  same_sp_event_sequence bigint,
  world_thread_identity_version bigint,
  live_focus_kind text,
  live_focus_ref uuid,
  live_focus_sp integer,
  user_units jsonb,
  assistant_units jsonb,
  user_event jsonb,
  assistant_event jsonb,
  live_focus_transitions jsonb
) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  clock_row public.session_semantic_clocks;
  identity_row public.conversation_world_thread_identity_clocks;
  user_turn_row public.conversation_turns;
  assistant_turn_row public.conversation_turns;
  user_state text;
  assistant_state text;
  both_exist boolean;
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
  IF p_expected_same_sp_event_sequence IS NULL OR p_expected_same_sp_event_sequence < 0
     OR (p_expected_current_sp IS NOT NULL AND p_expected_current_sp < 1) THEN
    RAISE EXCEPTION 'INVALID_FOCUS_CONTEXT_TOKEN' USING ERRCODE='22023',
      DETAIL='The expected semantic-clock token is (current_sp >= 1 or NULL before the first SP, same_sp_event_sequence >= 0).';
  END IF;
  IF p_expected_world_thread_identity_version IS NULL OR p_expected_world_thread_identity_version < 0 THEN
    RAISE EXCEPTION 'INVALID_THREAD_IDENTITY_CONTEXT_TOKEN' USING ERRCODE='22023',
      DETAIL='The expected user/world Thread identity version is a non-negative technical version.';
  END IF;

  -- AF66-01: exactly ONE Session clock, acquired FIRST and held for the whole
  -- exchange transaction, before every source row, semantic row, identity
  -- version, world row and LF row.
  SELECT * INTO clock_row FROM public.session_semantic_clocks c
    WHERE c.session_id = p_session_id AND c.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

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
  -- S8B-05 CP3 (0191, CA-05-01 O3a / B3): a numbered call turn is established by the half coordinator only, and an exchange whose
  -- analysis was abandoned for integrity is never established later.
  IF EXISTS (SELECT 1 FROM public.conversation_call_turns ct WHERE ct.turn_id IN (p_user_source_turn_id, p_assistant_source_turn_id)) THEN
    RAISE EXCEPTION 'CALL_TURN_HALF_ESTABLISHMENT_ONLY' USING ERRCODE='55000';
  END IF;
  IF EXISTS (SELECT 1 FROM voice_private.call_analysis_queue q WHERE q.turn_id = p_user_source_turn_id AND q.queue_state = 'ABANDONED_INTEGRITY') THEN
    RAISE EXCEPTION 'SEMANTIC_ITEM_ABANDONED' USING ERRCODE='55000';
  END IF;

  -- BOTH halves through the ONE full-chain completeness authority, BEFORE the
  -- token logic and BEFORE either writer: ABSENT + ABSENT or COMPLETE + COMPLETE.
  user_state := public.conversation_full_semantic_batch_state_v1(p_session_id, p_user_id, p_user_source_turn_id, p_user_batch_id);
  assistant_state := public.conversation_full_semantic_batch_state_v1(p_session_id, p_user_id, p_assistant_source_turn_id, p_assistant_batch_id);
  IF NOT ((user_state = 'ABSENT' AND assistant_state = 'ABSENT')
          OR (user_state = 'COMPLETE' AND assistant_state = 'COMPLETE')) THEN
    RAISE EXCEPTION 'FULL_SEMANTIC_BATCH_INTEGRITY' USING ERRCODE='55000',
      DETAIL='A finalized exchange is committed as a whole or not at all: one half canonical while the other is absent or structurally partial is never completed, replayed or repaired.';
  END IF;

  -- Stale-context protection, first authority: the Session Semantic Clock.
  both_exist := user_state = 'COMPLETE';
  IF NOT both_exist
     AND (clock_row.current_sp IS DISTINCT FROM p_expected_current_sp
          OR clock_row.same_sp_event_sequence IS DISTINCT FROM p_expected_same_sp_event_sequence) THEN
    RAISE EXCEPTION 'STALE_CONVERSATIONAL_FOCUS_CONTEXT' USING ERRCODE='PT409',
      DETAIL='The Session Semantic Clock moved after the prior context was read; nothing was written. Re-read the context and evaluate again.';
  END IF;

  -- Stale-context protection, second authority: the user/world Thread
  -- Identity Clock, locked AFTER the Session clock and compared BEFORE any
  -- canonical mutation. LF adds no third authority: the current LF is read
  -- under the same Session clock token, and the token moves with every SP.
  IF NOT both_exist THEN
    INSERT INTO public.conversation_world_thread_identity_clocks (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO identity_row FROM public.conversation_world_thread_identity_clocks w
      WHERE w.user_id = p_user_id
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'WORLD_THREAD_IDENTITY_CLOCK_MISSING' USING ERRCODE='55000';
    END IF;
    IF identity_row.current_version IS DISTINCT FROM p_expected_world_thread_identity_version THEN
      RAISE EXCEPTION 'STALE_THREAD_IDENTITY_CONTEXT' USING ERRCODE='PT409',
        DETAIL='The user/world Thread identity dossiers changed after they were screened; nothing was written. Re-read the context and the dossiers and resolve again.';
    END IF;
  END IF;

  -- USER block first, ASSISTANT block second: canonical conversational order.
  SELECT COALESCE(jsonb_agg(to_jsonb(u) ORDER BY u.ordinal_within_turn), '[]'::jsonb)
    INTO user_units
    FROM public.commit_conversation_units_with_full_semantic_chain_v1(
      p_session_id, p_user_id, p_user_source_turn_id, p_user_batch_id, p_user_units,
      p_evaluator_version, p_policy_version, p_segmentation_provider,
      p_segmentation_model, p_segmentation_prompt_version,
      p_user_focus_units, p_focus_evaluator_version, p_focus_policy_version,
      p_focus_provider, p_focus_model, p_focus_prompt_version, p_focus_schema_version,
      p_user_thread_units, p_thread_evaluator_version, p_thread_policy_version,
      p_thread_provider, p_thread_model, p_thread_prompt_version, p_thread_schema_version,
      p_user_lifecycle_units, p_continuity_evaluator_version, p_continuity_policy_version,
      p_continuity_provider, p_continuity_model, p_continuity_prompt_version, p_continuity_schema_version,
      p_lifecycle_reducer_version, p_user_live_focus_units, p_lf_reducer_version) u;

  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.ordinal_within_turn), '[]'::jsonb)
    INTO assistant_units
    FROM public.commit_conversation_units_with_full_semantic_chain_v1(
      p_session_id, p_user_id, p_assistant_source_turn_id, p_assistant_batch_id, p_assistant_units,
      p_evaluator_version, p_policy_version, p_segmentation_provider,
      p_segmentation_model, p_segmentation_prompt_version,
      p_assistant_focus_units, p_focus_evaluator_version, p_focus_policy_version,
      p_focus_provider, p_focus_model, p_focus_prompt_version, p_focus_schema_version,
      p_assistant_thread_units, p_thread_evaluator_version, p_thread_policy_version,
      p_thread_provider, p_thread_model, p_thread_prompt_version, p_thread_schema_version,
      p_assistant_lifecycle_units, p_continuity_evaluator_version, p_continuity_policy_version,
      p_continuity_provider, p_continuity_model, p_continuity_prompt_version, p_continuity_schema_version,
      p_lifecycle_reducer_version, p_assistant_live_focus_units, p_lf_reducer_version) a;

  SELECT c.current_sp, c.same_sp_event_sequence INTO live_head, same_sp_event_sequence
    FROM public.session_semantic_clocks c WHERE c.session_id = p_session_id;
  SELECT COALESCE((SELECT w.current_version FROM public.conversation_world_thread_identity_clocks w WHERE w.user_id = p_user_id), 0)
    INTO world_thread_identity_version;
  SELECT f.live_focus_kind, f.live_focus_ref, f.live_focus_sp INTO live_focus_kind, live_focus_ref, live_focus_sp
    FROM public.conversation_session_live_focus_before_v1(p_session_id, NULL) f;
  SELECT to_jsonb(e) INTO user_event FROM public.conversation_unit_commit_events e
    WHERE e.commit_batch_id = p_user_batch_id;
  SELECT to_jsonb(e) INTO assistant_event FROM public.conversation_unit_commit_events e
    WHERE e.commit_batch_id = p_assistant_batch_id;
  -- The LF transitions created or replayed for this exchange, in SP order:
  -- reference identity only, never the same-SP sequence, never a label.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('session_position', t.session_position, 'to_kind', t.to_kind, 'to_ref', t.to_ref)
                            ORDER BY t.session_position), '[]'::jsonb)
    INTO live_focus_transitions
    FROM public.conversation_live_focus_transitions t
   WHERE t.commit_batch_id IN (p_user_batch_id, p_assistant_batch_id);
  RETURN NEXT;
END;$$;

-- Forward-replaced from 0190_s8b_05_live_call_spoken_turn_v1.sql (substitution "close-core-assistant-half" in database/live-call-0191-substitutions.mjs).
CREATE OR REPLACE FUNCTION voice_private.close_call_exchange_core_v1(p_call_id uuid, p_call_turn_index integer, p_reason text,
  p_assistant_turn_id uuid, p_event_id uuid)
RETURNS TABLE (outcome text, assistant_turn_id uuid, delivery_state text, heard_mark_ms bigint, anchor_start_ms bigint,
               anchor_end_ms bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ex voice_private.call_exchanges;
  v_user public.conversation_turns;
  v_recording uuid;
  v_mark bigint := 0;
  v_text text;
  v_terms text[];
  v_delivery text;
  v_start bigint;
  v_end bigint;
BEGIN
  IF p_call_id IS NULL OR p_call_turn_index IS NULL OR p_assistant_turn_id IS NULL OR p_event_id IS NULL
     OR p_reason IS NULL OR p_reason NOT IN ('PLAYED_OUT', 'GENERATION_FAILED', 'NEXT_TURN', 'CALL_ENDING') THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_ex FROM voice_private.call_exchanges e
   WHERE e.call_id = p_call_id AND e.call_turn_index = p_call_turn_index FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::uuid, NULL::text, NULL::bigint, NULL::bigint, NULL::bigint; RETURN;
  END IF;
  IF v_ex.exchange_state = 'CLOSED' THEN
    RETURN QUERY SELECT 'ALREADY_CLOSED'::text, v_ex.assistant_turn_id, v_ex.delivery_state, v_ex.heard_mark_ms,
      CASE WHEN v_ex.heard_mark_ms > 0 THEN v_ex.reply_clock_start_ms END,
      CASE WHEN v_ex.heard_mark_ms > 0 THEN v_ex.reply_clock_start_ms + v_ex.heard_mark_ms END;
    RETURN;
  END IF;
  -- S2: the Safety disposition is stored before generation; an exchange is never closed without it (S3 recomputes it).
  IF v_ex.safety_disposition IS NULL THEN
    RAISE EXCEPTION 'CALL_EXCHANGE_SAFETY_UNSETTLED' USING ERRCODE = '55000';
  END IF;
  SELECT * INTO v_user FROM public.conversation_turns t WHERE t.id = v_ex.user_turn_id FOR UPDATE;
  IF NOT FOUND OR v_user.status <> 'GENERATING' THEN
    RAISE EXCEPTION 'CALL_EXCHANGE_INTEGRITY' USING ERRCODE = '55000';
  END IF;
  SELECT r.id INTO v_recording FROM voice_private.recordings r WHERE r.call_id = p_call_id AND r.user_id = v_ex.user_id;
  IF v_recording IS NULL THEN RAISE EXCEPTION 'CALL_EXCHANGE_INTEGRITY' USING ERRCODE = '55000'; END IF;
  IF v_ex.reply_clock_start_ms IS NOT NULL AND v_ex.playout_mark_ms > 0 THEN
    v_mark := least(v_ex.playout_mark_ms,
                    CASE WHEN v_ex.generation_state = 'GENERATING' THEN v_ex.playout_mark_ms ELSE v_ex.produced_audio_ms END,
                    greatest(0, voice_private.track_clock_end_v1(v_recording, 'QANDEEL') - v_ex.reply_clock_start_ms));
    v_mark := v_mark - (v_mark % 20);
  END IF;
  SELECT coalesce(string_agg(s.segment_text, '' ORDER BY s.segment_seq), ''),
         coalesce((SELECT array_agg(DISTINCT t ORDER BY t) FROM voice_private.call_reply_segments s2, unnest(s2.retrieval_terms) t
                    WHERE s2.call_id = p_call_id AND s2.call_turn_index = p_call_turn_index AND s2.end_offset_ms <= v_mark), '{}')
    INTO v_text, v_terms
    FROM voice_private.call_reply_segments s
   WHERE s.call_id = p_call_id AND s.call_turn_index = p_call_turn_index AND s.end_offset_ms <= v_mark;
  IF v_ex.generation_state = 'FAILED' THEN
    v_delivery := 'FAILED';
  ELSIF v_ex.generation_state IN ('COMPLETE', 'WITHHELD_TAIL') AND v_ex.produced_audio_ms > 0 AND v_mark >= v_ex.produced_audio_ms THEN
    v_delivery := v_ex.generation_state;
  ELSE
    v_delivery := 'INTERRUPTED';
  END IF;
  IF v_mark > 0 THEN
    v_start := v_ex.reply_clock_start_ms;
    v_end := v_ex.reply_clock_start_ms + v_mark;
  END IF;
  INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content, processing_path, routing_reason,
                                         source_turn_id, completed_at)
  VALUES (p_assistant_turn_id, v_ex.session_id, v_ex.user_id, 'ASSISTANT', 'COMPLETED', v_text, v_user.processing_path,
          v_user.routing_reason, v_ex.user_turn_id, CURRENT_TIMESTAMP);
  INSERT INTO public.conversation_turn_voice_sources (turn_id, user_id, session_id, source_role, source_modality,
                                                      transcript_origin, asr_confidence_band, recording_id, anchor_start_ms,
                                                      anchor_end_ms, spoken, delivery_state)
  VALUES (p_assistant_turn_id, v_ex.user_id, v_ex.session_id, 'ASSISTANT', 'LIVE_CALL_SPEECH', NULL, NULL, v_recording,
          v_start, v_end, true, v_delivery);
  INSERT INTO public.conversation_call_turns (turn_id, user_id, session_id, call_id, call_turn_index, turn_role, turn_channel,
                                              retrieval_terms)
  VALUES (p_assistant_turn_id, v_ex.user_id, v_ex.session_id, p_call_id, p_call_turn_index, 'ASSISTANT', 'SPEECH',
          v_terms[1:64]);
  UPDATE public.conversation_turns t SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
   WHERE t.id = v_ex.user_turn_id;
  INSERT INTO public.runtime_event_outbox (event_id, event_type, event_version, subject_user_id, subject_session_id,
                                           subject_turn_id, correlation_id, schema_ref, payload)
  VALUES (p_event_id, 'ConversationTurnCompleted', '2.0', v_ex.user_id, v_ex.session_id, v_ex.user_turn_id, NULL,
          'qandeel.runtime.conversation-turn-completed.v2',
          jsonb_build_object('user_id', v_ex.user_id, 'session_id', v_ex.session_id, 'source_turn_id', v_ex.user_turn_id,
                             'terminal_status', 'COMPLETED', 'processing_path', v_user.processing_path,
                             'routing_reason', v_user.routing_reason, 'orchestration_id', NULL,
                             'safety_disposition', v_ex.safety_disposition));
  DELETE FROM voice_private.call_reply_segments s WHERE s.call_id = p_call_id AND s.call_turn_index = p_call_turn_index;
  UPDATE voice_private.call_exchanges e
     SET exchange_state = 'CLOSED', assistant_turn_id = p_assistant_turn_id, delivery_state = v_delivery, heard_mark_ms = v_mark,
         close_reason = p_reason, closed_at = clock_timestamp()
   WHERE e.call_id = p_call_id AND e.call_turn_index = p_call_turn_index;
  -- S8B-05 CP3 (0191, R7′): the reply's analysis half is queued by the close that creates it.
  INSERT INTO voice_private.call_analysis_queue (call_id, call_turn_index, half, user_id, session_id, turn_id)
  VALUES (p_call_id, p_call_turn_index, 'ASSISTANT', v_ex.user_id, v_ex.session_id, p_assistant_turn_id);
  RETURN QUERY SELECT 'CLOSED'::text, p_assistant_turn_id, v_delivery, v_mark, v_start, v_end;
END$$;

-- Forward-replaced from 0190_s8b_05_live_call_spoken_turn_v1.sql (substitution "commit-turn-o3b" in database/live-call-0191-substitutions.mjs).
CREATE OR REPLACE FUNCTION public.server_commit_live_call_turn_v1(p_user_id uuid, p_call_id uuid, p_connection_epoch bigint,
  p_turn_id uuid, p_commit_id uuid, p_turn_channel text, p_content text, p_asr_confidence_band text, p_anchor_start_ms bigint,
  p_anchor_end_ms bigint, p_retrieval_terms text[], p_close_assistant_turn_id uuid, p_close_event_id uuid)
RETURNS TABLE (outcome text, call_turn_index integer, turn_id uuid, closed_call_turn_index integer, closed_assistant_turn_id uuid,
               closed_delivery_state text, closed_heard_mark_ms bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  policy record;
  v_fence text;
  v_call voice_private.calls;
  v_recording voice_private.recordings;
  v_key text;
  v_existing public.conversation_turns;
  v_open voice_private.call_exchanges;
  v_closed_turn uuid;
  v_closed_delivery text;
  v_closed_mark bigint;
  v_index integer;
BEGIN
  SELECT * INTO policy FROM voice_private.live_call_turn_policy_v1();
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_connection_epoch IS NULL OR p_turn_id IS NULL OR p_commit_id IS NULL
     OR p_content IS NULL OR btrim(p_content) = '' OR length(p_content) > policy.max_turn_chars
     OR p_turn_channel IS NULL OR p_turn_channel NOT IN ('SPEECH', 'TEXT')
     OR (p_turn_channel = 'SPEECH' AND (p_asr_confidence_band IS NULL OR p_asr_confidence_band NOT IN ('HIGH', 'MEDIUM', 'LOW')
         OR p_anchor_start_ms IS NULL OR p_anchor_end_ms IS NULL OR p_anchor_start_ms < 0 OR p_anchor_end_ms <= p_anchor_start_ms))
     OR (p_turn_channel = 'TEXT' AND (p_asr_confidence_band IS NOT NULL OR p_anchor_start_ms IS NOT NULL OR p_anchor_end_ms IS NOT NULL))
     OR NOT voice_private.call_terms_valid_v1(p_retrieval_terms)
     OR p_close_assistant_turn_id IS NULL OR p_close_event_id IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  v_fence := voice_private.call_command_fence_v1(p_user_id, p_call_id, p_connection_epoch, true);
  SELECT * INTO v_call FROM voice_private.calls c WHERE c.id = p_call_id;
  v_key := 'live-call:' || p_call_id::text || ':' || p_commit_id::text;
  IF v_call.id IS NOT NULL AND v_call.user_id = p_user_id THEN
    SELECT * INTO v_existing FROM public.conversation_turns t
     WHERE t.session_id = v_call.session_id AND t.user_id = p_user_id AND t.idempotency_key = v_key;
    IF FOUND THEN
      RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, ct.call_turn_index, v_existing.id, NULL::integer, NULL::uuid, NULL::text, NULL::bigint
        FROM public.conversation_call_turns ct WHERE ct.turn_id = v_existing.id;
      RETURN;
    END IF;
  END IF;
  IF v_fence IS NOT NULL THEN
    RETURN QUERY SELECT v_fence, NULL::integer, NULL::uuid, NULL::integer, NULL::uuid, NULL::text, NULL::bigint; RETURN;
  END IF;
  IF NOT voice_private.capability_enabled_v1('PERSONAL_LIVE_CALL') THEN
    RETURN QUERY SELECT 'NOT_AVAILABLE_NOW'::text, NULL::integer, NULL::uuid, NULL::integer, NULL::uuid, NULL::text, NULL::bigint; RETURN;
  END IF;
  IF voice_private.consent_state_v1(p_user_id) <> 'GRANTED_CURRENT' THEN
    RETURN QUERY SELECT 'CONSENT_REQUIRED'::text, NULL::integer, NULL::uuid, NULL::integer, NULL::uuid, NULL::text, NULL::bigint; RETURN;
  END IF;
  IF v_call.next_call_turn_index >= policy.max_call_turns THEN
    RETURN QUERY SELECT 'CALL_TURN_LIMIT'::text, NULL::integer, NULL::uuid, NULL::integer, NULL::uuid, NULL::text, NULL::bigint; RETURN;
  END IF;
  SELECT * INTO v_recording FROM voice_private.recordings r WHERE r.call_id = p_call_id AND r.user_id = p_user_id FOR SHARE;
  IF NOT FOUND OR v_recording.recording_state <> 'RECORDING' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::integer, NULL::uuid, NULL::integer, NULL::uuid, NULL::text, NULL::bigint; RETURN;
  END IF;
  -- The anchor lies inside what the USER track holds (CA-05-04): an anchor never points past the recording.
  IF p_turn_channel = 'SPEECH' AND p_anchor_end_ms > voice_private.track_clock_end_v1(v_recording.id, 'USER') THEN
    RAISE EXCEPTION 'VOICE_SOURCE_INVALID' USING ERRCODE = '22023',
      DETAIL = 'A live call anchor lies inside its track''s recorded or gapped range.';
  END IF;
  -- N1: the open exchange closes first, with its confirmed truth, in this transaction.
  SELECT * INTO v_open FROM voice_private.call_exchanges e WHERE e.call_id = p_call_id AND e.exchange_state = 'OPEN';
  IF FOUND THEN
    SELECT c.assistant_turn_id, c.delivery_state, c.heard_mark_ms INTO v_closed_turn, v_closed_delivery, v_closed_mark
      FROM voice_private.close_call_exchange_core_v1(p_call_id, v_open.call_turn_index, 'NEXT_TURN', p_close_assistant_turn_id,
                                                     p_close_event_id) c;
  END IF;
  v_index := voice_private.reserve_call_turn_index_v1(p_user_id, p_call_id, p_connection_epoch);
  INSERT INTO public.conversation_turns (id, session_id, user_id, role, status, content, processing_path, routing_reason,
                                         source_turn_id, idempotency_key, completed_at)
  VALUES (p_turn_id, v_call.session_id, p_user_id, 'USER', 'GENERATING', p_content, 'FAST', 'RUNTIME_ROUTING_V2_FAST_DEFAULT',
          NULL, v_key, NULL);
  IF p_turn_channel = 'SPEECH' THEN
    INSERT INTO public.conversation_turn_voice_sources (turn_id, user_id, session_id, source_role, source_modality,
                                                        transcript_origin, asr_confidence_band, recording_id, anchor_start_ms,
                                                        anchor_end_ms)
    VALUES (p_turn_id, p_user_id, v_call.session_id, 'USER', 'LIVE_CALL_SPEECH', 'MACHINE_ASR', p_asr_confidence_band,
            v_recording.id, p_anchor_start_ms, p_anchor_end_ms);
  END IF;
  INSERT INTO public.conversation_call_turns (turn_id, user_id, session_id, call_id, call_turn_index, turn_role, turn_channel,
                                              retrieval_terms)
  VALUES (p_turn_id, p_user_id, v_call.session_id, p_call_id, v_index, 'USER', p_turn_channel, p_retrieval_terms);
  INSERT INTO voice_private.call_exchanges (call_id, call_turn_index, user_id, session_id, user_turn_id, committed_epoch)
  VALUES (p_call_id, v_index, p_user_id, v_call.session_id, p_turn_id, p_connection_epoch);
  INSERT INTO voice_private.call_analysis_queue (call_id, call_turn_index, half, user_id, session_id, turn_id)
  VALUES (p_call_id, v_index, 'USER', p_user_id, v_call.session_id, p_turn_id);
  -- S8B-05 CP3 (0191, O3b / B1): the call's first turn adopts the session's unestablished earlier exchanges at the head of its
  -- analysis order.
  IF v_index = 1 THEN
    PERFORM voice_private.adopt_pre_call_exchanges_v1(p_call_id, p_user_id, v_call.session_id);
  END IF;
  RETURN QUERY SELECT 'COMMITTED'::text, v_index, p_turn_id, v_open.call_turn_index, v_closed_turn, v_closed_delivery, v_closed_mark;
END$$;

-- Forward-replaced from 0189_s8b_05_live_call_authority_v1.sql (substitution "end-call-closes-exchange" in database/live-call-0191-substitutions.mjs).
CREATE OR REPLACE FUNCTION voice_private.end_call_v1(p_call_id uuid, p_end_reason text, p_sealed_by text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_recording uuid;
  -- S8B-05 CP3 (0191, R5′): the call's open exchange, closed with its END.
  v_open voice_private.call_exchanges;
BEGIN
  UPDATE voice_private.calls c
     SET state = 'ENDED', end_reason = p_end_reason, ended_at = clock_timestamp(), grace_until = NULL, seat_lease_until = NULL
   WHERE c.id = p_call_id AND c.state <> 'ENDED';
  -- S8B-05 CP3 (0191, R5′ / P2): the open exchange closes with the call's end by the ONE close (the first commit wins) when its
  -- Safety is stored; one whose Safety was never stored stays open for the S3 sweep (A3.1).
  SELECT * INTO v_open FROM voice_private.call_exchanges e WHERE e.call_id = p_call_id AND e.exchange_state = 'OPEN' FOR UPDATE;
  IF FOUND AND v_open.safety_disposition IS NOT NULL THEN
    PERFORM voice_private.close_call_exchange_core_v1(p_call_id, v_open.call_turn_index, 'CALL_ENDING', gen_random_uuid(), gen_random_uuid());
  END IF;
  SELECT r.id INTO v_recording FROM voice_private.recordings r
   WHERE r.call_id = p_call_id AND r.recording_state = 'RECORDING' FOR UPDATE;
  IF FOUND THEN
    PERFORM voice_private.seal_call_recording_v1(v_recording, p_sealed_by);
  END IF;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. THE HALF COORDINATOR (C).
-- ---------------------------------------------------------------------------------------------------------------------
-- One analysis half of a numbered call turn (a spoken or typed USER turn, or its reply), through the 0071 batch writer
-- as it is. The Session Semantic Clock is the FIRST lock (AF66-01), then the queue item, the turn and its voice source
-- (FOR KEY SHARE). A COMPLETE batch is returned from storage (zero providers on the caller's side, no token check). A
-- new batch is accepted only for the head of the session's analysis order (O1: a reply's half after its USER half; O2:
-- a USER half after the whole previous exchange; B1: the adopted pre-call exchanges first), and only against both exact
-- tokens; every refusal is retryable and writes nothing. The queue item becomes COMPLETE in the same transaction.
CREATE FUNCTION public.commit_conversation_units_call_half_v1(
  p_session_id uuid,
  p_user_id uuid,
  p_call_id uuid,
  p_call_turn_index integer,
  p_half text,
  p_source_turn_id uuid,
  p_batch_id uuid,
  p_units jsonb,
  p_focus_units jsonb,
  p_thread_units jsonb,
  p_lifecycle_units jsonb,
  p_live_focus_units jsonb,
  p_evaluator_version text,
  p_policy_version text,
  p_segmentation_provider text,
  p_segmentation_model text,
  p_segmentation_prompt_version text,
  p_focus_evaluator_version text,
  p_focus_policy_version text,
  p_focus_provider text,
  p_focus_model text,
  p_focus_prompt_version text,
  p_focus_schema_version integer,
  p_thread_evaluator_version text,
  p_thread_policy_version text,
  p_thread_provider text,
  p_thread_model text,
  p_thread_prompt_version text,
  p_thread_schema_version integer,
  p_continuity_evaluator_version text,
  p_continuity_policy_version text,
  p_continuity_provider text,
  p_continuity_model text,
  p_continuity_prompt_version text,
  p_continuity_schema_version integer,
  p_lifecycle_reducer_version text,
  p_lf_reducer_version text,
  p_expected_current_sp integer,
  p_expected_same_sp_event_sequence bigint,
  p_expected_world_thread_identity_version bigint
) RETURNS TABLE(
  outcome text,
  live_head integer,
  same_sp_event_sequence bigint,
  world_thread_identity_version bigint,
  live_focus_kind text,
  live_focus_ref uuid,
  live_focus_sp integer,
  units jsonb,
  unit_event jsonb,
  live_focus_transitions jsonb
) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  clock_row public.session_semantic_clocks;
  identity_row public.conversation_world_thread_identity_clocks;
  item_row voice_private.call_analysis_queue;
  head_row voice_private.call_analysis_queue;
  turn_row public.conversation_turns;
  call_turn_row public.conversation_call_turns;
  user_call_turn_id uuid;
  voice_modality text;
  batch_state text;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL OR p_call_id IS NULL OR p_call_turn_index IS NULL OR p_call_turn_index < 1
     OR p_half IS NULL OR p_half NOT IN ('USER', 'ASSISTANT') OR p_source_turn_id IS NULL OR p_batch_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;
  IF p_expected_same_sp_event_sequence IS NULL OR p_expected_same_sp_event_sequence < 0
     OR (p_expected_current_sp IS NOT NULL AND p_expected_current_sp < 1) THEN
    RAISE EXCEPTION 'INVALID_FOCUS_CONTEXT_TOKEN' USING ERRCODE='22023',
      DETAIL='The expected semantic-clock token is (current_sp >= 1 or NULL before the first SP, same_sp_event_sequence >= 0).';
  END IF;
  IF p_expected_world_thread_identity_version IS NULL OR p_expected_world_thread_identity_version < 0 THEN
    RAISE EXCEPTION 'INVALID_THREAD_IDENTITY_CONTEXT_TOKEN' USING ERRCODE='22023',
      DETAIL='The expected user/world Thread identity version is a non-negative technical version.';
  END IF;

  -- AF66-01: the Session clock first, held for the whole transaction.
  SELECT * INTO clock_row FROM public.session_semantic_clocks c
    WHERE c.session_id = p_session_id AND c.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  SELECT * INTO item_row FROM voice_private.call_analysis_queue q
   WHERE q.call_id = p_call_id AND q.call_turn_index = p_call_turn_index AND q.half = p_half
     AND q.session_id = p_session_id AND q.user_id = p_user_id
   FOR UPDATE;
  IF NOT FOUND OR item_row.turn_id <> p_source_turn_id THEN
    RAISE EXCEPTION 'CALL_HALF_NOT_QUEUED' USING ERRCODE='22023';
  END IF;
  IF item_row.queue_state = 'ABANDONED_INTEGRITY' THEN
    RAISE EXCEPTION 'SEMANTIC_ITEM_ABANDONED' USING ERRCODE='55000',
      DETAIL='An analysis item abandoned for a confirmed integrity failure is never established later (B3).';
  END IF;

  SELECT * INTO turn_row FROM public.conversation_turns t
    WHERE t.id = p_source_turn_id AND t.session_id = p_session_id AND t.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  SELECT * INTO call_turn_row FROM public.conversation_call_turns ct WHERE ct.turn_id = p_source_turn_id;
  SELECT vs.source_modality INTO voice_modality FROM public.conversation_turn_voice_sources vs
   WHERE vs.turn_id = turn_row.id FOR KEY SHARE;
  -- R3 as A1 widened it: a numbered call turn, spoken (a LIVE_CALL_SPEECH source) or typed during the call (none).
  IF call_turn_row.turn_id IS NULL OR call_turn_row.call_id <> p_call_id OR call_turn_row.call_turn_index <> p_call_turn_index
     OR call_turn_row.turn_role <> p_half
     OR (call_turn_row.turn_channel = 'SPEECH' AND voice_modality IS DISTINCT FROM 'LIVE_CALL_SPEECH')
     OR (call_turn_row.turn_channel = 'TEXT' AND voice_modality IS NOT NULL) THEN
    RAISE EXCEPTION 'CALL_HALF_RELATION' USING ERRCODE='22023';
  END IF;
  IF p_half = 'USER' THEN
    IF turn_row.role <> 'USER' OR turn_row.status NOT IN ('GENERATING', 'COMPLETED') OR turn_row.source_turn_id IS NOT NULL THEN
      RAISE EXCEPTION 'CALL_HALF_RELATION' USING ERRCODE='22023';
    END IF;
  ELSE
    SELECT ct.turn_id INTO user_call_turn_id FROM public.conversation_call_turns ct
     WHERE ct.call_id = p_call_id AND ct.call_turn_index = p_call_turn_index AND ct.turn_role = 'USER';
    IF turn_row.role <> 'ASSISTANT' OR turn_row.status <> 'COMPLETED' OR user_call_turn_id IS NULL
       OR turn_row.source_turn_id IS DISTINCT FROM user_call_turn_id THEN
      RAISE EXCEPTION 'CALL_HALF_RELATION' USING ERRCODE='22023';
    END IF;
  END IF;

  batch_state := public.conversation_full_semantic_batch_state_v1(p_session_id, p_user_id, p_source_turn_id, p_batch_id);
  IF batch_state = 'PARTIAL' THEN
    RAISE EXCEPTION 'FULL_SEMANTIC_BATCH_INTEGRITY' USING ERRCODE='55000',
      DETAIL='A structurally partial half is never completed, replayed or repaired.';
  END IF;

  IF batch_state = 'ABSENT' THEN
    -- O1 / O2 / B1: only the head of the session's analysis order is established.
    head_row := voice_private.call_analysis_head_v1(p_session_id);
    IF head_row.call_id IS DISTINCT FROM p_call_id OR head_row.call_turn_index IS DISTINCT FROM p_call_turn_index
       OR head_row.half IS DISTINCT FROM p_half THEN
      RAISE EXCEPTION 'CALL_HALF_OUT_OF_ORDER' USING ERRCODE='55000',
        DETAIL='A half is established only after every earlier item of its session is settled; nothing was written.';
    END IF;
    IF p_half = 'ASSISTANT' AND NOT EXISTS (
         SELECT 1 FROM voice_private.call_analysis_queue u
          WHERE u.call_id = p_call_id AND u.call_turn_index = p_call_turn_index AND u.half = 'USER' AND u.queue_state = 'COMPLETE') THEN
      RAISE EXCEPTION 'CALL_HALF_PREDECESSOR_ABANDONED' USING ERRCODE='55000',
        DETAIL='A reply''s half follows its USER half; a USER half abandoned for integrity takes its exchange with it (B3).';
    END IF;

    -- Stale-context protection, first authority: the Session Semantic Clock.
    IF clock_row.current_sp IS DISTINCT FROM p_expected_current_sp
       OR clock_row.same_sp_event_sequence IS DISTINCT FROM p_expected_same_sp_event_sequence THEN
      RAISE EXCEPTION 'STALE_CONVERSATIONAL_FOCUS_CONTEXT' USING ERRCODE='PT409',
        DETAIL='The Session Semantic Clock moved after the prior context was read; nothing was written. Re-read the context and evaluate again.';
    END IF;
    -- Second authority: the user/world Thread Identity Clock, locked after the Session clock.
    INSERT INTO public.conversation_world_thread_identity_clocks (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO identity_row FROM public.conversation_world_thread_identity_clocks w
      WHERE w.user_id = p_user_id
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'WORLD_THREAD_IDENTITY_CLOCK_MISSING' USING ERRCODE='55000';
    END IF;
    IF identity_row.current_version IS DISTINCT FROM p_expected_world_thread_identity_version THEN
      RAISE EXCEPTION 'STALE_THREAD_IDENTITY_CONTEXT' USING ERRCODE='PT409',
        DETAIL='The user/world Thread identity dossiers changed after they were screened; nothing was written. Re-read the context and the dossiers and resolve again.';
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(u) ORDER BY u.ordinal_within_turn), '[]'::jsonb)
      INTO units
      FROM public.commit_conversation_units_with_full_semantic_chain_v1(
        p_session_id, p_user_id, p_source_turn_id, p_batch_id, p_units,
        p_evaluator_version, p_policy_version, p_segmentation_provider,
        p_segmentation_model, p_segmentation_prompt_version,
        p_focus_units, p_focus_evaluator_version, p_focus_policy_version,
        p_focus_provider, p_focus_model, p_focus_prompt_version, p_focus_schema_version,
        p_thread_units, p_thread_evaluator_version, p_thread_policy_version,
        p_thread_provider, p_thread_model, p_thread_prompt_version, p_thread_schema_version,
        p_lifecycle_units, p_continuity_evaluator_version, p_continuity_policy_version,
        p_continuity_provider, p_continuity_model, p_continuity_prompt_version, p_continuity_schema_version,
        p_lifecycle_reducer_version, p_live_focus_units, p_lf_reducer_version) u;
    outcome := 'COMMITTED';
  ELSE
    SELECT COALESCE(jsonb_agg(to_jsonb(u) ORDER BY u.ordinal_within_turn), '[]'::jsonb)
      INTO units
      FROM public.conversation_units u WHERE u.commit_batch_id = p_batch_id;
    outcome := 'REPLAYED';
  END IF;

  UPDATE voice_private.call_analysis_queue q
     SET queue_state = 'COMPLETE', claim_token = NULL, lease_until = NULL, next_attempt_at = NULL,
         settled_at = clock_timestamp()
   WHERE q.call_id = p_call_id AND q.call_turn_index = p_call_turn_index AND q.half = p_half AND q.queue_state <> 'COMPLETE';

  SELECT c.current_sp, c.same_sp_event_sequence INTO live_head, same_sp_event_sequence
    FROM public.session_semantic_clocks c WHERE c.session_id = p_session_id;
  SELECT COALESCE((SELECT w.current_version FROM public.conversation_world_thread_identity_clocks w WHERE w.user_id = p_user_id), 0)
    INTO world_thread_identity_version;
  SELECT f.live_focus_kind, f.live_focus_ref, f.live_focus_sp INTO live_focus_kind, live_focus_ref, live_focus_sp
    FROM public.conversation_session_live_focus_before_v1(p_session_id, NULL) f;
  SELECT to_jsonb(e) INTO unit_event FROM public.conversation_unit_commit_events e WHERE e.commit_batch_id = p_batch_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('session_position', t.session_position, 'to_kind', t.to_kind, 'to_ref', t.to_ref)
                            ORDER BY t.session_position), '[]'::jsonb)
    INTO live_focus_transitions
    FROM public.conversation_live_focus_transitions t
   WHERE t.commit_batch_id = p_batch_id;
  RETURN NEXT;
END;$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. THE WORKER'S COMMANDS (D). service_role only.
-- ---------------------------------------------------------------------------------------------------------------------
-- Claims the head of a session's analysis order for `p_claim_token`: the session lease (a waiting post-response
-- execution's reservation is honoured), the item lease and one attempt from the person's daily budget of the analysis
-- lock class. A reply half whose USER half was abandoned for integrity is abandoned with it first (B3). Outcomes:
-- CLAIMED, IDLE (nothing open), WAITING (the head waits for its backoff or another live claim, until `next_attempt_at`),
-- BUSY (the session lease is held or reserved), BUDGET_EXHAUSTED (the head is PARKED until the next UTC day; never
-- skipped, never dropped).
CREATE FUNCTION public.server_claim_call_analysis_item_v1(p_session_id uuid, p_claim_token uuid)
RETURNS TABLE (outcome text, call_id uuid, call_turn_index integer, half text, user_id uuid, turn_id uuid,
               assistant_turn_id uuid, attempt_count integer, next_attempt_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  policy record;
  v_head voice_private.call_analysis_queue;
  v_item voice_private.call_analysis_queue;
  v_now timestamptz;
  v_day date;
  v_attempts integer;
BEGIN
  SELECT * INTO policy FROM voice_private.call_analysis_policy_v1();
  IF p_session_id IS NULL OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  FOR i IN 1 .. 64 LOOP
    v_head := voice_private.call_analysis_head_v1(p_session_id);
    EXIT WHEN v_head.call_id IS NULL OR v_head.half <> 'ASSISTANT' OR NOT EXISTS (
      SELECT 1 FROM voice_private.call_analysis_queue u
       WHERE u.call_id = v_head.call_id AND u.call_turn_index = v_head.call_turn_index AND u.half = 'USER'
         AND u.queue_state = 'ABANDONED_INTEGRITY');
    UPDATE voice_private.call_analysis_queue q
       SET queue_state = 'ABANDONED_INTEGRITY', claim_token = NULL, lease_until = NULL, next_attempt_at = NULL,
           last_failure = 'PREDECESSOR_ABANDONED', settled_at = clock_timestamp()
     WHERE q.call_id = v_head.call_id AND q.call_turn_index = v_head.call_turn_index AND q.half = 'ASSISTANT';
  END LOOP;
  IF v_head.call_id IS NULL THEN
    RETURN QUERY SELECT 'IDLE'::text, NULL::uuid, NULL::integer, NULL::text, NULL::uuid, NULL::uuid, NULL::uuid, NULL::integer, NULL::timestamptz;
    RETURN;
  END IF;
  v_now := clock_timestamp();
  IF v_head.queue_state = 'CLAIMED' AND v_head.lease_until > v_now AND v_head.claim_token <> p_claim_token THEN
    RETURN QUERY SELECT 'WAITING'::text, v_head.call_id, v_head.call_turn_index, v_head.half, v_head.user_id, NULL::uuid, NULL::uuid,
                        v_head.attempt_count, v_head.lease_until;
    RETURN;
  END IF;
  IF v_head.queue_state IN ('RETRY_WAIT', 'PARKED') AND v_head.next_attempt_at > v_now THEN
    RETURN QUERY SELECT 'WAITING'::text, v_head.call_id, v_head.call_turn_index, v_head.half, v_head.user_id, NULL::uuid, NULL::uuid,
                        v_head.attempt_count, v_head.next_attempt_at;
    RETURN;
  END IF;
  IF NOT voice_private.take_session_semantic_lease_v1(p_session_id, v_head.user_id, p_claim_token, 'CALL_ANALYSIS',
                                                       policy.item_lease_seconds) THEN
    RETURN QUERY SELECT 'BUSY'::text, NULL::uuid, NULL::integer, NULL::text, NULL::uuid, NULL::uuid, NULL::uuid, NULL::integer, NULL::timestamptz;
    RETURN;
  END IF;
  SELECT * INTO v_item FROM voice_private.call_analysis_queue q
   WHERE q.call_id = v_head.call_id AND q.call_turn_index = v_head.call_turn_index AND q.half = v_head.half
   FOR UPDATE;
  IF v_item.queue_state IN ('COMPLETE', 'ABANDONED_INTEGRITY') THEN
    PERFORM voice_private.drop_session_semantic_lease_v1(p_session_id, p_claim_token);
    RETURN QUERY SELECT 'WAITING'::text, NULL::uuid, NULL::integer, NULL::text, NULL::uuid, NULL::uuid, NULL::uuid, NULL::integer, clock_timestamp();
    RETURN;
  END IF;
  v_day := (clock_timestamp() AT TIME ZONE 'UTC')::date;
  INSERT INTO voice_private.call_analysis_attempt_days AS d (user_id, attempt_day, attempts)
  VALUES (v_item.user_id, v_day, 1)
  ON CONFLICT (user_id, attempt_day) DO UPDATE SET attempts = d.attempts + 1 WHERE d.attempts < policy.daily_attempt_budget
  RETURNING d.attempts INTO v_attempts;
  IF v_attempts IS NULL THEN
    UPDATE voice_private.call_analysis_queue q
       SET queue_state = 'PARKED', claim_token = NULL, lease_until = NULL, last_failure = 'DAILY_BUDGET_EXHAUSTED',
           next_attempt_at = ((v_day + 1)::timestamp AT TIME ZONE 'UTC')
     WHERE q.call_id = v_item.call_id AND q.call_turn_index = v_item.call_turn_index AND q.half = v_item.half;
    PERFORM voice_private.drop_session_semantic_lease_v1(p_session_id, p_claim_token);
    RETURN QUERY SELECT 'BUDGET_EXHAUSTED'::text, v_item.call_id, v_item.call_turn_index, v_item.half, v_item.user_id, NULL::uuid,
                        NULL::uuid, v_item.attempt_count, ((v_day + 1)::timestamp AT TIME ZONE 'UTC');
    RETURN;
  END IF;
  UPDATE voice_private.call_analysis_queue q
     SET queue_state = 'CLAIMED', claim_token = p_claim_token,
         lease_until = clock_timestamp() + make_interval(secs => policy.item_lease_seconds),
         attempt_count = q.attempt_count + 1, next_attempt_at = NULL,
         first_claimed_at = coalesce(q.first_claimed_at, clock_timestamp())
   WHERE q.call_id = v_item.call_id AND q.call_turn_index = v_item.call_turn_index AND q.half = v_item.half
  RETURNING * INTO v_item;
  RETURN QUERY SELECT 'CLAIMED'::text, v_item.call_id, v_item.call_turn_index, v_item.half, v_item.user_id, v_item.turn_id,
                      v_item.assistant_turn_id, v_item.attempt_count, NULL::timestamptz;
END$$;

-- Settles a claimed item and returns the session lease. COMPLETE (an adopted pre-call exchange, after the full
-- coordinator: both halves must be full-chain COMPLETE; a call half was completed by the half coordinator itself),
-- RELEASE (no provider work started: the attempt and its budget are returned), PROVIDER_FAILURE (L5: RETRY_WAIT with
-- backoff 2 s, 4 s …; once the attempts are spent, PARKED for the parked retry — never skipped), INTEGRITY_FAILURE (B3:
-- retried once to confirm, then ABANDONED_INTEGRITY, declared). Another holder's claim is never touched (NOT_HOLDER).
CREATE FUNCTION public.server_settle_call_analysis_item_v1(p_session_id uuid, p_call_id uuid, p_call_turn_index integer,
  p_half text, p_claim_token uuid, p_outcome text, p_failure_code text)
RETURNS TABLE (outcome text, queue_state text, next_attempt_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  policy record;
  v_item voice_private.call_analysis_queue;
  v_next timestamptz;
  v_user_batch uuid;
  v_assistant_batch uuid;
BEGIN
  SELECT * INTO policy FROM voice_private.call_analysis_policy_v1();
  IF p_session_id IS NULL OR p_call_id IS NULL OR p_call_turn_index IS NULL OR p_half IS NULL OR p_claim_token IS NULL
     OR p_outcome IS NULL OR p_outcome NOT IN ('COMPLETE', 'RELEASE', 'PROVIDER_FAILURE', 'INTEGRITY_FAILURE')
     OR (p_failure_code IS NOT NULL AND p_failure_code !~ '^[A-Z][A-Z0-9_]{0,63}$')
     OR ((p_outcome IN ('PROVIDER_FAILURE', 'INTEGRITY_FAILURE')) <> (p_failure_code IS NOT NULL)) THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_item FROM voice_private.call_analysis_queue q
   WHERE q.call_id = p_call_id AND q.call_turn_index = p_call_turn_index AND q.half = p_half AND q.session_id = p_session_id
   FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::text, NULL::timestamptz; RETURN; END IF;
  PERFORM voice_private.drop_session_semantic_lease_v1(p_session_id, p_claim_token);
  IF v_item.queue_state IN ('COMPLETE', 'ABANDONED_INTEGRITY') THEN
    RETURN QUERY SELECT 'ALREADY_SETTLED'::text, v_item.queue_state, NULL::timestamptz; RETURN;
  END IF;
  IF v_item.claim_token IS DISTINCT FROM p_claim_token THEN
    RETURN QUERY SELECT 'NOT_HOLDER'::text, v_item.queue_state, v_item.next_attempt_at; RETURN;
  END IF;
  IF p_outcome = 'COMPLETE' THEN
    IF v_item.half <> 'EXCHANGE' THEN RAISE EXCEPTION 'CALL_ANALYSIS_ITEM_NOT_ESTABLISHED' USING ERRCODE = '55000'; END IF;
    SELECT b.id INTO v_user_batch FROM public.conversation_unit_commit_batches b WHERE b.source_turn_id = v_item.turn_id;
    SELECT b.id INTO v_assistant_batch FROM public.conversation_unit_commit_batches b WHERE b.source_turn_id = v_item.assistant_turn_id;
    IF v_user_batch IS NULL OR v_assistant_batch IS NULL
       OR public.conversation_full_semantic_batch_state_v1(p_session_id, v_item.user_id, v_item.turn_id, v_user_batch) <> 'COMPLETE'
       OR public.conversation_full_semantic_batch_state_v1(p_session_id, v_item.user_id, v_item.assistant_turn_id, v_assistant_batch) <> 'COMPLETE' THEN
      RAISE EXCEPTION 'CALL_ANALYSIS_ITEM_NOT_ESTABLISHED' USING ERRCODE = '55000';
    END IF;
    UPDATE voice_private.call_analysis_queue q
       SET queue_state = 'COMPLETE', claim_token = NULL, lease_until = NULL, settled_at = clock_timestamp()
     WHERE q.call_id = p_call_id AND q.call_turn_index = p_call_turn_index AND q.half = p_half;
    RETURN QUERY SELECT 'SETTLED'::text, 'COMPLETE'::text, NULL::timestamptz; RETURN;
  END IF;
  IF p_outcome = 'RELEASE' THEN
    UPDATE voice_private.call_analysis_queue q
       SET queue_state = 'PENDING', claim_token = NULL, lease_until = NULL, attempt_count = greatest(q.attempt_count - 1, 0)
     WHERE q.call_id = p_call_id AND q.call_turn_index = p_call_turn_index AND q.half = p_half;
    UPDATE voice_private.call_analysis_attempt_days d SET attempts = greatest(d.attempts - 1, 0)
     WHERE d.user_id = v_item.user_id AND d.attempt_day = (clock_timestamp() AT TIME ZONE 'UTC')::date;
    RETURN QUERY SELECT 'SETTLED'::text, 'PENDING'::text, NULL::timestamptz; RETURN;
  END IF;
  IF p_outcome = 'INTEGRITY_FAILURE' THEN
    IF v_item.integrity_failures + 1 >= policy.integrity_confirmations THEN
      UPDATE voice_private.call_analysis_queue q
         SET queue_state = 'ABANDONED_INTEGRITY', claim_token = NULL, lease_until = NULL, integrity_failures = q.integrity_failures + 1,
             last_failure = p_failure_code, settled_at = clock_timestamp()
       WHERE q.call_id = p_call_id AND q.call_turn_index = p_call_turn_index AND q.half = p_half;
      RETURN QUERY SELECT 'SETTLED'::text, 'ABANDONED_INTEGRITY'::text, NULL::timestamptz; RETURN;
    END IF;
    v_next := clock_timestamp() + make_interval(secs => policy.retry_base_seconds);
    UPDATE voice_private.call_analysis_queue q
       SET queue_state = 'RETRY_WAIT', claim_token = NULL, lease_until = NULL, integrity_failures = q.integrity_failures + 1,
           last_failure = p_failure_code, next_attempt_at = v_next
     WHERE q.call_id = p_call_id AND q.call_turn_index = p_call_turn_index AND q.half = p_half;
    RETURN QUERY SELECT 'SETTLED'::text, 'RETRY_WAIT'::text, v_next; RETURN;
  END IF;
  IF v_item.attempt_count >= policy.max_provider_attempts THEN
    v_next := clock_timestamp() + make_interval(secs => policy.parked_retry_seconds);
    UPDATE voice_private.call_analysis_queue q
       SET queue_state = 'PARKED', claim_token = NULL, lease_until = NULL, last_failure = p_failure_code, next_attempt_at = v_next
     WHERE q.call_id = p_call_id AND q.call_turn_index = p_call_turn_index AND q.half = p_half;
    RETURN QUERY SELECT 'SETTLED'::text, 'PARKED'::text, v_next; RETURN;
  END IF;
  v_next := clock_timestamp() + make_interval(secs => policy.retry_base_seconds * (1 << (v_item.attempt_count - 1)));
  UPDATE voice_private.call_analysis_queue q
     SET queue_state = 'RETRY_WAIT', claim_token = NULL, lease_until = NULL, last_failure = p_failure_code, next_attempt_at = v_next
   WHERE q.call_id = p_call_id AND q.call_turn_index = p_call_turn_index AND q.half = p_half;
  RETURN QUERY SELECT 'SETTLED'::text, 'RETRY_WAIT'::text, v_next;
END$$;

-- The sessions whose analysis order has work that may run now (a pending item, a backoff or parked retry that is due, a
-- claim whose lease lapsed: a crashed worker), oldest first. The claim decides what actually runs.
CREATE FUNCTION public.server_list_call_analysis_sessions_v1(p_limit integer)
RETURNS TABLE (session_id uuid, user_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT q.session_id, min(q.user_id::text)::uuid
      FROM voice_private.call_analysis_queue q
     WHERE q.queue_state = 'PENDING'
        OR (q.queue_state IN ('RETRY_WAIT', 'PARKED') AND q.next_attempt_at <= clock_timestamp())
        OR (q.queue_state = 'CLAIMED' AND q.lease_until <= clock_timestamp())
     GROUP BY q.session_id
     ORDER BY min(q.enqueued_at)
     LIMIT p_limit;
END$$;

-- The turns of ONE analysis item, for the worker that claimed it: only turns its session's analysis order names (the
-- item's own turn and, for a pre-call EXCHANGE item, its reply), never anything else of the session.
CREATE FUNCTION public.server_read_call_analysis_turns_v1(p_user_id uuid, p_session_id uuid, p_turn_ids uuid[])
RETURNS TABLE (id uuid, session_id uuid, role text, status text, content text, processing_path text, routing_reason text,
               source_turn_id uuid, idempotency_key text, created_at timestamptz, updated_at timestamptz, completed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL OR p_turn_ids IS NULL OR cardinality(p_turn_ids) NOT BETWEEN 1 AND 2 THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT t.id, t.session_id, t.role::text, t.status::text, t.content, t.processing_path::text, t.routing_reason,
           t.source_turn_id, t.idempotency_key, t.created_at, t.updated_at, t.completed_at
      FROM public.conversation_turns t
     WHERE t.id = ANY (p_turn_ids) AND t.session_id = p_session_id AND t.user_id = p_user_id
       AND EXISTS (SELECT 1 FROM voice_private.call_analysis_queue q
                    WHERE q.session_id = p_session_id AND q.user_id = p_user_id
                      AND (q.turn_id = t.id OR q.assistant_turn_id = t.id))
     ORDER BY t.created_at, t.id;
END$$;

-- The shared session lock for ONE post-response execution (v1.1 §1.6): NOT_REQUIRED for a session with no call and no
-- open call analysis item (a text session is unchanged), ACQUIRED, or BUSY — and a BUSY caller reserves the next turn
-- of the lease, which the call analysis claim honours, so the post-response work is delayed, never cancelled.
CREATE FUNCTION public.server_acquire_session_semantic_lease_v1(p_user_id uuid, p_session_id uuid, p_holder uuid)
RETURNS TABLE (outcome text, lease_until timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  policy record;
BEGIN
  SELECT * INTO policy FROM voice_private.call_analysis_policy_v1();
  IF p_user_id IS NULL OR p_session_id IS NULL OR p_holder IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversation_sessions s WHERE s.id = p_session_id AND s.user_id = p_user_id) THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::timestamptz; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM voice_private.calls c WHERE c.session_id = p_session_id AND c.state <> 'ENDED')
     AND NOT EXISTS (SELECT 1 FROM voice_private.call_analysis_queue q
                      WHERE q.session_id = p_session_id AND q.queue_state NOT IN ('COMPLETE', 'ABANDONED_INTEGRITY')) THEN
    RETURN QUERY SELECT 'NOT_REQUIRED'::text, NULL::timestamptz; RETURN;
  END IF;
  IF voice_private.take_session_semantic_lease_v1(p_session_id, p_user_id, p_holder, 'POST_RESPONSE', policy.item_lease_seconds) THEN
    RETURN QUERY SELECT 'ACQUIRED'::text, l.lease_until FROM voice_private.session_semantic_leases l WHERE l.session_id = p_session_id;
    RETURN;
  END IF;
  UPDATE voice_private.session_semantic_leases l
     SET reserved_by = p_holder, reserved_until = clock_timestamp() + make_interval(secs => policy.reservation_seconds)
   WHERE l.session_id = p_session_id AND (l.reserved_by IS NULL OR l.reserved_until <= clock_timestamp() OR l.reserved_by = p_holder);
  RETURN QUERY SELECT 'BUSY'::text, NULL::timestamptz;
END$$;

CREATE FUNCTION public.server_release_session_semantic_lease_v1(p_session_id uuid, p_holder uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_session_id IS NULL OR p_holder IS NULL THEN RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
  PERFORM voice_private.drop_session_semantic_lease_v1(p_session_id, p_holder);
  UPDATE voice_private.session_semantic_leases l SET reserved_by = NULL, reserved_until = NULL
   WHERE l.session_id = p_session_id AND l.reserved_by = p_holder;
  RETURN QUERY SELECT 'RELEASED'::text;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 9. S3 AT THE CALL'S END (G). service_role only.
-- ---------------------------------------------------------------------------------------------------------------------
-- The exchanges still OPEN on an ENDED call: the ones whose Safety was never stored (the END closed every other one), or
-- one an earlier deployment left. What the API needs to finish each: the owner, the call, the number and the turn's own
-- words (the gate's input, read on the server channel, never logged).
CREATE FUNCTION public.server_list_unsettled_call_exchanges_v1(p_limit integer)
RETURNS TABLE (user_id uuid, session_id uuid, call_id uuid, call_turn_index integer, user_turn_id uuid, content text,
               safety_disposition text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT e.user_id, e.session_id, e.call_id, e.call_turn_index, e.user_turn_id, u.content, e.safety_disposition
      FROM voice_private.call_exchanges e
      JOIN voice_private.calls c ON c.id = e.call_id
      JOIN public.conversation_turns u ON u.id = e.user_turn_id
     WHERE e.exchange_state = 'OPEN' AND c.state = 'ENDED'
     ORDER BY c.ended_at, e.call_id
     LIMIT p_limit;
END$$;

-- S3's "same context reader" on the server channel: the owner's own call context read (0190, C2), the SAME function,
-- executed for the call's owner. It runs as its owner, so row-level security does not narrow it; the session and the
-- call are the owner's, which is all the owner's token would have let it read.
CREATE FUNCTION public.server_read_call_context_v1(p_user_id uuid, p_session_id uuid, p_call_id uuid, p_limit integer)
RETURNS TABLE (exchange_kind text, call_turn_index integer, user_content text, reply_content text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL OR p_call_id IS NULL OR p_limit IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM voice_private.calls c WHERE c.id = p_call_id AND c.user_id = p_user_id AND c.session_id = p_session_id) THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT x.exchange_kind, x.call_turn_index, x.user_content, x.reply_content
                 FROM public.call_context_exchanges_v1(p_session_id, p_call_id, p_limit) x;
END$$;

-- The close of an exchange left open by an ENDED call, once its Safety is stored: the ONE close (CALL_ENDING; the first
-- commit wins), with its confirmed truth. A live call's exchange is its connection's (CALL_LIVE).
CREATE FUNCTION public.server_close_ended_call_exchange_v1(p_user_id uuid, p_call_id uuid, p_call_turn_index integer,
  p_assistant_turn_id uuid, p_event_id uuid)
RETURNS TABLE (outcome text, assistant_turn_id uuid, delivery_state text, heard_mark_ms bigint, anchor_start_ms bigint,
               anchor_end_ms bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_call voice_private.calls;
BEGIN
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_call_turn_index IS NULL OR p_assistant_turn_id IS NULL OR p_event_id IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_call FROM voice_private.calls c WHERE c.id = p_call_id FOR SHARE;
  IF NOT FOUND OR v_call.user_id <> p_user_id THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::uuid, NULL::text, NULL::bigint, NULL::bigint, NULL::bigint; RETURN;
  END IF;
  IF v_call.state <> 'ENDED' THEN
    RETURN QUERY SELECT 'CALL_LIVE'::text, NULL::uuid, NULL::text, NULL::bigint, NULL::bigint, NULL::bigint; RETURN;
  END IF;
  RETURN QUERY SELECT * FROM voice_private.close_call_exchange_core_v1(p_call_id, p_call_turn_index, 'CALL_ENDING',
                                                                       p_assistant_turn_id, p_event_id);
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 10. ACCOUNT ERASURE COVERAGE. Every new relation that names a person cascades from the account row.
-- ---------------------------------------------------------------------------------------------------------------------
INSERT INTO account_erasure_private.coverage_registry (relation, coverage) VALUES
    ('voice_private.session_semantic_leases', 'ACCOUNT_CASCADE'),
    ('voice_private.call_analysis_attempt_days', 'ACCOUNT_CASCADE'),
    ('voice_private.background_provider_permits', 'ACCOUNT_CASCADE');

-- ---------------------------------------------------------------------------------------------------------------------
-- 11. OWNERSHIP, RLS AND ACL.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  rel text;
  fn text;
  r text;
BEGIN
  FOREACH rel IN ARRAY ARRAY['voice_private.background_permit_policy', 'voice_private.session_semantic_leases',
                             'voice_private.call_analysis_attempt_days', 'voice_private.background_provider_permits'] LOOP
    EXECUTE format('ALTER TABLE %s OWNER TO postgres', rel);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', rel);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC', rel);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON TABLE %s FROM %I', rel, r); END IF;
    END LOOP;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY[
    'voice_private.call_analysis_policy_v1()',
    'voice_private.background_permit_policy_v1()',
    'voice_private.set_background_permit_policy_v1(integer,integer,integer,integer,integer,text,text)',
    'voice_private.call_analysis_head_v1(uuid)',
    'voice_private.take_session_semantic_lease_v1(uuid,uuid,uuid,text,integer)',
    'voice_private.drop_session_semantic_lease_v1(uuid,uuid)',
    'voice_private.user_in_critical_window_v1(uuid)',
    'voice_private.adopt_pre_call_exchanges_v1(uuid,uuid,uuid)',
    'public.commit_conversation_units_call_half_v1(uuid,uuid,uuid,integer,text,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,integer,bigint,bigint)',
    'public.server_acquire_background_permit_v1(uuid,text,uuid,boolean)',
    'public.server_release_background_permit_v1(uuid)',
    'public.server_claim_call_analysis_item_v1(uuid,uuid)',
    'public.server_settle_call_analysis_item_v1(uuid,uuid,integer,text,uuid,text,text)',
    'public.server_list_call_analysis_sessions_v1(integer)',
    'public.server_read_call_analysis_turns_v1(uuid,uuid,uuid[])',
    'public.server_acquire_session_semantic_lease_v1(uuid,uuid,uuid)',
    'public.server_release_session_semantic_lease_v1(uuid,uuid)',
    'public.server_list_unsettled_call_exchanges_v1(integer)',
    'public.server_read_call_context_v1(uuid,uuid,uuid,integer)',
    'public.server_close_ended_call_exchange_v1(uuid,uuid,integer,uuid,uuid)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r); END IF;
    END LOOP;
    IF fn LIKE 'public.%' AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 12. DEPLOY GUARD.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
BEGIN
  IF (SELECT count(*) FROM voice_private.voice_launch_capability_states s
       WHERE s.feature_flag_state = 'DISABLED' AND s.launch_requirements_state = 'UNSATISFIED') <> 4 THEN
    RAISE EXCEPTION 'S8B-05 CP3: every voice capability scope must remain DISABLED / UNSATISFIED';
  END IF;
  SELECT count(*) INTO v_count FROM pg_constraint c
   WHERE c.contype = 'f'
     AND (c.confrelid = 'public.users'::regclass
          OR c.confrelid::regclass::text IN (SELECT g.relation FROM account_erasure_private.coverage_registry g WHERE g.coverage = 'VOICE'))
     AND c.conrelid::regclass::text NOT IN (SELECT g.relation FROM account_erasure_private.coverage_registry g);
  IF v_count <> 0 THEN RAISE EXCEPTION 'S8B-05 CP3: a relation referencing the account or a voice relation is unregistered'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants g
              WHERE g.table_schema = 'voice_private' AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC'))
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public'
                   AND (p.proname LIKE 'server\_%call%' OR p.proname LIKE 'server\_%background%' OR p.proname LIKE 'server\_%semantic\_lease%'
                        OR p.proname = 'commit_conversation_units_call_half_v1')
                   AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))) THEN
    RAISE EXCEPTION 'S8B-05 CP3: a voice relation, a call definer or the half coordinator is reachable by a client role';
  END IF;
  -- D-05 as amended (v1.1 §1.5): of the conversation commit family (the two name stems verify-migration-0071 censuses; a
  -- separately owned public.commit_* authority such as S5-03B's spatial placement is outside it), exactly two functions
  -- commit for service_role — the full exchange coordinator and the half coordinator; the batch writer for no role.
  SELECT count(*) INTO v_count FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND (p.proname LIKE 'commit\_conversation\_units%' OR p.proname LIKE 'commit\_finalized\_exchange%')
     AND has_function_privilege('service_role', p.oid, 'EXECUTE');
  IF v_count <> 2
     OR NOT has_function_privilege('service_role', 'public.commit_conversation_units_call_half_v1(uuid,uuid,uuid,integer,text,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,integer,bigint,bigint)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.commit_finalized_exchange_with_full_semantic_chain_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,integer,bigint,bigint)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.commit_conversation_units_with_full_semantic_chain_v1(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,jsonb,text,text,text,text,text,integer,text,jsonb,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'S8B-05 CP3: exactly the full and the half coordinator commit for service_role; the writer for no role (found %)', v_count;
  END IF;
END$$;

COMMIT;
