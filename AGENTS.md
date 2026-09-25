# QANDEEL — Coding Agent Guardrails

These instructions apply to coding agents working in this repository.

## 1. Read before coding
Before any task-specific work, read in this order:
1. `QANDEEL_CURRENT_STATE.md` — current lifecycle per domain, what is implemented as opposed to only
   decided, and the open register.
2. `QANDEEL_PROJECT_MAP.md` — where authority lives, what binds over what, and the historical traps.
3. `QANDEEL_PRODUCT_ROADMAP.md` — the Product Owner's current sequencing. It does not authorize implementation.
4. `docs/qandeel-canonical-backlog-v1.md` — in full, for the items your task inherits (BG-05).
5. The task-relevant current canonical record(s) that `QANDEEL_CURRENT_STATE.md` and
   `QANDEEL_PROJECT_MAP.md` point to, including the later amendments that bind over them.
6. Where implementation work requires them, the foundation documents under `docs/implementation-foundation/`,
   starting with:
   1. `QANDEEL_FOUNDATION_FREEZE_v1.0.md`
   2. `QANDEEL_Recommended_TECH_STACK_v1.0.md`
   3. `QANDEEL_PROJECT_SKELETON_v1.0.md`

   Then read the runtime specification(s) relevant to the task.
7. Historical / upstream authority (`docs/canonical-authority/`) only when exact provenance or an audit needs it.

Historical documents may describe themselves as "current" relative to their original date. Current
repository orientation comes from `QANDEEL_CURRENT_STATE.md` plus the later authority it cites.

Current State and Project Map are locators. The Product Roadmap records Product Owner sequencing but creates no
Product/runtime semantics and does not authorize coding. The task you were given, under its own Task Contract,
defines your scope.

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

## 10. Task closure discipline
Before claiming a task is `CLOSED / FROZEN`, or preparing the change that closes it:
1. Read `docs/qandeel-canonical-backlog-v1.md`. It is the governance authority; this section only
   makes it hard to overlook.
2. Reconcile every backlog item the task inherited (BG-08) — tombstone it, re-own it to one named
   task, or record why it stays deferred. Silence is not a disposition.
3. Admit any new qualifying cross-task residue (BG-08 / BG-06). A qualifying item must not survive
   only in a review comment, a final report or a task-local note.
4. Update the task's own primary canonical document from its candidate/review banner to its final
   lifecycle state (BG-09), in the same closing change.
5. A Connected Worlds phase (`I-0N`) closes on exactly these terms. Its closure is recorded as an
   `### I-0N closure record` section of the backlog, and its primary canonical record carries the
   `**Phase:**` banner that must reach `CLOSED / FROZEN` in the same change. A phase with no
   standalone document still has one — `I-05`'s is `database/README.md` — and "it has no document"
   is not a reason for its lifecycle state to go unstated. A SLICE is not a phase: `I-07D` closes
   as a slice, under `**Slice:**`, and never through an `### I-07D closure record` heading, which
   would claim a phase closure that did not happen.
6. Leave no successor task responsible for finishing any of the above. Repairing a predecessor's
   closure record is a governance task, not ordinary inheritance.
7. Run `npm run test:task-closure-governance-contract`, which enforces 4 and 5 and the continued
   existence of the rules behind 1–3.

## 11. Default engineering bias
When more than one valid implementation exists, prefer:
1. simpler,
2. easier to test,
3. easier for future AI coding agents to understand,
4. lower operational complexity,
5. provider-replaceable,
6. cost-conscious,
while preserving the frozen contracts.
