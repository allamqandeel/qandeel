-- Finding 05 - Canonical Evidence Eligibility SQL Unification v1.
--
-- The canonical Evidence contract lives in EvidenceService.listEligibleForUser()
-- / projectEligibleEvidence(). It is not merely "owned + ACTIVE +
-- USER_STATED/USER_CONFIRMED + non-DERIVED_INSIGHT + unexpired". It also
-- includes a bounded candidate set of 64 taken BEFORE source/type filtering and
-- deduplication, deterministic candidate ordering (updated_at DESC, id DESC),
-- deterministic projection ordering (updated_at DESC, id ASC), exact normalized
-- deduplication by type + source + normalizeExact(content), and a final bound
-- of 64.
--
-- Before this migration the SQL consumers disagreed with that contract:
--   * attach_hypothesis_evidence, background_attach_hypothesis_evidence_v1,
--     background_create_confidence_evaluation_v1 and create_confidence_evaluation
--     tested one Memory row in isolation, so a Memory outside the canonical
--     top-64 candidate window, or the losing member of an exact normalized
--     duplicate group, was accepted by the database while
--     EvidenceService rejected it;
--   * apply_hypothesis_evidence_update carried its own inline copy of the
--     projection CTE - correct in spirit, but a fifth implementation and
--     therefore a drift risk, and its whitespace collapse used the regex class
--     `\s`, whose multibyte membership depends on the server's ctype rather
--     than on the JavaScript WhiteSpace/LineTerminator set.
--
-- This is audit finding QAN-AUD-03. This forward-only migration creates ONE
-- canonical SQL Evidence-membership primitive and routes every SQL consumer
-- through it. It changes which Evidence a future write or evaluation accepts;
-- it rewrites no historical row, removes no existing Evidence link, and widens
-- no role's authority.

BEGIN;

-- 1. Canonical Evidence content key. Behaviourally equivalent to the
--    TypeScript `value.normalize('NFKC').trim().replace(/\s+/gu, ' ')`.
--
--    NFKC first, exactly as in TypeScript: it already folds U+00A0, U+2000-
--    U+200A, U+202F, U+205F and U+3000 to U+0020, and folds full-width and
--    other compatibility forms. The remaining JavaScript whitespace code points
--    (U+0009-U+000D, U+1680, U+2028, U+2029, U+FEFF) survive NFKC, so they are
--    mapped explicitly rather than through the regex class `\s`, whose
--    multibyte membership is locale/ctype dependent in PostgreSQL and is not
--    the JavaScript set (notably glibc does not classify U+FEFF as space).
--    translate() therefore enumerates exactly the ECMAScript
--    WhiteSpace + LineTerminator set, by code point, so the result is identical
--    on every installation:
--      U+0009 U+000A U+000B U+000C U+000D U+0020 U+00A0 U+1680
--      U+2000..U+200A U+2028 U+2029 U+202F U+205F U+3000 U+FEFF   (25 points)
--    Collapsing runs of the resulting U+0020 and trimming the ends reproduces
--    `.trim().replace(/\s+/gu, ' ')` exactly: a leading or trailing run becomes
--    a single space and is then removed by btrim.
--
--    This is exact normalization only. It does not lowercase, strip
--    punctuation, or perform any semantic or fuzzy comparison.
CREATE FUNCTION public.canonical_evidence_content_key_v1(p_content text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path='' AS $$
  SELECT btrim(
    regexp_replace(
      translate(
        normalize(p_content, NFKC),
        chr(9)||chr(10)||chr(11)||chr(12)||chr(13)||chr(32)||chr(160)||chr(5760)
          ||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)
          ||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)
          ||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279),
        repeat(' ', 25)
      ),
      ' +', ' ', 'g'
    ),
    ' '
  )
$$;

-- 2. The canonical Evidence-membership primitive: the set of Memory IDs that
--    EvidenceService.listEligibleForUser(p_user_id, ..., p_now) would return,
--    and nothing else. This is an internal database primitive, not a client
--    Evidence API: it returns identifiers only and never Memory content.
--
--    Step A - bounded candidate set. At most 64 owned, ACTIVE, unexpired rows
--    ordered updated_at DESC, id DESC. The LIMIT is applied here, BEFORE
--    source/type filtering and before deduplication, exactly as
--    MemoryRuntimeService.listActiveForUser(userId, token, 64) feeds
--    projectEligibleEvidence(). Moving the LIMIT after deduplication would
--    change which rows are Evidence at all.
--    Step B - canonical eligibility inside that window.
--    Step C - projection ordering updated_at DESC, id ASC.
--    Step D/E - exact normalized dedup on type + source + canonical content
--    key, keeping the first row under projection ordering.
--    Step F - final bound of 64.
CREATE FUNCTION public.canonical_eligible_memory_ids_v1(p_user_id uuid, p_now timestamptz)
RETURNS TABLE(memory_id uuid, evidence_id text)
LANGUAGE sql STABLE SET search_path='' AS $$
  WITH candidates AS MATERIALIZED (
    SELECT memory.id, memory.type, memory.source, memory.content, memory.updated_at
    FROM public.memories memory
    WHERE memory.user_id=p_user_id AND memory.status='ACTIVE'
      AND (memory.expires_at IS NULL OR memory.expires_at>p_now)
    ORDER BY memory.updated_at DESC, memory.id DESC
    LIMIT 64
  ), eligible AS (
    SELECT candidate.id, candidate.updated_at,
      row_number() OVER (
        PARTITION BY candidate.type, candidate.source,
          public.canonical_evidence_content_key_v1(candidate.content)
        ORDER BY candidate.updated_at DESC, candidate.id ASC
      ) duplicate_rank
    FROM candidates candidate
    WHERE candidate.source IN ('USER_STATED','USER_CONFIRMED') AND candidate.type<>'DERIVED_INSIGHT'
  )
  SELECT eligible.id, 'memory:'||eligible.id::text
  FROM eligible WHERE eligible.duplicate_rank=1
  ORDER BY eligible.updated_at DESC, eligible.id ASC
  LIMIT 64
$$;

-- 3. Authenticated Hypothesis Evidence attachment. Only the eligibility test
--    changes: the isolated single-row check becomes canonical membership. The
--    evidence-ID format guard, the uuid cast (so a mixed-case identifier still
--    resolves), the auth-derived owner, the locked owner-scoped Hypothesis
--    lookup, duplicate and opposite-role prevention, the role vocabulary, the
--    version increment, the timestamp and the return shape are unchanged.
CREATE OR REPLACE FUNCTION public.attach_hypothesis_evidence(p_hypothesis_id uuid, p_evidence_id text, p_role text)
RETURNS SETOF public.hypotheses LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_hypothesis public.hypotheses; candidate_memory_id uuid;
BEGIN
  IF p_evidence_id !~ '^memory:[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'Invalid evidence ID.' USING ERRCODE='22023'; END IF;
  candidate_memory_id := substring(p_evidence_id FROM 8)::uuid;
  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_eligible_memory_ids_v1((SELECT auth.uid()), CURRENT_TIMESTAMP) canonical
    WHERE canonical.memory_id=candidate_memory_id
  ) THEN RAISE EXCEPTION 'Evidence is not eligible.' USING ERRCODE='22023'; END IF;
  SELECT * INTO current_hypothesis FROM public.hypotheses WHERE id=p_hypothesis_id AND user_id=(SELECT auth.uid()) FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF p_evidence_id=ANY(current_hypothesis.supporting_evidence_ids) OR p_evidence_id=ANY(current_hypothesis.contradicting_evidence_ids) THEN RAISE EXCEPTION 'Evidence is already attached.' USING ERRCODE='22023'; END IF;
  IF p_role='SUPPORTING' THEN
    RETURN QUERY UPDATE public.hypotheses SET supporting_evidence_ids=array_append(supporting_evidence_ids,p_evidence_id),version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=p_hypothesis_id RETURNING *;
  ELSIF p_role='CONTRADICTING' THEN
    RETURN QUERY UPDATE public.hypotheses SET contradicting_evidence_ids=array_append(contradicting_evidence_ids,p_evidence_id),version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=p_hypothesis_id RETURNING *;
  ELSE RAISE EXCEPTION 'Invalid evidence role.' USING ERRCODE='22023'; END IF;
END; $$;

-- 4. Hypothesis Update Loop. The duplicated inline projection CTE is deleted
--    and replaced by the same canonical primitive, so there is one SQL source
--    of truth instead of two. Everything else is untouched: authentication
--    requirement, expected-version validation, the 40001 stale-version
--    contract, the locked owner-scoped read, evidence role vocabulary and
--    format, already-attached rejection, the single atomic Hypothesis mutation
--    and the immutable hypothesis_updates audit row.
CREATE OR REPLACE FUNCTION public.apply_hypothesis_evidence_update(
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
  candidate_memory_id uuid;
BEGIN
  IF canonical_user IS NULL THEN RAISE EXCEPTION 'Authentication required.' USING ERRCODE='42501'; END IF;
  IF p_expected_version IS NULL OR p_expected_version < 1 THEN RAISE EXCEPTION 'Invalid expected version.' USING ERRCODE='22023'; END IF;
  IF p_evidence_role NOT IN ('SUPPORTING','CONTRADICTING') THEN RAISE EXCEPTION 'Invalid evidence role.' USING ERRCODE='22023'; END IF;
  IF p_evidence_id !~ '^memory:[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'Invalid evidence ID.' USING ERRCODE='22023'; END IF;
  candidate_memory_id := substring(p_evidence_id FROM 8)::uuid;

  SELECT * INTO current_hypothesis FROM public.hypotheses
    WHERE id=p_hypothesis_id AND user_id=canonical_user FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF current_hypothesis.version <> p_expected_version THEN RAISE EXCEPTION 'Stale hypothesis version.' USING ERRCODE='40001'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_eligible_memory_ids_v1(canonical_user, CURRENT_TIMESTAMP) canonical
    WHERE canonical.memory_id=candidate_memory_id
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

-- 5. Background Hypothesis Evidence attachment. Same single substitution. The
--    service-role-only authority, the explicit trusted p_user_id (no JWT is
--    reconstructed), owner-scoped lookup, duplicate and role rules, version
--    behaviour and return shape are unchanged.
CREATE OR REPLACE FUNCTION public.background_attach_hypothesis_evidence_v1(
  p_user_id uuid, p_hypothesis_id uuid, p_evidence_id text, p_role text
) RETURNS SETOF public.hypotheses
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_hypothesis public.hypotheses; candidate_memory_id uuid;
BEGIN
  IF p_evidence_id !~ '^memory:[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'Invalid evidence ID.' USING ERRCODE='22023'; END IF;
  candidate_memory_id:=substring(p_evidence_id FROM 8)::uuid;
  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_eligible_memory_ids_v1(p_user_id, CURRENT_TIMESTAMP) canonical
    WHERE canonical.memory_id=candidate_memory_id
  )
  THEN RAISE EXCEPTION 'Evidence is not eligible.' USING ERRCODE='22023'; END IF;
  SELECT * INTO current_hypothesis FROM public.hypotheses WHERE id=p_hypothesis_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF p_evidence_id=ANY(current_hypothesis.supporting_evidence_ids) OR p_evidence_id=ANY(current_hypothesis.contradicting_evidence_ids)
  THEN RAISE EXCEPTION 'Evidence is already attached.' USING ERRCODE='22023'; END IF;
  IF p_role='SUPPORTING' THEN
    RETURN QUERY UPDATE public.hypotheses SET supporting_evidence_ids=array_append(supporting_evidence_ids,p_evidence_id),version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=p_hypothesis_id AND user_id=p_user_id RETURNING *;
  ELSIF p_role='CONTRADICTING' THEN
    RETURN QUERY UPDATE public.hypotheses SET contradicting_evidence_ids=array_append(contradicting_evidence_ids,p_evidence_id),version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=p_hypothesis_id AND user_id=p_user_id RETURNING *;
  ELSE RAISE EXCEPTION 'Invalid evidence role.' USING ERRCODE='22023'; END IF;
END; $$;

-- 6. Background Confidence evaluation. Membership is decided by the canonical
--    primitive; the ORDER of the retained Evidence identifiers still comes from
--    the Hypothesis array's own ordinality, so stored Confidence Evidence order
--    is unchanged. The canonical membership set is resolved once per evaluation
--    and applied to both roles. Target-version equality, the frozen Confidence
--    vocabulary, assumptions, alternatives, missing-information-code logic,
--    policy version, provenance and uncalibrated score semantics are unchanged.
CREATE OR REPLACE FUNCTION public.background_create_confidence_evaluation_v1(
  p_user_id uuid, p_evaluation_id uuid, p_hypothesis_id uuid, p_target_version integer
) RETURNS SETOF public.confidence_evaluations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target public.hypotheses; canonical_evidence text[]; canonical_supporting text[]; canonical_contradicting text[]; canonical_missing text[];
BEGIN
  SELECT * INTO target FROM public.hypotheses WHERE id=p_hypothesis_id AND user_id=p_user_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF p_target_version<>target.version THEN RAISE EXCEPTION 'Stale hypothesis version.' USING ERRCODE='22023'; END IF;
  SELECT coalesce(array_agg(canonical.evidence_id),'{}'::text[]) INTO canonical_evidence
  FROM public.canonical_eligible_memory_ids_v1(p_user_id, CURRENT_TIMESTAMP) canonical;
  SELECT coalesce(array_agg(link.evidence_id ORDER BY link.ordinality),'{}'::text[]) INTO canonical_supporting
  FROM unnest(target.supporting_evidence_ids) WITH ORDINALITY link(evidence_id,ordinality)
  WHERE link.evidence_id=ANY(canonical_evidence);
  SELECT coalesce(array_agg(link.evidence_id ORDER BY link.ordinality),'{}'::text[]) INTO canonical_contradicting
  FROM unnest(target.contradicting_evidence_ids) WITH ORDINALITY link(evidence_id,ordinality)
  WHERE link.evidence_id=ANY(canonical_evidence);
  canonical_missing:=ARRAY[]::text[];
  IF cardinality(target.competing_hypothesis_ids)>0 THEN canonical_missing:=array_append(canonical_missing,'COMPETING_HYPOTHESES_UNASSESSED'); END IF;
  IF cardinality(target.assumptions)>0 THEN canonical_missing:=array_append(canonical_missing,'UNVERIFIED_ASSUMPTIONS'); END IF;
  IF cardinality(canonical_supporting)+cardinality(canonical_contradicting)=0 THEN canonical_missing:=array_append(canonical_missing,'NO_ELIGIBLE_EVIDENCE'); END IF;
  canonical_missing:=array_append(canonical_missing,'CONFIDENCE_MODEL_UNCALIBRATED');
  RETURN QUERY INSERT INTO public.confidence_evaluations(
    id,user_id,target_id,target_type,target_version,version,lifecycle_state,numeric_score,confidence_band,
    calibration_state,stability,supporting_evidence_ids,contradicting_evidence_ids,assumptions,
    alternative_hypothesis_ids,missing_information_codes,policy_version,provenance
  ) VALUES (
    p_evaluation_id,p_user_id,target.id,'HYPOTHESIS',target.version,1,'EVALUATED',NULL,NULL,
    'UNCALIBRATED','UNASSESSED',canonical_supporting,canonical_contradicting,target.assumptions,
    target.competing_hypothesis_ids,canonical_missing,'confidence-foundation-v1','QANDEEL_CONFIDENCE_RUNTIME'
  ) RETURNING *;
END; $$;

-- 7. The authenticated Confidence evaluation command is the same QAN-AUD-03
--    surface as its background twin - it decides which linked Memory IDs are
--    still canonical Evidence - and carried the identical weaker filter, so
--    leaving it behind would have preserved exactly the drift this migration
--    exists to remove. Only the membership test changes; the auth-derived
--    owner, stale-target-version rejection, Evidence ordinality, Confidence
--    vocabulary and every other stored value are unchanged.
CREATE OR REPLACE FUNCTION public.create_confidence_evaluation(p_evaluation jsonb)
RETURNS SETOF public.confidence_evaluations LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target public.hypotheses;
DECLARE canonical_user uuid := (SELECT auth.uid());
DECLARE canonical_evidence text[]; canonical_supporting text[]; canonical_contradicting text[]; canonical_missing text[];
BEGIN
  SELECT * INTO target FROM public.hypotheses
    WHERE id=(p_evaluation->>'target_id')::uuid AND user_id=canonical_user;
  IF NOT FOUND THEN RETURN; END IF;
  IF (p_evaluation->>'target_version')::integer<>target.version THEN
    RAISE EXCEPTION 'Stale hypothesis version.' USING ERRCODE='22023';
  END IF;
  SELECT coalesce(array_agg(canonical.evidence_id),'{}'::text[]) INTO canonical_evidence
    FROM public.canonical_eligible_memory_ids_v1(canonical_user, CURRENT_TIMESTAMP) canonical;
  SELECT coalesce(array_agg(link.evidence_id ORDER BY link.ordinality), '{}'::text[])
    INTO canonical_supporting
    FROM unnest(target.supporting_evidence_ids) WITH ORDINALITY link(evidence_id, ordinality)
    WHERE link.evidence_id=ANY(canonical_evidence);
  SELECT coalesce(array_agg(link.evidence_id ORDER BY link.ordinality), '{}'::text[])
    INTO canonical_contradicting
    FROM unnest(target.contradicting_evidence_ids) WITH ORDINALITY link(evidence_id, ordinality)
    WHERE link.evidence_id=ANY(canonical_evidence);
  canonical_missing := ARRAY[]::text[];
  IF cardinality(target.competing_hypothesis_ids)>0 THEN canonical_missing:=array_append(canonical_missing,'COMPETING_HYPOTHESES_UNASSESSED'); END IF;
  IF cardinality(target.assumptions)>0 THEN canonical_missing:=array_append(canonical_missing,'UNVERIFIED_ASSUMPTIONS'); END IF;
  IF cardinality(canonical_supporting)+cardinality(canonical_contradicting)=0 THEN canonical_missing:=array_append(canonical_missing,'NO_ELIGIBLE_EVIDENCE'); END IF;
  canonical_missing:=array_append(canonical_missing,'CONFIDENCE_MODEL_UNCALIBRATED');
  RETURN QUERY INSERT INTO public.confidence_evaluations (
    id,user_id,target_id,target_type,target_version,version,lifecycle_state,numeric_score,confidence_band,
    calibration_state,stability,supporting_evidence_ids,contradicting_evidence_ids,assumptions,
    alternative_hypothesis_ids,missing_information_codes,policy_version,provenance
  ) VALUES (
    (p_evaluation->>'id')::uuid,canonical_user,target.id,'HYPOTHESIS',target.version,1,
    'EVALUATED',NULL,NULL,'UNCALIBRATED','UNASSESSED',canonical_supporting,canonical_contradicting,
    target.assumptions,target.competing_hypothesis_ids,canonical_missing,
    'confidence-foundation-v1','QANDEEL_CONFIDENCE_RUNTIME'
  ) RETURNING *;
END; $$;

-- 8. Authority. The two new primitives are internal: they are owned by
--    postgres, carry a fixed empty search_path, and hold no EXECUTE for any
--    application or Data API role. Every caller is a SECURITY DEFINER function
--    owned by postgres, which reaches them as the owner, so no new Evidence
--    surface is exposed to authenticated, anon, service_role or PUBLIC. The
--    consumer functions are replaced with CREATE OR REPLACE, which preserves
--    their existing owners and ACLs exactly: no role's authority is widened or
--    narrowed by this migration.
ALTER FUNCTION public.canonical_evidence_content_key_v1(text) OWNER TO postgres;
ALTER FUNCTION public.canonical_eligible_memory_ids_v1(uuid,timestamptz) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.canonical_evidence_content_key_v1(text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.canonical_eligible_memory_ids_v1(uuid,timestamptz) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
