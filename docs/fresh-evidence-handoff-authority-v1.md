# Fresh Evidence Handoff Authority v1

This is the Phase II Track A2 A2.2 prerequisite. Before this boundary, post-finalization Memory processing reported only that a write completed and its type. That boolean-like completion was insufficient for future A2.2 association authority because the Orchestrator could not identify the single canonical Evidence item caused by the current turn without broadly reconsidering the eligible Evidence universe.

## Canonical identity authority

`MemoryWriteService` now returns one of these internal outcomes:

- `SKIP`: reason and optional Memory type, with no Memory or Evidence identity.
- `WRITE`: Memory type, `memoryId`, and `evidenceId`.

For WRITE, `memoryId` is copied only from the actual `MemoryRecord` returned by `MemoryRuntimeService.create`. The Evidence identity is the total mechanical transformation `memory:${record.id}`, matching the existing Evidence projection format. No ID is guessed before persistence and no Evidence query is added to discover it.

Fresh identity is not permanent eligibility authority. Existing Evidence Layer rules still govern owner scope, active status, allowed source/type, expiry, ordering, and deduplication at the point of use. The deterministic Memory writer's active `USER_STATED`, non-derived candidates and stricter exact-duplicate guard remain compatible with that projection.

## Orchestrator handoff and failure behavior

The post-finalization Memory helper now preserves either `COMPLETED` with the bounded SKIP/WRITE result, or `FAILED`. Non-ALLOW Safety behavior remains unchanged and carries no fabricated fresh identity. Memory failure remains fail-soft: it supplies no handoff, does not invalidate the finalized response, and retains the existing rule that generation eligibility does not proceed after failed ALLOW Memory completion.

The new IDs remain internal and are never included in telemetry, errors, logs, or the public conversation response. There are no new provider/model calls, queries, retries, background jobs, tables, or migrations.

## A2.2 boundary

This prerequisite stops at identity/provenance handoff. It does not decide relevance, select a Hypothesis, infer SUPPORTING or CONTRADICTING roles, attach Evidence, invoke the Hypothesis Update Loop, transition lifecycle, recalculate Confidence, create Questions or Information Gaps, or mutate Memory, Evidence, or HIM beyond the existing selective Memory write. Those authorities remain in the future A2.2 integration.
