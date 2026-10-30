-- S8B-02 CP2 — Secure Media Lifecycle: the two database gaps the CP2 integration proved in 0183, closed forward-only.
--
-- Product authority: the Product Owner's S8B-02 CP2 execution order (2026-10-30), under the S8B-02 Implementation Task
-- Contract v1.0 FINAL §3.1 ("CP2 adds a migration only if its integration proves a database defect in 0183 / 0184, and
-- states why in its record") and §3.11. The implementation record is
-- docs/e2e/QANDEEL_S8B_02_VOICE_FOUNDATION_IMPLEMENTATION_RECORD_v1.md §11.
--
-- ## Why this migration exists (record §11.2)
--
--   1. Export My Data (§3.11, B9) lists every retained voice object beside the photo manifest. 0183 has no definer that
--      enumerates the owner's readable recordings: its only enumerator is the export package builder, which names no
--      recording and no object, by design. Without one the voice manifest cannot be built. ADDED:
--      server_list_voice_recordings_v1 - the owner's readable recordings and their STORED objects, each with a stable
--      export file name, and NO storage key (the per-file route re-reads the key through 0183's own read definer, which
--      re-checks ownership and readability at that instant).
--   2. The listing reconciliation (B5: "a late PUT after a terminal state is erased (not_before plus reconcile)") must find
--      an object that lands under a key the database already let go. 0183's voice reconciliation skips every key that
--      still has an object row - but voice object rows OUTLIVE their recording's EXPIRED / DELETED / DISCARDED state and
--      their own DISCARDED state (they are the recording's history), so a late object under such a key could never be
--      found by the listing. FORWARD-REPLACED: server_enqueue_unknown_voice_media_v1 now queues a listed key unless it
--      belongs to a live object (not DISCARDED) of a live recording (not EXPIRED, DELETED or DISCARDED). A live key is
--      never touched, exactly as before.
--
-- ## What is deliberately NOT here
--
--   * No relation, column, CHECK, trigger, state or gate. No consent text. Every scope stays DISABLED.
--   * 0183 and 0184 stay byte-identical; every function 0183 created keeps its body except the one replacement above.
--   * No voice_private function: verify-migration-0183's census of that schema is unchanged.
--   * The account erasure coordinator (0164 / 0169 / 0183) is untouched and not named here.

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. THE OWNER'S READABLE RECORDINGS, FOR THE EXPORT MANIFEST (§3.11, B9).
-- ---------------------------------------------------------------------------------------------------------------------
-- One row per STORED object of each recording the owner may read now (voice_private.recording_readable_v1: the owner's,
-- STORED, before its expiry, no due account erasure). The file name is derived from the recording's own anchor instant
-- (UTC, microseconds), its kind and, for a call, the track and segment index; two recordings of one kind sharing an
-- instant are told apart by a counter in recording-id order. No storage key, URL or credential is returned.
CREATE FUNCTION public.server_list_voice_recordings_v1(p_user_id uuid)
RETURNS TABLE (recording_id uuid, recording_kind text, recorded_at timestamptz, retention_expires_at timestamptz,
               track text, segment_index integer, content_type text, byte_size bigint, clock_start_ms bigint,
               clock_end_ms bigint, file_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'VOICE_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    WITH readable AS (
      SELECT r.id, r.recording_kind, coalesce(r.accepted_at, r.started_at) AS anchor, r.retention_expires_at AS expires,
             to_char(coalesce(r.accepted_at, r.started_at) AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISSUS"Z"') AS stamp
        FROM voice_private.recordings r
       WHERE r.user_id = p_user_id AND r.recording_state = 'STORED'
         AND voice_private.recording_readable_v1(p_user_id, r.id)
    ), named AS (
      SELECT rd.*, row_number() OVER (PARTITION BY rd.recording_kind, rd.stamp ORDER BY rd.id) AS nth FROM readable rd
    )
    SELECT n.id, n.recording_kind, n.anchor, n.expires, o.track, o.segment_index, o.content_type, o.byte_size,
           o.clock_start_ms, o.clock_end_ms,
           CASE n.recording_kind
             WHEN 'VOICE_NOTE' THEN 'qandeel-voice-note-' || n.stamp || CASE WHEN n.nth > 1 THEN '-' || n.nth ELSE '' END || '.m4a'
             ELSE 'qandeel-voice-call-' || n.stamp || CASE WHEN n.nth > 1 THEN '-' || n.nth ELSE '' END || '-' || lower(o.track) || '-'
                  || lpad(o.segment_index::text, greatest(6, length(o.segment_index::text)), '0') || '.ogg'
           END
      FROM named n
      JOIN voice_private.recording_objects o ON o.recording_id = n.id AND o.object_state = 'STORED'
     ORDER BY n.anchor, n.id, o.track, o.segment_index;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. THE VOICE LISTING RECONCILIATION, FORWARD-REPLACED (B5).
-- ---------------------------------------------------------------------------------------------------------------------
-- Of the stored keys the API found (older than its grace), queue every one the database no longer holds as live: no
-- object row; a DISCARDED object; or an object of an EXPIRED, DELETED or DISCARDED recording. A key of a live object of
-- a live recording is never touched. Re-queueing a key already erased is harmless: DELETE then HEAD 404 again.
CREATE OR REPLACE FUNCTION public.server_enqueue_unknown_voice_media_v1(p_storage_keys text[])
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
     AND NOT EXISTS (SELECT 1 FROM voice_private.recording_objects o
                       JOIN voice_private.recordings r ON r.id = o.recording_id
                      WHERE o.storage_key = k AND o.object_state <> 'DISCARDED'
                        AND r.recording_state NOT IN ('EXPIRED', 'DELETED', 'DISCARDED'))
  ON CONFLICT ON CONSTRAINT media_erasure_queue_pk DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. OWNERSHIP AND ACL: postgres-owned, revoked from every role, granted to service_role alone.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  fn text;
  r text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.server_list_voice_recordings_v1(uuid)',
    'public.server_enqueue_unknown_voice_media_v1(text[])'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r);
      END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. DEPLOY GUARD.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
BEGIN
  -- G1. Every voice capability scope is still closed.
  IF (SELECT count(*) FROM voice_private.voice_launch_capability_states s
       WHERE s.feature_flag_state = 'DISABLED' AND s.launch_requirements_state = 'UNSATISFIED') <> 4 THEN
    RAISE EXCEPTION 'S8B-02 CP2: every voice capability scope must stay DISABLED / UNSATISFIED';
  END IF;
  -- G2. The two functions are definers no application role but service_role reaches.
  IF has_function_privilege('anon', 'public.server_list_voice_recordings_v1(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.server_list_voice_recordings_v1(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.server_enqueue_unknown_voice_media_v1(text[])', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.server_enqueue_unknown_voice_media_v1(text[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'S8B-02 CP2: a voice media definer is reachable by a client role';
  END IF;
END$$;

COMMIT;
