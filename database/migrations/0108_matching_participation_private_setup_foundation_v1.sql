-- I-07A - Matching participation, private Matching authority and versioned
-- Matching setup foundation v1.
--
-- Matching v1 is exactly ONE Product capability: MARRIAGE_INTRODUCTION. It is
-- hosted from MY_WORLD, it is a doorway, it is private by default and it is
-- mediated by QANDEEL (CW2-06). It is NOT a Shared World, a dating feed, a
-- candidate marketplace, a searchable people directory, a leaderboard or a
-- direct-contact channel, and this migration creates nothing that could become
-- one. A later Mutual Match will create exactly one SHARED_WORLD / INTRODUCTION;
-- that World is owned by I-07C and is neither created, reserved, pre-created nor
-- simulated here.
--
-- This forward-only migration installs the PRIVATE SUBSTRATE and nothing else.
-- Every authoritative human command lives in 0109; this file creates no command,
-- no read boundary and no application-reachable path of any kind.
--
-- ## The load-bearing separation (task I-07A section 4)
--
-- Participation != Matching Context Grant != Pre-Match Disclosure Authority.
-- They are three independent truths, they are independently mutable, they are
-- independently inspectable, and NONE of them may silently create another. They
-- are therefore three separate table families here, with no foreign key, no
-- trigger and no generated column joining one to another. Turning participation
-- off cannot revoke a grant, because no object in this migration gives it a way
-- to; holding a grant cannot imply participation, for the same reason.
--
-- ## What each family is
--
--   * public.matching_setup_locks - the per-human SERIALIZATION ROW, and the
--     only thing it is. Every 0109 command locks the caller's own row FIRST, so
--     a single human's concurrent Matching commands have one canonical order and
--     the multi-family disclosure-authority command cannot deadlock against a
--     single-family one. It carries a human and a birth instant, no authority, no
--     state, no participation fact and no second column: its existence for a
--     human says only that some Matching command of theirs once ran. It is not a
--     participant directory - nothing can read it (see the access posture below)
--     and no 0109 function returns a row from it or accepts another human's id.
--
--   * MATCHING_PARTICIPATION_STATE - public.matching_participation_events, the
--     immutable append-only chain of human participation acts, and
--     public.matching_participation_state, the ONE current pointer per human.
--     The current state is NOT stored twice: the pointer names an exact event by
--     a composite (event, human) foreign key, and the state IS that event's
--     resulting state. Divergence is unrepresentable rather than merely avoided,
--     and "latest timestamp wins" never decides anything. ABSENCE OF A POINTER
--     ROW IS OFF: a human with no participation history is not participating, and
--     0109 derives that fail-closed rather than inferring ACTIVE from a profile,
--     a grant, a disclosure authority or a conversation.
--
--     The frozen state vocabulary is exactly OFF | ACTIVE | PAUSED. The frozen
--     pause vocabulary is exactly USER_PAUSED | ACTIVE_INTRODUCTION |
--     POST_INTRODUCTION | POST_SUCCESS | SYSTEM_POLICY, all five representable
--     here as CW2-06 requires. Four of them deliberately have NO I-07A PRODUCER:
--     I-07A owns the human-controlled foundation and does not fabricate an active
--     Introduction or a system-policy engine in order to exercise them, exactly as
--     migration 0089 carries reserved material kinds that pin no producer. Their
--     producers belong to I-07C and I-07D, and 0109's user-resume path refuses
--     every one of them.
--
--     The two frozen entry channels CONVERSATIONAL_ENTRY and
--     MANUAL_MY_WORLD_ENTRY are activation PROVENANCE, carried by an activation
--     row and by nothing else. An offer, a prompt or a suggestion from QANDEEL is
--     not an activation and has no representation at all.
--
--   * MATCHING_CONTEXT_GRANT - public.matching_context_grants plus its immutable
--     public.matching_context_consent_events. Semantics are fixed by TABLE
--     IDENTITY, never by data:
--         grantor      = the exact authenticated human
--         source class = that human's own eligible self-authored MY_WORLD context
--         target       = the Matching capability
--         purpose      = candidate evaluation / safe compatibility reasoning
--         effect       = reasoning eligibility only
--     so there is deliberately NO scope, purpose, action, source, permission,
--     target or JSON column that a later change could widen, and - the point of
--     the frozen kernel's capability-scoped MatchingAdmission - NO world_id.
--     Matching Context Admission has no target World, never becomes a Shared
--     Standing Context Grant and never transfers into a Shared World. This is a
--     SEPARATE family from the I-02B Shared grant tables, not a generalization of
--     them: migrations 0076, 0077 and 0078 are untouched and are not widened to
--     know about Matching.
--
--     REASON_FROM_PRIVATE_CONTEXT != DISCLOSE_PRIVATE_FACT. Nothing here
--     authorizes raw-source disclosure, quoting, copying, provenance disclosure,
--     publication, export or Shared World use, and there is no column or literal
--     for any of them.
--
--   * INTRODUCTION_PROFILE - public.introduction_profile_versions, its immutable
--     public.introduction_profile_field_values, and the ONE current pointer
--     public.introduction_profile_state. Every material update is a NEW immutable
--     version; a historical version is never rewritten. There is exactly one
--     current version identity per human WHEN a profile exists, and no profile is
--     required to represent OFF, ACTIVE or PAUSED participation.
--
--     The Product's final field catalogue is DEFERRED by CW2-06 and this
--     migration does not decide it: a field is a bounded lower-case identifier
--     key with a bounded text value, so the catalogue stays configurable without
--     a speculative marriage questionnaire being frozen into DDL. What the
--     representation may never become is an arbitrary channel, so the key shape
--     is constrained, the value length is structurally ceilinged, there is no
--     JSON and no array column, and a key may not name a DIRECT CONTACT ROUTE or
--     an IDENTITY DOCUMENT - phone, email, a social handle, a street or
--     geographic address, a photo or other media handle, a URL, an identifier
--     number or a KYC artifact. That ban is what makes "no photo or contact
--     disclosure behaviour in I-07A" and "no mandatory documentary identity
--     verification" structural rather than a comment: a later disclosure
--     authority approves a FIELD KEY, and no field key can name a contact route.
--     It bans a contact-route FIELD; it does not police free text a human writes
--     about themselves, and it freezes no Product catalogue decision.
--
--   * MATCHING REQUIREMENTS - public.matching_requirement_versions, its immutable
--     public.matching_requirement_items and the ONE current pointer
--     public.matching_requirement_state. Same immutable-version law, same bounded
--     key representation, same contact-route ban. Each item carries the frozen
--     CW2-06 distinction HARD_DEALBREAKER | SOFT_PREFERENCE and nothing else:
--     there is no weight, score, rank, percentage or priority column, because
--     I-07A stores the human's bounded self-declared requirement truth and
--     evaluates no candidate. A strength is never silently converted, because a
--     committed item is immutable and a changed requirement is a NEW version.
--
--   * PRE_MATCH_PROPOSAL_DISCLOSURE_AUTHORITY -
--     public.pre_match_disclosure_authorities, its
--     public.pre_match_disclosure_authority_fields and its immutable
--     public.pre_match_disclosure_authority_events. The authority binds ONE EXACT
--     Introduction Profile version, and each approved field is bound by composite
--     foreign key to a REAL FIELD ROW OF THAT EXACT VERSION. An authority over V1
--     therefore cannot name a field of V2 even by accident, and never silently
--     covers V2: structural impossibility, not a runtime check that could be
--     forgotten. The authority is also bound to the grantor's OWN profile version
--     by a composite (version, human) foreign key, so it can never authorize
--     disclosure of another human's profile.
--
--     There is deliberately NO recipient, pair, proposal, candidate or match
--     column: no proposal recipient exists in I-07A, and inventing an identifier
--     for one would be pre-implementing I-07B. Safe Compatibility Conclusions are
--     a separately constrained future output class under CW2-06; nothing here
--     calculates, stores or emits one.
--
-- ## Version and current-state law (task section 6)
--
-- History is immutable rows; current truth is an explicit POINTER to an exact
-- historical identity. Every pointer family carries a prior-identity link with a
-- partial unique index, so an identity is superseded at most once and the history
-- is a CHAIN rather than a tree - which is what lets 0109 answer a retry, refuse
-- a stale write and prove that a reactivation is not the laundering of a pause
-- it may not resume. Each pointer additionally carries a truth trigger that
-- refuses a pointer move whose target does not chain from the value being
-- replaced, so even the table owner cannot fork a human's history.
--
-- Every committed instant is CURRENT_TIMESTAMP from the database clock. No
-- relation accepts a caller-supplied timestamp and none has a client-writable
-- default.
--
-- ## Access posture
--
-- Every relation here is private operational state: postgres-owned, RLS-enabled
-- with ZERO policies, and revoked from PUBLIC, anon, authenticated and
-- service_role on every privilege. No policy, view, RPC or read boundary exists,
-- so no application caller - including a service credential - can read, create,
-- widen or revoke any Matching authority through this migration. The only future
-- write path is 0109's narrow auth.uid()-derived human commands.
--
-- ## Anti-scope, enforced rather than asserted
--
-- No candidate, pair, PAIR_KEY, eligibility snapshot, proposal, proposal cadence,
-- Mutual Match, match commit, Introduction slot, Introduction record, Shared
-- World birth, progressive disclosure, safety, report, block, entitlement,
-- pricing, ranking, score or compatibility relation is created, and the terminal
-- self-assertion refuses one. Migrations 0001-0107 are untouched; public.users is
-- referenced only as a foreign-key parent.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE PER-HUMAN SERIALIZATION ROW.
--
--    Not a directory, not a participation fact and not an authority: the
--    canonical durable row every 0109 command locks first, so one human's
--    Matching commands have one order. It is deliberately the whole of its own
--    concern - the terminal self-assertion refuses a third column.
-- ---------------------------------------------------------------------------
CREATE TABLE public.matching_setup_locks (
    user_id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT matching_setup_locks_user_fk
        FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.matching_setup_locks IS
  'The per-human serialization row for every Matching setup command. It carries '
  'no authority, no state and no participation fact; its existence says only '
  'that some Matching command of that human once ran. It is not a participant '
  'directory: no application role can read it and no command accepts another '
  'human''s identifier.';

-- ---------------------------------------------------------------------------
-- 2. MATCHING PARTICIPATION - immutable act history, then the ONE pointer.
--
--    A participation act is one human decision. Its row id IS the 0109 command
--    id, so the primary key is the durable idempotency record and there is no
--    second idempotency table. prior_event_id is the act this one supersedes.
-- ---------------------------------------------------------------------------
CREATE TABLE public.matching_participation_events (
    id uuid PRIMARY KEY,
    participant_user_id uuid NOT NULL,
    participation_act text NOT NULL,
    resulting_state text NOT NULL,
    resulting_pause_reason text,
    activation_entry_channel text,
    prior_event_id uuid,
    occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- The composite identity a current pointer binds to, so a pointer can never
    -- name an act of a different human.
    CONSTRAINT matching_participation_events_participant_identity_key
        UNIQUE (id, participant_user_id),
    CONSTRAINT matching_participation_events_participant_fk
        FOREIGN KEY (participant_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT matching_participation_events_prior_event_fk
        FOREIGN KEY (prior_event_id, participant_user_id)
        REFERENCES public.matching_participation_events (id, participant_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_participation_events_prior_event_check
        CHECK (prior_event_id IS NULL OR prior_event_id <> id),
    -- The four human acts I-07A owns. A later reviewed slice that introduces a
    -- non-human pause producer extends this vocabulary and the mapping below;
    -- that is an ordinary forward migration and nothing else here refuses it.
    CONSTRAINT matching_participation_events_act_check
        CHECK (participation_act IN ('ACTIVATE', 'PAUSE', 'RESUME', 'TURN_OFF')),
    CONSTRAINT matching_participation_events_state_check
        CHECK (resulting_state IN ('OFF', 'ACTIVE', 'PAUSED')),
    -- All five CW2-06 pause reasons are representable. Only USER_PAUSED has an
    -- I-07A producer; the other four are reserved for I-07C / I-07D.
    CONSTRAINT matching_participation_events_pause_reason_check
        CHECK (resulting_pause_reason IS NULL OR resulting_pause_reason IN
               ('USER_PAUSED', 'ACTIVE_INTRODUCTION', 'POST_INTRODUCTION', 'POST_SUCCESS', 'SYSTEM_POLICY')),
    CONSTRAINT matching_participation_events_entry_channel_check
        CHECK (activation_entry_channel IS NULL OR activation_entry_channel IN
               ('CONVERSATIONAL_ENTRY', 'MANUAL_MY_WORLD_ENTRY')),
    -- A pause reason exists exactly when the state is PAUSED.
    CONSTRAINT matching_participation_events_pause_coherence_check
        CHECK ((resulting_pause_reason IS NOT NULL) = (resulting_state = 'PAUSED')),
    -- An entry channel exists exactly for an activation: a resume is not a fresh
    -- entry and carries no provenance of one.
    CONSTRAINT matching_participation_events_entry_coherence_check
        CHECK ((activation_entry_channel IS NOT NULL) = (participation_act = 'ACTIVATE')),
    CONSTRAINT matching_participation_events_act_state_check
        CHECK (resulting_state = CASE participation_act
                                   WHEN 'ACTIVATE' THEN 'ACTIVE'
                                   WHEN 'PAUSE'    THEN 'PAUSED'
                                   WHEN 'RESUME'   THEN 'ACTIVE'
                                   WHEN 'TURN_OFF' THEN 'OFF'
                                 END)
);

-- An act is superseded at most once: the history is a chain, never a tree.
CREATE UNIQUE INDEX matching_participation_events_prior_event_idx
    ON public.matching_participation_events (prior_event_id)
    WHERE prior_event_id IS NOT NULL;

-- The one frozen history access pattern: a human's own acts in database order.
CREATE INDEX matching_participation_events_participant_idx
    ON public.matching_participation_events (participant_user_id, occurred_at);

COMMENT ON TABLE public.matching_participation_events IS
  'The immutable append-only chain of one human''s Matching participation acts. '
  'The row id IS the command id that produced it. It records what the human did '
  'and what state that produced; it never records an actor other than the human, '
  'a QANDEEL offer, a suggestion or a system decision.';

-- The ONE current participation truth per human. Absence of a row is OFF.
CREATE TABLE public.matching_participation_state (
    participant_user_id uuid PRIMARY KEY,
    current_event_id uuid NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- One act is the current act of at most one human.
    CONSTRAINT matching_participation_state_current_event_key UNIQUE (current_event_id),
    CONSTRAINT matching_participation_state_participant_fk
        FOREIGN KEY (participant_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    -- The pointer names an exact act OF THIS EXACT HUMAN. The current state is
    -- that act's resulting state and is stored nowhere else, so the two cannot
    -- disagree.
    CONSTRAINT matching_participation_state_current_event_fk
        FOREIGN KEY (current_event_id, participant_user_id)
        REFERENCES public.matching_participation_events (id, participant_user_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.matching_participation_state IS
  'The ONE current Matching participation pointer per human. It duplicates no '
  'state: the current state is the resulting state of the exact act it names. '
  'No row means OFF - participation is never inferred from a profile, a grant, a '
  'disclosure authority or conversation history.';

-- ---------------------------------------------------------------------------
-- 3. MATCHING CONTEXT GRANT - capability-scoped, worldless, reasoning only.
-- ---------------------------------------------------------------------------
CREATE TABLE public.matching_context_grants (
    id uuid PRIMARY KEY,
    grantor_user_id uuid NOT NULL,
    status text NOT NULL,
    granted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at timestamptz,
    CONSTRAINT matching_context_grants_grantor_identity_key UNIQUE (id, grantor_user_id),
    CONSTRAINT matching_context_grants_grantor_fk
        FOREIGN KEY (grantor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT matching_context_grants_status_check
        CHECK (status IN ('ACTIVE', 'REVOKED')),
    CONSTRAINT matching_context_grants_revocation_check
        CHECK ((status = 'ACTIVE' AND revoked_at IS NULL)
            OR (status = 'REVOKED' AND revoked_at IS NOT NULL)),
    CONSTRAINT matching_context_grants_revoked_after_grant_check
        CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

-- Exactly one CURRENT ACTIVE Matching context grant per human. Revoked history
-- rows coexist freely; a reconfirmation is a NEW row, never a rewrite.
CREATE UNIQUE INDEX matching_context_grants_one_active_idx
    ON public.matching_context_grants (grantor_user_id)
    WHERE status = 'ACTIVE';

CREATE INDEX matching_context_grants_grantor_idx
    ON public.matching_context_grants (grantor_user_id, granted_at);

COMMENT ON TABLE public.matching_context_grants IS
  'Explicit human authority allowing QANDEEL to reason from that same human''s '
  'eligible self-authored MY_WORLD context FOR THE MATCHING CAPABILITY ONLY. '
  'Grantor, source class, target, purpose and effect are fixed by table '
  'identity, so no column can widen them, and there is no world_id: Matching '
  'Context Admission has no target World and never transfers into one. It does '
  'not activate Matching and Matching participation does not create it.';

CREATE TABLE public.matching_context_consent_events (
    id uuid PRIMARY KEY,
    grantor_user_id uuid NOT NULL,
    event_type text NOT NULL,
    subject_grant_id uuid NOT NULL,
    prior_grant_id uuid,
    occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT matching_context_consent_events_grantor_fk
        FOREIGN KEY (grantor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    -- A consent act can only ever concern the actor's OWN grant: one exact row,
    -- never two independently satisfiable references.
    CONSTRAINT matching_context_consent_events_subject_grant_fk
        FOREIGN KEY (subject_grant_id, grantor_user_id)
        REFERENCES public.matching_context_grants (id, grantor_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_context_consent_events_prior_grant_fk
        FOREIGN KEY (prior_grant_id, grantor_user_id)
        REFERENCES public.matching_context_grants (id, grantor_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_context_consent_events_event_type_check
        CHECK (event_type IN ('GRANTED', 'RECONFIRMED', 'REVOKED')),
    CONSTRAINT matching_context_consent_events_prior_grant_check
        CHECK ((event_type = 'GRANTED' AND prior_grant_id IS NULL)
            OR (event_type = 'RECONFIRMED' AND prior_grant_id IS NOT NULL AND prior_grant_id <> subject_grant_id)
            OR (event_type = 'REVOKED' AND prior_grant_id IS NULL))
);

CREATE UNIQUE INDEX matching_context_consent_events_birth_event_idx
    ON public.matching_context_consent_events (subject_grant_id)
    WHERE event_type IN ('GRANTED', 'RECONFIRMED');

CREATE UNIQUE INDEX matching_context_consent_events_revoke_event_idx
    ON public.matching_context_consent_events (subject_grant_id)
    WHERE event_type = 'REVOKED';

CREATE UNIQUE INDEX matching_context_consent_events_prior_grant_idx
    ON public.matching_context_consent_events (prior_grant_id)
    WHERE prior_grant_id IS NOT NULL;

CREATE INDEX matching_context_consent_events_grantor_idx
    ON public.matching_context_consent_events (grantor_user_id, occurred_at);

COMMENT ON TABLE public.matching_context_consent_events IS
  'Append-only human consent history for the Matching Context Grant. The row id '
  'IS the command id, so it is also the durable idempotency record. A consent '
  'event is never edited or deleted, and current authority is never derived from '
  '"a GRANTED event once existed": the ACTIVE grant row is the only current '
  'truth.';

-- ---------------------------------------------------------------------------
-- 4. INTRODUCTION PROFILE - immutable versions, bounded fields, ONE pointer.
-- ---------------------------------------------------------------------------
CREATE TABLE public.introduction_profile_versions (
    id uuid PRIMARY KEY,
    owner_user_id uuid NOT NULL,
    prior_profile_version_id uuid,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT introduction_profile_versions_owner_identity_key UNIQUE (id, owner_user_id),
    CONSTRAINT introduction_profile_versions_owner_fk
        FOREIGN KEY (owner_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT introduction_profile_versions_prior_version_fk
        FOREIGN KEY (prior_profile_version_id, owner_user_id)
        REFERENCES public.introduction_profile_versions (id, owner_user_id) ON DELETE RESTRICT,
    CONSTRAINT introduction_profile_versions_prior_version_check
        CHECK (prior_profile_version_id IS NULL OR prior_profile_version_id <> id)
);

CREATE UNIQUE INDEX introduction_profile_versions_prior_version_idx
    ON public.introduction_profile_versions (prior_profile_version_id)
    WHERE prior_profile_version_id IS NOT NULL;

CREATE INDEX introduction_profile_versions_owner_idx
    ON public.introduction_profile_versions (owner_user_id, created_at);

COMMENT ON TABLE public.introduction_profile_versions IS
  'One immutable Introduction Profile version. A material update creates a NEW '
  'version and never rewrites a historical one. This is private human-owned '
  'Matching state: it is not a Public profile and it is not Shared World state.';

CREATE TABLE public.introduction_profile_field_values (
    profile_version_id uuid NOT NULL,
    field_key text NOT NULL,
    field_value text NOT NULL,
    CONSTRAINT introduction_profile_field_values_pkey PRIMARY KEY (profile_version_id, field_key),
    CONSTRAINT introduction_profile_field_values_version_fk
        FOREIGN KEY (profile_version_id) REFERENCES public.introduction_profile_versions (id) ON DELETE RESTRICT,
    -- A bounded lower-case identifier. The Product catalogue stays configurable;
    -- the REPRESENTATION does not become arbitrary.
    CONSTRAINT introduction_profile_field_values_field_key_shape_check
        CHECK (field_key ~ '^[a-z][a-z0-9_]{2,47}$'),
    -- A field key may never name a direct contact route, a media handle or an
    -- identity document. Underscore-delimited tokens, so `handles_conflict` is a
    -- profile field while `whatsapp_handle` can never exist.
    CONSTRAINT introduction_profile_field_values_contact_route_ban_check
        CHECK (field_key !~ ('(^|_)(phone|mobile|email|whatsapp|telegram|instagram|snapchat|tiktok'
                          || '|facebook|twitter|linkedin|handle|username|contact|address|street|geo|gps'
                          || '|latitude|longitude|coordinates|url|uri|link|photo|image|avatar|selfie'
                          || '|video|audio|passport|ssn|nid|kyc|password|token|id)(_|$)')),
    -- A structural ceiling that keeps this relation from becoming a blob or
    -- output channel. It is not a Product field length and freezes no catalogue.
    CONSTRAINT introduction_profile_field_values_field_value_check
        CHECK (btrim(field_value) <> '' AND length(field_value) <= 4096)
);

COMMENT ON TABLE public.introduction_profile_field_values IS
  'The immutable bounded field set of one Introduction Profile version. The '
  'Product field catalogue is deferred by CW2-06 and is not frozen here; what is '
  'frozen is that a field is a bounded key with a bounded private text value, '
  'that no key can name a contact route, media handle or identity document, and '
  'that no value is ever inferred from a name, a voice, a photo, a language '
  'style or any other unrelated attribute.';

CREATE TABLE public.introduction_profile_state (
    owner_user_id uuid PRIMARY KEY,
    current_profile_version_id uuid NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT introduction_profile_state_current_version_key UNIQUE (current_profile_version_id),
    CONSTRAINT introduction_profile_state_owner_fk
        FOREIGN KEY (owner_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT introduction_profile_state_current_version_fk
        FOREIGN KEY (current_profile_version_id, owner_user_id)
        REFERENCES public.introduction_profile_versions (id, owner_user_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.introduction_profile_state IS
  'Exactly one current Introduction Profile version identity per human, when a '
  'profile exists. No row means no profile - which is a valid state for OFF, '
  'ACTIVE and PAUSED participation alike.';

-- ---------------------------------------------------------------------------
-- 5. MATCHING REQUIREMENTS - immutable versions, hard vs soft, ONE pointer.
-- ---------------------------------------------------------------------------
CREATE TABLE public.matching_requirement_versions (
    id uuid PRIMARY KEY,
    owner_user_id uuid NOT NULL,
    prior_requirement_version_id uuid,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT matching_requirement_versions_owner_identity_key UNIQUE (id, owner_user_id),
    CONSTRAINT matching_requirement_versions_owner_fk
        FOREIGN KEY (owner_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT matching_requirement_versions_prior_version_fk
        FOREIGN KEY (prior_requirement_version_id, owner_user_id)
        REFERENCES public.matching_requirement_versions (id, owner_user_id) ON DELETE RESTRICT,
    CONSTRAINT matching_requirement_versions_prior_version_check
        CHECK (prior_requirement_version_id IS NULL OR prior_requirement_version_id <> id)
);

CREATE UNIQUE INDEX matching_requirement_versions_prior_version_idx
    ON public.matching_requirement_versions (prior_requirement_version_id)
    WHERE prior_requirement_version_id IS NOT NULL;

CREATE INDEX matching_requirement_versions_owner_idx
    ON public.matching_requirement_versions (owner_user_id, created_at);

COMMENT ON TABLE public.matching_requirement_versions IS
  'One immutable version of a human''s self-declared Matching requirement set. A '
  'material edit creates a NEW version; a historical version is never mutated '
  'into the new truth.';

CREATE TABLE public.matching_requirement_items (
    requirement_version_id uuid NOT NULL,
    requirement_key text NOT NULL,
    requirement_strength text NOT NULL,
    requirement_value text NOT NULL,
    CONSTRAINT matching_requirement_items_pkey PRIMARY KEY (requirement_version_id, requirement_key),
    CONSTRAINT matching_requirement_items_version_fk
        FOREIGN KEY (requirement_version_id) REFERENCES public.matching_requirement_versions (id) ON DELETE RESTRICT,
    -- The frozen CW2-06 distinction, and nothing beside it. There is no weight,
    -- score, rank, percentage or priority column: I-07A evaluates no candidate.
    CONSTRAINT matching_requirement_items_strength_check
        CHECK (requirement_strength IN ('HARD_DEALBREAKER', 'SOFT_PREFERENCE')),
    CONSTRAINT matching_requirement_items_key_shape_check
        CHECK (requirement_key ~ '^[a-z][a-z0-9_]{2,47}$'),
    CONSTRAINT matching_requirement_items_contact_route_ban_check
        CHECK (requirement_key !~ ('(^|_)(phone|mobile|email|whatsapp|telegram|instagram|snapchat|tiktok'
                                || '|facebook|twitter|linkedin|handle|username|contact|address|street|geo|gps'
                                || '|latitude|longitude|coordinates|url|uri|link|photo|image|avatar|selfie'
                                || '|video|audio|passport|ssn|nid|kyc|password|token|id)(_|$)')),
    CONSTRAINT matching_requirement_items_value_check
        CHECK (btrim(requirement_value) <> '' AND length(requirement_value) <= 4096)
);

COMMENT ON TABLE public.matching_requirement_items IS
  'The immutable bounded requirement set of one version, each item carrying the '
  'frozen HARD_DEALBREAKER | SOFT_PREFERENCE distinction. Nothing here evaluates '
  'a candidate, scores compatibility, ranks anyone or decides what an unknown '
  'candidate truth means: that is I-07B''s PASS | FAIL | UNKNOWN work and it does '
  'not exist yet.';

CREATE TABLE public.matching_requirement_state (
    owner_user_id uuid PRIMARY KEY,
    current_requirement_version_id uuid NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT matching_requirement_state_current_version_key UNIQUE (current_requirement_version_id),
    CONSTRAINT matching_requirement_state_owner_fk
        FOREIGN KEY (owner_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT matching_requirement_state_current_version_fk
        FOREIGN KEY (current_requirement_version_id, owner_user_id)
        REFERENCES public.matching_requirement_versions (id, owner_user_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.matching_requirement_state IS
  'Exactly one current Matching requirement version identity per human, when a '
  'requirement set exists.';

-- ---------------------------------------------------------------------------
-- 6. PRE-MATCH PROPOSAL DISCLOSURE AUTHORITY - exact version, exact fields.
-- ---------------------------------------------------------------------------
CREATE TABLE public.pre_match_disclosure_authorities (
    id uuid PRIMARY KEY,
    grantor_user_id uuid NOT NULL,
    introduction_profile_version_id uuid NOT NULL,
    status text NOT NULL,
    granted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at timestamptz,
    CONSTRAINT pre_match_disclosure_authorities_grantor_identity_key UNIQUE (id, grantor_user_id),
    -- The composite identity the approved-field rows bind to, so a field row can
    -- never reach a version the authority is not bound to.
    CONSTRAINT pre_match_disclosure_authorities_version_identity_key
        UNIQUE (id, introduction_profile_version_id),
    CONSTRAINT pre_match_disclosure_authorities_grantor_fk
        FOREIGN KEY (grantor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    -- ONE exact profile version, and it is the GRANTOR'S OWN: a human can never
    -- authorize disclosure of another human's profile.
    CONSTRAINT pre_match_disclosure_authorities_profile_version_fk
        FOREIGN KEY (introduction_profile_version_id, grantor_user_id)
        REFERENCES public.introduction_profile_versions (id, owner_user_id) ON DELETE RESTRICT,
    CONSTRAINT pre_match_disclosure_authorities_status_check
        CHECK (status IN ('ACTIVE', 'REVOKED')),
    CONSTRAINT pre_match_disclosure_authorities_revocation_check
        CHECK ((status = 'ACTIVE' AND revoked_at IS NULL)
            OR (status = 'REVOKED' AND revoked_at IS NOT NULL)),
    CONSTRAINT pre_match_disclosure_authorities_revoked_after_grant_check
        CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

CREATE UNIQUE INDEX pre_match_disclosure_authorities_one_active_idx
    ON public.pre_match_disclosure_authorities (grantor_user_id)
    WHERE status = 'ACTIVE';

CREATE INDEX pre_match_disclosure_authorities_grantor_idx
    ON public.pre_match_disclosure_authorities (grantor_user_id, granted_at);

COMMENT ON TABLE public.pre_match_disclosure_authorities IS
  'Explicit human authority for bounded FUTURE pre-Match proposal disclosure, '
  'bound to ONE exact Introduction Profile version of the grantor''s own. It '
  'creates no proposal, authorizes no raw private evidence, no hidden Matching '
  'context, no secret provenance and no direct contact route, and carries no '
  'recipient, pair, proposal or candidate identifier because none exists in '
  'I-07A. An authority over one version never silently covers the next.';

CREATE TABLE public.pre_match_disclosure_authority_fields (
    authority_id uuid NOT NULL,
    introduction_profile_version_id uuid NOT NULL,
    field_key text NOT NULL,
    CONSTRAINT pre_match_disclosure_authority_fields_pkey PRIMARY KEY (authority_id, field_key),
    -- The field belongs to THIS authority AND to the exact version THIS authority
    -- is bound to - one row, not two independently satisfiable references.
    CONSTRAINT pre_match_disclosure_authority_fields_authority_version_fk
        FOREIGN KEY (authority_id, introduction_profile_version_id)
        REFERENCES public.pre_match_disclosure_authorities (id, introduction_profile_version_id) ON DELETE RESTRICT,
    -- ... and it is a REAL field row of that exact version. A V1 authority
    -- therefore cannot name a V2 field: structurally impossible, not merely
    -- refused at runtime.
    CONSTRAINT pre_match_disclosure_authority_fields_profile_field_fk
        FOREIGN KEY (introduction_profile_version_id, field_key)
        REFERENCES public.introduction_profile_field_values (profile_version_id, field_key) ON DELETE RESTRICT
);

CREATE INDEX pre_match_disclosure_authority_fields_version_idx
    ON public.pre_match_disclosure_authority_fields (introduction_profile_version_id, field_key);

COMMENT ON TABLE public.pre_match_disclosure_authority_fields IS
  'The exact bounded set of Introduction Profile fields one authority approves, '
  'each bound by composite foreign key to a real field row of the exact version '
  'the authority names. It carries no value, no recipient and no proposal.';

CREATE TABLE public.pre_match_disclosure_authority_events (
    id uuid PRIMARY KEY,
    grantor_user_id uuid NOT NULL,
    event_type text NOT NULL,
    subject_authority_id uuid NOT NULL,
    prior_authority_id uuid,
    occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pre_match_disclosure_authority_events_grantor_fk
        FOREIGN KEY (grantor_user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT pre_match_disclosure_authority_events_subject_fk
        FOREIGN KEY (subject_authority_id, grantor_user_id)
        REFERENCES public.pre_match_disclosure_authorities (id, grantor_user_id) ON DELETE RESTRICT,
    CONSTRAINT pre_match_disclosure_authority_events_prior_fk
        FOREIGN KEY (prior_authority_id, grantor_user_id)
        REFERENCES public.pre_match_disclosure_authorities (id, grantor_user_id) ON DELETE RESTRICT,
    CONSTRAINT pre_match_disclosure_authority_events_event_type_check
        CHECK (event_type IN ('GRANTED', 'RECONFIRMED', 'REVOKED')),
    CONSTRAINT pre_match_disclosure_authority_events_prior_check
        CHECK ((event_type = 'GRANTED' AND prior_authority_id IS NULL)
            OR (event_type = 'RECONFIRMED' AND prior_authority_id IS NOT NULL AND prior_authority_id <> subject_authority_id)
            OR (event_type = 'REVOKED' AND prior_authority_id IS NULL))
);

CREATE UNIQUE INDEX pre_match_disclosure_authority_events_birth_idx
    ON public.pre_match_disclosure_authority_events (subject_authority_id)
    WHERE event_type IN ('GRANTED', 'RECONFIRMED');

CREATE UNIQUE INDEX pre_match_disclosure_authority_events_revoke_idx
    ON public.pre_match_disclosure_authority_events (subject_authority_id)
    WHERE event_type = 'REVOKED';

CREATE UNIQUE INDEX pre_match_disclosure_authority_events_prior_idx
    ON public.pre_match_disclosure_authority_events (prior_authority_id)
    WHERE prior_authority_id IS NOT NULL;

CREATE INDEX pre_match_disclosure_authority_events_grantor_idx
    ON public.pre_match_disclosure_authority_events (grantor_user_id, occurred_at);

COMMENT ON TABLE public.pre_match_disclosure_authority_events IS
  'Append-only human authority history for the Pre-Match Proposal Disclosure '
  'Authority. The row id IS the command id, so it is also the durable '
  'idempotency record.';

-- ---------------------------------------------------------------------------
-- 7. IMMUTABILITY AND TRUTH TRIGGERS.
--
--    Triggers rather than privileges alone, for the reason migrations 0064, 0091
--    and 0100 established: a privilege does not bind the table owner, and a
--    future accidental GRANT would otherwise reopen mutation. None of these is a
--    forward ceiling - appending a new version, a new act, a new consent event
--    and moving a pointer forward are all exactly what a later slice does.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.reject_matching_setup_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'MATCHING_SETUP_RECORD_IS_IMMUTABLE'
    USING ERRCODE='55000',
          DETAIL='A Matching participation act, a consent or authority event, an Introduction Profile version and its fields, a requirement version and its items, and an approved disclosure field are append-only: UPDATE and DELETE are refused for every role, including the table owner. A changed profile, requirement set or authority is a NEW immutable version.';
END$$;

ALTER FUNCTION public.reject_matching_setup_mutation_v1() OWNER TO postgres;

CREATE TRIGGER matching_participation_events_immutable
    BEFORE UPDATE OR DELETE ON public.matching_participation_events
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_setup_mutation_v1();
CREATE TRIGGER matching_context_consent_events_immutable
    BEFORE UPDATE OR DELETE ON public.matching_context_consent_events
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_setup_mutation_v1();
CREATE TRIGGER introduction_profile_versions_immutable
    BEFORE UPDATE OR DELETE ON public.introduction_profile_versions
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_setup_mutation_v1();
CREATE TRIGGER introduction_profile_field_values_immutable
    BEFORE UPDATE OR DELETE ON public.introduction_profile_field_values
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_setup_mutation_v1();
CREATE TRIGGER matching_requirement_versions_immutable
    BEFORE UPDATE OR DELETE ON public.matching_requirement_versions
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_setup_mutation_v1();
CREATE TRIGGER matching_requirement_items_immutable
    BEFORE UPDATE OR DELETE ON public.matching_requirement_items
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_setup_mutation_v1();
CREATE TRIGGER pre_match_disclosure_authority_fields_immutable
    BEFORE UPDATE OR DELETE ON public.pre_match_disclosure_authority_fields
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_setup_mutation_v1();
CREATE TRIGGER pre_match_disclosure_authority_events_immutable
    BEFORE UPDATE OR DELETE ON public.pre_match_disclosure_authority_events
    FOR EACH ROW EXECUTE FUNCTION public.reject_matching_setup_mutation_v1();

-- An authority row moves exactly one way - ACTIVE to REVOKED - and its identity
-- is frozen at grant time. A revoked authority is never reactivated, a
-- reconfirmation is a NEW identity, and no column outside status / revoked_at
-- may change. The comparison is over the whole row, so a column a later reviewed
-- slice adds is frozen by the same rule without this function being edited.
CREATE FUNCTION public.matching_authority_status_truth_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  changed text[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'MATCHING_AUTHORITY_IS_APPEND_ONLY'
      USING ERRCODE='55000',
            DETAIL='A Matching authority row is durable human-consent history and is never deleted. Revocation keeps the row.';
  END IF;
  SELECT array_agg(o.key ORDER BY o.key) INTO changed
    FROM jsonb_each_text(to_jsonb(OLD)) AS o(key, value)
    JOIN jsonb_each_text(to_jsonb(NEW)) AS n(key, value) ON n.key = o.key
   WHERE o.key NOT IN ('status', 'revoked_at')
     AND o.value IS DISTINCT FROM n.value;
  IF changed IS NOT NULL THEN
    RAISE EXCEPTION 'MATCHING_AUTHORITY_IDENTITY_IS_FROZEN'
      USING ERRCODE='55000',
            DETAIL=format('These columns are frozen at grant time and may never be rewritten: %s.', array_to_string(changed, ', '));
  END IF;
  IF NOT (OLD.status = 'ACTIVE' AND NEW.status = 'REVOKED' AND NEW.revoked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'MATCHING_AUTHORITY_TRANSITION_INVALID'
      USING ERRCODE='55000',
            DETAIL='The only legal Matching authority transition is ACTIVE to REVOKED with a revocation instant. A revoked authority is never reactivated and an active one is never edited in place.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.matching_authority_status_truth_v1() OWNER TO postgres;

CREATE TRIGGER matching_context_grants_status_truth
    BEFORE UPDATE OR DELETE ON public.matching_context_grants
    FOR EACH ROW EXECUTE FUNCTION public.matching_authority_status_truth_v1();
CREATE TRIGGER pre_match_disclosure_authorities_status_truth
    BEFORE UPDATE OR DELETE ON public.pre_match_disclosure_authorities
    FOR EACH ROW EXECUTE FUNCTION public.matching_authority_status_truth_v1();

-- Each current pointer may only ever move FORWARD ALONG ITS OWN CHAIN: the first
-- value must be a chain root, every later value must name the identity that
-- supersedes the value being replaced, the human it belongs to never changes and
-- the pointer is never deleted. This binds the table owner too, so even a direct
-- write cannot fork a human's history or graft another human's identity onto it.
CREATE FUNCTION public.matching_participation_state_truth_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  expected_prior uuid;
  replaced uuid := NULL;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'MATCHING_CURRENT_STATE_IS_DURABLE'
      USING ERRCODE='55000', DETAIL='A current Matching pointer is durable truth and is never deleted.';
  END IF;
  -- OLD is only readable on UPDATE, so the value being replaced is captured in
  -- its own branch rather than inside an expression the INSERT path would also
  -- have to evaluate.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.participant_user_id IS DISTINCT FROM OLD.participant_user_id THEN
      RAISE EXCEPTION 'MATCHING_CURRENT_STATE_HUMAN_IS_FROZEN'
        USING ERRCODE='55000', DETAIL='A current Matching pointer belongs to one human for its whole life.';
    END IF;
    replaced := OLD.current_event_id;
  END IF;
  SELECT e.prior_event_id INTO expected_prior
    FROM public.matching_participation_events e
   WHERE e.id = NEW.current_event_id;
  IF expected_prior IS DISTINCT FROM replaced THEN
    RAISE EXCEPTION 'MATCHING_CURRENT_STATE_NOT_A_FORWARD_MOVE'
      USING ERRCODE='55000',
            DETAIL='A current participation pointer may only name the act that supersedes the act it replaces, and a first pointer may only name a chain root.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.matching_participation_state_truth_v1() OWNER TO postgres;

CREATE TRIGGER matching_participation_state_truth
    BEFORE INSERT OR UPDATE OR DELETE ON public.matching_participation_state
    FOR EACH ROW EXECUTE FUNCTION public.matching_participation_state_truth_v1();

CREATE FUNCTION public.introduction_profile_state_truth_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  expected_prior uuid;
  replaced uuid := NULL;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'MATCHING_CURRENT_STATE_IS_DURABLE'
      USING ERRCODE='55000', DETAIL='A current Matching pointer is durable truth and is never deleted.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
      RAISE EXCEPTION 'MATCHING_CURRENT_STATE_HUMAN_IS_FROZEN'
        USING ERRCODE='55000', DETAIL='A current Matching pointer belongs to one human for its whole life.';
    END IF;
    replaced := OLD.current_profile_version_id;
  END IF;
  SELECT v.prior_profile_version_id INTO expected_prior
    FROM public.introduction_profile_versions v
   WHERE v.id = NEW.current_profile_version_id;
  IF expected_prior IS DISTINCT FROM replaced THEN
    RAISE EXCEPTION 'MATCHING_CURRENT_STATE_NOT_A_FORWARD_MOVE'
      USING ERRCODE='55000',
            DETAIL='A current Introduction Profile pointer may only name the version that supersedes the version it replaces, and a first pointer may only name a chain root.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.introduction_profile_state_truth_v1() OWNER TO postgres;

CREATE TRIGGER introduction_profile_state_truth
    BEFORE INSERT OR UPDATE OR DELETE ON public.introduction_profile_state
    FOR EACH ROW EXECUTE FUNCTION public.introduction_profile_state_truth_v1();

CREATE FUNCTION public.matching_requirement_state_truth_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  expected_prior uuid;
  replaced uuid := NULL;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'MATCHING_CURRENT_STATE_IS_DURABLE'
      USING ERRCODE='55000', DETAIL='A current Matching pointer is durable truth and is never deleted.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
      RAISE EXCEPTION 'MATCHING_CURRENT_STATE_HUMAN_IS_FROZEN'
        USING ERRCODE='55000', DETAIL='A current Matching pointer belongs to one human for its whole life.';
    END IF;
    replaced := OLD.current_requirement_version_id;
  END IF;
  SELECT v.prior_requirement_version_id INTO expected_prior
    FROM public.matching_requirement_versions v
   WHERE v.id = NEW.current_requirement_version_id;
  IF expected_prior IS DISTINCT FROM replaced THEN
    RAISE EXCEPTION 'MATCHING_CURRENT_STATE_NOT_A_FORWARD_MOVE'
      USING ERRCODE='55000',
            DETAIL='A current requirement pointer may only name the version that supersedes the version it replaces, and a first pointer may only name a chain root.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.matching_requirement_state_truth_v1() OWNER TO postgres;

CREATE TRIGGER matching_requirement_state_truth
    BEFORE INSERT OR UPDATE OR DELETE ON public.matching_requirement_state
    FOR EACH ROW EXECUTE FUNCTION public.matching_requirement_state_truth_v1();

-- The serialization row is a lock anchor and nothing else: its human and its
-- birth instant never change and it is never deleted. A no-op touch is what an
-- upsert-and-lock performs and is deliberately allowed; a rewrite is not.
CREATE FUNCTION public.matching_setup_lock_truth_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'MATCHING_SETUP_LOCK_IS_DURABLE'
      USING ERRCODE='55000', DETAIL='The per-human Matching serialization row is never deleted.';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'MATCHING_SETUP_LOCK_IS_IMMUTABLE'
      USING ERRCODE='55000', DETAIL='The per-human Matching serialization row carries no mutable state.';
  END IF;
  RETURN NEW;
END$$;

ALTER FUNCTION public.matching_setup_lock_truth_v1() OWNER TO postgres;

CREATE TRIGGER matching_setup_locks_truth
    BEFORE UPDATE OR DELETE ON public.matching_setup_locks
    FOR EACH ROW EXECUTE FUNCTION public.matching_setup_lock_truth_v1();

-- ---------------------------------------------------------------------------
-- 8. DENY-BY-DEFAULT ACCESS POSTURE.
--
--    RLS on with zero policies, postgres ownership, and every application role
--    revoked from every privilege on every relation. The trigger functions are
--    revoked too: a role that could call one directly could forge a trigger
--    context. Matching setup truth is unreachable until 0109 introduces its
--    narrow human commands.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'public.matching_setup_locks',
    'public.matching_participation_events',
    'public.matching_participation_state',
    'public.matching_context_grants',
    'public.matching_context_consent_events',
    'public.introduction_profile_versions',
    'public.introduction_profile_field_values',
    'public.introduction_profile_state',
    'public.matching_requirement_versions',
    'public.matching_requirement_items',
    'public.matching_requirement_state',
    'public.pre_match_disclosure_authorities',
    'public.pre_match_disclosure_authority_fields',
    'public.pre_match_disclosure_authority_events'] LOOP
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
    'public.reject_matching_setup_mutation_v1()',
    'public.matching_authority_status_truth_v1()',
    'public.matching_participation_state_truth_v1()',
    'public.introduction_profile_state_truth_v1()',
    'public.matching_requirement_state_truth_v1()',
    'public.matching_setup_lock_truth_v1()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', trigger_function);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role', trigger_function);
    END IF;
  END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 9. TERMINAL SELF-ASSERTIONS.
--
--    The migration refuses to deploy a Matching substrate that is
--    application-reachable, policy-bearing, generically shaped, world-scoped,
--    candidate-scoped, disclosure-shaped or ranked - and refuses one whose
--    immutability triggers are missing.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  own_tables text[] := ARRAY[
    'matching_setup_locks',
    'matching_participation_events',
    'matching_participation_state',
    'matching_context_grants',
    'matching_context_consent_events',
    'introduction_profile_versions',
    'introduction_profile_field_values',
    'introduction_profile_state',
    'matching_requirement_versions',
    'matching_requirement_items',
    'matching_requirement_state',
    'pre_match_disclosure_authorities',
    'pre_match_disclosure_authority_fields',
    'pre_match_disclosure_authority_events'];
  immutable_tables text[] := ARRAY[
    'matching_participation_events',
    'matching_context_consent_events',
    'introduction_profile_versions',
    'introduction_profile_field_values',
    'matching_requirement_versions',
    'matching_requirement_items',
    'pre_match_disclosure_authority_fields',
    'pre_match_disclosure_authority_events'];
  guarded_tables text[] := ARRAY[
    'matching_setup_locks',
    'matching_participation_state',
    'matching_context_grants',
    'introduction_profile_state',
    'matching_requirement_state',
    'pre_match_disclosure_authorities'];
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
      RAISE EXCEPTION 'I-07A: row level security must be enabled on %', qualified;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = qualified::regclass) THEN
      RAISE EXCEPTION 'I-07A: no RLS policy may exist on %', qualified;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) AS privilege
                WHERE c.oid = qualified::regclass AND privilege.grantee = 0) THEN
      RAISE EXCEPTION 'I-07A: PUBLIC must hold no privilege on %', qualified;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, qualified, target_privilege) THEN
            RAISE EXCEPTION 'I-07A private Matching state must be unreachable: % holds % on %',
              target_role, target_privilege, qualified;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  -- Every immutable relation really carries its refusal, and every controlled
  -- relation really carries its truth guard.
  FOREACH target_table IN ARRAY immutable_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger t
                    WHERE t.tgrelid = ('public.' || target_table)::regclass AND NOT t.tgisinternal
                      AND t.tgfoid = 'public.reject_matching_setup_mutation_v1()'::regprocedure) THEN
      RAISE EXCEPTION 'I-07A: % must be append-only for every role including its owner', target_table;
    END IF;
  END LOOP;
  FOREACH target_table IN ARRAY guarded_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger t
                    WHERE t.tgrelid = ('public.' || target_table)::regclass AND NOT t.tgisinternal) THEN
      RAISE EXCEPTION 'I-07A: % must carry its truth guard', target_table;
    END IF;
  END LOOP;

  -- SEMANTICS ARE FIXED BY TABLE IDENTITY. No generic permission bag, no
  -- disclosure-shaped column, no ranking column, no untyped payload column, and
  -- no world scope anywhere: Matching Context Admission has no target World.
  SELECT string_agg(format('%s.%s', c.table_name, c.column_name), ', ' ORDER BY c.table_name, c.column_name)
    INTO offending
    FROM information_schema.columns c
   WHERE c.table_schema = 'public'
     -- `table_name` is a domain over `name`, so the comparison is cast rather
     -- than left to operator resolution against a text array.
     AND c.table_name::text = ANY(own_tables)
     -- The concatenation is PARENTHESIZED. `~*` and `||` share PostgreSQL's
     -- "any other operator" precedence class and associate left to right, so
     -- `col ~* 'A' || 'B'` parses as `(col ~* 'A') || 'B'` - a text value where
     -- a boolean belongs. The CHECK constraints above parenthesize it for the
     -- same reason.
     AND (c.column_name ~* ('(scope|permission|privilege|admin|actor|on_behalf|impersonat|service'
                         || '|world|shared|public_|replay|disclos|quote|copy|publish|export|provenance|transfer'
                         || '|score|rank|weight|priorit|percent|compat|candidate|proposal|recipient|pair'
                         || '|mutual|match_commit|introduction_slot|ttl|expir)')
          OR c.data_type IN ('json','jsonb','ARRAY'));
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'I-07A: Matching semantics are fixed by table identity; these columns may not exist: %', offending;
  END IF;

  -- The serialization row is exactly a lock anchor.
  IF (SELECT count(*) FROM information_schema.columns c
       WHERE c.table_schema = 'public' AND c.table_name = 'matching_setup_locks') <> 2 THEN
    RAISE EXCEPTION 'I-07A: the per-human serialization row carries a human and a birth instant, and nothing else';
  END IF;

  -- NO CANDIDATE, PROPOSAL, PAIR, MUTUAL MATCH, MATCH COMMIT OR INTRODUCTION
  -- LIFECYCLE RELATION was introduced. Those belong to I-07B, I-07C and I-07D.
  --
  -- The scan is deliberately bounded to the Matching / Introduction NAMESPACE
  -- rather than to the whole schema: `question_candidates`,
  -- `conversation_reference_resolution_candidates`,
  -- `shared_world_governance_proposals` and `hypothesis_subject_grounding_proposals`
  -- are reviewed predecessors that have nothing to do with Matching, and a
  -- schema-wide ceiling would refuse them and say something false about this slice.
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO offending
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m','p')
     AND c.relname ~* '^(matching_|introduction_|pre_match_)'
     AND c.relname ~* '(candidate|proposal|pair|mutual|commit|slot|snapshot|eligibility|compatib|leaderboard|rank|score)';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'I-07A: candidate, proposal, Mutual Match and Introduction lifecycle state belong to later slices; found %', offending;
  END IF;

  -- No command and no read boundary exists yet: 0108 is persistence, 0109 is the
  -- authority. Only the six trigger functions above may carry a Matching name.
  SELECT string_agg(pr.proname, ', ' ORDER BY pr.proname) INTO offending
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public'
     AND pr.proname ~* '(matching|introduction_profile|pre_match)'
     AND pr.prorettype <> 'trigger'::regtype::oid;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'I-07A: migration 0108 creates no Matching command or read boundary; that is 0109. Found %', offending;
  END IF;
END$$;

COMMIT;
