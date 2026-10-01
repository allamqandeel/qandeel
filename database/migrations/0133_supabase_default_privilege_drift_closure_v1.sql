-- PROD-SEC-01 (SEC-E) - Supabase default-privilege drift closure v1 (QAN-BL-PROD-02's direct Data API / RPC row).
--
-- Privileges only. No function body, table, column, policy, row-level-security setting or Product behaviour changes
-- here, and no historical migration is edited.
--
-- THE DRIFT. CI bootstraps a plain PostgreSQL (database/supabase-compatible-bootstrap.sql) in which a new object is
-- granted to nobody but PUBLIC. A hosted Supabase project is different: its `public` schema carries default privileges
-- that grant every NEW function, table and sequence created there to `anon`, `authenticated` and `service_role`. A
-- migration that only says `REVOKE ALL ... FROM PUBLIC` is therefore correct in CI and wrong in production: the named
-- client roles keep the grant the default gave them. W2-01 recorded this for `login_id_is_available_v1`; PROD-SEC-01's
-- census looked for every equivalent.
--
-- THE CENSUS (database/verify-migration-0133.mjs). The verifier rebuilds a scratch database with Supabase's real
-- `public` default privileges, replays every migration, and compares each object's effective anon / authenticated
-- privileges against the plain CI database, whose ACL is exactly what the migrations explicitly grant. Every migration
-- 0001-0132 applied unchanged under those defaults. The census found exactly these, and nothing else:
--
--   A. Functions a client role can execute on a hosted project although no migration granted it:
--        login_id_is_available_v1(text)              anon + authenticated; server-only by design (W1B-01 / W2-01):
--                                                     the API asks it with the service role and answers the reader a
--                                                     bounded boolean behind its own rate limit. Direct, it is an
--                                                     unthrottled Login ID oracle.
--        read_account_first_use_v1()                 anon; the owner RPC is granted to authenticated only.
--        complete_first_use_welcome_v1()             anon; the owner RPC is granted to authenticated only.
--        handle_new_auth_user()                      anon + authenticated; a trigger function (SECURITY DEFINER).
--        provision_qandeel_account_identity_v1()     anon + authenticated; a trigger function (SECURITY DEFINER).
--   B. Trigger functions in `public` that never revoked PostgreSQL's own PUBLIC EXECUTE, in CI and on a hosted project
--      alike. A trigger function cannot be called outside a trigger, and EXECUTE is checked only when a trigger is
--      created, never when it fires - so this revoke changes no behaviour; it leaves no client-executable trigger.
--   C. One sequence: conversation_turn_work_grants_id_seq (0131). Its table is revoked from every application role and
--      written only by a SECURITY DEFINER function owned by postgres; the sequence kept the hosted default grant.
--
-- WHAT IS NOT CHANGED. Every owner-facing RPC that a migration explicitly grants to `authenticated` keeps exactly that
-- grant; `qandeel_keepalive()` keeps its deliberate `anon` grant; service-role grants are untouched (B removes only the
-- PUBLIC route to trigger functions nobody calls). No broad "revoke everything in public" is performed.
--
-- PREVENTION. The default privileges of the migration role in `public` stop granting new functions, tables and
-- sequences to `anon` and `authenticated`, so a hosted project behaves like the CI database every migration is proven
-- against: a new object is reachable by a client role only where a migration says so. Default privileges belong to the
-- role that CREATES an object, and that is the role running migrations - the one these statements and the assertion
-- below address. On the CI database, which has no such default, these statements change nothing.
BEGIN;

-- A. ---------------------------------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.login_id_is_available_v1(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.login_id_is_available_v1(text) TO service_role;

REVOKE ALL ON FUNCTION public.read_account_first_use_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.read_account_first_use_v1() TO authenticated;

REVOKE ALL ON FUNCTION public.complete_first_use_welcome_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_first_use_welcome_v1() TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.provision_qandeel_account_identity_v1() FROM PUBLIC, anon, authenticated;

-- B. ---------------------------------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION
  public.guard_him_assessed_snapshot(),
  public.guard_him_canonical_binding_mutation(),
  public.introduction_success_approval_pointer_truth_v1(),
  public.introduction_terminal_commit_truth_v1(),
  public.public_disappearance_command_answer_required_v1(),
  public.public_identity_command_answer_required_v1(),
  public.reject_introduction_disclosure_mutation_v1(),
  public.reject_introduction_payload_rewrite_v1(),
  public.reject_introduction_terminal_mutation_v1(),
  public.reject_matching_reactivation_mutation_v1(),
  public.reject_public_command_history_mutation_v1(),
  public.release_formal_question_reservations_v1(),
  public.shared_world_material_historical_widening_gate_v1(),
  public.validate_him_canonical_binding()
FROM PUBLIC, anon, authenticated;

-- C. ---------------------------------------------------------------------------------------------------------------
REVOKE ALL ON SEQUENCE public.conversation_turn_work_grants_id_seq FROM PUBLIC, anon, authenticated, service_role;

-- PREVENTION -------------------------------------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- Deploy-time self-assertion: the closure holds on THIS database, whatever its defaults were.
DO $$
DECLARE
  v_signature text;
BEGIN
  IF has_function_privilege('anon', 'public.login_id_is_available_v1(text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.login_id_is_available_v1(text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.login_id_is_available_v1(text)', 'EXECUTE') THEN
    RAISE EXCEPTION '0133: login_id_is_available_v1 must be executable by service_role only';
  END IF;

  FOREACH v_signature IN ARRAY ARRAY['public.read_account_first_use_v1()', 'public.complete_first_use_welcome_v1()'] LOOP
    IF has_function_privilege('anon', v_signature, 'EXECUTE') OR NOT has_function_privilege('authenticated', v_signature, 'EXECUTE') THEN
      RAISE EXCEPTION '0133: % must be executable by authenticated and not by anon', v_signature;
    END IF;
  END LOOP;

  -- No trigger function in public is executable by a client role.
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prorettype = 'trigger'::regtype
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')
      AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  ) THEN
    RAISE EXCEPTION '0133: a public trigger function is still executable by a client role';
  END IF;

  -- Prevention took effect for the role that runs migrations (and so owns what they create): neither its public nor its
  -- global default privileges grant anything to a client role. A run under another role is checked for THAT role.
  IF EXISTS (
    SELECT 1
    FROM pg_default_acl d
    LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
    CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    WHERE d.defaclrole = current_user::text::regrole
      AND (d.defaclnamespace = 0 OR n.nspname = 'public')
      AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole)
  ) THEN
    RAISE EXCEPTION '0133: the migration role''s default privileges still grant new objects to a client role';
  END IF;

  IF has_sequence_privilege('anon', 'public.conversation_turn_work_grants_id_seq', 'USAGE, SELECT, UPDATE')
     OR has_sequence_privilege('authenticated', 'public.conversation_turn_work_grants_id_seq', 'USAGE, SELECT, UPDATE') THEN
    RAISE EXCEPTION '0133: conversation_turn_work_grants_id_seq is reachable by a client role';
  END IF;
END
$$;

COMMIT;
