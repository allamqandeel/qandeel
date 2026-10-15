-- S6-03 - Confirmed Matching facts, deterministic eligibility, neutral pre-Match presentation and the deterministic
-- Arabic/English privacy floor v1.
--
-- Product authority: the Product Owner's S6-03 Task Contract v1.3 (2026-10-15; D1-D7, C1-C8, R1, R2) and the
-- Controlled Amendment CW2-06B, whose exact text the Product Owner approved on 2026-10-15 (with R3, R4, R4-A, R4-B and
-- R5). This migration realizes CW2-06B-01 .. CW2-06B-13 and CW2-06B-16; migration 0157 realizes CW2-06B-14 and
-- CW2-06B-15. The execution record is docs/e2e/QANDEEL_S6_03_IMPLEMENTATION_RECORD_v1.md.
--
-- ## What is added
--
--   1. public.matching_confirmed_fact_versions / public.matching_confirmed_fact_state (CW2-06B-01, -02): one human's
--      explicitly confirmed Matching facts, as an append-only version chain with one current pointer. A fact is present
--      with the confirmation instant its writer recorded, or absent; absent is UNKNOWN everywhere downstream. There is
--      no DECLARED or CORRECTED state, no consent flag and no source label: a row is not, by itself, evidence that any
--      human confirmed anything (R5). Nothing here reads the 0154 preparation draft, and nothing references its schema.
--   2. public.record_matching_confirmed_facts_core_v1 - the ONE internal writer. Executable by no role and wrapped by
--      nothing in S6-03; it is the interface S6-07's reviewed, human-authorized promotion will wrap. It takes the owner's
--      Matching serialization row, compares and swaps the expected current version, is idempotent on the version id,
--      validates every shape and the S6-01 area catalogue, and writes the version and moves the pointer.
--   3. public.matching_eligibility_snapshot_fact_bindings (CW2-06B-05): the exact fact versions a snapshot was captured
--      on, and the Product pair rule OPPOSITE_SEX_CONFIRMED_V1 they passed. The pair rule is never a hard requirement
--      result.
--   4. The structured requirement encoding v1 (CW2-06B-03): strict decoders, the all-possible-days age rule (R3) and the
--      age-certainty horizon (R4), and the ONE deterministic evaluator of the three requirement families.
--   5. public.install_matching_proposal_policy_version_core_v1 (CW2-06B-13): the database-owner-only policy primitive.
--      No policy row is installed.
--   6. The deterministic Arabic/English privacy floor (CW2-06B-09): one delta classifier per extended rule, the five
--      0111 classifiers redefined as "old rule OR delta", and delta CHECKs beside the existing ones that refuse ONLY
--      the new patterns. Every non-ASCII character is built from its code point with chr(); the only exception is the
--      first-name shape, which reuses the exact S6-01 (0154) expression.
--
-- ## What is redefined forward (CREATE OR REPLACE; same signature, same RETURNS TABLE, owner and ACL re-asserted)
--
--   * resolve_matching_canonical_first_name_v1 - the confirmed Introduction First Name, else the same unresolved
--     answer as before (CW2-06B-01).
--   * capture_matching_eligibility_snapshot_core_v1 - the pair rule on both humans' CURRENT confirmed facts, with the
--     same single bounded refusal, and the fact binding (CW2-06B-05).
--   * resolve_matching_snapshot_validity_v1 - one added comparison: the bound fact versions are still current, else
--     MATCHING_FACT_VERSION_CHANGED (CW2-06B-05, -16).
--   * evaluate_matching_hard_requirement_core_v1 - one added refusal: a requirement-family key is evaluated only
--     deterministically.
--   * materialize_matching_recipient_view_core_v1 - inside the unchanged `IF disclosed = 0 THEN`: zero fields are
--     lawful only under a current Product field policy that permits zero keys (B4, CW2-06B-06). Its clock, deadline and
--     their order are byte-identical.
--   * resolve_my_matching_proposal_v1 - the first name and the conclusion are presented as NULL in every state
--     (CW2-06B-07). Bound internally; presented neutrally; disclosed at Mutual Match through the Handoff and 0155.
--   * the five matching_text_carries_*_v1 classifiers - old rule OR delta (CW2-06B-09).
--   * matching_proposal_transitions_reason_check - the twelve existing codes and MATCHING_FACT_VERSION_CHANGED, by the
--     DROP / ADD pattern 0113 used (CW2-06B-16).
--
-- ## What is deliberately NOT here
--
--   * No enrollment, no promotion, no wrapper, route, worker or grant; no real fact, proposal, Match or Introduction.
--   * No policy row, no new policy kind, no Product default.
--   * No change to any 0114 function, nor to the 0120 offer, forward, decline or withdraw cores; no deadline decision
--     and no clock on the delivery path changes.
--   * None of the six commands 0149 closed is reopened, granted, wrapped or named.
--
-- Forward-only. Migrations 0001-0155 are byte-unchanged.
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE DURABLE SOURCE OF CONFIRMED MATCHING FACTS (CW2-06B-01, -02).
--
--    Shape constraints, not catalogue foreign keys: no relation outside the
--    preparation schema may reference it (0154), so the supported area is
--    verified by the ONE writer at the moment of promotion, against the S6-01
--    catalogue, and evaluation never reads the catalogue or the draft.
-- ---------------------------------------------------------------------------
CREATE TABLE public.matching_confirmed_fact_versions (
    id uuid PRIMARY KEY,
    owner_user_id uuid NOT NULL,
    prior_fact_version_id uuid,
    first_name text,
    first_name_confirmed_at timestamptz,
    sex text,
    sex_confirmed_at timestamptz,
    birth_year smallint,
    birth_month smallint,
    birth_confirmed_at timestamptz,
    country_code text,
    region_code text,
    area_confirmed_at timestamptz,
    marital_status text,
    marital_confirmed_at timestamptz,
    recorded_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT matching_confirmed_fact_versions_owner_key UNIQUE (id, owner_user_id),
    CONSTRAINT matching_confirmed_fact_versions_owner_fk
        FOREIGN KEY (owner_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    -- A version chain never crosses owners.
    CONSTRAINT matching_confirmed_fact_versions_prior_fk
        FOREIGN KEY (prior_fact_version_id, owner_user_id)
        REFERENCES public.matching_confirmed_fact_versions (id, owner_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_confirmed_fact_versions_prior_check
        CHECK (prior_fact_version_id IS NULL OR prior_fact_version_id <> id),
    -- ONLY CONFIRMED VALUES EXIST HERE: a value is present exactly when the
    -- confirmation instant its writer recorded is. A declared-but-unconfirmed
    -- or corrected-but-unconfirmed draft value is simply absent.
    CONSTRAINT matching_confirmed_fact_versions_confirmed_check
        CHECK ((first_name IS NULL) = (first_name_confirmed_at IS NULL)
           AND (sex IS NULL) = (sex_confirmed_at IS NULL)
           AND (birth_year IS NULL) = (birth_confirmed_at IS NULL)
           AND (country_code IS NULL) = (area_confirmed_at IS NULL)
           AND (marital_status IS NULL) = (marital_confirmed_at IS NULL)),
    -- The Introduction First Name: exactly the S6-01 shape (0154).
    CONSTRAINT matching_confirmed_fact_versions_first_name_check
        CHECK (first_name IS NULL OR (char_length(first_name) BETWEEN 1 AND 32
           AND first_name ~ '^[A-Za-zÀ-ÖØ-öø-ÿء-غف-يٱ-ۓ][A-Za-zÀ-ÖØ-öø-ÿء-غف-يٱ-ۓً-ْ]*([ ''’-][A-Za-zÀ-ÖØ-öø-ÿء-غف-يٱ-ۓ][A-Za-zÀ-ÖØ-öø-ÿء-غف-يٱ-ۓً-ْ]*)*$')),
    CONSTRAINT matching_confirmed_fact_versions_sex_check
        CHECK (sex IS NULL OR sex IN ('MALE', 'FEMALE')),
    CONSTRAINT matching_confirmed_fact_versions_birth_check
        CHECK ((birth_year IS NULL) = (birth_month IS NULL)
           AND (birth_year IS NULL OR (birth_year >= 1900 AND birth_month BETWEEN 1 AND 12))),
    CONSTRAINT matching_confirmed_fact_versions_country_check
        CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
    -- A region requires a country and carries it as its prefix.
    CONSTRAINT matching_confirmed_fact_versions_region_check
        CHECK (region_code IS NULL
            OR (country_code IS NOT NULL AND region_code ~ '^[A-Z]{2}-[A-Z0-9]{1,3}$'
                AND left(region_code, 2) = country_code)),
    CONSTRAINT matching_confirmed_fact_versions_marital_check
        CHECK (marital_status IS NULL
            OR marital_status IN ('NEVER_MARRIED', 'DIVORCED', 'WIDOWED', 'CURRENTLY_MARRIED'))
);

-- A version is superseded at most once: the chain is a chain.
CREATE UNIQUE INDEX matching_confirmed_fact_versions_prior_idx
    ON public.matching_confirmed_fact_versions (prior_fact_version_id)
    WHERE prior_fact_version_id IS NOT NULL;
CREATE INDEX matching_confirmed_fact_versions_owner_idx
    ON public.matching_confirmed_fact_versions (owner_user_id);

COMMENT ON TABLE public.matching_confirmed_fact_versions IS
  'CONFIRMED_MATCHING_FACT_VERSION (CW2-06B-01): one human''s explicitly confirmed '
  'Introduction First Name, sex, birth year and month, country and optional '
  'first-level region, and marital status, as an append-only version chain. A '
  'fact is present with the confirmation instant its writer recorded, or absent, '
  'and absent is UNKNOWN downstream. It is not enrollment, participation, a '
  'grant, a profile field or a disclosure authority, and a row is not by itself '
  'evidence that any human confirmed anything: that evidence is S6-07''s.';

CREATE TABLE public.matching_confirmed_fact_state (
    owner_user_id uuid PRIMARY KEY,
    current_fact_version_id uuid NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT matching_confirmed_fact_state_current_key UNIQUE (current_fact_version_id),
    CONSTRAINT matching_confirmed_fact_state_owner_fk
        FOREIGN KEY (owner_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    -- The pointer names a version OF THIS EXACT OWNER.
    CONSTRAINT matching_confirmed_fact_state_current_fk
        FOREIGN KEY (current_fact_version_id, owner_user_id)
        REFERENCES public.matching_confirmed_fact_versions (id, owner_user_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.matching_confirmed_fact_state IS
  'The ONE current confirmed-fact version identity per human. Absence of a row '
  'means no confirmed fact, which is UNKNOWN everywhere downstream.';

-- ---------------------------------------------------------------------------
-- 2. THE SNAPSHOT'S FACT BINDING AND THE PRODUCT PAIR RULE (CW2-06B-05).
--
--    The snapshot foreign key (id, pair) and the pair foreign key (pair, lower,
--    higher) together prove the two humans are the snapshot's own; each fact
--    version is bound to exactly that human. The truth trigger proves both bound
--    versions carry a confirmed sex and that the two differ. A binding exists
--    only for a pair that passed the rule; the rule is never a requirement result.
-- ---------------------------------------------------------------------------
CREATE TABLE public.matching_eligibility_snapshot_fact_bindings (
    eligibility_snapshot_id uuid PRIMARY KEY,
    pair_id uuid NOT NULL,
    lower_user_id uuid NOT NULL,
    higher_user_id uuid NOT NULL,
    lower_fact_version_id uuid NOT NULL,
    higher_fact_version_id uuid NOT NULL,
    pair_rule text NOT NULL DEFAULT 'OPPOSITE_SEX_CONFIRMED_V1',
    bound_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT matching_eligibility_snapshot_fact_bindings_snapshot_fk
        FOREIGN KEY (eligibility_snapshot_id, pair_id)
        REFERENCES public.matching_eligibility_snapshots (id, pair_id) ON DELETE RESTRICT,
    CONSTRAINT matching_eligibility_snapshot_fact_bindings_pair_fk
        FOREIGN KEY (pair_id, lower_user_id, higher_user_id)
        REFERENCES public.matching_pairs (id, lower_user_id, higher_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_eligibility_snapshot_fact_bindings_low_fact_fk
        FOREIGN KEY (lower_fact_version_id, lower_user_id)
        REFERENCES public.matching_confirmed_fact_versions (id, owner_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_eligibility_snapshot_fact_bindings_high_fact_fk
        FOREIGN KEY (higher_fact_version_id, higher_user_id)
        REFERENCES public.matching_confirmed_fact_versions (id, owner_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_eligibility_snapshot_fact_bindings_rule_check
        CHECK (pair_rule = 'OPPOSITE_SEX_CONFIRMED_V1')
);

CREATE INDEX matching_eligibility_snapshot_fact_bindings_low_idx
    ON public.matching_eligibility_snapshot_fact_bindings (lower_fact_version_id);
CREATE INDEX matching_eligibility_snapshot_fact_bindings_high_idx
    ON public.matching_eligibility_snapshot_fact_bindings (higher_fact_version_id);

COMMENT ON TABLE public.matching_eligibility_snapshot_fact_bindings IS
  'MATCHING_ELIGIBILITY_SNAPSHOT_FACT_BINDING (CW2-06B-05): the exact confirmed '
  'fact versions of both humans an eligibility snapshot was captured on, and the '
  'Product pair rule OPPOSITE_SEX_CONFIRMED_V1 they passed. The rule is a Product '
  'gate, never a hard requirement result, and the binding is what the one '
  'revalidation compares against the current versions.';

-- ---------------------------------------------------------------------------
-- 3. IMMUTABILITY AND TRUTH TRIGGERS.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.reject_matching_confirmed_fact_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'MATCHING_CONFIRMED_FACT_RECORD_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='A confirmed fact version and a snapshot fact binding are append-only: UPDATE and DELETE are refused for every role, including the table owner. A changed fact is a NEW version, and a later version never rewrites what an earlier one bound.';
END$$;

ALTER FUNCTION public.reject_matching_confirmed_fact_mutation_v1() OWNER TO postgres;

CREATE TRIGGER matching_confirmed_fact_versions_immutable
    BEFORE UPDATE OR DELETE ON public.matching_confirmed_fact_versions
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_confirmed_fact_mutation_v1();
CREATE TRIGGER matching_eligibility_snapshot_fact_bindings_immutable
    BEFORE UPDATE OR DELETE ON public.matching_eligibility_snapshot_fact_bindings
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_confirmed_fact_mutation_v1();

-- The current pointer moves forward along its OWN owner's chain, and is never
-- deleted.
CREATE FUNCTION public.matching_confirmed_fact_state_truth_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  expected_prior uuid;
  replaced uuid := NULL;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'MATCHING_CONFIRMED_FACT_STATE_IS_DURABLE'
      USING ERRCODE='55000', DETAIL='A current confirmed-fact pointer is durable truth and is never deleted.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
      RAISE EXCEPTION 'MATCHING_CONFIRMED_FACT_OWNER_IS_FROZEN'
        USING ERRCODE='55000', DETAIL='A current confirmed-fact pointer belongs to one human for its whole life.';
    END IF;
    replaced := OLD.current_fact_version_id;
  END IF;
  SELECT f.prior_fact_version_id INTO expected_prior
    FROM public.matching_confirmed_fact_versions f WHERE f.id = NEW.current_fact_version_id;
  IF expected_prior IS DISTINCT FROM replaced THEN
    RAISE EXCEPTION 'MATCHING_CONFIRMED_FACT_NOT_A_FORWARD_MOVE'
      USING ERRCODE='55000',
            DETAIL='A current confirmed-fact pointer may only name the version that supersedes the version it replaces, and a first pointer may only name a chain root.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.matching_confirmed_fact_state_truth_v1() OWNER TO postgres;

CREATE TRIGGER matching_confirmed_fact_state_truth
    BEFORE INSERT OR UPDATE OR DELETE ON public.matching_confirmed_fact_state
    FOR EACH ROW EXECUTE FUNCTION public.matching_confirmed_fact_state_truth_v1();

-- THE PAIR RULE, AS A PROPERTY OF THE BINDING. Both bound versions are the
-- snapshot's own two humans', both carry a confirmed sex, and the two differ.
-- Missing, unconfirmed or equal values bind nothing.
CREATE FUNCTION public.matching_snapshot_fact_binding_truth_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  snapshot public.matching_eligibility_snapshots;
  low_sex text;
  high_sex text;
BEGIN
  SELECT * INTO snapshot FROM public.matching_eligibility_snapshots s WHERE s.id = NEW.eligibility_snapshot_id;
  IF NOT FOUND OR snapshot.lower_user_id IS DISTINCT FROM NEW.lower_user_id
     OR snapshot.higher_user_id IS DISTINCT FROM NEW.higher_user_id THEN
    RAISE EXCEPTION 'MATCHING_FACT_BINDING_NOT_THE_SNAPSHOT_PAIR'
      USING ERRCODE='55000', DETAIL='A fact binding binds the two humans of its own eligibility snapshot and nobody else.';
  END IF;
  SELECT f.sex INTO low_sex FROM public.matching_confirmed_fact_versions f
   WHERE f.id = NEW.lower_fact_version_id AND f.owner_user_id = NEW.lower_user_id AND f.sex_confirmed_at IS NOT NULL;
  SELECT f.sex INTO high_sex FROM public.matching_confirmed_fact_versions f
   WHERE f.id = NEW.higher_fact_version_id AND f.owner_user_id = NEW.higher_user_id AND f.sex_confirmed_at IS NOT NULL;
  IF low_sex IS NULL OR high_sex IS NULL OR low_sex = high_sex THEN
    RAISE EXCEPTION 'MATCHING_PAIR_RULE_NOT_SATISFIED'
      USING ERRCODE='55000',
            DETAIL='Matching v1 evaluates only a pair of one confirmed MALE and one confirmed FEMALE human, each in that human''s own bound confirmed fact version. Nothing infers sex.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.matching_snapshot_fact_binding_truth_v1() OWNER TO postgres;

CREATE TRIGGER matching_eligibility_snapshot_fact_bindings_truth
    BEFORE INSERT ON public.matching_eligibility_snapshot_fact_bindings
    FOR EACH ROW EXECUTE FUNCTION public.matching_snapshot_fact_binding_truth_v1();

-- ---------------------------------------------------------------------------
-- 4. DENY-BY-DEFAULT ACCESS POSTURE, exactly as 0110 left its relations.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  target_table text;
  trigger_function text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'public.matching_confirmed_fact_versions',
    'public.matching_confirmed_fact_state',
    'public.matching_eligibility_snapshot_fact_bindings'] LOOP
    EXECUTE format('ALTER TABLE %s OWNER TO postgres', target_table);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC, anon, authenticated', target_table);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON TABLE %s FROM service_role', target_table);
    END IF;
  END LOOP;
  FOREACH trigger_function IN ARRAY ARRAY[
    'public.reject_matching_confirmed_fact_mutation_v1()',
    'public.matching_confirmed_fact_state_truth_v1()',
    'public.matching_snapshot_fact_binding_truth_v1()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', trigger_function);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', trigger_function);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 5. THE ONE INTERNAL WRITER (CW2-06B-02).
--
--    Executable by NO role: not PUBLIC, anon, authenticated or service_role,
--    and wrapped by nothing in S6-03. It records values a trusted internal
--    caller supplies, the confirmation instants included, and a row it writes
--    is not by itself evidence that any human confirmed anything (R5). It takes
--    an explicit owner and reads no session identity; S6-07's reviewed wrapper
--    derives the owner from auth.uid() and owns the human act, its evidence and
--    its binding to enrollment.
--
--    It takes the owner's own Matching serialization row - the same row every
--    I-07 command and the canonical two-human lock take - so a fact change and
--    an advancing proposal step serialize. It reads no preparation draft and
--    creates no participation, grant, profile, requirement or authority.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.record_matching_confirmed_facts_core_v1(
    p_fact_version_id uuid,
    p_owner_user_id uuid,
    p_expected_current_fact_version_id uuid,
    p_first_name text,
    p_first_name_confirmed_at timestamptz,
    p_sex text,
    p_sex_confirmed_at timestamptz,
    p_birth_year integer,
    p_birth_month integer,
    p_birth_confirmed_at timestamptz,
    p_country_code text,
    p_region_code text,
    p_area_confirmed_at timestamptz,
    p_marital_status text,
    p_marital_confirmed_at timestamptz)
RETURNS TABLE (fact_version_id uuid, superseded_fact_version_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  locked uuid;
  committed public.matching_confirmed_fact_versions;
  current_id uuid;
BEGIN
  IF p_fact_version_id IS NULL OR p_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- A value and its confirmation instant arrive together or not at all.
  IF (p_first_name IS NULL) <> (p_first_name_confirmed_at IS NULL)
     OR (p_sex IS NULL) <> (p_sex_confirmed_at IS NULL)
     OR (p_birth_year IS NULL) <> (p_birth_confirmed_at IS NULL)
     OR (p_birth_year IS NULL) <> (p_birth_month IS NULL)
     OR (p_country_code IS NULL) <> (p_area_confirmed_at IS NULL)
     OR (p_region_code IS NOT NULL AND p_country_code IS NULL)
     OR (p_marital_status IS NULL) <> (p_marital_confirmed_at IS NULL) THEN
    RAISE EXCEPTION 'MATCHING_CONFIRMED_FACT_INVALID' USING ERRCODE='22023',
      DETAIL='A confirmed fact is a value with the instant it was confirmed. An unconfirmed value is absent, never present without its instant.';
  END IF;

  INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (p_owner_user_id)
  ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at
  RETURNING l.user_id INTO locked;

  -- An equivalent retry answers from the COMMITTED row; the comparison covers
  -- the whole immutable request.
  SELECT * INTO committed FROM public.matching_confirmed_fact_versions f WHERE f.id = p_fact_version_id;
  IF FOUND THEN
    IF committed.owner_user_id = p_owner_user_id
       AND committed.prior_fact_version_id IS NOT DISTINCT FROM p_expected_current_fact_version_id
       AND committed.first_name IS NOT DISTINCT FROM p_first_name
       AND committed.first_name_confirmed_at IS NOT DISTINCT FROM p_first_name_confirmed_at
       AND committed.sex IS NOT DISTINCT FROM p_sex
       AND committed.sex_confirmed_at IS NOT DISTINCT FROM p_sex_confirmed_at
       AND committed.birth_year IS NOT DISTINCT FROM p_birth_year
       AND committed.birth_month IS NOT DISTINCT FROM p_birth_month
       AND committed.birth_confirmed_at IS NOT DISTINCT FROM p_birth_confirmed_at
       AND committed.country_code IS NOT DISTINCT FROM p_country_code
       AND committed.region_code IS NOT DISTINCT FROM p_region_code
       AND committed.area_confirmed_at IS NOT DISTINCT FROM p_area_confirmed_at
       AND committed.marital_status IS NOT DISTINCT FROM p_marital_status
       AND committed.marital_confirmed_at IS NOT DISTINCT FROM p_marital_confirmed_at THEN
      RETURN QUERY SELECT committed.id, committed.prior_fact_version_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- COMPARE AND SWAP. A version is never applied to "whatever is current".
  SELECT s.current_fact_version_id INTO current_id
    FROM public.matching_confirmed_fact_state s WHERE s.owner_user_id = p_owner_user_id FOR UPDATE;
  IF current_id IS DISTINCT FROM p_expected_current_fact_version_id THEN
    RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001',
      DETAIL='A confirmed fact version names the exact version it supersedes.';
  END IF;

  -- THE SUPPORTED AREA, verified against the S6-01 catalogue at this moment and
  -- bound by no foreign key. A syntactically valid but unsupported country or
  -- region never enters the source.
  IF p_country_code IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM introductions_preparation_private.area_countries c WHERE c.country_code = p_country_code) THEN
    RAISE EXCEPTION 'MATCHING_CONFIRMED_AREA_UNSUPPORTED' USING ERRCODE='22023';
  END IF;
  IF p_region_code IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM introductions_preparation_private.area_regions r
        WHERE r.country_code = p_country_code AND r.region_code = p_region_code) THEN
    RAISE EXCEPTION 'MATCHING_CONFIRMED_AREA_UNSUPPORTED' USING ERRCODE='22023';
  END IF;

  -- Every shape is the relation's own CHECK; a violation is one bounded answer.
  BEGIN
    INSERT INTO public.matching_confirmed_fact_versions
      (id, owner_user_id, prior_fact_version_id,
       first_name, first_name_confirmed_at, sex, sex_confirmed_at,
       birth_year, birth_month, birth_confirmed_at,
       country_code, region_code, area_confirmed_at,
       marital_status, marital_confirmed_at)
    VALUES (p_fact_version_id, p_owner_user_id, p_expected_current_fact_version_id,
            p_first_name, p_first_name_confirmed_at, p_sex, p_sex_confirmed_at,
            p_birth_year, p_birth_month, p_birth_confirmed_at,
            p_country_code, p_region_code, p_area_confirmed_at,
            p_marital_status, p_marital_confirmed_at);
  EXCEPTION WHEN check_violation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'MATCHING_CONFIRMED_FACT_INVALID' USING ERRCODE='22023';
  END;

  IF p_expected_current_fact_version_id IS NULL THEN
    INSERT INTO public.matching_confirmed_fact_state (owner_user_id, current_fact_version_id)
    VALUES (p_owner_user_id, p_fact_version_id);
  ELSE
    UPDATE public.matching_confirmed_fact_state s
       SET current_fact_version_id = p_fact_version_id, updated_at = CURRENT_TIMESTAMP
     WHERE s.owner_user_id = p_owner_user_id AND s.current_fact_version_id = p_expected_current_fact_version_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001'; END IF;
  END IF;

  RETURN QUERY SELECT p_fact_version_id, p_expected_current_fact_version_id;
END$$;

COMMENT ON FUNCTION public.record_matching_confirmed_facts_core_v1(uuid, uuid, uuid, text, timestamptz, text, timestamptz, integer, integer, timestamptz, text, text, timestamptz, text, timestamptz) IS
  'The ONE internal writer of confirmed Matching facts (CW2-06B-02). Executable by '
  'no role and wrapped by nothing in S6-03; S6-07''s reviewed, human-authorized '
  'promotion is its only intended caller. A row it writes is not evidence of human '
  'confirmation (R5).';

-- ---------------------------------------------------------------------------
-- 6. THE READERS.
-- ---------------------------------------------------------------------------

-- The current confirmed facts of one human: one row, every value NULL when
-- there is none. Values only - no confirmation instant, no consent claim.
CREATE FUNCTION public.resolve_matching_confirmed_facts_v1(p_user_id uuid)
RETURNS TABLE (fact_version_id uuid, first_name text, sex text, birth_year integer, birth_month integer,
               country_code text, region_code text, marital_status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  found public.matching_confirmed_fact_versions;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_SUBJECT_REQUIRED' USING ERRCODE='22023';
  END IF;
  SELECT f.* INTO found
    FROM public.matching_confirmed_fact_state s
    JOIN public.matching_confirmed_fact_versions f
      ON f.id = s.current_fact_version_id AND f.owner_user_id = s.owner_user_id
   WHERE s.owner_user_id = p_user_id;
  RETURN QUERY SELECT found.id, found.first_name, found.sex, found.birth_year::integer, found.birth_month::integer,
                      found.country_code, found.region_code, found.marital_status;
END$$;

-- ---------------------------------------------------------------------------
-- 7. THE STRUCTURED REQUIREMENT ENCODING v1 (CW2-06B-03, -04).
--
--    The three S6-01 dimensions are ordinary items of the existing 0108
--    requirement versions. A key carries the dimension, the strength and the
--    encoding version; a value is ASCII, has no whitespace and is matched by an
--    anchored full-string grammar. A value that does not match exactly decodes
--    to NOTHING, and so does any family key whose version is not v1: for a hard
--    item that is UNKNOWN, never PASS. Free text is never interpreted, and
--    "no additional hard dealbreaker" is the absence of hard family items.
--
--      HARD_DEALBREAKER   age_range_v1        min=<A>;max=<B>
--      SOFT_PREFERENCE    age_range_preference_v1
--      HARD_DEALBREAKER   marital_status_v1   accepted=<S1>[,<S2>...]
--      SOFT_PREFERENCE    marital_status_preference_v1
--      HARD_DEALBREAKER   area_v1             country=<CC>[;regions=<R1>[,<R2>...]]
--      SOFT_PREFERENCE    area_preference_v1
--
--    These helpers are pure: they read no relation and take no identity.
-- ---------------------------------------------------------------------------

-- The requirement family: every key of the three dimensions in any encoding
-- version and either strength. Only the deterministic evaluator records a
-- result for one of them.
CREATE FUNCTION public.matching_structured_requirement_family_v1(p_requirement_key text)
RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT p_requirement_key IS NOT NULL
     AND p_requirement_key ~ '^(age_range|marital_status|area)(_preference)?_v[0-9]+$';
$$;

-- AGE_RANGE v1: whole numbers 18-99 with no leading zero, and min <= max.
CREATE FUNCTION public.matching_structured_age_range_v1(p_requirement_value text)
RETURNS TABLE (min_age integer, max_age integer)
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT m[1]::integer, m[2]::integer
    FROM regexp_match(p_requirement_value, '^min=(1[89]|[2-9][0-9]);max=(1[89]|[2-9][0-9])$') AS m
   WHERE m IS NOT NULL AND m[1]::integer <= m[2]::integer;
$$;

-- MARITAL_STATUS v1: one to four of the four marital values, distinct, in
-- strictly ascending byte order.
CREATE FUNCTION public.matching_structured_marital_set_v1(p_requirement_value text)
RETURNS TABLE (accepted text[])
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  WITH parsed AS (
    SELECT string_to_array(m[1], ',') AS members
      FROM regexp_match(p_requirement_value,
             '^accepted=((?:NEVER_MARRIED|DIVORCED|WIDOWED|CURRENTLY_MARRIED)(?:,(?:NEVER_MARRIED|DIVORCED|WIDOWED|CURRENTLY_MARRIED)){0,3})$') AS m
     WHERE m IS NOT NULL)
  SELECT p.members FROM parsed p
   WHERE p.members = ARRAY(SELECT DISTINCT x COLLATE "C" FROM unnest(p.members) AS x ORDER BY 1);
$$;

-- AREA v1: a country, and optionally its first-level regions - each prefixed by
-- that country, distinct, in strictly ascending byte order.
CREATE FUNCTION public.matching_structured_area_v1(p_requirement_value text)
RETURNS TABLE (country_code text, region_codes text[])
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  WITH parsed AS (
    SELECT m[1] AS country, CASE WHEN m[2] IS NULL THEN NULL ELSE string_to_array(m[2], ',') END AS regions
      FROM regexp_match(p_requirement_value,
             '^country=([A-Z]{2})(?:;regions=([A-Z]{2}-[A-Z0-9]{1,3}(?:,[A-Z]{2}-[A-Z0-9]{1,3})*))?$') AS m
     WHERE m IS NOT NULL)
  SELECT p.country, p.regions FROM parsed p
   WHERE p.regions IS NULL
      OR (p.regions = ARRAY(SELECT DISTINCT x COLLATE "C" FROM unnest(p.regions) AS x ORDER BY 1)
          AND NOT EXISTS (SELECT 1 FROM unnest(p.regions) AS r WHERE left(r, 2) <> p.country));
$$;

-- THE ALL-POSSIBLE-DAYS AGE RULE (C7, corrected by R3). The possible birth
-- dates are every day of the confirmed month that is not later than the
-- reference date R. For one possible day d the full-year age is
--   (R.year - d.year) - (1 if (R.month, R.day) < (d.month, d.day) else 0),
-- so a 29 February birthday is reached on 1 March in a non-leap year.
-- PASS only if that age lies inside [min, max] for EVERY possible day, FAIL only
-- if it lies outside for every possible day, otherwise UNKNOWN - which happens
-- exactly when the range boundary falls between two possible days. With no
-- possible day at all the fact is unusable for R, and the answer is UNKNOWN.
-- There is no other rule.
CREATE FUNCTION public.matching_structured_age_outcome_v1(
    p_birth_year integer, p_birth_month integer, p_reference_date date, p_min_age integer, p_max_age integer)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  WITH possible AS (
    SELECT d::date AS day
      FROM generate_series(make_date(p_birth_year, p_birth_month, 1),
                           make_date(p_birth_year, p_birth_month, 1) + interval '1 month' - interval '1 day',
                           interval '1 day') AS d
     WHERE d::date <= p_reference_date),
  ages AS (
    SELECT (extract(year FROM p_reference_date)::integer - extract(year FROM day)::integer)
           - CASE WHEN (extract(month FROM p_reference_date)::integer, extract(day FROM p_reference_date)::integer)
                       < (extract(month FROM day)::integer, extract(day FROM day)::integer)
                  THEN 1 ELSE 0 END AS age
      FROM possible)
  SELECT CASE
           WHEN p_birth_year IS NULL OR p_birth_month IS NULL OR p_reference_date IS NULL
                OR p_min_age IS NULL OR p_max_age IS NULL THEN 'UNKNOWN'
           WHEN NOT EXISTS (SELECT 1 FROM ages) THEN 'UNKNOWN'
           WHEN (SELECT bool_and(a.age BETWEEN p_min_age AND p_max_age) FROM ages a) THEN 'PASS'
           WHEN NOT (SELECT bool_or(a.age BETWEEN p_min_age AND p_max_age) FROM ages a) THEN 'FAIL'
           ELSE 'UNKNOWN'
         END;
$$;

-- THE AGE-CERTAINTY HORIZON (R4). A full-year age only grows, so the lower
-- bound of a PASS never lapses; the upper bound lapses first for the earliest
-- possible day, the 1st of the month. Before H the PASS is certain on every
-- date, and from H it no longer is. H is a pure function of the bound fact
-- version and the bound requirement item, and it is never stored.
CREATE FUNCTION public.matching_structured_age_horizon_v1(p_birth_year integer, p_birth_month integer, p_max_age integer)
RETURNS timestamptz
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT make_timestamp(p_birth_year + p_max_age + 1, p_birth_month, 1, 0, 0, 0) AT TIME ZONE 'UTC';
$$;

-- ---------------------------------------------------------------------------
-- 8. THE ONE DETERMINISTIC EVALUATOR (CW2-06B-05 §6-7).
--
--    Every HARD_DEALBREAKER family item of both humans' BOUND requirement
--    versions is evaluated against the OTHER human's BOUND confirmed fact
--    version, read through the snapshot's own fact binding - never the current
--    facts, never the draft, never a name, a voice or a model. PASS and FAIL
--    carry EXPLICIT_MATCHING_ANSWER, UNKNOWN carries NOT_ESTABLISHED. A soft
--    preference is never evaluated as a gate, and nothing is ranked, scored,
--    weighted or inferred. The reference date of the age rule is the UTC date of
--    the snapshot's own capture instant.
--
--    It is the only producer of results for family keys; the manual recorder
--    refuses them. An equivalent re-run answers from the committed rows; a
--    sealed snapshot still refuses a new result through the 0110 seal.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.evaluate_matching_structured_requirements_core_v1(p_eligibility_snapshot_id uuid)
RETURNS TABLE (evaluated_for_user_id uuid, requirement_key text, requirement_outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  snapshot public.matching_eligibility_snapshots;
  binding public.matching_eligibility_snapshot_fact_bindings;
  reference date;
  item record;
  other_fact public.matching_confirmed_fact_versions;
  decoded_age record;
  decoded_marital record;
  decoded_area record;
  outcome text;
  committed text;
BEGIN
  IF p_eligibility_snapshot_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT * INTO snapshot FROM public.matching_eligibility_snapshots s WHERE s.id = p_eligibility_snapshot_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCHING_ELIGIBILITY_SNAPSHOT_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  PERFORM public.lock_matching_pair_humans_v1(snapshot.lower_user_id, snapshot.higher_user_id);

  SELECT * INTO binding FROM public.matching_eligibility_snapshot_fact_bindings b
   WHERE b.eligibility_snapshot_id = p_eligibility_snapshot_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCHING_SNAPSHOT_FACTS_UNBOUND' USING ERRCODE='55000',
      DETAIL='A snapshot is evaluated only against the confirmed fact versions it was captured on.';
  END IF;
  reference := (snapshot.captured_at AT TIME ZONE 'UTC')::date;

  FOR item IN
    SELECT i.requirement_version_id, i.requirement_key, i.requirement_value,
           CASE i.requirement_version_id WHEN snapshot.lower_requirement_version_id THEN snapshot.lower_user_id
                                         ELSE snapshot.higher_user_id END AS owner_id,
           CASE i.requirement_version_id WHEN snapshot.lower_requirement_version_id THEN binding.higher_fact_version_id
                                         ELSE binding.lower_fact_version_id END AS other_fact_id
      FROM public.matching_requirement_items i
     WHERE i.requirement_version_id IN (snapshot.lower_requirement_version_id, snapshot.higher_requirement_version_id)
       AND i.requirement_strength = 'HARD_DEALBREAKER'
       AND public.matching_structured_requirement_family_v1(i.requirement_key)
     ORDER BY 4, 2
  LOOP
    SELECT * INTO other_fact FROM public.matching_confirmed_fact_versions f WHERE f.id = item.other_fact_id;
    outcome := 'UNKNOWN';
    IF item.requirement_key = 'age_range_v1' THEN
      SELECT * INTO decoded_age FROM public.matching_structured_age_range_v1(item.requirement_value);
      IF FOUND AND other_fact.birth_year IS NOT NULL THEN
        outcome := public.matching_structured_age_outcome_v1(other_fact.birth_year, other_fact.birth_month,
                                                              reference, decoded_age.min_age, decoded_age.max_age);
      END IF;
    ELSIF item.requirement_key = 'marital_status_v1' THEN
      SELECT * INTO decoded_marital FROM public.matching_structured_marital_set_v1(item.requirement_value);
      IF FOUND AND other_fact.marital_status IS NOT NULL THEN
        outcome := CASE WHEN other_fact.marital_status = ANY (decoded_marital.accepted) THEN 'PASS' ELSE 'FAIL' END;
      END IF;
    ELSIF item.requirement_key = 'area_v1' THEN
      SELECT * INTO decoded_area FROM public.matching_structured_area_v1(item.requirement_value);
      IF FOUND AND other_fact.country_code IS NOT NULL THEN
        IF other_fact.country_code <> decoded_area.country_code THEN
          outcome := 'FAIL';
        ELSIF decoded_area.region_codes IS NULL THEN
          outcome := 'PASS';
        ELSIF other_fact.region_code IS NOT NULL THEN
          outcome := CASE WHEN other_fact.region_code = ANY (decoded_area.region_codes) THEN 'PASS' ELSE 'FAIL' END;
        END IF;
      END IF;
    END IF;
    -- Any other family key - another encoding version, or a preference key
    -- written with the hard strength - stays UNKNOWN.

    SELECT r.requirement_outcome INTO committed FROM public.matching_hard_requirement_results r
     WHERE r.eligibility_snapshot_id = p_eligibility_snapshot_id
       AND r.evaluated_for_user_id = item.owner_id AND r.requirement_key = item.requirement_key;
    IF committed IS NULL THEN
      INSERT INTO public.matching_hard_requirement_results
        (eligibility_snapshot_id, evaluated_for_user_id, requirement_version_id,
         requirement_key, requirement_outcome, evidence_source_class)
      VALUES (p_eligibility_snapshot_id, item.owner_id, item.requirement_version_id, item.requirement_key, outcome,
              CASE WHEN outcome = 'UNKNOWN' THEN 'NOT_ESTABLISHED' ELSE 'EXPLICIT_MATCHING_ANSWER' END);
    ELSIF committed <> outcome THEN
      RAISE EXCEPTION 'MATCHING_REQUIREMENT_RESULT_CONFLICT' USING ERRCODE='23505';
    END IF;
    evaluated_for_user_id := item.owner_id;
    requirement_key := item.requirement_key;
    requirement_outcome := outcome;
    RETURN NEXT;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 9. THE DATABASE-OWNER-ONLY POLICY PRIMITIVE (CW2-06B-13, C6).
--
--    Installs or supersedes ONE version of ONE of the five existing kinds with
--    its exact typed values - for PROPOSAL_SAFE_FIELDS its exact key set, which
--    may be empty - and moves that kind's pointer forward along its own chain.
--    It is executable by no application role and exposed through no endpoint,
--    worker or wrapper; its only intended caller is a separately governed
--    operator change. Nothing calls it here and no policy row is installed: the
--    research targets are not defaults and a missing policy is never permissive.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.install_matching_proposal_policy_version_core_v1(
    p_policy_version_id uuid,
    p_policy_kind text,
    p_expected_current_policy_version_id uuid,
    p_window_days integer,
    p_max_count integer,
    p_expiry_hours integer,
    p_safe_field_keys text[])
RETURNS TABLE (policy_version_id uuid, policy_kind text, superseded_policy_version_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  committed public.matching_proposal_policy_versions;
  current_id uuid;
  committed_keys text[];
BEGIN
  IF p_policy_version_id IS NULL OR p_policy_kind IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  IF p_policy_kind NOT IN ('PROPOSAL_CADENCE', 'PENDING_PROPOSAL_LIMIT', 'PROPOSAL_EXPIRY',
                           'PROPOSAL_SAFE_FIELDS', 'SENSITIVE_CONCLUSION_FILTER') THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_POLICY_KIND_INVALID' USING ERRCODE='22023',
      DETAIL='Only the five canonical proposal policy kinds exist. No new kind is created here.';
  END IF;
  -- A field key set belongs to PROPOSAL_SAFE_FIELDS alone, and there it is
  -- required: an empty set is an explicit choice, never an omission.
  IF (p_policy_kind = 'PROPOSAL_SAFE_FIELDS') <> (p_safe_field_keys IS NOT NULL)
     OR EXISTS (SELECT 1 FROM unnest(p_safe_field_keys) AS k WHERE k IS NULL)
     OR (SELECT count(*) FROM unnest(p_safe_field_keys) AS k)
        <> (SELECT count(DISTINCT k) FROM unnest(p_safe_field_keys) AS k) THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_POLICY_VALUES_INVALID' USING ERRCODE='22023';
  END IF;

  -- The kind's pointer row is the serialization point for its chain.
  PERFORM 1 FROM public.matching_proposal_policy_state st WHERE st.policy_kind = p_policy_kind FOR UPDATE;

  SELECT * INTO committed FROM public.matching_proposal_policy_versions v WHERE v.id = p_policy_version_id;
  IF FOUND THEN
    SELECT coalesce(array_agg(k.field_key ORDER BY k.field_key), '{}') INTO committed_keys
      FROM public.matching_proposal_safe_field_keys k WHERE k.policy_version_id = p_policy_version_id;
    IF committed.policy_kind = p_policy_kind
       AND committed.prior_policy_version_id IS NOT DISTINCT FROM p_expected_current_policy_version_id
       AND committed.window_days IS NOT DISTINCT FROM p_window_days
       AND committed.max_count IS NOT DISTINCT FROM p_max_count
       AND committed.expiry_hours IS NOT DISTINCT FROM p_expiry_hours
       AND (p_policy_kind <> 'PROPOSAL_SAFE_FIELDS'
            OR committed_keys = ARRAY(SELECT k FROM unnest(p_safe_field_keys) AS k ORDER BY 1)) THEN
      RETURN QUERY SELECT committed.id, committed.policy_kind, committed.prior_policy_version_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT st.current_policy_version_id INTO current_id
    FROM public.matching_proposal_policy_state st WHERE st.policy_kind = p_policy_kind;
  IF current_id IS DISTINCT FROM p_expected_current_policy_version_id THEN
    RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001',
      DETAIL='A policy version names the exact version of its kind it supersedes.';
  END IF;

  -- Every typed value is the relation's own CHECK; a violation is one bounded answer.
  BEGIN
    INSERT INTO public.matching_proposal_policy_versions
      (id, policy_kind, prior_policy_version_id, window_days, max_count, expiry_hours)
    VALUES (p_policy_version_id, p_policy_kind, p_expected_current_policy_version_id,
            p_window_days, p_max_count, p_expiry_hours);
    IF p_policy_kind = 'PROPOSAL_SAFE_FIELDS' THEN
      INSERT INTO public.matching_proposal_safe_field_keys (policy_version_id, field_key)
      SELECT p_policy_version_id, k FROM unnest(p_safe_field_keys) AS k;
    END IF;
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_POLICY_VALUES_INVALID' USING ERRCODE='22023';
  END;

  IF p_expected_current_policy_version_id IS NULL THEN
    INSERT INTO public.matching_proposal_policy_state (policy_kind, current_policy_version_id)
    VALUES (p_policy_kind, p_policy_version_id);
  ELSE
    UPDATE public.matching_proposal_policy_state st
       SET current_policy_version_id = p_policy_version_id, updated_at = CURRENT_TIMESTAMP
     WHERE st.policy_kind = p_policy_kind AND st.current_policy_version_id = p_expected_current_policy_version_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001'; END IF;
  END IF;

  RETURN QUERY SELECT p_policy_version_id, p_policy_kind, p_expected_current_policy_version_id;
END$$;

COMMENT ON FUNCTION public.install_matching_proposal_policy_version_core_v1(uuid, text, uuid, integer, integer, integer, text[]) IS
  'The database-owner-only proposal policy primitive (CW2-06B-13). Executable by no '
  'application role and exposed through nothing; its only intended caller is a '
  'separately governed operator change. No policy is installed by S6-03.';

-- ---------------------------------------------------------------------------
-- 9b. THE CANONICAL FIRST NAME (CW2-06B-01, D1.3).
--
--    Same signature and the same two answers. RESOLVED carries the Introduction
--    First Name of the human's CURRENT confirmed fact version (P1 §4), and
--    every other case - no version, or a version with no confirmed first name -
--    is the same unresolved answer as before, with a NULL name.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_matching_canonical_first_name_v1(p_user_id uuid)
 RETURNS TABLE(resolution text, first_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  confirmed text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_SUBJECT_REQUIRED' USING ERRCODE='22023';
  END IF;
  -- The ONE canonical source is the confirmed Introduction First Name of this
  -- human's current confirmed fact version. It is never the account Name, a
  -- Public identity, the mutable preparation draft, a declared or corrected but
  -- unconfirmed value, or anything inferred from another attribute; and a later
  -- version never rewrites a view or a Handoff copy that bound an earlier name.
  SELECT f.first_name INTO confirmed
    FROM public.matching_confirmed_fact_state s
    JOIN public.matching_confirmed_fact_versions f
      ON f.id = s.current_fact_version_id AND f.owner_user_id = s.owner_user_id
   WHERE s.owner_user_id = p_user_id;
  IF confirmed IS NULL THEN
    RETURN QUERY SELECT 'UNRESOLVED_NO_CANONICAL_SOURCE'::text, NULL::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'RESOLVED'::text, confirmed;
END$function$;

-- ---------------------------------------------------------------------------
-- 9c. ONE ADDITIONAL PRIVATE REASON (CW2-06B-16), by the 0113 DROP / ADD pattern.
--
--     Private operational state like every other reason: no recipient
--     projection returns it.
-- ---------------------------------------------------------------------------
ALTER TABLE public.matching_proposal_transitions
    DROP CONSTRAINT matching_proposal_transitions_reason_check;
ALTER TABLE public.matching_proposal_transitions
    ADD CONSTRAINT matching_proposal_transitions_reason_check
    CHECK (private_reason_code IS NULL OR private_reason_code IN (
        'RECIPIENT_DECLINED', 'WITHDRAWN_BY_FIRST_PARTY', 'PROPOSAL_EXPIRED',
        'PARTICIPATION_NOT_ACTIVE', 'MATCHING_CONTEXT_GRANT_CHANGED',
        'INTRODUCTION_PROFILE_VERSION_CHANGED', 'MATCHING_REQUIREMENT_VERSION_CHANGED',
        'DISCLOSURE_AUTHORITY_CHANGED', 'PROPOSAL_POLICY_CHANGED',
        'ACTIVE_INTRODUCTION_PRESENT', 'RECIPIENT_VIEW_SUPERSEDED',
        'COMPETING_MATCH_COMMITTED', 'MATCHING_FACT_VERSION_CHANGED'));

-- ---------------------------------------------------------------------------
-- 10. THE PRODUCT PAIR RULE AT CAPTURE, AND THE FACT BINDING (CW2-06B-05).
--
--   The pair rule on both humans' CURRENT confirmed facts, read under the canonical two-human lock the fact writer
--   also takes, with the SAME single bounded refusal that names neither human; and the exact fact versions are bound
--   beside the snapshot.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.capture_matching_eligibility_snapshot_core_v1(p_snapshot_id uuid, p_pair_id uuid, p_user_a uuid, p_user_b uuid)
 RETURNS TABLE(eligibility_snapshot_id uuid, pair_id uuid, lower_user_id uuid, higher_user_id uuid, hard_requirement_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  lo uuid;
  hi uuid;
  resolved_pair uuid;
  low_state record;
  high_state record;
  low_facts record;
  high_facts record;
  cadence uuid;
  pending uuid;
  expiry uuid;
  committed public.matching_eligibility_snapshots;
  hard_total integer;
BEGIN
  IF p_snapshot_id IS NULL THEN RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023'; END IF;
  SELECT c.lower_user_id, c.higher_user_id INTO lo, hi
    FROM public.matching_canonical_pair_v1(p_user_a, p_user_b) c;
  IF lo IS NULL THEN
    RAISE EXCEPTION 'MATCHING_PAIR_MEMBERS_INVALID' USING ERRCODE='22023';
  END IF;

  PERFORM public.lock_matching_pair_humans_v1(lo, hi);

  -- An equivalent retry returns the ALREADY COMMITTED result, read back from the
  -- committed row rather than echoed from this call's own arguments.
  SELECT * INTO committed FROM public.matching_eligibility_snapshots s WHERE s.id = p_snapshot_id;
  IF FOUND THEN
    IF committed.pair_id = p_pair_id AND committed.lower_user_id = lo AND committed.higher_user_id = hi THEN
      SELECT count(*)::int INTO hard_total FROM public.matching_hard_requirement_results r
       WHERE r.eligibility_snapshot_id = p_snapshot_id;
      RETURN QUERY SELECT committed.id, committed.pair_id, committed.lower_user_id,
                          committed.higher_user_id, hard_total;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  SELECT p.id INTO resolved_pair FROM public.matching_pairs p
   WHERE p.lower_user_id = lo AND p.higher_user_id = hi FOR SHARE;
  IF resolved_pair IS NULL OR resolved_pair IS DISTINCT FROM p_pair_id THEN
    RAISE EXCEPTION 'MATCHING_PAIR_NOT_CURRENT' USING ERRCODE='40001',
      DETAIL='A snapshot binds the canonical pair identity that exists right now.';
  END IF;

  SELECT * INTO low_state FROM public.resolve_matching_setup_state_v1(lo);
  SELECT * INTO high_state FROM public.resolve_matching_setup_state_v1(hi);
  -- S6-03 (CW2-06B-05): the Product pair rule reads each human's CURRENT confirmed
  -- facts and nothing else. Missing, unconfirmed or equal values are not eligible,
  -- and the answer is the same one a non-matchable pair gets.
  SELECT * INTO low_facts FROM public.resolve_matching_confirmed_facts_v1(lo);
  SELECT * INTO high_facts FROM public.resolve_matching_confirmed_facts_v1(hi);
  -- BOTH humans must be currently matchable. A cross-human failure is ONE
  -- bounded answer that names no human, so an error can never disclose which of
  -- the two is not participating.
  IF NOT low_state.matchable OR NOT high_state.matchable
     OR low_facts.sex IS NULL OR high_facts.sex IS NULL OR low_facts.sex = high_facts.sex THEN
    RAISE EXCEPTION 'MATCHING_PAIR_NOT_ELIGIBLE' USING ERRCODE='55000',
      DETAIL='Both humans must currently participate and hold a Matching Context Grant, an Introduction Profile, a requirement set and a Pre-Match Disclosure Authority, and the pair must satisfy the Product pair rule on both humans'' current confirmed facts.';
  END IF;
  IF (SELECT r.has_active_introduction FROM public.resolve_matching_active_introduction_v1(lo) r)
     OR (SELECT r.has_active_introduction FROM public.resolve_matching_active_introduction_v1(hi) r) THEN
    RAISE EXCEPTION 'MATCHING_ACTIVE_INTRODUCTION_PRESENT' USING ERRCODE='55000',
      DETAIL='A human holding an active Introduction is not available for a new proposal.';
  END IF;

  -- Every required policy must be CONFIGURED. An unconfigured policy is never
  -- read as a permissive default.
  SELECT st.current_policy_version_id INTO cadence FROM public.matching_proposal_policy_state st
   WHERE st.policy_kind = 'PROPOSAL_CADENCE';
  SELECT st.current_policy_version_id INTO pending FROM public.matching_proposal_policy_state st
   WHERE st.policy_kind = 'PENDING_PROPOSAL_LIMIT';
  SELECT st.current_policy_version_id INTO expiry FROM public.matching_proposal_policy_state st
   WHERE st.policy_kind = 'PROPOSAL_EXPIRY';
  IF cadence IS NULL OR pending IS NULL OR expiry IS NULL THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_POLICY_UNCONFIGURED' USING ERRCODE='55000',
      DETAIL='The proposal cadence, pending maximum and expiry policies are required and fail closed when unconfigured.';
  END IF;

  INSERT INTO public.matching_eligibility_snapshots (
    id, pair_id, lower_user_id, higher_user_id,
    lower_participation_event_id, higher_participation_event_id,
    lower_context_grant_id, higher_context_grant_id,
    lower_profile_version_id, higher_profile_version_id,
    lower_requirement_version_id, higher_requirement_version_id,
    lower_disclosure_authority_id, higher_disclosure_authority_id,
    cadence_policy_version_id, pending_policy_version_id, expiry_policy_version_id)
  VALUES (
    p_snapshot_id, p_pair_id, lo, hi,
    low_state.participation_event_id, high_state.participation_event_id,
    low_state.matching_context_grant_id, high_state.matching_context_grant_id,
    low_state.introduction_profile_version_id, high_state.introduction_profile_version_id,
    low_state.matching_requirement_version_id, high_state.matching_requirement_version_id,
    low_state.pre_match_disclosure_authority_id, high_state.pre_match_disclosure_authority_id,
    cadence, pending, expiry);

  INSERT INTO public.matching_eligibility_snapshot_fact_bindings
    (eligibility_snapshot_id, pair_id, lower_user_id, higher_user_id, lower_fact_version_id, higher_fact_version_id)
  VALUES (p_snapshot_id, p_pair_id, lo, hi, low_facts.fact_version_id, high_facts.fact_version_id);

  SELECT count(*)::int INTO hard_total FROM public.matching_requirement_items i
   WHERE i.requirement_version_id IN (low_state.matching_requirement_version_id,
                                      high_state.matching_requirement_version_id)
     AND i.requirement_strength = 'HARD_DEALBREAKER';

  RETURN QUERY SELECT p_snapshot_id, p_pair_id, lo, hi, hard_total;
END$function$;

-- ---------------------------------------------------------------------------
-- 11. CURRENTNESS OF THE BOUND FACTS (CW2-06B-05 §5, CW2-06B-16).
--
--   One added comparison: both humans' CURRENT confirmed fact versions are still the ones the snapshot bound. A
--   missing binding and a moved version are both MATCHING_FACT_VERSION_CHANGED; every advancing step reaches this one
--   revalidation.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_matching_snapshot_validity_v1(p_eligibility_snapshot_id uuid)
 RETURNS TABLE(still_valid boolean, private_reason_code text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  snapshot public.matching_eligibility_snapshots;
  low_state record;
  high_state record;
  current_cadence uuid;
  current_pending uuid;
  current_expiry uuid;
  bound_facts public.matching_eligibility_snapshot_fact_bindings;
BEGIN
  SELECT * INTO snapshot FROM public.matching_eligibility_snapshots s
   WHERE s.id = p_eligibility_snapshot_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCHING_ELIGIBILITY_SNAPSHOT_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO low_state FROM public.resolve_matching_setup_state_v1(snapshot.lower_user_id);
  SELECT * INTO high_state FROM public.resolve_matching_setup_state_v1(snapshot.higher_user_id);

  -- PAUSE AND OPT-OUT ARE NOT SPECIAL CASES. Both stop participation being
  -- ACTIVE, and that is the first thing asked. The pause REASON is never carried
  -- out of here: the answer is one private code that says participation moved.
  IF low_state.participation_state <> 'ACTIVE' OR high_state.participation_state <> 'ACTIVE' THEN
    RETURN QUERY SELECT false, 'PARTICIPATION_NOT_ACTIVE'::text; RETURN;
  END IF;
  IF low_state.matching_context_grant_id IS DISTINCT FROM snapshot.lower_context_grant_id
     OR high_state.matching_context_grant_id IS DISTINCT FROM snapshot.higher_context_grant_id THEN
    RETURN QUERY SELECT false, 'MATCHING_CONTEXT_GRANT_CHANGED'::text; RETURN;
  END IF;
  IF low_state.introduction_profile_version_id IS DISTINCT FROM snapshot.lower_profile_version_id
     OR high_state.introduction_profile_version_id IS DISTINCT FROM snapshot.higher_profile_version_id THEN
    RETURN QUERY SELECT false, 'INTRODUCTION_PROFILE_VERSION_CHANGED'::text; RETURN;
  END IF;
  IF low_state.matching_requirement_version_id IS DISTINCT FROM snapshot.lower_requirement_version_id
     OR high_state.matching_requirement_version_id IS DISTINCT FROM snapshot.higher_requirement_version_id THEN
    RETURN QUERY SELECT false, 'MATCHING_REQUIREMENT_VERSION_CHANGED'::text; RETURN;
  END IF;
  IF low_state.pre_match_disclosure_authority_id IS DISTINCT FROM snapshot.lower_disclosure_authority_id
     OR high_state.pre_match_disclosure_authority_id IS DISTINCT FROM snapshot.higher_disclosure_authority_id THEN
    RETURN QUERY SELECT false, 'DISCLOSURE_AUTHORITY_CHANGED'::text; RETURN;
  END IF;
  -- S6-03 (CW2-06B-05): the exact confirmed fact versions the snapshot was
  -- captured on must still be both humans' current ones.
  SELECT * INTO bound_facts FROM public.matching_eligibility_snapshot_fact_bindings b
   WHERE b.eligibility_snapshot_id = snapshot.id;
  IF bound_facts.eligibility_snapshot_id IS NULL
     OR bound_facts.lower_fact_version_id IS DISTINCT FROM
        (SELECT f.fact_version_id FROM public.resolve_matching_confirmed_facts_v1(snapshot.lower_user_id) f)
     OR bound_facts.higher_fact_version_id IS DISTINCT FROM
        (SELECT f.fact_version_id FROM public.resolve_matching_confirmed_facts_v1(snapshot.higher_user_id) f) THEN
    RETURN QUERY SELECT false, 'MATCHING_FACT_VERSION_CHANGED'::text; RETURN;
  END IF;

  -- A policy that MOVED and a policy that became UNCONFIGURED are the same
  -- answer, because a missing pointer reads as NULL and NULL is distinct from
  -- the bound identity. Unconfigured is never a permissive default.
  SELECT st.current_policy_version_id INTO current_cadence
    FROM public.matching_proposal_policy_state st WHERE st.policy_kind = 'PROPOSAL_CADENCE';
  SELECT st.current_policy_version_id INTO current_pending
    FROM public.matching_proposal_policy_state st WHERE st.policy_kind = 'PENDING_PROPOSAL_LIMIT';
  SELECT st.current_policy_version_id INTO current_expiry
    FROM public.matching_proposal_policy_state st WHERE st.policy_kind = 'PROPOSAL_EXPIRY';
  IF current_cadence IS DISTINCT FROM snapshot.cadence_policy_version_id
     OR current_pending IS DISTINCT FROM snapshot.pending_policy_version_id
     OR current_expiry IS DISTINCT FROM snapshot.expiry_policy_version_id THEN
    RETURN QUERY SELECT false, 'PROPOSAL_POLICY_CHANGED'::text; RETURN;
  END IF;

  IF (SELECT r.has_active_introduction
        FROM public.resolve_matching_active_introduction_v1(snapshot.lower_user_id) r)
     OR (SELECT r.has_active_introduction
           FROM public.resolve_matching_active_introduction_v1(snapshot.higher_user_id) r) THEN
    RETURN QUERY SELECT false, 'ACTIVE_INTRODUCTION_PRESENT'::text; RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::text;
END$function$;

-- ---------------------------------------------------------------------------
-- 12. THE MANUAL RECORDER REFUSES A REQUIREMENT-FAMILY KEY.
--
--   A family key (CW2-06B-03) is evaluated only by the deterministic evaluator, so no caller-supplied outcome can
--   stand for one.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_matching_hard_requirement_core_v1(p_eligibility_snapshot_id uuid, p_for_user_id uuid, p_requirement_key text, p_outcome text, p_evidence_source_class text)
 RETURNS TABLE(eligibility_snapshot_id uuid, evaluated_for_user_id uuid, requirement_key text, requirement_outcome text, evidence_source_class text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  snapshot public.matching_eligibility_snapshots;
  version_id uuid;
  strength text;
  committed public.matching_hard_requirement_results;
BEGIN
  IF p_eligibility_snapshot_id IS NULL OR p_for_user_id IS NULL OR p_requirement_key IS NULL
     OR p_outcome IS NULL OR p_evidence_source_class IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  IF public.matching_structured_requirement_family_v1(p_requirement_key) THEN
    RAISE EXCEPTION 'MATCHING_REQUIREMENT_EVALUATED_DETERMINISTICALLY' USING ERRCODE='22023',
      DETAIL='An AGE_RANGE, MARITAL_STATUS or AREA requirement is evaluated only against confirmed facts by the one deterministic evaluator, never from a supplied outcome.';
  END IF;
  IF p_outcome NOT IN ('PASS', 'FAIL', 'UNKNOWN') THEN
    RAISE EXCEPTION 'MATCHING_REQUIREMENT_OUTCOME_INVALID' USING ERRCODE='22023';
  END IF;
  -- THE CANDIDATE SELF-TRUTH LAW, as a refusal rather than as a comment. Only
  -- the four allowed source classes exist, and an outcome that claims to be
  -- established must name one while an UNKNOWN must not.
  IF p_evidence_source_class NOT IN ('SELF_AUTHORED_PERSONAL', 'EXPLICIT_MATCHING_ANSWER',
                                     'INTRODUCTION_PROFILE', 'CANONICAL_PRODUCT_ACCOUNT_STATE',
                                     'NOT_ESTABLISHED') THEN
    RAISE EXCEPTION 'MATCHING_EVIDENCE_SOURCE_NOT_ALLOWED' USING ERRCODE='22023',
      DETAIL='A candidate fact may only be established from the human''s own self-authored context, an explicit Matching answer, their Introduction Profile or canonical product account state. A third-party claim and an inference from a name, a voice, a photo, a language style or any stereotype-bearing proxy are not sources.';
  END IF;
  IF (p_outcome = 'UNKNOWN') <> (p_evidence_source_class = 'NOT_ESTABLISHED') THEN
    RAISE EXCEPTION 'MATCHING_UNKNOWN_IS_NOT_SATISFACTION' USING ERRCODE='22023',
      DETAIL='An UNKNOWN carries no established source and an established outcome must name one. UNKNOWN is never promoted to PASS.';
  END IF;

  SELECT * INTO snapshot FROM public.matching_eligibility_snapshots s WHERE s.id = p_eligibility_snapshot_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCHING_ELIGIBILITY_SNAPSHOT_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  PERFORM public.lock_matching_pair_humans_v1(snapshot.lower_user_id, snapshot.higher_user_id);

  version_id := CASE p_for_user_id
                  WHEN snapshot.lower_user_id THEN snapshot.lower_requirement_version_id
                  WHEN snapshot.higher_user_id THEN snapshot.higher_requirement_version_id
                END;
  IF version_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_REQUIREMENT_OWNER_NOT_IN_PAIR' USING ERRCODE='22023';
  END IF;

  -- A result exists only for a HARD_DEALBREAKER. A soft preference is not a
  -- gate and never acquires one by being evaluated here.
  SELECT i.requirement_strength INTO strength FROM public.matching_requirement_items i
   WHERE i.requirement_version_id = version_id AND i.requirement_key = p_requirement_key;
  IF strength IS NULL THEN
    RAISE EXCEPTION 'MATCHING_REQUIREMENT_NOT_IN_VERSION' USING ERRCODE='22023';
  END IF;
  IF strength <> 'HARD_DEALBREAKER' THEN
    RAISE EXCEPTION 'MATCHING_REQUIREMENT_IS_NOT_HARD' USING ERRCODE='22023',
      DETAIL='Only a HARD_DEALBREAKER is evaluated as PASS, FAIL or UNKNOWN. A SOFT_PREFERENCE is never converted into a gate.';
  END IF;

  SELECT * INTO committed FROM public.matching_hard_requirement_results r
   WHERE r.eligibility_snapshot_id = p_eligibility_snapshot_id
     AND r.evaluated_for_user_id = p_for_user_id AND r.requirement_key = p_requirement_key;
  IF FOUND THEN
    IF committed.requirement_outcome = p_outcome
       AND committed.evidence_source_class = p_evidence_source_class
       AND committed.requirement_version_id = version_id THEN
      RETURN QUERY SELECT committed.eligibility_snapshot_id, committed.evaluated_for_user_id,
                          committed.requirement_key, committed.requirement_outcome,
                          committed.evidence_source_class;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_REQUIREMENT_RESULT_CONFLICT' USING ERRCODE='23505',
      DETAIL='A committed hard requirement result is immutable. A different answer for the same requirement is a different evaluation and needs a new snapshot.';
  END IF;

  INSERT INTO public.matching_hard_requirement_results
    (eligibility_snapshot_id, evaluated_for_user_id, requirement_version_id,
     requirement_key, requirement_outcome, evidence_source_class)
  VALUES (p_eligibility_snapshot_id, p_for_user_id, version_id,
          p_requirement_key, p_outcome, p_evidence_source_class);

  RETURN QUERY SELECT p_eligibility_snapshot_id, p_for_user_id, p_requirement_key,
                      p_outcome, p_evidence_source_class;
END$function$;

-- ---------------------------------------------------------------------------
-- 13. B4: ZERO FIELDS UNDER AN EXPLICITLY EMPTY PRODUCT ALLOWLIST (CW2-06B-06).
--
--   Inside the unchanged `IF disclosed = 0 THEN`: an empty intersection is lawful only when the CURRENT Product field
--   policy itself permits zero keys. An empty intersection under a non-empty policy is still refused, and a missing
--   policy is still refused above. Every other check, the one clock, the deadline and their order are byte-identical.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.materialize_matching_recipient_view_core_v1(p_view_id uuid, p_proposal_id uuid, p_recipient_user_id uuid, p_permitted_conclusion_id uuid)
 RETURNS TABLE(recipient_view_id uuid, proposal_id uuid, recipient_role text, superseded_view_id uuid, disclosed_field_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  proposal public.matching_proposals;
  snapshot public.matching_eligibility_snapshots;
  conclusion public.matching_permitted_safe_conclusions;
  committed public.matching_recipient_proposal_views;
  role_of text;
  subject uuid;
  subject_state record;
  bound_profile uuid;
  bound_authority uuid;
  field_policy uuid;
  name_answer record;
  current_view uuid;
  offending_key text;
  disclosed integer;
  delivery_at timestamptz;
BEGIN
  IF p_view_id IS NULL OR p_proposal_id IS NULL OR p_recipient_user_id IS NULL
     OR p_permitted_conclusion_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  SELECT * INTO proposal FROM public.matching_proposals p WHERE p.id = p_proposal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  PERFORM public.lock_matching_pair_humans_v1(proposal.lower_user_id, proposal.higher_user_id);

  -- AN ALREADY MATERIALIZED VIEW IS HISTORY, AND HISTORY IS NOT RE-DECIDED. This
  -- answer is returned before the deadline decision below, so a view that was
  -- really created while the proposal was live keeps answering its own retry
  -- once the deadline has passed.
  SELECT * INTO committed FROM public.matching_recipient_proposal_views v WHERE v.id = p_view_id;
  IF FOUND THEN
    IF committed.proposal_id = p_proposal_id AND committed.recipient_user_id = p_recipient_user_id
       AND committed.permitted_conclusion_id = p_permitted_conclusion_id THEN
      SELECT count(*)::int INTO disclosed FROM public.matching_recipient_proposal_view_fields f
       WHERE f.view_id = p_view_id;
      RETURN QUERY SELECT committed.id, committed.proposal_id, committed.recipient_role,
                          committed.prior_view_id, disclosed;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- The audience is derived from the proposal's own immutable direction. A
  -- caller cannot name an arbitrary recipient: only the two humans of this exact
  -- proposal have a role at all.
  role_of := CASE p_recipient_user_id
               WHEN proposal.first_recipient_user_id THEN 'FIRST_RECIPIENT'
               WHEN proposal.candidate_user_id THEN 'CANDIDATE'
             END;
  IF role_of IS NULL THEN
    RAISE EXCEPTION 'MATCHING_RECIPIENT_NOT_IN_PROPOSAL' USING ERRCODE='22023';
  END IF;
  subject := CASE role_of WHEN 'FIRST_RECIPIENT' THEN proposal.candidate_user_id
                          ELSE proposal.first_recipient_user_id END;

  SELECT * INTO snapshot FROM public.matching_eligibility_snapshots s
   WHERE s.id = proposal.eligibility_snapshot_id;
  bound_profile := CASE subject WHEN snapshot.lower_user_id THEN snapshot.lower_profile_version_id
                                ELSE snapshot.higher_profile_version_id END;
  bound_authority := CASE subject WHEN snapshot.lower_user_id THEN snapshot.lower_disclosure_authority_id
                                  ELSE snapshot.higher_disclosure_authority_id END;

  -- REVALIDATION, not trust. The snapshot says what was true when it was taken;
  -- disclosure requires those identities to still be the subject's CURRENT ones.
  SELECT * INTO subject_state FROM public.resolve_matching_setup_state_v1(subject);
  IF NOT subject_state.matchable
     OR subject_state.introduction_profile_version_id IS DISTINCT FROM bound_profile
     OR subject_state.pre_match_disclosure_authority_id IS DISTINCT FROM bound_authority THEN
    RAISE EXCEPTION 'MATCHING_DISCLOSURE_AUTHORITY_STALE' USING ERRCODE='40001',
      DETAIL='A recipient view may only be built from the subject''s CURRENT Introduction Profile version and CURRENT Pre-Match Disclosure Authority. An authority over an earlier version never silently covers a later one.';
  END IF;

  SELECT st.current_policy_version_id INTO field_policy
    FROM public.matching_proposal_policy_state st WHERE st.policy_kind = 'PROPOSAL_SAFE_FIELDS';
  IF field_policy IS NULL THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_POLICY_UNCONFIGURED' USING ERRCODE='55000',
      DETAIL='The Product pre-Match field policy is required. Human authority is necessary and not sufficient, so an unconfigured Product policy discloses nothing.';
  END IF;

  -- The conclusion was filtered FOR THIS RECIPIENT and is ABOUT THIS SUBJECT.
  SELECT * INTO conclusion FROM public.matching_permitted_safe_conclusions c
   WHERE c.id = p_permitted_conclusion_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCHING_SAFE_CONCLUSION_NOT_PERMITTED' USING ERRCODE='55000',
      DETAIL='A recipient view binds a conclusion the Sensitive Conclusion Filter permitted. A refused, unclassified or unfiltered conclusion has no row here.';
  END IF;
  IF conclusion.for_recipient_user_id <> p_recipient_user_id OR conclusion.about_user_id <> subject THEN
    RAISE EXCEPTION 'MATCHING_SAFE_CONCLUSION_AUDIENCE_MISMATCH' USING ERRCODE='22023',
      DETAIL='The first-recipient view and the candidate view are independent disclosures. A conclusion written for one is never re-aimed at the other.';
  END IF;

  -- The first name comes from the ONE canonical seam and from nowhere else.
  SELECT * INTO name_answer FROM public.resolve_matching_canonical_first_name_v1(subject);
  IF name_answer.resolution <> 'RESOLVED' OR name_answer.first_name IS NULL THEN
    RAISE EXCEPTION 'MATCHING_CANONICAL_FIRST_NAME_UNRESOLVED' USING ERRCODE='55000',
      DETAIL='A proposal presents a first name from an allowed canonical source. There is none in this repository, so the disclosure gate fails closed rather than inferring one.';
  END IF;

  SELECT st.current_view_id INTO current_view
    FROM public.matching_recipient_proposal_view_state st
   WHERE st.proposal_id = p_proposal_id AND st.recipient_user_id = p_recipient_user_id FOR UPDATE;

  -- THE DISCLOSABLE SET IS AN INTERSECTION: approved by the human AND permitted
  -- by Product. Then every VALUE is put through the proposal-output filter, so a
  -- benign key cannot smuggle a contact route or a source identifier past a
  -- ceiling that only ever inspected keys.
  SELECT fv.field_key INTO offending_key
    FROM public.pre_match_disclosure_authority_fields af
    JOIN public.matching_proposal_safe_field_keys pk
      ON pk.policy_version_id = field_policy AND pk.field_key = af.field_key
    JOIN public.introduction_profile_field_values fv
      ON fv.profile_version_id = bound_profile AND fv.field_key = af.field_key
   WHERE af.authority_id = bound_authority
     AND (public.matching_text_carries_contact_route_v1(fv.field_value)
       OR public.matching_text_carries_hidden_provenance_v1(fv.field_value))
   ORDER BY fv.field_key LIMIT 1;
  IF offending_key IS NOT NULL THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_FIELD_VALUE_REFUSED' USING ERRCODE='55000',
      DETAIL=format('The approved field %L carries a direct contact route or a source identifier in its VALUE. I-07A bans a contact-route field KEY; a benign key may not smuggle one through free text.', offending_key);
  END IF;

  SELECT count(*)::int INTO disclosed
    FROM public.pre_match_disclosure_authority_fields af
    JOIN public.matching_proposal_safe_field_keys pk
      ON pk.policy_version_id = field_policy AND pk.field_key = af.field_key
    JOIN public.introduction_profile_field_values fv
      ON fv.profile_version_id = bound_profile AND fv.field_key = af.field_key
   WHERE af.authority_id = bound_authority;
  IF disclosed = 0 THEN
    -- S6-03 (B4): zero disclosed fields are lawful only under a current Product
    -- field policy that permits ZERO keys - "Product permits no profile field
    -- before Mutual Match". Under any other policy an empty set is refused.
    IF EXISTS (SELECT 1 FROM public.matching_proposal_safe_field_keys pk WHERE pk.policy_version_id = field_policy) THEN
      RAISE EXCEPTION 'MATCHING_PROPOSAL_DISCLOSURE_EMPTY' USING ERRCODE='55000',
        DETAIL='Nothing the human approved is also permitted by Product for pre-Match disclosure, so there is no proposal to make.';
    END IF;
  END IF;

  -- THE REAL INSTANT THIS DISCLOSURE HAPPENS AT, read from the database clock
  -- exactly once, after the canonical pair lock, after the view-state row lock,
  -- after every currentness, authority, policy, name and value check, and with
  -- nothing written yet. A transaction-fixed clock is settled BEFORE any of
  -- those waits, so it can decide no deadline of a command that waited
  -- (assurance finding ASSURE-F01); and a wall clock read before this whole
  -- region is a moment the deadline can still cross during it (interim review
  -- finding REM02-TIME-01). The instant the recipient would REALLY be shown this
  -- material is the only lawful basis for the decision, and the line below is
  -- the last statement before the first irreversible write.
  delivery_at := clock_timestamp();
  IF proposal.expires_at <= delivery_at THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_EXPIRED' USING ERRCODE='55000';
  END IF;

  INSERT INTO public.matching_recipient_proposal_views (
    id, proposal_id, recipient_role, recipient_user_id, subject_user_id,
    first_recipient_user_id, candidate_user_id, prior_view_id, eligibility_snapshot_id,
    subject_profile_version_id, subject_disclosure_authority_id,
    safe_field_policy_version_id, permitted_conclusion_id, subject_first_name)
  VALUES (
    p_view_id, p_proposal_id, role_of, p_recipient_user_id, subject,
    proposal.first_recipient_user_id, proposal.candidate_user_id, current_view,
    proposal.eligibility_snapshot_id, bound_profile, bound_authority,
    field_policy, p_permitted_conclusion_id, name_answer.first_name);

  INSERT INTO public.matching_recipient_proposal_view_fields
    (view_id, subject_disclosure_authority_id, safe_field_policy_version_id, field_key, disclosed_value)
  SELECT p_view_id, bound_authority, field_policy, af.field_key, fv.field_value
    FROM public.pre_match_disclosure_authority_fields af
    JOIN public.matching_proposal_safe_field_keys pk
      ON pk.policy_version_id = field_policy AND pk.field_key = af.field_key
    JOIN public.introduction_profile_field_values fv
      ON fv.profile_version_id = bound_profile AND fv.field_key = af.field_key
   WHERE af.authority_id = bound_authority;

  IF current_view IS NULL THEN
    INSERT INTO public.matching_recipient_proposal_view_state
      (proposal_id, recipient_user_id, current_view_id)
    VALUES (p_proposal_id, p_recipient_user_id, p_view_id);
  ELSE
    -- The superseded view is NOT erased: it stays as the historical record of
    -- what this human was actually shown. The pointer moves at the same instant
    -- the disclosure happened, so this gate reads ONE clock and no other.
    UPDATE public.matching_recipient_proposal_view_state st
       SET current_view_id = p_view_id, updated_at = delivery_at
     WHERE st.proposal_id = p_proposal_id AND st.recipient_user_id = p_recipient_user_id
       AND st.current_view_id = current_view;
    IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE='40001'; END IF;
  END IF;

  RETURN QUERY SELECT p_view_id, p_proposal_id, role_of, current_view, disclosed;
END$function$;

-- ---------------------------------------------------------------------------
-- 14. NEUTRAL PRESENTATION (CW2-06B-07).
--
--   Bound internally, presented neutrally: the first name and the conclusion are NULL in every state, after Mutual
--   Match included. The signature, result columns, audience rule, neutral outcome, affordance and read sources are
--   unchanged; what a born Introduction shows is decided by the Handoff and the 0155 projection.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_my_matching_proposal_v1(p_proposal_id uuid)
 RETURNS TABLE(recipient_view_id uuid, matching_proposal_id uuid, presented_first_name text, safe_compatibility_conclusion text, neutral_outcome text, action_available boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  u uuid := auth.uid();
  current_view uuid;
  view_row public.matching_recipient_proposal_views;
  outcome text;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  -- The human is derived from auth.uid() and there is NO recipient parameter, so
  -- a caller cannot even phrase a question about somebody else's proposal. A
  -- proposal this caller holds no current view of answers with the SAME bounded
  -- not-found as one that never existed.
  SELECT st.current_view_id INTO current_view
    FROM public.matching_recipient_proposal_view_state st
   WHERE st.proposal_id = p_proposal_id AND st.recipient_user_id = u;
  IF current_view IS NULL THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO view_row FROM public.matching_recipient_proposal_views v WHERE v.id = current_view;
  SELECT n.neutral_outcome INTO outcome
    FROM public.resolve_matching_proposal_neutral_outcome_v1(p_proposal_id, u) n;

  -- WHAT IS RETURNED IS THE WHOLE OF WHAT MAY BE: an opaque view identity, an
  -- opaque proposal identity, a first name, the filtered safe conclusion, a
  -- neutral outcome and whether this human may act. There is no counterparty
  -- user id, no snapshot, no authority, no profile version, no requirement, no
  -- evidence, no provenance, no private reason and no terminal state name.
  RETURN QUERY
    SELECT view_row.id, view_row.proposal_id,
           -- S6-03 (CW2-06B-07): bound in the view, never presented by this projection.
           NULL::text, NULL::text,
           outcome, (outcome = 'AWAITING_YOU')
      FROM public.matching_permitted_safe_conclusions c
     WHERE c.id = view_row.permitted_conclusion_id;
END$function$;

-- ---------------------------------------------------------------------------
-- 15. THE DETERMINISTIC ARABIC/ENGLISH PRIVACY FLOOR (CW2-06B-09, D7, C8).
--
--     EXTENSION ONLY. Each delta below refuses ONLY new patterns, and every one
--     of them needs at least one non-ASCII character to match, so an ASCII-only
--     text is decided exactly as before and every 0110 / 0113 load-bearing CHECK
--     proof stays true. Each 0111 classifier becomes "its old rule, verbatim, OR
--     its delta"; a NEW delta CHECK sits beside each existing CHECK the extension
--     concerns, and it refuses exactly what its delta classifier refuses because
--     it IS that classifier. Every non-ASCII character is built from its code
--     point with chr(). The floor is deliberately fail-closed: some innocent
--     sentences are refused, which is recoverable, and the documented false
--     positives are the accepted cost. A later model-assisted review may only ADD
--     refusals.
-- ---------------------------------------------------------------------------

-- Arabic-Indic, Persian and full-width digits, the wider separator set, Arabic-script handles and domains, and the Arabic words for a phone, a number, a mobile, the messaging applications, e-mail and "contact me".
CREATE FUNCTION public.matching_text_carries_contact_route_delta_v1(p_text text)
RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT p_text IS NOT NULL
     AND (
          -- Arabic-Indic, Persian or full-width digits, or the wider separator set, in a run the 0110 digit-run rule
          -- refuses once each digit is read as its Western value and each separator as a space.
          (p_text ~ ('[' || chr(1632) || '-' || chr(1641) || chr(1776) || '-' || chr(1785) || chr(65296) || '-' || chr(65305) || chr(1548) || chr(1643) || chr(1644) || chr(1600) || chr(160) || chr(8239) || chr(8208) || chr(8209) || chr(8210) || chr(8211) || chr(8212) || chr(8213) || chr(8722) || chr(183) || chr(8203) || chr(8204) || chr(8205) || chr(8206) || chr(8207) || chr(8294) || chr(8295) || chr(8296) || chr(8297) || chr(1564) || ']')
           AND translate(p_text, chr(1632) || chr(1633) || chr(1634) || chr(1635) || chr(1636) || chr(1637) || chr(1638) || chr(1639) || chr(1640) || chr(1641) || chr(1776) || chr(1777) || chr(1778) || chr(1779) || chr(1780) || chr(1781) || chr(1782) || chr(1783) || chr(1784) || chr(1785) || chr(65296) || chr(65297) || chr(65298) || chr(65299) || chr(65300) || chr(65301) || chr(65302) || chr(65303) || chr(65304) || chr(65305) || chr(1548) || chr(1643) || chr(1644) || chr(1600) || chr(160) || chr(8239) || chr(8208) || chr(8209) || chr(8210) || chr(8211) || chr(8212) || chr(8213) || chr(8722) || chr(183) || chr(8203) || chr(8204) || chr(8205) || chr(8206) || chr(8207) || chr(8294) || chr(8295) || chr(8296) || chr(8297) || chr(1564),
                         '012345678901234567890123456789                        ') ~ ('[0-9](?:[0-9 ()._+-]*[0-9]){6,}'))
          -- a handle written in Arabic script
       OR p_text ~ ('@[' || chr(1569) || '-' || chr(1610) || chr(1649) || '-' || chr(1747) || ']')
          -- an Arabic-script name in front of a domain
       OR p_text ~* ('[' || chr(1569) || '-' || chr(1610) || chr(1649) || '-' || chr(1747) || '][.](com|net|org|io|me|co|uk|eg|app|link|xyz|info|biz|tv|gg|fm|site|online|shop|blog|dev|page)([^a-z]|$)')
          -- an Arabic-script top-level domain
       OR p_text ~ ('[.]' || ('(' ||
          chr(1603) || chr(1608) || chr(1605)   -- com
          || '|' || chr(1606) || chr(1578)   -- net
          || '|' || chr(1588) || chr(1576) || chr(1603) || chr(1577)   -- network (IDN)
          || '|' || chr(1605) || chr(1608) || chr(1602) || chr(1593)   -- site (IDN)
          || '|' || chr(1605) || chr(1589) || chr(1585)   -- Egypt
          || '|' || chr(1575) || chr(1604) || chr(1587) || chr(1593) || chr(1608) || chr(1583) || chr(1610) || chr(1577)   -- Saudi Arabia
          || '|' || chr(1575) || chr(1605) || chr(1575) || chr(1585) || chr(1575) || chr(1578)   -- Emirates
          || '|' || chr(1575) || chr(1604) || chr(1575) || chr(1605) || chr(1575) || chr(1585) || chr(1575) || chr(1578)   -- Emirates
          || '|' || chr(1602) || chr(1591) || chr(1585)   -- Qatar
          || '|' || chr(1593) || chr(1605) || chr(1575) || chr(1606)   -- Oman
          || '|' || chr(1575) || chr(1604) || chr(1575) || chr(1585) || chr(1583) || chr(1606)   -- Jordan
          || '|' || chr(1575) || chr(1604) || chr(1605) || chr(1594) || chr(1585) || chr(1576)   -- Morocco
          || '|' || chr(1578) || chr(1608) || chr(1606) || chr(1587)   -- Tunisia
          || '|' || chr(1575) || chr(1604) || chr(1580) || chr(1586) || chr(1575) || chr(1574) || chr(1585)   -- Algeria
          || '|' || chr(1587) || chr(1608) || chr(1585) || chr(1610) || chr(1575)   -- Syria
          || '|' || chr(1601) || chr(1604) || chr(1587) || chr(1591) || chr(1610) || chr(1606)   -- Palestine
          || '|' || chr(1575) || chr(1604) || chr(1576) || chr(1581) || chr(1585) || chr(1610) || chr(1606)   -- Bahrain
          || '|' || chr(1575) || chr(1604) || chr(1603) || chr(1608) || chr(1610) || chr(1578)   -- Kuwait
          || '|' || chr(1575) || chr(1604) || chr(1610) || chr(1605) || chr(1606)   -- Yemen
          || '|' || chr(1575) || chr(1604) || chr(1587) || chr(1608) || chr(1583) || chr(1575) || chr(1606)   -- Sudan
          || '|' || chr(1605) || chr(1608) || chr(1585) || chr(1610) || chr(1578) || chr(1575) || chr(1606) || chr(1610) || chr(1575)   -- Mauritania
          || ')'))
          -- the Arabic words for a phone, a number, a mobile, the messaging applications, e-mail and "contact me"
       OR p_text ~ ('(' ||
          chr(1585) || chr(1602) || chr(1605) || ' ' || chr(1578) || chr(1604) || chr(1610) || chr(1601) || chr(1608) || chr(1606)   -- phone number
          || '|' || chr(1585) || chr(1602) || chr(1605) || ' ' || chr(1607) || chr(1575) || chr(1578) || chr(1601)   -- phone number
          || '|' || chr(1585) || chr(1602) || chr(1605) || ' ' || chr(1580) || chr(1608) || chr(1575) || chr(1604)   -- mobile number
          || '|' || chr(1585) || chr(1602) || chr(1605) || ' ' || chr(1605) || chr(1608) || chr(1576) || chr(1575) || chr(1610) || chr(1604)   -- mobile number
          || '|' || chr(1607) || chr(1575) || chr(1578) || chr(1601) || chr(1610)   -- my phone
          || '|' || chr(1578) || chr(1604) || chr(1610) || chr(1601) || chr(1608) || chr(1606) || chr(1610)   -- my phone
          || '|' || chr(1578) || chr(1604) || chr(1601) || chr(1608) || chr(1606) || chr(1610)   -- my phone
          || '|' || chr(1580) || chr(1608) || chr(1575) || chr(1604) || chr(1610)   -- my mobile
          || '|' || chr(1605) || chr(1608) || chr(1576) || chr(1575) || chr(1610) || chr(1604) || chr(1610)   -- my mobile
          || '|' || chr(1605) || chr(1608) || chr(1576) || chr(1575) || chr(1610) || chr(1604)   -- mobile
          || '|' || chr(1607) || chr(1575) || chr(1578) || chr(1601)   -- phone
          || '|' || chr(1578) || chr(1604) || chr(1610) || chr(1601) || chr(1608) || chr(1606)   -- phone
          || '|' || chr(1578) || chr(1604) || chr(1601) || chr(1608) || chr(1606)   -- phone
          || '|' || chr(1608) || chr(1575) || chr(1578) || chr(1587) || chr(1575) || chr(1576)   -- WhatsApp
          || '|' || chr(1608) || chr(1575) || chr(1578) || chr(1587) || ' ' || chr(1575) || chr(1576)   -- WhatsApp
          || '|' || chr(1608) || chr(1575) || chr(1578) || chr(1587) || ' ' || chr(1570) || chr(1576)   -- WhatsApp
          || '|' || chr(1608) || chr(1578) || chr(1587) || chr(1575) || chr(1576)   -- WhatsApp
          || '|' || chr(1608) || chr(1575) || chr(1578) || chr(1587)   -- WhatsApp
          || '|' || chr(1578) || chr(1604) || chr(1610) || chr(1580) || chr(1585) || chr(1575) || chr(1605)   -- Telegram
          || '|' || chr(1578) || chr(1610) || chr(1604) || chr(1610) || chr(1580) || chr(1585) || chr(1575) || chr(1605)   -- Telegram
          || '|' || chr(1578) || chr(1604) || chr(1594) || chr(1585) || chr(1575) || chr(1605)   -- Telegram
          || '|' || chr(1578) || chr(1610) || chr(1604) || chr(1610) || chr(1594) || chr(1585) || chr(1575) || chr(1605)   -- Telegram
          || '|' || chr(1578) || chr(1604) || chr(1580) || chr(1585) || chr(1575) || chr(1605)   -- Telegram
          || '|' || chr(1575) || chr(1606) || chr(1587) || chr(1578) || chr(1580) || chr(1585) || chr(1575) || chr(1605)   -- Instagram
          || '|' || chr(1575) || chr(1606) || chr(1587) || chr(1578) || chr(1594) || chr(1585) || chr(1575) || chr(1605)   -- Instagram
          || '|' || chr(1573) || chr(1606) || chr(1587) || chr(1578) || chr(1594) || chr(1585) || chr(1575) || chr(1605)   -- Instagram
          || '|' || chr(1573) || chr(1606) || chr(1587) || chr(1578) || chr(1580) || chr(1585) || chr(1575) || chr(1605)   -- Instagram
          || '|' || chr(1587) || chr(1606) || chr(1575) || chr(1576) || ' ' || chr(1588) || chr(1575) || chr(1578)   -- Snapchat
          || '|' || chr(1587) || chr(1606) || chr(1575) || chr(1576)   -- Snapchat
          || '|' || chr(1601) || chr(1610) || chr(1587) || chr(1576) || chr(1608) || chr(1603)   -- Facebook
          || '|' || chr(1601) || chr(1610) || chr(1587) || ' ' || chr(1576) || chr(1608) || chr(1603)   -- Facebook
          || '|' || chr(1578) || chr(1608) || chr(1610) || chr(1578) || chr(1585)   -- Twitter
          || '|' || chr(1578) || chr(1610) || chr(1603) || ' ' || chr(1578) || chr(1608) || chr(1603)   -- TikTok
          || '|' || chr(1605) || chr(1575) || chr(1587) || chr(1606) || chr(1580) || chr(1585)   -- Messenger
          || '|' || chr(1605) || chr(1587) || chr(1606) || chr(1580) || chr(1585)   -- Messenger
          || '|' || chr(1601) || chr(1575) || chr(1610) || chr(1576) || chr(1585)   -- Viber
          || '|' || chr(1575) || chr(1610) || chr(1605) || chr(1610) || chr(1604)   -- e-mail
          || '|' || chr(1573) || chr(1610) || chr(1605) || chr(1610) || chr(1604)   -- e-mail
          || '|' || chr(1576) || chr(1585) || chr(1610) || chr(1583) || ' ' || chr(1573) || chr(1604) || chr(1603) || chr(1578) || chr(1585) || chr(1608) || chr(1606) || chr(1610)   -- e-mail
          || '|' || chr(1576) || chr(1585) || chr(1610) || chr(1583) || ' ' || chr(1575) || chr(1604) || chr(1603) || chr(1578) || chr(1585) || chr(1608) || chr(1606) || chr(1610)   -- e-mail
          || '|' || chr(1575) || chr(1604) || chr(1576) || chr(1585) || chr(1610) || chr(1583) || ' ' || chr(1575) || chr(1604) || chr(1573) || chr(1604) || chr(1603) || chr(1578) || chr(1585) || chr(1608) || chr(1606) || chr(1610)   -- the e-mail
          || '|' || chr(1575) || chr(1604) || chr(1576) || chr(1585) || chr(1610) || chr(1583) || ' ' || chr(1575) || chr(1604) || chr(1575) || chr(1604) || chr(1603) || chr(1578) || chr(1585) || chr(1608) || chr(1606) || chr(1610)   -- the e-mail
          || '|' || chr(1603) || chr(1604) || chr(1605) || chr(1606) || chr(1610)   -- call me
          || '|' || chr(1603) || chr(1604) || chr(1605) || chr(1610) || chr(1606) || chr(1610)   -- call me
          || '|' || chr(1575) || chr(1578) || chr(1589) || chr(1604) || ' ' || chr(1576) || chr(1610)   -- call me
          || '|' || chr(1575) || chr(1578) || chr(1589) || chr(1604) || chr(1610) || ' ' || chr(1576) || chr(1610)   -- call me
          || '|' || chr(1575) || chr(1578) || chr(1589) || chr(1604) || ' ' || chr(1593) || chr(1604) || chr(1610)   -- call me
          || '|' || chr(1578) || chr(1608) || chr(1575) || chr(1589) || chr(1604) || ' ' || chr(1605) || chr(1593) || chr(1610)   -- contact me
          || '|' || chr(1578) || chr(1608) || chr(1575) || chr(1589) || chr(1604) || chr(1610) || ' ' || chr(1605) || chr(1593) || chr(1610)   -- contact me
          || '|' || chr(1585) || chr(1575) || chr(1587) || chr(1604) || chr(1606) || chr(1610)   -- message me
          || '|' || chr(1585) || chr(1575) || chr(1587) || chr(1604) || chr(1610) || chr(1606) || chr(1610)   -- message me
          || '|' || chr(1575) || chr(1576) || chr(1593) || chr(1578) || chr(1604) || chr(1610)   -- send me
          || '|' || chr(1575) || chr(1576) || chr(1593) || chr(1579) || chr(1604) || chr(1610)   -- send me
          || '|' || chr(1581) || chr(1587) || chr(1575) || chr(1576) || chr(1610)   -- my account
          || '|' || chr(1610) || chr(1608) || chr(1586) || chr(1585)   -- username
          || '|' || chr(1583) || chr(1608) || chr(1578) || ' ' || chr(1603) || chr(1608) || chr(1605)   -- dot com
          || ')'));
$$;

-- A source identifier written with Arabic-Indic, Persian or full-width digits.
CREATE FUNCTION public.matching_text_carries_hidden_provenance_delta_v1(p_text text)
RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT p_text IS NOT NULL
     AND p_text ~ ('[' || chr(1632) || '-' || chr(1641) || chr(1776) || '-' || chr(1785) || chr(65296) || '-' || chr(65305) || ']')
     AND translate(p_text, chr(1632) || chr(1633) || chr(1634) || chr(1635) || chr(1636) || chr(1637) || chr(1638) || chr(1639) || chr(1640) || chr(1641) || chr(1776) || chr(1777) || chr(1778) || chr(1779) || chr(1780) || chr(1781) || chr(1782) || chr(1783) || chr(1784) || chr(1785) || chr(65296) || chr(65297) || chr(65298) || chr(65299) || chr(65300) || chr(65301) || chr(65302) || chr(65303) || chr(65304) || chr(65305), '012345678901234567890123456789')
         ~* ('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
$$;

-- A long verbatim span in Arabic or typographic quotation marks.
CREATE FUNCTION public.matching_text_carries_quoted_span_delta_v1(p_text text)
RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT p_text IS NOT NULL
     AND (p_text ~ (chr(171) || '[^' || chr(187) || ']{24,}' || chr(187))
       OR p_text ~ (chr(8220) || '[^' || chr(8221) || ']{24,}' || chr(8221)));
$$;

-- An Arabic percent sign, a percentage in Arabic-Indic digits, and the Arabic words for a compatibility percentage or score.
CREATE FUNCTION public.matching_text_carries_visible_ranking_delta_v1(p_text text)
RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT p_text IS NOT NULL
     AND (p_text ~ ('[' || chr(1632) || '-' || chr(1641) || chr(1776) || '-' || chr(1785) || chr(65296) || '-' || chr(65305) || ']{1,3} ?[%' || chr(1642) || ']')
       OR p_text ~ ('[0-9]{1,3} ?' || chr(1642))
       OR p_text ~ ('(' ||
          chr(1606) || chr(1587) || chr(1576) || chr(1577) || ' ' || chr(1575) || chr(1604) || chr(1578) || chr(1608) || chr(1575) || chr(1601) || chr(1602)   -- compatibility percentage
          || '|' || chr(1606) || chr(1587) || chr(1576) || chr(1577) || ' ' || chr(1578) || chr(1608) || chr(1575) || chr(1601) || chr(1602)   -- compatibility percentage
          || '|' || chr(1583) || chr(1585) || chr(1580) || chr(1577) || ' ' || chr(1575) || chr(1604) || chr(1578) || chr(1608) || chr(1575) || chr(1601) || chr(1602)   -- compatibility score
          || '|' || chr(1583) || chr(1585) || chr(1580) || chr(1577) || ' ' || chr(1578) || chr(1608) || chr(1575) || chr(1601) || chr(1602)   -- compatibility score
          || '|' || chr(1576) || chr(1575) || chr(1604) || chr(1605) || chr(1574) || chr(1577)   -- per cent
          || '|' || chr(1576) || chr(1575) || chr(1604) || chr(1605) || chr(1575) || chr(1574) || chr(1577)   -- per cent
          || '|' || chr(1601) || chr(1610) || ' ' || chr(1575) || chr(1604) || chr(1605) || chr(1574) || chr(1577)   -- per cent
          || '|' || chr(1601) || chr(1610) || ' ' || chr(1575) || chr(1604) || chr(1605) || chr(1575) || chr(1574) || chr(1577)   -- per cent
          || ')'));
$$;

-- The Arabic markers of the same health, reproductive, financial, legal, immigration, substance and abuse facts.
CREATE FUNCTION public.matching_text_carries_sensitive_fact_delta_v1(p_text text)
RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT p_text IS NOT NULL
     AND p_text ~ ('(' ||
          chr(1587) || chr(1585) || chr(1591) || chr(1575) || chr(1606)   -- cancer
          || '|' || chr(1575) || chr(1604) || chr(1573) || chr(1610) || chr(1583) || chr(1586)   -- AIDS
          || '|' || chr(1575) || chr(1604) || chr(1575) || chr(1610) || chr(1583) || chr(1586)   -- AIDS
          || '|' || chr(1573) || chr(1610) || chr(1583) || chr(1586)   -- AIDS
          || '|' || chr(1575) || chr(1604) || chr(1587) || chr(1603) || chr(1585) || chr(1610)   -- diabetes
          || '|' || chr(1605) || chr(1585) || chr(1590) || ' ' || chr(1575) || chr(1604) || chr(1587) || chr(1603) || chr(1585)   -- diabetes
          || '|' || chr(1589) || chr(1585) || chr(1593)   -- epilepsy
          || '|' || chr(1601) || chr(1589) || chr(1575) || chr(1605)   -- schizophrenia
          || '|' || chr(1579) || chr(1606) || chr(1575) || chr(1574) || chr(1610) || ' ' || chr(1575) || chr(1604) || chr(1602) || chr(1591) || chr(1576)   -- bipolar
          || '|' || chr(1575) || chr(1603) || chr(1578) || chr(1574) || chr(1575) || chr(1576)   -- depression
          || '|' || chr(1575) || chr(1604) || chr(1575) || chr(1603) || chr(1578) || chr(1574) || chr(1575) || chr(1576)   -- depression
          || '|' || chr(1606) || chr(1608) || chr(1576) || chr(1575) || chr(1578) || ' ' || chr(1607) || chr(1604) || chr(1593)   -- panic attacks
          || '|' || chr(1605) || chr(1585) || chr(1590) || ' ' || chr(1606) || chr(1601) || chr(1587) || chr(1610)   -- mental illness
          || '|' || chr(1575) || chr(1590) || chr(1591) || chr(1585) || chr(1575) || chr(1576) || ' ' || chr(1606) || chr(1601) || chr(1587) || chr(1610)   -- mental disorder
          || '|' || chr(1591) || chr(1576) || chr(1610) || chr(1576) || ' ' || chr(1606) || chr(1601) || chr(1587) || chr(1610)   -- psychiatrist
          || '|' || chr(1593) || chr(1604) || chr(1575) || chr(1580) || ' ' || chr(1606) || chr(1601) || chr(1587) || chr(1610)   -- therapy
          || '|' || chr(1571) || chr(1583) || chr(1608) || chr(1610) || chr(1577) || ' ' || chr(1606) || chr(1601) || chr(1587) || chr(1610) || chr(1577)   -- psychiatric medication
          || '|' || chr(1575) || chr(1583) || chr(1608) || chr(1610) || chr(1577) || ' ' || chr(1606) || chr(1601) || chr(1587) || chr(1610) || chr(1577)   -- psychiatric medication
          || '|' || chr(1575) || chr(1606) || chr(1578) || chr(1581) || chr(1575) || chr(1585)   -- suicide
          || '|' || chr(1575) || chr(1604) || chr(1575) || chr(1606) || chr(1578) || chr(1581) || chr(1575) || chr(1585)   -- suicide
          || '|' || chr(1573) || chr(1610) || chr(1584) || chr(1575) || chr(1569) || ' ' || chr(1575) || chr(1604) || chr(1606) || chr(1601) || chr(1587)   -- self-harm
          || '|' || chr(1575) || chr(1610) || chr(1584) || chr(1575) || chr(1569) || ' ' || chr(1575) || chr(1604) || chr(1606) || chr(1601) || chr(1587)   -- self-harm
          || '|' || chr(1578) || chr(1588) || chr(1582) || chr(1610) || chr(1589)   -- diagnosis
          || '|' || chr(1593) || chr(1602) || chr(1605)   -- infertility
          || '|' || chr(1575) || chr(1604) || chr(1593) || chr(1602) || chr(1605)   -- infertility
          || '|' || chr(1571) || chr(1591) || chr(1601) || chr(1575) || chr(1604) || ' ' || chr(1575) || chr(1604) || chr(1571) || chr(1606) || chr(1575) || chr(1576) || chr(1610) || chr(1576)   -- IVF
          || '|' || chr(1575) || chr(1591) || chr(1601) || chr(1575) || chr(1604) || ' ' || chr(1575) || chr(1604) || chr(1575) || chr(1606) || chr(1575) || chr(1576) || chr(1610) || chr(1576)   -- IVF
          || '|' || chr(1573) || chr(1580) || chr(1607) || chr(1575) || chr(1590)   -- abortion / miscarriage
          || '|' || chr(1575) || chr(1580) || chr(1607) || chr(1575) || chr(1590)   -- abortion / miscarriage
          || '|' || chr(1581) || chr(1575) || chr(1605) || chr(1604)   -- pregnant
          || '|' || chr(1593) || chr(1584) || chr(1585) || chr(1610) || chr(1577)   -- virginity
          || '|' || chr(1593) || chr(1584) || chr(1585) || chr(1575) || chr(1569)   -- virgin
          || '|' || chr(1573) || chr(1601) || chr(1604) || chr(1575) || chr(1587)   -- bankruptcy
          || '|' || chr(1575) || chr(1601) || chr(1604) || chr(1575) || chr(1587)   -- bankruptcy
          || '|' || chr(1605) || chr(1601) || chr(1604) || chr(1587)   -- bankrupt
          || '|' || chr(1583) || chr(1610) || chr(1608) || chr(1606)   -- debts
          || '|' || chr(1605) || chr(1583) || chr(1610) || chr(1608) || chr(1606)   -- in debt
          || '|' || chr(1602) || chr(1585) || chr(1590) || ' ' || chr(1605) || chr(1578) || chr(1593) || chr(1579) || chr(1585)   -- loan default
          || '|' || chr(1587) || chr(1580) || chr(1606)   -- prison
          || '|' || chr(1575) || chr(1604) || chr(1587) || chr(1580) || chr(1606)   -- prison
          || '|' || chr(1605) || chr(1587) || chr(1580) || chr(1608) || chr(1606)   -- imprisoned
          || '|' || chr(1605) || chr(1581) || chr(1603) || chr(1608) || chr(1605)   -- convicted
          || '|' || chr(1587) || chr(1608) || chr(1575) || chr(1576) || chr(1602)   -- criminal record
          || '|' || chr(1575) || chr(1593) || chr(1578) || chr(1602) || chr(1575) || chr(1604)   -- arrest
          || '|' || chr(1605) || chr(1593) || chr(1578) || chr(1602) || chr(1604)   -- detained
          || '|' || chr(1602) || chr(1590) || chr(1610) || chr(1577) || ' ' || chr(1580) || chr(1606) || chr(1575) || chr(1574) || chr(1610) || chr(1577)   -- criminal case
          || '|' || chr(1578) || chr(1585) || chr(1581) || chr(1610) || chr(1604)   -- deportation
          || '|' || chr(1604) || chr(1580) || chr(1608) || chr(1569)   -- asylum
          || '|' || chr(1604) || chr(1575) || chr(1580) || chr(1574)   -- refugee
          || '|' || chr(1576) || chr(1583) || chr(1608) || chr(1606) || ' ' || chr(1571) || chr(1608) || chr(1585) || chr(1575) || chr(1602)   -- undocumented
          || '|' || chr(1576) || chr(1583) || chr(1608) || chr(1606) || ' ' || chr(1575) || chr(1608) || chr(1585) || chr(1575) || chr(1602)   -- undocumented
          || '|' || chr(1573) || chr(1602) || chr(1575) || chr(1605) || chr(1577) || ' ' || chr(1594) || chr(1610) || chr(1585) || ' ' || chr(1602) || chr(1575) || chr(1606) || chr(1608) || chr(1606) || chr(1610) || chr(1577)   -- illegal residence
          || '|' || chr(1575) || chr(1602) || chr(1575) || chr(1605) || chr(1577) || ' ' || chr(1594) || chr(1610) || chr(1585) || ' ' || chr(1602) || chr(1575) || chr(1606) || chr(1608) || chr(1606) || chr(1610) || chr(1577)   -- illegal residence
          || '|' || chr(1608) || chr(1590) || chr(1593) || ' ' || chr(1575) || chr(1604) || chr(1578) || chr(1571) || chr(1588) || chr(1610) || chr(1585) || chr(1577)   -- visa status
          || '|' || chr(1573) || chr(1583) || chr(1605) || chr(1575) || chr(1606)   -- addiction
          || '|' || chr(1575) || chr(1583) || chr(1605) || chr(1575) || chr(1606)   -- addiction
          || '|' || chr(1605) || chr(1583) || chr(1605) || chr(1606)   -- addict
          || '|' || chr(1605) || chr(1582) || chr(1583) || chr(1585) || chr(1575) || chr(1578)   -- drugs
          || '|' || chr(1603) || chr(1581) || chr(1608) || chr(1604)   -- alcohol
          || '|' || chr(1578) || chr(1593) || chr(1575) || chr(1591) || chr(1610)   -- substance use
          || '|' || chr(1580) || chr(1585) || chr(1593) || chr(1577) || ' ' || chr(1586) || chr(1575) || chr(1574) || chr(1583) || chr(1577)   -- overdose
          || '|' || chr(1578) || chr(1593) || chr(1606) || chr(1610) || chr(1601)   -- abuse
          || '|' || chr(1605) || chr(1593) || chr(1606) || chr(1601)   -- abused
          || '|' || chr(1573) || chr(1587) || chr(1575) || chr(1569) || chr(1577)   -- abuse
          || ')');
$$;

-- The 0111 rule, verbatim, OR its delta.
CREATE OR REPLACE FUNCTION public.matching_text_carries_contact_route_v1(p_text text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT (p_text IS NOT NULL
     AND (p_text ~* ('(^|[^a-z0-9])@[a-z0-9._]{2,}')
       OR p_text ~* ('[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}')
       OR p_text ~* ('(https?://|www\.)')
       OR p_text ~* ('[a-z0-9-]+\.(com|net|org|io|me|co|uk|eg|app|link|xyz|info|biz'
                  || '|tv|gg|fm|site|online|shop|blog|dev|page)([^a-z]|$)')
       OR p_text ~ ('[0-9](?:[0-9 ()._+-]*[0-9]){6,}')
       OR p_text ~* ('(^|[^a-z])(whats ?app|telegram|instagram|snapchat|tik ?tok|facebook'
                  || '|twitter|linked ?in|messenger|viber|signal|discord|skype|wechat'
                  || '|botim|imo)([^a-z]|$)')))
      OR public.matching_text_carries_contact_route_delta_v1(p_text);
$function$;

-- The 0111 rule, verbatim, OR its delta.
CREATE OR REPLACE FUNCTION public.matching_text_carries_hidden_provenance_v1(p_text text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT (p_text IS NOT NULL
     AND p_text ~* ('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'))
      OR public.matching_text_carries_hidden_provenance_delta_v1(p_text);
$function$;

-- The 0111 rule, verbatim, OR its delta.
CREATE OR REPLACE FUNCTION public.matching_text_carries_quoted_span_v1(p_text text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT (p_text IS NOT NULL AND p_text ~ ('"[^"]{24,}"'))
      OR public.matching_text_carries_quoted_span_delta_v1(p_text);
$function$;

-- The 0111 rule, verbatim, OR its delta.
CREATE OR REPLACE FUNCTION public.matching_text_carries_visible_ranking_v1(p_text text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT (p_text IS NOT NULL
     AND p_text ~* ('(^|[^a-z])([0-9]{1,3} ?%|per ?cent|score[ds]?|scoring|rank(ed|ing|s)?'
                 || '|rating|percentile|match rate|top [0-9]|[0-9]{1,3} out of [0-9]{1,3}'
                 || '|compatibility (score|rating|percentage|index))([^a-z]|$)'))
      OR public.matching_text_carries_visible_ranking_delta_v1(p_text);
$function$;

-- The 0111 rule, verbatim, OR its delta.
CREATE OR REPLACE FUNCTION public.matching_text_carries_sensitive_fact_v1(p_text text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT (p_text IS NOT NULL
     AND p_text ~* ('(^|[^a-z])(hiv|aids|cancer|diabet[a-z]*|epilep[a-z]*|schizophren[a-z]*'
                 || '|bipolar|psychiatric|psychosis|depress(ion|ive)|panic attacks?|self ?harm'
                 || '|suicid[a-z]*|therapy|therapist|medicat(ion|ed)|diagnos(is|ed|es)'
                 || '|infertil[a-z]*|fertility treatment|miscarriage|abortion|pregnan[a-z]*'
                 || '|virgin(ity)?|bankrupt[a-z]*|in debt|debts|loan default|repossess[a-z]*'
                 || '|prison|jail|convict(ed|ion)|criminal record|arrested|deport[a-z]*'
                 || '|asylum|undocumented|visa status|addict[a-z]*|alcoholic|rehab'
                 || '|overdose|abus(ed|ive))([^a-z]|$)'))
      OR public.matching_text_carries_sensitive_fact_delta_v1(p_text);
$function$;

-- The delta CHECKs: the confirmed first name, the recipient view's name and field values, the permitted conclusion,
-- and the Handoff's names, conclusions and field values. CP0 found no other reachable pre-Match disclosure sink.
ALTER TABLE public.matching_confirmed_fact_versions
    ADD CONSTRAINT matching_confirmed_fact_versions_name_contact_floor_check
        CHECK (NOT public.matching_text_carries_contact_route_delta_v1(first_name));
ALTER TABLE public.matching_recipient_proposal_views
    ADD CONSTRAINT matching_recipient_proposal_views_name_contact_floor_check
        CHECK (NOT public.matching_text_carries_contact_route_delta_v1(subject_first_name));
ALTER TABLE public.matching_recipient_proposal_view_fields
    ADD CONSTRAINT matching_recipient_proposal_view_fields_value_contact_floor_check
        CHECK (NOT public.matching_text_carries_contact_route_delta_v1(disclosed_value)),
    ADD CONSTRAINT matching_recipient_proposal_view_fields_value_provenance_floor_check
        CHECK (NOT public.matching_text_carries_hidden_provenance_delta_v1(disclosed_value));
ALTER TABLE public.matching_permitted_safe_conclusions
    ADD CONSTRAINT matching_permitted_safe_conclusions_text_contact_floor_check
        CHECK (NOT public.matching_text_carries_contact_route_delta_v1(permitted_text)),
    ADD CONSTRAINT matching_permitted_safe_conclusions_text_provenance_floor_check
        CHECK (NOT public.matching_text_carries_hidden_provenance_delta_v1(permitted_text)),
    ADD CONSTRAINT matching_permitted_safe_conclusions_text_quote_floor_check
        CHECK (NOT public.matching_text_carries_quoted_span_delta_v1(permitted_text)),
    ADD CONSTRAINT matching_permitted_safe_conclusions_text_ranking_floor_check
        CHECK (NOT public.matching_text_carries_visible_ranking_delta_v1(permitted_text));
ALTER TABLE public.matching_match_handoff_subjects
    ADD CONSTRAINT matching_match_handoff_subjects_name_contact_floor_check
        CHECK (NOT public.matching_text_carries_contact_route_delta_v1(presented_first_name));
ALTER TABLE public.matching_match_handoff_subjects
    ADD CONSTRAINT matching_match_handoff_subjects_conclusion_contact_floor_check
        CHECK (NOT public.matching_text_carries_contact_route_delta_v1(safe_compatibility_conclusion)),
    ADD CONSTRAINT matching_match_handoff_subjects_conclusion_provenance_floor_check
        CHECK (NOT public.matching_text_carries_hidden_provenance_delta_v1(safe_compatibility_conclusion));
ALTER TABLE public.matching_match_handoff_fields
    ADD CONSTRAINT matching_match_handoff_fields_value_contact_floor_check
        CHECK (NOT public.matching_text_carries_contact_route_delta_v1(disclosed_value)),
    ADD CONSTRAINT matching_match_handoff_fields_value_provenance_floor_check
        CHECK (NOT public.matching_text_carries_hidden_provenance_delta_v1(disclosed_value));

-- ---------------------------------------------------------------------------
-- 16. OWNERSHIP AND THE PRE-LAUNCH ACL: every new and replaced function is
--     executable by nobody. CREATE OR REPLACE preserves an ACL, so the posture
--     is revoked again explicitly rather than trusted.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  boundary text;
BEGIN
  FOREACH boundary IN ARRAY ARRAY[
    'public.record_matching_confirmed_facts_core_v1(uuid,uuid,uuid,text,timestamptz,text,timestamptz,integer,integer,timestamptz,text,text,timestamptz,text,timestamptz)',
    'public.resolve_matching_confirmed_facts_v1(uuid)',
    'public.matching_structured_requirement_family_v1(text)',
    'public.matching_structured_age_range_v1(text)',
    'public.matching_structured_marital_set_v1(text)',
    'public.matching_structured_area_v1(text)',
    'public.matching_structured_age_outcome_v1(integer,integer,date,integer,integer)',
    'public.matching_structured_age_horizon_v1(integer,integer,integer)',
    'public.evaluate_matching_structured_requirements_core_v1(uuid)',
    'public.install_matching_proposal_policy_version_core_v1(uuid,text,uuid,integer,integer,integer,text[])',
    'public.matching_text_carries_contact_route_delta_v1(text)',
    'public.matching_text_carries_hidden_provenance_delta_v1(text)',
    'public.matching_text_carries_quoted_span_delta_v1(text)',
    'public.matching_text_carries_visible_ranking_delta_v1(text)',
    'public.matching_text_carries_sensitive_fact_delta_v1(text)',
    'public.resolve_matching_canonical_first_name_v1(uuid)',
    'public.capture_matching_eligibility_snapshot_core_v1(uuid,uuid,uuid,uuid)',
    'public.resolve_matching_snapshot_validity_v1(uuid)',
    'public.evaluate_matching_hard_requirement_core_v1(uuid,uuid,text,text,text)',
    'public.materialize_matching_recipient_view_core_v1(uuid,uuid,uuid,uuid)',
    'public.resolve_my_matching_proposal_v1(uuid)',
    'public.matching_text_carries_contact_route_v1(text)',
    'public.matching_text_carries_hidden_provenance_v1(text)',
    'public.matching_text_carries_quoted_span_v1(text)',
    'public.matching_text_carries_visible_ranking_v1(text)',
    'public.matching_text_carries_sensitive_fact_v1(text)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', boundary);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', boundary);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', boundary);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 17. TERMINAL SELF-ASSERTIONS.
--
--     The migration refuses to deploy a fact source, an evaluator, a policy
--     primitive or a privacy floor that is application-executable, that a role
--     can read, that carries a row, that has a second writer, that names a
--     suspended command, whose first-name shape drifted from S6-01's, or that
--     moved the disclosure gate's clock or deadline.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  own_tables text[] := ARRAY['matching_confirmed_fact_versions', 'matching_confirmed_fact_state',
                             'matching_eligibility_snapshot_fact_bindings'];
  target_table text;
  target_role text;
  target_privilege text;
  offending text;
  gate_source text;
  reason_def text;
BEGIN
  -- NO ROLE EXECUTES ANYTHING S6-03 ADDED OR REPLACED HERE.
  SELECT string_agg(format('%s:%s', r.rolname, p.oid::regprocedure), ', ') INTO offending
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN (SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')) r
   WHERE n.nspname = 'public'
     AND p.proname IN ('record_matching_confirmed_facts_core_v1', 'resolve_matching_confirmed_facts_v1',
                       'matching_structured_requirement_family_v1', 'matching_structured_age_range_v1',
                       'matching_structured_marital_set_v1', 'matching_structured_area_v1',
                       'matching_structured_age_outcome_v1', 'matching_structured_age_horizon_v1',
                       'evaluate_matching_structured_requirements_core_v1',
                       'install_matching_proposal_policy_version_core_v1',
                       'resolve_matching_canonical_first_name_v1', 'capture_matching_eligibility_snapshot_core_v1',
                       'resolve_matching_snapshot_validity_v1', 'evaluate_matching_hard_requirement_core_v1',
                       'materialize_matching_recipient_view_core_v1', 'resolve_my_matching_proposal_v1',
                       'reject_matching_confirmed_fact_mutation_v1', 'matching_confirmed_fact_state_truth_v1',
                       'matching_snapshot_fact_binding_truth_v1')
     AND has_function_privilege(r.rolname, p.oid, 'EXECUTE');
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'S6-03: no application role may execute a Matching core, reader, helper or writer: %', offending;
  END IF;
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO offending
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace,
         LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
   WHERE n.nspname = 'public' AND p.proname ~ '^(matching_text_carries_|matching_structured_|record_matching_confirmed|resolve_matching_confirmed)'
     AND a.grantee = 0;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'S6-03: PUBLIC may execute no new function: %', offending;
  END IF;

  -- THE THREE RELATIONS ARE PRIVATE OPERATIONAL STATE.
  FOREACH target_table IN ARRAY own_tables LOOP
    IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = ('public.' || target_table)::regclass)
       OR EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = ('public.' || target_table)::regclass) THEN
      RAISE EXCEPTION 'S6-03: % must have row level security on and no policy', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      FOREACH target_privilege IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
        IF has_table_privilege(target_role, 'public.' || target_table, target_privilege) THEN
          RAISE EXCEPTION 'S6-03: % holds % on %', target_role, target_privilege, target_table;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  SELECT string_agg(con.conname, ', ') INTO offending
    FROM pg_constraint con JOIN pg_class cl ON cl.oid = con.conrelid
   WHERE cl.relnamespace = 'public'::regnamespace AND cl.relname = ANY (own_tables)
     AND con.contype = 'f' AND con.confdeltype <> 'r';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'S6-03: every foreign key must be ON DELETE RESTRICT; found %', offending;
  END IF;
  -- No relation outside the preparation schema references it.
  IF EXISTS (SELECT 1 FROM pg_constraint con
              WHERE con.contype = 'f' AND con.conrelid IN (SELECT ('public.' || t)::regclass FROM unnest(own_tables) t)
                AND con.confrelid IN (SELECT r.oid FROM pg_class r
                                       WHERE r.relnamespace = 'introductions_preparation_private'::regnamespace)) THEN
    RAISE EXCEPTION 'S6-03: the confirmed fact source may not reference the 0154 preparation';
  END IF;
  -- No column claims consent, a source or a confirmation by the owner (R5).
  SELECT string_agg(format('%s.%s', c.table_name, c.column_name), ', ') INTO offending
    FROM information_schema.columns c
   WHERE c.table_schema = 'public' AND c.table_name = ANY (own_tables)
     AND c.column_name ~* '(consent|source|evidence|confirmed_by|provenance|declared|corrected|score|rank|weight)';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'S6-03: a fact version carries no consent, source or evidence claim of its own; found %', offending;
  END IF;

  -- NOTHING IS INSTALLED, PROMOTED OR BOUND.
  IF (SELECT count(*) FROM public.matching_confirmed_fact_versions) <> 0
     OR (SELECT count(*) FROM public.matching_confirmed_fact_state) <> 0
     OR (SELECT count(*) FROM public.matching_eligibility_snapshot_fact_bindings) <> 0
     OR (SELECT count(*) FROM public.matching_proposal_policy_versions) <> 0
     OR (SELECT count(*) FROM public.matching_proposal_policy_state) <> 0 THEN
    RAISE EXCEPTION 'S6-03: no confirmed fact, binding or policy row may exist after this migration';
  END IF;

  -- THE FIRST-NAME SHAPE IS EXACTLY S6-01''s.
  IF (SELECT pg_get_constraintdef(con.oid) FROM pg_constraint con
       WHERE con.conrelid = 'public.matching_confirmed_fact_versions'::regclass
         AND con.conname = 'matching_confirmed_fact_versions_first_name_check')
     IS DISTINCT FROM
     (SELECT pg_get_constraintdef(con.oid) FROM pg_constraint con
       WHERE con.conrelid = 'introductions_preparation_private.declared_facts'::regclass
         AND con.conname = 'declared_facts_first_name_check') THEN
    RAISE EXCEPTION 'S6-03: the confirmed first-name shape must be exactly the S6-01 declared first-name shape';
  END IF;

  -- ONE WRITER EACH: the facts, the bindings and the family results.
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO offending
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
     AND p.prosrc ~ '(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.matching_confirmed_fact_(versions|state)'
     AND p.proname <> 'record_matching_confirmed_facts_core_v1';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'S6-03: the one internal writer is the only writer of confirmed facts; found %', offending;
  END IF;
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO offending
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
     AND p.prosrc ~ 'INSERT\s+INTO\s+public\.matching_eligibility_snapshot_fact_bindings'
     AND p.proname <> 'capture_matching_eligibility_snapshot_core_v1';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'S6-03: snapshot capture is the only writer of a fact binding; found %', offending;
  END IF;
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO offending
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
     AND p.prosrc ~ 'INSERT\s+INTO\s+public\.matching_hard_requirement_results'
     AND p.proname NOT IN ('evaluate_matching_structured_requirements_core_v1', 'evaluate_matching_hard_requirement_core_v1');
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'S6-03: hard requirement results have exactly two writers; found %', offending;
  END IF;
  IF (SELECT p.prosrc FROM pg_proc p WHERE p.oid = 'public.evaluate_matching_hard_requirement_core_v1(uuid,uuid,text,text,text)'::regprocedure)
     !~ 'matching_structured_requirement_family_v1\(p_requirement_key\)' THEN
    RAISE EXCEPTION 'S6-03: the manual recorder must refuse every requirement-family key';
  END IF;

  -- THE READERS, HELPERS AND DELTAS WRITE NOTHING, AND THE DELTAS READ NOTHING.
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO offending
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('resolve_matching_confirmed_facts_v1', 'resolve_matching_canonical_first_name_v1',
                       'resolve_matching_snapshot_validity_v1', 'resolve_my_matching_proposal_v1')
     AND (p.provolatile <> 's' OR p.prosrc ~ '(INSERT INTO|UPDATE public\.|DELETE FROM|TRUNCATE)');
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'S6-03: a resolver is STABLE and writes nothing; found %', offending;
  END IF;
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO offending
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname ~ '^(matching_text_carries_|matching_structured_)'
     AND (p.provolatile <> 'i' OR p.prosecdef OR p.prosrc ~* '\mFROM\s+public\.');
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'S6-03: a classifier or an encoding helper is IMMUTABLE, invoker-rights and reads no relation; found %', offending;
  END IF;

  -- NO FUNCTION S6-03 ADDED OR REPLACED NAMES A SUSPENDED COMMAND.
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO offending
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND (p.proname ~ '^(matching_text_carries_|matching_structured_|record_matching_confirmed|resolve_matching_confirmed|install_matching_proposal_policy)'
          OR p.proname IN ('evaluate_matching_structured_requirements_core_v1', 'resolve_matching_canonical_first_name_v1',
                           'capture_matching_eligibility_snapshot_core_v1', 'resolve_matching_snapshot_validity_v1',
                           'evaluate_matching_hard_requirement_core_v1', 'materialize_matching_recipient_view_core_v1',
                           'resolve_my_matching_proposal_v1'))
     AND p.prosrc ~ '(activate_matching_participation|resume_matching_participation|grant_matching_context|set_introduction_profile|set_matching_requirements|grant_pre_match_disclosure_authority)';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'S6-03: no function may name a command 0149 suspended; found %', offending;
  END IF;

  -- THE DISCLOSURE GATE KEEPS ITS ONE CLOCK, ITS DEADLINE AND ITS ORDER (R4-B).
  SELECT p.prosrc INTO gate_source FROM pg_proc p
   WHERE p.oid = 'public.materialize_matching_recipient_view_core_v1(uuid,uuid,uuid,uuid)'::regprocedure;
  IF (length(gate_source) - length(replace(gate_source, 'clock_timestamp()', ''))) / length('clock_timestamp()') <> 1
     OR gate_source ~* '(now\(\)|localtimestamp|current_timestamp|transaction_timestamp|statement_timestamp)'
     OR strpos(gate_source, 'IF disclosed = 0 THEN') = 0
     OR strpos(gate_source, 'IF disclosed = 0 THEN') > strpos(gate_source, 'delivery_at := clock_timestamp()')
     OR strpos(gate_source, 'delivery_at := clock_timestamp()') > strpos(gate_source, 'proposal.expires_at <= delivery_at')
     OR strpos(gate_source, 'proposal.expires_at <= delivery_at')
        > strpos(gate_source, 'INSERT INTO public.matching_recipient_proposal_views (') THEN
    RAISE EXCEPTION 'S6-03: the disclosure gate keeps exactly its one real delivery instant, its deadline and their order';
  END IF;

  -- THE REASON VOCABULARY IS THE TWELVE EXISTING CODES AND ONE MORE.
  SELECT pg_get_constraintdef(con.oid) INTO reason_def FROM pg_constraint con
   WHERE con.conrelid = 'public.matching_proposal_transitions'::regclass
     AND con.conname = 'matching_proposal_transitions_reason_check';
  IF strpos(reason_def, '''MATCHING_FACT_VERSION_CHANGED''') = 0
     OR strpos(reason_def, '''COMPETING_MATCH_COMMITTED''') = 0
     OR (length(reason_def) - length(replace(reason_def, '''', ''))) / 2 <> 13 THEN
    RAISE EXCEPTION 'S6-03: the private reason vocabulary is exactly the twelve existing codes and MATCHING_FACT_VERSION_CHANGED';
  END IF;

  -- THE SEAMS STILL FAIL CLOSED.
  IF (SELECT r.clearance FROM public.resolve_matching_proposal_prerequisites_v1(gen_random_uuid()) r) <> 'NOT_EVALUATED'
     OR (SELECT r.resolution FROM public.resolve_matching_canonical_first_name_v1(gen_random_uuid()) r)
        <> 'UNRESOLVED_NO_CANONICAL_SOURCE' THEN
    RAISE EXCEPTION 'S6-03: the CW2-08 seam and the first-name resolver must still fail closed for an unknown human';
  END IF;
END$$;

COMMIT;
