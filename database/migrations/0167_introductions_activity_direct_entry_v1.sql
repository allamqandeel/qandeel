-- S6-07 - Introductions Activity, Direct Entry and per-Introduction alerts v1 (CP3).
--
-- Product authority: the S6-07 Final Task Contract; the CP0 report and its review addendum (§5: the Event Matrix, Q6
-- WORLD_BORN, Q10 HUMAN_TEXT = Class 4), approved by the Product Owner on 2026-10-18; and «S6-07 - CP2 CLOSED / Start
-- CP3» (2026-10-18). The execution record is docs/e2e/QANDEEL_S6_07_IMPLEMENTATION_RECORD_v1.md (§11).
--
-- Additive and forward-only. Migrations 0001-0166 are untouched: no table, column, constraint, trigger, policy or
-- existing function body is created, replaced or rewritten. It creates NO table, so no relation is added to the governed
-- erasure (0164): every row it reads already is. The Introductions domain stays the source of truth; Activity (0136)
-- stays its projection, reached only through the ONE A3-01 publishing boundary in the API.
--
-- ## What this adds
--
--   1. The Introductions capability truth (A3-01 G-17, I-08N-01 D26) replacing the API's `INTRODUCTIONS_ENTERED = false`:
--      a human has ENTERED Introductions when they have ever committed a Matching participation event (only the governed
--      enrollment of 0165 creates one), or are one of the two humans of an Introduction Record, or keep a retained view
--      (0164). One resolver executable by nobody; the caller's own reader (`authenticated`); and a server reader for the
--      platform dispatcher (`service_role`). Never a global boolean, never another human's answer to a client.
--
--   2. The source of the "a new proposal reached you" item, re-read at publish time (`service_role`): one proposal
--      delivery (the 0120 forward's binding) while it is still its proposal's current state and before its deadline -
--      the recipient, the proposal and the deadline. The 0166 reconciliation lister finds the delivery; this read
--      revalidates it.
--
--   3. ONE read-only server lister of the Introductions events whose recipient has no Activity member yet
--      (`service_role`), so a worker that dies after a commit and before publishing finds the event again on its next
--      cycle (recovery by construction, the 0166 pattern). Every row is derived from durable Introductions truth only,
--      for a recipient who may legitimately know it NOW, within the last 7 days:
--        WORLD_BORN        both humans of an ACTIVE Introduction World (Q6)
--        HUMAN_TEXT        the other human, while the World is ACTIVE and the frozen material resolver still returns the
--                          message to them with its words (a deleted message tells nobody anything) - Class 4 (Q10)
--        DISCLOSURE        the counterpart of one grant fact (0115), while the World is ACTIVE and the disclosed material
--                          still resolves to them
--        ENDED             the human who did NOT end it (the actor already knows), while the World is closed by END; or,
--                          after the other human's account erasure, the holder of the retained view (0164) - one key per
--                          World and recipient, whichever path came first
--        SUCCESS_REQUESTED each required approver of a SUCCESS transition version who has not approved it, while the World
--                          is ACTIVE (dormant: no version producer exists before Stage 8A)
--      Never the event's content, a name, a reason, a count or anything the recipient cannot already open. The candidate
--      key is the event's own identity, so a retry or a second worker is a DUPLICATE in Activity, never a second item.
--
--   4. The reader's per-Introduction alerts (D34): `list_own_introduction_world_alerts_v1()` - exactly the Worlds
--      `list_my_introduction_worlds_v1()` lists to the caller (ACTIVE, ENDED, retained), each with whether it is muted;
--      and `set_own_introduction_world_alerts_v1(world, muted)` - MUTED | UNMUTED | UNAVAILABLE (not theirs, never
--      existed, erased, made Standard: one answer, no detail). It writes only the caller's own row of the ONE existing
--      A3-01 mute table (`public.activity_context_mutes`, context = the World id). Muting one Introduction mutes no other
--      World; it changes notification and attention presentation only. The Stage 4 alerts stay fenced from every
--      Introduction-phase World (0155 D4).
--
-- ## Boundary
--
--   - the server reads and the lister are executable by `service_role` only; the two human commands and the capability
--     reader by `authenticated` only; the resolver by nobody; `anon` runs nothing;
--   - no table grant of any kind; no Matching setup command, core or frozen primitive is named, re-granted or wrapped;
--   - CW2-08 and every launch gate stay closed: nothing here creates a proposal, a delivery, a World or a message.
BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. THE CAPABILITY TRUTH.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.resolve_introductions_capability_v1(p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE STRICT SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.matching_participation_events e WHERE e.participant_user_id = p_user_id)
      OR EXISTS (SELECT 1 FROM public.introduction_records r WHERE p_user_id IN (r.lower_user_id, r.higher_user_id))
      OR EXISTS (SELECT 1 FROM public.introduction_retained_views v WHERE v.user_id = p_user_id);
$$;

CREATE FUNCTION public.read_my_introductions_capability_v1()
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN public.resolve_introductions_capability_v1(v_user);
END$$;

CREATE FUNCTION public.server_read_introductions_capability_v1(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, entered boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user_ids IS NULL OR cardinality(p_user_ids) > 100 THEN
    RAISE EXCEPTION 'INTRODUCTIONS_CAPABILITY_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT u.id, public.resolve_introductions_capability_v1(u.id)
      FROM (SELECT DISTINCT x AS id FROM unnest(p_user_ids) x WHERE x IS NOT NULL) u
     ORDER BY u.id;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. ONE PROPOSAL DELIVERY, RE-READ AT PUBLISH TIME (the predicate of the 0166 reconciliation lister).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_read_introductions_proposal_delivery_v1(p_delivery_transition_id uuid)
RETURNS TABLE(recipient_user_id uuid, proposal_id uuid, delivered_at timestamptz, expires_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_delivery_transition_id IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTIONS_ACTIVITY_SOURCE_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT b.recipient_user_id, b.proposal_id, t.occurred_at, p.expires_at
      FROM public.matching_proposal_delivery_view_bindings b
      JOIN public.matching_proposals p ON p.id = b.proposal_id AND p.current_transition_id = b.delivery_transition_id
      JOIN public.matching_proposal_transitions t ON t.id = b.delivery_transition_id
     WHERE b.delivery_transition_id = p_delivery_transition_id
       AND p.expires_at > CURRENT_TIMESTAMP;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. THE INTRODUCTIONS ACTIVITY LISTER (read-only; recovery by construction).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_list_introductions_activity_v1(p_limit integer)
RETURNS TABLE(event text, recipient_user_id uuid, world_id uuid, source_id uuid, candidate_key text, occurred_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_since timestamptz := CURRENT_TIMESTAMP - interval '7 days';
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'INTRODUCTIONS_ACTIVITY_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  WITH live AS (
    -- The ACTIVE Introduction Worlds: a live Record, an ACTIVE World still in the Introduction phase.
    SELECT r.world_id, r.lower_user_id, r.higher_user_id, r.started_at
      FROM public.introduction_records r
      JOIN public.shared_worlds w ON w.id = r.world_id
     WHERE r.introduction_status = 'ACTIVE' AND w.lifecycle = 'ACTIVE' AND w.phase = 'INTRODUCTION'
  ), raw AS (
    SELECT 'WORLD_BORN'::text AS event, h.recipient, l.world_id, l.world_id AS source_id,
           'introductions:world-born:' || l.world_id::text AS ckey, l.started_at AS at
      FROM live l CROSS JOIN LATERAL (VALUES (l.lower_user_id), (l.higher_user_id)) h(recipient)
     WHERE l.started_at > v_since
    UNION ALL
    SELECT 'HUMAN_TEXT', CASE WHEN m.author_user_id = l.lower_user_id THEN l.higher_user_id ELSE l.lower_user_id END,
           l.world_id, m.id, 'introductions:human-text:' || m.id::text, m.established_at
      FROM live l
      JOIN public.shared_world_materials m ON m.world_id = l.world_id
     WHERE m.material_kind = 'HUMAN_TEXT' AND m.producer_kind = 'HUMAN'
       AND m.author_user_id IN (l.lower_user_id, l.higher_user_id) AND m.established_at > v_since
    UNION ALL
    SELECT 'DISCLOSURE', g.counterpart_user_id, l.world_id, g.resource_version_id,
           'introductions:disclosure:' || g.resource_version_id::text, g.occurred_at
      FROM live l
      JOIN public.introduction_disclosure_granted_events g ON g.world_id = l.world_id
     WHERE g.occurred_at > v_since AND g.counterpart_user_id IN (l.lower_user_id, l.higher_user_id)
    UNION ALL
    SELECT 'ENDED', CASE WHEN x.actor_user_id = r.lower_user_id THEN r.higher_user_id ELSE r.lower_user_id END,
           r.world_id, r.world_id, 'introductions:ended:' || r.world_id::text, x.occurred_at
      FROM public.introduction_ended_events x
      JOIN public.introduction_records r ON r.id = x.introduction_record_id AND r.world_id = x.world_id
      JOIN public.shared_worlds w ON w.id = r.world_id
     WHERE r.introduction_status = 'CLOSED' AND w.lifecycle = 'READ_ONLY_CLOSED' AND w.phase = 'INTRODUCTION'
       AND x.actor_user_id IN (r.lower_user_id, r.higher_user_id) AND x.occurred_at > v_since
    UNION ALL
    SELECT 'ENDED', v.user_id, v.world_id, v.world_id, 'introductions:ended:' || v.world_id::text, v.retained_at
      FROM public.introduction_retained_views v
      JOIN public.shared_worlds w ON w.id = v.world_id
     WHERE w.lifecycle = 'READ_ONLY_CLOSED' AND w.phase = 'INTRODUCTION' AND v.retained_at > v_since
    UNION ALL
    SELECT 'SUCCESS_REQUESTED', a.approver_user_id, l.world_id, sv.id,
           'introductions:success-requested:' || sv.id::text || ':' || a.approver_user_id::text, sv.created_at
      FROM live l
      JOIN public.introduction_records r ON r.world_id = l.world_id
      JOIN public.introduction_success_transition_versions sv ON sv.introduction_record_id = r.id AND sv.world_id = l.world_id
      JOIN public.introduction_success_required_approvers a ON a.transition_version_id = sv.id
     WHERE sv.created_at > v_since AND a.approver_user_id IN (l.lower_user_id, l.higher_user_id)
       AND NOT EXISTS (SELECT 1 FROM public.introduction_success_approval_state s
                         JOIN public.introduction_success_approval_events e ON e.id = s.current_event_id
                        WHERE s.transition_version_id = sv.id AND s.approver_user_id = a.approver_user_id
                          AND e.resulting_state = 'APPROVED')
  ), pending AS (
    SELECT DISTINCT ON (q.recipient, q.ckey) q.*
      FROM raw q
     WHERE NOT EXISTS (SELECT 1 FROM public.activity_item_members am WHERE am.user_id = q.recipient AND am.candidate_key = q.ckey)
     ORDER BY q.recipient, q.ckey, q.at
  ), readers AS (
    -- Whoever must still be able to read what the event is about: the frozen resolver of its kind
    -- (the material resolver for a message, the disclosure resolver for a disclosure), once per World and reader.
    SELECT DISTINCT p.world_id, p.recipient, p.event FROM pending p WHERE p.event IN ('HUMAN_TEXT', 'DISCLOSURE')
  ), visible AS (
    SELECT d.world_id, d.recipient, res.material_id AS id
      FROM readers d
      CROSS JOIN LATERAL public.resolve_shared_world_material_v1(d.world_id, d.recipient) res
     WHERE d.event = 'HUMAN_TEXT' AND res.material_kind = 'HUMAN_TEXT' AND res.text_body IS NOT NULL
    UNION ALL
    SELECT d.world_id, d.recipient, res.resource_version_id
      FROM readers d
      CROSS JOIN LATERAL public.resolve_shared_world_introduction_disclosure_v1(d.world_id, d.recipient) res
     WHERE d.event = 'DISCLOSURE'
  )
  SELECT p.event, p.recipient, p.world_id, p.source_id, p.ckey, p.at
    FROM pending p
   WHERE p.event NOT IN ('HUMAN_TEXT', 'DISCLOSURE')
      OR EXISTS (SELECT 1 FROM visible s WHERE s.world_id = p.world_id AND s.recipient = p.recipient AND s.id = p.source_id)
   ORDER BY p.at, p.ckey, p.recipient
   LIMIT p_limit;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. THE READER'S PER-INTRODUCTION ALERTS (D34).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.list_own_introduction_world_alerts_v1()
RETURNS TABLE(world_id uuid, introduction_state text, other_first_name text, muted boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  -- Exactly the caller's own Introduction Worlds, by the discovery read itself (same order): nothing else, no count.
  RETURN QUERY
    SELECT l.world_id, l.introduction_state, l.other_first_name,
           EXISTS (SELECT 1 FROM public.activity_context_mutes m WHERE m.user_id = v_user AND m.context_ref = l.world_id::text)
      FROM public.list_my_introduction_worlds_v1() l;
END$$;

CREATE FUNCTION public.set_own_introduction_world_alerts_v1(p_world_id uuid, p_muted boolean)
RETURNS TABLE(outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR p_muted IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_ALERTS_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.list_my_introduction_worlds_v1() l WHERE l.world_id = p_world_id) THEN
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
END$$;

COMMENT ON FUNCTION public.read_my_introductions_capability_v1() IS
  'S6-07 CP3: whether the caller has entered Introductions (a participation event, an Introduction, or a retained view). '
  'authenticated only.';
COMMENT ON FUNCTION public.server_list_introductions_activity_v1(integer) IS
  'S6-07 CP3: read-only. Every Introductions event of the last 7 days whose legitimate recipient has no Activity member '
  'under its candidate key - WORLD_BORN, HUMAN_TEXT, DISCLOSURE, ENDED, SUCCESS_REQUESTED - so a lost publish is found '
  'again on the next cycle. No content, no name. service_role only.';
COMMENT ON FUNCTION public.set_own_introduction_world_alerts_v1(uuid, boolean) IS
  'S6-07 CP3: mute or unmute ONE of the caller''s own Introduction Worlds (MUTED | UNMUTED | UNAVAILABLE). Writes only the '
  'caller''s own row of public.activity_context_mutes. authenticated only.';

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. PRIVILEGES, every one explicit (0133 removed the hosted default privileges; nothing here relies on a default).
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.resolve_introductions_capability_v1(uuid)',
    'public.read_my_introductions_capability_v1()',
    'public.server_read_introductions_capability_v1(uuid[])',
    'public.server_read_introductions_proposal_delivery_v1(uuid)',
    'public.server_list_introductions_activity_v1(integer)',
    'public.list_own_introduction_world_alerts_v1()',
    'public.set_own_introduction_world_alerts_v1(uuid, boolean)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', fn);
    END IF;
  END LOOP;
  GRANT EXECUTE ON FUNCTION public.read_my_introductions_capability_v1(), public.list_own_introduction_world_alerts_v1(),
    public.set_own_introduction_world_alerts_v1(uuid, boolean) TO authenticated;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.server_read_introductions_capability_v1(uuid[]), '
         || 'public.server_read_introductions_proposal_delivery_v1(uuid), public.server_list_introductions_activity_v1(integer) TO service_role';
  END IF;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. TERMINAL SELF-ASSERTIONS: the boundary is what this file says, or the migration fails.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  servers constant text[] := ARRAY['public.server_read_introductions_capability_v1(uuid[])',
    'public.server_read_introductions_proposal_delivery_v1(uuid)', 'public.server_list_introductions_activity_v1(integer)'];
  humans constant text[] := ARRAY['public.read_my_introductions_capability_v1()', 'public.list_own_introduction_world_alerts_v1()',
    'public.set_own_introduction_world_alerts_v1(uuid, boolean)'];
  fn text;
  src text;
BEGIN
  FOREACH fn IN ARRAY servers || humans || ARRAY['public.resolve_introductions_capability_v1(uuid)'] LOOP
    IF has_function_privilege('anon', fn, 'EXECUTE') OR has_function_privilege('public', fn::regprocedure, 'EXECUTE') THEN
      RAISE EXCEPTION 'S6-07 CP3: % is executable by anon or PUBLIC', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY servers || ARRAY['public.resolve_introductions_capability_v1(uuid)'] LOOP
    IF has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S6-07 CP3: a client can run %', fn;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    FOREACH fn IN ARRAY humans || ARRAY['public.resolve_introductions_capability_v1(uuid)'] LOOP
      IF has_function_privilege('service_role', fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S6-07 CP3: the server channel reaches %', fn;
      END IF;
    END LOOP;
    FOREACH fn IN ARRAY servers LOOP
      IF NOT has_function_privilege('service_role', fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S6-07 CP3: the server channel cannot run %', fn;
      END IF;
    END LOOP;
  END IF;
  -- Everything but the one mute command is read-only, and the mute command writes only the caller's own mute row.
  FOREACH fn IN ARRAY servers || ARRAY['public.read_my_introductions_capability_v1()', 'public.list_own_introduction_world_alerts_v1()',
                                       'public.resolve_introductions_capability_v1(uuid)'] LOOP
    SELECT regexp_replace(p.prosrc, '--[^\n]*', '', 'g') INTO src FROM pg_proc p WHERE p.oid = fn::regprocedure;
    IF (SELECT p.provolatile FROM pg_proc p WHERE p.oid = fn::regprocedure) <> 's' OR src ~* '\m(INSERT|UPDATE|DELETE)\M' THEN
      RAISE EXCEPTION 'S6-07 CP3: % is STABLE and writes nothing', fn;
    END IF;
  END LOOP;
  SELECT regexp_replace(p.prosrc, '--[^\n]*', '', 'g') INTO src FROM pg_proc p
   WHERE p.oid = 'public.set_own_introduction_world_alerts_v1(uuid, boolean)'::regprocedure;
  IF (SELECT array_agg(m[1] ORDER BY m[1]) FROM regexp_matches(src, '(?:INSERT INTO|UPDATE|DELETE FROM)\s+([a-z_.]+)', 'gi') m)
       IS DISTINCT FROM ARRAY['public.activity_context_mutes', 'public.activity_context_mutes'] THEN
    RAISE EXCEPTION 'S6-07 CP3: the mute command writes only the caller''s own mute row';
  END IF;
END$$;

COMMIT;
