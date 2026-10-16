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

### 6.5 Execution note — 2026-10-10 (CI-01 local closure)
**Recorded:** 2026-10-10 by CI-01's local closing change. This is a status note only: it rewrites no earlier section
and authorizes nothing.
- **PROD-RETRY-01** merged through PR #324 as `6a5fa42186c880d8c8cb2eee88f7b2b97cf44b24`. Migration `0150` is not deployed.
- **CI-01 — Shared Intelligence Learning Evidence & Baseline** ran from that `main`.
  - C0 Product decisions are approved (D1–D10, P1–P9).
  - C1-A (Canonical Evidence and Personality Baseline) and C1-B (Synthetic Intelligence Baseline) are delivered.
  - CI-01 is open as **Draft PR #325**: API / Mobile CI green on `a99a1b2`, the corrected head pending exact-head
    validation, **not merged**
    ([C1 contract](docs/e2e/QANDEEL_CI_01_C1_TASK_CONTRACT_DRAFT_v1.md)).
- **Not started:** C2, Stage 8A AI Brain and Stage 8B Voice. The proposed next direction after CI-01 merges is
  C2 — Personal Evidence Truth Maintenance / PG-02 (`QAN-BL-INTEL-01`, owner `INTEL-TM-01`), under its own contract.
- **Unchanged:** the hosted deployment gate (`QAN-BL-PROD-06`, owner `HOSTED-DEPLOY-01`) and every independent release
  blocker. The Product sequence after CI-01 is the Product Owner's decision.

### 6.6 Execution note — 2026-10-12 (GOV-REC-01)
**Recorded:** 2026-10-12 by GOV-REC-01 — Post-merge Locator & Closure-Record Reconciliation, from
`main = 84dd486c905cd3512bb206e48a2d7a63aa1c2d9b`. This is a status note only. It rewrites no earlier section, changes no
sequencing or Product Owner decision, and authorizes nothing. The "ACTIVE, not merged" of §6.2 and the "Draft PR #325 …
not merged" of §6.5 describe their own dates.
- **Merged since §6.5, none deployed:**
  - SHARED-VIS-01 (PR #321, `5973123153e26494d702a4a859a79631ede225cd`, 2026-10-09). Its missing closing change is
    recorded by GOV-REC-01.
  - CI-01 (PR #325, `44a440cfbb2c05421ed36639a5cf67ee7a8d25e5`).
  - INTEL-TM-01 (PRs #326 and #327).
  - MEM-AR-01 (PRs #328, #329 and #330, `3bec87ac725c73db0aecc5a6fb4e01c90acce66b`).
  - IP-IMP-01 (PR #331, `424cd0231429e5280a0e70be25c2f83437e117c8`).
  - ACE-01 (PR #332, `141a3190deb02bc6695d2ace05da275e623a2754`).
  - ACE-SP-01 (PR #333, `84dd486c905cd3512bb206e48a2d7a63aa1c2d9b`).
- **Execution status** (the 9-stage map in [`QANDEEL_PROJECT_MAP.md`](QANDEEL_PROJECT_MAP.md) §5.1):
  - **Stages 1–5: DONE / MERGED** within their implemented limits. Stage 1 keeps its named residuals, and "Stage 5 DONE"
    is not "Public World launch-ready".
  - **Current: GOV-REC-01** (PR #334), documentation / governance only. It is not a Product stage and not a Stage 6
    start.
  - **Stage 6 — Matching / Introductions: NEXT** after GOV-REC-01's independent review and the Product Owner's merge
    approval. It opens as *Stage 6 — Matching & Introductions Kickoff*, which begins with independent research and an
    Anti-duplication Census before its task count and contracts are fixed.
  - **Stage 7 Replay, Stage 8A AI Brain, Stage 8B Voice and Stage 9 Economy & Launch: LATER.**
- **Unchanged:**
  - the hosted deployment gate (`QAN-BL-PROD-06`, owner `HOSTED-DEPLOY-01`; the hosted database was at `0074` at the
    last approved check);
  - GitHub Issue #322 — the physical-Android rapid-interaction and resize stability proof required before any public
    launch — `OPEN / NOT PROVEN / RELEASE BLOCKER` (Stage 9 release-readiness gate);
  - every other independent release blocker.

### 6.7 Execution note — 2026-10-13 (Stage 6 WP0: Product Owner decisions)
**Recorded:** 2026-10-13 by the Stage 6 WP0 governance change (PR #335), from
`main = 135142004097136336d586e5d5ff6cfd119cd864` (the merge of PR #334, GOV-REC-01). This is a status note only. It
rewrites no earlier section, opens no task and authorizes no implementation. The "Current: GOV-REC-01" of §6.6 and the
"Paused" of §6.3 describe their own dates.
- **WP0 delivered** its research and planning evidence
  ([WP0 record](docs/e2e/QANDEEL_S6_WP0_MATCHING_INTRODUCTIONS_REPO_TRUTH_GAP_CENSUS_v1.md)). The Product Owner first
  approved its Tier 0, then issued a consolidated final approval package deciding every WP0 gate at the level record §14
  states (the sub-questions it leaves open are in §14.9).
  - The final approval package is **APPROVED subject to the explicit architecture, privacy, security and Copy Gate
    boundaries it states**.
  - It authorizes decision recording and governance updates only: no S6-01 implementation, runtime change, migration,
    deployment or merge.
- **Sequencing and framing:**
  - Stage 6 runs as S6-series execution tasks that reuse the frozen I-07 runtime and Connected Worlds authority. It may
    prepare closed-by-default integration boundaries.
  - I-09 / Stage 9 retains production launch authorization and gate opening.
  - Stage 6 may reach engineering integration completion with the production AI provider unbound. Real proposals and
    Introductions stay unavailable until Stage 8A and the required Stage 9 gates are satisfied.
  - MERGED is always distinct from DEPLOYED and LAUNCH-READY.
  - Phase `I-08` is not declared closed.
- **The approved planning direction** (subject to final Task Contracts):
  - `S6-01` — Intelligent Matching Onboarding;
  - `S6-02` — Introduction-Phase Privacy Isolation & Safe END Boundary;
  - `S6-03` — Matching Proposal Pipeline & Intelligence Prerequisites;
  - `S6-04` — Private Proposal Review and Decisions;
  - `S6-05` — Mutual Match & Introduction World;
  - `S6-06` — Progressive Disclosure, SUCCESS and Reactivation;
  - `S6-07` — Activity, Direct Entry and Final Integration.

  The package states that every task must undergo research, repository truth, anti-duplication, the Product Decision /
  Copy Gate where required, a Product Owner-approved Task Contract, proportional validation, independent review and the
  Product Owner's explicit merge approval. It also says to avoid XL monolithic implementations: a task may be split into
  focused, ordered work packages when justified, without duplicating frozen I-07 work or changing the approved stage
  count silently.
- **QANDEEL-wide language rule:**
  - All fixed Arabic application copy uses neutral or simplified Modern Standard Arabic and is gender-considerate.
  - Generated QANDEEL conversation adapts to the user's language and dialect.
  - Conflicting frozen or approved copy changes only through controlled Copy Amendments that the Product Owner approves
    (record §14.1, §14.8).
- **Register:** this PR admits `QAN-BL-LAUNCH-04` (Issue #322; owner `Stage 9 — Economy + Launch Closure
  (release-readiness gate)`), `QAN-BL-MATCH-02` (owner `S6-02`), `QAN-BL-MATCH-03` (owner `Stage 8A — QANDEEL AI Brain /
  Production LLM Runtime`) and `QAN-BL-PRIV-04` (owner `S6-07`; WP0's assignment under GATE-19, awaiting the Product
  Owner's confirmation; confirmed in §6.8). The register goes from 62 to 66 items (backlog §7; 67 after §6.8). `QAN-BL-MATCH-01` stays with `S6-01`.
- **Before S6-01:**
  - the historical S6-01 lifecycle references (this roadmap's §6.3 "Paused" against "Not started" elsewhere) are
    reconciled before its Task Contract;
  - the historical Return Gate (the "return gate" of the Product Owner's local notes, CI-02 … CI-05, not repository ids; WP0 record §6) is reconciled before it starts;
  - the controlled amendments that the decisions require are approved before any implementation they touch (record
    §14.7).
- **Unchanged:**
  - Stage 6 is still not started, and no Stage 6 Task Contract exists;
  - the hosted deployment gate (`QAN-BL-PROD-06`);
  - Issue #322 itself, which stays `OPEN / NOT PROVEN / RELEASE BLOCKER`;
  - every other independent release blocker.

### 6.8 Execution note — 2026-10-13 (Stage 6 WP0: final decision addendum)
**Recorded:** 2026-10-13 by the same governance change (PR #335). This is a status note only. It opens no task and
authorizes no implementation, and §6.7 stays as written.
- **Decisions** ([WP0 record](docs/e2e/QANDEEL_S6_WP0_MATCHING_INTRODUCTIONS_REPO_TRUTH_GAP_CENSUS_v1.md) §14.14):
  - **D1, GATE-16:** Matching v1 proposes opposite-sex male / female pairs only, on an explicitly declared and confirmed
    sex fact that is never inferred. A missing or unconfirmed fact is UNKNOWN and never eligible. The I-07 runtime has no
    sex dimension, so a controlled architecture amendment (CA-09) comes before any implementation.
  - **D2:** `QAN-BL-PRIV-04` is confirmed with owner `S6-07` and severity `HIGH`. S6-07 is not a cross-world export task.
  - **D3:** a separately owned account-deletion correction path, provisionally `ACCT-DEL-01`, for `QAN-BL-ACCT-01`. No
    real Matching enrollment happens before the deletion-blocking footprint is resolved.
  - **D4:** generated conversation respects an explicitly chosen language or dialect. Otherwise it follows the user's
    dialect when that is reasonably clear. If neither can be determined, it defaults to neutral simplified Modern
    Standard Arabic, never to Egyptian for every Arabic user. Fixed Arabic copy stays simplified Modern Standard Arabic.
  - **D5:** cross-world export completeness goes to `PRIV-EXPORT-01`, coordinating with Stage 7 for Replay
    (`QAN-BL-PRIV-05` admitted).
- **Parallel execution strategy (D6), after WP0 closes.** Two independent workstreams:
  - **LANG:** controlled Arabic authority amendments, Product Owner copy approvals and focused corrections, using the
    existing 109-unit census;
  - **S6:** Stage 6 Matching implementation, starting with S6-01 after its historical Return Gate and the required
    architecture decisions are reconciled.

  They run on independent branches and PRs, with no duplicated implementation. LANG owns existing Arabic copy and its
  language-authority amendments. S6 owns new Matching UX and follows the approved simplified-MSA rule. A shared text or
  frozen-contract dependency is resolved in its owning workstream first. Verification is focused per workstream, with
  proportionate integration verification. The 109-unit census is maintained, not restarted.
- **Register:** from 66 to 67 items (`QAN-BL-PRIV-05`; backlog §7).
- **Unchanged:**
  - neither workstream receives implementation authorization through the addendum;
  - Stage 6 is still not started, and no Task Contract exists;
  - PR #335 is not merged.

### 6.9 Execution note — 2026-10-13 (S6-01 start)
**Recorded:** 2026-10-13 by S6-01 at its CP1, in the S6-01 pull request (not merged). This is a status note only, and
§6.3, §6.7 and §6.8 stay as written.
- **Started:** the Product Owner's S6-01 Final Implementation Authorization (2026-10-13, D1–D7) starts **S6-01 —
  Intelligent Matching Onboarding** as the current implementation task, from `main` at
  `af94748de73cca744c466d8db526984427b94b38` (PR #335). The read-only WP-A reconciled the historical Return Gate and the
  architecture decisions first. §6.3's "Paused" was true at its date and is reconciled by this start.
- **Shape:** one task, one pull request, checkpoints CP1–CP4. S6-01 delivers a private, guided *preparation* inside
  `MY_WORLD` behind closed operator gates, under the CW2-06A controlled amendment
  ([S6-01 record](docs/e2e/QANDEEL_S6_01_INTELLIGENT_MATCHING_ONBOARDING_IMPLEMENTATION_RECORD_v1.md)).
- **Not changed:** the six `0149` commands stay closed (D1), so real enrollment is unavailable; S6-01 is not Intelligent
  Matching complete; nothing is deployed and no gate is opened; Issue #322 stays open as a release blocker.
- **Register:** from 67 to 68 items (`QAN-BL-MATCH-04`, Stage 8A, D7; backlog §7). `QAN-BL-MATCH-01` is re-owned to
  S6-07 (dependency `ACCT-DEL-01`) at S6-01's closing change.

### 6.10 Execution note — 2026-10-14 (S6-01 closing change)
**Recorded:** 2026-10-14 by S6-01 at CP4, in the S6-01 pull request (not merged). This is a status note only; §6.9
stays as written.
- **Status:** S6-01 is **CLOSED (CP4) — READY FOR PRODUCT OWNER REVIEW — NOT MERGED / NOT DEPLOYED**, on one draft pull
  request. Merging needs the Product Owner's explicit decision.
- **Delivered:**
  - preparation functionality (migration `0154`, API, the Living Portrait mobile surface);
  - VIS-2 / VIS-3 / VIS-3P and the VIS-3P R1 correction, with native proof
    ([S6-01 record](docs/e2e/QANDEEL_S6_01_INTELLIGENT_MATCHING_ONBOARDING_IMPLEMENTATION_RECORD_v1.md) §7.6, §7.7, §8).
- **Not delivered:**
  - real enrollment, which stays unavailable;
  - actual Matching intelligence (`QAN-BL-MATCH-04`, Stage 8A);
  - deployment and launch clearance.
- **Copy Gate:** CLOSED. The Product Owner approved the seven VIS-2 rows (95–101) byte-exact, 7 / 7, on 2026-10-14
  (record §7, §10.4).
- **Still open:**
  - every operator and launch gate, which stay closed;
  - Issue #322, which stays open as a release blocker.
- **Register:** `QAN-BL-MATCH-01` is re-owned to `S6-07` (mandatory dependency `ACCT-DEL-01`), effective from the merge.
  The register stays at 68 items (backlog §7).
- **Next:** the Product Owner's review of the S6-01 pull request. No later Stage 6 task is started by this note.

### 6.11 Execution note — 2026-10-15 (S6-01 merged; S6-02 implementation and closing change)
**Recorded:** 2026-10-15 by S6-02 at its closing change, in the S6-02 pull request (not merged). This is a status note
only; §6.9 and §6.10 stay as written.
- **Merged:** S6-01 through PR #339 as `2224c47f3dc83b16ad011ccbbdcf2aac19bf41f5` (2026-10-14; not deployed). Its re-owning
  of `QAN-BL-MATCH-01` to S6-07 holds from that merge.
- **Started and closed:** the Product Owner's implementation authorization of the approved Task Contract v1.2 (2026-10-15;
  A, A1, D1–D5 and six final clarifications) started **S6-02 — Introduction-Phase Privacy Isolation & Safe END Boundary**
  from `main` at `2224c47f`. It is **CLOSED / READY FOR PRODUCT OWNER MERGE DECISION — NOT MERGED / NOT DEPLOYED**, on one
  pull request ([S6-02 record](docs/e2e/QANDEEL_S6_02_IMPLEMENTATION_RECORD_v1.md)).
- **Delivered:** migration `0155` (one recipient-scoped name projection; Stage 4 Introduction-phase fences; no ADD /
  REJOIN in a Matching-born World; Replay and Public authoring exclude Introduction-era material; the one ungated END
  boundary over the frozen `0116` core), the END route, and their verifier, wire proof and static contract.
- **Not delivered (each its own task's):** the Introduction surfaces and the END mobile surface (S6-05); `FULL_NAME`
  display consent (S6-06); Activity producers and Direct Entry (S6-07); the Replay product (Stage 7); the canonical
  first-name source (`QAN-BL-MATCH-05`, S6-03).
- **Still closed:** every Matching and launch gate; the six `0149` commands. No Introduction World is reachable. Issue
  #322 stays open as a release blocker.
- **Register:** `QAN-BL-MATCH-02` tombstoned and `QAN-BL-MATCH-05` admitted, from the merge: 69 items (backlog §7).
- **Next:** the Product Owner's review of the S6-02 pull request. No later Stage 6 task is started by this note.

### 6.12 Execution note — 2026-10-15 (S6-02 merged; S6-03 implementation and closing change)
**Recorded:** 2026-10-15 by S6-03 at its closing change, in the S6-03 pull request (not merged). This is a status note
only; §6.9 … §6.11 stay as written.
- **Merged:** S6-02 through PR #340 as `8e85b40dcf9b4ba35439f9424997ad0c3a0c1113` (2026-10-15; not deployed). Its
  tombstone of `QAN-BL-MATCH-02` and its admission of `QAN-BL-MATCH-05` hold from that merge.
- **Started and closed:** the Product Owner's S6-03 Task Contract v1.3 (2026-10-15; D1–D7, C1–C8, R1, R2), with the
  CP1 approval of the exact text of the Controlled Amendment [CW2-06B](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-06B_CONFIRMED_FACTS_ELIGIBILITY_NEUTRAL_PRESENTATION_REPROPOSAL_CONTROLLED_AMENDMENT_v1.0.md), started **S6-03 — Matching Proposal
  Pipeline & Intelligence Prerequisites** from `main` at `8e85b40d`. It is **CLOSED / READY FOR PRODUCT OWNER MERGE
  DECISION — NOT MERGED / NOT DEPLOYED**, on one pull request ([S6-03 record](docs/e2e/QANDEEL_S6_03_IMPLEMENTATION_RECORD_v1.md)).
- **Delivered:** migrations `0156` / `0157` - confirmed facts with one internal writer, the confirmed first name,
  deterministic eligibility (the pair rule, the structured requirements, the R3 age rule, the R4 horizon), B4 and the
  neutral recipient projection, the Arabic/English privacy floor, the owner-only policy primitive, the re-proposal
  block, the fail-closed admission, orchestrator and sweeper - with their verifiers and static contract.
- **Not delivered (each its own owner's):** enrollment, promotion and correction (S6-07, `QAN-BL-MATCH-01`); deletion
  (`ACCT-DEL-01`); the real conclusion producer and understanding readiness (Stage 8A); policy values, activation and
  any re-proposal relaxation (Stage 9); the proposal screens and their copy (S6-04).
- **Still closed:** every Matching and launch gate; the six `0149` commands. No proposal, Match or Introduction can
  exist. Issue #322 stays open as a release blocker.
- **Register:** `QAN-BL-MATCH-05` tombstoned from the merge; nothing admitted: 69 items (backlog §7).
- **Next:** the Product Owner's review of the S6-03 pull request. No later Stage 6 task is started by this note.

### 6.13 Execution note — 2026-10-15 (S6-03 merged; S6-04 implementation)
**Recorded:** 2026-10-15 by S6-04, in the S6-04 pull request (not merged). This is a status note only; §6.9 … §6.12 stay
as written.
- **Merged:** S6-03 through PR #341 as `869b3ca63ec8dde830aaa31847588e7f03b55d05` (2026-10-15; not deployed). Its tombstone of
  `QAN-BL-MATCH-05` holds from that merge.
- **Started:** the Product Owner's S6-04 Task Contract v1.0 (D1–D12, 2026-10-15) started **S6-04 — Private Proposal
  Review and Decisions** from `main` at `869b3ca6`. It is **IMPLEMENTED — READY FOR PRODUCT OWNER REVIEW — PRODUCT COPY
  GATE CLOSED — NOT MERGED / NOT DEPLOYED**, on one pull request ([S6-04 record](docs/e2e/QANDEEL_S6_04_IMPLEMENTATION_RECORD_v1.md)).
- **Delivered:** migration `0158` (the caller's own proposals and three decision boundaries over the existing cores), the
  API routes and the mobile proposals space, with their verifier, live-PostgREST proof, tests and static contract, and the
  consolidated Copy Gate package, which the Product Owner closed on 2026-10-15 (CG-2: M-01 kept, not displayed).
- **Not delivered (each its own owner's):** the second recipient's acceptance, the Mutual Match and the Introduction
  surfaces (S6-05); Activity, Direct Entry and notifications (S6-07); the real conclusion producer (Stage 8A); launch
  clearance and policies (Stage 9 / CW2-08); enrollment (S6-07).
- **Still closed:** every Matching and launch gate. No proposal can exist, so nothing is listed or decided in production.
  Issue #322 stays open as a release blocker.
- **Register:** nothing inherited, tombstoned or admitted: 69 items (backlog §7).
- **Next:** the Product Owner's review of the S6-04 pull request and the merge decision. No later Stage 6 task is started
  by this note.

### 6.14 Execution note — 2026-10-16 (S6-04 merged; S6-05 in progress)
**Recorded:** 2026-10-16 by S6-05, in the S6-05 pull request (not merged). This is a status note only; §6.9 … §6.13 stay
as written.
- **Merged:** S6-04 through PR #342 as `35ad4e19ad7e449255e7d087d4420b5d3775cf86` (2026-10-15; not deployed).
- **Started:** the Product Owner's S6-05 Task Contract v1.0 (D1–D7, 2026-10-15) started **S6-05 — Mutual Match &
  Introduction World** from `main` at `35ad4e19`. It is **IN PROGRESS — CP2 APPROVED, CP3 DELIVERED (INTRODUCTION WORLD & HUMAN MESSAGING) — VISUAL GATE AND COPY GATE CLOSED — NOT MERGED / NOT DEPLOYED**, on one pull request ([S6-05 record](docs/e2e/QANDEEL_S6_05_IMPLEMENTATION_RECORD_v1.md)).
- **Decided (2026-10-15):** R-1 … R-8 (R-1: D3 is within GATE-30, ACE-SP-01 unchanged); the Visual Gate and the Copy Gate
  closed; CP2 authorized.
- **Delivered (CP2):** migration `0159` (the second recipient's acceptance over the frozen `0114` core) and its API route,
  with the verifier, the live-PostgREST proof, the re-anchored census pins and a static contract.
- **Approved (2026-10-16):** CP2, after green exact-head CI and live PostgREST on the four lines; CP3 authorized.
- **Delivered (CP3):** migration `0160` (discovery, reading and human text messaging in the Introduction World beside the
  S6-02 fence; no AI, weaving, Activity or grant) and its API routes, with the verifier, the live-PostgREST proof and a
  static contract.
- **Not delivered yet:** CP4 (END on mobile, closed history), CP5 (mobile). The
  forward producer is `QAN-BL-MATCH-06` (S6-07, admitted).
- **Still closed:** every Matching and launch gate; nobody is shown ACCEPT in production. Issue #322 stays open.
- **Next:** the Product Owner's review of the CP2 report. No later checkpoint is started by this note.
