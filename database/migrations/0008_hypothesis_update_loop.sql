BEGIN;

CREATE TABLE public.hypothesis_updates (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  hypothesis_id uuid NOT NULL,
  before_version integer NOT NULL,
  after_version integer NOT NULL,
  evidence_id text NOT NULL,
  evidence_role text NOT NULL,
  source text NOT NULL DEFAULT 'QANDEEL_HYPOTHESIS_UPDATE_LOOP',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT hypothesis_updates_owner_fk FOREIGN KEY (hypothesis_id,user_id) REFERENCES public.hypotheses(id,user_id) ON DELETE RESTRICT,
  CONSTRAINT hypothesis_updates_version_check CHECK (before_version > 0 AND after_version = before_version + 1),
  CONSTRAINT hypothesis_updates_evidence_check CHECK (evidence_id ~ '^memory:[0-9a-fA-F-]{36}$'),
  CONSTRAINT hypothesis_updates_role_check CHECK (evidence_role IN ('SUPPORTING','CONTRADICTING')),
  CONSTRAINT hypothesis_updates_source_check CHECK (source = 'QANDEEL_HYPOTHESIS_UPDATE_LOOP')
);
CREATE INDEX hypothesis_updates_history_idx ON public.hypothesis_updates(user_id,hypothesis_id,created_at DESC,id);
ALTER TABLE public.hypothesis_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hypothesis_updates FROM anon, authenticated;
GRANT SELECT ON TABLE public.hypothesis_updates TO authenticated;
CREATE POLICY hypothesis_updates_select_own ON public.hypothesis_updates FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));

CREATE FUNCTION public.apply_hypothesis_evidence_update(
  p_update_id uuid,
  p_hypothesis_id uuid,
  p_expected_version integer,
  p_evidence_id text,
  p_evidence_role text
) RETURNS TABLE(update jsonb, hypothesis jsonb) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  canonical_user uuid := (SELECT auth.uid());
  current_hypothesis public.hypotheses;
  updated_hypothesis public.hypotheses;
  update_record public.hypothesis_updates;
  memory_id uuid;
BEGIN
  IF canonical_user IS NULL THEN RAISE EXCEPTION 'Authentication required.' USING ERRCODE='42501'; END IF;
  IF p_expected_version IS NULL OR p_expected_version < 1 THEN RAISE EXCEPTION 'Invalid expected version.' USING ERRCODE='22023'; END IF;
  IF p_evidence_role NOT IN ('SUPPORTING','CONTRADICTING') THEN RAISE EXCEPTION 'Invalid evidence role.' USING ERRCODE='22023'; END IF;
  IF p_evidence_id !~ '^memory:[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'Invalid evidence ID.' USING ERRCODE='22023'; END IF;
  memory_id := substring(p_evidence_id FROM 8)::uuid;

  SELECT * INTO current_hypothesis FROM public.hypotheses
    WHERE id=p_hypothesis_id AND user_id=canonical_user FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF current_hypothesis.version <> p_expected_version THEN RAISE EXCEPTION 'Stale hypothesis version.' USING ERRCODE='40001'; END IF;
  -- This CTE deliberately mirrors EvidenceService.listEligibleForUser(): MemoryRepository's
  -- bounded candidate query, then eligibility, deterministic exact deduplication, and output cap.
  IF NOT EXISTS (
    WITH candidates AS MATERIALIZED (
      SELECT memory.* FROM public.memories memory
      WHERE memory.user_id=canonical_user AND memory.status='ACTIVE'
        AND (memory.expires_at IS NULL OR memory.expires_at>CURRENT_TIMESTAMP)
      ORDER BY memory.updated_at DESC,memory.id DESC
      LIMIT 64
    ), eligible AS (
      SELECT candidate.id,candidate.updated_at,
        row_number() OVER (
          PARTITION BY candidate.type,candidate.source,
            regexp_replace(
              regexp_replace(normalize(candidate.content,NFKC), '^\s+|\s+$', '', 'g'),
              '\s+', ' ', 'g'
            )
          ORDER BY candidate.updated_at DESC,candidate.id ASC
        ) duplicate_rank
      FROM candidates candidate
      WHERE candidate.source IN ('USER_STATED','USER_CONFIRMED') AND candidate.type<>'DERIVED_INSIGHT'
    ), canonical_evidence AS (
      SELECT eligible.id FROM eligible WHERE eligible.duplicate_rank=1
      ORDER BY eligible.updated_at DESC,eligible.id ASC
      LIMIT 64
    )
    SELECT 1 FROM canonical_evidence WHERE id=memory_id
  )
  THEN RAISE EXCEPTION 'Evidence is not eligible.' USING ERRCODE='22023'; END IF;
  IF p_evidence_id=ANY(current_hypothesis.supporting_evidence_ids) OR p_evidence_id=ANY(current_hypothesis.contradicting_evidence_ids)
  THEN RAISE EXCEPTION 'Evidence is already attached.' USING ERRCODE='22023'; END IF;

  UPDATE public.hypotheses SET
    supporting_evidence_ids=CASE WHEN p_evidence_role='SUPPORTING' THEN array_append(supporting_evidence_ids,p_evidence_id) ELSE supporting_evidence_ids END,
    contradicting_evidence_ids=CASE WHEN p_evidence_role='CONTRADICTING' THEN array_append(contradicting_evidence_ids,p_evidence_id) ELSE contradicting_evidence_ids END,
    version=version+1, updated_at=CURRENT_TIMESTAMP
    WHERE id=current_hypothesis.id AND user_id=canonical_user AND version=p_expected_version
    RETURNING * INTO updated_hypothesis;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stale hypothesis version.' USING ERRCODE='40001'; END IF;

  INSERT INTO public.hypothesis_updates(id,user_id,hypothesis_id,before_version,after_version,evidence_id,evidence_role,source)
    VALUES(p_update_id,canonical_user,current_hypothesis.id,current_hypothesis.version,updated_hypothesis.version,p_evidence_id,p_evidence_role,'QANDEEL_HYPOTHESIS_UPDATE_LOOP')
    RETURNING * INTO update_record;
  RETURN QUERY SELECT to_jsonb(update_record),to_jsonb(updated_hypothesis);
END; $$;

REVOKE ALL ON FUNCTION public.apply_hypothesis_evidence_update(uuid,uuid,integer,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_hypothesis_evidence_update(uuid,uuid,integer,text,text) TO authenticated;

COMMIT;
