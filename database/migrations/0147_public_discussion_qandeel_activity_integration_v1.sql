-- S5-04 — Public Discussion + @qandeel + Public Activity / Direct Entry integration v1.
--
-- Forward-only. No historical migration is edited and no frozen function is replaced. The canonical Public discussion and
-- Public QANDEEL runtime is migration 0096 (`public_discussion_posts`, `public_qandeel_responses`, their command
-- families, `post_public_discussion_v1`, `record_public_qandeel_response_v1` and the two service-role resolvers), the
-- vitality runtime is 0097, the disappearance closure is 0098 / 0099. This migration builds NO second discussion, reply,
-- response, vitality or stale-content runtime. It is the minimal additive application boundary the Product needs to reach
-- that frozen truth, and nothing else:
--
--   A. ONE entitlement seam (CW2-04 §20 / D22; CW2-08 §21, §44 item 7). No executable entitlement truth exists in this
--      repository, so the seam answers NOT_EVALUATED and human discussion writing FAILS CLOSED in production until the
--      Stage-9 / CW2-08 slice replaces its body. No plan, price, Credit or permissive constant exists anywhere here.
--   B. ONE durable invocation record per committed human post whose words contain the standalone `@qandeel` token
--      (Product Owner D1: case-insensitive, standalone, kept verbatim in the post, from a top-level post or a reply, AT
--      MOST ONE Public QANDEEL response per invoking post, however many tokens it holds).
--   C. A server-only generation-work lease for that one response (no generic lease exists: 0131 is Personal, 0139 is
--      Shared), with a per-human in-flight and window bound.
--   D. The human post command: the caller is auth.uid(), admitted by the frozen gate, entitled by the seam; the target is
--      the Experience's CURRENT served field entry (the ONE S5-03B visible-entry derivation); a reply to a reply is kept in
--      the same thread root (Product Owner D2: one visible depth) without changing 0096 storage; then the frozen 0096
--      writer; then the frozen 0097 vitality recompute, which until now nothing called.
--   E. The viewer read: the current visible version's posts through the frozen 0096 resolvers, each with its one Public
--      QANDEEL response (if any), paged; plus whether the viewer may contribute now.
--   F. The server-channel QANDEEL work: begin, the strictly PUBLIC context read, complete (through the frozen 0096
--      writer, revalidated), end.
--   G. The server-channel Public Activity source read: recipients DERIVED from canonical Public truth (S4-04 pattern).
--
-- Disclosure: every human read is the caller's own and returns only what the frozen resolvers serve now. When the
-- Experience disappears, its discussion, responses and relations are not served, no tombstone appears, and the server
-- reads answer nothing. The Public QANDEEL context is public-visible truth only: the exact served version's public
-- content, its reviewed meaning, its current served discussion, and the reviewed meaning of each CURRENT explicit related
-- Experience — never Personal, Shared, memory, human-model, hypothesis, Matching or Introduction context, sealed
-- provenance, a source World, an account or a contact.

BEGIN;

CREATE SCHEMA public_discussion_private;
REVOKE ALL ON SCHEMA public_discussion_private FROM PUBLIC;

-- =====================================================================================================================
-- A. THE ENTITLEMENT SEAM. Executable by no application role. A later reviewed CW2-08 / Stage-9 slice replaces its body;
--    nothing that consumes it changes. Validation replaces it only inside a transaction it rolls back.
-- =====================================================================================================================
CREATE FUNCTION public_discussion_private.resolve_public_discussion_entitlement_v1(p_user_id uuid)
RETURNS TABLE (entitlement_state text, basis text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT 'NOT_EVALUATED'::text,
         'CW2-04 D22 / CW2-08 §21: Public reply / comment requires Premium entitlement; no executable entitlement runtime '
         'exists in this repository (Stage 9), so contribution fails closed'::text;
$$;

-- =====================================================================================================================
-- B. INVOCATIONS. One row per committed human post that invoked @qandeel. No account column: the requester IS the post's
--    author (0096). The one response is linked once and never re-linked.
-- =====================================================================================================================
CREATE TABLE public_discussion_private.qandeel_invocations (
    post_id uuid NOT NULL,
    experience_id uuid NOT NULL,
    invoked_at timestamptz NOT NULL,
    response_id uuid,
    last_unavailable_at timestamptz,
    CONSTRAINT qandeel_invocations_pk PRIMARY KEY (post_id),
    CONSTRAINT qandeel_invocations_post_fk
        FOREIGN KEY (post_id, experience_id) REFERENCES public.public_discussion_posts (id, experience_id) ON DELETE RESTRICT,
    CONSTRAINT qandeel_invocations_response_fk
        FOREIGN KEY (response_id) REFERENCES public.public_qandeel_responses (id) ON DELETE RESTRICT,
    CONSTRAINT qandeel_invocations_one_response UNIQUE (response_id)
);

COMMENT ON TABLE public_discussion_private.qandeel_invocations IS
  'S5-04: one explicit @qandeel invocation per committed human Public post (Product Owner D1). At most one Public QANDEEL '
  'response is ever linked to it. No account column: the requester is the 0096 post author.';

-- The invocation's identity and post never change; its response is linked at most once; only the last-unavailable
-- instant of an unanswered invocation may move. Nothing is deleted.
CREATE FUNCTION public_discussion_private.guard_invocation_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.response_id IS NULL AND NEW.last_unavailable_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.post_id = OLD.post_id AND NEW.experience_id = OLD.experience_id AND NEW.invoked_at = OLD.invoked_at
     AND OLD.response_id IS NULL
     AND (NEW.response_id IS NOT NULL OR NEW.last_unavailable_at IS NOT NULL) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'PUBLIC_QANDEEL_INVOCATION_IS_IMMUTABLE' USING ERRCODE = '55000';
END$$;

CREATE TRIGGER qandeel_invocations_guard BEFORE INSERT OR UPDATE OR DELETE ON public_discussion_private.qandeel_invocations
    FOR EACH ROW EXECUTE FUNCTION public_discussion_private.guard_invocation_v1();

-- =====================================================================================================================
-- C. THE GENERATION-WORK LEASE. Runtime authority state; no application role reads or writes it.
-- =====================================================================================================================
CREATE FUNCTION public_discussion_private.qandeel_work_policy_v1(
  OUT user_in_flight_limit integer,
  OUT short_window interval,
  OUT short_window_limit integer,
  OUT long_window interval,
  OUT long_window_limit integer
) LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY DEFINER SET search_path = '' AS $$
  -- Explicit public invocations are rarer than conversation turns: two in flight, 20 per rolling 10 minutes and 200 per
  -- rolling 24 hours per human (CW2-08 lists @qandeel among the rate-limited actions).
  SELECT 2, interval '10 minutes', 20, interval '24 hours', 200
$$;

CREATE TABLE public_discussion_private.qandeel_work_leases (
    post_id uuid NOT NULL,
    requester_user_id uuid NOT NULL,
    lease_id uuid NOT NULL,
    acquired_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    CONSTRAINT qandeel_work_leases_pk PRIMARY KEY (post_id),
    CONSTRAINT qandeel_work_leases_invocation_fk
        FOREIGN KEY (post_id) REFERENCES public_discussion_private.qandeel_invocations (post_id) ON DELETE CASCADE,
    CONSTRAINT qandeel_work_leases_user_fk FOREIGN KEY (requester_user_id) REFERENCES public.users (id) ON DELETE CASCADE,
    CONSTRAINT qandeel_work_leases_window_check CHECK (expires_at > acquired_at)
);
CREATE INDEX qandeel_work_leases_user_idx ON public_discussion_private.qandeel_work_leases (requester_user_id, expires_at);

CREATE TABLE public_discussion_private.qandeel_work_grants (
    id bigint GENERATED ALWAYS AS IDENTITY,
    requester_user_id uuid NOT NULL,
    granted_at timestamptz NOT NULL,
    CONSTRAINT qandeel_work_grants_pk PRIMARY KEY (id),
    CONSTRAINT qandeel_work_grants_user_fk FOREIGN KEY (requester_user_id) REFERENCES public.users (id) ON DELETE CASCADE
);
CREATE INDEX qandeel_work_grants_user_idx ON public_discussion_private.qandeel_work_grants (requester_user_id, granted_at);

-- =====================================================================================================================
-- D. INTERNAL DERIVATIONS. Executable by no application role.
-- =====================================================================================================================

-- D.1 Does this text hold the standalone, case-insensitive `@qandeel` token (Product Owner D1)? A token is the exact
--     word: not part of a longer word, a handle or an address on either side.
CREATE FUNCTION public_discussion_private.invokes_qandeel_v1(p_text text)
RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_text ~* '(^|[^[:alnum:]_@.])@qandeel($|[^[:alnum:]_@])';
$$;

-- D.2 Is this human entitled to contribute NOW? Only an exact ENTITLED from the seam.
CREATE FUNCTION public_discussion_private.is_entitled_v1(p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT e.entitlement_state = 'ENTITLED' AND length(btrim(coalesce(e.basis, ''))) > 0
                     FROM public_discussion_private.resolve_public_discussion_entitlement_v1(p_user) e LIMIT 1), false);
$$;

-- D.3 Is this human admitted as a REGISTERED viewer of the ONE Public World now (the frozen gate)?
CREATE FUNCTION public_discussion_private.is_admitted_v1(p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_user IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.public_world_state w WHERE w.singleton AND w.world_type = 'PUBLIC_WORLD')
     AND EXISTS (SELECT 1 FROM public.resolve_public_audience_admission_v1(p_user) a
                  WHERE a.admission = 'ADMITTED' AND a.viewer_class = 'REGISTERED');
$$;

-- D.4 The served version of one Experience: the version the ONE S5-03B visible-entry derivation serves now, or NULL.
CREATE FUNCTION public_discussion_private.served_version_v1(p_experience_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT ve.experience_version_id FROM public_spatial_private.derive_visible_spatial_entry_v1(p_experience_id) ve LIMIT 1;
$$;

-- =====================================================================================================================
-- E. THE HUMAN COMMAND (authenticated; the author is auth.uid()).
--      POSTED | REPLIED     committed now (or this command's retry, ALREADY_COMMITTED)
--      NOT_ENTITLED          the entitlement seam does not answer ENTITLED — nothing is written
--      UNAVAILABLE           not admitted, the Experience is not served now, or the reply target is not a served post of it
--    The caller supplies only its own words, the Experience and (optionally) the post it replies to. The author, the
--    Public identity, the version, the ordinal, the instant and the thread root are derived here or by 0096.
-- =====================================================================================================================
CREATE FUNCTION public_discussion_private.post_own_public_discussion_v1(
  p_command_id uuid, p_experience_id uuid, p_reply_to_post_id uuid, p_body text
) RETURNS TABLE (outcome text, post_id uuid, thread_root_id uuid, post_ordinal bigint, qandeel_invoked boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid;
  v_version uuid;
  v_root uuid;
  v_post uuid;
  v_parent public.public_discussion_posts;
  v_command public.public_discussion_post_commands;
  v_written record;
  v_invoked boolean;
BEGIN
  IF p_command_id IS NULL OR p_experience_id IS NULL OR p_body IS NULL OR length(btrim(p_body)) = 0 OR length(p_body) > 4000 THEN
    RAISE EXCEPTION 'PUBLIC_DISCUSSION_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_user := public_spatial_private.admitted_viewer_v1();
  IF v_user IS NULL THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::uuid, NULL::bigint, false;
    RETURN;
  END IF;
  -- One command at a time per (human, command): a concurrent retry waits and then reads its own answer.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('qandeel.public-discussion-post.v1:' || v_user::text || ':' || p_command_id::text, 0));
  SELECT c.* INTO v_command FROM public.public_discussion_post_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF v_command.actor_user_id <> v_user OR v_command.experience_id <> p_experience_id THEN
      RAISE EXCEPTION 'PUBLIC_DISCUSSION_COMMAND_ID_CONFLICT' USING ERRCODE = '23505';
    END IF;
    RETURN QUERY
      SELECT 'ALREADY_COMMITTED'::text, p.id, coalesce(p.parent_post_id, p.id), p.post_ordinal,
             EXISTS (SELECT 1 FROM public_discussion_private.qandeel_invocations i WHERE i.post_id = p.id)
        FROM public.public_discussion_posts p WHERE p.id = v_command.post_id;
    RETURN;
  END IF;
  v_version := public_discussion_private.served_version_v1(p_experience_id);
  IF v_version IS NULL THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::uuid, NULL::bigint, false;
    RETURN;
  END IF;
  -- D22 is enforced at commit, not only in the client: no Premium, no contribution (fail closed).
  IF NOT public_discussion_private.is_entitled_v1(v_user) THEN
    RETURN QUERY SELECT 'NOT_ENTITLED'::text, NULL::uuid, NULL::uuid, NULL::bigint, false;
    RETURN;
  END IF;
  IF p_reply_to_post_id IS NOT NULL THEN
    SELECT p.* INTO v_parent FROM public.public_discussion_posts p WHERE p.id = p_reply_to_post_id;
    IF NOT FOUND OR v_parent.experience_id <> p_experience_id OR v_parent.target_experience_version_id <> v_version THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::uuid, NULL::bigint, false;
      RETURN;
    END IF;
    -- One visible depth (D2): a reply to a reply joins the same thread root.
    v_root := coalesce(v_parent.parent_post_id, v_parent.id);
  END IF;
  -- The ONE Public Identity, provisioned at first real authorship exactly as S5-02 does (E2E-H-08).
  PERFORM public_authoring_private.provision_own_public_identity_v1(v_user);
  v_post := pg_catalog.gen_random_uuid();
  BEGIN
    SELECT w.* INTO v_written FROM public.post_public_discussion_v1(p_command_id, v_post, p_experience_id, v_root, p_body) w;
  EXCEPTION WHEN SQLSTATE 'P0002' THEN
    -- The frozen writer re-derived visibility and the target went dark in between: one neutral answer.
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::uuid, NULL::bigint, false;
    RETURN;
  END;
  v_invoked := public_discussion_private.invokes_qandeel_v1(p_body);
  IF v_invoked THEN
    INSERT INTO public_discussion_private.qandeel_invocations (post_id, experience_id, invoked_at)
    VALUES (v_written.post_id, p_experience_id, v_written.committed_at);
  END IF;
  PERFORM public.recompute_public_experience_vitality_v1(p_experience_id);
  RETURN QUERY SELECT v_written.outcome, v_written.post_id, coalesce(v_root, v_written.post_id), v_written.post_ordinal, v_invoked;
END$$;

-- =====================================================================================================================
-- F. THE VIEWER READS (authenticated; the viewer is auth.uid(), admitted by the frozen gate).
-- =====================================================================================================================

-- F.1 THE DISCUSSION of one served Experience: its current visible version's posts in canonical ordinal order, at most
--     100 after `p_after_ordinal`, each with its Public Identity display (joined now), its thread root, whether it is the
--     viewer's own, and its one Public QANDEEL response state. Nothing for an Experience not served now.
--       qandeel_state  NONE        the post did not invoke @qandeel (or its response is not served)
--                      PENDING     invoked; no response yet
--                      UNAVAILABLE invoked; the last attempt could not answer; no response yet
--                      RESPONDED   the one response, served now
CREATE FUNCTION public_discussion_private.read_public_discussion_posts_v1(p_experience_id uuid, p_after_ordinal bigint)
RETURNS TABLE (post_id uuid, thread_root_id uuid, post_ordinal bigint, author_label_mode text, author_display_label text,
               post_body text, posted_at timestamptz, is_own boolean, qandeel_state text, qandeel_response_body text,
               qandeel_responded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_viewer uuid;
BEGIN
  IF p_experience_id IS NULL OR (p_after_ordinal IS NOT NULL AND p_after_ordinal < 0) THEN
    RAISE EXCEPTION 'PUBLIC_DISCUSSION_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_viewer := public_spatial_private.admitted_viewer_v1();
  IF v_viewer IS NULL OR public_discussion_private.served_version_v1(p_experience_id) IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT d.post_id, coalesce(d.parent_post_id, d.post_id), d.post_ordinal, d.author_label_mode, d.author_display_label,
           d.post_body, d.posted_at, (p.author_user_id = v_viewer),
           CASE WHEN i.post_id IS NULL THEN 'NONE'
                WHEN r.response_id IS NOT NULL THEN 'RESPONDED'
                WHEN i.response_id IS NOT NULL THEN 'NONE'
                WHEN i.last_unavailable_at IS NOT NULL
                     AND NOT EXISTS (SELECT 1 FROM public_discussion_private.qandeel_work_leases l
                                      WHERE l.post_id = i.post_id AND l.expires_at > CURRENT_TIMESTAMP) THEN 'UNAVAILABLE'
                ELSE 'PENDING' END::text,
           r.response_body, r.produced_at
      FROM public.resolve_public_discussion_v1(p_experience_id, v_viewer) d
      JOIN public.public_discussion_posts p ON p.id = d.post_id
      LEFT JOIN public_discussion_private.qandeel_invocations i ON i.post_id = d.post_id
      LEFT JOIN public.resolve_public_qandeel_responses_v1(p_experience_id, v_viewer) r ON r.response_id = i.response_id
     WHERE d.post_ordinal > coalesce(p_after_ordinal, 0)
     ORDER BY d.post_ordinal
     LIMIT 100;
END$$;

-- F.2 MAY THE VIEWER CONTRIBUTE to this Experience's discussion now? Served, admitted AND entitled. Never why not.
CREATE FUNCTION public_discussion_private.read_public_discussion_capability_v1(p_experience_id uuid)
RETURNS TABLE (can_contribute boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_viewer uuid;
BEGIN
  IF p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_DISCUSSION_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_viewer := public_spatial_private.admitted_viewer_v1();
  IF v_viewer IS NULL OR public_discussion_private.served_version_v1(p_experience_id) IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT public_discussion_private.is_entitled_v1(v_viewer);
END$$;

-- =====================================================================================================================
-- G. THE SERVER CHANNEL: Public QANDEEL work for ONE invoking post (service_role). The server names the post and the
--    human whose request started the work; the database decides everything else.
-- =====================================================================================================================

-- G.1 BEGIN. GRANTED (a new lease) | ALREADY_COMMITTED (the one response exists) | IN_PROGRESS (a live lease covers it) |
--     LIMITED (the human's in-flight or window bound; one answer for every reason) | UNAVAILABLE (not an invocation of
--     this human, the post or its Experience is not served now, the human is not admitted or not entitled).
CREATE FUNCTION public_discussion_private.begin_public_qandeel_work_v1(p_post_id uuid, p_requester_user_id uuid)
RETURNS TABLE (work_outcome text, work_lease_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_invocation public_discussion_private.qandeel_invocations;
  v_post public.public_discussion_posts;
  v_policy record;
  v_lease uuid;
BEGIN
  IF p_post_id IS NULL OR p_requester_user_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_QANDEEL_WORK_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT i.* INTO v_invocation FROM public_discussion_private.qandeel_invocations i WHERE i.post_id = p_post_id;
  SELECT p.* INTO v_post FROM public.public_discussion_posts p WHERE p.id = p_post_id;
  IF v_invocation.post_id IS NULL OR v_post.id IS NULL OR v_post.author_user_id <> p_requester_user_id THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  IF v_invocation.response_id IS NOT NULL THEN
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, NULL::uuid;
    RETURN;
  END IF;
  IF public_discussion_private.served_version_v1(v_post.experience_id) IS DISTINCT FROM v_post.target_experience_version_id
     OR NOT public_discussion_private.is_admitted_v1(p_requester_user_id)
     OR NOT public_discussion_private.is_entitled_v1(p_requester_user_id) THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('qandeel.public-qandeel-work.v1:' || p_requester_user_id::text, 0));
  -- Read again under the lock.
  IF EXISTS (SELECT 1 FROM public_discussion_private.qandeel_invocations i WHERE i.post_id = p_post_id AND i.response_id IS NOT NULL) THEN
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, NULL::uuid;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public_discussion_private.qandeel_work_leases l WHERE l.post_id = p_post_id AND l.expires_at > CURRENT_TIMESTAMP) THEN
    RETURN QUERY SELECT 'IN_PROGRESS'::text, NULL::uuid;
    RETURN;
  END IF;
  SELECT * INTO v_policy FROM public_discussion_private.qandeel_work_policy_v1();
  DELETE FROM public_discussion_private.qandeel_work_leases l
   WHERE l.requester_user_id = p_requester_user_id AND l.expires_at <= CURRENT_TIMESTAMP;
  DELETE FROM public_discussion_private.qandeel_work_leases l WHERE l.post_id = p_post_id;
  DELETE FROM public_discussion_private.qandeel_work_grants g
   WHERE g.requester_user_id = p_requester_user_id AND g.granted_at <= CURRENT_TIMESTAMP - v_policy.long_window;
  IF (SELECT count(*) FROM public_discussion_private.qandeel_work_leases l
       WHERE l.requester_user_id = p_requester_user_id) >= v_policy.user_in_flight_limit
     OR (SELECT count(*) FROM public_discussion_private.qandeel_work_grants g
          WHERE g.requester_user_id = p_requester_user_id
            AND g.granted_at > CURRENT_TIMESTAMP - v_policy.short_window) >= v_policy.short_window_limit
     OR (SELECT count(*) FROM public_discussion_private.qandeel_work_grants g
          WHERE g.requester_user_id = p_requester_user_id) >= v_policy.long_window_limit THEN
    RETURN QUERY SELECT 'LIMITED'::text, NULL::uuid;
    RETURN;
  END IF;
  v_lease := pg_catalog.gen_random_uuid();
  INSERT INTO public_discussion_private.qandeel_work_leases (post_id, requester_user_id, lease_id, acquired_at, expires_at)
  VALUES (p_post_id, p_requester_user_id, v_lease, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + public.foreground_generation_lease_interval_v1());
  INSERT INTO public_discussion_private.qandeel_work_grants (requester_user_id, granted_at)
  VALUES (p_requester_user_id, CURRENT_TIMESTAMP);
  RETURN QUERY SELECT 'GRANTED'::text, v_lease;
END$$;

-- G.2 THE PUBLIC CONTEXT, read only under the live lease, from public-visible truth only, as the requester is served now:
--       VERSION          the exact served version (context_ref), for revalidation at completion
--       MEANING          the reviewed S5-03A meaning of the served version
--       THEME            each reviewed primary / secondary theme
--       CONTENT          each public package item (0095 serving resolver), SOURCE_CONTENT or ANALYSIS in context_role
--       POST             each served discussion post before (and including) the invoking post's ordinal — the last 40;
--                        INVOKING marks the invoking one; context_ref is the post id
--       QANDEEL          each served earlier Public QANDEEL response — the last 20
--       RELATED          the reviewed meaning of each CURRENT active explicit relation's other served endpoint — at most 24
--     Nothing else: no author, display, account, Personal / Shared / memory / human-model / Matching context, provenance,
--     source World or contact. Nothing at all when the lease is not live or anything is no longer served.
CREATE FUNCTION public_discussion_private.read_public_qandeel_context_v1(p_post_id uuid, p_lease_id uuid)
RETURNS TABLE (context_kind text, context_role text, context_ordinal bigint, context_ref uuid, context_text text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_lease public_discussion_private.qandeel_work_leases;
  v_post public.public_discussion_posts;
  v_entry record;
BEGIN
  IF p_post_id IS NULL OR p_lease_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_QANDEEL_WORK_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT l.* INTO v_lease FROM public_discussion_private.qandeel_work_leases l
   WHERE l.post_id = p_post_id AND l.lease_id = p_lease_id AND l.expires_at > CURRENT_TIMESTAMP;
  IF NOT FOUND OR NOT public_discussion_private.is_admitted_v1(v_lease.requester_user_id) THEN
    RETURN;
  END IF;
  SELECT p.* INTO v_post FROM public.public_discussion_posts p WHERE p.id = p_post_id;
  SELECT ve.* INTO v_entry FROM public_spatial_private.derive_visible_spatial_entry_v1(v_post.experience_id) ve;
  IF v_entry.experience_version_id IS NULL OR v_entry.experience_version_id <> v_post.target_experience_version_id THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT 'VERSION'::text, NULL::text, 0::bigint, v_entry.experience_version_id, NULL::text;
  RETURN QUERY SELECT 'MEANING'::text, NULL::text, 0::bigint, NULL::uuid, v_entry.meaning;
  RETURN QUERY SELECT 'THEME'::text, 'PRIMARY'::text, t.n, NULL::uuid, t.theme
                 FROM unnest(v_entry.primary_themes) WITH ORDINALITY AS t(theme, n);
  RETURN QUERY SELECT 'THEME'::text, 'SECONDARY'::text, t.n, NULL::uuid, t.theme
                 FROM unnest(v_entry.secondary_themes) WITH ORDINALITY AS t(theme, n);
  RETURN QUERY
    SELECT 'CONTENT'::text,
           CASE sv.derivative_classification WHEN 'ANALYTICAL_DERIVATIVE' THEN 'ANALYSIS' ELSE 'SOURCE_CONTENT' END::text,
           sv.item_ordinal::bigint, NULL::uuid, sv.public_text_body
      FROM public.resolve_public_experience_serving_v1(v_post.experience_id, v_lease.requester_user_id) sv
     WHERE sv.experience_version_id = v_entry.experience_version_id AND sv.public_text_body IS NOT NULL
     ORDER BY sv.item_ordinal;
  RETURN QUERY
    SELECT 'POST'::text, CASE WHEN d.post_id = p_post_id THEN 'INVOKING' ELSE 'PARTICIPANT' END::text, d.post_ordinal, d.post_id, d.post_body
      FROM (SELECT x.* FROM public.resolve_public_discussion_v1(v_post.experience_id, v_lease.requester_user_id) x
             WHERE x.post_ordinal <= v_post.post_ordinal ORDER BY x.post_ordinal DESC LIMIT 40) d
     ORDER BY d.post_ordinal;
  RETURN QUERY
    SELECT 'QANDEEL'::text, NULL::text, q.response_ordinal, NULL::uuid, q.response_body
      FROM (SELECT x.* FROM public.resolve_public_qandeel_responses_v1(v_post.experience_id, v_lease.requester_user_id) x
             ORDER BY x.response_ordinal DESC LIMIT 20) q
     ORDER BY q.response_ordinal;
  RETURN QUERY
    SELECT 'RELATED'::text, NULL::text, row_number() OVER (ORDER BY o.other_id)::bigint, NULL::uuid, ve.meaning
      FROM (SELECT CASE WHEN r.source_experience_id = v_post.experience_id THEN r.target_experience_id ELSE r.source_experience_id END AS other_id
              FROM public_relation_private.explicit_relations r
             WHERE (r.source_experience_id = v_post.experience_id OR r.target_experience_id = v_post.experience_id)
               AND public_relation_private.derive_relation_life_v1(r.id) = 'ACTIVE'
               AND public_relation_private.relation_is_current_v1(r.id)
             ORDER BY 1 LIMIT 24) o
      CROSS JOIN LATERAL public_spatial_private.derive_visible_spatial_entry_v1(o.other_id) ve;
END$$;

-- G.3 COMPLETE. Record the ONE response through the frozen 0096 writer, only while the lease is live and the context the
--     model read is still exactly what is served: the same served version, the invoking post still served, the requester
--     still admitted and entitled, every consumed post still on that version.
--       RESPONSE_RECORDED | ALREADY_COMMITTED | STALE (anything moved — the result is discarded) | UNAVAILABLE (no live lease)
--     The lease is always ended.
CREATE FUNCTION public_discussion_private.complete_public_qandeel_work_v1(
  p_post_id uuid, p_lease_id uuid, p_experience_version_id uuid, p_response_body text, p_consumed_post_ids uuid[]
) RETURNS TABLE (outcome text, response_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_lease public_discussion_private.qandeel_work_leases;
  v_post public.public_discussion_posts;
  v_invocation public_discussion_private.qandeel_invocations;
  v_written record;
BEGIN
  IF p_post_id IS NULL OR p_lease_id IS NULL OR p_experience_version_id IS NULL OR p_consumed_post_ids IS NULL
     OR array_position(p_consumed_post_ids, NULL) IS NOT NULL
     OR p_response_body IS NULL OR length(btrim(p_response_body)) = 0 OR length(p_response_body) > 4000 THEN
    RAISE EXCEPTION 'PUBLIC_QANDEEL_WORK_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT l.* INTO v_lease FROM public_discussion_private.qandeel_work_leases l
   WHERE l.post_id = p_post_id AND l.lease_id = p_lease_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  DELETE FROM public_discussion_private.qandeel_work_leases l WHERE l.post_id = p_post_id AND l.lease_id = p_lease_id;
  IF v_lease.expires_at <= CURRENT_TIMESTAMP THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;
  SELECT i.* INTO v_invocation FROM public_discussion_private.qandeel_invocations i WHERE i.post_id = p_post_id FOR UPDATE;
  IF v_invocation.response_id IS NOT NULL THEN
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, v_invocation.response_id;
    RETURN;
  END IF;
  SELECT p.* INTO v_post FROM public.public_discussion_posts p WHERE p.id = p_post_id;
  IF public_discussion_private.served_version_v1(v_post.experience_id) IS DISTINCT FROM p_experience_version_id
     OR v_post.target_experience_version_id <> p_experience_version_id
     OR NOT public_discussion_private.is_admitted_v1(v_lease.requester_user_id)
     OR NOT public_discussion_private.is_entitled_v1(v_lease.requester_user_id) THEN
    UPDATE public_discussion_private.qandeel_invocations i SET last_unavailable_at = clock_timestamp() WHERE i.post_id = p_post_id;
    RETURN QUERY SELECT 'STALE'::text, NULL::uuid;
    RETURN;
  END IF;
  BEGIN
    SELECT w.* INTO v_written
      FROM public.record_public_qandeel_response_v1(pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid(), v_post.experience_id,
                                                    p_post_id, p_response_body, p_consumed_post_ids) w;
  EXCEPTION WHEN SQLSTATE 'P0002' THEN
    UPDATE public_discussion_private.qandeel_invocations i SET last_unavailable_at = clock_timestamp() WHERE i.post_id = p_post_id;
    RETURN QUERY SELECT 'STALE'::text, NULL::uuid;
    RETURN;
  END;
  UPDATE public_discussion_private.qandeel_invocations i SET response_id = v_written.response_id WHERE i.post_id = p_post_id;
  PERFORM public.recompute_public_experience_vitality_v1(v_post.experience_id);
  RETURN QUERY SELECT 'RESPONSE_RECORDED'::text, v_written.response_id;
END$$;

-- G.4 END. Return the exact holder's lease; when the work could not answer, record that the invocation is unanswered so
--     the discussion can say so truthfully. A late return never releases a newer holder's lease.
CREATE FUNCTION public_discussion_private.end_public_qandeel_work_v1(p_post_id uuid, p_lease_id uuid, p_unanswered boolean)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_held boolean;
BEGIN
  IF p_post_id IS NULL OR p_lease_id IS NULL OR p_unanswered IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_QANDEEL_WORK_INVALID' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public_discussion_private.qandeel_work_leases l WHERE l.post_id = p_post_id AND l.lease_id = p_lease_id;
  v_held := FOUND;
  IF v_held AND p_unanswered THEN
    UPDATE public_discussion_private.qandeel_invocations i SET last_unavailable_at = clock_timestamp()
     WHERE i.post_id = p_post_id AND i.response_id IS NULL;
  END IF;
  RETURN v_held;
END$$;

-- =====================================================================================================================
-- H. THE SERVER CHANNEL: the Public Activity source read (service_role). The API names ONE durable source fact; the
--    database derives every recipient from canonical Public truth (Product Owner D5). Never the actor; only admitted
--    humans; nothing for anything not served or no longer current. A client never names a recipient.
--      DISCUSSION_POST    a reply → the parent post's author (REPLY_TO_OWN_POST); a top-level post → every controller of
--                         the Experience (POST_ON_OWN_EXPERIENCE)
--      RELATION_REQUEST   a PENDING current relation → every controller of the target Experience
--      RELATION_ACCEPTED  an ACTIVE current relation → every controller of the source Experience
--      RELATION_ENDED     any relation → every controller of the target Experience (to withdraw a request item; no item)
-- =====================================================================================================================
CREATE FUNCTION public_discussion_private.server_read_public_activity_source_v1(p_source_kind text, p_source_id uuid)
RETURNS TABLE (recipient_user_id uuid, event_kind text, experience_id uuid, relation_id uuid, occurred_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_post public.public_discussion_posts;
  v_parent public.public_discussion_posts;
  v_relation public_relation_private.explicit_relations;
  v_life text;
  v_at timestamptz;
BEGIN
  IF p_source_kind IS NULL OR p_source_id IS NULL
     OR p_source_kind NOT IN ('DISCUSSION_POST', 'RELATION_REQUEST', 'RELATION_ACCEPTED', 'RELATION_ENDED') THEN
    RAISE EXCEPTION 'PUBLIC_ACTIVITY_SOURCE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_source_kind = 'DISCUSSION_POST' THEN
    SELECT p.* INTO v_post FROM public.public_discussion_posts p WHERE p.id = p_source_id;
    IF NOT FOUND OR public_discussion_private.served_version_v1(v_post.experience_id) IS DISTINCT FROM v_post.target_experience_version_id THEN
      RETURN;
    END IF;
    IF v_post.parent_post_id IS NOT NULL THEN
      SELECT p.* INTO v_parent FROM public.public_discussion_posts p WHERE p.id = v_post.parent_post_id;
      RETURN QUERY
        SELECT v_parent.author_user_id, 'REPLY_TO_OWN_POST'::text, v_post.experience_id, NULL::uuid, v_post.posted_at
         WHERE v_parent.author_user_id <> v_post.author_user_id
           AND public_discussion_private.is_admitted_v1(v_parent.author_user_id);
    ELSE
      RETURN QUERY
        SELECT c.controller_user_id, 'POST_ON_OWN_EXPERIENCE'::text, v_post.experience_id, NULL::uuid, v_post.posted_at
          FROM public.public_experience_controllers c
         WHERE c.experience_id = v_post.experience_id AND c.controller_user_id <> v_post.author_user_id
           AND public_discussion_private.is_admitted_v1(c.controller_user_id)
         ORDER BY c.controller_user_id;
    END IF;
    RETURN;
  END IF;
  SELECT r.* INTO v_relation FROM public_relation_private.explicit_relations r WHERE r.id = p_source_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  v_life := public_relation_private.derive_relation_life_v1(v_relation.id);
  IF p_source_kind = 'RELATION_ENDED' THEN
    RETURN QUERY
      SELECT c.controller_user_id, 'RELATION_REQUEST'::text, v_relation.target_experience_id, v_relation.id, v_relation.requested_at
        FROM public.public_experience_controllers c WHERE c.experience_id = v_relation.target_experience_id
       ORDER BY c.controller_user_id;
    RETURN;
  END IF;
  IF NOT public_relation_private.relation_is_current_v1(v_relation.id)
     OR (p_source_kind = 'RELATION_REQUEST' AND v_life <> 'PENDING')
     OR (p_source_kind = 'RELATION_ACCEPTED' AND v_life <> 'ACTIVE') THEN
    RETURN;
  END IF;
  IF p_source_kind = 'RELATION_REQUEST' THEN
    RETURN QUERY
      SELECT c.controller_user_id, 'RELATION_REQUEST'::text, v_relation.target_experience_id, v_relation.id, v_relation.requested_at
        FROM public.public_experience_controllers c
       WHERE c.experience_id = v_relation.target_experience_id AND public_discussion_private.is_admitted_v1(c.controller_user_id)
       ORDER BY c.controller_user_id;
  ELSE
    SELECT a.acted_at INTO v_at FROM public_relation_private.explicit_relation_acts a
     WHERE a.relation_id = v_relation.id AND a.act = 'ACCEPT';
    RETURN QUERY
      SELECT c.controller_user_id, 'RELATION_ACCEPTED'::text, v_relation.source_experience_id, v_relation.id, v_at
        FROM public.public_experience_controllers c
       WHERE c.experience_id = v_relation.source_experience_id AND public_discussion_private.is_admitted_v1(c.controller_user_id)
       ORDER BY c.controller_user_id;
  END IF;
END$$;

-- =====================================================================================================================
-- I. THE EXPOSED WRAPPERS: SECURITY INVOKER, each a one-line call into its definer.
-- =====================================================================================================================
CREATE FUNCTION public.post_own_public_discussion_v1(p_command_id uuid, p_experience_id uuid, p_reply_to_post_id uuid, p_body text)
RETURNS TABLE (outcome text, post_id uuid, thread_root_id uuid, post_ordinal bigint, qandeel_invoked boolean)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.post_id, r.thread_root_id, r.post_ordinal, r.qandeel_invoked
    FROM public_discussion_private.post_own_public_discussion_v1(p_command_id, p_experience_id, p_reply_to_post_id, p_body) r;
$$;
CREATE FUNCTION public.read_public_discussion_posts_v1(p_experience_id uuid, p_after_ordinal bigint)
RETURNS TABLE (post_id uuid, thread_root_id uuid, post_ordinal bigint, author_label_mode text, author_display_label text,
               post_body text, posted_at timestamptz, is_own boolean, qandeel_state text, qandeel_response_body text,
               qandeel_responded_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.post_id, r.thread_root_id, r.post_ordinal, r.author_label_mode, r.author_display_label, r.post_body, r.posted_at,
         r.is_own, r.qandeel_state, r.qandeel_response_body, r.qandeel_responded_at
    FROM public_discussion_private.read_public_discussion_posts_v1(p_experience_id, p_after_ordinal) r;
$$;
CREATE FUNCTION public.read_public_discussion_capability_v1(p_experience_id uuid)
RETURNS TABLE (can_contribute boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.can_contribute FROM public_discussion_private.read_public_discussion_capability_v1(p_experience_id) r;
$$;
CREATE FUNCTION public.begin_public_qandeel_work_v1(p_post_id uuid, p_requester_user_id uuid)
RETURNS TABLE (work_outcome text, work_lease_id uuid)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.work_outcome, r.work_lease_id FROM public_discussion_private.begin_public_qandeel_work_v1(p_post_id, p_requester_user_id) r;
$$;
CREATE FUNCTION public.read_public_qandeel_context_v1(p_post_id uuid, p_lease_id uuid)
RETURNS TABLE (context_kind text, context_role text, context_ordinal bigint, context_ref uuid, context_text text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.context_kind, r.context_role, r.context_ordinal, r.context_ref, r.context_text
    FROM public_discussion_private.read_public_qandeel_context_v1(p_post_id, p_lease_id) r;
$$;
CREATE FUNCTION public.complete_public_qandeel_work_v1(
  p_post_id uuid, p_lease_id uuid, p_experience_version_id uuid, p_response_body text, p_consumed_post_ids uuid[]
) RETURNS TABLE (outcome text, response_id uuid)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.response_id
    FROM public_discussion_private.complete_public_qandeel_work_v1(p_post_id, p_lease_id, p_experience_version_id, p_response_body, p_consumed_post_ids) r;
$$;
CREATE FUNCTION public.end_public_qandeel_work_v1(p_post_id uuid, p_lease_id uuid, p_unanswered boolean)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT public_discussion_private.end_public_qandeel_work_v1(p_post_id, p_lease_id, p_unanswered);
$$;
CREATE FUNCTION public.server_read_public_activity_source_v1(p_source_kind text, p_source_id uuid)
RETURNS TABLE (recipient_user_id uuid, event_kind text, experience_id uuid, relation_id uuid, occurred_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.recipient_user_id, r.event_kind, r.experience_id, r.relation_id, r.occurred_at
    FROM public_discussion_private.server_read_public_activity_source_v1(p_source_kind, p_source_id) r;
$$;

-- =====================================================================================================================
-- J. PRIVILEGES. Ownership; default-deny by name; then the exact grants. Nothing relies on a default (0133).
--    authenticated: the human post, the discussion read, the capability read.
--    service_role:  the four QANDEEL work commands and the Activity source read.
--    Nobody:        the seam, the derivations, the trigger, the frozen 0096 / 0097 primitives (unchanged).
-- =====================================================================================================================
ALTER TABLE public_discussion_private.qandeel_invocations OWNER TO postgres;
ALTER TABLE public_discussion_private.qandeel_work_leases OWNER TO postgres;
ALTER TABLE public_discussion_private.qandeel_work_grants OWNER TO postgres;
ALTER TABLE public_discussion_private.qandeel_invocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_discussion_private.qandeel_work_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_discussion_private.qandeel_work_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public_discussion_private.qandeel_invocations, public_discussion_private.qandeel_work_leases,
  public_discussion_private.qandeel_work_grants FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_fn text;
  v_human text[] := ARRAY[
    'public_discussion_private.post_own_public_discussion_v1(uuid, uuid, uuid, text)',
    'public_discussion_private.read_public_discussion_posts_v1(uuid, bigint)',
    'public_discussion_private.read_public_discussion_capability_v1(uuid)',
    'public.post_own_public_discussion_v1(uuid, uuid, uuid, text)',
    'public.read_public_discussion_posts_v1(uuid, bigint)',
    'public.read_public_discussion_capability_v1(uuid)'];
  v_server text[] := ARRAY[
    'public_discussion_private.begin_public_qandeel_work_v1(uuid, uuid)',
    'public_discussion_private.read_public_qandeel_context_v1(uuid, uuid)',
    'public_discussion_private.complete_public_qandeel_work_v1(uuid, uuid, uuid, text, uuid[])',
    'public_discussion_private.end_public_qandeel_work_v1(uuid, uuid, boolean)',
    'public_discussion_private.server_read_public_activity_source_v1(text, uuid)',
    'public.begin_public_qandeel_work_v1(uuid, uuid)',
    'public.read_public_qandeel_context_v1(uuid, uuid)',
    'public.complete_public_qandeel_work_v1(uuid, uuid, uuid, text, uuid[])',
    'public.end_public_qandeel_work_v1(uuid, uuid, boolean)',
    'public.server_read_public_activity_source_v1(text, uuid)'];
  v_internal text[] := ARRAY[
    'public_discussion_private.resolve_public_discussion_entitlement_v1(uuid)',
    'public_discussion_private.guard_invocation_v1()',
    'public_discussion_private.qandeel_work_policy_v1()',
    'public_discussion_private.invokes_qandeel_v1(text)',
    'public_discussion_private.is_entitled_v1(uuid)',
    'public_discussion_private.is_admitted_v1(uuid)',
    'public_discussion_private.served_version_v1(uuid)'];
BEGIN
  FOREACH v_fn IN ARRAY v_human || v_server || v_internal LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', v_fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', v_fn);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'REVOKE ALL ON TABLE public_discussion_private.qandeel_invocations, public_discussion_private.qandeel_work_leases, '
            'public_discussion_private.qandeel_work_grants FROM service_role';
    EXECUTE 'GRANT USAGE ON SCHEMA public_discussion_private TO service_role';
    FOREACH v_fn IN ARRAY v_server LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_fn);
    END LOOP;
  END IF;
  EXECUTE 'GRANT USAGE ON SCHEMA public_discussion_private TO authenticated';
  FOREACH v_fn IN ARRAY v_human LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_fn);
  END LOOP;
END$$;

-- =====================================================================================================================
-- K. DEPLOY-TIME SELF-ASSERTIONS: the boundary is what this file says, or the migration fails.
-- =====================================================================================================================
DO $$
DECLARE
  v_role text;
  p record;
BEGIN
  -- K1. The frozen primitives stay executable by no application role; the frozen resolvers stay service_role only.
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = v_role)
       AND (has_function_privilege(v_role, 'public.post_public_discussion_v1(uuid, uuid, uuid, uuid, text)', 'EXECUTE')
            OR has_function_privilege(v_role, 'public.record_public_qandeel_response_v1(uuid, uuid, uuid, uuid, text, uuid[])', 'EXECUTE')
            OR has_function_privilege(v_role, 'public.recompute_public_experience_vitality_v1(uuid)', 'EXECUTE')
            OR has_function_privilege(v_role, 'public_discussion_private.resolve_public_discussion_entitlement_v1(uuid)', 'EXECUTE')
            OR has_function_privilege(v_role, 'public_discussion_private.invokes_qandeel_v1(text)', 'EXECUTE')
            OR has_function_privilege(v_role, 'public.publish_public_experience_v1(uuid, uuid, uuid)', 'EXECUTE')) THEN
      RAISE EXCEPTION 'S5-04: % executes a frozen primitive, the entitlement seam or a derivation', v_role;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'authenticated')
     AND (has_function_privilege('authenticated', 'public.resolve_public_discussion_v1(uuid, uuid)', 'EXECUTE')
          OR has_function_privilege('authenticated', 'public.resolve_public_qandeel_responses_v1(uuid, uuid)', 'EXECUTE')
          OR has_function_privilege('authenticated', 'public.begin_public_qandeel_work_v1(uuid, uuid)', 'EXECUTE')
          OR has_function_privilege('authenticated', 'public.server_read_public_activity_source_v1(text, uuid)', 'EXECUTE')) THEN
    RAISE EXCEPTION 'S5-04: a human reaches a server-channel read or command';
  END IF;

  -- K2. Publication and contribution stay fail-closed: both CW2-08 seams answer NOT_EVALUATED.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = 'public.resolve_public_publication_prerequisites_v1(uuid, uuid)'::regprocedure;
  IF p.prosrc !~ 'NOT_EVALUATED' OR p.prosrc ~ '''CLEARED''' THEN
    RAISE EXCEPTION 'S5-04: the CW2-08 publication seam must still answer NOT_EVALUATED';
  END IF;
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = 'public_discussion_private.resolve_public_discussion_entitlement_v1(uuid)'::regprocedure;
  IF p.prosrc !~ 'NOT_EVALUATED' OR p.prosrc ~ '''ENTITLED''' THEN
    RAISE EXCEPTION 'S5-04: the discussion entitlement seam must answer NOT_EVALUATED';
  END IF;

  -- K3. The PUBLIC CONTEXT FIREWALL. Nothing S5-04 owns reads private truth, sealed provenance, a source World, an
  --     account's private identity or a contact, or writes outside its own family, the frozen 0096 / 0097 writers and the
  --     S5-02 identity provisioning.
  FOR p IN SELECT pr.proname, pr.prosrc FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'public_discussion_private' LOOP
    IF p.prosrc ~* '(provenance|shared_world|shared_private|conversation_|memor|human_model|(^|[^a-z])him_|hypothes|matching|introduction|standing_context|personal_|login_id|email|public\.users|derivative_bodies|source_world)' THEN
      RAISE EXCEPTION 'S5-04: % reaches beyond the public-visible boundary', p.proname;
    END IF;
    IF p.prosrc ~* '(INSERT INTO|UPDATE|DELETE FROM)\s+public(_spatial_private|_semantic_private|_authoring_private|_world_private|_relation_private)?\.' THEN
      RAISE EXCEPTION 'S5-04: % writes outside its own family', p.proname;
    END IF;
  END LOOP;

  -- K4. Every S5-04 private function is a pinned postgres-owned SECURITY DEFINER.
  FOR p IN SELECT pr.proname, pr.prosecdef, pr.proconfig, pg_get_userbyid(pr.proowner) AS owner
             FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace WHERE n.nspname = 'public_discussion_private' LOOP
    IF NOT p.prosecdef OR p.owner <> 'postgres' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""'] THEN
      RAISE EXCEPTION 'S5-04: public_discussion_private.% must be a pinned postgres-owned definer', p.proname;
    END IF;
  END LOOP;

  -- K5. No new table holds discussion text, a response, an account name, or a contact.
  IF EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public_discussion_private' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
                AND a.atttypid IN ('text'::regtype, 'text[]'::regtype, 'varchar'::regtype, 'jsonb'::regtype, 'tsvector'::regtype)) THEN
    RAISE EXCEPTION 'S5-04: a discussion-integration table must hold no text';
  END IF;

  -- K6. Still one Public World, the signed-out policy untouched.
  IF (SELECT count(*) FROM public.public_world_state) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.public_audience_policy_state p2 WHERE p2.signed_out_viewing_policy = 'UNRESOLVED') THEN
    RAISE EXCEPTION 'S5-04: one Public World, and the signed-out policy still UNRESOLVED';
  END IF;
END$$;

COMMIT;
