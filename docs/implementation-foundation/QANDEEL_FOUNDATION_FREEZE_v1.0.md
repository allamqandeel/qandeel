# QANDEEL — FOUNDATION FREEZE v1.0

## Engineering Foundation Baseline & Implementation Authorization

**Status:** FOUNDATION BASELINE APPROVED FOR IMPLEMENTATION — subject to controlled change management.

This document closes the Qandeel Engineering Foundation phase and establishes the baseline from which implementation begins. It freezes the core runtime responsibilities, boundaries, interfaces, and engineering principles required to begin controlled coding without reopening architecture by default.

## Canonical Foundation Set
- QANDEEL — Core Runtime v1.0
- QANDEEL — Model Router v1.0
- QANDEEL — Memory Runtime v1.0
- QANDEEL — Conversation Orchestrator v1.0
- QANDEEL — Safety Runtime v1.0
- QANDEEL — Behavioral Runtime v1.0
- Approved Tech Stack and Project Skeleton specifications
- Existing canonical product, intelligence, engineering, and governance documents remain upstream sources of truth where applicable.

## Frozen Engineering Principles
- Provider independence: Qandeel is not hard-wired to one LLM or voice provider.
- Fast Path first; Deep Path only when justified.
- Selective invocation: not every engine/capability runs on every turn.
- Memory is selective, user-scoped, provenance-aware, and bounded.
- Conversation Orchestrator is the authoritative lifecycle owner of each turn.
- Safety is a runtime constraint across the path, not only a final filter.
- Behavioral Runtime governs visible conversational behavior independently from raw model intelligence.
- Deep reasoning does not imply long visible output.
- User interruption is a first-class realtime event.
- Least Data / Least Access / Least Retention.
- Engineering implements canonical contracts; it does not invent missing product logic.

## Behavioral Freeze
- Ordinary conversation defaults to concise, natural responses.
- Avoid generic lecture mode.
- Reflection is optional, not mandatory.
- Questions should be direct when a preamble adds no value.
- Prefer one high-information question over multiple low-value questions.
- Internal hypotheses must not automatically be exposed.
- Do not steer the user's narrative by prematurely presenting causal interpretations.
- Advice should not precede sufficient understanding unless clearly warranted.
- Prefer the smallest intervention that creates the highest-value next turn.

## Runtime Authority Boundaries
- Core Runtime defines common runtime contracts and foundational execution rules.
- Conversation Orchestrator coordinates the authoritative session/turn lifecycle.
- Model Router owns provider/model selection and fallback policy.
- Memory Runtime owns persistent-memory retrieval/write/lifecycle behavior.
- Behavioral Runtime owns visible conversational move and response discipline.
- Safety Runtime owns runtime safety constraints, authorization boundaries, and applicable enforcement decisions.
- Provider adapters translate Qandeel contracts; they do not define Qandeel product behavior.

## Model & Provider Policy
- No model name is part of Qandeel's permanent identity.
- Model Registry and routing policy remain configurable.
- Selection considers capability, quality, latency, cost, safety, and health.
- Fallback is explicit and observable.
- Benchmark with Qandeel-specific Golden Conversation tests, not generic leaderboards alone.

## Memory Freeze
- Conversation history and durable memory are separate.
- Not every message becomes memory.
- User-stated/confirmed information has stronger authority than system-derived inference.
- Derived insight must not silently become fact.
- Retrieval is bounded and relevance-driven.
- Cross-user retrieval is prohibited.
- Contradiction, supersession, expiration, correction, and deletion are supported.
- PostgreSQL + pgvector is the recommended V1 persistence approach unless an approved engineering change is made.

## Orchestration Freeze
- Every turn has one authoritative lifecycle owner.
- Turns have explicit states and terminal outcomes.
- Stale output from cancelled/superseded turns must not become authoritative.
- Retries are bounded and side effects are idempotency-aware.
- Realtime interruption cancels or suppresses obsolete output.
- Providers are accessed through Model Router, never directly from client/runtime features.

## Safety Freeze
- Authorization is checked server-side before private resource access.
- Safety constraints cannot be downgraded by fallback.
- Sensitive data exposure to providers and telemetry is minimized.
- High-risk or privileged actions require explicit authorization rules.
- Use the smallest visible safety intervention that works.
- Safety classification is not automatically durable personal memory.

## Configurable Without Breaking Freeze
Provider/model choices behind adapters, routing thresholds, cost/latency budgets, non-behavior-changing prompt wording, operational timeouts/rate limits/retries, bounded retrieval tuning, observability thresholds, deployment sizing, and UI details that do not change canonical behavior.

## Controlled Change Required
Changes to runtime ownership boundaries, provider abstraction, selective invocation, memory retention principles, hypothesis-as-fact safeguards, turn authority/cancellation, core behavioral principles, user isolation/privacy/safety, or material new runtime capabilities require controlled change.

## Implementation Rule
**IMPLEMENT THE CONTRACTS FIRST.**

Where a contract is explicit, engineering follows it. Where implementation detail is intentionally open, choose the simplest compatible solution. Where product behavior is genuinely missing, stop that specific decision and raise a targeted gap rather than inventing behavior.

## First Implementation Objective
Build one controlled end-to-end text conversation path before expanding breadth:

`authenticated user → session/turn → context → optional memory → path selection → model routing → behavioral policy → safety → persistence/events → response`

Do not begin by implementing every ABS engine, every screen, Family, proactive features, or the full voice stack simultaneously.

## Recommended Coding Sequence
1. Repository/project skeleton verification.
2. Environment/config/secrets baseline.
3. Database migrations and core schemas.
4. Authentication/user isolation baseline.
5. Session + Turn state model.
6. Conversation Orchestrator text path.
7. Model Router + first provider adapter.
8. Context Builder.
9. Memory Runtime basic storage/retrieval.
10. Behavioral Runtime policies.
11. Safety Runtime gates.
12. Persistence/events/observability.
13. Golden end-to-end text tests.
14. Additional provider adapters and routing benchmarks.
15. Realtime voice transport/interruption/provider integration.
16. Mobile/client expansion after core path stability.

## Quality Gates
Unit, integration, Golden Conversation, authorization/isolation, cancellation/timeout/duplicate/stale-output, cost telemetry, fallback, memory lifecycle, and safety regression tests. The text path must be stable before production voice complexity is added.

## Final Freeze Statement
**FOUNDATION FREEZE v1.0 — APPROVED FOR CONTROLLED IMPLEMENTATION.**

From this point forward: build, test, benchmark, observe, and change only when evidence requires it.

**QANDEEL'S FOUNDATION IS NOW A CODING BASELINE, NOT A DESIGN DISCUSSION.**
