# QANDEEL — Product Roadmap
**Status:** `PRODUCT-OWNER ROADMAP / SEQUENCING AUTHORITY — CREATES NO PRODUCT OR RUNTIME SEMANTICS`
**Roadmap decision date:** 2026-09-25
**Repository baseline when recorded:** `3c6c0f162c97c75c8d2d55af2a604b20419e7ac9`
This roadmap records the Product Owner's agreed forward sequencing after the repository current-state
reconciliation. It does not itself open an implementation task, define runtime semantics, override a frozen
contract, or turn a backlog entry into executable work.
Every concrete work item still requires its own scoped Task Contract before execution.
---
> **CURRENT TASK (2026-10-28, CP2):** S8B-01 — Voice Runtime Contract & Provider Evidence; CP1 merged through PR #364 as `de774cfd` (2026-10-28); CP2 — Gemini TTS & provider evidence (VA-11; one consumed run, USD 0.1155 of the USD 10 cap; partial: the expression set, the second voice, ASR, stage P and the render spike NOT RUN) — delivered; the expression set and the second voice then run on Google Cloud (592 / 592, USD 0.7950); TTS selection APPROVED by the Product Owner (Google Gemini TTS, `gemini-3.8-flash-tts`, voice Achird; one path); ASR, stage P and the render spike NOT RUN; no production code; every voice gate closed; CP2 not merged. S8A-06 … S8A-08 unchanged.
>
> *(As written at CP1:)* **CURRENT TASK (2026-10-28, CP1):** S8B-01 — Voice Runtime Contract & Provider Evidence (Stage 8B, started by the Product Owner's S8B-00 decision D-1); S8A-05 merged through PR #363 as `8b476114` (2026-10-27); CP1 — the candidate Voice Runtime contract, Controlled Amendment VA-1 … VA-10 (approved in principle), the locked non-production benchmark harness and the locator reconciliation — delivered and at the Product Owner's CP1 review; no production code, no paid call (USD 10 cap, nothing spent), every voice gate closed; `QAN-BL-VOICE-01` owned by Stage 8B; CP2 not started; not merged (the S8B-01 note at the end). S8A-06 … S8A-08 have not started; their state is unchanged.
>
> *(Previous:)* **CURRENT TASK (2026-10-27, CP4):** S8A-05 — Public World: Write Your Topic; S8A-05 CLOSED / READY FOR PO MERGE DECISION (2026-10-27): CP3 MERGED through PR #361 as `4ff74a80`; CP4 (Public Discussion Threads & the @qandeel Context) delivered on its Draft pull request, not merged (Controlled Amendment A-5; migration 0182 not hosted; CP4 Product Copy Gate CLOSED / APPROVED, 2 rows; Tier Q prepared, NOT RUN — no budget approval; production publishing closed); editing a published topic deferred to `QAN-BL-PUB-REV-01` (`PRE-LAUNCH BLOCKER`, owner `PUB-REV-01`, before Stage 9 opens production publishing), NOT implemented. Sequencing recorded by the Product Owner's CP4 decision: `PUB-REV-01` (published topic revisions and version-continuous discussion) is a `PRE-LAUNCH BLOCKER` that must be done and tested before Stage 9 opens production publishing; it is not started and needs its own Task Contract. Stage 8B and Stage 9 are not started.
>
> *(As written at CP3's review:)* **CURRENT TASK (2026-10-27, CP3):** S8A-05 — Public World: Write Your Topic; CP1 merged through PR #359 as `7c0356b7` (2026-10-26) and CP2 through PR #360 as `72898797` (2026-10-27); CP3 — Public Semantic Intelligence & Deterministic Spatial Placement — delivered on its Draft pull request and at the Product Owner's CP3 review (candidate Controlled Amendment A-4; migration 0181 not hosted; NO NEW COPY; production publishing closed until Stage 9; the Tier S / Tier P quality evaluation run once and NOT ACCEPTED on fabrication, the deterministic half met), not merged; CP4 not started; one pull request per checkpoint, none merged without the Product Owner's approval.
>
> *(As written at CP2's review:)* **CURRENT TASK (2026-10-27):** S8A-05 — Public World: Write Your Topic; CP1 merged through PR #359 as `7c0356b7` (2026-10-26); CP2 — Publish from QANDEEL — delivered on its Draft pull request and at the Product Owner's CP2 review (candidate Controlled Amendment A-3 + A-2(c) narrowing; migration 0180 not hosted; Copy Gate CLOSED / APPROVED (37 rows, 2026-10-27); production publishing closed until Stage 9), not merged; CP3 – CP4 not started; one pull request per checkpoint, none merged without the Product Owner's approval.
>
> *(As written at CP1's review:)* **CURRENT TASK (2026-10-26):** S8A-05 — Public World: Write Your Topic; S8A-04 merged through PR #358 as `9459245e` (2026-10-26); CP1 delivered on its Draft pull request and at the Product Owner's CP1 review (candidate Controlled Amendment A-1 / A-2; migration 0179 not hosted; Copy Gate CLOSED (every row APPROVED by the Product Owner); production publishing closed until Stage 9), not merged; CP2 – CP4 not started; one pull request per checkpoint, none merged without the Product Owner's approval.
>
> *(Previous:)* **CURRENT TASK (2026-10-25):** S8A-04 — Shared Social Understanding & Trusted Identity; CP1 merged through PR #356 as `43e67229`; CP2 merged through PR #357 as `b0839fd4` (2026-10-25) with the placer unbound; CP3 (Personal Knowledge in Shared World) on `s8a/s8a-04-cp3` first completes CP2 (the placer binding, amendment §7; the S4 deferral record, §13.10), then runs its WP0 to the Product Owner's gate; one pull request after CP3, not merged. *(Update, same day:)* the placer is bound and its free and paid integrated proofs passed (amendment §13.11), so CP2 is functionally complete and the Product Owner closed its functional gate; the CP3 controlled amendment was PROPOSED (R3) at the design gate; *(Update, same day:)* the Product Owner approved R3 for implementation with two binding corrections (no AI before consent; every AI call paid by the sender of the causing message), and CP3-A (migration 0176, not hosted) and CP3-B (the authorized-disclosure lane, the judge, the reply plumbing) are implemented locally with free proofs only ([Task Contract](docs/e2e/QANDEEL_S8A_04_CP3_IMPLEMENTATION_TASK_CONTRACT_v1.md), amendment §10); not pushed, no PR; Copy Gate 0 / 6; no paid call. *(Update, same day:)* under the Product Owner's CP3-C authorization (D-1 APPROVED WITH CONDITIONS; Copy Gate APPROVED 6 / 6), CP3-C (migration 0177, not hosted; the owner's routes; the mobile permission surfaces; the end-to-end and Activity non-disclosure proofs; the emulator check in Arabic and English) is implemented locally (amendment §10.5 – §10.6); not pushed, no PR; CP3-D not started; no paid call. *(Update, 2026-10-25 – 26:)* CP3-D V1 ran once under its own budget and was NOT ACCEPTED (amendment §11.0); under the Product Owner's CP3-D V2 Final Implementation Contract, Controlled Amendment R4 — Trusted Claim Spans (amendment §11; migration 0178, not hosted) is implemented locally with free proofs only, not pushed; CG-6a′ / CG-6b′ APPROVED at D-6; CP3-D V2 not run, no budget; Draft PR #358 is the work path. *(Update, 2026-10-26:)* **S8A-04 CLOSED / READY FOR PO MERGE DECISION** (2026-10-26; Draft PR #358, not merged; effective from its merge): CP3-D V2 Tier 1 ran once (round 23, USD 0.0177 at peak) and is **NOT ACCEPTED — original criteria failed** (leaks 36 / 90, false blocks 7 / 60, invalid 1 / 150); Tier 2 is **NOT RUN — deferred by explicit Product Owner decision**; the Product Owner's D-9 decision **PO-ACCEPTED-KNOWN-RISK — DEFERRED UNTIL AFTER FIRST LAUNCH** replaces T-D2's acceptance for this step only ([amendment §11.9](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-04_CP3_PERSONAL_KNOWLEDGE_IN_SHARED_WORLD_CONTROLLED_AMENDMENT_v1.0.md)), so the T-D2 failure alone does not block the merge or the first launch; the probabilistic disclosure and attribution errors remain (Future Improvements 012 – 016, non-blocking) and V2 gives no absolute privacy guarantee; `QAN-BL-CW-02` tombstoned and `QAN-BL-CI-03` (PO-WAIVED Android emulator infrastructure) admitted (backlog: 88 items; 42 / 4 / 9 / 33); no security, privacy or deployment gate removed; `SYNTHETIC_ONLY` and `QAN-BL-AI-01` unchanged; no merge without the Product Owner's explicit order.
>
> *(Previous:)* **CURRENT TASK (2026-10-24):** S8A-04 — Shared Social Understanding & Trusted Identity; CP1 merged through PR #356 as `43e67229`; CP2 implemented locally under the Product Owner's Final Implementation Authorization (Copy Gate CLOSED, migration 0175 not hosted, Stage 0 passed); the paid stages ran (round 19, 2026-10-25) and were accepted; the F1 / F2 correction and the final corrective pass made, S4's remaining case deferred to V2 (Future Improvement 011), API CI green; CP2 at the Product Owner's final gate (the placer binding and the merge) (amendment §13.8 – §13.10); Draft PR #357; not merged (the S8A-04 note at the end). *(As written at CP1:)* CP1 APPROVED by the Product Owner as an engineering candidate for merge, not as the final production qualification of social understanding (Controlled Amendment approved, Copy Gate CLOSED, migration 0174 not hosted, the interpreter bound to DeepSeek Flash, the placer not bound so no place is produced in the app before CP2); one pull request to `main`, not merged. S8A-03 merged through PR #355 as `4e1e0b78` (2026-10-24).
>
> *(Previous:)* **CURRENT TASK (2026-10-24):** S8A-03 — Personal Understanding Reality; CLOSED at its final review & merge gate: CP3 FAIL as run (unchanged), Open Understanding adopted by the Product Owner (migration 0173, not hosted), BG-08 / BG-09 reconciled, PR #355, not merged (the S8A-03 note after §6.29). S8A-04 … S8A-08 have not started.
>
> *(Previous:)* **CURRENT TASK (2026-10-23):** S8A-03 — Personal Understanding Reality; CP0 delivered and reviewed by the Founder, CP1 delivered and accepted, CP2 delivered (local; migration 0171 local only), CP3 run once and FAIL (unchanged), Living Personal Memory design corrections implemented locally (migration 0172 local only) and at the Founder's review, one pull request at the end, not merged (the S8A-03 note after §6.29). S8A-02 merged through PR #354 as `37812845` (2026-10-23). S8A-04 … S8A-08 have not started.
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

### S8A-03 — Personal Understanding Reality (2026-10-23 … 2026-10-24; current task; CLOSED at its final review & merge gate: CP3 FAIL as run, Open Understanding adopted by the Product Owner, BG-08 / BG-09 reconciled; PR #355, not merged)

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
- **CP2 delivered (pushed as `369ba841`, then `dd906d96` with the Founder's review corrections R1–R3; no PR; CP2
  engineering closed by the Founder; the pre-CP3 corrections D-1 / D-2 and D-3 applied locally, amendment §7.5 / §7.6;
  CP3 harness prepared and simulated at zero cost, no paid call yet)** under the
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
- **CP3, the one authorized live run (`cbe682c2`): FAIL.**
  - Results: P1 17 / 17; P2 5 / 13 (C07 PASS); P3 5 / 10; H1–H6 all zero.
  - Cost: 39 of 41 calls, peak-rate cost $0.00799.
  - Cause: every retrieval miss was in the exact-stem index, not in the model.
  - The result, its preregistration and its criteria stand unchanged.
- **Living Personal Memory — design corrections (Founder, 2026-10-23; local commit, not pushed, no PR):**
  - a read-time CORE / CURRENT / HISTORICAL picture of the live Memories, with no stored summary;
  - family and relationships are core knowledge: kept as `OTHER`, never as the user's own fact;
  - restatements and explicit endings come from the same background DeepSeek Flash call and are verified
    deterministically. No new call, no call before the reply, and no new model;
  - the three tiers share the unchanged 8,192-byte MEMORY slice: CORE has a floor of 40 % and CURRENT of 20 %, and the
    two together take at most 60 %;
  - migration `0172_s8a_03_living_personal_memory_v1.sql` is **local only**, proven by
    `database/verify-migration-0172.mjs`;
  - the two Copy Gate texts are recorded verbatim in [amendment §9](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-03_CP2_PERSONAL_UNDERSTANDING_CONTROLLED_AMENDMENT_v1.0.md).
  - A final acceptance test needs its own authorization.
- **Open Understanding — the Product Owner's product decision and S8A-03's closing change (2026-10-24; PR #355, not
  merged):**
  - Open Understanding is QANDEEL's mind. In the same one background capture call, DeepSeek Flash reads the meaning
    with the recent turns and at most 40 known Memories. The linguistic gates that blocked understanding are removed.
  - The server still proves grounding, ownership, statement and structure. Someone else's facts are kept as that
    person's, with a person label from the user's own words. Forget / correct run in the background under every 0152 rule.
  - Living Personal Memory is kept whole. No address form is adopted.
  - Migration `0173_s8a_03_open_understanding_v1.sql` is **not hosted**. It is proven by
    `database/verify-migration-0173.mjs`.
  - The two Copy Gate texts are presented verbatim in [amendment §10.4](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-03_CP2_PERSONAL_UNDERSTANDING_CONTROLLED_AMENDMENT_v1.0.md).
  - The seven known limits are accepted by the Product Owner and deferred until after launch. They are recorded only as
    Future Improvements 003–009, not in the backlog, and open no task or test round.
  - BG-08: every S8A-03 residue is disposed of (backlog §7), and nothing is admitted. The background-forget risk to the
    0152 writer is recorded in amendment §10.9, not hidden.
  - The register holds 87 items: 42 / 4 / 9 / 32 by status (unchanged).
- `SYNTHETIC_ONLY` is kept. No real user's data reaches DeepSeek (`QAN-BL-AI-01` stays open).

### S8A-04 — Shared Social Understanding & Trusted Identity (2026-10-24; MERGED through PR #358, 2026-10-26)

- **`CLOSED / MERGED` through PR #358 as `9459245e10bb763eaa0fc20bdfeb1acd27c90bc8` (2026-10-26); NOT DEPLOYED / CLOSED TO USERS.** Reconciled by S8A-05 CP1 (2026-10-26). The heading and bullets below are as written at its closing change: *(2026-10-24; current task; CP1 MERGED through PR #356 as `43e67229`; CP2 MERGED through PR #357 as `b0839fd4` (2026-10-25) with the placer unbound; S4's remaining case deferred to V2 (Future Improvement 011); on CP3's branch `s8a/s8a-04-cp3` the placer is bound and its free and paid integrated proofs passed (amendment §13.11), so CP2 is functionally complete (its functional gate closed by the Product Owner, 2026-10-25; the final code review and CI at the push); CP3's controlled amendment R3 APPROVED for implementation by the Product Owner with two binding corrections (2026-10-25); CP3-A (migration 0176, not hosted), CP3-B and CP3-C (migration 0177, not hosted; D-1 APPROVED WITH CONDITIONS; Copy Gate APPROVED 6 / 6) implemented locally with free proofs only, not pushed; CP3-D V1 run once and NOT ACCEPTED; Controlled Amendment R4 (Trusted Claim Spans; migration 0178, not hosted) implemented locally under the Product Owner's CP3-D V2 Final Implementation Contract (2026-10-26), free proofs only, not pushed; CG-6a′ / CG-6b′ APPROVED at D-6; then pushed to Draft PR #358; CP3-D V2 Tier 1 run once and NOT ACCEPTED, Tier 2 NOT RUN; PO-ACCEPTED-KNOWN-RISK — DEFERRED UNTIL AFTER FIRST LAUNCH; S8A-04 CLOSED / READY FOR PO MERGE DECISION, 2026-10-26)*
- Started 2026-10-24 on `s8a/s8a-04-shared-social-understanding` from `main` at `4e1e0b78b1216f73595b0040f84f4fc51bdd6ce2`
  (the merge of PR #355, 2026-10-24): **S8A-03 is merged**, so its closing change is effective. S8A-04 owns no backlog
  item at kickoff; it read (BG-05) `QAN-BL-CW-05`, `CW-02`, `AI-04` and `AI-05`, and none moves at CP1.
- **CP1 (Product Owner decisions D1–D5, 2026-10-24), local commits `20c88dae` and `d329a231`:**
  - governed by the candidate [S8A-04 CP1 Shared Social Understanding Controlled Amendment](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-04_CP1_SHARED_SOCIAL_UNDERSTANDING_CONTROLLED_AMENDMENT_v1.0.md),
    which narrows one SHARED-VIS-01 sentence (the interpreter input) and binds on the merge of the S8A-04 pull request;
    the SHARED-VIS-01 record is not edited. Its model-facing text (§5) is APPROVED verbatim, Copy Gate CLOSED (2026-10-24, §9.5);
  - the Shared Semantic Interpreter receives a per-reading speaker token for each contribution's trusted author (the
    frozen 0089 resolver) and the authorized visible Names; never an account id, never a Name as identity; the output
    contract is unchanged and a token in a meaning is refused;
  - the interpreter is bound to DeepSeek Flash under the new AI-COST-01 family `SHARED_SEMANTIC_READING` (migration
    `0174`, not hosted), charged to the verified sender of the triggering message;
  - **the Spatial Placer is not bound, so in-app place production still waits for CP2** (the pass returns `NO_PROVIDER`);
  - the isolated real-model proof (amendment §6.1): 24 of 64 DeepSeek calls, USD 0.006 at peak; arm B (CP1) had no
    identity confusion in 18 readings, against 2 of 6 for the words-only arm; it stopped on a repeated report-vs-fact
    failure (a relayed statement read as fact, 3 / 3), presented to the Product Owner;
  - the Product Owner's CP1 review (amendment §9): one approved §5.2 sentence (source fidelity), applied in `22e14f6c`; its one
    test round (14 calls; 38 of 64 in all, USD 0.0101 at peak) fixed S3 (3 / 3) and the repeated rumour (2 / 2) but not an
    absent person's relayed view (0 / 2), so it STOPPED with a diagnosis, no second change; N3 is a known CP1 limit, not an
    accepted product error; with the per-reading label number (a reading aid) it is a CP2 acceptance condition before
    production persistence: saved knowledge tied to the speaker, the relayer and the trusted sources, report kept apart from
    confirmed fact (§9.2, §9.4);
- **CP1 merged** through PR #356 as `43e67229` (2026-10-24); its amendment is effective.
- **CP2 — Shared Social Memory, Recall & Living Analysis** (branch `s8a/s8a-04-cp2` from `43e67229`, local):
  - governed by the [S8A-04 CP2 Shared Social Memory Controlled Amendment](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-04_CP2_SHARED_SOCIAL_MEMORY_CONTROLLED_AMENDMENT_v1.0.md),
    APPROVED by the Product Owner (the design, R3, and the Final Implementation Authorization, 2026-10-24); Copy Gate
    CLOSED (M1–M4, P1–P6 and the §10.1.5 data shapes and JSON Schemas); it narrows the sentences quoted in its §9 and
    binds on merge; its implementation record is §13;
  - migration `0175` (not hosted): each saved position is written atomically with its attribution (view or claim, holders
    or an absent holder, relayers, whom it is about, uncertainty, the position it revises); every member read serves the
    composed safe meaning (P1–P6), never the bare text; the knowledge read; Public World and Replay closed to
    `QANDEEL_ANALYSIS`; the Shared AI-COST-01 begin and the families `SHARED_KNOWLEDGE_RECALL` / `SHARED_SPATIAL_PLACEMENT`;
  - the API: the V2 reading (M1); the World's knowledge in the Shared reply (whole up to 8 KB, otherwise one M2 recall
    from at most 48 KB, the safe path on no slack or failure; never delaying the reply); the anchor placer V2 (M4) with a
    pure server geometry; the Shared cost correlation. The placer stays unbound in production (amendment §7); mobile is
    unchanged;
  - Stage 0 (free) passed: the build, TypeScript, 288 API suites (6 799 tests), `verify-migration-0175.mjs` and the re-anchored verifiers on real PostgreSQL 17, 1 310 static database tests and the 1 639 root contracts; a zero-cost rehearsal of the paid stages through the production composition (amendment §13.5);
  - the paid stages ran under the Product Owner's approval (2026-10-25; guard round 19, at most 80 calls and USD 0.08): 58
    calls, USD 0.048 at peak, no binding stop; the strict blind ratings and the findings (F1 joint-holder merges in the
    reading, F2 a reply presenting an earlier position as current) are in amendment §13.6 for the Product Owner's review;
    the placer is not bound. One residue is recorded in amendment §13.4 for the S8A-04 closing reconciliation.
  - the Product Owner accepted the results as they are and held F1 and F2 as blockers before closure (2026-10-25); the
    correction (amendment §13.8) keeps no place held by more than one member and serves only current positions to recall
    and reply; it was proven free (no paid call). Draft PR #357 is open to `main`, kept as a draft; CP2 is not closed and
    the placer stays unbound until the Product Owner's final approval.
  - the final corrective pass (amendment §13.9, 2026-10-25): a place is left out of the Shared Replay universe (0175 G.5)
    so `FULL_SOURCE` stays provable, with 0101 re-aligned and 0135 / 0161 / 0170 / 0171 re-anchored; a member keeps only
    their latest place of a reading (S4); an absent holder named as a writer is not saved (V2). Free proofs only.
  - the Product Owner's S4 decision (amendment §13.10, 2026-10-25): S4's remaining case (a position withdrawn inside the
    same reading with no replacement may still be saved as current) is deferred to V2 as Future Improvement 011, a known,
    non-blocking limit, not a fix and not a backlog item; M1 unchanged. API CI is green on `7301da0c` and the device check
    of §8 passed: CP2 is at the Product Owner's final gate (the placer binding and the merge), the placer still unbound.
  - **CP2 merged** through PR #357 as `b0839fd4dec150f79e6292da991ef93dcca34d72` (2026-10-25, by the Product Owner, head
    `7301da0c`, GitHub CI green) before the §13.10 record reached `main`. The placer was still unbound, so CP2 merged as
    engineering, not as a functionally complete checkpoint. That record (amendment §13.10, Future Improvement 011 and these
    entries, prepared as `01100297` on the merged branch) reaches `main` through S8A-04 CP3's branch `s8a/s8a-04-cp3`, which
    first completes CP2: the placer binding of amendment §7. V2's remaining case (amendment §13.9) stays a recorded known
    limit; no decision defers it.
  - **The placer binding** (amendment §13.11, 2026-10-25, `dfbb31cf` on `s8a/s8a-04-cp3`): the application composes the
    DeepSeek Flash placer behind `SYNTHETIC_ONLY` through the accounted client, and the refusing placer wherever DeepSeek may
    not run (the pass then stops before its lease). The integrated free proof boots the application's `SharedWorldModule`
    on real PostgreSQL 17 with the local stand-in: 84 / 84 checks (the production path from the message to the saved,
    displayed place; deletion, leave and outsider; privacy before the save; six refusals with no partial write; outside
    `SYNTHETIC_ONLY`). API jest 288 suites, root contracts 1 639 / 1 639. The paid confirmation (guard round 20, approved
    by the Product Owner at 12 calls / USD 0.02) passed: one run at head `3f618ff5`, 34 / 34 checks, 6 DeepSeek Flash calls, USD 0.0012 at peak pricing. CP2 is
    functionally complete; no migration, no hosted change.
- **CP3 — Personal Knowledge in Shared World** (`SHARED-CTX-01` / `QAN-BL-CW-02`): WP0 R2 done; R3 of the CP3 controlled
  amendment APPROVED FOR IMPLEMENTATION by the Product Owner (2026-10-25) with two binding corrections, recorded in its §10:
  no AI call and no item text outside the database before the owner's consent (relevance is the local 0171 index read only;
  the Flash relevance stage is removed), and every AI call paid by the verified author of the causing message. CP3-A
  (migration 0176 and its real-PostgreSQL verifier; not applied to any hosted database) and CP3-B (the authorized-disclosure
  lane beside the byte-identical I-03 chain, the disclosure judge `SHARED_DISCLOSURE_JUDGE`, the collector, the reply
  plumbing; the free suites and the simulated integrated proof, 90 / 90) are implemented on `s8a/s8a-04-cp3`, not pushed.
  CP3-C (the Product Owner's CP3-C authorization, 2026-10-25: D-1 APPROVED WITH CONDITIONS, Copy Gate APPROVED 6 / 6;
  amendment §10.5 – §10.6) is implemented on the same branch: migration 0177 (the owner's v2 surface — names, an opaque
  audience reference, no user id; the v1 id-carrying surface retired for a person; not hosted), the owner's four API
  routes, the mobile request and «ما سمحت به هنا», the end-to-end journey and the separate Activity non-disclosure proof
  (integrated proof 127 / 127) and the emulator check in Arabic and English; not pushed. CP3-D V1 (the preregistered 120-case judge evaluation) ran once (2026-10-25) and was NOT ACCEPTED (misses 3 / 75, false blocks 7 / 45; amendment §11.0). Under the Product Owner's CP3-D V2 Final Implementation Contract (2026-10-26), Controlled Amendment R4 — Trusted Claim Spans (amendment §11: the server writes the owner's Name, one check per reply over opaque ids, per-item cooldown only for a proven-unsafe item; migration 0178, the audience Names read, not hosted) — is implemented locally with free proofs only, not pushed; CG-6a′ / CG-6b′ are APPROVED (D-6, 2026-10-26); CP3-D V2 (two tiers) is not run and has no budget. Scope and gates: [Task Contract](docs/e2e/QANDEEL_S8A_04_CP3_IMPLEMENTATION_TASK_CONTRACT_v1.md).
- **S8A-04 closing change (2026-10-26):** **S8A-04 CLOSED / READY FOR PO MERGE DECISION** (2026-10-26; Draft PR #358, not merged; effective from its merge): CP3-D V2 Tier 1 ran once (round 23, USD 0.0177 at peak) and is **NOT ACCEPTED — original criteria failed** (leaks 36 / 90, false blocks 7 / 60, invalid 1 / 150); Tier 2 is **NOT RUN — deferred by explicit Product Owner decision**; the Product Owner's D-9 decision **PO-ACCEPTED-KNOWN-RISK — DEFERRED UNTIL AFTER FIRST LAUNCH** replaces T-D2's acceptance for this step only ([amendment §11.9](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-04_CP3_PERSONAL_KNOWLEDGE_IN_SHARED_WORLD_CONTROLLED_AMENDMENT_v1.0.md)), so the T-D2 failure alone does not block the merge or the first launch; the probabilistic disclosure and attribution errors remain (Future Improvements 012 – 016, non-blocking) and V2 gives no absolute privacy guarantee; `QAN-BL-CW-02` tombstoned and `QAN-BL-CI-03` (PO-WAIVED Android emulator infrastructure) admitted (backlog: 88 items; 42 / 4 / 9 / 33); no security, privacy or deployment gate removed; `SYNTHETIC_ONLY` and `QAN-BL-AI-01` unchanged; no merge without the Product Owner's explicit order. Recorded in the [Task Contract](docs/e2e/QANDEEL_S8A_04_CP3_IMPLEMENTATION_TASK_CONTRACT_v1.md) §6 – §8.1, amendment §11.8 – §11.10 and the backlog's "S8A-04 closing change".
- `SYNTHETIC_ONLY` is kept. No real user's data reaches DeepSeek (`QAN-BL-AI-01` stays open).

### S8A-05 — Public World: Write Your Topic (2026-10-26 … 2026-10-27; MERGED through PR #363, 2026-10-27)

- **`CLOSED / MERGED` through PR #363 as `8b476114a0f8655bcc39c5af80ded169c691c3f8` (2026-10-27); NOT DEPLOYED / CLOSED TO USERS.** Reconciled by S8B-01 CP1 (2026-10-28). The heading and bullets below are as written at its closing change: *(2026-10-26 … 2026-10-27; current task; CP1 MERGED through PR #359 as `7c0356b7`; CP2 MERGED through PR #360 as `72898797`; CP3 MERGED through PR #361 as `4ff74a80`; CP4 delivered on its Draft pull request; **S8A-05 CLOSED / READY FOR PO MERGE DECISION** (2026-10-27); editing a published topic deferred to `QAN-BL-PUB-REV-01` (`PRE-LAUNCH BLOCKER`), NOT implemented; not merged)*
- Started 2026-10-26 on `s8a/s8a-05-cp1` from `main` at `9459245e10bb763eaa0fc20bdfeb1acd27c90bc8`
  (the merge of PR #358, 2026-10-26): **S8A-04 is merged**, so its closing change is effective. S8A-05 owns no backlog
  item at kickoff; it read (BG-05) `QAN-BL-PRIV-05`, `QAN-BL-ACCT-01` and `QAN-BL-PROD-09`, and none moves at CP1.
- WP0 (research), WP1 (design) and WP1-R1 (corrections) were delivered to the Product Owner outside the repository. The
  Product Owner's S8A-05 CP1 order (2026-10-26) approves WP1 with WP1-R1 as the implementation basis and orders CP1 only.
- **CP1 — Write Your Topic** — **MERGED through PR #359 as `7c0356b7d632ddf0ce8d2773d09e7ad80f5fd366` (2026-10-26)**, so
  the CP1 amendment is effective. The bullets below are as written at CP1's review:
  - governed by the candidate [S8A-05 Public Authored Topics Controlled Amendment](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-05_PUBLIC_AUTHORED_TOPICS_CONTROLLED_AMENDMENT_v1.0.md):
    A-1 (Public World Product Definition addendum: direct writing, a human title, one user-chosen section that is not
    geography) and A-2 (CW2-04: the fourth source class `PUBLIC_AUTHORED`; title and section as bounded metadata outside
    interpretation and placement; a never-published discard with one-way erasure, the fifth lifecycle mover). It binds on
    the merge of the S8A-05 CP1 pull request; the frozen texts are not edited;
  - private account-bound drafts (save, edit, restore, delete; compare-and-set; `ACCOUNT_CASCADE`; exported as
    `publicTopicDrafts`), the editor with 12 sections and «حكايات مفتوحة», the preview with deterministic privacy notes,
    and the human title on the map, in search and in the panel; migration `0179` (not hosted; the next is `0180`);
  - **production publishing stays closed:** the freeze (preparing for publication, which provisions the one Public
    Identity) answers `NOT_EVALUATED` in every environment; the full path is proven only inside the rolled-back
    controlled verifier; CW2-08 is untouched;
  - R2 review corrections (2026-10-26, same pull request): autosave with an honest saved state, the reader's view of one
    section, search inside one section and in the body, human titles in relations management, the focused-verifier
    group removed (CI selects `migration-0179`);
  - Copy Gate `CLOSED` — every row `APPROVED` by the Product Owner (2026-10-26; four rows in the Owner's own Arabic; the nine R2
    rows approved unchanged); R3 (CI): the topic freeze absorbs `40001` / `PT409` into `NOT_PREPARED` and is classified
    absorbed by the 0150 guard. Record: [S8A-05 implementation record](docs/e2e/QANDEEL_S8A_05_PUBLIC_WORLD_WRITE_YOUR_TOPIC_IMPLEMENTATION_RECORD_v1.md).
- **CP2 — Publish from QANDEEL («انشر من قنديل»)** — **MERGED through PR #360 as `72898797b2e9596d4c9940fefeca6c987461108b`
  (2026-10-27)**, so the CP2 amendment is effective (reconciled by S8A-05 CP3). The bullets below are as written at CP2's
  review (on `s8a/s8a-05-cp2` from `main` at `7c0356b7`, under the Product Owner's S8A-05 CP2 order):
  - governed by the candidate [S8A-05 Publish from QANDEEL Controlled Amendment](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-05_PUBLISH_FROM_QANDEEL_CONTROLLED_AMENDMENT_v1.0.md):
    A-3 (CA-S8A05-A3 verbatim from WP1-R1 §6.3: personal analytical material in a Public package — the publisher's own
    QANDEEL replies as whole messages and the shown «فهم قنديل» summary at its exact revision, the publisher the sole
    approver, mention no veto, one acknowledgement, a closed refusal list) and the WP1-R1 §8 narrowing of A-2(c) (a
    never-published topic is discarded whatever its item classes). It binds on the merge of the CP2 pull request;
  - a draft's source is a reference only (session, two ends, the whole messages left out, QANDEEL replies in or out,
    emphasized messages; or one Understanding item and revision), re-resolved by the server at preview and at freeze
    through `resolve_personal_range_v1` (0169); one item per whole committed unit, the true order and emphasis sealed at
    freeze; pages of 50 for the preview, the sealed topic and the reader's panel; a bounded search document (8 KB) and
    bounded CP3 / CP4 inputs (24 KB / 6 KB) that nothing calls yet; the processing envelope 10,000 units / 8 MB refused
    before any write; the freeze measured under 3 s at the envelope on local PostgreSQL 17; a reader never sees a
    conversation position; migration `0180` (not hosted; the next is `0181`);
  - mobile: «شارك في العالم العام» from the conversation (the S7-02 selection seam) and from a «فهم قنديل» detail; the
    CP1 editor and drafts reused; the paged preview with speakers (the author's public name, «قنديل»), emphasis, gaps,
    warnings and the one acknowledgement;
  - **production publishing stays closed** (the freeze seam answers `NOT_EVALUATED`; CW2-08 untouched);
  - Copy Gate `CLOSED / APPROVED` by the Product Owner on 2026-10-27 — the 37 new rows verbatim in Arabic and English (three in the Product Owner's own Arabic), 2 reused approvals. Record:
    [S8A-05 implementation record §11](docs/e2e/QANDEEL_S8A_05_PUBLIC_WORLD_WRITE_YOUR_TOPIC_IMPLEMENTATION_RECORD_v1.md).
- **CP3 — Public Semantic Intelligence & Deterministic Spatial Placement** — **MERGED through PR #361 as `4ff74a80`
  (2026-10-27)**, so A-4 is effective (reconciled by S8A-05 CP4); as written at its review (2026-10-27, on `s8a/s8a-05-cp3` from `main` at
  `72898797`, under the Product Owner's S8A-05 CP3 order):
  - **PO decision (2026-10-27): PRODUCT ACCEPTED / MERGE AUTHORIZED after manual review of the full Word report.** The paid round 25 remains historically **NOT ACCEPTED** against its original zero-fabrication benchmark; it is not relabelled as a passing run. Only one non-blocking future improvement was admitted: respect the source topic language (to be added to the Product Owner's locally maintained Word Future Improvements register) (English 0/15 in round 25). No other issue from this review is a blocker. No CP4, publication enablement, real-user provider traffic, prompt change, or rerun is authorized by this decision.
  - governed by the candidate [S8A-05 Public Semantic Placement Controlled Amendment](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-05_PUBLIC_SEMANTIC_PLACEMENT_CONTROLLED_AMENDMENT_v1.0.md):
    A-4 (CW2-04 §14 / §15 narrowed: one closed vocabulary `QANDEEL_PUBLIC_REGIONS_V1` of 13 majors and 46 sub-regions,
    never shown and not the browsing sections; a reading carries 1 – 3 weighted sub-regions; P-dom — the dominant
    sub-region's centre plus the first free slot of one fixed spiral, minimum spacing 8,000, never moved; several meanings
    are carried by the themes, not by an in-between point). It binds on the merge of the CP3 pull request;
  - the production Public semantic interpreter: DeepSeek Flash only (JSON Output, a closed schema, strict decoding, 15 s,
    zero retries, no fallback) over the title-free 24 KB package text, behind `SYNTHETIC_ONLY`, through AI-COST-01 under the
    new family `PUBLIC_SEMANTIC_INTERPRETATION`, paid by the publisher (contract `PUBLIC_SEMANTIC_INTERPRETATION_V2`);
  - the place is computed inside the publication transaction (executable by no role) and committed through the unchanged
    0145 commands; publication still raises at the CW2-08 seam, so it rolls back with it; the whole cycle is proven in the
    rolled-back verifier 0181; migration `0181` (not hosted; the next is `0182`);
  - free proofs: verifier 0181 (boundary, geometry, server channel, placement, capacity 500 / 2,000 / 5,000, concurrency),
    the P-dom simulation on DEV / TEST / HOLDOUT2 seeds, adapter and contract tests; Copy Gate: NO NEW COPY (no mobile
    change);
  - **Tier S / Tier P run once and NOT ACCEPTED** (2026-10-27, the Product Owner's ceiling 100 attempts / USD 0.14, guard
    round 25; 100 calls, USD 0.0346): the deterministic half met (major 78 / 80, sub-region 76 / 78, corrections 10 / 10
    both ways, similar-closer 38 / 40, compounds 9 / 10, invalid 1 / 100); fabrication 3 confirmed by both blind raters
    (S48, S53, S69) and 5 UNSURE against 0; English topics answered in Arabic (reported). No second run. Record:
    [S8A-05 implementation record §12](docs/e2e/QANDEEL_S8A_05_PUBLIC_WORLD_WRITE_YOUR_TOPIC_IMPLEMENTATION_RECORD_v1.md).
- **CP4 — Public Discussion Threads & the @qandeel Context** (2026-10-27, on `s8a/s8a-05-cp4` from `main` at `c9715702`,
  under the Product Owner's S8A-05 CP4 order and CP4 scope decision; S8A-05's last checkpoint):
  - governed by [Controlled Amendment A-5](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-05_PUBLIC_DISCUSSION_CONTROLLED_AMENDMENT_v1.0.md), effective on the CP4 pull request's merge: a reply keeps the exact post it
    answers beside the unchanged thread root (one visible depth kept); the topic's author is tagged in words; `@qandeel` reads
    only the invoking post's branch (the exact-target chain, the thread's first post, at most 8 more posts of that thread),
    each post with its speaker role (OP / Asker / Participant) and target, earlier answers attached to the posts they
    answered, and the topic as one bounded 6 KB text; the author's words decide what the author means;
  - the S5-04 path reused (the 0147 lease, one answer per invocation, Safety Gate, completion); the answer is booked under
    the new family `PUBLIC_QANDEEL_REPLY`, paid by the invoker; the Public World module composes DeepSeek Flash through the
    shared router behind `SYNTHETIC_ONLY`; Public DEEP 25 s (`QAN-BL-AI-04` resolved for Public; Shared stays open);
    migration `0182` (not hosted; the next is `0183`);
  - free proofs: verifier 0182 (boundary, threads, OP, activity, context), the re-anchored verifiers 0171 / 0174 / 0175 /
    0176 / 0181, the API and mobile specs; CP4 Product Copy Gate CLOSED / APPROVED: 2 rows (`صاحب الموضوع` / "Topic author", `ردًا على {0}` /
    "In reply to {0}"), record §13.7;
  - **Tier Q** (the model's reading of the thread) **prepared, NOT RUN**: 30 independently written synthetic threads,
    preregistered, proposed ceiling 30 attempts / USD 0.05, guard round 26 LOCKED until the Product Owner's separate budget
    approval;
  - **editing a published topic, successor versions and the discussion across versions are NOT implemented**: deferred in
    full, by the Product Owner's decision (2026-10-27), to `QAN-BL-PUB-REV-01` — `PRE-LAUNCH BLOCKER`, owner `PUB-REV-01`,
    to be done and tested before Stage 9 opens production publishing;
  - **S8A-05 CLOSED / READY FOR PO MERGE DECISION**: BG-08 reconciled (`QAN-BL-PUB-REV-01` admitted; `QAN-BL-AI-04` dated
    note; register 89), BG-09 (the record and A-1 – A-4 banners brought to their final state). Record:
    [S8A-05 implementation record §13](docs/e2e/QANDEEL_S8A_05_PUBLIC_WORLD_WRITE_YOUR_TOPIC_IMPLEMENTATION_RECORD_v1.md).
- The only paid calls of S8A-05 are CP3's one authorized Tier S / Tier P run (100 DeepSeek Flash calls, USD 0.0346). CP4
  made none.

### S8B-01 — Voice Runtime Contract & Provider Evidence (2026-10-28; current task; CP1 merged through PR #364; CP2 delivered, partial; TTS selection APPROVED (Gemini `gemini-3.8-flash-tts`, voice Achird); no production code; USD 0.1155 of the USD 10 cap; every voice gate closed; CP2 not merged)

- Started 2026-10-28 on `s8b/s8b-01-voice-runtime-contract` from `main` at `8b476114a0f8655bcc39c5af80ded169c691c3f8`
  (the merge of PR #363, 2026-10-27): **S8A-05 is merged**, so its closing change is effective. **Stage 8B starts** by
  the Product Owner's S8B-00 decision D-1 (2026-10-28); the remaining Stage 8A work (S8A-06 … S8A-08 and its backlog
  items) keeps its owner and state, neither closed nor deferred by Stage 8B.
- The S8B-00 foundation review, its recording / Replay correction and its final version were delivered to the Product
  Owner outside the repository. The Product Owner's decisions D-1 … D-9 (D-9 amended: the cloud iOS Simulator plus a
  real Android device; a physical iPhone is not a Stage 8B closure condition) and recording decisions 1 – 12 (D-5a
  cancelled) are recorded in the [S8B-01 record](docs/e2e/QANDEEL_S8B_01_VOICE_RUNTIME_CONTRACT_PROVIDER_EVIDENCE_RECORD_v1.md) §1.
- **CP1 (2026-10-28), merged through PR #364 as `de774cfd` (2026-10-28), after review corrections R1 and R2:**
  - the candidate [Voice Runtime contract](docs/voice-runtime-v1.md): a streaming cascade around the existing
    Orchestrator, DeepSeek Flash the only brain; call authority; the spoken turn; Speech Rendering; the two-track original
    audio source on one clock; the immutable 30-day retention; listening; the private Replay and the three destinations;
    disclosure; latency; accounting; gates; devices;
  - the candidate [S8B-01 Voice Runtime Controlled Amendment](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8B-01_VOICE_RUNTIME_CONTROLLED_AMENDMENT_v1.0.md)
    VA-1 … VA-10, approved in principle (D-8), each binding only from the task that implements it; the frozen texts are
    not edited;
  - the non-production benchmark harness (`scripts/s8b-01/`): the preregistered plan (USD 10 cap, locked), two corpora,
    scoring, the latency model, the guard and a zero-cost simulated rehearsal; root contract
    `tests/s8b-01-voice-bench-harness-contract.test.mjs`;
  - `QAN-BL-VOICE-01` re-owned to `Stage 8B — Voice Runtime` (`DEFERRED — OWNED`); the register holds 89 items:
    44 / 4 / 8 / 33 by status.
- **CP2 (2026-10-28), on `s8b/s8b-01-cp2` from `main` at `de774cfd`, delivered and at the Product Owner's CP2 review:**
  Gemini TTS & provider evidence under the Product Owner's CP2 order ([record](docs/e2e/QANDEEL_S8B_01_VOICE_RUNTIME_CONTRACT_PROVIDER_EVIDENCE_RECORD_v1.md) §9):
  - the candidate [Controlled Amendment VA-11](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8B-01_CP2_GEMINI_TTS_RETENTION_EXCEPTION_CONTROLLED_AMENDMENT_v1.0.md):
    zero retention waived for `gemini-3.8-flash-tts` and `gemini-3.8-flash-lite-tts` only; no training still required;
    ASR and every other provider unchanged;
  - ONE approved run (`s8b01-cp2-r1`, now CONSUMED), USD 0.1155 of the USD 10 cap, no retry. Gemini Tier 1's 100
    requests a day stopped each model at 112 calls: the pronunciation set on voice Achird only. Flash-Lite led on every
    objective measure (first audio p50 590 ms against 679; USD 0.0091 against 0.0136 per audio minute). The expression set,
    the second voice, ASR, stage P and the render spike are NOT RUN; one harness defect is fixed (§9.4);
  - **TTS selection APPROVED by the Product Owner (2026-10-28, record §9.10):** Google Gemini TTS, `gemini-3.8-flash-tts`,
    voice Achird (male); one TTS path, no Voice Quality Router; a friendly, natural persona with balanced emotion; Speech
    Rendering kept for dates and pronunciation, the current number quality accepted. The results of both models and both
    voices are kept. No production code; ASR not selected.
  - **ASR and the Replay render spike (record §9.11), nothing spent:** ASR `BLOCKED — MISSING PREREQUISITES` (consenting
    recordings, the Speechmatics and Azure accounts, an independent spend plan); Speechmatics and Azure shortlisted on
    their own privacy terms, Deepgram in reserve; the recording kit prepared. The render spike is ready and awaits the
    approval to install ffmpeg. The Product Owner's contextual-expression and selective-vocalization requirements are
    recorded in S8B-04 / S8B-05 scope (`docs/voice-runtime-v1.md` §5, §16), NOT IMPLEMENTED.
  - **Speechmatics real-time ASR (record §9.12, simplified in §9.13), the Product Owner's decisions:** Speechmatics
    Enhanced `ar_en` only, on the Product Owner's own 20 phone recordings (`sets.po20`), a preliminary single-speaker
    test; phone formats converted locally (`convert-audio.ps1`, Windows Media Foundation); plan version 2 (`5d1af7a4…`,
    20 sessions, USD 0.25) supersedes version 1 (`e6b233b6…`, never approved, never run); `BLOCKED — MISSING
    PREREQUISITES` (the recordings, then the review and the approval with model training off); nothing sent.
  - the full TTS evaluation on Google Cloud (record §9.9): the reviewed set (148 texts, the duplicated reply requests
    removed) × both models × Achird and Sulafat, ONE approved run (`s8b01-cp2-cloud-r1`, now CONSUMED): 592 of 592 OK, no
    429, USD 0.7950 of its USD 2 cap at list price. Flash-Lite first audio p50 391 ms against 671; USD 0.0183 against
    0.0273 per audio minute at list price. The listening is the Product Owner's.
- No production code, migration, provider adapter or feature gate; every voice gate closed. CP3 needs the Product Owner's
  CP2 review first.
