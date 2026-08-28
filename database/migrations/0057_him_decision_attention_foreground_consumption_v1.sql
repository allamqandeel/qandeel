BEGIN;
-- HIM Decision Attention Foreground Consumption v1 (QHIA-008).
--
-- The SECOND cross-context foreground consumption built on top of the QHIA-006
-- relevance authority, and deliberately just as narrow as the first: exactly
-- one context kind (DECISION) and exactly one metric (hse.attention@1).
-- Nothing else is activated here - no GOAL, SITUATION, or RELATIONSHIP
-- consumption, no second Decision metric, no "read every relevant context"
-- fan-out, and no generic foreground surface of any kind. In particular
-- hse.self-confidence@1, the other runtime-available DECISION metric, stays
-- INTENTIONALLY DORMANT: it is named in the postcondition below only as data
-- to prove it is absent from the installed definition.
--
-- QHIA-007 (migration 0056) proved this authority/latency shape once for
-- SITUATION + hse.stress@1. This migration proves it independently a second
-- time for a different context kind and a different metric - "prove twice,
-- abstract once". It therefore installs a SECOND narrow composition rather
-- than a generic cross-context reader: no caller-selected context list, no
-- caller-selected metric list, and no multi-context aggregator exists here or
-- anywhere else yet.
--
-- This migration changes TRANSPORT/COMPOSITION SHAPE ONLY. It installs
-- exactly one new read-only RPC that answers one question - "for this exact
-- owned conversation session, what is the authoritative current
-- hse.attention@1 intelligence of the exact Decision the authenticated user
-- explicitly bound to it?" - in ONE Data API request, by COMPOSING the two
-- existing authorities and duplicating neither:
--
--   * public.read_him_session_context_bindings_v1(uuid,uuid) (migration 0055)
--     stays the ONLY relevance authority - authentication, exact session
--     ownership, session runtime state, ACTIVE-only selection, the
--     one-ACTIVE-per-kind cardinality, and the protected append-only
--     lifecycle all live there and only there. This function reads its
--     authoritative result and filters it down to the DECISION kind; it never
--     touches public.him_session_context_bindings, never reconstructs the
--     binding query, and never selects a "latest", "first", or "only" Decision
--     when no ACTIVE binding exists.
--   * public.read_him_contextual_current_intelligence_batch_v1(uuid,text,text,
--     text[],integer[]) (migration 0054) stays the ONLY current-intelligence
--     authority for the resolved Decision - which in turn delegates the
--     canonical-latest value to read_him_latest_measurement_v1 (0052) and the
--     ACTIVE-binding identity to him_active_structured_binding_id (0050).
--     Target ownership, persisted-definition validity, definition-approved
--     context eligibility, immutable event chronology, unsuperseded
--     observation selection, and ACTIVE measurement-binding compatibility are
--     therefore enforced exactly once, by the code that already owns them.
--
-- The callable surface is narrow ON PURPOSE. It accepts no context kind, no
-- caller-supplied context id, no metric key, no metric list, and no target:
-- the ONLY inputs are the authenticated user and the exact owned session, and
-- the Decision is resolved server-side from the explicit authenticated
-- relevance binding. A caller cannot aim this function at another context, at
-- another metric, or at another user's data, because there is no parameter
-- with which to do so.
--
-- SECURITY INVOKER is deliberate and is the hardened choice here, exactly as
-- in migration 0056. Unlike migrations 0054 and 0055, this function reads NO
-- table: it holds no privilege of its own, needs none, and every privileged
-- read happens inside the existing SECURITY DEFINER authorities under their
-- own rules. The authenticated caller therefore reaches exactly the data those
-- authorities would already have returned - never more - and auth.uid() keeps
-- its exact meaning through the nested calls because the JWT claims are
-- request-scoped configuration, not a role privilege. A fixed empty
-- search_path, explicit revocation, authenticated-only EXECUTE, and STABLE
-- volatility complete the posture; the install-time postcondition below proves
-- all of it, plus the proven absence of every forbidden substrate, of every
-- other context kind, and of every other metric key - hse.self-confidence
-- included - on the INSTALLED definition.
--
-- QHIA-008 is READ-ONLY. No table, column, constraint, trigger, policy, grant,
-- index, catalog row, measurement, calculation, or binding is created,
-- altered, or written anywhere in this migration, and no existing authority,
-- verifier, or consumption surface changes - migration 0056 in particular is
-- neither replaced, altered, nor weakened.

-- 1. Current-phase preconditions: the two authorities this composition is
--    built from must already exist with their exact intended signatures. One-
--    time migration-phase facts only - nothing here freezes a future
--    migration, metric, context kind, or function.
DO $$BEGIN
 IF to_regprocedure('public.read_him_session_context_bindings_v1(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'The QHIA-006 session context binding relevance authority (migration 0055) is missing';END IF;
 IF to_regprocedure('public.read_him_contextual_current_intelligence_batch_v1(uuid,text,text,text[],integer[])') IS NULL THEN RAISE EXCEPTION 'The QHIA-004 contextual current-intelligence batch authority (migration 0054) is missing';END IF;
END$$;

-- 2. The one narrow composition function. It always returns EXACTLY ONE row.
--
--    binding_state='NO_ACTIVE_DECISION' is the deterministic unbound result:
--    the authenticated owned session currently has no ACTIVE DECISION
--    relevance binding, so no Decision was resolved, no metric was read, and
--    every remaining column is null. Absent relevance stays absent - it is
--    never replaced by a newest/only Decision, by another kind's binding, or
--    by any inference.
--
--    binding_state='ACTIVE_DECISION_BOUND' carries binding_context_id (the
--    exact Decision the QHIA-006 authority resolved) together with the
--    delegated QHIA-004 batch row for exactly hse.attention@1 in that
--    Decision, verbatim. A bound Decision with no usable canonical current
--    value is still BOUND with has_canonical_current_value=false: "bound" and
--    "known" are separate facts and this function never collapses them.
--
--    Every authority failure - unauthenticated caller, non-owner p_user_id,
--    unknown or cross-user session, non-ACTIVE session, unowned Decision
--    target, invalid persisted definition, definition-unapproved context -
--    propagates as the raising authority's own fail-closed error. This
--    function adds no fallback, no substitution, and no second opinion.
CREATE FUNCTION public.read_him_session_decision_attention_v1(p_user_id uuid,p_session_id uuid)
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
DECLARE decisions uuid[];bound_decision uuid;
BEGIN
 -- The QHIA-006 authority answers for every ACTIVE kind of this exact owned
 -- session in one call; only the DECISION kind is consumed here. Collecting
 -- into an array rather than SELECT INTO makes the cardinality explicit: the
 -- 0055 partial unique index permits at most one ACTIVE DECISION binding, so
 -- more than one is a fail-closed integrity breach, never a row to choose
 -- between.
 SELECT array_agg(b.context_id) INTO decisions
 FROM public.read_him_session_context_bindings_v1(p_user_id,p_session_id) b
 WHERE b.context_kind='DECISION';
 IF decisions IS NULL OR cardinality(decisions)=0 THEN
  RETURN QUERY SELECT 'NO_ACTIVE_DECISION'::text,NULL::uuid,NULL::integer,NULL::text,NULL::integer,NULL::text,NULL::text,NULL::text,NULL::text,NULL::text[],NULL::text,NULL::text,NULL::boolean,NULL::text,NULL::integer,NULL::text,NULL::text,NULL::text,NULL::text,NULL::text,NULL::double precision,NULL::text,NULL::text,NULL::text,NULL::timestamptz,NULL::timestamptz,NULL::timestamptz,NULL::uuid,NULL::uuid;
  RETURN;
 END IF;
 IF cardinality(decisions)>1 THEN RAISE EXCEPTION 'Ambiguous ACTIVE Decision relevance binding' USING ERRCODE='55000';END IF;
 bound_decision:=decisions[1];
 -- Exactly one delegated slot: the frozen kind, the authoritatively resolved
 -- target, and the frozen exact metric identity hse.attention@1. Nothing about
 -- currentness, ownership, eligibility, or binding compatibility is decided
 -- here; the batch row is returned exactly as the authority produced it.
 RETURN QUERY SELECT 'ACTIVE_DECISION_BOUND'::text,bound_decision,
  c.slot_order,c.metric_key,c.definition_version,c.hif_owner,c.semantic_mapping_status,c.semantic_type,c.calculation_status,c.valid_context_kinds,
  c.context_kind,c.context_id,c.has_canonical_current_value,
  c.source_metric_key,c.source_definition_version,c.source_semantic_mapping_status,c.source_semantic_type,c.source_context_kind,c.source_context_id,
  c.value_state,c.numeric_value,c.validity_status,c.confidence_state,c.confidence_reference,
  c.observed_at,c.temporal_window_start,c.temporal_window_end,c.canonical_binding_id,c.active_binding_id
 FROM public.read_him_contextual_current_intelligence_batch_v1(p_user_id,'DECISION',bound_decision::text,ARRAY['hse.attention'],ARRAY[1]) c;
END$$;

-- 3. Narrow authority: authenticated EXECUTE only. No PUBLIC, no anon, and no
--    service_role grant - this is a foreground authenticated-user composition
--    over reads the same authenticated user could already perform through the
--    two existing authorities, and it widens no visibility whatsoever.
REVOKE ALL ON FUNCTION public.read_him_session_decision_attention_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.read_him_session_decision_attention_v1(uuid,uuid) TO authenticated;

-- 4. Migration-phase postconditions on exactly the one function this
--    migration owns: safe properties, postgres ownership, the exact narrow
--    ACL, required delegation to BOTH existing authorities, and the proven
--    absence - from the INSTALLED definition - of every forbidden substrate,
--    every duplicated authority, every other context kind, every other metric
--    key (hse.self-confidence explicitly included), dynamic SQL, JWT
--    reconstruction, and mutation. Forbidden identifiers are named here only
--    as data to prove they are absent.
DO $$DECLARE fn text:='public.read_him_session_decision_attention_v1(uuid,uuid)';def text;p record;acl record;forbidden text;BEGIN
 IF to_regprocedure(fn) IS NULL THEN RAISE EXCEPTION 'The Decision-attention composition authority is missing';END IF;
 -- Exactly one narrow surface: no overload may accept a context kind, a
 -- caller-supplied context id, a metric key, a metric list, or a target.
 IF (SELECT count(*) FROM pg_proc p2 JOIN pg_namespace n ON n.oid=p2.pronamespace WHERE n.nspname='public' AND p2.proname='read_him_session_decision_attention_v1')<>1 THEN RAISE EXCEPTION 'Exactly one Decision-attention authority may exist';END IF;
 SELECT prosecdef,provolatile,proconfig,pronargs,proowner::regrole::text AS owner INTO p FROM pg_proc WHERE oid=fn::regprocedure;
 IF p.prosecdef THEN RAISE EXCEPTION 'The Decision-attention composition must hold no privilege of its own: every privileged read belongs to the composed authorities';END IF;
 IF p.provolatile<>'s' THEN RAISE EXCEPTION 'The Decision-attention composition must be STABLE';END IF;
 IF p.pronargs<>2 THEN RAISE EXCEPTION 'The Decision-attention composition must accept exactly the authenticated user and the exact owned session';END IF;
 IF p.owner<>'postgres' THEN RAISE EXCEPTION 'The Decision-attention composition must be owned by postgres';END IF;
 IF NOT EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%') THEN RAISE EXCEPTION 'The Decision-attention composition must pin a fixed safe search_path';END IF;
 SELECT has_function_privilege('public',fn,'EXECUTE') pub,has_function_privilege('anon',fn,'EXECUTE') anon_role,has_function_privilege('service_role',fn,'EXECUTE') service,has_function_privilege('authenticated',fn,'EXECUTE') authed INTO acl;
 IF acl.pub OR acl.anon_role OR acl.service OR NOT acl.authed THEN RAISE EXCEPTION 'Decision-attention EXECUTE authority must be authenticated-only';END IF;
 def:=pg_get_functiondef(fn::regprocedure);
 IF position('public.read_him_session_context_bindings_v1(' in def)=0 THEN RAISE EXCEPTION 'The Decision-attention composition must resolve relevance through the QHIA-006 authority';END IF;
 IF position('public.read_him_contextual_current_intelligence_batch_v1(' in def)=0 THEN RAISE EXCEPTION 'The Decision-attention composition must resolve current intelligence through the QHIA-004 authority';END IF;
 IF position('''DECISION''' in def)=0 OR position('''hse.attention''' in def)=0 THEN RAISE EXCEPTION 'The Decision-attention composition must pin exactly DECISION and hse.attention';END IF;
 -- Not one authority is reimplemented, and not one additional substrate is
 -- reachable, from the installed definition.
 FOREACH forbidden IN ARRAY ARRAY['public.him_session_context_bindings','public.him_measurement_targets','public.conversation_sessions','public.him_metric_definitions','public.him_metric_snapshots','public.him_measurement_events','public.him_measurement_observations','public.him_current_structured_measurements','public.him_canonical_model_bindings','public.him_calculation_results','public.read_him_latest_measurement_v1','public.him_active_structured_binding_id','public.read_him_session_situation_stress_v1','auth.uid','EXECUTE format','EXECUTE '''] LOOP
  IF position(forbidden in def)>0 THEN RAISE EXCEPTION 'The Decision-attention composition must compose, never reimplement or widen: found %',forbidden;END IF;
 END LOOP;
 -- No other context and no other metric is activated by this task. The second
 -- runtime-available DECISION metric, hse.self-confidence, is proven dormant
 -- here rather than merely left unwritten.
 FOREACH forbidden IN ARRAY ARRAY['''GOAL''','''SITUATION''','''RELATIONSHIP''','''CONVERSATION_SESSION''','''GLOBAL''','hse.energy','hse.stress','hse.motivation','hse.self-confidence','hbs.','hrs.','hgs.'] LOOP
  IF position(forbidden in def)>0 THEN RAISE EXCEPTION 'QHIA-008 activates exactly DECISION + hse.attention@1: found %',forbidden;END IF;
 END LOOP;
 IF position('request.jwt' in def)>0 OR position('set_config' in def)>0 THEN RAISE EXCEPTION 'The Decision-attention composition must not reconstruct or write request identity state';END IF;
 -- Read-only proof on the installed body. CREATE is deliberately absent from
 -- this list: pg_get_functiondef always emits its own CREATE header, so
 -- matching it would make the rule vacuously true rather than meaningful.
 IF def ~* '(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|DROP\s+|ALTER\s+TABLE|GRANT\s+|REVOKE\s+)' THEN RAISE EXCEPTION 'The Decision-attention composition must be read-only';END IF;
 -- The QHIA-007 authority is untouched by this migration and must still be
 -- installed exactly as migration 0056 left it.
 IF to_regprocedure('public.read_him_session_situation_stress_v1(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'The QHIA-007 Situation-stress authority (migration 0056) must remain installed';END IF;
END$$;
COMMIT;
