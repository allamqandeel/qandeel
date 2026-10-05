-- S4-02 — Shared Conversation & Material Production Integration v1.
--
-- Additive and forward-only. Migrations 0001–0138 are untouched: no historical table, column, constraint body, trigger,
-- function body or policy is dropped, replaced or rewritten. This migration consumes the frozen I-04G material runtime
-- — the 0089 material resolver, the 0090 HUMAN_TEXT commit, the 0090 QANDEEL commit core (as 0118 / 0119 extended it)
-- and the 0090 owner deletion — through the S4-01 (0138) Shared launch gate, and adds only the reviewed Product
-- execution boundary over them. It creates no second message, history, ownership, audience or QANDEEL material model.
-- Its only tables are the two runtime-authority tables of the Shared generation work bound (item 4), which hold no
-- content and are reachable by no application role.
--
-- ## What this adds
--
--   1. ONE more capability scope on the S4-01 launch gate: `SHARED_CONVERSATION`, the ordinary Shared conversation
--      capability (human text and the request-driven QANDEEL reply). The 0138 scope CHECK is widened by exactly that
--      literal — the one forward alteration of a 0138 relation here — and every gate rule stays the 0138 rule: ALLOW
--      needs ENABLED + SATISFIED / WAIVED, everything else DENIES, an absent row is UNCONFIGURED, and this migration
--      configures nothing (every scope starts closed).
--   2. The Product-safe material read (S4-02 §5.1): `list_own_shared_world_material_v1`, the caller derived from
--      `auth.uid()`, the exact-World visible material of a CURRENT member only, through the ONE frozen 0089 resolver —
--      renderable material only, bounded, cursored, newest first. It reveals no hidden item, count, author, provenance,
--      authority row, approver set or private context reference, because the frozen resolver returns none of them, and
--      it adds nothing of its own except each visible human author's Name (legitimate Product data the S4-01 member
--      list already shows) and whether THIS reader may delete the row. Material whose body form has no Product source
--      yet (`HUMAN_VOICE_NOTE`, `QAN-BL-VOICE-01`) is not projected: nothing about it is faked.
--   3. The human text execution wrapper (S4-02 §5.2): `send_shared_world_human_text_v1(command, World, content)`. The
--      human is `auth.uid()`; the World is the exact route; the material and history identities are server-derived from
--      the command (so one logical command is one material, however many times it is retried, and the client supplies
--      no persistence identity); the Shared conversation gate is bound before the frozen 0090 commit runs; the commit
--      itself derives the audience, the authority and the kind. A retry of a committed command is answered from durable
--      history whatever the gate says now; a retry that changes the text is the frozen 23505 conflict.
--   4. The QANDEEL reply (S4-02 §5.3), the SERVER's act, reachable by `service_role` only — the same server-only
--      channel the frozen I-03 resolvers (0077 / 0079 / 0080) and the 0089 material resolver already use — as three
--      commands over one durable work lease (the PROD-SEC-02 / 0131 principle): `begin_shared_qandeel_reply_work_v1`
--      grants at most one live generation per human command, at most two per requesting human and a bounded rolling
--      work-start budget, for every API instance at once, with a lease that expires on its own;
--      `complete_shared_world_qandeel_reply_v1` commits, only for the current lease holder, exactly ONE reply per
--      committed human command (the reply identities are derived from the human command), binds the conversation gate,
--      pins the kind to `QANDEEL_OUTPUT`, and hands the exact I-03 evidence to the frozen 0090 core, which re-derives
--      the audience, recomputes the readiness and output digests and refuses stale or foreign evidence on its own;
--      `end_shared_qandeel_reply_work_v1` returns a lease the request no longer needs.
--   5. The owner deletion wrapper (S4-02 §5.5): `delete_own_shared_world_material_v1(command, World, material)`. The
--      human is `auth.uid()`; ownership and authority are the frozen 0090 primitive's; it is NOT bound to the
--      conversation gate, because it is a PRIVACY_MATERIAL_MUTATION (CW2-03 §35 / C31) and an owner's control over
--      their own material must not depend on an ordinary-conversation feature flag.
--
-- ## Boundary (continues 0138)
--
--   - every privileged part lives in `shared_private` as a pinned SECURITY DEFINER; every exposed `public` function is a
--     SECURITY INVOKER one-liner;
--   - `authenticated` executes exactly the four owner commands (read capability, read material, send, delete);
--   - `service_role` gains USAGE on `shared_private` and EXECUTE on exactly the three QANDEEL reply-work commands —
--     nothing else: no table, no human command, no gate change;
--   - the frozen 0090 primitives stay executable by NO application role; no table grant of any kind is made;
--   - no content, body, transcript or provider output is logged, stored or returned outside the canonical material body.
--
-- ## Lock order (continues 0138 / 0090; never reversed)
--
--   0. the gate row of the capability      (FOR SHARE — inside bind_shared_launch_gate_v1)
--   0a. the requester's reply-work lock    (advisory, own namespace — begin only)
--   0b. the reply-work lease row           (begin / complete)
--   1. the World row                       (FOR UPDATE — inside the frozen 0090 cores)
--   2. material / history / dependency rows (inside the frozen 0090 cores)

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. The one additive gate scope. The constraint is replaced by the same constraint plus one literal; no row, state,
--    event or evidence is touched, and the two 0138 scopes keep their exact meaning.
-- ---------------------------------------------------------------------------------------------------------------------
ALTER TABLE shared_private.shared_launch_capability_states DROP CONSTRAINT shared_launch_capability_states_scope_check;
ALTER TABLE shared_private.shared_launch_capability_states ADD CONSTRAINT shared_launch_capability_states_scope_check
    CHECK (capability_scope IN ('SHARED_DIRECT_INVITATION', 'SHARED_DIRECT_WORLD_BIRTH', 'SHARED_CONVERSATION'));

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Server-derived persistence identities. One logical command is one material: the identities the frozen 0090
--    primitives require are derived from the command id under a per-role namespace, so a retry presents the SAME
--    identities (and is answered from durable history) while no client ever chooses a material, history item or event
--    identity. A pure function: no actor, no table, no clock.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION shared_private.derive_shared_conversation_identity_v1(p_namespace text, p_command_id uuid)
RETURNS uuid
LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER SET search_path = '' AS $$
  SELECT (substr(h, 1, 12) || '4' || substr(h, 14, 3) || '8' || substr(h, 18, 3) || substr(h, 21, 12))::uuid
    FROM (SELECT encode(sha256(convert_to('QANDEEL_S4_02_SHARED_CONVERSATION_IDENTITY_V1' || E'\n' || p_namespace || E'\n'
                                          || lower(p_command_id::text), 'UTF8')), 'hex') AS h) d;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Presentation hint (CW2-08 §24: client flags never grant authority; every command re-binds the gate itself).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION shared_private.read_shared_conversation_capability_v1()
RETURNS TABLE (conversation_available boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT
    EXISTS (SELECT 1 FROM shared_private.shared_launch_capability_states s
             WHERE s.capability_scope = 'SHARED_CONVERSATION' AND s.feature_flag_state = 'ENABLED'
               AND s.launch_requirements_state IN ('SATISFIED', 'WAIVED_BY_AUTHORIZED_GOVERNANCE'));
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. The Product-safe material read. A CURRENT member of an ACTIVE World (the S4-01 entry law) reads, through the ONE
--    frozen 0089 resolver and nothing else, the text-form material that resolver says they may see — newest first,
--    bounded, cursored by (established_at, id). A non-member, a former member, a closed World and a World that never
--    existed read the same thing: nothing. No row for hidden or deleted material; no count; no placeholder.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION shared_private.list_own_shared_world_material_v1(
  p_world_id uuid, p_before_established_at timestamptz, p_before_material_id uuid, p_limit integer
) RETURNS TABLE (material_id uuid, material_kind text, producer_kind text, established_at timestamptz, is_self boolean,
                 author_name text, text_body text, can_delete boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_world_id IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 200
     OR ((p_before_established_at IS NULL) <> (p_before_material_id IS NULL)) THEN
    RAISE EXCEPTION 'SHARED_MATERIAL_READ_INVALID' USING ERRCODE = '22023';
  END IF;
  -- Current membership (an OPEN episode in an ACTIVE World) is the S4-01 entry law. Anything else reads nothing, and
  -- reads nothing in the same way, so this is not a membership or World-existence oracle.
  IF NOT EXISTS (
    SELECT 1 FROM public.shared_world_membership_episodes e
      JOIN public.shared_worlds w ON w.id = e.world_id
     WHERE e.world_id = p_world_id AND e.user_id = v_user AND e.ended_at IS NULL AND w.lifecycle = 'ACTIVE'
  ) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT m.material_id, m.material_kind,
           CASE WHEN m.author_user_id IS NULL THEN 'QANDEEL' ELSE 'HUMAN' END,
           m.established_at,
           COALESCE(m.author_user_id = v_user, false),
           CASE WHEN m.author_user_id IS NULL THEN NULL ELSE u.name END,
           m.text_body,
           m.author_user_id IS NOT NULL AND m.author_user_id = v_user
      FROM public.resolve_shared_world_material_v1(p_world_id, v_user) m
      LEFT JOIN public.users u ON u.id = m.author_user_id
     WHERE m.text_body IS NOT NULL
       AND (p_before_established_at IS NULL
            OR (m.established_at, m.material_id) < (p_before_established_at, p_before_material_id))
     ORDER BY m.established_at DESC, m.material_id DESC
     LIMIT p_limit;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Human text. Outcomes: COMMITTED (now, or already under this command — answered from durable history whatever the
--    gate says now) | UNAVAILABLE (the conversation capability DENIES, or the frozen commit's one bounded refusal: not a
--    current member, not ACTIVE / STANDARD, unknown World — one answer, no detail). The frozen 23505 conflict (the same
--    command with different text, or another human's command) propagates unchanged.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION shared_private.send_shared_world_human_text_v1(p_command_id uuid, p_world_id uuid, p_content text)
RETURNS TABLE (outcome text, material_id uuid, established_at timestamptz, qandeel_reply_material_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_material uuid;
  v_item uuid;
  v_reply_command uuid;
  v_gate record;
  v_committed public.shared_world_material_commit_commands;
  v_result record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  -- The bounded request: the same bound the Personal conversation route already applies to one submission.
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_content IS NULL OR length(btrim(p_content)) = 0
     OR length(p_content) > 20000 THEN
    RAISE EXCEPTION 'SHARED_MESSAGE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_material := shared_private.derive_shared_conversation_identity_v1('HUMAN_TEXT_MATERIAL', p_command_id);
  v_item := shared_private.derive_shared_conversation_identity_v1('HUMAN_TEXT_HISTORY_ITEM', p_command_id);
  v_reply_command := shared_private.derive_shared_conversation_identity_v1('QANDEEL_REPLY_COMMAND', p_command_id);

  -- An equivalent retry of a committed command is a read of committed truth, not a new ordinary act: it is answered by
  -- the frozen commit's own durable idempotency even after the capability closes. A command that belongs to another
  -- human or another World reaches the frozen conflict below.
  SELECT * INTO v_committed FROM public.shared_world_material_commit_commands c WHERE c.id = p_command_id;
  IF NOT FOUND OR v_committed.actor_user_id IS DISTINCT FROM v_user OR v_committed.world_id <> p_world_id THEN
    -- LOCK ORDER STEP 0: the current conversation-capability snapshot, held FOR SHARE until this transaction ends.
    SELECT * INTO v_gate FROM shared_private.bind_shared_launch_gate_v1('SHARED_CONVERSATION');
    IF v_gate.verdict <> 'ALLOW' THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz, NULL::uuid;
      RETURN;
    END IF;
  END IF;

  BEGIN
    SELECT c.committed_material_id, c.material_established_at INTO v_result
      FROM public.commit_shared_world_human_text_v1(p_command_id, p_world_id, v_material, v_item, p_content) c;
  EXCEPTION
    WHEN no_data_found THEN
      -- SHARED_WORLD_MATERIAL_NOT_AVAILABLE: not a current member, not ACTIVE / STANDARD, no such World — one answer.
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz, NULL::uuid;
      RETURN;
  END;

  RETURN QUERY
    SELECT 'COMMITTED'::text, v_result.committed_material_id, v_result.material_established_at,
           (SELECT r.material_id FROM public.shared_world_material_commit_commands r WHERE r.id = v_reply_command);
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. The QANDEEL reply: the SERVER's act (service_role only). QANDEEL is a system actor and no human is its author.
--
--    6a. The provider-work bound (the PROD-SEC-02 / 0131 principle, applied to Shared generation). A route rate limit
--        bounds how OFTEN requests arrive at one API instance; it bounds neither how much provider work runs AT ONCE
--        across instances nor how much runs over a day. So every Shared QANDEEL generation runs only under a durable
--        work LEASE taken here, at the database authority, for every API instance at once:
--          * ONE logical generation per human command: while a live lease covers a command, another request for it
--            starts nothing (IN_PROGRESS); a command whose reply is committed starts nothing (ALREADY_COMMITTED). At
--            most one QANDEEL output per logical request, and never parallel provider work for it;
--          * a per-requester IN-FLIGHT bound: the human whose request starts a generation holds at most two live
--            leases at once, across every World and every API instance;
--          * a per-requester WORK-START budget: every GRANTED lease is recorded durably, and a new grant is refused once
--            the rolling 10-minute or 24-hour budget is spent, so a retry loop, a burst across instances or commands
--            banked earlier can never become unbounded provider spend;
--          * bounded crash recovery: a lease lasts the frozen 120-second foreground lease
--            (`foreground_generation_lease_interval_v1`, 0039), so a crashed request frees its slot by itself; the API
--            returns it as soon as its request ends. Every provider call is bounded far below it (10 s adapters).
--        It creates no Personal conversation, session or turn row and uses no process-local mutex: the lease belongs to
--        the committed Shared human command it answers and disappears with it. The numbers are engineering safety
--        defaults in ONE internal function, owned where no client can reach them; changing them is a reviewed forward
--        migration.
--
--    6b. The reply commit, under the lease: exactly ONE reply per committed human command of this exact World. The
--        reply's command, material and history identities are derived from the human command, so a second attempt
--        answers the reply already committed and commits nothing. Only the holder of the command's CURRENT lease may
--        commit (a holder whose expired lease was superseded commits nothing); the conversation gate is bound before
--        the frozen core runs; the kind is the literal QANDEEL_OUTPUT; the exact I-03 evidence passes through
--        untouched and the core re-checks it (audience recomputed under the World lock, readiness and output digests
--        recomputed, sources AVAILABLE in this exact World). Completing returns the lease, whatever the outcome.
--        Outcomes: MATERIAL_COMMITTED (now, or already) | UNAVAILABLE (the capability DENIES; no current lease; the
--        core's bounded refusal) | STALE (the frozen 40001: the audience moved, the evidence belongs to another World,
--        or a source is no longer available). Invalid or forged evidence (22023) and identity conflicts (23505)
--        propagate unchanged.
--
--    Lock order inside the work commands: the gate row (FOR SHARE, step 0); then the requester's work lock, an advisory
--    transaction lock keyed only by that human in its own namespace, taken by nothing else in the schema and never
--    awaited by a holder of a row lock; then the lease rows. The completion binds the gate, then takes the lease row, then
--    lets the frozen core take the World row. No deadlock cycle is added.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION shared_private.shared_qandeel_reply_work_policy_v1(
  OUT user_in_flight_limit integer,
  OUT short_window interval,
  OUT short_window_limit integer,
  OUT long_window interval,
  OUT long_window_limit integer
) LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  -- Two in flight (room for a second device, as for Personal turns); the Personal admission allowance of 40 per rolling
  -- 10 minutes and 600 per rolling 24 hours. Every send waits for its reply before the input accepts the next one, so
  -- conversational use stays far below it, while one account's whole Shared generation is a bounded daily amount.
  SELECT 2, interval '10 minutes', 40, interval '24 hours', 600
$$;

-- Runtime authority state only: no application role may read or write either table.
CREATE TABLE shared_private.shared_qandeel_reply_work_leases (
    human_command_id uuid NOT NULL,
    world_id uuid NOT NULL,
    requester_user_id uuid NOT NULL,
    lease_id uuid NOT NULL,
    acquired_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    CONSTRAINT shared_qandeel_reply_work_leases_pk PRIMARY KEY (human_command_id),
    CONSTRAINT shared_qandeel_reply_work_leases_command_fk
        FOREIGN KEY (human_command_id) REFERENCES public.shared_world_material_commit_commands (id) ON DELETE CASCADE,
    CONSTRAINT shared_qandeel_reply_work_leases_user_fk
        FOREIGN KEY (requester_user_id) REFERENCES public.users (id) ON DELETE CASCADE,
    CONSTRAINT shared_qandeel_reply_work_leases_window_check CHECK (expires_at > acquired_at)
);
CREATE INDEX shared_qandeel_reply_work_leases_user_idx
    ON shared_private.shared_qandeel_reply_work_leases (requester_user_id, expires_at);

-- One row per GRANTED lease, kept as long as the longest window needs it. Returning a lease never removes its grant,
-- so a returned or expired lease is still charged.
CREATE TABLE shared_private.shared_qandeel_reply_work_grants (
    id bigint GENERATED ALWAYS AS IDENTITY,
    requester_user_id uuid NOT NULL,
    granted_at timestamptz NOT NULL,
    CONSTRAINT shared_qandeel_reply_work_grants_pk PRIMARY KEY (id),
    CONSTRAINT shared_qandeel_reply_work_grants_user_fk
        FOREIGN KEY (requester_user_id) REFERENCES public.users (id) ON DELETE CASCADE
);
CREATE INDEX shared_qandeel_reply_work_grants_user_idx
    ON shared_private.shared_qandeel_reply_work_grants (requester_user_id, granted_at);

ALTER TABLE shared_private.shared_qandeel_reply_work_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_private.shared_qandeel_reply_work_grants ENABLE ROW LEVEL SECURITY;

-- Begin provider-bearing work for one human command. GRANTED (a new lease, held until completion, return or expiry) |
-- IN_PROGRESS (a live lease already covers this command) | ALREADY_COMMITTED (the one reply exists) | LIMITED (the
-- requester is at the in-flight bound or has spent the work-start budget; one answer for every reason) | UNAVAILABLE
-- (not a committed HUMAN_TEXT command of this requester in this World, the requester is no longer a current member of
-- the ACTIVE World, or the conversation capability DENIES). A refusal records nothing.
CREATE FUNCTION shared_private.begin_shared_qandeel_reply_work_v1(
  p_human_command_id uuid, p_world_id uuid, p_requester_user_id uuid
) RETURNS TABLE (work_outcome text, work_lease_id uuid, reply_material_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_human public.shared_world_material_commit_commands;
  v_reply public.shared_world_material_commit_commands;
  v_gate record;
  v_policy record;
  v_lease uuid;
BEGIN
  IF p_human_command_id IS NULL OR p_world_id IS NULL OR p_requester_user_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_QANDEEL_REPLY_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  -- Ownership is explicit, as for every server-named actor: the server names the human whose committed HUMAN_TEXT
  -- command in this exact World started the request. Anything else is one answer.
  SELECT * INTO v_human FROM public.shared_world_material_commit_commands c WHERE c.id = p_human_command_id;
  IF NOT FOUND OR v_human.world_id <> p_world_id OR v_human.producer_kind <> 'HUMAN'
     OR v_human.material_kind <> 'HUMAN_TEXT' OR v_human.actor_user_id IS DISTINCT FROM p_requester_user_id THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;
  -- The one reply already exists: nothing to generate, whatever the gate or the budget says now.
  SELECT * INTO v_reply FROM public.shared_world_material_commit_commands c
   WHERE c.id = shared_private.derive_shared_conversation_identity_v1('QANDEEL_REPLY_COMMAND', p_human_command_id);
  IF FOUND THEN
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, NULL::uuid, v_reply.material_id;
    RETURN;
  END IF;
  -- No provider work for a human who is no longer a current member of the ACTIVE World.
  IF NOT EXISTS (SELECT 1 FROM public.shared_world_membership_episodes e JOIN public.shared_worlds w ON w.id = e.world_id
                  WHERE e.world_id = p_world_id AND e.user_id = p_requester_user_id AND e.ended_at IS NULL
                    AND w.lifecycle = 'ACTIVE') THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;
  -- LOCK ORDER STEP 0: no provider work starts while ordinary Shared conversation is closed.
  SELECT * INTO v_gate FROM shared_private.bind_shared_launch_gate_v1('SHARED_CONVERSATION');
  IF v_gate.verdict <> 'ALLOW' THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;
  -- The requester's work lock: every decision below is made under it, for every API instance at once.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('qandeel.shared-qandeel-reply-work.v1:' || p_requester_user_id::text, 0));
  -- Read again under the lock: a holder that committed the reply while this request waited has also returned its lease.
  SELECT * INTO v_reply FROM public.shared_world_material_commit_commands c
   WHERE c.id = shared_private.derive_shared_conversation_identity_v1('QANDEEL_REPLY_COMMAND', p_human_command_id);
  IF FOUND THEN
    RETURN QUERY SELECT 'ALREADY_COMMITTED'::text, NULL::uuid, v_reply.material_id;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM shared_private.shared_qandeel_reply_work_leases l
              WHERE l.human_command_id = p_human_command_id AND l.expires_at > CURRENT_TIMESTAMP) THEN
    RETURN QUERY SELECT 'IN_PROGRESS'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;
  SELECT * INTO v_policy FROM shared_private.shared_qandeel_reply_work_policy_v1();
  -- Bounded housekeeping of this requester's rows only: expired leases free their slots; grants older than the longest
  -- window can no longer count.
  DELETE FROM shared_private.shared_qandeel_reply_work_leases l
   WHERE l.requester_user_id = p_requester_user_id AND l.expires_at <= CURRENT_TIMESTAMP;
  DELETE FROM shared_private.shared_qandeel_reply_work_grants g
   WHERE g.requester_user_id = p_requester_user_id AND g.granted_at <= CURRENT_TIMESTAMP - v_policy.long_window;
  -- One answer for every reason: no counter, window, limit or other World is disclosed.
  IF (SELECT count(*) FROM shared_private.shared_qandeel_reply_work_leases l
       WHERE l.requester_user_id = p_requester_user_id) >= v_policy.user_in_flight_limit
     OR (SELECT count(*) FROM shared_private.shared_qandeel_reply_work_grants g
          WHERE g.requester_user_id = p_requester_user_id
            AND g.granted_at > CURRENT_TIMESTAMP - v_policy.short_window) >= v_policy.short_window_limit
     OR (SELECT count(*) FROM shared_private.shared_qandeel_reply_work_grants g
          WHERE g.requester_user_id = p_requester_user_id) >= v_policy.long_window_limit THEN
    RETURN QUERY SELECT 'LIMITED'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;
  v_lease := pg_catalog.gen_random_uuid();
  INSERT INTO shared_private.shared_qandeel_reply_work_leases
    (human_command_id, world_id, requester_user_id, lease_id, acquired_at, expires_at)
  VALUES (p_human_command_id, p_world_id, p_requester_user_id, v_lease, CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP + public.foreground_generation_lease_interval_v1());
  INSERT INTO shared_private.shared_qandeel_reply_work_grants (requester_user_id, granted_at)
  VALUES (p_requester_user_id, CURRENT_TIMESTAMP);
  RETURN QUERY SELECT 'GRANTED'::text, v_lease, NULL::uuid;
END$$;

-- Return a lease. Only the exact holder's lease is removed, so a late return from a request whose expired lease was
-- superseded can never release the newer holder's.
CREATE FUNCTION shared_private.end_shared_qandeel_reply_work_v1(p_human_command_id uuid, p_lease_id uuid)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM shared_private.shared_qandeel_reply_work_leases l
   WHERE l.human_command_id = p_human_command_id AND l.lease_id = p_lease_id;
  RETURN FOUND;
END$$;

CREATE FUNCTION shared_private.complete_shared_world_qandeel_reply_v1(
  p_lease_id uuid, p_human_command_id uuid, p_world_id uuid, p_body_text text,
  p_effective_context_ref text, p_output_digest text, p_source_disclosure_gate_ref text,
  p_authority_revalidation_ref text, p_readiness_ref text, p_audience_snapshot_ref text,
  p_material_source_ids uuid[], p_reasoning_source_refs text[]
) RETURNS TABLE (outcome text, material_id uuid, established_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_human public.shared_world_material_commit_commands;
  v_reply_command uuid;
  v_material uuid;
  v_item uuid;
  v_committed public.shared_world_material_commit_commands;
  v_gate record;
  v_result record;
BEGIN
  IF p_lease_id IS NULL OR p_human_command_id IS NULL OR p_world_id IS NULL OR p_body_text IS NULL
     OR length(btrim(p_body_text)) = 0 THEN
    RAISE EXCEPTION 'SHARED_QANDEEL_REPLY_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_reply_command := shared_private.derive_shared_conversation_identity_v1('QANDEEL_REPLY_COMMAND', p_human_command_id);
  v_material := shared_private.derive_shared_conversation_identity_v1('QANDEEL_REPLY_MATERIAL', p_human_command_id);
  v_item := shared_private.derive_shared_conversation_identity_v1('QANDEEL_REPLY_HISTORY_ITEM', p_human_command_id);

  -- At most one reply per logical human request: an already committed reply is the answer, whatever is offered now.
  SELECT * INTO v_committed FROM public.shared_world_material_commit_commands c WHERE c.id = v_reply_command;
  IF FOUND THEN
    PERFORM shared_private.end_shared_qandeel_reply_work_v1(p_human_command_id, p_lease_id);
    RETURN QUERY SELECT 'MATERIAL_COMMITTED'::text, v_committed.material_id, v_committed.committed_at;
    RETURN;
  END IF;

  -- LOCK ORDER STEP 0: the current conversation-capability snapshot, FOR SHARE until this transaction ends.
  SELECT * INTO v_gate FROM shared_private.bind_shared_launch_gate_v1('SHARED_CONVERSATION');
  IF v_gate.verdict <> 'ALLOW' THEN
    PERFORM shared_private.end_shared_qandeel_reply_work_v1(p_human_command_id, p_lease_id);
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  -- Only the holder of this command's CURRENT lease commits. The lease row is locked, so no concurrent begin can
  -- replace it underneath this commit.
  PERFORM 1 FROM shared_private.shared_qandeel_reply_work_leases l
   WHERE l.human_command_id = p_human_command_id AND l.lease_id = p_lease_id AND l.world_id = p_world_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  -- A human request initiated this generation: a HUMAN_TEXT command committed by a human into this exact World.
  SELECT * INTO v_human FROM public.shared_world_material_commit_commands c WHERE c.id = p_human_command_id;
  IF NOT FOUND OR v_human.world_id <> p_world_id OR v_human.producer_kind <> 'HUMAN'
     OR v_human.material_kind <> 'HUMAN_TEXT' THEN
    PERFORM shared_private.end_shared_qandeel_reply_work_v1(p_human_command_id, p_lease_id);
    RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  BEGIN
    SELECT c.committed_material_id, c.material_established_at INTO v_result
      FROM public.commit_shared_world_qandeel_material_v1(
             v_reply_command, p_world_id, v_material, v_item, 'QANDEEL_OUTPUT', p_body_text,
             p_effective_context_ref, p_output_digest, p_source_disclosure_gate_ref,
             p_authority_revalidation_ref, p_readiness_ref, p_audience_snapshot_ref,
             coalesce(p_material_source_ids, ARRAY[]::uuid[]), coalesce(p_reasoning_source_refs, ARRAY[]::text[])) c;
  EXCEPTION
    WHEN no_data_found THEN
      PERFORM shared_private.end_shared_qandeel_reply_work_v1(p_human_command_id, p_lease_id);
      RETURN QUERY SELECT 'UNAVAILABLE'::text, NULL::uuid, NULL::timestamptz;
      RETURN;
    WHEN serialization_failure THEN
      -- SHARED_WORLD_MATERIAL_STALE: the audience, the World or a source moved since the evidence was produced.
      PERFORM shared_private.end_shared_qandeel_reply_work_v1(p_human_command_id, p_lease_id);
      RETURN QUERY SELECT 'STALE'::text, NULL::uuid, NULL::timestamptz;
      RETURN;
  END;

  PERFORM shared_private.end_shared_qandeel_reply_work_v1(p_human_command_id, p_lease_id);
  RETURN QUERY SELECT 'MATERIAL_COMMITTED'::text, v_result.committed_material_id, v_result.material_established_at;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. Owner deletion. Outcomes: DELETED (now, or already under this command) | UNAVAILABLE (not this human's own
--    material, QANDEEL material, another World's material, already deleted, no such material — one answer). The
--    frozen primitive derives the deleting human from auth.uid(), permits ACTIVE and READ_ONLY_CLOSED, reopens
--    nothing and never consults membership (a former member keeps this authority; S4-02 exposes it for current
--    members, S4-03 owns the former-member surface). Not bound to the conversation gate: a privacy mutation.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION shared_private.delete_own_shared_world_material_v1(p_command_id uuid, p_world_id uuid, p_material_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_event uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SHARED_AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_world_id IS NULL OR p_material_id IS NULL THEN
    RAISE EXCEPTION 'SHARED_MATERIAL_DELETE_COMMAND_INVALID' USING ERRCODE = '22023';
  END IF;
  v_event := shared_private.derive_shared_conversation_identity_v1('MATERIAL_DELETED_EVENT', p_command_id);
  BEGIN
    PERFORM 1 FROM public.delete_shared_world_owned_material_v1(p_command_id, p_world_id, p_material_id, v_event);
  EXCEPTION
    WHEN no_data_found THEN
      RETURN QUERY SELECT 'UNAVAILABLE'::text;
      RETURN;
  END;
  RETURN QUERY SELECT 'DELETED'::text;
END$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. The exposed wrappers: SECURITY INVOKER, each a one-line call into its definer.
-- ---------------------------------------------------------------------------------------------------------------------
CREATE FUNCTION public.read_shared_conversation_capability_v1()
RETURNS TABLE (conversation_available boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT c.conversation_available FROM shared_private.read_shared_conversation_capability_v1() c;
$$;

CREATE FUNCTION public.list_own_shared_world_material_v1(
  p_world_id uuid, p_before_established_at timestamptz, p_before_material_id uuid, p_limit integer
) RETURNS TABLE (material_id uuid, material_kind text, producer_kind text, established_at timestamptz, is_self boolean,
                 author_name text, text_body text, can_delete boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.material_id, r.material_kind, r.producer_kind, r.established_at, r.is_self, r.author_name, r.text_body, r.can_delete
    FROM shared_private.list_own_shared_world_material_v1(p_world_id, p_before_established_at, p_before_material_id, p_limit) r;
$$;

CREATE FUNCTION public.send_shared_world_human_text_v1(p_command_id uuid, p_world_id uuid, p_content text)
RETURNS TABLE (outcome text, material_id uuid, established_at timestamptz, qandeel_reply_material_id uuid)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.material_id, r.established_at, r.qandeel_reply_material_id
    FROM shared_private.send_shared_world_human_text_v1(p_command_id, p_world_id, p_content) r;
$$;

CREATE FUNCTION public.begin_shared_qandeel_reply_work_v1(p_human_command_id uuid, p_world_id uuid, p_requester_user_id uuid)
RETURNS TABLE (work_outcome text, work_lease_id uuid, reply_material_id uuid)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.work_outcome, r.work_lease_id, r.reply_material_id
    FROM shared_private.begin_shared_qandeel_reply_work_v1(p_human_command_id, p_world_id, p_requester_user_id) r;
$$;

CREATE FUNCTION public.end_shared_qandeel_reply_work_v1(p_human_command_id uuid, p_lease_id uuid)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT shared_private.end_shared_qandeel_reply_work_v1(p_human_command_id, p_lease_id);
$$;

CREATE FUNCTION public.complete_shared_world_qandeel_reply_v1(
  p_lease_id uuid, p_human_command_id uuid, p_world_id uuid, p_body_text text,
  p_effective_context_ref text, p_output_digest text, p_source_disclosure_gate_ref text,
  p_authority_revalidation_ref text, p_readiness_ref text, p_audience_snapshot_ref text,
  p_material_source_ids uuid[], p_reasoning_source_refs text[]
) RETURNS TABLE (outcome text, material_id uuid, established_at timestamptz)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome, r.material_id, r.established_at
    FROM shared_private.complete_shared_world_qandeel_reply_v1(p_lease_id, p_human_command_id, p_world_id, p_body_text,
           p_effective_context_ref, p_output_digest, p_source_disclosure_gate_ref, p_authority_revalidation_ref,
           p_readiness_ref, p_audience_snapshot_ref, p_material_source_ids, p_reasoning_source_refs) r;
$$;

CREATE FUNCTION public.delete_own_shared_world_material_v1(p_command_id uuid, p_world_id uuid, p_material_id uuid)
RETURNS TABLE (outcome text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.outcome FROM shared_private.delete_own_shared_world_material_v1(p_command_id, p_world_id, p_material_id) r;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 9. Privileges. Ownership; default-deny by name; then the exact grants.
-- ---------------------------------------------------------------------------------------------------------------------
ALTER FUNCTION shared_private.derive_shared_conversation_identity_v1(text, uuid) OWNER TO postgres;
ALTER FUNCTION shared_private.read_shared_conversation_capability_v1() OWNER TO postgres;
ALTER FUNCTION shared_private.list_own_shared_world_material_v1(uuid, timestamptz, uuid, integer) OWNER TO postgres;
ALTER FUNCTION shared_private.send_shared_world_human_text_v1(uuid, uuid, text) OWNER TO postgres;
ALTER FUNCTION shared_private.shared_qandeel_reply_work_policy_v1() OWNER TO postgres;
ALTER FUNCTION shared_private.begin_shared_qandeel_reply_work_v1(uuid, uuid, uuid) OWNER TO postgres;
ALTER FUNCTION shared_private.end_shared_qandeel_reply_work_v1(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION shared_private.complete_shared_world_qandeel_reply_v1(uuid, uuid, uuid, text, text, text, text, text, text, text, uuid[], text[]) OWNER TO postgres;
ALTER FUNCTION shared_private.delete_own_shared_world_material_v1(uuid, uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.read_shared_conversation_capability_v1() OWNER TO postgres;
ALTER FUNCTION public.list_own_shared_world_material_v1(uuid, timestamptz, uuid, integer) OWNER TO postgres;
ALTER FUNCTION public.send_shared_world_human_text_v1(uuid, uuid, text) OWNER TO postgres;
ALTER FUNCTION public.begin_shared_qandeel_reply_work_v1(uuid, uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.end_shared_qandeel_reply_work_v1(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.complete_shared_world_qandeel_reply_v1(uuid, uuid, uuid, text, text, text, text, text, text, text, uuid[], text[]) OWNER TO postgres;
ALTER FUNCTION public.delete_own_shared_world_material_v1(uuid, uuid, uuid) OWNER TO postgres;
ALTER TABLE shared_private.shared_qandeel_reply_work_leases OWNER TO postgres;
ALTER TABLE shared_private.shared_qandeel_reply_work_grants OWNER TO postgres;

REVOKE ALL ON TABLE shared_private.shared_qandeel_reply_work_leases, shared_private.shared_qandeel_reply_work_grants
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE shared_private.shared_qandeel_reply_work_grants_id_seq FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
  shared_private.derive_shared_conversation_identity_v1(text, uuid),
  shared_private.read_shared_conversation_capability_v1(),
  shared_private.list_own_shared_world_material_v1(uuid, timestamptz, uuid, integer),
  shared_private.send_shared_world_human_text_v1(uuid, uuid, text),
  shared_private.shared_qandeel_reply_work_policy_v1(),
  shared_private.begin_shared_qandeel_reply_work_v1(uuid, uuid, uuid),
  shared_private.end_shared_qandeel_reply_work_v1(uuid, uuid),
  shared_private.complete_shared_world_qandeel_reply_v1(uuid, uuid, uuid, text, text, text, text, text, text, text, uuid[], text[]),
  shared_private.delete_own_shared_world_material_v1(uuid, uuid, uuid),
  public.read_shared_conversation_capability_v1(),
  public.list_own_shared_world_material_v1(uuid, timestamptz, uuid, integer),
  public.send_shared_world_human_text_v1(uuid, uuid, text),
  public.begin_shared_qandeel_reply_work_v1(uuid, uuid, uuid),
  public.end_shared_qandeel_reply_work_v1(uuid, uuid),
  public.complete_shared_world_qandeel_reply_v1(uuid, uuid, uuid, text, text, text, text, text, text, text, uuid[], text[]),
  public.delete_own_shared_world_material_v1(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;

DO $$BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
  EXECUTE 'REVOKE ALL ON TABLE shared_private.shared_qandeel_reply_work_leases, shared_private.shared_qandeel_reply_work_grants FROM service_role';
  EXECUTE 'REVOKE ALL ON SEQUENCE shared_private.shared_qandeel_reply_work_grants_id_seq FROM service_role';
  EXECUTE 'REVOKE ALL ON FUNCTION shared_private.derive_shared_conversation_identity_v1(text, uuid), shared_private.read_shared_conversation_capability_v1(), shared_private.list_own_shared_world_material_v1(uuid, timestamptz, uuid, integer), shared_private.send_shared_world_human_text_v1(uuid, uuid, text), shared_private.shared_qandeel_reply_work_policy_v1(), shared_private.begin_shared_qandeel_reply_work_v1(uuid, uuid, uuid), shared_private.end_shared_qandeel_reply_work_v1(uuid, uuid), shared_private.complete_shared_world_qandeel_reply_v1(uuid, uuid, uuid, text, text, text, text, text, text, text, uuid[], text[]), shared_private.delete_own_shared_world_material_v1(uuid, uuid, uuid), public.read_shared_conversation_capability_v1(), public.list_own_shared_world_material_v1(uuid, timestamptz, uuid, integer), public.send_shared_world_human_text_v1(uuid, uuid, text), public.begin_shared_qandeel_reply_work_v1(uuid, uuid, uuid), public.end_shared_qandeel_reply_work_v1(uuid, uuid), public.complete_shared_world_qandeel_reply_v1(uuid, uuid, uuid, text, text, text, text, text, text, text, uuid[], text[]), public.delete_own_shared_world_material_v1(uuid, uuid, uuid) FROM service_role';
  -- THE SERVER'S ACTS. QANDEEL's reply is generated and committed by the server, never under a human's token: the
  -- server channel gains USAGE on the private schema (no table privilege travels with it) and EXECUTE on exactly the
  -- three reply-work commands — begin the lease, complete under it, return it.
  EXECUTE 'GRANT USAGE ON SCHEMA shared_private TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION shared_private.begin_shared_qandeel_reply_work_v1(uuid, uuid, uuid), shared_private.end_shared_qandeel_reply_work_v1(uuid, uuid), shared_private.complete_shared_world_qandeel_reply_v1(uuid, uuid, uuid, text, text, text, text, text, text, text, uuid[], text[]), public.begin_shared_qandeel_reply_work_v1(uuid, uuid, uuid), public.end_shared_qandeel_reply_work_v1(uuid, uuid), public.complete_shared_world_qandeel_reply_v1(uuid, uuid, uuid, text, text, text, text, text, text, text, uuid[], text[]) TO service_role';
END IF; END$$;

-- The human's four acts, on the human's own token (USAGE on shared_private was granted to authenticated by 0138).
GRANT EXECUTE ON FUNCTION
  shared_private.read_shared_conversation_capability_v1(),
  shared_private.list_own_shared_world_material_v1(uuid, timestamptz, uuid, integer),
  shared_private.send_shared_world_human_text_v1(uuid, uuid, text),
  shared_private.delete_own_shared_world_material_v1(uuid, uuid, uuid),
  public.read_shared_conversation_capability_v1(),
  public.list_own_shared_world_material_v1(uuid, timestamptz, uuid, integer),
  public.send_shared_world_human_text_v1(uuid, uuid, text),
  public.delete_own_shared_world_material_v1(uuid, uuid, uuid)
  TO authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 10. Deploy-time self-assertions: refuse a client-callable frozen primitive, a client-callable QANDEEL command, a
--     server-callable human command, a table reachable by any application role, a pre-opened gate, an unpinned
--     definer, a human command that does not derive its human, or a reply commit that is not bound to its lease.
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  r text;
  fn text;
  t text;
  p record;
  own_definers constant text[] := ARRAY['derive_shared_conversation_identity_v1', 'read_shared_conversation_capability_v1',
    'list_own_shared_world_material_v1', 'send_shared_world_human_text_v1', 'shared_qandeel_reply_work_policy_v1',
    'begin_shared_qandeel_reply_work_v1', 'end_shared_qandeel_reply_work_v1', 'complete_shared_world_qandeel_reply_v1',
    'delete_own_shared_world_material_v1'];
  server_commands constant text[] := ARRAY['begin_shared_qandeel_reply_work_v1', 'end_shared_qandeel_reply_work_v1',
    'complete_shared_world_qandeel_reply_v1'];
BEGIN
  -- The frozen 0090 primitives, the 0138 operator / bare gate and the S4-02 internals stay executable by no
  -- application role.
  FOREACH fn IN ARRAY ARRAY['public.commit_shared_world_human_material_v1(uuid,uuid,uuid,uuid,text,text,text,text,integer)',
                            'public.commit_shared_world_human_text_v1(uuid,uuid,uuid,uuid,text)',
                            'public.commit_shared_world_human_voice_note_v1(uuid,uuid,uuid,uuid,text,text,integer)',
                            'public.commit_shared_world_qandeel_material_v1(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,uuid[],text[])',
                            'public.delete_shared_world_owned_material_v1(uuid,uuid,uuid,uuid)',
                            'shared_private.set_shared_launch_capability_v1(text,text,text,text,text)',
                            'shared_private.bind_shared_launch_gate_v1(text)',
                            'shared_private.derive_shared_conversation_identity_v1(text,uuid)',
                            'shared_private.shared_qandeel_reply_work_policy_v1()'] LOOP
    IF has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S4-02: PUBLIC can execute %', fn;
    END IF;
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r) AND has_function_privilege(r, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'S4-02: % can execute % — it is reachable only through the reviewed server-owned wrappers', r, fn;
      END IF;
    END LOOP;
  END LOOP;

  -- The human commands are the human's (authenticated only); the reply-work commands are the server's (service_role only).
  FOREACH fn IN ARRAY ARRAY['shared_private.send_shared_world_human_text_v1(uuid,uuid,text)',
                            'shared_private.delete_own_shared_world_material_v1(uuid,uuid,uuid)',
                            'shared_private.list_own_shared_world_material_v1(uuid,timestamptz,uuid,integer)',
                            'public.send_shared_world_human_text_v1(uuid,uuid,text)',
                            'public.delete_own_shared_world_material_v1(uuid,uuid,uuid)',
                            'public.list_own_shared_world_material_v1(uuid,timestamptz,uuid,integer)'] LOOP
    IF NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S4-02: authenticated must execute %', fn;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = 'service_role') AND has_function_privilege('service_role', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S4-02: the server channel must not act as a human through %', fn;
    END IF;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY['shared_private.begin_shared_qandeel_reply_work_v1(uuid,uuid,uuid)',
                            'shared_private.end_shared_qandeel_reply_work_v1(uuid,uuid)',
                            'shared_private.complete_shared_world_qandeel_reply_v1(uuid,uuid,uuid,text,text,text,text,text,text,text,uuid[],text[])',
                            'public.begin_shared_qandeel_reply_work_v1(uuid,uuid,uuid)',
                            'public.end_shared_qandeel_reply_work_v1(uuid,uuid)',
                            'public.complete_shared_world_qandeel_reply_v1(uuid,uuid,uuid,text,text,text,text,text,text,text,uuid[],text[])'] LOOP
    IF has_function_privilege('authenticated', fn, 'EXECUTE') OR has_function_privilege('anon', fn, 'EXECUTE')
       OR has_function_privilege('public', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'S4-02: a client must never start, end or commit QANDEEL work through %', fn;
    END IF;
  END LOOP;

  -- No application role reaches a shared_private table; the server channel executes nothing in shared_private but
  -- the three reply-work commands.
  FOREACH t IN ARRAY ARRAY['shared_private.shared_id_sealed_values', 'shared_private.shared_launch_capability_states',
                           'shared_private.shared_launch_capability_events', 'shared_private.shared_direct_birth_launch_evidence',
                           'shared_private.shared_direct_invitation_decline_commands',
                           'shared_private.shared_qandeel_reply_work_leases', 'shared_private.shared_qandeel_reply_work_grants'] LOOP
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r)
         AND has_table_privilege(r, t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') THEN
        RAISE EXCEPTION 'S4-02: % can reach %', r, t;
      END IF;
    END LOOP;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = 'service_role') THEN
    FOR p IN SELECT pr.oid, pr.proname FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
              WHERE n.nspname = 'shared_private' AND NOT (pr.proname = ANY(server_commands)) LOOP
      IF has_function_privilege('service_role', p.oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'S4-02: service_role can execute shared_private.%', p.proname;
      END IF;
    END LOOP;
  END IF;

  -- Every S4-02 definer pins an empty search_path; every human command derives the human from auth.uid(); the server's
  -- commands and the internal helpers name no human token at all; none is anonymous.
  FOR p IN SELECT pr.proname, pr.oid, pr.prosecdef, pr.proconfig, pr.prosrc
             FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
            WHERE n.nspname = 'shared_private' AND pr.proname = ANY(own_definers) AND pr.proname <> 'shared_qandeel_reply_work_policy_v1' LOOP
    IF NOT p.prosecdef THEN RAISE EXCEPTION 'S4-02: shared_private.% must be SECURITY DEFINER', p.proname; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg IN ('search_path=', 'search_path=""')) THEN
      RAISE EXCEPTION 'S4-02: shared_private.% must pin an empty search_path', p.proname;
    END IF;
    IF p.proname IN ('read_shared_conversation_capability_v1', 'list_own_shared_world_material_v1',
                     'send_shared_world_human_text_v1', 'delete_own_shared_world_material_v1')
       AND p.prosrc !~ 'auth\.uid\(\)' THEN
      RAISE EXCEPTION 'S4-02: shared_private.% must derive the human from auth.uid()', p.proname;
    END IF;
    IF (p.proname = ANY(server_commands) OR p.proname = 'derive_shared_conversation_identity_v1') AND p.prosrc ~ 'auth\.uid' THEN
      RAISE EXCEPTION 'S4-02: QANDEEL is a system actor: shared_private.% names no human token', p.proname;
    END IF;
    IF has_function_privilege('anon', p.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'S4-02: anon can execute shared_private.%', p.proname;
    END IF;
  END LOOP;

  -- Human text binds the gate BEFORE the frozen commit; the reply work binds the gate before it grants any lease; the
  -- reply commit binds the gate, then holds its lease, then commits exactly QANDEEL_OUTPUT through the frozen core;
  -- owner deletion binds no ordinary gate at all.
  SELECT pr.prosrc INTO t FROM pg_proc pr WHERE pr.oid = 'shared_private.send_shared_world_human_text_v1(uuid,uuid,text)'::regprocedure;
  IF strpos(t, 'bind_shared_launch_gate_v1(''SHARED_CONVERSATION'')') = 0
     OR strpos(t, 'bind_shared_launch_gate_v1(''SHARED_CONVERSATION'')') > strpos(t, 'public.commit_shared_world_human_text_v1(') THEN
    RAISE EXCEPTION 'S4-02: human text must bind the conversation gate, then invoke the frozen commit';
  END IF;
  SELECT pr.prosrc INTO t FROM pg_proc pr WHERE pr.oid = 'shared_private.begin_shared_qandeel_reply_work_v1(uuid,uuid,uuid)'::regprocedure;
  IF strpos(t, 'bind_shared_launch_gate_v1(''SHARED_CONVERSATION'')') = 0
     OR strpos(t, 'bind_shared_launch_gate_v1(''SHARED_CONVERSATION'')') > strpos(t, 'pg_advisory_xact_lock(')
     OR strpos(t, 'pg_advisory_xact_lock(') > strpos(t, 'INSERT INTO shared_private.shared_qandeel_reply_work_leases')
     OR strpos(t, 'foreground_generation_lease_interval_v1()') = 0 THEN
    RAISE EXCEPTION 'S4-02: reply work must bind the conversation gate, then the requester lock, then grant a bounded lease';
  END IF;
  SELECT pr.prosrc INTO t FROM pg_proc pr WHERE pr.oid = 'shared_private.complete_shared_world_qandeel_reply_v1(uuid,uuid,uuid,text,text,text,text,text,text,text,uuid[],text[])'::regprocedure;
  IF strpos(t, 'bind_shared_launch_gate_v1(''SHARED_CONVERSATION'')') = 0
     OR strpos(t, 'bind_shared_launch_gate_v1(''SHARED_CONVERSATION'')') > strpos(t, 'l.lease_id = p_lease_id')
     OR strpos(t, 'l.lease_id = p_lease_id') > strpos(t, 'public.commit_shared_world_qandeel_material_v1(')
     OR t !~ '''QANDEEL_OUTPUT'', p_body_text' THEN
    RAISE EXCEPTION 'S4-02: the QANDEEL reply must bind the conversation gate, hold its lease, then commit exactly QANDEEL_OUTPUT through the frozen core';
  END IF;
  SELECT pr.prosrc INTO t FROM pg_proc pr WHERE pr.oid = 'shared_private.delete_own_shared_world_material_v1(uuid,uuid,uuid)'::regprocedure;
  IF t ~ 'bind_shared_launch_gate_v1' THEN
    RAISE EXCEPTION 'S4-02: owner deletion is a privacy mutation and is never bound to the ordinary conversation gate';
  END IF;

  -- No capability is opened by a migration; the widened CHECK carries exactly the three scopes.
  IF EXISTS (SELECT 1 FROM shared_private.shared_launch_capability_states WHERE capability_scope = 'SHARED_CONVERSATION') THEN
    RAISE EXCEPTION 'S4-02: a migration configures no launch capability; the conversation scope starts closed';
  END IF;
  SELECT pg_get_constraintdef(c.oid) INTO t FROM pg_constraint c
   WHERE c.conrelid = 'shared_private.shared_launch_capability_states'::regclass AND c.conname = 'shared_launch_capability_states_scope_check';
  IF t IS NULL OR t !~ 'SHARED_DIRECT_INVITATION' OR t !~ 'SHARED_DIRECT_WORLD_BIRTH' OR t !~ 'SHARED_CONVERSATION' THEN
    RAISE EXCEPTION 'S4-02: the gate scope CHECK must carry the two 0138 scopes and the one S4-02 scope';
  END IF;
END$$;

COMMIT;
