-- I-02B - Shared Standing Context Grant Persistence Foundation v1.
--
-- Persists the ONE Product-approved private-context exception of Connected
-- Worlds v2 (CW2-02 sections 16-19, CW2-03 sections 39-40, CW2-01 section 20):
--
--   > A participant may explicitly allow QANDEEL to use that participant's
--   > private MY_WORLD context for reasoning inside one exact Shared World.
--
-- This forward-only migration stores grant truth and its exact human audience
-- ceiling, and nothing else:
--
--   * public.shared_world_standing_context_grants - one row per Standing
--     Context Grant. Its semantics are fixed by TABLE IDENTITY, not by data:
--       source  = the grantor's own MY_WORLD private context
--       target  = the exact world_id (a born Shared World, never anything else)
--       purpose = SHARED_REASONING (the merged I-01A kernel's exact literal)
--       effect  = reasoning eligibility only
--     so there is deliberately NO scope / purpose / action / source /
--     permissions column, and no JSON column, that a later change could widen.
--     status is exactly ACTIVE | REVOKED. Revocation stops FUTURE reasoning
--     (CW2-02 section 32) and keeps the row: a revoked grant is history, never
--     erased. At most one current ACTIVE grant exists per (world, grantor); a
--     later explicit reconfirmation / expanded-audience transaction revokes the
--     old row and creates a new one (that command is NOT implemented here).
--   * public.shared_world_standing_context_grant_audience - the human audience
--     ceiling explicitly authorized for one grant at grant / extension time
--     (CW2-02 section 18, B13-B14; CW2-03 section 40). Shared membership
--     expansion never expands a grant: the ceiling is persisted as its own
--     rows, nothing here reads current membership, and no trigger or function
--     auto-populates a new member. Whether a later output audience lies inside
--     the ceiling is I-03's effective-authority decision, not a database rule.
--
-- Grantor and audience reference public.users(id) only: humans. QANDEEL is the
-- system actor that may later USE the permission for reasoning; it is never a
-- grantor, an audience member, an owner or a consent principal (CW2-01
-- section 7, A3).
--
-- What this grant is NOT: REASON_FROM_PRIVATE_CONTEXT != DISCLOSE_PRIVATE_FACT
-- (CW2-02 section 19, B15). Nothing here authorizes source copying, quoting,
-- publication, external sharing, export, source-specific fact disclosure,
-- private-source attribution or provenance disclosure; there is no column or
-- literal for any of those. It is also not Matching Context Admission (its own
-- later capability persistence, CW2-02 section 41, B28) and not Public private
-- Context Admission (structurally unsupported in v1, CW2-01 section 22, A14):
-- the only target is a public.shared_worlds row, non-nullable.
--
-- Deliberately DEFERRED (task I-02B section 13): CW2-02 section 10 separates an
-- append-only CONSENT_EVENT_LOG from EFFECTIVE_GRANT_STATE. This slice persists
-- only the bounded standing-grant record and its ceiling. No generic consent /
-- permission event schema is invented here, because a half-generic event table
-- could not represent the request / decline / approval families correctly. The
-- later authoritative grant / revoke command must create immutable operational
-- consent events, maintain current grant state transactionally and preserve
-- revocation history. Grant TTL, request / decline history and audience
-- reconfirmation UX are not frozen and are not encoded.
--
-- Database-level truths only (task section 17): status vocabulary, revocation
-- timestamp consistency, exact Shared World FK, exact human FKs, one current
-- ACTIVE grant per grantor / world, unique audience member per grant,
-- restrictive deletion, deny-by-default access. The database does NOT try to
-- prove that the grantor or any ceiling user is currently a member, that an
-- output audience is within the ceiling, or that a grant is currently
-- sufficient for model context. Those are I-03 authority evaluation.
--
-- Security posture, identical in spirit to migration 0075: both tables are
-- RLS-enabled with ZERO policies and every application role - PUBLIC, anon,
-- authenticated, service_role - is revoked from every table privilege. No
-- function, trigger, RPC, policy or view is created, so no application caller
-- can read, create, revoke or widen a grant through this migration. The tables
-- exist before runtime authority. Migrations 0001-0075 are untouched;
-- shared_worlds, shared_world_membership_episodes and every Personal table
-- (users, conversation_sessions, conversation_turns) are neither altered nor
-- generalized - public.users and public.shared_worlds are referenced only as
-- foreign-key parents.

BEGIN;

-- 1. Standing Context Grant truth. granted_at uses the database clock;
--    revoked_at carries no default - the future authoritative revoke command
--    owns how it is set.
CREATE TABLE public.shared_world_standing_context_grants (
    id uuid PRIMARY KEY,
    world_id uuid NOT NULL,
    grantor_user_id uuid NOT NULL,
    status text NOT NULL,
    granted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at timestamptz,
    CONSTRAINT shared_world_standing_context_grants_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_standing_context_grants_grantor_fk
        FOREIGN KEY (grantor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_standing_context_grants_status_check
        CHECK (status IN ('ACTIVE', 'REVOKED')),
    -- ACTIVE <=> revoked_at IS NULL; REVOKED <=> revoked_at IS NOT NULL.
    -- (Constraint names stay within PostgreSQL's 63-byte identifier limit.)
    CONSTRAINT shared_world_standing_context_grants_revocation_check
        CHECK ((status = 'ACTIVE' AND revoked_at IS NULL)
            OR (status = 'REVOKED' AND revoked_at IS NOT NULL)),
    -- A grant cannot be revoked before it was granted.
    CONSTRAINT shared_world_standing_context_grants_revoked_after_grant_check
        CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

-- Exactly one CURRENT ACTIVE standing grant per (world, grantor). Revoked
-- history rows for the same pair coexist freely; a reconfirmation is a new row.
CREATE UNIQUE INDEX shared_world_standing_context_grants_one_active_idx
    ON public.shared_world_standing_context_grants (world_id, grantor_user_id)
    WHERE status = 'ACTIVE';

-- The one frozen access pattern over grant history: a grantor's grants in one
-- exact World (current and revoked). Nothing speculative.
CREATE INDEX shared_world_standing_context_grants_world_grantor_idx
    ON public.shared_world_standing_context_grants (world_id, grantor_user_id);

-- 2. Audience ceiling: the humans explicitly authorized for one grant. The
--    composite primary key is the (grant, human) uniqueness AND the grant_id
--    lookup index (leading column); only the reverse lookup needs its own index.
CREATE TABLE public.shared_world_standing_context_grant_audience (
    grant_id uuid NOT NULL,
    audience_user_id uuid NOT NULL,
    CONSTRAINT shared_world_standing_context_grant_audience_pkey
        PRIMARY KEY (grant_id, audience_user_id),
    CONSTRAINT shared_world_standing_context_grant_audience_grant_fk
        FOREIGN KEY (grant_id) REFERENCES public.shared_world_standing_context_grants (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_standing_context_grant_audience_user_fk
        FOREIGN KEY (audience_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

CREATE INDEX shared_world_standing_context_grant_audience_user_idx
    ON public.shared_world_standing_context_grant_audience (audience_user_id);

-- 3. Deny-by-default posture. RLS is enabled with no policy, and every
--    application role is revoked from every privilege. Private-context grant
--    truth is unreachable by design until a later contract introduces its own
--    narrowly authorized command or read boundary.
ALTER TABLE public.shared_world_standing_context_grants OWNER TO postgres;
ALTER TABLE public.shared_world_standing_context_grant_audience OWNER TO postgres;
ALTER TABLE public.shared_world_standing_context_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_standing_context_grant_audience ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shared_world_standing_context_grants, public.shared_world_standing_context_grant_audience
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.shared_world_standing_context_grants, public.shared_world_standing_context_grant_audience FROM service_role';
END IF;END$$;

-- 4. Terminal self-assertions. The migration refuses to deploy a substrate that
--    is application-reachable, policy-bearing, trigger-bearing, or that carries
--    a generic scope / purpose / action / source / permission column, a
--    disclosure-shaped column, an owner / admin column or a JSON column.
DO $$
DECLARE
  target_role text;
  target_table text;
  target_privilege text;
  rls_enabled boolean;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['public.shared_world_standing_context_grants','public.shared_world_standing_context_grant_audience'] LOOP
    SELECT c.relrowsecurity INTO rls_enabled FROM pg_class c WHERE c.oid = target_table::regclass;
    IF NOT rls_enabled THEN
      RAISE EXCEPTION 'I-02B: row level security must be enabled on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-02B: no RLS policy may exist yet on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = target_table::regclass AND NOT t.tgisinternal) THEN
      RAISE EXCEPTION 'I-02B: no trigger may exist on %', target_table;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) AS privilege
       WHERE c.oid = target_table::regclass AND privilege.grantee = 0
    ) THEN
      RAISE EXCEPTION 'I-02B: PUBLIC must hold no privilege on %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-02B substrate must be unreachable: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name IN ('shared_world_standing_context_grants','shared_world_standing_context_grant_audience')
       AND (c.column_name ~* '(scope|purpose|action|source|permission|disclos|quote|copy|publish|share|export|provenance|transfer|owner|admin|ttl|expir)'
            OR c.data_type IN ('json','jsonb','ARRAY'))
  ) THEN
    RAISE EXCEPTION 'I-02B: grant semantics are fixed by table identity; no generic, disclosure-shaped, owner or JSON column may exist';
  END IF;
END$$;

COMMIT;
