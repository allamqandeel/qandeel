# Hypothesis Generation Eligibility Orchestrator Integration v1

## Lifecycle placement

This internal boundary runs only for a freshly claimed authenticated TEXT user turn after its assistant response has been atomically finalized. On the normal `ALLOW` path, the existing fail-soft Memory evaluation/write completes first; the eligibility service then performs the canonical Evidence projection read and invokes the existing deterministic Trigger Classifier. The classifier does not participate in Context assembly, FAST/DEEP routing, provider selection, or the response that was already finalized.

The exact order is: Safety, existing Context/reasoning/routing, one provider response, response finalization, existing Memory evaluation/write, one bounded Evidence projection read, deterministic Trigger Classification, and a non-persisted eligibility result.

## Eligibility contract

The result contains only `status` and a bounded reason code. `ELIGIBLE / TRIGGER_AND_EVIDENCE_AVAILABLE` requires a freshly claimed finalized authenticated USER turn, Safety `ALLOW`, classifier result `TRIGGER`, and at least one currently eligible Evidence item. All other cases are `NOT_ELIGIBLE`, with `NO_TRIGGER`, `AMBIGUOUS_TRIGGER`, `SAFETY_INELIGIBLE`, `NO_ELIGIBLE_EVIDENCE`, `REPLAY_OR_DUPLICATE`, or `EVALUATION_FAILED` as applicable. There is no probability, score, free-text reasoning, persistence, or public API representation.

`GUIDED` and `BLOCK` are Safety-ineligible and short-circuit before Evidence and classification. `NO_TRIGGER` and `AMBIGUOUS` preserve the merged classifier semantics exactly.

## Evidence dependency and query strategy

Evidence remains a derived read model over eligible canonical Memory. Eligibility reuses `EvidenceService.listEligibleForUser`, which performs one bounded active-Memory read capped at 64 candidates and returns at most 64 projected items. The integration checks only whether the validated projection is non-empty. It does not copy Evidence content or IDs into its result, rank/select Evidence, assign roles, add an N+1 query, persist Evidence, or map a conversation turn directly to Evidence.

## Replay, failure authority, and telemetry

The Orchestrator's existing completed-turn early return and atomic claim miss identify replay/duplicate paths. Those paths do not call eligibility and emit only `replay_skipped`; they receive no fresh downstream authority. No new idempotency storage is introduced.

Memory failure prevents the Evidence/classification step. Evidence query failure, malformed or over-bound projection, classifier failure, and unexpected eligibility-hook failure all fail closed and emit `failed`. Because the response is already finalized, these future-facing enrichment failures never fail, rewrite, or duplicate the user-visible result.

Telemetry is fail-soft and low-cardinality. It records only `eligible`, `not_eligible`, `ambiguous`, `safety_ineligible`, `no_evidence`, `replay_skipped`, or `failed`, plus processing path when available and contract version. It contains no user text, classifier input, Memory/Evidence/Hypothesis content or IDs, user/session/turn IDs, provider payload, or free-text reason.

## Separation and v1 limitations

This boundary does not invoke or inject `HypothesisGenerationService`, assemble a generation request, construct a problem, infer domain/scope, select Evidence, assign SUPPORTING/CONTRADICTING roles, or generate/mutate Hypotheses, Confidence, Questions, Information Gaps, Memory, or HIM. It adds no migration, provider behavior, routing behavior, client/API surface, Voice/UI behavior, or background work. V1 computes and immediately discards the bounded internal result; a future separately approved integration would need to define generation authority and request assembly.
