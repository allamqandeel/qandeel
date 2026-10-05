-- S4-01 — Shared World Reachability, Invitation & Birth v1.
--
-- Additive and forward-only. Migrations 0001–0137 are untouched: no historical table, column, constraint, trigger,
-- function body or policy is dropped, replaced or rewritten. This migration consumes the frozen I-04 runtime — the
-- 0081 credential / invitation primitives, the 0082 atomic direct-birth core, the 0075 World and membership-episode
-- substrate and the 0129 Shared ID format — and adds only the Product execution boundary over it. It creates no second
-- World, membership, invitation, history, material or authority model.
--
-- ## What this adds
--
--   1. `shared_private` — a non-exposed schema for every privileged part, exactly as `account_private`,
--      `activity_private` and `push_private` are. Every function in the exposed `public` schema is SECURITY INVOKER.
--   2. The owner-readable Shared ID (S4-01 §5). 0129 stores the Shared ID nowhere: only its one-way lookup reference.
--      The Product now needs the owner to read their CURRENT value again, so ONE narrow sealed store holds it as an
--      authenticated ciphertext the database cannot open: `shared_private.shared_id_sealed_values` (ciphertext, nonce,
--      tag, key version), bound to the exact credential epoch and lookup reference it was sealed for. The key lives
--      outside the database, the repository and the database's backups (the API's secret configuration); a missing
--      key fails closed on the server, and nothing here can fall back to a clear value.
--   3. Atomic rotation (S4-01 §5.9): `rotate_own_sealed_shared_id_v1` hands the new value's derived reference to the
--      frozen 0081 rotation — which locks the credential state, advances the epoch and invalidates every PENDING
--      direct invitation of an older epoch — and writes the sealed value for exactly that epoch, in ONE transaction.
--      The lookup reference, the epoch, the invalidation and the sealed value cannot disagree.
--   4. THE LEGACY ROTATION PATH IS RETIRED FROM CLIENTS (S4-01 §5, "legacy rotation consistency"). 0081 granted its two
--      commands to `authenticated`, so a raw Data API call could rotate the lookup reference and the epoch while the
--      sealed value stayed behind. This migration REVOKES that grant (a privilege adjustment, not an edit of 0081):
--      both frozen commands become server-owned primitives reached only through the reviewed wrappers below, exactly
--      as the 0082 core always was. Their bodies, their epoch law and their lock order are unchanged.
--   5. A minimal Shared launch gate (S4-01 §6, CW2-08 §24–§29, §40): one server-canonical state row per capability
--      scope — `SHARED_DIRECT_INVITATION` and `SHARED_DIRECT_WORLD_BIRTH` — with its feature-flag state, its
--      mandatory launch-requirement state and a monotonic restriction version, changed only by an operator function no
--      application role can execute, every change audited. An absent row is UNCONFIGURED. ALLOW needs `ENABLED` and
--      `SATISFIED` (or `WAIVED_BY_AUTHORIZED_GOVERNANCE`); everything else — UNKNOWN, UNCONFIGURED, UNSATISFIED,
--      DISABLED, INTERNAL, LIMITED_ROLLOUT (no cohort runtime exists, so no permissive guess), EMERGENCY_DISABLED —
--      DENIES. This migration configures nothing: every capability starts closed.
--   6. The reviewed server-owned birth path (S4-01 §7.5): `accept_shared_world_invitation_v1` locks the CURRENT gate
--      snapshot, refuses on DENY before anything is written, invokes the frozen 0082 core under the exact human's own
--      `auth.uid()` (it substitutes no principal), and records the bound snapshot beside the born World in the same
--      transaction — so an emergency disable either commits first (no birth) or waits for the birth to commit.
--   7. The non-enumerating invitation (S4-01 §1.3, §7.3): `submit_shared_world_invitation_v1` normalizes the typed
--      Shared ID on the server and answers ONE outcome, `SUBMITTED`, whether the ID belongs to a person, belongs to
--      nobody, was rotated away, is the caller's own or the person is already invited. No World is created.
--   8. Decline (S4-01 §7.4), the forward-safe primitive the historical slice never had: exact invitee only, idempotent,
--      terminal `DECLINED`; it creates no World, no membership and tells the inviter nothing.
--   9. Product-safe read resolvers (S4-01 §7.2, §7.6): the caller's current Worlds (an OPEN membership episode in an
--      ACTIVE World — former membership is not current membership), the caller's pending incoming invitations with
--      the inviter's Name, the exact-World entry verdict, and that World's current members. Each derives the caller
--      from `auth.uid()`, reads under its own definer, and returns nothing a non-member may know: an unknown World, a
--      World the caller left and a World that never existed are one answer, `UNAVAILABLE`.
--
-- ## Account deletion (QAN-BL-ACCT-01) — not absorbed
--
-- A credential state row references the account with ON DELETE RESTRICT (0081), and the Personal erasure (0130)
-- therefore marks a deletion BLOCKED once any Connected Worlds row exists. S4-01 provisions a Shared ID LAZILY — on the
-- owner's first Shared ID read, and only while the invitation capability is open — so an account that never reaches
-- Shared gains no Connected Worlds reference. The sealed value row cascades with the account and adds no blocker of its
-- own. Nothing here touches 0130 or claims account deletion across Connected Worlds.
--
-- ## Lock order (continues 0081 / 0082; never reversed)
--
--   0. the gate row of the capability          (FOR SHARE — the snapshot an operator change must wait for)
--   1. a credential-state row                  (FOR UPDATE — inside the frozen primitives / the decline)
--   2. the invitation row(s)
--   3. the caller's own sealed-value row       (rotation only, after the frozen rotation returned)
--
-- No advisory lock, table lock or process mutex is used.

BEGIN;

CREATE SCHEMA shared_private;
ALTER SCHEMA shared_private OWNER TO postgres;
REVOKE ALL ON SCHEMA shared_private FROM PUBLIC;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. The sealed current Shared ID. One row per account: the CURRENT value only. The ciphertext is AES-256-GCM sealed by
--    the server under an externally held key; the additional authenticated data binds it to the account, the epoch and
--    the key version, so a row cannot be replayed onto another account or epoch. The database stores and returns bytes
--    it cannot open, and never a clear value.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE shared_private.shared_id_sealed_values (
    user_id uuid NOT NULL,
    credential_epoch bigint NOT NULL,
    credential_lookup_ref text NOT NULL,
    key_version integer NOT NULL,
    nonce bytea NOT NULL,
    ciphertext bytea NOT NULL,
    auth_tag bytea NOT NULL,
    sealed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT shared_id_sealed_values_pk PRIMARY KEY (user_id),
    CONSTRAINT shared_id_sealed_values_user_fk
        FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
    CONSTRAINT shared_id_sealed_values_epoch_check CHECK (credential_epoch >= 1),
    CONSTRAINT shared_id_sealed_values_ref_check CHECK (credential_lookup_ref ~ '^sid1:[0-9a-f]{64}$'),
    CONSTRAINT shared_id_sealed_values_key_version_check CHECK (key_version BETWEEN 1 AND 32767),
    -- AES-GCM: a 96-bit nonce, a 128-bit tag, and a ciphertext exactly as long as the canonical `XXXX-XXXX-XXXX`.
    CONSTRAINT shared_id_sealed_values_nonce_check CHECK (octet_length(nonce) = 12),
    CONSTRAINT shared_id_sealed_values_ciphertext_check CHECK (octet_length(ciphertext) = 14),
    CONSTRAINT shared_id_sealed_values_tag_check CHECK (octet_length(auth_tag) = 16)
);

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. The minimal Shared launch gate. Server-canonical; no application role reads or writes these tables.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE shared_private.shared_launch_capability_states (
    capability_scope text NOT NULL,
    feature_flag_state text NOT NULL,
    launch_requirements_state text NOT NULL,
    restriction_version bigint NOT NULL,
    decided_by text NOT NULL,
    policy_basis text NOT NULL,
    decided_at timestamptz NOT NULL,
    CONSTRAINT shared_launch_capability_states_pk PRIMARY KEY (capability_scope),
    CONSTRAINT shared_launch_capability_states_scope_check
        CHECK (capability_scope IN ('SHARED_DIRECT_INVITATION', 'SHARED_DIRECT_WORLD_BIRTH')),
    CONSTRAINT shared_launch_capability_states_flag_check
        CHECK (feature_flag_state IN ('DISABLED', 'INTERNAL', 'LIMITED_ROLLOUT', 'ENABLED', 'EMERGENCY_DISABLED')),
    CONSTRAINT shared_launch_capability_states_requirements_check
        CHECK (launch_requirements_state IN ('SATISFIED', 'UNSATISFIED', 'UNKNOWN', 'WAIVED_BY_AUTHORIZED_GOVERNANCE')),
    CONSTRAINT shared_launch_capability_states_version_check CHECK (restriction_version >= 1),
    CONSTRAINT shared_launch_capability_states_decided_by_check CHECK (length(btrim(decided_by)) BETWEEN 1 AND 120),
    CONSTRAINT shared_launch_capability_states_basis_check CHECK (length(btrim(policy_basis)) BETWEEN 1 AND 500)
);

-- Append-only audit of every gate decision (CW2-08 §36): actor, scope, decision, version, time.
CREATE TABLE shared_private.shared_launch_capability_events (
    id bigint GENERATED ALWAYS AS IDENTITY,
    capability_scope text NOT NULL,
    feature_flag_state text NOT NULL,
    launch_requirements_state text NOT NULL,
    restriction_version bigint NOT NULL,
    decided_by text NOT NULL,
    policy_basis text NOT NULL,
    decided_at timestamptz NOT NULL,
    CONSTRAINT shared_launch_capability_events_pk PRIMARY KEY (id),
    CONSTRAINT shared_launch_capability_events_scope_fk
        FOREIGN KEY (capability_scope) REFERENCES shared_private.shared_launch_capability_states (capability_scope) ON DELETE RESTRICT,
    CONSTRAINT shared_launch_capability_events_version_key UNIQUE (capability_scope, restriction_version)
);

-- The gate snapshot every born World was bound to, written in the birth's own transaction (CW2-08 §25 / H18).
CREATE TABLE shared_private.shared_direct_birth_launch_evidence (
    acceptance_command_id uuid NOT NULL,
    world_id uuid NOT NULL,
    capability_scope text NOT NULL,
    restriction_version bigint NOT NULL,
    feature_flag_state text NOT NULL,
    launch_requirements_state text NOT NULL,
    bound_at timestamptz NOT NULL,
    CONSTRAINT shared_direct_birth_launch_evidence_pk PRIMARY KEY (acceptance_command_id),
    CONSTRAINT shared_direct_birth_launch_evidence_world_key UNIQUE (world_id),
    CONSTRAINT shared_direct_birth_launch_evidence_command_fk
        FOREIGN KEY (acceptance_command_id) REFERENCES public.shared_world_direct_acceptance_commands (id) ON DELETE RESTRICT,
    CONSTRAINT shared_direct_birth_launch_evidence_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    -- Only an ALLOW snapshot can ever be bound to a birth.
    CONSTRAINT shared_direct_birth_launch_evidence_allow_check
        CHECK (capability_scope = 'SHARED_DIRECT_WORLD_BIRTH' AND feature_flag_state = 'ENABLED'
               AND launch_requirements_state IN ('SATISFIED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE'))
);

-- Durable decline idempotency. The row id IS the caller-supplied command id; one invitation is declined by at most one
-- command. It names no inviter: the decline is the invitee's own act and tells the inviter nothing.
CREATE TABLE shared_private.shared_direct_invitation_decline_commands (
    id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    invitation_id uuid NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT shared_direct_invitation_decline_commands_pk PRIMARY KEY (id),
    CONSTRAINT shared_direct_invitation_decline_commands_invitation_key UNIQUE (invitation_id),
    CONSTRAINT shared_direct_invitation_decline_commands_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT shared_direct_invitation_decline_commands_invitation_fk
        FOREIGN KEY (invitation_id) REFERENCES public.shared_world_direct_invitations (id) ON DELETE RESTRICT
);

ALTER TABLE shared_private.shared_id_sealed_values OWNER TO postgres;
ALTER TABLE shared_private.shared_launch_capability_states OWNER TO postgres;
ALTER TABLE shared_private.shared_launch_capability_events OWNER TO postgres;
ALTER TABLE shared_private.shared_direct_birth_launch_evidence OWNER TO postgres;
ALTER TABLE shared_private.shared_direct_invitation_decline_commands OWNER TO postgres;
ALTER TABLE shared_private.shared_id_sealed_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_private.shared_launch_capability_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_private.shared_launch_capability_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_private.shared_direct_birth_launch_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_private.shared_direct_invitation_decline_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE shared_private.shared_id_sealed_values, shared_private.shared_launch_capability_states,
                    shared_private.shared_launch_capability_events, shared_private.shared_direct_birth_launch_evidence,
                    shared_private.shared_direct_invitation_decline_commands
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Gate: the operator's change and the one evaluation every gated command uses.
-- ---------------------------------------------------------------------------------------------------------------------

-- The ONLY way a gate state changes. Executable by no application role: an operator runs it as the database owner.
-- Every call advances the restriction version, so a snapshot bound before it is distinguishable from one after it.
CREATE FUNCTION shared_private.set_shared_launch_capability_v1(
  p_capability_scope text, p_feature_flag_state text, p_launch_requirements_state text, p_decided_by text, p_policy_basis text
) RETURNS TABLE (capability_scope text, restriction_version bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_version bigint;
  v_at timestamptz := clock_timestamp();
BEGIN
  SELECT s.restriction_version INTO v_version
    FROM shared_private.shared_launch_capability_states s
   WHERE s.capability_scope = p_capability_scope
   FOR UPDATE;
  v_version := COALESCE(v_version, 0) + 1;
  INSERT INTO shared_private.shared_launch_capability_states AS s
    (capability_scope, feature_flag_state, launch_requirements_state, restriction_version, decided_by, policy_basis, decided_at)
  VALUES (p_capability_scope, p_feature_flag_state, p_launch_requirements_state, v_version, p_decided_by, p_policy_basis, v_at)
  ON CONFLICT ON CONSTRAINT shared_launch_capability_states_pk DO UPDATE
     SET feature_flag_state = EXCLUDED.feature_flag_state,
         launch_requirements_state = EXCLUDED.launch_requirements_state,
         restriction_version = EXCLUDED.restriction_version,
         decided_by = EXCLUDED.decided_by,
         policy_basis = EXCLUDED.policy_basis,
         decided_at = EXCLUDED.decided_at;
  INSERT INTO shared_private.shared_launch_capability_events
    (capability_scope, feature_flag_state, launch_requirements_state, restriction_version, decided_by, policy_basis, decided_at)
  VALUES (p_capability_scope, p_feature_flag_state, p_launch_requirements_state, v_version, p_decided_by, p_policy_basis, v_at);
  RETURN QUERY SELECT p_capability_scope, v_version;
END$$;

-- The current snapshot of one capability scope, locked FOR SHARE so an operator change waits for the caller's
-- transaction. ALLOW only for ENABLED + SATISFIED / WAIVED; an absent row is UNCONFIGURED and DENIES.
CREATE FUNCTION shared_private.bind_shared_launch_gate_v1(p_capability_scope text)
RETURNS TABLE (verdict text, restriction_version bigint, feature_flag_state text, launch_requirements_state text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_state shared_private.shared_launch_capability_states;
BEGIN
  SELECT * INTO v_state
    FROM shared_private.shared_launch_capability_states s
   WHERE s.capability_scope = p_capability_scope
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

-- Presentation hints only (CW2-08 §24: client flags never grant authority; every command re-binds the gate itself).
CREATE FUNCTION shared_private.read_shared_capabilities_v1()
RETURNS TABLE (invitation_available boolean, birth_available boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT
    EXISTS (SELECT 1 FROM shared_private.shared_launch_capability_states s
             WHERE s.capability_scope = 'SHARED_DIRECT_INVITATION' AND s.feature_flag_state = 'ENABLED'
               AND s.launch_requirements_state IN ('SATISFIED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE')),
    EXISTS (SELECT 1 FROM shared_private.shared_launch_capability_states s
             WHERE s.capability_scope = 'SHARED_DIRECT_WORLD_BIRTH' AND s.feature_flag_state = 'ENABLED'
               AND s.launch_requirements_state IN ('SATISFIED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE'));
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. The owner's Shared ID: read the sealed current value; provision or regenerate it atomically.
-- ---------------------------------------------------------------------------------------------------------------------

-- ABSENT    no credential yet (the server provisions one automatically, while the invitation capability is open);
-- SEALED    the sealed value of EXACTLY the current epoch and lookup reference, with that reference so the server can
--           prove its decryption matches before it shows the value;
-- UNSEALED  a credential exists but no sealed value matches it (a pre-S4-01 state): the server regenerates.
-- `provisioning_available` is the invitation capability: a FIRST Shared ID is never created while Shared is closed.
CREATE FUNCTION shared_private.read_own_shared_id_v1()
RETURNS TABLE (state text, credential_epoch bigint, credential_lookup_ref text, key_version integer, nonce bytea,
               ciphertext bytea, auth_tag bytea, provisioning_available boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_state public.shared_world_invite_credential_state;
  v_sealed shared_private.shared_id_sealed_values;
  v_available boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT c.invitation_available INTO v_available FROM shared_private.read_shared_capabilities_v1() c;
  SELECT * INTO v_state FROM public.shared_world_invite_credential_state s WHERE s.user_id = v_user;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'ABSENT'::text, NULL::bigint, NULL::text, NULL::integer, NULL::bytea, NULL::bytea, NULL::bytea, v_available;
    RETURN;
  END IF;
  SELECT * INTO v_sealed FROM shared_private.shared_id_sealed_values v
   WHERE v.user_id = v_user AND v.credential_epoch = v_state.epoch AND v.credential_lookup_ref = v_state.credential_lookup_ref;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNSEALED'::text, v_state.epoch, NULL::text, NULL::integer, NULL::bytea, NULL::bytea, NULL::bytea, v_available;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'SEALED'::text, v_sealed.credential_epoch, v_sealed.credential_lookup_ref, v_sealed.key_version,
                      v_sealed.nonce, v_sealed.ciphertext, v_sealed.auth_tag, v_available;
END$$;

-- First setup (p_expected_epoch NULL) or regeneration of the caller's own Shared ID, with its sealed value, in ONE
-- transaction. The value arrives already canonical (`XXXX-XXXX-XXXX`) with the server's seal of that exact value; only
-- its derived reference is handed to the frozen 0081 rotation, which owns the lock, the epoch and the invalidation.
-- Outcomes: ROTATED (with the resulting epoch — also the answer to an equivalent retry of a committed command, whose
-- value is never returned again) | UNAVAILABLE (a FIRST Shared ID while the invitation capability is closed: nothing
-- is written). The frozen rotation's own refusals propagate unchanged: 40001 stale state, 23505 reference unavailable
-- (the server draws again) or command conflict, 22023 unchanged / invalid.
CREATE FUNCTION shared_private.rotate_own_sealed_shared_id_v1(
  p_command_id uuid, p_expected_epoch bigint, p_shared_id text, p_key_version integer, p_nonce bytea, p_ciphertext bytea,
  p_auth_tag bytea
) RETURNS TABLE (outcome text, credential_epoch bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_canonical text;
  v_ref text;
  v_epoch bigint;
  v_gate record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_shared_id IS NULL OR p_key_version IS NULL OR p_nonce IS NULL OR p_ciphertext IS NULL
     OR p_auth_tag IS NULL OR (p_expected_epoch IS NOT NULL AND p_expected_epoch < 1) THEN
    RAISE EXCEPTION 'SHARED_ID_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;

  -- An equivalent retry of a committed rotation answers its committed epoch, whatever has happened since.
  SELECT c.resulting_credential_epoch INTO v_epoch
    FROM public.shared_world_invitation_commands c
   WHERE c.id = p_command_id AND c.actor_user_id = v_user AND c.command_type = 'CREDENTIAL_ROTATION';
  IF FOUND THEN
    RETURN QUERY SELECT 'ROTATED'::text, v_epoch;
    RETURN;
  END IF;

  v_canonical := account_private.normalize_shared_id_v1(p_shared_id);
  IF v_canonical IS NULL OR v_canonical <> p_shared_id
     OR octet_length(p_nonce) <> 12 OR octet_length(p_ciphertext) <> 14 OR octet_length(p_auth_tag) <> 16
     OR p_key_version NOT BETWEEN 1 AND 32767 THEN
    RAISE EXCEPTION 'SHARED_ID_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;

  -- A FIRST Shared ID is a Connected Worlds reference on the account: it is never created while Shared is closed.
  -- Regenerating an EXISTING one is a privacy act and stays available whatever the gate says.
  IF p_expected_epoch IS NULL THEN
    SELECT * INTO v_gate FROM shared_private.bind_shared_launch_gate_v1('SHARED_DIRECT_INVITATION');
    IF v_gate.verdict <> 'ALLOW' THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::bigint;
      RETURN;
    END IF;
  END IF;

  v_ref := account_private.shared_id_lookup_ref_v1(v_canonical);
  SELECT r.credential_epoch INTO v_epoch
    FROM public.rotate_shared_world_invite_credential_v1(p_command_id, v_ref, p_expected_epoch) r;

  INSERT INTO shared_private.shared_id_sealed_values AS v
    (user_id, credential_epoch, credential_lookup_ref, key_version, nonce, ciphertext, auth_tag, sealed_at)
  VALUES (v_user, v_epoch, v_ref, p_key_version, p_nonce, p_ciphertext, p_auth_tag, clock_timestamp())
  ON CONFLICT ON CONSTRAINT shared_id_sealed_values_pk DO UPDATE
     SET credential_epoch = EXCLUDED.credential_epoch,
         credential_lookup_ref = EXCLUDED.credential_lookup_ref,
         key_version = EXCLUDED.key_version,
         nonce = EXCLUDED.nonce,
         ciphertext = EXCLUDED.ciphertext,
         auth_tag = EXCLUDED.auth_tag,
         sealed_at = EXCLUDED.sealed_at;

  RETURN QUERY SELECT 'ROTATED'::text, v_epoch;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. The non-enumerating invitation.
-- ---------------------------------------------------------------------------------------------------------------------

-- Outcomes: SUBMITTED (the one answer for every well-formed Shared ID) | INVALID_SHARED_ID (not of the Shared ID's
-- shape at all — a typing error the caller can see for themselves, which says nothing about anyone) | UNAVAILABLE (the
-- invitation capability is closed). The target is resolved only inside the frozen 0081 submission, under its own lock,
-- and no target identity, existence, epoch or invitation id is ever returned. A PENDING invitation from the caller to
-- the same person at the same epoch is not duplicated.
CREATE FUNCTION shared_private.submit_shared_world_invitation_v1(p_command_id uuid, p_shared_id text)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_canonical text;
  v_ref text;
  v_gate record;
  v_target uuid;
  v_epoch bigint;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_INVITE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;

  -- An equivalent retry of a committed submission is answered from durable history.
  IF EXISTS (SELECT 1 FROM public.shared_world_invitation_commands c
              WHERE c.id = p_command_id AND c.actor_user_id = v_user AND c.command_type = 'DIRECT_INVITATION_SUBMISSION') THEN
    RETURN QUERY SELECT 'SUBMITTED'::text;
    RETURN;
  END IF;

  v_canonical := account_private.normalize_shared_id_v1(p_shared_id);
  IF v_canonical IS NULL THEN
    RETURN QUERY SELECT 'INVALID_SHARED_ID'::text;
    RETURN;
  END IF;

  SELECT * INTO v_gate FROM shared_private.bind_shared_launch_gate_v1('SHARED_DIRECT_INVITATION');
  IF v_gate.verdict <> 'ALLOW' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
    RETURN;
  END IF;

  v_ref := account_private.shared_id_lookup_ref_v1(v_canonical);

  -- Not a second invitation to a person already invited by this caller at their current epoch. Read without a lock:
  -- the worst outcome of a race is the duplicate the frozen submission would have created anyway.
  SELECT s.user_id, s.epoch INTO v_target, v_epoch
    FROM public.shared_world_invite_credential_state s WHERE s.credential_lookup_ref = v_ref;
  IF FOUND AND EXISTS (
       SELECT 1 FROM public.shared_world_direct_invitations i
        WHERE i.inviter_user_id = v_user AND i.target_user_id = v_target
          AND i.target_credential_epoch = v_epoch AND i.status = 'PENDING') THEN
    RETURN QUERY SELECT 'SUBMITTED'::text;
    RETURN;
  END IF;

  BEGIN
    PERFORM 1 FROM public.submit_shared_world_direct_invitation_v1(p_command_id, gen_random_uuid(), v_ref);
  EXCEPTION
    WHEN no_data_found THEN
      -- SHARED_INVITE_TARGET_NOT_USABLE: nobody, a rotated-away ID, the caller's own, or an unavailable account.
      -- The same answer as a delivered invitation, by design.
      NULL;
    WHEN unique_violation THEN
      -- A concurrent equivalent retry committed first: the same command, already answered.
      IF NOT EXISTS (SELECT 1 FROM public.shared_world_invitation_commands c
                      WHERE c.id = p_command_id AND c.actor_user_id = v_user
                        AND c.command_type = 'DIRECT_INVITATION_SUBMISSION') THEN
        RAISE;
      END IF;
  END;

  RETURN QUERY SELECT 'SUBMITTED'::text;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. Decline and acceptance: the exact invitee's two acts.
-- ---------------------------------------------------------------------------------------------------------------------

-- Outcomes: DECLINED (now, or already by this invitee) | NOT_DECLINABLE (not the caller's, not PENDING, stale, or
-- unknown — one bounded answer). Creates no World and no membership. Lock order: the caller's credential row, then the
-- exact invitation, exactly as the frozen acceptance core.
CREATE FUNCTION shared_private.decline_shared_world_invitation_v1(p_command_id uuid, p_invitation_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_epoch bigint;
  v_invitation public.shared_world_direct_invitations;
  v_committed shared_private.shared_direct_invitation_decline_commands;
  v_at timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_invitation_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_DECLINE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_committed FROM shared_private.shared_direct_invitation_decline_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF v_committed.actor_user_id = v_user AND v_committed.invitation_id = p_invitation_id THEN
      RETURN QUERY SELECT 'DECLINED'::text;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_DECLINE_COMMAND_ID_CONFLICT' USING ERRCODE = '23505';
  END IF;

  SELECT s.epoch INTO v_epoch FROM public.shared_world_invite_credential_state s WHERE s.user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_DECLINABLE'::text;
    RETURN;
  END IF;
  SELECT * INTO v_invitation FROM public.shared_world_direct_invitations i WHERE i.id = p_invitation_id FOR UPDATE;
  IF NOT FOUND OR v_invitation.target_user_id <> v_user THEN
    RETURN QUERY SELECT 'NOT_DECLINABLE'::text;
    RETURN;
  END IF;
  IF v_invitation.status = 'DECLINED' THEN
    RETURN QUERY SELECT 'DECLINED'::text;
    RETURN;
  END IF;
  IF v_invitation.status <> 'PENDING' OR v_invitation.target_credential_epoch <> v_epoch THEN
    RETURN QUERY SELECT 'NOT_DECLINABLE'::text;
    RETURN;
  END IF;

  v_at := clock_timestamp();
  UPDATE public.shared_world_direct_invitations i
     SET status = 'DECLINED', terminal_at = v_at
   WHERE i.id = p_invitation_id AND i.status = 'PENDING';
  INSERT INTO shared_private.shared_direct_invitation_decline_commands (id, actor_user_id, invitation_id, committed_at)
  VALUES (p_command_id, v_user, p_invitation_id, v_at);
  RETURN QUERY SELECT 'DECLINED'::text;
END$$;

-- The reviewed, launch-gated acceptance: the ONLY application path to the frozen 0082 birth core.
-- Outcomes: BORN (with the World — now, or already by this invitee's acceptance of the same invitation) |
-- UNAVAILABLE (the birth capability's current snapshot DENIES: nothing is written) | NOT_ACCEPTABLE (the core's one
-- bounded refusal). The core derives the human from the caller's own `auth.uid()`; this wrapper restricts whether it
-- runs and never substitutes a principal.
CREATE FUNCTION shared_private.accept_shared_world_invitation_v1(p_command_id uuid, p_invitation_id uuid)
RETURNS TABLE (outcome text, world_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_committed public.shared_world_direct_acceptance_commands;
  v_gate record;
  v_born record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_invitation_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_ACCEPTANCE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;

  -- An equivalent retry of a committed acceptance answers its World, whatever the gate says now: it is a read of
  -- committed truth, not a new irreversible act.
  SELECT * INTO v_committed FROM public.shared_world_direct_acceptance_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF v_committed.actor_user_id = v_user AND v_committed.invitation_id = p_invitation_id THEN
      RETURN QUERY SELECT 'BORN'::text, v_committed.world_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_ACCEPTANCE_COMMAND_ID_CONFLICT' USING ERRCODE = '23505';
  END IF;

  -- LOCK ORDER STEP 0: the current birth-capability snapshot, held FOR SHARE until this transaction ends.
  SELECT * INTO v_gate FROM shared_private.bind_shared_launch_gate_v1('SHARED_DIRECT_WORLD_BIRTH');
  IF v_gate.verdict <> 'ALLOW' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid;
    RETURN;
  END IF;

  BEGIN
    SELECT b.born_world_id INTO v_born
      FROM public.commit_shared_world_direct_acceptance_birth_v1(
             p_command_id, p_invitation_id, gen_random_uuid(), gen_random_uuid(), gen_random_uuid()) b;
  EXCEPTION
    WHEN no_data_found THEN
      -- SHARED_DIRECT_INVITATION_NOT_ACCEPTABLE. If THIS invitee already accepted this exact invitation under another
      -- command, that World is the answer; anything else stays the core's one bounded refusal.
      SELECT * INTO v_committed FROM public.shared_world_direct_acceptance_commands c
       WHERE c.invitation_id = p_invitation_id AND c.actor_user_id = v_user;
      IF FOUND THEN
        RETURN QUERY SELECT 'BORN'::text, v_committed.world_id;
        RETURN;
      END IF;
      RETURN QUERY SELECT 'NOT_ACCEPTABLE'::text, NULL::uuid;
      RETURN;
    WHEN unique_violation THEN
      -- A concurrent equivalent retry committed the same command first.
      SELECT * INTO v_committed FROM public.shared_world_direct_acceptance_commands c WHERE c.id = p_command_id;
      IF FOUND AND v_committed.actor_user_id = v_user AND v_committed.invitation_id = p_invitation_id THEN
        RETURN QUERY SELECT 'BORN'::text, v_committed.world_id;
        RETURN;
      END IF;
      RAISE;
  END;

  -- The snapshot this birth was bound to, in the birth's own transaction.
  INSERT INTO shared_private.shared_direct_birth_launch_evidence
    (acceptance_command_id, world_id, capability_scope, restriction_version, feature_flag_state, launch_requirements_state, bound_at)
  VALUES (p_command_id, v_born.born_world_id, 'SHARED_DIRECT_WORLD_BIRTH', v_gate.restriction_version,
          v_gate.feature_flag_state, v_gate.launch_requirements_state, clock_timestamp());

  RETURN QUERY SELECT 'BORN'::text, v_born.born_world_id;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. Product-safe reads. Current membership = an OPEN episode in an ACTIVE World. No ranking: Worlds are listed in the
--    order they were born, members in the order they joined.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION shared_private.list_own_shared_worlds_v1()
RETURNS TABLE (world_id uuid, born_at timestamptz, joined_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT w.id, w.born_at, e.joined_at
      FROM public.shared_world_membership_episodes e
      JOIN public.shared_worlds w ON w.id = e.world_id
     WHERE e.user_id = v_user AND e.ended_at IS NULL AND w.lifecycle = 'ACTIVE'
     ORDER BY w.born_at, w.id;
END$$;

-- The current members of every World the caller currently belongs to, for the root's labels: each member's Name, and
-- whether that member is the caller. Nothing about any World the caller does not currently belong to.
CREATE FUNCTION shared_private.list_own_shared_world_members_v1()
RETURNS TABLE (world_id uuid, is_self boolean, member_name text, joined_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT m.world_id, m.user_id = v_user, u.name, m.joined_at
      FROM public.shared_world_membership_episodes mine
      JOIN public.shared_worlds w ON w.id = mine.world_id AND w.lifecycle = 'ACTIVE'
      JOIN public.shared_world_membership_episodes m ON m.world_id = mine.world_id AND m.ended_at IS NULL
      JOIN public.users u ON u.id = m.user_id
     WHERE mine.user_id = v_user AND mine.ended_at IS NULL
     ORDER BY w.born_at, m.world_id, m.joined_at, m.id;
END$$;

-- The caller's PENDING incoming invitations at their CURRENT credential epoch, each with the inviter's Name — the
-- identity the invitee is legitimately shown (S4-01 §1.4). Nothing about the inviter beyond the Name.
CREATE FUNCTION shared_private.list_own_shared_world_invitations_v1()
RETURNS TABLE (invitation_id uuid, inviter_name text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT i.id, u.name, i.created_at
      FROM public.shared_world_direct_invitations i
      JOIN public.shared_world_invite_credential_state s ON s.user_id = i.target_user_id
      JOIN public.users u ON u.id = i.inviter_user_id
     WHERE i.target_user_id = v_user AND i.status = 'PENDING' AND i.target_credential_epoch = s.epoch
     ORDER BY i.created_at, i.id;
END$$;

-- The authority verdict for entering ONE World, resolved before anything of it is shown (CW2-07 §19, §43). ALLOW only
-- for a current member of an ACTIVE World; every other case — unknown, never existed, left, removed, closed — is the
-- same UNAVAILABLE with no detail.
CREATE FUNCTION shared_private.resolve_own_shared_world_entry_v1(p_world_id uuid)
RETURNS TABLE (outcome text, world_id uuid, born_at timestamptz, joined_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_born timestamptz;
  v_joined timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT w.born_at, e.joined_at INTO v_born, v_joined
    FROM public.shared_world_membership_episodes e
    JOIN public.shared_worlds w ON w.id = e.world_id
   WHERE e.world_id = p_world_id AND e.user_id = v_user AND e.ended_at IS NULL AND w.lifecycle = 'ACTIVE';
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'ALLOW'::text, p_world_id, v_born, v_joined;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. The exposed Product wrappers: SECURITY INVOKER, `authenticated` only, each a one-line call into its definer.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.read_shared_capabilities_v1()
RETURNS TABLE (invitation_available boolean, birth_available boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT c.invitation_available, c.birth_available FROM shared_private.read_shared_capabilities_v1() c;
$$;

CREATE FUNCTION public.read_own_shared_id_v1()
RETURNS TABLE (state text, credential_epoch bigint, credential_lookup_ref text, key_version integer, nonce bytea,
               ciphertext bytea, auth_tag bytea, provisioning_available boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.state, r.credential_epoch, r.credential_lookup_ref, r.key_version, r.nonce, r.ciphertext, r.auth_tag,
         r.provisioning_available
    FROM shared_private.read_own_shared_id_v1() r;
$$;

CREATE FUNCTION public.rotate_own_sealed_shared_id_v1(
  p_command_id uuid, p_expected_epoch bigint, p_shared_id text, p_key_version integer, p_nonce bytea, p_ciphertext bytea,
  p_auth_tag bytea
) RETURNS TABLE (outcome text, credential_epoch bigint)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.credential_epoch
    FROM shared_private.rotate_own_sealed_shared_id_v1(p_command_id, p_expected_epoch, p_shared_id, p_key_version, p_nonce,
                                                       p_ciphertext, p_auth_tag) r;
$$;

CREATE FUNCTION public.submit_shared_world_invitation_v1(p_command_id uuid, p_shared_id text)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome FROM shared_private.submit_shared_world_invitation_v1(p_command_id, p_shared_id) r;
$$;

CREATE FUNCTION public.decline_shared_world_invitation_v1(p_command_id uuid, p_invitation_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome FROM shared_private.decline_shared_world_invitation_v1(p_command_id, p_invitation_id) r;
$$;

CREATE FUNCTION public.accept_shared_world_invitation_v1(p_command_id uuid, p_invitation_id uuid)
RETURNS TABLE (outcome text, world_id uuid)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.world_id FROM shared_private.accept_shared_world_invitation_v1(p_command_id, p_invitation_id) r;
$$;

CREATE FUNCTION public.list_own_shared_worlds_v1()
RETURNS TABLE (world_id uuid, born_at timestamptz, joined_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.world_id, r.born_at, r.joined_at FROM shared_private.list_own_shared_worlds_v1() r;
$$;

CREATE FUNCTION public.list_own_shared_world_members_v1()
RETURNS TABLE (world_id uuid, is_self boolean, member_name text, joined_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.world_id, r.is_self, r.member_name, r.joined_at FROM shared_private.list_own_shared_world_members_v1() r;
$$;

CREATE FUNCTION public.list_own_shared_world_invitations_v1()
RETURNS TABLE (invitation_id uuid, inviter_name text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.invitation_id, r.inviter_name, r.created_at FROM shared_private.list_own_shared_world_invitations_v1() r;
$$;

CREATE FUNCTION public.resolve_own_shared_world_entry_v1(p_world_id uuid)
RETURNS TABLE (outcome text, world_id uuid, born_at timestamptz, joined_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.world_id, r.born_at, r.joined_at FROM shared_private.resolve_own_shared_world_entry_v1(p_world_id) r;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 9. Privileges. Ownership; default-deny by name; then the exact grants.
-- ---------------------------------------------------------------------------------------------------------------------
ALTER FUNCTION shared_private.set_shared_launch_capability_v1(text, text, text, text, text) OWNER TO postgres;
ALTER FUNCTION shared_private.bind_shared_launch_gate_v1(text) OWNER TO postgres;
ALTER FUNCTION shared_private.read_shared_capabilities_v1() OWNER TO postgres;
ALTER FUNCTION shared_private.read_own_shared_id_v1() OWNER TO postgres;
ALTER FUNCTION shared_private.rotate_own_sealed_shared_id_v1(uuid, bigint, text, integer, bytea, bytea, bytea) OWNER TO postgres;
ALTER FUNCTION shared_private.submit_shared_world_invitation_v1(uuid, text) OWNER TO postgres;
ALTER FUNCTION shared_private.decline_shared_world_invitation_v1(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION shared_private.accept_shared_world_invitation_v1(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION shared_private.list_own_shared_worlds_v1() OWNER TO postgres;
ALTER FUNCTION shared_private.list_own_shared_world_members_v1() OWNER TO postgres;
ALTER FUNCTION shared_private.list_own_shared_world_invitations_v1() OWNER TO postgres;
ALTER FUNCTION shared_private.resolve_own_shared_world_entry_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public.read_shared_capabilities_v1() OWNER TO postgres;
ALTER FUNCTION public.read_own_shared_id_v1() OWNER TO postgres;
ALTER FUNCTION public.rotate_own_sealed_shared_id_v1(uuid, bigint, text, integer, bytea, bytea, bytea) OWNER TO postgres;
ALTER FUNCTION public.submit_shared_world_invitation_v1(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.decline_shared_world_invitation_v1(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.accept_shared_world_invitation_v1(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.list_own_shared_worlds_v1() OWNER TO postgres;
ALTER FUNCTION public.list_own_shared_world_members_v1() OWNER TO postgres;
ALTER FUNCTION public.list_own_shared_world_invitations_v1() OWNER TO postgres;
ALTER FUNCTION public.resolve_own_shared_world_entry_v1(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION
  shared_private.set_shared_launch_capability_v1(text, text, text, text, text),
  shared_private.bind_shared_launch_gate_v1(text),
  shared_private.read_shared_capabilities_v1(),
  shared_private.read_own_shared_id_v1(),
  shared_private.rotate_own_sealed_shared_id_v1(uuid, bigint, text, integer, bytea, bytea, bytea),
  shared_private.submit_shared_world_invitation_v1(uuid, text),
  shared_private.decline_shared_world_invitation_v1(uuid, uuid),
  shared_private.accept_shared_world_invitation_v1(uuid, uuid),
  shared_private.list_own_shared_worlds_v1(),
  shared_private.list_own_shared_world_members_v1(),
  shared_private.list_own_shared_world_invitations_v1(),
  shared_private.resolve_own_shared_world_entry_v1(uuid),
  public.read_shared_capabilities_v1(),
  public.read_own_shared_id_v1(),
  public.rotate_own_sealed_shared_id_v1(uuid, bigint, text, integer, bytea, bytea, bytea),
  public.submit_shared_world_invitation_v1(uuid, text),
  public.decline_shared_world_invitation_v1(uuid, uuid),
  public.accept_shared_world_invitation_v1(uuid, uuid),
  public.list_own_shared_worlds_v1(),
  public.list_own_shared_world_members_v1(),
  public.list_own_shared_world_invitations_v1(),
  public.resolve_own_shared_world_entry_v1(uuid)
  FROM PUBLIC, anon, authenticated;

-- THE LEGACY CLIENT PATH, RETIRED. The two frozen 0081 commands stay exactly as written and become server-owned
-- primitives, reached only through the wrappers above (owner `postgres`, the human's own claims preserved).
REVOKE EXECUTE ON FUNCTION public.rotate_shared_world_invite_credential_v1(uuid, text, bigint) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_shared_world_direct_invitation_v1(uuid, uuid, text) FROM authenticated;

DO $$BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
  -- The server channel holds nothing here: every S4-01 act is the human's own, under the human's own token.
  EXECUTE 'REVOKE ALL ON SCHEMA shared_private FROM service_role';
  EXECUTE 'REVOKE ALL ON TABLE shared_private.shared_id_sealed_values, shared_private.shared_launch_capability_states, shared_private.shared_launch_capability_events, shared_private.shared_direct_birth_launch_evidence, shared_private.shared_direct_invitation_decline_commands FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION shared_private.set_shared_launch_capability_v1(text, text, text, text, text), shared_private.bind_shared_launch_gate_v1(text), shared_private.read_shared_capabilities_v1(), shared_private.read_own_shared_id_v1(), shared_private.rotate_own_sealed_shared_id_v1(uuid, bigint, text, integer, bytea, bytea, bytea), shared_private.submit_shared_world_invitation_v1(uuid, text), shared_private.decline_shared_world_invitation_v1(uuid, uuid), shared_private.accept_shared_world_invitation_v1(uuid, uuid), shared_private.list_own_shared_worlds_v1(), shared_private.list_own_shared_world_members_v1(), shared_private.list_own_shared_world_invitations_v1(), shared_private.resolve_own_shared_world_entry_v1(uuid) FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public.read_shared_capabilities_v1(), public.read_own_shared_id_v1(), public.rotate_own_sealed_shared_id_v1(uuid, bigint, text, integer, bytea, bytea, bytea), public.submit_shared_world_invitation_v1(uuid, text), public.decline_shared_world_invitation_v1(uuid, uuid), public.accept_shared_world_invitation_v1(uuid, uuid), public.list_own_shared_worlds_v1(), public.list_own_shared_world_members_v1(), public.list_own_shared_world_invitations_v1(), public.resolve_own_shared_world_entry_v1(uuid) FROM service_role';
END IF; END$$;

-- The INVOKER wrappers run as `authenticated`, which needs USAGE on the private schema and EXECUTE on the exact owner
-- commands — never on the operator change or the bare gate binding.
GRANT USAGE ON SCHEMA shared_private TO authenticated;
GRANT EXECUTE ON FUNCTION
  shared_private.read_shared_capabilities_v1(),
  shared_private.read_own_shared_id_v1(),
  shared_private.rotate_own_sealed_shared_id_v1(uuid, bigint, text, integer, bytea, bytea, bytea),
  shared_private.submit_shared_world_invitation_v1(uuid, text),
  shared_private.decline_shared_world_invitation_v1(uuid, uuid),
  shared_private.accept_shared_world_invitation_v1(uuid, uuid),
  shared_private.list_own_shared_worlds_v1(),
  shared_private.list_own_shared_world_members_v1(),
  shared_private.list_own_shared_world_invitations_v1(),
  shared_private.resolve_own_shared_world_entry_v1(uuid),
  public.read_shared_capabilities_v1(),
  public.read_own_shared_id_v1(),
  public.rotate_own_sealed_shared_id_v1(uuid, bigint, text, integer, bytea, bytea, bytea),
  public.submit_shared_world_invitation_v1(uuid, text),
  public.decline_shared_world_invitation_v1(uuid, uuid),
  public.accept_shared_world_invitation_v1(uuid, uuid),
  public.list_own_shared_worlds_v1(),
  public.list_own_shared_world_members_v1(),
  public.list_own_shared_world_invitations_v1(),
  public.resolve_own_shared_world_entry_v1(uuid)
  TO authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 10. Deploy-time self-assertions: refuse a reachable table, a client-callable irreversible core or legacy rotation, an
--     operator gate a client could move, a pre-opened gate, or an unpinned definer.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  r text;
  fn text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['shared_private.shared_id_sealed_values', 'shared_private.shared_launch_capability_states',
                           'shared_private.shared_launch_capability_events', 'shared_private.shared_direct_birth_launch_evidence',
                           'shared_private.shared_direct_invitation_decline_commands'] LOOP
    IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = t::regclass) THEN
      RAISE EXCEPTION 'S4-01: row level security must be enabled on %', t;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = t::regclass) THEN
      RAISE EXCEPTION 'S4-01: no policy may exist on %', t;
    END IF;
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r)
         AND has_table_privilege(r, t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') THEN
        RAISE EXCEPTION 'S4-01: % can reach %', r, t;
      END IF;
    END LOOP;
  END LOOP;

  -- The irreversible core and the legacy credential / invitation commands are executable by no application role.
  FOREACH fn IN ARRAY ARRAY['public.commit_shared_world_direct_acceptance_birth_v1(uuid,uuid,uuid,uuid,uuid)',
                            'public.rotate_shared_world_invite_credential_v1(uuid,text,bigint)',
                            'public.submit_shared_world_direct_invitation_v1(uuid,uuid,text)',
                            'account_private.regenerate_own_shared_id_v1(uuid)',
                            'shared_private.set_shared_launch_capability_v1(text,text,text,text,text)',
                            'shared_private.bind_shared_launch_gate_v1(text)'] LOOP
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S4-01: PUBLIC can execute %', fn;
    END IF;
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r) AND has_function_privilege(r, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S4-01: % can execute % — it is reachable only through the reviewed server-owned wrappers', r, fn;
      END IF;
    END LOOP;
  END LOOP;

  -- Every S4-01 definer pins an empty search_path, derives the human from auth.uid() (the operator change excepted)
  -- and is never anonymous.
  FOR p IN SELECT n.nspname, pr.proname, pr.oid, pr.prosecdef, pr.proconfig, pr.prosrc
             FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'shared_private' LOOP
    IF NOT p.prosecdef THEN RAISE EXCEPTION 'S4-01: shared_private.% must be SECURITY DEFINER', p.proname; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'S4-01: shared_private.% must pin an empty search_path', p.proname;
    END IF;
    IF p.proname NOT IN ('set_shared_launch_capability_v1', 'bind_shared_launch_gate_v1') AND p.prosrc !~ 'auth\.uid\(\)' THEN
      RAISE EXCEPTION 'S4-01: shared_private.% must derive the human from auth.uid()', p.proname;
    END IF;
    IF has_function_privilege('anon', p.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'S4-01: anon can execute shared_private.%', p.proname;
    END IF;
  END LOOP;

  -- The birth wrapper binds the gate BEFORE it reaches the core, and writes the evidence AFTER it.
  SELECT pr.prosrc INTO t FROM pg_proc pr WHERE pr.oid = 'shared_private.accept_shared_world_invitation_v1(uuid,uuid)'::regprocedure;
  IF strpos(t, 'bind_shared_launch_gate_v1(''SHARED_DIRECT_WORLD_BIRTH'')') = 0
     OR strpos(t, 'bind_shared_launch_gate_v1(''SHARED_DIRECT_WORLD_BIRTH'')') > strpos(t, 'commit_shared_world_direct_acceptance_birth_v1(')
     OR strpos(t, 'commit_shared_world_direct_acceptance_birth_v1(') > strpos(t, 'INSERT INTO shared_private.shared_direct_birth_launch_evidence') THEN
    RAISE EXCEPTION 'S4-01: the acceptance must bind the birth gate, then invoke the core, then bind the evidence';
  END IF;

  -- No capability is opened by a migration.
  IF EXISTS (SELECT 1 FROM shared_private.shared_launch_capability_states) THEN
    RAISE EXCEPTION 'S4-01: a migration configures no launch capability; every scope starts closed';
  END IF;

  -- No S4-01 table carries a clear Shared ID, an owner / admin authority or a generic payload.
  IF EXISTS (SELECT 1 FROM information_schema.columns c
              WHERE c.table_schema = 'shared_private'
                AND (c.column_name ~* '(shared_id|plaintext|clear|owner|admin|creator|payload|metadata)'
                     OR c.data_type IN ('json', 'jsonb', 'ARRAY'))) THEN
    RAISE EXCEPTION 'S4-01: no clear Shared ID, authority or generic payload column may exist in shared_private';
  END IF;
END$$;

COMMIT;
