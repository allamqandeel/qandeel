-- A2.3b — Server-Authorized Hypothesis Update Invocation Boundary v1.
--
-- A2.3a (migration 0031) durably persists and recovers the exact
-- post-authority Association command batch, but canonical Hypothesis Update
-- execution is still exclusively a foreground authenticated path:
-- apply_hypothesis_evidence_update derives its authority from auth.uid().
-- Background Post-Response Intelligence holds an authority-issued execution
-- context and the service role; it must not reconstruct a user JWT, invent an
-- access token, or duplicate the mutation rules.
--
-- This forward-only migration factors the canonical mutation algorithm into
-- ONE internal core and gives it exactly two callers:
--   * the existing authenticated wrapper, apply_hypothesis_evidence_update,
--     which keeps its signature, ACL, auth.uid() derivation, error contracts
--     and result shape unchanged;
--   * a new service-role-only background wrapper,
--     background_apply_hypothesis_evidence_update_v1, which receives the
--     already-authorized canonical user and conversation session from the
--     server and binds the target Hypothesis to that owner and to
--     scope = 'CONVERSATION_SESSION:<session>' before invoking the core. It
--     never touches auth.uid(), set_config or request.jwt.claims.
-- The core preserves the canonical invariants verbatim: validation ordering,
-- owner-scoped FOR UPDATE target, exact expected version with the 40001
-- stale-version contract, canonical Evidence membership through
-- canonical_eligible_memory_ids_v1, duplicate-attachment rejection, the
-- SUPPORTING/CONTRADICTING vocabulary, one atomic Hypothesis mutation with
-- version+1, one immutable hypothesis_updates audit row with source
-- QANDEEL_HYPOTHESIS_UPDATE_LOOP, and the { update, hypothesis } return shape.
--
-- A2.3b is capability only: nothing here consumes the durable A2.3a commands,
-- adds an effect key, or changes any Association, Session, Evidence or
-- Confidence rule. No historical row is rewritten and no direct table grant is
-- widened. Automatic consumption is A2.3c.

BEGIN;

-- 1. The shared internal mutation core. It carries no client-facing authority:
--    the caller supplies the already-authorized canonical user, and both
--    legitimate callers are SECURITY DEFINER wrappers owned by postgres, which
--    reach it as the owner. It is deliberately NOT SECURITY DEFINER itself and
--    holds no EXECUTE for any application or Data API role, exactly like the
--    canonical Evidence-membership primitive it consumes. The body is the
--    migration-0028 canonical algorithm with auth.uid() replaced by the bound
--    p_user_id parameter — nothing else moved.
CREATE FUNCTION public.apply_hypothesis_evidence_update_core_v1(
  p_user_id uuid,
  p_update_id uuid,
  p_hypothesis_id uuid,
  p_expected_version integer,
  p_evidence_id text,
  p_evidence_role text
) RETURNS TABLE(update jsonb, hypothesis jsonb) LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  current_hypothesis public.hypotheses;
  updated_hypothesis public.hypotheses;
  update_record public.hypothesis_updates;
  candidate_memory_id uuid;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.' USING ERRCODE='42501'; END IF;
  IF p_expected_version IS NULL OR p_expected_version < 1 THEN RAISE EXCEPTION 'Invalid expected version.' USING ERRCODE='22023'; END IF;
  IF p_evidence_role NOT IN ('SUPPORTING','CONTRADICTING') THEN RAISE EXCEPTION 'Invalid evidence role.' USING ERRCODE='22023'; END IF;
  IF p_evidence_id !~ '^memory:[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'Invalid evidence ID.' USING ERRCODE='22023'; END IF;
  candidate_memory_id := substring(p_evidence_id FROM 8)::uuid;

  SELECT * INTO current_hypothesis FROM public.hypotheses
    WHERE id=p_hypothesis_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF current_hypothesis.version <> p_expected_version THEN RAISE EXCEPTION 'Stale hypothesis version.' USING ERRCODE='40001'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_eligible_memory_ids_v1(p_user_id, CURRENT_TIMESTAMP) canonical
    WHERE canonical.memory_id=candidate_memory_id
  )
  THEN RAISE EXCEPTION 'Evidence is not eligible.' USING ERRCODE='22023'; END IF;
  IF p_evidence_id=ANY(current_hypothesis.supporting_evidence_ids) OR p_evidence_id=ANY(current_hypothesis.contradicting_evidence_ids)
  THEN RAISE EXCEPTION 'Evidence is already attached.' USING ERRCODE='22023'; END IF;

  UPDATE public.hypotheses SET
    supporting_evidence_ids=CASE WHEN p_evidence_role='SUPPORTING' THEN array_append(supporting_evidence_ids,p_evidence_id) ELSE supporting_evidence_ids END,
    contradicting_evidence_ids=CASE WHEN p_evidence_role='CONTRADICTING' THEN array_append(contradicting_evidence_ids,p_evidence_id) ELSE contradicting_evidence_ids END,
    version=version+1, updated_at=CURRENT_TIMESTAMP
    WHERE id=current_hypothesis.id AND user_id=p_user_id AND version=p_expected_version
    RETURNING * INTO updated_hypothesis;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stale hypothesis version.' USING ERRCODE='40001'; END IF;

  INSERT INTO public.hypothesis_updates(id,user_id,hypothesis_id,before_version,after_version,evidence_id,evidence_role,source)
    VALUES(p_update_id,p_user_id,current_hypothesis.id,current_hypothesis.version,updated_hypothesis.version,p_evidence_id,p_evidence_role,'QANDEEL_HYPOTHESIS_UPDATE_LOOP')
    RETURNING * INTO update_record;
  RETURN QUERY SELECT to_jsonb(update_record),to_jsonb(updated_hypothesis);
END; $$;

-- 2. The authenticated wrapper. Same signature, same SECURITY DEFINER posture,
--    same auth.uid() derivation with the same 42501 null-auth contract, same
--    result shape, and — via CREATE OR REPLACE — exactly the same ACL migration
--    0008 gave it (authenticated EXECUTE; PUBLIC/anon revoked; no service_role
--    grant). Clients still never send a userId.
CREATE OR REPLACE FUNCTION public.apply_hypothesis_evidence_update(
  p_update_id uuid,
  p_hypothesis_id uuid,
  p_expected_version integer,
  p_evidence_id text,
  p_evidence_role text
) RETURNS TABLE(update jsonb, hypothesis jsonb) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE canonical_user uuid := (SELECT auth.uid());
BEGIN
  IF canonical_user IS NULL THEN RAISE EXCEPTION 'Authentication required.' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT * FROM public.apply_hypothesis_evidence_update_core_v1(
    canonical_user, p_update_id, p_hypothesis_id, p_expected_version, p_evidence_id, p_evidence_role);
END; $$;

-- 3. The server-authorized background wrapper. The server supplies the
--    already-authorized canonical user and conversation session from the
--    authority-issued execution context; no JWT is reconstructed and no
--    request claim is read or forged. Before the core runs, the target is
--    bound to that owner AND to the conversation-session scope, so a
--    background command can never mutate another user's Hypothesis or a
--    Hypothesis from another session; a non-matching target returns no
--    mutation, exactly like the established target-not-found semantics. The
--    core then still re-checks the exact expected version, canonical Evidence
--    eligibility and duplicate attachment at mutation time. Session status is
--    deliberately not consulted: admission authority was decided when the
--    execution was authorized, and the update loop's own invariants are what
--    protect the mutation.
CREATE FUNCTION public.background_apply_hypothesis_evidence_update_v1(
  p_user_id uuid,
  p_session_id uuid,
  p_update_id uuid,
  p_hypothesis_id uuid,
  p_expected_version integer,
  p_evidence_id text,
  p_evidence_role text
) RETURNS TABLE(update jsonb, hypothesis jsonb) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.hypotheses h
     WHERE h.id=p_hypothesis_id AND h.user_id=p_user_id
       AND h.scope='CONVERSATION_SESSION:'||p_session_id::text
  ) THEN RETURN; END IF;
  RETURN QUERY SELECT * FROM public.apply_hypothesis_evidence_update_core_v1(
    p_user_id, p_update_id, p_hypothesis_id, p_expected_version, p_evidence_id, p_evidence_role);
END; $$;

-- 4. Ownership and least-privilege ACLs. The core is internal (no EXECUTE for
--    any role); the authenticated wrapper keeps its 0008 ACL; the background
--    wrapper is service-role-only. No table grant changes anywhere.
ALTER FUNCTION public.apply_hypothesis_evidence_update_core_v1(uuid,uuid,uuid,integer,text,text) OWNER TO postgres;
ALTER FUNCTION public.apply_hypothesis_evidence_update(uuid,uuid,integer,text,text) OWNER TO postgres;
ALTER FUNCTION public.background_apply_hypothesis_evidence_update_v1(uuid,uuid,uuid,uuid,integer,text,text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.apply_hypothesis_evidence_update_core_v1(uuid,uuid,uuid,integer,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.background_apply_hypothesis_evidence_update_v1(uuid,uuid,uuid,uuid,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.background_apply_hypothesis_evidence_update_v1(uuid,uuid,uuid,uuid,integer,text,text) TO service_role;

COMMIT;
