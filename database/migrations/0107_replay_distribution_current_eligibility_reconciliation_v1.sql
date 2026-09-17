-- ---------------------------------------------------------------------------
-- QANDEEL Connected Worlds v2
-- I-06D - Post-authorization current delivery eligibility, controlled
--         reconciliation and Replay Runtime closure (migration 0107 of
--         0106 / 0107).
--
-- Architecture authority: CW2-05 - Replay Runtime Architecture v1.0, sections 31
-- and 32, with binding CW2-01, CW2-02, CW2-04, CW2-08, the merged I-05C Public
-- disappearance truth and the merged Replay runtime through 0100-0106.
--
-- ## The one distinction this migration exists to make
--
--   HISTORICAL DISTRIBUTION AUTHORIZATION
--       evidence that an authorization existed at one exact instant, over one
--       exact immutable package. Append-only. Never rewritten, never deleted,
--       never "refreshed".
--
--   CURRENT DELIVERY ELIGIBILITY
--       whether that authorization may still be USED for a future
--       QANDEEL-controlled distribution act. Derived live, from current
--       canonical state, every time it is asked.
--
-- A historical `AUTHORIZED_FOR_DELIVERY` fact is not a permanent bearer right.
-- Source, approval, authority, the sanitized surface, the destination's own
-- runtime and the CW2-08 prerequisite can each move afterwards, and each of them
-- makes FUTURE use of that authorization refuse - while the authorization row
-- itself stays exactly as it was written.
--
-- ## What this migration does NOT do
--
-- It performs no delivery, because no transport boundary exists in this
-- repository. It therefore also claims no recall: CW2-05 is explicit that Replay
-- cannot guarantee recall of already-exported external copies, and nothing here
-- records a remote file as deleted, a recipient copy as destroyed or a download
-- as revoked on a device. The truthful statement this runtime can make is
-- exactly one sentence: future QANDEEL-controlled distribution is refused.
--
-- It creates no second Public visibility authority and no second source-currency
-- evaluator. It extends `resolve_public_visibility_state_v1` in no way at all -
-- it CONSUMES it - and a private Replay source that later becomes unavailable
-- never forces a Public Experience to ABSENT_FROM_PUBLIC_WORLD. CW2-05 declines
-- to invent that rule, I-06C's Public REPLAY_ARTIFACT is a bounded sanitized
-- derivative rather than a live private-source pointer, and pushing a private
-- Replay-source check into the canonical Public resolver would create both a
-- cross-domain policy no contract froze and a private-source oracle addressable
-- by any admitted Public viewer.
--
-- What DOES still fail closed is everything the Public runtime already fails
-- closed on: canonical approval withdrawal, controller disappearance,
-- ABSENT_FROM_PUBLIC_WORLD and every other I-05C continuing-eligibility failure.
-- Those remain owned by the Public runtime, answered immediately by it, and no
-- Replay state of any kind can resurrect a Public Experience after them.
--
-- ## Evidence is not authority
--
-- The two reconciliation relations record that QANDEEL LOOKED and what it saw.
-- Privacy and current eligibility never wait for them: the live derivation is
-- the answer, the moment it is asked, and a reconciliation row can only ever
-- document a result it did not create. Nothing in 0106 or 0107 reads a
-- reconciliation row to decide anything.
-- ---------------------------------------------------------------------------
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. ONE ADDITIVE CANDIDATE KEY ON A FROZEN RELATION.
--
--    Trivially unique, because it contains the primary key: it constrains no row
--    the primary key did not already constrain, and changes no existing
--    behaviour. It exists so a reconciliation record can bind a package, its
--    Replay and its Replay Version as ONE row - the 0104 idiom - rather than as
--    three independent partial keys that could each be satisfied by a different
--    parent.
-- ---------------------------------------------------------------------------
ALTER TABLE public.replay_distribution_package_versions
  ADD CONSTRAINT replay_distribution_package_versions_target_key
  UNIQUE (id, replay_id, replay_version_id);

-- ---------------------------------------------------------------------------
-- 2. APPEND-ONLY DISTRIBUTION RECONCILIATION EVIDENCE.
--
--    Bounded classification and a database-owned instant, and nothing else. No
--    source body, no private provenance payload, no free-form explanation, no
--    external copy, no delivery, no recall. It carries the internal refusal
--    CLASS, which names WHICH gate answered no - never who withdrew, which World
--    held the source or what changed in it.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_distribution_reconciliation_events (
    id uuid NOT NULL,
    replay_id uuid NOT NULL,
    replay_version_id uuid NOT NULL,
    distribution_package_version_id uuid NOT NULL,
    observed_eligibility_state text NOT NULL,
    observed_refusal_class text,
    observed_at timestamptz NOT NULL,
    CONSTRAINT replay_distribution_reconciliation_events_pk PRIMARY KEY (id),
    -- ONE observation per package per reconciliation command, and the exact
    -- bounded vocabulary of the derivation in section 4.
    CONSTRAINT replay_distribution_reconciliation_events_state_check
        CHECK (observed_eligibility_state IN ('ELIGIBLE_FOR_FUTURE_DELIVERY',
                                              'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY')),
    CONSTRAINT replay_distribution_reconciliation_events_class_check
        CHECK (observed_refusal_class IS NULL OR observed_refusal_class IN (
            'NOT_AUTHORIZED', 'PACKAGE_STATE_CONTRADICTORY', 'SOURCE_NOT_CURRENT',
            'SOURCE_STATE_CONTRADICTORY', 'AUTHORITY_UNRESOLVED', 'AUTHORITY_SUPERSEDED',
            'APPROVAL_NOT_EFFECTIVE', 'EXPORT_SURFACE_SUPERSEDED',
            'PUBLIC_DESTINATION_NOT_SERVING', 'PREREQUISITE_UNRESOLVED')),
    -- The state and the class agree in BOTH directions, so an eligible
    -- observation can never carry a refusal and a refusal can never be empty.
    CONSTRAINT replay_distribution_reconciliation_events_agreement_check CHECK (
        (observed_eligibility_state = 'ELIGIBLE_FOR_FUTURE_DELIVERY' AND observed_refusal_class IS NULL)
     OR (observed_eligibility_state = 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY' AND observed_refusal_class IS NOT NULL)),
    -- THE EXACT PACKAGE, ITS REPLAY AND ITS REPLAY VERSION AS ONE ROW.
    CONSTRAINT replay_distribution_reconciliation_events_target_fk
        FOREIGN KEY (distribution_package_version_id, replay_id, replay_version_id)
        REFERENCES public.replay_distribution_package_versions (id, replay_id, replay_version_id)
        ON DELETE RESTRICT
);

ALTER TABLE public.replay_distribution_reconciliation_events OWNER TO postgres;
ALTER TABLE public.replay_distribution_reconciliation_events ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER replay_distribution_reconciliation_events_immutable
  BEFORE UPDATE OR DELETE ON public.replay_distribution_reconciliation_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_replay_post_finalization_mutation_v1();

-- ---------------------------------------------------------------------------
-- 3. THE TYPED RECONCILIATION COMMAND.
--
--    A NARROW TYPED RELATION, never a generic command bus: the purpose is a
--    two-value vocabulary, the shape of the row is pinned to the purpose in both
--    directions, and the committed ANSWER lives here so an equivalent retry is
--    answered from what was committed rather than from what the retry says.
--
--    The command identity binds the WHOLE immutable request. `request_ref`
--    digests the actor, the exact Replay, the exact Replay Version, the exact
--    package (or its absence) and the purpose, so the same command id carrying
--    any materially different request is a deterministic conflict that writes
--    nothing rather than a convenient ALREADY_COMMITTED over a different target.
--
--    It is append-only for every role including its owner. That is deliberately
--    STRONGER than the I-06C command relations, which are sealed but carry no
--    guard, because these rows hold the committed answer idempotency returns: a
--    command row that could be edited could rewrite what a past retry is told.
-- ---------------------------------------------------------------------------
CREATE TABLE public.replay_reconciliation_commands (
    id uuid NOT NULL,
    replay_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    replay_version_id uuid NOT NULL,
    distribution_package_version_id uuid,
    reconciliation_purpose text NOT NULL,
    committed_availability_state text NOT NULL,
    committed_eligibility_state text,
    request_ref text NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT replay_reconciliation_commands_pk PRIMARY KEY (id),
    CONSTRAINT replay_reconciliation_commands_purpose_check
        CHECK (reconciliation_purpose IN ('SOURCE_AVAILABILITY',
                                          'SOURCE_AVAILABILITY_AND_DISTRIBUTION')),
    -- The purpose, the package and the committed distribution answer agree in
    -- every direction: a source-only reconciliation can never carry a package or
    -- a distribution answer, and a distribution reconciliation can never omit
    -- either of them.
    CONSTRAINT replay_reconciliation_commands_shape_check CHECK (
        (reconciliation_purpose = 'SOURCE_AVAILABILITY_AND_DISTRIBUTION'
            AND distribution_package_version_id IS NOT NULL AND committed_eligibility_state IS NOT NULL)
     OR (reconciliation_purpose = 'SOURCE_AVAILABILITY'
            AND distribution_package_version_id IS NULL AND committed_eligibility_state IS NULL)),
    CONSTRAINT replay_reconciliation_commands_availability_check
        CHECK (committed_availability_state IN ('CURRENT', 'NOT_CURRENT', 'CONTRADICTORY')),
    CONSTRAINT replay_reconciliation_commands_eligibility_check
        CHECK (committed_eligibility_state IS NULL
            OR committed_eligibility_state IN ('ELIGIBLE_FOR_FUTURE_DELIVERY',
                                               'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY')),
    CONSTRAINT replay_reconciliation_commands_request_check
        CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    -- The actor is the exact Replay creator, structurally, through the 0100 key.
    CONSTRAINT replay_reconciliation_commands_creator_fk
        FOREIGN KEY (replay_id, actor_user_id)
        REFERENCES public.replays (id, created_by_user_id) ON DELETE RESTRICT,
    -- And the target is a HISTORICALLY FINALIZED version of that exact Replay.
    CONSTRAINT replay_reconciliation_commands_version_fk
        FOREIGN KEY (replay_version_id, replay_id)
        REFERENCES public.replay_version_finalizations (replay_version_id, replay_id) ON DELETE RESTRICT,
    CONSTRAINT replay_reconciliation_commands_package_fk
        FOREIGN KEY (distribution_package_version_id, replay_id, replay_version_id)
        REFERENCES public.replay_distribution_package_versions (id, replay_id, replay_version_id)
        ON DELETE RESTRICT
);

ALTER TABLE public.replay_reconciliation_commands OWNER TO postgres;
ALTER TABLE public.replay_reconciliation_commands ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER replay_reconciliation_commands_immutable
  BEFORE UPDATE OR DELETE ON public.replay_reconciliation_commands
  FOR EACH ROW EXECUTE FUNCTION public.reject_replay_post_finalization_mutation_v1();

-- ---------------------------------------------------------------------------
-- 4. CURRENT DELIVERY ELIGIBILITY FOR ONE EXACT DISTRIBUTION PACKAGE.
--
--    Read-only, STABLE, takes no lock: a caller that needs a stable answer holds
--    the Replay, the source and the approvals first, exactly as the frozen I-06C
--    authorization path does. Section 6 does precisely that.
--
--    TOTAL AND FAIL-CLOSED. Every gate it cannot establish - including a
--    predecessor derivation that refuses, which is what the production
--    analytical subject-authority seam does - answers NOT_ELIGIBLE with a
--    bounded internal class rather than raising something a caller could read as
--    permission.
--
--    IT NEVER CLAIMS DELIVERY. `ELIGIBLE_FOR_FUTURE_DELIVERY` says that a future
--    reviewed distribution act would not be refused by any of these gates TODAY.
--    No transport exists, nothing was sent, and no already-exported copy is
--    claimed recalled.
--
--    The order is the frozen I-06C order, and it is load-bearing:
--
--      1  a package never authorized has no authorization to use
--      2  the historical finalization it binds is still there
--      3  CURRENT SOURCE AVAILABILITY, through the ONE canonical chain
--      4  the current authority identity still agrees
--      5  every required approval is still effective
--      6  the sanitized surface still re-derives
--      7  the destination's own current state, owned by its own runtime
--      8  the CW2-08 prerequisite LAST, after every privacy and ownership gate
--
--    Source is answered BEFORE authority on purpose. The analytical
--    subject-authority seam is unresolved in production, so an authority-first
--    order would make the source-loss refusal unreachable outside a test seam -
--    and source loss is the whole subject of this slice.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.derive_replay_distribution_current_eligibility_v1(
  p_distribution_package_version_id uuid
) RETURNS TABLE(eligibility_state text, refusal_class text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  package public.replay_distribution_package_versions;
  bridge public.replay_public_distribution_artifacts;
  authorized public.replay_distribution_authorizations;
  current_availability text;
  derived record;
  visible record;
  gate record;
  stored uuid[];
  stored_digest text;
  recomputed_digest text;
BEGIN
  IF p_distribution_package_version_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT p.* INTO package FROM public.replay_distribution_package_versions p
   WHERE p.id = p_distribution_package_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLAY_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- 1. THE HISTORICAL AUTHORIZATION. Read from the row variable rather than from
  --    FOUND, because a later assignment would clobber that shared flag.
  SELECT z.* INTO authorized FROM public.replay_distribution_authorizations z
   WHERE z.distribution_package_version_id = package.id;
  IF authorized.distribution_package_version_id IS NULL THEN
    RETURN QUERY SELECT 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY'::text, 'NOT_AUTHORIZED'::text; RETURN;
  END IF;

  -- 2. THE HISTORICAL FINALIZATION IS STILL THERE. It is read, never rewritten:
  --    a source that moved afterwards changes nothing about this row.
  IF NOT EXISTS (SELECT 1 FROM public.replay_version_finalizations f
                  WHERE f.replay_version_id = package.replay_version_id
                    AND f.replay_id = package.replay_id) THEN
    RETURN QUERY SELECT 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY'::text, 'PACKAGE_STATE_CONTRADICTORY'::text; RETURN;
  END IF;

  -- 3. CURRENT SOURCE AVAILABILITY, delegated whole to the 0106 derivation,
  --    which delegates whole to the canonical I-06A source currency. Nothing is
  --    reconstructed and no digest substitutes for an absent source.
  BEGIN
    SELECT a.availability_state INTO current_availability
      FROM public.derive_replay_version_current_availability_v1(package.replay_id, package.replay_version_id) a;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY'::text, 'PACKAGE_STATE_CONTRADICTORY'::text; RETURN;
  END;
  IF current_availability = 'CONTRADICTORY' THEN
    RETURN QUERY SELECT 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY'::text, 'SOURCE_STATE_CONTRADICTORY'::text; RETURN;
  END IF;
  IF current_availability IS DISTINCT FROM 'CURRENT' THEN
    RETURN QUERY SELECT 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY'::text, 'SOURCE_NOT_CURRENT'::text; RETURN;
  END IF;

  -- 4. THE CURRENT AUTHORITY, RE-DERIVED THROUGH THE ONE I-06C DERIVATION.
  --    A parallel fingerprint is never computed here. The unresolved seam is a
  --    refusal rather than an error the caller reads, and it is never
  --    reinterpreted as an empty requirement.
  BEGIN
    SELECT * INTO derived FROM public.derive_replay_distribution_authority_v1(package.id);
  EXCEPTION
    WHEN SQLSTATE '55000' THEN
      RETURN QUERY SELECT 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY'::text, 'AUTHORITY_UNRESOLVED'::text; RETURN;
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY'::text, 'PACKAGE_STATE_CONTRADICTORY'::text; RETURN;
  END;
  SELECT coalesce(array_agg(ra.approver_user_id ORDER BY ra.approver_user_id), ARRAY[]::uuid[])
    INTO stored FROM public.replay_distribution_required_approvers ra
   WHERE ra.distribution_package_version_id = package.id;
  IF stored IS DISTINCT FROM derived.required_approvers
     OR derived.authority_fingerprint IS DISTINCT FROM package.authority_request_fingerprint
     OR authorized.authority_request_fingerprint IS DISTINCT FROM derived.authority_fingerprint THEN
    RETURN QUERY SELECT 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY'::text, 'AUTHORITY_SUPERSEDED'::text; RETURN;
  END IF;

  -- 5. EVERY REQUIRED APPROVAL IS STILL CURRENTLY EFFECTIVE. Historical approval
  --    rows are never counted: one taken back is WITHDRAWN, one never given is
  --    MISSING, one bound to an authority this package no longer carries is
  --    SUPERSEDED, and each refuses future use. The class collapses all three,
  --    so the caller never learns WHICH human moved.
  IF EXISTS (SELECT 1 FROM public.derive_replay_distribution_effective_approvals_v1(package.id) s
              WHERE s.effective_state IS DISTINCT FROM 'EFFECTIVE') THEN
    RETURN QUERY SELECT 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY'::text, 'APPROVAL_NOT_EFFECTIVE'::text; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.derive_replay_distribution_effective_approvals_v1(package.id) s
              WHERE s.bound_authority_fingerprint IS DISTINCT FROM derived.authority_fingerprint) THEN
    RETURN QUERY SELECT 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY'::text, 'AUTHORITY_SUPERSEDED'::text; RETURN;
  END IF;

  -- 6. THE SANITIZED SURFACE STILL RE-DERIVES FROM THE VERSION IT CLAIMS.
  SELECT d.descriptor_digest INTO stored_digest
    FROM public.replay_distribution_export_descriptors d
   WHERE d.distribution_package_version_id = package.id;
  BEGIN
    SELECT s.descriptor_digest INTO recomputed_digest
      FROM public.derive_replay_export_descriptor_v1(
             package.replay_version_id, package.destination_action, package.audience_safe_reference) s;
  EXCEPTION WHEN OTHERS THEN
    recomputed_digest := NULL;
  END;
  IF stored_digest IS NULL OR recomputed_digest IS DISTINCT FROM stored_digest THEN
    RETURN QUERY SELECT 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY'::text, 'EXPORT_SURFACE_SUPERSEDED'::text; RETURN;
  END IF;

  -- 7. THE DESTINATION'S OWN CURRENT STATE.
  --
  --    For a Public destination the question is whether the CANONICAL Public
  --    runtime is currently serving THIS package's exact Public manifest. The
  --    canonical resolver answers it; this derivation adds no Public rule, tests
  --    no Public lifecycle of its own and writes no Public transition. A
  --    NOT_PUBLICLY_VISIBLE answer - approval withdrawn, controller gone,
  --    ABSENT_FROM_PUBLIC_WORLD, or any other I-05C continuing-eligibility
  --    failure - makes this package currently unusable, and no Replay state can
  --    turn that back around.
  --
  --    SHARE_EXTERNALLY and DOWNLOAD have no destination subsystem at this
  --    baseline, so nothing is consulted and no Public row is touched.
  IF package.destination_action = 'PUBLISH_TO_PUBLIC_WORLD' THEN
    SELECT b.* INTO bridge FROM public.replay_public_distribution_artifacts b
     WHERE b.distribution_package_version_id = package.id;
    IF bridge.package_item_id IS NULL THEN
      RETURN QUERY SELECT 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY'::text, 'PACKAGE_STATE_CONTRADICTORY'::text; RETURN;
    END IF;
    SELECT v.visibility_state AS state, v.visible_manifest_version_id AS manifest INTO visible
      FROM public.resolve_public_visibility_state_v1(bridge.public_experience_id) v;
    IF visible.state IS DISTINCT FROM 'PUBLICLY_VISIBLE'
       OR visible.manifest IS DISTINCT FROM bridge.public_manifest_version_id THEN
      RETURN QUERY SELECT 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY'::text, 'PUBLIC_DESTINATION_NOT_SERVING'::text; RETURN;
    END IF;
  END IF;

  -- 8. THE CW2-08 PREREQUISITE, LAST. No layer manufactures another: a single
  --    unevaluated dimension refuses the whole thing.
  SELECT * INTO gate FROM public.resolve_replay_distribution_prerequisites_v1(
    package.id, package.destination_action);
  IF gate.clearance IS DISTINCT FROM 'CLEARED'
     OR gate.safety_state IS DISTINCT FROM 'SAFETY_ALLOW'
     OR gate.moderation_state IS DISTINCT FROM 'MODERATION_ALLOW'
     OR gate.entitlement_state IS DISTINCT FROM 'ENTITLED'
     OR gate.feature_state IS DISTINCT FROM 'FEATURE_ENABLED'
     OR gate.launch_state IS DISTINCT FROM 'LAUNCH_CLEARED' THEN
    RETURN QUERY SELECT 'NOT_ELIGIBLE_FOR_FUTURE_DELIVERY'::text, 'PREREQUISITE_UNRESOLVED'::text; RETURN;
  END IF;

  RETURN QUERY SELECT 'ELIGIBLE_FOR_FUTURE_DELIVERY'::text, NULL::text;
END$$;

ALTER FUNCTION public.derive_replay_distribution_current_eligibility_v1(uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 5. THE CREATOR-EXACT CURRENT DISTRIBUTION STATE BOUNDARY.
--
--    The creator of the Replay, and nobody else. Everyone else receives ZERO
--    ROWS - the same answer a nonexistent package produces - so the boundary is
--    not an existence oracle.
--
--    It reports the HISTORICAL state and the CURRENT answer side by side,
--    because those are two different facts and the whole point of this slice is
--    that they can disagree. The historical state comes from the immutable
--    authorization row and is never recomputed.
--
--    The creator-facing class is narrower than the internal one. Which gate said
--    no is internal; what the creator can act on is:
--
--      NOT_AUTHORIZED                        never authorized in the first place
--      SOURCE_NOT_CURRENTLY_AVAILABLE        the source layer cannot be used now
--      AUTHORITY_NO_LONGER_CURRENT           the human authority it carried moved
--      DESTINATION_NOT_CURRENTLY_SERVING     the destination's own runtime says no
--      DISTRIBUTION_PREREQUISITE_UNRESOLVED  CW2-08 has not cleared this
--      PACKAGE_STATE_CONTRADICTORY           the package no longer coheres
--
--    Collapsing missing / withdrawn / superseded / unresolved into ONE authority
--    class is deliberate: the creator learns that the authority is no longer
--    current without learning which human withdrew, which is exactly the line
--    every consent surface in this runtime already holds.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_replay_distribution_current_state_v1(
  p_distribution_package_version_id uuid, p_user_id uuid
) RETURNS TABLE(distribution_package_version_id uuid, destination_action text,
                historical_distribution_state text, current_eligibility_state text,
                unavailable_class text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  package public.replay_distribution_package_versions;
  historical text;
  current_state text;
  internal_class text;
BEGIN
  IF p_distribution_package_version_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'REPLAY_DISTRIBUTION_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT p.* INTO package FROM public.replay_distribution_package_versions p
    JOIN public.replays r ON r.id = p.replay_id
   WHERE p.id = p_distribution_package_version_id AND r.created_by_user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT z.distribution_state INTO historical
    FROM public.replay_distribution_authorizations z
   WHERE z.distribution_package_version_id = package.id;

  SELECT e.eligibility_state, e.refusal_class INTO current_state, internal_class
    FROM public.derive_replay_distribution_current_eligibility_v1(package.id) e;

  RETURN QUERY SELECT package.id, package.destination_action, historical, current_state,
    CASE
      WHEN internal_class IS NULL THEN NULL
      WHEN internal_class = 'NOT_AUTHORIZED' THEN 'NOT_AUTHORIZED'
      WHEN internal_class IN ('SOURCE_NOT_CURRENT', 'SOURCE_STATE_CONTRADICTORY')
        THEN 'SOURCE_NOT_CURRENTLY_AVAILABLE'
      WHEN internal_class IN ('AUTHORITY_UNRESOLVED', 'AUTHORITY_SUPERSEDED',
                              'APPROVAL_NOT_EFFECTIVE', 'EXPORT_SURFACE_SUPERSEDED')
        THEN 'AUTHORITY_NO_LONGER_CURRENT'
      WHEN internal_class = 'PUBLIC_DESTINATION_NOT_SERVING' THEN 'DESTINATION_NOT_CURRENTLY_SERVING'
      WHEN internal_class = 'PREREQUISITE_UNRESOLVED' THEN 'DISTRIBUTION_PREREQUISITE_UNRESOLVED'
      ELSE 'PACKAGE_STATE_CONTRADICTORY'
    END::text;
END$$;

ALTER FUNCTION public.resolve_replay_distribution_current_state_v1(uuid, uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 6. THE CONTROLLED RECONCILIATION PRIMITIVE.
--
--    ## What it is for
--
--    Durable convergence evidence, and nothing else. It records what QANDEEL
--    observed about ONE exact finalized Replay Version, and optionally about ONE
--    exact distribution package of it, under the canonical lock order.
--
--    ## What it may never become
--
--    The answer. Current truth is the live derivation, always, immediately. This
--    primitive cannot make a result true, cannot cache one, and cannot outvote
--    one: every row it writes is append-only audit evidence, and no derivation in
--    0106 or 0107 reads one.
--
--    ## Why it is creator-scoped
--
--    Because the canonical source lock, `replay_lock_source_manifest_v1`, is
--    creator-scoped by construction. Reconciling under any other principal would
--    mean either inventing a second source-lock path or skipping the lock, and
--    both are forbidden. The human comes from auth.uid() and is never a
--    parameter, so a caller can never reconcile as somebody else.
--
--    ## The canonical lock order, Replay first, with no inversion anywhere
--
--      1  public.replays                              FOR UPDATE
--      2  replay_distribution_package_versions        FOR SHARE, exact target
--         replay_versions                             FOR SHARE
--      3  replay_lock_source_manifest_v1(...)         each source domain's own
--                                                     frozen order
--      4  replay_distribution_approvals               FOR SHARE, ORDER BY approver
--      5  public_world_state, public_experiences      FOR SHARE, and ONLY when
--                                                     this package really has a
--                                                     Public destination
--      6  the append-only I-06D writes
--
--    Public rows are taken FOR SHARE rather than FOR UPDATE because
--    reconciliation READS Public truth and never writes it. No Public lifecycle
--    transition is performed here, by this primitive or by anything it calls.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.reconcile_replay_post_finalization_state_v1(
  p_command_id uuid, p_replay_id uuid, p_replay_version_id uuid,
  p_distribution_package_version_id uuid
) RETURNS TABLE(outcome text, reconciled_replay_id uuid, reconciled_replay_version_id uuid,
                reconciled_package_version_id uuid, availability_answer text,
                eligibility_answer text, reconciled_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.replay_reconciliation_commands;
  replay public.replays;
  version public.replay_versions;
  package public.replay_distribution_package_versions;
  bridge public.replay_public_distribution_artifacts;
  purpose text;
  request text;
  instant timestamptz;
  availability text;
  eligibility text;
  refusal text;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'REPLAY_POST_FINALIZATION_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_replay_id IS NULL OR p_replay_version_id IS NULL
     OR p_command_id = p_replay_id OR p_command_id = p_replay_version_id
     OR p_command_id IS NOT DISTINCT FROM p_distribution_package_version_id THEN
    RAISE EXCEPTION 'REPLAY_POST_FINALIZATION_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  purpose := CASE WHEN p_distribution_package_version_id IS NULL
                  THEN 'SOURCE_AVAILABILITY' ELSE 'SOURCE_AVAILABILITY_AND_DISTRIBUTION' END;

  -- THE WHOLE IMMUTABLE REQUEST, as one digest. Actor, exact Replay, exact
  -- version, exact package or its explicit absence, and the purpose.
  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_REPLAY_POST_FINALIZATION_RECONCILIATION_COMMAND_V1' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'replay=' || lower(p_replay_id::text) || E'\n'
   || 'replayVersion=' || lower(p_replay_version_id::text) || E'\n'
   || 'package=' || coalesce(lower(p_distribution_package_version_id::text), 'NONE') || E'\n'
   || 'purpose=' || purpose, 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, reading only immutable
  -- command history, so an equivalent retry is answered even after the source
  -- moved - and answered with what was COMMITTED, never with what the retry says.
  SELECT * INTO committed FROM public.replay_reconciliation_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'REPLAY_POST_FINALIZATION_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.replay_id, committed.replay_version_id,
                        committed.distribution_package_version_id,
                        committed.committed_availability_state, committed.committed_eligibility_state,
                        committed.committed_at;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the Replay. The exact creator, and nobody
  -- else. A stranger, a Replay that does not exist and another human's Replay
  -- all reach ONE bounded class, so the refusal is never an existence oracle.
  SELECT r.* INTO replay FROM public.replays r WHERE r.id = p_replay_id FOR UPDATE;
  IF NOT FOUND OR replay.created_by_user_id <> u THEN
    RAISE EXCEPTION 'REPLAY_POST_FINALIZATION_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO committed FROM public.replay_reconciliation_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'REPLAY_POST_FINALIZATION_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.replay_id, committed.replay_version_id,
                        committed.distribution_package_version_id,
                        committed.committed_availability_state, committed.committed_eligibility_state,
                        committed.committed_at;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEP 2: the exact package of the exact Replay and
  -- Replay Version, then the version itself, and the historical finalization it
  -- must still carry.
  IF p_distribution_package_version_id IS NOT NULL THEN
    SELECT p.* INTO package FROM public.replay_distribution_package_versions p
     WHERE p.id = p_distribution_package_version_id
       AND p.replay_id = p_replay_id AND p.replay_version_id = p_replay_version_id
     FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'REPLAY_POST_FINALIZATION_NOT_AVAILABLE' USING ERRCODE='P0002';
    END IF;
  END IF;
  SELECT v.* INTO version FROM public.replay_versions v
   WHERE v.id = p_replay_version_id AND v.replay_id = p_replay_id FOR SHARE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.replay_version_finalizations f
                               WHERE f.replay_version_id = p_replay_version_id
                                 AND f.replay_id = p_replay_id) THEN
    RAISE EXCEPTION 'REPLAY_POST_FINALIZATION_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- ONE DATABASE-OWNED INSTANT for every row this command writes.
  instant := clock_timestamp();

  -- CANONICAL LOCK ORDER, STEP 3: the source, stabilized through the ONE
  -- canonical creator-scoped lock path and then READ through the ONE canonical
  -- currency chain. Nothing is dereferenced, reconstructed or regenerated.
  PERFORM public.replay_lock_source_manifest_v1(version.source_manifest_version_id);
  SELECT a.availability_state INTO availability
    FROM public.derive_replay_version_current_availability_v1(p_replay_id, p_replay_version_id) a;

  IF p_distribution_package_version_id IS NOT NULL THEN
    -- CANONICAL LOCK ORDER, STEP 4: the approval rows, in a deterministic order,
    -- so a reconciliation and a withdrawal can never take them in different ones.
    PERFORM 1 FROM public.replay_distribution_approvals a
      WHERE a.distribution_package_version_id = package.id ORDER BY a.approver_user_id FOR SHARE;

    -- CANONICAL LOCK ORDER, STEP 5: the destination subsystem, in ITS canonical
    -- relative order, FOR SHARE, and only when this package really has one.
    SELECT b.* INTO bridge FROM public.replay_public_distribution_artifacts b
     WHERE b.distribution_package_version_id = package.id;
    IF bridge.package_item_id IS NOT NULL THEN
      PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR SHARE;
      PERFORM 1 FROM public.public_experiences e WHERE e.id = bridge.public_experience_id FOR SHARE;
    END IF;

    SELECT e.eligibility_state, e.refusal_class INTO eligibility, refusal
      FROM public.derive_replay_distribution_current_eligibility_v1(package.id) e;
  END IF;

  -- CANONICAL LOCK ORDER, STEP 6: the append-only writes. The command id IS the
  -- evidence id in both relations, so ONE command can never produce two
  -- observations of the same kind even if a guard were lifted.
  BEGIN
    INSERT INTO public.replay_source_availability_reconciliation_events
      (id, replay_id, replay_version_id, source_manifest_version_id,
       observed_availability_state, observed_at)
    VALUES (p_command_id, p_replay_id, p_replay_version_id, version.source_manifest_version_id,
            availability, instant);

    IF p_distribution_package_version_id IS NOT NULL THEN
      INSERT INTO public.replay_distribution_reconciliation_events
        (id, replay_id, replay_version_id, distribution_package_version_id,
         observed_eligibility_state, observed_refusal_class, observed_at)
      VALUES (p_command_id, p_replay_id, p_replay_version_id, package.id,
              eligibility, refusal, instant);
    END IF;

    INSERT INTO public.replay_reconciliation_commands
      (id, replay_id, actor_user_id, replay_version_id, distribution_package_version_id,
       reconciliation_purpose, committed_availability_state, committed_eligibility_state,
       request_ref, committed_at)
    VALUES (p_command_id, p_replay_id, u, p_replay_version_id, p_distribution_package_version_id,
            purpose, availability, eligibility, request, instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'REPLAY_POST_FINALIZATION_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'REPLAY_POST_FINALIZATION_RECONCILED'::text, p_replay_id, p_replay_version_id,
                      p_distribution_package_version_id, availability, eligibility, instant;
END$$;

ALTER FUNCTION public.reconcile_replay_post_finalization_state_v1(uuid, uuid, uuid, uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 7. ACL AND RLS POSTURE.
--
--    Both relations are sealed from every application role. The eligibility
--    derivation and the reconciliation primitive are executable by NO role:
--    production Replay distribution remains fail-closed while the CW2-08 Launch
--    Gate is unimplemented, and test convenience is not launch authority. The
--    ONE creator read boundary is service_role-executable alone, the frozen
--    narrow-resolver precedent of 0095 / 0101 / 0103 / 0105 / 0106.
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.replay_distribution_reconciliation_events,
                    public.replay_reconciliation_commands
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.replay_distribution_reconciliation_events, public.replay_reconciliation_commands FROM service_role';
END IF;END$$;

DO $$
DECLARE
  internal text[] := ARRAY[
    'public.derive_replay_distribution_current_eligibility_v1(uuid)',
    'public.reconcile_replay_post_finalization_state_v1(uuid, uuid, uuid, uuid)'];
  boundary text := 'public.resolve_replay_distribution_current_state_v1(uuid, uuid)';
  fn text;
BEGIN
  FOREACH fn IN ARRAY internal LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', fn);
    END IF;
  END LOOP;
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', boundary);
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', boundary);
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 8. SELF-ASSERTIONS.
--
--     What must already be true of THIS migration for it to be allowed to
--     deploy. Each is a fact about the objects 0107 owns or the frozen truths it
--     consumes - never a census of the database, and never a ceiling on later
--     reviewed work: nothing here forbids a future media encoder, object store,
--     transport provider, delivery receipt, external-provider contract, Safety
--     runtime, entitlement runtime or Launch Gate from existing anywhere in this
--     repository. What is forbidden is forbidden ON THE RELATIONS AND FUNCTIONS
--     THIS MIGRATION OWNS.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  own_tables text[] := ARRAY['replay_distribution_reconciliation_events',
                             'replay_reconciliation_commands'];
  t text;
  needed text;
  body text;
  n integer;
BEGIN
  FOREACH t IN ARRAY own_tables LOOP
    -- A REPLAY IS NOT A WORLD, and reconciling one changes no ontology.
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname ~ '(world_type|phase|birth_basis|member|episode|governance|proposal|coordinate|embedding|vitality|ranking|lifecycle)'
    ) THEN
      RAISE EXCEPTION 'I-06D: a Replay is a source-bound artifact, never a World: relation % may carry no World membership governance or lifecycle column', t;
    END IF;
    -- NO SOURCE CONTENT AND NO PRIVATE PATH SURVIVES BY BEING COPIED HERE.
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       JOIN pg_type ty ON ty.oid = a.atttypid
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND (a.attname ~ '(^body|_body$|body_text|_text$|^text|transcript|audio|content|payload|blob|document|excerpt|snippet|statement|committed_text|source_text|url|uri|href|path|filename|object_key|bucket|storage|credential|secret|token|note|explanation|message|description)'
              OR ty.typname IN ('json', 'jsonb', 'bytea'))
    ) THEN
      RAISE EXCEPTION 'I-06D: relation % may carry no source content no private path no storage handle and no free-form explanation', t;
    END IF;
    -- NO DELIVERY, NO EXTERNAL COPY AND NO RECALL IS EVER RECORDED, because no
    -- transport boundary exists and CW2-05 guarantees no recall of copies that
    -- already left. A column of any of these shapes would be a claim this
    -- runtime cannot make.
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname ~ '(codec|container|bitrate|video_resolution|frame_rate|framerate|cdn|watermark|drm|encoder|mime|pixel|delivered|downloaded|sent_at|recipient|endpoint|address|email|phone|recalled|destroyed|revoked_on|remote_file|external_copy|social_post)'
    ) THEN
      RAISE EXCEPTION 'I-06D: relation % may record no delivery no external copy and no recall: QANDEEL cannot guarantee recall and does not pretend otherwise', t;
    END IF;
    -- NO PRIVATE SOURCE IDENTITY AND NO PRIVATE CAUSE IS MADE DURABLE.
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname ~ '(session|turn|conversation_unit|world_id|shared_|material|history_item|owner_user|approver|participant|captured_|provenance|staleness|digest|experience_id|public_manifest)'
    ) THEN
      RAISE EXCEPTION 'I-06D: relation % may carry no private source identity and no private cause', t;
    END IF;
    -- NO BODY RELATION, RAW TURN OR COMMITTED SOURCE UNIT IS EVER A PARENT.
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = ('public.' || t)::regclass AND c.contype = 'f'
         AND c.confrelid IN ('public.shared_world_text_material_bodies'::regclass,
                             'public.shared_world_voice_note_material_bodies'::regclass,
                             'public.public_experience_text_derivative_bodies'::regclass,
                             'public.conversation_turns'::regclass,
                             'public.conversation_units'::regclass)
    ) THEN
      RAISE EXCEPTION 'I-06D: relation % must bind no body relation, no raw turn and no committed source unit', t;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = ('public.' || t)::regclass AND c.contype = 'f' AND c.confdeltype <> 'r'
    ) THEN
      RAISE EXCEPTION 'I-06D: every I-06D foreign key is restrictive: relation % must never cascade truth away', t;
    END IF;
    IF length(t) > 63 OR EXISTS (SELECT 1 FROM pg_constraint c
                                  WHERE c.conrelid = ('public.' || t)::regclass AND length(c.conname) > 63)
       OR EXISTS (SELECT 1 FROM pg_class idx JOIN pg_index ix ON ix.indexrelid = idx.oid
                   WHERE ix.indrelid = ('public.' || t)::regclass AND length(idx.relname) > 63)
       OR EXISTS (SELECT 1 FROM pg_trigger tg
                   WHERE tg.tgrelid = ('public.' || t)::regclass AND NOT tg.tgisinternal
                     AND length(tg.tgname) > 63) THEN
      RAISE EXCEPTION 'I-06D: an identifier on % exceeds the PostgreSQL 63-byte limit', t;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger tg
       WHERE tg.tgrelid = ('public.' || t)::regclass AND NOT tg.tgisinternal
         AND tg.tgfoid = 'public.reject_replay_post_finalization_mutation_v1'::regproc
    ) THEN
      RAISE EXCEPTION 'I-06D: relation % must be append-only for every role including its owner', t;
    END IF;
    IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'I-06D: relation % must have row level security enabled', t;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'I-06D: relation % must carry zero policies', t;
    END IF;
    IF (SELECT c.relowner FROM pg_class c WHERE c.oid = ('public.' || t)::regclass)
       <> (SELECT r.oid FROM pg_roles r WHERE r.rolname = 'postgres') THEN
      RAISE EXCEPTION 'I-06D: relation % must be postgres-owned', t;
    END IF;
    FOREACH needed IN ARRAY ARRAY['public', 'anon', 'authenticated', 'service_role'] LOOP
      CONTINUE WHEN needed <> 'public' AND NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = needed);
      IF has_table_privilege(needed, ('public.' || t)::regclass, 'SELECT')
         OR has_table_privilege(needed, ('public.' || t)::regclass, 'INSERT')
         OR has_table_privilege(needed, ('public.' || t)::regclass, 'UPDATE')
         OR has_table_privilege(needed, ('public.' || t)::regclass, 'DELETE') THEN
        RAISE EXCEPTION 'I-06D: relation % must hold no privilege for %', t, needed;
      END IF;
    END LOOP;
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
    IF n <> 0 THEN
      RAISE EXCEPTION 'I-06D: 0107 installs persistence and derivations and writes no row: % holds %', t, n;
    END IF;
  END LOOP;

  -- RECONCILIATION EVIDENCE BINDS THE EXACT PACKAGE, ITS REPLAY AND ITS REPLAY
  -- VERSION AS ONE ROW, through the additive candidate key this migration added.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_distribution_reconciliation_events'::regclass
       AND c.conname = 'replay_distribution_reconciliation_events_target_fk'
       AND c.confrelid = 'public.replay_distribution_package_versions'::regclass
       AND cardinality(c.confkey) = 3
  ) THEN
    RAISE EXCEPTION 'I-06D: distribution reconciliation evidence must bind the exact package, its Replay and its Replay Version as ONE row';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_distribution_package_versions'::regclass
       AND c.conname = 'replay_distribution_package_versions_target_key' AND c.contype = 'u'
       AND cardinality(c.conkey) = 3
  ) THEN
    RAISE EXCEPTION 'I-06D: the additive candidate key this migration needed must exist and be composite';
  END IF;
  -- AND THE ADDITIVE KEY IS TRIVIALLY UNIQUE: it contains the primary key, so it
  -- constrains no row the primary key did not already constrain.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint u, pg_constraint p
     WHERE u.conrelid = 'public.replay_distribution_package_versions'::regclass
       AND u.conname = 'replay_distribution_package_versions_target_key'
       AND p.conrelid = u.conrelid AND p.contype = 'p'
       AND p.conkey <@ u.conkey
  ) THEN
    RAISE EXCEPTION 'I-06D: the additive candidate key must contain the primary key of the frozen relation it was added to';
  END IF;
  -- The frozen relation it was added to is otherwise untouched: still append-only.
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg
                  WHERE tg.tgrelid = 'public.replay_distribution_package_versions'::regclass
                    AND tg.tgname = 'replay_distribution_package_versions_immutable'
                    AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'I-06D: the frozen I-06C append-only guard on distribution packages must still be in place';
  END IF;

  -- THE COMMAND IS TYPED AND ITS SHAPE AGREES WITH ITS PURPOSE IN BOTH DIRECTIONS.
  FOREACH needed IN ARRAY ARRAY['replay_reconciliation_commands_purpose_check',
                                'replay_reconciliation_commands_shape_check',
                                'replay_reconciliation_commands_availability_check',
                                'replay_reconciliation_commands_eligibility_check',
                                'replay_reconciliation_commands_request_check'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                    WHERE c.conrelid = 'public.replay_reconciliation_commands'::regclass
                      AND c.conname = needed AND c.contype = 'c') THEN
      RAISE EXCEPTION 'I-06D: the typed reconciliation command must carry the constraint %', needed;
    END IF;
  END LOOP;
  -- The committed ANSWER lives on the command row, so an equivalent retry is
  -- answered from what was committed rather than recomputed at retry time.
  FOREACH needed IN ARRAY ARRAY['committed_availability_state', 'committed_eligibility_state'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_attribute a
                    WHERE a.attrelid = 'public.replay_reconciliation_commands'::regclass
                      AND a.attnum > 0 AND NOT a.attisdropped AND a.attname = needed) THEN
      RAISE EXCEPTION 'I-06D: the reconciliation command must record its exact committed answer: % is missing', needed;
    END IF;
  END LOOP;
  -- The actor is the exact Replay creator, structurally.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.replay_reconciliation_commands'::regclass
       AND c.conname = 'replay_reconciliation_commands_creator_fk'
       AND c.confrelid = 'public.replays'::regclass AND cardinality(c.confkey) = 2
  ) THEN
    RAISE EXCEPTION 'I-06D: the reconciliation actor must be the exact Replay creator, structurally';
  END IF;

  -- THE CURRENT ELIGIBILITY DERIVATION CONSUMES THE CANONICAL AUTHORITIES AND
  -- WRITES NO SECOND ONE. Read from the installed body: a derivation that
  -- stopped consulting any of these would look identical from outside.
  SELECT pr.prosrc INTO body FROM pg_proc pr
   WHERE pr.oid = 'public.derive_replay_distribution_current_eligibility_v1(uuid)'::regprocedure;
  IF body IS NULL THEN
    RAISE EXCEPTION 'I-06D: the current eligibility derivation must exist';
  END IF;
  FOREACH needed IN ARRAY ARRAY['derive_replay_version_current_availability_v1',
                                'derive_replay_distribution_authority_v1',
                                'derive_replay_distribution_effective_approvals_v1',
                                'derive_replay_export_descriptor_v1',
                                'resolve_replay_distribution_prerequisites_v1',
                                'resolve_public_visibility_state_v1',
                                'replay_version_finalizations'] LOOP
    IF body !~ needed THEN
      RAISE EXCEPTION 'I-06D: current delivery eligibility must re-evaluate through the canonical % rather than around it', needed;
    END IF;
  END LOOP;
  -- No parallel authority fingerprint, no second source currency, no second
  -- Public visibility rule, and no lifecycle of its own.
  IF body ~ 'replay_distribution_authority_fingerprint_v1|derive_replay_source_manifest_currency_v1|derive_public_continuing_eligibility_v1|current_lifecycle|public_experience_publication_state' THEN
    RAISE EXCEPTION 'I-06D: current eligibility composes the canonical derivations and computes no parallel fingerprint, source currency or Public visibility rule of its own';
  END IF;
  -- IT NEVER CLAIMS A DELIVERY THAT NO TRANSPORT PERFORMED, AND NEVER A RECALL
  -- THIS RUNTIME CANNOT GUARANTEE.
  --
  -- The fabricated claims are named EXACTLY rather than by bare substring. A ban
  -- on `SENT` would match `ABSENT_FROM_PUBLIC_WORLD`, which this derivation
  -- legitimately names when it documents which Public rule it defers to - and a
  -- self-assertion that refuses the migration's own truth is a defect in the
  -- assertion, not a finding about the runtime.
  IF body ~ 'EXTERNAL_COPY_RECALLED|REMOTE_FILE_DELETED|RECIPIENT_COPY_DESTROYED|DOWNLOAD_REVOKED_ON_DEVICE|SOCIAL_POST_REMOVED|DELIVERY_PERFORMED|DELIVERED_AT' THEN
    RAISE EXCEPTION 'I-06D: current eligibility answers whether a FUTURE distribution may proceed, never that one happened and never that an exported copy was recalled';
  END IF;
  -- AND IT IS TOTAL AND FAIL-CLOSED: the unresolved analytical seam is a bounded
  -- refusal here, never an error a caller could read as permission and never
  -- reinterpreted as an empty human requirement.
  IF body !~ 'AUTHORITY_UNRESOLVED' OR body !~ 'SQLSTATE ''55000''' THEN
    RAISE EXCEPTION 'I-06D: an unresolved authority seam must answer NOT_ELIGIBLE with a bounded class rather than propagate';
  END IF;
  IF body ~ 'RESOLVED_NO_HUMAN_REQUIREMENT' THEN
    RAISE EXCEPTION 'I-06D: unresolved authority is never reinterpreted as an empty human requirement';
  END IF;

  -- THE CREATOR BOUNDARY IS CREATOR-EXACT AND BOUNDED.
  SELECT pr.prosrc INTO body FROM pg_proc pr
   WHERE pr.oid = 'public.resolve_replay_distribution_current_state_v1(uuid, uuid)'::regprocedure;
  IF body IS NULL OR body !~ 'created_by_user_id = p_user_id'
     OR body !~ 'derive_replay_distribution_current_eligibility_v1' THEN
    RAISE EXCEPTION 'I-06D: the current distribution state boundary must be creator-exact and must consume the ONE eligibility derivation';
  END IF;
  -- The private I-06A staleness vocabulary and every private approval identity
  -- are absent from this boundary entirely. The internal refusal classes it
  -- COLLAPSES are necessarily named as inputs to that collapse, so they are not
  -- banned here; what is proven is that the collapse exists and that no private
  -- cause or identity reaches the mapping at all.
  IF body ~ 'SOURCE_UNAVAILABLE|SOURCE_ACCESS_LOST|SOURCE_VERSION_NOT_CURRENT|approver_user_id|linked_public_approval_id|withdrawal_events' THEN
    RAISE EXCEPTION 'I-06D: the creator boundary names no private source cause and no private approval identity';
  END IF;
  IF body !~ 'AUTHORITY_NO_LONGER_CURRENT'
     OR body !~ 'APPROVAL_NOT_EFFECTIVE' OR body !~ 'AUTHORITY_UNRESOLVED' THEN
    RAISE EXCEPTION 'I-06D: a missing, withdrawn, superseded or unresolved authority must collapse into ONE creator-facing class, so the creator learns that the authority moved and never which human moved it';
  END IF;

  -- THE RECONCILIATION PRIMITIVE IS CREATOR-SCOPED, LOCK-ORDERED AND WRITES ONLY
  -- APPEND-ONLY EVIDENCE.
  SELECT pr.prosrc INTO body FROM pg_proc pr
   WHERE pr.oid = 'public.reconcile_replay_post_finalization_state_v1(uuid, uuid, uuid, uuid)'::regprocedure;
  IF body IS NULL OR body !~ 'auth\.uid\(\)' THEN
    RAISE EXCEPTION 'I-06D: the reconciliation actor is derived from auth.uid() and is never a caller parameter';
  END IF;
  IF position('FROM public.replays r WHERE r.id = p_replay_id FOR UPDATE' in body) = 0 THEN
    RAISE EXCEPTION 'I-06D: reconciliation must take the Replay lock FIRST: no source or Public inversion is permitted';
  END IF;
  IF position('replay_lock_source_manifest_v1' in body) = 0
     OR position('replay_lock_source_manifest_v1' in body)
        < position('FROM public.replays r WHERE r.id = p_replay_id FOR UPDATE' in body) THEN
    RAISE EXCEPTION 'I-06D: the source is stabilized through the ONE canonical lock path, AFTER the Replay lock';
  END IF;
  IF position('public.public_world_state' in body) > 0
     AND position('public.public_world_state' in body)
         < position('replay_lock_source_manifest_v1' in body) THEN
    RAISE EXCEPTION 'I-06D: the Public destination subsystem is taken last, never before the Replay or the source';
  END IF;
  IF body ~ 'public_world_state w WHERE w\.singleton FOR UPDATE'
     OR body ~ 'public_experiences e WHERE e\.id = bridge\.public_experience_id FOR UPDATE' THEN
    RAISE EXCEPTION 'I-06D: reconciliation READS Public truth and never writes it: the Public rows are taken FOR SHARE';
  END IF;
  IF body ~ 'pg_advisory|LOCK TABLE|TRUNCATE' THEN
    RAISE EXCEPTION 'I-06D: reconciliation takes no advisory lock, no table lock and no process mutex';
  END IF;
  -- It mutates NO immutable truth, and it moves NO Public lifecycle.
  IF body ~ 'UPDATE public\.|DELETE FROM' THEN
    RAISE EXCEPTION 'I-06D: reconciliation appends evidence and mutates nothing: an immutable Replay Version is never repaired';
  END IF;
  FOREACH needed IN ARRAY ARRAY['remove_public_experience_from_public_world_v1',
                                'reconcile_public_experience_disappearance_v1',
                                'publish_public_experience_v1',
                                'withdraw_publication_approval_v1',
                                'ABSENT_FROM_PUBLIC_WORLD'] LOOP
    IF body ~ needed THEN
      RAISE EXCEPTION 'I-06D: reconciliation performs no Public lifecycle transition: private Replay source loss never invents Public withdrawal (%)', needed;
    END IF;
  END LOOP;
  -- And it inserts ONLY into the three relations this slice owns.
  FOR needed IN SELECT t.x[1] FROM regexp_matches(body, 'INSERT INTO public\.(\w+)', 'g') AS t(x) LOOP
    IF needed NOT IN ('replay_source_availability_reconciliation_events',
                      'replay_distribution_reconciliation_events',
                      'replay_reconciliation_commands') THEN
      RAISE EXCEPTION 'I-06D: reconciliation writes only its own append-only evidence: it may not insert into %', needed;
    END IF;
  END LOOP;

  -- NO HUMAN PRINCIPAL AND NO VERDICT IS EVER A TRUSTED PARAMETER.
  FOREACH needed IN ARRAY ARRAY['public.derive_replay_distribution_current_eligibility_v1(uuid)',
                                'public.resolve_replay_distribution_current_state_v1(uuid, uuid)',
                                'public.reconcile_replay_post_finalization_state_v1(uuid, uuid, uuid, uuid)'] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
       WHERE pr.oid = needed::regprocedure AND arg.mode = 'i'
         AND arg.name ~ '(actor|creator_user|owner_user|approver_user|currency|staleness|availability_state|authority_state|eligibility|public_visibility|reconciliation_reason|safety|moderation|entitlement|feature_state|launch|clearance)'
    ) THEN
      RAISE EXCEPTION 'I-06D: % accepts no caller-authored principal or verdict', needed;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc pr
       WHERE pr.oid = needed::regprocedure AND pr.prosecdef
         AND pr.proowner = (SELECT r.oid FROM pg_roles r WHERE r.rolname = 'postgres')
         AND pr.proconfig IS NOT NULL
         AND ('search_path=' = ANY(pr.proconfig) OR 'search_path=""' = ANY(pr.proconfig))
    ) THEN
      RAISE EXCEPTION 'I-06D: % must be a postgres-owned SECURITY DEFINER function with an empty search_path', needed;
    END IF;
  END LOOP;
  -- The two derivations are STABLE and take no lock; the primitive is VOLATILE
  -- and accepts no clock but one read of the database's own.
  FOREACH needed IN ARRAY ARRAY['public.derive_replay_distribution_current_eligibility_v1(uuid)',
                                'public.resolve_replay_distribution_current_state_v1(uuid, uuid)'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc pr WHERE pr.oid = needed::regprocedure AND pr.provolatile = 's') THEN
      RAISE EXCEPTION 'I-06D: % must be STABLE: current truth is a derivation, never a cached row', needed;
    END IF;
    SELECT pr.prosrc INTO body FROM pg_proc pr WHERE pr.oid = needed::regprocedure;
    IF body ~ 'INSERT INTO|UPDATE public\.|DELETE FROM|FOR UPDATE|FOR SHARE|pg_advisory' THEN
      RAISE EXCEPTION 'I-06D: % writes nothing and takes no lock; its caller stabilizes state under the canonical lock order', needed;
    END IF;
    -- AND IT READS NO RECONCILIATION EVIDENCE: a durable row may document a
    -- current answer and may never be one.
    IF body ~ 'replay_source_availability_reconciliation_events|replay_distribution_reconciliation_events|replay_reconciliation_commands' THEN
      RAISE EXCEPTION 'I-06D: % is the canonical current truth and never consults reconciliation evidence: convergence may document a result, never create one', needed;
    END IF;
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc pr
     WHERE pr.oid = 'public.reconcile_replay_post_finalization_state_v1(uuid, uuid, uuid, uuid)'::regprocedure
       AND pr.provolatile = 'v'
  ) THEN
    RAISE EXCEPTION 'I-06D: the reconciliation primitive must be VOLATILE';
  END IF;
  SELECT pr.prosrc INTO body FROM pg_proc pr
   WHERE pr.oid = 'public.reconcile_replay_post_finalization_state_v1(uuid, uuid, uuid, uuid)'::regprocedure;
  IF body ~ 'CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp' THEN
    RAISE EXCEPTION 'I-06D: reconciliation accepts no clock but ONE read of the database own';
  END IF;

  -- PRODUCTION REMAINS FAIL-CLOSED: no application role reaches the eligibility
  -- derivation or the reconciliation primitive, and the creator boundary is
  -- service_role-only.
  FOREACH needed IN ARRAY ARRAY['public', 'anon', 'authenticated', 'service_role'] LOOP
    CONTINUE WHEN needed <> 'public' AND NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = needed);
    IF has_function_privilege(needed, 'public.derive_replay_distribution_current_eligibility_v1(uuid)', 'EXECUTE')
       OR has_function_privilege(needed, 'public.reconcile_replay_post_finalization_state_v1(uuid, uuid, uuid, uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'I-06D: the eligibility derivation and the reconciliation primitive are executable by no application role: % holds EXECUTE', needed;
    END IF;
    IF needed <> 'service_role'
       AND has_function_privilege(needed, 'public.resolve_replay_distribution_current_state_v1(uuid, uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'I-06D: the creator distribution-state boundary is service_role-only: % holds EXECUTE', needed;
    END IF;
  END LOOP;

  -- THE FROZEN TRUTHS THIS SLICE CONSUMES ARE EXACTLY AS THEIR OWN MIGRATIONS
  -- LEFT THEM. 0107 replaced no predecessor function of any kind.
  IF (SELECT pr.prosrc FROM pg_proc pr
       WHERE pr.oid = 'public.resolve_public_visibility_state_v1(uuid)'::regprocedure)
     !~ 'derive_public_continuing_eligibility_v1' THEN
    RAISE EXCEPTION 'I-06D: the canonical Public visibility resolver must still rest on the frozen I-05C continuing-eligibility truth; I-06D writes no second Public visibility authority';
  END IF;
  IF (SELECT pr.prosrc FROM pg_proc pr
       WHERE pr.oid = 'public.resolve_public_visibility_state_v1(uuid)'::regprocedure)
     ~ 'replay_' THEN
    RAISE EXCEPTION 'I-06D: the canonical Public visibility resolver must never inspect private Replay source state: that would be both an invented cross-domain rule and a private-source oracle';
  END IF;
  IF (SELECT pr.prosrc FROM pg_proc pr
       WHERE pr.oid = 'public.resolve_replay_analytical_distribution_authority_v1(uuid)'::regprocedure)
     !~ 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT' THEN
    RAISE EXCEPTION 'I-06D: the frozen analytical subject-authority seam must still answer UNRESOLVED; I-06D resolves no protected-human authority';
  END IF;
  IF (SELECT pr.prosrc FROM pg_proc pr
       WHERE pr.oid = 'public.resolve_replay_distribution_prerequisites_v1(uuid, text)'::regprocedure)
     !~ 'NOT_EVALUATED' THEN
    RAISE EXCEPTION 'I-06D: the frozen CW2-08 prerequisite seam must still answer NOT_EVALUATED; I-06D manufactures no launch readiness';
  END IF;
  IF (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
       WHERE c.conrelid = 'public.replay_distribution_authorizations'::regclass
         AND c.conname = 'replay_distribution_authorizations_state_check')
     !~ 'AUTHORIZED_FOR_DELIVERY' THEN
    RAISE EXCEPTION 'I-06D: the frozen I-06C truth that authorization is not delivery must still be in place';
  END IF;
  -- And the 0106 substrate this migration builds on is present and unchanged.
  FOREACH needed IN ARRAY ARRAY['public.derive_replay_version_current_availability_v1(uuid, uuid)',
                                'public.resolve_replay_version_current_usability_v1(uuid, uuid, uuid)',
                                'public.reject_replay_post_finalization_mutation_v1()'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc pr WHERE pr.oid = needed::regprocedure) THEN
      RAISE EXCEPTION 'I-06D: the 0106 post-finalization substrate % must exist before 0107 deploys', needed;
    END IF;
  END LOOP;
END$$;

COMMIT;
