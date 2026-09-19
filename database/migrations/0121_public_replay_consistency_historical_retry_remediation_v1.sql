-- QAN-CW-REM-03 - Public / Replay current-consent composition and Public
-- historical command truth v1.
--
-- Two accepted phase-wide assurance findings, both of them the same mistake in
-- two different shapes: a CURRENT answer and a HISTORICAL answer were allowed to
-- be read from the same mutable place.
--
-- ## ASSURE-F03 - one consent act, two records, and only one of them consulted
--
-- A Replay distribution to the Public World is ONE human consent act recorded in
-- TWO evidence stores. Migration 0104 makes that structural: for
-- `destination_action = 'PUBLISH_TO_PUBLIC_WORLD'` a `replay_distribution_approvals`
-- row MUST carry `linked_public_approval_id`, and for every other destination it
-- MUST NOT. The composite foreign key onto the frozen 0094 exact-identity key
-- makes the linked Public approval the same human's approval of the same
-- manifest. Migration 0105's withdrawal already honours that: withdrawing the
-- Replay half also withdraws the exact linked Public half, "so consent cannot be
-- half-taken-back".
--
-- The EFFECTIVE-STATE derivation did not. It answered from two facts:
--
--     a Replay withdrawal event exists            -> WITHDRAWN
--     the bound fingerprint is not the package's  -> SUPERSEDED
--     otherwise                                   -> EFFECTIVE
--
-- and never looked at the linked Public approval. So a human who withdrew their
-- canonical Public publication approval directly - through the frozen
-- `withdraw_publication_approval_v1`, which is the ONE Public withdrawal
-- primitive and has no idea a Replay borrowed that consent - left a Replay
-- approval still answering EFFECTIVE. The Public half was taken back and the
-- Replay half was not, which is exactly the half-taken-back consent 0105
-- refused to allow in the other direction.
--
-- The correction composes the CANONICAL Public derivation rather than
-- re-deciding Public consent here. Public withdrawal and Public supersession
-- remain 0094's rules entirely; this derivation consumes the answer for the ONE
-- exact approval row the Replay consent already binds, and never searches for
-- "some approval on this manifest".
--
--     1. ANY EXPLICIT HUMAN WITHDRAWAL DOMINATES
--          a Replay withdrawal event                -> WITHDRAWN
--          the linked Public approval is WITHDRAWN  -> WITHDRAWN
--     2. OTHERWISE, STRUCTURAL STALENESS DOMINATES
--          the bound fingerprint moved              -> SUPERSEDED
--          the linked Public approval is not
--          EFFECTIVE, or cannot be resolved at all
--          although the immutable link says it
--          must exist                               -> SUPERSEDED
--     3. OTHERWISE                                  -> EFFECTIVE
--
-- No new Product state, no synthetic Replay withdrawal event, and no change for
-- a non-Public destination: `SHARE_EXTERNALLY` and `DOWNLOAD` carry no linked
-- Public approval, the Public branches are guarded by that column being present,
-- and a non-Public approval therefore cannot acquire a Public dependency it
-- never had. Historical truth is untouched - the Replay approval row still
-- exists, the Public withdrawal event still exists, no Replay withdrawal event
-- is invented - and only the composition of those facts changes.
--
-- ## ASSURE-F09 - a historical answer read from current state
--
-- Every Public command relation states the same frozen law, in migration 0093's
-- own words: "Each row is the idempotency key AND the exact committed answer: an
-- equivalent retry is served from here rather than by re-reading current state,
-- so a later preparation, a later approval or a later source change can never
-- make a historical command start answering differently."
--
-- Several retry paths broke it. They answered a committed command by reading
-- `public_experiences.current_lifecycle`, `public_experiences.experience_revision`,
-- the CURRENT `public_identity_display_state` and the CURRENT disappearance
-- record - live values that have nothing to do with what the command returned
-- when it committed.
--
-- The complete census of every Public consequential command family with durable
-- idempotency, and its verdict, is in section 2. Three families were already
-- correct and are NOT touched; one reads a derivation that is provably pinned
-- and is NOT touched either, with its proof recorded; five were defective.
--
-- ## The strategy: the exact evidence each command already left
--
-- The three lifecycle-moving Public commands write their lifecycle event with
-- `id = p_command_id`. The historical answer is therefore not a temporal
-- question at all - it is an exact identity binding that already exists:
--
--     command id  ->  the exact lifecycle event  ->  its own to_lifecycle
--
-- Section 2.0 is that binding, and it validates every axis it can: the event
-- belongs to the Experience the command bound, names the version it bound,
-- carries the lifecycle that family commits, and occurred at the command's own
-- instant. Anything else is contradictory history and fails closed rather than
-- answering from another plausible event.
--
-- This is deliberately NOT a "latest event at or before the committed instant"
-- reconstruction. `occurred_at` is not a uniqueness key - the relation has
-- PRIMARY KEY (id) and an index on (experience_id, occurred_at), and nothing
-- forbids two events sharing one timestamp - so time is strictly weaker than
-- the identity already recorded, and a later legitimate event at the same
-- instant would break an answer that remains perfectly identifiable by command
-- id (REM03-HIST-01).
--
-- A disappearance command can commit an answer WITHOUT moving a lifecycle -
-- STILL_ELIGIBLE, ALREADY_ABSENT and both NOT_APPLICABLE branches write no
-- event - so it has no event of its own to bind. That family therefore RECORDS
-- its exact answer: three typed columns on its own command row, written
-- atomically with the transition it reports (section 2.3).
--
-- The Public Identity family is the other place durable evidence was genuinely
-- missing: a display label has no history relation - 0091 says so deliberately,
-- "Historical alias-label rendering is deferred, so there is no label history" -
-- so the label a command committed is recoverable from nothing. It gets the same
-- treatment: two typed columns on its own command row, which is where the frozen
-- law says the exact committed answer belongs. No generic JSON result blob, no
-- second Product relation, and no label history surface: the columns are
-- reachable only through that one command's own retry.
--
-- ## Pre-0121 commands
--
-- The three lifecycle-moving families need nothing special: their events were
-- always written under the command's own identity, so an old command binds its
-- own event exactly as a new one does.
--
-- An old disappearance command carries no stored answer. If it moved the
-- lifecycle it still wrote its event under its own identity, and section 2.3
-- answers it exactly from that. Only one that reported a STATE rather than a
-- transition has no command-bound evidence at all, and only there does a
-- temporal reconstruction appear - as a bounded LEGACY fallback (section 2.1),
-- never as the store for anything written from here on, and failing closed on
-- no evidence and on ambiguous evidence alike.
--
-- For an old Public Identity command the label is genuinely gone unless the
-- display state has not moved since. The committed `label_revision` is the
-- witness: the revision only ever increases, by exactly one, on the only
-- statement that changes a label, so a current revision EQUAL to the committed
-- one proves no label change has happened since that command committed and the
-- current row therefore still carries that command's own answer. A revision that
-- has moved proves the opposite, and there the answer fails closed with one
-- bounded contradictory-history class rather than substituting a label the
-- command never returned.
--
-- ## The two answer-carrying command histories are append-only
--
-- Two relations that were only a request and an instant are now authoritative
-- for an exact historical answer, and that changes what has to be true of them.
-- Deny-by-default privileges were the right protection for a request log; they
-- bind roles, not the table owner, and they say nothing about what a row may
-- BECOME. An answer that can be edited is not an answer. So section 2.4 makes
-- `public_identity_commands` and `public_experience_disappearance_commands`
-- append-only for every role through the same BEFORE UPDATE OR DELETE guard the
-- Public domain already uses for versions, lifecycle events, approvals and the
-- sealed disappearance record - with no exception for the new answer columns,
-- no application-facing update primitive, and no backfill of an answer that
-- cannot be proven (REM03-HIST-02).
--
-- ## What this migration does not do
--
-- It implements no part of ASSURE-F05. No Public derivative is recalled, no
-- Public source-deletion policy is added, and no new Public recall semantics of
-- any kind exist here. It widens no application-role execution, adds no advisory
-- or table lock, takes no new row lock, and edits no migration through 0120.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. ASSURE-F03. THE ONE REPLAY DISTRIBUTION APPROVAL EFFECTIVE-STATE
--    DERIVATION, COMPOSING THE EXACT LINKED PUBLIC CONSENT.
--
--    Forward-replaced with the identical signature, the identical result columns
--    and the identical vocabulary. It is still read-only, still STABLE, still
--    takes no lock, and still returns zero rows for a NULL identifier and for an
--    approval that does not exist - the package-level view joins it LATERALLY
--    over a LEFT JOIN, so a required human who never approved must reach it with
--    NULL and receive nothing rather than an error.
--
--    The linked Public approval is read through the CANONICAL 0094 derivation.
--    Nothing about Public withdrawal or Public supersession is re-implemented
--    here: if 0094's rules change, this composes the changed rules, which is the
--    whole reason it is a composition rather than a copy.
--
--    The link is the one the CONSENT ACT COMMITTED - `linked_public_approval_id`
--    on the immutable approval row - not a search for an approval by this human
--    on this manifest. The two coincide today and the search would still be
--    wrong: this is the exact Public approval this Replay consent created, and
--    never an approval that reached the same manifest another way.
--
--    FAIL-CLOSED ON AN UNRESOLVABLE LINK. `derive_publication_approval_effective_state_v1`
--    answers zero rows for an approval it cannot resolve, so the LEFT JOIN
--    LATERAL leaves `effective_state` NULL. For a Public-linked approval that is
--    a contradiction - the immutable composite foreign key says the row must
--    exist - and `IS DISTINCT FROM 'EFFECTIVE'` refuses it as SUPERSEDED rather
--    than letting a missing answer read as a present one.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.derive_replay_distribution_approval_effective_state_v1(p_approval_id uuid)
RETURNS TABLE(approval_id uuid, approved_distribution_package_version_id uuid, approving_user_id uuid,
              effective_state text, bound_authority_fingerprint text, withdrawn_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_approval_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT a.id, a.distribution_package_version_id, a.approver_user_id,
         CASE
              -- 1. ANY EXPLICIT HUMAN WITHDRAWAL, of EITHER half of the one
              --    consent act, dominates every structural fact.
              WHEN w.id IS NOT NULL THEN 'WITHDRAWN'
              WHEN linked.effective_state = 'WITHDRAWN' THEN 'WITHDRAWN'
              -- 2. STRUCTURAL STALENESS. The Replay half's own bound authority
              --    first, then the linked Public half: SUPERSEDED there, and an
              --    unresolvable link, both refuse.
              WHEN a.bound_authority_fingerprint IS DISTINCT FROM p.authority_request_fingerprint
                THEN 'SUPERSEDED'
              WHEN a.linked_public_approval_id IS NOT NULL
                   AND linked.effective_state IS DISTINCT FROM 'EFFECTIVE'
                THEN 'SUPERSEDED'
              -- 3. NEITHER.
              ELSE 'EFFECTIVE' END::text,
         a.bound_authority_fingerprint, w.occurred_at
    FROM public.replay_distribution_approvals a
    JOIN public.replay_distribution_package_versions p ON p.id = a.distribution_package_version_id
    LEFT JOIN public.replay_distribution_approval_withdrawal_events w ON w.approval_id = a.id
    -- A non-Public destination has no linked Public approval, reaches this with
    -- NULL, and therefore keeps exactly its frozen behaviour.
    LEFT JOIN LATERAL public.derive_publication_approval_effective_state_v1(a.linked_public_approval_id) linked
      ON a.linked_public_approval_id IS NOT NULL
   WHERE a.id = p_approval_id;
END$$;

ALTER FUNCTION public.derive_replay_distribution_approval_effective_state_v1(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.derive_replay_distribution_approval_effective_state_v1(uuid) IS
  'The ONE effective state of one exact Replay distribution approval. For a '
  'Public destination it composes the CURRENT effective state of the exact '
  'linked canonical Public approval through the frozen 0094 derivation, because '
  'the two rows are two records of ONE human consent act: an explicit withdrawal '
  'of either half is WITHDRAWN, and a superseded or unresolvable linked Public '
  'approval is SUPERSEDED. A non-Public destination has no linked approval and '
  'is unchanged.';

-- ---------------------------------------------------------------------------
-- 2. ASSURE-F09. THE COMPLETE PUBLIC COMMAND RETRY CENSUS.
--
--    Every Public consequential command family with durable idempotency across
--    the current forward tree, every field of its historical answer, and where
--    that field comes from. `IMMUTABLE` is a value on a row that can never
--    change; `COMMAND` is the command row itself; `CONSTANT` is implied by the
--    committed transition; `LIVE` is the defect.
--
--    ensure_public_identity_v1              -> public_identity_commands
--      public_identity_ref  COMMAND
--      label_mode           LIVE  -> typed answer column (section 2.2)
--      display_label        LIVE  -> typed answer column (section 2.2)
--      label_revision       LIVE  -> COMMAND (the column was already there and
--                                   the retry read the live one anyway)
--      committed_at         COMMAND
--
--    update_public_display_label_v1         -> public_identity_commands
--      public_identity_ref  COMMAND
--      label_mode           LIVE  -> typed answer column (section 2.2)
--      display_label        LIVE  -> typed answer column (section 2.2)
--      label_revision       COMMAND, already correct
--      committed_at         COMMAND
--
--    create_public_experience_draft_v1      -> public_experience_draft_commands
--      experience_id                    COMMAND
--      created_by_public_identity_ref   COMMAND
--      current_lifecycle    LIVE  -> IMMUTABLE lifecycle event this command wrote (section 2.0)
--      experience_revision  LIVE  -> CONSTANT 1: the creating INSERT writes the
--                                   literal 1 and nothing else can create an
--                                   Experience
--      committed_at                     COMMAND
--
--    prepare_public_experience_manifest_v1  -> publication_package_prepare_commands
--      (current definition forward-replaced in 0119)
--      manifest_version_id / experience_version_id / item_count /
--      required_approver_count / authority_request_fingerprint / committed_at
--                           COMMAND
--      version_ordinal      IMMUTABLE: read from the exact
--                           `public_experience_versions` row the command row
--                           names, and that relation is guarded UPDATE and
--                           DELETE for every role including the owner
--      VERDICT: already historical truth. NOT CHANGED.
--
--    approve_public_experience_manifest_v1  -> the approval row IS the record
--      every field      COMMAND (the immutable 0092 approval row)
--      VERDICT: already historical truth. NOT CHANGED.
--
--    commit_public_experience_ready_for_review_v1
--                                           -> public_experience_review_ready_commands
--      experience_id / experience_version_id / manifest_version_id /
--      satisfied_approval_count / authority_request_fingerprint / committed_at
--                           COMMAND
--      current_lifecycle    LIVE  -> IMMUTABLE lifecycle event this command wrote (section 2.0)
--
--    withdraw_publication_approval_v1       -> publication_approval_withdrawal_commands
--      approval_id / approved_manifest_version_id / committed_at   COMMAND
--      effective_state      reads the CURRENT 0094 derivation, and is PROVEN
--                           PINNED: this command writes its command row only on
--                           a path where the withdrawal event for that exact
--                           approval exists, the event relation is append-only
--                           and refuses DELETE for every role including the
--                           owner, and the derivation reports WITHDRAWN first.
--                           The answer can therefore only ever be WITHDRAWN,
--                           which is what both committing paths returned.
--      VERDICT: immutable-safe by proof. NOT CHANGED - a rewrite here would
--               change a correct answer's spelling and nothing else.
--
--    publish_public_experience_v1           -> public_experience_publish_commands
--      experience_id / experience_version_id / manifest_version_id /
--      effective_approval_count / authority_request_fingerprint / committed_at
--                           COMMAND
--      current_lifecycle    LIVE  -> IMMUTABLE lifecycle event this command wrote (section 2.0)
--
--    remove_public_experience_from_public_world_v1
--                                           -> public_experience_disappearance_commands
--      experience_id / committed_at     COMMAND
--      absent_experience_version_id     COMMAND, but only when the command
--                                       actually reported an absence
--      disappearance_basis  LIVE-shaped: read from the disappearance record
--                           without proving that record is the one this command
--                           answered about
--      current_lifecycle    LIVE  -> section 2.3
--
--    reconcile_public_experience_disappearance_v1
--                                           -> public_experience_disappearance_commands
--      absent_experience_version_id  LIVE: the retry returned the command's
--                           target version even for STILL_ELIGIBLE, where the
--                           original answer was NULL - wrong on the very first
--                           retry, with no state change at all
--      disappearance_basis  LIVE: NULL when the command committed, and a real
--                           basis after some LATER reconciliation converged the
--                           Experience
--      current_lifecycle    LIVE  -> section 2.3
--
--    record_public_experience_semantic_placement_v1
--      placement_revision / placement_basis  IMMUTABLE: the placement row the
--                           command names is guarded UPDATE and DELETE
--      VERDICT: already historical truth. NOT CHANGED.
--
--    post_public_discussion_v1
--      every field          IMMUTABLE: the post row the command names is guarded
--      VERDICT: already historical truth. NOT CHANGED.
--
--    record_public_qandeel_response_v1
--      every field          IMMUTABLE: the response row the command names is
--                           guarded
--      VERDICT: already historical truth. NOT CHANGED.
--
--    The Replay command families were inspected under the same rule and are all
--    already historical truth: `approve_replay_distribution_v1` answers from its
--    own immutable approval row, `prepare_replay_distribution_package_v1` and
--    `authorize_replay_distribution_v1` from their command row and the immutable
--    authorization row, and `withdraw_replay_distribution_approval_v1` carries
--    the same proven-pinned WITHDRAWN as its Public counterpart - which section
--    1 preserves deliberately by testing the Replay withdrawal event FIRST.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 2.0 THE EXACT LIFECYCLE EVENT ONE COMMAND WROTE.
--
--     REM03-HIST-01. The three lifecycle-moving Public commands write their
--     lifecycle event with `id = p_command_id`. The historical answer is
--     therefore not a temporal-query problem at all - it is an exact identity
--     binding that already exists:
--
--       command id  ->  the exact lifecycle event  ->  its own to_lifecycle
--
--     So that is what the retry reads. `occurred_at` is NOT a uniqueness key -
--     the relation has PRIMARY KEY (id) and an index on
--     (experience_id, occurred_at), and no uniqueness constraint on the pair -
--     so a "latest event at or before the committed instant" reconstruction is
--     strictly weaker than the truth available, and would let a future
--     legitimate event sharing one PostgreSQL timestamp break an otherwise
--     perfectly identifiable historical answer.
--
--     The caller states which family it is and what that family commits; the
--     DATABASE proves the exact event agrees, on every axis it can:
--
--       the event exists under the command's own identity
--       it belongs to the Experience the command bound
--       it names the version the command bound (NULL for a birth, which the
--         frozen 0091 CHECK already makes the only legal birth shape)
--       it carries the lifecycle that command family commits and no other
--       it occurred at the command's own committed instant
--
--     Anything else is contradictory history, and it fails closed rather than
--     looking for another plausible event.
--
--     Internal, STABLE, write-free, lock-free, executable by nobody.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.derive_public_command_lifecycle_v1(
  p_command_id uuid, p_experience_id uuid, p_experience_version_id uuid,
  p_committed_lifecycle text, p_committed_at timestamptz
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  moved public.public_experience_lifecycle_events;
BEGIN
  IF p_command_id IS NULL OR p_experience_id IS NULL
     OR p_committed_lifecycle IS NULL OR p_committed_at IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  SELECT * INTO moved FROM public.public_experience_lifecycle_events le WHERE le.id = p_command_id;
  IF NOT FOUND
     OR moved.experience_id <> p_experience_id
     OR moved.experience_version_id IS DISTINCT FROM p_experience_version_id
     OR moved.to_lifecycle <> p_committed_lifecycle
     OR moved.occurred_at <> p_committed_at THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_HISTORY' USING ERRCODE='P0001',
      DETAIL='The immutable lifecycle event this Public command wrote is missing or does not agree with the command that names it. No other event may answer for it.';
  END IF;
  RETURN moved.to_lifecycle;
END$$;

ALTER FUNCTION public.derive_public_command_lifecycle_v1(uuid, uuid, uuid, text, timestamptz) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.derive_public_command_lifecycle_v1(uuid, uuid, uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.derive_public_command_lifecycle_v1(uuid, uuid, uuid, text, timestamptz) FROM service_role';
END IF; END$$;

COMMENT ON FUNCTION public.derive_public_command_lifecycle_v1(uuid, uuid, uuid, text, timestamptz) IS
  'The lifecycle ONE Public command committed, read from the immutable event '
  'that command itself wrote under its own identity. Never found by time: a '
  'lifecycle event is identified by its id, and an instant is not a command '
  'identity. It fails closed rather than answering from another event.';

-- ---------------------------------------------------------------------------
-- 2.1 THE HISTORICAL LIFECYCLE OF ONE EXPERIENCE AT ONE PAST INSTANT.
--
--     THE LEGACY FALLBACK, AND NOTHING ELSE. No command written from 0121
--     forward answers through this: the three lifecycle-moving families bind
--     their own event by identity (section 2.0), and every disappearance
--     command from here on records its exact answer (section 2.3). What this
--     exists for is the disappearance command committed BEFORE this migration
--     that carries no stored answer and wrote no lifecycle event of its own - a
--     STILL_ELIGIBLE or NOT_APPLICABLE row - where the only evidence left is the
--     append-only event log and the instant the command recorded.
--
--     Internal, STABLE, write-free, lock-free, executable by nobody. It reads
--     ONE relation: the append-only `public_experience_lifecycle_events`, which
--     is guarded against UPDATE and DELETE for every role including the table
--     owner.
--
--     WHY IT IS SOUND FOR THAT CASE. Exactly four statements in the
--     whole forward tree set `public_experiences.current_lifecycle`:
--
--       0093 create_public_experience_draft_v1            INSERT ... 'DRAFT'
--       0093 commit_public_experience_ready_for_review_v1 UPDATE ... 'READY_FOR_REVIEW'
--       0095 publish_public_experience_v1                 UPDATE ... 'PUBLISHED'
--       0099 apply_public_experience_disappearance_v1     UPDATE ... 'ABSENT_FROM_PUBLIC_WORLD'
--
--     Every one of them writes a lifecycle event in the SAME transaction at the
--     SAME database-owned instant, and each holds the exact Experience row FOR
--     UPDATE while it does. The event log is therefore complete and totally
--     ordered, and the lifecycle at instant T is the `to_lifecycle` of the latest
--     event at or before T. Section 4 asserts that census rather than trusting
--     this comment.
--
--     FAIL-CLOSED, TWICE. An Experience with no event at or before the instant
--     has no reconstructable lifecycle, and two events sharing the maximum
--     instant would make "the latest" ambiguous. Both raise one bounded
--     contradictory-history class instead of returning a plausible value.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.derive_public_experience_lifecycle_at_v1(
  p_experience_id uuid, p_at timestamptz
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  latest timestamptz;
  events integer;
  answer text;
BEGIN
  IF p_experience_id IS NULL OR p_at IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  SELECT max(le.occurred_at) INTO latest
    FROM public.public_experience_lifecycle_events le
   WHERE le.experience_id = p_experience_id AND le.occurred_at <= p_at;
  IF latest IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_HISTORY' USING ERRCODE='P0001',
      DETAIL='No Public Experience lifecycle event exists at or before the instant asked about, so the historical lifecycle cannot be reconstructed from immutable evidence.';
  END IF;

  SELECT count(*)::integer, min(le.to_lifecycle) INTO events, answer
    FROM public.public_experience_lifecycle_events le
   WHERE le.experience_id = p_experience_id AND le.occurred_at = latest;
  IF events <> 1 THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_HISTORY' USING ERRCODE='P0001',
      DETAIL='Two Public Experience lifecycle events share one instant, so the latest transition at that instant is ambiguous.';
  END IF;
  RETURN answer;
END$$;

ALTER FUNCTION public.derive_public_experience_lifecycle_at_v1(uuid, timestamptz) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.derive_public_experience_lifecycle_at_v1(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.derive_public_experience_lifecycle_at_v1(uuid, timestamptz) FROM service_role';
END IF; END$$;

COMMENT ON FUNCTION public.derive_public_experience_lifecycle_at_v1(uuid, timestamptz) IS
  'THE LEGACY FALLBACK ONLY: the lifecycle one Public Experience was in at one '
  'past instant, for a pre-0121 disappearance command that stored no answer and '
  'wrote no lifecycle event of its own. Every command from 0121 forward answers '
  'from its own exact evidence and never from this. It fails closed rather than '
  'guessing, on no evidence and on ambiguous evidence alike.';

-- ---------------------------------------------------------------------------
-- 2.2 THE PUBLIC IDENTITY COMMAND'S OWN COMMITTED ANSWER.
--
--     The label a command returned is not recoverable from anything else: 0091
--     deliberately keeps no label history, and the display row holds only the
--     CURRENT label. So the two missing fields of the answer go where the frozen
--     law says the exact committed answer belongs - on the command row - as two
--     typed columns with the same bounded shape the display relation itself
--     pins. This adds no label history: the columns are reachable only through
--     that one command's own retry, and no read boundary selects them.
--
--     They are NULLABLE because commands committed before this migration have no
--     answer to carry, and a NOT NULL would have to invent one for them. What
--     stops that from becoming a permanent hole is the INSERT guard below: every
--     command written from now on MUST carry its answer, structurally, rather
--     than because two functions remember to.
-- ---------------------------------------------------------------------------
ALTER TABLE public.public_identity_commands
    ADD COLUMN committed_label_mode text,
    ADD COLUMN committed_display_label text;

ALTER TABLE public.public_identity_commands
    ADD CONSTRAINT public_identity_commands_answer_mode_check
        CHECK (committed_label_mode IS NULL OR committed_label_mode IN ('PSEUDONYM', 'REAL_NAME')),
    ADD CONSTRAINT public_identity_commands_answer_label_check
        CHECK (committed_display_label IS NULL
            OR (length(btrim(committed_display_label)) > 0 AND length(committed_display_label) <= 64)),
    -- The answer is whole or absent. A half-recorded one would be a third state
    -- neither the retry nor the reconstruction below knows how to read.
    ADD CONSTRAINT public_identity_commands_answer_shape_check
        CHECK ((committed_label_mode IS NULL) = (committed_display_label IS NULL));

COMMENT ON COLUMN public.public_identity_commands.committed_label_mode IS
  'The label mode this command RETURNED when it committed. NULL only for a '
  'command committed before migration 0121; every later one carries it.';
COMMENT ON COLUMN public.public_identity_commands.committed_display_label IS
  'The display label this command RETURNED when it committed. It is the exact '
  'committed answer, not a label history: nothing reads it but this command''s '
  'own retry.';

CREATE FUNCTION public.public_identity_command_answer_required_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.committed_label_mode IS NULL OR NEW.committed_display_label IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_HISTORY'
      USING ERRCODE='P0001',
            DETAIL='A Public Identity command row must carry the exact answer it committed. Only commands written before migration 0121 may lack one.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.public_identity_command_answer_required_v1() OWNER TO postgres;

CREATE TRIGGER public_identity_commands_answer_required
    BEFORE INSERT ON public.public_identity_commands
    FOR EACH ROW EXECUTE FUNCTION public.public_identity_command_answer_required_v1();

-- ONE reconstruction of one Public Identity command's committed answer, so the
-- two primitives cannot drift.
--
--   the command carries its answer   -> that answer, exactly
--   it does not, and the display
--   revision is STILL the committed
--   one                              -> the current row, PROVEN to be the
--                                       committed one: `label_revision` is set
--                                       to 1 at creation and to `+ 1` by the ONE
--                                       statement that changes a label, so an
--                                       unmoved revision means no label change
--                                       has happened since this command
--   it does not, and the revision
--   has moved                        -> fail closed. The label this command
--                                       returned is gone, and the current one is
--                                       a different answer, not this one.
CREATE FUNCTION public.derive_public_identity_command_answer_v1(p_command_id uuid)
RETURNS TABLE(label_mode text, display_label text, label_revision bigint)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  committed public.public_identity_commands;
  display public.public_identity_display_state;
BEGIN
  IF p_command_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT * INTO committed FROM public.public_identity_commands c WHERE c.id = p_command_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_HISTORY' USING ERRCODE='P0001',
      DETAIL='No Public Identity command row exists for the identity asked about.';
  END IF;

  IF committed.committed_label_mode IS NOT NULL THEN
    RETURN QUERY SELECT committed.committed_label_mode, committed.committed_display_label,
                        committed.label_revision;
    RETURN;
  END IF;

  SELECT * INTO display FROM public.public_identity_display_state d
   WHERE d.public_identity_ref = committed.public_identity_ref;
  IF NOT FOUND OR display.label_revision IS DISTINCT FROM committed.label_revision THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_HISTORY' USING ERRCODE='P0001',
      DETAIL='This Public Identity command committed before migration 0121 and the display label has changed since, so the exact answer it returned is no longer reconstructable from immutable evidence.';
  END IF;
  RETURN QUERY SELECT display.label_mode, display.display_label, committed.label_revision;
END$$;

ALTER FUNCTION public.derive_public_identity_command_answer_v1(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.derive_public_identity_command_answer_v1(uuid) FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.derive_public_identity_command_answer_v1(uuid) FROM service_role';
END IF; END$$;

-- ---------------------------------------------------------------------------
-- 2.3 THE DISAPPEARANCE COMMAND'S OWN COMMITTED ANSWER, STORED.
--
--     A disappearance command can commit an answer without moving a lifecycle
--     at all - STILL_ELIGIBLE, ALREADY_ABSENT and both NOT_APPLICABLE branches
--     write no event - so there is no event for it to bind by identity the way
--     section 2.0 binds one. REM03-HIST-01: that makes temporal reconstruction
--     the wrong PRIMARY store for it too. Every command from here on records
--     its exact answer.
--
--     Three typed columns, which is the whole answer: the version the command
--     returned, the basis it returned, and the lifecycle it returned. A fourth
--     "outcome class" column would add nothing a retry reads - a retry answers
--     ALREADY_COMMITTED and these three fields - so it is not added.
--
--     They are NULLABLE because a command committed before this migration has
--     no answer to carry. `committed_lifecycle` is the presence marker: an
--     answer always has one, so its absence means "pre-0121" and nothing else,
--     and the INSERT guard below makes every future row carry it.
-- ---------------------------------------------------------------------------
ALTER TABLE public.public_experience_disappearance_commands
    ADD COLUMN committed_absent_experience_version_id uuid,
    ADD COLUMN committed_disappearance_basis text,
    ADD COLUMN committed_lifecycle text;

ALTER TABLE public.public_experience_disappearance_commands
    ADD CONSTRAINT public_experience_disappearance_commands_answer_lifecycle_check
        CHECK (committed_lifecycle IS NULL
            OR committed_lifecycle IN ('DRAFT', 'READY_FOR_REVIEW', 'PUBLISHED', 'ABSENT_FROM_PUBLIC_WORLD')),
    ADD CONSTRAINT public_experience_disappearance_commands_answer_basis_check
        CHECK (committed_disappearance_basis IS NULL
            OR committed_disappearance_basis IN ('AUTHORIZED_CONTROLLER_REMOVAL',
                                                 'REQUIRED_APPROVAL_NOT_EFFECTIVE',
                                                 'PUBLISHED_SOURCE_NOT_AVAILABLE',
                                                 'PUBLICATION_AUTHORITY_INVALIDATED')),
    -- AN ANSWER THAT REPORTED AN ABSENCE NAMES THE EXACT PUBLICATION THE
    -- COMMAND BOUND AND ITS BASIS; ONE THAT REPORTED NONE NAMES NEITHER. Both
    -- directions, so a half-recorded answer is unrepresentable rather than
    -- merely unwritten, and the version can never be some OTHER publication.
    ADD CONSTRAINT public_experience_disappearance_commands_answer_shape_check
        CHECK (committed_lifecycle IS NULL
            OR (committed_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD'
                    AND committed_disappearance_basis IS NOT NULL
                    AND committed_absent_experience_version_id IS NOT NULL
                    AND committed_absent_experience_version_id = target_experience_version_id)
            OR (committed_lifecycle <> 'ABSENT_FROM_PUBLIC_WORLD'
                    AND committed_disappearance_basis IS NULL
                    AND committed_absent_experience_version_id IS NULL)),
    -- And a pre-0121 row carries no half of an answer either.
    ADD CONSTRAINT public_experience_disappearance_commands_answer_absent_check
        CHECK (committed_lifecycle IS NOT NULL
            OR (committed_disappearance_basis IS NULL
                    AND committed_absent_experience_version_id IS NULL));

COMMENT ON COLUMN public.public_experience_disappearance_commands.committed_lifecycle IS
  'The lifecycle this command RETURNED when it committed, and the presence '
  'marker for the stored answer. NULL only for a command committed before '
  'migration 0121; every later one carries it.';
COMMENT ON COLUMN public.public_experience_disappearance_commands.committed_disappearance_basis IS
  'The disappearance basis this command RETURNED, or NULL where it reported no '
  'absence. It is the exact committed answer, never a later convergence''s.';
COMMENT ON COLUMN public.public_experience_disappearance_commands.committed_absent_experience_version_id IS
  'The absent version this command RETURNED, or NULL where it reported no '
  'absence - which the frozen retry got wrong by replaying the command''s target.';

CREATE FUNCTION public.public_disappearance_command_answer_required_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.committed_lifecycle IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_HISTORY'
      USING ERRCODE='P0001',
            DETAIL='A Public disappearance command row must carry the exact answer it committed. Only commands written before migration 0121 may lack one.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.public_disappearance_command_answer_required_v1() OWNER TO postgres;

CREATE TRIGGER public_experience_disappearance_commands_answer_required
    BEFORE INSERT ON public.public_experience_disappearance_commands
    FOR EACH ROW EXECUTE FUNCTION public.public_disappearance_command_answer_required_v1();

-- ONE derivation of one disappearance command's committed answer, so the two
-- primitives cannot drift. Three tiers, strongest first:
--
--   1. THE STORED ANSWER. Every command from 0121 forward wrote it atomically
--      with the transition it reported. Nothing is inferred.
--
--   2. THE EXACT EVENT THIS COMMAND WROTE. A pre-0121 command that actually
--      performed a disappearance wrote the lifecycle event under its own
--      identity, so section 2.0's binding answers it exactly - the version from
--      that event, and the basis of the sealed record bound to THAT version.
--
--   3. THE LEGACY TEMPORAL FALLBACK, and only here. A pre-0121 command that
--      reported no transition left no event of its own, so the append-only log
--      and the instant it recorded are the only evidence there is. It fails
--      closed on no evidence and on ambiguous evidence, and an absence it did
--      report is still bound to the exact publication it named.
CREATE FUNCTION public.derive_public_disappearance_command_answer_v1(p_command_id uuid)
RETURNS TABLE(absent_experience_version_id uuid, disappearance_basis text, current_lifecycle text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE
  committed public.public_experience_disappearance_commands;
  moved public.public_experience_lifecycle_events;
  sealed public.public_experience_disappearance_state;
  historical text;
BEGIN
  IF p_command_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT * INTO committed FROM public.public_experience_disappearance_commands c WHERE c.id = p_command_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_HISTORY' USING ERRCODE='P0001',
      DETAIL='No Public disappearance command row exists for the command asked about.';
  END IF;

  -- TIER 1: the answer this command stored when it committed.
  IF committed.committed_lifecycle IS NOT NULL THEN
    RETURN QUERY SELECT committed.committed_absent_experience_version_id,
                        committed.committed_disappearance_basis, committed.committed_lifecycle;
    RETURN;
  END IF;

  -- TIER 2: the exact immutable event this pre-0121 command wrote, if it moved
  -- the lifecycle at all.
  SELECT * INTO moved FROM public.public_experience_lifecycle_events le WHERE le.id = p_command_id;
  IF FOUND THEN
    IF moved.experience_id <> committed.experience_id
       OR moved.to_lifecycle <> 'ABSENT_FROM_PUBLIC_WORLD'
       OR moved.experience_version_id IS DISTINCT FROM committed.target_experience_version_id
       OR moved.occurred_at <> committed.committed_at THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_HISTORY' USING ERRCODE='P0001',
        DETAIL='The lifecycle event this Public disappearance command wrote does not agree with the command that names it.';
    END IF;
    SELECT * INTO sealed FROM public.public_experience_disappearance_state d
     WHERE d.experience_id = committed.experience_id
       AND d.absent_experience_version_id = moved.experience_version_id;
    IF NOT FOUND OR sealed.absent_since <> committed.committed_at THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_HISTORY' USING ERRCODE='P0001',
        DETAIL='The sealed disappearance record this Public command wrote is missing or was not written by it.';
    END IF;
    RETURN QUERY SELECT moved.experience_version_id, sealed.disappearance_basis, moved.to_lifecycle;
    RETURN;
  END IF;

  -- TIER 3: LEGACY ONLY. No stored answer and no event of its own, so this
  -- command reported a state rather than a transition.
  historical := public.derive_public_experience_lifecycle_at_v1(committed.experience_id, committed.committed_at);
  IF historical <> 'ABSENT_FROM_PUBLIC_WORLD' THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, historical;
    RETURN;
  END IF;

  IF committed.target_experience_version_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_HISTORY' USING ERRCODE='P0001',
      DETAIL='A Public disappearance command committed against an absent Experience without binding the publication that disappeared.';
  END IF;
  SELECT * INTO sealed FROM public.public_experience_disappearance_state d
   WHERE d.experience_id = committed.experience_id
     AND d.absent_experience_version_id = committed.target_experience_version_id;
  IF NOT FOUND OR sealed.absent_since >= committed.committed_at THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_HISTORY' USING ERRCODE='P0001',
      DETAIL='The sealed disappearance record this Public command answered about does not exist, or was not already there when the command committed.';
  END IF;
  RETURN QUERY SELECT committed.target_experience_version_id, sealed.disappearance_basis, historical;
END$$;

ALTER FUNCTION public.derive_public_disappearance_command_answer_v1(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.derive_public_disappearance_command_answer_v1(uuid) FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.derive_public_disappearance_command_answer_v1(uuid) FROM service_role';
END IF; END$$;

COMMENT ON FUNCTION public.derive_public_disappearance_command_answer_v1(uuid) IS
  'The exact answer one committed Public disappearance command returned, from '
  'the historical lifecycle and the sealed append-only disappearance record it '
  'bound. Both consequential disappearance primitives answer their retries '
  'through it, so the two cannot drift.';

-- ---------------------------------------------------------------------------
-- 2.4 BOTH COMMAND HISTORIES ARE APPEND-ONLY, FOR EVERY ROLE (REM03-HIST-02).
--
--     Sections 2.2 and 2.3 made these two relations AUTHORITATIVE for an exact
--     historical answer. Until now they carried only a request and an instant,
--     and their protection was the deny-by-default posture 0093 and 0099 gave
--     them: RLS on, zero policies, every application role revoked. That is a
--     real protection and it is the wrong one for this job. A privilege binds
--     roles; it does not bind the table owner, and it says nothing at all about
--     what the row is allowed to BECOME. A historical answer that can be edited
--     is not a historical answer.
--
--     So the same append-only guard the Public domain already uses for versions,
--     lifecycle events, approvals, withdrawals, publication state and the sealed
--     disappearance record now covers the two command histories that carry an
--     answer. UPDATE and DELETE are refused for every role, `postgres` included.
--
--     INSERT is untouched: the canonical producers still write exactly as they
--     did, and the two BEFORE INSERT guards above still require a whole answer
--     from every future row.
--
--     THERE IS NO EXCEPTION FOR THE ANSWER COLUMNS. A narrower guard - one that
--     froze only `committed_lifecycle` and its two companions - would leave the
--     request, the actor and the instant editable, and every one of those is
--     part of the identity the retry compares before it answers at all.
--
--     NOTHING IS BACKFILLED. A pre-0121 row keeps its NULL answer and stays
--     exactly as legible as it was: section 2.2 and section 2.3 reconstruct it
--     from immutable evidence, or fail closed. Freezing the rows does not make
--     an unknown answer known, and inventing one to satisfy a column would be
--     the opposite of what this section is for.
--
--     No application-facing update primitive is added, here or anywhere.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.reject_public_command_history_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'PUBLIC_EXPERIENCE_HISTORY_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='A committed Public command and the exact answer it returned are append-only: UPDATE and DELETE are refused for every role, including the table owner.';
END$$;

ALTER FUNCTION public.reject_public_command_history_mutation_v1() OWNER TO postgres;

COMMENT ON FUNCTION public.reject_public_command_history_mutation_v1() IS
  'The append-only guard of the Public command histories that carry an exact '
  'committed answer. One function for both, so the two relations cannot drift '
  'into different rules, and the refusal class is the one the Public domain '
  'already uses for immutable history.';

CREATE TRIGGER public_identity_commands_immutable
    BEFORE UPDATE OR DELETE ON public.public_identity_commands
    FOR EACH ROW EXECUTE FUNCTION public.reject_public_command_history_mutation_v1();

CREATE TRIGGER public_experience_disappearance_commands_immutable
    BEFORE UPDATE OR DELETE ON public.public_experience_disappearance_commands
    FOR EACH ROW EXECUTE FUNCTION public.reject_public_command_history_mutation_v1();

-- ---------------------------------------------------------------------------
-- 3. THE FIVE DEFECTIVE COMMAND FAMILIES, FORWARD-REPLACED.
--
--    Seven boundaries, each with its exact frozen signature, its exact frozen
--    result columns, its exact frozen authority, lock order, gates, refusal
--    classes and writes. The ONLY change in each is the expression its
--    historical-retry path answers with, plus the two typed answer columns the
--    Public Identity family now writes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_public_identity_v1(
  p_command_id uuid, p_public_identity_ref uuid, p_label_mode text, p_display_label text
) RETURNS TABLE(outcome text, public_identity_ref uuid, label_mode text,
                display_label text, label_revision bigint, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.public_identity_commands;
  existing public.public_identities;
  display public.public_identity_display_state;
  request text;
  conflict text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_public_identity_ref IS NULL
     OR p_label_mode IS NULL OR p_label_mode NOT IN ('PSEUDONYM', 'REAL_NAME')
     OR p_display_label IS NULL OR length(btrim(p_display_label)) = 0 OR length(p_display_label) > 64
     OR p_public_identity_ref = u THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_PUBLIC_IDENTITY_COMMAND_V1' || E'\n'
   || 'kind=ENSURE_PUBLIC_IDENTITY' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'identity=' || lower(p_public_identity_ref::text) || E'\n'
   || 'mode=' || p_label_mode || E'\n'
   || 'label=' || 'sha256:' || encode(sha256(convert_to(p_display_label, 'UTF8')), 'hex'), 'UTF8')), 'hex');

  SELECT * INTO committed FROM public.public_identity_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    -- ASSURE-F09: the answer THIS COMMAND committed, never the label the
    -- identity happens to display now.
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.public_identity_ref,
                        answer.label_mode, answer.display_label, answer.label_revision,
                        committed.committed_at
      FROM public.derive_public_identity_command_answer_v1(committed.id) answer;
    RETURN;
  END IF;

  -- The identity's own row is the serialization point. Two concurrent first
  -- creations collide on UNIQUE (user_id) and the loser re-reads.
  SELECT * INTO existing FROM public.public_identities i WHERE i.user_id = u FOR UPDATE;
  instant := clock_timestamp();
  IF FOUND THEN
    SELECT * INTO display FROM public.public_identity_display_state d
     WHERE d.public_identity_ref = existing.public_identity_ref;
    INSERT INTO public.public_identity_commands
      (id, command_kind, actor_user_id, public_identity_ref, label_revision, request_ref, committed_at,
       committed_label_mode, committed_display_label)
    VALUES (p_command_id, 'ENSURE_PUBLIC_IDENTITY', u, existing.public_identity_ref,
            display.label_revision, request, instant, display.label_mode, display.display_label);
    RETURN QUERY SELECT 'ALREADY_PRESENT'::text, existing.public_identity_ref,
                        display.label_mode, display.display_label, display.label_revision, instant;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.public_identities (public_identity_ref, user_id, created_at)
    VALUES (p_public_identity_ref, u, instant);
  EXCEPTION WHEN unique_violation THEN
    -- Two different failures wear the same SQLSTATE, and telling them apart is
    -- the difference between "retry" and "choose another identity": a concurrent
    -- first creation by the same human lost the race on UNIQUE (user_id), while a
    -- reused public ref belongs to somebody else already.
    --
    -- The item is CONSTRAINT_NAME. PostgreSQL's `PG_EXCEPTION_` prefix exists for
    -- DETAIL, HINT and CONTEXT only; the constraint, column, table and schema
    -- items are unprefixed, and an invented name is not a syntax error the
    -- surrounding SQL reveals - plpgsql rejects it when the FUNCTION is created,
    -- and reports it at the line of the closing END.
    GET STACKED DIAGNOSTICS conflict = CONSTRAINT_NAME;
    IF conflict = 'public_identities_user_key' THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE' USING ERRCODE='40001';
    END IF;
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;
  INSERT INTO public.public_identity_display_state
    (public_identity_ref, label_mode, display_label, label_revision, updated_at)
  VALUES (p_public_identity_ref, p_label_mode, btrim(p_display_label), 1, instant);
  INSERT INTO public.public_identity_commands
    (id, command_kind, actor_user_id, public_identity_ref, label_revision, request_ref, committed_at,
     committed_label_mode, committed_display_label)
  VALUES (p_command_id, 'ENSURE_PUBLIC_IDENTITY', u, p_public_identity_ref, 1, request, instant,
          p_label_mode, btrim(p_display_label));

  RETURN QUERY SELECT 'CREATED'::text, p_public_identity_ref, p_label_mode,
                      btrim(p_display_label), 1::bigint, instant;
END$$;

CREATE OR REPLACE FUNCTION public.update_public_display_label_v1(
  p_command_id uuid, p_label_mode text, p_display_label text
) RETURNS TABLE(outcome text, public_identity_ref uuid, label_mode text,
                display_label text, label_revision bigint, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.public_identity_commands;
  owned public.public_identities;
  display public.public_identity_display_state;
  request text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_label_mode IS NULL OR p_label_mode NOT IN ('PSEUDONYM', 'REAL_NAME')
     OR p_display_label IS NULL OR length(btrim(p_display_label)) = 0 OR length(p_display_label) > 64 THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_PUBLIC_IDENTITY_COMMAND_V1' || E'\n'
   || 'kind=UPDATE_PUBLIC_DISPLAY_LABEL' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'mode=' || p_label_mode || E'\n'
   || 'label=' || 'sha256:' || encode(sha256(convert_to(p_display_label, 'UTF8')), 'hex'), 'UTF8')), 'hex');

  SELECT * INTO committed FROM public.public_identity_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    -- ASSURE-F09: a LATER label change moved the display row, and it did not
    -- move what this command answered.
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.public_identity_ref,
                        answer.label_mode, answer.display_label, answer.label_revision,
                        committed.committed_at
      FROM public.derive_public_identity_command_answer_v1(committed.id) answer;
    RETURN;
  END IF;

  -- THE ACTOR OWNS THE PUBLIC IDENTITY EXACTLY. There is no identity parameter,
  -- so one human can never rename another human's public presentation.
  SELECT * INTO owned FROM public.public_identities i WHERE i.user_id = u FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;

  instant := clock_timestamp();
  UPDATE public.public_identity_display_state d
     SET label_mode = p_label_mode, display_label = btrim(p_display_label),
         label_revision = d.label_revision + 1, updated_at = instant
   WHERE d.public_identity_ref = owned.public_identity_ref
  RETURNING * INTO display;

  INSERT INTO public.public_identity_commands
    (id, command_kind, actor_user_id, public_identity_ref, label_revision, request_ref, committed_at,
     committed_label_mode, committed_display_label)
  VALUES (p_command_id, 'UPDATE_PUBLIC_DISPLAY_LABEL', u, owned.public_identity_ref,
          display.label_revision, request, instant, display.label_mode, display.display_label);

  RETURN QUERY SELECT 'UPDATED'::text, owned.public_identity_ref, display.label_mode,
                      display.display_label, display.label_revision, instant;
END$$;

CREATE OR REPLACE FUNCTION public.create_public_experience_draft_v1(
  p_command_id uuid, p_experience_id uuid
) RETURNS TABLE(outcome text, experience_id uuid, created_by_public_identity_ref uuid,
                current_lifecycle text, experience_revision bigint, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.public_experience_draft_commands;
  identity public.public_identities;
  request text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_PUBLIC_EXPERIENCE_DRAFT_COMMAND_V1' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'experience=' || lower(p_experience_id::text), 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, and reading only immutable
  -- command history.
  --
  -- ASSURE-F09: the lifecycle comes from the immutable event this creation
  -- wrote, and the revision is the literal 1 the creating INSERT wrote. Neither
  -- is the current pointer, which a later READY, publish or disappearance moves.
  SELECT * INTO committed FROM public.public_experience_draft_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.experience_id,
                        committed.created_by_public_identity_ref,
                        public.derive_public_command_lifecycle_v1(
                          committed.id, committed.experience_id, NULL, 'DRAFT', committed.committed_at),
                        1::bigint,
                        committed.committed_at;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEP 1: the ONE Public World.
  PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;

  SELECT * INTO committed FROM public.public_experience_draft_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.experience_id,
                        committed.created_by_public_identity_ref,
                        public.derive_public_command_lifecycle_v1(
                          committed.id, committed.experience_id, NULL, 'DRAFT', committed.committed_at),
                        1::bigint,
                        committed.committed_at;
    RETURN;
  END IF;

  -- THE ACTOR'S STABLE PUBLIC IDENTITY, RESOLVED. No parameter names it.
  SELECT * INTO identity FROM public.public_identities i WHERE i.user_id = u;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;

  -- ONE DATABASE-OWNED INSTANT for every authoritative fact of this creation.
  instant := clock_timestamp();

  BEGIN
    INSERT INTO public.public_experiences
      (id, public_world_singleton, created_by_public_identity_ref, current_lifecycle,
       current_experience_version_id, experience_revision, created_at)
    VALUES (p_experience_id, true, identity.public_identity_ref, 'DRAFT', NULL, 1, instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;

  -- EXPERIENCE CONTROL, to the exact creating human. A content rightsholder is
  -- never inserted here by any approval.
  INSERT INTO public.public_experience_controllers
    (experience_id, controller_public_identity_ref, controller_user_id, control_basis, established_at)
  VALUES (p_experience_id, identity.public_identity_ref, u, 'EXPERIENCE_CREATION', instant);

  -- The lifecycle event reuses the command identity, so a caller that reuses one
  -- uuid across two different command families is refused with a bounded class
  -- rather than a raw constraint name.
  BEGIN
    INSERT INTO public.public_experience_lifecycle_events
      (id, experience_id, experience_version_id, from_lifecycle, to_lifecycle, occurred_at)
    VALUES (p_command_id, p_experience_id, NULL, NULL, 'DRAFT', instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;

  INSERT INTO public.public_experience_draft_commands
    (id, experience_id, actor_user_id, created_by_public_identity_ref, request_ref, committed_at)
  VALUES (p_command_id, p_experience_id, u, identity.public_identity_ref, request, instant);

  RETURN QUERY SELECT 'DRAFT_CREATED'::text, p_experience_id, identity.public_identity_ref,
                      'DRAFT'::text, 1::bigint, instant;
END$$;

CREATE OR REPLACE FUNCTION public.commit_public_experience_ready_for_review_v1(
  p_command_id uuid, p_experience_id uuid, p_experience_version_id uuid
) RETURNS TABLE(outcome text, experience_id uuid, experience_version_id uuid,
                manifest_version_id uuid, current_lifecycle text, satisfied_approval_count integer,
                authority_request_fingerprint text, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.public_experience_review_ready_commands;
  experience public.public_experiences;
  committing public.public_experience_versions;
  manifest public.publication_package_manifest_versions;
  derived_approvers uuid[];
  derived_count integer;
  derived_fingerprint text;
  stored uuid[];
  satisfied integer;
  request text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_experience_id IS NULL OR p_experience_version_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_PUBLIC_REVIEW_READY_COMMAND_V1' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'experience=' || lower(p_experience_id::text) || E'\n'
   || 'experienceVersion=' || lower(p_experience_version_id::text), 'UTF8')), 'hex');

  SELECT * INTO committed FROM public.public_experience_review_ready_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    -- ASSURE-F09: the lifecycle THIS transition committed, from its own
    -- immutable event - not the one a later publish or disappearance left.
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.experience_id,
                        committed.experience_version_id, committed.manifest_version_id,
                        public.derive_public_command_lifecycle_v1(
                          committed.id, committed.experience_id, committed.experience_version_id,
                          'READY_FOR_REVIEW', committed.committed_at),
                        committed.satisfied_approval_count,
                        committed.authority_request_fingerprint, committed.committed_at;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEPS 1 AND 2.
  PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;
  SELECT * INTO experience FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO committed FROM public.public_experience_review_ready_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.experience_id,
                        committed.experience_version_id, committed.manifest_version_id,
                        public.derive_public_command_lifecycle_v1(
                          committed.id, committed.experience_id, committed.experience_version_id,
                          'READY_FOR_REVIEW', committed.committed_at),
                        committed.satisfied_approval_count,
                        committed.authority_request_fingerprint, committed.committed_at;
    RETURN;
  END IF;

  -- THE EXACT CONTROLLER. A content rightsholder never acquires this, and a
  -- controller can never bypass a missing content approval below.
  IF NOT EXISTS (SELECT 1 FROM public.public_experience_controllers c
                  WHERE c.experience_id = p_experience_id AND c.controller_user_id = u) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;
  IF experience.current_lifecycle <> 'DRAFT' THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_LIFECYCLE_INVALID' USING ERRCODE='55000';
  END IF;

  -- THE EXACT VERSION, and it must still be the Experience's current one: a
  -- newer preparation stales this attempt rather than committing an old package.
  SELECT * INTO committing FROM public.public_experience_versions v
   WHERE v.id = p_experience_version_id AND v.experience_id = p_experience_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  IF experience.current_experience_version_id IS DISTINCT FROM p_experience_version_id THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE' USING ERRCODE='40001';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 3.
  SELECT * INTO manifest FROM public.publication_package_manifest_versions m
   WHERE m.id = committing.package_manifest_version_id FOR SHARE;
  IF NOT FOUND OR manifest.experience_id <> p_experience_id THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 4: the exact source rows, same relative order -
  -- the Shared World row first, exactly as every I-04 mutation takes it.
  PERFORM 1 FROM public.shared_worlds w
    WHERE w.id IN (SELECT p.shared_world_id FROM public.publication_package_item_provenance p
                    WHERE p.manifest_version_id = manifest.id AND p.source_class = 'SHARED_WORLD')
    ORDER BY w.id FOR SHARE;
  PERFORM 1 FROM public.shared_world_materials m
    WHERE m.id IN (SELECT p.shared_material_id FROM public.publication_package_item_provenance p
                    WHERE p.manifest_version_id = manifest.id AND p.source_class = 'SHARED_WORLD')
    ORDER BY m.id FOR SHARE;
  PERFORM 1 FROM public.shared_world_history_items i
    WHERE i.id IN (SELECT p.shared_history_item_id FROM public.publication_package_item_provenance p
                    WHERE p.manifest_version_id = manifest.id AND p.source_class = 'SHARED_WORLD')
    ORDER BY i.id FOR SHARE;
  PERFORM 1 FROM public.conversation_units cu
    WHERE cu.id IN (SELECT p.personal_conversation_unit_id FROM public.publication_package_item_provenance p
                     WHERE p.manifest_version_id = manifest.id AND p.source_class = 'MY_WORLD')
    ORDER BY cu.id FOR SHARE;

  -- REVALIDATE EVERYTHING, from the ONE derivation.
  SELECT d.required_approvers, d.required_approver_count, d.authority_fingerprint
    INTO derived_approvers, derived_count, derived_fingerprint
    FROM public.derive_public_publication_authority_v1(manifest.id) d;

  SELECT coalesce(array_agg(ra.approver_user_id ORDER BY ra.approver_user_id), ARRAY[]::uuid[])
    INTO stored FROM public.publication_manifest_required_approvers ra
   WHERE ra.manifest_version_id = manifest.id;
  IF stored <> derived_approvers THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE' USING ERRCODE='40001';
  END IF;

  -- EVERY REQUIRED APPROVAL IS PRESENT. A controller cannot substitute for one.
  SELECT count(*)::integer INTO satisfied FROM public.publication_manifest_approvals a
   WHERE a.manifest_version_id = manifest.id;
  IF satisfied <> derived_count THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_APPROVALS_INCOMPLETE' USING ERRCODE='P0002';
  END IF;
  -- AND EVERY APPROVAL STILL BINDS THE CURRENT AUTHORITY. An approval collected
  -- against a different source authority, required set or Public World authority
  -- snapshot cannot float forward onto this commit.
  IF EXISTS (SELECT 1 FROM public.publication_manifest_approvals a
              WHERE a.manifest_version_id = manifest.id
                AND a.bound_authority_fingerprint <> derived_fingerprint) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE' USING ERRCODE='40001';
  END IF;

  instant := clock_timestamp();

  UPDATE public.public_experiences e
     SET current_lifecycle = 'READY_FOR_REVIEW', experience_revision = e.experience_revision + 1
   WHERE e.id = p_experience_id;

  BEGIN
    INSERT INTO public.public_experience_lifecycle_events
      (id, experience_id, experience_version_id, from_lifecycle, to_lifecycle, occurred_at)
    VALUES (p_command_id, p_experience_id, p_experience_version_id, 'DRAFT', 'READY_FOR_REVIEW', instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;

  BEGIN
    INSERT INTO public.public_experience_review_ready_commands
      (id, experience_id, experience_version_id, manifest_version_id, actor_user_id,
       satisfied_approval_count, authority_request_fingerprint, request_ref, committed_at)
    VALUES (p_command_id, p_experience_id, p_experience_version_id, manifest.id, u,
            satisfied, derived_fingerprint, request, instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'READY_FOR_REVIEW'::text, p_experience_id, p_experience_version_id,
                      manifest.id, 'READY_FOR_REVIEW'::text, satisfied,
                      derived_fingerprint, instant;
END$$;

CREATE OR REPLACE FUNCTION public.publish_public_experience_v1(
  p_command_id uuid, p_experience_id uuid, p_experience_version_id uuid
) RETURNS TABLE(outcome text, experience_id uuid, experience_version_id uuid,
                manifest_version_id uuid, current_lifecycle text, effective_approval_count integer,
                authority_request_fingerprint text, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.public_experience_publish_commands;
  experience public.public_experiences;
  publishing public.public_experience_versions;
  manifest public.publication_package_manifest_versions;
  derived_approvers uuid[];
  derived_count integer;
  derived_fingerprint text;
  stored uuid[];
  effective integer;
  ready_fingerprint text;
  clearance_state text;
  clearance_reason text;
  request text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_experience_id IS NULL OR p_experience_version_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_PUBLIC_PUBLISH_COMMAND_V1' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'experience=' || lower(p_experience_id::text) || E'\n'
   || 'experienceVersion=' || lower(p_experience_version_id::text), 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock.
  --
  -- ASSURE-F09: a publication that later left the Public World did not change
  -- what the publish command answered, so the lifecycle comes from the immutable
  -- event this publish wrote.
  SELECT * INTO committed FROM public.public_experience_publish_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.experience_id, committed.experience_version_id,
                        committed.manifest_version_id,
                        public.derive_public_command_lifecycle_v1(
                          committed.id, committed.experience_id, committed.experience_version_id,
                          'PUBLISHED', committed.committed_at),
                        committed.effective_approval_count, committed.authority_request_fingerprint,
                        committed.committed_at;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEPS 1 AND 2.
  PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;
  SELECT * INTO experience FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;
  -- GATE 1: THE EXACT CONTROLLER, and nobody else. One bounded class for a
  -- nonexistent Experience and a non-controller alike, so a caller learns
  -- nothing about whether a guessed identifier names anything.
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.public_experience_controllers c
                                WHERE c.experience_id = p_experience_id AND c.controller_user_id = u) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;

  SELECT * INTO committed FROM public.public_experience_publish_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.experience_id, committed.experience_version_id,
                        committed.manifest_version_id,
                        public.derive_public_command_lifecycle_v1(
                          committed.id, committed.experience_id, committed.experience_version_id,
                          'PUBLISHED', committed.committed_at),
                        committed.effective_approval_count, committed.authority_request_fingerprint,
                        committed.committed_at;
    RETURN;
  END IF;

  -- GATE 2: LIFECYCLE ELIGIBILITY. READY_FOR_REVIEW and nothing else: DRAFT
  -- never jumps, and an Experience that already published does not publish
  -- again through a different command.
  IF experience.current_lifecycle <> 'READY_FOR_REVIEW' THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_LIFECYCLE_INVALID' USING ERRCODE='55000';
  END IF;

  -- GATE 3: THE EXACT IMMUTABLE VERSION - of this Experience, CURRENT, and the
  -- one the canonical READY transition committed.
  SELECT * INTO publishing FROM public.public_experience_versions v
   WHERE v.id = p_experience_version_id AND v.experience_id = p_experience_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  IF experience.current_experience_version_id IS DISTINCT FROM p_experience_version_id THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE' USING ERRCODE='40001';
  END IF;
  SELECT r.authority_request_fingerprint INTO ready_fingerprint
    FROM public.public_experience_review_ready_commands r
   WHERE r.experience_id = p_experience_id AND r.experience_version_id = p_experience_version_id;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.public_experience_lifecycle_events le
     WHERE le.experience_id = p_experience_id AND le.experience_version_id = p_experience_version_id
       AND le.to_lifecycle = 'READY_FOR_REVIEW') THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- GATE 4 / CANONICAL LOCK ORDER, STEP 3: the exact manifest, FOR SHARE.
  SELECT * INTO manifest FROM public.publication_package_manifest_versions m
   WHERE m.id = publishing.package_manifest_version_id FOR SHARE;
  IF NOT FOUND OR manifest.experience_id <> p_experience_id THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- GATE 5 / CANONICAL LOCK ORDER, STEPS 4-7: the exact source rows, in the
  -- SAME relative order every I-04 mutation uses - the Shared World row first,
  -- then materials by id, then history items by id, then the Personal units.
  PERFORM 1 FROM public.shared_worlds w
    WHERE w.id IN (SELECT p.shared_world_id FROM public.publication_package_item_provenance p
                    WHERE p.manifest_version_id = manifest.id AND p.source_class = 'SHARED_WORLD')
    ORDER BY w.id FOR SHARE;
  PERFORM 1 FROM public.shared_world_materials m
    WHERE m.id IN (SELECT p.shared_material_id FROM public.publication_package_item_provenance p
                    WHERE p.manifest_version_id = manifest.id AND p.source_class = 'SHARED_WORLD')
    ORDER BY m.id FOR SHARE;
  PERFORM 1 FROM public.shared_world_history_items i
    WHERE i.id IN (SELECT p.shared_history_item_id FROM public.publication_package_item_provenance p
                    WHERE p.manifest_version_id = manifest.id AND p.source_class = 'SHARED_WORLD')
    ORDER BY i.id FOR SHARE;
  PERFORM 1 FROM public.conversation_units cu
    WHERE cu.id IN (SELECT p.personal_conversation_unit_id FROM public.publication_package_item_provenance p
                     WHERE p.manifest_version_id = manifest.id AND p.source_class = 'MY_WORLD')
    ORDER BY cu.id FOR SHARE;

  -- GATE 6: CURRENT SOURCE ACCESS FOR THE PUBLISHING HUMAN. A Shared item the
  -- publisher may no longer SEE - they left, were removed, the World closed
  -- around an entitlement that excludes it - refuses with the SAME class a
  -- nonexistent source gets. The question is answered by the canonical I-04F
  -- entry point, never re-derived here. The Personal adapter is owner-exact.
  IF EXISTS (
    SELECT 1 FROM public.publication_package_item_provenance p
     WHERE p.manifest_version_id = manifest.id AND p.source_class = 'SHARED_WORLD'
       AND NOT EXISTS (
         SELECT 1 FROM public.resolve_shared_world_history_visibility_v1(p.shared_world_id, u) v
          WHERE v.history_item_id = p.shared_history_item_id)
  ) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_SOURCE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.publication_package_item_provenance p
     WHERE p.manifest_version_id = manifest.id AND p.source_class = 'MY_WORLD'
       AND p.personal_owner_user_id <> u
  ) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;

  -- GATE 7 / 8: THE ONE I-05A AUTHORITY DERIVATION, from current state. It
  -- raises on an unavailable source, an unresolved authority and contradictory
  -- metadata; the stored required set must still be the derived one.
  SELECT d.required_approvers, d.required_approver_count, d.authority_fingerprint
    INTO derived_approvers, derived_count, derived_fingerprint
    FROM public.derive_public_publication_authority_v1(manifest.id) d;
  SELECT coalesce(array_agg(ra.approver_user_id ORDER BY ra.approver_user_id), ARRAY[]::uuid[])
    INTO stored FROM public.publication_manifest_required_approvers ra
   WHERE ra.manifest_version_id = manifest.id;
  IF stored <> derived_approvers THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE' USING ERRCODE='40001';
  END IF;

  -- GATE 9: EVERY REQUIRED APPROVAL IS CURRENTLY EFFECTIVE, through the ONE
  -- 0094 derivation. Historical rows are never counted: a required approval
  -- that was never given is MISSING, one taken back is WITHDRAWN, one bound to
  -- a package this Experience no longer carries is SUPERSEDED, and one bound
  -- to a different fingerprint is stale. Each refuses. A controller cannot
  -- substitute for any of them.
  IF EXISTS (SELECT 1 FROM public.derive_publication_manifest_effective_approvals_v1(manifest.id) s
              WHERE s.effective_state = 'MISSING') THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_APPROVALS_INCOMPLETE' USING ERRCODE='P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM public.derive_publication_manifest_effective_approvals_v1(manifest.id) s
              WHERE s.effective_state <> 'EFFECTIVE') THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_APPROVAL_NOT_EFFECTIVE' USING ERRCODE='55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.derive_publication_manifest_effective_approvals_v1(manifest.id) s
              WHERE s.bound_authority_fingerprint IS DISTINCT FROM derived_fingerprint) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE' USING ERRCODE='40001';
  END IF;
  SELECT count(*)::integer INTO effective
    FROM public.derive_publication_manifest_effective_approvals_v1(manifest.id) s;
  IF effective <> derived_count THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- GATE 10: THE READY SNAPSHOT IS NOT TRUSTED. Its recorded fingerprint must
  -- still be the current one; anything that moved since is stale.
  IF ready_fingerprint IS DISTINCT FROM derived_fingerprint THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE' USING ERRCODE='40001';
  END IF;

  -- GATE 11, LAST: THE FROZEN CW2-08 PREREQUISITE, through the seam. Exactly
  -- CLEARED with a stated basis publishes; NOT_EVALUATED and anything else
  -- fails closed.
  SELECT c.clearance, c.clearance_basis INTO clearance_state, clearance_reason
    FROM public.resolve_public_publication_prerequisites_v1(p_experience_id, manifest.id) c;
  IF clearance_state IS DISTINCT FROM 'CLEARED'
     OR clearance_reason IS NULL OR length(btrim(clearance_reason)) = 0 THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_LAUNCH_PREREQUISITE_UNRESOLVED' USING ERRCODE='55000';
  END IF;

  -- ONE DATABASE-OWNED INSTANT for every authoritative fact of the publication.
  instant := clock_timestamp();

  UPDATE public.public_experiences e
     SET current_lifecycle = 'PUBLISHED', experience_revision = e.experience_revision + 1
   WHERE e.id = p_experience_id;

  INSERT INTO public.public_experience_publication_state
    (experience_id, published_experience_version_id, published_manifest_version_id,
     authority_request_fingerprint, prerequisite_clearance_basis, publication_revision, published_at)
  VALUES (p_experience_id, p_experience_version_id, manifest.id,
          derived_fingerprint, btrim(clearance_reason), 1, instant);

  BEGIN
    INSERT INTO public.public_experience_lifecycle_events
      (id, experience_id, experience_version_id, from_lifecycle, to_lifecycle, occurred_at)
    VALUES (p_command_id, p_experience_id, p_experience_version_id, 'READY_FOR_REVIEW', 'PUBLISHED', instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;

  BEGIN
    INSERT INTO public.public_experience_publish_commands
      (id, experience_id, experience_version_id, manifest_version_id, actor_user_id,
       effective_approval_count, authority_request_fingerprint, request_ref, committed_at)
    VALUES (p_command_id, p_experience_id, p_experience_version_id, manifest.id, u,
            effective, derived_fingerprint, request, instant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'PUBLISHED'::text, p_experience_id, p_experience_version_id, manifest.id,
                      'PUBLISHED'::text, effective, derived_fingerprint, instant;
END$$;

CREATE OR REPLACE FUNCTION public.remove_public_experience_from_public_world_v1(
  p_command_id uuid, p_experience_id uuid, p_experience_version_id uuid
) RETURNS TABLE(outcome text, experience_id uuid, absent_experience_version_id uuid,
                disappearance_basis text, current_lifecycle text, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.public_experience_disappearance_commands;
  experience public.public_experiences;
  publication public.public_experience_publication_state;
  applied record;
  sealed_basis text;
  request text;
  instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_experience_id IS NULL OR p_experience_version_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_PUBLIC_DISAPPEARANCE_COMMAND_V1' || E'\n'
   || 'kind=CONTROLLER_REMOVAL' || E'\n'
   || 'actor=' || lower(u::text) || E'\n'
   || 'experience=' || lower(p_experience_id::text) || E'\n'
   || 'experienceVersion=' || lower(p_experience_version_id::text), 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, reading only immutable
  -- command history. A reused identity carrying a different request is refused
  -- here, so it never discloses anything about the target it named.
  --
  -- ASSURE-F09: all three derived fields come from the ONE committed-answer
  -- derivation, which reads the historical lifecycle and the sealed record this
  -- exact command bound.
  SELECT * INTO committed FROM public.public_experience_disappearance_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.experience_id,
                        answer.absent_experience_version_id, answer.disappearance_basis,
                        answer.current_lifecycle, committed.committed_at
      FROM public.derive_public_disappearance_command_answer_v1(committed.id) answer;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEPS 1 AND 2.
  PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;
  SELECT * INTO experience FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;
  -- THE EXACT CONTROLLER, and nobody else. One bounded class for a nonexistent
  -- Experience and a non-controller alike, exactly as the frozen publish
  -- boundary answers: a caller learns nothing about whether a guessed
  -- identifier names anything.
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.public_experience_controllers c
                                WHERE c.experience_id = p_experience_id AND c.controller_user_id = u) THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_NOT_AUTHORIZED' USING ERRCODE='42501';
  END IF;

  -- DURABLE IDEMPOTENCY, SECOND PASS, under the locks, so two competing
  -- removals serialize and the loser returns the committed result.
  SELECT * INTO committed FROM public.public_experience_disappearance_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.experience_id,
                        answer.absent_experience_version_id, answer.disappearance_basis,
                        answer.current_lifecycle, committed.committed_at
      FROM public.derive_public_disappearance_command_answer_v1(committed.id) answer;
    RETURN;
  END IF;

  -- A DRAFT and a READY_FOR_REVIEW Experience were never in the Public World,
  -- so there is nothing to remove FROM it. Public disappearance is not a
  -- general delete, and I-05C invents no lifecycle it was not given.
  IF experience.current_lifecycle NOT IN ('PUBLISHED', 'ABSENT_FROM_PUBLIC_WORLD') THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_LIFECYCLE_INVALID' USING ERRCODE='55000';
  END IF;

  SELECT * INTO publication FROM public.public_experience_publication_state s
   WHERE s.experience_id = p_experience_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  -- THE EXACT TARGET. The caller names the exact published version, and it must
  -- be the one the immutable record holds; the manifest is read from that same
  -- record and is never a parameter, so the command row binds ONE exact
  -- publication.
  IF publication.published_experience_version_id IS DISTINCT FROM p_experience_version_id THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_STALE' USING ERRCODE='40001';
  END IF;

  IF experience.current_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD' THEN
    instant := clock_timestamp();
    -- THE ANSWER THIS COMMAND IS ABOUT TO RETURN, read once and recorded with
    -- it: the basis of the sealed record for the EXACT publication named.
    SELECT d.disappearance_basis INTO sealed_basis
      FROM public.public_experience_disappearance_state d
     WHERE d.experience_id = p_experience_id
       AND d.absent_experience_version_id = publication.published_experience_version_id;
    IF sealed_basis IS NULL THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;
    INSERT INTO public.public_experience_disappearance_commands
      (id, command_kind, experience_id, target_experience_version_id, target_manifest_version_id,
       actor_user_id, request_ref, committed_at,
       committed_absent_experience_version_id, committed_disappearance_basis, committed_lifecycle)
    VALUES (p_command_id, 'CONTROLLER_REMOVAL', p_experience_id,
            publication.published_experience_version_id, publication.published_manifest_version_id,
            u, request, instant,
            publication.published_experience_version_id, sealed_basis, 'ABSENT_FROM_PUBLIC_WORLD');
    RETURN QUERY SELECT 'ALREADY_ABSENT'::text, p_experience_id,
                        publication.published_experience_version_id, sealed_basis,
                        experience.current_lifecycle, instant;
    RETURN;
  END IF;

  -- THE ONE CONTROLLED PATH. Atomic with the decision: the lifecycle, the
  -- transition, the sealed evidence, the projection cleanup and the command
  -- below are one transaction, and any failure leaves nothing behind.
  SELECT * INTO applied FROM public.apply_public_experience_disappearance_v1(
    p_command_id, p_experience_id, 'AUTHORIZED_CONTROLLER_REMOVAL');

  INSERT INTO public.public_experience_disappearance_commands
    (id, command_kind, experience_id, target_experience_version_id, target_manifest_version_id,
     actor_user_id, request_ref, committed_at,
     committed_absent_experience_version_id, committed_disappearance_basis, committed_lifecycle)
  VALUES (p_command_id, 'CONTROLLER_REMOVAL', p_experience_id,
          applied.absent_experience_version_id, applied.absent_manifest_version_id,
          u, request, applied.absent_since,
          applied.absent_experience_version_id, 'AUTHORIZED_CONTROLLER_REMOVAL', 'ABSENT_FROM_PUBLIC_WORLD');

  RETURN QUERY SELECT 'REMOVED_FROM_PUBLIC_WORLD'::text, p_experience_id,
                      applied.absent_experience_version_id, 'AUTHORIZED_CONTROLLER_REMOVAL'::text,
                      'ABSENT_FROM_PUBLIC_WORLD'::text, applied.absent_since;
END$$;

CREATE OR REPLACE FUNCTION public.reconcile_public_experience_disappearance_v1(
  p_command_id uuid, p_experience_id uuid
) RETURNS TABLE(outcome text, experience_id uuid, absent_experience_version_id uuid,
                disappearance_basis text, current_lifecycle text, committed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path='' AS $$
DECLARE
  committed public.public_experience_disappearance_commands;
  experience public.public_experiences;
  publication public.public_experience_publication_state;
  eligibility record;
  applied record;
  sealed_basis text;
  request text;
  instant timestamptz;
BEGIN
  IF p_command_id IS NULL OR p_experience_id IS NULL THEN
    RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_PUBLIC_DISAPPEARANCE_COMMAND_V1' || E'\n'
   || 'kind=DISAPPEARANCE_RECONCILIATION' || E'\n'
   || 'experience=' || lower(p_experience_id::text), 'UTF8')), 'hex');

  -- DURABLE IDEMPOTENCY, FIRST PASS.
  --
  -- ASSURE-F09, the sharpest case in the census: a STILL_ELIGIBLE answer
  -- returned a NULL version and a NULL basis beside PUBLISHED, and the frozen
  -- retry answered with the command's target version, with whatever basis a
  -- LATER convergence wrote, and with whatever lifecycle the Experience reached
  -- afterwards. All three now come from the ONE committed-answer derivation.
  SELECT * INTO committed FROM public.public_experience_disappearance_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.experience_id,
                        answer.absent_experience_version_id, answer.disappearance_basis,
                        answer.current_lifecycle, committed.committed_at
      FROM public.derive_public_disappearance_command_answer_v1(committed.id) answer;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEPS 1 AND 2.
  PERFORM 1 FROM public.public_world_state w WHERE w.singleton FOR UPDATE;
  SELECT * INTO experience FROM public.public_experiences e WHERE e.id = p_experience_id FOR UPDATE;
  IF NOT FOUND THEN
    -- An identifier that names nothing is NOT_APPLICABLE, not an error: this
    -- primitive is machine convergence and is not an existence oracle either.
    -- No command row is recorded, because a command may not name an Experience
    -- that does not exist.
    RETURN QUERY SELECT 'NOT_APPLICABLE'::text, p_experience_id, NULL::uuid, NULL::text,
                        NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT * INTO committed FROM public.public_experience_disappearance_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.request_ref <> request THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, committed.experience_id,
                        answer.absent_experience_version_id, answer.disappearance_basis,
                        answer.current_lifecycle, committed.committed_at
      FROM public.derive_public_disappearance_command_answer_v1(committed.id) answer;
    RETURN;
  END IF;

  SELECT * INTO publication FROM public.public_experience_publication_state s
   WHERE s.experience_id = p_experience_id;
  instant := clock_timestamp();

  -- AN EXPERIENCE THAT NEVER PUBLISHED HAS NOTHING TO CONVERGE. The absence of
  -- the record is read from the row variable rather than from FOUND, because an
  -- assignment sits between the query and this test and FOUND is a shared flag.
  IF publication.experience_id IS NULL
     OR experience.current_lifecycle NOT IN ('PUBLISHED', 'ABSENT_FROM_PUBLIC_WORLD') THEN
    INSERT INTO public.public_experience_disappearance_commands
      (id, command_kind, experience_id, target_experience_version_id, target_manifest_version_id,
       actor_user_id, request_ref, committed_at,
       committed_absent_experience_version_id, committed_disappearance_basis, committed_lifecycle)
    VALUES (p_command_id, 'DISAPPEARANCE_RECONCILIATION', p_experience_id, NULL, NULL, NULL, request, instant,
            NULL, NULL, experience.current_lifecycle);
    RETURN QUERY SELECT 'NOT_APPLICABLE'::text, p_experience_id, NULL::uuid, NULL::text,
                        experience.current_lifecycle, instant;
    RETURN;
  END IF;

  IF experience.current_lifecycle = 'ABSENT_FROM_PUBLIC_WORLD' THEN
    SELECT d.disappearance_basis INTO sealed_basis
      FROM public.public_experience_disappearance_state d
     WHERE d.experience_id = p_experience_id
       AND d.absent_experience_version_id = publication.published_experience_version_id;
    IF sealed_basis IS NULL THEN
      RAISE EXCEPTION 'PUBLIC_EXPERIENCE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;
    INSERT INTO public.public_experience_disappearance_commands
      (id, command_kind, experience_id, target_experience_version_id, target_manifest_version_id,
       actor_user_id, request_ref, committed_at,
       committed_absent_experience_version_id, committed_disappearance_basis, committed_lifecycle)
    VALUES (p_command_id, 'DISAPPEARANCE_RECONCILIATION', p_experience_id,
            publication.published_experience_version_id, publication.published_manifest_version_id,
            NULL, request, instant,
            publication.published_experience_version_id, sealed_basis, 'ABSENT_FROM_PUBLIC_WORLD');
    RETURN QUERY SELECT 'ALREADY_ABSENT'::text, p_experience_id,
                        publication.published_experience_version_id, sealed_basis,
                        experience.current_lifecycle, instant;
    RETURN;
  END IF;

  -- CANONICAL LOCK ORDER, STEP 3: the exact manifest, FOR SHARE. It is
  -- immutable, so this documents the hierarchy rather than defending a column.
  PERFORM 1 FROM public.publication_package_manifest_versions m
   WHERE m.id = publication.published_manifest_version_id FOR SHARE;
  -- CANONICAL LOCK ORDER, STEPS 4-7: the exact source rows, in the SAME
  -- relative order every I-04 consequential mutation uses - the Shared World
  -- row first, then materials by id, then history items by id, then the
  -- Personal units. Holding them is what stops the eligibility answer below
  -- from going stale between the decision and the transition.
  PERFORM 1 FROM public.shared_worlds w
    WHERE w.id IN (SELECT p.shared_world_id FROM public.publication_package_item_provenance p
                    WHERE p.manifest_version_id = publication.published_manifest_version_id
                      AND p.source_class = 'SHARED_WORLD')
    ORDER BY w.id FOR SHARE;
  PERFORM 1 FROM public.shared_world_materials m
    WHERE m.id IN (SELECT p.shared_material_id FROM public.publication_package_item_provenance p
                    WHERE p.manifest_version_id = publication.published_manifest_version_id
                      AND p.source_class = 'SHARED_WORLD')
    ORDER BY m.id FOR SHARE;
  PERFORM 1 FROM public.shared_world_history_items i
    WHERE i.id IN (SELECT p.shared_history_item_id FROM public.publication_package_item_provenance p
                    WHERE p.manifest_version_id = publication.published_manifest_version_id
                      AND p.source_class = 'SHARED_WORLD')
    ORDER BY i.id FOR SHARE;
  PERFORM 1 FROM public.conversation_units cu
    WHERE cu.id IN (SELECT p.personal_conversation_unit_id FROM public.publication_package_item_provenance p
                     WHERE p.manifest_version_id = publication.published_manifest_version_id
                       AND p.source_class = 'MY_WORLD')
    ORDER BY cu.id FOR SHARE;

  -- THE ONE CONTINUING ELIGIBILITY TRUTH, under those locks.
  SELECT * INTO eligibility FROM public.derive_public_continuing_eligibility_v1(p_experience_id);

  IF eligibility.eligibility_state = 'ELIGIBLE' THEN
    -- THE ANSWER IS RECORDED AS THE ANSWER: no absent version and no basis,
    -- beside the lifecycle the Experience really was in. The frozen retry
    -- replayed the command's TARGET here, which this command never returned.
    INSERT INTO public.public_experience_disappearance_commands
      (id, command_kind, experience_id, target_experience_version_id, target_manifest_version_id,
       actor_user_id, request_ref, committed_at,
       committed_absent_experience_version_id, committed_disappearance_basis, committed_lifecycle)
    VALUES (p_command_id, 'DISAPPEARANCE_RECONCILIATION', p_experience_id,
            publication.published_experience_version_id, publication.published_manifest_version_id,
            NULL, request, instant,
            NULL, NULL, experience.current_lifecycle);
    RETURN QUERY SELECT 'STILL_ELIGIBLE'::text, p_experience_id, NULL::uuid, NULL::text,
                        experience.current_lifecycle, instant;
    RETURN;
  END IF;

  -- A PUBLISHED Experience whose publication binding does not hold is
  -- contradictory state, not a disappearance cause. Serving is already dark for
  -- it; the convergence refuses to invent a reason and writes no evidence.
  IF eligibility.ineligibility_class NOT IN ('REQUIRED_APPROVAL_NOT_EFFECTIVE',
                                             'PUBLISHED_SOURCE_NOT_AVAILABLE',
                                             'PUBLICATION_AUTHORITY_INVALIDATED') THEN
    INSERT INTO public.public_experience_disappearance_commands
      (id, command_kind, experience_id, target_experience_version_id, target_manifest_version_id,
       actor_user_id, request_ref, committed_at,
       committed_absent_experience_version_id, committed_disappearance_basis, committed_lifecycle)
    VALUES (p_command_id, 'DISAPPEARANCE_RECONCILIATION', p_experience_id, NULL, NULL, NULL, request, instant,
            NULL, NULL, experience.current_lifecycle);
    RETURN QUERY SELECT 'NOT_APPLICABLE'::text, p_experience_id, NULL::uuid, NULL::text,
                        experience.current_lifecycle, instant;
    RETURN;
  END IF;

  -- THE ONE CONTROLLED PATH, with the class passed straight through: there is
  -- no second vocabulary to translate into and therefore nothing to drift.
  SELECT * INTO applied FROM public.apply_public_experience_disappearance_v1(
    p_command_id, p_experience_id, eligibility.ineligibility_class);

  INSERT INTO public.public_experience_disappearance_commands
    (id, command_kind, experience_id, target_experience_version_id, target_manifest_version_id,
     actor_user_id, request_ref, committed_at,
     committed_absent_experience_version_id, committed_disappearance_basis, committed_lifecycle)
  VALUES (p_command_id, 'DISAPPEARANCE_RECONCILIATION', p_experience_id,
          applied.absent_experience_version_id, applied.absent_manifest_version_id,
          NULL, request, applied.absent_since,
          applied.absent_experience_version_id, eligibility.ineligibility_class, 'ABSENT_FROM_PUBLIC_WORLD');

  RETURN QUERY SELECT 'DISAPPEARANCE_CONVERGED'::text, p_experience_id,
                      applied.absent_experience_version_id, eligibility.ineligibility_class,
                      'ABSENT_FROM_PUBLIC_WORLD'::text, applied.absent_since;
END$$;

-- ---------------------------------------------------------------------------
-- 4. OWNERSHIP AND THE PRE-LAUNCH ACL, RE-ASSERTED.
--
--    Every replaced boundary keeps the posture it had. CREATE OR REPLACE
--    preserves the existing ACL, and re-stating it here means a future reader
--    does not have to go and check.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  replaced text[] := ARRAY[
    'public.ensure_public_identity_v1(uuid, uuid, text, text)',
    'public.update_public_display_label_v1(uuid, text, text)',
    'public.create_public_experience_draft_v1(uuid, uuid)',
    'public.commit_public_experience_ready_for_review_v1(uuid, uuid, uuid)',
    'public.publish_public_experience_v1(uuid, uuid, uuid)',
    'public.remove_public_experience_from_public_world_v1(uuid, uuid, uuid)',
    'public.reconcile_public_experience_disappearance_v1(uuid, uuid)',
    'public.derive_replay_distribution_approval_effective_state_v1(uuid)'];
  target text;
BEGIN
  FOREACH target IN ARRAY replaced LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', target);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', target);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', target);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 5. TERMINAL SELF-ASSERTIONS.
--
--    Each one is a property this migration's correctness rests on, checked
--    against the catalog rather than trusted from a comment.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  p record;
  target_role text;
  writers integer;
BEGIN
  -- A1. THE LIFECYCLE EVENT LOG IS COMPLETE, which is what makes both the exact
  --     command binding of section 2.0 and the legacy fallback of section 2.1
  --     historical truth rather than an approximation. Exactly four functions
  --     write `public_experiences.current_lifecycle`, and every one of them
  --     writes a lifecycle event in the same body.
  --
  --     THE PATTERN NAMES THE RELATION, not just the column. `current_lifecycle`
  --     is also a column of `public.replays`, so a column-only census counts the
  --     three frozen I-06B Replay lifecycle writers as Public ones - which is
  --     exactly what the first run of this assertion did.
  SELECT count(*)::integer INTO writers
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
     AND (pr.prosrc ~ 'UPDATE public\.public_experiences e\s+SET current_lifecycle = '''
       OR pr.prosrc ~ 'INSERT INTO public\.public_experiences\s+\(id, public_world_singleton');
  IF writers <> 4 THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: exactly four functions may move a Public Experience lifecycle, found %', writers;
  END IF;
  FOR p IN SELECT pr.* FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
              AND (pr.prosrc ~ 'UPDATE public\.public_experiences e\s+SET current_lifecycle = '''
                OR pr.prosrc ~ 'INSERT INTO public\.public_experiences\s+\(id, public_world_singleton') LOOP
    IF p.prosrc !~ 'INSERT INTO public\.public_experience_lifecycle_events' THEN
      RAISE EXCEPTION 'QAN-CW-REM-03: % moves a Public Experience lifecycle without writing the immutable event the historical derivation reads', p.proname;
    END IF;
  END LOOP;

  -- A2. THE FIVE CORRECTED FAMILIES REALLY CONSUME THE EXACT EVIDENCE.
  --
  --     REM03-HIST-01: the three lifecycle-moving families must bind their own
  --     event BY COMMAND IDENTITY, and must not reach the temporal fallback at
  --     all - an instant is not a command identity.
  FOR p IN SELECT pr.* FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'public'
              AND pr.proname IN ('create_public_experience_draft_v1',
                                 'commit_public_experience_ready_for_review_v1',
                                 'publish_public_experience_v1') LOOP
    IF p.prosrc !~ 'derive_public_command_lifecycle_v1\(\s*\n?\s*committed\.id, committed\.experience_id' THEN
      RAISE EXCEPTION 'QAN-CW-REM-03: % must answer its retry from the lifecycle event ITS OWN command id names', p.proname;
    END IF;
    IF p.prosrc ~ 'derive_public_experience_lifecycle_at_v1' THEN
      RAISE EXCEPTION 'QAN-CW-REM-03: % may not answer from a temporal reconstruction: an instant is not a command identity', p.proname;
    END IF;
    IF p.prosrc ~ 'e\.current_lifecycle FROM public\.public_experiences' THEN
      RAISE EXCEPTION 'QAN-CW-REM-03: % still reads the mutable current lifecycle as a historical answer', p.proname;
    END IF;
  END LOOP;
  --     And the disappearance family must both ANSWER from and RECORD its
  --     committed answer: a future command that stored nothing would silently
  --     fall through to the legacy fallback.
  FOR p IN SELECT pr.* FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'public'
              AND pr.proname IN ('remove_public_experience_from_public_world_v1',
                                 'reconcile_public_experience_disappearance_v1') LOOP
    IF p.prosrc !~ 'derive_public_disappearance_command_answer_v1' THEN
      RAISE EXCEPTION 'QAN-CW-REM-03: % must answer its retry from the committed-answer derivation', p.proname;
    END IF;
    IF p.prosrc !~ 'committed_absent_experience_version_id, committed_disappearance_basis, committed_lifecycle' THEN
      RAISE EXCEPTION 'QAN-CW-REM-03: % must record the exact answer it committed', p.proname;
    END IF;
    IF p.prosrc ~ 'derive_public_experience_lifecycle_at_v1' THEN
      RAISE EXCEPTION 'QAN-CW-REM-03: % may not reconstruct by time: it stores its answer', p.proname;
    END IF;
  END LOOP;
  --     The temporal fallback is reachable from exactly ONE place, and that
  --     place is the legacy branch of the committed-answer derivation.
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
         AND pr.proname <> 'derive_public_experience_lifecycle_at_v1'
         AND pr.prosrc ~ 'derive_public_experience_lifecycle_at_v1') <> 1 THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: the temporal lifecycle fallback may have exactly one caller, the legacy branch of the disappearance answer';
  END IF;
  FOR p IN SELECT pr.* FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'public'
              AND pr.proname IN ('ensure_public_identity_v1', 'update_public_display_label_v1') LOOP
    IF p.prosrc !~ 'derive_public_identity_command_answer_v1' THEN
      RAISE EXCEPTION 'QAN-CW-REM-03: % must answer its retry from the committed label answer', p.proname;
    END IF;
    IF p.prosrc !~ 'committed_display_label' THEN
      RAISE EXCEPTION 'QAN-CW-REM-03: % must record the answer it committed', p.proname;
    END IF;
  END LOOP;

  -- A3. THE REPLAY DERIVATION COMPOSES THE CANONICAL PUBLIC ONE and does not
  --     re-implement Public consent: it names the frozen derivation, it names
  --     the exact committed link, and it reads no Public withdrawal relation of
  --     its own.
  SELECT pr.* INTO p FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.proname = 'derive_replay_distribution_approval_effective_state_v1';
  IF p.prosrc !~ 'derive_publication_approval_effective_state_v1' THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: the Replay effective state must compose the canonical Public derivation';
  END IF;
  IF p.prosrc !~ 'linked_public_approval_id' THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: the Replay effective state must consume the EXACT linked Public approval';
  END IF;
  IF p.prosrc ~ 'publication_approval_withdrawal_events'
     OR p.prosrc ~ 'public_experience_versions' THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: Public withdrawal and supersession rules may not be re-implemented inside Replay';
  END IF;

  -- A4. NO GENERIC RESULT BLOB. The typed answer this task added is two text
  --     columns with bounded shapes, and nothing json-shaped reached any
  --     Connected Worlds command relation.
  IF EXISTS (SELECT 1 FROM information_schema.columns c
              WHERE c.table_schema = 'public'
                AND c.table_name IN ('public_identity_commands', 'public_experience_draft_commands',
                                     'publication_package_prepare_commands',
                                     'public_experience_review_ready_commands',
                                     'publication_approval_withdrawal_commands',
                                     'public_experience_publish_commands',
                                     'public_experience_disappearance_commands')
                AND c.data_type IN ('json', 'jsonb')) THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: a Public command history may not carry a generic JSON response blob';
  END IF;

  -- A5. NO APPLICATION ROLE GAINED ANYTHING. The three derivations this
  --     migration created are internal, and the boundaries it replaced are
  --     still executable by nobody.
  FOREACH target_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
       AND EXISTS (
         SELECT 1 FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
          WHERE n.nspname = 'public'
            AND pr.proname IN ('derive_public_command_lifecycle_v1',
                               'derive_public_experience_lifecycle_at_v1',
                               'derive_public_identity_command_answer_v1',
                               'derive_public_disappearance_command_answer_v1',
                               'derive_replay_distribution_approval_effective_state_v1',
                               'ensure_public_identity_v1', 'update_public_display_label_v1',
                               'create_public_experience_draft_v1',
                               'commit_public_experience_ready_for_review_v1',
                               'publish_public_experience_v1',
                               'remove_public_experience_from_public_world_v1',
                               'reconcile_public_experience_disappearance_v1')
            AND has_function_privilege(target_role, pr.oid, 'EXECUTE')) THEN
      RAISE EXCEPTION 'QAN-CW-REM-03: % must execute no Public or Replay consequential boundary', target_role;
    END IF;
  END LOOP;

  -- A6. NO NEW LOCK OF ANY KIND. The three new derivations are read-only and
  --     take nothing; the replaced boundaries keep exactly the canonical row
  --     locks they had.
  FOR p IN SELECT pr.* FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'public'
              AND pr.proname IN ('derive_public_command_lifecycle_v1',
                                 'derive_public_experience_lifecycle_at_v1',
                                 'derive_public_identity_command_answer_v1',
                                 'derive_public_disappearance_command_answer_v1',
                                 'derive_replay_distribution_approval_effective_state_v1') LOOP
    IF p.prosrc ~* 'pg_advisory|LOCK TABLE|FOR UPDATE|FOR SHARE|TRUNCATE' THEN
      RAISE EXCEPTION 'QAN-CW-REM-03: % must take no lock at all', p.proname;
    END IF;
    IF p.provolatile <> 's' THEN
      RAISE EXCEPTION 'QAN-CW-REM-03: % must be STABLE', p.proname;
    END IF;
  END LOOP;

  -- A7. NO ASSURE-F05. Nothing here recalls, deletes or invalidates a Public
  --     derivative because a source became unavailable.
  IF EXISTS (SELECT 1 FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
              WHERE n.nspname = 'public'
                AND pr.proname IN ('derive_public_command_lifecycle_v1',
                                   'derive_public_experience_lifecycle_at_v1',
                                   'derive_public_identity_command_answer_v1',
                                   'derive_public_disappearance_command_answer_v1')
                AND (pr.prosrc ~ 'DELETE FROM' OR pr.prosrc ~ 'UPDATE public\.'
                  OR pr.prosrc ~ 'INSERT INTO')) THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: a historical-answer derivation writes nothing';
  END IF;

  -- A8. BOTH ANSWER-CARRYING COMMAND HISTORIES ARE STRUCTURALLY APPEND-ONLY
  --     (REM03-HIST-02). Not "no role may write them" - no ONE may, the owner
  --     included - and not for some columns: for the row. Asserted from
  --     `pg_trigger` rather than from the DDL above, so a later migration that
  --     dropped or disabled either guard, or repointed it at a permissive
  --     function, fails here instead of quietly restoring mutability to an
  --     exact historical answer.
  --
  --     tgtype 27 = ROW (1) + BEFORE (2) + DELETE (8) + UPDATE (16), which is
  --     the whole claim: every UPDATE and every DELETE, one row at a time.
  FOR p IN SELECT unnest(ARRAY['public_identity_commands',
                               'public_experience_disappearance_commands']) AS relname LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger tg
        JOIN pg_class c ON c.oid = tg.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_proc fn ON fn.oid = tg.tgfoid
       WHERE n.nspname = 'public' AND c.relname = p.relname
         AND tg.tgname = p.relname || '_immutable'
         AND NOT tg.tgisinternal
         AND tg.tgtype = 27
         AND tg.tgenabled = 'O'
         AND fn.proname = 'reject_public_command_history_mutation_v1') THEN
      RAISE EXCEPTION 'QAN-CW-REM-03: public.% must carry an ENABLED BEFORE UPDATE OR DELETE append-only guard: an exact historical answer that can be edited is not one', p.relname;
    END IF;
  END LOOP;
  --     And no mutation path was added for them anywhere: nothing in the
  --     database UPDATEs or DELETEs either relation, so the guard refuses only
  --     what was never meant to happen.
  IF EXISTS (SELECT 1 FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
              WHERE n.nspname = 'public'
                AND pr.prosrc ~ '(UPDATE|DELETE FROM)\s+public\.(public_identity_commands|public_experience_disappearance_commands)\M') THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: no function may UPDATE or DELETE a Public command history row';
  END IF;
END$$;

COMMIT;
