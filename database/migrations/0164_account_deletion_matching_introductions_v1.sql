-- ACCT-DEL-01 - Account deletion across Matching / Introductions v1 (CP1: Database, API & Integrity).
--
-- Product authority: the Product Owner's approval of the ACCT-DEL-01 WP0 report v1, its review addendum v1.1 and the
-- four decisions P-1 ... P-4 (2026-10-17), with the final review notes; W3-PDG-01 §8 (Delete Account) and CW2-06 / CW2-03
-- §37 as cited. The execution record is docs/e2e/QANDEEL_ACCT_DEL_01_IMPLEMENTATION_RECORD_v1.md. Nothing below is
-- Product authority of its own; every duration is an implementation detail.
--
-- ## Why this exists
--
-- The governed Personal erasure (0130) deletes the account row LAST and turns any foreign-key refusal into BLOCKED. Every
-- Matching / Introductions relation references the account with ON DELETE RESTRICT and almost every one refuses DELETE
-- for every role, and an Introduction World is a Shared World (0114). So the first Mutual Match made an account
-- undeletable, and BLOCKED was terminal and silent. This migration adds ONE governed account erasure that removes the
-- account's whole Matching / Introductions footprint in the same transaction as the unchanged 0130 Personal erasure, and
-- gives every request it cannot finish a truthful, recorded and recoverable answer.
--
-- ## What it does (P-1: Matching / Introductions only; nothing is claimed for Shared STANDARD, Public or Replay)
--
--   * account_erasure_private.erase_account_v1(deletion)  - THE coordinator, behind public.server_erase_account_v1
--     (service_role only, SECURITY DEFINER; no other role, no wrapper). For a SCHEDULED request past its grace period:
--       1. locks, in the published order: the account's Introduction Worlds (ascending) -> their Records -> the Matching
--          serialization rows of the account and every counterpart (ascending) -> the account's live proposals ->
--          participation pointers -> claims -> the account row -> the request. It re-reads the footprint under the
--          setup locks and answers RETRY if it moved while it waited. A local lock_timeout (2 s) turns any longer wait
--          into RETRY rather than holding a counterpart's act.
--       2. a read-only residue census under those locks (no new row can reference a FOR UPDATE-locked account row). A
--          footprint this migration does not cover - Shared STANDARD, Public, Replay - answers BLOCKED with its classes
--          and NOTHING is touched.
--       3. ONE subtransaction around everything else, the 0130 call included: a live Introduction ends exactly as the
--          account's own S6-02 END would (the frozen core, the account as its human); the counterpart keeps a retained
--          view of their own words (P-2) and a frozen proof of their Matching lineage (CW2-06); the photo storage keys
--          go to the 0162 erasure queue and are tracked for this request; the whole footprint is deleted; then the
--          UNCHANGED 0130 Personal erasure runs. 0130 answers BLOCKED without raising (it rolls back only its own
--          block), so any answer but ERASED is RAISED here: the subtransaction undoes every delete, every counterpart
--          effect, every queued key and the GUC, and nothing partial survives. Every foreign key that could refuse is
--          ON DELETE RESTRICT, which PostgreSQL checks immediately even when DEFERRABLE, so nothing waits for COMMIT.
--     Answers: ERASED | BLOCKED | RETRY | INTEGRITY, and 0130's own NOT_DUE | CANCELLED | ALREADY_ERASED | UNKNOWN.
--   * RETRY (contention, or a refusal the census did not explain) and INTEGRITY (any other failure) leave the request
--     SCHEDULED under a bounded exponential backoff on its lease; three unexplained refusals in a row are BLOCKED
--     (UNREGISTERED) - an honest answer, never a loop. Only the SQLSTATE class of an INTEGRITY failure is kept.
--   * account_erasure_private.rearm_blocked_account_deletions_v1 (P-3): a BLOCKED request whose classes are all covered
--     (none is yet: ACCT-DEL-02 and Stage 7 own them) and whose census is clean is re-armed SCHEDULED with a fresh 7-day
--     grace the owner can cancel; a legacy BLOCKED (no recorded class) is classified once.
--   * Photos at two levels (P-3): ERASED cuts access at commit (every byte read re-authorizes from rows that are gone);
--     `media_erased_at` is set when the 0162 worker has proven the last of this request's keys gone (DELETE, HEAD 404).
--
-- ## The controlled amendments (P-4; I-07 §48)
--
--   * Twenty Matching / Introductions guards are redefined IN PLACE (same name, OID, owner, ACL, posture): each keeps its
--     body byte-for-byte after one prefix that admits a DELETE - never an UPDATE - only when the transaction-local
--     `qandeel.account_erasure` equals the current transaction id AND an authorization row for that transaction exists in
--     account_erasure_private.erasure_authorizations, which only the coordinator writes. 0130's own GUC and table are
--     untouched.
--   * The counterpart's retained view (P-2): two relations they own, a subset of their own frozen closed-view
--     entitlement (never widened), and forward replacements of the readers that must accept it: the Introduction branch
--     of resolve_shared_world_closed_history_visibility_v1, read_my_introduction_history_v1,
--     list_my_introduction_worlds_v1 and read_my_introduction_messages_v1. The rest of each body is unchanged.
--   * The counterpart's lineage (CW2-06): matching_counterpart_erasure_releases freezes, at the erasure, the exact 7a-7c
--     proof the 0117 core would otherwise need rows that name the erased account for; the core is replaced forward so
--     gate 7a also accepts that release and its write goes to a sibling command relation. Gates 1-6, the lock law, the
--     single instant and CW2-08 LAST are unchanged; no proposal is touched; reactivation stays the human's own act.
--   * NO_BACKDOOR gains exactly one named service_role exception: public.server_erase_account_v1.
--
-- ## What is deliberately NOT here
--
-- 0130 is byte-unchanged and keeps its grants; no foreign key changes (RESTRICT stays the safety net); no trigger is
-- disabled and no session_replication_role is used; none of the six suspended Matching commands is reopened; no
-- authenticated path is added to any Matching write; CW2-08 and every seam stay NOT_EVALUATED; no Shared STANDARD,
-- Public or Replay row is deleted (they answer BLOCKED and belong to ACCT-DEL-02 / Stage 7); no copy, mobile surface or
-- Launch Gate. Forward-only.
BEGIN;

CREATE SCHEMA account_erasure_private;
ALTER SCHEMA account_erasure_private OWNER TO postgres;
REVOKE ALL ON SCHEMA account_erasure_private FROM PUBLIC;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. STATE (private; no application role reads or writes any of it).
-- ---------------------------------------------------------------------------------------------------------------------

-- The one-transaction authorization the narrowed guards consult.
CREATE TABLE account_erasure_private.erasure_authorizations (
    transaction_id bigint NOT NULL,
    deletion_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT erasure_authorizations_pk PRIMARY KEY (transaction_id)
);

-- Every relation that references the account, or a relation this erasure deletes from, with the module that answers
-- for it. CI (verify-0164 COVERAGE_CENSUS) refuses a relation that is missing here.
CREATE TABLE account_erasure_private.coverage_registry (
    relation text NOT NULL,
    coverage text NOT NULL,
    CONSTRAINT coverage_registry_pk PRIMARY KEY (relation),
    CONSTRAINT coverage_registry_coverage_check CHECK (coverage IN (
        'PERSONAL',               -- deleted by the 0130 Personal erasure
        'ACCOUNT_CASCADE',        -- ON DELETE CASCADE from the account row
        'MATCHING_INTRODUCTIONS', -- deleted by this erasure
        'SHARED_INTRODUCTION',    -- deleted by this erasure inside the account's Introduction Worlds; elsewhere SHARED_STANDARD
        'SHARED_STANDARD',        -- residue: ACCT-DEL-02
        'PUBLIC',                 -- residue: ACCT-DEL-02
        'REPLAY'))                -- residue: Stage 7
);

-- The residue classes a request can be BLOCKED by, whether a module covers each, and who owns it.
CREATE TABLE account_erasure_private.residue_class_coverage (
    residue_class text NOT NULL,
    covered boolean NOT NULL,
    owner text NOT NULL,
    CONSTRAINT residue_class_coverage_pk PRIMARY KEY (residue_class),
    CONSTRAINT residue_class_coverage_class_check
        CHECK (residue_class IN ('SHARED_STANDARD', 'PUBLIC', 'REPLAY', 'UNREGISTERED'))
);

-- One row per deletion request the coordinator has judged: content-free, no account id, no SQLSTATE beyond its class.
CREATE TABLE account_erasure_private.deletion_progress (
    deletion_id uuid NOT NULL,
    last_outcome text NOT NULL,
    residue_classes text[],
    attempts integer NOT NULL DEFAULT 0,
    consecutive_contention integer NOT NULL DEFAULT 0,
    consecutive_unexplained integer NOT NULL DEFAULT 0,
    integrity_failures integer NOT NULL DEFAULT 0,
    last_failure_class text,
    rearm_count integer NOT NULL DEFAULT 0,
    rearmed_at timestamptz,
    erased_at timestamptz,
    media_keys integer,
    media_erased_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT deletion_progress_pk PRIMARY KEY (deletion_id),
    CONSTRAINT deletion_progress_request_fk
        FOREIGN KEY (deletion_id) REFERENCES personal_data_private.account_deletions (id) ON DELETE RESTRICT,
    CONSTRAINT deletion_progress_outcome_check
        CHECK (last_outcome IN ('PENDING', 'ERASED', 'BLOCKED', 'RETRY', 'INTEGRITY', 'REARMED')),
    CONSTRAINT deletion_progress_classes_check
        CHECK (residue_classes IS NULL OR residue_classes <@ ARRAY['SHARED_STANDARD', 'PUBLIC', 'REPLAY', 'UNREGISTERED']),
    CONSTRAINT deletion_progress_failure_class_check CHECK (last_failure_class IS NULL OR last_failure_class ~ '^[0-9A-Z]{2}$'),
    CONSTRAINT deletion_progress_counts_check CHECK (attempts >= 0 AND consecutive_contention >= 0
        AND consecutive_unexplained >= 0 AND integrity_failures >= 0 AND rearm_count >= 0),
    CONSTRAINT deletion_progress_media_check CHECK (media_erased_at IS NULL OR erased_at IS NOT NULL)
);

-- The photo storage keys one erasure queued, until the 0162 worker proves each gone. Transient: a row leaves when its
-- key leaves the queue.
CREATE TABLE account_erasure_private.media_pending (
    deletion_id uuid NOT NULL,
    storage_key text NOT NULL,
    CONSTRAINT media_pending_pk PRIMARY KEY (storage_key, deletion_id),
    CONSTRAINT media_pending_progress_fk
        FOREIGN KEY (deletion_id) REFERENCES account_erasure_private.deletion_progress (deletion_id) ON DELETE RESTRICT,
    CONSTRAINT media_pending_key_check CHECK (storage_key ~ '^intro-media/[0-9a-f-]{36}$')
);
CREATE INDEX media_pending_deletion_idx ON account_erasure_private.media_pending (deletion_id);

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. THE COUNTERPART'S OWN ROWS (P-2, CW2-06). None names the erased account.
-- ---------------------------------------------------------------------------------------------------------------------

-- The counterpart's retained view of one ended Introduction whose other human was erased: their own membership
-- episode, and the proposal identity they already held (it resolves to nothing any more; it keeps the frozen S6-05
-- list shape, whose World is joined to its proposal by that identity).
CREATE TABLE public.introduction_retained_views (
    world_id uuid NOT NULL,
    user_id uuid NOT NULL,
    membership_episode_id uuid NOT NULL,
    matching_proposal_id uuid NOT NULL,
    retained_at timestamptz NOT NULL,
    CONSTRAINT introduction_retained_views_pk PRIMARY KEY (world_id, user_id),
    CONSTRAINT introduction_retained_views_user_fk
        FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT introduction_retained_views_episode_fk
        FOREIGN KEY (membership_episode_id, world_id, user_id)
        REFERENCES public.shared_world_membership_episodes (id, world_id, user_id) ON DELETE RESTRICT
);

-- Exactly the items of that human's frozen closed-view entitlement that are their OWN human words: a subset, never a
-- widening (0161: "no entitlement is created, widened or copied" for anyone else's words).
CREATE TABLE public.introduction_retained_view_items (
    world_id uuid NOT NULL,
    user_id uuid NOT NULL,
    history_item_id uuid NOT NULL,
    CONSTRAINT introduction_retained_view_items_pk PRIMARY KEY (world_id, user_id, history_item_id),
    CONSTRAINT introduction_retained_view_items_view_fk
        FOREIGN KEY (world_id, user_id) REFERENCES public.introduction_retained_views (world_id, user_id) ON DELETE RESTRICT,
    CONSTRAINT introduction_retained_view_items_item_fk
        FOREIGN KEY (history_item_id, world_id) REFERENCES public.shared_world_history_items (id, world_id) ON DELETE RESTRICT
);

-- The counterpart's frozen lineage: the exact act gate 7a would anchor on, proven at the erasure (under the erasure's
-- locks, against the very terminal commit, record and claim it then deletes) to descend from a terminal Introduction of
-- theirs with their claim RELEASED. One act is released at most once.
CREATE TABLE public.matching_counterpart_erasure_releases (
    anchor_event_id uuid NOT NULL,
    participant_user_id uuid NOT NULL,
    released_at timestamptz NOT NULL,
    CONSTRAINT matching_counterpart_erasure_releases_pk PRIMARY KEY (anchor_event_id),
    CONSTRAINT matching_counterpart_erasure_releases_user_fk
        FOREIGN KEY (participant_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT matching_counterpart_erasure_releases_event_fk
        FOREIGN KEY (anchor_event_id, participant_user_id)
        REFERENCES public.matching_participation_events (id, participant_user_id) ON DELETE RESTRICT
);

-- A reactivation whose lineage is a counterpart-erasure release, or one committed before the other human's erasure and
-- moved here from matching_introduction_reactivation_commands (whose terminal and claim keys named that human). Same
-- one-lineage-once law: one produced act, one superseded act.
CREATE TABLE public.matching_counterpart_erasure_reactivation_commands (
    id uuid NOT NULL,
    participant_user_id uuid NOT NULL,
    released_anchor_event_id uuid,
    prior_participation_event_id uuid NOT NULL,
    participation_event_id uuid NOT NULL,
    reactivation_act text NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT matching_counterpart_erasure_reactivation_commands_pk PRIMARY KEY (id),
    CONSTRAINT matching_counterpart_erasure_reactivation_commands_event_key UNIQUE (participation_event_id),
    CONSTRAINT matching_counterpart_erasure_reactivation_commands_prior_key UNIQUE (prior_participation_event_id),
    CONSTRAINT matching_counterpart_erasure_reactivation_commands_act_check
        CHECK (reactivation_act IN ('RESUME', 'ACTIVATE')),
    CONSTRAINT matching_counterpart_erasure_reactivation_commands_user_fk
        FOREIGN KEY (participant_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT matching_counterpart_erasure_reactivation_commands_event_fk
        FOREIGN KEY (participation_event_id, participant_user_id)
        REFERENCES public.matching_participation_events (id, participant_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_counterpart_erasure_reactivation_commands_prior_fk
        FOREIGN KEY (prior_participation_event_id, participant_user_id)
        REFERENCES public.matching_participation_events (id, participant_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_counterpart_erasure_reactivation_commands_release_fk
        FOREIGN KEY (released_anchor_event_id)
        REFERENCES public.matching_counterpart_erasure_releases (anchor_event_id) ON DELETE RESTRICT
);
CREATE INDEX matching_counterpart_erasure_releases_user_idx
    ON public.matching_counterpart_erasure_releases (participant_user_id);
CREATE INDEX matching_counterpart_erasure_reactivation_commands_user_idx
    ON public.matching_counterpart_erasure_reactivation_commands (participant_user_id);
CREATE INDEX matching_counterpart_erasure_reactivation_commands_release_idx
    ON public.matching_counterpart_erasure_reactivation_commands (released_anchor_event_id);
CREATE INDEX introduction_retained_views_user_idx ON public.introduction_retained_views (user_id);
CREATE INDEX introduction_retained_view_items_item_idx ON public.introduction_retained_view_items (history_item_id);

-- The erasure's own reach (the Data API bound, WP0 addendum §5.3): every account column of a relation this erasure
-- deletes from that had no leading index. The account row's final DELETE checks every RESTRICT reference to it, and an
-- unindexed column is a whole-table scan inside that one transaction. Plain indexes only: no constraint, no semantics.
CREATE INDEX acct_del_01_closed_view_entitlements_user_idx ON public.introduction_closed_view_entitlements (user_id);
CREATE INDEX acct_del_01_disclosure_granted_counterpart_idx ON public.introduction_disclosure_granted_events (counterpart_user_id);
CREATE INDEX acct_del_01_disclosure_versions_counterpart_idx ON public.introduction_disclosure_resource_versions (counterpart_user_id);
CREATE INDEX acct_del_01_ended_events_actor_idx ON public.introduction_ended_events (actor_user_id);
CREATE INDEX acct_del_01_image_series_owner_idx ON introduction_sharing_private.image_series (owner_user_id);
CREATE INDEX acct_del_01_success_required_approver_idx ON public.introduction_success_required_approvers (approver_user_id);
CREATE INDEX acct_del_01_terminal_commits_actor_idx ON public.introduction_terminal_commits (ending_actor_user_id);
CREATE INDEX acct_del_01_hard_results_evaluated_for_idx ON public.matching_hard_requirement_results (evaluated_for_user_id);
CREATE INDEX acct_del_01_reasoning_notes_about_idx ON public.matching_private_reasoning_notes (about_user_id);
CREATE INDEX acct_del_01_conclusion_candidates_about_idx ON public.matching_safe_conclusion_candidates (about_user_id);
CREATE INDEX acct_del_01_conclusion_candidates_recipient_idx ON public.matching_safe_conclusion_candidates (for_recipient_user_id);
CREATE INDEX acct_del_01_item_required_approvers_user_idx ON public.shared_world_history_item_required_approvers (approver_user_id);
CREATE INDEX acct_del_01_material_commit_actor_idx ON public.shared_world_material_commit_commands (actor_user_id);
CREATE INDEX acct_del_01_material_delete_actor_idx ON public.shared_world_material_delete_commands (actor_user_id);

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. THE NARROWED GUARDS.
-- ---------------------------------------------------------------------------------------------------------------------

-- Whether THIS transaction is the governed account erasure. INVOKER, as 0130's: only the erasure's owner can read the
-- table, and a guard reaches this only after the transaction-bound setting already matched.
CREATE FUNCTION account_erasure_private.erasure_authorized_v1()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM account_erasure_private.erasure_authorizations a
         WHERE a.transaction_id = pg_catalog.txid_current());
$$;

-- The four new relations are durable history like the frozen ones beside them, with the same one exception.
CREATE FUNCTION public.reject_account_erasure_retention_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  -- ACCT-DEL-01 (0164): the governed account erasure alone may DELETE; nothing else changes.
  IF TG_OP = 'DELETE' THEN
    IF pg_catalog.current_setting('qandeel.account_erasure', true) = pg_catalog.txid_current()::text THEN
      IF account_erasure_private.erasure_authorized_v1() THEN RETURN OLD; END IF;
    END IF;
  END IF;
  RAISE EXCEPTION 'ACCOUNT_ERASURE_RETENTION_IS_DURABLE' USING ERRCODE = '55000',
    DETAIL = 'A retained view, a counterpart-erasure release and its reactivation are durable history: UPDATE and DELETE are refused for every role, including the table owner.';
END$$;

CREATE TRIGGER introduction_retained_views_immutable
    BEFORE UPDATE OR DELETE ON public.introduction_retained_views
    FOR EACH ROW EXECUTE FUNCTION public.reject_account_erasure_retention_mutation_v1();
CREATE TRIGGER introduction_retained_view_items_immutable
    BEFORE UPDATE OR DELETE ON public.introduction_retained_view_items
    FOR EACH ROW EXECUTE FUNCTION public.reject_account_erasure_retention_mutation_v1();
CREATE TRIGGER matching_counterpart_erasure_releases_immutable
    BEFORE UPDATE OR DELETE ON public.matching_counterpart_erasure_releases
    FOR EACH ROW EXECUTE FUNCTION public.reject_account_erasure_retention_mutation_v1();
CREATE TRIGGER matching_counterpart_erasure_reactivation_commands_immutable
    BEFORE UPDATE OR DELETE ON public.matching_counterpart_erasure_reactivation_commands
    FOR EACH ROW EXECUTE FUNCTION public.reject_account_erasure_retention_mutation_v1();

-- The twenty Matching / Introductions DELETE guards, redefined IN PLACE: the live body, byte for byte, after one prefix
-- inserted directly after its first BEGIN. The deploy-time assertion below proves exactly that for every one.
CREATE TEMPORARY TABLE acct_del_01_guard_bodies (fn text PRIMARY KEY, before_src text NOT NULL, prefix_at integer NOT NULL)
    ON COMMIT DROP;
DO $$
DECLARE
  guards constant text[] := ARRAY[
    'public.introduction_disclosure_verifier_erasure_guard_v1()',
    'public.introduction_profile_state_truth_v1()',
    'public.introduction_record_truth_v1()',
    'introduction_sharing_private.refuse_name_display_event_rewrite_v1()',
    'public.introduction_success_approval_pointer_truth_v1()',
    'public.matching_active_introduction_claim_truth_v1()',
    'public.matching_authority_status_truth_v1()',
    'public.matching_confirmed_fact_state_truth_v1()',
    'public.matching_participation_state_truth_v1()',
    'public.matching_proposal_state_truth_v1()',
    'public.matching_recipient_view_state_truth_v1()',
    'public.matching_requirement_state_truth_v1()',
    'public.matching_setup_lock_truth_v1()',
    'public.reject_introduction_disclosure_mutation_v1()',
    'public.reject_introduction_terminal_mutation_v1()',
    'public.reject_matching_confirmed_fact_mutation_v1()',
    'public.reject_matching_match_mutation_v1()',
    'public.reject_matching_proposal_mutation_v1()',
    'public.reject_matching_reactivation_mutation_v1()',
    'public.reject_matching_setup_mutation_v1()'];
  prefix constant text := E'\n  -- ACCT-DEL-01 (0164): the governed account erasure alone may DELETE; nothing else changes.\n'
    || E'  IF TG_OP = ''DELETE'' THEN\n'
    || E'    IF pg_catalog.current_setting(''qandeel.account_erasure'', true) = pg_catalog.txid_current()::text THEN\n'
    || E'      IF account_erasure_private.erasure_authorized_v1() THEN RETURN OLD; END IF;\n'
    || E'    END IF;\n'
    || E'  END IF;';
  guard text;
  definition text;
  source text;
  at integer;
BEGIN
  FOREACH guard IN ARRAY guards LOOP
    SELECT pg_get_functiondef(p.oid), p.prosrc INTO definition, source FROM pg_proc p WHERE p.oid = guard::regprocedure;
    at := regexp_instr(source, '\mBEGIN\M');
    IF at = 0 OR strpos(definition, source) = 0 THEN
      RAISE EXCEPTION 'ACCT-DEL-01: % has no recognizable body', guard;
    END IF;
    INSERT INTO acct_del_01_guard_bodies (fn, before_src, prefix_at) VALUES (guard, source, at);
    EXECUTE replace(definition, source, substr(source, 1, at + 4) || prefix || substr(source, at + 5));
  END LOOP;
  -- Exactly the body before, with exactly the prefix after its first BEGIN; the same function, owner and posture.
  FOREACH guard IN ARRAY guards LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN acct_del_01_guard_bodies b ON b.fn = guard
       WHERE p.oid = guard::regprocedure
         AND p.prosrc = substr(b.before_src, 1, b.prefix_at + 4) || prefix || substr(b.before_src, b.prefix_at + 5)
         AND pg_get_userbyid(p.proowner) = 'postgres' AND p.prorettype = 'trigger'::regtype) THEN
      RAISE EXCEPTION 'ACCT-DEL-01: % was not narrowed exactly', guard;
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. COVERAGE (P-1). The registry, the residue classes and the release gate's one readable truth.
-- ---------------------------------------------------------------------------------------------------------------------
INSERT INTO account_erasure_private.residue_class_coverage (residue_class, covered, owner) VALUES
    ('SHARED_STANDARD', false, 'ACCT-DEL-02'),
    ('PUBLIC', false, 'ACCT-DEL-02'),
    ('REPLAY', false, 'Stage 7 - Replay'),
    ('UNREGISTERED', false, 'none - refused by the ACCT-DEL-01 coverage census in CI');

INSERT INTO account_erasure_private.coverage_registry (relation, coverage) VALUES
    ('account_private.login_id_change_commands', 'ACCOUNT_CASCADE'),
    ('activity_context_mutes', 'ACCOUNT_CASCADE'),
    ('activity_item_members', 'ACCOUNT_CASCADE'),
    ('activity_items', 'ACCOUNT_CASCADE'),
    ('activity_preferences', 'ACCOUNT_CASCADE'),
    ('ai_provider_calls', 'ACCOUNT_CASCADE'),
    ('interaction_preferences', 'ACCOUNT_CASCADE'),
    ('introductions_preparation_private.assistance_consents', 'ACCOUNT_CASCADE'),
    ('introductions_preparation_private.command_ledger', 'ACCOUNT_CASCADE'),
    ('introductions_preparation_private.drafts', 'ACCOUNT_CASCADE'),
    ('personal_data_private.data_exports', 'ACCOUNT_CASCADE'),
    ('push_delivery_attempts', 'ACCOUNT_CASCADE'),
    ('push_devices', 'ACCOUNT_CASCADE'),
    ('understanding_contests', 'ACCOUNT_CASCADE'),
    ('understanding_discussion_focus', 'ACCOUNT_CASCADE'),
    ('introduction_closed_view_entitlement_items', 'MATCHING_INTRODUCTIONS'),
    ('introduction_closed_view_entitlements', 'MATCHING_INTRODUCTIONS'),
    ('introduction_completed_events', 'MATCHING_INTRODUCTIONS'),
    ('introduction_disclosure_commands', 'MATCHING_INTRODUCTIONS'),
    ('introduction_disclosure_granted_events', 'MATCHING_INTRODUCTIONS'),
    ('introduction_disclosure_media_payloads', 'MATCHING_INTRODUCTIONS'),
    ('introduction_disclosure_resource_versions', 'MATCHING_INTRODUCTIONS'),
    ('introduction_disclosure_text_payloads', 'MATCHING_INTRODUCTIONS'),
    ('introduction_ended_events', 'MATCHING_INTRODUCTIONS'),
    ('introduction_profile_field_values', 'MATCHING_INTRODUCTIONS'),
    ('introduction_profile_state', 'MATCHING_INTRODUCTIONS'),
    ('introduction_profile_versions', 'MATCHING_INTRODUCTIONS'),
    ('introduction_records', 'MATCHING_INTRODUCTIONS'),
    ('introduction_retained_view_items', 'MATCHING_INTRODUCTIONS'),
    ('introduction_retained_views', 'MATCHING_INTRODUCTIONS'),
    ('introduction_sharing_private.image_renditions', 'MATCHING_INTRODUCTIONS'),
    ('introduction_sharing_private.image_series', 'MATCHING_INTRODUCTIONS'),
    ('introduction_sharing_private.image_stage_disclosures', 'MATCHING_INTRODUCTIONS'),
    ('introduction_sharing_private.name_display_events', 'MATCHING_INTRODUCTIONS'),
    ('introduction_sharing_private.name_display_state', 'MATCHING_INTRODUCTIONS'),
    ('introduction_success_approval_events', 'MATCHING_INTRODUCTIONS'),
    ('introduction_success_approval_state', 'MATCHING_INTRODUCTIONS'),
    ('introduction_success_required_approvers', 'MATCHING_INTRODUCTIONS'),
    ('introduction_success_transition_versions', 'MATCHING_INTRODUCTIONS'),
    ('introduction_terminal_commits', 'MATCHING_INTRODUCTIONS'),
    ('matching_active_introduction_claims', 'MATCHING_INTRODUCTIONS'),
    ('matching_confirmed_fact_state', 'MATCHING_INTRODUCTIONS'),
    ('matching_confirmed_fact_versions', 'MATCHING_INTRODUCTIONS'),
    ('matching_context_consent_events', 'MATCHING_INTRODUCTIONS'),
    ('matching_context_grants', 'MATCHING_INTRODUCTIONS'),
    ('matching_counterpart_erasure_reactivation_commands', 'MATCHING_INTRODUCTIONS'),
    ('matching_counterpart_erasure_releases', 'MATCHING_INTRODUCTIONS'),
    ('matching_eligibility_snapshot_fact_bindings', 'MATCHING_INTRODUCTIONS'),
    ('matching_eligibility_snapshots', 'MATCHING_INTRODUCTIONS'),
    ('matching_forward_approval_view_bindings', 'MATCHING_INTRODUCTIONS'),
    ('matching_hard_requirement_results', 'MATCHING_INTRODUCTIONS'),
    ('matching_introduction_reactivation_commands', 'MATCHING_INTRODUCTIONS'),
    ('matching_match_commits', 'MATCHING_INTRODUCTIONS'),
    ('matching_match_competing_cancellations', 'MATCHING_INTRODUCTIONS'),
    ('matching_match_handoff_fields', 'MATCHING_INTRODUCTIONS'),
    ('matching_match_handoff_package_versions', 'MATCHING_INTRODUCTIONS'),
    ('matching_match_handoff_subjects', 'MATCHING_INTRODUCTIONS'),
    ('matching_pairs', 'MATCHING_INTRODUCTIONS'),
    ('matching_participation_events', 'MATCHING_INTRODUCTIONS'),
    ('matching_participation_state', 'MATCHING_INTRODUCTIONS'),
    ('matching_permitted_safe_conclusions', 'MATCHING_INTRODUCTIONS'),
    ('matching_private_reasoning_notes', 'MATCHING_INTRODUCTIONS'),
    ('matching_proposal_decision_view_bindings', 'MATCHING_INTRODUCTIONS'),
    ('matching_proposal_delivery_view_bindings', 'MATCHING_INTRODUCTIONS'),
    ('matching_proposal_transitions', 'MATCHING_INTRODUCTIONS'),
    ('matching_proposals', 'MATCHING_INTRODUCTIONS'),
    ('matching_recipient_proposal_view_fields', 'MATCHING_INTRODUCTIONS'),
    ('matching_recipient_proposal_view_state', 'MATCHING_INTRODUCTIONS'),
    ('matching_recipient_proposal_views', 'MATCHING_INTRODUCTIONS'),
    ('matching_requirement_items', 'MATCHING_INTRODUCTIONS'),
    ('matching_requirement_state', 'MATCHING_INTRODUCTIONS'),
    ('matching_requirement_versions', 'MATCHING_INTRODUCTIONS'),
    ('matching_safe_conclusion_candidates', 'MATCHING_INTRODUCTIONS'),
    ('matching_sensitive_filter_refusals', 'MATCHING_INTRODUCTIONS'),
    ('matching_setup_locks', 'MATCHING_INTRODUCTIONS'),
    ('pre_match_disclosure_authorities', 'MATCHING_INTRODUCTIONS'),
    ('pre_match_disclosure_authority_events', 'MATCHING_INTRODUCTIONS'),
    ('pre_match_disclosure_authority_fields', 'MATCHING_INTRODUCTIONS'),
    ('confidence_evaluations', 'PERSONAL'),
    ('conversation_sessions', 'PERSONAL'),
    ('conversation_turns', 'PERSONAL'),
    ('conversation_unit_commit_batches', 'PERSONAL'),
    ('conversation_units', 'PERSONAL'),
    ('formal_question_turn_bindings', 'PERSONAL'),
    ('him_metric_snapshots', 'PERSONAL'),
    ('historical_question_events', 'PERSONAL'),
    ('historical_thread_availability', 'PERSONAL'),
    ('historical_world_semantic_clocks', 'PERSONAL'),
    ('hypotheses', 'PERSONAL'),
    ('hypothesis_lifecycle_transitions', 'PERSONAL'),
    ('hypothesis_subject_grounding_proposals', 'PERSONAL'),
    ('hypothesis_updates', 'PERSONAL'),
    ('information_gap_confidence_sources', 'PERSONAL'),
    ('information_gaps', 'PERSONAL'),
    ('memories', 'PERSONAL'),
    ('memory_control_commands', 'PERSONAL'),
    ('question_candidates', 'PERSONAL'),
    ('public_discussion_post_commands', 'PUBLIC'),
    ('public_discussion_private.qandeel_work_grants', 'PUBLIC'),
    ('public_discussion_private.qandeel_work_leases', 'PUBLIC'),
    ('public_experience_disappearance_commands', 'PUBLIC'),
    ('public_experience_draft_commands', 'PUBLIC'),
    ('public_experience_publish_commands', 'PUBLIC'),
    ('public_experience_review_ready_commands', 'PUBLIC'),
    ('public_experience_semantic_placement_commands', 'PUBLIC'),
    ('public_identities', 'PUBLIC'),
    ('public_identity_commands', 'PUBLIC'),
    ('public_world_private.account_public_display_choices', 'PUBLIC'),
    ('publication_approval_withdrawal_commands', 'PUBLIC'),
    ('publication_manifest_required_approvers', 'PUBLIC'),
    ('publication_package_item_provenance', 'PUBLIC'),
    ('publication_package_prepare_commands', 'PUBLIC'),
    ('replay_distribution_authorizations', 'REPLAY'),
    ('replay_distribution_required_approvers', 'REPLAY'),
    ('replay_source_manifest_items', 'REPLAY'),
    ('replay_source_manifest_versions', 'REPLAY'),
    ('replays', 'REPLAY'),
    ('shared_world_history_item_baseline_viewers', 'SHARED_INTRODUCTION'),
    ('shared_world_history_item_required_approvers', 'SHARED_INTRODUCTION'),
    ('shared_world_history_items', 'SHARED_INTRODUCTION'),
    ('shared_world_introduction_started_events', 'SHARED_INTRODUCTION'),
    ('shared_world_matching_birth_events', 'SHARED_INTRODUCTION'),
    ('shared_world_material_commit_commands', 'SHARED_INTRODUCTION'),
    ('shared_world_material_delete_commands', 'SHARED_INTRODUCTION'),
    ('shared_world_material_deleted_events', 'SHARED_INTRODUCTION'),
    ('shared_world_material_dependencies', 'SHARED_INTRODUCTION'),
    ('shared_world_material_historical_authority', 'SHARED_INTRODUCTION'),
    ('shared_world_materials', 'SHARED_INTRODUCTION'),
    ('shared_world_membership_episodes', 'SHARED_INTRODUCTION'),
    ('shared_world_qandeel_material_evidence', 'SHARED_INTRODUCTION'),
    ('shared_world_text_material_bodies', 'SHARED_INTRODUCTION'),
    ('shared_world_voice_note_material_bodies', 'SHARED_INTRODUCTION'),
    ('shared_worlds', 'SHARED_INTRODUCTION'),
    ('shared_private.shared_direct_birth_launch_evidence', 'SHARED_STANDARD'),
    ('shared_private.shared_direct_invitation_decline_commands', 'SHARED_STANDARD'),
    ('shared_private.shared_governance_proposal_origins', 'SHARED_STANDARD'),
    ('shared_private.shared_id_sealed_values', 'SHARED_STANDARD'),
    ('shared_private.shared_qandeel_reply_work_grants', 'SHARED_STANDARD'),
    ('shared_private.shared_qandeel_reply_work_leases', 'SHARED_STANDARD'),
    ('shared_semantic_private.semantic_passes', 'SHARED_STANDARD'),
    ('shared_semantic_private.semantic_places', 'SHARED_STANDARD'),
    ('shared_semantic_private.semantic_work_grants', 'SHARED_STANDARD'),
    ('shared_semantic_private.semantic_work_leases', 'SHARED_STANDARD'),
    ('shared_world_add_member_payload_versions', 'SHARED_STANDARD'),
    ('shared_world_direct_acceptance_commands', 'SHARED_STANDARD'),
    ('shared_world_direct_birth_events', 'SHARED_STANDARD'),
    ('shared_world_direct_invitations', 'SHARED_STANDARD'),
    ('shared_world_end_payload_versions', 'SHARED_STANDARD'),
    ('shared_world_ended_events', 'SHARED_STANDARD'),
    ('shared_world_governance_proposals', 'SHARED_STANDARD'),
    ('shared_world_history_grant_commands', 'SHARED_STANDARD'),
    ('shared_world_history_granted_events', 'SHARED_STANDARD'),
    ('shared_world_history_package_manifest_items', 'SHARED_STANDARD'),
    ('shared_world_history_package_manifest_versions', 'SHARED_STANDARD'),
    ('shared_world_history_package_required_approvers', 'SHARED_STANDARD'),
    ('shared_world_invitation_commands', 'SHARED_STANDARD'),
    ('shared_world_invite_credential_state', 'SHARED_STANDARD'),
    ('shared_world_member_acceptance_commands', 'SHARED_STANDARD'),
    ('shared_world_member_invitations', 'SHARED_STANDARD'),
    ('shared_world_member_joined_events', 'SHARED_STANDARD'),
    ('shared_world_member_left_events', 'SHARED_STANDARD'),
    ('shared_world_member_rejoin_commands', 'SHARED_STANDARD'),
    ('shared_world_member_rejoined_events', 'SHARED_STANDARD'),
    ('shared_world_member_removal_commands', 'SHARED_STANDARD'),
    ('shared_world_member_removed_events', 'SHARED_STANDARD'),
    ('shared_world_membership_snapshot_members', 'SHARED_STANDARD'),
    ('shared_world_membership_snapshots', 'SHARED_STANDARD'),
    ('shared_world_rejoin_payload_versions', 'SHARED_STANDARD'),
    ('shared_world_remove_member_payload_versions', 'SHARED_STANDARD'),
    ('shared_world_setting_changed_events', 'SHARED_STANDARD'),
    ('shared_world_settings_change_commands', 'SHARED_STANDARD'),
    ('shared_world_settings_state', 'SHARED_STANDARD'),
    ('shared_world_settings_versions', 'SHARED_STANDARD'),
    ('shared_world_standard_closed_view_entitlement_items', 'SHARED_STANDARD'),
    ('shared_world_standard_closed_view_entitlements', 'SHARED_STANDARD'),
    ('shared_world_standard_end_commands', 'SHARED_STANDARD'),
    ('shared_world_standing_context_consent_events', 'SHARED_STANDARD'),
    ('shared_world_standing_context_grant_audience', 'SHARED_STANDARD'),
    ('shared_world_standing_context_grants', 'SHARED_STANDARD'),
    ('shared_world_voluntary_leave_commands', 'SHARED_STANDARD');

-- The read-only residue census: which uncovered classes still hold a row that names the account. `p_worlds` is the
-- account's Introduction Worlds; inside them the Shared rows are this module's, anywhere else they are Shared STANDARD.
-- Static SQL, one probe per (relation, column), generated from the catalog and kept complete by verify-0164.
CREATE FUNCTION account_erasure_private.residue_classes_v1(p_user uuid, p_worlds uuid[])
RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v text[] := ARRAY[]::text[];
BEGIN
  p_worlds := coalesce(p_worlds, ARRAY[]::uuid[]);
  IF EXISTS (SELECT 1 FROM public.public_discussion_post_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.public_experience_disappearance_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.public_experience_draft_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.public_experience_publish_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.public_experience_review_ready_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.public_experience_semantic_placement_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.public_identities x WHERE x.user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.public_identity_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.publication_approval_withdrawal_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.publication_manifest_required_approvers x WHERE x.approver_user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.publication_package_item_provenance x WHERE x.personal_owner_user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.publication_package_prepare_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.replay_distribution_authorizations x WHERE x.authorized_by_user_id = p_user) THEN v := v || 'REPLAY'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.replay_distribution_required_approvers x WHERE x.approver_user_id = p_user) THEN v := v || 'REPLAY'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.replays x WHERE x.created_by_user_id = p_user) THEN v := v || 'REPLAY'::text; END IF;
  IF EXISTS (SELECT 1 FROM shared_private.shared_direct_invitation_decline_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM shared_private.shared_governance_proposal_origins x WHERE x.proposer_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_add_member_payload_versions x WHERE x.target_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_direct_acceptance_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_direct_invitations x WHERE x.inviter_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_direct_invitations x WHERE x.target_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_history_item_baseline_viewers x JOIN public.shared_world_history_items i ON i.id = x.history_item_id
              WHERE x.user_id = p_user AND NOT (i.world_id = ANY (p_worlds))) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_history_item_required_approvers x JOIN public.shared_world_history_items i ON i.id = x.history_item_id
              WHERE x.approver_user_id = p_user AND NOT (i.world_id = ANY (p_worlds))) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_history_package_manifest_versions x WHERE x.grantee_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_history_package_required_approvers x WHERE x.approver_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_invitation_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_invite_credential_state x WHERE x.user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_material_commit_commands x WHERE x.actor_user_id = p_user AND NOT (x.world_id = ANY (p_worlds))) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_material_delete_commands x WHERE x.actor_user_id = p_user AND NOT (x.world_id = ANY (p_worlds))) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_materials x WHERE x.author_user_id = p_user AND NOT (x.world_id = ANY (p_worlds))) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_acceptance_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_invitations x WHERE x.target_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_joined_events x WHERE x.actor_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_left_events x WHERE x.actor_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_rejoin_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_rejoined_events x WHERE x.actor_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_removed_events x WHERE x.target_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_membership_episodes x WHERE x.user_id = p_user AND NOT (x.world_id = ANY (p_worlds))) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_rejoin_payload_versions x WHERE x.target_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_remove_member_payload_versions x WHERE x.target_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_standard_closed_view_entitlements x WHERE x.user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_standing_context_consent_events x WHERE x.grantor_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_standing_context_grant_audience x WHERE x.audience_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_standing_context_grants x WHERE x.grantor_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_voluntary_leave_commands x WHERE x.actor_user_id = p_user) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.publication_package_item_provenance x WHERE x.shared_world_id = ANY (p_worlds)) THEN v := v || 'PUBLIC'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.replay_source_manifest_items x WHERE x.shared_world_id = ANY (p_worlds)) THEN v := v || 'REPLAY'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.replay_source_manifest_versions x WHERE x.shared_world_id = ANY (p_worlds)) THEN v := v || 'REPLAY'::text; END IF;
  IF EXISTS (SELECT 1 FROM shared_private.shared_direct_birth_launch_evidence x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM shared_private.shared_governance_proposal_origins x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM shared_private.shared_qandeel_reply_work_leases x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM shared_semantic_private.semantic_passes x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM shared_semantic_private.semantic_places x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM shared_semantic_private.semantic_work_grants x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM shared_semantic_private.semantic_work_leases x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_add_member_payload_versions x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_direct_acceptance_commands x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_direct_birth_events x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_end_payload_versions x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_ended_events x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_governance_proposals x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_history_grant_commands x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_history_granted_events x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_history_package_manifest_items x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_history_package_manifest_versions x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_acceptance_commands x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_invitations x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_joined_events x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_left_events x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_rejoin_commands x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_rejoined_events x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_removal_commands x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_member_removed_events x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_membership_snapshots x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_rejoin_payload_versions x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_remove_member_payload_versions x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_setting_changed_events x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_settings_change_commands x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_settings_state x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_settings_versions x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_standard_closed_view_entitlement_items x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_standard_closed_view_entitlements x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_standard_end_commands x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_standing_context_consent_events x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_standing_context_grants x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.shared_world_voluntary_leave_commands x WHERE x.world_id = ANY (p_worlds)) THEN v := v || 'SHARED_STANDARD'::text; END IF;
  RETURN ARRAY(SELECT DISTINCT c FROM unnest(v) AS u(c) ORDER BY c);
END$$;

-- Whether any row of the two covered module classes still names the account (the module's own completeness check).
CREATE FUNCTION account_erasure_private.module_residue_v1(p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT false
    OR EXISTS (SELECT 1 FROM public.introduction_closed_view_entitlements x WHERE x.user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.introduction_disclosure_granted_events x WHERE x.counterpart_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.introduction_disclosure_resource_versions x WHERE x.counterpart_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.introduction_disclosure_resource_versions x WHERE x.owner_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.introduction_ended_events x WHERE x.actor_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.introduction_profile_state x WHERE x.owner_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.introduction_profile_versions x WHERE x.owner_user_id = p_user)
    OR EXISTS (SELECT 1 FROM introduction_sharing_private.image_series x WHERE x.owner_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.introduction_success_required_approvers x WHERE x.approver_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.introduction_terminal_commits x WHERE x.ending_actor_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.matching_active_introduction_claims x WHERE x.user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.matching_confirmed_fact_state x WHERE x.owner_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.matching_confirmed_fact_versions x WHERE x.owner_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.matching_context_consent_events x WHERE x.grantor_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.matching_context_grants x WHERE x.grantor_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.matching_hard_requirement_results x WHERE x.evaluated_for_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.matching_pairs x WHERE x.higher_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.matching_pairs x WHERE x.lower_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.matching_participation_events x WHERE x.participant_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.matching_participation_state x WHERE x.participant_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.matching_private_reasoning_notes x WHERE x.about_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.matching_requirement_state x WHERE x.owner_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.matching_requirement_versions x WHERE x.owner_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.matching_safe_conclusion_candidates x WHERE x.about_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.matching_safe_conclusion_candidates x WHERE x.for_recipient_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.matching_setup_locks x WHERE x.user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.pre_match_disclosure_authorities x WHERE x.grantor_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.pre_match_disclosure_authority_events x WHERE x.grantor_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.shared_world_history_item_baseline_viewers x WHERE x.user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.shared_world_history_item_required_approvers x WHERE x.approver_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.shared_world_material_commit_commands x WHERE x.actor_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.shared_world_material_delete_commands x WHERE x.actor_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.shared_world_materials x WHERE x.author_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.shared_world_membership_episodes x WHERE x.user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.introduction_retained_views x WHERE x.user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.matching_counterpart_erasure_releases x WHERE x.participant_user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.matching_counterpart_erasure_reactivation_commands x WHERE x.participant_user_id = p_user);
$$;

-- The account's Introduction Worlds: an episode of theirs in a World still in the INTRODUCTION phase.
CREATE FUNCTION account_erasure_private.introduction_worlds_v1(p_user uuid)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(array_agg(DISTINCT e.world_id ORDER BY e.world_id), ARRAY[]::uuid[])
    FROM public.shared_world_membership_episodes e JOIN public.shared_worlds w ON w.id = e.world_id
   WHERE e.user_id = p_user AND w.phase = 'INTRODUCTION';
$$;

-- Every human the account shares a Matching pair with, and the account itself, ascending.
CREATE FUNCTION account_erasure_private.matching_humans_v1(p_user uuid)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(array_agg(DISTINCT h ORDER BY h), ARRAY[]::uuid[])
    FROM (SELECT p_user AS h
          UNION SELECT CASE WHEN p.lower_user_id = p_user THEN p.higher_user_id ELSE p.lower_user_id END
            FROM public.matching_pairs p WHERE p_user IN (p.lower_user_id, p.higher_user_id)) s;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. THE MATCHING / INTRODUCTIONS MODULE. Runs only inside the coordinator's subtransaction, under its locks and its
--    authorization; returns how many photo storage keys it queued.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION account_erasure_private.erase_matching_introductions_v1(p_deletion_id uuid, p_user uuid, p_worlds uuid[])
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_world uuid;
  v_record public.introduction_records;
  v_match public.matching_match_commits;
  v_terminal public.introduction_terminal_commits;
  v_act public.matching_participation_events;
  v_other uuid;
  v_keeper uuid;
  v_anchor uuid;
  v_outcome text;
  v_claims text;
  v_claim_sub text;
  v_series uuid;
  v_keys integer := 0;
  v_materials uuid[];
  v_items uuid[];
  v_pairs uuid[];
  v_proposals uuid[];
  v_snapshots uuid[];
  v_candidates uuid[];
BEGIN
  FOREACH v_world IN ARRAY p_worlds LOOP
    v_keeper := NULL;
    SELECT * INTO v_record FROM public.introduction_records r WHERE r.world_id = v_world;
    IF FOUND THEN
      v_other := CASE WHEN v_record.lower_user_id = p_user THEN v_record.higher_user_id ELSE v_record.lower_user_id END;

      -- A live Introduction ends first, exactly as this human's own S6-02 END would: the frozen 0116 core through the
      -- S6-02 boundary, this human as auth.uid(), every effect (the counterpart's POST_INTRODUCTION, the released claims,
      -- both frozen entitlements, the archival closure) its own. The counterpart sees an ordinary END and nothing more.
      IF v_record.introduction_status = 'ACTIVE' THEN
        v_claims := pg_catalog.current_setting('request.jwt.claims', true);
        v_claim_sub := pg_catalog.current_setting('request.jwt.claim.sub', true);
        PERFORM pg_catalog.set_config('request.jwt.claims',
          pg_catalog.json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
        PERFORM pg_catalog.set_config('request.jwt.claim.sub', p_user::text, true);
        SELECT e.outcome INTO v_outcome
          FROM public.end_own_introduction_v1(
                 (SELECT (substr(h, 1, 12) || '4' || substr(h, 14, 3) || '8' || substr(h, 18, 3) || substr(h, 21, 12))::uuid
                    FROM (SELECT encode(sha256(convert_to('QANDEEL_ACCT_DEL_01_INTRODUCTION_END_COMMAND_V1' || E'\n'
                                   || lower(p_deletion_id::text) || E'\n' || lower(v_world::text), 'UTF8')), 'hex') AS h) d),
                 v_world) e;
        PERFORM pg_catalog.set_config('request.jwt.claims', coalesce(v_claims, ''), true);
        PERFORM pg_catalog.set_config('request.jwt.claim.sub', coalesce(v_claim_sub, ''), true);
        IF v_outcome IS DISTINCT FROM 'ENDED' THEN
          RAISE EXCEPTION 'ACCOUNT_ERASURE_INTRODUCTION_END_REFUSED' USING ERRCODE = 'P0001';
        END IF;
        SELECT * INTO v_record FROM public.introduction_records r WHERE r.id = v_record.id;
      END IF;
      IF v_record.introduction_status <> 'CLOSED' THEN
        RAISE EXCEPTION 'ACCOUNT_ERASURE_CONTRADICTORY_INTRODUCTION' USING ERRCODE = 'P0001';
      END IF;
      SELECT * INTO v_match FROM public.matching_match_commits m WHERE m.id = v_record.match_commit_id;
      SELECT * INTO v_terminal FROM public.introduction_terminal_commits t WHERE t.introduction_record_id = v_record.id;
      IF v_match.id IS NULL OR v_terminal.id IS NULL THEN
        RAISE EXCEPTION 'ACCOUNT_ERASURE_CONTRADICTORY_INTRODUCTION' USING ERRCODE = 'P0001';
      END IF;

      -- P-2: the counterpart keeps their own words - a subset of their own frozen entitlement, nothing of this human's.
      INSERT INTO public.introduction_retained_views (world_id, user_id, membership_episode_id, matching_proposal_id, retained_at)
      SELECT ent.world_id, ent.user_id, ent.membership_episode_id, v_match.proposal_id, clock_timestamp()
        FROM public.introduction_closed_view_entitlements ent
       WHERE ent.world_id = v_world AND ent.user_id = v_other;
      IF FOUND THEN
        v_keeper := v_other;
        INSERT INTO public.introduction_retained_view_items (world_id, user_id, history_item_id)
        SELECT it.world_id, it.user_id, it.history_item_id
          FROM public.introduction_closed_view_entitlement_items it
          JOIN public.shared_world_materials m ON m.history_item_id = it.history_item_id AND m.world_id = it.world_id
         WHERE it.world_id = v_world AND it.user_id = v_other
           AND m.author_user_id = v_other AND m.producer_kind = 'HUMAN'
           AND m.material_kind IN ('HUMAN_TEXT', 'HUMAN_VOICE_NOTE');
      END IF;

      -- CW2-06: the counterpart's Matching lineage, proven now exactly as gate 7a-7c of 0117 proves it (the act their
      -- current state anchors on is the POST_* act this terminal commit wrote for them, or the ACTIVE_INTRODUCTION pause
      -- of this Match; the record is terminal; their claim from it is RELEASED), and frozen into a row they own.
      SELECT e.* INTO v_act
        FROM public.matching_participation_state s
        JOIN public.matching_participation_events e ON e.id = s.current_event_id
       WHERE s.participant_user_id = v_other;
      v_anchor := CASE
        WHEN v_act.resulting_state = 'PAUSED' AND v_act.resulting_pause_reason IN ('POST_INTRODUCTION', 'POST_SUCCESS') THEN v_act.id
        WHEN v_act.resulting_state = 'OFF' THEN v_act.prior_event_id END;
      IF v_anchor IS NOT NULL
         AND ((v_terminal.lower_user_id = v_other AND v_terminal.lower_participation_event_id = v_anchor)
           OR (v_terminal.higher_user_id = v_other AND v_terminal.higher_participation_event_id = v_anchor)
           OR (v_match.first_recipient_user_id = v_other AND v_match.first_recipient_pause_event_id = v_anchor)
           OR (v_match.candidate_user_id = v_other AND v_match.candidate_pause_event_id = v_anchor))
         AND EXISTS (SELECT 1 FROM public.matching_active_introduction_claims c
                      WHERE c.id = CASE WHEN v_other = v_terminal.lower_user_id THEN v_terminal.lower_claim_id
                                        ELSE v_terminal.higher_claim_id END
                        AND c.user_id = v_other AND c.introduction_record_id = v_record.id
                        AND c.claim_state = 'RELEASED') THEN
        INSERT INTO public.matching_counterpart_erasure_releases (anchor_event_id, participant_user_id, released_at)
        VALUES (v_anchor, v_other, clock_timestamp());
      END IF;
      -- A counterpart who already reactivated across this lineage keeps the audit of why, without this human.
      INSERT INTO public.matching_counterpart_erasure_reactivation_commands
        (id, participant_user_id, released_anchor_event_id, prior_participation_event_id, participation_event_id,
         reactivation_act, committed_at)
      SELECT c.id, c.participant_user_id, NULL, c.prior_participation_event_id, c.participation_event_id,
             c.reactivation_act, c.committed_at
        FROM public.matching_introduction_reactivation_commands c
       WHERE c.terminal_commit_id = v_terminal.id AND c.participant_user_id = v_other;
      DELETE FROM public.matching_introduction_reactivation_commands c WHERE c.terminal_commit_id = v_terminal.id;

      -- Photos of both humans in this World (the counterpart's were shown only to this human): renditions leave through
      -- the frozen 0162 retirement, which queues each storage key (a pending upload after its deadline); this request
      -- tracks every key it queued until the worker proves the object gone.
      INSERT INTO account_erasure_private.media_pending (deletion_id, storage_key)
      SELECT p_deletion_id, r.storage_key
        FROM introduction_sharing_private.image_renditions r
        JOIN introduction_sharing_private.image_series s ON s.id = r.series_id
       WHERE s.world_id = v_world
      ON CONFLICT DO NOTHING;
      FOR v_series IN SELECT s.id FROM introduction_sharing_private.image_series s WHERE s.world_id = v_world ORDER BY s.id LOOP
        v_keys := v_keys + introduction_sharing_private.retire_image_series_v1(v_series, false);
      END LOOP;
      -- (retirement removed every rendition; this states it, and fails nothing)
      DELETE FROM introduction_sharing_private.image_renditions r
       USING introduction_sharing_private.image_series s WHERE r.series_id = s.id AND s.world_id = v_world;
      DELETE FROM introduction_sharing_private.image_stage_disclosures d
       USING introduction_sharing_private.image_series s WHERE d.series_id = s.id AND s.world_id = v_world;
      DELETE FROM introduction_sharing_private.image_series s WHERE s.world_id = v_world;
      DELETE FROM introduction_sharing_private.name_display_state st WHERE st.world_id = v_world;
      DELETE FROM introduction_sharing_private.name_display_events e WHERE e.world_id = v_world;

      -- Every disclosure in this World, both directions: each names this human as owner or as its only audience.
      DELETE FROM public.introduction_disclosure_commands c WHERE c.world_id = v_world;
      DELETE FROM public.introduction_disclosure_granted_events g WHERE g.world_id = v_world;
      DELETE FROM public.introduction_disclosure_text_payloads tp
       USING public.introduction_disclosure_resource_versions rv WHERE tp.resource_version_id = rv.id AND rv.world_id = v_world;
      DELETE FROM public.introduction_disclosure_media_payloads mp
       USING public.introduction_disclosure_resource_versions rv WHERE mp.resource_version_id = rv.id AND rv.world_id = v_world;
      DELETE FROM public.introduction_disclosure_resource_versions rv WHERE rv.world_id = v_world;

      -- The terminal, SUCCESS, entitlement and birth rows of this Record, then the Match / Record / claims / handoff
      -- cycle in one statement (each references another, so no single order exists).
      DELETE FROM public.introduction_terminal_commits t WHERE t.introduction_record_id = v_record.id;
      DELETE FROM public.introduction_completed_events x WHERE x.introduction_record_id = v_record.id;
      DELETE FROM public.introduction_ended_events x WHERE x.introduction_record_id = v_record.id;
      DELETE FROM public.introduction_success_approval_state s
       USING public.introduction_success_transition_versions v
       WHERE s.transition_version_id = v.id AND v.introduction_record_id = v_record.id;
      DELETE FROM public.introduction_success_approval_events e
       USING public.introduction_success_transition_versions v
       WHERE e.transition_version_id = v.id AND v.introduction_record_id = v_record.id;
      DELETE FROM public.introduction_success_required_approvers a
       USING public.introduction_success_transition_versions v
       WHERE a.transition_version_id = v.id AND v.introduction_record_id = v_record.id;
      DELETE FROM public.introduction_success_transition_versions v WHERE v.introduction_record_id = v_record.id;
      DELETE FROM public.introduction_closed_view_entitlement_items it WHERE it.world_id = v_world;
      DELETE FROM public.introduction_closed_view_entitlements ent WHERE ent.world_id = v_world;
      DELETE FROM public.shared_world_matching_birth_events b WHERE b.introduction_record_id = v_record.id;
      DELETE FROM public.shared_world_introduction_started_events s WHERE s.introduction_record_id = v_record.id;
      DELETE FROM public.matching_match_handoff_fields f
       USING public.matching_match_handoff_package_versions p
       WHERE f.package_version_id = p.id AND p.introduction_record_id = v_record.id;
      DELETE FROM public.matching_match_handoff_subjects s
       USING public.matching_match_handoff_package_versions p
       WHERE s.package_version_id = p.id AND p.introduction_record_id = v_record.id;
      DELETE FROM public.matching_match_competing_cancellations c WHERE c.match_commit_id = v_match.id;
      WITH commits AS (DELETE FROM public.matching_match_commits m WHERE m.id = v_match.id RETURNING m.id),
           records AS (DELETE FROM public.introduction_records r WHERE r.id = v_record.id RETURNING r.id),
           claims AS (DELETE FROM public.matching_active_introduction_claims c
                       WHERE c.introduction_record_id = v_record.id RETURNING c.id),
           handoffs AS (DELETE FROM public.matching_match_handoff_package_versions p
                         WHERE p.introduction_record_id = v_record.id RETURNING p.id)
      SELECT NULL INTO v_outcome
        FROM (SELECT count(*) FROM commits) a, (SELECT count(*) FROM records) b,
             (SELECT count(*) FROM claims) c, (SELECT count(*) FROM handoffs) d;
    ELSE
      -- This human was the counterpart of an earlier erasure: their own retained view goes.
      DELETE FROM public.introduction_retained_view_items it WHERE it.world_id = v_world AND it.user_id = p_user;
      DELETE FROM public.introduction_retained_views rv WHERE rv.world_id = v_world AND rv.user_id = p_user;
    END IF;

    -- The World's material: everything but the words of the human who keeps a retained view of it.
    v_materials := ARRAY(
      SELECT m.id FROM public.shared_world_materials m
       WHERE m.world_id = v_world
         AND NOT (v_keeper IS NOT NULL AND m.author_user_id = v_keeper AND m.producer_kind = 'HUMAN'
                  AND m.material_kind IN ('HUMAN_TEXT', 'HUMAN_VOICE_NOTE')));
    v_items := ARRAY(SELECT m.history_item_id FROM public.shared_world_materials m WHERE m.id = ANY (v_materials));
    DELETE FROM public.shared_world_material_dependencies d
     WHERE d.world_id = v_world AND (d.source_material_id = ANY (v_materials) OR d.target_material_id = ANY (v_materials));
    DELETE FROM public.shared_world_material_delete_commands c WHERE c.material_id = ANY (v_materials);
    DELETE FROM public.shared_world_material_deleted_events e WHERE e.material_id = ANY (v_materials);
    DELETE FROM public.shared_world_material_commit_commands c WHERE c.material_id = ANY (v_materials);
    DELETE FROM public.shared_world_material_historical_authority a WHERE a.material_id = ANY (v_materials);
    DELETE FROM public.shared_world_qandeel_material_evidence e WHERE e.material_id = ANY (v_materials);
    DELETE FROM public.shared_world_text_material_bodies b WHERE b.material_id = ANY (v_materials);
    DELETE FROM public.shared_world_voice_note_material_bodies b WHERE b.material_id = ANY (v_materials);
    DELETE FROM public.shared_world_materials m WHERE m.id = ANY (v_materials);
    -- This human's audience and approver rows on the words that stay, and every row of the items that go.
    DELETE FROM public.shared_world_history_item_baseline_viewers b
     WHERE b.history_item_id = ANY (v_items)
        OR (b.user_id = p_user
            AND b.history_item_id IN (SELECT i.id FROM public.shared_world_history_items i WHERE i.world_id = v_world));
    DELETE FROM public.shared_world_history_item_required_approvers a
     WHERE a.history_item_id = ANY (v_items)
        OR (a.approver_user_id = p_user
            AND a.history_item_id IN (SELECT i.id FROM public.shared_world_history_items i WHERE i.world_id = v_world));
    DELETE FROM public.shared_world_history_items i WHERE i.id = ANY (v_items);
    DELETE FROM public.shared_world_membership_episodes e WHERE e.world_id = v_world AND e.user_id = p_user;

    -- Nobody is left in this World: its remaining contentless rows and the World itself go. Anything else that still
    -- references it keeps the bare World row (never an error).
    IF NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e WHERE e.world_id = v_world) THEN
      DELETE FROM public.shared_world_history_items i
       WHERE i.world_id = v_world
         AND NOT EXISTS (SELECT 1 FROM public.shared_world_materials m WHERE m.history_item_id = i.id);
      BEGIN
        DELETE FROM public.shared_worlds w WHERE w.id = v_world;
      EXCEPTION WHEN foreign_key_violation THEN
        NULL;
      END;
    END IF;
  END LOOP;

  -- Every pair of this human, matched or not: the proposals, their views and transitions, and what they were built on.
  v_pairs := ARRAY(SELECT p.id FROM public.matching_pairs p WHERE p_user IN (p.lower_user_id, p.higher_user_id));
  v_proposals := ARRAY(SELECT x.id FROM public.matching_proposals x WHERE x.pair_id = ANY (v_pairs));
  IF EXISTS (SELECT 1 FROM public.matching_match_commits m WHERE m.pair_id = ANY (v_pairs)) THEN
    RAISE EXCEPTION 'ACCOUNT_ERASURE_CONTRADICTORY_MATCH' USING ERRCODE = 'P0001';
  END IF;
  -- A competing Match elsewhere cancelled one of these proposals: only its private link to the cancelled proposal goes;
  -- that Match and every other proposal's transition stay exactly as they are.
  DELETE FROM public.matching_match_competing_cancellations c WHERE c.cancelled_proposal_id = ANY (v_proposals);
  DELETE FROM public.matching_forward_approval_view_bindings b WHERE b.proposal_id = ANY (v_proposals);
  DELETE FROM public.matching_proposal_decision_view_bindings b WHERE b.proposal_id = ANY (v_proposals);
  DELETE FROM public.matching_proposal_delivery_view_bindings b WHERE b.proposal_id = ANY (v_proposals);
  DELETE FROM public.matching_recipient_proposal_view_state s WHERE s.proposal_id = ANY (v_proposals);
  DELETE FROM public.matching_recipient_proposal_view_fields f
   USING public.matching_recipient_proposal_views v WHERE f.view_id = v.id AND v.proposal_id = ANY (v_proposals);
  WITH views AS (DELETE FROM public.matching_recipient_proposal_views v WHERE v.proposal_id = ANY (v_proposals) RETURNING v.id),
       transitions AS (DELETE FROM public.matching_proposal_transitions t WHERE t.proposal_id = ANY (v_proposals) RETURNING t.id),
       proposals AS (DELETE FROM public.matching_proposals x WHERE x.id = ANY (v_proposals) RETURNING x.id)
  SELECT NULL INTO v_outcome
    FROM (SELECT count(*) FROM views) a, (SELECT count(*) FROM transitions) b, (SELECT count(*) FROM proposals) c;
  v_snapshots := ARRAY(SELECT s.id FROM public.matching_eligibility_snapshots s WHERE s.pair_id = ANY (v_pairs));
  v_candidates := ARRAY(SELECT c.id FROM public.matching_safe_conclusion_candidates c WHERE c.eligibility_snapshot_id = ANY (v_snapshots));
  DELETE FROM public.matching_sensitive_filter_refusals r WHERE r.conclusion_candidate_id = ANY (v_candidates);
  DELETE FROM public.matching_permitted_safe_conclusions c WHERE c.conclusion_candidate_id = ANY (v_candidates);
  DELETE FROM public.matching_safe_conclusion_candidates c WHERE c.id = ANY (v_candidates);
  DELETE FROM public.matching_private_reasoning_notes n WHERE n.eligibility_snapshot_id = ANY (v_snapshots);
  DELETE FROM public.matching_hard_requirement_results r WHERE r.eligibility_snapshot_id = ANY (v_snapshots);
  DELETE FROM public.matching_eligibility_snapshot_fact_bindings b WHERE b.eligibility_snapshot_id = ANY (v_snapshots);
  DELETE FROM public.matching_eligibility_snapshots s WHERE s.id = ANY (v_snapshots);
  DELETE FROM public.matching_pairs p WHERE p.id = ANY (v_pairs);

  -- This human's own Matching setup, and what they kept as somebody else's counterpart.
  DELETE FROM public.matching_counterpart_erasure_reactivation_commands c WHERE c.participant_user_id = p_user;
  DELETE FROM public.matching_counterpart_erasure_releases r WHERE r.participant_user_id = p_user;
  DELETE FROM public.matching_introduction_reactivation_commands c WHERE c.participant_user_id = p_user;
  DELETE FROM public.introduction_retained_view_items it WHERE it.user_id = p_user;
  DELETE FROM public.introduction_retained_views rv WHERE rv.user_id = p_user;
  DELETE FROM public.matching_participation_state s WHERE s.participant_user_id = p_user;
  DELETE FROM public.matching_participation_events e WHERE e.participant_user_id = p_user;
  DELETE FROM public.matching_context_consent_events e WHERE e.grantor_user_id = p_user;
  DELETE FROM public.matching_context_grants g WHERE g.grantor_user_id = p_user;
  DELETE FROM public.pre_match_disclosure_authority_events e WHERE e.grantor_user_id = p_user;
  DELETE FROM public.pre_match_disclosure_authority_fields f
   USING public.pre_match_disclosure_authorities a WHERE f.authority_id = a.id AND a.grantor_user_id = p_user;
  DELETE FROM public.pre_match_disclosure_authorities a WHERE a.grantor_user_id = p_user;
  DELETE FROM public.introduction_profile_state s WHERE s.owner_user_id = p_user;
  DELETE FROM public.introduction_profile_field_values v
   USING public.introduction_profile_versions p WHERE v.profile_version_id = p.id AND p.owner_user_id = p_user;
  DELETE FROM public.introduction_profile_versions p WHERE p.owner_user_id = p_user;
  DELETE FROM public.matching_requirement_state s WHERE s.owner_user_id = p_user;
  DELETE FROM public.matching_requirement_items i
   USING public.matching_requirement_versions v WHERE i.requirement_version_id = v.id AND v.owner_user_id = p_user;
  DELETE FROM public.matching_requirement_versions v WHERE v.owner_user_id = p_user;
  DELETE FROM public.matching_confirmed_fact_state s WHERE s.owner_user_id = p_user;
  DELETE FROM public.matching_confirmed_fact_versions v WHERE v.owner_user_id = p_user;
  DELETE FROM public.matching_setup_locks l WHERE l.user_id = p_user;
  RETURN v_keys;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. OUTCOMES. A RETRY or INTEGRITY answer keeps the request SCHEDULED under a bounded backoff on its lease; three
--    refusals in a row the census cannot explain become an honest BLOCKED (UNREGISTERED).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION account_erasure_private.record_outcome_v1(p_deletion_id uuid, p_outcome text, p_reason text, p_failure text)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_progress account_erasure_private.deletion_progress;
  v_backoff interval;
  v_answer text := p_outcome;
BEGIN
  INSERT INTO account_erasure_private.deletion_progress AS g (deletion_id, last_outcome)
  VALUES (p_deletion_id, 'PENDING')
  ON CONFLICT (deletion_id) DO UPDATE SET updated_at = g.updated_at
  RETURNING * INTO v_progress;
  IF p_outcome = 'RETRY' AND p_reason = 'CONTENTION' THEN
    v_progress.consecutive_contention := v_progress.consecutive_contention + 1;
    v_backoff := least(interval '15 minutes', interval '15 seconds' * power(2, least(v_progress.consecutive_contention - 1, 6)));
  ELSIF p_outcome = 'RETRY' THEN
    v_progress.consecutive_unexplained := v_progress.consecutive_unexplained + 1;
    v_backoff := interval '1 minute' * power(2, v_progress.consecutive_unexplained - 1);
    IF v_progress.consecutive_unexplained >= 3 THEN
      v_answer := 'BLOCKED';
    END IF;
  ELSE
    v_progress.integrity_failures := v_progress.integrity_failures + 1;
    v_backoff := least(interval '24 hours', interval '5 minutes' * power(2, least(v_progress.integrity_failures - 1, 9)));
  END IF;
  UPDATE account_erasure_private.deletion_progress g
     SET last_outcome = v_answer,
         residue_classes = CASE WHEN v_answer = 'BLOCKED' THEN ARRAY['UNREGISTERED'] ELSE g.residue_classes END,
         attempts = g.attempts + 1,
         consecutive_contention = CASE WHEN v_answer = 'BLOCKED' THEN 0 ELSE v_progress.consecutive_contention END,
         consecutive_unexplained = CASE WHEN v_answer = 'BLOCKED' THEN 0 ELSE v_progress.consecutive_unexplained END,
         integrity_failures = v_progress.integrity_failures,
         last_failure_class = CASE WHEN p_outcome = 'INTEGRITY' THEN left(p_failure, 2) ELSE g.last_failure_class END,
         updated_at = clock_timestamp()
   WHERE g.deletion_id = p_deletion_id;
  BEGIN
    IF v_answer = 'BLOCKED' THEN
      UPDATE personal_data_private.account_deletions d
         SET status = 'BLOCKED', blocked_at = clock_timestamp(), lease_until = NULL
       WHERE d.id = p_deletion_id AND d.status = 'SCHEDULED';
    ELSE
      UPDATE personal_data_private.account_deletions d
         SET lease_until = clock_timestamp() + v_backoff
       WHERE d.id = p_deletion_id AND d.status = 'SCHEDULED';
    END IF;
  EXCEPTION WHEN lock_not_available THEN
    -- The request is being acted on elsewhere (a cancellation): its claim lease stands, and the next pass judges it.
    NULL;
  END;
  RETURN v_answer;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. THE COORDINATOR.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION account_erasure_private.erase_account_v1(p_deletion_id uuid)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' SET lock_timeout = '2s' AS $$
DECLARE
  v_request personal_data_private.account_deletions;
  v_user uuid;
  v_worlds uuid[];
  v_humans uuid[];
  v_classes text[];
  v_outcome text;
  v_reason text;
  v_failure text;
  v_keys integer;
  v_personal text;
  v_pending integer;
BEGIN
  SELECT * INTO v_request FROM personal_data_private.account_deletions d WHERE d.id = p_deletion_id;
  IF v_request.id IS NULL THEN
    RETURN 'UNKNOWN';
  ELSIF v_request.status IN ('ERASED', 'COMPLETED') THEN
    -- An erased request's residual sweep before each provider removal attempt: exactly 0130's (ALREADY_ERASED).
    RETURN personal_data_private.erase_personal_account_v1(p_deletion_id);
  ELSIF v_request.status = 'CANCELLED' THEN
    RETURN 'CANCELLED';
  ELSIF v_request.status = 'BLOCKED' THEN
    RETURN 'BLOCKED';
  ELSIF v_request.final_at > clock_timestamp() THEN
    RETURN 'NOT_DUE';
  END IF;
  v_user := v_request.user_id;

  -- THE LOCKS, in the published order (Introduction family: World, Record, setup; Matching family: setup, proposals,
  -- pointers; the account family last: the account row, then the request). Taken outside the erasure subtransaction so
  -- they survive its rollback and the outcome is written under them.
  BEGIN
    v_worlds := account_erasure_private.introduction_worlds_v1(v_user);
    PERFORM 1 FROM public.shared_worlds w WHERE w.id = ANY (v_worlds) ORDER BY w.id FOR UPDATE;
    PERFORM 1 FROM public.introduction_records r WHERE r.world_id = ANY (v_worlds) ORDER BY r.id FOR UPDATE;
    v_humans := account_erasure_private.matching_humans_v1(v_user);
    PERFORM 1 FROM public.matching_setup_locks l WHERE l.user_id = ANY (v_humans) ORDER BY l.user_id FOR UPDATE;
    -- A Match, a SUCCESS or a new pair that committed while this waited moved the footprint: a later pass sees it whole.
    IF v_worlds IS DISTINCT FROM account_erasure_private.introduction_worlds_v1(v_user)
       OR v_humans IS DISTINCT FROM account_erasure_private.matching_humans_v1(v_user) THEN
      RAISE EXCEPTION 'ACCOUNT_ERASURE_FOOTPRINT_MOVED' USING ERRCODE = '55P03';
    END IF;
    PERFORM 1 FROM public.matching_proposals x
     WHERE x.pair_id IN (SELECT p.id FROM public.matching_pairs p WHERE v_user IN (p.lower_user_id, p.higher_user_id))
     ORDER BY x.id FOR UPDATE;
    PERFORM 1 FROM public.matching_participation_state s
     WHERE s.participant_user_id = ANY (v_humans) ORDER BY s.participant_user_id FOR UPDATE;
    PERFORM 1 FROM public.matching_active_introduction_claims c WHERE c.world_id = ANY (v_worlds) ORDER BY c.id FOR UPDATE;
    PERFORM 1 FROM public.users u WHERE u.id = v_user FOR UPDATE;
    SELECT * INTO v_request FROM personal_data_private.account_deletions d WHERE d.id = p_deletion_id FOR UPDATE;
  EXCEPTION WHEN lock_not_available OR deadlock_detected OR serialization_failure THEN
    RETURN account_erasure_private.record_outcome_v1(p_deletion_id, 'RETRY', 'CONTENTION', NULL);
  END;

  -- Judged again under the locks, exactly as 0130 judges it.
  IF v_request.status = 'CANCELLED' THEN
    RETURN 'CANCELLED';
  ELSIF v_request.status = 'BLOCKED' THEN
    RETURN 'BLOCKED';
  ELSIF v_request.status IN ('ERASED', 'COMPLETED') THEN
    RETURN personal_data_private.erase_personal_account_v1(p_deletion_id);
  ELSIF v_request.final_at > clock_timestamp() THEN
    RETURN 'NOT_DUE';
  END IF;
  INSERT INTO account_erasure_private.deletion_progress AS g (deletion_id, last_outcome)
  VALUES (p_deletion_id, 'PENDING')
  ON CONFLICT (deletion_id) DO NOTHING;

  -- THE RESIDUE CENSUS, read-only, before anything is touched. The account row is held FOR UPDATE, so no transaction
  -- can add a row that references it until this one ends: the census is exact. A class blocks while no module covers
  -- it (none does yet: ACCT-DEL-02 and Stage 7 own them, and cover a class in the same change as its module).
  v_classes := ARRAY(
    SELECT c.residue_class FROM unnest(account_erasure_private.residue_classes_v1(v_user, v_worlds)) AS c(residue_class)
      JOIN account_erasure_private.residue_class_coverage k ON k.residue_class = c.residue_class
     WHERE NOT k.covered ORDER BY 1);
  IF cardinality(v_classes) > 0 THEN
    UPDATE personal_data_private.account_deletions d
       SET status = 'BLOCKED', blocked_at = clock_timestamp(), lease_until = NULL
     WHERE d.id = p_deletion_id;
    UPDATE account_erasure_private.deletion_progress g
       SET last_outcome = 'BLOCKED', residue_classes = v_classes, attempts = g.attempts + 1,
           consecutive_contention = 0, consecutive_unexplained = 0, updated_at = clock_timestamp()
     WHERE g.deletion_id = p_deletion_id;
    RETURN 'BLOCKED';
  END IF;

  -- THE ERASURE: one subtransaction around every write, the unchanged 0130 call included.
  BEGIN
    INSERT INTO account_erasure_private.erasure_authorizations (transaction_id, deletion_id)
    VALUES (pg_catalog.txid_current(), p_deletion_id);
    PERFORM pg_catalog.set_config('qandeel.account_erasure', pg_catalog.txid_current()::text, true);
    v_keys := account_erasure_private.erase_matching_introductions_v1(p_deletion_id, v_user, v_worlds);
    IF account_erasure_private.module_residue_v1(v_user) THEN
      RAISE EXCEPTION 'ACCOUNT_ERASURE_MODULE_INCOMPLETE' USING ERRCODE = 'P0001';
    END IF;
    DELETE FROM account_erasure_private.erasure_authorizations a WHERE a.transaction_id = pg_catalog.txid_current();
    PERFORM pg_catalog.set_config('qandeel.account_erasure', '', true);
    v_personal := personal_data_private.erase_personal_account_v1(p_deletion_id);
    IF v_personal IS DISTINCT FROM 'ERASED' THEN
      -- 0130 rolled back only its own block and answered without raising: this undoes everything above with it.
      RAISE EXCEPTION 'ACCOUNT_ERASURE_PERSONAL_REFUSED' USING ERRCODE = 'P0001';
    END IF;
  EXCEPTION
    WHEN lock_not_available OR deadlock_detected OR serialization_failure THEN
      v_outcome := 'RETRY';
      v_reason := 'CONTENTION';
    WHEN foreign_key_violation THEN
      v_outcome := 'RETRY';
      v_reason := 'UNEXPLAINED_REFERENCE';
    WHEN OTHERS THEN
      IF SQLERRM = 'ACCOUNT_ERASURE_PERSONAL_REFUSED' THEN
        v_outcome := 'RETRY';
        v_reason := 'UNEXPLAINED_REFERENCE';
      ELSE
        v_outcome := 'INTEGRITY';
        v_failure := SQLSTATE;
      END IF;
  END;
  IF v_outcome IS NOT NULL THEN
    RETURN account_erasure_private.record_outcome_v1(p_deletion_id, v_outcome, v_reason, v_failure);
  END IF;

  SELECT count(*)::integer INTO v_pending FROM account_erasure_private.media_pending p WHERE p.deletion_id = p_deletion_id;
  UPDATE account_erasure_private.deletion_progress g
     SET last_outcome = 'ERASED', residue_classes = NULL, attempts = g.attempts + 1,
         consecutive_contention = 0, consecutive_unexplained = 0,
         erased_at = clock_timestamp(), media_keys = v_pending,
         media_erased_at = CASE WHEN v_pending = 0 THEN clock_timestamp() END, updated_at = clock_timestamp()
   WHERE g.deletion_id = p_deletion_id;
  RETURN 'ERASED';
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. RECOVERY (P-3). Each pass: a BLOCKED request whose recorded classes are all covered, or that never recorded one,
--    is judged again by the census; a clean one is re-armed with a fresh grace the owner can cancel.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION account_erasure_private.rearm_blocked_account_deletions_v1(p_limit integer)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_request personal_data_private.account_deletions;
  v_classes text[];
  v_rearmed integer := 0;
BEGIN
  FOR v_request IN
    SELECT d.* FROM personal_data_private.account_deletions d
      LEFT JOIN account_erasure_private.deletion_progress g ON g.deletion_id = d.id
     WHERE d.status = 'BLOCKED'
       AND (g.residue_classes IS NULL
            OR NOT EXISTS (SELECT 1 FROM unnest(g.residue_classes) AS c(residue_class)
                             JOIN account_erasure_private.residue_class_coverage k ON k.residue_class = c.residue_class
                            WHERE NOT k.covered))
     ORDER BY d.blocked_at NULLS FIRST, d.id
     LIMIT greatest(1, least(coalesce(p_limit, 1), 20))
       FOR UPDATE OF d SKIP LOCKED
  LOOP
    v_classes := account_erasure_private.residue_classes_v1(
      v_request.user_id, account_erasure_private.introduction_worlds_v1(v_request.user_id));
    INSERT INTO account_erasure_private.deletion_progress AS g (deletion_id, last_outcome)
    VALUES (v_request.id, 'BLOCKED')
    ON CONFLICT (deletion_id) DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM unnest(v_classes) AS c(residue_class)
                     JOIN account_erasure_private.residue_class_coverage k ON k.residue_class = c.residue_class
                    WHERE NOT k.covered) THEN
      UPDATE personal_data_private.account_deletions d
         SET status = 'SCHEDULED', final_at = clock_timestamp() + interval '7 days', lease_until = NULL
       WHERE d.id = v_request.id;
      UPDATE account_erasure_private.deletion_progress g
         SET last_outcome = 'REARMED', residue_classes = NULL, rearm_count = g.rearm_count + 1,
             rearmed_at = clock_timestamp(), consecutive_contention = 0, consecutive_unexplained = 0,
             updated_at = clock_timestamp()
       WHERE g.deletion_id = v_request.id;
      v_rearmed := v_rearmed + 1;
    ELSE
      UPDATE account_erasure_private.deletion_progress g
         SET last_outcome = 'BLOCKED', residue_classes = v_classes, updated_at = clock_timestamp()
       WHERE g.deletion_id = v_request.id;
    END IF;
  END LOOP;
  RETURN v_rearmed;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 9. EXTERNAL FILE ERASURE (P-3, level 2). The 0162 worker deletes a queue row only after DELETE and HEAD 404; this
--    request's last tracked key leaving is the proof its files are gone.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION account_erasure_private.settle_media_pending_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_deletions uuid[];
BEGIN
  WITH settled AS (
    DELETE FROM account_erasure_private.media_pending p WHERE p.storage_key = OLD.storage_key RETURNING p.deletion_id)
  SELECT array_agg(DISTINCT s.deletion_id) INTO v_deletions FROM settled s;
  IF v_deletions IS NOT NULL THEN
    UPDATE account_erasure_private.deletion_progress g
       SET media_erased_at = clock_timestamp(), updated_at = clock_timestamp()
     WHERE g.deletion_id = ANY (v_deletions) AND g.media_erased_at IS NULL AND g.erased_at IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM account_erasure_private.media_pending p WHERE p.deletion_id = g.deletion_id);
  END IF;
  RETURN OLD;
END$$;

CREATE TRIGGER account_erasure_media_settled
    AFTER DELETE ON introduction_sharing_private.media_erasure_queue
    FOR EACH ROW EXECUTE FUNCTION account_erasure_private.settle_media_pending_v1();

-- ---------------------------------------------------------------------------------------------------------------------
-- 10. THE COUNTERPART'S READERS (P-2): forward replacements; the retained view is accepted where the frozen
--     entitlement or Record was. Everything else in each body is unchanged.
-- ---------------------------------------------------------------------------------------------------------------------
-- (a) The ONE closed-history reader (0088 / 0115 / 0119): its READ_ONLY_CLOSED / INTRODUCTION branch also answers the
--     holder of a retained view - their own items, availability still dominating. The two sets never meet for one
--     (World, human): a retained view is written only as that human's frozen entitlement is removed.
CREATE OR REPLACE FUNCTION public.resolve_shared_world_closed_history_visibility_v1(p_world_id uuid, p_user_id uuid)
 RETURNS TABLE(world_id uuid, history_item_id uuid, occurred_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  world public.shared_worlds;
BEGIN
  IF p_world_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSURE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  IF world.lifecycle <> 'READ_ONLY_CLOSED' THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSED_VISIBILITY_UNSUPPORTED_WORLD_MODE' USING ERRCODE='0A000';
  END IF;
  -- READ_ONLY_CLOSED / INTRODUCTION: the exact Introduction closed-view
  -- entitlement snapshot migration 0116 froze at the terminal instant - or,
  -- after the other human's account erasure (ACCT-DEL-01, 0164), this human's
  -- retained view: the subset of that snapshot that is their own words.
  IF world.phase = 'INTRODUCTION' THEN
    RETURN QUERY
      SELECT i.world_id, i.id, i.occurred_at
        FROM public.introduction_closed_view_entitlement_items it
        JOIN public.shared_world_history_items i ON i.id = it.history_item_id
       WHERE it.world_id = p_world_id AND it.user_id = p_user_id
         AND i.availability_state = 'AVAILABLE'
      UNION ALL
      SELECT i.world_id, i.id, i.occurred_at
        FROM public.introduction_retained_view_items rv
        JOIN public.shared_world_history_items i ON i.id = rv.history_item_id
       WHERE rv.world_id = p_world_id AND rv.user_id = p_user_id
         AND i.availability_state = 'AVAILABLE'
       ORDER BY 3, 2;
    RETURN;
  END IF;
  IF world.phase <> 'STANDARD' THEN
    RAISE EXCEPTION 'SHARED_WORLD_CLOSED_VISIBILITY_UNSUPPORTED_WORLD_MODE' USING ERRCODE='0A000';
  END IF;
  -- READ_ONLY_CLOSED / STANDARD: the frozen I-04F snapshot, with exactly the
  -- same QAN-CW-REM-01 correction the ACTIVE branch of the entry point makes.
  --
  -- The snapshot is a flat (World, human, item) list: migration 0088 builds it
  -- through the ONE visibility entry point while the World is still ACTIVE, so an
  -- item widened by a grant BEFORE the authority behind it was corrected would
  -- otherwise be frozen into it and served forever. The basis is re-derived here
  -- from the item's own exact baseline audience - the entitlement snapshot keeps
  -- the temporal truth, so the audience row is the whole question and NO
  -- membership is consulted: closed viewing is entitlement, never membership.
  --
  -- The Introduction branch above needs none of this and deliberately gets none:
  -- its snapshot is written from the ACTIVE / INTRODUCTION branch of the entry
  -- point, which has no grant basis at all, so every item it can hold is already
  -- a baseline item of the human holding it.
  RETURN QUERY
    SELECT i.world_id, i.id, i.occurred_at
      FROM public.shared_world_standard_closed_view_entitlement_items it
      JOIN public.shared_world_history_items i ON i.id = it.history_item_id
     WHERE it.world_id = p_world_id AND it.user_id = p_user_id
       AND i.availability_state = 'AVAILABLE'
       AND (EXISTS (
              SELECT 1 FROM public.shared_world_history_item_baseline_viewers b
               WHERE b.history_item_id = i.id AND b.user_id = p_user_id)
         OR NOT EXISTS (
              SELECT 1 FROM public.shared_world_material_historical_authority a
               WHERE a.history_item_id = i.id
                 AND a.resolution_state = 'UNRESOLVED_ADDITIONAL_HUMAN_REQUIREMENT'))
     ORDER BY i.occurred_at, i.id;
END$function$;

-- (b) S6-05 CP4's closed-history reader (0161): the authority is the caller's own frozen entitlement, or - after the
--     other human's account erasure - the caller's own retained view. Nothing else changes.
CREATE OR REPLACE FUNCTION public.read_my_introduction_history_v1(
  p_world_id uuid, p_before_established_at timestamptz, p_before_material_id uuid, p_limit integer
) RETURNS TABLE(introduction_state text, material_id uuid, established_at timestamptz, is_self boolean, text_body text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 200
     OR ((p_before_established_at IS NULL) <> (p_before_material_id IS NULL)) THEN
    RAISE EXCEPTION 'INTRODUCTION_HISTORY_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  -- The caller's OWN frozen closed-view entitlement over an Introduction END closed, or no row - exactly as for an
  -- unknown World, before anything of the World is read. Membership is never consulted: it ended with the Introduction.
  PERFORM 1
     FROM public.introduction_closed_view_entitlements ent
     JOIN public.introduction_records r ON r.id = ent.introduction_record_id AND r.world_id = ent.world_id
     JOIN public.shared_worlds w ON w.id = ent.world_id
    WHERE ent.world_id = p_world_id AND ent.user_id = v_user
      AND r.introduction_status = 'CLOSED' AND w.lifecycle = 'READ_ONLY_CLOSED' AND w.phase = 'INTRODUCTION';
  IF NOT FOUND THEN
    -- ACCT-DEL-01 (0164): or the caller's own retained view, after the other human's account erasure.
    PERFORM 1
       FROM public.introduction_retained_views rv
       JOIN public.shared_worlds w ON w.id = rv.world_id
      WHERE rv.world_id = p_world_id AND rv.user_id = v_user
        AND w.lifecycle = 'READ_ONLY_CLOSED' AND w.phase = 'INTRODUCTION';
    IF NOT FOUND THEN
      RETURN;
    END IF;
  END IF;
  -- The frozen material resolver over the one historical entry point decides visibility: for this READ_ONLY_CLOSED
  -- Introduction, resolve_shared_world_closed_history_visibility_v1 - this caller's entitlement items, available now.
  -- Human words only: a deleted message has no body and is not shown; no QANDEEL, analysis or disclosure material.
  RETURN QUERY
    SELECT 'ENDED'::text, m.material_id, m.established_at, m.author_user_id = v_user, m.text_body
      FROM public.resolve_shared_world_material_v1(p_world_id, v_user) m
     WHERE m.material_kind = 'HUMAN_TEXT' AND m.author_user_id IS NOT NULL AND m.text_body IS NOT NULL
       AND (p_before_established_at IS NULL
            OR (m.established_at, m.material_id) < (p_before_established_at, p_before_material_id))
     ORDER BY m.established_at DESC, m.material_id DESC
     LIMIT p_limit;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'ENDED'::text, NULL::uuid, NULL::timestamptz, NULL::boolean, NULL::text;
  END IF;
END$$;

-- (c) S6-05 CP3's discovery (0160): the caller's retained views are listed too, ENDED, with the proposal identity they
--     already held and no name (the client's approved IW-11b «تعارف» covers a name it is not given).
CREATE OR REPLACE FUNCTION public.list_my_introduction_worlds_v1()
RETURNS TABLE(world_id uuid, matching_proposal_id uuid, introduction_state text, other_first_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  -- One of the Record's two humans, a Record bound to its own Match commit and World, and the World still an
  -- Introduction (live, or closed by END). A World SUCCESS made Standard is a Stage 4 World and is not listed here.
  -- ACCT-DEL-01 (0164): and every Introduction the caller keeps a retained view of, ENDED, after the other human's
  -- account erasure - in the same newest-first order, by the instant the World was born.
  RETURN QUERY
    SELECT l.world_id, l.matching_proposal_id, l.introduction_state, l.other_first_name
      FROM (
        SELECT r.world_id, c.proposal_id AS matching_proposal_id,
               CASE WHEN r.introduction_status = 'ACTIVE' THEN 'ACTIVE' ELSE 'ENDED' END AS introduction_state,
               shared_private.shared_person_name_v1(
                 r.world_id, CASE WHEN r.lower_user_id = v_user THEN r.higher_user_id ELSE r.lower_user_id END, v_user)
                 AS other_first_name,
               r.started_at AS listed_at
          FROM public.introduction_records r
          JOIN public.matching_match_commits c ON c.id = r.match_commit_id AND c.world_id = r.world_id
          JOIN public.shared_worlds w ON w.id = r.world_id
         WHERE v_user IN (r.lower_user_id, r.higher_user_id)
           AND w.phase = 'INTRODUCTION'
           AND ((r.introduction_status = 'ACTIVE' AND w.lifecycle = 'ACTIVE')
             OR (r.introduction_status = 'CLOSED' AND w.lifecycle = 'READ_ONLY_CLOSED'))
        UNION ALL
        SELECT rv.world_id, rv.matching_proposal_id, 'ENDED', NULL::text, w.born_at
          FROM public.introduction_retained_views rv
          JOIN public.shared_worlds w ON w.id = rv.world_id
         WHERE rv.user_id = v_user AND w.phase = 'INTRODUCTION' AND w.lifecycle = 'READ_ONLY_CLOSED'
      ) l
     ORDER BY l.listed_at DESC, l.world_id;
END$$;

-- (d) S6-05 CP3's live reader (0160): a retained view is an ended Introduction of the caller, answered exactly as after
--     END (one empty ENDED row), so the client opens the closed history.
CREATE OR REPLACE FUNCTION public.read_my_introduction_messages_v1(
  p_world_id uuid, p_before_established_at timestamptz, p_before_material_id uuid, p_limit integer
) RETURNS TABLE(introduction_state text, material_id uuid, established_at timestamptz, is_self boolean, text_body text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_status text;
  v_lifecycle text;
  v_phase text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 200
     OR ((p_before_established_at IS NULL) <> (p_before_material_id IS NULL)) THEN
    RAISE EXCEPTION 'INTRODUCTION_MESSAGE_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  -- Not one of the World's two humans: no row, exactly as for an unknown World, before anything of the World is read.
  SELECT r.introduction_status, w.lifecycle, w.phase INTO v_status, v_lifecycle, v_phase
    FROM public.introduction_records r
    JOIN public.shared_worlds w ON w.id = r.world_id
   WHERE r.world_id = p_world_id AND v_user IN (r.lower_user_id, r.higher_user_id);
  IF NOT FOUND THEN
    -- ACCT-DEL-01 (0164): the holder of a retained view is told the Introduction ended, and nothing else.
    IF EXISTS (SELECT 1 FROM public.introduction_retained_views rv
                 JOIN public.shared_worlds w ON w.id = rv.world_id
                WHERE rv.world_id = p_world_id AND rv.user_id = v_user
                  AND w.lifecycle = 'READ_ONLY_CLOSED' AND w.phase = 'INTRODUCTION') THEN
      RETURN QUERY SELECT 'ENDED'::text, NULL::uuid, NULL::timestamptz, NULL::boolean, NULL::text;
    END IF;
    RETURN;
  END IF;
  -- Ended by END: the member is told so, and nothing else. The closed history is a separate read (CP4).
  IF v_status = 'CLOSED' AND v_lifecycle = 'READ_ONLY_CLOSED' AND v_phase = 'INTRODUCTION' THEN
    RETURN QUERY SELECT 'ENDED'::text, NULL::uuid, NULL::timestamptz, NULL::boolean, NULL::text;
    RETURN;
  END IF;
  -- No longer an Introduction (SUCCESS made it Standard), or a Record and World that disagree: no row, fail closed.
  IF NOT (v_status = 'ACTIVE' AND v_lifecycle = 'ACTIVE' AND v_phase = 'INTRODUCTION') THEN
    RETURN;
  END IF;
  -- The frozen material resolver decides visibility (the 0115 ACTIVE / INTRODUCTION branch: exactly the two humans).
  -- Human words only: a deleted message has no body and is not shown; no QANDEEL, analysis or disclosure material.
  RETURN QUERY
    SELECT 'ACTIVE'::text, m.material_id, m.established_at, m.author_user_id = v_user, m.text_body
      FROM public.resolve_shared_world_material_v1(p_world_id, v_user) m
     WHERE m.material_kind = 'HUMAN_TEXT' AND m.author_user_id IS NOT NULL AND m.text_body IS NOT NULL
       AND (p_before_established_at IS NULL
            OR (m.established_at, m.material_id) < (p_before_established_at, p_before_material_id))
     ORDER BY m.established_at DESC, m.material_id DESC
     LIMIT p_limit;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'ACTIVE'::text, NULL::uuid, NULL::timestamptz, NULL::boolean, NULL::text;
  END IF;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 11. THE REACTIVATION CORE (CW2-06; P-4): 0117's boundary, forward. Gate 7a also accepts the counterpart-erasure
--     release of the exact anchor (7b and 7c were proven when it was written), and that reactivation is recorded in the
--     sibling relation; both idempotency passes read both relations. Everything else is 0117's, byte for byte.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reactivate_matching_after_introduction_v1(
  p_command_id uuid, p_participation_event_id uuid, p_expected_current_event_id uuid,
  p_entry_channel text DEFAULT NULL
) RETURNS TABLE(outcome text, reactivation_command_id uuid, participation_event_id uuid,
                participation_act text, participation_state text, superseded_event_id uuid,
                reactivated_from_record_id uuid, reactivated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.matching_introduction_reactivation_commands;
  locked uuid;
  setup record;
  gate record;
  current_id uuid;
  current_act public.matching_participation_events;
  anchor uuid;
  terminal public.introduction_terminal_commits;
  claim_id uuid;
  record_status text;
  act text;
  channel text;
  reactivate_at timestamptz;
  released boolean := false;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_participation_event_id IS NULL OR p_expected_current_event_id IS NULL
     OR p_command_id = p_participation_event_id THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, over immutable columns
  -- only, so an equivalent retry is answered from history even after the human
  -- has paused or turned Matching off again.
  --
  -- THE COMMAND IDENTITY BINDS THE WHOLE IMMUTABLE REQUEST, THE ENTRY CHANNEL
  -- INCLUDED. The channel is activation PROVENANCE, and provenance that a retry
  -- could silently restate is not provenance at all: without this, a committed
  -- MANUAL_MY_WORLD_ENTRY could be retried as a CONVERSATIONAL_ENTRY and be told
  -- it succeeded, and a committed RESUME - which carries no channel - could be
  -- retried as though it had been an entry. Both would be answered here, BEFORE
  -- the channel is ever validated below, so the validation could not catch them.
  --
  -- It is compared against the exact immutable participation event this command
  -- PRODUCED rather than against a second copy stored beside it: the event is
  -- already the canonical record of what happened, a RESTRICT foreign key keeps
  -- it reachable for as long as the command exists, and one truth cannot drift
  -- from itself. A retry that names a different channel is therefore a different
  -- request wearing a used command id, and it is refused rather than reinterpreted.
  SELECT * INTO committed FROM (
      SELECT c.id, c.participant_user_id, c.terminal_commit_id, c.introduction_record_id, c.released_claim_id,
             c.prior_participation_event_id, c.participation_event_id, c.reactivation_act, c.committed_at
        FROM public.matching_introduction_reactivation_commands c
      UNION ALL
      SELECT x.id, x.participant_user_id, NULL::uuid, NULL::uuid, NULL::uuid,
             x.prior_participation_event_id, x.participation_event_id, x.reactivation_act, x.committed_at
        FROM public.matching_counterpart_erasure_reactivation_commands x) c
   WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.participant_user_id = u
       AND committed.participation_event_id = p_participation_event_id
       AND committed.prior_participation_event_id = p_expected_current_event_id
       AND EXISTS (SELECT 1 FROM public.matching_participation_events e
                    WHERE e.id = committed.participation_event_id
                      AND e.activation_entry_channel IS NOT DISTINCT FROM p_entry_channel) THEN
      RETURN QUERY SELECT 'MATCHING_REACTIVATED'::text, committed.id, committed.participation_event_id,
                          committed.reactivation_act, 'ACTIVE'::text,
                          committed.prior_participation_event_id, committed.introduction_record_id,
                          committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_REACTIVATION_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, STEP A: the caller's own Matching serialization row,
  -- through the same upsert-and-lock statement every I-07A command uses. This
  -- is a ONE-HUMAN act and takes no Shared World lock and no second human's.
  INSERT INTO public.matching_setup_locks AS l (user_id) VALUES (u)
  ON CONFLICT (user_id) DO UPDATE SET created_at = l.created_at
  RETURNING l.user_id INTO locked;

  SELECT * INTO committed FROM (
      SELECT c.id, c.participant_user_id, c.terminal_commit_id, c.introduction_record_id, c.released_claim_id,
             c.prior_participation_event_id, c.participation_event_id, c.reactivation_act, c.committed_at
        FROM public.matching_introduction_reactivation_commands c
      UNION ALL
      SELECT x.id, x.participant_user_id, NULL::uuid, NULL::uuid, NULL::uuid,
             x.prior_participation_event_id, x.participation_event_id, x.reactivation_act, x.committed_at
        FROM public.matching_counterpart_erasure_reactivation_commands x) c
   WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.participant_user_id = u
       AND committed.participation_event_id = p_participation_event_id
       AND committed.prior_participation_event_id = p_expected_current_event_id
       AND EXISTS (SELECT 1 FROM public.matching_participation_events e
                    WHERE e.id = committed.participation_event_id
                      AND e.activation_entry_channel IS NOT DISTINCT FROM p_entry_channel) THEN
      RETURN QUERY SELECT 'MATCHING_REACTIVATED'::text, committed.id, committed.participation_event_id,
                          committed.reactivation_act, 'ACTIVE'::text,
                          committed.prior_participation_event_id, committed.introduction_record_id,
                          committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'MATCHING_REACTIVATION_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, STEP B: the caller's own current participation
  -- pointer, with the exact stale token they acted on.
  SELECT s.current_event_id INTO current_id
    FROM public.matching_participation_state s WHERE s.participant_user_id = u FOR UPDATE;
  IF current_id IS DISTINCT FROM p_expected_current_event_id THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_STALE_STATE' USING ERRCODE='40001';
  END IF;
  SELECT * INTO current_act FROM public.matching_participation_events e WHERE e.id = current_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- GATE 1. THE CURRENT STATE IS ONE OF THE EXACT THREE THE LIFECYCLE PRODUCES,
  -- and the ANCHOR is the exact act whose lineage must be proven.
  IF current_act.resulting_state = 'PAUSED'
     AND current_act.resulting_pause_reason IN ('POST_INTRODUCTION', 'POST_SUCCESS') THEN
    act := 'RESUME';
    anchor := current_act.id;
  ELSIF current_act.resulting_state = 'OFF' AND current_act.prior_event_id IS NOT NULL THEN
    act := 'ACTIVATE';
    anchor := current_act.prior_event_id;
  ELSE
    RAISE EXCEPTION 'MATCHING_REACTIVATION_NOT_ELIGIBLE' USING ERRCODE='55000',
      DETAIL='This boundary reactivates exactly a post-Introduction pause or an explicit OFF that descends from one. Every other participation state uses its own frozen I-07A command.';
  END IF;
  -- The entry channel is provenance of an ACTIVATION and of nothing else: a
  -- resume is not a fresh entry and carries none.
  IF act = 'ACTIVATE' THEN
    IF p_entry_channel IS NULL OR p_entry_channel NOT IN ('CONVERSATIONAL_ENTRY', 'MANUAL_MY_WORLD_ENTRY') THEN
      RAISE EXCEPTION 'MATCHING_REACTIVATION_ENTRY_CHANNEL_INVALID' USING ERRCODE='22023';
    END IF;
    channel := p_entry_channel;
  ELSE
    IF p_entry_channel IS NOT NULL THEN
      RAISE EXCEPTION 'MATCHING_REACTIVATION_ENTRY_CHANNEL_INVALID' USING ERRCODE='22023';
    END IF;
    channel := NULL;
  END IF;

  -- GATE 7a. THE EXACT IMMUTABLE LINEAGE. Either the anchor IS the POST_* act a
  -- terminal commit wrote for this exact human, or it is the exact
  -- ACTIVE_INTRODUCTION pause of a Match whose Introduction later reached a
  -- terminal outcome. No timestamp is compared and no set is searched for a
  -- best candidate.
  SELECT * INTO terminal FROM public.introduction_terminal_commits t
   WHERE (t.lower_user_id = u AND t.lower_participation_event_id = anchor)
      OR (t.higher_user_id = u AND t.higher_participation_event_id = anchor);
  IF NOT FOUND THEN
    SELECT t.* INTO terminal
      FROM public.matching_match_commits m
      JOIN public.introduction_terminal_commits t ON t.match_commit_id = m.id
     WHERE (m.first_recipient_user_id = u AND m.first_recipient_pause_event_id = anchor)
        OR (m.candidate_user_id = u AND m.candidate_pause_event_id = anchor);
  END IF;
  -- ACCT-DEL-01 (0164): or the exact anchor was released when the other human's account was erased - 7a, 7b and 7c
  -- were proven then, under that erasure's locks, against the very rows it removed (CW2-06: the lineage is exact
  -- immutable identity, frozen before deletion rather than re-read).
  IF NOT FOUND THEN
    PERFORM 1 FROM public.matching_counterpart_erasure_releases x
     WHERE x.anchor_event_id = anchor AND x.participant_user_id = u;
    released := FOUND;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_NOT_ELIGIBLE' USING ERRCODE='55000',
      DETAIL='This participation state does not descend from an exact terminal Introduction of this human. Reactivation is never inferred from time or from a latest record.';
  END IF;

  -- GATE 7b. THE PRIOR INTRODUCTION RECORD IS TERMINAL, read live rather than
  -- assumed from the commit that wrote it.
  IF NOT released THEN
  SELECT r.introduction_status INTO record_status
    FROM public.introduction_records r WHERE r.id = terminal.introduction_record_id;
  IF record_status IS NULL OR record_status NOT IN ('COMPLETED', 'CLOSED') THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- GATE 7c. THIS HUMAN'S EXACT CLAIM FROM THAT EXACT INTRODUCTION IS RELEASED.
  claim_id := CASE WHEN u = terminal.lower_user_id THEN terminal.lower_claim_id
                   ELSE terminal.higher_claim_id END;
  IF NOT EXISTS (SELECT 1 FROM public.matching_active_introduction_claims c
                  WHERE c.id = claim_id AND c.user_id = u
                    AND c.introduction_record_id = terminal.introduction_record_id
                    AND c.claim_state = 'RELEASED') THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  END IF;

  -- GATE 5. NO HELD ACTIVE-INTRODUCTION CLAIM AT ALL, for this human, from any
  -- Introduction. A human occupied by a live Introduction never re-enters
  -- candidate work.
  IF EXISTS (SELECT 1 FROM public.matching_active_introduction_claims c
              WHERE c.user_id = u AND c.claim_state = 'HELD') THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_NOT_ELIGIBLE' USING ERRCODE='55000',
      DETAIL='This human still holds an active-Introduction claim.';
  END IF;

  -- GATE 6. THE CANONICAL ACTIVE-INTRODUCTION TRUTH, consumed rather than
  -- re-implemented: an open membership episode in an ACTIVE / INTRODUCTION
  -- Shared World.
  IF (SELECT a.has_active_introduction FROM public.resolve_matching_active_introduction_v1(u) a) THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_NOT_ELIGIBLE' USING ERRCODE='55000',
      DETAIL='This human currently holds an active Introduction.';
  END IF;

  -- GATES 2, 3 and 4. THE CURRENT MATCHING SETUP, through the ONE canonical
  -- I-07B entry point into the sealed I-07A state rather than a second copy of
  -- its logic. A grant revoked during the Introduction is NOT restored by
  -- reactivating, and a missing profile or requirement version fails closed.
  SELECT * INTO setup FROM public.resolve_matching_setup_state_v1(u);
  IF setup.matching_context_grant_id IS NULL
     OR setup.introduction_profile_version_id IS NULL
     OR setup.matching_requirement_version_id IS NULL THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_NOT_ELIGIBLE' USING ERRCODE='55000',
      DETAIL='Reactivation requires a current Matching Context Grant, a current Introduction Profile and a current Matching Requirements version. Matching setup is preserved across an Introduction; it is not restored by one.';
  END IF;
  -- The canonical resolver and this transaction must agree about the exact act
  -- being superseded. They read the same pointer under the same lock, so a
  -- disagreement is an impossible state rather than a refusal.
  IF setup.participation_event_id IS DISTINCT FROM current_id THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- GATE 8. THE CW2-08 PREREQUISITE, LAST - after every participation,
  -- authority, claim and lineage gate above.
  SELECT * INTO gate FROM public.resolve_matching_reactivation_prerequisites_v1(u);
  IF gate.clearance <> 'CLEARED' THEN
    RAISE EXCEPTION 'MATCHING_REACTIVATION_PREREQUISITE_UNRESOLVED' USING ERRCODE='55000',
      DETAIL='Post-Introduction Matching reactivation requires the CW2-08 system/safety prerequisite to be CLEARED. It is not, and reactivation fails closed.';
  END IF;

  reactivate_at := clock_timestamp();

  BEGIN
    -- THE ONE EFFECT: one participation act and the pointer that names it.
    INSERT INTO public.matching_participation_events
      (id, participant_user_id, participation_act, resulting_state, resulting_pause_reason,
       activation_entry_channel, prior_event_id, occurred_at)
    VALUES (p_participation_event_id, u, act, 'ACTIVE', NULL, channel, current_id, reactivate_at);

    UPDATE public.matching_participation_state s
       SET current_event_id = p_participation_event_id, updated_at = reactivate_at
     WHERE s.participant_user_id = u AND s.current_event_id = current_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'MATCHING_REACTIVATION_STALE_STATE' USING ERRCODE='40001';
    END IF;

    IF released THEN
      INSERT INTO public.matching_counterpart_erasure_reactivation_commands
        (id, participant_user_id, released_anchor_event_id, prior_participation_event_id, participation_event_id,
         reactivation_act, committed_at)
      VALUES (p_command_id, u, anchor, current_id, p_participation_event_id, act, reactivate_at);
    ELSE
    INSERT INTO public.matching_introduction_reactivation_commands
      (id, participant_user_id, terminal_commit_id, introduction_record_id, released_claim_id,
       prior_participation_event_id, participation_event_id, reactivation_act, committed_at)
    VALUES (p_command_id, u, terminal.id, terminal.introduction_record_id, claim_id,
            current_id, p_participation_event_id, act, reactivate_at);
    END IF;
  EXCEPTION WHEN unique_violation THEN
    -- A supplied persistence identity was already taken, or this exact lineage
    -- was already crossed. The whole reactivation rolls back together.
    RAISE EXCEPTION 'MATCHING_REACTIVATION_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'MATCHING_REACTIVATED'::text, p_command_id, p_participation_event_id,
                      act, 'ACTIVE'::text, current_id, terminal.introduction_record_id, reactivate_at;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 12. THE SERVER SURFACE (service_role only) AND THE OPERATIONS SUMMARY.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.server_erase_account_v1(p_deletion_id uuid)
RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$ SELECT account_erasure_private.erase_account_v1(p_deletion_id); $$;

CREATE FUNCTION public.server_rearm_blocked_account_deletions_v1(p_limit integer)
RETURNS integer
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$ SELECT account_erasure_private.rearm_blocked_account_deletions_v1(p_limit); $$;

-- Counts and ages only - never a request, an account, a key or a SQLSTATE.
CREATE FUNCTION public.server_read_account_erasure_operations_v1()
RETURNS TABLE (
    blocked_shared_standard integer,
    blocked_public integer,
    blocked_replay integer,
    blocked_unregistered integer,
    blocked_unclassified integer,
    retrying integer,
    integrity_holding integer,
    media_pending integer,
    media_pending_oldest_age_seconds bigint,
    uncovered_classes integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    WITH blocked AS (
        SELECT d.id, g.residue_classes
          FROM personal_data_private.account_deletions d
          LEFT JOIN account_erasure_private.deletion_progress g ON g.deletion_id = d.id
         WHERE d.status = 'BLOCKED'
    ), scheduled AS (
        SELECT g.last_outcome
          FROM personal_data_private.account_deletions d
          JOIN account_erasure_private.deletion_progress g ON g.deletion_id = d.id
         WHERE d.status = 'SCHEDULED'
    ), media AS (
        SELECT count(*)::integer AS pending, min(g.erased_at) AS oldest
          FROM account_erasure_private.deletion_progress g
         WHERE g.erased_at IS NOT NULL AND g.media_erased_at IS NULL
    )
    SELECT (SELECT count(*) FROM blocked b WHERE 'SHARED_STANDARD' = ANY (b.residue_classes))::integer,
           (SELECT count(*) FROM blocked b WHERE 'PUBLIC' = ANY (b.residue_classes))::integer,
           (SELECT count(*) FROM blocked b WHERE 'REPLAY' = ANY (b.residue_classes))::integer,
           (SELECT count(*) FROM blocked b WHERE 'UNREGISTERED' = ANY (b.residue_classes))::integer,
           (SELECT count(*) FROM blocked b WHERE b.residue_classes IS NULL)::integer,
           (SELECT count(*) FROM scheduled s WHERE s.last_outcome = 'RETRY')::integer,
           (SELECT count(*) FROM scheduled s WHERE s.last_outcome = 'INTEGRITY')::integer,
           m.pending,
           COALESCE(floor(EXTRACT(EPOCH FROM (clock_timestamp() - m.oldest)))::bigint, 0),
           (SELECT count(*) FROM account_erasure_private.residue_class_coverage k WHERE NOT k.covered)::integer
      FROM media m;
$$;

-- The release gate's readable truth (P-1): every residue class, whether a module covers it and who owns it.
CREATE FUNCTION public.server_read_account_erasure_coverage_v1()
RETURNS TABLE (residue_class text, covered boolean, owner text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT k.residue_class, k.covered, k.owner FROM account_erasure_private.residue_class_coverage k ORDER BY 1;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 13. OWNERSHIP, RLS AND ACL. Default-deny by name, then exact grants.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  rel text;
  fn text;
  r text;
BEGIN
  FOREACH rel IN ARRAY ARRAY[
    'account_erasure_private.erasure_authorizations', 'account_erasure_private.coverage_registry',
    'account_erasure_private.residue_class_coverage', 'account_erasure_private.deletion_progress',
    'account_erasure_private.media_pending', 'public.introduction_retained_views', 'public.introduction_retained_view_items',
    'public.matching_counterpart_erasure_releases', 'public.matching_counterpart_erasure_reactivation_commands'] LOOP
    EXECUTE format('ALTER TABLE %s OWNER TO postgres', rel);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', rel);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC', rel);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON TABLE %s FROM %I', rel, r);
      END IF;
    END LOOP;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY[
    'account_erasure_private.erasure_authorized_v1()',
    'account_erasure_private.residue_classes_v1(uuid,uuid[])',
    'account_erasure_private.module_residue_v1(uuid)',
    'account_erasure_private.introduction_worlds_v1(uuid)',
    'account_erasure_private.matching_humans_v1(uuid)',
    'account_erasure_private.erase_matching_introductions_v1(uuid,uuid,uuid[])',
    'account_erasure_private.record_outcome_v1(uuid,text,text,text)',
    'account_erasure_private.erase_account_v1(uuid)',
    'account_erasure_private.rearm_blocked_account_deletions_v1(integer)',
    'account_erasure_private.settle_media_pending_v1()',
    'public.reject_account_erasure_retention_mutation_v1()',
    'public.server_erase_account_v1(uuid)',
    'public.server_rearm_blocked_account_deletions_v1(integer)',
    'public.server_read_account_erasure_operations_v1()',
    'public.server_read_account_erasure_coverage_v1()'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r);
      END IF;
    END LOOP;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.server_erase_account_v1(uuid), '
         || 'public.server_rearm_blocked_account_deletions_v1(integer), '
         || 'public.server_read_account_erasure_operations_v1(), public.server_read_account_erasure_coverage_v1() '
         || 'TO service_role';
  END IF;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 14. TERMINAL SELF-ASSERTIONS. The migration refuses to deploy an erasure that is client-reachable, wider than its one
--     server entry, ungoverned, disordered or that weakens a frozen boundary.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  r text;
  fn text;
  src text;
  lock_pos integer[];
BEGIN
  -- One server entry; nothing here is executable by a client role; the private module by nobody.
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      FOREACH fn IN ARRAY ARRAY['public.server_erase_account_v1(uuid)', 'public.server_rearm_blocked_account_deletions_v1(integer)',
                                'public.server_read_account_erasure_operations_v1()', 'public.server_read_account_erasure_coverage_v1()'] LOOP
        IF has_function_privilege(r, fn, 'EXECUTE') THEN
          RAISE EXCEPTION 'ACCT-DEL-01: % must not execute %', r, fn;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    IF has_function_privilege('service_role', 'account_erasure_private.erase_account_v1(uuid)', 'EXECUTE')
       OR has_function_privilege('service_role', 'account_erasure_private.erase_matching_introductions_v1(uuid,uuid,uuid[])', 'EXECUTE')
       OR has_schema_privilege('service_role', 'account_erasure_private', 'USAGE') THEN
      RAISE EXCEPTION 'ACCT-DEL-01: service_role reaches the erasure only through public.server_erase_account_v1';
    END IF;
    IF NOT has_function_privilege('service_role', 'public.server_erase_account_v1(uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'ACCT-DEL-01: service_role must execute public.server_erase_account_v1';
    END IF;
  END IF;
  -- 0130 is untouched: its erasure, its GUC and its authorization table stay its own.
  SELECT p.prosrc INTO src FROM pg_proc p WHERE p.oid = 'personal_data_private.erase_personal_account_v1(uuid)'::regprocedure;
  IF src ~ 'account_erasure' THEN
    RAISE EXCEPTION 'ACCT-DEL-01: 0130 must not learn of the account erasure';
  END IF;
  -- The coordinator: locks in the published order, the census before the erasure, the 0130 call inside it.
  SELECT regexp_replace(p.prosrc, '--[^\n]*', '', 'g') INTO src
    FROM pg_proc p WHERE p.oid = 'account_erasure_private.erase_account_v1(uuid)'::regprocedure;
  lock_pos := ARRAY[
    strpos(src, 'FROM public.shared_worlds w WHERE w.id = ANY (v_worlds) ORDER BY w.id FOR UPDATE'),
    strpos(src, 'FROM public.introduction_records r WHERE r.world_id = ANY (v_worlds) ORDER BY r.id FOR UPDATE'),
    strpos(src, 'FROM public.matching_setup_locks l WHERE l.user_id = ANY (v_humans) ORDER BY l.user_id FOR UPDATE'),
    strpos(src, 'ORDER BY x.id FOR UPDATE'),
    strpos(src, 'ORDER BY s.participant_user_id FOR UPDATE'),
    strpos(src, 'FROM public.matching_active_introduction_claims c WHERE c.world_id = ANY (v_worlds) ORDER BY c.id FOR UPDATE'),
    strpos(src, 'FROM public.users u WHERE u.id = v_user FOR UPDATE'),
    strpos(src, 'WHERE d.id = p_deletion_id FOR UPDATE'),
    strpos(src, 'account_erasure_private.residue_classes_v1(v_user, v_worlds)'),
    strpos(src, 'account_erasure_private.erase_matching_introductions_v1(p_deletion_id, v_user, v_worlds)'),
    strpos(src, 'personal_data_private.erase_personal_account_v1(p_deletion_id);
    IF v_personal')];
  FOR i IN 1 .. array_length(lock_pos, 1) LOOP
    IF lock_pos[i] = 0 OR (i > 1 AND lock_pos[i] <= lock_pos[i - 1]) THEN
      RAISE EXCEPTION 'ACCT-DEL-01: the coordinator order is broken at step %', i;
    END IF;
  END LOOP;
  -- No trigger is disabled and no replication role is used, anywhere in the erasure.
  FOREACH fn IN ARRAY ARRAY['account_erasure_private.erase_account_v1(uuid)',
                            'account_erasure_private.erase_matching_introductions_v1(uuid,uuid,uuid[])'] LOOP
    SELECT p.prosrc INTO src FROM pg_proc p WHERE p.oid = fn::regprocedure;
    IF src ~* '(session_replication_role|DISABLE\s+TRIGGER|ALTER\s+TABLE|TRUNCATE|EXECUTE\s)' THEN
      RAISE EXCEPTION 'ACCT-DEL-01: % must not disable a guard, alter a table, truncate or run dynamic SQL', fn;
    END IF;
  END LOOP;
  -- The covered module deletes exactly from the relations the registry says it covers.
  SELECT p.prosrc INTO src FROM pg_proc p
   WHERE p.oid = 'account_erasure_private.erase_matching_introductions_v1(uuid,uuid,uuid[])'::regprocedure;
  FOR r IN SELECT g.relation FROM account_erasure_private.coverage_registry g
            WHERE g.coverage IN ('MATCHING_INTRODUCTIONS', 'SHARED_INTRODUCTION') LOOP
    IF strpos(src, 'DELETE FROM ' || CASE WHEN r LIKE '%.%' THEN r ELSE 'public.' || r END || ' ') = 0 THEN
      RAISE EXCEPTION 'ACCT-DEL-01: the module covers % but never deletes from it', r;
    END IF;
  END LOOP;
  -- Every residue class is uncovered today and owned (P-1): nothing claims Shared STANDARD, Public or Replay.
  IF EXISTS (SELECT 1 FROM account_erasure_private.residue_class_coverage k WHERE k.covered) THEN
    RAISE EXCEPTION 'ACCT-DEL-01: no residue class is covered by this migration';
  END IF;
  -- The seams stay fail-closed and the reactivation gate stays LAST.
  IF (SELECT clearance FROM public.resolve_matching_reactivation_prerequisites_v1('00000000-0000-0000-0000-000000000000')) <> 'NOT_EVALUATED' THEN
    RAISE EXCEPTION 'ACCT-DEL-01: the CW2-08 reactivation seam must stay NOT_EVALUATED';
  END IF;
  SELECT regexp_replace(p.prosrc, '--[^\n]*', '', 'g') INTO src FROM pg_proc p
   WHERE p.oid = 'public.reactivate_matching_after_introduction_v1(uuid,uuid,uuid,text)'::regprocedure;
  IF NOT (strpos(src, 'matching_counterpart_erasure_releases') > strpos(src, 'FROM public.introduction_terminal_commits t')
          AND strpos(src, 'resolve_matching_reactivation_prerequisites_v1') > strpos(src, 'matching_counterpart_erasure_releases')
          AND strpos(src, 'INSERT INTO public.matching_participation_events') > strpos(src, 'resolve_matching_reactivation_prerequisites_v1')) THEN
    RAISE EXCEPTION 'ACCT-DEL-01: the release is part of gate 7a, before the CW2-08 gate, which stays before the write';
  END IF;
  IF src ~ '(DELETE FROM|ORDER BY|LIMIT|matching_proposal|shared_worlds)' OR (length(src) - length(replace(src, 'clock_timestamp()', ''))) / length('clock_timestamp()') <> 1 THEN
    RAISE EXCEPTION 'ACCT-DEL-01: the reactivation core still deletes nothing, orders nothing, touches no proposal or World and reads one instant';
  END IF;
  IF has_function_privilege('authenticated', 'public.reactivate_matching_after_introduction_v1(uuid,uuid,uuid,text)', 'EXECUTE')
     OR (EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
         AND has_function_privilege('service_role', 'public.reactivate_matching_after_introduction_v1(uuid,uuid,uuid,text)', 'EXECUTE')) THEN
    RAISE EXCEPTION 'ACCT-DEL-01: the reactivation core stays executable by no application role';
  END IF;
END$$;

COMMIT;
