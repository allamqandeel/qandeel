-- Finding 08 - Hypothesis Generation Atomicity & Durable Recovery v1 (QAN-AUD-05).
--
-- Before this migration the dispatcher's generation pair was multi-step,
-- non-atomic and non-recoverable: it claimed CANDIDATE_PROVIDER and
-- HYPOTHESIS_PERSISTENCE together, invoked the candidate provider, validated
-- the proposals, then created each accepted Hypothesis, attached its Evidence
-- and linked its competitors through separate database requests before
-- completing BOTH effects through the generic result-less RPC, keeping the
-- accepted Hypothesis IDs only in process memory. Four failure classes follow:
--   1. the provider result can be lost before durable completion;
--   2. a partial Hypothesis graph can commit if a later create/attach/link
--      request fails;
--   3. every write can commit while HYPOTHESIS_PERSISTENCE remains incomplete
--      after a crash;
--   4. a redelivery that finds both effects COMPLETED has nothing to recover,
--      so downstream Confidence receives an empty accepted set.
--
-- This forward-only migration closes those defects on the existing effect
-- ledger, exactly as migrations 0024/0029/0031 did for MEMORY_WRITE,
-- INTENT_PROVIDER and ASSOCIATION_PROVIDER. It keeps both effect keys, reuses
-- the canonical result_code / result_reference / result_payload fields, and
-- adds NO new column, table, ledger, queue or idempotency store:
--   * CANDIDATE_PROVIDER becomes a typed durable provider-result effect whose
--     successful vocabulary is NO_ACCEPTED_CANDIDATES (no reference, no
--     payload) or VALIDATED_CANDIDATES whose result_payload is the exact
--     post-validation canonical accepted candidate plan, with stable server
--     Hypothesis UUIDs assigned BEFORE durable completion;
--   * HYPOTHESIS_PERSISTENCE becomes a managed typed atomic-persistence
--     effect: ONE database command replays the durable candidate plan through
--     the existing narrow canonical background creation/attachment/link
--     primitives and completes the effect with the exact ordered persisted
--     Hypothesis UUID list, all inside one PostgreSQL transaction, so a
--     mid-batch failure rolls back every generated write and the completion;
--   * the generic result-less completion can no longer complete either
--     generation effect; only CONFIDENCE_BATCH remains generic.
--
-- Only the post-validation canonical candidate plan is durable. Raw provider
-- output, rejected proposals, rejection reasons, prompts, hidden reasoning,
-- provider metadata and error text are never persisted. Pre-0033 completed
-- generation rows with all-null result fields stay valid and are NOT
-- backfilled: their real outcome is unknowable, so runtime recovery treats
-- them as INDETERMINATE and quarantines. Nothing is inferred from later
-- Hypothesis rows, and no provider is ever replayed.

BEGIN;

-- 1. Canonical accepted-candidate plan validator. It validates durable SHAPE
--    only - exact keys, canonical vocabulary and bounds - and deliberately
--    reads no table: Hypotheses, Memory and Evidence eligibility are current
--    world state, and the validation policy this payload records already ran
--    before completion. Re-running collision or eligibility policy against
--    live rows here would let a later world change silently rewrite a past
--    validated result. Each candidate is exactly {hypothesisId, statement,
--    type, domain, scope, supportingEvidenceIds, contradictingEvidenceIds,
--    assumptions, disconfirmingConditions}; the plan is 1..5 candidates in
--    accepted order with unique canonical Hypothesis UUIDs, table-canonical
--    text bounds, per-role duplicate-free canonical memory:<uuid> Evidence
--    identifiers with no cross-role conflict, and no duplicate candidate
--    collision key under the exact hypothesisCollisionKey normalization
--    (NFKC + trim + whitespace collapse, via the canonical
--    canonical_evidence_content_key_v1 primitive from migration 0028). It is
--    deliberately not STRICT: a NULL payload must be a hard false, never a
--    NULL a CHECK would treat as satisfied.
CREATE FUNCTION public.post_response_generation_candidates_valid_v1(p_value jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
DECLARE
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  evidence_pattern constant text := '^memory:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  element jsonb; role_key text; role_list jsonb; entry text;
  hypothesis_ids text[] := '{}'; statement_keys text[] := '{}'; scope_keys text[] := '{}';
  supporting text[]; contradicting text[]; seen text[]; list_index integer;
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value)<>'array' THEN RETURN false; END IF;
  IF jsonb_array_length(p_value) NOT BETWEEN 1 AND 5 THEN RETURN false; END IF;
  FOR element IN SELECT value FROM jsonb_array_elements(p_value) AS candidate(value) LOOP
    IF jsonb_typeof(element)<>'object' THEN RETURN false; END IF;
    IF (SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(element) k)
       IS DISTINCT FROM ARRAY['assumptions','contradictingEvidenceIds','disconfirmingConditions','domain','hypothesisId','scope','statement','supportingEvidenceIds','type'] THEN RETURN false; END IF;
    IF jsonb_typeof(element->'hypothesisId')<>'string'
       OR (element->>'hypothesisId') !~* uuid_pattern THEN RETURN false; END IF;
    IF lower(element->>'hypothesisId') = ANY(hypothesis_ids) THEN RETURN false; END IF;
    hypothesis_ids := array_append(hypothesis_ids, lower(element->>'hypothesisId'));
    -- Text bounds mirror the canonical hypotheses table domain exactly.
    IF jsonb_typeof(element->'statement')<>'string'
       OR char_length(btrim(element->>'statement')) NOT BETWEEN 1 AND 2000 THEN RETURN false; END IF;
    IF jsonb_typeof(element->'type')<>'string' OR (element->>'type') NOT IN
       ('CAUSAL','BEHAVIORAL','MOTIVATIONAL','SITUATIONAL','RELATIONAL','DECISION','PREDICTIVE','INTERPRETIVE','STRATEGIC') THEN RETURN false; END IF;
    IF jsonb_typeof(element->'domain')<>'string' OR (element->>'domain') NOT IN
       ('GENERAL','RELATIONSHIP','WORK','DECISION','GOAL','INTERACTION') THEN RETURN false; END IF;
    IF jsonb_typeof(element->'scope')<>'string'
       OR char_length(btrim(element->>'scope')) NOT BETWEEN 1 AND 500 THEN RETURN false; END IF;
    -- Per-role canonical Evidence identifiers, duplicate-free within a role,
    -- bounded by the existing generation limit, with no cross-role conflict.
    supporting := '{}'; contradicting := '{}';
    FOREACH role_key IN ARRAY ARRAY['supportingEvidenceIds','contradictingEvidenceIds'] LOOP
      role_list := element->role_key;
      IF jsonb_typeof(role_list)<>'array' OR jsonb_array_length(role_list) > 32 THEN RETURN false; END IF;
      seen := '{}';
      IF EXISTS(SELECT 1 FROM jsonb_array_elements(role_list) AS linked(value) WHERE jsonb_typeof(linked.value)<>'string') THEN RETURN false; END IF;
      FOR entry IN SELECT linked.value FROM jsonb_array_elements_text(role_list) AS linked(value) LOOP
        IF entry !~* evidence_pattern THEN RETURN false; END IF;
        IF entry = ANY(seen) THEN RETURN false; END IF;
        seen := array_append(seen, entry);
      END LOOP;
      IF role_key='supportingEvidenceIds' THEN supporting := seen; ELSE contradicting := seen; END IF;
    END LOOP;
    IF supporting && contradicting THEN RETURN false; END IF;
    -- Structured text lists mirror the exact TypeScript generation policy:
    -- bounded, non-blank, duplicate-free as provided.
    FOREACH role_key IN ARRAY ARRAY['assumptions','disconfirmingConditions'] LOOP
      role_list := element->role_key;
      IF jsonb_typeof(role_list)<>'array' OR jsonb_array_length(role_list) > 8 THEN RETURN false; END IF;
      IF EXISTS(SELECT 1 FROM jsonb_array_elements(role_list) AS item(value) WHERE jsonb_typeof(item.value)<>'string') THEN RETURN false; END IF;
      seen := '{}';
      FOR entry IN SELECT item.value FROM jsonb_array_elements_text(role_list) AS item(value) LOOP
        IF char_length(btrim(entry)) NOT BETWEEN 1 AND 500 THEN RETURN false; END IF;
        IF entry = ANY(seen) THEN RETURN false; END IF;
        seen := array_append(seen, entry);
      END LOOP;
    END LOOP;
    -- Exact collision-key duplicate check: the same canonical normalization
    -- semantics as hypothesisCollisionKey, compared as a (statement, scope)
    -- pair because PostgreSQL text cannot embed the TypeScript NUL separator.
    statement_keys := array_append(statement_keys, public.canonical_evidence_content_key_v1(element->>'statement'));
    scope_keys := array_append(scope_keys, public.canonical_evidence_content_key_v1(element->>'scope'));
  END LOOP;
  FOR list_index IN 2..cardinality(statement_keys) LOOP
    IF EXISTS(
      SELECT 1 FROM generate_series(1, list_index-1) earlier
      WHERE statement_keys[earlier]=statement_keys[list_index] AND scope_keys[earlier]=scope_keys[list_index]
    ) THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;$$;

ALTER FUNCTION public.post_response_generation_candidates_valid_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.post_response_generation_candidates_valid_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- 2. Canonical persisted-Hypothesis-ID list validator: 1..5 unique canonical
--    UUID strings in plan order. Shape only; no table reads; same internal-only
--    posture as the candidate validator.
CREATE FUNCTION public.post_response_persisted_hypothesis_ids_valid_v1(p_value jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
DECLARE
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  element jsonb; seen text[] := '{}';
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value)<>'array' THEN RETURN false; END IF;
  IF jsonb_array_length(p_value) NOT BETWEEN 1 AND 5 THEN RETURN false; END IF;
  FOR element IN SELECT value FROM jsonb_array_elements(p_value) AS entry(value) LOOP
    IF jsonb_typeof(element)<>'string' THEN RETURN false; END IF;
    IF (element#>>'{}') !~* uuid_pattern THEN RETURN false; END IF;
    IF lower(element#>>'{}') = ANY(seen) THEN RETURN false; END IF;
    seen := array_append(seen, lower(element#>>'{}'));
  END LOOP;
  RETURN true;
END;$$;

ALTER FUNCTION public.post_response_persisted_hypothesis_ids_valid_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.post_response_persisted_hypothesis_ids_valid_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- 3. Result domain. The claimed/memory/intent/association checks from
--    migrations 0029/0031 are untouched; only the untyped check is widened so
--    the two generation effects may carry a result, and each states its own
--    domain: a legacy all-null row, a payload-free no-outcome code, or a
--    payload-bearing code whose payload is schema-valid. There is no third
--    successful code and no reference-bearing generation result.
ALTER TABLE public.post_response_intelligence_effects
  DROP CONSTRAINT post_response_intelligence_effects_untyped_result_check,
  ADD CONSTRAINT post_response_intelligence_effects_untyped_result_check CHECK (
    effect_key IN ('MEMORY_WRITE','INTENT_PROVIDER','ASSOCIATION_PROVIDER','CANDIDATE_PROVIDER','HYPOTHESIS_PERSISTENCE')
    OR (result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL)
  ),
  ADD CONSTRAINT post_response_intelligence_effects_candidate_result_check CHECK (
    effect_key<>'CANDIDATE_PROVIDER'
    OR (result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL)
    OR (state='COMPLETED' AND result_code='NO_ACCEPTED_CANDIDATES' AND result_reference IS NULL AND result_payload IS NULL)
    OR (state='COMPLETED' AND result_code='VALIDATED_CANDIDATES' AND result_reference IS NULL
        AND result_payload IS NOT NULL AND public.post_response_generation_candidates_valid_v1(result_payload))
  ),
  ADD CONSTRAINT post_response_intelligence_effects_persistence_result_check CHECK (
    effect_key<>'HYPOTHESIS_PERSISTENCE'
    OR (result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL)
    OR (state='COMPLETED' AND result_code='NO_HYPOTHESES_PERSISTED' AND result_reference IS NULL AND result_payload IS NULL)
    OR (state='COMPLETED' AND result_code='HYPOTHESES_PERSISTED' AND result_reference IS NULL
        AND result_payload IS NOT NULL AND public.post_response_persisted_hypothesis_ids_valid_v1(result_payload))
  );

-- 4. The generic result-less completion can no longer complete any typed
--    effect. MEMORY_WRITE, INTENT_PROVIDER and ASSOCIATION_PROVIDER keep their
--    migration 0024/0029/0031 error contracts verbatim; the two generation
--    effects now fail closed the same way instead of silently completing with
--    no recoverable result. Only CONFIDENCE_BATCH still completes generically.
CREATE OR REPLACE FUNCTION public.complete_post_response_intelligence_effect_v1(p_execution_id uuid,p_effect_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_effect_key='MEMORY_WRITE' THEN RAISE EXCEPTION 'MEMORY_RESULT_REQUIRED' USING ERRCODE='22023';END IF;
 IF p_effect_key='INTENT_PROVIDER' THEN RAISE EXCEPTION 'INTENT_RESULT_REQUIRED' USING ERRCODE='22023';END IF;
 IF p_effect_key='ASSOCIATION_PROVIDER' THEN RAISE EXCEPTION 'ASSOCIATION_RESULT_REQUIRED' USING ERRCODE='22023';END IF;
 IF p_effect_key='CANDIDATE_PROVIDER' THEN RAISE EXCEPTION 'CANDIDATE_RESULT_REQUIRED' USING ERRCODE='22023';END IF;
 IF p_effect_key='HYPOTHESIS_PERSISTENCE' THEN RAISE EXCEPTION 'HYPOTHESIS_PERSISTENCE_COMMAND_REQUIRED' USING ERRCODE='22023';END IF;
 UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP WHERE execution_id=p_execution_id AND effect_key=p_effect_key AND state='CLAIMED';
 RETURN FOUND;
END;$$;

-- 5. Typed Candidate completion. This is the only way a new CANDIDATE_PROVIDER
--    effect can become COMPLETED, and it writes the durable result and the
--    CLAIMED -> COMPLETED transition in one statement, so a completed
--    Candidate effect can never exist without a recoverable result. The
--    effect key is fixed - there is no p_effect_key parameter.
--
--    Order matters: the typed result is validated before the execution is
--    touched, so an invalid result leaves the effect CLAIMED and result-less.
--    The execution is then locked and must still be RUNNING; a wrong or
--    terminal execution returns false without mutating anything. The durable
--    authorized Intent of THIS execution (completed INTENT_PROVIDER /
--    INTENT_AUTHORIZED, migration 0029) is the stable provenance anchor: it
--    must exist, and for VALIDATED_CANDIDATES every candidate's domain must
--    equal the durable Intent domain, every candidate's scope must equal the
--    durable Intent serialized scope, and every candidate Evidence identifier
--    must belong to the durable Intent Evidence set. Current-state provider
--    authorization is deliberately NOT re-run: the decision this payload
--    records already happened, and re-deciding it against a changed world
--    would rewrite a past validated result. The final UPDATE requires
--    state='CLAIMED' with all result columns still null, so the first durable
--    result of an effect is immutable - a second completion returns false and
--    changes nothing.
CREATE FUNCTION public.complete_post_response_candidate_provider_effect_v1(p_execution_id uuid,p_result_code text,p_result_payload jsonb DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE execution_row public.post_response_intelligence_executions; intent_payload jsonb;
BEGIN
 IF p_result_code='NO_ACCEPTED_CANDIDATES' THEN
  IF p_result_payload IS NOT NULL THEN RAISE EXCEPTION 'INVALID_CANDIDATE_RESULT' USING ERRCODE='22023';END IF;
 ELSIF p_result_code='VALIDATED_CANDIDATES' THEN
  IF p_result_payload IS NULL OR NOT public.post_response_generation_candidates_valid_v1(p_result_payload) THEN RAISE EXCEPTION 'INVALID_CANDIDATE_RESULT' USING ERRCODE='22023';END IF;
 ELSE RAISE EXCEPTION 'INVALID_CANDIDATE_RESULT' USING ERRCODE='22023';
 END IF;
 SELECT * INTO execution_row FROM public.post_response_intelligence_executions WHERE id=p_execution_id AND state='RUNNING' FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 SELECT effect.result_payload INTO intent_payload FROM public.post_response_intelligence_effects effect
   WHERE effect.execution_id=p_execution_id AND effect.effect_key='INTENT_PROVIDER' AND effect.state='COMPLETED' AND effect.result_code='INTENT_AUTHORIZED';
 IF NOT FOUND OR intent_payload IS NULL THEN RAISE EXCEPTION 'CANDIDATE_INTENT_UNAVAILABLE' USING ERRCODE='42501';END IF;
 IF p_result_code='VALIDATED_CANDIDATES' THEN
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_result_payload) AS candidate(value)
     WHERE candidate.value->>'domain' IS DISTINCT FROM intent_payload->>'domain'
        OR candidate.value->>'scope' IS DISTINCT FROM intent_payload->'scope'->>'serialized')
  THEN RAISE EXCEPTION 'CANDIDATE_INTENT_MISMATCH' USING ERRCODE='42501';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_result_payload) AS candidate(value)
     CROSS JOIN LATERAL (
       SELECT supporting.value FROM jsonb_array_elements_text(candidate.value->'supportingEvidenceIds') AS supporting(value)
       UNION ALL
       SELECT contradicting.value FROM jsonb_array_elements_text(candidate.value->'contradictingEvidenceIds') AS contradicting(value)
     ) AS linked(value)
     WHERE NOT (intent_payload->'evidenceIds') ? linked.value)
  THEN RAISE EXCEPTION 'CANDIDATE_INTENT_MISMATCH' USING ERRCODE='42501';END IF;
 END IF;
 UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP,result_code=p_result_code,result_payload=p_result_payload
  WHERE execution_id=p_execution_id AND effect_key='CANDIDATE_PROVIDER' AND state='CLAIMED' AND result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL;
 RETURN FOUND;
END;$$;

ALTER FUNCTION public.complete_post_response_candidate_provider_effect_v1(uuid,text,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.complete_post_response_candidate_provider_effect_v1(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_post_response_candidate_provider_effect_v1(uuid,text,jsonb) TO service_role;

-- 6. Atomic Hypothesis batch persistence. The application supplies ONLY the
--    execution identity: no candidate payload, no user, no session. The
--    command reads the exact durable Candidate result from the ledger, locks
--    the RUNNING execution and the exact HYPOTHESIS_PERSISTENCE effect, and
--    replays the durable plan through the existing narrow canonical background
--    primitives (migration 0021/0028) instead of duplicating their rules:
--    creation preserves SYSTEM_GENERATED origin, CANDIDATE status and
--    database-derived version/timestamps; attachment re-checks canonical
--    Evidence eligibility through the single migration-0028 source of truth
--    (Finding 05 is not weakened); linking preserves the exact
--    create -> supporting -> contradicting -> earlier-competitor order and
--    version behavior of the current successful path. Only after every write
--    succeeds is the effect completed with HYPOTHESES_PERSISTED and the exact
--    ordered candidate UUID list - in the SAME transaction, so any failure
--    (ineligible Evidence included) rolls back every created Hypothesis,
--    every attachment, every link and the completion: no partial generated
--    graph can survive. For NO_ACCEPTED_CANDIDATES it writes no Hypothesis
--    and completes with NO_HYPOTHESES_PERSISTED. A legacy result-less or
--    malformed Candidate row fails closed: nothing is inferred, nothing is
--    replayed. The first durable Persistence result is immutable - a
--    completed or result-bearing effect returns false and changes nothing.
CREATE FUNCTION public.persist_post_response_hypothesis_generation_v1(p_execution_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 execution_row public.post_response_intelligence_executions;
 candidate_effect public.post_response_intelligence_effects;
 persistence_effect public.post_response_intelligence_effects;
 candidate jsonb; created_ids uuid[] := '{}'::uuid[]; new_id uuid; linked_evidence text; earlier_id uuid; touched integer;
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
 UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP,result_code='HYPOTHESES_PERSISTED',
   result_payload=(SELECT jsonb_agg(entry.value->'hypothesisId' ORDER BY entry.ordinality) FROM jsonb_array_elements(candidate_effect.result_payload) WITH ORDINALITY AS entry(value,ordinality))
  WHERE execution_id=p_execution_id AND effect_key='HYPOTHESIS_PERSISTENCE' AND state='CLAIMED' AND result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'HYPOTHESIS_PERSISTENCE_FAILED' USING ERRCODE='22023';END IF;
 RETURN true;
END;$$;

ALTER FUNCTION public.persist_post_response_hypothesis_generation_v1(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.persist_post_response_hypothesis_generation_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.persist_post_response_hypothesis_generation_v1(uuid) TO service_role;

COMMIT;
