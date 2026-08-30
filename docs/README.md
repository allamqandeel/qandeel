# Qandeel Documentation

- [Hypothesis Reasoning Consumption Integration v1](hypothesis-reasoning-consumption-integration-v1.md)
- [Hypothesis Generation Trigger Classification v1](hypothesis-generation-trigger-classification-v1.md)
- [Hypothesis Generation Eligibility Orchestrator Integration v1](hypothesis-generation-eligibility-orchestrator-integration-v1.md)
- [Hypothesis Generation Intent Authority Foundation v1](hypothesis-generation-intent-authority-foundation-v1.md)
- [Hypothesis Intent Extraction Provider Binding v1](hypothesis-intent-extraction-provider-binding-v1.md)
- [Model-Assisted Hypothesis Intent Extraction v1](model-assisted-hypothesis-intent-extraction-v1.md)
- [Hypothesis Generation Request Assembly v1](hypothesis-generation-request-assembly-v1.md)
- [Controlled Hypothesis Candidate Generation Provider Binding v1](controlled-hypothesis-candidate-generation-provider-binding-v1.md)
- [Controlled Hypothesis Generation Invocation v1](controlled-hypothesis-generation-invocation-v1.md)
- [Post-Generation Confidence Snapshot Integration v1](post-generation-confidence-snapshot-integration-v1.md)
- [Fresh Evidence Handoff Authority v1](fresh-evidence-handoff-authority-v1.md)
- [Existing-Hypothesis Fresh-Evidence Association Authority Foundation v1](fresh-evidence-hypothesis-association-authority-foundation-v1.md)
- [Background Intelligence Execution Authority v1](background-intelligence-execution-authority-v1.md)

Implementation-facing Markdown specifications live here.

The original Word documents remain the canonical archive. Markdown files record implementation-facing contracts and reconciliations used by the repository.

## Foundation closure

1. [Foundation Freeze v1](foundation-freeze-v1.md) — **CLOSED / OPERATIONALLY RECONCILED**
2. [Foundation Closure Reconciliation v1](foundation-closure-reconciliation-v1.md) — final documentation-only reconciliation after Operational Hardening

## Human Intelligence Activation closure

- [Human Intelligence Activation Freeze v1](human-intelligence-activation-freeze-v1.md) — **CLOSED / FROZEN** (QHIA-001 → QHIA-015; phase closure is not product completion)

## Integrated Intelligence Runtime & Hardening closure

**QANDEEL — Integrated Intelligence Runtime & Hardening v1 — CLOSED / FROZEN.**

- [Integrated Intelligence Runtime Phase Freeze v1](integrated-intelligence-runtime-phase-freeze-v1.md) — **CLOSED / FROZEN** the phase closure authority (QIR-008; QIR-001 → QIR-008 including QIR-007 Addendum A; historical baseline, obligation reconciliation, frozen constitution, deferrals and change control; QIR closure is not product completion)

Conceptually: **QIR-001..007 + Addendum A = frozen constituent contracts/proof;
QIR-008 = phase closure authority.** The constituent contracts below remain
normative and frozen; each keeps its own registered executable guard.

- [Integrated Intelligence Runtime Contract v1](integrated-intelligence-runtime-contract-v1.md) — **FROZEN / NORMATIVE** phase entry contract (QIR-001; the integration constitution for the whole brain; Provider/LLM selection explicitly deferred)
- [FAST / DEEP Runtime Decision Policy v2](fast-deep-runtime-decision-policy-v2.md) — **FROZEN / NORMATIVE** deterministic, Unicode-aware, provider-neutral routing law (QIR-002; migration 0062; supersedes the input-length-only rule)
- [Bounded Foreground Intelligence Gatherer v1](bounded-foreground-intelligence-gatherer-v1.md) — **FROZEN / NORMATIVE** post-Safety concurrent Memory + Hypothesis foreground acquisition under ONE shared 5000 ms non-HI ceiling, with typed non-interchangeable outcomes and a hard-fail-closed classifier (QIR-003; no migration; QHIA lane frozen and untouched)
- [Integrated Context Budget & Conflict Resolution v1](integrated-context-budget-conflict-resolution-v1.md) — **FROZEN / NORMATIVE** the ONE server-owned, provider-neutral final normalized provider-request assembly boundary: a 128 KiB UTF-8 model-input text ceiling partitioned into isolated 64/16/8/8/24/8 KiB slices with no borrowing, non-truncatable Mandatory Core, an always-present integrated intelligence authority charter, and exactly one conversational provider call (QIR-004; no migration; QIR-003 and QHIA topology untouched)
- [Post-Response Intelligence Scheduler & Provider Budget v1](post-response-intelligence-scheduler-provider-budget-v1.md) — **FROZEN / NORMATIVE** the hard lifecycle provider budget of ONE durable post-response execution: exactly three provider-backed effects (Association, Intent, Candidate), a frozen cap of 3 slots reconstructed from the durable effect ledger, spent only after a successful durable claim, never refunded, never replayed and never reset per delivery/reclaim/process, with at-most-once external provider transport (QIR-005; no migration; QIR-002/QIR-003/QIR-004 and QHIA topology untouched)
- [Question / Information-Gap Closed Loop v1](question-information-gap-closed-loop-v1.md) — **FROZEN / NORMATIVE** the closed Question loop: a total durable automatic Information Gap lifecycle (OPEN/RESOLVED/SUPERSEDED with protected reopen-by-epoch) reconciled ONLY by canonical Hypothesis/Confidence state, one deterministic same-session formal Question opportunity per turn riding the existing ONE conversational provider call inside an atomic 8 KiB QIR-004 slice, a 300 ms foreground selection ceiling, and SELECTED/BOUND/RELEASED reservations bound atomically by the versioned finalization authority (QIR-006; migration 0063 — the terminal migration of the closed QIR v1 historical baseline, not a live ceiling)
- [Integrated Brain End-to-End Hardening v2](integrated-brain-e2e-hardening-v2.md) — **FROZEN / NORMATIVE** the final adversarial integrated proof layer over QIR-001..QIR-006 on real PostgreSQL + real Redis: a three-turn cognitive loop closed only by canonical intelligence, FAST/DEEP parity, the foreground failure isolation matrix, authority conflict under exact global/per-slice context pressure, Safety BLOCK/GUIDED fail-closed integration, crash/reclaim/durable-checkpoint recovery with no replayed provider effect, integrated Question isolation and privacy, and the whole-run provider/hidden-work census (QIR-007; ZERO new production semantics; no migration)
  - **QIR-007 Addendum A — Cross-Context Adversarial & HI Capacity Proof v1** — merged closure evidence carried under QIR-007 (section 11 of the QIR-007 document): scenarios C5–C8 and the reachable Human Intelligence capacity proof (canonical all-active fixture 6427 bytes, current maximum reachable coherent footprint 7518 bytes, slice 8192 bytes, headroom 674 bytes, verdict PASS)

## Operational Foundation hardening

- [Correlation & Telemetry Foundation v1](correlation-telemetry-foundation-v1.md)
- [Runtime Event Outbox + Publisher v1](runtime-event-outbox-publisher-v1.md)
- [Health / Readiness / Dependency Probes v1](health-readiness-dependency-probes-v1.md)
- [Background Intelligence Repository Adapters v1](background-intelligence-repository-adapters-v1.md)
- [Post-Response Intelligence Dispatch Runtime v1](post-response-intelligence-dispatch-runtime-v1.md)
- [Durable Memory Effect Result Persistence v1](durable-memory-effect-result-persistence-v1.md)
- [Durable Authorized Association Command Persistence v1](durable-association-command-persistence-v1.md)

## Recommended implementation-facing set

- Tech Stack
- Project Skeleton
- Core Runtime
- Model Router
- Memory Runtime
- Conversation Orchestrator
- Safety Runtime
- Behavioral Runtime
