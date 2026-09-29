-- W3-02 — Account & Identity: the Public ID and its one lifetime manual change (E2E-D-09).
--
-- P1 §6 froze the Product law: every account has a separate, AUTO-GENERATED Public ID / alias,
-- conceptually like `@nightlamp27`; it is unique in its normalized Public-ID namespace; it is the
-- default Public identity; and the account gets exactly ONE lifetime manual change of it. P1 §16.2
-- item 2 left the persistence, namespace and normalization to implementation. This is that
-- implementation, on the canonical account row, `public.users`, beside the Name and Login ID (0123).
--
-- The Public ID is its OWN value. It is not `user_id`, not the Login ID, not the Email, not the Name,
-- not a Shared invitation credential, and not the I-05 internal `public_identity_ref`
-- (`public.public_identities`), which stays the opaque internal Public runtime ref. Nothing here reads,
-- writes or grants anything of the I-05 Public runtime.
--
-- Additive and forward-only. Three columns, two shape rules, one unique index, a backfill, two
-- triggers and two Product functions. Migrations 0001–0124 are untouched.
--
-- ## The grammar (implementation detail, not Product authority)
--
--   stored     without the `@` the Product shows in front of it;
--   shape      3–24 characters of lowercase English letters and digits, starting with a letter, with
--              `.` or `_` allowed only BETWEEN letters and digits (`nightlamp27`, `noor.writes`);
--   normalized a caller's value is trimmed, one leading `@` is dropped, Arabic-Indic and Extended
--              Arabic-Indic digits become 0–9, and it is lowercased. Stored canonical and lowercase, so
--              the unique index IS case-insensitive uniqueness.
--
-- The Public-ID namespace is separate from the Login-ID namespace, deliberately: a Public ID is never
-- compared with any Login ID, so the change command cannot be used to learn anything private.
--
-- ## The one lifetime manual change
--
-- The DATABASE is the authority, not the app: the one change is a row fact (`public_id_changed_at`,
-- `public_id_change_command_id`), and a guard trigger refuses every write to the Public ID that is not
-- exactly "from a never-changed Public ID to a different one, consuming the change" — whoever writes it,
-- the server channel and the table owner included. A second change, un-consuming the change, or
-- changing the Public ID without consuming it are impossible by construction.
BEGIN;

ALTER TABLE public.users
    ADD COLUMN public_id text,
    ADD COLUMN public_id_changed_at timestamptz,
    ADD COLUMN public_id_change_command_id uuid;

-- The canonical shape. It admits only the canonical lowercase form, so equality is case-insensitive.
ALTER TABLE public.users
    ADD CONSTRAINT users_public_id_shape_check
    CHECK (public_id IS NULL OR (char_length(public_id) BETWEEN 3 AND 24 AND public_id ~ '^[a-z][a-z0-9]*([._][a-z0-9]+)*$'));

-- The one lifetime change is ONE fact: when it happened and which command made it, together or neither.
ALTER TABLE public.users
    ADD CONSTRAINT users_public_id_change_pair_check
    CHECK ((public_id_changed_at IS NULL) = (public_id_change_command_id IS NULL));

CREATE UNIQUE INDEX users_public_id_key ON public.users (public_id);

-- The one normalization. Pure; reached only from the functions below.
CREATE FUNCTION public.normalize_public_id_v1(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT lower(translate(regexp_replace(btrim(p_value), '^@', ''),
                           '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
                           '01234567890123456789'));
$$;

-- Whether a normalized value is a well-formed Public ID. The same rule as the shape check.
CREATE FUNCTION public.is_well_formed_public_id_v1(p_value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT p_value IS NOT NULL
       AND char_length(p_value) BETWEEN 3 AND 24
       AND p_value ~ '^[a-z][a-z0-9]*([._][a-z0-9]+)*$';
$$;

-- A fresh, unused Public ID. It takes NO argument and reads nothing of any account except which Public
-- IDs are already held, so it cannot be derived from a Name, Login ID, Email, phone, Shared ID or
-- `user_id`: it is two words from fixed neutral lists and a number, e.g. `quietlamp27`. A candidate that
-- is already held is drawn again, with a wider number as the attempts grow; the bound is a failure, never
-- a fallback.
CREATE FUNCTION public.generate_public_id_v1()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_first constant text[] := ARRAY[
        'amber', 'autumn', 'bright', 'calm', 'cedar', 'clear', 'cobalt', 'coral',
        'dawn', 'early', 'gentle', 'golden', 'hazel', 'ivory', 'jade', 'lucid',
        'mellow', 'misty', 'night', 'noble', 'olive', 'quiet', 'rosy', 'sage',
        'silver', 'slate', 'steady', 'still', 'sunny', 'tidal', 'warm', 'woven'];
    v_second constant text[] := ARRAY[
        'arbor', 'beacon', 'brook', 'candle', 'comet', 'compass', 'delta', 'ember',
        'falcon', 'fern', 'garden', 'harbor', 'heron', 'island', 'lamp', 'lantern',
        'meadow', 'orchard', 'pebble', 'pine', 'quill', 'reed', 'river', 'sparrow',
        'spruce', 'stone', 'summit', 'thistle', 'valley', 'willow', 'window', 'wren'];
    v_attempt integer := 0;
    v_digits integer;
    v_candidate text;
BEGIN
    -- One transaction-scoped lock for the whole Public-ID namespace: a concurrent sign-up or manual change holding a
    -- candidate is waited for and then SEEN, so two draws can never both pass the check and fail an insert on the
    -- unique index. One key, not one per candidate, so a long backfill holds a single lock.
    PERFORM pg_advisory_xact_lock(hashtext('qandeel.public_id.namespace'));
    LOOP
        v_attempt := v_attempt + 1;
        v_digits := CASE WHEN v_attempt <= 8 THEN 2 WHEN v_attempt <= 24 THEN 3 ELSE 4 END;
        v_candidate := v_first[1 + floor(random() * array_length(v_first, 1))::integer]
                    || v_second[1 + floor(random() * array_length(v_second, 1))::integer]
                    || (power(10, v_digits - 1)::integer + floor(random() * 9 * power(10, v_digits - 1))::integer)::text;
        IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.public_id = v_candidate) THEN
            RETURN v_candidate;
        END IF;
        IF v_attempt >= 64 THEN
            RAISE EXCEPTION 'PUBLIC_ID_GENERATION_EXHAUSTED' USING ERRCODE = 'P0001';
        END IF;
    END LOOP;
END;
$$;

-- Backfill: every existing account receives exactly one Public ID, one row at a time, so each draw
-- sees the ones already given (a single UPDATE's subquery would not).
DO $$
DECLARE
    v_account uuid;
BEGIN
    FOR v_account IN SELECT u.id FROM public.users u WHERE u.public_id IS NULL ORDER BY u.id LOOP
        UPDATE public.users SET public_id = public.generate_public_id_v1() WHERE id = v_account;
    END LOOP;
END;
$$;

ALTER TABLE public.users ALTER COLUMN public_id SET NOT NULL;

-- Every future account receives its Public ID from the server, at the moment its row is created,
-- without asking anyone. A supplied value is never trusted: generation is the only source.
CREATE FUNCTION public.assign_public_id_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.public_id := public.generate_public_id_v1();
    NEW.public_id_changed_at := NULL;
    NEW.public_id_change_command_id := NULL;
    RETURN NEW;
END;
$$;

CREATE TRIGGER assign_public_id
    BEFORE INSERT ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_public_id_v1();

-- The one lifetime manual change, as a structural rule. The only admitted write to the Public ID is:
-- a never-changed Public ID, to a different one, consuming the change with its command identity.
CREATE FUNCTION public.guard_public_id_lifetime_change_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.public_id IS NOT DISTINCT FROM OLD.public_id
       AND NEW.public_id_changed_at IS NOT DISTINCT FROM OLD.public_id_changed_at
       AND NEW.public_id_change_command_id IS NOT DISTINCT FROM OLD.public_id_change_command_id THEN
        RETURN NEW;
    END IF;
    IF OLD.public_id_changed_at IS NULL
       AND NEW.public_id_changed_at IS NOT NULL
       AND NEW.public_id_change_command_id IS NOT NULL
       AND NEW.public_id IS DISTINCT FROM OLD.public_id THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'PUBLIC_ID_LIFETIME_CHANGE_VIOLATION' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER guard_public_id_lifetime_change
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_public_id_lifetime_change_v1();

-- The caller's own Public ID and whether the one manual change is still available, under the caller's
-- own row-level security (INVOKER). Nothing else: no id, no Name, no Login ID, no Email, no Public ref.
CREATE FUNCTION public.read_own_public_id_v1()
RETURNS TABLE (current_public_id text, change_available boolean)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT u.public_id, u.public_id_changed_at IS NULL
      FROM public.users u
     WHERE u.id = (SELECT auth.uid());
$$;

-- The caller's own one lifetime manual change. The caller is `auth.uid()` and nothing else: there is no
-- account parameter. It answers a bounded outcome and the caller's own resulting state:
--
--   CHANGED       committed now — or the SAME command replayed after it committed (a lost response is
--                 answered with the committed truth, never turned into a failure);
--   UNCHANGED     the requested value normalizes to the current Public ID: nothing is written, and the
--                 one change is NOT consumed;
--   INVALID       not a well-formed Public ID: nothing is written;
--   ALREADY_USED  the one lifetime change was made by another command: nothing is written;
--   UNAVAILABLE   another account holds it: nothing is written. Nothing about that account is returned.
--
-- A command identity reused for a DIFFERENT value is refused outright (23505), never re-interpreted.
-- The caller's own row is the serialization point, so two concurrent attempts cannot both win; two
-- accounts racing for the same value meet the unique index, and the loser is UNAVAILABLE.
CREATE FUNCTION public.change_own_public_id_v1(p_command_id uuid, p_public_id text)
RETURNS TABLE (outcome text, current_public_id text, change_available boolean)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user uuid := (SELECT auth.uid());
    v_requested text := public.normalize_public_id_v1(p_public_id);
    v_account public.users;
    v_conflict text;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501';
    END IF;
    IF p_command_id IS NULL THEN
        RAISE EXCEPTION 'PUBLIC_ID_COMMAND_INVALID' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_account FROM public.users u WHERE u.id = v_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'account was not found' USING ERRCODE = 'P0002';
    END IF;

    -- The same command again: its committed truth, or a refusal if it now asks for something else.
    IF v_account.public_id_change_command_id = p_command_id THEN
        IF v_account.public_id = v_requested THEN
            RETURN QUERY SELECT 'CHANGED'::text, v_account.public_id, false;
            RETURN;
        END IF;
        RAISE EXCEPTION 'PUBLIC_ID_COMMAND_CONFLICT' USING ERRCODE = '23505';
    END IF;

    IF NOT public.is_well_formed_public_id_v1(v_requested) THEN
        RETURN QUERY SELECT 'INVALID'::text, v_account.public_id, v_account.public_id_changed_at IS NULL;
        RETURN;
    END IF;

    IF v_requested = v_account.public_id THEN
        RETURN QUERY SELECT 'UNCHANGED'::text, v_account.public_id, v_account.public_id_changed_at IS NULL;
        RETURN;
    END IF;

    IF v_account.public_id_changed_at IS NOT NULL THEN
        RETURN QUERY SELECT 'ALREADY_USED'::text, v_account.public_id, false;
        RETURN;
    END IF;

    -- The namespace lock the generator takes: a concurrent generation cannot draw this value mid-commit.
    PERFORM pg_advisory_xact_lock(hashtext('qandeel.public_id.namespace'));
    BEGIN
        UPDATE public.users
           SET public_id = v_requested,
               public_id_changed_at = clock_timestamp(),
               public_id_change_command_id = p_command_id,
               updated_at = CURRENT_TIMESTAMP
         WHERE id = v_user;
    EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_conflict = CONSTRAINT_NAME;
        IF v_conflict = 'users_public_id_key' THEN
            RETURN QUERY SELECT 'UNAVAILABLE'::text, v_account.public_id, true;
            RETURN;
        END IF;
        RAISE;
    END;

    RETURN QUERY SELECT 'CHANGED'::text, v_requested, false;
END;
$$;

-- Default-deny, by name: a hosted project's default privileges can grant EXECUTE on a new public
-- function to `anon` and `authenticated`. The internal helpers are reachable by no client role; the two
-- Product functions by `authenticated` only. No table grant changes: `authenticated` still has no
-- UPDATE, INSERT or DELETE on `public.users`.
REVOKE ALL ON FUNCTION public.normalize_public_id_v1(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_well_formed_public_id_v1(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_public_id_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_public_id_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_public_id_lifetime_change_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_own_public_id_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.change_own_public_id_v1(uuid, text) FROM PUBLIC, anon, authenticated;
-- The server channel needs none of them (the API calls the change on the CALLER's token), so it is refused too,
-- where that role exists.
DO $$BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.normalize_public_id_v1(text), public.is_well_formed_public_id_v1(text), public.generate_public_id_v1(), public.assign_public_id_v1(), public.guard_public_id_lifetime_change_v1(), public.read_own_public_id_v1(), public.change_own_public_id_v1(uuid, text) FROM service_role';
END IF; END$$;
GRANT EXECUTE ON FUNCTION public.read_own_public_id_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_own_public_id_v1(uuid, text) TO authenticated;

COMMIT;
