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

## Implementation phase

- [Effective Live Focus + Final Semantic-Chain Cutover v1](effective-live-focus-final-semantic-chain-cutover-v1.md) — T-03D (one Architecture-sized task), migration 0071: the FINAL same-SP semantic chain and the production authority cutover — effective Live Focus as the Session's current live conversational attention (NONE / EMERGING / THREAD) derived by a deterministic reducer from the committed B1 semantics and the FINAL Thread layer with SQL parity (LF-01..LF-04, same-Moment Emerging → Thread promotion, conservative departure only under exact committed FOCUS_SHIFT evidence), written at same-SP sequence 3 beside B1's 1 and the Thread layer's 2 (sequence 2 when no Thread event, no sequence when unchanged), exactly one committing authority left executable after cutover (the T-03A2 temporal-only writer retired, no fallback), the live conversation path on the final chain only, and the authoritative `LIVE_FOCUS_TRANSITION` wire + passive mobile ingestion into the frozen T-02 mirror; no T-03C projection, no Return-to-Live-Focus, no visual UI
- [Thread Lifecycle + Cross-Session Continuity v1](thread-lifecycle-cross-session-continuity-v1.md) — T-03B3 (one Architecture-sized task), migration 0070: the production-inert FINAL Thread layer — Session-local Active / Dormant / Reopened lifecycle over user/world-global Thread identity (B3-01), cross-Session focus → Thread continuity as semantic identity resolution with exact grounding evidence, never name / similarity (B3-02), exhaustive deterministic dossier screening in fixed chunks against one exact identity version (B3-03), one final Thread-layer capture that supersedes the B2-only capture by reusing the 0068 authority (B3-04), a deterministic lifecycle reducer mirrored and re-derived in SQL (B3-05); the whole Thread layer shares at most one same-SP sequence 2 per CU beside B1's 1; both stale tokens earn one shared semantic retry; T-03D owns the live cutover with effective LF
- [Thread Runtime Orchestration + Integration Readiness v1](thread-runtime-integration-readiness-v1.md) — T-03B2b3 (final slice of T-03B2), migration 0069: the production-inert combined Focus→Thread runtime chain (one integrated B1+B2 replay gate, one authoritative combined context and clock token, segmentation, sequential B1, one whole-exchange B1 canonicalization, sequential B2, deterministic grounded Conversational Origin, one whole-exchange Thread canonicalization, one existing 0068 coordinator call) plus the read/audit substrate; AC-B2B3-01 defers the live authority cutover to T-03D, which extends the same per-Moment transaction with effective LF
- [Durable Thread + Permanent Home + Same-SP DB Substrate v1](durable-thread-home-same-sp-substrate-v1.md) — T-03B2b2 (third slice of T-03B2), migration 0068: the production-inert durable substrate that turns a proven TE-01 / TE-02 / TE-03 decision into a user/world-scoped canonical Thread with an immutable EmergingFocus lineage and exactly one permanent Home, computed by the database itself in a PostgreSQL mirror of QANDEEL OSDAP v1 under a per-user-world lock taken after the Session Semantic Clock, written at same-SP sequence 2 beside B1's sequence 1; T-03B2b3 owns runtime orchestration and T-03D the live cutover
- [Canonical Home Placement Engine v1 — QANDEEL OSDAP v1](canonical-home-placement-engine-v1.md) — T-03B2b1 (second slice of T-03B2), no migration: the pure, production-inert Origin-Seeded Deterministic Append Placement engine that gives an Established Thread its permanent Home in exact BigInt world coordinates — origin guides the search datum without becoming hierarchy, old Homes never move, no semantic or viewport value can influence geography; golden vectors and the 10,000-Thread append proof replay byte-for-byte in API CI; T-03B2b2 owns durability
- [Thread Establishment Evaluator + Prepared Promotion Evidence v1](thread-establishment-evaluator-v1.md) — T-03B2a (first slice of T-03B2), no migration: the production-inert one-CU Thread-establishment evaluator that turns a committed CU, its canonical B1 semantics and prior context into a strict prepared TE-01 / TE-02 / TE-03 decision; T-03B2b owns durable Thread identity, Home Anchor and same-SP integration
- [Focus Runtime Orchestration + Activation Readiness v1](conversation-focus-runtime-integration-readiness-v1.md) — T-03B1b2, migration 0067: the production-inert post-finalization B1 orchestration (strict context mapping, integrated replay snapshot, bounded stale-context retry, lazy focus binding) and the cutover-readiness audit; AC-B1B2-01 defers the live authority cutover to T-03D after T-03B2 extends the same per-Moment chain
- [Durable Reference / Emerging Focus SP-Native Substrate + Per-Moment Integrated DB Writer v1](durable-reference-emerging-focus-sp-substrate-v1.md) — T-03B1b1, migration 0066: the production-inert durable substrate, deterministic canonicalization, the per-Moment integrated writer under the AF66-01 clock lock, stale-context protection and the authoritative focus-context snapshot that T-03B1b2 will activate
- [Reference / Attention Resolution Evaluator + Prepared Focus Semantics v1](reference-attention-focus-evaluator-v1.md) — T-03B1a, the production-inert one-CU reference / attribution / conversational-function / independent-attention evaluator that T-03B1b will integrate into the SP-native transaction

- [Session Semantic Clock + SP Allocation/Sealing + LH Establishment + Committed-CU Delivery v1](session-semantic-clock-sp-lh-delivery-v1.md) — T-03A2, the one activation act that makes committed-CU commitment and Session Position allocation executable together

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

## Experience / Structural Grammar closure

**QANDEEL Phase V — Visual Language Discovery — CLOSED / FROZEN WITH EXPLICIT OPEN ITEMS.**

- [Phase V — Visual Language Discovery](design/phase-v/README.md) — **CLOSED / FROZEN WITH EXPLICIT OPEN ITEMS** the canonical archive of the closed Phase V (V7 → V8 → V9 → V10 → V10-FIX-01): the frozen structural/semantic/interaction grammar, the closure record, the supporting reviews and the minimum non-production V9/V10 evidence. Documentation only; no production, runtime or database behaviour. Final graphic language, colour, typography, surfaces, iconography, motion and brand are explicitly **not** frozen and belong to Phase VI.

## Phase VI — Final Visual Design + Design Systemization

**QANDEEL Phase VI — Final Visual Design + Design Systemization — IN PROGRESS.**

- [VI-01 — Bilingual Product Language & UX Vocabulary Foundation](design/phase-vi/vi-01-bilingual-product-language/README.md) — **CLOSED / FROZEN AS LANGUAGE SYSTEM + SEMANTIC CONTRACTS** the canonical archive of the closed VI-01: native bilingual authorship/transcreation, one Arabic product language for v1, the Arabic register architecture, truth/semantic guardrails, naming-minimization, gender policy, peer-scaling language constraints, provenance/correction semantics, accessibility language invariants, the rejection-authority taxonomy and the exact core vocabulary marked `APPROVED`. `PROPOSED`, `OPEN`, `PROVISIONAL` entries and ordinary microcopy remain editable so long as the frozen semantic contract, runtime truth, accessibility contract and bilingual meaning hold. Documentation only; no production, runtime or database behaviour.

- [VI-02 — Analysis Navigation & Density Scalability](design/phase-vi/vi-02-analysis-navigation-density/README.md) — **CLOSED / FROZEN AS BEHAVIORAL + NAVIGATION ARCHITECTURE** the canonical archive of the closed VI-02: the frozen clauses `F-01 … F-12` — the whole peer set precedes any reading, no system-selected winner, peers equal and unranked, every exposed peer reachable, the full statement as the canonical human-facing identity source, full identity reachable without commitment, reversible reader-chosen foreground, a permanent named route back to the set, orientation that is never currency, deep links only with that route intact, bilingual/keyboard/assistive parity, and no new runtime contract required for the validated architecture. `F3 — Overview ⇄ Focus` is the behavioural reference. Documentation only; no production, runtime or database behaviour.

**VI-02 visual morphology — OPEN / carried into VI-03.** VI-02 froze *what is true for the reader*, never what the reader looks at. Vertical rows, paragraph-heavy presentation, cards, typography, colour, surfaces, iconography, brand expression, motion, generative graphics, density styling, search/filter/jump behaviour, visual anchors, spatial field, circles/grouping, relation threads and recomposition animation all remain explicitly **not** frozen. The governing rule for whatever is drawn later: *a visual relationship may be drawn only if it is true of the runtime.*

Next task: **VI-03 — Visual North Star + Graphic Language**.

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
