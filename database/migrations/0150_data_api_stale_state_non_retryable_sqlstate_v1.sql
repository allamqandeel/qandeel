-- PROD-RETRY-01 - Data API stale-state refusals answered with a SQLSTATE PostgREST never re-runs v1.
--
-- Closes the repository side of QAN-BL-PROD-06 under the Product Owner's C1 decision (2026-10-10, "C1 ACCEPTED WITH
-- CORRECTIONS - AUTHORIZE C2"; option B, option S for the Hypothesis batch). It is a controlled forward amendment to
-- the frozen refusal contracts of migrations 0032, 0034, 0036, 0070, 0071, 0078, 0081 and 0109. No historical
-- migration is edited.
--
-- THE HAZARD. PostgREST before v16.0 runs every request through hasql-transaction, which re-runs the WHOLE transaction,
-- without bound, whenever it fails with SQLSTATE 40001 (PostgREST #3673; fixed in v16.0). The twelve function bodies
-- below answer a caller's stale expectation - a version, an epoch, a clock token or an expected current id that the
-- caller itself sends - with a DETERMINISTIC 40001. A re-run sends the same argument against the same committed state,
-- so through such a PostgREST the request is never answered and holds a pool connection, and the API's designed
-- stale-state handling never runs. Twelve Data API entry points reach these bodies (C1 Final Impact Matrix):
--   transition_hypothesis_v2, apply_hypothesis_evidence_update, background_apply_hypothesis_evidence_update_v1,
--   commit_finalized_exchange_with_full_semantic_chain_v1, get_conversation_thread_identity_dossier_page_v1,
--   grant_ / revoke_shared_world_standing_context_v1, pause_ / turn_off_matching_participation_v1,
--   revoke_matching_context_v1, revoke_pre_match_disclosure_authority_v1 and rotate_own_sealed_shared_id_v1.
--
-- THE CHANGE. Every `ERRCODE='40001'` in the eleven raising bodies becomes `ERRCODE='PT409'` (23 sites), and nothing
-- else in them changes. PostgREST answers SQLSTATE PTxyz with HTTP xyz on every supported line and never re-runs it
-- (the PT429 precedent of 0131 is proven live on v12.2.9 / v13.0.8 / v14.18 / v16.4). The message, DETAIL and HINT of
-- every refusal are byte-identical, so the error body differs only in `code` ('PT409' for '40001') and the HTTP status
-- in 409 for 500 (v16+; before v16 there was no answer at all).
--
--   transition_hypothesis_core_v1 (0036)                 2  'Stale hypothesis version.'
--   apply_hypothesis_evidence_update_core_v1 (0032)      2  'Stale hypothesis version.'
--   get_conversation_thread_identity_dossier_page_v1 (0070)  1  STALE_THREAD_IDENTITY_CONTEXT
--   commit_finalized_exchange_with_full_semantic_chain_v1 (0071)  2  STALE_CONVERSATIONAL_FOCUS_CONTEXT, STALE_THREAD_IDENTITY_CONTEXT
--   grant_ / revoke_shared_world_standing_context_v1 (0078)   2 + 2  STANDING_CONTEXT_STALE_STATE
--   rotate_shared_world_invite_credential_v1 (0081)      4  SHARED_INVITE_CREDENTIAL_STALE_STATE
--   pause_ / turn_off_matching_participation_v1, revoke_matching_context_v1,
--   revoke_pre_match_disclosure_authority_v1 (0109)      2 each  MATCHING_STALE_STATE
--
-- THE ONE CATCHER ON THE PATH. execute_post_response_hypothesis_update_batch_v1_core (0034, renamed by 0072) reaches
-- apply_hypothesis_evidence_update_core_v1 through background_apply_hypothesis_evidence_update_v1 and turns its stale
-- refusal into the durable, all-or-nothing UPDATES_REJECTED. Its handler gains `OR SQLSTATE 'PT409'` and keeps
-- '40001', so it catches a strict superset of what it caught before and the outcome is unchanged.
--
-- WHAT DOES NOT CHANGE. No other function: every other application function's body and posture is proven unchanged
-- below. Compare-and-swap predicates, lock order, idempotent replay, no-write-on-stale (a RAISE still aborts the
-- request's transaction), owners, EXECUTE grants, SECURITY DEFINER / INVOKER, search_path, signatures, defaults and
-- return types are untouched; no table, policy, RLS setting, grant or row is touched. 0149's Matching narrowing is
-- untouched (it is privileges only, and this migration changes none). Paths that stay on 40001 on purpose:
--   race-converging   start_own_public_experience_draft_v1 and post_own_public_discussion_v1 reach
--                     ensure_public_identity_v1's first-creation race, which a re-run resolves (ALREADY_PRESENT);
--   guarded           record_understanding_disagreement_v1 (locks and pre-checks the version before the core) and
--                     persist_post_response_hypothesis_generation_v1 (activates only rows created in the same
--                     transaction) cannot reach the core's raise;
--   absorbed          the Shared World and Public Experience wrappers that turn 40001 into STALE / UNAVAILABLE;
--   unreachable       every raiser no application role can reach (I-07B..D, Replay, the 0066-0068 coordinators).
-- SQLSTATE 40P01 is never raised by any function and is not converted: a genuine deadlock is correctly retried.
-- The catalog guard in verify-migration-0150.mjs proves each of those classifications from the live catalog.
--
-- HOW THIS FILE PROVES ITSELF. One transaction: (1) snapshot every application function (public and *_private) -
-- body and full posture; (2) refuse to run unless each target body holds exactly the expected sites and no PT409
-- (a drifted body anywhere aborts the migration); (3) CREATE OR REPLACE the twelve, each a verbatim copy of its
-- defining statement with only the approved token changed; (4) require, from the catalog, that every new body equals
-- the old body with exactly that substitution, that oid, owner, ACL, security, configuration, signature, defaults,
-- result and comment are unchanged, and that no other application function changed, appeared or disappeared.
--
-- DEPLOYMENT. Forward-only. Ship the API that recognises both '40001' and 'PT409' (PROD-RETRY-01) first or together.
-- 0150 re-creates 0078 / 0081 / 0109 functions, so a hosted project behind 0149 receives it only in its catch-up, in
-- the same controlled window as 0149, and never after any exposure of 0078 / 0081 / 0109. Never reproduce the hazard
-- on a hosted environment.
BEGIN;

-- Every name below is schema-qualified, and every signature is compared in its fully qualified form.
SET LOCAL search_path = '';

-- 1. Snapshot of every application function before anything changes.
CREATE TEMP TABLE prod_retry_01_before ON COMMIT DROP AS
SELECT p.oid,
       p.oid::regprocedure::text AS signature,
       p.prosrc,
       jsonb_build_array(
         pg_get_userbyid(p.proowner), p.proacl::text, p.prosecdef, p.proconfig::text, p.provolatile::text,
         p.proparallel::text, p.proisstrict, p.proleakproof, p.procost, p.prorows, p.prokind::text, p.prolang::text,
         p.prosupport::text, pg_get_function_arguments(p.oid), pg_get_function_result(p.oid),
         obj_description(p.oid, 'pg_proc')) AS posture
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' OR n.nspname LIKE '%\_private';

CREATE TEMP TABLE prod_retry_01_targets (signature text PRIMARY KEY, kind text NOT NULL, sites integer NOT NULL) ON COMMIT DROP;
INSERT INTO prod_retry_01_targets (signature, kind, sites) VALUES
  ('public.transition_hypothesis_core_v1(uuid,uuid,integer,text,text)', 'RAISER', 2),
  ('public.apply_hypothesis_evidence_update_core_v1(uuid,uuid,uuid,integer,text,text)', 'RAISER', 2),
  ('public.get_conversation_thread_identity_dossier_page_v1(uuid,bigint,uuid,integer)', 'RAISER', 1),
  ('public.commit_finalized_exchange_with_full_semantic_chain_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,text,text,text,integer,text,text,integer,bigint,bigint)', 'RAISER', 2),
  ('public.grant_shared_world_standing_context_v1(uuid,uuid,uuid,uuid[],uuid)', 'RAISER', 2),
  ('public.revoke_shared_world_standing_context_v1(uuid,uuid,uuid)', 'RAISER', 2),
  ('public.rotate_shared_world_invite_credential_v1(uuid,text,bigint)', 'RAISER', 4),
  ('public.pause_matching_participation_v1(uuid,uuid)', 'RAISER', 2),
  ('public.turn_off_matching_participation_v1(uuid,uuid)', 'RAISER', 2),
  ('public.revoke_matching_context_v1(uuid,uuid)', 'RAISER', 2),
  ('public.revoke_pre_match_disclosure_authority_v1(uuid,uuid)', 'RAISER', 2),
  ('public.execute_post_response_hypothesis_update_batch_v1_core(uuid,jsonb)', 'CATCHER', 1);

-- 2. Pre-conditions: the exact expected bodies, or nothing happens.
DO $$
DECLARE
  t record;
  src text;
  occurrences integer;
BEGIN
  FOR t IN SELECT * FROM pg_temp.prod_retry_01_targets ORDER BY signature LOOP
    SELECT b.prosrc INTO src FROM pg_temp.prod_retry_01_before b WHERE b.signature = t.signature;
    IF src IS NULL THEN
      RAISE EXCEPTION 'PROD_RETRY_01_0150_PRECONDITION: % does not exist', t.signature;
    END IF;
    IF position('PT409' IN src) > 0 THEN
      RAISE EXCEPTION 'PROD_RETRY_01_0150_PRECONDITION: % already mentions PT409', t.signature;
    END IF;
    IF t.kind = 'RAISER' THEN
      occurrences := (length(src) - length(replace(src, $q$ERRCODE='40001'$q$, ''))) / length($q$ERRCODE='40001'$q$);
      IF occurrences <> t.sites OR (length(src) - length(replace(src, '40001', ''))) / 5 <> t.sites THEN
        RAISE EXCEPTION 'PROD_RETRY_01_0150_PRECONDITION: % holds % stale-state sites, expected %', t.signature, occurrences, t.sites;
      END IF;
    ELSE
      occurrences := (length(src) - length(replace(src, $q$WHEN SQLSTATE '40001' OR SQLSTATE '22023' THEN$q$, '')))
                     / length($q$WHEN SQLSTATE '40001' OR SQLSTATE '22023' THEN$q$);
      IF occurrences <> 1 THEN
        RAISE EXCEPTION 'PROD_RETRY_01_0150_PRECONDITION: % holds % batch rejection handlers, expected 1', t.signature, occurrences;
      END IF;
    END IF;
  END LOOP;
END
$$;

-- 3. The twelve bodies. Each statement is its defining migration's statement verbatim (renamed only where 0072 renamed
--    the function), with ONLY the approved token changed.
-- 0036 - Hypothesis lifecycle core (2 sites).
CREATE OR REPLACE FUNCTION public.transition_hypothesis_core_v1(
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
    RAISE EXCEPTION 'Stale hypothesis version.' USING ERRCODE='PT409'; END IF;
  IF NOT public.hypothesis_lifecycle_transition_allowed_v1(current_hypothesis.status, p_status) THEN
    RAISE EXCEPTION 'Invalid hypothesis transition.' USING ERRCODE='22023'; END IF;

  UPDATE public.hypotheses
     SET status=p_status, version=version+1, updated_at=CURRENT_TIMESTAMP
   WHERE id=current_hypothesis.id AND user_id=p_user_id AND version=p_expected_version
   RETURNING * INTO updated_hypothesis;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stale hypothesis version.' USING ERRCODE='PT409'; END IF;

  INSERT INTO public.hypothesis_lifecycle_transitions(
    id,user_id,hypothesis_id,before_status,after_status,before_version,after_version,source)
  VALUES(
    pg_catalog.gen_random_uuid(), p_user_id, current_hypothesis.id,
    current_hypothesis.status, updated_hypothesis.status,
    current_hypothesis.version, updated_hypothesis.version, p_source);

  RETURN NEXT updated_hypothesis;
END;$$;

-- 0032 - Hypothesis Evidence update core (2 sites).
CREATE OR REPLACE FUNCTION public.apply_hypothesis_evidence_update_core_v1(
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
  IF current_hypothesis.version <> p_expected_version THEN RAISE EXCEPTION 'Stale hypothesis version.' USING ERRCODE='PT409'; END IF;
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
  IF NOT FOUND THEN RAISE EXCEPTION 'Stale hypothesis version.' USING ERRCODE='PT409'; END IF;

  INSERT INTO public.hypothesis_updates(id,user_id,hypothesis_id,before_version,after_version,evidence_id,evidence_role,source)
    VALUES(p_update_id,p_user_id,current_hypothesis.id,current_hypothesis.version,updated_hypothesis.version,p_evidence_id,p_evidence_role,'QANDEEL_HYPOTHESIS_UPDATE_LOOP')
    RETURNING * INTO update_record;
  RETURN QUERY SELECT to_jsonb(update_record),to_jsonb(updated_hypothesis);
END; $$;

-- 0034 (renamed by 0072) - the batch handler accepts PT409 as well as 40001; nothing else changes.
CREATE OR REPLACE FUNCTION public.execute_post_response_hypothesis_update_batch_v1_core(p_execution_id uuid,p_invocation_ids jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 execution_row public.post_response_intelligence_executions;
 association_effect public.post_response_intelligence_effects;
 memory_reference text;
 command_count integer; bound_count integer := 0;
 command jsonb; invocation jsonb; locked_id uuid;
 mutation_update jsonb; mutation_hypothesis jsonb;
 confidence_row public.confidence_evaluations;
 confidence_status text;
 receipts jsonb := '[]'::jsonb;
 ordinal integer := 0; item integer;
 rejected boolean := false;
BEGIN
 IF NOT public.post_response_hypothesis_update_invocation_ids_valid_v1(p_invocation_ids) THEN
  RAISE EXCEPTION 'INVALID_HYPOTHESIS_UPDATE_INVOCATION_IDS' USING ERRCODE='22023';END IF;
 SELECT * INTO execution_row FROM public.post_response_intelligence_executions WHERE id=p_execution_id AND state='RUNNING' FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 IF EXISTS(SELECT 1 FROM public.post_response_intelligence_effects WHERE execution_id=p_execution_id AND effect_key='HYPOTHESIS_UPDATE_BATCH') THEN RETURN false;END IF;
 -- The exact durable A2.3a result is the ONLY command authority.
 SELECT * INTO association_effect FROM public.post_response_intelligence_effects
   WHERE execution_id=p_execution_id AND effect_key='ASSOCIATION_PROVIDER' AND state='COMPLETED';
 IF NOT FOUND OR association_effect.result_code IS DISTINCT FROM 'AUTHORIZED_COMMANDS'
    OR association_effect.result_reference IS NOT NULL
    OR association_effect.result_payload IS NULL
    OR NOT public.post_response_association_commands_valid_v1(association_effect.result_payload)
 THEN RAISE EXCEPTION 'HYPOTHESIS_UPDATE_COMMANDS_UNAVAILABLE' USING ERRCODE='42501';END IF;
 command_count := jsonb_array_length(association_effect.result_payload);
 IF jsonb_array_length(p_invocation_ids) <> command_count THEN
  RAISE EXCEPTION 'INVALID_HYPOTHESIS_UPDATE_INVOCATION_IDS' USING ERRCODE='22023';END IF;
 -- Defense in depth: the commands must still be bound to THIS execution's
 -- durable fresh Evidence. No later Memory state is consulted.
 SELECT result_reference INTO memory_reference FROM public.post_response_intelligence_effects
   WHERE execution_id=p_execution_id AND effect_key='MEMORY_WRITE' AND state='COMPLETED' AND result_code='FRESH_EVIDENCE_CREATED';
 IF NOT FOUND OR memory_reference IS NULL THEN RAISE EXCEPTION 'HYPOTHESIS_UPDATE_EVIDENCE_UNAVAILABLE' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(association_effect.result_payload) AS entry(value) WHERE entry.value->>'evidenceId' IS DISTINCT FROM memory_reference)
 THEN RAISE EXCEPTION 'HYPOTHESIS_UPDATE_EVIDENCE_MISMATCH' USING ERRCODE='42501';END IF;
 -- Internal claim: it lives and dies with this transaction, so no CLAIMED
 -- managed row can ever be observed by a redelivery.
 INSERT INTO public.post_response_intelligence_effects(execution_id,effect_key,state) VALUES(p_execution_id,'HYPOTHESIS_UPDATE_BATCH','CLAIMED');
 -- Deterministic pre-lock: every target, bound to the execution owner and the
 -- exact conversation-session scope, locked in id order. A missing binding is
 -- a deterministic canonical rejection, not an error.
 FOR locked_id IN
   SELECT h.id FROM public.hypotheses h
    WHERE h.user_id=execution_row.user_id
      AND h.scope='CONVERSATION_SESSION:'||execution_row.session_id::text
      AND h.id IN (SELECT (entry.value->>'hypothesisId')::uuid FROM jsonb_array_elements(association_effect.result_payload) AS entry(value))
    ORDER BY h.id ASC
    FOR UPDATE
 LOOP
  bound_count := bound_count + 1;
 END LOOP;
 IF bound_count <> command_count THEN
  rejected := true;
 ELSE
  -- All-or-nothing mutation phase: one inner subtransaction around the whole
  -- batch. Any expected canonical rejection (stale version 40001, ineligible
  -- or already-attached Evidence 22023, a target that vanished from the bound
  -- scope) rolls back EVERY mutation and audit row of this batch. Anything
  -- unexpected propagates and aborts the entire managed transaction.
  BEGIN
   FOR command, invocation IN
     SELECT c.value, i.value
       FROM jsonb_array_elements(association_effect.result_payload) WITH ORDINALITY AS c(value,ord)
       JOIN jsonb_array_elements(p_invocation_ids) WITH ORDINALITY AS i(value,ord2) ON c.ord=i.ord2
      ORDER BY c.ord
   LOOP
    ordinal := ordinal + 1;
    mutation_update := NULL; mutation_hypothesis := NULL;
    SELECT m."update", m.hypothesis INTO mutation_update, mutation_hypothesis
      FROM public.background_apply_hypothesis_evidence_update_v1(
        execution_row.user_id,
        execution_row.session_id,
        (invocation->>'updateId')::uuid,
        (command->>'hypothesisId')::uuid,
        (command->>'expectedVersion')::integer,
        command->>'evidenceId',
        command->>'evidenceRole') m;
    IF mutation_update IS NULL OR mutation_hypothesis IS NULL THEN
     RAISE EXCEPTION 'HYPOTHESIS_UPDATE_TARGET_UNBOUND' USING ERRCODE='22023';END IF;
    -- The returned tuple must be exactly the canonical mutation this command
    -- asked for; anything else is an internal invariant failure that aborts
    -- the whole managed transaction (never a durable rejection).
    IF mutation_update->>'id' IS DISTINCT FROM invocation->>'updateId'
     OR mutation_update->>'user_id' IS DISTINCT FROM execution_row.user_id::text
     OR mutation_hypothesis->>'user_id' IS DISTINCT FROM execution_row.user_id::text
     OR mutation_update->>'hypothesis_id' IS DISTINCT FROM command->>'hypothesisId'
     OR mutation_hypothesis->>'id' IS DISTINCT FROM command->>'hypothesisId'
     OR mutation_update->>'evidence_id' IS DISTINCT FROM command->>'evidenceId'
     OR mutation_update->>'evidence_role' IS DISTINCT FROM command->>'evidenceRole'
     OR (mutation_update->>'before_version')::integer IS DISTINCT FROM (command->>'expectedVersion')::integer
     OR (mutation_update->>'after_version')::integer IS DISTINCT FROM (command->>'expectedVersion')::integer + 1
     OR (mutation_hypothesis->>'version')::integer IS DISTINCT FROM (mutation_update->>'after_version')::integer
     OR mutation_update->>'source' IS DISTINCT FROM 'QANDEEL_HYPOTHESIS_UPDATE_LOOP'
    THEN RAISE EXCEPTION 'HYPOTHESIS_UPDATE_BATCH_INTEGRITY' USING ERRCODE='XX000';END IF;
    receipts := receipts || jsonb_build_object(
      'commandOrdinal',ordinal,
      'updateId',invocation->>'updateId',
      'confidenceEvaluationId',invocation->>'confidenceEvaluationId',
      'hypothesisId',command->>'hypothesisId',
      'expectedVersion',(command->>'expectedVersion')::integer,
      'evidenceId',command->>'evidenceId',
      'evidenceRole',command->>'evidenceRole',
      'beforeVersion',(mutation_update->>'before_version')::integer,
      'afterVersion',(mutation_update->>'after_version')::integer,
      'confidenceStatus','PENDING_RETRY');
   END LOOP;
  EXCEPTION
   WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' OR SQLSTATE '22023' THEN
    rejected := true;
  END;
 END IF;
 IF rejected THEN
  -- Deterministic canonical rejection: zero mutation from this batch
  -- committed, and the typed rejection is durable. No exception text, no
  -- stack trace, no provider data.
  UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP,result_code='UPDATES_REJECTED'
   WHERE execution_id=p_execution_id AND effect_key='HYPOTHESIS_UPDATE_BATCH' AND state='CLAIMED' AND result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'HYPOTHESIS_UPDATE_BATCH_INTEGRITY' USING ERRCODE='XX000';END IF;
  RETURN false;
 END IF;
 -- Exact-version Confidence phase: one isolated sub-block per mutation. The
 -- target version is EXACTLY the mutation's after_version - never a
 -- latest-version re-read, never a substitution (Finding 09). A failed attempt
 -- rolls back only that evaluation and becomes a durable PENDING_RETRY
 -- receipt; the mutation batch is never rolled back by Confidence.
 FOR item IN 1..command_count LOOP
  BEGIN
   confidence_row := NULL;
   SELECT * INTO confidence_row FROM public.background_create_confidence_evaluation_v1(
     execution_row.user_id,
     ((p_invocation_ids->(item-1))->>'confidenceEvaluationId')::uuid,
     ((receipts->(item-1))->>'hypothesisId')::uuid,
     ((receipts->(item-1))->>'afterVersion')::integer);
   IF confidence_row.id IS NULL
    OR confidence_row.id::text IS DISTINCT FROM (p_invocation_ids->(item-1))->>'confidenceEvaluationId'
    OR confidence_row.user_id IS DISTINCT FROM execution_row.user_id
    OR confidence_row.target_id::text IS DISTINCT FROM (receipts->(item-1))->>'hypothesisId'
    OR confidence_row.target_type IS DISTINCT FROM 'HYPOTHESIS'
    OR confidence_row.target_version IS DISTINCT FROM ((receipts->(item-1))->>'afterVersion')::integer
    OR confidence_row.provenance IS DISTINCT FROM 'QANDEEL_CONFIDENCE_RUNTIME'
   THEN RAISE EXCEPTION 'HYPOTHESIS_UPDATE_CONFIDENCE_INTEGRITY' USING ERRCODE='22023';END IF;
   confidence_status := 'EVALUATED';
  EXCEPTION WHEN OTHERS THEN
   confidence_status := 'PENDING_RETRY';
  END;
  IF confidence_status='EVALUATED' THEN
   receipts := jsonb_set(receipts, ARRAY[(item-1)::text,'confidenceStatus'], '"EVALUATED"'::jsonb);
  END IF;
 END LOOP;
 -- Atomic durable completion: mutations, audits, Confidence rows, durable
 -- PENDING_RETRY statuses and the typed receipt commit together.
 UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP,result_code='UPDATES_APPLIED',result_payload=receipts
  WHERE execution_id=p_execution_id AND effect_key='HYPOTHESIS_UPDATE_BATCH' AND state='CLAIMED' AND result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'HYPOTHESIS_UPDATE_BATCH_INTEGRITY' USING ERRCODE='XX000';END IF;
 RETURN true;
END;$$;

-- 0071 - the FINAL conversation commit (2 sites).
CREATE OR REPLACE FUNCTION public.commit_finalized_exchange_with_full_semantic_chain_v1(
  p_session_id uuid,
  p_user_id uuid,
  p_user_source_turn_id uuid,
  p_user_batch_id uuid,
  p_user_units jsonb,
  p_user_focus_units jsonb,
  p_user_thread_units jsonb,
  p_user_lifecycle_units jsonb,
  p_user_live_focus_units jsonb,
  p_assistant_source_turn_id uuid,
  p_assistant_batch_id uuid,
  p_assistant_units jsonb,
  p_assistant_focus_units jsonb,
  p_assistant_thread_units jsonb,
  p_assistant_lifecycle_units jsonb,
  p_assistant_live_focus_units jsonb,
  p_evaluator_version text,
  p_policy_version text,
  p_segmentation_provider text,
  p_segmentation_model text,
  p_segmentation_prompt_version text,
  p_focus_evaluator_version text,
  p_focus_policy_version text,
  p_focus_provider text,
  p_focus_model text,
  p_focus_prompt_version text,
  p_focus_schema_version integer,
  p_thread_evaluator_version text,
  p_thread_policy_version text,
  p_thread_provider text,
  p_thread_model text,
  p_thread_prompt_version text,
  p_thread_schema_version integer,
  p_continuity_evaluator_version text,
  p_continuity_policy_version text,
  p_continuity_provider text,
  p_continuity_model text,
  p_continuity_prompt_version text,
  p_continuity_schema_version integer,
  p_lifecycle_reducer_version text,
  p_lf_reducer_version text,
  p_expected_current_sp integer,
  p_expected_same_sp_event_sequence bigint,
  p_expected_world_thread_identity_version bigint
) RETURNS TABLE(
  live_head integer,
  same_sp_event_sequence bigint,
  world_thread_identity_version bigint,
  live_focus_kind text,
  live_focus_ref uuid,
  live_focus_sp integer,
  user_units jsonb,
  assistant_units jsonb,
  user_event jsonb,
  assistant_event jsonb,
  live_focus_transitions jsonb
) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  clock_row public.session_semantic_clocks;
  identity_row public.conversation_world_thread_identity_clocks;
  user_turn_row public.conversation_turns;
  assistant_turn_row public.conversation_turns;
  user_state text;
  assistant_state text;
  both_exist boolean;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL
     OR p_user_source_turn_id IS NULL OR p_assistant_source_turn_id IS NULL
     OR p_user_batch_id IS NULL OR p_assistant_batch_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023';
  END IF;
  IF p_user_source_turn_id = p_assistant_source_turn_id OR p_user_batch_id = p_assistant_batch_id THEN
    RAISE EXCEPTION 'INVALID_COMMIT_IDENTITY' USING ERRCODE='22023',
      DETAIL='A finalized exchange carries two distinct source turns and two distinct commitment batches.';
  END IF;
  IF p_expected_same_sp_event_sequence IS NULL OR p_expected_same_sp_event_sequence < 0
     OR (p_expected_current_sp IS NOT NULL AND p_expected_current_sp < 1) THEN
    RAISE EXCEPTION 'INVALID_FOCUS_CONTEXT_TOKEN' USING ERRCODE='22023',
      DETAIL='The expected semantic-clock token is (current_sp >= 1 or NULL before the first SP, same_sp_event_sequence >= 0).';
  END IF;
  IF p_expected_world_thread_identity_version IS NULL OR p_expected_world_thread_identity_version < 0 THEN
    RAISE EXCEPTION 'INVALID_THREAD_IDENTITY_CONTEXT_TOKEN' USING ERRCODE='22023',
      DETAIL='The expected user/world Thread identity version is a non-negative technical version.';
  END IF;

  -- AF66-01: exactly ONE Session clock, acquired FIRST and held for the whole
  -- exchange transaction, before every source row, semantic row, identity
  -- version, world row and LF row.
  SELECT * INTO clock_row FROM public.session_semantic_clocks c
    WHERE c.session_id = p_session_id AND c.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  SELECT * INTO user_turn_row FROM public.conversation_turns t
    WHERE t.id = p_user_source_turn_id AND t.session_id = p_session_id AND t.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  SELECT * INTO assistant_turn_row FROM public.conversation_turns t
    WHERE t.id = p_assistant_source_turn_id AND t.session_id = p_session_id AND t.user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;

  IF user_turn_row.role <> 'USER'
     OR user_turn_row.status <> 'COMPLETED'
     OR user_turn_row.source_turn_id IS NOT NULL
     OR assistant_turn_row.role <> 'ASSISTANT'
     OR assistant_turn_row.status <> 'COMPLETED'
     OR assistant_turn_row.source_turn_id IS DISTINCT FROM user_turn_row.id THEN
    RAISE EXCEPTION 'INVALID_FINALIZED_EXCHANGE_RELATION' USING ERRCODE='22023',
      DETAIL='A finalized exchange is one COMPLETED USER source turn and the COMPLETED ASSISTANT turn finalized as its response, in that order.';
  END IF;

  -- BOTH halves through the ONE full-chain completeness authority, BEFORE the
  -- token logic and BEFORE either writer: ABSENT + ABSENT or COMPLETE + COMPLETE.
  user_state := public.conversation_full_semantic_batch_state_v1(p_session_id, p_user_id, p_user_source_turn_id, p_user_batch_id);
  assistant_state := public.conversation_full_semantic_batch_state_v1(p_session_id, p_user_id, p_assistant_source_turn_id, p_assistant_batch_id);
  IF NOT ((user_state = 'ABSENT' AND assistant_state = 'ABSENT')
          OR (user_state = 'COMPLETE' AND assistant_state = 'COMPLETE')) THEN
    RAISE EXCEPTION 'FULL_SEMANTIC_BATCH_INTEGRITY' USING ERRCODE='55000',
      DETAIL='A finalized exchange is committed as a whole or not at all: one half canonical while the other is absent or structurally partial is never completed, replayed or repaired.';
  END IF;

  -- Stale-context protection, first authority: the Session Semantic Clock.
  both_exist := user_state = 'COMPLETE';
  IF NOT both_exist
     AND (clock_row.current_sp IS DISTINCT FROM p_expected_current_sp
          OR clock_row.same_sp_event_sequence IS DISTINCT FROM p_expected_same_sp_event_sequence) THEN
    RAISE EXCEPTION 'STALE_CONVERSATIONAL_FOCUS_CONTEXT' USING ERRCODE='PT409',
      DETAIL='The Session Semantic Clock moved after the prior context was read; nothing was written. Re-read the context and evaluate again.';
  END IF;

  -- Stale-context protection, second authority: the user/world Thread
  -- Identity Clock, locked AFTER the Session clock and compared BEFORE any
  -- canonical mutation. LF adds no third authority: the current LF is read
  -- under the same Session clock token, and the token moves with every SP.
  IF NOT both_exist THEN
    INSERT INTO public.conversation_world_thread_identity_clocks (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO identity_row FROM public.conversation_world_thread_identity_clocks w
      WHERE w.user_id = p_user_id
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'WORLD_THREAD_IDENTITY_CLOCK_MISSING' USING ERRCODE='55000';
    END IF;
    IF identity_row.current_version IS DISTINCT FROM p_expected_world_thread_identity_version THEN
      RAISE EXCEPTION 'STALE_THREAD_IDENTITY_CONTEXT' USING ERRCODE='PT409',
        DETAIL='The user/world Thread identity dossiers changed after they were screened; nothing was written. Re-read the context and the dossiers and resolve again.';
    END IF;
  END IF;

  -- USER block first, ASSISTANT block second: canonical conversational order.
  SELECT COALESCE(jsonb_agg(to_jsonb(u) ORDER BY u.ordinal_within_turn), '[]'::jsonb)
    INTO user_units
    FROM public.commit_conversation_units_with_full_semantic_chain_v1(
      p_session_id, p_user_id, p_user_source_turn_id, p_user_batch_id, p_user_units,
      p_evaluator_version, p_policy_version, p_segmentation_provider,
      p_segmentation_model, p_segmentation_prompt_version,
      p_user_focus_units, p_focus_evaluator_version, p_focus_policy_version,
      p_focus_provider, p_focus_model, p_focus_prompt_version, p_focus_schema_version,
      p_user_thread_units, p_thread_evaluator_version, p_thread_policy_version,
      p_thread_provider, p_thread_model, p_thread_prompt_version, p_thread_schema_version,
      p_user_lifecycle_units, p_continuity_evaluator_version, p_continuity_policy_version,
      p_continuity_provider, p_continuity_model, p_continuity_prompt_version, p_continuity_schema_version,
      p_lifecycle_reducer_version, p_user_live_focus_units, p_lf_reducer_version) u;

  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.ordinal_within_turn), '[]'::jsonb)
    INTO assistant_units
    FROM public.commit_conversation_units_with_full_semantic_chain_v1(
      p_session_id, p_user_id, p_assistant_source_turn_id, p_assistant_batch_id, p_assistant_units,
      p_evaluator_version, p_policy_version, p_segmentation_provider,
      p_segmentation_model, p_segmentation_prompt_version,
      p_assistant_focus_units, p_focus_evaluator_version, p_focus_policy_version,
      p_focus_provider, p_focus_model, p_focus_prompt_version, p_focus_schema_version,
      p_assistant_thread_units, p_thread_evaluator_version, p_thread_policy_version,
      p_thread_provider, p_thread_model, p_thread_prompt_version, p_thread_schema_version,
      p_assistant_lifecycle_units, p_continuity_evaluator_version, p_continuity_policy_version,
      p_continuity_provider, p_continuity_model, p_continuity_prompt_version, p_continuity_schema_version,
      p_lifecycle_reducer_version, p_assistant_live_focus_units, p_lf_reducer_version) a;

  SELECT c.current_sp, c.same_sp_event_sequence INTO live_head, same_sp_event_sequence
    FROM public.session_semantic_clocks c WHERE c.session_id = p_session_id;
  SELECT COALESCE((SELECT w.current_version FROM public.conversation_world_thread_identity_clocks w WHERE w.user_id = p_user_id), 0)
    INTO world_thread_identity_version;
  SELECT f.live_focus_kind, f.live_focus_ref, f.live_focus_sp INTO live_focus_kind, live_focus_ref, live_focus_sp
    FROM public.conversation_session_live_focus_before_v1(p_session_id, NULL) f;
  SELECT to_jsonb(e) INTO user_event FROM public.conversation_unit_commit_events e
    WHERE e.commit_batch_id = p_user_batch_id;
  SELECT to_jsonb(e) INTO assistant_event FROM public.conversation_unit_commit_events e
    WHERE e.commit_batch_id = p_assistant_batch_id;
  -- The LF transitions created or replayed for this exchange, in SP order:
  -- reference identity only, never the same-SP sequence, never a label.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('session_position', t.session_position, 'to_kind', t.to_kind, 'to_ref', t.to_ref)
                            ORDER BY t.session_position), '[]'::jsonb)
    INTO live_focus_transitions
    FROM public.conversation_live_focus_transitions t
   WHERE t.commit_batch_id IN (p_user_batch_id, p_assistant_batch_id);
  RETURN NEXT;
END;$$;

-- 0070 - the Thread identity dossier page (1 site).
CREATE OR REPLACE FUNCTION public.get_conversation_thread_identity_dossier_page_v1(
  p_user_id uuid,
  p_expected_world_thread_identity_version bigint,
  p_after_thread_id uuid,
  p_limit integer
) RETURNS TABLE(
  thread_id uuid,
  identity_evidence jsonb
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  current_version bigint;
BEGIN
  IF p_user_id IS NULL OR p_expected_world_thread_identity_version IS NULL OR p_expected_world_thread_identity_version < 0 THEN
    RAISE EXCEPTION 'INVALID_THREAD_IDENTITY_CONTEXT_TOKEN' USING ERRCODE='22023';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 64 THEN
    RAISE EXCEPTION 'INVALID_THREAD_DOSSIER_PAGE' USING ERRCODE='22023',
      DETAIL='A dossier page is a fixed technical chunk of 1 to 64 Threads.';
  END IF;
  SELECT COALESCE((SELECT w.current_version FROM public.conversation_world_thread_identity_clocks w WHERE w.user_id = p_user_id), 0)
    INTO current_version;
  IF current_version <> p_expected_world_thread_identity_version THEN
    RAISE EXCEPTION 'STALE_THREAD_IDENTITY_CONTEXT' USING ERRCODE='PT409',
      DETAIL='The user/world Thread identity dossiers changed after the runtime context was read; re-read the context and screen again.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.conversation_threads t
              WHERE t.user_id = p_user_id
                AND NOT EXISTS (SELECT 1 FROM public.conversation_thread_identity_evidence ie WHERE ie.thread_id = t.id)) THEN
    RAISE EXCEPTION 'INCOMPLETE_PRIOR_THREAD_HISTORY' USING ERRCODE='55000',
      DETAIL='THREAD_WITHOUT_IDENTITY_DOSSIER: a canonical Thread with no source-grounded identity evidence cannot be screened and is never silently ignored.';
  END IF;
  RETURN QUERY
    SELECT t.id,
           (SELECT jsonb_agg(jsonb_build_object(
                     'session_id', ie.session_id,
                     'cu_id', ie.cu_id,
                     'exact_surface', ie.exact_surface,
                     'committed_cu_text', cu.committed_text,
                     'source_role', cu.source_role)
                     ORDER BY ie.evidence_ordinal)
              FROM public.conversation_thread_identity_evidence ie
              JOIN public.conversation_units cu ON cu.id = ie.cu_id
             WHERE ie.thread_id = t.id)
      FROM public.conversation_threads t
     WHERE t.user_id = p_user_id
       AND (p_after_thread_id IS NULL OR t.id::text COLLATE "C" > p_after_thread_id::text COLLATE "C")
     ORDER BY t.id::text COLLATE "C"
     LIMIT p_limit;
END;$$;

-- 0078 - Shared Standing Context grant (2 sites).
CREATE OR REPLACE FUNCTION public.grant_shared_world_standing_context_v1(
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
    RAISE EXCEPTION 'STANDING_CONTEXT_STALE_STATE' USING ERRCODE='PT409';
  END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_standing_context_grants g WHERE g.id = p_new_grant_id) THEN
    RAISE EXCEPTION 'STANDING_CONTEXT_GRANT_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- One atomic authority mutation plus one immutable consent event.
  IF p_expected_active_grant_id IS NOT NULL THEN
    UPDATE public.shared_world_standing_context_grants g SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP
     WHERE g.id = p_expected_active_grant_id AND g.status = 'ACTIVE';
    IF NOT FOUND THEN RAISE EXCEPTION 'STANDING_CONTEXT_STALE_STATE' USING ERRCODE='PT409'; END IF;
  END IF;
  INSERT INTO public.shared_world_standing_context_grants (id, world_id, grantor_user_id, status)
  VALUES (p_new_grant_id, p_world_id, u, 'ACTIVE');
  INSERT INTO public.shared_world_standing_context_grant_audience (grant_id, audience_user_id)
  SELECT p_new_grant_id, a.audience_user_id FROM unnest(requested_ceiling) AS a(audience_user_id);
  INSERT INTO public.shared_world_standing_context_consent_events (id, world_id, grantor_user_id, event_type, subject_grant_id, prior_grant_id)
  VALUES (p_command_id, p_world_id, u, intended_event_type, p_new_grant_id, p_expected_active_grant_id);
  RETURN QUERY SELECT p_command_id, intended_event_type, p_new_grant_id, p_expected_active_grant_id, 'ACTIVE'::text;
END$$;

-- 0078 - Shared Standing Context revoke (2 sites).
CREATE OR REPLACE FUNCTION public.revoke_shared_world_standing_context_v1(
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
  IF target.status <> 'ACTIVE' THEN RAISE EXCEPTION 'STANDING_CONTEXT_STALE_STATE' USING ERRCODE='PT409'; END IF;

  -- One atomic authority mutation plus one immutable consent event. Audience
  -- rows stay untouched; nothing is deleted.
  UPDATE public.shared_world_standing_context_grants g SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP
   WHERE g.id = p_expected_active_grant_id AND g.status = 'ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'STANDING_CONTEXT_STALE_STATE' USING ERRCODE='PT409'; END IF;
  INSERT INTO public.shared_world_standing_context_consent_events (id, world_id, grantor_user_id, event_type, subject_grant_id, prior_grant_id)
  VALUES (p_command_id, p_world_id, u, 'REVOKED', p_expected_active_grant_id, NULL);
  RETURN QUERY SELECT p_command_id, 'REVOKED'::text, p_expected_active_grant_id, NULL::uuid, 'REVOKED'::text;
END$$;

-- 0081 - Shared ID credential rotation, reached by rotate_own_sealed_shared_id_v1 (4 sites).
CREATE OR REPLACE FUNCTION public.rotate_shared_world_invite_credential_v1(
  p_command_id uuid, p_new_credential_lookup_ref text, p_expected_epoch bigint DEFAULT NULL
) RETURNS TABLE(command_id uuid, credential_epoch bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  current_epoch bigint;
  current_ref text;
  has_state boolean;
  new_epoch bigint;
  committed public.shared_world_invitation_commands;
  conflict_constraint text;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'SHARED_INVITE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_command_id IS NULL OR p_new_credential_lookup_ref IS NULL
     OR length(btrim(p_new_credential_lookup_ref)) = 0 THEN
    RAISE EXCEPTION 'SHARED_INVITE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- An expected epoch is either "none yet" or a real past epoch. 0 and negative
  -- values are not expressible states, so they are refused rather than coerced.
  IF p_expected_epoch IS NOT NULL AND p_expected_epoch < 1 THEN
    RAISE EXCEPTION 'SHARED_INVITE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- The reference is opaque and is never the caller's own identity.
  IF p_new_credential_lookup_ref = u::text THEN
    RAISE EXCEPTION 'SHARED_INVITE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  new_epoch := COALESCE(p_expected_epoch, 0) + 1;

  -- Durable idempotency, first pass: BEFORE any lock, so a retry of a command
  -- that already committed stays answerable even though the caller's own
  -- credential state has since moved on.
  SELECT * INTO committed FROM public.shared_world_invitation_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.command_type = 'CREDENTIAL_ROTATION' AND committed.actor_user_id = u
       AND committed.credential_lookup_ref = p_new_credential_lookup_ref
       AND committed.resulting_credential_epoch = new_epoch THEN
      RETURN QUERY SELECT committed.id, committed.resulting_credential_epoch;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_INVITE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the caller's own credential-state row. Every
  -- rotation and every submission that resolves to this human queues here
  -- before any invitation row is read or written.
  SELECT s.epoch, s.credential_lookup_ref INTO current_epoch, current_ref
    FROM public.shared_world_invite_credential_state s
   WHERE s.user_id = u
   FOR UPDATE;
  has_state := FOUND;

  -- Durable idempotency, second pass: now under the lock, so two concurrent
  -- identical retries serialize and the loser returns the committed result
  -- instead of creating a second current state.
  SELECT * INTO committed FROM public.shared_world_invitation_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.command_type = 'CREDENTIAL_ROTATION' AND committed.actor_user_id = u
       AND committed.credential_lookup_ref = p_new_credential_lookup_ref
       AND committed.resulting_credential_epoch = new_epoch THEN
      RETURN QUERY SELECT committed.id, committed.resulting_credential_epoch;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_INVITE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- Compare-and-swap against the exact current state. A stale client never
  -- rotates "whatever happens to be current".
  IF p_expected_epoch IS NULL THEN
    IF has_state THEN RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_STALE_STATE' USING ERRCODE='PT409'; END IF;
  ELSE
    IF NOT has_state OR current_epoch <> p_expected_epoch THEN
      RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_STALE_STATE' USING ERRCODE='PT409';
    END IF;
  END IF;

  -- A ROTATION MUST ACTUALLY ROTATE (CW2-03 section 5: lock the current state,
  -- CHANGE the lookup reference, increment the epoch, invalidate the old-epoch
  -- PENDING invitations). Re-presenting the reference that is already current
  -- is not a rotation: PostgreSQL would accept the UPDATE, the epoch would
  -- advance and every PENDING invitation would be invalidated while the secret
  -- the human believes they retired stayed immediately usable. It is refused
  -- BEFORE any mutation, so a no-op value writes nothing at all - no epoch, no
  -- updated_at, no invalidation and no command-history row. The comparison is
  -- against the caller's OWN locked row only, so it discloses no other human's
  -- state and adds no channel that the bounded collision answer below does not
  -- already have.
  IF has_state AND current_ref = p_new_credential_lookup_ref THEN
    RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_UNCHANGED' USING ERRCODE='22023';
  END IF;

  -- The new reference must be free. The answer is bounded: it never says that
  -- another human holds it, so rotation is not an enumeration oracle either.
  BEGIN
    IF has_state THEN
      UPDATE public.shared_world_invite_credential_state s
         SET credential_lookup_ref = p_new_credential_lookup_ref,
             epoch = new_epoch,
             updated_at = CURRENT_TIMESTAMP
       WHERE s.user_id = u AND s.epoch = p_expected_epoch;
      IF NOT FOUND THEN RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_STALE_STATE' USING ERRCODE='PT409'; END IF;
    ELSE
      INSERT INTO public.shared_world_invite_credential_state (user_id, credential_lookup_ref, epoch)
      VALUES (u, p_new_credential_lookup_ref, new_epoch);
    END IF;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS conflict_constraint = CONSTRAINT_NAME;
    -- Durable idempotency, THIRD pass. FIRST setup is the one case the two
    -- passes above structurally cannot cover: there is no credential row yet,
    -- so the row lock above takes nothing, and two concurrent executions of the
    -- SAME semantic command both legitimately observe absence and proceed. The
    -- uniqueness conflict IS their serialization point: it resolves only when
    -- the winner commits, and the winner commits its credential state and its
    -- command-history row in one transaction. So the equivalent retry is
    -- answered from durable history here exactly as it would have been under
    -- the lock - an equivalent retry of a committed command returns that
    -- command's committed result, never a stale-state error.
    SELECT * INTO committed FROM public.shared_world_invitation_commands c WHERE c.id = p_command_id;
    IF FOUND THEN
      IF committed.command_type = 'CREDENTIAL_ROTATION' AND committed.actor_user_id = u
         AND committed.credential_lookup_ref = p_new_credential_lookup_ref
         AND committed.resulting_credential_epoch = new_epoch THEN
        RETURN QUERY SELECT committed.id, committed.resulting_credential_epoch;
        RETURN;
      END IF;
      -- The same command id carrying different semantics is still a conflict.
      RAISE EXCEPTION 'SHARED_INVITE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    IF conflict_constraint = 'shared_world_invite_credential_ref_key' THEN
      RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_REF_UNAVAILABLE' USING ERRCODE='23505';
    END IF;
    -- The primary key, reached by a DIFFERENT command: another connection
    -- established this human's first credential state while this one believed
    -- there was none, so this command's view of the state is simply stale.
    RAISE EXCEPTION 'SHARED_INVITE_CREDENTIAL_STALE_STATE' USING ERRCODE='PT409';
  END;

  -- CANONICAL LOCK ORDER, STEP 2: the invitation rows. CW2-03 section 5 - every
  -- PENDING invitation bound to an older epoch is invalidated in this same
  -- transaction. Nothing is deleted, and a row that already reached a terminal
  -- status is not touched.
  UPDATE public.shared_world_direct_invitations i
     SET status = 'INVALIDATED', terminal_at = CURRENT_TIMESTAMP
   WHERE i.target_user_id = u AND i.status = 'PENDING' AND i.target_credential_epoch < new_epoch;

  INSERT INTO public.shared_world_invitation_commands
    (id, actor_user_id, command_type, credential_lookup_ref, resulting_credential_epoch)
  VALUES (p_command_id, u, 'CREDENTIAL_ROTATION', p_new_credential_lookup_ref, new_epoch);
  RETURN QUERY SELECT p_command_id, new_epoch;
END$$;

-- 0109 - retained Matching pause (2 sites).
CREATE OR REPLACE FUNCTION public.pause_matching_participation_v1(
  p_command_id uuid, p_expected_current_event_id uuid
) RETURNS TABLE(participation_event_id uuid, participation_act text, participation_state text,
                pause_reason text, superseded_event_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  locked uuid;
  committed public.matching_participation_events;
  current_id uuid;
  current_act public.matching_participation_events;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_command_id IS NULL OR p_expected_current_event_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (u)
  ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at
  RETURNING l.user_id INTO locked;

  SELECT * INTO committed FROM public.matching_participation_events e WHERE e.id = p_command_id;
  IF FOUND THEN
    IF committed.participant_user_id = u AND committed.participation_act = 'PAUSE'
       AND committed.prior_event_id IS NOT DISTINCT FROM p_expected_current_event_id THEN
      RETURN QUERY SELECT committed.id, committed.participation_act, committed.resulting_state,
                          committed.resulting_pause_reason, committed.prior_event_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT s.current_event_id INTO current_id
    FROM public.matching_participation_state s WHERE s.participant_user_id = u FOR UPDATE;
  IF current_id IS DISTINCT FROM p_expected_current_event_id THEN
    RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='PT409';
  END IF;
  SELECT * INTO current_act FROM public.matching_participation_events e WHERE e.id = current_id;
  IF current_act.resulting_state <> 'ACTIVE' THEN
    RAISE EXCEPTION 'MATCHING_PARTICIPATION_NOT_ACTIVE' USING ERRCODE='55000';
  END IF;

  INSERT INTO public.matching_participation_events
    (id, participant_user_id, participation_act, resulting_state, resulting_pause_reason,
     activation_entry_channel, prior_event_id)
  VALUES (p_command_id, u, 'PAUSE', 'PAUSED', 'USER_PAUSED', NULL, p_expected_current_event_id);

  UPDATE public.matching_participation_state s
     SET current_event_id = p_command_id, updated_at = CURRENT_TIMESTAMP
   WHERE s.participant_user_id = u AND s.current_event_id = p_expected_current_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='PT409'; END IF;

  RETURN QUERY SELECT p_command_id, 'PAUSE'::text, 'PAUSED'::text, 'USER_PAUSED'::text, p_expected_current_event_id;
END$$;

-- 0109 - retained Matching turn off (2 sites).
CREATE OR REPLACE FUNCTION public.turn_off_matching_participation_v1(
  p_command_id uuid, p_expected_current_event_id uuid
) RETURNS TABLE(participation_event_id uuid, participation_act text, participation_state text,
                pause_reason text, superseded_event_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  locked uuid;
  committed public.matching_participation_events;
  current_id uuid;
  current_act public.matching_participation_events;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_command_id IS NULL OR p_expected_current_event_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (u)
  ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at
  RETURNING l.user_id INTO locked;

  SELECT * INTO committed FROM public.matching_participation_events e WHERE e.id = p_command_id;
  IF FOUND THEN
    IF committed.participant_user_id = u AND committed.participation_act = 'TURN_OFF'
       AND committed.prior_event_id IS NOT DISTINCT FROM p_expected_current_event_id THEN
      RETURN QUERY SELECT committed.id, committed.participation_act, committed.resulting_state,
                          committed.resulting_pause_reason, committed.prior_event_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT s.current_event_id INTO current_id
    FROM public.matching_participation_state s WHERE s.participant_user_id = u FOR UPDATE;
  IF current_id IS DISTINCT FROM p_expected_current_event_id THEN
    RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='PT409';
  END IF;
  SELECT * INTO current_act FROM public.matching_participation_events e WHERE e.id = current_id;
  IF current_act.resulting_state = 'OFF' THEN
    RAISE EXCEPTION 'MATCHING_PARTICIPATION_ALREADY_OFF' USING ERRCODE='55000';
  END IF;

  INSERT INTO public.matching_participation_events
    (id, participant_user_id, participation_act, resulting_state, resulting_pause_reason,
     activation_entry_channel, prior_event_id)
  VALUES (p_command_id, u, 'TURN_OFF', 'OFF', NULL, NULL, p_expected_current_event_id);

  UPDATE public.matching_participation_state s
     SET current_event_id = p_command_id, updated_at = CURRENT_TIMESTAMP
   WHERE s.participant_user_id = u AND s.current_event_id = p_expected_current_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='PT409'; END IF;

  RETURN QUERY SELECT p_command_id, 'TURN_OFF'::text, 'OFF'::text, NULL::text, p_expected_current_event_id;
END$$;

-- 0109 - retained Matching Context Grant revoke (2 sites).
CREATE OR REPLACE FUNCTION public.revoke_matching_context_v1(
  p_command_id uuid, p_expected_active_grant_id uuid
) RETURNS TABLE(consent_event_id uuid, consent_event_type text, matching_context_grant_id uuid,
                superseded_grant_id uuid, grant_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  locked uuid;
  committed public.matching_context_consent_events;
  target public.matching_context_grants;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_command_id IS NULL OR p_expected_active_grant_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (u)
  ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at
  RETURNING l.user_id INTO locked;

  SELECT * INTO committed FROM public.matching_context_consent_events e WHERE e.id = p_command_id;
  IF FOUND THEN
    IF committed.grantor_user_id = u AND committed.event_type = 'REVOKED'
       AND committed.subject_grant_id = p_expected_active_grant_id
       AND committed.prior_grant_id IS NULL THEN
      RETURN QUERY SELECT committed.id, committed.event_type, committed.subject_grant_id,
                          committed.prior_grant_id, 'REVOKED'::text;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- Nonexistent and another human's grant collapse into ONE bounded answer, so
  -- an error never discloses another human's Matching consent state.
  SELECT * INTO target FROM public.matching_context_grants g
   WHERE g.id = p_expected_active_grant_id AND g.grantor_user_id = u FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_GRANT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF target.status <> 'ACTIVE' THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='PT409'; END IF;

  UPDATE public.matching_context_grants g SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP
   WHERE g.id = p_expected_active_grant_id AND g.status = 'ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='PT409'; END IF;
  INSERT INTO public.matching_context_consent_events
    (id, grantor_user_id, event_type, subject_grant_id, prior_grant_id)
  VALUES (p_command_id, u, 'REVOKED', p_expected_active_grant_id, NULL);

  RETURN QUERY SELECT p_command_id, 'REVOKED'::text, p_expected_active_grant_id, NULL::uuid, 'REVOKED'::text;
END$$;

-- 0109 - retained Pre-Match Disclosure Authority revoke (2 sites).
CREATE OR REPLACE FUNCTION public.revoke_pre_match_disclosure_authority_v1(
  p_command_id uuid, p_expected_active_authority_id uuid
) RETURNS TABLE(authority_event_id uuid, authority_event_type text, pre_match_disclosure_authority_id uuid,
                superseded_authority_id uuid, bound_profile_version_id uuid, approved_field_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  locked uuid;
  committed public.pre_match_disclosure_authority_events;
  target public.pre_match_disclosure_authorities;
  field_total integer;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_command_id IS NULL OR p_expected_active_authority_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (u)
  ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at
  RETURNING l.user_id INTO locked;

  SELECT * INTO committed FROM public.pre_match_disclosure_authority_events e WHERE e.id = p_command_id;
  IF FOUND THEN
    IF committed.grantor_user_id = u AND committed.event_type = 'REVOKED'
       AND committed.subject_authority_id = p_expected_active_authority_id
       AND committed.prior_authority_id IS NULL THEN
      SELECT * INTO target FROM public.pre_match_disclosure_authorities a
       WHERE a.id = committed.subject_authority_id;
      SELECT count(*) INTO field_total FROM public.pre_match_disclosure_authority_fields f
       WHERE f.authority_id = committed.subject_authority_id;
      RETURN QUERY SELECT committed.id, committed.event_type, committed.subject_authority_id,
                          committed.prior_authority_id, target.introduction_profile_version_id, field_total;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT * INTO target FROM public.pre_match_disclosure_authorities a
   WHERE a.id = p_expected_active_authority_id AND a.grantor_user_id = u FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_DISCLOSURE_AUTHORITY_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF target.status <> 'ACTIVE' THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='PT409'; END IF;

  UPDATE public.pre_match_disclosure_authorities a
     SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP
   WHERE a.id = p_expected_active_authority_id AND a.status = 'ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='PT409'; END IF;
  INSERT INTO public.pre_match_disclosure_authority_events
    (id, grantor_user_id, event_type, subject_authority_id, prior_authority_id)
  VALUES (p_command_id, u, 'REVOKED', p_expected_active_authority_id, NULL);
  SELECT count(*) INTO field_total FROM public.pre_match_disclosure_authority_fields f
   WHERE f.authority_id = p_expected_active_authority_id;

  RETURN QUERY SELECT p_command_id, 'REVOKED'::text, p_expected_active_authority_id, NULL::uuid,
                      target.introduction_profile_version_id, field_total;
END$$;

-- 4. Terminal self-check, from the catalog.
DO $$
DECLARE
  t record;
  before_row record;
  after_src text;
  after_posture jsonb;
  after_oid oid;
  expected text;
  drift integer;
BEGIN
  FOR t IN SELECT * FROM pg_temp.prod_retry_01_targets ORDER BY signature LOOP
    SELECT * INTO before_row FROM pg_temp.prod_retry_01_before b WHERE b.signature = t.signature;
    after_oid := to_regprocedure(t.signature);
    IF after_oid IS DISTINCT FROM before_row.oid THEN
      RAISE EXCEPTION 'PROD_RETRY_01_0150_SELF_CHECK: % is not the same function object', t.signature;
    END IF;
    SELECT p.prosrc,
           jsonb_build_array(
             pg_get_userbyid(p.proowner), p.proacl::text, p.prosecdef, p.proconfig::text, p.provolatile::text,
             p.proparallel::text, p.proisstrict, p.proleakproof, p.procost, p.prorows, p.prokind::text, p.prolang::text,
             p.prosupport::text, pg_get_function_arguments(p.oid), pg_get_function_result(p.oid),
             obj_description(p.oid, 'pg_proc'))
      INTO after_src, after_posture
      FROM pg_proc p WHERE p.oid = after_oid;
    IF after_posture IS DISTINCT FROM before_row.posture THEN
      RAISE EXCEPTION 'PROD_RETRY_01_0150_SELF_CHECK: the posture of % changed', t.signature;
    END IF;
    IF t.kind = 'RAISER' THEN
      expected := replace(before_row.prosrc, $q$ERRCODE='40001'$q$, $q$ERRCODE='PT409'$q$);
    ELSE
      expected := replace(before_row.prosrc, $q$WHEN SQLSTATE '40001' OR SQLSTATE '22023' THEN$q$,
                          $q$WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' OR SQLSTATE '22023' THEN$q$);
    END IF;
    IF after_src IS DISTINCT FROM expected OR after_src = before_row.prosrc THEN
      RAISE EXCEPTION 'PROD_RETRY_01_0150_SELF_CHECK: the body of % is not exactly the approved substitution', t.signature;
    END IF;
  END LOOP;

  SELECT count(*) INTO drift
    FROM pg_temp.prod_retry_01_before b
    FULL JOIN (SELECT p.oid, p.prosrc,
                      jsonb_build_array(
                        pg_get_userbyid(p.proowner), p.proacl::text, p.prosecdef, p.proconfig::text, p.provolatile::text,
                        p.proparallel::text, p.proisstrict, p.proleakproof, p.procost, p.prorows, p.prokind::text,
                        p.prolang::text, p.prosupport::text, pg_get_function_arguments(p.oid), pg_get_function_result(p.oid),
                        obj_description(p.oid, 'pg_proc')) AS posture
                 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' OR n.nspname LIKE '%\_private') a ON a.oid = b.oid
   WHERE b.signature IS NULL OR a.oid IS NULL
      OR (b.signature NOT IN (SELECT signature FROM pg_temp.prod_retry_01_targets)
          AND (a.prosrc IS DISTINCT FROM b.prosrc OR a.posture IS DISTINCT FROM b.posture));
  IF drift <> 0 THEN
    RAISE EXCEPTION 'PROD_RETRY_01_0150_SELF_CHECK: % application function(s) outside the approved twelve changed, appeared or disappeared', drift;
  END IF;
END
$$;

COMMIT;
