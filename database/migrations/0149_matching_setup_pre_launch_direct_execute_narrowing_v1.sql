-- SEC-MATCH-00 - Matching setup pre-launch direct-execute narrowing v1.
--
-- Privileges only. No function body, signature, owner, table, column, policy, row-level-security setting or Matching
-- semantic changes here, and no historical migration is edited. This is the controlled forward amendment to the frozen
-- I-07A direct-execute surface of migration 0109 that the Product Owner approved as APPROVE_C2_PATCH_B (2026-10-09).
--
-- THE EXPOSURE. 0109 granted all eleven Matching setup boundaries to `authenticated`. Matching is not launched - Stage 6
-- has not started and the CW2-08 launch gates are closed - yet any signed-in account could call four of them directly
-- through the Data API with no Matching history at all and COMMIT a footprint: activate_matching_participation_v1,
-- grant_matching_context_v1, set_introduction_profile_v1 and set_matching_requirements_v1 each write the caller's
-- matching_setup_locks row (0108, ON DELETE RESTRICT to public.users) and their own family. Every 0108 relation refuses
-- DELETE, so once a footprint commits the governed Personal erasure (0130) truthfully answers BLOCKED for that account
-- and no governed path removes it (QAN-BL-ACCT-01). resume_matching_participation_v1 and
-- grant_pre_match_disclosure_authority_v1 cannot create a first footprint, but they widen Matching state an unlaunched
-- product must not widen.
--
-- THE NARROWING. EXECUTE is withdrawn from every application role on exactly these six boundaries:
--
--   activate_matching_participation_v1(uuid, text, uuid)
--   resume_matching_participation_v1(uuid, uuid)
--   grant_matching_context_v1(uuid, uuid, uuid)
--   set_introduction_profile_v1(uuid, text[], text[], uuid)
--   set_matching_requirements_v1(uuid, text[], text[], text[], uuid)
--   grant_pre_match_disclosure_authority_v1(uuid, uuid, uuid, text[], uuid)
--
-- PUBLIC, anon and authenticated are revoked by name, service_role wherever the role exists, and then every remaining
-- grantee other than the owner. 0109 already withheld PUBLIC, anon and service_role; restating it means the outcome does
-- not depend on what a hosted project's default privileges granted when the functions were created, or on a role a
-- client role inherits from. The terminal assertions judge EFFECTIVE privilege, inheritance included.
--
-- WHAT STAYS. The five operations that only ever reduce or read a human's own Matching state keep exactly the 0109
-- grant - `authenticated` only, the human from auth.uid() - and this migration does not touch them:
--
--   pause_matching_participation_v1(uuid, uuid)                   pause
--   turn_off_matching_participation_v1(uuid, uuid)                turn participation off
--   revoke_matching_context_v1(uuid, uuid)                        revoke the Matching Context Grant
--   revoke_pre_match_disclosure_authority_v1(uuid, uuid)          revoke the Pre-Match Disclosure Authority
--   get_my_matching_setup_v1()                                    inspect one's own setup
--
-- None of them can commit anything for a human with no Matching history: each command names an exact existing state,
-- and anything else is refused and rolled back with its lock-row insert; the projection writes nothing.
--
-- WHAT IS SUSPENDED (Product Owner decision). Resume, and any correction of an Introduction Profile or a requirement set,
-- are the same functions as first creation, so they are suspended with them until a reviewed Stage 6 launch path exists
-- (QAN-BL-MATCH-01, owner S6-01). No correction or enrollment wrapper is introduced here. A replay of an already
-- committed command of the six now answers 42501 instead of its committed result.
--
-- WHAT THIS IS NOT. Not account erasure: no Matching row is touched and QAN-BL-ACCT-01 stays OPEN. Not a launch gate:
-- nothing becomes executable. Not a semantic change: every body, lock order, idempotency and stale-state rule 0109 froze
-- is byte-identical, and the I-07B..I-07D cores stay executable by no application role.
--
-- DEPLOYMENT. Never expose 0108 / 0109 to live signed-in users without this migration taking effect in the same
-- controlled deployment window, and keep the Data API closed to signed-in use until the effective privileges below are
-- verified. A call that passed its EXECUTE check before this commits can still finish; that is why the window is closed.
BEGIN;

REVOKE ALL ON FUNCTION
  public.activate_matching_participation_v1(uuid, text, uuid),
  public.resume_matching_participation_v1(uuid, uuid),
  public.grant_matching_context_v1(uuid, uuid, uuid),
  public.set_introduction_profile_v1(uuid, text[], text[], uuid),
  public.set_matching_requirements_v1(uuid, text[], text[], text[], uuid),
  public.grant_pre_match_disclosure_authority_v1(uuid, uuid, uuid, text[], uuid)
  FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  boundary regprocedure;
  grantee_name text;
BEGIN
  FOREACH boundary IN ARRAY ARRAY[
    'public.activate_matching_participation_v1(uuid,text,uuid)',
    'public.resume_matching_participation_v1(uuid,uuid)',
    'public.grant_matching_context_v1(uuid,uuid,uuid)',
    'public.set_introduction_profile_v1(uuid,text[],text[],uuid)',
    'public.set_matching_requirements_v1(uuid,text[],text[],text[],uuid)',
    'public.grant_pre_match_disclosure_authority_v1(uuid,uuid,uuid,text[],uuid)']::regprocedure[] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', boundary);
    END IF;
    -- Any other grantee a hosted project may carry: nobody but the owner keeps an entry.
    FOR grantee_name IN
      SELECT DISTINCT r.rolname
        FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a JOIN pg_roles r ON r.oid = a.grantee
       WHERE p.oid = boundary AND a.grantee <> p.proowner
    LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', boundary, grantee_name);
    END LOOP;
  END LOOP;
END$$;

-- TERMINAL SELF-ASSERTIONS. The migration refuses to commit a posture in which any application role can still execute
-- one of the six, in which one of the five lost or widened its grant, or in which any other function an application
-- role can execute writes Matching setup state.
DO $$
DECLARE
  suspended text[] := ARRAY[
    'public.activate_matching_participation_v1(uuid,text,uuid)',
    'public.resume_matching_participation_v1(uuid,uuid)',
    'public.grant_matching_context_v1(uuid,uuid,uuid)',
    'public.set_introduction_profile_v1(uuid,text[],text[],uuid)',
    'public.set_matching_requirements_v1(uuid,text[],text[],text[],uuid)',
    'public.grant_pre_match_disclosure_authority_v1(uuid,uuid,uuid,text[],uuid)'];
  retained text[] := ARRAY[
    'public.pause_matching_participation_v1(uuid,uuid)',
    'public.turn_off_matching_participation_v1(uuid,uuid)',
    'public.revoke_matching_context_v1(uuid,uuid)',
    'public.revoke_pre_match_disclosure_authority_v1(uuid,uuid)',
    'public.get_my_matching_setup_v1()'];
  application_roles text[] := ARRAY['anon', 'authenticated', 'service_role'];
  fn text;
  target_role text;
  stray text;
BEGIN
  FOREACH fn IN ARRAY suspended LOOP
    IF pg_get_userbyid((SELECT p.proowner FROM pg_proc p WHERE p.oid = fn::regprocedure)) <> 'postgres' THEN
      RAISE EXCEPTION 'SEC-MATCH-00: % must stay postgres-owned', fn;
    END IF;
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'SEC-MATCH-00: PUBLIC must not execute %', fn;
    END IF;
    FOREACH target_role IN ARRAY application_roles LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
         AND has_function_privilege(target_role, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'SEC-MATCH-00: % must not execute % before a reviewed Stage 6 launch path exists', target_role, fn;
      END IF;
    END LOOP;
    SELECT string_agg(DISTINCT CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END, ', ')
      INTO stray
      FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
     WHERE p.oid = fn::regprocedure AND a.grantee <> p.proowner;
    IF stray IS NOT NULL THEN
      RAISE EXCEPTION 'SEC-MATCH-00: % is still granted to %', fn, stray;
    END IF;
  END LOOP;

  FOREACH fn IN ARRAY retained LOOP
    IF NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'SEC-MATCH-00: authenticated must keep %: a human never loses their own pause, opt-out, revocation or self-inspection', fn;
    END IF;
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'SEC-MATCH-00: PUBLIC must not execute %', fn;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
         AND has_function_privilege(target_role, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'SEC-MATCH-00: % must not execute % - no system credential acts for a human', target_role, fn;
      END IF;
    END LOOP;
  END LOOP;

  -- NO OTHER WRITER. Apart from the four retained commands, no function an application role can execute may write any
  -- of the fourteen 0108 relations. (The verifier also follows calls transitively.)
  SELECT string_agg(p.oid::regprocedure::text, ', ' ORDER BY p.oid::regprocedure::text) INTO stray
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
     AND p.prokind IN ('f', 'p')
     AND p.oid NOT IN (SELECT kept::regprocedure FROM unnest(retained) AS kept)
     AND p.prosrc ~* '(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.(matching_setup_locks|matching_participation_events|matching_participation_state|matching_context_grants|matching_context_consent_events|introduction_profile_versions|introduction_profile_field_values|introduction_profile_state|matching_requirement_versions|matching_requirement_items|matching_requirement_state|pre_match_disclosure_authorities|pre_match_disclosure_authority_fields|pre_match_disclosure_authority_events)\M'
     AND (has_function_privilege('public', p.oid, 'EXECUTE')
          OR EXISTS (SELECT 1 FROM unnest(application_roles) AS ar(rolename)
                      WHERE EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = ar.rolename)
                        AND has_function_privilege(ar.rolename, p.oid, 'EXECUTE')));
  IF stray IS NOT NULL THEN
    RAISE EXCEPTION 'SEC-MATCH-00: an application role can still write Matching setup state through %', stray;
  END IF;
END$$;

COMMIT;
