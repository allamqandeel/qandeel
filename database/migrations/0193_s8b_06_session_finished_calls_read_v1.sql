-- S8B-06 CP3 R3 — the finished-call record (J7) from durable truth: one service-role read of a Session's finished calls,
-- under the Product Owner's CP3 Review R1 decision of 2026-11-04 (R3, option A; migration 0193 approved on PR #381).
-- Not hosted: every voice gate stays DISABLED.
--
-- ## What is added
--
--   A. public.server_read_session_finished_calls_v1(p_user_id, p_session_id, p_ended_from, p_ended_before): the person's
--      calls of that Session that ENDED after they became ACTIVE, with their id, started_at, ended_at and end_reason,
--      the server's own instants (voice-runtime §3: "one canonical call record per Live Call ... started / ended
--      instants, end reason"). The history page (GET /conversation/sessions/:id/turns) carries them additively, within
--      the page's window [p_ended_from, p_ended_before) of ended_at; a NULL bound is open. At most 100, the newest.
--      * A call that never became ACTIVE (started_at NULL: refused, or never connected) was not a call and is never
--        returned. A call not ENDED is the live call, read through call truth (0189), and is not returned either.
--      * Security definer, EXECUTE to service_role only, like every server_* read; it reads no turn, no content, no
--        transcript and no audio, and writes nothing.
--
-- ## What is deliberately NOT here
--
--   * No change to voice_private.calls, to any call transition, to the recording rules, to retention (V3, 30 days from
--     the start), to Replay or to Export My Data. No new route, no protocol change, no client grant. No gate is opened;
--     nothing is applied to a hosted database.

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. THE READ (A).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_read_session_finished_calls_v1(p_user_id uuid, p_session_id uuid, p_ended_from timestamptz, p_ended_before timestamptz)
RETURNS TABLE (call_id uuid, started_at timestamptz, ended_at timestamptz, end_reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.id, c.started_at, c.ended_at, c.end_reason
    FROM voice_private.calls c
   WHERE c.user_id = p_user_id AND c.session_id = p_session_id
     AND c.state = 'ENDED' AND c.started_at IS NOT NULL
     AND (p_ended_from IS NULL OR c.ended_at >= p_ended_from)
     AND (p_ended_before IS NULL OR c.ended_at < p_ended_before)
   ORDER BY c.ended_at DESC, c.id DESC
   LIMIT 100;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. OWNERSHIP AND ACL.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  fn text := 'public.server_read_session_finished_calls_v1(uuid,uuid,timestamptz,timestamptz)';
  r text;
BEGIN
  EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r); END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END IF;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. DEPLOY GUARD.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT count(*) FROM voice_private.voice_launch_capability_states s
       WHERE s.feature_flag_state = 'DISABLED' AND s.launch_requirements_state = 'UNSATISFIED') <> 4 THEN
    RAISE EXCEPTION 'S8B-06 CP3: every voice capability scope must remain DISABLED / UNSATISFIED';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants g
              WHERE g.table_schema = 'voice_private' AND g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC'))
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public' AND p.proname LIKE 'server\_%call%'
                   AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))) THEN
    RAISE EXCEPTION 'S8B-06 CP3: a voice relation or a call definer is reachable by a client role';
  END IF;
END$$;

COMMIT;
