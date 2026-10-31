-- S8B-03 CP1 — Personal Voice Notes, server and intelligence: the durable transcription state of a Voice Note and its
-- provider attempts, the replay of an accepted upload, the ONE atomic voice turn, the first consent text, and the governed
-- brain amendment that lets a machine transcript of the user's voice be understood as well as typed text, without ever
-- being treated as typed text.
--
-- Product authority: the Product Owner's approval of the S8B-03 WP0 Research and Implementation Contract v1.2 FINAL
-- (2026-10-31: D1 .. D5, OD-1 .. OD-10, E1 .. E13, this migration, the CP1 / CP2 split, A1 .. A27 + A6b) and its Copy Gate
-- rows C-01 .. C-12, C-54 .. C-57 and M-01 .. M-03, APPROVED verbatim. The controlled amendment is
-- docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8B-03_MACHINE_ASR_FRESH_EVIDENCE_CONTROLLED_AMENDMENT_v1.0.md;
-- the implementation record is docs/e2e/QANDEEL_S8B_03_PERSONAL_VOICE_NOTES_IMPLEMENTATION_RECORD_v1.md.
--
-- ## What is added
--
--   A. voice_private.note_transcriptions (one row per accepted note) and voice_private.note_transcription_attempts (one
--      row per provider call; attempt_id is the ledger call id). The worker claims notes straight from the recordings,
--      resumes from the last durable step after a crash, never resubmits blindly after an unknown outcome, and records the
--      first deletion outcome of every known provider job before a note leaves processing (§4.6, §4.8).
--   B. server_begin_voice_note_upload_v1 answers ALREADY_ACCEPTED to a replay of an accepted note, signature unchanged
--      (§5.2). server_commit_voice_note_turn_v1 creates the user turn and its voice source in ONE transaction, under the
--      same admission bound as a typed turn (§4.4).
--   C. The first consent text, VOICE_RECORDING_V1 (C-01 .. C-11, APPROVED). Every gate stays DISABLED.
--   D. The brain (§5.4): MACHINE_ASR in L2 and L1 (E1, E2); the deterministic writer, Memory control and Open Understanding
--      score a voice Memory with the band's constant exactly (E13); spoken Memory commands by band (E8, NOT_HEARD_CLEARLY);
--      Open Understanding v4 with the operation table by band, person labels refused on uncertain words, and typed
--      confirmations (E6, E9, E11); v3 becomes v4 with nothing confirmed; the known-Memories read v2 carries the source.
--   E. memory_typed_confirmations: a typed confirmation of a MACHINE_ASR Memory, recorded beside it. It never changes the
--      Memory's source, score or words (OD-2).
--   F. The voice module of the account erasure removes the transcription state (§4.6 rule 10).
--
-- ## What is deliberately NOT here
--
--   * No gate is opened; no client role executes any new definer; nothing is applied to a hosted database by this change.
--   * No USER_CONFIRMED writer; no source promotion; no transcript_origin column on Memory; Matching (0154), Shared (0176)
--     and the Public text paths still exclude MACHINE_ASR.
--   * server_attach_turn_voice_source_v1 and create_user_conversation_turn are unchanged (the call is S8B-05's).
--   * Every earlier migration stays byte-identical. Every forward-replaced or derived function is its origin statement
--     verbatim with the exact edits declared in database/voice-notes-0186-substitutions.mjs; verify-migration-0186
--     re-derives each one.

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. CONTROLLED CONSTANTS.
-- ---------------------------------------------------------------------------------------------------------------------
-- E13: a voice Memory's score is the band's constant, decided here and nowhere else (P-1's approved values; changing one
-- is a migration). The server refuses to start when its P-1 configuration differs.
CREATE FUNCTION voice_private.machine_asr_memory_confidence_v1(p_band text) RETURNS double precision
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT CASE p_band WHEN 'HIGH' THEN 0.90::double precision WHEN 'MEDIUM' THEN 0.75::double precision END
$$;

-- §4.6 rule 6 / rule 5 / §4.6.2: the attempt bounds, the unknown-outcome quarantine and the duration limit.
CREATE FUNCTION voice_private.transcription_policy_v1(
  OUT automatic_attempts integer, OUT total_attempts integer, OUT unknown_quarantine interval,
  OUT duration_limit_ms bigint, OUT deletion_horizon interval, OUT transcript_limit integer, OUT uncertain_limit integer
) LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT 3, 5, interval '30 minutes', 601000::bigint, interval '7 days', 20000, 64
$$;

-- Whether a failure class is transient (an automatic attempt may follow) - decided by the class, never by the caller.
CREATE FUNCTION voice_private.transcription_failure_is_transient_v1(p_failure_class text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT p_failure_class IN ('PROVIDER_RATE_LIMITED', 'PROVIDER_UNAVAILABLE', 'PROVIDER_TIMEOUT', 'PROVIDER_NETWORK',
                             'POLL_TIMEOUT', 'NOT_CREATED', 'STORAGE_UNAVAILABLE')
$$;

-- §4.8 step 4: the deletion schedule, from the nth attempt: 1 min, 5 min, 30 min, 2 h, 6 h, then every 12 h.
CREATE FUNCTION voice_private.provider_deletion_delay_v1(p_attempts integer) RETURNS interval
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT CASE WHEN p_attempts <= 1 THEN interval '1 minute' WHEN p_attempts = 2 THEN interval '5 minutes'
              WHEN p_attempts = 3 THEN interval '30 minutes' WHEN p_attempts = 4 THEN interval '2 hours'
              WHEN p_attempts = 5 THEN interval '6 hours' ELSE interval '12 hours' END
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. THE TRANSCRIPTION STATE (§4.6). RLS on, no policy, no role: only the definers below read or write it.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.note_transcriptions (
    recording_id uuid NOT NULL,
    user_id uuid NOT NULL,
    session_id uuid NOT NULL,
    state text NOT NULL,
    pending_outcome text,
    attempts_auto integer NOT NULL DEFAULT 0,
    attempts_total integer NOT NULL DEFAULT 0,
    next_attempt_by_user boolean NOT NULL DEFAULT false,
    next_attempt_at timestamptz,
    lease_owner text,
    lease_expires_at timestamptz,
    failure_class text,
    duration_ms bigint,
    transcript_text text,
    transcript_sha256 text,
    asr_confidence_band text,
    uncertain_tokens text[] NOT NULL DEFAULT '{}',
    committed_turn_id uuid,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT note_transcriptions_pk PRIMARY KEY (recording_id),
    CONSTRAINT note_transcriptions_recording_fk
        FOREIGN KEY (recording_id) REFERENCES voice_private.recordings (id) ON DELETE RESTRICT,
    CONSTRAINT note_transcriptions_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT note_transcriptions_committed_turn_key UNIQUE (committed_turn_id),
    CONSTRAINT note_transcriptions_state_check CHECK (state IN ('PENDING', 'IN_PROGRESS', 'DELETION_PENDING', 'READY',
        'NO_SPEECH', 'HELD_CONSENT', 'FAILED_RETRYABLE', 'FAILED_FINAL', 'CANCELLED', 'COMMITTED')),
    -- A note leaves processing only after the first deletion outcome of every known job: DELETION_PENDING carries the
    -- state it then reaches.
    CONSTRAINT note_transcriptions_pending_outcome_check CHECK (
        (state = 'DELETION_PENDING') = (pending_outcome IS NOT NULL)
        AND (pending_outcome IS NULL OR pending_outcome IN ('READY', 'NO_SPEECH', 'PENDING', 'HELD_CONSENT', 'FAILED_RETRYABLE',
                                                            'FAILED_FINAL', 'CANCELLED'))),
    CONSTRAINT note_transcriptions_attempts_check
        CHECK (attempts_auto >= 0 AND attempts_total >= attempts_auto AND attempts_total <= 5),
    CONSTRAINT note_transcriptions_lease_check CHECK ((lease_owner IS NULL) = (lease_expires_at IS NULL)
        AND (lease_owner IS NULL OR length(lease_owner) BETWEEN 1 AND 128)),
    CONSTRAINT note_transcriptions_failure_check CHECK (failure_class IS NULL OR failure_class ~ '^[A-Z][A-Z_]{2,63}$'),
    CONSTRAINT note_transcriptions_duration_check CHECK (duration_ms IS NULL OR duration_ms BETWEEN 1 AND 601000),
    -- The text exists only while it is about to be committed, never after (it then lives in the turn).
    CONSTRAINT note_transcriptions_text_check CHECK (
        (transcript_text IS NULL OR (state IN ('DELETION_PENDING', 'READY') AND length(transcript_text) BETWEEN 1 AND 20000))
        AND ((transcript_text IS NULL) OR (transcript_sha256 IS NOT NULL AND asr_confidence_band IS NOT NULL))),
    CONSTRAINT note_transcriptions_digest_check CHECK (transcript_sha256 IS NULL OR transcript_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT note_transcriptions_band_check
        CHECK (asr_confidence_band IS NULL OR asr_confidence_band IN ('HIGH', 'MEDIUM', 'LOW')),
    CONSTRAINT note_transcriptions_ready_check CHECK (state <> 'READY' OR transcript_text IS NOT NULL),
    CONSTRAINT note_transcriptions_committed_check CHECK ((state = 'COMMITTED') = (committed_turn_id IS NOT NULL)),
    CONSTRAINT note_transcriptions_uncertain_check CHECK (cardinality(uncertain_tokens) <= 64
        AND array_position(uncertain_tokens, NULL) IS NULL)
);
CREATE INDEX note_transcriptions_user_idx ON voice_private.note_transcriptions (user_id);
CREATE INDEX note_transcriptions_session_idx ON voice_private.note_transcriptions (session_id, user_id);
CREATE INDEX note_transcriptions_claim_idx ON voice_private.note_transcriptions (state, next_attempt_at)
    WHERE state IN ('PENDING', 'IN_PROGRESS', 'DELETION_PENDING', 'HELD_CONSENT');

CREATE TABLE voice_private.note_transcription_attempts (
    attempt_id uuid NOT NULL,
    recording_id uuid NOT NULL,
    user_id uuid NOT NULL,
    ordinal integer NOT NULL,
    by_user boolean NOT NULL,
    attempt_state text NOT NULL,
    provider_job_id text,
    failure_class text,
    provider_duration_disagreement boolean NOT NULL DEFAULT false,
    started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    submitted_at timestamptz,
    unknown_since timestamptz,
    settled_at timestamptz,
    provider_deletion_state text NOT NULL,
    deletion_attempts integer NOT NULL DEFAULT 0,
    first_deletion_outcome_at timestamptz,
    next_deletion_at timestamptz,
    deletion_confirmed_at timestamptz,
    CONSTRAINT note_transcription_attempts_pk PRIMARY KEY (attempt_id),
    CONSTRAINT note_transcription_attempts_note_fk
        FOREIGN KEY (recording_id) REFERENCES voice_private.note_transcriptions (recording_id) ON DELETE RESTRICT,
    CONSTRAINT note_transcription_attempts_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT note_transcription_attempts_ordinal_key UNIQUE (recording_id, ordinal),
    CONSTRAINT note_transcription_attempts_ordinal_check CHECK (ordinal BETWEEN 1 AND 5),
    CONSTRAINT note_transcription_attempts_state_check CHECK (attempt_state IN
        ('SUBMITTING', 'SUBMITTED', 'OUTCOME_UNKNOWN', 'SUCCEEDED', 'FAILED', 'CANCELLED')),
    CONSTRAINT note_transcription_attempts_job_check CHECK (provider_job_id IS NULL
        OR (length(provider_job_id) BETWEEN 1 AND 128 AND provider_job_id ~ '^[A-Za-z0-9_-]+$')),
    CONSTRAINT note_transcription_attempts_job_state_check CHECK (
        (attempt_state IN ('SUBMITTED', 'SUCCEEDED') AND provider_job_id IS NOT NULL)
     OR (attempt_state IN ('SUBMITTING', 'OUTCOME_UNKNOWN') AND provider_job_id IS NULL)
     OR attempt_state IN ('FAILED', 'CANCELLED')),
    CONSTRAINT note_transcription_attempts_unknown_check
        CHECK ((attempt_state = 'OUTCOME_UNKNOWN') <= (unknown_since IS NOT NULL)),
    CONSTRAINT note_transcription_attempts_failure_check
        CHECK (failure_class IS NULL OR failure_class ~ '^[A-Z][A-Z_]{2,63}$'),
    CONSTRAINT note_transcription_attempts_deletion_state_check CHECK (provider_deletion_state IN
        ('NOT_APPLICABLE', 'PENDING', 'REQUESTED', 'PROVIDER_ABSENT', 'RETRYING', 'UNCONFIRMED', 'UNKNOWN_JOB')),
    -- A known job is always on the deletion path; a job never known is never "deleted".
    CONSTRAINT note_transcription_attempts_deletion_shape_check CHECK (
        (provider_job_id IS NOT NULL AND provider_deletion_state IN ('PENDING', 'REQUESTED', 'PROVIDER_ABSENT', 'RETRYING',
                                                                     'UNCONFIRMED'))
     OR (provider_job_id IS NULL AND provider_deletion_state IN ('PENDING', 'NOT_APPLICABLE', 'UNKNOWN_JOB'))),
    CONSTRAINT note_transcription_attempts_deletion_confirmed_check
        CHECK ((provider_deletion_state = 'PROVIDER_ABSENT') = (deletion_confirmed_at IS NOT NULL)),
    CONSTRAINT note_transcription_attempts_deletion_count_check CHECK (deletion_attempts >= 0)
);
CREATE INDEX note_transcription_attempts_user_idx ON voice_private.note_transcription_attempts (user_id);
CREATE UNIQUE INDEX note_transcription_attempts_one_active_idx ON voice_private.note_transcription_attempts (recording_id)
    WHERE attempt_state IN ('SUBMITTING', 'SUBMITTED', 'OUTCOME_UNKNOWN');
CREATE INDEX note_transcription_attempts_deletion_idx ON voice_private.note_transcription_attempts (next_deletion_at)
    WHERE provider_deletion_state IN ('PENDING', 'REQUESTED', 'RETRYING') AND provider_job_id IS NOT NULL;

-- The rows leave only with their account (the voice module); every other change is a definer's update.
CREATE FUNCTION voice_private.guard_note_transcription_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF voice_private.account_erasure_delete_v1() THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'VOICE_TRANSCRIPTION_IS_DURABLE' USING ERRCODE = '55000',
      DETAIL = 'A transcription record leaves only through the governed account erasure.';
  END IF;
  IF TG_TABLE_NAME = 'note_transcriptions' THEN
    IF NEW.recording_id IS DISTINCT FROM OLD.recording_id OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.session_id IS DISTINCT FROM OLD.session_id OR NEW.created_at IS DISTINCT FROM OLD.created_at
       -- The measured duration, the band and the digest are written once; a committed turn is never re-pointed.
       OR (OLD.duration_ms IS NOT NULL AND NEW.duration_ms IS DISTINCT FROM OLD.duration_ms)
       OR (OLD.transcript_sha256 IS NOT NULL AND NEW.transcript_sha256 IS DISTINCT FROM OLD.transcript_sha256)
       OR (OLD.asr_confidence_band IS NOT NULL AND NEW.asr_confidence_band IS DISTINCT FROM OLD.asr_confidence_band)
       OR (OLD.committed_turn_id IS NOT NULL AND NEW.committed_turn_id IS DISTINCT FROM OLD.committed_turn_id)
       OR (OLD.state IN ('COMMITTED', 'CANCELLED', 'FAILED_FINAL', 'NO_SPEECH') AND NEW.state IS DISTINCT FROM OLD.state)
       OR NEW.attempts_total < OLD.attempts_total OR NEW.attempts_auto < OLD.attempts_auto THEN
      RAISE EXCEPTION 'VOICE_TRANSCRIPTION_IS_DURABLE' USING ERRCODE = '55000',
        DETAIL = 'A transcription''s identity, measured duration, band, digest and terminal state are immutable.';
    END IF;
  ELSIF NEW.attempt_id IS DISTINCT FROM OLD.attempt_id OR NEW.recording_id IS DISTINCT FROM OLD.recording_id
        OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.ordinal IS DISTINCT FROM OLD.ordinal
        OR NEW.by_user IS DISTINCT FROM OLD.by_user OR NEW.started_at IS DISTINCT FROM OLD.started_at
        OR (OLD.provider_job_id IS NOT NULL AND NEW.provider_job_id IS DISTINCT FROM OLD.provider_job_id)
        OR (OLD.attempt_state IN ('SUCCEEDED', 'FAILED', 'CANCELLED') AND NEW.attempt_state IS DISTINCT FROM OLD.attempt_state
            AND NOT (OLD.attempt_state = 'CANCELLED' AND OLD.provider_job_id IS NULL AND NEW.provider_job_id IS NOT NULL))
        OR (OLD.provider_deletion_state IN ('PROVIDER_ABSENT', 'UNCONFIRMED', 'NOT_APPLICABLE', 'UNKNOWN_JOB')
            AND NEW.provider_deletion_state IS DISTINCT FROM OLD.provider_deletion_state
            AND NOT (OLD.provider_deletion_state IN ('NOT_APPLICABLE', 'UNKNOWN_JOB') AND NEW.provider_job_id IS NOT NULL
                     AND OLD.provider_job_id IS NULL))
        OR NEW.deletion_attempts < OLD.deletion_attempts
        OR (OLD.first_deletion_outcome_at IS NOT NULL AND NEW.first_deletion_outcome_at IS DISTINCT FROM OLD.first_deletion_outcome_at) THEN
    RAISE EXCEPTION 'VOICE_TRANSCRIPTION_IS_DURABLE' USING ERRCODE = '55000',
      DETAIL = 'An attempt''s identity and job are written once; a settled attempt and a final deletion state are final.';
  END IF;
  RETURN NEW;
END$$;
CREATE TRIGGER note_transcriptions_durable BEFORE UPDATE OR DELETE ON voice_private.note_transcriptions
    FOR EACH ROW EXECUTE FUNCTION voice_private.guard_note_transcription_v1();
CREATE TRIGGER note_transcription_attempts_durable BEFORE UPDATE OR DELETE ON voice_private.note_transcription_attempts
    FOR EACH ROW EXECUTE FUNCTION voice_private.guard_note_transcription_v1();

-- Whether every known job of a note has its first deletion outcome recorded (§4.8 step 2).
CREATE FUNCTION voice_private.note_first_deletions_recorded_v1(p_recording_id uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT NOT EXISTS (SELECT 1 FROM voice_private.note_transcription_attempts a
                      WHERE a.recording_id = p_recording_id AND a.provider_job_id IS NOT NULL
                        AND a.first_deletion_outcome_at IS NULL);
$$;

-- Move a note to `p_outcome`, through DELETION_PENDING while a known job still lacks its first deletion outcome. A note
-- whose recording is no longer readable never becomes READY: it is CANCELLED. The text is cleared on every state but
-- READY / DELETION_PENDING-towards-READY; the lease is released.
CREATE FUNCTION voice_private.settle_note_v1(p_recording_id uuid, p_outcome text, p_failure_class text) RETURNS text
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE
  v_outcome text := p_outcome;
  v_state text;
BEGIN
  IF v_outcome = 'READY' AND NOT EXISTS (
       SELECT 1 FROM voice_private.recordings r
        WHERE r.id = p_recording_id AND r.recording_state = 'STORED' AND clock_timestamp() < r.retention_expires_at) THEN
    v_outcome := 'CANCELLED';
  END IF;
  v_state := CASE WHEN voice_private.note_first_deletions_recorded_v1(p_recording_id) THEN v_outcome ELSE 'DELETION_PENDING' END;
  UPDATE voice_private.note_transcriptions n
     SET state = v_state,
         pending_outcome = CASE WHEN v_state = 'DELETION_PENDING' THEN v_outcome END,
         failure_class = coalesce(p_failure_class, CASE WHEN v_outcome IN ('READY', 'NO_SPEECH') THEN NULL ELSE n.failure_class END),
         transcript_text = CASE WHEN v_outcome = 'READY' THEN n.transcript_text END,
         lease_owner = NULL, lease_expires_at = NULL,
         next_attempt_at = CASE WHEN v_outcome = 'FAILED_RETRYABLE' THEN NULL ELSE n.next_attempt_at END,
         updated_at = clock_timestamp()
   WHERE n.recording_id = p_recording_id;
  RETURN v_state;
END$$;

-- §4.6 rule 9 / rule 10: a recording deleted, expired or discarded cancels its unfinished transcription and clears the
-- words heard below T_HIGH (and any text not yet committed). Known jobs stay on the deletion path.
CREATE FUNCTION voice_private.on_recording_terminal_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.recording_state IN ('DELETED', 'EXPIRED', 'DISCARDED') AND OLD.recording_state IS DISTINCT FROM NEW.recording_state THEN
    UPDATE voice_private.note_transcription_attempts a SET attempt_state = 'CANCELLED', settled_at = clock_timestamp()
     WHERE a.recording_id = NEW.id AND a.attempt_state = 'SUBMITTED';
    -- An unresolved submission of a note that will never be processed is closed: its job, if any, is unknown.
    UPDATE voice_private.note_transcription_attempts a
       SET attempt_state = 'FAILED', failure_class = 'UNCERTAIN_SUBMISSION', provider_deletion_state = 'UNKNOWN_JOB',
           settled_at = clock_timestamp()
     WHERE a.recording_id = NEW.id AND a.attempt_state = 'OUTCOME_UNKNOWN';
    UPDATE voice_private.note_transcriptions n SET uncertain_tokens = '{}', updated_at = clock_timestamp()
     WHERE n.recording_id = NEW.id AND cardinality(n.uncertain_tokens) > 0;
    IF EXISTS (SELECT 1 FROM voice_private.note_transcriptions n
                WHERE n.recording_id = NEW.id
                  AND n.state IN ('PENDING', 'IN_PROGRESS', 'DELETION_PENDING', 'READY', 'HELD_CONSENT', 'FAILED_RETRYABLE')) THEN
      PERFORM voice_private.settle_note_v1(NEW.id, 'CANCELLED', NULL);
    END IF;
  END IF;
  RETURN NULL;
END$$;
CREATE TRIGGER recordings_cancel_transcription AFTER UPDATE OF recording_state ON voice_private.recordings
    FOR EACH ROW EXECUTE FUNCTION voice_private.on_recording_terminal_v1();

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. THE TYPED CONFIRMATION OF A VOICE MEMORY (OD-2, E9). Owner read; written only through the definers. It leaves with
--    its Memory (CASCADE), so a correction, a forget or the erasure takes it along.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE public.memory_typed_confirmations (
    memory_id uuid NOT NULL,
    user_id uuid NOT NULL,
    source_turn_id uuid NOT NULL,
    basis text NOT NULL,
    command_id uuid,
    execution_id uuid,
    confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT memory_typed_confirmations_pk PRIMARY KEY (memory_id, source_turn_id),
    CONSTRAINT memory_typed_confirmations_memory_fk
        FOREIGN KEY (memory_id, user_id) REFERENCES public.memories (id, user_id) ON DELETE CASCADE,
    CONSTRAINT memory_typed_confirmations_basis_check CHECK (
        (basis = 'EXPLICIT_MEMORY_COMMAND' AND command_id IS NOT NULL AND execution_id IS NULL)
     OR (basis = 'MODEL_ASSISTED_CONFIRMATION' AND execution_id IS NOT NULL AND command_id IS NULL))
);
CREATE INDEX memory_typed_confirmations_user_idx ON public.memory_typed_confirmations (user_id, memory_id);
ALTER TABLE public.memory_typed_confirmations OWNER TO postgres;
ALTER TABLE public.memory_typed_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.memory_typed_confirmations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.memory_typed_confirmations TO authenticated, service_role;
CREATE POLICY memory_typed_confirmations_select_own ON public.memory_typed_confirmations
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE FUNCTION public.guard_memory_typed_confirmation_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'MEMORY_TYPED_CONFIRMATION_IS_IMMUTABLE' USING ERRCODE = '55000',
    DETAIL = 'A typed confirmation is never rewritten; it leaves only with its Memory.';
END$$;
CREATE TRIGGER memory_typed_confirmations_immutable BEFORE UPDATE ON public.memory_typed_confirmations
    FOR EACH ROW EXECUTE FUNCTION public.guard_memory_typed_confirmation_v1();

-- The ONE writer (internal). The Memory is the owner's, ACTIVE, unexpired and MACHINE_ASR; the confirming turn is the
-- owner's typed USER turn (no voice source). Idempotent per (Memory, turn). Answers whether the confirmation exists.
CREATE FUNCTION public.record_memory_typed_confirmation_v1(
  p_user_id uuid, p_memory_id uuid, p_source_turn_id uuid, p_basis text, p_command_id uuid, p_execution_id uuid
) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS NULL OR p_memory_id IS NULL OR p_source_turn_id IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.memories m
                  WHERE m.id = p_memory_id AND m.user_id = p_user_id AND m.status = 'ACTIVE' AND m.source = 'MACHINE_ASR'
                    AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP))
     OR NOT EXISTS (SELECT 1 FROM public.conversation_turns t
                     WHERE t.id = p_source_turn_id AND t.user_id = p_user_id AND t.role = 'USER')
     OR EXISTS (SELECT 1 FROM public.conversation_turn_voice_sources vs WHERE vs.turn_id = p_source_turn_id) THEN
    RETURN false;
  END IF;
  INSERT INTO public.memory_typed_confirmations (memory_id, user_id, source_turn_id, basis, command_id, execution_id)
  VALUES (p_memory_id, p_user_id, p_source_turn_id, p_basis, p_command_id, p_execution_id)
  ON CONFLICT ON CONSTRAINT memory_typed_confirmations_pk DO NOTHING;
  RETURN true;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. THE WORKER DEFINERS (service_role). The database owns every durable step; the worker owns only the sequence. A worker
--    holds a note through its lease; a crashed worker's lease expires and the next claim resumes from the last durable
--    step - never from the start, and never with a blind resubmission.
-- ---------------------------------------------------------------------------------------------------------------------

-- Claim up to p_limit notes. A STORED note with no transcription row is admitted here (no enqueue step can be lost). New
-- work needs the gate open and current consent (consent missing: HELD_CONSENT); a held note resumes when consent is
-- current again. A crashed worker's SUBMITTING attempt becomes OUTCOME_UNKNOWN (bytes may have left). An in-progress
-- note or a note awaiting its first deletion outcome is resumed whatever the gate says: its provider job already exists.
CREATE FUNCTION public.server_claim_voice_note_transcription_v1(p_worker text, p_lease_seconds integer, p_limit integer)
RETURNS TABLE (recording_id uuid, user_id uuid, session_id uuid, storage_key text, byte_size bigint, state text,
               duration_ms bigint, attempts_total integer, attempt_id uuid, attempt_state text, provider_job_id text,
               unknown_since timestamptz, submitted_at timestamptz, deletion_attempt_ids uuid[], deletion_job_ids text[])
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_gate boolean := voice_private.capability_enabled_v1('PERSONAL_VOICE_NOTE');
  v_note voice_private.note_transcriptions;
  v_recording voice_private.recordings;
  v_claimed integer := 0;
BEGIN
  IF p_worker IS NULL OR length(p_worker) NOT BETWEEN 1 AND 128 OR p_lease_seconds IS NULL
     OR p_lease_seconds NOT BETWEEN 30 AND 600 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_gate THEN
    INSERT INTO voice_private.note_transcriptions (recording_id, user_id, session_id, state)
    SELECT r.id, r.user_id, r.session_id, 'PENDING' FROM voice_private.recordings r
     WHERE r.recording_kind = 'VOICE_NOTE' AND r.recording_state = 'STORED' AND v_now < r.retention_expires_at
       AND NOT EXISTS (SELECT 1 FROM voice_private.note_transcriptions n WHERE n.recording_id = r.id)
     ORDER BY r.accepted_at, r.id
     LIMIT 200
    ON CONFLICT ON CONSTRAINT note_transcriptions_pk DO NOTHING;
  END IF;
  FOR v_note IN
    SELECT n.* FROM voice_private.note_transcriptions n
     WHERE (n.lease_expires_at IS NULL OR n.lease_expires_at <= v_now)
       AND ((n.state IN ('PENDING', 'HELD_CONSENT') AND v_gate AND (n.next_attempt_at IS NULL OR n.next_attempt_at <= v_now))
         OR (n.state = 'IN_PROGRESS' AND (n.next_attempt_at IS NULL OR n.next_attempt_at <= v_now))
         OR n.state = 'DELETION_PENDING')
     ORDER BY n.updated_at, n.recording_id
     LIMIT 50
     FOR UPDATE SKIP LOCKED
  LOOP
    EXIT WHEN v_claimed >= p_limit;
    SELECT r.* INTO v_recording FROM voice_private.recordings r WHERE r.id = v_note.recording_id;
    IF v_note.state IN ('PENDING', 'HELD_CONSENT') THEN
      IF NOT (v_recording.recording_state = 'STORED' AND v_now < v_recording.retention_expires_at) THEN
        PERFORM voice_private.settle_note_v1(v_note.recording_id, 'CANCELLED', NULL);
        CONTINUE;
      END IF;
      IF voice_private.consent_state_v1(v_note.user_id) <> 'GRANTED_CURRENT' THEN
        IF v_note.state = 'PENDING' THEN
          UPDATE voice_private.note_transcriptions n SET state = 'HELD_CONSENT', updated_at = v_now
           WHERE n.recording_id = v_note.recording_id;
        END IF;
        CONTINUE;
      END IF;
      IF v_note.attempts_total >= (SELECT p.total_attempts FROM voice_private.transcription_policy_v1() p) THEN
        PERFORM voice_private.settle_note_v1(v_note.recording_id, 'FAILED_FINAL', 'ATTEMPTS_EXHAUSTED');
        CONTINUE;
      END IF;
      UPDATE voice_private.note_transcriptions n SET state = 'PENDING', updated_at = v_now
       WHERE n.recording_id = v_note.recording_id AND n.state = 'HELD_CONSENT';
    END IF;
    UPDATE voice_private.note_transcription_attempts a SET attempt_state = 'OUTCOME_UNKNOWN', unknown_since = v_now
     WHERE a.recording_id = v_note.recording_id AND a.attempt_state = 'SUBMITTING';
    IF FOUND THEN
      -- Reconciled now; if that is inconclusive, the next claim waits for the end of the quarantine.
      UPDATE voice_private.note_transcriptions n
         SET next_attempt_at = v_now + (SELECT p.unknown_quarantine FROM voice_private.transcription_policy_v1() p)
       WHERE n.recording_id = v_note.recording_id;
    END IF;
    UPDATE voice_private.note_transcriptions n
       SET lease_owner = p_worker, lease_expires_at = v_now + make_interval(secs => p_lease_seconds), updated_at = v_now
     WHERE n.recording_id = v_note.recording_id;
    v_claimed := v_claimed + 1;
    RETURN QUERY
      SELECT n.recording_id, n.user_id, n.session_id, o.storage_key, o.byte_size, n.state, n.duration_ms, n.attempts_total,
             a.attempt_id, a.attempt_state, a.provider_job_id, a.unknown_since, a.submitted_at,
             coalesce((SELECT array_agg(d.attempt_id ORDER BY d.ordinal) FROM voice_private.note_transcription_attempts d
                        WHERE d.recording_id = n.recording_id AND d.provider_job_id IS NOT NULL
                          AND d.first_deletion_outcome_at IS NULL AND d.attempt_state IN ('SUCCEEDED', 'FAILED', 'CANCELLED')), '{}'),
             coalesce((SELECT array_agg(d.provider_job_id ORDER BY d.ordinal) FROM voice_private.note_transcription_attempts d
                        WHERE d.recording_id = n.recording_id AND d.provider_job_id IS NOT NULL
                          AND d.first_deletion_outcome_at IS NULL AND d.attempt_state IN ('SUCCEEDED', 'FAILED', 'CANCELLED')), '{}')
        FROM voice_private.note_transcriptions n
        LEFT JOIN voice_private.recording_objects o ON o.recording_id = n.recording_id AND o.track = 'NOTE'
        LEFT JOIN voice_private.note_transcription_attempts a
          ON a.recording_id = n.recording_id AND a.attempt_state IN ('SUBMITTED', 'OUTCOME_UNKNOWN')
       WHERE n.recording_id = v_note.recording_id;
  END LOOP;
END$$;

-- Renew (or, with 0 seconds, release) a held lease, answering what the worker must know at each poll round (§4.7): the
-- note was cancelled, consent is no longer current, or the lease is no longer this worker's.
CREATE FUNCTION public.server_renew_voice_note_transcription_lease_v1(p_recording_id uuid, p_worker text, p_lease_seconds integer)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_note voice_private.note_transcriptions;
BEGIN
  IF p_recording_id IS NULL OR p_worker IS NULL OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 0 AND 600 THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_note FROM voice_private.note_transcriptions n WHERE n.recording_id = p_recording_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'LEASE_LOST'::text; RETURN; END IF;
  IF v_note.state = 'CANCELLED' OR v_note.pending_outcome = 'CANCELLED' THEN RETURN QUERY SELECT 'CANCELLED'::text; RETURN; END IF;
  IF v_note.lease_owner IS DISTINCT FROM p_worker OR v_note.lease_expires_at <= clock_timestamp() THEN
    RETURN QUERY SELECT 'LEASE_LOST'::text; RETURN;
  END IF;
  IF p_lease_seconds = 0 THEN
    UPDATE voice_private.note_transcriptions n SET lease_owner = NULL, lease_expires_at = NULL, updated_at = clock_timestamp()
     WHERE n.recording_id = p_recording_id;
    RETURN QUERY SELECT 'RELEASED'::text; RETURN;
  END IF;
  UPDATE voice_private.note_transcriptions n
     SET lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds), updated_at = clock_timestamp()
   WHERE n.recording_id = p_recording_id;
  IF v_note.state = 'IN_PROGRESS' AND voice_private.consent_state_v1(v_note.user_id) <> 'GRANTED_CURRENT' THEN
    RETURN QUERY SELECT 'CONSENT_WITHDRAWN'::text; RETURN;
  END IF;
  RETURN QUERY SELECT 'RENEWED'::text;
END$$;

-- Record SUBMITTING before any byte leaves (§4.6 rules 2 - 6): the gate is open, consent is current (its row read FOR
-- SHARE, so a withdrawal that commits first is seen and one that comes later waits), the measured duration is within the
-- limit, no other attempt of the note is unresolved, and the bounds allow one more. The ledger row (attempt_id = its call
-- id) is begun in the same transaction, so every attempt is accounted for.
CREATE FUNCTION public.server_begin_voice_note_submission_v1(p_recording_id uuid, p_worker text, p_attempt_id uuid,
                                                            p_duration_ms bigint)
RETURNS TABLE (outcome text, ordinal integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_note voice_private.note_transcriptions;
  v_policy record;
  v_existing voice_private.note_transcription_attempts;
  v_ordinal integer;
BEGIN
  IF p_recording_id IS NULL OR p_worker IS NULL OR p_attempt_id IS NULL OR p_duration_ms IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_policy FROM voice_private.transcription_policy_v1();
  SELECT * INTO v_note FROM voice_private.note_transcriptions n WHERE n.recording_id = p_recording_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::integer; RETURN; END IF;
  SELECT * INTO v_existing FROM voice_private.note_transcription_attempts a WHERE a.attempt_id = p_attempt_id;
  IF FOUND THEN
    IF v_existing.recording_id = p_recording_id THEN
      RETURN QUERY SELECT 'ALREADY_BEGUN'::text, v_existing.ordinal; RETURN;
    END IF;
    RAISE EXCEPTION 'VOICE_ATTEMPT_IDENTITY_CONFLICT' USING ERRCODE = '22023';
  END IF;
  IF v_note.lease_owner IS DISTINCT FROM p_worker OR v_note.lease_expires_at <= clock_timestamp() THEN
    RETURN QUERY SELECT 'LEASE_LOST'::text, NULL::integer; RETURN;
  END IF;
  IF v_note.state NOT IN ('PENDING', 'IN_PROGRESS') OR EXISTS (
       SELECT 1 FROM voice_private.note_transcription_attempts a
        WHERE a.recording_id = p_recording_id AND a.attempt_state IN ('SUBMITTING', 'SUBMITTED', 'OUTCOME_UNKNOWN')) THEN
    RETURN QUERY SELECT 'NOT_CLAIMABLE'::text, NULL::integer; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM voice_private.recordings r
                  WHERE r.id = p_recording_id AND r.recording_state = 'STORED' AND clock_timestamp() < r.retention_expires_at) THEN
    PERFORM voice_private.settle_note_v1(p_recording_id, 'CANCELLED', NULL);
    RETURN QUERY SELECT 'CANCELLED'::text, NULL::integer; RETURN;
  END IF;
  IF NOT voice_private.capability_enabled_v1('PERSONAL_VOICE_NOTE') THEN
    UPDATE voice_private.note_transcriptions n SET state = 'PENDING', lease_owner = NULL, lease_expires_at = NULL,
           updated_at = clock_timestamp()
     WHERE n.recording_id = p_recording_id;
    RETURN QUERY SELECT 'NOT_AVAILABLE_NOW'::text, NULL::integer; RETURN;
  END IF;
  IF voice_private.consent_state_v1(v_note.user_id) <> 'GRANTED_CURRENT' THEN
    PERFORM voice_private.settle_note_v1(p_recording_id, 'HELD_CONSENT', NULL);
    RETURN QUERY SELECT 'HELD_CONSENT'::text, NULL::integer; RETURN;
  END IF;
  IF v_note.attempts_total >= v_policy.total_attempts THEN
    PERFORM voice_private.settle_note_v1(p_recording_id, 'FAILED_FINAL', 'ATTEMPTS_EXHAUSTED');
    RETURN QUERY SELECT 'ATTEMPTS_EXHAUSTED'::text, NULL::integer; RETURN;
  END IF;
  IF NOT v_note.next_attempt_by_user AND v_note.attempts_auto >= v_policy.automatic_attempts THEN
    PERFORM voice_private.settle_note_v1(p_recording_id, 'FAILED_RETRYABLE', 'ATTEMPTS_EXHAUSTED');
    RETURN QUERY SELECT 'ATTEMPTS_EXHAUSTED'::text, NULL::integer; RETURN;
  END IF;
  IF p_duration_ms NOT BETWEEN 1 AND v_policy.duration_limit_ms
     OR (v_note.duration_ms IS NOT NULL AND v_note.duration_ms <> p_duration_ms) THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM public.begin_ai_provider_call_v3(p_attempt_id, v_note.user_id, v_note.session_id, p_recording_id, 'SPEECHMATICS',
    'enhanced', 'SPEECHMATICS_BATCH_TRANSCRIPTION', 'VOICE_NOTE_TRANSCRIPTION', NULL);
  v_ordinal := v_note.attempts_total + 1;
  INSERT INTO voice_private.note_transcription_attempts (attempt_id, recording_id, user_id, ordinal, by_user, attempt_state,
                                                         provider_deletion_state)
  VALUES (p_attempt_id, p_recording_id, v_note.user_id, v_ordinal, v_note.next_attempt_by_user, 'SUBMITTING', 'PENDING');
  UPDATE voice_private.note_transcriptions n
     SET state = 'IN_PROGRESS', attempts_total = v_ordinal,
         attempts_auto = n.attempts_auto + CASE WHEN n.next_attempt_by_user THEN 0 ELSE 1 END,
         next_attempt_by_user = false, next_attempt_at = NULL, duration_ms = p_duration_ms, failure_class = NULL,
         updated_at = clock_timestamp()
   WHERE n.recording_id = p_recording_id;
  RETURN QUERY SELECT 'SUBMITTING'::text, v_ordinal;
END$$;

-- Record what the provider answered to the submission: the job it CREATED (from SUBMITTING, or adopted from an unknown
-- outcome by reconciliation), or that the outcome is UNKNOWN (bytes may have left; never treated as "not created"). A
-- job id is always kept once known - whoever holds the lease, whatever happened to the note - so it is always deleted.
CREATE FUNCTION public.server_record_voice_note_submission_v1(p_attempt_id uuid, p_outcome text, p_provider_job_id text)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_recording uuid;
  v_note voice_private.note_transcriptions;
  v_attempt voice_private.note_transcription_attempts;
BEGIN
  IF p_attempt_id IS NULL OR p_outcome IS NULL OR p_outcome NOT IN ('CREATED', 'UNKNOWN')
     OR (p_outcome = 'CREATED') <> (p_provider_job_id IS NOT NULL)
     OR (p_provider_job_id IS NOT NULL AND (length(p_provider_job_id) NOT BETWEEN 1 AND 128 OR p_provider_job_id !~ '^[A-Za-z0-9_-]+$')) THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT a.recording_id INTO v_recording FROM voice_private.note_transcription_attempts a WHERE a.attempt_id = p_attempt_id;
  IF NOT FOUND THEN RETURN QUERY SELECT 'UNAVAILABLE'::text; RETURN; END IF;
  SELECT * INTO v_note FROM voice_private.note_transcriptions n WHERE n.recording_id = v_recording FOR UPDATE;
  SELECT * INTO v_attempt FROM voice_private.note_transcription_attempts a WHERE a.attempt_id = p_attempt_id FOR UPDATE;
  IF p_outcome = 'CREATED' THEN
    IF v_attempt.provider_job_id = p_provider_job_id THEN RETURN QUERY SELECT 'ALREADY_RECORDED'::text; RETURN; END IF;
    IF v_attempt.provider_job_id IS NOT NULL THEN
      RAISE EXCEPTION 'VOICE_ATTEMPT_IDENTITY_CONFLICT' USING ERRCODE = '22023';
    END IF;
    IF v_attempt.attempt_state IN ('SUBMITTING', 'OUTCOME_UNKNOWN') AND v_note.state = 'IN_PROGRESS' THEN
      UPDATE voice_private.note_transcription_attempts a
         SET provider_job_id = p_provider_job_id, attempt_state = 'SUBMITTED', submitted_at = clock_timestamp(),
             provider_deletion_state = 'PENDING'
       WHERE a.attempt_id = p_attempt_id;
      UPDATE voice_private.note_transcriptions n SET next_attempt_at = NULL, updated_at = clock_timestamp()
       WHERE n.recording_id = v_recording;
      RETURN QUERY SELECT 'RECORDED'::text; RETURN;
    END IF;
    -- The note moved on (cancelled, held, failed) while the provider created the job: it is kept only to be deleted.
    UPDATE voice_private.note_transcription_attempts a
       SET provider_job_id = p_provider_job_id, submitted_at = coalesce(a.submitted_at, clock_timestamp()),
           attempt_state = CASE WHEN a.attempt_state IN ('SUBMITTING', 'OUTCOME_UNKNOWN') THEN 'CANCELLED' ELSE a.attempt_state END,
           settled_at = coalesce(a.settled_at, clock_timestamp()), provider_deletion_state = 'PENDING'
     WHERE a.attempt_id = p_attempt_id;
    RETURN QUERY SELECT 'RECORDED_FOR_DELETION'::text; RETURN;
  END IF;
  IF v_attempt.attempt_state = 'OUTCOME_UNKNOWN' THEN RETURN QUERY SELECT 'ALREADY_RECORDED'::text; RETURN; END IF;
  IF v_attempt.attempt_state <> 'SUBMITTING' THEN RETURN QUERY SELECT 'NOT_SUBMITTING'::text; RETURN; END IF;
  IF v_note.state <> 'IN_PROGRESS' THEN
    -- The note moved on: it will never be processed, so the outcome is never reconciled and its job stays unknown.
    UPDATE voice_private.note_transcription_attempts a
       SET attempt_state = 'FAILED', failure_class = 'UNCERTAIN_SUBMISSION', provider_deletion_state = 'UNKNOWN_JOB',
           unknown_since = clock_timestamp(), settled_at = clock_timestamp()
     WHERE a.attempt_id = p_attempt_id;
    RETURN QUERY SELECT 'NOTE_MOVED_ON'::text; RETURN;
  END IF;
  UPDATE voice_private.note_transcription_attempts a SET attempt_state = 'OUTCOME_UNKNOWN', unknown_since = clock_timestamp()
   WHERE a.attempt_id = p_attempt_id;
  UPDATE voice_private.note_transcriptions n
     SET next_attempt_at = clock_timestamp() + (SELECT p.unknown_quarantine FROM voice_private.transcription_policy_v1() p),
         updated_at = clock_timestamp()
   WHERE n.recording_id = v_recording;
  RETURN QUERY SELECT 'RECORDED'::text;
END$$;

-- Persist the transcript, its band and its uncertain words ONCE (idempotent; never replaced), then the note awaits the
-- first deletion outcome of its job (DELETION_PENDING -> READY). A note whose consent was withdrawn, or which moved on,
-- keeps no text. NO_SPEECH keeps none either.
CREATE FUNCTION public.server_record_voice_note_transcript_v1(p_attempt_id uuid, p_outcome text, p_transcript text,
                                                             p_band text, p_uncertain_tokens text[], p_provider_duration_ms bigint)
RETURNS TABLE (outcome text, state text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_recording uuid;
  v_note voice_private.note_transcriptions;
  v_attempt voice_private.note_transcription_attempts;
  v_digest text;
  v_state text;
BEGIN
  IF p_attempt_id IS NULL OR p_outcome IS NULL OR p_outcome NOT IN ('TRANSCRIBED', 'NO_SPEECH')
     OR (p_outcome = 'TRANSCRIBED' AND (p_transcript IS NULL OR length(btrim(p_transcript)) = 0 OR length(p_transcript) > 20000
                                        OR p_band IS NULL OR p_band NOT IN ('HIGH', 'MEDIUM', 'LOW')
                                        OR p_uncertain_tokens IS NULL OR cardinality(p_uncertain_tokens) > 64
                                        OR array_position(p_uncertain_tokens, NULL) IS NOT NULL
                                        OR EXISTS (SELECT 1 FROM unnest(p_uncertain_tokens) u(t) WHERE length(u.t) NOT BETWEEN 1 AND 64)))
     OR (p_outcome = 'NO_SPEECH' AND (p_transcript IS NOT NULL OR p_band IS NOT NULL OR cardinality(coalesce(p_uncertain_tokens, '{}')) > 0))
     OR (p_provider_duration_ms IS NOT NULL AND p_provider_duration_ms < 0) THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT a.recording_id INTO v_recording FROM voice_private.note_transcription_attempts a WHERE a.attempt_id = p_attempt_id;
  IF NOT FOUND THEN RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::text; RETURN; END IF;
  SELECT * INTO v_note FROM voice_private.note_transcriptions n WHERE n.recording_id = v_recording FOR UPDATE;
  SELECT * INTO v_attempt FROM voice_private.note_transcription_attempts a WHERE a.attempt_id = p_attempt_id FOR UPDATE;
  v_digest := CASE WHEN p_outcome = 'TRANSCRIBED' THEN encode(sha256(convert_to(p_transcript, 'UTF8')), 'hex') END;
  IF v_attempt.attempt_state = 'SUCCEEDED' THEN
    IF v_note.transcript_sha256 IS NOT DISTINCT FROM v_digest THEN
      RETURN QUERY SELECT 'ALREADY_RECORDED'::text, v_note.state; RETURN;
    END IF;
    RAISE EXCEPTION 'VOICE_TRANSCRIPT_IS_DURABLE' USING ERRCODE = '22023';
  END IF;
  IF v_attempt.attempt_state <> 'SUBMITTED' THEN RETURN QUERY SELECT 'NOT_SUBMITTED'::text, v_note.state; RETURN; END IF;
  UPDATE voice_private.note_transcription_attempts a
     SET attempt_state = 'SUCCEEDED', settled_at = clock_timestamp(),
         provider_duration_disagreement = (p_provider_duration_ms IS NOT NULL AND v_note.duration_ms IS NOT NULL
                                           AND p_provider_duration_ms > v_note.duration_ms + 1000)
   WHERE a.attempt_id = p_attempt_id;
  IF v_note.state <> 'IN_PROGRESS' THEN RETURN QUERY SELECT 'NOTE_MOVED_ON'::text, v_note.state; RETURN; END IF;
  IF voice_private.consent_state_v1(v_note.user_id) <> 'GRANTED_CURRENT' THEN
    v_state := voice_private.settle_note_v1(v_recording, 'HELD_CONSENT', NULL);
    RETURN QUERY SELECT 'HELD_CONSENT'::text, v_state; RETURN;
  END IF;
  IF p_outcome = 'NO_SPEECH' THEN
    v_state := voice_private.settle_note_v1(v_recording, 'NO_SPEECH', NULL);
    RETURN QUERY SELECT 'RECORDED'::text, v_state; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM voice_private.recordings r
                  WHERE r.id = v_recording AND r.recording_state = 'STORED' AND clock_timestamp() < r.retention_expires_at) THEN
    v_state := voice_private.settle_note_v1(v_recording, 'CANCELLED', NULL);
    RETURN QUERY SELECT 'CANCELLED'::text, v_state; RETURN;
  END IF;
  v_state := CASE WHEN voice_private.note_first_deletions_recorded_v1(v_recording) THEN 'READY' ELSE 'DELETION_PENDING' END;
  UPDATE voice_private.note_transcriptions n
     SET state = v_state, pending_outcome = CASE WHEN v_state = 'DELETION_PENDING' THEN 'READY' END,
         transcript_text = p_transcript, transcript_sha256 = v_digest, asr_confidence_band = p_band,
         uncertain_tokens = p_uncertain_tokens, failure_class = NULL,
         lease_owner = CASE WHEN v_state = 'READY' THEN NULL ELSE n.lease_owner END,
         lease_expires_at = CASE WHEN v_state = 'READY' THEN NULL ELSE n.lease_expires_at END,
         updated_at = clock_timestamp()
   WHERE n.recording_id = v_recording;
  RETURN QUERY SELECT 'RECORDED'::text, v_state;
END$$;

-- Record one deletion outcome of a known job (§4.8): REQUESTED (verify later), ABSENT (404 / 410 on delete or verify:
-- PROVIDER_ABSENT), LOCKED / TRANSIENT / STILL_PRESENT (RETRYING on the schedule). After seven days from the job's
-- creation an unconfirmed deletion is UNCONFIRMED. The first outcome of the note's last unrecorded job lets the note reach
-- the state it was waiting for.
CREATE FUNCTION public.server_record_voice_note_provider_deletion_v1(p_attempt_id uuid, p_outcome text)
RETURNS TABLE (outcome text, provider_deletion_state text, note_state text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_recording uuid;
  v_note voice_private.note_transcriptions;
  v_attempt voice_private.note_transcription_attempts;
  v_count integer;
  v_deletion text;
  v_state text;
BEGIN
  IF p_attempt_id IS NULL OR p_outcome IS NULL OR p_outcome NOT IN ('REQUESTED', 'ABSENT', 'LOCKED', 'TRANSIENT', 'STILL_PRESENT') THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT a.recording_id INTO v_recording FROM voice_private.note_transcription_attempts a WHERE a.attempt_id = p_attempt_id;
  IF NOT FOUND THEN RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::text, NULL::text; RETURN; END IF;
  SELECT * INTO v_note FROM voice_private.note_transcriptions n WHERE n.recording_id = v_recording FOR UPDATE;
  SELECT * INTO v_attempt FROM voice_private.note_transcription_attempts a WHERE a.attempt_id = p_attempt_id FOR UPDATE;
  IF v_attempt.provider_job_id IS NULL THEN RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
  IF v_attempt.provider_deletion_state IN ('PROVIDER_ABSENT', 'UNCONFIRMED') THEN
    RETURN QUERY SELECT 'ALREADY_FINAL'::text, v_attempt.provider_deletion_state, v_note.state; RETURN;
  END IF;
  v_count := v_attempt.deletion_attempts + 1;
  v_deletion := CASE p_outcome WHEN 'ABSENT' THEN 'PROVIDER_ABSENT' WHEN 'REQUESTED' THEN 'REQUESTED' ELSE 'RETRYING' END;
  IF v_deletion <> 'PROVIDER_ABSENT' AND clock_timestamp() >= coalesce(v_attempt.submitted_at, v_attempt.started_at)
       + (SELECT p.deletion_horizon FROM voice_private.transcription_policy_v1() p) THEN
    v_deletion := 'UNCONFIRMED';
  END IF;
  UPDATE voice_private.note_transcription_attempts a
     SET provider_deletion_state = v_deletion, deletion_attempts = v_count,
         first_deletion_outcome_at = coalesce(a.first_deletion_outcome_at, clock_timestamp()),
         next_deletion_at = CASE WHEN v_deletion IN ('REQUESTED', 'RETRYING')
                                 THEN clock_timestamp() + voice_private.provider_deletion_delay_v1(v_count) END,
         deletion_confirmed_at = CASE WHEN v_deletion = 'PROVIDER_ABSENT' THEN clock_timestamp() END
   WHERE a.attempt_id = p_attempt_id;
  v_state := v_note.state;
  IF v_note.state = 'DELETION_PENDING' AND voice_private.note_first_deletions_recorded_v1(v_recording) THEN
    v_state := voice_private.settle_note_v1(v_recording, v_note.pending_outcome, NULL);
  END IF;
  RETURN QUERY SELECT 'RECORDED'::text, v_deletion, v_state;
END$$;

-- Record a failure and decide the next state from the class and the bounds (§4.6 rules 5, 6, 8). No attempt: the local
-- duration proof failed (final, no provider call, not counted) or the audio could not be read (deferred). With an
-- attempt: transient classes retry automatically within 3 automatic and 5 total attempts, then FAILED_RETRYABLE (a user
-- retry) or FAILED_FINAL; UNCERTAIN_SUBMISSION (an unknown outcome after its quarantine) never retries automatically;
-- permanent classes are final. A known job keeps the note on the deletion path first.
CREATE FUNCTION public.server_record_voice_note_transcription_failure_v1(p_recording_id uuid, p_worker text,
                                                                        p_attempt_id uuid, p_failure_class text)
RETURNS TABLE (outcome text, state text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_note voice_private.note_transcriptions;
  v_attempt voice_private.note_transcription_attempts;
  v_policy record;
  v_transient boolean;
  v_next text;
  v_state text;
BEGIN
  IF p_recording_id IS NULL OR p_worker IS NULL OR p_failure_class IS NULL OR p_failure_class !~ '^[A-Z][A-Z_]{2,63}$' THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_policy FROM voice_private.transcription_policy_v1();
  v_transient := voice_private.transcription_failure_is_transient_v1(p_failure_class);
  SELECT * INTO v_note FROM voice_private.note_transcriptions n WHERE n.recording_id = p_recording_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::text; RETURN; END IF;
  IF p_attempt_id IS NULL THEN
    IF v_note.lease_owner IS DISTINCT FROM p_worker OR v_note.state NOT IN ('PENDING', 'IN_PROGRESS') THEN
      RETURN QUERY SELECT 'LEASE_LOST'::text, v_note.state; RETURN;
    END IF;
    IF p_failure_class = 'STORAGE_UNAVAILABLE' THEN
      UPDATE voice_private.note_transcriptions n
         SET lease_owner = NULL, lease_expires_at = NULL, next_attempt_at = clock_timestamp() + interval '1 minute',
             updated_at = clock_timestamp()
       WHERE n.recording_id = p_recording_id;
      RETURN QUERY SELECT 'DEFERRED'::text, v_note.state; RETURN;
    END IF;
    IF p_failure_class NOT IN ('AUDIO_DURATION_OVER_LIMIT', 'AUDIO_CONTAINER_UNSUPPORTED', 'AUDIO_CONTAINER_INCONSISTENT',
                               'AUDIO_CONTAINER_TRUNCATED', 'AUDIO_CONTAINER_LIMIT') THEN
      RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
    END IF;
    v_state := voice_private.settle_note_v1(p_recording_id, 'FAILED_FINAL', p_failure_class);
    RETURN QUERY SELECT 'RECORDED'::text, v_state; RETURN;
  END IF;
  SELECT * INTO v_attempt FROM voice_private.note_transcription_attempts a
   WHERE a.attempt_id = p_attempt_id AND a.recording_id = p_recording_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
  IF v_attempt.attempt_state = 'FAILED' AND v_attempt.failure_class = p_failure_class THEN
    RETURN QUERY SELECT 'ALREADY_RECORDED'::text, v_note.state; RETURN;
  END IF;
  IF v_attempt.attempt_state NOT IN ('SUBMITTING', 'SUBMITTED', 'OUTCOME_UNKNOWN')
     OR (p_failure_class IN ('UNCERTAIN_SUBMISSION', 'NOT_CREATED') AND v_attempt.attempt_state <> 'OUTCOME_UNKNOWN')
     OR (p_failure_class = 'UNCERTAIN_SUBMISSION'
         AND clock_timestamp() < v_attempt.unknown_since + v_policy.unknown_quarantine) THEN
    RAISE EXCEPTION 'VOICE_TRANSCRIPTION_TRANSITION_REFUSED' USING ERRCODE = '55000';
  END IF;
  UPDATE voice_private.note_transcription_attempts a
     SET attempt_state = 'FAILED', failure_class = p_failure_class, settled_at = clock_timestamp(),
         provider_deletion_state = CASE WHEN a.provider_job_id IS NOT NULL THEN a.provider_deletion_state
                                        WHEN p_failure_class = 'UNCERTAIN_SUBMISSION' THEN 'UNKNOWN_JOB'
                                        ELSE 'NOT_APPLICABLE' END
   WHERE a.attempt_id = p_attempt_id;
  IF v_note.state <> 'IN_PROGRESS' THEN RETURN QUERY SELECT 'NOTE_MOVED_ON'::text, v_note.state; RETURN; END IF;
  v_next := CASE
    WHEN v_transient AND v_note.attempts_auto < v_policy.automatic_attempts AND v_note.attempts_total < v_policy.total_attempts
      THEN 'PENDING'
    WHEN (v_transient OR p_failure_class = 'UNCERTAIN_SUBMISSION') AND v_note.attempts_total < v_policy.total_attempts
      THEN 'FAILED_RETRYABLE'
    ELSE 'FAILED_FINAL' END;
  IF v_next = 'PENDING' THEN
    UPDATE voice_private.note_transcriptions n
       SET next_attempt_at = clock_timestamp() + interval '30 seconds' * power(4, greatest(n.attempts_auto - 1, 0))
     WHERE n.recording_id = p_recording_id;
  END IF;
  v_state := voice_private.settle_note_v1(p_recording_id, v_next, p_failure_class);
  RETURN QUERY SELECT 'RECORDED'::text, v_state;
END$$;

-- Consent was withdrawn while the note was processed (§4.7): no text is kept, an unresolved attempt is closed (it is
-- counted), a known job stays on the deletion path, and the note is HELD_CONSENT until consent is current again.
CREATE FUNCTION public.server_hold_voice_note_for_consent_v1(p_recording_id uuid)
RETURNS TABLE (outcome text, state text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_note voice_private.note_transcriptions;
  v_state text;
BEGIN
  IF p_recording_id IS NULL THEN RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_note FROM voice_private.note_transcriptions n WHERE n.recording_id = p_recording_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::text; RETURN; END IF;
  IF v_note.state NOT IN ('PENDING', 'IN_PROGRESS') THEN RETURN QUERY SELECT 'UNCHANGED'::text, v_note.state; RETURN; END IF;
  IF voice_private.consent_state_v1(v_note.user_id) = 'GRANTED_CURRENT' THEN
    RETURN QUERY SELECT 'CONSENT_CURRENT'::text, v_note.state; RETURN;
  END IF;
  UPDATE voice_private.note_transcription_attempts a
     SET attempt_state = CASE WHEN a.attempt_state = 'OUTCOME_UNKNOWN' THEN 'FAILED' ELSE 'CANCELLED' END,
         failure_class = CASE WHEN a.attempt_state = 'OUTCOME_UNKNOWN' THEN 'UNCERTAIN_SUBMISSION' ELSE a.failure_class END,
         provider_deletion_state = CASE WHEN a.attempt_state = 'OUTCOME_UNKNOWN' THEN 'UNKNOWN_JOB' ELSE a.provider_deletion_state END,
         settled_at = clock_timestamp()
   WHERE a.recording_id = p_recording_id AND a.attempt_state IN ('SUBMITTED', 'OUTCOME_UNKNOWN');
  v_state := voice_private.settle_note_v1(p_recording_id, 'HELD_CONSENT', NULL);
  RETURN QUERY SELECT 'HELD'::text, v_state;
END$$;

-- The ledger rows a worker left PENDING (record §5 decision 5, PR #370 review): an attempt the database settled at least
-- p_grace_seconds ago whose AI-COST call is still PENDING, because the worker's own settlement did not land. Only durable
-- facts come back - the terminal state, the failure class and the duration proven locally before submission - so the
-- worker settles from them and never asks the provider again. settle_ai_provider_call_v2 makes it idempotent: a call
-- already settled the same way answers ALREADY_SETTLED; a racing different settlement is a conflict the worker ignores.
-- Read-only and bounded; nothing here writes.
CREATE FUNCTION public.server_list_voice_note_unsettled_attempts_v1(p_grace_seconds integer, p_limit integer)
RETURNS TABLE (attempt_id uuid, user_id uuid, attempt_state text, failure_class text, duration_ms bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_grace_seconds IS NULL OR p_grace_seconds NOT BETWEEN 60 AND 86400 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT a.attempt_id, a.user_id, a.attempt_state, a.failure_class, n.duration_ms
      FROM voice_private.note_transcription_attempts a
      JOIN voice_private.note_transcriptions n ON n.recording_id = a.recording_id
      JOIN public.ai_provider_calls c ON c.id = a.attempt_id AND c.user_id = a.user_id
     WHERE a.attempt_state IN ('SUCCEEDED', 'FAILED', 'CANCELLED') AND a.settled_at IS NOT NULL
       AND a.settled_at <= now() - make_interval(secs => p_grace_seconds)
       AND c.call_state = 'PENDING'
     ORDER BY a.settled_at, a.attempt_id
     LIMIT p_limit;
END$$;

-- The deletions due (§4.8 step 4): every known job of a settled attempt whose deletion is not final, once its time has
-- come - but a first deletion of a note a live worker holds is that worker's. Each row handed out is deferred two minutes
-- so two sweepers do not repeat it (a repeated delete is harmless). Seven days after its creation, an unconfirmed deletion
-- is UNCONFIRMED.
CREATE FUNCTION public.server_list_voice_note_deletions_due_v1(p_limit integer)
RETURNS TABLE (attempt_id uuid, provider_job_id text, provider_deletion_state text, deletion_attempts integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_horizon interval := (SELECT p.deletion_horizon FROM voice_private.transcription_policy_v1() p);
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  -- A submission left unresolved on a note that is no longer processed (its worker gone) is closed: its job is unknown.
  UPDATE voice_private.note_transcription_attempts a
     SET attempt_state = 'FAILED', failure_class = 'UNCERTAIN_SUBMISSION', provider_deletion_state = 'UNKNOWN_JOB',
         unknown_since = coalesce(a.unknown_since, v_now), settled_at = v_now
    FROM voice_private.note_transcriptions n
   WHERE n.recording_id = a.recording_id AND a.attempt_state IN ('SUBMITTING', 'OUTCOME_UNKNOWN')
     AND n.state <> 'IN_PROGRESS' AND (n.lease_expires_at IS NULL OR n.lease_expires_at <= v_now);
  UPDATE voice_private.note_transcription_attempts a
     SET provider_deletion_state = 'UNCONFIRMED', next_deletion_at = NULL
   WHERE a.provider_job_id IS NOT NULL AND a.provider_deletion_state IN ('REQUESTED', 'RETRYING')
     AND coalesce(a.submitted_at, a.started_at) + v_horizon <= v_now;
  RETURN QUERY
    WITH due AS (
      SELECT a.attempt_id FROM voice_private.note_transcription_attempts a
        JOIN voice_private.note_transcriptions n ON n.recording_id = a.recording_id
       WHERE a.provider_job_id IS NOT NULL AND a.provider_deletion_state IN ('PENDING', 'REQUESTED', 'RETRYING')
         AND a.attempt_state IN ('SUCCEEDED', 'FAILED', 'CANCELLED')
         AND coalesce(a.next_deletion_at, a.settled_at, a.started_at) <= v_now
         AND (a.first_deletion_outcome_at IS NOT NULL OR n.lease_expires_at IS NULL OR n.lease_expires_at <= v_now)
       ORDER BY coalesce(a.next_deletion_at, a.settled_at, a.started_at), a.attempt_id
       LIMIT p_limit
       FOR UPDATE OF a SKIP LOCKED)
    UPDATE voice_private.note_transcription_attempts a SET next_deletion_at = v_now + interval '2 minutes'
      FROM due WHERE a.attempt_id = due.attempt_id
    RETURNING a.attempt_id, a.provider_job_id, a.provider_deletion_state, a.deletion_attempts;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. THE OWNER'S READS AND ACTS (service_role, on the authenticated user's behalf). No storage key, provider job id,
--    transcript, band or uncertain word ever leaves through them.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_retry_voice_note_transcription_v1(p_user_id uuid, p_recording_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_note voice_private.note_transcriptions;
BEGIN
  IF p_user_id IS NULL OR p_recording_id IS NULL THEN RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_note FROM voice_private.note_transcriptions n
   WHERE n.recording_id = p_recording_id AND n.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR NOT voice_private.recording_readable_v1(p_user_id, p_recording_id) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text; RETURN;
  END IF;
  IF v_note.state <> 'FAILED_RETRYABLE'
     OR v_note.attempts_total >= (SELECT p.total_attempts FROM voice_private.transcription_policy_v1() p) THEN
    RETURN QUERY SELECT 'NOT_RETRYABLE'::text; RETURN;
  END IF;
  IF NOT voice_private.capability_enabled_v1('PERSONAL_VOICE_NOTE') THEN
    RETURN QUERY SELECT 'NOT_AVAILABLE_NOW'::text; RETURN;
  END IF;
  UPDATE voice_private.note_transcriptions n
     SET state = 'PENDING', next_attempt_by_user = true, next_attempt_at = NULL, failure_class = NULL, updated_at = clock_timestamp()
   WHERE n.recording_id = p_recording_id;
  RETURN QUERY SELECT 'RETRY_SCHEDULED'::text;
END$$;

-- The processing state of one of the owner's accepted notes. A note not yet seen by the worker is PENDING.
CREATE FUNCTION public.server_read_voice_note_status_v1(p_user_id uuid, p_recording_id uuid)
RETURNS TABLE (session_id uuid, state text, failure_class text, can_retry boolean, committed_turn_id uuid,
               accepted_at timestamptz, available_until timestamptz, recording_available boolean, duration_ms bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS NULL OR p_recording_id IS NULL THEN RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
  RETURN QUERY
    SELECT r.session_id,
           coalesce(n.state, CASE WHEN voice_private.recording_readable_v1(p_user_id, r.id) THEN 'PENDING' ELSE 'CANCELLED' END),
           n.failure_class,
           coalesce(n.state = 'FAILED_RETRYABLE'
                    AND n.attempts_total < (SELECT p.total_attempts FROM voice_private.transcription_policy_v1() p)
                    AND voice_private.recording_readable_v1(p_user_id, r.id), false),
           n.committed_turn_id, r.accepted_at, r.retention_expires_at, voice_private.recording_readable_v1(p_user_id, r.id),
           n.duration_ms
      FROM voice_private.recordings r
      LEFT JOIN voice_private.note_transcriptions n ON n.recording_id = r.id
     WHERE r.id = p_recording_id AND r.user_id = p_user_id AND r.recording_kind = 'VOICE_NOTE' AND r.accepted_at IS NOT NULL;
END$$;

-- The accepted, not yet committed notes of one of the owner's sessions, oldest first: what the client resumes.
CREATE FUNCTION public.server_list_session_pending_voice_notes_v1(p_user_id uuid, p_session_id uuid)
RETURNS TABLE (recording_id uuid, state text, accepted_at timestamptz, available_until timestamptz, duration_ms bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL THEN RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
  RETURN QUERY
    SELECT r.id, coalesce(n.state, 'PENDING'), r.accepted_at, r.retention_expires_at, n.duration_ms
      FROM voice_private.recordings r
      LEFT JOIN voice_private.note_transcriptions n ON n.recording_id = r.id
     WHERE r.user_id = p_user_id AND r.session_id = p_session_id AND r.recording_kind = 'VOICE_NOTE'
       AND voice_private.recording_readable_v1(p_user_id, r.id)
       AND (n.state IS NULL OR n.state NOT IN ('COMMITTED', 'CANCELLED'))
     ORDER BY r.accepted_at, r.id
     LIMIT 20;
END$$;

-- For conversation history: which of the given turns of the owner's session came from a voice note, whether that
-- recording can still be played, until when, and its measured length. No key, no band.
CREATE FUNCTION public.server_read_session_voice_turns_v1(p_user_id uuid, p_session_id uuid, p_turn_ids uuid[])
RETURNS TABLE (turn_id uuid, recording_id uuid, available boolean, available_until timestamptz, duration_ms bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL OR p_turn_ids IS NULL OR cardinality(p_turn_ids) > 100 THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT vs.turn_id, vs.recording_id, voice_private.recording_readable_v1(p_user_id, vs.recording_id),
           r.retention_expires_at, vs.anchor_end_ms - vs.anchor_start_ms
      FROM public.conversation_turn_voice_sources vs
      JOIN voice_private.recordings r ON r.id = vs.recording_id
     WHERE vs.user_id = p_user_id AND vs.session_id = p_session_id AND vs.turn_id = ANY (p_turn_ids)
       AND vs.source_role = 'USER' AND vs.source_modality = 'VOICE_NOTE'
     ORDER BY vs.turn_id;
END$$;

-- Whether Voice Notes are available now (the gate), and the owner's consent against the current text.
CREATE FUNCTION public.server_read_my_voice_note_capability_v1(p_user_id uuid)
RETURNS TABLE (voice_notes_available boolean, consent_state text, consent_version text, current_version text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
  RETURN QUERY
    SELECT voice_private.capability_enabled_v1('PERSONAL_VOICE_NOTE'), voice_private.consent_state_v1(p_user_id),
           (SELECT c.consent_version FROM voice_private.recording_consents c WHERE c.user_id = p_user_id AND c.revoked_at IS NULL),
           (SELECT t.version FROM voice_private.consent_texts t WHERE t.purpose = 'VOICE_RECORDING' AND t.is_current);
END$$;

-- The current consent text with its digests, exactly as installed (what a grant agrees to).
CREATE FUNCTION public.server_read_voice_consent_text_v1()
RETURNS TABLE (consent_version text, text_ar text, text_en text, text_ar_sha256 text, text_en_sha256 text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT t.version, t.text_ar, t.text_en, t.text_ar_sha256, t.text_en_sha256
    FROM voice_private.consent_texts t WHERE t.purpose = 'VOICE_RECORDING' AND t.is_current;
$$;

-- E13: the band constants, read by the server at startup so it refuses to start when its P-1 configuration differs.
CREATE FUNCTION public.server_read_machine_asr_memory_confidence_v1()
RETURNS TABLE (high double precision, medium double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT voice_private.machine_asr_memory_confidence_v1('HIGH'), voice_private.machine_asr_memory_confidence_v1('MEDIUM');
$$;

-- E8: the voice source of a Memory command - the band of the turn being answered (NULL when typed) and of the turn whose
-- words are kept (the turn that asked the pending question, else the turn itself). The server needs both to choose the
-- outcome and the band's exact score; finalize v2 re-reads them under its locks and refuses anything else.
CREATE FUNCTION public.server_read_memory_command_voice_v1(p_user_id uuid, p_session_id uuid, p_turn_id uuid, p_command_id uuid)
RETURNS TABLE (turn_voice boolean, turn_band text, origin_voice boolean, origin_band text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_origin uuid := p_turn_id;
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL OR p_turn_id IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversation_turns t
                  WHERE t.id = p_turn_id AND t.user_id = p_user_id AND t.session_id = p_session_id AND t.role = 'USER') THEN
    RETURN;
  END IF;
  IF p_command_id IS NOT NULL THEN
    SELECT c.source_turn_id INTO v_origin FROM public.memory_control_commands c
     WHERE c.id = p_command_id AND c.user_id = p_user_id AND c.session_id = p_session_id;
    IF NOT FOUND THEN RETURN; END IF;
  END IF;
  RETURN QUERY
    SELECT EXISTS (SELECT 1 FROM public.conversation_turn_voice_sources vs WHERE vs.turn_id = p_turn_id AND vs.user_id = p_user_id),
           (SELECT vs.asr_confidence_band FROM public.conversation_turn_voice_sources vs WHERE vs.turn_id = p_turn_id AND vs.user_id = p_user_id),
           EXISTS (SELECT 1 FROM public.conversation_turn_voice_sources vs WHERE vs.turn_id = v_origin AND vs.user_id = p_user_id),
           (SELECT vs.asr_confidence_band FROM public.conversation_turn_voice_sources vs WHERE vs.turn_id = v_origin AND vs.user_id = p_user_id);
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. THE ONE ATOMIC VOICE TURN (§4.4). In ONE transaction: the user turn (RECEIVED, the stored transcript, key
--    'voice-note:<recording>'), its voice source (USER, VOICE_NOTE, MACHINE_ASR, band, [0, duration)) and the note's
--    committed turn. A replay answers the same turn - first, whatever the session's later state, as a typed replay does.
--    Otherwise: the session is the owner's, ACTIVE and TEXT; the note is the owner's, of that session, STORED and
--    readable, and READY; the gate is open; consent is current (its row read FOR SHARE, so a withdrawal and a commit are
--    serialized); and the typed turn's admission bound holds, under the same per-user lock.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_commit_voice_note_turn_v1(p_user_id uuid, p_recording_id uuid)
RETURNS TABLE (outcome text, turn_id uuid, session_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_recording voice_private.recordings;
  v_note voice_private.note_transcriptions;
  v_session public.conversation_sessions;
  v_key text;
  v_turn uuid;
  policy record;
  in_session integer;
  in_user integer;
  recent_short integer;
  recent_long integer;
BEGIN
  IF p_user_id IS NULL OR p_recording_id IS NULL THEN RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_recording FROM voice_private.recordings r
   WHERE r.id = p_recording_id AND r.user_id = p_user_id AND r.recording_kind = 'VOICE_NOTE';
  IF NOT FOUND THEN RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::uuid; RETURN; END IF;
  SELECT * INTO v_note FROM voice_private.note_transcriptions n WHERE n.recording_id = p_recording_id FOR UPDATE;
  IF FOUND AND v_note.committed_turn_id IS NOT NULL THEN
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, v_note.committed_turn_id, v_recording.session_id; RETURN;
  END IF;
  SELECT * INTO v_session FROM public.conversation_sessions s WHERE s.id = v_recording.session_id AND s.user_id = p_user_id;
  IF NOT FOUND OR v_session.status <> 'ACTIVE' OR v_session.channel <> 'TEXT' THEN
    RETURN QUERY SELECT 'SESSION_NOT_ACTIVE'::text, NULL::uuid, v_recording.session_id; RETURN;
  END IF;
  IF NOT voice_private.recording_readable_v1(p_user_id, p_recording_id) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::uuid; RETURN;
  END IF;
  IF v_note.recording_id IS NULL OR v_note.state <> 'READY' THEN
    RETURN QUERY SELECT 'NOT_READY'::text, NULL::uuid, v_recording.session_id; RETURN;
  END IF;
  IF NOT voice_private.capability_enabled_v1('PERSONAL_VOICE_NOTE') THEN
    RETURN QUERY SELECT 'NOT_AVAILABLE_NOW'::text, NULL::uuid, v_recording.session_id; RETURN;
  END IF;
  IF voice_private.consent_state_v1(p_user_id) <> 'GRANTED_CURRENT' THEN
    RETURN QUERY SELECT 'CONSENT_REQUIRED'::text, NULL::uuid, v_recording.session_id; RETURN;
  END IF;
  v_key := 'voice-note:' || p_recording_id::text;
  PERFORM public.lock_conversation_turn_admission_v1(p_user_id);
  IF EXISTS (SELECT 1 FROM public.conversation_turns t
              WHERE t.session_id = v_recording.session_id AND t.user_id = p_user_id AND t.idempotency_key = v_key) THEN
    RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::uuid, v_recording.session_id; RETURN;
  END IF;
  SELECT * INTO policy FROM public.conversation_turn_admission_policy_v1();
  SELECT count(*) FILTER (WHERE f.turn_session_id = v_recording.session_id), count(*)
    INTO in_session, in_user FROM public.conversation_turns_in_flight_v1(p_user_id, true) f;
  SELECT count(*) FILTER (WHERE t.created_at > CURRENT_TIMESTAMP - policy.short_window), count(*)
    INTO recent_short, recent_long
    FROM public.conversation_turns t
   WHERE t.user_id = p_user_id AND t.role = 'USER' AND t.created_at > CURRENT_TIMESTAMP - policy.long_window;
  IF in_session >= policy.session_in_flight_limit OR in_user >= policy.user_in_flight_limit
     OR recent_short >= policy.short_window_limit OR recent_long >= policy.long_window_limit
     OR public.conversation_turn_work_budget_spent_v1(p_user_id) THEN
    RETURN QUERY SELECT 'ADMISSION_LIMITED'::text, NULL::uuid, v_recording.session_id; RETURN;
  END IF;
  v_turn := gen_random_uuid();
  INSERT INTO public.conversation_turns(
    id, session_id, user_id, role, status, content, processing_path, routing_reason, source_turn_id, idempotency_key, completed_at
  ) VALUES (v_turn, v_recording.session_id, p_user_id, 'USER', 'RECEIVED', v_note.transcript_text, NULL, NULL, NULL, v_key, NULL);
  INSERT INTO public.conversation_turn_voice_sources (turn_id, user_id, session_id, source_role, source_modality,
                                                      transcript_origin, asr_confidence_band, recording_id,
                                                      anchor_start_ms, anchor_end_ms)
  VALUES (v_turn, p_user_id, v_recording.session_id, 'USER', 'VOICE_NOTE', 'MACHINE_ASR', v_note.asr_confidence_band,
          p_recording_id, 0, v_note.duration_ms);
  UPDATE voice_private.note_transcriptions n
     SET state = 'COMMITTED', committed_turn_id = v_turn, transcript_text = NULL, updated_at = clock_timestamp()
   WHERE n.recording_id = p_recording_id;
  RETURN QUERY SELECT 'COMMITTED'::text, v_turn, v_recording.session_id;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. THE FORWARD-REPLACED STATEMENTS. Each is its origin statement with the edits of its substitution applied exactly
--    once (database/voice-notes-0186-substitutions.mjs); verify-migration-0186 re-derives each and compares.
-- ---------------------------------------------------------------------------------------------------------------------

-- Forward-replaced from 0183_s8b_02_voice_foundation_v1.sql (substitution "note-upload-replay" in database/voice-notes-0186-substitutions.mjs).
CREATE OR REPLACE FUNCTION public.server_begin_voice_note_upload_v1(p_user_id uuid, p_session_id uuid, p_command_id uuid,
                                                        p_byte_size bigint)
RETURNS TABLE (outcome text, recording_id uuid, storage_key text, upload_deadline timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_existing voice_private.recordings;
  v_recording uuid;
  v_key text;
  v_deadline timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL OR p_command_id IS NULL OR p_byte_size IS NULL OR p_byte_size <= 0 THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_existing FROM voice_private.recordings r WHERE r.begin_command_id = p_command_id;
  IF FOUND THEN
    IF v_existing.user_id = p_user_id AND v_existing.session_id = p_session_id AND v_existing.recording_state = 'PENDING_UPLOAD'
       AND clock_timestamp() < v_existing.upload_deadline
       AND voice_private.consent_state_v1(p_user_id) <> 'GRANTED_CURRENT' THEN
      -- PRIV-W: a withdrawal stops an unfinished upload, a replayed begin included; the key is not handed back.
      RETURN QUERY SELECT 'CONSENT_REQUIRED'::text, NULL::uuid, NULL::text, NULL::timestamptz;
    ELSIF v_existing.user_id = p_user_id AND v_existing.session_id = p_session_id AND v_existing.recording_state = 'PENDING_UPLOAD'
       AND clock_timestamp() < v_existing.upload_deadline THEN
      RETURN QUERY SELECT 'BEGUN'::text, v_existing.id, o.storage_key, v_existing.upload_deadline
        FROM voice_private.recording_objects o WHERE o.recording_id = v_existing.id;
    -- S8B-03 (0186, §5.2): the same command replayed after its note was accepted names that note again, so the client
    -- receives the answer it lost (the API reads it from the accept command's read-only STORED branch). Nothing is
    -- written; no key and no deadline are handed back. Another session or another size is another command.
    ELSIF v_existing.user_id = p_user_id AND v_existing.session_id = p_session_id
       AND v_existing.recording_kind = 'VOICE_NOTE' AND v_existing.recording_state = 'STORED'
       AND clock_timestamp() < v_existing.retention_expires_at
       AND EXISTS (SELECT 1 FROM voice_private.recording_objects o
                    WHERE o.recording_id = v_existing.id AND o.byte_size = p_byte_size) THEN
      RETURN QUERY SELECT 'ALREADY_ACCEPTED'::text, v_existing.id, NULL::text, NULL::timestamptz;
    ELSE
      RETURN QUERY SELECT CASE WHEN v_existing.user_id <> p_user_id THEN 'COMMAND_CONFLICT'
                               WHEN v_existing.session_id <> p_session_id THEN 'COMMAND_CONFLICT'
                               WHEN v_existing.recording_state = 'STORED'
                                    AND clock_timestamp() < v_existing.retention_expires_at THEN 'COMMAND_CONFLICT'
                               ELSE 'UNAVAILABLE' END,
                          NULL::uuid, NULL::text, NULL::timestamptz;
    END IF;
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversation_sessions s WHERE s.id = p_session_id AND s.user_id = p_user_id) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;
  IF NOT voice_private.capability_enabled_v1('PERSONAL_VOICE_NOTE') THEN
    RETURN QUERY SELECT 'NOT_AVAILABLE_NOW'::text, NULL::uuid, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;
  IF voice_private.consent_state_v1(p_user_id) <> 'GRANTED_CURRENT' THEN
    RETURN QUERY SELECT 'CONSENT_REQUIRED'::text, NULL::uuid, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;
  IF p_byte_size > voice_private.object_byte_ceiling_v1() THEN
    RETURN QUERY SELECT 'TOO_LARGE'::text, NULL::uuid, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;
  v_recording := gen_random_uuid();
  v_key := 'voice-note/' || gen_random_uuid()::text;
  v_deadline := clock_timestamp() + voice_private.note_upload_window_v1();
  INSERT INTO voice_private.recordings (id, user_id, session_id, recording_kind, begin_command_id, recording_state,
                                        upload_deadline)
  VALUES (v_recording, p_user_id, p_session_id, 'VOICE_NOTE', p_command_id, 'PENDING_UPLOAD', v_deadline);
  INSERT INTO voice_private.recording_objects (recording_id, track, segment_index, storage_key, object_state, content_type,
                                               byte_size, upload_deadline)
  VALUES (v_recording, 'NOTE', 0, v_key, 'PENDING_UPLOAD', 'audio/mp4', p_byte_size, v_deadline);
  RETURN QUERY SELECT 'BEGUN'::text, v_recording, v_key, v_deadline;
END$$;

-- Forward-replaced from 0152_memory_subject_identity_atomicity_v1.sql (substitution "evidence-eligibility" in database/voice-notes-0186-substitutions.mjs).
CREATE OR REPLACE FUNCTION public.canonical_eligible_memory_ids_v1(p_user_id uuid, p_now timestamptz)
RETURNS TABLE(memory_id uuid, evidence_id text)
LANGUAGE sql STABLE SET search_path='' AS $$
  WITH candidates AS MATERIALIZED (
    SELECT memory.id, memory.type, memory.source, memory.content, memory.updated_at
    FROM public.memories memory
    WHERE memory.user_id=p_user_id AND memory.status='ACTIVE'
      AND (memory.expires_at IS NULL OR memory.expires_at>p_now)
    ORDER BY memory.updated_at DESC, memory.id DESC
    LIMIT 64
  ), eligible AS (
    SELECT candidate.id, candidate.updated_at,
      row_number() OVER (
        PARTITION BY candidate.type, candidate.source,
          public.canonical_evidence_content_key_v1(candidate.content)
        ORDER BY candidate.updated_at DESC, candidate.id ASC
      ) duplicate_rank
    FROM candidates candidate
    -- S8B-03 (0186, E1 / D1): a machine transcript of the user's own voice is Fresh Evidence; L1 widens with it.
    WHERE candidate.source IN ('USER_STATED','USER_CONFIRMED','MACHINE_ASR') AND candidate.type<>'DERIVED_INSIGHT'
      AND EXISTS (SELECT 1 FROM public.memory_subject_attributions attribution WHERE attribution.memory_id=candidate.id AND attribution.user_id=p_user_id AND attribution.subject='SELF') -- MEM-AR-01C CC-M1 (0152)
  )
  SELECT eligible.id, 'memory:'||eligible.id::text
  FROM eligible WHERE eligible.duplicate_rank=1
  ORDER BY eligible.updated_at DESC, eligible.id ASC
  LIMIT 64
$$;

-- Forward-replaced from 0152_memory_subject_identity_atomicity_v1.sql (substitution "evidence-standing" in database/voice-notes-0186-substitutions.mjs).
CREATE OR REPLACE FUNCTION public.personal_evidence_standing_v1(p_user_id uuid, p_evidence_id text, p_now timestamptz)
RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT coalesce((
    SELECT CASE
      WHEN m.status IN ('DELETED','DISABLED') THEN 'WITHDRAWN'
      WHEN m.status = 'SUPERSEDED' THEN 'CORRECTED'
      -- S8B-03 (0186, E2): MACHINE_ASR stands exactly where the typed sources stand (L2 is a subset of CURRENT).
      WHEN m.status IN ('ACTIVE','EXPIRED') AND m.source IN ('USER_STATED','USER_CONFIRMED','MACHINE_ASR') AND m.type <> 'DERIVED_INSIGHT' AND a.subject = 'OTHER' THEN 'NOT_SELF'
      WHEN m.status IN ('ACTIVE','EXPIRED') AND m.source IN ('USER_STATED','USER_CONFIRMED','MACHINE_ASR') AND m.type <> 'DERIVED_INSIGHT' AND a.subject IS NULL THEN 'UNATTRIBUTED'
      WHEN m.status = 'EXPIRED' OR (m.expires_at IS NOT NULL AND m.expires_at <= p_now) THEN 'LAPSED'
      WHEN m.status = 'ACTIVE' AND m.source IN ('USER_STATED','USER_CONFIRMED','MACHINE_ASR') AND m.type <> 'DERIVED_INSIGHT' AND a.subject = 'SELF' THEN 'CURRENT'
      ELSE 'OTHER' END
      FROM public.memories m
      LEFT JOIN public.memory_subject_attributions a ON a.memory_id = m.id AND a.user_id = m.user_id
     WHERE m.user_id = p_user_id AND m.id = public.personal_evidence_memory_id_v1(p_evidence_id)), 'OTHER')
$$;

-- Forward-replaced from 0183_s8b_02_voice_foundation_v1.sql (substitution "background-memory-writer" in database/voice-notes-0186-substitutions.mjs).
CREATE OR REPLACE FUNCTION public.background_record_memory_v1(
  p_source_turn_id uuid, p_memory_id uuid, p_type text, p_content text,
  p_confidence double precision, p_importance double precision, p_expires_at timestamptz DEFAULT NULL
) RETURNS TABLE(outcome text, memory_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  execution_row public.post_response_intelligence_executions;
  source_row public.conversation_turns;
  replayed uuid;
  new_key text;
  created public.memories;
  v_band text;
  v_source text := 'USER_STATED';
BEGIN
  IF p_source_turn_id IS NULL OR p_memory_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_MEMORY_IDENTITY' USING ERRCODE='22023';
  END IF;
  SELECT e.* INTO execution_row FROM public.post_response_intelligence_executions e
   WHERE e.source_turn_id = p_source_turn_id AND e.state = 'RUNNING';
  IF NOT FOUND OR NOT EXISTS (
       SELECT 1 FROM public.post_response_intelligence_effects f
        WHERE f.execution_id = execution_row.id AND f.effect_key = 'MEMORY_WRITE' AND f.state = 'CLAIMED') THEN
    RAISE EXCEPTION 'MEMORY_WRITE_EXECUTION_NOT_ASSOCIATED' USING ERRCODE='42501',
      DETAIL='A background Memory write is canonical only inside its durable post-response execution with MEMORY_WRITE claimed.';
  END IF;
  -- S8B-02 (0183, D-7 / P-1): a turn with a voice source is a machine transcript. Its source is read from the turn, never
  -- taken from the caller. A LOW band writes no Memory. Any other band is recorded MACHINE_ASR, below the typed-text
  -- confidence; the band's value is controlled configuration.
  SELECT vs.asr_confidence_band INTO v_band FROM public.conversation_turn_voice_sources vs
   WHERE vs.turn_id = p_source_turn_id AND vs.user_id = execution_row.user_id;
  IF FOUND THEN
    IF v_band IS DISTINCT FROM 'HIGH' AND v_band IS DISTINCT FROM 'MEDIUM' THEN
      RETURN QUERY SELECT 'LOW_CONFIDENCE_MACHINE_ASR'::text, NULL::uuid; RETURN;
    END IF;
    -- S8B-03 (0186, E13): the score is the band's controlled constant, exactly; a direct call cannot choose it.
    IF p_confidence IS NULL OR p_confidence IS DISTINCT FROM voice_private.machine_asr_memory_confidence_v1(v_band) THEN
      RAISE EXCEPTION 'INVALID_MEMORY_SCORE' USING ERRCODE='22023';
    END IF;
    v_source := 'MACHINE_ASR';
  END IF;
  PERFORM public.assert_canonical_memory_shape_v1(p_type, p_content, v_source, p_confidence, p_importance, 'ACTIVE', p_expires_at);

  IF EXISTS (SELECT 1 FROM public.memory_control_commands c
              WHERE c.source_turn_id = p_source_turn_id AND c.user_id = execution_row.user_id) THEN
    RETURN QUERY SELECT 'SKIPPED_COMMAND_TURN'::text, NULL::uuid; RETURN;
  END IF;

  PERFORM public.memory_equivalence_lock_v1(execution_row.user_id);
  SELECT a.memory_id INTO replayed FROM public.memory_subject_attributions a
   WHERE a.execution_id = execution_row.id AND a.user_id = execution_row.user_id AND a.basis = 'FIRST_PERSON_CAPTURE';
  IF replayed IS NOT NULL THEN
    RETURN QUERY SELECT 'ALREADY_RECORDED'::text, replayed; RETURN;
  END IF;

  new_key := public.memory_equivalence_key_v1(btrim(p_content));
  PERFORM 1 FROM public.memories m
    WHERE m.user_id = execution_row.user_id AND m.type = p_type AND m.status = 'ACTIVE'
      AND public.memory_equivalence_key_v1(m.content) = new_key
    ORDER BY m.id FOR UPDATE;

  SELECT * INTO source_row FROM public.conversation_turns t WHERE t.id = p_source_turn_id AND t.user_id = execution_row.user_id;
  IF EXISTS (
    SELECT 1 FROM public.memory_control_commands c
      JOIN public.conversation_turns later ON later.id = c.source_turn_id
      JOIN public.memories m ON m.user_id = c.user_id
        AND (m.id = c.target_memory_id
             OR m.id IN (SELECT d.memory_id FROM public.memory_equivalence_dispositions d
                          WHERE d.command_id = c.id AND d.disposition IN ('FORGOTTEN','DISABLED','CORRECTED')))
     WHERE c.user_id = execution_row.user_id
       AND c.outcome IN ('FORGOTTEN','DISABLED','CORRECTED','CORRECTED_TO_EXISTING')
       AND m.type = p_type AND public.memory_equivalence_key_v1(m.content) = new_key
       AND (later.created_at, later.id) > (source_row.created_at, source_row.id))
  THEN
    RETURN QUERY SELECT 'SUPERSEDED_BY_LATER_COMMAND'::text, NULL::uuid; RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.memories m
     WHERE m.user_id = execution_row.user_id AND m.type = p_type AND m.status = 'ACTIVE'
       AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
       AND public.memory_equivalence_key_v1(m.content) = new_key
       AND coalesce(public.memory_subject_v1(execution_row.user_id, m.id), 'SELF') = 'SELF')
  THEN
    RETURN QUERY SELECT 'EQUIVALENT_EXISTS'::text, NULL::uuid; RETURN;
  END IF;

  PERFORM public.historical_capture_begin_v1(execution_row.user_id, execution_row.session_id, true);
  SELECT * INTO created FROM public.server_create_memory_v1(execution_row.user_id, p_memory_id, p_type, p_content,
    v_source, p_confidence, p_importance, 'ACTIVE', p_expires_at);
  INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis, execution_id)
    VALUES (created.id, execution_row.user_id, 'SELF', 'FIRST_PERSON_CAPTURE', execution_row.id);
  RETURN QUERY SELECT 'CREATED'::text, created.id;
END;$$;

-- Forward-replaced from 0152_memory_subject_identity_atomicity_v1.sql (substitution "memory-control-finalize" in database/voice-notes-0186-substitutions.mjs).
CREATE OR REPLACE FUNCTION public.server_finalize_memory_control_turn_v2(
  p_session_id uuid, p_user_id uuid, p_source_turn_id uuid, p_assistant_turn_id uuid,
  p_kind text, p_outcome text,
  p_target_memory_id uuid, p_new_memory_id uuid,
  p_type text, p_content text, p_confidence double precision, p_importance double precision, p_expires_at timestamptz,
  p_candidate_memory_ids uuid[], p_answers_command_id uuid,
  p_subject text, p_equivalent_memory_id uuid,
  p_reply text, p_reply_if_changed text, p_reply_if_existing text,
  p_event_id uuid, p_correlation_id uuid DEFAULT NULL, p_orchestration_id uuid DEFAULT NULL
) RETURNS TABLE(outcome text, user_turn jsonb, assistant_turn jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  source_row public.conversation_turns;
  previous_user_turn_id uuid;
  pending public.memory_control_commands;
  new_command_id uuid := gen_random_uuid();
  target public.memories;
  hint public.memories;
  retained public.memories;
  reconfirmed public.memories;
  changed public.memories;
  member record;
  applied text := p_outcome;
  reply text := p_reply;
  result_id uuid;
  recorded_target uuid;
  candidates uuid[] := coalesce(p_candidate_memory_ids, '{}');
  successor_subject text;
  successor_basis text;
  target_subject text;
  new_key text;
  target_key text;
  equivalents uuid[] := '{}';
  finalized_user jsonb;
  finalized_assistant jsonb;
  -- S8B-03 (0186, E8 / E9 / E13): the voice source of this turn and of the turn whose words are kept.
  v_turn_voice boolean := false;
  v_turn_band text;
  v_origin_voice boolean := false;
  v_origin_band text;
  v_source text := 'USER_STATED';
  v_confirm_memory uuid;
  v_confirm_turn uuid;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL OR p_source_turn_id IS NULL OR p_assistant_turn_id IS NULL OR p_event_id IS NULL
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_IDENTITY' USING ERRCODE='22023'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('INSPECT','REMEMBER','CORRECT','FORGET','DISABLE') THEN
    RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_KIND' USING ERRCODE='22023'; END IF;
  -- TARGET_CHANGED, ALREADY_REMEMBERED, RECONFIRMED and CORRECTED_TO_EXISTING are decided here, never requested.
  IF p_outcome IS NULL OR p_outcome NOT IN (
    'INSPECTED','NOTHING_REMEMBERED','REMEMBERED','DECLINED_SENSITIVE','CORRECTED','ALREADY_CORRECT',
    'FORGOTTEN','DISABLED','TARGET_NOT_FOUND','TARGET_NOT_SPECIFIED','CLARIFICATION_REQUIRED','CLARIFICATION_DECLINED',
    'SUBJECT_CLARIFICATION_REQUIRED','NOT_HEARD_CLEARLY')
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_OUTCOME' USING ERRCODE='22023'; END IF;
  IF p_reply IS NULL OR length(btrim(p_reply))=0 THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_REPLY' USING ERRCODE='22023'; END IF;
  IF p_outcome IN ('CORRECTED','FORGOTTEN','DISABLED') AND (p_reply_if_changed IS NULL OR length(btrim(p_reply_if_changed))=0)
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_REPLY' USING ERRCODE='22023'; END IF;
  IF p_outcome IN ('REMEMBERED','CORRECTED') AND (p_reply_if_existing IS NULL OR length(btrim(p_reply_if_existing))=0)
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_REPLY' USING ERRCODE='22023'; END IF;
  IF p_subject IS NOT NULL AND (p_subject NOT IN ('SELF','OTHER') OR p_outcome NOT IN ('REMEMBERED','CORRECTED'))
     OR (p_outcome = 'REMEMBERED' AND p_subject IS NULL)
     OR (p_equivalent_memory_id IS NOT NULL AND p_outcome NOT IN ('REMEMBERED','CORRECTED'))
     OR (p_kind = 'REMEMBER' AND p_target_memory_id IS NOT NULL)
     OR (p_outcome = 'SUBJECT_CLARIFICATION_REQUIRED' AND p_kind NOT IN ('REMEMBER','CORRECT'))
     OR (p_kind = 'CORRECT' AND p_outcome = 'SUBJECT_CLARIFICATION_REQUIRED' AND p_target_memory_id IS NULL)
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023'; END IF;

  -- Lock order: the source turn first, then the answered command, then the owner lock, then the Memory rows.
  SELECT * INTO source_row FROM public.conversation_turns t
    WHERE t.id=p_source_turn_id AND t.session_id=p_session_id AND t.user_id=p_user_id AND t.role='USER' AND t.status='GENERATING'
    FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  -- S8B-03 (0186, E8, §4.9.4): the turn's voice source and band are read here, never taken from the caller. A LOW turn
  -- changes no Memory; a voice answer counts only from HIGH; a spoken FORGET / DISABLE is never executed in the turn
  -- that says it - only the next turn's confirmation executes it. NOT_HEARD_CLEARLY exists only for a voice turn.
  SELECT vs.asr_confidence_band INTO v_turn_band FROM public.conversation_turn_voice_sources vs
   WHERE vs.turn_id = source_row.id AND vs.user_id = p_user_id;
  v_turn_voice := FOUND;
  IF v_turn_voice AND (
       (v_turn_band NOT IN ('HIGH','MEDIUM') AND p_outcome IN ('REMEMBERED','CORRECTED','FORGOTTEN','DISABLED'))
    OR (v_turn_band <> 'HIGH' AND p_answers_command_id IS NOT NULL)
    OR (p_outcome IN ('FORGOTTEN','DISABLED') AND p_answers_command_id IS NULL))
  THEN RAISE EXCEPTION 'MACHINE_ASR_MEMORY_COMMAND_REFUSED' USING ERRCODE='42501'; END IF;
  IF p_outcome = 'NOT_HEARD_CLEARLY' AND (NOT v_turn_voice OR p_kind NOT IN ('REMEMBER','CORRECT','FORGET','DISABLE')
       OR p_target_memory_id IS NOT NULL OR p_new_memory_id IS NOT NULL OR cardinality(candidates) <> 0
       OR p_answers_command_id IS NOT NULL)
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023'; END IF;

  IF EXISTS (SELECT 1 FROM unnest(candidates) c
              WHERE NOT EXISTS (SELECT 1 FROM public.memories m WHERE m.id=c AND m.user_id=p_user_id))
     OR cardinality(candidates) <> (SELECT count(DISTINCT c) FROM unnest(candidates) c)
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_CANDIDATES' USING ERRCODE='42501'; END IF;

  -- A follow-up answers exactly the question the immediately preceding user turn of this Session received, at most
  -- once: a target question (CLARIFICATION_REQUIRED, same kind, only one of its options), the subject question
  -- (SUBJECT_CLARIFICATION_REQUIRED, REMEMBER, answered by REMEMBERED or CLARIFICATION_DECLINED), or (L-11) a
  -- correction's subject question (SUBJECT_CLARIFICATION_REQUIRED, CORRECT, answered by CORRECTED of exactly its target
  -- with a confirmed subject, or CLARIFICATION_DECLINED).
  IF p_answers_command_id IS NOT NULL THEN
    SELECT t.id INTO previous_user_turn_id FROM public.conversation_turns t
      WHERE t.session_id=p_session_id AND t.user_id=p_user_id AND t.role='USER' AND t.status<>'CANCELLED' AND t.id<>source_row.id
        AND (t.created_at, t.id) < (source_row.created_at, source_row.id)
      ORDER BY t.created_at DESC, t.id DESC LIMIT 1;
    SELECT * INTO pending FROM public.memory_control_commands c
      WHERE c.id=p_answers_command_id AND c.user_id=p_user_id AND c.session_id=p_session_id AND c.kind=p_kind
        AND (c.outcome = CASE WHEN p_kind='REMEMBER' THEN 'SUBJECT_CLARIFICATION_REQUIRED' ELSE 'CLARIFICATION_REQUIRED' END
             OR (p_kind='CORRECT' AND c.outcome='SUBJECT_CLARIFICATION_REQUIRED'))
      FOR UPDATE;
    IF NOT FOUND OR pending.source_turn_id IS DISTINCT FROM previous_user_turn_id
       OR EXISTS (SELECT 1 FROM public.memory_control_commands a WHERE a.answers_command_id=pending.id)
       OR (pending.outcome='CLARIFICATION_REQUIRED' AND p_target_memory_id IS NOT NULL
           AND NOT (p_target_memory_id = ANY (pending.candidate_memory_ids)))
       OR (p_kind='REMEMBER' AND p_outcome NOT IN ('REMEMBERED','CLARIFICATION_DECLINED'))
       OR (p_kind='CORRECT' AND pending.outcome='SUBJECT_CLARIFICATION_REQUIRED' AND NOT (
             p_outcome='CLARIFICATION_DECLINED'
             OR (p_outcome='CORRECTED' AND p_subject IS NOT NULL AND p_target_memory_id IS NOT DISTINCT FROM pending.target_memory_id)))
    THEN RAISE EXCEPTION 'INVALID_MEMORY_CLARIFICATION_ANSWER' USING ERRCODE='42501'; END IF;
  END IF;
  -- S8B-03 (0186, E8 / E13): what is kept comes from the words of the turn that asked (an answer's own words only choose),
  -- so the Memory's source and score follow that turn's voice source and band: MACHINE_ASR at the band's constant
  -- exactly, never USER_STATED, never from LOW.
  SELECT vs.asr_confidence_band INTO v_origin_band FROM public.conversation_turn_voice_sources vs
   WHERE vs.turn_id = coalesce(pending.source_turn_id, source_row.id) AND vs.user_id = p_user_id;
  v_origin_voice := FOUND;
  IF v_origin_voice AND p_outcome IN ('REMEMBERED','CORRECTED') THEN
    IF v_origin_band NOT IN ('HIGH','MEDIUM') THEN
      RAISE EXCEPTION 'MACHINE_ASR_MEMORY_COMMAND_REFUSED' USING ERRCODE='42501'; END IF;
    IF p_confidence IS DISTINCT FROM voice_private.machine_asr_memory_confidence_v1(v_origin_band) THEN
      RAISE EXCEPTION 'INVALID_MEMORY_SCORE' USING ERRCODE='22023'; END IF;
    v_source := 'MACHINE_ASR';
  END IF;

  IF p_target_memory_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.memories m WHERE m.id=p_target_memory_id AND m.user_id=p_user_id)
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_TARGET' USING ERRCODE='42501'; END IF;
  IF p_equivalent_memory_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.memories m WHERE m.id=p_equivalent_memory_id AND m.user_id=p_user_id)
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_TARGET' USING ERRCODE='42501'; END IF;
  -- L-11: a correction asks whom its new value is about only for a fact whose subject was never established (an
  -- attribution never changes, so the answer finds it the same).
  IF p_kind='CORRECT' AND p_outcome='SUBJECT_CLARIFICATION_REQUIRED' AND public.memory_subject_v1(p_user_id, p_target_memory_id) IS NOT NULL
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023'; END IF;

  IF p_outcome='REMEMBERED' THEN
    IF p_new_memory_id IS NULL THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023'; END IF;
    PERFORM public.assert_canonical_memory_shape_v1(p_type, p_content, v_source, p_confidence, p_importance, 'ACTIVE', p_expires_at);
    successor_subject := p_subject;
    successor_basis := CASE WHEN p_answers_command_id IS NULL THEN 'EXPLICIT_STATEMENT' ELSE 'USER_CLARIFIED' END;
    new_key := public.memory_equivalence_key_v1(btrim(p_content));
    PERFORM public.memory_equivalence_lock_v1(p_user_id);
    PERFORM 1 FROM public.memories m
      WHERE m.user_id=p_user_id AND (m.id=p_equivalent_memory_id
        OR (m.type=p_type AND m.status='ACTIVE' AND public.memory_equivalence_key_v1(m.content)=new_key))
      ORDER BY m.id FOR UPDATE;
    -- The equivalents with a compatible subject, in id order: the class by key, plus the caller's equivalent if it
    -- still qualifies.
    equivalents := ARRAY(
      SELECT m.id FROM public.memories m
       WHERE m.user_id=p_user_id AND m.type=p_type AND m.status='ACTIVE'
         AND (m.expires_at IS NULL OR m.expires_at>CURRENT_TIMESTAMP)
         AND (public.memory_equivalence_key_v1(m.content)=new_key OR m.id=p_equivalent_memory_id)
         AND coalesce(public.memory_subject_v1(p_user_id, m.id), successor_subject) = successor_subject
       ORDER BY m.id);
    SELECT m.* INTO retained FROM public.memories m WHERE m.id = (
      SELECT e FROM unnest(equivalents) AS e WHERE public.memory_subject_v1(p_user_id, e) = successor_subject ORDER BY e LIMIT 1);
    IF retained.id IS NOT NULL THEN
      applied := 'ALREADY_REMEMBERED';
      reply := p_reply_if_existing;
      -- S8B-03 (0186, E9): the user's own typed words remember a fact kept from a voice message: the typed confirmation
      -- is recorded beside it. Its source, score and words never change, and no second Memory is created.
      IF NOT v_origin_voice AND retained.source = 'MACHINE_ASR' THEN
        v_confirm_memory := retained.id;
        v_confirm_turn := coalesce(pending.source_turn_id, source_row.id);
      END IF;
      FOR member IN SELECT e AS id FROM unnest(equivalents) AS e WHERE public.memory_subject_v1(p_user_id, e) IS NULL ORDER BY e LOOP
        PERFORM public.memory_dispose_equivalent_v1(p_user_id, member.id, new_command_id, retained.id, 'RECONFIRMED');
      END LOOP;
    ELSE
      SELECT m.* INTO reconfirmed FROM public.memories m WHERE m.id = (
        SELECT e FROM unnest(equivalents) AS e WHERE public.memory_subject_v1(p_user_id, e) IS NULL ORDER BY e LIMIT 1);
      IF reconfirmed.id IS NOT NULL THEN
        -- RECONFIRMED (A1 C1.3): the existing supersede primitive, so the lineage is one successor in the user's words.
        SELECT * INTO changed FROM public.server_supersede_memory_v1(
          p_user_id, reconfirmed.id, p_new_memory_id, p_type, p_content, v_source, p_confidence, p_importance, 'ACTIVE', p_expires_at);
        IF changed.id IS NULL THEN RAISE EXCEPTION 'MEMORY_EQUIVALENCE_INTEGRITY' USING ERRCODE='55000'; END IF;
        applied := 'RECONFIRMED';
        recorded_target := reconfirmed.id;
      ELSE
        SELECT * INTO changed FROM public.server_create_memory_v1(
          p_user_id, p_new_memory_id, p_type, p_content, v_source, p_confidence, p_importance, 'ACTIVE', p_expires_at);
      END IF;
      result_id := changed.id;
      INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis, command_id)
        VALUES (changed.id, p_user_id, successor_subject, successor_basis, new_command_id);
      -- The other unattributed copies (none exists on a plain create) are retired towards the new Memory.
      FOR member IN SELECT e AS id FROM unnest(equivalents) AS e
                     WHERE public.memory_subject_v1(p_user_id, e) IS NULL AND e IS DISTINCT FROM reconfirmed.id ORDER BY e LOOP
        PERFORM public.memory_dispose_equivalent_v1(p_user_id, member.id, new_command_id, changed.id, 'RECONFIRMED');
      END LOOP;
    END IF;

  ELSIF p_outcome='CORRECTED' THEN
    IF p_new_memory_id IS NULL OR p_target_memory_id IS NULL THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023'; END IF;
    PERFORM public.assert_canonical_memory_shape_v1(p_type, p_content, v_source, p_confidence, p_importance, 'ACTIVE', p_expires_at);
    -- Memory content and type are immutable (0072), so the keys can be read before the locks.
    SELECT * INTO target FROM public.memories m WHERE m.id=p_target_memory_id AND m.user_id=p_user_id;
    target_key := public.memory_equivalence_key_v1(target.content);
    new_key := public.memory_equivalence_key_v1(btrim(p_content));
    PERFORM public.memory_equivalence_lock_v1(p_user_id);
    PERFORM 1 FROM public.memories m
      WHERE m.user_id=p_user_id AND (m.id=p_target_memory_id OR m.id=p_equivalent_memory_id
        OR (m.status='ACTIVE' AND ((m.type=p_type AND public.memory_equivalence_key_v1(m.content)=new_key)
                                OR (m.type=target.type AND public.memory_equivalence_key_v1(m.content)=target_key))))
      ORDER BY m.id FOR UPDATE;
    SELECT * INTO target FROM public.memories m WHERE m.id=p_target_memory_id AND m.user_id=p_user_id;
    IF NOT (target.status='ACTIVE' AND (target.expires_at IS NULL OR target.expires_at>CURRENT_TIMESTAMP)) THEN
      applied := 'TARGET_CHANGED';
    ELSIF public.memory_subject_v1(p_user_id, target.id) IS NULL
          AND EXISTS (SELECT 1 FROM public.memories m
                       WHERE m.user_id=p_user_id AND m.id<>target.id AND m.type=target.type AND m.status='ACTIVE'
                         AND (m.expires_at IS NULL OR m.expires_at>CURRENT_TIMESTAMP)
                         AND public.memory_equivalence_key_v1(m.content)=target_key
                         AND public.memory_subject_v1(p_user_id, m.id) IS NOT NULL) THEN
      -- G-C2 (A): the corrected words are also remembered with an established subject. The server's read offers that
      -- Memory, never an UNATTRIBUTED copy of it, so this is reached only when it appeared after the read: whose fact the
      -- correction meant is not known, and an established fact is never changed because its words match. Nothing changes.
      applied := 'TARGET_CHANGED';
    ELSE
      target_subject := public.memory_subject_v1(p_user_id, target.id);
      successor_subject := coalesce(p_subject, target_subject);
      successor_basis := CASE WHEN p_subject IS NULL THEN 'CORRECTION_INHERITED'
                              WHEN pending.outcome='SUBJECT_CLARIFICATION_REQUIRED' THEN 'USER_CLARIFIED' ELSE 'EXPLICIT_STATEMENT' END;
      recorded_target := target.id;
      -- The replacement's equivalents (never the target). An UNATTRIBUTED successor is compatible with every subject.
      equivalents := ARRAY(
        SELECT m.id FROM public.memories m
         WHERE m.user_id=p_user_id AND m.id<>target.id AND m.type=p_type AND m.status='ACTIVE'
           AND (m.expires_at IS NULL OR m.expires_at>CURRENT_TIMESTAMP)
           AND (public.memory_equivalence_key_v1(m.content)=new_key OR m.id=p_equivalent_memory_id)
           AND (successor_subject IS NULL
                OR coalesce(public.memory_subject_v1(p_user_id, m.id), successor_subject) = successor_subject)
         ORDER BY m.id);
      SELECT m.* INTO retained FROM public.memories m WHERE m.id = (
        SELECT e FROM unnest(equivalents) AS e
         WHERE successor_subject IS NULL OR public.memory_subject_v1(p_user_id, e) = successor_subject ORDER BY e LIMIT 1);
      IF successor_subject IS NULL
         AND EXISTS (SELECT 1 FROM unnest(equivalents) AS e WHERE public.memory_subject_v1(p_user_id, e) IS NOT NULL) THEN
        -- L-11: an UNATTRIBUTED fact's new value is already remembered about the user or about someone else. Whose it is
        -- is never inferred: the server asks first, so this is reached only when such a Memory appeared after its read.
        -- Nothing changes.
        applied := 'TARGET_CHANGED';
      ELSIF retained.id IS NOT NULL THEN
        -- CORRECTED_TO_EXISTING: no second copy. The target is superseded status-only; this command row (target ->
        -- result = the retained Memory) is its auditable relation.
        IF NOT public.memory_status_only_supersede_v1(p_user_id, target.id) THEN
          RAISE EXCEPTION 'MEMORY_EQUIVALENCE_INTEGRITY' USING ERRCODE='55000'; END IF;
        applied := 'CORRECTED_TO_EXISTING';
        reply := p_reply_if_existing;
        result_id := retained.id;
      ELSE
        SELECT * INTO changed FROM public.server_supersede_memory_v1(
          p_user_id, target.id, p_new_memory_id, p_type, p_content, v_source, p_confidence, p_importance, 'ACTIVE', p_expires_at);
        IF changed.id IS NULL THEN RAISE EXCEPTION 'MEMORY_EQUIVALENCE_INTEGRITY' USING ERRCODE='55000'; END IF;
        result_id := changed.id;
        -- S8B-03 (0186, E9, C-57): a typed yes to the one-option question that showed the heard correction (old and new)
        -- confirms the new value as heard; the successor stays MACHINE_ASR.
        IF v_origin_voice AND NOT v_turn_voice AND p_answers_command_id IS NOT NULL
           AND pending.outcome = 'CLARIFICATION_REQUIRED' AND cardinality(pending.candidate_memory_ids) = 1 THEN
          v_confirm_memory := changed.id;
          v_confirm_turn := source_row.id;
        END IF;
        IF successor_subject IS NOT NULL THEN
          INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis, command_id)
            VALUES (changed.id, p_user_id, successor_subject, successor_basis, new_command_id);
        END IF;
      END IF;
      -- Unattributed copies of the new value are retired towards the Memory that now holds it.
      FOR member IN SELECT e AS id FROM unnest(equivalents) AS e
                     WHERE applied <> 'TARGET_CHANGED' AND public.memory_subject_v1(p_user_id, e) IS NULL AND e <> result_id ORDER BY e LOOP
        PERFORM public.memory_dispose_equivalent_v1(p_user_id, member.id, new_command_id, result_id, 'RECONFIRMED');
      END LOOP;
      -- Copies of the corrected fact (a legacy duplicate pair) leave with it: UNATTRIBUTED copies, and copies with the
      -- target's own established subject. An UNATTRIBUTED target never retires a SELF or OTHER copy (G-C2, A).
      FOR member IN
        SELECT m.id FROM public.memories m
         WHERE applied <> 'TARGET_CHANGED'
           AND m.user_id=p_user_id AND m.id<>target.id AND m.id<>result_id AND m.type=target.type AND m.status='ACTIVE'
           AND public.memory_equivalence_key_v1(m.content)=target_key
           AND coalesce(public.memory_subject_v1(p_user_id, m.id), target_subject) IS NOT DISTINCT FROM target_subject
         ORDER BY m.id
      LOOP
        PERFORM public.memory_dispose_equivalent_v1(p_user_id, member.id, new_command_id, target.id, 'CORRECTED');
      END LOOP;
    END IF;

  ELSIF p_outcome='FORGOTTEN' THEN
    IF p_target_memory_id IS NULL THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023'; END IF;
    SELECT * INTO target FROM public.memories m WHERE m.id=p_target_memory_id AND m.user_id=p_user_id;
    target_key := public.memory_equivalence_key_v1(target.content);
    PERFORM public.memory_equivalence_lock_v1(p_user_id);
    PERFORM 1 FROM public.memories m
      WHERE m.user_id=p_user_id AND (m.id=p_target_memory_id
        OR (m.type=target.type AND m.status IN ('ACTIVE','DISABLED') AND public.memory_equivalence_key_v1(m.content)=target_key))
      ORDER BY m.id FOR UPDATE;
    -- Lifecycle deletion, never a physical DELETE (v1). A forgotten fact never survives as a copy: every equivalent
    -- ACTIVE or DISABLED row of the owner with a compatible subject is deleted with it. A copy about someone else is a
    -- different fact and is never deleted because its words match (RC-C2): a SELF target leaves OTHER copies, an OTHER
    -- target leaves SELF copies.
    SELECT * INTO target FROM public.memories m WHERE m.id=p_target_memory_id AND m.user_id=p_user_id;
    target_subject := public.memory_subject_v1(p_user_id, target.id);
    IF target.status IN ('ACTIVE','DISABLED') THEN
      SELECT * INTO changed FROM public.server_mark_memory_deleted_v1(p_user_id, p_target_memory_id);
    ELSIF target.status='DELETED' THEN
      changed := target;
    END IF;
    IF changed.id IS NULL THEN
      applied := 'TARGET_CHANGED';
    ELSE
      recorded_target := target.id;
      FOR member IN
        SELECT m.id FROM public.memories m
         WHERE m.user_id=p_user_id AND m.id<>target.id AND m.type=target.type AND m.status IN ('ACTIVE','DISABLED')
           AND public.memory_equivalence_key_v1(m.content)=target_key
           AND (target_subject IS NULL OR coalesce(public.memory_subject_v1(p_user_id, m.id), target_subject) = target_subject)
         ORDER BY m.id
      LOOP
        PERFORM public.memory_dispose_equivalent_v1(p_user_id, member.id, new_command_id, target.id, 'FORGOTTEN');
      END LOOP;
    END IF;

  ELSIF p_outcome='DISABLED' THEN
    IF p_target_memory_id IS NULL THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023'; END IF;
    SELECT * INTO target FROM public.memories m WHERE m.id=p_target_memory_id AND m.user_id=p_user_id;
    target_key := public.memory_equivalence_key_v1(target.content);
    PERFORM public.memory_equivalence_lock_v1(p_user_id);
    PERFORM 1 FROM public.memories m
      WHERE m.user_id=p_user_id AND (m.id=p_target_memory_id
        OR (m.type=target.type AND m.status='ACTIVE' AND public.memory_equivalence_key_v1(m.content)=target_key))
      ORDER BY m.id FOR UPDATE;
    SELECT * INTO changed FROM public.server_disable_memory_v1(p_user_id, p_target_memory_id);
    IF changed.id IS NULL THEN
      applied := 'TARGET_CHANGED';
    ELSE
      recorded_target := target.id;
      -- The same compatible-subject rule as FORGET (RC-C2): a copy about someone else stays relied on.
      target_subject := public.memory_subject_v1(p_user_id, target.id);
      FOR member IN
        SELECT m.id FROM public.memories m
         WHERE m.user_id=p_user_id AND m.id<>target.id AND m.type=target.type AND m.status='ACTIVE'
           AND (m.expires_at IS NULL OR m.expires_at>CURRENT_TIMESTAMP)
           AND public.memory_equivalence_key_v1(m.content)=target_key
           AND (target_subject IS NULL OR coalesce(public.memory_subject_v1(p_user_id, m.id), target_subject) = target_subject)
         ORDER BY m.id
      LOOP
        PERFORM public.memory_dispose_equivalent_v1(p_user_id, member.id, new_command_id, target.id, 'DISABLED');
      END LOOP;
    END IF;

  ELSIF p_new_memory_id IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023';
  END IF;

  IF applied='TARGET_CHANGED' THEN
    reply := p_reply_if_changed;
    recorded_target := p_target_memory_id;
  END IF;

  INSERT INTO public.memory_control_commands(
    id, user_id, session_id, source_turn_id, kind, outcome, target_memory_id, result_memory_id, candidate_memory_ids, answers_command_id)
  VALUES (
    new_command_id, p_user_id, p_session_id, p_source_turn_id, p_kind, applied,
    CASE WHEN applied IN ('CORRECTED','CORRECTED_TO_EXISTING','FORGOTTEN','DISABLED','TARGET_CHANGED','RECONFIRMED') THEN recorded_target
         WHEN applied='SUBJECT_CLARIFICATION_REQUIRED' AND p_kind='CORRECT' THEN p_target_memory_id END,
    CASE WHEN applied IN ('REMEMBERED','RECONFIRMED','CORRECTED','CORRECTED_TO_EXISTING') THEN result_id END,
    candidates, p_answers_command_id);
  IF v_confirm_memory IS NOT NULL THEN
    PERFORM public.record_memory_typed_confirmation_v1(p_user_id, v_confirm_memory, v_confirm_turn, 'EXPLICIT_MEMORY_COMMAND', new_command_id, NULL);
  END IF;

  SELECT f.user_turn, f.assistant_turn INTO finalized_user, finalized_assistant FROM public.finalize_conversation_turn_v2(
    p_session_id, p_user_id, p_source_turn_id, p_assistant_turn_id, reply, 'ALLOW',
    p_event_id, p_correlation_id, p_orchestration_id, NULL) f;
  -- The source turn is locked GENERATING above, so this cannot happen; if it ever did, nothing above may survive.
  IF finalized_user IS NULL THEN RAISE EXCEPTION 'MEMORY_CONTROL_TURN_NOT_FINALIZED' USING ERRCODE='55000'; END IF;

  RETURN QUERY SELECT applied, finalized_user, finalized_assistant;
END;$$;

-- Forward-replaced from 0173_s8a_03_open_understanding_v1.sql (substitution "open-understanding-v4" in database/voice-notes-0186-substitutions.mjs).
CREATE OR REPLACE FUNCTION public.complete_post_response_personal_capture_v4(
  p_execution_id uuid,
  p_memory_ids uuid[], p_types text[], p_contents text[], p_importances double precision[],
  p_expires_at timestamptz[], p_slots text[], p_temporals text[], p_subjects text[],
  p_person_names text[], p_person_relations text[],
  p_index_memory_ids uuid[], p_index_slots text[], p_index_temporals text[],
  p_term_memory_ids uuid[], p_terms text[],
  p_reaffirmed_memory_ids uuid[], p_ended_memory_ids uuid[],
  p_forget_memory_ids uuid[],
  p_correct_memory_ids uuid[], p_correct_new_ids uuid[], p_correct_types text[], p_correct_contents text[],
  p_correct_importances double precision[], p_correct_slots text[], p_correct_temporals text[],
  p_confirmed_memory_ids uuid[]
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  execution_row public.post_response_intelligence_executions;
  source_row public.conversation_turns;
  item_count integer := coalesce(cardinality(p_memory_ids), 0);
  index_count integer := coalesce(cardinality(p_index_memory_ids), 0);
  reaffirmed_count integer := coalesce(cardinality(p_reaffirmed_memory_ids), 0);
  ended_count integer := coalesce(cardinality(p_ended_memory_ids), 0);
  forget_count integer := coalesce(cardinality(p_forget_memory_ids), 0);
  correct_count integer := coalesce(cardinality(p_correct_memory_ids), 0);
  command_turn boolean;
  history_open boolean := false;
  new_key text;
  equivalent_id uuid;
  created public.memories;
  target_row public.memories;
  target_subject text;
  label_row public.memory_person_labels;
  command_id uuid;
  copy_id uuid;
  created_ids uuid[] := '{}';
  indexed_ids uuid[] := '{}';
  restate_ids uuid[] := coalesce(p_reaffirmed_memory_ids, '{}');
  updated_ids uuid[] := '{}';
  retired_ids uuid[] := '{}';
  retired_keys text[] := '{}';
  target uuid;
  i integer;
  -- S8B-03 (0186, E6 / E9 / E11 / E13): the turn's voice source, read below; a typed turn keeps exactly v3's values.
  confirmed_count integer := coalesce(cardinality(p_confirmed_memory_ids), 0);
  confirmed_ids uuid[] := '{}';
  v_band text;
  v_source text := 'USER_STATED';
  v_confidence double precision := 0.80;
  v_uncertain text[] := '{}';
  v_tokens_known boolean := true;
BEGIN
  IF p_execution_id IS NULL
     OR coalesce(cardinality(p_types), 0) <> item_count OR coalesce(cardinality(p_contents), 0) <> item_count
     OR coalesce(cardinality(p_importances), 0) <> item_count OR coalesce(cardinality(p_expires_at), 0) <> item_count
     OR coalesce(cardinality(p_slots), 0) <> item_count OR coalesce(cardinality(p_temporals), 0) <> item_count
     OR coalesce(cardinality(p_subjects), 0) <> item_count
     OR coalesce(cardinality(p_person_names), 0) <> item_count OR coalesce(cardinality(p_person_relations), 0) <> item_count
     OR coalesce(cardinality(p_index_slots), 0) <> index_count OR coalesce(cardinality(p_index_temporals), 0) <> index_count
     OR coalesce(cardinality(p_term_memory_ids), 0) <> coalesce(cardinality(p_terms), 0)
     OR coalesce(cardinality(p_correct_new_ids), 0) <> correct_count OR coalesce(cardinality(p_correct_types), 0) <> correct_count
     OR coalesce(cardinality(p_correct_contents), 0) <> correct_count OR coalesce(cardinality(p_correct_importances), 0) <> correct_count
     OR coalesce(cardinality(p_correct_slots), 0) <> correct_count OR coalesce(cardinality(p_correct_temporals), 0) <> correct_count
     OR item_count > 6 OR index_count > 4 OR forget_count > 3 OR correct_count > 2
     OR coalesce(cardinality(p_terms), 0) > 64 * (item_count + index_count + correct_count)
     OR reaffirmed_count + ended_count + confirmed_count > 20 OR confirmed_count > 3
     OR array_position(p_confirmed_memory_ids, NULL) IS NOT NULL
     OR EXISTS (SELECT 1 FROM unnest(coalesce(p_confirmed_memory_ids, '{}')) u(id) GROUP BY u.id HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM unnest(coalesce(p_confirmed_memory_ids, '{}')) u(id)
                 WHERE u.id = ANY (coalesce(p_ended_memory_ids, '{}') || coalesce(p_forget_memory_ids, '{}')
                                   || coalesce(p_correct_memory_ids, '{}') || coalesce(p_memory_ids, '{}')
                                   || coalesce(p_correct_new_ids, '{}')))
     OR array_position(p_memory_ids, NULL) IS NOT NULL OR array_position(p_index_memory_ids, NULL) IS NOT NULL
     OR array_position(p_term_memory_ids, NULL) IS NOT NULL
     OR array_position(p_reaffirmed_memory_ids, NULL) IS NOT NULL OR array_position(p_ended_memory_ids, NULL) IS NOT NULL
     OR array_position(p_forget_memory_ids, NULL) IS NOT NULL OR array_position(p_correct_memory_ids, NULL) IS NOT NULL
     OR array_position(p_correct_new_ids, NULL) IS NOT NULL
     OR EXISTS (SELECT 1 FROM unnest(coalesce(p_memory_ids, '{}') || coalesce(p_index_memory_ids, '{}') || coalesce(p_correct_new_ids, '{}')) u(id) GROUP BY u.id HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM unnest(coalesce(p_reaffirmed_memory_ids, '{}') || coalesce(p_ended_memory_ids, '{}')
                                     || coalesce(p_forget_memory_ids, '{}') || coalesce(p_correct_memory_ids, '{}')) u(id) GROUP BY u.id HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM unnest(coalesce(p_reaffirmed_memory_ids, '{}') || coalesce(p_ended_memory_ids, '{}')
                                     || coalesce(p_forget_memory_ids, '{}') || coalesce(p_correct_memory_ids, '{}')) u(id)
                 WHERE u.id = ANY (coalesce(p_memory_ids, '{}') || coalesce(p_correct_new_ids, '{}')))
  THEN
    RAISE EXCEPTION 'INVALID_UNDERSTANDING_CAPTURE' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(p_terms, '{}')) t(term)
              WHERE t.term IS NULL OR char_length(t.term) NOT BETWEEN 2 AND 48 OR t.term !~ '^[^[:space:]]+$')
     OR EXISTS (SELECT 1 FROM unnest(coalesce(p_slots, '{}') || coalesce(p_index_slots, '{}') || coalesce(p_correct_slots, '{}')) s(slot)
                 WHERE s.slot IS NOT NULL AND s.slot NOT IN ('RESIDENCE','OCCUPATION','EMPLOYER','STUDY','MARITAL_STATUS','SMOKING'))
     OR EXISTS (SELECT 1 FROM unnest(coalesce(p_temporals, '{}') || coalesce(p_index_temporals, '{}') || coalesce(p_correct_temporals, '{}')) s(temporal)
                 WHERE s.temporal IS NULL OR s.temporal NOT IN ('CURRENT','PAST','PLANNED','TEMPORARY'))
  THEN
    RAISE EXCEPTION 'INVALID_UNDERSTANDING_CAPTURE' USING ERRCODE='22023';
  END IF;
  FOR i IN 1..item_count LOOP
    PERFORM public.assert_canonical_memory_shape_v1(p_types[i], p_contents[i], 'USER_STATED', 0.80, p_importances[i], 'ACTIVE', p_expires_at[i]);
    IF p_types[i] NOT IN ('STABLE_PREFERENCE','PERSONAL_FACT','GOAL','DECISION_COMMITMENT','RELATIONSHIP_CONTEXT','TEMPORARY_STATE')
       OR char_length(p_contents[i]) > 280
       OR ((p_types[i] = 'TEMPORARY_STATE') <> (p_temporals[i] = 'TEMPORARY'))
       OR ((p_types[i] = 'TEMPORARY_STATE') <> (p_expires_at[i] IS NOT NULL))
       OR (p_expires_at[i] IS NOT NULL AND p_expires_at[i] > CURRENT_TIMESTAMP + interval '15 days')
       OR p_subjects[i] IS NULL OR p_subjects[i] NOT IN ('SELF','OTHER')
       -- The user's own fact never carries a person label; someone else's always does, is never slotted and never temporary.
       OR (p_subjects[i] = 'SELF' AND (p_person_names[i] IS NOT NULL OR p_person_relations[i] IS NOT NULL))
       OR (p_subjects[i] = 'OTHER' AND (p_person_names[i] IS NULL AND p_person_relations[i] IS NULL))
       OR (p_subjects[i] = 'OTHER' AND (p_slots[i] IS NOT NULL OR p_temporals[i] = 'TEMPORARY'))
       OR char_length(btrim(coalesce(p_person_names[i], 'x'))) NOT BETWEEN 1 AND 40
       OR char_length(btrim(coalesce(p_person_relations[i], 'x'))) NOT BETWEEN 1 AND 40
    THEN
      RAISE EXCEPTION 'INVALID_UNDERSTANDING_CAPTURE' USING ERRCODE='22023';
    END IF;
  END LOOP;
  FOR i IN 1..correct_count LOOP
    PERFORM public.assert_canonical_memory_shape_v1(p_correct_types[i], p_correct_contents[i], 'USER_STATED', 0.80, p_correct_importances[i], 'ACTIVE', NULL);
    IF p_correct_types[i] NOT IN ('STABLE_PREFERENCE','PERSONAL_FACT','GOAL','DECISION_COMMITMENT','RELATIONSHIP_CONTEXT')
       OR char_length(p_correct_contents[i]) > 280 OR p_correct_temporals[i] = 'TEMPORARY' THEN
      RAISE EXCEPTION 'INVALID_UNDERSTANDING_CAPTURE' USING ERRCODE='22023';
    END IF;
  END LOOP;

  SELECT * INTO execution_row FROM public.post_response_intelligence_executions
   WHERE id = p_execution_id AND state = 'RUNNING' FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
       SELECT 1 FROM public.post_response_intelligence_effects f
        WHERE f.execution_id = p_execution_id AND f.effect_key = 'UNDERSTANDING_CAPTURE_PROVIDER' AND f.state = 'CLAIMED') THEN
    RETURN 'NO_OP';
  END IF;

  PERFORM public.memory_equivalence_lock_v1(execution_row.user_id);
  command_turn := EXISTS (SELECT 1 FROM public.memory_control_commands c
                           WHERE c.source_turn_id = execution_row.source_turn_id AND c.user_id = execution_row.user_id);
  SELECT * INTO source_row FROM public.conversation_turns t
   WHERE t.id = execution_row.source_turn_id AND t.user_id = execution_row.user_id;
  -- S8B-03 (0186, §4.9.3): the turn's voice source decides the source, the score and the operations, read here and never
  -- taken from the caller. HIGH adds and changes with full lineage and never forgets; MEDIUM adds about the user and
  -- restates, and never writes about someone else or changes anything; LOW only indexes earlier Memories. A person
  -- label containing a word heard below T_HIGH is refused (E11); when those words are no longer known (the
  -- recording was deleted or expired), no label is accepted. A typed confirmation comes only from typed words.
  SELECT vs.asr_confidence_band INTO v_band FROM public.conversation_turn_voice_sources vs
   WHERE vs.turn_id = source_row.id AND vs.user_id = execution_row.user_id;
  IF FOUND THEN
    v_source := 'MACHINE_ASR';
    v_confidence := voice_private.machine_asr_memory_confidence_v1(v_band);
    SELECT n.uncertain_tokens INTO v_uncertain FROM voice_private.note_transcriptions n
      JOIN voice_private.recordings r ON r.id = n.recording_id
     WHERE n.committed_turn_id = source_row.id AND n.user_id = execution_row.user_id AND r.recording_state = 'STORED';
    v_tokens_known := FOUND;
    v_uncertain := coalesce(v_uncertain, '{}');
    IF forget_count > 0 OR confirmed_count > 0
       OR (v_confidence IS NULL AND (item_count > 0 OR correct_count > 0 OR reaffirmed_count > 0 OR ended_count > 0))
       OR (v_band = 'MEDIUM' AND (correct_count > 0 OR ended_count > 0 OR 'OTHER' = ANY (coalesce(p_subjects, '{}'))))
       OR (NOT v_tokens_known AND 'OTHER' = ANY (coalesce(p_subjects, '{}')))
       OR EXISTS (SELECT 1 FROM unnest(coalesce(p_person_names, '{}') || coalesce(p_person_relations, '{}')) l(label),
                         regexp_split_to_table(public.memory_equivalence_key_v1(l.label), ' ') w(word)
                   WHERE l.label IS NOT NULL AND w.word <> ''
                     AND w.word IN (SELECT public.memory_equivalence_key_v1(u.token) FROM unnest(v_uncertain) u(token)))
    THEN
      RAISE EXCEPTION 'INVALID_UNDERSTANDING_CAPTURE' USING ERRCODE='22023';
    END IF;
  END IF;

  -- (a) Forget and correct first, so nothing this same message proposes can bring the withdrawn words back.
  IF NOT command_turn THEN
    FOREACH target IN ARRAY coalesce(p_forget_memory_ids, '{}') LOOP
      SELECT * INTO target_row FROM public.memories m
       WHERE m.id = target AND m.user_id = execution_row.user_id AND m.status = 'ACTIVE'
         AND m.type NOT IN ('INTERACTION_PREFERENCE','DERIVED_INSIGHT') AND m.created_at < source_row.created_at
       FOR UPDATE;
      CONTINUE WHEN NOT FOUND;
      IF NOT history_open THEN PERFORM public.historical_capture_begin_v1(execution_row.user_id, execution_row.session_id, true); history_open := true; END IF;
      command_id := gen_random_uuid();
      INSERT INTO public.background_memory_commands (id, user_id, session_id, source_turn_id, execution_id, kind, target_memory_id)
        VALUES (command_id, execution_row.user_id, execution_row.session_id, source_row.id, execution_row.id, 'FORGET', target);
      PERFORM 1 FROM public.server_mark_memory_deleted_v1(execution_row.user_id, target);
      new_key := public.memory_equivalence_key_v1(target_row.content);
      retired_keys := retired_keys || new_key;
      FOR copy_id IN SELECT m.id FROM public.memories m
                      WHERE m.user_id = execution_row.user_id AND m.status = 'ACTIVE' AND m.id <> target
                        AND public.memory_equivalence_key_v1(m.content) = new_key ORDER BY m.id LOOP
        PERFORM public.memory_dispose_equivalent_v1(execution_row.user_id, copy_id, command_id, target, 'FORGOTTEN');
      END LOOP;
      retired_ids := retired_ids || target;
    END LOOP;
    FOR i IN 1..correct_count LOOP
      SELECT * INTO target_row FROM public.memories m
       WHERE m.id = p_correct_memory_ids[i] AND m.user_id = execution_row.user_id AND m.status = 'ACTIVE'
         AND m.type NOT IN ('INTERACTION_PREFERENCE','DERIVED_INSIGHT') AND m.created_at < source_row.created_at
       FOR UPDATE;
      CONTINUE WHEN NOT FOUND;
      target_subject := public.memory_subject_v1(execution_row.user_id, target_row.id);
      CONTINUE WHEN target_subject IS NULL OR (target_subject = 'OTHER' AND p_correct_slots[i] IS NOT NULL);
      IF NOT history_open THEN PERFORM public.historical_capture_begin_v1(execution_row.user_id, execution_row.session_id, true); history_open := true; END IF;
      command_id := gen_random_uuid();
      SELECT * INTO created FROM public.server_supersede_memory_v1(execution_row.user_id, target_row.id, p_correct_new_ids[i],
        p_correct_types[i], p_correct_contents[i], v_source, v_confidence, p_correct_importances[i], 'ACTIVE', NULL);
      CONTINUE WHEN created.id IS NULL;
      INSERT INTO public.background_memory_commands (id, user_id, session_id, source_turn_id, execution_id, kind, target_memory_id, new_memory_id)
        VALUES (command_id, execution_row.user_id, execution_row.session_id, source_row.id, execution_row.id, 'CORRECT', target_row.id, created.id);
      INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis, execution_id)
        VALUES (created.id, execution_row.user_id, target_subject,
                CASE target_subject WHEN 'SELF' THEN 'MODEL_ASSISTED_CAPTURE' ELSE 'MODEL_ASSISTED_RELATION_CAPTURE' END, execution_row.id);
      SELECT * INTO label_row FROM public.memory_person_labels l WHERE l.memory_id = target_row.id AND l.user_id = execution_row.user_id;
      IF FOUND THEN
        INSERT INTO public.memory_person_labels (memory_id, user_id, person_name, person_relation, execution_id)
          VALUES (created.id, execution_row.user_id, label_row.person_name, label_row.person_relation, execution_row.id);
      END IF;
      INSERT INTO public.memory_retrieval_profiles (memory_id, user_id, semantic_indexed, slot, temporal)
        VALUES (created.id, execution_row.user_id, true, p_correct_slots[i], p_correct_temporals[i]);
      new_key := public.memory_equivalence_key_v1(target_row.content);
      retired_keys := retired_keys || new_key;
      FOR copy_id IN SELECT m.id FROM public.memories m
                      WHERE m.user_id = execution_row.user_id AND m.status = 'ACTIVE' AND m.id <> created.id
                        AND public.memory_equivalence_key_v1(m.content) = new_key ORDER BY m.id LOOP
        PERFORM public.memory_dispose_equivalent_v1(execution_row.user_id, copy_id, command_id, created.id, 'CORRECTED');
      END LOOP;
      created_ids := created_ids || created.id;
      retired_ids := retired_ids || target_row.id;
    END LOOP;
  END IF;

  -- (b) New atomic Memories.
  FOR i IN 1..item_count LOOP
    EXIT WHEN command_turn;
    new_key := public.memory_equivalence_key_v1(btrim(p_contents[i]));
    CONTINUE WHEN new_key = ANY (retired_keys);
    PERFORM 1 FROM public.memories m
      WHERE m.user_id = execution_row.user_id AND m.type = p_types[i] AND m.status = 'ACTIVE'
        AND public.memory_equivalence_key_v1(m.content) = new_key
      ORDER BY m.id FOR UPDATE;
    -- 0152 SUPERSEDED_BY_LATER_COMMAND, as 0171 / 0172 ...
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.memory_control_commands c
        JOIN public.conversation_turns later ON later.id = c.source_turn_id
        JOIN public.memories m ON m.user_id = c.user_id
          AND (m.id = c.target_memory_id
               OR m.id IN (SELECT d.memory_id FROM public.memory_equivalence_dispositions d
                            WHERE d.command_id = c.id AND d.disposition IN ('FORGOTTEN','DISABLED','CORRECTED')))
       WHERE c.user_id = execution_row.user_id
         AND c.outcome IN ('FORGOTTEN','DISABLED','CORRECTED','CORRECTED_TO_EXISTING')
         AND m.type = p_types[i] AND public.memory_equivalence_key_v1(m.content) = new_key
         AND (later.created_at, later.id) > (source_row.created_at, source_row.id));
    -- ... and the same for a later background forget / correct: an older message never brings its words back.
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.background_memory_commands c
        JOIN public.conversation_turns later ON later.id = c.source_turn_id
        JOIN public.memories m ON m.user_id = c.user_id AND m.id = c.target_memory_id
       WHERE c.user_id = execution_row.user_id
         AND public.memory_equivalence_key_v1(m.content) = new_key
         AND (later.created_at, later.id) > (source_row.created_at, source_row.id));
    IF p_subjects[i] = 'SELF' THEN
      SELECT m.id INTO equivalent_id FROM public.memories m
       WHERE m.user_id = execution_row.user_id AND m.status = 'ACTIVE'
         AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
         AND public.memory_equivalence_key_v1(m.content) = new_key
         AND coalesce(public.memory_subject_v1(execution_row.user_id, m.id), 'SELF') = 'SELF'
       ORDER BY m.created_at, m.id LIMIT 1;
      IF equivalent_id IS NOT NULL THEN
        IF NOT equivalent_id = ANY (restate_ids || coalesce(p_ended_memory_ids, '{}')) THEN restate_ids := restate_ids || equivalent_id; END IF;
        CONTINUE;
      END IF;
    ELSE
      CONTINUE WHEN EXISTS (
        SELECT 1 FROM public.memories m
         WHERE m.user_id = execution_row.user_id AND m.status = 'ACTIVE'
           AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
           AND public.memory_equivalence_key_v1(m.content) = new_key);
    END IF;
    IF NOT history_open THEN PERFORM public.historical_capture_begin_v1(execution_row.user_id, execution_row.session_id, true); history_open := true; END IF;
    SELECT * INTO created FROM public.server_create_memory_v1(execution_row.user_id, p_memory_ids[i], p_types[i], p_contents[i],
      v_source, v_confidence, p_importances[i], 'ACTIVE', p_expires_at[i]);
    INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis, execution_id)
      VALUES (created.id, execution_row.user_id, p_subjects[i],
              CASE p_subjects[i] WHEN 'SELF' THEN 'MODEL_ASSISTED_CAPTURE' ELSE 'MODEL_ASSISTED_RELATION_CAPTURE' END, execution_row.id);
    IF p_subjects[i] = 'OTHER' THEN
      INSERT INTO public.memory_person_labels (memory_id, user_id, person_name, person_relation, execution_id)
        VALUES (created.id, execution_row.user_id, nullif(btrim(p_person_names[i]), ''), nullif(btrim(p_person_relations[i]), ''), execution_row.id);
    END IF;
    INSERT INTO public.memory_retrieval_profiles (memory_id, user_id, semantic_indexed, slot, temporal)
      VALUES (created.id, execution_row.user_id, true, p_slots[i], p_temporals[i]);
    created_ids := created_ids || created.id;
  END LOOP;

  -- (c) Backfill index, exactly as 0172.
  FOR i IN 1..index_count LOOP
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM public.memories m
       WHERE m.id = p_index_memory_ids[i] AND m.user_id = execution_row.user_id AND m.status = 'ACTIVE'
         AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP) AND m.type <> 'INTERACTION_PREFERENCE');
    INSERT INTO public.memory_retrieval_profiles AS p (memory_id, user_id, semantic_indexed, slot, temporal)
      VALUES (p_index_memory_ids[i], execution_row.user_id, true, p_index_slots[i], p_index_temporals[i])
      ON CONFLICT (memory_id) DO UPDATE SET semantic_indexed = true, slot = EXCLUDED.slot, temporal = EXCLUDED.temporal
        WHERE NOT p.semantic_indexed;
    CONTINUE WHEN NOT FOUND;
    indexed_ids := indexed_ids || p_index_memory_ids[i];
  END LOOP;

  INSERT INTO public.memory_retrieval_terms (memory_id, user_id, term)
    SELECT DISTINCT t.memory_id, execution_row.user_id, t.term
      FROM unnest(coalesce(p_term_memory_ids, '{}'), coalesce(p_terms, '{}')) AS t(memory_id, term)
     WHERE t.memory_id = ANY (created_ids || indexed_ids)
    ON CONFLICT DO NOTHING;
  IF EXISTS (SELECT 1 FROM public.memory_retrieval_terms t WHERE t.memory_id = ANY (created_ids || indexed_ids)
              GROUP BY t.memory_id HAVING count(*) > 64) THEN
    RAISE EXCEPTION 'INVALID_UNDERSTANDING_CAPTURE' USING ERRCODE='22023';
  END IF;

  -- (d) The living state, SELF and OTHER alike: the owner's ACTIVE, unexpired Memory, created before this message, never
  --     moved by a message older than its last statement. A Memory forgotten or corrected since the read is skipped.
  IF NOT command_turn THEN
    FOREACH target IN ARRAY coalesce(p_ended_memory_ids, '{}') LOOP
      CONTINUE WHEN NOT EXISTS (
        SELECT 1 FROM public.memories m
         WHERE m.id = target AND m.user_id = execution_row.user_id AND m.status = 'ACTIVE'
           AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
           AND m.type NOT IN ('INTERACTION_PREFERENCE','DERIVED_INSIGHT')
           AND m.created_at < source_row.created_at
           AND public.memory_subject_v1(execution_row.user_id, m.id) IN ('SELF','OTHER'));
      INSERT INTO public.memory_retrieval_profiles AS p (memory_id, user_id, semantic_indexed, slot, temporal, ended_at, ended_execution_id)
        VALUES (target, execution_row.user_id, false, NULL, 'PAST', CURRENT_TIMESTAMP, execution_row.id)
        ON CONFLICT (memory_id) DO UPDATE SET temporal = 'PAST', ended_at = CURRENT_TIMESTAMP, ended_execution_id = execution_row.id
          WHERE p.ended_at IS NULL AND (p.last_stated_at IS NULL OR p.last_stated_at < source_row.created_at);
      CONTINUE WHEN NOT FOUND;
      updated_ids := updated_ids || target;
    END LOOP;
    -- S8B-03 (0186, E9, M-03): an item the typed message explicitly confirms gains its typed confirmation and counts as a
    -- restatement. Its source, score and words never change; only an earlier MACHINE_ASR Memory qualifies.
    FOREACH target IN ARRAY coalesce(p_confirmed_memory_ids, '{}') LOOP
      CONTINUE WHEN NOT EXISTS (SELECT 1 FROM public.memories m
                                 WHERE m.id = target AND m.user_id = execution_row.user_id AND m.created_at < source_row.created_at);
      CONTINUE WHEN NOT public.record_memory_typed_confirmation_v1(execution_row.user_id, target, source_row.id,
                                                                  'MODEL_ASSISTED_CONFIRMATION', NULL, execution_row.id);
      confirmed_ids := confirmed_ids || target;
      IF NOT target = ANY (restate_ids) THEN restate_ids := restate_ids || target; END IF;
    END LOOP;
    FOREACH target IN ARRAY restate_ids LOOP
      CONTINUE WHEN target = ANY (updated_ids) OR NOT EXISTS (
        SELECT 1 FROM public.memories m
         WHERE m.id = target AND m.user_id = execution_row.user_id AND m.status = 'ACTIVE'
           AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
           AND m.type NOT IN ('INTERACTION_PREFERENCE','DERIVED_INSIGHT')
           AND m.created_at < source_row.created_at
           AND public.memory_subject_v1(execution_row.user_id, m.id) IN ('SELF','OTHER'));
      INSERT INTO public.memory_retrieval_profiles AS p (memory_id, user_id, semantic_indexed, slot, temporal, last_stated_at, restated_count)
        VALUES (target, execution_row.user_id, false, NULL, NULL, source_row.created_at, 1)
        ON CONFLICT (memory_id) DO UPDATE SET last_stated_at = source_row.created_at, restated_count = p.restated_count + 1
          WHERE p.ended_at IS NULL AND (p.last_stated_at IS NULL OR p.last_stated_at < source_row.created_at);
      CONTINUE WHEN NOT FOUND;
      updated_ids := updated_ids || target;
    END LOOP;
  END IF;
  updated_ids := updated_ids || ARRAY(SELECT c FROM unnest(confirmed_ids) c WHERE NOT c = ANY (updated_ids));

  DELETE FROM public.memory_retrieval_terms t USING public.memories m
   WHERE t.memory_id = m.id AND t.user_id = m.user_id AND m.user_id = execution_row.user_id
     AND m.expires_at IS NOT NULL AND m.expires_at <= CURRENT_TIMESTAMP;
  DELETE FROM public.memory_retrieval_profiles p USING public.memories m
   WHERE p.memory_id = m.id AND p.user_id = m.user_id AND m.user_id = execution_row.user_id
     AND m.expires_at IS NOT NULL AND m.expires_at <= CURRENT_TIMESTAMP;

  UPDATE public.post_response_intelligence_effects
     SET state = 'COMPLETED', completed_at = CURRENT_TIMESTAMP,
         result_code = CASE WHEN cardinality(created_ids) + cardinality(indexed_ids) + cardinality(updated_ids) + cardinality(retired_ids) = 0
           THEN 'NO_UNDERSTANDING_RECORDED' ELSE 'UNDERSTANDING_RECORDED' END,
         result_payload = CASE WHEN cardinality(created_ids) + cardinality(indexed_ids) + cardinality(updated_ids) + cardinality(retired_ids) = 0 THEN NULL
           ELSE jsonb_build_object('memoryIds', to_jsonb(created_ids::text[]), 'indexedMemoryIds', to_jsonb(indexed_ids::text[]),
                                   'updatedMemoryIds', to_jsonb(updated_ids::text[]), 'retiredMemoryIds', to_jsonb(retired_ids::text[])) END
   WHERE execution_id = p_execution_id AND effect_key = 'UNDERSTANDING_CAPTURE_PROVIDER' AND state = 'CLAIMED';
  IF NOT FOUND THEN RAISE EXCEPTION 'UNDERSTANDING_CAPTURE_COMPLETION_LOST' USING ERRCODE='55000'; END IF;
  RETURN 'COMPLETED';
END;$$;

-- Forward-replaced from 0173_s8a_03_open_understanding_v1.sql (substitution "known-memories-v2" in database/voice-notes-0186-substitutions.mjs).
CREATE OR REPLACE FUNCTION public.background_known_memories_v2(p_source_turn_id uuid, p_limit integer)
RETURNS TABLE(memory_id uuid, type text, content text, subject text, person_name text, person_relation text,
  temporal text, ended boolean, terms text[], source text, confirmed_by_typing boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id uuid;
BEGIN
  IF p_source_turn_id IS NULL OR p_limit IS NULL OR p_limit < 0 THEN
    RAISE EXCEPTION 'INVALID_UNDERSTANDING_STATE_REQUEST' USING ERRCODE='22023';
  END IF;
  SELECT e.user_id INTO owner_id FROM public.post_response_intelligence_executions e
   WHERE e.source_turn_id = p_source_turn_id AND e.state = 'RUNNING';
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'UNDERSTANDING_EXECUTION_NOT_ASSOCIATED' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
    SELECT m.id, m.type, m.content, coalesce(a.subject, 'UNATTRIBUTED'), l.person_name, l.person_relation,
           p.temporal, p.ended_at IS NOT NULL,
           ARRAY(SELECT t.term FROM public.memory_retrieval_terms t WHERE t.memory_id = m.id AND t.user_id = m.user_id ORDER BY t.term),
           -- S8B-03 (0186, E5): the source reaches the model, and so does a typed confirmation of a MACHINE_ASR item.
           m.source,
           EXISTS (SELECT 1 FROM public.memory_typed_confirmations c WHERE c.memory_id = m.id AND c.user_id = m.user_id)
      FROM public.memories m
      LEFT JOIN public.memory_subject_attributions a ON a.memory_id = m.id AND a.user_id = m.user_id
      LEFT JOIN public.memory_retrieval_profiles p ON p.memory_id = m.id AND p.user_id = m.user_id
      LEFT JOIN public.memory_person_labels l ON l.memory_id = m.id AND l.user_id = m.user_id
     WHERE m.user_id = owner_id AND m.status = 'ACTIVE'
       AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
       AND m.type NOT IN ('INTERACTION_PREFERENCE','DERIVED_INSIGHT')
     ORDER BY
       CASE WHEN p.ended_at IS NOT NULL OR p.temporal = 'PAST' THEN 6
            WHEN a.subject = 'OTHER' OR m.type = 'RELATIONSHIP_CONTEXT' THEN 0
            WHEN a.subject = 'SELF' AND p.slot IS NOT NULL AND p.temporal = 'CURRENT' THEN 1
            WHEN m.type = 'GOAL' THEN 2
            WHEN m.type IN ('TEMPORARY_STATE','DECISION_COMMITMENT') OR p.temporal IN ('PLANNED','TEMPORARY') THEN 3
            WHEN a.subject IS NULL THEN 5
            ELSE 4 END,
       coalesce(p.last_stated_at, m.created_at) DESC, m.id DESC
     LIMIT least(p_limit, 40);
END;$$;

-- Forward-replaced from 0183_s8b_02_voice_foundation_v1.sql (substitution "voice-erasure" in database/voice-notes-0186-substitutions.mjs).
CREATE OR REPLACE FUNCTION account_erasure_private.erase_voice_v1(p_deletion_id uuid, p_user uuid) RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_recordings uuid[];
  v_keys integer;
BEGIN
  SELECT coalesce(array_agg(r.id ORDER BY r.id), ARRAY[]::uuid[]) INTO v_recordings
    FROM voice_private.recordings r WHERE r.user_id = p_user;
  INSERT INTO introduction_sharing_private.media_erasure_queue (storage_key, not_before)
  SELECT o.storage_key,
         CASE WHEN o.object_state = 'PENDING_UPLOAD'
              THEN greatest(clock_timestamp(), o.upload_deadline + voice_private.late_upload_grace_v1())
              ELSE clock_timestamp() END
    FROM voice_private.recording_objects o WHERE o.recording_id = ANY (v_recordings)
  ON CONFLICT ON CONSTRAINT media_erasure_queue_pk DO NOTHING;
  INSERT INTO account_erasure_private.media_pending (deletion_id, storage_key)
  SELECT p_deletion_id, o.storage_key FROM voice_private.recording_objects o WHERE o.recording_id = ANY (v_recordings)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_keys = ROW_COUNT;
  DELETE FROM public.conversation_turn_voice_sources vs WHERE vs.user_id = p_user;
  -- S8B-03 (0186, §4.6 rule 10): the transcription state and its provider attempts leave with their recordings.
  DELETE FROM voice_private.note_transcription_attempts a WHERE a.recording_id = ANY (v_recordings);
  DELETE FROM voice_private.note_transcriptions n WHERE n.recording_id = ANY (v_recordings);
  DELETE FROM voice_private.recording_gaps g WHERE g.recording_id = ANY (v_recordings);
  DELETE FROM voice_private.recording_objects o WHERE o.recording_id = ANY (v_recordings);
  DELETE FROM voice_private.recordings r WHERE r.id = ANY (v_recordings);
  RETURN v_keys;
END$$;

-- Forward-replaced from 0183_s8b_02_voice_foundation_v1.sql (substitution "voice-erasure-residue" in database/voice-notes-0186-substitutions.mjs).
CREATE OR REPLACE FUNCTION account_erasure_private.voice_module_residue_v1(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM voice_private.recordings r WHERE r.user_id = p_user)
      OR EXISTS (SELECT 1 FROM public.conversation_turn_voice_sources vs WHERE vs.user_id = p_user)
      -- S8B-03 (0186, §4.6 rule 10)
      OR EXISTS (SELECT 1 FROM voice_private.note_transcriptions n WHERE n.user_id = p_user)
      OR EXISTS (SELECT 1 FROM voice_private.note_transcription_attempts a WHERE a.user_id = p_user);
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. OPEN UNDERSTANDING v3 DELEGATES TO v4 (E3 / E4 / E5 / E9). The v3 signature is kept for any caller; it now runs the
--    one voice-aware capture with no typed confirmations, so no path reaches the Memory of a voice turn without the
--    voice rules.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_post_response_personal_capture_v3(
  p_execution_id uuid,
  p_memory_ids uuid[], p_types text[], p_contents text[], p_importances double precision[],
  p_expires_at timestamptz[], p_slots text[], p_temporals text[], p_subjects text[],
  p_person_names text[], p_person_relations text[],
  p_index_memory_ids uuid[], p_index_slots text[], p_index_temporals text[],
  p_term_memory_ids uuid[], p_terms text[],
  p_reaffirmed_memory_ids uuid[], p_ended_memory_ids uuid[],
  p_forget_memory_ids uuid[],
  p_correct_memory_ids uuid[], p_correct_new_ids uuid[], p_correct_types text[], p_correct_contents text[],
  p_correct_importances double precision[], p_correct_slots text[], p_correct_temporals text[]
) RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  -- S8B-03 (0186): the v3 command is v4 with no typed confirmations.
  SELECT public.complete_post_response_personal_capture_v4(
    p_execution_id, p_memory_ids, p_types, p_contents, p_importances, p_expires_at, p_slots, p_temporals, p_subjects,
    p_person_names, p_person_relations, p_index_memory_ids, p_index_slots, p_index_temporals, p_term_memory_ids, p_terms,
    p_reaffirmed_memory_ids, p_ended_memory_ids, p_forget_memory_ids, p_correct_memory_ids, p_correct_new_ids,
    p_correct_types, p_correct_contents, p_correct_importances, p_correct_slots, p_correct_temporals, '{}'::uuid[]);
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 9. THE COMMAND SHAPES: the 0152 disjuncts verbatim, then the one S8B-03 disjunct (E7): a voice command that was not
--    heard clearly names nothing and answers nothing. Every existing row satisfies an unchanged disjunct.
-- ---------------------------------------------------------------------------------------------------------------------
ALTER TABLE public.memory_control_commands DROP CONSTRAINT memory_control_commands_shape_check;
ALTER TABLE public.memory_control_commands ADD CONSTRAINT memory_control_commands_shape_check CHECK (
    (kind='INSPECT' AND outcome IN ('INSPECTED','NOTHING_REMEMBERED')
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NULL)
    OR (kind='REMEMBER' AND outcome='REMEMBERED'
      AND target_memory_id IS NULL AND result_memory_id IS NOT NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NULL)
    OR (kind='REMEMBER' AND outcome IN ('ALREADY_REMEMBERED','DECLINED_SENSITIVE')
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NULL)
    OR (kind='CORRECT' AND outcome='CORRECTED'
      AND target_memory_id IS NOT NULL AND result_memory_id IS NOT NULL AND cardinality(candidate_memory_ids)=0)
    OR (kind='CORRECT' AND outcome IN ('ALREADY_CORRECT','DECLINED_SENSITIVE')
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0)
    OR (kind IN ('FORGET','DISABLE') AND outcome IN ('FORGOTTEN','DISABLED')
      AND outcome=CASE kind WHEN 'FORGET' THEN 'FORGOTTEN' ELSE 'DISABLED' END
      AND target_memory_id IS NOT NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0)
    OR (kind IN ('FORGET','DISABLE') AND outcome IN ('TARGET_NOT_FOUND','TARGET_NOT_SPECIFIED')
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NULL)
    OR (kind IN ('CORRECT','FORGET','DISABLE') AND outcome='CLARIFICATION_REQUIRED'
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids) BETWEEN 1 AND 3)
    OR (kind IN ('CORRECT','FORGET','DISABLE') AND outcome='TARGET_CHANGED'
      AND target_memory_id IS NOT NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0)
    OR (kind IN ('CORRECT','FORGET','DISABLE') AND outcome='CLARIFICATION_DECLINED'
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NOT NULL)
    -- MEM-AR-01C (0152)
    OR (kind='REMEMBER' AND outcome='SUBJECT_CLARIFICATION_REQUIRED'
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NULL)
    OR (kind='REMEMBER' AND outcome='REMEMBERED'
      AND target_memory_id IS NULL AND result_memory_id IS NOT NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NOT NULL)
    OR (kind='REMEMBER' AND outcome='ALREADY_REMEMBERED'
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NOT NULL)
    OR (kind='REMEMBER' AND outcome='RECONFIRMED'
      AND target_memory_id IS NOT NULL AND result_memory_id IS NOT NULL AND cardinality(candidate_memory_ids)=0)
    OR (kind='REMEMBER' AND outcome='CLARIFICATION_DECLINED'
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NOT NULL)
    OR (kind='CORRECT' AND outcome='CORRECTED_TO_EXISTING'
      AND target_memory_id IS NOT NULL AND result_memory_id IS NOT NULL AND cardinality(candidate_memory_ids)=0)
    -- L-11 (Product Owner, 2026-10-12): the subject question of a correction names the exact fact it would correct.
    OR (kind='CORRECT' AND outcome='SUBJECT_CLARIFICATION_REQUIRED'
      AND target_memory_id IS NOT NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0)
    -- S8B-03 (0186), E7: a voice command not heard clearly names nothing and answers nothing.
    OR (kind IN ('REMEMBER','CORRECT','FORGET','DISABLE') AND outcome='NOT_HEARD_CLEARLY'
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NULL)
);

-- ---------------------------------------------------------------------------------------------------------------------
-- 10. THE APPROVED CONSENT TEXT (Copy Gate C-01 ... C-11, Product Owner, 2026-10-31): each row on its own line, verbatim.
-- ---------------------------------------------------------------------------------------------------------------------
SELECT voice_private.install_consent_text_v1('VOICE_RECORDING_V1',
$consent_ar$التسجيل الصوتي في قنديل
تُحفظ كل رسالة صوتية تُرسل إلى قنديل تسجيلًا صوتيًا.
تُحفظ التسجيلات 30 يومًا من وصولها إلى قنديل، ثم تُحذف تلقائيًا. ويمكن حذف أي تسجيل قبل ذلك.
يُحوَّل التسجيل إلى نص يفهمه قنديل ويرد عليه، ويمكن الاستماع إليه طوال مدة حفظه.
يبقى النص المستخرج في المحادثة بعد حذف التسجيل أو انتهاء مدته، ويبقى ما تذكّره قنديل منه حتى يُصحَّح أو يُطلب نسيانه.
يحوّل مزوّد خدمة خارجي الكلام إلى نص، ويطلب قنديل منه حذف التسجيل بعد التحويل مباشرة.
قد يلتقط التسجيل أصواتًا قريبة.
النسخة التي تُنزَّل أو تُشارَك تخرج من قنديل ولا يمكن استرجاعها.
يمكن سحب الموافقة في أي وقت من الإعدادات. سحبها يوقف الرسائل الصوتية الجديدة ولا يحذف التسجيلات الحالية.
أوافق وأتابع
ليس الآن$consent_ar$,
$consent_en$Voice recording in Qandeel
Each voice message sent to Qandeel is kept as an audio recording.
Recordings are kept for 30 days after they reach Qandeel, then deleted automatically. Any recording can be deleted sooner.
The recording is converted to text that Qandeel understands and replies to, and it can be listened to while it's kept.
The transcribed text stays in the conversation after the recording is deleted or expires, and what Qandeel remembers from it stays until it's corrected or forgotten on request.
An external service provider converts speech to text, and Qandeel asks it to delete the recording right after conversion.
A recording may capture nearby voices.
A downloaded or shared copy leaves Qandeel and cannot be recalled.
Consent can be withdrawn at any time in Settings. Withdrawing it stops new voice messages and doesn't delete existing recordings.
Agree and continue
Not now$consent_en$);


-- ---------------------------------------------------------------------------------------------------------------------
-- 11. ACCOUNT ERASURE COVERAGE: both transcription relations are deleted by the voice module (forward-replaced above).
-- ---------------------------------------------------------------------------------------------------------------------
INSERT INTO account_erasure_private.coverage_registry (relation, coverage) VALUES
    ('voice_private.note_transcriptions', 'VOICE'),
    ('voice_private.note_transcription_attempts', 'VOICE');

-- ---------------------------------------------------------------------------------------------------------------------
-- 12. OWNERSHIP, RLS AND ACL. The transcription relations: postgres-owned, RLS on, no policy, revoked from every role. Every
--     new function: postgres-owned, revoked from every role; the server_* definers, Open Understanding v4 and the
--     known-memories read v2 are granted to service_role only.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  rel text;
  fn text;
  r text;
BEGIN
  FOREACH rel IN ARRAY ARRAY['voice_private.note_transcriptions', 'voice_private.note_transcription_attempts'] LOOP
    EXECUTE format('ALTER TABLE %s OWNER TO postgres', rel);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', rel);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC', rel);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON TABLE %s FROM %I', rel, r);
      END IF;
    END LOOP;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY[
    'voice_private.machine_asr_memory_confidence_v1(text)',
    'voice_private.transcription_policy_v1()',
    'voice_private.transcription_failure_is_transient_v1(text)',
    'voice_private.provider_deletion_delay_v1(integer)',
    'voice_private.guard_note_transcription_v1()',
    'voice_private.note_first_deletions_recorded_v1(uuid)',
    'voice_private.settle_note_v1(uuid,text,text)',
    'voice_private.on_recording_terminal_v1()',
    'public.guard_memory_typed_confirmation_v1()',
    'public.record_memory_typed_confirmation_v1(uuid,uuid,uuid,text,uuid,uuid)',
    'public.server_claim_voice_note_transcription_v1(text,integer,integer)',
    'public.server_renew_voice_note_transcription_lease_v1(uuid,text,integer)',
    'public.server_begin_voice_note_submission_v1(uuid,text,uuid,bigint)',
    'public.server_record_voice_note_submission_v1(uuid,text,text)',
    'public.server_record_voice_note_transcript_v1(uuid,text,text,text,text[],bigint)',
    'public.server_record_voice_note_provider_deletion_v1(uuid,text)',
    'public.server_record_voice_note_transcription_failure_v1(uuid,text,uuid,text)',
    'public.server_hold_voice_note_for_consent_v1(uuid)',
    'public.server_list_voice_note_deletions_due_v1(integer)',
    'public.server_list_voice_note_unsettled_attempts_v1(integer,integer)',
    'public.server_retry_voice_note_transcription_v1(uuid,uuid)',
    'public.server_read_voice_note_status_v1(uuid,uuid)',
    'public.server_list_session_pending_voice_notes_v1(uuid,uuid)',
    'public.server_read_session_voice_turns_v1(uuid,uuid,uuid[])',
    'public.server_read_my_voice_note_capability_v1(uuid)',
    'public.server_read_voice_consent_text_v1()',
    'public.server_read_machine_asr_memory_confidence_v1()',
    'public.server_read_memory_command_voice_v1(uuid,uuid,uuid,uuid)',
    'public.server_commit_voice_note_turn_v1(uuid,uuid)',
    'public.complete_post_response_personal_capture_v4(uuid,uuid[],text[],text[],double precision[],timestamptz[],text[],text[],text[],text[],text[],uuid[],text[],text[],uuid[],text[],uuid[],uuid[],uuid[],uuid[],uuid[],text[],text[],double precision[],text[],text[],uuid[])',
    'public.background_known_memories_v2(uuid,integer)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r);
      END IF;
    END LOOP;
    IF (fn LIKE 'public.server\_%' OR fn LIKE 'public.complete\_post\_response\_personal\_capture\_v4(%'
        OR fn = 'public.background_known_memories_v2(uuid,integer)')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 13. DEPLOY GUARD: the shape this migration promises, checked where it is installed.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
BEGIN
  -- G1. All four capability scopes are still closed: this migration opens nothing.
  IF (SELECT count(*) FROM voice_private.voice_launch_capability_states s
       WHERE s.feature_flag_state = 'DISABLED' AND s.launch_requirements_state = 'UNSATISFIED') <> 4
     OR (SELECT count(*) FROM voice_private.voice_launch_capability_states) <> 4 THEN
    RAISE EXCEPTION 'S8B-03: every voice capability scope must remain DISABLED / UNSATISFIED';
  END IF;
  -- G2. Exactly the approved consent text is installed and current (C-01 ... C-11, verbatim).
  IF (SELECT count(*) FROM voice_private.consent_texts) <> 1
     OR NOT EXISTS (SELECT 1 FROM voice_private.consent_texts t
                     WHERE t.purpose = 'VOICE_RECORDING' AND t.version = 'VOICE_RECORDING_V1' AND t.is_current
                       AND t.text_ar_sha256 = '1c2f6a050372da5175a918d040c1259031df798beff5eacfd2a947f3dc4d3f3d'
                       AND t.text_en_sha256 = 'ea01b715e384c14a239f4e18c0366d77006bb86d931ff326ee95e93c88bd1426') THEN
    RAISE EXCEPTION 'S8B-03: the approved voice consent text VOICE_RECORDING_V1 must be the one installed and current';
  END IF;
  -- G3. Every relation referencing the account, a voice relation or a voice-source relation is registered.
  SELECT count(*) INTO v_count FROM pg_constraint c
   WHERE c.contype = 'f'
     AND (c.confrelid = 'public.users'::regclass
          OR c.confrelid::regclass::text IN (SELECT g.relation FROM account_erasure_private.coverage_registry g
                                              WHERE g.coverage = 'VOICE'))
     AND c.conrelid::regclass::text NOT IN (SELECT g.relation FROM account_erasure_private.coverage_registry g);
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'S8B-03: a relation referencing the account or a voice relation is missing from the coverage registry';
  END IF;
  -- G4. No application role reaches a voice relation; a typed confirmation is readable (own rows) and never writable.
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants g
              WHERE (g.table_schema = 'voice_private' OR g.table_name = 'conversation_turn_voice_sources')
                AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC'))
     OR EXISTS (SELECT 1 FROM information_schema.role_table_grants g
                 WHERE g.table_schema = 'public' AND g.table_name = 'memory_typed_confirmations'
                   AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
                   AND (g.grantee IN ('anon', 'PUBLIC') OR g.privilege_type <> 'SELECT'))
     OR has_function_privilege('service_role', 'public.record_memory_typed_confirmation_v1(uuid,uuid,uuid,text,uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'voice_private.set_voice_launch_capability_v1(text,text,text,text,text)', 'EXECUTE')
     OR has_function_privilege('service_role', 'voice_private.install_consent_text_v1(text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'S8B-03: a voice relation, a typed confirmation write or an operator act is reachable by an application role';
  END IF;
  -- G5. The modules never disable a guard, alter a table, truncate or run dynamic SQL.
  IF EXISTS (SELECT 1 FROM pg_proc p
              WHERE p.oid IN ('account_erasure_private.erase_voice_v1(uuid,uuid)'::regprocedure,
                              'account_erasure_private.erase_account_v1(uuid)'::regprocedure)
                AND p.prosrc ~* '(session_replication_role|DISABLE\s+TRIGGER|ALTER\s+TABLE|TRUNCATE|EXECUTE\s)') THEN
    RAISE EXCEPTION 'S8B-03: an erasure module must not disable a guard, alter a table, truncate or run dynamic SQL';
  END IF;
END$$;

COMMIT;
