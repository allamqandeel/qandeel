-- I-07B - Canonical Matching pair identity, proposal policy, candidate
-- eligibility and private proposal / recipient-view persistence v1.
--
-- I-07A created the private Matching SETUP substrate and deliberately stopped
-- before candidates, pairs and proposals. This forward-only migration creates
-- the first durable pair / eligibility / proposal / recipient-view state in the
-- repository, and - exactly as 0108 did for setup - it creates PERSISTENCE and
-- nothing else. There is no command, no resolver, no read boundary and no
-- application-reachable path of any kind here; 0111 adds the private evaluation
-- and disclosure boundary and 0112 adds the proposal choreography.
--
-- ## The frozen boundary this slice stops at
--
--     private Matching setup            (I-07A, migrations 0108 / 0109)
--          v
--     candidate eligibility / pair evaluation
--          v
--     bounded proposal preparation
--          v
--     first recipient offer -> decline OR forward approval
--          v
--     independent second-recipient proposal
--          v
--     second decline / expiry / withdrawal / stale
--          v
--     READY FOR THE I-07C ACCEPTANCE COMMIT
--
-- There is deliberately NO durable "accepted but not matched" intermediate
-- state. `SECOND_ACCEPTED`, `ACCEPTED_PENDING_MATCH`, `MATCH_PENDING` and
-- `INTRODUCTION_RESERVED` do not exist and cannot be spelled: the second
-- recipient's acceptance must revalidate its exact view and converge atomically
-- with the Mutual Match / two-slot / Introduction-birth transaction, which is
-- I-07C's work. Nothing here creates an Introduction slot, a match commit, an
-- Introduction record, a Shared World or a Matching handoff package.
--
-- ## Canonical unordered pair identity (task section 6)
--
-- `public.matching_pairs` stores ONE row per unordered pair, and the reverse
-- direction is UNREPRESENTABLE rather than merely de-duplicated: the two members
-- are stored as `lower_user_id` and `higher_user_id` with a CHECK that the first
-- really is the smaller, and a UNIQUE over the ordered column pair. There is no
-- second row for (B,A) to collide with, because (B,A) cannot be written at all.
-- `PAIR_KEY(A,B) = PAIR_KEY(B,A)` is therefore a property of the schema and not
-- of a convention a later writer could forget.
--
-- Direction is a property of a PROPOSAL, not of the pair, and it is immutable
-- once prepared. A proposal names the pair and names which of the pair's two
-- humans is the first recipient; the candidate is the other one, and a CHECK
-- refuses any other combination. A proposal can therefore never name a human who
-- is not a member of its own pair, and first recipient and candidate can never
-- be the same person.
--
-- AT MOST ONE LIVE PROPOSAL EXISTS PER PAIR, in either direction, enforced by a
-- partial UNIQUE index on `pair_id` over the four live states. Because the pair
-- row is unordered, one index covers both directions.
--
-- ## Proposal state (task section 8)
--
-- The canonical vocabulary is all eleven CW2-06 states. I-07B has a producer for
-- nine of them. `CANCELLED_BY_COMPETING_MATCH` and `MUTUAL_MATCH_COMMITTED` are
-- REPRESENTABLE here and have NO I-07B producer at all - the same disposition
-- migration 0108 takes for the four reserved pause reasons, and the same one
-- migration 0089 takes for reserved material kinds. Representability is what
-- lets I-07C add its producers as an ordinary forward migration; a DDL ceiling
-- that refused them would have to be relaxed later, which is the thing forward
-- safety exists to prevent.
--
-- Current proposal state is NOT stored twice. `matching_proposals.proposal_state`
-- and `matching_proposals.current_transition_id` are bound to ONE EXACT ROW of
-- `matching_proposal_transitions` by a three-column composite foreign key
-- (transition, proposal, resulting state), so the state on the proposal cannot
-- disagree with the transition it names. `PREPARED` is the birth state and is
-- carried by the proposal row itself - the proposal id IS the preparation
-- command id - so `current_transition_id IS NULL` exactly when the state is
-- `PREPARED`, and there is no circular foreign key to defer.
--
-- Transitions form a CHAIN: each names the transition it supersedes and the
-- state it moves out of, bound by the same composite key, with a partial unique
-- index so a transition is superseded at most once. The legal (from, to) pairs
-- are a row-value IN list, so an illegal transition is refused by the database
-- rather than by whichever command happens to be written next, and a terminal
-- state appears on no left-hand side at all.
--
-- ## Who acted is fixed by identity, never by data (task sections 10, 12, 18)
--
-- A transition carries at most one actor, in one of two typed slots:
-- `first_recipient_actor_id` and `candidate_actor_id`, each bound by composite
-- foreign key to that exact role of that exact proposal. A CHECK then pins which
-- slot each resulting state may use. A candidate can therefore never be recorded
-- as having declined the FIRST offer, the first recipient can never be recorded
-- as the second decliner, and a system transition - an offer, a forward, an
-- expiry, a staleness - can carry no human actor at all. The two I-07C states
-- are pinned here too, so that slice inherits the rule instead of editing it.
--
-- ## Candidate self-truth and PASS | FAIL | UNKNOWN (task sections 3, 4)
--
-- `public.matching_hard_requirement_results` records one outcome per hard
-- requirement of one human, against one eligibility snapshot, bound by composite
-- foreign key to a REAL requirement item of that exact requirement version. The
-- outcome vocabulary is exactly `PASS | FAIL | UNKNOWN`, and the source-class
-- vocabulary contains only the four allowed self-truth classes plus
-- `NOT_ESTABLISHED`. There is no `INFERRED_FROM_NAME`, no `THIRD_PARTY_CLAIM`
-- and no stereotype-bearing proxy: a third-party claim is not refused at
-- runtime, it CANNOT BE SPELLED.
--
-- The load-bearing CHECK is one line:
--
--     (requirement_outcome = 'UNKNOWN') = (evidence_source_class = 'NOT_ESTABLISHED')
--
-- An UNKNOWN therefore cannot carry a confirmed source, and a PASS cannot exist
-- without one. UNKNOWN NEVER SILENTLY BECOMES PASS, because the row is
-- append-only for every role including the table owner, and because promoting it
-- would require naming an allowed source class that the evaluation did not have.
-- There is no weight, score, rank, percentage or priority column anywhere, so a
-- strong soft preference has nothing to override a hard FAIL or hard UNKNOWN
-- with.
--
-- ## The eligibility snapshot binds EXACT identities (task section 5)
--
-- `public.matching_eligibility_snapshots` is the CANDIDATE_ELIGIBILITY_SNAPSHOT.
-- It is immutable, and every identity it binds is bound by a COMPOSITE foreign
-- key to a row OF THAT EXACT HUMAN - participation act, Matching Context Grant,
-- Introduction Profile version, Matching requirement version and Pre-Match
-- Disclosure Authority - using the composite identity keys 0108 already
-- declares. A snapshot can therefore never bind one human's participation to
-- another human's profile. The three proposal policy identities it relies on are
-- bound the same way, each with its kind pinned by a single-value CHECK, so a
-- cadence policy can never be read as an expiry.
--
-- It carries no aggregate "eligible" column, because an aggregate would be a
-- second copy of a truth the results already hold. Eligibility is derived, and
-- 0110 makes the derivation load-bearing with a truth trigger: a proposal cannot
-- be created from a snapshot that has a single non-PASS hard result, and a
-- result cannot be appended to a snapshot a proposal already consumed. A live
-- proposal's snapshot therefore has no FAIL and no UNKNOWN, ever.
--
-- I-07B does NOT implement `ACTIVE_INTRODUCTION_SLOT`. The absence of an active
-- Introduction is a fact about the canonical Shared World substrate, derived
-- live by 0111 and revalidated at every advancing step;
-- `no_active_introduction_at_capture` records only that it was true when the
-- snapshot was taken, pinned by a CHECK so a snapshot taken while an
-- Introduction existed is unrepresentable.
--
-- ## The one-way privacy boundary (task sections 13, 14, 15)
--
--     private Matching reasoning        matching_private_reasoning_notes
--          v
--     safe conclusion CANDIDATE         matching_safe_conclusion_candidates
--          v
--     sensitive conclusion FILTER       matching_permitted_safe_conclusions
--          v                            matching_sensitive_filter_refusals
--     product-permitted safe conclusion
--          v
--     authorized recipient proposal     matching_recipient_proposal_views
--
-- These are FOUR DIFFERENT RELATIONS, not four states of one row, because the
-- boundary the architecture freezes is a change of TYPE and not a flag. A
-- recipient view binds a `matching_permitted_safe_conclusions` row, and that
-- relation's `filter_verdict` is pinned by a single-value CHECK to `PERMITTED` -
-- so a refused or unclassified conclusion is not "filtered out" at read time, it
-- cannot exist in the relation a view is able to reference. Absence IS refusal,
-- which is what fail-closed means structurally. The private refusal class lives
-- on a separate relation that no view can reach.
--
-- A safe conclusion candidate carries NO "the model says this is safe" column.
-- Provider output is untrusted input to this pipeline, and the only verdict that
-- exists is the filter's own.
--
-- ## The disclosure gate is structural (task section 15)
--
-- A disclosed field row is impossible unless BOTH of these are true, and each is
-- a foreign key rather than a check somebody has to remember:
--
--   * the SUBJECT human approved that exact field key on that exact Pre-Match
--     Disclosure Authority, which 0108 has already bound to that exact
--     Introduction Profile version;
--   * the current Product `PROPOSAL_SAFE_FIELDS` policy version permits that
--     exact field key.
--
-- Human authority is necessary and NOT sufficient, exactly as CW2-06 requires.
-- The Product policy is versioned and configurable, it freezes no Introduction
-- Profile catalogue, and no row of it is installed here - an unconfigured policy
-- has no current version, and 0111 fails closed on that.
--
-- I-07A bans a contact-route FIELD KEY. A field VALUE is bounded free text, so
-- this migration bans the contact route in the VALUE as well: a benign key
-- cannot smuggle a phone number, an email address, a URL, a bare domain or a
-- social handle into a recipient view. The ban is deliberately fail-closed and
-- will refuse some innocent text; refusing to disclose a sentence is recoverable
-- and disclosing a phone number before a Mutual Match is not.
--
-- ## Access posture
--
-- Every relation here is private operational state: postgres-owned, RLS-enabled
-- with ZERO policies, and revoked from PUBLIC, anon, authenticated and
-- service_role on every privilege. No policy, view, RPC or read boundary exists.
-- No pair, proposal or evaluation relation is a user-visible directory, and
-- nothing here can be enumerated by any application caller.
--
-- Migrations 0001-0109 are untouched. Migrations 0108 and 0109 are not altered,
-- widened or re-owned: this slice ADDS relations that reference the sealed
-- setup state as foreign-key parents and changes none of it.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. CANONICAL UNORDERED PAIR IDENTITY.
--
--    Not a people directory and not a user-facing identifier: a pair row says
--    only that QANDEEL has considered these two humans together. Nothing can
--    read it (see the access posture below) and no boundary returns one.
-- ---------------------------------------------------------------------------
CREATE TABLE public.matching_pairs (
    id uuid PRIMARY KEY,
    lower_user_id uuid NOT NULL,
    higher_user_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- The unordered identity. (B,A) is not de-duplicated - it is unwritable.
    CONSTRAINT matching_pairs_canonical_order_check CHECK (lower_user_id < higher_user_id),
    CONSTRAINT matching_pairs_unordered_key UNIQUE (lower_user_id, higher_user_id),
    -- The composite identity children bind, so a child can never reach a member
    -- of a different pair.
    CONSTRAINT matching_pairs_member_identity_key UNIQUE (id, lower_user_id, higher_user_id),
    CONSTRAINT matching_pairs_lower_fk
        FOREIGN KEY (lower_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT matching_pairs_higher_fk
        FOREIGN KEY (higher_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

CREATE INDEX matching_pairs_lower_idx ON public.matching_pairs (lower_user_id);
CREATE INDEX matching_pairs_higher_idx ON public.matching_pairs (higher_user_id);

COMMENT ON TABLE public.matching_pairs IS
  'One canonical UNORDERED pair identity. The two members are stored smallest '
  'first with a CHECK and a UNIQUE over the ordered column pair, so the reverse '
  'direction is unrepresentable rather than merely de-duplicated. It is not a '
  'people directory, not a user-facing identifier and not enumerable by any '
  'application caller; direction belongs to a proposal, never to the pair.';

-- ---------------------------------------------------------------------------
-- 2. PROPOSAL POLICY - versioned, exact-identity bound, unconfigured by default.
--
--    The architecture's "about five proposals a week" is a PRODUCT TARGET, not a
--    database constant, so no cadence number, pending maximum or expiry duration
--    is frozen in DDL and NO ROW IS INSTALLED HERE. A required policy with no
--    current version fails closed in 0111; a verifier installs exact test
--    policies inside a transaction it rolls back.
-- ---------------------------------------------------------------------------
CREATE TABLE public.matching_proposal_policy_versions (
    id uuid PRIMARY KEY,
    policy_kind text NOT NULL,
    prior_policy_version_id uuid,
    window_days integer,
    max_count integer,
    expiry_hours integer,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT matching_proposal_policy_versions_kind_key UNIQUE (id, policy_kind),
    CONSTRAINT matching_proposal_policy_versions_kind_check
        CHECK (policy_kind IN ('PROPOSAL_CADENCE', 'PENDING_PROPOSAL_LIMIT', 'PROPOSAL_EXPIRY',
                               'PROPOSAL_SAFE_FIELDS', 'SENSITIVE_CONCLUSION_FILTER')),
    -- A version chain never crosses kinds, because the prior identity is bound
    -- by the composite (version, kind) key rather than by the version alone.
    CONSTRAINT matching_proposal_policy_versions_prior_fk
        FOREIGN KEY (prior_policy_version_id, policy_kind)
        REFERENCES public.matching_proposal_policy_versions (id, policy_kind) ON DELETE RESTRICT,
    CONSTRAINT matching_proposal_policy_versions_prior_check
        CHECK (prior_policy_version_id IS NULL OR prior_policy_version_id <> id),
    -- Each kind carries exactly the typed values it means, and no others. There
    -- is no JSON column and no generic value bag a later change could widen.
    CONSTRAINT matching_proposal_policy_versions_shape_check
        CHECK (CASE policy_kind
                 WHEN 'PROPOSAL_CADENCE'
                   THEN window_days IS NOT NULL AND max_count IS NOT NULL AND expiry_hours IS NULL
                 WHEN 'PENDING_PROPOSAL_LIMIT'
                   THEN window_days IS NULL AND max_count IS NOT NULL AND expiry_hours IS NULL
                 WHEN 'PROPOSAL_EXPIRY'
                   THEN window_days IS NULL AND max_count IS NULL AND expiry_hours IS NOT NULL
                 ELSE window_days IS NULL AND max_count IS NULL AND expiry_hours IS NULL
               END),
    CONSTRAINT matching_proposal_policy_versions_window_check
        CHECK (window_days IS NULL OR window_days > 0),
    CONSTRAINT matching_proposal_policy_versions_count_check
        CHECK (max_count IS NULL OR max_count >= 0),
    CONSTRAINT matching_proposal_policy_versions_expiry_check
        CHECK (expiry_hours IS NULL OR expiry_hours > 0)
);

CREATE UNIQUE INDEX matching_proposal_policy_versions_prior_idx
    ON public.matching_proposal_policy_versions (prior_policy_version_id)
    WHERE prior_policy_version_id IS NOT NULL;

COMMENT ON TABLE public.matching_proposal_policy_versions IS
  'Immutable versions of the configurable Product proposal policies. The exact '
  'weekly count, pending maximum and expiry duration are deferred Product '
  'decisions and none is frozen here or installed by this migration: a required '
  'policy with no current version fails the whole proposal path closed.';

CREATE TABLE public.matching_proposal_safe_field_keys (
    policy_version_id uuid NOT NULL,
    -- Pinned by a single-value CHECK so the composite foreign key below proves
    -- the parent really is a PROPOSAL_SAFE_FIELDS policy and not some other kind.
    policy_kind text NOT NULL DEFAULT 'PROPOSAL_SAFE_FIELDS',
    field_key text NOT NULL,
    CONSTRAINT matching_proposal_safe_field_keys_pkey PRIMARY KEY (policy_version_id, field_key),
    CONSTRAINT matching_proposal_safe_field_keys_kind_check
        CHECK (policy_kind = 'PROPOSAL_SAFE_FIELDS'),
    CONSTRAINT matching_proposal_safe_field_keys_policy_fk
        FOREIGN KEY (policy_version_id, policy_kind)
        REFERENCES public.matching_proposal_policy_versions (id, policy_kind) ON DELETE RESTRICT,
    CONSTRAINT matching_proposal_safe_field_keys_shape_check
        CHECK (field_key ~ '^[a-z][a-z0-9_]{2,47}$'),
    -- The same contact-route ban 0108 applies to a profile key. A Product policy
    -- may not permit a field key I-07A already made unwritable.
    CONSTRAINT matching_proposal_safe_field_keys_route_ban_check
        CHECK (field_key !~ ('(^|_)(phone|mobile|email|whatsapp|telegram|instagram|snapchat|tiktok'
                          || '|facebook|twitter|linkedin|handle|username|contact|address|street|geo|gps'
                          || '|latitude|longitude|coordinates|url|uri|link|photo|image|avatar|selfie'
                          || '|video|audio|passport|ssn|nid|kyc|password|token|id)(_|$)'))
);

COMMENT ON TABLE public.matching_proposal_safe_field_keys IS
  'The exact Introduction Profile field keys Product permits to cross into a '
  'pre-Match proposal. This is a SECOND gate beside human authority, never a '
  'substitute for it: a field is disclosable only when the human approved it AND '
  'this policy permits it. It freezes no Introduction Profile catalogue.';

CREATE TABLE public.matching_proposal_policy_state (
    policy_kind text PRIMARY KEY,
    current_policy_version_id uuid NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT matching_proposal_policy_state_current_key UNIQUE (current_policy_version_id),
    -- The pointer names an exact version OF THIS EXACT KIND.
    CONSTRAINT matching_proposal_policy_state_current_fk
        FOREIGN KEY (current_policy_version_id, policy_kind)
        REFERENCES public.matching_proposal_policy_versions (id, policy_kind) ON DELETE RESTRICT
);

COMMENT ON TABLE public.matching_proposal_policy_state IS
  'The ONE current version identity per proposal policy kind. Absence of a row '
  'is UNCONFIGURED and fails closed - it is never read as a permissive default.';

-- ---------------------------------------------------------------------------
-- 3. CANDIDATE ELIGIBILITY SNAPSHOT - immutable, and exact about every identity.
-- ---------------------------------------------------------------------------
CREATE TABLE public.matching_eligibility_snapshots (
    id uuid PRIMARY KEY,
    pair_id uuid NOT NULL,
    lower_user_id uuid NOT NULL,
    higher_user_id uuid NOT NULL,
    -- I-07A participation, grant, profile, requirement and disclosure identities,
    -- each bound below to a row OF THAT EXACT HUMAN.
    lower_participation_event_id uuid NOT NULL,
    higher_participation_event_id uuid NOT NULL,
    lower_context_grant_id uuid NOT NULL,
    higher_context_grant_id uuid NOT NULL,
    lower_profile_version_id uuid NOT NULL,
    higher_profile_version_id uuid NOT NULL,
    lower_requirement_version_id uuid NOT NULL,
    higher_requirement_version_id uuid NOT NULL,
    lower_disclosure_authority_id uuid NOT NULL,
    higher_disclosure_authority_id uuid NOT NULL,
    -- The three policy identities proposal preparation relies on, each with its
    -- kind pinned so a cadence policy can never be consumed as an expiry.
    cadence_policy_version_id uuid NOT NULL,
    cadence_policy_kind text NOT NULL DEFAULT 'PROPOSAL_CADENCE',
    pending_policy_version_id uuid NOT NULL,
    pending_policy_kind text NOT NULL DEFAULT 'PENDING_PROPOSAL_LIMIT',
    expiry_policy_version_id uuid NOT NULL,
    expiry_policy_kind text NOT NULL DEFAULT 'PROPOSAL_EXPIRY',
    -- A snapshot taken while either human held an active Introduction is
    -- unrepresentable. Continuing truth is revalidated live at every advance.
    no_active_introduction_at_capture boolean NOT NULL DEFAULT true,
    captured_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT matching_eligibility_snapshots_pair_key UNIQUE (id, pair_id),
    CONSTRAINT matching_eligibility_snapshots_pair_fk
        FOREIGN KEY (pair_id, lower_user_id, higher_user_id)
        REFERENCES public.matching_pairs (id, lower_user_id, higher_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_eligibility_snapshots_low_part_fk
        FOREIGN KEY (lower_participation_event_id, lower_user_id)
        REFERENCES public.matching_participation_events (id, participant_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_eligibility_snapshots_high_part_fk
        FOREIGN KEY (higher_participation_event_id, higher_user_id)
        REFERENCES public.matching_participation_events (id, participant_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_eligibility_snapshots_low_grant_fk
        FOREIGN KEY (lower_context_grant_id, lower_user_id)
        REFERENCES public.matching_context_grants (id, grantor_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_eligibility_snapshots_high_grant_fk
        FOREIGN KEY (higher_context_grant_id, higher_user_id)
        REFERENCES public.matching_context_grants (id, grantor_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_eligibility_snapshots_low_profile_fk
        FOREIGN KEY (lower_profile_version_id, lower_user_id)
        REFERENCES public.introduction_profile_versions (id, owner_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_eligibility_snapshots_high_profile_fk
        FOREIGN KEY (higher_profile_version_id, higher_user_id)
        REFERENCES public.introduction_profile_versions (id, owner_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_eligibility_snapshots_low_req_fk
        FOREIGN KEY (lower_requirement_version_id, lower_user_id)
        REFERENCES public.matching_requirement_versions (id, owner_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_eligibility_snapshots_high_req_fk
        FOREIGN KEY (higher_requirement_version_id, higher_user_id)
        REFERENCES public.matching_requirement_versions (id, owner_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_eligibility_snapshots_low_disc_fk
        FOREIGN KEY (lower_disclosure_authority_id, lower_user_id)
        REFERENCES public.pre_match_disclosure_authorities (id, grantor_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_eligibility_snapshots_high_disc_fk
        FOREIGN KEY (higher_disclosure_authority_id, higher_user_id)
        REFERENCES public.pre_match_disclosure_authorities (id, grantor_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_eligibility_snapshots_cadence_fk
        FOREIGN KEY (cadence_policy_version_id, cadence_policy_kind)
        REFERENCES public.matching_proposal_policy_versions (id, policy_kind) ON DELETE RESTRICT,
    CONSTRAINT matching_eligibility_snapshots_pending_fk
        FOREIGN KEY (pending_policy_version_id, pending_policy_kind)
        REFERENCES public.matching_proposal_policy_versions (id, policy_kind) ON DELETE RESTRICT,
    CONSTRAINT matching_eligibility_snapshots_expiry_fk
        FOREIGN KEY (expiry_policy_version_id, expiry_policy_kind)
        REFERENCES public.matching_proposal_policy_versions (id, policy_kind) ON DELETE RESTRICT,
    CONSTRAINT matching_eligibility_snapshots_cadence_kind_check
        CHECK (cadence_policy_kind = 'PROPOSAL_CADENCE'),
    CONSTRAINT matching_eligibility_snapshots_pending_kind_check
        CHECK (pending_policy_kind = 'PENDING_PROPOSAL_LIMIT'),
    CONSTRAINT matching_eligibility_snapshots_expiry_kind_check
        CHECK (expiry_policy_kind = 'PROPOSAL_EXPIRY'),
    CONSTRAINT matching_eligibility_snapshots_introduction_check
        CHECK (no_active_introduction_at_capture)
);

CREATE INDEX matching_eligibility_snapshots_pair_idx
    ON public.matching_eligibility_snapshots (pair_id, captured_at);

COMMENT ON TABLE public.matching_eligibility_snapshots IS
  'The immutable CANDIDATE_ELIGIBILITY_SNAPSHOT. Every identity it relies on is '
  'bound by composite foreign key to a row of that EXACT human, so one human''s '
  'participation can never be bound to another''s profile. It carries no '
  'aggregate eligibility column - eligibility is derived from the hard '
  'requirement results and a proposal cannot be created while one of them is '
  'anything but PASS - and it is never the authority for a continuing truth: an '
  'advancing proposal revalidates the current identities rather than trusting '
  'that this snapshot was valid when it was taken.';

-- One PASS | FAIL | UNKNOWN outcome per hard requirement of one human.
CREATE TABLE public.matching_hard_requirement_results (
    eligibility_snapshot_id uuid NOT NULL,
    evaluated_for_user_id uuid NOT NULL,
    requirement_version_id uuid NOT NULL,
    requirement_key text NOT NULL,
    requirement_outcome text NOT NULL,
    evidence_source_class text NOT NULL,
    CONSTRAINT matching_hard_requirement_results_pkey
        PRIMARY KEY (eligibility_snapshot_id, evaluated_for_user_id, requirement_key),
    CONSTRAINT matching_hard_requirement_results_snapshot_fk
        FOREIGN KEY (eligibility_snapshot_id)
        REFERENCES public.matching_eligibility_snapshots (id) ON DELETE RESTRICT,
    CONSTRAINT matching_hard_requirement_results_owner_fk
        FOREIGN KEY (evaluated_for_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    -- The requirement version really is that human's own...
    CONSTRAINT matching_hard_requirement_results_version_fk
        FOREIGN KEY (requirement_version_id, evaluated_for_user_id)
        REFERENCES public.matching_requirement_versions (id, owner_user_id) ON DELETE RESTRICT,
    -- ... and the key really is an item of that exact version.
    CONSTRAINT matching_hard_requirement_results_item_fk
        FOREIGN KEY (requirement_version_id, requirement_key)
        REFERENCES public.matching_requirement_items (requirement_version_id, requirement_key) ON DELETE RESTRICT,
    CONSTRAINT matching_hard_requirement_results_outcome_check
        CHECK (requirement_outcome IN ('PASS', 'FAIL', 'UNKNOWN')),
    -- Only the four allowed candidate self-truth source classes, plus the
    -- absence of one. A third-party claim, a name, a voice, a photo, a language
    -- style and an inferred ethnicity, religion, class or status are not refused
    -- here - they cannot be spelled at all.
    CONSTRAINT matching_hard_requirement_results_source_check
        CHECK (evidence_source_class IN ('SELF_AUTHORED_PERSONAL', 'EXPLICIT_MATCHING_ANSWER',
                                         'INTRODUCTION_PROFILE', 'CANONICAL_PRODUCT_ACCOUNT_STATE',
                                         'NOT_ESTABLISHED')),
    -- THE LAW: unknown IS unsourced, and sourced IS not unknown. An UNKNOWN can
    -- never carry a confirmed source, a PASS can never exist without one, and
    -- the row is append-only, so UNKNOWN never silently becomes PASS.
    CONSTRAINT matching_hard_requirement_results_unknown_check
        CHECK ((requirement_outcome = 'UNKNOWN') = (evidence_source_class = 'NOT_ESTABLISHED'))
);

COMMENT ON TABLE public.matching_hard_requirement_results IS
  'One HARD_DEALBREAKER outcome per requirement of one human against one '
  'eligibility snapshot: PASS, FAIL or UNKNOWN, with the allowed self-truth '
  'source class that established it. There is no weight, score, rank or '
  'percentage beside it, so no soft signal has anything to override a hard FAIL '
  'or a hard UNKNOWN with, and UNKNOWN is never collapsed into PASS.';

-- ---------------------------------------------------------------------------
-- 4. THE ONE-WAY PRIVACY BOUNDARY, as four different relations.
-- ---------------------------------------------------------------------------

-- Private Matching reasoning. Nothing downstream can reach this relation: no
-- recipient-view relation carries a foreign key into it, and the terminal
-- self-assertion below refuses one.
CREATE TABLE public.matching_private_reasoning_notes (
    id uuid PRIMARY KEY,
    eligibility_snapshot_id uuid NOT NULL,
    about_user_id uuid NOT NULL,
    evidence_source_class text NOT NULL,
    private_note text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT matching_private_reasoning_notes_snapshot_fk
        FOREIGN KEY (eligibility_snapshot_id)
        REFERENCES public.matching_eligibility_snapshots (id) ON DELETE RESTRICT,
    CONSTRAINT matching_private_reasoning_notes_about_fk
        FOREIGN KEY (about_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT matching_private_reasoning_notes_source_check
        CHECK (evidence_source_class IN ('SELF_AUTHORED_PERSONAL', 'EXPLICIT_MATCHING_ANSWER',
                                         'INTRODUCTION_PROFILE', 'CANONICAL_PRODUCT_ACCOUNT_STATE')),
    CONSTRAINT matching_private_reasoning_notes_body_check
        CHECK (btrim(private_note) <> '' AND length(private_note) <= 4096)
);

CREATE INDEX matching_private_reasoning_notes_snapshot_idx
    ON public.matching_private_reasoning_notes (eligibility_snapshot_id, about_user_id);

COMMENT ON TABLE public.matching_private_reasoning_notes IS
  'Private Matching reasoning about one human, held on the private side of the '
  'disclosure boundary. It is never copied into a recipient view and nothing '
  'downstream references it: the boundary is a change of relation, not a flag.';

-- Untrusted provider output. There is deliberately no "the model says this is
-- safe" column: the only safety verdict that exists is the filter's own.
CREATE TABLE public.matching_safe_conclusion_candidates (
    id uuid PRIMARY KEY,
    eligibility_snapshot_id uuid NOT NULL,
    for_recipient_user_id uuid NOT NULL,
    about_user_id uuid NOT NULL,
    conclusion_text text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT matching_safe_conclusion_candidates_audience_key
        UNIQUE (id, for_recipient_user_id, about_user_id),
    CONSTRAINT matching_safe_conclusion_candidates_snapshot_fk
        FOREIGN KEY (eligibility_snapshot_id)
        REFERENCES public.matching_eligibility_snapshots (id) ON DELETE RESTRICT,
    CONSTRAINT matching_safe_conclusion_candidates_recipient_fk
        FOREIGN KEY (for_recipient_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT matching_safe_conclusion_candidates_about_fk
        FOREIGN KEY (about_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT matching_safe_conclusion_candidates_audience_check
        CHECK (for_recipient_user_id <> about_user_id),
    CONSTRAINT matching_safe_conclusion_candidates_body_check
        CHECK (btrim(conclusion_text) <> '' AND length(conclusion_text) <= 4096)
);

COMMENT ON TABLE public.matching_safe_conclusion_candidates IS
  'A recipient-specific Safe Compatibility Conclusion CANDIDATE - untrusted '
  'input to the disclosure pipeline, whatever produced it. It carries no safety '
  'label of its own, because a conclusion is not recipient-safe merely because '
  'a model called it safe.';

-- The PERMITTED output. `filter_verdict` is pinned to PERMITTED by a
-- single-value CHECK, so a refused or unclassified conclusion is not filtered
-- out at read time - it cannot exist in the relation a recipient view can bind.
CREATE TABLE public.matching_permitted_safe_conclusions (
    id uuid PRIMARY KEY,
    conclusion_candidate_id uuid NOT NULL,
    for_recipient_user_id uuid NOT NULL,
    about_user_id uuid NOT NULL,
    filter_policy_version_id uuid NOT NULL,
    filter_policy_kind text NOT NULL DEFAULT 'SENSITIVE_CONCLUSION_FILTER',
    filter_verdict text NOT NULL DEFAULT 'PERMITTED',
    permitted_text text NOT NULL,
    permitted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT matching_permitted_safe_conclusions_candidate_key UNIQUE (conclusion_candidate_id),
    CONSTRAINT matching_permitted_safe_conclusions_audience_key
        UNIQUE (id, for_recipient_user_id, about_user_id),
    -- The permitted row inherits the candidate's exact audience: it can never be
    -- re-aimed at a different recipient or made to be about a different human.
    CONSTRAINT matching_permitted_safe_conclusions_candidate_fk
        FOREIGN KEY (conclusion_candidate_id, for_recipient_user_id, about_user_id)
        REFERENCES public.matching_safe_conclusion_candidates (id, for_recipient_user_id, about_user_id)
        ON DELETE RESTRICT,
    CONSTRAINT matching_permitted_safe_conclusions_policy_fk
        FOREIGN KEY (filter_policy_version_id, filter_policy_kind)
        REFERENCES public.matching_proposal_policy_versions (id, policy_kind) ON DELETE RESTRICT,
    CONSTRAINT matching_permitted_safe_conclusions_kind_check
        CHECK (filter_policy_kind = 'SENSITIVE_CONCLUSION_FILTER'),
    CONSTRAINT matching_permitted_safe_conclusions_verdict_check
        CHECK (filter_verdict = 'PERMITTED'),
    CONSTRAINT matching_permitted_safe_conclusions_body_check
        CHECK (btrim(permitted_text) <> '' AND length(permitted_text) <= 1024),
    -- No visible score, rank, percentage or leaderboard language.
    CONSTRAINT matching_permitted_safe_conclusions_rank_ban_check
        CHECK (permitted_text !~* ('(^|[^a-z])([0-9]{1,3} ?%|per ?cent|score[ds]?|scoring|rank(ed|ing|s)?'
                                || '|rating|percentile|match rate|top [0-9]|[0-9]{1,3} out of [0-9]{1,3}'
                                || '|compatibility (score|rating|percentage|index))([^a-z]|$)')),
    -- No hidden provenance: an evidence, source or memory identifier is a UUID,
    -- and a recipient-safe conclusion never carries one.
    CONSTRAINT matching_permitted_safe_conclusions_provenance_ban_check
        CHECK (permitted_text !~* ('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')),
    -- No direct private quote payload: a long verbatim span in quotation marks
    -- is how a private memory reaches a recipient wearing a conclusion's clothes.
    -- The CHECK is deliberately ASCII, because a PostgreSQL regular expression
    -- has no \uXXXX escape and a literal typographic quote in a migration is an
    -- encoding hazard. The unquoted case is not left to it: 0111's filter
    -- refuses a conclusion that contains ANY private reasoning note of its own
    -- snapshot verbatim, quotation marks or none.
    CONSTRAINT matching_permitted_safe_conclusions_quote_ban_check
        CHECK (permitted_text !~ ('"[^"]{24,}"')),
    -- No direct contact route, whatever wrote it.
    CONSTRAINT matching_permitted_safe_conclusions_route_ban_check
        CHECK (permitted_text !~* ('(^|[^a-z0-9])@[a-z0-9._]{2,}')
           AND permitted_text !~* ('[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}')
           AND permitted_text !~* ('(https?://|www\.)')
           AND permitted_text !~* ('[a-z0-9-]+\.(com|net|org|io|me|co|uk|eg|app|link|xyz|info|biz'
                                || '|tv|gg|fm|site|online|shop|blog|dev|page)([^a-z]|$)')
           AND permitted_text !~ ('[0-9](?:[0-9 ()._+-]*[0-9]){6,}')
           AND permitted_text !~* ('(^|[^a-z])(whats ?app|telegram|instagram|snapchat|tik ?tok|facebook'
                                || '|twitter|linked ?in|messenger|viber|signal|discord|skype|wechat'
                                || '|botim|imo)([^a-z]|$)'))
);

COMMENT ON TABLE public.matching_permitted_safe_conclusions IS
  'A Safe Compatibility Conclusion that PASSED the Sensitive Conclusion Filter, '
  'as a different relation rather than a different flag. Its verdict column is '
  'pinned to PERMITTED, so a refused or unclassified conclusion cannot exist '
  'here at all and absence IS refusal. Its text may carry no contact route, no '
  'verbatim private quote, no source identifier and no score, rank or '
  'percentage, and the database refuses one rather than trusting the filter.';

-- The private refusal, on its own relation, reachable by no recipient view.
CREATE TABLE public.matching_sensitive_filter_refusals (
    id uuid PRIMARY KEY,
    conclusion_candidate_id uuid NOT NULL,
    filter_policy_version_id uuid NOT NULL,
    filter_policy_kind text NOT NULL DEFAULT 'SENSITIVE_CONCLUSION_FILTER',
    filter_verdict text NOT NULL,
    private_refusal_class text NOT NULL,
    refused_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT matching_sensitive_filter_refusals_candidate_key UNIQUE (conclusion_candidate_id),
    CONSTRAINT matching_sensitive_filter_refusals_candidate_fk
        FOREIGN KEY (conclusion_candidate_id)
        REFERENCES public.matching_safe_conclusion_candidates (id) ON DELETE RESTRICT,
    CONSTRAINT matching_sensitive_filter_refusals_policy_fk
        FOREIGN KEY (filter_policy_version_id, filter_policy_kind)
        REFERENCES public.matching_proposal_policy_versions (id, policy_kind) ON DELETE RESTRICT,
    CONSTRAINT matching_sensitive_filter_refusals_kind_check
        CHECK (filter_policy_kind = 'SENSITIVE_CONCLUSION_FILTER'),
    -- An UNCLASSIFIED safety result is a refusal, never a pass.
    CONSTRAINT matching_sensitive_filter_refusals_verdict_check
        CHECK (filter_verdict IN ('REFUSED', 'UNCLASSIFIED')),
    CONSTRAINT matching_sensitive_filter_refusals_class_check
        CHECK (private_refusal_class IN ('CONTACT_ROUTE', 'PRIVATE_QUOTE', 'HIDDEN_PROVENANCE',
                                         'VISIBLE_RANKING', 'SENSITIVE_FACT', 'UNCLASSIFIED_RESULT'))
);

COMMENT ON TABLE public.matching_sensitive_filter_refusals IS
  'The private record of a Sensitive Conclusion Filter refusal and its reason. '
  'An UNCLASSIFIED safety result is recorded here as a refusal, never as a pass. '
  'No recipient-facing relation references this one, so the reason a conclusion '
  'was withheld is private operational state and stays that way.';

-- ---------------------------------------------------------------------------
-- 5. THE PROPOSAL, its immutable transition chain, and one live proposal a pair.
-- ---------------------------------------------------------------------------
CREATE TABLE public.matching_proposals (
    -- The proposal id IS the preparation command id, so the row is its own
    -- durable idempotency record exactly as 0108 makes an act its own.
    id uuid PRIMARY KEY,
    pair_id uuid NOT NULL,
    lower_user_id uuid NOT NULL,
    higher_user_id uuid NOT NULL,
    -- Direction: immutable once prepared, and always one of the pair's members.
    first_recipient_user_id uuid NOT NULL,
    candidate_user_id uuid NOT NULL,
    eligibility_snapshot_id uuid NOT NULL,
    proposal_state text NOT NULL DEFAULT 'PREPARED',
    current_transition_id uuid,
    prepared_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamptz NOT NULL,
    CONSTRAINT matching_proposals_first_key UNIQUE (id, first_recipient_user_id),
    CONSTRAINT matching_proposals_candidate_key UNIQUE (id, candidate_user_id),
    CONSTRAINT matching_proposals_pair_fk
        FOREIGN KEY (pair_id, lower_user_id, higher_user_id)
        REFERENCES public.matching_pairs (id, lower_user_id, higher_user_id) ON DELETE RESTRICT,
    -- The snapshot belongs to THIS pair; a proposal can never consume another
    -- pair's eligibility.
    CONSTRAINT matching_proposals_snapshot_fk
        FOREIGN KEY (eligibility_snapshot_id, pair_id)
        REFERENCES public.matching_eligibility_snapshots (id, pair_id) ON DELETE RESTRICT,
    -- The direction is one of exactly two arrangements of the pair's own members.
    CONSTRAINT matching_proposals_direction_check
        CHECK ((first_recipient_user_id = lower_user_id AND candidate_user_id = higher_user_id)
            OR (first_recipient_user_id = higher_user_id AND candidate_user_id = lower_user_id)),
    CONSTRAINT matching_proposals_state_check
        CHECK (proposal_state IN ('PREPARED', 'OFFERED_TO_FIRST', 'FIRST_DECLINED',
                                  'FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND', 'SECOND_DECLINED',
                                  'WITHDRAWN', 'EXPIRED', 'STALE',
                                  'CANCELLED_BY_COMPETING_MATCH', 'MUTUAL_MATCH_COMMITTED')),
    -- PREPARED is the birth state the row itself carries; every later state
    -- names an exact transition. There is no circular foreign key to defer.
    CONSTRAINT matching_proposals_birth_check
        CHECK ((current_transition_id IS NULL) = (proposal_state = 'PREPARED')),
    CONSTRAINT matching_proposals_expiry_check CHECK (expires_at > prepared_at)
);

-- AT MOST ONE LIVE PROPOSAL PER UNORDERED PAIR, in either direction. The pair
-- row is unordered, so this one index is the whole of the rule. Adding a
-- TERMINAL state - which is all I-07C adds - needs no change here.
CREATE UNIQUE INDEX matching_proposals_one_live_per_pair_idx
    ON public.matching_proposals (pair_id)
    WHERE proposal_state IN ('PREPARED', 'OFFERED_TO_FIRST', 'FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND');

CREATE INDEX matching_proposals_first_recipient_idx
    ON public.matching_proposals (first_recipient_user_id, prepared_at);
CREATE INDEX matching_proposals_candidate_idx
    ON public.matching_proposals (candidate_user_id, prepared_at);
CREATE INDEX matching_proposals_expiry_idx
    ON public.matching_proposals (expires_at);

COMMENT ON TABLE public.matching_proposals IS
  'One Matching proposal over one canonical unordered pair, with an immutable '
  'direction that is always an arrangement of that pair''s own two members. At '
  'most one proposal per pair is live at a time regardless of direction. The '
  'current state is bound to ONE EXACT transition row by composite foreign key '
  'and is therefore stored once, not twice. It is not a user-visible object and '
  'no boundary enumerates it.';

CREATE TABLE public.matching_proposal_transitions (
    -- The transition id IS the command id that produced it.
    id uuid PRIMARY KEY,
    proposal_id uuid NOT NULL,
    prior_state text NOT NULL,
    resulting_state text NOT NULL,
    prior_transition_id uuid,
    first_recipient_actor_id uuid,
    candidate_actor_id uuid,
    private_reason_code text,
    occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- The composite identity the proposal's current pointer binds, so the state
    -- on the proposal cannot disagree with the transition it names.
    CONSTRAINT matching_proposal_transitions_state_key UNIQUE (id, proposal_id, resulting_state),
    CONSTRAINT matching_proposal_transitions_proposal_fk
        FOREIGN KEY (proposal_id) REFERENCES public.matching_proposals (id) ON DELETE RESTRICT,
    -- The superseded transition is a transition OF THIS PROPOSAL whose resulting
    -- state is exactly the state this one moves out of.
    CONSTRAINT matching_proposal_transitions_prior_fk
        FOREIGN KEY (prior_transition_id, proposal_id, prior_state)
        REFERENCES public.matching_proposal_transitions (id, proposal_id, resulting_state) ON DELETE RESTRICT,
    CONSTRAINT matching_proposal_transitions_prior_check
        CHECK ((prior_transition_id IS NULL) = (prior_state = 'PREPARED')
           AND (prior_transition_id IS NULL OR prior_transition_id <> id)),
    -- An actor is a member of THIS proposal in THAT exact role.
    CONSTRAINT matching_proposal_transitions_first_actor_fk
        FOREIGN KEY (proposal_id, first_recipient_actor_id)
        REFERENCES public.matching_proposals (id, first_recipient_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_proposal_transitions_cand_actor_fk
        FOREIGN KEY (proposal_id, candidate_actor_id)
        REFERENCES public.matching_proposals (id, candidate_user_id) ON DELETE RESTRICT,
    -- THE LEGAL TRANSITIONS, as a row-value list. A terminal state appears on no
    -- left-hand side, so nothing transitions out of one. The last four are
    -- REPRESENTABLE FOR I-07C and have no I-07B producer.
    CONSTRAINT matching_proposal_transitions_legal_check
        CHECK ((prior_state, resulting_state) IN (
            ('PREPARED', 'OFFERED_TO_FIRST'),
            ('PREPARED', 'WITHDRAWN'), ('PREPARED', 'EXPIRED'), ('PREPARED', 'STALE'),
            ('OFFERED_TO_FIRST', 'FIRST_DECLINED'),
            ('OFFERED_TO_FIRST', 'FIRST_FORWARD_APPROVED'),
            ('OFFERED_TO_FIRST', 'WITHDRAWN'), ('OFFERED_TO_FIRST', 'EXPIRED'), ('OFFERED_TO_FIRST', 'STALE'),
            ('FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND'),
            ('FIRST_FORWARD_APPROVED', 'WITHDRAWN'), ('FIRST_FORWARD_APPROVED', 'EXPIRED'),
            ('FIRST_FORWARD_APPROVED', 'STALE'),
            ('FORWARDED_TO_SECOND', 'SECOND_DECLINED'),
            ('FORWARDED_TO_SECOND', 'WITHDRAWN'), ('FORWARDED_TO_SECOND', 'EXPIRED'),
            ('FORWARDED_TO_SECOND', 'STALE'),
            ('FORWARDED_TO_SECOND', 'MUTUAL_MATCH_COMMITTED'),
            ('PREPARED', 'CANCELLED_BY_COMPETING_MATCH'),
            ('OFFERED_TO_FIRST', 'CANCELLED_BY_COMPETING_MATCH'),
            ('FIRST_FORWARD_APPROVED', 'CANCELLED_BY_COMPETING_MATCH'),
            ('FORWARDED_TO_SECOND', 'CANCELLED_BY_COMPETING_MATCH'))),
    -- WHICH ROLE MAY HAVE ACTED IS FIXED BY THE RESULTING STATE. A candidate can
    -- never be recorded as having declined the first offer, the first recipient
    -- can never be recorded as the second decliner, and an offer, a forward, an
    -- expiry and a staleness carry no human actor at all.
    CONSTRAINT matching_proposal_transitions_actor_check
        CHECK (CASE resulting_state
                 WHEN 'FIRST_DECLINED'
                   THEN first_recipient_actor_id IS NOT NULL AND candidate_actor_id IS NULL
                 WHEN 'FIRST_FORWARD_APPROVED'
                   THEN first_recipient_actor_id IS NOT NULL AND candidate_actor_id IS NULL
                 WHEN 'WITHDRAWN'
                   THEN first_recipient_actor_id IS NOT NULL AND candidate_actor_id IS NULL
                 WHEN 'SECOND_DECLINED'
                   THEN candidate_actor_id IS NOT NULL AND first_recipient_actor_id IS NULL
                 WHEN 'MUTUAL_MATCH_COMMITTED'
                   THEN candidate_actor_id IS NOT NULL AND first_recipient_actor_id IS NULL
                 ELSE first_recipient_actor_id IS NULL AND candidate_actor_id IS NULL
               END),
    -- The private reason exists exactly for a terminal non-completion, and it is
    -- private operational state: no recipient projection returns it.
    CONSTRAINT matching_proposal_transitions_reason_check
        CHECK (private_reason_code IS NULL OR private_reason_code IN (
            'RECIPIENT_DECLINED', 'WITHDRAWN_BY_FIRST_PARTY', 'PROPOSAL_EXPIRED',
            'PARTICIPATION_NOT_ACTIVE', 'MATCHING_CONTEXT_GRANT_CHANGED',
            'INTRODUCTION_PROFILE_VERSION_CHANGED', 'MATCHING_REQUIREMENT_VERSION_CHANGED',
            'DISCLOSURE_AUTHORITY_CHANGED', 'PROPOSAL_POLICY_CHANGED',
            'ACTIVE_INTRODUCTION_PRESENT', 'RECIPIENT_VIEW_SUPERSEDED'))
);

CREATE UNIQUE INDEX matching_proposal_transitions_prior_idx
    ON public.matching_proposal_transitions (prior_transition_id)
    WHERE prior_transition_id IS NOT NULL;

-- A proposal leaves PREPARED exactly once: the chain is a chain from its root.
CREATE UNIQUE INDEX matching_proposal_transitions_root_idx
    ON public.matching_proposal_transitions (proposal_id)
    WHERE prior_transition_id IS NULL;

CREATE INDEX matching_proposal_transitions_proposal_idx
    ON public.matching_proposal_transitions (proposal_id, occurred_at);

COMMENT ON TABLE public.matching_proposal_transitions IS
  'The immutable append-only chain of one proposal''s state transitions. The row '
  'id IS the command id that produced it. Which role may have acted is fixed by '
  'the resulting state, and the private reason a proposal ended is recorded here '
  'and nowhere a recipient can reach.';

-- The current-state pointer, added after both relations exist so the composite
-- key it needs is already declared.
ALTER TABLE public.matching_proposals
    ADD CONSTRAINT matching_proposals_current_transition_fk
    FOREIGN KEY (current_transition_id, id, proposal_state)
    REFERENCES public.matching_proposal_transitions (id, proposal_id, resulting_state) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- 6. IMMUTABLE RECIPIENT PROPOSAL VIEWS - one exact recipient, one exact
--    version, and a disclosed field that is impossible without BOTH gates.
-- ---------------------------------------------------------------------------
CREATE TABLE public.matching_recipient_proposal_views (
    id uuid PRIMARY KEY,
    proposal_id uuid NOT NULL,
    recipient_role text NOT NULL,
    recipient_user_id uuid NOT NULL,
    subject_user_id uuid NOT NULL,
    -- Both members, denormalized so the role, the recipient and the subject can
    -- be pinned to the proposal's own direction by CHECK rather than by trust.
    first_recipient_user_id uuid NOT NULL,
    candidate_user_id uuid NOT NULL,
    prior_view_id uuid,
    eligibility_snapshot_id uuid NOT NULL,
    subject_profile_version_id uuid NOT NULL,
    subject_disclosure_authority_id uuid NOT NULL,
    safe_field_policy_version_id uuid NOT NULL,
    safe_field_policy_kind text NOT NULL DEFAULT 'PROPOSAL_SAFE_FIELDS',
    permitted_conclusion_id uuid NOT NULL,
    subject_first_name text NOT NULL,
    materialized_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT matching_recipient_proposal_views_audience_key
        UNIQUE (id, proposal_id, recipient_user_id),
    CONSTRAINT matching_recipient_proposal_views_authority_key
        UNIQUE (id, subject_disclosure_authority_id),
    CONSTRAINT matching_recipient_proposal_views_field_policy_key
        UNIQUE (id, safe_field_policy_version_id),
    CONSTRAINT matching_recipient_proposal_views_first_fk
        FOREIGN KEY (proposal_id, first_recipient_user_id)
        REFERENCES public.matching_proposals (id, first_recipient_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_recipient_proposal_views_cand_fk
        FOREIGN KEY (proposal_id, candidate_user_id)
        REFERENCES public.matching_proposals (id, candidate_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_recipient_proposal_views_prior_fk
        FOREIGN KEY (prior_view_id, proposal_id, recipient_user_id)
        REFERENCES public.matching_recipient_proposal_views (id, proposal_id, recipient_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_recipient_proposal_views_snapshot_fk
        FOREIGN KEY (eligibility_snapshot_id)
        REFERENCES public.matching_eligibility_snapshots (id) ON DELETE RESTRICT,
    -- The disclosed profile version is the SUBJECT'S OWN...
    CONSTRAINT matching_recipient_proposal_views_profile_fk
        FOREIGN KEY (subject_profile_version_id, subject_user_id)
        REFERENCES public.introduction_profile_versions (id, owner_user_id) ON DELETE RESTRICT,
    -- ... the authority is the SUBJECT'S OWN ...
    CONSTRAINT matching_recipient_proposal_views_auth_owner_fk
        FOREIGN KEY (subject_disclosure_authority_id, subject_user_id)
        REFERENCES public.pre_match_disclosure_authorities (id, grantor_user_id) ON DELETE RESTRICT,
    -- ... and that authority is bound to EXACTLY that profile version. An
    -- authority over V1 can never be used to disclose V2.
    CONSTRAINT matching_recipient_proposal_views_auth_version_fk
        FOREIGN KEY (subject_disclosure_authority_id, subject_profile_version_id)
        REFERENCES public.pre_match_disclosure_authorities (id, introduction_profile_version_id) ON DELETE RESTRICT,
    CONSTRAINT matching_recipient_proposal_views_policy_fk
        FOREIGN KEY (safe_field_policy_version_id, safe_field_policy_kind)
        REFERENCES public.matching_proposal_policy_versions (id, policy_kind) ON DELETE RESTRICT,
    -- The conclusion was filtered FOR THIS RECIPIENT and is ABOUT THIS SUBJECT.
    -- It can never be a conclusion written for the other party.
    CONSTRAINT matching_recipient_proposal_views_conclusion_fk
        FOREIGN KEY (permitted_conclusion_id, recipient_user_id, subject_user_id)
        REFERENCES public.matching_permitted_safe_conclusions (id, for_recipient_user_id, about_user_id)
        ON DELETE RESTRICT,
    CONSTRAINT matching_recipient_proposal_views_role_check
        CHECK (recipient_role IN ('FIRST_RECIPIENT', 'CANDIDATE')),
    CONSTRAINT matching_recipient_proposal_views_kind_check
        CHECK (safe_field_policy_kind = 'PROPOSAL_SAFE_FIELDS'),
    -- The recipient is the proposal member that role names, and the subject is
    -- the other one. Neither can be anybody else.
    CONSTRAINT matching_recipient_proposal_views_audience_check
        CHECK (recipient_user_id = CASE recipient_role
                                     WHEN 'FIRST_RECIPIENT' THEN first_recipient_user_id
                                     ELSE candidate_user_id END
           AND subject_user_id = CASE recipient_role
                                   WHEN 'FIRST_RECIPIENT' THEN candidate_user_id
                                   ELSE first_recipient_user_id END),
    CONSTRAINT matching_recipient_proposal_views_prior_self_check
        CHECK (prior_view_id IS NULL OR prior_view_id <> id),
    -- A bounded presentation name, and nothing that could be a handle, an
    -- address or an identifier.
    CONSTRAINT matching_recipient_proposal_views_name_check
        CHECK (btrim(subject_first_name) = subject_first_name
           AND length(subject_first_name) BETWEEN 1 AND 64
           AND subject_first_name !~ ('[0-9@/]'))
);

CREATE UNIQUE INDEX matching_recipient_proposal_views_prior_idx
    ON public.matching_recipient_proposal_views (prior_view_id)
    WHERE prior_view_id IS NOT NULL;

CREATE INDEX matching_recipient_proposal_views_recipient_idx
    ON public.matching_recipient_proposal_views (recipient_user_id, materialized_at);

COMMENT ON TABLE public.matching_recipient_proposal_views IS
  'One immutable RECIPIENT_PROPOSAL_VIEW_VERSION: one exact proposal, one exact '
  'recipient, one exact materialized disclosure result, and the exact profile, '
  'authority, policy, eligibility and conclusion identities it was built from. '
  'The first-recipient view and the candidate view are INDEPENDENT disclosures '
  'over different subjects and different conclusions - never one view with the '
  'names swapped - and a material change produces a NEW view while the delivered '
  'one remains as history.';

CREATE TABLE public.matching_recipient_proposal_view_fields (
    view_id uuid NOT NULL,
    subject_disclosure_authority_id uuid NOT NULL,
    safe_field_policy_version_id uuid NOT NULL,
    field_key text NOT NULL,
    disclosed_value text NOT NULL,
    CONSTRAINT matching_recipient_proposal_view_fields_pkey PRIMARY KEY (view_id, field_key),
    -- The authority and the policy on this row are THIS VIEW's own.
    CONSTRAINT matching_recipient_view_fields_view_auth_fk
        FOREIGN KEY (view_id, subject_disclosure_authority_id)
        REFERENCES public.matching_recipient_proposal_views (id, subject_disclosure_authority_id) ON DELETE RESTRICT,
    CONSTRAINT matching_recipient_view_fields_view_policy_fk
        FOREIGN KEY (view_id, safe_field_policy_version_id)
        REFERENCES public.matching_recipient_proposal_views (id, safe_field_policy_version_id) ON DELETE RESTRICT,
    -- GATE ONE: the subject human approved THIS EXACT FIELD KEY on THAT EXACT
    -- authority, which 0108 already binds to one exact profile version.
    CONSTRAINT matching_recipient_view_fields_human_fk
        FOREIGN KEY (subject_disclosure_authority_id, field_key)
        REFERENCES public.pre_match_disclosure_authority_fields (authority_id, field_key) ON DELETE RESTRICT,
    -- GATE TWO: Product permits THIS EXACT FIELD KEY before a Mutual Match.
    -- Human authority is necessary and not sufficient.
    CONSTRAINT matching_recipient_view_fields_product_fk
        FOREIGN KEY (safe_field_policy_version_id, field_key)
        REFERENCES public.matching_proposal_safe_field_keys (policy_version_id, field_key) ON DELETE RESTRICT,
    CONSTRAINT matching_recipient_view_fields_value_check
        CHECK (btrim(disclosed_value) <> '' AND length(disclosed_value) <= 4096),
    -- I-07A bans a contact-route KEY. A VALUE is bounded free text, so a benign
    -- key may not smuggle a contact route through it. This is deliberately
    -- fail-closed: it will refuse some innocent sentences, and refusing to
    -- disclose a sentence is recoverable while disclosing a phone number is not.
    CONSTRAINT matching_recipient_view_fields_route_ban_check
        CHECK (disclosed_value !~* ('(^|[^a-z0-9])@[a-z0-9._]{2,}')
           AND disclosed_value !~* ('[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}')
           AND disclosed_value !~* ('(https?://|www\.)')
           AND disclosed_value !~* ('[a-z0-9-]+\.(com|net|org|io|me|co|uk|eg|app|link|xyz|info|biz'
                                 || '|tv|gg|fm|site|online|shop|blog|dev|page)([^a-z]|$)')
           AND disclosed_value !~ ('[0-9](?:[0-9 ()._+-]*[0-9]){6,}')
           AND disclosed_value !~* ('(^|[^a-z])(whats ?app|telegram|instagram|snapchat|tik ?tok|facebook'
                                 || '|twitter|linked ?in|messenger|viber|signal|discord|skype|wechat'
                                 || '|botim|imo)([^a-z]|$)')),
    -- No hidden provenance rides along in a field value either.
    CONSTRAINT matching_recipient_view_fields_provenance_ban_check
        CHECK (disclosed_value !~* ('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'))
);

COMMENT ON TABLE public.matching_recipient_proposal_view_fields IS
  'The exact disclosed field set of one recipient view. A row is impossible '
  'unless the subject human approved that exact key on that exact authority AND '
  'the current Product proposal-safety policy permits it - two foreign keys, not '
  'two remembered checks. The value may carry no contact route and no source '
  'identifier, so a benign key cannot smuggle one through free text.';

CREATE TABLE public.matching_recipient_proposal_view_state (
    proposal_id uuid NOT NULL,
    recipient_user_id uuid NOT NULL,
    current_view_id uuid NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT matching_recipient_proposal_view_state_pkey PRIMARY KEY (proposal_id, recipient_user_id),
    CONSTRAINT matching_recipient_view_state_current_key UNIQUE (current_view_id),
    CONSTRAINT matching_recipient_view_state_current_fk
        FOREIGN KEY (current_view_id, proposal_id, recipient_user_id)
        REFERENCES public.matching_recipient_proposal_views (id, proposal_id, recipient_user_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.matching_recipient_proposal_view_state IS
  'The ONE current view identity per (proposal, recipient). Currentness is an '
  'explicit pointer to an exact historical identity, never "the latest '
  'timestamp", and it may only ever move forward along that recipient''s own '
  'view chain.';

-- ---------------------------------------------------------------------------
-- 7. IMMUTABILITY AND TRUTH TRIGGERS.
--
--    Triggers rather than privileges alone, for the reason 0108 established: a
--    privilege does not bind the table owner, and a future accidental GRANT
--    would otherwise reopen mutation. None of these is a forward ceiling -
--    appending a transition, appending a view and moving a pointer forward are
--    exactly what 0112 and later I-07C do.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.reject_matching_proposal_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'MATCHING_PROPOSAL_RECORD_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='A pair, an eligibility snapshot, a hard requirement result, a private reasoning note, a safe conclusion candidate, a filter outcome, a proposal transition and a recipient proposal view and its fields are append-only: UPDATE and DELETE are refused for every role, including the table owner. A changed recipient view is a NEW view, and a delivered one stays as history.';
END$$;

ALTER FUNCTION public.reject_matching_proposal_mutation_v1() OWNER TO postgres;

CREATE TRIGGER matching_pairs_immutable
    BEFORE UPDATE OR DELETE ON public.matching_pairs
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_proposal_mutation_v1();
CREATE TRIGGER matching_proposal_policy_versions_immutable
    BEFORE UPDATE OR DELETE ON public.matching_proposal_policy_versions
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_proposal_mutation_v1();
CREATE TRIGGER matching_proposal_safe_field_keys_immutable
    BEFORE UPDATE OR DELETE ON public.matching_proposal_safe_field_keys
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_proposal_mutation_v1();
CREATE TRIGGER matching_eligibility_snapshots_immutable
    BEFORE UPDATE OR DELETE ON public.matching_eligibility_snapshots
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_proposal_mutation_v1();
CREATE TRIGGER matching_hard_requirement_results_immutable
    BEFORE UPDATE OR DELETE ON public.matching_hard_requirement_results
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_proposal_mutation_v1();
CREATE TRIGGER matching_private_reasoning_notes_immutable
    BEFORE UPDATE OR DELETE ON public.matching_private_reasoning_notes
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_proposal_mutation_v1();
CREATE TRIGGER matching_safe_conclusion_candidates_immutable
    BEFORE UPDATE OR DELETE ON public.matching_safe_conclusion_candidates
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_proposal_mutation_v1();
CREATE TRIGGER matching_permitted_safe_conclusions_immutable
    BEFORE UPDATE OR DELETE ON public.matching_permitted_safe_conclusions
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_proposal_mutation_v1();
CREATE TRIGGER matching_sensitive_filter_refusals_immutable
    BEFORE UPDATE OR DELETE ON public.matching_sensitive_filter_refusals
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_proposal_mutation_v1();
CREATE TRIGGER matching_proposal_transitions_immutable
    BEFORE UPDATE OR DELETE ON public.matching_proposal_transitions
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_proposal_mutation_v1();
CREATE TRIGGER matching_recipient_proposal_views_immutable
    BEFORE UPDATE OR DELETE ON public.matching_recipient_proposal_views
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_proposal_mutation_v1();
CREATE TRIGGER matching_recipient_view_fields_immutable
    BEFORE UPDATE OR DELETE ON public.matching_recipient_proposal_view_fields
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_proposal_mutation_v1();

-- A proposal row is never deleted, its identity and direction are frozen at
-- preparation, and only the current-state pointer pair may ever change. The
-- comparison is over the WHOLE row, so a column a later reviewed slice adds is
-- frozen by the same rule without this function being edited.
CREATE FUNCTION public.matching_proposal_state_truth_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  changed text[];
  expected_prior text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_IS_DURABLE'
      USING ERRCODE='55000',
            DETAIL='A Matching proposal is durable operational history and is never deleted. A proposal that ended keeps its row and its terminal state.';
  END IF;
  SELECT array_agg(o.key ORDER BY o.key) INTO changed
    FROM jsonb_each_text(to_jsonb(OLD)) AS o(key, value)
    JOIN jsonb_each_text(to_jsonb(NEW)) AS n(key, value) ON n.key = o.key
   WHERE o.key NOT IN ('proposal_state', 'current_transition_id')
     AND o.value IS DISTINCT FROM n.value;
  IF changed IS NOT NULL THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_IDENTITY_IS_FROZEN'
      USING ERRCODE='55000',
            DETAIL=format('A proposal''s pair, direction, eligibility snapshot, preparation instant and expiry are frozen at preparation and may never be rewritten: %s.', array_to_string(changed, ', '));
  END IF;
  -- The pointer may only move FORWARD ALONG THIS PROPOSAL'S OWN CHAIN: the new
  -- transition must be the one that supersedes the state being replaced.
  SELECT t.prior_state INTO expected_prior
    FROM public.matching_proposal_transitions t
   WHERE t.id = NEW.current_transition_id AND t.proposal_id = NEW.id;
  IF expected_prior IS DISTINCT FROM OLD.proposal_state THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_NOT_A_FORWARD_MOVE'
      USING ERRCODE='55000',
            DETAIL='A proposal may only advance to the transition that supersedes its current state, and only through a transition of its own.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.matching_proposal_state_truth_v1() OWNER TO postgres;

CREATE TRIGGER matching_proposals_state_truth
    BEFORE UPDATE OR DELETE ON public.matching_proposals
    FOR EACH ROW EXECUTE FUNCTION public.matching_proposal_state_truth_v1();

-- The current recipient-view pointer moves forward along that recipient's own
-- chain, belongs to one (proposal, recipient) for its whole life, and is never
-- deleted - so a delivered view is never erased by superseding it.
CREATE FUNCTION public.matching_recipient_view_state_truth_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  expected_prior uuid;
  replaced uuid := NULL;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'MATCHING_RECIPIENT_VIEW_STATE_IS_DURABLE'
      USING ERRCODE='55000', DETAIL='A current recipient view pointer is durable truth and is never deleted.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.proposal_id IS DISTINCT FROM OLD.proposal_id
       OR NEW.recipient_user_id IS DISTINCT FROM OLD.recipient_user_id THEN
      RAISE EXCEPTION 'MATCHING_RECIPIENT_VIEW_AUDIENCE_IS_FROZEN'
        USING ERRCODE='55000', DETAIL='A recipient view pointer belongs to one proposal and one recipient for its whole life.';
    END IF;
    replaced := OLD.current_view_id;
  END IF;
  SELECT v.prior_view_id INTO expected_prior
    FROM public.matching_recipient_proposal_views v WHERE v.id = NEW.current_view_id;
  IF expected_prior IS DISTINCT FROM replaced THEN
    RAISE EXCEPTION 'MATCHING_RECIPIENT_VIEW_NOT_A_FORWARD_MOVE'
      USING ERRCODE='55000',
            DETAIL='A current recipient view pointer may only name the view that supersedes the view it replaces, and a first pointer may only name a chain root.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.matching_recipient_view_state_truth_v1() OWNER TO postgres;

CREATE TRIGGER matching_recipient_view_state_truth
    BEFORE INSERT OR UPDATE OR DELETE ON public.matching_recipient_proposal_view_state
    FOR EACH ROW EXECUTE FUNCTION public.matching_recipient_view_state_truth_v1();

-- The current policy pointer moves forward along its OWN kind's chain.
CREATE FUNCTION public.matching_proposal_policy_state_truth_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  expected_prior uuid;
  replaced uuid := NULL;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_POLICY_IS_DURABLE'
      USING ERRCODE='55000', DETAIL='A current proposal policy pointer is durable truth and is never deleted.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.policy_kind IS DISTINCT FROM OLD.policy_kind THEN
      RAISE EXCEPTION 'MATCHING_PROPOSAL_POLICY_KIND_IS_FROZEN'
        USING ERRCODE='55000', DETAIL='A current proposal policy pointer belongs to one policy kind for its whole life.';
    END IF;
    replaced := OLD.current_policy_version_id;
  END IF;
  SELECT p.prior_policy_version_id INTO expected_prior
    FROM public.matching_proposal_policy_versions p WHERE p.id = NEW.current_policy_version_id;
  IF expected_prior IS DISTINCT FROM replaced THEN
    RAISE EXCEPTION 'MATCHING_PROPOSAL_POLICY_NOT_A_FORWARD_MOVE'
      USING ERRCODE='55000',
            DETAIL='A current proposal policy pointer may only name the version that supersedes the version it replaces, and a first pointer may only name a chain root.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.matching_proposal_policy_state_truth_v1() OWNER TO postgres;

CREATE TRIGGER matching_proposal_policy_state_truth
    BEFORE INSERT OR UPDATE OR DELETE ON public.matching_proposal_policy_state
    FOR EACH ROW EXECUTE FUNCTION public.matching_proposal_policy_state_truth_v1();

-- ELIGIBILITY IS DERIVED, AND THE DERIVATION IS LOAD-BEARING.
--
-- A proposal may not be created from a snapshot carrying a single hard result
-- that is not PASS - a FAIL blocks, and so does an UNKNOWN, because unknown is
-- not satisfaction.
--
-- AN UNEVALUATED HARD DEALBREAKER BLOCKS EXACTLY LIKE AN UNKNOWN ONE, and that
-- is the second half of the same law rather than a separate nicety: a check that
-- only inspected the results PRESENT would be satisfied by a snapshot with no
-- results at all, which is the most complete way possible for a hard dealbreaker
-- to go unsatisfied. So every HARD_DEALBREAKER item of both humans' bound
-- requirement versions must carry a PASS of its own. SOFT_PREFERENCE items are
-- deliberately not required: a soft preference is not a gate, and demanding one
-- would be the quiet promotion of a preference into a dealbreaker.
--
-- And once a proposal has consumed a snapshot, that snapshot is SEALED: no
-- further result may be appended to it, so the set a live proposal was judged
-- against cannot change underneath it. Together these make "a live proposal's
-- snapshot has every hard dealbreaker of both humans answered PASS" a property
-- of the database rather than of whichever command wrote it.
CREATE FUNCTION public.matching_proposal_eligibility_truth_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  blocking text;
  uncovered text;
BEGIN
  SELECT string_agg(DISTINCT r.requirement_outcome, ', ' ORDER BY r.requirement_outcome) INTO blocking
    FROM public.matching_hard_requirement_results r
   WHERE r.eligibility_snapshot_id = NEW.eligibility_snapshot_id
     AND r.requirement_outcome <> 'PASS';
  IF blocking IS NOT NULL THEN
    RAISE EXCEPTION 'MATCHING_HARD_REQUIREMENT_NOT_SATISFIED'
      USING ERRCODE='55000',
            DETAIL=format('A proposal may only be prepared from an eligibility snapshot whose every hard requirement result is PASS. This snapshot carries: %s. UNKNOWN is not satisfaction and is never read as PASS.', blocking);
  END IF;

  SELECT string_agg(format('%s/%s', i.requirement_version_id, i.requirement_key), ', '
                    ORDER BY i.requirement_version_id, i.requirement_key) INTO uncovered
    FROM public.matching_eligibility_snapshots s
    JOIN public.matching_requirement_items i
      ON i.requirement_version_id IN (s.lower_requirement_version_id, s.higher_requirement_version_id)
   WHERE s.id = NEW.eligibility_snapshot_id
     AND i.requirement_strength = 'HARD_DEALBREAKER'
     AND NOT EXISTS (SELECT 1 FROM public.matching_hard_requirement_results r
                      WHERE r.eligibility_snapshot_id = s.id
                        AND r.requirement_version_id = i.requirement_version_id
                        AND r.requirement_key = i.requirement_key
                        AND r.requirement_outcome = 'PASS');
  IF uncovered IS NOT NULL THEN
    RAISE EXCEPTION 'MATCHING_HARD_REQUIREMENT_NOT_EVALUATED'
      USING ERRCODE='55000',
            DETAIL=format('Every HARD_DEALBREAKER of both humans'' bound requirement versions must carry a PASS in this snapshot. Unanswered: %s. An unevaluated hard dealbreaker is not satisfied.', uncovered);
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.matching_proposal_eligibility_truth_v1() OWNER TO postgres;

CREATE TRIGGER matching_proposals_eligibility_truth
    BEFORE INSERT ON public.matching_proposals
    FOR EACH ROW EXECUTE FUNCTION public.matching_proposal_eligibility_truth_v1();

CREATE FUNCTION public.matching_snapshot_seal_truth_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.matching_proposals p
              WHERE p.eligibility_snapshot_id = NEW.eligibility_snapshot_id) THEN
    RAISE EXCEPTION 'MATCHING_ELIGIBILITY_SNAPSHOT_IS_SEALED'
      USING ERRCODE='55000',
            DETAIL='A snapshot a proposal has already consumed is sealed: the hard requirement set it was judged against can never grow afterwards.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.matching_snapshot_seal_truth_v1() OWNER TO postgres;

CREATE TRIGGER matching_hard_requirement_results_seal
    BEFORE INSERT ON public.matching_hard_requirement_results
    FOR EACH ROW EXECUTE FUNCTION public.matching_snapshot_seal_truth_v1();

-- ONE CONCLUSION HAS ONE OUTCOME. A candidate that was refused can never also
-- be permitted, and a permitted one can never also be recorded as refused: two
-- UNIQUE constraints on two relations cannot exclude each other, so this does.
CREATE FUNCTION public.matching_filter_outcome_truth_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  opposite boolean;
BEGIN
  IF TG_TABLE_NAME = 'matching_permitted_safe_conclusions' THEN
    SELECT EXISTS (SELECT 1 FROM public.matching_sensitive_filter_refusals f
                    WHERE f.conclusion_candidate_id = NEW.conclusion_candidate_id) INTO opposite;
  ELSE
    SELECT EXISTS (SELECT 1 FROM public.matching_permitted_safe_conclusions c
                    WHERE c.conclusion_candidate_id = NEW.conclusion_candidate_id) INTO opposite;
  END IF;
  IF opposite THEN
    RAISE EXCEPTION 'MATCHING_FILTER_OUTCOME_ALREADY_DECIDED'
      USING ERRCODE='55000',
            DETAIL='One Safe Compatibility Conclusion candidate has exactly one filter outcome. A refused conclusion is never also permitted, and a permitted one is never re-decided.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.matching_filter_outcome_truth_v1() OWNER TO postgres;

CREATE TRIGGER matching_permitted_safe_conclusions_outcome
    BEFORE INSERT ON public.matching_permitted_safe_conclusions
    FOR EACH ROW EXECUTE FUNCTION public.matching_filter_outcome_truth_v1();
CREATE TRIGGER matching_sensitive_filter_refusals_outcome
    BEFORE INSERT ON public.matching_sensitive_filter_refusals
    FOR EACH ROW EXECUTE FUNCTION public.matching_filter_outcome_truth_v1();

-- ---------------------------------------------------------------------------
-- 8. DENY-BY-DEFAULT ACCESS POSTURE.
--
--    RLS on with zero policies, postgres ownership, and every application role
--    revoked from every privilege on every relation. The trigger functions are
--    revoked too: a role that could call one directly could forge a trigger
--    context. No pair, proposal, evaluation or recipient view is reachable by
--    any application caller through this migration.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'public.matching_pairs',
    'public.matching_proposal_policy_versions',
    'public.matching_proposal_safe_field_keys',
    'public.matching_proposal_policy_state',
    'public.matching_eligibility_snapshots',
    'public.matching_hard_requirement_results',
    'public.matching_private_reasoning_notes',
    'public.matching_safe_conclusion_candidates',
    'public.matching_permitted_safe_conclusions',
    'public.matching_sensitive_filter_refusals',
    'public.matching_proposals',
    'public.matching_proposal_transitions',
    'public.matching_recipient_proposal_views',
    'public.matching_recipient_proposal_view_fields',
    'public.matching_recipient_proposal_view_state'] LOOP
    EXECUTE format('ALTER TABLE %s OWNER TO postgres', target_table);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC, anon, authenticated', target_table);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON TABLE %s FROM service_role', target_table);
    END IF;
  END LOOP;
END$$;

DO $$
DECLARE
  trigger_function text;
BEGIN
  FOREACH trigger_function IN ARRAY ARRAY[
    'public.reject_matching_proposal_mutation_v1()',
    'public.matching_proposal_state_truth_v1()',
    'public.matching_recipient_view_state_truth_v1()',
    'public.matching_proposal_policy_state_truth_v1()',
    'public.matching_proposal_eligibility_truth_v1()',
    'public.matching_snapshot_seal_truth_v1()',
    'public.matching_filter_outcome_truth_v1()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', trigger_function);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', trigger_function);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 9. TERMINAL SELF-ASSERTIONS.
--
--    The migration refuses to deploy a proposal substrate that is
--    application-reachable, policy-bearing, ranked, contact-bearing, commit /
--    slot / Introduction-shaped, that can represent a second acceptance, that
--    lets private reasoning reach a recipient view, or that shipped a
--    permissive Product policy in its own DDL.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  own_tables text[] := ARRAY[
    'matching_pairs',
    'matching_proposal_policy_versions',
    'matching_proposal_safe_field_keys',
    'matching_proposal_policy_state',
    'matching_eligibility_snapshots',
    'matching_hard_requirement_results',
    'matching_private_reasoning_notes',
    'matching_safe_conclusion_candidates',
    'matching_permitted_safe_conclusions',
    'matching_sensitive_filter_refusals',
    'matching_proposals',
    'matching_proposal_transitions',
    'matching_recipient_proposal_views',
    'matching_recipient_proposal_view_fields',
    'matching_recipient_proposal_view_state'];
  -- The relations a recipient view may never be able to reach, directly or by
  -- carrying an identifier of one.
  private_only text[] := ARRAY[
    'matching_private_reasoning_notes',
    'matching_sensitive_filter_refusals',
    'matching_hard_requirement_results'];
  recipient_facing text[] := ARRAY[
    'matching_recipient_proposal_views',
    'matching_recipient_proposal_view_fields',
    'matching_recipient_proposal_view_state'];
  target_table text;
  qualified text;
  target_role text;
  target_privilege text;
  rls_enabled boolean;
  offending text;
BEGIN
  FOREACH target_table IN ARRAY own_tables LOOP
    qualified := 'public.' || target_table;
    SELECT c.relrowsecurity INTO rls_enabled FROM pg_class c WHERE c.oid = qualified::regclass;
    IF NOT rls_enabled THEN
      RAISE EXCEPTION 'I-07B: row level security must be enabled on %', qualified;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = qualified::regclass) THEN
      RAISE EXCEPTION 'I-07B: no RLS policy may exist on %', qualified;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) AS privilege
                WHERE c.oid = qualified::regclass AND privilege.grantee = 0) THEN
      RAISE EXCEPTION 'I-07B: PUBLIC must hold no privilege on %', qualified;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, qualified, target_privilege) THEN
            RAISE EXCEPTION 'I-07B private Matching state must be unreachable: % holds % on %',
              target_role, target_privilege, qualified;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  -- NO VISIBLE RANKING PRODUCT, AND NO UNTYPED PAYLOAD. A compatibility score, a
  -- rank, a weight, a percentage or a leaderboard position has no column to live
  -- in anywhere in this slice. The concatenation is PARENTHESIZED: `~*` and `||`
  -- share PostgreSQL's "any other operator" precedence class and associate left
  -- to right, so `col ~* 'A' || 'B'` parses as `(col ~* 'A') || 'B'`.
  SELECT string_agg(format('%s.%s', c.table_name, c.column_name), ', ' ORDER BY c.table_name, c.column_name)
    INTO offending
    FROM information_schema.columns c
   WHERE c.table_schema = 'public'
     AND c.table_name::text = ANY(own_tables)
     AND (c.column_name ~* ('(score|rank|weight|priorit|percent|rating|leaderboard|ordinal|position'
                         || '|world|shared|public_|replay|match_commit|introduction_slot|slot_'
                         || '|second_accepted|accepted_pending|match_pending|reserved_'
                         || '|phone|email|contact|handle|social|url|photo|image|avatar|selfie)')
          OR c.data_type IN ('json','jsonb','ARRAY'));
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'I-07B: no ranking, contact-route, World-scoped or Mutual-Match column may exist; found %', offending;
  END IF;

  -- NOTHING CASCADES. Matching evaluation and proposal history are never deleted
  -- by a parent going away.
  SELECT string_agg(con.conname, ', ' ORDER BY con.conname) INTO offending
    FROM pg_constraint con JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
   WHERE n.nspname = 'public' AND con.contype = 'f' AND con.confdeltype <> 'r'
     AND cl.relname = ANY(own_tables);
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'I-07B: every foreign key must be ON DELETE RESTRICT; found %', offending;
  END IF;

  -- THERE IS NO SECOND ACCEPTANCE STATE. The proposal vocabulary is exactly the
  -- eleven frozen CW2-06 states; an accepted-but-not-matched intermediate is not
  -- among them and cannot be written.
  IF EXISTS (SELECT 1 FROM pg_constraint con
              WHERE con.conrelid = 'public.matching_proposals'::regclass
                AND con.conname = 'matching_proposals_state_check'
                AND pg_get_constraintdef(con.oid) ~* '(SECOND_ACCEPTED|ACCEPTED_PENDING|MATCH_PENDING|INTRODUCTION_RESERVED)') THEN
    RAISE EXCEPTION 'I-07B: there is no SECOND_ACCEPTED state; second-party acceptance is I-07C and converges atomically with the Mutual Match transaction';
  END IF;

  -- THE TWO I-07C STATES REMAIN REPRESENTABLE. A ceiling that refused them would
  -- have to be relaxed by the slice that needs them, which is the forward-safety
  -- failure this check exists to prevent.
  IF (SELECT pg_get_constraintdef(con.oid) FROM pg_constraint con
       WHERE con.conrelid = 'public.matching_proposals'::regclass
         AND con.conname = 'matching_proposals_state_check') !~ 'MUTUAL_MATCH_COMMITTED'
     OR (SELECT pg_get_constraintdef(con.oid) FROM pg_constraint con
          WHERE con.conrelid = 'public.matching_proposal_transitions'::regclass
            AND con.conname = 'matching_proposal_transitions_legal_check') !~ 'CANCELLED_BY_COMPETING_MATCH' THEN
    RAISE EXCEPTION 'I-07B: the two reserved I-07C states must stay representable so that slice adds a producer rather than relaxing a ceiling';
  END IF;

  -- PRIVATE REASONING CANNOT BE REACHED FROM A RECIPIENT-FACING RELATION. No
  -- foreign key, in either direction, joins the two sides of the boundary.
  SELECT string_agg(format('%s -> %s', child.relname, parent.relname), ', ') INTO offending
    FROM pg_constraint con
    JOIN pg_class child ON child.oid = con.conrelid
    JOIN pg_class parent ON parent.oid = con.confrelid
    JOIN pg_namespace n ON n.oid = child.relnamespace
   WHERE n.nspname = 'public' AND con.contype = 'f'
     AND ((child.relname = ANY(recipient_facing) AND parent.relname = ANY(private_only))
       OR (child.relname = ANY(private_only) AND parent.relname = ANY(recipient_facing)));
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'I-07B: the disclosure boundary is one-way; a recipient view may not reference private reasoning or a private filter reason: %', offending;
  END IF;

  -- A DISCLOSED FIELD NEEDS BOTH GATES. Human authority and Product permission
  -- are two foreign keys on the field row, not one and a comment.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint con
                  WHERE con.conrelid = 'public.matching_recipient_proposal_view_fields'::regclass
                    AND con.contype = 'f'
                    AND con.confrelid = 'public.pre_match_disclosure_authority_fields'::regclass)
     OR NOT EXISTS (SELECT 1 FROM pg_constraint con
                     WHERE con.conrelid = 'public.matching_recipient_proposal_view_fields'::regclass
                       AND con.contype = 'f'
                       AND con.confrelid = 'public.matching_proposal_safe_field_keys'::regclass) THEN
    RAISE EXCEPTION 'I-07B: a disclosed proposal field must be bound to BOTH the human''s approved field and the Product proposal-safety policy';
  END IF;

  -- NO PRODUCT POLICY VALUE IS FROZEN IN DDL, AND NONE IS INSTALLED. An
  -- unconfigured policy fails closed; a migration-installed default would be the
  -- permissive production default the contract forbids.
  IF (SELECT count(*) FROM public.matching_proposal_policy_versions) <> 0
     OR (SELECT count(*) FROM public.matching_proposal_policy_state) <> 0 THEN
    RAISE EXCEPTION 'I-07B: the exact proposal cadence, pending maximum and expiry duration are deferred Product decisions and no policy row may ship in this migration';
  END IF;

  -- NO MUTUAL MATCH, INTRODUCTION SLOT, MATCH COMMIT, INTRODUCTION RECORD OR
  -- SHARED WORLD BIRTH RELATION was introduced, and no Shared World relation is
  -- referenced at all. The scan is bounded to the Matching / Introduction
  -- namespace for the reason 0108 records: reviewed predecessors elsewhere carry
  -- these words legitimately.
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO offending
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m','p')
     AND c.relname ~* '^(matching_|introduction_|pre_match_)'
     AND c.relname ~* '(mutual|match_commit|_slot|introduction_record|world|handoff)';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'I-07B: Mutual Match, Introduction slot, Introduction record and Shared World birth belong to I-07C; found %', offending;
  END IF;

  SELECT string_agg(format('%s -> %s', cl.relname, parent.relname), ', ') INTO offending
    FROM pg_constraint con JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_class parent ON parent.oid = con.confrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
   WHERE n.nspname = 'public' AND con.contype = 'f' AND cl.relname = ANY(own_tables)
     AND parent.relname ~* '^(shared_world|public_experience|public_world|replay)';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'I-07B: no Matching relation may bind a Shared World, Public Experience or Replay relation: %', offending;
  END IF;

  -- 0110 IS PERSISTENCE. Every command, resolver and read boundary is 0111 and
  -- 0112; only the seven trigger functions above may carry a Matching name that
  -- this migration created.
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public'
     AND pr.proname ~* '(matching_proposal|matching_pair|matching_eligibility|matching_hard|matching_private|matching_safe|matching_permitted|matching_sensitive|matching_snapshot|matching_recipient|matching_filter)'
     AND pr.prorettype <> 'trigger'::regtype::oid;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'I-07B: migration 0110 creates no command, resolver or read boundary; that is 0111 and 0112. Found %', offending;
  END IF;

  -- THE 0108 / 0109 SEAL IS UNCHANGED: no application role gained direct access
  -- to any I-07A setup relation, and no I-07A boundary changed executor.
  FOREACH target_table IN ARRAY ARRAY[
    'public.matching_setup_locks', 'public.matching_participation_events',
    'public.matching_participation_state', 'public.matching_context_grants',
    'public.matching_context_consent_events', 'public.introduction_profile_versions',
    'public.introduction_profile_field_values', 'public.introduction_profile_state',
    'public.matching_requirement_versions', 'public.matching_requirement_items',
    'public.matching_requirement_state', 'public.pre_match_disclosure_authorities',
    'public.pre_match_disclosure_authority_fields', 'public.pre_match_disclosure_authority_events'] LOOP
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-07B: the I-07A seal stays intact: % holds % on %',
              target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
  IF NOT has_function_privilege('authenticated', 'public.get_my_matching_setup_v1()', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.get_my_matching_setup_v1()', 'EXECUTE') THEN
    RAISE EXCEPTION 'I-07B: the I-07A human command boundary must be exactly as 0109 left it';
  END IF;
END$$;

COMMIT;
