-- I-04G - Shared Conversation / Material Persistence v1 (PART A).
--
-- I-04A-I-04F built invitation, birth, membership, governance, settings,
-- selective historical access and Standard closure. What every one of those
-- authorities governs - the actual Shared material - did not exist. This
-- migration creates it, and migration 0090 creates the runtime that writes it.
--
-- ===========================================================================
-- What a Shared material IS here
-- ===========================================================================
--
-- One material is one envelope, bound one-to-one to exactly one I-04F history
-- item in exactly one Shared World, plus exactly one normalized body in the
-- relation its kind structurally requires. There is no universal JSON payload,
-- no generic content column, no owner or admin role column and no mutable
-- audience blob: the audience of a history item is the frozen I-04F baseline
-- viewer relation, and its material authority is the frozen I-04F required
-- approver relation. This slice adds neither a second history model nor a
-- second audience model.
--
-- ===========================================================================
-- The frozen material vocabulary (CW2-03 section 36)
-- ===========================================================================
--
--   HUMAN_TEXT                     producer HUMAN    text body
--   HUMAN_VOICE_NOTE               producer HUMAN    voice-note body
--   QANDEEL_OUTPUT                 producer QANDEEL  text body
--   QANDEEL_ANALYSIS               producer QANDEEL  text body
--   EXPLICIT_DISCLOSURE            RESERVED - no producer exists yet
--   WORLD_EVENT_DERIVED_MATERIAL   RESERVED - no producer exists yet
--
-- The envelope carries all six because the vocabulary is frozen and a later
-- reviewed producer must compose rather than re-found the model. The two
-- RESERVED kinds get NO producer path in I-04G: neither has an authority /
-- source contract in this repository yet, and inventing one would be exactly
-- the "engineering invents missing product logic" that AGENTS.md section 2
-- forbids. Their body form is RESERVED, which no body relation here accepts,
-- so a reserved-kind row can carry no body until a reviewed slice adds one.
--
-- Human-to-human live call stays unimplemented (CW2-03 section 42 / C37).
--
-- ===========================================================================
-- Three separations this schema keeps apart BY STRUCTURE
-- ===========================================================================
--
--   1. MATERIAL_DEPENDENCY != REASONING_DEPENDENCY != INDEPENDENT_TARGET_TRUTH
--      (I-00 section 12, CW2-01 section 23, CW2-02 sections 24 and 27). One
--      CHECK makes each kind's shape exact: a material dependency names a
--      committed Shared source material and no context; a reasoning dependency
--      names an opaque server-owned context reference and no material; an
--      independent target names neither. Reasoning influence is therefore
--      incapable of being stored as material provenance by accident.
--
--   2. content availability != provenance identity (CW2-01 section 25 / A18,
--      CW2-03 section 37). Availability lives on the I-04F history item and
--      nowhere else. A dependency row is identity only, so it survives the
--      destruction of the content it refers to and can never reconstruct it.
--
--   3. membership != historical access != material authority (CW2-01 A9 / A25).
--      Nothing here reads or writes a membership episode, a Standing Context
--      Grant or a consent event.
--
-- ===========================================================================
-- Why the body is a separate relation per kind
-- ===========================================================================
--
-- Because owner deletion has to be able to DESTROY the body while the envelope,
-- the history item and the provenance identity survive as non-content history
-- (CW2-03 section 37). A body that lived in a column of the envelope could only
-- be nulled; a body that lives in its own row can be physically removed, and
-- its absence is then the same fact for every future reader. Migration 0090
-- owns that deletion; this migration owns the shape that makes it possible.
--
-- The kind-to-body binding is STRUCTURAL, not procedural: `body_form` is
-- CHECK-derived from `material_kind`, the envelope carries UNIQUE (id,
-- body_form), and each body relation pins its own form and binds BOTH columns
-- by composite foreign key. A text body on a voice note is therefore not a bug
-- a reviewer must catch - it is a constraint violation.
--
-- ===========================================================================
-- Why MATERIAL_DEPENDENCY cycles are impossible rather than refused
-- ===========================================================================
--
-- A dependency row carries both endpoints' exact `established_at`, each bound
-- by composite foreign key to the material it names, and CHECKs that the
-- source's instant is strictly EARLIER than the target's. Every
-- MATERIAL_DEPENDENCY edge therefore strictly increases a total order, which
-- makes a cycle unrepresentable rather than merely rejected - and makes the
-- recursive invalidation traversal migration 0090 performs provably terminating
-- (task section 7, section 18). A source committed in the same microsecond as
-- its target fails closed, which is the correct direction for a rule about what
-- already existed.
--
-- ===========================================================================
-- One read boundary, and it is narrow
-- ===========================================================================
--
-- `resolve_shared_world_material_v1` is the only function here and the only
-- thing any application role may execute. It answers "what material may this
-- exact human actually render in this exact Shared World, right now" by
-- composing the ONE frozen I-04F visibility resolver with the material bodies
-- that still exist. It returns no hidden count or placeholder, no provenance
-- source identity, no private context reference, no material authority row and
-- no membership data. Every direct table stays sealed: RLS on, zero policies,
-- no privilege for PUBLIC, anon, authenticated or service_role.
--
-- ===========================================================================
-- What this slice deliberately does NOT do
-- ===========================================================================
--
-- It writes nothing: no commit primitive, no deletion primitive and no trigger
-- live here - they are migration 0090's. It creates and closes no World, opens
-- and closes no membership episode, touches no Standing Context Grant, audience
-- ceiling or consent history, reads no Personal context, alters no predecessor
-- table, adds no route, controller, RPC, mobile surface, Launch Gate, feature
-- flag, entitlement policy or safety / moderation policy, builds no media
-- storage provider or upload path, and mutates no Personal, Public, Replay,
-- Matching or Introduction state. Every historical migration, 0001-0088
-- included, is untouched.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE MATERIAL ENVELOPE.
--
--    Identity, World, the exact history item it IS, its kind, its producer, its
--    human author when it has one, and the instant it became Shared truth.
--
--    `history_item_id` is UNIQUE and composite-bound to (id, world_id) of the
--    I-04F projection, so "one material, one history item, same World" is
--    structural in both directions. `established_at` is the same instant as
--    that item's `occurred_at`; migration 0090 writes both from ONE database
--    clock read, and the I-04F COMMENT ON COLUMN deployed in 0087 is the rule
--    it is written under - NEVER a recalled or source-event time.
--
--    There is no owner, admin, moderator or role column: material authority is
--    the exact I-04F required-approver relation, never a superior principal
--    (CW2-02 section 25). `author_user_id` is authorship, which is a different
--    thing: it records WHO produced this material, and QANDEEL never has one,
--    because a system actor is never a human consent principal (CW2-01 A3).
--
--    The three UNIQUE bindings are not redundancy. (id, world_id) lets the
--    dependency relation bind both endpoints to the same exact World
--    structurally; (id, established_at) lets it prove source-before-target
--    structurally; (id, body_form) lets each body relation prove it belongs to
--    a material whose kind actually takes that body.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_materials (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    history_item_id uuid NOT NULL,
    material_kind text NOT NULL,
    producer_kind text NOT NULL,
    body_form text NOT NULL,
    author_user_id uuid,
    established_at timestamptz NOT NULL,
    CONSTRAINT shared_world_materials_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_materials_history_item_key UNIQUE (history_item_id),
    CONSTRAINT shared_world_materials_world_key UNIQUE (id, world_id),
    CONSTRAINT shared_world_materials_instant_key UNIQUE (id, established_at),
    CONSTRAINT shared_world_materials_body_form_key UNIQUE (id, body_form),
    -- The frozen CW2-03 section 36 vocabulary, complete, including the two
    -- kinds no producer exists for yet.
    CONSTRAINT shared_world_materials_kind_check
        CHECK (material_kind IN ('HUMAN_TEXT', 'HUMAN_VOICE_NOTE', 'QANDEEL_OUTPUT',
                                 'QANDEEL_ANALYSIS', 'EXPLICIT_DISCLOSURE', 'WORLD_EVENT_DERIVED_MATERIAL')),
    CONSTRAINT shared_world_materials_producer_check
        CHECK (producer_kind IN ('HUMAN', 'QANDEEL')),
    -- A human producer has an exact human author; QANDEEL never does.
    CONSTRAINT shared_world_materials_authorship_check
        CHECK ((producer_kind = 'HUMAN' AND author_user_id IS NOT NULL)
            OR (producer_kind = 'QANDEEL' AND author_user_id IS NULL)),
    -- The four implemented kinds pin their producer exactly. The two RESERVED
    -- kinds deliberately do not: which actor produces an explicit disclosure or
    -- a World-event-derived material is a decision for the reviewed slice that
    -- builds one, and pre-deciding it here would be inventing Product law.
    CONSTRAINT shared_world_materials_kind_producer_check
        CHECK ((material_kind IN ('HUMAN_TEXT', 'HUMAN_VOICE_NOTE') AND producer_kind = 'HUMAN')
            OR (material_kind IN ('QANDEEL_OUTPUT', 'QANDEEL_ANALYSIS') AND producer_kind = 'QANDEEL')
            OR material_kind IN ('EXPLICIT_DISCLOSURE', 'WORLD_EVENT_DERIVED_MATERIAL')),
    -- THE KIND-TO-BODY BINDING, made structural.
    CONSTRAINT shared_world_materials_body_form_check
        CHECK ((material_kind IN ('HUMAN_TEXT', 'QANDEEL_OUTPUT', 'QANDEEL_ANALYSIS') AND body_form = 'TEXT')
            OR (material_kind = 'HUMAN_VOICE_NOTE' AND body_form = 'VOICE_NOTE')
            OR (material_kind IN ('EXPLICIT_DISCLOSURE', 'WORLD_EVENT_DERIVED_MATERIAL') AND body_form = 'RESERVED')),
    CONSTRAINT shared_world_materials_world_fk
        FOREIGN KEY (world_id) REFERENCES public.shared_worlds (id) ON DELETE RESTRICT,
    -- The exact I-04F history item, in the exact same World, structurally.
    CONSTRAINT shared_world_materials_history_item_fk
        FOREIGN KEY (history_item_id, world_id)
        REFERENCES public.shared_world_history_items (id, world_id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_materials_author_fk
        FOREIGN KEY (author_user_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

-- The two frozen access patterns: a World's material in establishment order,
-- and one human's own authored material across Worlds, which is what the
-- account / privacy surface of CW2-03 section 24 needs. Nothing speculative.
CREATE INDEX shared_world_materials_world_time_idx
    ON public.shared_world_materials (world_id, established_at);
CREATE INDEX shared_world_materials_author_idx
    ON public.shared_world_materials (author_user_id) WHERE author_user_id IS NOT NULL;

COMMENT ON COLUMN public.shared_world_materials.established_at IS
  'The canonical Shared-World establishment/commit instant of this material, '
  'identical to its history item''s occurred_at and written from the SAME single '
  'database clock read. NOT a recalled event time, source-event semantic '
  'timestamp or provenance event time - a recalled instant belongs to provenance '
  'semantics and must never be written here.';

-- ---------------------------------------------------------------------------
-- 2. THE TEXT BODY.
--
--    The real UTF-8 body of HUMAN_TEXT, QANDEEL_OUTPUT and QANDEEL_ANALYSIS.
--    One body per material, enforced by the primary key; attachable only to a
--    material whose kind takes a TEXT body, enforced by the composite foreign
--    key into (id, body_form).
--
--    Non-empty is a truth about what a body IS, so it is a constraint. A
--    MAXIMUM length is not: no frozen contract states one, and inventing a
--    Product copy limit here out of convenience would be exactly the kind of
--    smuggled Product semantic AGENTS.md section 2 forbids.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_text_material_bodies (
    material_id uuid NOT NULL,
    body_form text NOT NULL,
    body_text text NOT NULL,
    CONSTRAINT shared_world_text_material_bodies_pk PRIMARY KEY (material_id),
    CONSTRAINT shared_world_text_material_bodies_form_check CHECK (body_form = 'TEXT'),
    CONSTRAINT shared_world_text_material_bodies_nonempty_check
        CHECK (length(btrim(body_text)) > 0),
    CONSTRAINT shared_world_text_material_bodies_material_fk
        FOREIGN KEY (material_id, body_form)
        REFERENCES public.shared_world_materials (id, body_form) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 3. THE VOICE-NOTE BODY.
--
--    `audio_object_ref` is an OPAQUE immutable server-side media object
--    reference. It is not a public URL and carries no credential or signature,
--    and both of those are CHECKed rather than asserted in prose: a value
--    containing a scheme separator, a query separator or a credential-shaped
--    token is refused. I-04G builds no storage provider and no upload path, and
--    raw audio bytes do not live in PostgreSQL - what lives here is the
--    reference a future reviewed media boundary resolves, and the reference is
--    what owner deletion destroys.
--
--    `transcript_text` is optional and is ALSO source content: owner deletion
--    removes it with the same row. `duration_ms` is optional bounded metadata
--    and is positive; no maximum is invented, because no frozen contract states
--    a Product duration limit. No media_type column exists: the repository has
--    no media-type convention to follow, and manufacturing one here would be
--    inventing Product law rather than implementing it.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_voice_note_material_bodies (
    material_id uuid NOT NULL,
    body_form text NOT NULL,
    audio_object_ref text NOT NULL,
    transcript_text text,
    duration_ms integer,
    CONSTRAINT shared_world_voice_note_material_bodies_pk PRIMARY KEY (material_id),
    CONSTRAINT shared_world_voice_note_material_bodies_form_check CHECK (body_form = 'VOICE_NOTE'),
    -- An opaque server-side object reference: non-blank, bounded, no whitespace,
    -- no URL scheme, no query string, no fragment and no credential-shaped token.
    CONSTRAINT shared_world_voice_note_material_bodies_opaque_ref_check
        CHECK (length(btrim(audio_object_ref)) > 0
           AND length(audio_object_ref) <= 512
           AND audio_object_ref !~ '\s'
           AND audio_object_ref !~ '://'
           AND audio_object_ref !~ '[?#]'
           AND audio_object_ref !~* '(token|signature|sig=|key=|secret|password|credential|bearer|x-amz|expires|assertion)'),
    CONSTRAINT shared_world_voice_note_material_bodies_transcript_check
        CHECK (transcript_text IS NULL OR length(btrim(transcript_text)) > 0),
    CONSTRAINT shared_world_voice_note_material_bodies_duration_check
        CHECK (duration_ms IS NULL OR duration_ms > 0),
    CONSTRAINT shared_world_voice_note_material_bodies_material_fk
        FOREIGN KEY (material_id, body_form)
        REFERENCES public.shared_world_materials (id, body_form) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- 4. PROVENANCE / DEPENDENCY TRUTH.
--
--    The three frozen kinds, kept apart by one exact-shape CHECK:
--
--      MATERIAL_DEPENDENCY        target reproduces / represents / CONTAINS the
--                                 source material. Source-material rights
--                                 propagate, and owner deletion of the source
--                                 invalidates the target (CW2-02 section 27).
--      REASONING_DEPENDENCY       authorized source context INFLUENCED QANDEEL
--                                 reasoning. The source material was not copied
--                                 or disclosed, and this is never material
--                                 consent (CW2-02 section 19, B14).
--      INDEPENDENT_TARGET_TRUTH   the target established its own truth. There
--                                 is no source at all.
--
--    A REASONING_DEPENDENCY names an OPAQUE server-owned context reference and
--    never raw private content. That is CHECKed: the reference is bounded and
--    whitespace-free, so private prose cannot be stored in it. This relation is
--    also the SEALED_PROVENANCE_DEPENDENCY of CW2-01 section 23 - truthful
--    internal dependency identity that the narrow material resolver below never
--    discloses to any audience.
--
--    Source and target are bound to the SAME exact World by sharing one
--    `world_id` column across two composite foreign keys. Cross-World material
--    dependency is deliberately NOT decided here: it would be a Material
--    Transfer with its own authority contract (CW2-01 section 19 / A13), and a
--    later reviewed slice may add its own relation for it.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_world_material_dependencies (
    id uuid NOT NULL,
    world_id uuid NOT NULL,
    dependency_kind text NOT NULL,
    target_material_id uuid NOT NULL,
    target_established_at timestamptz NOT NULL,
    source_material_id uuid,
    source_established_at timestamptz,
    source_context_ref text,
    CONSTRAINT shared_world_material_dependencies_pk PRIMARY KEY (id),
    CONSTRAINT shared_world_material_dependencies_kind_check
        CHECK (dependency_kind IN ('MATERIAL_DEPENDENCY', 'REASONING_DEPENDENCY', 'INDEPENDENT_TARGET_TRUTH')),
    -- EACH KIND'S EXACT SHAPE. A reasoning dependency can never acquire a
    -- material source, and a material dependency can never acquire a private
    -- context reference, however the row is produced.
    CONSTRAINT shared_world_material_dependencies_shape_check
        CHECK ((dependency_kind = 'MATERIAL_DEPENDENCY'
                AND source_material_id IS NOT NULL AND source_established_at IS NOT NULL
                AND source_context_ref IS NULL)
            OR (dependency_kind = 'REASONING_DEPENDENCY'
                AND source_material_id IS NULL AND source_established_at IS NULL
                AND source_context_ref IS NOT NULL)
            OR (dependency_kind = 'INDEPENDENT_TARGET_TRUTH'
                AND source_material_id IS NULL AND source_established_at IS NULL
                AND source_context_ref IS NULL)),
    CONSTRAINT shared_world_material_dependencies_no_self_check
        CHECK (source_material_id IS NULL OR source_material_id <> target_material_id),
    -- SOURCE STRICTLY PRECEDES TARGET, so a MATERIAL_DEPENDENCY cycle is
    -- unrepresentable rather than merely refused.
    CONSTRAINT shared_world_material_dependencies_source_precedes_check
        CHECK (source_established_at IS NULL OR source_established_at < target_established_at),
    -- An OPAQUE server-owned reference, never raw private source content.
    CONSTRAINT shared_world_material_dependencies_opaque_context_check
        CHECK (source_context_ref IS NULL
           OR (length(btrim(source_context_ref)) > 0
               AND length(source_context_ref) <= 200
               AND source_context_ref !~ '\s')),
    CONSTRAINT shared_world_material_dependencies_target_world_fk
        FOREIGN KEY (target_material_id, world_id)
        REFERENCES public.shared_world_materials (id, world_id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_material_dependencies_source_world_fk
        FOREIGN KEY (source_material_id, world_id)
        REFERENCES public.shared_world_materials (id, world_id) ON DELETE RESTRICT,
    CONSTRAINT shared_world_material_dependencies_target_instant_fk
        FOREIGN KEY (target_material_id, target_established_at)
        REFERENCES public.shared_world_materials (id, established_at) ON DELETE RESTRICT,
    CONSTRAINT shared_world_material_dependencies_source_instant_fk
        FOREIGN KEY (source_material_id, source_established_at)
        REFERENCES public.shared_world_materials (id, established_at) ON DELETE RESTRICT
);

-- One effective edge per (target, source) and per (target, context); and an
-- INDEPENDENT_TARGET_TRUTH target carries exactly one such row. Partial unique
-- indexes rather than a table constraint, because each kind's identity columns
-- differ and NULL is not a value a composite UNIQUE would fold.
CREATE UNIQUE INDEX shared_world_material_dependencies_one_material_edge_idx
    ON public.shared_world_material_dependencies (target_material_id, source_material_id)
    WHERE dependency_kind = 'MATERIAL_DEPENDENCY';
CREATE UNIQUE INDEX shared_world_material_dependencies_one_reasoning_edge_idx
    ON public.shared_world_material_dependencies (target_material_id, source_context_ref)
    WHERE dependency_kind = 'REASONING_DEPENDENCY';
CREATE UNIQUE INDEX shared_world_material_dependencies_one_independent_idx
    ON public.shared_world_material_dependencies (target_material_id)
    WHERE dependency_kind = 'INDEPENDENT_TARGET_TRUTH';

-- The traversal access pattern owner deletion needs: every target reachable
-- from one source material through MATERIAL_DEPENDENCY edges.
CREATE INDEX shared_world_material_dependencies_source_idx
    ON public.shared_world_material_dependencies (source_material_id)
    WHERE source_material_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. Deny-by-default posture for all four new relations: RLS on, zero policies,
--    every application role revoked from every privilege. There is no direct
--    client read path and no application read boundary except the one narrow
--    resolver at the end of this migration.
-- ---------------------------------------------------------------------------
ALTER TABLE public.shared_world_materials OWNER TO postgres;
ALTER TABLE public.shared_world_text_material_bodies OWNER TO postgres;
ALTER TABLE public.shared_world_voice_note_material_bodies OWNER TO postgres;
ALTER TABLE public.shared_world_material_dependencies OWNER TO postgres;
ALTER TABLE public.shared_world_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_text_material_bodies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_voice_note_material_bodies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_world_material_dependencies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shared_world_materials,
                    public.shared_world_text_material_bodies,
                    public.shared_world_voice_note_material_bodies,
                    public.shared_world_material_dependencies
  FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE public.shared_world_materials, public.shared_world_text_material_bodies, public.shared_world_voice_note_material_bodies, public.shared_world_material_dependencies FROM service_role';
END IF;END$$;

-- ---------------------------------------------------------------------------
-- 6. THE ONE MATERIAL READ BOUNDARY.
--
--    Migration 0087's resolve_shared_world_history_visibility_v1 remains the
--    single authority for WHICH history item identities this exact human may
--    see. This resolver does not re-decide that and does not re-implement it:
--    it CONSUMES it, and intersects the answer with the material bodies that
--    still exist.
--
--    What it returns is renderable material and nothing else. There is
--    deliberately no row at all for an item whose body is gone and no row for
--    an item the human may not see - no hidden count, no placeholder, no
--    tombstone - so hidden or deleted material discloses nothing about its own
--    existence (CW2-03 sections 20 and 37, C16). It returns no provenance
--    source identity, no private context reference, no material authority row,
--    no dependency and no membership data: sealing provenance is audience-scoped
--    non-disclosure of truthful internal dependency truth (CW2-01 section 23 /
--    A16), and this is the audience-facing side of that seal.
--
--    Availability dominates, twice over: the frozen resolver already refuses
--    anything that is not AVAILABLE, and a body that owner deletion destroyed
--    is simply not there to join. Neither a history grant nor a closed-World
--    entitlement can reconstruct deleted source.
--
--    STABLE, SECURITY DEFINER, empty search_path, postgres-owned, and
--    executable by service_role alone - the frozen narrow-resolver precedent of
--    0077 / 0079 / 0080 / 0087. It opens no direct table privilege of any kind.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_shared_world_material_v1(p_world_id uuid, p_user_id uuid)
RETURNS TABLE(world_id uuid, material_id uuid, history_item_id uuid, material_kind text,
              established_at timestamptz, author_user_id uuid, text_body text,
              audio_object_ref text, transcript_text text)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
BEGIN
  IF p_world_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;
  -- The frozen I-04F entry point decides visibility, including canonical World
  -- existence, World mode and the ACTIVE / closed branch. Its bounded errors are
  -- its own and propagate unchanged, so this resolver adds no second answer to
  -- a question I-04F already owns.
  RETURN QUERY
    SELECT m.world_id, m.id, m.history_item_id, m.material_kind, m.established_at, m.author_user_id,
           t.body_text, v.audio_object_ref, v.transcript_text
      FROM public.resolve_shared_world_history_visibility_v1(p_world_id, p_user_id) visible
      JOIN public.shared_world_materials m ON m.history_item_id = visible.history_item_id
      LEFT JOIN public.shared_world_text_material_bodies t ON t.material_id = m.id
      LEFT JOIN public.shared_world_voice_note_material_bodies v ON v.material_id = m.id
     WHERE m.world_id = p_world_id
       -- A material whose body no longer exists is not returned at all.
       AND (t.material_id IS NOT NULL OR v.material_id IS NOT NULL)
     ORDER BY m.established_at, m.id;
END$$;

-- ---------------------------------------------------------------------------
-- 7. Ownership and THE PRE-LAUNCH ACL. The ONLY grant in this migration is
--    service_role EXECUTE on the read-only resolver. No table privilege of any
--    kind is opened, and there is no consequential primitive here to seal.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.resolve_shared_world_material_v1(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resolve_shared_world_material_v1(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_shared_world_material_v1(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 8. Terminal self-assertions. The migration refuses to deploy a material
--    substrate that is application-reachable, policy-bearing, content-blobbed,
--    role-bearing, provenance-disclosing, second-history-modelling or
--    cycle-permitting, so drift cannot pass silently.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  resolve_fn text := 'public.resolve_shared_world_material_v1(uuid,uuid)';
  entry_point_fn text := 'public.resolve_shared_world_history_visibility_v1(uuid,uuid)';
  own_tables text[] := ARRAY['public.shared_world_materials',
                             'public.shared_world_text_material_bodies',
                             'public.shared_world_voice_note_material_bodies',
                             'public.shared_world_material_dependencies'];
  p record;
  in_names text[];
  in_types text[];
  out_names text[];
  arg_name text;
  target_role text;
  target_table text;
  target_privilege text;
  rls_enabled boolean;
BEGIN
  FOREACH target_table IN ARRAY own_tables LOOP
    SELECT c.relrowsecurity INTO rls_enabled FROM pg_class c WHERE c.oid = target_table::regclass;
    IF NOT rls_enabled THEN
      RAISE EXCEPTION 'I-04G: row level security must be enabled on %', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = target_table::regclass) THEN
      RAISE EXCEPTION 'I-04G: no RLS policy may exist yet on %', target_table;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) AS privilege
       WHERE c.oid = target_table::regclass AND privilege.grantee = 0
    ) THEN
      RAISE EXCEPTION 'I-04G: PUBLIC must hold no privilege on %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role) THEN
        FOREACH target_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
          IF has_table_privilege(target_role, target_table, target_privilege) THEN
            RAISE EXCEPTION 'I-04G: the material store must stay sealed: % holds % on %',
              target_role, target_privilege, target_table;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  -- NO SUPERIOR PARTICIPANT AUTHORITY, AND NO GENERIC CONTENT BLOB, anywhere in
  -- the four relations this migration owns. `author_user_id` is authorship, not
  -- ownership authority, and is named so it cannot be confused with one.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name IN ('shared_world_materials','shared_world_text_material_bodies',
                            'shared_world_voice_note_material_bodies','shared_world_material_dependencies')
       AND c.column_name ~* '(owner|admin|moderator|inviter|creator|initiator|privilege|capability|permission|entitlement|safety|launch)'
  ) THEN
    RAISE EXCEPTION 'I-04G: material authority is the exact required-approver relation, never a role column';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name IN ('shared_world_materials','shared_world_text_material_bodies',
                            'shared_world_voice_note_material_bodies','shared_world_material_dependencies')
       AND c.data_type IN ('json','jsonb','ARRAY','bytea')
  ) THEN
    RAISE EXCEPTION 'I-04G: material bodies are normalized relations, never a universal JSON or binary payload';
  END IF;

  -- ONE HISTORY MODEL AND ONE AUDIENCE MODEL. The envelope carries no
  -- availability, revision, audience or approver column of its own: those are
  -- the frozen I-04F relations, and a second copy here would be a second truth.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
     WHERE c.table_schema = 'public' AND c.table_name = 'shared_world_materials'
       AND c.column_name ~* '(availability|revision|audience|viewer|approver|occurred_at|registered_at)'
  ) THEN
    RAISE EXCEPTION 'I-04G: availability, audience and material authority stay on the frozen I-04F projection';
  END IF;

  -- THE MATERIAL RESOLVER: read-only, pinned, bounded and composed from the ONE
  -- frozen I-04F entry point rather than re-deciding visibility.
  SELECT pr.prosecdef, pr.provolatile, pr.proconfig, pr.prosrc, pr.proargnames, pr.proargmodes,
         pr.proargtypes, pg_get_userbyid(pr.proowner) AS owner
    INTO p FROM pg_proc pr WHERE pr.oid = resolve_fn::regprocedure;
  IF p.owner <> 'postgres' THEN RAISE EXCEPTION 'I-04G: % must be owned by postgres', resolve_fn; END IF;
  IF NOT p.prosecdef THEN RAISE EXCEPTION 'I-04G: % must be SECURITY DEFINER', resolve_fn; END IF;
  IF p.provolatile <> 's' THEN RAISE EXCEPTION 'I-04G: % is a read boundary and must be STABLE', resolve_fn; END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
    RAISE EXCEPTION 'I-04G: % must pin an empty search_path', resolve_fn;
  END IF;
  IF p.prosrc ~* 'INSERT INTO|UPDATE public\.|DELETE FROM|FOR UPDATE|auth\.uid|request\.jwt' THEN
    RAISE EXCEPTION 'I-04G: % mutates nothing, locks nothing and trusts no client claim', resolve_fn;
  END IF;
  IF p.prosrc !~ 'public\.resolve_shared_world_history_visibility_v1\(p_world_id, p_user_id\)' THEN
    RAISE EXCEPTION 'I-04G: % must consume the ONE frozen I-04F visibility entry point, never re-implement it', resolve_fn;
  END IF;
  -- Argument NAMES from proargnames / proargmodes and TYPES from proargtypes. A
  -- rendered signature is not the authority here: pg_get_function_arguments folds
  -- this function's RETURNS TABLE columns into the same string, so a
  -- parameter-name ban run against it would fire on its own result shape.
  SELECT array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text = 'i'),
         array_agg(a.n ORDER BY a.ord) FILTER (WHERE a.m::text IN ('t', 'o'))
    INTO in_names, out_names
    FROM unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(n, m, ord);
  IF in_names <> ARRAY['p_world_id', 'p_user_id'] THEN
    RAISE EXCEPTION 'I-04G: % must accept exactly the exact World and the exact human, not %', resolve_fn, in_names;
  END IF;
  SELECT array_agg(t.typname::text ORDER BY a.ord) INTO in_types
    FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY AS a(argtype, ord)
    JOIN pg_type t ON t.oid = a.argtype;
  IF in_types <> ARRAY['uuid', 'uuid'] THEN
    RAISE EXCEPTION 'I-04G: % must accept only opaque uuid identities, not %', resolve_fn, in_types;
  END IF;
  -- The ban is non-vacuous by construction: the exact list above proves these
  -- really are the parameter names being scanned.
  FOREACH arg_name IN ARRAY in_names LOOP
    IF arg_name ~* 'grant|entitlement|episode|audience|viewer|approver|provenance|dependency|kind|include|scope|limit|count|launch|gate|safety' THEN
      RAISE EXCEPTION 'I-04G: % must not accept a grant, audience, provenance, scope or gate parameter', resolve_fn;
    END IF;
  END LOOP;
  -- ORDINARY MATERIAL READS DISCLOSE NO SEALED PROVENANCE, no authority row and
  -- no membership data. The bounded result shape is the proof.
  IF out_names <> ARRAY['world_id', 'material_id', 'history_item_id', 'material_kind',
                        'established_at', 'author_user_id', 'text_body',
                        'audio_object_ref', 'transcript_text'] THEN
    RAISE EXCEPTION 'I-04G: % must return exactly the bounded renderable material, not %', resolve_fn, out_names;
  END IF;
  IF p.prosrc ~ 'shared_world_material_dependencies|source_context_ref|source_material_id|shared_world_history_item_required_approvers|shared_world_membership_episodes' THEN
    RAISE EXCEPTION 'I-04G: % must disclose no provenance source, no material authority and no membership', resolve_fn;
  END IF;
  -- NO PLACEHOLDER FOR HIDDEN OR DELETED MATERIAL.
  IF p.prosrc ~* 'count\(|hidden|placeholder|tombstone|redacted|UNION' THEN
    RAISE EXCEPTION 'I-04G: hidden and deleted material must produce no row, no count and no placeholder';
  END IF;

  -- THE PRE-LAUNCH SECURITY BOUNDARY, asserted rather than commented.
  IF has_function_privilege('public', resolve_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-04G: PUBLIC must not execute the material resolver';
  END IF;
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
       AND has_function_privilege(target_role, resolve_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'I-04G: % must not execute the material resolver', target_role;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role')
     AND NOT has_function_privilege('service_role', resolve_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-04G: service_role must execute the ONE narrow material resolver';
  END IF;
  -- And the frozen I-04F entry point it composes stays reachable, so this slice
  -- narrowed the boundary rather than closing it.
  IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'service_role')
     AND NOT has_function_privilege('service_role', entry_point_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'I-04G: service_role must still execute the ONE historical visibility entry point';
  END IF;

  -- NO WRITER AND NO TRIGGER IN PART A. Every consequential primitive belongs to
  -- migration 0090, so this migration cannot have created one.
  IF EXISTS (
    SELECT 1 FROM pg_trigger tg
     WHERE NOT tg.tgisinternal
       AND tg.tgrelid IN ('public.shared_world_materials'::regclass,
                          'public.shared_world_text_material_bodies'::regclass,
                          'public.shared_world_voice_note_material_bodies'::regclass,
                          'public.shared_world_material_dependencies'::regclass)
  ) THEN
    RAISE EXCEPTION 'I-04G: PART A installs no trigger: the commit and deletion runtime is migration 0090';
  END IF;

  -- CYCLES ARE UNREPRESENTABLE, not merely refused: source precedes target, and
  -- no material depends on itself.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.shared_world_material_dependencies'::regclass
       AND c.conname = 'shared_world_material_dependencies_source_precedes_check'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.shared_world_material_dependencies'::regclass
       AND c.conname = 'shared_world_material_dependencies_no_self_check'
  ) THEN
    RAISE EXCEPTION 'I-04G: a MATERIAL_DEPENDENCY cycle must be unrepresentable, not merely refused';
  END IF;
END$$;

COMMIT;
