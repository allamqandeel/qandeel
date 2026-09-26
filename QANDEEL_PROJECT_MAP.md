# QANDEEL — Project Map

**Status:** `REPOSITORY MAP / AUTHORITY LOCATOR — CREATES NO NEW PRODUCT AUTHORITY`

This file maps the repository. It is not an architecture specification. It says where each kind of
authority lives, how the kinds rank against one another, and which old documents mislead. For each
domain's current lifecycle and the open register, read [`QANDEEL_CURRENT_STATE.md`](QANDEEL_CURRENT_STATE.md)
first.

Every path here is repository-relative and resolves in a fresh clone of `main`.

---

## 1. Authority precedence

The rules below are the repository's own, each cited to where it is stated.

1. **Later explicit canonical amendments bind over earlier sources.** "Later amendments bind"
   ([`docs/canonical-authority/README.md`](docs/canonical-authority/README.md)). "Where a later canonical record in
   this repository amends it, the later record wins" ([`docs/design/canonical-artifacts/README.md`](docs/design/canonical-artifacts/README.md)
   rule 5). The artifact index's last section lists the amendments that currently bind.
2. **Recovered upstream authority does not override later records.** A historical checkpoint or a frozen
   upstream source never outranks:
   - a T-series amendment;
   - a closed Connected Worlds phase, I-04 … I-07 with their REM remediations;
   - an I-08B design closure;
   - the frozen I-08A Product Shell / IA / Naming foundation and I-08N-01 attention contract where those records own the Product rule;
   - the P1 User Identity / Preferences / QANDEEL Understanding Product closure, which narrowly amends named statements
     of I-08A4, F2 / G2 / G3 and the T-14 sign-in requirement (its §15);
   - the P2 Final Iconography System closure, which supplies the final icon geometry and narrowly supersedes G1.2 §6's
     proof-only icons and the G3.2 proof craft it names, while C3, E1R, F1R2 and the T-series temporal semantics stay
     unchanged (its §13).

   Source: [`docs/canonical-authority/README.md`](docs/canonical-authority/README.md), "What this directory is not".
3. **Current records do not erase upstream history.** Upstream sources stay preserved byte-exact as the
   original authority for their own stage. A later record narrows or implements them. It does not delete
   them ([`CANONICAL_AUTHORITY_INDEX.md`](docs/canonical-authority/CANONICAL_AUTHORITY_INDEX.md)).
4. **The backlog is governance, not Product authority.** "Nothing here defines runtime semantics, and no
   reader may implement from an entry" (BG-07, [`docs/qandeel-canonical-backlog-v1.md`](docs/qandeel-canonical-backlog-v1.md)).
   Severity is not priority (backlog §2).
5. **A preserved proof is not a decision.** The canonical-artifacts directory is a
   "PRESERVATION RECORD — NOT A DESIGN DECISION". G3 §A freezes three decisions and one disposition, and
   everything else in the G3 proofs "remains evidence". The assurance register's "remediation direction"
   is evidence, not a decision ([`docs/assurance/connected-worlds/README.md`](docs/assurance/connected-worlds/README.md)).
6. **A lifecycle comes from a closure record,** never from a proof board, a package's self-description, a
   file's existence or its position in a list (§5).
7. **Engineering implements canonical contracts and does not invent missing product logic**
   ([`AGENTS.md`](AGENTS.md) §2).

---

## 2. Top-level repository map

| Path | What it is |
|---|---|
| [`README.md`](README.md) | repository entry point and local development instructions |
| [`AGENTS.md`](AGENTS.md) | guardrails and the reading order for coding agents |
| [`QANDEEL_CURRENT_STATE.md`](QANDEEL_CURRENT_STATE.md) | current-state snapshot (locator) |
| [`QANDEEL_PRODUCT_ROADMAP.md`](QANDEEL_PRODUCT_ROADMAP.md) | Product Owner sequencing from Final Product Decision Closure through End-to-End audit, Production Integration and Release Hardening; opens no implementation task by itself |
| `QANDEEL_PROJECT_MAP.md` | this map (locator) |
| [`package.json`](package.json), [`package-lock.json`](package-lock.json), [`tsconfig.base.json`](tsconfig.base.json) | root npm workspace (`apps/*`, `packages/*`) with 201 scripts at this baseline, and one lockfile |
| [`.env.example`](.env.example) | names of local integration variables. The real `.env` is ignored |
| [`apps/api/`](apps/api/README.md) | NestJS backend. `src/` holds the conversation, intelligence, memory, hypothesis, question, human-model (HIM), thread / focus / live-focus, historical-projection, post-response, runtime-events and health modules, plus `connected-worlds/` (the server-side kernel and authority services) |
| [`apps/mobile/`](apps/mobile/README.md) | React Native + Expo client for the Living Analysis Map: `src/state`, `map`, `timeline`, `temporal-navigation`, `return-navigation`, `orientation-chrome`, `motion`, `responsive`, `integration`, `recovery`, `runtime-entry` and others |
| [`packages/runtime/`](packages/runtime/README.md) | `@qandeel/runtime`, the type-only wire contracts shared by API and mobile |
| [`database/`](database/README.md) | PostgreSQL / Supabase: `migrations/` (0001–0122), `tests/`, the `verify-migration-NNNN.mjs` verifiers and the focused-verification runner. Its README is also the canonical record of Connected Worlds `I-05` |
| [`tests/`](tests/) | root static contract gates (`*-contract.test.mjs`), including `task-closure-governance-contract.test.mjs` and `forward-safety-contract.test.mjs` |
| [`scripts/`](scripts/) | `preflight.mjs`, integration diagnostics, and the T-12 / T-13 Phase-M device-validation helpers |
| [`infra/`](infra/README.md) | placeholder for deployment configuration |
| [`.github/workflows/`](.github/workflows/) | `api-ci.yml`, `mobile-ci.yml`, `focused-database-verification.yml`, `mobile-expo-dependency-drift-advisory.yml`, `qan-inf-04-artifact-reuse-demonstration.yml`, `t12-phase-m-cloud-validation.yml`, `supabase-keep-alive.yml` |
| [`docs/`](docs/README.md) | implementation-facing specifications and records, and the docs index |
| [`docs/implementation-foundation/`](docs/implementation-foundation/README.md) | the Engineering Foundation set: Foundation Freeze, Tech Stack, Project Skeleton, Core Runtime, Model Router, Memory, Conversation Orchestrator, Safety and Behavioral Runtime |
| [`docs/canonical-authority/`](docs/canonical-authority/README.md) | recovered authority missing from GitHub: Experience Architecture Stages 0–6, Connected Worlds v2 CW2-00 … CW2-08, plus final I-08A Product Shell / IA / Naming and I-08N-01 Notification / Proactive Attention authority. Preservation, **not the entry point** |
| [`docs/design/`](docs/design/) | design-track records: `phase-v/`, `phase-vi/`, the I-08B3.1-G closures in `i-08b3.1-g1.1/`, `i-08b3.1-g1.2/`, `i-08b3.1-g2/`, `i-08b3.1-g2.3/` and `i-08b3.1-g3/`, and the P2-A iconography proof package in `p2-iconography/` (evidence for the P2 closure) |
| [`docs/design/canonical-artifacts/`](docs/design/canonical-artifacts/README.md) | byte-exact final Product / design artifacts: I-08B1, brand, typography, I-08B3.1 A–G proofs. Located by its index |
| [`docs/assurance/connected-worlds/`](docs/assurance/connected-worlds/README.md) | the `QAN-CW-ASSURE-01` findings register. **Evidence only** |

---

## 3. Where do I look for…?

| Looking for | Start at | Then |
|---|---|---|
| current project state | [`QANDEEL_CURRENT_STATE.md`](QANDEEL_CURRENT_STATE.md) | the primary record it cites |
| current forward roadmap / sequencing | [`QANDEEL_PRODUCT_ROADMAP.md`](QANDEEL_PRODUCT_ROADMAP.md) | use it for ordering only; a concrete task still needs its own Task Contract |
| open obligations | [`docs/qandeel-canonical-backlog-v1.md`](docs/qandeel-canonical-backlog-v1.md) §4–§5 | the item's own `Source` |
| historical Experience Architecture (Stages 0–6) | [`docs/canonical-authority/CANONICAL_AUTHORITY_INDEX.md`](docs/canonical-authority/CANONICAL_AUTHORITY_INDEX.md) | its "Superseded by / later amendments" column |
| current Product / design canon | [`docs/design/canonical-artifacts/QANDEEL_CANONICAL_ARTIFACT_INDEX.md`](docs/design/canonical-artifacts/QANDEEL_CANONICAL_ARTIFACT_INDEX.md) | its "Later amendments that override preserved sources" table |
| the Living Analysis world (visual) | [`docs/design/canonical-artifacts/living-analysis/README.md`](docs/design/canonical-artifacts/living-analysis/README.md) (I-08B1) | `QAN-BL-VIS-01` |
| the Living Analysis Map (runtime) | [`docs/living-analysis-map-runtime-v1.md`](docs/living-analysis-map-runtime-v1.md) (T-04), [`docs/final-living-analysis-map-integration-v1.md`](docs/final-living-analysis-map-integration-v1.md) (T-12) | [`apps/mobile/README.md`](apps/mobile/README.md), `apps/mobile/src/` |
| time, Timeline, Return, chrome | [`docs/timeline-presentation-window-v1.md`](docs/timeline-presentation-window-v1.md) (T-05), [`docs/temporal-navigation-layer-v1.md`](docs/temporal-navigation-layer-v1.md) (T-06), [`docs/return-navigation-layer-v1.md`](docs/return-navigation-layer-v1.md) (T-07), [`docs/inspection-orientation-return-chrome-v1.md`](docs/inspection-orientation-return-chrome-v1.md) (T-08) | the G2.3 and G3 amendments below |
| motion, responsive layout | [`docs/living-analysis-map-motion-system-v1.md`](docs/living-analysis-map-motion-system-v1.md) (T-10), [`docs/responsive-recomposition-v1.md`](docs/responsive-recomposition-v1.md) (T-11) | [`docs/visual-motion-authority-boundary-v1.md`](docs/visual-motion-authority-boundary-v1.md) (QAN-GOV-02) |
| Product shell / Global navigation / canonical naming / first use | [`I-08A4`](docs/canonical-authority/final-product-experience/i-08a/QANDEEL_I-08A4_CLOSURE_SYNTHESIS_CANONICAL_PRODUCT_SHELL_IA_NAMING_DECISION_RECORD.md) | later G1.1 / G1.2 Product naming and shell amendments bind where explicit, and so does P1 (below) |
| account identity, identifiers, sign-in / sign-up Product semantics, General Settings, Memory versus QANDEEL Understanding, appearance preference, exposure boundaries, Introduction image stages | [P1 closure](docs/qandeel-p1-user-identity-preferences-understanding-canonical-closure.md) | its §15 precedence matrix names every earlier statement it supersedes; its §16 lists only implementation/runtime carry-forwards, not open Product Owner decisions |
| iconography: signature glyphs, navigation glyphs, the Call Rail, the Temporal Spine + Aperture, utility-glyph sourcing, icon motion, icon RTL / accessibility | [P2 closure](docs/qandeel-p2-final-iconography-canonical-closure.md) | geometry by reference to the P2-A package ([`P2_READ_FIRST.md`](docs/design/p2-iconography/QANDEEL_P2-A_FINAL_ICONOGRAPHY_INTEGRATED_VISUAL_PROOF/P2_READ_FIRST.md), `docs/P2_ICON_GEOMETRY_SPEC.md`, `source/src/`); material stays C3's, state stays E1R's, temporal semantics stay T-05 … T-08's; its §13 precedence matrix |
| the Conversation / Analysis shell | [`docs/design/i-08b3.1-g1.1/QANDEEL_G1_1_CANONICAL_CLOSURE_AND_AMENDMENTS.md`](docs/design/i-08b3.1-g1.1/QANDEEL_G1_1_CANONICAL_CLOSURE_AND_AMENDMENTS.md), [`docs/design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md`](docs/design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md) | [`G2_F2_ANALYSIS_SHELL_CONTROLLED_AMENDMENT.md`](docs/design/i-08b3.1-g3/G2_F2_ANALYSIS_SHELL_CONTROLLED_AMENDMENT.md), [`T11_T12_TEMPORAL_ORIENTATION_CONTROLLED_AMENDMENT.md`](docs/design/i-08b3.1-g3/T11_T12_TEMPORAL_ORIENTATION_CONTROLLED_AMENDMENT.md), [`T11_RETURN_PRESENTATION_CONTROLLED_AMENDMENT.md`](docs/design/i-08b3.1-g2.3/T11_RETURN_PRESENTATION_CONTROLLED_AMENDMENT.md) |
| Matching / Introductions | runtime: [`docs/matching-introduction-runtime-v1.md`](docs/matching-introduction-runtime-v1.md) (I-07). Product: [`docs/design/i-08b3.1-g2.3/QANDEEL_G2_3_CANONICAL_CLOSURE.md`](docs/design/i-08b3.1-g2.3/QANDEEL_G2_3_CANONICAL_CLOSURE.md) and G3 §D | architecture: [CW2-06](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-06_INTRODUCTIONS_MATCHING_RUNTIME_ARCHITECTURE_v1.0_FROZEN.md); the artifact index's Matching table |
| Replay | runtime: [`docs/replay-runtime-v1.md`](docs/replay-runtime-v1.md) (I-06). Placement: G1.1 closure | architecture: [CW2-05](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-05_REPLAY_RUNTIME_ARCHITECTURE_v1.0_FROZEN.md); `QAN-BL-NAV-02`; the artifact index's Replay table |
| Connected Worlds (Shared, Public) | [`docs/shared-world-lifecycle-conversation-runtime-v1.md`](docs/shared-world-lifecycle-conversation-runtime-v1.md) (I-04), [`database/README.md`](database/README.md) (I-02, I-03, I-05 and the REM sections) | the CW2 architecture in [`docs/canonical-authority/connected-worlds-v2/`](docs/canonical-authority/connected-worlds-v2/architecture/); `apps/api/src/connected-worlds/` |
| Voice / Live Call | [`docs/design/i-08b3.1-g1.2/QANDEEL_G1_2_CANONICAL_CLOSURE.md`](docs/design/i-08b3.1-g1.2/QANDEEL_G1_2_CANONICAL_CLOSURE.md) (Product); the call controls' drawing is the [P2 closure](docs/qandeel-p2-final-iconography-canonical-closure.md)'s Call Rail A | `QAN-BL-VOICE-01` (no runtime exists) |
| notifications / proactive attention | [`I-08N-01`](docs/canonical-authority/final-product-experience/i-08n/QANDEEL_I-08N-01_FINAL_CLOSURE_PACKAGE.md) | Product contract frozen; no production notification runtime is established. G3 §D adds the Matching-during-Live-Call presentation rule |
| database and migrations | [`database/README.md`](database/README.md) | `database/migrations/`, `database/tests/`, [`docs/local-focused-database-verification-v1.md`](docs/local-focused-database-verification-v1.md) |
| mobile implementation | [`apps/mobile/README.md`](apps/mobile/README.md) | `apps/mobile/src/`; [`docs/mobile-runtime-entry-preconditions-v1.md`](docs/mobile-runtime-entry-preconditions-v1.md), [`docs/recovery-persistence-v1.md`](docs/recovery-persistence-v1.md), [`docs/mobile-product-sign-in-gateway-v1.md`](docs/mobile-product-sign-in-gateway-v1.md) |
| runtime behaviour (conversation, safety, behaviour) | [`docs/implementation-foundation/`](docs/implementation-foundation/README.md) | [`docs/foundation-freeze-v1.md`](docs/foundation-freeze-v1.md); the QIR records via [`docs/README.md`](docs/README.md) |
| security | [`docs/implementation-foundation/QANDEEL_SAFETY_RUNTIME_v1.0.md`](docs/implementation-foundation/QANDEEL_SAFETY_RUNTIME_v1.0.md), [`docs/t12-auth-storage-at-rest-disposition-v1.md`](docs/t12-auth-storage-at-rest-disposition-v1.md) | `QAN-BL-SEC-01`, `QAN-BL-CW-01`; [CW2-08](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-08_SAFETY_MODERATION_ENTITLEMENTS_LAUNCH_v1.0_FROZEN.md); [`docs/assurance/connected-worlds/README.md`](docs/assurance/connected-worlds/README.md) |
| CI | [`.github/workflows/`](.github/workflows/) | [`docs/native-ci-build-validation-decoupling-v1.md`](docs/native-ci-build-validation-decoupling-v1.md), [`docs/local-focused-database-verification-v1.md`](docs/local-focused-database-verification-v1.md) |
| local development | [`README.md`](README.md) "Local development" | [`.env.example`](.env.example), [`scripts/preflight.mjs`](scripts/preflight.mjs), [`database/README.md`](database/README.md), [`apps/mobile/README.md`](apps/mobile/README.md) |
| closure governance | [`AGENTS.md`](AGENTS.md) §10; backlog BG-08, BG-09 and §9 | `npm run test:task-closure-governance-contract` |

---

## 4. Lifecycle / closure map

There is one primary record per closed track. Reach anything finer through that record.

| Track | Primary closure record | Locator for the rest |
|---|---|---|
| Engineering Foundation v1 | [`docs/foundation-freeze-v1.md`](docs/foundation-freeze-v1.md) | [`docs/README.md`](docs/README.md) "Foundation closure" |
| Human Intelligence Activation | [`docs/human-intelligence-activation-freeze-v1.md`](docs/human-intelligence-activation-freeze-v1.md) | [`docs/README.md`](docs/README.md) |
| Integrated Intelligence Runtime (QIR) | [`docs/integrated-intelligence-runtime-phase-freeze-v1.md`](docs/integrated-intelligence-runtime-phase-freeze-v1.md) | [`docs/README.md`](docs/README.md) (QIR-001 … QIR-008) |
| Experience Architecture Stage 5 | [Stage 5 Final Freeze Record](docs/canonical-authority/experience-architecture/stage5/QANDEEL_STAGE5_FINAL_FREEZE_RECORD_v1.md) | [`CANONICAL_AUTHORITY_INDEX.md`](docs/canonical-authority/CANONICAL_AUTHORITY_INDEX.md) |
| Experience Architecture Stage 6 | [Stage 6 Final Freeze Record](docs/canonical-authority/experience-architecture/stage6/final-authority/freeze-records/QANDEEL_STAGE6_FINAL_FREEZE_RECORD_v1.md) | [`CANONICAL_AUTHORITY_INDEX.md`](docs/canonical-authority/CANONICAL_AUTHORITY_INDEX.md) |
| T-10, T-11, T-12, T-13, T-14 | their own documents (Current State §3.3); T-12 BG-08 tombstones in the backlog §6 | backlog §9 closure records |
| Connected Worlds I-04, I-05, I-06, I-07 | [I-04](docs/shared-world-lifecycle-conversation-runtime-v1.md), [I-05](database/README.md), [I-06](docs/replay-runtime-v1.md), [I-07](docs/matching-introduction-runtime-v1.md) | backlog `### I-0N closure record` sections |
| Connected Worlds v2 architecture | [architecture closure](docs/canonical-authority/connected-worlds-v2/closure/QANDEEL_CONNECTED_WORLDS_V2_ARCHITECTURE_CLOSURE_v1.0.md) | [`CANONICAL_AUTHORITY_INDEX.md`](docs/canonical-authority/CANONICAL_AUTHORITY_INDEX.md) |
| Phase V | [`docs/design/phase-v/README.md`](docs/design/phase-v/README.md) | its `ARCHIVE-MANIFEST.md` |
| VI-01, VI-02 | [VI-01](docs/design/phase-vi/vi-01-bilingual-product-language/README.md), [VI-02](docs/design/phase-vi/vi-02-analysis-navigation-density/README.md) | their `ARCHIVE-MANIFEST.md` |
| I-08A Product Shell / IA / Naming | [`I-08A4 closure synthesis`](docs/canonical-authority/final-product-experience/i-08a/QANDEEL_I-08A4_CLOSURE_SYNTHESIS_CANONICAL_PRODUCT_SHELL_IA_NAMING_DECISION_RECORD.md) | [`CANONICAL_AUTHORITY_INDEX.md`](docs/canonical-authority/CANONICAL_AUTHORITY_INDEX.md); later G1.1 / G1.2 amendments |
| P1 User Identity / Preferences / QANDEEL Understanding | [P1 canonical closure](docs/qandeel-p1-user-identity-preferences-understanding-canonical-closure.md) (`CLOSED / FROZEN`) | its §15 precedence matrix; [`QANDEEL_PRODUCT_ROADMAP.md`](QANDEEL_PRODUCT_ROADMAP.md) §2 |
| P2 Final Iconography System | [P2 canonical closure](docs/qandeel-p2-final-iconography-canonical-closure.md) (`CLOSED / FROZEN`) | its §13 precedence matrix; evidence [P2-A package](docs/design/p2-iconography/QANDEEL_P2-A_FINAL_ICONOGRAPHY_INTEGRATED_VISUAL_PROOF/P2_READ_FIRST.md); [`QANDEEL_PRODUCT_ROADMAP.md`](QANDEEL_PRODUCT_ROADMAP.md) §2 |
| I-08N-01 Notification / Proactive Attention | [`I-08N-01 final closure package`](docs/canonical-authority/final-product-experience/i-08n/QANDEEL_I-08N-01_FINAL_CLOSURE_PACKAGE.md) | [`CANONICAL_AUTHORITY_INDEX.md`](docs/canonical-authority/CANONICAL_AUTHORITY_INDEX.md); G3 §D for the compatible Matching-during-call rule |
| I-08B1 Living Analysis World | [`docs/design/canonical-artifacts/living-analysis/README.md`](docs/design/canonical-artifacts/living-analysis/README.md) | the artifact index |
| I-08B3.1-C Living Brass | [`C3_FINAL_CLOSURE_RECORD.md`](docs/design/canonical-artifacts/living-brass/i-08b3.1-c3/docs/C3_FINAL_CLOSURE_RECORD.md) | the artifact index |
| I-08B3.1 A, B, D, E, F; I-08B2.5 brand; I-08B3.0 typography | the artifact index row per domain, which states each lifecycle and its evidence | [`QANDEEL_CANONICAL_ARTIFACT_INDEX.md`](docs/design/canonical-artifacts/QANDEEL_CANONICAL_ARTIFACT_INDEX.md) |
| I-08B3.1-G (G1.1, G1.2, G2, G2.3, G3, parent G) | [`docs/design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md`](docs/design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md) §J | G3 §J names each stage's record |
| Governance (QAN-GOV-01 … 03) | [`docs/qandeel-canonical-backlog-v1.md`](docs/qandeel-canonical-backlog-v1.md) | [`docs/visual-motion-authority-boundary-v1.md`](docs/visual-motion-authority-boundary-v1.md) (GOV-02) |

Some tracks are implemented but have no final lifecycle record: T-01 … T-08, T-12P, and Connected Worlds
I-01 … I-03. [`QANDEEL_CURRENT_STATE.md`](QANDEEL_CURRENT_STATE.md) §3 describes each one. It does not call
any of them closed.

---

## 5. Current forward roadmap

The roadmap is intentionally not duplicated here. Read
[`QANDEEL_PRODUCT_ROADMAP.md`](QANDEEL_PRODUCT_ROADMAP.md).

Current sequence:

1. Final Product Decision Closure:
   - P1 User Profile / Identity / Preferences / QANDEEL Understanding — **CLOSED / FROZEN**
     ([P1 closure](docs/qandeel-p1-user-identity-preferences-understanding-canonical-closure.md)); production
     implementation open;
   - P2 Final Iconography System — **CLOSED / FROZEN**
     ([P2 closure](docs/qandeel-p2-final-iconography-canonical-closure.md)); production implementation open;
   - P3 Notification Final Realization — **CURRENT / NEXT** Product decision-closure track, not yet opened as a Task
     Contract;
   - P4 Remaining Product / Visual Gaps Census & Closure, after P3.
2. QANDEEL End-to-End Product Experience Completeness Audit, including evidence-led Model / Provider selection,
   Plans / Credits / Usage Economy and complete account/auth lifecycle review.
3. Production Integration & Implementation.
4. Release Hardening & Launch.

This sequencing creates no runtime semantics and opens no implementation task by itself.

---

## 6. Historical and superseded traps

Each of these has misled, or could mislead, a new reader or agent. The documents themselves are
historical and are not edited. Only the entry points that pointed at them were corrected.

| Trap | What it says | What is true now |
|---|---|---|
| [Core Checkpoint v2](docs/canonical-authority/experience-architecture/core-checkpoint/QANDEEL_CANONICAL_CORE_CHECKPOINT_v2.md) | `Status: CURRENT CANONICAL ENTRY POINT` | current **as of 2026-09-03** only. Historical / upstream. Its frozen North Star is still quoted by the Current State. The current entry point is `QANDEEL_CURRENT_STATE.md` |
| Navigation Checkpoint `START_HERE.md`, `NEXT_STAGE_HANDOFF.md`, `README_UPLOAD_TO_NEW_CHAT.md` | "NEXT: Stage 5"; "We are starting Stage 5" | Stage 5 and Stage 6 both closed on 2026-09-03, and implementation has run since |
| The Connected Worlds architecture closure | "Implementation: NOT STARTED", "next phase", and a §14 plan numbered I-00 … I-10 | implementation ran through I-01 … I-07 ([`CANONICAL_AUTHORITY_INDEX.md`](docs/canonical-authority/CANONICAL_AUTHORITY_INDEX.md)). The executed phase numbers differ from §14, so resolve an `I-0N` against the closed record that uses it |
| Older `CW-00` / `CW-01` / `CW-02` reports | "NOT FROZEN / NOT SELF-APPROVED" | not in the repository and not authority. CW2-00 §1 supersedes them |
| `docs/README.md` Phase VI section | "IN PROGRESS", "VI-02 visual morphology — OPEN / carried into VI-03", "Next task: VI-03" | now marked `HISTORICAL TRACK STATE — SUPERSEDED BY LATER CANONICAL WORK`. VI-03 is not the next task. The same "next task: VI-03" wording inside the frozen VI-02 archive is historical too |
| [T-12 §12](docs/final-living-analysis-map-integration-v1.md) | "No canonical visual freeze later than VI-02 exists at this baseline" | true at T-12's baseline. The I-08B design closures came later. The production Map paint is still the placeholder, though |
| [`apps/mobile/README.md`](apps/mobile/README.md) opening | "technical foundation only", "Do not implement product screens…" | written at T-01. The same file's later sections record T-02 … T-13 |
| [`apps/api/README.md`](apps/api/README.md) "Current scope" | the first conversation endpoints | later controllers exist under `apps/api/src/conversation/`. Treat that section as the first vertical slice, not the full API |
| [`docs/implementation-foundation/README.md`](docs/implementation-foundation/README.md) | "The original Word documents remain the canonical archive" | those Word files are not in the repository. The Experience Architecture and Connected Worlds upstream authority is now in `docs/canonical-authority/` |
| I-08A / I-08N-01 Product-track identifiers and `I-08B…` design-track identifiers | the same `I-08` prefix as the Connected Worlds phase numbering | these are Product/design tracks under the Final Product Experience program, not Connected Worlds phase identifiers. `I-08B3.1-G3` explicitly says it "is a design-track identifier, not Connected Worlds phase `I-08`" |
| G3 §D notification-context prose | says the repository had no canonical notification Product behavior to reference at that time | the recovered I-08N-01 final closure is the frozen Product attention contract. G3's no-runtime statement remains true; its Matching-during-call rule remains compatible and binding |
| Proof packages' own wording: G1.x, G2, G3 "READY FOR … REVIEW"; typography, A3R2, B4R, F self-status "candidate"; the G3 handoff "G3 NOT STARTED"; G2's "Q-LIGHT-SHELL remains open" | candidate or open | the closure records and the artifact index hold the lifecycle, and the package bytes are not edited (G3 §I) |
| Pre-closure banners with no closure record: T-04 (`awaiting independent Architecture review`), T-12P (`CANDIDATE`), QAN-INF-05 (`CANDIDATE`) | awaiting review | none is recorded as closed. `QAN-GOV-03` reported T-04 and T-12P to Architecture rather than correct them. They are not closed and not failed; their lifecycle is not established |
| T-03B2b3 / T-03B3 `PRODUCTION-INERT` banners | nothing wired | historical: T-03D performed the production cutover |
| Backlog §7 prose "seven `OPEN — UNASSIGNED` items" | 7 | its own correction paragraph fixes it. The mechanically counted register holds 22 items, 9 of them `OPEN — UNASSIGNED` |
| I-08A4 §8 / §9 `Readings` = «القراءات», `Reading` = «قراءة» | the user-facing name of the understanding surface | P1 §10 renames that surface **QANDEEL Understanding / «فهم قنديل»**. P1 explicitly preserves the distinct in-Analysis peer-reading vocabulary of VI-01, G1.1 §2 and the T-08 chrome |
| F2 "Default appearance follows the system" (`follow-system-no-in-app-override`); the G2 / F2 Analysis-shell amendment and G3 §C.1 "Non-Analysis surfaces keep following the system appearance" and "not a user appearance override or toggle" | no in-app appearance choice | P1 §12: non-Analysis surfaces follow a Dark / Light / System preference, default Dark. The Analysis stays one dark place under every value. No token or preserved byte changed |
| T-14 Email-only sign-in and its copy "Email or password is incorrect." | the Product sign-in | the implemented v1 gateway, still `CLOSED / FROZEN`. The final Product requirement is one `Login ID OR Email` identifier plus Password (P1 §3) |
| G1.2 §6 "The current icons and audio strip are **PROOF ONLY — NOT A VISUAL FREEZE**"; the roadmap's former "P2 — CURRENT / NEXT" | final iconography not frozen | P2 is `CLOSED / FROZEN`: the icon glyphs and the call controls are frozen by the P2 closure. G1.2's audio strip and the broader Voice visual language are **still** not frozen (P2 §13.1) |
| The P2-A package's own wording: "P2 NOT CLOSED / NOT FROZEN", "P2 remains not closed / not frozen until the later P2-B canonical closure task" | P2 open | superseded by the P2 closure; the package bytes are not edited. Its comparison variants (Call Rail B / C, Spine A / B, N2, the other utility libraries) are evidence only |
| Preserved proofs, boards, prototypes, assurance "remediation direction" | look like decisions | they are evidence. Only a closure record decides (§1, rule 5) |

---

## 7. No local-machine paths as authority

Orientation must work from any fresh clone. None of the following is a required source:

- laptop recovery folders or legacy backup paths;
- the Downloads folder;
- earlier Claude or ChatGPT sessions;
- external worktrees.

Some preserved provenance records name an archive's local path, size and SHA-256, for example the artifact
index and each `SOURCE-PROVENANCE.md`. Those are the identity of an archive that lives outside Git. They are
not places to read authority from. If a task seems to need a file that is not in the repository, report
the gap. Do not reconstruct the file.
