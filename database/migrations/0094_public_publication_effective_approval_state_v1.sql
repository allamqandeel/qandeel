-- I-05B - Public Publication Effective Approval State v1 (PART A).
--
-- Migration 0092 froze every human approval of a publication package as
-- IMMUTABLE HISTORICAL EVIDENCE: one row, bound by composite foreign key into the
-- exact derived rightsholder set of one exact manifest, carrying the authority
-- request fingerprint as derived at the moment of approval, append-only for every
-- role including the table owner. I-05A deliberately froze nothing AGAINST a
-- later effective-state object beside that evidence (its FIX-C contract), and
-- this migration is that object.
--
-- ===========================================================================
-- Historical evidence is not perpetual consent
-- ===========================================================================
--
-- The existence of an approval row proves that one exact human consented, at one
-- exact instant, to the future publication of one exact immutable package under
-- one exact authority fingerprint. It does NOT prove that the consent is still
-- effective now. Two things can end it without touching the row:
--
--   WITHDRAWN    the exact human who gave it took it back. That is an explicit,
--                durable, append-only act recorded here.
--   SUPERSEDED   the package it consented to is no longer the Experience's
--                current package: a later preparation produced a NEW manifest
--                and a NEW version, and the old approval binds the old manifest
--                by foreign key, so it can never float forward.
--
-- The effective state is therefore DERIVED, never asserted, from three immutable
-- facts and one append-only fact: the approval row, the manifest it binds, the
-- Experience's current version pointer, and the withdrawal events. Nothing here
-- can make an older approval effective for a newer manifest, because there is
-- no row that says "effective" to forge - only rows that can narrow.
--
-- ===========================================================================
-- Who may withdraw
-- ===========================================================================
--
-- Exactly the historical content rightsholder the approval represents, resolved
-- from auth.uid() and compared with the immutable `approver_user_id` of the
-- exact approval. Nothing here reads Shared membership, a controller row or a
-- Public Identity: current Shared membership is not rightsholder authority, a
-- controller is not a rightsholder, and a FORMER Shared member withdraws their
-- own consent exactly as they gave it - without regaining any Shared browsing,
-- because no primitive here reads a membership episode at all.
--
-- A withdrawal by anyone else fails with the SAME bounded class a nonexistent
-- approval gets, so the error surface reveals nothing about whether a guessed
-- approval identifier is real.
--
-- ===========================================================================
-- What this migration does NOT do
-- ===========================================================================
--
-- No publication, no PUBLISHED transition, no public visibility, no serving; no
-- semantic placement, discussion, Public QANDEEL, vitality or projection; no
-- mutation of any 0091 / 0092 / 0093 relation; no trigger on any frozen table;
-- no Launch Gate, Safety or entitlement decision. Migrations 0001-0093 are
-- untouched, and no application role may execute anything created here.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE DURABLE WITHDRAWAL COMMAND HISTORY.
--
--    One narrow relation, the frozen 0093 shape: the row is the idempotency key
--    AND the exact committed answer. `request_ref` binds the whole immutable
--    request so an equivalent retry and a different request under the same
--    command identity are distinguishable.
-- ---------------------------------------------------------------------------
CREATE TABLE public.publication_approval_withdrawal_commands (
    id uuid NOT NULL,
    approval_id uuid NOT NULL,
    manifest_version_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    request_ref text NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT publication_approval_withdrawal_commands_pk PRIMARY KEY (id),
    CONSTRAINT publication_approval_withdrawal_commands_request_check
        CHECK (request_ref ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT publication_approval_withdrawal_commands_approval_fk
        FOREIGN KEY (approval_id) REFERENCES public.publication_manifest_approvals (id) ON DELETE RESTRICT,
    -- The actor IS the approver of the exact approval, structurally: the pair
    -- must exist in the immutable approval evidence.
    CONSTRAINT publication_approval_withdrawal_commands_approver_fk
        FOREIGN KEY (manifest_version_id, actor_user_id)
        REFERENCES public.publication_manifest_approvals (manifest_version_id, approver_user_id)
        ON DELETE RESTRICT,
    CONSTRAINT publication_approval_withdrawal_commands_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

CREATE INDEX publication_approval_withdrawal_commands_approval_idx
    ON public.publication_approval_withdrawal_commands (approval_id);

-- ---------------------------------------------------------------------------
-- 2. THE APPEND-ONLY WITHDRAWAL EVENT.
--
--    One effective withdrawal per approval, forever: UNIQUE (approval_id) is
--    the rule, and the row is refused UPDATE and DELETE for every role. The
--    historical approval row is never touched - it stays exactly the evidence
--    it was, and this row says the consent it recorded is no longer effective.
-- ---------------------------------------------------------------------------
CREATE TABLE public.publication_approval_withdrawal_events (
    id uuid NOT NULL,
    approval_id uuid NOT NULL,
    manifest_version_id uuid NOT NULL,
    approver_user_id uuid NOT NULL,
    occurred_at timestamptz NOT NULL,
    CONSTRAINT publication_approval_withdrawal_events_pk PRIMARY KEY (id),
    CONSTRAINT publication_approval_withdrawal_events_approval_key UNIQUE (approval_id),
    CONSTRAINT publication_approval_withdrawal_events_approval_fk
        FOREIGN KEY (approval_id) REFERENCES public.publication_manifest_approvals (id) ON DELETE RESTRICT,
    CONSTRAINT publication_approval_withdrawal_events_approver_fk
        FOREIGN KEY (manifest_version_id, approver_user_id)
        REFERENCES public.publication_manifest_approvals (manifest_version_id, approver_user_id)
        ON DELETE RESTRICT
);

COMMENT ON TABLE public.publication_approval_withdrawal_events IS
  'The append-only withdrawal of one exact manifest-bound approval by the exact '
  'historical rightsholder who gave it. The 0092 approval row is never mutated: '
  'it remains immutable evidence, and this row says that evidence is no longer '
  'EFFECTIVE consent. One withdrawal per approval, for every role.';

CREATE FUNCTION public.reject_publication_approval_state_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'PUBLICATION_APPROVAL_STATE_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='A publication approval withdrawal is append-only: UPDATE and DELETE are refused for every role, including the table owner.';
END$$;

ALTER FUNCTION public.reject_publication_approval_state_mutation_v1() OWNER TO postgres;

CREATE TRIGGER publication_approval_withdrawal_events_immutable
    BEFORE UPDATE OR DELETE ON public.publication_approval_withdrawal_events
    FOR EACH ROW EXECUTE FUNCTION public.reject_publication_approval_state_mutation_v1();

-- ---------------------------------------------------------------------------
-- 3. THE ONE DERIVATION OF EFFECTIVE APPROVAL STATE.
--
--    Read-only, STABLE, and the only place the vocabulary EFFECTIVE / WITHDRAWN /
--    SUPERSEDED is decided. It answers for ONE exact approval, from current
--    state:
--
--      WITHDRAWN    a withdrawal event exists for this approval. A human act
--                   dominates every structural fact, so it is reported first.
--      SUPERSEDED   the approval's manifest is not the manifest of the
--                   Experience's CURRENT version - a later preparation replaced
--                   the package, or the pointer is absent, which fails closed.
--      EFFECTIVE    neither.
--
--    Zero rows for an approval that does not exist, and zero rows for a NULL
--    identifier: the manifest-level view below joins this derivation LATERALLY
--    over a LEFT JOIN, so a required approver who never approved reaches it
--    with NULL, and a derivation that raised there would turn "no approval was
--    ever given" into an error instead of the truthful MISSING. The derivation
--    is not an existence oracle, and its callers hold the canonical locks; it
--    takes none.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.derive_publication_approval_effective_state_v1(p_approval_id uuid)
RETURNS TABLE(approval_id uuid, approved_manifest_version_id uuid, approving_user_id uuid,
              effective_state text, bound_authority_fingerprint text, withdrawn_at timestamptz,
              superseding_experience_version_id uuid)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_approval_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT a.id, a.manifest_version_id, a.approver_user_id,
         CASE WHEN w.id IS NOT NULL THEN 'WITHDRAWN'
              WHEN cv.id IS NULL OR cv.package_manifest_version_id <> a.manifest_version_id THEN 'SUPERSEDED'
              ELSE 'EFFECTIVE' END::text,
         a.bound_authority_fingerprint,
         w.occurred_at,
         CASE WHEN w.id IS NULL AND cv.id IS NOT NULL AND cv.package_manifest_version_id <> a.manifest_version_id
              THEN cv.id ELSE NULL::uuid END
    FROM public.publication_manifest_approvals a
    JOIN public.publication_package_manifest_versions m ON m.id = a.manifest_version_id
    JOIN public.public_experiences e ON e.id = m.experience_id
    LEFT JOIN public.public_experience_versions cv
      ON cv.id = e.current_experience_version_id AND cv.experience_id = e.id
    LEFT JOIN public.publication_approval_withdrawal_events w ON w.approval_id = a.id
   WHERE a.id = p_approval_id;
END$$;

ALTER FUNCTION public.derive_publication_approval_effective_state_v1(uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 4. THE MANIFEST-LEVEL VIEW OF THE SAME DERIVATION.
--
--    One row per human the exact manifest REQUIRES (the derived rightsholder
--    set of 0092), carrying the effective state of that human's approval - or
--    MISSING when no approval row exists at all. This is what the publish
--    boundary of migration 0095 consumes: it never counts approval rows, it
--    reads effective states, and MISSING / WITHDRAWN / SUPERSEDED each refuse.
--    Zero rows for a manifest that does not exist or requires nobody.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.derive_publication_manifest_effective_approvals_v1(p_manifest_version_id uuid)
RETURNS TABLE(approving_user_id uuid, approval_id uuid, effective_state text,
              bound_authority_fingerprint text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_manifest_version_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
  SELECT ra.approver_user_id, a.id,
         coalesce(s.effective_state, 'MISSING')::text,
         s.bound_authority_fingerprint
    FROM public.publication_manifest_required_approvers ra
    LEFT JOIN public.publication_manifest_approvals a
      ON a.manifest_version_id = ra.manifest_version_id AND a.approver_user_id = ra.approver_user_id
    LEFT JOIN LATERAL public.derive_publication_approval_effective_state_v1(a.id) s ON a.id IS NOT NULL
   WHERE ra.manifest_version_id = p_manifest_version_id
   ORDER BY ra.approver_user_id;
END$$;

ALTER FUNCTION public.derive_publication_manifest_effective_approvals_v1(uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 5. WITHDRAW ONE EXACT APPROVAL.
--
--    The withdrawing human is exactly auth.uid() and must be the immutable
--    `approver_user_id` of the exact approval. There is no approver parameter,
--    no manifest parameter and no reason parameter. Nothing here reads Shared
--    membership, a controller row, a Public Identity or a lifecycle: withdrawing
--    consent is the rightsholder's own act, in every lifecycle, and its public
--    consequence after a publication is a question a later reviewed slice owns.
--
--    Lock order: the canonical Public prefix, exactly as the frozen approval
--    primitive takes it - the ONE Public World, then the exact Experience the
--    approval's manifest belongs to - so a withdrawal and a publication can
--    never interleave: whichever commits first is the truth the other sees.
--
--    A withdrawal already recorded answers ALREADY_WITHDRAWN and still records
--    the command that asked, so a repeated withdrawal by the same human is not
--    an error and is not a second event.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.withdraw_publication_approval_v1(p_command_id uuid, p_approval_id uuid)
RETURNS TABLE(outcome text, approval_id uuid, approved_manifest_version_id uuid,
              effective_state text, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.publication_approval_withdrawal_commands;
  approval public.publication_manifest_approvals;
  target_experience uuid;
  request text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_approval_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_PUBLIC_APPROVAL_WITHDRAWAL_COMMAND_V1' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'approval=' || lower(p_approval_id::text), 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock.
  SELECT * INTO committed FROM public.publication_approval_withdrawal_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.approval_id, committed.manifest_version_id,
                        (SELECT s.effective_state
                           FROM public.derive_publication_approval_effective_state_v1(committed.approval_id) s),
                        committed.committed_at;
    RETURN;
  END IF;

  -- THE EXACT APPROVAL, AND THE EXACT HUMAN WHO GAVE IT. Anyone else - and a
  -- caller naming an approval that does not exist - receives ONE bounded class,
  -- so the error never says whether a guessed identifier is real. The approval
  -- row is immutable, so reading it before the lock is safe.
  SELECT * INTO approval FROM public.publication_manifest_approvals a WHERE a.id = p_approval_id;
  IF NOT FOUND OR approval.approver_user_id <> u THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  SELECT m.experience_id INTO target_experience
    FROM public.publication_package_manifest_versions m WHERE m.id = approval.manifest_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- CANONICAL LOCK ORDER, STEPS 1 AND 2.
  PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;
  PERFORM 1 FROM public.public_experiences e WHERE e.id = target_experience FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO committed FROM public.publication_approval_withdrawal_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.approval_id, committed.manifest_version_id,
                        (SELECT s.effective_state
                           FROM public.derive_publication_approval_effective_state_v1(committed.approval_id) s),
                        committed.committed_at;
    RETURN;
  END IF;

  -- ONE DATABASE-OWNED INSTANT for every authoritative fact of this command.
  instant := clock_timestamp();

  IF EXISTS (SELECT 1 FROM public.publication_approval_withdrawal_events w WHERE w.approval_id = p_approval_id) THEN
    INSERT INTO public.publication_approval_withdrawal_commands
      (id, approval_id, manifest_version_id, actor_user_id, request_ref, committed_at)
    VALUES (p_command_id, p_approval_id, approval.manifest_version_id, u, request, instant);
    RETURN QUERY SELECT 'ALREADY_WITHDRAWN'::text, p_approval_id, approval.manifest_version_id,
                        'WITHDRAWN'::text, instant;
    RETURN;
  END IF;

  -- The event reuses the command identity, so a caller that reuses one uuid
  -- across two command families is refused with a bounded class.
  BEGIN
    INSERT INTO public.publication_approval_withdrawal_events
      (id, approval_id, manifest_version_id, approver_user_id, occurred_at)
    VALUES (p_command_id, p_approval_id, approval.manifest_version_id, u, instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;
  INSERT INTO public.publication_approval_withdrawal_commands
    (id, approval_id, manifest_version_id, actor_user_id, request_ref, committed_at)
  VALUES (p_command_id, p_approval_id, approval.manifest_version_id, u, request, instant);

  RETURN QUERY SELECT 'WITHDRAWN'::text, p_approval_id, approval.manifest_version_id,
                      'WITHDRAWN'::text, instant;
END$$;

-- ---------------------------------------------------------------------------
-- 6. SECURITY POSTURE.
--
--    Every function is postgres-owned, SECURITY DEFINER, search_path-pinned and
--    executable by NO application role. The two derivations are the INPUT of the
--    later publish boundary, not a surface; the withdrawal is a consequential
--    primitive behind the same unimplemented CW2-08 Launch Gate every I-05A
--    primitive waits for.
-- ---------------------------------------------------------------------------
ALTER TABLE public.publication_approval_withdrawal_commands OWNER TO postgres;
ALTER TABLE public.publication_approval_withdrawal_events OWNER TO postgres;
ALTER TABLE public.publication_approval_withdrawal_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_approval_withdrawal_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.publication_approval_withdrawal_commands,
                    public.publication_approval_withdrawal_events
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.publication_approval_withdrawal_commands, public.publication_approval_withdrawal_events FROM service_role';
END IF;END$$;

ALTER FUNCTION public.derive_publication_approval_effective_state_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.derive_publication_manifest_effective_approvals_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.withdraw_publication_approval_v1(uuid, uuid) OWNER TO postgres;

DO $$
DECLARE
  internal text[] := ARRAY[
    'public.reject_publication_approval_state_mutation_v1()',
    'public.derive_publication_approval_effective_state_v1(uuid)',
    'public.derive_publication_manifest_effective_approvals_v1(uuid)',
    'public.withdraw_publication_approval_v1(uuid, uuid)'];
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
-- 7. SELF-ASSERTIONS.
--
--     What must already be true of THIS migration for it to deploy. Each is a
--     fact about objects 0094 owns or consumes, never a census and never a
--     ceiling on a later slice.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  internal text[] := ARRAY[
    'public.derive_publication_approval_effective_state_v1(uuid)',
    'public.derive_publication_manifest_effective_approvals_v1(uuid)',
    'public.withdraw_publication_approval_v1(uuid, uuid)'];
  reading text[] := ARRAY[
    'public.derive_publication_approval_effective_state_v1(uuid)',
    'public.derive_publication_manifest_effective_approvals_v1(uuid)'];
  withdrawal text := 'public.withdraw_publication_approval_v1(uuid, uuid)';
  own_tables text[] := ARRAY['publication_approval_withdrawal_commands',
                             'publication_approval_withdrawal_events'];
  fn text;
  t text;
  role_name text;
  p record;
BEGIN
  -- EVERY FUNCTION IS POSTGRES-OWNED, SECURITY DEFINER, search_path PINNED, AND
  -- EXECUTABLE BY NO APPLICATION ROLE.
  FOREACH fn IN ARRAY internal LOOP
    SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc,
           pg_get_userbyid(pr.proowner) AS owner
      INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-05B: % must be owned by postgres', fn; END IF;
    IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-05B: % must be SECURITY DEFINER', fn; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'I-05B: % must pin an empty search_path', fn;
    END IF;
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-05B: PUBLIC must not execute % before the frozen CW2-08 Launch Gate exists', fn;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = role_name)
         AND has_function_privilege(role_name, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'I-05B: % must not execute % before the frozen CW2-08 Launch Gate exists', role_name, fn;
      END IF;
    END LOOP;
  END LOOP;

  -- THE DERIVATIONS ARE STABLE AND WRITE NOTHING; THE WITHDRAWAL IS VOLATILE.
  FOREACH fn IN ARRAY reading LOOP
    SELECT pr.provolatile, pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = fn::regprocedure;
    IF p.provolatile <> 's' THEN
      RAISE EXCEPTION 'I-05B: derivation % must be STABLE', fn;
    END IF;
    IF p.prosrc ~ 'INSERT INTO' OR p.prosrc ~ 'UPDATE public' OR p.prosrc ~ 'DELETE FROM' THEN
      RAISE EXCEPTION 'I-05B: derivation % must write nothing', fn;
    END IF;
  END LOOP;
  IF (SELECT pr.provolatile FROM pg_proc pr WHERE pr.oid = withdrawal::regprocedure) <> 'v' THEN
    RAISE EXCEPTION 'I-05B: consequential primitive % must be VOLATILE', withdrawal;
  END IF;

  -- THE EFFECTIVE STATE IS DERIVED FROM THE HUMAN ACT AND THE CURRENT PACKAGE,
  -- and the vocabulary is exactly the three states the publish boundary consumes.
  SELECT pr.prosrc INTO p FROM pg_proc pr
   WHERE pr.oid = 'public.derive_publication_approval_effective_state_v1(uuid)'::regprocedure;
  IF p.prosrc !~ 'WITHDRAWN' OR p.prosrc !~ 'SUPERSEDED' OR p.prosrc !~ 'EFFECTIVE' THEN
    RAISE EXCEPTION 'I-05B: the effective-state derivation must decide EFFECTIVE, WITHDRAWN and SUPERSEDED';
  END IF;
  IF p.prosrc !~ 'publication_approval_withdrawal_events' OR p.prosrc !~ 'current_experience_version_id' THEN
    RAISE EXCEPTION 'I-05B: the effective-state derivation must read the withdrawal events and the current version pointer';
  END IF;
  IF (SELECT pr.prosrc FROM pg_proc pr
       WHERE pr.oid = 'public.derive_publication_manifest_effective_approvals_v1(uuid)'::regprocedure)
     !~ 'MISSING' THEN
    RAISE EXCEPTION 'I-05B: the manifest-level derivation must report a required approval that was never given as MISSING';
  END IF;

  -- WITHDRAWAL AUTHORITY IS THE EXACT HISTORICAL RIGHTSHOLDER, from auth.uid(),
  -- compared with the immutable approver of the exact approval - never Shared
  -- membership, never a controller, never a parameter.
  SELECT pr.prosrc INTO p FROM pg_proc pr WHERE pr.oid = withdrawal::regprocedure;
  IF p.prosrc !~ 'auth\.uid\(\)' OR p.prosrc !~ 'approval\.approver_user_id <> u' THEN
    RAISE EXCEPTION 'I-05B: withdrawal must require the exact historical rightsholder the approval represents';
  END IF;
  IF p.prosrc ~ 'shared_world_membership_episodes' OR p.prosrc ~ 'public_experience_controllers'
     OR p.prosrc ~ 'shared_world_history_access_grants'
     OR p.prosrc ~ 'shared_world_standard_closed_view_entitlements' THEN
    RAISE EXCEPTION 'I-05B: withdrawal must read no Shared membership and no Experience control: current membership is not rightsholder authority';
  END IF;
  IF p.prosrc ~ '(INSERT INTO|UPDATE|DELETE FROM) public\.(publication_manifest_approvals|publication_manifest_required_approvers|public_experience_controllers|shared_world|conversation_|users)' THEN
    RAISE EXCEPTION 'I-05B: withdrawal must mutate no approval evidence, no control and no predecessor state';
  END IF;
  IF p.prosrc ~* 'CURRENT_TIMESTAMP|now\(\)|localtimestamp|transaction_timestamp|statement_timestamp' THEN
    RAISE EXCEPTION 'I-05B: % accepts no clock but one read of the database clock', withdrawal;
  END IF;
  IF p.prosrc ~* 'pg_advisory' OR p.prosrc ~* 'LOCK TABLE' OR p.prosrc ~* 'TRUNCATE' THEN
    RAISE EXCEPTION 'I-05B: % locks rows in the canonical order and truncates nothing', withdrawal;
  END IF;
  IF p.prosrc !~ 'FROM public\.public_world_state w WHERE w\.singleton FOR UPDATE' THEN
    RAISE EXCEPTION 'I-05B: withdrawal must take the canonical Public lock prefix so it serializes with publication';
  END IF;
  -- NO FUNCTION ACCEPTS AN AUTHORITY, APPROVER, AUDIENCE, VISIBILITY OR INSTANT
  -- PARAMETER. Declared INPUT names only (mode 'i'), never the result columns.
  FOREACH fn IN ARRAY internal LOOP
    IF EXISTS (
      SELECT 1 FROM pg_proc pr, unnest(pr.proargnames, pr.proargmodes) AS arg(name, mode)
       WHERE pr.oid = fn::regprocedure AND arg.mode = 'i'
         AND arg.name ~ '(approver|authority|rightsholder|owner|audience|viewer|visib|publish|lifecycle|instant|timestamp|effective|state|reason|fingerprint)'
    ) THEN
      RAISE EXCEPTION 'I-05B: % may not accept an authority audience visibility state or instant parameter', fn;
    END IF;
  END LOOP;

  -- THE FROZEN APPROVAL EVIDENCE STAYS IMMUTABLE, and the withdrawal is bound
  -- into it by composite foreign key so a withdrawal by a human the approval
  -- does not name is unrepresentable.
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg
                  WHERE tg.tgrelid = 'public.publication_manifest_approvals'::regclass
                    AND tg.tgname = 'publication_manifest_approvals_immutable' AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'I-05B: the frozen 0092 approval evidence must still be append-only';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.publication_approval_withdrawal_events'::regclass
       AND c.conname = 'publication_approval_withdrawal_events_approver_fk'
       AND c.confrelid = 'public.publication_manifest_approvals'::regclass
       AND c.confdeltype = 'r'
  ) THEN
    RAISE EXCEPTION 'I-05B: a withdrawal must bind the exact (manifest, approver) pair of the immutable approval evidence';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg
                  WHERE tg.tgrelid = 'public.publication_approval_withdrawal_events'::regclass
                    AND tg.tgname = 'publication_approval_withdrawal_events_immutable' AND NOT tg.tgisinternal) THEN
    RAISE EXCEPTION 'I-05B: a withdrawal event must be append-only for every role';
  END IF;
  -- WITHDRAWAL CREATES NO CONTROL AND NO CONSENT: no relation created here
  -- references Experience control, and none carries a decision column.
  FOREACH t IN ARRAY own_tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = ('public.' || t)::regclass AND c.contype = 'f'
         AND c.confrelid = 'public.public_experience_controllers'::regclass
    ) THEN
      RAISE EXCEPTION 'I-05B: relation % must not reach Experience control', t;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = ('public.' || t)::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname ~ '(safety|moderation|launch|entitlement|premium|feature_flag|allow|visib|semantic|placement|vitality|discussion|reply)'
    ) THEN
      RAISE EXCEPTION 'I-05B: relation % may carry no Safety Launch entitlement visibility or serving column', t;
    END IF;
  END LOOP;

  -- DENY BY DEFAULT ON EVERY RELATION THIS MIGRATION CREATED.
  FOREACH t IN ARRAY own_tables LOOP
    IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'I-05B: relation % must have row level security enabled', t;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'I-05B: relation % must carry zero policies', t;
    END IF;
    IF (SELECT c.relowner FROM pg_class c WHERE c.oid = ('public.' || t)::regclass)
       <> (SELECT r.oid FROM pg_roles r WHERE r.rolname = 'postgres') THEN
      RAISE EXCEPTION 'I-05B: relation % must be postgres-owned', t;
    END IF;
    FOREACH role_name IN ARRAY ARRAY['public', 'anon', 'authenticated', 'service_role'] LOOP
      CONTINUE WHEN role_name <> 'public'
                AND NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = role_name);
      IF has_table_privilege(role_name, ('public.' || t)::regclass, 'SELECT')
         OR has_table_privilege(role_name, ('public.' || t)::regclass, 'INSERT')
         OR has_table_privilege(role_name, ('public.' || t)::regclass, 'UPDATE')
         OR has_table_privilege(role_name, ('public.' || t)::regclass, 'DELETE') THEN
        RAISE EXCEPTION 'I-05B: relation % must hold no privilege for %', t, role_name;
      END IF;
    END LOOP;
  END LOOP;
END$$;

COMMIT;
