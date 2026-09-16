-- The Supabase-compatible posture a fresh PostgreSQL must be given before any
-- QANDEEL migration is applied.
--
-- This is the ONE canonical bootstrap artifact. Both `api-ci.yml` and
-- `focused-database-verification.yml` apply THIS FILE; neither carries a copy.
-- Migrations grant to `anon`, `authenticated` and `service_role` and read
-- `auth.uid()`; stock PostgreSQL has none of them, so a database bootstrapped
-- any other way is not the database CI runs against, and a verifier proven
-- against it has proven nothing about CI.
--
-- The version number is NOT the parity claim - these roles and this function
-- are. Parity used to be enforced by comparing this text against inline SQL in
-- `api-ci.yml`, which could only ever be checked in one direction: API CI could
-- grow a requirement while the focused gate silently stayed weaker. Sharing one
-- artifact removes the direction entirely. Adding a statement here strengthens
-- both gates in the same commit, and
-- `database/tests/verifier-hazard-contract-v1.test.mjs` requires both workflows
-- to keep consuming it and neither to reintroduce a copy.
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
