# QANDEEL — Current State

**Status:** `CURRENT-STATE LOCATOR / REPOSITORY TRUTH SNAPSHOT — CREATES NO NEW PRODUCT AUTHORITY`

Read this first in every new session. It says where the project stands and where the authority for each
part lives. It decides nothing. Every lifecycle statement below is copied from, and cited to, the record
that owns it. Where this file and a cited record disagree, the record wins and this file is stale.

The map of the repository is [`QANDEEL_PROJECT_MAP.md`](QANDEEL_PROJECT_MAP.md).

---

## 1. Snapshot identity

| | |
|---|---|
| Snapshot date | 2026-10-04 (lifecycle / sequencing reconciliation by ROADMAP-REC-01; first snapshot 2026-09-25) |
| Canonical baseline | `7221a635a6a7fe7564fb3f1e2e19c1ca189164c4`, the merge of PR #303 (AI-COST-01). The first snapshot's baseline was `916792d108f01c839b607b11997775a096d31b88`, the merge of PR #269 (recovered canonical authority preservation) |
| Reconciliation record | [`docs/e2e/QANDEEL_ROADMAP_REC_01_CANONICAL_EXECUTION_MAP_RECONCILIATION_v1.md`](docs/e2e/QANDEEL_ROADMAP_REC_01_CANONICAL_EXECUTION_MAP_RECONCILIATION_v1.md) — GitHub truth for PRs #293–#303 and every contradiction it corrected |
| Repository | `allamqandeel/qandeel` |
| Source of truth | GitHub `main` is the canonical code and document source |

- This file summarizes existing authority. It never overrides a canonical record, a closure record or the backlog.
- A change that moves a lifecycle state does not thereby update this file. Always confirm a state in the cited
  record before acting on it.
- Every path below is repository-relative and resolves in a fresh clone.

---

## 2. Product North Star

Frozen wording, quoted from [Core Checkpoint v2 §1](docs/canonical-authority/experience-architecture/core-checkpoint/QANDEEL_CANONICAL_CORE_CHECKPOINT_v2.md)
("Product North Star — FROZEN"):

> **QANDEEL Living Analysis Map — Conversation as an Unfolding Semantic World.**
>
> **The Map is the semantic world.**
> **The Timeline is subordinate temporal navigation/orientation support.**

The Connected Worlds v2 product topology, quoted from
[CW2-00 §3](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_CONNECTED_WORLDS_V2_CW2-00_CANONICAL_PRODUCT_BASELINE.md):
exactly three world types, `MY_WORLD`, `SHARED_WORLD` and `PUBLIC_WORLD`. `REPLAY` and
`INTRODUCTIONS / MATCHING` are capabilities, not worlds.

The Core Checkpoint is historical upstream authority and is not the current entry point (§6). The North
Star it froze is quoted here unchanged.

---

## 3. Lifecycle summary

The labels are the ones the source records use. Three labels are this file's own, and each is a plain
description rather than a lifecycle state:

- **IMPLEMENTED — MERGED** — the code is on `main`, but the task's own record states no final lifecycle
  (it has no banner, or an implementation-contract or pre-review banner).
- **PRODUCT / DESIGN FROZEN — PRODUCTION IMPLEMENTATION OPEN** — the decision is frozen and no production
  code implements it.
- **NOT ESTABLISHED BY CURRENT REPOSITORY AUTHORITY** — no record on `main` settles the question.

### 3.1 Engineering foundation and intelligence runtime

| Domain | Lifecycle | Primary record |
|---|---|---|
| Engineering Foundation v1. It includes the Authenticated Conversation Runtime, Memory, the Evidence layer, Hypothesis, Confidence, Question / Information Gap and the HIM foundation | `CLOSED — OPERATIONALLY RECONCILED`. "It is not the finished QANDEEL product." | [`docs/foundation-freeze-v1.md`](docs/foundation-freeze-v1.md), [`docs/foundation-closure-reconciliation-v1.md`](docs/foundation-closure-reconciliation-v1.md) |
| Human Intelligence Activation (QHIA-001 → QHIA-015) | `CLOSED / FROZEN`. "QHIA closure is not product completion." | [`docs/human-intelligence-activation-freeze-v1.md`](docs/human-intelligence-activation-freeze-v1.md) |
| Integrated Intelligence Runtime & Hardening (QIR-001 → QIR-008) | `CLOSED / FROZEN`. "QIR closure is not product completion." | [`docs/integrated-intelligence-runtime-phase-freeze-v1.md`](docs/integrated-intelligence-runtime-phase-freeze-v1.md) |

### 3.2 Experience Architecture (upstream)

| Domain | Lifecycle | Primary record |
|---|---|---|
| Stages 0–4 (Navigation Canonical Checkpoint), Stage 5, Stage 6 | `HISTORICAL / UPSTREAM`. Each stage is `CLOSED / FROZEN` as its source states. Later amendments bind. | [`docs/canonical-authority/CANONICAL_AUTHORITY_INDEX.md`](docs/canonical-authority/CANONICAL_AUTHORITY_INDEX.md) |

### 3.3 Living Analysis Map runtime (Personal World, T-series)

The Stage 6 Final Freeze Record §17 froze a 19-task build sequence that runs T-01 … T-13. It states that
T-09 accessibility and modality work "is integrated with T-04…T-08 and gates each owning component". T-14
was added later.

| Task | Lifecycle | Primary record |
|---|---|---|
| T-01 mobile foundation, T-02 canonical state kernel | IMPLEMENTED — MERGED | [`apps/mobile/README.md`](apps/mobile/README.md) |
| T-03A1 … T-03D: committed conversational time, focus, Threads and Live Focus, plus historical projection. T-03D is the production authority cutover | IMPLEMENTED — MERGED | [`docs/effective-live-focus-final-semantic-chain-cutover-v1.md`](docs/effective-live-focus-final-semantic-chain-cutover-v1.md), [`docs/historical-projection-v1.md`](docs/historical-projection-v1.md) |
| T-04 Living Analysis Map runtime | IMPLEMENTED — MERGED. Its own banner still reads "implemented, awaiting independent Architecture review". `QAN-GOV-03` reported it to Architecture and did not correct it | [`docs/living-analysis-map-runtime-v1.md`](docs/living-analysis-map-runtime-v1.md) |
| T-05 Timeline, T-06 Temporal Navigation, T-07 Return, T-08 Inspection / Orientation / Return chrome | IMPLEMENTED — MERGED. None of these records carries a lifecycle banner. T-12 §1 names each one as the owner of its layer, and G3 §A consumes them without reopening them | [`docs/timeline-presentation-window-v1.md`](docs/timeline-presentation-window-v1.md), [`docs/temporal-navigation-layer-v1.md`](docs/temporal-navigation-layer-v1.md), [`docs/return-navigation-layer-v1.md`](docs/return-navigation-layer-v1.md), [`docs/inspection-orientation-return-chrome-v1.md`](docs/inspection-orientation-return-chrome-v1.md) |
| T-10 Motion System | `CLOSED / FROZEN` | [`docs/living-analysis-map-motion-system-v1.md`](docs/living-analysis-map-motion-system-v1.md) |
| T-11 Responsive Recomposition | `CLOSED / FROZEN`, later amended by the G2.3 and G3 controlled amendments | [`docs/responsive-recomposition-v1.md`](docs/responsive-recomposition-v1.md) |
| T-12P Mobile Runtime Entry Preconditions | IMPLEMENTED — MERGED. Its own banner still reads `CANDIDATE`. `QAN-GOV-03` reported it and did not correct it | [`docs/mobile-runtime-entry-preconditions-v1.md`](docs/mobile-runtime-entry-preconditions-v1.md) |
| T-12 Final Living Analysis Map Integration | `CLOSED / FROZEN` | [`docs/final-living-analysis-map-integration-v1.md`](docs/final-living-analysis-map-integration-v1.md) |
| T-13 Recovery / Persistence | `CLOSED / FROZEN` | [`docs/recovery-persistence-v1.md`](docs/recovery-persistence-v1.md) |
| T-14 Mobile Product Sign-In Gateway | `CLOSED / FROZEN` | [`docs/mobile-product-sign-in-gateway-v1.md`](docs/mobile-product-sign-in-gateway-v1.md) |

### 3.4 Connected Worlds v2

| Domain | Lifecycle | Primary record |
|---|---|---|
| Architecture CW2-00 … CW2-08 | `HISTORICAL / UPSTREAM`. CW2-01 … CW2-08 are each `CLOSED / FROZEN`. Later amendments bind | [`docs/canonical-authority/CANONICAL_AUTHORITY_INDEX.md`](docs/canonical-authority/CANONICAL_AUTHORITY_INDEX.md) |
| I-01 type / invariant kernel; I-02 Shared persistence (migrations 0075–0076) | IMPLEMENTED — MERGED (PRs #228–#230). No standalone lifecycle record, and no backlog closure record. Their lifecycle is NOT ESTABLISHED BY CURRENT REPOSITORY AUTHORITY | [`apps/api/src/connected-worlds/kernel/`](apps/api/src/connected-worlds/kernel/), [`database/README.md`](database/README.md) |
| I-03 authority / consent / EffectiveContext (0077–0080) | IMPLEMENTED — MERGED through I-03G (PR #237). A phase-closure contract exists. The backlog has no `I-03` closure record | [`tests/connected-worlds-i03-authority-closure-contract.test.mjs`](tests/connected-worlds-i03-authority-closure-contract.test.mjs), [`database/README.md`](database/README.md) |
| I-04 Shared World Lifecycle / Conversation Runtime (0081–0090) | `CLOSED / FROZEN` | [`docs/shared-world-lifecycle-conversation-runtime-v1.md`](docs/shared-world-lifecycle-conversation-runtime-v1.md) |
| I-05 Public World Runtime (0091–0099) | `CLOSED / FROZEN`. The backlog's I-05 closure record: "The Public World is NOT product-launch ready" | [`database/README.md`](database/README.md) (Public World section) |
| I-06 Replay Runtime (0100–0107) | `CLOSED / FROZEN`. The backlog's I-06 closure record: "Replay is NOT product-launch ready" | [`docs/replay-runtime-v1.md`](docs/replay-runtime-v1.md) |
| I-07 Matching / Introductions Runtime (0108–0118) | `CLOSED / FROZEN`. Its record "does **not** claim Product launch readiness" | [`docs/matching-introduction-runtime-v1.md`](docs/matching-introduction-runtime-v1.md) |
| `QAN-CW-REM-01` … `REM-03`, the assurance remediations (0119–0122) | merged. `ASSURE-F05` was explicitly excluded from all three and remains open as `QAN-BL-CW-01` | [`database/README.md`](database/README.md), [`docs/assurance/connected-worlds/README.md`](docs/assurance/connected-worlds/README.md) |
| Connected Worlds `I-08` and `I-09` | named later phases and not started (§7). The governance contract calls `I-08` "real, unstarted" | [`docs/matching-introduction-runtime-v1.md`](docs/matching-introduction-runtime-v1.md) §11, §24; [`tests/task-closure-governance-contract.test.mjs`](tests/task-closure-governance-contract.test.mjs) |
| `CW2-08` Safety / moderation / entitlements / Launch Gate | no executable runtime exists. Every launch prerequisite is a fail-closed seam answering `NOT_EVALUATED` | [`docs/qandeel-canonical-backlog-v1.md`](docs/qandeel-canonical-backlog-v1.md), I-05 and I-06 closure records |

### 3.5 Product shell, attention contract, and visual / Product design system

| Domain | Lifecycle | Primary record |
|---|---|---|
| I-08A — Product Shell / IA / Canonical Naming | `I-08A4 — CLOSED / CANONICAL FREEZE COMPLETE`; integrated `I-08A — CANONICAL PRODUCT SHELL / IA / NAMING FOUNDATION — FROZEN`. Later explicit G1.1 / G1.2 amendments bind where they supersede A4 naming or shell statements, and so does P1 (`Readings` naming for its surface, General Settings placement). P3 adds one separate global Activity entry in the non-Analysis upper chrome and changes no World destination (its §19.4). The W1B-01 controlled amendment (merged through PR #284) supersedes only the copy of §14 (first-use Welcome) and §15 (First Conversation Opening) | [`docs/canonical-authority/final-product-experience/i-08a/QANDEEL_I-08A4_CLOSURE_SYNTHESIS_CANONICAL_PRODUCT_SHELL_IA_NAMING_DECISION_RECORD.md`](docs/canonical-authority/final-product-experience/i-08a/QANDEEL_I-08A4_CLOSURE_SYNTHESIS_CANONICAL_PRODUCT_SHELL_IA_NAMING_DECISION_RECORD.md) |
| P1 — User Identity / Preferences / QANDEEL Understanding | `P1 — CLOSED / FROZEN — USER IDENTITY / PREFERENCES / QANDEEL UNDERSTANDING PRODUCT CONTRACT`. PRODUCT / DESIGN FROZEN — PRODUCTION IMPLEMENTATION OPEN. It narrowly amends I-08A4 naming, the F2 / G2 / G3 non-Analysis appearance rule and the T-14 final sign-in requirement (its §15) | [`docs/qandeel-p1-user-identity-preferences-understanding-canonical-closure.md`](docs/qandeel-p1-user-identity-preferences-understanding-canonical-closure.md) |
| P2 — Final Iconography System | `P2 — CLOSED / FROZEN — FINAL ICONOGRAPHY SYSTEM`. PRODUCT / DESIGN FROZEN — PRODUCTION IMPLEMENTATION OPEN. The Hybrid QANDEEL Icon System: N1 "Open" signature geometry, the navigation glyph above the destination word, Call Rail A "Keyed Seam" with End Call at 27 px, Temporal Spine + Aperture C "Parting", Hugeicons Free as the curated utility source (no runtime package), Calm State Morphing. It narrowly supersedes G1.2 §6 for the icon glyphs and call controls; the audio strip and broader Voice visual language stay unfrozen (its §13). Evidence: the merged P2-A package | [`docs/qandeel-p2-final-iconography-canonical-closure.md`](docs/qandeel-p2-final-iconography-canonical-closure.md); evidence [`docs/design/p2-iconography/QANDEEL_P2-A_FINAL_ICONOGRAPHY_INTEGRATED_VISUAL_PROOF/`](docs/design/p2-iconography/QANDEEL_P2-A_FINAL_ICONOGRAPHY_INTEGRATED_VISUAL_PROOF/P2_READ_FIRST.md) |
| P3 — Notification & Activity Final Product Realization | `P3 — CLOSED / FROZEN — NOTIFICATION & ACTIVITY FINAL PRODUCT REALIZATION`. PRODUCT / DESIGN FROZEN — PRODUCTION IMPLEMENTATION OPEN. It consumes `I-08N-01` and closes only the realization `I-08N-01` §21 left open: Activity «النشاط» / ACTIVITY (one global destination, not a World, entry in the non-Analysis upper chrome, none in the Analysis); the Open Ledger and Open Link glyphs; the neutral attention mark with no global count; the ordinary Attention Strip; ordinary attention deferred inside the Analysis and during a Live Call, with two call-safe exceptions (dismiss only; Replay the one temporarily occluded control); the L0–L3 labels; Notifications & Activity settings; Quiet Hours 23:00 → 08:00; the v1 ceilings. It supersedes no `I-08N-01` semantics and keeps G3 §D (its §19). Evidence: the merged P3-A package | [`docs/qandeel-p3-notification-activity-final-realization-canonical-closure.md`](docs/qandeel-p3-notification-activity-final-realization-canonical-closure.md); evidence [`docs/design/p3-notifications/QANDEEL_P3-A_NOTIFICATION_ACTIVITY_INTEGRATED_VISUAL_PROOF/`](docs/design/p3-notifications/QANDEEL_P3-A_NOTIFICATION_ACTIVITY_INTEGRATED_VISUAL_PROOF/P3_READ_FIRST.md) |
| P4 — Remaining Product / Visual Gaps Census & Closure | `P4 — CLOSED / FROZEN — REMAINING PRODUCT / VISUAL GAPS CENSUS & CLOSURE COMPLETE`, merged through PR #280 at `d6d0999dea26ba97b595e8a97e1a630eb659874f` after exact-head independent review and validation. PRODUCT / DESIGN FROZEN — PRODUCTION IMPLEMENTATION OPEN. It freezes, in their named scopes: P4-C1 (S-B General Settings entry from Personal QANDEEL; U-A Understanding row; Q-A no persistent shell Q; SW-3 Keyed Seam; the dedicated «سياق الكلام» / Live Context surface retired); P4-C2 (I-08B2.5 ratified; static launch / gateway in P4 and the lantern moment in v1 but separated to its own task; undrawn screens to the audit; the Voice split; the copy disposition; `PO-OPS-13` … `19`); the P4-C3 static launch → system handoff and non-signal Voice language as corrected by P4-C3R; the four P4-C3R approvals (launch appearance, «يوجد تعارض» / Mixed, the Public ID English warning, «إعادة العرض» / Replay superseding I-08A4's «عرض الجلسة» row for that name only); the 104 copy rows P4-C4 ratifies; and APP-OPS-01 (next row) | [`docs/canonical-authority/final-product-experience/p4/QANDEEL_P4_FINAL_CLOSURE_v1.0.md`](docs/canonical-authority/final-product-experience/p4/QANDEEL_P4_FINAL_CLOSURE_v1.0.md); local evidence [`docs/p4/`](docs/p4/P4_READ_FIRST.md); proof [`docs/design/p4-residual/…/P4C3_READ_FIRST.md`](docs/design/p4-residual/QANDEEL_P4-C3_RESIDUAL_VISUAL_COPY_PROOF/P4C3_READ_FIRST.md) |
| APP-OPS-01 — QANDEEL App ↔ QANDEEL Company Operations contract | `APP-OPS-01 — CLOSED / FROZEN`, merged with P4 through PR #280 at `d6d0999dea26ba97b595e8a97e1a630eb659874f`. Product / Architecture boundary only: content-free, non-semantic, asynchronous operational telemetry; no Company path for private user content; seven governed control families; no generic remote execution. Nothing is implemented, and the contract alone authorizes no implementation | [`docs/p4/APP_OPS_01_COMPANY_OPERATIONS_CONTRACT_CANDIDATE.md`](docs/p4/APP_OPS_01_COMPANY_OPERATIONS_CONTRACT_CANDIDATE.md) (path kept for existing links) |
| I-08N-01 — Notification & Proactive Attention Product Contract | `CLOSED / NOTIFICATION & PROACTIVE ATTENTION PRODUCT CONTRACT FROZEN`. This is Product behavior / attention policy, not a production notification runtime. It stays the foundational notification semantic authority; P3 is its final Product realization | [`docs/canonical-authority/final-product-experience/i-08n/QANDEEL_I-08N-01_FINAL_CLOSURE_PACKAGE.md`](docs/canonical-authority/final-product-experience/i-08n/QANDEEL_I-08N-01_FINAL_CLOSURE_PACKAGE.md) |
| Phase V — Visual Language Discovery | `CLOSED` — `FREEZE WITH EXPLICIT OPEN ITEMS`, in the archive's own words | [`docs/design/phase-v/README.md`](docs/design/phase-v/README.md) |
| Phase VI: VI-01, VI-02 | each `CLOSED / FROZEN` as its archive states. VI-01 naming was amended by G1.1 | [`docs/design/phase-vi/`](docs/design/phase-vi/) |
| Phase VI: VI-03 and the Phase VI parent | `HISTORICAL TRACK STATE — SUPERSEDED BY LATER CANONICAL WORK`. VI-03-01 is a brief "NOT A FREEZE". The artifact audit classifies the later VI-03 explorations as "exploration, superseded by I-08B1". Phase VI has no closure record | [`docs/design/canonical-artifacts/LOCAL_ONLY_CANONICAL_ARTIFACT_AUDIT.md`](docs/design/canonical-artifacts/LOCAL_ONLY_CANONICAL_ARTIFACT_AUDIT.md) |
| I-08B1 Living Analysis World (FAR / MID / NEAR) | `CLOSED / FROZEN` (2026-09-20). PRODUCT / DESIGN FROZEN — PRODUCTION IMPLEMENTATION OPEN | [`docs/design/canonical-artifacts/living-analysis/README.md`](docs/design/canonical-artifacts/living-analysis/README.md) |
| I-08B2.5 brand, I-08B3.0-E3 typography, I-08B3.1 A–F material and appearance system | as stated per domain in the artifact index: **I-08B2.5 Brand is RATIFIED / FINAL BRAND AUTHORITY by P4-C2**; C and F are `CLOSED / FROZEN`; D2R and E1R are `CLOSED / FROZEN`; typography, A3R2 and B4R are frozen per the downstream ledger | [`docs/design/canonical-artifacts/QANDEEL_CANONICAL_ARTIFACT_INDEX.md`](docs/design/canonical-artifacts/QANDEEL_CANONICAL_ARTIFACT_INDEX.md); [P4-C2](docs/canonical-authority/final-product-experience/p4/QANDEEL_P4C2_BRAND_SCOPE_VOICE_COPY_APP_OPS_PRODUCT_DECISIONS_v1.0.md) |
| I-08B3.1-G: G1.1, G1.2, G2, G2.3, G3, and parent G | `CLOSED / FROZEN` | [`docs/design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md`](docs/design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md) §J |
| The I-08B3.1 parent and the I-08B parent | NOT ESTABLISHED BY CURRENT REPOSITORY AUTHORITY. No closure record for either parent exists on `main` | — |

### 3.6 Cross-cutting

| Domain | Lifecycle | Primary record |
|---|---|---|
| Voice / Live Call | the Product interaction is `CLOSED / FROZEN` at proof level, and P4 freezes the non-signal Voice visual language. Signal-bearing morphology and Voice / call strings wait on the runtime, which is `OPEN — UNASSIGNED` (`QAN-BL-VOICE-01`) | [`docs/design/i-08b3.1-g1.2/QANDEEL_G1_2_CANONICAL_CLOSURE.md`](docs/design/i-08b3.1-g1.2/QANDEEL_G1_2_CANONICAL_CLOSURE.md), [backlog](docs/qandeel-canonical-backlog-v1.md) |
| Notifications / proactive attention | the Product contract is frozen by `I-08N-01`, and its final Product realization by P3 (`CLOSED / FROZEN`). G3 §D's compatible rule stays binding: Matching must not interrupt a Live Call. No production notification runtime is established on `main`, and none of these records defines the runtime transport / mechanism | [`I-08N-01`](docs/canonical-authority/final-product-experience/i-08n/QANDEEL_I-08N-01_FINAL_CLOSURE_PACKAGE.md), [P3 closure](docs/qandeel-p3-notification-activity-final-realization-canonical-closure.md), [G3 closure §D](docs/design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md) |
| Security / pre-release | `QAN-BL-SEC-01` `DEFERRED — OWNED`; `QAN-BL-CW-01` `OPEN — UNASSIGNED`; the launch prerequisites fail closed. The API-side readiness correctives are merged (§3.7). Still `DEFERRED — OWNED`: `QAN-BL-PROD-04` (`PROD-AUTH-01`), `QAN-BL-PROD-05` (`PROD-DATA-01`) and the two Final Launch gates `QAN-BL-LAUNCH-01` (`LAUNCH-EDGE-SECURITY-GATE` — edge / origin) and `QAN-BL-LAUNCH-02` (`FINAL-LAUNCH-CLOSURE — Identifier Key Management Gate`) | [`docs/t12-auth-storage-at-rest-disposition-v1.md`](docs/t12-auth-storage-at-rest-disposition-v1.md), [backlog](docs/qandeel-canonical-backlog-v1.md) |
| Governance | the canonical backlog is `ACTIVE — governance authority` | [`docs/qandeel-canonical-backlog-v1.md`](docs/qandeel-canonical-backlog-v1.md) |

### 3.7 Production Integration and cross-cutting readiness — merged tasks after W3-MEGA-M

Every task row except the last two is merged. PR #298 is closed unmerged, and PROD-AUTH-01 / PROD-DATA-01 are
`DEFERRED — OWNED`, as their rows say. A merged task closes no phase or stage beyond what its row says. The earlier
W-slices are in §7.

| Task | Lifecycle | Primary record |
|---|---|---|
| W3-MEGA-A — Account & Identity Completion + Security v1 | MERGED through PR #295 at `1e7b681052c7af09576197bcfb204e1b39775554`. W3's named residual rows stay open (§7) | [record](docs/e2e/QANDEEL_W3_MEGA_A_ACCOUNT_IDENTITY_SECURITY_IMPLEMENTATION_RECORD_v1.md) |
| W3-MEGA-S — Personal Controls & Settings Integration v1 | `MERGED / CLOSED` through PR #296 at `e87aac6b4e9ec6c1b6542d2ba3c82cc6cc9af6e8`. Its copy is still recorded as PROPOSED — NOT APPROVED (§7) | [record](docs/e2e/QANDEEL_W3_MEGA_S_PERSONAL_CONTROLS_SETTINGS_IMPLEMENTATION_RECORD_v1.md) |
| VPORT-01 — Living Analysis World — Final Production Visual Port | `MERGED / CLOSED` through PR #297 at `fe9d9155f122725cb669e9989fa35ff12916112a`. **VPORT-01 is DONE; Stage 2 is still ACTIVE; VPORT-02 is NEXT** | [record](docs/e2e/QANDEEL_VPORT_01_LIVING_ANALYSIS_WORLD_PRODUCTION_VISUAL_PORT_v1.md) |
| PROD-SEC-02 — Turn Admission Concurrency & Cost Bound (migration `0131`) | `MERGED / CLOSED` through PR #299 at `ce2b86d0caaeb063ec4593663d9dbf806e51b4f4`; `QAN-BL-PROD-01` tombstoned | [record](docs/e2e/QANDEEL_PROD_SEC_02_TURN_ADMISSION_CONCURRENCY_COST_BOUND_IMPLEMENTATION_RECORD_v1.md) |
| PROD-OPS-01 — Operational Readiness & Silent-Failure Visibility (migration `0132`) | `MERGED / CLOSED` through PR #300 at `df694fd4d86fca41c50790f24ef5463af711236f`; `QAN-BL-PROD-03` tombstoned | [record](docs/e2e/QANDEEL_PROD_OPS_01_OPERATIONAL_READINESS_FAILURE_VISIBILITY_IMPLEMENTATION_RECORD_v1.md) |
| PROD-SEC-01 — API Baseline Security Hardening (migration `0133`) | `MERGED / CLOSED` through PR #301 at `ddc3e6c1531d47d2e2ef4977ace79ac97478b79f`; `QAN-BL-PROD-02` tombstoned; `QAN-BL-LAUNCH-01` / `02` admitted | [record](docs/e2e/QANDEEL_PROD_SEC_01_API_BASELINE_SECURITY_HARDENING_IMPLEMENTATION_RECORD_v1.md) |
| W3-CORR-U — Understanding Integrity (migration `0134`) | `MERGED / CLOSED` through PR #302 at `c9add460be785fc5d4dd930146e217cee2972706`; `QAN-BL-PRIV-01` admitted | [record](docs/e2e/QANDEEL_W3_CORR_U_UNDERSTANDING_INTEGRITY_IMPLEMENTATION_RECORD_v1.md) |
| AI-COST-01 — Provider-Neutral AI Usage & Cost Ledger + Credit Accounting Foundation (migration `0135`) | `MERGED / CLOSED` through PR #303 at `7221a635a6a7fe7564fb3f1e2e19c1ca189164c4`. The foundation only: no Credit formula, plan, allowance, balance or exhaustion is active, and no provider is selected | [record](docs/e2e/QANDEEL_AI_COST_01_PROVIDER_NEUTRAL_COST_CREDIT_LEDGER_IMPLEMENTATION_RECORD_v1.md) |
| PROD-READINESS-01 — API Security & Performance Adversarial Review | **PR #298 CLOSED UNMERGED — evidence / review only.** Its accepted findings were admitted to the backlog as `QAN-BL-PROD-01` … `05` and re-owned to the tasks above | [backlog](docs/qandeel-canonical-backlog-v1.md) `PROD-READINESS-01 corrective admission` |
| PROD-AUTH-01 — Auth Verification Path; PROD-DATA-01 — List/Fan-out Correction | **`DEFERRED — OWNED`** (`QAN-BL-PROD-04`, `QAN-BL-PROD-05`). Not opened, and not promoted ahead of VPORT-02 | [backlog §5](docs/qandeel-canonical-backlog-v1.md) |

There is no task named `W3-CORR-M`. Memory control is the merged W3-MEGA-M (PR #293); no record or backlog item
authorizes a `W3-CORR-M`.

---

## 4. Product / Design versus implementation

**A frozen design is not shipped code.** In several domains the Product and design canon is ahead of
production implementation. The table keeps three things apart:

- what has been decided;
- what production code implements today;
- what is still open.

| Area | Decided (Product / Architecture / Design) | In production code today | Still open |
|---|---|---|---|
| Conversation and intelligence | Foundation, QHIA and QIR contracts | the NestJS API in `apps/api/src/`. Its HTTP controllers are under `conversation/`, `health/`, `account/` and `understanding/`. AI-COST-01 (merged) records every provider call in a provider-neutral usage / cost ledger (migration `0135`); PROD-SEC-02 (merged) bounds turn admission and foreground AI spend (migration `0131`) | Provider / LLM selection is deferred (QIR-001); the Product roadmap places QANDEEL-specific benchmark/selection alongside the End-to-End Product Experience Completeness Audit |
| Product shell / Global navigation / first use | I-08A4 freezes the Personal-centered App Shell, three-area Global Switcher, local-only Back, Direct Entry, bilingual Product language and first-use foundation; later G1.1 / G1.2 naming amendments bind, and so do P4-C1's shell / small-chrome decisions and P4's static launch → system handoff | no complete production Global Shell implementing the I-08A contract is established on `main`; current mobile composition is the T-series / T-12 shell | production realization of the frozen I-08A shell while preserving later amendments |
| Living Analysis Map (Personal World) | Stages 0–6 and the T-series contracts | the mobile client in `apps/mobile/src/`: world projection, camera, Timeline, temporal navigation, Return, chrome, motion, responsive composition, recovery and sign-in. **The Map paints the frozen I-08B1 world** (VPORT-01, merged through PR #297: `apps/mobile/src/map/visual/`); the world mechanics underneath did not move. The Conversation surface exists (W1A-01, merged through PR #283). The [E2E-01 census](docs/e2e/QANDEEL_E2E01_COMPLETE_PRODUCT_JOURNEY_SURFACE_CENSUS_v1.md) §1 finding of "no Conversation surface" was true at the census | VPORT-02 (Timeline + Orientation Chrome + P2 Final Coherence) is NEXT; `QAN-BL-VIS-01` (heavy-history stress proof) stays `OPEN — UNASSIGNED` |
| Visual system (Living Brass, Light, typography, surfaces, colour, accessibility, appearance, brand) | the frozen I-08B design canon (§3.5) | in part: W1A-01 (Conversation surface in the frozen visual language), W2-02 (launch identity), the W3 Settings surfaces, and VPORT-01 (the Living Analysis World paint) | the rest of the production port: VPORT-02 (Timeline, Orientation Chrome, P2 final coherence) is NEXT; later stages port their own surfaces |
| Conversation / Analysis shell | G1.1; G3 Decisions A and B; the G2.3 and G3 controlled amendments to T-11 / T-12; P1 §12, under which non-Analysis surfaces follow the user's Dark / Light / System preference (default Dark) while the Analysis stays one dark place | the T-12 app-root composition | G3 §F lists these as unimplemented: the Analysis shell, the appearance cross-fade, the temporal-line placement and yield rule, compact `ReturnControls`, and device certification. The P1 appearance preference is implemented by W3-01 (merged through PR #287): non-Analysis surfaces follow Dark / Light / System, and the Analysis stays Dark |
| Shared World, Public World | CW2-01 … CW2-04; I-04, I-05 | the database runtime (migrations 0075–0099) and server modules in `apps/api/src/connected-worlds/` | no authenticated Product routes and no mobile surfaces. Launch prerequisites fail closed |
| Matching / Introductions | CW2-06; the G2.3 copy and process; the G3 §D Live-Call rule | the I-07 database runtime (0108–0118, 0120) | the mobile Matching UI, the final Introduction screen and the navigation surfaces, owned by Connected Worlds `I-08`. G3 §G holds the `OPEN COPY` items |
| Replay | CW2-05; the G1.1 placement ("an action on the current Conversation / Analysis context") | the I-06 backend runtime (0100–0107) | the Product Replay surface (`QAN-BL-NAV-02`). No media, storage or transport. Distribution is `NOT CLEARED / FAIL-CLOSED` |
| Voice / Live Call | G1.2; P2's Call Rail A; P4's non-signal Voice visual language (P4-C2 §4, frozen by the P4 closure §6) | none | all of it (`QAN-BL-VOICE-01`), including the signal-bearing morphology and Voice / call strings P4 keeps runtime-gated |
| App ↔ Company Operations | APP-OPS-01 (`CLOSED / FROZEN` with P4) | partial foundations only: bounded API telemetry, the content-free outbox and health probes; PROD-OPS-01's content-free failure and stuck-job signals and corrected readiness probe; AI-COST-01's content-free provider usage / cost aggregates. No mobile crash reporting, feature-usage, call-status or version-adoption signal; no Company consumption of the cost aggregates; no control plane | the whole implementation (Production Integration, after the audit); the audit fields `Operational Events Required` / `Company Controls Required` (End-to-End audit); operational readiness (Release Hardening) |
| User Identity / Preferences / QANDEEL Understanding | P1 (`CLOSED / FROZEN`): one account identity with context-scoped projections; private Login ID, verified Email, Name, Shared ID and unique Public ID; no traditional Profile page; one General Settings destination; Memory versus «فهم قنديل / QANDEEL Understanding»; the exposure matrix; the Dark / Light / System preference (default Dark, Analysis always dark); the Shared-ID reachability law; three-stage sequential Introduction image disclosure | in part. W1B-01 (merged through PR #284) adds the canonical Name, the private case-insensitive Login ID store, verified-Email sign-up and first use; W2-01 (merged through PR #285) adds Login-ID sign-in; W3-01 (merged through PR #287) adds the ONE General Settings destination (two groups) and the Dark / Light / System preference; W3-02 (merged through PR #288) adds Account & Identity with the auto-generated Public ID and its one lifetime manual change (migration `0125`). W3-MEGA-A (merged through PR #295) adds the Name, Login ID and Email changes, the Security & Sign-in group and the Shared ID format in the backend only (migration `0129`; no Shared-ID surface before W6); W3-MEGA-S (merged through PR #296) adds the Language row, Export My Data and Personal-world Delete Account (migration `0130`). W3-MEGA-U (merged through PR #291) implements QANDEEL Understanding (`E2E-D-14`) and its Contested / Under Review runtime (`E2E-D-15`, `PG-01`; migrations `0126`–`0127`); W3-MEGA-M (merged through PR #293) implements conversational Memory control (`E2E-D-13`, migration `0128`) | the whole production implementation and the implementation/runtime carry-forwards in P1 §16. The account / security / privacy journeys P1 deferred are decided by the [W3-PDG-01 closure](docs/canonical-authority/final-product-experience/w3/QANDEEL_W3_PDG01_ACCOUNT_SECURITY_PRIVACY_PRODUCT_DECISION_CLOSURE_v1.0.md) and implemented by W3-MEGA-A / W3-MEGA-S, except the named W3 residuals in §7 (Account Photo, Bold Text, the Android per-app language, world-scoped export, the W3-MEGA-S copy approval); account deletion across Connected Worlds is blocked (`QAN-BL-ACCT-01`) |
| Final iconography | P2 (`CLOSED / FROZEN`): the Hybrid QANDEEL Icon System, frozen by reference to the merged P2-A package's geometry, machines and utility sourcing rule. G1.2's icon glyphs are superseded; its audio strip and the broader Voice visual language are still not frozen | in part: W1A-01 draws three P2 glyphs on the Conversation surface (Send, the depth glyph, the curated back chevron) through the installed Skia renderer. No final rail, Temporal Spine, Aperture, Return or navigation iconography exists in `apps/mobile/`. `react-native-svg` is not a dependency and is not authorized by P2 | the production vector / component port and device accessibility validation (P2 §14) — the Timeline / Spine / Aperture, Return, Orientation Chrome and navigation iconography are VPORT-02's (NEXT); a truthful speaking indicator waits on `QAN-BL-VOICE-01`. The non-signal Voice visuals were later frozen by P4 |
| Notifications / proactive attention | I-08N-01 freezes the foundational semantics: the Product gate, attention budgets, interruption classes, privacy/disclosure contract, Direct Entry constraints and user controls. P3 (`CLOSED / FROZEN`) freezes the final Product realization by reference to the merged P3-A package: the Activity surface and entry, Open Ledger / Open Link, the attention mark and counts, the Attention Strip, the Analysis and Live Call attention laws, the Lock Screen labels, permission education, Notifications & Activity settings, Quiet Hours / Snooze defaults and the v1 frequency ceilings | none. No production notification runtime / transport, Push provider, Activity surface, attention mark or notification setting is established on `main`, and none is established by the P3 closure | the whole production implementation and the carry-forwards in P3 §18: Push provider, APNs / FCM, device tokens, workers, storage / pagination / retention, scoring / ranking, iOS categories and Android channels, the Product-class → OS-level mapping, native badges, platform permission wording, device validation. Of the copy P3 §17 left unfrozen, P4 ratified the residual copy on frozen P3 surfaces (P4-C4); the permission-education sheet and lower-priority journey copy go to the End-to-End audit |
| Plans / Credits / Usage Economy | CW2-08 freezes only the high-level law: entitlement restricts actions rather than ownership, and Credits are resource/compute availability only and never alter consent/ownership/truth | no complete plan/credit/billing Product system is established on `main`. AI-COST-01 (merged through PR #303) is the accounting **foundation** only: a provider-neutral usage / cost ledger, effective-dated Price Cards and a Credit Policy contract whose activation gate admits `DRAFT` only (migration `0135`) | the Product economy (formula, plans, allowances, balances, exhaustion) and provider selection, from measured evidence; no formula or pricing is frozen or active |
| Sign-in / auth | T-12P, T-14; P1 §3 now sets the final Product requirement: one `Login ID OR Email` identifier plus Password, with generic failure wording | T-14 is implemented and Email-only. W1B-01 (merged through PR #284) adds sign-up with a mandatory 6-digit Email code beside it. W2-01 (merged through PR #285) makes it the final sign-in (one `Login ID OR Email` identifier), with password recovery and the session-ended / unable-to-verify treatment | W2 is CLOSED: W2-02 (merged through PR #286) delivered the static launch and app icon, and W3-01 (merged through PR #287 at `023cb9874376ac69db5848db099d06034d5deb54`) the final current-device Sign out (`E2E-D-07`). W3-MEGA-A (merged through PR #295) adds Change password, Sign out from other devices and the Email as recovery method. Open: the named W3 residuals (§7); `QAN-BL-SEC-01`; `QAN-BL-PROD-04` (`PROD-AUTH-01`, the remote auth-verification cost). T-14 recorded sign-up, password reset and onboarding, among others, as anti-scope (backlog §7) |

---

## 5. Open and deferred register

This section is derived only from [`docs/qandeel-canonical-backlog-v1.md`](docs/qandeel-canonical-backlog-v1.md)
§4. The counts were parsed mechanically, one index row per ID, and they equal the backlog's own §7. It is
a summary, not a second backlog. Read the backlog itself for sources, reopen conditions and full semantics.

| Status | Count |
|---|---:|
| `DEFERRED — OWNED` | 8 |
| `VALIDATION — OPEN` | 0 |
| `OPEN — UNASSIGNED` | 10 |
| `CLOSED — TOMBSTONE` | 15 |
| **Total** | **33** |

| Severity (all 33) | Count |
|---|---:|
| `HIGH` | 20 |
| `MEDIUM` | 12 |
| `LOW` | 1 |

Recounted mechanically from the §4 index at `7221a635a6a7fe7564fb3f1e2e19c1ca189164c4` by ROADMAP-REC-01; the
previous table (25 items) predated the `QAN-BL-PROD-*`, `QAN-BL-LAUNCH-*` and `QAN-BL-PRIV-01` admissions. The severity
table counts all 33 rows, tombstones included. The 18 active (non-tombstone) items split 8 `HIGH`, 9 `MEDIUM` and
1 `LOW`. Here they are in the backlog's own index order:

| ID | Title | Owner | Severity | Status |
|---|---|---|---|---|
| `OPEN-06` | Bookmarks | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |
| `OPEN-08` | Coarse Temporal Step | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |
| `OPEN-09` | Object-Originated Version Jump | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |
| `OPEN-19` | Dedicated No-Op Acknowledgement | `UNASSIGNED` | `LOW` | `OPEN — UNASSIGNED` |
| `QAN-BL-SEC-01` | Mobile Credential Backup & Hardware Security Hardening | `QAN-SEC-01 — Pre-release Mobile Credential Security` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-NAV-01` | Cross-Session Timeline | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |
| `QAN-BL-NAV-02` | Analysis Replay | `UNASSIGNED` | `MEDIUM` | `OPEN — UNASSIGNED` |
| `QAN-BL-VOICE-01` | Personal Voice / Live Call Runtime + Durable Audio Source | `UNASSIGNED` | `HIGH` | `OPEN — UNASSIGNED` |
| `QAN-BL-VIS-01` | Heavy-History / Long-Term Living Analysis World Density + LOD Stress Proof | `UNASSIGNED` | `HIGH` | `OPEN — UNASSIGNED` |
| `QAN-BL-CTX-01` | Runtime-backed Conversational Relevance | `QAN-CTX-01 — Conversational Relevance Runtime` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-CW-01` | Owner Deletion Does Not Reach the Public DRAFT Source-Content Derivative (`ASSURE-F05`) | `UNASSIGNED` | `HIGH` | `OPEN — UNASSIGNED` |
| `QAN-BL-LANTERN-01` | Lantern Gateway Identity Moment v1 — Creative / Motion / Interaction Realization | `QANDEEL — Lantern Gateway Identity Moment v1` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-ACCT-01` | Account Deletion Across Connected Worlds — Explicit Connected-Worlds Deletion Blocker | `UNASSIGNED` | `HIGH` | `OPEN — UNASSIGNED` |
| `QAN-BL-PROD-04` | Remote Auth Verification Cost and Capacity (PR01-A01 / A-03 / A-04) | `PROD-AUTH-01 — Auth Verification Path` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-PROD-05` | List / Fan-out Corrections and Unmeasured Payload / Semantic-Phase Sizes (PR01-D/M) | `PROD-DATA-01 — List/Fan-out Correction` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-LAUNCH-01` | Trusted Proxy / Edge / Origin Production Proof | `LAUNCH-EDGE-SECURITY-GATE — Trusted Proxy / Edge / Origin Production Proof` | `HIGH` | `DEFERRED — OWNED` |
| `QAN-BL-LAUNCH-02` | Retired Login ID / Public ID Digest: Keyed (HMAC) Hardening Under Managed Key Custody (P-7) | `FINAL-LAUNCH-CLOSURE — Identifier Key Management Gate` | `MEDIUM` | `DEFERRED — OWNED` |
| `QAN-BL-PRIV-01` | Export My Data Omits the Reader's Later Explicit Agreement with a Disagreed Understanding Item | `PRIV-EXPORT-01 — Export My Data: Understanding Resolution Facts` | `MEDIUM` | `DEFERRED — OWNED` |

Severity states the consequence *if an item is reopened*. It is not a priority or a schedule (backlog §2).
An entry authorizes no implementation (BG-07).

---

## 6. Administrative truth

- **Recovered authority is in GitHub.** The Experience Architecture chain (Core Checkpoint v2, Stages 0–6),
  Connected Worlds v2 (CW2-00 … CW2-08), the final I-08A Product Shell / IA / Naming closure and the final
  I-08N-01 Notification / Proactive Attention contract are preserved byte-exact in
  [`docs/canonical-authority/`](docs/canonical-authority/README.md).
- **That directory is preservation, not the current entry point.** Some contents are historical / upstream;
  I-08A and I-08N-01 are later frozen Product authority. Explicit later amendments still bind.
- **[`docs/design/canonical-artifacts/`](docs/design/canonical-artifacts/README.md) is the canonical locator
  for Product / design artifacts.** Its index,
  [`QANDEEL_CANONICAL_ARTIFACT_INDEX.md`](docs/design/canonical-artifacts/QANDEEL_CANONICAL_ARTIFACT_INDEX.md),
  names each domain's final authority and the later amendments that bind over it.
- **[`docs/qandeel-canonical-backlog-v1.md`](docs/qandeel-canonical-backlog-v1.md) is the only cross-task
  backlog.** No other register exists, and this file is not one.

---

## 7. Forward roadmap

The Product Owner has now frozen the **forward sequencing**, recorded in
[`QANDEEL_PRODUCT_ROADMAP.md`](QANDEEL_PRODUCT_ROADMAP.md).

The current roadmap phase is:

> **Final Product Decision Closure is complete.** P1–P4 are `CLOSED / FROZEN`; P4 merged through PR #280 at
> `d6d0999dea26ba97b595e8a97e1a630eb659874f`. The End-to-End audit below **has started** through its first task,
> `E2E-01 — Complete Product Journey & Surface Census v1`. The phase is not closed.

Ordered Product tracks:

1. **P1 — User Profile / Identity / Preferences / QANDEEL Understanding** — `CLOSED / FROZEN` by
   [`docs/qandeel-p1-user-identity-preferences-understanding-canonical-closure.md`](docs/qandeel-p1-user-identity-preferences-understanding-canonical-closure.md).
   Production implementation remains open.
2. **P2 — Final Iconography System** — `CLOSED / FROZEN` by
   [`docs/qandeel-p2-final-iconography-canonical-closure.md`](docs/qandeel-p2-final-iconography-canonical-closure.md).
   Production implementation remains open.
3. **P3 — Notification Final Realization** — `CLOSED / FROZEN` by
   [`docs/qandeel-p3-notification-activity-final-realization-canonical-closure.md`](docs/qandeel-p3-notification-activity-final-realization-canonical-closure.md).
   Production implementation remains open.
4. **P4 — Remaining Product / Visual Gaps Census & Closure** — `CLOSED / FROZEN`, merged through PR #280 at `d6d0999dea26ba97b595e8a97e1a630eb659874f`, by
   [`docs/canonical-authority/final-product-experience/p4/QANDEEL_P4_FINAL_CLOSURE_v1.0.md`](docs/canonical-authority/final-product-experience/p4/QANDEEL_P4_FINAL_CLOSURE_v1.0.md),
   with `APP-OPS-01` `CLOSED / FROZEN` beside it. The exceptional lantern gateway identity moment is **in v1**; its
   design / motion / interaction / technology work belongs to the standalone task **QANDEEL — Lantern Gateway Identity
   Moment v1**, carried as `QAN-BL-LANTERN-01`. Production implementation remains open. Local evidence:
   [`docs/p4/`](docs/p4/P4_READ_FIRST.md).

With P1–P4 closed and merged:

> **QANDEEL End-to-End Product Experience Completeness Audit**

That phase also carries the evidence-led QANDEEL Model / Provider benchmark and selection, Plans / Credits /
Usage Economy work, and the complete account/authentication lifecycle review. It also adds APP-OPS-01's two gap-matrix
fields, `Operational Events Required` and `Company Controls Required`, to every relevant User Moment (`PO-OPS-11`).
Production Integration follows the audit and its resulting closures; Release Hardening / Launch comes after production
integration.

**Important:** the roadmap schedules Product work; it does **not** itself open an implementation task. P1 – P4 are
closed as Product / design contracts and implement nothing. Production Integration has started through **bounded,
explicitly Product-Owner-authorized slices only** — `W1A-01 Authenticated Personal Conversation Core` (merged) and
`W1B-01 Account Identity + Verified Sign-up + First Use` (merged) and `W2-01 Final Account Access Lifecycle` (merged) and
`W2-02 Production Launch Identity` (merged) and `W3-01 General Settings Foundation + Appearance + Sign Out` (merged) and
`W3-02 Account & Identity Foundation + Public ID v1` (merged)
(below); no other wave or Product area is opened by them, and the audit
phase is not closed. W3-MEGA-U is now also MERGED / CLOSED through PR #291 at
`226b61710b36c1ecba27b816a460fe16c040639a`. **W2 is CLOSED.** `E2E-D-14`, `E2E-D-15` and `PG-01` are closed. W3-MEGA-M
is MERGED / CLOSED through PR #293 at `3c0ea458a22a17a2a50c616b708f097f5911fb34` and closed `E2E-D-13`
([record](docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md)). W3-PDG-01 decided
`D-04`, `D-06`, `D-08`, `D-11`, `D-12`, `D-16` and `D-17` (below); W3-MEGA-A (PR #295) and W3-MEGA-S (PR #296), both
merged, implemented them within the limits their records state, and W3-CORR-U (PR #302, merged) corrected Understanding
integrity.

**Execution sequencing after ROADMAP-REC-01 (2026-10-04, through PR #303).** Three things are kept apart:

- **Merged task completion.** Every W3 task above is merged. So are VPORT-01 and the cross-cutting tasks in §3.7.
- **W3 is not phase-closed.** Its named residuals stay open, each where its record put it:
  - `E2E-D-03` Account Photo — `BLOCKED / DEFERRED BY MEDIA STORAGE IMPLEMENTATION BOUNDARY`;
  - `E2E-D-02` — the nine-group hierarchy is not closed (six real groups; Notifications, Introductions and Plan & Usage
    have no function yet);
  - `E2E-D-08` — the Shared-ID surface waits for Shared invitations (W6);
  - `E2E-D-11` — the Android per-app language decision and device validation;
  - `E2E-D-12` — Bold Text;
  - `E2E-D-16` — world-scoped export categories are `NOT YET INCLUDED`;
  - `E2E-D-17` — `FULL ACCOUNT DELETION — BLOCKED BY CONNECTED WORLDS` (`QAN-BL-ACCT-01`, `QAN-BL-CW-01`);
  - the W3-MEGA-S copy, which its record still shows as PROPOSED — NOT APPROVED, a Product Owner decision;
  - `PG-02` and `PG-04`;
  - live Email delivery, which is `EXTERNAL / NOT PROVED`;
  - `QAN-BL-PRIV-01`, owned by `PRIV-EXPORT-01`.
- **Current sequencing.** In the Product Owner's 9-stage execution map ([Project Map §5.1](QANDEEL_PROJECT_MAP.md)):
  - Stage 1 (Personal Core / W3 core) is **DONE FOR THE CURRENT EXECUTION SEQUENCE, WITH NAMED RESIDUALS**;
  - Stage 2 (Final Visual Production Port) is **ACTIVE**: `VPORT-01` is **DONE**, and **`VPORT-02 — Timeline +
    Orientation Chrome + P2 Final Coherence` is NEXT**;
  - Stages 3–9 are **LATER**.
  `VPORT-02` still opens only through its own Task Contract.
  `PROD-AUTH-01` and `PROD-DATA-01` stay `DEFERRED — OWNED` and are not promoted ahead of it.

**W3-MEGA-S — Personal Controls & Settings Integration v1 (MERGED / CLOSED through PR #296 at
`e87aac6b4e9ec6c1b6542d2ba3c82cc6cc9af6e8`; implemented on a Draft PR, as written below).** On baseline
`1e7b681052c7af09576197bcfb204e1b39775554`: General Settings gains two real groups — «قنديل والمحادثة» / QANDEEL &
Conversation with the Language row (the SYSTEM setting; iOS per-app language declared, Android the device language; no
in-app toggle) and «الخصوصية والبيانات» / Privacy & Data with Export My Data (Personal world, server-prepared, owner-only,
expiring in-app download) and Delete Account for the Personal world (password, cancellable grace period, ONE governed
Personal erasure through a controlled change to sixteen history guards, provider account removed, identifiers not reused;
migration `0130`). Reduce Motion is now followed mid-session on the W1A / W3 surfaces.
**`D-17 PERSONAL-WORLD IMPLEMENTATION — READY`; `D-17 FULL ACCOUNT DELETION — BLOCKED BY CONNECTED WORLDS`**
(`QAN-BL-ACCT-01`, `QAN-BL-CW-01` stay open). Its new
copy awaits the Product Owner (its record still shows it PROPOSED — NOT APPROVED after the merge); Bold Text, the Android
per-app language and device validation remain open. W3 is not phase-closed (above).
Record:
[`docs/e2e/QANDEEL_W3_MEGA_S_PERSONAL_CONTROLS_SETTINGS_IMPLEMENTATION_RECORD_v1.md`](docs/e2e/QANDEEL_W3_MEGA_S_PERSONAL_CONTROLS_SETTINGS_IMPLEMENTATION_RECORD_v1.md).

**W3-MEGA-A — Account & Identity Completion + Security v1 (MERGED through PR #295 at
`1e7b681052c7af09576197bcfb204e1b39775554`).** On baseline
`f3355e7e0aafacec4153d9049aa029b65a851c13`: the owner's Name and Login ID changes (the Login ID behind the provider's own
password check, demanded again by the database), Change Email with both confirmations and no partial change, the
Security & Sign-in group (Change password, Sign out from other devices, the Email as recovery method; a password change
or recovery ends every other session), and the Shared ID format in the backend only (migration `0129`; no surface before
W6). Account Photo is `BLOCKED / DEFERRED BY MEDIA STORAGE IMPLEMENTATION BOUNDARY`, so `E2E-D-03` stays open; the Product Owner
approved its four new copy pairs and its Login ID verification interpretation in R1. Record:
[`docs/e2e/QANDEEL_W3_MEGA_A_ACCOUNT_IDENTITY_SECURITY_IMPLEMENTATION_RECORD_v1.md`](docs/e2e/QANDEEL_W3_MEGA_A_ACCOUNT_IDENTITY_SECURITY_IMPLEMENTATION_RECORD_v1.md).

**W3-PDG-01 — Account, Security & Privacy Product Decision Closure (`CLOSED / FROZEN — PRODUCT DECISIONS` on merge;
documentation only).** The Product Owner explicitly approved the seven decision directions recorded in
[`QANDEEL_W3_PDG01_ACCOUNT_SECURITY_PRIVACY_PRODUCT_DECISION_CLOSURE_v1.0.md`](docs/canonical-authority/final-product-experience/w3/QANDEEL_W3_PDG01_ACCOUNT_SECURITY_PRIVACY_PRODUCT_DECISION_CLOSURE_v1.0.md),
the only binding record. Only its statements marked **PO** are Product authority. The
[decision package](docs/e2e/QANDEEL_W3_PDG01_ACCOUNT_SECURITY_PRIVACY_DECISION_PACKAGE_v1.md) remains research /
options evidence, not independent Product authority. The closure decides:

- **Change Email:** password + a code to the new Email + old-Email confirmation; no partial change; signed out after.
- **Minimal Security v1:** Change Password, Sign out from other devices, Email as the recovery method; changing or
  recovering the password ends other sessions; no Phone, 2FA or Passkeys rows.
- **Shared ID format:** the pattern `K7QM-4XWD-P9TR` (12 random characters; a pattern, not a value); the surface
  waits for W6.
- **App language:** a system per-app language row; no in-app toggle.
- **Accessibility:** no in-app accessibility settings, with platform-signal parity as an implementation obligation.
- **Export:** an in-app, asynchronous export journey.
- **Delete Account:** the journey and principles, including the Connected Worlds Launch Gate.

Nothing is implemented. **Delete Account is not production-ready.** Its Connected Worlds completeness is the
`EXPLICIT CONNECTED-WORLDS DELETION BLOCKER` (`QAN-BL-ACCT-01`, linked to `QAN-BL-CW-01`). The proposed next tasks,
`W3-MEGA-A — Account & Identity Completion` and `W3-MEGA-S — Personal Controls & Settings Integration`, were
sequencing only and were not opened by it. *(Historical as of W3-PDG-01. Both were later opened by their own Task
Contracts and are merged, through PR #295 and PR #296.)*

**W3-MEGA-M — Conversational Memory Control & Trust (MERGED / CLOSED through PR #293 at
`3c0ea458a22a17a2a50c616b708f097f5911fb34`).** Closed `E2E-D-13` in the Conversation, with no Memory editor. It works
from canonical owner-only Memory truth, and covers:

- inspect;
- explicit remember;
- correction by supersession;
- forget (`DELETED`, a status change, not physical erasure);
- do-not-rely (`DISABLED`);
- clarification instead of a guessed change.

Each change commits in one transaction with the reply that reports it (migration `0128`). Record:
[`docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md`](docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md).

**W3-02 — Account & Identity Foundation + Public ID v1 (MERGED / CLOSED through PR #288 at
`92444c3ab8c35f7d819888be76aa6395c93d94b8`).** Closed `E2E-D-09`: every account
holds one auto-generated Public ID on the canonical account row (migration `0125`: backfilled, generated by the server
and never from private identity, unique case-insensitively, distinct from `user_id`, Login ID, Email, Shared ID and the
internal I-05 `public_identity_ref`), with exactly ONE lifetime manual change enforced by the database itself
(idempotent per command, concurrency-safe, `UNCHANGED` for the current ID, no availability oracle), reached through two
guarded owner-only account routes, and realized as the real Account & Identity group of General Settings with the
frozen warning before the one commit and lost-answer reconciliation by re-reading. `E2E-D-02` advances (three real
groups), NOT CLOSED; `E2E-H-08` is not closed; Account & Identity is not complete.
Record:
[`docs/e2e/QANDEEL_W3_02_ACCOUNT_IDENTITY_PUBLIC_ID_IMPLEMENTATION_RECORD_v1.md`](docs/e2e/QANDEEL_W3_02_ACCOUNT_IDENTITY_PUBLIC_ID_IMPLEMENTATION_RECORD_v1.md).

**W3-MEGA-U — QANDEEL Understanding + User Disagreement / Contested (MERGED / CLOSED through PR #291 at
`226b61710b36c1ecba27b816a460fe16c040639a`).** U1 provides the owner-only Understanding projection
(deterministic, qualitative confidence from canonical structure; the Confidence Runtime stays uncalibrated), U2 the
Personal-QANDEEL entry (P4-C1 U-A), first view, detail and "talk to QANDEEL about this" (migration `0126`), and U3 the
explicit disagreement → Contested / Under Review runtime with real re-evaluation and reduced reliance (migration
`0127`, `PG-01`). `E2E-D-14`, `E2E-D-15` and `PG-01` are CLOSED; `PG-02` and `PG-04` stay open; W3 stayed ACTIVE at that merge (for current sequencing, see the execution paragraph
above).
Record:
[`docs/e2e/QANDEEL_W3_MEGA_U_UNDERSTANDING_CONTESTED_IMPLEMENTATION_RECORD_v1.md`](docs/e2e/QANDEEL_W3_MEGA_U_UNDERSTANDING_CONTESTED_IMPLEMENTATION_RECORD_v1.md).

**W3-01 — General Settings Foundation + Appearance + Sign Out (MERGED / CLOSED through PR #287 at
`023cb9874376ac69db5848db099d06034d5deb54`).** Closed `E2E-D-01` (the ONE
General Settings destination, entered from Personal QANDEEL's own row beneath the upper chrome — P4-C1 S-B), `E2E-D-10`
(Dark / Light / System through ONE appearance authority, Dark default, device-local per-identity persistence, the
canonical Light family, the Analysis dark under every preference) and `E2E-D-07` (this device's Sign out through the
existing auth authority, current session / current device only, durable across a restart even when the provider
sign-out fails). `E2E-D-02` advanced only, NOT CLOSED: the root exposes the two groups W3-01 owns. It consumed the W2-02
night-mode carry-forward. With D-07 closed, W2 is CLOSED. Record:
[`docs/e2e/QANDEEL_W3_01_GENERAL_SETTINGS_APPEARANCE_SIGNOUT_IMPLEMENTATION_RECORD_v1.md`](docs/e2e/QANDEEL_W3_01_GENERAL_SETTINGS_APPEARANCE_SIGNOUT_IMPLEMENTATION_RECORD_v1.md).

**W2-02 — Production Launch Identity (merged through PR #286 at `b650b56f7436ce63d33c0af34036a963a03f5eee`).** Implements `E2E-A-02` (the final QANDEEL app icon on
the device: the I-08B2.5 platform exports installed byte-for-byte — the iOS 13-size set with no dark / tinted variant,
the Android adaptive icon at the ratified 48 dp framing with its verbatim monochrome layer — and the launcher label
`QANDEEL`) and `E2E-A-01` (the static launch → system handoff: the iOS Launch Screen is the World of the device
appearance and nothing else; the Android 12+ system splash is the canonical icon on the World with no second splash;
the first app-owned frame is the World; no timer or hold). The Android application night mode was set to the effective
QANDEEL appearance, Dark, until W3 implemented the P1 preference (W3-01, merged, replaced the constant with the reader's choice). It installs the canonical bytes through one
narrow config plugin recorded as a Level-4 CNG exception for Engineering Architecture review. The Lantern
(`QAN-BL-LANTERN-01`) and Sign out (`E2E-D-07`) are not implemented. Record:
[`docs/e2e/QANDEEL_W2_02_PRODUCTION_LAUNCH_IDENTITY_IMPLEMENTATION_RECORD_v1.md`](docs/e2e/QANDEEL_W2_02_PRODUCTION_LAUNCH_IDENTITY_IMPLEMENTATION_RECORD_v1.md).

**W2-01 — Final Account Access Lifecycle (merged through PR #285 at `df194edf6d70a2a300a0251ed114e7ad8715485e`).** Implements `E2E-A-06` / `A-07` / `A-08` (the final
Sign in: ONE identifier field accepting a Login ID or an Email, the approved generic failure and persistent Login ID
help), `E2E-A-11` (in-app password recovery: Email only, non-enumerating, 6-digit code, new password + confirmation,
ending signed out) and `E2E-A-12` (a proved ended session reaches Sign in with the approved notice; an unverifiable
session is the approved recovery state with Retry — "Unknown ≠ Signed Out"). A Login ID is resolved on the server
only (migration `0124`) and spent on the provider's own password grant, so no client learns which Email it belongs
to; recovery authority is held in memory and never becomes a signed-in state. Live branded transactional Email
delivery = EXTERNAL / NOT PROVED. Record:
[`docs/e2e/QANDEEL_W2_01_IMPLEMENTATION_RECORD_v1.md`](docs/e2e/QANDEEL_W2_01_IMPLEMENTATION_RECORD_v1.md).

**W1B-01 — Account Identity + Verified Sign-up + First Use (merged through PR #284 at `6b333df7774d33b034575243b3592d21f2603683`).** Implements `E2E-A-09` (create
account: exactly Name, Login ID, Email, Password), the Product Owner's `E2E-A-10` decision (mandatory Email
verification by an in-app 6-digit code before QANDEEL), `E2E-A-13` (the concise first-use Welcome), `E2E-A-14` (the
First Conversation Opening) and `E2E-B-02` (the unchanged normal opener) on the production route, and advances
`E2E-K-02`. The account row gains the canonical Name, the private case-insensitive Login ID and the first-use state
(migration `0123`); the signed-out entry becomes the Auth Gateway destination (Sign in / Create account / Verify
Email) that the future Lantern moment (`QAN-BL-LANTERN-01`, not implemented) will hand off into. The Welcome and First
Conversation Opening copy is a Product Owner controlled amendment to I-08A4 §14–§15
([amendment](docs/canonical-authority/final-product-experience/w1b/QANDEEL_W1B01_FIRST_USE_WELCOME_FIRST_CONVERSATION_OPENING_CONTROLLED_AMENDMENT_v1.0.md));
I-08A4 itself is unchanged. Live Email-code delivery depends on Supabase project configuration this repository does
not hold and is not proved. Record:
[`docs/e2e/QANDEEL_W1B01_IMPLEMENTATION_RECORD_v1.md`](docs/e2e/QANDEEL_W1B01_IMPLEMENTATION_RECORD_v1.md). Login-ID
sign-in, password recovery and session-expired treatment are W2-01's (above); identity editing (W3) remains open.

**W1A-01 — Authenticated Personal Conversation Core (merged through PR #283 at `7c9ee5e5bcb5f567dc7ef1944bcde92e8cdf99de`).** Implements `E2E-B-03` (write / send),
`E2E-B-04` (read QANDEEL's reply and the authoritative conversation-so-far, through the new owner-scoped read route
`GET /conversation/sessions/:sessionId/turns`) and `E2E-B-07` (Conversation ↔ Analysis) on the production mobile route,
in the frozen visual language (Dark, UTTERANCE / FIELD, G1.1 speaker sides, Estedad v8.5 static faces, P2 geometry
through Skia). A committed turn whose reply failed stays in history with its failure and has **no retry** (Option C: the
frozen turn-state machine makes FAILED terminal). Record:
[`docs/e2e/QANDEEL_W1A01_IMPLEMENTATION_RECORD_v1.md`](docs/e2e/QANDEEL_W1A01_IMPLEMENTATION_RECORD_v1.md). W1B / W1C /
W3 / W4, cancel (B-05), reply retry (B-06), Voice and provider selection remain open.

**End-to-End audit — current truth.** The audit started with `E2E-01`. Its census,
[`docs/e2e/E2E01_READ_FIRST.md`](docs/e2e/E2E01_READ_FIRST.md), is the current audit artifact: it classifies 154 user
moments against the roadmap's eight classifications, records APP-OPS-01's two fields for each, and groups the gaps into
closure waves labelled `PROPOSED FOR PRODUCT OWNER REVIEW`. It creates no Product decision and no Production Integration
authorization, and the wave ordering is not a roadmap change. Model / provider selection remains unresolved: no provider
has been benchmarked or selected. The Personal Voice / Live Call runtime remains `OPEN — UNASSIGNED`
(`QAN-BL-VOICE-01`), and Plans / Credits remain coupled to provider-cost evidence. The census found that no user moment
is `COMPLETE / PRODUCTION-READY`, and that the mobile client had no Conversation surface at the census; W1A-01 has since
added it (§4). AI-COST-01 (merged) gives the benchmark and the economy work a measured cost ledger; it selects no provider
and activates no Credit formula.

The canonical backlog remains separate: backlog entries are not self-executing, and severity does not order them.

**Owners that current records name for future work.** Each is a named owner and does not override the roadmap or
create an implementation task:

| Owner named by a record | What the record assigns to it | Source |
|---|---|---|
| Connected Worlds `I-08` | the mobile Matching UI, candidate cards or feed, the final visual proposal experience and navigation surfaces. It also owns the final Introduction screen and the Matching / Live-Call presentation | [`docs/matching-introduction-runtime-v1.md`](docs/matching-introduction-runtime-v1.md) §24; [G3 closure](docs/design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md) §D, §G |
| Connected Worlds `I-09` / `CW2-08` | report, block, moderation, the safety policy engine, entitlements, the production Launch Gate and feature rollout | [`docs/matching-introduction-runtime-v1.md`](docs/matching-introduction-runtime-v1.md) §24; backlog I-05, I-06, I-07 closure records |
| `QAN-SEC-01 — Pre-release Mobile Credential Security` | `QAN-BL-SEC-01`. Its reopen condition is "automatic before the first production-store release" | [backlog §5](docs/qandeel-canonical-backlog-v1.md) |
| `QAN-CTX-01 — Conversational Relevance Runtime` | `QAN-BL-CTX-01`. It owns the future runtime/client authority for item-level relation to the current conversation; no relevance-driven world behavior may be claimed before that contract exists | [P4-C1 §5–§6](docs/canonical-authority/final-product-experience/p4/QANDEEL_P4C1_SHELL_CHROME_DECISIONS_AND_LIVE_CONTEXT_CONTROLLED_AMENDMENT_v1.0.md); [backlog §5](docs/qandeel-canonical-backlog-v1.md) |
| `QANDEEL — Lantern Gateway Identity Moment v1` | `QAN-BL-LANTERN-01`. Standalone future Brand / Motion task. P4 freezes only that the exceptional lantern identity moment is in v1; research, creative directions, motion, interaction choreography, implementation technology and proof wait until this task is explicitly opened | [P4-C2 §2](docs/canonical-authority/final-product-experience/p4/QANDEEL_P4C2_BRAND_SCOPE_VOICE_COPY_APP_OPS_PRODUCT_DECISIONS_v1.0.md); C3 expressive headroom §4; [backlog §5](docs/qandeel-canonical-backlog-v1.md) |
| `VPORT-02 — Timeline + Orientation Chrome + P2 Final Coherence` | the remaining Stage-2 port: Timeline styling, Spine / Aperture, Return icons, Orientation Chrome visuals, navigation iconography, Call Rail. It inherits VPORT-01's three handoff notes. **NEXT**; it opens only through its own Task Contract | [VPORT-01 record §16](docs/e2e/QANDEEL_VPORT_01_LIVING_ANALYSIS_WORLD_PRODUCTION_VISUAL_PORT_v1.md) |
| `PROD-AUTH-01 — Auth Verification Path`; `PROD-DATA-01 — List/Fan-out Correction` | `QAN-BL-PROD-04` and `QAN-BL-PROD-05`, both `DEFERRED — OWNED`; PROD-AUTH-01 waits on the Product Owner's choice among O1–O3 | [backlog §5](docs/qandeel-canonical-backlog-v1.md) |
| `LAUNCH-EDGE-SECURITY-GATE`; `FINAL-LAUNCH-CLOSURE — Identifier Key Management Gate` | `QAN-BL-LAUNCH-01` (edge / origin / real proxy topology) and `QAN-BL-LAUNCH-02` (keyed retired-identifier digest), Final Launch exit gates | [backlog §5](docs/qandeel-canonical-backlog-v1.md) |
| `PRIV-EXPORT-01 — Export My Data: Understanding Resolution Facts` | `QAN-BL-PRIV-01` | [backlog §5](docs/qandeel-canonical-backlog-v1.md) |
| Production Integration; Release Hardening & Launch | APP-OPS-01 implementation (after the audit, `PO-OPS-12`); control-plane security mechanics and diagnostic identity; operational readiness and release / OTA governance | [APP-OPS-01 §20, §23.1](docs/p4/APP_OPS_01_COMPANY_OPERATIONS_CONTRACT_CANDIDATE.md); [P4 final closure §10](docs/canonical-authority/final-product-experience/p4/QANDEEL_P4_FINAL_CLOSURE_v1.0.md) |

**These numbers differ from the architecture closure.** The phase numbers above are the ones the closed
records use. The Connected Worlds architecture closure §14 recommended a different numbering, and said
"The exact task IDs should be frozen only after inspecting the canonical repository". Read an `I-0N`
identifier against the closed record that uses it.

---

## 8. Start-here reading order

1. `QANDEEL_CURRENT_STATE.md` — this file.
2. [`QANDEEL_PROJECT_MAP.md`](QANDEEL_PROJECT_MAP.md) — where everything is, what binds over what, and the
   known traps.
3. [`QANDEEL_PRODUCT_ROADMAP.md`](QANDEEL_PRODUCT_ROADMAP.md) — Product Owner sequencing; it opens no task by itself.
4. [`docs/qandeel-canonical-backlog-v1.md`](docs/qandeel-canonical-backlog-v1.md) — read it in full at every
   task kickoff (BG-05).
   For End-to-End audit work, then read [`docs/e2e/E2E01_READ_FIRST.md`](docs/e2e/E2E01_READ_FIRST.md).
5. The current canonical record(s) for the task: the primary records cited in §3, and the
   [artifact index](docs/design/canonical-artifacts/QANDEEL_CANONICAL_ARTIFACT_INDEX.md) for Product / design work.
6. Historical / upstream authority in [`docs/canonical-authority/`](docs/canonical-authority/README.md), only
   when exact provenance or an audit needs it.

Coding agents also follow [`AGENTS.md`](AGENTS.md).
