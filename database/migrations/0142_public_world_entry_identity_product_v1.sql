-- S5-01 — Public World Reachability, Entry & Identity Foundation v1.
--
-- Additive and forward-only. Migrations 0001–0141 are untouched: no historical table, column, constraint body, trigger,
-- function body or policy is dropped, replaced or rewritten, and no frozen I-05 primitive (0091–0099, 0121) is granted to
-- any role. This is the Product boundary ABOVE the frozen Public World runtime, not a second Public runtime: it adds no
-- Public World, no audience policy, no identity store, no Experience, Draft, publication, serving, search, placement,
-- discussion or Launch state.
--
-- ## What this adds
--
--   1. The Public World ENTRY VERDICT: `read_public_world_entry_v1()` — "may I enter Public World now?", answered from
--      CURRENT truth only: the authenticated human (`auth.uid()`, never a parameter), the ONE logical Public World (the
--      0091 singleton) and the frozen 0095 audience gate `resolve_public_audience_admission_v1`, which reads the ONE 0091
--      `public_audience_policy_state`. `ALLOW` or one neutral `UNAVAILABLE`; nothing of the policy, its revision or any
--      object is returned. It authorizes the Public World ROOT only. A signed-out caller is refused before the gate is
--      asked (42501): S5-01 never asks, sets or reinterprets the signed-out policy, so even a later `ALLOWED` value would
--      not open this path to `anon`.
--   2. The account's Public DISPLAY CHOICE (P1 §6; E2E-H-08): `PSEUDONYM` (the account's CURRENT canonical Public ID,
--      W3-02 / 0125) or `REAL_NAME` (the account's CURRENT Name, W1B-01 / 0123, W3-MEGA-A / 0129). The owner chooses
--      ONLY the mode — never label bytes. The default (no row) is `PSEUDONYM`. The label is DERIVED, at every read, from
--      the account row, by ONE derivation (`derive_account_public_display_v1`), so it cannot be stale.
--   3. The I-05 bridge: whenever an account HAS an I-05 Public Identity (created later by S5-02's authorship path; S5-01
--      creates none), its `public_identity_display_state` is synchronized to that same derivation — when the Public ID
--      changes, when the Name changes and when the mode changes — in the same transaction, with a new `label_revision`.
--      Every frozen I-05 reader (serving, discussion, search / lens / panel, the Replay bridge) reads that row, so none of
--      them can render a stale pseudonym or a stale Name. A display change touches that row alone: no Experience, version,
--      manifest, placement or World (CW2-04 §10 / D12; the 0091 relation has no foreign key to any of them).
--
-- ## Why the choice is not stored in an I-05 Public Identity
--
--   `public.public_identities.user_id` references `public.users` ON DELETE RESTRICT (0091). Provisioning an identity
--   for every reader who opens Public World or reads this setting would make the governed Personal erasure (0130) answer
--   BLOCKED for an account that has published nothing. So S5-01 provisions NO identity: the choice is an account-scoped
--   preference that cascades with the account (the 0135 precedent), and the I-05 display row is its synchronized
--   projection once an identity exists. One identity source (the account row), one internal ref (I-05), one derivation.
--
-- ## Boundary
--
--   - every privileged function lives in the new non-exposed `public_world_private` schema as a pinned SECURITY DEFINER
--     deriving the human from `auth.uid()`; the three `public` wrappers are SECURITY INVOKER one-liners executable by
--     `authenticated` only; the derivation, the sync and the trigger function are nobody's;
--   - no table grant of any kind; the one table is RLS-enabled with zero policies;
--   - no function here returns, accepts or exposes `public_identity_ref`, `user_id`, a Login ID, an Email or a Shared ID;
--   - no frozen I-05 consequential primitive (identity creation, label update, Draft, manifest, approval, review, publish,
--     placement, discussion, Public QANDEEL, vitality, disappearance) is granted, wrapped or called here; the only frozen
--     I-05 function called is the read-only audience gate.

CREATE SCHEMA public_world_private;
ALTER SCHEMA public_world_private OWNER TO postgres;
REVOKE ALL ON SCHEMA public_world_private FROM PUBLIC;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. The account's Public display choice. One row per account at most; no row = the default PSEUDONYM. It holds a MODE,
--    never a label: the label is always derived from the account row.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE public_world_private.account_public_display_choices (
    user_id uuid NOT NULL,
    label_mode text NOT NULL,
    choice_revision bigint NOT NULL,
    updated_at timestamptz NOT NULL,
    CONSTRAINT account_public_display_choices_pk PRIMARY KEY (user_id),
    CONSTRAINT account_public_display_choices_mode_check CHECK (label_mode IN ('PSEUDONYM', 'REAL_NAME')),
    CONSTRAINT account_public_display_choices_revision_check CHECK (choice_revision > 0),
    -- Account-scoped: erased with the account by the governed Personal erasure, never a reason for it to be BLOCKED.
    CONSTRAINT account_public_display_choices_user_fk
        FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE
);

COMMENT ON TABLE public_world_private.account_public_display_choices IS
  'S5-01: the account''s Public display MODE (P1 §6). Never a label: PSEUDONYM renders the CURRENT Public ID and '
  'REAL_NAME the CURRENT Name, derived at every read. No row means the default PSEUDONYM. Not an identity store and '
  'not an I-05 Public Identity: the I-05 display row is synchronized from it once an identity exists.';

ALTER TABLE public_world_private.account_public_display_choices OWNER TO postgres;
ALTER TABLE public_world_private.account_public_display_choices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public_world_private.account_public_display_choices FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. THE one derivation. Mode from the choice (default PSEUDONYM); label from the account row, exactly: the canonical
--    Public ID (stored without the `@` the Product draws in front of it) or the Name. NULL label = not representable
--    (an account with no Name cannot display REAL_NAME). Internal: executable by no application role.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public_world_private.derive_account_public_display_v1(p_user_id uuid)
RETURNS TABLE (label_mode text, display_label text)
LANGUAGE sql STABLE STRICT SECURITY DEFINER SET search_path = '' AS $$
  SELECT m.mode,
         CASE m.mode WHEN 'REAL_NAME' THEN u.name ELSE u.public_id END
    FROM public.users u
    CROSS JOIN LATERAL (
      SELECT coalesce((SELECT c.label_mode FROM public_world_private.account_public_display_choices c
                        WHERE c.user_id = u.id), 'PSEUDONYM') AS mode) m
   WHERE u.id = p_user_id;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. The I-05 bridge. If the account has an I-05 Public Identity, its display row is made to equal the derivation, with
--    a new label_revision; if it already does, nothing is written. No identity: nothing to do (S5-01 creates none). A
--    label the frozen 0091 relation cannot hold (no Name, or a Name longer than its 64-character ceiling) is REFUSED,
--    never truncated or substituted: a stale or invented Public label is exactly what this bridge exists to prevent.
--    Internal: executable by no application role.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public_world_private.sync_account_public_display_v1(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ref uuid;
  v_mode text;
  v_label text;
BEGIN
  SELECT i.public_identity_ref INTO v_ref FROM public.public_identities i WHERE i.user_id = p_user_id;
  IF v_ref IS NULL THEN
    RETURN;
  END IF;
  SELECT d.label_mode, d.display_label INTO v_mode, v_label FROM public_world_private.derive_account_public_display_v1(p_user_id) d;
  IF v_label IS NULL OR length(btrim(v_label)) = 0 OR length(v_label) > 64 THEN
    RAISE EXCEPTION 'PUBLIC_DISPLAY_LABEL_UNREPRESENTABLE' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.public_identity_display_state d
     SET label_mode = v_mode, display_label = v_label, label_revision = d.label_revision + 1, updated_at = clock_timestamp()
   WHERE d.public_identity_ref = v_ref
     AND (d.label_mode IS DISTINCT FROM v_mode OR d.display_label IS DISTINCT FROM v_label);
END$$;

-- The account row changed its Public ID or its Name: the I-05 display follows in the same transaction.
CREATE FUNCTION public_world_private.sync_public_display_after_account_change_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public_world_private.sync_account_public_display_v1(NEW.id);
  RETURN NULL;
END$$;

CREATE TRIGGER sync_public_display_after_account_change
    AFTER UPDATE OF public_id, name ON public.users
    FOR EACH ROW
    WHEN (OLD.public_id IS DISTINCT FROM NEW.public_id OR OLD.name IS DISTINCT FROM NEW.name)
    EXECUTE FUNCTION public_world_private.sync_public_display_after_account_change_v1();

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. The owner commands. The human is exactly auth.uid(); no account, ref, label, audience or authority parameter.
-- ---------------------------------------------------------------------------------------------------------------------

-- "May I enter Public World now?" ALLOW | UNAVAILABLE. One neutral refusal; nothing about why.
CREATE FUNCTION public_world_private.read_public_world_entry_v1()
RETURNS TABLE (verdict text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_WORLD_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.public_world_state w WHERE w.singleton AND w.world_type = 'PUBLIC_WORLD')
     AND EXISTS (SELECT 1 FROM public.resolve_public_audience_admission_v1(v_user) a
                  WHERE a.admission = 'ADMITTED' AND a.viewer_class = 'REGISTERED') THEN
    RETURN QUERY SELECT 'ALLOW'::text;
  ELSE
    RETURN QUERY SELECT 'UNAVAILABLE'::text;
  END IF;
END$$;

-- The reader's own display choice: the mode, the label it renders NOW, and whether REAL_NAME is possible (a Name exists).
CREATE FUNCTION public_world_private.read_own_public_display_v1()
RETURNS TABLE (label_mode text, display_label text, real_name_available boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_WORLD_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT d.label_mode, d.display_label, u.name IS NOT NULL
      FROM public.users u
      CROSS JOIN LATERAL public_world_private.derive_account_public_display_v1(u.id) d
     WHERE u.id = v_user;
END$$;

-- Choose the mode. UPDATED | UNCHANGED | UNAVAILABLE (REAL_NAME without a Name). It writes the reader's own choice row
-- and, when an I-05 identity exists, its synchronized display row — never the Public ID, never the Name.
CREATE FUNCTION public_world_private.set_own_public_display_mode_v1(p_label_mode text)
RETURNS TABLE (outcome text, label_mode text, display_label text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_account public.users;
  v_current text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_WORLD_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_label_mode IS NULL OR p_label_mode NOT IN ('PSEUDONYM', 'REAL_NAME') THEN
    RAISE EXCEPTION 'PUBLIC_DISPLAY_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  -- The account row is the serialization point, as it is for the Name and Public ID changes.
  SELECT * INTO v_account FROM public.users u WHERE u.id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_WORLD_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_label_mode = 'REAL_NAME' AND v_account.name IS NULL THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, d.label_mode, d.display_label
      FROM public_world_private.derive_account_public_display_v1(v_user) d;
    RETURN;
  END IF;
  SELECT d.label_mode INTO v_current FROM public_world_private.derive_account_public_display_v1(v_user) d;
  IF v_current = p_label_mode THEN
    RETURN QUERY SELECT 'UNCHANGED'::text, d.label_mode, d.display_label
      FROM public_world_private.derive_account_public_display_v1(v_user) d;
    RETURN;
  END IF;
  INSERT INTO public_world_private.account_public_display_choices AS c (user_id, label_mode, choice_revision, updated_at)
  VALUES (v_user, p_label_mode, 1, clock_timestamp())
  ON CONFLICT (user_id) DO UPDATE
     SET label_mode = EXCLUDED.label_mode, choice_revision = c.choice_revision + 1, updated_at = EXCLUDED.updated_at;
  PERFORM public_world_private.sync_account_public_display_v1(v_user);
  RETURN QUERY SELECT 'UPDATED'::text, d.label_mode, d.display_label
    FROM public_world_private.derive_account_public_display_v1(v_user) d;
END$$;

CREATE FUNCTION public.read_public_world_entry_v1()
RETURNS TABLE (verdict text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.verdict FROM public_world_private.read_public_world_entry_v1() r;
$$;
CREATE FUNCTION public.read_own_public_display_v1()
RETURNS TABLE (label_mode text, display_label text, real_name_available boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.label_mode, r.display_label, r.real_name_available FROM public_world_private.read_own_public_display_v1() r;
$$;
CREATE FUNCTION public.set_own_public_display_mode_v1(p_label_mode text)
RETURNS TABLE (outcome text, label_mode text, display_label text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.label_mode, r.display_label FROM public_world_private.set_own_public_display_mode_v1(p_label_mode) r;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Privileges, every one explicit (0133 removed the hosted default privileges; nothing here relies on a default).
-- ---------------------------------------------------------------------------------------------------------------------
ALTER FUNCTION public_world_private.derive_account_public_display_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public_world_private.sync_account_public_display_v1(uuid) OWNER TO postgres;
ALTER FUNCTION public_world_private.sync_public_display_after_account_change_v1() OWNER TO postgres;
ALTER FUNCTION public_world_private.read_public_world_entry_v1() OWNER TO postgres;
ALTER FUNCTION public_world_private.read_own_public_display_v1() OWNER TO postgres;
ALTER FUNCTION public_world_private.set_own_public_display_mode_v1(text) OWNER TO postgres;
ALTER FUNCTION public.read_public_world_entry_v1() OWNER TO postgres;
ALTER FUNCTION public.read_own_public_display_v1() OWNER TO postgres;
ALTER FUNCTION public.set_own_public_display_mode_v1(text) OWNER TO postgres;

REVOKE ALL ON FUNCTION
  public_world_private.derive_account_public_display_v1(uuid),
  public_world_private.sync_account_public_display_v1(uuid),
  public_world_private.sync_public_display_after_account_change_v1(),
  public_world_private.read_public_world_entry_v1(),
  public_world_private.read_own_public_display_v1(),
  public_world_private.set_own_public_display_mode_v1(text),
  public.read_public_world_entry_v1(),
  public.read_own_public_display_v1(),
  public.set_own_public_display_mode_v1(text)
FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
  -- The server channel holds nothing here: every S5-01 act is the human's own, under the human's own token.
  EXECUTE 'REVOKE ALL ON SCHEMA public_world_private FROM service_role';
  EXECUTE 'REVOKE ALL ON TABLE public_world_private.account_public_display_choices FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION public_world_private.derive_account_public_display_v1(uuid), public_world_private.sync_account_public_display_v1(uuid), public_world_private.sync_public_display_after_account_change_v1(), public_world_private.read_public_world_entry_v1(), public_world_private.read_own_public_display_v1(), public_world_private.set_own_public_display_mode_v1(text), public.read_public_world_entry_v1(), public.read_own_public_display_v1(), public.set_own_public_display_mode_v1(text) FROM service_role';
END IF; END$$;

-- The INVOKER wrappers run as `authenticated`, which needs USAGE on the private schema and EXECUTE on the exact owner
-- commands — never on the derivation, the sync or the trigger function.
GRANT USAGE ON SCHEMA public_world_private TO authenticated;
GRANT EXECUTE ON FUNCTION
  public_world_private.read_public_world_entry_v1(),
  public_world_private.read_own_public_display_v1(),
  public_world_private.set_own_public_display_mode_v1(text),
  public.read_public_world_entry_v1(),
  public.read_own_public_display_v1(),
  public.set_own_public_display_mode_v1(text)
TO authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. Deploy-time self-assertions: the boundary is what this file says, or the migration fails.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_fn text;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public_world_private.derive_account_public_display_v1(uuid)',
    'public_world_private.sync_account_public_display_v1(uuid)',
    'public_world_private.sync_public_display_after_account_change_v1()'] LOOP
    IF has_function_privilege('authenticated', v_fn, 'EXECUTE') OR has_function_privilege('anon', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S5-01: % is executable by a client', v_fn;
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY[
    'public.read_public_world_entry_v1()', 'public.read_own_public_display_v1()', 'public.set_own_public_display_mode_v1(text)'] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S5-01: % is executable by anon', v_fn;
    END IF;
  END LOOP;
  -- The frozen I-05 primitives stay exactly as closed as 0093 / 0095 / 0096 / 0099 left them.
  FOREACH v_fn IN ARRAY ARRAY[
    'public.ensure_public_identity_v1(uuid, uuid, text, text)',
    'public.update_public_display_label_v1(uuid, text, text)',
    'public.create_public_experience_draft_v1(uuid, uuid)',
    'public.resolve_public_audience_admission_v1(uuid)',
    'public.resolve_public_publication_prerequisites_v1(uuid, uuid)',
    'public.publish_public_experience_v1(uuid, uuid, uuid)'] LOOP
    IF has_function_privilege('authenticated', v_fn, 'EXECUTE') OR has_function_privilege('anon', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S5-01: the frozen primitive % is client-executable', v_fn;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM public.public_world_state) <> 1 THEN
    RAISE EXCEPTION 'S5-01: exactly one Public World must exist';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.public_audience_policy_state p WHERE p.singleton AND p.signed_out_viewing_policy = 'UNRESOLVED') THEN
    RAISE EXCEPTION 'S5-01: the signed-out Public policy must still be UNRESOLVED';
  END IF;
END$$;
