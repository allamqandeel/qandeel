# QANDEEL — MODEL ROUTER v1.0

## Purpose
The Model Router sits between Qandeel Runtime and external AI providers. Model selection is runtime policy, not a hard-coded dependency.

## Architectural Principle
**Qandeel Runtime must never depend directly on a specific model provider.** GPT, Claude, Gemini, Kimi, and future providers live behind adapters.

## Router Inputs
Task/capability, conversation mode, Fast/Deep path, complexity, context size, latency budget, cost budget, safety sensitivity, modality, locale, provider health, and quota state.

## Capability Classification
Conversational response, reasoning, structured extraction, summarization, memory processing, classification, high-complexity analysis, realtime interaction, and tool/function calling.

## Complexity Scoring
Use a lightweight configurable V1 signal based on implied reasoning steps, ambiguity, constraints, context volume, multi-stage reasoning, decision impact, structured-output need, and external tools. It is a routing signal—not a measure of the user.

## Routing Strategy
1. Determine required capability.
2. Determine Fast vs Deep.
3. Estimate complexity.
4. Filter providers by capability/modality/safety/context.
5. Remove unhealthy providers.
6. Apply latency/cost constraints.
7. Rank eligible candidates by expected interaction value.
8. Select primary model.
9. Select valid fallback when possible.
10. Execute through adapter.

## Objective
Maximize expected interaction value subject to quality, latency, cost, safety, and reliability constraints.

## Provider Adapters
Initial adapter boundary supports GPT, Claude, Gemini, Kimi. Adapters translate Qandeel's common request/result contract to provider APIs and back.

## Model Registry
Centralize provider, model ID, capabilities, context limit, modalities, quality/latency/cost profiles, availability, languages, safety constraints, and enabled state. Do not scatter model names through code.

## Fallback
Fallback is explicit and observable. Triggers can include timeout, error, rate limit, unavailability, context incompatibility, unsupported capability, invalid response, or safety incompatibility. Fallback must never downgrade required behavior or safety.

## Cost & Latency Controls
Every call produces usage metadata. Expensive models require a runtime reason when cheaper eligible models can satisfy the task. Deep does not automatically mean most expensive. Interactive turns have explicit latency budgets and bounded fallback/retry behavior.

## Routing Modes
DEFAULT, FAST, DEEP, COST_SENSITIVE, HIGH_RELIABILITY, REALTIME.

## Router Must NOT
Contain Qandeel personality logic, infer psychological state, replace Orchestrator, decide durable memory, invent product behavior, expose provider details to mobile, or hard-code one model as “the Qandeel brain.”

## Benchmark Requirement
Final model selection is benchmark-driven using Qandeel outcomes: conversational naturalness, next-turn value, question discipline, hypothesis restraint, listening/non-steering, concision, deep reasoning quality, safety, latency, and cost per useful interaction.

## Definition of Done
Stable Model Router interface; at least one adapter works end-to-end; new providers do not change Core Runtime; Fast/Deep modes and complexity signal exist; Registry exists; primary/fallback selection exists; cost/latency constraints and observability exist; benchmark harness can compare models using Qandeel Golden Conversations.

## Final Principle
**THE MODEL IS A REPLACEABLE COMPONENT. THE QANDEEL RUNTIME AND BEHAVIOR ARE THE PRODUCT.**
