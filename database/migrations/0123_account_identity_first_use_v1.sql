-- W1B-01 — Account identity + first use (E2E-A-09, A-13, A-14, B-02, K-02).
--
-- The account identity P1 §2 froze — one canonical Name and one private, unique, case-insensitive
-- Login ID — gains its canonical home on the existing account row, `public.users`, and the one-time
-- first-use Welcome gains its durable state beside it. There is no second identity store.
--
-- Additive and forward-only. Migrations 0001 and 0002 are untouched: the 0002 provisioning trigger
-- still creates exactly one bare row per `auth.users` insert, and a SECOND trigger, which PostgreSQL
-- fires after it (same event, alphabetical order), copies the two sign-up values into that row. Every
-- existing row, and every account provisioned without them, keeps NULL: no fallback name and no
-- generated Login ID is invented for it.
--
-- The sign-up values arrive as bounded, namespaced sign-up metadata (`qandeel_name`,
-- `qandeel_login_id`). They are read once, at insert, and never again: nothing in QANDEEL reads
-- `auth.users` metadata after this trigger, so the canonical truth is `public.users` alone. The
-- metadata is never trusted: the CHECK constraints and the unique index below are what a modified
-- client meets, and they refuse the whole `auth.users` insert.
--
-- Read `to_jsonb(NEW) -> 'raw_user_meta_data'` rather than the column directly, so the trigger is
-- total over any `auth.users` shape (the disposable CI bootstrap has only `id`).
BEGIN;

ALTER TABLE public.users
    ADD COLUMN name text,
    ADD COLUMN login_id text,
    ADD COLUMN first_use_completed_at timestamptz;

-- One Name field (P1 §2.3): trimmed, 1–80 characters, no control characters. The bound is an
-- engineering ceiling the sign-up field enforces as its own maximum length.
ALTER TABLE public.users
    ADD CONSTRAINT users_name_shape_check
    CHECK (name IS NULL OR (name = btrim(name) AND char_length(name) BETWEEN 1 AND 80 AND name !~ '[[:cntrl:]]'));

-- The Login ID grammar (P1 §2.1 leaves the regex to implementation): 3–30 characters of English
-- letters and digits, with `.` `-` `_` allowed only BETWEEN letters and digits. Stored in its
-- canonical lowercase form, so equality IS case-insensitive equality.
ALTER TABLE public.users
    ADD CONSTRAINT users_login_id_shape_check
    CHECK (login_id IS NULL OR (char_length(login_id) BETWEEN 3 AND 30 AND login_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'));

-- Name and Login ID are chosen together at sign-up; an account has both or neither.
ALTER TABLE public.users
    ADD CONSTRAINT users_account_identity_pair_check
    CHECK ((name IS NULL) = (login_id IS NULL));

CREATE UNIQUE INDEX users_login_id_key ON public.users (login_id);

CREATE FUNCTION public.provision_qandeel_account_identity_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_meta jsonb := to_jsonb(NEW) -> 'raw_user_meta_data';
BEGIN
    -- An account created without sign-up values (a legacy or operator-created identity) keeps the
    -- bare row the 0002 trigger made.
    IF v_meta IS NULL OR jsonb_typeof(v_meta) <> 'object'
       OR NOT (v_meta ? 'qandeel_name' OR v_meta ? 'qandeel_login_id') THEN
        RETURN NEW;
    END IF;

    IF jsonb_typeof(v_meta -> 'qandeel_name') IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_meta -> 'qandeel_login_id') IS DISTINCT FROM 'string' THEN
        RAISE EXCEPTION 'account identity sign-up values are malformed' USING ERRCODE = '22023';
    END IF;

    UPDATE public.users
       SET name = btrim(v_meta ->> 'qandeel_name'),
           login_id = lower(v_meta ->> 'qandeel_login_id'),
           updated_at = CURRENT_TIMESTAMP
     WHERE id = NEW.id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'account row was not provisioned' USING ERRCODE = 'P0002';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_qandeel_account_identity_v1() FROM PUBLIC;

-- Fires after `provision_qandeel_user` (0002): same event, and PostgreSQL orders same-event triggers
-- by name.
CREATE TRIGGER provision_qandeel_user_identity
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.provision_qandeel_account_identity_v1();

-- Whether a Login ID can still be chosen. A boolean and nothing else: no account, Email or id is
-- ever returned. A reserved-but-unverified sign-up holds its Login ID (W1B-01 record §6). Reached
-- only by the QANDEEL API's server channel, never by `anon` or a client.
CREATE FUNCTION public.login_id_is_available_v1(p_login_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p_login_id IS NOT NULL
       AND char_length(p_login_id) BETWEEN 3 AND 30
       AND lower(p_login_id) ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
       AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.login_id = lower(p_login_id));
$$;

REVOKE ALL ON FUNCTION public.login_id_is_available_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.login_id_is_available_v1(text) TO service_role;

-- The caller's own first-use facts, under the caller's own row-level security (INVOKER): the Name
-- QANDEEL addresses them by, whether the Welcome step is complete, and whether they have ever
-- committed a turn — which is what consumes the First Conversation Opening. No Login ID, no Email.
CREATE FUNCTION public.read_account_first_use_v1()
RETURNS TABLE (name text, welcome_completed boolean, has_conversed boolean)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT u.name,
           u.first_use_completed_at IS NOT NULL,
           EXISTS (SELECT 1 FROM public.conversation_turns t WHERE t.user_id = u.id AND t.role = 'USER')
      FROM public.users u
     WHERE u.id = (SELECT auth.uid());
$$;

REVOKE ALL ON FUNCTION public.read_account_first_use_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_account_first_use_v1() TO authenticated;

-- Complete the caller's own Welcome step. Idempotent: the first completion time is kept. The only
-- write a client can reach here, and it can reach only its own row; no table UPDATE is granted.
CREATE FUNCTION public.complete_first_use_welcome_v1()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user uuid := (SELECT auth.uid());
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_user) THEN
        RAISE EXCEPTION 'account was not found' USING ERRCODE = 'P0002';
    END IF;
    UPDATE public.users
       SET first_use_completed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
     WHERE id = v_user AND first_use_completed_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_first_use_welcome_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_first_use_welcome_v1() TO authenticated;

COMMIT;
