# Durable Authorized Association Command Persistence v1

Migration 0026 gives the existing `ASSOCIATION_PROVIDER` post-response effect a typed durable result on the same effect ledger, exactly as migration 0024 did for `MEMORY_WRITE`. Before this change the effect completed through the generic result-less completion function and stored nothing, so a crash after a successful authorization left no durable record of the authorized command batch — and both provider replay and reconstruction from later canonical state are forbidden. A2.3a closes only that durability gap. It persists and recovers; it performs no Hypothesis mutation, no Confidence evaluation, and invokes no provider on recovery.

## Durable result contract

A successful `ASSOCIATION_PROVIDER` completion persists exactly one of two result codes:

- `NO_ASSOCIATION` — the authority found no eligible association. No `result_reference`, no `result_commands`.
- `AUTHORIZED_COMMANDS` — the authority authorized a batch. The exact canonical authorized `HypothesisUpdateRequest[]` is stored verbatim in `result_commands`; no `result_reference`.

The authorized batch is bounded and structurally validated by an `IMMUTABLE` SQL validator (`post_response_association_commands_valid`) used both by the table `CHECK` and by the completion RPC, so arbitrary or unbounded JSON can never be stored as authoritative commands. Each command carries exactly `hypothesisId`, `expectedVersion`, `evidenceId`, `evidenceRole`; the batch holds 1–4 commands, all referencing a single `memory:<uuid>` fresh Evidence, with distinct `hypothesisId` targets. The raw provider proposal is never authoritative — only the post-authorization result maps into the durable vocabulary (`toDurableAssociationResult`), and any non-success authorization (including `NOT_AUTHORIZED`) persists nothing.

## Atomicity and fresh-Evidence binding

Completion is written only through the dedicated service-role RPC `complete_post_response_association_effect_v1`. It validates the code/payload combination first (failing closed on anything malformed), locks the owning execution `FOR UPDATE`, and — for `AUTHORIZED_COMMANDS` — cross-checks that the batch's evidence identity equals the exact `FRESH_EVIDENCE_CREATED` reference recorded on this execution's durable `MEMORY_WRITE` result before writing. The result columns and the `CLAIMED`→`COMPLETED` transition are set in a single `UPDATE`, so completion and result are atomic: a crash before completion leaves the effect `CLAIMED` (indeterminate, fail-closed on redelivery), never half-written. The generic completion function now rejects both `MEMORY_WRITE` and `ASSOCIATION_PROVIDER`, so neither effect can be observably `COMPLETED` without its typed result.

## Deterministic recovery

On redelivery of an already-`COMPLETED` `ASSOCIATION_PROVIDER` effect, `recoverAssociationResult` reads the durable result against the fresh Evidence identity recovered from the durable `MEMORY_WRITE` result:

- `NO_ASSOCIATION` → recovered as no-op; no provider call, no mutation.
- `AUTHORIZED_COMMANDS` with a valid batch bound to that fresh Evidence → the exact commands are recovered without re-inference or provider replay.
- Legacy/null/malformed/contradictory/wrong-evidence results → `INDETERMINATE`, which quarantines (fail-closed). Nothing is invented and the provider is never re-invoked.

`MEMORY_WRITE` recovery semantics are unchanged (`NO_FRESH_EVIDENCE`, or `FRESH_EVIDENCE_CREATED` + `memory:<uuid>`).

## Security

The migration is forward-only and preserves the effect table's RLS. `authenticated` and `anon` gain no write authority over durable effect results — the authoritative result is written only through the server/background service-role completion authority. A2.3a changes no Finding 01 / Finding 02 security boundary and reconstructs no user JWT.

## Out of scope (deferred to A2.3)

A2.3a stops at durable persistence and recovery. It adds no automatic Hypothesis mutation, does not invoke `HypothesisUpdateService`, attaches no Evidence, increments no Hypothesis version, and writes no `hypothesis_updates`. Foreground Hypothesis Update still depends on user-token/`auth.uid()` authority; A2.3 must consume the recovered batch through a dedicated background-authorized adapter rather than reconstructing a user JWT.
