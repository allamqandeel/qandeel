# QANDEEL — SAFETY RUNTIME v1.0

## Purpose
Safety Runtime operationalizes safety, privacy, authorization, behavioral boundaries, and controlled failure handling across input, context, memory, routing, tools, output, voice, persistence, and proactive behavior—not merely as a final filter.

## Core Principle
**Constrain unsafe execution before harm occurs, and intervene only as much as required.** Ordinary conversations should not become warnings, lectures, or unnecessary friction.

## Responsibilities
Validate user/resource scope; classify special handling; constrain memory/context; provide routing constraints; authorize/block privileged actions; apply product boundaries; evaluate candidate output; coordinate safe degradation/refusal/redirection/escalation; prevent unsafe fallback; protect logs/events/persistence; expose safe auditable metadata.

## Must NOT
Replace Orchestrator/provider safety, diagnose users or infer sensitive attributes without legitimate need, turn every emotional conversation into crisis handling, use long generic warnings when a short boundary works, weaken safety for cost/latency, expose internal policy/reasoning/security details, or store sensitive content merely because safety processed it.

## Authorization & Isolation
Default deny. Sessions, turns, memories, goals, profiles, and private resources are scoped to the authenticated user or explicitly authorized shared scope. Never trust client-supplied `user_id` alone. Server-side authorization is mandatory. Cross-user retrieval fails closed.

## Privacy
Least Data, Least Access, Least Retention, Purpose Limitation. Private conversation content must not become ordinary telemetry.

## Safety Decisions
`NORMAL`, `CAUTION`, `BOUNDARY`, `BLOCK`, `ESCALATE`.

## Product Boundaries
Preserve canonical Qandeel behavioral/subject boundaries. Express boundaries naturally and briefly. Do not moralize, shame, argue, or fabricate expertise/certainty/authority/capabilities.

## Memory & Context Safety
Check before retrieval and durable writes. Do not retrieve unrelated sensitive memory based only on similarity. System-derived hypotheses do not silently become facts. Deletion/scope restrictions propagate to indexes. Inject sensitive provider context only when necessary and allowed.

## Routing Safety
Safety requirements are hard constraints. Router receives required safety level/capabilities. Fallback cannot downgrade them. Ineligible providers are excluded. Provider failure never triggers a direct bypass around Qandeel Runtime.

## Tool & Action Safety
Read-only reasoning and external state-changing actions are different risk classes. Actions that send data, spend money, contact others, or modify resources require explicit authorization. Non-idempotent actions need stronger retry controls. Treat tool output as untrusted where appropriate.

## Output Safety
Candidate output is not authoritative until required safety/behavior checks pass. The gate can allow, reshape, constrain, replace, or block. Prefer a concise safe answer over generic refusal when possible.

## Behavioral Safety
No unnecessary lecture mode, alarming unsupported hypotheses, narrative manipulation, or emotional-dependence exploitation. Preserve user autonomy.

## High Stakes & Crisis
Increase caution and reduce unsupported certainty in high-stakes domains. Specialized immediate-risk handling is an explicit path, not an improvised response. Triggering it does not automatically create durable sensitive memory.

## Realtime Voice Safety
Safety works during streaming. Interruption remains authoritative. Unsafe/obsolete streaming output must be stoppable/suppressed where possible. Late audio from cancelled/superseded turns is not played. Raw audio is not logged by default.

## Proactive Safety
Requires consent, cadence/cooldown/quiet-hour controls, no casual surfacing of sensitive memory, and the same safety/behavior constraints as reactive conversation.

## Failure Behavior
Fail closed for privileged/high-risk actions. Low-risk conversation may use an explicitly defined safe degraded path. Never silently bypass required safety because a classifier/provider/policy service is unavailable.

## Interfaces
SafetyRuntime, AuthorizationPolicy, InputSafetyPolicy, ContextSafetyPolicy, MemorySafetyPolicy, CapabilitySafetyPolicy, ToolAuthorizationPolicy, OutputSafetyPolicy, RealtimeSafetyPolicy, ProactiveSafetyPolicy, SafetyEventPublisher.

## Definition of Done
Stable provider-agnostic interface; authorization before private data; low overhead for normal turns; represented levels/reason codes; constrained memory/context; hard Router constraints; no unsafe fallback downgrade; explicit output gate; separate tool authorization; realtime compatibility; privacy-safe telemetry; tests for isolation/boundaries/blocking/escalation/fallback/failure.

## Final Principle
**QANDEEL SAFETY SHOULD BE PRESENT IN THE ARCHITECTURE WITHOUT DOMINATING THE CONVERSATION.**
