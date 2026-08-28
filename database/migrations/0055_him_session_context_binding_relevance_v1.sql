BEGIN;
-- HIM Session Context Binding Relevance v1 (QHIA-006).
--
-- Runtime Consumption / relevance infrastructure only. This migration creates
-- the first server-verified EXPLICIT Runtime relevance authority: an
-- authenticated exact binding between one owned conversation session and one
-- exact owned cross-context measurement target (GOAL, SITUATION, DECISION, or
-- RELATIONSHIP). It answers exactly one question - which exact cross-context
-- targets has the authenticated user explicitly bound to this exact
-- conversation session - and nothing else.
--
-- Hard separation preserved: a measurement target existing and being owned is
-- NOT the same fact as that target being relevant to a conversation.
-- public.him_measurement_targets stays measurement-only (this migration only
-- references its existing owner+kind identity for FK integrity and adds no
-- column, trigger, or policy to it), and the new substrate carries no metric
-- value, no measurement requirement, no score, no confidence, no weight, and
-- no target text. An ACTIVE binding grants NO metric consumption authority:
-- which metrics may later be read for a bound context, and under what latency
-- budget, remains a separate, separately reviewed activation decision.
--
-- The ONLY way a binding comes into existence is the explicit authenticated
-- command below receiving exact IDs. Nothing here parses conversation text,
-- calls any AI system, matches labels, or falls back to a newest, first, or
-- only target. Absent binding stays absent.
--
-- No foreground surface changes: the Conversation Orchestrator, turn context
-- selection, Model Router, and every existing Measurement Foundation and
-- consumption authority are untouched.

-- 1. Current-phase preconditions: the two ownership identities this substrate
--    binds must already exist exactly as designed. One-time migration-phase
--    facts only - nothing here freezes a future migration or context kind.
DO $$DECLARE kinds_definition text;BEGIN
 IF to_regclass('public.conversation_sessions') IS NULL THEN RAISE EXCEPTION 'The canonical conversation session authority is missing';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.conversation_sessions'::regclass AND contype='u' AND pg_get_constraintdef(oid) LIKE '%(id, user_id)%') THEN RAISE EXCEPTION 'The conversation session (id, user_id) ownership identity required for FK enforcement is missing';END IF;
 IF to_regclass('public.him_measurement_targets') IS NULL THEN RAISE EXCEPTION 'The exact owned measurement target substrate is missing';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.him_measurement_targets'::regclass AND contype='u' AND pg_get_constraintdef(oid) LIKE '%(id, user_id, context_kind)%') THEN RAISE EXCEPTION 'The measurement target (id, user_id, context_kind) ownership identity required for FK enforcement is missing';END IF;
 SELECT pg_get_constraintdef(oid) INTO kinds_definition FROM pg_constraint WHERE conrelid='public.him_measurement_targets'::regclass AND conname='him_measurement_targets_context_kind_check';
 IF kinds_definition IS NULL OR kinds_definition NOT LIKE '%GOAL%' OR kinds_definition NOT LIKE '%SITUATION%' OR kinds_definition NOT LIKE '%DECISION%' OR kinds_definition NOT LIKE '%RELATIONSHIP%' THEN RAISE EXCEPTION 'The measurement target substrate must already carry the four cross-context kinds';END IF;
END$$;

-- 2. The canonical session-to-cross-context binding substrate. Append-only
--    versioned history: at most one ACTIVE row per user/session/kind, every
--    replacement retires the old row through the protected lifecycle
--    transition and inserts the next monotonic version. Both FKs are RESTRICT
--    on purpose: relevance history may never be silently cascaded away by a
--    session or target deletion.
CREATE TABLE public.him_session_context_bindings(
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL,
 conversation_session_id uuid NOT NULL,
 context_kind text NOT NULL CONSTRAINT him_session_context_binding_kind_check CHECK(context_kind=ANY(ARRAY['GOAL','SITUATION','DECISION','RELATIONSHIP'])),
 context_id uuid NOT NULL,
 binding_version integer NOT NULL CONSTRAINT him_session_context_binding_version_check CHECK(binding_version>0),
 status text NOT NULL CONSTRAINT him_session_context_binding_status_check CHECK(status=ANY(ARRAY['ACTIVE','RETIRED'])),
 binding_source text NOT NULL CONSTRAINT him_session_context_binding_source_check CHECK(binding_source='EXPLICIT_AUTHENTICATED_CONTEXT_BINDING'),
 created_at timestamptz NOT NULL,
 retired_at timestamptz,
 canonical_provenance text NOT NULL CONSTRAINT him_session_context_binding_provenance_check CHECK(canonical_provenance='QANDEEL_HIM_SESSION_CONTEXT_BINDING_V1'),
 CONSTRAINT him_session_context_binding_retirement_check CHECK((status='RETIRED')=(retired_at IS NOT NULL)),
 CONSTRAINT him_session_context_binding_chronology_check CHECK(retired_at IS NULL OR retired_at>=created_at),
 CONSTRAINT him_session_context_binding_history_unique UNIQUE(user_id,conversation_session_id,context_kind,binding_version),
 CONSTRAINT him_session_context_binding_owned_session_fk FOREIGN KEY(conversation_session_id,user_id) REFERENCES public.conversation_sessions(id,user_id) ON DELETE RESTRICT,
 CONSTRAINT him_session_context_binding_owned_target_fk FOREIGN KEY(context_id,user_id,context_kind) REFERENCES public.him_measurement_targets(id,user_id,context_kind) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX him_one_active_session_context_binding ON public.him_session_context_bindings(user_id,conversation_session_id,context_kind) WHERE status='ACTIVE';

-- 3. Table authority: RLS enabled, zero direct privileges for every request
--    role. The canonical Runtime read is the narrow RPC below; no
--    authenticated, anon, PUBLIC, or service_role path may touch the table
--    directly, so the protected lifecycle cannot be bypassed.
ALTER TABLE public.him_session_context_bindings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.him_session_context_bindings FROM PUBLIC,anon,authenticated,service_role;

-- 4. Protected append-only lifecycle. DELETE is always rejected. The only
--    permitted UPDATE is the internally authorized ACTIVE -> RETIRED
--    transition with a database-owned retirement time, and every non-lifecycle
--    column must be byte-identical. RETIRED can never become ACTIVE again.
CREATE FUNCTION public.guard_him_session_context_binding_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Session context binding history is immutable' USING ERRCODE='55000';END IF;
 IF coalesce(current_setting('qandeel.session_context_binding_transition',true),'')<>'authorized'
  OR OLD.status<>'ACTIVE' OR NEW.status<>'RETIRED' OR NEW.retired_at IS NULL
  OR (to_jsonb(OLD)-'status'-'retired_at')<>(to_jsonb(NEW)-'status'-'retired_at')
 THEN RAISE EXCEPTION 'Session context binding mutation requires the protected ACTIVE to RETIRED lifecycle transition' USING ERRCODE='42501';END IF;
 RETURN NEW;END$$;
CREATE TRIGGER him_session_context_binding_guard BEFORE UPDATE OR DELETE ON public.him_session_context_bindings FOR EACH ROW EXECUTE FUNCTION public.guard_him_session_context_binding_mutation();

-- 5. The explicit set-binding command. Exact IDs only: the authenticated
--    exact owner names one exact owned ACTIVE session, one frozen
--    cross-context kind, and one exact owned target of exactly that kind. No
--    measurement event, observation, snapshot, or current value is required -
--    a context may be bound before it has ever been measured - and nothing is
--    inferred, substituted, or matched. Unknown, cross-user, and wrong-kind
--    resources fail closed with sanitized errors that never disclose whether
--    another user's resource exists. Race safety and idempotency live under a
--    per-user/session/kind advisory transaction lock: repeating the same exact
--    target returns the existing ACTIVE row untouched, while a different
--    target of the same kind retires the old row through the protected
--    lifecycle and inserts the next monotonic version.
--
--    Lifecycle CHRONOLOGY is derived only AFTER serialization. No write-driving
--    timestamp may be captured at function entry: a request that captured the
--    clock before the advisory lock, then lost the lock race, would otherwise
--    retire or create a newer version using an older instant and produce
--    append-only history whose audit chronology runs backwards while its
--    version/status lifecycle still looks valid. transition_at is therefore
--    taken under the lock as GREATEST(clock_timestamp(), the latest lifecycle
--    endpoint already present in that exact user/session/kind history), which
--    guarantees old.retired_at >= old.created_at, new.created_at >=
--    old.retired_at, and - for a re-bind after a prior clear - a new version
--    that can never precede the retirement that came before it. Equality at a
--    replacement boundary is intentional: one serialized instant IS the
--    transition. The same-target idempotent path returns before any clock is
--    read at all, so a repeated identical binding remains exactly
--    timestamp-neutral.
CREATE FUNCTION public.set_him_session_context_binding_v1(p_user_id uuid,p_session_id uuid,p_context_kind text,p_context_id uuid)
RETURNS SETOF public.him_session_context_bindings LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid();session_status text;existing public.him_session_context_bindings;has_active boolean;created public.him_session_context_bindings;next_version integer;latest_lifecycle_at timestamptz;transition_at timestamptz;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';END IF;
 IF p_user_id IS NULL OR p_user_id<>u THEN RAISE EXCEPTION 'Session context bindings are owner-exact' USING ERRCODE='42501';END IF;
 IF p_context_kind IS NULL OR p_context_kind<>ALL(ARRAY['GOAL','SITUATION','DECISION','RELATIONSHIP']) THEN RAISE EXCEPTION 'Unsupported session cross-context binding kind' USING ERRCODE='22023';END IF;
 SELECT s.status INTO session_status FROM public.conversation_sessions s WHERE s.id=p_session_id AND s.user_id=u;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown or cross-user conversation session' USING ERRCODE='42501';END IF;
 IF session_status<>'ACTIVE' THEN RAISE EXCEPTION 'Conversation session is not active' USING ERRCODE='55000';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.him_measurement_targets t WHERE t.id=p_context_id AND t.user_id=u AND t.context_kind=p_context_kind) THEN RAISE EXCEPTION 'Unknown, cross-user, or wrong-kind measurement target' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||':session-context-binding:'||p_session_id::text||':'||p_context_kind,0));
 SELECT b.* INTO existing FROM public.him_session_context_bindings b WHERE b.user_id=u AND b.conversation_session_id=p_session_id AND b.context_kind=p_context_kind AND b.status='ACTIVE';
 has_active:=FOUND;
 IF has_active AND existing.context_id=p_context_id THEN RETURN NEXT existing;RETURN;END IF;
 SELECT max(GREATEST(b.created_at,b.retired_at)) INTO latest_lifecycle_at FROM public.him_session_context_bindings b WHERE b.user_id=u AND b.conversation_session_id=p_session_id AND b.context_kind=p_context_kind;
 transition_at:=GREATEST(clock_timestamp(),latest_lifecycle_at);
 IF has_active THEN
  PERFORM set_config('qandeel.session_context_binding_transition','authorized',true);
  UPDATE public.him_session_context_bindings SET status='RETIRED',retired_at=transition_at WHERE id=existing.id;
  PERFORM set_config('qandeel.session_context_binding_transition','',true);
 END IF;
 SELECT coalesce(max(b.binding_version),0)+1 INTO next_version FROM public.him_session_context_bindings b WHERE b.user_id=u AND b.conversation_session_id=p_session_id AND b.context_kind=p_context_kind;
 INSERT INTO public.him_session_context_bindings(id,user_id,conversation_session_id,context_kind,context_id,binding_version,status,binding_source,created_at,retired_at,canonical_provenance)
 VALUES(gen_random_uuid(),u,p_session_id,p_context_kind,p_context_id,next_version,'ACTIVE','EXPLICIT_AUTHENTICATED_CONTEXT_BINDING',transition_at,NULL,'QANDEEL_HIM_SESSION_CONTEXT_BINDING_V1') RETURNING * INTO created;
 RETURN NEXT created;RETURN;
END$$;

-- 6. The explicit clear-binding command. Owner-exact, kind-exact, idempotent:
--    clearing an already-clear kind writes nothing and returns zero rows.
--    Clearing never deletes history - it retires the one ACTIVE row through
--    the same protected lifecycle. An owned but no-longer-active session may
--    still be cleared so stale relevance can be retired without reactivating
--    the session; ownership checks stay identical to set. The retirement
--    instant is likewise derived only after the same advisory lock, so a
--    clear that lost a race can never stamp a retirement earlier than the
--    creation of the row it retires.
CREATE FUNCTION public.clear_him_session_context_binding_v1(p_user_id uuid,p_session_id uuid,p_context_kind text)
RETURNS SETOF public.him_session_context_bindings LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid();existing public.him_session_context_bindings;retired public.him_session_context_bindings;latest_lifecycle_at timestamptz;transition_at timestamptz;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';END IF;
 IF p_user_id IS NULL OR p_user_id<>u THEN RAISE EXCEPTION 'Session context bindings are owner-exact' USING ERRCODE='42501';END IF;
 IF p_context_kind IS NULL OR p_context_kind<>ALL(ARRAY['GOAL','SITUATION','DECISION','RELATIONSHIP']) THEN RAISE EXCEPTION 'Unsupported session cross-context binding kind' USING ERRCODE='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.id=p_session_id AND s.user_id=u) THEN RAISE EXCEPTION 'Unknown or cross-user conversation session' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||':session-context-binding:'||p_session_id::text||':'||p_context_kind,0));
 SELECT b.* INTO existing FROM public.him_session_context_bindings b WHERE b.user_id=u AND b.conversation_session_id=p_session_id AND b.context_kind=p_context_kind AND b.status='ACTIVE';
 IF NOT FOUND THEN RETURN;END IF;
 SELECT max(GREATEST(b.created_at,b.retired_at)) INTO latest_lifecycle_at FROM public.him_session_context_bindings b WHERE b.user_id=u AND b.conversation_session_id=p_session_id AND b.context_kind=p_context_kind;
 transition_at:=GREATEST(clock_timestamp(),latest_lifecycle_at);
 PERFORM set_config('qandeel.session_context_binding_transition','authorized',true);
 UPDATE public.him_session_context_bindings SET status='RETIRED',retired_at=transition_at WHERE id=existing.id RETURNING * INTO retired;
 PERFORM set_config('qandeel.session_context_binding_transition','',true);
 RETURN NEXT retired;RETURN;
END$$;

-- 7. The one-request active read. Returns every current ACTIVE binding of the
--    exact owned ACTIVE session - zero to four rows, at most one per kind - in
--    the canonical fixed kind order GOAL, SITUATION, DECISION, RELATIONSHIP.
--    Creation recency never becomes relevance priority, no target text is
--    read or joined, and one Data API request answers all kinds at once.
CREATE FUNCTION public.read_him_session_context_bindings_v1(p_user_id uuid,p_session_id uuid)
RETURNS SETOF public.him_session_context_bindings LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid();session_status text;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';END IF;
 IF p_user_id IS NULL OR p_user_id<>u THEN RAISE EXCEPTION 'Session context bindings are owner-exact' USING ERRCODE='42501';END IF;
 SELECT s.status INTO session_status FROM public.conversation_sessions s WHERE s.id=p_session_id AND s.user_id=u;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown or cross-user conversation session' USING ERRCODE='42501';END IF;
 IF session_status<>'ACTIVE' THEN RAISE EXCEPTION 'Conversation session is not active' USING ERRCODE='55000';END IF;
 RETURN QUERY
 SELECT b.* FROM public.him_session_context_bindings b
 WHERE b.user_id=u AND b.conversation_session_id=p_session_id AND b.status='ACTIVE'
 ORDER BY array_position(ARRAY['GOAL','SITUATION','DECISION','RELATIONSHIP'],b.context_kind);
END$$;

-- 8. Narrow command/read authority: authenticated EXECUTE only. No PUBLIC, no
--    anon, and no service_role authority anywhere on this substrate.
REVOKE ALL ON FUNCTION public.guard_him_session_context_binding_mutation() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.set_him_session_context_binding_v1(uuid,uuid,text,uuid),public.clear_him_session_context_binding_v1(uuid,uuid,text),public.read_him_session_context_bindings_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.set_him_session_context_binding_v1(uuid,uuid,text,uuid),public.clear_him_session_context_binding_v1(uuid,uuid,text),public.read_him_session_context_bindings_v1(uuid,uuid) TO authenticated;

-- 9. Migration-phase postconditions on exactly the objects this migration
--    owns: safe function properties, postgres ownership, exact narrow ACLs,
--    RLS-enabled zero-privilege table posture, the protected lifecycle guard,
--    and the proven absence of every forbidden measurement substrate, target
--    text read, dynamic SQL shape, and JWT reconstruction from the INSTALLED
--    definitions. Forbidden identifiers are named only as data.
DO $$DECLARE fn text;def text;p record;acl record;forbidden text;guard_def text;BEGIN
 IF to_regclass('public.him_session_context_bindings') IS NULL THEN RAISE EXCEPTION 'The session context binding substrate is missing';END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.him_session_context_bindings'::regclass) THEN RAISE EXCEPTION 'The session context binding substrate must have RLS enabled';END IF;
 FOR p IN SELECT r.role_name,r.privilege FROM (VALUES('anon','SELECT'),('anon','INSERT'),('anon','UPDATE'),('anon','DELETE'),('authenticated','SELECT'),('authenticated','INSERT'),('authenticated','UPDATE'),('authenticated','DELETE'),('service_role','SELECT'),('service_role','INSERT'),('service_role','UPDATE'),('service_role','DELETE')) AS r(role_name,privilege) LOOP
  IF has_table_privilege(p.role_name,'public.him_session_context_bindings',p.privilege) THEN RAISE EXCEPTION 'Direct % privilege for % on the session context binding substrate is forbidden',p.privilege,p.role_name;END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.him_session_context_bindings'::regclass AND tgname='him_session_context_binding_guard' AND NOT tgisinternal) THEN RAISE EXCEPTION 'The protected lifecycle guard trigger is missing';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='him_session_context_bindings' AND indexname='him_one_active_session_context_binding' AND indexdef LIKE '%WHERE%ACTIVE%') THEN RAISE EXCEPTION 'The one-ACTIVE-per-session-per-kind partial unique index is missing';END IF;
 guard_def:=pg_get_functiondef('public.guard_him_session_context_binding_mutation()'::regprocedure);
 IF position('qandeel.session_context_binding_transition' in guard_def)=0 THEN RAISE EXCEPTION 'The lifecycle guard must require the internal transition authorization';END IF;
 FOREACH fn IN ARRAY ARRAY['public.set_him_session_context_binding_v1(uuid,uuid,text,uuid)','public.clear_him_session_context_binding_v1(uuid,uuid,text)','public.read_him_session_context_bindings_v1(uuid,uuid)'] LOOP
  SELECT prosecdef,provolatile,proconfig,proowner::regrole::text AS owner INTO p FROM pg_proc WHERE oid=fn::regprocedure;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing session context binding authority %',fn;END IF;
  IF NOT p.prosecdef OR p.owner<>'postgres' OR NOT EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%') THEN RAISE EXCEPTION 'Unsafe properties on %',fn;END IF;
  IF fn LIKE 'public.read_%' AND p.provolatile<>'s' THEN RAISE EXCEPTION 'The binding read must be STABLE';END IF;
  IF fn NOT LIKE 'public.read_%' AND p.provolatile<>'v' THEN RAISE EXCEPTION 'The binding commands must be VOLATILE';END IF;
  SELECT has_function_privilege('public',fn,'EXECUTE') pub,has_function_privilege('anon',fn,'EXECUTE') anon_role,has_function_privilege('service_role',fn,'EXECUTE') service,has_function_privilege('authenticated',fn,'EXECUTE') authed INTO acl;
  IF acl.pub OR acl.anon_role OR acl.service OR NOT acl.authed THEN RAISE EXCEPTION 'Wrong EXECUTE authority on %',fn;END IF;
  def:=pg_get_functiondef(fn::regprocedure);
  FOREACH forbidden IN ARRAY ARRAY['him_metric_snapshots','him_measurement_events','him_measurement_observations','him_current_structured_measurements','him_canonical_model_bindings','him_metric_definitions','him_calculation_results','him_calculation_models','display_'||'text','EXECUTE format','EXECUTE '''] LOOP
   IF position(forbidden in def)>0 THEN RAISE EXCEPTION 'Forbidden reference % in %',forbidden,fn;END IF;
  END LOOP;
  IF position('request.jwt' in def)>0 THEN RAISE EXCEPTION 'JWT reconstruction is forbidden in %',fn;END IF;
  IF fn LIKE 'public.read_%' AND position('set_config' in def)>0 THEN RAISE EXCEPTION 'The binding read must write no configuration state';END IF;
  -- Lifecycle chronology: in every MUTATION authority the first database
  -- clock read must occur AFTER the advisory serialization point, so no
  -- write-driving instant can be frozen before the lock race is decided.
  -- This is a deterministic structural property of the installed definition,
  -- not a timing-dependent observation.
  IF fn NOT LIKE 'public.read_%' THEN
   IF strpos(def,'pg_advisory_xact_lock')=0 THEN RAISE EXCEPTION 'The mutation authority % must serialize under the advisory lock',fn;END IF;
   IF strpos(def,'clock_timestamp')=0 THEN RAISE EXCEPTION 'The mutation authority % must derive a database lifecycle time',fn;END IF;
   IF strpos(def,'clock_timestamp')<strpos(def,'pg_advisory_xact_lock') THEN RAISE EXCEPTION 'The mutation authority % must derive every lifecycle timestamp after the serialization lock',fn;END IF;
  END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.him_session_context_bindings'::regclass AND conname='him_session_context_binding_chronology_check' AND pg_get_constraintdef(oid) LIKE '%retired_at%>=%created_at%') THEN RAISE EXCEPTION 'The row-level lifecycle chronology constraint is missing';END IF;
END$$;
COMMIT;
