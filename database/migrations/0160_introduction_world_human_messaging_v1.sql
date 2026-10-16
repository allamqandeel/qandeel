-- S6-05 - Introduction World reading and human messaging v1 (CP3: Introduction World & Human Messaging).
--
-- Product authority: the Product Owner's S6-05 Task Contract v1.0 and its decisions D1-D7, the CP0 rulings R-1 ... R-8
-- and the CP3 authorization (2026-10-16). The execution record is docs/e2e/QANDEEL_S6_05_IMPLEMENTATION_RECORD_v1.md.
-- This migration is that task's CP3 database part, and nothing more.
--
-- After the Mutual Match (0114, entered through 0159) the two humans own an ACTIVE / INTRODUCTION Shared World they can
-- neither find nor read nor speak in: S6-02 (0155) closed every Stage 4 list, read and send to that phase on purpose,
-- and left the Introduction-capable 0118 human commit core for "its own reviewed S6-05 boundary". This migration is that
-- boundary. It adds three authenticated functions beside the S6-02 fence; it lifts nothing in it and changes no existing
-- function. The ordinary Stage 4 Shared World is untouched.
--
-- ## What is added
--
--   list_my_introduction_worlds_v1()                                         NEW, authenticated only
--       The caller's own Introduction Worlds, so EITHER human finds the World the Match bore - the first recipient
--       included, who never saw the acceptance (D2: they arrive into a World that already exists). One row per World:
--       the World, the proposal both humans already know, ACTIVE or ENDED, and the first name the Match's own handoff
--       presented to THIS reader (the S6-02 projection; never the account Name). Nobody else's World ever appears.
--
--   read_my_introduction_messages_v1(world, before instant, before id, limit) NEW, authenticated only
--       One newest-first page of the human words in one ACTIVE Introduction World, as one consistent snapshot. Every
--       row carries the Introduction's state, so the caller learns it and the page together:
--         no row                        not one of the World's two humans, no such World, or not an Introduction now
--                                       (one answer, decided before anything else is read: no oracle)
--         ACTIVE rows                   the page, newest first; one ACTIVE row with no message when the page is empty
--         one ENDED row, no message     one of the World's two humans, after END. The closed history is CP4's.
--
--   send_my_introduction_text_v1(command, world, text)                         NEW, authenticated only
--       One human text message into an ACTIVE Introduction World, through the frozen 0090 / 0118 human text core and
--       NOTHING else: no QANDEEL reply, no reply work, no weaving, no Living Analysis, no Activity, no notification, no
--       Personal Context and no Matching Context Grant (D3, R-1, R-7). The material and history identities are derived
--       from the command through the Stage 4 derivation function (0139) under two Introduction-only namespaces, so a
--       retry is the same message, and the same command id replayed through the Stage 4 send after SUCCESS is that
--       core's command conflict, never a Stage 4 message that would start a reply, weaving or Activity.
--         COMMITTED (+ material, instant)  committed now, or a retry of the committed command (even after END or SUCCESS)
--         ENDED                            one of the World's two humans, and the Introduction has ended (IW-35 is shown
--                                          only on this server answer, never on a transport failure)
--         UNAVAILABLE                      anyone else, an unknown World, a World that is no longer an Introduction
--         COMMAND_CONFLICT                 this command id already names another request
--
-- ## Order, locks and races
--
-- Each function first decides membership from the immutable Introduction Record (one of its two humans) and answers
-- an outsider before any lock or any read of the World: the same answer as an unknown World. The send then lets the
-- frozen core answer a command that already exists (a replay, from durable rows, before any lock - or the core's own
-- command conflict); otherwise a World that is visibly no longer a live Introduction is answered without its lock (ENDED
-- or UNAVAILABLE), and a live one has its World row taken FOR UPDATE, the same first lock the core, END (0116) and
-- SUCCESS (0116) take, and the phase decided again UNDER it: ACTIVE / INTRODUCTION with a live Record goes to the core, a closed one
-- answers ENDED, anything else - a SUCCESS that already made it a Standard World included - is UNAVAILABLE. A message
-- and END therefore serialize on the World row: either the message commits first and END's closed-view snapshot holds
-- it, or END commits first and the message is ENDED. A message can never land in a World that SUCCESS has already made
-- Standard through this path (the Stage 4 send and its gate own that World from then on).
--
-- Deleting one's own message reuses the existing owner deletion, unchanged (R-5): delete_own_shared_world_material_v1
-- (0139 over 0143) derives the author from auth.uid(), never consults phase and works ACTIVE and READ_ONLY_CLOSED.
--
-- No Stage 4 launch gate is bound here: an Introduction World exists only after the CW2-08-gated Mutual Match, and the
-- humans' words inside it are, like END (S6-02), not a launch capability. CW2-08 itself is not touched.
--
-- ## What is deliberately NOT here
--
-- No change to any existing function, table, seam, policy or privilege (0001-0159 are byte-unchanged); no Stage 4 fence
-- is lifted; no closed-history read or END client (CP4); no mobile surface (CP5); no forward producer (QAN-BL-MATCH-06,
-- S6-07); no Activity or Push (S6-07, R-7); no photo, disclosure, SUCCESS or reactivation (S6-06); no AI of any kind in
-- the Introduction (Stage 8A). Forward-only.
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. DISCOVERY - the caller's own Introduction Worlds.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.list_my_introduction_worlds_v1()
RETURNS TABLE(world_id uuid, matching_proposal_id uuid, introduction_state text, other_first_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  -- One of the Record's two humans, a Record bound to its own Match commit and World, and the World still an
  -- Introduction (live, or closed by END). A World SUCCESS made Standard is a Stage 4 World and is not listed here.
  RETURN QUERY
    SELECT r.world_id, c.proposal_id,
           CASE WHEN r.introduction_status = 'ACTIVE' THEN 'ACTIVE' ELSE 'ENDED' END,
           shared_private.shared_person_name_v1(
             r.world_id, CASE WHEN r.lower_user_id = v_user THEN r.higher_user_id ELSE r.lower_user_id END, v_user)
      FROM public.introduction_records r
      JOIN public.matching_match_commits c ON c.id = r.match_commit_id AND c.world_id = r.world_id
      JOIN public.shared_worlds w ON w.id = r.world_id
     WHERE v_user IN (r.lower_user_id, r.higher_user_id)
       AND w.phase = 'INTRODUCTION'
       AND ((r.introduction_status = 'ACTIVE' AND w.lifecycle = 'ACTIVE')
         OR (r.introduction_status = 'CLOSED' AND w.lifecycle = 'READ_ONLY_CLOSED'))
     ORDER BY r.started_at DESC, r.world_id;
END$$;

COMMENT ON FUNCTION public.list_my_introduction_worlds_v1() IS
  'S6-05 CP3: the caller''s own Introduction Worlds (either human, the first recipient included). Per World: the World, '
  'the proposal, ACTIVE | ENDED and the handoff first name presented to this reader. Nobody else''s World ever appears. '
  'authenticated only.';

-- ---------------------------------------------------------------------------
-- 2. READING - one page of the human words in one ACTIVE Introduction World.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.read_my_introduction_messages_v1(
  p_world_id uuid, p_before_established_at timestamptz, p_before_material_id uuid, p_limit integer
) RETURNS TABLE(introduction_state text, material_id uuid, established_at timestamptz, is_self boolean, text_body text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_status text;
  v_lifecycle text;
  v_phase text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 200
     OR ((p_before_established_at IS NULL) <> (p_before_material_id IS NULL)) THEN
    RAISE EXCEPTION 'INTRODUCTION_MESSAGE_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  -- Not one of the World's two humans: no row, exactly as for an unknown World, before anything of the World is read.
  SELECT r.introduction_status, w.lifecycle, w.phase INTO v_status, v_lifecycle, v_phase
    FROM public.introduction_records r
    JOIN public.shared_worlds w ON w.id = r.world_id
   WHERE r.world_id = p_world_id AND v_user IN (r.lower_user_id, r.higher_user_id);
  IF NOT FOUND THEN
    RETURN;
  END IF;
  -- Ended by END: the member is told so, and nothing else. The closed history is a separate read (CP4).
  IF v_status = 'CLOSED' AND v_lifecycle = 'READ_ONLY_CLOSED' AND v_phase = 'INTRODUCTION' THEN
    RETURN QUERY SELECT 'ENDED'::text, NULL::uuid, NULL::timestamptz, NULL::boolean, NULL::text;
    RETURN;
  END IF;
  -- No longer an Introduction (SUCCESS made it Standard), or a Record and World that disagree: no row, fail closed.
  IF NOT (v_status = 'ACTIVE' AND v_lifecycle = 'ACTIVE' AND v_phase = 'INTRODUCTION') THEN
    RETURN;
  END IF;
  -- The frozen material resolver decides visibility (the 0115 ACTIVE / INTRODUCTION branch: exactly the two humans).
  -- Human words only: a deleted message has no body and is not shown; no QANDEEL, analysis or disclosure material.
  RETURN QUERY
    SELECT 'ACTIVE'::text, m.material_id, m.established_at, m.author_user_id = v_user, m.text_body
      FROM public.resolve_shared_world_material_v1(p_world_id, v_user) m
     WHERE m.material_kind = 'HUMAN_TEXT' AND m.author_user_id IS NOT NULL AND m.text_body IS NOT NULL
       AND (p_before_established_at IS NULL
            OR (m.established_at, m.material_id) < (p_before_established_at, p_before_material_id))
     ORDER BY m.established_at DESC, m.material_id DESC
     LIMIT p_limit;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'ACTIVE'::text, NULL::uuid, NULL::timestamptz, NULL::boolean, NULL::text;
  END IF;
END$$;

COMMENT ON FUNCTION public.read_my_introduction_messages_v1(uuid, timestamptz, uuid, integer) IS
  'S6-05 CP3: one newest-first page of the human words in one ACTIVE Introduction World, for its two humans only. No '
  'row: not theirs / unknown / not an Introduction. ACTIVE rows (one empty ACTIVE row for an empty page). One empty '
  'ENDED row after END. authenticated only.';

-- ---------------------------------------------------------------------------
-- 3. SENDING - one human text message, through the frozen human text core only.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.send_my_introduction_text_v1(p_command_id uuid, p_world_id uuid, p_content text)
RETURNS TABLE(outcome text, material_id uuid, established_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_lifecycle text;
  v_phase text;
  v_status text;
  v_result record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  -- The bounded request: the same bound the Stage 4 send applies to one message (0139).
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_content IS NULL OR length(btrim(p_content)) = 0
     OR length(p_content) > 20000 THEN
    RAISE EXCEPTION 'INTRODUCTION_MESSAGE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  -- Not one of the World's two humans: the same answer as an unknown World, before any lock.
  IF NOT EXISTS (SELECT 1 FROM public.introduction_records r
                  WHERE r.world_id = p_world_id AND v_user IN (r.lower_user_id, r.higher_user_id)) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;
  -- A command id that already exists is the frozen core's to answer from durable rows, before any lock: a retry of
  -- this human's committed message in this World (even after END or SUCCESS), or its own command conflict.
  IF NOT EXISTS (SELECT 1 FROM public.shared_world_material_commit_commands c WHERE c.id = p_command_id) THEN
    -- A World that is visibly no longer a live Introduction is answered without taking its lock: a member of an ended
    -- Introduction, or of one SUCCESS made Standard, never serializes against the World's own work.
    SELECT w.lifecycle, w.phase, r.introduction_status INTO v_lifecycle, v_phase, v_status
      FROM public.shared_worlds w JOIN public.introduction_records r ON r.world_id = w.id WHERE w.id = p_world_id;
    IF v_status = 'CLOSED' AND v_lifecycle = 'READ_ONLY_CLOSED' AND v_phase = 'INTRODUCTION' THEN
      RETURN QUERY SELECT 'ENDED'::text, NULL::uuid, NULL::timestamptz;
      RETURN;
    END IF;
    IF v_status IS DISTINCT FROM 'ACTIVE' OR v_lifecycle IS DISTINCT FROM 'ACTIVE' OR v_phase IS DISTINCT FROM 'INTRODUCTION' THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
      RETURN;
    END IF;
    -- The World row first, exactly as the core, END and SUCCESS take it; the phase is decided again under that lock.
    SELECT w.lifecycle, w.phase INTO v_lifecycle, v_phase FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
    SELECT r.introduction_status INTO v_status FROM public.introduction_records r WHERE r.world_id = p_world_id;
    IF v_status = 'CLOSED' AND v_lifecycle = 'READ_ONLY_CLOSED' AND v_phase = 'INTRODUCTION' THEN
      RETURN QUERY SELECT 'ENDED'::text, NULL::uuid, NULL::timestamptz;
      RETURN;
    END IF;
    IF v_status IS DISTINCT FROM 'ACTIVE' OR v_lifecycle IS DISTINCT FROM 'ACTIVE' OR v_phase IS DISTINCT FROM 'INTRODUCTION' THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
      RETURN;
    END IF;
  END IF;

  BEGIN
    SELECT c.committed_material_id, c.material_established_at INTO v_result
      FROM public.commit_shared_world_human_text_v1(
             p_command_id, p_world_id,
             shared_private.derive_shared_conversation_identity_v1('INTRODUCTION_HUMAN_TEXT_MATERIAL', p_command_id),
             shared_private.derive_shared_conversation_identity_v1('INTRODUCTION_HUMAN_TEXT_HISTORY_ITEM', p_command_id),
             p_content) c;
  EXCEPTION
    WHEN unique_violation THEN
      -- 23505: this command id names another request; a derived identity already taken is no conflict of the caller's.
      IF SQLERRM = 'SHARED_WORLD_MATERIAL_COMMAND_ID_CONFLICT' THEN
        RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::uuid, NULL::timestamptz;
      ELSE
        RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
      END IF;
      RETURN;
    WHEN no_data_found THEN
      -- P0002 SHARED_WORLD_MATERIAL_NOT_AVAILABLE: one answer.
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
      RETURN;
  END;
  RETURN QUERY SELECT 'COMMITTED'::text, v_result.committed_material_id, v_result.material_established_at;
END$$;

COMMENT ON FUNCTION public.send_my_introduction_text_v1(uuid, uuid, text) IS
  'S6-05 CP3: one human text message into an ACTIVE Introduction World, through the frozen human text core only (no '
  'reply, weaving, analysis, Activity or notification). COMMITTED (+ material, instant) | ENDED (members only) | '
  'UNAVAILABLE | COMMAND_CONFLICT. authenticated only.';

-- ---------------------------------------------------------------------------
-- 4. OWNERSHIP AND ACL.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  boundary text;
BEGIN
  FOREACH boundary IN ARRAY ARRAY[
    'public.list_my_introduction_worlds_v1()',
    'public.read_my_introduction_messages_v1(uuid,timestamptz,uuid,integer)',
    'public.send_my_introduction_text_v1(uuid,uuid,text)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', boundary);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', boundary);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', boundary);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', boundary);
    END IF;
  END LOOP;
END$$;

GRANT EXECUTE ON FUNCTION
  public.list_my_introduction_worlds_v1(),
  public.read_my_introduction_messages_v1(uuid, timestamptz, uuid, integer),
  public.send_my_introduction_text_v1(uuid, uuid, text)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. TERMINAL SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  boundaries text[] := ARRAY[
    'public.list_my_introduction_worlds_v1()',
    'public.read_my_introduction_messages_v1(uuid,timestamptz,uuid,integer)',
    'public.send_my_introduction_text_v1(uuid,uuid,text)'];
  send text := 'public.send_my_introduction_text_v1(uuid,uuid,text)';
  -- the frozen cores these compose keep their posture: executable by no application role
  hidden text[] := ARRAY[
    'public.commit_shared_world_human_text_v1(uuid,uuid,uuid,uuid,text)',
    'public.commit_shared_world_human_material_v1(uuid,uuid,uuid,uuid,text,text,text,text,integer)',
    'shared_private.derive_shared_conversation_identity_v1(text,uuid)',
    'shared_private.shared_person_name_v1(uuid,uuid,uuid)'];
  fn text;
  r text;
  src text;
BEGIN
  FOREACH fn IN ARRAY boundaries LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = fn::regprocedure AND p.prosecdef
                     AND pg_get_userbyid(p.proowner) = 'postgres' AND p.proconfig @> ARRAY['search_path=""']) THEN
      RAISE EXCEPTION 'S6-05: % must be postgres-owned, SECURITY DEFINER and search_path-pinned', fn;
    END IF;
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S6-05: PUBLIC must not execute %', fn;
    END IF;
    FOREACH r IN ARRAY ARRAY['anon', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) AND has_function_privilege(r, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S6-05: % must not execute %', r, fn;
      END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AND NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S6-05: authenticated must execute %', fn;
    END IF;
    -- Human words only: nothing here reaches a reply, weaving, analysis, Activity, a launch gate, an account Name, a
    -- Matching Context Grant or Personal Context; nothing writes directly or runs dynamic SQL.
    SELECT regexp_replace(p.prosrc, '--[^\n]*', '', 'g') INTO src FROM pg_proc p WHERE p.oid = fn::regprocedure;
    IF src ~* '(qandeel|semantic|analysis|activity|alert|launch_gate|_capability|public\.users|context_grant|personal|memory)' THEN
      RAISE EXCEPTION 'S6-05: % reaches no reply, weaving, analysis, Activity, gate, account Name, grant or Personal Context', fn;
    END IF;
    IF src ~* '(INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM|EXECUTE\s|RAISE;|ISOLATION)' THEN
      RAISE EXCEPTION 'S6-05: % writes nothing itself, runs no dynamic SQL and re-raises nothing', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY hidden LOOP
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) AND has_function_privilege(r, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S6-05: % must not execute %', r, fn;
      END IF;
    END LOOP;
  END LOOP;
  -- The send calls the frozen human text core exactly once, and the membership answer comes before the World lock.
  SELECT regexp_replace(p.prosrc, '--[^\n]*', '', 'g') INTO src FROM pg_proc p WHERE p.oid = send::regprocedure;
  IF (length(src) - length(replace(src, 'public.commit_shared_world_human_text_v1(', ''))) / length('public.commit_shared_world_human_text_v1(') <> 1 THEN
    RAISE EXCEPTION 'S6-05: % must call the frozen human text core exactly once', send;
  END IF;
  IF strpos(src, 'v_user IN (r.lower_user_id, r.higher_user_id)') = 0
     OR strpos(src, 'v_user IN (r.lower_user_id, r.higher_user_id)') > strpos(src, 'FOR UPDATE') THEN
    RAISE EXCEPTION 'S6-05: % must answer a non-member before it locks anything', send;
  END IF;
END$$;

COMMIT;
