# QANDEEL — Canonical Authority Index

**Status:** `LOCATOR / PRESERVATION INDEX — CREATES NO NEW AUTHORITY`

For each recovered domain, this index answers five questions:

- where the preserved source lives;
- what lifecycle state it records;
- what role it plays;
- how its bytes are proven;
- what later authority in this repository binds over it.

Paths are relative to `docs/canonical-authority/` unless they start with `docs/`.

**Later amendments bind.** Each preserved source is the original authority for its own stage or phase. Where a
later canonical record in this repository amends, narrows or implements it, the later record wins. This
index never makes a historical checkpoint outrank:

- a T-series controlled amendment;
- a closed Connected Worlds runtime phase (I-04 … I-07 and their REM remediations);
- an I-08B design closure;
- an explicit later Product amendment such as G1.1 / G1.2 / G3 or the P1 closure.

## Index

| Domain | Repository path | Lifecycle (as the source states it) | Authority role | Provenance | Superseded by / later amendments |
|---|---|---|---|---|---|
| Connected Worlds v2 — CW2-01 … CW2-08 | `connected-worlds-v2/architecture/QANDEEL_CW2-0N_*_v1.0_FROZEN.md` | each `CLOSED / FROZEN` | `FROZEN SOURCE — LATER AMENDMENTS BIND` | `connected-worlds-v2/CW2_SOURCE_PROVENANCE.sha256`; byte-identical in the master package ZIP `fce70dfa…95772b8`, and CW2-02 / 05 / 08 also in three deleted task packages ([provenance §3](RECOVERY_PROVENANCE.md)) | The closed runtime phases that implement it: I-04 [`docs/shared-world-lifecycle-conversation-runtime-v1.md`](../shared-world-lifecycle-conversation-runtime-v1.md), I-05 [`database/README.md`](../../database/README.md), I-06 [`docs/replay-runtime-v1.md`](../replay-runtime-v1.md), I-07 [`docs/matching-introduction-runtime-v1.md`](../matching-introduction-runtime-v1.md); REM-01 … REM-03 (migrations `0119`–`0122`); the closure records in [`docs/qandeel-canonical-backlog-v1.md`](../qandeel-canonical-backlog-v1.md); the [P1 Product closure](../qandeel-p1-user-identity-preferences-understanding-canonical-closure.md) §15.4–§15.5, which names the CW2-03 §4 credential **Shared ID**, requires the target's current Shared ID for new add / rejoin reachability at a future application boundary, and resolves CW2-06's progressive image into three owner-controlled stages. No runtime changes |
| Connected Worlds v2 — CW2-00 + product vision | `connected-worlds-v2/architecture/QANDEEL_CONNECTED_WORLDS_V2_CW2-00_CANONICAL_PRODUCT_BASELINE.md`, `connected-worlds-v2/product-vision/*.md` | CW2-00 `CANONICAL PRODUCT BASELINE` (closure: `COMPLETE`) | `CANONICAL — HISTORICAL / UPSTREAM` | as above | CW2-01 … CW2-08 and the closed runtime phases above |
| Connected Worlds v2 — Final Freeze Reviews + Architecture Closure | `connected-worlds-v2/freeze-reviews/`, `connected-worlds-v2/closure/QANDEEL_CONNECTED_WORLDS_V2_ARCHITECTURE_CLOSURE_v1.0.md` | reviews: freeze gates for each CW2 document; closure: `ARCHITECTURE COMPLETE` (2026-09-13) | `SUPPORTING EVIDENCE ONLY` (proves the freeze) | as above | its "Implementation: NOT STARTED" and "next phase" statements are historical; implementation ran through I-01 … I-07 |
| Core Checkpoint v2 | `experience-architecture/core-checkpoint/QANDEEL_CANONICAL_CORE_CHECKPOINT_v2.md` | "CURRENT CANONICAL ENTRY POINT" **as of 2026-09-03** | `CANONICAL — HISTORICAL / UPSTREAM`. **Not the current project entry point.** | `core-checkpoint/CORE_SOURCE_PROVENANCE.sha256`; path `E:\QANDEEL\QANDEEL DOCUMENTS\…` named by [`LOCAL_ONLY_CANONICAL_ARTIFACT_AUDIT.md`](../design/canonical-artifacts/LOCAL_ONLY_CANONICAL_ARTIFACT_AUDIT.md) row M | Stage 5 and Stage 6 Final Freeze Records (below); every later T-series, Connected Worlds and I-08B record |
| Navigation Canonical Checkpoint v1 (Stages 0–4) | `experience-architecture/navigation-checkpoint/` (`START_HERE.md`, `NAVIGATION_CANONICAL_STATE.md`, `images/`, `stage3_foundation/`) | Stages 0–4 each `CLOSED / FROZEN` (status date 2026-09-02) | `CANONICAL — HISTORICAL / UPSTREAM`. Its named canonical images are part of the checkpoint | `navigation-checkpoint/NAVIGATION_SOURCE_PROVENANCE.sha256`; the package's own `SHA256SUMS.txt` (35/35) and `stage3_foundation/SHA256SUMS.txt` (16/16) verify | Stage 5 and Stage 6 Final Freeze Records; T-04 … T-14; the T-11 / T-12 controlled amendments in `docs/design/i-08b3.1-g2.3/` and `docs/design/i-08b3.1-g3/`; the I-08B visual canon |
| Stage 5 — Timeline ↔ Map Synchronization | `experience-architecture/stage5/QANDEEL_STAGE5_FINAL_FREEZE_RECORD_v1.md`; Stage 5.1 source in `stage5/approved-source/5.1/`; approved sources in `stage5/approved-source/{5.2-v3,5.3-v1,5.4-v1,5.5-v1,5.6-v2}/`; binding addenda/ruling in `stage5/freeze-authority/` | `CLOSED / FROZEN` (2026-09-03); all 5.1–5.6 frozen. The Stage 5.1 source keeps its point-in-time pre-approval banner; later closure records bind. | Final Freeze Record and Architecture Addenda/Ruling `CANONICAL — HISTORICAL / UPSTREAM`; candidate/source packages `FROZEN SOURCE — LATER AMENDMENTS BIND` | `stage5/STAGE5_SOURCE_PROVENANCE.sha256`; recovered addenda/ruling are byte-exact Library originals; package checksum files verify their preserved candidate bytes | Stage 6 Final Freeze Records; T-05 … T-07; the T-11 / T-12 controlled amendments |
| Stage 6 — Experience Closure + Implementation Readiness | `experience-architecture/stage6/final-authority/` (28 files) and `stage6/approved-candidate-source/{6.2-v2,6.4-v2,6.5-v3,6.6-v3}/` | parent `QANDEEL_STAGE6_FINAL_FREEZE_RECORD_v1.md`: `STAGE 6.6 — CLOSED / FROZEN`, `STAGE 6 — CLOSED / FROZEN` | Final Freeze Records `CANONICAL — HISTORICAL / UPSTREAM`; rulings, gates and authorizations `SUPPORTING EVIDENCE ONLY`; approved candidates `FROZEN SOURCE — LATER AMENDMENTS BIND` | `stage6/STAGE6_SOURCE_PROVENANCE.sha256`; independent external byte-identity attestation for all 28 files; [`stage6/STAGE6_RECOVERY_RECONCILIATION.md`](experience-architecture/stage6/STAGE6_RECOVERY_RECONCILIATION.md) | the T-series implementation records that consume it (T-02 … T-14); the T-11 / T-12 controlled amendments; the I-08B design closures |
| Stage 6.6 Implementation Authority Bundle | [`experience-architecture/stage6/implementation-authority-bundle/IMPLEMENTATION_AUTHORITY_BUNDLE_MAP.md`](experience-architecture/stage6/implementation-authority-bundle/IMPLEMENTATION_AUTHORITY_BUNDLE_MAP.md) | original ZIP container **not recovered**; payload **8/8 preserved** | `LOCATOR / PROVENANCE ONLY` (map; not an authority). The member files retain their own upstream authority. | 7 byte-exact originals + Navigation `START_HERE.md` byte-exact equivalent | as for Stage 6 |
| I-08A — Product Shell / IA / Canonical Naming | `final-product-experience/i-08a/QANDEEL_I-08A4_CLOSURE_SYNTHESIS_CANONICAL_PRODUCT_SHELL_IA_NAMING_DECISION_RECORD.md` | `I-08A4 — CLOSED / CANONICAL FREEZE COMPLETE`; `I-08A — CANONICAL PRODUCT SHELL / IA / NAMING FOUNDATION — FROZEN` | `CANONICAL PRODUCT FOUNDATION — LATER AMENDMENTS BIND` | `final-product-experience/FINAL_PRODUCT_EXPERIENCE_SOURCE_PROVENANCE.sha256`; byte-exact original ChatGPT Library artifact | G1.1 / G1.2 supersede the Product labels and shell statements they explicitly amend; later G3 controlled amendments bind where applicable; [P1](../qandeel-p1-user-identity-preferences-understanding-canonical-closure.md) §15.1 renames `Readings / القراءات` for its surface to **QANDEEL Understanding / «فهم قنديل»**, makes General Settings one destination and records no traditional Profile page |
| I-08N-01 — Notification & Proactive Attention | `final-product-experience/i-08n/QANDEEL_I-08N-01_FINAL_CLOSURE_PACKAGE.md` | `CLOSED / NOTIFICATION & PROACTIVE ATTENTION PRODUCT CONTRACT FROZEN` | `CANONICAL PRODUCT CONTRACT — IMPLEMENTATION NOT IMPLIED` | same provenance file; byte-exact original ChatGPT Library artifact | G3 §D adds a compatible Matching-during-Live-Call presentation rule. No notification runtime is created by either record |
| Connected Worlds assurance (`ASSURE-F05`) | [`docs/assurance/connected-worlds/`](../assurance/connected-worlds/README.md) | register "COMPLETE — REMEDIATION REQUIRED" | `ASSURANCE EVIDENCE ONLY`. **Not Product authority** | `docs/assurance/connected-worlds/ASSURANCE_SOURCE_PROVENANCE.sha256` | governance locator: backlog item `QAN-BL-CW-01` |

## Missing original containers

| Container | Named by | State |
|---|---|---|
| `QANDEEL_T05_MANDATORY_FREEZE_REFERENCES.zip` | [`docs/timeline-presentation-window-v1.md`](../timeline-presentation-window-v1.md) | `ORIGINAL CONTAINER NOT RECOVERED — AUTHORITY PAYLOAD PRESERVED SEPARATELY`. Its two named members, the Stage 6.2 and 6.4 Final Freeze Records, are in `stage6/final-authority/freeze-records/` |
| `QANDEEL_STAGE6_6_IMPLEMENTATION_AUTHORITY_BUNDLE_v1.zip` | Stage 6.6 candidates and readiness material | `ORIGINAL CONTAINER NOT RECOVERED — AUTHORITY PAYLOAD PRESERVED SEPARATELY` (all 8 payload members preserved: 7 byte-exact originals + 1 byte-exact equivalent; see the bundle map) |

Neither container was rebuilt.

## Deliberately not admitted

- The older `CW-00` / `CW-01` / `CW-02` Connected Worlds reports, which say "NOT FROZEN / NOT SELF-APPROVED". CW2-00 supersedes them, and the master package README excludes them.
- The CW2 task charters.
- Superseded Stage 5 / Stage 6 candidate versions.
- Proof boards and diagrams.
- Stage pre-flight *readiness reports*. These are not the Pre-Flight Contract Gates.
- Every outer ZIP.

[`RECOVERY_PROVENANCE.md`](RECOVERY_PROVENANCE.md) §6 lists them.
