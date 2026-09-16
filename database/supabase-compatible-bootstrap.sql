-- The Supabase-compatible posture a fresh PostgreSQL must be given before any
-- QANDEEL migration is applied.
--
-- This is the ONE parity artifact between full API CI and the focused database
-- gate. Migrations grant to `anon`, `authenticated` and `service_role` and read
-- `auth.uid()`; stock PostgreSQL has none of them, so a database bootstrapped
-- any other way is not the database CI runs against, and a verifier proven
-- against it has proven nothing about CI.
--
-- The version number is NOT the parity claim - these roles and this function
-- are. `database/tests/verifier-hazard-contract-v1.test.mjs` requires every
-- statement here to also be performed by `api-ci.yml`, so the focused gate can
-- never bootstrap LESS than the full gate does.
--
-- It is applied to a DISPOSABLE database only. Nothing here belongs in, or is
-- ever applied to, production Supabase: production already owns these roles.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid
$$;
ALTER FUNCTION auth.uid() OWNER TO postgres;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
