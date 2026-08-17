BEGIN;

CREATE FUNCTION public.bounded_nonempty_text_array(p_values text[], p_max_count integer, p_max_length integer)
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT cardinality(p_values) <= p_max_count
     AND NOT EXISTS (SELECT 1 FROM unnest(p_values) value WHERE length(btrim(value)) = 0 OR length(value) > p_max_length)
     AND cardinality(p_values) = cardinality(ARRAY(SELECT DISTINCT value FROM unnest(p_values) value));
$$;

CREATE TABLE public.hypotheses (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    statement text NOT NULL,
    type text NOT NULL,
    domain text NOT NULL,
    scope text NOT NULL,
    origin text NOT NULL,
    status text NOT NULL DEFAULT 'CANDIDATE',
    version integer NOT NULL DEFAULT 1,
    supporting_evidence_ids text[] NOT NULL DEFAULT '{}',
    contradicting_evidence_ids text[] NOT NULL DEFAULT '{}',
    competing_hypothesis_ids uuid[] NOT NULL DEFAULT '{}',
    assumptions text[] NOT NULL DEFAULT '{}',
    disconfirming_conditions text[] NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT hypotheses_id_user_unique UNIQUE (id, user_id),
    CONSTRAINT hypotheses_statement_check CHECK (length(btrim(statement)) BETWEEN 1 AND 2000),
    CONSTRAINT hypotheses_scope_check CHECK (length(btrim(scope)) BETWEEN 1 AND 500),
    CONSTRAINT hypotheses_type_check CHECK (type IN ('CAUSAL','BEHAVIORAL','MOTIVATIONAL','SITUATIONAL','RELATIONAL','DECISION','PREDICTIVE','INTERPRETIVE','STRATEGIC')),
    CONSTRAINT hypotheses_domain_check CHECK (domain IN ('GENERAL','RELATIONSHIP','WORK','DECISION','GOAL','INTERACTION')),
    CONSTRAINT hypotheses_origin_check CHECK (origin IN ('SYSTEM_GENERATED','HUMAN_REVIEWED','USER_PROPOSED','ADMIN_CONTROLLED')),
    CONSTRAINT hypotheses_status_check CHECK (status IN ('CANDIDATE','ACTIVE','SUPPORTED','MIXED','WEAK','REJECTED','RETIRED','REOPENED')),
    CONSTRAINT hypotheses_version_check CHECK (version > 0),
    CONSTRAINT hypotheses_supporting_bound CHECK (public.bounded_nonempty_text_array(supporting_evidence_ids, 32, 64)),
    CONSTRAINT hypotheses_contradicting_bound CHECK (public.bounded_nonempty_text_array(contradicting_evidence_ids, 32, 64)),
    CONSTRAINT hypotheses_evidence_roles_disjoint CHECK (NOT supporting_evidence_ids && contradicting_evidence_ids),
    CONSTRAINT hypotheses_competitors_bound CHECK (cardinality(competing_hypothesis_ids) <= 16 AND NOT id = ANY(competing_hypothesis_ids)),
    CONSTRAINT hypotheses_assumptions_bound CHECK (public.bounded_nonempty_text_array(assumptions, 8, 500)),
    CONSTRAINT hypotheses_disconfirmation_bound CHECK (public.bounded_nonempty_text_array(disconfirming_conditions, 8, 500))
);

CREATE INDEX hypotheses_user_active_idx ON public.hypotheses (user_id, updated_at DESC, id) WHERE status IN ('CANDIDATE','ACTIVE','SUPPORTED','MIXED','WEAK','REOPENED');
ALTER TABLE public.hypotheses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hypotheses FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.hypotheses TO authenticated;
CREATE POLICY hypotheses_select_own ON public.hypotheses FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY hypotheses_insert_own ON public.hypotheses FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

CREATE FUNCTION public.transition_hypothesis(p_hypothesis_id uuid, p_status text)
RETURNS SETOF public.hypotheses LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_hypothesis public.hypotheses;
BEGIN
  SELECT * INTO current_hypothesis FROM public.hypotheses WHERE id=p_hypothesis_id AND user_id=(SELECT auth.uid()) FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF NOT (CASE current_hypothesis.status
    WHEN 'CANDIDATE' THEN p_status='ACTIVE'
    WHEN 'ACTIVE' THEN p_status IN ('SUPPORTED','MIXED','WEAK','REJECTED','RETIRED')
    WHEN 'SUPPORTED' THEN p_status IN ('MIXED','WEAK','REJECTED','RETIRED')
    WHEN 'MIXED' THEN p_status IN ('SUPPORTED','WEAK','REJECTED','RETIRED')
    WHEN 'WEAK' THEN p_status IN ('ACTIVE','MIXED','REJECTED','RETIRED')
    WHEN 'REJECTED' THEN p_status='REOPENED' WHEN 'RETIRED' THEN p_status='REOPENED'
    WHEN 'REOPENED' THEN p_status='ACTIVE' ELSE false END)
  THEN RAISE EXCEPTION 'Invalid hypothesis transition.' USING ERRCODE='22023'; END IF;
  RETURN QUERY UPDATE public.hypotheses SET status=p_status, version=version+1, updated_at=CURRENT_TIMESTAMP WHERE id=p_hypothesis_id RETURNING *;
END; $$;

CREATE FUNCTION public.attach_hypothesis_evidence(p_hypothesis_id uuid, p_evidence_id text, p_role text)
RETURNS SETOF public.hypotheses LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_hypothesis public.hypotheses; memory_id uuid;
BEGIN
  IF p_evidence_id !~ '^memory:[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'Invalid evidence ID.' USING ERRCODE='22023'; END IF;
  memory_id := substring(p_evidence_id FROM 8)::uuid;
  IF NOT EXISTS (SELECT 1 FROM public.memories WHERE id=memory_id AND user_id=(SELECT auth.uid()) AND status='ACTIVE' AND source IN ('USER_STATED','USER_CONFIRMED') AND type<>'DERIVED_INSIGHT' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP))
  THEN RAISE EXCEPTION 'Evidence is not eligible.' USING ERRCODE='22023'; END IF;
  SELECT * INTO current_hypothesis FROM public.hypotheses WHERE id=p_hypothesis_id AND user_id=(SELECT auth.uid()) FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF p_evidence_id=ANY(current_hypothesis.supporting_evidence_ids) OR p_evidence_id=ANY(current_hypothesis.contradicting_evidence_ids) THEN RAISE EXCEPTION 'Evidence is already attached.' USING ERRCODE='22023'; END IF;
  IF p_role='SUPPORTING' THEN
    RETURN QUERY UPDATE public.hypotheses SET supporting_evidence_ids=array_append(supporting_evidence_ids,p_evidence_id),version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=p_hypothesis_id RETURNING *;
  ELSIF p_role='CONTRADICTING' THEN
    RETURN QUERY UPDATE public.hypotheses SET contradicting_evidence_ids=array_append(contradicting_evidence_ids,p_evidence_id),version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=p_hypothesis_id RETURNING *;
  ELSE RAISE EXCEPTION 'Invalid evidence role.' USING ERRCODE='22023'; END IF;
END; $$;

CREATE FUNCTION public.link_competing_hypotheses(p_hypothesis_id uuid, p_competitor_id uuid)
RETURNS SETOF public.hypotheses LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE first_id uuid; second_id uuid; first_h public.hypotheses; second_h public.hypotheses;
BEGIN
  IF p_hypothesis_id=p_competitor_id THEN RAISE EXCEPTION 'Self competition is invalid.' USING ERRCODE='22023'; END IF;
  first_id:=LEAST(p_hypothesis_id,p_competitor_id); second_id:=GREATEST(p_hypothesis_id,p_competitor_id);
  SELECT * INTO first_h FROM public.hypotheses WHERE id=first_id AND user_id=(SELECT auth.uid()) FOR UPDATE;
  SELECT * INTO second_h FROM public.hypotheses WHERE id=second_id AND user_id=(SELECT auth.uid()) FOR UPDATE;
  IF first_h.id IS NULL OR second_h.id IS NULL THEN RETURN; END IF;
  IF second_id=ANY(first_h.competing_hypothesis_ids) OR first_id=ANY(second_h.competing_hypothesis_ids) THEN RAISE EXCEPTION 'Duplicate competition link.' USING ERRCODE='22023'; END IF;
  UPDATE public.hypotheses SET competing_hypothesis_ids=array_append(competing_hypothesis_ids,second_id),version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=first_id;
  UPDATE public.hypotheses SET competing_hypothesis_ids=array_append(competing_hypothesis_ids,first_id),version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=second_id;
  RETURN QUERY SELECT * FROM public.hypotheses WHERE id=p_hypothesis_id;
END; $$;

REVOKE ALL ON FUNCTION public.bounded_nonempty_text_array(text[],integer,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transition_hypothesis(uuid,text), public.attach_hypothesis_evidence(uuid,text,text), public.link_competing_hypotheses(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_hypothesis(uuid,text), public.attach_hypothesis_evidence(uuid,text,text), public.link_competing_hypotheses(uuid,uuid) TO authenticated;
COMMIT;
