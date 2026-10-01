-- W3-MEGA-S — Personal Controls & Settings Integration v1: Privacy & Data (E2E-D-16 Export My Data; the
-- PERSONAL-WORLD part of E2E-D-17 Delete Account).
--
-- Product authority: the W3-PDG-01 Product Decision Closure, its statements marked PO only (§7 Export, §8 Delete
-- Account). Nothing below is Product authority of its own; every duration and format is an implementation detail.
--
-- ## What this adds
--
--   1. Export My Data (§7.2): the owner's request, behind the SAME database-enforced re-authentication W3-MEGA-A
--      built (0129 `account_private.has_recent_password_proof_v1`: a provider password authentication inside the
--      last minute, carried by the request's own signed claims). The package is prepared ASYNCHRONOUSLY by the
--      server (a service-role preparation pass), held owner-bound, downloadable in the app only by its owner, and
--      only for a limited period, after which the artifact itself is discarded. Content (§7.3): the Personal world
--      only — account, Personal conversation, Memory (every lifecycle state still held, labelled), and QANDEEL
--      Understanding as statements with their status and the owner's own contests. Shared / Public / Replay /
--      Introductions are NOT YET INCLUDED — WORLD-SCOPED EXPORT AUTHORITY NOT IMPLEMENTED; the package says so.
--   2. Delete Account, Personal world (§8.2 / §8.3): the owner's request behind the same re-authentication; a
--      grace period during which the owner may cancel; then ONE governed, final, transactional Personal erasure run
--      by the server — account row, Personal conversation and every derivative of it, Memory, Understanding,
--      Hypothesis / Confidence / Question history, HIM measurements, Memory-control records and pending exports —
--      after which the provider account is removed by the API (so every session ends).
--   3. The deleted account's Login ID and Public ID are not reused directly (§8.3): each is retired as a one-way
--      digest and refused to every later account through the existing UNAVAILABLE answers.
--
-- ## The controlled erasure boundary (Stage 6.6 ruling; W3-PDG-01 §8.6)
--
-- Stage 6.6 denies physical DELETE of historical canonical rows "unless a separately governed Product erasure policy
-- explicitly owns it"; W3-PDG-01 §8.3 / §8.6 is that policy for the Personal world. Sixteen history guards (0011,
-- 0012 / 0013, 0055, 0063, 0064, 0065, 0066, 0068, 0070, 0071, 0072) are redefined IN PLACE (same name, same OID,
-- still SECURITY INVOKER with an empty search_path; no role may execute one directly — a trigger function is never
-- EXECUTE-checked when it fires, and the four that had kept PUBLIC's default are revoked here). Each keeps its original
-- body byte-for-byte after
-- one prefix that admits a DELETE — never an UPDATE — and only when BOTH hold:
--
--   * the transaction-local setting `qandeel.personal_erasure` equals the CURRENT transaction id; and
--   * an authorization row for that transaction id exists in `personal_data_private.erasure_authorizations`, a
--     table no client or server role can read or write.
--
-- Both are created only inside `personal_data_private.erase_personal_account_v1`, which runs only for a deletion
-- request that is SCHEDULED, re-authenticated when it was made, past its grace period and not cancelled. It is not a
-- generic history-delete: it takes a deletion-request id (never an account id), is executable only by the server
-- role, deletes only rows of that request's account, and every UPDATE path of every guard is unchanged.
--
-- ## HARD STOP — Connected Worlds (QAN-BL-ACCT-01, QAN-BL-CW-01, ASSURE-F05, ASSURE-O04)
--
-- Nothing here touches, deletes or re-guards a Shared, Public, Replay or Matching / Introductions row. The erasure
-- deletes the account row LAST, inside a subtransaction: when any Connected Worlds row still references the account
-- (or its Personal conversation), PostgreSQL's own foreign keys refuse, the whole erasure is rolled back, and the
-- request is marked BLOCKED — never erased and never called deleted. D-17 FULL ACCOUNT DELETION stays BLOCKED BY
-- CONNECTED WORLDS; this migration implements the Personal world only.
--
-- ## Implementation details (not Product authority)
--
--   * Grace period: 7 days. Export availability: 7 days. Preparation lease: 5 minutes; 3 attempts, then FAILED.
--   * The export is one JSON document (`qandeel.personal-data-export.v1`); the owner's Email is added by the API at
--     download from the owner's own provider session (the provider holds it; nothing here stores it).
--   * The deletion request keeps, after completion, only its own ids and timestamps: the record that a deletion was
--     requested and carried out (retry safety and resurrection refusal). The retired identifiers are digests only.
BEGIN;

CREATE SCHEMA personal_data_private;
REVOKE ALL ON SCHEMA personal_data_private FROM PUBLIC;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. State.
-- ---------------------------------------------------------------------------------------------------------------

-- One export request. The artifact lives on the row while READY and is discarded when it expires.
CREATE TABLE personal_data_private.data_exports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    command_id uuid NOT NULL,
    status text NOT NULL,
    requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    attempt_count integer NOT NULL DEFAULT 0,
    lease_until timestamptz,
    prepared_at timestamptz,
    available_until timestamptz,
    content jsonb,
    CONSTRAINT data_exports_command_key UNIQUE (user_id, command_id),
    CONSTRAINT data_exports_status_check CHECK (status IN ('PREPARING', 'READY', 'EXPIRED', 'FAILED')),
    CONSTRAINT data_exports_attempts_check CHECK (attempt_count BETWEEN 0 AND 3),
    CONSTRAINT data_exports_ready_shape CHECK (
        (status = 'READY') = (content IS NOT NULL AND prepared_at IS NOT NULL AND available_until IS NOT NULL)),
    CONSTRAINT data_exports_no_artifact_after_ready CHECK (status = 'READY' OR content IS NULL)
);
-- At most one export in flight or held per account.
CREATE UNIQUE INDEX data_exports_one_active ON personal_data_private.data_exports (user_id)
    WHERE status IN ('PREPARING', 'READY');
CREATE INDEX data_exports_due ON personal_data_private.data_exports (requested_at) WHERE status = 'PREPARING';
ALTER TABLE personal_data_private.data_exports ENABLE ROW LEVEL SECURITY;

-- One deletion request. It deliberately has NO foreign key to the account: it must outlive the erasure, as the
-- minimal non-content record that the deletion was requested and carried out.
CREATE TABLE personal_data_private.account_deletions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    command_id uuid NOT NULL,
    status text NOT NULL,
    requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    final_at timestamptz NOT NULL,
    lease_until timestamptz,
    cancelled_at timestamptz,
    blocked_at timestamptz,
    erased_at timestamptz,
    completed_at timestamptz,
    CONSTRAINT account_deletions_command_key UNIQUE (user_id, command_id),
    CONSTRAINT account_deletions_status_check CHECK (status IN ('SCHEDULED', 'CANCELLED', 'BLOCKED', 'ERASED', 'COMPLETED')),
    CONSTRAINT account_deletions_grace_check CHECK (final_at > requested_at),
    CONSTRAINT account_deletions_cancelled_shape CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL)),
    CONSTRAINT account_deletions_erased_shape CHECK ((status IN ('ERASED', 'COMPLETED')) = (erased_at IS NOT NULL)),
    CONSTRAINT account_deletions_completed_shape CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL))
);
-- At most one live deletion per account.
CREATE UNIQUE INDEX account_deletions_one_live ON personal_data_private.account_deletions (user_id)
    WHERE status IN ('SCHEDULED', 'BLOCKED', 'ERASED', 'COMPLETED');
CREATE INDEX account_deletions_due ON personal_data_private.account_deletions (final_at) WHERE status IN ('SCHEDULED', 'ERASED');
ALTER TABLE personal_data_private.account_deletions ENABLE ROW LEVEL SECURITY;

-- The one-transaction authorization the narrowed history guards consult (§ "controlled erasure boundary").
CREATE TABLE personal_data_private.erasure_authorizations (
    transaction_id bigint PRIMARY KEY,
    deletion_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE personal_data_private.erasure_authorizations ENABLE ROW LEVEL SECURITY;

-- Retired identifiers of deleted accounts: one-way digests, no account link.
CREATE TABLE personal_data_private.retired_account_identifiers (
    digest text PRIMARY KEY,
    retired_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT retired_account_identifiers_digest_check CHECK (digest ~ '^(lid1|pid1):[0-9a-f]{64}$')
);
ALTER TABLE personal_data_private.retired_account_identifiers ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Retired identifiers are not reused directly (W3-PDG-01 §8.3).
-- ---------------------------------------------------------------------------------------------------------------

CREATE FUNCTION personal_data_private.identifier_digest_v1(p_kind text, p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT CASE WHEN p_value IS NULL THEN NULL
                ELSE p_kind || ':' || pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.lower(p_value), 'UTF8')), 'hex')
           END;
$$;

CREATE FUNCTION personal_data_private.identifier_is_retired_v1(p_kind text, p_value text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM personal_data_private.retired_account_identifiers r
         WHERE r.digest = personal_data_private.identifier_digest_v1(p_kind, p_value));
$$;

-- A retired Login ID or Public ID answers exactly like a held one: the existing unique-violation answers
-- (0125 / 0129 UNAVAILABLE) read the constraint name, so the refusal names that constraint. A row for an erased
-- account can never be created again.
CREATE FUNCTION personal_data_private.refuse_retired_account_identifier_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'INSERT' AND EXISTS (
        SELECT 1 FROM personal_data_private.account_deletions d
         WHERE d.user_id = NEW.id AND d.status IN ('ERASED', 'COMPLETED')) THEN
        RAISE EXCEPTION 'ACCOUNT_WAS_DELETED' USING ERRCODE = '42501';
    END IF;
    IF NEW.login_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.login_id IS DISTINCT FROM OLD.login_id)
       AND personal_data_private.identifier_is_retired_v1('lid1', NEW.login_id) THEN
        RAISE EXCEPTION 'LOGIN_ID_RETIRED' USING ERRCODE = '23505', CONSTRAINT = 'users_login_id_key';
    END IF;
    IF NEW.public_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.public_id IS DISTINCT FROM OLD.public_id)
       AND personal_data_private.identifier_is_retired_v1('pid1', NEW.public_id) THEN
        RAISE EXCEPTION 'PUBLIC_ID_RETIRED' USING ERRCODE = '23505', CONSTRAINT = 'users_public_id_key';
    END IF;
    RETURN NEW;
END;
$$;

-- Named to fire after `assign_public_id` and `guard_public_id_lifetime_change` (same-event triggers run by name),
-- so it judges the values those two decided.
CREATE TRIGGER refuse_retired_account_identifier
    BEFORE INSERT OR UPDATE OF login_id, public_id ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION personal_data_private.refuse_retired_account_identifier_v1();

-- 0125's generator, unchanged except that it also never draws a retired Public ID (so a sign-up never fails on one).
CREATE OR REPLACE FUNCTION account_private.generate_public_id_v1(p_excluded text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
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
        IF v_candidate IS DISTINCT FROM p_excluded
           AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.public_id = v_candidate)
           AND NOT personal_data_private.identifier_is_retired_v1('pid1', v_candidate) THEN
            RETURN v_candidate;
        END IF;
        IF v_attempt >= 64 THEN
            RAISE EXCEPTION 'PUBLIC_ID_GENERATION_EXHAUSTED' USING ERRCODE = 'P0001';
        END IF;
    END LOOP;
END;
$$;

-- 0123's availability answer, unchanged except that a retired Login ID is not available.
CREATE OR REPLACE FUNCTION public.login_id_is_available_v1(p_login_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p_login_id IS NOT NULL
       AND char_length(p_login_id) BETWEEN 3 AND 30
       AND lower(p_login_id) ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
       AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.login_id = lower(p_login_id))
       AND NOT personal_data_private.identifier_is_retired_v1('lid1', p_login_id);
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. The narrowed history guards.
-- ---------------------------------------------------------------------------------------------------------------

-- Whether THIS transaction is the governed Personal erasure. INVOKER: only the erasure's owner can read the table,
-- and the guards reach this only after the transaction-bound setting already matched.
CREATE FUNCTION personal_data_private.personal_erasure_authorized_v1()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM personal_data_private.erasure_authorizations a
         WHERE a.transaction_id = pg_catalog.txid_current());
$$;

CREATE OR REPLACE FUNCTION public.reject_him_runtime_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN
  -- W3-MEGA-S (0130): the governed Personal erasure alone may DELETE; nothing else changes.
  IF TG_OP = 'DELETE' THEN
    IF pg_catalog.current_setting('qandeel.personal_erasure', true) = pg_catalog.txid_current()::text THEN
      IF personal_data_private.personal_erasure_authorized_v1() THEN RETURN OLD; END IF;
    END IF;
  END IF;
  RAISE EXCEPTION 'HIM calculation/calibration history is immutable' USING ERRCODE='55000';END$$;

CREATE OR REPLACE FUNCTION public.reject_him_energy_immutable_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN
  -- W3-MEGA-S (0130): the governed Personal erasure alone may DELETE; nothing else changes.
  IF TG_OP = 'DELETE' THEN
    IF pg_catalog.current_setting('qandeel.personal_erasure', true) = pg_catalog.txid_current()::text THEN
      IF personal_data_private.personal_erasure_authorized_v1() THEN RETURN OLD; END IF;
    END IF;
  END IF;
  RAISE EXCEPTION 'HIM Energy canonical history is immutable' USING ERRCODE='55000';END$$;

CREATE OR REPLACE FUNCTION public.guard_him_session_context_binding_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN
 -- W3-MEGA-S (0130): the governed Personal erasure alone may DELETE; nothing else changes.
 IF TG_OP = 'DELETE' THEN
   IF pg_catalog.current_setting('qandeel.personal_erasure', true) = pg_catalog.txid_current()::text THEN
     IF personal_data_private.personal_erasure_authorized_v1() THEN RETURN OLD; END IF;
   END IF;
 END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Session context binding history is immutable' USING ERRCODE='55000';END IF;
 IF coalesce(current_setting('qandeel.session_context_binding_transition',true),'')<>'authorized'
  OR OLD.status<>'ACTIVE' OR NEW.status<>'RETIRED' OR NEW.retired_at IS NULL
  OR (to_jsonb(OLD)-'status'-'retired_at')<>(to_jsonb(NEW)-'status'-'retired_at')
 THEN RAISE EXCEPTION 'Session context binding mutation requires the protected ACTIVE to RETIRED lifecycle transition' USING ERRCODE='42501';END IF;
 RETURN NEW;END$$;

CREATE OR REPLACE FUNCTION public.guard_information_gap_lifecycle_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN
 -- W3-MEGA-S (0130): the governed Personal erasure alone may DELETE; nothing else changes.
 IF TG_OP = 'DELETE' THEN
   IF pg_catalog.current_setting('qandeel.personal_erasure', true) = pg_catalog.txid_current()::text THEN
     IF personal_data_private.personal_erasure_authorized_v1() THEN RETURN OLD; END IF;
   END IF;
 END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Information gap history is immutable' USING ERRCODE='55000';END IF;
 IF coalesce(current_setting('qandeel.information_gap_lifecycle_transition',true),'')<>'authorized'
  OR NOT (
    (OLD.status='OPEN' AND NEW.status IN ('RESOLVED','SUPERSEDED') AND NEW.closed_at IS NOT NULL AND NEW.closure_reason IS NOT NULL AND NEW.open_epoch=OLD.open_epoch)
    OR (OLD.status IN ('RESOLVED','SUPERSEDED') AND NEW.status='OPEN' AND NEW.closed_at IS NULL AND NEW.closure_reason IS NULL AND NEW.open_epoch=OLD.open_epoch+1)
  )
  OR (to_jsonb(OLD)-'status'-'closed_at'-'closure_reason'-'open_epoch'-'updated_at')<>(to_jsonb(NEW)-'status'-'closed_at'-'closure_reason'-'open_epoch'-'updated_at')
 THEN RAISE EXCEPTION 'Information gap mutation requires a protected canonical lifecycle transition' USING ERRCODE='42501';END IF;
 RETURN NEW;END$$;

CREATE OR REPLACE FUNCTION public.guard_formal_question_turn_binding_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN
 -- W3-MEGA-S (0130): the governed Personal erasure alone may DELETE; nothing else changes.
 IF TG_OP = 'DELETE' THEN
   IF pg_catalog.current_setting('qandeel.personal_erasure', true) = pg_catalog.txid_current()::text THEN
     IF personal_data_private.personal_erasure_authorized_v1() THEN RETURN OLD; END IF;
   END IF;
 END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Formal question binding history is immutable' USING ERRCODE='55000';END IF;
 IF coalesce(current_setting('qandeel.formal_question_binding_transition',true),'')<>'authorized'
  OR OLD.state<>'SELECTED'
  OR NOT (
    (NEW.state='BOUND' AND NEW.assistant_turn_id IS NOT NULL AND NEW.bound_at IS NOT NULL AND NEW.released_at IS NULL
      AND (to_jsonb(OLD)-'state'-'assistant_turn_id'-'bound_at')=(to_jsonb(NEW)-'state'-'assistant_turn_id'-'bound_at'))
    OR (NEW.state='RELEASED' AND NEW.released_at IS NOT NULL AND NEW.assistant_turn_id IS NULL AND NEW.bound_at IS NULL
      AND (to_jsonb(OLD)-'state'-'released_at')=(to_jsonb(NEW)-'state'-'released_at'))
  )
 THEN RAISE EXCEPTION 'Formal question binding mutation requires a protected SELECTED consumption or release transition' USING ERRCODE='42501';END IF;
 RETURN NEW;END$$;

CREATE OR REPLACE FUNCTION public.reject_committed_conversational_unit_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  -- W3-MEGA-S (0130): the governed Personal erasure alone may DELETE; nothing else changes.
  IF TG_OP = 'DELETE' THEN
    IF pg_catalog.current_setting('qandeel.personal_erasure', true) = pg_catalog.txid_current()::text THEN
      IF personal_data_private.personal_erasure_authorized_v1() THEN RETURN OLD; END IF;
    END IF;
  END IF;
  RAISE EXCEPTION 'COMMITTED_CONVERSATIONAL_UNIT_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='Committed conversational source is append-only: UPDATE and DELETE are refused for every role, including the table owner.';
END;$$;

CREATE OR REPLACE FUNCTION public.reject_conversation_unit_commit_event_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  -- W3-MEGA-S (0130): the governed Personal erasure alone may DELETE; nothing else changes.
  IF TG_OP = 'DELETE' THEN
    IF pg_catalog.current_setting('qandeel.personal_erasure', true) = pg_catalog.txid_current()::text THEN
      IF personal_data_private.personal_erasure_authorized_v1() THEN RETURN OLD; END IF;
    END IF;
  END IF;
  RAISE EXCEPTION 'CONVERSATIONAL_UNITS_COMMITTED_EVENT_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='A committed-CU delivery event is append-only: UPDATE and DELETE are refused for every role, including the table owner.';
END;$$;

CREATE OR REPLACE FUNCTION public.reject_conversation_focus_semantic_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  -- W3-MEGA-S (0130): the governed Personal erasure alone may DELETE; nothing else changes.
  IF TG_OP = 'DELETE' THEN
    IF pg_catalog.current_setting('qandeel.personal_erasure', true) = pg_catalog.txid_current()::text THEN
      IF personal_data_private.personal_erasure_authorized_v1() THEN RETURN OLD; END IF;
    END IF;
  END IF;
  RAISE EXCEPTION 'CONVERSATIONAL_FOCUS_SEMANTIC_ROW_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='Reference, claim and Emerging Focus semantics are append-only historical truth: UPDATE and DELETE are refused for every role, including the table owner.';
END;$$;

CREATE OR REPLACE FUNCTION public.reject_conversation_thread_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  -- W3-MEGA-S (0130): the governed Personal erasure alone may DELETE; nothing else changes.
  IF TG_OP = 'DELETE' THEN
    IF pg_catalog.current_setting('qandeel.personal_erasure', true) = pg_catalog.txid_current()::text THEN
      IF personal_data_private.personal_erasure_authorized_v1() THEN RETURN OLD; END IF;
    END IF;
  END IF;
  RAISE EXCEPTION 'CANONICAL_THREAD_ROW_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='Thread identity, its permanent Home, the establishment event, its evidence and its Conversational Origin provenance are append-only permanent truth: UPDATE and DELETE are refused for every role, including the table owner.';
END;$$;

CREATE OR REPLACE FUNCTION public.guard_conversation_world_thread_identity_clock_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  -- W3-MEGA-S (0130): the governed Personal erasure alone may DELETE; nothing else changes.
  IF TG_OP = 'DELETE' THEN
    IF pg_catalog.current_setting('qandeel.personal_erasure', true) = pg_catalog.txid_current()::text THEN
      IF personal_data_private.personal_erasure_authorized_v1() THEN RETURN OLD; END IF;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'WORLD_THREAD_IDENTITY_CLOCK_IS_PERMANENT' USING ERRCODE='55000',
      DETAIL='The user/world Thread identity version is a permanent technical row: DELETE is refused for every role.';
  END IF;
  IF NEW.user_id <> OLD.user_id OR NEW.created_at <> OLD.created_at OR NEW.current_version <> OLD.current_version + 1 THEN
    RAISE EXCEPTION 'WORLD_THREAD_IDENTITY_CLOCK_IS_MONOTONIC' USING ERRCODE='55000',
      DETAIL='The user/world Thread identity version only ever advances by exactly one; nothing else on the row may change.';
  END IF;
  RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION public.reject_conversation_thread_lifecycle_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  -- W3-MEGA-S (0130): the governed Personal erasure alone may DELETE; nothing else changes.
  IF TG_OP = 'DELETE' THEN
    IF pg_catalog.current_setting('qandeel.personal_erasure', true) = pg_catalog.txid_current()::text THEN
      IF personal_data_private.personal_erasure_authorized_v1() THEN RETURN OLD; END IF;
    END IF;
  END IF;
  RAISE EXCEPTION 'CANONICAL_THREAD_LIFECYCLE_ROW_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='Focus bindings, identity evidence, lifecycle transitions and the final Thread-layer capture are append-only truth: UPDATE and DELETE are refused for every role, including the table owner. There is no rebind, no merge and no repair path.';
END;$$;

CREATE OR REPLACE FUNCTION public.reject_conversation_live_focus_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  -- W3-MEGA-S (0130): the governed Personal erasure alone may DELETE; nothing else changes.
  IF TG_OP = 'DELETE' THEN
    IF pg_catalog.current_setting('qandeel.personal_erasure', true) = pg_catalog.txid_current()::text THEN
      IF personal_data_private.personal_erasure_authorized_v1() THEN RETURN OLD; END IF;
    END IF;
  END IF;
  RAISE EXCEPTION 'CANONICAL_LIVE_FOCUS_ROW_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='LF transitions and the technical LF capture are append-only truth: UPDATE and DELETE are refused for every role, including the table owner. There is no repair, no rewrite and no backdating path.';
END;$$;

CREATE OR REPLACE FUNCTION public.guard_historical_world_semantic_clock_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  -- W3-MEGA-S (0130): the governed Personal erasure alone may DELETE; nothing else changes.
  IF TG_OP = 'DELETE' THEN
    IF pg_catalog.current_setting('qandeel.personal_erasure', true) = pg_catalog.txid_current()::text THEN
      IF personal_data_private.personal_erasure_authorized_v1() THEN RETURN OLD; END IF;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'WORLD_SEMANTIC_CLOCK_IS_PERMANENT' USING ERRCODE='55000',
      DETAIL='The user/world semantic version is a permanent technical row: DELETE is refused for every role.';
  END IF;
  IF NEW.user_id <> OLD.user_id OR NEW.current_version <> OLD.current_version + 1 THEN
    RAISE EXCEPTION 'WORLD_SEMANTIC_CLOCK_IS_MONOTONIC' USING ERRCODE='55000',
      DETAIL='The user/world semantic version only ever advances by exactly one; nothing else on the row may change.';
  END IF;
  RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION public.guard_thread_reading_binding_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  -- W3-MEGA-S (0130): the governed Personal erasure alone may DELETE; nothing else changes.
  IF TG_OP = 'DELETE' THEN
    IF pg_catalog.current_setting('qandeel.personal_erasure', true) = pg_catalog.txid_current()::text THEN
      IF personal_data_private.personal_erasure_authorized_v1() THEN RETURN OLD; END IF;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'CANONICAL_THREAD_READING_BINDING_IS_IMMUTABLE' USING ERRCODE='55000',
      DETAIL='A Thread <-> Reading appearance is canonical history: DELETE is refused for every role.';
  END IF;
  IF OLD.unbound_sp IS NOT NULL
     OR NEW.unbound_sp IS NULL
     OR (to_jsonb(OLD) - 'unbound_sp' - 'unbound_event_sequence') <> (to_jsonb(NEW) - 'unbound_sp' - 'unbound_event_sequence') THEN
    RAISE EXCEPTION 'CANONICAL_THREAD_READING_BINDING_IS_IMMUTABLE' USING ERRCODE='55000',
      DETAIL='The only permitted change of a Thread <-> Reading appearance is its ONE unbind transition.';
  END IF;
  RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION public.reject_historical_projection_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  -- W3-MEGA-S (0130): the governed Personal erasure alone may DELETE; nothing else changes.
  IF TG_OP = 'DELETE' THEN
    IF pg_catalog.current_setting('qandeel.personal_erasure', true) = pg_catalog.txid_current()::text THEN
      IF personal_data_private.personal_erasure_authorized_v1() THEN RETURN OLD; END IF;
    END IF;
  END IF;
  RAISE EXCEPTION 'CANONICAL_HISTORICAL_ROW_IS_IMMUTABLE' USING ERRCODE='55000',
    DETAIL=format('%s is append-only SP-native history: UPDATE and DELETE are refused for every role.', TG_TABLE_NAME);
END;$$;

CREATE OR REPLACE FUNCTION public.guard_historical_canonical_row_preservation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  mutable text[];
  before jsonb;
  after jsonb;
  col text;
BEGIN
  -- W3-MEGA-S (0130): the governed Personal erasure alone may DELETE; nothing else changes.
  IF TG_OP = 'DELETE' THEN
    IF pg_catalog.current_setting('qandeel.personal_erasure', true) = pg_catalog.txid_current()::text THEN
      IF personal_data_private.personal_erasure_authorized_v1() THEN RETURN OLD; END IF;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'CANONICAL_HISTORICAL_ROW_IS_PRESERVED' USING ERRCODE='55000',
      DETAIL=format('%s rows are canonical history read by historical projection: physical DELETE is refused for every role. Lifecycle deletion is a status transition.', TG_TABLE_NAME);
  END IF;
  mutable := CASE TG_TABLE_NAME
    WHEN 'hypotheses' THEN ARRAY['status', 'version', 'updated_at', 'supporting_evidence_ids', 'contradicting_evidence_ids', 'competing_hypothesis_ids']
    WHEN 'memories' THEN ARRAY['status', 'updated_at']
    ELSE ARRAY['updated_at']
  END;
  before := to_jsonb(OLD);
  after := to_jsonb(NEW);
  FOREACH col IN ARRAY mutable LOOP
    before := before - col;
    after := after - col;
  END LOOP;
  IF before <> after THEN
    RAISE EXCEPTION 'CANONICAL_HISTORICAL_FIELD_IS_IMMUTABLE' USING ERRCODE='55000',
      DETAIL=format('%s: a historical field may never be rewritten in place; the frozen lifecycle columns are the only mutable columns.', TG_TABLE_NAME);
  END IF;
  RETURN NEW;
END;$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. The export package: the Personal world, in a form the owner can read. No internal id, idempotency key,
--    routing, score, evidence reference, hypothesis reasoning, measurement or other person's material.
-- ---------------------------------------------------------------------------------------------------------------
CREATE FUNCTION personal_data_private.build_personal_export_v1(p_subject uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'format', 'qandeel.personal-data-export.v1',
        'preparedAt', clock_timestamp(),
        'account', (
            SELECT jsonb_build_object(
                'name', u.name,
                'loginId', u.login_id,
                'publicId', u.public_id,
                'accountCreatedAt', u.created_at)
              FROM public.users u WHERE u.id = p_subject),
        'conversations', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'startedAt', s.created_at,
                       'lastActivityAt', s.last_activity_at,
                       'turns', coalesce((
                           SELECT jsonb_agg(jsonb_build_object(
                                      'speaker', CASE t.role WHEN 'USER' THEN 'you' ELSE 'qandeel' END,
                                      'text', t.content,
                                      'at', t.created_at,
                                      'state', lower(t.status))
                                  ORDER BY t.created_at, t.id)
                             FROM public.conversation_turns t
                            WHERE t.session_id = s.id AND t.user_id = p_subject
                              AND (t.role = 'USER' OR (t.role = 'ASSISTANT' AND t.status = 'COMPLETED'))), '[]'::jsonb))
                   ORDER BY s.created_at, s.id)
              FROM public.conversation_sessions s WHERE s.user_id = p_subject), '[]'::jsonb),
        'memory', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'text', m.content,
                       'kind', lower(m.type),
                       'state', CASE m.status WHEN 'ACTIVE' THEN 'active'
                                              WHEN 'DISABLED' THEN 'not relied on'
                                              WHEN 'DELETED' THEN 'forgotten'
                                              WHEN 'SUPERSEDED' THEN 'replaced by a correction'
                                              ELSE lower(m.status) END,
                       'rememberedAt', m.created_at,
                       'lastChangedAt', m.updated_at,
                       'expiresAt', m.expires_at)
                   ORDER BY m.created_at, m.id)
              FROM public.memories m WHERE m.user_id = p_subject), '[]'::jsonb),
        'understanding', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                       'statement', h.statement,
                       'status', CASE WHEN h.status IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK') THEN 'current'
                                      WHEN h.status = 'REOPENED' THEN 'being reconsidered'
                                      ELSE 'withdrawn' END,
                       'firstFormedAt', h.created_at,
                       'lastChangedAt', h.updated_at,
                       'yourDisagreements', coalesce((
                           SELECT jsonb_agg(c.created_at ORDER BY c.created_at)
                             FROM public.understanding_contests c
                            WHERE c.hypothesis_id = h.id AND c.user_id = p_subject), '[]'::jsonb))
                   ORDER BY h.created_at, h.id)
              FROM public.hypotheses h
             WHERE h.user_id = p_subject
               -- Only an interpretation the owner could have been shown: current now (the statuses the Understanding
               -- surface lists), or current at some point before it was reconsidered or withdrawn. A CANDIDATE, or one
               -- withdrawn before it was ever admitted, is QANDEEL's own unshown reasoning (hypothesis restraint).
               AND (h.status IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK')
                    OR (h.status IN ('REOPENED', 'REJECTED', 'RETIRED')
                        AND EXISTS (SELECT 1 FROM public.hypothesis_lifecycle_transitions t
                                     WHERE t.hypothesis_id = h.id AND t.user_id = p_subject
                                       AND t.after_status IN ('ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK'))))), '[]'::jsonb),
        'notYetIncluded', jsonb_build_array('shared', 'public', 'replay', 'introductions'));
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. The owner's acts. The caller is `auth.uid()` and nothing else: no account parameter anywhere.
-- ---------------------------------------------------------------------------------------------------------------

-- The owner's Privacy & Data state. Export: NONE | PREPARING | READY | EXPIRED | FAILED. Deletion: NONE |
-- SCHEDULED (cancellable until final_at) | FINALIZING (the grace period has passed) | BLOCKED (Connected Worlds).
CREATE FUNCTION personal_data_private.read_own_privacy_state_v1()
RETURNS TABLE (export_status text, export_available_until timestamptz, deletion_status text, deletion_final_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user uuid := (SELECT auth.uid());
    v_export personal_data_private.data_exports;
    v_deletion personal_data_private.account_deletions;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_export FROM personal_data_private.data_exports e
     WHERE e.user_id = v_user ORDER BY e.requested_at DESC, e.id DESC LIMIT 1;
    SELECT * INTO v_deletion FROM personal_data_private.account_deletions d
     WHERE d.user_id = v_user AND d.status IN ('SCHEDULED', 'BLOCKED', 'ERASED', 'COMPLETED') LIMIT 1;
    RETURN QUERY SELECT
        CASE WHEN v_export.id IS NULL THEN 'NONE'
             WHEN v_export.status = 'READY' AND v_export.available_until <= clock_timestamp() THEN 'EXPIRED'
             ELSE v_export.status END,
        CASE WHEN v_export.status = 'READY' AND v_export.available_until > clock_timestamp() THEN v_export.available_until END,
        CASE WHEN v_deletion.id IS NULL THEN 'NONE'
             WHEN v_deletion.status = 'SCHEDULED' AND v_deletion.final_at > clock_timestamp() THEN 'SCHEDULED'
             WHEN v_deletion.status = 'BLOCKED' THEN 'BLOCKED'
             ELSE 'FINALIZING' END,
        v_deletion.final_at;
END;
$$;

-- Request an export. Re-authentication is demanded here (0129's proof) before anything is read or written. An
-- export already PREPARING or READY is the answer; otherwise a new one starts PREPARING. A replayed command answers
-- its own request's current state.
CREATE FUNCTION personal_data_private.request_own_data_export_v1(p_command_id uuid)
RETURNS TABLE (outcome text, export_status text, available_until timestamptz)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user uuid := (SELECT auth.uid());
    v_export personal_data_private.data_exports;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501';
    END IF;
    IF NOT account_private.has_recent_password_proof_v1() THEN
        RAISE EXCEPTION 'DATA_EXPORT_REAUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
    END IF;
    IF p_command_id IS NULL THEN
        RAISE EXCEPTION 'a command identity is required' USING ERRCODE = '22023';
    END IF;
    PERFORM 1 FROM public.users u WHERE u.id = v_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'account was not found' USING ERRCODE = 'P0002';
    END IF;

    -- Expire a held artifact whose time is up before judging what is held.
    UPDATE personal_data_private.data_exports e
       SET status = 'EXPIRED', content = NULL
     WHERE e.user_id = v_user AND e.status = 'READY' AND e.available_until <= clock_timestamp();

    SELECT * INTO v_export FROM personal_data_private.data_exports e
     WHERE e.user_id = v_user AND e.command_id = p_command_id;
    IF v_export.id IS NULL THEN
        SELECT * INTO v_export FROM personal_data_private.data_exports e
         WHERE e.user_id = v_user AND e.status IN ('PREPARING', 'READY');
    END IF;
    IF v_export.id IS NULL THEN
        INSERT INTO personal_data_private.data_exports (user_id, command_id, status)
        VALUES (v_user, p_command_id, 'PREPARING')
        RETURNING * INTO v_export;
    END IF;
    RETURN QUERY SELECT 'ACCEPTED'::text,
        CASE WHEN v_export.status = 'READY' AND v_export.available_until <= clock_timestamp() THEN 'EXPIRED' ELSE v_export.status END,
        CASE WHEN v_export.status = 'READY' AND v_export.available_until > clock_timestamp() THEN v_export.available_until END;
END;
$$;

-- The owner's ready package, and only while it is available. Anything else answers its status and no content.
CREATE FUNCTION personal_data_private.read_own_data_export_v1()
RETURNS TABLE (export_status text, available_until timestamptz, content jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user uuid := (SELECT auth.uid());
    v_export personal_data_private.data_exports;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_export FROM personal_data_private.data_exports e
     WHERE e.user_id = v_user ORDER BY e.requested_at DESC, e.id DESC LIMIT 1;
    IF v_export.id IS NULL THEN
        RETURN QUERY SELECT 'NONE'::text, NULL::timestamptz, NULL::jsonb;
    ELSIF v_export.status = 'READY' AND v_export.available_until > clock_timestamp() THEN
        RETURN QUERY SELECT 'READY'::text, v_export.available_until, v_export.content;
    ELSIF v_export.status = 'READY' THEN
        RETURN QUERY SELECT 'EXPIRED'::text, NULL::timestamptz, NULL::jsonb;
    ELSE
        RETURN QUERY SELECT v_export.status, NULL::timestamptz, NULL::jsonb;
    END IF;
END;
$$;

-- Request the deletion of the owner's account. Re-authentication first. A live request (scheduled or blocked) is
-- the answer; otherwise the grace period starts now. A replayed command answers its own request's current state.
CREATE FUNCTION personal_data_private.request_own_account_deletion_v1(p_command_id uuid)
RETURNS TABLE (outcome text, deletion_status text, final_at timestamptz)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user uuid := (SELECT auth.uid());
    v_deletion personal_data_private.account_deletions;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501';
    END IF;
    IF NOT account_private.has_recent_password_proof_v1() THEN
        RAISE EXCEPTION 'ACCOUNT_DELETION_REAUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
    END IF;
    IF p_command_id IS NULL THEN
        RAISE EXCEPTION 'a command identity is required' USING ERRCODE = '22023';
    END IF;
    -- The account row first, then the request: the same lock order as cancellation and the erasure.
    PERFORM 1 FROM public.users u WHERE u.id = v_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'account was not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_deletion FROM personal_data_private.account_deletions d
     WHERE d.user_id = v_user AND d.command_id = p_command_id;
    IF v_deletion.id IS NULL OR v_deletion.status = 'CANCELLED' THEN
        SELECT * INTO v_deletion FROM personal_data_private.account_deletions d
         WHERE d.user_id = v_user AND d.status IN ('SCHEDULED', 'BLOCKED', 'ERASED', 'COMPLETED');
    END IF;
    IF v_deletion.id IS NULL THEN
        IF EXISTS (SELECT 1 FROM personal_data_private.account_deletions d
                    WHERE d.user_id = v_user AND d.command_id = p_command_id) THEN
            -- This command was already spent on a request the owner cancelled: a replay never re-schedules it.
            RETURN QUERY SELECT 'CANCELLED'::text, 'NONE'::text, NULL::timestamptz;
            RETURN;
        END IF;
        INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, final_at)
        VALUES (v_user, p_command_id, 'SCHEDULED', clock_timestamp() + interval '7 days')
        RETURNING * INTO v_deletion;
    END IF;
    RETURN QUERY SELECT 'ACCEPTED'::text,
        CASE WHEN v_deletion.status = 'SCHEDULED' AND v_deletion.final_at > clock_timestamp() THEN 'SCHEDULED'
             WHEN v_deletion.status = 'BLOCKED' THEN 'BLOCKED'
             ELSE 'FINALIZING' END,
        v_deletion.final_at;
END;
$$;

-- Cancel a scheduled (or blocked) deletion while it is still cancellable. After the grace period the deletion is
-- final and cannot be cancelled (W3-PDG-01 §8.2). No re-authentication: cancelling only keeps the account.
CREATE FUNCTION personal_data_private.cancel_own_account_deletion_v1()
RETURNS TABLE (outcome text, deletion_status text, final_at timestamptz)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user uuid := (SELECT auth.uid());
    v_deletion personal_data_private.account_deletions;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501';
    END IF;
    PERFORM 1 FROM public.users u WHERE u.id = v_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'account was not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO v_deletion FROM personal_data_private.account_deletions d
     WHERE d.user_id = v_user AND d.status IN ('SCHEDULED', 'BLOCKED', 'ERASED', 'COMPLETED')
       FOR UPDATE;
    IF v_deletion.id IS NULL THEN
        RETURN QUERY SELECT 'NONE'::text, 'NONE'::text, NULL::timestamptz;
        RETURN;
    END IF;
    IF v_deletion.status = 'BLOCKED'
       OR (v_deletion.status = 'SCHEDULED' AND v_deletion.final_at > clock_timestamp()) THEN
        UPDATE personal_data_private.account_deletions d
           SET status = 'CANCELLED', cancelled_at = clock_timestamp(), lease_until = NULL
         WHERE d.id = v_deletion.id;
        RETURN QUERY SELECT 'CANCELLED'::text, 'NONE'::text, NULL::timestamptz;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'NOT_CANCELLABLE'::text, 'FINALIZING'::text, v_deletion.final_at;
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 6. The server's passes (service role only).
-- ---------------------------------------------------------------------------------------------------------------

-- Prepare pending exports and discard expired artifacts. Each preparation is its own subtransaction: a failure is
-- counted and retried after a short backoff, and after three attempts the request is FAILED. A partial artifact is
-- never stored: the package is one value written with READY in the same statement.
CREATE FUNCTION personal_data_private.prepare_data_exports_v1(p_limit integer)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_export personal_data_private.data_exports;
    v_prepared integer := 0;
BEGIN
    UPDATE personal_data_private.data_exports e
       SET status = 'EXPIRED', content = NULL
     WHERE e.status = 'READY' AND e.available_until <= clock_timestamp();

    FOR v_export IN
        SELECT * FROM personal_data_private.data_exports e
         WHERE e.status = 'PREPARING' AND (e.lease_until IS NULL OR e.lease_until <= clock_timestamp())
         ORDER BY e.requested_at, e.id
         LIMIT greatest(1, least(coalesce(p_limit, 1), 20))
           FOR UPDATE SKIP LOCKED
    LOOP
        UPDATE personal_data_private.data_exports e
           SET attempt_count = e.attempt_count + 1, lease_until = clock_timestamp() + interval '5 minutes'
         WHERE e.id = v_export.id;
        BEGIN
            UPDATE personal_data_private.data_exports e
               SET status = 'READY',
                   content = personal_data_private.build_personal_export_v1(e.user_id),
                   prepared_at = clock_timestamp(),
                   available_until = clock_timestamp() + interval '7 days',
                   lease_until = NULL
             WHERE e.id = v_export.id;
            v_prepared := v_prepared + 1;
        EXCEPTION WHEN OTHERS THEN
            UPDATE personal_data_private.data_exports e
               SET status = CASE WHEN e.attempt_count >= 3 THEN 'FAILED' ELSE 'PREPARING' END,
                   lease_until = CASE WHEN e.attempt_count >= 3 THEN NULL ELSE clock_timestamp() + interval '1 minute' END
             WHERE e.id = v_export.id;
        END;
    END LOOP;
    RETURN v_prepared;
END;
$$;

-- Claim the deletions the server must advance now: SCHEDULED past their grace period, and ERASED ones whose
-- provider account removal is still to be confirmed. A claim is a short lease, so two servers never advance the
-- same request together and a crashed pass is picked up again.
CREATE FUNCTION personal_data_private.claim_due_account_deletions_v1(p_limit integer)
RETURNS TABLE (deletion_id uuid, user_id uuid, deletion_status text)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_deletion personal_data_private.account_deletions;
BEGIN
    FOR v_deletion IN
        SELECT * FROM personal_data_private.account_deletions d
         WHERE ((d.status = 'SCHEDULED' AND d.final_at <= clock_timestamp()) OR d.status = 'ERASED')
           AND (d.lease_until IS NULL OR d.lease_until <= clock_timestamp())
         ORDER BY d.final_at, d.id
         LIMIT greatest(1, least(coalesce(p_limit, 1), 20))
           FOR UPDATE SKIP LOCKED
    LOOP
        UPDATE personal_data_private.account_deletions d
           SET lease_until = clock_timestamp() + interval '5 minutes'
         WHERE d.id = v_deletion.id;
        RETURN QUERY SELECT v_deletion.id, v_deletion.user_id, v_deletion.status;
    END LOOP;
END;
$$;

-- THE governed Personal erasure. It runs only for a SCHEDULED request past its grace period, and it is final: the
-- account row and every Personal-world row of that account are deleted in ONE transaction, or nothing is.
-- Outcomes: ERASED | BLOCKED (a Connected Worlds row still references the account) | ALREADY_ERASED | NOT_DUE |
-- CANCELLED | UNKNOWN. Safe to retry: each outcome is judged again from the committed request under its locks. For an
-- ERASED request it sweeps the provider-referenced HIM rows again (see below) and answers ALREADY_ERASED.
CREATE FUNCTION personal_data_private.erase_personal_account_v1(p_deletion_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_request personal_data_private.account_deletions;
    v_user uuid;
    v_login_id text;
    v_public_id text;
BEGIN
    SELECT * INTO v_request FROM personal_data_private.account_deletions d WHERE d.id = p_deletion_id;
    IF v_request.id IS NULL THEN
        RETURN 'UNKNOWN';
    END IF;
    v_user := v_request.user_id;

    -- The account row first, then the request: the same order the owner's acts take, so a cancellation and the
    -- erasure are serialized and exactly one of them wins.
    SELECT u.login_id, u.public_id INTO v_login_id, v_public_id FROM public.users u WHERE u.id = v_user FOR UPDATE;
    SELECT * INTO v_request FROM personal_data_private.account_deletions d WHERE d.id = p_deletion_id FOR UPDATE;
    IF v_request.status = 'ERASED' THEN
        -- Erased, the provider account not yet removed. The HIM measurement tables reference the PROVIDER account
        -- (0011-0013), not public.users, so a session still valid at the provider could have written a row since the
        -- erasure; its immutability guard would then refuse the provider's cascading delete forever. The server
        -- therefore passes here right before every removal attempt, and those rows are swept under a fresh
        -- authorization of this same request.
        INSERT INTO personal_data_private.erasure_authorizations (transaction_id, deletion_id)
        VALUES (pg_catalog.txid_current(), v_request.id);
        PERFORM pg_catalog.set_config('qandeel.personal_erasure', pg_catalog.txid_current()::text, true);
        DELETE FROM public.him_energy_calculation_supersessions x WHERE x.user_id = v_user;
        DELETE FROM public.him_calibration_evaluations x WHERE x.user_id = v_user;
        -- A snapshot references its calculation result and observation (0012): it goes before both.
        DELETE FROM public.him_metric_snapshots x WHERE x.user_id = v_user;
        DELETE FROM public.him_calculation_results x WHERE x.user_id = v_user;
        DELETE FROM public.him_measurement_observations x WHERE x.user_id = v_user;
        DELETE FROM public.him_measurement_events x WHERE x.user_id = v_user;
        DELETE FROM public.him_measurement_targets x WHERE x.user_id = v_user;
        DELETE FROM personal_data_private.erasure_authorizations a WHERE a.transaction_id = pg_catalog.txid_current();
        PERFORM pg_catalog.set_config('qandeel.personal_erasure', '', true);
        RETURN 'ALREADY_ERASED';
    ELSIF v_request.status = 'COMPLETED' THEN
        RETURN 'ALREADY_ERASED';
    ELSIF v_request.status = 'CANCELLED' THEN
        RETURN 'CANCELLED';
    ELSIF v_request.status = 'BLOCKED' THEN
        RETURN 'BLOCKED';
    ELSIF v_request.final_at > clock_timestamp() THEN
        RETURN 'NOT_DUE';
    END IF;

    INSERT INTO personal_data_private.erasure_authorizations (transaction_id, deletion_id)
    VALUES (pg_catalog.txid_current(), v_request.id);
    PERFORM pg_catalog.set_config('qandeel.personal_erasure', pg_catalog.txid_current()::text, true);

    BEGIN
        -- Retire the identifiers first: from this commit on, neither is available to anyone.
        INSERT INTO personal_data_private.retired_account_identifiers (digest)
        SELECT r.digest FROM (VALUES (personal_data_private.identifier_digest_v1('lid1', v_login_id)),
                                     (personal_data_private.identifier_digest_v1('pid1', v_public_id))) AS r(digest)
         WHERE r.digest IS NOT NULL
        ON CONFLICT (digest) DO NOTHING;

        -- Memory control records and the question / history derivatives of the conversation.
        DELETE FROM public.memory_control_commands x WHERE x.user_id = v_user;
        DELETE FROM public.historical_question_appearance_events x WHERE x.user_id = v_user;
        DELETE FROM public.formal_question_turn_bindings x WHERE x.user_id = v_user;
        DELETE FROM public.historical_question_events x WHERE x.user_id = v_user;
        DELETE FROM public.historical_gap_events x WHERE x.user_id = v_user;
        DELETE FROM public.historical_confidence_events x WHERE x.user_id = v_user;
        DELETE FROM public.historical_material_events x WHERE x.user_id = v_user;
        DELETE FROM public.historical_reading_relation_events x WHERE x.user_id = v_user;
        DELETE FROM public.historical_evidence_participation_events x WHERE x.user_id = v_user;
        DELETE FROM public.historical_reading_events x WHERE x.user_id = v_user;
        DELETE FROM public.thread_reading_bindings x WHERE x.user_id = v_user;
        DELETE FROM public.hypothesis_subject_grounding_proposals x WHERE x.user_id = v_user;
        DELETE FROM public.hypothesis_subject_groundings x WHERE x.user_id = v_user;
        DELETE FROM public.hypothesis_subject_grounding_universes x WHERE x.user_id = v_user;
        DELETE FROM public.historical_thread_availability x WHERE x.user_id = v_user;
        DELETE FROM public.session_historical_baselines x WHERE x.user_id = v_user;
        DELETE FROM public.session_historical_coverage x WHERE x.user_id = v_user;
        DELETE FROM public.historical_world_semantic_clocks x WHERE x.user_id = v_user;

        -- Live Focus, the Thread layer and its identity clock.
        DELETE FROM public.conversation_live_focus_commit_batches x WHERE x.user_id = v_user;
        DELETE FROM public.conversation_live_focus_transitions x WHERE x.user_id = v_user;
        DELETE FROM public.conversation_thread_semantic_unit_results x WHERE x.user_id = v_user;
        DELETE FROM public.conversation_thread_semantic_commit_batches x WHERE x.user_id = v_user;
        DELETE FROM public.conversation_thread_lifecycle_events x WHERE x.user_id = v_user;
        DELETE FROM public.conversation_thread_identity_evidence x WHERE x.user_id = v_user;
        DELETE FROM public.conversation_thread_focus_bindings x WHERE x.user_id = v_user;
        DELETE FROM public.conversation_thread_commit_batches x WHERE x.user_id = v_user;
        DELETE FROM public.conversation_thread_origin_members x
         WHERE x.thread_id IN (SELECT o.id FROM public.conversation_threads o WHERE o.user_id = v_user);
        DELETE FROM public.conversation_thread_establishment_evidence x WHERE x.user_id = v_user;
        DELETE FROM public.conversation_thread_establishment_events x WHERE x.user_id = v_user;
        DELETE FROM public.conversation_thread_homes x WHERE x.user_id = v_user;
        DELETE FROM public.conversation_threads x WHERE x.user_id = v_user;
        DELETE FROM public.conversation_world_spatial_authorities x WHERE x.user_id = v_user;
        DELETE FROM public.conversation_world_thread_identity_clocks x WHERE x.user_id = v_user;

        -- Reference, claim and Emerging Focus semantics.
        DELETE FROM public.conversation_emerging_focus_attention_events x WHERE x.user_id = v_user;
        DELETE FROM public.conversation_claim_attributions x WHERE x.user_id = v_user;
        DELETE FROM public.conversation_reference_resolution_candidates x WHERE x.user_id = v_user;
        DELETE FROM public.conversation_reference_resolutions x WHERE x.user_id = v_user;
        DELETE FROM public.conversation_emerging_focuses x WHERE x.user_id = v_user;
        DELETE FROM public.conversation_unit_focus_semantics x WHERE x.user_id = v_user;
        DELETE FROM public.conversation_reference_handles x WHERE x.user_id = v_user;
        DELETE FROM public.conversation_focus_commit_batches x WHERE x.user_id = v_user;

        -- Committed conversational units and their delivery, the session clocks and bindings.
        DELETE FROM public.conversation_unit_commit_events x WHERE x.user_id = v_user;
        DELETE FROM public.him_session_context_bindings x WHERE x.user_id = v_user;
        DELETE FROM public.conversation_units x WHERE x.user_id = v_user;
        DELETE FROM public.conversation_unit_commit_batches x WHERE x.user_id = v_user;
        DELETE FROM public.session_semantic_clocks x WHERE x.user_id = v_user;

        -- Post-response intelligence bookkeeping of the account's turns.
        DELETE FROM public.post_response_confidence_batch_items x
         WHERE x.execution_id IN (SELECT e.id FROM public.post_response_intelligence_executions e WHERE e.user_id = v_user);
        DELETE FROM public.post_response_intelligence_effects x
         WHERE x.execution_id IN (SELECT e.id FROM public.post_response_intelligence_executions e WHERE e.user_id = v_user);
        DELETE FROM public.post_response_intelligence_executions x WHERE x.user_id = v_user;

        -- Questions, Information Gaps, Confidence, Hypotheses (QANDEEL Understanding) and the owner's contests.
        DELETE FROM public.information_gap_confidence_sources x WHERE x.user_id = v_user;
        DELETE FROM public.question_candidates x WHERE x.user_id = v_user;
        DELETE FROM public.information_gap_hypotheses x WHERE x.user_id = v_user;
        DELETE FROM public.information_gaps x WHERE x.user_id = v_user;
        DELETE FROM public.confidence_evaluations x WHERE x.user_id = v_user;
        DELETE FROM public.hypothesis_lifecycle_transitions x WHERE x.user_id = v_user;
        DELETE FROM public.hypothesis_updates x WHERE x.user_id = v_user;
        DELETE FROM public.understanding_contests x WHERE x.user_id = v_user;
        DELETE FROM public.understanding_discussion_focus x WHERE x.user_id = v_user;
        DELETE FROM public.hypotheses x WHERE x.user_id = v_user;

        -- Memory, every lifecycle state.
        DELETE FROM public.memories x WHERE x.user_id = v_user;

        -- HIM measurements (the provider account removal cascades into these, so they go first).
        DELETE FROM public.him_energy_calculation_supersessions x WHERE x.user_id = v_user;
        DELETE FROM public.him_calibration_evaluations x WHERE x.user_id = v_user;
        -- A snapshot references its calculation result and observation (0012): it goes before both.
        DELETE FROM public.him_metric_snapshots x WHERE x.user_id = v_user;
        DELETE FROM public.him_calculation_results x WHERE x.user_id = v_user;
        DELETE FROM public.him_measurement_observations x WHERE x.user_id = v_user;
        DELETE FROM public.him_measurement_events x WHERE x.user_id = v_user;
        DELETE FROM public.him_measurement_targets x WHERE x.user_id = v_user;

        -- The Personal conversation itself, its operational events and the owner's pending exports.
        DELETE FROM public.conversation_turns x WHERE x.user_id = v_user;
        DELETE FROM public.conversation_sessions x WHERE x.user_id = v_user;
        DELETE FROM public.runtime_event_outbox x WHERE x.subject_user_id = v_user;
        DELETE FROM personal_data_private.data_exports x WHERE x.user_id = v_user;

        -- The account row, LAST. A Connected Worlds row that still references the account (or its conversation)
        -- makes PostgreSQL refuse here or above; the whole erasure is then undone.
        DELETE FROM public.users x WHERE x.id = v_user;
    EXCEPTION WHEN foreign_key_violation THEN
        DELETE FROM personal_data_private.erasure_authorizations a WHERE a.transaction_id = pg_catalog.txid_current();
        PERFORM pg_catalog.set_config('qandeel.personal_erasure', '', true);
        UPDATE personal_data_private.account_deletions d
           SET status = 'BLOCKED', blocked_at = clock_timestamp(), lease_until = NULL
         WHERE d.id = v_request.id;
        RETURN 'BLOCKED';
    END;

    DELETE FROM personal_data_private.erasure_authorizations a WHERE a.transaction_id = pg_catalog.txid_current();
    PERFORM pg_catalog.set_config('qandeel.personal_erasure', '', true);
    -- The claim's lease is kept: the server that erased goes on to remove the provider account under it.
    UPDATE personal_data_private.account_deletions d
       SET status = 'ERASED', erased_at = clock_timestamp()
     WHERE d.id = v_request.id;
    RETURN 'ERASED';
END;
$$;

-- The provider account is gone: the deletion is complete. Only an ERASED request can complete.
CREATE FUNCTION personal_data_private.complete_account_deletion_v1(p_deletion_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_request personal_data_private.account_deletions;
BEGIN
    SELECT * INTO v_request FROM personal_data_private.account_deletions d WHERE d.id = p_deletion_id FOR UPDATE;
    IF v_request.id IS NULL THEN
        RETURN 'UNKNOWN';
    ELSIF v_request.status = 'COMPLETED' THEN
        RETURN 'COMPLETED';
    ELSIF v_request.status <> 'ERASED' THEN
        RETURN v_request.status;
    END IF;
    UPDATE personal_data_private.account_deletions d
       SET status = 'COMPLETED', completed_at = clock_timestamp(), lease_until = NULL
     WHERE d.id = v_request.id;
    RETURN 'COMPLETED';
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 7. The exposed surface: SECURITY INVOKER wrappers, one per act, with exact grants.
-- ---------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.read_own_privacy_state_v1()
RETURNS TABLE (export_status text, export_available_until timestamptz, deletion_status text, deletion_final_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT s.export_status, s.export_available_until, s.deletion_status, s.deletion_final_at
        FROM personal_data_private.read_own_privacy_state_v1() s; $$;

CREATE FUNCTION public.request_own_data_export_v1(p_command_id uuid)
RETURNS TABLE (outcome text, export_status text, available_until timestamptz)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = ''
AS $$ SELECT r.outcome, r.export_status, r.available_until
        FROM personal_data_private.request_own_data_export_v1(p_command_id) r; $$;

CREATE FUNCTION public.read_own_data_export_v1()
RETURNS TABLE (export_status text, available_until timestamptz, content jsonb)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT r.export_status, r.available_until, r.content FROM personal_data_private.read_own_data_export_v1() r; $$;

CREATE FUNCTION public.request_own_account_deletion_v1(p_command_id uuid)
RETURNS TABLE (outcome text, deletion_status text, final_at timestamptz)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = ''
AS $$ SELECT r.outcome, r.deletion_status, r.final_at
        FROM personal_data_private.request_own_account_deletion_v1(p_command_id) r; $$;

CREATE FUNCTION public.cancel_own_account_deletion_v1()
RETURNS TABLE (outcome text, deletion_status text, final_at timestamptz)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = ''
AS $$ SELECT r.outcome, r.deletion_status, r.final_at FROM personal_data_private.cancel_own_account_deletion_v1() r; $$;

CREATE FUNCTION public.server_prepare_data_exports_v1(p_limit integer)
RETURNS integer
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = ''
AS $$ SELECT personal_data_private.prepare_data_exports_v1(p_limit); $$;

CREATE FUNCTION public.server_claim_due_account_deletions_v1(p_limit integer)
RETURNS TABLE (deletion_id uuid, user_id uuid, deletion_status text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = ''
AS $$ SELECT c.deletion_id, c.user_id, c.deletion_status FROM personal_data_private.claim_due_account_deletions_v1(p_limit) c; $$;

CREATE FUNCTION public.server_erase_personal_account_v1(p_deletion_id uuid)
RETURNS text
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = ''
AS $$ SELECT personal_data_private.erase_personal_account_v1(p_deletion_id); $$;

CREATE FUNCTION public.server_complete_account_deletion_v1(p_deletion_id uuid)
RETURNS text
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = ''
AS $$ SELECT personal_data_private.complete_account_deletion_v1(p_deletion_id); $$;

-- Default-deny by name, then exact grants.
REVOKE ALL ON ALL TABLES IN SCHEMA personal_data_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA personal_data_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_own_privacy_state_v1(), public.request_own_data_export_v1(uuid),
    public.read_own_data_export_v1(), public.request_own_account_deletion_v1(uuid), public.cancel_own_account_deletion_v1(),
    public.server_prepare_data_exports_v1(integer), public.server_claim_due_account_deletions_v1(integer),
    public.server_erase_personal_account_v1(uuid), public.server_complete_account_deletion_v1(uuid)
    FROM PUBLIC, anon, authenticated;
DO $$BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA personal_data_private FROM service_role';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA personal_data_private FROM service_role';
    EXECUTE 'REVOKE ALL ON FUNCTION public.read_own_privacy_state_v1(), public.request_own_data_export_v1(uuid), '
         || 'public.read_own_data_export_v1(), public.request_own_account_deletion_v1(uuid), public.cancel_own_account_deletion_v1() '
         || 'FROM service_role';
  END IF;
END$$;

-- The narrowed guards are trigger functions only: no role may call one directly. Twelve were already revoked by their
-- own migrations; these four had kept PUBLIC's default EXECUTE (0011, 0012, 0063).
REVOKE ALL ON FUNCTION public.reject_him_runtime_mutation(), public.reject_him_energy_immutable_mutation(),
    public.guard_information_gap_lifecycle_mutation(), public.guard_formal_question_turn_binding_mutation()
    FROM PUBLIC, anon, authenticated;
DO $$BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.reject_him_runtime_mutation(), public.reject_him_energy_immutable_mutation(), '
         || 'public.guard_information_gap_lifecycle_mutation(), public.guard_formal_question_turn_binding_mutation() '
         || 'FROM service_role';
  END IF;
END$$;

GRANT USAGE ON SCHEMA personal_data_private TO authenticated;
GRANT EXECUTE ON FUNCTION
    personal_data_private.read_own_privacy_state_v1(), public.read_own_privacy_state_v1(),
    personal_data_private.request_own_data_export_v1(uuid), public.request_own_data_export_v1(uuid),
    personal_data_private.read_own_data_export_v1(), public.read_own_data_export_v1(),
    personal_data_private.request_own_account_deletion_v1(uuid), public.request_own_account_deletion_v1(uuid),
    personal_data_private.cancel_own_account_deletion_v1(), public.cancel_own_account_deletion_v1()
    TO authenticated;

DO $$BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA personal_data_private TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION '
         || 'personal_data_private.prepare_data_exports_v1(integer), public.server_prepare_data_exports_v1(integer), '
         || 'personal_data_private.claim_due_account_deletions_v1(integer), public.server_claim_due_account_deletions_v1(integer), '
         || 'personal_data_private.erase_personal_account_v1(uuid), public.server_erase_personal_account_v1(uuid), '
         || 'personal_data_private.complete_account_deletion_v1(uuid), public.server_complete_account_deletion_v1(uuid) '
         || 'TO service_role';
  END IF;
END$$;

COMMIT;
