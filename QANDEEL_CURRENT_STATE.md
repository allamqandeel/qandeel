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
| Snapshot date | 2026-09-25 |
| Canonical baseline | `916792d108f01c839b607b11997775a096d31b88`, the merge of PR #269 (recovered canonical authority preservation) |
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
| I-08A — Product Shell / IA / Canonical Naming | `I-08A4 — CLOSED / CANONICAL FREEZE COMPLETE`; integrated `I-08A — CANONICAL PRODUCT SHELL / IA / NAMING FOUNDATION — FROZEN`. Later explicit G1.1 / G1.2 amendments bind where they supersede A4 naming or shell statements, and so does P1 (`Readings` naming for its surface, General Settings placement). P3 adds one separate global Activity entry in the non-Analysis upper chrome and changes no World destination (its §19.4) | [`docs/canonical-authority/final-product-experience/i-08a/QANDEEL_I-08A4_CLOSURE_SYNTHESIS_CANONICAL_PRODUCT_SHELL_IA_NAMING_DECISION_RECORD.md`](docs/canonical-authority/final-product-experience/i-08a/QANDEEL_I-08A4_CLOSURE_SYNTHESIS_CANONICAL_PRODUCT_SHELL_IA_NAMING_DECISION_RECORD.md) |
| P1 — User Identity / Preferences / QANDEEL Understanding | `P1 — CLOSED / FROZEN — USER IDENTITY / PREFERENCES / QANDEEL UNDERSTANDING PRODUCT CONTRACT`. PRODUCT / DESIGN FROZEN — PRODUCTION IMPLEMENTATION OPEN. It narrowly amends I-08A4 naming, the F2 / G2 / G3 non-Analysis appearance rule and the T-14 final sign-in requirement (its §15) | [`docs/qandeel-p1-user-identity-preferences-understanding-canonical-closure.md`](docs/qandeel-p1-user-identity-preferences-understanding-canonical-closure.md) |
| P2 — Final Iconography System | `P2 — CLOSED / FROZEN — FINAL ICONOGRAPHY SYSTEM`. PRODUCT / DESIGN FROZEN — PRODUCTION IMPLEMENTATION OPEN. The Hybrid QANDEEL Icon System: N1 "Open" signature geometry, the navigation glyph above the destination word, Call Rail A "Keyed Seam" with End Call at 27 px, Temporal Spine + Aperture C "Parting", Hugeicons Free as the curated utility source (no runtime package), Calm State Morphing. It narrowly supersedes G1.2 §6 for the icon glyphs and call controls; the audio strip and broader Voice visual language stay unfrozen (its §13). Evidence: the merged P2-A package | [`docs/qandeel-p2-final-iconography-canonical-closure.md`](docs/qandeel-p2-final-iconography-canonical-closure.md); evidence [`docs/design/p2-iconography/QANDEEL_P2-A_FINAL_ICONOGRAPHY_INTEGRATED_VISUAL_PROOF/`](docs/design/p2-iconography/QANDEEL_P2-A_FINAL_ICONOGRAPHY_INTEGRATED_VISUAL_PROOF/P2_READ_FIRST.md) |
| P3 — Notification & Activity Final Product Realization | `P3 — CLOSED / FROZEN — NOTIFICATION & ACTIVITY FINAL PRODUCT REALIZATION`. PRODUCT / DESIGN FROZEN — PRODUCTION IMPLEMENTATION OPEN. It consumes `I-08N-01` and closes only the realization `I-08N-01` §21 left open: Activity «النشاط» / ACTIVITY (one global destination, not a World, entry in the non-Analysis upper chrome, none in the Analysis); the Open Ledger and Open Link glyphs; the neutral attention mark with no global count; the ordinary Attention Strip; ordinary attention deferred inside the Analysis and during a Live Call, with two call-safe exceptions (dismiss only; Replay the one temporarily occluded control); the L0–L3 labels; Notifications & Activity settings; Quiet Hours 23:00 → 08:00; the v1 ceilings. It supersedes no `I-08N-01` semantics and keeps G3 §D (its §19). Evidence: the merged P3-A package | [`docs/qandeel-p3-notification-activity-final-realization-canonical-closure.md`](docs/qandeel-p3-notification-activity-final-realization-canonical-closure.md); evidence [`docs/design/p3-notifications/QANDEEL_P3-A_NOTIFICATION_ACTIVITY_INTEGRATED_VISUAL_PROOF/`](docs/design/p3-notifications/QANDEEL_P3-A_NOTIFICATION_ACTIVITY_INTEGRATED_VISUAL_PROOF/P3_READ_FIRST.md) |
| I-08N-01 — Notification & Proactive Attention Product Contract | `CLOSED / NOTIFICATION & PROACTIVE ATTENTION PRODUCT CONTRACT FROZEN`. This is Product behavior / attention policy, not a production notification runtime. It stays the foundational notification semantic authority; P3 is its final Product realization | [`docs/canonical-authority/final-product-experience/i-08n/QANDEEL_I-08N-01_FINAL_CLOSURE_PACKAGE.md`](docs/canonical-authority/final-product-experience/i-08n/QANDEEL_I-08N-01_FINAL_CLOSURE_PACKAGE.md) |
| Phase V — Visual Language Discovery | `CLOSED` — `FREEZE WITH EXPLICIT OPEN ITEMS`, in the archive's own words | [`docs/design/phase-v/README.md`](docs/design/phase-v/README.md) |
| Phase VI: VI-01, VI-02 | each `CLOSED / FROZEN` as its archive states. VI-01 naming was amended by G1.1 | [`docs/design/phase-vi/`](docs/design/phase-vi/) |
| Phase VI: VI-03 and the Phase VI parent | `HISTORICAL TRACK STATE — SUPERSEDED BY LATER CANONICAL WORK`. VI-03-01 is a brief "NOT A FREEZE". The artifact audit classifies the later VI-03 explorations as "exploration, superseded by I-08B1". Phase VI has no closure record | [`docs/design/canonical-artifacts/LOCAL_ONLY_CANONICAL_ARTIFACT_AUDIT.md`](docs/design/canonical-artifacts/LOCAL_ONLY_CANONICAL_ARTIFACT_AUDIT.md) |
| I-08B1 Living Analysis World (FAR / MID / NEAR) | `CLOSED / FROZEN` (2026-09-20). PRODUCT / DESIGN FROZEN — PRODUCTION IMPLEMENTATION OPEN | [`docs/design/canonical-artifacts/living-analysis/README.md`](docs/design/canonical-artifacts/living-analysis/README.md) |
| I-08B2.5 brand, I-08B3.0-E3 typography, I-08B3.1 A–F material and appearance system | as stated per domain in the artifact index: C and F are `CLOSED / FROZEN`; D2R and E1R are `CLOSED / FROZEN` per the downstream ledger; typography, A3R2 and B4R are frozen per the downstream ledger; brand is a final production package with no standalone closure record | [`docs/design/canonical-artifacts/QANDEEL_CANONICAL_ARTIFACT_INDEX.md`](docs/design/canonical-artifacts/QANDEEL_CANONICAL_ARTIFACT_INDEX.md) |
| I-08B3.1-G: G1.1, G1.2, G2, G2.3, G3, and parent G | `CLOSED / FROZEN` | [`docs/design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md`](docs/design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md) §J |
| The I-08B3.1 parent and the I-08B parent | NOT ESTABLISHED BY CURRENT REPOSITORY AUTHORITY. No closure record for either parent exists on `main` | — |

### 3.6 Cross-cutting

| Domain | Lifecycle | Primary record |
|---|---|---|
| Voice / Live Call | the Product interaction is `CLOSED / FROZEN` at proof level. The runtime is `OPEN — UNASSIGNED` (`QAN-BL-VOICE-01`) | [`docs/design/i-08b3.1-g1.2/QANDEEL_G1_2_CANONICAL_CLOSURE.md`](docs/design/i-08b3.1-g1.2/QANDEEL_G1_2_CANONICAL_CLOSURE.md), [backlog](docs/qandeel-canonical-backlog-v1.md) |
| Notifications / proactive attention | the Product contract is frozen by `I-08N-01`, and its final Product realization by P3 (`CLOSED / FROZEN`). G3 §D's compatible rule stays binding: Matching must not interrupt a Live Call. No production notification runtime is established on `main`, and none of these records defines the runtime transport / mechanism | [`I-08N-01`](docs/canonical-authority/final-product-experience/i-08n/QANDEEL_I-08N-01_FINAL_CLOSURE_PACKAGE.md), [P3 closure](docs/qandeel-p3-notification-activity-final-realization-canonical-closure.md), [G3 closure §D](docs/design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md) |
| Security / pre-release | `QAN-BL-SEC-01` `DEFERRED — OWNED`; `QAN-BL-CW-01` `OPEN — UNASSIGNED`; the launch prerequisites fail closed | [`docs/t12-auth-storage-at-rest-disposition-v1.md`](docs/t12-auth-storage-at-rest-disposition-v1.md), [backlog](docs/qandeel-canonical-backlog-v1.md) |
| Governance | the canonical backlog is `ACTIVE — governance authority` | [`docs/qandeel-canonical-backlog-v1.md`](docs/qandeel-canonical-backlog-v1.md) |

---

## 4. Product / Design versus implementation

**A frozen design is not shipped code.** In several domains the Product and design canon is ahead of
production implementation. The table keeps three things apart:

- what has been decided;
- what production code implements today;
- what is still open.

| Area | Decided (Product / Architecture / Design) | In production code today | Still open |
|---|---|---|---|
| Conversation and intelligence | Foundation, QHIA and QIR contracts | the NestJS API in `apps/api/src/`. Its HTTP controllers exist only under `conversation/` and `health/` | Provider / LLM selection is deferred (QIR-001); the Product roadmap places QANDEEL-specific benchmark/selection alongside the End-to-End Product Experience Completeness Audit |
| Product shell / Global navigation / first use | I-08A4 freezes the Personal-centered App Shell, three-area Global Switcher, local-only Back, Direct Entry, bilingual Product language and first-use foundation; later G1.1 / G1.2 naming amendments bind | no complete production Global Shell implementing the I-08A contract is established on `main`; current mobile composition is the T-series / T-12 shell | production realization of the frozen I-08A shell while preserving later amendments |
| Living Analysis Map (Personal World) | Stages 0–6 and the T-series contracts | the mobile client in `apps/mobile/src/`: world projection, camera, Timeline, temporal navigation, Return, chrome, motion, responsive composition, recovery and sign-in. **The Map's paint is still the neutral grey structural placeholder** (T-12 §12) | the I-08B1 world is not ported: G3 §F records "no Skia / Reanimated port of the world". `QAN-BL-VIS-01` |
| Visual system (Living Brass, Light, typography, surfaces, colour, accessibility, appearance, brand) | the frozen I-08B design canon (§3.5) | none. No commit after T-14's merge (`615e586f`) changes `apps/mobile/` | the whole production port |
| Conversation / Analysis shell | G1.1; G3 Decisions A and B; the G2.3 and G3 controlled amendments to T-11 / T-12; P1 §12, under which non-Analysis surfaces follow the user's Dark / Light / System preference (default Dark) while the Analysis stays one dark place | the T-12 app-root composition | G3 §F lists these as unimplemented: the Analysis shell, the appearance cross-fade, the temporal-line placement and yield rule, compact `ReturnControls`, and device certification. The P1 appearance preference is unimplemented too |
| Shared World, Public World | CW2-01 … CW2-04; I-04, I-05 | the database runtime (migrations 0075–0099) and server modules in `apps/api/src/connected-worlds/` | no authenticated Product routes and no mobile surfaces. Launch prerequisites fail closed |
| Matching / Introductions | CW2-06; the G2.3 copy and process; the G3 §D Live-Call rule | the I-07 database runtime (0108–0118, 0120) | the mobile Matching UI, the final Introduction screen and the navigation surfaces, owned by Connected Worlds `I-08`. G3 §G holds the `OPEN COPY` items |
| Replay | CW2-05; the G1.1 placement ("an action on the current Conversation / Analysis context") | the I-06 backend runtime (0100–0107) | the Product Replay surface (`QAN-BL-NAV-02`). No media, storage or transport. Distribution is `NOT CLEARED / FAIL-CLOSED` |
| Voice / Live Call | G1.2 | none | all of it (`QAN-BL-VOICE-01`) |
| User Identity / Preferences / QANDEEL Understanding | P1 (`CLOSED / FROZEN`): one account identity with context-scoped projections; private Login ID, verified Email, Name, Shared ID and unique Public ID; no traditional Profile page; one General Settings destination; Memory versus «فهم قنديل / QANDEEL Understanding»; the exposure matrix; the Dark / Light / System preference (default Dark, Analysis always dark); the Shared-ID reachability law; three-stage sequential Introduction image disclosure | none of it. No Login ID, Shared-ID surface, Public ID policy, General Settings, sign-up, Understanding surface or appearance preference exists in production code | the whole production implementation and the implementation/runtime carry-forwards in P1 §16 |
| Final iconography | P2 (`CLOSED / FROZEN`): the Hybrid QANDEEL Icon System, frozen by reference to the merged P2-A package's geometry, machines and utility sourcing rule. G1.2's icon glyphs are superseded; its audio strip and the broader Voice visual language are still not frozen | none. No final icon, rail, spine or utility glyph exists in `apps/mobile/`; the production port and integration are not yet established. `react-native-svg` is not a dependency and is not authorized by P2 | the production vector / component port and device accessibility validation (P2 §14); a truthful speaking indicator waits on `QAN-BL-VOICE-01` |
| Notifications / proactive attention | I-08N-01 freezes the foundational semantics: the Product gate, attention budgets, interruption classes, privacy/disclosure contract, Direct Entry constraints and user controls. P3 (`CLOSED / FROZEN`) freezes the final Product realization by reference to the merged P3-A package: the Activity surface and entry, Open Ledger / Open Link, the attention mark and counts, the Attention Strip, the Analysis and Live Call attention laws, the Lock Screen labels, permission education, Notifications & Activity settings, Quiet Hours / Snooze defaults and the v1 frequency ceilings | none. No production notification runtime / transport, Push provider, Activity surface, attention mark or notification setting is established on `main`, and none is established by the P3 closure | the whole production implementation and the carry-forwards in P3 §18: Push provider, APNs / FCM, device tokens, workers, storage / pagination / retention, scoring / ranking, iOS categories and Android channels, the Product-class → OS-level mapping, native badges, platform permission wording, device validation; the `PROOF` / `OPEN` / `FIXTURE` copy P3 §17 leaves unfrozen for the P4 census |
| Plans / Credits / Usage Economy | CW2-08 freezes only the high-level law: entitlement restricts actions rather than ownership, and Credits are resource/compute availability only and never alter consent/ownership/truth | no complete plan/credit/billing Product system is established on `main` | roadmap places the Product economy work alongside the End-to-End audit, using provider/workload evidence; no formula or pricing is frozen |
| Sign-in / auth | T-12P, T-14; P1 §3 now sets the final Product requirement: one `Login ID OR Email` identifier plus Password, with generic failure wording | T-14 is implemented and Email-only | the Login ID route, sign-up and the rest of the account lifecycle; `QAN-BL-SEC-01`. T-14 recorded sign-up, password reset and onboarding, among others, as anti-scope (backlog §7) |

---

## 5. Open and deferred register

This section is derived only from [`docs/qandeel-canonical-backlog-v1.md`](docs/qandeel-canonical-backlog-v1.md)
§4. The counts were parsed mechanically, one index row per ID, and they equal the backlog's own §7. It is
a summary, not a second backlog. Read the backlog itself for sources, reopen conditions and full semantics.

| Status | Count |
|---|---:|
| `DEFERRED — OWNED` | 1 |
| `VALIDATION — OPEN` | 0 |
| `OPEN — UNASSIGNED` | 9 |
| `CLOSED — TOMBSTONE` | 12 |
| **Total** | **22** |

| Severity (all 22) | Count |
|---|---:|
| `HIGH` | 13 |
| `MEDIUM` | 8 |
| `LOW` | 1 |

The severity table counts all 22 rows, tombstones included. The 10 active (non-tombstone) items split
4 `HIGH`, 5 `MEDIUM` and 1 `LOW`. Here they are in the backlog's own index order:

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
| `QAN-BL-CW-01` | Owner Deletion Does Not Reach the Public DRAFT Source-Content Derivative (`ASSURE-F05`) | `UNASSIGNED` | `HIGH` | `OPEN — UNASSIGNED` |

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

> **Final Product Decision Closure**

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
4. **P4 — Remaining Product / Visual Gaps Census & Closure** — the current / next Product / visual closure track.

After P1–P4 close:

> **QANDEEL End-to-End Product Experience Completeness Audit**

That phase also carries the evidence-led QANDEEL Model / Provider benchmark and selection, Plans / Credits /
Usage Economy work, and the complete account/authentication lifecycle review. Production Integration follows the
audit and its resulting closures; Release Hardening / Launch comes after production integration.

**Important:** the roadmap schedules Product work; it does **not** itself open an implementation task. P1, P2 and P3
are closed as Product / design contracts and implement nothing. P4 is the immediate Product / visual closure track, and
no P4 Task Contract exists yet.

The canonical backlog remains separate: backlog entries are not self-executing, and severity does not order them.

**Owners that current records name for future work.** Each is a named owner and does not override the roadmap or
create an implementation task:

| Owner named by a record | What the record assigns to it | Source |
|---|---|---|
| Connected Worlds `I-08` | the mobile Matching UI, candidate cards or feed, the final visual proposal experience and navigation surfaces. It also owns the final Introduction screen and the Matching / Live-Call presentation | [`docs/matching-introduction-runtime-v1.md`](docs/matching-introduction-runtime-v1.md) §24; [G3 closure](docs/design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md) §D, §G |
| Connected Worlds `I-09` / `CW2-08` | report, block, moderation, the safety policy engine, entitlements, the production Launch Gate and feature rollout | [`docs/matching-introduction-runtime-v1.md`](docs/matching-introduction-runtime-v1.md) §24; backlog I-05, I-06, I-07 closure records |
| `QAN-SEC-01 — Pre-release Mobile Credential Security` | `QAN-BL-SEC-01`. Its reopen condition is "automatic before the first production-store release" | [backlog §5](docs/qandeel-canonical-backlog-v1.md) |

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
5. The current canonical record(s) for the task: the primary records cited in §3, and the
   [artifact index](docs/design/canonical-artifacts/QANDEEL_CANONICAL_ARTIFACT_INDEX.md) for Product / design work.
6. Historical / upstream authority in [`docs/canonical-authority/`](docs/canonical-authority/README.md), only
   when exact provenance or an audit needs it.

Coding agents also follow [`AGENTS.md`](AGENTS.md).
