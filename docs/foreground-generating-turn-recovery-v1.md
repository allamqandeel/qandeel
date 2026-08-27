# Foreground GENERATING Turn Recovery v1

Reliability Correction 1 of the bounded post-review Reliability Correction
Pass (the first forward change after the independent System-Wide Architecture
Review; Phase II — Intelligence Runtime Completion remains closed). Forward
migration: `0039_foreground_generating_turn_recovery_v1.sql`. Migrations
`0001`–`0038` are byte-unchanged.

## Source finding and failure mode

Both independent reviews (Codex and Claude Code) confirmed the same foreground
liveness defect: after the atomic `RECEIVED → GENERATING` claim, a process
crash leaves the canonical USER turn `GENERATING` forever. The orchestrator's
in-process error handling (`catch` → `fail_conversation_turn`) cannot run
after a crash — a JavaScript catch block does not survive process death.
`claim_conversation_turn` accepts only a `RECEIVED` USER turn, so an
idempotent replay finds the same nonterminal turn, cannot claim it again, and
returns it with no assistant, indefinitely. The only escape was explicit
client cancellation.

## Why blind provider replay is forbidden

If the process died while a foreground provider call may already have
succeeded, QANDEEL cannot know whether the external model was reached.
Automatically re-running the same foreground generation would risk a
duplicate external model call and a different response bound to the same
canonical turn. The v1 safety rule is therefore deliberate:

```text
uncertain crashed foreground generation
→ wait until lease expiry
→ canonical FAILED
→ no replay
```

Recovery never calls a model, never returns provider content, and never
resumes a half-completed generation. This task also deliberately does NOT
build a durable foreground provider invocation/result ledger, provider
idempotency keys, or a foreground job queue — that is a different
architecture problem.

## The server-owned generation lease

`conversation_turns` gains two server-owned columns:

```text
generation_claimed_at       timestamptz NULL
generation_lease_expires_at timestamptz NULL
```

A bounded pair-integrity constraint requires both NULL or both set with
`generation_lease_expires_at > generation_claimed_at`. The fields are runtime
authority metadata, never user input: no client mutation path exists, they are
not part of any client payload, and the ordinary application `TURN_FIELDS`
projection does not expose them.

The v1 lease is frozen at **120 seconds**, defined once in
`public.foreground_generation_lease_interval_v1()`. There is no environment
override, request field, JWT field, user-configurable value, or
provider-specific duration: the lease is canonical foreground state-machine
policy, not provider authority, and application code never carries the value.

On the one successful atomic `RECEIVED → GENERATING` claim (same external
`claim_conversation_turn` signature, same service-role-only authority, same
ownership/role/state validation, same exact FAST/DEEP routing-reason
contract, one claimant wins), the database stamps:

```text
generation_claimed_at       = CURRENT_TIMESTAMP
generation_lease_expires_at = CURRENT_TIMESTAMP + 120 seconds
```

No claim token exists; this correction never reclaims execution.

## Expired generation is terminalized, never regenerated

`recover_expired_generating_conversation_turn_v1(p_session_id, p_user_id,
p_source_turn_id, p_event_id, p_correlation_id, p_orchestration_id)` is the
single narrow service-role-only recovery command. It validates the non-null
user and explicit session ownership, locks the exact owner-scoped
`GENERATING` USER source turn `FOR UPDATE`, and computes the authoritative
expiry: the stored lease when present, or the bounded legacy fallback
`updated_at + 120 seconds` for null-lease rows (historical rows and
verifier-created fixtures stay representable and fail-closed — a fresh
null-lease row still gets its full window).

- Not expired → zero rows, zero mutation.
- Expired → exactly `GENERATING → FAILED`; no assistant turn is created; the
  idempotency key is unchanged and stays bound to the failed turn;
  `completed_at` keeps canonical `fail_conversation_turn` semantics (NULL for
  FAILED); bounded claim metadata is preserved (or set for legacy rows) so
  the terminal record stays coherent; and the existing canonical content-free
  `ConversationTurnFailed` v1 outbox event
  (`qandeel.runtime.conversation-turn-failed.v1`, event version `1.0`, exact
  existing payload keys) is inserted in the SAME transaction.

A genuinely new user attempt after this terminal failure is a NEW turn / NEW
idempotency admission through the existing product API. Recovery never
manufactures that retry, never creates a replacement USER or ASSISTANT turn,
and never moves any turn back to `RECEIVED`.

## Race behavior (database state is authoritative)

Race safety is the database row lock plus each command's current-state
predicate — no application-level locking exists:

- Original finalize/fail/cancel commits first → recovery finds no
  `GENERATING` row and is a no-op.
- Recovery commits first → a late `finalize_conversation_turn` /
  `fail_conversation_turn` no longer matches its `GENERATING` predicate and
  mutates nothing.

There can never be both a recovered FAILED source turn and a late assistant
completion for the same source turn, and never duplicate terminal recovery
outbox events (structurally reinforced by the outbox
`UNIQUE(event_type, subject_turn_id)` constraint).

## Deployment backfill

Migration 0039 initializes a lease only for pre-existing `GENERATING` rows
with no lease metadata: `generation_claimed_at = updated_at` and
`generation_lease_expires_at = greatest(updated_at + 120s,
CURRENT_TIMESTAMP + 120s)`, so an in-flight turn cannot expire merely because
the migration deployed, while bounded historical claim information is
retained. Rows not in `GENERATING` are never fabricated as active leases.

## Application integration

No new controller endpoint and no client-side cancellation requirement. The
existing idempotent `createTurn` replay path is the bounded recovery trigger:

- `ConversationRepository.recoverExpiredGeneratingTurn(...)` uses only the
  explicit `SupabaseServiceRoleApiService` channel, calls only the recovery
  command, and supplies server-generated event/correlation/orchestration
  metadata through the existing `eventMetadata()` pattern. No user access
  token reaches the recovery RPC.
- `ConversationOrchestratorService.orchestrate` checks an existing
  `GENERATING` replay exactly once against bounded recovery BEFORE any
  Context/Safety/HIM/Memory/Hypothesis/Recommendation/model work, with zero
  downstream calls, zero `ModelRouter.generate` calls, and no re-claim: a
  live lease returns the in-progress canonical state; an expired lease
  returns the canonical FAILED user turn with no assistant.
- A claim-lost race (`RECEIVED` object, claim returns no row) rereads the
  canonical turn and applies the same bounded check; the loser never starts
  another provider call.
- Terminal replays stay idempotent and perform no recovery RPC; FAST/DEEP
  selection for freshly `RECEIVED` turns is unchanged.

## Authority / ACL

- Recovery: `service_role` EXECUTE only; `anon`/`authenticated`/PUBLIC hold
  nothing. `SECURITY DEFINER`, empty `search_path`, `postgres` owner.
- `claim_conversation_turn` keeps its migration-0025 service-role-only
  authority, explicitly restored and re-asserted after `CREATE OR REPLACE`.
- The lease constant function is internal (no application role can execute
  it).
- No role gains direct `conversation_turns` DML; ownership forgery of another
  user's session/turn fails closed.

## What does not change

Zero intelligence-semantics changes: one successful foreground turn still
makes exactly one conversational ModelRouter call; Safety BLOCK still makes
zero model calls; the foreground HIM/Memory/Hypothesis/Recommendation order,
Recommendation coverage-only grounding, background intelligence, Redis
streams/consumers, the Runtime Event Failed v1 schema, and the A2 runtime
smoke are untouched. No new provider or model exists, and no raw user content
enters logs, telemetry, or the outbox.

## Verification

- `database/verify-migration-0039.mjs`
  (`npm run verify:foreground-generating-turn-recovery:integration`) proves
  the semantics against real PostgreSQL 17: exact 120-second lease on claim,
  live-lease no-op, expired terminalization with exactly one canonical
  content-free failed event and no assistant, idempotent re-recovery, late
  finalize/fail no-ops, terminal/cross-tenant/no-op matrices, legacy
  null-lease fallback, runtime ACL, and a real two-connection row-lock race
  converging on one FAILED transition with one event.
- `database/tests/foreground-generating-turn-recovery-v1.test.mjs` is the
  fail-closed static source contract (migration shape, exact signature,
  service-role-only ACL, single frozen lease constant, unchanged event
  vocabulary, no model/provider concept in executable SQL, CI wiring).
- Orchestrator/service/repository unit specs freeze the bounded replay
  behavior in the application.
- CI runs the new verifier after the conversation authority and session
  authority verifiers and before the downstream intelligence gates.

## Correction register

This is correction 1 of the bounded post-review Reliability Correction Pass.
The next, separate correction is **Runtime Event Publisher Startup Recovery**
(explicitly out of scope here).
