-- QANDEEL - Hypothesis Lifecycle Completion v1.
--
-- Two linked gaps are closed here, and nothing else. The canonical status
-- vocabulary (CANDIDATE / ACTIVE / SUPPORTED / MIXED / WEAK / REJECTED /
-- RETIRED / REOPENED) and the canonical transition graph are FROZEN exactly as
-- migration 0005 wrote them. No status is added, removed or re-interpreted, and
-- Hypothesis status remains lifecycle state - never a numeric Confidence.
--
-- A. Exact-version lifecycle transition authority.
--    public.transition_hypothesis(uuid,text) (migration 0005) is an
--    authenticated last-writer-wins mutation: it locks the owned row, checks
--    the graph against whatever status it happens to find, bumps the version
--    and writes NO audit. A caller that read version 4, then raced another
--    mutation to version 7, still transitions the version-7 row; and no durable
--    record of who moved a Hypothesis between lifecycle states has ever
--    existed. This migration replaces that operational path with an
--    exact-version, atomic, audited boundary and revokes the legacy function's
--    application EXECUTE authority so it cannot remain a bypass. Migration 0005
--    is left as written: the legacy function is not dropped, only defanged.
--
-- B. The generated Hypothesis lifecycle is completed.
--    A canonical SYSTEM_GENERATED Hypothesis persisted by
--    persist_post_response_hypothesis_generation_v1 (migration 0033) stayed in
--    CANDIDATE forever, because nothing in the canonical runtime ever moved it.
--    Its Confidence receipt (migration 0035) therefore froze a Candidate
--    version that any later admission would immediately make stale. Activation
--    now happens INSIDE the same atomic HYPOTHESIS_PERSISTENCE transaction,
--    after the whole generated graph is built and BEFORE the effect becomes
--    durably COMPLETED, so the QAN-AUD-06 Confidence batch initializes against,
--    and freezes, the exact post-activation ACTIVE version.
--
-- This is deterministic admission, NOT evidence scoring. No Evidence count, no
-- Confidence value, no band and no threshold decides anything here. The ONLY
-- automatic transition this migration introduces is
-- CANDIDATE -> ACTIVE for the successfully persisted generated batch.
-- SUPPORTED / MIXED / WEAK / REJECTED / RETIRED / REOPENED remain explicit
-- capability transitions with no automatic rule of any kind, Hypothesis Update
-- remains an Evidence loop that never touches status, and
-- server_create_hypothesis_v1 still creates every Hypothesis as CANDIDATE at
-- version 1.
--
-- Forward-only. No historical CANDIDATE row is backfilled, re-interpreted or
-- given a fabricated lifecycle audit row: pre-0036 Hypotheses keep their exact
-- status, version and timestamps, and the audit table starts empty. Migrations
-- 0001-0035 are not modified.

BEGIN;

-- 1. The canonical lifecycle transition policy, as ONE pure primitive. It is
--    the frozen graph and nothing else: no table read, no auth.uid(), no
--    caller-controlled authority, no side effect. The TypeScript
--    canTransitionHypothesis mirror stays as the application's early
--    validation, but this function is the authority at mutation time and is the
--    single expression of the graph inside PostgreSQL. It is deliberately not
--    STRICT: a NULL status must be a hard false, never a NULL that a CHECK
--    would treat as satisfied. It is internal - no application role may call
--    it, exactly like the migration 0033/0035 shape validators.
CREATE FUNCTION public.hypothesis_lifecycle_transition_allowed_v1(p_from_status text, p_to_status text)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
BEGIN
  IF p_from_status IS NULL OR p_to_status IS NULL THEN RETURN false; END IF;
  RETURN CASE p_from_status
    WHEN 'CANDIDATE' THEN p_to_status = 'ACTIVE'
    WHEN 'ACTIVE'    THEN p_to_status IN ('SUPPORTED','MIXED','WEAK','REJECTED','RETIRED')
    WHEN 'SUPPORTED' THEN p_to_status IN ('MIXED','WEAK','REJECTED','RETIRED')
    WHEN 'MIXED'     THEN p_to_status IN ('SUPPORTED','WEAK','REJECTED','RETIRED')
    WHEN 'WEAK'      THEN p_to_status IN ('ACTIVE','MIXED','REJECTED','RETIRED')
    WHEN 'REJECTED'  THEN p_to_status = 'REOPENED'
    WHEN 'RETIRED'   THEN p_to_status = 'REOPENED'
    WHEN 'REOPENED'  THEN p_to_status = 'ACTIVE'
    ELSE false
  END;
END;$$;

ALTER FUNCTION public.hypothesis_lifecycle_transition_allowed_v1(text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.hypothesis_lifecycle_transition_allowed_v1(text,text) FROM PUBLIC,anon,authenticated,service_role;

-- 2. The immutable lifecycle transition audit. It follows the existing
--    public.hypothesis_updates convention from migration 0008 exactly: an
--    owner-scoped composite FK to (hypothesis_id, user_id) so an audit row can
--    never describe another tenant's Hypothesis, the same
--    before_version > 0 AND after_version = before_version + 1 invariant, RLS
--    enabled, owner-scoped authenticated SELECT and NO INSERT / UPDATE / DELETE
--    grant for any application role - not even service_role, which reaches this
--    table only through the internal transition core below.
--
--    It carries durable FACTS and nothing else: which Hypothesis, whose, from
--    which status and version to which status and version, under which bounded
--    server-derived source, and when. There is deliberately no rationale
--    column, no transcript, no provider payload, no hidden reasoning, no
--    chain-of-thought, no free-text error field and no arbitrary metadata.
--    The edge CHECK reuses the ONE lifecycle policy primitive rather than
--    restating the graph, so a stored audit row can never describe a transition
--    the canonical graph forbids.
CREATE TABLE public.hypothesis_lifecycle_transitions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  hypothesis_id uuid NOT NULL,
  before_status text NOT NULL,
  after_status text NOT NULL,
  before_version integer NOT NULL,
  after_version integer NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT hypothesis_lifecycle_transitions_owner_fk FOREIGN KEY (hypothesis_id,user_id)
    REFERENCES public.hypotheses(id,user_id) ON DELETE RESTRICT,
  CONSTRAINT hypothesis_lifecycle_transitions_version_check
    CHECK (before_version > 0 AND after_version = before_version + 1),
  CONSTRAINT hypothesis_lifecycle_transitions_before_status_check
    CHECK (before_status IN ('CANDIDATE','ACTIVE','SUPPORTED','MIXED','WEAK','REJECTED','RETIRED','REOPENED')),
  CONSTRAINT hypothesis_lifecycle_transitions_after_status_check
    CHECK (after_status IN ('CANDIDATE','ACTIVE','SUPPORTED','MIXED','WEAK','REJECTED','RETIRED','REOPENED')),
  CONSTRAINT hypothesis_lifecycle_transitions_edge_check
    CHECK (public.hypothesis_lifecycle_transition_allowed_v1(before_status,after_status)),
  CONSTRAINT hypothesis_lifecycle_transitions_source_check
    CHECK (source IN ('AUTHENTICATED_TRANSITION','SYSTEM_GENERATION_ACTIVATION'))
);

CREATE INDEX hypothesis_lifecycle_transitions_history_idx
  ON public.hypothesis_lifecycle_transitions(user_id,hypothesis_id,created_at DESC,id);

ALTER TABLE public.hypothesis_lifecycle_transitions OWNER TO postgres;
ALTER TABLE public.hypothesis_lifecycle_transitions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hypothesis_lifecycle_transitions FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.hypothesis_lifecycle_transitions TO authenticated;
CREATE POLICY hypothesis_lifecycle_transitions_select_own ON public.hypothesis_lifecycle_transitions
  FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));

-- 3. The ONE internal atomic transition core, shared by every legitimate
--    transition path. It is the only place in the database that moves a
--    Hypothesis between lifecycle states, and it is not a generic Hypothesis
--    mutation RPC: it can change status, version and updated_at, and nothing
--    else.
--
--    The owner is supplied by the trusted caller (the authenticated wrapper
--    derives it from auth.uid(); the generation persistence command derives it
--    from the durable execution row), and the audit identity is generated HERE
--    so no caller can ever choose, replay or collide an audit row identifier.
--
--    Order: owner-scoped FOR UPDATE lock -> exact expected-version check ->
--    canonical graph check -> the single-row UPDATE re-asserting the expected
--    version -> the immutable audit INSERT. The mutation and the audit are ONE
--    statement pair in ONE transaction, so an audit failure (a constraint, a
--    missing owner, anything) rolls the status/version change back with it.
--    A stale expected version fails closed with the repository's established
--    40001 stale-version semantics from migration 0008 - the newer row is
--    NEVER silently transitioned instead. A missing or cross-user target
--    returns zero rows and mutates nothing, exactly like the legacy command.
CREATE FUNCTION public.transition_hypothesis_core_v1(
  p_user_id uuid, p_hypothesis_id uuid, p_expected_version integer, p_status text, p_source text
) RETURNS SETOF public.hypotheses
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_hypothesis public.hypotheses; updated_hypothesis public.hypotheses;
BEGIN
  IF p_user_id IS NULL OR p_hypothesis_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_HYPOTHESIS_TRANSITION_IDENTITY' USING ERRCODE='22023'; END IF;
  IF p_expected_version IS NULL OR p_expected_version < 1 THEN
    RAISE EXCEPTION 'INVALID_HYPOTHESIS_TRANSITION_VERSION' USING ERRCODE='22023'; END IF;
  -- The source vocabulary is closed and server-derived. There is no path by
  -- which a caller-supplied string outside it can reach the audit table.
  IF p_source IS NULL OR p_source NOT IN ('AUTHENTICATED_TRANSITION','SYSTEM_GENERATION_ACTIVATION') THEN
    RAISE EXCEPTION 'INVALID_HYPOTHESIS_TRANSITION_SOURCE' USING ERRCODE='22023'; END IF;

  SELECT * INTO current_hypothesis FROM public.hypotheses
    WHERE id=p_hypothesis_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF current_hypothesis.version <> p_expected_version THEN
    RAISE EXCEPTION 'Stale hypothesis version.' USING ERRCODE='40001'; END IF;
  IF NOT public.hypothesis_lifecycle_transition_allowed_v1(current_hypothesis.status, p_status) THEN
    RAISE EXCEPTION 'Invalid hypothesis transition.' USING ERRCODE='22023'; END IF;

  UPDATE public.hypotheses
     SET status=p_status, version=version+1, updated_at=CURRENT_TIMESTAMP
   WHERE id=current_hypothesis.id AND user_id=p_user_id AND version=p_expected_version
   RETURNING * INTO updated_hypothesis;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stale hypothesis version.' USING ERRCODE='40001'; END IF;

  INSERT INTO public.hypothesis_lifecycle_transitions(
    id,user_id,hypothesis_id,before_status,after_status,before_version,after_version,source)
  VALUES(
    pg_catalog.gen_random_uuid(), p_user_id, current_hypothesis.id,
    current_hypothesis.status, updated_hypothesis.status,
    current_hypothesis.version, updated_hypothesis.version, p_source);

  RETURN NEXT updated_hypothesis;
END;$$;

ALTER FUNCTION public.transition_hypothesis_core_v1(uuid,uuid,integer,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.transition_hypothesis_core_v1(uuid,uuid,integer,text,text) FROM PUBLIC,anon,authenticated,service_role;

-- 4. The narrow authenticated transition path. It accepts exactly three
--    values - the Hypothesis identifier, the exact expected version and the
--    requested target status - and NOTHING else. The owner comes only from
--    auth.uid(); the transition source is forced to AUTHENTICATED_TRANSITION;
--    no before/after version, no audit identifier and no audit metadata is
--    reachable from a caller. Everything else is the shared core.
CREATE FUNCTION public.transition_hypothesis_v2(
  p_hypothesis_id uuid, p_expected_version integer, p_status text
) RETURNS SETOF public.hypotheses
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE canonical_user uuid := (SELECT auth.uid());
BEGIN
  IF canonical_user IS NULL THEN RAISE EXCEPTION 'Authentication required.' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT * FROM public.transition_hypothesis_core_v1(
    canonical_user, p_hypothesis_id, p_expected_version, p_status, 'AUTHENTICATED_TRANSITION');
END;$$;

ALTER FUNCTION public.transition_hypothesis_v2(uuid,integer,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.transition_hypothesis_v2(uuid,integer,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.transition_hypothesis_v2(uuid,integer,text) TO authenticated;

-- 5. The legacy transition RPC loses its application execution authority. It
--    is not dropped - migration 0005 stays historical text and the function
--    object survives for provenance - but PUBLIC, anon, authenticated and
--    service_role can no longer run it, so it cannot remain a bypass around
--    exact-version concurrency control and the lifecycle audit. Every
--    legitimate transition now flows through transition_hypothesis_v2 or, for
--    the generated batch, through the internal core. The other migration 0005
--    commands (attach_hypothesis_evidence, link_competing_hypotheses) and the
--    migration 0008/0032 Evidence update path are deliberately untouched.
REVOKE ALL ON FUNCTION public.transition_hypothesis(uuid,text) FROM PUBLIC,anon,authenticated,service_role;

-- 6. Generated Candidate -> Active admission, inside the existing managed
--    atomic persistence command. Everything migration 0033 established is
--    preserved verbatim: the same typed effect result, the same durable
--    Candidate plan as the ONLY target authority, the same
--    create -> supporting -> contradicting -> earlier-competitor order through
--    the same narrow canonical background primitives, the same single-
--    transaction rollback boundary, and the same immutable first result.
--
--    The ONLY change is a final activation phase. After the entire generated
--    graph is constructed, every created target is transitioned
--    CANDIDATE -> ACTIVE in the durable generated-ID order, each through the
--    shared lifecycle core with the exact version the graph-building phase
--    produced, incrementing it exactly once and writing exactly one
--    SYSTEM_GENERATION_ACTIVATION audit row. Target identity is never inferred
--    from current Hypothesis rows: created_ids is the exact durable plan order.
--    Only after every activation succeeds is HYPOTHESIS_PERSISTENCE completed,
--    so the QAN-AUD-06 Confidence batch - which runs strictly after that
--    durable completion - freezes the post-activation ACTIVE version and can
--    never evaluate a Candidate version that a later admission invalidates.
--
--    Atomicity is unchanged and now covers activation too: any activation
--    failure aborts the whole command, leaving no persisted graph, no partially
--    ACTIVE batch, no surviving lifecycle audit, no completion and no false
--    success. The effect simply stays CLAIMED for the existing fail-closed
--    recovery boundary. There is no compensation logic, no second ledger, no
--    new effect key and no lifecycle queue. NO_ACCEPTED_CANDIDATES still writes
--    no Hypothesis, and therefore no lifecycle audit row either.
CREATE OR REPLACE FUNCTION public.persist_post_response_hypothesis_generation_v1(p_execution_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 execution_row public.post_response_intelligence_executions;
 candidate_effect public.post_response_intelligence_effects;
 persistence_effect public.post_response_intelligence_effects;
 candidate jsonb; created_ids uuid[] := '{}'::uuid[]; new_id uuid; linked_evidence text; earlier_id uuid; touched integer;
 activation_version integer;
BEGIN
 SELECT * INTO execution_row FROM public.post_response_intelligence_executions WHERE id=p_execution_id AND state='RUNNING' FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 SELECT * INTO candidate_effect FROM public.post_response_intelligence_effects
   WHERE execution_id=p_execution_id AND effect_key='CANDIDATE_PROVIDER' AND state='COMPLETED';
 IF NOT FOUND OR candidate_effect.result_reference IS NOT NULL THEN RAISE EXCEPTION 'PERSISTENCE_CANDIDATE_UNAVAILABLE' USING ERRCODE='42501';END IF;
 IF candidate_effect.result_code='NO_ACCEPTED_CANDIDATES' THEN
  IF candidate_effect.result_payload IS NOT NULL THEN RAISE EXCEPTION 'PERSISTENCE_CANDIDATE_UNAVAILABLE' USING ERRCODE='42501';END IF;
 ELSIF candidate_effect.result_code='VALIDATED_CANDIDATES' THEN
  IF candidate_effect.result_payload IS NULL OR NOT public.post_response_generation_candidates_valid_v1(candidate_effect.result_payload) THEN RAISE EXCEPTION 'PERSISTENCE_CANDIDATE_UNAVAILABLE' USING ERRCODE='42501';END IF;
 ELSE RAISE EXCEPTION 'PERSISTENCE_CANDIDATE_UNAVAILABLE' USING ERRCODE='42501';
 END IF;
 SELECT * INTO persistence_effect FROM public.post_response_intelligence_effects
   WHERE execution_id=p_execution_id AND effect_key='HYPOTHESIS_PERSISTENCE' FOR UPDATE;
 IF NOT FOUND OR persistence_effect.state<>'CLAIMED'
    OR persistence_effect.result_code IS NOT NULL OR persistence_effect.result_reference IS NOT NULL OR persistence_effect.result_payload IS NOT NULL
 THEN RETURN false;END IF;
 IF candidate_effect.result_code='NO_ACCEPTED_CANDIDATES' THEN
  UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP,result_code='NO_HYPOTHESES_PERSISTED'
   WHERE execution_id=p_execution_id AND effect_key='HYPOTHESIS_PERSISTENCE' AND state='CLAIMED' AND result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL;
  RETURN FOUND;
 END IF;
 FOR candidate IN
   SELECT entry.value FROM jsonb_array_elements(candidate_effect.result_payload) WITH ORDINALITY AS entry(value,ordinality) ORDER BY entry.ordinality
 LOOP
  new_id := (candidate->>'hypothesisId')::uuid;
  SELECT count(*) INTO touched FROM public.background_create_system_hypothesis_v1(
    execution_row.user_id, new_id, candidate->>'statement', candidate->>'type', candidate->>'domain', candidate->>'scope',
    (SELECT coalesce(array_agg(item.value ORDER BY item.ordinality),'{}'::text[]) FROM jsonb_array_elements_text(candidate->'assumptions') WITH ORDINALITY AS item(value,ordinality)),
    (SELECT coalesce(array_agg(item.value ORDER BY item.ordinality),'{}'::text[]) FROM jsonb_array_elements_text(candidate->'disconfirmingConditions') WITH ORDINALITY AS item(value,ordinality)));
  IF touched<>1 THEN RAISE EXCEPTION 'HYPOTHESIS_PERSISTENCE_FAILED' USING ERRCODE='22023';END IF;
  FOR linked_evidence IN
    SELECT item.value FROM jsonb_array_elements_text(candidate->'supportingEvidenceIds') WITH ORDINALITY AS item(value,ordinality) ORDER BY item.ordinality
  LOOP
   SELECT count(*) INTO touched FROM public.background_attach_hypothesis_evidence_v1(execution_row.user_id, new_id, linked_evidence, 'SUPPORTING');
   IF touched<>1 THEN RAISE EXCEPTION 'HYPOTHESIS_PERSISTENCE_FAILED' USING ERRCODE='22023';END IF;
  END LOOP;
  FOR linked_evidence IN
    SELECT item.value FROM jsonb_array_elements_text(candidate->'contradictingEvidenceIds') WITH ORDINALITY AS item(value,ordinality) ORDER BY item.ordinality
  LOOP
   SELECT count(*) INTO touched FROM public.background_attach_hypothesis_evidence_v1(execution_row.user_id, new_id, linked_evidence, 'CONTRADICTING');
   IF touched<>1 THEN RAISE EXCEPTION 'HYPOTHESIS_PERSISTENCE_FAILED' USING ERRCODE='22023';END IF;
  END LOOP;
  FOREACH earlier_id IN ARRAY created_ids LOOP
   SELECT count(*) INTO touched FROM public.background_link_competing_hypotheses_v1(execution_row.user_id, earlier_id, new_id);
   IF touched<>1 THEN RAISE EXCEPTION 'HYPOTHESIS_PERSISTENCE_FAILED' USING ERRCODE='22023';END IF;
  END LOOP;
  created_ids := array_append(created_ids, new_id);
 END LOOP;
 -- Deterministic activation over the exact durable generated-ID order, after
 -- the whole graph exists and before the effect can complete. Each target is
 -- read once for its exact current version and transitioned exactly once.
 FOREACH new_id IN ARRAY created_ids LOOP
  SELECT generated.version INTO activation_version FROM public.hypotheses generated
    WHERE generated.id=new_id AND generated.user_id=execution_row.user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'HYPOTHESIS_PERSISTENCE_FAILED' USING ERRCODE='22023';END IF;
  SELECT count(*) INTO touched FROM public.transition_hypothesis_core_v1(
    execution_row.user_id, new_id, activation_version, 'ACTIVE', 'SYSTEM_GENERATION_ACTIVATION');
  IF touched<>1 THEN RAISE EXCEPTION 'HYPOTHESIS_PERSISTENCE_FAILED' USING ERRCODE='22023';END IF;
 END LOOP;
 UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP,result_code='HYPOTHESES_PERSISTED',
   result_payload=(SELECT jsonb_agg(entry.value->'hypothesisId' ORDER BY entry.ordinality) FROM jsonb_array_elements(candidate_effect.result_payload) WITH ORDINALITY AS entry(value,ordinality))
  WHERE execution_id=p_execution_id AND effect_key='HYPOTHESIS_PERSISTENCE' AND state='CLAIMED' AND result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'HYPOTHESIS_PERSISTENCE_FAILED' USING ERRCODE='22023';END IF;
 RETURN true;
END;$$;

-- CREATE OR REPLACE preserves the existing owner and ACLs; they are restated
-- so the hardened posture is explicit in this migration's text rather than
-- inherited silently.
ALTER FUNCTION public.persist_post_response_hypothesis_generation_v1(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.persist_post_response_hypothesis_generation_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.persist_post_response_hypothesis_generation_v1(uuid) TO service_role;

COMMIT;