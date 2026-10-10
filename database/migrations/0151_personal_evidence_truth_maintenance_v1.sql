-- INTEL-TM-01 - Personal Evidence Truth Maintenance v1 (PG-02, QAN-BL-INTEL-01).
--
-- When the reader forgets, disables or corrects a Memory, QANDEEL must stop relying on a Hypothesis known to depend on
-- that Memory - immediately, with no worker, no Redis and no Confidence run involved - while the Hypothesis itself,
-- its statement, history and provenance are kept and nothing declares it false. Product authority: the Product
-- Owner's INTEL-TM-01 Implementation Task Contract (2026-10-10), which approved the WP0R2 architecture and its four
-- Controlled Changes. This migration is that runtime's database part, and nothing more.
--
-- ## Three layers, never mixed
--
--   L1  Memory standing, per linked row (personal_evidence_standing_v1): CURRENT (an owned ACTIVE, unexpired,
--       USER_STATED / USER_CONFIRMED, non-DERIVED_INSIGHT row - exactly 0028 steps A + B, without the 64-row window and
--       without deduplication), WITHDRAWN (DELETED / DISABLED), CORRECTED (SUPERSEDED), LAPSED (EXPIRED or past
--       expires_at) or OTHER (anything else, a missing row included).
--   L2  The canonical Evidence projection canonical_eligible_memory_ids_v1 (0028). UNCHANGED, and still the only input
--       of attach, Confidence and the Understanding evidence text. Every id it returns has L1 standing CURRENT.
--   L3  Hypothesis reliance (hypothesis_evidence_change_core_v1): a function of L1 over the CURRENT links plus the
--       immutable withdrawal records below. It can only WITHHOLD; it never grants Evidence and never feeds Confidence.
--
--   tainted(h)          := a withdrawal record exists for h, or a current link (either role) is WITHDRAWN / CORRECTED
--   had_support(h)      := h has a supporting link, or a record of h detached a supporting link
--   current_support(h)  := a supporting link of h is CURRENT
--   evidence change     := NO_REMAINING_SUPPORT if had_support and not current_support,
--                          else REVIEW_PENDING if tainted, else NONE.  Only NONE may be relied on.
--
-- Taint never returns to false: a Memory never becomes ACTIVE again (every Memory UPDATE leaves ACTIVE), a link
-- leaves a Hypothesis only through the re-evaluation core below, which writes the immutable record first, and a record
-- is removed only together with its Hypothesis by the governed erasure. The value reads no lifecycle status, no
-- Confidence, no contest and no clock except expiry, which only ever moves towards withholding - so it is the same
-- before and after the background housekeeping, and the same if that housekeeping never runs. V1 has no restoration
-- path for a tainted Hypothesis: lifting it needs a separately authorized semantic verifier (Controlled Change).
--
-- ## What is added
--
--   1. personal_evidence_memory_id_v1 / personal_evidence_ids_valid_v1 / personal_evidence_standing_v1 (L1);
--   2. hypothesis_evidence_withdrawal_reevaluations: the immutable, owner-only record of every link detachment
--      (which links, which version step, which same-transaction Confidence evaluation). No statement, content, reason
--      text or provider payload. DELETE only by the governed Personal erasure (CASCADE with the Hypothesis);
--   3. hypothesis_evidence_change_core_v1 and hypothesis_reliance_usable_v1 (L3), the authenticated entry
--      hypothesis_evidence_reliance_v1 (auth-derived owner) and its service twin
--      background_hypothesis_evidence_reliance_v1 (server-derived owner);
--   4. the row invariant on public.hypotheses: an evidence link is removed ONLY together with a matching record
--      of WITHDRAWN links, one version step, no status / competitor change and no link added (CC-1);
--   5. reevaluate_withdrawn_hypothesis_evidence_core_v1 + background_reevaluate_withdrawn_hypothesis_evidence_v1: the
--      fail-soft housekeeping (CC-4) - detach WITHDRAWN links, version + 1, the record, the same-transaction
--      exact-version Confidence through the unchanged background_create_confidence_evaluation_v1. It decides nothing:
--      reliance is identical before and after it;
--   6. select_formal_question_opportunity_v1 redefined (CC-3): the 0063 body verbatim plus exactly three reliance
--      lines - a new candidate, the same-turn SELECTED re-return and the BOUND "outstanding" check all require NONE;
--   7. the bind-time guard on formal_question_turn_bindings SELECTED -> BOUND (CC-3): it locks the Hypothesis row and
--      its linked Memory rows FOR SHARE (in id order), evaluates reliance on committed state and refuses a withheld
--      binding with 42501 QUESTION_BINDING_RELIANCE_WITHHELD - the same SQLSTATE family as finalize v2's own
--      INVALID_QUESTION_BINDING, never 40001 and never PT409, so the PROD-RETRY-01 census is untouched. The whole
--      finalization rolls back, no assistant turn is committed or returned, and the existing release trigger frees the
--      reservation when the orchestrator fails the turn.
--
-- ## What is not changed
--
-- No status is ever written (REJECTED / RETIRED never appear, so 0134 never fires); the Confidence core (0006 / 0028),
-- Memory control (0128), PG-01 contests (0127 / 0134), the export and the erasure bodies (0130), the canonical Evidence
-- projection (0028), finalize_conversation_turn_v2 (0063) and every historical migration are untouched. No provider,
-- no queue, no retry loop and no new lifecycle state or Confidence category exist here.
--
-- Additive and forward-only. Migrations 0001-0150 are untouched; 0151 is the new terminal migration.
BEGIN;

-- 1. L1 - Memory standing, by linked id. The id parse is total and case-insensitive (attach admits a mixed-case uuid);
--    anything that is not a memory:<uuid> names no row and is OTHER.
CREATE FUNCTION public.personal_evidence_memory_id_v1(p_evidence_id text)
RETURNS uuid LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
  SELECT CASE WHEN p_evidence_id ~* '^memory:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN substring(p_evidence_id FROM 8)::uuid END
$$;

CREATE FUNCTION public.personal_evidence_ids_valid_v1(p_evidence_ids text[])
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
  SELECT p_evidence_ids IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM unnest(p_evidence_ids) AS link WHERE public.personal_evidence_memory_id_v1(link) IS NULL)
$$;

CREATE FUNCTION public.personal_evidence_standing_v1(p_user_id uuid, p_evidence_id text, p_now timestamptz)
RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT coalesce((
    SELECT CASE
      WHEN m.status IN ('DELETED','DISABLED') THEN 'WITHDRAWN'
      WHEN m.status = 'SUPERSEDED' THEN 'CORRECTED'
      WHEN m.status = 'EXPIRED' OR (m.expires_at IS NOT NULL AND m.expires_at <= p_now) THEN 'LAPSED'
      WHEN m.status = 'ACTIVE' AND m.source IN ('USER_STATED','USER_CONFIRMED') AND m.type <> 'DERIVED_INSIGHT' THEN 'CURRENT'
      ELSE 'OTHER' END
      FROM public.memories m
     WHERE m.user_id = p_user_id AND m.id = public.personal_evidence_memory_id_v1(p_evidence_id)), 'OTHER')
$$;

-- 2. The immutable withdrawal record. One row per detachment step of one Hypothesis; the composite FK keeps owner and
--    Hypothesis together and CASCADEs with the governed erasure (0130 enumerates its tables and marks a RESTRICT
--    violation BLOCKED, so CASCADE is what keeps the 0130 body unchanged - the 0126 / 0127 precedent).
CREATE TABLE public.hypothesis_evidence_withdrawal_reevaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  hypothesis_id uuid NOT NULL,
  before_version integer NOT NULL,
  after_version integer NOT NULL,
  detached_supporting_evidence_ids text[] NOT NULL,
  detached_contradicting_evidence_ids text[] NOT NULL,
  confidence_evaluation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT hypothesis_evidence_withdrawal_hypothesis_owner_fk FOREIGN KEY (hypothesis_id, user_id)
    REFERENCES public.hypotheses (id, user_id) ON DELETE CASCADE,
  CONSTRAINT hypothesis_evidence_withdrawal_one_step_per_version UNIQUE (hypothesis_id, before_version),
  CONSTRAINT hypothesis_evidence_withdrawal_confidence_evaluation_key UNIQUE (confidence_evaluation_id),
  CONSTRAINT hypothesis_evidence_withdrawal_version_step_check CHECK (before_version > 0 AND after_version = before_version + 1),
  CONSTRAINT hypothesis_evidence_withdrawal_links_check CHECK (
    public.bounded_nonempty_text_array(detached_supporting_evidence_ids, 32, 64)
    AND public.bounded_nonempty_text_array(detached_contradicting_evidence_ids, 32, 64)
    AND cardinality(detached_supporting_evidence_ids) + cardinality(detached_contradicting_evidence_ids) >= 1
    AND NOT (detached_supporting_evidence_ids && detached_contradicting_evidence_ids)
    AND public.personal_evidence_ids_valid_v1(detached_supporting_evidence_ids || detached_contradicting_evidence_ids)
  )
);
CREATE INDEX hypothesis_evidence_withdrawal_owner_idx ON public.hypothesis_evidence_withdrawal_reevaluations (user_id, hypothesis_id);

CREATE FUNCTION public.guard_hypothesis_evidence_withdrawal_reevaluation_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  -- The governed Personal erasure alone may DELETE (0130's rule, by the same two checks); nothing ever UPDATEs.
  IF TG_OP = 'DELETE' THEN
    IF pg_catalog.current_setting('qandeel.personal_erasure', true) = pg_catalog.txid_current()::text THEN
      IF personal_data_private.personal_erasure_authorized_v1() THEN RETURN OLD; END IF;
    END IF;
  END IF;
  RAISE EXCEPTION 'HYPOTHESIS_EVIDENCE_WITHDRAWAL_RECORD_IS_IMMUTABLE' USING ERRCODE='55000',
    DETAIL='A withdrawal record is durable provenance: it is never rewritten, and only the governed Personal erasure removes it.';
END;$$;
CREATE TRIGGER hypothesis_evidence_withdrawal_reevaluations_immutable
  BEFORE UPDATE OR DELETE ON public.hypothesis_evidence_withdrawal_reevaluations
  FOR EACH ROW EXECUTE FUNCTION public.guard_hypothesis_evidence_withdrawal_reevaluation_v1();

ALTER TABLE public.hypothesis_evidence_withdrawal_reevaluations OWNER TO postgres;
ALTER TABLE public.hypothesis_evidence_withdrawal_reevaluations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hypothesis_evidence_withdrawal_reevaluations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.hypothesis_evidence_withdrawal_reevaluations TO authenticated;
CREATE POLICY hypothesis_evidence_withdrawal_reevaluations_select_own ON public.hypothesis_evidence_withdrawal_reevaluations
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- 3. L3 - reliance. Evaluated on the arrays the caller holds (the current row, or the row a lock just pinned).
CREATE FUNCTION public.hypothesis_evidence_change_core_v1(
  p_user_id uuid, p_hypothesis_id uuid, p_supporting text[], p_contradicting text[], p_now timestamptz
) RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
  WITH links AS MATERIALIZED (
    SELECT 'SUPPORTING'::text AS role, public.personal_evidence_standing_v1(p_user_id, link, p_now) AS standing
      FROM unnest(coalesce(p_supporting, '{}'::text[])) AS link
    UNION ALL
    SELECT 'CONTRADICTING'::text, public.personal_evidence_standing_v1(p_user_id, link, p_now)
      FROM unnest(coalesce(p_contradicting, '{}'::text[])) AS link
  ), recorded AS MATERIALIZED (
    SELECT r.detached_supporting_evidence_ids
      FROM public.hypothesis_evidence_withdrawal_reevaluations r
     WHERE r.user_id = p_user_id AND r.hypothesis_id = p_hypothesis_id
  ), facts AS (
    SELECT
      (EXISTS (SELECT 1 FROM recorded) OR EXISTS (SELECT 1 FROM links l WHERE l.standing IN ('WITHDRAWN','CORRECTED'))) AS tainted,
      (cardinality(coalesce(p_supporting, '{}'::text[])) > 0
        OR EXISTS (SELECT 1 FROM recorded r WHERE cardinality(r.detached_supporting_evidence_ids) > 0)) AS had_support,
      EXISTS (SELECT 1 FROM links l WHERE l.role = 'SUPPORTING' AND l.standing = 'CURRENT') AS current_support
  )
  SELECT CASE
    WHEN f.had_support AND NOT f.current_support THEN 'NO_REMAINING_SUPPORT'
    WHEN f.tainted THEN 'REVIEW_PENDING'
    ELSE 'NONE' END
    FROM facts f
$$;

-- Whether an owned Hypothesis may be relied on now. A missing or foreign Hypothesis is never usable.
CREATE FUNCTION public.hypothesis_reliance_usable_v1(p_user_id uuid, p_hypothesis_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT coalesce((
    SELECT public.hypothesis_evidence_change_core_v1(h.user_id, h.id, h.supporting_evidence_ids, h.contradicting_evidence_ids, CURRENT_TIMESTAMP) = 'NONE'
      FROM public.hypotheses h WHERE h.id = p_hypothesis_id AND h.user_id = p_user_id), false)
$$;

-- The authenticated read: the caller's own Hypotheses only (auth-derived owner), version-pinned. An unknown or foreign
-- id yields no row, which every consumer treats as not usable.
CREATE FUNCTION public.hypothesis_evidence_reliance_v1(p_hypothesis_ids uuid[])
RETURNS TABLE (hypothesis_id uuid, hypothesis_version integer, evidence_change text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  caller uuid := (SELECT auth.uid());
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_hypothesis_ids IS NULL OR cardinality(p_hypothesis_ids) > 32 OR array_position(p_hypothesis_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_HYPOTHESIS_RELIANCE_REQUEST' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
    SELECT h.id, h.version,
           public.hypothesis_evidence_change_core_v1(h.user_id, h.id, h.supporting_evidence_ids, h.contradicting_evidence_ids, CURRENT_TIMESTAMP)
      FROM public.hypotheses h
     WHERE h.user_id = caller AND h.id = ANY (p_hypothesis_ids)
     ORDER BY h.id;
END;$$;

-- The background twin: the owner is the authority-issued execution context's, never a client's.
CREATE FUNCTION public.background_hypothesis_evidence_reliance_v1(p_user_id uuid, p_hypothesis_ids uuid[])
RETURNS TABLE (hypothesis_id uuid, hypothesis_version integer, evidence_change text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF p_user_id IS NULL OR p_hypothesis_ids IS NULL OR cardinality(p_hypothesis_ids) > 32 OR array_position(p_hypothesis_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_HYPOTHESIS_RELIANCE_REQUEST' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
    SELECT h.id, h.version,
           public.hypothesis_evidence_change_core_v1(h.user_id, h.id, h.supporting_evidence_ids, h.contradicting_evidence_ids, CURRENT_TIMESTAMP)
      FROM public.hypotheses h
     WHERE h.user_id = p_user_id AND h.id = ANY (p_hypothesis_ids)
     ORDER BY h.id;
END;$$;

-- 4. The row invariant (CC-1): every existing writer only APPENDS a link (0005, 0008, 0021, 0028, 0032, 0150), so a
--    removal is legal only as the recorded withdrawal step - the record for exactly this version step names exactly
--    the removed links, every removed link is WITHDRAWN, nothing is added, and status, owner and competitors stay.
CREATE FUNCTION public.guard_hypothesis_evidence_link_removal_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  removed_supporting text[] := ARRAY(SELECT link FROM unnest(OLD.supporting_evidence_ids) AS link WHERE NOT (link = ANY (NEW.supporting_evidence_ids)));
  removed_contradicting text[] := ARRAY(SELECT link FROM unnest(OLD.contradicting_evidence_ids) AS link WHERE NOT (link = ANY (NEW.contradicting_evidence_ids)));
  recorded public.hypothesis_evidence_withdrawal_reevaluations;
BEGIN
  SELECT * INTO recorded FROM public.hypothesis_evidence_withdrawal_reevaluations r
   WHERE r.hypothesis_id = OLD.id AND r.user_id = OLD.user_id AND r.before_version = OLD.version;
  IF NOT FOUND
     OR NEW.version <> OLD.version + 1 OR recorded.after_version <> NEW.version
     OR NEW.status <> OLD.status OR NEW.user_id <> OLD.user_id
     OR NEW.competing_hypothesis_ids <> OLD.competing_hypothesis_ids
     OR NOT (NEW.supporting_evidence_ids <@ OLD.supporting_evidence_ids AND NEW.contradicting_evidence_ids <@ OLD.contradicting_evidence_ids)
     OR NOT (removed_supporting <@ recorded.detached_supporting_evidence_ids AND recorded.detached_supporting_evidence_ids <@ removed_supporting)
     OR NOT (removed_contradicting <@ recorded.detached_contradicting_evidence_ids AND recorded.detached_contradicting_evidence_ids <@ removed_contradicting)
     OR EXISTS (SELECT 1 FROM unnest(removed_supporting || removed_contradicting) AS link
                 WHERE public.personal_evidence_standing_v1(OLD.user_id, link, CURRENT_TIMESTAMP) <> 'WITHDRAWN')
  THEN
    RAISE EXCEPTION 'HYPOTHESIS_EVIDENCE_LINK_REMOVAL_REQUIRES_RECORDED_WITHDRAWAL' USING ERRCODE='42501',
      DETAIL='An evidence link leaves a Hypothesis only through the recorded withdrawal re-evaluation of INTEL-TM-01.';
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER hypotheses_evidence_link_removal_guard
  BEFORE UPDATE OF supporting_evidence_ids, contradicting_evidence_ids ON public.hypotheses
  FOR EACH ROW
  WHEN (NOT (OLD.supporting_evidence_ids <@ NEW.supporting_evidence_ids AND OLD.contradicting_evidence_ids <@ NEW.contradicting_evidence_ids))
  EXECUTE FUNCTION public.guard_hypothesis_evidence_link_removal_v1();

-- 5. The housekeeping (CC-4). Pending work is DERIVED from committed facts on every call (links naming a WITHDRAWN
--    Memory), never queued, so a lost, late or duplicated event can neither lose nor fabricate work. At most 32
--    Hypotheses per call, in id order; each is locked FOR UPDATE and its WITHDRAWN links are re-derived under the lock,
--    so a concurrent duplicate waits and then finds nothing to do. Record, detach, version + 1 and the exact-version
--    Confidence of the new version commit or roll back together. No status, statement or Confidence semantics change.
CREATE FUNCTION public.reevaluate_withdrawn_hypothesis_evidence_core_v1(p_user_id uuid, p_limit integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  candidate uuid;
  target public.hypotheses;
  detached_supporting text[];
  detached_contradicting text[];
  evaluation_id uuid;
  evaluation public.confidence_evaluations;
  reevaluated integer := 0;
BEGIN
  IF p_user_id IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 32 THEN
    RAISE EXCEPTION 'INVALID_PERSONAL_EVIDENCE_REEVALUATION' USING ERRCODE='22023';
  END IF;
  FOR candidate IN
    SELECT h.id FROM public.hypotheses h
     WHERE h.user_id = p_user_id
       AND EXISTS (SELECT 1 FROM unnest(h.supporting_evidence_ids || h.contradicting_evidence_ids) AS link
                    WHERE public.personal_evidence_standing_v1(p_user_id, link, CURRENT_TIMESTAMP) = 'WITHDRAWN')
     ORDER BY h.id
     LIMIT p_limit
  LOOP
    SELECT * INTO target FROM public.hypotheses h WHERE h.id = candidate AND h.user_id = p_user_id FOR UPDATE;
    CONTINUE WHEN NOT FOUND;
    detached_supporting := ARRAY(
      SELECT l.link FROM unnest(target.supporting_evidence_ids) WITH ORDINALITY AS l(link, ordinal)
       WHERE public.personal_evidence_standing_v1(p_user_id, l.link, CURRENT_TIMESTAMP) = 'WITHDRAWN' ORDER BY l.ordinal);
    detached_contradicting := ARRAY(
      SELECT l.link FROM unnest(target.contradicting_evidence_ids) WITH ORDINALITY AS l(link, ordinal)
       WHERE public.personal_evidence_standing_v1(p_user_id, l.link, CURRENT_TIMESTAMP) = 'WITHDRAWN' ORDER BY l.ordinal);
    CONTINUE WHEN cardinality(detached_supporting) + cardinality(detached_contradicting) = 0;
    evaluation_id := gen_random_uuid();
    INSERT INTO public.hypothesis_evidence_withdrawal_reevaluations (
      user_id, hypothesis_id, before_version, after_version,
      detached_supporting_evidence_ids, detached_contradicting_evidence_ids, confidence_evaluation_id)
    VALUES (p_user_id, target.id, target.version, target.version + 1, detached_supporting, detached_contradicting, evaluation_id);
    UPDATE public.hypotheses h
       SET supporting_evidence_ids = ARRAY(
             SELECT l.link FROM unnest(target.supporting_evidence_ids) WITH ORDINALITY AS l(link, ordinal)
              WHERE NOT (l.link = ANY (detached_supporting)) ORDER BY l.ordinal),
           contradicting_evidence_ids = ARRAY(
             SELECT l.link FROM unnest(target.contradicting_evidence_ids) WITH ORDINALITY AS l(link, ordinal)
              WHERE NOT (l.link = ANY (detached_contradicting)) ORDER BY l.ordinal),
           version = target.version + 1,
           updated_at = CURRENT_TIMESTAMP
     WHERE h.id = target.id;
    SELECT * INTO evaluation FROM public.background_create_confidence_evaluation_v1(p_user_id, evaluation_id, target.id, target.version + 1);
    IF evaluation.id IS DISTINCT FROM evaluation_id OR evaluation.target_version IS DISTINCT FROM target.version + 1 THEN
      RAISE EXCEPTION 'PERSONAL_EVIDENCE_REEVALUATION_INTEGRITY' USING ERRCODE='55000';
    END IF;
    reevaluated := reevaluated + 1;
  END LOOP;
  RETURN reevaluated;
END;$$;

CREATE FUNCTION public.background_reevaluate_withdrawn_hypothesis_evidence_v1(p_user_id uuid, p_limit integer DEFAULT 32)
RETURNS integer LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
  SELECT public.reevaluate_withdrawn_hypothesis_evidence_core_v1(p_user_id, p_limit)
$$;

-- 6. The QIR-006 selection command, redefined (CC-3). The body is migration 0063's, byte for byte, except for the
--    three lines marked "INTEL-TM-01 (0151)": a withheld Hypothesis is never a new candidate, a reservation whose
--    Hypothesis became withheld is never re-offered to the same turn (NO_ELIGIBLE_GAP, the row untouched - the
--    existing trigger releases it when the turn leaves GENERATING), and a BOUND question on a withheld Hypothesis
--    stays BOUND as history but no longer blocks the session. Signature, owner, SECURITY DEFINER, search_path and
--    grants are unchanged.
CREATE OR REPLACE FUNCTION public.select_formal_question_opportunity_v1(
  p_user_id uuid, p_session_id uuid, p_source_turn_id uuid
) RETURNS TABLE(outcome text, binding_id uuid, question_type text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 source_row public.conversation_turns;
 existing public.formal_question_turn_bindings;
 candidate_gap public.information_gaps;
 candidate_source public.information_gap_confidence_sources;
 derived_question_type text;
 created public.formal_question_turn_bindings;
BEGIN
 IF p_user_id IS NULL OR p_session_id IS NULL OR p_source_turn_id IS NULL THEN
   RAISE EXCEPTION 'INVALID_SELECTION_IDENTITY' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.id=p_session_id AND s.user_id=p_user_id) THEN
   RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 -- Serialize competing selectors of the same session BEFORE reading any
 -- eligibility state, so two concurrent GENERATING turns can never interleave
 -- the outstanding-question checks.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
   'qandeel_formal_question_selection:'||p_user_id::text||':'||p_session_id::text,0));
 -- The source turn must be an owned canonical USER turn, and it must still be
 -- GENERATING. The row lock serializes this command against finalization,
 -- failure, cancellation and expired-generation recovery of the same turn:
 -- whichever commits first wins, and a late selection against an already
 -- terminal turn fails closed with zero durable writes.
 SELECT * INTO source_row FROM public.conversation_turns
   WHERE id=p_source_turn_id AND session_id=p_session_id AND user_id=p_user_id AND role='USER'
   FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF source_row.status<>'GENERATING' THEN RAISE EXCEPTION 'SOURCE_TURN_NOT_GENERATING' USING ERRCODE='22023'; END IF;
 -- Idempotency: one reservation lifecycle per source turn, ever. A legitimate
 -- same-turn retry reuses the live SELECTED reservation. A GENERATING turn
 -- with a terminal reservation is an impossible durable state (release and
 -- binding both commit atomically with the turn leaving GENERATING) and fails
 -- closed.
 SELECT * INTO existing FROM public.formal_question_turn_bindings WHERE source_turn_id=p_source_turn_id;
 IF FOUND THEN
  IF existing.state='SELECTED' THEN
    IF NOT public.hypothesis_reliance_usable_v1(existing.user_id, existing.hypothesis_id) THEN RETURN QUERY SELECT 'NO_ELIGIBLE_GAP'::text, NULL::uuid, NULL::text; RETURN; END IF; -- INTEL-TM-01 (0151)
    RETURN QUERY SELECT 'SELECTED'::text, existing.id, existing.question_type; RETURN;
  END IF;
  RAISE EXCEPTION 'IMPOSSIBLE_QUESTION_RESERVATION_STATE' USING ERRCODE='XX000';
 END IF;
 -- One outstanding formal Question per session: a BOUND reservation whose gap
 -- is still OPEN at the exact bound epoch, or a live SELECTED reservation held
 -- by a concurrent turn, legitimately yields no new selection.
 --
 -- QIR-006 Fix 02 defense in depth: "outstanding" is decided against CANONICAL
 -- CURRENT state, not against the gap row alone. A gap row can legitimately lag
 -- reality - post-response synchronization only reconciles the Hypotheses one
 -- execution's durable receipts name, it can quarantine, and the authenticated
 -- Hypothesis lifecycle commands (transition_hypothesis_v2, the authenticated
 -- Evidence update) advance a version with no post-response execution at all -
 -- so an obviously stale BOUND row
 -- must not block the session merely because its lagging gap still says OPEN.
 -- The added conditions are exactly the authority dimensions selection
 -- eligibility already uses (exact automatic source, current Hypothesis
 -- version, questioning-eligible lifecycle, same-session scope, bound gap
 -- epoch). No heuristic, no content matching, and no second closure engine:
 -- this decides only whether a bound question is still live, and closure itself
 -- remains owned exclusively by the synchronization authority.
 IF EXISTS(
   SELECT 1 FROM public.formal_question_turn_bindings b
    JOIN public.information_gaps g ON g.id=b.information_gap_id
    JOIN public.information_gap_confidence_sources s ON s.information_gap_id=g.id AND s.user_id=g.user_id
    JOIN public.hypotheses h ON h.id=s.hypothesis_id AND h.user_id=g.user_id
   WHERE b.session_id=p_session_id AND b.user_id=p_user_id AND b.state='BOUND'
     AND g.status='OPEN' AND g.open_epoch=b.gap_open_epoch
     AND h.version=s.target_version
     AND public.question_eligible_hypothesis_lifecycle_v1(h.status)
     AND h.scope='CONVERSATION_SESSION:'||p_session_id::text
     AND public.hypothesis_evidence_change_core_v1(h.user_id, h.id, h.supporting_evidence_ids, h.contradicting_evidence_ids, CURRENT_TIMESTAMP)='NONE' -- INTEL-TM-01 (0151)
 ) OR EXISTS(
   SELECT 1 FROM public.formal_question_turn_bindings b
   WHERE b.session_id=p_session_id AND b.user_id=p_user_id AND b.state='SELECTED'
 ) THEN
  RETURN QUERY SELECT 'OUTSTANDING_OPEN_QUESTION'::text, NULL::uuid, NULL::text; RETURN;
 END IF;
 -- The canonical eligible target, derived entirely from owned durable state.
 SELECT g.* INTO candidate_gap
  FROM public.information_gaps g
  JOIN public.information_gap_confidence_sources s ON s.information_gap_id=g.id AND s.user_id=g.user_id
  JOIN public.hypotheses h ON h.id=s.hypothesis_id AND h.user_id=g.user_id
 WHERE g.user_id=p_user_id
   AND g.status='OPEN'
   AND h.version=s.target_version
   AND public.question_eligible_hypothesis_lifecycle_v1(h.status)
   AND h.scope='CONVERSATION_SESSION:'||p_session_id::text
   AND public.hypothesis_evidence_change_core_v1(h.user_id, h.id, h.supporting_evidence_ids, h.contradicting_evidence_ids, CURRENT_TIMESTAMP)='NONE' -- INTEL-TM-01 (0151)
   AND NOT EXISTS(
     SELECT 1 FROM public.formal_question_turn_bindings b
     WHERE b.information_gap_id=g.id AND b.gap_open_epoch=g.open_epoch AND b.state<>'RELEASED')
 ORDER BY g.created_at ASC, g.id ASC
 LIMIT 1
 FOR UPDATE OF g;
 IF NOT FOUND THEN
  RETURN QUERY SELECT 'NO_ELIGIBLE_GAP'::text, NULL::uuid, NULL::text; RETURN;
 END IF;
 SELECT * INTO candidate_source FROM public.information_gap_confidence_sources WHERE information_gap_id=candidate_gap.id;
 derived_question_type := CASE candidate_source.missing_information_code
   WHEN 'NO_ELIGIBLE_EVIDENCE' THEN 'FACT_FINDING'
   WHEN 'UNVERIFIED_ASSUMPTIONS' THEN 'VALIDATION'
   ELSE 'DISCRIMINATING' END;
 INSERT INTO public.formal_question_turn_bindings(
   user_id,session_id,source_turn_id,information_gap_id,gap_open_epoch,
   hypothesis_id,hypothesis_version,missing_information_code,question_type)
 VALUES(
   p_user_id,p_session_id,p_source_turn_id,candidate_gap.id,candidate_gap.open_epoch,
   candidate_source.hypothesis_id,candidate_source.target_version,candidate_source.missing_information_code,derived_question_type)
 RETURNING * INTO created;
 RETURN QUERY SELECT 'SELECTED'::text, created.id, created.question_type;
END;$$;
ALTER FUNCTION public.select_formal_question_opportunity_v1(uuid,uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.select_formal_question_opportunity_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.select_formal_question_opportunity_v1(uuid,uuid,uuid) TO service_role;

-- 7. The bind-time guard (CC-3). The orchestrator returns a reply only after finalize_conversation_turn_v2 commits
--    (no streaming), so this is the commit point of a formal Question. Lock order: the Hypothesis row FOR SHARE, then
--    its linked Memory rows FOR SHARE in id order. A withdrawal / correction locks only the Memory row and its own turn,
--    and the housekeeping locks only the Hypothesis, so no cycle exists. A withdrawal that committed first, or is in
--    flight, is waited for and then seen; one that comes later waits for this commit and the question was lawfully
--    delivered before it.
CREATE FUNCTION public.guard_formal_question_binding_reliance_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  target public.hypotheses;
BEGIN
  SELECT * INTO target FROM public.hypotheses h WHERE h.id = NEW.hypothesis_id AND h.user_id = NEW.user_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'QUESTION_BINDING_RELIANCE_WITHHELD' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.memories m
   WHERE m.user_id = NEW.user_id
     AND m.id IN (SELECT public.personal_evidence_memory_id_v1(link)
                    FROM unnest(target.supporting_evidence_ids || target.contradicting_evidence_ids) AS link)
   ORDER BY m.id
   FOR SHARE OF m;
  -- A fresh statement, so a fresh READ COMMITTED snapshot taken after every lock above was granted.
  IF NOT public.hypothesis_reliance_usable_v1(NEW.user_id, NEW.hypothesis_id) THEN
    RAISE EXCEPTION 'QUESTION_BINDING_RELIANCE_WITHHELD' USING ERRCODE='42501',
      DETAIL='The reserved Question names a Hypothesis that QANDEEL may not rely on any more; nothing is delivered.';
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER formal_question_turn_binding_reliance_guard
  BEFORE UPDATE ON public.formal_question_turn_bindings
  FOR EACH ROW WHEN (OLD.state = 'SELECTED' AND NEW.state = 'BOUND')
  EXECUTE FUNCTION public.guard_formal_question_binding_reliance_v1();

-- 8. Ownership and privileges, all explicit. Only the three entry points are executable by an application role.
ALTER FUNCTION public.personal_evidence_memory_id_v1(text) OWNER TO postgres;
ALTER FUNCTION public.personal_evidence_ids_valid_v1(text[]) OWNER TO postgres;
ALTER FUNCTION public.personal_evidence_standing_v1(uuid,text,timestamptz) OWNER TO postgres;
ALTER FUNCTION public.guard_hypothesis_evidence_withdrawal_reevaluation_v1() OWNER TO postgres;
ALTER FUNCTION public.hypothesis_evidence_change_core_v1(uuid,uuid,text[],text[],timestamptz) OWNER TO postgres;
ALTER FUNCTION public.hypothesis_reliance_usable_v1(uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.hypothesis_evidence_reliance_v1(uuid[]) OWNER TO postgres;
ALTER FUNCTION public.background_hypothesis_evidence_reliance_v1(uuid,uuid[]) OWNER TO postgres;
ALTER FUNCTION public.guard_hypothesis_evidence_link_removal_v1() OWNER TO postgres;
ALTER FUNCTION public.reevaluate_withdrawn_hypothesis_evidence_core_v1(uuid,integer) OWNER TO postgres;
ALTER FUNCTION public.background_reevaluate_withdrawn_hypothesis_evidence_v1(uuid,integer) OWNER TO postgres;
ALTER FUNCTION public.guard_formal_question_binding_reliance_v1() OWNER TO postgres;

REVOKE ALL ON FUNCTION
  public.personal_evidence_memory_id_v1(text),
  public.personal_evidence_ids_valid_v1(text[]),
  public.personal_evidence_standing_v1(uuid,text,timestamptz),
  public.guard_hypothesis_evidence_withdrawal_reevaluation_v1(),
  public.hypothesis_evidence_change_core_v1(uuid,uuid,text[],text[],timestamptz),
  public.hypothesis_reliance_usable_v1(uuid,uuid),
  public.hypothesis_evidence_reliance_v1(uuid[]),
  public.background_hypothesis_evidence_reliance_v1(uuid,uuid[]),
  public.guard_hypothesis_evidence_link_removal_v1(),
  public.reevaluate_withdrawn_hypothesis_evidence_core_v1(uuid,integer),
  public.background_reevaluate_withdrawn_hypothesis_evidence_v1(uuid,integer),
  public.guard_formal_question_binding_reliance_v1()
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.hypothesis_evidence_reliance_v1(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.background_hypothesis_evidence_reliance_v1(uuid,uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.background_reevaluate_withdrawn_hypothesis_evidence_v1(uuid,integer) TO service_role;

COMMIT;
