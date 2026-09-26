# QANDEEL — Product Roadmap
**Status:** `PRODUCT-OWNER ROADMAP / SEQUENCING AUTHORITY — CREATES NO PRODUCT OR RUNTIME SEMANTICS`
**Roadmap decision date:** 2026-09-25
**Repository baseline when recorded:** `3c6c0f162c97c75c8d2d55af2a604b20419e7ac9`
This roadmap records the Product Owner's agreed forward sequencing after the repository current-state
reconciliation. It does not itself open an implementation task, define runtime semantics, override a frozen
contract, or turn a backlog entry into executable work.
Every concrete work item still requires its own scoped Task Contract before execution.
---
## 1. Roadmap rules
1. **Frozen authority remains frozen.** A roadmap item consumes existing authority unless an explicit controlled
   change is opened.
2. **Roadmap order is sequencing, not implementation permission.** No coding starts from this file alone.
3. **The canonical backlog remains the one cross-task obligation register.** This roadmap does not duplicate it.
4. **Product/design closure and production implementation remain separate.**
5. **Unknowns stay unknown until their own Product/Architecture work closes them.** This file must not silently
   choose a provider, credit formula, profile field, notification threshold, icon shape, or UI pattern.
6. **The End-to-End audit is user-journey completeness work, not a substitute for the pre-audit Product closures
   below.**
---
## 2. Current roadmap phase — Final Product Decision Closure
The project is currently in **Final Product Decision Closure**.
Before the whole Product is audited from first launch to long-term use, close the known Product/visual decision
tracks that would otherwise make the audit repeatedly stop on already-known unresolved areas.
### P1 — User Profile / Identity / Preferences / QANDEEL Understanding
**P1 — CLOSED / FROZEN** — closed by
[`docs/qandeel-p1-user-identity-preferences-understanding-canonical-closure.md`](docs/qandeel-p1-user-identity-preferences-understanding-canonical-closure.md).
That record is the Product authority for this track; this section only records the lifecycle. Production
implementation remains open. P1 froze that QANDEEL has **no traditional general Profile page**: account identity lives in
one General Settings destination. So later mentions of "Profile" in this roadmap read as account identity / General
Settings, apart from the capability-owned Introduction Profile.
The track's original scope, kept as written:
- Account Identity;
- user-controlled preferences;
- QANDEEL Memory versus user-authored profile data;
- QANDEEL Understanding / derived interpretation;
- disagreement / contested interpretation behavior where applicable;
- Personal versus Shared versus Public identity exposure;
- privacy and disclosure boundaries;
- what belongs in Profile, Settings, Memory inspection, and Understanding inspection.
No specific field set, screen morphology or storage schema is frozen by this roadmap.
### P2 — Final Iconography System
**P2 — CLOSED / FROZEN** — closed by
[`docs/qandeel-p2-final-iconography-canonical-closure.md`](docs/qandeel-p2-final-iconography-canonical-closure.md),
with the merged P2-A proof
([`docs/design/p2-iconography/QANDEEL_P2-A_FINAL_ICONOGRAPHY_INTEGRATED_VISUAL_PROOF/`](docs/design/p2-iconography/QANDEEL_P2-A_FINAL_ICONOGRAPHY_INTEGRATED_VISUAL_PROOF/P2_READ_FIRST.md))
as its evidence. That record is the Product / design authority for this track; this section only records the
lifecycle. Production implementation remains open. It supersedes G1.2's "PROOF ONLY — NOT A VISUAL FREEZE" for the
icon glyphs and the call controls; the audio strip and the broader Voice visual language stay unfrozen (its §13.1).
The track's original scope, kept as written:
It must cover the icon language needed across the frozen Product, including where relevant:
- Global shell and navigation;
- Conversation / Analysis;
- Voice Note / Live Call;
- Activity / Notifications;
- Profile / Settings;
- Shared World / Public World / Introductions / Replay;
- interaction states;
- RTL / LTR behavior;
- accessibility and perceivability.
### P3 — Notification Final Realization
**P3 — CLOSED / FROZEN** — closed by
[`docs/qandeel-p3-notification-activity-final-realization-canonical-closure.md`](docs/qandeel-p3-notification-activity-final-realization-canonical-closure.md),
with the merged P3-A proof
([`docs/design/p3-notifications/QANDEEL_P3-A_NOTIFICATION_ACTIVITY_INTEGRATED_VISUAL_PROOF/`](docs/design/p3-notifications/QANDEEL_P3-A_NOTIFICATION_ACTIVITY_INTEGRATED_VISUAL_PROOF/P3_READ_FIRST.md))
as its evidence. That record is the Product / design authority for the notification and Activity realization; this
section only records the lifecycle. The Product / design realization is frozen. Production implementation remains
open. `I-08N-01` stays the foundational notification semantic authority (the closure's §19.1).
The track's original scope, kept as written:
Consume the already-frozen `I-08N-01` Product contract and close the Product realization it deliberately
left open.
This includes, where Product decisions are required:
- notification visual realization;
- Activity surface realization;
- badges / dots / counts;
- notification iconography as an application of P2;
- Lock Screen and in-app presentation;
- permission education experience;
- category/control presentation;
- Product-level timing/frequency decisions that must be frozen before implementation;
- foreground/background presentation behavior where it is a Product decision.
Do not reopen I-08N-01's frozen authority, privacy, interruption-class, Direct Entry or disclosure semantics.
Platform/runtime implementation remains separate unless a later task explicitly owns it.
### P4 — Remaining Product / Visual Gaps Census & Closure
**P4 — CURRENT / NEXT PRODUCT / VISUAL CLOSURE TRACK — NOT YET OPENED AS A TASK CONTRACT**
Perform a bounded census of the **existing Product and visual canon** for items deliberately left:
- `NOT FROZEN`;
- `PROOF ONLY`;
- `OPEN COPY`;
- provisional;
- deferred to later Product/visual craft;
- or otherwise unresolved inside already-opened Product/design tracks.
Close the items that must be decided before the end-to-end Product audit.
This census is **not** the full user journey audit. It is limited to residual decisions in the Product/design
canon already created. Examples to inspect — not assumptions that each requires a new decision — include final
small chrome, app icon / launch-brand application, remaining Voice visual language, provisional copy and other
explicitly deferred visual craft.
---
## 3. Next roadmap phase — End-to-End Product Experience Completeness Audit
Only after P1–P4 close, run:
> **QANDEEL End-to-End Product Experience Completeness Audit**
Walk the Product from the user's point of view, not from repository task numbering.
The audit must cover the complete lifecycle, including at minimum:
- app launch / splash / brand entry;
- account creation, sign-in, password recovery and verification;
- first use and permission education;
- Personal QANDEEL conversation, Analysis and Living Analysis World;
- Voice Note and Live Call;
- Profile / Settings / Memory / Understanding inspection;
- Notifications / Activity;
- Plans / Credits / usage visibility;
- Shared Worlds;
- Public World;
- Introductions / Matching;
- Replay;
- Direct Entry / deep-link behavior;
- offline, loading, stale, permission-denied, interrupted and failure states;
- sign-out, account/security lifecycle, deletion/export where Product policy requires them;
- long-term return and recovery.
The audit output must classify each user moment as one of:
- `COMPLETE / PRODUCTION-READY`;
- `DECIDED — NOT IMPLEMENTED`;
- `IMPLEMENTED — PRODUCT/VISUAL FINALIZATION MISSING`;
- `PROOF ONLY`;
- `PARTIALLY DEFINED`;
- `UNDECIDED`;
- `COMPLETELY MISSING`;
- `DEFERRED / PRE-LAUNCH`.
The audit must produce a traceable gap matrix:
`User moment → User goal → Surface → Entry trigger → Existing Product decision → Existing implementation → Visual status → Missing decisions → Missing implementation → Owner`.
### Work intentionally coupled to this phase
The following are not to be silently decided before evidence exists:
#### QANDEEL-specific Model / Provider Benchmark & Selection
The architecture remains provider-neutral. During the end-to-end phase, benchmark the actual QANDEEL workloads
and choose the text-model / FAST / DEEP and realtime/voice provider strategy from evidence.
Benchmarks must reflect real QANDEEL use rather than generic model rankings.
#### Plans / Credits / Usage Economy
Define the Product economy using real workload and provider-cost evidence.
Existing CW2-08 authority remains binding:
- entitlement controls actions, not ownership;
- credit exhaustion may restrict premium actions without deleting owned data/history;
- Credits are resource/compute availability only;
- Credits never modify consent, ownership or truth.
The roadmap freezes **no** credit formula, price, rollover rule, top-up rule, visible unit, allowance or exhaustion
behavior.
#### Complete Account / Authentication Lifecycle
T-14 already provides the narrow Product Sign-In Gateway, but deliberately excludes logo/lantern/brand treatment,
sign-up, password reset, onboarding, social auth and broader credential UX.
The end-to-end audit must determine the complete Product entry/account lifecycle and identify which parts need
Product contracts and implementation.
---
## 4. Production Integration & Implementation
After the Final Product Decision Closure and the End-to-End Product Experience Completeness Audit have produced
the required closed decisions and scoped implementation work, move into Production Integration.
This phase consumes frozen authority rather than inventing it.
Expected integration domains include, subject to the audit's final decomposition:
- final authenticated Product shell;
- final signed-out / first-use experience;
- I-08B visual system and the canonical Living Analysis World;
- Conversation / Analysis presentation;
- Profile / Settings / Memory / Understanding surfaces;
- Shared / Public / Introductions Product surfaces;
- Voice runtime and production presentation;
- Replay Product surface;
- notification / Activity runtime and presentation;
- selected model/provider configuration;
- plans / credits / entitlement implementation.
No item above is independently authorized for implementation by this roadmap.
---
## 5. Release Hardening & Launch
The final roadmap layer is release readiness, including the scopes already owned or gated by canonical records:
- physical iOS / Android device validation;
- pre-release credential security (`QAN-SEC-01`);
- Connected Worlds `I-09` / `CW2-08` safety, moderation, entitlement and Launch Gate work;
- legal / telecom gates where required;
- store/billing production readiness where the commercial model requires it;
- observability, failure recovery and operational readiness;
- performance and heavy-history stress validation;
- final launch-capability matrix and fail-closed verification.
Architecture/design freeze never equals public-launch readiness.
---
## 6. Immediate next step
P1, P2 and P3 are `CLOSED / FROZEN` as Product / design contracts. The next Product discussion/work track is:
> **P4 — Remaining Product / Visual Gaps Census & Closure**
It is deliberately **not yet opened as a Task Contract**. Product discussion comes first.
After P4, begin the End-to-End Product Experience Completeness Audit.