-- QIR-006 - Question / Information-Gap Closed Loop v1.
--
-- The repository already materializes durable automatic Information Gaps from
-- exact durable Confidence sources (migration 0038), but the loop is open:
-- gap status is effectively OPEN-only, no closure rule exists once new user
-- information changes canonical Hypothesis/Confidence state, and no durable
-- binding exists between a selected formal Question opportunity and the
-- assistant turn that actually consumed it. This forward-only migration closes
-- exactly those boundaries and nothing else:
--
--   * the durable automatic Information Gap lifecycle becomes total:
--     OPEN -> RESOLVED / SUPERSEDED, with a protected reopen-by-epoch path for
--     a legitimately recurring information need. Closure is decided ONLY by
--     canonical Hypothesis/Confidence state through the ONE synchronization
--     authority below - never by "the user sent another message", never by an
--     answer-detection heuristic, never by a classifier, and never by an LLM;
--   * ONE narrow internal durable selection/binding lifecycle
--     (formal_question_turn_bindings: SELECTED -> BOUND | RELEASED) records
--     which one formal Question opportunity was reserved for which canonical
--     GENERATING user turn and whether the finalized assistant turn actually
--     consumed it. SELECTED never proves the model saw anything; BOUND is
--     written only inside the same transaction that finalizes the assistant
--     turn; RELEASED is owned by ONE database trigger on every canonical
--     terminal source-turn path, so no drifting application `finally` block is
--     ever the release authority;
--   * ONE narrow service-role-only atomic selection command derives the
--     canonical eligible target entirely from owned durable state. The
--     application cannot supply a gap id, hypothesis id, confidence id,
--     missing-information code, objective, status, or epoch as authority;
--   * the current finalization authority is versioned to
--     finalize_conversation_turn_v2, which binds the reservation atomically
--     with assistant insertion + user completion + outbox publication when and
--     only when the sanitized Question context actually survived final
--     provider-request assembly. The previous service-role finalization RPC is
--     retired to a writeless tombstone with zero EXECUTE so it cannot remain
--     an executable bypass around the new binding semantics;
--   * the migration-0038 synchronization authority is versioned to
--     sync_post_response_information_gaps_v2 - the same exact durable-source
--     materialization semantics, extended with canonical closed-loop
--     reconciliation - and v1 becomes a pure delegating wrapper over v2 so
--     exactly ONE process-level closure implementation exists.
--
-- Deliberately NOT added: no Question provider, no fourth background provider
-- effect (the QIR-005 registry and hard cap of 3 are untouched), no second
-- conversational provider call, no answer-detection heuristic, no keyword or
-- embedding classifier, no utility ranking, no Expected Information Gain, no
-- cross-session questioning, no public/client API, no direct table grants,
-- and no transcript/provider-payload/hidden-reasoning persistence.
--
-- Migrations 0001..0062 remain untouched; 0063 is the new terminal migration.

BEGIN;

-- 1. Durable Information Gap lifecycle columns. Historical rows are preserved
--    exactly: every existing row remains OPEN at epoch 1 with no closure
--    metadata, and both new constraints are added WITHOUT `NOT VALID` on
--    purpose - PostgreSQL revalidates every historical row, so the migration
--    itself proves backward compatibility and fails loudly on corruption
--    instead of carrying it.
ALTER TABLE public.information_gaps
  ADD COLUMN closed_at timestamptz,
  ADD COLUMN closure_reason text,
  ADD COLUMN open_epoch integer NOT NULL DEFAULT 1;

-- The migration-0007 foundation check froze status='OPEN'; the total lifecycle
-- replaces it. Current-write authority (the guard trigger and the reconciler
-- below) is STRICTER than this historical read-compatibility widening: the
-- CHECK admits the three canonical statuses, while every actual transition is
-- additionally gated by the protected lifecycle trigger.
ALTER TABLE public.information_gaps DROP CONSTRAINT information_gap_foundation_check;
ALTER TABLE public.information_gaps
  ADD CONSTRAINT information_gap_lifecycle_v1_check CHECK (
    status IN ('OPEN','RESOLVED','SUPERSEDED')
    AND version = 1
    AND provenance = 'QANDEEL_QUESTION_RUNTIME'
    AND open_epoch >= 1
  ),
  ADD CONSTRAINT information_gap_closure_metadata_check CHECK (
    (status = 'OPEN' AND closed_at IS NULL AND closure_reason IS NULL)
    OR (status = 'RESOLVED' AND closed_at IS NOT NULL AND closure_reason = 'MISSING_INFORMATION_CODE_ABSENT')
    OR (status = 'SUPERSEDED' AND closed_at IS NOT NULL AND closure_reason IN ('HYPOTHESIS_VERSION_ADVANCED','HYPOTHESIS_LIFECYCLE_INELIGIBLE'))
  );

-- 2. Protected Information Gap lifecycle guard. DELETE is always rejected.
--    The ONLY permitted UPDATEs are the internally authorized closure
--    (OPEN -> RESOLVED/SUPERSEDED with closure metadata, epoch unchanged) and
--    the internally authorized reopen (RESOLVED/SUPERSEDED -> OPEN with the
--    epoch incremented by exactly one and closure metadata cleared); every
--    other column must stay byte-identical apart from updated_at. No role -
--    service_role included - can reach these transitions without the internal
--    authorization, so an authenticated or privileged-API caller can never
--    forge resolve/supersede/reopen.
CREATE FUNCTION public.guard_information_gap_lifecycle_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Information gap history is immutable' USING ERRCODE='55000';END IF;
 IF coalesce(current_setting('qandeel.information_gap_lifecycle_transition',true),'')<>'authorized'
  OR NOT (
    (OLD.status='OPEN' AND NEW.status IN ('RESOLVED','SUPERSEDED') AND NEW.closed_at IS NOT NULL AND NEW.closure_reason IS NOT NULL AND NEW.open_epoch=OLD.open_epoch)
    OR (OLD.status IN ('RESOLVED','SUPERSEDED') AND NEW.status='OPEN' AND NEW.closed_at IS NULL AND NEW.closure_reason IS NULL AND NEW.open_epoch=OLD.open_epoch+1)
  )
  OR (to_jsonb(OLD)-'status'-'closed_at'-'closure_reason'-'open_epoch'-'updated_at')<>(to_jsonb(NEW)-'status'-'closed_at'-'closure_reason'-'open_epoch'-'updated_at')
 THEN RAISE EXCEPTION 'Information gap mutation requires a protected canonical lifecycle transition' USING ERRCODE='42501';END IF;
 RETURN NEW;END$$;
CREATE TRIGGER information_gap_lifecycle_guard BEFORE UPDATE OR DELETE ON public.information_gaps FOR EACH ROW EXECUTE FUNCTION public.guard_information_gap_lifecycle_mutation();

-- 3. The canonical questioning-eligible Hypothesis lifecycle predicate. This
--    is the EXISTING canonical active set (the migration-0005 partial-index
--    set): REJECTED and RETIRED hypotheses are no longer current questioning
--    targets. One internal helper so the selection command and the
--    reconciliation authority can never drift apart.
CREATE FUNCTION public.question_eligible_hypothesis_lifecycle_v1(p_status text)
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT p_status IN ('CANDIDATE','ACTIVE','SUPPORTED','MIXED','WEAK','REOPENED');
$$;
ALTER FUNCTION public.question_eligible_hypothesis_lifecycle_v1(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.question_eligible_hypothesis_lifecycle_v1(text) FROM PUBLIC,anon,authenticated,service_role;

-- 4. The narrow internal durable formal Question selection/binding lifecycle.
--    One row per canonical GENERATING source turn, ever. The row snapshots the
--    exact reserved target (gap identity + open epoch + the exact automatic
--    source tuple) plus the server-derived question type; it carries NO
--    question text, NO transcript, NO provider payload, and NO hidden
--    reasoning. The automatic-source FK makes "only an automatic
--    Confidence-backed gap can ever be reserved" structural.
CREATE TABLE public.formal_question_turn_bindings(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 session_id uuid NOT NULL,
 source_turn_id uuid NOT NULL REFERENCES public.conversation_turns(id) ON DELETE RESTRICT,
 assistant_turn_id uuid REFERENCES public.conversation_turns(id) ON DELETE RESTRICT,
 information_gap_id uuid NOT NULL,
 gap_open_epoch integer NOT NULL CHECK(gap_open_epoch>=1),
 hypothesis_id uuid NOT NULL,
 hypothesis_version integer NOT NULL CHECK(hypothesis_version>0),
 missing_information_code text NOT NULL CHECK(missing_information_code IN ('NO_ELIGIBLE_EVIDENCE','UNVERIFIED_ASSUMPTIONS','COMPETING_HYPOTHESES_UNASSESSED')),
 question_type text NOT NULL CHECK(question_type IN ('FACT_FINDING','VALIDATION','DISCRIMINATING')),
 state text NOT NULL DEFAULT 'SELECTED' CHECK(state IN ('SELECTED','BOUND','RELEASED')),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 bound_at timestamptz,
 released_at timestamptz,
 CONSTRAINT formal_question_binding_state_metadata_check CHECK(
   (state='SELECTED' AND assistant_turn_id IS NULL AND bound_at IS NULL AND released_at IS NULL)
   OR (state='BOUND' AND assistant_turn_id IS NOT NULL AND bound_at IS NOT NULL AND released_at IS NULL)
   OR (state='RELEASED' AND assistant_turn_id IS NULL AND bound_at IS NULL AND released_at IS NOT NULL)
 ),
 CONSTRAINT formal_question_binding_one_per_source_turn UNIQUE(source_turn_id),
 CONSTRAINT formal_question_binding_session_owner_fk FOREIGN KEY(session_id,user_id) REFERENCES public.conversation_sessions(id,user_id) ON DELETE RESTRICT,
 CONSTRAINT formal_question_binding_gap_owner_fk FOREIGN KEY(information_gap_id,user_id) REFERENCES public.information_gaps(id,user_id) ON DELETE RESTRICT,
 CONSTRAINT formal_question_binding_automatic_source_fk FOREIGN KEY(information_gap_id) REFERENCES public.information_gap_confidence_sources(information_gap_id) ON DELETE RESTRICT,
 CONSTRAINT formal_question_binding_hypothesis_owner_fk FOREIGN KEY(hypothesis_id,user_id) REFERENCES public.hypotheses(id,user_id) ON DELETE RESTRICT
);
-- Concurrency authority (database-owned, final):
--   * at most one ACTIVE (non-RELEASED) reservation per gap/open_epoch - two
--     concurrent selectors can never reserve the same epoch, and a BOUND epoch
--     can never be reserved again;
--   * at most one live SELECTED reservation per session - two concurrent
--     GENERATING turns of one session can never both hold a reservation, which
--     together with the BOUND/OPEN eligibility rule makes "at most one
--     outstanding BOUND formal Question whose gap remains OPEN per session"
--     structural rather than asserted.
CREATE UNIQUE INDEX formal_question_one_active_reservation_per_gap_epoch
  ON public.formal_question_turn_bindings(information_gap_id,gap_open_epoch) WHERE state<>'RELEASED';
CREATE UNIQUE INDEX formal_question_one_selected_reservation_per_session
  ON public.formal_question_turn_bindings(session_id) WHERE state='SELECTED';
CREATE INDEX formal_question_bindings_session_state_idx
  ON public.formal_question_turn_bindings(session_id,state);

ALTER TABLE public.formal_question_turn_bindings OWNER TO postgres;
ALTER TABLE public.formal_question_turn_bindings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.formal_question_turn_bindings FROM PUBLIC,anon,authenticated,service_role;

-- 5. Protected binding lifecycle guard. DELETE is always rejected; the only
--    permitted UPDATEs are the internally authorized SELECTED -> BOUND
--    consumption (assistant identity + bound time attached, everything else
--    byte-identical) and the internally authorized SELECTED -> RELEASED
--    release (release time attached, everything else byte-identical). BOUND
--    and RELEASED are terminal: no path returns to SELECTED, RELEASED can
--    never become BOUND, and a BOUND row can never be re-released.
CREATE FUNCTION public.guard_formal_question_turn_binding_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Formal question binding history is immutable' USING ERRCODE='55000';END IF;
 IF coalesce(current_setting('qandeel.formal_question_binding_transition',true),'')<>'authorized'
  OR OLD.state<>'SELECTED'
  OR NOT (
    (NEW.state='BOUND' AND NEW.assistant_turn_id IS NOT NULL AND NEW.bound_at IS NOT NULL AND NEW.released_at IS NULL
      AND (to_jsonb(OLD)-'state'-'assistant_turn_id'-'bound_at')=(to_jsonb(NEW)-'state'-'assistant_turn_id'-'bound_at'))
    OR (NEW.state='RELEASED' AND NEW.released_at IS NOT NULL AND NEW.assistant_turn_id IS NULL AND NEW.bound_at IS NULL
      AND (to_jsonb(OLD)-'state'-'released_at')=(to_jsonb(NEW)-'state'-'released_at'))
  )
 THEN RAISE EXCEPTION 'Formal question binding mutation requires a protected SELECTED consumption or release transition' USING ERRCODE='42501';END IF;
 RETURN NEW;END$$;
CREATE TRIGGER formal_question_turn_binding_guard BEFORE UPDATE OR DELETE ON public.formal_question_turn_bindings FOR EACH ROW EXECUTE FUNCTION public.guard_formal_question_turn_binding_mutation();

-- 6. The ONE database-owned release mechanism. Whenever a canonical USER turn
--    leaves GENERATING through ANY terminal path - finalize_conversation_turn_v2,
--    fail_conversation_turn, cancel_conversation_turn, the migration-0039
--    expired-GENERATING recovery, or any future canonical terminalizer that
--    performs the same durable transition - every reservation for that turn
--    still sitting in SELECTED becomes RELEASED in the same transaction.
--    The release is idempotent by predicate (only SELECTED rows match), a
--    binding consumed as BOUND earlier in the same transaction is untouched,
--    and no application `finally` block participates.
CREATE FUNCTION public.release_formal_question_reservations_v1() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN
 PERFORM pg_catalog.set_config('qandeel.formal_question_binding_transition','authorized',true);
 UPDATE public.formal_question_turn_bindings SET state='RELEASED',released_at=CURRENT_TIMESTAMP WHERE source_turn_id=NEW.id AND state='SELECTED';
 PERFORM pg_catalog.set_config('qandeel.formal_question_binding_transition','',true);
 RETURN NULL;END$$;
CREATE TRIGGER conversation_turn_formal_question_release AFTER UPDATE ON public.conversation_turns
 FOR EACH ROW WHEN (OLD.role='USER' AND OLD.status='GENERATING' AND NEW.status IS DISTINCT FROM 'GENERATING')
 EXECUTE FUNCTION public.release_formal_question_reservations_v1();

-- 7. The ONE atomic service-role-only formal Question selection command. The
--    application supplies ONLY the caller identity triple; the database
--    derives the canonical eligible target from owned durable state:
--
--      * automatic Confidence-backed gap (exact migration-0038 source row);
--      * gap status OPEN;
--      * exact source target version still equals the CURRENT Hypothesis
--        version;
--      * Hypothesis lifecycle still questioning-eligible;
--      * Hypothesis scope exactly the CURRENT conversation session
--        (the canonical CONVERSATION_SESSION:<uuid> scope authority -
--        cross-session questioning is structurally impossible here);
--      * the gap's current open epoch not already reserved or consumed;
--      * no outstanding BOUND formal Question whose gap remains OPEN at its
--        bound epoch in this session, and no live SELECTED reservation held
--        by another turn of this session.
--
--    Deterministic v1 ordering: oldest eligible gap by canonical creation
--    ordinal first, stable UUID tie-break. No utility ranking, no Expected
--    Information Gain, no content heuristic, no source voting.
--
--    Concurrency: the per-session advisory lock serializes competing
--    selectors, the source-turn row lock serializes selection against every
--    canonical terminalizer of the same turn (so a late selection after
--    terminalization fails closed instead of leaving an orphan active
--    reservation), and the partial unique indexes above remain the final
--    database backstop. The command is idempotent for the same GENERATING
--    source turn: a legitimate retry returns the SAME SELECTED reservation.
CREATE FUNCTION public.select_formal_question_opportunity_v1(
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
 -- Hypothesis lifecycle commands (transition/attach Evidence) advance a version
 -- with no post-response execution at all - so an obviously stale BOUND row
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

-- 8. The versioned current finalization authority. Exactly the migration-0025
--    atomic semantics - assistant insertion, source USER turn completion, and
--    outbox publication in one transaction, with the identical
--    ConversationTurnCompleted/2.0 event - extended with the formal Question
--    binding step:
--
--      * p_question_binding_id present  => the reservation must belong to the
--        same user/session/source turn, must still be SELECTED, and its
--        gap/open_epoch must still be the reserved canonical target; it is
--        marked BOUND to the inserted assistant turn in the SAME transaction.
--        A stale, foreign, duplicate, or impossible binding fails the whole
--        finalization closed with zero durable writes;
--      * p_question_binding_id absent   => no reservation may be BOUND; any
--        reservation still SELECTED for this turn is RELEASED by the ONE
--        database release trigger when the source turn completes.
CREATE FUNCTION public.finalize_conversation_turn_v2(
  p_session_id uuid,p_user_id uuid,p_source_turn_id uuid,p_assistant_turn_id uuid,p_content text,
  p_safety_disposition text,p_event_id uuid,p_correlation_id uuid DEFAULT NULL,p_orchestration_id uuid DEFAULT NULL,
  p_question_binding_id uuid DEFAULT NULL
) RETURNS TABLE(user_turn jsonb,assistant_turn jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE source_row public.conversation_turns;assistant_row public.conversation_turns;binding_row public.formal_question_turn_bindings;binding_gap public.information_gaps;
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'INVALID_USER' USING ERRCODE='22023';END IF;
 IF p_safety_disposition NOT IN ('ALLOW','GUIDED','BLOCK') THEN RAISE EXCEPTION 'INVALID_SAFETY_DISPOSITION' USING ERRCODE='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.id=p_session_id AND s.user_id=p_user_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT * INTO source_row FROM public.conversation_turns WHERE id=p_source_turn_id AND session_id=p_session_id AND user_id=p_user_id AND role='USER' AND status='GENERATING' FOR UPDATE;
 IF NOT FOUND THEN RETURN;END IF;
 IF p_question_binding_id IS NOT NULL THEN
  SELECT * INTO binding_row FROM public.formal_question_turn_bindings WHERE id=p_question_binding_id FOR UPDATE;
  IF NOT FOUND
     OR binding_row.user_id IS DISTINCT FROM p_user_id
     OR binding_row.session_id IS DISTINCT FROM p_session_id
     OR binding_row.source_turn_id IS DISTINCT FROM p_source_turn_id
     OR binding_row.state IS DISTINCT FROM 'SELECTED'
  THEN RAISE EXCEPTION 'INVALID_QUESTION_BINDING' USING ERRCODE='42501';END IF;
  SELECT * INTO binding_gap FROM public.information_gaps WHERE id=binding_row.information_gap_id AND user_id=p_user_id;
  IF NOT FOUND OR binding_gap.open_epoch IS DISTINCT FROM binding_row.gap_open_epoch
  THEN RAISE EXCEPTION 'INVALID_QUESTION_BINDING' USING ERRCODE='42501';END IF;
 END IF;
 INSERT INTO public.conversation_turns(id,session_id,user_id,role,status,content,processing_path,routing_reason,source_turn_id,completed_at)
 VALUES(p_assistant_turn_id,p_session_id,p_user_id,'ASSISTANT','COMPLETED',p_content,source_row.processing_path,source_row.routing_reason,p_source_turn_id,CURRENT_TIMESTAMP) RETURNING * INTO assistant_row;
 IF p_question_binding_id IS NOT NULL THEN
  PERFORM pg_catalog.set_config('qandeel.formal_question_binding_transition','authorized',true);
  UPDATE public.formal_question_turn_bindings SET state='BOUND',assistant_turn_id=p_assistant_turn_id,bound_at=CURRENT_TIMESTAMP WHERE id=p_question_binding_id;
  PERFORM pg_catalog.set_config('qandeel.formal_question_binding_transition','',true);
 END IF;
 UPDATE public.conversation_turns SET status='COMPLETED',completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=p_source_turn_id RETURNING * INTO source_row;
 INSERT INTO public.runtime_event_outbox(event_id,event_type,event_version,subject_user_id,subject_session_id,subject_turn_id,correlation_id,schema_ref,payload)
 VALUES(p_event_id,'ConversationTurnCompleted','2.0',p_user_id,p_session_id,p_source_turn_id,p_correlation_id,'qandeel.runtime.conversation-turn-completed.v2',jsonb_build_object('user_id',p_user_id,'session_id',p_session_id,'source_turn_id',p_source_turn_id,'terminal_status','COMPLETED','processing_path',source_row.processing_path,'routing_reason',source_row.routing_reason,'orchestration_id',p_orchestration_id,'safety_disposition',p_safety_disposition));
 RETURN QUERY SELECT to_jsonb(source_row),to_jsonb(assistant_row);
END;$$;
ALTER FUNCTION public.finalize_conversation_turn_v2(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.finalize_conversation_turn_v2(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_conversation_turn_v2(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid,uuid) TO service_role;

-- 9. Retire the previous service-role finalization RPC so it cannot remain an
--    executable bypass around the QIR-006 binding semantics. The signature is
--    preserved (CREATE OR REPLACE cannot rename parameters), the body becomes
--    a writeless tombstone that always raises, and EXECUTE is revoked from
--    every application role - service_role included. Historical migrations
--    0022/0025 remain untouched.
CREATE OR REPLACE FUNCTION public.finalize_conversation_turn(
  p_session_id uuid,p_user_id uuid,p_source_turn_id uuid,p_assistant_turn_id uuid,p_content text,
  p_safety_disposition text,p_event_id uuid,p_correlation_id uuid DEFAULT NULL,p_orchestration_id uuid DEFAULT NULL
) RETURNS TABLE(user_turn jsonb,assistant_turn jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RAISE EXCEPTION 'RETIRED_CONVERSATION_FINALIZATION_AUTHORITY' USING ERRCODE='0A000',
   DETAIL='finalize_conversation_turn was retired by migration 0063; the current finalization authority is finalize_conversation_turn_v2.';
END;$$;
REVOKE ALL ON FUNCTION public.finalize_conversation_turn(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- 10. The versioned synchronization authority: the EXACT migration-0038
--     durable-source materialization semantics, extended with canonical
--     closed-loop reconciliation of existing automatic gaps. Reconciliation
--     consumes ONLY this execution's validated durable sources plus the
--     canonical current Hypothesis rows they name - never conversation text,
--     never a "user answered" heuristic, never an arbitrary latest-data scan:
--
--       same exact current Hypothesis version + missing code still present
--           -> OPEN (reuse; a closed gap for that exact tuple reopens with
--              open_epoch + 1 exactly once);
--       same exact current Hypothesis version + missing code no longer
--       present in this execution's fresh canonical evaluation
--           -> RESOLVED;
--       current Hypothesis version moved away from the exact source target,
--       or the Hypothesis lifecycle left the questioning-eligible set
--           -> SUPERSEDED.
--
--     Already-closed gaps stay closed unless their exact tuple becomes
--     actionable again; repeated synchronization of identical durable sources
--     is a no-op on lifecycle state, so the epoch can never be incremented
--     twice for one recurrence. Reconciliation and materialization share one
--     transaction and one globally sorted advisory-lock set (per-hypothesis
--     reconciliation keys plus the v1 per-tuple keys), so cross-execution
--     races on the same Hypothesis serialize deadlock-free.
CREATE FUNCTION public.sync_post_response_information_gaps_v2(p_execution_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 quarantined constant jsonb := jsonb_build_object('status','QUARANTINED','reason','SOURCE_INTEGRITY_FAILURE');
 execution_row public.post_response_intelligence_executions;
 update_effect public.post_response_intelligence_effects;
 confidence_effect public.post_response_intelligence_effects;
 evaluation public.confidence_evaluations;
 receipt jsonb; source jsonb; tuple jsonb; code text; tuple_key text; fresh_key text;
 sources jsonb := '[]'::jsonb;
 tuples jsonb := '[]'::jsonb;
 seen_tuple_keys text[] := '{}';
 seen_fresh_keys text[] := '{}';
 reconcile_hypothesis_ids uuid[] := '{}';
 mutated_hypothesis_id uuid; mutated_after_version integer; mutation_row public.hypotheses;
 hypothesis_row public.hypotheses;
 reconcile_source public.information_gap_confidence_sources;
 reconcile_gap public.information_gaps;
 reconcile_hypothesis uuid;
 lock_keys bigint[] := '{}'; sorted_lock_keys bigint[]; lock_key bigint;
 gap_id uuid; new_gap_id uuid; created public.information_gaps;
 gaps jsonb := '[]'::jsonb; ordinal integer := 0; index integer;
 gap_information_needed text; gap_why_it_matters text;
BEGIN
 -- Execution authority: identical to v1. Only a live post-response execution's
 -- durable typed effects may be consumed; the row lock serializes re-syncs.
 SELECT * INTO execution_row FROM public.post_response_intelligence_executions WHERE id=p_execution_id AND state='RUNNING' FOR UPDATE;
 IF NOT FOUND THEN RETURN quarantined; END IF;
 -- Source A: the durable automatic Hypothesis Update batch. The batch-level
 -- authority is identical to v1; QIR-006 Fix 02 separates the two DIFFERENT
 -- authorities a single receipt carries.
 SELECT * INTO update_effect FROM public.post_response_intelligence_effects
   WHERE execution_id=p_execution_id AND effect_key='HYPOTHESIS_UPDATE_BATCH';
 IF FOUND THEN
  IF update_effect.state IS DISTINCT FROM 'COMPLETED'
     OR update_effect.result_code IS DISTINCT FROM 'UPDATES_APPLIED'
     OR update_effect.result_reference IS NOT NULL
     OR update_effect.result_payload IS NULL
     OR NOT public.post_response_hypothesis_update_batch_result_valid_v1(update_effect.result_payload)
  THEN RETURN quarantined; END IF;
  FOR receipt IN SELECT entry.value FROM jsonb_array_elements(update_effect.result_payload) AS entry(value) LOOP
   -- (A) RECONCILIATION TARGET AUTHORITY.
   --
   -- Every schema-valid receipt of a COMPLETED UPDATES_APPLIED batch proves
   -- that its Hypothesis was successfully mutated to afterVersion and that the
   -- mutation COMMITTED. Migration 0034 deliberately keeps that mutation
   -- committed even when the exact-version Confidence attempt then fails, in
   -- which case the durable receipt records confidenceStatus=PENDING_RETRY.
   -- The mutated Hypothesis must therefore participate in canonical
   -- current-state reconciliation in BOTH cases: consuming only EVALUATED
   -- receipts would let a committed version advance leave its old exact-version
   -- gap OPEN forever, which both violates the SUPERSEDED rule and keeps a
   -- stale formal Question outstanding for the session.
   --
   -- Server-owned integrity is proven FIRST, from canonical state rather than
   -- from the payload: the receipt identity must be a Hypothesis owned by the
   -- execution owner, afterVersion must be a valid successful mutation version,
   -- and canonical current state must not be BEHIND it (a later batch may have
   -- advanced the Hypothesis further, but it can never be older than a
   -- committed mutation). An impossible, foreign or malformed relationship
   -- fails closed exactly like every other source-integrity violation. No
   -- Confidence row is required here: a PENDING_RETRY attempt failed by
   -- definition, so no successful evaluation is guaranteed to exist.
   mutated_hypothesis_id := (receipt->>'hypothesisId')::uuid;
   mutated_after_version := (receipt->>'afterVersion')::integer;
   mutation_row := NULL;
   SELECT * INTO mutation_row FROM public.hypotheses WHERE id=mutated_hypothesis_id AND user_id=execution_row.user_id;
   IF mutation_row.id IS NULL
      OR mutated_after_version IS NULL
      OR mutated_after_version<1
      OR mutation_row.version<mutated_after_version
   THEN RETURN quarantined; END IF;
   IF NOT mutated_hypothesis_id=ANY(reconcile_hypothesis_ids) THEN reconcile_hypothesis_ids := array_append(reconcile_hypothesis_ids,mutated_hypothesis_id); END IF;
   -- (B) FRESH CONFIDENCE AUTHORITY.
   --
   -- ONLY an EVALUATED receipt carries a successful exact-version Confidence
   -- evaluation. A PENDING_RETRY receipt never enters the fresh source set, so
   -- it can never fabricate a Confidence identity, never authorizes RESOLVED,
   -- never authorizes a reopen, and never states presence or absence of any
   -- missing-information code: for its version the answer stays UNKNOWN and no
   -- closure decision is taken.
   IF receipt->>'confidenceStatus'='EVALUATED' THEN
    sources := sources || jsonb_build_object(
      'evaluationId',receipt->>'confidenceEvaluationId',
      'hypothesisId',receipt->>'hypothesisId',
      'targetVersion',(receipt->>'afterVersion')::integer);
   END IF;
  END LOOP;
 END IF;
 -- Source B: the durable managed generation Confidence batch (identical to v1).
 SELECT * INTO confidence_effect FROM public.post_response_intelligence_effects
   WHERE execution_id=p_execution_id AND effect_key='CONFIDENCE_BATCH';
 IF FOUND THEN
  IF confidence_effect.state IS DISTINCT FROM 'COMPLETED' OR confidence_effect.result_reference IS NOT NULL THEN RETURN quarantined; END IF;
  IF confidence_effect.result_code='NO_CONFIDENCE_TARGETS' THEN
   IF confidence_effect.result_payload IS NOT NULL THEN RETURN quarantined; END IF;
  ELSIF confidence_effect.result_code='CONFIDENCE_BATCH_EVALUATED' THEN
   IF confidence_effect.result_payload IS NULL
      OR NOT public.post_response_confidence_batch_result_valid_v1(confidence_effect.result_payload)
   THEN RETURN quarantined; END IF;
   FOR receipt IN SELECT entry.value FROM jsonb_array_elements(confidence_effect.result_payload) AS entry(value) LOOP
    sources := sources || jsonb_build_object(
      'evaluationId',receipt->>'confidenceEvaluationId',
      'hypothesisId',receipt->>'hypothesisId',
      'targetVersion',(receipt->>'targetVersion')::integer);
   END LOOP;
  ELSE RETURN quarantined; END IF;
 END IF;
 -- Validate the ENTIRE derived source set first (identical to v1), while also
 -- recording, per exact validated (hypothesis, target version), that a fresh
 -- canonical Confidence statement exists in THIS execution - the only
 -- authority the RESOLVED/reopen reconciliation below may consume.
 FOR index IN 0..jsonb_array_length(sources)-1 LOOP
  source := sources->index;
  SELECT * INTO evaluation FROM public.confidence_evaluations WHERE id=(source->>'evaluationId')::uuid;
  IF NOT FOUND
     OR evaluation.user_id IS DISTINCT FROM execution_row.user_id
     OR evaluation.target_type IS DISTINCT FROM 'HYPOTHESIS'
     OR evaluation.target_id IS DISTINCT FROM (source->>'hypothesisId')::uuid
     OR evaluation.target_version IS DISTINCT FROM (source->>'targetVersion')::integer
     OR evaluation.lifecycle_state IS DISTINCT FROM 'EVALUATED'
     OR evaluation.provenance IS DISTINCT FROM 'QANDEEL_CONFIDENCE_RUNTIME'
     OR evaluation.policy_version IS DISTINCT FROM 'confidence-foundation-v1'
     OR evaluation.numeric_score IS NOT NULL
     OR evaluation.confidence_band IS NOT NULL
  THEN RETURN quarantined; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.hypotheses WHERE id=evaluation.target_id AND user_id=execution_row.user_id) THEN RETURN quarantined; END IF;
  FOREACH code IN ARRAY evaluation.missing_information_codes LOOP
   IF code NOT IN ('NO_ELIGIBLE_EVIDENCE','UNVERIFIED_ASSUMPTIONS','COMPETING_HYPOTHESES_UNASSESSED','CONFIDENCE_MODEL_UNCALIBRATED') THEN RETURN quarantined; END IF;
  END LOOP;
  fresh_key := lower(evaluation.target_id::text)||':'||evaluation.target_version::text;
  IF NOT fresh_key=ANY(seen_fresh_keys) THEN seen_fresh_keys := array_append(seen_fresh_keys,fresh_key); END IF;
  IF NOT evaluation.target_id=ANY(reconcile_hypothesis_ids) THEN reconcile_hypothesis_ids := array_append(reconcile_hypothesis_ids,evaluation.target_id); END IF;
  FOREACH code IN ARRAY evaluation.missing_information_codes LOOP
   CONTINUE WHEN code='CONFIDENCE_MODEL_UNCALIBRATED';
   tuple_key := lower(evaluation.target_id::text)||':'||evaluation.target_version::text||':'||code;
   CONTINUE WHEN tuple_key=ANY(seen_tuple_keys);
   seen_tuple_keys := array_append(seen_tuple_keys,tuple_key);
   tuples := tuples || jsonb_build_object(
     'hypothesisId',evaluation.target_id,
     'targetVersion',evaluation.target_version,
     'code',code,
     'evaluationId',evaluation.id);
  END LOOP;
 END LOOP;
 -- The bounded result set implied by the current contracts (identical to v1).
 IF jsonb_array_length(tuples)>27 THEN RETURN quarantined; END IF;
 -- QIR-006 Fix 02: the reconciliation target set is bounded by the same
 -- contracts - at most 4 durable update receipts plus 5 generation receipts, so
 -- at most 9 distinct Hypotheses. If upstream bounds ever widen inconsistently,
 -- fail closed instead of silently reconciling an unbounded set.
 IF cardinality(reconcile_hypothesis_ids)>9 THEN RETURN quarantined; END IF;
 -- Cross-execution race safety: ONE globally sorted advisory-lock set covering
 -- both the v1 per-tuple materialization keys and the v2 per-hypothesis
 -- reconciliation keys, acquired in sorted order (deadlock-free).
 FOR index IN 0..jsonb_array_length(tuples)-1 LOOP
  tuple := tuples->index;
  lock_keys := array_append(lock_keys, pg_catalog.hashtextextended(
    'qandeel_information_gap_source:'||execution_row.user_id::text||':'||lower(tuple->>'hypothesisId')||':'||(tuple->>'targetVersion')||':'||(tuple->>'code'), 0));
 END LOOP;
 FOREACH reconcile_hypothesis IN ARRAY reconcile_hypothesis_ids LOOP
  lock_keys := array_append(lock_keys, pg_catalog.hashtextextended(
    'qandeel_information_gap_reconciliation:'||execution_row.user_id::text||':'||lower(reconcile_hypothesis::text), 0));
 END LOOP;
 SELECT coalesce(array_agg(DISTINCT key ORDER BY key),'{}'::bigint[]) INTO sorted_lock_keys FROM unnest(lock_keys) AS key;
 FOREACH lock_key IN ARRAY sorted_lock_keys LOOP
  PERFORM pg_catalog.pg_advisory_xact_lock(lock_key);
 END LOOP;
 -- QIR-006 canonical closed-loop reconciliation. For every existing automatic
 -- source tuple of every Hypothesis this execution's validated sources name,
 -- decide OPEN / RESOLVED / SUPERSEDED / reopen from canonical durable state
 -- alone. Deterministic order: source creation, then gap identity.
 PERFORM pg_catalog.set_config('qandeel.information_gap_lifecycle_transition','authorized',true);
 FOREACH reconcile_hypothesis IN ARRAY reconcile_hypothesis_ids LOOP
  SELECT * INTO hypothesis_row FROM public.hypotheses WHERE id=reconcile_hypothesis AND user_id=execution_row.user_id;
  FOR reconcile_source IN
    SELECT s.* FROM public.information_gap_confidence_sources s
    WHERE s.user_id=execution_row.user_id AND s.hypothesis_id=reconcile_hypothesis
    ORDER BY s.created_at ASC, s.information_gap_id ASC
  LOOP
   SELECT g.* INTO reconcile_gap FROM public.information_gaps g WHERE g.id=reconcile_source.information_gap_id FOR UPDATE;
   IF hypothesis_row.version IS DISTINCT FROM reconcile_source.target_version
      OR NOT public.question_eligible_hypothesis_lifecycle_v1(hypothesis_row.status) THEN
    -- The exact source tuple is no longer a valid current target.
    IF reconcile_gap.status='OPEN' THEN
     UPDATE public.information_gaps SET status='SUPERSEDED',closed_at=CURRENT_TIMESTAMP,
       closure_reason=CASE WHEN hypothesis_row.version IS DISTINCT FROM reconcile_source.target_version
         THEN 'HYPOTHESIS_VERSION_ADVANCED' ELSE 'HYPOTHESIS_LIFECYCLE_INELIGIBLE' END,
       updated_at=CURRENT_TIMESTAMP
      WHERE id=reconcile_gap.id;
    END IF;
   ELSIF (lower(reconcile_source.hypothesis_id::text)||':'||reconcile_source.target_version::text)=ANY(seen_fresh_keys) THEN
    -- A fresh canonical evaluation for the SAME exact current version exists
    -- in this execution: it is the authority on whether the missing code is
    -- still present.
    IF (lower(reconcile_source.hypothesis_id::text)||':'||reconcile_source.target_version::text||':'||reconcile_source.missing_information_code)=ANY(seen_tuple_keys) THEN
     IF reconcile_gap.status<>'OPEN' THEN
      -- The same canonical information need legitimately recurred after
      -- closure: reuse the canonical gap identity, increment the epoch exactly
      -- once, and clear closure metadata.
      UPDATE public.information_gaps SET status='OPEN',closed_at=NULL,closure_reason=NULL,
        open_epoch=reconcile_gap.open_epoch+1,updated_at=CURRENT_TIMESTAMP
       WHERE id=reconcile_gap.id;
     END IF;
    ELSIF reconcile_gap.status='OPEN' THEN
     UPDATE public.information_gaps SET status='RESOLVED',closed_at=CURRENT_TIMESTAMP,
       closure_reason='MISSING_INFORMATION_CODE_ABSENT',updated_at=CURRENT_TIMESTAMP
      WHERE id=reconcile_gap.id;
    END IF;
   END IF;
   -- No fresh evaluation for the exact current version: no closure decision is
   -- fabricated. A user turn by itself never resolves a gap.
  END LOOP;
 END LOOP;
 PERFORM pg_catalog.set_config('qandeel.information_gap_lifecycle_transition','',true);
 -- Deterministic materialization in canonical source order (identical to v1).
 -- A reopened tuple was already set back to OPEN above, so reuse returns the
 -- same canonical gap identity for the recurring information need.
 FOR index IN 0..jsonb_array_length(tuples)-1 LOOP
  tuple := tuples->index;
  ordinal := ordinal + 1;
  SELECT information_gap_id INTO gap_id FROM public.information_gap_confidence_sources
   WHERE user_id=execution_row.user_id
     AND hypothesis_id=(tuple->>'hypothesisId')::uuid
     AND target_version=(tuple->>'targetVersion')::integer
     AND missing_information_code=tuple->>'code';
  IF NOT FOUND THEN
   gap_information_needed := CASE tuple->>'code'
     WHEN 'NO_ELIGIBLE_EVIDENCE' THEN 'Eligible evidence for the current Hypothesis version is missing.'
     WHEN 'UNVERIFIED_ASSUMPTIONS' THEN 'One or more assumptions in the current Hypothesis remain unverified.'
     ELSE 'Competing Hypotheses remain unassessed in the current Confidence snapshot.' END;
   gap_why_it_matters := 'Confidence Runtime reported '||(tuple->>'code')||' for this exact Hypothesis version.';
   new_gap_id := pg_catalog.gen_random_uuid();
   created := NULL;
   SELECT * INTO created FROM public.create_information_gap_core_v1(execution_row.user_id, jsonb_build_object(
     'id',new_gap_id,
     'information_needed',gap_information_needed,
     'why_it_matters',gap_why_it_matters,
     'related_hypothesis_ids',jsonb_build_array(tuple->>'hypothesisId'),
     'confidence_evaluation_id',tuple->>'evaluationId',
     'user_answerability','UNASSESSED'));
   IF created.id IS NULL
      OR created.id IS DISTINCT FROM new_gap_id
      OR created.user_id IS DISTINCT FROM execution_row.user_id
      OR created.related_hypothesis_ids IS DISTINCT FROM ARRAY[(tuple->>'hypothesisId')::uuid]
      OR created.confidence_evaluation_id IS DISTINCT FROM (tuple->>'evaluationId')::uuid
      OR created.user_answerability IS DISTINCT FROM 'UNASSESSED'
      OR created.preferred_question_type IS NOT NULL
      OR created.status IS DISTINCT FROM 'OPEN'
      OR created.version IS DISTINCT FROM 1
      OR created.provenance IS DISTINCT FROM 'QANDEEL_QUESTION_RUNTIME'
   THEN RAISE EXCEPTION 'INFORMATION_GAP_SYNC_INTEGRITY' USING ERRCODE='XX000'; END IF;
   INSERT INTO public.information_gap_confidence_sources(information_gap_id,user_id,hypothesis_id,target_version,confidence_evaluation_id,missing_information_code)
    VALUES(created.id,execution_row.user_id,(tuple->>'hypothesisId')::uuid,(tuple->>'targetVersion')::integer,(tuple->>'evaluationId')::uuid,tuple->>'code');
   gap_id := created.id;
  END IF;
  gaps := gaps || jsonb_build_object(
    'ordinal',ordinal,
    'informationGapId',gap_id,
    'hypothesisId',lower(tuple->>'hypothesisId'),
    'targetVersion',(tuple->>'targetVersion')::integer,
    'missingInformationCode',tuple->>'code');
 END LOOP;
 IF ordinal=0 THEN RETURN jsonb_build_object('status','NO_INFORMATION_GAPS','gaps',jsonb_build_array()); END IF;
 RETURN jsonb_build_object('status','INFORMATION_GAPS_AVAILABLE','gaps',gaps);
END;$$;
ALTER FUNCTION public.sync_post_response_information_gaps_v2(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sync_post_response_information_gaps_v2(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_post_response_information_gaps_v2(uuid) TO service_role;

-- 11. v1 becomes a pure delegating wrapper over the ONE current authority, so
--     exactly one process-level materialization/closure implementation exists
--     and the historical service-role entry point keeps its exact signature,
--     result contract, and ACL. CREATE OR REPLACE preserves the migration-0038
--     grants (service_role-only EXECUTE).
CREATE OR REPLACE FUNCTION public.sync_post_response_information_gaps_v1(p_execution_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RETURN public.sync_post_response_information_gaps_v2(p_execution_id);
END;$$;

-- 12. Postconditions: fail the migration loudly if any QIR-006 authority,
--     ACL, guard, index, retirement, or delegation invariant does not hold on
--     the migrated schema.
DO $$
DECLARE p record; fn text; def text; guard_def text;
BEGIN
 -- 12a. The internal binding substrate: zero direct privileges for every
 --      application role, RLS enabled, both guard triggers and the release
 --      trigger installed, and the two partial unique concurrency indexes.
 FOR p IN SELECT r.role_name,r.privilege FROM (VALUES
   ('anon','SELECT'),('anon','INSERT'),('anon','UPDATE'),('anon','DELETE'),
   ('authenticated','SELECT'),('authenticated','INSERT'),('authenticated','UPDATE'),('authenticated','DELETE'),
   ('service_role','SELECT'),('service_role','INSERT'),('service_role','UPDATE'),('service_role','DELETE')) AS r(role_name,privilege) LOOP
  IF has_table_privilege(p.role_name,'public.formal_question_turn_bindings',p.privilege) THEN
   RAISE EXCEPTION 'Direct % privilege for % on the formal question binding substrate is forbidden',p.privilege,p.role_name;END IF;
 END LOOP;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.formal_question_turn_bindings'::regclass) THEN
  RAISE EXCEPTION 'RLS must be enabled on the formal question binding substrate';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.formal_question_turn_bindings'::regclass AND tgname='formal_question_turn_binding_guard' AND NOT tgisinternal) THEN
  RAISE EXCEPTION 'The formal question binding lifecycle guard trigger is missing';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.information_gaps'::regclass AND tgname='information_gap_lifecycle_guard' AND NOT tgisinternal) THEN
  RAISE EXCEPTION 'The information gap lifecycle guard trigger is missing';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.conversation_turns'::regclass AND tgname='conversation_turn_formal_question_release' AND NOT tgisinternal) THEN
  RAISE EXCEPTION 'The one database-owned terminal release trigger is missing';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='formal_question_turn_bindings' AND indexname='formal_question_one_active_reservation_per_gap_epoch' AND indexdef LIKE '%WHERE%RELEASED%') THEN
  RAISE EXCEPTION 'The one-active-reservation-per-gap-epoch partial unique index is missing';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='formal_question_turn_bindings' AND indexname='formal_question_one_selected_reservation_per_session' AND indexdef LIKE '%WHERE%SELECTED%') THEN
  RAISE EXCEPTION 'The one-live-SELECTED-reservation-per-session partial unique index is missing';END IF;
 -- 12b. New command ACLs: the selection command, the v2 finalization authority
 --      and the v2 synchronization authority are service-role-only definer
 --      commands; the lifecycle predicate and both guard functions are
 --      internal.
 FOR fn IN SELECT unnest(ARRAY[
   'public.select_formal_question_opportunity_v1(uuid,uuid,uuid)',
   'public.finalize_conversation_turn_v2(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid,uuid)',
   'public.sync_post_response_information_gaps_v2(uuid)']) LOOP
  IF NOT has_function_privilege('service_role',fn,'EXECUTE') THEN RAISE EXCEPTION 'service_role must hold EXECUTE on %',fn;END IF;
  IF has_function_privilege('authenticated',fn,'EXECUTE') OR has_function_privilege('anon',fn,'EXECUTE') THEN
   RAISE EXCEPTION 'authenticated/anon must not hold EXECUTE on %',fn;END IF;
  SELECT prosecdef INTO p FROM pg_proc WHERE oid=fn::regprocedure;
  IF NOT p.prosecdef THEN RAISE EXCEPTION '% must be SECURITY DEFINER',fn;END IF;
 END LOOP;
 IF has_function_privilege('service_role','public.question_eligible_hypothesis_lifecycle_v1(text)','EXECUTE')
    OR has_function_privilege('authenticated','public.question_eligible_hypothesis_lifecycle_v1(text)','EXECUTE')
    OR has_function_privilege('anon','public.question_eligible_hypothesis_lifecycle_v1(text)','EXECUTE') THEN
  RAISE EXCEPTION 'The questioning-eligibility predicate is internal-only';END IF;
 -- 12c. The retired finalization authority: zero EXECUTE for every application
 --      role, and a writeless tombstone body (no insert/update/delete
 --      statement shapes and no outbox reference survive in it).
 FOR fn IN SELECT unnest(ARRAY['service_role','authenticated','anon','public']) LOOP
  IF has_function_privilege(fn,'public.finalize_conversation_turn(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid)','EXECUTE') THEN
   RAISE EXCEPTION 'The retired finalization authority must hold zero EXECUTE for %',fn;END IF;
 END LOOP;
 def := pg_get_functiondef('public.finalize_conversation_turn(uuid,uuid,uuid,uuid,text,text,uuid,uuid,uuid)'::regprocedure);
 IF position('RETIRED_CONVERSATION_FINALIZATION_AUTHORITY' in def)=0 THEN
  RAISE EXCEPTION 'The retired finalization authority must be a raising tombstone';END IF;
 IF def ~* 'insert\s+into' OR def ~* 'update\s+public' OR def ~* 'delete\s+from' OR position('runtime_event_outbox' in def)>0 THEN
  RAISE EXCEPTION 'The retired finalization tombstone must contain no write';END IF;
 -- 12d. The v1 synchronization entry point is a pure delegation to v2: it
 --      names the v2 authority and contains no write of its own, so exactly
 --      one materialization/closure implementation exists.
 def := pg_get_functiondef('public.sync_post_response_information_gaps_v1(uuid)'::regprocedure);
 IF position('sync_post_response_information_gaps_v2' in def)=0 THEN
  RAISE EXCEPTION 'The v1 synchronization entry point must delegate to the v2 authority';END IF;
 IF def ~* 'insert\s+into' OR def ~* 'update\s+public' OR def ~* 'delete\s+from' THEN
  RAISE EXCEPTION 'The v1 synchronization entry point must contain no write of its own';END IF;
 IF NOT has_function_privilege('service_role','public.sync_post_response_information_gaps_v1(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'The v1 synchronization entry point keeps its service-role EXECUTE';END IF;
 -- 12e. The guard triggers require the internal transition authorizations.
 guard_def := pg_get_functiondef('public.guard_information_gap_lifecycle_mutation()'::regprocedure);
 IF position('qandeel.information_gap_lifecycle_transition' in guard_def)=0 THEN
  RAISE EXCEPTION 'The gap lifecycle guard must require the internal transition authorization';END IF;
 guard_def := pg_get_functiondef('public.guard_formal_question_turn_binding_mutation()'::regprocedure);
 IF position('qandeel.formal_question_binding_transition' in guard_def)=0 THEN
  RAISE EXCEPTION 'The binding lifecycle guard must require the internal transition authorization';END IF;
 -- 12f. QIR-006 Fix 02, proven on the INSTALLED definitions: the two receipt
 --      authorities are separated in the synchronization command, and the
 --      outstanding-question check is canonical-current-state authoritative.
 def := pg_get_functiondef('public.sync_post_response_information_gaps_v2(uuid)'::regprocedure);
 IF position('reconcile_hypothesis_ids := array_append(reconcile_hypothesis_ids,mutated_hypothesis_id)' in def)=0 THEN
  RAISE EXCEPTION 'Every successful mutation receipt must enter the reconciliation target set';END IF;
 IF position('mutation_row.version<mutated_after_version' in def)=0 THEN
  RAISE EXCEPTION 'The reconciliation target authority must prove the mutated version against canonical current state';END IF;
 IF position('cardinality(reconcile_hypothesis_ids)>9' in def)=0 THEN
  RAISE EXCEPTION 'The reconciliation target set must stay bounded';END IF;
 -- The fresh-Confidence gate must remain the ONLY consumer of EVALUATED, and it
 -- must sit AFTER the reconciliation-target step, so a PENDING_RETRY receipt
 -- reconciles without ever contributing a source.
 IF position('''EVALUATED''' in def)=0
    OR position('reconcile_hypothesis_ids := array_append(reconcile_hypothesis_ids,mutated_hypothesis_id)' in def)
       > position('IF receipt->>''confidenceStatus''=''EVALUATED'' THEN' in def) THEN
  RAISE EXCEPTION 'The fresh Confidence authority must remain EVALUATED-only and follow the reconciliation target step';END IF;
 def := pg_get_functiondef('public.select_formal_question_opportunity_v1(uuid,uuid,uuid)'::regprocedure);
 IF (length(def)-length(replace(def,'h.version=s.target_version','')))/length('h.version=s.target_version') < 2 THEN
  RAISE EXCEPTION 'The outstanding-question check must be current-Hypothesis-version authoritative, exactly like selection eligibility';END IF;
 IF (length(def)-length(replace(def,'public.question_eligible_hypothesis_lifecycle_v1(h.status)','')))/length('public.question_eligible_hypothesis_lifecycle_v1(h.status)') < 2 THEN
  RAISE EXCEPTION 'The outstanding-question check must require a questioning-eligible current lifecycle';END IF;
 -- 12g. Every historical information gap survived as an epoch-1 OPEN row with
 --      no closure metadata fabricated.
 IF EXISTS(SELECT 1 FROM public.information_gaps WHERE open_epoch<>1 OR status<>'OPEN' OR closed_at IS NOT NULL OR closure_reason IS NOT NULL) THEN
  RAISE EXCEPTION 'Historical information gaps must be preserved as epoch-1 OPEN rows';END IF;
END$$;

COMMIT;
