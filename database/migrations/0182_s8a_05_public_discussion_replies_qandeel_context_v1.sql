-- S8A-05 CP4 — Public discussion: exact reply targets, the topic's author (OP), the branch-scoped @qandeel context and the
-- Public QANDEEL reply cost family.
--
-- Product authority: the Product Owner's S8A-05 CP4 order (2026-10-27), which applies the WP1 design with its binding
-- WP1-R1 corrections, and the Product Owner's CP4 scope decision of the same day: editing a published topic and the
-- discussion across versions (WP1-R1 §3, V-1 .. V-14) are NOT here — the frozen I-05 publication core admits no successor
-- version of a PUBLISHED Experience, and that work is its own PRE-LAUNCH BLOCKER task (QAN-BL-PUB-REV-01), done and tested
-- before Stage 9 opens production publishing. The controlled amendment is
-- docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-05_PUBLIC_DISCUSSION_CONTROLLED_AMENDMENT_v1.0.md
-- (A-5(a) – A-5(c)); the implementation record is
-- docs/e2e/QANDEEL_S8A_05_PUBLIC_WORLD_WRITE_YOUR_TOPIC_IMPLEMENTATION_RECORD_v1.md §13.
--
-- ## What is added
--
--   A. AI-COST-01: the feature family PUBLIC_QANDEEL_REPLY — a Public QANDEEL response is paid by the human whose post
--      invoked it, under its own family (it was booked as CONVERSATION_REPLY).
--   B. Schema public_thread_private (not exposed through the Data API; RLS on, no policy; postgres-owned):
--        reply_targets   the EXACT post a reply answers (A-5(a)). 0096 keeps storing the thread root (one visible depth,
--                        S5-04 D2) and is not changed; this side table keeps what the root loses. No text, no account.
--   C. The human command post_own_public_discussion_v2: the UNCHANGED 0147 command (admission, entitlement, the frozen
--      0096 writer, the @qandeel invocation, the 0097 recompute) and then, for a reply, its exact target. Nothing else.
--   D. The viewer read read_public_discussion_posts_v2: the UNCHANGED 0147 read, plus each post's exact reply target and
--      whether its author is the topic's author (OP, A-5(b)) — a boolean derived from the Experience's creating Public
--      Identity, never a name comparison and never an identifier on the wire.
--   E. The server read read_public_qandeel_context_v2 (A-5(c)): under the same live 0147 lease, from public-visible truth
--      only — the topic as one bounded text (6 KB, the 0180 bounded input with the author's and QANDEEL's words labelled),
--      its reviewed meaning and themes, the invoking post's BRANCH (the chain of exact reply targets up to the thread root,
--      and at most 8 more posts of the same thread before it) with each post's speaker role (OP / ASKER / PARTICIPANT)
--      and the post it answers, and the earlier Public QANDEEL responses attached to those posts. Not the whole
--      discussion, not related topics, no author, display, account or identifier.
--   F. The Public Activity source read (0147 H) forward-replaced: REPLY_TO_OWN_POST goes to the author of the EXACT post a
--      reply answers; a reply recorded before this migration (no target) still goes to its thread root's author.
--
-- ## What is deliberately NOT here
--
--   * No successor version, no edit of a published topic, no discussion across versions (QAN-BL-PUB-REV-01).
--   * No change to 0096, 0097, 0147's command, reads, lease or completion; no new discussion, reply, lease or response
--     runtime. The completion is 0147's, unchanged.
--   * No publication: the CW2-08 seam and the discussion entitlement seam still answer NOT_EVALUATED.
--
-- Forward-only. Migrations 0001-0181 are byte-unchanged.
BEGIN;

-- =====================================================================================================================
-- A. AI-COST-01: the Public QANDEEL reply family.
-- =====================================================================================================================
ALTER TABLE public.ai_provider_calls DROP CONSTRAINT ai_provider_calls_feature_family_check;
ALTER TABLE public.ai_provider_calls ADD CONSTRAINT ai_provider_calls_feature_family_check CHECK (feature_family IN (
  'CONVERSATION_REPLY', 'CU_SEGMENTATION', 'FOCUS_RESOLUTION', 'THREAD_FORMATION', 'THREAD_CONTINUITY',
  'HYPOTHESIS_INTENT_EXTRACTION', 'HYPOTHESIS_EVIDENCE_ASSOCIATION', 'HYPOTHESIS_CANDIDATE_GENERATION',
  'PERSONAL_UNDERSTANDING_CAPTURE', 'SHARED_SEMANTIC_READING', 'SHARED_KNOWLEDGE_RECALL', 'SHARED_SPATIAL_PLACEMENT',
  'SHARED_DISCLOSURE_JUDGE', 'PUBLIC_SEMANTIC_INTERPRETATION', 'PUBLIC_QANDEEL_REPLY'));

-- =====================================================================================================================
-- B. THE SCHEMA AND THE EXACT REPLY TARGET.
-- =====================================================================================================================
CREATE SCHEMA public_thread_private;
ALTER SCHEMA public_thread_private OWNER TO postgres;
REVOKE ALL ON SCHEMA public_thread_private FROM PUBLIC;

CREATE TABLE public_thread_private.reply_targets (
  post_id uuid NOT NULL,
  experience_id uuid NOT NULL,
  reply_to_post_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL,
  CONSTRAINT reply_targets_pk PRIMARY KEY (post_id),
  CONSTRAINT reply_targets_self_check CHECK (reply_to_post_id <> post_id),
  CONSTRAINT reply_targets_post_fk FOREIGN KEY (post_id, experience_id)
    REFERENCES public.public_discussion_posts (id, experience_id) ON DELETE RESTRICT,
  CONSTRAINT reply_targets_target_fk FOREIGN KEY (reply_to_post_id, experience_id)
    REFERENCES public.public_discussion_posts (id, experience_id) ON DELETE RESTRICT
);
CREATE INDEX reply_targets_target_idx ON public_thread_private.reply_targets (reply_to_post_id);
COMMENT ON TABLE public_thread_private.reply_targets IS
  'S8A-05 CP4 (A-5(a)): the exact post a Public discussion reply answers, beside the 0096 thread root. Append-only; '
  'no text, no account; both posts are of the same Experience.';

CREATE FUNCTION public_thread_private.reject_reply_target_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'PUBLIC_REPLY_TARGET_IS_IMMUTABLE' USING ERRCODE = '55000';
END$$;
CREATE TRIGGER reply_targets_immutable BEFORE UPDATE OR DELETE ON public_thread_private.reply_targets
  FOR EACH ROW EXECUTE FUNCTION public_thread_private.reject_reply_target_mutation_v1();

-- =====================================================================================================================
-- C. THE HUMAN COMMAND (authenticated; the author is auth.uid()). The 0147 command, unchanged, decides everything —
--    admission, entitlement, the served version, that the target is a served post of it, the thread root, the frozen
--    0096 writer, the @qandeel invocation and the 0097 recompute. For a reply it then keeps the exact target, in the same
--    transaction. A retry of a committed command answers as 0147 does and writes nothing.
-- =====================================================================================================================
CREATE FUNCTION public_thread_private.post_own_public_discussion_v2(
  p_command_id uuid, p_experience_id uuid, p_reply_to_post_id uuid, p_body text
) RETURNS TABLE (outcome text, post_id uuid, thread_root_id uuid, post_ordinal bigint, qandeel_invoked boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_done record;
BEGIN
  SELECT r.* INTO v_done
    FROM public_discussion_private.post_own_public_discussion_v1(p_command_id, p_experience_id, p_reply_to_post_id, p_body) r;
  IF v_done.outcome = 'REPLIED' AND p_reply_to_post_id IS NOT NULL THEN
    INSERT INTO public_thread_private.reply_targets (post_id, experience_id, reply_to_post_id, recorded_at)
    VALUES (v_done.post_id, p_experience_id, p_reply_to_post_id, clock_timestamp());
  END IF;
  RETURN QUERY SELECT v_done.outcome, v_done.post_id, v_done.thread_root_id, v_done.post_ordinal, v_done.qandeel_invoked;
END$$;

-- =====================================================================================================================
-- D. THE VIEWER READ (authenticated; the viewer is auth.uid()). Exactly the 0147 read — the served version's posts,
--    paged, each with its display, thread root, own flag and QANDEEL state — plus:
--      reply_to_post_id  the exact post this reply answers; for a reply recorded before 0182, its thread root (the only
--                        target 0096 kept); NULL for a top-level post
--      is_op             the post's author is the topic's author: the post's Public Identity is the Experience's creating
--                        Public Identity (survives an Alias change; never the holder of an included material's rights)
-- =====================================================================================================================
CREATE FUNCTION public_thread_private.read_public_discussion_posts_v2(p_experience_id uuid, p_after_ordinal bigint)
RETURNS TABLE (post_id uuid, thread_root_id uuid, post_ordinal bigint, author_label_mode text, author_display_label text,
               post_body text, posted_at timestamptz, is_own boolean, qandeel_state text, qandeel_response_body text,
               qandeel_responded_at timestamptz, reply_to_post_id uuid, is_op boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT d.post_id, d.thread_root_id, d.post_ordinal, d.author_label_mode, d.author_display_label, d.post_body, d.posted_at,
         d.is_own, d.qandeel_state, d.qandeel_response_body, d.qandeel_responded_at,
         coalesce(rt.reply_to_post_id, p.parent_post_id),
         (p.author_public_identity_ref = e.created_by_public_identity_ref)
    FROM public_discussion_private.read_public_discussion_posts_v1(p_experience_id, p_after_ordinal) d
    JOIN public.public_discussion_posts p ON p.id = d.post_id
    JOIN public.public_experiences e ON e.id = p.experience_id
    LEFT JOIN public_thread_private.reply_targets rt ON rt.post_id = d.post_id
   ORDER BY d.post_ordinal;
$$;

-- =====================================================================================================================
-- E. THE SERVER CHANNEL: the branch-scoped Public QANDEEL context (service_role), read only under the live 0147 lease,
--    from public-visible truth only, as the requester is served now:
--      VERSION   the exact served version (context_ref), for 0147's revalidation at completion
--      TOPIC     the topic as ONE bounded text (≤ 6 KB): 0180's bounded input for a package with a sealed presentation
--                (TITLE / AUTHOR_TEXT / AUTHOR / QANDEEL / QANDEEL_UNDERSTANDING lines), otherwise the title and the
--                served items, the author's words as AUTHOR and QANDEEL's published analysis as QANDEEL, cut at the bound
--      MEANING   the reviewed meaning; THEME each reviewed primary / secondary theme
--      POST      the BRANCH: the invoking post (INVOKING), the chain of exact reply targets up to the thread root, the root,
--                and at most 8 more posts of the same thread before the invoking post (THREAD); each with its speaker —
--                OP (the topic's author), ASKER (the invoking post's author) or PARTICIPANT — and the post it answers
--      QANDEEL   each served earlier Public QANDEEL response to one of those posts, with the post it answered
--    Nothing else: no other thread, no related topic, no author, display, account or identifier but post / response ids.
--    Nothing at all when the lease is not live or anything is no longer served.
-- =====================================================================================================================
CREATE FUNCTION public_thread_private.read_public_qandeel_context_v2(p_post_id uuid, p_lease_id uuid)
RETURNS TABLE (context_kind text, context_role text, context_ordinal bigint, context_ref uuid, context_text text,
               speaker text, answers_ref uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_lease public_discussion_private.qandeel_work_leases;
  v_post public.public_discussion_posts;
  v_entry record;
  v_manifest uuid;
  v_creator uuid;
  v_root uuid;
  v_topic text;
  v_chosen uuid[];
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
  SELECT vs.visible_manifest_version_id INTO v_manifest
    FROM public.resolve_public_visibility_state_v1(v_post.experience_id) vs
   WHERE vs.visibility_state = 'PUBLICLY_VISIBLE' AND vs.visible_experience_version_id = v_entry.experience_version_id;
  IF v_manifest IS NULL THEN
    RETURN;
  END IF;
  SELECT e.created_by_public_identity_ref INTO v_creator FROM public.public_experiences e WHERE e.id = v_post.experience_id;
  v_root := coalesce(v_post.parent_post_id, v_post.id);

  -- The topic, bounded (6 KB): 0180's labelled input where the package has a sealed presentation, else the served items.
  IF EXISTS (SELECT 1 FROM public_compose_source_private.item_presentation ip WHERE ip.manifest_version_id = v_manifest) THEN
    v_topic := public_compose_source_private.qandeel_context_v1(v_manifest);
  ELSE
    SELECT public_compose_source_private.bounded_text_v1(
             coalesce((SELECT 'TITLE: ' || t.title || E'\n' FROM public_compose_private.version_titles t
                        WHERE t.experience_version_id = v_entry.experience_version_id AND t.title IS NOT NULL), '')
             || coalesce(string_agg(CASE sv.derivative_classification WHEN 'ANALYTICAL_DERIVATIVE' THEN 'QANDEEL' ELSE 'AUTHOR' END
                                    || ': ' || sv.public_text_body, E'\n' ORDER BY sv.item_ordinal), ''),
             public_compose_source_private.qandeel_context_bytes_v1())
      INTO v_topic
      FROM public.resolve_public_experience_serving_v1(v_post.experience_id, v_lease.requester_user_id) sv
     WHERE sv.experience_version_id = v_entry.experience_version_id AND sv.public_text_body IS NOT NULL;
  END IF;

  -- The branch: the exact-target chain to the root, the root, and the last 8 other posts of the thread before the invoker.
  WITH RECURSIVE thread AS (
    SELECT d.post_id AS id, d.post_ordinal AS ordinal, d.parent_post_id AS parent
      FROM public.resolve_public_discussion_v1(v_post.experience_id, v_lease.requester_user_id) d
     WHERE coalesce(d.parent_post_id, d.post_id) = v_root AND d.post_ordinal <= v_post.post_ordinal
  ), targets AS (
    SELECT t.id, coalesce(rt.reply_to_post_id, t.parent) AS target
      FROM thread t LEFT JOIN public_thread_private.reply_targets rt ON rt.post_id = t.id
  ), chain(id) AS (
    SELECT p_post_id
    UNION
    SELECT tg.target FROM chain c JOIN targets tg ON tg.id = c.id WHERE tg.target IS NOT NULL
  ), recent AS (
    SELECT t.id FROM thread t WHERE t.id <> p_post_id ORDER BY t.ordinal DESC LIMIT 8
  )
  SELECT array_agg(DISTINCT x.id) INTO v_chosen
    FROM (SELECT c.id FROM chain c UNION SELECT v_root UNION SELECT r.id FROM recent r) x
   WHERE x.id IN (SELECT t.id FROM thread t);
  IF v_chosen IS NULL OR NOT (p_post_id = ANY (v_chosen)) THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT 'VERSION'::text, NULL::text, 0::bigint, v_entry.experience_version_id, NULL::text, NULL::text, NULL::uuid;
  RETURN QUERY SELECT 'TOPIC'::text, NULL::text, 0::bigint, NULL::uuid, v_topic, NULL::text, NULL::uuid
                WHERE v_topic IS NOT NULL AND length(btrim(v_topic)) > 0;
  RETURN QUERY SELECT 'MEANING'::text, NULL::text, 0::bigint, NULL::uuid, v_entry.meaning, NULL::text, NULL::uuid;
  RETURN QUERY SELECT 'THEME'::text, 'PRIMARY'::text, t.n, NULL::uuid, t.theme, NULL::text, NULL::uuid
                 FROM unnest(v_entry.primary_themes) WITH ORDINALITY AS t(theme, n);
  RETURN QUERY SELECT 'THEME'::text, 'SECONDARY'::text, t.n, NULL::uuid, t.theme, NULL::text, NULL::uuid
                 FROM unnest(v_entry.secondary_themes) WITH ORDINALITY AS t(theme, n);
  RETURN QUERY
    SELECT 'POST'::text, CASE WHEN d.post_id = p_post_id THEN 'INVOKING' ELSE 'THREAD' END::text, d.post_ordinal, d.post_id,
           d.post_body,
           CASE WHEN d.author_public_identity_ref = v_creator THEN 'OP'
                WHEN d.author_public_identity_ref = v_post.author_public_identity_ref THEN 'ASKER'
                ELSE 'PARTICIPANT' END::text,
           coalesce(rt.reply_to_post_id, d.parent_post_id)
      FROM public.resolve_public_discussion_v1(v_post.experience_id, v_lease.requester_user_id) d
      LEFT JOIN public_thread_private.reply_targets rt ON rt.post_id = d.post_id
     WHERE d.post_id = ANY (v_chosen)
     ORDER BY d.post_ordinal;
  RETURN QUERY
    SELECT 'QANDEEL'::text, NULL::text, q.response_ordinal, q.response_id, q.response_body, 'QANDEEL'::text, q.in_reply_to_post_id
      FROM public.resolve_public_qandeel_responses_v1(v_post.experience_id, v_lease.requester_user_id) q
     WHERE q.in_reply_to_post_id = ANY (v_chosen) AND q.in_reply_to_post_id <> p_post_id
     ORDER BY q.response_ordinal;
END$$;

-- =====================================================================================================================
-- F. THE PUBLIC ACTIVITY SOURCE READ (0147 H), forward-replaced. Identical except the REPLY_TO_OWN_POST recipient: the
--    author of the EXACT post the reply answers (0182 reply target); a reply recorded before 0182 has no target row and
--    still goes to its thread root's author. Never the actor; only admitted humans; nothing for anything not served.
-- =====================================================================================================================
CREATE OR REPLACE FUNCTION public_discussion_private.server_read_public_activity_source_v1(p_source_kind text, p_source_id uuid)
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
      -- S8A-05 CP4 (A-5(a)): the exact post answered; before 0182 the thread root was the only target kept.
      SELECT p.* INTO v_parent FROM public.public_discussion_posts p
       WHERE p.id = coalesce((SELECT rt.reply_to_post_id FROM public_thread_private.reply_targets rt WHERE rt.post_id = v_post.id),
                             v_post.parent_post_id);
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
-- G. THE EXPOSED WRAPPERS: SECURITY INVOKER, each a one-line call into its definer.
-- =====================================================================================================================
CREATE FUNCTION public.post_own_public_discussion_v2(p_command_id uuid, p_experience_id uuid, p_reply_to_post_id uuid, p_body text)
RETURNS TABLE (outcome text, post_id uuid, thread_root_id uuid, post_ordinal bigint, qandeel_invoked boolean)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.post_id, r.thread_root_id, r.post_ordinal, r.qandeel_invoked
    FROM public_thread_private.post_own_public_discussion_v2(p_command_id, p_experience_id, p_reply_to_post_id, p_body) r;
$$;
CREATE FUNCTION public.read_public_discussion_posts_v2(p_experience_id uuid, p_after_ordinal bigint)
RETURNS TABLE (post_id uuid, thread_root_id uuid, post_ordinal bigint, author_label_mode text, author_display_label text,
               post_body text, posted_at timestamptz, is_own boolean, qandeel_state text, qandeel_response_body text,
               qandeel_responded_at timestamptz, reply_to_post_id uuid, is_op boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.post_id, r.thread_root_id, r.post_ordinal, r.author_label_mode, r.author_display_label, r.post_body, r.posted_at,
         r.is_own, r.qandeel_state, r.qandeel_response_body, r.qandeel_responded_at, r.reply_to_post_id, r.is_op
    FROM public_thread_private.read_public_discussion_posts_v2(p_experience_id, p_after_ordinal) r;
$$;
CREATE FUNCTION public.read_public_qandeel_context_v2(p_post_id uuid, p_lease_id uuid)
RETURNS TABLE (context_kind text, context_role text, context_ordinal bigint, context_ref uuid, context_text text,
               speaker text, answers_ref uuid)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.context_kind, r.context_role, r.context_ordinal, r.context_ref, r.context_text, r.speaker, r.answers_ref
    FROM public_thread_private.read_public_qandeel_context_v2(p_post_id, p_lease_id) r;
$$;

-- =====================================================================================================================
-- H. PRIVILEGES. Ownership; default-deny by name; then the exact grants (0133).
--    authenticated: the v2 post and the v2 read.   service_role: the v2 context read.   Nobody: the trigger function.
-- =====================================================================================================================
ALTER TABLE public_thread_private.reply_targets OWNER TO postgres;
ALTER TABLE public_thread_private.reply_targets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public_thread_private.reply_targets FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_fn text;
  v_human text[] := ARRAY[
    'public_thread_private.post_own_public_discussion_v2(uuid, uuid, uuid, text)',
    'public_thread_private.read_public_discussion_posts_v2(uuid, bigint)',
    'public.post_own_public_discussion_v2(uuid, uuid, uuid, text)',
    'public.read_public_discussion_posts_v2(uuid, bigint)'];
  v_server text[] := ARRAY[
    'public_thread_private.read_public_qandeel_context_v2(uuid, uuid)',
    'public.read_public_qandeel_context_v2(uuid, uuid)'];
  v_internal text[] := ARRAY['public_thread_private.reject_reply_target_mutation_v1()'];
BEGIN
  FOREACH v_fn IN ARRAY v_human || v_server || v_internal LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', v_fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', v_fn);
    END IF;
  END LOOP;
  -- The replaced 0147 source read keeps exactly its 0147 grant (service_role), re-stated rather than assumed.
  EXECUTE 'REVOKE ALL ON FUNCTION public_discussion_private.server_read_public_activity_source_v1(text, uuid) FROM PUBLIC, anon, authenticated';
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'REVOKE ALL ON TABLE public_thread_private.reply_targets FROM service_role';
    EXECUTE 'GRANT USAGE ON SCHEMA public_thread_private TO service_role';
    FOREACH v_fn IN ARRAY v_server LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_fn);
    END LOOP;
    EXECUTE 'GRANT EXECUTE ON FUNCTION public_discussion_private.server_read_public_activity_source_v1(text, uuid) TO service_role';
  END IF;
  EXECUTE 'GRANT USAGE ON SCHEMA public_thread_private TO authenticated';
  FOREACH v_fn IN ARRAY v_human LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_fn);
  END LOOP;
END$$;

-- =====================================================================================================================
-- I. DEPLOY-TIME SELF-ASSERTIONS: the boundary is what this file says, or the migration fails.
-- =====================================================================================================================
DO $$
DECLARE
  v_role text;
  v_writers integer;
  p record;
BEGIN
  -- I1. Publication and contribution stay fail-closed: both CW2-08 seams answer NOT_EVALUATED.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = 'public.resolve_public_publication_prerequisites_v1(uuid, uuid)'::regprocedure;
  IF p.prosrc !~ 'NOT_EVALUATED' OR p.prosrc ~ '''CLEARED''' THEN
    RAISE EXCEPTION 'S8A-05 CP4: the CW2-08 publication seam must still answer NOT_EVALUATED';
  END IF;
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = 'public_discussion_private.resolve_public_discussion_entitlement_v1(uuid)'::regprocedure;
  IF p.prosrc !~ 'NOT_EVALUATED' OR p.prosrc ~ '''ENTITLED''' THEN
    RAISE EXCEPTION 'S8A-05 CP4: the discussion entitlement seam must still answer NOT_EVALUATED';
  END IF;
  -- I2. Still exactly FIVE functions move a Public Experience lifecycle: no successor-version path is opened here.
  SELECT count(*)::integer INTO v_writers
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
     AND (pr.prosrc ~ 'UPDATE public\.public_experiences e\s+SET current_lifecycle = '''
       OR pr.prosrc ~ 'INSERT INTO public\.public_experiences\s+\(id, public_world_singleton');
  IF v_writers <> 5 THEN
    RAISE EXCEPTION 'S8A-05 CP4: exactly five functions may move a Public Experience lifecycle, found %', v_writers;
  END IF;
  -- I3. The frozen 0096 / 0097 primitives stay executable by no application role.
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = v_role)
       AND (has_function_privilege(v_role, 'public.post_public_discussion_v1(uuid, uuid, uuid, uuid, text)', 'EXECUTE')
            OR has_function_privilege(v_role, 'public.record_public_qandeel_response_v1(uuid, uuid, uuid, uuid, text, uuid[])', 'EXECUTE')
            OR has_function_privilege(v_role, 'public.recompute_public_experience_vitality_v1(uuid)', 'EXECUTE')) THEN
      RAISE EXCEPTION 'S8A-05 CP4: % executes a frozen discussion primitive', v_role;
    END IF;
  END LOOP;
  -- I4. Every public_thread_private function is a pinned postgres-owned SECURITY DEFINER; no relation holds text.
  FOR p IN SELECT pr.proname, pr.prosecdef, pr.proconfig, pg_get_userbyid(pr.proowner) AS owner
             FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace WHERE n.nspname = 'public_thread_private' LOOP
    IF NOT p.prosecdef OR p.owner <> 'postgres' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""'] THEN
      RAISE EXCEPTION 'S8A-05 CP4: public_thread_private.% must be a pinned postgres-owned definer', p.proname;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public_thread_private' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
                AND format_type(a.atttypid, a.atttypmod) NOT IN ('uuid', 'timestamp with time zone')) THEN
    RAISE EXCEPTION 'S8A-05 CP4: a thread relation must hold no text, account or label';
  END IF;
  -- I5. The PUBLIC CONTEXT FIREWALL: nothing here reads private truth, sealed provenance, a source World, an account or a
  --     contact, and nothing writes outside its own schema.
  FOR p IN SELECT pr.proname, pr.prosrc FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'public_thread_private' LOOP
    IF p.prosrc ~* '(provenance|shared_world|shared_private|conversation_|memor|human_model|(^|[^a-z])him_|hypothes|matching|introduction|standing_context|personal_|login_id|email|public\.users|derivative_bodies|source_world|author_user_id|display_label|label_mode)'
       AND p.proname <> 'read_public_discussion_posts_v2' THEN
      RAISE EXCEPTION 'S8A-05 CP4: % reaches beyond the public-visible boundary', p.proname;
    END IF;
    IF p.prosrc ~* '(INSERT INTO|UPDATE|DELETE FROM)\s+public(_[a-z]+_private)?\.' AND p.prosrc !~* 'INSERT INTO public_thread_private\.reply_targets' THEN
      RAISE EXCEPTION 'S8A-05 CP4: % writes outside its own schema', p.proname;
    END IF;
  END LOOP;
  -- I6. The family list admits the Public QANDEEL reply.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = 'public.ai_provider_calls'::regclass
                    AND c.conname = 'ai_provider_calls_feature_family_check'
                    AND pg_get_constraintdef(c.oid) ~ 'PUBLIC_QANDEEL_REPLY') THEN
    RAISE EXCEPTION 'S8A-05 CP4: the AI-COST-01 family list must admit PUBLIC_QANDEEL_REPLY';
  END IF;
END$$;

COMMIT;
