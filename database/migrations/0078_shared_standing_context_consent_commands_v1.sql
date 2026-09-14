-- I-03C - Standing Context Consent Commands & Immutable Consent History v1.
--
-- After I-02B (durable grant state, migration 0076), I-03A (pure authority
-- decision law) and I-03B (server-only current-grant resolution, migration
-- 0077), the Standing Context Grant still had no legitimate mutation boundary:
-- no canonical way for the exact human participant to GRANT, RECONFIRM or
-- REVOKE their own private-context reasoning authority, and no immutable
-- consent history. This forward-only migration closes exactly that gap and
-- nothing else. CW2-02 section 10 / B9 is the frozen law it implements:
--
--   CONSENT_EVENT_LOG      = append-only historical truth   (this table)
--   EFFECTIVE_GRANT_STATE  = current permission state        (I-02B rows)
--
-- and the two never collapse: a consent event is never edited or deleted, an
-- effective grant only ever moves ACTIVE -> REVOKED, a reconfirmation revokes
-- the old grant and creates a NEW grant identity with its own explicit audience
-- ceiling, a historical ceiling is never rewritten and a revoked grant is never
-- reactivated. No code may derive current authority from "a GRANTED event once
-- existed": the I-03B resolver keeps reading the ACTIVE grant row only.
--
-- What this migration creates, exactly:
--
--   * public.shared_world_standing_context_consent_events - one immutable row
--     per human consent act, event_type exactly GRANTED | RECONFIRMED | REVOKED.
--     The row id IS the command id supplied by the caller, so the primary key
--     is the durable idempotency record (no second idempotency table). It
--     references the durable grant rows (subject_grant_id = the grant the act
--     produced or revoked; prior_grant_id = the replaced grant, RECONFIRMED
--     only) and never duplicates the audience ceiling: historical audience
--     truth stays in the immutable grant-audience rows of the referenced grant.
--     Semantics are fixed by table identity (source = the grantor's own
--     MY_WORLD, target = the exact Shared World, purpose = SHARED_REASONING,
--     authority class = STANDING_CONTEXT_GRANT): there is no scope / action /
--     purpose / source / permission / disclosure column, no JSON column and no
--     client-supplied timestamp. Decline / consent-request persistence is NOT
--     invented here (no canonical consent-request object exists yet).
--   * public.grant_shared_world_standing_context_v1 - first grant or explicit
--     reconfirmation / replacement of the caller's current grant.
--   * public.revoke_shared_world_standing_context_v1 - revocation of the
--     caller's exact current grant.
--
-- Human self-authority (CW2-01 section 7 / A3, CW2-02 B2, CW2-03 section 39):
-- Standing Context consent belongs to the exact human, so BOTH commands derive
-- the grantor from auth.uid() and accept NO grantor parameter, no status, no
-- purpose, no source, no event type, no timestamp and no material / provenance
-- permission. EXECUTE is granted to `authenticated` only. PUBLIC, anon AND
-- service_role cannot execute them: the server may facilitate the UX later, but
-- possession of the service-role credential must never be able to manufacture
-- or withdraw a human's consent. QANDEEL is not a consent principal, and there
-- is deliberately no server-side "act as user" consent command.
--
-- Grant / reconfirm command law (task I-03C sections 12-15, 18-24):
--   * identity: auth.uid() non-null; command / grant / World ids non-null;
--   * the exact Shared World row is locked FOR UPDATE first - it is the
--     transaction serialization boundary for every authority-sensitive
--     mutation of that World (no advisory lock, no process-local mutex, no
--     reliance on the partial unique index alone);
--   * durable idempotency: an existing consent event with this command id is
--     compared semantically (same grantor, World, event kind implied by the
--     expected-state shape, new grant id, prior grant id and exact audience
--     SET - order ignored); an equivalent retry returns the already committed
--     result with no new grant, no second event and no second revocation; any
--     mismatch fails closed with 23505 STANDING_CONTEXT_COMMAND_ID_CONFLICT;
--   * the World lifecycle must be ACTIVE (an ACTIVE Introduction-phase Shared
--     World is still a Shared World; STANDARD is not required and no Matching
--     authority transfers into it);
--   * grantor = exact current participant: one open membership episode
--     (world_id = the World, user_id = auth.uid(), ended_at IS NULL). A former
--     member cannot create or reconfirm a future Shared reasoning grant;
--   * the audience ceiling is the explicit human set the grantor approves:
--     non-null, non-empty, no NULL element, no duplicate (rejected, never
--     normalized), order without authority meaning, every ceiling human a
--     current open member of the exact World at commit time. The ceiling is
--     never inferred from membership, never auto-filled, never widened, and
--     the grantor is NOT required inside it (a bounded subset is valid; the
--     frozen I-03A rule that no grantor-in-audience condition may be invented
--     is preserved);
--   * compare-and-swap: p_expected_active_grant_id = NULL requires no current
--     ACTIVE grant; p_expected_active_grant_id = G requires G to be the current
--     ACTIVE grant of this (World, grantor). Any other current state is a
--     bounded 40001 STANDING_CONTEXT_STALE_STATE - a stale client never
--     replaces a newer consent state and nothing is "applied to whatever is
--     current";
--   * mutation, atomically in the ONE transaction: (reconfirm only) old grant
--     status ACTIVE -> REVOKED with revoked_at on the database clock; new
--     grant row ACTIVE with granted_at on the database clock; the exact new
--     ceiling rows; ONE consent event (GRANTED with prior NULL, or RECONFIRMED
--     with prior = old grant). The old grant and its audience rows stay
--     historical and untouched. p_new_grant_id must differ from the expected
--     old grant id. Any failure rolls the entire command back, so no ACTIVE
--     grant without its event, no revoked-old-without-new, no incomplete
--     ceiling and no orphan event can ever be committed.
--
-- Revoke command law (task I-03C sections 16-18, 22-24, 38):
--   * revocation is self-owned privacy authority: it requires the World to
--     exist, the exact expected grant to exist for THIS World and THIS
--     auth.uid() grantor, and that grant to be ACTIVE. It does NOT require
--     current membership or an ACTIVE World lifecycle - the grantor may
--     withdraw their private context after leaving and after the World closed;
--   * a grant that is not the caller's own in this World is reported as not
--     found (one bounded error for nonexistent / other-World / other-grantor,
--     so an error never discloses another human's consent state - CW2-02 B33);
--     an expected grant that is no longer ACTIVE is a bounded 40001 stale
--     failure and a newer grant is never touched;
--   * mutation, atomically: status -> REVOKED, revoked_at on the database
--     clock, ONE REVOKED consent event (subject = the revoked grant, prior
--     NULL). Historical audience rows are untouched; nothing is deleted;
--   * idempotency mirrors the grant command: an equivalent retry (REVOKED,
--     same grantor, World, subject grant, prior NULL) returns the committed
--     result even though the grant is already REVOKED; a mismatch is 23505.
--
-- What is deliberately NOT here: no trigger (membership expansion has no
-- database path into any ceiling - CW2-02 B13 / B14, CW2-03 section 40), no
-- RLS policy, no direct client or service-role table access (the consent-event
-- table is RLS-enabled with zero policies and every application role is
-- revoked from every privilege; the I-02B grant tables stay exactly as sealed
-- as 0076 / 0077 left them), no automatic revocation on leave (I-04 owns leave
-- / removal invalidation), no TTL, no DECLINE event, no consent-request object,
-- no generic consent / grant / permission engine, no EffectiveContext, no model
-- invocation, no private-context retrieval, no material / provenance /
-- disclosure authority (REASON_FROM_PRIVATE_CONTEXT != DISCLOSE_PRIVATE_FACT),
-- no Matching / Public / Replay scope, no Shared UI, controller or messaging.
-- Migrations 0001-0077 are untouched; the frozen kernel, I-03A evaluator and
-- I-03B resolver are unchanged and observe committed I-03C state through the
-- existing ACTIVE-only query.

BEGIN;

-- 1. Immutable consent-event history. id is the command id (durable
--    idempotency). occurred_at is database-owned; the caller supplies no
--    timestamp. All four references are restrictive: history never cascades.
CREATE TABLE public.shared_world_standing_context_consent_events (
    id uuid PRIMARY KEY,
    world_id uuid NOT NULL,
    grantor_user_id uuid NOT NULL,
    event_type text NOT NULL,
    subject_grant_id uuid NOT NULL,
    prior_grant_id uuid,
    occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT shared_world_standing_context_consent_events_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_standing_context_consent_events_grantor_fk
        FOREIGN KEY (grantor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_standing_context_consent_events_subject_grant_fk
        FOREIGN KEY (subject_grant_id) REFERENCES public.shared_world_standing_context_grants (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_standing_context_consent_events_prior_grant_fk
        FOREIGN KEY (prior_grant_id) REFERENCES public.shared_world_standing_context_grants (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_standing_context_consent_events_event_type_check
        CHECK (event_type IN ('GRANTED', 'RECONFIRMED', 'REVOKED')),
    -- GRANTED and REVOKED carry no prior grant; RECONFIRMED links the replaced
    -- grant, which is never the new grant itself.
    CONSTRAINT shared_world_standing_context_consent_events_prior_grant_check
        CHECK ((event_type = 'GRANTED' AND prior_grant_id IS NULL)
            OR (event_type = 'RECONFIRMED' AND prior_grant_id IS NOT NULL AND prior_grant_id <> subject_grant_id)
            OR (event_type = 'REVOKED' AND prior_grant_id IS NULL))
);

-- A grant identity is born by exactly one event, revoked by at most one event
-- and replaced at most once: structural truths of the immutable history, and
-- the reverse lookups the restrictive foreign keys rely on.
CREATE UNIQUE INDEX shared_world_standing_context_consent_events_birth_event_idx
    ON public.shared_world_standing_context_consent_events (subject_grant_id)
    WHERE event_type IN ('GRANTED', 'RECONFIRMED');

CREATE UNIQUE INDEX shared_world_standing_context_consent_events_revoke_event_idx
    ON public.shared_world_standing_context_consent_events (subject_grant_id)
    WHERE event_type = 'REVOKED';

CREATE UNIQUE INDEX shared_world_standing_context_consent_events_prior_grant_idx
    ON public.shared_world_standing_context_consent_events (prior_grant_id)
    WHERE prior_grant_id IS NOT NULL;

-- The one frozen history access pattern: a grantor's consent acts in one exact
-- World, in database time order.
CREATE INDEX shared_world_standing_context_consent_events_world_grantor_idx
    ON public.shared_world_standing_context_consent_events (world_id, grantor_user_id, occurred_at);

-- 2. Deny-by-default posture for the event table: RLS on, zero policies, every
--    application role revoked from every privilege. The only write path is the
--    two commands below; there is no direct client read path in I-03C.
ALTER TABLE public.shared_world_standing_context_consent_events OWNER TO postgres;
ALTER TABLE public.shared_world_standing_context_consent_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shared_world_standing_context_consent_events FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.shared_world_standing_context_consent_events FROM service_role';
END IF;END$$;

-- 3. Grant / reconfirm command. The caller supplies only the command id, the
--    new grant id, the exact World, the explicit audience ceiling and the
--    expected current ACTIVE grant (NULL = first grant). Identity is
--    auth.uid(); status, event type and every timestamp are database-derived.
CREATE FUNCTION public.grant_shared_world_standing_context_v1(
  p_command_id uuid, p_new_grant_id uuid, p_world_id uuid, p_audience_user_ids uuid[], p_expected_active_grant_id uuid DEFAULT NULL
) RETURNS TABLE(consent_event_id uuid, event_type text, grant_id uuid, prior_grant_id uuid, grant_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  world_lifecycle text;
  current_active_id uuid;
  intended_event_type text;
  requested_ceiling uuid[];
  committed public.shared_world_standing_context_consent_events;
  committed_ceiling uuid[];
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'STANDING_CONTEXT_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_command_id IS NULL OR p_new_grant_id IS NULL OR p_world_id IS NULL THEN
    RAISE EXCEPTION 'STANDING_CONTEXT_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- Explicit ceiling: non-null, one-dimensional, non-empty, no NULL element.
  IF p_audience_user_ids IS NULL OR array_ndims(p_audience_user_ids) IS DISTINCT FROM 1
     OR cardinality(p_audience_user_ids) = 0 OR array_position(p_audience_user_ids, NULL::uuid) IS NOT NULL THEN
    RAISE EXCEPTION 'STANDING_CONTEXT_AUDIENCE_INVALID' USING ERRCODE='22023';
  END IF;
  -- Set semantics: duplicates are rejected, never silently normalized.
  requested_ceiling := (SELECT array_agg(DISTINCT a.audience_user_id ORDER BY a.audience_user_id)
                          FROM unnest(p_audience_user_ids) AS a(audience_user_id));
  IF cardinality(requested_ceiling) <> cardinality(p_audience_user_ids) THEN
    RAISE EXCEPTION 'STANDING_CONTEXT_AUDIENCE_DUPLICATE' USING ERRCODE='22023';
  END IF;
  IF p_expected_active_grant_id IS NOT NULL AND p_expected_active_grant_id = p_new_grant_id THEN
    RAISE EXCEPTION 'STANDING_CONTEXT_NEW_GRANT_ID_INVALID' USING ERRCODE='22023';
  END IF;
  intended_event_type := CASE WHEN p_expected_active_grant_id IS NULL THEN 'GRANTED' ELSE 'RECONFIRMED' END;

  -- Exact-World serialization boundary: every authority-sensitive mutation of
  -- this World queues on its canonical row before state is compared or changed.
  SELECT w.lifecycle INTO world_lifecycle FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STANDING_CONTEXT_WORLD_NOT_FOUND' USING ERRCODE='P0002'; END IF;

  -- Durable idempotency on the consent-event primary key. An equivalent retry
  -- returns the committed result and mutates nothing; a different command
  -- under the same id fails closed. This precedes lifecycle, membership and
  -- compare-and-swap so a retry of an already committed command stays
  -- answerable after the World state moved on.
  SELECT * INTO committed FROM public.shared_world_standing_context_consent_events e WHERE e.id = p_command_id;
  IF FOUND THEN
    SELECT array_agg(a.audience_user_id ORDER BY a.audience_user_id) INTO committed_ceiling
      FROM public.shared_world_standing_context_grant_audience a WHERE a.grant_id = committed.subject_grant_id;
    IF committed.grantor_user_id = u AND committed.world_id = p_world_id AND committed.event_type = intended_event_type
       AND committed.subject_grant_id = p_new_grant_id AND committed.prior_grant_id IS NOT DISTINCT FROM p_expected_active_grant_id
       AND committed_ceiling IS NOT DISTINCT FROM requested_ceiling THEN
      RETURN QUERY SELECT committed.id, committed.event_type, committed.subject_grant_id, committed.prior_grant_id, 'ACTIVE'::text;
      RETURN;
    END IF;
    RAISE EXCEPTION 'STANDING_CONTEXT_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- The World must be ACTIVE (Introduction or Standard phase alike).
  IF world_lifecycle <> 'ACTIVE' THEN RAISE EXCEPTION 'STANDING_CONTEXT_WORLD_NOT_ACTIVE' USING ERRCODE='55000'; END IF;
  -- grantor = exact current participant.
  IF NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
                  WHERE e.world_id = p_world_id AND e.user_id = u AND e.ended_at IS NULL) THEN
    RAISE EXCEPTION 'STANDING_CONTEXT_GRANTOR_NOT_CURRENT_MEMBER' USING ERRCODE='42501';
  END IF;
  -- Every ceiling human is a current open member of the exact World. The
  -- grantor is not required inside the ceiling; nothing is inferred from
  -- membership, nothing is auto-filled.
  IF EXISTS (SELECT 1 FROM unnest(requested_ceiling) AS a(audience_user_id)
              WHERE NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
                                 WHERE e.world_id = p_world_id AND e.user_id = a.audience_user_id AND e.ended_at IS NULL)) THEN
    RAISE EXCEPTION 'STANDING_CONTEXT_AUDIENCE_NOT_CURRENT_MEMBER' USING ERRCODE='42501';
  END IF;

  -- Compare-and-swap against the current ACTIVE grant of this (World, grantor).
  SELECT g.id INTO current_active_id FROM public.shared_world_standing_context_grants g
   WHERE g.world_id = p_world_id AND g.grantor_user_id = u AND g.status = 'ACTIVE';
  IF current_active_id IS DISTINCT FROM p_expected_active_grant_id THEN
    RAISE EXCEPTION 'STANDING_CONTEXT_STALE_STATE' USING ERRCODE='40001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_standing_context_grants g WHERE g.id = p_new_grant_id) THEN
    RAISE EXCEPTION 'STANDING_CONTEXT_GRANT_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- One atomic authority mutation plus one immutable consent event.
  IF p_expected_active_grant_id IS NOT NULL THEN
    UPDATE public.shared_world_standing_context_grants g SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP
     WHERE g.id = p_expected_active_grant_id AND g.status = 'ACTIVE';
    IF NOT FOUND THEN RAISE EXCEPTION 'STANDING_CONTEXT_STALE_STATE' USING ERRCODE='40001'; END IF;
  END IF;
  INSERT INTO public.shared_world_standing_context_grants (id, world_id, grantor_user_id, status)
  VALUES (p_new_grant_id, p_world_id, u, 'ACTIVE');
  INSERT INTO public.shared_world_standing_context_grant_audience (grant_id, audience_user_id)
  SELECT p_new_grant_id, a.audience_user_id FROM unnest(requested_ceiling) AS a(audience_user_id);
  INSERT INTO public.shared_world_standing_context_consent_events (id, world_id, grantor_user_id, event_type, subject_grant_id, prior_grant_id)
  VALUES (p_command_id, p_world_id, u, intended_event_type, p_new_grant_id, p_expected_active_grant_id);
  RETURN QUERY SELECT p_command_id, intended_event_type, p_new_grant_id, p_expected_active_grant_id, 'ACTIVE'::text;
END$$;

-- 4. Revoke command. The caller supplies only the command id, the exact World
--    and the exact expected ACTIVE grant. No membership or ACTIVE-lifecycle
--    requirement: withdrawal of one's own private context survives leaving the
--    World and the World closing.
CREATE FUNCTION public.revoke_shared_world_standing_context_v1(
  p_command_id uuid, p_world_id uuid, p_expected_active_grant_id uuid
) RETURNS TABLE(consent_event_id uuid, event_type text, grant_id uuid, prior_grant_id uuid, grant_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  locked_world_id uuid;
  committed public.shared_world_standing_context_consent_events;
  target public.shared_world_standing_context_grants;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'STANDING_CONTEXT_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_expected_active_grant_id IS NULL THEN
    RAISE EXCEPTION 'STANDING_CONTEXT_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- The same exact-World serialization boundary as the grant command.
  SELECT w.id INTO locked_world_id FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STANDING_CONTEXT_WORLD_NOT_FOUND' USING ERRCODE='P0002'; END IF;

  -- Durable idempotency: an equivalent retry returns the committed revoke
  -- result even though the grant is already REVOKED; a mismatch fails closed.
  SELECT * INTO committed FROM public.shared_world_standing_context_consent_events e WHERE e.id = p_command_id;
  IF FOUND THEN
    IF committed.event_type = 'REVOKED' AND committed.grantor_user_id = u AND committed.world_id = p_world_id
       AND committed.subject_grant_id = p_expected_active_grant_id AND committed.prior_grant_id IS NULL THEN
      RETURN QUERY SELECT committed.id, committed.event_type, committed.subject_grant_id, committed.prior_grant_id, 'REVOKED'::text;
      RETURN;
    END IF;
    RAISE EXCEPTION 'STANDING_CONTEXT_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- The exact expected grant, in this World, owned by this human. Nonexistent,
  -- other-World and other-grantor collapse into one bounded answer so the
  -- error never discloses another human's consent state.
  SELECT * INTO target FROM public.shared_world_standing_context_grants g
   WHERE g.id = p_expected_active_grant_id AND g.world_id = p_world_id AND g.grantor_user_id = u
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STANDING_CONTEXT_GRANT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  -- Only the exact current ACTIVE grant can be revoked; never "whatever is current".
  IF target.status <> 'ACTIVE' THEN RAISE EXCEPTION 'STANDING_CONTEXT_STALE_STATE' USING ERRCODE='40001'; END IF;

  -- One atomic authority mutation plus one immutable consent event. Audience
  -- rows stay untouched; nothing is deleted.
  UPDATE public.shared_world_standing_context_grants g SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP
   WHERE g.id = p_expected_active_grant_id AND g.status = 'ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'STANDING_CONTEXT_STALE_STATE' USING ERRCODE='40001'; END IF;
  INSERT INTO public.shared_world_standing_context_consent_events (id, world_id, grantor_user_id, event_type, subject_grant_id, prior_grant_id)
  VALUES (p_command_id, p_world_id, u, 'REVOKED', p_expected_active_grant_id, NULL);
  RETURN QUERY SELECT p_command_id, 'REVOKED'::text, p_expected_active_grant_id, NULL::uuid, 'REVOKED'::text;
END$$;

-- 5. Ownership and least-privilege execute ACL: authenticated humans only.
--    PUBLIC, anon and service_role receive nothing. service_role is revoked
--    explicitly because a Supabase project grants EXECUTE on new public
--    functions to it by default privilege.
ALTER FUNCTION public.grant_shared_world_standing_context_v1(uuid, uuid, uuid, uuid[], uuid) OWNER TO postgres;
ALTER FUNCTION public.revoke_shared_world_standing_context_v1(uuid, uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.grant_shared_world_standing_context_v1(uuid, uuid, uuid, uuid[], uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_shared_world_standing_context_v1(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.grant_shared_world_standing_context_v1(uuid, uuid, uuid, uuid[], uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.revoke_shared_world_standing_context_v1(uuid, uuid, uuid) FROM service_role';
END IF;END$$;
GRANT EXECUTE ON FUNCTION public.grant_shared_world_standing_context_v1(uuid, uuid, uuid, uuid[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_shared_world_standing_context_v1(uuid, uuid, uuid) TO authenticated;

-- 6. Terminal self-assertions. The migration refuses to deploy a consent
--    boundary that is service-role-executable, anonymous, unpinned, caller-
--    identified, table-reachable, policy- or trigger-bearing, generically
--    shaped, or that weakened the I-02B seal or the I-03B resolver ACL.
DO $$
DECLARE
  commands text[] := ARRAY['public.grant_shared_world_standing_context_v1(uuid,uuid,uuid,uuid[],uuid)',
                           'public.revoke_shared_world_standing_context_v1(uuid,uuid,uuid)'];
  resolver text := 'public.resolve_shared_world_standing_context_grant_v1(uuid,uuid)';
  fn text;
  p record;
  target_role text;
  target_table text;
  target_privilege text;
  rls_enabled boolean;
BEGIN
  FOREACH fn IN ARRAY commands LOOP
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pg_get_function_identity_arguments(pr.oid) AS args
      INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-03C: % must be SECURITY DEFINER', fn; END IF;
    IF p.provolatile <> 'v' THEN RAISE EXCEPTION 'I-03C: % is a mutation and must be VOLATILE', fn; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'I-03C: % must pin an empty search_path', fn;
    END IF;
    IF p.prosrc !~ 'auth\.uid\(\)' THEN RAISE EXCEPTION 'I-03C: % must derive the grantor from auth.uid()', fn; END IF;
    IF p.args ~* 'grantor' OR p.args ~* 'status' OR p.args ~* 'event_type' OR p.args ~* 'purpose' OR p.args ~* 'source'
       OR p.args ~* 'timestamp' OR p.args ~* '_at\M' OR p.args ~* 'material' OR p.args ~* 'provenance' THEN
      RAISE EXCEPTION 'I-03C: % must not accept a grantor, status, purpose, source, event type, timestamp or material parameter', fn;
    END IF;
    IF p.prosrc !~ 'FROM public\.shared_worlds w WHERE w\.id = p_world_id FOR UPDATE' THEN
      RAISE EXCEPTION 'I-03C: % must serialize on the exact Shared World row', fn;
    END IF;
    IF p.prosrc ~* 'UPDATE public\.shared_world_standing_context_consent_events' OR p.prosrc ~* 'DELETE FROM' OR p.prosrc ~* 'TRUNCATE'
       OR p.prosrc ~* 'UPDATE public\.shared_world_standing_context_grant_audience' THEN
      RAISE EXCEPTION 'I-03C: % may never rewrite consent history or a historical ceiling', fn;
    END IF;
    IF has_function_privilege('public', fn, 'EXECUTE') THEN RAISE EXCEPTION 'I-03C: PUBLIC must not execute %', fn; END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) AND has_function_privilege(target_role, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-03C: % must not execute % (human consent is never manufactured by a system credential)', target_role, fn;
      END IF;
    END LOOP;
    IF NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-03C: authenticated must be the only executor of %', fn;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.proname IN ('grant_shared_world_standing_context_v1','revoke_shared_world_standing_context_v1')) <> 2 THEN
    RAISE EXCEPTION 'I-03C: exactly the two consent commands must exist, one overload each';
  END IF;

  -- The I-03B resolver ACL is unchanged: service_role only, never a client role.
  IF has_function_privilege('public', resolver, 'EXECUTE') OR has_function_privilege('anon', resolver, 'EXECUTE')
     OR has_function_privilege('authenticated', resolver, 'EXECUTE') OR NOT has_function_privilege('service_role', resolver, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-03C: the I-03B resolver must remain service_role-only';
  END IF;

  -- Consent history and the I-02B grant tables are unreachable by every application role.
  FOREACH target_table IN ARRAY ARRAY['public.shared_world_standing_context_consent_events',
                                      'public.shared_world_standing_context_grants',
                                      'public.shared_world_standing_context_grant_audience'] LOOP
    SELECT c.relrowsecurity INTO rls_enabled FROM pg_class c WHERE c.oid = target_table::regclass;
    IF NOT rls_enabled THEN RAISE EXCEPTION 'I-03C: row level security must be enabled on %', target_table; END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-03C: no RLS policy may exist on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = target_table::regclass AND NOT t.tgisinternal) THEN
      RAISE EXCEPTION 'I-03C: no trigger may exist on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) AS privilege
                WHERE c.oid = target_table::regclass AND privilege.grantee = 0) THEN
      RAISE EXCEPTION 'I-03C: PUBLIC must hold no privilege on %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-03C: direct table access stays sealed: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
  -- Membership expansion has no database path into any ceiling.
  IF EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.shared_world_membership_episodes'::regclass AND NOT t.tgisinternal) THEN
    RAISE EXCEPTION 'I-03C: no trigger may couple membership to a grant ceiling';
  END IF;

  -- The event row is fixed by table identity: no generic, disclosure-shaped,
  -- owner, TTL or JSON column may exist.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name = 'shared_world_standing_context_consent_events'
       AND (c.column_name ~* '(scope|purpose|action|source|permission|disclos|quote|copy|publish|share|export|provenance|transfer|owner|admin|ttl|expir|material|matching|public)'
            OR c.data_type IN ('json','jsonb','ARRAY'))
  ) THEN
    RAISE EXCEPTION 'I-03C: consent-event semantics are fixed by table identity; no generic, disclosure-shaped, owner or JSON column may exist';
  END IF;
END$$;

COMMIT;
