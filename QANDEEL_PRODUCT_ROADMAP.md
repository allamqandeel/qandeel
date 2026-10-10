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
## 2. Completed roadmap phase — Final Product Decision Closure
**Final Product Decision Closure is complete.** P1–P4 are `CLOSED / FROZEN`; P4 merged through PR #280 at
`d6d0999dea26ba97b595e8a97e1a630eb659874f` after exact-head independent review and validation.
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
**P4 — CLOSED / FROZEN** — closed by
[`docs/canonical-authority/final-product-experience/p4/QANDEEL_P4_FINAL_CLOSURE_v1.0.md`](docs/canonical-authority/final-product-experience/p4/QANDEEL_P4_FINAL_CLOSURE_v1.0.md),
merged through PR #280 at `d6d0999dea26ba97b595e8a97e1a630eb659874f` after independent review and exact-head validation. That record is the Product / Architecture authority for this
track; this section only records the lifecycle. Production implementation remains open.
APP-OPS-01 (QANDEEL App ↔ QANDEEL Company Operations Contract), the one explicit Product-Owner-approved cross-cutting
exception to the normal residual-canon boundary below, is `CLOSED / FROZEN` with it; P4's local evidence is in
[`docs/p4/`](docs/p4/P4_READ_FIRST.md). The standalone task **QANDEEL — Lantern Gateway Identity Moment v1** is carried
by the canonical backlog (`QAN-BL-LANTERN-01`); this roadmap does not sequence it.
The track's original scope, kept as written:
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
The closed APP-OPS-01 (§19, `PO-OPS-11`) extends that matrix, and does not replace it, with `Operational Events Required`
and `Company Controls Required` for every relevant User Moment, placed before `Owner`.
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
*Status note (2026-09-30):* the account / security / privacy Product decisions — Change Email, Security & Login v1,
the Shared ID format, app language, accessibility preferences, Export and the Delete Account journey — are closed by the
[W3-PDG-01 Product Decision Closure](docs/canonical-authority/final-product-experience/w3/QANDEEL_W3_PDG01_ACCOUNT_SECURITY_PRIVACY_PRODUCT_DECISION_CLOSURE_v1.0.md).
None is implemented. Account deletion across Connected Worlds stays blocked (`QAN-BL-ACCT-01`). That record proposes
`W3-MEGA-A` then `W3-MEGA-S` as sequencing only; this roadmap opens neither.
*Status note (2026-10-04, ROADMAP-REC-01):* both were later opened by their own Task Contracts and merged: W3-MEGA-A
through PR #295 and W3-MEGA-S through PR #296. Their named residuals are in
[`QANDEEL_CURRENT_STATE.md`](QANDEEL_CURRENT_STATE.md) §7. Account deletion across Connected Worlds is still blocked.
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
P1, P2, P3 and P4 are `CLOSED / FROZEN` as Product / design contracts. P4 is merged through PR #280 at
`d6d0999dea26ba97b595e8a97e1a630eb659874f`. The next roadmap phase was:
> **QANDEEL End-to-End Product Experience Completeness Audit**
*(Historical, as recorded on 2026-09-25: "It has not started, and this roadmap does not open it: it still requires its own
Task Contract." That is no longer the current state; see the reconciliation below.)* The sequencing in §3–§5 is unchanged.
### 6.1 Execution reconciliation — 2026-10-04 (refreshed through PR #305)
**Recorded:** 2026-10-04 by ROADMAP-REC-01; refreshed after `main = b1ce9c909fc5dab341e13a2ed7593ef3f477a8f4` (PR #305, W3-MEGA-S-CLOSE-01). The original reconciliation baseline was `7221a635…` (PR #303).
Evidence: [`docs/e2e/QANDEEL_ROADMAP_REC_01_CANONICAL_EXECUTION_MAP_RECONCILIATION_v1.md`](docs/e2e/QANDEEL_ROADMAP_REC_01_CANONICAL_EXECUTION_MAP_RECONCILIATION_v1.md).
This is a controlled sequencing / status reconciliation. It rewrites no P1–P4 decision and no earlier section above.
- **The End-to-End audit has started.** `E2E-01 — Complete Product Journey & Surface Census v1` started it
  ([`docs/e2e/E2E01_READ_FIRST.md`](docs/e2e/E2E01_READ_FIRST.md)). The audit phase is not closed.
- **Bounded Production Integration slices merged after it,** each under its own Product-Owner-authorized Task Contract:
  - W1A-01, W1B-01, W2-01, W2-02, W3-01, W3-02, W3-MEGA-U and W3-MEGA-M;
  - W3-MEGA-A (PR #295) and W3-MEGA-S (PR #296);
  - VPORT-01 (PR #297).
  W3-PDG-01 (PR #294) closed the W3 Product decisions.
- **Cross-cutting readiness / correction tasks were also completed and merged:**
  - PROD-SEC-02 (PR #299);
  - PROD-OPS-01 (PR #300);
  - PROD-SEC-01 (PR #301);
  - W3-CORR-U (PR #302);
  - AI-COST-01 (PR #303);
  - W3-MEGA-S-CLOSE-01 (PR #305), which closes the previously-unapproved W3-MEGA-S Product Copy Gate and admits `QAN-BL-A11Y-01` for VPORT-02.
  `PROD-READINESS-01` (PR #298) is closed unmerged, as evidence only. AI-COST-01 is an accounting foundation coupled to
  §3's economy and provider work. It decides neither: no Credit formula is frozen or active, and no provider is selected.
- **Next implementation task.** After this reconciliation refreshed through PR #305, the Product Owner has explicitly set
  **VPORT-02 — Timeline + Orientation Chrome + P2 Final Coherence** as the next implementation task. It is the remaining
  Stage-2 task of the working execution map in [`QANDEEL_PROJECT_MAP.md`](QANDEEL_PROJECT_MAP.md) §5.1.
- **Not promoted.** `PROD-AUTH-01` (`QAN-BL-PROD-04`) and `PROD-DATA-01` (`QAN-BL-PROD-05`) stay `DEFERRED — OWNED`.
  This update does not promote them.
- **Opens nothing.** This sequencing update authorizes no implementation except through a separate Task Contract. This
  document does not open VPORT-02.

### 6.2 Execution note — 2026-10-08 (SHARED-VIS-01)
**Recorded:** 2026-10-08 by SHARED-VIS-01; a status note only. It rewrites no earlier section and authorizes nothing.
- **Stages 1–5 are DONE / MERGED.** Stage 5 closed with S5-04 (PR #319, merged as `99470a92efe580f8939c0e416da8a3b9289a7a5f`)
  and its follow-up fix (PR #320, merged as `d4255744d090b11f383c270b5f1fdeb96af4ba51`). "Stage 5 DONE" is not "Public World
  launch-ready".
- **Current: SHARED-VIS-01 — Shared World Living Analysis Map Product Integration** (`QAN-BL-CW-03`), opened by its own Task
  Contract and the Product Owner's Decision Gate (Option A, D1–D7) — ACTIVE, not merged
  ([record](docs/e2e/QANDEEL_SHARED_VIS_01_SHARED_WORLD_LIVING_ANALYSIS_IMPLEMENTATION_RECORD_v1.md)).
- **Not started:** Stage 6 Matching, Stage 7 Replay, Stage 8A AI Brain, Stage 8B Voice, Stage 9 Economy / Launch.

### 6.3 Execution note — 2026-10-09 (SEC-MATCH-00)
**Recorded:** 2026-10-09 by SEC-MATCH-00. This is a status note only: it rewrites no earlier section and authorizes
nothing.
- **Inserted ahead of CI-01: SEC-MATCH-00 — Matching Direct-RPC Exposure & Account-Deletion Protection.** It is a P0
  cross-cutting security checkpoint, not a Product stage, and runs under its own Task Contract and the Product
  Owner's C0 / C1 / C2 gates.
  - C1 classified the hosted environment as `NOT_DEPLOYED`.
  - C2 (`APPROVE_C2_PATCH_B`, migration `0149`) is implemented and not merged; it is awaiting independent review and
    the Product Owner's merge decision
    ([record](docs/e2e/QANDEEL_SEC_MATCH_00_MATCHING_DIRECT_RPC_PROTECTION_IMPLEMENTATION_RECORD_v1.md)).
  - Deploying it is a separate approval.
- **Next after SEC-MATCH-00 closes: CI-01 — Shared Intelligence Learning Evidence & Baseline.** It has not started.
- **Paused:** S6-01 (Stage 6, Intelligent Matching Onboarding) stays at its decision checkpoint. It now owns
  `QAN-BL-MATCH-01`: Matching enrollment, correction and resume stay suspended until a reviewed Stage 6 launch path
  exists.

### 6.4 Execution note — 2026-10-10 (PROD-RETRY-01)
**Recorded:** 2026-10-10 by PROD-RETRY-01's closing change. This is a status note only: it rewrites no earlier section
and authorizes nothing.
- **SEC-MATCH-00** is `CLOSED / MERGED` through PR #323 as `e07857bab47f500a035e265b0eefc4b0bb65bd34`. It is not deployed.
- **Inserted after it: PROD-RETRY-01 — Data API 40001 Retry Hazard Closure** (`QAN-BL-PROD-06`). It is a cross-cutting
  launch and deployment gate, not a Product stage.
  - Migration `0150` is `CLOSED / READY FOR PO MERGE DECISION` on PR #324. It is not merged.
  - It is complete in the repository and **not deployed** on the hosted environment
    ([record](docs/e2e/QANDEEL_PROD_RETRY_01_DATA_API_STALE_STATE_IMPLEMENTATION_RECORD_v1.md)).
- **The Product sequence is unchanged: CI-01 — Shared Intelligence Learning Evidence & Baseline is next.** It has not
  started.
- **The hosted deployment gate is separate from the Product sequence.**
  - `QAN-BL-PROD-06` is `HIGH`, `DEFERRED — OWNED`, owner `HOSTED-DEPLOY-01`.
  - It blocks every hosted deployment that would expose an affected function, until `0150` is applied there or
    PostgREST `v16.0`+ is verified on the project itself.
  - Deploying needs the Product Owner's separate approval.
