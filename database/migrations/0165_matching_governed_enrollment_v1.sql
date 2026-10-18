-- S6-07 - Governed Matching enrollment v1 (CP1: Governed Enrollment).
--
-- Product authority: the Product Owner's S6-07 Final Task Contract, the CP0 report and its review addendum as approved
-- on 2026-10-18 ("S6-07 - CP0 Approved / Start CP1": Q1, Q2(b), Q3-A, Q4', Q5', Q6, Q7' / Q7'', Q8(A), Q9, Q10) and the
-- Controlled Amendments they approve: CA-01-impl, CA-R5-impl, CA-08-impl, CA-10-impl and CA-GATE. The execution record is
-- docs/e2e/QANDEEL_S6_07_IMPLEMENTATION_RECORD_v1.md; the runtime amendment is docs/matching-introduction-runtime-v1.md
-- §50. This migration is that task's CP1 database part, and nothing more.
--
-- ## What is added (schema matching_enrollment_private, not exposed through the Data API)
--
--   1. ONE operator gate, scope ENROLLMENT, in the 0154 pattern (CA-GATE, Q2(b)): one server-canonical state row, changed
--      only by an operator function no application role can execute, every change audited. An absent row DENIES. ALLOW
--      needs ENABLED and SATISFIED (or WAIVED_BY_AUTHORIZED_GOVERNANCE). Nothing is configured here: the gate is closed.
--   2. The enrollment consent catalogue: the exact Arabic and English text of each version of the three consents - Matching
--      participation, the Matching Context Grant and the Pre-Match Disclosure Authority - with its SHA-256. It is created
--      EMPTY: the texts are Product copy and enter through the Copy Gate (S6-07 CP3) with the operator installer below. No
--      enrollment can succeed before a current text of each purpose exists, whatever the gate says.
--   3. The durable evidence (CW2-06B-02 §5): `fact_promotions` - the exact confirmed fact version a human's own act
--      produced and the exact reviewed draft version it came from - and `enrollment_acts` - every committed act of the
--      boundary, bound to the exact consent versions it exercised and to the exact I-07 events it created.
--   4. `command_ledger`: each committed boundary command once, by its command id; a retry answers the first result and a
--      reused id with a different request changes nothing.
--   5. Two internal cores, executable by NO role and called only by the boundary:
--        public.set_empty_matching_requirements_core_v1                  (CA-10-impl, Q4')  a requirement version with
--            zero items - "no additional hard dealbreaker" and "no soft preference" as the ABSENCE of items, never a
--            sentinel (CW2-06B-04 §9); 0109 still refuses an empty set, unchanged
--        public.grant_zero_field_pre_match_disclosure_authority_core_v1  (CA-08-impl, Q3-A) a Pre-Match Disclosure
--            Authority over the exact current profile version that approves ZERO profile fields (CW2-06B-06): no field is
--            disclosed before a Mutual Match; only the Product-permitted bounded conclusion may be
--      Each repeats the frozen 0109 lock, replay, compare-and-swap and history rules exactly, with the human passed by its
--      only caller instead of read from the session.
--   6. public.enroll_my_matching_setup_v1 - THE ONE governed enrollment boundary (CA-01-impl, CA-R5-impl, Q1, Q8(A)):
--      authenticated only, SECURITY DEFINER, the human from auth.uid() and nothing else. It is the only function besides
--      the six themselves that names one of the six setup commands 0149 closed, and the only caller of the 0156 writer.
--      It calls them with their frozen bodies, which stay executable by no application role.
--   7. public.read_my_matching_enrollment_v1 - the owner's own enrollment availability, consent texts and setup state.
--
-- ## What is redefined forward (CREATE OR REPLACE; same signature, same RETURNS TABLE, owner and ACL re-asserted)
--
--   * resolve_matching_confirmed_facts_v1 - answers only for a current fact version that carries a promotion record
--     (CW2-06B-02 §5, CA-R5-impl). A fact version written any other way is UNKNOWN everywhere downstream: discovery,
--     the pair rule at capture and snapshot currentness all read it through this one reader.
--
-- ## The four acts (p_kind) and what each carries
--
--   ENROLL             participation OFF (or never set) -> the single confirmation of Q8(A): the reviewed draft's facts
--                      promoted, participation activated (MANUAL_MY_WORLD_ENTRY), the Matching Context Grant granted, the
--                      profile and the requirements set, and the zero-field disclosure authority granted - three distinct
--                      consent events, each with its own exact consent version, each revocable on its own through the
--                      retained 0109 commands
--   CORRECTION         an enrolled human (ACTIVE or PAUSED) -> the re-reviewed draft promoted again; only what changed gets a
--                      new version; an ACTIVE disclosure authority whose basis (the profile version) moved is re-granted
--                      (RECONFIRMED) only with a fresh disclosure consent; a revoked authority or grant is never re-granted
--                      here, and participation is never touched
--   RESUME             a USER_PAUSED participation resumed with a fresh participation consent; every other pause is refused
--   RECONFIRM_CONSENT  the Matching Context Grant and / or the disclosure authority granted again (GRANTED, or RECONFIRMED
--                      over the active one) under the current consent version, each only when its consent is supplied
--
-- An act carries exactly the consents it exercises; a draft version only when it promotes the draft.
--
-- ## Order, idempotency and refusals
--
--   1. the account row            FOR KEY SHARE (a deletion request takes it FOR UPDATE and waits for this act)
--   2. a committed command id     answers its first result, whatever has changed since; a reused id is COMMAND_CONFLICT
--   3. a live account deletion    DELETION_PENDING (SCHEDULED, BLOCKED, ERASED or COMPLETED), before any Matching lock
--   4. the ENROLLMENT gate        FOR SHARE; anything but ALLOW is NOT_AVAILABLE_NOW
--   5. ONE block, all or nothing: the caller's own matching_setup_locks row (the 0109 statement) -> the consent texts FOR
--      SHARE -> the draft FOR SHARE -> the frozen commands and the two cores. Every refusal inside rolls the whole block
--      back, the lock row included, so a refused act leaves no footprint at all (NEW_FOOTPRINT_ZERO).
--
--   ENROLLED | CORRECTED | RESUMED | RECONFIRMED          committed (with the resulting participation state and matchable)
--   NOT_AVAILABLE_NOW   the gate is not open                DELETION_PENDING   the account is being deleted
--   CHANGED             the draft moved, or a stale state  INCOMPLETE         the draft is not reviewed, a fact is not
--                       (40001 / PT409 absorbed)                               confirmed, no profile field exists, or a
--                                                                              value cannot be promoted
--   CONSENT_OUTDATED    a consent version is not the current text of its purpose (or one the act needs is missing)
--   ALREADY_ENROLLED    ENROLL while participating         NOT_ENROLLED       another act before any enrollment, or OFF
--   NOT_RESUMABLE       a pause this act may not lift      NO_CHANGE          CORRECTION with nothing to change
--   COMMAND_CONFLICT    this command id names a different request
--
-- The cores' 40001 is absorbed and never reaches PostgREST, which re-runs a 40001 transaction without bound before v16
-- (PROD-RETRY-01, QAN-BL-PROD-06); the handler names PT409 too, so it is no CATCH_TRAP, and this boundary raises no PT409
-- of its own. The identities the frozen commands bind are DERIVED from (the human, the command id, the slot), the S6-05
-- pattern, so a retried act derives the same ones.
--
-- ## What is deliberately NOT here
--
--   * No change to 0108 / 0109 / 0149 / 0150 / 0154 / 0156 / 0164 bytes; none of the six is granted, re-created, dropped
--     or re-owned; no plain grant, default privilege or service_role path to any Matching write.
--   * No consent text and no gate row: production stays closed (no Launch Gate opens; CW2-08 stays NOT_EVALUATED).
--   * No forward producer (CP2), Activity or Direct Entry (CP3), export (CP4), copy or mobile surface.
--
-- ## Deletion
--
-- Every new relation that names an account references public.users ON DELETE CASCADE and is registered ACCOUNT_CASCADE in
-- the ACCT-DEL-01 coverage registry, so the governed erasure removes it with the account row; nothing here references a
-- relation the erasure deletes from, and nothing references these relations from outside.
--
-- Forward-only. Migrations 0001-0164 are byte-unchanged.
BEGIN;

CREATE SCHEMA matching_enrollment_private;
ALTER SCHEMA matching_enrollment_private OWNER TO postgres;
REVOKE ALL ON SCHEMA matching_enrollment_private FROM PUBLIC;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. THE ENROLLMENT GATE (CA-GATE; the 0154 pattern). Closed: no row is installed.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE matching_enrollment_private.gate_states (
  scope text NOT NULL,
  feature_flag_state text NOT NULL,
  launch_requirements_state text NOT NULL,
  restriction_version bigint NOT NULL,
  decided_by text NOT NULL,
  policy_basis text NOT NULL,
  decided_at timestamptz NOT NULL,
  CONSTRAINT gate_states_pk PRIMARY KEY (scope),
  CONSTRAINT gate_states_scope_check CHECK (scope = 'ENROLLMENT'),
  CONSTRAINT gate_states_flag_check
    CHECK (feature_flag_state IN ('DISABLED', 'INTERNAL', 'LIMITED_ROLLOUT', 'ENABLED', 'EMERGENCY_DISABLED')),
  CONSTRAINT gate_states_requirements_check
    CHECK (launch_requirements_state IN ('SATISFIED', 'UNSATISFIED', 'UNKNOWN', 'WAIVED_BY_AUTHORIZED_GOVERNANCE')),
  CONSTRAINT gate_states_version_check CHECK (restriction_version >= 1),
  CONSTRAINT gate_states_decided_by_check CHECK (length(btrim(decided_by)) BETWEEN 1 AND 120),
  CONSTRAINT gate_states_basis_check CHECK (length(btrim(policy_basis)) BETWEEN 1 AND 500)
);

CREATE TABLE matching_enrollment_private.gate_events (
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
    REFERENCES matching_enrollment_private.gate_states (scope) ON DELETE RESTRICT,
  CONSTRAINT gate_events_version_key UNIQUE (scope, restriction_version)
);

-- The ONLY way the gate changes. Executable by no application role: an operator runs it as the database owner. Opening it
-- in production is a Stage 9 operator act under a Product Owner launch decision, never this task's.
CREATE FUNCTION matching_enrollment_private.set_gate_v1(
  p_feature_flag_state text, p_launch_requirements_state text, p_decided_by text, p_policy_basis text
) RETURNS TABLE (scope text, restriction_version bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_version bigint;
  v_at timestamptz := clock_timestamp();
BEGIN
  SELECT s.restriction_version INTO v_version
    FROM matching_enrollment_private.gate_states s WHERE s.scope = 'ENROLLMENT' FOR UPDATE;
  v_version := COALESCE(v_version, 0) + 1;
  INSERT INTO matching_enrollment_private.gate_states AS s
    (scope, feature_flag_state, launch_requirements_state, restriction_version, decided_by, policy_basis, decided_at)
  VALUES ('ENROLLMENT', p_feature_flag_state, p_launch_requirements_state, v_version, p_decided_by, p_policy_basis, v_at)
  ON CONFLICT ON CONSTRAINT gate_states_pk DO UPDATE
     SET feature_flag_state = EXCLUDED.feature_flag_state,
         launch_requirements_state = EXCLUDED.launch_requirements_state,
         restriction_version = EXCLUDED.restriction_version,
         decided_by = EXCLUDED.decided_by,
         policy_basis = EXCLUDED.policy_basis,
         decided_at = EXCLUDED.decided_at;
  INSERT INTO matching_enrollment_private.gate_events
    (scope, feature_flag_state, launch_requirements_state, restriction_version, decided_by, policy_basis, decided_at)
  VALUES ('ENROLLMENT', p_feature_flag_state, p_launch_requirements_state, v_version, p_decided_by, p_policy_basis, v_at);
  RETURN QUERY SELECT 'ENROLLMENT'::text, v_version;
END$$;

-- The current verdict, locked FOR SHARE so an operator change waits for the act that relies on it.
CREATE FUNCTION matching_enrollment_private.bind_gate_v1()
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_state matching_enrollment_private.gate_states;
BEGIN
  SELECT * INTO v_state FROM matching_enrollment_private.gate_states s WHERE s.scope = 'ENROLLMENT' FOR SHARE;
  IF NOT FOUND THEN RETURN 'DENY'; END IF;
  IF v_state.feature_flag_state = 'ENABLED'
     AND v_state.launch_requirements_state IN ('SATISFIED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE') THEN
    RETURN 'ALLOW';
  END IF;
  RETURN 'DENY';
END$$;

-- A presentation hint only: no lock; the boundary binds the gate itself.
CREATE FUNCTION matching_enrollment_private.gate_open_v1()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM matching_enrollment_private.gate_states s
                  WHERE s.scope = 'ENROLLMENT' AND s.feature_flag_state = 'ENABLED'
                    AND s.launch_requirements_state IN ('SATISFIED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE'))
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. THE ENROLLMENT CONSENT CATALOGUE. Created empty: every text is Product copy (Copy Gate, S6-07 CP3).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE matching_enrollment_private.consent_texts (
  consent_version text NOT NULL,
  purpose text NOT NULL,
  text_ar text NOT NULL,
  text_en text NOT NULL,
  sha256_ar text NOT NULL,
  sha256_en text NOT NULL,
  is_current boolean NOT NULL,
  introduced_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT consent_texts_pk PRIMARY KEY (consent_version),
  CONSTRAINT consent_texts_purpose_check
    CHECK (purpose IN ('MATCHING_PARTICIPATION', 'MATCHING_CONTEXT_GRANT', 'PRE_MATCH_DISCLOSURE_AUTHORITY')),
  CONSTRAINT consent_texts_version_check CHECK (consent_version ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  CONSTRAINT consent_texts_text_check CHECK (length(btrim(text_ar)) > 0 AND length(btrim(text_en)) > 0),
  CONSTRAINT consent_texts_digest_check CHECK (
    sha256_ar = encode(sha256(convert_to(text_ar, 'UTF8')), 'hex')
    AND sha256_en = encode(sha256(convert_to(text_en, 'UTF8')), 'hex'))
);
CREATE UNIQUE INDEX consent_texts_one_current ON matching_enrollment_private.consent_texts (purpose) WHERE is_current;

-- A consent text is what a human agreed to: it is never rewritten. The only change is a current version stepping down
-- when its successor is installed; a referenced version can never be removed (enrollment_acts RESTRICT).
CREATE FUNCTION matching_enrollment_private.reject_consent_text_rewrite_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.is_current AND NOT NEW.is_current
     AND (NEW.consent_version, NEW.purpose, NEW.text_ar, NEW.text_en, NEW.sha256_ar, NEW.sha256_en, NEW.introduced_at)
         IS NOT DISTINCT FROM (OLD.consent_version, OLD.purpose, OLD.text_ar, OLD.text_en, OLD.sha256_ar, OLD.sha256_en, OLD.introduced_at) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'MATCHING_ENROLLMENT_CONSENT_TEXT_IS_IMMUTABLE' USING ERRCODE = '55000';
END$$;
CREATE TRIGGER consent_texts_immutable
  BEFORE UPDATE OR DELETE ON matching_enrollment_private.consent_texts
  FOR EACH ROW EXECUTE FUNCTION matching_enrollment_private.reject_consent_text_rewrite_v1();

-- The operator installer: one new current version of one purpose, the previous current one stepping down. Executable by
-- no application role. Re-installing an existing version is refused, so a version names exactly one text forever.
CREATE FUNCTION matching_enrollment_private.install_consent_text_v1(
  p_consent_version text, p_purpose text, p_text_ar text, p_text_en text
) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM matching_enrollment_private.consent_texts t WHERE t.purpose = p_purpose AND t.is_current FOR UPDATE;
  UPDATE matching_enrollment_private.consent_texts t SET is_current = false WHERE t.purpose = p_purpose AND t.is_current;
  INSERT INTO matching_enrollment_private.consent_texts
    (consent_version, purpose, text_ar, text_en, sha256_ar, sha256_en, is_current)
  VALUES (p_consent_version, p_purpose, p_text_ar, p_text_en,
          encode(sha256(convert_to(p_text_ar, 'UTF8')), 'hex'), encode(sha256(convert_to(p_text_en, 'UTF8')), 'hex'), true);
  RETURN p_consent_version;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. THE DURABLE EVIDENCE (CW2-06B-02 §5). Append-only; deleted only with the account (ON DELETE CASCADE).
-- ---------------------------------------------------------------------------------------------------------------------

-- The promotion record: the exact confirmed fact version a human's own act produced, and the exact reviewed draft
-- version it came from. The canonical facts reader answers only for a fact version that has one.
CREATE TABLE matching_enrollment_private.fact_promotions (
  fact_version_id uuid NOT NULL,
  user_id uuid NOT NULL,
  enrollment_command_id uuid NOT NULL,
  draft_version bigint NOT NULL,
  promoted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT fact_promotions_pk PRIMARY KEY (fact_version_id),
  CONSTRAINT fact_promotions_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT fact_promotions_draft_version_check CHECK (draft_version >= 1)
);
CREATE INDEX fact_promotions_user_idx ON matching_enrollment_private.fact_promotions (user_id);

-- Every committed act of the boundary, bound to the exact consent version of each consent it exercised and to the exact
-- I-07 events and versions it left current. A consent version is recorded exactly when its event is.
CREATE TABLE matching_enrollment_private.enrollment_acts (
  command_id uuid NOT NULL,
  user_id uuid NOT NULL,
  act_kind text NOT NULL,
  draft_version bigint,
  fact_version_id uuid,
  participation_event_id uuid,
  participation_consent_version text,
  context_consent_event_id uuid,
  context_consent_version text,
  authority_event_id uuid,
  disclosure_consent_version text,
  profile_version_id uuid,
  requirement_version_id uuid,
  committed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT enrollment_acts_pk PRIMARY KEY (command_id),
  CONSTRAINT enrollment_acts_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT enrollment_acts_participation_consent_fk FOREIGN KEY (participation_consent_version)
    REFERENCES matching_enrollment_private.consent_texts (consent_version) ON DELETE RESTRICT,
  CONSTRAINT enrollment_acts_context_consent_fk FOREIGN KEY (context_consent_version)
    REFERENCES matching_enrollment_private.consent_texts (consent_version) ON DELETE RESTRICT,
  CONSTRAINT enrollment_acts_disclosure_consent_fk FOREIGN KEY (disclosure_consent_version)
    REFERENCES matching_enrollment_private.consent_texts (consent_version) ON DELETE RESTRICT,
  CONSTRAINT enrollment_acts_kind_check CHECK (act_kind IN ('ENROLL', 'CORRECTION', 'RESUME', 'RECONFIRM_CONSENT')),
  CONSTRAINT enrollment_acts_consent_pairing_check CHECK (
        (participation_event_id IS NULL) = (participation_consent_version IS NULL)
    AND (context_consent_event_id IS NULL) = (context_consent_version IS NULL)
    AND (authority_event_id IS NULL) = (disclosure_consent_version IS NULL)),
  CONSTRAINT enrollment_acts_shape_check CHECK (
       (act_kind = 'ENROLL' AND draft_version >= 1 AND fact_version_id IS NOT NULL AND participation_event_id IS NOT NULL
        AND context_consent_event_id IS NOT NULL AND authority_event_id IS NOT NULL
        AND profile_version_id IS NOT NULL AND requirement_version_id IS NOT NULL)
    OR (act_kind = 'CORRECTION' AND draft_version >= 1 AND fact_version_id IS NOT NULL AND participation_event_id IS NULL
        AND context_consent_event_id IS NULL AND profile_version_id IS NOT NULL AND requirement_version_id IS NOT NULL)
    OR (act_kind = 'RESUME' AND draft_version IS NULL AND fact_version_id IS NULL AND participation_event_id IS NOT NULL
        AND context_consent_event_id IS NULL AND authority_event_id IS NULL)
    OR (act_kind = 'RECONFIRM_CONSENT' AND draft_version IS NULL AND fact_version_id IS NULL AND participation_event_id IS NULL
        AND (context_consent_event_id IS NOT NULL OR authority_event_id IS NOT NULL)))
);
CREATE INDEX enrollment_acts_user_idx ON matching_enrollment_private.enrollment_acts (user_id, committed_at);

CREATE TABLE matching_enrollment_private.command_ledger (
  user_id uuid NOT NULL,
  command_id uuid NOT NULL,
  act_kind text NOT NULL,
  fingerprint text NOT NULL,
  outcome text NOT NULL,
  participation_state text NOT NULL,
  matchable boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT command_ledger_pk PRIMARY KEY (user_id, command_id),
  CONSTRAINT command_ledger_user_fk FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT command_ledger_kind_check CHECK (act_kind IN ('ENROLL', 'CORRECTION', 'RESUME', 'RECONFIRM_CONSENT')),
  CONSTRAINT command_ledger_fingerprint_check CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT command_ledger_outcome_check CHECK (outcome IN ('ENROLLED', 'CORRECTED', 'RESUMED', 'RECONFIRMED')),
  CONSTRAINT command_ledger_state_check CHECK (participation_state IN ('OFF', 'ACTIVE', 'PAUSED'))
);

-- Evidence is never rewritten. A DELETE is left to the owner-only cascade from the account row (no application role holds
-- any privilege here), so the governed erasure is never refused by these relations.
CREATE FUNCTION matching_enrollment_private.reject_evidence_rewrite_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'MATCHING_ENROLLMENT_EVIDENCE_IS_IMMUTABLE' USING ERRCODE = '55000';
END$$;
CREATE TRIGGER fact_promotions_immutable BEFORE UPDATE ON matching_enrollment_private.fact_promotions
  FOR EACH ROW EXECUTE FUNCTION matching_enrollment_private.reject_evidence_rewrite_v1();
CREATE TRIGGER enrollment_acts_immutable BEFORE UPDATE ON matching_enrollment_private.enrollment_acts
  FOR EACH ROW EXECUTE FUNCTION matching_enrollment_private.reject_evidence_rewrite_v1();
CREATE TRIGGER command_ledger_immutable BEFORE UPDATE ON matching_enrollment_private.command_ledger
  FOR EACH ROW EXECUTE FUNCTION matching_enrollment_private.reject_evidence_rewrite_v1();

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. HELPERS: three pure ones (IMMUTABLE; no relation, no identity of their own) and the boundary's lock entry.
-- ---------------------------------------------------------------------------------------------------------------------

-- id(slot) = uuid(sha256('QANDEEL_S6_07_ENROLLMENT_IDENTITY_V1' \n slot \n human \n command)), with the version and
-- variant nibbles set exactly as 0155 / 0159 set them.
CREATE FUNCTION matching_enrollment_private.derive_identity_v1(p_slot text, p_user uuid, p_command_id uuid)
RETURNS uuid
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT (substr(d.h, 1, 12) || '4' || substr(d.h, 14, 3) || '8' || substr(d.h, 18, 3) || substr(d.h, 21, 12))::uuid
    FROM (SELECT encode(sha256(convert_to('QANDEEL_S6_07_ENROLLMENT_IDENTITY_V1' || E'\n' || p_slot || E'\n'
                   || lower(p_user::text) || E'\n' || lower(p_command_id::text), 'UTF8')), 'hex') AS h) d
$$;

CREATE FUNCTION matching_enrollment_private.fingerprint_v1(
  p_kind text, p_draft_version bigint, p_participation text, p_context text, p_disclosure text)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT encode(sha256(convert_to(p_kind || '|' || coalesce(p_draft_version::text, '-') || '|' || coalesce(p_participation, '-')
    || '|' || coalesce(p_context, '-') || '|' || coalesce(p_disclosure, '-'), 'UTF8')), 'hex')
$$;

-- The CW2-06B-03 encoding v1 of one reviewed draft's requirement items (0154 canonical form), hard then soft. Values are
-- re-sorted in byte order, as the strict decoders require. Nothing is added: no item, no sentinel.
CREATE FUNCTION matching_enrollment_private.encode_requirement_items_v1(p_hard jsonb, p_soft jsonb)
RETURNS TABLE (requirement_key text, requirement_strength text, requirement_value text)
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE i.item ->> 'dimension' WHEN 'AGE_RANGE' THEN 'age_range' WHEN 'MARITAL_STATUS' THEN 'marital_status' ELSE 'area' END
           || CASE WHEN i.strength = 'SOFT_PREFERENCE' THEN '_preference' ELSE '' END || '_v1',
         i.strength,
         CASE i.item ->> 'dimension'
           WHEN 'AGE_RANGE' THEN 'min=' || (i.item ->> 'min') || ';max=' || (i.item ->> 'max')
           WHEN 'MARITAL_STATUS' THEN 'accepted=' || (SELECT string_agg(m, ',' ORDER BY m COLLATE "C")
                                                       FROM jsonb_array_elements_text(i.item -> 'accepted') AS m)
           ELSE 'country=' || (i.item ->> 'countryCode')
                || CASE WHEN i.item ? 'regionCodes'
                        THEN ';regions=' || (SELECT string_agg(r, ',' ORDER BY r COLLATE "C")
                                               FROM jsonb_array_elements_text(i.item -> 'regionCodes') AS r)
                        ELSE '' END
         END
    FROM (SELECT h AS item, 'HARD_DEALBREAKER'::text AS strength FROM jsonb_array_elements(p_hard) AS h
          UNION ALL
          SELECT s, 'SOFT_PREFERENCE' FROM jsonb_array_elements(p_soft) AS s) i
$$;

-- The caller's own Matching serialization row, taken FIRST by the boundary with the frozen 0109 upsert-and-lock statement,
-- so every later read of the setup state is the state the act applies to. Executable by no role (like the S6-04 entry
-- helper, it is reached only through the one named boundary).
CREATE FUNCTION matching_enrollment_private.enter_own_setup_v1(p_user uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (p_user)
  ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. THE TWO INTERNAL CORES. Executable by NO role; the boundary is their only caller. Each takes the owner's own Matching
--    serialization row first and repeats the frozen I-07A durability law: the command id IS the identity it commits, an
--    equivalent retry answers the committed row, a different request under a reused id is 23505, and any other current
--    state than the one expected is a bounded 40001 with nothing applied.
-- ---------------------------------------------------------------------------------------------------------------------

-- CA-10-impl (Q4'): a requirement version with ZERO items. The empty set is the reviewed draft's own answer - no
-- additional hard dealbreaker and no soft preference - represented by the absence of items, never by a sentinel.
CREATE FUNCTION public.set_empty_matching_requirements_core_v1(
  p_command_id uuid, p_owner_user_id uuid, p_expected_current_version_id uuid
) RETURNS TABLE(matching_requirement_version_id uuid, superseded_version_id uuid, requirement_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  locked uuid;
  committed public.matching_requirement_versions;
  current_id uuid;
BEGIN
  IF p_command_id IS NULL OR p_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_expected_current_version_id IS NOT NULL AND p_expected_current_version_id = p_command_id THEN
    RAISE EXCEPTION 'MATCHING_VERSION_ID_INVALID' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (p_owner_user_id)
  ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at
  RETURNING l.user_id INTO locked;

  SELECT * INTO committed FROM public.matching_requirement_versions v WHERE v.id = p_command_id;
  IF FOUND THEN
    IF committed.owner_user_id = p_owner_user_id
       AND committed.prior_requirement_version_id IS NOT DISTINCT FROM p_expected_current_version_id
       AND NOT EXISTS (SELECT 1 FROM public.matching_requirement_items i WHERE i.requirement_version_id = p_command_id) THEN
      RETURN QUERY SELECT committed.id, committed.prior_requirement_version_id, 0;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE = '23505';
  END IF;

  SELECT s.current_requirement_version_id INTO current_id
    FROM public.matching_requirement_state s WHERE s.owner_user_id = p_owner_user_id FOR UPDATE;
  IF current_id IS DISTINCT FROM p_expected_current_version_id THEN
    RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.matching_requirement_versions (id, owner_user_id, prior_requirement_version_id)
  VALUES (p_command_id, p_owner_user_id, p_expected_current_version_id);

  IF p_expected_current_version_id IS NULL THEN
    INSERT INTO public.matching_requirement_state (owner_user_id, current_requirement_version_id)
    VALUES (p_owner_user_id, p_command_id);
  ELSE
    UPDATE public.matching_requirement_state s
       SET current_requirement_version_id = p_command_id, updated_at = CURRENT_TIMESTAMP
     WHERE s.owner_user_id = p_owner_user_id AND s.current_requirement_version_id = p_expected_current_version_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE = '40001'; END IF;
  END IF;

  RETURN QUERY SELECT p_command_id, p_expected_current_version_id, 0;
END$$;

-- CA-08-impl (Q3-A): a Pre-Match Disclosure Authority over the exact current profile version that approves ZERO fields.
-- It binds the version the owner is looking at, reads the profile family read-only and in the 0109 order, revokes the
-- active authority it supersedes (RECONFIRMED, a NEW identity), and writes no field row.
CREATE FUNCTION public.grant_zero_field_pre_match_disclosure_authority_core_v1(
  p_command_id uuid, p_owner_user_id uuid, p_new_authority_id uuid, p_profile_version_id uuid,
  p_expected_active_authority_id uuid
) RETURNS TABLE(authority_event_id uuid, authority_event_type text, pre_match_disclosure_authority_id uuid,
                superseded_authority_id uuid, bound_profile_version_id uuid, approved_field_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  locked uuid;
  committed public.pre_match_disclosure_authority_events;
  committed_authority public.pre_match_disclosure_authorities;
  intended_event_type text;
  current_version_id uuid;
  current_active_id uuid;
BEGIN
  IF p_command_id IS NULL OR p_owner_user_id IS NULL OR p_new_authority_id IS NULL OR p_profile_version_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_expected_active_authority_id IS NOT NULL AND p_expected_active_authority_id = p_new_authority_id THEN
    RAISE EXCEPTION 'MATCHING_AUTHORITY_ID_INVALID' USING ERRCODE = '22023';
  END IF;
  intended_event_type := CASE WHEN p_expected_active_authority_id IS NULL THEN 'GRANTED' ELSE 'RECONFIRMED' END;

  INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (p_owner_user_id)
  ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at
  RETURNING l.user_id INTO locked;

  SELECT * INTO committed FROM public.pre_match_disclosure_authority_events e WHERE e.id = p_command_id;
  IF FOUND THEN
    SELECT * INTO committed_authority FROM public.pre_match_disclosure_authorities a
     WHERE a.id = committed.subject_authority_id;
    IF committed.grantor_user_id = p_owner_user_id AND committed.event_type = intended_event_type
       AND committed.subject_authority_id = p_new_authority_id
       AND committed.prior_authority_id IS NOT DISTINCT FROM p_expected_active_authority_id
       AND committed_authority.introduction_profile_version_id = p_profile_version_id
       AND NOT EXISTS (SELECT 1 FROM public.pre_match_disclosure_authority_fields f
                        WHERE f.authority_id = committed.subject_authority_id) THEN
      RETURN QUERY SELECT committed.id, committed.event_type, committed.subject_authority_id,
                          committed.prior_authority_id, committed_authority.introduction_profile_version_id, 0;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_COMMAND_ID_CONFLICT' USING ERRCODE = '23505';
  END IF;

  -- SECOND FAMILY, READ ONLY, IN THE 0109 ORDER: the owner's current profile version, then the exact version row.
  SELECT s.current_profile_version_id INTO current_version_id
    FROM public.introduction_profile_state s WHERE s.owner_user_id = p_owner_user_id FOR SHARE;
  IF current_version_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_PROFILE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF current_version_id IS DISTINCT FROM p_profile_version_id THEN
    RAISE EXCEPTION 'MATCHING_PROFILE_VERSION_NOT_CURRENT' USING ERRCODE = '40001';
  END IF;
  PERFORM 1 FROM public.introduction_profile_versions v
   WHERE v.id = p_profile_version_id AND v.owner_user_id = p_owner_user_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_PROFILE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  SELECT a.id INTO current_active_id FROM public.pre_match_disclosure_authorities a
   WHERE a.grantor_user_id = p_owner_user_id AND a.status = 'ACTIVE' FOR UPDATE;
  IF current_active_id IS DISTINCT FROM p_expected_active_authority_id THEN
    RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE = '40001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pre_match_disclosure_authorities a WHERE a.id = p_new_authority_id) THEN
    RAISE EXCEPTION 'MATCHING_AUTHORITY_ID_CONFLICT' USING ERRCODE = '23505';
  END IF;

  IF p_expected_active_authority_id IS NOT NULL THEN
    UPDATE public.pre_match_disclosure_authorities a
       SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP
     WHERE a.id = p_expected_active_authority_id AND a.status = 'ACTIVE';
    IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_STALE_STATE' USING ERRCODE = '40001'; END IF;
  END IF;
  INSERT INTO public.pre_match_disclosure_authorities
    (id, grantor_user_id, introduction_profile_version_id, status)
  VALUES (p_new_authority_id, p_owner_user_id, p_profile_version_id, 'ACTIVE');
  INSERT INTO public.pre_match_disclosure_authority_events
    (id, grantor_user_id, event_type, subject_authority_id, prior_authority_id)
  VALUES (p_command_id, p_owner_user_id, intended_event_type, p_new_authority_id, p_expected_active_authority_id);

  RETURN QUERY SELECT p_command_id, intended_event_type, p_new_authority_id,
                      p_expected_active_authority_id, p_profile_version_id, 0;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. THE CANONICAL FACTS READER, now requiring the promotion record (CW2-06B-02 §5; CA-R5-impl). Same signature, same
--    result, same posture; one added join. A current version without a promotion record answers the empty row, exactly
--    as no version at all does, so it is UNKNOWN to discovery, to the pair rule at capture and to snapshot currentness.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_matching_confirmed_facts_v1(p_user_id uuid)
RETURNS TABLE (fact_version_id uuid, first_name text, sex text, birth_year integer, birth_month integer,
               country_code text, region_code text, marital_status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  current_version public.matching_confirmed_fact_versions;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_SUBJECT_REQUIRED' USING ERRCODE='22023';
  END IF;
  SELECT f.* INTO current_version
    FROM public.matching_confirmed_fact_state s
    JOIN public.matching_confirmed_fact_versions f
      ON f.id = s.current_fact_version_id AND f.owner_user_id = s.owner_user_id
    JOIN matching_enrollment_private.fact_promotions p
      ON p.fact_version_id = f.id AND p.user_id = f.owner_user_id
   WHERE s.owner_user_id = p_user_id;
  RETURN QUERY SELECT current_version.id, current_version.first_name, current_version.sex,
                      current_version.birth_year::integer, current_version.birth_month::integer,
                      current_version.country_code, current_version.region_code, current_version.marital_status;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. THE ONE GOVERNED ENROLLMENT BOUNDARY (CA-01-impl, CA-R5-impl; Q1, Q8(A)).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.enroll_my_matching_setup_v1(
  p_command_id uuid, p_kind text, p_expected_draft_version bigint,
  p_participation_consent_version text, p_context_consent_version text, p_disclosure_consent_version text
) RETURNS TABLE(outcome text, participation_state text, matchable boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  u uuid := auth.uid();
  v_fingerprint text;
  v_ledger matching_enrollment_private.command_ledger;
  v_refusal text;
  v_draft introductions_preparation_private.drafts;
  v_facts introductions_preparation_private.declared_facts;
  v_setup record;
  v_last matching_enrollment_private.enrollment_acts;
  v_current_fact public.matching_confirmed_fact_versions;
  v_promoted boolean;
  v_fact uuid;
  v_profile_keys text[];
  v_profile_values text[];
  v_req_keys text[];
  v_req_strengths text[];
  v_req_values text[];
  v_profile uuid;
  v_requirements uuid;
  v_profile_moved boolean := false;
  v_requirements_moved boolean := false;
  v_fact_moved boolean := false;
  v_authority_bound uuid;
  v_participation_event uuid;
  v_context_event uuid;
  v_authority_event uuid;
  v_participation_version text;
  v_context_version text;
  v_disclosure_version text;
  v_outcome text;
  v_after record;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  -- Each act carries exactly what it exercises: the draft version only when it promotes the draft, and each consent
  -- only when its consent event is part of the act. Anything else is not a request.
  IF p_command_id IS NULL OR p_kind IS NULL OR p_kind NOT IN ('ENROLL', 'CORRECTION', 'RESUME', 'RECONFIRM_CONSENT')
     OR (p_expected_draft_version IS NULL) <> (p_kind IN ('RESUME', 'RECONFIRM_CONSENT'))
     OR coalesce(p_expected_draft_version, 1) < 1
     OR (p_kind = 'ENROLL' AND (p_participation_consent_version IS NULL OR p_context_consent_version IS NULL
                                OR p_disclosure_consent_version IS NULL))
     OR (p_kind = 'CORRECTION' AND (p_participation_consent_version IS NOT NULL OR p_context_consent_version IS NOT NULL))
     OR (p_kind = 'RESUME' AND (p_participation_consent_version IS NULL OR p_context_consent_version IS NOT NULL
                                OR p_disclosure_consent_version IS NOT NULL))
     OR (p_kind = 'RECONFIRM_CONSENT' AND (p_participation_consent_version IS NOT NULL
                                           OR (p_context_consent_version IS NULL AND p_disclosure_consent_version IS NULL))) THEN
    RAISE EXCEPTION 'MATCHING_ENROLLMENT_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;

  -- Lock order 1: the account row. A deletion request (FOR UPDATE) waits for this act, or this act sees it.
  PERFORM 1 FROM public.users x WHERE x.id = u FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;

  -- 2. A committed command answers its first result, whatever has changed since.
  v_fingerprint := matching_enrollment_private.fingerprint_v1(p_kind, p_expected_draft_version,
    p_participation_consent_version, p_context_consent_version, p_disclosure_consent_version);
  SELECT * INTO v_ledger FROM matching_enrollment_private.command_ledger l
   WHERE l.user_id = u AND l.command_id = p_command_id;
  IF FOUND THEN
    IF v_ledger.fingerprint = v_fingerprint THEN
      RETURN QUERY SELECT v_ledger.outcome, v_ledger.participation_state, v_ledger.matchable;
    ELSE
      RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::text, NULL::boolean;
    END IF;
    RETURN;
  END IF;

  -- 3. No enrollment act while the account is being deleted; nothing is locked or written.
  IF EXISTS (SELECT 1 FROM personal_data_private.account_deletions d
              WHERE d.user_id = u AND d.status IN ('SCHEDULED', 'BLOCKED', 'ERASED', 'COMPLETED')) THEN
    RETURN QUERY SELECT 'DELETION_PENDING'::text, NULL::text, NULL::boolean;
    RETURN;
  END IF;

  -- 4. The closed-by-default operator gate.
  IF matching_enrollment_private.bind_gate_v1() <> 'ALLOW' THEN
    RETURN QUERY SELECT 'NOT_AVAILABLE_NOW'::text, NULL::text, NULL::boolean;
    RETURN;
  END IF;

  -- 5. ONE block, all or nothing. A refusal raises the private QS001 and the block's own rollback undoes everything it
  --    touched, the lock row included.
  BEGIN
    PERFORM matching_enrollment_private.enter_own_setup_v1(u);

    -- The same command id may have committed while this act waited for the lock.
    SELECT * INTO v_ledger FROM matching_enrollment_private.command_ledger l
     WHERE l.user_id = u AND l.command_id = p_command_id;
    IF FOUND THEN
      v_refusal := CASE WHEN v_ledger.fingerprint = v_fingerprint THEN 'REPLAY' ELSE 'COMMAND_CONFLICT' END;
      RAISE EXCEPTION 'MATCHING_ENROLLMENT_REFUSED' USING ERRCODE = 'QS001';
    END IF;

    SELECT * INTO v_setup FROM public.resolve_matching_setup_state_v1(u);
    SELECT * INTO v_last FROM matching_enrollment_private.enrollment_acts a
     WHERE a.user_id = u ORDER BY a.committed_at DESC, a.command_id DESC LIMIT 1;

    -- The act's own precondition on participation.
    IF p_kind = 'ENROLL' AND v_setup.participation_state <> 'OFF' THEN
      v_refusal := 'ALREADY_ENROLLED';
    ELSIF p_kind <> 'ENROLL' AND (v_last.command_id IS NULL OR v_setup.participation_state = 'OFF') THEN
      v_refusal := 'NOT_ENROLLED';
    ELSIF p_kind = 'RESUME' AND (v_setup.participation_state <> 'PAUSED' OR v_setup.pause_reason <> 'USER_PAUSED') THEN
      v_refusal := 'NOT_RESUMABLE';
    END IF;
    IF v_refusal IS NOT NULL THEN RAISE EXCEPTION 'MATCHING_ENROLLMENT_REFUSED' USING ERRCODE = 'QS001'; END IF;

    -- Every supplied consent version is the CURRENT text of its purpose, held FOR SHARE so a new version waits.
    IF p_participation_consent_version IS NOT NULL THEN
      SELECT t.consent_version INTO v_participation_version FROM matching_enrollment_private.consent_texts t
       WHERE t.consent_version = p_participation_consent_version AND t.purpose = 'MATCHING_PARTICIPATION' AND t.is_current
         FOR SHARE;
      IF NOT FOUND THEN v_refusal := 'CONSENT_OUTDATED'; END IF;
    END IF;
    IF p_context_consent_version IS NOT NULL THEN
      SELECT t.consent_version INTO v_context_version FROM matching_enrollment_private.consent_texts t
       WHERE t.consent_version = p_context_consent_version AND t.purpose = 'MATCHING_CONTEXT_GRANT' AND t.is_current
         FOR SHARE;
      IF NOT FOUND THEN v_refusal := 'CONSENT_OUTDATED'; END IF;
    END IF;
    IF p_disclosure_consent_version IS NOT NULL THEN
      SELECT t.consent_version INTO v_disclosure_version FROM matching_enrollment_private.consent_texts t
       WHERE t.consent_version = p_disclosure_consent_version AND t.purpose = 'PRE_MATCH_DISCLOSURE_AUTHORITY' AND t.is_current
         FOR SHARE;
      IF NOT FOUND THEN v_refusal := 'CONSENT_OUTDATED'; END IF;
    END IF;
    IF v_refusal IS NOT NULL THEN RAISE EXCEPTION 'MATCHING_ENROLLMENT_REFUSED' USING ERRCODE = 'QS001'; END IF;

    v_profile := v_setup.introduction_profile_version_id;
    v_requirements := v_setup.matching_requirement_version_id;

    IF p_kind IN ('ENROLL', 'CORRECTION') THEN
      -- The exact reviewed draft, held FOR SHARE: a preparation command waits for this act.
      SELECT * INTO v_draft FROM introductions_preparation_private.drafts d WHERE d.user_id = u FOR SHARE;
      IF NOT FOUND OR v_draft.draft_version <> p_expected_draft_version THEN
        v_refusal := 'CHANGED';
        RAISE EXCEPTION 'MATCHING_ENROLLMENT_REFUSED' USING ERRCODE = 'QS001';
      END IF;
      SELECT * INTO v_facts FROM introductions_preparation_private.declared_facts f WHERE f.user_id = u FOR SHARE;
      SELECT coalesce(array_agg(p.k ORDER BY p.k), '{}'), coalesce(array_agg(p.v ORDER BY p.k), '{}')
        INTO v_profile_keys, v_profile_values
        FROM (VALUES ('short_introduction', v_draft.short_introduction), ('work_field', v_draft.work_field)) AS p(k, v)
       WHERE p.v IS NOT NULL;
      IF v_draft.reviewed_version IS DISTINCT FROM v_draft.draft_version
         OR v_facts.first_name_state IS DISTINCT FROM 'CONFIRMED' OR v_facts.sex_state IS DISTINCT FROM 'CONFIRMED'
         OR v_facts.birth_state IS DISTINCT FROM 'CONFIRMED' OR v_facts.area_state IS DISTINCT FROM 'CONFIRMED'
         OR v_facts.marital_state IS DISTINCT FROM 'CONFIRMED'
         OR v_draft.hard_answer IS NULL OR v_draft.soft_answer IS NULL
         -- The frozen profile command refuses an empty field set and the authority binds a profile version; a draft
         -- with neither optional field is not promoted (no field is invented). Product decision recorded in §50.
         OR cardinality(v_profile_keys) = 0 THEN
        v_refusal := 'INCOMPLETE';
        RAISE EXCEPTION 'MATCHING_ENROLLMENT_REFUSED' USING ERRCODE = 'QS001';
      END IF;

      -- Facts: a NEW promoted version unless the current one already carries a promotion record with these exact values.
      SELECT f.* INTO v_current_fact FROM public.matching_confirmed_fact_state s
        JOIN public.matching_confirmed_fact_versions f ON f.id = s.current_fact_version_id
       WHERE s.owner_user_id = u;
      v_promoted := v_current_fact.id IS NOT NULL AND EXISTS (
        SELECT 1 FROM matching_enrollment_private.fact_promotions p WHERE p.fact_version_id = v_current_fact.id);
      IF v_promoted
         AND (v_current_fact.first_name, v_current_fact.first_name_confirmed_at, v_current_fact.sex, v_current_fact.sex_confirmed_at,
              v_current_fact.birth_year, v_current_fact.birth_month, v_current_fact.birth_confirmed_at,
              v_current_fact.country_code, v_current_fact.region_code, v_current_fact.area_confirmed_at,
              v_current_fact.marital_status, v_current_fact.marital_confirmed_at)
             IS NOT DISTINCT FROM
             (v_facts.first_name, v_facts.first_name_confirmed_at, v_facts.sex, v_facts.sex_confirmed_at,
              v_facts.birth_year, v_facts.birth_month, v_facts.birth_confirmed_at,
              v_facts.country_code, v_facts.region_code, v_facts.area_confirmed_at,
              v_facts.marital_status, v_facts.marital_confirmed_at) THEN
        v_fact := v_current_fact.id;
      ELSE
        v_fact := matching_enrollment_private.derive_identity_v1('FACT_VERSION', u, p_command_id);
        PERFORM 1 FROM public.record_matching_confirmed_facts_core_v1(
          v_fact, u, v_current_fact.id,
          v_facts.first_name, v_facts.first_name_confirmed_at, v_facts.sex, v_facts.sex_confirmed_at,
          v_facts.birth_year, v_facts.birth_month, v_facts.birth_confirmed_at,
          v_facts.country_code, v_facts.region_code, v_facts.area_confirmed_at,
          v_facts.marital_status, v_facts.marital_confirmed_at);
        INSERT INTO matching_enrollment_private.fact_promotions (fact_version_id, user_id, enrollment_command_id, draft_version)
        VALUES (v_fact, u, p_command_id, v_draft.draft_version);
        v_fact_moved := true;
      END IF;

      -- Profile: a new version only when the field set differs from the current one.
      IF v_profile IS NULL OR (SELECT coalesce(array_agg(f.field_key || '=' || f.field_value ORDER BY f.field_key), '{}')
                                 FROM public.introduction_profile_field_values f WHERE f.profile_version_id = v_profile)
                              IS DISTINCT FROM (SELECT coalesce(array_agg(p.k || '=' || p.v ORDER BY p.k), '{}')
                                                  FROM unnest(v_profile_keys, v_profile_values) AS p(k, v)) THEN
        SELECT r.introduction_profile_version_id INTO v_profile FROM public.set_introduction_profile_v1(
          matching_enrollment_private.derive_identity_v1('PROFILE_VERSION', u, p_command_id),
          v_profile_keys, v_profile_values, v_setup.introduction_profile_version_id) r;
        v_profile_moved := true;
      END IF;

      -- Requirements: the CW2-06B-03 items of the reviewed draft, or an empty version when it has none (CA-10-impl).
      SELECT coalesce(array_agg(e.requirement_key ORDER BY e.requirement_key), '{}'),
             coalesce(array_agg(e.requirement_strength ORDER BY e.requirement_key), '{}'),
             coalesce(array_agg(e.requirement_value ORDER BY e.requirement_key), '{}')
        INTO v_req_keys, v_req_strengths, v_req_values
        FROM matching_enrollment_private.encode_requirement_items_v1(v_draft.hard_items, v_draft.soft_items) e;
      IF v_requirements IS NULL
         OR (SELECT coalesce(array_agg(i.requirement_key || '|' || i.requirement_strength || '|' || i.requirement_value
                                       ORDER BY i.requirement_key), '{}')
               FROM public.matching_requirement_items i WHERE i.requirement_version_id = v_requirements)
            IS DISTINCT FROM (SELECT coalesce(array_agg(r.k || '|' || r.s || '|' || r.v ORDER BY r.k), '{}')
                                FROM unnest(v_req_keys, v_req_strengths, v_req_values) AS r(k, s, v)) THEN
        IF cardinality(v_req_keys) = 0 THEN
          SELECT r.matching_requirement_version_id INTO v_requirements FROM public.set_empty_matching_requirements_core_v1(
            matching_enrollment_private.derive_identity_v1('REQUIREMENT_VERSION', u, p_command_id), u,
            v_setup.matching_requirement_version_id) r;
        ELSE
          SELECT r.matching_requirement_version_id INTO v_requirements FROM public.set_matching_requirements_v1(
            matching_enrollment_private.derive_identity_v1('REQUIREMENT_VERSION', u, p_command_id),
            v_req_keys, v_req_strengths, v_req_values, v_setup.matching_requirement_version_id) r;
        END IF;
        v_requirements_moved := true;
      END IF;

      IF p_kind = 'CORRECTION' AND NOT (v_fact_moved OR v_profile_moved OR v_requirements_moved) THEN
        v_refusal := 'NO_CHANGE';
        RAISE EXCEPTION 'MATCHING_ENROLLMENT_REFUSED' USING ERRCODE = 'QS001';
      END IF;
    END IF;

    -- Participation: the act fixed by the function's identity, never spelled by the caller.
    IF p_kind = 'ENROLL' THEN
      SELECT r.participation_event_id INTO v_participation_event FROM public.activate_matching_participation_v1(
        matching_enrollment_private.derive_identity_v1('PARTICIPATION_EVENT', u, p_command_id),
        'MANUAL_MY_WORLD_ENTRY', v_setup.participation_event_id) r;
    ELSIF p_kind = 'RESUME' THEN
      SELECT r.participation_event_id INTO v_participation_event FROM public.resume_matching_participation_v1(
        matching_enrollment_private.derive_identity_v1('PARTICIPATION_EVENT', u, p_command_id),
        v_setup.participation_event_id) r;
    END IF;

    -- The Matching Context Grant: its own consent event (GRANTED, or RECONFIRMED over the active grant).
    IF p_kind = 'ENROLL' OR (p_kind = 'RECONFIRM_CONSENT' AND p_context_consent_version IS NOT NULL) THEN
      SELECT r.consent_event_id INTO v_context_event FROM public.grant_matching_context_v1(
        matching_enrollment_private.derive_identity_v1('CONTEXT_CONSENT_EVENT', u, p_command_id),
        matching_enrollment_private.derive_identity_v1('CONTEXT_GRANT', u, p_command_id),
        v_setup.matching_context_grant_id) r;
    END IF;

    -- The zero-field disclosure authority. A correction moves only an ACTIVE authority whose basis moved, and only with a
    -- fresh disclosure consent; it never re-grants a revoked one.
    SELECT a.introduction_profile_version_id INTO v_authority_bound FROM public.pre_match_disclosure_authorities a
     WHERE a.grantor_user_id = u AND a.status = 'ACTIVE';
    IF p_kind = 'CORRECTION' AND v_setup.pre_match_disclosure_authority_id IS NOT NULL
       AND v_authority_bound IS DISTINCT FROM v_profile AND p_disclosure_consent_version IS NULL THEN
      v_refusal := 'CONSENT_OUTDATED';
      RAISE EXCEPTION 'MATCHING_ENROLLMENT_REFUSED' USING ERRCODE = 'QS001';
    END IF;
    IF p_kind = 'ENROLL' OR (p_kind = 'RECONFIRM_CONSENT' AND p_disclosure_consent_version IS NOT NULL)
       OR (p_kind = 'CORRECTION' AND v_setup.pre_match_disclosure_authority_id IS NOT NULL
           AND v_authority_bound IS DISTINCT FROM v_profile) THEN
      SELECT r.authority_event_id INTO v_authority_event FROM public.grant_zero_field_pre_match_disclosure_authority_core_v1(
        matching_enrollment_private.derive_identity_v1('AUTHORITY_EVENT', u, p_command_id), u,
        matching_enrollment_private.derive_identity_v1('AUTHORITY', u, p_command_id),
        v_profile, v_setup.pre_match_disclosure_authority_id) r;
    END IF;

    SELECT * INTO v_after FROM public.resolve_matching_setup_state_v1(u);
    v_outcome := CASE p_kind WHEN 'ENROLL' THEN 'ENROLLED' WHEN 'CORRECTION' THEN 'CORRECTED'
                             WHEN 'RESUME' THEN 'RESUMED' ELSE 'RECONFIRMED' END;
    INSERT INTO matching_enrollment_private.enrollment_acts
      (command_id, user_id, act_kind, draft_version, fact_version_id,
       participation_event_id, participation_consent_version, context_consent_event_id, context_consent_version,
       authority_event_id, disclosure_consent_version, profile_version_id, requirement_version_id)
    VALUES (p_command_id, u, p_kind, CASE WHEN p_kind IN ('ENROLL', 'CORRECTION') THEN v_draft.draft_version END,
            CASE WHEN p_kind IN ('ENROLL', 'CORRECTION') THEN v_fact END,
            v_participation_event, CASE WHEN v_participation_event IS NOT NULL THEN v_participation_version END,
            v_context_event, CASE WHEN v_context_event IS NOT NULL THEN v_context_version END,
            v_authority_event, CASE WHEN v_authority_event IS NOT NULL THEN v_disclosure_version END,
            CASE WHEN p_kind IN ('ENROLL', 'CORRECTION') THEN v_profile END,
            CASE WHEN p_kind IN ('ENROLL', 'CORRECTION') THEN v_requirements END);
    INSERT INTO matching_enrollment_private.command_ledger
      (user_id, command_id, act_kind, fingerprint, outcome, participation_state, matchable)
    VALUES (u, p_command_id, p_kind, v_fingerprint, v_outcome, v_after.participation_state, v_after.matchable);
  EXCEPTION
    WHEN SQLSTATE 'QS001' THEN
      IF v_refusal = 'REPLAY' THEN
        RETURN QUERY SELECT v_ledger.outcome, v_ledger.participation_state, v_ledger.matchable;
      ELSE
        RETURN QUERY SELECT v_refusal, NULL::text, NULL::boolean;
      END IF;
      RETURN;
    WHEN SQLSTATE '40001' OR SQLSTATE 'PT409' THEN
      -- A stale state underneath the act: nothing was applied; read again.
      RETURN QUERY SELECT 'CHANGED'::text, NULL::text, NULL::boolean;
      RETURN;
    WHEN object_not_in_prerequisite_state THEN
      -- A pause this act may not lift, or an OFF reached from one (the frozen activation's own refusal).
      RETURN QUERY SELECT 'NOT_RESUMABLE'::text, NULL::text, NULL::boolean;
      RETURN;
    WHEN invalid_parameter_value THEN
      -- A draft value the frozen writers refuse (the 0156 privacy floor on the first name, a shape): not promoted.
      RETURN QUERY SELECT 'INCOMPLETE'::text, NULL::text, NULL::boolean;
      RETURN;
    WHEN unique_violation THEN
      RETURN QUERY SELECT 'COMMAND_CONFLICT'::text, NULL::text, NULL::boolean;
      RETURN;
  END;
  RETURN QUERY SELECT v_outcome, v_after.participation_state, v_after.matchable;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. THE OWNER'S READ: availability, the current consent texts, and the owner's own setup and enrollment.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.read_my_matching_enrollment_v1()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  u uuid := auth.uid();
  v_setup record;
  v_last_promotion matching_enrollment_private.enrollment_acts;
  v_last matching_enrollment_private.enrollment_acts;
  v_texts jsonb;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'MATCHING_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_setup FROM public.resolve_matching_setup_state_v1(u);
  SELECT * INTO v_last FROM matching_enrollment_private.enrollment_acts a
   WHERE a.user_id = u ORDER BY a.committed_at DESC, a.command_id DESC LIMIT 1;
  SELECT * INTO v_last_promotion FROM matching_enrollment_private.enrollment_acts a
   WHERE a.user_id = u AND a.act_kind IN ('ENROLL', 'CORRECTION') ORDER BY a.committed_at DESC, a.command_id DESC LIMIT 1;
  SELECT jsonb_object_agg(CASE t.purpose WHEN 'MATCHING_PARTICIPATION' THEN 'participation'
                                         WHEN 'MATCHING_CONTEXT_GRANT' THEN 'contextGrant'
                                         ELSE 'disclosureAuthority' END,
                          jsonb_build_object('version', t.consent_version, 'textAr', t.text_ar, 'textEn', t.text_en))
    INTO v_texts FROM matching_enrollment_private.consent_texts t WHERE t.is_current;
  v_texts := coalesce(v_texts, '{}'::jsonb);
  RETURN jsonb_build_object(
    'available', matching_enrollment_private.gate_open_v1()
                 AND v_texts ? 'participation' AND v_texts ? 'contextGrant' AND v_texts ? 'disclosureAuthority',
    'accountDeletionPending', EXISTS (SELECT 1 FROM personal_data_private.account_deletions d
                                       WHERE d.user_id = u AND d.status IN ('SCHEDULED', 'BLOCKED', 'ERASED', 'COMPLETED')),
    'consents', jsonb_build_object('participation', v_texts -> 'participation', 'contextGrant', v_texts -> 'contextGrant',
                                   'disclosureAuthority', v_texts -> 'disclosureAuthority'),
    'setup', jsonb_build_object('participationState', v_setup.participation_state, 'pauseReason', v_setup.pause_reason,
                                'contextGrant', v_setup.matching_context_grant_id IS NOT NULL,
                                'disclosureAuthority', v_setup.pre_match_disclosure_authority_id IS NOT NULL,
                                'matchable', v_setup.matchable),
    'enrollment', CASE WHEN v_last.command_id IS NULL THEN NULL ELSE jsonb_build_object(
      'enrolledDraftVersion', v_last_promotion.draft_version, 'lastAct', v_last.act_kind, 'lastActAt', v_last.committed_at) END);
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 9. DELETION COVERAGE (ACCT-DEL-01): every new relation that names an account cascades from the account row.
-- ---------------------------------------------------------------------------------------------------------------------
INSERT INTO account_erasure_private.coverage_registry (relation, coverage) VALUES
  ('matching_enrollment_private.command_ledger', 'ACCOUNT_CASCADE'),
  ('matching_enrollment_private.enrollment_acts', 'ACCOUNT_CASCADE'),
  ('matching_enrollment_private.fact_promotions', 'ACCOUNT_CASCADE');

-- ---------------------------------------------------------------------------------------------------------------------
-- 10. PRIVILEGES, every one explicit. CREATE OR REPLACE keeps an ACL, so the redefined reader is revoked again.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  fn text;
BEGIN
  FOR r IN SELECT c.oid::regclass AS rel FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'matching_enrollment_private' AND c.relkind IN ('r', 'p') LOOP
    EXECUTE format('ALTER TABLE %s OWNER TO postgres', r.rel);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', r.rel);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC, anon, authenticated', r.rel);
  END LOOP;
  FOR r IN SELECT c.oid::regclass AS rel FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'matching_enrollment_private' AND c.relkind = 'S' LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', r.rel);
  END LOOP;
  FOR r IN SELECT p.oid::regprocedure AS fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'matching_enrollment_private' LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', r.fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.fn);
  END LOOP;
  FOREACH fn IN ARRAY ARRAY[
    'public.set_empty_matching_requirements_core_v1(uuid,uuid,uuid)',
    'public.grant_zero_field_pre_match_disclosure_authority_core_v1(uuid,uuid,uuid,uuid,uuid)',
    'public.resolve_matching_confirmed_facts_v1(uuid)',
    'public.enroll_my_matching_setup_v1(uuid,text,bigint,text,text,text)',
    'public.read_my_matching_enrollment_v1()'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    -- No system credential acts for a human here: enrollment and its consents are the human's own act only.
    EXECUTE 'REVOKE ALL ON SCHEMA matching_enrollment_private FROM service_role';
    FOR r IN SELECT c.oid::regclass AS rel, c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'matching_enrollment_private' AND c.relkind IN ('r', 'p', 'S') LOOP
      EXECUTE format(CASE WHEN r.relkind = 'S' THEN 'REVOKE ALL ON SEQUENCE %s FROM service_role'
                          ELSE 'REVOKE ALL ON TABLE %s FROM service_role' END, r.rel);
    END LOOP;
    FOR r IN SELECT p.oid::regprocedure AS fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'matching_enrollment_private' LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', r.fn);
    END LOOP;
    FOREACH fn IN ARRAY ARRAY[
      'public.set_empty_matching_requirements_core_v1(uuid,uuid,uuid)',
      'public.grant_zero_field_pre_match_disclosure_authority_core_v1(uuid,uuid,uuid,uuid,uuid)',
      'public.resolve_matching_confirmed_facts_v1(uuid)',
      'public.enroll_my_matching_setup_v1(uuid,text,bigint,text,text,text)',
      'public.read_my_matching_enrollment_v1()'] LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', fn);
    END LOOP;
  END IF;
END$$;

GRANT EXECUTE ON FUNCTION
  public.enroll_my_matching_setup_v1(uuid, text, bigint, text, text, text),
  public.read_my_matching_enrollment_v1()
  TO authenticated;

COMMENT ON FUNCTION public.enroll_my_matching_setup_v1(uuid, text, bigint, text, text, text) IS
  'S6-07 (CA-01-impl, Q1, Q8(A)): THE ONE governed enrollment boundary. The human is auth.uid(); the act (ENROLL | '
  'CORRECTION | RESUME | RECONFIRM_CONSENT), the reviewed draft version it promotes and the exact consent version of each '
  'consent it exercises are all the caller supplies. Closed by default (ENROLLMENT gate, absent = DENY); refused during '
  'an account deletion; one transaction or nothing. authenticated only.';
COMMENT ON FUNCTION public.read_my_matching_enrollment_v1() IS
  'S6-07: the caller''s own enrollment availability, the current consent texts and their own setup state. authenticated only.';
COMMENT ON FUNCTION public.set_empty_matching_requirements_core_v1(uuid, uuid, uuid) IS
  'S6-07 (CA-10-impl, Q4''): a requirement version with zero items, under the frozen I-07A durability law. Executable by '
  'no role; the governed enrollment boundary is its only caller.';
COMMENT ON FUNCTION public.grant_zero_field_pre_match_disclosure_authority_core_v1(uuid, uuid, uuid, uuid, uuid) IS
  'S6-07 (CA-08-impl, Q3-A): a Pre-Match Disclosure Authority over the exact current profile version approving zero '
  'fields, under the frozen I-07A durability law. Executable by no role; the governed enrollment boundary is its only caller.';

-- ---------------------------------------------------------------------------------------------------------------------
-- 11. TERMINAL SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  boundary text := 'public.enroll_my_matching_setup_v1(uuid,text,bigint,text,text,text)';
  reader text := 'public.read_my_matching_enrollment_v1()';
  hidden text[] := ARRAY[
    'public.set_empty_matching_requirements_core_v1(uuid,uuid,uuid)',
    'public.grant_zero_field_pre_match_disclosure_authority_core_v1(uuid,uuid,uuid,uuid,uuid)',
    'public.resolve_matching_confirmed_facts_v1(uuid)',
    'public.record_matching_confirmed_facts_core_v1(uuid,uuid,uuid,text,timestamptz,text,timestamptz,integer,integer,timestamptz,text,text,timestamptz,text,timestamptz)',
    'public.resolve_matching_setup_state_v1(uuid)',
    'public.activate_matching_participation_v1(uuid,text,uuid)',
    'public.resume_matching_participation_v1(uuid,uuid)',
    'public.grant_matching_context_v1(uuid,uuid,uuid)',
    'public.set_introduction_profile_v1(uuid,text[],text[],uuid)',
    'public.set_matching_requirements_v1(uuid,text[],text[],text[],uuid)',
    'public.grant_pre_match_disclosure_authority_v1(uuid,uuid,uuid,text[],uuid)'];
  fn text;
  r text;
  v_bad text;
  src text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[boundary, reader] || hidden LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = fn::regprocedure AND p.prosecdef
                     AND pg_get_userbyid(p.proowner) = 'postgres'
                     AND (p.proconfig @> ARRAY['search_path=""'] OR p.proconfig @> ARRAY['search_path='])) THEN
      RAISE EXCEPTION 'S6-07: % must be postgres-owned, SECURITY DEFINER and search_path-pinned', fn;
    END IF;
    IF has_function_privilege('public', fn, 'EXECUTE') THEN RAISE EXCEPTION 'S6-07: PUBLIC must not execute %', fn; END IF;
  END LOOP;
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      FOREACH fn IN ARRAY hidden LOOP
        IF has_function_privilege(r, fn, 'EXECUTE') THEN RAISE EXCEPTION 'S6-07: % must not execute %', r, fn; END IF;
      END LOOP;
      IF has_function_privilege(r, boundary, 'EXECUTE') <> (r = 'authenticated') THEN
        RAISE EXCEPTION 'S6-07: authenticated, and only authenticated, executes %', boundary;
      END IF;
      IF has_function_privilege(r, reader, 'EXECUTE') <> (r = 'authenticated') THEN
        RAISE EXCEPTION 'S6-07: authenticated, and only authenticated, executes %', reader;
      END IF;
    END IF;
  END LOOP;
  -- No client role reads or writes a relation here, and nothing here is executable by anyone.
  SELECT string_agg(c.relname, ', ') INTO v_bad FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'matching_enrollment_private' AND c.relkind IN ('r', 'p')
     AND (has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_table_privilege('service_role', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'));
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'S6-07: an application role holds a privilege on %', v_bad; END IF;
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_bad FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'matching_enrollment_private'
     AND (has_function_privilege('authenticated', p.oid, 'EXECUTE') OR has_function_privilege('anon', p.oid, 'EXECUTE')
       OR has_function_privilege('service_role', p.oid, 'EXECUTE'));
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'S6-07: an application role can run an internal function: %', v_bad; END IF;
  -- The boundary takes no account, actor or state parameter; it absorbs 40001 naming PT409 and raises no PT409 itself.
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = boundary::regprocedure AND p.pronargs = 6
                   AND p.proargnames[1:6] = ARRAY['p_command_id', 'p_kind', 'p_expected_draft_version',
                       'p_participation_consent_version', 'p_context_consent_version', 'p_disclosure_consent_version']) THEN
    RAISE EXCEPTION 'S6-07: % takes exactly a command, an act, a draft version and three consent versions', boundary;
  END IF;
  SELECT regexp_replace(p.prosrc, '--[^\n]*', '', 'g') INTO src FROM pg_proc p WHERE p.oid = boundary::regprocedure;
  IF src !~ 'WHEN SQLSTATE ''40001'' OR SQLSTATE ''PT409'' THEN' OR src ~ 'ERRCODE = ''PT409''' OR src ~ 'ERRCODE = ''40001'''
     OR src ~* '(\mEXECUTE\s|RAISE;|ISOLATION)' THEN
    RAISE EXCEPTION 'S6-07: % absorbs 40001 / PT409, raises neither, re-raises nothing and runs no dynamic SQL', boundary;
  END IF;
  IF src !~ 'auth\.uid\(\)' THEN RAISE EXCEPTION 'S6-07: % derives its human from auth.uid()', boundary; END IF;
  -- The two cores name none of the six and take no session identity.
  FOREACH fn IN ARRAY hidden[1:2] LOOP
    SELECT p.prosrc INTO src FROM pg_proc p WHERE p.oid = fn::regprocedure;
    IF src ~ '(activate_matching_participation_v1|resume_matching_participation_v1|grant_matching_context_v1|set_introduction_profile_v1|set_matching_requirements_v1|grant_pre_match_disclosure_authority_v1|auth\.uid)' THEN
      RAISE EXCEPTION 'S6-07: % names no suspended command and reads no session identity', fn;
    END IF;
  END LOOP;
  -- Every account reference cascades; nothing outside references the schema.
  SELECT string_agg(c.conname, ', ') INTO v_bad FROM pg_constraint c
   WHERE c.contype = 'f' AND c.connamespace = 'matching_enrollment_private'::regnamespace
     AND c.confrelid = 'public.users'::regclass AND c.confdeltype <> 'c';
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'S6-07: an account reference does not cascade: %', v_bad; END IF;
  SELECT string_agg(c.conname, ', ') INTO v_bad FROM pg_constraint c
   WHERE c.contype = 'f' AND c.connamespace <> 'matching_enrollment_private'::regnamespace
     AND c.confrelid IN (SELECT x.oid FROM pg_class x WHERE x.relnamespace = 'matching_enrollment_private'::regnamespace);
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'S6-07: an outside relation references the enrollment schema: %', v_bad; END IF;
  -- Closed: no gate row and no consent text.
  IF EXISTS (SELECT 1 FROM matching_enrollment_private.gate_states)
     OR EXISTS (SELECT 1 FROM matching_enrollment_private.consent_texts) THEN
    RAISE EXCEPTION 'S6-07: the enrollment gate or a consent text is configured';
  END IF;
END$$;

COMMIT;
