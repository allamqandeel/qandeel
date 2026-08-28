BEGIN;
-- HIM Goal Motivation Foreground Consumption v1 (QHIA-010).
--
-- The THIRD cross-context foreground consumption built on top of the QHIA-006
-- relevance authority, and deliberately just as narrow as the first two:
-- exactly one context kind (GOAL) and exactly one metric (hse.motivation@1).
-- Nothing else is activated here - no SITUATION, DECISION, or RELATIONSHIP
-- consumption, no second Goal metric, no "read every relevant context"
-- fan-out, and no generic foreground surface of any kind.
--
-- hse.motivation@1 is measurement-valid for BOTH the GOAL and the SITUATION
-- context. This task activates the GOAL context ONLY. Situation-bound
-- Motivation stays INTENTIONALLY DORMANT: it is not requested, not read, not
-- inferred from the Goal reading, and not reachable through this function -
-- the SITUATION context kind is named in the postcondition below only as data
-- to prove it is absent from the installed definition.
--
-- The canonical meaning of the delegated reading is unchanged and is NOT
-- reinterpreted here: hse.motivation@1 is the HSE-owned, RESOLVED / STATE,
-- exact-target-bound current self-reported motivational drive toward one exact
-- Goal. It is not readiness, ability, availability, importance, obligation,
-- execution, productivity, excitement, mood, priority, commitment, capacity,
-- evidence count, or Goal quality. This migration attaches NO behaviour to the
-- value at all: it transports the authoritative reading and nothing else.
--
-- This migration changes TRANSPORT/COMPOSITION SHAPE ONLY, and has exactly two
-- narrow responsibilities:
--
--   1. install the direct Goal-Motivation foreground authority, which answers
--      one question - "for this exact owned conversation session, what is the
--      authoritative current hse.motivation@1 intelligence of the exact Goal
--      the authenticated user explicitly bound to it?" - in ONE Data API
--      request, by COMPOSING the two existing authorities and duplicating
--      neither:
--
--        * public.read_him_session_context_bindings_v1(uuid,uuid) (migration
--          0055) stays the ONLY relevance authority - authentication, exact
--          session ownership, session runtime state, ACTIVE-only selection,
--          the one-ACTIVE-per-kind cardinality, and the protected append-only
--          lifecycle all live there and only there. This function reads its
--          authoritative result and filters it down to the GOAL kind; it never
--          touches public.him_session_context_bindings, never reconstructs the
--          binding query, and never selects a "latest", "first", "only", "most
--          recently measured", "highest", or "lowest" Goal when no ACTIVE
--          binding exists.
--        * public.read_him_contextual_current_intelligence_batch_v1(uuid,text,
--          text,text[],integer[]) (migration 0054) stays the ONLY
--          current-intelligence authority for the resolved Goal - which in
--          turn delegates the canonical-latest value to
--          read_him_latest_measurement_v1 (0052) and the ACTIVE-binding
--          identity to him_active_structured_binding_id (0050). Target
--          ownership, persisted-definition validity, definition-approved
--          context eligibility, immutable event chronology, unsuperseded
--          observation selection, and ACTIVE measurement-binding compatibility
--          are therefore enforced exactly once, by the code that already owns
--          them.
--
--   2. evolve the fixed QHIA-009 aggregate transport from its two-slot v1
--      contract to a NEW three-slot v2 endpoint, by WRAPPING the existing v1
--      aggregate and adding exactly the new Goal-Motivation authority beside
--      it.
--
-- Migration 0058's public.read_him_session_cross_context_foreground_v1 is a
-- FROZEN two-slot contract and is neither replaced, altered, weakened, nor
-- re-opened here: it stays installed, authenticated-only, and independently
-- callable with its exact 1/SITUATION_STRESS + 2/DECISION_ATTENTION shape.
-- Migrations 0056 and 0057 are likewise untouched, and v2 calls NEITHER of
-- them directly - the proven v1 aggregate already owns those two slots, and
-- becoming a second implementation of what it already proves is precisely the
-- failure this task must avoid. This is deliberate layering: v2 EXTENDS the
-- proven aggregate, it does not reopen it.
--
-- The callable surface of both new functions is narrow ON PURPOSE. Neither
-- accepts a context kind, a caller-supplied context id, a target, a metric
-- key, a metric list, a definition version, or a slot list: the ONLY inputs
-- are the authenticated user and the exact owned conversation session, and the
-- Goal is resolved server-side from the explicit authenticated relevance
-- binding. A caller cannot aim either function at another context, at another
-- metric, or at another user's data, because there is no parameter with which
-- to do so.
--
-- SECURITY INVOKER is deliberate and is the hardened choice for both, exactly
-- as in migrations 0056, 0057 and 0058. Neither function reads a table: they
-- hold no privilege of their own, need none, and every privileged read happens
-- inside the existing SECURITY DEFINER authorities under their own rules. The
-- authenticated caller therefore reaches exactly the data those authorities
-- would already have returned - never more - and auth.uid() keeps its exact
-- meaning through the nested calls because the JWT claims are request-scoped
-- configuration, not a role privilege. A fixed empty search_path, explicit
-- revocation, authenticated-only EXECUTE, and STABLE volatility complete the
-- posture; the install-time postconditions below prove all of it on the
-- INSTALLED definitions.
--
-- Failure stays atomic and fail-closed. If a nested authority raises -
-- unauthenticated caller, non-owner p_user_id, unknown or cross-user session,
-- non-ACTIVE session, ambiguous ACTIVE binding, unowned target, invalid
-- persisted definition, definition-unapproved context - the whole statement
-- raises that authority's own error. Nothing here catches, substitutes,
-- downgrades, or reinterprets a nested failure into a fake unbound row, and
-- there is no fallback to the v1 aggregate, to the direct authorities, or to
-- any other target. An authoritative NO_ACTIVE_GOAL / NO_ACTIVE_SITUATION /
-- NO_ACTIVE_DECISION / UNKNOWN answer remains a normal successful result.
--
-- QHIA-010 is READ-ONLY. No table, column, constraint, trigger, policy, grant,
-- index, catalog row, measurement, calculation, metric definition, or binding
-- is created, altered, or written anywhere in this migration.

-- 1. Current-phase preconditions: the authorities this migration composes must
--    already exist with their exact intended signatures. One-time
--    migration-phase facts only - nothing here freezes a future migration,
--    metric, context kind, slot, or function.
DO $$BEGIN
 IF to_regprocedure('public.read_him_session_context_bindings_v1(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'The QHIA-006 session context binding relevance authority (migration 0055) is missing';END IF;
 IF to_regprocedure('public.read_him_contextual_current_intelligence_batch_v1(uuid,text,text,text[],integer[])') IS NULL THEN RAISE EXCEPTION 'The QHIA-004 contextual current-intelligence batch authority (migration 0054) is missing';END IF;
 IF to_regprocedure('public.read_him_session_cross_context_foreground_v1(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'The QHIA-009 cross-context foreground aggregate v1 (migration 0058) is missing';END IF;
END$$;

-- 2. The one narrow Goal-Motivation composition function. It always returns
--    EXACTLY ONE row.
--
--    binding_state='NO_ACTIVE_GOAL' is the deterministic unbound result: the
--    authenticated owned session currently has no ACTIVE GOAL relevance
--    binding, so no Goal was resolved, no metric was read, and every remaining
--    column is null. Absent relevance stays absent - it is never replaced by a
--    newest/only Goal, by another kind's binding, or by any inference.
--
--    binding_state='ACTIVE_GOAL_BOUND' carries binding_context_id (the exact
--    Goal the QHIA-006 authority resolved) together with the delegated
--    QHIA-004 batch row for exactly hse.motivation@1 in that Goal, verbatim. A
--    bound Goal with no usable canonical current value is still BOUND with
--    has_canonical_current_value=false: "bound" and "known" are separate facts
--    and this function never collapses them.
--
--    Every authority failure propagates as the raising authority's own
--    fail-closed error. This function adds no fallback, no substitution, and
--    no second opinion.
CREATE FUNCTION public.read_him_session_goal_motivation_v1(p_user_id uuid,p_session_id uuid)
RETURNS TABLE(
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
) LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE goals uuid[];bound_goal uuid;
BEGIN
 -- The QHIA-006 authority answers for every ACTIVE kind of this exact owned
 -- session in one call; only the GOAL kind is consumed here. Collecting into
 -- an array rather than SELECT INTO makes the cardinality explicit: the 0055
 -- partial unique index permits at most one ACTIVE GOAL binding, so more than
 -- one is a fail-closed integrity breach, never a row to choose between.
 SELECT array_agg(b.context_id) INTO goals
 FROM public.read_him_session_context_bindings_v1(p_user_id,p_session_id) b
 WHERE b.context_kind='GOAL';
 IF goals IS NULL OR cardinality(goals)=0 THEN
  RETURN QUERY SELECT 'NO_ACTIVE_GOAL'::text,NULL::uuid,NULL::integer,NULL::text,NULL::integer,NULL::text,NULL::text,NULL::text,NULL::text,NULL::text[],NULL::text,NULL::text,NULL::boolean,NULL::text,NULL::integer,NULL::text,NULL::text,NULL::text,NULL::text,NULL::text,NULL::double precision,NULL::text,NULL::text,NULL::text,NULL::timestamptz,NULL::timestamptz,NULL::timestamptz,NULL::uuid,NULL::uuid;
  RETURN;
 END IF;
 IF cardinality(goals)>1 THEN RAISE EXCEPTION 'Ambiguous ACTIVE Goal relevance binding' USING ERRCODE='55000';END IF;
 bound_goal:=goals[1];
 -- Exactly one delegated slot: the frozen kind, the authoritatively resolved
 -- target, and the frozen exact metric identity hse.motivation@1. Nothing
 -- about currentness, ownership, eligibility, or binding compatibility is
 -- decided here; the batch row is returned exactly as the authority produced
 -- it.
 RETURN QUERY SELECT 'ACTIVE_GOAL_BOUND'::text,bound_goal,
  c.slot_order,c.metric_key,c.definition_version,c.hif_owner,c.semantic_mapping_status,c.semantic_type,c.calculation_status,c.valid_context_kinds,
  c.context_kind,c.context_id,c.has_canonical_current_value,
  c.source_metric_key,c.source_definition_version,c.source_semantic_mapping_status,c.source_semantic_type,c.source_context_kind,c.source_context_id,
  c.value_state,c.numeric_value,c.validity_status,c.confidence_state,c.confidence_reference,
  c.observed_at,c.temporal_window_start,c.temporal_window_end,c.canonical_binding_id,c.active_binding_id
 FROM public.read_him_contextual_current_intelligence_batch_v1(p_user_id,'GOAL',bound_goal::text,ARRAY['hse.motivation'],ARRAY[1]) c;
END$$;

-- 3. The aggregate transport, version 2. It always returns EXACTLY THREE rows
--    in deterministic transport order, because the wrapped v1 aggregate always
--    returns exactly its two rows and the Goal authority always returns
--    exactly one.
--
--    The envelope is exactly:
--
--      1  SITUATION_STRESS    <- migration 0058 aggregate v1, verbatim
--      2  DECISION_ATTENTION  <- migration 0058 aggregate v1, verbatim
--      3  GOAL_MOTIVATION     <- the new Goal authority above, verbatim
--
--    Rows 1 and 2 are the v1 aggregate's own rows - outer transport
--    discriminator included - carried through untouched, so an aggregate-v2
--    payload equals the aggregate-v1 payload fact for fact. Row 3 is the
--    direct Goal-Motivation authority row under its own frozen slot label.
--    Nothing is recomputed, defaulted, coalesced, normalised, flattened,
--    combined, averaged, ranked, weighted, or scored across channels on the
--    way through, and foreground_slot_order is TRANSPORT ORDER ONLY: it is not
--    a priority, a weight, a preference, or a fallback order.
--
--    There is no fourth slot, and there is no way for a caller to ask for one.
--
--    LANGUAGE sql is deliberate. The whole function is ONE statement, so the
--    wrapped v1 aggregate and the Goal authority execute inside the same
--    PostgreSQL statement and therefore the same snapshot: there is no
--    application-level and no database-level sequencing between the three
--    channels, and none can observe state another cannot. It also makes the
--    read-only, no-control-flow, no-dynamic-SQL posture structural rather than
--    merely asserted.
CREATE FUNCTION public.read_him_session_cross_context_foreground_v2(p_user_id uuid,p_session_id uuid)
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
  SELECT a.foreground_slot_order,a.foreground_slot,
   a.binding_state,a.binding_context_id,
   a.slot_order,a.metric_key,a.definition_version,a.hif_owner,a.semantic_mapping_status,a.semantic_type,a.calculation_status,a.valid_context_kinds,
   a.context_kind,a.context_id,a.has_canonical_current_value,
   a.source_metric_key,a.source_definition_version,a.source_semantic_mapping_status,a.source_semantic_type,a.source_context_kind,a.source_context_id,
   a.value_state,a.numeric_value,a.validity_status,a.confidence_state,a.confidence_reference,
   a.observed_at,a.temporal_window_start,a.temporal_window_end,a.canonical_binding_id,a.active_binding_id
  FROM public.read_him_session_cross_context_foreground_v1(p_user_id,p_session_id) a
  UNION ALL
  SELECT 3::integer,'GOAL_MOTIVATION'::text,
   g.binding_state,g.binding_context_id,
   g.slot_order,g.metric_key,g.definition_version,g.hif_owner,g.semantic_mapping_status,g.semantic_type,g.calculation_status,g.valid_context_kinds,
   g.context_kind,g.context_id,g.has_canonical_current_value,
   g.source_metric_key,g.source_definition_version,g.source_semantic_mapping_status,g.source_semantic_type,g.source_context_kind,g.source_context_id,
   g.value_state,g.numeric_value,g.validity_status,g.confidence_state,g.confidence_reference,
   g.observed_at,g.temporal_window_start,g.temporal_window_end,g.canonical_binding_id,g.active_binding_id
  FROM public.read_him_session_goal_motivation_v1(p_user_id,p_session_id) g
 ) envelope ORDER BY envelope.foreground_slot_order
$$;

-- 4. Narrow authority: authenticated EXECUTE only for both new functions. No
--    PUBLIC, no anon, and no service_role grant - neither widens visibility
--    whatsoever over the authenticated-only authorities they compose.
REVOKE ALL ON FUNCTION public.read_him_session_goal_motivation_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.read_him_session_goal_motivation_v1(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.read_him_session_cross_context_foreground_v2(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.read_him_session_cross_context_foreground_v2(uuid,uuid) TO authenticated;

-- 5. Migration-phase postcondition on the Goal-Motivation authority: safe
--    properties, postgres ownership, the exact narrow ACL, required delegation
--    to BOTH existing authorities, and the proven absence - from the INSTALLED
--    definition - of every forbidden substrate, every duplicated authority,
--    every other context kind (SITUATION explicitly included, which is what
--    keeps Situation-bound Motivation dormant), every other metric key,
--    dynamic SQL, JWT reconstruction, and mutation. Forbidden identifiers are
--    named here only as data to prove they are absent.
DO $$DECLARE fn text:='public.read_him_session_goal_motivation_v1(uuid,uuid)';def text;p record;acl record;forbidden text;BEGIN
 IF to_regprocedure(fn) IS NULL THEN RAISE EXCEPTION 'The Goal-motivation composition authority is missing';END IF;
 -- Exactly one narrow surface: no overload may accept a context kind, a
 -- caller-supplied context id, a metric key, a metric list, or a target.
 IF (SELECT count(*) FROM pg_proc p2 JOIN pg_namespace n ON n.oid=p2.pronamespace WHERE n.nspname='public' AND p2.proname='read_him_session_goal_motivation_v1')<>1 THEN RAISE EXCEPTION 'Exactly one Goal-motivation authority may exist';END IF;
 SELECT prosecdef,provolatile,proconfig,pronargs,proowner::regrole::text AS owner INTO p FROM pg_proc WHERE oid=fn::regprocedure;
 IF p.prosecdef THEN RAISE EXCEPTION 'The Goal-motivation composition must hold no privilege of its own: every privileged read belongs to the composed authorities';END IF;
 IF p.provolatile<>'s' THEN RAISE EXCEPTION 'The Goal-motivation composition must be STABLE';END IF;
 IF p.pronargs<>2 THEN RAISE EXCEPTION 'The Goal-motivation composition must accept exactly the authenticated user and the exact owned session';END IF;
 IF p.owner<>'postgres' THEN RAISE EXCEPTION 'The Goal-motivation composition must be owned by postgres';END IF;
 IF NOT EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%') THEN RAISE EXCEPTION 'The Goal-motivation composition must pin a fixed safe search_path';END IF;
 SELECT has_function_privilege('public',fn,'EXECUTE') pub,has_function_privilege('anon',fn,'EXECUTE') anon_role,has_function_privilege('service_role',fn,'EXECUTE') service,has_function_privilege('authenticated',fn,'EXECUTE') authed INTO acl;
 IF acl.pub OR acl.anon_role OR acl.service OR NOT acl.authed THEN RAISE EXCEPTION 'Goal-motivation EXECUTE authority must be authenticated-only';END IF;
 def:=pg_get_functiondef(fn::regprocedure);
 IF position('public.read_him_session_context_bindings_v1(' in def)=0 THEN RAISE EXCEPTION 'The Goal-motivation composition must resolve relevance through the QHIA-006 authority';END IF;
 IF position('public.read_him_contextual_current_intelligence_batch_v1(' in def)=0 THEN RAISE EXCEPTION 'The Goal-motivation composition must resolve current intelligence through the QHIA-004 authority';END IF;
 IF position('''GOAL''' in def)=0 OR position('''hse.motivation''' in def)=0 THEN RAISE EXCEPTION 'The Goal-motivation composition must pin exactly GOAL and hse.motivation';END IF;
 -- Not one authority is reimplemented, and not one additional substrate is
 -- reachable, from the installed definition.
 FOREACH forbidden IN ARRAY ARRAY['public.him_session_context_bindings','public.him_measurement_targets','public.conversation_sessions','public.him_metric_definitions','public.him_metric_snapshots','public.him_measurement_events','public.him_measurement_observations','public.him_current_structured_measurements','public.him_canonical_model_bindings','public.him_calculation_results','public.read_him_latest_measurement_v1','public.him_active_structured_binding_id','public.read_him_session_situation_stress_v1','public.read_him_session_decision_attention_v1','public.read_him_session_cross_context_foreground_v1','auth.uid','EXECUTE format','EXECUTE '''] LOOP
  IF position(forbidden in def)>0 THEN RAISE EXCEPTION 'The Goal-motivation composition must compose, never reimplement or widen: found %',forbidden;END IF;
 END LOOP;
 -- No other context and no other metric is activated by this task. The other
 -- valid measurement context of this very metric, SITUATION, is proven dormant
 -- here rather than merely left unwritten.
 FOREACH forbidden IN ARRAY ARRAY['''SITUATION''','''DECISION''','''RELATIONSHIP''','''CONVERSATION_SESSION''','''GLOBAL''','hse.energy','hse.stress','hse.attention','hse.self-confidence','hbs.','hrs.','hgs.'] LOOP
  IF position(forbidden in def)>0 THEN RAISE EXCEPTION 'QHIA-010 activates exactly GOAL + hse.motivation@1: found %',forbidden;END IF;
 END LOOP;
 IF position('request.jwt' in def)>0 OR position('set_config' in def)>0 THEN RAISE EXCEPTION 'The Goal-motivation composition must not reconstruct or write request identity state';END IF;
 -- Read-only proof on the installed body. CREATE is deliberately absent from
 -- this list: pg_get_functiondef always emits its own CREATE header, so
 -- matching it would make the rule vacuously true rather than meaningful.
 IF def ~* '(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|DROP\s+|ALTER\s+TABLE|GRANT\s+|REVOKE\s+)' THEN RAISE EXCEPTION 'The Goal-motivation composition must be read-only';END IF;
END$$;

-- 6. Migration-phase postcondition on the aggregate v2 transport: safe
--    properties, postgres ownership, the exact narrow ACL, required wrapping
--    of the FROZEN v1 aggregate and of the new Goal authority, exactly the one
--    new frozen slot label, exactly three slots, and the proven absence - from
--    the INSTALLED definition - of every lower authority, every protected
--    substrate, every metric, every context kind, every caller-selected
--    selector, dynamic SQL, JWT reconstruction, and mutation.
DO $$DECLARE fn text:='public.read_him_session_cross_context_foreground_v2(uuid,uuid)';def text;p record;acl record;forbidden text;BEGIN
 IF to_regprocedure(fn) IS NULL THEN RAISE EXCEPTION 'The cross-context foreground aggregate v2 is missing';END IF;
 IF (SELECT count(*) FROM pg_proc p2 JOIN pg_namespace n ON n.oid=p2.pronamespace WHERE n.nspname='public' AND p2.proname='read_him_session_cross_context_foreground_v2')<>1 THEN RAISE EXCEPTION 'Exactly one cross-context foreground aggregate v2 may exist';END IF;
 SELECT prosecdef,provolatile,proconfig,pronargs,proowner::regrole::text AS owner INTO p FROM pg_proc WHERE oid=fn::regprocedure;
 IF p.prosecdef THEN RAISE EXCEPTION 'The aggregate v2 must hold no privilege of its own: every privileged read belongs to the wrapped authorities';END IF;
 IF p.provolatile<>'s' THEN RAISE EXCEPTION 'The aggregate v2 must be STABLE';END IF;
 IF p.pronargs<>2 THEN RAISE EXCEPTION 'The aggregate v2 must accept exactly the authenticated user and the exact owned session';END IF;
 IF p.owner<>'postgres' THEN RAISE EXCEPTION 'The aggregate v2 must be owned by postgres';END IF;
 IF NOT EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%') THEN RAISE EXCEPTION 'The aggregate v2 must pin a fixed safe search_path';END IF;
 SELECT has_function_privilege('public',fn,'EXECUTE') pub,has_function_privilege('anon',fn,'EXECUTE') anon_role,has_function_privilege('service_role',fn,'EXECUTE') service,has_function_privilege('authenticated',fn,'EXECUTE') authed INTO acl;
 IF acl.pub OR acl.anon_role OR acl.service OR NOT acl.authed THEN RAISE EXCEPTION 'Aggregate v2 EXECUTE authority must be authenticated-only';END IF;
 def:=pg_get_functiondef(fn::regprocedure);
 IF position('public.read_him_session_cross_context_foreground_v1(' in def)=0 THEN RAISE EXCEPTION 'The aggregate v2 must wrap the frozen QHIA-009 aggregate v1, never reimplement its two slots';END IF;
 IF position('public.read_him_session_goal_motivation_v1(' in def)=0 THEN RAISE EXCEPTION 'The aggregate v2 must wrap the QHIA-010 Goal-motivation foreground authority';END IF;
 IF position('''GOAL_MOTIVATION''' in def)=0 THEN RAISE EXCEPTION 'The aggregate v2 must label the one new frozen transport slot';END IF;
 -- Exactly three channels: the two-slot v1 aggregate plus exactly one new
 -- branch, never a fourth slot and never a read-all fan-out.
 IF (length(def)-length(replace(def,'UNION ALL','')))/length('UNION ALL')<>1 THEN RAISE EXCEPTION 'The aggregate v2 envelope must extend the frozen v1 aggregate with exactly one new slot';END IF;
 -- Not one lower authority is called around the wrapped ones, and not one
 -- additional substrate is reachable, from the installed definition. v2
 -- extends the proven aggregate; it never reopens it and never becomes a
 -- second implementation of the two slots v1 already owns.
 FOREACH forbidden IN ARRAY ARRAY['public.read_him_session_situation_stress_v1','public.read_him_session_decision_attention_v1','public.read_him_session_context_bindings_v1','public.read_him_contextual_current_intelligence_batch_v1','public.read_him_latest_measurement_v1','public.him_active_structured_binding_id','public.him_session_context_bindings','public.him_measurement_targets','public.conversation_sessions','public.him_metric_definitions','public.him_metric_snapshots','public.him_measurement_events','public.him_measurement_observations','public.him_current_structured_measurements','public.him_canonical_model_bindings','public.him_calculation_results','auth.uid','EXECUTE format','EXECUTE '''] LOOP
  IF position(forbidden in def)>0 THEN RAISE EXCEPTION 'The aggregate v2 must wrap the proven v1 aggregate and the Goal authority, never reimplement or widen: found %',forbidden;END IF;
 END LOOP;
 -- No metric and no context kind is named, activated, or selectable here: the
 -- aggregate abstracts transport, never meaning.
 FOREACH forbidden IN ARRAY ARRAY['''SITUATION''','''DECISION''','''GOAL''','''RELATIONSHIP''','''CONVERSATION_SESSION''','''GLOBAL''','hse.','hbs.','hrs.','hgs.'] LOOP
  IF position(forbidden in def)>0 THEN RAISE EXCEPTION 'The aggregate v2 activates no metric and no context kind: found %',forbidden;END IF;
 END LOOP;
 FOREACH forbidden IN ARRAY ARRAY['p_context_kind','p_context_id','p_target','p_metric_key','p_metric_keys','p_definition_version','p_slot','p_foreground_slot'] LOOP
  IF position(forbidden in def)>0 THEN RAISE EXCEPTION 'The aggregate v2 accepts no caller-selected context, target, metric, or slot: found %',forbidden;END IF;
 END LOOP;
 IF position('request.jwt' in def)>0 OR position('set_config' in def)>0 THEN RAISE EXCEPTION 'The aggregate v2 must not reconstruct or write request identity state';END IF;
 IF def ~* '(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|DROP\s+|ALTER\s+TABLE|GRANT\s+|REVOKE\s+)' THEN RAISE EXCEPTION 'The aggregate v2 must be read-only';END IF;
END$$;

-- 7. The prior authorities are untouched by this migration and must still be
--    installed exactly as migrations 0056, 0057 and 0058 left them: QHIA-010
--    adds one authority and one transport version, it retires, replaces, and
--    weakens nothing. The v1 aggregate in particular keeps its own frozen
--    two-slot contract and its own authenticated-only ACL, and remains
--    independently callable.
DO $$DECLARE acl record;BEGIN
 IF to_regprocedure('public.read_him_session_situation_stress_v1(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'The QHIA-007 Situation-stress authority (migration 0056) must remain installed';END IF;
 IF to_regprocedure('public.read_him_session_decision_attention_v1(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'The QHIA-008 Decision-attention authority (migration 0057) must remain installed';END IF;
 IF to_regprocedure('public.read_him_session_cross_context_foreground_v1(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'The QHIA-009 cross-context foreground aggregate v1 (migration 0058) must remain installed';END IF;
 SELECT has_function_privilege('public','public.read_him_session_cross_context_foreground_v1(uuid,uuid)','EXECUTE') pub,has_function_privilege('anon','public.read_him_session_cross_context_foreground_v1(uuid,uuid)','EXECUTE') anon_role,has_function_privilege('service_role','public.read_him_session_cross_context_foreground_v1(uuid,uuid)','EXECUTE') service,has_function_privilege('authenticated','public.read_him_session_cross_context_foreground_v1(uuid,uuid)','EXECUTE') authed INTO acl;
 IF acl.pub OR acl.anon_role OR acl.service OR NOT acl.authed THEN RAISE EXCEPTION 'The QHIA-009 aggregate v1 must keep its unchanged authenticated-only EXECUTE authority';END IF;
 -- The frozen v1 aggregate still answers with exactly its own two slots and
 -- still wraps exactly the two authorities 0058 gave it: this migration
 -- changed no byte of it.
 IF position('''SITUATION_STRESS''' in pg_get_functiondef('public.read_him_session_cross_context_foreground_v1(uuid,uuid)'::regprocedure))=0 OR position('''DECISION_ATTENTION''' in pg_get_functiondef('public.read_him_session_cross_context_foreground_v1(uuid,uuid)'::regprocedure))=0 THEN RAISE EXCEPTION 'The QHIA-009 aggregate v1 must keep its exact two-slot contract';END IF;
 IF position('''GOAL_MOTIVATION''' in pg_get_functiondef('public.read_him_session_cross_context_foreground_v1(uuid,uuid)'::regprocedure))>0 THEN RAISE EXCEPTION 'The QHIA-009 aggregate v1 must remain a two-slot contract: the third slot belongs to v2 only';END IF;
END$$;
COMMIT;
