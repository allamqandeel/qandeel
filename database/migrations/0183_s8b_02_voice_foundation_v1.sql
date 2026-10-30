-- S8B-02 CP1 — Voice Foundation: the voice source of a turn (VA-3), the recording authority with its retention, segments,
-- gaps and consent, the four voice capability gates (all DISABLED), the Replay R-1 boundary, the D-7 reader guards and the
-- voice module of the account erasure.
--
-- Product authority: the Product Owner's S8B-02 WP0 approval (2026-10-30: D-1 .. D-8 and PRIV-W) and CP1 implementation
-- authorization (2026-10-30, with P-1 approved). The binding design is the S8B-02 Implementation Task Contract v1.0 FINAL
-- §3.2 – §3.8 and §3.10; the voice runtime contract is docs/voice-runtime-v1.md and its controlled amendment
-- docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8B-01_VOICE_RUNTIME_CONTROLLED_AMENDMENT_v1.0.md
-- (VA-3, VA-8 R-1). The implementation record is docs/e2e/QANDEEL_S8B_02_VOICE_FOUNDATION_IMPLEMENTATION_RECORD_v1.md.
--
-- ## What is added
--
--   A. Schema voice_private (not exposed through the Data API; RLS on, no policy; postgres-owned):
--        recordings          one row per Voice Note or call recording: its anchor (accepted_at for a note, started_at for a
--                            call), its retention (anchor + 30 days, by CHECK, immutable by trigger for every role) and its
--                            state. No storage key, URL or credential is stored outside recording_objects.
--        recording_objects   one stored object per Voice Note, or one per call segment and track, with a database-generated
--                            key (voice-note/<uuid> or voice-call/<uuid>).
--        recording_gaps      explicit gap markers of a call track (RECONNECTION, MUTED, WRITER_LOSS). Nothing is stitched.
--        consent_texts       the VOICE_RECORDING consent catalogue (0154 pattern). EMPTY: S8B-03 installs the first text.
--        recording_consents  grants and withdrawals; one active grant per human (PRIV-W).
--        voice_launch_capability_states / _events   the 0169 gate pattern: PERSONAL_VOICE_NOTE, PERSONAL_LIVE_CALL,
--                            SHARED_VOICE_NOTE, REPLAY_AUDIO_DISTRIBUTION, each seeded DISABLED / UNSATISFIED.
--   B. public.conversation_turn_voice_sources (VA-3): the voice source of a turn, written once, before its units exist,
--      by server_attach_turn_voice_source_v1. A turn without a row is a text turn.
--   C. The units modality CHECK admits VOICE_NOTE / LIVE_CALL_SPEECH; the live producer copies the modality from the turn's
--      voice source (none: TEXT, so every text fingerprint, row and outcome is unchanged); a guard refuses any unit whose
--      modality is not its turn's, so the ungranted legacy producers (0064 .. 0070) cannot commit a voice turn.
--   D. Replay R-1: a Personal Replay item's medium is its unit's (ORIGINAL_AUDIO for a voice unit); moments return no text
--      for a non-ORIGINAL_TEXT item. Render, preview and distribution are not touched: the existing ORIGINAL_TEXT_ONLY law
--      already refuses an audio-bearing Replay (0103), which is the waiting state of S8B-07's R-2, not a cancellation.
--   E. D-7 readers: a LOW-band turn writes no Memory, any other band is recorded MACHINE_ASR (memories_source_check and
--      the shape guard widened); voice units are excluded from the S8A-05 direct text path (picker, package, publish from
--      QANDEEL); the export labels voice turns and lists retained recordings as metadata.
--   F. Media and account erasure, extended and not duplicated: the 0162 queue and 0164 media_pending admit voice keys; a
--      voice reconciliation; the voice module inside the 0169 erasure subtransaction, before 0130; coverage VOICE.
--   G. The service_role definers of the recording lifecycle (begin, accept, open, segments, gaps, seal, recovery, sweep,
--      read, owner deletion, consent, attach, provenance). The gate is consulted by begin and open only; read, owner
--      deletion, export, expiry and erasure never consult it.
--
-- ## What is deliberately NOT here
--
--   * No API, worker, store adapter or client (CP2 / S8B-03 .. S8B-05). No call states and no call table (S8B-05).
--   * No consent text: every recording act is refused until S8B-03 installs a Copy-Gated version.
--   * No gate is opened. No Replay render contract for audio, no distribution, no Public publishing of a call (S8B-07).
--   * 0162, 0164, 0169, 0071, 0150 and every earlier migration stay byte-identical. The 0150 coordinator is not re-created:
--     it calls the live producer, which carries the whole change.
--
-- Every forward-replaced function is its origin statement verbatim with the exact edits declared in
-- database/voice-foundation-0183-substitutions.mjs; verify-migration-0183 re-derives each one.

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. THE SCHEMA.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE SCHEMA voice_private;
ALTER SCHEMA voice_private OWNER TO postgres;
REVOKE ALL ON SCHEMA voice_private FROM PUBLIC;
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA voice_private FROM %I', r);
    END IF;
  END LOOP;
END$$;

-- The controlled ceilings this migration enforces. Operating values (segment length, lease, upload window) are the
-- writer's configuration (S8B-05 / CP2) inside them.
CREATE FUNCTION voice_private.object_byte_ceiling_v1() RETURNS bigint
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT 26214400::bigint $$;      -- 25 MiB per stored object
CREATE FUNCTION voice_private.note_upload_window_v1() RETURNS interval
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT interval '600 seconds' $$;
CREATE FUNCTION voice_private.segment_upload_window_v1() RETURNS interval
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT interval '120 seconds' $$;
-- A pending object's key is queued for erasure only after its upload can no longer land.
CREATE FUNCTION voice_private.late_upload_grace_v1() RETURNS interval
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT interval '60 seconds' $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. THE RECORDING AUTHORITY (§3.4, D-4, D-6).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.recordings (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    session_id uuid NOT NULL,
    recording_kind text NOT NULL,
    begin_command_id uuid,
    call_id uuid,
    accepted_at timestamptz,
    started_at timestamptz,
    retention_expires_at timestamptz,
    recording_state text NOT NULL,
    upload_deadline timestamptz,
    writer_lease_until timestamptz,
    sealed_by text,
    deleted_reason text,
    terminal_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT recordings_pk PRIMARY KEY (id),
    CONSTRAINT recordings_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT recordings_session_fk
        FOREIGN KEY (session_id, user_id) REFERENCES public.conversation_sessions (id, user_id) ON DELETE RESTRICT,
    CONSTRAINT recordings_begin_command_key UNIQUE (begin_command_id),
    CONSTRAINT recordings_call_key UNIQUE (call_id),
    CONSTRAINT recordings_kind_check CHECK (recording_kind IN ('VOICE_NOTE', 'LIVE_CALL')),
    -- A note is begun by a command; a call recording is named by its call (the FK is S8B-05's).
    CONSTRAINT recordings_identity_check CHECK (
        (recording_kind = 'VOICE_NOTE' AND call_id IS NULL AND begin_command_id IS NOT NULL)
     OR (recording_kind = 'LIVE_CALL' AND call_id IS NOT NULL AND begin_command_id IS NULL)),
    -- D-6 / D-4: the retention anchor, and the expiry it fixes. A call recording never exists without an expiry. Every
    -- branch is NULL-safe (a CHECK that evaluates to NULL passes): each comparison is guarded by IS NOT NULL.
    CONSTRAINT recordings_retention_check CHECK (CASE recording_kind
        WHEN 'VOICE_NOTE' THEN started_at IS NULL
            AND ((accepted_at IS NULL AND retention_expires_at IS NULL)
              OR (accepted_at IS NOT NULL AND retention_expires_at IS NOT NULL
                  AND retention_expires_at = accepted_at + interval '30 days'))
        WHEN 'LIVE_CALL' THEN accepted_at IS NULL AND started_at IS NOT NULL AND retention_expires_at IS NOT NULL
            AND retention_expires_at = started_at + interval '30 days'
        ELSE false END),
    CONSTRAINT recordings_state_check
        CHECK (recording_state IN ('PENDING_UPLOAD', 'RECORDING', 'STORED', 'EXPIRED', 'DELETED', 'DISCARDED')),
    CONSTRAINT recordings_state_shape_check CHECK (
        (recording_state = 'PENDING_UPLOAD' AND recording_kind = 'VOICE_NOTE' AND accepted_at IS NULL
            AND upload_deadline IS NOT NULL)
     OR (recording_state = 'RECORDING' AND recording_kind = 'LIVE_CALL' AND writer_lease_until IS NOT NULL
            AND sealed_by IS NULL)
     OR (recording_state IN ('STORED', 'EXPIRED', 'DELETED') AND retention_expires_at IS NOT NULL
            AND (recording_kind = 'VOICE_NOTE' OR recording_state = 'DELETED' OR sealed_by IS NOT NULL))
     OR (recording_state = 'DISCARDED' AND recording_kind = 'VOICE_NOTE' AND accepted_at IS NULL)),
    CONSTRAINT recordings_sealed_check
        CHECK (sealed_by IS NULL OR (recording_kind = 'LIVE_CALL' AND sealed_by IN ('WRITER', 'RECOVERY'))),
    -- Expiry is its own state; a withdrawal of consent is never a deletion reason.
    CONSTRAINT recordings_deleted_reason_check
        CHECK ((recording_state = 'DELETED') = (deleted_reason IS NOT NULL)
               AND (deleted_reason IS NULL OR deleted_reason IN ('OWNER', 'ACCOUNT_ERASURE'))),
    CONSTRAINT recordings_terminal_check
        CHECK ((recording_state IN ('EXPIRED', 'DELETED', 'DISCARDED')) = (terminal_at IS NOT NULL))
);
CREATE INDEX recordings_user_idx ON voice_private.recordings (user_id);
CREATE INDEX recordings_session_idx ON voice_private.recordings (session_id, user_id);
CREATE INDEX recordings_expiry_idx ON voice_private.recordings (retention_expires_at) WHERE recording_state = 'STORED';

CREATE TABLE voice_private.recording_objects (
    recording_id uuid NOT NULL,
    track text NOT NULL,
    segment_index integer NOT NULL,
    storage_key text NOT NULL,
    object_state text NOT NULL,
    content_type text NOT NULL,
    byte_size bigint NOT NULL,
    clock_start_ms bigint,
    clock_end_ms bigint,
    upload_deadline timestamptz NOT NULL,
    stored_at timestamptz,
    CONSTRAINT recording_objects_pk PRIMARY KEY (recording_id, track, segment_index),
    CONSTRAINT recording_objects_recording_fk
        FOREIGN KEY (recording_id) REFERENCES voice_private.recordings (id) ON DELETE RESTRICT,
    CONSTRAINT recording_objects_key_unique UNIQUE (storage_key),
    CONSTRAINT recording_objects_key_check CHECK (storage_key ~ '^voice-(note|call)/[0-9a-f-]{36}$'),
    CONSTRAINT recording_objects_track_check CHECK (track IN ('NOTE', 'USER', 'QANDEEL')),
    CONSTRAINT recording_objects_index_check CHECK (segment_index >= 0 AND (track <> 'NOTE' OR segment_index = 0)),
    -- D-C2: a note is one audio/mp4 object; D-C1: a call track is audio/ogg segments on the recording clock.
    CONSTRAINT recording_objects_shape_check CHECK (
        (track = 'NOTE' AND content_type = 'audio/mp4' AND storage_key LIKE 'voice-note/%'
            AND clock_start_ms IS NULL AND clock_end_ms IS NULL)
     OR (track IN ('USER', 'QANDEEL') AND content_type = 'audio/ogg' AND storage_key LIKE 'voice-call/%'
            AND clock_start_ms IS NOT NULL AND clock_end_ms IS NOT NULL AND 0 <= clock_start_ms
            AND clock_start_ms < clock_end_ms)),
    CONSTRAINT recording_objects_state_check CHECK (object_state IN ('PENDING_UPLOAD', 'STORED', 'DISCARDED')),
    CONSTRAINT recording_objects_size_check CHECK (byte_size > 0 AND byte_size <= 26214400),
    CONSTRAINT recording_objects_stored_check CHECK ((object_state = 'STORED') = (stored_at IS NOT NULL))
);

CREATE TABLE voice_private.recording_gaps (
    recording_id uuid NOT NULL,
    track text NOT NULL,
    clock_start_ms bigint NOT NULL,
    clock_end_ms bigint NOT NULL,
    gap_kind text NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT recording_gaps_pk PRIMARY KEY (recording_id, track, clock_start_ms),
    CONSTRAINT recording_gaps_recording_fk
        FOREIGN KEY (recording_id) REFERENCES voice_private.recordings (id) ON DELETE RESTRICT,
    CONSTRAINT recording_gaps_track_check CHECK (track IN ('USER', 'QANDEEL')),
    CONSTRAINT recording_gaps_clock_check CHECK (0 <= clock_start_ms AND clock_start_ms < clock_end_ms),
    CONSTRAINT recording_gaps_kind_check CHECK (gap_kind IN ('RECONNECTION', 'MUTED', 'WRITER_LOSS'))
);

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. CONSENT (§3.7, PRIV-W). The catalogue is EMPTY: no production text is installed here.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.consent_texts (
    purpose text NOT NULL,
    version text NOT NULL,
    text_ar text NOT NULL,
    text_en text NOT NULL,
    text_ar_sha256 text NOT NULL,
    text_en_sha256 text NOT NULL,
    is_current boolean NOT NULL DEFAULT false,
    installed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT consent_texts_pk PRIMARY KEY (purpose, version),
    CONSTRAINT consent_texts_purpose_check CHECK (purpose = 'VOICE_RECORDING'),
    CONSTRAINT consent_texts_version_check CHECK (version ~ '^[A-Z][A-Z0-9_]{2,63}$'),
    CONSTRAINT consent_texts_text_check CHECK (length(btrim(text_ar)) > 0 AND length(btrim(text_en)) > 0),
    CONSTRAINT consent_texts_ar_digest_check CHECK (text_ar_sha256 = encode(sha256(convert_to(text_ar, 'UTF8')), 'hex')),
    CONSTRAINT consent_texts_en_digest_check CHECK (text_en_sha256 = encode(sha256(convert_to(text_en, 'UTF8')), 'hex'))
);
CREATE UNIQUE INDEX consent_texts_one_current_idx ON voice_private.consent_texts (purpose) WHERE is_current;

CREATE TABLE voice_private.recording_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    purpose text NOT NULL,
    consent_version text NOT NULL,
    grant_command_id uuid NOT NULL,
    granted_at timestamptz NOT NULL,
    revoke_command_id uuid,
    revoked_at timestamptz,
    CONSTRAINT recording_consents_pk PRIMARY KEY (id),
    CONSTRAINT recording_consents_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
    CONSTRAINT recording_consents_text_fk
        FOREIGN KEY (purpose, consent_version) REFERENCES voice_private.consent_texts (purpose, version) ON DELETE RESTRICT,
    CONSTRAINT recording_consents_grant_command_key UNIQUE (grant_command_id),
    CONSTRAINT recording_consents_revoke_check
        CHECK ((revoked_at IS NULL) = (revoke_command_id IS NULL) AND (revoked_at IS NULL OR revoked_at >= granted_at))
);
CREATE UNIQUE INDEX recording_consents_one_active_idx ON voice_private.recording_consents (user_id) WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. THE VOICE CAPABILITY GATE (§3.8): the 0169 pattern, four scopes, each DISABLED.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE voice_private.voice_launch_capability_states (
    capability_scope text NOT NULL,
    feature_flag_state text NOT NULL,
    launch_requirements_state text NOT NULL,
    restriction_version bigint NOT NULL,
    decided_by text NOT NULL,
    policy_basis text NOT NULL,
    decided_at timestamptz NOT NULL,
    CONSTRAINT voice_launch_capability_states_pk PRIMARY KEY (capability_scope),
    CONSTRAINT voice_launch_capability_states_scope_check CHECK (capability_scope IN
        ('PERSONAL_VOICE_NOTE', 'PERSONAL_LIVE_CALL', 'SHARED_VOICE_NOTE', 'REPLAY_AUDIO_DISTRIBUTION')),
    CONSTRAINT voice_launch_capability_states_flag_check
        CHECK (feature_flag_state IN ('DISABLED', 'INTERNAL', 'LIMITED_ROLLOUT', 'ENABLED', 'EMERGENCY_DISABLED')),
    CONSTRAINT voice_launch_capability_states_requirements_check
        CHECK (launch_requirements_state IN ('SATISFIED', 'UNSATISFIED', 'UNKNOWN', 'WAIVED_BY_AUTHORIZED_GOVERNANCE')),
    CONSTRAINT voice_launch_capability_states_version_check CHECK (restriction_version >= 1),
    CONSTRAINT voice_launch_capability_states_decided_by_check CHECK (length(btrim(decided_by)) BETWEEN 1 AND 120),
    CONSTRAINT voice_launch_capability_states_basis_check CHECK (length(btrim(policy_basis)) BETWEEN 1 AND 500)
);

CREATE TABLE voice_private.voice_launch_capability_events (
    id bigint GENERATED ALWAYS AS IDENTITY,
    capability_scope text NOT NULL,
    feature_flag_state text NOT NULL,
    launch_requirements_state text NOT NULL,
    restriction_version bigint NOT NULL,
    decided_by text NOT NULL,
    policy_basis text NOT NULL,
    decided_at timestamptz NOT NULL,
    CONSTRAINT voice_launch_capability_events_pk PRIMARY KEY (id),
    CONSTRAINT voice_launch_capability_events_scope_fk
        FOREIGN KEY (capability_scope) REFERENCES voice_private.voice_launch_capability_states (capability_scope)
        ON DELETE RESTRICT,
    CONSTRAINT voice_launch_capability_events_version_key UNIQUE (capability_scope, restriction_version)
);

INSERT INTO voice_private.voice_launch_capability_states
  (capability_scope, feature_flag_state, launch_requirements_state, restriction_version, decided_by, policy_basis, decided_at)
SELECT s, 'DISABLED', 'UNSATISFIED', 1, 'S8B-02 CP1 (migration 0183)',
       'Seeded closed: no voice capability opens before its own launch decision (S8B-02 contract §3.8).', clock_timestamp()
  FROM unnest(ARRAY['PERSONAL_VOICE_NOTE', 'PERSONAL_LIVE_CALL', 'SHARED_VOICE_NOTE', 'REPLAY_AUDIO_DISTRIBUTION']) AS s;
INSERT INTO voice_private.voice_launch_capability_events
  (capability_scope, feature_flag_state, launch_requirements_state, restriction_version, decided_by, policy_basis, decided_at)
SELECT capability_scope, feature_flag_state, launch_requirements_state, restriction_version, decided_by, policy_basis,
       decided_at
  FROM voice_private.voice_launch_capability_states ORDER BY capability_scope;

-- The ONLY way the gate state changes. Executable by no application role: an operator runs it as the database owner.
CREATE FUNCTION voice_private.set_voice_launch_capability_v1(
  p_capability_scope text, p_feature_flag_state text, p_launch_requirements_state text, p_decided_by text, p_policy_basis text
) RETURNS TABLE (capability_scope text, restriction_version bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_version bigint;
  v_at timestamptz := clock_timestamp();
BEGIN
  SELECT s.restriction_version INTO v_version
    FROM voice_private.voice_launch_capability_states s
   WHERE s.capability_scope = p_capability_scope
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VOICE_CAPABILITY_SCOPE_UNKNOWN' USING ERRCODE = '22023';
  END IF;
  v_version := v_version + 1;
  UPDATE voice_private.voice_launch_capability_states s
     SET feature_flag_state = p_feature_flag_state, launch_requirements_state = p_launch_requirements_state,
         restriction_version = v_version, decided_by = p_decided_by, policy_basis = p_policy_basis, decided_at = v_at
   WHERE s.capability_scope = p_capability_scope;
  INSERT INTO voice_private.voice_launch_capability_events
    (capability_scope, feature_flag_state, launch_requirements_state, restriction_version, decided_by, policy_basis,
     decided_at)
  VALUES (p_capability_scope, p_feature_flag_state, p_launch_requirements_state, v_version, p_decided_by, p_policy_basis,
          v_at);
  RETURN QUERY SELECT p_capability_scope, v_version;
END$$;

-- Whether a scope is open now. An unknown or unreadable state answers closed.
CREATE FUNCTION voice_private.capability_enabled_v1(p_capability_scope text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT s.feature_flag_state = 'ENABLED'
                          AND s.launch_requirements_state IN ('SATISFIED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE')
                     FROM voice_private.voice_launch_capability_states s
                    WHERE s.capability_scope = p_capability_scope), false);
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. VA-3: THE VOICE SOURCE OF A TURN (§3.2, D-3).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE public.conversation_turn_voice_sources (
    turn_id uuid NOT NULL,
    user_id uuid NOT NULL,
    session_id uuid NOT NULL,
    source_role text NOT NULL,
    source_modality text NOT NULL,
    transcript_origin text,
    asr_confidence_band text,
    recording_id uuid NOT NULL,
    anchor_start_ms bigint NOT NULL,
    anchor_end_ms bigint NOT NULL,
    spoken boolean,
    delivery_state text,
    attached_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT conversation_turn_voice_sources_pk PRIMARY KEY (turn_id),
    CONSTRAINT conversation_turn_voice_sources_turn_fk
        FOREIGN KEY (turn_id) REFERENCES public.conversation_turns (id) ON DELETE RESTRICT,
    CONSTRAINT conversation_turn_voice_sources_user_fk
        FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT conversation_turn_voice_sources_recording_fk
        FOREIGN KEY (recording_id) REFERENCES voice_private.recordings (id) ON DELETE RESTRICT,
    CONSTRAINT conversation_turn_voice_sources_role_check CHECK (source_role IN ('USER', 'ASSISTANT')),
    CONSTRAINT conversation_turn_voice_sources_modality_check CHECK (source_modality IN ('VOICE_NOTE', 'LIVE_CALL_SPEECH')),
    -- A human's words are a machine transcript with a band; QANDEEL's spoken words exist only in a call. NULL-safe: a
    -- missing origin, band, spoken flag or delivery state is refused, never passed as unknown.
    CONSTRAINT conversation_turn_voice_sources_role_shape_check CHECK (CASE source_role
        WHEN 'USER' THEN transcript_origin IS NOT DISTINCT FROM 'MACHINE_ASR'
            AND coalesce(asr_confidence_band IN ('HIGH', 'MEDIUM', 'LOW'), false)
            AND spoken IS NULL AND delivery_state IS NULL
        WHEN 'ASSISTANT' THEN source_modality = 'LIVE_CALL_SPEECH' AND transcript_origin IS NULL
            AND asr_confidence_band IS NULL AND spoken IS NOT DISTINCT FROM true
            AND coalesce(delivery_state IN ('COMPLETE', 'INTERRUPTED', 'WITHHELD_TAIL'), false)
        ELSE false END),
    CONSTRAINT conversation_turn_voice_sources_anchor_check CHECK (0 <= anchor_start_ms AND anchor_start_ms < anchor_end_ms)
);
CREATE INDEX conversation_turn_voice_sources_recording_idx ON public.conversation_turn_voice_sources (recording_id);
CREATE INDEX conversation_turn_voice_sources_user_idx ON public.conversation_turn_voice_sources (user_id);

-- The medium a Personal source item has: its turn's (ORIGINAL_AUDIO for a voice turn).
CREATE FUNCTION voice_private.turn_original_medium_v1(p_turn_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN EXISTS (SELECT 1 FROM public.conversation_turn_voice_sources vs WHERE vs.turn_id = p_turn_id)
              THEN 'ORIGINAL_AUDIO' ELSE 'ORIGINAL_TEXT' END;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. IMMUTABILITY. Every guard applies to every role, the table owner included; the governed account erasure alone may
--    DELETE (the 0169 rule), and consent rows also leave with the account row under the 0130 erasure.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION voice_private.account_erasure_delete_v1() RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  RETURN pg_catalog.current_setting('qandeel.account_erasure', true) = pg_catalog.txid_current()::text
     AND account_erasure_private.erasure_authorized_v1();
END$$;

CREATE FUNCTION voice_private.guard_recording_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF voice_private.account_erasure_delete_v1() THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'VOICE_RECORDING_IS_DURABLE' USING ERRCODE = '55000',
      DETAIL = 'A recording leaves only through the governed account erasure; owner deletion and expiry are states.';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.session_id IS DISTINCT FROM OLD.session_id OR NEW.recording_kind IS DISTINCT FROM OLD.recording_kind
     OR NEW.begin_command_id IS DISTINCT FROM OLD.begin_command_id OR NEW.call_id IS DISTINCT FROM OLD.call_id
     OR NEW.started_at IS DISTINCT FROM OLD.started_at OR NEW.created_at IS DISTINCT FROM OLD.created_at
     -- D-6: a note's anchor and expiry are written exactly once, from NULL, at acceptance; never again.
     OR (OLD.accepted_at IS NOT NULL AND NEW.accepted_at IS DISTINCT FROM OLD.accepted_at)
     OR (OLD.retention_expires_at IS NOT NULL AND NEW.retention_expires_at IS DISTINCT FROM OLD.retention_expires_at)
     OR (OLD.accepted_at IS NULL AND NEW.accepted_at IS NOT NULL
         AND NOT (OLD.recording_state = 'PENDING_UPLOAD' AND NEW.recording_state = 'STORED'))
     OR (OLD.sealed_by IS NOT NULL AND NEW.sealed_by IS DISTINCT FROM OLD.sealed_by)
     OR (OLD.terminal_at IS NOT NULL AND NEW.terminal_at IS DISTINCT FROM OLD.terminal_at) THEN
    RAISE EXCEPTION 'VOICE_RECORDING_IS_DURABLE' USING ERRCODE = '55000',
      DETAIL = 'A recording''s identity, anchor and expiry are immutable for every role.';
  END IF;
  IF NEW.recording_state IS DISTINCT FROM OLD.recording_state AND NOT (
       (OLD.recording_state = 'PENDING_UPLOAD' AND NEW.recording_state IN ('STORED', 'DISCARDED'))
    OR (OLD.recording_state = 'RECORDING' AND NEW.recording_state IN ('STORED', 'DELETED'))
    OR (OLD.recording_state = 'STORED' AND NEW.recording_state = 'DELETED')
    OR (OLD.recording_state = 'STORED' AND NEW.recording_state = 'EXPIRED'
        AND clock_timestamp() >= OLD.retention_expires_at)) THEN
    RAISE EXCEPTION 'VOICE_RECORDING_TRANSITION_REFUSED' USING ERRCODE = '55000',
      DETAIL = 'Only the published recording transitions exist; a terminal state is final.';
  END IF;
  RETURN NEW;
END$$;
CREATE TRIGGER recordings_durable BEFORE UPDATE OR DELETE ON voice_private.recordings
    FOR EACH ROW EXECUTE FUNCTION voice_private.guard_recording_v1();

CREATE FUNCTION voice_private.guard_recording_object_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF voice_private.account_erasure_delete_v1() THEN RETURN OLD; END IF;
  ELSIF NEW.recording_id = OLD.recording_id AND NEW.track = OLD.track AND NEW.segment_index = OLD.segment_index
        AND NEW.storage_key = OLD.storage_key AND NEW.content_type = OLD.content_type AND NEW.byte_size = OLD.byte_size
        AND NEW.clock_start_ms IS NOT DISTINCT FROM OLD.clock_start_ms
        AND NEW.clock_end_ms IS NOT DISTINCT FROM OLD.clock_end_ms AND NEW.upload_deadline = OLD.upload_deadline
        AND OLD.object_state = 'PENDING_UPLOAD' AND NEW.object_state IN ('STORED', 'DISCARDED') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'VOICE_RECORDING_OBJECT_IS_DURABLE' USING ERRCODE = '55000',
    DETAIL = 'An object is written once; only a pending object becomes STORED or DISCARDED.';
END$$;
CREATE TRIGGER recording_objects_durable BEFORE UPDATE OR DELETE ON voice_private.recording_objects
    FOR EACH ROW EXECUTE FUNCTION voice_private.guard_recording_object_v1();

CREATE FUNCTION voice_private.guard_append_only_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND voice_private.account_erasure_delete_v1() THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'VOICE_RECORD_IS_APPEND_ONLY' USING ERRCODE = '55000',
    DETAIL = 'This voice record is append-only for every role, including the table owner.';
END$$;
CREATE TRIGGER recording_gaps_append_only BEFORE UPDATE OR DELETE ON voice_private.recording_gaps
    FOR EACH ROW EXECUTE FUNCTION voice_private.guard_append_only_v1();
CREATE TRIGGER conversation_turn_voice_sources_append_only BEFORE UPDATE OR DELETE ON public.conversation_turn_voice_sources
    FOR EACH ROW EXECUTE FUNCTION voice_private.guard_append_only_v1();

-- A consent text is never rewritten; the only change is its retirement as current when a later version is installed.
CREATE FUNCTION voice_private.guard_consent_text_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.purpose = OLD.purpose AND NEW.version = OLD.version AND NEW.text_ar = OLD.text_ar
     AND NEW.text_en = OLD.text_en AND NEW.installed_at = OLD.installed_at AND OLD.is_current AND NOT NEW.is_current THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'VOICE_CONSENT_TEXT_IS_IMMUTABLE' USING ERRCODE = '55000';
END$$;
CREATE TRIGGER consent_texts_immutable BEFORE UPDATE OR DELETE ON voice_private.consent_texts
    FOR EACH ROW EXECUTE FUNCTION voice_private.guard_consent_text_v1();

-- A grant is withdrawn once and never re-granted in place; the row leaves only with its account.
CREATE FUNCTION voice_private.guard_recording_consent_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF voice_private.account_erasure_delete_v1()
       OR (pg_catalog.current_setting('qandeel.personal_erasure', true) = pg_catalog.txid_current()::text
           AND personal_data_private.personal_erasure_authorized_v1()) THEN
      RETURN OLD;
    END IF;
  ELSIF NEW.id = OLD.id AND NEW.user_id = OLD.user_id AND NEW.purpose = OLD.purpose
        AND NEW.consent_version = OLD.consent_version AND NEW.grant_command_id = OLD.grant_command_id
        AND NEW.granted_at = OLD.granted_at AND OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'VOICE_CONSENT_RECORD_IS_DURABLE' USING ERRCODE = '55000';
END$$;
CREATE TRIGGER recording_consents_durable BEFORE UPDATE OR DELETE ON voice_private.recording_consents
    FOR EACH ROW EXECUTE FUNCTION voice_private.guard_recording_consent_v1();

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. VA-3 IN THE UNITS: the modality CHECK widened, the producer forward-replaced, and the guard that makes every other
--    producer refuse a voice turn (a unit's modality is always its turn's).
-- ---------------------------------------------------------------------------------------------------------------------
ALTER TABLE public.conversation_units DROP CONSTRAINT conversation_units_source_modality_check;
ALTER TABLE public.conversation_units ADD CONSTRAINT conversation_units_source_modality_check
    CHECK (source_modality IN ('TEXT', 'VOICE_NOTE', 'LIVE_CALL_SPEECH'));

CREATE FUNCTION public.guard_conversation_unit_voice_source_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_modality text;
BEGIN
  SELECT vs.source_modality INTO v_modality FROM public.conversation_turn_voice_sources vs
   WHERE vs.turn_id = NEW.source_turn_id;
  IF NEW.source_modality IS DISTINCT FROM coalesce(v_modality, 'TEXT') THEN
    RAISE EXCEPTION 'UNSUPPORTED_SOURCE_MODALITY' USING ERRCODE = '22023',
      DETAIL = 'A committed unit carries its turn''s modality: TEXT unless the turn has a voice source.';
  END IF;
  RETURN NEW;
END$$;
CREATE TRIGGER conversation_units_voice_source_guard BEFORE INSERT ON public.conversation_units
    FOR EACH ROW EXECUTE FUNCTION public.guard_conversation_unit_voice_source_v1();

-- Forward-replaced from 0071_effective_live_focus_final_semantic_chain_cutover_v1.sql (substitution "live-producer" in database/voice-foundation-0183-substitutions.mjs).
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
  IF turn_row.status <> 'COMPLETED' THEN
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

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. VA-8 R-1: a Personal item's medium is its unit's. The CHECK admits audio; the guard, part of the same shape law,
--    refuses any Personal item whose medium is not its unit's turn's.
-- ---------------------------------------------------------------------------------------------------------------------
ALTER TABLE public.replay_source_manifest_items DROP CONSTRAINT replay_source_manifest_items_shape_check;
ALTER TABLE public.replay_source_manifest_items ADD CONSTRAINT replay_source_manifest_items_shape_check CHECK (
        (source_class = 'MY_WORLD'
            AND personal_session_id IS NOT NULL AND personal_conversation_unit_id IS NOT NULL
            AND personal_session_position IS NOT NULL AND personal_source_role IS NOT NULL
            AND original_medium IN ('ORIGINAL_TEXT', 'ORIGINAL_AUDIO', 'MIXED')
            AND shared_world_id IS NULL AND shared_material_id IS NULL AND shared_history_item_id IS NULL
            AND shared_material_kind IS NULL AND shared_occurred_at IS NULL
            AND captured_availability_state IS NULL AND captured_availability_revision IS NULL
            AND public_manifest_version_id IS NULL AND public_package_item_id IS NULL
            AND public_item_ordinal IS NULL AND public_derivative_classification IS NULL)
     OR (source_class = 'SHARED_WORLD'
            AND shared_world_id IS NOT NULL AND shared_material_id IS NOT NULL
            AND shared_history_item_id IS NOT NULL AND shared_material_kind IS NOT NULL
            AND shared_occurred_at IS NOT NULL
            AND captured_availability_state IS NOT NULL AND captured_availability_revision IS NOT NULL
            AND personal_session_id IS NULL AND personal_conversation_unit_id IS NULL
            AND personal_session_position IS NULL AND personal_source_role IS NULL
            AND public_manifest_version_id IS NULL AND public_package_item_id IS NULL
            AND public_item_ordinal IS NULL AND public_derivative_classification IS NULL)
     OR (source_class = 'PUBLIC_EXPERIENCE'
            AND public_manifest_version_id IS NOT NULL AND public_package_item_id IS NOT NULL
            AND public_item_ordinal IS NOT NULL AND public_derivative_classification IS NOT NULL
            AND original_medium = 'ORIGINAL_TEXT'
            AND personal_session_id IS NULL AND personal_conversation_unit_id IS NULL
            AND personal_session_position IS NULL AND personal_source_role IS NULL
            AND shared_world_id IS NULL AND shared_material_id IS NULL AND shared_history_item_id IS NULL
            AND shared_material_kind IS NULL AND shared_occurred_at IS NULL
            AND captured_availability_state IS NULL AND captured_availability_revision IS NULL));

CREATE FUNCTION public.guard_replay_personal_item_medium_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_medium text;
BEGIN
  SELECT voice_private.turn_original_medium_v1(cu.source_turn_id) INTO v_medium FROM public.conversation_units cu
   WHERE cu.id = NEW.personal_conversation_unit_id;
  -- An item naming no unit is left to the shape CHECK and the foreign key, which refuse it with their own codes.
  IF FOUND AND NEW.original_medium IS DISTINCT FROM v_medium THEN
    RAISE EXCEPTION 'replay_source_manifest_items_shape_check: a Personal item''s medium is its unit''s'
      USING ERRCODE = '23514',
            DETAIL = 'S8B-02 (0183, R-1): a voice unit is ORIGINAL_AUDIO, a text unit ORIGINAL_TEXT; a transcript is never original text.';
  END IF;
  RETURN NEW;
END$$;
CREATE TRIGGER replay_source_manifest_items_personal_medium_guard BEFORE INSERT ON public.replay_source_manifest_items
    FOR EACH ROW WHEN (NEW.source_class = 'MY_WORLD')
    EXECUTE FUNCTION public.guard_replay_personal_item_medium_v1();

-- Forward-replaced from 0175_s8a_04_shared_social_memory_v1.sql (substitution "replay-capture" in database/voice-foundation-0183-substitutions.mjs).
CREATE OR REPLACE FUNCTION public.replay_capture_source_manifest_v1(p_replay_id uuid, p_source_manifest_version_id uuid, p_manifest_revision integer, p_source_class text, p_source_context_id uuid, p_source_version_id uuid, p_source_item_ids uuid[], p_capture_instant timestamp with time zone)
 RETURNS TABLE(captured_item_count integer, captured_universe_item_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  u uuid := auth.uid();
  requested integer := cardinality(p_source_item_ids);
  locked integer;
  universe integer;
  frontier integer;
  visible uuid[];
  experience public.public_experiences;
  bound_version public.public_experience_versions;
  package public.publication_package_manifest_versions;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_replay_id IS NULL OR p_source_manifest_version_id IS NULL OR p_manifest_revision IS NULL
     OR p_source_class IS NULL OR p_source_context_id IS NULL OR p_capture_instant IS NULL
     OR p_source_item_ids IS NULL OR requested = 0
     OR array_position(p_source_item_ids, NULL) IS NOT NULL
     OR (SELECT count(DISTINCT x) FROM unnest(p_source_item_ids) x) <> requested THEN
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.replays r WHERE r.id = p_replay_id AND r.created_by_user_id = u) THEN
    RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  IF p_source_class = 'MY_WORLD' THEN
    IF p_source_version_id IS NOT NULL THEN
      RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
    END IF;
    PERFORM 1 FROM public.session_semantic_clocks c
      WHERE c.session_id = p_source_context_id AND c.user_id = u FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
    PERFORM 1 FROM public.conversation_units cu
      WHERE cu.session_id = p_source_context_id AND cu.user_id = u AND cu.id = ANY(p_source_item_ids)
      ORDER BY cu.id FOR SHARE;
    GET DIAGNOSTICS locked = ROW_COUNT;
    IF locked <> requested THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
    SELECT count(*)::integer, max(cu.session_position) INTO universe, frontier
      FROM public.conversation_units cu
     WHERE cu.session_id = p_source_context_id AND cu.user_id = u;

    INSERT INTO public.replay_source_manifest_versions
      (id, replay_id, manifest_revision, source_class, creation_authority_basis,
       personal_session_id, personal_owner_user_id, personal_frontier_session_position,
       item_count, authorized_universe_item_count, captured_at)
    VALUES (p_source_manifest_version_id, p_replay_id, p_manifest_revision, 'MY_WORLD', 'PERSONAL_SOURCE_OWNERSHIP',
            p_source_context_id, u, frontier, requested, universe, p_capture_instant);

    INSERT INTO public.replay_source_manifest_items
      (manifest_version_id, source_item_ordinal, source_universe_rank, source_class, original_medium,
       captured_source_digest, personal_session_id, personal_conversation_unit_id,
       personal_session_position, personal_source_role)
    SELECT p_source_manifest_version_id,
           (row_number() OVER (ORDER BY cu.session_position))::integer,
           (SELECT count(*) FROM public.conversation_units x
             WHERE x.session_id = cu.session_id AND x.user_id = cu.user_id
               AND x.session_position <= cu.session_position)::integer,
           -- S8B-02 (0183, R-1): the medium is the unit's turn's; a transcript is never ORIGINAL_TEXT.
           'MY_WORLD', voice_private.turn_original_medium_v1(cu.source_turn_id),
           'sha256:' || encode(sha256(convert_to(cu.committed_text, 'UTF8')), 'hex'),
           cu.session_id, cu.id, cu.session_position, cu.source_role
      FROM public.conversation_units cu
     WHERE cu.session_id = p_source_context_id AND cu.user_id = u AND cu.id = ANY(p_source_item_ids);

  ELSIF p_source_class = 'SHARED_WORLD' THEN
    IF p_source_version_id IS NOT NULL THEN
      RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
    END IF;
    PERFORM 1 FROM public.shared_worlds w WHERE w.id = p_source_context_id FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
    BEGIN
      SELECT array_agg(v.history_item_id ORDER BY v.occurred_at, v.history_item_id) INTO visible
        FROM public.resolve_shared_world_history_visibility_v1(p_source_context_id, u) v;
    EXCEPTION WHEN SQLSTATE 'P0002' OR SQLSTATE '0A000' THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
    END;
    -- S6-02 (GATE-35 / D5): Introduction-era material of a Matching-born World is never a Replay source. It leaves the
    -- visible set, so a selected one is refused exactly like an item the creator cannot see, and it is not counted.
    visible := shared_private.without_introduction_era_history_v1(p_source_context_id, visible);
    IF visible IS NULL THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
    PERFORM 1 FROM public.shared_world_materials m
      WHERE m.world_id = p_source_context_id AND m.id = ANY(p_source_item_ids) ORDER BY m.id FOR SHARE;
    GET DIAGNOSTICS locked = ROW_COUNT;
    IF locked <> requested THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
    PERFORM 1 FROM public.shared_world_history_items i
      WHERE i.id IN (SELECT m.history_item_id FROM public.shared_world_materials m
                      WHERE m.world_id = p_source_context_id AND m.id = ANY(p_source_item_ids))
      ORDER BY i.id FOR SHARE;
    IF EXISTS (
      SELECT 1 FROM public.shared_world_materials m
       WHERE m.world_id = p_source_context_id AND m.id = ANY(p_source_item_ids)
         AND NOT (m.history_item_id = ANY(visible))
    ) THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.shared_world_materials m
       WHERE m.world_id = p_source_context_id AND m.id = ANY(p_source_item_ids)
         AND m.material_kind NOT IN ('HUMAN_TEXT', 'HUMAN_VOICE_NOTE', 'QANDEEL_OUTPUT')
    ) THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_KIND_RESERVED' USING ERRCODE='0A000';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.shared_world_materials m
        JOIN public.shared_world_history_items i ON i.id = m.history_item_id
       WHERE m.world_id = p_source_context_id AND m.id = ANY(p_source_item_ids)
         AND (i.availability_state <> 'AVAILABLE'
              OR NOT EXISTS (SELECT 1 FROM public.shared_world_text_material_bodies t WHERE t.material_id = m.id)
                 AND NOT EXISTS (SELECT 1 FROM public.shared_world_voice_note_material_bodies vn WHERE vn.material_id = m.id))
    ) THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
    visible := ARRAY(SELECT v.item FROM unnest(visible) WITH ORDINALITY AS v(item, rank)
                      WHERE NOT EXISTS (SELECT 1 FROM public.shared_world_materials m
                                         WHERE m.world_id = p_source_context_id AND m.history_item_id = v.item
                                           AND m.material_kind = 'QANDEEL_ANALYSIS')
                      ORDER BY v.rank);
    universe := cardinality(visible);

    INSERT INTO public.replay_source_manifest_versions
      (id, replay_id, manifest_revision, source_class, creation_authority_basis, shared_world_id,
       item_count, authorized_universe_item_count, captured_at)
    VALUES (p_source_manifest_version_id, p_replay_id, p_manifest_revision, 'SHARED_WORLD', 'SHARED_HISTORY_VISIBILITY',
            p_source_context_id, requested, universe, p_capture_instant);

    INSERT INTO public.replay_source_manifest_items
      (manifest_version_id, source_item_ordinal, source_universe_rank, source_class, original_medium,
       captured_source_digest, shared_world_id, shared_material_id, shared_history_item_id,
       shared_material_kind, shared_occurred_at, captured_availability_state, captured_availability_revision)
    SELECT p_source_manifest_version_id,
           (row_number() OVER (ORDER BY i.occurred_at, i.id))::integer,
           array_position(visible, i.id),
           'SHARED_WORLD',
           CASE WHEN m.material_kind = 'HUMAN_VOICE_NOTE' THEN 'ORIGINAL_AUDIO' ELSE 'ORIGINAL_TEXT' END,
           'sha256:' || encode(sha256(convert_to(
             CASE WHEN m.material_kind = 'HUMAN_VOICE_NOTE'
                  THEN vn.audio_object_ref || E'\n' || coalesce(vn.transcript_text, '')
                  ELSE t.body_text END, 'UTF8')), 'hex'),
           m.world_id, m.id, i.id, m.material_kind, i.occurred_at, i.availability_state, i.availability_revision
      FROM public.shared_world_materials m
      JOIN public.shared_world_history_items i ON i.id = m.history_item_id
      LEFT JOIN public.shared_world_text_material_bodies t ON t.material_id = m.id
      LEFT JOIN public.shared_world_voice_note_material_bodies vn ON vn.material_id = m.id
     WHERE m.world_id = p_source_context_id AND m.id = ANY(p_source_item_ids);

  ELSIF p_source_class = 'PUBLIC_EXPERIENCE' THEN
    IF p_source_version_id IS NULL THEN
      RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
    END IF;
    PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR SHARE;
    SELECT * INTO experience FROM public.public_experiences e WHERE e.id = p_source_context_id FOR SHARE;
    IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.public_experience_controllers c
                                  WHERE c.experience_id = p_source_context_id AND c.controller_user_id = u) THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
    IF experience.current_experience_version_id IS DISTINCT FROM p_source_version_id
       OR experience.current_lifecycle NOT IN ('DRAFT', 'READY_FOR_REVIEW', 'PUBLISHED') THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_STALE' USING ERRCODE='40001';
    END IF;
    SELECT * INTO bound_version FROM public.public_experience_versions v
     WHERE v.id = p_source_version_id AND v.experience_id = p_source_context_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;
    SELECT * INTO package FROM public.publication_package_manifest_versions pm
     WHERE pm.id = bound_version.package_manifest_version_id AND pm.experience_id = p_source_context_id FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;
    SELECT count(*)::integer INTO locked FROM public.publication_package_manifest_items it
     WHERE it.manifest_version_id = package.id AND it.package_item_id = ANY(p_source_item_ids);
    IF locked <> requested THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.publication_package_manifest_items it
       WHERE it.manifest_version_id = package.id AND it.package_item_id = ANY(p_source_item_ids)
         AND it.public_body_form <> 'PUBLIC_TEXT'
    ) THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_KIND_RESERVED' USING ERRCODE='0A000';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.publication_package_manifest_items it
       WHERE it.manifest_version_id = package.id AND it.package_item_id = ANY(p_source_item_ids)
         AND NOT EXISTS (SELECT 1 FROM public.public_experience_text_derivative_bodies b
                          WHERE b.package_item_id = it.package_item_id)
    ) THEN
      RAISE EXCEPTION 'REPLAY_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
    universe := package.item_count;

    INSERT INTO public.replay_source_manifest_versions
      (id, replay_id, manifest_revision, source_class, creation_authority_basis,
       public_experience_id, public_experience_version_id, public_manifest_version_id,
       item_count, authorized_universe_item_count, captured_at)
    VALUES (p_source_manifest_version_id, p_replay_id, p_manifest_revision, 'PUBLIC_EXPERIENCE', 'PUBLIC_EXPERIENCE_CONTROL',
            p_source_context_id, bound_version.id, package.id, requested, universe, p_capture_instant);

    INSERT INTO public.replay_source_manifest_items
      (manifest_version_id, source_item_ordinal, source_universe_rank, source_class, original_medium,
       captured_source_digest, public_manifest_version_id, public_package_item_id, public_item_ordinal,
       public_derivative_classification)
    SELECT p_source_manifest_version_id,
           (row_number() OVER (ORDER BY it.item_ordinal))::integer,
           it.item_ordinal, 'PUBLIC_EXPERIENCE', 'ORIGINAL_TEXT', it.public_body_digest,
           package.id, it.package_item_id, it.item_ordinal, it.derivative_classification
      FROM public.publication_package_manifest_items it
     WHERE it.manifest_version_id = package.id AND it.package_item_id = ANY(p_source_item_ids);

  ELSE
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  RETURN QUERY SELECT requested, universe;
END$function$;

-- Forward-replaced from 0169_replay_personal_secure_integration_erasure_v1.sql (substitution "replay-moments" in database/voice-foundation-0183-substitutions.mjs).
CREATE OR REPLACE FUNCTION replay_private.read_my_replay_moments_v1(p_replay_id uuid, p_replay_version_id uuid)
RETURNS TABLE (selected_ordinal integer, tc integer, source_role text, original_medium text,
               omitted_before integer, source_text text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_view record;
  v_version public.replay_versions;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_replay_id IS NULL OR p_replay_version_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT w.* INTO v_view FROM replay_private.version_viewing_state_v1(p_replay_id, p_replay_version_id) w;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT v.* INTO v_version FROM public.replay_versions v WHERE v.id = p_replay_version_id;
  RETURN QUERY
    SELECT si.selected_ordinal, mi.personal_session_position, mi.personal_source_role, mi.original_medium,
           coalesce((SELECT d.omitted_source_item_count FROM public.replay_temporal_discontinuities d
                      WHERE d.selection_spec_version_id = si.selection_spec_version_id
                        AND d.right_selected_ordinal = si.selected_ordinal), 0),
           CASE WHEN v_view.viewing_state = 'VIEWABLE' AND si.anchor_kind = 'WHOLE_ITEM'
                     -- S8B-02 (0183, R-1): a transcript is a derived transcript, never the source text.
                     AND mi.original_medium = 'ORIGINAL_TEXT'
                THEN (SELECT cu.committed_text FROM public.conversation_units cu
                       WHERE cu.id = mi.personal_conversation_unit_id) END
      FROM public.replay_selection_spec_items si
      JOIN public.replay_source_manifest_items mi
        ON mi.manifest_version_id = si.source_manifest_version_id AND mi.source_item_ordinal = si.source_item_ordinal
     WHERE si.selection_spec_version_id = v_version.selection_spec_version_id
       AND mi.source_class = 'MY_WORLD'
     ORDER BY si.selected_ordinal;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 9. D-7 READERS: Memory, the S8A-05 direct text path and the export.
-- ---------------------------------------------------------------------------------------------------------------------
ALTER TABLE public.memories DROP CONSTRAINT memories_source_check;
ALTER TABLE public.memories ADD CONSTRAINT memories_source_check
    CHECK (source IN ('USER_STATED', 'USER_CONFIRMED', 'SYSTEM_DERIVED', 'IMPORTED', 'ADMIN_CONTROLLED', 'MACHINE_ASR'));

-- Forward-replaced from 0026_memory_authority_hardening_v1.sql (substitution "memory-shape" in database/voice-foundation-0183-substitutions.mjs).
CREATE OR REPLACE FUNCTION public.assert_canonical_memory_shape_v1(
  p_type text, p_content text, p_source text, p_confidence double precision,
  p_importance double precision, p_status text, p_expires_at timestamptz
) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF p_type IS NULL OR p_type NOT IN (
    'STABLE_PREFERENCE','PERSONAL_FACT','GOAL','DECISION_COMMITMENT',
    'RELATIONSHIP_CONTEXT','INTERACTION_PREFERENCE','TEMPORARY_STATE','DERIVED_INSIGHT'
  ) THEN RAISE EXCEPTION 'INVALID_MEMORY_TYPE' USING ERRCODE='22023'; END IF;
  IF p_source IS NULL OR p_source NOT IN (
    'USER_STATED','USER_CONFIRMED','SYSTEM_DERIVED','IMPORTED','ADMIN_CONTROLLED','MACHINE_ASR'
  ) THEN RAISE EXCEPTION 'INVALID_MEMORY_SOURCE' USING ERRCODE='22023'; END IF;
  IF p_status IS NULL OR p_status NOT IN (
    'ACTIVE','SUPERSEDED','EXPIRED','DELETED','DISABLED','PENDING_CONFIRMATION'
  ) THEN RAISE EXCEPTION 'INVALID_MEMORY_STATUS' USING ERRCODE='22023'; END IF;
  IF p_source='SYSTEM_DERIVED' AND p_status='ACTIVE' THEN
    RAISE EXCEPTION 'INVALID_MEMORY_STATUS' USING ERRCODE='22023'; END IF;
  IF p_content IS NULL OR length(btrim(p_content))=0 THEN
    RAISE EXCEPTION 'INVALID_MEMORY_CONTENT' USING ERRCODE='22023'; END IF;
  -- BETWEEN also rejects NaN and infinity, which PostgreSQL orders above every
  -- finite value rather than treating as incomparable.
  IF p_confidence IS NULL OR p_importance IS NULL
     OR NOT (p_confidence BETWEEN 0 AND 1) OR NOT (p_importance BETWEEN 0 AND 1) THEN
    RAISE EXCEPTION 'INVALID_MEMORY_SCORE' USING ERRCODE='22023'; END IF;
  IF p_expires_at IS NOT NULL AND p_expires_at <= CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'INVALID_MEMORY_EXPIRATION' USING ERRCODE='22023'; END IF;
END;$$;

-- Forward-replaced from 0152_memory_subject_identity_atomicity_v1.sql (substitution "background-memory-writer" in database/voice-foundation-0183-substitutions.mjs).
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
    IF p_confidence IS NULL OR NOT (p_confidence < 0.95) THEN
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

-- Forward-replaced from 0175_s8a_04_shared_social_memory_v1.sql (substitution "public-authoring-picker" in database/voice-foundation-0183-substitutions.mjs).
CREATE OR REPLACE FUNCTION public_authoring_private.list_own_public_authoring_sources_v1()
 RETURNS TABLE(source_kind text, source_id uuid, world_id uuid, material_kind text, established_at timestamp with time zone, is_self boolean, author_name text, text_body text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_world uuid;
BEGIN
  RETURN QUERY
    SELECT 'PERSONAL'::text, cu.id, NULL::uuid, NULL::text, cu.created_at, true, NULL::text, cu.committed_text
      FROM public.conversation_units cu
     WHERE cu.user_id = v_user AND cu.source_role = 'USER'
       -- S8B-02 (0183, D-7): a voice-sourced unit is not a direct text source of the Public World.
       AND NOT EXISTS (SELECT 1 FROM public.conversation_turn_voice_sources vs WHERE vs.turn_id = cu.source_turn_id)
     ORDER BY cu.created_at DESC, cu.id DESC
     LIMIT 50;
  FOR v_world IN
    SELECT e.world_id FROM public.shared_world_membership_episodes e
      JOIN public.shared_worlds w ON w.id = e.world_id
     WHERE e.user_id = v_user AND e.ended_at IS NULL AND w.lifecycle = 'ACTIVE'
     ORDER BY w.born_at, w.id
  LOOP
    RETURN QUERY
      SELECT 'SHARED'::text, m.material_id, m.world_id, m.material_kind, m.established_at,
             coalesce(m.author_user_id = v_user, false),
             CASE WHEN m.author_user_id IS NULL THEN NULL ELSE shared_private.shared_person_name_v1(v_world, m.author_user_id, v_user) END,
             m.text_body
        FROM public.resolve_shared_world_material_v1(v_world, v_user) m
        JOIN public.shared_world_history_items i ON i.id = m.history_item_id AND i.availability_state = 'AVAILABLE'
        JOIN public.shared_world_material_historical_authority ha
          ON ha.material_id = m.material_id
         AND ha.resolution_state IN ('RESOLVED_EXACT_HUMAN_REQUIREMENT', 'RESOLVED_NO_HUMAN_REQUIREMENT')
        LEFT JOIN public.users u ON u.id = m.author_user_id
       WHERE m.text_body IS NOT NULL AND m.material_kind IN ('HUMAN_TEXT', 'QANDEEL_OUTPUT')
         AND NOT shared_private.is_introduction_era_history_item_v1(v_world, m.history_item_id)
       ORDER BY m.established_at DESC, m.material_id DESC
       LIMIT 50;
  END LOOP;
END$function$;

-- Forward-replaced from 0175_s8a_04_shared_social_memory_v1.sql (substitution "public-authoring-package" in database/voice-foundation-0183-substitutions.mjs).
CREATE OR REPLACE FUNCTION public_authoring_private.prepare_own_public_experience_package_v1(p_command_id uuid, p_experience_id uuid, p_personal_unit_ids uuid[], p_shared_world_ids uuid[], p_shared_material_ids uuid[])
 RETURNS TABLE(outcome text, item_count integer, required_approver_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := public_authoring_private.require_authoring_actor_v1();
  v_personal integer := coalesce(array_length(p_personal_unit_ids, 1), 0);
  v_shared integer := coalesce(array_length(p_shared_material_ids, 1), 0);
  v_personal_items uuid[];
  v_shared_items uuid[];
  v_class text;
  r record;
BEGIN
  IF p_command_id IS NULL OR p_experience_id IS NULL OR p_personal_unit_ids IS NULL OR p_shared_world_ids IS NULL
     OR p_shared_material_ids IS NULL OR v_shared <> coalesce(array_length(p_shared_world_ids, 1), 0)
     OR v_personal + v_shared < 1 OR v_personal + v_shared > 20 THEN
    RAISE EXCEPTION 'PUBLIC_AUTHORING_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(array_agg(public_authoring_private.derive_authoring_identity_v1('ITEM', v_user, p_command_id, g) ORDER BY g), ARRAY[]::uuid[])
    INTO v_personal_items FROM generate_series(1, v_personal) g;
  SELECT coalesce(array_agg(public_authoring_private.derive_authoring_identity_v1('ITEM', v_user, p_command_id, v_personal + g) ORDER BY g), ARRAY[]::uuid[])
    INTO v_shared_items FROM generate_series(1, v_shared) g;
  BEGIN
    -- S6-02 (D5): Introduction-era Shared material of a Matching-born World is never packaged for the Public World.
    -- The refusal is the class a source this human cannot see gets, so it reveals nothing about the source.
    -- S8A-04 CP2 (0175, §6): a Shared semantic place (QANDEEL_ANALYSIS) is never a Public authoring source. A package that
    -- names one by id is refused with the class a source this human cannot see gets, so it reveals nothing about it.
    IF EXISTS (SELECT 1 FROM unnest(p_shared_world_ids, p_shared_material_ids) AS t(world_id, material_id)
                 JOIN public.shared_world_materials sm ON sm.id = t.material_id AND sm.world_id = t.world_id
                WHERE sm.material_kind = 'QANDEEL_ANALYSIS') THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE = 'P0002';
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(p_shared_world_ids, p_shared_material_ids) AS t(world_id, material_id)
                 JOIN public.shared_world_materials sm ON sm.id = t.material_id AND sm.world_id = t.world_id
                WHERE shared_private.is_introduction_era_history_item_v1(sm.world_id, sm.history_item_id)) THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE = 'P0002';
    END IF;
    -- S8B-02 (0183, D-7): a voice-sourced Personal unit is not a direct text source of the Public World. It is refused
    -- with the class a source this human cannot see gets.
    IF EXISTS (SELECT 1 FROM public.conversation_units cu
                 JOIN public.conversation_turn_voice_sources vs ON vs.turn_id = cu.source_turn_id
                WHERE cu.id = ANY (p_personal_unit_ids)) THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE = 'P0002';
    END IF;
    SELECT d.outcome, d.item_count, d.required_approver_count INTO r
      FROM public.prepare_public_experience_manifest_v1(
             p_command_id, p_experience_id,
             public_authoring_private.derive_authoring_identity_v1('MANIFEST', v_user, p_command_id, 0),
             public_authoring_private.derive_authoring_identity_v1('VERSION', v_user, p_command_id, 0),
             v_personal_items, p_personal_unit_ids, v_shared_items, p_shared_world_ids, p_shared_material_ids) d;
  EXCEPTION WHEN OTHERS THEN
    v_class := public_authoring_private.classify_public_refusal_v1(SQLERRM);
    IF v_class IS NULL THEN RAISE; END IF;
    RETURN QUERY SELECT v_class, NULL::integer, NULL::integer;
    RETURN;
  END;
  RETURN QUERY SELECT CASE WHEN r.outcome = 'PACKAGE_PREPARED' THEN 'PREPARED' ELSE 'ALREADY_PREPARED' END,
                      r.item_count, r.required_approver_count;
END$function$;

-- Forward-replaced from 0180_s8a_05_publish_from_qandeel_v1.sql (substitution "public-compose-outcome" in database/voice-foundation-0183-substitutions.mjs).
CREATE OR REPLACE FUNCTION public_compose_source_private.draft_source_outcome_v1(p_user uuid, p_draft public_compose_private.topic_drafts)
RETURNS TABLE (outcome text, item_count integer, text_bytes bigint, qandeel_material boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_range record;
  v_state text;
BEGIN
  IF p_draft.source_kind = 'CONVERSATION' THEN
    SELECT * INTO v_range FROM replay_private.resolve_personal_range_v1(p_draft.source_session_id, p_draft.source_first_sp,
                                                                        p_draft.source_last_sp);
    IF v_range.outcome = 'NOT_WHOLE_MESSAGES' THEN
      RETURN QUERY SELECT 'NOT_WHOLE_MESSAGES'::text, NULL::integer, NULL::bigint, NULL::boolean;
      RETURN;
    END IF;
    IF v_range.outcome IS DISTINCT FROM 'RESOLVED' THEN
      RETURN QUERY SELECT 'SOURCE_UNAVAILABLE'::text, NULL::integer, NULL::bigint, NULL::boolean;
      RETURN;
    END IF;
    -- S8B-02 (0183, D-7): a range holding a voice-sourced unit is not a direct text source of the Public World. It
    -- answers the one SOURCE_UNAVAILABLE, indistinguishable from any other unavailable source.
    IF EXISTS (SELECT 1 FROM public.conversation_units cu
                 JOIN public.conversation_turn_voice_sources vs ON vs.turn_id = cu.source_turn_id
                WHERE cu.session_id = p_draft.source_session_id AND cu.user_id = p_user
                  AND cu.session_position BETWEEN p_draft.source_first_sp AND p_draft.source_last_sp) THEN
      RETURN QUERY SELECT 'SOURCE_UNAVAILABLE'::text, NULL::integer, NULL::bigint, NULL::boolean;
      RETURN;
    END IF;
    -- Every named message is a WHOLE message of the range, named by its first position.
    IF EXISTS (
      SELECT 1 FROM unnest(p_draft.source_excluded_sps || p_draft.source_emphasized_sps) AS x(sp)
       WHERE x.sp NOT BETWEEN p_draft.source_first_sp AND p_draft.source_last_sp
          OR NOT EXISTS (
            SELECT 1 FROM public.conversation_units cu
             WHERE cu.session_id = p_draft.source_session_id AND cu.user_id = p_user AND cu.session_position = x.sp
               AND NOT EXISTS (SELECT 1 FROM public.conversation_units o
                                WHERE o.source_turn_id = cu.source_turn_id AND o.session_position < cu.session_position)))
    THEN
      RETURN QUERY SELECT 'SELECTION_INVALID'::text, NULL::integer, NULL::bigint, NULL::boolean;
      RETURN;
    END IF;
  ELSIF p_draft.source_kind = 'UNDERSTANDING' THEN
    v_state := public_compose_source_private.understanding_state_v1(p_user, p_draft.source_hypothesis_id,
                                                                    p_draft.source_hypothesis_version);
    IF v_state <> 'SHOWN' THEN
      RETURN QUERY SELECT v_state, NULL::integer, NULL::bigint, NULL::boolean;
      RETURN;
    END IF;
  ELSE
    RAISE EXCEPTION 'PUBLIC_COMPOSE_CONTRADICTORY_STATE' USING ERRCODE = 'P0001';
  END IF;
  RETURN QUERY
    SELECT CASE WHEN count(*) FILTER (WHERE i.item_role <> 'WRITTEN') = 0 THEN 'NOTHING_SELECTED'
                WHEN count(*) > public_compose_source_private.envelope_units_v1()
                  OR coalesce(sum(octet_length(i.body)), 0) > public_compose_source_private.envelope_bytes_v1() THEN 'TOO_LARGE'
                ELSE 'RESOLVED' END,
           count(*)::integer, coalesce(sum(octet_length(i.body)), 0)::bigint,
           coalesce(bool_or(i.item_role IN ('QANDEEL_REPLY', 'QANDEEL_UNDERSTANDING')), false)
      FROM public_compose_source_private.draft_source_items_v1(p_user, p_draft) i;
END$$;

-- Forward-replaced from 0180_s8a_05_publish_from_qandeel_v1.sql (substitution "personal-export" in database/voice-foundation-0183-substitutions.mjs).
CREATE OR REPLACE FUNCTION personal_data_private.build_personal_export_v1(p_subject uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'format', 'qandeel.personal-data-export.v1',
        'preparedAt', clock_timestamp(),
        'account', (
            SELECT jsonb_build_object(
                'name', u.name,
                'loginId', u.login_id,
                'publicId', u.public_id,
                'accountCreatedAt', u.created_at)
              FROM public.users u WHERE u.id = p_subject),
        'conversations', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'startedAt', s.created_at,
                       'lastActivityAt', s.last_activity_at,
                       'turns', coalesce((
                           SELECT jsonb_agg(jsonb_build_object(
                                      'speaker', CASE t.role WHEN 'USER' THEN 'you' ELSE 'qandeel' END,
                                      'text', t.content,
                                      'at', t.created_at,
                                      'state', lower(t.status))
                                  -- S8B-02 (0183, D-7): a voice turn says what it is: a machine transcript, its source
                                  -- and its band. A text turn gains nothing.
                                  || coalesce((SELECT jsonb_strip_nulls(jsonb_build_object(
                                                 'modality', CASE vs.source_modality WHEN 'VOICE_NOTE' THEN 'voice note'
                                                                                     ELSE 'live call' END,
                                                 'transcriptOrigin', vs.transcript_origin,
                                                 'confidenceBand', lower(vs.asr_confidence_band)))
                                         FROM public.conversation_turn_voice_sources vs WHERE vs.turn_id = t.id), '{}'::jsonb)
                                  ORDER BY t.created_at, t.id)
                             FROM public.conversation_turns t
                            WHERE t.session_id = s.id AND t.user_id = p_subject
                              AND (t.role = 'USER' OR (t.role = 'ASSISTANT' AND t.status = 'COMPLETED'))), '[]'::jsonb))
                   ORDER BY s.created_at, s.id)
              FROM public.conversation_sessions s WHERE s.user_id = p_subject), '[]'::jsonb),
        'memory', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'text', m.content,
                       'kind', lower(m.type),
                       'state', CASE m.status WHEN 'ACTIVE' THEN 'active'
                                              WHEN 'DISABLED' THEN 'not relied on'
                                              WHEN 'DELETED' THEN 'forgotten'
                                              WHEN 'SUPERSEDED' THEN 'replaced by a correction'
                                              ELSE lower(m.status) END,
                       'rememberedAt', m.created_at,
                       'lastChangedAt', m.updated_at,
                       'expiresAt', m.expires_at)
                   ORDER BY m.created_at, m.id)
              FROM public.memories m WHERE m.user_id = p_subject), '[]'::jsonb),
        'understanding', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'statement', h.statement,
                       'status', CASE WHEN h.status IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK') THEN 'current'
                                      WHEN h.status = 'REOPENED' THEN 'being reconsidered'
                                      ELSE 'withdrawn' END,
                       'firstFormedAt', h.created_at,
                       'lastChangedAt', h.updated_at,
                       'yourDisagreements', coalesce((
                           SELECT jsonb_agg(c.created_at ORDER BY c.created_at)
                             FROM public.understanding_contests c
                            WHERE c.hypothesis_id = h.id AND c.user_id = p_subject), '[]'::jsonb))
                   ORDER BY h.created_at, h.id)
              FROM public.hypotheses h
             WHERE h.user_id = p_subject
               -- Only an interpretation the owner could have been shown: current now (the statuses the Understanding
               -- surface lists), or current at some point before it was reconsidered or withdrawn. A CANDIDATE, or one
               -- withdrawn before it was ever admitted, is QANDEEL's own unshown reasoning (hypothesis restraint).
               AND (h.status IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK')
                    OR (h.status IN ('REOPENED', 'REJECTED', 'RETIRED')
                        AND EXISTS (SELECT 1 FROM public.hypothesis_lifecycle_transitions t
                                     WHERE t.hypothesis_id = h.id AND t.user_id = p_subject
                                       AND t.after_status IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK'))))), '[]'::jsonb),
        -- IP-IMP-01 (0153): the owner's four durable interaction preferences, in readable words. No row: all automatic.
        'interactionPreferences', (
            SELECT jsonb_build_object(
                       'replyLength', CASE coalesce(p.reply_length, 'DEFAULT') WHEN 'ALWAYS_BRIEF' THEN 'always brief' ELSE 'automatic' END,
                       'replyLanguage', CASE coalesce(p.reply_language, 'DEFAULT')
                                            WHEN 'EGYPTIAN_ARABIC' THEN 'Egyptian Arabic'
                                            WHEN 'MODERN_STANDARD_ARABIC' THEN 'Modern Standard Arabic'
                                            WHEN 'LEVANTINE_ARABIC' THEN 'Levantine Arabic'
                                            WHEN 'GULF_ARABIC' THEN 'Gulf Arabic'
                                            WHEN 'MAGHREBI_ARABIC' THEN 'Maghrebi Arabic'
                                            WHEN 'ENGLISH' THEN 'English'
                                            ELSE 'automatic' END,
                       'humour', CASE coalesce(p.humour, 'DEFAULT') WHEN 'WELCOME' THEN 'welcome' WHEN 'DECLINED' THEN 'no humour' ELSE 'automatic' END,
                       'explanationStyle', CASE coalesce(p.explanation_style, 'DEFAULT')
                                               WHEN 'SIMPLER' THEN 'simpler'
                                               WHEN 'DIRECT' THEN 'direct'
                                               WHEN 'SIMPLER_AND_DIRECT' THEN 'simple and direct'
                                               ELSE 'automatic' END,
                       'lastChangedAt', p.updated_at)
              FROM (SELECT 1) AS one LEFT JOIN public.interaction_preferences p ON p.user_id = p_subject),
        -- S6-07 (0168): the reader's OWN Matching and Introductions data, in readable words (QAN-BL-PRIV-04, CA-EXP).
        -- Every sub-select is keyed on p_subject as owner, author, actor or bound recipient. Nothing names, quotes or
        -- describes another human; no internal identifier, digest, score, reason, role or proposal state is printed; a
        -- proposal appears only once it was delivered to the reader, and never with the instant it arrived (Q9).
        'matchingAndIntroductions', jsonb_build_object(
            'preparation', jsonb_build_object(
                'draft', (
                    SELECT jsonb_build_object(
                               'shortIntroduction', d.short_introduction,
                               'workField', lower(replace(d.work_field, '_', ' ')),
                               'requirements', jsonb_build_object('answer', lower(replace(d.hard_answer, '_', ' ')), 'items', d.hard_items),
                               'preferences', jsonb_build_object('answer', lower(replace(d.soft_answer, '_', ' ')), 'items', d.soft_items),
                               'skippedSteps', (SELECT coalesce(jsonb_agg(lower(replace(s.step, '_', ' ')) ORDER BY s.step), '[]'::jsonb)
                                                  FROM unnest(d.skipped_steps) AS s(step)),
                               'reviewedAt', d.reviewed_at,
                               'startedAt', d.created_at,
                               'lastChangedAt', d.updated_at)
                      FROM introductions_preparation_private.drafts d WHERE d.user_id = p_subject),
                'declaredFacts', (
                    SELECT jsonb_build_object(
                               'firstName', CASE WHEN f.first_name IS NULL THEN NULL ELSE jsonb_build_object(
                                   'value', f.first_name, 'state', lower(f.first_name_state), 'confirmedAt', f.first_name_confirmed_at) END,
                               'sex', CASE WHEN f.sex IS NULL THEN NULL ELSE jsonb_build_object(
                                   'value', lower(f.sex), 'state', lower(f.sex_state), 'confirmedAt', f.sex_confirmed_at) END,
                               'birth', CASE WHEN f.birth_year IS NULL THEN NULL ELSE jsonb_build_object(
                                   'year', f.birth_year, 'month', f.birth_month, 'state', lower(f.birth_state), 'confirmedAt', f.birth_confirmed_at) END,
                               'area', CASE WHEN f.country_code IS NULL THEN NULL ELSE jsonb_build_object(
                                   'country', f.country_code, 'region', f.region_code, 'state', lower(f.area_state), 'confirmedAt', f.area_confirmed_at) END,
                               'maritalStatus', CASE WHEN f.marital_status IS NULL THEN NULL ELSE jsonb_build_object(
                                   'value', lower(replace(f.marital_status, '_', ' ')), 'state', lower(f.marital_state), 'confirmedAt', f.marital_confirmed_at) END)
                      FROM introductions_preparation_private.declared_facts f WHERE f.user_id = p_subject),
                'notes', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'kind', lower(replace(n.kind, '_', ' ')),
                               'origin', CASE n.origin WHEN 'USER_AUTHORED' THEN 'written by you'
                                                       WHEN 'CONFIRMED_FROM_PRIOR_UNDERSTANDING' THEN 'confirmed by you'
                                                       ELSE 'corrected by you' END,
                               'text', n.body,
                               'writtenAt', n.created_at)
                           ORDER BY n.created_at, n.id)
                      FROM introductions_preparation_private.notes n WHERE n.user_id = p_subject), '[]'::jsonb),
                'earlierUnderstandingDecisions', coalesce((
                    SELECT jsonb_agg(jsonb_build_object('decision', lower(replace(p.decision, '_', ' ')), 'decidedAt', p.decided_at)
                           ORDER BY p.decided_at, p.memory_id)
                      FROM introductions_preparation_private.prior_understanding_decisions p WHERE p.user_id = p_subject), '[]'::jsonb),
                'assistanceConsents', coalesce((
                    SELECT jsonb_agg(jsonb_build_object('version', c.consent_version, 'givenAt', c.granted_at, 'withdrawnAt', c.revoked_at)
                           ORDER BY c.granted_at, c.id)
                      FROM introductions_preparation_private.assistance_consents c WHERE c.user_id = p_subject), '[]'::jsonb)),
            'enrollment', jsonb_build_object(
                'acts', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'act', CASE a.act_kind WHEN 'ENROLL' THEN 'enrolled' WHEN 'CORRECTION' THEN 'corrected'
                                                      WHEN 'RESUME' THEN 'resumed' ELSE 'consent given again' END,
                               'at', a.committed_at,
                               'reviewedDraftVersion', a.draft_version,
                               'consentVersions', jsonb_build_object(
                                   'participation', a.participation_consent_version,
                                   'contextGrant', a.context_consent_version,
                                   'disclosureAuthority', a.disclosure_consent_version))
                           ORDER BY a.committed_at, a.command_id)
                      FROM matching_enrollment_private.enrollment_acts a WHERE a.user_id = p_subject), '[]'::jsonb),
                'participation', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'act', lower(replace(e.participation_act, '_', ' ')),
                               'state', lower(e.resulting_state),
                               'pauseReason', lower(replace(e.resulting_pause_reason, '_', ' ')),
                               'entry', lower(replace(e.activation_entry_channel, '_', ' ')),
                               'at', e.occurred_at)
                           ORDER BY e.occurred_at, e.id)
                      FROM public.matching_participation_events e WHERE e.participant_user_id = p_subject), '[]'::jsonb),
                'contextGrant', coalesce((
                    SELECT jsonb_agg(jsonb_build_object('event', lower(e.event_type), 'at', e.occurred_at) ORDER BY e.occurred_at, e.id)
                      FROM public.matching_context_consent_events e WHERE e.grantor_user_id = p_subject), '[]'::jsonb),
                'disclosureAuthority', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'event', lower(e.event_type),
                               'at', e.occurred_at,
                               'approvedFields', CASE WHEN e.event_type = 'REVOKED' THEN NULL ELSE coalesce((
                                   SELECT jsonb_agg(lower(replace(af.field_key, '_', ' ')) ORDER BY af.field_key)
                                     FROM public.pre_match_disclosure_authority_fields af
                                    WHERE af.authority_id = e.subject_authority_id), '[]'::jsonb) END)
                           ORDER BY e.occurred_at, e.id)
                      FROM public.pre_match_disclosure_authority_events e WHERE e.grantor_user_id = p_subject), '[]'::jsonb),
                'introductionProfileVersions', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'createdAt', v.created_at,
                               'fields', coalesce((
                                   SELECT jsonb_agg(jsonb_build_object('field', lower(replace(fv.field_key, '_', ' ')), 'value', fv.field_value)
                                          ORDER BY fv.field_key)
                                     FROM public.introduction_profile_field_values fv WHERE fv.profile_version_id = v.id), '[]'::jsonb))
                           ORDER BY v.created_at, v.id)
                      FROM public.introduction_profile_versions v WHERE v.owner_user_id = p_subject), '[]'::jsonb),
                'requirementVersions', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                               'createdAt', v.created_at,
                               'items', coalesce((
                                   SELECT jsonb_agg(jsonb_build_object(
                                              'requirement', lower(replace(i.requirement_key, '_', ' ')),
                                              'strength', CASE i.requirement_strength WHEN 'HARD_DEALBREAKER' THEN 'required' ELSE 'preferred' END,
                                              'value', i.requirement_value)
                                          ORDER BY i.requirement_strength, i.requirement_key)
                                     FROM public.matching_requirement_items i WHERE i.requirement_version_id = v.id), '[]'::jsonb))
                           ORDER BY v.created_at, v.id)
                      FROM public.matching_requirement_versions v WHERE v.owner_user_id = p_subject), '[]'::jsonb)),
            'confirmedFacts', coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                           'firstName', f.first_name,
                           'sex', lower(f.sex),
                           'birthYear', f.birth_year,
                           'birthMonth', f.birth_month,
                           'country', f.country_code,
                           'region', f.region_code,
                           'maritalStatus', lower(replace(f.marital_status, '_', ' ')),
                           'confirmedAt', jsonb_build_object(
                               'firstName', f.first_name_confirmed_at, 'sex', f.sex_confirmed_at, 'birth', f.birth_confirmed_at,
                               'area', f.area_confirmed_at, 'maritalStatus', f.marital_confirmed_at),
                           'recordedAt', f.recorded_at)
                       ORDER BY f.recorded_at, f.id)
                  FROM public.matching_confirmed_fact_versions f WHERE f.owner_user_id = p_subject), '[]'::jsonb),
            -- A proposal only once it was DELIVERED to the reader (CW2-06 §53): the one neutral word their own proposal
            -- screen shows (resolve_my_matching_proposal_presentation_v1's mapping, a live one past its deadline or no
            -- longer valid included) and the reader's own decisions. Never the other human, a conclusion, a role, a
            -- state, a reason, a deadline or when it arrived.
            'proposals', coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                           'outcome', (
                               SELECT CASE CASE WHEN n.neutral_outcome NOT IN ('AWAITING_YOU', 'IN_PROGRESS') THEN n.neutral_outcome
                                                WHEN p.expires_at <= clock_timestamp() THEN 'NO_LONGER_AVAILABLE'
                                                WHEN (SELECT v.still_valid FROM public.resolve_matching_proposal_validity_v1(p.id) v) IS NOT TRUE
                                                  THEN 'NO_LONGER_AVAILABLE'
                                                ELSE n.neutral_outcome END
                                        WHEN 'AWAITING_YOU' THEN 'awaiting you'
                                        WHEN 'IN_PROGRESS' THEN 'in progress'
                                        WHEN 'CLOSED_BY_YOU' THEN 'closed by you'
                                        WHEN 'MATCH_CONCLUDED' THEN 'matched'
                                        ELSE 'no longer available' END
                                 FROM public.matching_proposals p
                                 CROSS JOIN LATERAL public.resolve_matching_proposal_neutral_outcome_v1(p.id, p_subject) n
                                WHERE p.id = x.proposal_id),
                           'yourDecisions', coalesce((
                               SELECT jsonb_agg(jsonb_build_object('decision', own.decision, 'at', own.at) ORDER BY own.at, own.decision)
                                 FROM (SELECT 'approved'::text AS decision, fa.bound_at AS at
                                         FROM public.matching_forward_approval_view_bindings fa
                                        WHERE fa.proposal_id = x.proposal_id AND fa.approver_user_id = p_subject
                                       UNION ALL
                                       SELECT CASE db.decision_state WHEN 'WITHDRAWN' THEN 'withdrawn' ELSE 'declined' END, db.bound_at
                                         FROM public.matching_proposal_decision_view_bindings db
                                        WHERE db.proposal_id = x.proposal_id AND db.decider_user_id = p_subject
                                       UNION ALL
                                       SELECT 'accepted', mc.committed_at
                                         FROM public.matching_match_commits mc
                                        WHERE mc.proposal_id = x.proposal_id AND mc.candidate_user_id = p_subject) own), '[]'::jsonb))
                       ORDER BY x.first_delivered, x.proposal_id)
                  FROM (SELECT b.proposal_id, min(b.bound_at) AS first_delivered
                          FROM public.matching_proposal_delivery_view_bindings b
                         WHERE b.recipient_user_id = p_subject
                         GROUP BY b.proposal_id) x), '[]'::jsonb),
            -- Each Introduction the reader is one of the two humans of: what the reader themselves wrote, shared and
            -- decided in it - never the other human's words, shares, photo or name, and never who ended it when the
            -- reader did not. Messages are the Introduction era only (after a valid SUCCESS the World is a Shared World,
            -- whose export is QAN-BL-PRIV-05's). A message, share or stage its owner deleted has no body and is absent.
            'introductions', coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                           'startedAt', r.started_at,
                           'state', CASE r.introduction_status WHEN 'ACTIVE' THEN 'active'
                                                               WHEN 'COMPLETED' THEN 'continued as a shared world'
                                                               ELSE 'ended' END,
                           'endedAt', CASE WHEN r.introduction_status = 'CLOSED' THEN r.ended_at END,
                           'endedByYou', CASE WHEN r.introduction_status = 'CLOSED' THEN EXISTS (
                               SELECT 1 FROM public.introduction_ended_events e
                                WHERE e.introduction_record_id = r.id AND e.actor_user_id = p_subject) END,
                           'continuedAt', CASE WHEN r.introduction_status = 'COMPLETED' THEN r.ended_at END,
                           'yourMessages', coalesce((
                               SELECT jsonb_agg(jsonb_build_object('text', b.body_text, 'at', m.established_at) ORDER BY m.established_at, m.id)
                                 FROM public.shared_world_materials m
                                 JOIN public.shared_world_text_material_bodies b ON b.material_id = m.id
                                WHERE m.world_id = r.world_id AND m.author_user_id = p_subject AND m.material_kind = 'HUMAN_TEXT'
                                  AND shared_private.is_introduction_era_history_item_v1(m.world_id, m.history_item_id)), '[]'::jsonb),
                           'yourShares', coalesce((
                               SELECT jsonb_agg(jsonb_build_object(
                                          'kind', lower(replace(v.resource_type, '_', ' ')),
                                          'field', lower(replace(t.field_key, '_', ' ')),
                                          'text', t.text_value,
                                          'sharedAt', v.established_at)
                                      ORDER BY v.established_at, v.id)
                                 FROM public.introduction_disclosure_resource_versions v
                                 JOIN public.introduction_disclosure_text_payloads t ON t.resource_version_id = v.id
                                WHERE v.introduction_record_id = r.id AND v.world_id = r.world_id AND v.owner_user_id = p_subject), '[]'::jsonb),
                           -- The reader's own photo: its state and the derived renditions that still exist (the upload itself
                           -- is never stored), each stage shared or not; the files themselves travel beside the package.
                           'yourPhotos', coalesce((
                               SELECT jsonb_agg(jsonb_build_object(
                                          'state', CASE WHEN s.series_state IN ('READY', 'DISCLOSING') THEN 'live'
                                                        WHEN EXISTS (SELECT 1 FROM introduction_sharing_private.image_renditions kept
                                                                      WHERE kept.series_id = s.id) THEN 'shared'
                                                        ELSE 'removed' END,
                                          'stages', coalesce((
                                              SELECT jsonb_agg(jsonb_build_object('stage', rr.stage, 'shared', vis.at IS NOT NULL, 'sharedAt', vis.at)
                                                     ORDER BY rr.stage)
                                                FROM introduction_sharing_private.image_renditions rr
                                                LEFT JOIN LATERAL (
                                                    SELECT dv.established_at AS at
                                                      FROM introduction_sharing_private.image_stage_disclosures sd
                                                      JOIN public.introduction_disclosure_media_payloads mp ON mp.resource_version_id = sd.resource_version_id
                                                      JOIN public.introduction_disclosure_resource_versions dv ON dv.id = sd.resource_version_id
                                                     WHERE sd.series_id = rr.series_id AND sd.stage = rr.stage) vis ON true
                                               WHERE rr.series_id = s.id), '[]'::jsonb))
                                      ORDER BY (s.series_state IN ('READY', 'DISCLOSING')), s.id)
                                 FROM introduction_sharing_private.image_series s
                                WHERE s.introduction_record_id = r.id AND s.world_id = r.world_id AND s.owner_user_id = p_subject
                                  AND s.series_state <> 'PENDING'), '[]'::jsonb),
                           'yourNameDisplay', coalesce((
                               SELECT jsonb_agg(jsonb_build_object(
                                          'act', CASE e.display_act WHEN 'GRANT' THEN 'full name shown' ELSE 'first name shown again' END,
                                          'at', e.occurred_at)
                                      ORDER BY e.occurred_at, e.id)
                                 FROM introduction_sharing_private.name_display_events e
                                WHERE e.world_id = r.world_id AND e.owner_user_id = p_subject), '[]'::jsonb),
                           'yourContinuationApprovals', coalesce((
                               SELECT jsonb_agg(jsonb_build_object(
                                          'act', CASE e.approval_act WHEN 'APPROVE' THEN 'approved' ELSE 'approval withdrawn' END,
                                          'at', e.occurred_at)
                                      ORDER BY e.occurred_at, e.id)
                                 FROM public.introduction_success_approval_events e
                                 JOIN public.introduction_success_transition_versions tv ON tv.id = e.transition_version_id
                                WHERE tv.introduction_record_id = r.id AND e.approver_user_id = p_subject), '[]'::jsonb))
                       ORDER BY r.started_at, r.world_id)
                  FROM public.introduction_records r WHERE p_subject IN (r.lower_user_id, r.higher_user_id)), '[]'::jsonb),
            -- An ended Introduction whose other human erased their account: the reader's own words they keep (0164).
            'keptIntroductions', coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                           'startedAt', w.born_at,
                           'state', 'ended',
                           'keptAt', rv.retained_at,
                           'yourMessages', coalesce((
                               SELECT jsonb_agg(jsonb_build_object('text', b.body_text, 'at', m.established_at) ORDER BY m.established_at, m.id)
                                 FROM public.introduction_retained_view_items it
                                 JOIN public.shared_world_materials m ON m.history_item_id = it.history_item_id AND m.world_id = it.world_id
                                 JOIN public.shared_world_text_material_bodies b ON b.material_id = m.id
                                WHERE it.world_id = rv.world_id AND it.user_id = p_subject
                                  AND m.author_user_id = p_subject AND m.material_kind = 'HUMAN_TEXT'), '[]'::jsonb))
                       ORDER BY w.born_at, rv.world_id)
                  FROM public.introduction_retained_views rv
                  JOIN public.shared_worlds w ON w.id = rv.world_id
                 WHERE rv.user_id = p_subject), '[]'::jsonb),
            'resumedAfterIntroductions', coalesce((
                SELECT jsonb_agg(jsonb_build_object('act', own.act, 'at', own.at) ORDER BY own.at, own.act)
                  FROM (SELECT lower(c.reactivation_act) AS act, c.committed_at AS at
                          FROM public.matching_introduction_reactivation_commands c WHERE c.participant_user_id = p_subject
                        UNION ALL
                        SELECT lower(c.reactivation_act), c.committed_at
                          FROM public.matching_counterpart_erasure_reactivation_commands c WHERE c.participant_user_id = p_subject
                        UNION ALL
                        SELECT 'free to resume', rl.released_at
                          FROM public.matching_counterpart_erasure_releases rl WHERE rl.participant_user_id = p_subject) own), '[]'::jsonb)),
        -- S8A-05 (0179): the reader's OWN private Public topic drafts, as written (title, text, section key). A draft
        -- prepared as a topic says so; nothing of the Public copy, its identity or its review is printed here.
        'publicTopicDrafts', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'title', d.title,
                       'text', d.body,
                       'section', d.section_key,
                       'state', CASE WHEN d.prepared_experience_id IS NULL THEN 'editing' ELSE 'prepared for publication' END,
                       'createdAt', d.created_at,
                       'lastChangedAt', d.updated_at,
                       -- S8A-05 CP2 (0180): the draft's source as a REFERENCE only, never a copied text.
                       'source', CASE d.source_kind
                         WHEN 'CONVERSATION' THEN jsonb_build_object(
                           'kind', 'conversation',
                           'conversationStartedAt', (SELECT s.created_at FROM public.conversation_sessions s
                                                      WHERE s.id = d.source_session_id AND s.user_id = p_subject),
                           'firstPosition', d.source_first_sp,
                           'lastPosition', d.source_last_sp,
                           'includesQandeelReplies', d.source_include_qandeel,
                           'excludedMessagePositions', to_jsonb(d.source_excluded_sps),
                           'emphasizedMessagePositions', to_jsonb(d.source_emphasized_sps))
                         WHEN 'UNDERSTANDING' THEN jsonb_build_object(
                           'kind', 'qandeel understanding',
                           'understandingVersion', d.source_hypothesis_version)
                         END)
                   ORDER BY d.created_at, d.id)
              FROM public_compose_private.topic_drafts d WHERE d.user_id = p_subject), '[]'::jsonb),
        'notYetIncluded', jsonb_build_array('shared', 'public', 'replay'))
    -- S8B-02 (0183, D-7): the retained voice recordings, as metadata only (no key, no audio). An account with none
    -- gains nothing, so its document is unchanged; the files themselves are CP2's per-file route.
    || CASE WHEN EXISTS (SELECT 1 FROM voice_private.recordings r
                          WHERE r.user_id = p_subject AND r.recording_state IN ('RECORDING', 'STORED')
                            AND clock_timestamp() < r.retention_expires_at)
       THEN jsonb_build_object('voiceRecordings', (
              SELECT jsonb_agg(jsonb_build_object(
                         'kind', CASE r.recording_kind WHEN 'VOICE_NOTE' THEN 'voice note' ELSE 'live call' END,
                         'recordedAt', coalesce(r.accepted_at, r.started_at),
                         'availableUntil', r.retention_expires_at,
                         'state', CASE r.recording_state WHEN 'STORED' THEN 'stored' ELSE 'recording' END)
                     ORDER BY coalesce(r.accepted_at, r.started_at), r.id)
                FROM voice_private.recordings r
               WHERE r.user_id = p_subject AND r.recording_state IN ('RECORDING', 'STORED')
                 AND clock_timestamp() < r.retention_expires_at))
       ELSE '{}'::jsonb END;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 10. CONSENT DEFINERS (PRIV-W). A recording act re-reads the active grant FOR SHARE: a withdrawal that commits first is
--     seen, and one that comes later waits for the act. Nothing is deleted by a withdrawal.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION voice_private.consent_state_v1(p_user_id uuid) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_version text;
BEGIN
  SELECT c.consent_version INTO v_version FROM voice_private.recording_consents c
   WHERE c.user_id = p_user_id AND c.revoked_at IS NULL
   FOR SHARE;
  IF FOUND THEN
    RETURN CASE WHEN EXISTS (SELECT 1 FROM voice_private.consent_texts t
                              WHERE t.purpose = 'VOICE_RECORDING' AND t.version = v_version AND t.is_current)
                THEN 'GRANTED_CURRENT' ELSE 'VERSION_NOT_CURRENT' END;
  END IF;
  RETURN CASE WHEN EXISTS (SELECT 1 FROM voice_private.recording_consents c WHERE c.user_id = p_user_id)
              THEN 'WITHDRAWN' ELSE 'NOT_GRANTED' END;
END$$;

CREATE FUNCTION public.server_voice_consent_state_v1(p_user_id uuid)
RETURNS TABLE (consent_state text, consent_version text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT voice_private.consent_state_v1(p_user_id),
           (SELECT c.consent_version FROM voice_private.recording_consents c
             WHERE c.user_id = p_user_id AND c.revoked_at IS NULL);
END$$;

CREATE FUNCTION public.server_grant_voice_recording_consent_v1(p_user_id uuid, p_command_id uuid, p_consent_version text)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_existing voice_private.recording_consents;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_user_id IS NULL OR p_command_id IS NULL OR p_consent_version IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.users u WHERE u.id = p_user_id FOR KEY SHARE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  SELECT * INTO v_existing FROM voice_private.recording_consents c WHERE c.grant_command_id = p_command_id;
  IF FOUND THEN
    RETURN QUERY SELECT CASE WHEN v_existing.user_id = p_user_id AND v_existing.consent_version = p_consent_version
                             THEN 'GRANTED' ELSE 'COMMAND_CONFLICT' END;
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM voice_private.consent_texts t
                  WHERE t.purpose = 'VOICE_RECORDING' AND t.version = p_consent_version AND t.is_current) THEN
    RETURN QUERY SELECT 'VERSION_NOT_CURRENT'::text;
    RETURN;
  END IF;
  SELECT * INTO v_existing FROM voice_private.recording_consents c
   WHERE c.user_id = p_user_id AND c.revoked_at IS NULL FOR UPDATE;
  IF FOUND AND v_existing.consent_version = p_consent_version THEN
    RETURN QUERY SELECT 'GRANTED'::text;
    RETURN;
  END IF;
  IF FOUND THEN
    -- A grant of an earlier version is closed by the grant of the current one.
    UPDATE voice_private.recording_consents c SET revoked_at = v_now, revoke_command_id = p_command_id
     WHERE c.id = v_existing.id;
  END IF;
  INSERT INTO voice_private.recording_consents (id, user_id, purpose, consent_version, grant_command_id, granted_at)
  VALUES (gen_random_uuid(), p_user_id, 'VOICE_RECORDING', p_consent_version, p_command_id, v_now);
  RETURN QUERY SELECT 'GRANTED'::text;
END$$;

-- Withdrawal is always available. It refuses every later recording act and deletes nothing.
CREATE FUNCTION public.server_revoke_voice_recording_consent_v1(p_user_id uuid, p_command_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS NULL OR p_command_id IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM voice_private.recording_consents c
              WHERE c.revoke_command_id = p_command_id AND c.user_id = p_user_id) THEN
    RETURN QUERY SELECT 'WITHDRAWN'::text;
    RETURN;
  END IF;
  UPDATE voice_private.recording_consents c SET revoked_at = clock_timestamp(), revoke_command_id = p_command_id
   WHERE c.user_id = p_user_id AND c.revoked_at IS NULL;
  RETURN QUERY SELECT CASE WHEN FOUND THEN 'WITHDRAWN' ELSE 'NOT_GRANTED' END;
END$$;

-- Installing a consent version is an operator act (S8B-03 installs the first Copy-Gated text). No application role.
CREATE FUNCTION voice_private.install_consent_text_v1(p_version text, p_text_ar text, p_text_en text)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE voice_private.consent_texts t SET is_current = false WHERE t.purpose = 'VOICE_RECORDING' AND t.is_current;
  INSERT INTO voice_private.consent_texts (purpose, version, text_ar, text_en, text_ar_sha256, text_en_sha256, is_current)
  VALUES ('VOICE_RECORDING', p_version, p_text_ar, p_text_en, encode(sha256(convert_to(p_text_ar, 'UTF8')), 'hex'),
          encode(sha256(convert_to(p_text_en, 'UTF8')), 'hex'), true);
  RETURN QUERY SELECT 'INSTALLED'::text;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 11. THE RECORDING LIFECYCLE (service_role). A terminal transition and the erasure of its keys are one transaction.
-- ---------------------------------------------------------------------------------------------------------------------

-- Queue every object key of one recording: a stored object now, a pending one after its upload can no longer land.
-- Pending objects become DISCARDED. Returns the number of keys queued.
CREATE FUNCTION voice_private.queue_recording_keys_v1(p_recording_id uuid) RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO introduction_sharing_private.media_erasure_queue (storage_key, not_before)
  SELECT o.storage_key,
         CASE WHEN o.object_state = 'PENDING_UPLOAD'
              THEN greatest(clock_timestamp(), o.upload_deadline + voice_private.late_upload_grace_v1())
              ELSE clock_timestamp() END
    FROM voice_private.recording_objects o
   WHERE o.recording_id = p_recording_id AND o.object_state IN ('PENDING_UPLOAD', 'STORED')
  ON CONFLICT ON CONSTRAINT media_erasure_queue_pk DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE voice_private.recording_objects o SET object_state = 'DISCARDED'
   WHERE o.recording_id = p_recording_id AND o.object_state = 'PENDING_UPLOAD';
  RETURN v_count;
END$$;

-- The end of a call track's clock: where its next segment or gap must start (nothing is stitched).
CREATE FUNCTION voice_private.track_clock_end_v1(p_recording_id uuid, p_track text) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT greatest(
    coalesce((SELECT max(o.clock_end_ms) FROM voice_private.recording_objects o
               WHERE o.recording_id = p_recording_id AND o.track = p_track AND o.object_state <> 'DISCARDED'), 0),
    coalesce((SELECT max(g.clock_end_ms) FROM voice_private.recording_gaps g
               WHERE g.recording_id = p_recording_id AND g.track = p_track), 0));
$$;

-- Seal a call recording: its pending segments are discarded and their ranges become WRITER_LOSS gaps (nothing pending
-- is presented as stored). The expiry is unchanged.
CREATE FUNCTION voice_private.seal_call_recording_v1(p_recording_id uuid, p_sealed_by text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO voice_private.recording_gaps (recording_id, track, clock_start_ms, clock_end_ms, gap_kind)
  SELECT o.recording_id, o.track, o.clock_start_ms, o.clock_end_ms, 'WRITER_LOSS'
    FROM voice_private.recording_objects o
   WHERE o.recording_id = p_recording_id AND o.object_state = 'PENDING_UPLOAD'
  ON CONFLICT ON CONSTRAINT recording_gaps_pk DO NOTHING;
  INSERT INTO introduction_sharing_private.media_erasure_queue (storage_key, not_before)
  SELECT o.storage_key, greatest(clock_timestamp(), o.upload_deadline + voice_private.late_upload_grace_v1())
    FROM voice_private.recording_objects o
   WHERE o.recording_id = p_recording_id AND o.object_state = 'PENDING_UPLOAD'
  ON CONFLICT ON CONSTRAINT media_erasure_queue_pk DO NOTHING;
  UPDATE voice_private.recording_objects o SET object_state = 'DISCARDED'
   WHERE o.recording_id = p_recording_id AND o.object_state = 'PENDING_UPLOAD';
  UPDATE voice_private.recordings r SET recording_state = 'STORED', sealed_by = p_sealed_by, writer_lease_until = NULL
   WHERE r.id = p_recording_id;
END$$;

-- Begin a Voice Note: gated (PERSONAL_VOICE_NOTE), consented, one pending object with a database-generated key.
CREATE FUNCTION public.server_begin_voice_note_upload_v1(p_user_id uuid, p_session_id uuid, p_command_id uuid,
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
       AND clock_timestamp() < v_existing.upload_deadline THEN
      RETURN QUERY SELECT 'BEGUN'::text, v_existing.id, o.storage_key, v_existing.upload_deadline
        FROM voice_private.recording_objects o WHERE o.recording_id = v_existing.id;
    ELSE
      RETURN QUERY SELECT CASE WHEN v_existing.user_id = p_user_id THEN 'UNAVAILABLE' ELSE 'COMMAND_CONFLICT' END,
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

-- Accept a Voice Note after the API's PUT stored exactly the declared bytes: the object is STORED and the anchor
-- (accepted_at, D-6) and expiry are written, once. Consent is re-read; the gate is not (it governed the begin).
CREATE FUNCTION public.server_accept_voice_note_v1(p_user_id uuid, p_recording_id uuid, p_byte_size bigint)
RETURNS TABLE (outcome text, accepted_at timestamptz, retention_expires_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_recording voice_private.recordings;
  v_now timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_recording_id IS NULL OR p_byte_size IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_recording FROM voice_private.recordings r
   WHERE r.id = p_recording_id AND r.user_id = p_user_id AND r.recording_kind = 'VOICE_NOTE' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;
  IF v_recording.recording_state = 'STORED' THEN
    RETURN QUERY SELECT 'ACCEPTED'::text, v_recording.accepted_at, v_recording.retention_expires_at;
    RETURN;
  END IF;
  IF v_recording.recording_state <> 'PENDING_UPLOAD' OR clock_timestamp() >= v_recording.upload_deadline THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;
  IF voice_private.consent_state_v1(p_user_id) <> 'GRANTED_CURRENT' THEN
    RETURN QUERY SELECT 'CONSENT_REQUIRED'::text, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM voice_private.recording_objects o
                  WHERE o.recording_id = p_recording_id AND o.object_state = 'PENDING_UPLOAD'
                    AND o.byte_size = p_byte_size) THEN
    RETURN QUERY SELECT 'SIZE_MISMATCH'::text, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;
  v_now := clock_timestamp();
  UPDATE voice_private.recording_objects o SET object_state = 'STORED', stored_at = v_now
   WHERE o.recording_id = p_recording_id;
  UPDATE voice_private.recordings r
     SET recording_state = 'STORED', accepted_at = v_now, retention_expires_at = v_now + interval '30 days',
         upload_deadline = NULL
   WHERE r.id = p_recording_id;
  RETURN QUERY SELECT 'ACCEPTED'::text, v_now, v_now + interval '30 days';
END$$;

-- Open a call recording with the instant S8B-05's call transition writes in the same transaction (D-4): the one
-- authority for started_at, immutable from here. Gated (PERSONAL_LIVE_CALL) and consented.
CREATE FUNCTION public.server_open_call_recording_v1(p_user_id uuid, p_session_id uuid, p_call_id uuid,
                                                    p_started_at timestamptz, p_lease_seconds integer)
RETURNS TABLE (outcome text, recording_id uuid, retention_expires_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_existing voice_private.recordings;
  v_recording uuid;
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL OR p_call_id IS NULL OR p_started_at IS NULL
     OR p_started_at > clock_timestamp() OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 5 AND 120 THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_existing FROM voice_private.recordings r WHERE r.call_id = p_call_id;
  IF FOUND THEN
    RETURN QUERY SELECT CASE WHEN v_existing.user_id = p_user_id AND v_existing.session_id = p_session_id
                                  AND v_existing.started_at = p_started_at THEN 'OPENED' ELSE 'COMMAND_CONFLICT' END,
                        CASE WHEN v_existing.user_id = p_user_id THEN v_existing.id END,
                        CASE WHEN v_existing.user_id = p_user_id THEN v_existing.retention_expires_at END;
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversation_sessions s WHERE s.id = p_session_id AND s.user_id = p_user_id) THEN
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

-- Admit the next segment of one track: only the next index, only where the track's clock ends (or a gap row already
-- covers what is missing), with a database-generated key. Consented; renews the writer lease.
CREATE FUNCTION public.server_add_call_segment_v1(p_user_id uuid, p_recording_id uuid, p_track text, p_segment_index integer,
                                                 p_clock_start_ms bigint, p_clock_end_ms bigint, p_byte_size bigint,
                                                 p_lease_seconds integer)
RETURNS TABLE (outcome text, storage_key text, upload_deadline timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_existing voice_private.recording_objects;
  v_next integer;
  v_key text;
  v_deadline timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_recording_id IS NULL OR p_track IS NULL OR p_track NOT IN ('USER', 'QANDEEL')
     OR p_segment_index IS NULL OR p_segment_index < 0 OR p_clock_start_ms IS NULL OR p_clock_end_ms IS NULL
     OR p_clock_start_ms < 0 OR p_clock_end_ms <= p_clock_start_ms OR p_byte_size IS NULL OR p_byte_size <= 0
     OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 5 AND 120 THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM voice_private.recordings r
   WHERE r.id = p_recording_id AND r.user_id = p_user_id AND r.recording_state = 'RECORDING' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;
  SELECT * INTO v_existing FROM voice_private.recording_objects o
   WHERE o.recording_id = p_recording_id AND o.track = p_track AND o.segment_index = p_segment_index;
  IF FOUND THEN
    IF v_existing.clock_start_ms = p_clock_start_ms AND v_existing.clock_end_ms = p_clock_end_ms
       AND v_existing.byte_size = p_byte_size AND v_existing.object_state = 'PENDING_UPLOAD' THEN
      RETURN QUERY SELECT 'ADDED'::text, v_existing.storage_key, v_existing.upload_deadline;
    ELSE
      RETURN QUERY SELECT 'OUT_OF_ORDER'::text, NULL::text, NULL::timestamptz;
    END IF;
    RETURN;
  END IF;
  IF voice_private.consent_state_v1(p_user_id) <> 'GRANTED_CURRENT' THEN
    RETURN QUERY SELECT 'CONSENT_REQUIRED'::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;
  SELECT coalesce(max(o.segment_index), -1) + 1 INTO v_next FROM voice_private.recording_objects o
   WHERE o.recording_id = p_recording_id AND o.track = p_track;
  IF p_segment_index <> v_next THEN
    RETURN QUERY SELECT 'OUT_OF_ORDER'::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;
  IF p_clock_start_ms <> voice_private.track_clock_end_v1(p_recording_id, p_track) THEN
    RETURN QUERY SELECT 'DISCONTINUOUS'::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;
  IF p_byte_size > voice_private.object_byte_ceiling_v1() THEN
    RETURN QUERY SELECT 'TOO_LARGE'::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;
  v_key := 'voice-call/' || gen_random_uuid()::text;
  v_deadline := clock_timestamp() + voice_private.segment_upload_window_v1();
  INSERT INTO voice_private.recording_objects (recording_id, track, segment_index, storage_key, object_state, content_type,
                                               byte_size, clock_start_ms, clock_end_ms, upload_deadline)
  VALUES (p_recording_id, p_track, p_segment_index, v_key, 'PENDING_UPLOAD', 'audio/ogg', p_byte_size, p_clock_start_ms,
          p_clock_end_ms, v_deadline);
  UPDATE voice_private.recordings r SET writer_lease_until = clock_timestamp() + make_interval(secs => p_lease_seconds)
   WHERE r.id = p_recording_id;
  RETURN QUERY SELECT 'ADDED'::text, v_key, v_deadline;
END$$;

-- A segment is durable only when this answers STORED, after the API's PUT stored exactly its bytes. The writer releases
-- the segment's audio only after this acknowledgement (binds S8B-05's writer). Consented.
CREATE FUNCTION public.server_store_call_segment_v1(p_user_id uuid, p_recording_id uuid, p_track text,
                                                   p_segment_index integer, p_byte_size bigint)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_object voice_private.recording_objects;
BEGIN
  IF p_user_id IS NULL OR p_recording_id IS NULL OR p_track IS NULL OR p_segment_index IS NULL OR p_byte_size IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM voice_private.recordings r
   WHERE r.id = p_recording_id AND r.user_id = p_user_id AND r.recording_state = 'RECORDING' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  SELECT * INTO v_object FROM voice_private.recording_objects o
   WHERE o.recording_id = p_recording_id AND o.track = p_track AND o.segment_index = p_segment_index;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  IF v_object.object_state = 'STORED' THEN
    RETURN QUERY SELECT 'STORED'::text;
    RETURN;
  END IF;
  IF v_object.object_state <> 'PENDING_UPLOAD' OR clock_timestamp() >= v_object.upload_deadline THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  IF voice_private.consent_state_v1(p_user_id) <> 'GRANTED_CURRENT' THEN
    RETURN QUERY SELECT 'CONSENT_REQUIRED'::text;
    RETURN;
  END IF;
  IF v_object.byte_size <> p_byte_size THEN
    RETURN QUERY SELECT 'SIZE_MISMATCH'::text;
    RETURN;
  END IF;
  UPDATE voice_private.recording_objects o SET object_state = 'STORED', stored_at = clock_timestamp()
   WHERE o.recording_id = p_recording_id AND o.track = p_track AND o.segment_index = p_segment_index;
  RETURN QUERY SELECT 'STORED'::text;
END$$;

-- An explicit gap (a reconnection or a mute) where the track's clock ends. WRITER_LOSS is written only by a seal.
CREATE FUNCTION public.server_record_call_gap_v1(p_user_id uuid, p_recording_id uuid, p_track text, p_clock_start_ms bigint,
                                                p_clock_end_ms bigint, p_gap_kind text)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS NULL OR p_recording_id IS NULL OR p_track IS NULL OR p_track NOT IN ('USER', 'QANDEEL')
     OR p_clock_start_ms IS NULL OR p_clock_end_ms IS NULL OR p_clock_start_ms < 0 OR p_clock_end_ms <= p_clock_start_ms
     OR p_gap_kind IS NULL OR p_gap_kind NOT IN ('RECONNECTION', 'MUTED') THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM voice_private.recordings r
   WHERE r.id = p_recording_id AND r.user_id = p_user_id AND r.recording_state = 'RECORDING' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
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

-- The writer's own seal. Allowed after a consent withdrawal (PRIV-W): sealing records nothing new.
CREATE FUNCTION public.server_seal_call_recording_v1(p_user_id uuid, p_recording_id uuid)
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
  PERFORM voice_private.seal_call_recording_v1(p_recording_id, 'WRITER');
  RETURN QUERY SELECT 'SEALED'::text;
END$$;

-- Recovery: a call recording whose writer lease lapsed by more than the grace is sealed RECOVERY (SKIP LOCKED, so a
-- recording a writer holds is visited next time). The call's own end and its reason are S8B-05's.
CREATE FUNCTION public.server_recover_stale_call_recordings_v1(p_limit integer, p_grace_seconds integer)
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
     ORDER BY r.writer_lease_until, r.id
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM voice_private.seal_call_recording_v1(v_id, 'RECOVERY');
    v_count := v_count + 1;
  END LOOP;
  RETURN QUERY SELECT v_count;
END$$;

-- The retention sweep: a stored recording at or past its expiry becomes EXPIRED, and a note whose upload window closed
-- is DISCARDED; each with its keys queued, in one transaction. Reads already stopped at the instant (§3.4).
CREATE FUNCTION public.server_sweep_voice_recordings_v1(p_limit integer)
RETURNS TABLE (expired integer, discarded integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_row record;
  v_expired integer := 0;
  v_discarded integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  FOR v_row IN
    SELECT r.id, r.recording_state FROM voice_private.recordings r
     WHERE (r.recording_state = 'STORED' AND r.retention_expires_at <= clock_timestamp())
        OR (r.recording_state = 'PENDING_UPLOAD' AND r.upload_deadline <= clock_timestamp())
     ORDER BY r.id
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM voice_private.queue_recording_keys_v1(v_row.id);
    IF v_row.recording_state = 'STORED' THEN
      UPDATE voice_private.recordings r SET recording_state = 'EXPIRED', terminal_at = clock_timestamp()
       WHERE r.id = v_row.id;
      v_expired := v_expired + 1;
    ELSE
      UPDATE voice_private.recordings r SET recording_state = 'DISCARDED', terminal_at = clock_timestamp()
       WHERE r.id = v_row.id;
      v_discarded := v_discarded + 1;
    END IF;
  END LOOP;
  RETURN QUERY SELECT v_expired, v_discarded;
END$$;

-- Whether the owner may read a recording now: STORED, before its expiry (cut at the instant, with no worker), the
-- owner's, and no due account erasure. Not gated.
CREATE FUNCTION voice_private.recording_readable_v1(p_user_id uuid, p_recording_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM voice_private.recordings r
     WHERE r.id = p_recording_id AND r.user_id = p_user_id AND r.recording_state = 'STORED'
       AND clock_timestamp() < r.retention_expires_at
       AND NOT EXISTS (SELECT 1 FROM personal_data_private.account_deletions d
                        WHERE d.user_id = r.user_id AND d.status <> 'CANCELLED' AND d.final_at <= clock_timestamp()));
$$;

-- The stored objects of a readable recording, for the API to stream (keys reach the API only, never a client). Not
-- readable: no rows.
CREATE FUNCTION public.server_read_voice_recording_objects_v1(p_user_id uuid, p_recording_id uuid)
RETURNS TABLE (track text, segment_index integer, storage_key text, content_type text, byte_size bigint,
               clock_start_ms bigint, clock_end_ms bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS NULL OR p_recording_id IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT voice_private.recording_readable_v1(p_user_id, p_recording_id) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT o.track, o.segment_index, o.storage_key, o.content_type, o.byte_size, o.clock_start_ms, o.clock_end_ms
      FROM voice_private.recording_objects o
     WHERE o.recording_id = p_recording_id AND o.object_state = 'STORED'
     ORDER BY o.track, o.segment_index;
END$$;

-- The owner's deletion: always available (no gate, no consent). A pending note is DISCARDED; a stored or recording one
-- DELETED; its keys are queued in the same transaction.
CREATE FUNCTION public.server_delete_voice_recording_v1(p_user_id uuid, p_recording_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_recording voice_private.recordings;
BEGIN
  IF p_user_id IS NULL OR p_recording_id IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_recording FROM voice_private.recordings r
   WHERE r.id = p_recording_id AND r.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  IF v_recording.recording_state IN ('EXPIRED', 'DELETED', 'DISCARDED') THEN
    RETURN QUERY SELECT 'ALREADY_GONE'::text;
    RETURN;
  END IF;
  PERFORM voice_private.queue_recording_keys_v1(p_recording_id);
  IF v_recording.recording_state = 'PENDING_UPLOAD' THEN
    UPDATE voice_private.recordings r SET recording_state = 'DISCARDED', terminal_at = clock_timestamp()
     WHERE r.id = p_recording_id;
  ELSE
    UPDATE voice_private.recordings r
       SET recording_state = 'DELETED', deleted_reason = 'OWNER', terminal_at = clock_timestamp(), writer_lease_until = NULL
     WHERE r.id = p_recording_id;
  END IF;
  RETURN QUERY SELECT 'DELETED'::text;
END$$;

-- Storage listing reconciliation for voice keys: of the stored keys the API found, queue every one the database no
-- longer knows (no object row, not already queued). A key with an object row is never touched here.
CREATE FUNCTION public.server_enqueue_unknown_voice_media_v1(p_storage_keys text[])
RETURNS TABLE (enqueued integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_storage_keys IS NULL OR cardinality(p_storage_keys) > 1000 THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  INSERT INTO introduction_sharing_private.media_erasure_queue (storage_key, not_before)
  SELECT DISTINCT k, clock_timestamp() FROM unnest(p_storage_keys) AS u(k)
   WHERE k ~ '^voice-(note|call)/[0-9a-f-]{36}$'
     AND NOT EXISTS (SELECT 1 FROM voice_private.recording_objects o WHERE o.storage_key = k)
  ON CONFLICT ON CONSTRAINT media_erasure_queue_pk DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 12. VA-3 DEFINERS: attach (once, before units) and the provenance read the Memory path uses.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_attach_turn_voice_source_v1(
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

-- The provenance of one of the human's turns, for the Memory write path: no row is a text turn.
CREATE FUNCTION public.server_read_turn_voice_provenance_v1(p_user_id uuid, p_turn_id uuid)
RETURNS TABLE (source_modality text, transcript_origin text, asr_confidence_band text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT vs.source_modality, vs.transcript_origin, vs.asr_confidence_band
    FROM public.conversation_turn_voice_sources vs
   WHERE vs.turn_id = p_turn_id AND vs.user_id = p_user_id;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 13. MEDIA AND ACCOUNT ERASURE (§3.10): one queue, one coordinator, one more module.
-- ---------------------------------------------------------------------------------------------------------------------
ALTER TABLE introduction_sharing_private.media_erasure_queue DROP CONSTRAINT media_erasure_queue_key_check;
ALTER TABLE introduction_sharing_private.media_erasure_queue ADD CONSTRAINT media_erasure_queue_key_check
    CHECK (storage_key ~ '^(intro-media|voice-note|voice-call)/[0-9a-f-]{36}$');
ALTER TABLE account_erasure_private.media_pending DROP CONSTRAINT media_pending_key_check;
ALTER TABLE account_erasure_private.media_pending ADD CONSTRAINT media_pending_key_check
    CHECK (storage_key ~ '^(intro-media|voice-note|voice-call)/[0-9a-f-]{36}$');

ALTER TABLE account_erasure_private.coverage_registry DROP CONSTRAINT coverage_registry_coverage_check;
ALTER TABLE account_erasure_private.coverage_registry ADD CONSTRAINT coverage_registry_coverage_check CHECK (coverage IN (
    'PERSONAL', 'ACCOUNT_CASCADE', 'MATCHING_INTRODUCTIONS', 'SHARED_INTRODUCTION', 'SHARED_STANDARD', 'PUBLIC', 'REPLAY',
    'VOICE'));                -- deleted by the S8B-02 voice module (0183)

INSERT INTO account_erasure_private.coverage_registry (relation, coverage) VALUES
    ('conversation_turn_voice_sources', 'VOICE'),
    ('voice_private.recordings', 'VOICE'),
    ('voice_private.recording_objects', 'VOICE'),
    ('voice_private.recording_gaps', 'VOICE'),
    ('voice_private.recording_consents', 'ACCOUNT_CASCADE');

-- The voice module: every key of the account's recordings is queued and tracked in media_pending until the worker proves
-- it gone; then every voice row of the account leaves (sources first, as they name the turns 0130 deletes next). The
-- consent rows leave with the account row.
CREATE FUNCTION account_erasure_private.erase_voice_v1(p_deletion_id uuid, p_user uuid) RETURNS integer
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
  DELETE FROM voice_private.recording_gaps g WHERE g.recording_id = ANY (v_recordings);
  DELETE FROM voice_private.recording_objects o WHERE o.recording_id = ANY (v_recordings);
  DELETE FROM voice_private.recordings r WHERE r.id = ANY (v_recordings);
  RETURN v_keys;
END$$;

-- Whether any voice row still names the account (the module's own completeness check).
CREATE FUNCTION account_erasure_private.voice_module_residue_v1(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM voice_private.recordings r WHERE r.user_id = p_user)
      OR EXISTS (SELECT 1 FROM public.conversation_turn_voice_sources vs WHERE vs.user_id = p_user);
$$;

-- Forward-replaced from 0169_replay_personal_secure_integration_erasure_v1.sql (substitution "account-erasure" in database/voice-foundation-0183-substitutions.mjs).
CREATE OR REPLACE FUNCTION account_erasure_private.erase_account_v1(p_deletion_id uuid)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' SET lock_timeout = '2s' AS $$
DECLARE
  v_request personal_data_private.account_deletions;
  v_user uuid;
  v_worlds uuid[];
  v_humans uuid[];
  v_classes text[];
  v_outcome text;
  v_reason text;
  v_failure text;
  v_keys integer;
  v_personal text;
  v_pending integer;
BEGIN
  SELECT * INTO v_request FROM personal_data_private.account_deletions d WHERE d.id = p_deletion_id;
  IF v_request.id IS NULL THEN
    RETURN 'UNKNOWN';
  ELSIF v_request.status IN ('ERASED', 'COMPLETED') THEN
    -- An erased request's residual sweep before each provider removal attempt: exactly 0130's (ALREADY_ERASED).
    RETURN personal_data_private.erase_personal_account_v1(p_deletion_id);
  ELSIF v_request.status = 'CANCELLED' THEN
    RETURN 'CANCELLED';
  ELSIF v_request.status = 'BLOCKED' THEN
    RETURN 'BLOCKED';
  ELSIF v_request.final_at > clock_timestamp() THEN
    RETURN 'NOT_DUE';
  END IF;
  v_user := v_request.user_id;

  -- THE LOCKS, in the published order (Introduction family: World, Record, setup; Matching family: setup, proposals,
  -- pointers; the account family last: the account row, then the request). Taken outside the erasure subtransaction so
  -- they survive its rollback and the outcome is written under them.
  BEGIN
    v_worlds := account_erasure_private.introduction_worlds_v1(v_user);
    PERFORM 1 FROM public.shared_worlds w WHERE w.id = ANY (v_worlds) ORDER BY w.id FOR UPDATE;
    PERFORM 1 FROM public.introduction_records r WHERE r.world_id = ANY (v_worlds) ORDER BY r.id FOR UPDATE;
    v_humans := account_erasure_private.matching_humans_v1(v_user);
    PERFORM 1 FROM public.matching_setup_locks l WHERE l.user_id = ANY (v_humans) ORDER BY l.user_id FOR UPDATE;
    -- A Match, a SUCCESS or a new pair that committed while this waited moved the footprint: a later pass sees it whole.
    IF v_worlds IS DISTINCT FROM account_erasure_private.introduction_worlds_v1(v_user)
       OR v_humans IS DISTINCT FROM account_erasure_private.matching_humans_v1(v_user) THEN
      RAISE EXCEPTION 'ACCOUNT_ERASURE_FOOTPRINT_MOVED' USING ERRCODE = '55P03';
    END IF;
    PERFORM 1 FROM public.matching_proposals x
     WHERE x.pair_id IN (SELECT p.id FROM public.matching_pairs p WHERE v_user IN (p.lower_user_id, p.higher_user_id))
     ORDER BY x.id FOR UPDATE;
    PERFORM 1 FROM public.matching_participation_state s
     WHERE s.participant_user_id = ANY (v_humans) ORDER BY s.participant_user_id FOR UPDATE;
    PERFORM 1 FROM public.matching_active_introduction_claims c WHERE c.world_id = ANY (v_worlds) ORDER BY c.id FOR UPDATE;
    -- S7-01 (0169): the account's own Replays, ascending, before the account row (every Replay path takes its Replay first).
    PERFORM 1 FROM public.replays r WHERE r.created_by_user_id = v_user ORDER BY r.id FOR UPDATE;
    -- S8B-02 (0183): the account's voice recordings, ascending, before the account row.
    PERFORM 1 FROM voice_private.recordings r WHERE r.user_id = v_user ORDER BY r.id FOR UPDATE;
    PERFORM 1 FROM public.users u WHERE u.id = v_user FOR UPDATE;
    SELECT * INTO v_request FROM personal_data_private.account_deletions d WHERE d.id = p_deletion_id FOR UPDATE;
  EXCEPTION WHEN lock_not_available OR deadlock_detected OR serialization_failure THEN
    RETURN account_erasure_private.record_outcome_v1(p_deletion_id, 'RETRY', 'CONTENTION', NULL);
  END;

  -- Judged again under the locks, exactly as 0130 judges it.
  IF v_request.status = 'CANCELLED' THEN
    RETURN 'CANCELLED';
  ELSIF v_request.status = 'BLOCKED' THEN
    RETURN 'BLOCKED';
  ELSIF v_request.status IN ('ERASED', 'COMPLETED') THEN
    RETURN personal_data_private.erase_personal_account_v1(p_deletion_id);
  ELSIF v_request.final_at > clock_timestamp() THEN
    RETURN 'NOT_DUE';
  END IF;
  INSERT INTO account_erasure_private.deletion_progress AS g (deletion_id, last_outcome)
  VALUES (p_deletion_id, 'PENDING')
  ON CONFLICT (deletion_id) DO NOTHING;

  -- THE RESIDUE CENSUS, read-only, before anything is touched. The account row is held FOR UPDATE, so no transaction
  -- can add a row that references it until this one ends: the census is exact. A class blocks while no module covers
  -- it (S7-01 / 0169 covers REPLAY; ACCT-DEL-02 owns Shared STANDARD and Public; QAN-BL-ACCT-03 the Replay remainder).
  v_classes := ARRAY(
    SELECT c.residue_class FROM unnest(account_erasure_private.residue_classes_v1(v_user, v_worlds)) AS c(residue_class)
      JOIN account_erasure_private.residue_class_coverage k ON k.residue_class = c.residue_class
     WHERE NOT k.covered ORDER BY 1);
  IF cardinality(v_classes) > 0 THEN
    UPDATE personal_data_private.account_deletions d
       SET status = 'BLOCKED', blocked_at = clock_timestamp(), lease_until = NULL
     WHERE d.id = p_deletion_id;
    UPDATE account_erasure_private.deletion_progress g
       SET last_outcome = 'BLOCKED', residue_classes = v_classes, attempts = g.attempts + 1,
           consecutive_contention = 0, consecutive_unexplained = 0, updated_at = clock_timestamp()
     WHERE g.deletion_id = p_deletion_id;
    RETURN 'BLOCKED';
  END IF;

  -- THE ERASURE: one subtransaction around every write, the unchanged 0130 call included.
  BEGIN
    INSERT INTO account_erasure_private.erasure_authorizations (transaction_id, deletion_id)
    VALUES (pg_catalog.txid_current(), p_deletion_id);
    PERFORM pg_catalog.set_config('qandeel.account_erasure', pg_catalog.txid_current()::text, true);
    v_keys := account_erasure_private.erase_matching_introductions_v1(p_deletion_id, v_user, v_worlds);
    IF account_erasure_private.module_residue_v1(v_user) THEN
      RAISE EXCEPTION 'ACCOUNT_ERASURE_MODULE_INCOMPLETE' USING ERRCODE = 'P0001';
    END IF;
    -- S7-01 (0169): the Personal Replay module (QAN-BL-ACCT-02), under the same authorization, before 0130.
    PERFORM account_erasure_private.erase_personal_replays_v1(p_deletion_id, v_user);
    IF account_erasure_private.replay_module_residue_v1(v_user) THEN
      RAISE EXCEPTION 'ACCOUNT_ERASURE_MODULE_INCOMPLETE' USING ERRCODE = 'P0001';
    END IF;
    -- S8B-02 (0183): the voice module, under the same authorization, before 0130 deletes the turns it names.
    PERFORM account_erasure_private.erase_voice_v1(p_deletion_id, v_user);
    IF account_erasure_private.voice_module_residue_v1(v_user) THEN
      RAISE EXCEPTION 'ACCOUNT_ERASURE_MODULE_INCOMPLETE' USING ERRCODE = 'P0001';
    END IF;
    DELETE FROM account_erasure_private.erasure_authorizations a WHERE a.transaction_id = pg_catalog.txid_current();
    PERFORM pg_catalog.set_config('qandeel.account_erasure', '', true);
    v_personal := personal_data_private.erase_personal_account_v1(p_deletion_id);
    IF v_personal IS DISTINCT FROM 'ERASED' THEN
      -- 0130 rolled back only its own block and answered without raising: this undoes everything above with it.
      RAISE EXCEPTION 'ACCOUNT_ERASURE_PERSONAL_REFUSED' USING ERRCODE = 'P0001';
    END IF;
  EXCEPTION
    WHEN lock_not_available OR deadlock_detected OR serialization_failure THEN
      v_outcome := 'RETRY';
      v_reason := 'CONTENTION';
    WHEN foreign_key_violation THEN
      v_outcome := 'RETRY';
      v_reason := 'UNEXPLAINED_REFERENCE';
    WHEN OTHERS THEN
      IF SQLERRM = 'ACCOUNT_ERASURE_PERSONAL_REFUSED' THEN
        v_outcome := 'RETRY';
        v_reason := 'UNEXPLAINED_REFERENCE';
      ELSE
        v_outcome := 'INTEGRITY';
        v_failure := SQLSTATE;
      END IF;
  END;
  IF v_outcome IS NOT NULL THEN
    RETURN account_erasure_private.record_outcome_v1(p_deletion_id, v_outcome, v_reason, v_failure);
  END IF;

  SELECT count(*)::integer INTO v_pending FROM account_erasure_private.media_pending p WHERE p.deletion_id = p_deletion_id;
  UPDATE account_erasure_private.deletion_progress g
     SET last_outcome = 'ERASED', residue_classes = NULL, attempts = g.attempts + 1,
         consecutive_contention = 0, consecutive_unexplained = 0,
         erased_at = clock_timestamp(), media_keys = v_pending,
         media_erased_at = CASE WHEN v_pending = 0 THEN clock_timestamp() END, updated_at = clock_timestamp()
   WHERE g.deletion_id = p_deletion_id;
  RETURN 'ERASED';
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 14. OWNERSHIP, RLS AND ACL. Every relation: postgres-owned, RLS on, no policy, revoked from every role. Every function:
--     postgres-owned, revoked from every role; the server_* definers are granted to service_role only.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  rel text;
  fn text;
  r text;
BEGIN
  FOREACH rel IN ARRAY ARRAY['voice_private.recordings', 'voice_private.recording_objects', 'voice_private.recording_gaps',
                             'voice_private.consent_texts', 'voice_private.recording_consents',
                             'voice_private.voice_launch_capability_states', 'voice_private.voice_launch_capability_events',
                             'public.conversation_turn_voice_sources'] LOOP
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
    'voice_private.object_byte_ceiling_v1()',
    'voice_private.note_upload_window_v1()',
    'voice_private.segment_upload_window_v1()',
    'voice_private.late_upload_grace_v1()',
    'voice_private.set_voice_launch_capability_v1(text,text,text,text,text)',
    'voice_private.capability_enabled_v1(text)',
    'voice_private.turn_original_medium_v1(uuid)',
    'voice_private.account_erasure_delete_v1()',
    'voice_private.guard_recording_v1()',
    'voice_private.guard_recording_object_v1()',
    'voice_private.guard_append_only_v1()',
    'voice_private.guard_consent_text_v1()',
    'voice_private.guard_recording_consent_v1()',
    'voice_private.consent_state_v1(uuid)',
    'voice_private.install_consent_text_v1(text,text,text)',
    'voice_private.queue_recording_keys_v1(uuid)',
    'voice_private.track_clock_end_v1(uuid,text)',
    'voice_private.seal_call_recording_v1(uuid,text)',
    'voice_private.recording_readable_v1(uuid,uuid)',
    'public.guard_conversation_unit_voice_source_v1()',
    'public.guard_replay_personal_item_medium_v1()',
    'public.server_voice_consent_state_v1(uuid)',
    'public.server_grant_voice_recording_consent_v1(uuid,uuid,text)',
    'public.server_revoke_voice_recording_consent_v1(uuid,uuid)',
    'public.server_begin_voice_note_upload_v1(uuid,uuid,uuid,bigint)',
    'public.server_accept_voice_note_v1(uuid,uuid,bigint)',
    'public.server_open_call_recording_v1(uuid,uuid,uuid,timestamptz,integer)',
    'public.server_add_call_segment_v1(uuid,uuid,text,integer,bigint,bigint,bigint,integer)',
    'public.server_store_call_segment_v1(uuid,uuid,text,integer,bigint)',
    'public.server_record_call_gap_v1(uuid,uuid,text,bigint,bigint,text)',
    'public.server_seal_call_recording_v1(uuid,uuid)',
    'public.server_recover_stale_call_recordings_v1(integer,integer)',
    'public.server_sweep_voice_recordings_v1(integer)',
    'public.server_read_voice_recording_objects_v1(uuid,uuid)',
    'public.server_delete_voice_recording_v1(uuid,uuid)',
    'public.server_enqueue_unknown_voice_media_v1(text[])',
    'public.server_attach_turn_voice_source_v1(uuid,uuid,uuid,text,text,text,bigint,bigint,boolean,text)',
    'public.server_read_turn_voice_provenance_v1(uuid,uuid)',
    'account_erasure_private.erase_voice_v1(uuid,uuid)',
    'account_erasure_private.voice_module_residue_v1(uuid)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r);
      END IF;
    END LOOP;
    IF fn LIKE 'public.server\_%' AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 15. DEPLOY GUARD: the shape this migration promises, checked where it is installed.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
BEGIN
  -- G1. All four capability scopes are closed.
  IF (SELECT count(*) FROM voice_private.voice_launch_capability_states s
       WHERE s.feature_flag_state = 'DISABLED' AND s.launch_requirements_state = 'UNSATISFIED') <> 4
     OR (SELECT count(*) FROM voice_private.voice_launch_capability_states) <> 4 THEN
    RAISE EXCEPTION 'S8B-02: every voice capability scope must be seeded DISABLED / UNSATISFIED';
  END IF;
  -- G2. No consent text is installed.
  IF EXISTS (SELECT 1 FROM voice_private.consent_texts) THEN
    RAISE EXCEPTION 'S8B-02: no voice consent text is installed by this migration';
  END IF;
  -- G3. Every relation referencing the account, a voice relation or a voice-source relation is registered.
  SELECT count(*) INTO v_count FROM pg_constraint c
   WHERE c.contype = 'f'
     AND (c.confrelid = 'public.users'::regclass
          OR c.confrelid::regclass::text IN (SELECT g.relation FROM account_erasure_private.coverage_registry g
                                              WHERE g.coverage = 'VOICE'))
     AND c.conrelid::regclass::text NOT IN (SELECT g.relation FROM account_erasure_private.coverage_registry g);
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'S8B-02: a relation referencing the account or a voice relation is missing from the coverage registry';
  END IF;
  -- G4. No application role reaches a voice relation, and the gate setter and consent installer are no role's.
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants g
              WHERE (g.table_schema = 'voice_private' OR g.table_name = 'conversation_turn_voice_sources')
                AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC'))
     OR has_function_privilege('service_role', 'voice_private.set_voice_launch_capability_v1(text,text,text,text,text)', 'EXECUTE')
     OR has_function_privilege('service_role', 'voice_private.install_consent_text_v1(text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'S8B-02: a voice relation or operator act is reachable by an application role';
  END IF;
  -- G5. The modules never disable a guard, alter a table, truncate or run dynamic SQL.
  IF EXISTS (SELECT 1 FROM pg_proc p
              WHERE p.oid IN ('account_erasure_private.erase_voice_v1(uuid,uuid)'::regprocedure,
                              'account_erasure_private.erase_account_v1(uuid)'::regprocedure)
                AND p.prosrc ~* '(session_replication_role|DISABLE\s+TRIGGER|ALTER\s+TABLE|TRUNCATE|EXECUTE\s)') THEN
    RAISE EXCEPTION 'S8B-02: an erasure module must not disable a guard, alter a table, truncate or run dynamic SQL';
  END IF;
END$$;

COMMIT;
