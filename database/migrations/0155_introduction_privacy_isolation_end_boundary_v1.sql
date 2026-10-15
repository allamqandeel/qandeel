-- S6-02 - Introduction-Phase Privacy Isolation & Safe END Boundary v1.
--
-- Product authority: the Product Owner's approved S6-02 Task Contract v1.2 and its implementation authorization
-- (2026-10-15): decisions A, A1, D1-D5 and the six final clarifications. The execution record is
-- docs/e2e/QANDEEL_S6_02_IMPLEMENTATION_RECORD_v1.md. This migration is that task's database part, and nothing more.
--
-- A Shared World born from a Mutual Match (shared_worlds.birth_basis = 'MUTUAL_MATCH', 0075 / 0114) is protected by
-- its persisted origin, not by its current phase: before SUCCESS it is ACTIVE / INTRODUCTION, after SUCCESS the SAME
-- World is STANDARD (0116), and both are covered here. Worlds born from an accepted invitation are unchanged.
--
-- ## What is added
--
--   1. shared_private.shared_person_name_v1(world, subject, viewer) - the ONE display-name projection every Stage 4 /
--      SHARED-VIS-01 / S5-02 / Activity read now uses where it used public.users.name. An ACCEPTED_INVITATION World
--      answers the account Name exactly as before. Any other World answers only the handoff first name of the exact
--      Mutual Match that bore it (0113 / 0114: matching_match_handoff_subjects.presented_first_name), presented to
--      exactly this viewer about exactly this subject, both being the two humans of its Introduction Record, every
--      binding (birth fact, Match commit, Introduction Record, handoff package) proven - and otherwise NULL, which every
--      surface already renders as the approved neutral "someone" (decision D2). The account Name is never a fallback,
--      SUCCESS widens nothing (decision A), and the viewer's own row is NULL too: the self flag renders "you".
--   2. shared_private.is_introduction_era_history_item_v1(world, history item) and
--      shared_private.without_introduction_era_history_v1(world, history items) - the D5 era predicate. A history item
--      of a Matching-born World is Introduction-era unless the World has the valid SUCCESS fact of its own Introduction
--      Record (completed event, COMPLETED record, COMPLETED terminal commit, STANDARD phase) AND the item occurred
--      strictly after it. An ordinary World has no Introduction era. Anything unproven is Introduction-era.
--   3. public.end_own_introduction_v1(command, world) - the ONE authenticated boundary over the frozen 0116 END core
--      (decision D1): no launch gate, no seam, no counterpart; the human is auth.uid(); the two participation-event
--      identities the core needs are derived from the command id and the lower / higher slot, so a retry is the same
--      request; anybody who is not one of the two humans of this World's Introduction Record is answered UNAVAILABLE
--      before the core runs. The core itself, and every other I-07 boundary, keeps its 0116 posture.
--
-- ## What is redefined forward (CREATE OR REPLACE; same signature, same RETURNS TABLE, same owner and ACL)
--
-- Each body below is its current live definition with only the edits named in its own comment:
--
--   * Stage 4 reads, sends and QANDEEL reply work refuse an Introduction-phase World the same way they refuse a World
--     the reader does not belong to (decision D4): 0138 list / members / entry, 0139 material read, send, QANDEEL
--     reply begin / complete, 0141 per-World alerts and the Activity source, 0148's current-member predicate. The 0118
--     Introduction-capable cores, owner deletion (0139 / 0143) and every frozen I-04 / I-07 core are unchanged.
--   * every account-Name projection of 0138-0141, 0143 and 0148 goes through shared_person_name_v1 (decision A).
--   * a Matching-born World accepts no ADD_MEMBER and no REJOIN_MEMBER (A1 / D3), decided under the World row lock in
--     the three 0140 boundaries that create, complete or accept one. Leaving and ending are unchanged.
--   * Replay excludes Introduction-era Shared material (GATE-35 / D5) at capture and at every later currency check -
--     preview, finalization, distribution and current availability all derive from that one currency function - by
--     filtering the visible set the frozen 0119 resolver already answers. No new caller of that resolver exists, no
--     Replay relation gains a phase or birth_basis column, and no Replay privilege changes.
--   * S5-02 Public authoring neither lists nor packages Introduction-era Shared material, on the same predicate.
--
-- ## What is deliberately NOT here
--
--   * No change to 0111's first-name resolver, to 0154's preparation draft, or to the handoff: wiring the confirmed
--     first name into the canonical source is S6-03's; the Introduction surfaces that consume this projection are S6-05.
--   * None of the six commands 0149 closed is reopened, granted, wrapped or named. No launch gate is configured.
--   * No Introduction-specific reader, no FULL_NAME display consent, no SUCCESS boundary, no Activity producer.
--
-- Forward-only. Migrations 0001-0154 are byte-unchanged.
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE DISPLAY NAME (decisions A and D2).
--
--    An ACCEPTED_INVITATION World: the subject's account Name, exactly what every
--    projection below read before. Any other World - the only other birth basis
--    is MUTUAL_MATCH - never reads public.users: it answers the first name its
--    own Mutual Match handoff presented to THIS viewer about THIS subject, and
--    only when the subject and the viewer are the two humans of the World's own
--    Introduction Record and the birth fact, the Match commit and the handoff
--    package all bind that same World, Record and commit. Otherwise NULL. The
--    viewer's own row has no handoff row presented to themselves, so it is NULL.
--    No World is an unknown World: NULL.
-- ---------------------------------------------------------------------------
CREATE FUNCTION shared_private.shared_person_name_v1(p_world_id uuid, p_subject_user_id uuid, p_viewer_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
           WHEN w.birth_basis = 'ACCEPTED_INVITATION' THEN
             (SELECT u.name FROM public.users u WHERE u.id = p_subject_user_id)
           ELSE
             (SELECT hs.presented_first_name
                FROM public.introduction_records r
                JOIN public.shared_world_matching_birth_events b
                  ON b.world_id = r.world_id AND b.introduction_record_id = r.id AND b.match_commit_id = r.match_commit_id
                JOIN public.matching_match_commits c
                  ON c.id = r.match_commit_id AND c.world_id = r.world_id AND c.introduction_record_id = r.id
                JOIN public.matching_match_handoff_package_versions pv
                  ON pv.id = c.handoff_package_version_id AND pv.match_commit_id = c.id AND pv.introduction_record_id = r.id
                 AND pv.world_id = r.world_id AND pv.proposal_id = c.proposal_id
                JOIN public.matching_match_handoff_subjects hs
                  ON hs.package_version_id = pv.id AND hs.proposal_id = pv.proposal_id
               WHERE r.world_id = w.id
                 AND hs.subject_user_id = p_subject_user_id
                 AND hs.presented_to_user_id = p_viewer_user_id
                 AND ((r.lower_user_id = p_subject_user_id AND r.higher_user_id = p_viewer_user_id)
                   OR (r.higher_user_id = p_subject_user_id AND r.lower_user_id = p_viewer_user_id)))
         END
    FROM public.shared_worlds w
   WHERE w.id = p_world_id;
$$;

COMMENT ON FUNCTION shared_private.shared_person_name_v1(uuid, uuid, uuid) IS
  'S6-02: the one display-name projection of the Shared Product reads. ACCEPTED_INVITATION World: the account Name. '
  'Matching-born World: only the exact handoff first name presented to this viewer about this subject, else NULL; '
  'never the account Name, before or after SUCCESS. Internal: no application role executes it.';

-- ---------------------------------------------------------------------------
-- 2. THE INTRODUCTION ERA (GATE-35 / decision D5), derived, never stored.
--
--    false for every history item of an ACCEPTED_INVITATION World. For a
--    Matching-born World: false only when the World is STANDARD through the
--    valid SUCCESS of its own Introduction Record - the completed event, the
--    COMPLETED record and the COMPLETED terminal commit of that same Record -
--    AND the item belongs to the World and occurred STRICTLY after that SUCCESS.
--    An item at the SUCCESS instant, an item of a World that never succeeded, an
--    unknown item and an unknown World are all Introduction-era.
-- ---------------------------------------------------------------------------
CREATE FUNCTION shared_private.is_introduction_era_history_item_v1(p_world_id uuid, p_history_item_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((
    SELECT w.birth_basis <> 'ACCEPTED_INVITATION'
           AND NOT EXISTS (
             SELECT 1
               FROM public.introduction_completed_events ce
               JOIN public.introduction_records r
                 ON r.id = ce.introduction_record_id AND r.world_id = ce.world_id AND r.introduction_status = 'COMPLETED'
               JOIN public.introduction_terminal_commits t
                 ON t.introduction_record_id = r.id AND t.world_id = r.world_id AND t.terminal_outcome = 'COMPLETED'
               JOIN public.shared_world_history_items i ON i.world_id = ce.world_id
              WHERE ce.world_id = w.id AND w.phase = 'STANDARD'
                AND i.id = p_history_item_id AND i.occurred_at > ce.occurred_at)
      FROM public.shared_worlds w
     WHERE w.id = p_world_id), true);
$$;

COMMENT ON FUNCTION shared_private.is_introduction_era_history_item_v1(uuid, uuid) IS
  'S6-02 (GATE-35 / D5): true when a Shared history item is Introduction-era material - any item of a Matching-born '
  'World unless it occurred strictly after that World''s valid SUCCESS. Never true for an ACCEPTED_INVITATION World. '
  'Fail-closed. Internal: no application role executes it.';

-- The same predicate over an ordered set: the items that are NOT Introduction-era,
-- in their original order. NULL stays NULL, so a caller's own "nothing visible"
-- branch answers exactly as before; an ordinary World's set comes back unchanged.
CREATE FUNCTION shared_private.without_introduction_era_history_v1(p_world_id uuid, p_history_item_ids uuid[])
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
           WHEN p_history_item_ids IS NULL THEN NULL::uuid[]
           ELSE coalesce((SELECT array_agg(x.item ORDER BY x.ordinal)
                            FROM unnest(p_history_item_ids) WITH ORDINALITY AS x(item, ordinal)
                           WHERE NOT shared_private.is_introduction_era_history_item_v1(p_world_id, x.item)),
                         ARRAY[]::uuid[])
         END;
$$;

COMMENT ON FUNCTION shared_private.without_introduction_era_history_v1(uuid, uuid[]) IS
  'S6-02 (GATE-35 / D5): the given history items without the Introduction-era ones, order kept, NULL kept. '
  'Internal: no application role executes it.';

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['shared_private.shared_person_name_v1(uuid, uuid, uuid)',
                            'shared_private.is_introduction_era_history_item_v1(uuid, uuid)',
                            'shared_private.without_introduction_era_history_v1(uuid, uuid[])'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', fn); END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 3. THE ONE INTRODUCTION END BOUNDARY (GATE-34 / decision D1).
--
--    Either of the two matched humans ends their Introduction alone, at any
--    time: no counterpart, no proposal, no CW2-08 launch gate, no seam, no
--    CLEARED state - ending is an exit and a privacy act. Everything the END
--    means is the frozen 0116 core's, called once and never copied: the lock
--    order, the closed-view entitlements frozen before closure, the archival
--    READ_ONLY_CLOSED / INTRODUCTION closure, both claims released, each human
--    PAUSED / POST_INTRODUCTION unless OFF, one terminal winner.
--
--    The client supplies only the command and the World. The human is
--    auth.uid(). The two participation-event identities are derived from the
--    command and the slot, so the same command is the same core request (its
--    request reference binds them) and is answered from the committed row.
--
--    Answers: ENDED (also for a retry of the committed command), ALREADY_SETTLED
--    for one of the two humans whose Introduction has already reached its one
--    terminal outcome (it never says which, or who), and UNAVAILABLE for anybody
--    else, an unknown World or a command id already bound to another request.
--    The outsider check runs BEFORE the core, whose first refusal for a settled
--    World would otherwise answer an outsider differently from an unknown World.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.end_own_introduction_v1(p_command_id uuid, p_world_id uuid)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_lower_event uuid;
  v_higher_event uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_END_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_END_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.introduction_records r
                  WHERE r.world_id = p_world_id AND v_user IN (r.lower_user_id, r.higher_user_id)) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  SELECT (substr(h, 1, 12) || '4' || substr(h, 14, 3) || '8' || substr(h, 18, 3) || substr(h, 21, 12))::uuid INTO v_lower_event
    FROM (SELECT encode(sha256(convert_to('QANDEEL_S6_02_INTRODUCTION_END_PARTICIPATION_EVENT_V1' || E'\n' || 'LOWER'
                                          || E'\n' || lower(p_command_id::text), 'UTF8')), 'hex') AS h) d;
  SELECT (substr(h, 1, 12) || '4' || substr(h, 14, 3) || '8' || substr(h, 18, 3) || substr(h, 21, 12))::uuid INTO v_higher_event
    FROM (SELECT encode(sha256(convert_to('QANDEEL_S6_02_INTRODUCTION_END_PARTICIPATION_EVENT_V1' || E'\n' || 'HIGHER'
                                          || E'\n' || lower(p_command_id::text), 'UTF8')), 'hex') AS h) d;
  BEGIN
    PERFORM 1 FROM public.commit_introduction_end_v1(p_command_id, p_world_id, v_lower_event, v_higher_event);
  EXCEPTION
    WHEN object_not_in_prerequisite_state THEN
      -- 55000 INTRODUCTION_TERMINAL_ALREADY_SETTLED: SUCCESS or the other human's END already won.
      RETURN QUERY SELECT 'ALREADY_SETTLED'::text;
      RETURN;
    WHEN unique_violation OR no_data_found THEN
      -- 23505: this command id names another request; P0002: nothing to end. One bounded answer.
      RETURN QUERY SELECT 'UNAVAILABLE'::text;
      RETURN;
  END;
  RETURN QUERY SELECT 'ENDED'::text;
END$$;

COMMENT ON FUNCTION public.end_own_introduction_v1(uuid, uuid) IS
  'S6-02 (GATE-34 / D1): one of the two matched humans ends their Introduction alone, ungated, over the frozen 0116 '
  'END core. Inputs: command id and World only; the human is auth.uid(); participation-event ids derived from the '
  'command. ENDED | ALREADY_SETTLED | UNAVAILABLE. authenticated only.';

ALTER FUNCTION public.end_own_introduction_v1(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.end_own_introduction_v1(uuid, uuid) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.end_own_introduction_v1(uuid, uuid) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON FUNCTION public.end_own_introduction_v1(uuid, uuid) FROM service_role;
  END IF;
END$$;
GRANT EXECUTE ON FUNCTION public.end_own_introduction_v1(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. S4-01 reachability reads (0138)
-- ---------------------------------------------------------------------------

-- shared_private.list_own_shared_worlds_v1()
--   D4: an Introduction-phase World is not one of the reader's Stage 4 Worlds.
CREATE OR REPLACE FUNCTION shared_private.list_own_shared_worlds_v1()
 RETURNS TABLE(world_id uuid, born_at timestamp with time zone, joined_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT w.id, w.born_at, e.joined_at
      FROM public.shared_world_membership_episodes e
      JOIN public.shared_worlds w ON w.id = e.world_id
     WHERE e.user_id = v_user AND e.ended_at IS NULL AND w.lifecycle = 'ACTIVE' AND w.phase = 'STANDARD'
     ORDER BY w.born_at, w.id;
END$function$
;

-- shared_private.list_own_shared_world_members_v1()
--   D4: no Introduction-phase World; A / D2: the member name is the S6-02 projection.
CREATE OR REPLACE FUNCTION shared_private.list_own_shared_world_members_v1()
 RETURNS TABLE(world_id uuid, is_self boolean, member_name text, joined_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT m.world_id, m.user_id = v_user, shared_private.shared_person_name_v1(m.world_id, m.user_id, v_user), m.joined_at
      FROM public.shared_world_membership_episodes mine
      JOIN public.shared_worlds w ON w.id = mine.world_id AND w.lifecycle = 'ACTIVE' AND w.phase = 'STANDARD'
      JOIN public.shared_world_membership_episodes m ON m.world_id = mine.world_id AND m.ended_at IS NULL
      JOIN public.users u ON u.id = m.user_id
     WHERE mine.user_id = v_user AND mine.ended_at IS NULL
     ORDER BY w.born_at, m.world_id, m.joined_at, m.id;
END$function$
;

-- shared_private.resolve_own_shared_world_entry_v1(uuid)
--   D4: the Stage 4 entry verdict for an Introduction-phase World is the same UNAVAILABLE as for a non-member.
CREATE OR REPLACE FUNCTION shared_private.resolve_own_shared_world_entry_v1(p_world_id uuid)
 RETURNS TABLE(outcome text, world_id uuid, born_at timestamp with time zone, joined_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_born timestamptz;
  v_joined timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT w.born_at, e.joined_at INTO v_born, v_joined
    FROM public.shared_world_membership_episodes e
    JOIN public.shared_worlds w ON w.id = e.world_id
   WHERE e.world_id = p_world_id AND e.user_id = v_user AND e.ended_at IS NULL AND w.lifecycle = 'ACTIVE' AND w.phase = 'STANDARD';
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'ALLOW'::text, p_world_id, v_born, v_joined;
END$function$
;

-- ---------------------------------------------------------------------------
-- 5. S4-02 conversation (0139)
-- ---------------------------------------------------------------------------

-- shared_private.list_own_shared_world_material_v1(uuid, timestamp with time zone, uuid, integer)
--   D4: nothing is read from an Introduction-phase World; A / D2: every human author name, the reader's own included, is the S6-02 projection.
CREATE OR REPLACE FUNCTION shared_private.list_own_shared_world_material_v1(p_world_id uuid, p_before_established_at timestamp with time zone, p_before_material_id uuid, p_limit integer)
 RETURNS TABLE(material_id uuid, material_kind text, producer_kind text, established_at timestamp with time zone, is_self boolean, author_name text, text_body text, can_delete boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 200
     OR ((p_before_established_at IS NULL) <> (p_before_material_id IS NULL)) THEN
    RAISE EXCEPTION 'SHARED_MATERIAL_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  -- Current membership (an OPEN episode in an ACTIVE World) is the S4-01 entry law. Anything else reads nothing, and
  -- reads nothing in the same way, so this is not a membership or World-existence oracle.
  IF NOT EXISTS (
    SELECT 1 FROM public.shared_world_membership_episodes e
      JOIN public.shared_worlds w ON w.id = e.world_id
     WHERE e.world_id = p_world_id AND e.user_id = v_user AND e.ended_at IS NULL AND w.lifecycle = 'ACTIVE' AND w.phase = 'STANDARD'
  ) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT m.material_id, m.material_kind,
           CASE WHEN m.author_user_id IS NULL THEN 'QANDEEL' ELSE 'HUMAN' END,
           m.established_at,
           COALESCE(m.author_user_id = v_user, false),
           CASE WHEN m.author_user_id IS NULL THEN NULL ELSE shared_private.shared_person_name_v1(p_world_id, m.author_user_id, v_user) END,
           m.text_body,
           m.author_user_id IS NOT NULL AND m.author_user_id = v_user
      FROM public.resolve_shared_world_material_v1(p_world_id, v_user) m
      LEFT JOIN public.users u ON u.id = m.author_user_id
     WHERE m.text_body IS NOT NULL
       AND (p_before_established_at IS NULL
            OR (m.established_at, m.material_id) < (p_before_established_at, p_before_material_id))
     ORDER BY m.established_at DESC, m.material_id DESC
     LIMIT p_limit;
END$function$
;

-- shared_private.send_shared_world_human_text_v1(uuid, uuid, text)
--   D4: no Stage 4 send into an Introduction-phase World.
CREATE OR REPLACE FUNCTION shared_private.send_shared_world_human_text_v1(p_command_id uuid, p_world_id uuid, p_content text)
 RETURNS TABLE(outcome text, material_id uuid, established_at timestamp with time zone, qandeel_reply_material_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_material uuid;
  v_item uuid;
  v_reply_command uuid;
  v_gate record;
  v_committed public.shared_world_material_commit_commands;
  v_result record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  -- The bounded request: the same bound the Personal conversation route already applies to one submission.
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_content IS NULL OR length(btrim(p_content)) = 0
     OR length(p_content) > 20000 THEN
    RAISE EXCEPTION 'SHARED_MESSAGE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_material := shared_private.derive_shared_conversation_identity_v1('HUMAN_TEXT_MATERIAL', p_command_id);
  v_item := shared_private.derive_shared_conversation_identity_v1('HUMAN_TEXT_HISTORY_ITEM', p_command_id);
  v_reply_command := shared_private.derive_shared_conversation_identity_v1('QANDEEL_REPLY_COMMAND', p_command_id);

  -- An equivalent retry of a committed command is a read of committed truth, not a new ordinary act: it is answered by
  -- the frozen commit's own durable idempotency even after the capability closes. A command that belongs to another
  -- human or another World reaches the frozen conflict below.
  SELECT * INTO v_committed FROM public.shared_world_material_commit_commands c WHERE c.id = p_command_id;
  IF NOT FOUND OR v_committed.actor_user_id IS DISTINCT FROM v_user OR v_committed.world_id <> p_world_id THEN
    -- LOCK ORDER STEP 0: the current conversation-capability snapshot, held FOR SHARE until this transaction ends.
    SELECT * INTO v_gate FROM shared_private.bind_shared_launch_gate_v1('SHARED_CONVERSATION');
    IF v_gate.verdict <> 'ALLOW' THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz, NULL::uuid;
      RETURN;
    END IF;
  END IF;

  -- S6-02 (D4): an Introduction-phase World has no Stage 4 send. One answer, the same as for a World this human does
  -- not belong to; the Introduction-capable 0118 core stays for its own reviewed S6-05 boundary.
  IF NOT EXISTS (SELECT 1 FROM public.shared_worlds w WHERE w.id = p_world_id AND w.phase = 'STANDARD') THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz, NULL::uuid;
    RETURN;
  END IF;

  BEGIN
    SELECT c.committed_material_id, c.material_established_at INTO v_result
      FROM public.commit_shared_world_human_text_v1(p_command_id, p_world_id, v_material, v_item, p_content) c;
  EXCEPTION
    WHEN no_data_found THEN
      -- SHARED_WORLD_MATERIAL_NOT_AVAILABLE: not a current member, not ACTIVE / STANDARD, no such World — one answer.
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz, NULL::uuid;
      RETURN;
  END;

  RETURN QUERY
    SELECT 'COMMITTED'::text, v_result.committed_material_id, v_result.material_established_at,
           (SELECT r.material_id FROM public.shared_world_material_commit_commands r WHERE r.id = v_reply_command);
END$function$
;

-- shared_private.begin_shared_qandeel_reply_work_v1(uuid, uuid, uuid)
--   D4: no QANDEEL reply work starts for an Introduction-phase World.
CREATE OR REPLACE FUNCTION shared_private.begin_shared_qandeel_reply_work_v1(p_human_command_id uuid, p_world_id uuid, p_requester_user_id uuid)
 RETURNS TABLE(work_outcome text, work_lease_id uuid, reply_material_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_human public.shared_world_material_commit_commands;
  v_reply public.shared_world_material_commit_commands;
  v_gate record;
  v_policy record;
  v_lease uuid;
BEGIN
  IF p_human_command_id IS NULL OR p_world_id IS NULL OR p_requester_user_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_QANDEEL_REPLY_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  -- Ownership is explicit, as for every server-named actor: the server names the human whose committed HUMAN_TEXT
  -- command in this exact World started the request. Anything else is one answer.
  SELECT * INTO v_human FROM public.shared_world_material_commit_commands c WHERE c.id = p_human_command_id;
  IF NOT FOUND OR v_human.world_id <> p_world_id OR v_human.producer_kind <> 'HUMAN'
     OR v_human.material_kind <> 'HUMAN_TEXT' OR v_human.actor_user_id IS DISTINCT FROM p_requester_user_id THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;
  -- The one reply already exists: nothing to generate, whatever the gate or the budget says now.
  SELECT * INTO v_reply FROM public.shared_world_material_commit_commands c
   WHERE c.id = shared_private.derive_shared_conversation_identity_v1('QANDEEL_REPLY_COMMAND', p_human_command_id);
  IF FOUND THEN
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, NULL::uuid, v_reply.material_id;
    RETURN;
  END IF;
  -- No provider work for a human who is no longer a current member of the ACTIVE World.
  IF NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e JOIN public.shared_worlds w ON w.id = e.world_id
                  WHERE e.world_id = p_world_id AND e.user_id = p_requester_user_id AND e.ended_at IS NULL
                    AND w.lifecycle = 'ACTIVE' AND w.phase = 'STANDARD') THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;
  -- LOCK ORDER STEP 0: no provider work starts while ordinary Shared conversation is closed.
  SELECT * INTO v_gate FROM shared_private.bind_shared_launch_gate_v1('SHARED_CONVERSATION');
  IF v_gate.verdict <> 'ALLOW' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;
  -- The requester's work lock: every decision below is made under it, for every API instance at once.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('qandeel.shared-qandeel-reply-work.v1:' || p_requester_user_id::text, 0));
  -- Read again under the lock: a holder that committed the reply while this request waited has also returned its lease.
  SELECT * INTO v_reply FROM public.shared_world_material_commit_commands c
   WHERE c.id = shared_private.derive_shared_conversation_identity_v1('QANDEEL_REPLY_COMMAND', p_human_command_id);
  IF FOUND THEN
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, NULL::uuid, v_reply.material_id;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM shared_private.shared_qandeel_reply_work_leases l
              WHERE l.human_command_id = p_human_command_id AND l.expires_at > CURRENT_TIMESTAMP) THEN
    RETURN QUERY SELECT 'IN_PROGRESS'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;
  SELECT * INTO v_policy FROM shared_private.shared_qandeel_reply_work_policy_v1();
  -- Bounded housekeeping of this requester's rows only: expired leases free their slots; grants older than the longest
  -- window can no longer count.
  DELETE FROM shared_private.shared_qandeel_reply_work_leases l
   WHERE l.requester_user_id = p_requester_user_id AND l.expires_at <= CURRENT_TIMESTAMP;
  DELETE FROM shared_private.shared_qandeel_reply_work_grants g
   WHERE g.requester_user_id = p_requester_user_id AND g.granted_at <= CURRENT_TIMESTAMP - v_policy.long_window;
  -- One answer for every reason: no counter, window, limit or other World is disclosed.
  IF (SELECT count(*) FROM shared_private.shared_qandeel_reply_work_leases l
       WHERE l.requester_user_id = p_requester_user_id) >= v_policy.user_in_flight_limit
     OR (SELECT count(*) FROM shared_private.shared_qandeel_reply_work_grants g
          WHERE g.requester_user_id = p_requester_user_id
            AND g.granted_at > CURRENT_TIMESTAMP - v_policy.short_window) >= v_policy.short_window_limit
     OR (SELECT count(*) FROM shared_private.shared_qandeel_reply_work_grants g
          WHERE g.requester_user_id = p_requester_user_id) >= v_policy.long_window_limit THEN
    RETURN QUERY SELECT 'LIMITED'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;
  v_lease := pg_catalog.gen_random_uuid();
  INSERT INTO shared_private.shared_qandeel_reply_work_leases
    (human_command_id, world_id, requester_user_id, lease_id, acquired_at, expires_at)
  VALUES (p_human_command_id, p_world_id, p_requester_user_id, v_lease, CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP + public.foreground_generation_lease_interval_v1());
  INSERT INTO shared_private.shared_qandeel_reply_work_grants (requester_user_id, granted_at)
  VALUES (p_requester_user_id, CURRENT_TIMESTAMP);
  RETURN QUERY SELECT 'GRANTED'::text, v_lease, NULL::uuid;
END$function$
;

-- shared_private.complete_shared_world_qandeel_reply_v1(uuid, uuid, uuid, text, text, text, text, text, text, text, uuid[], text[])
--   D4: no QANDEEL reply is committed into an Introduction-phase World through the Stage 4 path.
CREATE OR REPLACE FUNCTION shared_private.complete_shared_world_qandeel_reply_v1(p_lease_id uuid, p_human_command_id uuid, p_world_id uuid, p_body_text text, p_effective_context_ref text, p_output_digest text, p_source_disclosure_gate_ref text, p_authority_revalidation_ref text, p_readiness_ref text, p_audience_snapshot_ref text, p_material_source_ids uuid[], p_reasoning_source_refs text[])
 RETURNS TABLE(outcome text, material_id uuid, established_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_human public.shared_world_material_commit_commands;
  v_reply_command uuid;
  v_material uuid;
  v_item uuid;
  v_committed public.shared_world_material_commit_commands;
  v_gate record;
  v_result record;
BEGIN
  IF p_lease_id IS NULL OR p_human_command_id IS NULL OR p_world_id IS NULL OR p_body_text IS NULL
     OR length(btrim(p_body_text)) = 0 THEN
    RAISE EXCEPTION 'SHARED_QANDEEL_REPLY_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_reply_command := shared_private.derive_shared_conversation_identity_v1('QANDEEL_REPLY_COMMAND', p_human_command_id);
  v_material := shared_private.derive_shared_conversation_identity_v1('QANDEEL_REPLY_MATERIAL', p_human_command_id);
  v_item := shared_private.derive_shared_conversation_identity_v1('QANDEEL_REPLY_HISTORY_ITEM', p_human_command_id);

  -- First, before any answer: a human request initiated this generation — a HUMAN_TEXT command committed by a human
  -- into this exact World. Anything else (an unknown command, another World's command) is one UNAVAILABLE that reveals
  -- no reply and changes nothing. A read with no lock, so the lock order below is unchanged.
  SELECT * INTO v_human FROM public.shared_world_material_commit_commands c WHERE c.id = p_human_command_id;
  IF NOT FOUND OR v_human.world_id <> p_world_id OR v_human.producer_kind <> 'HUMAN'
     OR v_human.material_kind <> 'HUMAN_TEXT' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  -- At most one reply per logical human request: an already committed reply of this same World is the answer,
  -- whatever is offered now.
  SELECT * INTO v_committed FROM public.shared_world_material_commit_commands c
   WHERE c.id = v_reply_command AND c.world_id = p_world_id AND c.producer_kind = 'QANDEEL';
  IF FOUND THEN
    PERFORM shared_private.end_shared_qandeel_reply_work_v1(p_human_command_id, p_lease_id);
    RETURN QUERY SELECT 'MATERIAL_COMMITTED'::text, v_committed.material_id, v_committed.committed_at;
    RETURN;
  END IF;

  -- LOCK ORDER STEP 0: the current conversation-capability snapshot, FOR SHARE until this transaction ends.
  SELECT * INTO v_gate FROM shared_private.bind_shared_launch_gate_v1('SHARED_CONVERSATION');
  IF v_gate.verdict <> 'ALLOW' THEN
    PERFORM shared_private.end_shared_qandeel_reply_work_v1(p_human_command_id, p_lease_id);
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  -- Only the holder of this command's CURRENT lease commits. The lease row is locked, so no concurrent begin can
  -- replace it underneath this commit.
  PERFORM 1 FROM shared_private.shared_qandeel_reply_work_leases l
   WHERE l.human_command_id = p_human_command_id AND l.lease_id = p_lease_id AND l.world_id = p_world_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;
  -- S6-02 (D4): the Stage 4 reply path commits nothing into an Introduction-phase World.
  IF NOT EXISTS (SELECT 1 FROM public.shared_worlds w WHERE w.id = p_world_id AND w.phase = 'STANDARD') THEN
    PERFORM shared_private.end_shared_qandeel_reply_work_v1(p_human_command_id, p_lease_id);
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  BEGIN
    SELECT c.committed_material_id, c.material_established_at INTO v_result
      FROM public.commit_shared_world_qandeel_material_v1(
             v_reply_command, p_world_id, v_material, v_item, 'QANDEEL_OUTPUT', p_body_text,
             p_effective_context_ref, p_output_digest, p_source_disclosure_gate_ref,
             p_authority_revalidation_ref, p_readiness_ref, p_audience_snapshot_ref,
             coalesce(p_material_source_ids, ARRAY[]::uuid[]), coalesce(p_reasoning_source_refs, ARRAY[]::text[])) c;
  EXCEPTION
    WHEN no_data_found THEN
      PERFORM shared_private.end_shared_qandeel_reply_work_v1(p_human_command_id, p_lease_id);
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
      RETURN;
    WHEN serialization_failure THEN
      -- SHARED_WORLD_MATERIAL_STALE: the audience, the World or a source moved since the evidence was produced.
      PERFORM shared_private.end_shared_qandeel_reply_work_v1(p_human_command_id, p_lease_id);
      RETURN QUERY SELECT 'STALE'::text, NULL::uuid, NULL::timestamptz;
      RETURN;
  END;

  PERFORM shared_private.end_shared_qandeel_reply_work_v1(p_human_command_id, p_lease_id);
  RETURN QUERY SELECT 'MATERIAL_COMMITTED'::text, v_result.committed_material_id, v_result.material_established_at;
END$function$
;

-- ---------------------------------------------------------------------------
-- 6. S4-03 lifecycle and governance (0140)
-- ---------------------------------------------------------------------------

-- shared_private.list_own_shared_world_member_handles_v1(uuid)
--   A / D2: the member name is the S6-02 projection.
CREATE OR REPLACE FUNCTION shared_private.list_own_shared_world_member_handles_v1(p_world_id uuid)
 RETURNS TABLE(member_handle uuid, member_name text, is_self boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR NOT shared_private.is_current_shared_member_v1(p_world_id, v_user) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT shared_private.shared_member_handle_v1(p_world_id, e.user_id), shared_private.shared_person_name_v1(p_world_id, e.user_id, v_user), COALESCE(e.user_id = v_user, false)
      FROM public.shared_world_membership_episodes e JOIN public.users u ON u.id = e.user_id
     WHERE e.world_id = p_world_id AND e.ended_at IS NULL
     ORDER BY e.joined_at, e.id;
END$function$
;

-- shared_private.list_own_shared_world_proposals_v1(uuid)
--   A / D2: the proposer and removal-target names are the S6-02 projection.
CREATE OR REPLACE FUNCTION shared_private.list_own_shared_world_proposals_v1(p_world_id uuid)
 RETURNS TABLE(proposal_id uuid, operation_kind text, created_at timestamp with time zone, proposer_name text, proposer_is_self boolean, target_name text, proposed_name text, proposed_description text, proposed_topic text, approved_by_self boolean, approved_count integer, required_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR NOT shared_private.is_current_shared_member_v1(p_world_id, v_user) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT p.id, p.operation_kind, p.created_at, shared_private.shared_person_name_v1(p.world_id, o.proposer_user_id, v_user), COALESCE(o.proposer_user_id = v_user, false),
           CASE WHEN p.operation_kind = 'REMOVE_MEMBER' THEN shared_private.shared_person_name_v1(p.world_id, rp.target_user_id, v_user) END,
           sv.name, sv.description, sv.topic,
           COALESCE(EXISTS (SELECT 1 FROM public.shared_world_governance_approvals a
                             WHERE a.proposal_id = p.id AND a.membership_episode_id = mine.id), false),
           COALESCE(pg.approved_count, 0), COALESCE(pg.required_count, 0)
      FROM public.shared_world_governance_proposals p
      JOIN public.shared_world_membership_episodes mine
        ON mine.world_id = p.world_id AND mine.user_id = v_user AND mine.ended_at IS NULL
      JOIN public.shared_world_membership_snapshot_members sm
        ON sm.membership_snapshot_id = p.membership_snapshot_id AND sm.membership_episode_id = mine.id
      CROSS JOIN LATERAL shared_private.shared_proposal_progress_v1(p.id) pg
      LEFT JOIN shared_private.shared_governance_proposal_origins o ON o.governance_proposal_id = p.id
      LEFT JOIN public.users pu ON pu.id = o.proposer_user_id
      LEFT JOIN public.shared_world_remove_member_payload_versions rp ON rp.governance_proposal_id = p.id
      LEFT JOIN public.users tu ON tu.id = rp.target_user_id
      LEFT JOIN public.shared_world_settings_versions sv ON sv.governance_proposal_id = p.id
     WHERE p.world_id = p_world_id
       AND p.operation_kind IN ('REMOVE_MEMBER', 'WORLD_SETTINGS_CHANGE', 'END_WORLD', 'ADD_MEMBER', 'REJOIN_MEMBER')
       AND p.excluded_membership_episode_id IS DISTINCT FROM mine.id
       AND shared_private.is_current_shared_proposal_topology_v1(p.id)
       AND shared_private.is_actionable_shared_reachability_v1(p.id)
       AND NOT shared_private.is_committed_shared_proposal_v1(p.id)
       AND pg.approved_count < pg.required_count
     ORDER BY p.created_at, p.id;
END$function$
;

-- shared_private.list_own_shared_history_share_candidates_v1(uuid, uuid, timestamp with time zone, uuid, integer)
--   A / D2: the author name is the S6-02 projection.
CREATE OR REPLACE FUNCTION shared_private.list_own_shared_history_share_candidates_v1(p_world_id uuid, p_member_handle uuid, p_before_established_at timestamp with time zone, p_before_material_id uuid, p_limit integer)
 RETURNS TABLE(material_id uuid, established_at timestamp with time zone, is_self boolean, author_name text, text_body text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_grantee uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR p_member_handle IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 100
     OR ((p_before_established_at IS NULL) <> (p_before_material_id IS NULL)) THEN
    RAISE EXCEPTION 'SHARED_HISTORY_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT shared_private.is_current_shared_member_v1(p_world_id, v_user) THEN
    RETURN;
  END IF;
  SELECT e.user_id INTO v_grantee FROM public.shared_world_membership_episodes e
   WHERE e.world_id = p_world_id AND e.ended_at IS NULL AND e.user_id <> v_user
     AND shared_private.shared_member_handle_v1(p_world_id, e.user_id) = p_member_handle;
  IF v_grantee IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT m.id, m.established_at, COALESCE(m.author_user_id = v_user, false), shared_private.shared_person_name_v1(p_world_id, m.author_user_id, v_user), b.body_text
      FROM shared_private.shared_history_share_candidates_v1(p_world_id, v_user, v_grantee) c
      JOIN public.shared_world_materials m ON m.id = c.material_id
      JOIN public.shared_world_text_material_bodies b ON b.material_id = m.id
      JOIN public.users u ON u.id = m.author_user_id
     WHERE p_before_established_at IS NULL
        OR (m.established_at, m.id) < (p_before_established_at, p_before_material_id)
     ORDER BY m.established_at DESC, m.id DESC
     LIMIT p_limit;
END$function$
;

-- shared_private.list_own_shared_history_share_requests_v1(uuid)
--   A / D2: the grantee name is the S6-02 projection.
CREATE OR REPLACE FUNCTION shared_private.list_own_shared_history_share_requests_v1(p_world_id uuid)
 RETURNS TABLE(package_id uuid, created_at timestamp with time zone, grantee_name text, approved_by_self boolean, material_id uuid, established_at timestamp with time zone, text_body text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR NOT shared_private.is_current_shared_member_v1(p_world_id, v_user) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT mv.id, mv.created_at, shared_private.shared_person_name_v1(mv.world_id, mv.grantee_user_id, v_user),
           COALESCE(EXISTS (SELECT 1 FROM public.shared_world_history_package_approvals a
                             WHERE a.manifest_version_id = mv.id AND a.approver_user_id = v_user), false),
           m.id, m.established_at, b.body_text
      FROM public.shared_world_history_package_manifest_versions mv
      JOIN public.shared_world_history_package_required_approvers ra ON ra.manifest_version_id = mv.id AND ra.approver_user_id = v_user
      JOIN public.users gu ON gu.id = mv.grantee_user_id
      JOIN public.shared_world_membership_episodes ge ON ge.id = mv.grantee_membership_episode_id AND ge.ended_at IS NULL
      JOIN public.shared_world_history_package_manifest_items mi ON mi.manifest_version_id = mv.id
      JOIN public.shared_world_materials m ON m.history_item_id = mi.history_item_id AND m.author_user_id = v_user
      JOIN public.shared_world_text_material_bodies b ON b.material_id = m.id
     WHERE mv.world_id = p_world_id
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_history_access_grants g WHERE g.manifest_version_id = mv.id)
       AND NOT EXISTS (SELECT 1 FROM public.shared_world_history_package_manifest_items x
                         JOIN public.shared_world_history_items i ON i.id = x.history_item_id
                        WHERE x.manifest_version_id = mv.id
                          AND (i.availability_state <> 'AVAILABLE' OR i.availability_revision <> x.captured_availability_revision))
     ORDER BY mv.created_at, mv.id, m.established_at, m.id;
END$function$
;

-- shared_private.list_own_closed_shared_world_members_v1()
--   A / D2: a closed Matching-born World keeps the S6-02 projection; SUCCESS and closure widen nothing.
CREATE OR REPLACE FUNCTION shared_private.list_own_closed_shared_world_members_v1()
 RETURNS TABLE(world_id uuid, is_self boolean, member_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT other.world_id, COALESCE(other.user_id = v_user, false), shared_private.shared_person_name_v1(other.world_id, other.user_id, v_user)
      FROM public.shared_world_standard_closed_view_entitlements mine
      JOIN public.shared_worlds w ON w.id = mine.world_id AND w.lifecycle = 'READ_ONLY_CLOSED' AND w.phase = 'STANDARD'
      JOIN public.shared_world_standard_closed_view_entitlements other ON other.world_id = mine.world_id
      JOIN public.shared_world_membership_episodes e ON e.id = other.membership_episode_id
      JOIN public.users u ON u.id = other.user_id
     WHERE mine.user_id = v_user
     ORDER BY other.world_id, e.joined_at, e.id;
END$function$
;

-- shared_private.list_own_closed_shared_world_material_v1(uuid, timestamp with time zone, uuid, integer)
--   A / D2: the author name is the S6-02 projection.
CREATE OR REPLACE FUNCTION shared_private.list_own_closed_shared_world_material_v1(p_world_id uuid, p_before_established_at timestamp with time zone, p_before_material_id uuid, p_limit integer)
 RETURNS TABLE(material_id uuid, producer_kind text, established_at timestamp with time zone, is_self boolean, author_name text, text_body text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 200
     OR ((p_before_established_at IS NULL) <> (p_before_material_id IS NULL)) THEN
    RAISE EXCEPTION 'SHARED_MATERIAL_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shared_world_standard_closed_view_entitlements ent
                   JOIN public.shared_worlds w ON w.id = ent.world_id
                  WHERE ent.world_id = p_world_id AND ent.user_id = v_user
                    AND w.lifecycle = 'READ_ONLY_CLOSED' AND w.phase = 'STANDARD') THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT m.material_id,
           CASE WHEN m.author_user_id IS NULL THEN 'QANDEEL' ELSE 'HUMAN' END,
           m.established_at,
           COALESCE(m.author_user_id = v_user, false),
           CASE WHEN m.author_user_id IS NULL THEN NULL ELSE shared_private.shared_person_name_v1(p_world_id, m.author_user_id, v_user) END,
           m.text_body
      FROM public.resolve_shared_world_material_v1(p_world_id, v_user) m
      LEFT JOIN public.users u ON u.id = m.author_user_id
     WHERE m.text_body IS NOT NULL
       AND (p_before_established_at IS NULL
            OR (m.established_at, m.material_id) < (p_before_established_at, p_before_material_id))
     ORDER BY m.established_at DESC, m.material_id DESC
     LIMIT p_limit;
END$function$
;

-- shared_private.list_own_shared_membership_requests_v1()
--   A / D2: the proposer name a request target sees is the S6-02 projection.
CREATE OR REPLACE FUNCTION shared_private.list_own_shared_membership_requests_v1()
 RETURNS TABLE(request_id uuid, world_id uuid, request_kind text, proposer_name text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.world_id, p.operation_kind, shared_private.shared_person_name_v1(p.world_id, o.proposer_user_id, v_user), p.created_at
      FROM public.shared_world_governance_proposals p
      JOIN shared_private.shared_governance_proposal_origins o ON o.governance_proposal_id = p.id
      JOIN public.users pu ON pu.id = o.proposer_user_id
      JOIN public.shared_worlds w ON w.id = p.world_id AND w.lifecycle = 'ACTIVE' AND w.phase = 'STANDARD'
     WHERE p.operation_kind IN ('ADD_MEMBER', 'REJOIN_MEMBER')
       AND shared_private.shared_reachability_target_v1(p.id) = v_user
       AND shared_private.is_actionable_shared_reachability_v1(p.id)
       AND shared_private.is_current_shared_proposal_topology_v1(p.id)
       AND ((p.operation_kind = 'ADD_MEMBER'
             AND EXISTS (SELECT 1 FROM public.shared_world_member_invitations i
                          WHERE i.governance_proposal_id = p.id AND i.target_user_id = v_user AND i.invitation_state = 'PENDING'))
         OR (p.operation_kind = 'REJOIN_MEMBER'
             AND NOT EXISTS (SELECT 1 FROM public.shared_world_member_rejoin_commands c WHERE c.governance_proposal_id = p.id)
             AND COALESCE((SELECT pg.approved_count >= pg.required_count FROM shared_private.shared_proposal_progress_v1(p.id) pg), false)))
     ORDER BY p.created_at, p.id;
END$function$
;

-- shared_private.propose_shared_world_member_v1(uuid, uuid, text)
--   A1 / D3: no ADD_MEMBER or REJOIN_MEMBER is created in a Matching-born World.
CREATE OR REPLACE FUNCTION shared_private.propose_shared_world_member_v1(p_command_id uuid, p_world_id uuid, p_shared_id text)
 RETURNS TABLE(outcome text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_canonical text;
  v_ref text;
  v_digest uuid;
  v_proposal uuid;
  v_family text;
  v_gate record;
  v_target uuid;
  v_epoch bigint;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_MEMBER_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_proposal := shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL', p_command_id::text);
  v_canonical := account_private.normalize_shared_id_v1(p_shared_id);

  -- Exact World, family, request (the same Shared ID, proven by digest — the ID itself is never kept) and human BEFORE
  -- any replay answer.
  v_family := shared_private.shared_lifecycle_command_family_v1(p_command_id);
  IF v_family IS NOT NULL THEN
    IF v_family = 'PROPOSAL' AND v_canonical IS NOT NULL AND EXISTS (
         SELECT 1 FROM shared_private.shared_governance_proposal_origins o
           JOIN public.shared_world_governance_proposals p ON p.id = o.governance_proposal_id
          WHERE o.governance_proposal_id = v_proposal AND o.world_id = p_world_id AND p.world_id = p_world_id
            AND o.proposer_user_id = v_user AND o.operation_kind IN ('ADD_MEMBER', 'REJOIN_MEMBER')
            AND o.request_digest = shared_private.derive_shared_lifecycle_identity_v1('MEMBER_REQUEST',
                  p_command_id::text || ':' || account_private.shared_id_lookup_ref_v1(v_canonical))) THEN
      RETURN QUERY SELECT 'SUBMITTED'::text;
    ELSE
      RETURN QUERY SELECT 'UNAVAILABLE'::text;
    END IF;
    RETURN;
  END IF;
  IF v_canonical IS NULL THEN
    RETURN QUERY SELECT 'INVALID_SHARED_ID'::text;
    RETURN;
  END IF;

  SELECT * INTO v_gate FROM shared_private.bind_shared_launch_gate_v1('SHARED_GOVERNANCE');
  IF v_gate.verdict <> 'ALLOW' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  PERFORM 1 FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT shared_private.is_current_shared_member_v1(p_world_id, v_user) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  -- S6-02 (A1 / D3): a Matching-born World stays the two humans it was born with - no third member, no rejoin,
  -- not even of an original human - decided under the World row lock above. The answer is the bounded UNAVAILABLE.
  IF NOT EXISTS (SELECT 1 FROM public.shared_worlds w WHERE w.id = p_world_id AND w.birth_basis = 'ACCEPTED_INVITATION') THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;

  v_ref := account_private.shared_id_lookup_ref_v1(v_canonical);
  v_digest := shared_private.derive_shared_lifecycle_identity_v1('MEMBER_REQUEST', p_command_id::text || ':' || v_ref);
  -- LOCK ORDER STEP 2: the target's credential row, found by exact CURRENT reference only. A reference that matches
  -- nothing (never issued, or rotated away) is already the bounded non-enumerating answer.
  SELECT s.user_id, s.epoch INTO v_target, v_epoch
    FROM public.shared_world_invite_credential_state s WHERE s.credential_lookup_ref = v_ref FOR SHARE;
  IF NOT FOUND OR v_target = v_user THEN
    RETURN QUERY SELECT 'SUBMITTED'::text;
    RETURN;
  END IF;
  -- Already a current member, or already asked for at this exact epoch by a request that is still live: nothing new.
  IF EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
              WHERE e.world_id = p_world_id AND e.user_id = v_target AND e.ended_at IS NULL)
     OR EXISTS (SELECT 1 FROM shared_private.shared_governance_proposal_origins o
                 WHERE o.world_id = p_world_id AND o.operation_kind IN ('ADD_MEMBER', 'REJOIN_MEMBER')
                   AND o.target_credential_epoch = v_epoch
                   AND shared_private.shared_reachability_target_v1(o.governance_proposal_id) = v_target
                   AND shared_private.is_current_shared_proposal_topology_v1(o.governance_proposal_id)
                   AND NOT EXISTS (SELECT 1 FROM public.shared_world_member_invitations i
                                    WHERE i.governance_proposal_id = o.governance_proposal_id AND i.invitation_state <> 'PENDING')
                   AND NOT EXISTS (SELECT 1 FROM public.shared_world_member_rejoin_commands c
                                    WHERE c.governance_proposal_id = o.governance_proposal_id)) THEN
    RETURN QUERY SELECT 'SUBMITTED'::text;
    RETURN;
  END IF;
  BEGIN
    IF EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e WHERE e.world_id = p_world_id AND e.user_id = v_target) THEN
      PERFORM 1 FROM public.prepare_shared_world_rejoin_governance_v1(
        v_proposal, shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL_SNAPSHOT', p_command_id::text),
        shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL_PAYLOAD', p_command_id::text), p_world_id, v_target);
    ELSE
      PERFORM 1 FROM public.prepare_shared_world_add_member_governance_v1(
        v_proposal, shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL_SNAPSHOT', p_command_id::text),
        shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL_PAYLOAD', p_command_id::text), p_world_id, v_target);
    END IF;
    PERFORM shared_private.record_shared_proposal_origin_v1(v_proposal, p_command_id, v_user, v_epoch, v_digest);
  EXCEPTION
    WHEN no_data_found THEN
      -- The frozen core's bounded refusal: the same answer as every other well-formed Shared ID.
      RETURN QUERY SELECT 'SUBMITTED'::text;
      RETURN;
    WHEN unique_violation THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text;
      RETURN;
  END;
  RETURN QUERY SELECT 'SUBMITTED'::text;
END$function$
;

-- shared_private.approve_shared_world_proposal_v1(uuid, uuid, uuid)
--   A1 / D3: no ADD_MEMBER or REJOIN_MEMBER of a Matching-born World is approved, dispatched or proven complete, whenever it was proposed.
CREATE OR REPLACE FUNCTION shared_private.approve_shared_world_proposal_v1(p_command_id uuid, p_world_id uuid, p_proposal_id uuid)
 RETURNS TABLE(outcome text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_approval uuid;
  v_family text;
  v_gate record;
  v_kind text;
  v_operation uuid;
  v_event uuid;
  v_payload uuid;
  v_done text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_proposal_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_APPROVAL_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_approval := shared_private.derive_shared_lifecycle_identity_v1('APPROVAL', p_command_id::text);
  -- The proposal must belong to the exact supplied World and be one this boundary governs, before anything else.
  SELECT p.operation_kind, p.proposed_payload_version_id INTO v_kind, v_payload FROM public.shared_world_governance_proposals p
   WHERE p.id = p_proposal_id AND p.world_id = p_world_id
     AND p.operation_kind IN ('REMOVE_MEMBER', 'WORLD_SETTINGS_CHANGE', 'END_WORLD', 'ADD_MEMBER', 'REJOIN_MEMBER');
  IF v_kind IS NULL THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  -- What a completed set of this proposal is called: an applied operation, or an add / rejoin now waiting for the person.
  v_done := CASE WHEN v_kind IN ('ADD_MEMBER', 'REJOIN_MEMBER') THEN 'INVITED' ELSE 'COMMITTED' END;

  -- Exact World, proposal, family and human BEFORE any replay answer.
  v_family := shared_private.shared_lifecycle_command_family_v1(p_command_id);
  IF v_family IS NOT NULL THEN
    IF v_family = 'APPROVAL' AND EXISTS (
         SELECT 1 FROM public.shared_world_governance_approvals a
           JOIN public.shared_world_membership_episodes e ON e.id = a.membership_episode_id
          WHERE a.id = v_approval AND a.proposal_id = p_proposal_id AND e.world_id = p_world_id AND e.user_id = v_user) THEN
      RETURN QUERY SELECT CASE WHEN shared_private.is_committed_shared_proposal_v1(p_proposal_id)
                                 OR (v_kind = 'REJOIN_MEMBER' AND COALESCE((SELECT pg.approved_count >= pg.required_count
                                       FROM shared_private.shared_proposal_progress_v1(p_proposal_id) pg), false))
                               THEN v_done ELSE 'APPROVED' END;
    ELSE
      RETURN QUERY SELECT 'UNAVAILABLE'::text;
    END IF;
    RETURN;
  END IF;

  SELECT * INTO v_gate FROM shared_private.bind_shared_launch_gate_v1('SHARED_GOVERNANCE');
  IF v_gate.verdict <> 'ALLOW' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  -- LOCK ORDER STEP 1: the World row, before the proposal (the frozen primitives re-take it, a no-op here).
  PERFORM 1 FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  -- S6-02 (A1 / D3): a Matching-born World stays the two humans it was born with - no third member, no rejoin,
  -- not even of an original human - decided under the World row lock above. The answer is the bounded UNAVAILABLE.
  IF v_kind IN ('ADD_MEMBER', 'REJOIN_MEMBER')
     AND NOT EXISTS (SELECT 1 FROM public.shared_worlds w WHERE w.id = p_world_id AND w.birth_basis = 'ACCEPTED_INVITATION') THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  IF v_kind IN ('ADD_MEMBER', 'REJOIN_MEMBER') THEN
    -- LOCK ORDER STEP 2: the target's credential row (a racing rotation waits or has already committed), then the
    -- exact Shared-ID epoch binding. A rotation ends the request for good; nothing is recorded.
    PERFORM 1 FROM public.shared_world_invite_credential_state s
      WHERE s.user_id = shared_private.shared_reachability_target_v1(p_proposal_id) FOR SHARE;
    IF NOT shared_private.is_actionable_shared_reachability_v1(p_proposal_id) THEN
      RETURN QUERY SELECT 'STALE'::text;
      RETURN;
    END IF;
  END IF;
  -- This human already approved this proposal (under another command): the same truthful answer.
  IF EXISTS (SELECT 1 FROM public.shared_world_governance_approvals a
               JOIN public.shared_world_membership_episodes e ON e.id = a.membership_episode_id
              WHERE a.proposal_id = p_proposal_id AND e.world_id = p_world_id AND e.user_id = v_user AND e.ended_at IS NULL) THEN
    RETURN QUERY SELECT CASE WHEN shared_private.is_committed_shared_proposal_v1(p_proposal_id)
                               OR (v_kind = 'REJOIN_MEMBER' AND COALESCE((SELECT pg.approved_count >= pg.required_count
                                     FROM shared_private.shared_proposal_progress_v1(p_proposal_id) pg), false))
                             THEN v_done ELSE 'APPROVED' END;
    RETURN;
  END IF;
  BEGIN
    PERFORM 1 FROM public.commit_shared_world_governance_approval_v1(v_approval, p_proposal_id);
  EXCEPTION
    WHEN serialization_failure THEN
      RETURN QUERY SELECT 'STALE'::text;
      RETURN;
    WHEN no_data_found OR unique_violation THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text;
      RETURN;
  END;

  -- The operation, if (and only if) the exact approval set is now complete. Its identities belong to the PROPOSAL.
  v_operation := shared_private.derive_shared_lifecycle_identity_v1('OPERATION_COMMAND', p_proposal_id::text);
  v_event := shared_private.derive_shared_lifecycle_identity_v1('OPERATION_EVENT', p_proposal_id::text);
  BEGIN
    IF v_kind = 'REMOVE_MEMBER' THEN
      PERFORM 1 FROM public.commit_shared_world_member_removal_v1(v_operation, p_proposal_id, v_event);
    ELSIF v_kind = 'WORLD_SETTINGS_CHANGE' THEN
      PERFORM 1 FROM public.commit_shared_world_settings_change_v1(v_operation, p_proposal_id, v_event);
    ELSIF v_kind = 'END_WORLD' THEN
      PERFORM 1 FROM public.commit_shared_world_standard_end_v1(v_operation, p_proposal_id, v_event);
    ELSIF v_kind = 'ADD_MEMBER' THEN
      -- The one effective member invitation of this proposal (the frozen dispatch revalidates the exact approval set).
      PERFORM 1 FROM public.dispatch_shared_world_member_invitation_v1(
        shared_private.derive_shared_lifecycle_identity_v1('MEMBER_INVITATION', p_proposal_id::text), p_proposal_id);
    ELSE
      -- A rejoin has no invitation in the frozen runtime: the satisfied set is proven now; the target commits it.
      PERFORM 1 FROM public.resolve_shared_world_governance_approval_v1(p_proposal_id, 'REJOIN_MEMBER', v_payload);
    END IF;
  EXCEPTION
    WHEN object_not_in_prerequisite_state THEN
      -- SHARED_WORLD_GOVERNANCE_APPROVALS_INCOMPLETE: the approval stands; the operation waits for the others.
      RETURN QUERY SELECT 'APPROVED'::text;
      RETURN;
    WHEN serialization_failure THEN
      RETURN QUERY SELECT 'STALE'::text;
      RETURN;
  END;
  RETURN QUERY SELECT v_done;
END$function$
;

-- shared_private.accept_shared_membership_request_v1(uuid, uuid, uuid)
--   A1 / D3: nobody joins or rejoins a Matching-born World, whatever request they hold.
CREATE OR REPLACE FUNCTION shared_private.accept_shared_membership_request_v1(p_command_id uuid, p_world_id uuid, p_request_id uuid)
 RETURNS TABLE(outcome text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_family text;
  v_gate record;
  v_kind text;
  v_invitation uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_ACCEPTANCE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT p.operation_kind INTO v_kind FROM public.shared_world_governance_proposals p
   WHERE p.id = p_request_id AND p.world_id = p_world_id AND p.operation_kind IN ('ADD_MEMBER', 'REJOIN_MEMBER');
  IF v_kind IS NULL THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  v_invitation := shared_private.derive_shared_lifecycle_identity_v1('MEMBER_INVITATION', p_request_id::text);

  -- Exact World, request, family and human BEFORE any replay answer.
  v_family := shared_private.shared_lifecycle_command_family_v1(p_command_id);
  IF v_family IS NOT NULL THEN
    IF v_family = 'ACCEPTANCE' AND (
         EXISTS (SELECT 1 FROM public.shared_world_member_acceptance_commands c
                  WHERE c.id = p_command_id AND c.actor_user_id = v_user AND c.world_id = p_world_id
                    AND c.member_invitation_id = v_invitation)
         OR EXISTS (SELECT 1 FROM public.shared_world_member_rejoin_commands c
                     WHERE c.id = p_command_id AND c.actor_user_id = v_user AND c.world_id = p_world_id
                       AND c.governance_proposal_id = p_request_id)) THEN
      RETURN QUERY SELECT 'JOINED'::text;
    ELSE
      RETURN QUERY SELECT 'UNAVAILABLE'::text;
    END IF;
    RETURN;
  END IF;

  SELECT * INTO v_gate FROM shared_private.bind_shared_launch_gate_v1('SHARED_GOVERNANCE');
  IF v_gate.verdict <> 'ALLOW' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  PERFORM 1 FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  -- S6-02 (A1 / D3): a Matching-born World stays the two humans it was born with - no third member, no rejoin,
  -- not even of an original human - decided under the World row lock above. The answer is the bounded UNAVAILABLE.
  IF NOT EXISTS (SELECT 1 FROM public.shared_worlds w WHERE w.id = p_world_id AND w.birth_basis = 'ACCEPTED_INVITATION') THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  -- LOCK ORDER STEP 2: the caller's own credential row, then the exact target and the exact epoch binding.
  PERFORM 1 FROM public.shared_world_invite_credential_state s WHERE s.user_id = v_user FOR SHARE;
  IF shared_private.shared_reachability_target_v1(p_request_id) IS DISTINCT FROM v_user
     OR NOT shared_private.is_actionable_shared_reachability_v1(p_request_id) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  BEGIN
    IF v_kind = 'ADD_MEMBER' THEN
      PERFORM 1 FROM public.accept_shared_world_member_invitation_v1(
        p_command_id, v_invitation,
        shared_private.derive_shared_lifecycle_identity_v1('MEMBER_EPISODE', p_command_id::text),
        shared_private.derive_shared_lifecycle_identity_v1('MEMBER_JOINED_EVENT', p_command_id::text));
    ELSE
      PERFORM 1 FROM public.commit_shared_world_member_rejoin_v1(
        p_command_id, p_request_id,
        shared_private.derive_shared_lifecycle_identity_v1('MEMBER_EPISODE', p_command_id::text),
        shared_private.derive_shared_lifecycle_identity_v1('MEMBER_REJOINED_EVENT', p_command_id::text));
    END IF;
  EXCEPTION
    WHEN no_data_found OR unique_violation OR serialization_failure OR object_not_in_prerequisite_state THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text;
      RETURN;
  END;
  RETURN QUERY SELECT 'JOINED'::text;
END$function$
;

-- ---------------------------------------------------------------------------
-- 7. S4-04 Activity source and per-World alerts (0141)
-- ---------------------------------------------------------------------------

-- public.server_read_shared_activity_source_v1(text, uuid)
--   D4: no Stage 4 Activity is derived for an Introduction-phase World; A / D2: actor and subject names are the S6-02 projection for each recipient.
CREATE OR REPLACE FUNCTION public.server_read_shared_activity_source_v1(p_source_kind text, p_source_id uuid)
 RETURNS TABLE(recipient_user_id uuid, world_id uuid, world_name text, actor_name text, subject_name text, operation_kind text, occurred_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_world uuid;
  v_actor uuid;
  v_at timestamptz;
BEGIN
  IF p_source_kind IS NULL OR p_source_id IS NULL
     OR p_source_kind NOT IN ('HUMAN_TEXT', 'PROPOSAL', 'MEMBER_REQUEST', 'JOINED', 'BIRTH', 'LEFT') THEN
    RAISE EXCEPTION 'SHARED_ACTIVITY_SOURCE_INVALID' USING ERRCODE = '22023';
  END IF;

  IF p_source_kind = 'HUMAN_TEXT' THEN
    SELECT m.world_id, m.author_user_id, m.established_at INTO v_world, v_actor, v_at
      FROM public.shared_world_materials m
     WHERE m.id = p_source_id AND m.material_kind = 'HUMAN_TEXT' AND m.producer_kind = 'HUMAN';
    IF v_world IS NULL THEN RETURN; END IF;
    RETURN QUERY
      SELECT e.user_id, v_world, shared_private.shared_activity_world_name_v1(v_world), shared_private.shared_person_name_v1(v_world, v_actor, e.user_id), NULL::text, NULL::text, v_at
        FROM public.shared_world_membership_episodes e
        JOIN public.shared_worlds w ON w.id = e.world_id AND w.lifecycle = 'ACTIVE' AND w.phase = 'STANDARD'
        LEFT JOIN public.users au ON au.id = v_actor
       WHERE e.world_id = v_world AND e.ended_at IS NULL AND e.user_id <> v_actor
         AND EXISTS (SELECT 1 FROM public.resolve_shared_world_material_v1(v_world, e.user_id) r WHERE r.material_id = p_source_id)
       ORDER BY e.user_id;
    RETURN;
  END IF;

  IF p_source_kind = 'PROPOSAL' THEN
    RETURN QUERY
      SELECT e.user_id, p.world_id, shared_private.shared_activity_world_name_v1(p.world_id), shared_private.shared_person_name_v1(p.world_id, o.proposer_user_id, e.user_id),
             CASE WHEN p.operation_kind = 'REMOVE_MEMBER' THEN shared_private.shared_person_name_v1(p.world_id, rp.target_user_id, e.user_id) END, p.operation_kind, p.created_at
        FROM public.shared_world_governance_proposals p
        JOIN shared_private.shared_governance_proposal_origins o ON o.governance_proposal_id = p.id
        JOIN public.shared_world_membership_snapshot_members sm ON sm.membership_snapshot_id = p.membership_snapshot_id
        JOIN public.shared_world_membership_episodes e ON e.id = sm.membership_episode_id AND e.world_id = p.world_id AND e.ended_at IS NULL
        LEFT JOIN public.users pu ON pu.id = o.proposer_user_id
        LEFT JOIN public.shared_world_remove_member_payload_versions rp ON rp.governance_proposal_id = p.id
        LEFT JOIN public.users tu ON tu.id = rp.target_user_id
       WHERE p.id = shared_private.derive_shared_lifecycle_identity_v1('PROPOSAL', p_source_id::text)
         AND p.operation_kind IN ('REMOVE_MEMBER', 'WORLD_SETTINGS_CHANGE', 'END_WORLD', 'ADD_MEMBER', 'REJOIN_MEMBER')
         AND e.user_id <> o.proposer_user_id
         AND e.id IS DISTINCT FROM p.excluded_membership_episode_id
         AND shared_private.is_current_shared_member_v1(p.world_id, e.user_id)
         AND shared_private.is_current_shared_proposal_topology_v1(p.id)
         AND shared_private.is_actionable_shared_reachability_v1(p.id)
         AND NOT shared_private.is_committed_shared_proposal_v1(p.id)
       ORDER BY e.user_id;
    RETURN;
  END IF;

  IF p_source_kind = 'MEMBER_REQUEST' THEN
    -- Exactly the S4-03 target read's predicate, for the request's own target: nothing of the World, ever.
    RETURN QUERY
      SELECT t.target, p.world_id, NULL::text, shared_private.shared_person_name_v1(p.world_id, o.proposer_user_id, t.target), NULL::text, p.operation_kind,
             (SELECT max(a.approved_at) FROM public.shared_world_governance_approvals a WHERE a.proposal_id = p.id)
        FROM public.shared_world_governance_proposals p
        JOIN shared_private.shared_governance_proposal_origins o ON o.governance_proposal_id = p.id
        JOIN public.users pu ON pu.id = o.proposer_user_id
        JOIN public.shared_worlds w ON w.id = p.world_id AND w.lifecycle = 'ACTIVE' AND w.phase = 'STANDARD'
        CROSS JOIN LATERAL (SELECT shared_private.shared_reachability_target_v1(p.id) AS target) t
       WHERE p.id = p_source_id
         AND p.operation_kind IN ('ADD_MEMBER', 'REJOIN_MEMBER')
         AND t.target IS NOT NULL
         AND shared_private.is_actionable_shared_reachability_v1(p.id)
         AND shared_private.is_current_shared_proposal_topology_v1(p.id)
         AND ((p.operation_kind = 'ADD_MEMBER'
               AND EXISTS (SELECT 1 FROM public.shared_world_member_invitations i
                            WHERE i.governance_proposal_id = p.id AND i.target_user_id = t.target AND i.invitation_state = 'PENDING'))
           OR (p.operation_kind = 'REJOIN_MEMBER'
               AND NOT EXISTS (SELECT 1 FROM public.shared_world_member_rejoin_commands c WHERE c.governance_proposal_id = p.id)
               AND COALESCE((SELECT pg.approved_count >= pg.required_count FROM shared_private.shared_proposal_progress_v1(p.id) pg), false)));
    RETURN;
  END IF;

  IF p_source_kind = 'JOINED' THEN
    SELECT c.world_id, c.actor_user_id, c.committed_at INTO v_world, v_actor, v_at
      FROM public.shared_world_member_acceptance_commands c WHERE c.id = p_source_id;
    IF v_world IS NULL THEN
      SELECT c.world_id, c.actor_user_id, c.committed_at INTO v_world, v_actor, v_at
        FROM public.shared_world_member_rejoin_commands c WHERE c.id = p_source_id;
    END IF;
  ELSIF p_source_kind = 'BIRTH' THEN
    -- The inviter alone, through the exact birth episode, while it is still open: never a later member.
    RETURN QUERY
      SELECT e.user_id, c.world_id, shared_private.shared_activity_world_name_v1(c.world_id), shared_private.shared_person_name_v1(c.world_id, c.actor_user_id, e.user_id), NULL::text, NULL::text, c.committed_at
        FROM public.shared_world_direct_acceptance_commands c
        JOIN public.shared_world_membership_episodes e ON e.id = c.inviter_membership_episode_id AND e.world_id = c.world_id AND e.ended_at IS NULL
        JOIN public.shared_worlds w ON w.id = c.world_id AND w.lifecycle = 'ACTIVE' AND w.phase = 'STANDARD'
        LEFT JOIN public.users au ON au.id = c.actor_user_id
       WHERE c.world_id = p_source_id AND e.user_id <> c.actor_user_id;
    RETURN;
  ELSE -- LEFT
    SELECT c.world_id, c.actor_user_id, c.committed_at INTO v_world, v_actor, v_at
      FROM public.shared_world_voluntary_leave_commands c WHERE c.id = p_source_id;
  END IF;
  IF v_world IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT e.user_id, v_world, shared_private.shared_activity_world_name_v1(v_world), shared_private.shared_person_name_v1(v_world, v_actor, e.user_id), NULL::text, NULL::text, v_at
      FROM public.shared_world_membership_episodes e
      JOIN public.shared_worlds w ON w.id = e.world_id AND w.lifecycle = 'ACTIVE' AND w.phase = 'STANDARD'
      LEFT JOIN public.users au ON au.id = v_actor
     WHERE e.world_id = v_world AND e.ended_at IS NULL AND e.user_id <> v_actor
     ORDER BY e.user_id;
END$function$
;

-- shared_private.list_own_shared_world_alerts_v1()
--   D4: the per-World alerts list the reader's Stage 4 Worlds only.
CREATE OR REPLACE FUNCTION shared_private.list_own_shared_world_alerts_v1()
 RETURNS TABLE(world_id uuid, muted boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT w.id,
           EXISTS (SELECT 1 FROM public.activity_context_mutes m WHERE m.user_id = v_user AND m.context_ref = w.id::text)
      FROM public.shared_world_membership_episodes e
      JOIN public.shared_worlds w ON w.id = e.world_id
     WHERE e.user_id = v_user AND e.ended_at IS NULL AND w.lifecycle = 'ACTIVE' AND w.phase = 'STANDARD'
     ORDER BY w.born_at, w.id;
END$function$
;

-- shared_private.set_own_shared_world_alerts_v1(uuid, boolean)
--   D4: an Introduction-phase World is not a Stage 4 World whose alerts can be set.
CREATE OR REPLACE FUNCTION shared_private.set_own_shared_world_alerts_v1(p_world_id uuid, p_muted boolean)
 RETURNS TABLE(outcome text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR p_muted IS NULL THEN
    RAISE EXCEPTION 'SHARED_ALERTS_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.shared_world_membership_episodes e
      JOIN public.shared_worlds w ON w.id = e.world_id
     WHERE e.world_id = p_world_id AND e.user_id = v_user AND e.ended_at IS NULL AND w.lifecycle = 'ACTIVE' AND w.phase = 'STANDARD'
  ) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;
  IF p_muted THEN
    INSERT INTO public.activity_context_mutes (user_id, context_ref) VALUES (v_user, p_world_id::text) ON CONFLICT DO NOTHING;
    RETURN QUERY SELECT 'MUTED'::text;
  ELSE
    DELETE FROM public.activity_context_mutes m WHERE m.user_id = v_user AND m.context_ref = p_world_id::text;
    RETURN QUERY SELECT 'UNMUTED'::text;
  END IF;
END$function$
;

-- ---------------------------------------------------------------------------
-- 8. S5-02 Public authoring (0143)
-- ---------------------------------------------------------------------------

-- public_authoring_private.list_own_public_authoring_sources_v1()
--   D5: Introduction-era Shared material is never a Public authoring source; A / D2: the author name is the S6-02 projection.
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
       WHERE m.text_body IS NOT NULL AND m.material_kind IN ('HUMAN_TEXT', 'QANDEEL_OUTPUT', 'QANDEEL_ANALYSIS')
         AND NOT shared_private.is_introduction_era_history_item_v1(v_world, m.history_item_id)
       ORDER BY m.established_at DESC, m.material_id DESC
       LIMIT 50;
  END LOOP;
END$function$
;

-- public_authoring_private.prepare_own_public_experience_package_v1(uuid, uuid, uuid[], uuid[], uuid[])
--   D5: Introduction-era Shared material is never packaged for the Public World.
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
    IF EXISTS (SELECT 1 FROM unnest(p_shared_world_ids, p_shared_material_ids) AS t(world_id, material_id)
                 JOIN public.shared_world_materials sm ON sm.id = t.material_id AND sm.world_id = t.world_id
                WHERE shared_private.is_introduction_era_history_item_v1(sm.world_id, sm.history_item_id)) THEN
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
END$function$
;

-- ---------------------------------------------------------------------------
-- 9. SHARED-VIS-01 field reads (0148)
-- ---------------------------------------------------------------------------

-- shared_semantic_private.is_current_member_v1(uuid, uuid)
--   D4: the Shared field, its places and their sources are not read from an Introduction-phase World.
CREATE OR REPLACE FUNCTION shared_semantic_private.is_current_member_v1(p_world_id uuid, p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e JOIN public.shared_worlds w ON w.id = e.world_id
                  WHERE e.world_id = p_world_id AND e.user_id = p_user AND e.ended_at IS NULL AND w.lifecycle = 'ACTIVE' AND w.phase = 'STANDARD');
$function$
;

-- shared_semantic_private.list_own_shared_semantic_place_sources_v1(uuid, uuid)
--   A / D2: the source author name is the S6-02 projection.
CREATE OR REPLACE FUNCTION shared_semantic_private.list_own_shared_semantic_place_sources_v1(p_world_id uuid, p_place_id uuid)
 RETURNS TABLE(material_id uuid, producer_kind text, is_self boolean, author_name text, text_body text, established_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR p_place_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_SEMANTIC_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT shared_semantic_private.is_current_member_v1(p_world_id, v_user)
     OR NOT EXISTS (SELECT 1 FROM shared_semantic_private.visible_places_v1(p_world_id, v_user) v WHERE v.material_id = p_place_id) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT m.material_id,
           CASE WHEN m.author_user_id IS NULL THEN 'QANDEEL' ELSE 'HUMAN' END,
           COALESCE(m.author_user_id = v_user, false),
           CASE WHEN m.author_user_id IS NULL THEN NULL ELSE shared_private.shared_person_name_v1(p_world_id, m.author_user_id, v_user) END,
           m.text_body, m.established_at
      FROM public.resolve_shared_world_material_v1(p_world_id, v_user) m
      JOIN public.shared_world_material_dependencies d
        ON d.source_material_id = m.material_id AND d.target_material_id = p_place_id AND d.dependency_kind = 'MATERIAL_DEPENDENCY'
      LEFT JOIN public.users u ON u.id = m.author_user_id
     WHERE m.text_body IS NOT NULL
     ORDER BY m.established_at, m.material_id;
END$function$
;

-- shared_semantic_private.list_own_closed_shared_world_material_v2(uuid, timestamp with time zone, uuid, integer)
--   A / D2: the author name is the S6-02 projection.
CREATE OR REPLACE FUNCTION shared_semantic_private.list_own_closed_shared_world_material_v2(p_world_id uuid, p_before_established_at timestamp with time zone, p_before_material_id uuid, p_limit integer)
 RETURNS TABLE(material_id uuid, producer_kind text, established_at timestamp with time zone, is_self boolean, author_name text, text_body text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 200
     OR ((p_before_established_at IS NULL) <> (p_before_material_id IS NULL)) THEN
    RAISE EXCEPTION 'SHARED_MATERIAL_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shared_world_standard_closed_view_entitlements ent
                   JOIN public.shared_worlds w ON w.id = ent.world_id
                  WHERE ent.world_id = p_world_id AND ent.user_id = v_user
                    AND w.lifecycle = 'READ_ONLY_CLOSED' AND w.phase = 'STANDARD') THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT m.material_id,
           CASE WHEN m.author_user_id IS NULL THEN 'QANDEEL' ELSE 'HUMAN' END,
           m.established_at,
           COALESCE(m.author_user_id = v_user, false),
           CASE WHEN m.author_user_id IS NULL THEN NULL ELSE shared_private.shared_person_name_v1(p_world_id, m.author_user_id, v_user) END,
           m.text_body
      FROM public.resolve_shared_world_material_v1(p_world_id, v_user) m
      LEFT JOIN public.users u ON u.id = m.author_user_id
     WHERE m.text_body IS NOT NULL AND m.material_kind <> 'QANDEEL_ANALYSIS'
       AND (p_before_established_at IS NULL
            OR (m.established_at, m.material_id) < (p_before_established_at, p_before_material_id))
     ORDER BY m.established_at DESC, m.material_id DESC
     LIMIT p_limit;
END$function$
;

-- ---------------------------------------------------------------------------
-- 10. Replay capture and source currency (0101)
-- ---------------------------------------------------------------------------

-- public.replay_capture_source_manifest_v1(uuid, uuid, integer, text, uuid, uuid, uuid[], timestamp with time zone)
--   GATE-35 / D5: Introduction-era Shared material is not in the visible set a Replay may capture.
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
           'MY_WORLD', 'ORIGINAL_TEXT',
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
         AND m.material_kind NOT IN ('HUMAN_TEXT', 'HUMAN_VOICE_NOTE', 'QANDEEL_OUTPUT', 'QANDEEL_ANALYSIS')
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
END$function$
;

-- public.derive_replay_source_manifest_currency_v1(uuid)
--   GATE-35 / D5: a captured Introduction-era item is never current, so preview, finalization, distribution and current availability refuse it.
CREATE OR REPLACE FUNCTION public.derive_replay_source_manifest_currency_v1(p_source_manifest_version_id uuid)
 RETURNS TABLE(currency_state text, staleness_class text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  manifest public.replay_source_manifest_versions;
  creator uuid;
  visible uuid[];
BEGIN
  IF p_source_manifest_version_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT m.* INTO manifest FROM public.replay_source_manifest_versions m
   WHERE m.id = p_source_manifest_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT r.created_by_user_id INTO creator FROM public.replays r WHERE r.id = manifest.replay_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  IF manifest.source_class = 'MY_WORLD' THEN
    IF EXISTS (
      SELECT 1 FROM public.replay_source_manifest_items i
       WHERE i.manifest_version_id = manifest.id
         AND NOT EXISTS (SELECT 1 FROM public.conversation_units cu
                          WHERE cu.id = i.personal_conversation_unit_id
                            AND cu.session_id = i.personal_session_id AND cu.user_id = creator
                            AND cu.session_position = i.personal_session_position)
    ) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_UNAVAILABLE'::text; RETURN;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.replay_source_manifest_items i
        JOIN public.conversation_units cu ON cu.id = i.personal_conversation_unit_id
       WHERE i.manifest_version_id = manifest.id
         AND ('sha256:' || encode(sha256(convert_to(cu.committed_text, 'UTF8')), 'hex')) <> i.captured_source_digest
    ) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_CHANGED'::text; RETURN;
    END IF;
  ELSIF manifest.source_class = 'SHARED_WORLD' THEN
    -- DEFENCE IN DEPTH, ANSWERED FIRST. The 0100 same-row guard makes a
    -- malformed binding unrepresentable at INSERT, and this derivation refuses
    -- to bless one anyway: a material and a history item that are each
    -- individually valid, but are not the SAME canonical event, describe a
    -- source that never happened. It can never read CURRENT, whatever the
    -- availability and digests of the independently named rows say.
    IF EXISTS (
      SELECT 1 FROM public.replay_source_manifest_items i
        LEFT JOIN public.shared_world_materials m
          ON m.id = i.shared_material_id AND m.world_id = i.shared_world_id
        LEFT JOIN public.shared_world_history_items h
          ON h.id = i.shared_history_item_id AND h.world_id = i.shared_world_id
       WHERE i.manifest_version_id = manifest.id
         AND (m.id IS NULL OR h.id IS NULL
              OR m.history_item_id IS DISTINCT FROM i.shared_history_item_id
              OR m.material_kind IS DISTINCT FROM i.shared_material_kind
              OR h.occurred_at IS DISTINCT FROM i.shared_occurred_at)
    ) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_CONTRADICTORY'::text; RETURN;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.replay_source_manifest_items i
        JOIN public.shared_world_history_items h ON h.id = i.shared_history_item_id
       WHERE i.manifest_version_id = manifest.id AND h.availability_state <> 'AVAILABLE'
    ) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_UNAVAILABLE'::text; RETURN;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.replay_source_manifest_items i
        JOIN public.shared_world_history_items h ON h.id = i.shared_history_item_id
        JOIN public.shared_world_materials m ON m.id = i.shared_material_id
        LEFT JOIN public.shared_world_text_material_bodies t ON t.material_id = m.id
        LEFT JOIN public.shared_world_voice_note_material_bodies vn ON vn.material_id = m.id
       WHERE i.manifest_version_id = manifest.id
         AND (h.availability_revision <> i.captured_availability_revision
              OR (t.material_id IS NULL AND vn.material_id IS NULL)
              OR ('sha256:' || encode(sha256(convert_to(
                    CASE WHEN m.material_kind = 'HUMAN_VOICE_NOTE'
                         THEN vn.audio_object_ref || E'\n' || coalesce(vn.transcript_text, '')
                         ELSE t.body_text END, 'UTF8')), 'hex')) IS DISTINCT FROM i.captured_source_digest)
    ) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_CHANGED'::text; RETURN;
    END IF;
    BEGIN
      SELECT array_agg(v.history_item_id) INTO visible
        FROM public.resolve_shared_world_history_visibility_v1(manifest.shared_world_id, creator) v;
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_ACCESS_LOST'::text; RETURN;
    END;
    -- S6-02 (GATE-35 / D5): an Introduction-era item is not visible to any Replay, whenever it was captured.
    visible := shared_private.without_introduction_era_history_v1(manifest.shared_world_id, visible);
    IF EXISTS (
      SELECT 1 FROM public.replay_source_manifest_items i
       WHERE i.manifest_version_id = manifest.id
         AND NOT (i.shared_history_item_id = ANY(coalesce(visible, ARRAY[]::uuid[])))
    ) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_ACCESS_LOST'::text; RETURN;
    END IF;
  ELSE
    -- The same defence for the bounded Public derivative: an ordinal or a
    -- classification that does not belong to the exact package item named is a
    -- contradiction, never a current source.
    IF EXISTS (
      SELECT 1 FROM public.replay_source_manifest_items i
        LEFT JOIN public.publication_package_manifest_items it
          ON it.manifest_version_id = i.public_manifest_version_id
         AND it.package_item_id = i.public_package_item_id
       WHERE i.manifest_version_id = manifest.id
         AND (it.package_item_id IS NULL
              OR it.item_ordinal IS DISTINCT FROM i.public_item_ordinal
              OR it.derivative_classification IS DISTINCT FROM i.public_derivative_classification)
    ) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_CONTRADICTORY'::text; RETURN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.public_experience_controllers c
                    WHERE c.experience_id = manifest.public_experience_id AND c.controller_user_id = creator) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_ACCESS_LOST'::text; RETURN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.public_experiences e
                    WHERE e.id = manifest.public_experience_id
                      AND e.current_experience_version_id = manifest.public_experience_version_id
                      AND e.current_lifecycle IN ('DRAFT', 'READY_FOR_REVIEW', 'PUBLISHED')) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_VERSION_NOT_CURRENT'::text; RETURN;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.replay_source_manifest_items i
        LEFT JOIN public.publication_package_manifest_items it
          ON it.manifest_version_id = i.public_manifest_version_id AND it.package_item_id = i.public_package_item_id
        LEFT JOIN public.public_experience_text_derivative_bodies b ON b.package_item_id = it.package_item_id
       WHERE i.manifest_version_id = manifest.id
         AND (it.package_item_id IS NULL OR b.package_item_id IS NULL
              OR it.public_body_digest <> i.captured_source_digest)
    ) THEN
      RETURN QUERY SELECT 'STALE'::text, 'SOURCE_CHANGED'::text; RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT 'CURRENT'::text, NULL::text;
END$function$
;

-- ---------------------------------------------------------------------------
-- 11. Terminal self-assertions. The migration refuses to deploy a posture in
--     which a helper is application-reachable, the END boundary is wider than
--     authenticated or gated, the frozen END core or one of the six suspended
--     Matching commands became executable, or a Shared Product read still
--     projects an account Name past the S6-02 projection.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  helpers text[] := ARRAY['shared_private.shared_person_name_v1(uuid,uuid,uuid)',
                          'shared_private.is_introduction_era_history_item_v1(uuid,uuid)',
                          'shared_private.without_introduction_era_history_v1(uuid,uuid[])'];
  closed text[] := ARRAY['public.commit_introduction_end_v1(uuid,uuid,uuid,uuid)',
                         'public.commit_introduction_success_v1(uuid,uuid,uuid,uuid)',
                         'public.activate_matching_participation_v1(uuid,text,uuid)',
                         'public.resume_matching_participation_v1(uuid,uuid)',
                         'public.grant_matching_context_v1(uuid,uuid,uuid)',
                         'public.set_introduction_profile_v1(uuid,text[],text[],uuid)',
                         'public.set_matching_requirements_v1(uuid,text[],text[],text[],uuid)',
                         'public.grant_pre_match_disclosure_authority_v1(uuid,uuid,uuid,text[],uuid)'];
  end_fn text := 'public.end_own_introduction_v1(uuid,uuid)';
  fn text;
  target_role text;
  body text;
  leaking text;
BEGIN
  FOREACH fn IN ARRAY helpers || closed LOOP
    FOREACH target_role IN ARRAY ARRAY['public', 'anon', 'authenticated', 'service_role'] LOOP
      IF (target_role = 'public' OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role))
         AND has_function_privilege(target_role, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S6-02: % must not execute %', target_role, fn;
      END IF;
    END LOOP;
  END LOOP;
  FOREACH fn IN ARRAY helpers LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = fn::regprocedure AND p.prosecdef
                     AND pg_get_userbyid(p.proowner) = 'postgres' AND p.proconfig = ARRAY['search_path=""']::text[]) THEN
      RAISE EXCEPTION 'S6-02: % must be a postgres-owned SECURITY DEFINER with an empty search_path', fn;
    END IF;
  END LOOP;

  IF NOT has_function_privilege('authenticated', end_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'S6-02: authenticated must execute %', end_fn;
  END IF;
  FOREACH target_role IN ARRAY ARRAY['public', 'anon', 'service_role'] LOOP
    IF (target_role = 'public' OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role))
       AND has_function_privilege(target_role, end_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S6-02: % must not execute %', target_role, end_fn;
    END IF;
  END LOOP;
  SELECT p.prosrc INTO body FROM pg_proc p WHERE p.oid = end_fn::regprocedure AND p.prosecdef;
  IF body IS NULL OR body !~ 'public\.commit_introduction_end_v1\(p_command_id, p_world_id, v_lower_event, v_higher_event\)'
     OR body ~ '(launch_gate|prerequisites_v1|CLEARED|commit_introduction_success_v1|activate_matching_participation_v1|resume_matching_participation_v1|grant_matching_context_v1|set_introduction_profile_v1|set_matching_requirements_v1|grant_pre_match_disclosure_authority_v1)' THEN
    RAISE EXCEPTION 'S6-02: % must call the frozen END core exactly, ungated, and nothing else of Matching', end_fn;
  END IF;

  SELECT string_agg(n.nspname || '.' || p.proname, ', ' ORDER BY 1) INTO leaking
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE (n.nspname IN ('shared_private', 'shared_semantic_private', 'public_authoring_private')
          OR (n.nspname = 'public' AND p.proname = 'server_read_shared_activity_source_v1'))
     AND EXISTS (SELECT 1 FROM regexp_matches(p.prosrc, 'public\.users\s+(?:AS\s+)?([a-z_]+)', 'g') AS alias(m)
                  WHERE p.prosrc ~ ('\m' || alias.m[1] || '\.name\M'))
     AND (n.nspname, p.proname) NOT IN (('shared_private', 'shared_person_name_v1'),
                                         ('shared_private', 'list_own_shared_world_invitations_v1'));
  IF leaking IS NOT NULL THEN
    RAISE EXCEPTION 'S6-02: these Shared Product reads still project an account Name directly: %', leaking;
  END IF;

  FOREACH fn IN ARRAY ARRAY['public.replay_capture_source_manifest_v1(uuid,uuid,integer,text,uuid,uuid,uuid[],timestamp with time zone)',
                            'public.derive_replay_source_manifest_currency_v1(uuid)'] LOOP
    SELECT p.prosrc INTO body FROM pg_proc p WHERE p.oid = fn::regprocedure;
    IF body !~ 'visible := shared_private\.without_introduction_era_history_v1\(' THEN
      RAISE EXCEPTION 'S6-02: % must filter Introduction-era material out of its visible set', fn;
    END IF;
  END LOOP;
END$$;

COMMIT;
