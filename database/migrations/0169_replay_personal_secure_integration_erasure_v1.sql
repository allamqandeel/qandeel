-- S7-01 - Replay Secure Integration & Account Erasure v1.
--
-- Product authority: the Product Owner's approval of Stage 7 / WP0 (and its corrective addendum) and the S7-01 Task
-- Brief, 2026-10-19: a real Personal text Replay with a true preview and a private final version; one contiguous range of
-- whole messages; MY_WORLD only; no audio presented as original; no video, export, distribution or Replay library; I-06
-- and every closed design preserved. The execution record is docs/e2e/QANDEEL_S7_01_IMPLEMENTATION_RECORD_v1.md. Nothing
-- below is Product authority of its own.
--
-- The frozen I-06 Replay runtime (0100-0107) is fully implemented and executable by NO application role: its two I-06A
-- primitives and three I-06B primitives wait for "a later reviewed launch-gated wrapper [that] preserves the exact human's
-- own session claims" (0101 header, 0103 section 13, docs/replay-runtime-v1.md sections 11, 30, 59). This migration is
-- that wrapper, for the Personal source only, and nothing else. No I-06 primitive, core, derivation or resolver is
-- granted, re-created or re-owned; none of their bodies changes.
--
-- ## What this adds
--
--   1. `replay_private` - a non-exposed schema for every privileged part (the 0138 / 0140 / 0143 shape). Every function
--      in the exposed `public` schema is a one-line SECURITY INVOKER call into its definer, granted to `authenticated`
--      alone.
--   2. A minimal Personal Replay launch gate (0138's shape, CW2-08 sections 24-29 and 40): one server-canonical state row
--      for the one capability scope `PERSONAL_REPLAY`, changed only by an operator function no application role can
--      execute, every change audited. An absent row is UNCONFIGURED and DENIES. This migration configures nothing: the
--      capability starts closed. It is NOT the CW2-08 Launch Gate and claims no Safety, moderation, entitlement or launch
--      clearance: the frozen CW2-08 prerequisite seam still answers NOT_EVALUATED, and every distribution path (I-06C /
--      I-06D) stays exactly as closed as it was. Creating a private Replay is CREATE_INTERNAL_REPLAY_DRAFT, which the
--      I-01A kernel classifies as NO_AUDIENCE_EXPANSION; distributing one is not reachable from anything here.
--   3. Five gated human commands, each the frozen I-06 primitive called as the session subject (auth.uid()), never a
--      substituted principal: create a draft, revise it, prepare the preview, finalize the private version, reopen it
--      for revision. The client names a Session it owns and ONE contiguous range of whole messages by their Session
--      Positions - never a unit, item, manifest, selection, projection, contract or version identity, never a coverage
--      class, an actor or an authority. The wrapper resolves the exact committed units under the caller's own ownership,
--      derives every persistence identity from (actor, command) so an equivalent retry is the same request, and lets the
--      frozen primitive decide everything it decides. Every refusal is ONE bounded word; every 40001 of the frozen
--      primitives is absorbed (a PostgREST before v16 would re-run it without bound - QAN-BL-PROD-06, 0150).
--   4. Five creator-exact reads, ungated (a human is never trapped out of what already exists): the Replay, one exact
--      version with its render contract and current viewing state, its moments (the source layer), one moment's verified
--      analytical answer, and the human's Replays of one of their own conversations. Everyone else receives ZERO ROWS -
--      also the answer for a Replay or version that does not exist - so no read is an existence oracle. No read returns
--      a Session, unit, turn, manifest, selection, digest, staleness cause or any other source identity.
--   5. The account erasure of the Personal Replay footprint (QAN-BL-ACCT-02, ACCT-DEL-01's frozen framework): a module in
--      the governed coordinator's one subtransaction, before the unchanged 0130 Personal erasure; the two I-06 append-only
--      guards that refuse DELETE narrowed IN PLACE with exactly 0164's prefix (DELETE only under the transaction-bound
--      erasure authorization); every Replay relation registered; the `REPLAY` residue class covered. A Replay footprint
--      the Personal module does not cover - a non-Personal source, a distribution package, reconciliation evidence,
--      another human's Replay naming this account - is the new uncovered class `REPLAY_OUTSIDE_PERSONAL`
--      (QAN-BL-ACCT-03) and stays a truthful BLOCKED: nothing of another human's Replay rights is touched.
--
-- ## The data contract (independent of every graphic)
--
-- Every read speaks the frozen I-06 truth vocabulary only: lifecycle, draft revision, coverage, version revision, Session
-- Position, source role, original medium, omitted-source count, the render contract policy tuple, the two I-06D layers.
-- No colour, coordinate the Replay authors, motion, timing curve, React component or Map model exists anywhere here. The
-- analytical answer of a moment is the canonical K(TC) (0072) itself, re-derived through
-- `get_session_historical_projection_v1` under the human's own auth.uid() and served only when it re-digests to exactly
-- what the version froze (0103 section 5): no second projection, no current rerun, no hindsight. It carries exactly the
-- families the frozen commitment covers; `moments` (the source events) and `materials[].expiry` (a wall-clock policy
-- fact) are the two exclusions of 0103 section 21 and are not part of it. A moment is viewable only while its version's
-- source is currently available (I-06D section 51: the analytical layer never stands in for a missing source).
--
-- ## What is deliberately NOT here
--
-- No Shared or Public source (the Product Owner's MY_WORLD-only decision), no partial-message cut (Semantic Cut Safety is
-- UNPROVEN for code-point ranges), no audio, no video, no export, no download, no distribution, no Replay library, no
-- mobile surface, no player. No change to any I-06 body other than the two guard prefixes, no change to 0130, no CW2-08
-- runtime. Forward-only: migrations 0001-0168 are untouched as files.
--
-- ## Lock order (continues I-06 and 0164; never reversed)
--
--   0. the gate row of PERSONAL_REPLAY      (FOR SHARE - the snapshot an operator change must wait for)
--   1. public.replays, then each frozen I-06 step in its own frozen order (inside the primitives)
--   2. the launch evidence row, after the primitive returned
--
--   Account erasure: 0164's order with the account's Replays (ascending, FOR UPDATE) after the Introduction claims and
--   before the account row - every Replay path takes the Replay row before any source row, and none takes the account
--   row, so no Replay path can be the second edge of a cycle with the erasure.
BEGIN;

CREATE SCHEMA replay_private;
ALTER SCHEMA replay_private OWNER TO postgres;
REVOKE ALL ON SCHEMA replay_private FROM PUBLIC;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. THE MINIMAL PERSONAL REPLAY LAUNCH GATE. Server-canonical; no application role reads or writes these tables.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE replay_private.replay_launch_capability_states (
    capability_scope text NOT NULL,
    feature_flag_state text NOT NULL,
    launch_requirements_state text NOT NULL,
    restriction_version bigint NOT NULL,
    decided_by text NOT NULL,
    policy_basis text NOT NULL,
    decided_at timestamptz NOT NULL,
    CONSTRAINT replay_launch_capability_states_pk PRIMARY KEY (capability_scope),
    CONSTRAINT replay_launch_capability_states_scope_check CHECK (capability_scope IN ('PERSONAL_REPLAY')),
    CONSTRAINT replay_launch_capability_states_flag_check
        CHECK (feature_flag_state IN ('DISABLED', 'INTERNAL', 'LIMITED_ROLLOUT', 'ENABLED', 'EMERGENCY_DISABLED')),
    CONSTRAINT replay_launch_capability_states_requirements_check
        CHECK (launch_requirements_state IN ('SATISFIED', 'UNSATISFIED', 'UNKNOWN', 'WAIVED_BY_AUTHORIZED_GOVERNANCE')),
    CONSTRAINT replay_launch_capability_states_version_check CHECK (restriction_version >= 1),
    CONSTRAINT replay_launch_capability_states_decided_by_check CHECK (length(btrim(decided_by)) BETWEEN 1 AND 120),
    CONSTRAINT replay_launch_capability_states_basis_check CHECK (length(btrim(policy_basis)) BETWEEN 1 AND 500)
);

-- Append-only audit of every gate decision (CW2-08 section 36): actor, scope, decision, version, time.
CREATE TABLE replay_private.replay_launch_capability_events (
    id bigint GENERATED ALWAYS AS IDENTITY,
    capability_scope text NOT NULL,
    feature_flag_state text NOT NULL,
    launch_requirements_state text NOT NULL,
    restriction_version bigint NOT NULL,
    decided_by text NOT NULL,
    policy_basis text NOT NULL,
    decided_at timestamptz NOT NULL,
    CONSTRAINT replay_launch_capability_events_pk PRIMARY KEY (id),
    CONSTRAINT replay_launch_capability_events_scope_fk
        FOREIGN KEY (capability_scope) REFERENCES replay_private.replay_launch_capability_states (capability_scope) ON DELETE RESTRICT,
    CONSTRAINT replay_launch_capability_events_version_key UNIQUE (capability_scope, restriction_version)
);

-- The gate snapshot every committed Personal Replay act was bound to, written in that act's own transaction (CW2-08
-- section 25). Only an ALLOW snapshot is representable. It names the Replay and the command, and no human: the creator
-- is the Replay's own frozen identity.
CREATE TABLE replay_private.personal_replay_launch_evidence (
    command_kind text NOT NULL,
    command_id uuid NOT NULL,
    replay_id uuid NOT NULL,
    capability_scope text NOT NULL,
    restriction_version bigint NOT NULL,
    feature_flag_state text NOT NULL,
    launch_requirements_state text NOT NULL,
    bound_at timestamptz NOT NULL,
    CONSTRAINT personal_replay_launch_evidence_pk PRIMARY KEY (command_kind, command_id),
    CONSTRAINT personal_replay_launch_evidence_kind_check
        CHECK (command_kind IN ('CREATE', 'REVISE', 'PREVIEW', 'FINALIZE', 'REOPEN')),
    CONSTRAINT personal_replay_launch_evidence_replay_fk
        FOREIGN KEY (replay_id) REFERENCES public.replays (id) ON DELETE RESTRICT,
    CONSTRAINT personal_replay_launch_evidence_allow_check
        CHECK (capability_scope = 'PERSONAL_REPLAY' AND feature_flag_state = 'ENABLED'
               AND launch_requirements_state IN ('SATISFIED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE')),
    CONSTRAINT personal_replay_launch_evidence_version_check CHECK (restriction_version >= 1)
);
CREATE INDEX personal_replay_launch_evidence_replay_idx ON replay_private.personal_replay_launch_evidence (replay_id);

-- The two account columns of Replay relations that had no leading index: the erasure's census probes each and the final
-- account DELETE checks each RESTRICT reference to the account. Plain indexes only: no constraint, no semantics.
CREATE INDEX s7_01_replay_required_approvers_user_idx ON public.replay_distribution_required_approvers (approver_user_id);
CREATE INDEX s7_01_replay_authorizations_user_idx ON public.replay_distribution_authorizations (authorized_by_user_id);

ALTER TABLE replay_private.replay_launch_capability_states OWNER TO postgres;
ALTER TABLE replay_private.replay_launch_capability_events OWNER TO postgres;
ALTER TABLE replay_private.personal_replay_launch_evidence OWNER TO postgres;
ALTER TABLE replay_private.replay_launch_capability_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE replay_private.replay_launch_capability_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE replay_private.personal_replay_launch_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE replay_private.replay_launch_capability_states, replay_private.replay_launch_capability_events,
                    replay_private.personal_replay_launch_evidence
  FROM PUBLIC, anon, authenticated;

-- The launch evidence is durable history like the frozen Replay relations beside it, with the same one exception.
CREATE FUNCTION replay_private.reject_personal_replay_launch_evidence_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  -- S7-01 (0169): the governed account erasure alone may DELETE; nothing else changes.
  IF TG_OP = 'DELETE' THEN
    IF pg_catalog.current_setting('qandeel.account_erasure', true) = pg_catalog.txid_current()::text THEN
      IF account_erasure_private.erasure_authorized_v1() THEN RETURN OLD; END IF;
    END IF;
  END IF;
  RAISE EXCEPTION 'PERSONAL_REPLAY_LAUNCH_EVIDENCE_IS_DURABLE' USING ERRCODE = '55000',
    DETAIL = 'The gate snapshot a Personal Replay act was bound to is append-only: UPDATE and DELETE are refused for every role, including the table owner.';
END$$;

CREATE TRIGGER personal_replay_launch_evidence_immutable
    BEFORE UPDATE OR DELETE ON replay_private.personal_replay_launch_evidence
    FOR EACH ROW EXECUTE FUNCTION replay_private.reject_personal_replay_launch_evidence_mutation_v1();

-- The ONLY way the gate state changes. Executable by no application role: an operator runs it as the database owner.
-- Every call advances the restriction version, so a snapshot bound before it is distinguishable from one after it.
CREATE FUNCTION replay_private.set_replay_launch_capability_v1(
  p_capability_scope text, p_feature_flag_state text, p_launch_requirements_state text, p_decided_by text, p_policy_basis text
) RETURNS TABLE (capability_scope text, restriction_version bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_version bigint;
  v_at timestamptz := clock_timestamp();
BEGIN
  SELECT s.restriction_version INTO v_version
    FROM replay_private.replay_launch_capability_states s
   WHERE s.capability_scope = p_capability_scope
   FOR UPDATE;
  v_version := COALESCE(v_version, 0) + 1;
  INSERT INTO replay_private.replay_launch_capability_states AS s
    (capability_scope, feature_flag_state, launch_requirements_state, restriction_version, decided_by, policy_basis, decided_at)
  VALUES (p_capability_scope, p_feature_flag_state, p_launch_requirements_state, v_version, p_decided_by, p_policy_basis, v_at)
  ON CONFLICT ON CONSTRAINT replay_launch_capability_states_pk DO UPDATE
     SET feature_flag_state = EXCLUDED.feature_flag_state,
         launch_requirements_state = EXCLUDED.launch_requirements_state,
         restriction_version = EXCLUDED.restriction_version,
         decided_by = EXCLUDED.decided_by,
         policy_basis = EXCLUDED.policy_basis,
         decided_at = EXCLUDED.decided_at;
  INSERT INTO replay_private.replay_launch_capability_events
    (capability_scope, feature_flag_state, launch_requirements_state, restriction_version, decided_by, policy_basis, decided_at)
  VALUES (p_capability_scope, p_feature_flag_state, p_launch_requirements_state, v_version, p_decided_by, p_policy_basis, v_at);
  RETURN QUERY SELECT p_capability_scope, v_version;
END$$;

-- The current snapshot, locked FOR SHARE so an operator change waits for the caller's transaction. ALLOW only for
-- ENABLED + SATISFIED / WAIVED; an absent row is UNCONFIGURED and DENIES; LIMITED_ROLLOUT and INTERNAL DENY (no cohort
-- runtime exists, so no permissive guess).
CREATE FUNCTION replay_private.bind_replay_launch_gate_v1()
RETURNS TABLE (verdict text, restriction_version bigint, feature_flag_state text, launch_requirements_state text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_state replay_private.replay_launch_capability_states;
BEGIN
  SELECT * INTO v_state
    FROM replay_private.replay_launch_capability_states s
   WHERE s.capability_scope = 'PERSONAL_REPLAY'
   FOR SHARE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'DENY'::text, NULL::bigint, 'UNCONFIGURED'::text, 'UNCONFIGURED'::text;
    RETURN;
  END IF;
  IF v_state.feature_flag_state = 'ENABLED'
     AND v_state.launch_requirements_state IN ('SATISFIED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE') THEN
    RETURN QUERY SELECT 'ALLOW'::text, v_state.restriction_version, v_state.feature_flag_state, v_state.launch_requirements_state;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'DENY'::text, v_state.restriction_version, v_state.feature_flag_state, v_state.launch_requirements_state;
END$$;

-- Presentation hint only (CW2-08 section 24: a client flag never grants authority; every command re-binds the gate).
CREATE FUNCTION replay_private.read_my_replay_capability_v1()
RETURNS TABLE (creation_available boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT EXISTS (
    SELECT 1 FROM replay_private.replay_launch_capability_states s
     WHERE s.capability_scope = 'PERSONAL_REPLAY' AND s.feature_flag_state = 'ENABLED'
       AND s.launch_requirements_state IN ('SATISFIED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE'));
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. INTERNAL HELPERS (executable by no application role).
-- ---------------------------------------------------------------------------------------------------------------------

-- One persistence identity per (purpose, actor, command): an equivalent retry of a command names exactly the same
-- component identities, so the frozen primitive answers it from its own durable history. The shape is the 0164 one.
CREATE FUNCTION replay_private.derive_identity_v1(p_purpose text, p_actor uuid, p_command uuid)
RETURNS uuid
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT (substr(d.h, 1, 12) || '4' || substr(d.h, 14, 3) || '8' || substr(d.h, 18, 3) || substr(d.h, 21, 12))::uuid
    FROM (SELECT encode(sha256(convert_to('QANDEEL_S7_01_PERSONAL_REPLAY_IDENTITY_V1' || E'\n' || p_purpose || E'\n'
                 || lower(p_actor::text) || E'\n' || lower(p_command::text), 'UTF8')), 'hex') AS h) d;
$$;

-- ONE contiguous range of WHOLE messages of the caller's OWN Personal conversation, by Session Position. Read without a
-- lock: the frozen capture re-establishes everything under its own SHARE locks and refuses what moved. Answers:
--   RESOLVED            the committed units, in Session Position order, and the coverage the range can claim
--   UNAVAILABLE         not the caller's Session, no such positions, or a gap - one answer for all of them, so a
--                       stranger's Session and a Session that does not exist are indistinguishable
--   NOT_WHOLE_MESSAGES  the range starts or ends inside one message (a turn's units are one message)
-- FULL_SOURCE is claimed only for the complete committed conversation; the frozen selection core proves it again.
CREATE FUNCTION replay_private.resolve_personal_range_v1(p_session_id uuid, p_first integer, p_last integer)
RETURNS TABLE (outcome text, unit_ids uuid[], coverage_class text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_units uuid[];
  v_total integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT array_agg(cu.id ORDER BY cu.session_position) INTO v_units
    FROM public.conversation_units cu
   WHERE cu.session_id = p_session_id AND cu.user_id = v_user
     AND cu.session_position BETWEEN p_first AND p_last;
  IF v_units IS NULL OR cardinality(v_units) <> p_last - p_first + 1 THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid[], NULL::text;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.conversation_units f
               JOIN public.conversation_units o ON o.session_id = f.session_id AND o.source_turn_id = f.source_turn_id
              WHERE f.session_id = p_session_id AND f.user_id = v_user AND f.session_position = p_first
                AND o.session_position < p_first)
     OR EXISTS (SELECT 1 FROM public.conversation_units l
                  JOIN public.conversation_units o ON o.session_id = l.session_id AND o.source_turn_id = l.source_turn_id
                 WHERE l.session_id = p_session_id AND l.user_id = v_user AND l.session_position = p_last
                   AND o.session_position > p_last) THEN
    RETURN QUERY SELECT 'NOT_WHOLE_MESSAGES'::text, NULL::uuid[], NULL::text;
    RETURN;
  END IF;
  SELECT count(*)::integer INTO v_total FROM public.conversation_units cu
   WHERE cu.session_id = p_session_id AND cu.user_id = v_user;
  RETURN QUERY SELECT 'RESOLVED'::text, v_units,
                      CASE WHEN cardinality(v_units) = v_total THEN 'FULL_SOURCE' ELSE 'SELECTED_EXCERPT' END;
END$$;

-- Whether ONE version of the caller's own Replay may be VIEWED now, and if not, the one bounded reason. The current
-- version, or a historically finalized one; its source currently available (I-06D, the ONE availability derivation);
-- its sealed analytical evidence complete. For a FINALIZED version this is exactly I-06D's complete-Replay usability.
-- Returns nothing for a version that is not the caller's.
CREATE FUNCTION replay_private.version_viewing_state_v1(p_replay_id uuid, p_replay_version_id uuid)
RETURNS TABLE (is_current boolean, finalized boolean, source_layer text, analytical_layer text, viewing_state text,
               not_viewable_class text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_version public.replay_versions;
  v_current boolean;
  v_final boolean;
  v_usable record;
  v_availability text;
  v_source text;
  v_analytical text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT v.* INTO v_version FROM public.replay_versions v JOIN public.replays r ON r.id = v.replay_id
   WHERE v.id = p_replay_version_id AND v.replay_id = p_replay_id AND r.created_by_user_id = v_user;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  v_current := EXISTS (SELECT 1 FROM public.replay_current_version_state s
                        WHERE s.replay_id = p_replay_id AND s.current_replay_version_id = p_replay_version_id);
  v_final := EXISTS (SELECT 1 FROM public.replay_version_finalizations f
                      WHERE f.replay_version_id = p_replay_version_id AND f.replay_id = p_replay_id);
  IF v_final THEN
    SELECT u.* INTO v_usable
      FROM public.resolve_replay_version_current_usability_v1(p_replay_id, p_replay_version_id, v_user) u;
    RETURN QUERY SELECT v_current, true, v_usable.source_content_bearing_layer, v_usable.analytical_visual_layer,
                        CASE WHEN v_usable.usability_state = 'COMPLETE_REPLAY_CURRENTLY_USABLE' THEN 'VIEWABLE' ELSE 'NOT_VIEWABLE' END,
                        v_usable.unavailable_class;
    RETURN;
  END IF;
  -- A preview version: the same two layers, by the same frozen derivations, without the finalization requirement.
  SELECT a.availability_state INTO v_availability
    FROM public.derive_replay_version_current_availability_v1(p_replay_id, p_replay_version_id) a;
  v_source := CASE WHEN v_availability = 'CURRENT' THEN 'DEREFERENCEABLE' ELSE 'NOT_DEREFERENCEABLE' END;
  v_analytical := CASE
    WHEN (SELECT pv.point_count FROM public.replay_analytical_projection_versions pv
           WHERE pv.id = v_version.analytical_projection_version_id)
         = (SELECT count(*)::integer FROM public.replay_analytical_projection_points pt
             WHERE pt.projection_version_id = v_version.analytical_projection_version_id)
         AND EXISTS (SELECT 1 FROM public.replay_render_contract_versions rc WHERE rc.id = v_version.render_contract_version_id)
    THEN 'SEALED_HISTORICAL_EVIDENCE' ELSE 'SEALED_EVIDENCE_INCOMPLETE' END;
  RETURN QUERY SELECT v_current, false, v_source, v_analytical,
                      CASE WHEN v_current AND v_availability = 'CURRENT' AND v_analytical = 'SEALED_HISTORICAL_EVIDENCE'
                           THEN 'VIEWABLE' ELSE 'NOT_VIEWABLE' END,
                      CASE WHEN NOT v_current THEN 'VERSION_SUPERSEDED'
                           WHEN v_availability = 'CONTRADICTORY' THEN 'SOURCE_STATE_CONTRADICTORY'
                           WHEN v_availability IS DISTINCT FROM 'CURRENT' THEN 'SOURCE_NOT_CURRENTLY_AVAILABLE'
                           WHEN v_analytical <> 'SEALED_HISTORICAL_EVIDENCE' THEN 'ANALYTICAL_EVIDENCE_INCOMPLETE' END;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. THE FIVE GATED HUMAN COMMANDS. Each: auth.uid() -> request shape -> an equivalent retry answers from committed
--    history whatever the gate says now -> the gate (FOR SHARE) -> the frozen primitive as the session subject, in its
--    own block -> the gate snapshot beside the committed act. Every refusal of the primitive is one bounded word and
--    rolls back everything the attempt touched; nothing is raised to PostgREST but authentication and a malformed
--    request.
--
--    The bounded words:
--      NOT_AVAILABLE_NOW       the Personal Replay capability is closed (nothing is written)
--      UNAVAILABLE             no such Replay, not the caller's, or not the caller's source - one answer for all
--      NOT_WHOLE_MESSAGES      the range starts or ends inside one message
--      CHANGED                 the draft or version this request composed against moved (re-read and try again)
--      SOURCE_CHANGED          a bound message changed or is no longer the caller's at its position
--      MOMENT_NOT_SEALED       the range reaches the conversation's open Live Head, whose analysis may still change
--      ANALYSIS_UNAVAILABLE    the conversation has no historical analysis to replay (a LEGACY UNCOVERED Session)
--      ANALYSIS_CHANGED        the analysis this version froze no longer re-derives (a new preview is required)
--      LIFECYCLE_NOT_ELIGIBLE  the Replay is not in a state this act applies to
--      SELECTION_NOT_SUPPORTED a selection the frozen runtime cannot prove safe (unreachable through these commands)
--      COMMAND_CONFLICT        this command id already names a different request
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION replay_private.create_my_replay_draft_v1(
  p_command_id uuid, p_session_id uuid, p_first_tc integer, p_last_tc integer
) RETURNS TABLE (outcome text, replay_id uuid, replay_lifecycle text, draft_revision bigint, coverage_class text,
                 selected_item_count integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_replay uuid;
  v_committed public.replay_create_commands;
  v_gate record;
  v_range record;
  v_result record;
  v_words integer[];
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_session_id IS NULL OR p_first_tc IS NULL OR p_last_tc IS NULL
     OR p_first_tc < 1 OR p_last_tc < p_first_tc THEN
    RAISE EXCEPTION 'REPLAY_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  v_replay := replay_private.derive_identity_v1('REPLAY', v_user, p_command_id);

  -- An equivalent retry of a committed birth answers that birth, whatever the gate or the source say now: it is a read
  -- of committed truth, not a new act. The same command id naming a different request is a conflict.
  SELECT * INTO v_committed FROM public.replay_create_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF v_committed.actor_user_id = v_user AND v_committed.replay_id = v_replay
       AND EXISTS (SELECT 1 FROM public.replay_source_manifest_versions m
                    WHERE m.id = v_committed.source_manifest_version_id AND m.personal_session_id = p_session_id
                      AND (SELECT min(i.personal_session_position) FROM public.replay_source_manifest_items i
                            WHERE i.manifest_version_id = m.id) = p_first_tc
                      AND (SELECT max(i.personal_session_position) FROM public.replay_source_manifest_items i
                            WHERE i.manifest_version_id = m.id) = p_last_tc) THEN
      RETURN QUERY SELECT 'CREATED'::text, v_committed.replay_id, r.current_lifecycle, 1::bigint, sp.coverage_class,
                          sp.selected_item_count
        FROM public.replays r JOIN public.replay_selection_spec_versions sp ON sp.id = v_committed.selection_spec_version_id
       WHERE r.id = v_committed.replay_id;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::uuid, NULL::text, NULL::bigint, NULL::text, NULL::integer;
    RETURN;
  END IF;

  -- LOCK ORDER STEP 0: the capability snapshot, held FOR SHARE until this transaction ends.
  SELECT * INTO v_gate FROM replay_private.bind_replay_launch_gate_v1();
  IF v_gate.verdict <> 'ALLOW' THEN
    RETURN QUERY SELECT 'NOT_AVAILABLE_NOW'::text, NULL::uuid, NULL::text, NULL::bigint, NULL::text, NULL::integer;
    RETURN;
  END IF;

  SELECT * INTO v_range FROM replay_private.resolve_personal_range_v1(p_session_id, p_first_tc, p_last_tc);
  IF v_range.outcome <> 'RESOLVED' THEN
    RETURN QUERY SELECT v_range.outcome, NULL::uuid, NULL::text, NULL::bigint, NULL::text, NULL::integer;
    RETURN;
  END IF;
  v_words := array_fill(NULL::integer, ARRAY[cardinality(v_range.unit_ids)]);

  BEGIN
    SELECT * INTO v_result FROM public.create_replay_draft_v1(
      p_command_id, v_replay,
      replay_private.derive_identity_v1('SOURCE_MANIFEST', v_user, p_command_id),
      replay_private.derive_identity_v1('SELECTION_SPEC', v_user, p_command_id),
      'MY_WORLD', p_session_id, NULL, v_range.unit_ids, v_range.unit_ids, v_words, v_words, v_range.coverage_class);
  EXCEPTION
    WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' THEN
      RETURN QUERY SELECT CASE WHEN SQLERRM = 'REPLAY_SOURCE_STALE' THEN 'SOURCE_CHANGED' ELSE 'CHANGED' END,
                          NULL::uuid, NULL::text, NULL::bigint, NULL::text, NULL::integer;
      RETURN;
    WHEN SQLSTATE '22023' THEN
      -- REPLAY_COVERAGE_NOT_PROVABLE: a message committed between the range and the capture; any other shape refusal of
      -- the frozen core is the source the caller may not name.
      RETURN QUERY SELECT CASE WHEN SQLERRM = 'REPLAY_COVERAGE_NOT_PROVABLE' THEN 'CHANGED' ELSE 'UNAVAILABLE' END,
                          NULL::uuid, NULL::text, NULL::bigint, NULL::text, NULL::integer;
      RETURN;
    WHEN SQLSTATE '0A000' THEN
      RETURN QUERY SELECT 'SELECTION_NOT_SUPPORTED'::text, NULL::uuid, NULL::text, NULL::bigint, NULL::text, NULL::integer;
      RETURN;
    WHEN SQLSTATE '55000' THEN
      RETURN QUERY SELECT 'LIFECYCLE_NOT_ELIGIBLE'::text, NULL::uuid, NULL::text, NULL::bigint, NULL::text, NULL::integer;
      RETURN;
    WHEN SQLSTATE '23505' THEN
      RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::uuid, NULL::text, NULL::bigint, NULL::text, NULL::integer;
      RETURN;
    WHEN SQLSTATE 'P0002' OR SQLSTATE 'P0001' THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::text, NULL::bigint, NULL::text, NULL::integer;
      RETURN;
  END;

  INSERT INTO replay_private.personal_replay_launch_evidence
    (command_kind, command_id, replay_id, capability_scope, restriction_version, feature_flag_state,
     launch_requirements_state, bound_at)
  VALUES ('CREATE', p_command_id, v_result.committed_replay_id, 'PERSONAL_REPLAY', v_gate.restriction_version,
          v_gate.feature_flag_state, v_gate.launch_requirements_state, clock_timestamp())
  ON CONFLICT ON CONSTRAINT personal_replay_launch_evidence_pk DO NOTHING;

  RETURN QUERY SELECT 'CREATED'::text, v_result.committed_replay_id, v_result.replay_lifecycle,
                      v_result.resulting_draft_revision, v_result.resolved_coverage_class,
                      v_result.resolved_selected_item_count;
END$$;

CREATE FUNCTION replay_private.revise_my_replay_draft_v1(
  p_command_id uuid, p_replay_id uuid, p_expected_draft_revision bigint, p_first_tc integer,
  p_last_tc integer
) RETURNS TABLE (outcome text, replay_id uuid, replay_lifecycle text, draft_revision bigint, coverage_class text,
                 selected_item_count integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_committed public.replay_draft_revision_commands;
  v_session uuid;
  v_gate record;
  v_range record;
  v_result record;
  v_words integer[];
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_replay_id IS NULL OR p_expected_draft_revision IS NULL OR p_expected_draft_revision < 1
     OR p_first_tc IS NULL OR p_last_tc IS NULL
     OR p_first_tc < 1 OR p_last_tc < p_first_tc THEN
    RAISE EXCEPTION 'REPLAY_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_committed FROM public.replay_draft_revision_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF v_committed.actor_user_id = v_user AND v_committed.replay_id = p_replay_id
       AND v_committed.resulting_draft_revision = p_expected_draft_revision + 1
       AND (SELECT min(i.personal_session_position) FROM public.replay_source_manifest_items i
             WHERE i.manifest_version_id = v_committed.source_manifest_version_id) = p_first_tc
       AND (SELECT max(i.personal_session_position) FROM public.replay_source_manifest_items i
             WHERE i.manifest_version_id = v_committed.source_manifest_version_id) = p_last_tc THEN
      RETURN QUERY SELECT 'REVISED'::text, v_committed.replay_id, r.current_lifecycle, v_committed.resulting_draft_revision,
                          sp.coverage_class, sp.selected_item_count
        FROM public.replays r JOIN public.replay_selection_spec_versions sp ON sp.id = v_committed.selection_spec_version_id
       WHERE r.id = v_committed.replay_id;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::uuid, NULL::text, NULL::bigint, NULL::text, NULL::integer;
    RETURN;
  END IF;

  SELECT * INTO v_gate FROM replay_private.bind_replay_launch_gate_v1();
  IF v_gate.verdict <> 'ALLOW' THEN
    RETURN QUERY SELECT 'NOT_AVAILABLE_NOW'::text, NULL::uuid, NULL::text, NULL::bigint, NULL::text, NULL::integer;
    RETURN;
  END IF;

  -- The Replay's own Personal conversation: a revision re-selects inside the same conversation, never another one.
  SELECT m.personal_session_id INTO v_session
    FROM public.replays r
    JOIN public.replay_draft_state s ON s.replay_id = r.id
    JOIN public.replay_source_manifest_versions m ON m.id = s.current_source_manifest_version_id
   WHERE r.id = p_replay_id AND r.created_by_user_id = v_user AND m.source_class = 'MY_WORLD';
  IF v_session IS NULL THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::text, NULL::bigint, NULL::text, NULL::integer;
    RETURN;
  END IF;
  SELECT * INTO v_range FROM replay_private.resolve_personal_range_v1(v_session, p_first_tc, p_last_tc);
  IF v_range.outcome <> 'RESOLVED' THEN
    RETURN QUERY SELECT v_range.outcome, NULL::uuid, NULL::text, NULL::bigint, NULL::text, NULL::integer;
    RETURN;
  END IF;
  v_words := array_fill(NULL::integer, ARRAY[cardinality(v_range.unit_ids)]);

  BEGIN
    SELECT * INTO v_result FROM public.revise_replay_draft_v1(
      p_command_id, p_replay_id, p_expected_draft_revision,
      replay_private.derive_identity_v1('SOURCE_MANIFEST', v_user, p_command_id),
      replay_private.derive_identity_v1('SELECTION_SPEC', v_user, p_command_id),
      'MY_WORLD', v_session, NULL, v_range.unit_ids, v_range.unit_ids, v_words, v_words, v_range.coverage_class);
  EXCEPTION
    WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' THEN
      RETURN QUERY SELECT CASE WHEN SQLERRM = 'REPLAY_SOURCE_STALE' THEN 'SOURCE_CHANGED' ELSE 'CHANGED' END,
                          NULL::uuid, NULL::text, NULL::bigint, NULL::text, NULL::integer;
      RETURN;
    WHEN SQLSTATE '22023' THEN
      RETURN QUERY SELECT CASE WHEN SQLERRM = 'REPLAY_COVERAGE_NOT_PROVABLE' THEN 'CHANGED' ELSE 'UNAVAILABLE' END,
                          NULL::uuid, NULL::text, NULL::bigint, NULL::text, NULL::integer;
      RETURN;
    WHEN SQLSTATE '0A000' THEN
      RETURN QUERY SELECT 'SELECTION_NOT_SUPPORTED'::text, NULL::uuid, NULL::text, NULL::bigint, NULL::text, NULL::integer;
      RETURN;
    WHEN SQLSTATE '55000' THEN
      RETURN QUERY SELECT 'LIFECYCLE_NOT_ELIGIBLE'::text, NULL::uuid, NULL::text, NULL::bigint, NULL::text, NULL::integer;
      RETURN;
    WHEN SQLSTATE '23505' THEN
      RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::uuid, NULL::text, NULL::bigint, NULL::text, NULL::integer;
      RETURN;
    WHEN SQLSTATE 'P0002' OR SQLSTATE 'P0001' THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::text, NULL::bigint, NULL::text, NULL::integer;
      RETURN;
  END;

  INSERT INTO replay_private.personal_replay_launch_evidence
    (command_kind, command_id, replay_id, capability_scope, restriction_version, feature_flag_state,
     launch_requirements_state, bound_at)
  VALUES ('REVISE', p_command_id, p_replay_id, 'PERSONAL_REPLAY', v_gate.restriction_version,
          v_gate.feature_flag_state, v_gate.launch_requirements_state, clock_timestamp())
  ON CONFLICT ON CONSTRAINT personal_replay_launch_evidence_pk DO NOTHING;

  RETURN QUERY SELECT 'REVISED'::text, v_result.committed_replay_id, v_result.replay_lifecycle,
                      v_result.resulting_draft_revision, v_result.resolved_coverage_class,
                      v_result.resolved_selected_item_count;
END$$;

-- The true preview: the frozen I-06B compilation of the current draft into ONE complete immutable Replay Version, its
-- analytical projection taken from the canonical historical truth at every represented coordinate and refused at the
-- open Live Head. PREVIEW_READY widens nothing.
CREATE FUNCTION replay_private.prepare_my_replay_preview_v1(
  p_command_id uuid, p_replay_id uuid, p_expected_draft_revision bigint
) RETURNS TABLE (outcome text, replay_id uuid, replay_version_id uuid, replay_version_revision integer,
                 moment_count integer, temporal_discontinuity_count integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_retry boolean;
  v_gate record;
  v_result record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_replay_id IS NULL OR p_expected_draft_revision IS NULL OR p_expected_draft_revision < 1 THEN
    RAISE EXCEPTION 'REPLAY_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  -- A committed command of this human is answered by the frozen primitive from its own history, gate or no gate.
  SELECT EXISTS (SELECT 1 FROM public.replay_preview_commands c WHERE c.id = p_command_id AND c.actor_user_id = v_user)
    INTO v_retry;
  IF NOT v_retry THEN
    SELECT * INTO v_gate FROM replay_private.bind_replay_launch_gate_v1();
    IF v_gate.verdict <> 'ALLOW' THEN
      RETURN QUERY SELECT 'NOT_AVAILABLE_NOW'::text, NULL::uuid, NULL::uuid, NULL::integer, NULL::integer, NULL::integer;
      RETURN;
    END IF;
  END IF;

  BEGIN
    SELECT * INTO v_result FROM public.prepare_replay_preview_v1(
      p_command_id, p_replay_id, p_expected_draft_revision,
      replay_private.derive_identity_v1('ANALYTICAL_PROJECTION', v_user, p_command_id),
      replay_private.derive_identity_v1('RENDER_CONTRACT', v_user, p_command_id),
      replay_private.derive_identity_v1('REPLAY_VERSION', v_user, p_command_id));
  EXCEPTION
    WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' THEN
      RETURN QUERY SELECT CASE SQLERRM WHEN 'REPLAY_SOURCE_STALE' THEN 'SOURCE_CHANGED'
                                       WHEN 'REPLAY_ANALYTICAL_PROJECTION_OPEN_HEAD' THEN 'MOMENT_NOT_SEALED'
                                       ELSE 'CHANGED' END,
                          NULL::uuid, NULL::uuid, NULL::integer, NULL::integer, NULL::integer;
      RETURN;
    WHEN SQLSTATE '0A000' THEN
      RETURN QUERY SELECT CASE WHEN SQLERRM = 'REPLAY_ANALYTICAL_PROJECTION_UNAVAILABLE' THEN 'ANALYSIS_UNAVAILABLE'
                               ELSE 'SELECTION_NOT_SUPPORTED' END,
                          NULL::uuid, NULL::uuid, NULL::integer, NULL::integer, NULL::integer;
      RETURN;
    WHEN SQLSTATE '55000' THEN
      RETURN QUERY SELECT 'LIFECYCLE_NOT_ELIGIBLE'::text, NULL::uuid, NULL::uuid, NULL::integer, NULL::integer, NULL::integer;
      RETURN;
    WHEN SQLSTATE '23505' THEN
      RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::uuid, NULL::uuid, NULL::integer, NULL::integer, NULL::integer;
      RETURN;
    WHEN SQLSTATE '22023' OR SQLSTATE 'P0002' OR SQLSTATE 'P0001' THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::uuid, NULL::integer, NULL::integer, NULL::integer;
      RETURN;
  END;

  IF NOT v_retry THEN
    INSERT INTO replay_private.personal_replay_launch_evidence
      (command_kind, command_id, replay_id, capability_scope, restriction_version, feature_flag_state,
       launch_requirements_state, bound_at)
    VALUES ('PREVIEW', p_command_id, p_replay_id, 'PERSONAL_REPLAY', v_gate.restriction_version,
            v_gate.feature_flag_state, v_gate.launch_requirements_state, clock_timestamp())
    ON CONFLICT ON CONSTRAINT personal_replay_launch_evidence_pk DO NOTHING;
  END IF;

  RETURN QUERY SELECT 'PREVIEW_READY'::text, v_result.committed_replay_id, v_result.committed_replay_version_id,
                      v_result.replay_version_revision, v_result.projection_point_count,
                      v_result.temporal_discontinuity_count;
END$$;

-- The private final version: the frozen I-06B finalization of the EXACT current previewed version, with the source,
-- the analytical answer at every represented coordinate and the render contract revalidated under lock. FINALIZED IS
-- NOT DISTRIBUTED: no package, approver, audience or artifact exists anywhere on this path.
CREATE FUNCTION replay_private.finalize_my_replay_version_v1(
  p_command_id uuid, p_replay_id uuid, p_expected_replay_version_id uuid
) RETURNS TABLE (outcome text, replay_id uuid, replay_version_id uuid, replay_version_revision integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_retry boolean;
  v_gate record;
  v_result record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_replay_id IS NULL OR p_expected_replay_version_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.replay_finalization_commands c WHERE c.id = p_command_id AND c.actor_user_id = v_user)
    INTO v_retry;
  IF NOT v_retry THEN
    SELECT * INTO v_gate FROM replay_private.bind_replay_launch_gate_v1();
    IF v_gate.verdict <> 'ALLOW' THEN
      RETURN QUERY SELECT 'NOT_AVAILABLE_NOW'::text, NULL::uuid, NULL::uuid, NULL::integer;
      RETURN;
    END IF;
  END IF;

  BEGIN
    SELECT * INTO v_result FROM public.finalize_replay_version_v1(p_command_id, p_replay_id, p_expected_replay_version_id);
  EXCEPTION
    WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' THEN
      RETURN QUERY SELECT CASE SQLERRM WHEN 'REPLAY_SOURCE_STALE' THEN 'SOURCE_CHANGED'
                                       WHEN 'REPLAY_ANALYTICAL_PROJECTION_STALE' THEN 'ANALYSIS_CHANGED'
                                       WHEN 'REPLAY_RENDER_CONTRACT_STALE' THEN 'ANALYSIS_CHANGED'
                                       ELSE 'CHANGED' END,
                          NULL::uuid, NULL::uuid, NULL::integer;
      RETURN;
    WHEN SQLSTATE '0A000' THEN
      RETURN QUERY SELECT 'SELECTION_NOT_SUPPORTED'::text, NULL::uuid, NULL::uuid, NULL::integer;
      RETURN;
    WHEN SQLSTATE '55000' THEN
      RETURN QUERY SELECT 'LIFECYCLE_NOT_ELIGIBLE'::text, NULL::uuid, NULL::uuid, NULL::integer;
      RETURN;
    WHEN SQLSTATE '23505' THEN
      RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::uuid, NULL::uuid, NULL::integer;
      RETURN;
    WHEN SQLSTATE '22023' OR SQLSTATE 'P0002' OR SQLSTATE 'P0001' THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::uuid, NULL::integer;
      RETURN;
  END;

  IF NOT v_retry THEN
    INSERT INTO replay_private.personal_replay_launch_evidence
      (command_kind, command_id, replay_id, capability_scope, restriction_version, feature_flag_state,
       launch_requirements_state, bound_at)
    VALUES ('FINALIZE', p_command_id, p_replay_id, 'PERSONAL_REPLAY', v_gate.restriction_version,
            v_gate.feature_flag_state, v_gate.launch_requirements_state, clock_timestamp())
    ON CONFLICT ON CONSTRAINT personal_replay_launch_evidence_pk DO NOTHING;
  END IF;

  RETURN QUERY SELECT 'FINALIZED'::text, v_result.committed_replay_id, v_result.committed_replay_version_id,
                      v_result.replay_version_revision;
END$$;

-- Return a PREVIEW_READY or FINALIZED Replay to DRAFT through the frozen creator-exact command. The old version stays
-- immutable byte for byte, and a finalized one stays historically finalized.
CREATE FUNCTION replay_private.reopen_my_replay_for_revision_v1(
  p_command_id uuid, p_replay_id uuid, p_expected_replay_version_id uuid
) RETURNS TABLE (outcome text, replay_id uuid, replay_lifecycle text, reopened_from_replay_version_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_retry boolean;
  v_gate record;
  v_result record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_replay_id IS NULL OR p_expected_replay_version_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.replay_revision_reopen_commands c WHERE c.id = p_command_id AND c.actor_user_id = v_user)
    INTO v_retry;
  IF NOT v_retry THEN
    SELECT * INTO v_gate FROM replay_private.bind_replay_launch_gate_v1();
    IF v_gate.verdict <> 'ALLOW' THEN
      RETURN QUERY SELECT 'NOT_AVAILABLE_NOW'::text, NULL::uuid, NULL::text, NULL::uuid;
      RETURN;
    END IF;
  END IF;

  BEGIN
    SELECT * INTO v_result FROM public.reopen_replay_for_revision_v1(p_command_id, p_replay_id, p_expected_replay_version_id);
  EXCEPTION
    WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' THEN
      RETURN QUERY SELECT 'CHANGED'::text, NULL::uuid, NULL::text, NULL::uuid;
      RETURN;
    WHEN SQLSTATE '55000' THEN
      RETURN QUERY SELECT 'LIFECYCLE_NOT_ELIGIBLE'::text, NULL::uuid, NULL::text, NULL::uuid;
      RETURN;
    WHEN SQLSTATE '23505' THEN
      RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::uuid, NULL::text, NULL::uuid;
      RETURN;
    WHEN SQLSTATE '22023' OR SQLSTATE 'P0002' OR SQLSTATE 'P0001' THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::text, NULL::uuid;
      RETURN;
  END;

  IF NOT v_retry THEN
    INSERT INTO replay_private.personal_replay_launch_evidence
      (command_kind, command_id, replay_id, capability_scope, restriction_version, feature_flag_state,
       launch_requirements_state, bound_at)
    VALUES ('REOPEN', p_command_id, p_replay_id, 'PERSONAL_REPLAY', v_gate.restriction_version,
            v_gate.feature_flag_state, v_gate.launch_requirements_state, clock_timestamp())
    ON CONFLICT ON CONSTRAINT personal_replay_launch_evidence_pk DO NOTHING;
  END IF;

  RETURN QUERY SELECT 'REOPENED'::text, v_result.committed_replay_id, v_result.replay_lifecycle,
                      v_result.reopened_from_replay_version_id;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. THE FIVE CREATOR-EXACT READS (ungated). Zero rows for everyone but the creator, and for anything that does not
--    exist. The frozen creator resolvers (service_role-only, by their own precedent) are called here with the session
--    subject as their human: the human is derived, never supplied.
-- ---------------------------------------------------------------------------------------------------------------------

-- The Replay: its lifecycle, its current draft composition (the selected range as Session Positions, never a unit) and
-- its current complete version, if one exists.
CREATE FUNCTION replay_private.read_my_replay_v1(p_replay_id uuid)
RETURNS TABLE (replay_id uuid, replay_lifecycle text, created_at timestamptz, draft_revision bigint,
               draft_coverage_class text, draft_selected_item_count integer, draft_first_tc integer,
               draft_last_tc integer, draft_source_state text, draft_updated_at timestamptz,
               current_replay_version_id uuid, current_replay_version_revision integer,
               current_version_finalized boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_draft record;
  v_version record;
  v_created timestamptz;
  v_first integer;
  v_last integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_replay_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT d.* INTO v_draft FROM public.resolve_replay_draft_composition_v1(p_replay_id, v_user) d;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT r.created_at INTO v_created FROM public.replays r WHERE r.id = p_replay_id;
  SELECT min(si_tc.tc), max(si_tc.tc) INTO v_first, v_last
    FROM (SELECT mi.personal_session_position AS tc
            FROM public.replay_selection_spec_items si
            JOIN public.replay_source_manifest_items mi
              ON mi.manifest_version_id = si.source_manifest_version_id AND mi.source_item_ordinal = si.source_item_ordinal
           WHERE si.selection_spec_version_id = v_draft.selection_spec_version_id) si_tc;
  SELECT c.* INTO v_version FROM public.resolve_replay_current_version_v1(p_replay_id, v_user) c;
  RETURN QUERY SELECT p_replay_id, v_draft.current_lifecycle, v_created, v_draft.draft_revision, v_draft.coverage_class,
                      v_draft.selected_item_count, v_first, v_last, v_draft.currency_state, v_draft.updated_at,
                      v_version.replay_version_id, v_version.replay_version_revision, v_version.version_finalized;
END$$;

-- One exact version: its shape, the render truth contract it is bound to (every policy an exact versioned value), and
-- whether it may be viewed now.
CREATE FUNCTION replay_private.read_my_replay_version_v1(p_replay_id uuid, p_replay_version_id uuid)
RETURNS TABLE (replay_id uuid, replay_version_id uuid, replay_version_revision integer, version_created_at timestamptz,
               is_current boolean, finalized boolean, coverage_class text, moment_count integer,
               temporal_discontinuity_count integer, first_tc integer, last_tc integer,
               render_contract_revision integer, render_contract_schema text, source_medium_class text,
               original_medium_policy text, source_text_policy text, semantic_cut_policy text,
               temporal_discontinuity_policy text, timing_integrity_policy text, analytical_projection_policy text,
               camera_emphasis_policy text, motion_policy text, caption_provenance_policy text,
               accessibility_parity_policy text, reduced_motion_parity_policy text, editorial_annotation_policy text,
               source_layer text, analytical_layer text, viewing_state text, not_viewable_class text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_view record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_replay_id IS NULL OR p_replay_version_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT w.* INTO v_view FROM replay_private.version_viewing_state_v1(p_replay_id, p_replay_version_id) w;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT v.replay_id, v.id, v.replay_version_revision, v.created_at, v_view.is_current, v_view.finalized,
           sp.coverage_class, pv.point_count, rc.discontinuity_count,
           (SELECT min(pt.represented_session_position) FROM public.replay_analytical_projection_points pt
             WHERE pt.projection_version_id = pv.id),
           (SELECT max(pt.represented_session_position) FROM public.replay_analytical_projection_points pt
             WHERE pt.projection_version_id = pv.id),
           rc.contract_revision, rc.contract_schema_id, rc.source_medium_class, rc.original_medium_policy,
           rc.source_text_policy, rc.semantic_cut_policy, rc.temporal_discontinuity_policy, rc.timing_integrity_policy,
           rc.analytical_projection_policy, rc.camera_emphasis_policy, rc.motion_policy, rc.caption_provenance_policy,
           rc.accessibility_parity_policy, rc.reduced_motion_parity_policy, rc.editorial_annotation_policy,
           v_view.source_layer, v_view.analytical_layer, v_view.viewing_state, v_view.not_viewable_class
      FROM public.replay_versions v
      JOIN public.replay_selection_spec_versions sp ON sp.id = v.selection_spec_version_id
      JOIN public.replay_analytical_projection_versions pv ON pv.id = v.analytical_projection_version_id
      JOIN public.replay_render_contract_versions rc ON rc.id = v.render_contract_version_id
     WHERE v.id = p_replay_version_id AND v.replay_id = p_replay_id;
END$$;

-- The source layer of one exact version: every moment in canonical chronology, the omitted-source count before it (a
-- gap is machine truth about ABSENCE and names nothing omitted), who spoke, the original medium, and the exact committed
-- text ONLY while the version is viewable. The structure is the version's own immutable truth; the text is the
-- source, served from the source itself and never from a copy.
CREATE FUNCTION replay_private.read_my_replay_moments_v1(p_replay_id uuid, p_replay_version_id uuid)
RETURNS TABLE (selected_ordinal integer, tc integer, source_role text, original_medium text,
               omitted_before integer, source_text text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_view record;
  v_version public.replay_versions;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_replay_id IS NULL OR p_replay_version_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT w.* INTO v_view FROM replay_private.version_viewing_state_v1(p_replay_id, p_replay_version_id) w;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT v.* INTO v_version FROM public.replay_versions v WHERE v.id = p_replay_version_id;
  RETURN QUERY
    SELECT si.selected_ordinal, mi.personal_session_position, mi.personal_source_role, mi.original_medium,
           coalesce((SELECT d.omitted_source_item_count FROM public.replay_temporal_discontinuities d
                      WHERE d.selection_spec_version_id = si.selection_spec_version_id
                        AND d.right_selected_ordinal = si.selected_ordinal), 0),
           CASE WHEN v_view.viewing_state = 'VIEWABLE' AND si.anchor_kind = 'WHOLE_ITEM'
                THEN (SELECT cu.committed_text FROM public.conversation_units cu
                       WHERE cu.id = mi.personal_conversation_unit_id) END
      FROM public.replay_selection_spec_items si
      JOIN public.replay_source_manifest_items mi
        ON mi.manifest_version_id = si.source_manifest_version_id AND mi.source_item_ordinal = si.source_item_ordinal
     WHERE si.selection_spec_version_id = v_version.selection_spec_version_id
       AND mi.source_class = 'MY_WORLD'
     ORDER BY si.selected_ordinal;
END$$;

-- How QANDEEL understood the conversation AT one moment: the canonical K(TC) of 0072 at the moment's represented Session
-- Position, re-derived now through the canonical projection under the human's own auth.uid() and served ONLY if it
-- re-digests to exactly what the version froze. The answer carries the families the frozen commitment covers and nothing
-- else: no `moments` (the source events, served by the source layer above) and no `materials[].expiry` (a wall-clock
-- policy fact - showing it at TC would be hindsight). It is no second projection authority and no route to any other
-- TC: only the represented coordinates of the caller's own version, only while that version is viewable.
--   AVAILABLE                          the verified answer
--   NOT_VIEWABLE                       the version is not viewable now (see read_my_replay_version_v1)
--   ANALYSIS_NOT_CURRENTLY_AVAILABLE   the canonical answer no longer re-derives to what was frozen, or cannot be read
CREATE FUNCTION replay_private.read_my_replay_moment_analysis_v1(
  p_replay_id uuid, p_replay_version_id uuid, p_selected_ordinal integer
) RETURNS TABLE (outcome text, selected_ordinal integer, tc integer, analysis jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_view record;
  v_version public.replay_versions;
  v_point public.replay_analytical_projection_points;
  v_session uuid;
  v_projected record;
  v_digest text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_replay_id IS NULL OR p_replay_version_id IS NULL OR p_selected_ordinal IS NULL OR p_selected_ordinal < 1 THEN
    RAISE EXCEPTION 'REPLAY_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT w.* INTO v_view FROM replay_private.version_viewing_state_v1(p_replay_id, p_replay_version_id) w;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT v.* INTO v_version FROM public.replay_versions v WHERE v.id = p_replay_version_id;
  SELECT pt.* INTO v_point FROM public.replay_analytical_projection_points pt
   WHERE pt.projection_version_id = v_version.analytical_projection_version_id AND pt.selected_ordinal = p_selected_ordinal;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF v_view.viewing_state <> 'VIEWABLE' THEN
    RETURN QUERY SELECT 'NOT_VIEWABLE'::text, p_selected_ordinal, v_point.represented_session_position, NULL::jsonb;
    RETURN;
  END IF;
  SELECT m.personal_session_id INTO v_session FROM public.replay_source_manifest_versions m
   WHERE m.id = v_version.source_manifest_version_id AND m.source_class = 'MY_WORLD';
  BEGIN
    SELECT * INTO v_projected
      FROM public.get_session_historical_projection_v1(v_session, v_point.represented_session_position);
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'ANALYSIS_NOT_CURRENTLY_AVAILABLE'::text, p_selected_ordinal, v_point.represented_session_position,
                        NULL::jsonb;
    RETURN;
  END;
  IF v_projected.tc IS DISTINCT FROM v_point.represented_session_position OR v_projected.sealed IS NOT TRUE THEN
    RETURN QUERY SELECT 'ANALYSIS_NOT_CURRENTLY_AVAILABLE'::text, p_selected_ordinal, v_point.represented_session_position,
                        NULL::jsonb;
    RETURN;
  END IF;
  v_digest := public.replay_analytical_projection_point_digest_v1(
    v_projected.tc, v_projected.emerging_focuses, v_projected.live_focus, v_projected.threads,
    v_projected.thread_reading_appearances, v_projected.readings, v_projected.reading_relations,
    v_projected.evidence_participations, v_projected.materials, v_projected.gaps,
    v_projected.questions, v_projected.question_appearances, v_projected.confidences);
  IF v_digest IS DISTINCT FROM v_point.point_digest THEN
    RETURN QUERY SELECT 'ANALYSIS_NOT_CURRENTLY_AVAILABLE'::text, p_selected_ordinal, v_point.represented_session_position,
                        NULL::jsonb;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'AVAILABLE'::text, p_selected_ordinal, v_point.represented_session_position,
    jsonb_build_object(
      'emerging_focuses', v_projected.emerging_focuses,
      'live_focus', v_projected.live_focus,
      'threads', v_projected.threads,
      'thread_reading_appearances', v_projected.thread_reading_appearances,
      'readings', v_projected.readings,
      'reading_relations', v_projected.reading_relations,
      'evidence_participations', v_projected.evidence_participations,
      'materials', (SELECT coalesce(jsonb_agg(e.value - 'expiry' ORDER BY e.ordinality), '[]'::jsonb)
                      FROM jsonb_array_elements(v_projected.materials) WITH ORDINALITY AS e(value, ordinality)),
      'gaps', v_projected.gaps,
      'questions', v_projected.questions,
      'question_appearances', v_projected.question_appearances,
      'confidences', v_projected.confidences);
END$$;

-- The caller's Replays of ONE of their own conversations, oldest first: the entry back into a Replay begun from that
-- conversation. Not a library: one conversation, the caller's own, nothing across conversations.
CREATE FUNCTION replay_private.list_my_conversation_replays_v1(p_session_id uuid)
RETURNS TABLE (replay_id uuid, replay_lifecycle text, created_at timestamptz, current_replay_version_id uuid,
               current_version_finalized boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'REPLAY_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT r.id, r.current_lifecycle, r.created_at, cv.current_replay_version_id,
           EXISTS (SELECT 1 FROM public.replay_version_finalizations f WHERE f.replay_version_id = cv.current_replay_version_id)
      FROM public.replays r
      JOIN public.replay_draft_state s ON s.replay_id = r.id
      JOIN public.replay_source_manifest_versions m ON m.id = s.current_source_manifest_version_id
      LEFT JOIN public.replay_current_version_state cv ON cv.replay_id = r.id
     WHERE r.created_by_user_id = v_user AND m.source_class = 'MY_WORLD' AND m.personal_session_id = p_session_id
     ORDER BY r.created_at, r.id
     LIMIT 100;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. THE EXPOSED PRODUCT WRAPPERS: SECURITY INVOKER, `authenticated` only, each a one-line call into its definer.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.read_my_replay_capability_v1()
RETURNS TABLE (creation_available boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT c.creation_available FROM replay_private.read_my_replay_capability_v1() c;
$$;

CREATE FUNCTION public.create_my_replay_draft_v1(
  p_command_id uuid, p_session_id uuid, p_first_tc integer, p_last_tc integer
) RETURNS TABLE (outcome text, replay_id uuid, replay_lifecycle text, draft_revision bigint, coverage_class text,
                 selected_item_count integer)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.replay_id, r.replay_lifecycle, r.draft_revision, r.coverage_class, r.selected_item_count
    FROM replay_private.create_my_replay_draft_v1(p_command_id, p_session_id, p_first_tc,
                                                  p_last_tc) r;
$$;

CREATE FUNCTION public.revise_my_replay_draft_v1(
  p_command_id uuid, p_replay_id uuid, p_expected_draft_revision bigint, p_first_tc integer,
  p_last_tc integer
) RETURNS TABLE (outcome text, replay_id uuid, replay_lifecycle text, draft_revision bigint, coverage_class text,
                 selected_item_count integer)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.replay_id, r.replay_lifecycle, r.draft_revision, r.coverage_class, r.selected_item_count
    FROM replay_private.revise_my_replay_draft_v1(p_command_id, p_replay_id, p_expected_draft_revision,
                                                  p_first_tc, p_last_tc) r;
$$;

CREATE FUNCTION public.prepare_my_replay_preview_v1(p_command_id uuid, p_replay_id uuid, p_expected_draft_revision bigint)
RETURNS TABLE (outcome text, replay_id uuid, replay_version_id uuid, replay_version_revision integer,
               moment_count integer, temporal_discontinuity_count integer)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.replay_id, r.replay_version_id, r.replay_version_revision, r.moment_count,
         r.temporal_discontinuity_count
    FROM replay_private.prepare_my_replay_preview_v1(p_command_id, p_replay_id, p_expected_draft_revision) r;
$$;

CREATE FUNCTION public.finalize_my_replay_version_v1(p_command_id uuid, p_replay_id uuid, p_expected_replay_version_id uuid)
RETURNS TABLE (outcome text, replay_id uuid, replay_version_id uuid, replay_version_revision integer)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.replay_id, r.replay_version_id, r.replay_version_revision
    FROM replay_private.finalize_my_replay_version_v1(p_command_id, p_replay_id, p_expected_replay_version_id) r;
$$;

CREATE FUNCTION public.reopen_my_replay_for_revision_v1(p_command_id uuid, p_replay_id uuid, p_expected_replay_version_id uuid)
RETURNS TABLE (outcome text, replay_id uuid, replay_lifecycle text, reopened_from_replay_version_id uuid)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.replay_id, r.replay_lifecycle, r.reopened_from_replay_version_id
    FROM replay_private.reopen_my_replay_for_revision_v1(p_command_id, p_replay_id, p_expected_replay_version_id) r;
$$;

CREATE FUNCTION public.read_my_replay_v1(p_replay_id uuid)
RETURNS TABLE (replay_id uuid, replay_lifecycle text, created_at timestamptz, draft_revision bigint,
               draft_coverage_class text, draft_selected_item_count integer, draft_first_tc integer,
               draft_last_tc integer, draft_source_state text, draft_updated_at timestamptz,
               current_replay_version_id uuid, current_replay_version_revision integer,
               current_version_finalized boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.replay_id, r.replay_lifecycle, r.created_at, r.draft_revision, r.draft_coverage_class,
         r.draft_selected_item_count, r.draft_first_tc, r.draft_last_tc,
         r.draft_source_state, r.draft_updated_at, r.current_replay_version_id, r.current_replay_version_revision,
         r.current_version_finalized
    FROM replay_private.read_my_replay_v1(p_replay_id) r;
$$;

CREATE FUNCTION public.read_my_replay_version_v1(p_replay_id uuid, p_replay_version_id uuid)
RETURNS TABLE (replay_id uuid, replay_version_id uuid, replay_version_revision integer, version_created_at timestamptz,
               is_current boolean, finalized boolean, coverage_class text, moment_count integer,
               temporal_discontinuity_count integer, first_tc integer, last_tc integer,
               render_contract_revision integer, render_contract_schema text, source_medium_class text,
               original_medium_policy text, source_text_policy text, semantic_cut_policy text,
               temporal_discontinuity_policy text, timing_integrity_policy text, analytical_projection_policy text,
               camera_emphasis_policy text, motion_policy text, caption_provenance_policy text,
               accessibility_parity_policy text, reduced_motion_parity_policy text, editorial_annotation_policy text,
               source_layer text, analytical_layer text, viewing_state text, not_viewable_class text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.replay_id, r.replay_version_id, r.replay_version_revision, r.version_created_at, r.is_current, r.finalized,
         r.coverage_class, r.moment_count, r.temporal_discontinuity_count, r.first_tc,
         r.last_tc, r.render_contract_revision, r.render_contract_schema, r.source_medium_class,
         r.original_medium_policy, r.source_text_policy, r.semantic_cut_policy, r.temporal_discontinuity_policy,
         r.timing_integrity_policy, r.analytical_projection_policy, r.camera_emphasis_policy, r.motion_policy,
         r.caption_provenance_policy, r.accessibility_parity_policy, r.reduced_motion_parity_policy,
         r.editorial_annotation_policy, r.source_layer, r.analytical_layer, r.viewing_state, r.not_viewable_class
    FROM replay_private.read_my_replay_version_v1(p_replay_id, p_replay_version_id) r;
$$;

CREATE FUNCTION public.read_my_replay_moments_v1(p_replay_id uuid, p_replay_version_id uuid)
RETURNS TABLE (selected_ordinal integer, tc integer, source_role text, original_medium text,
               omitted_before integer, source_text text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.selected_ordinal, r.tc, r.source_role, r.original_medium, r.omitted_before, r.source_text
    FROM replay_private.read_my_replay_moments_v1(p_replay_id, p_replay_version_id) r;
$$;

CREATE FUNCTION public.read_my_replay_moment_analysis_v1(p_replay_id uuid, p_replay_version_id uuid, p_selected_ordinal integer)
RETURNS TABLE (outcome text, selected_ordinal integer, tc integer, analysis jsonb)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.selected_ordinal, r.tc, r.analysis
    FROM replay_private.read_my_replay_moment_analysis_v1(p_replay_id, p_replay_version_id, p_selected_ordinal) r;
$$;

CREATE FUNCTION public.list_my_conversation_replays_v1(p_session_id uuid)
RETURNS TABLE (replay_id uuid, replay_lifecycle text, created_at timestamptz, current_replay_version_id uuid,
               current_version_finalized boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.replay_id, r.replay_lifecycle, r.created_at, r.current_replay_version_id, r.current_version_finalized
    FROM replay_private.list_my_conversation_replays_v1(p_session_id) r;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. ACCOUNT ERASURE OF THE PERSONAL REPLAY FOOTPRINT (QAN-BL-ACCT-02).
-- ---------------------------------------------------------------------------------------------------------------------

-- (a) The two I-06 append-only guards that refuse DELETE, redefined IN PLACE (same name, OID, owner, ACL, posture): the
--     live body byte for byte after exactly 0164's prefix - DELETE, never UPDATE, only when the transaction-local
--     `qandeel.account_erasure` equals the current transaction id AND the coordinator's authorization row for that
--     transaction exists. The deploy-time assertion below proves exactly that for both.
CREATE TEMPORARY TABLE s7_01_guard_bodies (fn text PRIMARY KEY, before_src text NOT NULL, prefix_at integer NOT NULL)
    ON COMMIT DROP;
DO $$
DECLARE
  guards constant text[] := ARRAY[
    'public.reject_replay_component_mutation_v1()',
    'public.reject_replay_version_component_mutation_v1()'];
  prefix constant text := E'\n  -- S7-01 (0169): the governed account erasure alone may DELETE; nothing else changes.\n'
    || E'  IF TG_OP = ''DELETE'' THEN\n'
    || E'    IF pg_catalog.current_setting(''qandeel.account_erasure'', true) = pg_catalog.txid_current()::text THEN\n'
    || E'      IF account_erasure_private.erasure_authorized_v1() THEN RETURN OLD; END IF;\n'
    || E'    END IF;\n'
    || E'  END IF;';
  guard text;
  definition text;
  source text;
  at integer;
BEGIN
  FOREACH guard IN ARRAY guards LOOP
    SELECT pg_get_functiondef(p.oid), p.prosrc INTO definition, source FROM pg_proc p WHERE p.oid = guard::regprocedure;
    at := regexp_instr(source, '\mBEGIN\M');
    IF at = 0 OR strpos(definition, source) = 0 OR strpos(source, 'qandeel.account_erasure') > 0 THEN
      RAISE EXCEPTION 'S7-01: % has no recognizable body, or was already narrowed', guard;
    END IF;
    INSERT INTO s7_01_guard_bodies (fn, before_src, prefix_at) VALUES (guard, source, at);
    EXECUTE replace(definition, source, substr(source, 1, at + 4) || prefix || substr(source, at + 5));
  END LOOP;
  FOREACH guard IN ARRAY guards LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN s7_01_guard_bodies b ON b.fn = guard
       WHERE p.oid = guard::regprocedure
         AND p.prosrc = substr(b.before_src, 1, b.prefix_at + 4) || prefix || substr(b.before_src, b.prefix_at + 5)
         AND pg_get_userbyid(p.proowner) = 'postgres' AND p.prorettype = 'trigger'::regtype) THEN
      RAISE EXCEPTION 'S7-01: % was not narrowed exactly', guard;
    END IF;
  END LOOP;
END$$;

-- (b) The residue vocabulary gains ONE class: the Replay footprint the Personal module does not cover.
ALTER TABLE account_erasure_private.residue_class_coverage
  DROP CONSTRAINT residue_class_coverage_class_check,
  ADD CONSTRAINT residue_class_coverage_class_check
      CHECK (residue_class IN ('SHARED_STANDARD', 'PUBLIC', 'REPLAY', 'REPLAY_OUTSIDE_PERSONAL', 'UNREGISTERED'));
ALTER TABLE account_erasure_private.deletion_progress
  DROP CONSTRAINT deletion_progress_classes_check,
  ADD CONSTRAINT deletion_progress_classes_check
      CHECK (residue_classes IS NULL
             OR residue_classes <@ ARRAY['SHARED_STANDARD', 'PUBLIC', 'REPLAY', 'REPLAY_OUTSIDE_PERSONAL', 'UNREGISTERED']);

-- (c) Coverage: REPLAY is covered by the module below, in this same change (QAN-BL-ACCT-02's required property); the
--     remainder is owned and uncovered. Every Replay relation is registered.
UPDATE account_erasure_private.residue_class_coverage SET covered = true WHERE residue_class = 'REPLAY';
INSERT INTO account_erasure_private.residue_class_coverage (residue_class, covered, owner) VALUES
    ('REPLAY_OUTSIDE_PERSONAL', false, 'QAN-BL-ACCT-03 - not opened: non-Personal Replay sources and Replay distribution');

INSERT INTO account_erasure_private.coverage_registry (relation, coverage) VALUES
    ('replay_analytical_projection_points', 'REPLAY'),
    ('replay_analytical_projection_versions', 'REPLAY'),
    ('replay_create_commands', 'REPLAY'),
    ('replay_current_version_state', 'REPLAY'),
    ('replay_distribution_approval_withdrawal_events', 'REPLAY'),
    ('replay_distribution_approvals', 'REPLAY'),
    ('replay_distribution_authorization_commands', 'REPLAY'),
    ('replay_distribution_export_descriptors', 'REPLAY'),
    ('replay_distribution_package_versions', 'REPLAY'),
    ('replay_distribution_prepare_commands', 'REPLAY'),
    ('replay_distribution_reconciliation_events', 'REPLAY'),
    ('replay_distribution_withdrawal_commands', 'REPLAY'),
    ('replay_draft_revision_commands', 'REPLAY'),
    ('replay_draft_state', 'REPLAY'),
    ('replay_finalization_commands', 'REPLAY'),
    ('replay_lifecycle_events', 'REPLAY'),
    ('replay_preview_commands', 'REPLAY'),
    ('replay_private.personal_replay_launch_evidence', 'REPLAY'),
    ('replay_public_distribution_artifacts', 'REPLAY'),
    ('replay_reconciliation_commands', 'REPLAY'),
    ('replay_render_contract_versions', 'REPLAY'),
    ('replay_revision_reopen_commands', 'REPLAY'),
    ('replay_selection_spec_items', 'REPLAY'),
    ('replay_selection_spec_versions', 'REPLAY'),
    ('replay_semantic_cut_assessments', 'REPLAY'),
    ('replay_source_availability_reconciliation_events', 'REPLAY'),
    ('replay_temporal_discontinuities', 'REPLAY'),
    ('replay_version_finalizations', 'REPLAY'),
    ('replay_versions', 'REPLAY');

-- (d) The Personal Replay module. Runs only inside the coordinator's subtransaction, under its locks and its
--     authorization, and only after the census proved every Replay of the account is Personal and undistributed: every
--     manifest MY_WORLD, no package, no reconciliation evidence, no other human's Replay naming the account. Each such
--     Replay is the creator's own private artifact, binding only the creator's own messages, so erasing it touches no
--     other human's right. Children first, in the order the restrictive foreign keys require; returns how many Replays
--     it erased.
CREATE FUNCTION account_erasure_private.erase_personal_replays_v1(p_deletion_id uuid, p_user uuid)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_replays uuid[];
  v_manifests uuid[];
  v_specs uuid[];
  v_projections uuid[];
BEGIN
  IF p_deletion_id IS NULL OR p_user IS NULL THEN
    RAISE EXCEPTION 'ACCOUNT_ERASURE_CONTRADICTORY_REPLAY' USING ERRCODE = 'P0001';
  END IF;
  v_replays := ARRAY(SELECT r.id FROM public.replays r WHERE r.created_by_user_id = p_user ORDER BY r.id);
  IF cardinality(v_replays) = 0 THEN
    RETURN 0;
  END IF;
  IF EXISTS (SELECT 1 FROM public.replay_source_manifest_versions m
              WHERE m.replay_id = ANY (v_replays) AND m.source_class <> 'MY_WORLD') THEN
    RAISE EXCEPTION 'ACCOUNT_ERASURE_CONTRADICTORY_REPLAY' USING ERRCODE = 'P0001';
  END IF;
  v_manifests := ARRAY(SELECT m.id FROM public.replay_source_manifest_versions m WHERE m.replay_id = ANY (v_replays));
  v_specs := ARRAY(SELECT s.id FROM public.replay_selection_spec_versions s WHERE s.replay_id = ANY (v_replays));
  v_projections := ARRAY(SELECT p.id FROM public.replay_analytical_projection_versions p WHERE p.replay_id = ANY (v_replays));

  DELETE FROM replay_private.personal_replay_launch_evidence e WHERE e.replay_id = ANY (v_replays);
  DELETE FROM public.replay_finalization_commands c WHERE c.replay_id = ANY (v_replays);
  DELETE FROM public.replay_revision_reopen_commands c WHERE c.replay_id = ANY (v_replays);
  DELETE FROM public.replay_preview_commands c WHERE c.replay_id = ANY (v_replays);
  DELETE FROM public.replay_version_finalizations f WHERE f.replay_id = ANY (v_replays);
  DELETE FROM public.replay_lifecycle_events e WHERE e.replay_id = ANY (v_replays);
  DELETE FROM public.replay_current_version_state s WHERE s.replay_id = ANY (v_replays);
  DELETE FROM public.replay_versions v WHERE v.replay_id = ANY (v_replays);
  DELETE FROM public.replay_render_contract_versions c WHERE c.replay_id = ANY (v_replays);
  DELETE FROM public.replay_analytical_projection_points p WHERE p.projection_version_id = ANY (v_projections);
  DELETE FROM public.replay_analytical_projection_versions p WHERE p.id = ANY (v_projections);
  DELETE FROM public.replay_temporal_discontinuities d WHERE d.selection_spec_version_id = ANY (v_specs);
  DELETE FROM public.replay_semantic_cut_assessments a WHERE a.selection_spec_version_id = ANY (v_specs);
  DELETE FROM public.replay_draft_revision_commands c WHERE c.replay_id = ANY (v_replays);
  DELETE FROM public.replay_create_commands c WHERE c.replay_id = ANY (v_replays);
  DELETE FROM public.replay_draft_state s WHERE s.replay_id = ANY (v_replays);
  DELETE FROM public.replay_selection_spec_items i WHERE i.selection_spec_version_id = ANY (v_specs);
  DELETE FROM public.replay_selection_spec_versions s WHERE s.id = ANY (v_specs);
  DELETE FROM public.replay_source_manifest_items i WHERE i.manifest_version_id = ANY (v_manifests);
  DELETE FROM public.replay_source_manifest_versions m WHERE m.id = ANY (v_manifests);
  DELETE FROM public.replays r WHERE r.id = ANY (v_replays);
  RETURN cardinality(v_replays);
END$$;

-- Whether any Replay row still names the account as its creator (the module's own completeness check).
CREATE FUNCTION account_erasure_private.replay_module_residue_v1(p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.replays x WHERE x.created_by_user_id = p_user);
$$;

-- (e) The read-only residue census, replaced forward: 0164's body with its three Replay probes re-classified (another
--     human's Replay naming the account, and a Replay over the account's Introduction Worlds, are outside the Personal
--     module) and ONE added probe (an own Replay the Personal module does not cover). Every other probe is unchanged.
CREATE OR REPLACE FUNCTION account_erasure_private.residue_classes_v1(p_user uuid, p_worlds uuid[])
RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v text[] := ARRAY[]::text[];
BEGIN
  p_worlds := coalesce(p_worlds, ARRAY[]::uuid[]);
  IF EXISTS (SELECT 1 FROM public.public_discussion_post_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.public_experience_disappearance_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.public_experience_draft_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.public_experience_publish_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.public_experience_review_ready_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.public_experience_semantic_placement_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.public_identities x WHERE x.user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.public_identity_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.publication_approval_withdrawal_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.publication_manifest_required_approvers x WHERE x.approver_user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.publication_package_item_provenance x WHERE x.personal_owner_user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.publication_package_prepare_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.replay_distribution_authorizations x WHERE x.authorized_by_user_id = p_user) THEN v := v || 'REPLAY_OUTSIDE_PERSONAL'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.replay_distribution_required_approvers x WHERE x.approver_user_id = p_user) THEN v := v || 'REPLAY_OUTSIDE_PERSONAL'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.replays x WHERE x.created_by_user_id = p_user) THEN v := v || 'REPLAY'::text; END IF;
  -- S7-01 (0169): an own Replay the Personal module does not cover - a non-Personal source, a distribution package or
  -- reconciliation evidence - is Replay residue outside the Personal module.
  IF EXISTS (SELECT 1 FROM public.replays r WHERE r.created_by_user_id = p_user AND (
       EXISTS (SELECT 1 FROM public.replay_source_manifest_versions m WHERE m.replay_id = r.id AND m.source_class <> 'MY_WORLD')
    OR EXISTS (SELECT 1 FROM public.replay_distribution_package_versions d WHERE d.replay_id = r.id)
    OR EXISTS (SELECT 1 FROM public.replay_reconciliation_commands c WHERE c.replay_id = r.id)
    OR EXISTS (SELECT 1 FROM public.replay_source_availability_reconciliation_events e WHERE e.replay_id = r.id))) THEN
    v := v || 'REPLAY_OUTSIDE_PERSONAL'::text; END IF;
  IF EXISTS (SELECT 1 FROM shared_private.shared_direct_invitation_decline_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM shared_private.shared_governance_proposal_origins x WHERE x.proposer_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_add_member_payload_versions x WHERE x.target_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_direct_acceptance_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_direct_invitations x WHERE x.inviter_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_direct_invitations x WHERE x.target_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_history_item_baseline_viewers x JOIN public.shared_world_history_items i ON i.id = x.history_item_id
              WHERE x.user_id = p_user AND NOT (i.world_id = ANY (p_worlds))) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_history_item_required_approvers x JOIN public.shared_world_history_items i ON i.id = x.history_item_id
              WHERE x.approver_user_id = p_user AND NOT (i.world_id = ANY (p_worlds))) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_history_package_manifest_versions x WHERE x.grantee_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_history_package_required_approvers x WHERE x.approver_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_invitation_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_invite_credential_state x WHERE x.user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_material_commit_commands x WHERE x.actor_user_id = p_user AND NOT (x.world_id = ANY (p_worlds))) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_material_delete_commands x WHERE x.actor_user_id = p_user AND NOT (x.world_id = ANY (p_worlds))) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_materials x WHERE x.author_user_id = p_user AND NOT (x.world_id = ANY (p_worlds))) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_acceptance_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_invitations x WHERE x.target_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_joined_events x WHERE x.actor_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_left_events x WHERE x.actor_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_rejoin_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_rejoined_events x WHERE x.actor_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_removed_events x WHERE x.target_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_membership_episodes x WHERE x.user_id = p_user AND NOT (x.world_id = ANY (p_worlds))) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_rejoin_payload_versions x WHERE x.target_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_remove_member_payload_versions x WHERE x.target_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_standard_closed_view_entitlements x WHERE x.user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_standing_context_consent_events x WHERE x.grantor_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_standing_context_grant_audience x WHERE x.audience_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_standing_context_grants x WHERE x.grantor_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_voluntary_leave_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.publication_package_item_provenance x WHERE x.shared_world_id = ANY (p_worlds)) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.replay_source_manifest_items x WHERE x.shared_world_id = ANY (p_worlds)) THEN v := v || 'REPLAY_OUTSIDE_PERSONAL'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.replay_source_manifest_versions x WHERE x.shared_world_id = ANY (p_worlds)) THEN v := v || 'REPLAY_OUTSIDE_PERSONAL'::text; END IF;
  IF EXISTS (SELECT 1 FROM shared_private.shared_direct_birth_launch_evidence x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM shared_private.shared_governance_proposal_origins x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM shared_private.shared_qandeel_reply_work_leases x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM shared_semantic_private.semantic_passes x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM shared_semantic_private.semantic_places x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM shared_semantic_private.semantic_work_grants x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM shared_semantic_private.semantic_work_leases x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_add_member_payload_versions x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_direct_acceptance_commands x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_direct_birth_events x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_end_payload_versions x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_ended_events x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_governance_proposals x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_history_grant_commands x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_history_granted_events x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_history_package_manifest_items x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_history_package_manifest_versions x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_acceptance_commands x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_invitations x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_joined_events x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_left_events x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_rejoin_commands x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_rejoined_events x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_removal_commands x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_removed_events x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_membership_snapshots x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_rejoin_payload_versions x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_remove_member_payload_versions x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_setting_changed_events x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_settings_change_commands x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_settings_state x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_settings_versions x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_standard_closed_view_entitlement_items x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_standard_closed_view_entitlements x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_standard_end_commands x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_standing_context_consent_events x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_standing_context_grants x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_voluntary_leave_commands x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  RETURN ARRAY(SELECT DISTINCT c FROM unnest(v) AS u(c) ORDER BY c);
END$$;

-- (f) The coordinator, replaced forward: 0164's body with exactly two insertions - the account's Replays locked after
--     the Introduction claims and before the account row, and the Personal Replay module run under the same
--     authorization after the Matching / Introductions module and before the unchanged 0130 erasure - and its census
--     comment brought up to date. Every other line is unchanged; verify-migration-0169 proves it against 0164.
CREATE OR REPLACE FUNCTION account_erasure_private.erase_account_v1(p_deletion_id uuid)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' SET lock_timeout = '2s' AS $$
DECLARE
  v_request personal_data_private.account_deletions;
  v_user uuid;
  v_worlds uuid[];
  v_humans uuid[];
  v_classes text[];
  v_outcome text;
  v_reason text;
  v_failure text;
  v_keys integer;
  v_personal text;
  v_pending integer;
BEGIN
  SELECT * INTO v_request FROM personal_data_private.account_deletions d WHERE d.id = p_deletion_id;
  IF v_request.id IS NULL THEN
    RETURN 'UNKNOWN';
  ELSIF v_request.status IN ('ERASED', 'COMPLETED') THEN
    -- An erased request's residual sweep before each provider removal attempt: exactly 0130's (ALREADY_ERASED).
    RETURN personal_data_private.erase_personal_account_v1(p_deletion_id);
  ELSIF v_request.status = 'CANCELLED' THEN
    RETURN 'CANCELLED';
  ELSIF v_request.status = 'BLOCKED' THEN
    RETURN 'BLOCKED';
  ELSIF v_request.final_at > clock_timestamp() THEN
    RETURN 'NOT_DUE';
  END IF;
  v_user := v_request.user_id;

  -- THE LOCKS, in the published order (Introduction family: World, Record, setup; Matching family: setup, proposals,
  -- pointers; the account family last: the account row, then the request). Taken outside the erasure subtransaction so
  -- they survive its rollback and the outcome is written under them.
  BEGIN
    v_worlds := account_erasure_private.introduction_worlds_v1(v_user);
    PERFORM 1 FROM public.shared_worlds w WHERE w.id = ANY (v_worlds) ORDER BY w.id FOR UPDATE;
    PERFORM 1 FROM public.introduction_records r WHERE r.world_id = ANY (v_worlds) ORDER BY r.id FOR UPDATE;
    v_humans := account_erasure_private.matching_humans_v1(v_user);
    PERFORM 1 FROM public.matching_setup_locks l WHERE l.user_id = ANY (v_humans) ORDER BY l.user_id FOR UPDATE;
    -- A Match, a SUCCESS or a new pair that committed while this waited moved the footprint: a later pass sees it whole.
    IF v_worlds IS DISTINCT FROM account_erasure_private.introduction_worlds_v1(v_user)
       OR v_humans IS DISTINCT FROM account_erasure_private.matching_humans_v1(v_user) THEN
      RAISE EXCEPTION 'ACCOUNT_ERASURE_FOOTPRINT_MOVED' USING ERRCODE = '55P03';
    END IF;
    PERFORM 1 FROM public.matching_proposals x
     WHERE x.pair_id IN (SELECT p.id FROM public.matching_pairs p WHERE v_user IN (p.lower_user_id, p.higher_user_id))
     ORDER BY x.id FOR UPDATE;
    PERFORM 1 FROM public.matching_participation_state s
     WHERE s.participant_user_id = ANY (v_humans) ORDER BY s.participant_user_id FOR UPDATE;
    PERFORM 1 FROM public.matching_active_introduction_claims c WHERE c.world_id = ANY (v_worlds) ORDER BY c.id FOR UPDATE;
    -- S7-01 (0169): the account's own Replays, ascending, before the account row (every Replay path takes its Replay first).
    PERFORM 1 FROM public.replays r WHERE r.created_by_user_id = v_user ORDER BY r.id FOR UPDATE;
    PERFORM 1 FROM public.users u WHERE u.id = v_user FOR UPDATE;
    SELECT * INTO v_request FROM personal_data_private.account_deletions d WHERE d.id = p_deletion_id FOR UPDATE;
  EXCEPTION WHEN lock_not_available OR deadlock_detected OR serialization_failure THEN
    RETURN account_erasure_private.record_outcome_v1(p_deletion_id, 'RETRY', 'CONTENTION', NULL);
  END;

  -- Judged again under the locks, exactly as 0130 judges it.
  IF v_request.status = 'CANCELLED' THEN
    RETURN 'CANCELLED';
  ELSIF v_request.status = 'BLOCKED' THEN
    RETURN 'BLOCKED';
  ELSIF v_request.status IN ('ERASED', 'COMPLETED') THEN
    RETURN personal_data_private.erase_personal_account_v1(p_deletion_id);
  ELSIF v_request.final_at > clock_timestamp() THEN
    RETURN 'NOT_DUE';
  END IF;
  INSERT INTO account_erasure_private.deletion_progress AS g (deletion_id, last_outcome)
  VALUES (p_deletion_id, 'PENDING')
  ON CONFLICT (deletion_id) DO NOTHING;

  -- THE RESIDUE CENSUS, read-only, before anything is touched. The account row is held FOR UPDATE, so no transaction
  -- can add a row that references it until this one ends: the census is exact. A class blocks while no module covers
  -- it (S7-01 / 0169 covers REPLAY; ACCT-DEL-02 owns Shared STANDARD and Public; QAN-BL-ACCT-03 the Replay remainder).
  v_classes := ARRAY(
    SELECT c.residue_class FROM unnest(account_erasure_private.residue_classes_v1(v_user, v_worlds)) AS c(residue_class)
      JOIN account_erasure_private.residue_class_coverage k ON k.residue_class = c.residue_class
     WHERE NOT k.covered ORDER BY 1);
  IF cardinality(v_classes) > 0 THEN
    UPDATE personal_data_private.account_deletions d
       SET status = 'BLOCKED', blocked_at = clock_timestamp(), lease_until = NULL
     WHERE d.id = p_deletion_id;
    UPDATE account_erasure_private.deletion_progress g
       SET last_outcome = 'BLOCKED', residue_classes = v_classes, attempts = g.attempts + 1,
           consecutive_contention = 0, consecutive_unexplained = 0, updated_at = clock_timestamp()
     WHERE g.deletion_id = p_deletion_id;
    RETURN 'BLOCKED';
  END IF;

  -- THE ERASURE: one subtransaction around every write, the unchanged 0130 call included.
  BEGIN
    INSERT INTO account_erasure_private.erasure_authorizations (transaction_id, deletion_id)
    VALUES (pg_catalog.txid_current(), p_deletion_id);
    PERFORM pg_catalog.set_config('qandeel.account_erasure', pg_catalog.txid_current()::text, true);
    v_keys := account_erasure_private.erase_matching_introductions_v1(p_deletion_id, v_user, v_worlds);
    IF account_erasure_private.module_residue_v1(v_user) THEN
      RAISE EXCEPTION 'ACCOUNT_ERASURE_MODULE_INCOMPLETE' USING ERRCODE = 'P0001';
    END IF;
    -- S7-01 (0169): the Personal Replay module (QAN-BL-ACCT-02), under the same authorization, before 0130.
    PERFORM account_erasure_private.erase_personal_replays_v1(p_deletion_id, v_user);
    IF account_erasure_private.replay_module_residue_v1(v_user) THEN
      RAISE EXCEPTION 'ACCOUNT_ERASURE_MODULE_INCOMPLETE' USING ERRCODE = 'P0001';
    END IF;
    DELETE FROM account_erasure_private.erasure_authorizations a WHERE a.transaction_id = pg_catalog.txid_current();
    PERFORM pg_catalog.set_config('qandeel.account_erasure', '', true);
    v_personal := personal_data_private.erase_personal_account_v1(p_deletion_id);
    IF v_personal IS DISTINCT FROM 'ERASED' THEN
      -- 0130 rolled back only its own block and answered without raising: this undoes everything above with it.
      RAISE EXCEPTION 'ACCOUNT_ERASURE_PERSONAL_REFUSED' USING ERRCODE = 'P0001';
    END IF;
  EXCEPTION
    WHEN lock_not_available OR deadlock_detected OR serialization_failure THEN
      v_outcome := 'RETRY';
      v_reason := 'CONTENTION';
    WHEN foreign_key_violation THEN
      v_outcome := 'RETRY';
      v_reason := 'UNEXPLAINED_REFERENCE';
    WHEN OTHERS THEN
      IF SQLERRM = 'ACCOUNT_ERASURE_PERSONAL_REFUSED' THEN
        v_outcome := 'RETRY';
        v_reason := 'UNEXPLAINED_REFERENCE';
      ELSE
        v_outcome := 'INTEGRITY';
        v_failure := SQLSTATE;
      END IF;
  END;
  IF v_outcome IS NOT NULL THEN
    RETURN account_erasure_private.record_outcome_v1(p_deletion_id, v_outcome, v_reason, v_failure);
  END IF;

  SELECT count(*)::integer INTO v_pending FROM account_erasure_private.media_pending p WHERE p.deletion_id = p_deletion_id;
  UPDATE account_erasure_private.deletion_progress g
     SET last_outcome = 'ERASED', residue_classes = NULL, attempts = g.attempts + 1,
         consecutive_contention = 0, consecutive_unexplained = 0,
         erased_at = clock_timestamp(), media_keys = v_pending,
         media_erased_at = CASE WHEN v_pending = 0 THEN clock_timestamp() END, updated_at = clock_timestamp()
   WHERE g.deletion_id = p_deletion_id;
  RETURN 'ERASED';
END$$;

-- (g) The operations summary, replaced forward: `blocked_replay` counts every request a Replay class blocks.
CREATE OR REPLACE FUNCTION public.server_read_account_erasure_operations_v1()
RETURNS TABLE (
    blocked_shared_standard integer,
    blocked_public integer,
    blocked_replay integer,
    blocked_unregistered integer,
    blocked_unclassified integer,
    retrying integer,
    integrity_holding integer,
    media_pending integer,
    media_pending_oldest_age_seconds bigint,
    uncovered_classes integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    WITH blocked AS (
        SELECT d.id, g.residue_classes
          FROM personal_data_private.account_deletions d
          LEFT JOIN account_erasure_private.deletion_progress g ON g.deletion_id = d.id
         WHERE d.status = 'BLOCKED'
    ), scheduled AS (
        SELECT g.last_outcome
          FROM personal_data_private.account_deletions d
          JOIN account_erasure_private.deletion_progress g ON g.deletion_id = d.id
         WHERE d.status = 'SCHEDULED'
    ), media AS (
        SELECT count(*)::integer AS pending, min(g.erased_at) AS oldest
          FROM account_erasure_private.deletion_progress g
         WHERE g.erased_at IS NOT NULL AND g.media_erased_at IS NULL
    )
    SELECT (SELECT count(*) FROM blocked b WHERE 'SHARED_STANDARD' = ANY (b.residue_classes))::integer,
           (SELECT count(*) FROM blocked b WHERE 'PUBLIC' = ANY (b.residue_classes))::integer,
           (SELECT count(*) FROM blocked b WHERE b.residue_classes && ARRAY['REPLAY', 'REPLAY_OUTSIDE_PERSONAL'])::integer,
           (SELECT count(*) FROM blocked b WHERE 'UNREGISTERED' = ANY (b.residue_classes))::integer,
           (SELECT count(*) FROM blocked b WHERE b.residue_classes IS NULL)::integer,
           (SELECT count(*) FROM scheduled s WHERE s.last_outcome = 'RETRY')::integer,
           (SELECT count(*) FROM scheduled s WHERE s.last_outcome = 'INTEGRITY')::integer,
           m.pending,
           COALESCE(floor(EXTRACT(EPOCH FROM (clock_timestamp() - m.oldest)))::bigint, 0),
           (SELECT count(*) FROM account_erasure_private.residue_class_coverage k WHERE NOT k.covered)::integer
      FROM media m;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. OWNERSHIP AND ACL. Default-deny by name, then the exact grants.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  fn text;
  r text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'replay_private.reject_personal_replay_launch_evidence_mutation_v1()',
    'replay_private.set_replay_launch_capability_v1(text,text,text,text,text)',
    'replay_private.bind_replay_launch_gate_v1()',
    'replay_private.read_my_replay_capability_v1()',
    'replay_private.derive_identity_v1(text,uuid,uuid)',
    'replay_private.resolve_personal_range_v1(uuid,integer,integer)',
    'replay_private.version_viewing_state_v1(uuid,uuid)',
    'replay_private.create_my_replay_draft_v1(uuid,uuid,integer,integer)',
    'replay_private.revise_my_replay_draft_v1(uuid,uuid,bigint,integer,integer)',
    'replay_private.prepare_my_replay_preview_v1(uuid,uuid,bigint)',
    'replay_private.finalize_my_replay_version_v1(uuid,uuid,uuid)',
    'replay_private.reopen_my_replay_for_revision_v1(uuid,uuid,uuid)',
    'replay_private.read_my_replay_v1(uuid)',
    'replay_private.read_my_replay_version_v1(uuid,uuid)',
    'replay_private.read_my_replay_moments_v1(uuid,uuid)',
    'replay_private.read_my_replay_moment_analysis_v1(uuid,uuid,integer)',
    'replay_private.list_my_conversation_replays_v1(uuid)',
    'public.read_my_replay_capability_v1()',
    'public.create_my_replay_draft_v1(uuid,uuid,integer,integer)',
    'public.revise_my_replay_draft_v1(uuid,uuid,bigint,integer,integer)',
    'public.prepare_my_replay_preview_v1(uuid,uuid,bigint)',
    'public.finalize_my_replay_version_v1(uuid,uuid,uuid)',
    'public.reopen_my_replay_for_revision_v1(uuid,uuid,uuid)',
    'public.read_my_replay_v1(uuid)',
    'public.read_my_replay_version_v1(uuid,uuid)',
    'public.read_my_replay_moments_v1(uuid,uuid)',
    'public.read_my_replay_moment_analysis_v1(uuid,uuid,integer)',
    'public.list_my_conversation_replays_v1(uuid)',
    'account_erasure_private.erase_personal_replays_v1(uuid,uuid)',
    'account_erasure_private.replay_module_residue_v1(uuid)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r);
      END IF;
    END LOOP;
  END LOOP;
  -- The forward replacements keep the posture 0164 gave them: no application role, the coordinator's server entry
  -- unchanged, the operations summary service_role only.
  FOREACH fn IN ARRAY ARRAY[
    'account_erasure_private.residue_classes_v1(uuid,uuid[])',
    'account_erasure_private.erase_account_v1(uuid)',
    'public.server_read_account_erasure_operations_v1()'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r);
      END IF;
    END LOOP;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.server_read_account_erasure_operations_v1() TO service_role';
    -- The server channel holds nothing of Replay: every S7-01 act is the human's own, under the human's own token.
    EXECUTE 'REVOKE ALL ON SCHEMA replay_private FROM service_role';
    EXECUTE 'REVOKE ALL ON TABLE replay_private.replay_launch_capability_states, replay_private.replay_launch_capability_events, replay_private.personal_replay_launch_evidence FROM service_role';
  END IF;
END$$;

-- The INVOKER wrappers run as `authenticated`, which needs USAGE on the private schema and EXECUTE on the exact owner
-- commands and reads - never on the operator change, the bare gate binding, a helper or the erasure.
GRANT USAGE ON SCHEMA replay_private TO authenticated;
GRANT EXECUTE ON FUNCTION
  replay_private.read_my_replay_capability_v1(),
  replay_private.create_my_replay_draft_v1(uuid, uuid, integer, integer),
  replay_private.revise_my_replay_draft_v1(uuid, uuid, bigint, integer, integer),
  replay_private.prepare_my_replay_preview_v1(uuid, uuid, bigint),
  replay_private.finalize_my_replay_version_v1(uuid, uuid, uuid),
  replay_private.reopen_my_replay_for_revision_v1(uuid, uuid, uuid),
  replay_private.read_my_replay_v1(uuid),
  replay_private.read_my_replay_version_v1(uuid, uuid),
  replay_private.read_my_replay_moments_v1(uuid, uuid),
  replay_private.read_my_replay_moment_analysis_v1(uuid, uuid, integer),
  replay_private.list_my_conversation_replays_v1(uuid),
  public.read_my_replay_capability_v1(),
  public.create_my_replay_draft_v1(uuid, uuid, integer, integer),
  public.revise_my_replay_draft_v1(uuid, uuid, bigint, integer, integer),
  public.prepare_my_replay_preview_v1(uuid, uuid, bigint),
  public.finalize_my_replay_version_v1(uuid, uuid, uuid),
  public.reopen_my_replay_for_revision_v1(uuid, uuid, uuid),
  public.read_my_replay_v1(uuid),
  public.read_my_replay_version_v1(uuid, uuid),
  public.read_my_replay_moments_v1(uuid, uuid),
  public.read_my_replay_moment_analysis_v1(uuid, uuid, integer),
  public.list_my_conversation_replays_v1(uuid)
  TO authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. TERMINAL SELF-ASSERTIONS. The migration refuses to deploy a Replay path that is wider than its reviewed wrappers,
--    pre-opened, ungated, un-pinned, takes a human identity, reaches distribution, or an erasure that is incomplete,
--    disordered or touches a footprint it does not cover.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  r text;
  fn text;
  src text;
  p record;
  lock_pos integer[];
  wrappers constant text[] := ARRAY[
    'public.read_my_replay_capability_v1()',
    'public.create_my_replay_draft_v1(uuid,uuid,integer,integer)',
    'public.revise_my_replay_draft_v1(uuid,uuid,bigint,integer,integer)',
    'public.prepare_my_replay_preview_v1(uuid,uuid,bigint)',
    'public.finalize_my_replay_version_v1(uuid,uuid,uuid)',
    'public.reopen_my_replay_for_revision_v1(uuid,uuid,uuid)',
    'public.read_my_replay_v1(uuid)',
    'public.read_my_replay_version_v1(uuid,uuid)',
    'public.read_my_replay_moments_v1(uuid,uuid)',
    'public.read_my_replay_moment_analysis_v1(uuid,uuid,integer)',
    'public.list_my_conversation_replays_v1(uuid)'];
  gated constant text[] := ARRAY[
    'replay_private.create_my_replay_draft_v1(uuid,uuid,integer,integer)|public.create_replay_draft_v1(',
    'replay_private.revise_my_replay_draft_v1(uuid,uuid,bigint,integer,integer)|public.revise_replay_draft_v1(',
    'replay_private.prepare_my_replay_preview_v1(uuid,uuid,bigint)|public.prepare_replay_preview_v1(',
    'replay_private.finalize_my_replay_version_v1(uuid,uuid,uuid)|public.finalize_replay_version_v1(',
    'replay_private.reopen_my_replay_for_revision_v1(uuid,uuid,uuid)|public.reopen_replay_for_revision_v1('];
  frozen constant text[] := ARRAY[
    'public.create_replay_draft_v1(uuid,uuid,uuid,uuid,text,uuid,uuid,uuid[],uuid[],integer[],integer[],text)',
    'public.revise_replay_draft_v1(uuid,uuid,bigint,uuid,uuid,text,uuid,uuid,uuid[],uuid[],integer[],integer[],text)',
    'public.replay_capture_source_manifest_v1(uuid,uuid,integer,text,uuid,uuid,uuid[],timestamptz)',
    'public.replay_lock_source_manifest_v1(uuid)',
    'public.derive_replay_source_manifest_currency_v1(uuid)',
    'public.replay_resolve_selection_spec_v1(uuid,uuid,uuid,integer,uuid[],integer[],integer[],text,timestamptz)',
    'public.prepare_replay_preview_v1(uuid,uuid,bigint,uuid,uuid,uuid)',
    'public.finalize_replay_version_v1(uuid,uuid,uuid)',
    'public.reopen_replay_for_revision_v1(uuid,uuid,uuid)',
    'public.build_replay_analytical_projection_v1(uuid,uuid,integer,uuid,timestamptz)',
    'public.build_replay_render_contract_v1(uuid,uuid,integer,uuid,timestamptz)',
    'public.derive_replay_version_truth_currency_v1(uuid)',
    'public.replay_analytical_projection_point_digest_v1(integer,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)',
    'public.derive_replay_version_current_availability_v1(uuid,uuid)',
    'public.prepare_replay_distribution_package_v1',
    'public.approve_replay_distribution_v1',
    'public.withdraw_replay_distribution_approval_v1',
    'public.authorize_replay_distribution_v1',
    'public.reconcile_replay_post_finalization_state_v1'];
  resolvers constant text[] := ARRAY[
    'public.resolve_replay_draft_composition_v1(uuid,uuid)',
    'public.resolve_replay_current_version_v1(uuid,uuid)',
    'public.resolve_replay_version_current_usability_v1(uuid,uuid,uuid)'];
BEGIN
  -- The private tables: RLS on, no policy, no application-role privilege.
  FOREACH t IN ARRAY ARRAY['replay_private.replay_launch_capability_states', 'replay_private.replay_launch_capability_events',
                           'replay_private.personal_replay_launch_evidence'] LOOP
    IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = t::regclass) THEN
      RAISE EXCEPTION 'S7-01: row level security must be enabled on %', t;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = t::regclass) THEN
      RAISE EXCEPTION 'S7-01: no policy may exist on %', t;
    END IF;
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r)
         AND has_table_privilege(r, t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') THEN
        RAISE EXCEPTION 'S7-01: % can reach %', r, t;
      END IF;
    END LOOP;
  END LOOP;

  -- No migration opens the capability.
  IF EXISTS (SELECT 1 FROM replay_private.replay_launch_capability_states) THEN
    RAISE EXCEPTION 'S7-01: a migration configures no launch capability; PERSONAL_REPLAY starts closed';
  END IF;

  -- Every frozen I-06 primitive, core, derivation and distribution act stays executable by NO application role, and the
  -- three creator resolvers stay service_role-only: nothing frozen was granted to make this wrapper work.
  FOREACH fn IN ARRAY frozen LOOP
    FOR p IN SELECT pr.oid FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
              WHERE (CASE WHEN strpos(fn, '(') > 0 THEN pr.oid = fn::regprocedure
                          ELSE n.nspname || '.' || pr.proname = fn END) LOOP
      IF has_function_privilege('public', p.oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'S7-01: PUBLIC can execute %', fn;
      END IF;
      FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r) AND has_function_privilege(r, p.oid, 'EXECUTE') THEN
          RAISE EXCEPTION 'S7-01: % can execute frozen %', r, fn;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  FOREACH fn IN ARRAY resolvers LOOP
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r) AND has_function_privilege(r, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S7-01: % can execute the creator resolver %, which names its human as a parameter', r, fn;
      END IF;
    END LOOP;
  END LOOP;

  -- The exposed wrappers: postgres-owned, SECURITY INVOKER, pinned, `authenticated` only, and no human identity in.
  FOREACH fn IN ARRAY wrappers LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc pr WHERE pr.oid = fn::regprocedure AND NOT pr.prosecdef
                     AND pg_get_userbyid(pr.proowner) = 'postgres' AND pr.proconfig @> ARRAY['search_path=""']) THEN
      RAISE EXCEPTION 'S7-01: % must be postgres-owned, SECURITY INVOKER and search_path-pinned', fn;
    END IF;
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S7-01: PUBLIC must not execute %', fn;
    END IF;
    FOREACH r IN ARRAY ARRAY['anon', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r) AND has_function_privilege(r, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S7-01: % must not execute %', r, fn;
      END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = 'authenticated') AND NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S7-01: authenticated must execute %', fn;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_proc pr, unnest((pr.proargnames)[1:pr.pronargs]) a WHERE pr.oid = fn::regprocedure
                AND a ~* '(user|owner|actor|creator|author|approver|member|audience|coverage|unit|item|manifest|digest|authority)') THEN
      RAISE EXCEPTION 'S7-01: % must take no human identity, source item, coverage claim or authority', fn;
    END IF;
  END LOOP;

  -- Every replay_private function: SECURITY DEFINER, pinned, never anonymous; every human-facing one derives the human
  -- from auth.uid() and runs no dynamic SQL.
  FOR p IN SELECT pr.proname, pr.oid, pr.prosecdef, pr.proconfig, pr.prosrc, pr.prolang
             FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace WHERE n.nspname = 'replay_private' LOOP
    IF p.proname NOT IN ('derive_identity_v1', 'reject_personal_replay_launch_evidence_mutation_v1') AND NOT p.prosecdef THEN
      RAISE EXCEPTION 'S7-01: replay_private.% must be SECURITY DEFINER', p.proname;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'S7-01: replay_private.% must pin an empty search_path', p.proname;
    END IF;
    IF p.proname NOT IN ('set_replay_launch_capability_v1', 'bind_replay_launch_gate_v1', 'derive_identity_v1',
                         'reject_personal_replay_launch_evidence_mutation_v1')
       AND p.prosrc !~ 'auth\.uid\(\)' THEN
      RAISE EXCEPTION 'S7-01: replay_private.% must derive the human from auth.uid()', p.proname;
    END IF;
    IF regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~* '\mEXECUTE\s' THEN
      RAISE EXCEPTION 'S7-01: replay_private.% must run no dynamic SQL', p.proname;
    END IF;
    IF has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('service_role', p.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'S7-01: anon / service_role can execute replay_private.%', p.proname;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY['replay_private.set_replay_launch_capability_v1(text,text,text,text,text)',
                            'replay_private.bind_replay_launch_gate_v1()', 'replay_private.derive_identity_v1(text,uuid,uuid)',
                            'replay_private.resolve_personal_range_v1(uuid,integer,integer)',
                            'replay_private.version_viewing_state_v1(uuid,uuid)',
                            'account_erasure_private.erase_personal_replays_v1(uuid,uuid)',
                            'account_erasure_private.replay_module_residue_v1(uuid)'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = 'authenticated') AND has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S7-01: authenticated must not execute %', fn;
    END IF;
  END LOOP;

  -- Each gated command binds the gate BEFORE it reaches its frozen primitive, records the snapshot AFTER it, reaches no
  -- distribution, package, approval, publication or World write, and writes nothing frozen itself.
  FOREACH t IN ARRAY gated LOOP
    fn := split_part(t, '|', 1);
    SELECT regexp_replace(pr.prosrc, '--[^\n]*', '', 'g') INTO src FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF strpos(src, 'replay_private.bind_replay_launch_gate_v1()') = 0
       OR strpos(src, 'replay_private.bind_replay_launch_gate_v1()') > strpos(src, split_part(t, '|', 2))
       OR strpos(src, split_part(t, '|', 2)) > strpos(src, 'INSERT INTO replay_private.personal_replay_launch_evidence') THEN
      RAISE EXCEPTION 'S7-01: % must bind the gate, then invoke the primitive, then bind the evidence', fn;
    END IF;
    IF src ~* '(distribution|publication|public_experience|shared_world|approval|INSERT\s+INTO\s+public\.|UPDATE\s+public\.|DELETE\s+FROM)' THEN
      RAISE EXCEPTION 'S7-01: % must reach no distribution, Shared or Public relation and write nothing frozen itself', fn;
    END IF;
    IF src !~ 'WHEN SQLSTATE ''40001'' OR SQLSTATE ''PT409''' THEN
      RAISE EXCEPTION 'S7-01: % must absorb the frozen 40001 refusals (and PT409) into a bounded answer', fn;
    END IF;
  END LOOP;

  -- The CW2-08 seam is untouched and still fail-closed.
  IF (SELECT x.clearance FROM public.resolve_replay_distribution_prerequisites_v1(gen_random_uuid(), 'SHARE_EXTERNALLY') x)
     IS DISTINCT FROM 'NOT_EVALUATED' THEN
    RAISE EXCEPTION 'S7-01: the CW2-08 Replay distribution prerequisite seam must still answer NOT_EVALUATED';
  END IF;

  -- The erasure: the coordinator's order, the Replay lock before the account row, the module inside the authorization
  -- and before 0130; the module deletes exactly from every relation registered REPLAY, disables nothing, runs no
  -- dynamic SQL.
  SELECT regexp_replace(pr.prosrc, '--[^\n]*', '', 'g') INTO src
    FROM pg_proc pr WHERE pr.oid = 'account_erasure_private.erase_account_v1(uuid)'::regprocedure;
  lock_pos := ARRAY[
    strpos(src, 'FROM public.shared_worlds w WHERE w.id = ANY (v_worlds) ORDER BY w.id FOR UPDATE'),
    strpos(src, 'FROM public.introduction_records r WHERE r.world_id = ANY (v_worlds) ORDER BY r.id FOR UPDATE'),
    strpos(src, 'FROM public.matching_setup_locks l WHERE l.user_id = ANY (v_humans) ORDER BY l.user_id FOR UPDATE'),
    strpos(src, 'ORDER BY x.id FOR UPDATE'),
    strpos(src, 'ORDER BY s.participant_user_id FOR UPDATE'),
    strpos(src, 'FROM public.matching_active_introduction_claims c WHERE c.world_id = ANY (v_worlds) ORDER BY c.id FOR UPDATE'),
    strpos(src, 'FROM public.replays r WHERE r.created_by_user_id = v_user ORDER BY r.id FOR UPDATE'),
    strpos(src, 'FROM public.users u WHERE u.id = v_user FOR UPDATE'),
    strpos(src, 'WHERE d.id = p_deletion_id FOR UPDATE'),
    strpos(src, 'account_erasure_private.residue_classes_v1(v_user, v_worlds)'),
    strpos(src, 'INSERT INTO account_erasure_private.erasure_authorizations'),
    strpos(src, 'account_erasure_private.erase_matching_introductions_v1(p_deletion_id, v_user, v_worlds)'),
    strpos(src, 'account_erasure_private.erase_personal_replays_v1(p_deletion_id, v_user)'),
    strpos(src, 'account_erasure_private.replay_module_residue_v1(v_user)'),
    strpos(src, 'DELETE FROM account_erasure_private.erasure_authorizations'),
    strpos(src, 'personal_data_private.erase_personal_account_v1(p_deletion_id);
    IF v_personal')];
  FOR i IN 1 .. array_length(lock_pos, 1) LOOP
    IF lock_pos[i] = 0 OR (i > 1 AND lock_pos[i] <= lock_pos[i - 1]) THEN
      RAISE EXCEPTION 'S7-01: the coordinator order is broken at step %', i;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY['account_erasure_private.erase_account_v1(uuid)',
                            'account_erasure_private.erase_personal_replays_v1(uuid,uuid)'] LOOP
    SELECT pr.prosrc INTO src FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF src ~* '(session_replication_role|DISABLE\s+TRIGGER|ALTER\s+TABLE|TRUNCATE|EXECUTE\s)' THEN
      RAISE EXCEPTION 'S7-01: % must not disable a guard, alter a table, truncate or run dynamic SQL', fn;
    END IF;
  END LOOP;
  SELECT pr.prosrc INTO src FROM pg_proc pr
   WHERE pr.oid = 'account_erasure_private.erase_personal_replays_v1(uuid,uuid)'::regprocedure;
  FOR p IN SELECT g.relation FROM account_erasure_private.coverage_registry g WHERE g.coverage = 'REPLAY'
            AND g.relation NOT LIKE 'replay_distribution%' AND g.relation NOT LIKE 'replay_public_distribution%'
            AND g.relation NOT IN ('replay_reconciliation_commands', 'replay_source_availability_reconciliation_events') LOOP
    IF strpos(src, 'DELETE FROM ' || CASE WHEN p.relation LIKE '%.%' THEN p.relation ELSE 'public.' || p.relation END || ' ') = 0 THEN
      RAISE EXCEPTION 'S7-01: the Personal Replay module covers % but never deletes from it', p.relation;
    END IF;
  END LOOP;
  IF src ~ 'replay_distribution|replay_public_distribution|replay_reconciliation|reconciliation_events' THEN
    RAISE EXCEPTION 'S7-01: the Personal Replay module must not touch a distribution or reconciliation relation';
  END IF;

  -- Every relation that references a Replay relation is registered, and REPLAY is covered while its remainder is not.
  IF EXISTS (SELECT 1 FROM pg_constraint c
              WHERE c.contype = 'f'
                AND (c.confrelid::regclass::text LIKE 'replay%' OR c.confrelid::regclass::text LIKE 'replay_private.%')
                AND c.conrelid::regclass::text NOT IN (SELECT g.relation FROM account_erasure_private.coverage_registry g)
                AND c.conrelid::regclass::text NOT LIKE 'replay_private.replay_launch_capability_%') THEN
    RAISE EXCEPTION 'S7-01: a relation referencing a Replay relation is missing from the coverage registry';
  END IF;
  IF NOT (SELECT k.covered FROM account_erasure_private.residue_class_coverage k WHERE k.residue_class = 'REPLAY')
     OR (SELECT k.covered FROM account_erasure_private.residue_class_coverage k WHERE k.residue_class = 'REPLAY_OUTSIDE_PERSONAL')
     OR EXISTS (SELECT 1 FROM account_erasure_private.residue_class_coverage k
                 WHERE k.residue_class IN ('SHARED_STANDARD', 'PUBLIC', 'UNREGISTERED') AND k.covered) THEN
    RAISE EXCEPTION 'S7-01: REPLAY is covered, REPLAY_OUTSIDE_PERSONAL is not, and nothing else changed';
  END IF;
END$$;

COMMIT;
