# Hypothesis Update Loop v1

## Architectural position

This internal provider-neutral coordinator follows Question / Information Gap Runtime and adds one deterministic path: an explicit eligible evidence role is attached to an existing owned hypothesis under optimistic concurrency, an immutable bounded trace is written, and Confidence Runtime is asked for a fresh evaluation. It reuses rather than rebuilds Hypothesis Runtime, Evidence Layer, and Confidence Runtime.

## Request and evidence-role boundary

The request contains only `hypothesisId`, positive `expectedVersion`, memory-derived `evidenceId`, and explicit `evidenceRole` (`SUPPORTING` or `CONTRADICTING`). The loop does not infer the role, create Evidence or Memory, read question answers, or assess evidence weight or quality. The canonical database mutation rechecks authenticated ownership and current Evidence eligibility and rejects malformed, duplicate, opposite-role, cross-user, or ineligible links.

Atomicity requires the SQL boundary to mirror the Evidence Layer projection explicitly. It selects the same 64 active/unexpired Memory candidates in `updated_at DESC, id DESC` repository order, applies the same source/type rules, deduplicates by `type + source + NFKC/trim/whitespace-normalized content` with the projection's `updated_at DESC, id ASC` winner order, and caps the resulting set at `MAX_ELIGIBLE_EVIDENCE = 64`. Static and real PostgreSQL tests guard this duplicated invariant against drift.

## Concurrency, mutation, and audit

`apply_hypothesis_evidence_update` locks the owned hypothesis, compares its server-read version with `expectedVersion`, and fails stale requests closed. One transaction appends exactly one role-specific link, increments the hypothesis version exactly once, and inserts a `hypothesis_updates` row whose owner, before/after versions, source, and timestamp are server-derived. Direct authenticated mutation is denied; owner-only RLS reads are allowed. The audit contains UUIDs, role, canonical source, versions, and timestamp only—no rationale, transcript, provider payload, scratchpad, or hidden reasoning.

The mutation changes only the chosen evidence array, `version`, and `updated_at`. It does not change lifecycle, assumptions, scope, competitors, or create/merge/split hypotheses. No evidence-count thresholds or automatic `SUPPORTED`, `MIXED`, `WEAK`, `REJECTED`, `RETIRED`, or `REOPENED` transitions exist.

## Confidence re-evaluation and partial failure

After—not before—the committed mutation, the coordinator calls existing `ConfidenceService.evaluateHypothesis`. Confidence Runtime creates a fresh immutable snapshot of the new current hypothesis version and remains the sole owner of confidence representation and calibration. Previous evaluations are never changed.

The database mutation and Confidence write are separate transactions in the current Data API architecture. If Confidence fails after mutation, the returned result contains the successful canonical update with `confidenceStatus: PENDING_RETRY` and a null evaluation; it never claims evaluation succeeded. V1 adds no workflow engine. A retry is safe only while the updated hypothesis remains at that audit's `after_version`; durable automatic retry/idempotency is an open next contract.

## Boundaries and open decisions

There is no controller, client contract, UI, Conversation Orchestrator, Context Builder, Behavioral Response Policy, Safety response path, Model Router, FAST/DEEP, automatic turn execution, Question/Information Gap mutation, answer ingestion, gap closing, or user-visible output. There are zero provider, embedding, or paid calls and no Human Model/HIM calculation.

Canonical decisions still open include semantic role inference, evidence weights, lifecycle thresholds, automatic assumption invalidation, scope changes, competitor creation, replacement sets, merge/split policy, and durable cross-transaction confidence retry/idempotency. The next gate is **Human Model / HIM Runtime Foundation**.
