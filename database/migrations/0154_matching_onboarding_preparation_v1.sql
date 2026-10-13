-- S6-01 - Intelligent Matching Onboarding: pre-enrollment preparation v1.
--
-- Product authority: the Product Owner's S6-01 Final Implementation Authorization (2026-10-13), decisions D1-D7, and
-- the CW2-06A controlled amendment it approves (docs/canonical-authority/connected-worlds-v2/architecture/
-- QANDEEL_CW2-06A_MATCHING_ONBOARDING_PREPARATION_ASSISTANCE_CONTROLLED_AMENDMENT_v1.0.md). The field, consent and area
-- catalogue is the S6-01 implementation record §4. This migration is that task's database part, and nothing more.
--
-- ## What is added (schema introductions_preparation_private, not exposed through the Data API)
--
--   1. Two operator gates, PREPARATION and ONBOARDING_ASSISTANCE, in the 0138 pattern: one server-canonical state row
--      per scope, changed only by an operator function no application role can execute, every change audited. An
--      absent row is UNCONFIGURED and DENIES. ALLOW needs ENABLED and SATISFIED (or WAIVED_BY_AUTHORIZED_GOVERNANCE).
--      Nothing is configured here: both gates start closed.
--   2. The controlled catalogues: the broad-area countries and first-level regions (a preparation catalogue, not launch
--      policy) and the consent-text catalogue (the exact Arabic and English text of each consent version, with its
--      SHA-256).
--   3. The owner's preparation draft (CW2-06A §2): `drafts` (version, optional profile, hard requirements, soft
--      preferences, skipped optional steps, review), `declared_facts` (first name, sex, birth year-month, broad area,
--      marital status, each with its own DECLARED / CONFIRMED / CORRECTED state and confirmation time), `notes` (the
--      owner's private notes, written or confirmed by the owner) and `prior_understanding_decisions` (the owner's
--      decision on each item QANDEEL showed, without its content).
--   4. `assistance_consents`: the MATCHING_ONBOARDING_ASSISTANCE grants (CW2-06A §3), version-bound, revocable.
--   5. `command_ledger`: each applied owner command once, by its command id, so a retry answers the first result and a
--      reused id with a different request changes nothing.
--   6. Owner entry points, each deriving the human from auth.uid() and nothing else: the availability hint, the owner's
--      read, the draft command, discard, grant and revoke of the assistance consent, and the bounded deterministic
--      reader of the owner's own SELF Memory (CW2-06A §3.2-§3.3).
--
-- ## What is deliberately NOT here
--
--   * No I-07 relation is read or written, and no function here names any I-07 setup command. The six commands 0149
--     closed stay closed (D1): this is preparation, never enrollment, participation, eligibility or matchability.
--   * No Memory, Hypothesis or HIM write. The reader is read-only and returns only the classes CW2-06A §3.2 names.
--   * No inference, no model, no dynamic SQL, no 40001.
--   * No change to Export My Data: the draft's export is QAN-BL-PRIV-04 (S6-07).
--
-- ## Deletion (QAN-BL-ACCT-01 is untouched; this adds no blocker)
--
-- Every relation that names an account references public.users ON DELETE CASCADE, directly or through `drafts`, and
-- nothing references these relations with RESTRICT, so the governed Personal erasure (0130), which deletes
-- public.users last, removes every row here and is never BLOCKED by them. No new write is accepted while the owner's
-- account deletion is live (SCHEDULED, BLOCKED, ERASED or COMPLETED). verify-migration-0154 enumerates every relation,
-- foreign key, grant and command here itself; it does not rely on any earlier verifier's name patterns.
--
-- ## Lock order (every owner write; never reversed)
--
--   1. the account row                 (FOR KEY SHARE - a deletion request or the erasure, which take it FOR UPDATE,
--                                       serialize with the write)
--   2. the owner's preparation lock    (transaction advisory lock; one owner command at a time, so replays and
--                                       concurrent first writes are decided once)
--   3. the gate row(s)                 (FOR SHARE - an operator change waits for the command)
--   4. the current assistance consent  (FOR SHARE - a revocation waits for the read that relies on it)
--   5. the draft row                   (FOR UPDATE)
--   6. a Memory row                    (FOR SHARE - a forget / correct waits for the confirmation that copies it)
--
-- Forward-only. Migrations 0001-0153 are byte-unchanged.
BEGIN;

CREATE SCHEMA introductions_preparation_private;
ALTER SCHEMA introductions_preparation_private OWNER TO postgres;
REVOKE ALL ON SCHEMA introductions_preparation_private FROM PUBLIC;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. The operator gates (the 0138 pattern).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE introductions_preparation_private.gate_states (
  scope text NOT NULL,
  feature_flag_state text NOT NULL,
  launch_requirements_state text NOT NULL,
  restriction_version bigint NOT NULL,
  decided_by text NOT NULL,
  policy_basis text NOT NULL,
  decided_at timestamptz NOT NULL,
  CONSTRAINT gate_states_pk PRIMARY KEY (scope),
  CONSTRAINT gate_states_scope_check CHECK (scope IN ('PREPARATION', 'ONBOARDING_ASSISTANCE')),
  CONSTRAINT gate_states_flag_check
    CHECK (feature_flag_state IN ('DISABLED', 'INTERNAL', 'LIMITED_ROLLOUT', 'ENABLED', 'EMERGENCY_DISABLED')),
  CONSTRAINT gate_states_requirements_check
    CHECK (launch_requirements_state IN ('SATISFIED', 'UNSATISFIED', 'UNKNOWN', 'WAIVED_BY_AUTHORIZED_GOVERNANCE')),
  CONSTRAINT gate_states_version_check CHECK (restriction_version >= 1),
  CONSTRAINT gate_states_decided_by_check CHECK (length(btrim(decided_by)) BETWEEN 1 AND 120),
  CONSTRAINT gate_states_basis_check CHECK (length(btrim(policy_basis)) BETWEEN 1 AND 500)
);

CREATE TABLE introductions_preparation_private.gate_events (
  id bigint GENERATED ALWAYS AS IDENTITY,
  scope text NOT NULL,
  feature_flag_state text NOT NULL,
  launch_requirements_state text NOT NULL,
  restriction_version bigint NOT NULL,
  decided_by text NOT NULL,
  policy_basis text NOT NULL,
  decided_at timestamptz NOT NULL,
  CONSTRAINT gate_events_pk PRIMARY KEY (id),
  CONSTRAINT gate_events_scope_fk FOREIGN KEY (scope)
    REFERENCES introductions_preparation_private.gate_states (scope) ON DELETE RESTRICT,
  CONSTRAINT gate_events_version_key UNIQUE (scope, restriction_version)
);

-- The ONLY way a gate changes. Executable by no application role: an operator runs it as the database owner.
CREATE FUNCTION introductions_preparation_private.set_gate_v1(
  p_scope text, p_feature_flag_state text, p_launch_requirements_state text, p_decided_by text, p_policy_basis text
) RETURNS TABLE (scope text, restriction_version bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_version bigint;
  v_at timestamptz := clock_timestamp();
BEGIN
  SELECT s.restriction_version INTO v_version
    FROM introductions_preparation_private.gate_states s WHERE s.scope = p_scope FOR UPDATE;
  v_version := COALESCE(v_version, 0) + 1;
  INSERT INTO introductions_preparation_private.gate_states AS s
    (scope, feature_flag_state, launch_requirements_state, restriction_version, decided_by, policy_basis, decided_at)
  VALUES (p_scope, p_feature_flag_state, p_launch_requirements_state, v_version, p_decided_by, p_policy_basis, v_at)
  ON CONFLICT ON CONSTRAINT gate_states_pk DO UPDATE
     SET feature_flag_state = EXCLUDED.feature_flag_state,
         launch_requirements_state = EXCLUDED.launch_requirements_state,
         restriction_version = EXCLUDED.restriction_version,
         decided_by = EXCLUDED.decided_by,
         policy_basis = EXCLUDED.policy_basis,
         decided_at = EXCLUDED.decided_at;
  INSERT INTO introductions_preparation_private.gate_events
    (scope, feature_flag_state, launch_requirements_state, restriction_version, decided_by, policy_basis, decided_at)
  VALUES (p_scope, p_feature_flag_state, p_launch_requirements_state, v_version, p_decided_by, p_policy_basis, v_at);
  RETURN QUERY SELECT p_scope, v_version;
END$$;

-- The current verdict of one scope, locked FOR SHARE so an operator change waits for the caller's transaction.
CREATE FUNCTION introductions_preparation_private.bind_gate_v1(p_scope text)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_state introductions_preparation_private.gate_states;
BEGIN
  SELECT * INTO v_state FROM introductions_preparation_private.gate_states s WHERE s.scope = p_scope FOR SHARE;
  IF NOT FOUND THEN RETURN 'DENY'; END IF;
  IF v_state.feature_flag_state = 'ENABLED'
     AND v_state.launch_requirements_state IN ('SATISFIED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE') THEN
    RETURN 'ALLOW';
  END IF;
  RETURN 'DENY';
END$$;

-- A presentation hint only: no lock, and every command binds the gate itself.
CREATE FUNCTION introductions_preparation_private.gate_open_v1(p_scope text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM introductions_preparation_private.gate_states s
                  WHERE s.scope = p_scope AND s.feature_flag_state = 'ENABLED'
                    AND s.launch_requirements_state IN ('SATISFIED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE'))
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Controlled catalogues.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE introductions_preparation_private.area_countries (
  country_code text NOT NULL,
  regions_listed boolean NOT NULL,
  CONSTRAINT area_countries_pk PRIMARY KEY (country_code),
  CONSTRAINT area_countries_code_check CHECK (country_code ~ '^[A-Z]{2}$')
);

CREATE TABLE introductions_preparation_private.area_regions (
  country_code text NOT NULL,
  region_code text NOT NULL,
  CONSTRAINT area_regions_pk PRIMARY KEY (country_code, region_code),
  CONSTRAINT area_regions_region_key UNIQUE (region_code),
  CONSTRAINT area_regions_country_fk FOREIGN KEY (country_code)
    REFERENCES introductions_preparation_private.area_countries (country_code) ON DELETE RESTRICT,
  CONSTRAINT area_regions_code_check CHECK (region_code ~ '^[A-Z]{2}-[A-Z0-9]{1,3}$' AND left(region_code, 2) = country_code)
);

-- The preparation catalogue v1 (S6-01 record §4.4): the 22 member states of the Arab League; first-level regions
-- (ISO 3166-2) for eight of them. Not launch policy.
INSERT INTO introductions_preparation_private.area_countries (country_code, regions_listed) VALUES
  ('AE', true), ('BH', true), ('DJ', false), ('DZ', false), ('EG', true), ('IQ', false), ('JO', true), ('KM', false),
  ('KW', true), ('LB', false), ('LY', false), ('MA', false), ('MR', false), ('OM', true), ('PS', false), ('QA', true),
  ('SA', true), ('SD', false), ('SO', false), ('SY', false), ('TN', false), ('YE', false);

INSERT INTO introductions_preparation_private.area_regions (country_code, region_code)
SELECT left(code, 2), code FROM unnest(ARRAY[
  -- Egypt: 27 governorates
  'EG-ALX', 'EG-ASN', 'EG-AST', 'EG-BA', 'EG-BH', 'EG-BNS', 'EG-C', 'EG-DK', 'EG-DT', 'EG-FYM', 'EG-GH', 'EG-GZ', 'EG-IS',
  'EG-JS', 'EG-KB', 'EG-KFS', 'EG-KN', 'EG-LX', 'EG-MN', 'EG-MNF', 'EG-MT', 'EG-PTS', 'EG-SHG', 'EG-SHR', 'EG-SIN',
  'EG-SUZ', 'EG-WAD',
  -- Saudi Arabia: 13 regions
  'SA-01', 'SA-02', 'SA-03', 'SA-04', 'SA-05', 'SA-06', 'SA-07', 'SA-08', 'SA-09', 'SA-10', 'SA-11', 'SA-12', 'SA-14',
  -- United Arab Emirates: 7 emirates
  'AE-AJ', 'AE-AZ', 'AE-DU', 'AE-FU', 'AE-RK', 'AE-SH', 'AE-UQ',
  -- Kuwait: 6 governorates
  'KW-AH', 'KW-FA', 'KW-HA', 'KW-JA', 'KW-KU', 'KW-MU',
  -- Qatar: 8 municipalities
  'QA-DA', 'QA-KH', 'QA-MS', 'QA-RA', 'QA-SH', 'QA-US', 'QA-WA', 'QA-ZA',
  -- Bahrain: 4 governorates
  'BH-13', 'BH-14', 'BH-15', 'BH-17',
  -- Oman: 11 governorates
  'OM-BJ', 'OM-BS', 'OM-BU', 'OM-DA', 'OM-MA', 'OM-MU', 'OM-SJ', 'OM-SS', 'OM-WU', 'OM-ZA', 'OM-ZU',
  -- Jordan: 12 governorates
  'JO-AJ', 'JO-AM', 'JO-AQ', 'JO-AT', 'JO-AZ', 'JO-BA', 'JO-IR', 'JO-JA', 'JO-KA', 'JO-MA', 'JO-MD', 'JO-MN'
]) AS code;

CREATE TABLE introductions_preparation_private.consent_texts (
  consent_version text NOT NULL,
  purpose text NOT NULL,
  text_ar text NOT NULL,
  text_en text NOT NULL,
  sha256_ar text NOT NULL,
  sha256_en text NOT NULL,
  is_current boolean NOT NULL,
  introduced_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT consent_texts_pk PRIMARY KEY (consent_version),
  CONSTRAINT consent_texts_purpose_check CHECK (purpose = 'MATCHING_ONBOARDING_ASSISTANCE'),
  CONSTRAINT consent_texts_version_check CHECK (consent_version ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  CONSTRAINT consent_texts_text_check CHECK (length(btrim(text_ar)) > 0 AND length(btrim(text_en)) > 0),
  CONSTRAINT consent_texts_digest_check CHECK (
    sha256_ar = encode(sha256(convert_to(text_ar, 'UTF8')), 'hex')
    AND sha256_en = encode(sha256(convert_to(text_en, 'UTF8')), 'hex'))
);
CREATE UNIQUE INDEX consent_texts_one_current ON introductions_preparation_private.consent_texts (purpose) WHERE is_current;

-- The consent text shown with the permission (S6-01 Product Copy Gate, row CONSENT_BODY).
INSERT INTO introductions_preparation_private.consent_texts
  (consent_version, purpose, text_ar, text_en, sha256_ar, sha256_en, is_current)
SELECT v, 'MATCHING_ONBOARDING_ASSISTANCE', ar, en,
       encode(sha256(convert_to(ar, 'UTF8')), 'hex'), encode(sha256(convert_to(en, 'UTF8')), 'hex'), true
  FROM (VALUES (
    'MATCHING_ONBOARDING_ASSISTANCE_V1',
    'يعرض قنديل ما يعرفه عنك من محادثاتك السابقة، معلومةً تلو الأخرى، لتأكيدها أو تصحيحها أو رفضها أثناء التحضير للتعارف. لا يُستخدم ذلك لتقييم أي شخص، ولا يُعرض على أحد، ويمكن إلغاء هذا الإذن في أي وقت.',
    'QANDEEL shows what it knows about you from your past conversations, one item at a time, for you to confirm, correct or reject while you prepare for Introductions. It is not used to evaluate anyone and is not shown to anyone. You can withdraw this permission at any time.'
  )) AS t(v, ar, en);

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. The owner's preparation draft.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE introductions_preparation_private.drafts (
  user_id uuid NOT NULL,
  draft_version bigint NOT NULL,
  short_introduction text,
  work_field text,
  hard_answer text,
  hard_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  soft_answer text,
  soft_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  skipped_steps text[] NOT NULL DEFAULT '{}'::text[],
  reviewed_version bigint,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT drafts_pk PRIMARY KEY (user_id),
  CONSTRAINT drafts_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT drafts_version_check CHECK (draft_version >= 1),
  CONSTRAINT drafts_short_introduction_check CHECK (short_introduction IS NULL
    OR (char_length(short_introduction) BETWEEN 20 AND 280 AND short_introduction = btrim(short_introduction)
        AND short_introduction !~ '[[:cntrl:]]')),
  CONSTRAINT drafts_work_field_check CHECK (work_field IS NULL OR work_field IN (
    'HEALTH', 'EDUCATION', 'ENGINEERING_TECHNOLOGY', 'BUSINESS_FINANCE', 'LAW_GOVERNMENT', 'MEDIA_ARTS', 'SCIENCE_RESEARCH',
    'CRAFTS_TRADES', 'SERVICES_HOSPITALITY', 'AGRICULTURE_ENVIRONMENT', 'STUDENT', 'NOT_CURRENTLY_WORKING', 'OTHER')),
  CONSTRAINT drafts_hard_check CHECK (
    jsonb_typeof(hard_items) = 'array'
    AND (hard_answer IS NULL AND jsonb_array_length(hard_items) = 0
      OR hard_answer = 'NONE_ADDITIONAL' AND jsonb_array_length(hard_items) = 0
      OR hard_answer = 'ITEMS' AND jsonb_array_length(hard_items) BETWEEN 1 AND 3)),
  CONSTRAINT drafts_soft_check CHECK (
    jsonb_typeof(soft_items) = 'array'
    AND (soft_answer IS NULL AND jsonb_array_length(soft_items) = 0
      OR soft_answer = 'NONE' AND jsonb_array_length(soft_items) = 0
      OR soft_answer = 'ITEMS' AND jsonb_array_length(soft_items) BETWEEN 1 AND 3)),
  -- The optional steps the owner chose to skip, so they are not offered again: notes, short introduction, work field,
  -- the assistance offer (declining it), and the review of prior-understanding items (ending it).
  CONSTRAINT drafts_skipped_check CHECK (skipped_steps <@ ARRAY['NOTES', 'SHORT_INTRODUCTION', 'WORK_FIELD', 'ASSISTANCE_OFFER',
    'PRIOR_UNDERSTANDING']::text[]),
  CONSTRAINT drafts_review_check CHECK ((reviewed_version IS NULL) = (reviewed_at IS NULL)
    AND (reviewed_version IS NULL OR reviewed_version BETWEEN 1 AND draft_version))
);

-- The declared facts, with their own confirmation evidence, apart from the optional profile (CW2-06A §4.3).
CREATE TABLE introductions_preparation_private.declared_facts (
  user_id uuid NOT NULL,
  first_name text,
  first_name_state text,
  first_name_confirmed_at timestamptz,
  sex text,
  sex_state text,
  sex_confirmed_at timestamptz,
  birth_year smallint,
  birth_month smallint,
  birth_state text,
  birth_confirmed_at timestamptz,
  country_code text,
  region_code text,
  area_state text,
  area_confirmed_at timestamptz,
  marital_status text,
  marital_state text,
  marital_confirmed_at timestamptz,
  CONSTRAINT declared_facts_pk PRIMARY KEY (user_id),
  CONSTRAINT declared_facts_draft_fk FOREIGN KEY (user_id)
    REFERENCES introductions_preparation_private.drafts (user_id) ON DELETE CASCADE,
  CONSTRAINT declared_facts_country_fk FOREIGN KEY (country_code)
    REFERENCES introductions_preparation_private.area_countries (country_code) ON DELETE RESTRICT,
  CONSTRAINT declared_facts_region_fk FOREIGN KEY (country_code, region_code)
    REFERENCES introductions_preparation_private.area_regions (country_code, region_code) ON DELETE RESTRICT,
  CONSTRAINT declared_facts_first_name_check CHECK (first_name IS NULL OR (char_length(first_name) BETWEEN 1 AND 32
    AND first_name ~ '^[A-Za-zÀ-ÖØ-öø-ÿء-غف-يٱ-ۓ][A-Za-zÀ-ÖØ-öø-ÿء-غف-يٱ-ۓً-ْ]*([ ''’-][A-Za-zÀ-ÖØ-öø-ÿء-غف-يٱ-ۓ][A-Za-zÀ-ÖØ-öø-ÿء-غف-يٱ-ۓً-ْ]*)*$')),
  CONSTRAINT declared_facts_sex_check CHECK (sex IS NULL OR sex IN ('MALE', 'FEMALE')),
  CONSTRAINT declared_facts_birth_check CHECK ((birth_year IS NULL) = (birth_month IS NULL)
    AND (birth_year IS NULL OR (birth_year >= 1900 AND birth_month BETWEEN 1 AND 12))),
  CONSTRAINT declared_facts_area_check CHECK (region_code IS NULL OR country_code IS NOT NULL),
  CONSTRAINT declared_facts_marital_check CHECK (marital_status IS NULL
    OR marital_status IN ('NEVER_MARRIED', 'DIVORCED', 'WIDOWED', 'CURRENTLY_MARRIED')),
  -- A state exists exactly when its value does; CONFIRMED exactly when a confirmation time does.
  CONSTRAINT declared_facts_states_check CHECK (
        (first_name_state IS NULL) = (first_name IS NULL)
    AND (sex_state IS NULL) = (sex IS NULL)
    AND (birth_state IS NULL) = (birth_year IS NULL)
    AND (area_state IS NULL) = (country_code IS NULL)
    AND (marital_state IS NULL) = (marital_status IS NULL)
    AND coalesce(first_name_state, 'DECLARED') IN ('DECLARED', 'CONFIRMED', 'CORRECTED')
    AND coalesce(sex_state, 'DECLARED') IN ('DECLARED', 'CONFIRMED', 'CORRECTED')
    AND coalesce(birth_state, 'DECLARED') IN ('DECLARED', 'CONFIRMED', 'CORRECTED')
    AND coalesce(area_state, 'DECLARED') IN ('DECLARED', 'CONFIRMED', 'CORRECTED')
    AND coalesce(marital_state, 'DECLARED') IN ('DECLARED', 'CONFIRMED', 'CORRECTED')
    AND (first_name_state IS NOT DISTINCT FROM 'CONFIRMED') = (first_name_confirmed_at IS NOT NULL)
    AND (sex_state IS NOT DISTINCT FROM 'CONFIRMED') = (sex_confirmed_at IS NOT NULL)
    AND (birth_state IS NOT DISTINCT FROM 'CONFIRMED') = (birth_confirmed_at IS NOT NULL)
    AND (area_state IS NOT DISTINCT FROM 'CONFIRMED') = (area_confirmed_at IS NOT NULL)
    AND (marital_state IS NOT DISTINCT FROM 'CONFIRMED') = (marital_confirmed_at IS NOT NULL))
);

CREATE TABLE introductions_preparation_private.notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  origin text NOT NULL,
  body text NOT NULL,
  source_memory_id uuid,
  -- clock_timestamp(): notes added in one transaction keep the order they were added in.
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT notes_pk PRIMARY KEY (id),
  CONSTRAINT notes_draft_fk FOREIGN KEY (user_id)
    REFERENCES introductions_preparation_private.drafts (user_id) ON DELETE CASCADE,
  CONSTRAINT notes_kind_check CHECK (kind IN ('ABOUT_ME', 'WHAT_MATTERS')),
  CONSTRAINT notes_origin_check CHECK (origin IN ('USER_AUTHORED', 'CONFIRMED_FROM_PRIOR_UNDERSTANDING',
    'CORRECTED_FROM_PRIOR_UNDERSTANDING')),
  CONSTRAINT notes_body_check CHECK (char_length(body) BETWEEN 2 AND 500 AND body = btrim(body) AND body !~ '[[:cntrl:]]'),
  -- Only a note that came from a prior-understanding item names that item; a user-authored note names none.
  CONSTRAINT notes_source_check CHECK ((origin = 'USER_AUTHORED') = (source_memory_id IS NULL))
);
CREATE INDEX notes_user_idx ON introductions_preparation_private.notes (user_id, created_at);

-- The owner's decision on each prior-understanding item QANDEEL showed. No content, and no foreign key to Memory:
-- a forgotten Memory leaves only an opaque id in the owner's own erasable draft.
CREATE TABLE introductions_preparation_private.prior_understanding_decisions (
  user_id uuid NOT NULL,
  memory_id uuid NOT NULL,
  decision text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT prior_understanding_decisions_pk PRIMARY KEY (user_id, memory_id),
  CONSTRAINT prior_understanding_decisions_draft_fk FOREIGN KEY (user_id)
    REFERENCES introductions_preparation_private.drafts (user_id) ON DELETE CASCADE,
  CONSTRAINT prior_understanding_decisions_decision_check
    CHECK (decision IN ('CONFIRMED', 'CORRECTED', 'NO_LONGER_ACCURATE', 'DECLINED'))
);

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. The MATCHING_ONBOARDING_ASSISTANCE consent (CW2-06A §3).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE introductions_preparation_private.assistance_consents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  consent_version text NOT NULL,
  granted_at timestamptz NOT NULL,
  grant_command_id uuid NOT NULL,
  revoked_at timestamptz,
  revoke_command_id uuid,
  CONSTRAINT assistance_consents_pk PRIMARY KEY (id),
  CONSTRAINT assistance_consents_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT assistance_consents_version_fk FOREIGN KEY (consent_version)
    REFERENCES introductions_preparation_private.consent_texts (consent_version) ON DELETE RESTRICT,
  CONSTRAINT assistance_consents_revocation_check CHECK ((revoked_at IS NULL) = (revoke_command_id IS NULL)
    AND (revoked_at IS NULL OR revoked_at >= granted_at))
);
CREATE UNIQUE INDEX assistance_consents_one_current
  ON introductions_preparation_private.assistance_consents (user_id) WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. The command ledger: each APPLIED owner command once. It holds no content: the kind, a request fingerprint, the
--    outcome and the version it produced.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE introductions_preparation_private.command_ledger (
  user_id uuid NOT NULL,
  command_id uuid NOT NULL,
  command_kind text NOT NULL,
  fingerprint text NOT NULL,
  outcome text NOT NULL,
  result_version bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT command_ledger_pk PRIMARY KEY (user_id, command_id),
  CONSTRAINT command_ledger_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT command_ledger_kind_check CHECK (command_kind IN ('SET_FACT', 'CONFIRM_FACT', 'SET_PROFILE',
    'SET_REQUIREMENTS', 'ADD_NOTE', 'REMOVE_NOTE', 'RECORD_PRIOR_UNDERSTANDING', 'SKIP_STEP', 'CONFIRM_REVIEW',
    'DISCARD', 'GRANT_ASSISTANCE', 'REVOKE_ASSISTANCE')),
  CONSTRAINT command_ledger_fingerprint_check CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT command_ledger_outcome_check CHECK (outcome IN ('APPLIED', 'DISCARDED', 'GRANTED', 'REVOKED')),
  CONSTRAINT command_ledger_version_check CHECK (result_version >= 0)
);

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. Pure helpers (IMMUTABLE; no table access).
-- ---------------------------------------------------------------------------------------------------------------------

-- An object holding exactly these keys.
CREATE FUNCTION introductions_preparation_private.has_exact_keys_v1(p_value jsonb, p_keys text[])
RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_value) = 'object'
     AND coalesce((SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_value) AS k), '{}'::text[])
       = coalesce((SELECT array_agg(k ORDER BY k) FROM unnest(p_keys) AS k), '{}'::text[])
$$;

-- A JSON whole number in [p_min, p_max], or NULL.
CREATE FUNCTION introductions_preparation_private.whole_number_v1(p_value jsonb, p_min integer, p_max integer)
RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN jsonb_typeof(p_value) = 'number' AND (p_value #>> '{}') ~ '^[0-9]{1,6}$'
                   AND (p_value #>> '{}')::integer BETWEEN p_min AND p_max
              THEN (p_value #>> '{}')::integer END
$$;

-- A JSON array of distinct strings, each in the allowed set, non-empty; or NULL.
CREATE FUNCTION introductions_preparation_private.string_set_v1(p_value jsonb, p_allowed text[])
RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN jsonb_typeof(p_value) = 'array' AND jsonb_array_length(p_value) BETWEEN 1 AND 64
                   AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_value) e
                                    WHERE jsonb_typeof(e) <> 'string' OR NOT ((e #>> '{}') = ANY (p_allowed)))
                   AND (SELECT count(DISTINCT e #>> '{}') FROM jsonb_array_elements(p_value) e) = jsonb_array_length(p_value)
              THEN (SELECT array_agg(e #>> '{}' ORDER BY e #>> '{}') FROM jsonb_array_elements(p_value) e) END
$$;

-- The dimensions on which a soft preference falls outside the hard requirement of the same dimension (S6-01 record
-- §4.2). Items are already validated. Sorted, distinct.
CREATE FUNCTION introductions_preparation_private.requirement_discrepancies_v1(p_hard jsonb, p_soft jsonb)
RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(array_agg(DISTINCT s ->> 'dimension' ORDER BY s ->> 'dimension'), '{}'::text[])
    FROM jsonb_array_elements(p_soft) s
    JOIN jsonb_array_elements(p_hard) h ON h ->> 'dimension' = s ->> 'dimension'
   WHERE CASE s ->> 'dimension'
           WHEN 'AGE_RANGE' THEN (s ->> 'min')::integer < (h ->> 'min')::integer OR (s ->> 'max')::integer > (h ->> 'max')::integer
           WHEN 'MARITAL_STATUS' THEN NOT ((s -> 'accepted') <@ (h -> 'accepted'))
           WHEN 'AREA' THEN (s ->> 'countryCode') <> (h ->> 'countryCode')
                         OR (h ? 'regionCodes' AND NOT (s ? 'regionCodes' AND (s -> 'regionCodes') <@ (h -> 'regionCodes')))
           ELSE true END
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. Internal steps of every owner command.
-- ---------------------------------------------------------------------------------------------------------------------

-- Lock order steps 1-2, then the owner's live deletion. Returns true when a deletion is live.
CREATE FUNCTION introductions_preparation_private.enter_owner_command_v1(p_user uuid)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user IS NULL THEN RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.users u WHERE u.id = p_user FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_PREPARATION_ACCOUNT_NOT_FOUND' USING ERRCODE = '42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qandeel:introductions-preparation:' || p_user::text, 0));
  RETURN EXISTS (SELECT 1 FROM personal_data_private.account_deletions d
                  WHERE d.user_id = p_user AND d.status IN ('SCHEDULED', 'BLOCKED', 'ERASED', 'COMPLETED'));
END$$;

-- The first answer of an already applied command, or a refusal of a reused id; NULL when the id is new.
CREATE FUNCTION introductions_preparation_private.replay_v1(p_user uuid, p_command_id uuid, p_kind text, p_fingerprint text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN l.command_kind = p_kind AND l.fingerprint = p_fingerprint
              THEN jsonb_build_object('outcome', l.outcome, 'version', l.result_version, 'replayed', true)
              ELSE jsonb_build_object('outcome', 'COMMAND_ID_REUSED') END
    FROM introductions_preparation_private.command_ledger l
   WHERE l.user_id = p_user AND l.command_id = p_command_id
$$;

CREATE FUNCTION introductions_preparation_private.fingerprint_v1(p_kind text, p_expected_version bigint, p_payload jsonb)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT encode(sha256(convert_to(p_kind || '|' || coalesce(p_expected_version::text, '-') || '|' || coalesce(p_payload::text, 'null'), 'UTF8')), 'hex')
$$;

-- The current version of the owner's draft (0 when none).
CREATE FUNCTION introductions_preparation_private.draft_version_v1(p_user uuid)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT d.draft_version FROM introductions_preparation_private.drafts d WHERE d.user_id = p_user), 0)
$$;

-- One of the owner's own Memories, exactly as CW2-06A §3.2 admits it, locked FOR SHARE; NULL when it does not qualify.
CREATE FUNCTION introductions_preparation_private.eligible_prior_item_v1(p_user uuid, p_memory_id uuid)
RETURNS TABLE (memory_type text, content text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  SELECT m.type, m.content
    FROM public.memories m
   WHERE m.id = p_memory_id AND m.user_id = p_user AND m.status = 'ACTIVE'
     AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
     AND m.source IN ('USER_STATED', 'USER_CONFIRMED')
     AND m.type IN ('PERSONAL_FACT', 'STABLE_PREFERENCE', 'GOAL', 'DECISION_COMMITMENT')
     AND char_length(btrim(m.content)) BETWEEN 2 AND 500 AND m.content !~ '[[:cntrl:]]'
     AND EXISTS (SELECT 1 FROM public.memory_subject_attributions a
                  WHERE a.memory_id = m.id AND a.user_id = p_user AND a.subject = 'SELF')
   FOR SHARE OF m;
END$$;

-- Validates one requirement item set for a strength and returns it in canonical form, or raises 22023.
CREATE FUNCTION introductions_preparation_private.canonical_requirement_items_v1(p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_item jsonb;
  v_out jsonb := '[]'::jsonb;
  v_seen text[] := '{}';
  v_dim text;
  v_min integer;
  v_max integer;
  v_set text[];
  v_country text;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_REQUIREMENTS' USING ERRCODE = '22023';
  END IF;
  FOR v_item IN SELECT e FROM jsonb_array_elements(p_items) e LOOP
    v_dim := v_item ->> 'dimension';
    IF jsonb_typeof(v_item) <> 'object' OR v_dim IS NULL OR v_dim = ANY (v_seen) THEN
      RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_REQUIREMENTS' USING ERRCODE = '22023';
    END IF;
    v_seen := v_seen || v_dim;
    IF v_dim = 'AGE_RANGE' AND introductions_preparation_private.has_exact_keys_v1(v_item, ARRAY['dimension', 'min', 'max']) THEN
      v_min := introductions_preparation_private.whole_number_v1(v_item -> 'min', 18, 99);
      v_max := introductions_preparation_private.whole_number_v1(v_item -> 'max', 18, 99);
      IF v_min IS NULL OR v_max IS NULL OR v_min > v_max THEN
        RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_REQUIREMENTS' USING ERRCODE = '22023';
      END IF;
      v_out := v_out || jsonb_build_array(jsonb_build_object('dimension', v_dim, 'min', v_min, 'max', v_max));
    ELSIF v_dim = 'MARITAL_STATUS' AND introductions_preparation_private.has_exact_keys_v1(v_item, ARRAY['dimension', 'accepted']) THEN
      v_set := introductions_preparation_private.string_set_v1(v_item -> 'accepted',
                 ARRAY['NEVER_MARRIED', 'DIVORCED', 'WIDOWED', 'CURRENTLY_MARRIED']);
      IF v_set IS NULL THEN RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_REQUIREMENTS' USING ERRCODE = '22023'; END IF;
      v_out := v_out || jsonb_build_array(jsonb_build_object('dimension', v_dim, 'accepted', to_jsonb(v_set)));
    ELSIF v_dim = 'AREA' AND (introductions_preparation_private.has_exact_keys_v1(v_item, ARRAY['dimension', 'countryCode'])
                           OR introductions_preparation_private.has_exact_keys_v1(v_item, ARRAY['dimension', 'countryCode', 'regionCodes'])) THEN
      v_country := v_item ->> 'countryCode';
      IF jsonb_typeof(v_item -> 'countryCode') <> 'string' OR NOT EXISTS (
           SELECT 1 FROM introductions_preparation_private.area_countries c WHERE c.country_code = v_country) THEN
        RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_REQUIREMENTS' USING ERRCODE = '22023';
      END IF;
      IF v_item ? 'regionCodes' THEN
        v_set := introductions_preparation_private.string_set_v1(v_item -> 'regionCodes',
                   ARRAY(SELECT r.region_code FROM introductions_preparation_private.area_regions r WHERE r.country_code = v_country));
        IF v_set IS NULL THEN RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_REQUIREMENTS' USING ERRCODE = '22023'; END IF;
        v_out := v_out || jsonb_build_array(jsonb_build_object('dimension', v_dim, 'countryCode', v_country, 'regionCodes', to_jsonb(v_set)));
      ELSE
        v_out := v_out || jsonb_build_array(jsonb_build_object('dimension', v_dim, 'countryCode', v_country));
      END IF;
    ELSE
      RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_REQUIREMENTS' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  RETURN v_out;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. The draft command core. Not executable by any application role; the owner entry point calls it with auth.uid().
--
--    Outcomes that change nothing (and are not ledgered, so a retry is judged again): UNAVAILABLE (a gate denies),
--    ACCOUNT_DELETION_PENDING, STALE_VERSION, COMMAND_ID_REUSED, NOT_ELIGIBLE (no current assistance consent, or the
--    Memory no longer qualifies), ALREADY_DECIDED, NOTE_LIMIT_REACHED, NOTHING_TO_CONFIRM, NOT_READY_FOR_REVIEW.
--    An invalid request raises 22023 before anything is written.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION introductions_preparation_private.apply_command_v1(
  p_user uuid, p_command_id uuid, p_expected_version bigint, p_kind text, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_fingerprint text;
  v_replay jsonb;
  v_draft introductions_preparation_private.drafts;
  v_facts introductions_preparation_private.declared_facts;
  v_version bigint;
  v_next bigint;
  v_fact text;
  v_text text;
  v_year integer;
  v_month integer;
  v_country text;
  v_region text;
  v_state text;
  v_items jsonb;
  v_answer text;
  v_strength text;
  v_item record;
  v_decision text;
  v_memory uuid;
  v_kind text;
  v_note uuid;
  v_now timestamptz := CURRENT_TIMESTAMP;
BEGIN
  IF p_command_id IS NULL OR p_expected_version IS NULL OR p_expected_version < 0 OR p_kind IS NULL
     OR p_kind NOT IN ('SET_FACT', 'CONFIRM_FACT', 'SET_PROFILE', 'SET_REQUIREMENTS', 'ADD_NOTE', 'REMOVE_NOTE',
                       'RECORD_PRIOR_UNDERSTANDING', 'SKIP_STEP', 'CONFIRM_REVIEW')
     OR jsonb_typeof(v_payload) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_COMMAND' USING ERRCODE = '22023';
  END IF;

  -- Lock order 1-2; then a replay answers its first result, whatever has changed since.
  IF introductions_preparation_private.enter_owner_command_v1(p_user) THEN
    v_fingerprint := introductions_preparation_private.fingerprint_v1(p_kind, p_expected_version, v_payload);
    v_replay := introductions_preparation_private.replay_v1(p_user, p_command_id, p_kind, v_fingerprint);
    RETURN coalesce(v_replay, jsonb_build_object('outcome', 'ACCOUNT_DELETION_PENDING'));
  END IF;
  v_fingerprint := introductions_preparation_private.fingerprint_v1(p_kind, p_expected_version, v_payload);
  v_replay := introductions_preparation_private.replay_v1(p_user, p_command_id, p_kind, v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  -- Lock order 3.
  IF introductions_preparation_private.bind_gate_v1('PREPARATION') <> 'ALLOW' THEN
    RETURN jsonb_build_object('outcome', 'UNAVAILABLE');
  END IF;

  -- Lock order 3-4 for a decision on a prior-understanding item: the permission is re-validated now, in this
  -- transaction, and held until it ends, so a revocation either commits first (refusal) or waits for this command.
  IF p_kind = 'RECORD_PRIOR_UNDERSTANDING' THEN
    IF introductions_preparation_private.bind_gate_v1('ONBOARDING_ASSISTANCE') <> 'ALLOW' THEN
      RETURN jsonb_build_object('outcome', 'UNAVAILABLE');
    END IF;
    PERFORM 1 FROM introductions_preparation_private.assistance_consents c
      WHERE c.user_id = p_user AND c.revoked_at IS NULL FOR SHARE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('outcome', 'NOT_ELIGIBLE', 'version', introductions_preparation_private.draft_version_v1(p_user));
    END IF;
  END IF;

  -- Lock order 5.
  SELECT * INTO v_draft FROM introductions_preparation_private.drafts d WHERE d.user_id = p_user FOR UPDATE;
  v_version := coalesce(v_draft.draft_version, 0);
  IF v_version <> p_expected_version THEN
    RETURN jsonb_build_object('outcome', 'STALE_VERSION', 'version', v_version);
  END IF;
  v_next := v_version + 1;

  IF v_draft.user_id IS NULL THEN
    INSERT INTO introductions_preparation_private.drafts (user_id, draft_version, created_at, updated_at)
    VALUES (p_user, 1, v_now, v_now) RETURNING * INTO v_draft;
    INSERT INTO introductions_preparation_private.declared_facts (user_id) VALUES (p_user);
    v_next := 1;
  END IF;
  SELECT * INTO v_facts FROM introductions_preparation_private.declared_facts f WHERE f.user_id = p_user FOR UPDATE;

  IF p_kind = 'SET_FACT' THEN
    v_fact := v_payload ->> 'fact';
    IF v_fact = 'INTRODUCTION_FIRST_NAME' AND introductions_preparation_private.has_exact_keys_v1(v_payload, ARRAY['fact', 'firstName'])
       AND jsonb_typeof(v_payload -> 'firstName') = 'string' THEN
      v_text := btrim(v_payload ->> 'firstName');
      v_state := CASE WHEN v_facts.first_name IS NOT DISTINCT FROM v_text THEN v_facts.first_name_state
                      WHEN v_facts.first_name_state IN ('CONFIRMED', 'CORRECTED') THEN 'CORRECTED' ELSE 'DECLARED' END;
      UPDATE introductions_preparation_private.declared_facts SET first_name = v_text, first_name_state = v_state,
             first_name_confirmed_at = CASE WHEN v_state = 'CONFIRMED' THEN first_name_confirmed_at END
       WHERE user_id = p_user;
    ELSIF v_fact = 'SEX' AND introductions_preparation_private.has_exact_keys_v1(v_payload, ARRAY['fact', 'sex'])
          AND (v_payload ->> 'sex') IN ('MALE', 'FEMALE') AND jsonb_typeof(v_payload -> 'sex') = 'string' THEN
      v_text := v_payload ->> 'sex';
      v_state := CASE WHEN v_facts.sex IS NOT DISTINCT FROM v_text THEN v_facts.sex_state
                      WHEN v_facts.sex_state IN ('CONFIRMED', 'CORRECTED') THEN 'CORRECTED' ELSE 'DECLARED' END;
      UPDATE introductions_preparation_private.declared_facts SET sex = v_text, sex_state = v_state,
             sex_confirmed_at = CASE WHEN v_state = 'CONFIRMED' THEN sex_confirmed_at END
       WHERE user_id = p_user;
    ELSIF v_fact = 'BIRTH_YEAR_MONTH' AND introductions_preparation_private.has_exact_keys_v1(v_payload, ARRAY['fact', 'year', 'month']) THEN
      v_year := introductions_preparation_private.whole_number_v1(v_payload -> 'year', 1900, extract(year FROM v_now)::integer);
      v_month := introductions_preparation_private.whole_number_v1(v_payload -> 'month', 1, 12);
      IF v_year IS NULL OR v_month IS NULL OR make_date(v_year, v_month, 1) > v_now::date THEN
        RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_COMMAND' USING ERRCODE = '22023';
      END IF;
      v_state := CASE WHEN v_facts.birth_year IS NOT DISTINCT FROM v_year::smallint AND v_facts.birth_month IS NOT DISTINCT FROM v_month::smallint
                        THEN v_facts.birth_state
                      WHEN v_facts.birth_state IN ('CONFIRMED', 'CORRECTED') THEN 'CORRECTED' ELSE 'DECLARED' END;
      UPDATE introductions_preparation_private.declared_facts SET birth_year = v_year, birth_month = v_month, birth_state = v_state,
             birth_confirmed_at = CASE WHEN v_state = 'CONFIRMED' THEN birth_confirmed_at END
       WHERE user_id = p_user;
    ELSIF v_fact = 'BROAD_AREA' AND introductions_preparation_private.has_exact_keys_v1(v_payload, ARRAY['fact', 'countryCode', 'regionCode'])
          AND jsonb_typeof(v_payload -> 'countryCode') = 'string'
          AND jsonb_typeof(v_payload -> 'regionCode') IN ('string', 'null') THEN
      v_country := v_payload ->> 'countryCode';
      v_region := v_payload ->> 'regionCode';
      -- A country whose regions are listed needs one of them; a country without listed regions takes none.
      IF NOT EXISTS (SELECT 1 FROM introductions_preparation_private.area_countries c
                      WHERE c.country_code = v_country
                        AND ((c.regions_listed AND v_region IS NOT NULL AND EXISTS (
                               SELECT 1 FROM introductions_preparation_private.area_regions r
                                WHERE r.country_code = v_country AND r.region_code = v_region))
                          OR (NOT c.regions_listed AND v_region IS NULL))) THEN
        RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_COMMAND' USING ERRCODE = '22023';
      END IF;
      v_state := CASE WHEN v_facts.country_code IS NOT DISTINCT FROM v_country AND v_facts.region_code IS NOT DISTINCT FROM v_region
                        THEN v_facts.area_state
                      WHEN v_facts.area_state IN ('CONFIRMED', 'CORRECTED') THEN 'CORRECTED' ELSE 'DECLARED' END;
      UPDATE introductions_preparation_private.declared_facts SET country_code = v_country, region_code = v_region, area_state = v_state,
             area_confirmed_at = CASE WHEN v_state = 'CONFIRMED' THEN area_confirmed_at END
       WHERE user_id = p_user;
    ELSIF v_fact = 'MARITAL_STATUS' AND introductions_preparation_private.has_exact_keys_v1(v_payload, ARRAY['fact', 'maritalStatus'])
          AND jsonb_typeof(v_payload -> 'maritalStatus') = 'string'
          AND (v_payload ->> 'maritalStatus') IN ('NEVER_MARRIED', 'DIVORCED', 'WIDOWED', 'CURRENTLY_MARRIED') THEN
      v_text := v_payload ->> 'maritalStatus';
      v_state := CASE WHEN v_facts.marital_status IS NOT DISTINCT FROM v_text THEN v_facts.marital_state
                      WHEN v_facts.marital_state IN ('CONFIRMED', 'CORRECTED') THEN 'CORRECTED' ELSE 'DECLARED' END;
      UPDATE introductions_preparation_private.declared_facts SET marital_status = v_text, marital_state = v_state,
             marital_confirmed_at = CASE WHEN v_state = 'CONFIRMED' THEN marital_confirmed_at END
       WHERE user_id = p_user;
    ELSE
      RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_COMMAND' USING ERRCODE = '22023';
    END IF;

  ELSIF p_kind = 'CONFIRM_FACT' THEN
    v_fact := v_payload ->> 'fact';
    IF NOT introductions_preparation_private.has_exact_keys_v1(v_payload, ARRAY['fact'])
       OR v_fact IS NULL OR v_fact NOT IN ('INTRODUCTION_FIRST_NAME', 'SEX', 'BIRTH_YEAR_MONTH', 'BROAD_AREA', 'MARITAL_STATUS') THEN
      RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_COMMAND' USING ERRCODE = '22023';
    END IF;
    v_state := CASE v_fact WHEN 'INTRODUCTION_FIRST_NAME' THEN v_facts.first_name_state WHEN 'SEX' THEN v_facts.sex_state
                           WHEN 'BIRTH_YEAR_MONTH' THEN v_facts.birth_state WHEN 'BROAD_AREA' THEN v_facts.area_state
                           ELSE v_facts.marital_state END;
    IF v_state IS NULL OR v_state = 'CONFIRMED' THEN
      -- Nothing to confirm: a first draft created by this command would be an empty draft, so nothing is kept.
      IF v_version = 0 THEN
        DELETE FROM introductions_preparation_private.drafts WHERE user_id = p_user;
      END IF;
      RETURN jsonb_build_object('outcome', 'NOTHING_TO_CONFIRM', 'version', v_version);
    END IF;
    UPDATE introductions_preparation_private.declared_facts SET
      first_name_state = CASE WHEN v_fact = 'INTRODUCTION_FIRST_NAME' THEN 'CONFIRMED' ELSE first_name_state END,
      first_name_confirmed_at = CASE WHEN v_fact = 'INTRODUCTION_FIRST_NAME' THEN v_now ELSE first_name_confirmed_at END,
      sex_state = CASE WHEN v_fact = 'SEX' THEN 'CONFIRMED' ELSE sex_state END,
      sex_confirmed_at = CASE WHEN v_fact = 'SEX' THEN v_now ELSE sex_confirmed_at END,
      birth_state = CASE WHEN v_fact = 'BIRTH_YEAR_MONTH' THEN 'CONFIRMED' ELSE birth_state END,
      birth_confirmed_at = CASE WHEN v_fact = 'BIRTH_YEAR_MONTH' THEN v_now ELSE birth_confirmed_at END,
      area_state = CASE WHEN v_fact = 'BROAD_AREA' THEN 'CONFIRMED' ELSE area_state END,
      area_confirmed_at = CASE WHEN v_fact = 'BROAD_AREA' THEN v_now ELSE area_confirmed_at END,
      marital_state = CASE WHEN v_fact = 'MARITAL_STATUS' THEN 'CONFIRMED' ELSE marital_state END,
      marital_confirmed_at = CASE WHEN v_fact = 'MARITAL_STATUS' THEN v_now ELSE marital_confirmed_at END
     WHERE user_id = p_user;

  ELSIF p_kind = 'SET_PROFILE' THEN
    IF NOT introductions_preparation_private.has_exact_keys_v1(v_payload, ARRAY['shortIntroduction', 'workField'])
       OR jsonb_typeof(v_payload -> 'shortIntroduction') NOT IN ('string', 'null')
       OR jsonb_typeof(v_payload -> 'workField') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_COMMAND' USING ERRCODE = '22023';
    END IF;
    UPDATE introductions_preparation_private.drafts SET
      short_introduction = btrim(v_payload ->> 'shortIntroduction'),
      work_field = v_payload ->> 'workField',
      skipped_steps = ARRAY(SELECT s FROM unnest(skipped_steps) s
                             WHERE NOT (s = 'SHORT_INTRODUCTION' AND v_payload ->> 'shortIntroduction' IS NOT NULL)
                               AND NOT (s = 'WORK_FIELD' AND v_payload ->> 'workField' IS NOT NULL))
     WHERE user_id = p_user;

  ELSIF p_kind = 'SET_REQUIREMENTS' THEN
    v_strength := v_payload ->> 'strength';
    v_answer := v_payload ->> 'answer';
    IF NOT introductions_preparation_private.has_exact_keys_v1(v_payload, ARRAY['strength', 'answer', 'items'])
       OR v_strength IS NULL OR v_strength NOT IN ('HARD', 'SOFT')
       OR v_answer IS NULL OR NOT ((v_strength = 'HARD' AND v_answer IN ('NONE_ADDITIONAL', 'ITEMS'))
                                OR (v_strength = 'SOFT' AND v_answer IN ('NONE', 'ITEMS')))
       OR jsonb_typeof(v_payload -> 'items') <> 'array'
       OR (v_answer <> 'ITEMS' AND jsonb_array_length(v_payload -> 'items') <> 0) THEN
      RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_COMMAND' USING ERRCODE = '22023';
    END IF;
    v_items := CASE WHEN v_answer = 'ITEMS'
                    THEN introductions_preparation_private.canonical_requirement_items_v1(v_payload -> 'items')
                    ELSE '[]'::jsonb END;
    IF v_strength = 'HARD' THEN
      UPDATE introductions_preparation_private.drafts SET hard_answer = v_answer, hard_items = v_items WHERE user_id = p_user;
    ELSE
      UPDATE introductions_preparation_private.drafts SET soft_answer = v_answer, soft_items = v_items WHERE user_id = p_user;
    END IF;

  ELSIF p_kind = 'ADD_NOTE' THEN
    IF NOT introductions_preparation_private.has_exact_keys_v1(v_payload, ARRAY['kind', 'body'])
       OR jsonb_typeof(v_payload -> 'body') <> 'string' OR (v_payload ->> 'kind') IS NULL
       OR (v_payload ->> 'kind') NOT IN ('ABOUT_ME', 'WHAT_MATTERS') THEN
      RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_COMMAND' USING ERRCODE = '22023';
    END IF;
    IF (SELECT count(*) FROM introductions_preparation_private.notes n WHERE n.user_id = p_user) >= 8 THEN
      RETURN jsonb_build_object('outcome', 'NOTE_LIMIT_REACHED', 'version', v_version);
    END IF;
    INSERT INTO introductions_preparation_private.notes (user_id, kind, origin, body)
    VALUES (p_user, v_payload ->> 'kind', 'USER_AUTHORED', btrim(v_payload ->> 'body'));
    UPDATE introductions_preparation_private.drafts SET skipped_steps = array_remove(skipped_steps, 'NOTES') WHERE user_id = p_user;

  ELSIF p_kind = 'REMOVE_NOTE' THEN
    IF NOT introductions_preparation_private.has_exact_keys_v1(v_payload, ARRAY['noteId'])
       OR jsonb_typeof(v_payload -> 'noteId') <> 'string'
       OR (v_payload ->> 'noteId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_COMMAND' USING ERRCODE = '22023';
    END IF;
    DELETE FROM introductions_preparation_private.notes n WHERE n.id = (v_payload ->> 'noteId')::uuid AND n.user_id = p_user;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_COMMAND' USING ERRCODE = '22023';
    END IF;

  ELSIF p_kind = 'RECORD_PRIOR_UNDERSTANDING' THEN
    v_decision := v_payload ->> 'decision';
    IF NOT (introductions_preparation_private.has_exact_keys_v1(v_payload, ARRAY['memoryId', 'decision'])
            OR (v_decision = 'CORRECTED' AND introductions_preparation_private.has_exact_keys_v1(v_payload, ARRAY['memoryId', 'decision', 'correctedBody'])
                AND jsonb_typeof(v_payload -> 'correctedBody') = 'string'))
       OR jsonb_typeof(v_payload -> 'memoryId') <> 'string'
       OR (v_payload ->> 'memoryId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR v_decision IS NULL OR v_decision NOT IN ('CONFIRMED', 'CORRECTED', 'NO_LONGER_ACCURATE', 'DECLINED') THEN
      RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_COMMAND' USING ERRCODE = '22023';
    END IF;
    v_memory := (v_payload ->> 'memoryId')::uuid;
    -- The assistance gate and the current consent were bound above (lock order 3-4), in this transaction.
    IF EXISTS (SELECT 1 FROM introductions_preparation_private.prior_understanding_decisions x
                WHERE x.user_id = p_user AND x.memory_id = v_memory) THEN
      RETURN jsonb_build_object('outcome', 'ALREADY_DECIDED', 'version', v_version);
    END IF;
    -- Lock order 6: the item is re-read under CW2-06A §3.2 now; a client cannot assert where a note came from.
    SELECT i.memory_type, i.content INTO v_kind, v_text
      FROM introductions_preparation_private.eligible_prior_item_v1(p_user, v_memory) i;
    IF v_kind IS NULL THEN
      IF v_version = 0 THEN DELETE FROM introductions_preparation_private.drafts WHERE user_id = p_user; END IF;
      RETURN jsonb_build_object('outcome', 'NOT_ELIGIBLE', 'version', v_version);
    END IF;
    IF v_decision IN ('CONFIRMED', 'CORRECTED') THEN
      IF (SELECT count(*) FROM introductions_preparation_private.notes n WHERE n.user_id = p_user) >= 8 THEN
        RETURN jsonb_build_object('outcome', 'NOTE_LIMIT_REACHED', 'version', v_version);
      END IF;
      INSERT INTO introductions_preparation_private.notes (user_id, kind, origin, body, source_memory_id)
      VALUES (p_user,
              CASE WHEN v_kind = 'PERSONAL_FACT' THEN 'ABOUT_ME' ELSE 'WHAT_MATTERS' END,
              CASE WHEN v_decision = 'CONFIRMED' THEN 'CONFIRMED_FROM_PRIOR_UNDERSTANDING' ELSE 'CORRECTED_FROM_PRIOR_UNDERSTANDING' END,
              CASE WHEN v_decision = 'CONFIRMED' THEN btrim(v_text) ELSE btrim(v_payload ->> 'correctedBody') END,
              v_memory);
    END IF;
    INSERT INTO introductions_preparation_private.prior_understanding_decisions (user_id, memory_id, decision)
    VALUES (p_user, v_memory, v_decision);

  ELSIF p_kind = 'SKIP_STEP' THEN
    IF NOT introductions_preparation_private.has_exact_keys_v1(v_payload, ARRAY['step'])
       OR (v_payload ->> 'step') IS NULL
       OR (v_payload ->> 'step') NOT IN ('NOTES', 'SHORT_INTRODUCTION', 'WORK_FIELD', 'ASSISTANCE_OFFER', 'PRIOR_UNDERSTANDING') THEN
      RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_COMMAND' USING ERRCODE = '22023';
    END IF;
    UPDATE introductions_preparation_private.drafts
       SET skipped_steps = ARRAY(SELECT DISTINCT s FROM unnest(skipped_steps || (v_payload ->> 'step')) s ORDER BY s)
     WHERE user_id = p_user;

  ELSIF p_kind = 'CONFIRM_REVIEW' THEN
    IF NOT introductions_preparation_private.has_exact_keys_v1(v_payload, ARRAY[]::text[]) THEN
      RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_COMMAND' USING ERRCODE = '22023';
    END IF;
    IF v_version = 0
       OR v_facts.first_name_state IS DISTINCT FROM 'CONFIRMED' OR v_facts.sex_state IS DISTINCT FROM 'CONFIRMED'
       OR v_facts.birth_state IS DISTINCT FROM 'CONFIRMED' OR v_facts.area_state IS DISTINCT FROM 'CONFIRMED'
       OR v_facts.marital_state IS DISTINCT FROM 'CONFIRMED'
       OR v_draft.hard_answer IS NULL OR v_draft.soft_answer IS NULL
       OR cardinality(introductions_preparation_private.requirement_discrepancies_v1(v_draft.hard_items, v_draft.soft_items)) > 0 THEN
      IF v_version = 0 THEN DELETE FROM introductions_preparation_private.drafts WHERE user_id = p_user; END IF;
      RETURN jsonb_build_object('outcome', 'NOT_READY_FOR_REVIEW', 'version', v_version);
    END IF;
    UPDATE introductions_preparation_private.drafts SET draft_version = v_next, reviewed_version = v_next, reviewed_at = v_now
     WHERE user_id = p_user;
  END IF;

  UPDATE introductions_preparation_private.drafts SET draft_version = v_next, updated_at = v_now WHERE user_id = p_user;
  INSERT INTO introductions_preparation_private.command_ledger (user_id, command_id, command_kind, fingerprint, outcome, result_version)
  VALUES (p_user, p_command_id, p_kind, v_fingerprint, 'APPLIED', v_next);
  RETURN jsonb_build_object('outcome', 'APPLIED', 'version', v_next);
EXCEPTION
  -- A value the catalogue or a column rule refuses (a first name, a short introduction, a work field, a note) is an
  -- invalid request like any other: nothing above survives, and the caller sees the one refusal.
  WHEN check_violation THEN
    RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_COMMAND' USING ERRCODE = '22023';
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 9. Discard, and the assistance consent.
-- ---------------------------------------------------------------------------------------------------------------------

-- Removes the owner's draft (facts, notes and decisions with it) and revokes a current assistance consent. Allowed
-- whatever the gates and a live deletion say: it only removes the owner's own data.
CREATE FUNCTION introductions_preparation_private.discard_v1(p_user uuid, p_command_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_fingerprint text := introductions_preparation_private.fingerprint_v1('DISCARD', NULL, NULL);
  v_replay jsonb;
  v_removed boolean;
BEGIN
  IF p_command_id IS NULL THEN RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_COMMAND' USING ERRCODE = '22023'; END IF;
  PERFORM introductions_preparation_private.enter_owner_command_v1(p_user);
  v_replay := introductions_preparation_private.replay_v1(p_user, p_command_id, 'DISCARD', v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  UPDATE introductions_preparation_private.assistance_consents c
     SET revoked_at = CURRENT_TIMESTAMP, revoke_command_id = p_command_id
   WHERE c.user_id = p_user AND c.revoked_at IS NULL;
  DELETE FROM introductions_preparation_private.drafts d WHERE d.user_id = p_user;
  v_removed := FOUND;
  INSERT INTO introductions_preparation_private.command_ledger (user_id, command_id, command_kind, fingerprint, outcome, result_version)
  VALUES (p_user, p_command_id, 'DISCARD', v_fingerprint, 'DISCARDED', 0);
  RETURN jsonb_build_object('outcome', 'DISCARDED', 'version', 0, 'removedDraft', v_removed);
END$$;

CREATE FUNCTION introductions_preparation_private.grant_assistance_v1(p_user uuid, p_command_id uuid, p_consent_version text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_fingerprint text;
  v_replay jsonb;
  v_current introductions_preparation_private.assistance_consents;
BEGIN
  IF p_command_id IS NULL OR p_consent_version IS NULL THEN
    RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_COMMAND' USING ERRCODE = '22023';
  END IF;
  v_fingerprint := introductions_preparation_private.fingerprint_v1('GRANT_ASSISTANCE', NULL, to_jsonb(p_consent_version));
  IF introductions_preparation_private.enter_owner_command_v1(p_user) THEN
    v_replay := introductions_preparation_private.replay_v1(p_user, p_command_id, 'GRANT_ASSISTANCE', v_fingerprint);
    RETURN coalesce(v_replay, jsonb_build_object('outcome', 'ACCOUNT_DELETION_PENDING'));
  END IF;
  v_replay := introductions_preparation_private.replay_v1(p_user, p_command_id, 'GRANT_ASSISTANCE', v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  IF introductions_preparation_private.bind_gate_v1('PREPARATION') <> 'ALLOW'
     OR introductions_preparation_private.bind_gate_v1('ONBOARDING_ASSISTANCE') <> 'ALLOW' THEN
    RETURN jsonb_build_object('outcome', 'UNAVAILABLE');
  END IF;
  -- Only the version the catalogue holds as current may be granted: the user saw exactly that text.
  IF NOT EXISTS (SELECT 1 FROM introductions_preparation_private.consent_texts t
                  WHERE t.consent_version = p_consent_version AND t.is_current) THEN
    RETURN jsonb_build_object('outcome', 'CONSENT_VERSION_NOT_CURRENT');
  END IF;
  SELECT * INTO v_current FROM introductions_preparation_private.assistance_consents c
   WHERE c.user_id = p_user AND c.revoked_at IS NULL FOR UPDATE;
  IF v_current.id IS NOT NULL AND v_current.consent_version = p_consent_version THEN
    RETURN jsonb_build_object('outcome', 'ALREADY_GRANTED');
  END IF;
  IF v_current.id IS NOT NULL THEN
    UPDATE introductions_preparation_private.assistance_consents
       SET revoked_at = CURRENT_TIMESTAMP, revoke_command_id = p_command_id WHERE id = v_current.id;
  END IF;
  INSERT INTO introductions_preparation_private.assistance_consents (user_id, consent_version, granted_at, grant_command_id)
  VALUES (p_user, p_consent_version, CURRENT_TIMESTAMP, p_command_id);
  INSERT INTO introductions_preparation_private.command_ledger (user_id, command_id, command_kind, fingerprint, outcome, result_version)
  VALUES (p_user, p_command_id, 'GRANT_ASSISTANCE', v_fingerprint, 'GRANTED', introductions_preparation_private.draft_version_v1(p_user));
  RETURN jsonb_build_object('outcome', 'GRANTED');
END$$;

-- Revocation is always available: no gate and no live deletion stops a person withdrawing a permission.
CREATE FUNCTION introductions_preparation_private.revoke_assistance_v1(p_user uuid, p_command_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_fingerprint text := introductions_preparation_private.fingerprint_v1('REVOKE_ASSISTANCE', NULL, NULL);
  v_replay jsonb;
BEGIN
  IF p_command_id IS NULL THEN RAISE EXCEPTION 'INVALID_MATCHING_PREPARATION_COMMAND' USING ERRCODE = '22023'; END IF;
  PERFORM introductions_preparation_private.enter_owner_command_v1(p_user);
  v_replay := introductions_preparation_private.replay_v1(p_user, p_command_id, 'REVOKE_ASSISTANCE', v_fingerprint);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  UPDATE introductions_preparation_private.assistance_consents c
     SET revoked_at = CURRENT_TIMESTAMP, revoke_command_id = p_command_id
   WHERE c.user_id = p_user AND c.revoked_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('outcome', 'NOT_GRANTED'); END IF;
  INSERT INTO introductions_preparation_private.command_ledger (user_id, command_id, command_kind, fingerprint, outcome, result_version)
  VALUES (p_user, p_command_id, 'REVOKE_ASSISTANCE', v_fingerprint, 'REVOKED', introductions_preparation_private.draft_version_v1(p_user));
  RETURN jsonb_build_object('outcome', 'REVOKED');
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 10. Owner reads.
-- ---------------------------------------------------------------------------------------------------------------------

-- The bounded deterministic reader (CW2-06A §3.2-§3.3). Every call re-binds both gates and the current consent FOR
-- SHARE in this transaction, then reads the owner's own qualifying Memory: at most 12 items, newest first, words exactly
-- as stored, excluding every item the owner already decided on. CURRENT when stated or updated within the last 365
-- days, NEEDS_RECHECK otherwise (a deterministic age rule, nothing inferred). No row when anything does not hold.
CREATE FUNCTION introductions_preparation_private.read_own_assistance_items_v1()
RETURNS TABLE (memory_id uuid, memory_type text, content text, recency text, stated_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501'; END IF;
  IF introductions_preparation_private.bind_gate_v1('PREPARATION') <> 'ALLOW'
     OR introductions_preparation_private.bind_gate_v1('ONBOARDING_ASSISTANCE') <> 'ALLOW' THEN
    RETURN;
  END IF;
  PERFORM 1 FROM introductions_preparation_private.assistance_consents c
    WHERE c.user_id = v_user AND c.revoked_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RETURN; END IF;
  RETURN QUERY
  SELECT m.id, m.type, m.content,
         CASE WHEN m.updated_at >= CURRENT_TIMESTAMP - interval '365 days' THEN 'CURRENT' ELSE 'NEEDS_RECHECK' END,
         m.updated_at
    FROM public.memories m
   WHERE m.user_id = v_user AND m.status = 'ACTIVE'
     AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
     AND m.source IN ('USER_STATED', 'USER_CONFIRMED')
     AND m.type IN ('PERSONAL_FACT', 'STABLE_PREFERENCE', 'GOAL', 'DECISION_COMMITMENT')
     AND char_length(btrim(m.content)) BETWEEN 2 AND 500 AND m.content !~ '[[:cntrl:]]'
     AND EXISTS (SELECT 1 FROM public.memory_subject_attributions a
                  WHERE a.memory_id = m.id AND a.user_id = v_user AND a.subject = 'SELF')
     AND NOT EXISTS (SELECT 1 FROM introductions_preparation_private.prior_understanding_decisions x
                      WHERE x.user_id = v_user AND x.memory_id = m.id)
   ORDER BY m.updated_at DESC, m.id ASC
   LIMIT 12;
END$$;

-- Presentation hints: whether preparation and assistance are available now, that enrollment is not, and whether the
-- owner has a draft. Client flags never grant authority; every command binds the gates itself.
CREATE FUNCTION introductions_preparation_private.read_availability_v1()
RETURNS TABLE (preparation_available boolean, assistance_available boolean, enrollment_available boolean, has_draft boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT
    introductions_preparation_private.gate_open_v1('PREPARATION'),
    introductions_preparation_private.gate_open_v1('PREPARATION') AND introductions_preparation_private.gate_open_v1('ONBOARDING_ASSISTANCE'),
    false,
    EXISTS (SELECT 1 FROM introductions_preparation_private.drafts d WHERE d.user_id = v_user);
END$$;

-- The owner's whole preparation, as one document. Readable whatever the gates say: it is the owner's own data.
CREATE FUNCTION introductions_preparation_private.read_own_preparation_v1()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_draft introductions_preparation_private.drafts;
  v_facts introductions_preparation_private.declared_facts;
  v_consent introductions_preparation_private.assistance_consents;
  v_current_version text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'an authenticated caller is required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_draft FROM introductions_preparation_private.drafts d WHERE d.user_id = v_user;
  SELECT * INTO v_facts FROM introductions_preparation_private.declared_facts f WHERE f.user_id = v_user;
  SELECT * INTO v_consent FROM introductions_preparation_private.assistance_consents c
   WHERE c.user_id = v_user AND c.revoked_at IS NULL;
  SELECT t.consent_version INTO v_current_version FROM introductions_preparation_private.consent_texts t WHERE t.is_current;
  RETURN jsonb_build_object(
    'availability', jsonb_build_object(
      'preparation', introductions_preparation_private.gate_open_v1('PREPARATION'),
      'assistance', introductions_preparation_private.gate_open_v1('PREPARATION') AND introductions_preparation_private.gate_open_v1('ONBOARDING_ASSISTANCE'),
      'enrollment', false),
    'accountDeletionPending', EXISTS (SELECT 1 FROM personal_data_private.account_deletions d
                                       WHERE d.user_id = v_user AND d.status IN ('SCHEDULED', 'BLOCKED', 'ERASED', 'COMPLETED')),
    'assistance', jsonb_build_object(
      'consent', CASE WHEN v_consent.id IS NULL THEN 'NOT_GRANTED' ELSE 'GRANTED' END,
      'grantedVersion', v_consent.consent_version,
      'currentVersion', v_current_version),
    'draft', CASE WHEN v_draft.user_id IS NULL THEN NULL ELSE jsonb_build_object(
      'version', v_draft.draft_version,
      'facts', jsonb_build_object(
        'firstName', CASE WHEN v_facts.first_name IS NULL THEN NULL ELSE jsonb_build_object('value', v_facts.first_name, 'state', v_facts.first_name_state) END,
        'sex', CASE WHEN v_facts.sex IS NULL THEN NULL ELSE jsonb_build_object('value', v_facts.sex, 'state', v_facts.sex_state) END,
        'birthYearMonth', CASE WHEN v_facts.birth_year IS NULL THEN NULL ELSE jsonb_build_object('year', v_facts.birth_year, 'month', v_facts.birth_month, 'state', v_facts.birth_state) END,
        'area', CASE WHEN v_facts.country_code IS NULL THEN NULL ELSE jsonb_build_object('countryCode', v_facts.country_code, 'regionCode', v_facts.region_code, 'state', v_facts.area_state) END,
        'maritalStatus', CASE WHEN v_facts.marital_status IS NULL THEN NULL ELSE jsonb_build_object('value', v_facts.marital_status, 'state', v_facts.marital_state) END),
      'profile', jsonb_build_object('shortIntroduction', v_draft.short_introduction, 'workField', v_draft.work_field),
      'requirements', jsonb_build_object(
        'hard', jsonb_build_object('answer', v_draft.hard_answer, 'items', v_draft.hard_items),
        'soft', jsonb_build_object('answer', v_draft.soft_answer, 'items', v_draft.soft_items),
        'discrepancies', to_jsonb(introductions_preparation_private.requirement_discrepancies_v1(v_draft.hard_items, v_draft.soft_items))),
      'notes', coalesce((SELECT jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'origin', n.origin, 'body', n.body)
                                          ORDER BY n.created_at, n.id)
                           FROM introductions_preparation_private.notes n WHERE n.user_id = v_user), '[]'::jsonb),
      'priorUnderstandingDecisions', (SELECT count(*) FROM introductions_preparation_private.prior_understanding_decisions x WHERE x.user_id = v_user),
      'skippedSteps', to_jsonb(v_draft.skipped_steps),
      'review', jsonb_build_object(
        'state', CASE WHEN v_draft.reviewed_version IS NULL THEN 'NOT_REVIEWED'
                      WHEN v_draft.reviewed_version = v_draft.draft_version THEN 'REVIEWED' ELSE 'CHANGED_SINCE_REVIEW' END,
        'reviewedVersion', v_draft.reviewed_version)) END);
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 11. The owner entry points. Each derives the human from auth.uid() and nothing else; the public functions are
--     SECURITY INVOKER pass-throughs, so no exposed function takes an account parameter.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION introductions_preparation_private.apply_own_command_v1(
  p_command_id uuid, p_expected_version bigint, p_kind text, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN introductions_preparation_private.apply_command_v1((SELECT auth.uid()), p_command_id, p_expected_version, p_kind, p_payload);
END$$;

CREATE FUNCTION introductions_preparation_private.discard_own_v1(p_command_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN introductions_preparation_private.discard_v1((SELECT auth.uid()), p_command_id);
END$$;

CREATE FUNCTION introductions_preparation_private.grant_own_assistance_v1(p_command_id uuid, p_consent_version text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN introductions_preparation_private.grant_assistance_v1((SELECT auth.uid()), p_command_id, p_consent_version);
END$$;

CREATE FUNCTION introductions_preparation_private.revoke_own_assistance_v1(p_command_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN introductions_preparation_private.revoke_assistance_v1((SELECT auth.uid()), p_command_id);
END$$;

CREATE FUNCTION public.read_matching_preparation_availability_v1()
RETURNS TABLE (preparation_available boolean, assistance_available boolean, enrollment_available boolean, has_draft boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT a.preparation_available, a.assistance_available, a.enrollment_available, a.has_draft
    FROM introductions_preparation_private.read_availability_v1() a
$$;
CREATE FUNCTION public.read_own_matching_preparation_v1()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT introductions_preparation_private.read_own_preparation_v1()
$$;
CREATE FUNCTION public.apply_own_matching_preparation_command_v1(
  p_command_id uuid, p_expected_version bigint, p_kind text, p_payload jsonb)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT introductions_preparation_private.apply_own_command_v1(p_command_id, p_expected_version, p_kind, p_payload)
$$;
CREATE FUNCTION public.discard_own_matching_preparation_v1(p_command_id uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT introductions_preparation_private.discard_own_v1(p_command_id)
$$;
CREATE FUNCTION public.grant_own_matching_onboarding_assistance_v1(p_command_id uuid, p_consent_version text)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT introductions_preparation_private.grant_own_assistance_v1(p_command_id, p_consent_version)
$$;
CREATE FUNCTION public.revoke_own_matching_onboarding_assistance_v1(p_command_id uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT introductions_preparation_private.revoke_own_assistance_v1(p_command_id)
$$;
CREATE FUNCTION public.read_own_matching_onboarding_assistance_items_v1()
RETURNS TABLE (memory_id uuid, memory_type text, content text, recency text, stated_at timestamptz)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT i.memory_id, i.memory_type, i.content, i.recency, i.stated_at
    FROM introductions_preparation_private.read_own_assistance_items_v1() i
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 12. Privileges, every one explicit (0133 removed the hosted default privileges; nothing here relies on a default).
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT c.oid::regclass AS rel FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'introductions_preparation_private' AND c.relkind IN ('r', 'p') LOOP
    EXECUTE format('ALTER TABLE %s OWNER TO postgres', r.rel);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', r.rel);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC, anon, authenticated', r.rel);
  END LOOP;
  FOR r IN SELECT c.oid::regclass AS rel FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'introductions_preparation_private' AND c.relkind = 'S' LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', r.rel);
  END LOOP;
  FOR r IN SELECT p.oid::regprocedure AS fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'introductions_preparation_private'
               OR (n.nspname = 'public' AND p.proname IN ('read_matching_preparation_availability_v1',
                   'read_own_matching_preparation_v1', 'apply_own_matching_preparation_command_v1',
                   'discard_own_matching_preparation_v1', 'grant_own_matching_onboarding_assistance_v1',
                   'revoke_own_matching_onboarding_assistance_v1', 'read_own_matching_onboarding_assistance_items_v1')) LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', r.fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.fn);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    -- The server channel holds nothing here: every act is the owner's own, under the owner's token.
    EXECUTE 'REVOKE ALL ON SCHEMA introductions_preparation_private FROM service_role';
    FOR r IN SELECT c.oid::regclass AS rel, c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'introductions_preparation_private' AND c.relkind IN ('r', 'p', 'S') LOOP
      EXECUTE format(CASE WHEN r.relkind = 'S' THEN 'REVOKE ALL ON SEQUENCE %s FROM service_role'
                          ELSE 'REVOKE ALL ON TABLE %s FROM service_role' END, r.rel);
    END LOOP;
    FOR r IN SELECT p.oid::regprocedure AS fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'introductions_preparation_private'
                 OR (n.nspname = 'public' AND p.proname IN ('read_matching_preparation_availability_v1',
                     'read_own_matching_preparation_v1', 'apply_own_matching_preparation_command_v1',
                     'discard_own_matching_preparation_v1', 'grant_own_matching_onboarding_assistance_v1',
                     'revoke_own_matching_onboarding_assistance_v1', 'read_own_matching_onboarding_assistance_items_v1')) LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', r.fn);
    END LOOP;
  END IF;
END$$;

GRANT USAGE ON SCHEMA introductions_preparation_private TO authenticated;
GRANT EXECUTE ON FUNCTION
  introductions_preparation_private.read_availability_v1(),
  introductions_preparation_private.read_own_preparation_v1(),
  introductions_preparation_private.apply_own_command_v1(uuid, bigint, text, jsonb),
  introductions_preparation_private.discard_own_v1(uuid),
  introductions_preparation_private.grant_own_assistance_v1(uuid, text),
  introductions_preparation_private.revoke_own_assistance_v1(uuid),
  introductions_preparation_private.read_own_assistance_items_v1(),
  public.read_matching_preparation_availability_v1(),
  public.read_own_matching_preparation_v1(),
  public.apply_own_matching_preparation_command_v1(uuid, bigint, text, jsonb),
  public.discard_own_matching_preparation_v1(uuid),
  public.grant_own_matching_onboarding_assistance_v1(uuid, text),
  public.revoke_own_matching_onboarding_assistance_v1(uuid),
  public.read_own_matching_onboarding_assistance_items_v1()
  TO authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 13. Deploy-time self-assertions.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  v_bad text;
BEGIN
  -- No client role reads or writes a relation here; anon reaches nothing.
  SELECT string_agg(c.relname, ', ') INTO v_bad FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'introductions_preparation_private' AND c.relkind IN ('r', 'p')
     AND (has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'));
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION '0154: a client role holds a privilege on %', v_bad; END IF;
  -- Exactly the seven owner entry definers and seven public pass-throughs are executable by authenticated.
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_bad FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'introductions_preparation_private'
     AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
     AND p.proname NOT IN ('read_availability_v1', 'read_own_preparation_v1', 'apply_own_command_v1', 'discard_own_v1',
                           'grant_own_assistance_v1', 'revoke_own_assistance_v1', 'read_own_assistance_items_v1');
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION '0154: a client role can run an internal function: %', v_bad; END IF;
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_bad FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE (n.nspname = 'introductions_preparation_private' OR (n.nspname = 'public' AND p.proname LIKE '%matching_preparation%')
          OR (n.nspname = 'public' AND p.proname LIKE '%matching_onboarding_assistance%'))
     AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION '0154: anon can run %', v_bad; END IF;
  -- Every function here is SECURITY DEFINER with an empty search_path, except the pure helpers.
  SELECT string_agg(p.proname, ', ') INTO v_bad FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'introductions_preparation_private'
     AND NOT (coalesce(p.proconfig, '{}') = ARRAY['search_path=""'] OR coalesce(p.proconfig, '{}') = ARRAY['search_path='])
  ;
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION '0154: a function does not pin an empty search_path: %', v_bad; END IF;
  -- Nothing here names an I-07 setup command, writes an I-07 relation or writes Memory.
  SELECT string_agg(p.proname, ', ') INTO v_bad FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'introductions_preparation_private'
     AND (p.prosrc ~ '(activate_matching_participation|resume_matching_participation|grant_matching_context|set_introduction_profile|set_matching_requirements|grant_pre_match_disclosure_authority)'
       OR p.prosrc ~* '(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.(matching_|introduction_|pre_match_|memories|memory_|hypothes|him_)');
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION '0154: a function reaches I-07 setup or Personal intelligence: %', v_bad; END IF;
  -- Every foreign key that names an account cascades; nothing here can block the governed erasure.
  SELECT string_agg(c.conname, ', ') INTO v_bad FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
   WHERE n.nspname = 'introductions_preparation_private' AND c.contype = 'f'
     AND c.confrelid IN ('public.users'::regclass, 'introductions_preparation_private.drafts'::regclass)
     AND c.confdeltype <> 'c';
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION '0154: an account reference does not cascade: %', v_bad; END IF;
  SELECT string_agg(c.conname, ', ') INTO v_bad FROM pg_constraint c
   WHERE c.contype = 'f' AND c.connamespace <> 'introductions_preparation_private'::regnamespace
     AND c.confrelid IN (SELECT r.oid FROM pg_class r WHERE r.relnamespace = 'introductions_preparation_private'::regnamespace);
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION '0154: an outside relation references the preparation: %', v_bad; END IF;
  -- Both gates start closed.
  IF EXISTS (SELECT 1 FROM introductions_preparation_private.gate_states) THEN
    RAISE EXCEPTION '0154: a gate is configured';
  END IF;
END$$;

COMMIT;
