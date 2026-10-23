# QANDEEL — Product Roadmap
**Status:** `PRODUCT-OWNER ROADMAP / SEQUENCING AUTHORITY — CREATES NO PRODUCT OR RUNTIME SEMANTICS`
**Roadmap decision date:** 2026-09-25
**Repository baseline when recorded:** `3c6c0f162c97c75c8d2d55af2a604b20419e7ac9`
This roadmap records the Product Owner's agreed forward sequencing after the repository current-state
reconciliation. It does not itself open an implementation task, define runtime semantics, override a frozen
contract, or turn a backlog entry into executable work.
Every concrete work item still requires its own scoped Task Contract before execution.
---
> **CURRENT TASK (2026-10-23):** S8A-03 — Personal Understanding Reality; CP0 delivered and reviewed by the Founder, CP1 delivered and accepted, CP2 delivered (local; migration 0171 local only) and at the independent CP2 review gate, one pull request at the end, not merged (the S8A-03 note after §6.29). S8A-02 merged through PR #354 as `37812845` (2026-10-23). S8A-04 … S8A-08 have not started.
>
> *(Previous:)* **CURRENT TASK (2026-10-23):** S8A-02 — QANDEEL Conversational Personality & DeepSeek Real-Model Quality; CLOSED at its final review & merge gate: CP1–CP3 delivered, BG-08 / BG-09 reconciled, one pull request, not merged (the S8A-02 note after §6.29). S8A-01 merged through PR #353 as `d566a7e7` (2026-10-21). The rest of Stage 8A (S8A-03 … S8A-08) has not started.
>
> *(Previous:)* **CURRENT TASK (2026-10-21):** S8A-01 — DeepSeek Production Integration & First Real Conversation; CLOSED at its final review & merge gate: CP1–CP4 delivered, CP4 passed, not merged (§6.29).

> **LATEST EXECUTION DIRECTION (2026-10-20):** Stage 7 / S7-05 merged through PR #351 (`daa5c415cb1d3bbbb987ea6e9ce750ceb43768dd`) and is engineering-complete, not deployed or launch-ready. Stage 8A is NEXT, at approved **planning direction** only: DeepSeek Flash is the sole model to qualify for QANDEEL, with friendly/familiar/spontaneous personality from the outset, appropriate seriousness, dialect fidelity, real Personal knowledge and HIM, Shared/Public semantics and Matching, measured cost per successful outcome. No implementation task or model has passed acceptance. Stage 8B owns contextual Arabic vocalization **before TTS** under existing `QAN-BL-VOICE-01`; Stage 9 keeps Credits / Economy / Launch. See [Stage 8A WP0 direction](docs/e2e/QANDEEL_S8A_WP0_DEEPSEEK_PRODUCT_DIRECTION_v1.md) and [Project Map](QANDEEL_PROJECT_MAP.md) §5. Older execution notes are historical.

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
  - `S6-06` — Progressive Disclosure, SUCCESS and Reactivation (photos and the `FULL_NAME` display consent included); *(2026-10-16: in progress, CP1 delivered, §6.15; 2026-10-17: CP2 delivered, closed and ready for the Product Owner's review and merge decision, not merged, §6.16)*;
  - `S6-07` — Activity, Direct Entry and Final Integration; *(2026-10-18: CP0 approved; CP1 Governed Enrollment delivered, not merged, §6.19; CP1 closed and CP2 Forward Dispatcher delivered, not merged, §6.20; CP2 and CP3 closed, CP4 delivered — S6-07 closed and ready for the Product Owner's review and merge decision, not merged, §6.21)*.
  - *(Product Owner, 2026-10-17:)* `ACCT-DEL-01` — Account Deletion Across Matching / Introductions, before S6-07 (`QAN-BL-MATCH-01`'s dependency); CP1 delivered, §6.17; CP1 approved and CP2 delivered, closed and ready for the Product Owner's review and merge decision, not merged, §6.18; merged through PR #345 as `1861df43` (2026-10-17), §6.19.

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

### 6.14 Execution note — 2026-10-16 (S6-04 merged; S6-05 closed, ready for the merge decision)
**Recorded:** 2026-10-16 by S6-05, in the S6-05 pull request (not merged). This is a status note only; §6.9 … §6.13 stay
as written.
- **Merged:** S6-04 through PR #342 as `35ad4e19ad7e449255e7d087d4420b5d3775cf86` (2026-10-15; not deployed).
- **Started:** the Product Owner's S6-05 Task Contract v1.0 (D1–D7, 2026-10-15) started **S6-05 — Mutual Match &
  Introduction World** from `main` at `35ad4e19`. It is **CLOSED / READY FOR PRODUCT OWNER REVIEW / MERGE DECISION — CP4 APPROVED, CP5 DELIVERED (MOBILE INTRODUCTION EXPERIENCE) — VISUAL GATE AND COPY GATE CLOSED — NOT MERGED / NOT DEPLOYED**, on one pull request ([S6-05 record](docs/e2e/QANDEEL_S6_05_IMPLEMENTATION_RECORD_v1.md)).
- **Decided (2026-10-15):** R-1 … R-8 (R-1: D3 is within GATE-30, ACE-SP-01 unchanged); the Visual Gate and the Copy Gate
  closed; CP2 authorized.
- **Delivered (CP2):** migration `0159` (the second recipient's acceptance over the frozen `0114` core) and its API route,
  with the verifier, the live-PostgREST proof, the re-anchored census pins and a static contract.
- **Approved (2026-10-16):** CP2, after green exact-head CI and live PostgREST on the four lines; CP3 authorized.
- **Delivered (CP3):** migration `0160` (discovery, reading and human text messaging in the Introduction World beside the
  S6-02 fence; no AI, weaving, Activity or grant) and its API routes, with the verifier, the live-PostgREST proof and a
  static contract.
- **Approved (2026-10-16):** CP3, after green exact-head CI on `18988bc2` (real PostgreSQL and live PostgREST on the
  four lines); CP4 authorized. The Product Owner's checkpoint rule makes CP5 S6-05's last checkpoint (mobile surfaces,
  integration, tests, final documentation and BG-08 / BG-09 in the same pull request).
- **Delivered (CP4):** migration `0161` (the closed Introduction history on each human's own frozen entitlement; END
  and owner deletion reused unchanged) and its API routes, with the verifier, the live-PostgREST proof and a static
  contract.
- **Approved (2026-10-16):** CP4, after green exact-head CI on `206af257` (real PostgreSQL and live PostgREST on the
  four lines); CP5 authorized as S6-05's last checkpoint.
- **Delivered (CP5):** the mobile Introduction experience on exactly the approved V-1 and copy (acceptance, «بدأ
  التعارف», the «التعارف» section, the Introduction World, END and the closed record), through one strict client of the
  existing routes, with no server change; a validation-only native visual proof; the closing change (BG-08 / BG-09):
  nothing inherited, tombstoned or re-owned, 70 items unchanged.
- **Not delivered by S6-05 (each its own owner):** the forward producer `QAN-BL-MATCH-06` (S6-07); Activity, Push and
  Direct Entry (S6-07); photos, disclosure, SUCCESS and reactivation (S6-06); Introduction intelligence (Stage 8A);
  launch clearance (Stage 9 / CW2-08). *(As written at CP4: "Not delivered yet: CP5 (every mobile surface, END on mobile
  included)"; as written at CP3: "CP4 (END on mobile, closed history), CP5 (mobile)".)*
- **Still closed:** every Matching and launch gate; nobody is shown ACCEPT in production. Issue #322 stays open.
- **Next:** the Product Owner's review of S6-05 and the merge decision («ادمج»). S6-06 is not started. *(As written at
  CP4: "the Product Owner's review of the CP4 report"; as written at CP2: "the Product Owner's review of the CP2
  report".)*

### 6.15 Execution note — 2026-10-16 (S6-05 merged; S6-06 CP1 delivered)
**Recorded:** 2026-10-16 by S6-06, in the S6-06 pull request (not merged). This is a status note only; §6.9 … §6.14 stay
as written.
- **Merged:** S6-05 through PR #343 as `88a475ab6798edbf511e42f78a2f70e5cdb37c34` (2026-10-16; not deployed).
- **Started:** the Product Owner's S6-06 Task Contract v1.0 started **S6-06 — Progressive Disclosure, Photos, SUCCESS &
  Reactivation** from `main` at `88a475ab`. WP0 v1.1 and its five-point correction were approved on 2026-10-16 (D-01 …
  D-12, three execution conditions inside CP1). It is **IN PROGRESS — CP1 DELIVERED (SECURE BACKEND & MEDIA) — VISUAL GATE
  AND COPY GATE PRESENTED, NOT APPROVED — NOT MERGED / NOT DEPLOYED**, on one pull request
  ([S6-06 record](docs/e2e/QANDEEL_S6_06_IMPLEMENTATION_RECORD_v1.md)).
- **Delivered (CP1):** migrations `0162` (text shares, the three-stage photo, the `FULL_NAME` display consent) and `0163`
  (SUCCESS as two approvals and a separate system completion; reactivation); the API's sharing and continuation modules,
  the private S3-protocol object store, the in-memory pipeline and the erasure worker; the verifiers, the live proofs with
  PostgREST, rclone and the compiled API, and a static contract; the Visual / Copy Gate package (74 PROPOSED rows, real
  blur samples) presented. `QAN-BL-PROD-08` admitted (owner `HOSTED-DEPLOY-01`).
- **Still closed:** every launch gate; nothing is shared, stored or shown in production; no SUCCESS version exists before
  Stage 8A. Issue #322 stays open.
- **Next:** the Product Owner's review of the CP1 report and the explicit approval of the Visual Gate, the Copy Gate and
  the D-04 values, before any mobile surface (CP2).

### 6.16 Execution note — 2026-10-17 (S6-06 CP2 delivered; S6-06 closed, not merged)
**Recorded:** 2026-10-17 by S6-06, in the S6-06 pull request (not merged). This is a status note only; §6.9 … §6.15 stay
as written.
- **Decided:** CP1 proven on GitHub at `f474d7a4`; the Copy Gate (74 rows, the 16 gender-neutral Arabic rows under
  LANG-01, PD-03 «مشاركاتي»), D-04 = 12 / 48 / 1600 and the Visual Gate rev.2 (P0 – P16) approved by the Product Owner;
  CP2 authorized inside S6-06 and PR #344 ([gate record](docs/e2e/QANDEEL_S6_06_VISUAL_COPY_GATE_v1.md) §4 – §5).
- **Delivered (CP2):** the mobile surfaces as approved — the sharing panel in the live Introduction World, the
  three-stage photo drawn from memory only, deletion and removal, the display-name consent, SUCCESS (drawn only with a
  real transition, so never before Stage 8A), the status line and resume, and the Settings page «ما شاركته في التعارف»;
  no camera, microphone, storage or media permission; content-free erasure telemetry; an Android emulator proof in five
  legs with zero image files left on the device. `QAN-BL-LAUNCH-05` admitted (iOS photo-cache proof and store review,
  Stage 9). S6-06 is **CLOSED / READY FOR PRODUCT OWNER REVIEW AND MERGE DECISION — NOT MERGED / NOT DEPLOYED**
  ([S6-06 record](docs/e2e/QANDEEL_S6_06_IMPLEMENTATION_RECORD_v1.md)).
- **Still closed:** every launch gate; nothing is shared, stored or shown in production. Issue #322 stays open.
- **Next:** the Product Owner's review of PR #344 and the merge decision («ادمج»). S6-07 is not started.

### 6.17 Execution note — 2026-10-17 (S6-06 merged; ACCT-DEL-01 CP1 delivered)
**Recorded:** 2026-10-17 by ACCT-DEL-01, in the ACCT-DEL-01 pull request (not merged). This is a status note only; §6.9 …
§6.16 stay as written.
- **Merged:** S6-06 through PR #344 as `4233c06739149fb19b441db782837497815d8be6` (2026-10-17; not deployed).
- **Decided:** the Product Owner approved the ACCT-DEL-01 WP0 report v1, its review addendum v1.1 and decisions P-1 … P-4
  (2026-10-17), and authorized **ACCT-DEL-01 — Account Deletion Across Matching / Introductions** in one pull request (CP1,
  then CP2), before S6-07: `QAN-BL-MATCH-01`'s mandatory dependency. `QAN-BL-ACCT-01` is re-owned to ACCT-DEL-01 and stays
  open (P-1).
- **Delivered (CP1):** migration `0164` — one governed account erasure over the account's whole Matching / Introductions
  footprint and the unchanged `0130` Personal erasure, in one transaction or nothing; the counterpart's retained words, an
  ordinary END and an exact Matching lineage; residue classes with recovery; two-level photo erasure — its real-PostgreSQL
  verifier and static contract, and the API pass on it
  ([ACCT-DEL-01 record](docs/e2e/QANDEEL_ACCT_DEL_01_IMPLEMENTATION_RECORD_v1.md)).
- **Not closed by it:** account deletion for Shared `STANDARD` and Public (`ACCT-DEL-02`) and Replay (Stage 7); those
  footprints answer a truthful, recorded `BLOCKED`. No Connected World other than Matching / Introductions has a
  complete, proven account-deletion path.
- **Still closed:** every launch gate and CW2-08.
- **Next:** the Product Owner's CP1 review. CP2 (the closure, same pull request) only after its approval. S6-07 is not
  started.

### 6.18 Execution note — 2026-10-17 (ACCT-DEL-01 CP1 approved; CP2 delivered; ACCT-DEL-01 closed, not merged)
**Recorded:** 2026-10-17 by ACCT-DEL-01's closing change (CP2), in the same pull request (#345, not merged). This is a status
note only; §6.17 stays as written.
- **Decided:** the Product Owner verified CP1 independently on GitHub and approved it on its exact head `90681312` (API CI
  and Mobile CI green, `0164` on real PostgreSQL included), and started CP2 in the same pull request.
- **Delivered (CP2, documentation and governance only):**
  - **Status:** ACCT-DEL-01 is **CLOSED / READY FOR PRODUCT OWNER REVIEW AND MERGE DECISION — NOT MERGED / NOT DEPLOYED**
    ([ACCT-DEL-01 record](docs/e2e/QANDEEL_ACCT_DEL_01_IMPLEMENTATION_RECORD_v1.md) §8).
  - **Handled:** account deletion across Matching / Introductions.
  - **Still open:**
    - `QAN-BL-ACCT-01` stays open, re-owned to `ACCT-DEL-02` (Shared `STANDARD` / Public);
    - `QAN-BL-ACCT-02` (Replay) is owned by Stage 7.
  - **Release gate:** `QAN-BL-PROD-09` is a mandatory condition of `HOSTED-DEPLOY-01`. No World opens in production
    without an automated account-deletion coverage check read on the hosted project. The repository's coverage check is
    not by itself a deployment block.
- **Sequencing (Product Owner direction, recorded; it authorizes nothing):**
  - **S6-07:** `QAN-BL-MATCH-01`'s `ACCT-DEL-01` dependency is met in engineering from the merge. S6-07 — Activity,
    Direct Entry and Final Integration — stays the next Stage 6 task, not started, needing its own authorization.
  - **`ACCT-DEL-02`:** not opened.
  - **Stage 7:** LATER.
- **Still closed:** every launch gate, CW2-08 and the six suspended Matching commands. Account deletion in QANDEEL as a
  whole is not closed.
- **Next:** the Product Owner's review and merge decision («ادمج») on the final head. S6-07 is not started.

### 6.19 Execution note — 2026-10-18 (ACCT-DEL-01 merged; S6-07 CP0 approved; CP1 delivered)
**Recorded:** 2026-10-18 by S6-07 CP1, in the S6-07 pull request (not merged). This is a status note only; §6.9 … §6.18
stay as written.
- **Merged:** ACCT-DEL-01 through PR #345 as `1861df43943a8695a761edec7aa42f5e18f018ec` (2026-10-17; not deployed).
- **Decided:** the Product Owner approved the S6-07 CP0 design and its review addendum (Q1, Q2(b), Q3-A, Q4′, Q5′, Q6,
  Q7′ / Q7″, Q8(A), Q9, Q10), the Controlled Amendments they need, and one binding condition for CP4: the 32 MiB export
  bound is a technical guard, never a limit on the right to export; a safe path for larger photo sets is delivered in
  S6-07 itself. CP1 (Governed Enrollment) was authorized; CP2 waits for the CP1 review.
- **Delivered (CP1):** migration `0165` — the ONE governed enrollment boundary over the frozen setup commands, closed by
  default; the reviewed draft promoted with its evidence; three independently revocable consents, each bound to its exact
  version; the empty requirement version and the zero-field disclosure authority; refused during account deletion — its
  real-PostgreSQL verifier, live PostgREST proof, static contract and two owner-only API routes ([S6-07 record](docs/e2e/QANDEEL_S6_07_IMPLEMENTATION_RECORD_v1.md)).
- **Still closed:** the `ENROLLMENT` gate (no row) and the consent texts (none; Copy Gate in CP3), so nothing can be
  enrolled in production; the six commands for every application role; CW2-08 and every launch gate.
- **Decided (CP1 correction):** D-CP1-1 = B — no optional field is required to enroll; a reviewed draft with neither
  optional profile field enrolls with a real profile version that has no field rows (CA-D-CP1-1-impl), applied inside CP1.
- **Next:** the Product Owner's CP1 review. CP2 (the forward dispatcher) only after its approval; no merge without «ادمج».

### 6.20 Execution note — 2026-10-18 (S6-07 CP1 closed; CP2 delivered)
**Recorded:** 2026-10-18 by S6-07 CP2, in the S6-07 pull request (not merged). This is a status note only; §6.9 … §6.19
stay as written.
- **Decided:** the Product Owner closed CP1, the D-CP1-1 correction included, after API CI and Mobile CI were green on
  `05cc2cbc`, and authorized CP2 (the forward dispatcher, Q5′, CA-SYS-02); not CP3, a merge, a deployment or a gate.
- **Delivered (CP2):** migration `0166` — the ONE server-side producer of the forward step over the frozen core, with the
  pair lock first, one attempt per transaction, a ledger whose ids make every retry the committed answer, and a read-only
  lister for the Activity recovery path — its real-PostgreSQL verifier (six races), a live PostgREST proof with the
  compiled worker, a static contract and a server worker with no route ([S6-07 record](docs/e2e/QANDEEL_S6_07_IMPLEMENTATION_RECORD_v1.md) §10).
- **Still closed:** CW2-08 (`NOT_EVALUATED`), so nothing is forwarded in production; no conclusion producer (Stage 8A); no
  notification of a delivered proposal before CP3. The dispatcher makes neither Stage 8A nor Matching production ready.
- **Next:** the Product Owner's CP2 review. CP3 (Activity, Direct Entry) only after its approval; no merge without «ادمج».

### 6.21 Execution note — 2026-10-18 (S6-07 CP3 closed; CP4 delivered; S6-07 closed, not merged)
**Recorded:** 2026-10-18 by S6-07 CP4, in the S6-07 pull request (not merged). This is a status note only; §6.9 … §6.20
stay as written.
- **Decided:** the Product Owner closed CP2 (`ad1e4138`) and CP3 (`3aaad0fd`, with its review correction), each after API
  CI and Mobile CI were green, and authorized CP4 — Export My Data & Final Integration, the last checkpoint.
- **Delivered (CP4):** migration `0168` (the reader's own Matching / Introductions data in Export My Data), the export
  bundle with every photo the reader may download (the 32 MiB guard bounding one answer, never the export), the device
  folder save, and the final integration journey on the human boundaries from enrollment to export
  ([S6-07 record](docs/e2e/QANDEEL_S6_07_IMPLEMENTATION_RECORD_v1.md) §12). S6-07 is closed and ready for the Product
  Owner's review and merge decision; the Product Owner approved CA-EXP′ on 2026-10-18.
- **Still closed:** the `ENROLLMENT` gate and every launch gate, CW2-08 (`NOT_EVALUATED`), the hosted environment (no
  consent texts installed, nothing deployed). Stage 6 is not launch-ready.
- **Next:** the Product Owner's review of S6-07; no merge without «ادمج»; Stage 7 is not started.

### 6.22 Execution note — 2026-10-19 (S6-07 merged; Stage 7 WP0 approved; S7-01 delivered, at its Independent Review Gate)
**Recorded:** 2026-10-19 by S7-01, in the S7-01 pull request (not merged). This is a status note only; §6.9 … §6.21
stay as written.
- **Decided:** S6-07 merged through PR #346 as `3ea76f37c1c7c87661bad480e90460cc1edf7da2` (not deployed). The Product
  Owner approved the Stage 7 / WP0: a personal, text-only Replay with a real preview and a private final version; no
  exported video, external distribution or separate Replay library; one contiguous range of whole messages; `MY_WORLD`
  only; never present non-existent audio as original audio; Replay reuses the existing analysis screens. **Stage 7 is
  ACTIVE**, in five tasks: S7-01 the secure integration and erasure; S7-02 entry and selection in the app; S7-03 the
  composite player proof; S7-04 the production player and navigation; S7-05 the final version, device proof and closure.
- **Delivered (S7-01):** migration `0169` (the Personal Replay boundary over the frozen I-06 runtime, closed by its
  capability gate, and Replay's account-erasure module) and the graphics-independent API `apps/api/src/replay`
  ([S7-01 record](docs/e2e/QANDEEL_S7_01_IMPLEMENTATION_RECORD_v1.md)). `QAN-BL-ACCT-02` is tombstoned from the merge;
  `QAN-BL-ACCT-03` admitted (Stage 9).
- **Still closed:** the Personal Replay capability (no gate row), CW2-08 (`NOT_EVALUATED`), every distribution path,
  the hosted environment. Replay is not available to users.
- **Next:** the independent review of S7-01 and the Product Owner's decision; no merge, deployment or user opening
  without the Product Owner's approval. S7-02 and S7-03 start only on the Product Owner's word.

### 6.23 Execution note — 2026-10-19 (S7-01 merged; S7-02 delivered, at its Independent Review Gate)
**Recorded:** 2026-10-19 by S7-02, in the S7-02 pull request (not merged). This is a status note only; §6.9 … §6.22
stay as written.
- **Decided:** S7-01 merged through PR #347 as `c152cb4b5add0b47b080ae952b7f97ee3dbf866d` (not deployed; the capability closed). The Product Owner
  started S7-02 (entry and selection in the app).
- **Delivered (S7-02):** the «إعادة العرض» entry on the current Personal conversation and the selection of the whole
  conversation or one contiguous part, saving a real draft through the S7-01 API; no server, API or migration change
  ([S7-02 record](docs/e2e/QANDEEL_S7_02_IMPLEMENTATION_RECORD_v1.md)). Its Product Copy Gate is CLOSED: the Product Owner approved
  every Arabic row word for word on 2026-10-19; the English rows keep their earlier status.
- **Still closed:** the Personal Replay capability (no gate row), so the entry is not drawn for anyone; CW2-08
  (`NOT_EVALUATED`); the player, preview and every distribution path; the hosted environment.
- **Next:** the independent review of S7-02 and the Product Owner's merge decision; S7-03 starts only
  on the Product Owner's word.

### 6.24 Execution note — 2026-10-19 (S7-02 merged; S7-03 delivered, at its Independent Visual & Technical Review Gate)
**Recorded:** 2026-10-19 by S7-03, in the S7-03 pull request (not merged). This is a status note only; §6.9 … §6.23
stay as written.
- **Decided:** S7-02 merged through PR #348 as `3ad4e4143264f1af7a5fd759ccb0102f1b98d087` (not deployed; the capability closed), its
  Product Copy Gate CLOSED. The Product Owner started S7-03 with a binding decision: «Replay يملك الحقيقة التاريخية وترتيب
  اللحظات، لكن الجرافيك ملك نظام Living Analysis الحالي».
- **Delivered (S7-03):** the composite visual proof — one Replay moment's exact text and its analysis at that moment, through
  the S7-01 reads and a governed projection adapter, on the existing Living Analysis surface and Map; honest states for a
  version that is not viewable, an analysis not available now, a failed read and the two preview limits; a real-path proof
  chain from PostgreSQL to the rendered components ([S7-03 record](docs/e2e/QANDEEL_S7_03_IMPLEMENTATION_RECORD_v1.md)). No
  server, API or migration change. Its Product Copy Gate is CLOSED (2026-10-19: all 14 Arabic rows APPROVED word for word
  by the Product Owner; the English rows stay PROPOSED).
- **Still closed:** the Personal Replay capability (no gate row); CW2-08 (`NOT_EVALUATED`); the player, its navigation, the
  Analysis entry and preview / finalize / reopen in the Product UI (S7-04); every distribution path; the hosted environment.
- **Next:** the independent visual and technical review of S7-03 and the Product Owner's merge
  decision; S7-04 starts only on the Product Owner's word.

### 6.25 Execution note — 2026-10-20 (S7-03 merged; S7-04 delivered, at its Final Merge Review Gate)
**Recorded:** 2026-10-20 by S7-04, in the S7-04 pull request (not merged). This is a status note only; §6.9 … §6.24
stay as written.
- **Decided:** S7-03 merged through PR #349 as `0d8a73350f075402897421e9ebb88379fe165575` (not deployed; the capability
  closed). The Product Owner directed the player's layout (Visual Direction #1, option (b): CHROME_ONLY with a measured
  band), decided its navigation (Decision #2, «Replay Temporal Spine»: P2's Temporal Spine + Aperture C "Parting"), and
  after the visual review approved that direction with two corrections: the controls stay in reach while a long message
  scrolls, and P2's discontinuity is never reused for omitted messages. It then approved the visual design, decided G-1's
  correction within S7-04, and approved the 13 rows in Arabic and English (Product Copy Gate closed).
- **Delivered (S7-04):** the Personal Replay player — a passage over the Conversation or the Analysis with its two
  entries, the S7-03 composite on the ONE Living Analysis surface, the Replay Temporal Spine, P2's play / pause at a
  declared reading pace, and the private preview / finalize / reopen through the existing S7-01 routes
  ([S7-04 record](docs/e2e/QANDEEL_S7_04_IMPLEMENTATION_RECORD_v1.md)), in PR #350. One API change — G-1's list decoder —
  and no route or migration change. Its Product Copy Gate is CLOSED (13 rows APPROVED, Arabic and English).
- **Still closed:** the Personal Replay capability (no gate row); CW2-08 (`NOT_EVALUATED`); every distribution path; the
  hosted environment. Placed with S7-05: F-2's wire question, a real-device and TalkBack proof.
- **Next:** the Product Owner's merge decision on PR #350; S7-05 starts only on the Product Owner's word.

### 6.26 Execution note — 2026-10-20 (S7-04 merged; S7-05 CP1 delivered)
**Recorded:** 2026-10-20 by S7-05, in the S7-05 pull request (not merged). This is a status note only; §6.9 … §6.25
stay as written.
- **Decided:** S7-04 merged through PR #350 as `f9bc3947d840646385c618ea8db400914ca5aac4` (not deployed; the capability closed). The
  Product Owner's CP0 Final Decisions (2026-10-20): D1 — F-2 Option B, with conditions (only the scope's class crosses the
  Replay wire; the exact canonical form verified first; anything else refused, never repaired; no frozen authority or
  0169 change); D2 — the 27 English rows of S7-02 and S7-03 approved word for word; D3 — a real-device proof inside S7-05;
  D4 — `QAN-BL-NAV-02` approved in principle for closure at CP3, on complete evidence only; D5 — four focused tests.
- **Delivered (S7-05 CP1):** F-2 Option B in the API and the mobile decoder, with the wires regenerated from the real
  path; the 27 English rows; the post-merge reconciliation of S7-04 ([S7-05 record](docs/e2e/QANDEEL_S7_05_IMPLEMENTATION_RECORD_v1.md)).
- **Still closed:** the Personal Replay capability (no gate row); CW2-08 (`NOT_EVALUATED`); every distribution path; the
  hosted environment; Stage 8A.
- **Next:** CP2, the real-device proof on the Product Owner's Android phone; then CP3, the closure, stopping at the S7-05
  Final Independent Review & Merge Gate.

### 6.27 Execution note — 2026-10-20 (S7-05 closed, at its Final Independent Review & Merge Gate)
**Recorded:** 2026-10-20 by S7-05's closing change, in PR #351 (not merged). This is a status note only; §6.9 … §6.26
stay as written.
- **Decided:** the Product Owner waived the manual TalkBack test for S7-05 — `NOT REQUIRED FOR S7-05 — PRODUCT OWNER WAIVER`: no defect,
  blocker or backlog item, not moved to Stage 9, no pass claimed.
- **Delivered (S7-05 CP2 / CP3):** the real-device render proof on the Product Owner's Android phone, kept apart from the
  API / DB proof (no production journey through an open gate is claimed); the four D5 proofs; `QAN-BL-NAV-02` tombstoned
  for the Personal Analysis Replay and `QAN-BL-RSP-03` admitted, both from the merge
  ([S7-05 record](docs/e2e/QANDEEL_S7_05_IMPLEMENTATION_RECORD_v1.md) §7, §8, §10).
- **Stage 7:** S7-01 … S7-04 merged; S7-05 at its gate. On its merge Stage 7's planned scope — a personal, text-only
  Replay with a real preview and a private final version — is engineering-complete in the repository. It is not
  deployed and not launch-ready.
- **Still closed:** the Personal Replay capability (no gate row); CW2-08 (`NOT_EVALUATED`); every distribution path; the
  hosted environment; Shared and Public World Replay; Stage 8A.
- **Next:** the Product Owner's review and merge decision on PR #351. No merge, deployment, user opening or Stage 8A
  without the Product Owner's explicit approval.


### 6.28 Execution note — 2026-10-20 (S7-05 merged; DeepSeek-only Stage 8A planning direction)

### Execution direction — 2026-10-20, after S7-05 merge (current; supersedes earlier checkpoints)

- **Stage 7 DONE / MERGED (engineering only):** S7-01 through S7-05; final PR [#351](https://github.com/allamqandeel/qandeel/pull/351), merge `daa5c415cb1d3bbbb987ea6e9ce750ceb43768dd` (2026-10-20). Personal text Replay remains **NOT DEPLOYED / CLOSED TO USERS / NOT LAUNCH READY**. The Product Owner waived TalkBack for S7-05: neither a pass nor a future blocker; the Arabic visual proof was accepted. Do not reopen Stage 7.
- **Stage 8A NEXT — planning direction selected; no execution task yet:** qualify **DeepSeek Flash only** for QANDEEL, not an Anthropic/OpenAI bake-off. Retain the existing provider-neutral Model Router, Behavioral Runtime, FAST/DEEP, usage accounting, HIM, Memory, Shared/Public contracts and Matching gates. DeepSeek has **not yet passed** the production qualification or been deployed. The exact model/API configuration and paid-test costs require verification at execution.
- **QANDEEL personality decision:** naturally friendly, familiar and spontaneous **from the start** (friend-like conversational warmth without pretending to be a human or claiming emotions/relationship); switch naturally to sober, responsible and clear expression when circumstances demand. No rigid tone classifier, additional persona engine or forced jokes. Refining already approved model-facing wording requires its appropriate reviewed Product Copy / Controlled Amendment gate; this direction alone does not edit frozen copy.
- **Quality gate:** prove real dialogue, Egyptian and other supported dialects, preference precedence, humour/seriousness, natural acquisition/correction/semantic retrieval of user knowledge and grounded HIM, truthful Shared/Public semantic and spatial production, and consent-safe Matching readiness plus conclusion production. Real model evidence, privacy and cost **per successful outcome** matter more than a generic chat sample or raw token price.
- **Stage 8B LATER — Arabic speech disambiguation:** before delivering generated Arabic to TTS, design a contextual pronunciation/vocalization layer that resolves ambiguous unvowelled words, uses appropriate selective diacritization or provider-compatible pronunciation hints, and verifies Egyptian/other dialect pronunciations. Speech-side pronunciation text must not silently change the visible chat transcript or alter factual meaning. It is a **Voice runtime requirement**, not an S8A implementation task; tracked within existing `QAN-BL-VOICE-01` without a duplicate item.
- **Stage 9 LATER:** hosted release, policies, credits and launch readiness remain unapproved; model qualification is distinct from launch.
- **Provisional S8A work map (not open task contracts):** S8A-01 DeepSeek adapter + accounted real-text smoke; S8A-02 personality/dialects/preferences and feedback loop; S8A-03 Personal acquisition, correction, retrieval, Memory and HIM; S8A-04 Shared semantic/spatial bindings with `CW-05` decision; S8A-05 Public semantic/spatial bindings; S8A-06 Matching understanding readiness; S8A-07 safe Compatibility Conclusion producer; S8A-08 cross-world real-model, performance and economics exit proof. Sequence/task boundaries to be independently checked before execution; validation starts with the first model run, not only S8A-08.
- **Existing owned backlog, unchanged state/count:** `QAN-BL-CW-05`, `QAN-BL-IP-02`, `QAN-BL-ACE-02`, `QAN-BL-MATCH-03`, `QAN-BL-MATCH-04`; and the already existing `QAN-BL-VOICE-01` for Stage 8B. These are not new items. Full direction: [S8A WP0 DeepSeek direction](docs/e2e/QANDEEL_S8A_WP0_DEEPSEEK_PRODUCT_DIRECTION_v1.md). No branch, implementation code, paid evaluation, Product/Architecture amendment, feature-gate opening or merge is authorized by this documentation alone.

### 6.29 Execution note — 2026-10-21 (S8A-01 closed at its merge gate; CP4 passed)

- **S8A-01 — DeepSeek Production Integration & First Real Conversation** started from `main` at `26d05fff` (PR #352). At its
  CP0 gate the Product Owner gave the Closure & Implementation Direction (2026-10-21): Chat Completions and
  `deepseek-flash` only; FAST without thinking, DEEP at `low`, inside the existing latency policy; DeepSeek for the reply
  only, the seven background adapters not rebuilt now; a specific, tested output check before a reply is saved or shown;
  synthetic qualification only; one forward migration; no real user identifier.
- **Delivered (CP1–CP3), not merged:** the DeepSeek reply router behind the existing Model Router, refused in production
  and outside `SYNTHETIC_ONLY`; the output release guard; AI-COST-01 accounting through migration `0170` (DeepSeek
  `UNPRICED`, Credits not activated); deterministic tests including the real orchestrator over the accounted transport
  and real PostgreSQL. CP1–CP3 made no paid call. Record: [S8A-01](docs/e2e/QANDEEL_S8A_01_DEEPSEEK_PRODUCTION_INTEGRATION_IMPLEMENTATION_RECORD_v1.md).
- **Admitted from the merge:** `QAN-BL-AI-01` (real-user enablement; Stage 8A, with Stage 9 approving the compliance surfaces and the final release requirements), `QAN-BL-AI-02` (background calls still on
  OpenAI / Gemini; Stage 8A), `QAN-BL-AI-03` (time-of-day pricing; Stage 9).
- **CP4 (2026-10-21, under the Product Owner's CP4 Authorization):** six synthetic calls, ≈ USD 0.007 of USD 0.30. FAST
  passed: 1.07–1.73 s, concise Egyptian replies, a three-turn context carried, every call in the AI-COST-01 ledger, no
  content in telemetry. DEEP was aborted at its 10 s ceiling once; measured at 8.8 s, a full 2048-token DEEP needs
  about 15 s.
- **DEEP decision (Product Owner, 2026-10-21):** a controlled change raised the Personal DEEP budget to 20 s, with FAST,
  `max_tokens` and the 90 s deadline unchanged. A seventh synthetic call then completed DEEP in 8.7 s, so CP4 passed
  (≤ USD 0.0084). `QAN-BL-AI-04` was admitted (Shared / Public DEEP still 10 s), and CP4's Arabic-quality observations
  are filed under `QAN-BL-ACE-02` for the S8A-02 work.
- **Not claimed:** DeepSeek qualification beyond CP4's first real conversation (the Personal reply, synthetic data), "DeepSeek only", any real-user use, any gate opened.
- **Next:** the Product Owner's final review and merge decision on the S8A-01 pull request. No merge, S8A-02 or
  deployment without the Product Owner's explicit approval. *(Merged through PR #353 as `d566a7e7`, 2026-10-21.)*

### S8A-02 — QANDEEL Conversational Personality & DeepSeek Real-Model Quality (2026-10-21 … 2026-10-23; MERGED through PR #354 as `37812845`)

*S8A-02 merged through PR #354 as `378128452177508c5700a3ac3e86346c4eb33067` (2026-10-23); not deployed, closed to users. Reconciled by S8A-03 (2026-10-23). The bullets below are as written at its checkpoints and its closing change.*

- **Evaluated on DeepSeek Flash, synthetic data, the accounted AI-COST-01 path:** Round 1 (60 calls) and Round 2 (200
  calls, USD 0.209 at the peak rate). The branch renders core v3 ([amendment record](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-02_PERSONALITY_CORE_V2_CONTROLLED_AMENDMENT_v1.0.md)).
- **Product Owner's Round 2 review:** core v3 is **not adopted as written** and v2 is not restored.
- **Round 3 (2026-10-21):** core v3.1 (approved verbatim, rendered on the branch) against core v3. 78 calls, USD 0.044 at
  the peak rate. Neither version is clearly better: participant language is not solved, and gender and ALWAYS_BRIEF on DEEP
  are not improved. The diagnosis points to how Shared speakers are represented in the model input, not to wording; it
  awaits the Product Owner. A Shared information-attribution test is an acceptance condition of S8A-02.
- **Shared attribution (Product Owner decision, 2026-10-21):** core v3.1 is kept as an experiment only. The separated
  representation (a-1: one model message per person's message, visible Names, no identifiers) exists as a candidate that
  production does not send; production's merged input is proven byte-identical. A two-call DeepSeek probe precedes any
  attribution test; mixing between people blocks S8A-02's closure. Probe done (2 calls, USD 0.0012): DeepSeek accepts
  consecutive `user` messages on FAST and DEEP, both replies completed. Part T (attribution only, 60 calls, USD 0.12) is
  done (60 / 60, USD 0.026): information mixing proven in both representations (separated 4 replies, merged 2), the
  separated candidate worse on a quoted speaker line; neither representation is final, Part L not started.
  `AI-06` to `AI-09` block Shared readiness (`AI-09` admitted, 87 items). A server-sourced candidate is built for evaluation
  only, with free proofs. Its focused check is done (30 / 30, USD 0.0069): a quotation is no longer read as the quoted
  person speaking (0 / 3, production 2 / 3), and direct statements are kept (3 / 3). A speaker line written inside another
  person's message still mixes (2 / 3), so `AI-09` stays a HIGH blocker and the representation stays a candidate. A
  fail-closed attribution guard was designed and declined. A final free review on independent cases shows the server
  can verify only verbatim quotations, not freely worded attribution, so `AI-09` cannot close on a guarantee. The
  Product Owner decides how it closes: evidence-based acceptance, a narrower Shared behaviour, or deferral.
- **S8A-02 CP1 — Trusted Speaker & Message Provenance (2026-10-22; local; complete, awaiting the Product Owner's
  independent review):** the
  Shared reply now keeps the author the frozen `0089` resolver holds for each `material_id`. Each person's message is its
  own model message under their label; different people who share a Name, or have none, get " (1)", " (2)"; only
  request-local tokens leave the composition. No migration, RPC, Router, adapter or frame change. Proven at the Model
  Router boundary and in the DeepSeek body, zero calls. Message provenance only: `AI-08` / `AI-09` stay open. The
  separated messages and the collision-only " (n)" label are authorized by the narrow controlled amendment in the S8A-02
  record §5.3 (Product Owner, 2026-10-22), which replaces "Names only" in that scope and keeps the Shared frame's bytes.
- Register: `QAN-BL-AI-05` admitted (Stage 8A; FAST completed 2 / 12 short complex decisions against DEEP 12 / 12);
  `QAN-BL-AI-06` / `AI-07` / `AI-08` admitted (Stage 8A, HIGH: same Name, no Name, and the person an earlier QANDEEL reply
  answered, are all invisible to the model); `AI-09` admitted (HIGH: a line inside a message posing as another speaker);
  87 items. No routing, budget or real-user change. *(The bullets above are as written at each checkpoint.)*
- **S8A-02 CP3 — Personal Brain, Guard Impact & Personality Qualification (2026-10-22; Product Owner Final Correction
  Approval):** all verbatim in the [S8A-02 record](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-02_PERSONALITY_CORE_V2_CONTROLLED_AMENDMENT_v1.0.md) §5.4.
  - Personal core v3.2: the gender clause and the context sentence.
  - The IP-IMP-01 preference block leads the Personal guidance (header v2, ten lines v2); precedence is unchanged.
  - Personal FAST 10 s / DEEP 25 s, with the DeepSeek ceiling at 25 s and DEEP `max_tokens` 2800.
  - The Safety gate's Arabic whole-word correction.

  Round 9 delivered 132 / 132 (USD 0.0665 at the peak rate) and was provisionally NOT ACCEPTED (7 quality fails, 0
  critical). The Founder accepted the personality and conversational quality as a product decision and deferred the
  preference findings (Future Improvement 001). Round 9 is not claimed as a pass.
- **S8A-02 CP2 — Shared Attribution Layer (2026-10-22 / 2026-10-23).**
  - Round 10: 468 calls, USD 0.065. Provisional blind AI verdicts on gated cases gave critical attribution errors of
    B 24.3%, S 15.7% and S+R 10.2%. S vs B and S+R vs S both failed their preregistered criteria. Human review was not
    done.
  - The Founder's option (b) (2026-10-23):
    - tier 0 sends B; tiers 1 / 2 send S+R; a failed reading falls back to S;
    - a 2.5 s reading inside a 6 s FAST total; DEEP keeps 10 s in total.
  - It is governed by the [CP2 Controlled Amendment](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-02_CP2_SHARED_ATTRIBUTION_LAYER_CONTROLLED_AMENDMENT_v1.0.md) (CA-S1 / CA-S2 / CA-S3), registered in the Canonical Authority
    Index, and binds on the merge.
  - The production distribution was not measured as deployed.
- **S8A-02 closure (Founder, 2026-10-23): CLOSED / AT THE S8A-02 FINAL REVIEW & MERGE GATE — CP1–CP3 DELIVERED — BG-08 / BG-09 RECONCILED — NOT MERGED / NOT DEPLOYED / SYNTHETIC QUALIFICATION ONLY / CLOSED TO USERS**. One pull request, from `main` at `d566a7e7`.
  - Tombstoned: `QAN-BL-AI-06` / `AI-07` (completed by CP1) and `QAN-BL-AI-09` (product acceptance for v1). The limits
    are Future Improvement 002: non-blocking, unscheduled and not a release blocker.
  - Still open: `AI-04`, `AI-05`, `AI-08`, `ACE-02` and `IP-02`.
  - 87 items; 42 / 4 / 9 / 32 by status.
  - The final engineering review found three defects in the branch's own changes (the Safety gate's Arabic binding, the
    notes' label escaping and the notes' echo check); all three were corrected with tests, and no paid call was made.
  - The Future Improvements log is `docs/future-improvements/QANDEEL_FUTURE_IMPROVEMENTS.docx`.
  - S8A-03 … S8A-08 have not started. No real user's data reaches DeepSeek (`QAN-BL-AI-01`).

### S8A-03 — Personal Understanding Reality (2026-10-23 …; current task; CP2 delivered, at the independent CP2 review gate; one pull request at the end, not merged)

- Started 2026-10-23 on `s8a/s8a-03-personal-understanding-reality` from `main` at `37812845` (the merge of PR #354,
  S8A-02). CP0, an independent read-only review, was delivered and reviewed by the Founder, who approved its direction
  and F1 / F2 / F3 / F10. S8A-03 owns no backlog item at kickoff.
- Founder decisions:
  - D1: every production AI call goes to DeepSeek Flash; no OpenAI, Gemini or Anthropic fallback, and no Pro model.
  - D2: semantic cross-session retrieval, Egyptian Arabic included, is a precondition of the first launch, on DeepSeek
    only.
  - D3: closed systems are consumed; only narrow controlled amendments.
  - D4: acquisition, correction and semantic recall are proven; no invented or forgotten knowledge.
- **CP1 delivered, pushed and accepted** (`932dabb8`):
  - every production AI call is on DeepSeek Flash, and the OpenAI / Anthropic / Gemini production paths are removed;
  - the seven structured functions use Chat Completions with JSON Output, the shared DeepSeek client and the
    `SYNTHETIC_ONLY` gate, with their ports, validators, accounting families and timeouts unchanged;
  - governed by the candidate [S8A-03 DeepSeek Structured Functions Controlled Amendment](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-03_DEEPSEEK_STRUCTURED_FUNCTIONS_CONTROLLED_AMENDMENT_v1.0.md), which binds on the
    merge of the one S8A-03 pull request and records the Founder's eight CP2 corrections.
  - No migration, paid call or live-environment change. `QAN-BL-AI-02` stays open until the migration is proven
    complete, and no backlog ownership has moved.
- **CP2 delivered (pushed as `369ba841`, no PR; the Founder's review corrections R1–R3 applied locally; at the final CP2
  review; CP3 not started)** under the
  Founder's option B (DeepSeek Flash acquisition at write time, a semantic index at read time with no model call):
  - a separate background `UNDERSTANDING_CAPTURE_PROVIDER` effect (QIR-005 v2, four provider effects) proposes up to six
    facts per message plus search keys for at most four unindexed Memories; deterministic server verification keeps at
    most three, written at 0.80 by ONE atomic command; the deterministic Memory Write Evaluator is unchanged;
  - Memory retrieval gains a fail-soft semantic index path, beyond the 32 most recent Memories and with no recall cue
    needed; eligibility is read at read time, and same-slot current facts are served together as `UNSETTLED` (never a
    confirmed conflict), whole or not at all inside the context bounds (CP2 review R1 / R2);
  - migration `0171_s8a_03_personal_understanding_v1.sql`, **local only**, proven by `database/verify-migration-0171.mjs`
    on real PostgreSQL 17;
  - governed by the candidate [S8A-03 CP2 Personal Understanding Controlled Amendment](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-03_CP2_PERSONAL_UNDERSTANDING_CONTROLLED_AMENDMENT_v1.0.md)
    (QIR-001 §7 background exception, QIR-005 v2, the extraction stage, the semantic retrieval path; model texts
    verbatim), which binds on the merge of the one S8A-03 pull request;
  - the real-model quality of spans, readings and keys is CP3's to measure. No paid call, and no backlog ownership has
    moved; `QAN-BL-AI-02` stays open.
- `SYNTHETIC_ONLY` is kept. No real user's data reaches DeepSeek (`QAN-BL-AI-01` stays open).
