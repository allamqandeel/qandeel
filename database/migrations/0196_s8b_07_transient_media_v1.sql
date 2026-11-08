-- S8B-07 CP1-B — the one transient media authority: retained call listening and original-audio Replay playback, under
-- the Product Owner's CP1-B execution authorization of 2026-11-07 (contract CP1-B_MEDIA_RUNTIME_CONTRACT.md §3, §8, §9,
-- §14, §15, §17.2, §18 and §20 R5.1; CA-07B-1 FINAL; INFRA-07). Not hosted: every voice gate stays DISABLED, the Replay
-- gate stays UNCONFIGURED, and nothing here is applied to a hosted database.
--
-- ## What is added
--
--   A. voice_private.transient_media_artifacts: one processing file per LISTENING (one per call recording) or per RUN of
--      a REPLAY_PLAYBACK set, with its generation (§20), its bounded failure class, its content-free resource facts
--      (P-5) and its expires_at = least(created_at + 58 min, the source's end E), set once and never extended.
--   B. voice_private.transient_media_requests: the command ledger, PRIMARY KEY (user_id, command_id), every column
--      NOT NULL (§14). It holds no content.
--   C. voice_private.transient_media_erasures: the Replay-owned erasure ledger keyed by storage_key, with no user id
--      (§18.1). Every key is entered when it is requested, before any byte exists; due_at only ever moves earlier.
--   D. voice_private.replay_pool_heartbeats: the pool's and the watchdog's content-free run heartbeat (§18.2).
--   E. voice_private.transient_media_policy: the one row of tunable bounds: L (continuation lead, 5 min, only within
--      [3, 10] min, §20), the queue (≤ 2 sets in preparation per user, ≤ 32 pending sets, D-06.4), the lease (60 s)
--      and the attempts (3) of D-06.5.
--   F. The definers, all postgres-owned, search_path = '', executable only by the Replay pool's database role
--      qandeel_replay_media (INFRA-07 P-3: the Replay pool reaches PostgreSQL through its own role, never the API's):
--        server_request_transient_media_v1      §14.2 + §20 (the only path that inserts an artifact or a generation)
--        server_read_transient_media_map_v1     the Replay plan rows the presentation map is built from (§5.3)
--        server_claim_transient_media_jobs_v1   FOR UPDATE SKIP LOCKED, oldest first, ≤ 25
--        server_read_transient_media_job_v1     the job's inputs: only the plan's run, only intersecting segments (C-B4)
--        server_heartbeat_transient_media_job_v1
--        server_complete_transient_media_job_v1 revalidated, the source locked FOR SHARE; the generation PCM compare
--        server_fail_transient_media_job_v1
--        server_read_transient_media_v1         every GET and every Range: key, serve_until, the database's clock
--        server_check_transient_media_v1        the same predicate without the key (in-stream re-check, status)
--        server_release_transient_media_v1      RELEASED, erasure due now; never read or reused again
--        server_sweep_transient_media_v1        EXPIRED, erasure_late_at, purge (≤ 100); never called by the API
--        server_claim_transient_media_erasures_v1 / server_complete_transient_media_erasure_v1  the reaper and the
--                                               watchdog's DELETE + HEAD 404 backstop (§18.1, §18.2)
--        server_beat_transient_media_pool_v1    the heartbeat (§18.2)
--        server_read_transient_media_health_v1  queue age, PENDING past 60 s, heartbeat ages, due and late erasures
--   G. public.server_read_session_finished_calls_v2: the 0193 read plus recording_status (PREPARING | AVAILABLE |
--      UNAVAILABLE), available_until and the PROVEN unavailable_reason (EXPIRED | DELETED | NULL) (§0.4, V-26). The
--      only new function the API (service_role) may execute.
--   H. The database role qandeel_replay_media (P-3, approved initial values): NOLOGIN here, CONNECTION LIMIT 10,
--      statement_timeout 5 s, lock_timeout 1 s, idle_in_transaction_session_timeout 10 s; no table privilege at all.
--   I. Account erasure: A and B reference public.users ON DELETE CASCADE and are registered ACCOUNT_CASCADE, so the
--      governed erasure removes them with the account row; an AFTER DELETE trigger makes each removed artifact's key
--      due at once in C (which holds no user id). No erasure function is replaced.
--
-- ## Implementation choices (declared; inside the contract)
--
--   * The finished-call read is a new v2 beside 0193's v1, not a replacement of it: 0193's verifier pins v1's body to
--     the call and policy relations only (T0b), and 0193 is frozen.
--   * The LISTENING request is addressed by the call id (the wire carries no recording id, §11); the definer resolves
--     the person's own LIVE_CALL recording, which is the stored subject_id (§3.1).
--   * "An ACTIVE call" (RT-1) is read as any open live call of the person (state <> 'ENDED': CONNECTING, ACTIVE or
--     RECONNECTING), because the native call engine owns the audio session for all of them (§7).
--   * A set is prepared, failed and released whole: one RUN that fails fails its set (a complete set or nothing, S-10),
--     and a release of any artifact releases its set (the phone then uses the next set).
--   * A queue slot is a set (one request), so a Replay of n runs is one job against the D-06.4 bounds.
--   * A terminal transition keeps the lease instant, so the reaper never erases a key while the worker's last lease may
--     still be uploading it; a refused completion re-opens the key's erasure.
--   * The completion locks the source FOR SHARE as 0195 H does, inline: 0195's lock function is auth.uid()-scoped and the
--     Replay pool calls with no human session.
--   * The proven reason (§0.4, R1.1, V-30) rides on the set rows and the status check as `reason` (EXPIRED | DELETED |
--     NULL), and on a refused new request in the DETAIL of TRANSIENT_NOT_AVAILABLE; it is computed only from the source
--     recordings' own columns, never inferred (voice_private.transient_unavailable_reason_v1).
--   * The generation PCM compare (§20 point 4) is enforced at completion: the worker reports the digest, the database
--     refuses a mismatch against the newest earlier file of the same plan with GENERATION_MISMATCH.
--
-- ## What is deliberately NOT here
--
--   * No change to any migration up to 0195, to recordings, calls, retention or the shared media_erasure_queue (whose
--     key CHECK still refuses voice-transient/ keys, so the API's erasure worker can never touch one). No function
--     here writes retention_expires_at. No public replay* relation, no Replay grant, no gate, no copy, no route.
--   * No CP2-A render, no CP2-B delivery, no Shared or Public Replay, no credits.

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. THE DATABASE ROLE OF THE REPLAY POOL (H). Cluster-wide, so created once; its limits are re-asserted every time.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'qandeel_replay_media') THEN
    CREATE ROLE qandeel_replay_media NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS
      CONNECTION LIMIT 10;
  END IF;
END$$;
ALTER ROLE qandeel_replay_media CONNECTION LIMIT 10;
ALTER ROLE qandeel_replay_media SET statement_timeout = '5s';
ALTER ROLE qandeel_replay_media SET lock_timeout = '1s';
ALTER ROLE qandeel_replay_media SET idle_in_transaction_session_timeout = '10s';

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. THE POLICY (E).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.transient_media_policy (
    singleton boolean NOT NULL DEFAULT true,
    continuation_lead_seconds integer NOT NULL,
    active_sets_per_user integer NOT NULL,
    pending_sets_max integer NOT NULL,
    lease_seconds integer NOT NULL,
    max_attempts integer NOT NULL,
    CONSTRAINT transient_media_policy_pk PRIMARY KEY (singleton),
    CONSTRAINT transient_media_policy_singleton_check CHECK (singleton),
    -- §20: L only within [3 min, 10 min]: above the D-06.5 hard maximum plus the queue wait, below half the 58-min cap.
    CONSTRAINT transient_media_policy_lead_check CHECK (continuation_lead_seconds BETWEEN 180 AND 600),
    CONSTRAINT transient_media_policy_queue_check CHECK (active_sets_per_user BETWEEN 1 AND 2
                                                         AND pending_sets_max BETWEEN 1 AND 32),
    CONSTRAINT transient_media_policy_lease_check CHECK (lease_seconds BETWEEN 30 AND 120 AND max_attempts BETWEEN 1 AND 3)
);
INSERT INTO voice_private.transient_media_policy
    (continuation_lead_seconds, active_sets_per_user, pending_sets_max, lease_seconds, max_attempts)
VALUES (300, 2, 32, 60, 3);

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. THE ARTIFACTS (A).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.transient_media_artifacts (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    owner_kind text NOT NULL,
    recording_id uuid,
    replay_version_id uuid,
    set_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    run_ordinal integer NOT NULL,
    generation integer NOT NULL DEFAULT 1,
    plan_digest text NOT NULL,
    pcm_digest text,
    job_state text NOT NULL,
    lease_id uuid,
    lease_until timestamptz,
    attempts integer NOT NULL DEFAULT 0,
    storage_key text NOT NULL,
    expected_duration_ms bigint NOT NULL,
    duration_ms bigint,
    byte_size bigint,
    failure_class text,
    wall_ms bigint,
    cpu_ms bigint,
    bytes_read bigint,
    store_ops integer,
    source_checked_at timestamptz,
    created_at timestamptz NOT NULL,
    ready_at timestamptz,
    expires_at timestamptz NOT NULL,
    terminal_at timestamptz,
    CONSTRAINT transient_media_artifacts_pk PRIMARY KEY (id),
    CONSTRAINT transient_media_artifacts_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
    CONSTRAINT transient_media_artifacts_key_unique UNIQUE (storage_key),
    CONSTRAINT transient_media_artifacts_set_run_key UNIQUE (set_id, run_ordinal),
    CONSTRAINT transient_media_artifacts_kind_check CHECK (
        (owner_kind = 'LISTENING' AND recording_id IS NOT NULL AND replay_version_id IS NULL
            AND subject_id = recording_id AND run_ordinal = 0)
     OR (owner_kind = 'REPLAY_PLAYBACK' AND recording_id IS NULL AND replay_version_id IS NOT NULL
            AND subject_id = replay_version_id AND run_ordinal >= 1)),
    CONSTRAINT transient_media_artifacts_generation_check CHECK (generation >= 1),
    CONSTRAINT transient_media_artifacts_digest_check CHECK (plan_digest ~ '^sha256:[0-9a-f]{64}$'
        AND (pcm_digest IS NULL OR pcm_digest ~ '^sha256:[0-9a-f]{64}$')),
    CONSTRAINT transient_media_artifacts_state_check
        CHECK (job_state IN ('PENDING', 'RUNNING', 'READY', 'FAILED', 'RELEASED', 'EXPIRED')),
    CONSTRAINT transient_media_artifacts_key_check CHECK (storage_key ~ '^voice-transient/[0-9a-f-]{36}$'),
    CONSTRAINT transient_media_artifacts_attempts_check CHECK (attempts BETWEEN 0 AND 3),
    CONSTRAINT transient_media_artifacts_lease_check
        CHECK (job_state <> 'RUNNING' OR (lease_id IS NOT NULL AND lease_until IS NOT NULL)),
    CONSTRAINT transient_media_artifacts_failure_check CHECK (
        (job_state = 'FAILED') = (failure_class IS NOT NULL)
        AND (failure_class IS NULL OR failure_class IN ('SOURCE_UNAVAILABLE', 'OBJECT_MISSING', 'DECODE_FAILED',
             'LENGTH_MISMATCH', 'TIME_CAP', 'SCRATCH_CAP', 'BUSY', 'GENERATION_MISMATCH'))),
    CONSTRAINT transient_media_artifacts_ready_check CHECK (
        (ready_at IS NOT NULL) = (pcm_digest IS NOT NULL)
        AND (ready_at IS NULL OR (duration_ms IS NOT NULL AND byte_size IS NOT NULL))
        AND (job_state <> 'READY' OR ready_at IS NOT NULL)),
    CONSTRAINT transient_media_artifacts_size_check CHECK (expected_duration_ms > 0
        AND (duration_ms IS NULL OR duration_ms > 0)
        AND (byte_size IS NULL OR byte_size BETWEEN 1 AND 26214400)
        AND (wall_ms IS NULL OR wall_ms >= 0) AND (cpu_ms IS NULL OR cpu_ms >= 0)
        AND (bytes_read IS NULL OR bytes_read >= 0) AND (store_ops IS NULL OR store_ops >= 0)),
    -- Addendum §16: the 58-minute access cap, and never past the source (E bounds it in the definer).
    CONSTRAINT transient_media_artifacts_expiry_check
        CHECK (expires_at > created_at AND expires_at <= created_at + interval '58 minutes'),
    CONSTRAINT transient_media_artifacts_terminal_check
        CHECK ((job_state IN ('FAILED', 'RELEASED', 'EXPIRED')) = (terminal_at IS NOT NULL))
);
-- §14.1 + §20: no two live sets of one subject with the same generation. It resolves races for the same number only;
-- the two-generation limit is enforced by the one write path (§20 enforcement, V-31 s1 – s3).
CREATE UNIQUE INDEX transient_media_live_uq ON voice_private.transient_media_artifacts
    (user_id, owner_kind, subject_id, run_ordinal, generation) WHERE job_state IN ('PENDING', 'RUNNING', 'READY');
CREATE INDEX transient_media_artifacts_subject_idx ON voice_private.transient_media_artifacts
    (user_id, owner_kind, subject_id);
CREATE INDEX transient_media_artifacts_queue_idx ON voice_private.transient_media_artifacts (created_at, id)
    WHERE job_state IN ('PENDING', 'RUNNING');
CREATE INDEX transient_media_artifacts_live_idx ON voice_private.transient_media_artifacts (expires_at)
    WHERE job_state IN ('PENDING', 'RUNNING', 'READY');
CREATE INDEX transient_media_artifacts_set_idx ON voice_private.transient_media_artifacts (set_id);

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. THE COMMAND LEDGER (B).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.transient_media_requests (
    user_id uuid NOT NULL,
    command_id uuid NOT NULL,
    owner_kind text NOT NULL,
    subject_id uuid NOT NULL,
    set_id uuid NOT NULL,
    created_at timestamptz NOT NULL,
    CONSTRAINT transient_media_requests_pk PRIMARY KEY (user_id, command_id),
    CONSTRAINT transient_media_requests_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
    CONSTRAINT transient_media_requests_kind_check CHECK (owner_kind IN ('LISTENING', 'REPLAY_PLAYBACK'))
);
CREATE INDEX transient_media_requests_set_idx ON voice_private.transient_media_requests (set_id);

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. THE REPLAY ERASURE LEDGER (C) AND THE HEARTBEATS (D). No user id, no content.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.transient_media_erasures (
    storage_key text NOT NULL,
    due_at timestamptz NOT NULL,
    erased_at timestamptz,
    erasure_late_at timestamptz,
    attempts integer NOT NULL DEFAULT 0,
    lease_id uuid,
    lease_until timestamptz,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT transient_media_erasures_pk PRIMARY KEY (storage_key),
    CONSTRAINT transient_media_erasures_key_check CHECK (storage_key ~ '^voice-transient/[0-9a-f-]{36}$'),
    CONSTRAINT transient_media_erasures_attempts_check CHECK (attempts >= 0)
);
CREATE INDEX transient_media_erasures_due_idx ON voice_private.transient_media_erasures (due_at) WHERE erased_at IS NULL;

CREATE TABLE voice_private.replay_pool_heartbeats (
    instance_id uuid NOT NULL,
    role text NOT NULL,
    seen_at timestamptz NOT NULL,
    CONSTRAINT replay_pool_heartbeats_pk PRIMARY KEY (instance_id),
    CONSTRAINT replay_pool_heartbeats_role_check CHECK (role IN ('REPLAY_MEDIA', 'REPLAY_WATCHDOG'))
);

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. GUARDS: the identity of a file never changes, its expiry never moves later, and an erasure never becomes due
--    later than it was.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION voice_private.guard_transient_media_artifact_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.user_id <> OLD.user_id OR NEW.owner_kind <> OLD.owner_kind
     OR NEW.subject_id <> OLD.subject_id OR NEW.set_id <> OLD.set_id OR NEW.run_ordinal <> OLD.run_ordinal
     OR NEW.generation <> OLD.generation OR NEW.storage_key <> OLD.storage_key OR NEW.plan_digest <> OLD.plan_digest
     OR NEW.recording_id IS DISTINCT FROM OLD.recording_id OR NEW.replay_version_id IS DISTINCT FROM OLD.replay_version_id
     OR NEW.created_at <> OLD.created_at OR NEW.expected_duration_ms <> OLD.expected_duration_ms
     OR NEW.expires_at > OLD.expires_at
     OR (OLD.job_state IN ('FAILED', 'RELEASED', 'EXPIRED') AND NEW.job_state <> OLD.job_state)
     OR (OLD.pcm_digest IS NOT NULL AND NEW.pcm_digest IS DISTINCT FROM OLD.pcm_digest) THEN
    RAISE EXCEPTION 'TRANSIENT_MEDIA_IMMUTABLE' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END$$;
CREATE TRIGGER transient_media_artifacts_guard BEFORE UPDATE ON voice_private.transient_media_artifacts
    FOR EACH ROW EXECUTE FUNCTION voice_private.guard_transient_media_artifact_v1();

CREATE FUNCTION voice_private.guard_transient_media_erasure_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.storage_key <> OLD.storage_key OR NEW.due_at > OLD.due_at
     OR (OLD.erasure_late_at IS NOT NULL AND NEW.erasure_late_at IS DISTINCT FROM OLD.erasure_late_at) THEN
    RAISE EXCEPTION 'TRANSIENT_MEDIA_IMMUTABLE' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END$$;
CREATE TRIGGER transient_media_erasures_guard BEFORE UPDATE ON voice_private.transient_media_erasures
    FOR EACH ROW EXECUTE FUNCTION voice_private.guard_transient_media_erasure_v1();

-- Account erasure (I): the cascade from the account row removes the artifacts; each removed key is due at once.
CREATE FUNCTION voice_private.transient_media_artifact_removed_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE voice_private.transient_media_erasures e SET due_at = least(e.due_at, clock_timestamp())
   WHERE e.storage_key = OLD.storage_key AND e.erased_at IS NULL;
  RETURN OLD;
END$$;
CREATE TRIGGER transient_media_artifacts_removed AFTER DELETE ON voice_private.transient_media_artifacts
    FOR EACH ROW EXECUTE FUNCTION voice_private.transient_media_artifact_removed_v1();

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. INTERNAL HELPERS (no role executes them).
-- ---------------------------------------------------------------------------------------------------------------------

-- Whether the subject is still readable by its owner now: LISTENING, the person's own sealed LIVE_CALL recording,
-- readable (STORED, before its expiry at the instant, no due account erasure); REPLAY_PLAYBACK, the creator's own
-- version, still CURRENT (the one I-06D derivation, which consults the recordings' readability, 0195 G).
CREATE FUNCTION voice_private.transient_source_readable_v1(p_user_id uuid, p_owner_kind text, p_subject_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_replay uuid;
  v_availability text;
BEGIN
  IF p_owner_kind = 'LISTENING' THEN
    RETURN EXISTS (SELECT 1 FROM voice_private.recordings r
                    WHERE r.id = p_subject_id AND r.user_id = p_user_id AND r.recording_kind = 'LIVE_CALL')
       AND voice_private.recording_readable_v1(p_user_id, p_subject_id);
  END IF;
  SELECT v.replay_id INTO v_replay FROM public.replay_versions v JOIN public.replays r ON r.id = v.replay_id
   WHERE v.id = p_subject_id AND r.created_by_user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  SELECT a.availability_state INTO v_availability
    FROM public.derive_replay_version_current_availability_v1(v_replay, p_subject_id) a;
  RETURN v_availability IS NOT DISTINCT FROM 'CURRENT';
END$$;

-- The runs of a Replay version's plan (0195 I), each with its recording, its clock span and the length its file
-- presents: the clock span minus what the D-05.1 rule removes from each held interval over 3000 ms (it becomes 1500 ms).
CREATE FUNCTION voice_private.transient_plan_runs_v1(p_user_id uuid, p_replay_version_id uuid)
RETURNS TABLE (run_ordinal integer, entry_ordinal integer, recording_id uuid, clock_start_ms bigint, clock_end_ms bigint,
               expected_duration_ms bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH plan AS (
    SELECT * FROM public.resolve_replay_version_audio_plan_v1(p_user_id, p_replay_version_id)
  ), runs AS (
    SELECT p.entry_ordinal, p.recording_id, p.clock_start_ms, p.clock_end_ms,
           (row_number() OVER (ORDER BY p.entry_ordinal))::integer AS run_ordinal
      FROM plan p WHERE p.row_kind = 'RUN'
  ), held AS (
    SELECT p.entry_ordinal, sum(CASE WHEN p.elapsed_ms > 3000 THEN p.elapsed_ms - 1500 ELSE 0 END)::bigint AS removed
      FROM plan p WHERE p.row_kind = 'HELD' GROUP BY p.entry_ordinal
  )
  SELECT r.run_ordinal, r.entry_ordinal, r.recording_id, r.clock_start_ms, r.clock_end_ms,
         (r.clock_end_ms - r.clock_start_ms) - coalesce(h.removed, 0)
    FROM runs r LEFT JOIN held h ON h.entry_ordinal = r.entry_ordinal
   ORDER BY r.run_ordinal;
$$;

-- The milliseconds a file stays readable: serve_until − clock_timestamp(), where serve_until = expires_at (≤ the
-- source's end by construction); 0 once it is terminal, past its cap, or its source is no longer readable.
CREATE FUNCTION voice_private.transient_readable_for_ms_v1(p_state text, p_expires_at timestamptz, p_source_ok boolean)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN p_source_ok AND p_state IN ('PENDING', 'RUNNING', 'READY') AND clock_timestamp() < p_expires_at
              THEN floor(extract(epoch FROM (p_expires_at - clock_timestamp())) * 1000)::bigint
              ELSE 0::bigint END;
$$;

-- The PROVEN reason a subject's source is not readable (§0.4, R1.1): EXPIRED only when every unreadable source recording
-- expired (by its state, or by its clock at the instant), DELETED only when every one was deleted by its owner; NULL
-- otherwise: a readable source, an account erasure, a missing voice source, mixed causes, or anything unknown. The phone
-- never infers a cause (V-30).
CREATE FUNCTION voice_private.transient_unavailable_reason_v1(p_user_id uuid, p_owner_kind text, p_subject_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH src AS (
    SELECT r.id, r.recording_state, r.deleted_reason, r.retention_expires_at
      FROM voice_private.recordings r
     WHERE p_owner_kind = 'LISTENING' AND r.id = p_subject_id AND r.user_id = p_user_id
    UNION ALL
    SELECT r.id, r.recording_state, r.deleted_reason, r.retention_expires_at
      FROM public.replay_versions v
      JOIN public.replays rp ON rp.id = v.replay_id AND rp.created_by_user_id = p_user_id
      JOIN public.replay_source_manifest_items i ON i.manifest_version_id = v.source_manifest_version_id
      LEFT JOIN public.conversation_units cu ON cu.id = i.personal_conversation_unit_id
      LEFT JOIN public.conversation_turn_voice_sources vs ON vs.turn_id = cu.source_turn_id
      LEFT JOIN voice_private.recordings r ON r.id = vs.recording_id
     WHERE p_owner_kind = 'REPLAY_PLAYBACK' AND v.id = p_subject_id AND i.original_medium = 'ORIGINAL_AUDIO'
  ), gone AS (
    SELECT CASE WHEN s.id IS NULL THEN 'UNKNOWN'
                WHEN s.recording_state = 'EXPIRED'
                  OR (s.recording_state IN ('STORED', 'RECORDING') AND clock_timestamp() >= s.retention_expires_at) THEN 'EXPIRED'
                WHEN s.recording_state = 'DELETED' AND s.deleted_reason = 'OWNER' THEN 'DELETED'
                ELSE 'UNKNOWN' END AS cause
      FROM src s
     WHERE s.id IS NULL OR NOT voice_private.recording_readable_v1(p_user_id, s.id)
  )
  SELECT CASE WHEN count(*) = 0 THEN NULL
              WHEN bool_and(g.cause = 'EXPIRED') THEN 'EXPIRED'
              WHEN bool_and(g.cause = 'DELETED') THEN 'DELETED' END
    FROM gone g;
$$;

-- One set, as the wire describes it (no key, no recording, no digest). A live file whose cap or source has passed is
-- answered EXPIRED at once, before any sweep writes it.
CREATE FUNCTION voice_private.transient_set_rows_v1(p_user_id uuid, p_set_id uuid)
RETURNS TABLE (set_id uuid, artifact_id uuid, run_ordinal integer, generation integer, job_state text,
               failure_class text, expected_duration_ms bigint, duration_ms bigint, readable_for_ms bigint,
               reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_first voice_private.transient_media_artifacts;
  v_ok boolean;
  v_reason text;
BEGIN
  SELECT a.* INTO v_first FROM voice_private.transient_media_artifacts a
   WHERE a.set_id = p_set_id AND a.user_id = p_user_id ORDER BY a.run_ordinal LIMIT 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  v_ok := voice_private.transient_source_readable_v1(p_user_id, v_first.owner_kind, v_first.subject_id);
  IF NOT v_ok THEN
    v_reason := voice_private.transient_unavailable_reason_v1(p_user_id, v_first.owner_kind, v_first.subject_id);
  END IF;
  RETURN QUERY
    SELECT a.set_id, a.id, a.run_ordinal, a.generation,
           CASE WHEN a.job_state IN ('PENDING', 'RUNNING', 'READY')
                     AND (NOT v_ok OR clock_timestamp() >= a.expires_at) THEN 'EXPIRED' ELSE a.job_state END,
           a.failure_class, a.expected_duration_ms, a.duration_ms,
           voice_private.transient_readable_for_ms_v1(a.job_state, a.expires_at, v_ok), v_reason
      FROM voice_private.transient_media_artifacts a
     WHERE a.set_id = p_set_id AND a.user_id = p_user_id
     ORDER BY a.run_ordinal;
END$$;

-- A set leaves the live states together; its keys become due now (never later than they were).
CREATE FUNCTION voice_private.end_transient_set_v1(p_set_id uuid, p_state text, p_failure_class text, p_due_at timestamptz)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_count integer;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_state NOT IN ('FAILED', 'RELEASED', 'EXPIRED') OR (p_state = 'FAILED') <> (p_failure_class IS NOT NULL) THEN
    RAISE EXCEPTION 'TRANSIENT_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  UPDATE voice_private.transient_media_artifacts a
     SET job_state = p_state, failure_class = p_failure_class, terminal_at = v_now
   WHERE a.set_id = p_set_id AND a.job_state IN ('PENDING', 'RUNNING', 'READY');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE voice_private.transient_media_erasures e SET due_at = least(e.due_at, coalesce(p_due_at, v_now), v_now)
    FROM voice_private.transient_media_artifacts a
   WHERE a.set_id = p_set_id AND e.storage_key = a.storage_key AND e.erased_at IS NULL;
  RETURN v_count;
END$$;

-- The instant a subject's source ended, when it is proven: an owner deletion or an expiry of the recording (its
-- terminal instant), or its retention passing; otherwise NULL (the caller uses now).
CREATE FUNCTION voice_private.transient_source_end_instant_v1(p_owner_kind text, p_subject_id uuid)
RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN p_owner_kind <> 'LISTENING' THEN NULL
              WHEN r.recording_state IN ('DELETED', 'EXPIRED') THEN r.terminal_at
              WHEN clock_timestamp() >= r.retention_expires_at THEN r.retention_expires_at
              ELSE NULL END
    FROM voice_private.recordings r WHERE r.id = p_subject_id;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. THE REQUEST (§14.2 in order, §20 rules (a) – (e) with one v_now). The only function that inserts an artifact.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_request_transient_media_v1(p_user_id uuid, p_owner_kind text, p_subject_ref uuid,
                                                         p_command_id uuid)
RETURNS TABLE (set_id uuid, artifact_id uuid, run_ordinal integer, generation integer, job_state text,
               failure_class text, expected_duration_ms bigint, duration_ms bigint, readable_for_ms bigint,
               reason text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_policy voice_private.transient_media_policy;
  v_subject uuid;
  v_set uuid := gen_random_uuid();
  v_known voice_private.transient_media_requests;
  v_inserted integer;
  v_now timestamptz;
  v_end timestamptz;
  v_live record;
  v_generation integer;
  v_expires timestamptz;
  v_runs integer[];
  v_recordings uuid[];
  v_expected bigint[];
  v_digests text[];
  v_binding text;
BEGIN
  IF p_user_id IS NULL OR p_subject_ref IS NULL OR p_command_id IS NULL OR p_owner_kind IS NULL
     OR p_owner_kind NOT IN ('LISTENING', 'REPLAY_PLAYBACK') THEN
    RAISE EXCEPTION 'TRANSIENT_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  -- The subject: a LISTENING request names the call; the subject is the person's own recording of it.
  IF p_owner_kind = 'LISTENING' THEN
    SELECT r.id INTO v_subject FROM voice_private.recordings r
     WHERE r.call_id = p_subject_ref AND r.user_id = p_user_id AND r.recording_kind = 'LIVE_CALL';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'TRANSIENT_NOT_AVAILABLE' USING ERRCODE = 'P0002';
    END IF;
  ELSE
    v_subject := p_subject_ref;
  END IF;

  -- 1. The ledger first. A concurrent identical command waits on this row, then sees the conflict.
  INSERT INTO voice_private.transient_media_requests (user_id, command_id, owner_kind, subject_id, set_id, created_at)
  VALUES (p_user_id, p_command_id, p_owner_kind, v_subject, v_set, clock_timestamp())
  ON CONFLICT ON CONSTRAINT transient_media_requests_pk DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- 2. A known command: its own set in its current state, never anything new; another kind or subject is refused.
  IF v_inserted = 0 THEN
    SELECT q.* INTO v_known FROM voice_private.transient_media_requests q
     WHERE q.user_id = p_user_id AND q.command_id = p_command_id;
    IF v_known.owner_kind <> p_owner_kind OR v_known.subject_id <> v_subject THEN
      RAISE EXCEPTION 'COMMAND_REUSED' USING ERRCODE = 'P0001';
    END IF;
    RETURN QUERY SELECT * FROM voice_private.transient_set_rows_v1(p_user_id, v_known.set_id);
    RETURN;
  END IF;

  -- 3. A new command: ownership and readability now; no start during the person's live call (RT-1).
  IF NOT voice_private.transient_source_readable_v1(p_user_id, p_owner_kind, v_subject) THEN
    -- The proven reason rides in the refusal's DETAIL (EXPIRED | DELETED | empty), never in its message.
    RAISE EXCEPTION 'TRANSIENT_NOT_AVAILABLE' USING ERRCODE = 'P0002',
      DETAIL = coalesce(voice_private.transient_unavailable_reason_v1(p_user_id, p_owner_kind, v_subject), '');
  END IF;
  IF EXISTS (SELECT 1 FROM voice_private.calls c WHERE c.user_id = p_user_id AND c.state <> 'ENDED') THEN
    RAISE EXCEPTION 'LIVE_CALL_ACTIVE' USING ERRCODE = 'P0001';
  END IF;

  -- The plan of the set and the source's own end E.
  IF p_owner_kind = 'LISTENING' THEN
    SELECT ARRAY[0], ARRAY[r.id],
           ARRAY[greatest(voice_private.track_clock_end_v1(r.id, 'USER'), voice_private.track_clock_end_v1(r.id, 'QANDEEL'))],
           ARRAY['sha256:' || encode(sha256(convert_to(
             'LISTENING:' || r.id::text
             || '|O:' || coalesce((SELECT string_agg(o.track || ':' || o.segment_index || ':' || o.clock_start_ms || ':'
                                                     || o.clock_end_ms || ':' || o.byte_size, ','
                                                     ORDER BY o.track, o.segment_index)
                                     FROM voice_private.recording_objects o
                                    WHERE o.recording_id = r.id AND o.object_state = 'STORED'), '')
             || '|G:' || coalesce((SELECT string_agg(g.track || ':' || g.clock_start_ms || ':' || g.clock_end_ms || ':'
                                                     || g.gap_kind, ',' ORDER BY g.track, g.clock_start_ms)
                                     FROM voice_private.recording_gaps g WHERE g.recording_id = r.id), ''),
             'UTF8')), 'hex')],
           r.retention_expires_at
      INTO v_runs, v_recordings, v_expected, v_digests, v_end
      FROM voice_private.recordings r WHERE r.id = v_subject;
  ELSE
    SELECT c.source_window_binding_digest INTO v_binding
      FROM public.replay_versions v JOIN public.replay_render_contract_versions c ON c.id = v.render_contract_version_id
     WHERE v.id = v_subject;
    SELECT array_agg(p.run_ordinal ORDER BY p.run_ordinal), array_agg(p.recording_id ORDER BY p.run_ordinal),
           array_agg(p.expected_duration_ms ORDER BY p.run_ordinal),
           array_agg('sha256:' || encode(sha256(convert_to('REPLAY_PLAYBACK:' || v_subject::text || ':' || v_binding
                                                           || ':' || p.run_ordinal, 'UTF8')), 'hex') ORDER BY p.run_ordinal),
           min(rec.retention_expires_at)
      INTO v_runs, v_recordings, v_expected, v_digests, v_end
      FROM voice_private.transient_plan_runs_v1(p_user_id, v_subject) p
      LEFT JOIN voice_private.recordings rec ON rec.id = p.recording_id;
  END IF;
  IF v_runs IS NULL OR cardinality(v_runs) = 0 OR v_binding IS NULL AND p_owner_kind = 'REPLAY_PLAYBACK'
     OR EXISTS (SELECT 1 FROM unnest(v_expected) x WHERE x IS NULL OR x <= 0) THEN
    RAISE EXCEPTION 'TRANSIENT_NOT_AVAILABLE' USING ERRCODE = 'P0002';
  END IF;
  v_end := coalesce(v_end, 'infinity'::timestamptz);

  SELECT p.* INTO v_policy FROM voice_private.transient_media_policy p WHERE p.singleton;
  v_now := clock_timestamp();

  -- (a) This subject's past-cap rows leave the live states; their erasure is due at their cap.
  UPDATE voice_private.transient_media_artifacts a SET job_state = 'EXPIRED', terminal_at = v_now
   WHERE a.user_id = p_user_id AND a.owner_kind = p_owner_kind AND a.subject_id = v_subject
     AND a.job_state IN ('PENDING', 'RUNNING', 'READY') AND a.expires_at <= v_now;
  UPDATE voice_private.transient_media_erasures e SET due_at = least(e.due_at, a.expires_at)
    FROM voice_private.transient_media_artifacts a
   WHERE a.user_id = p_user_id AND a.owner_kind = p_owner_kind AND a.subject_id = v_subject
     AND a.job_state = 'EXPIRED' AND e.storage_key = a.storage_key AND e.erased_at IS NULL;

  -- G: the newest live generation of the subject.
  SELECT a.set_id, a.generation, a.expires_at INTO v_live FROM voice_private.transient_media_artifacts a
   WHERE a.user_id = p_user_id AND a.owner_kind = p_owner_kind AND a.subject_id = v_subject
     AND a.job_state IN ('PENDING', 'RUNNING', 'READY')
   ORDER BY a.generation DESC, a.created_at DESC LIMIT 1;

  -- (b) Reuse: G covers the source, or has at least L left.
  IF v_live.set_id IS NOT NULL
     AND (v_live.expires_at >= v_end OR v_live.expires_at - v_now >= make_interval(secs => v_policy.continuation_lead_seconds)) THEN
    UPDATE voice_private.transient_media_requests q SET set_id = v_live.set_id
     WHERE q.user_id = p_user_id AND q.command_id = p_command_id;
    RETURN QUERY SELECT * FROM voice_private.transient_set_rows_v1(p_user_id, v_live.set_id);
    RETURN;
  END IF;

  -- Backpressure (D-06.4): a set is one job; not a financial cap (P-7). Admission is serialized (found by V-24a): two
  -- requests that each counted 31 pending sets must not both add one, so the bounds hold under concurrency too.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qandeel.transient-admission.v1', 0));
  IF (SELECT count(DISTINCT a.set_id) FROM voice_private.transient_media_artifacts a
       WHERE a.user_id = p_user_id AND a.job_state IN ('PENDING', 'RUNNING')) >= v_policy.active_sets_per_user
     OR (SELECT count(DISTINCT a.set_id) FROM voice_private.transient_media_artifacts a
          WHERE a.job_state = 'PENDING') >= v_policy.pending_sets_max THEN
    RAISE EXCEPTION 'BUSY' USING ERRCODE = 'P0001';
  END IF;

  -- (c) / (d) A new set: generation G + 1, or 1; bounded by E. A concurrent winner's live set is used instead.
  v_generation := coalesce(v_live.generation + 1, 1);
  v_expires := least(v_now + interval '58 minutes', v_end);
  BEGIN
    INSERT INTO voice_private.transient_media_artifacts
        (user_id, owner_kind, recording_id, replay_version_id, set_id, subject_id, run_ordinal, generation, plan_digest,
         job_state, storage_key, expected_duration_ms, created_at, expires_at)
    SELECT p_user_id, p_owner_kind,
           CASE WHEN p_owner_kind = 'LISTENING' THEN v_subject END,
           CASE WHEN p_owner_kind = 'REPLAY_PLAYBACK' THEN v_subject END,
           v_set, v_subject, u.run_no, v_generation, u.digest, 'PENDING',
           'voice-transient/' || gen_random_uuid()::text, u.expected, v_now, v_expires
      FROM unnest(v_runs, v_expected, v_digests) AS u(run_no, expected, digest);
  EXCEPTION WHEN unique_violation THEN
    SELECT a.set_id, a.generation, a.expires_at INTO v_live FROM voice_private.transient_media_artifacts a
     WHERE a.user_id = p_user_id AND a.owner_kind = p_owner_kind AND a.subject_id = v_subject
       AND a.job_state IN ('PENDING', 'RUNNING', 'READY')
     ORDER BY a.generation DESC, a.created_at DESC LIMIT 1;
    IF v_live.set_id IS NULL THEN
      RAISE EXCEPTION 'BUSY' USING ERRCODE = 'P0001';
    END IF;
    UPDATE voice_private.transient_media_requests q SET set_id = v_live.set_id
     WHERE q.user_id = p_user_id AND q.command_id = p_command_id;
    RETURN QUERY SELECT * FROM voice_private.transient_set_rows_v1(p_user_id, v_live.set_id);
    RETURN;
  END;

  -- (e) Never more than two live generations of a subject: fail closed, nothing is kept.
  IF (SELECT count(DISTINCT a.generation) FROM voice_private.transient_media_artifacts a
       WHERE a.user_id = p_user_id AND a.owner_kind = p_owner_kind AND a.subject_id = v_subject
         AND a.job_state IN ('PENDING', 'RUNNING', 'READY')) > 2 THEN
    RAISE EXCEPTION 'TRANSIENT_GENERATION_LIMIT' USING ERRCODE = 'P0001';
  END IF;

  -- 4. Every new key enters the Replay erasure ledger now, before any byte exists, due at its cap.
  INSERT INTO voice_private.transient_media_erasures (storage_key, due_at)
  SELECT a.storage_key, a.expires_at FROM voice_private.transient_media_artifacts a WHERE a.set_id = v_set;

  RETURN QUERY SELECT * FROM voice_private.transient_set_rows_v1(p_user_id, v_set);
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 9. THE PRESENTATION MAP'S SOURCE: the plan rows of the creator's own CURRENT V2 version, with each row's run, and
--    without the recording (no key, URL, path, text or recording id).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_read_transient_media_map_v1(p_user_id uuid, p_replay_id uuid, p_replay_version_id uuid)
RETURNS TABLE (entry_ordinal integer, row_kind text, run_ordinal integer, window_ordinal integer,
               selected_ordinal integer, track text, clock_start_ms bigint, clock_end_ms bigint, elapsed_ms bigint,
               gap_kind text, boundary_kind text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS NULL OR p_replay_id IS NULL OR p_replay_version_id IS NULL THEN
    RAISE EXCEPTION 'TRANSIENT_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.replay_versions v WHERE v.id = p_replay_version_id AND v.replay_id = p_replay_id) THEN
    RETURN;
  END IF;
  RETURN QUERY
    WITH plan AS (
      SELECT * FROM public.resolve_replay_version_audio_plan_v1(p_user_id, p_replay_version_id)
    ), runs AS (
      SELECT p.entry_ordinal AS e, (row_number() OVER (ORDER BY p.entry_ordinal))::integer AS n
        FROM plan p WHERE p.row_kind = 'RUN'
    )
    SELECT p.entry_ordinal, p.row_kind, r.n, p.window_ordinal, p.selected_ordinal, p.track, p.clock_start_ms,
           p.clock_end_ms, p.elapsed_ms, p.gap_kind, p.boundary_kind
      FROM plan p LEFT JOIN runs r ON r.e = p.entry_ordinal AND p.row_kind NOT IN ('TEXT', 'BOUNDARY');
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 10. THE WORKER: claim, inputs, heartbeat, completion, failure.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_claim_transient_media_jobs_v1(p_limit integer)
RETURNS TABLE (job_id uuid, lease_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_policy voice_private.transient_media_policy;
  v_now timestamptz := clock_timestamp();
  v_set uuid;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 25 THEN
    RAISE EXCEPTION 'TRANSIENT_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT p.* INTO v_policy FROM voice_private.transient_media_policy p WHERE p.singleton;
  -- A job whose last allowed lease lapsed fails its set (the wall cap, D-06.5).
  FOR v_set IN
    SELECT DISTINCT a.set_id FROM voice_private.transient_media_artifacts a
     WHERE a.job_state = 'RUNNING' AND a.lease_until < v_now AND a.attempts >= v_policy.max_attempts
  LOOP
    PERFORM voice_private.end_transient_set_v1(v_set, 'FAILED', 'TIME_CAP', NULL);
  END LOOP;
  RETURN QUERY
    WITH pick AS (
      SELECT a.id FROM voice_private.transient_media_artifacts a
       WHERE (a.job_state = 'PENDING' OR (a.job_state = 'RUNNING' AND a.lease_until < v_now))
         AND a.attempts < v_policy.max_attempts AND a.expires_at > v_now
       ORDER BY a.created_at, a.id
       LIMIT p_limit
       FOR UPDATE SKIP LOCKED
    )
    UPDATE voice_private.transient_media_artifacts a
       SET job_state = 'RUNNING', lease_id = gen_random_uuid(),
           lease_until = v_now + make_interval(secs => v_policy.lease_seconds), attempts = a.attempts + 1
      FROM pick WHERE a.id = pick.id
    RETURNING a.id, a.lease_id;
END$$;

-- The job's inputs, under a live lease and a readable source. LISTENING: every STORED USER / QANDEEL segment and every
-- recorded gap. REPLAY_PLAYBACK: the run's plan rows, and only the STORED segments of the run's recording that intersect
-- a selected track's AUDIBLE span (C-B4). The first row (JOB) names the file to write and its expected length.
CREATE FUNCTION public.server_read_transient_media_job_v1(p_job_id uuid, p_lease_id uuid)
RETURNS TABLE (entry text, owner_kind text, generation integer, storage_key text, expected_duration_ms bigint,
               track text, segment_index integer, content_type text, byte_size bigint, clock_start_ms bigint,
               clock_end_ms bigint, elapsed_ms bigint, gap_kind text, window_ordinal integer, selected_ordinal integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_job voice_private.transient_media_artifacts;
  v_run record;
BEGIN
  IF p_job_id IS NULL OR p_lease_id IS NULL THEN
    RAISE EXCEPTION 'TRANSIENT_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT a.* INTO v_job FROM voice_private.transient_media_artifacts a
   WHERE a.id = p_job_id AND a.job_state = 'RUNNING' AND a.lease_id = p_lease_id AND a.lease_until > clock_timestamp()
     AND a.expires_at > clock_timestamp();
  IF NOT FOUND OR NOT voice_private.transient_source_readable_v1(v_job.user_id, v_job.owner_kind, v_job.subject_id) THEN
    RETURN;
  END IF;
  IF v_job.owner_kind = 'LISTENING' THEN
    RETURN QUERY
      SELECT 'JOB'::text, v_job.owner_kind, v_job.generation, v_job.storage_key, v_job.expected_duration_ms,
             NULL::text, NULL::integer, NULL::text, NULL::bigint, 0::bigint, v_job.expected_duration_ms, NULL::bigint,
             NULL::text, NULL::integer, NULL::integer
      UNION ALL
      SELECT 'SEGMENT', NULL, NULL, o.storage_key, NULL, o.track, o.segment_index, o.content_type, o.byte_size,
             o.clock_start_ms, o.clock_end_ms, NULL, NULL, NULL, NULL
        FROM voice_private.recording_objects o
       WHERE o.recording_id = v_job.recording_id AND o.object_state = 'STORED' AND o.track IN ('USER', 'QANDEEL')
      UNION ALL
      SELECT 'GAP', NULL, NULL, NULL, NULL, g.track, NULL, NULL, NULL, g.clock_start_ms, g.clock_end_ms, NULL,
             g.gap_kind, NULL, NULL
        FROM voice_private.recording_gaps g WHERE g.recording_id = v_job.recording_id;
    RETURN;
  END IF;
  SELECT r.* INTO v_run FROM voice_private.transient_plan_runs_v1(v_job.user_id, v_job.subject_id) r
   WHERE r.run_ordinal = v_job.run_ordinal;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  RETURN QUERY
    WITH plan AS (
      SELECT p.* FROM public.resolve_replay_version_audio_plan_v1(v_job.user_id, v_job.subject_id) p
       WHERE p.entry_ordinal = v_run.entry_ordinal
    )
    SELECT 'JOB'::text, v_job.owner_kind, v_job.generation, v_job.storage_key, v_job.expected_duration_ms,
           NULL::text, NULL::integer, NULL::text, NULL::bigint, v_run.clock_start_ms, v_run.clock_end_ms, NULL::bigint,
           NULL::text, NULL::integer, NULL::integer
    UNION ALL
    SELECT p.row_kind, NULL, NULL, NULL, NULL, p.track, NULL, NULL, NULL, p.clock_start_ms, p.clock_end_ms,
           p.elapsed_ms, p.gap_kind, p.window_ordinal, p.selected_ordinal
      FROM plan p WHERE p.row_kind IN ('WINDOW', 'AUDIBLE', 'MIX', 'HELD', 'GAP')
    UNION ALL
    SELECT 'SEGMENT', NULL, NULL, o.storage_key, NULL, o.track, o.segment_index, o.content_type, o.byte_size,
           o.clock_start_ms, o.clock_end_ms, NULL, NULL, NULL, NULL
      FROM voice_private.recording_objects o
     WHERE o.recording_id = v_run.recording_id AND o.object_state = 'STORED'
       AND EXISTS (SELECT 1 FROM plan s WHERE s.row_kind = 'AUDIBLE' AND s.track = o.track
                     AND (o.track = 'NOTE' OR (o.clock_start_ms < s.clock_end_ms AND s.clock_start_ms < o.clock_end_ms)));
END$$;

-- The lease is extended while the source stays readable and the file inside its cap; otherwise the worker aborts.
CREATE FUNCTION public.server_heartbeat_transient_media_job_v1(p_job_id uuid, p_lease_id uuid)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_job voice_private.transient_media_artifacts;
  v_policy voice_private.transient_media_policy;
BEGIN
  IF p_job_id IS NULL OR p_lease_id IS NULL THEN
    RAISE EXCEPTION 'TRANSIENT_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT a.* INTO v_job FROM voice_private.transient_media_artifacts a WHERE a.id = p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.job_state <> 'RUNNING' OR v_job.lease_id IS DISTINCT FROM p_lease_id
     OR v_job.lease_until <= clock_timestamp() THEN
    RETURN false;
  END IF;
  -- The source first: a file whose source ended (even at its own cap, E) fails as SOURCE_UNAVAILABLE (§20 (d)).
  IF NOT voice_private.transient_source_readable_v1(v_job.user_id, v_job.owner_kind, v_job.subject_id) THEN
    PERFORM voice_private.end_transient_set_v1(v_job.set_id, 'FAILED', 'SOURCE_UNAVAILABLE',
      voice_private.transient_source_end_instant_v1(v_job.owner_kind, v_job.subject_id));
    RETURN false;
  END IF;
  IF v_job.expires_at <= clock_timestamp() THEN
    PERFORM voice_private.end_transient_set_v1(v_job.set_id, 'EXPIRED', NULL, v_job.expires_at);
    RETURN false;
  END IF;
  SELECT p.* INTO v_policy FROM voice_private.transient_media_policy p WHERE p.singleton;
  UPDATE voice_private.transient_media_artifacts a
     SET lease_until = clock_timestamp() + make_interval(secs => v_policy.lease_seconds)
   WHERE a.id = p_job_id;
  RETURN true;
END$$;

-- Completion, revalidated (CW2-05 §30): the source locked FOR SHARE as 0195 H does, readable and inside the cap; the
-- measured length within one AAC frame (43 ms) of the plan; the PCM identical to every earlier file of the same plan
-- (§20). Any refusal re-opens the key's erasure, so an upload that raced it is erased again.
CREATE FUNCTION public.server_complete_transient_media_job_v1(p_job_id uuid, p_lease_id uuid, p_byte_size bigint,
                                                              p_duration_ms bigint, p_pcm_digest text, p_wall_ms bigint,
                                                              p_cpu_ms bigint, p_bytes_read bigint, p_store_ops integer)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_job voice_private.transient_media_artifacts;
  v_prior text;
  v_outcome text;
BEGIN
  IF p_job_id IS NULL OR p_lease_id IS NULL THEN
    RAISE EXCEPTION 'TRANSIENT_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT a.* INTO v_job FROM voice_private.transient_media_artifacts a WHERE a.id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'LEASE_LOST';
  END IF;
  IF v_job.owner_kind = 'LISTENING' THEN
    PERFORM 1 FROM voice_private.recordings r WHERE r.id = v_job.recording_id FOR SHARE;
  ELSE
    -- 0195 H's lock, inline: replay_lock_source_manifest_v1 is scoped to auth.uid() and the Replay pool has no human
    -- session, so the version's bound recordings are locked here the same way (ascending, FOR SHARE), and an early
    -- deletion (FOR UPDATE) and this completion serialize.
    PERFORM 1 FROM voice_private.recordings rec
      WHERE rec.id IN (SELECT vs.recording_id FROM public.replay_versions v
                         JOIN public.replay_source_manifest_items i ON i.manifest_version_id = v.source_manifest_version_id
                         JOIN public.conversation_units cu ON cu.id = i.personal_conversation_unit_id
                         JOIN public.conversation_turn_voice_sources vs ON vs.turn_id = cu.source_turn_id
                        WHERE v.id = v_job.replay_version_id AND i.original_medium = 'ORIGINAL_AUDIO')
      ORDER BY rec.id FOR SHARE;
  END IF;

  IF v_job.job_state <> 'RUNNING' OR v_job.lease_id IS DISTINCT FROM p_lease_id OR v_job.lease_until <= clock_timestamp() THEN
    v_outcome := 'LEASE_LOST';
  ELSIF NOT voice_private.transient_source_readable_v1(v_job.user_id, v_job.owner_kind, v_job.subject_id) THEN
    PERFORM voice_private.end_transient_set_v1(v_job.set_id, 'FAILED', 'SOURCE_UNAVAILABLE',
      voice_private.transient_source_end_instant_v1(v_job.owner_kind, v_job.subject_id));
    v_outcome := 'FAILED';
  ELSIF v_job.expires_at <= clock_timestamp() THEN
    PERFORM voice_private.end_transient_set_v1(v_job.set_id, 'EXPIRED', NULL, v_job.expires_at);
    v_outcome := 'EXPIRED';
  ELSIF p_byte_size IS NULL OR p_byte_size < 1 OR p_byte_size > 26214400 OR p_duration_ms IS NULL
        OR abs(p_duration_ms - v_job.expected_duration_ms) > 43
        OR p_pcm_digest IS NULL OR p_pcm_digest !~ '^sha256:[0-9a-f]{64}$' THEN
    PERFORM voice_private.end_transient_set_v1(v_job.set_id, 'FAILED', 'LENGTH_MISMATCH', NULL);
    v_outcome := 'FAILED';
  ELSE
    SELECT p.pcm_digest INTO v_prior FROM voice_private.transient_media_artifacts p
     WHERE p.user_id = v_job.user_id AND p.owner_kind = v_job.owner_kind AND p.subject_id = v_job.subject_id
       AND p.run_ordinal = v_job.run_ordinal AND p.plan_digest = v_job.plan_digest AND p.id <> v_job.id
       AND p.pcm_digest IS NOT NULL
     ORDER BY p.generation DESC, p.created_at DESC LIMIT 1;
    IF v_prior IS NOT NULL AND v_prior <> p_pcm_digest THEN
      PERFORM voice_private.end_transient_set_v1(v_job.set_id, 'FAILED', 'GENERATION_MISMATCH', NULL);
      v_outcome := 'FAILED';
    ELSE
      UPDATE voice_private.transient_media_artifacts a
         SET job_state = 'READY', ready_at = clock_timestamp(), byte_size = p_byte_size, duration_ms = p_duration_ms,
             pcm_digest = p_pcm_digest, wall_ms = p_wall_ms, cpu_ms = p_cpu_ms, bytes_read = p_bytes_read,
             store_ops = p_store_ops, lease_id = NULL, lease_until = NULL
       WHERE a.id = p_job_id;
      RETURN 'READY';
    END IF;
  END IF;
  IF v_outcome = 'LEASE_LOST' THEN
    -- Another lease may hold the job; this worker's upload (if any) is erased by the re-opened key below only when the
    -- job is no longer live.
    IF v_job.job_state NOT IN ('PENDING', 'RUNNING', 'READY') THEN
      UPDATE voice_private.transient_media_erasures e SET erased_at = NULL, due_at = least(e.due_at, clock_timestamp())
       WHERE e.storage_key = v_job.storage_key;
    END IF;
    RETURN v_outcome;
  END IF;
  -- The worker is done with this file: its lease ends, and the key is (re-)opened for erasure now.
  UPDATE voice_private.transient_media_artifacts a
     SET wall_ms = coalesce(a.wall_ms, p_wall_ms), cpu_ms = coalesce(a.cpu_ms, p_cpu_ms),
         bytes_read = coalesce(a.bytes_read, p_bytes_read), store_ops = coalesce(a.store_ops, p_store_ops),
         lease_id = NULL, lease_until = NULL
   WHERE a.id = p_job_id;
  UPDATE voice_private.transient_media_erasures e SET erased_at = NULL, due_at = least(e.due_at, clock_timestamp())
   WHERE e.storage_key = v_job.storage_key;
  RETURN v_outcome;
END$$;

CREATE FUNCTION public.server_fail_transient_media_job_v1(p_job_id uuid, p_lease_id uuid, p_failure_class text,
                                                          p_wall_ms bigint, p_cpu_ms bigint, p_bytes_read bigint,
                                                          p_store_ops integer)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_job voice_private.transient_media_artifacts;
BEGIN
  IF p_job_id IS NULL OR p_lease_id IS NULL OR p_failure_class IS NULL OR p_failure_class NOT IN
     ('SOURCE_UNAVAILABLE', 'OBJECT_MISSING', 'DECODE_FAILED', 'LENGTH_MISMATCH', 'TIME_CAP', 'SCRATCH_CAP',
      'GENERATION_MISMATCH') THEN
    RAISE EXCEPTION 'TRANSIENT_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT a.* INTO v_job FROM voice_private.transient_media_artifacts a WHERE a.id = p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.job_state <> 'RUNNING' OR v_job.lease_id IS DISTINCT FROM p_lease_id THEN
    RETURN false;
  END IF;
  PERFORM voice_private.end_transient_set_v1(v_job.set_id, 'FAILED', p_failure_class, NULL);
  UPDATE voice_private.transient_media_artifacts a
     SET wall_ms = p_wall_ms, cpu_ms = p_cpu_ms, bytes_read = p_bytes_read, store_ops = p_store_ops,
         lease_id = NULL, lease_until = NULL
   WHERE a.id = p_job_id;
  UPDATE voice_private.transient_media_erasures e SET erased_at = NULL, due_at = least(e.due_at, clock_timestamp())
   WHERE e.storage_key = v_job.storage_key;
  RETURN true;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 11. THE PLAYBACK READS (§6, §15): per request, per Range, and in-stream.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_read_transient_media_v1(p_user_id uuid, p_artifact_id uuid)
RETURNS TABLE (storage_key text, byte_size bigint, duration_ms bigint, serve_until timestamptz, db_now timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_a voice_private.transient_media_artifacts;
  v_until timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_artifact_id IS NULL THEN
    RAISE EXCEPTION 'TRANSIENT_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT a.* INTO v_a FROM voice_private.transient_media_artifacts a
   WHERE a.id = p_artifact_id AND a.user_id = p_user_id AND a.job_state = 'READY' AND clock_timestamp() < a.expires_at;
  IF NOT FOUND OR NOT voice_private.transient_source_readable_v1(p_user_id, v_a.owner_kind, v_a.subject_id) THEN
    RETURN;
  END IF;
  v_until := v_a.expires_at;
  IF v_a.owner_kind = 'LISTENING' THEN
    SELECT least(v_until, r.retention_expires_at) INTO v_until FROM voice_private.recordings r WHERE r.id = v_a.recording_id;
  END IF;
  RETURN QUERY SELECT v_a.storage_key, v_a.byte_size, v_a.duration_ms, v_until, clock_timestamp();
END$$;

CREATE FUNCTION public.server_check_transient_media_v1(p_user_id uuid, p_artifact_id uuid)
RETURNS TABLE (readable boolean, job_state text, failure_class text, readable_for_ms bigint, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_a voice_private.transient_media_artifacts;
  v_ok boolean;
  v_state text;
BEGIN
  IF p_user_id IS NULL OR p_artifact_id IS NULL THEN
    RAISE EXCEPTION 'TRANSIENT_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT a.* INTO v_a FROM voice_private.transient_media_artifacts a
   WHERE a.id = p_artifact_id AND a.user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  v_ok := voice_private.transient_source_readable_v1(p_user_id, v_a.owner_kind, v_a.subject_id);
  v_state := CASE WHEN v_a.job_state IN ('PENDING', 'RUNNING', 'READY')
                       AND (NOT v_ok OR clock_timestamp() >= v_a.expires_at) THEN 'EXPIRED' ELSE v_a.job_state END;
  RETURN QUERY SELECT v_state = 'READY', v_state, v_a.failure_class,
                      voice_private.transient_readable_for_ms_v1(v_a.job_state, v_a.expires_at, v_ok),
                      CASE WHEN NOT v_ok THEN voice_private.transient_unavailable_reason_v1(p_user_id, v_a.owner_kind, v_a.subject_id) END;
END$$;

-- The phone leaving the record or the player: the set is RELEASED and its keys are due now; it is never read or
-- reused again (CA-07B-1 point 2). Another person's artifact: no row.
CREATE FUNCTION public.server_release_transient_media_v1(p_user_id uuid, p_artifact_id uuid)
RETURNS TABLE (job_state text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_a voice_private.transient_media_artifacts;
BEGIN
  IF p_user_id IS NULL OR p_artifact_id IS NULL THEN
    RAISE EXCEPTION 'TRANSIENT_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT a.* INTO v_a FROM voice_private.transient_media_artifacts a
   WHERE a.id = p_artifact_id AND a.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  PERFORM voice_private.end_transient_set_v1(v_a.set_id, 'RELEASED', NULL, NULL);
  RETURN QUERY SELECT a.job_state FROM voice_private.transient_media_artifacts a WHERE a.id = p_artifact_id;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 12. THE SWEEP, THE ERASURE LEDGER AND THE HEARTBEAT (§8, §18). Called by the media worker and the independent
--     watchdog; never by the API.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_sweep_transient_media_v1(p_limit integer)
RETURNS TABLE (expired integer, late_marked integer, late_outstanding integer, purged integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_expired integer := 0;
  v_late integer;
  v_outstanding integer;
  v_purged integer := 0;
  v_n integer;
  v_set record;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'TRANSIENT_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  -- Past the cap: EXPIRED, due at the cap.
  FOR v_set IN
    SELECT DISTINCT a.set_id, a.expires_at FROM voice_private.transient_media_artifacts a
     WHERE a.job_state IN ('PENDING', 'RUNNING', 'READY') AND a.expires_at <= v_now
     ORDER BY a.expires_at LIMIT p_limit
  LOOP
    v_expired := v_expired + voice_private.end_transient_set_v1(v_set.set_id, 'EXPIRED', NULL, v_set.expires_at);
  END LOOP;
  -- The source gone (deleted, erased, expired, or a version no longer CURRENT): EXPIRED, due at its proven end.
  FOR v_set IN
    SELECT s.set_id, s.user_id, s.owner_kind, s.subject_id FROM (
      SELECT DISTINCT ON (a.set_id) a.set_id, a.user_id, a.owner_kind, a.subject_id, a.source_checked_at
        FROM voice_private.transient_media_artifacts a
       WHERE a.job_state IN ('PENDING', 'RUNNING', 'READY')
       ORDER BY a.set_id, a.source_checked_at NULLS FIRST) s
     ORDER BY s.source_checked_at NULLS FIRST, s.set_id LIMIT p_limit
  LOOP
    IF voice_private.transient_source_readable_v1(v_set.user_id, v_set.owner_kind, v_set.subject_id) THEN
      UPDATE voice_private.transient_media_artifacts a SET source_checked_at = v_now
       WHERE a.set_id = v_set.set_id AND a.job_state IN ('PENDING', 'RUNNING', 'READY');
    ELSE
      v_expired := v_expired + voice_private.end_transient_set_v1(v_set.set_id, 'EXPIRED', NULL,
        voice_private.transient_source_end_instant_v1(v_set.owner_kind, v_set.subject_id));
    END IF;
  END LOOP;
  -- erase_by = due_at + 120 s missed: recorded once (TRANSIENT_ERASURE_LATE is emitted by the caller every cycle).
  UPDATE voice_private.transient_media_erasures e SET erasure_late_at = v_now
   WHERE e.erased_at IS NULL AND e.erasure_late_at IS NULL AND e.due_at + interval '120 seconds' < v_now;
  GET DIAGNOSTICS v_late = ROW_COUNT;
  SELECT count(*)::integer INTO v_outstanding FROM voice_private.transient_media_erasures e
   WHERE e.erased_at IS NULL AND e.erasure_late_at IS NOT NULL;
  -- Purge, bounded: ledger rows whose set is wholly erased and older than 24 h; then the artifact and erasure rows
  -- erased more than 24 h ago that nothing references; then stale heartbeats.
  DELETE FROM voice_private.transient_media_requests q
   WHERE (q.user_id, q.command_id) IN (
     SELECT r.user_id, r.command_id FROM voice_private.transient_media_requests r
      WHERE r.created_at < v_now - interval '24 hours'
        AND NOT EXISTS (SELECT 1 FROM voice_private.transient_media_artifacts a
                          LEFT JOIN voice_private.transient_media_erasures e ON e.storage_key = a.storage_key
                         WHERE a.set_id = r.set_id AND (e.storage_key IS NULL OR e.erased_at IS NULL))
        AND NOT EXISTS (SELECT 1 FROM voice_private.transient_media_artifacts a
                         WHERE a.set_id = r.set_id AND a.job_state IN ('PENDING', 'RUNNING', 'READY'))
      LIMIT p_limit);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_purged := v_purged + v_n;
  DELETE FROM voice_private.transient_media_artifacts a
   WHERE a.id IN (
     SELECT x.id FROM voice_private.transient_media_artifacts x
       JOIN voice_private.transient_media_erasures e ON e.storage_key = x.storage_key
      WHERE x.job_state IN ('FAILED', 'RELEASED', 'EXPIRED') AND e.erased_at < v_now - interval '24 hours'
        AND NOT EXISTS (SELECT 1 FROM voice_private.transient_media_requests r WHERE r.set_id = x.set_id)
      LIMIT p_limit);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_purged := v_purged + v_n;
  DELETE FROM voice_private.transient_media_erasures e
   WHERE e.storage_key IN (
     SELECT y.storage_key FROM voice_private.transient_media_erasures y
      WHERE y.erased_at < v_now - interval '24 hours'
        AND NOT EXISTS (SELECT 1 FROM voice_private.transient_media_artifacts a WHERE a.storage_key = y.storage_key)
      LIMIT p_limit);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_purged := v_purged + v_n;
  DELETE FROM voice_private.replay_pool_heartbeats h WHERE h.seen_at < v_now - interval '24 hours';
  RETURN QUERY SELECT v_expired, v_late, v_outstanding, v_purged;
END$$;

-- Due keys for the DELETE + HEAD 404 pass: the reaper (every 10 s, overdue 0) and the watchdog's backstop (overdue
-- 120 s). A key whose file a worker may still be writing (its last lease not yet lapsed) is never claimed.
CREATE FUNCTION public.server_claim_transient_media_erasures_v1(p_limit integer, p_overdue_seconds integer)
RETURNS TABLE (storage_key text, lease_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 OR p_overdue_seconds IS NULL OR p_overdue_seconds < 0
     OR p_overdue_seconds > 3600 THEN
    RAISE EXCEPTION 'TRANSIENT_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    WITH pick AS (
      SELECT e.storage_key FROM voice_private.transient_media_erasures e
       WHERE e.erased_at IS NULL AND e.due_at + make_interval(secs => p_overdue_seconds) <= v_now
         AND (e.lease_until IS NULL OR e.lease_until < v_now)
         AND NOT EXISTS (SELECT 1 FROM voice_private.transient_media_artifacts a
                          WHERE a.storage_key = e.storage_key
                            AND ((a.job_state IN ('PENDING', 'RUNNING', 'READY') AND a.expires_at > v_now)
                                 OR a.lease_until > v_now))
       ORDER BY e.due_at, e.storage_key
       LIMIT p_limit
       FOR UPDATE OF e SKIP LOCKED
    )
    UPDATE voice_private.transient_media_erasures e
       SET lease_id = gen_random_uuid(), lease_until = v_now + interval '60 seconds', attempts = e.attempts + 1
      FROM pick WHERE e.storage_key = pick.storage_key
    RETURNING e.storage_key, e.lease_id;
END$$;

-- After DELETE and a HEAD that answered 404: the key is proven erased.
CREATE FUNCTION public.server_complete_transient_media_erasure_v1(p_storage_key text, p_lease_id uuid)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_n integer;
BEGIN
  IF p_storage_key IS NULL OR p_lease_id IS NULL THEN
    RAISE EXCEPTION 'TRANSIENT_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  UPDATE voice_private.transient_media_erasures e SET erased_at = clock_timestamp(), lease_id = NULL, lease_until = NULL
   WHERE e.storage_key = p_storage_key AND e.lease_id = p_lease_id AND e.erased_at IS NULL
     AND e.due_at <= clock_timestamp();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n = 1;
END$$;

CREATE FUNCTION public.server_beat_transient_media_pool_v1(p_instance_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_instance_id IS NULL OR p_role IS NULL OR p_role NOT IN ('REPLAY_MEDIA', 'REPLAY_WATCHDOG') THEN
    RAISE EXCEPTION 'TRANSIENT_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  INSERT INTO voice_private.replay_pool_heartbeats (instance_id, role, seen_at)
  VALUES (p_instance_id, p_role, clock_timestamp())
  ON CONFLICT ON CONSTRAINT replay_pool_heartbeats_pk DO UPDATE SET role = excluded.role, seen_at = excluded.seen_at;
END$$;

-- Content-free health for the watchdog's metrics: ages in milliseconds and counts, nothing else.
CREATE FUNCTION public.server_read_transient_media_health_v1()
RETURNS TABLE (oldest_pending_age_ms bigint, pending_over_60s integer, pool_heartbeat_age_ms bigint,
               watchdog_heartbeat_age_ms bigint, erasures_due integer, erasures_late integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (SELECT floor(extract(epoch FROM (clock_timestamp() - min(a.created_at))) * 1000)::bigint
            FROM voice_private.transient_media_artifacts a WHERE a.job_state = 'PENDING'),
         (SELECT count(*)::integer FROM voice_private.transient_media_artifacts a
           WHERE a.job_state = 'PENDING' AND a.created_at < clock_timestamp() - interval '60 seconds'),
         (SELECT floor(extract(epoch FROM (clock_timestamp() - max(h.seen_at))) * 1000)::bigint
            FROM voice_private.replay_pool_heartbeats h WHERE h.role = 'REPLAY_MEDIA'),
         (SELECT floor(extract(epoch FROM (clock_timestamp() - max(h.seen_at))) * 1000)::bigint
            FROM voice_private.replay_pool_heartbeats h WHERE h.role = 'REPLAY_WATCHDOG'),
         (SELECT count(*)::integer FROM voice_private.transient_media_erasures e
           WHERE e.erased_at IS NULL AND e.due_at <= clock_timestamp()),
         (SELECT count(*)::integer FROM voice_private.transient_media_erasures e
           WHERE e.erased_at IS NULL AND e.erasure_late_at IS NOT NULL);
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 13. THE FINISHED-CALL READ WITH RECORDING AVAILABILITY (G). The 0193 read, plus the recording's status, its readable
--     deadline, and a reason only where it is proven: EXPIRED for an expired recording (by state or by its clock),
--     DELETED only for the owner's own deletion; otherwise NULL (an account erasure, a recording never stored).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_read_session_finished_calls_v2(p_user_id uuid, p_session_id uuid, p_ended_from timestamptz,
                                                             p_ended_before timestamptz)
RETURNS TABLE (call_id uuid, started_at timestamptz, ended_at timestamptz, end_reason text, at_max_length boolean,
               recording_status text, available_until timestamptz, unavailable_reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT f.call_id, f.started_at, f.ended_at, f.end_reason, f.at_max_length,
         CASE WHEN r.id IS NULL THEN 'UNAVAILABLE'
              WHEN r.recording_state = 'EXPIRED' OR clock_timestamp() >= r.retention_expires_at THEN 'UNAVAILABLE'
              WHEN r.recording_state = 'RECORDING' THEN 'PREPARING'
              WHEN r.recording_state = 'STORED' AND voice_private.recording_readable_v1(p_user_id, r.id) THEN 'AVAILABLE'
              ELSE 'UNAVAILABLE' END,
         CASE WHEN r.recording_state = 'STORED' AND voice_private.recording_readable_v1(p_user_id, r.id)
              THEN r.retention_expires_at END,
         CASE WHEN r.id IS NULL THEN NULL
              WHEN r.recording_state = 'EXPIRED'
                OR (r.recording_state IN ('STORED', 'RECORDING') AND clock_timestamp() >= r.retention_expires_at) THEN 'EXPIRED'
              WHEN r.recording_state = 'DELETED' AND r.deleted_reason = 'OWNER' THEN 'DELETED'
              ELSE NULL END
    FROM public.server_read_session_finished_calls_v1(p_user_id, p_session_id, p_ended_from, p_ended_before) f
    LEFT JOIN voice_private.recordings r
      ON r.call_id = f.call_id AND r.user_id = p_user_id AND r.recording_kind = 'LIVE_CALL'
   ORDER BY f.ended_at DESC, f.call_id DESC;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 14. ACCOUNT ERASURE COVERAGE (I).
-- ---------------------------------------------------------------------------------------------------------------------
INSERT INTO account_erasure_private.coverage_registry (relation, coverage) VALUES
    ('voice_private.transient_media_artifacts', 'ACCOUNT_CASCADE'),
    ('voice_private.transient_media_requests', 'ACCOUNT_CASCADE');

-- ---------------------------------------------------------------------------------------------------------------------
-- 15. OWNERSHIP AND ACL. No role holds any privilege on a new relation; the Replay pool's role executes the transient
--     definers, the API's role only the finished-call read; the helpers belong to no role.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  fn text;
  r text;
BEGIN
  FOREACH t IN ARRAY ARRAY['voice_private.transient_media_policy', 'voice_private.transient_media_artifacts',
                           'voice_private.transient_media_requests', 'voice_private.transient_media_erasures',
                           'voice_private.replay_pool_heartbeats'] LOOP
    EXECUTE format('ALTER TABLE %s OWNER TO postgres', t);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC', t);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role', 'qandeel_replay_media'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON TABLE %s FROM %I', t, r); END IF;
    END LOOP;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY[
    'voice_private.guard_transient_media_artifact_v1()',
    'voice_private.guard_transient_media_erasure_v1()',
    'voice_private.transient_media_artifact_removed_v1()',
    'voice_private.transient_source_readable_v1(uuid,text,uuid)',
    'voice_private.transient_plan_runs_v1(uuid,uuid)',
    'voice_private.transient_readable_for_ms_v1(text,timestamptz,boolean)',
    'voice_private.transient_set_rows_v1(uuid,uuid)',
    'voice_private.end_transient_set_v1(uuid,text,text,timestamptz)',
    'voice_private.transient_source_end_instant_v1(text,uuid)',
    'voice_private.transient_unavailable_reason_v1(uuid,text,uuid)',
    'public.server_request_transient_media_v1(uuid,text,uuid,uuid)',
    'public.server_read_transient_media_map_v1(uuid,uuid,uuid)',
    'public.server_claim_transient_media_jobs_v1(integer)',
    'public.server_read_transient_media_job_v1(uuid,uuid)',
    'public.server_heartbeat_transient_media_job_v1(uuid,uuid)',
    'public.server_complete_transient_media_job_v1(uuid,uuid,bigint,bigint,text,bigint,bigint,bigint,integer)',
    'public.server_fail_transient_media_job_v1(uuid,uuid,text,bigint,bigint,bigint,integer)',
    'public.server_read_transient_media_v1(uuid,uuid)',
    'public.server_check_transient_media_v1(uuid,uuid)',
    'public.server_release_transient_media_v1(uuid,uuid)',
    'public.server_sweep_transient_media_v1(integer)',
    'public.server_claim_transient_media_erasures_v1(integer,integer)',
    'public.server_complete_transient_media_erasure_v1(text,uuid)',
    'public.server_beat_transient_media_pool_v1(uuid,text)',
    'public.server_read_transient_media_health_v1()',
    'public.server_read_session_finished_calls_v2(uuid,uuid,timestamptz,timestamptz)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role', 'qandeel_replay_media'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r); END IF;
    END LOOP;
    IF fn LIKE 'public.server\_%transient\_media%' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO qandeel_replay_media', fn);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.server_read_session_finished_calls_v2(uuid,uuid,timestamptz,timestamptz) TO service_role;
  END IF;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 16. DEPLOY SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  def text;
  v_writers text[];
BEGIN
  -- Every voice capability scope stays closed.
  IF (SELECT count(*) FROM voice_private.voice_launch_capability_states s
       WHERE s.feature_flag_state = 'DISABLED' AND s.launch_requirements_state = 'UNSATISFIED') <> 4 THEN
    RAISE EXCEPTION 'S8B-07 CP1-B: every voice capability scope must remain DISABLED / UNSATISFIED';
  END IF;
  -- No application role, and not the Replay pool's role, reaches a voice relation.
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants g
              WHERE g.table_schema = 'voice_private'
                AND g.grantee IN ('anon', 'authenticated', 'service_role', 'qandeel_replay_media', 'PUBLIC')) THEN
    RAISE EXCEPTION 'S8B-07 CP1-B: a voice relation is reachable by an application role';
  END IF;
  -- The Replay pool's role: its approved initial limits, no login yet, no inherited privilege.
  IF NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'qandeel_replay_media' AND r.rolconnlimit = 10
                    AND NOT r.rolsuper AND NOT r.rolinherit AND NOT r.rolcreaterole AND NOT r.rolcreatedb
                    AND NOT r.rolbypassrls AND NOT r.rolcanlogin)
     OR NOT EXISTS (SELECT 1 FROM pg_db_role_setting s JOIN pg_roles r ON r.oid = s.setrole
                     WHERE r.rolname = 'qandeel_replay_media' AND s.setdatabase = 0
                       AND 'statement_timeout=5s' = ANY (s.setconfig) AND 'lock_timeout=1s' = ANY (s.setconfig)
                       AND 'idle_in_transaction_session_timeout=10s' = ANY (s.setconfig)) THEN
    RAISE EXCEPTION 'S8B-07 CP1-B: the Replay pool role must carry exactly its approved initial limits';
  END IF;
  -- The shared erasure queue is untouched: it still refuses a transient key.
  SELECT pg_get_constraintdef(c.oid) INTO def FROM pg_constraint c
   WHERE c.conrelid = 'introduction_sharing_private.media_erasure_queue'::regclass
     AND c.conname = 'media_erasure_queue_key_check';
  IF def IS NULL OR strpos(def, 'voice-transient') > 0 OR strpos(def, 'voice-note|voice-call') = 0 THEN
    RAISE EXCEPTION 'S8B-07 CP1-B: the shared media erasure queue CHECK must stay unchanged';
  END IF;
  -- One write path: the only function that inserts an artifact is the request; no new function writes a recording,
  -- its retention, a call or the shared queue, and none runs dynamic SQL.
  SELECT array_agg(p.proname::text ORDER BY 1) INTO v_writers FROM pg_proc p
   WHERE p.prosrc ~* 'INSERT\s+INTO\s+voice_private\.transient_media_artifacts';
  IF v_writers IS DISTINCT FROM ARRAY['server_request_transient_media_v1'] THEN
    RAISE EXCEPTION 'S8B-07 CP1-B: only the request may insert an artifact (found %)', v_writers;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p
              WHERE (p.proname ~ 'transient' OR p.proname = 'server_read_session_finished_calls_v2')
                AND (p.prosrc ~* '(UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+voice_private\.(recordings|recording_objects|recording_gaps|calls)'
                     OR p.prosrc ~* 'retention_expires_at\s*='
                     OR p.prosrc ~* 'media_erasure_queue'
                     OR p.prosrc ~* '\mEXECUTE\s')) THEN
    RAISE EXCEPTION 'S8B-07 CP1-B: a transient function writes a source, its retention or the shared queue, or runs dynamic SQL';
  END IF;
  -- No public replay* relation is added (the Replay census stays 36), and no client role executes any new function.
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND (p.proname ~ 'transient' OR p.proname = 'server_read_session_finished_calls_v2')
                AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))) THEN
    RAISE EXCEPTION 'S8B-07 CP1-B: a transient definer is reachable by a client role';
  END IF;
END$$;

COMMIT;
