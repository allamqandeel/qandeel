BEGIN;
-- HIM Relationship Communication Foreground Consumption v1 (QHIA-011).
--
-- The FOURTH cross-context foreground consumption built on top of the QHIA-006
-- relevance authority, the FIRST one that activates an HRS metric, and
-- deliberately just as narrow as the first three: exactly one context kind
-- (RELATIONSHIP) and exactly one metric (hrs.communication@1). Nothing else is
-- activated here - no SITUATION, DECISION, or GOAL consumption, no sibling HRS
-- metric, no "read every relevant context" fan-out, and no generic foreground
-- surface of any kind.
--
-- The three sibling HRS metrics that share the RELATIONSHIP runtime context -
-- Relationship Trust, Repair, and Emotional Safety - stay INTENTIONALLY
-- DORMANT: they are not requested, not read, not inferred from the
-- Communication reading, not averaged with it, and not reachable through this
-- function. They are named in the postcondition below only as data to prove
-- they are absent from the installed definition.
--
-- The canonical meaning of the delegated reading is unchanged and is NOT
-- reinterpreted here: hrs.communication@1 is the HRS-owned, semantically
-- UNRESOLVED (semantic type NULL), exact-relationship-bound current
-- communication workability the user reports for one exact relationship - how
-- workable it currently is for important points to be expressed, heard,
-- clarified, and understood well enough for the exchange to continue
-- constructively, including when there is disagreement. It is not the amount or
-- frequency of talking, sociability, agreement, absence of conflict,
-- satisfaction, love, closeness, honesty, either person's objective
-- communication skill, conflict-resolution success, persuasion, compatibility,
-- relationship health, Relationship Trust, Repair, Emotional Safety, a clinical
-- construct, a Safety verdict, or Recommendation authority. This migration
-- attaches NO behaviour to the value at all: it transports the authoritative
-- reading and nothing else.
--
-- The persisted Foundation semantic mapping of hrs.communication@1 remains
-- UNRESOLVED with a NULL semantic type, exactly as migration 0010 seeded it and
-- migration 0044 calibrated it. That is the EXPECTED canonical identity for
-- this metric and this migration neither changes it, anticipates a future
-- resolution of it, nor invents a semantic type for it: no metric definition,
-- mapping status, semantic type, calculation status, catalog row, model,
-- approval, or binding is written anywhere here.
--
-- This migration changes TRANSPORT/COMPOSITION SHAPE ONLY, and has exactly two
-- narrow responsibilities:
--
--   1. install the direct Relationship-Communication foreground authority,
--      which answers one question - "for this exact owned conversation session,
--      what is the authoritative current hrs.communication@1 intelligence of
--      the exact Relationship the authenticated user explicitly bound to it?" -
--      in ONE Data API request, by COMPOSING the two existing authorities and
--      duplicating neither:
--
--        * public.read_him_session_context_bindings_v1(uuid,uuid) (migration
--          0055) stays the ONLY relevance authority - authentication, exact
--          session ownership, session runtime state, ACTIVE-only selection,
--          the one-ACTIVE-per-kind cardinality, and the protected append-only
--          lifecycle all live there and only there. This function reads its
--          authoritative result and filters it down to the RELATIONSHIP kind;
--          it never touches public.him_session_context_bindings, never
--          reconstructs the binding query, and never selects a "latest",
--          "first", "only", "most recently measured", "highest", or "lowest"
--          Relationship when no ACTIVE binding exists. It never infers a
--          relationship from conversation text, from a person's name, from a
--          display label, or from any social-graph or embedding similarity.
--        * public.read_him_contextual_current_intelligence_batch_v1(uuid,text,
--          text,text[],integer[]) (migration 0054) stays the ONLY
--          current-intelligence authority for the resolved Relationship - which
--          in turn delegates the canonical-latest value to
--          read_him_latest_measurement_v1 (0052) and the ACTIVE-binding
--          identity to him_active_structured_binding_id (0050). Target
--          ownership, persisted-definition validity, definition-approved
--          context eligibility, immutable event chronology, unsuperseded
--          observation selection, and ACTIVE measurement-binding compatibility
--          are therefore enforced exactly once, by the code that already owns
--          them.
--
--   2. evolve the fixed QHIA-009/QHIA-010 aggregate transport from its
--      three-slot v2 contract to a NEW four-slot v3 endpoint, by WRAPPING the
--      existing v2 aggregate and adding exactly the new
--      Relationship-Communication authority beside it.
--
-- Migration 0058's public.read_him_session_cross_context_foreground_v1 and
-- migration 0059's public.read_him_session_cross_context_foreground_v2 are
-- FROZEN two-slot and three-slot contracts and are neither replaced, altered,
-- weakened, nor re-opened here: both stay installed, authenticated-only, and
-- independently callable with their exact shapes. Migrations 0056, 0057 and
-- 0059's Goal authority are likewise untouched, and v3 calls NONE of them
-- directly - the proven v2 aggregate already owns those three slots, and
-- becoming a second implementation of what it already proves is precisely the
-- failure this task must avoid. This is deliberate layering: v3 EXTENDS the
-- proven aggregate, it does not reopen it.
--
-- The callable surface of both new functions is narrow ON PURPOSE. Neither
-- accepts a context kind, a caller-supplied context id, a target, a
-- relationship label, a metric key, a metric list, a definition version, or a
-- slot list: the ONLY inputs are the authenticated user and the exact owned
-- conversation session, and the Relationship is resolved server-side from the
-- explicit authenticated relevance binding. A caller cannot aim either function
-- at another context, at another metric, or at another user's data, because
-- there is no parameter with which to do so.
--
-- SECURITY INVOKER is deliberate and is the hardened choice for both, exactly
-- as in migrations 0056, 0057, 0058 and 0059. Neither function reads a table:
-- they hold no privilege of their own, need none, and every privileged read
-- happens inside the existing SECURITY DEFINER authorities under their own
-- rules. The authenticated caller therefore reaches exactly the data those
-- authorities would already have returned - never more - and auth.uid() keeps
-- its exact meaning through the nested calls because the JWT claims are
-- request-scoped configuration, not a role privilege. A fixed empty
-- search_path, explicit revocation, authenticated-only EXECUTE, and STABLE
-- volatility complete the posture; the install-time postconditions below prove
-- all of it on the INSTALLED definitions.
--
-- Failure stays atomic and fail-closed. If a nested authority raises -
-- unauthenticated caller, non-owner p_user_id, unknown or cross-user session,
-- non-ACTIVE session, ambiguous ACTIVE binding, unowned target, invalid
-- persisted definition, definition-unapproved context - the whole statement
-- raises that authority's own error. Nothing here catches, substitutes,
-- downgrades, or reinterprets a nested failure into a fake unbound row, and
-- there is no fallback to the v2 aggregate, to the direct authorities, or to
-- any other target. An authoritative NO_ACTIVE_RELATIONSHIP / NO_ACTIVE_GOAL /
-- NO_ACTIVE_SITUATION / NO_ACTIVE_DECISION / UNKNOWN answer remains a normal
-- successful result.
--
-- QHIA-011 is READ-ONLY. No table, column, constraint, trigger, policy, grant,
-- index, catalog row, measurement, calculation, metric definition, or binding
-- is created, altered, or written anywhere in this migration.

-- 1. Current-phase preconditions: the authorities this migration composes must
--    already exist with their exact intended signatures. One-time
--    migration-phase facts only - nothing here freezes a future migration,
--    metric, context kind, slot, or function.
DO $$BEGIN
 IF to_regprocedure('public.read_him_session_context_bindings_v1(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'The QHIA-006 session context binding relevance authority (migration 0055) is missing';END IF;
 IF to_regprocedure('public.read_him_contextual_current_intelligence_batch_v1(uuid,text,text,text[],integer[])') IS NULL THEN RAISE EXCEPTION 'The QHIA-004 contextual current-intelligence batch authority (migration 0054) is missing';END IF;
 IF to_regprocedure('public.read_him_session_cross_context_foreground_v2(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'The QHIA-010 cross-context foreground aggregate v2 (migration 0059) is missing';END IF;
END$$;

-- 2. The one narrow Relationship-Communication composition function. It always
--    returns EXACTLY ONE row.
--
--    binding_state='NO_ACTIVE_RELATIONSHIP' is the deterministic unbound
--    result: the authenticated owned session currently has no ACTIVE
--    RELATIONSHIP relevance binding, so no Relationship was resolved, no metric
--    was read, and every remaining column is null. Absent relevance stays
--    absent - it is never replaced by a newest/only Relationship, by another
--    kind's binding, or by any inference.
--
--    binding_state='ACTIVE_RELATIONSHIP_BOUND' carries binding_context_id (the
--    exact Relationship the QHIA-006 authority resolved) together with the
--    delegated QHIA-004 batch row for exactly hrs.communication@1 in that
--    Relationship, verbatim. A bound Relationship with no usable canonical
--    current value is still BOUND with has_canonical_current_value=false:
--    "bound" and "known" are separate facts and this function never collapses
--    them.
--
--    Every authority failure propagates as the raising authority's own
--    fail-closed error. This function adds no fallback, no substitution, and
--    no second opinion.
CREATE FUNCTION public.read_him_session_relationship_communication_v1(p_user_id uuid,p_session_id uuid)
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
DECLARE relationships uuid[];bound_relationship uuid;
BEGIN
 -- The QHIA-006 authority answers for every ACTIVE kind of this exact owned
 -- session in one call; only the RELATIONSHIP kind is consumed here.
 -- Collecting into an array rather than SELECT INTO makes the cardinality
 -- explicit: the 0055 partial unique index permits at most one ACTIVE
 -- RELATIONSHIP binding, so more than one is a fail-closed integrity breach,
 -- never a row to choose between.
 SELECT array_agg(b.context_id) INTO relationships
 FROM public.read_him_session_context_bindings_v1(p_user_id,p_session_id) b
 WHERE b.context_kind='RELATIONSHIP';
 IF relationships IS NULL OR cardinality(relationships)=0 THEN
  RETURN QUERY SELECT 'NO_ACTIVE_RELATIONSHIP'::text,NULL::uuid,NULL::integer,NULL::text,NULL::integer,NULL::text,NULL::text,NULL::text,NULL::text,NULL::text[],NULL::text,NULL::text,NULL::boolean,NULL::text,NULL::integer,NULL::text,NULL::text,NULL::text,NULL::text,NULL::text,NULL::double precision,NULL::text,NULL::text,NULL::text,NULL::timestamptz,NULL::timestamptz,NULL::timestamptz,NULL::uuid,NULL::uuid;
  RETURN;
 END IF;
 IF cardinality(relationships)>1 THEN RAISE EXCEPTION 'Ambiguous ACTIVE Relationship relevance binding' USING ERRCODE='55000';END IF;
 bound_relationship:=relationships[1];
 -- Exactly one delegated slot: the frozen kind, the authoritatively resolved
 -- target, and the frozen exact metric identity hrs.communication@1. Nothing
 -- about currentness, ownership, eligibility, or binding compatibility is
 -- decided here; the batch row is returned exactly as the authority produced
 -- it, including its persisted UNRESOLVED semantic mapping and NULL semantic
 -- type.
 RETURN QUERY SELECT 'ACTIVE_RELATIONSHIP_BOUND'::text,bound_relationship,
  c.slot_order,c.metric_key,c.definition_version,c.hif_owner,c.semantic_mapping_status,c.semantic_type,c.calculation_status,c.valid_context_kinds,
  c.context_kind,c.context_id,c.has_canonical_current_value,
  c.source_metric_key,c.source_definition_version,c.source_semantic_mapping_status,c.source_semantic_type,c.source_context_kind,c.source_context_id,
  c.value_state,c.numeric_value,c.validity_status,c.confidence_state,c.confidence_reference,
  c.observed_at,c.temporal_window_start,c.temporal_window_end,c.canonical_binding_id,c.active_binding_id
 FROM public.read_him_contextual_current_intelligence_batch_v1(p_user_id,'RELATIONSHIP',bound_relationship::text,ARRAY['hrs.communication'],ARRAY[1]) c;
END$$;

-- 3. The aggregate transport, version 3. It always returns EXACTLY FOUR rows in
--    deterministic transport order, because the wrapped v2 aggregate always
--    returns exactly its three rows and the Relationship authority always
--    returns exactly one.
--
--    The envelope is exactly:
--
--      1  SITUATION_STRESS            <- migration 0059 aggregate v2, verbatim
--      2  DECISION_ATTENTION          <- migration 0059 aggregate v2, verbatim
--      3  GOAL_MOTIVATION             <- migration 0059 aggregate v2, verbatim
--      4  RELATIONSHIP_COMMUNICATION  <- the new Relationship authority above
--
--    Rows 1, 2 and 3 are the v2 aggregate's own rows - outer transport
--    discriminator included - carried through untouched, so an aggregate-v3
--    payload equals the aggregate-v2 payload fact for fact. Row 4 is the direct
--    Relationship-Communication authority row under its own frozen slot label.
--    Nothing is recomputed, defaulted, coalesced, normalised, flattened,
--    combined, averaged, ranked, weighted, or scored across channels on the way
--    through - in particular no HRS reading is ever correlated with an HSE
--    reading or with a sibling HRS metric - and foreground_slot_order is
--    TRANSPORT ORDER ONLY: it is not a priority, a weight, a preference, or a
--    fallback order.
--
--    There is no fifth slot, and there is no way for a caller to ask for one.
--
--    LANGUAGE sql is deliberate. The whole function is ONE statement, so the
--    wrapped v2 aggregate and the Relationship authority execute inside the
--    same PostgreSQL statement and therefore the same snapshot: there is no
--    application-level and no database-level sequencing between the four
--    channels, and none can observe state another cannot. It also makes the
--    read-only, no-control-flow, no-dynamic-SQL posture structural rather than
--    merely asserted.
CREATE FUNCTION public.read_him_session_cross_context_foreground_v3(p_user_id uuid,p_session_id uuid)
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
  FROM public.read_him_session_cross_context_foreground_v2(p_user_id,p_session_id) a
  UNION ALL
  SELECT 4::integer,'RELATIONSHIP_COMMUNICATION'::text,
   r.binding_state,r.binding_context_id,
   r.slot_order,r.metric_key,r.definition_version,r.hif_owner,r.semantic_mapping_status,r.semantic_type,r.calculation_status,r.valid_context_kinds,
   r.context_kind,r.context_id,r.has_canonical_current_value,
   r.source_metric_key,r.source_definition_version,r.source_semantic_mapping_status,r.source_semantic_type,r.source_context_kind,r.source_context_id,
   r.value_state,r.numeric_value,r.validity_status,r.confidence_state,r.confidence_reference,
   r.observed_at,r.temporal_window_start,r.temporal_window_end,r.canonical_binding_id,r.active_binding_id
  FROM public.read_him_session_relationship_communication_v1(p_user_id,p_session_id) r
 ) envelope ORDER BY envelope.foreground_slot_order
$$;

-- 4. Narrow authority: authenticated EXECUTE only for both new functions. No
--    PUBLIC, no anon, and no service_role grant - neither widens visibility
--    whatsoever over the authenticated-only authorities they compose.
REVOKE ALL ON FUNCTION public.read_him_session_relationship_communication_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.read_him_session_relationship_communication_v1(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.read_him_session_cross_context_foreground_v3(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.read_him_session_cross_context_foreground_v3(uuid,uuid) TO authenticated;

-- 5. Migration-phase postcondition on the Relationship-Communication authority:
--    safe properties, postgres ownership, the exact narrow ACL, required
--    delegation to BOTH existing authorities, and the proven absence - from the
--    INSTALLED definition - of every forbidden substrate, every duplicated
--    authority, every other context kind, every other metric key (the three
--    sibling HRS metrics explicitly included, which is what keeps Relationship
--    Trust, Repair and Emotional Safety dormant), dynamic SQL, JWT
--    reconstruction, and mutation. Forbidden identifiers are named here only as
--    data to prove they are absent.
DO $$DECLARE fn text:='public.read_him_session_relationship_communication_v1(uuid,uuid)';def text;p record;acl record;forbidden text;BEGIN
 IF to_regprocedure(fn) IS NULL THEN RAISE EXCEPTION 'The Relationship-communication composition authority is missing';END IF;
 -- Exactly one narrow surface: no overload may accept a context kind, a
 -- caller-supplied context id, a metric key, a metric list, a relationship
 -- label, or a target.
 IF (SELECT count(*) FROM pg_proc p2 JOIN pg_namespace n ON n.oid=p2.pronamespace WHERE n.nspname='public' AND p2.proname='read_him_session_relationship_communication_v1')<>1 THEN RAISE EXCEPTION 'Exactly one Relationship-communication authority may exist';END IF;
 SELECT prosecdef,provolatile,proconfig,pronargs,proowner::regrole::text AS owner INTO p FROM pg_proc WHERE oid=fn::regprocedure;
 IF p.prosecdef THEN RAISE EXCEPTION 'The Relationship-communication composition must hold no privilege of its own: every privileged read belongs to the composed authorities';END IF;
 IF p.provolatile<>'s' THEN RAISE EXCEPTION 'The Relationship-communication composition must be STABLE';END IF;
 IF p.pronargs<>2 THEN RAISE EXCEPTION 'The Relationship-communication composition must accept exactly the authenticated user and the exact owned session';END IF;
 IF p.owner<>'postgres' THEN RAISE EXCEPTION 'The Relationship-communication composition must be owned by postgres';END IF;
 IF NOT EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%') THEN RAISE EXCEPTION 'The Relationship-communication composition must pin a fixed safe search_path';END IF;
 SELECT has_function_privilege('public',fn,'EXECUTE') pub,has_function_privilege('anon',fn,'EXECUTE') anon_role,has_function_privilege('service_role',fn,'EXECUTE') service,has_function_privilege('authenticated',fn,'EXECUTE') authed INTO acl;
 IF acl.pub OR acl.anon_role OR acl.service OR NOT acl.authed THEN RAISE EXCEPTION 'Relationship-communication EXECUTE authority must be authenticated-only';END IF;
 def:=pg_get_functiondef(fn::regprocedure);
 IF position('public.read_him_session_context_bindings_v1(' in def)=0 THEN RAISE EXCEPTION 'The Relationship-communication composition must resolve relevance through the QHIA-006 authority';END IF;
 IF position('public.read_him_contextual_current_intelligence_batch_v1(' in def)=0 THEN RAISE EXCEPTION 'The Relationship-communication composition must resolve current intelligence through the QHIA-004 authority';END IF;
 IF position('''RELATIONSHIP''' in def)=0 OR position('''hrs.communication''' in def)=0 THEN RAISE EXCEPTION 'The Relationship-communication composition must pin exactly RELATIONSHIP and hrs.communication';END IF;
 -- Not one authority is reimplemented, and not one additional substrate is
 -- reachable, from the installed definition.
 FOREACH forbidden IN ARRAY ARRAY['public.him_session_context_bindings','public.him_measurement_targets','public.conversation_sessions','public.him_metric_definitions','public.him_metric_snapshots','public.him_measurement_events','public.him_measurement_observations','public.him_current_structured_measurements','public.him_canonical_model_bindings','public.him_calculation_results','public.read_him_latest_measurement_v1','public.him_active_structured_binding_id','public.read_him_session_situation_stress_v1','public.read_him_session_decision_attention_v1','public.read_him_session_goal_motivation_v1','public.read_him_session_cross_context_foreground_v1','public.read_him_session_cross_context_foreground_v2','auth.uid','EXECUTE format','EXECUTE '''] LOOP
  IF position(forbidden in def)>0 THEN RAISE EXCEPTION 'The Relationship-communication composition must compose, never reimplement or widen: found %',forbidden;END IF;
 END LOOP;
 -- No other context and no other metric is activated by this task. The three
 -- sibling HRS metrics that share this very context kind are proven dormant
 -- here rather than merely left unwritten.
 FOREACH forbidden IN ARRAY ARRAY['''SITUATION''','''DECISION''','''GOAL''','''CONVERSATION_SESSION''','''GLOBAL''','hrs.relationship-trust','hrs.repair','hrs.emotional-safety','hse.','hbs.','hgs.'] LOOP
  IF position(forbidden in def)>0 THEN RAISE EXCEPTION 'QHIA-011 activates exactly RELATIONSHIP + hrs.communication@1: found %',forbidden;END IF;
 END LOOP;
 -- The Foundation semantic mapping is neither resolved nor invented here: no
 -- semantic type of any kind is named by the installed definition.
 FOREACH forbidden IN ARRAY ARRAY['''COMMUNICATION''','''STATE''','''TRAIT''','''CAPABILITY''','''READINESS''','''LOAD''','''PROGRESS''','''ALIGNMENT''','''UNCERTAINTY''','''SAFETY''','''RESOLVED'''] LOOP
  IF position(forbidden in def)>0 THEN RAISE EXCEPTION 'QHIA-011 invents no Foundation semantic mapping: found %',forbidden;END IF;
 END LOOP;
 IF position('request.jwt' in def)>0 OR position('set_config' in def)>0 THEN RAISE EXCEPTION 'The Relationship-communication composition must not reconstruct or write request identity state';END IF;
 -- Read-only proof on the installed body. CREATE is deliberately absent from
 -- this list: pg_get_functiondef always emits its own CREATE header, so
 -- matching it would make the rule vacuously true rather than meaningful.
 IF def ~* '(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|DROP\s+|ALTER\s+TABLE|GRANT\s+|REVOKE\s+)' THEN RAISE EXCEPTION 'The Relationship-communication composition must be read-only';END IF;
END$$;

-- 6. Migration-phase postcondition on the aggregate v3 transport: safe
--    properties, postgres ownership, the exact narrow ACL, required wrapping
--    of the FROZEN v2 aggregate and of the new Relationship authority, exactly
--    the one new frozen slot label, exactly four slots, and the proven absence
--    - from the INSTALLED definition - of every lower authority, every
--    protected substrate, every metric, every context kind, every
--    caller-selected selector, dynamic SQL, JWT reconstruction, and mutation.
DO $$DECLARE fn text:='public.read_him_session_cross_context_foreground_v3(uuid,uuid)';def text;p record;acl record;forbidden text;BEGIN
 IF to_regprocedure(fn) IS NULL THEN RAISE EXCEPTION 'The cross-context foreground aggregate v3 is missing';END IF;
 IF (SELECT count(*) FROM pg_proc p2 JOIN pg_namespace n ON n.oid=p2.pronamespace WHERE n.nspname='public' AND p2.proname='read_him_session_cross_context_foreground_v3')<>1 THEN RAISE EXCEPTION 'Exactly one cross-context foreground aggregate v3 may exist';END IF;
 SELECT prosecdef,provolatile,proconfig,pronargs,proowner::regrole::text AS owner INTO p FROM pg_proc WHERE oid=fn::regprocedure;
 IF p.prosecdef THEN RAISE EXCEPTION 'The aggregate v3 must hold no privilege of its own: every privileged read belongs to the wrapped authorities';END IF;
 IF p.provolatile<>'s' THEN RAISE EXCEPTION 'The aggregate v3 must be STABLE';END IF;
 IF p.pronargs<>2 THEN RAISE EXCEPTION 'The aggregate v3 must accept exactly the authenticated user and the exact owned session';END IF;
 IF p.owner<>'postgres' THEN RAISE EXCEPTION 'The aggregate v3 must be owned by postgres';END IF;
 IF NOT EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%') THEN RAISE EXCEPTION 'The aggregate v3 must pin a fixed safe search_path';END IF;
 SELECT has_function_privilege('public',fn,'EXECUTE') pub,has_function_privilege('anon',fn,'EXECUTE') anon_role,has_function_privilege('service_role',fn,'EXECUTE') service,has_function_privilege('authenticated',fn,'EXECUTE') authed INTO acl;
 IF acl.pub OR acl.anon_role OR acl.service OR NOT acl.authed THEN RAISE EXCEPTION 'Aggregate v3 EXECUTE authority must be authenticated-only';END IF;
 def:=pg_get_functiondef(fn::regprocedure);
 IF position('public.read_him_session_cross_context_foreground_v2(' in def)=0 THEN RAISE EXCEPTION 'The aggregate v3 must wrap the frozen QHIA-010 aggregate v2, never reimplement its three slots';END IF;
 IF position('public.read_him_session_relationship_communication_v1(' in def)=0 THEN RAISE EXCEPTION 'The aggregate v3 must wrap the QHIA-011 Relationship-communication foreground authority';END IF;
 IF position('''RELATIONSHIP_COMMUNICATION''' in def)=0 THEN RAISE EXCEPTION 'The aggregate v3 must label the one new frozen transport slot';END IF;
 -- Exactly four channels: the three-slot v2 aggregate plus exactly one new
 -- branch, never a fifth slot and never a read-all fan-out.
 IF (length(def)-length(replace(def,'UNION ALL','')))/length('UNION ALL')<>1 THEN RAISE EXCEPTION 'The aggregate v3 envelope must extend the frozen v2 aggregate with exactly one new slot';END IF;
 -- Not one lower authority is called around the wrapped ones, and not one
 -- additional substrate is reachable, from the installed definition. v3
 -- extends the proven aggregate; it never reopens it and never becomes a
 -- second implementation of the three slots v2 already owns.
 FOREACH forbidden IN ARRAY ARRAY['public.read_him_session_situation_stress_v1','public.read_him_session_decision_attention_v1','public.read_him_session_goal_motivation_v1','public.read_him_session_cross_context_foreground_v1','public.read_him_session_context_bindings_v1','public.read_him_contextual_current_intelligence_batch_v1','public.read_him_latest_measurement_v1','public.him_active_structured_binding_id','public.him_session_context_bindings','public.him_measurement_targets','public.conversation_sessions','public.him_metric_definitions','public.him_metric_snapshots','public.him_measurement_events','public.him_measurement_observations','public.him_current_structured_measurements','public.him_canonical_model_bindings','public.him_calculation_results','auth.uid','EXECUTE format','EXECUTE '''] LOOP
  IF position(forbidden in def)>0 THEN RAISE EXCEPTION 'The aggregate v3 must wrap the proven v2 aggregate and the Relationship authority, never reimplement or widen: found %',forbidden;END IF;
 END LOOP;
 -- No metric and no context kind is named, activated, or selectable here: the
 -- aggregate abstracts transport, never meaning.
 FOREACH forbidden IN ARRAY ARRAY['''SITUATION''','''DECISION''','''GOAL''','''RELATIONSHIP''','''CONVERSATION_SESSION''','''GLOBAL''','hse.','hbs.','hrs.','hgs.'] LOOP
  IF position(forbidden in def)>0 THEN RAISE EXCEPTION 'The aggregate v3 activates no metric and no context kind: found %',forbidden;END IF;
 END LOOP;
 FOREACH forbidden IN ARRAY ARRAY['p_context_kind','p_context_id','p_target','p_metric_key','p_metric_keys','p_definition_version','p_slot','p_foreground_slot'] LOOP
  IF position(forbidden in def)>0 THEN RAISE EXCEPTION 'The aggregate v3 accepts no caller-selected context, target, metric, or slot: found %',forbidden;END IF;
 END LOOP;
 IF position('request.jwt' in def)>0 OR position('set_config' in def)>0 THEN RAISE EXCEPTION 'The aggregate v3 must not reconstruct or write request identity state';END IF;
 IF def ~* '(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|DROP\s+|ALTER\s+TABLE|GRANT\s+|REVOKE\s+)' THEN RAISE EXCEPTION 'The aggregate v3 must be read-only';END IF;
END$$;

-- 7. The prior authorities are untouched by this migration and must still be
--    installed exactly as migrations 0056, 0057, 0058 and 0059 left them:
--    QHIA-011 adds one authority and one transport version, it retires,
--    replaces, and weakens nothing. The v1 and v2 aggregates in particular keep
--    their own frozen two-slot and three-slot contracts and their own
--    authenticated-only ACLs, and both remain independently callable.
DO $$DECLARE acl record;v1 text;v2 text;BEGIN
 IF to_regprocedure('public.read_him_session_situation_stress_v1(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'The QHIA-007 Situation-stress authority (migration 0056) must remain installed';END IF;
 IF to_regprocedure('public.read_him_session_decision_attention_v1(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'The QHIA-008 Decision-attention authority (migration 0057) must remain installed';END IF;
 IF to_regprocedure('public.read_him_session_goal_motivation_v1(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'The QHIA-010 Goal-motivation authority (migration 0059) must remain installed';END IF;
 IF to_regprocedure('public.read_him_session_cross_context_foreground_v1(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'The QHIA-009 cross-context foreground aggregate v1 (migration 0058) must remain installed';END IF;
 IF to_regprocedure('public.read_him_session_cross_context_foreground_v2(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'The QHIA-010 cross-context foreground aggregate v2 (migration 0059) must remain installed';END IF;
 SELECT has_function_privilege('public','public.read_him_session_cross_context_foreground_v1(uuid,uuid)','EXECUTE') pub,has_function_privilege('anon','public.read_him_session_cross_context_foreground_v1(uuid,uuid)','EXECUTE') anon_role,has_function_privilege('service_role','public.read_him_session_cross_context_foreground_v1(uuid,uuid)','EXECUTE') service,has_function_privilege('authenticated','public.read_him_session_cross_context_foreground_v1(uuid,uuid)','EXECUTE') authed INTO acl;
 IF acl.pub OR acl.anon_role OR acl.service OR NOT acl.authed THEN RAISE EXCEPTION 'The QHIA-009 aggregate v1 must keep its unchanged authenticated-only EXECUTE authority';END IF;
 SELECT has_function_privilege('public','public.read_him_session_cross_context_foreground_v2(uuid,uuid)','EXECUTE') pub,has_function_privilege('anon','public.read_him_session_cross_context_foreground_v2(uuid,uuid)','EXECUTE') anon_role,has_function_privilege('service_role','public.read_him_session_cross_context_foreground_v2(uuid,uuid)','EXECUTE') service,has_function_privilege('authenticated','public.read_him_session_cross_context_foreground_v2(uuid,uuid)','EXECUTE') authed INTO acl;
 IF acl.pub OR acl.anon_role OR acl.service OR NOT acl.authed THEN RAISE EXCEPTION 'The QHIA-010 aggregate v2 must keep its unchanged authenticated-only EXECUTE authority';END IF;
 -- The frozen v1 aggregate still answers with exactly its own two slots and the
 -- frozen v2 aggregate with exactly its own three: this migration changed no
 -- byte of either.
 v1:=pg_get_functiondef('public.read_him_session_cross_context_foreground_v1(uuid,uuid)'::regprocedure);
 v2:=pg_get_functiondef('public.read_him_session_cross_context_foreground_v2(uuid,uuid)'::regprocedure);
 IF position('''SITUATION_STRESS''' in v1)=0 OR position('''DECISION_ATTENTION''' in v1)=0 THEN RAISE EXCEPTION 'The QHIA-009 aggregate v1 must keep its exact two-slot contract';END IF;
 IF position('''GOAL_MOTIVATION''' in v1)>0 OR position('''RELATIONSHIP_COMMUNICATION''' in v1)>0 THEN RAISE EXCEPTION 'The QHIA-009 aggregate v1 must remain a two-slot contract: the later slots belong to v2 and v3 only';END IF;
 IF position('''GOAL_MOTIVATION''' in v2)=0 THEN RAISE EXCEPTION 'The QHIA-010 aggregate v2 must keep its exact three-slot contract';END IF;
 IF position('''RELATIONSHIP_COMMUNICATION''' in v2)>0 OR position('public.read_him_session_relationship_communication_v1' in v2)>0 THEN RAISE EXCEPTION 'The QHIA-010 aggregate v2 must remain a three-slot contract: the fourth slot belongs to v3 only';END IF;
END$$;
COMMIT;
