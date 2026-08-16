# QANDEEL — Coding Agent Guardrails

These instructions apply to coding agents working in this repository.

## 1. Read before coding
For implementation work, read the relevant files under `docs/implementation-foundation/`, starting with:
1. `QANDEEL_FOUNDATION_FREEZE_v1.0.md`
2. `QANDEEL_Recommended_TECH_STACK_v1.0.md`
3. `QANDEEL_PROJECT_SKELETON_v1.0.md`
Then read the runtime specification(s) relevant to the task.

## 2. Source-of-truth rule
Engineering implements canonical contracts; it does not invent missing product logic.
If a genuinely blocking product-contract gap appears, report it explicitly instead of silently redefining Qandeel.

## 3. Scope discipline
Implement only the requested task. Do not opportunistically add unrelated features, providers, screens, services, engines, or abstractions.
Prefer the simplest implementation compatible with the frozen foundation.

## 4. Architecture constraints
- TypeScript + NestJS backend.
- Modular monolith first; no premature microservices.
- PostgreSQL is primary source of truth.
- Provider-specific AI logic stays behind Model Router adapters.
- Voice-provider-specific logic stays behind Voice Adapter abstractions.
- Memory is user-scoped, selective, bounded, and provenance-aware.
- Conversation Orchestrator owns authoritative turn lifecycle.
- Behavioral Runtime governs visible Qandeel behavior.
- Safety is a runtime constraint, not just a post-filter.

## 5. Security and privacy
- Never commit secrets or real credentials.
- Never place provider API keys in mobile/client code.
- Default-deny user-scoped resources.
- Preserve explicit user isolation in schema and code.
- Do not log private transcripts, raw audio, memory content, or sensitive data unless the approved contract explicitly requires it.

## 6. Behavioral integrity
Do not turn Qandeel into a generic chatbot.
Preserve the frozen behavior principles: concise ordinary conversation, minimal intervention, direct questions when appropriate, hypothesis restraint, narrative non-steering, optional reflection, and anti-lecture behavior.

## 7. Testing rule
Every implementation PR must include the smallest meaningful verification for its scope.
Run/build/test what the repository supports. Fix failures before proposing merge.
Do not claim a check passed unless it actually ran successfully.

## 8. Git / PR discipline
- Work on a dedicated branch.
- Keep each PR focused on one implementation objective.
- Explain what changed, why, what was deliberately not implemented, and how it was verified.
- Do not merge a failing CI change.

## 9. Change-control boundary
The Foundation Freeze may be tuned through configuration where explicitly allowed, but material contract changes require controlled change.
Do not casually alter runtime ownership boundaries, provider abstraction, memory principles, user isolation, safety requirements, or core behavioral principles.

## 10. Default engineering bias
When more than one valid implementation exists, prefer:
1. simpler,
2. easier to test,
3. easier for future AI coding agents to understand,
4. lower operational complexity,
5. provider-replaceable,
6. cost-conscious,
while preserving the frozen contracts.
