# Durable Memory Effect Result Persistence v1

Migration 0024 adds two nullable, constrained fields to the existing post-response effect ledger. New `MEMORY_WRITE` completions persist either `NO_FRESH_EVIDENCE` with no reference or `FRESH_EVIDENCE_CREATED` with the exact canonical `memory:<uuid>` returned by Memory creation. The result-aware service-role RPC derives the execution user, validates Memory ownership, and writes the bounded result in the same statement and transaction as the `CLAIMED` to `COMPLETED` transition. Generic result-less Memory completion is rejected; the five non-Memory effects retain their existing completion behavior.

Pre-0024 completed Memory rows with null result fields remain valid and explicitly unknown. No historical result is inferred or backfilled. This prerequisite adds no Association runtime wiring, provider invocation/output persistence, Hypothesis or Confidence mutation, user JWT reconstruction, retry change, or additional idempotency store.

## Known A2.3 boundaries

Association authorization commands are currently transient. Before A2.3 mutation consumes them, crash safety must durably preserve an authorized command batch without repeating a completed paid provider effect.

Foreground Hypothesis Update currently depends on user-token/`auth.uid()` authority. A2.3 must use a dedicated background-authorized adapter/RPC rather than reconstructing a user JWT.
