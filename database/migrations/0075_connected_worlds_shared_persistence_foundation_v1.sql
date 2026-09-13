-- I-02A - Connected Worlds Shared World Core Persistence & Deny-by-Default
-- RLS Foundation v1.
--
-- Connected Worlds v2 enters the database as an ADDITIVE substrate beside the
-- frozen Personal conversation persistence (I-00 sections 4 and 22). This
-- forward-only migration creates the first durable Shared World identity /
-- state / membership rows and nothing else:
--
--   * public.shared_worlds - one row per BORN Shared World. Identity is the
--     world id alone, independent of any current participant set (CW2-01 A5).
--     There is deliberately no owner / admin / inviter / creator column: an
--     initiator gains no owner privilege (CW2-01 section 5, CW2-03 section
--     16). Prospective invitation / proposal state is not a World and is not
--     stored here, so there is no DRAFT / PENDING / DORMANT lifecycle.
--   * public.shared_world_membership_episodes - historical, episodic
--     membership (CW2-01 section 11, CW2-03 section 15). Leave and a later
--     rejoin are two rows, never one mutable row that erases the earlier
--     episode. At most one OPEN episode per (world, user) is enforced by a
--     partial unique index.
--
-- The check constraints encode only truths that hold at every persisted point
-- and that are already frozen: the lifecycle / phase / birth-basis vocabulary
-- in exact parity with the merged I-01A kernel
-- (apps/api/src/connected-worlds/kernel/shared-world.types.ts); closure
-- consistency (ACTIVE <=> closed_at IS NULL, CW2-01 section 8); and the rule
-- that a direct-invitation World is born STANDARD and never becomes an
-- Introduction (CW2-03 sections 2 and 12: only a MUTUAL_MATCH World passes
-- through INTRODUCTION and may later transition to STANDARD under the same
-- world id, so a MUTUAL_MATCH row may carry either phase).
--
-- Security posture: both tables are RLS-enabled with ZERO policies, and every
-- application role - PUBLIC, anon, authenticated and service_role - is revoked
-- from every table privilege. No function, trigger, RPC or policy is created,
-- so no application caller can read, manufacture or mutate a Shared World or a
-- membership episode through this migration. Persistence exists before
-- runtime authority: the narrow definer commands (birth, lifecycle,
-- add / remove / leave / rejoin) and the explicitly authorized read boundaries
-- arrive only with the later authority / Shared runtime contracts (CW2-02,
-- CW2-03). Current membership is NOT modelled as entitlement to historical
-- material (CW2-01 A9, CW2-02 B21): no SELECT policy of any kind is introduced,
-- not even "temporarily", and service_role is not arbitrary DML authority.
--
-- Closed-episode overlap is NOT enforced with an extension or an exclusion
-- constraint in this slice (no new extension is added); the later
-- authoritative membership command owns the full non-overlap transaction
-- contract before it receives EXECUTE. Migrations 0001-0074 are untouched and
-- no Personal table (users, conversation_sessions, conversation_turns) is
-- altered, referenced by a new column, or generalized.

BEGIN;

-- 1. Shared World identity and state.
CREATE TABLE public.shared_worlds (
    id uuid PRIMARY KEY,
    lifecycle text NOT NULL,
    phase text NOT NULL,
    birth_basis text NOT NULL,
    born_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at timestamptz,
    CONSTRAINT shared_worlds_lifecycle_check
        CHECK (lifecycle IN ('ACTIVE', 'READ_ONLY_CLOSED')),
    CONSTRAINT shared_worlds_phase_check
        CHECK (phase IN ('STANDARD', 'INTRODUCTION')),
    CONSTRAINT shared_worlds_birth_basis_check
        CHECK (birth_basis IN ('ACCEPTED_INVITATION', 'MUTUAL_MATCH')),
    -- ACTIVE <=> closed_at IS NULL; READ_ONLY_CLOSED <=> closed_at IS NOT NULL.
    CONSTRAINT shared_worlds_closure_consistency_check
        CHECK ((lifecycle = 'ACTIVE' AND closed_at IS NULL)
            OR (lifecycle = 'READ_ONLY_CLOSED' AND closed_at IS NOT NULL)),
    -- A World cannot close before it was born.
    CONSTRAINT shared_worlds_closed_after_birth_check
        CHECK (closed_at IS NULL OR closed_at >= born_at),
    -- A direct-invitation World is STANDARD at every persisted point.
    CONSTRAINT shared_worlds_direct_birth_phase_check
        CHECK (birth_basis <> 'ACCEPTED_INVITATION' OR phase = 'STANDARD')
);

-- 2. Historical membership episodes. joined_at / ended_at carry no default:
--    the future authoritative membership commands own how they are set.
--    Deletion is restrictive in both directions - a World with history and a
--    user with episodes are never silently cascaded away.
CREATE TABLE public.shared_world_membership_episodes (
    id uuid PRIMARY KEY,
    world_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamptz NOT NULL,
    ended_at timestamptz,
    CONSTRAINT shared_world_membership_episodes_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_membership_episodes_user_fk
        FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_membership_episodes_interval_check
        CHECK (ended_at IS NULL OR ended_at >= joined_at)
);

-- At most one currently-open episode per (world, user); a closed episode
-- followed by a new open one is the rejoin shape.
CREATE UNIQUE INDEX shared_world_membership_episodes_one_open_idx
    ON public.shared_world_membership_episodes (world_id, user_id)
    WHERE ended_at IS NULL;

-- The two frozen future access patterns: a World's membership in join order,
-- and a user's memberships in join order. Nothing speculative.
CREATE INDEX shared_world_membership_episodes_world_joined_idx
    ON public.shared_world_membership_episodes (world_id, joined_at);

CREATE INDEX shared_world_membership_episodes_user_joined_idx
    ON public.shared_world_membership_episodes (user_id, joined_at);

-- 3. Deny-by-default posture. RLS is enabled with no policy, and every
--    application role is revoked from every privilege. The tables are
--    unreachable by design until a later contract introduces its own
--    narrowly authorized command or read boundary.
ALTER TABLE public.shared_worlds OWNER TO postgres;
ALTER TABLE public.shared_world_membership_episodes OWNER TO postgres;
ALTER TABLE public.shared_worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_membership_episodes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shared_worlds, public.shared_world_membership_episodes
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.shared_worlds, public.shared_world_membership_episodes FROM service_role';
END IF;END$$;

-- 4. Terminal self-assertions. The migration refuses to deploy a substrate that
--    is application-reachable, policy-bearing, or that carries a superior
--    participant authority column, so drift cannot pass silently.
DO $$
DECLARE
  target_role text;
  target_table text;
  target_privilege text;
  rls_enabled boolean;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['public.shared_worlds','public.shared_world_membership_episodes'] LOOP
    SELECT c.relrowsecurity INTO rls_enabled FROM pg_class c WHERE c.oid = target_table::regclass;
    IF NOT rls_enabled THEN
      RAISE EXCEPTION 'I-02A: row level security must be enabled on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-02A: no RLS policy may exist yet on %', target_table;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) AS privilege
       WHERE c.oid = target_table::regclass AND privilege.grantee = 0
    ) THEN
      RAISE EXCEPTION 'I-02A: PUBLIC must hold no privilege on %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-02A substrate must be unreachable: % holds % on %', target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name IN ('shared_worlds','shared_world_membership_episodes')
       AND c.column_name ~* '(owner|admin|inviter|creator|initiator|privilege)'
  ) THEN
    RAISE EXCEPTION 'I-02A: Shared World identity is not participant ownership; no superior authority column may exist';
  END IF;
END$$;

COMMIT;
