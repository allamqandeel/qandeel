BEGIN;

CREATE TABLE public.him_metric_definitions (
  metric_key text NOT NULL, definition_version integer NOT NULL, canonical_name text NOT NULL,
  canonical_definition text NOT NULL, canonical_source text NOT NULL, semantic_type text NOT NULL,
  scale_reference text NOT NULL, valid_context_kinds text[] NOT NULL, required_input_contract text NOT NULL,
  confidence_requirement_reference text NOT NULL, consumers text[] NOT NULL DEFAULT '{}', source_metadata text[] NOT NULL DEFAULT '{}',
  dependency_ids text[] NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(metric_key,definition_version),
  CONSTRAINT him_definition_key_check CHECK(metric_key ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$' AND length(metric_key)<=128),
  CONSTRAINT him_definition_version_check CHECK(definition_version>0),
  CONSTRAINT him_definition_text_check CHECK(length(canonical_name) BETWEEN 1 AND 160 AND length(canonical_definition) BETWEEN 1 AND 2000 AND length(canonical_source) BETWEEN 1 AND 256 AND length(scale_reference) BETWEEN 1 AND 256 AND length(required_input_contract) BETWEEN 1 AND 1000 AND length(confidence_requirement_reference) BETWEEN 1 AND 256),
  CONSTRAINT him_definition_semantic_check CHECK(semantic_type=ANY(ARRAY['STATE','TRAIT','CAPABILITY','READINESS','ALIGNMENT','UNCERTAINTY','PROGRESS','LOAD'])),
  CONSTRAINT him_definition_context_check CHECK(cardinality(valid_context_kinds) BETWEEN 1 AND 6 AND valid_context_kinds <@ ARRAY['GLOBAL','RELATIONSHIP','DECISION','GOAL','CONVERSATION_SESSION','SITUATION']::text[]),
  CONSTRAINT him_definition_metadata_bounds CHECK(public.bounded_nonempty_text_array(consumers,16,128) AND public.bounded_nonempty_text_array(source_metadata,16,128) AND public.bounded_nonempty_text_array(dependency_ids,32,128)),
  CONSTRAINT him_definition_no_self_dependency CHECK(NOT metric_key=ANY(dependency_ids))
);

CREATE TABLE public.him_metric_snapshots (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  metric_key text NOT NULL, definition_version integer NOT NULL, semantic_type text NOT NULL,
  value_state text NOT NULL, numeric_value double precision, confidence_state text NOT NULL DEFAULT 'UNASSESSED', confidence_reference text,
  supporting_evidence_ids text[] NOT NULL DEFAULT '{}', contradicting_evidence_ids text[] NOT NULL DEFAULT '{}', source_engines text[] NOT NULL DEFAULT ARRAY['QANDEEL_HIM_RUNTIME'],
  context_kind text NOT NULL, context_id text NOT NULL, scope text NOT NULL, observed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  temporal_window_start timestamptz, temporal_window_end timestamptz, validity_status text NOT NULL, snapshot_version integer NOT NULL,
  descriptive_update_reason text NOT NULL, descriptive_update_reference_ids text[] NOT NULL DEFAULT '{}',
  canonical_provenance text NOT NULL DEFAULT 'QANDEEL_HIM_RUNTIME_FOUNDATION_V1', created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT him_snapshot_definition_fk FOREIGN KEY(metric_key,definition_version) REFERENCES public.him_metric_definitions(metric_key,definition_version) ON DELETE RESTRICT,
  CONSTRAINT him_snapshot_definition_identity UNIQUE(id,user_id),
  CONSTRAINT him_snapshot_history_unique UNIQUE(user_id,metric_key,context_kind,context_id,snapshot_version),
  CONSTRAINT him_snapshot_semantic_check CHECK(semantic_type=ANY(ARRAY['STATE','TRAIT','CAPABILITY','READINESS','ALIGNMENT','UNCERTAINTY','PROGRESS','LOAD'])),
  CONSTRAINT him_snapshot_value_check CHECK((value_state='UNASSESSED' AND numeric_value IS NULL) OR (value_state='ASSESSED' AND numeric_value>'-Infinity'::double precision AND numeric_value<'Infinity'::double precision)),
  CONSTRAINT him_snapshot_confidence_check CHECK(confidence_state='UNASSESSED' AND confidence_reference IS NULL),
  CONSTRAINT him_snapshot_evidence_bounds CHECK(public.bounded_nonempty_text_array(supporting_evidence_ids,32,64) AND public.bounded_nonempty_text_array(contradicting_evidence_ids,32,64) AND NOT supporting_evidence_ids&&contradicting_evidence_ids),
  CONSTRAINT him_snapshot_source_check CHECK(source_engines=ARRAY['QANDEEL_HIM_RUNTIME']::text[]),
  CONSTRAINT him_snapshot_context_check CHECK(context_kind=ANY(ARRAY['GLOBAL','RELATIONSHIP','DECISION','GOAL','CONVERSATION_SESSION','SITUATION']) AND length(context_id) BETWEEN 1 AND 128 AND context_id=btrim(context_id) AND ((context_kind='GLOBAL' AND context_id='GLOBAL') OR (context_kind=ANY(ARRAY['RELATIONSHIP','DECISION','GOAL','CONVERSATION_SESSION']) AND context_id~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') OR (context_kind='SITUATION' AND context_id<>'GLOBAL'))),
  CONSTRAINT him_snapshot_scope_check CHECK(length(scope) BETWEEN 1 AND 256 AND scope=btrim(scope)),
  CONSTRAINT him_snapshot_window_check CHECK((temporal_window_start IS NULL AND temporal_window_end IS NULL) OR (temporal_window_start IS NOT NULL AND temporal_window_end IS NOT NULL AND temporal_window_start<=temporal_window_end)),
  CONSTRAINT him_snapshot_validity_check CHECK(validity_status=ANY(ARRAY['VALID','INVALIDATED'])),
  CONSTRAINT him_snapshot_version_check CHECK(snapshot_version>0),
  CONSTRAINT him_snapshot_descriptive_reason_check CHECK(length(descriptive_update_reason) BETWEEN 1 AND 500 AND descriptive_update_reason=btrim(descriptive_update_reason)),
  CONSTRAINT him_snapshot_descriptive_references_check CHECK(public.bounded_nonempty_text_array(descriptive_update_reference_ids,32,64)),
  CONSTRAINT him_snapshot_canonical_provenance_check CHECK(canonical_provenance='QANDEEL_HIM_RUNTIME_FOUNDATION_V1')
);

CREATE FUNCTION public.validate_him_metric_dependencies()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM public.him_metric_definitions definition
    CROSS JOIN LATERAL unnest(definition.dependency_ids) dependency(metric_key)
    WHERE NOT EXISTS(SELECT 1 FROM public.him_metric_definitions target WHERE target.metric_key=dependency.metric_key)
  ) THEN RAISE EXCEPTION 'Unresolved HIM metric dependency' USING ERRCODE='23503'; END IF;
  IF EXISTS(
    WITH RECURSIVE latest AS (
      SELECT DISTINCT ON (metric_key) metric_key,dependency_ids FROM public.him_metric_definitions ORDER BY metric_key,definition_version DESC
    ), walk(root,current,path,cycle) AS (
      SELECT metric_key,dependency,ARRAY[metric_key,dependency],metric_key=dependency FROM latest CROSS JOIN LATERAL unnest(dependency_ids) dependency
      UNION ALL
      SELECT walk.root,dependency,walk.path||dependency,dependency=ANY(walk.path)
      FROM walk JOIN latest ON latest.metric_key=walk.current CROSS JOIN LATERAL unnest(latest.dependency_ids) dependency WHERE NOT walk.cycle
    ) SELECT 1 FROM walk WHERE cycle
  ) THEN RAISE EXCEPTION 'Cyclic HIM metric dependency' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER him_metric_dependencies_valid
AFTER INSERT OR UPDATE OR DELETE ON public.him_metric_definitions DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.validate_him_metric_dependencies();

CREATE INDEX him_metric_snapshots_exact_latest_idx ON public.him_metric_snapshots(user_id,metric_key,context_kind,context_id,snapshot_version DESC);
CREATE INDEX him_metric_snapshots_exact_context_idx ON public.him_metric_snapshots(user_id,context_kind,context_id,created_at DESC,id);
ALTER TABLE public.him_metric_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.him_metric_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.him_metric_definitions,public.him_metric_snapshots FROM anon,authenticated;
GRANT SELECT ON TABLE public.him_metric_snapshots TO authenticated;
CREATE POLICY him_metric_snapshots_select_own ON public.him_metric_snapshots FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));

CREATE FUNCTION public.get_him_metric_definition(p_metric_key text,p_definition_version integer)
RETURNS SETOF public.him_metric_definitions LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT * FROM public.him_metric_definitions WHERE metric_key=p_metric_key AND definition_version=p_definition_version;
$$;
CREATE FUNCTION public.list_him_metric_definitions()
RETURNS SETOF public.him_metric_definitions LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT * FROM public.him_metric_definitions ORDER BY metric_key,definition_version;
$$;

CREATE FUNCTION public.create_him_metric_snapshot(p_observation jsonb)
RETURNS SETOF public.him_metric_snapshots LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE canonical_user uuid := (SELECT auth.uid()); definition public.him_metric_definitions; next_version integer;
DECLARE supporting text[]; contradicting text[]; descriptive_reference_ids text[]; value_number double precision;
DECLARE window_start timestamptz; window_end timestamptz;
BEGIN
  IF canonical_user IS NULL THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_observation) key WHERE key<>ALL(ARRAY['id','metricKey','definitionVersion','valueState','numericValue','supportingEvidenceIds','contradictingEvidenceIds','contextKind','contextId','scope','temporalWindowStart','temporalWindowEnd','validityStatus','descriptiveUpdateReason','descriptiveUpdateReferenceIds'])) THEN RAISE EXCEPTION 'Observation contains forbidden fields' USING ERRCODE='22023'; END IF;
  SELECT * INTO definition FROM public.him_metric_definitions WHERE metric_key=p_observation->>'metricKey' AND definition_version=(p_observation->>'definitionVersion')::integer;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown HIM definition identity/version' USING ERRCODE='22023'; END IF;
  IF NOT (p_observation->>'contextKind'=ANY(definition.valid_context_kinds)) THEN RAISE EXCEPTION 'Unsupported exact context kind' USING ERRCODE='22023'; END IF;
  supporting:=ARRAY(SELECT jsonb_array_elements_text(coalesce(p_observation->'supportingEvidenceIds','[]'::jsonb)));
  contradicting:=ARRAY(SELECT jsonb_array_elements_text(coalesce(p_observation->'contradictingEvidenceIds','[]'::jsonb)));
  descriptive_reference_ids:=ARRAY(SELECT jsonb_array_elements_text(coalesce(p_observation->'descriptiveUpdateReferenceIds','[]'::jsonb)));
  IF NOT public.bounded_nonempty_text_array(supporting,32,64) OR NOT public.bounded_nonempty_text_array(contradicting,32,64) OR supporting&&contradicting OR NOT public.bounded_nonempty_text_array(descriptive_reference_ids,32,64) THEN RAISE EXCEPTION 'Invalid bounded HIM evidence metadata' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(supporting||contradicting||descriptive_reference_ids) ref WHERE ref!~'^memory:[0-9a-fA-F-]{36}$' OR NOT EXISTS(SELECT 1 FROM public.memories m WHERE m.id=substring(ref from 8)::uuid AND m.user_id=canonical_user AND m.status='ACTIVE' AND (m.expires_at IS NULL OR m.expires_at>CURRENT_TIMESTAMP))) THEN RAISE EXCEPTION 'Ineligible or cross-user HIM evidence reference' USING ERRCODE='22023'; END IF;
  IF p_observation->>'contextKind'='GLOBAL' THEN IF p_observation->>'contextId'<>'GLOBAL' THEN RAISE EXCEPTION 'Invalid exact GLOBAL context identity' USING ERRCODE='22023'; END IF;
  ELSIF p_observation->>'contextKind'=ANY(ARRAY['RELATIONSHIP','DECISION','GOAL','CONVERSATION_SESSION']) THEN IF p_observation->>'contextId'!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Invalid exact UUID context identity' USING ERRCODE='22023'; END IF;
  ELSIF p_observation->>'contextKind'='SITUATION' THEN IF length(p_observation->>'contextId') NOT BETWEEN 1 AND 128 OR p_observation->>'contextId'<>btrim(p_observation->>'contextId') OR p_observation->>'contextId'='GLOBAL' THEN RAISE EXCEPTION 'Invalid exact SITUATION context identity' USING ERRCODE='22023'; END IF;
  ELSE RAISE EXCEPTION 'Invalid HIM context kind' USING ERRCODE='22023'; END IF;
  IF p_observation->>'valueState'='UNASSESSED' THEN IF p_observation?'numericValue' THEN RAISE EXCEPTION 'Unassessed HIM value cannot carry numeric value' USING ERRCODE='22023'; END IF; value_number:=NULL;
  ELSIF p_observation->>'valueState'='ASSESSED' THEN value_number:=(p_observation->>'numericValue')::double precision; IF value_number IS NULL OR value_number<='-Infinity'::double precision OR value_number>='Infinity'::double precision OR value_number<>value_number THEN RAISE EXCEPTION 'Assessed HIM value requires finite numeric value' USING ERRCODE='22023'; END IF;
  ELSE RAISE EXCEPTION 'Invalid HIM value state' USING ERRCODE='22023'; END IF;
  IF (p_observation?'temporalWindowStart')<>(p_observation?'temporalWindowEnd') THEN RAISE EXCEPTION 'Incomplete temporal window' USING ERRCODE='22023'; END IF;
  IF p_observation?'temporalWindowStart' THEN window_start:=(p_observation->>'temporalWindowStart')::timestamptz; window_end:=(p_observation->>'temporalWindowEnd')::timestamptz; IF window_start>window_end THEN RAISE EXCEPTION 'Invalid temporal window' USING ERRCODE='22023'; END IF; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(canonical_user::text||definition.metric_key||(p_observation->>'contextKind')||(p_observation->>'contextId'),0));
  SELECT coalesce(max(snapshot_version),0)+1 INTO next_version FROM public.him_metric_snapshots WHERE user_id=canonical_user AND metric_key=definition.metric_key AND context_kind=p_observation->>'contextKind' AND context_id=p_observation->>'contextId';
  RETURN QUERY INSERT INTO public.him_metric_snapshots(id,user_id,metric_key,definition_version,semantic_type,value_state,numeric_value,confidence_state,confidence_reference,supporting_evidence_ids,contradicting_evidence_ids,source_engines,context_kind,context_id,scope,observed_at,temporal_window_start,temporal_window_end,validity_status,snapshot_version,descriptive_update_reason,descriptive_update_reference_ids,canonical_provenance,created_at)
  VALUES((p_observation->>'id')::uuid,canonical_user,definition.metric_key,definition.definition_version,definition.semantic_type,p_observation->>'valueState',value_number,'UNASSESSED',NULL,supporting,contradicting,ARRAY['QANDEEL_HIM_RUNTIME'],p_observation->>'contextKind',p_observation->>'contextId',p_observation->>'scope',CURRENT_TIMESTAMP,window_start,window_end,p_observation->>'validityStatus',next_version,p_observation->>'descriptiveUpdateReason',descriptive_reference_ids,'QANDEEL_HIM_RUNTIME_FOUNDATION_V1',CURRENT_TIMESTAMP) RETURNING *;
END; $$;

REVOKE ALL ON FUNCTION public.get_him_metric_definition(text,integer),public.list_him_metric_definitions(),public.create_him_metric_snapshot(jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.validate_him_metric_dependencies() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_him_metric_definition(text,integer),public.list_him_metric_definitions(),public.create_him_metric_snapshot(jsonb) TO authenticated;
COMMIT;
