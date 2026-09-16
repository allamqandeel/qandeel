-- I-05C - Continuing Public Eligibility and Canonical Visibility Closure v1 (PART A).
--
-- I-05B decided publication from CURRENT state and then recorded it. What it
-- deliberately did NOT decide is whether an already-published exact package is
-- still legitimately public NOW: a withdrawal recorded after publication was
-- durable truth whose public consequence it left to I-05C, and so was a source
-- that later became canonically unavailable. This migration closes that gap, and
-- it closes it in the ONE place every Public surface already reads.
--
-- ===========================================================================
-- Why this migration creates no table at all
-- ===========================================================================
--
-- Privacy must fail closed IMMEDIATELY, through canonical truth, and must never
-- depend on a later write - not a projection rebuild, not a queue, not a cron,
-- not a lifecycle reconciliation pass. So PART A is pure derivation: after this
-- migration, and before any row anywhere is written, a withdrawn required
-- approval or an unavailable published source already makes
-- `resolve_public_visibility_state_v1` answer `NOT_PUBLICLY_VISIBLE`, and every
-- I-05B consumer - serving, semantic placement, discussion, Public QANDEEL,
-- vitality, search, lens, panel - goes dark together because every one of them
-- reads that ONE derivation rather than testing a lifecycle for itself.
--
-- The durable convergence that follows - the `ABSENT_FROM_PUBLIC_WORLD`
-- lifecycle, the sealed disappearance record, the projection cleanup - is
-- migration 0099. It is defense in depth and retention hygiene. It is NOT what
-- enforces privacy, and this migration is the proof: 0098 alone makes the
-- Experience dark, and 0099 cannot be the thing that made it dark because 0099
-- does not exist yet when 0098 deploys.
--
-- ===========================================================================
-- Continuing eligibility is a CONTINUATION of the frozen publication gates
-- ===========================================================================
--
-- `derive_public_continuing_eligibility_v1` invents no new rule. It re-asks, of
-- CURRENT state, exactly the questions migration 0095 asked before it allowed
-- the publication, over the exact immutable package the publication record
-- names:
--
--   1  the frozen I-05B publication binding: lifecycle `PUBLISHED`, an immutable
--      publication record, the recorded version is the Experience's CURRENT
--      version and its manifest is the recorded manifest (0095 gates 2-4);
--   2  every required approval currently `EFFECTIVE` through the ONE 0094
--      derivation, each still bound to the fingerprint the publication recorded
--      (0095 gate 9);
--   3  every included source still available at the exact captured revision with
--      resolved authority and non-contradictory metadata, through the ONE I-05A
--      derivation `derive_public_publication_authority_v1` (0095 gate 7);
--   4  the derived CONTENT_RIGHTSHOLDER_SET still equal to the stored one
--      (0095 gate 8).
--
-- ===========================================================================
-- Source AVAILABILITY is not actor source ACCESS
-- ===========================================================================
--
-- All four are properties of the PACKAGE. Not one of them reads an actor, and
-- that is the whole of the design: continuing eligibility is a property of the
-- EXPERIENCE, never of whoever happens to be reading it, and never of what some
-- particular human may still browse.
--
-- The frozen runtime does ask an actor question of a similar shape, and it is
-- important that this derivation is not it. Migration 0095 gate 6 is labelled
-- `CURRENT SOURCE ACCESS FOR THE PUBLISHING HUMAN`: at the consequential
-- instant of publication it asks whether `auth.uid()` - the human performing
-- the act - may still SEE each included Shared history item, through the
-- canonical I-04F entry point `resolve_shared_world_history_visibility_v1`.
-- That is an actor gate on an operation, and that is where it belongs.
--
-- It is NOT a continuing condition, and this migration deliberately declines to
-- make it one. A publisher who later leaves the Shared World, is removed from
-- it, or falls outside a closed-view entitlement loses BROWSING; the source
-- they published is untouched - still AVAILABLE, still at the captured
-- availability revision, still the exact bytes the package digested. Turning
-- one human's later loss of browsing into the disappearance of everyone else's
-- Public view would be new Product policy, and no frozen contract states it:
-- 0095 scopes that call to the publishing human at that instant, and nothing in
-- 0091-0097 re-asks it afterwards. Inferring a perpetual rule from a
-- publish-time gate is exactly the inference that is not available here.
--
-- What does belong here is source AVAILABILITY and INTEGRITY - and step 3 is
-- already precisely that truth, actor-free. `derive_public_publication
-- _authority_v1` refuses when an included Shared history item is no longer
-- AVAILABLE or its availability revision moved, when the Shared body is gone or
-- its bytes no longer match the captured digest, and when the Personal
-- committed unit is gone, is owned by someone other than the captured owner, or
-- no longer digests to the captured value (migration 0093). Owner deletion -
-- the canonical I-04G act that genuinely takes a source away - moves the item
-- to DELETED_BY_OWNER and bumps the revision, so it fails closed there, for the
-- reason that is actually true.
--
-- What it deliberately does NOT re-check is the CURRENT authority request
-- fingerprint against the published one. Every input of that fingerprint is
-- immutable for a published package - action, target, audience class, readiness,
-- Experience, version, ordinal, manifest, publisher, item count and source scope
-- all live on append-only rows - except two: the derived rightsholder set, which
-- step 4 compares exactly, and `authoritySnapshot`, the Public World envelope
-- version. Migration 0092 states what that version is for in as many words: a
-- later reviewed change to the Public World envelope stales an IN-FLIGHT package
-- instead of silently applying to it. Turning it into a retraction of every
-- already-published Experience would be a new Product policy, and inventing one
-- is not this slice's authority (AGENTS.md section 2). So the snapshot is
-- excluded, by name, and the two mutable inputs that ARE authority are each
-- compared exactly.
--
-- Controller authority is likewise NOT a continuing-eligibility condition, and
-- that is a finding rather than a preference. Nothing in migrations 0091-0097
-- can remove, transfer or revoke a controller row: `create_public_experience
-- _draft_v1` is the ONLY writer of `public_experience_controllers` in the whole
-- repository, and there is no counterpart. Controller loss therefore has no
-- canonical producer, the frozen contracts say only that control decides who may
-- ISSUE a control action (0091 section 6, and every consequential primitive
-- re-checks it at execution time), and I-05C does not invent a consequence for
-- an event the repository cannot produce. Control is not content consent
-- (CW2-04 D8), and this migration keeps them apart by never reading control.
--
-- ===========================================================================
-- Fail closed, and disclose nothing
-- ===========================================================================
--
-- The derivation answers `ELIGIBLE` or `INELIGIBLE` and nothing else, for any
-- non-null identifier - including one that names nothing, which is
-- `INELIGIBLE` / `NOT_PUBLISHED`, the same answer a DRAFT gets. It never raises
-- for a target it cannot find, so it is not an existence oracle.
--
-- The two frozen derivations it consumes DO raise: the I-05A authority
-- derivation raises on an unavailable source, an unresolved authority and
-- contradictory metadata, and the I-04F entry point raises on a World mode it
-- does not implement. A raise reaching a Public read boundary would turn "this
-- is dark" into a distinguishable error, so each call is wrapped and every
-- raise becomes an INELIGIBLE answer: the source class for `P0002`, which is
-- what the frozen derivation uses for an unavailable source, and the authority
-- class for anything else. Failing closed is the only safe direction.
--
-- `ineligibility_class` is a bounded INTERNAL vocabulary for audit and for the
-- 0099 convergence. It is never returned by `resolve_public_visibility_state_v1`
-- and never reaches a public surface: the canonical visibility answer stays
-- exactly two states, so nonexistent, DRAFT, READY_FOR_REVIEW, never-published,
-- absent, source-unavailable, consent-withdrawn and authority-invalidated all
-- remain ONE bounded non-serving class outwardly. No class names a source, a
-- World, a human, a revision or a digest.
--
-- ===========================================================================
-- What this migration does NOT do
-- ===========================================================================
--
-- It creates no table, no trigger, no index and no policy; it writes no row of
-- any kind; it moves no lifecycle and cannot write `ABSENT_FROM_PUBLIC_WORLD`;
-- it grants nothing to any application role; it deletes nothing; it invents no
-- Launch, Safety, commercial-entitlement, successor-publication, restoration or
-- controller-loss policy. It alters no predecessor table, adds no column to one
-- and installs no trigger on one. The ONE object it replaces is the canonical
-- visibility derivation, additively, through the repository's forward-migration
-- method - migrations 0091-0097 are byte-identical and none is edited.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE ONE CONTINUING PUBLIC ELIGIBILITY DERIVATION.
--
--    Read-only, STABLE, takes no lock: a caller that needs a stable answer
--    holds the Experience row, exactly as the frozen visibility derivation
--    documents. Taking a lock inside a STABLE read would hide the lock order
--    from the primitive that owns it.
--
--    It is a LOWER-LEVEL helper, never a second visibility authority: no
--    outward Public surface consumes it, and section 2 makes the canonical
--    visibility derivation the only thing that does.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.derive_public_continuing_eligibility_v1(p_experience_id uuid)
RETURNS TABLE(experience_id uuid, eligibility_state text, ineligibility_class text,
              eligible_experience_version_id uuid, eligible_manifest_version_id uuid,
              eligible_version_ordinal integer)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  bound_version uuid;
  bound_manifest uuid;
  bound_ordinal integer;
  bound_fingerprint text;
  derived_approvers uuid[];
  stored_approvers uuid[];
BEGIN
  IF p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- STEP 1: THE FROZEN I-05B PUBLICATION BINDING, unchanged. The Experience is
  -- PUBLISHED, an immutable publication record exists, the recorded version is
  -- the CURRENT version, and its manifest is the recorded manifest.
  SELECT s.published_experience_version_id, s.published_manifest_version_id, v.version_ordinal,
         s.authority_request_fingerprint
    INTO bound_version, bound_manifest, bound_ordinal, bound_fingerprint
    FROM public.public_experiences e
    JOIN public.public_experience_publication_state s ON s.experience_id = e.id
    JOIN public.public_experience_versions v
      ON v.id = s.published_experience_version_id AND v.experience_id = e.id
    JOIN public.publication_package_manifest_versions m
      ON m.id = v.package_manifest_version_id AND m.experience_id = e.id
   WHERE e.id = p_experience_id
     AND e.current_lifecycle = 'PUBLISHED'
     AND e.current_experience_version_id = s.published_experience_version_id
     AND s.published_manifest_version_id = v.package_manifest_version_id;
  IF NOT FOUND THEN
    -- A nonexistent identifier, a DRAFT, a READY_FOR_REVIEW and an Experience
    -- that migration 0099 later made absent are ONE answer. An Experience that
    -- still claims PUBLISHED while its binding does not hold is a contradictory
    -- state rather than a disappearance cause, and is named separately so the
    -- 0099 convergence can refuse to invent a reason for it.
    RETURN QUERY SELECT p_experience_id, 'INELIGIBLE'::text,
      CASE WHEN EXISTS (SELECT 1 FROM public.public_experiences ex
                         WHERE ex.id = p_experience_id AND ex.current_lifecycle = 'PUBLISHED')
           THEN 'PUBLICATION_BINDING_INVALID' ELSE 'NOT_PUBLISHED' END::text,
      NULL::uuid, NULL::uuid, NULL::integer;
    RETURN;
  END IF;

  -- STEP 2: EVERY REQUIRED APPROVAL IS STILL EFFECTIVE, through the ONE 0094
  -- derivation, and each still binds the fingerprint the publication recorded.
  -- MISSING, WITHDRAWN and SUPERSEDED each refuse. Historical approval rows are
  -- never counted: the existence of evidence is not perpetual consent.
  IF EXISTS (
    SELECT 1 FROM public.derive_publication_manifest_effective_approvals_v1(bound_manifest) ea
     WHERE ea.effective_state <> 'EFFECTIVE'
        OR ea.bound_authority_fingerprint IS DISTINCT FROM bound_fingerprint
  ) THEN
    RETURN QUERY SELECT p_experience_id, 'INELIGIBLE'::text, 'REQUIRED_APPROVAL_NOT_EFFECTIVE'::text,
      NULL::uuid, NULL::uuid, NULL::integer;
    RETURN;
  END IF;

  -- STEP 3: EVERY INCLUDED SOURCE IS STILL CANONICALLY AVAILABLE, through the
  -- ONE I-05A derivation. It raises rather than returning a partial answer, so
  -- the raise is what is consumed: P0002 is the frozen class for an unavailable
  -- source, and anything else - unresolved additional human authority,
  -- contradictory source metadata - is an authority invalidation. Neither
  -- escapes: a raise reaching a Public read boundary would be an oracle.
  BEGIN
    SELECT d.required_approvers INTO derived_approvers
      FROM public.derive_public_publication_authority_v1(bound_manifest) d;
  EXCEPTION
    WHEN SQLSTATE 'P0002' THEN
      RETURN QUERY SELECT p_experience_id, 'INELIGIBLE'::text, 'PUBLISHED_SOURCE_NOT_AVAILABLE'::text,
        NULL::uuid, NULL::uuid, NULL::integer;
      RETURN;
    WHEN OTHERS THEN
      RETURN QUERY SELECT p_experience_id, 'INELIGIBLE'::text, 'PUBLICATION_AUTHORITY_INVALIDATED'::text,
        NULL::uuid, NULL::uuid, NULL::integer;
      RETURN;
  END;

  -- STEP 4: THE DERIVED CONTENT RIGHTSHOLDER SET IS STILL THE STORED ONE. This
  -- is the mutable half of the authority fingerprint, compared exactly.
  SELECT coalesce(array_agg(ra.approver_user_id ORDER BY ra.approver_user_id), ARRAY[]::uuid[])
    INTO stored_approvers
    FROM public.publication_manifest_required_approvers ra
   WHERE ra.manifest_version_id = bound_manifest;
  IF stored_approvers IS DISTINCT FROM derived_approvers THEN
    RETURN QUERY SELECT p_experience_id, 'INELIGIBLE'::text, 'PUBLICATION_AUTHORITY_INVALIDATED'::text,
      NULL::uuid, NULL::uuid, NULL::integer;
    RETURN;
  END IF;

  -- AND THERE IS NO FIFTH GATE, ON PURPOSE. No actor appears anywhere above:
  -- not the viewer, not the controller, not the publisher. The question
  -- `may this human still SEE this Shared item?` is the frozen 0095 gate 6, it
  -- is asked of the human PERFORMING the act at the consequential instant of
  -- publication, and re-asking it here forever would convert a later loss of
  -- browsing into the disappearance of everyone else's Public view - a Product
  -- policy no frozen contract states. Source AVAILABILITY and INTEGRITY, which
  -- is the condition that genuinely belongs here, is step 3 in full: the ONE
  -- I-05A derivation binds the exact captured availability revision and the
  -- exact captured digest of every included Shared and Personal source.
  RETURN QUERY SELECT p_experience_id, 'ELIGIBLE'::text, NULL::text,
    bound_version, bound_manifest, bound_ordinal;
END$$;

ALTER FUNCTION public.derive_public_continuing_eligibility_v1(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.derive_public_continuing_eligibility_v1(uuid) IS
  'The ONE I-05C derivation of whether an already-published exact package is '
  'still legitimately public. It re-asks the frozen 0095 publication gates of '
  'CURRENT state and fails closed on every raise. Its bounded ineligibility '
  'class is INTERNAL: resolve_public_visibility_state_v1 never returns it, so '
  'every non-serving cause stays ONE outward class.';

-- ---------------------------------------------------------------------------
-- 2. THE CANONICAL VISIBILITY DERIVATION, EXTENDED ADDITIVELY.
--
--    `resolve_public_visibility_state_v1` remains the ONE Public visibility
--    truth and the ONE thing every outward surface consumes. Migration 0095 is
--    NOT edited: this is the repository's canonical forward method, a
--    CREATE OR REPLACE in a later migration with the identical signature and
--    the identical result columns, so every frozen consumer keeps compiling and
--    keeps reading the same two answers.
--
--    Every I-05B invariant survives, because the publication binding they
--    describe is step 1 of the derivation this now delegates to. What is added
--    is that `PUBLISHED` is necessary and no longer sufficient.
--
--    It still reads no viewing policy: the visibility of the OBJECT and the
--    admission of the VIEWER are different gates, composed by every serving
--    surface and decided by neither of them.
--
--    It depends on no projection. The dependency runs one way - vitality,
--    search, lens and panel read visibility, and visibility reads none of them
--    - so no cycle exists in which a projection's own write eligibility could
--    decide whether the projection is servable.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_public_visibility_state_v1(p_experience_id uuid)
RETURNS TABLE(experience_id uuid, visibility_state text, visible_experience_version_id uuid,
              visible_manifest_version_id uuid, visible_version_ordinal integer)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  found_version uuid;
  found_manifest uuid;
  found_ordinal integer;
BEGIN
  IF p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT ce.eligible_experience_version_id, ce.eligible_manifest_version_id, ce.eligible_version_ordinal
    INTO found_version, found_manifest, found_ordinal
    FROM public.derive_public_continuing_eligibility_v1(p_experience_id) ce
   WHERE ce.eligibility_state = 'ELIGIBLE';
  IF FOUND THEN
    RETURN QUERY SELECT p_experience_id, 'PUBLICLY_VISIBLE'::text, found_version, found_manifest, found_ordinal;
  ELSE
    RETURN QUERY SELECT p_experience_id, 'NOT_PUBLICLY_VISIBLE'::text, NULL::uuid, NULL::uuid, NULL::integer;
  END IF;
END$$;

ALTER FUNCTION public.resolve_public_visibility_state_v1(uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 3. SECURITY POSTURE.
--
--    Both derivations are internal: postgres-owned, SECURITY DEFINER, STABLE,
--    search_path-pinned and executable by NO application role. Replacing a
--    function preserves its ACL, but the revoke is re-stated rather than
--    assumed, for the reason every predecessor states one: an invariant nobody
--    verifies is an invariant nobody notices losing.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  internal text[] := ARRAY[
    'public.derive_public_continuing_eligibility_v1(uuid)',
    'public.resolve_public_visibility_state_v1(uuid)'];
  fn text;
BEGIN
  FOREACH fn IN ARRAY internal LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', fn);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 4. SELF-ASSERTIONS.
--
--     What must already be true of THIS migration for it to be allowed to
--     deploy. Each is a fact about the two objects 0098 owns or the frozen
--     truths it consumes - never a census of the database, and never a ceiling
--     on migration 0099 or on any later slice.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  eligibility text := 'public.derive_public_continuing_eligibility_v1(uuid)';
  visibility text := 'public.resolve_public_visibility_state_v1(uuid)';
  own text[] := ARRAY['public.derive_public_continuing_eligibility_v1(uuid)',
                      'public.resolve_public_visibility_state_v1(uuid)'];
  fn text;
  role_name text;
  needle text;
  p record;
BEGIN
  -- BOTH DERIVATIONS ARE POSTGRES-OWNED, SECURITY DEFINER, STABLE, PINNED,
  -- WRITE-FREE AND EXECUTABLE BY NO APPLICATION ROLE.
  FOREACH fn IN ARRAY own LOOP
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc,
           pg_get_userbyid(pr.proowner) AS owner
      INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-05C: % must be owned by postgres', fn; END IF;
    IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-05C: % must be SECURITY DEFINER', fn; END IF;
    IF p.provolatile <> 's' THEN RAISE EXCEPTION 'I-05C: derivation % must be STABLE', fn; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'I-05C: % must pin an empty search_path', fn;
    END IF;
    IF p.prosrc ~ 'INSERT INTO' OR p.prosrc ~ 'UPDATE public' OR p.prosrc ~ 'DELETE FROM' THEN
      RAISE EXCEPTION 'I-05C: derivation % must write nothing', fn;
    END IF;
    IF p.prosrc ~ 'ABSENT_FROM_PUBLIC_WORLD' THEN
      RAISE EXCEPTION 'I-05C: PART A owns no disappearance lifecycle: % may not name it', fn;
    END IF;
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-05C: PUBLIC must not execute % before the frozen CW2-08 Launch Gate exists', fn;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = role_name)
         AND has_function_privilege(role_name, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-05C: % must not execute % before the frozen CW2-08 Launch Gate exists', role_name, fn;
      END IF;
    END LOOP;
    -- NEITHER ACCEPTS AN AUTHORITY, APPROVER, AUDIENCE, VISIBILITY, ELIGIBILITY,
    -- CAUSE OR INSTANT PARAMETER. Declared INPUT names only (mode 'i'): for a
    -- RETURNS TABLE function `proargnames` also holds the result columns, and
    -- both of these RETURN an eligibility or visibility state they derived.
    IF EXISTS (
      SELECT 1 FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
       WHERE pr.oid = fn::regprocedure AND arg.mode = 'i'
         AND arg.name ~ '(approver|authority|rightsholder|owner|audience|viewer|visib|publish|lifecycle|instant|timestamp|clear|launch|safety|entitle|allow|effective|eligib|absent|cause|reason|basis|fingerprint)'
    ) THEN
      RAISE EXCEPTION 'I-05C: % may not accept an authority audience visibility eligibility or instant parameter', fn;
    END IF;
  END LOOP;

  -- THE ELIGIBILITY DERIVATION CONTINUES THE FROZEN PUBLICATION GATES, and
  -- consumes each canonical truth rather than re-deriving it.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = eligibility::regprocedure;
  IF p.prosrc !~ 'current_lifecycle = ''PUBLISHED'''
     OR p.prosrc !~ 'public_experience_publication_state'
     OR p.prosrc !~ 'current_experience_version_id = s\.published_experience_version_id'
     OR p.prosrc !~ 's\.published_manifest_version_id = v\.package_manifest_version_id' THEN
    RAISE EXCEPTION 'I-05C: continuing eligibility must keep the frozen I-05B publication binding intact';
  END IF;
  IF p.prosrc !~ 'derive_publication_manifest_effective_approvals_v1'
     OR p.prosrc !~ '<> ''EFFECTIVE''' THEN
    RAISE EXCEPTION 'I-05C: continuing eligibility must require every required approval to be currently EFFECTIVE through the ONE 0094 derivation';
  END IF;
  IF p.prosrc !~ 'derive_public_publication_authority_v1' THEN
    RAISE EXCEPTION 'I-05C: continuing eligibility must revalidate source availability and authority through the ONE I-05A derivation';
  END IF;
  IF p.prosrc !~ 'publication_manifest_required_approvers' THEN
    RAISE EXCEPTION 'I-05C: continuing eligibility must compare the derived rightsholder set with the stored one';
  END IF;
  -- SOURCE AVAILABILITY IS NOT ACTOR SOURCE ACCESS. The frozen 0095 gate 6 asks
  -- whether the PUBLISHING HUMAN may still see each included Shared item, at the
  -- consequential instant of publication. Continuing eligibility must not
  -- repurpose that actor gate as a perpetual public predicate: a human who later
  -- loses Shared browsing has not taken the published source away, and their
  -- browsing is not everyone else's Public view.
  IF p.prosrc ~ 'resolve_shared_world_history_visibility_v1' THEN
    RAISE EXCEPTION 'I-05C: continuing eligibility must not turn actor source ACCESS into a continuing public-visibility condition: source AVAILABILITY is the ONE I-05A derivation';
  END IF;
  -- SOURCE-ACCESS AUTHORITY IS CONSUMED, NEVER RE-IMPLEMENTED, and current
  -- Shared membership is never a proxy for a rightsholder or for source access.
  IF p.prosrc ~ 'shared_world_membership_episodes'
     OR p.prosrc ~ 'shared_world_history_access_grants'
     OR p.prosrc ~ 'shared_world_standard_closed_view_entitlements'
     OR p.prosrc ~ 'shared_world_history_package_manifest_items' THEN
    RAISE EXCEPTION 'I-05C: continuing eligibility must not re-implement Shared membership or history authorization: consume the canonical I-04F visibility entry point';
  END IF;
  -- CONTROL IS NOT CONSENT. Nothing in PART A reads Experience control, so
  -- controller loss can never be silently converted into content disappearance.
  IF p.prosrc ~ 'public_experience_controllers' THEN
    RAISE EXCEPTION 'I-05C: continuing eligibility must read no Experience control: control is not content consent';
  END IF;
  -- IT FAILS CLOSED ON EVERY RAISE OF THE TWO FROZEN DERIVATIONS IT CONSUMES.
  IF p.prosrc !~ 'EXCEPTION' OR p.prosrc !~ 'WHEN OTHERS THEN' THEN
    RAISE EXCEPTION 'I-05C: continuing eligibility must turn every raise of a consumed derivation into an INELIGIBLE answer rather than an error a caller can read';
  END IF;
  -- AND ITS BOUNDED INTERNAL VOCABULARY IS EXACTLY THE FIVE CLASSES 0099
  -- CONVERGES ON. No class names a source, a World, a human or a digest.
  FOREACH needle IN ARRAY ARRAY['NOT_PUBLISHED', 'PUBLICATION_BINDING_INVALID',
                                'REQUIRED_APPROVAL_NOT_EFFECTIVE', 'PUBLISHED_SOURCE_NOT_AVAILABLE',
                                'PUBLICATION_AUTHORITY_INVALIDATED'] LOOP
    IF p.prosrc !~ needle THEN
      RAISE EXCEPTION 'I-05C: the bounded internal ineligibility vocabulary must include %', needle;
    END IF;
  END LOOP;

  -- THE CANONICAL VISIBILITY DERIVATION IS STILL THE ONE SERVING TRUTH: it
  -- consumes continuing eligibility, answers exactly two states, leaks no
  -- internal cause, and reads no viewing policy.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = visibility::regprocedure;
  IF p.prosrc !~ 'derive_public_continuing_eligibility_v1'
     OR p.prosrc !~ 'eligibility_state = ''ELIGIBLE''' THEN
    RAISE EXCEPTION 'I-05C: the canonical visibility derivation must consume the ONE continuing-eligibility truth';
  END IF;
  IF p.prosrc !~ 'PUBLICLY_VISIBLE' OR p.prosrc !~ 'NOT_PUBLICLY_VISIBLE' THEN
    RAISE EXCEPTION 'I-05C: the canonical visibility derivation must fail closed to NOT_PUBLICLY_VISIBLE';
  END IF;
  IF (SELECT count(*) FROM regexp_matches(p.prosrc, 'RETURN QUERY', 'g')) <> 2 THEN
    RAISE EXCEPTION 'I-05C: the canonical visibility derivation must answer exactly two states, so every non-serving cause is ONE outward class';
  END IF;
  IF p.prosrc ~ 'ineligibility_class' THEN
    RAISE EXCEPTION 'I-05C: the canonical visibility derivation must never expose the internal ineligibility cause';
  END IF;
  IF p.prosrc ~ 'public_audience_policy_state' THEN
    RAISE EXCEPTION 'I-05C: object visibility and viewer admission are different gates';
  END IF;
  IF p.prosrc ~ 'public_experience_search_projection' OR p.prosrc ~ 'public_experience_vitality_state' THEN
    RAISE EXCEPTION 'I-05C: the canonical visibility derivation must not depend on a projection whose own write eligibility depends on it';
  END IF;
  -- Its declared result columns are exactly the frozen I-05B five, in order, so
  -- every frozen consumer keeps reading the same shape.
  IF (SELECT array_agg(arg.name ORDER BY arg.ord)
        FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) WITH ORDINALITY AS arg(name, mode, ord)
       WHERE pr.oid = visibility::regprocedure AND arg.mode = 't')
     IS DISTINCT FROM ARRAY['experience_id', 'visibility_state', 'visible_experience_version_id',
                            'visible_manifest_version_id', 'visible_version_ordinal'] THEN
    RAISE EXCEPTION 'I-05C: the canonical visibility derivation must keep the frozen I-05B result shape';
  END IF;

  -- THE FROZEN BOUNDARIES PART A CONSUMES MUST STILL BE INTACT. Continuing
  -- eligibility now rests entirely on the ONE I-05A derivation for source truth,
  -- so what that derivation actually binds is asserted here rather than assumed:
  -- the exact captured availability revision, and the exact captured digest of
  -- the Shared body and of the Personal committed unit.
  SELECT pr.prosrc INTO p FROM pg_proc pr
   WHERE pr.oid = 'public.derive_public_publication_authority_v1(uuid)'::regprocedure;
  IF p.prosrc !~ 'availability_state <> ''AVAILABLE'''
     OR p.prosrc !~ 'availability_revision <> p\.captured_availability_revision'
     OR p.prosrc !~ 'captured_source_digest' THEN
    RAISE EXCEPTION 'I-05C: the ONE I-05A authority derivation must still bind the exact captured source availability revision and digest';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg
                  WHERE tg.tgrelid = 'public.publication_manifest_approvals'::regclass
                    AND tg.tgname = 'publication_manifest_approvals_immutable' AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'I-05C: the frozen 0092 approval evidence must still be append-only';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg
                  WHERE tg.tgrelid = 'public.public_experience_publication_state'::regclass
                    AND tg.tgname = 'public_experience_publication_state_immutable' AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'I-05C: the frozen 0095 publication record must still be append-only';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg
                  WHERE tg.tgrelid = 'public.publication_approval_withdrawal_events'::regclass
                    AND tg.tgname = 'publication_approval_withdrawal_events_immutable' AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'I-05C: the frozen 0094 withdrawal evidence must still be append-only';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg
                  WHERE tg.tgrelid = 'public.conversation_units'::regclass
                    AND tg.tgname = 'conversation_units_immutable' AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'I-05C: the frozen committed Personal source must still be append-only';
  END IF;
  -- THE FROZEN CW2-08 PREREQUISITE IS STILL FAIL-CLOSED AND UNRESOLVED. I-05C
  -- manufactures no launch readiness.
  IF (SELECT pr.prosrc FROM pg_proc pr
       WHERE pr.oid = 'public.resolve_public_publication_prerequisites_v1(uuid, uuid)'::regprocedure)
     !~ 'NOT_EVALUATED' THEN
    RAISE EXCEPTION 'I-05C: the CW2-08 prerequisite seam must still answer NOT_EVALUATED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.public_audience_policy_state ps
                  WHERE ps.singleton AND ps.signed_out_viewing_policy = 'UNRESOLVED') THEN
    RAISE EXCEPTION 'I-05C: the frozen CW2-08 signed-out viewing requirement must remain UNRESOLVED';
  END IF;
END$$;

COMMIT;
