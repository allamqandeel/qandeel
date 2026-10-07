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
     unchanged (its §13);
   - the P3 Notification & Activity Final Product Realization closure, which consumes I-08N-01 and closes only the
     Product realization I-08N-01 §21 left open. It supersedes no I-08N-01 semantics and keeps G3 §D's Matching rule
     (its §19);
   - the P4 closure and its controlled amendments (P4-C1, P4-C2, the P4-C3R approvals, P4-C4) with APP-OPS-01, each
     binding only in its named scope, and the CW2-08A controlled amendment in its named scope.

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
| [`package.json`](package.json), [`package-lock.json`](package-lock.json), [`tsconfig.base.json`](tsconfig.base.json) | root npm workspace (`apps/*`, `packages/*`) with 236 scripts at `7221a635` (PR #303), and one lockfile |
| [`.env.example`](.env.example) | names of local integration variables. The real `.env` is ignored |
| [`apps/api/`](apps/api/README.md) | NestJS backend. `src/` holds the conversation, intelligence, memory, hypothesis, question, human-model (HIM), thread / focus / live-focus, historical-projection, post-response, runtime-events and health modules, plus `connected-worlds/` (the server-side kernel and authority services) |
| [`apps/mobile/`](apps/mobile/README.md) | React Native + Expo client for the Living Analysis Map: `src/state`, `map`, `timeline`, `temporal-navigation`, `return-navigation`, `orientation-chrome`, `motion`, `responsive`, `integration`, `recovery`, `runtime-entry` and others |
| [`packages/runtime/`](packages/runtime/README.md) | `@qandeel/runtime`, the type-only wire contracts shared by API and mobile |
| [`database/`](database/README.md) | PostgreSQL / Supabase: `migrations/` (0001–0135 at PR #303), `tests/`, the `verify-migration-NNNN.mjs` verifiers and the focused-verification runner. Its README is also the canonical record of Connected Worlds `I-05` |
| [`tests/`](tests/) | root static contract gates (`*-contract.test.mjs`), including `task-closure-governance-contract.test.mjs` and `forward-safety-contract.test.mjs` |
| [`scripts/`](scripts/) | `preflight.mjs`, integration diagnostics, and the T-12 / T-13 Phase-M device-validation helpers |
| [`infra/`](infra/README.md) | placeholder for deployment configuration |
| [`.github/workflows/`](.github/workflows/) | `api-ci.yml`, `mobile-ci.yml`, `focused-database-verification.yml`, `mobile-expo-dependency-drift-advisory.yml`, `qan-inf-04-artifact-reuse-demonstration.yml`, `t12-phase-m-cloud-validation.yml`, `supabase-keep-alive.yml` |
| [`docs/`](docs/README.md) | implementation-facing specifications and records, and the docs index |
| [`docs/implementation-foundation/`](docs/implementation-foundation/README.md) | the Engineering Foundation set: Foundation Freeze, Tech Stack, Project Skeleton, Core Runtime, Model Router, Memory, Conversation Orchestrator, Safety and Behavioral Runtime |
| [`docs/canonical-authority/`](docs/canonical-authority/README.md) | recovered authority missing from GitHub: Experience Architecture Stages 0–6, Connected Worlds v2 CW2-00 … CW2-08, plus final I-08A Product Shell / IA / Naming and I-08N-01 Notification / Proactive Attention authority. Preservation, **not the entry point** |
| [`docs/design/`](docs/design/) | design-track records: `phase-v/`, `phase-vi/`, the I-08B3.1-G closures in `i-08b3.1-g1.1/`, `i-08b3.1-g1.2/`, `i-08b3.1-g2/`, `i-08b3.1-g2.3/` and `i-08b3.1-g3/`, the P2-A iconography proof package in `p2-iconography/` (evidence for the P2 closure), the P3-A notification & Activity proof package in `p3-notifications/` (evidence for the P3 closure), and the P4-C comparative proof in `p4-shell/` and the P4-C3 residual visual + copy proof in `p4-residual/` (evidence for the P4 closure) |
| [`docs/p4/`](docs/p4/P4_READ_FIRST.md) | P4's local evidence and reconciliation package, **final**: the 66-row residual census, the **closed** `APP-OPS-01` App ↔ Company Operations contract (`CLOSED / FROZEN`; the file keeps its `_CANDIDATE` path), the final carry-forward matrix, the resolved decision queue and the final authority compatibility matrix. P4's primary closure record is [`QANDEEL_P4_FINAL_CLOSURE_v1.0.md`](docs/canonical-authority/final-product-experience/p4/QANDEEL_P4_FINAL_CLOSURE_v1.0.md); read it first |
| [`docs/design/canonical-artifacts/`](docs/design/canonical-artifacts/README.md) | byte-exact final Product / design artifacts: I-08B1, brand, typography, I-08B3.1 A–G proofs. Located by its index |
| [`docs/e2e/`](docs/e2e/E2E01_READ_FIRST.md) | End-to-End Product Experience Completeness Audit evidence: the E2E-01 journey / surface census, its gap matrix and its proposed closure waves. **Audit evidence, not Product authority**; start at `E2E01_READ_FIRST.md`. Also holds the W1A-01 implementation record ([`QANDEEL_W1A01_IMPLEMENTATION_RECORD_v1.md`](docs/e2e/QANDEEL_W1A01_IMPLEMENTATION_RECORD_v1.md)) the W1B-01 implementation record ([`QANDEEL_W1B01_IMPLEMENTATION_RECORD_v1.md`](docs/e2e/QANDEEL_W1B01_IMPLEMENTATION_RECORD_v1.md)), the W2-01 implementation record ([`QANDEEL_W2_01_IMPLEMENTATION_RECORD_v1.md`](docs/e2e/QANDEEL_W2_01_IMPLEMENTATION_RECORD_v1.md)), the W2-02 implementation record ([`QANDEEL_W2_02_PRODUCTION_LAUNCH_IDENTITY_IMPLEMENTATION_RECORD_v1.md`](docs/e2e/QANDEEL_W2_02_PRODUCTION_LAUNCH_IDENTITY_IMPLEMENTATION_RECORD_v1.md)), the W3-01 implementation record ([`QANDEEL_W3_01_GENERAL_SETTINGS_APPEARANCE_SIGNOUT_IMPLEMENTATION_RECORD_v1.md`](docs/e2e/QANDEEL_W3_01_GENERAL_SETTINGS_APPEARANCE_SIGNOUT_IMPLEMENTATION_RECORD_v1.md)) the W3-02 implementation record ([`QANDEEL_W3_02_ACCOUNT_IDENTITY_PUBLIC_ID_IMPLEMENTATION_RECORD_v1.md`](docs/e2e/QANDEEL_W3_02_ACCOUNT_IDENTITY_PUBLIC_ID_IMPLEMENTATION_RECORD_v1.md)) and the W3-MEGA-U implementation record ([`QANDEEL_W3_MEGA_U_UNDERSTANDING_CONTESTED_IMPLEMENTATION_RECORD_v1.md`](docs/e2e/QANDEEL_W3_MEGA_U_UNDERSTANDING_CONTESTED_IMPLEMENTATION_RECORD_v1.md)), each of which carries its Product Owner-approved copy and interaction contract verbatim. The later merged records are listed in [`QANDEEL_CURRENT_STATE.md`](QANDEEL_CURRENT_STATE.md) §3.7 and §7: W3-MEGA-M, W3-MEGA-A, W3-MEGA-S, VPORT-01, PROD-SEC-02, PROD-OPS-01, PROD-SEC-01, W3-CORR-U and AI-COST-01. So is the ROADMAP-REC-01 reconciliation record ([`QANDEEL_ROADMAP_REC_01_CANONICAL_EXECUTION_MAP_RECONCILIATION_v1.md`](docs/e2e/QANDEEL_ROADMAP_REC_01_CANONICAL_EXECUTION_MAP_RECONCILIATION_v1.md)) |
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
| Product shell / Global navigation / canonical naming / first use | [`I-08A4`](docs/canonical-authority/final-product-experience/i-08a/QANDEEL_I-08A4_CLOSURE_SYNTHESIS_CANONICAL_PRODUCT_SHELL_IA_NAMING_DECISION_RECORD.md) | later G1.1 / G1.2 Product naming and shell amendments bind where explicit, and so does P1 (below); the P3 closure adds the separate non-Analysis Activity entry (below); the [W1B-01 controlled amendment](docs/canonical-authority/final-product-experience/w1b/QANDEEL_W1B01_FIRST_USE_WELCOME_FIRST_CONVERSATION_OPENING_CONTROLLED_AMENDMENT_v1.0.md) supersedes the COPY of §14 (first-use Welcome) and §15 (First Conversation Opening) only |
| account identity, identifiers, sign-in / sign-up Product semantics, General Settings, Memory versus QANDEEL Understanding, appearance preference, exposure boundaries, Introduction image stages | [P1 closure](docs/qandeel-p1-user-identity-preferences-understanding-canonical-closure.md) | its §15 precedence matrix names every earlier statement it supersedes; its §16 lists only implementation/runtime carry-forwards, not open Product Owner decisions. Change Email, Security & Login v1, the Shared ID format, app language, accessibility preferences, Export and Delete Account are decided by the later [W3-PDG-01 closure](docs/canonical-authority/final-product-experience/w3/QANDEEL_W3_PDG01_ACCOUNT_SECURITY_PRIVACY_PRODUCT_DECISION_CLOSURE_v1.0.md), which is Product authority only, implements nothing, and blocks account deletion across Connected Worlds (`QAN-BL-ACCT-01`) |
| iconography: signature glyphs, navigation glyphs, the Call Rail, the Temporal Spine + Aperture, utility-glyph sourcing, icon motion, icon RTL / accessibility | [P2 closure](docs/qandeel-p2-final-iconography-canonical-closure.md) | geometry by reference to the P2-A package ([`P2_READ_FIRST.md`](docs/design/p2-iconography/QANDEEL_P2-A_FINAL_ICONOGRAPHY_INTEGRATED_VISUAL_PROOF/P2_READ_FIRST.md), `docs/P2_ICON_GEOMETRY_SPEC.md`, `source/src/`); material stays C3's, state stays E1R's, temporal semantics stay T-05 … T-08's; its §13 precedence matrix |
| the Conversation / Analysis shell | [`docs/design/i-08b3.1-g1.1/QANDEEL_G1_1_CANONICAL_CLOSURE_AND_AMENDMENTS.md`](docs/design/i-08b3.1-g1.1/QANDEEL_G1_1_CANONICAL_CLOSURE_AND_AMENDMENTS.md), [`docs/design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md`](docs/design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md) | [`G2_F2_ANALYSIS_SHELL_CONTROLLED_AMENDMENT.md`](docs/design/i-08b3.1-g3/G2_F2_ANALYSIS_SHELL_CONTROLLED_AMENDMENT.md), [`T11_T12_TEMPORAL_ORIENTATION_CONTROLLED_AMENDMENT.md`](docs/design/i-08b3.1-g3/T11_T12_TEMPORAL_ORIENTATION_CONTROLLED_AMENDMENT.md), [`T11_RETURN_PRESENTATION_CONTROLLED_AMENDMENT.md`](docs/design/i-08b3.1-g2.3/T11_RETURN_PRESENTATION_CONTROLLED_AMENDMENT.md) |
| Matching / Introductions | runtime: [`docs/matching-introduction-runtime-v1.md`](docs/matching-introduction-runtime-v1.md) (I-07). Product: [`docs/design/i-08b3.1-g2.3/QANDEEL_G2_3_CANONICAL_CLOSURE.md`](docs/design/i-08b3.1-g2.3/QANDEEL_G2_3_CANONICAL_CLOSURE.md) and G3 §D | architecture: [CW2-06](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-06_INTRODUCTIONS_MATCHING_RUNTIME_ARCHITECTURE_v1.0_FROZEN.md); the artifact index's Matching table |
| Replay | runtime: [`docs/replay-runtime-v1.md`](docs/replay-runtime-v1.md) (I-06). Placement: G1.1 closure | architecture: [CW2-05](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-05_REPLAY_RUNTIME_ARCHITECTURE_v1.0_FROZEN.md); `QAN-BL-NAV-02`; the artifact index's Replay table |
| Connected Worlds (Shared, Public) | [`docs/shared-world-lifecycle-conversation-runtime-v1.md`](docs/shared-world-lifecycle-conversation-runtime-v1.md) (I-04), [`database/README.md`](database/README.md) (I-02, I-03, I-05 and the REM sections) | the CW2 architecture in [`docs/canonical-authority/connected-worlds-v2/`](docs/canonical-authority/connected-worlds-v2/architecture/); `apps/api/src/connected-worlds/`. Shared Product integration: the [S4-01 record](docs/e2e/QANDEEL_S4_01_SHARED_WORLD_REACHABILITY_INVITATION_BIRTH_IMPLEMENTATION_RECORD_v1.md) (merged, PR #310; migration `0138`, `apps/api/src/shared-world/`, `apps/mobile/src/shared-world/`) the [S4-02 record](docs/e2e/QANDEEL_S4_02_SHARED_CONVERSATION_MATERIAL_IMPLEMENTATION_RECORD_v1.md) (merged, PR #311; migration `0139`, the reply composition in `apps/api/src/connected-worlds/material-commit/`) and the [S4-03 record](docs/e2e/QANDEEL_S4_03_SHARED_LIFECYCLE_GOVERNANCE_IMPLEMENTATION_RECORD_v1.md) (open PR; migration `0140`, `apps/api/src/shared-world/shared-world-lifecycle.*`, Manage World / the ended World in `apps/mobile/src/shared-world/`, the former-member own-material page in `apps/mobile/src/settings/`) |
| Voice / Live Call | [`docs/design/i-08b3.1-g1.2/QANDEEL_G1_2_CANONICAL_CLOSURE.md`](docs/design/i-08b3.1-g1.2/QANDEEL_G1_2_CANONICAL_CLOSURE.md) (Product); the call controls' drawing is the [P2 closure](docs/qandeel-p2-final-iconography-canonical-closure.md)'s Call Rail A; the non-signal Voice visual language is the [P4 closure](docs/canonical-authority/final-product-experience/p4/QANDEEL_P4_FINAL_CLOSURE_v1.0.md) §6 | `QAN-BL-VOICE-01` (no runtime exists; signal-bearing morphology and Voice / call strings wait on it) |
| notifications / proactive attention, Activity, badges, the Attention Strip, Lock Screen labels, notification settings, Quiet Hours, frequency ceilings | [`I-08N-01`](docs/canonical-authority/final-product-experience/i-08n/QANDEEL_I-08N-01_FINAL_CLOSURE_PACKAGE.md) — the foundational semantics (truth, authority, privacy, interruption classes, Direct Entry, disclosure, speaker identity); then the [P3 closure](docs/qandeel-p3-notification-activity-final-realization-canonical-closure.md) — the final Product realization | evidence: the [P3-A package](docs/design/p3-notifications/QANDEEL_P3-A_NOTIFICATION_ACTIVITY_INTEGRATED_VISUAL_PROOF/P3_READ_FIRST.md), by reference; the P3 §19 precedence matrix. G3 §D's Matching-during-Live-Call rule stays binding. Implementation: the [A3-01 record](docs/e2e/QANDEEL_A3_01_ACTIVITY_ATTENTION_INAPP_PRODUCTION_IMPLEMENTATION_RECORD_v1.md) (merged, PR #307; `apps/api/src/activity/`, `apps/mobile/src/activity/`, migration `0136`); platform delivery: the [A3-02 record](docs/e2e/QANDEEL_A3_02_NATIVE_PUSH_PLATFORM_DELIVERY_IMPLEMENTATION_RECORD_v1.md) (merged, PR #308; `apps/api/src/push/`, `apps/mobile/src/push/`, migration `0137`) |
| database and migrations | [`database/README.md`](database/README.md) | `database/migrations/`, `database/tests/`, [`docs/local-focused-database-verification-v1.md`](docs/local-focused-database-verification-v1.md) |
| mobile implementation | [`apps/mobile/README.md`](apps/mobile/README.md) | `apps/mobile/src/`; [`docs/mobile-runtime-entry-preconditions-v1.md`](docs/mobile-runtime-entry-preconditions-v1.md), [`docs/recovery-persistence-v1.md`](docs/recovery-persistence-v1.md), [`docs/mobile-product-sign-in-gateway-v1.md`](docs/mobile-product-sign-in-gateway-v1.md) |
| runtime behaviour (conversation, safety, behaviour) | [`docs/implementation-foundation/`](docs/implementation-foundation/README.md) | [`docs/foundation-freeze-v1.md`](docs/foundation-freeze-v1.md); the QIR records via [`docs/README.md`](docs/README.md) |
| security | [`docs/implementation-foundation/QANDEEL_SAFETY_RUNTIME_v1.0.md`](docs/implementation-foundation/QANDEEL_SAFETY_RUNTIME_v1.0.md), [`docs/t12-auth-storage-at-rest-disposition-v1.md`](docs/t12-auth-storage-at-rest-disposition-v1.md) | `QAN-BL-SEC-01`, `QAN-BL-CW-01`; [CW2-08](docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_CW2-08_SAFETY_MODERATION_ENTITLEMENTS_LAUNCH_v1.0_FROZEN.md); [`docs/assurance/connected-worlds/README.md`](docs/assurance/connected-worlds/README.md) |
| CI | [`.github/workflows/`](.github/workflows/) | [`docs/native-ci-build-validation-decoupling-v1.md`](docs/native-ci-build-validation-decoupling-v1.md), [`docs/local-focused-database-verification-v1.md`](docs/local-focused-database-verification-v1.md) |
| local development | [`README.md`](README.md) "Local development" | [`.env.example`](.env.example), [`scripts/preflight.mjs`](scripts/preflight.mjs), [`database/README.md`](database/README.md), [`apps/mobile/README.md`](apps/mobile/README.md) |
| closure governance | [`AGENTS.md`](AGENTS.md) §10; backlog BG-08, BG-09 and §9 | `npm run test:task-closure-governance-contract` |
| P4 residual decisions: shell / small chrome, brand ratification, static launch / gateway, the lantern boundary, non-signal Voice visuals, residual copy | [P4 final closure](docs/canonical-authority/final-product-experience/p4/QANDEEL_P4_FINAL_CLOSURE_v1.0.md) | then, in order: the [P4 census](docs/p4/P4_RESIDUAL_GAP_CENSUS.md) and [carry-forward matrix](docs/p4/P4_CARRY_FORWARD_MATRIX.md); the P4-C1 / P4-C2 / P4-C3R / P4-C4 records in [`docs/canonical-authority/final-product-experience/p4/`](docs/canonical-authority/final-product-experience/p4/); evidence [P4-C3](docs/design/p4-residual/QANDEEL_P4-C3_RESIDUAL_VISUAL_COPY_PROOF/P4C3_READ_FIRST.md) |
| App ↔ Company Operations: operational telemetry, the private-content boundary, Company → App controls | the closed [APP-OPS-01](docs/p4/APP_OPS_01_COMPANY_OPERATIONS_CONTRACT_CANDIDATE.md) | the [P4 compatibility matrix](docs/p4/P4_AUTHORITY_COMPATIBILITY_MATRIX.md); CW2-08 / CW2-08A; the telemetry, outbox and health records |
| what a user can actually do today, per user moment; the End-to-End gap matrix | [`docs/e2e/E2E01_READ_FIRST.md`](docs/e2e/E2E01_READ_FIRST.md) | the census, gap matrix and proposed closure waves it links. Evidence only: each row cites the record that decides it |

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
| P3 Notification & Activity Final Product Realization | [P3 canonical closure](docs/qandeel-p3-notification-activity-final-realization-canonical-closure.md) (`CLOSED / FROZEN`) | its §19 precedence matrix; evidence [P3-A package](docs/design/p3-notifications/QANDEEL_P3-A_NOTIFICATION_ACTIVITY_INTEGRATED_VISUAL_PROOF/P3_READ_FIRST.md); [`QANDEEL_PRODUCT_ROADMAP.md`](QANDEEL_PRODUCT_ROADMAP.md) §2 |
| P4 Remaining Product / Visual Gaps Census & Closure, with APP-OPS-01 | [P4 final closure](docs/canonical-authority/final-product-experience/p4/QANDEEL_P4_FINAL_CLOSURE_v1.0.md) (`CLOSED / FROZEN`, merged through PR #280 at `d6d0999dea26ba97b595e8a97e1a630eb659874f`) | 1. that record; 2. the final local evidence and census, [`docs/p4/`](docs/p4/P4_READ_FIRST.md); 3. the closed [APP-OPS-01](docs/p4/APP_OPS_01_COMPANY_OPERATIONS_CONTRACT_CANDIDATE.md); 4. the [carry-forward matrix](docs/p4/P4_CARRY_FORWARD_MATRIX.md); backlog `### P4 — design-track BG-08 reconciliation` |
| I-08N-01 Notification / Proactive Attention | [`I-08N-01 final closure package`](docs/canonical-authority/final-product-experience/i-08n/QANDEEL_I-08N-01_FINAL_CLOSURE_PACKAGE.md) | [`CANONICAL_AUTHORITY_INDEX.md`](docs/canonical-authority/CANONICAL_AUTHORITY_INDEX.md); G3 §D for the compatible Matching-during-call rule; the P3 closure for the final Product realization |
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

### Execution reconciliation checkpoint — 2026-10-04 (ROADMAP-REC-01, through PR #305)

This is a **locator note, not a new Product authority**. It records GitHub truth on
`main = 7221a635a6a7fe7564fb3f1e2e19c1ca189164c4`, the merge of PR #303. The evidence is in
[`docs/e2e/QANDEEL_ROADMAP_REC_01_CANONICAL_EXECUTION_MAP_RECONCILIATION_v1.md`](docs/e2e/QANDEEL_ROADMAP_REC_01_CANONICAL_EXECUTION_MAP_RECONCILIATION_v1.md).

- Merged after W3-MEGA-U (#291). The earlier slices merged since the checkpoint below are listed in §5 item 3:
  - W3-MEGA-M (#293);
  - W3-PDG-01 (#294, Product decisions);
  - W3-MEGA-A (#295);
  - W3-MEGA-S (#296);
  - VPORT-01 (#297);
  - PROD-SEC-02 (#299);
  - PROD-OPS-01 (#300);
  - PROD-SEC-01 (#301);
  - W3-CORR-U (#302);
  - AI-COST-01 (#303).
- PR #298 (`PROD-READINESS-01`) is **CLOSED UNMERGED — evidence / review only**.
- **NEXT IMPLEMENTATION TASK: VPORT-02 — Timeline + Orientation Chrome + P2 Final Coherence** (§5.1). It still opens
  only through its own Task Contract.
- `W3-CORR-M` is **not a canonical task and is not opened**. Memory control is the merged W3-MEGA-M (#293).

### Post-P4 merge checkpoint — 2026-09-27

This is a **handoff / locator note, not a new Product authority**. *(Historical: superseded for current sequencing by
the 2026-10-04 checkpoint above.)*

- PR #280 is **MERGED / CLOSED**. Exact independently reviewed head:
  `b9f73c3b84bee49769858b1465a1c2e118b11f5f`; merge commit and canonical `main`:
  `d6d0999dea26ba97b595e8a97e1a630eb659874f`.
- The exact-head validation passed in a disposable LF-clean checkout after `npm ci`:
  `test:forward-safety-contract` **35/35 PASS** and
  `test:task-closure-governance-contract` **24/24 PASS**. No validation commit or repository change was made.
- **P1, P2, P3 and P4 are all CLOSED / FROZEN.** Product/design closure does not mean production implementation is complete.
- **APP-OPS-01 is CLOSED / FROZEN** as the App ↔ Company Operations Product / Architecture boundary; implementation remains future Production Integration work.
- The exceptional lantern gateway identity moment remains **in v1** but its design / motion / interaction / technology work is deferred to the standalone
  **QANDEEL — Lantern Gateway Identity Moment v1** task, registered as `QAN-BL-LANTERN-01`.
- The final high-fidelity mobile Product surfaces for **Public World** are **not complete**. Public World product/runtime authority exists, while its final user-facing surfaces remain owned by the End-to-End completeness audit / later Product realization. The same audit owns the undrawn Shared / Public / Introductions journey surfaces identified by P4.
- The next roadmap phase is **QANDEEL End-to-End Product Experience Completeness Audit**. At this checkpoint it had not
  started; it has since **started through E2E-01 and is ACTIVE** (item 2 of the sequence below).
- **Working planning discussion — NOT FROZEN / NOT A ROADMAP CHANGE:** before opening the full End-to-End audit, the Product Owner and Project Lead discussed using a short real-LLM/runtime calibration and cost/evaluation instrumentation step so the audit exercises real AI behavior. Final Model / Provider selection and Plans / Credits should use measured QANDEEL workload economics rather than guesses. The exact sequencing must be decided explicitly before the next Task Contract; the existing roadmap remains authoritative until then.

The roadmap is intentionally not duplicated here. Read
[`QANDEEL_PRODUCT_ROADMAP.md`](QANDEEL_PRODUCT_ROADMAP.md).

Current sequence:

1. Final Product Decision Closure:
   - P1 User Profile / Identity / Preferences / QANDEEL Understanding — **CLOSED / FROZEN**
     ([P1 closure](docs/qandeel-p1-user-identity-preferences-understanding-canonical-closure.md)); production
     implementation open;
   - P2 Final Iconography System — **CLOSED / FROZEN**
     ([P2 closure](docs/qandeel-p2-final-iconography-canonical-closure.md)); production implementation open;
   - P3 Notification Final Realization — **CLOSED / FROZEN**
     ([P3 closure](docs/qandeel-p3-notification-activity-final-realization-canonical-closure.md)); production
     implementation open;
   - P4 Remaining Product / Visual Gaps Census & Closure — **CLOSED / FROZEN**, merged through PR #280 at `d6d0999dea26ba97b595e8a97e1a630eb659874f`
     ([P4 closure](docs/canonical-authority/final-product-experience/p4/QANDEEL_P4_FINAL_CLOSURE_v1.0.md)), with
     APP-OPS-01 closed beside it; production implementation open.
2. QANDEEL End-to-End Product Experience Completeness Audit — **started through E2E-01; not closed**
   ([`docs/e2e/`](docs/e2e/E2E01_READ_FIRST.md)) — including evidence-led
   Model / Provider selection, Plans / Credits / Usage Economy, complete account/auth lifecycle review, and APP-OPS-01's
   `Operational Events Required` / `Company Controls Required` fields.
3. Production Integration & Implementation — **started through bounded, Product-Owner-authorized slices only**:
   W1A-01 Authenticated Personal Conversation Core (merged through PR #283 at `7c9ee5e5bcb5f567dc7ef1944bcde92e8cdf99de`;
   [record](docs/e2e/QANDEEL_W1A01_IMPLEMENTATION_RECORD_v1.md)), then W1B-01 Account Identity + Verified Sign-up + First Use
   (merged through PR #284 at `6b333df7774d33b034575243b3592d21f2603683`; [record](docs/e2e/QANDEEL_W1B01_IMPLEMENTATION_RECORD_v1.md)),
   then W2-01 Final Account Access Lifecycle (merged through PR #285 at `df194edf6d70a2a300a0251ed114e7ad8715485e`;
   [record](docs/e2e/QANDEEL_W2_01_IMPLEMENTATION_RECORD_v1.md)), then W2-02 Production Launch Identity (merged through PR #286 at `b650b56f7436ce63d33c0af34036a963a03f5eee`;
   [record](docs/e2e/QANDEEL_W2_02_PRODUCTION_LAUNCH_IDENTITY_IMPLEMENTATION_RECORD_v1.md)), then W3-01 General Settings
   Foundation + Appearance + Sign Out (MERGED / CLOSED through PR #287 at `023cb9874376ac69db5848db099d06034d5deb54`;
   [record](docs/e2e/QANDEEL_W3_01_GENERAL_SETTINGS_APPEARANCE_SIGNOUT_IMPLEMENTATION_RECORD_v1.md)). then W3-02 Account &
   Identity Foundation + Public ID v1 (MERGED / CLOSED through PR #288 at `92444c3ab8c35f7d819888be76aa6395c93d94b8`;
   [record](docs/e2e/QANDEEL_W3_02_ACCOUNT_IDENTITY_PUBLIC_ID_IMPLEMENTATION_RECORD_v1.md)). **W2 is CLOSED.** W3-MEGA-U (QANDEEL Understanding + Contested) is MERGED / CLOSED through
   PR #291 at `226b61710b36c1ecba27b816a460fe16c040639a`
   ([record](docs/e2e/QANDEEL_W3_MEGA_U_UNDERSTANDING_CONTESTED_IMPLEMENTATION_RECORD_v1.md)); `E2E-D-14`,
   `E2E-D-15` and `PG-01` are closed. W3-MEGA-M (conversational Memory control) is MERGED / CLOSED through PR #293 at
   `3c0ea458a22a17a2a50c616b708f097f5911fb34`
   ([record](docs/e2e/QANDEEL_W3_MEGA_M_CONVERSATIONAL_MEMORY_CONTROL_IMPLEMENTATION_RECORD_v1.md)); `E2E-D-13` is closed.
   The W3 decision queue (`D-04`, `D-06`, `D-08`, `D-11`, `D-12`, `D-16`, `D-17`) is decided by the
   [W3-PDG-01 Product Decision Closure](docs/canonical-authority/final-product-experience/w3/QANDEEL_W3_PDG01_ACCOUNT_SECURITY_PRIVACY_PRODUCT_DECISION_CLOSURE_v1.0.md)
   (`CLOSED / FROZEN — PRODUCT DECISIONS`, documentation only). `D-17` is decided for its journey and principles only,
   under the `EXPLICIT CONNECTED-WORLDS DELETION BLOCKER` (`QAN-BL-ACCT-01`). The merged tasks that implemented it:
   - W3-MEGA-A, merged through PR #295 at `1e7b681052c7af09576197bcfb204e1b39775554`
     ([record](docs/e2e/QANDEEL_W3_MEGA_A_ACCOUNT_IDENTITY_SECURITY_IMPLEMENTATION_RECORD_v1.md));
   - W3-MEGA-S, merged through PR #296 at `e87aac6b4e9ec6c1b6542d2ba3c82cc6cc9af6e8`
     ([record](docs/e2e/QANDEEL_W3_MEGA_S_PERSONAL_CONTROLS_SETTINGS_IMPLEMENTATION_RECORD_v1.md));
   - W3-CORR-U, merged through PR #302.

   Stage 1 is **DONE FOR THE CURRENT EXECUTION SEQUENCE, WITH NAMED RESIDUALS**. W3 itself is not phase-closed: its
   residual rows are listed in [`QANDEEL_CURRENT_STATE.md`](QANDEEL_CURRENT_STATE.md) §7. Stage 2 is **ACTIVE**:
   VPORT-01 merged through PR #297 at `fe9d9155f122725cb669e9989fa35ff12916112a`
   ([record](docs/e2e/QANDEEL_VPORT_01_LIVING_ANALYSIS_WORLD_PRODUCTION_VISUAL_PORT_v1.md)), and **VPORT-02 is NEXT**
   (§5.1). The cross-cutting readiness / integrity tasks are listed beside the map in §5.1.
4. Release Hardening & Launch.

This sequencing creates no runtime semantics and opens no implementation task by itself.

### 5.1 Current E2E execution map — working delivery map (2026-09-30; status reconciled 2026-10-04 through PR #305)

This is the current Product-Owner working execution map synthesized from repository truth after W3-MEGA-U. ROADMAP-REC-01
reconciled its status column against GitHub truth through PR #305 and changed no stage, objective or boundary. It does
**not** rewrite the historical E2E-01 census or its proposed wave file. Before every future implementation task, run an
**Anti-Duplication Gate** and report four facts: what is already Product/design frozen; what backend/runtime already
exists; what is already production-implemented; and only then what work is genuinely missing. Frozen Product/design,
closed backend/runtime and merged production work are consumed, never redesigned or rebuilt without a real
contradiction.

| Stage | Status (through PR #305) | Delivery objective | Reuse / no-repeat boundary |
|---|---|---|---|
| **1 — Personal Core / W3 core completion** | **DONE FOR THE CURRENT EXECUTION SEQUENCE, WITH NAMED RESIDUALS.** The merged W3 slices are consumed: W3-01, W3-02, W3-MEGA-U, W3-MEGA-M, W3-MEGA-A, W3-MEGA-S and W3-CORR-U. Do not rebuild them. The row-level residuals stay open and owned where their records put them ([Current State](QANDEEL_CURRENT_STATE.md) §7); none is silently called closed | Memory through Conversation; remaining Account & Identity implementation; advance Settings only with real available capabilities; explicitly resolve / assign the remaining W3 Product-decision rows | consume W1A/W1B/W2, W3-01, W3-02 and W3-MEGA-U; do not rebuild Settings, Public ID or Understanding; D-02 closes progressively as later real groups land — no empty placeholder groups |
| **2 — Final Visual Production Port** | **DONE / MERGED.** `VPORT-01` (PR #297) and `VPORT-02` (PR #306, merged as `34ea439b98eecd5f22628f41749245f81bb2b9f8`; `QAN-BL-A11Y-01` tombstoned) ([record](docs/e2e/QANDEEL_VPORT_02_TIMELINE_ORIENTATION_P2_FINAL_COHERENCE_IMPLEMENTATION_RECORD_v1.md)) | port the final Living Analysis world and the final cross-surface visual/icon system into production | consume I-08B1 FAR/MID/NEAR, I-08B3, P2 and the existing Map/Timeline/Temporal/Return runtime; no visual redesign |
| **3 — Activity & Notifications Production** | **DONE / MERGED** (reconciled by S4-01; A3-02 merged through PR #308 at `06a960848faaccc6e294d38fbde2918b10ed1d74`). At that time: `A3-01 — Activity & Attention Core + In-App Production Integration` = **`MERGED / CLOSED` through PR #307 at `a2ec76507e43c82dcabf4194053e318c2fb9d509`.** ([record](docs/e2e/QANDEEL_A3_01_ACTIVITY_ATTENTION_INAPP_PRODUCTION_IMPLEMENTATION_RECORD_v1.md)); `A3-02 — Native Push, Permission & Platform Delivery Integration` = **IMPLEMENTED ON A DRAFT PR — PRODUCT COPY GATE APPROVED — NOT MERGED.** ([record](docs/e2e/QANDEEL_A3_02_NATIVE_PUSH_PLATFORM_DELIVERY_IMPLEMENTATION_RECORD_v1.md)); it tombstones `QAN-BL-NOTIF-01` from its merge and admits `QAN-BL-NOTIF-05` (physical-device Exit Gates → Release Hardening). Stage 3 stays ACTIVE until A3-02 merges | implement Activity, attention, notification storage/delivery, Direct Entry and native Push/platform integration | consume I-08N-01 + P3 + P4; no redesign of Activity, strips, privacy, Quiet Hours, Snooze or notification settings |
| **4 — Shared World Product Integration** | **DONE / MERGED** for S4-01 … S4-04. A later Product review identified one owned corrective gap: `QAN-BL-CW-03 — Shared World Living Analysis Map / Semantic Geography Product Integration` (`SHARED-VIS-01`, HIGH, DEFERRED — OWNED). **This does not reopen Stage 4 now:** by explicit Product Owner sequencing it starts only after Stage 5 / Public World is fully DONE / MERGED. | application boundary and mobile Product surfaces over the closed Shared runtime; later align the Shared World surface with the Living Analysis semantic-world North Star | consume I-04 and migrations 0075–0090; do not rebuild invitation, birth, governance, history, leave or material semantics; the later correction reuses the common Living Analysis renderer with Shared-specific projection/state |
| **5 — Public World Product Integration** | **ACTIVE** (reconciled by S5-03B). `S5-01 — Public World Reachability, Entry & Identity Foundation` = **`MERGED / CLOSED` through PR #314 at `8dfc7b38baa133c8cecbffea8c65ae17ddc245ff`** ([record](docs/e2e/QANDEEL_S5_01_PUBLIC_REACHABILITY_ENTRY_IDENTITY_FOUNDATION_IMPLEMENTATION_RECORD_v1.md); migration `0142`); `S5-02 — Publishing + Rights + Draft/Review + Privacy Closure` = **`MERGED / CLOSED` through PR #315 at `1a10127672f8db7ff475bca4732635bf88536730`** ([record](docs/e2e/QANDEEL_S5_02_PUBLIC_PUBLISHING_RIGHTS_DRAFT_REVIEW_PRIVACY_CLOSURE_IMPLEMENTATION_RECORD_v1.md); migration `0143`; its Product Copy Gate CLOSED; `QAN-BL-CW-01` tombstoned). The Product Owner splits S5-03 into three ordered tasks: `S5-03A — Public Semantic Interpretation + Publisher Review` = **`MERGED / CLOSED` through PR #316 at `c9338af9ecbfcecccc281f96f52fab335ad9bc7b`** ([record](docs/e2e/QANDEEL_S5_03A_PUBLIC_SEMANTIC_INTERPRETATION_PUBLISHER_REVIEW_IMPLEMENTATION_RECORD_v1.md); migration `0144`; its Product Copy Gate CLOSED, 21 / 21 APPROVED); `S5-03B — Public Semantic Field + Viewer Runtime` = **ACTIVE — NOT MERGED** ([record](docs/e2e/QANDEEL_S5_03B_PUBLIC_SEMANTIC_FIELD_VIEWER_RUNTIME_IMPLEMENTATION_RECORD_v1.md); migration `0145`; its Product Copy Gate OPEN); `S5-03C — Explicit Relations + Integrity Closure` = **LATER**; `S5-04 — Discussion + Public QANDEEL + Final Public Integration` = **LATER** | Public browse/search/read/publication Product surfaces and required application boundaries | consume I-05 and migrations 0091–0099; do not rebuild Public publication/visibility/search runtime |
| **6 — Matching / Introductions Product Integration** | **LATER** | participation, proposals and Introduction surfaces including progressive disclosure | consume I-07 and migrations 0108–0118, 0120 and 0122; do not rebuild matching lifecycle/runtime |
| **7 — Replay Product Integration** | **LATER** | Replay entry, selection, preview, navigation and media/export realization | consume I-06 and migrations 0100–0107 plus the frozen Replay name/placement; do not rebuild Replay authority/runtime |
| **8A — QANDEEL AI Brain / Production LLM Runtime** | **LATER** (named explicitly before Voice by the Product Owner in the S5-03A Task Contract, 2026-10-06) | the production LLM / provider selection and runtime for QANDEEL's brain, including the provider-neutral structured boundaries that wait for it (S5-03A's `PublicSemanticInterpreter` refuses until it is bound) | consume the Model Router, FAST / DEEP, the provider-neutral adapters and AI-COST-01's accounting boundary; no provider is selected before this stage |
| **8B — Voice Runtime** | **LATER** (runtime / provider-gated) | Voice Notes and Live Calls: realtime audio, ASR/TTS, barge-in, background/interruption, durable audio and provider integration | consume G1.2/P2/P4 frozen Product/non-signal visual law; only runtime-gated truth is newly resolved |
| **9 — Economy + Launch Closure** | **LATER.** The AI-COST-01 accounting foundation is DONE (PR #303). The final Product economy and provider selection are not | Plans/Credits/Usage from measured provider economics; Lantern; maintenance/min-version; security, device/store/legal/operations and release hardening | consume all prior frozen/implemented work, including AI-COST-01's ledger, Price Cards and inactive Credit Policy contract; this stage closes release-specific gaps rather than reopening Product foundations |

> **PAUSE CHECKPOINT — 2026-10-07:** current task remains `S5-03B — Public Semantic Field + Stable Spatial Placement + Viewer Runtime` on draft PR #317 at head `430118ae2d27c2d9d686a1edb0ee26ed433eb16d`. R1/R2 have made Personal and Public consumers of ONE shared `LivingAnalysisSurface → WorldViewSurface → WorldCanvas`, but the Product Owner has NOT accepted the current Living Analysis visual quality. No merge, no Copy Gate approval, no S5-03C/S5-04. Future visual redesign is to be developed once against the shared Analysis stack (preferably isolated in a visual proof branch/harness), then consumed by Personal and Public automatically at the shared layer; Shared adopts the same stack later through `QAN-BL-CW-03 / SHARED-VIS-01`, which MUST NOT start until Public World / Stage 5 is fully DONE / MERGED. Stages 6–9 are not opened.**

*(Historical: S5-02 was the current task until PR #315 merged on 2026-10-06.)*

*(Historical: S5-01 was the current task until PR #314 merged on 2026-10-06.)*
> **Stage 4 is DONE: S4-01 (PR #310), S4-02 (PR #311), S4-03 (PR #312) and S4-04 (PR #313) are MERGED.**

*(Historical: S4-04 was the current task until PR #313 merged on 2026-10-06.)*

*(Historical: S4-03 was the current task until PR #312 merged on 2026-10-06.)*

*(Historical: S4-02 was the current task until PR #311 merged on 2026-10-05.)*

*(Historical: S4-01 was the current task until PR #310 merged on 2026-10-05.)*
> **Stage 3 is DONE: A3-01 (PR #307) and A3-02 (PR #308) are MERGED.**

*(Historical: A3-02 was the current task until PR #308 merged on 2026-10-05.)*

*(Historical: VPORT-02 was the next task at the 2026-10-04 reconciliation; it merged through PR #306, closing Stage 2.)*
*(Historical: A3-01 was the current task until PR #307 merged on 2026-10-04.)* A3-02 runs under its own Task Contract;
this map does not scope it further.

#### Cross-cutting Production Readiness / Integrity

These tasks run beside the 9 stages. They did not replace or renumber them.

| State | Tasks |
|---|---|
| **DONE / MERGED** | `PROD-SEC-02` (#299, `0131`) · `PROD-OPS-01` (#300, `0132`) · `PROD-SEC-01` (#301, `0133`) · `W3-CORR-U` (#302, `0134`) · `AI-COST-01` (#303, `0135`) · `W3-MEGA-S-CLOSE-01` (#305, Copy Gate / residual closure) |
| **DEFERRED — OWNED** | `PROD-AUTH-01` (`QAN-BL-PROD-04`) · `PROD-DATA-01` (`QAN-BL-PROD-05`) |
| **FINAL-LAUNCH / EXTERNAL GATES** | `LAUNCH-EDGE-SECURITY-GATE — Trusted Proxy / Edge / Origin Production Proof` (`QAN-BL-LAUNCH-01`) · `FINAL-LAUNCH-CLOSURE — Identifier Key Management Gate` (`QAN-BL-LAUNCH-02`) |
| **Evidence only** | `PROD-READINESS-01` — PR #298 **CLOSED UNMERGED**; its findings were admitted as `QAN-BL-PROD-01` … `05` |

The launch-gate owners are copied from the [canonical backlog](docs/qandeel-canonical-backlog-v1.md) §4 and change
nothing there.

**Anti-confusion rule.** Cross-cutting readiness / correction tasks may be inserted when a real blocker is discovered,
but they do not renumber or replace the 9-stage E2E delivery map. After such a correction closes, execution returns to
the active delivery stage unless the Product Owner explicitly changes sequencing.

**No invented tasks.** `W3-CORR-M` is not a canonical task and is not opened. Memory control is the merged W3-MEGA-M
(PR #293).

At the start of **every** executor task, show this map with each stage marked **DONE / ACTIVE / NEXT / LATER**, name the
specific Mega Task being opened, and state what prior authority/runtime it must reuse.

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
| G3 §D notification-context prose | says the repository had no canonical notification Product behavior to reference at that time | historical for behaviour. The recovered I-08N-01 final closure is the frozen foundational attention contract, and the P3 closure is its final Product realization: together they are the current Product attention authority. G3's no-runtime statement remains true — no production notification runtime exists; its Matching-during-call rule remains compatible and binding (P3 §19.2–§19.3) |
| Proof packages' own wording: G1.x, G2, G3 "READY FOR … REVIEW"; typography, A3R2, B4R, F self-status "candidate"; the G3 handoff "G3 NOT STARTED"; G2's "Q-LIGHT-SHELL remains open" | candidate or open | the closure records and the artifact index hold the lifecycle, and the package bytes are not edited (G3 §I) |
| Pre-closure banners with no closure record: T-04 (`awaiting independent Architecture review`), T-12P (`CANDIDATE`), QAN-INF-05 (`CANDIDATE`) | awaiting review | none is recorded as closed. `QAN-GOV-03` reported T-04 and T-12P to Architecture rather than correct them. They are not closed and not failed; their lifecycle is not established |
| T-03B2b3 / T-03B3 `PRODUCTION-INERT` banners | nothing wired | historical: T-03D performed the production cutover |
| Backlog §7 prose "seven `OPEN — UNASSIGNED` items" | 7 | its own correction paragraph fixes it. The mechanically counted register now holds 33 items, 10 of them `OPEN — UNASSIGNED` (at PR #303, recounted by ROADMAP-REC-01) |
| Merged tasks' records still reading `IMPLEMENTED ON A DRAFT PR — NOT MERGED` or `DRAFT PR … AWAITING … REVIEW` (W3-MEGA-A/S, VPORT-01, PROD-SEC-02, PROD-OPS-01, PROD-SEC-01, W3-CORR-U, AI-COST-01) | unmerged | all eight merged through PRs #295–#303 (except #298). ROADMAP-REC-01 set their current banners and labelled the handoff wording historical. "Claude did not merge" stays true |
| The VPORT-02 record's banner `VPORT-02 READY FOR INDEPENDENT REVIEW — DO NOT MERGE` | unmerged | merged through PR #306 at `34ea439b98eecd5f22628f41749245f81bb2b9f8`; the record keeps its bytes (its own contract pins that phrase). Stage 2 is DONE |
| the word "attention" in HIM / HSE code (`hse.attention@1`, migrations `0014`, `0057`) | looks like notification attention | internal human-model measurement of the reader's self-reported attention; not the Product Activity / notification runtime (A3-01 record §5) |
| The P4-C and P4-C3 packages' own wording: "P4 remains ACTIVE — NOT CLOSED / NOT FROZEN", `P4-C3 — CORRECTIONS COMPLETE / READY FOR FINAL INDEPENDENT REVIEW`, each spec's `NOT FROZEN` banner, proof-time `PROPOSED_FOR_PO_REVIEW` labels; the P4-C3 report's "five statuses"; APP-OPS-01's `_CANDIDATE` file name and its historical `CANDIDATE` markers | P4 open; copy unapproved; APP-OPS a candidate | superseded by the P4 closure and P4-C4; the package bytes are not edited. APP-OPS-01 is `CLOSED / FROZEN` and its `CANDIDATE` clauses bind (its reading conventions). The "five statuses" sentence is a non-authoritative nit: six classes after P4-C3R |
| I-08A4 §8 / §9 `Readings` = «القراءات», `Reading` = «قراءة» | the user-facing name of the understanding surface | P1 §10 renames that surface **QANDEEL Understanding / «فهم قنديل»**. P1 explicitly preserves the distinct in-Analysis peer-reading vocabulary of VI-01, G1.1 §2 and the T-08 chrome |
| F2 "Default appearance follows the system" (`follow-system-no-in-app-override`); the G2 / F2 Analysis-shell amendment and G3 §C.1 "Non-Analysis surfaces keep following the system appearance" and "not a user appearance override or toggle" | no in-app appearance choice | P1 §12: non-Analysis surfaces follow a Dark / Light / System preference, default Dark. The Analysis stays one dark place under every value. No token or preserved byte changed |
| T-14 Email-only sign-in and its copy "Email or password is incorrect." | the Product sign-in | the implemented v1 gateway, still `CLOSED / FROZEN`. The final Product requirement is one `Login ID OR Email` identifier plus Password (P1 §3) |
| G1.2 §6 "The current icons and audio strip are **PROOF ONLY — NOT A VISUAL FREEZE**"; the roadmap's former "P2 — CURRENT / NEXT" | final iconography not frozen | P2 is `CLOSED / FROZEN`: the icon glyphs and the call controls are frozen by the P2 closure. G1.2's audio strip and the broader Voice visual language were left unfrozen by P2 (§13.1). **Later, P4** froze the non-signal Voice visual language (P4 closure §6); the signal-bearing half — waveform, levels, speaking / listening morphology — still waits on `QAN-BL-VOICE-01` |
| The P2-A package's own wording: "P2 NOT CLOSED / NOT FROZEN", "P2 remains not closed / not frozen until the later P2-B canonical closure task" | P2 open | superseded by the P2 closure; the package bytes are not edited. Its comparison variants (Call Rail B / C, Spine A / B, N2, the other utility libraries) are evidence only |
| The P3-A package's own wording: "P3 remains NOT CLOSED / NOT FROZEN", `P3-A FINAL MICRO-REFINEMENT — READY FOR PRODUCT OWNER + INDEPENDENT REVIEW`, each spec's `NOT FROZEN` banner; the roadmap's former "P3 — CURRENT / NEXT" | P3 open | superseded by the P3 closure; the package bytes are not edited. Its comparison glyphs (Quiet Bell, At the Door, the two-opening Introductions drawing), the rejected ordinary Analysis strip (planted defect D24), its exit tie-break "oldest waited first", its timings and its `PROOF` / `OPEN` / `FIXTURE` copy are evidence only, not frozen (P3 §8, §16–§18) |
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
