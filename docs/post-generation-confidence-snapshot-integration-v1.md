# Post-Generation Confidence Snapshot Integration v1

This is Phase II Track A2 Step A2.1, the first bounded Hypothesis Maintenance and Confidence Lifecycle integration. Track A1's automatic Hypothesis Generation and Consumption sequence is complete; broader Track A remains open for separately authorized maintenance boundaries.

## Lifecycle and target authority

The integration runs only after the user-visible response is finalized, Memory completion has passed, and Controlled Hypothesis Generation has completed creation, Evidence attachment, and competitor linking:

`Controlled Generation result → accepted hypotheses (0..5) → ConfidenceService.evaluateHypothesis for each accepted ID`

Only IDs from the current successful `HypothesisGenerationResult.accepted` set are targets. Rejected proposals, pre-existing active hypotheses, failed generation, zero acceptance, NOT_READY, non-eligible, replay, duplicate, and claim-miss paths create no evaluation. The existing generation maximum bounds the pass to at most five sequential evaluations, exactly once per accepted target, with no target-discovery query, retry, queue, or worker pool.

The Orchestrator passes only each accepted ID. `ConfidenceService` re-reads the canonical current Hypothesis and current eligible Evidence before creating the snapshot; it does not trust the possibly stale version returned during generation. This preserves exact-current-version authority after multi-candidate competitor links.

## Confidence semantics and failure isolation

Confidence Runtime semantics remain unchanged. Each successful immutable evaluation has `numeric_score: null`, `confidence_band: null`, `calibration_state: UNCALIBRATED`, and `stability: UNASSESSED`, together with the existing structural Evidence-role, assumption, competitor, missing-information, policy-version, and provenance fields.

Generation and Confidence persistence remain separate operations. A target failure leaves that target without a new snapshot, preserves successful snapshots for other targets, and never rolls back generated Hypotheses, retries either operation, fabricates an evaluation, mutates a Hypothesis, calls `failTurn`, or changes the finalized response. This v1 deliberately has no durable retry or idempotency workflow.

Telemetry records only `skipped_zero_accepted`, `evaluated_all`, `evaluated_partial`, or `evaluated_none`, the processing path, contract version, and bounded accepted/evaluated counts from zero through five. It contains no Hypothesis or evaluation IDs, statements, Evidence, assumptions, competitor IDs, user/session/turn identifiers, provider payloads, or raw errors.

## Explicit boundary

This integration adds zero provider/model calls. It does not change Confidence calibration, scores, bands, missing-information semantics, Hypothesis lifecycle or Evidence roles; invoke Hypothesis Update; create Information Gaps or Questions; mutate Memory, Evidence, or HIM; change Hypothesis Reasoning Consumption, Trigger, Eligibility, Intent, Assembly, Gemini binding, normal Model Router, or FAST/DEEP; add persistence schemas, migrations, jobs, APIs, UI, or Voice.
