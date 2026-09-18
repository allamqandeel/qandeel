-- QAN-CW-REM-03 - Introduction disclosure deletion-time privacy erasure v1.
--
-- ## ASSURE-F06 - the deleted payload left a verifier of itself behind
--
-- Migration 0115 destroys the payload of an owner-deleted `EXPLICIT_DISCLOSURE`
-- and keeps its audit identity, which is the right shape. What it also kept was
-- `introduction_disclosure_commands.payload_digest`: an UNSALTED SHA-256 of the
-- exact disclosed bytes, and `request_ref`, a SHA-256 over the whole request
-- with that same digest inside it.
--
-- Every other input of `request_ref` survives deletion in plain form on the
-- command row itself - World, resource version, material, history item, grant
-- event, owner, resource type, payload form - and `field_key` is the one
-- remaining unknown, drawn from a bounded 48-character lowercase shape. So both
-- retained values are practical verifiers of the same secret.
--
-- That matters because the disclosure vocabulary is deliberately low-entropy:
--
--     FULL_NAME               a person's name
--     CONTACT_METHOD          a phone number, a handle, an address
--     DEEPER_PERSONAL_FIELD   one bounded single-line value under a known key
--
-- An attacker holding the surviving digest can test guesses offline until one
-- matches, and be certain. The owner exercised deletion and the database kept
-- something that still answers "was it this?" - which is the frozen deletion
-- rule inverted:
--
--     audit identity may survive
--     source content must not remain reconstructable or CONFIRMABLE from
--     durable retained content-derived evidence
--
-- ## Why not a salt
--
-- A stored salt beside a low-entropy digest solves nothing. An attacker who
-- reaches the row reaches both, and `sha256(salt || payload)` is exactly as
-- testable as `sha256(payload)` once the salt is in hand. A SECRET-keyed
-- verifier would move the secret out of the row, and with it a key lifecycle -
-- generation, storage, rotation, revocation, recovery - that this repository
-- does not own and this task is not authorized to invent.
--
-- The accepted answer is the direct one: DESTROY the verifier when the payload
-- is destroyed. A digest of bytes that no longer exist is not audit; it is the
-- last copy of the thing the owner deleted.
--
-- ## What survives, exactly
--
-- Everything that says WHO disclosed WHAT TYPE to WHOM and WHEN:
--
--     command id, World, Introduction Record, resource version, material,
--     history item, grant event, owner, counterpart, resource type, baseline
--     viewer count, committed instant
--
-- and the whole envelope around it - the history item, its baseline audience,
-- its required approver, the material, its dependency, its historical
-- authority, the resource version and the grant fact. Migration 0115 already
-- keeps all of those and this migration removes none of them.
--
-- What is destroyed is the content-bearing and content-VERIFYING surface: the
-- typed payload (0115 already), the payload digest, and the payload-derived
-- whole-request reference.
--
-- ## The sweep
--
-- Those two columns are the whole class. Every other durable field in the
-- Introduction disclosure chain carries identity, type or time and nothing
-- derived from the bytes: the resource version, the grant event, the material
-- envelope (`body_form = 'RESERVED'`, no digest column at all), the dependency,
-- the historical authority, the history item and its viewers and approvers.
-- `field_key` lives ON the text payload and goes with it. No Public package and
-- no Replay source manifest can hold one either: both selection boundaries
-- refuse every material kind outside HUMAN_TEXT, HUMAN_VOICE_NOTE,
-- QANDEEL_OUTPUT and QANDEEL_ANALYSIS, so an EXPLICIT_DISCLOSURE can never
-- reach `publication_package_item_provenance.captured_source_digest`,
-- `publication_package_manifest_items.public_body_digest` or a Replay captured
-- digest. Section 5 asserts that rather than asserting the comment.
--
-- ## One direction, and one way in
--
-- `introduction_disclosure_commands` was append-only for every role including
-- the owner, and that is too broad for privacy erasure: it makes the verifier
-- immortal. The invariant is NARROWED in exactly one direction and nowhere
-- else. The trigger is not removed - it is replaced by a guard that permits
-- exactly one transition:
--
--     verifier_state  PRESENT -> ERASED_BY_OWNER
--     payload_digest  sha256:... -> NULL
--     request_ref     sha256:... -> NULL
--     verifier_erased_at  NULL -> the deletion instant
--
-- and only when canonical truth ALREADY proves the owner destroyed the payload:
-- the material is an `EXPLICIT_DISCLOSURE`, its history item is terminal
-- `DELETED_BY_OWNER`, and neither payload relation holds a row. Every other
-- UPDATE is refused. Every DELETE is refused. Every audit identity column is
-- pinned. There is no transition back to PRESENT, no replacement digest, and no
-- tombstone derived from the payload - the erased columns are NULL and a CHECK
-- makes any other value unrepresentable in that state.
--
-- That guard is also why the erasure sits where it does inside owner deletion.
-- The canonical order is unchanged except that the verifier erasure is appended
-- to the transaction AFTER the terminal `DELETED_BY_OWNER` transition rather
-- than before it, because the guard's strongest precondition IS that terminal
-- transition: a guard that only checked "the payload row is gone" would happily
-- redact a contradictory row whose payload is missing for some other reason,
-- which is precisely what section 17 of the task ruling forbids. Everything
-- still commits or rolls back together, so no ordering inside the transaction
-- can leave a destroyed payload beside a surviving verifier, or a surviving
-- payload beside an erased verifier.
--
-- ## Retry after erasure
--
-- Before deletion the disclosure command behaves exactly as it always did: the
-- same command with the same payload is the historical success, and the same
-- command with a different payload is the command conflict.
--
-- After erasure, exact payload equivalence can no longer be PROVEN, because the
-- proof was the thing deliberately destroyed. So any retry of that historical
-- command fails closed with one bounded class. It does not ignore the payload,
-- does not compare against a deleted one, does not recreate the payload, does
-- not recreate the verifier and infers nothing from the resource type. Deletion
-- knowingly trades content-level retry equivalence for privacy; the audit
-- identity is what remains, and the deletion command's own idempotency - a
-- different command family with its own history - is untouched.
--
-- REM03-ERASE-ID-01: the refusal is reachable only when every SURVIVING
-- immutable request identity field still matches - the owner, the World, the
-- resource version, the material, the history item, the grant event AND the
-- resource type. `resource_type` is an immutable command input, it is not
-- content-derived, and it is explicitly retained as audit identity, so a retry
-- that changes it is a DIFFERENT immutable request and the database still has
-- the evidence to say so. It stays the command conflict. Only content identity
-- is intentionally unknowable after deletion - the field key, the text value,
-- the media reference, the payload digest and the whole-request reference - and
-- those are precisely what erasure destroyed, so those alone are not compared.
-- Anyone else, and anyone guessing a command id, still receives the same
-- command conflict they received before, so the new class is not an oracle for
-- whether a disclosure was deleted.
--
-- ## Anti-scope
--
-- No Public derivative is recalled and no Public source-deletion policy is
-- added: ASSURE-F05 is not implemented here in any form. No new erasure RPC
-- exists - the one-way transition is reachable through canonical owner deletion
-- and through this migration's own reconciliation of rows already in the unsafe
-- state, and through nothing else. No application role gains any privilege.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. THE EXPLICIT VERIFIER STATE.
--
--    Two typed columns and a structural biconditional. `verifier_state` is the
--    state; the CHECK below makes the state and the columns one fact rather
--    than two that could disagree, in BOTH directions:
--
--      PRESENT           iff both payload-derived verifiers are present and no
--                        erasure instant exists
--      ERASED_BY_OWNER   iff both are absent and an erasure instant exists
--
--    The frozen 0115 shape CHECKs on `payload_digest` and `request_ref` are
--    untouched and still apply to every non-NULL value, so an erased column can
--    never come back carrying anything at all.
-- ---------------------------------------------------------------------------
ALTER TABLE public.introduction_disclosure_commands
    ADD COLUMN verifier_state text NOT NULL DEFAULT 'PRESENT',
    ADD COLUMN verifier_erased_at timestamptz;

ALTER TABLE public.introduction_disclosure_commands
    ALTER COLUMN payload_digest DROP NOT NULL,
    ALTER COLUMN request_ref DROP NOT NULL;

ALTER TABLE public.introduction_disclosure_commands
    ADD CONSTRAINT introduction_disclosure_commands_verifier_state_check
        CHECK (verifier_state IN ('PRESENT', 'ERASED_BY_OWNER')),
    ADD CONSTRAINT introduction_disclosure_commands_verifier_shape_check
        CHECK ((verifier_state = 'PRESENT'
                    AND payload_digest IS NOT NULL AND request_ref IS NOT NULL
                    AND verifier_erased_at IS NULL)
            OR (verifier_state = 'ERASED_BY_OWNER'
                    AND payload_digest IS NULL AND request_ref IS NULL
                    AND verifier_erased_at IS NOT NULL));

COMMENT ON COLUMN public.introduction_disclosure_commands.verifier_state IS
  'PRESENT while the disclosed payload exists; ERASED_BY_OWNER once its owner '
  'destroyed the payload through the canonical Shared owner-deletion capability '
  'and the payload-derived verifiers were destroyed with it. One direction only.';
COMMENT ON COLUMN public.introduction_disclosure_commands.verifier_erased_at IS
  'The exact instant the payload-derived verifiers were destroyed - the same '
  'database-owned instant as the owner deletion itself. It is a time, not a '
  'verifier: nothing about it is derived from the deleted content.';
COMMENT ON COLUMN public.introduction_disclosure_commands.payload_digest IS
  'The exact disclosed bytes, while they exist. It is DESTROYED by owner '
  'deletion (ASSURE-F06): a digest of low-entropy content is a practical '
  'offline verifier of that content, so it may not outlive the content.';
COMMENT ON COLUMN public.introduction_disclosure_commands.request_ref IS
  'The whole immutable request, while the payload exists. It incorporates the '
  'payload digest and every other input survives deletion in plain form, so it '
  'is a second verifier of the same secret and is destroyed with the first.';

-- ---------------------------------------------------------------------------
-- 2. THE ONE-WAY GUARD, REPLACING THE BLANKET REFUSAL ON THIS ONE RELATION.
--
--    The TRIGGER KEEPS ITS NAME. It is the same guard position on the same
--    relation with a narrower rule, and the two sibling relations - the resource
--    version and the grant fact - keep the blanket
--    `reject_introduction_disclosure_mutation_v1` they always had.
--
--    Everything is refused except ONE transition, and that transition must be
--    accompanied by canonical proof that the owner already destroyed the
--    payload. The proof is read here rather than trusted from the caller, so
--    the erasure cannot be performed by anything - including a future
--    primitive, a migration or the table owner at a psql prompt - against a
--    disclosure whose payload still exists or whose history is not terminal.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.introduction_disclosure_verifier_erasure_guard_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_IS_DURABLE'
      USING ERRCODE='55000',
            DETAIL='A delivered Introduction disclosure command is immutable history: DELETE is refused for every role, including the table owner.';
  END IF;

  -- EXACTLY ONE TRANSITION, IN EXACTLY ONE DIRECTION.
  IF OLD.verifier_state <> 'PRESENT' OR NEW.verifier_state <> 'ERASED_BY_OWNER' THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_IS_DURABLE'
      USING ERRCODE='55000',
            DETAIL='The only permitted change to an Introduction disclosure command is the one-way privacy erasure PRESENT -> ERASED_BY_OWNER. Every other UPDATE is refused for every role, including the table owner.';
  END IF;

  -- AUDIT IDENTITY IS PINNED. Who disclosed what type to whom, when, under
  -- which grant, in which World, against which resource: none of it moves.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.world_id IS DISTINCT FROM OLD.world_id
     OR NEW.introduction_record_id IS DISTINCT FROM OLD.introduction_record_id
     OR NEW.resource_version_id IS DISTINCT FROM OLD.resource_version_id
     OR NEW.material_id IS DISTINCT FROM OLD.material_id
     OR NEW.history_item_id IS DISTINCT FROM OLD.history_item_id
     OR NEW.disclosure_granted_event_id IS DISTINCT FROM OLD.disclosure_granted_event_id
     OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
     OR NEW.counterpart_user_id IS DISTINCT FROM OLD.counterpart_user_id
     OR NEW.resource_type IS DISTINCT FROM OLD.resource_type
     OR NEW.baseline_viewer_count IS DISTINCT FROM OLD.baseline_viewer_count
     OR NEW.committed_at IS DISTINCT FROM OLD.committed_at THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_IS_DURABLE'
      USING ERRCODE='55000',
            DETAIL='Privacy erasure destroys the payload-derived verifiers of an Introduction disclosure and changes nothing else. Its audit identity is immutable.';
  END IF;

  -- THE VERIFIERS GO, AND NOTHING TAKES THEIR PLACE. No replacement digest, and
  -- no tombstone derived from the payload: the columns are NULL or the
  -- transition is refused.
  IF NEW.payload_digest IS NOT NULL OR NEW.request_ref IS NOT NULL
     OR NEW.verifier_erased_at IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_IS_DURABLE'
      USING ERRCODE='55000',
            DETAIL='Privacy erasure removes the payload-derived verifiers outright. A replacement digest, a fingerprint or any tombstone derived from the deleted payload is refused.';
  END IF;

  -- CANONICAL TRUTH, READ HERE. The payload is really gone, the material really
  -- is a disclosure, and its owner really did delete it.
  IF NOT EXISTS (SELECT 1 FROM public.shared_world_materials m
                  WHERE m.id = OLD.material_id AND m.material_kind = 'EXPLICIT_DISCLOSURE')
     OR NOT EXISTS (SELECT 1 FROM public.shared_world_history_items i
                     WHERE i.id = OLD.history_item_id AND i.availability_state = 'DELETED_BY_OWNER')
     OR EXISTS (SELECT 1 FROM public.introduction_disclosure_text_payloads tp
                 WHERE tp.resource_version_id = OLD.resource_version_id)
     OR EXISTS (SELECT 1 FROM public.introduction_disclosure_media_payloads mp
                 WHERE mp.resource_version_id = OLD.resource_version_id) THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_CONTRADICTORY_STATE'
      USING ERRCODE='P0001',
            DETAIL='A disclosure verifier may be erased only when canonical truth already proves its owner destroyed the payload: an EXPLICIT_DISCLOSURE material, a DELETED_BY_OWNER history item, and no payload row of either form.';
  END IF;

  RETURN NEW;
END$$;

ALTER FUNCTION public.introduction_disclosure_verifier_erasure_guard_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.introduction_disclosure_verifier_erasure_guard_v1() FROM PUBLIC, anon, authenticated;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.introduction_disclosure_verifier_erasure_guard_v1() FROM service_role';
END IF; END$$;

DROP TRIGGER introduction_disclosure_commands_immutable ON public.introduction_disclosure_commands;
CREATE TRIGGER introduction_disclosure_commands_immutable
    BEFORE UPDATE OR DELETE ON public.introduction_disclosure_commands
    FOR EACH ROW EXECUTE FUNCTION public.introduction_disclosure_verifier_erasure_guard_v1();

-- ---------------------------------------------------------------------------
-- 3. RECONCILING DISCLOSURES ALREADY DELETED UNDER THE OLD RULE.
--
--    A disclosure whose owner deleted it before this migration is exactly the
--    state ASSURE-F06 describes: the payload is gone and the verifier is not.
--    Leaving those behind would fix the defect only for the future.
--
--    A row qualifies only when canonical truth proves ALL of it - the material
--    is an EXPLICIT_DISCLOSURE, its history item is terminal DELETED_BY_OWNER,
--    its resource version still exists and is the one this command names, and
--    neither payload relation holds a row. The guard above re-checks every one
--    of those independently, so this statement cannot widen itself.
--
--    THE CONTRADICTORY CASE IS NOT SILENTLY NORMALIZED. A disclosure whose
--    payload is absent while its history is NOT DELETED_BY_OWNER did not reach
--    that state through owner deletion, and treating it as though it had would
--    invent a deletion that never happened. Deployment fails instead.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  contradictory integer;
  reconciled integer;
  erasure_instant timestamptz := clock_timestamp();
BEGIN
  SELECT count(*)::integer INTO contradictory
    FROM public.introduction_disclosure_commands c
    JOIN public.introduction_disclosure_resource_versions rv ON rv.id = c.resource_version_id
    JOIN public.shared_world_history_items i ON i.id = c.history_item_id
   WHERE i.availability_state <> 'DELETED_BY_OWNER'
     AND NOT EXISTS (SELECT 1 FROM public.introduction_disclosure_text_payloads tp
                      WHERE tp.resource_version_id = c.resource_version_id)
     AND NOT EXISTS (SELECT 1 FROM public.introduction_disclosure_media_payloads mp
                      WHERE mp.resource_version_id = c.resource_version_id);
  IF contradictory <> 0 THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: % delivered Introduction disclosure(s) have no payload while their history is not DELETED_BY_OWNER. That is contradictory state, not an owner deletion, and it is not auto-redacted.', contradictory
      USING ERRCODE='P0001';
  END IF;

  UPDATE public.introduction_disclosure_commands c
     SET verifier_state = 'ERASED_BY_OWNER', payload_digest = NULL, request_ref = NULL,
         verifier_erased_at = erasure_instant
   WHERE c.verifier_state = 'PRESENT'
     AND EXISTS (SELECT 1 FROM public.shared_world_materials m
                  WHERE m.id = c.material_id AND m.material_kind = 'EXPLICIT_DISCLOSURE')
     AND EXISTS (SELECT 1 FROM public.shared_world_history_items i
                  WHERE i.id = c.history_item_id AND i.availability_state = 'DELETED_BY_OWNER')
     AND EXISTS (SELECT 1 FROM public.introduction_disclosure_resource_versions rv
                  WHERE rv.id = c.resource_version_id AND rv.material_id = c.material_id)
     AND NOT EXISTS (SELECT 1 FROM public.introduction_disclosure_text_payloads tp
                      WHERE tp.resource_version_id = c.resource_version_id)
     AND NOT EXISTS (SELECT 1 FROM public.introduction_disclosure_media_payloads mp
                      WHERE mp.resource_version_id = c.resource_version_id);
  GET DIAGNOSTICS reconciled = ROW_COUNT;
  RAISE NOTICE 'QAN-CW-REM-03: % already-deleted Introduction disclosure verifier(s) erased.', reconciled;

  -- AND NOTHING WITH A DESTROYED PAYLOAD STILL CARRIES A VERIFIER.
  IF EXISTS (
    SELECT 1 FROM public.introduction_disclosure_commands c
     WHERE (c.payload_digest IS NOT NULL OR c.request_ref IS NOT NULL)
       AND NOT EXISTS (SELECT 1 FROM public.introduction_disclosure_text_payloads tp
                        WHERE tp.resource_version_id = c.resource_version_id)
       AND NOT EXISTS (SELECT 1 FROM public.introduction_disclosure_media_payloads mp
                        WHERE mp.resource_version_id = c.resource_version_id)) THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: a disclosure whose payload no longer exists still carries a payload-derived verifier'
      USING ERRCODE='P0001';
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 4. OWNER DELETION DESTROYS THE VERIFIER WITH THE PAYLOAD.
--
--    Migration 0115's owner-deletion primitive, forward-replaced, with exactly
--    two changes:
--
--      * the EXPLICIT_DISCLOSURE branch now erases the payload-derived command
--        verifiers, immediately after the terminal DELETED_BY_OWNER transition
--        the guard requires as its proof, in the same transaction and at the
--        same database-owned instant;
--      * the committed answer additionally proves that no verifier survives, so
--        a deletion can never report success while one does.
--
--    Everything else is preserved exactly: the actor is still auth.uid() with
--    no owner or actor parameter, the World row is still locked first, phase is
--    still not a gate, READ_ONLY_CLOSED still permits it, the transitive
--    MATERIAL_DEPENDENCY invalidation is unchanged, the terminal transition is
--    unchanged, and no envelope, history item, baseline viewer, required
--    approver, dependency, grant, entitlement, membership episode, resource
--    version, event or command row is ever removed.
--
--    A disclosure whose command row is missing, already erased, or somehow
--    doubled fails closed and rolls the whole deletion back: reporting a
--    successful deletion beside a surviving verifier is the one outcome this
--    change exists to prevent.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_shared_world_owned_material_v1(
  p_command_id uuid, p_world_id uuid, p_material_id uuid, p_material_deleted_event_id uuid
) RETURNS TABLE(outcome text, command_id uuid, deleted_world_id uuid, deleted_material_id uuid,
                deleted_history_item_id uuid, deleted_event_id uuid,
                invalidated_targets integer, deleted_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.shared_world_material_delete_commands;
  world public.shared_worlds;
  owned public.shared_world_materials;
  item public.shared_world_history_items;
  targets uuid[];
  invalidating uuid[];
  removed integer;
  invalidated integer;
  affected integer;
  delete_instant timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_material_id IS NULL
     OR p_material_deleted_event_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- DURABLE IDEMPOTENCY, FIRST PASS: before any lock, so an equivalent retry is
  -- answered from immutable history even after the World has closed. Nothing on
  -- this path reads current membership or current World state. The committed
  -- answer additionally proves that NO body, NO Introduction payload and NO
  -- payload-derived verifier of the deleted material survives, which is the
  -- whole point of the deletion.
  SELECT * INTO committed FROM public.shared_world_material_delete_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.actor_user_id = u AND committed.world_id = p_world_id
       AND committed.material_id = p_material_id
       AND committed.material_deleted_event_id = p_material_deleted_event_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.shared_world_material_deleted_events ev
          JOIN public.shared_world_materials m ON m.id = ev.material_id
          JOIN public.shared_world_history_items i ON i.id = ev.history_item_id
         WHERE ev.id = committed.material_deleted_event_id
           AND ev.material_id = committed.material_id AND ev.world_id = committed.world_id
           AND ev.occurred_at = committed.committed_at
           AND m.world_id = committed.world_id AND m.author_user_id = committed.actor_user_id
           AND i.id = m.history_item_id AND i.availability_state = 'DELETED_BY_OWNER'
           AND NOT EXISTS (SELECT 1 FROM public.shared_world_text_material_bodies b
                            WHERE b.material_id = committed.material_id)
           AND NOT EXISTS (SELECT 1 FROM public.shared_world_voice_note_material_bodies b
                            WHERE b.material_id = committed.material_id)
           AND NOT EXISTS (SELECT 1 FROM public.introduction_disclosure_text_payloads tp
                            JOIN public.introduction_disclosure_resource_versions rv
                              ON rv.id = tp.resource_version_id
                           WHERE rv.material_id = committed.material_id)
           AND NOT EXISTS (SELECT 1 FROM public.introduction_disclosure_media_payloads mp
                            JOIN public.introduction_disclosure_resource_versions rv
                              ON rv.id = mp.resource_version_id
                           WHERE rv.material_id = committed.material_id)
           -- ASSURE-F06: and no payload-derived verifier of it either.
           AND NOT EXISTS (SELECT 1 FROM public.introduction_disclosure_commands dc
                           WHERE dc.material_id = committed.material_id
                             AND (dc.payload_digest IS NOT NULL OR dc.request_ref IS NOT NULL))
      ) THEN
        RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      RETURN QUERY SELECT 'MATERIAL_DELETED'::text, committed.id, committed.world_id, committed.material_id,
                          (SELECT ev.history_item_id FROM public.shared_world_material_deleted_events ev
                            WHERE ev.id = committed.material_deleted_event_id),
                          committed.material_deleted_event_id, committed.invalidated_target_count,
                          committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_DELETE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- CANONICAL LOCK ORDER, THE WORLD ROW FIRST, exactly as every other
  -- consequential material mutation does - which is what makes
  -- deletion-versus-grant, deletion-versus-closure, deletion-versus-commit and
  -- deletion-versus-Introduction-END serialize in a single deterministic order
  -- with no deadlock.
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- DURABLE IDEMPOTENCY, SECOND PASS, under the World lock, so two competing
  -- deletes serialize and the loser returns the committed result.
  SELECT * INTO committed FROM public.shared_world_material_delete_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.actor_user_id = u AND committed.world_id = p_world_id
       AND committed.material_id = p_material_id
       AND committed.material_deleted_event_id = p_material_deleted_event_id THEN
      RETURN QUERY SELECT 'MATERIAL_DELETED'::text, committed.id, committed.world_id, committed.material_id,
                          (SELECT ev.history_item_id FROM public.shared_world_material_deleted_events ev
                            WHERE ev.id = committed.material_deleted_event_id),
                          committed.material_deleted_event_id, committed.invalidated_target_count,
                          committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_DELETE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- A PRIVACY MUTATION IS NOT AN ORDINARY WORLD MUTATION. READ_ONLY_CLOSED does
  -- not block it (CW2-03 section 35 / C31), and this transaction never writes a
  -- lifecycle, a phase or a closure instant, so it cannot reopen anything.
  IF world.lifecycle NOT IN ('ACTIVE', 'READ_ONLY_CLOSED') THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- CANONICAL LOCK ORDER, STEP 2: the exact material, then its exact history
  -- item.
  SELECT * INTO owned FROM public.shared_world_materials m WHERE m.id = p_material_id FOR UPDATE;
  IF NOT FOUND OR owned.world_id <> p_world_id THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- THE ACTOR IS THE EXACT ORIGINAL HUMAN AUTHOR. A different human, and any
  -- human at all against QANDEEL material, reaches the same bounded answer as a
  -- caller naming material that does not exist, so this is not an ownership
  -- oracle either. Membership is never consulted: a former member, a closed
  -- World viewer and a human whose Introduction has ended all keep this
  -- authority (CW2-03 section 24 / C21).
  IF owned.producer_kind <> 'HUMAN' OR owned.author_user_id IS NULL OR owned.author_user_id <> u THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO item FROM public.shared_world_history_items i WHERE i.id = owned.history_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;
  -- The source must still be AVAILABLE. An already deleted or already
  -- invalidated source is not deletable a second time.
  IF item.availability_state <> 'AVAILABLE' THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- THE TRANSITIVE SOURCE-CONTENT-BEARING CLOSURE. Deterministic, over
  -- MATERIAL_DEPENDENCY edges only: a REASONING_DEPENDENCY target is an
  -- ANALYTICAL derivative and is never erased merely because a source later
  -- disappeared (CW2-02 section 27). UNION rather than UNION ALL, and migration
  -- 0089's strict source-precedes-target rule, make the traversal terminate.
  targets := coalesce((
    WITH RECURSIVE reachable(material_id) AS (
      SELECT d.target_material_id
        FROM public.shared_world_material_dependencies d
       WHERE d.dependency_kind = 'MATERIAL_DEPENDENCY' AND d.source_material_id = p_material_id
      UNION
      SELECT d.target_material_id
        FROM public.shared_world_material_dependencies d
        JOIN reachable step ON d.source_material_id = step.material_id
       WHERE d.dependency_kind = 'MATERIAL_DEPENDENCY'
    )
    SELECT array_agg(r.material_id ORDER BY r.material_id) FROM reachable r
  ), ARRAY[]::uuid[]);
  -- Acyclicity is structural, so the deleted source can never be its own
  -- downstream target. Fail closed rather than mutate it twice if it ever is.
  IF p_material_id = ANY(targets) THEN
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  IF array_length(targets, 1) IS NOT NULL THEN
    -- CANONICAL LOCK ORDER, STEP 3: every reachable target, then its history
    -- item, both in deterministic identity order.
    PERFORM 1 FROM public.shared_world_materials m WHERE m.id = ANY(targets) ORDER BY m.id FOR UPDATE;
    PERFORM 1 FROM public.shared_world_history_items i
      WHERE i.id IN (SELECT m.history_item_id FROM public.shared_world_materials m WHERE m.id = ANY(targets))
      ORDER BY i.id FOR UPDATE;
    -- Only targets whose source content is still present are invalidated. One
    -- already terminal by ITS OWN owner's deletion stays exactly as it is, and
    -- one already UNAVAILABLE needs no second transition.
    SELECT array_agg(m.id ORDER BY m.id) INTO invalidating
      FROM public.shared_world_materials m
      JOIN public.shared_world_history_items i ON i.id = m.history_item_id
     WHERE m.id = ANY(targets) AND i.availability_state = 'AVAILABLE';
  END IF;
  invalidating := coalesce(invalidating, ARRAY[]::uuid[]);

  -- THE ONE canonical deletion instant.
  delete_instant := clock_timestamp();

  BEGIN
    -- PHYSICAL REMOVAL OF THE SOURCE BODY. Human text, the audio object
    -- reference and any stored transcript all go with the row: there is nothing
    -- left to reconstruct from, and nothing is copied anywhere first.
    DELETE FROM public.shared_world_text_material_bodies b WHERE b.material_id = p_material_id;
    GET DIAGNOSTICS removed = ROW_COUNT;
    DELETE FROM public.shared_world_voice_note_material_bodies b WHERE b.material_id = p_material_id;
    GET DIAGNOSTICS affected = ROW_COUNT;
    removed := removed + affected;
    IF removed <> (CASE WHEN owned.body_form = 'RESERVED' THEN 0 ELSE 1 END) THEN
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    -- THE ONE RESERVED BRANCH: an EXPLICIT_DISCLOSURE keeps its protected
    -- payload in the typed Introduction resource relation rather than in a
    -- 0089 body relation, so that is what is destroyed here. Exactly one
    -- payload row exists per delivered resource version - a text one or a
    -- media one, never both and never neither - and the count is asserted, so
    -- a disclosure whose payload was somehow already gone fails closed rather
    -- than reporting a deletion it did not perform. The resource version, its
    -- grant fact and its durable command all SURVIVE: audit identity remains,
    -- source content does not.
    IF owned.material_kind = 'EXPLICIT_DISCLOSURE' THEN
      DELETE FROM public.introduction_disclosure_text_payloads tp
       WHERE tp.resource_version_id IN (
         SELECT rv.id FROM public.introduction_disclosure_resource_versions rv
          WHERE rv.material_id = p_material_id);
      GET DIAGNOSTICS removed = ROW_COUNT;
      DELETE FROM public.introduction_disclosure_media_payloads mp
       WHERE mp.resource_version_id IN (
         SELECT rv.id FROM public.introduction_disclosure_resource_versions rv
          WHERE rv.material_id = p_material_id);
      GET DIAGNOSTICS affected = ROW_COUNT;
      IF removed + affected <> 1 THEN
        RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
    END IF;

    -- THE TERMINAL AVAILABILITY TRANSITION, through the frozen I-04F revision
    -- semantics. Migration 0087's trigger makes DELETED_BY_OWNER permanent.
    UPDATE public.shared_world_history_items i
       SET availability_state = 'DELETED_BY_OWNER', availability_revision = i.availability_revision + 1
     WHERE i.id = owned.history_item_id AND i.availability_state = 'AVAILABLE';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 THEN
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    -- ASSURE-F06: AND THE PAYLOAD-DERIVED VERIFIERS GO WITH THE PAYLOAD.
    --
    -- It is here, after the terminal transition, because that transition is the
    -- guard's proof that an owner deletion is what is happening. It is the same
    -- transaction and the same instant, so nothing observable sits between the
    -- destroyed payload and the destroyed verifier: a failure anywhere rolls
    -- back both, and the committed answer above re-proves the result.
    --
    -- Exactly one command row names one disclosure material, so exactly one row
    -- moves. Zero means the durable command this disclosure must have is not
    -- there, and more than one is impossible; both fail closed rather than
    -- leave a verifier standing.
    IF owned.material_kind = 'EXPLICIT_DISCLOSURE' THEN
      UPDATE public.introduction_disclosure_commands c
         SET verifier_state = 'ERASED_BY_OWNER', payload_digest = NULL, request_ref = NULL,
             verifier_erased_at = delete_instant
       WHERE c.material_id = p_material_id AND c.verifier_state = 'PRESENT';
      GET DIAGNOSTICS affected = ROW_COUNT;
      IF affected <> 1 THEN
        RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
      IF EXISTS (SELECT 1 FROM public.introduction_disclosure_commands c
                  WHERE c.material_id = p_material_id
                    AND (c.payload_digest IS NOT NULL OR c.request_ref IS NOT NULL)) THEN
        RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
    END IF;

    -- EVERY TRANSITIVELY SOURCE-CONTENT-BEARING TARGET becomes UNAVAILABLE and
    -- loses its body. It is NOT marked DELETED_BY_OWNER: its own owner did not
    -- delete it, and that distinction is historical truth. Its envelope and its
    -- dependency identity survive.
    invalidated := 0;
    IF array_length(invalidating, 1) IS NOT NULL THEN
      DELETE FROM public.shared_world_text_material_bodies b WHERE b.material_id = ANY(invalidating);
      DELETE FROM public.shared_world_voice_note_material_bodies b WHERE b.material_id = ANY(invalidating);
      UPDATE public.shared_world_history_items i
         SET availability_state = 'UNAVAILABLE', availability_revision = i.availability_revision + 1
        FROM public.shared_world_materials m
       WHERE m.id = ANY(invalidating) AND i.id = m.history_item_id
         AND i.availability_state = 'AVAILABLE';
      GET DIAGNOSTICS invalidated = ROW_COUNT;
      IF invalidated <> array_length(invalidating, 1) THEN
        RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_CONTRADICTORY_STATE' USING ERRCODE='P0001';
      END IF;
    END IF;

    -- The canonical MATERIAL_DELETED fact, carrying identity and time only.
    INSERT INTO public.shared_world_material_deleted_events
      (id, world_id, material_id, history_item_id, occurred_at)
    VALUES (p_material_deleted_event_id, p_world_id, p_material_id, owned.history_item_id, delete_instant);

    INSERT INTO public.shared_world_material_delete_commands
      (id, world_id, material_id, actor_user_id, material_deleted_event_id,
       invalidated_target_count, committed_at)
    VALUES (p_command_id, p_world_id, p_material_id, u, p_material_deleted_event_id,
            invalidated, delete_instant);
  EXCEPTION WHEN unique_violation THEN
    -- DURABLE IDEMPOTENCY, THIRD PASS: two deletes sharing a command id while
    -- resolving to different humans serialize only here.
    SELECT * INTO committed FROM public.shared_world_material_delete_commands c WHERE c.id = p_command_id;
    IF FOUND THEN
      IF committed.actor_user_id = u AND committed.world_id = p_world_id
         AND committed.material_id = p_material_id
         AND committed.material_deleted_event_id = p_material_deleted_event_id THEN
        RETURN QUERY SELECT 'MATERIAL_DELETED'::text, committed.id, committed.world_id, committed.material_id,
                            (SELECT ev.history_item_id FROM public.shared_world_material_deleted_events ev
                              WHERE ev.id = committed.material_deleted_event_id),
                            committed.material_deleted_event_id, committed.invalidated_target_count,
                            committed.committed_at;
        RETURN;
      END IF;
      RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_DELETE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    -- A supplied persistence identity was already taken, or this material was
    -- already deleted under another command. The whole transaction rolls back.
    RAISE EXCEPTION 'SHARED_WORLD_MATERIAL_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'MATERIAL_DELETED'::text, p_command_id, p_world_id, p_material_id,
                      owned.history_item_id, p_material_deleted_event_id, invalidated, delete_instant;
END$$;

-- ---------------------------------------------------------------------------
-- 5. A RETRY AFTER ERASURE FAILS CLOSED.
--
--    Migration 0115's disclosure command, forward-replaced, with exactly one
--    change: each of its three durable-idempotency passes answers an ERASED
--    command with one bounded class instead of pretending it can still compare
--    payloads.
--
--    WHY IT CANNOT SIMPLY SUCCEED. The historical-success test is
--    `committed.request_ref = request`, and `request_ref` is gone. With a NULL
--    on one side that comparison is NULL, so the old body already fell through
--    to the command conflict - which is the right REFUSAL wearing the wrong
--    name, because it says "you sent a different request" to a caller who may
--    well have sent exactly the same one. Naming it correctly is the change.
--
--    WHY IT MUST NOT SUCCEED. Ignoring the payload would let any later payload
--    be blessed by a spent command identity; comparing against the deleted one
--    is impossible by construction; recomputing the verifier would recreate the
--    exact thing deletion destroyed. Deletion trades content-level retry
--    equivalence for privacy, deliberately.
--
--    WHY IT IS NOT AN ORACLE. The erased branch is gated on the SAME immutable
--    identity equality as the success branch - the exact owner and the exact
--    five bound identities - so a stranger, and anybody guessing a command id,
--    still receives the frozen command conflict and learns nothing about
--    whether a disclosure existed or was deleted.
--
--    Nothing else moves: the same authority, the same canonical World-first
--    lock order, the same Introduction Record lock, the same derived
--    counterpart, the same audience, the same CW2-08 gate last, the same single
--    clock read, and the same twelve writes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.commit_introduction_progressive_disclosure_v1(
  p_command_id uuid, p_world_id uuid, p_resource_version_id uuid, p_material_id uuid,
  p_history_item_id uuid, p_disclosure_granted_event_id uuid,
  p_resource_type text, p_field_key text, p_text_value text, p_media_object_ref text
) RETURNS TABLE(outcome text, command_id uuid, disclosed_world_id uuid,
                disclosed_resource_version_id uuid, disclosed_material_id uuid,
                disclosed_history_item_id uuid, disclosed_resource_type text,
                disclosed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  u uuid := auth.uid();
  committed public.introduction_disclosure_commands;
  world public.shared_worlds;
  record_row public.introduction_records;
  gate record;
  counterpart uuid;
  digest text;
  request text;
  is_text boolean;
  affected integer;
  viewers integer;
  disclose_at timestamptz;
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_resource_version_id IS NULL
     OR p_material_id IS NULL OR p_history_item_id IS NULL
     OR p_disclosure_granted_event_id IS NULL OR p_resource_type IS NULL THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- STEP 1. THE EXACT PAYLOAD SHAPE OF EXACTLY ONE BOUNDED TYPE. A text
  -- resource carrying a media reference and an image resource carrying text
  -- are both refused here as well as being unrepresentable in the schema, so a
  -- confused caller gets the bounded invalid-command class rather than a
  -- constraint name.
  IF p_resource_type IN ('FULL_NAME', 'CONTACT_METHOD', 'DEEPER_PERSONAL_FIELD') THEN
    is_text := true;
    IF p_text_value IS NULL OR btrim(p_text_value) = '' OR p_media_object_ref IS NOT NULL THEN
      RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_COMMAND_INVALID' USING ERRCODE='22023';
    END IF;
    IF (p_field_key IS NOT NULL) <> (p_resource_type = 'DEEPER_PERSONAL_FIELD') THEN
      RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_COMMAND_INVALID' USING ERRCODE='22023';
    END IF;
    -- The bounded single-line shapes, checked HERE as well as by the schema, so
    -- a malformed payload reaches the bounded invalid-command class rather than
    -- leaking a constraint name - and so the two-part digest below can never be
    -- made ambiguous by an embedded separator.
    --
    -- The contact-route ban is repeated here for the same reason and for one
    -- more: a key like `whatsapp_handle` satisfies the bounded-identifier shape
    -- perfectly, so without this the command would accept it and the refusal
    -- would arrive as a constraint name rather than as an answer. CONTACT_METHOD
    -- is the ONE reviewed way to disclose a contact route.
    IF length(p_text_value) > 512 OR p_text_value ~ '[\n\r]'
       OR (p_field_key IS NOT NULL
           AND (p_field_key !~ '^[a-z][a-z0-9_]{2,47}$'
             OR p_field_key ~ ('(^|_)(phone|mobile|email|whatsapp|telegram|instagram|snapchat|tiktok'
                            || '|facebook|twitter|linkedin|handle|username|contact|address|street|geo|gps'
                            || '|latitude|longitude|coordinates|url|uri|link|photo|image|avatar|selfie'
                            || '|video|audio|passport|ssn|nid|kyc|password|token|id)(_|$)'))) THEN
      RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_COMMAND_INVALID' USING ERRCODE='22023';
    END IF;
    digest := 'sha256:' || encode(sha256(convert_to(
                coalesce(p_field_key, '') || E'\n' || p_text_value, 'UTF8')), 'hex');
  ELSIF p_resource_type IN ('PARTIAL_IMAGE', 'FULL_IMAGE') THEN
    is_text := false;
    IF p_media_object_ref IS NULL OR btrim(p_media_object_ref) = ''
       OR p_text_value IS NOT NULL OR p_field_key IS NOT NULL THEN
      RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_COMMAND_INVALID' USING ERRCODE='22023';
    END IF;
    digest := 'sha256:' || encode(sha256(convert_to(p_media_object_ref, 'UTF8')), 'hex');
  ELSE
    -- There is no generic resource kind, and an unspelled one is not a new one.
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_COMMAND_INVALID' USING ERRCODE='22023';
  END IF;

  -- STEP 2. THE WHOLE IMMUTABLE REQUEST IDENTITY. Every input that must not
  -- differ between a retry and the command it retries, with presence
  -- distinguished from value so a NULL and a value can never fingerprint
  -- alike. The derived counterpart is deliberately NOT in it: it is a function
  -- of the exact World, which is, so including it would add nothing and would
  -- force a mutable read before the first idempotency pass.
  request := 'sha256:' || encode(sha256(convert_to(
      'QANDEEL_CWV2_INTRODUCTION_DISCLOSURE_REQUEST_V1' || E'\n'
   || 'world=' || lower(p_world_id::text) || E'\n'
   || 'resourceVersion=' || lower(p_resource_version_id::text) || E'\n'
   || 'material=' || lower(p_material_id::text) || E'\n'
   || 'historyItem=' || lower(p_history_item_id::text) || E'\n'
   || 'grantEvent=' || lower(p_disclosure_granted_event_id::text) || E'\n'
   || 'owner=' || lower(u::text) || E'\n'
   || 'resourceType=' || p_resource_type || E'\n'
   || 'fieldKey=' || CASE WHEN p_field_key IS NULL THEN 'NONE' ELSE p_field_key END || E'\n'
   || 'payload=' || digest || E'\n'
   || 'payloadForm=' || CASE WHEN is_text THEN 'TEXT' ELSE 'MEDIA' END, 'UTF8')), 'hex');

  -- STEP 3. DURABLE IDEMPOTENCY, FIRST PASS: before any lock, so an equivalent
  -- retry of a command that already committed is answered from immutable
  -- history even after the Introduction has ended or the World has closed.
  -- Nothing on this path reads current World state, current membership or
  -- current availability.
  --
  -- ASSURE-F06: a command whose owner has since ERASED its verifiers can no
  -- longer prove payload equivalence either way, and fails closed.
  SELECT * INTO committed FROM public.introduction_disclosure_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.owner_user_id = u AND committed.world_id = p_world_id
       AND committed.resource_version_id = p_resource_version_id
       AND committed.material_id = p_material_id
       AND committed.history_item_id = p_history_item_id
       AND committed.disclosure_granted_event_id = p_disclosure_granted_event_id
       AND committed.resource_type = p_resource_type
       AND committed.verifier_state = 'ERASED_BY_OWNER' THEN
      RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_ERASED_BY_OWNER' USING ERRCODE='55000',
        DETAIL='This disclosure was deleted by its owner and its payload-derived verifiers were destroyed with the payload. Exact payload equivalence can no longer be proven, so the historical command answers nothing. Its audit identity remains.';
    END IF;
    IF committed.owner_user_id = u AND committed.world_id = p_world_id
       AND committed.resource_version_id = p_resource_version_id
       AND committed.material_id = p_material_id
       AND committed.history_item_id = p_history_item_id
       AND committed.disclosure_granted_event_id = p_disclosure_granted_event_id
       AND committed.request_ref = request THEN
      RETURN QUERY SELECT 'DISCLOSURE_GRANTED'::text, committed.id, committed.world_id,
                          committed.resource_version_id, committed.material_id,
                          committed.history_item_id, committed.resource_type, committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- STEP 4. CANONICAL LOCK ORDER, THE WORLD ROW FIRST. Every consequential
  -- Introduction mutation starts here, which is what makes disclosure-versus-END,
  -- disclosure-versus-SUCCESS and disclosure-versus-owner-deletion serialize in
  -- one deterministic order with no deadlock.
  SELECT * INTO world FROM public.shared_worlds w WHERE w.id = p_world_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- STEP 5. DURABLE IDEMPOTENCY, SECOND PASS, under the World lock, so two
  -- concurrent equivalent disclosures serialize and the loser returns the
  -- committed result instead of attempting a second delivery. An owner deletion
  -- that won the race for the World row is visible here, and refuses.
  SELECT * INTO committed FROM public.introduction_disclosure_commands c WHERE c.id = p_command_id;
  IF FOUND THEN
    IF committed.owner_user_id = u AND committed.world_id = p_world_id
       AND committed.resource_version_id = p_resource_version_id
       AND committed.material_id = p_material_id
       AND committed.history_item_id = p_history_item_id
       AND committed.disclosure_granted_event_id = p_disclosure_granted_event_id
       AND committed.resource_type = p_resource_type
       AND committed.verifier_state = 'ERASED_BY_OWNER' THEN
      RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_ERASED_BY_OWNER' USING ERRCODE='55000',
        DETAIL='This disclosure was deleted by its owner and its payload-derived verifiers were destroyed with the payload. Exact payload equivalence can no longer be proven, so the historical command answers nothing. Its audit identity remains.';
    END IF;
    IF committed.owner_user_id = u AND committed.world_id = p_world_id
       AND committed.resource_version_id = p_resource_version_id
       AND committed.material_id = p_material_id
       AND committed.history_item_id = p_history_item_id
       AND committed.disclosure_granted_event_id = p_disclosure_granted_event_id
       AND committed.request_ref = request THEN
      RETURN QUERY SELECT 'DISCLOSURE_GRANTED'::text, committed.id, committed.world_id,
                          committed.resource_version_id, committed.material_id,
                          committed.history_item_id, committed.resource_type, committed.committed_at;
      RETURN;
    END IF;
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
  END IF;

  -- STEP 6. PROGRESSIVE DISCLOSURE IS AN ACTIVE / INTRODUCTION ACT AND NOTHING
  -- ELSE. A successfully completed Introduction is ACTIVE / STANDARD and uses
  -- ordinary Shared material; an ended one is READ_ONLY_CLOSED and admits no
  -- ordinary mutation at all. Both reach the same bounded unavailable class as
  -- a World that does not exist, so this is not a lifecycle oracle.
  IF world.lifecycle <> 'ACTIVE' OR world.phase <> 'INTRODUCTION' THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- STEP 7. CANONICAL LOCK ORDER, STEP 2: the exact Introduction Record of
  -- that exact World. `world_id` is UNIQUE on the record, so there is exactly
  -- one, and locking it is what serializes disclosure against the terminal
  -- transitions migration 0116 owns.
  SELECT * INTO record_row FROM public.introduction_records r
   WHERE r.world_id = p_world_id FOR UPDATE;
  IF NOT FOUND OR record_row.introduction_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;

  -- STEP 8. THE OWNER IS ONE OF THE EXACT TWO MATCHED HUMANS, AND THE
  -- COUNTERPART IS THE OTHER ONE - DERIVED, never supplied and never
  -- routable. A human who is not in this Introduction reaches the same bounded
  -- class as a World that does not exist.
  IF u NOT IN (record_row.lower_user_id, record_row.higher_user_id) THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_NOT_AVAILABLE' USING ERRCODE='P0002';
  END IF;
  counterpart := CASE WHEN u = record_row.lower_user_id
                      THEN record_row.higher_user_id ELSE record_row.lower_user_id END;

  -- STEP 9. EXACTLY TWO OPEN MATCHED EPISODES, one for each exact human. This
  -- is the delivery audience, derived from canonical membership rather than
  -- accepted from a caller, and it is why the baseline viewer count is two.
  SELECT count(*)::integer INTO affected
    FROM public.shared_world_membership_episodes e
   WHERE e.world_id = p_world_id AND e.ended_at IS NULL;
  IF affected <> 2
     OR NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
                     WHERE e.world_id = p_world_id AND e.user_id = u AND e.ended_at IS NULL)
     OR NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e
                     WHERE e.world_id = p_world_id AND e.user_id = counterpart AND e.ended_at IS NULL) THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
  END IF;

  -- STEP 10. THE CW2-08 PREREQUISITE, LAST - after every authority and privacy
  -- gate above, so a refusal here can never be read as an authority answer.
  SELECT * INTO gate FROM public.resolve_introduction_disclosure_prerequisites_v1(p_world_id);
  IF gate.clearance <> 'CLEARED' THEN
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_PREREQUISITE_UNRESOLVED' USING ERRCODE='55000',
      DETAIL='Introduction progressive disclosure requires the CW2-08 system/safety prerequisite to be CLEARED. It is not, and delivery fails closed.';
  END IF;

  -- STEP 11. THE ONE canonical delivery instant, read from the database clock
  -- exactly once, AFTER every lock wait and every currentness check, and
  -- reused for every moment this transaction persists.
  disclose_at := clock_timestamp();

  BEGIN
    -- STEP 12. The I-04F history identity FIRST, because the envelope, the
    -- audience, the authority and the resource version all bind to it.
    INSERT INTO public.shared_world_history_items
      (id, world_id, occurred_at, authority_requirement_mode, availability_state,
       availability_revision, registered_at)
    VALUES (p_history_item_id, p_world_id, disclose_at, 'EXACT_HUMAN_APPROVER_SET', 'AVAILABLE',
            1, disclose_at);

    -- THE EXACT ORIGINAL HUMAN AUDIENCE: the owner and the exact derived
    -- counterpart, and nobody else. Derived, never supplied.
    INSERT INTO public.shared_world_history_item_baseline_viewers (history_item_id, user_id)
    SELECT p_history_item_id, v.member FROM unnest(ARRAY[u, counterpart]) AS v(member);
    GET DIAGNOSTICS viewers = ROW_COUNT;
    IF viewers <> 2 THEN
      RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_CONTRADICTORY_STATE' USING ERRCODE='P0001';
    END IF;

    -- THE EXACT HUMAN MATERIAL AUTHORITY: the owner, and only the owner.
    -- Receiving a disclosure never creates authority over it.
    INSERT INTO public.shared_world_history_item_required_approvers (history_item_id, approver_user_id)
    VALUES (p_history_item_id, u);

    -- THE RESERVED 0089 MATERIAL KIND. The envelope carries no body, because
    -- its body form is RESERVED and no 0089 body relation accepts that form;
    -- the typed payload below owns it.
    INSERT INTO public.shared_world_materials
      (id, world_id, history_item_id, material_kind, producer_kind, body_form, author_user_id, established_at)
    VALUES (p_material_id, p_world_id, p_history_item_id, 'EXPLICIT_DISCLOSURE', 'HUMAN', 'RESERVED',
            u, disclose_at);

    -- PROVENANCE. The owner's own disclosure establishes its own truth: there
    -- is no source material and no source context reference. It is NOT a
    -- reasoning dependency, because no private Matching reasoning was read to
    -- decide what to disclose.
    INSERT INTO public.shared_world_material_dependencies
      (id, world_id, dependency_kind, target_material_id, target_established_at)
    VALUES (gen_random_uuid(), p_world_id, 'INDEPENDENT_TARGET_TRUTH', p_material_id, disclose_at);

    -- HISTORICAL-SHARING AUTHORITY. A human's own disclosed resource has
    -- exactly one human authority and it is known: themselves.
    INSERT INTO public.shared_world_material_historical_authority
      (material_id, world_id, history_item_id, resolution_state)
    VALUES (p_material_id, p_world_id, p_history_item_id, 'RESOLVED_EXACT_HUMAN_REQUIREMENT');

    INSERT INTO public.introduction_disclosure_resource_versions
      (id, world_id, introduction_record_id, owner_user_id, counterpart_user_id,
       resource_type, material_id, history_item_id, established_at)
    VALUES (p_resource_version_id, p_world_id, record_row.id, u, counterpart,
            p_resource_type, p_material_id, p_history_item_id, disclose_at);

    IF is_text THEN
      INSERT INTO public.introduction_disclosure_text_payloads
        (resource_version_id, resource_type, field_key, text_value)
      VALUES (p_resource_version_id, p_resource_type, p_field_key, p_text_value);
    ELSE
      INSERT INTO public.introduction_disclosure_media_payloads
        (resource_version_id, resource_type, media_object_ref)
      VALUES (p_resource_version_id, p_resource_type, p_media_object_ref);
    END IF;

    INSERT INTO public.introduction_disclosure_granted_events
      (id, world_id, introduction_record_id, resource_version_id, owner_user_id,
       counterpart_user_id, occurred_at)
    VALUES (p_disclosure_granted_event_id, p_world_id, record_row.id, p_resource_version_id, u,
            counterpart, disclose_at);

    -- The verifiers are born PRESENT beside the payload they verify, and the
    -- column default says so rather than this INSERT restating it.
    INSERT INTO public.introduction_disclosure_commands
      (id, world_id, introduction_record_id, resource_version_id, material_id, history_item_id,
       disclosure_granted_event_id, owner_user_id, counterpart_user_id, resource_type,
       payload_digest, request_ref, baseline_viewer_count, committed_at)
    VALUES (p_command_id, p_world_id, record_row.id, p_resource_version_id, p_material_id,
            p_history_item_id, p_disclosure_granted_event_id, u, counterpart, p_resource_type,
            digest, request, viewers, disclose_at);
  EXCEPTION WHEN unique_violation THEN
    -- DURABLE IDEMPOTENCY, THIRD PASS. Two equivalent disclosures by the same
    -- human always serialize on the World row above, but two commands sharing
    -- a command id while resolving to DIFFERENT humans do not, and this
    -- conflict is their only serialization point. So durable history is
    -- consulted before any conflict is classified.
    SELECT * INTO committed FROM public.introduction_disclosure_commands c WHERE c.id = p_command_id;
    IF FOUND THEN
      IF committed.owner_user_id = u AND committed.world_id = p_world_id
         AND committed.resource_version_id = p_resource_version_id
         AND committed.material_id = p_material_id
         AND committed.history_item_id = p_history_item_id
         AND committed.disclosure_granted_event_id = p_disclosure_granted_event_id
         AND committed.resource_type = p_resource_type
         AND committed.verifier_state = 'ERASED_BY_OWNER' THEN
        RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_ERASED_BY_OWNER' USING ERRCODE='55000',
          DETAIL='This disclosure was deleted by its owner and its payload-derived verifiers were destroyed with the payload. Exact payload equivalence can no longer be proven, so the historical command answers nothing. Its audit identity remains.';
      END IF;
      IF committed.owner_user_id = u AND committed.world_id = p_world_id
         AND committed.resource_version_id = p_resource_version_id
         AND committed.material_id = p_material_id
         AND committed.history_item_id = p_history_item_id
         AND committed.disclosure_granted_event_id = p_disclosure_granted_event_id
         AND committed.request_ref = request THEN
        RETURN QUERY SELECT 'DISCLOSURE_GRANTED'::text, committed.id, committed.world_id,
                            committed.resource_version_id, committed.material_id,
                            committed.history_item_id, committed.resource_type, committed.committed_at;
        RETURN;
      END IF;
      RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_COMMAND_ID_CONFLICT' USING ERRCODE='23505';
    END IF;
    -- A supplied persistence identity was already taken. The whole delivery
    -- rolls back together, so a refused disclosure never leaves a resource
    -- version without a payload, a history item without its audience, or a
    -- material without its authority.
    RAISE EXCEPTION 'INTRODUCTION_DISCLOSURE_ID_CONFLICT' USING ERRCODE='23505';
  END;

  RETURN QUERY SELECT 'DISCLOSURE_GRANTED'::text, p_command_id, p_world_id, p_resource_version_id,
                      p_material_id, p_history_item_id, p_resource_type, disclose_at;
END$$;

-- ---------------------------------------------------------------------------
-- 6. OWNERSHIP AND THE PRE-LAUNCH ACL, RE-ASSERTED.
--
--    Both replaced primitives keep exactly the posture they had: postgres-owned,
--    SECURITY DEFINER, search_path-pinned, and executable by NO application
--    role, service_role included. There is NO privacy-erasure RPC: the one-way
--    transition is reachable through canonical owner deletion and through this
--    migration's reconciliation, and through nothing else.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  replaced text[] := ARRAY[
    'public.delete_shared_world_owned_material_v1(uuid, uuid, uuid, uuid)',
    'public.commit_introduction_progressive_disclosure_v1(uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, text)'];
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
-- 7. TERMINAL SELF-ASSERTIONS.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  p record;
  target_role text;
  guarded integer;
BEGIN
  -- B1. THE GUARD IS INSTALLED, ON ITS OWN RELATION, UNDER ITS OWN NAME, and
  --     the two sibling relations still carry the blanket refusal.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
      JOIN pg_proc pr ON pr.oid = t.tgfoid
     WHERE t.tgrelid = 'public.introduction_disclosure_commands'::regclass
       AND t.tgname = 'introduction_disclosure_commands_immutable'
       AND NOT t.tgisinternal AND t.tgenabled = 'O'
       AND pr.proname = 'introduction_disclosure_verifier_erasure_guard_v1') THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: the one-way verifier erasure guard must hold the disclosure command relation';
  END IF;
  SELECT count(*)::integer INTO guarded FROM pg_trigger t
    JOIN pg_proc pr ON pr.oid = t.tgfoid
   WHERE NOT t.tgisinternal AND t.tgenabled = 'O'
     AND pr.proname = 'reject_introduction_disclosure_mutation_v1'
     AND t.tgrelid IN ('public.introduction_disclosure_resource_versions'::regclass,
                       'public.introduction_disclosure_granted_events'::regclass);
  IF guarded <> 2 THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: the resource version and the grant fact must keep their blanket append-only refusal, found %', guarded;
  END IF;

  -- B2. THE ERASURE IS ONE-WAY AND STRUCTURAL. The guard permits exactly the
  --     PRESENT -> ERASED_BY_OWNER transition, and the CHECK makes any other
  --     combination of state and verifier columns unrepresentable.
  SELECT pr.* INTO p FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.proname = 'introduction_disclosure_verifier_erasure_guard_v1';
  IF p.prosrc !~ 'OLD\.verifier_state <> ''PRESENT'' OR NEW\.verifier_state <> ''ERASED_BY_OWNER'''
     OR p.prosrc !~ 'DELETED_BY_OWNER'
     OR p.prosrc !~ 'introduction_disclosure_text_payloads'
     OR p.prosrc !~ 'introduction_disclosure_media_payloads' THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: the guard must permit exactly one transition and must prove the owner deletion itself';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                  WHERE c.conrelid = 'public.introduction_disclosure_commands'::regclass
                    AND c.conname = 'introduction_disclosure_commands_verifier_shape_check') THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: the verifier state and the verifier columns must be one structural fact';
  END IF;

  -- B3. OWNER DELETION DESTROYS BOTH, AND IT IS STILL THE ONLY THING THAT
  --     DESTROYS EITHER. Exactly one function removes a disclosure payload, and
  --     exactly one erases a disclosure verifier outside this migration.
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
         AND (pr.prosrc ~ 'DELETE FROM public\.introduction_disclosure_text_payloads'
           OR pr.prosrc ~ 'DELETE FROM public\.introduction_disclosure_media_payloads')) <> 1 THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: exactly one canonical primitive may destroy a disclosure payload';
  END IF;
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public' AND pr.prorettype <> 'trigger'::regtype::oid
         AND pr.prosrc ~ 'UPDATE public\.introduction_disclosure_commands') <> 1 THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: exactly one canonical primitive may erase a disclosure verifier';
  END IF;
  SELECT pr.* INTO p FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.proname = 'delete_shared_world_owned_material_v1';
  IF p.prosrc !~ '''ERASED_BY_OWNER''' OR p.prosrc !~ 'payload_digest = NULL'
     OR p.prosrc !~ 'request_ref = NULL' THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: owner deletion must destroy the payload-derived verifiers with the payload';
  END IF;

  -- B4. A RETRY AFTER ERASURE FAILS CLOSED, AND RECONSTRUCTS NOTHING. The
  --     disclosure command names the bounded class, still computes the request
  --     identity from the payload it was given, and writes no payload and no
  --     verifier on that path.
  SELECT pr.* INTO p FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.proname = 'commit_introduction_progressive_disclosure_v1';
  IF p.prosrc !~ 'INTRODUCTION_DISCLOSURE_ERASED_BY_OWNER' THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: a retry after verifier erasure must fail closed with its own bounded class';
  END IF;
  -- REM03-ERASE-ID-01: and it reaches that class only when EVERY surviving
  -- immutable request identity field still matches, resource_type included.
  IF (SELECT count(*) FROM regexp_matches(p.prosrc,
        'committed\.resource_type = p_resource_type', 'g')) <> 3 THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: all three erased branches must compare the surviving resource type before answering ERASED_BY_OWNER';
  END IF;
  IF p.prosrc ~ 'verifier_erased_at' OR p.prosrc ~ 'UPDATE public\.introduction_disclosure_commands' THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: the disclosure command may neither erase nor restore a verifier';
  END IF;

  -- B5. NO OTHER RELATION KEEPS A PAYLOAD-DERIVED VERIFIER OF A DISCLOSURE.
  --     Neither Public packaging nor Replay source selection can carry an
  --     EXPLICIT_DISCLOSURE at all: both refuse, by predicate, every material
  --     kind outside the packageable ones, so a captured digest of a disclosure
  --     payload cannot exist in either place. Asserted as a predicate AND as a
  --     census over the live rows, because a gate is only worth what the data
  --     behind it shows.
  IF (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
       WHERE n.nspname = 'public'
         AND pr.proname IN ('prepare_public_experience_manifest_v1', 'replay_capture_source_manifest_v1')
         AND pr.prosrc ~ 'material_kind NOT IN \(''HUMAN_TEXT''') <> 2 THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: Public packaging and Replay source capture must each refuse every material kind outside the packageable ones';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.publication_package_item_provenance pp
      JOIN public.shared_world_materials m ON m.id = pp.shared_material_id
     WHERE m.material_kind = 'EXPLICIT_DISCLOSURE') THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: a Public package retains a captured digest of an Introduction disclosure';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.replay_source_manifest_items ri
      JOIN public.shared_world_materials m ON m.id = ri.shared_material_id
     WHERE m.material_kind = 'EXPLICIT_DISCLOSURE') THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: a Replay source manifest retains a captured digest of an Introduction disclosure';
  END IF;

  -- B6. NO APPLICATION ROLE GAINED ANYTHING, and no erasure RPC exists.
  FOREACH target_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = target_role)
       AND EXISTS (
         SELECT 1 FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
          WHERE n.nspname = 'public'
            AND pr.proname IN ('delete_shared_world_owned_material_v1',
                               'commit_introduction_progressive_disclosure_v1',
                               'introduction_disclosure_verifier_erasure_guard_v1')
            AND has_function_privilege(target_role, pr.oid, 'EXECUTE')) THEN
      RAISE EXCEPTION 'QAN-CW-REM-03: % must execute no owner-deletion, disclosure or erasure boundary', target_role;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
              WHERE n.nspname = 'public' AND pr.proname ~ 'eras' AND pr.prorettype <> 'trigger'::regtype::oid) THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: privacy erasure is not a command of its own';
  END IF;

  -- B7. NO ASSURE-F05. Nothing here touches a Public derivative, a Public
  --     lifecycle or a Public publication because a source became unavailable.
  SELECT pr.* INTO p FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public' AND pr.proname = 'delete_shared_world_owned_material_v1';
  IF p.prosrc ~ 'public_experience' OR p.prosrc ~ 'publication_package' THEN
    RAISE EXCEPTION 'QAN-CW-REM-03: owner deletion may not reach Public derivative state (ASSURE-F05 is not authorized here)';
  END IF;
END$$;

COMMIT;
