-- MEM-AR-01C - Memory Subject Identity, Atomicity & Evidence Protection v1.
--
-- Product authority: the Product Owner's MEM-AR-01 Implementation Task Contract (approved with review corrections,
-- 2026-10-11) and its 01C brief: PD-1 (a Memory is about the user, about someone else, or its subject is not
-- established; never assumed), PD-3 (one equivalent ACTIVE fact per owner, no lineage-less retirement), PD-7 (a
-- clarification answer is the command's, never a new Memory), RD-1 Option B (CC-H1) and the Controlled Changes CC-M1,
-- CC-M2' and CC-M3'. This migration is that slice's database part, and nothing more.
--
-- ## What is added
--
--   1. memory_equivalence_key_v1 - the comparison key of a Memory's words, one-to-one with the 01A TypeScript
--      normalizer `normalizeArabicComparison` (apps/api/src/memory/arabic-text.ts), enumerated by code point only.
--      The frozen 0028 Evidence key is a different function and is untouched.
--   2. memory_subject_attributions - ONE append-only row per Memory saying whom it is about (SELF / OTHER) and on what
--      basis. No row means UNATTRIBUTED: the subject was never established, and such a Memory is never personal Evidence.
--      A row is created only together with its Memory (insert guard), never updated, and removed only with the Memory
--      by the governed Personal erasure.
--   3. memory_equivalence_dispositions - ONE append-only row per Memory a command retired as an equivalent copy of the
--      fact it acted on (CORRECTED / FORGOTTEN / DISABLED / RECONFIRMED), naming that command and the representative.
--   4. The legacy attribution: a pre-0152 Memory becomes SELF only when the background ledger proves the closed
--      first-person capture wrote it (five provenance conditions, no content read). Everything else stays UNATTRIBUTED.
--   5. memory_control_commands shape: the 0128 disjuncts verbatim, plus the subject question, the REMEMBER answers,
--      RECONFIRMED and CORRECTED_TO_EXISTING, and (L-11) the subject question of a correction of an UNATTRIBUTED fact.
--   6. server_finalize_memory_control_turn_v2 - v1's turn, command and answer checks, then the owner equivalence lock,
--      the target and equivalence-class rows locked in id order, the subject outcomes, dispositions and attribution, all
--      in the one transaction that also finalizes the turn.
--   7. background_record_memory_v1 - the ONE background Memory writer: 0072's execution association (RUNNING execution,
--      MEMORY_WRITE CLAIMED, history bound to its Session), then the R2 guard (no write for a turn a Memory command
--      already answered), replay, the owner lock, the stale-capture skip and the equivalence skip, then create +
--      FIRST_PERSON_CAPTURE attribution.
--   8. pending_memory_subject_clarification_v1 - the owner-token read of an unanswered subject question; and (L-11)
--      pending_memory_correction_subject_clarification_v1, its own read for the question a correction asked.
--   9. Controlled Changes: CC-M1 (0028 L2 Step B is SELF-only), CC-M2' (0151 L1 order), CC-M3' (0151 taint set),
--      CC-H1 (0033 completion refuses a validated candidate with no supporting Evidence).
--  10. EXECUTE on the six legacy Memory writers is revoked from service_role. Their bodies are unchanged.
--
-- After this migration the ONLY authorities that can change public.memories are server_finalize_memory_control_turn_v2,
-- background_record_memory_v1 and the governed Personal erasure. No application role holds a write privilege on
-- memories, memory_subject_attributions or memory_equivalence_dispositions.
--
-- ## Lock order (no cycle)
--
--   v2:          source turn FOR UPDATE -> answered command FOR UPDATE -> owner advisory lock -> Memory rows FOR UPDATE
--                in id order (one statement) -> writes.
--   background:  owner advisory lock -> Memory rows FOR UPDATE in id order -> write.
--   Neither locks a Hypothesis; the 0151 bind guard locks a Hypothesis, then Memory rows FOR SHARE in id order.
--
-- Additive and forward-only. Migrations 0001-0151 are untouched; 0152 is the new terminal migration.
BEGIN;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. The equivalence key. Steps, in the TypeScript order:
--      NFKC; tatweel U+0640 and harakat U+064B-U+065F, U+0670 removed; U+0622 U+0623 U+0625 -> U+0627, U+0649 -> U+064A,
--      U+0629 -> U+0647; Arabic-Indic digits U+0660-U+0669 -> 0-9; ASCII A-Z -> a-z; the 25 White_Space code points
--      (U+0009-U+000D U+0020 U+0085 U+00A0 U+1680 U+2000-U+200A U+2028 U+2029 U+202F U+205F U+3000) -> U+0020, runs
--      collapsed, U+0020 trimmed; a terminal run of . ! ? U+061F U+060C , ; U+061B : removed, U+0020 trimmed again.
--    Every character mapping is one translate(): no mapped character maps to a character that is itself mapped, so one
--    pass equals the TypeScript sequence. Nothing depends on a locale or a collation.
-- ---------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.memory_equivalence_key_v1(p_content text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path='' AS $$
  SELECT btrim(regexp_replace(btrim(regexp_replace(
    translate(
      normalize(p_content, NFKC),
      chr(1570)||chr(1571)||chr(1573)||chr(1609)||chr(1577)
        ||chr(1632)||chr(1633)||chr(1634)||chr(1635)||chr(1636)||chr(1637)||chr(1638)||chr(1639)||chr(1640)||chr(1641)
        ||'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        ||chr(9)||chr(10)||chr(11)||chr(12)||chr(13)||chr(32)||chr(133)||chr(160)||chr(5760)
        ||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)
        ||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)
        -- deleted (no counterpart in the target list): tatweel and the harakat
        ||chr(1600)||chr(1611)||chr(1612)||chr(1613)||chr(1614)||chr(1615)||chr(1616)||chr(1617)||chr(1618)||chr(1619)
        ||chr(1620)||chr(1621)||chr(1622)||chr(1623)||chr(1624)||chr(1625)||chr(1626)||chr(1627)||chr(1628)||chr(1629)
        ||chr(1630)||chr(1631)||chr(1648),
      chr(1575)||chr(1575)||chr(1575)||chr(1610)||chr(1607)
        ||'0123456789'
        ||'abcdefghijklmnopqrstuvwxyz'
        ||repeat(' ', 25)
    ),
    ' +', ' ', 'g'), ' '),
    '[.!?' || chr(1567) || chr(1548) || ',;' || chr(1563) || ':]+$', ''), ' ')
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Subject attribution. No row = UNATTRIBUTED. The basis says how the subject was established; the provenance ids
--    are set by the two writers (verified) and carry no FK, so the 0130 erasure order is untouched.
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE public.memory_subject_attributions (
  memory_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  subject text NOT NULL,
  basis text NOT NULL,
  command_id uuid,
  execution_id uuid,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT memory_subject_attributions_memory_fk FOREIGN KEY (memory_id, user_id)
    REFERENCES public.memories (id, user_id) ON DELETE CASCADE,
  CONSTRAINT memory_subject_attributions_subject_check CHECK (subject IN ('SELF','OTHER')),
  CONSTRAINT memory_subject_attributions_basis_check CHECK (basis IN (
    'FIRST_PERSON_CAPTURE','EXPLICIT_STATEMENT','USER_CLARIFIED','CORRECTION_INHERITED','LEGACY_FIRST_PERSON_CAPTURE')),
  -- A capture basis names an execution, a command basis a command; never the other.
  CONSTRAINT memory_subject_attributions_provenance_check CHECK (
    (execution_id IS NULL OR basis IN ('FIRST_PERSON_CAPTURE','LEGACY_FIRST_PERSON_CAPTURE'))
    AND (command_id IS NULL OR basis IN ('EXPLICIT_STATEMENT','USER_CLARIFIED','CORRECTION_INHERITED'))),
  -- A first-person capture is the user's own words: never about someone else.
  CONSTRAINT memory_subject_attributions_capture_self_check CHECK (
    basis NOT IN ('FIRST_PERSON_CAPTURE','LEGACY_FIRST_PERSON_CAPTURE') OR subject = 'SELF')
);
CREATE INDEX memory_subject_attributions_user_idx ON public.memory_subject_attributions (user_id);
CREATE INDEX memory_subject_attributions_execution_idx ON public.memory_subject_attributions (execution_id) WHERE execution_id IS NOT NULL;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Equivalence dispositions: the auditable relation of every equivalent copy a command retired.
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE public.memory_equivalence_dispositions (
  memory_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  command_id uuid NOT NULL,
  primary_memory_id uuid NOT NULL,
  disposition text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT memory_equivalence_dispositions_memory_fk FOREIGN KEY (memory_id, user_id)
    REFERENCES public.memories (id, user_id) ON DELETE CASCADE,
  CONSTRAINT memory_equivalence_dispositions_primary_fk FOREIGN KEY (primary_memory_id, user_id)
    REFERENCES public.memories (id, user_id) ON DELETE CASCADE,
  CONSTRAINT memory_equivalence_dispositions_kind_check CHECK (disposition IN ('CORRECTED','FORGOTTEN','DISABLED','RECONFIRMED')),
  CONSTRAINT memory_equivalence_dispositions_not_self_check CHECK (memory_id <> primary_memory_id)
);
CREATE INDEX memory_equivalence_dispositions_command_idx ON public.memory_equivalence_dispositions (command_id);
CREATE INDEX memory_equivalence_dispositions_user_idx ON public.memory_equivalence_dispositions (user_id);

-- Both records are durable provenance: nothing ever UPDATEs them, and only the governed Personal erasure DELETEs them
-- (the 0130 rule, by the same two checks; 0151 precedent).
CREATE FUNCTION public.guard_memory_provenance_record_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF pg_catalog.current_setting('qandeel.personal_erasure', true) = pg_catalog.txid_current()::text THEN
      IF personal_data_private.personal_erasure_authorized_v1() THEN RETURN OLD; END IF;
    END IF;
  END IF;
  RAISE EXCEPTION 'MEMORY_PROVENANCE_RECORD_IS_IMMUTABLE' USING ERRCODE='55000',
    DETAIL='A Memory subject attribution or equivalence disposition is never rewritten; only the governed Personal erasure removes it.';
END;$$;
CREATE TRIGGER memory_subject_attributions_immutable
  BEFORE UPDATE OR DELETE ON public.memory_subject_attributions
  FOR EACH ROW EXECUTE FUNCTION public.guard_memory_provenance_record_v1();
CREATE TRIGGER memory_equivalence_dispositions_immutable
  BEFORE UPDATE OR DELETE ON public.memory_equivalence_dispositions
  FOR EACH ROW EXECUTE FUNCTION public.guard_memory_provenance_record_v1();

ALTER TABLE public.memory_subject_attributions OWNER TO postgres;
ALTER TABLE public.memory_equivalence_dispositions OWNER TO postgres;
ALTER TABLE public.memory_subject_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_equivalence_dispositions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.memory_subject_attributions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.memory_equivalence_dispositions FROM PUBLIC, anon, authenticated, service_role;
-- Read like public.memories (0026): the owner through RLS, the server REST role for the background read path.
GRANT SELECT ON TABLE public.memory_subject_attributions TO authenticated, service_role;
GRANT SELECT ON TABLE public.memory_equivalence_dispositions TO authenticated, service_role;
CREATE POLICY memory_subject_attributions_select_own ON public.memory_subject_attributions
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY memory_equivalence_dispositions_select_own ON public.memory_equivalence_dispositions
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------------------------------------------
-- 4. The legacy attribution (A1 C1.1), applied ONCE, before the insert guard below exists. A pre-0152 Memory is SELF
--    only when all five provenance conditions hold; no content, type heuristic or default is read:
--      (1) exactly one ledger row names it, and that row is a COMPLETED MEMORY_WRITE / FRESH_EVIDENCE_CREATED effect of
--          an execution of the same owner;
--      (2) it was created inside that effect's claim window;
--      (3) it has the creation-only shape the background evaluator writes (version 1, no predecessor, USER_STATED, not
--          DERIVED_INSIGHT);
--      (4) no Memory command names it as its target or result;
--      (5) the execution's source turn is not a Memory-command turn (a command or clarification-answer turn).
--    `memories`, `hypotheses`, the 0072 history rows and the 0151 withdrawal records are not touched.
-- ---------------------------------------------------------------------------------------------------------------
INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis, execution_id)
SELECT m.id, m.user_id, 'SELF', 'LEGACY_FIRST_PERSON_CAPTURE', e.execution_id
  FROM public.memories m
  JOIN public.post_response_intelligence_effects e
    ON e.result_reference = 'memory:' || lower(m.id::text)
   AND e.effect_key = 'MEMORY_WRITE' AND e.state = 'COMPLETED' AND e.result_code = 'FRESH_EVIDENCE_CREATED'
  JOIN public.post_response_intelligence_executions x ON x.id = e.execution_id AND x.user_id = m.user_id
 WHERE (SELECT count(*) FROM public.post_response_intelligence_effects r WHERE r.result_reference = 'memory:' || lower(m.id::text)) = 1
   AND e.claimed_at <= m.created_at AND m.created_at <= e.completed_at
   AND m.version = 1 AND m.supersedes_memory_id IS NULL AND m.source = 'USER_STATED' AND m.type <> 'DERIVED_INSIGHT'
   AND NOT EXISTS (SELECT 1 FROM public.memory_control_commands c WHERE c.target_memory_id = m.id OR c.result_memory_id = m.id)
   AND NOT EXISTS (SELECT 1 FROM public.memory_control_commands c WHERE c.source_turn_id = x.source_turn_id);

-- ---------------------------------------------------------------------------------------------------------------
-- 5. An attribution is created only WITH its Memory (A1 C2.3): the Memory must be the owner's, ACTIVE and unexpired,
--    named by no Hypothesis link in either role and by no withdrawal record. So no row that already exists - and no row
--    any Hypothesis could already depend on - is ever attributed later, and 0151's monotonicity holds.
-- ---------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.guard_memory_subject_attribution_insert_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NOT EXISTS (
       SELECT 1 FROM public.memories m
        WHERE m.id = NEW.memory_id AND m.user_id = NEW.user_id AND m.status = 'ACTIVE'
          AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP))
     OR EXISTS (
       SELECT 1 FROM public.hypotheses h, unnest(h.supporting_evidence_ids || h.contradicting_evidence_ids) AS link
        WHERE h.user_id = NEW.user_id AND public.personal_evidence_memory_id_v1(link) = NEW.memory_id)
     OR EXISTS (
       SELECT 1 FROM public.hypothesis_evidence_withdrawal_reevaluations r,
              unnest(r.detached_supporting_evidence_ids || r.detached_contradicting_evidence_ids) AS link
        WHERE r.user_id = NEW.user_id AND public.personal_evidence_memory_id_v1(link) = NEW.memory_id)
  THEN
    RAISE EXCEPTION 'MEMORY_SUBJECT_ATTRIBUTION_ONLY_WITH_ITS_MEMORY' USING ERRCODE='42501',
      DETAIL='A subject is recorded only together with the creation of its Memory, never afterwards.';
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER memory_subject_attributions_insert_guard
  BEFORE INSERT ON public.memory_subject_attributions
  FOR EACH ROW EXECUTE FUNCTION public.guard_memory_subject_attribution_insert_v1();

-- ---------------------------------------------------------------------------------------------------------------
-- 6. The command shapes: the 0128 disjuncts verbatim, then the MEM-AR-01C ones (A1 C3.2). Every existing row satisfies
--    an unchanged disjunct.
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.memory_control_commands DROP CONSTRAINT memory_control_commands_shape_check;
ALTER TABLE public.memory_control_commands ADD CONSTRAINT memory_control_commands_shape_check CHECK (
    (kind='INSPECT' AND outcome IN ('INSPECTED','NOTHING_REMEMBERED')
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NULL)
    OR (kind='REMEMBER' AND outcome='REMEMBERED'
      AND target_memory_id IS NULL AND result_memory_id IS NOT NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NULL)
    OR (kind='REMEMBER' AND outcome IN ('ALREADY_REMEMBERED','DECLINED_SENSITIVE')
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NULL)
    OR (kind='CORRECT' AND outcome='CORRECTED'
      AND target_memory_id IS NOT NULL AND result_memory_id IS NOT NULL AND cardinality(candidate_memory_ids)=0)
    OR (kind='CORRECT' AND outcome IN ('ALREADY_CORRECT','DECLINED_SENSITIVE')
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0)
    OR (kind IN ('FORGET','DISABLE') AND outcome IN ('FORGOTTEN','DISABLED')
      AND outcome=CASE kind WHEN 'FORGET' THEN 'FORGOTTEN' ELSE 'DISABLED' END
      AND target_memory_id IS NOT NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0)
    OR (kind IN ('FORGET','DISABLE') AND outcome IN ('TARGET_NOT_FOUND','TARGET_NOT_SPECIFIED')
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NULL)
    OR (kind IN ('CORRECT','FORGET','DISABLE') AND outcome='CLARIFICATION_REQUIRED'
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids) BETWEEN 1 AND 3)
    OR (kind IN ('CORRECT','FORGET','DISABLE') AND outcome='TARGET_CHANGED'
      AND target_memory_id IS NOT NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0)
    OR (kind IN ('CORRECT','FORGET','DISABLE') AND outcome='CLARIFICATION_DECLINED'
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NOT NULL)
    -- MEM-AR-01C (0152)
    OR (kind='REMEMBER' AND outcome='SUBJECT_CLARIFICATION_REQUIRED'
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NULL)
    OR (kind='REMEMBER' AND outcome='REMEMBERED'
      AND target_memory_id IS NULL AND result_memory_id IS NOT NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NOT NULL)
    OR (kind='REMEMBER' AND outcome='ALREADY_REMEMBERED'
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NOT NULL)
    OR (kind='REMEMBER' AND outcome='RECONFIRMED'
      AND target_memory_id IS NOT NULL AND result_memory_id IS NOT NULL AND cardinality(candidate_memory_ids)=0)
    OR (kind='REMEMBER' AND outcome='CLARIFICATION_DECLINED'
      AND target_memory_id IS NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0 AND answers_command_id IS NOT NULL)
    OR (kind='CORRECT' AND outcome='CORRECTED_TO_EXISTING'
      AND target_memory_id IS NOT NULL AND result_memory_id IS NOT NULL AND cardinality(candidate_memory_ids)=0)
    -- L-11 (Product Owner, 2026-10-12): the subject question of a correction names the exact fact it would correct.
    OR (kind='CORRECT' AND outcome='SUBJECT_CLARIFICATION_REQUIRED'
      AND target_memory_id IS NOT NULL AND result_memory_id IS NULL AND cardinality(candidate_memory_ids)=0)
);

-- ---------------------------------------------------------------------------------------------------------------
-- 7. Internal authorities. No application role can execute any of them.
-- ---------------------------------------------------------------------------------------------------------------

-- The status-only supersede: an ACTIVE row becomes SUPERSEDED with no successor row. Called only by v2, and only for a
-- row that v2 also records as a CORRECTED_TO_EXISTING target or an equivalence disposition (the lineage invariant).
CREATE FUNCTION public.memory_status_only_supersede_v1(p_user_id uuid, p_memory_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  UPDATE public.memories m SET status='SUPERSEDED', updated_at=CURRENT_TIMESTAMP
   WHERE m.id = p_memory_id AND m.user_id = p_user_id AND m.status = 'ACTIVE';
  RETURN FOUND;
END;$$;

-- The owner's equivalence lock. Every Memory writer takes it before locking any Memory row; a hash collision between
-- two owners only serializes them.
CREATE FUNCTION public.memory_equivalence_lock_v1(p_user_id uuid)
RETURNS void LANGUAGE sql VOLATILE SET search_path='' AS $$
  SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qandeel:memory-equivalence:' || p_user_id::text, 0))
$$;

-- The subject a Memory was attributed with, or NULL (UNATTRIBUTED).
CREATE FUNCTION public.memory_subject_v1(p_user_id uuid, p_memory_id uuid)
RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT a.subject FROM public.memory_subject_attributions a WHERE a.memory_id = p_memory_id AND a.user_id = p_user_id
$$;

-- Retires one equivalent copy for a command, with its disposition. Status first, then the record; a copy that is no
-- longer in a state the disposition can describe is left alone.
CREATE FUNCTION public.memory_dispose_equivalent_v1(
  p_user_id uuid, p_memory_id uuid, p_command_id uuid, p_primary_memory_id uuid, p_disposition text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE copy public.memories; done boolean := false;
BEGIN
  SELECT * INTO copy FROM public.memories m WHERE m.id = p_memory_id AND m.user_id = p_user_id;
  IF NOT FOUND OR p_memory_id = p_primary_memory_id
     OR EXISTS (SELECT 1 FROM public.memory_equivalence_dispositions d WHERE d.memory_id = p_memory_id) THEN
    RETURN false;
  END IF;
  IF p_disposition IN ('CORRECTED','RECONFIRMED') THEN
    done := public.memory_status_only_supersede_v1(p_user_id, p_memory_id);
  ELSIF p_disposition = 'FORGOTTEN' THEN
    IF copy.status IN ('ACTIVE','DISABLED') THEN
      PERFORM 1 FROM public.server_mark_memory_deleted_v1(p_user_id, p_memory_id);
      done := true;
    END IF;
  ELSIF p_disposition = 'DISABLED' THEN
    done := EXISTS (SELECT 1 FROM public.server_disable_memory_v1(p_user_id, p_memory_id) d WHERE d.status = 'DISABLED')
            AND copy.status = 'ACTIVE';
  ELSE
    RAISE EXCEPTION 'INVALID_MEMORY_DISPOSITION' USING ERRCODE='22023';
  END IF;
  IF done THEN
    INSERT INTO public.memory_equivalence_dispositions (memory_id, user_id, command_id, primary_memory_id, disposition)
    VALUES (p_memory_id, p_user_id, p_command_id, p_primary_memory_id, p_disposition);
  END IF;
  RETURN done;
END;$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 8. The owner-token read of the subject question the IMMEDIATELY preceding user turn of this Session received and
--    nobody answered, with that question turn's words (what is stored comes from them, never from the answer).
--    SECURITY INVOKER: RLS keeps it to the caller's own rows. A subject question is never asked again, so there is no
--    re-ask chain. The 0128 read is untouched.
-- ---------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.pending_memory_subject_clarification_v1(p_session_id uuid, p_source_turn_id uuid)
RETURNS TABLE(command_id uuid, clarified_turn_content text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  WITH current_turn AS (
    SELECT t.id, t.session_id, t.created_at FROM public.conversation_turns t
     WHERE t.id=p_source_turn_id AND t.session_id=p_session_id AND t.role='USER'
  ), previous_turn AS (
    SELECT t.id, t.content FROM public.conversation_turns t, current_turn cur
     WHERE t.session_id=cur.session_id AND t.role='USER' AND t.status<>'CANCELLED' AND t.id<>cur.id
       AND (t.created_at, t.id) < (cur.created_at, cur.id)
     ORDER BY t.created_at DESC, t.id DESC LIMIT 1
  )
  SELECT c.id, p.content
    FROM public.memory_control_commands c JOIN previous_turn p ON p.id=c.source_turn_id
   WHERE c.session_id=p_session_id AND c.kind='REMEMBER' AND c.outcome='SUBJECT_CLARIFICATION_REQUIRED'
     AND NOT EXISTS (SELECT 1 FROM public.memory_control_commands a WHERE a.answers_command_id=c.id)
$$;

-- L-11 (Product Owner, 2026-10-12): the subject question a CORRECTION asked - a correction of an UNATTRIBUTED fact whose
-- new value is already remembered with an established subject - read on its own, never through the REMEMBER read
-- above. It returns the exact fact the correction names and the words of the request that asked for the correction: a
-- correction chosen by answering "which one?" keeps the words of the request that first asked, as 0128's read does.
-- SECURITY INVOKER: RLS keeps it to the caller's own rows. It is never asked again, so it has no re-ask chain of its own.
CREATE FUNCTION public.pending_memory_correction_subject_clarification_v1(p_session_id uuid, p_source_turn_id uuid)
RETURNS TABLE(command_id uuid, target_memory_id uuid, clarified_turn_content text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  WITH RECURSIVE current_turn AS (
    SELECT t.id, t.session_id, t.created_at FROM public.conversation_turns t
     WHERE t.id=p_source_turn_id AND t.session_id=p_session_id AND t.role='USER'
  ), previous_turn AS (
    SELECT t.id FROM public.conversation_turns t, current_turn cur
     WHERE t.session_id=cur.session_id AND t.role='USER' AND t.status<>'CANCELLED' AND t.id<>cur.id
       AND (t.created_at, t.id) < (cur.created_at, cur.id)
     ORDER BY t.created_at DESC, t.id DESC LIMIT 1
  ), pending AS (
    SELECT c.id, c.target_memory_id, c.answers_command_id, c.source_turn_id
      FROM public.memory_control_commands c JOIN previous_turn p ON p.id=c.source_turn_id
     WHERE c.session_id=p_session_id AND c.kind='CORRECT' AND c.outcome='SUBJECT_CLARIFICATION_REQUIRED'
       AND NOT EXISTS (SELECT 1 FROM public.memory_control_commands a WHERE a.answers_command_id=c.id)
  ), origin AS (
    SELECT pd.answers_command_id, pd.source_turn_id, 0 AS depth FROM pending pd
    UNION ALL
    SELECT c.answers_command_id, c.source_turn_id, o.depth + 1
      FROM public.memory_control_commands c JOIN origin o ON c.id=o.answers_command_id
     WHERE o.depth < 16
  )
  SELECT pd.id, pd.target_memory_id, t.content
    FROM pending pd, origin o JOIN public.conversation_turns t ON t.id=o.source_turn_id
   WHERE o.answers_command_id IS NULL
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 9. The ONE atomic foreground command, v2.
--
-- The caller is trusted server code and decides the INTENDED outcome from its own owner-scoped read; the database
-- re-decides under its locks and may commit a different outcome, which it never takes from the caller:
--   * TARGET_CHANGED (as v1): the target no longer qualifies; p_reply_if_changed.
--   * REMEMBER: ALREADY_REMEMBERED when an equivalent fact with the same subject is ACTIVE (p_reply_if_existing);
--     RECONFIRMED when only UNATTRIBUTED equivalents are (the lowest id is superseded by the new attributed Memory,
--     the others retired with a RECONFIRMED disposition; p_reply); otherwise REMEMBERED (p_reply).
--   * CORRECT: CORRECTED_TO_EXISTING when the replacement already exists with the successor's subject (the target is
--     superseded status-only, the result is the retained Memory; p_reply_if_existing); otherwise CORRECTED (p_reply).
--   * FORGET / DISABLE / CORRECT also retire every equivalent copy of the target (legacy duplicate pairs) with a
--     disposition naming this command and the target.
-- Equivalent: same owner, same type, same memory_equivalence_key_v1, ACTIVE and unexpired (FORGET also takes DISABLED
-- copies), and a compatible subject (equal, or one side UNATTRIBUTED); a correction's equivalents never include its
-- target. p_equivalent_memory_id is the equivalent the caller found itself (it also compares the frozen pre-01A
-- template form, which is not this key); the database accepts it only if it is the owner's, ACTIVE, unexpired and of
-- the same type.
-- Subject: p_subject is the subject screen's decisive answer (SELF / OTHER). A REMEMBER needs one (basis
-- EXPLICIT_STATEMENT, or USER_CLARIFIED when it answers the subject question). A CORRECT without one inherits its
-- target's subject under the row lock (CORRECTION_INHERITED); an UNATTRIBUTED target gives an UNATTRIBUTED successor.
-- L-11 (Product Owner, 2026-10-12): no cross-subject correction by inference. An undecided correction of an UNATTRIBUTED
-- fact never resolves into a Memory whose subject is established: the server asks the subject question instead
-- (SUBJECT_CLARIFICATION_REQUIRED, CORRECT, naming the UNATTRIBUTED target), and if such a Memory appears under the
-- lock all the same, nothing changes (TARGET_CHANGED). The answer is CORRECTED with the confirmed subject (basis
-- USER_CLARIFIED) for exactly the fact the question named, or CLARIFICATION_DECLINED.
-- ---------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_finalize_memory_control_turn_v2(
  p_session_id uuid, p_user_id uuid, p_source_turn_id uuid, p_assistant_turn_id uuid,
  p_kind text, p_outcome text,
  p_target_memory_id uuid, p_new_memory_id uuid,
  p_type text, p_content text, p_confidence double precision, p_importance double precision, p_expires_at timestamptz,
  p_candidate_memory_ids uuid[], p_answers_command_id uuid,
  p_subject text, p_equivalent_memory_id uuid,
  p_reply text, p_reply_if_changed text, p_reply_if_existing text,
  p_event_id uuid, p_correlation_id uuid DEFAULT NULL, p_orchestration_id uuid DEFAULT NULL
) RETURNS TABLE(outcome text, user_turn jsonb, assistant_turn jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  source_row public.conversation_turns;
  previous_user_turn_id uuid;
  pending public.memory_control_commands;
  new_command_id uuid := gen_random_uuid();
  target public.memories;
  hint public.memories;
  retained public.memories;
  reconfirmed public.memories;
  changed public.memories;
  member record;
  applied text := p_outcome;
  reply text := p_reply;
  result_id uuid;
  recorded_target uuid;
  candidates uuid[] := coalesce(p_candidate_memory_ids, '{}');
  successor_subject text;
  successor_basis text;
  target_subject text;
  new_key text;
  target_key text;
  equivalents uuid[] := '{}';
  finalized_user jsonb;
  finalized_assistant jsonb;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL OR p_source_turn_id IS NULL OR p_assistant_turn_id IS NULL OR p_event_id IS NULL
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_IDENTITY' USING ERRCODE='22023'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('INSPECT','REMEMBER','CORRECT','FORGET','DISABLE') THEN
    RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_KIND' USING ERRCODE='22023'; END IF;
  -- TARGET_CHANGED, ALREADY_REMEMBERED, RECONFIRMED and CORRECTED_TO_EXISTING are decided here, never requested.
  IF p_outcome IS NULL OR p_outcome NOT IN (
    'INSPECTED','NOTHING_REMEMBERED','REMEMBERED','DECLINED_SENSITIVE','CORRECTED','ALREADY_CORRECT',
    'FORGOTTEN','DISABLED','TARGET_NOT_FOUND','TARGET_NOT_SPECIFIED','CLARIFICATION_REQUIRED','CLARIFICATION_DECLINED',
    'SUBJECT_CLARIFICATION_REQUIRED')
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_OUTCOME' USING ERRCODE='22023'; END IF;
  IF p_reply IS NULL OR length(btrim(p_reply))=0 THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_REPLY' USING ERRCODE='22023'; END IF;
  IF p_outcome IN ('CORRECTED','FORGOTTEN','DISABLED') AND (p_reply_if_changed IS NULL OR length(btrim(p_reply_if_changed))=0)
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_REPLY' USING ERRCODE='22023'; END IF;
  IF p_outcome IN ('REMEMBERED','CORRECTED') AND (p_reply_if_existing IS NULL OR length(btrim(p_reply_if_existing))=0)
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_REPLY' USING ERRCODE='22023'; END IF;
  IF p_subject IS NOT NULL AND (p_subject NOT IN ('SELF','OTHER') OR p_outcome NOT IN ('REMEMBERED','CORRECTED'))
     OR (p_outcome = 'REMEMBERED' AND p_subject IS NULL)
     OR (p_equivalent_memory_id IS NOT NULL AND p_outcome NOT IN ('REMEMBERED','CORRECTED'))
     OR (p_kind = 'REMEMBER' AND p_target_memory_id IS NOT NULL)
     OR (p_outcome = 'SUBJECT_CLARIFICATION_REQUIRED' AND p_kind NOT IN ('REMEMBER','CORRECT'))
     OR (p_kind = 'CORRECT' AND p_outcome = 'SUBJECT_CLARIFICATION_REQUIRED' AND p_target_memory_id IS NULL)
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023'; END IF;

  -- Lock order: the source turn first, then the answered command, then the owner lock, then the Memory rows.
  SELECT * INTO source_row FROM public.conversation_turns t
    WHERE t.id=p_source_turn_id AND t.session_id=p_session_id AND t.user_id=p_user_id AND t.role='USER' AND t.status='GENERATING'
    FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM unnest(candidates) c
              WHERE NOT EXISTS (SELECT 1 FROM public.memories m WHERE m.id=c AND m.user_id=p_user_id))
     OR cardinality(candidates) <> (SELECT count(DISTINCT c) FROM unnest(candidates) c)
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_CANDIDATES' USING ERRCODE='42501'; END IF;

  -- A follow-up answers exactly the question the immediately preceding user turn of this Session received, at most
  -- once: a target question (CLARIFICATION_REQUIRED, same kind, only one of its options), the subject question
  -- (SUBJECT_CLARIFICATION_REQUIRED, REMEMBER, answered by REMEMBERED or CLARIFICATION_DECLINED), or (L-11) a
  -- correction's subject question (SUBJECT_CLARIFICATION_REQUIRED, CORRECT, answered by CORRECTED of exactly its target
  -- with a confirmed subject, or CLARIFICATION_DECLINED).
  IF p_answers_command_id IS NOT NULL THEN
    SELECT t.id INTO previous_user_turn_id FROM public.conversation_turns t
      WHERE t.session_id=p_session_id AND t.user_id=p_user_id AND t.role='USER' AND t.status<>'CANCELLED' AND t.id<>source_row.id
        AND (t.created_at, t.id) < (source_row.created_at, source_row.id)
      ORDER BY t.created_at DESC, t.id DESC LIMIT 1;
    SELECT * INTO pending FROM public.memory_control_commands c
      WHERE c.id=p_answers_command_id AND c.user_id=p_user_id AND c.session_id=p_session_id AND c.kind=p_kind
        AND (c.outcome = CASE WHEN p_kind='REMEMBER' THEN 'SUBJECT_CLARIFICATION_REQUIRED' ELSE 'CLARIFICATION_REQUIRED' END
             OR (p_kind='CORRECT' AND c.outcome='SUBJECT_CLARIFICATION_REQUIRED'))
      FOR UPDATE;
    IF NOT FOUND OR pending.source_turn_id IS DISTINCT FROM previous_user_turn_id
       OR EXISTS (SELECT 1 FROM public.memory_control_commands a WHERE a.answers_command_id=pending.id)
       OR (pending.outcome='CLARIFICATION_REQUIRED' AND p_target_memory_id IS NOT NULL
           AND NOT (p_target_memory_id = ANY (pending.candidate_memory_ids)))
       OR (p_kind='REMEMBER' AND p_outcome NOT IN ('REMEMBERED','CLARIFICATION_DECLINED'))
       OR (p_kind='CORRECT' AND pending.outcome='SUBJECT_CLARIFICATION_REQUIRED' AND NOT (
             p_outcome='CLARIFICATION_DECLINED'
             OR (p_outcome='CORRECTED' AND p_subject IS NOT NULL AND p_target_memory_id IS NOT DISTINCT FROM pending.target_memory_id)))
    THEN RAISE EXCEPTION 'INVALID_MEMORY_CLARIFICATION_ANSWER' USING ERRCODE='42501'; END IF;
  END IF;

  IF p_target_memory_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.memories m WHERE m.id=p_target_memory_id AND m.user_id=p_user_id)
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_TARGET' USING ERRCODE='42501'; END IF;
  IF p_equivalent_memory_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.memories m WHERE m.id=p_equivalent_memory_id AND m.user_id=p_user_id)
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_TARGET' USING ERRCODE='42501'; END IF;
  -- L-11: a correction asks whom its new value is about only for a fact whose subject was never established (an
  -- attribution never changes, so the answer finds it the same).
  IF p_kind='CORRECT' AND p_outcome='SUBJECT_CLARIFICATION_REQUIRED' AND public.memory_subject_v1(p_user_id, p_target_memory_id) IS NOT NULL
  THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023'; END IF;

  IF p_outcome='REMEMBERED' THEN
    IF p_new_memory_id IS NULL THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023'; END IF;
    PERFORM public.assert_canonical_memory_shape_v1(p_type, p_content, 'USER_STATED', p_confidence, p_importance, 'ACTIVE', p_expires_at);
    successor_subject := p_subject;
    successor_basis := CASE WHEN p_answers_command_id IS NULL THEN 'EXPLICIT_STATEMENT' ELSE 'USER_CLARIFIED' END;
    new_key := public.memory_equivalence_key_v1(btrim(p_content));
    PERFORM public.memory_equivalence_lock_v1(p_user_id);
    PERFORM 1 FROM public.memories m
      WHERE m.user_id=p_user_id AND (m.id=p_equivalent_memory_id
        OR (m.type=p_type AND m.status='ACTIVE' AND public.memory_equivalence_key_v1(m.content)=new_key))
      ORDER BY m.id FOR UPDATE;
    -- The equivalents with a compatible subject, in id order: the class by key, plus the caller's equivalent if it
    -- still qualifies.
    equivalents := ARRAY(
      SELECT m.id FROM public.memories m
       WHERE m.user_id=p_user_id AND m.type=p_type AND m.status='ACTIVE'
         AND (m.expires_at IS NULL OR m.expires_at>CURRENT_TIMESTAMP)
         AND (public.memory_equivalence_key_v1(m.content)=new_key OR m.id=p_equivalent_memory_id)
         AND coalesce(public.memory_subject_v1(p_user_id, m.id), successor_subject) = successor_subject
       ORDER BY m.id);
    SELECT m.* INTO retained FROM public.memories m WHERE m.id = (
      SELECT e FROM unnest(equivalents) AS e WHERE public.memory_subject_v1(p_user_id, e) = successor_subject ORDER BY e LIMIT 1);
    IF retained.id IS NOT NULL THEN
      applied := 'ALREADY_REMEMBERED';
      reply := p_reply_if_existing;
      FOR member IN SELECT e AS id FROM unnest(equivalents) AS e WHERE public.memory_subject_v1(p_user_id, e) IS NULL ORDER BY e LOOP
        PERFORM public.memory_dispose_equivalent_v1(p_user_id, member.id, new_command_id, retained.id, 'RECONFIRMED');
      END LOOP;
    ELSE
      SELECT m.* INTO reconfirmed FROM public.memories m WHERE m.id = (
        SELECT e FROM unnest(equivalents) AS e WHERE public.memory_subject_v1(p_user_id, e) IS NULL ORDER BY e LIMIT 1);
      IF reconfirmed.id IS NOT NULL THEN
        -- RECONFIRMED (A1 C1.3): the existing supersede primitive, so the lineage is one successor in the user's words.
        SELECT * INTO changed FROM public.server_supersede_memory_v1(
          p_user_id, reconfirmed.id, p_new_memory_id, p_type, p_content, 'USER_STATED', p_confidence, p_importance, 'ACTIVE', p_expires_at);
        IF changed.id IS NULL THEN RAISE EXCEPTION 'MEMORY_EQUIVALENCE_INTEGRITY' USING ERRCODE='55000'; END IF;
        applied := 'RECONFIRMED';
        recorded_target := reconfirmed.id;
      ELSE
        SELECT * INTO changed FROM public.server_create_memory_v1(
          p_user_id, p_new_memory_id, p_type, p_content, 'USER_STATED', p_confidence, p_importance, 'ACTIVE', p_expires_at);
      END IF;
      result_id := changed.id;
      INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis, command_id)
        VALUES (changed.id, p_user_id, successor_subject, successor_basis, new_command_id);
      -- The other unattributed copies (none exists on a plain create) are retired towards the new Memory.
      FOR member IN SELECT e AS id FROM unnest(equivalents) AS e
                     WHERE public.memory_subject_v1(p_user_id, e) IS NULL AND e IS DISTINCT FROM reconfirmed.id ORDER BY e LOOP
        PERFORM public.memory_dispose_equivalent_v1(p_user_id, member.id, new_command_id, changed.id, 'RECONFIRMED');
      END LOOP;
    END IF;

  ELSIF p_outcome='CORRECTED' THEN
    IF p_new_memory_id IS NULL OR p_target_memory_id IS NULL THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023'; END IF;
    PERFORM public.assert_canonical_memory_shape_v1(p_type, p_content, 'USER_STATED', p_confidence, p_importance, 'ACTIVE', p_expires_at);
    -- Memory content and type are immutable (0072), so the keys can be read before the locks.
    SELECT * INTO target FROM public.memories m WHERE m.id=p_target_memory_id AND m.user_id=p_user_id;
    target_key := public.memory_equivalence_key_v1(target.content);
    new_key := public.memory_equivalence_key_v1(btrim(p_content));
    PERFORM public.memory_equivalence_lock_v1(p_user_id);
    PERFORM 1 FROM public.memories m
      WHERE m.user_id=p_user_id AND (m.id=p_target_memory_id OR m.id=p_equivalent_memory_id
        OR (m.status='ACTIVE' AND ((m.type=p_type AND public.memory_equivalence_key_v1(m.content)=new_key)
                                OR (m.type=target.type AND public.memory_equivalence_key_v1(m.content)=target_key))))
      ORDER BY m.id FOR UPDATE;
    SELECT * INTO target FROM public.memories m WHERE m.id=p_target_memory_id AND m.user_id=p_user_id;
    IF NOT (target.status='ACTIVE' AND (target.expires_at IS NULL OR target.expires_at>CURRENT_TIMESTAMP)) THEN
      applied := 'TARGET_CHANGED';
    ELSE
      target_subject := public.memory_subject_v1(p_user_id, target.id);
      successor_subject := coalesce(p_subject, target_subject);
      successor_basis := CASE WHEN p_subject IS NULL THEN 'CORRECTION_INHERITED'
                              WHEN pending.outcome='SUBJECT_CLARIFICATION_REQUIRED' THEN 'USER_CLARIFIED' ELSE 'EXPLICIT_STATEMENT' END;
      recorded_target := target.id;
      -- The replacement's equivalents (never the target). An UNATTRIBUTED successor is compatible with every subject.
      equivalents := ARRAY(
        SELECT m.id FROM public.memories m
         WHERE m.user_id=p_user_id AND m.id<>target.id AND m.type=p_type AND m.status='ACTIVE'
           AND (m.expires_at IS NULL OR m.expires_at>CURRENT_TIMESTAMP)
           AND (public.memory_equivalence_key_v1(m.content)=new_key OR m.id=p_equivalent_memory_id)
           AND (successor_subject IS NULL
                OR coalesce(public.memory_subject_v1(p_user_id, m.id), successor_subject) = successor_subject)
         ORDER BY m.id);
      SELECT m.* INTO retained FROM public.memories m WHERE m.id = (
        SELECT e FROM unnest(equivalents) AS e
         WHERE successor_subject IS NULL OR public.memory_subject_v1(p_user_id, e) = successor_subject ORDER BY e LIMIT 1);
      IF successor_subject IS NULL
         AND EXISTS (SELECT 1 FROM unnest(equivalents) AS e WHERE public.memory_subject_v1(p_user_id, e) IS NOT NULL) THEN
        -- L-11: an UNATTRIBUTED fact's new value is already remembered about the user or about someone else. Whose it is
        -- is never inferred: the server asks first, so this is reached only when such a Memory appeared after its read.
        -- Nothing changes.
        applied := 'TARGET_CHANGED';
      ELSIF retained.id IS NOT NULL THEN
        -- CORRECTED_TO_EXISTING: no second copy. The target is superseded status-only; this command row (target ->
        -- result = the retained Memory) is its auditable relation.
        IF NOT public.memory_status_only_supersede_v1(p_user_id, target.id) THEN
          RAISE EXCEPTION 'MEMORY_EQUIVALENCE_INTEGRITY' USING ERRCODE='55000'; END IF;
        applied := 'CORRECTED_TO_EXISTING';
        reply := p_reply_if_existing;
        result_id := retained.id;
      ELSE
        SELECT * INTO changed FROM public.server_supersede_memory_v1(
          p_user_id, target.id, p_new_memory_id, p_type, p_content, 'USER_STATED', p_confidence, p_importance, 'ACTIVE', p_expires_at);
        IF changed.id IS NULL THEN RAISE EXCEPTION 'MEMORY_EQUIVALENCE_INTEGRITY' USING ERRCODE='55000'; END IF;
        result_id := changed.id;
        IF successor_subject IS NOT NULL THEN
          INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis, command_id)
            VALUES (changed.id, p_user_id, successor_subject, successor_basis, new_command_id);
        END IF;
      END IF;
      -- Unattributed copies of the new value are retired towards the Memory that now holds it.
      FOR member IN SELECT e AS id FROM unnest(equivalents) AS e
                     WHERE applied <> 'TARGET_CHANGED' AND public.memory_subject_v1(p_user_id, e) IS NULL AND e <> result_id ORDER BY e LOOP
        PERFORM public.memory_dispose_equivalent_v1(p_user_id, member.id, new_command_id, result_id, 'RECONFIRMED');
      END LOOP;
      -- Copies of the corrected fact (a legacy duplicate pair) leave with it.
      FOR member IN
        SELECT m.id FROM public.memories m
         WHERE applied <> 'TARGET_CHANGED'
           AND m.user_id=p_user_id AND m.id<>target.id AND m.id<>result_id AND m.type=target.type AND m.status='ACTIVE'
           AND public.memory_equivalence_key_v1(m.content)=target_key
           AND (target_subject IS NULL OR coalesce(public.memory_subject_v1(p_user_id, m.id), target_subject) = target_subject)
         ORDER BY m.id
      LOOP
        PERFORM public.memory_dispose_equivalent_v1(p_user_id, member.id, new_command_id, target.id, 'CORRECTED');
      END LOOP;
    END IF;

  ELSIF p_outcome='FORGOTTEN' THEN
    IF p_target_memory_id IS NULL THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023'; END IF;
    SELECT * INTO target FROM public.memories m WHERE m.id=p_target_memory_id AND m.user_id=p_user_id;
    target_key := public.memory_equivalence_key_v1(target.content);
    PERFORM public.memory_equivalence_lock_v1(p_user_id);
    PERFORM 1 FROM public.memories m
      WHERE m.user_id=p_user_id AND (m.id=p_target_memory_id
        OR (m.type=target.type AND m.status IN ('ACTIVE','DISABLED') AND public.memory_equivalence_key_v1(m.content)=target_key))
      ORDER BY m.id FOR UPDATE;
    -- Lifecycle deletion, never a physical DELETE (v1). A forgotten fact never survives as a copy: every equivalent
    -- ACTIVE or DISABLED row of the owner with a compatible subject is deleted with it. A copy about someone else is a
    -- different fact and is never deleted because its words match (RC-C2): a SELF target leaves OTHER copies, an OTHER
    -- target leaves SELF copies.
    SELECT * INTO target FROM public.memories m WHERE m.id=p_target_memory_id AND m.user_id=p_user_id;
    target_subject := public.memory_subject_v1(p_user_id, target.id);
    IF target.status IN ('ACTIVE','DISABLED') THEN
      SELECT * INTO changed FROM public.server_mark_memory_deleted_v1(p_user_id, p_target_memory_id);
    ELSIF target.status='DELETED' THEN
      changed := target;
    END IF;
    IF changed.id IS NULL THEN
      applied := 'TARGET_CHANGED';
    ELSE
      recorded_target := target.id;
      FOR member IN
        SELECT m.id FROM public.memories m
         WHERE m.user_id=p_user_id AND m.id<>target.id AND m.type=target.type AND m.status IN ('ACTIVE','DISABLED')
           AND public.memory_equivalence_key_v1(m.content)=target_key
           AND (target_subject IS NULL OR coalesce(public.memory_subject_v1(p_user_id, m.id), target_subject) = target_subject)
         ORDER BY m.id
      LOOP
        PERFORM public.memory_dispose_equivalent_v1(p_user_id, member.id, new_command_id, target.id, 'FORGOTTEN');
      END LOOP;
    END IF;

  ELSIF p_outcome='DISABLED' THEN
    IF p_target_memory_id IS NULL THEN RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023'; END IF;
    SELECT * INTO target FROM public.memories m WHERE m.id=p_target_memory_id AND m.user_id=p_user_id;
    target_key := public.memory_equivalence_key_v1(target.content);
    PERFORM public.memory_equivalence_lock_v1(p_user_id);
    PERFORM 1 FROM public.memories m
      WHERE m.user_id=p_user_id AND (m.id=p_target_memory_id
        OR (m.type=target.type AND m.status='ACTIVE' AND public.memory_equivalence_key_v1(m.content)=target_key))
      ORDER BY m.id FOR UPDATE;
    SELECT * INTO changed FROM public.server_disable_memory_v1(p_user_id, p_target_memory_id);
    IF changed.id IS NULL THEN
      applied := 'TARGET_CHANGED';
    ELSE
      recorded_target := target.id;
      -- The same compatible-subject rule as FORGET (RC-C2): a copy about someone else stays relied on.
      target_subject := public.memory_subject_v1(p_user_id, target.id);
      FOR member IN
        SELECT m.id FROM public.memories m
         WHERE m.user_id=p_user_id AND m.id<>target.id AND m.type=target.type AND m.status='ACTIVE'
           AND (m.expires_at IS NULL OR m.expires_at>CURRENT_TIMESTAMP)
           AND public.memory_equivalence_key_v1(m.content)=target_key
           AND (target_subject IS NULL OR coalesce(public.memory_subject_v1(p_user_id, m.id), target_subject) = target_subject)
         ORDER BY m.id
      LOOP
        PERFORM public.memory_dispose_equivalent_v1(p_user_id, member.id, new_command_id, target.id, 'DISABLED');
      END LOOP;
    END IF;

  ELSIF p_new_memory_id IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_MEMORY_CONTROL_SHAPE' USING ERRCODE='22023';
  END IF;

  IF applied='TARGET_CHANGED' THEN
    reply := p_reply_if_changed;
    recorded_target := p_target_memory_id;
  END IF;

  INSERT INTO public.memory_control_commands(
    id, user_id, session_id, source_turn_id, kind, outcome, target_memory_id, result_memory_id, candidate_memory_ids, answers_command_id)
  VALUES (
    new_command_id, p_user_id, p_session_id, p_source_turn_id, p_kind, applied,
    CASE WHEN applied IN ('CORRECTED','CORRECTED_TO_EXISTING','FORGOTTEN','DISABLED','TARGET_CHANGED','RECONFIRMED') THEN recorded_target
         WHEN applied='SUBJECT_CLARIFICATION_REQUIRED' AND p_kind='CORRECT' THEN p_target_memory_id END,
    CASE WHEN applied IN ('REMEMBERED','RECONFIRMED','CORRECTED','CORRECTED_TO_EXISTING') THEN result_id END,
    candidates, p_answers_command_id);

  SELECT f.user_turn, f.assistant_turn INTO finalized_user, finalized_assistant FROM public.finalize_conversation_turn_v2(
    p_session_id, p_user_id, p_source_turn_id, p_assistant_turn_id, reply, 'ALLOW',
    p_event_id, p_correlation_id, p_orchestration_id, NULL) f;
  -- The source turn is locked GENERATING above, so this cannot happen; if it ever did, nothing above may survive.
  IF finalized_user IS NULL THEN RAISE EXCEPTION 'MEMORY_CONTROL_TURN_NOT_FINALIZED' USING ERRCODE='55000'; END IF;

  RETURN QUERY SELECT applied, finalized_user, finalized_assistant;
END;$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 10. The ONE background Memory writer.
--
--   1. 0072's association, verbatim: the durable RUNNING execution of this source turn with MEMORY_WRITE CLAIMED, and
--      the history boundary bound to that execution's Session.
--   2. SKIPPED_COMMAND_TURN (PD-7, R2 CONFIRMED by MEM-AR-01B): a turn a Memory command already answered - a command,
--      a target or subject clarification answer, a reversal - is the foreground's. The command row commits in the same
--      transaction as the turn finalization that emits ConversationTurnCompleted, so it exists before this runs. The
--      decision reads committed command facts bound to this source turn, never the words.
--   3. ALREADY_RECORDED: a replay of this execution answers the Memory it already wrote.
--   4. Owner lock, then the equivalence class FOR UPDATE in id order.
--   5. SUPERSEDED_BY_LATER_COMMAND: a capture delayed past a later FORGET / DISABLE / CORRECT of the same fact never
--      re-creates it.
--   6. EQUIVALENT_EXISTS: the same fact is already ACTIVE as SELF or UNATTRIBUTED. The background never retires and
--      never attributes an existing row.
--   7. Create (USER_STATED, ACTIVE) + SELF / FIRST_PERSON_CAPTURE, naming this execution.
-- ---------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.background_record_memory_v1(
  p_source_turn_id uuid, p_memory_id uuid, p_type text, p_content text,
  p_confidence double precision, p_importance double precision, p_expires_at timestamptz DEFAULT NULL
) RETURNS TABLE(outcome text, memory_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  execution_row public.post_response_intelligence_executions;
  source_row public.conversation_turns;
  replayed uuid;
  new_key text;
  created public.memories;
BEGIN
  IF p_source_turn_id IS NULL OR p_memory_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_MEMORY_IDENTITY' USING ERRCODE='22023';
  END IF;
  SELECT e.* INTO execution_row FROM public.post_response_intelligence_executions e
   WHERE e.source_turn_id = p_source_turn_id AND e.state = 'RUNNING';
  IF NOT FOUND OR NOT EXISTS (
       SELECT 1 FROM public.post_response_intelligence_effects f
        WHERE f.execution_id = execution_row.id AND f.effect_key = 'MEMORY_WRITE' AND f.state = 'CLAIMED') THEN
    RAISE EXCEPTION 'MEMORY_WRITE_EXECUTION_NOT_ASSOCIATED' USING ERRCODE='42501',
      DETAIL='A background Memory write is canonical only inside its durable post-response execution with MEMORY_WRITE claimed.';
  END IF;
  PERFORM public.assert_canonical_memory_shape_v1(p_type, p_content, 'USER_STATED', p_confidence, p_importance, 'ACTIVE', p_expires_at);

  IF EXISTS (SELECT 1 FROM public.memory_control_commands c
              WHERE c.source_turn_id = p_source_turn_id AND c.user_id = execution_row.user_id) THEN
    RETURN QUERY SELECT 'SKIPPED_COMMAND_TURN'::text, NULL::uuid; RETURN;
  END IF;

  PERFORM public.memory_equivalence_lock_v1(execution_row.user_id);
  SELECT a.memory_id INTO replayed FROM public.memory_subject_attributions a
   WHERE a.execution_id = execution_row.id AND a.user_id = execution_row.user_id AND a.basis = 'FIRST_PERSON_CAPTURE';
  IF replayed IS NOT NULL THEN
    RETURN QUERY SELECT 'ALREADY_RECORDED'::text, replayed; RETURN;
  END IF;

  new_key := public.memory_equivalence_key_v1(btrim(p_content));
  PERFORM 1 FROM public.memories m
    WHERE m.user_id = execution_row.user_id AND m.type = p_type AND m.status = 'ACTIVE'
      AND public.memory_equivalence_key_v1(m.content) = new_key
    ORDER BY m.id FOR UPDATE;

  SELECT * INTO source_row FROM public.conversation_turns t WHERE t.id = p_source_turn_id AND t.user_id = execution_row.user_id;
  IF EXISTS (
    SELECT 1 FROM public.memory_control_commands c
      JOIN public.conversation_turns later ON later.id = c.source_turn_id
      JOIN public.memories m ON m.user_id = c.user_id
        AND (m.id = c.target_memory_id
             OR m.id IN (SELECT d.memory_id FROM public.memory_equivalence_dispositions d
                          WHERE d.command_id = c.id AND d.disposition IN ('FORGOTTEN','DISABLED','CORRECTED')))
     WHERE c.user_id = execution_row.user_id
       AND c.outcome IN ('FORGOTTEN','DISABLED','CORRECTED','CORRECTED_TO_EXISTING')
       AND m.type = p_type AND public.memory_equivalence_key_v1(m.content) = new_key
       AND (later.created_at, later.id) > (source_row.created_at, source_row.id))
  THEN
    RETURN QUERY SELECT 'SUPERSEDED_BY_LATER_COMMAND'::text, NULL::uuid; RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.memories m
     WHERE m.user_id = execution_row.user_id AND m.type = p_type AND m.status = 'ACTIVE'
       AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
       AND public.memory_equivalence_key_v1(m.content) = new_key
       AND coalesce(public.memory_subject_v1(execution_row.user_id, m.id), 'SELF') = 'SELF')
  THEN
    RETURN QUERY SELECT 'EQUIVALENT_EXISTS'::text, NULL::uuid; RETURN;
  END IF;

  PERFORM public.historical_capture_begin_v1(execution_row.user_id, execution_row.session_id, true);
  SELECT * INTO created FROM public.server_create_memory_v1(execution_row.user_id, p_memory_id, p_type, p_content,
    'USER_STATED', p_confidence, p_importance, 'ACTIVE', p_expires_at);
  INSERT INTO public.memory_subject_attributions (memory_id, user_id, subject, basis, execution_id)
    VALUES (created.id, execution_row.user_id, 'SELF', 'FIRST_PERSON_CAPTURE', execution_row.id);
  RETURN QUERY SELECT 'CREATED'::text, created.id;
END;$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 11. CC-M1 - 0028 L2, redefined. The 0028 body verbatim except ONE line in Step B: the candidate must be attributed
--     SELF. OTHER and UNATTRIBUTED Memories stay in the 64-row window (Step A is unchanged) and are never Evidence.
--     Signature, owner, volatility, grants, Step A, the dedup key, ordering, bound and return shape are unchanged.
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.canonical_eligible_memory_ids_v1(p_user_id uuid, p_now timestamptz)
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
      AND EXISTS (SELECT 1 FROM public.memory_subject_attributions attribution WHERE attribution.memory_id=candidate.id AND attribution.user_id=p_user_id AND attribution.subject='SELF') -- MEM-AR-01C CC-M1 (0152)
  )
  SELECT eligible.id, 'memory:'||eligible.id::text
  FROM eligible WHERE eligible.duplicate_rank=1
  ORDER BY eligible.updated_at DESC, eligible.id ASC
  LIMIT 64
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 12. CC-M2' - 0151 L1, redefined (A1 C2.2). The two subject standings precede LAPSED, so expiry never turns a subject
--     taint into a non-taint; CURRENT now also requires SELF, so L2 is still a subset of CURRENT.
--     CC-M3' - 0151 L3, redefined: the taint set gains NOT_SELF and UNATTRIBUTED. Nothing else changes: the housekeeping
--     still detaches only WITHDRAWN links, and the link-removal invariant, the bind guard and the QIR-006 lines read
--     these functions unchanged. No taint is ever removed, so no withheld Hypothesis is lifted by any path.
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.personal_evidence_standing_v1(p_user_id uuid, p_evidence_id text, p_now timestamptz)
RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT coalesce((
    SELECT CASE
      WHEN m.status IN ('DELETED','DISABLED') THEN 'WITHDRAWN'
      WHEN m.status = 'SUPERSEDED' THEN 'CORRECTED'
      WHEN m.status IN ('ACTIVE','EXPIRED') AND m.source IN ('USER_STATED','USER_CONFIRMED') AND m.type <> 'DERIVED_INSIGHT' AND a.subject = 'OTHER' THEN 'NOT_SELF'
      WHEN m.status IN ('ACTIVE','EXPIRED') AND m.source IN ('USER_STATED','USER_CONFIRMED') AND m.type <> 'DERIVED_INSIGHT' AND a.subject IS NULL THEN 'UNATTRIBUTED'
      WHEN m.status = 'EXPIRED' OR (m.expires_at IS NOT NULL AND m.expires_at <= p_now) THEN 'LAPSED'
      WHEN m.status = 'ACTIVE' AND m.source IN ('USER_STATED','USER_CONFIRMED') AND m.type <> 'DERIVED_INSIGHT' AND a.subject = 'SELF' THEN 'CURRENT'
      ELSE 'OTHER' END
      FROM public.memories m
      LEFT JOIN public.memory_subject_attributions a ON a.memory_id = m.id AND a.user_id = m.user_id
     WHERE m.user_id = p_user_id AND m.id = public.personal_evidence_memory_id_v1(p_evidence_id)), 'OTHER')
$$;

CREATE OR REPLACE FUNCTION public.hypothesis_evidence_change_core_v1(
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
      (EXISTS (SELECT 1 FROM recorded) OR EXISTS (SELECT 1 FROM links l WHERE l.standing IN ('WITHDRAWN','CORRECTED','NOT_SELF','UNATTRIBUTED'))) AS tainted, -- MEM-AR-01C CC-M3' (0152)
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

-- ---------------------------------------------------------------------------------------------------------------
-- 13. CC-H1 - the 0033 completion, redefined: the 0033 body verbatim plus ONE predicate. A VALIDATED_CANDIDATES result
--     whose candidate cites no supporting Evidence is refused (22023 CANDIDATE_WITHOUT_SUPPORT) and nothing is
--     completed. Both entry points pass through here: the grounded wrapper (0072) and a direct service_role call. The
--     IMMUTABLE validator used by table CHECK constraints is unchanged, and so is the provider schema.
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_post_response_candidate_provider_effect_v1(p_execution_id uuid,p_result_code text,p_result_payload jsonb DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE execution_row public.post_response_intelligence_executions; intent_payload jsonb;
BEGIN
 IF p_result_code='NO_ACCEPTED_CANDIDATES' THEN
  IF p_result_payload IS NOT NULL THEN RAISE EXCEPTION 'INVALID_CANDIDATE_RESULT' USING ERRCODE='22023';END IF;
 ELSIF p_result_code='VALIDATED_CANDIDATES' THEN
  IF p_result_payload IS NULL OR NOT public.post_response_generation_candidates_valid_v1(p_result_payload) THEN RAISE EXCEPTION 'INVALID_CANDIDATE_RESULT' USING ERRCODE='22023';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_result_payload) AS candidate(value) WHERE jsonb_array_length(candidate.value->'supportingEvidenceIds')=0) THEN RAISE EXCEPTION 'CANDIDATE_WITHOUT_SUPPORT' USING ERRCODE='22023';END IF; -- MEM-AR-01C CC-H1 (0152)
 ELSE RAISE EXCEPTION 'INVALID_CANDIDATE_RESULT' USING ERRCODE='22023';
 END IF;
 SELECT * INTO execution_row FROM public.post_response_intelligence_executions WHERE id=p_execution_id AND state='RUNNING' FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 SELECT effect.result_payload INTO intent_payload FROM public.post_response_intelligence_effects effect
   WHERE effect.execution_id=p_execution_id AND effect.effect_key='INTENT_PROVIDER' AND effect.state='COMPLETED' AND effect.result_code='INTENT_AUTHORIZED';
 IF NOT FOUND OR intent_payload IS NULL THEN RAISE EXCEPTION 'CANDIDATE_INTENT_UNAVAILABLE' USING ERRCODE='42501';END IF;
 IF p_result_code='VALIDATED_CANDIDATES' THEN
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_result_payload) AS candidate(value)
     WHERE candidate.value->>'domain' IS DISTINCT FROM intent_payload->>'domain'
        OR candidate.value->>'scope' IS DISTINCT FROM intent_payload->'scope'->>'serialized')
  THEN RAISE EXCEPTION 'CANDIDATE_INTENT_MISMATCH' USING ERRCODE='42501';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_result_payload) AS candidate(value)
     CROSS JOIN LATERAL (
       SELECT supporting.value FROM jsonb_array_elements_text(candidate.value->'supportingEvidenceIds') AS supporting(value)
       UNION ALL
       SELECT contradicting.value FROM jsonb_array_elements_text(candidate.value->'contradictingEvidenceIds') AS contradicting(value)
     ) AS linked(value)
     WHERE NOT (intent_payload->'evidenceIds') ? linked.value)
  THEN RAISE EXCEPTION 'CANDIDATE_INTENT_MISMATCH' USING ERRCODE='42501';END IF;
 END IF;
 UPDATE public.post_response_intelligence_effects SET state='COMPLETED',completed_at=CURRENT_TIMESTAMP,result_code=p_result_code,result_payload=p_result_payload
  WHERE execution_id=p_execution_id AND effect_key='CANDIDATE_PROVIDER' AND state='CLAIMED' AND result_code IS NULL AND result_reference IS NULL AND result_payload IS NULL;
 RETURN FOUND;
END;$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 14. Ownership and privileges, all explicit.
-- ---------------------------------------------------------------------------------------------------------------
ALTER FUNCTION public.memory_equivalence_key_v1(text) OWNER TO postgres;
ALTER FUNCTION public.guard_memory_provenance_record_v1() OWNER TO postgres;
ALTER FUNCTION public.guard_memory_subject_attribution_insert_v1() OWNER TO postgres;
ALTER FUNCTION public.memory_status_only_supersede_v1(uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.memory_equivalence_lock_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.memory_subject_v1(uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.memory_dispose_equivalent_v1(uuid,uuid,uuid,uuid,text) OWNER TO postgres;
ALTER FUNCTION public.pending_memory_subject_clarification_v1(uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.pending_memory_correction_subject_clarification_v1(uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.server_finalize_memory_control_turn_v2(uuid,uuid,uuid,uuid,text,text,uuid,uuid,text,text,double precision,double precision,timestamptz,uuid[],uuid,text,uuid,text,text,text,uuid,uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.background_record_memory_v1(uuid,uuid,text,text,double precision,double precision,timestamptz) OWNER TO postgres;

REVOKE ALL ON FUNCTION
  public.memory_equivalence_key_v1(text),
  public.guard_memory_provenance_record_v1(),
  public.guard_memory_subject_attribution_insert_v1(),
  public.memory_status_only_supersede_v1(uuid,uuid),
  public.memory_equivalence_lock_v1(uuid),
  public.memory_subject_v1(uuid,uuid),
  public.memory_dispose_equivalent_v1(uuid,uuid,uuid,uuid,text),
  public.server_finalize_memory_control_turn_v2(uuid,uuid,uuid,uuid,text,text,uuid,uuid,text,text,double precision,double precision,timestamptz,uuid[],uuid,text,uuid,text,text,text,uuid,uuid,uuid),
  public.background_record_memory_v1(uuid,uuid,text,text,double precision,double precision,timestamptz)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.pending_memory_subject_clarification_v1(uuid,uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.pending_memory_subject_clarification_v1(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.pending_memory_correction_subject_clarification_v1(uuid,uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.pending_memory_correction_subject_clarification_v1(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.server_finalize_memory_control_turn_v2(uuid,uuid,uuid,uuid,text,text,uuid,uuid,text,text,double precision,double precision,timestamptz,uuid[],uuid,text,uuid,text,text,text,uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.background_record_memory_v1(uuid,uuid,text,text,double precision,double precision,timestamptz) TO service_role;

-- The six legacy Memory writers: no application role may call any of them any more. Their bodies are unchanged and
-- the two writers above call them as their owner.
REVOKE EXECUTE ON FUNCTION public.server_create_memory_v1(uuid,uuid,text,text,text,double precision,double precision,text,timestamptz) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.server_create_memory_for_execution_v1(uuid,uuid,text,text,text,double precision,double precision,text,timestamptz) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.server_supersede_memory_v1(uuid,uuid,uuid,text,text,text,double precision,double precision,text,timestamptz) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.server_mark_memory_deleted_v1(uuid,uuid) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.server_disable_memory_v1(uuid,uuid) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.server_finalize_memory_control_turn_v1(uuid,uuid,uuid,uuid,text,text,uuid,uuid,text,text,double precision,double precision,timestamptz,uuid[],uuid,text,text,uuid,uuid,uuid) FROM service_role;

COMMIT;
