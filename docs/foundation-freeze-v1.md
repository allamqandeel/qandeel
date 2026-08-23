# QANDEEL — Foundation Freeze v1

**Status:** CLOSED — OPERATIONALLY RECONCILED  
**Original pre-closure verified baseline:** `3b07829c4d31fc6d743076ea3589cb2ecb5594d4`  
**Original closure issue:** #82  
**Operational reconciliation pre-closure baseline:** `d89d4b8f7cc8f30ecec09546bad68100cdf606d0`  
**Operational reconciliation issue:** #90

The merge commit of the Foundation Closure Reconciliation v1 PR becomes the canonical reconciled Foundation v1 baseline.

## Meaning of closure

Foundation v1 is stable enough to build upon. It is not the finished QANDEEL product. Later work should compose on top of these frozen contracts. Changing a frozen invariant requires an explicit, versioned architectural change.

The operational reconciliation does not reopen or redesign Foundation semantics. It records three production-hardening surfaces added after the original closure: Correlation & Telemetry Foundation v1, Transactional Runtime Outbox + Event Publisher v1, and Health / Readiness / Dependency Probes v1.

## Frozen runtime surfaces

The implemented Foundation includes:

- Authenticated Conversation Runtime
- Context Builder
- Model Router and FAST/DEEP routing
- Safety Response Gate
- Behavioral Runtime
- Memory Runtime
- Intelligence Evidence Layer
- Hypothesis Runtime, Controlled Generation, and Update Loop
- Confidence Runtime
- Question / Information Gap Runtime
- HIM Runtime Foundation
- Initial HIM Metrics catalog
- HIM Calculation & Calibration Runtime
- calibrated HSE measurement models
- HIM Temporal Comparability / Trend source
- HIM Intelligence Snapshot
- HIM Reasoning Consumption Bridge
- Turn → HIM Context Selection
- HIM Orchestrator Integration
- FAST/DEEP HIM Consumption Policy
- Foundation Integration / Regression Gate
- Correlation & Telemetry Foundation v1
- Transactional Runtime Outbox + Event Publisher v1
- Health / Readiness / Dependency Probes v1

This list describes existing Foundation surfaces and does not imply capabilities beyond their implemented contracts.

## Current HIM measurement coverage

The canonical catalog contains exactly 17 metric identities. Exactly five are calibrated:

- `hse.stress`
- `hse.energy`
- `hse.motivation`
- `hse.self-confidence`
- `hse.attention`

The remaining 12 metrics are intentionally `UNCALIBRATED` and deferred. They do not block Foundation closure. No uncalibrated metric may be silently estimated or promoted.

## HIM scientific invariants

- UNKNOWN remains unknown.
- A model-facing KNOWN value means latest-known, not guaranteed current.
- Freshness is `UNASSESSED` in Foundation v1.
- HIM metric confidence is `UNASSESSED` in Foundation v1.
- Hypothesis Confidence Runtime is separate from HIM metric confidence.
- No composite human, wellbeing, or readiness score is authorized.
- No diagnosis is authorized.
- Session-bound state must not become a global trait inference.
- The current model-facing HIM path authorizes no trend, improvement, or worsening inference.

## Context discipline

The production turn selector v1 uses the authoritative claimed USER turn. It selects only `CONVERSATION_SESSION`, using the exact `claimedTurn.session_id`. User text cannot override context. The selector infers no SITUATION, DECISION, GOAL, RELATIONSHIP, or GLOBAL context. Future explicit bindings require a new versioned contract.

## Safety, privacy, and trust boundaries

- Safety `BLOCK` short-circuits before Memory, HIM, and provider generation.
- Memory and HIM remain separate channels.
- HIM is structured data, never instructions.
- Model-facing HIM excludes audit provenance identifiers.
- Provider adapters do not own HIM semantics.
- Central guidance composition remains provider-independent.
- Ownership and RLS isolation remain required.
- Application correlation identifiers remain distinct from OpenTelemetry trace/span IDs.
- Telemetry is privacy-minimized and fail-soft; telemetry failure cannot change successful runtime work.
- Conversation terminal business state and its v1 runtime event are committed atomically in PostgreSQL.
- Redis publication is asynchronous, at-least-once, and outside the interactive transaction.
- Liveness remains dependency-free; readiness distinguishes required dependencies from optional operational dependencies.

## FAST / DEEP frozen meaning

FAST and DEEP consume the same canonical `CONVERSATION_SESSION` source. FAST is a compact semantic projection; DEEP provides richer but bounded semantic metadata. HIM neither chooses nor alters the route. DEEP does not fetch or consume Trend data in Foundation v1. Richer DEEP metadata does not authorize temporal decay, trend, or current-state inference.

## Operational hardening invariants

### Correlation & telemetry

The canonical application correlation chain is `request_id → session_id → turn_id → orchestration_id → engine_call_id → provider_call_id`. OpenTelemetry owns traces/metrics; Sentry owns sanitized error/crash reporting. Neither observability path may contain conversation content, Memory/HIM payloads, credentials, request bodies, or high-cardinality correlation identifiers as metric dimensions. Observability remains fail-soft.

### Runtime event outbox

V1 runtime event production is limited to `ConversationTurnCompleted`, `ConversationTurnFailed`, and `ConversationTurnCancelled`. The terminal business transition and outbox insert are one PostgreSQL transaction. Redis Streams publication happens asynchronously afterward. Delivery is at least once with stable `event_id`, claim/lease fencing, bounded retry, and quarantine without event deletion. V1 event envelopes contain no conversation content.

### Health/readiness

`GET /health` and `GET /health/live` are dependency-free liveness endpoints. `GET /health/ready` treats the database and configured model-provider boundary as required; Runtime Events and observability are optional operational dependencies. Required failure yields `503 not_ready`; optional degradation is surfaced without taking the core API out of readiness. Health probes do not perform paid model generation, Redis publication, repair, migration, or business mutation.

## Verification

Foundation closure is backed by executable verification, including:

- `verify:foundation-integration-gate`
- `verify:him-measurement-preflight`
- the full API test suite
- the full database contract suite
- TypeScript validation
- the API build
- real PostgreSQL integration verifiers for Initial HIM, calculation/calibration, HSE Energy, HSE Motivation, HSE Attention, HSE Self-Confidence, HSE Stress, HIM Trends, HIM Intelligence Snapshot, and Runtime Event Outbox

The operational-hardening PRs also passed their focused privacy, correlation, outbox atomicity/fencing, and health/readiness tests with zero paid/provider calls in verification.

This document records the freeze; it does not replace executable tests or verifiers.

## Explicitly deferred beyond Foundation

- calibration and model work for the remaining 12 metrics
- authoritative SITUATION, DECISION, GOAL, and RELATIONSHIP turn bindings
- trend-aware DEEP model consumption
- a freshness/decay model
- a HIM metric confidence model
- higher-order synthesis and composites
- dynamic HIM relevance filtering
- broader runtime-event producer taxonomy beyond the three v1 terminal events
- downstream inbox/consumer domain workflows
- correlation persistence beyond the implemented runtime propagation model
- voice and realtime runtime
- proactive intelligence
- product UI/UX
- subscriptions, credits, and monetization
- later provider/model quality tuning
- production monitoring dashboards/alert policy and deployment-specific health wiring

## Change control

Changing a frozen invariant requires an explicit versioned contract or change, documented rationale, a backward-compatibility and migration assessment, and updated regression protection.

## Non-claims

Foundation closure does not mean:

- the QANDEEL product is complete;
- all 17 metrics are calibrated;
- HIM is scientifically complete;
- Trends are consumed by an LLM;
- every architecture event is produced or consumed;
- health/readiness replaces deployment-specific monitoring or alerting;
- voice, UI, monetization, or proactive features are complete.
