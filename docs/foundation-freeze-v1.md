# QANDEEL — Foundation Freeze v1

**Status:** CLOSED  
**Pre-closure verified baseline:** `3b07829c4d31fc6d743076ea3589cb2ecb5594d4`  
**Closure issue:** #82

The merge commit of the final closure PR becomes the canonical Foundation v1 closure baseline.

## Meaning of closure

Foundation v1 is stable enough to build upon. It is not the finished QANDEEL product. Later work should compose on top of these frozen contracts. Changing a frozen invariant requires an explicit, versioned architectural change.

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

## FAST / DEEP frozen meaning

FAST and DEEP consume the same canonical `CONVERSATION_SESSION` source. FAST is a compact semantic projection; DEEP provides richer but bounded semantic metadata. HIM neither chooses nor alters the route. DEEP does not fetch or consume Trend data in Foundation v1. Richer DEEP metadata does not authorize temporal decay, trend, or current-state inference.

## Verification

Foundation closure is backed by executable verification, including:

- `verify:foundation-integration-gate`
- `verify:him-measurement-preflight`
- the full API test suite
- the full database contract suite
- TypeScript validation
- the API build
- real PostgreSQL integration verifiers for Initial HIM, calculation/calibration, HSE Energy, HSE Motivation, HSE Attention, HSE Self-Confidence, HSE Stress, HIM Trends, and HIM Intelligence Snapshot

This document records the freeze; it does not replace executable tests or verifiers.

## Explicitly deferred beyond Foundation

- calibration and model work for the remaining 12 metrics
- authoritative SITUATION, DECISION, GOAL, and RELATIONSHIP turn bindings
- trend-aware DEEP model consumption
- a freshness/decay model
- a HIM metric confidence model
- higher-order synthesis and composites
- dynamic HIM relevance filtering
- voice and realtime runtime
- proactive intelligence
- product UI/UX
- subscriptions, credits, and monetization
- later provider/model quality tuning

## Change control

Changing a frozen invariant requires an explicit versioned contract or change, documented rationale, a backward-compatibility and migration assessment, and updated regression protection.

## Non-claims

Foundation closure does not mean:

- the QANDEEL product is complete;
- all 17 metrics are calibrated;
- HIM is scientifically complete;
- Trends are consumed by an LLM;
- voice, UI, monetization, or proactive features are complete.
