-- S8B-05 CP1 — the live call authority, the shared realtime capacity and the call-recording corrections (CA-05-04), under
-- the Integrated Live Call Contract v1.2 FINAL (approved for execution by the Product Owner on 2026-11-02: D-05-01 ... 08,
-- CA-05-01 ... 04). Not hosted: every voice gate stays DISABLED.
--
-- ## What is added
--
--   A. voice_private.live_call_policy: the controlled configuration of a call (one row, changed only by an operator act no
--      role can execute): the realtime-session capacity (voice-runtime-v1.md D-F1: set from the provider account's actual
--      limit; the evaluation account allows two), the reconnection grace (D-6: 30 s), the connect timeout, the seat lease
--      and the maximum call length (D-05-06: 60 minutes).
--   B. voice_private.calls: the one canonical record of a Live Call (voice-runtime-v1.md §3). Server-canonical: the
--      client sends intents, the server decides. States CONNECTING / ACTIVE / RECONNECTING / ENDED, the five end reasons,
--      one non-ENDED call per person across devices (D-05-01: a resume is refused to any other client instance), a
--      connection epoch that fences every older connection, started_at written once at the first ACTIVE in the SAME
--      transaction that opens the recording, the 30 s grace, and the reference counter call_turn_index reserves for the
--      call's future turns (CA-05-01 R1; CP2 / CP3 consume it).
--   C. The shared realtime capacity: a seat is held by every non-ENDED call and every open live voice note (0188), both
--      counted against the ONE policy capacity under one global lock. A full capacity is refused explicitly
--      (CAPACITY_FULL; a live note's open raises REALTIME_CAPACITY_FULL). A call keeps its seat while it reconnects, so a
--      resume inside the grace never loses it; a seat whose holder died lapses on its own (no seat is held for ever).
--   D. The call authority's commands: begin, activate, heartbeat, suspend, resume, end, sweep, and the call-truth read.
--      The sweep is the ONE recovery authority of a call: it ends what lapsed with a truthful reason and seals the call's
--      recording in the same transaction.
--   E. CA-05-04: recordings.call_id becomes the foreign key 0183 left to S8B-05; the open is reachable only for the call
--      authority's ACTIVE call (session, started_at and owner from the call itself; a sealed or deleted recording is no
--      longer answered OPENED; a duplicate open is serialized by the call row); the QANDEEL track gains the NOT_SPEAKING
--      gap (QANDEEL's listening time is recorded as a gap, never as silence); the call authority renews the writer lease
--      explicitly; neither the stale-recording recovery nor the writer's own seal closes the recording of a call that has
--      not ENDED (a reconnecting call's recording survives its grace); a live call's turn anchor must lie inside its
--      track's recorded or gapped range.
--
-- ## What is deliberately NOT here
--
--   * No endpointing, no spoken turn, no reply, no analysis, no playout truth, no barge-in (CP2 ... CP4).
--   * No gate is opened; no client role executes any definer; nothing is applied to a hosted database.
--   * No provider call is begun here: the realtime ASR ledger of a call is CP2's.

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. CONTROLLED CONFIGURATION.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.live_call_policy (
  singleton boolean NOT NULL DEFAULT true,
  realtime_session_capacity integer NOT NULL,
  reconnect_grace_seconds integer NOT NULL,
  connect_timeout_seconds integer NOT NULL,
  seat_lease_seconds integer NOT NULL,
  max_call_seconds integer NOT NULL,
  policy_version bigint NOT NULL,
  decided_by text NOT NULL,
  policy_basis text NOT NULL,
  decided_at timestamptz NOT NULL,
  CONSTRAINT live_call_policy_pk PRIMARY KEY (singleton),
  CONSTRAINT live_call_policy_singleton_check CHECK (singleton),
  CONSTRAINT live_call_policy_bounds_check CHECK (
    realtime_session_capacity BETWEEN 0 AND 1000 AND reconnect_grace_seconds BETWEEN 5 AND 300
    AND connect_timeout_seconds BETWEEN 5 AND 120 AND seat_lease_seconds BETWEEN 5 AND 120
    AND max_call_seconds BETWEEN 60 AND 14400 AND policy_version >= 1
    AND length(decided_by) BETWEEN 1 AND 200 AND length(policy_basis) BETWEEN 1 AND 2000)
);
INSERT INTO voice_private.live_call_policy (realtime_session_capacity, reconnect_grace_seconds, connect_timeout_seconds,
                                            seat_lease_seconds, max_call_seconds, policy_version, decided_by, policy_basis,
                                            decided_at)
VALUES (2, 30, 15, 20, 3600, 1, 'S8B-05 CP1 migration 0189',
        'voice-runtime-v1.md D-F1 (the evaluation account allows two concurrent realtime sessions; the capacity follows the '
        || 'account''s actual limit), D-6 (30 s reconnection grace), contract v1.2 D-05-06 (60-minute call)', clock_timestamp());

CREATE FUNCTION voice_private.live_call_policy_v1() RETURNS voice_private.live_call_policy
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p FROM voice_private.live_call_policy p WHERE p.singleton;
$$;

-- An operator act (no role executes it), like the capability setter: the capacity follows the provider account's limit.
CREATE FUNCTION voice_private.set_live_call_policy_v1(p_realtime_session_capacity integer, p_reconnect_grace_seconds integer,
  p_connect_timeout_seconds integer, p_seat_lease_seconds integer, p_max_call_seconds integer, p_decided_by text,
  p_policy_basis text)
RETURNS bigint
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_version bigint;
BEGIN
  UPDATE voice_private.live_call_policy p
     SET realtime_session_capacity = p_realtime_session_capacity, reconnect_grace_seconds = p_reconnect_grace_seconds,
         connect_timeout_seconds = p_connect_timeout_seconds, seat_lease_seconds = p_seat_lease_seconds,
         max_call_seconds = p_max_call_seconds, policy_version = p.policy_version + 1, decided_by = p_decided_by,
         policy_basis = p_policy_basis, decided_at = clock_timestamp()
   WHERE p.singleton
  RETURNING p.policy_version INTO v_version;
  RETURN v_version;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. THE CALL RECORD. RLS on, no policy, no role.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.calls (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  client_instance_id uuid NOT NULL,
  state text NOT NULL,
  end_reason text,
  connection_epoch bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  connect_deadline timestamptz NOT NULL,
  started_at timestamptz,
  grace_until timestamptz,
  seat_lease_until timestamptz,
  ended_at timestamptz,
  next_call_turn_index integer NOT NULL DEFAULT 1,
  CONSTRAINT calls_pk PRIMARY KEY (id),
  CONSTRAINT calls_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  -- The call lives inside the person's ordinary Personal conversation session (voice-runtime-v1.md §3): no new session.
  CONSTRAINT calls_session_fk FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT calls_state_check CHECK (state IN ('CONNECTING', 'ACTIVE', 'RECONNECTING', 'ENDED')),
  CONSTRAINT calls_end_reason_check CHECK (end_reason IS NULL OR end_reason IN
    ('USER_ENDED', 'PEER_LOST_AFTER_GRACE', 'SYSTEM_INTERRUPTED', 'FAILED', 'SERVER_ENDED')),
  CONSTRAINT calls_shape_check CHECK (
    ((state = 'ENDED') = (end_reason IS NOT NULL)) AND ((state = 'ENDED') = (ended_at IS NOT NULL))
    AND ((state = 'ENDED') = (seat_lease_until IS NULL))
    AND ((state = 'RECONNECTING') = (grace_until IS NOT NULL))
    AND (state <> 'CONNECTING' OR started_at IS NULL)
    AND (state NOT IN ('ACTIVE', 'RECONNECTING') OR started_at IS NOT NULL)
    AND connection_epoch >= 1 AND next_call_turn_index >= 1
    AND connect_deadline > created_at)
);
CREATE UNIQUE INDEX calls_one_open_idx ON voice_private.calls (user_id) WHERE state <> 'ENDED';
CREATE INDEX calls_open_idx ON voice_private.calls (state) WHERE state <> 'ENDED';
CREATE INDEX calls_session_idx ON voice_private.calls (session_id);

-- The record's transitions, for every role, the table owner included (the definers decide; this keeps them honest).
-- CONNECTING -> ACTIVE | ENDED; ACTIVE -> RECONNECTING | ENDED; RECONNECTING -> ACTIVE | ENDED; ENDED is final. started_at
-- is written once, at the first ACTIVE; the epoch and the turn counter never go back; identity never changes.
CREATE FUNCTION voice_private.guard_call_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF voice_private.account_erasure_delete_v1()
       OR (pg_catalog.current_setting('qandeel.personal_erasure', true) = pg_catalog.txid_current()::text
           AND personal_data_private.personal_erasure_authorized_v1()) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'LIVE_CALL_RECORD_IS_DURABLE' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.state = 'CONNECTING' AND NEW.started_at IS NULL AND NEW.ended_at IS NULL AND NEW.connection_epoch = 1
       AND NEW.next_call_turn_index = 1 AND NEW.grace_until IS NULL THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'LIVE_CALL_TRANSITION_REFUSED' USING ERRCODE = '55000';
  END IF;
  IF OLD.state = 'ENDED'
     OR NEW.id <> OLD.id OR NEW.user_id <> OLD.user_id OR NEW.session_id <> OLD.session_id
     OR NEW.client_instance_id <> OLD.client_instance_id OR NEW.created_at <> OLD.created_at
     OR NEW.connect_deadline <> OLD.connect_deadline
     OR NEW.connection_epoch < OLD.connection_epoch OR NEW.next_call_turn_index < OLD.next_call_turn_index
     OR (OLD.started_at IS NOT NULL AND NEW.started_at IS DISTINCT FROM OLD.started_at)
     OR (OLD.started_at IS NULL AND NEW.started_at IS NOT NULL AND NOT (OLD.state = 'CONNECTING' AND NEW.state = 'ACTIVE'))
     OR NOT (NEW.state = OLD.state
             OR (OLD.state = 'CONNECTING' AND NEW.state IN ('ACTIVE', 'ENDED'))
             OR (OLD.state = 'ACTIVE' AND NEW.state IN ('RECONNECTING', 'ENDED'))
             OR (OLD.state = 'RECONNECTING' AND NEW.state IN ('ACTIVE', 'ENDED'))) THEN
    RAISE EXCEPTION 'LIVE_CALL_TRANSITION_REFUSED' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END$$;
CREATE TRIGGER calls_transitions BEFORE INSERT OR UPDATE OR DELETE ON voice_private.calls
    FOR EACH ROW EXECUTE FUNCTION voice_private.guard_call_v1();

-- 0183 left this foreign key to S8B-05 ("the FK is S8B-05's"): every call recording belongs to a call record.
ALTER TABLE voice_private.recordings
  ADD CONSTRAINT recordings_call_fk FOREIGN KEY (call_id) REFERENCES voice_private.calls (id);

-- QANDEEL's listening time on its own track is a gap, never written silence (CA-05-04): NOT_SPEAKING, QANDEEL only.
ALTER TABLE voice_private.recording_gaps DROP CONSTRAINT recording_gaps_kind_check;
ALTER TABLE voice_private.recording_gaps ADD CONSTRAINT recording_gaps_kind_check
  CHECK (gap_kind IN ('RECONNECTION', 'MUTED', 'WRITER_LOSS', 'NOT_SPEAKING') AND (gap_kind <> 'NOT_SPEAKING' OR track = 'QANDEEL'));

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. THE SHARED REALTIME CAPACITY.
-- ---------------------------------------------------------------------------------------------------------------------
-- The seats in use, read under the capacity lock: every non-ENDED call (CONNECTING until its seat lease; ACTIVE until its
-- seat lease plus the grace, so a call whose server died can still resume on another; RECONNECTING until its grace), and
-- every open live voice note not yet past the 0188 ceiling (the 0188 sweep settles it then).
CREATE FUNCTION voice_private.realtime_seats_in_use_v1() RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_grace interval := make_interval(secs => (voice_private.live_call_policy_v1()).reconnect_grace_seconds);
  v_now timestamptz := clock_timestamp();
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qandeel.realtime-capacity.v1', 0));
  RETURN (SELECT count(*) FROM voice_private.calls c
           WHERE c.state <> 'ENDED'
             AND CASE c.state WHEN 'CONNECTING' THEN c.seat_lease_until
                              WHEN 'ACTIVE' THEN c.seat_lease_until + v_grace
                              ELSE c.grace_until END > v_now)::integer
       + (SELECT count(*) FROM voice_private.live_voice_notes n
           WHERE n.state = 'OPEN' AND n.opened_at + (voice_private.fast_voice_policy_v1()).live_note_max > v_now)::integer;
END$$;

-- A live voice note (0188) opens a realtime session too: it takes a seat from the same capacity, or is refused. The 0188
-- open is unchanged; its insert reaches this guard, and a refusal rolls its whole transaction back (no ledger row).
CREATE FUNCTION voice_private.admit_live_voice_note_seat_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF voice_private.realtime_seats_in_use_v1() >= (voice_private.live_call_policy_v1()).realtime_session_capacity THEN
    RAISE EXCEPTION 'REALTIME_CAPACITY_FULL' USING ERRCODE = 'PT503',
      DETAIL = 'Every realtime session the provider account allows is in use.';
  END IF;
  RETURN NEW;
END$$;
CREATE TRIGGER live_voice_notes_realtime_seat BEFORE INSERT ON voice_private.live_voice_notes
    FOR EACH ROW EXECUTE FUNCTION voice_private.admit_live_voice_note_seat_v1();

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. THE CALL AUTHORITY.
-- ---------------------------------------------------------------------------------------------------------------------
-- Ends a locked, non-ENDED call with its reason and seals its recording in the same transaction (RECOVERY when the
-- authority recovered it, WRITER when its own connection ended it). Nothing else ends a call.
CREATE FUNCTION voice_private.end_call_v1(p_call_id uuid, p_end_reason text, p_sealed_by text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_recording uuid;
BEGIN
  UPDATE voice_private.calls c
     SET state = 'ENDED', end_reason = p_end_reason, ended_at = clock_timestamp(), grace_until = NULL, seat_lease_until = NULL
   WHERE c.id = p_call_id AND c.state <> 'ENDED';
  SELECT r.id INTO v_recording FROM voice_private.recordings r
   WHERE r.call_id = p_call_id AND r.recording_state = 'RECORDING' FOR UPDATE;
  IF FOUND THEN
    PERFORM voice_private.seal_call_recording_v1(v_recording, p_sealed_by);
  END IF;
END$$;

-- Begin a call: the person's ordinary ACTIVE text session (the call lives inside it), the PERSONAL_LIVE_CALL gate, the
-- CURRENT consent, one non-ENDED call per person (a lapsed one is ended first, truthfully), and a seat. Idempotent per
-- call id for the same person, session and client instance.
CREATE FUNCTION public.server_begin_call_v1(p_user_id uuid, p_session_id uuid, p_call_id uuid, p_client_instance_id uuid)
RETURNS TABLE (outcome text, call_state text, connection_epoch bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_policy voice_private.live_call_policy := voice_private.live_call_policy_v1();
  v_session public.conversation_sessions;
  v_existing voice_private.calls;
  v_open voice_private.calls;
  v_now timestamptz;
  v_grace interval;
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL OR p_call_id IS NULL OR p_client_instance_id IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qandeel.live-call.v1:' || p_user_id::text, 0));
  SELECT * INTO v_existing FROM voice_private.calls c WHERE c.id = p_call_id;
  IF FOUND THEN
    IF v_existing.user_id = p_user_id AND v_existing.session_id = p_session_id
       AND v_existing.client_instance_id = p_client_instance_id AND v_existing.state = 'CONNECTING'
       AND v_existing.connection_epoch = 1 THEN
      RETURN QUERY SELECT 'BEGUN'::text, v_existing.state, v_existing.connection_epoch;
    ELSE
      RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::text, NULL::bigint;
    END IF;
    RETURN;
  END IF;
  SELECT * INTO v_session FROM public.conversation_sessions s WHERE s.id = p_session_id AND s.user_id = p_user_id;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::text, NULL::bigint; RETURN; END IF;
  IF v_session.status <> 'ACTIVE' OR v_session.channel <> 'TEXT' THEN
    RETURN QUERY SELECT 'SESSION_NOT_ACTIVE'::text, NULL::text, NULL::bigint; RETURN;
  END IF;
  IF NOT voice_private.capability_enabled_v1('PERSONAL_LIVE_CALL') THEN
    RETURN QUERY SELECT 'NOT_AVAILABLE_NOW'::text, NULL::text, NULL::bigint; RETURN;
  END IF;
  IF voice_private.consent_state_v1(p_user_id) <> 'GRANTED_CURRENT' THEN
    RETURN QUERY SELECT 'CONSENT_REQUIRED'::text, NULL::text, NULL::bigint; RETURN;
  END IF;
  -- One call per person (D-05-01): a call whose seat has lapsed is ended truthfully now; a live one refuses the begin.
  v_now := clock_timestamp();
  v_grace := make_interval(secs => v_policy.reconnect_grace_seconds);
  SELECT * INTO v_open FROM voice_private.calls c WHERE c.user_id = p_user_id AND c.state <> 'ENDED' FOR UPDATE;
  IF FOUND THEN
    IF v_open.state = 'CONNECTING' AND (v_open.seat_lease_until <= v_now OR v_open.connect_deadline <= v_now) THEN
      PERFORM voice_private.end_call_v1(v_open.id, 'FAILED', 'RECOVERY');
    ELSIF v_open.state = 'ACTIVE' AND v_open.seat_lease_until + v_grace <= v_now THEN
      PERFORM voice_private.end_call_v1(v_open.id, 'SYSTEM_INTERRUPTED', 'RECOVERY');
    ELSIF v_open.state = 'RECONNECTING' AND v_open.grace_until <= v_now THEN
      PERFORM voice_private.end_call_v1(v_open.id, 'PEER_LOST_AFTER_GRACE', 'RECOVERY');
    ELSE
      RETURN QUERY SELECT 'ALREADY_IN_CALL'::text, NULL::text, NULL::bigint; RETURN;
    END IF;
  END IF;
  IF voice_private.realtime_seats_in_use_v1() >= v_policy.realtime_session_capacity THEN
    RETURN QUERY SELECT 'CAPACITY_FULL'::text, NULL::text, NULL::bigint; RETURN;
  END IF;
  v_now := clock_timestamp();
  INSERT INTO voice_private.calls (id, user_id, session_id, client_instance_id, state, connection_epoch, created_at,
                                   connect_deadline, seat_lease_until)
  VALUES (p_call_id, p_user_id, p_session_id, p_client_instance_id, 'CONNECTING', 1, v_now,
          v_now + make_interval(secs => v_policy.connect_timeout_seconds),
          v_now + make_interval(secs => v_policy.seat_lease_seconds));
  RETURN QUERY SELECT 'BEGUN'::text, 'CONNECTING'::text, 1::bigint;
END$$;

-- The first ACTIVE: started_at written once, and the call's recording opened in the SAME transaction (voice-runtime-v1.md
-- §7; the retention runs from started_at). Only the connection holding the current epoch activates. A call that did not
-- activate before its deadline ends FAILED (it has no recording).
CREATE FUNCTION public.server_activate_call_v1(p_user_id uuid, p_call_id uuid, p_connection_epoch bigint)
RETURNS TABLE (outcome text, started_at timestamptz, recording_id uuid, retention_expires_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_policy voice_private.live_call_policy := voice_private.live_call_policy_v1();
  v_call voice_private.calls;
  v_now timestamptz;
  v_open record;
BEGIN
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_connection_epoch IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_call FROM voice_private.calls c WHERE c.id = p_call_id AND c.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::timestamptz, NULL::uuid, NULL::timestamptz; RETURN; END IF;
  IF v_call.state = 'ENDED' THEN RETURN QUERY SELECT 'ENDED'::text, NULL::timestamptz, NULL::uuid, NULL::timestamptz; RETURN; END IF;
  IF v_call.connection_epoch <> p_connection_epoch THEN
    RETURN QUERY SELECT 'FENCED'::text, NULL::timestamptz, NULL::uuid, NULL::timestamptz; RETURN;
  END IF;
  IF v_call.state = 'ACTIVE' THEN
    RETURN QUERY SELECT 'ACTIVE'::text, v_call.started_at, r.id, r.retention_expires_at
                   FROM voice_private.recordings r WHERE r.call_id = p_call_id;
    RETURN;
  END IF;
  IF v_call.state <> 'CONNECTING' THEN
    RETURN QUERY SELECT 'NOT_CONNECTING'::text, NULL::timestamptz, NULL::uuid, NULL::timestamptz; RETURN;
  END IF;
  v_now := clock_timestamp();
  IF v_call.connect_deadline <= v_now THEN
    PERFORM voice_private.end_call_v1(p_call_id, 'FAILED', 'RECOVERY');
    RETURN QUERY SELECT 'ENDED'::text, NULL::timestamptz, NULL::uuid, NULL::timestamptz; RETURN;
  END IF;
  IF NOT voice_private.capability_enabled_v1('PERSONAL_LIVE_CALL') THEN
    RETURN QUERY SELECT 'NOT_AVAILABLE_NOW'::text, NULL::timestamptz, NULL::uuid, NULL::timestamptz; RETURN;
  END IF;
  IF voice_private.consent_state_v1(p_user_id) <> 'GRANTED_CURRENT' THEN
    RETURN QUERY SELECT 'CONSENT_REQUIRED'::text, NULL::timestamptz, NULL::uuid, NULL::timestamptz; RETURN;
  END IF;
  UPDATE voice_private.calls c
     SET state = 'ACTIVE', started_at = v_now, seat_lease_until = v_now + make_interval(secs => v_policy.seat_lease_seconds)
   WHERE c.id = p_call_id;
  SELECT * INTO v_open FROM public.server_open_call_recording_v1(p_user_id, v_call.session_id, p_call_id, v_now,
                                                                  v_policy.seat_lease_seconds) o;
  IF v_open.outcome IS DISTINCT FROM 'OPENED' THEN
    RAISE EXCEPTION 'LIVE_CALL_RECORDING_NOT_OPENED' USING ERRCODE = '55000';
  END IF;
  RETURN QUERY SELECT 'ACTIVE'::text, v_now, v_open.recording_id, v_open.retention_expires_at;
END$$;

-- The connection's heartbeat: renews the seat and, explicitly, the recording's writer lease (CA-05-04). A call past its
-- maximum length ends SERVER_ENDED here (D-05-06).
CREATE FUNCTION public.server_heartbeat_call_v1(p_user_id uuid, p_call_id uuid, p_connection_epoch bigint)
RETURNS TABLE (outcome text, call_state text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_policy voice_private.live_call_policy := voice_private.live_call_policy_v1();
  v_call voice_private.calls;
  v_now timestamptz := clock_timestamp();
  v_until timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_connection_epoch IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_call FROM voice_private.calls c WHERE c.id = p_call_id AND c.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::text; RETURN; END IF;
  IF v_call.state = 'ENDED' THEN RETURN QUERY SELECT 'ENDED'::text, v_call.end_reason; RETURN; END IF;
  IF v_call.connection_epoch <> p_connection_epoch THEN RETURN QUERY SELECT 'FENCED'::text, v_call.state; RETURN; END IF;
  IF v_call.state = 'RECONNECTING' THEN RETURN QUERY SELECT 'RECONNECTING'::text, v_call.state; RETURN; END IF;
  IF v_call.state = 'ACTIVE' AND v_call.started_at + make_interval(secs => v_policy.max_call_seconds) <= v_now THEN
    PERFORM voice_private.end_call_v1(p_call_id, 'SERVER_ENDED', 'WRITER');
    RETURN QUERY SELECT 'ENDED'::text, 'SERVER_ENDED'::text; RETURN;
  END IF;
  v_until := v_now + make_interval(secs => v_policy.seat_lease_seconds);
  UPDATE voice_private.calls c SET seat_lease_until = v_until WHERE c.id = p_call_id;
  UPDATE voice_private.recordings r SET writer_lease_until = greatest(r.writer_lease_until, v_until)
   WHERE r.call_id = p_call_id AND r.recording_state = 'RECORDING';
  RETURN QUERY SELECT 'ALIVE'::text, v_call.state;
END$$;

-- The connection was lost: ACTIVE becomes RECONNECTING for the grace (the seat is kept until it ends); a call lost before
-- it was ever ACTIVE ends FAILED. Only the connection holding the current epoch can suspend: an older connection closing
-- after a resume changes nothing.
CREATE FUNCTION public.server_suspend_call_v1(p_user_id uuid, p_call_id uuid, p_connection_epoch bigint)
RETURNS TABLE (outcome text, grace_until timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_policy voice_private.live_call_policy := voice_private.live_call_policy_v1();
  v_call voice_private.calls;
  v_until timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_connection_epoch IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_call FROM voice_private.calls c WHERE c.id = p_call_id AND c.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::timestamptz; RETURN; END IF;
  IF v_call.state = 'ENDED' THEN RETURN QUERY SELECT 'ENDED'::text, NULL::timestamptz; RETURN; END IF;
  IF v_call.connection_epoch <> p_connection_epoch THEN RETURN QUERY SELECT 'FENCED'::text, NULL::timestamptz; RETURN; END IF;
  IF v_call.state = 'RECONNECTING' THEN RETURN QUERY SELECT 'SUSPENDED'::text, v_call.grace_until; RETURN; END IF;
  IF v_call.state = 'CONNECTING' THEN
    PERFORM voice_private.end_call_v1(p_call_id, 'FAILED', 'WRITER');
    RETURN QUERY SELECT 'ENDED'::text, NULL::timestamptz; RETURN;
  END IF;
  v_until := clock_timestamp() + make_interval(secs => v_policy.reconnect_grace_seconds);
  UPDATE voice_private.calls c SET state = 'RECONNECTING', grace_until = v_until, seat_lease_until = v_until
   WHERE c.id = p_call_id;
  UPDATE voice_private.recordings r SET writer_lease_until = greatest(r.writer_lease_until, v_until)
   WHERE r.call_id = p_call_id AND r.recording_state = 'RECORDING';
  RETURN QUERY SELECT 'SUSPENDED'::text, v_until;
END$$;

-- A resume: the same call id continues inside the grace (voice-runtime-v1.md §3), only from the client instance that began
-- it (D-05-01: no transfer between devices). The epoch moves on, so every older connection is fenced. After the grace the
-- call ends PEER_LOST_AFTER_GRACE here; a resume never begins a new call.
CREATE FUNCTION public.server_resume_call_v1(p_user_id uuid, p_call_id uuid, p_client_instance_id uuid)
RETURNS TABLE (outcome text, call_state text, connection_epoch bigint, started_at timestamptz, recording_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_policy voice_private.live_call_policy := voice_private.live_call_policy_v1();
  v_call voice_private.calls;
  v_now timestamptz := clock_timestamp();
  v_until timestamptz;
  v_grace interval;
BEGIN
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_client_instance_id IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_call FROM voice_private.calls c WHERE c.id = p_call_id AND c.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::text, NULL::bigint, NULL::timestamptz, NULL::uuid; RETURN; END IF;
  IF v_call.state = 'ENDED' THEN
    RETURN QUERY SELECT 'ENDED'::text, v_call.end_reason, NULL::bigint, NULL::timestamptz, NULL::uuid; RETURN;
  END IF;
  IF v_call.client_instance_id <> p_client_instance_id THEN
    RETURN QUERY SELECT 'OTHER_DEVICE'::text, NULL::text, NULL::bigint, NULL::timestamptz, NULL::uuid; RETURN;
  END IF;
  v_grace := make_interval(secs => v_policy.reconnect_grace_seconds);
  IF v_call.state = 'RECONNECTING' AND v_call.grace_until <= v_now THEN
    PERFORM voice_private.end_call_v1(p_call_id, 'PEER_LOST_AFTER_GRACE', 'RECOVERY');
    RETURN QUERY SELECT 'ENDED'::text, 'PEER_LOST_AFTER_GRACE'::text, NULL::bigint, NULL::timestamptz, NULL::uuid; RETURN;
  ELSIF v_call.state = 'ACTIVE' AND v_call.seat_lease_until + v_grace <= v_now THEN
    PERFORM voice_private.end_call_v1(p_call_id, 'SYSTEM_INTERRUPTED', 'RECOVERY');
    RETURN QUERY SELECT 'ENDED'::text, 'SYSTEM_INTERRUPTED'::text, NULL::bigint, NULL::timestamptz, NULL::uuid; RETURN;
  ELSIF v_call.state = 'CONNECTING' AND (v_call.connect_deadline <= v_now OR v_call.seat_lease_until <= v_now) THEN
    PERFORM voice_private.end_call_v1(p_call_id, 'FAILED', 'RECOVERY');
    RETURN QUERY SELECT 'ENDED'::text, 'FAILED'::text, NULL::bigint, NULL::timestamptz, NULL::uuid; RETURN;
  END IF;
  v_until := v_now + make_interval(secs => v_policy.seat_lease_seconds);
  UPDATE voice_private.calls c
     SET state = CASE WHEN c.state = 'CONNECTING' THEN 'CONNECTING' ELSE 'ACTIVE' END, grace_until = NULL,
         connection_epoch = c.connection_epoch + 1, seat_lease_until = v_until
   WHERE c.id = p_call_id
  RETURNING * INTO v_call;
  UPDATE voice_private.recordings r SET writer_lease_until = greatest(r.writer_lease_until, v_until)
   WHERE r.call_id = p_call_id AND r.recording_state = 'RECORDING';
  RETURN QUERY SELECT 'RESUMED'::text, v_call.state, v_call.connection_epoch, v_call.started_at,
                      (SELECT r.id FROM voice_private.recordings r WHERE r.call_id = p_call_id);
END$$;

-- The connection ends its call: the person's END (USER_ENDED), a failure before ACTIVE (FAILED), or the server's own end
-- (SERVER_ENDED). The recovery reasons (PEER_LOST_AFTER_GRACE, SYSTEM_INTERRUPTED) belong to the authority alone. An
-- ENDED call answers its one reason: a call ends once.
CREATE FUNCTION public.server_end_call_v1(p_user_id uuid, p_call_id uuid, p_connection_epoch bigint, p_end_reason text)
RETURNS TABLE (outcome text, end_reason text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_call voice_private.calls;
BEGIN
  IF p_user_id IS NULL OR p_call_id IS NULL OR p_connection_epoch IS NULL OR p_end_reason IS NULL
     OR p_end_reason NOT IN ('USER_ENDED', 'FAILED', 'SERVER_ENDED') THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_call FROM voice_private.calls c WHERE c.id = p_call_id AND c.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::text; RETURN; END IF;
  IF v_call.state = 'ENDED' THEN RETURN QUERY SELECT 'ALREADY_ENDED'::text, v_call.end_reason; RETURN; END IF;
  IF v_call.connection_epoch <> p_connection_epoch THEN RETURN QUERY SELECT 'FENCED'::text, NULL::text; RETURN; END IF;
  PERFORM voice_private.end_call_v1(p_call_id, p_end_reason, 'WRITER');
  RETURN QUERY SELECT 'ENDED'::text, p_end_reason;
END$$;

-- The one recovery authority of a call (SKIP LOCKED: a call a connection holds is visited next time): a CONNECTING call
-- past its deadline or seat ends FAILED; an ACTIVE call whose server stopped renewing it ends SYSTEM_INTERRUPTED once the
-- grace has also passed; a RECONNECTING call past its grace ends PEER_LOST_AFTER_GRACE; an ACTIVE call past its maximum
-- length ends SERVER_ENDED. Each recording is sealed RECOVERY in the same transaction.
CREATE FUNCTION public.server_sweep_calls_v1(p_limit integer)
RETURNS TABLE (ended integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_policy voice_private.live_call_policy := voice_private.live_call_policy_v1();
  v_call voice_private.calls;
  v_now timestamptz := clock_timestamp();
  v_grace interval;
  v_count integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  v_grace := make_interval(secs => v_policy.reconnect_grace_seconds);
  FOR v_call IN
    SELECT * FROM voice_private.calls c
     WHERE c.state <> 'ENDED'
       AND ((c.state = 'CONNECTING' AND (c.connect_deadline <= v_now OR c.seat_lease_until <= v_now))
            OR (c.state = 'ACTIVE' AND (c.seat_lease_until + v_grace <= v_now
                                        OR c.started_at + make_interval(secs => v_policy.max_call_seconds) <= v_now))
            OR (c.state = 'RECONNECTING' AND c.grace_until <= v_now))
     ORDER BY c.created_at, c.id
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM voice_private.end_call_v1(v_call.id,
      CASE WHEN v_call.state = 'CONNECTING' THEN 'FAILED'
           WHEN v_call.state = 'RECONNECTING' THEN 'PEER_LOST_AFTER_GRACE'
           WHEN v_call.seat_lease_until + v_grace <= v_now THEN 'SYSTEM_INTERRUPTED'
           ELSE 'SERVER_ENDED' END, 'RECOVERY');
    v_count := v_count + 1;
  END LOOP;
  RETURN QUERY SELECT v_count;
END$$;

-- call-truth (voice-runtime-v1.md §3): ACTIVE while the person's call is CONNECTING / ACTIVE / RECONNECTING and still held;
-- NO_CALL_KNOWN otherwise (failing safe: a lapsed call the sweep has not ended yet is not reported live).
CREATE FUNCTION public.server_read_call_truth_v1(p_user_id uuid)
RETURNS TABLE (call_truth text, call_id uuid, call_state text, started_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_call voice_private.calls;
  v_grace interval := make_interval(secs => (voice_private.live_call_policy_v1()).reconnect_grace_seconds);
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_call FROM voice_private.calls c WHERE c.user_id = p_user_id AND c.state <> 'ENDED';
  IF FOUND AND (CASE v_call.state WHEN 'CONNECTING' THEN v_call.seat_lease_until > v_now AND v_call.connect_deadline > v_now
                                 WHEN 'ACTIVE' THEN v_call.seat_lease_until + v_grace > v_now
                                 ELSE v_call.grace_until > v_now END) THEN
    RETURN QUERY SELECT 'ACTIVE'::text, v_call.id, v_call.state, v_call.started_at;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'NO_CALL_KNOWN'::text, NULL::uuid, NULL::text, NULL::timestamptz;
END$$;

-- The reference number of a call's next turn (CA-05-01 R1: structural order, never a timestamp). Reserved only by the
-- connection holding the current epoch of an ACTIVE call; unique and increasing per call. CP2's turn commit calls it in
-- its own transaction; no role executes it.
CREATE FUNCTION voice_private.reserve_call_turn_index_v1(p_user_id uuid, p_call_id uuid, p_connection_epoch bigint)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_call voice_private.calls;
BEGIN
  SELECT * INTO v_call FROM voice_private.calls c WHERE c.id = p_call_id AND c.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_call.state <> 'ACTIVE' THEN
    RAISE EXCEPTION 'LIVE_CALL_NOT_ACTIVE' USING ERRCODE = '55000';
  END IF;
  IF v_call.connection_epoch <> p_connection_epoch THEN
    RAISE EXCEPTION 'LIVE_CALL_FENCED' USING ERRCODE = '55000';
  END IF;
  UPDATE voice_private.calls c SET next_call_turn_index = c.next_call_turn_index + 1 WHERE c.id = p_call_id;
  RETURN v_call.next_call_turn_index;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. CA-05-04: THE CALL-RECORDING CORRECTIONS (forward-replaced 0183 definers, same signatures).
-- ---------------------------------------------------------------------------------------------------------------------
-- The open is now the call authority's: only for its ACTIVE call, with the call's own session and started_at, the call row
-- locked first (a duplicate open waits for it, never a raw 23505). A recording that is no longer being written is never
-- answered OPENED. Gate and consent are re-checked for a new recording as before.
CREATE OR REPLACE FUNCTION public.server_open_call_recording_v1(p_user_id uuid, p_session_id uuid, p_call_id uuid,
                                                               p_started_at timestamptz, p_lease_seconds integer)
RETURNS TABLE (outcome text, recording_id uuid, retention_expires_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_call voice_private.calls;
  v_existing voice_private.recordings;
  v_recording uuid;
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL OR p_call_id IS NULL OR p_started_at IS NULL
     OR p_started_at > clock_timestamp() OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 5 AND 120 THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_call FROM voice_private.calls c WHERE c.id = p_call_id FOR UPDATE;
  IF NOT FOUND OR v_call.user_id <> p_user_id THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;
  SELECT * INTO v_existing FROM voice_private.recordings r WHERE r.call_id = p_call_id;
  IF FOUND THEN
    RETURN QUERY SELECT CASE WHEN v_existing.session_id <> p_session_id OR v_existing.started_at <> p_started_at THEN 'COMMAND_CONFLICT'
                             WHEN v_existing.recording_state = 'RECORDING' THEN 'OPENED'
                             ELSE 'RECORDING_CLOSED' END,
                        v_existing.id, v_existing.retention_expires_at;
    RETURN;
  END IF;
  IF v_call.state <> 'ACTIVE' OR v_call.session_id <> p_session_id OR v_call.started_at IS DISTINCT FROM p_started_at THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;
  IF NOT voice_private.capability_enabled_v1('PERSONAL_LIVE_CALL') THEN
    RETURN QUERY SELECT 'NOT_AVAILABLE_NOW'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;
  IF voice_private.consent_state_v1(p_user_id) <> 'GRANTED_CURRENT' THEN
    RETURN QUERY SELECT 'CONSENT_REQUIRED'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;
  v_recording := gen_random_uuid();
  INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, call_id, started_at, retention_expires_at,
                                        recording_state, writer_lease_until)
  VALUES (v_recording, p_user_id, p_session_id, 'LIVE_CALL', p_call_id, p_started_at, p_started_at + interval '30 days',
          'RECORDING', clock_timestamp() + make_interval(secs => p_lease_seconds));
  RETURN QUERY SELECT 'OPENED'::text, v_recording, p_started_at + interval '30 days';
END$$;

-- A gap where the track's clock ends: RECONNECTION or MUTED on either track, NOT_SPEAKING on the QANDEEL track only.
-- WRITER_LOSS is still written only by a seal.
CREATE OR REPLACE FUNCTION public.server_record_call_gap_v1(p_user_id uuid, p_recording_id uuid, p_track text,
                                                           p_clock_start_ms bigint, p_clock_end_ms bigint, p_gap_kind text)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS NULL OR p_recording_id IS NULL OR p_track IS NULL OR p_track NOT IN ('USER', 'QANDEEL')
     OR p_clock_start_ms IS NULL OR p_clock_end_ms IS NULL OR p_clock_start_ms < 0 OR p_clock_end_ms <= p_clock_start_ms
     OR p_gap_kind IS NULL OR p_gap_kind NOT IN ('RECONNECTION', 'MUTED', 'NOT_SPEAKING')
     OR (p_gap_kind = 'NOT_SPEAKING' AND p_track <> 'QANDEEL') THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM voice_private.recordings r
   WHERE r.id = p_recording_id AND r.user_id = p_user_id AND r.recording_state = 'RECORDING' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  IF voice_private.recording_expired_v1(p_recording_id) THEN
    RETURN QUERY SELECT 'EXPIRED'::text;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM voice_private.recording_gaps g
              WHERE g.recording_id = p_recording_id AND g.track = p_track AND g.clock_start_ms = p_clock_start_ms
                AND g.clock_end_ms = p_clock_end_ms AND g.gap_kind = p_gap_kind) THEN
    RETURN QUERY SELECT 'RECORDED'::text;
    RETURN;
  END IF;
  IF p_clock_start_ms <> voice_private.track_clock_end_v1(p_recording_id, p_track) THEN
    RETURN QUERY SELECT 'DISCONTINUOUS'::text;
    RETURN;
  END IF;
  INSERT INTO voice_private.recording_gaps (recording_id, track, clock_start_ms, clock_end_ms, gap_kind)
  VALUES (p_recording_id, p_track, p_clock_start_ms, p_clock_end_ms, p_gap_kind);
  RETURN QUERY SELECT 'RECORDED'::text;
END$$;

-- The writer's own seal: never the recording of a call that has not ENDED (CALL_LIVE). A fenced connection, or an
-- instance that lost its call, cannot close a live call's recording; the call's end seals it. Otherwise as 0183.
CREATE OR REPLACE FUNCTION public.server_seal_call_recording_v1(p_user_id uuid, p_recording_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_recording voice_private.recordings;
BEGIN
  IF p_user_id IS NULL OR p_recording_id IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_recording FROM voice_private.recordings r
   WHERE r.id = p_recording_id AND r.user_id = p_user_id AND r.recording_kind = 'LIVE_CALL' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  IF v_recording.recording_state = 'STORED' THEN
    RETURN QUERY SELECT 'SEALED'::text;
    RETURN;
  END IF;
  IF v_recording.recording_state <> 'RECORDING' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM voice_private.calls c WHERE c.id = v_recording.call_id AND c.state <> 'ENDED') THEN
    RETURN QUERY SELECT 'CALL_LIVE'::text;
    RETURN;
  END IF;
  PERFORM voice_private.seal_call_recording_v1(p_recording_id, 'WRITER');
  RETURN QUERY SELECT 'SEALED'::text;
END$$;

-- Recovery of a stale writer: never the recording of a call that has not ENDED (the call authority alone ends a call and
-- seals its recording in the same transaction; a reconnecting call's recording is kept). Otherwise as 0183.
CREATE OR REPLACE FUNCTION public.server_recover_stale_call_recordings_v1(p_limit integer, p_grace_seconds integer)
RETURNS TABLE (recovered integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id uuid;
  v_count integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 OR p_grace_seconds IS NULL OR p_grace_seconds NOT BETWEEN 0 AND 3600 THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  FOR v_id IN
    SELECT r.id FROM voice_private.recordings r
     WHERE r.recording_state = 'RECORDING'
       AND r.writer_lease_until + make_interval(secs => p_grace_seconds) < clock_timestamp()
       AND NOT EXISTS (SELECT 1 FROM voice_private.calls c WHERE c.id = r.call_id AND c.state <> 'ENDED')
     ORDER BY r.writer_lease_until, r.id
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM voice_private.seal_call_recording_v1(v_id, 'RECOVERY');
    v_count := v_count + 1;
  END LOOP;
  RETURN QUERY SELECT v_count;
END$$;

-- A turn's voice source: as 0183, and a live call's anchor must lie inside its track's recorded or gapped range (the USER
-- track for a USER turn, the QANDEEL track for an ASSISTANT turn): an anchor never points past what the track holds.
CREATE OR REPLACE FUNCTION public.server_attach_turn_voice_source_v1(
  p_user_id uuid, p_turn_id uuid, p_recording_id uuid, p_source_modality text, p_transcript_origin text,
  p_asr_confidence_band text, p_anchor_start_ms bigint, p_anchor_end_ms bigint, p_spoken boolean, p_delivery_state text
) RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_turn public.conversation_turns;
  v_recording voice_private.recordings;
  v_existing public.conversation_turn_voice_sources;
BEGIN
  IF p_user_id IS NULL OR p_turn_id IS NULL OR p_recording_id IS NULL OR p_source_modality IS NULL
     OR p_anchor_start_ms IS NULL OR p_anchor_end_ms IS NULL OR p_anchor_start_ms < 0
     OR p_anchor_end_ms <= p_anchor_start_ms THEN
    RAISE EXCEPTION 'VOICE_SOURCE_INVALID' USING ERRCODE = '22023';
  END IF;
  -- The turn lock the producer takes: attach and commit are ordered.
  SELECT * INTO v_turn FROM public.conversation_turns t WHERE t.id = p_turn_id AND t.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VOICE_SOURCE_NOT_AVAILABLE' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_existing FROM public.conversation_turn_voice_sources vs WHERE vs.turn_id = p_turn_id;
  IF FOUND THEN
    IF v_existing.recording_id = p_recording_id AND v_existing.source_modality = p_source_modality
       AND v_existing.transcript_origin IS NOT DISTINCT FROM p_transcript_origin
       AND v_existing.asr_confidence_band IS NOT DISTINCT FROM p_asr_confidence_band
       AND v_existing.anchor_start_ms = p_anchor_start_ms AND v_existing.anchor_end_ms = p_anchor_end_ms
       AND v_existing.spoken IS NOT DISTINCT FROM p_spoken
       AND v_existing.delivery_state IS NOT DISTINCT FROM p_delivery_state THEN
      RETURN QUERY SELECT 'ALREADY_ATTACHED'::text;
      RETURN;
    END IF;
    RAISE EXCEPTION 'VOICE_SOURCE_ALREADY_ATTACHED' USING ERRCODE = '55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.conversation_units cu WHERE cu.source_turn_id = p_turn_id) THEN
    RAISE EXCEPTION 'VOICE_SOURCE_TURN_COMMITTED' USING ERRCODE = '55000',
      DETAIL = 'A turn''s voice source is written before its units; committed truth is never relabelled.';
  END IF;
  SELECT * INTO v_recording FROM voice_private.recordings r WHERE r.id = p_recording_id FOR SHARE;
  IF NOT FOUND OR v_recording.user_id <> p_user_id OR v_recording.session_id <> v_turn.session_id
     OR v_recording.recording_state NOT IN ('STORED', 'RECORDING') THEN
    RAISE EXCEPTION 'VOICE_SOURCE_NOT_AVAILABLE' USING ERRCODE = 'P0002';
  END IF;
  IF (p_source_modality = 'VOICE_NOTE') IS DISTINCT FROM (v_recording.recording_kind = 'VOICE_NOTE')
     OR v_turn.role NOT IN ('USER', 'ASSISTANT') THEN
    RAISE EXCEPTION 'VOICE_SOURCE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_recording.recording_kind = 'LIVE_CALL'
     AND p_anchor_end_ms > voice_private.track_clock_end_v1(p_recording_id,
                                                            CASE WHEN v_turn.role = 'USER' THEN 'USER' ELSE 'QANDEEL' END) THEN
    RAISE EXCEPTION 'VOICE_SOURCE_INVALID' USING ERRCODE = '22023',
      DETAIL = 'A live call anchor lies inside its track''s recorded or gapped range.';
  END IF;
  BEGIN
    INSERT INTO public.conversation_turn_voice_sources
      (turn_id, user_id, session_id, source_role, source_modality, transcript_origin, asr_confidence_band, recording_id,
       anchor_start_ms, anchor_end_ms, spoken, delivery_state)
    VALUES (p_turn_id, p_user_id, v_turn.session_id, v_turn.role, p_source_modality, p_transcript_origin,
            p_asr_confidence_band, p_recording_id, p_anchor_start_ms, p_anchor_end_ms, p_spoken, p_delivery_state);
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'VOICE_SOURCE_INVALID' USING ERRCODE = '22023';
  END;
  RETURN QUERY SELECT 'ATTACHED'::text;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. ACCOUNT ERASURE COVERAGE.
-- ---------------------------------------------------------------------------------------------------------------------
-- The call record leaves with the account row (ACCOUNT_CASCADE); its recording is the voice module's (VOICE, deleted
-- first by 0183's erase_voice_v1, so the recordings -> calls key never blocks the cascade).
INSERT INTO account_erasure_private.coverage_registry (relation, coverage) VALUES
    ('voice_private.calls', 'ACCOUNT_CASCADE');

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. OWNERSHIP, RLS AND ACL.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  rel text;
  fn text;
  r text;
BEGIN
  FOREACH rel IN ARRAY ARRAY['voice_private.live_call_policy', 'voice_private.calls'] LOOP
    EXECUTE format('ALTER TABLE %s OWNER TO postgres', rel);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', rel);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC', rel);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON TABLE %s FROM %I', rel, r); END IF;
    END LOOP;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY[
    'voice_private.live_call_policy_v1()',
    'voice_private.set_live_call_policy_v1(integer,integer,integer,integer,integer,text,text)',
    'voice_private.guard_call_v1()',
    'voice_private.realtime_seats_in_use_v1()',
    'voice_private.admit_live_voice_note_seat_v1()',
    'voice_private.end_call_v1(uuid,text,text)',
    'voice_private.reserve_call_turn_index_v1(uuid,uuid,bigint)',
    'public.server_begin_call_v1(uuid,uuid,uuid,uuid)',
    'public.server_activate_call_v1(uuid,uuid,bigint)',
    'public.server_heartbeat_call_v1(uuid,uuid,bigint)',
    'public.server_suspend_call_v1(uuid,uuid,bigint)',
    'public.server_resume_call_v1(uuid,uuid,uuid)',
    'public.server_end_call_v1(uuid,uuid,bigint,text)',
    'public.server_sweep_calls_v1(integer)',
    'public.server_read_call_truth_v1(uuid)',
    'public.server_open_call_recording_v1(uuid,uuid,uuid,timestamptz,integer)',
    'public.server_record_call_gap_v1(uuid,uuid,text,bigint,bigint,text)',
    'public.server_seal_call_recording_v1(uuid,uuid)',
    'public.server_recover_stale_call_recordings_v1(integer,integer)',
    'public.server_attach_turn_voice_source_v1(uuid,uuid,uuid,text,text,text,bigint,bigint,boolean,text)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r); END IF;
    END LOOP;
    IF fn LIKE 'public.server\_%' AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. DEPLOY GUARD.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
BEGIN
  IF (SELECT count(*) FROM voice_private.voice_launch_capability_states s
       WHERE s.feature_flag_state = 'DISABLED' AND s.launch_requirements_state = 'UNSATISFIED') <> 4 THEN
    RAISE EXCEPTION 'S8B-05 CP1: every voice capability scope must remain DISABLED / UNSATISFIED';
  END IF;
  IF (SELECT count(*) FROM voice_private.live_call_policy) <> 1
     OR (SELECT p.reconnect_grace_seconds FROM voice_private.live_call_policy p) <> 30
     OR (SELECT p.max_call_seconds FROM voice_private.live_call_policy p) <> 3600 THEN
    RAISE EXCEPTION 'S8B-05 CP1: the call policy must hold the approved 30 s grace and 60-minute call';
  END IF;
  SELECT count(*) INTO v_count FROM pg_constraint c
   WHERE c.contype = 'f'
     AND (c.confrelid = 'public.users'::regclass
          OR c.confrelid::regclass::text IN (SELECT g.relation FROM account_erasure_private.coverage_registry g WHERE g.coverage = 'VOICE'))
     AND c.conrelid::regclass::text NOT IN (SELECT g.relation FROM account_erasure_private.coverage_registry g);
  IF v_count <> 0 THEN RAISE EXCEPTION 'S8B-05 CP1: a relation referencing the account or a voice relation is unregistered'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants g
              WHERE g.table_schema = 'voice_private' AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC'))
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public' AND (p.proname LIKE 'server\_%call%')
                   AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))) THEN
    RAISE EXCEPTION 'S8B-05 CP1: a voice relation or a call definer is reachable by a client role';
  END IF;
END$$;

COMMIT;
