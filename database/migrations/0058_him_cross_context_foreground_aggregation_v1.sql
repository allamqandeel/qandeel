BEGIN;
-- HIM Cross-Context Foreground Aggregation v1 (QHIA-009).
--
-- QHIA-007 (migration 0056) and QHIA-008 (migration 0057) independently proved
-- the same narrow foreground shape twice - once for SITUATION + hse.stress@1,
-- once for DECISION + hse.attention@1. This migration performs the planned
-- "prove twice, abstract once" step and abstracts EXACTLY ONE THING:
-- TRANSPORT.
--
-- It installs one read-only RPC that returns the two ALREADY-PROVEN foreground
-- authority results in ONE Data API request instead of two, by WRAPPING them:
--
--   * public.read_him_session_situation_stress_v1(uuid,uuid) (migration 0056)
--   * public.read_him_session_decision_attention_v1(uuid,uuid) (migration 0057)
--
-- NO new metric, NO new context kind, NO new semantic behaviour, and NO new
-- authority of any kind is activated here. Relevance resolution, exact target
-- authority, metric identity, canonical-current selection, and ACTIVE
-- measurement-binding compatibility are already owned - exactly once each - by
-- the QHIA-006 (0055) and QHIA-004 (0054) authorities that 0056 and 0057
-- compose. This aggregate therefore calls NEITHER of those lower authorities
-- and reads NO protected HIM table: becoming a third implementation of what
-- 0056 and 0057 already prove is precisely the failure this task must avoid.
-- The install-time postcondition below proves that absence on the INSTALLED
-- definition, not merely in review.
--
-- The result is a fixed two-row TRANSPORT ENVELOPE. Each row carries an outer
-- transport discriminator (foreground_slot_order, foreground_slot) followed by
-- the nested authority row VERBATIM. The two channels are never flattened,
-- combined, scored, ranked, or reduced to a composite: foreground_slot_order
-- is transport order only and is not a priority, a weight, or a preference.
-- The current envelope is exactly:
--
--   1  SITUATION_STRESS    <- migration 0056, unchanged
--   2  DECISION_ATTENTION  <- migration 0057, unchanged
--
-- There is no third slot, and there is no way for a caller to ask for one:
-- the callable surface accepts NO context kind, NO context id, NO target, NO
-- metric key, NO metric list, NO slot list, and no selector of any kind. The
-- ONLY inputs are the authenticated user and the exact owned conversation
-- session - the same two inputs the wrapped authorities already accept.
--
-- LANGUAGE sql is deliberate. The whole function is ONE statement, so both
-- wrapped authorities execute inside the same PostgreSQL statement and
-- therefore the same snapshot: there is no application-level and no
-- database-level sequencing between the Situation channel and the Decision
-- channel, and neither can observe state the other cannot. It also makes the
-- read-only, no-control-flow, no-dynamic-SQL posture structural rather than
-- merely asserted.
--
-- SECURITY INVOKER is deliberate and is the hardened choice here, exactly as
-- in migrations 0056 and 0057. This function reads NO table: it holds no
-- privilege of its own, needs none, and every privileged read happens inside
-- the wrapped authorities under their own rules - which in turn delegate to
-- the SECURITY DEFINER 0054/0055 authorities. The authenticated caller
-- therefore reaches exactly the data the two direct requests would already
-- have returned - never more, never less, and never a different answer.
--
-- Failure is atomic and fail-closed by construction. If either wrapped
-- authority raises - unauthenticated caller, non-owner p_user_id, unknown or
-- cross-user session, non-ACTIVE session, ambiguous ACTIVE binding, unowned
-- target, invalid persisted definition, definition-unapproved context - the
-- whole statement raises that authority's own error. Nothing here catches,
-- substitutes, downgrades, or reinterprets a nested failure into a fake
-- unbound row. An authoritative NO_ACTIVE_SITUATION / NO_ACTIVE_DECISION
-- answer remains a normal successful result, exactly as it is today.
--
-- QHIA-009 is READ-ONLY. No table, column, constraint, trigger, policy, grant,
-- index, catalog row, measurement, calculation, or binding is created,
-- altered, or written anywhere in this migration. Migrations 0056 and 0057 are
-- neither replaced, altered, nor weakened: both remain installed, independently
-- callable, and canonical after this task.

-- 1. Current-phase preconditions: the two foreground authorities this
--    aggregate wraps must already exist with their exact intended signatures.
--    One-time migration-phase facts only - nothing here freezes a future
--    migration, metric, context kind, slot, or function.
DO $$BEGIN
 IF to_regprocedure('public.read_him_session_situation_stress_v1(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'The QHIA-007 Situation-stress foreground authority (migration 0056) is missing';END IF;
 IF to_regprocedure('public.read_him_session_decision_attention_v1(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'The QHIA-008 Decision-attention foreground authority (migration 0057) is missing';END IF;
END$$;

-- 2. The one aggregate transport function. It always returns EXACTLY TWO rows
--    in deterministic transport order, one per frozen slot, because each
--    wrapped authority always returns exactly one row.
--
--    Every column after the two outer transport fields is the wrapped
--    authority's own column, selected by name from that authority's own
--    result. Nothing is recomputed, defaulted, coalesced, normalised, or
--    reinterpreted on the way through, so an aggregate payload is equal to the
--    corresponding direct authority payload fact for fact - which is exactly
--    what the 0058 verifier proves against live direct calls.
CREATE FUNCTION public.read_him_session_cross_context_foreground_v1(p_user_id uuid,p_session_id uuid)
RETURNS TABLE(
 foreground_slot_order integer,
 foreground_slot text,
 binding_state text,
 binding_context_id uuid,
 slot_order integer,
 metric_key text,
 definition_version integer,
 hif_owner text,
 semantic_mapping_status text,
 semantic_type text,
 calculation_status text,
 valid_context_kinds text[],
 context_kind text,
 context_id text,
 has_canonical_current_value boolean,
 source_metric_key text,
 source_definition_version integer,
 source_semantic_mapping_status text,
 source_semantic_type text,
 source_context_kind text,
 source_context_id text,
 value_state text,
 numeric_value double precision,
 validity_status text,
 confidence_state text,
 confidence_reference text,
 observed_at timestamptz,
 temporal_window_start timestamptz,
 temporal_window_end timestamptz,
 canonical_binding_id uuid,
 active_binding_id uuid
) LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT envelope.* FROM (
  SELECT 1::integer AS foreground_slot_order,'SITUATION_STRESS'::text AS foreground_slot,
   s.binding_state,s.binding_context_id,
   s.slot_order,s.metric_key,s.definition_version,s.hif_owner,s.semantic_mapping_status,s.semantic_type,s.calculation_status,s.valid_context_kinds,
   s.context_kind,s.context_id,s.has_canonical_current_value,
   s.source_metric_key,s.source_definition_version,s.source_semantic_mapping_status,s.source_semantic_type,s.source_context_kind,s.source_context_id,
   s.value_state,s.numeric_value,s.validity_status,s.confidence_state,s.confidence_reference,
   s.observed_at,s.temporal_window_start,s.temporal_window_end,s.canonical_binding_id,s.active_binding_id
  FROM public.read_him_session_situation_stress_v1(p_user_id,p_session_id) s
  UNION ALL
  SELECT 2::integer,'DECISION_ATTENTION'::text,
   d.binding_state,d.binding_context_id,
   d.slot_order,d.metric_key,d.definition_version,d.hif_owner,d.semantic_mapping_status,d.semantic_type,d.calculation_status,d.valid_context_kinds,
   d.context_kind,d.context_id,d.has_canonical_current_value,
   d.source_metric_key,d.source_definition_version,d.source_semantic_mapping_status,d.source_semantic_type,d.source_context_kind,d.source_context_id,
   d.value_state,d.numeric_value,d.validity_status,d.confidence_state,d.confidence_reference,
   d.observed_at,d.temporal_window_start,d.temporal_window_end,d.canonical_binding_id,d.active_binding_id
  FROM public.read_him_session_decision_attention_v1(p_user_id,p_session_id) d
 ) envelope ORDER BY envelope.foreground_slot_order
$$;

-- 3. Narrow authority: authenticated EXECUTE only. No PUBLIC, no anon, and no
--    service_role grant - this aggregate widens no visibility whatsoever over
--    the two authenticated-only authorities it wraps.
REVOKE ALL ON FUNCTION public.read_him_session_cross_context_foreground_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.read_him_session_cross_context_foreground_v1(uuid,uuid) TO authenticated;

-- 4. Migration-phase postconditions on exactly the one function this migration
--    owns: safe properties, postgres ownership, the exact narrow ACL, required
--    wrapping of BOTH existing foreground authorities, exactly the two frozen
--    slot labels, and the proven absence - from the INSTALLED definition - of
--    every lower authority, every protected substrate, every metric, every
--    context kind, every caller-selected selector, dynamic SQL, JWT
--    reconstruction, and mutation. Forbidden identifiers are named here only
--    as data to prove they are absent.
DO $$DECLARE fn text:='public.read_him_session_cross_context_foreground_v1(uuid,uuid)';def text;p record;acl record;forbidden text;BEGIN
 IF to_regprocedure(fn) IS NULL THEN RAISE EXCEPTION 'The cross-context foreground aggregate is missing';END IF;
 -- Exactly one narrow surface: no overload may accept a context kind, a
 -- caller-supplied context id, a target, a metric key, a metric list, or a
 -- slot list.
 IF (SELECT count(*) FROM pg_proc p2 JOIN pg_namespace n ON n.oid=p2.pronamespace WHERE n.nspname='public' AND p2.proname='read_him_session_cross_context_foreground_v1')<>1 THEN RAISE EXCEPTION 'Exactly one cross-context foreground aggregate may exist';END IF;
 SELECT prosecdef,provolatile,proconfig,pronargs,proowner::regrole::text AS owner INTO p FROM pg_proc WHERE oid=fn::regprocedure;
 IF p.prosecdef THEN RAISE EXCEPTION 'The cross-context aggregate must hold no privilege of its own: every privileged read belongs to the wrapped authorities';END IF;
 IF p.provolatile<>'s' THEN RAISE EXCEPTION 'The cross-context aggregate must be STABLE';END IF;
 IF p.pronargs<>2 THEN RAISE EXCEPTION 'The cross-context aggregate must accept exactly the authenticated user and the exact owned session';END IF;
 IF p.owner<>'postgres' THEN RAISE EXCEPTION 'The cross-context aggregate must be owned by postgres';END IF;
 IF NOT EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%') THEN RAISE EXCEPTION 'The cross-context aggregate must pin a fixed safe search_path';END IF;
 SELECT has_function_privilege('public',fn,'EXECUTE') pub,has_function_privilege('anon',fn,'EXECUTE') anon_role,has_function_privilege('service_role',fn,'EXECUTE') service,has_function_privilege('authenticated',fn,'EXECUTE') authed INTO acl;
 IF acl.pub OR acl.anon_role OR acl.service OR NOT acl.authed THEN RAISE EXCEPTION 'Cross-context aggregate EXECUTE authority must be authenticated-only';END IF;
 def:=pg_get_functiondef(fn::regprocedure);
 IF position('public.read_him_session_situation_stress_v1(' in def)=0 THEN RAISE EXCEPTION 'The cross-context aggregate must wrap the QHIA-007 Situation-stress foreground authority';END IF;
 IF position('public.read_him_session_decision_attention_v1(' in def)=0 THEN RAISE EXCEPTION 'The cross-context aggregate must wrap the QHIA-008 Decision-attention foreground authority';END IF;
 IF position('''SITUATION_STRESS''' in def)=0 OR position('''DECISION_ATTENTION''' in def)=0 THEN RAISE EXCEPTION 'The cross-context aggregate must label exactly the two frozen transport slots';END IF;
 -- Exactly two channels: one composition of exactly two branches, never a
 -- third slot and never a read-all fan-out.
 IF (length(def)-length(replace(def,'UNION ALL','')))/length('UNION ALL')<>1 THEN RAISE EXCEPTION 'The cross-context aggregate envelope must contain exactly the two frozen slots';END IF;
 -- Not one lower authority is called around the wrapped ones, and not one
 -- additional substrate is reachable, from the installed definition. QHIA-009
 -- wraps proven authorities; it never becomes a third implementation of
 -- relevance, of current intelligence, or of anything beneath them.
 FOREACH forbidden IN ARRAY ARRAY['public.read_him_session_context_bindings_v1','public.read_him_contextual_current_intelligence_batch_v1','public.read_him_latest_measurement_v1','public.him_active_structured_binding_id','public.him_session_context_bindings','public.him_measurement_targets','public.conversation_sessions','public.him_metric_definitions','public.him_metric_snapshots','public.him_measurement_events','public.him_measurement_observations','public.him_current_structured_measurements','public.him_canonical_model_bindings','public.him_calculation_results','auth.uid','EXECUTE format','EXECUTE '''] LOOP
  IF position(forbidden in def)>0 THEN RAISE EXCEPTION 'The cross-context aggregate must wrap the two proven foreground authorities, never reimplement or widen: found %',forbidden;END IF;
 END LOOP;
 -- No metric and no context kind is named, activated, or selectable here: the
 -- aggregate abstracts transport, never meaning.
 FOREACH forbidden IN ARRAY ARRAY['''SITUATION''','''DECISION''','''GOAL''','''RELATIONSHIP''','''CONVERSATION_SESSION''','''GLOBAL''','hse.','hbs.','hrs.','hgs.'] LOOP
  IF position(forbidden in def)>0 THEN RAISE EXCEPTION 'QHIA-009 activates no metric and no context kind: found %',forbidden;END IF;
 END LOOP;
 -- No caller-selected selector of any kind exists on the callable surface.
 FOREACH forbidden IN ARRAY ARRAY['p_context_kind','p_context_id','p_target','p_metric_key','p_metric_keys','p_definition_version','p_slot','p_foreground_slot'] LOOP
  IF position(forbidden in def)>0 THEN RAISE EXCEPTION 'The cross-context aggregate accepts no caller-selected context, target, metric, or slot: found %',forbidden;END IF;
 END LOOP;
 IF position('request.jwt' in def)>0 OR position('set_config' in def)>0 THEN RAISE EXCEPTION 'The cross-context aggregate must not reconstruct or write request identity state';END IF;
 -- Read-only proof on the installed body. CREATE is deliberately absent from
 -- this list: pg_get_functiondef always emits its own CREATE header, so
 -- matching it would make the rule vacuously true rather than meaningful.
 IF def ~* '(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|DROP\s+|ALTER\s+TABLE|GRANT\s+|REVOKE\s+)' THEN RAISE EXCEPTION 'The cross-context aggregate must be read-only';END IF;
 -- Both wrapped authorities are untouched by this migration and must still be
 -- installed exactly as migrations 0056 and 0057 left them: QHIA-009 adds a
 -- transport, it does not retire, replace, or weaken either direct authority.
 IF to_regprocedure('public.read_him_session_situation_stress_v1(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'The QHIA-007 Situation-stress authority (migration 0056) must remain installed';END IF;
 IF to_regprocedure('public.read_him_session_decision_attention_v1(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'The QHIA-008 Decision-attention authority (migration 0057) must remain installed';END IF;
END$$;
COMMIT;
