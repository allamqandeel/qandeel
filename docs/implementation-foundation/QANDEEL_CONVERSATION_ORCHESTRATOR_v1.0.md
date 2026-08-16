# QANDEEL — CONVERSATION ORCHESTRATOR v1.0

## Purpose
The Conversation Orchestrator is the execution coordinator for every conversational turn. It operationalizes Core Runtime by coordinating session state, context, selective capabilities, memory, model routing, behavior, safety, persistence, events, and realtime interruption.

## Core Principle
**One turn has one authoritative lifecycle owner.** Independent engines/providers/background tasks must not compete for control of the same turn.

## Responsibilities
Create/resume sessions; create turn/orchestration IDs; track authoritative state; request minimum sufficient context; select Fast/Deep; invoke capabilities selectively; coordinate Memory Runtime; call Model Router; apply behavioral and safety/privacy gates; coordinate persistence/events; handle cancellation/timeout/retry/fallback/interruption; finalize each turn exactly once.

## Must NOT
Contain provider-specific logic, become Memory Runtime, implement personality analysis itself, run all ABS engines every turn, invent missing product logic, let mobile control privileged runtime decisions, or treat voice interruption as UI-only.

## Session Lifecycle
Minimum states: `ACTIVE`, `IDLE`, `CLOSED`, `EXPIRED`. Session hot state is not automatically durable personal memory. Access is limited to authenticated/authorized scope.

## Turn Lifecycle
Minimum states: `RECEIVED`, `VALIDATED`, `CONTEXT_BUILDING`, `PROCESSING`, `GENERATING`, `STREAMING`, `COMPLETED`, `CANCELLED`, `FAILED`, `SUPERSEDED`. Every turn has a terminal state. Cancelled/superseded turns cannot later publish authoritative output.

## Canonical Turn Flow
Authenticated input → session → IDs → authorization/limits → mode/channel → minimum context → Fast/Deep → required capabilities → optional memory → Model Router → candidate response/stream → behavioral policy → safety/privacy → persistence → events/usage → finalize response.

## Selective Invocation
Capabilities are optional runtime tools, not a fixed pipeline. Memory, Question, Hypothesis, Evidence, Recommendation, and others can be skipped. Fast is default; Deep requires an explicit reason.

## Model Coordination
Call Model Router through a stable contract with task/capability, path, complexity, context, locale, latency/cost budgets, safety level, and modality. Never hard-code a provider.

## Memory Coordination
Orchestrator decides whether retrieval should be requested; Memory Runtime owns retrieval/ranking/lifecycle/authorization/write evaluation. History is not silently converted to durable memory.

## Behavioral Coordination
A dedicated behavioral stage applies concise natural interaction, hypothesis restraint, question discipline, anti-lecture behavior, and smallest-useful-intervention policy.

## Safety & Privacy
Authorization precedes user-scoped context/memory access. Fallbacks, retries, and provider changes never downgrade required safety/privacy.

## Realtime Interruption
Interruption is a first-class lifecycle event: stop/cancel current audio, invalidate obsolete generation where possible, mark prior turn cancelled/superseded, create the new user turn, and resume orchestration. Late provider output from obsolete turns is suppressed.

## Cancellation, Timeout, Retry & Idempotency
Propagate cancellation where supported; otherwise ignore obsolete results. Timeouts are explicit, retries bounded, non-idempotent work is not blindly retried, duplicate client requests must not duplicate authoritative turns/side effects.

## Persistence & Events
Persist authoritative user/assistant turns, IDs, terminal state, path, safe routing and cost metadata, and required outbox records. Events carry identifiers and safe metadata—not uncontrolled transcripts.

## Observability
Correlation chain: `request_id → session_id → turn_id → orchestration_id → engine_call_id → provider_call_id`. Track latency, time-to-first-output, completion/failure/cancellation, fallback, memory use, interruption success, and cost.

## Interfaces
ConversationOrchestrator, SessionManager, TurnManager, ContextBuilder, PathSelector, CapabilityCoordinator, MemoryRuntime, ModelRouter, BehaviorPolicy, SafetyPolicy, TurnPersistence, RuntimeEventPublisher, CancellationController.

## Definition of Done
Authenticated session creation/resume; one authoritative full text-turn lifecycle; explicit testable states; Fast/Deep integration; optional memory; all model calls through Router; behavior/safety gates; coordinated persistence/events; stale-output suppression; idempotency; interruption representation; E2E tests for success/failure/timeout/fallback/duplicate/interruption.

## Final Principle
**THE CONVERSATION ORCHESTRATOR IS THE AUTHORITATIVE COORDINATOR OF THE TURN — IT DECIDES THE ORDER OF WORK, NOT THE CONTENT OF QANDEEL'S IDENTITY.**
