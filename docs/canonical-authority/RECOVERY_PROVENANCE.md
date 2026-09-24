# QANDEEL — Recovered Canonical Authority: Provenance

**Status:** `PROVENANCE RECORD — CREATES NO NEW PRODUCT SEMANTICS`
**Preservation baseline:** `origin/main` `84f507d052080be937f062628e232df08270c813` (PR #268 merge), 2026-09-24

## 1. Why this exists

A full project-state audit on 2026-09-24 found a gap. The runtime, database and design records on `main` cite
upstream authority that GitHub never held:

- the frozen Connected Worlds v2 architecture `CW2-01` … `CW2-08`;
- `QANDEEL_CANONICAL_CORE_CHECKPOINT_v2`;
- the Navigation Canonical Checkpoint;
- the Stage 5 / Stage 6 Experience Architecture freeze chain.

Two targeted recovery passes on the Product Owner's laptop found these sources.

**Workspace condition at audit (recorded, not repaired).** The Product Owner's working copy
`E:\QANDEEL\QANDEEL PROJECT\` had:

- 1,517 of 1,524 tracked files missing from the working tree;
- a local `main` hundreds of commits behind `origin/main`;
- tens of thousands of untracked files;
- a `.git\lost-found\` left by an earlier `git fsck --lost-found`.

That folder was used **only as a read source**. All Git work for this preservation ran in a fresh clean clone
outside it.

## 2. Authorised sources (read-only)

| Source | What it supplied |
|---|---|
| `E:\QANDEEL\QANDEEL PROJECT\RECOVERED_MISSING_AUTHORITIES\` | first recovery pass: Connected Worlds v2 master package, Core Checkpoint v2, Navigation Checkpoint v1, Stage 5 Final Freeze Record folder, approved Stage 6.2 / 6.4 / 6.5 / 6.6 candidate packages |
| `E:\QANDEEL\QANDEEL PROJECT\RECOVERED_STAGE6_FINAL_AUTHORITIES\` | second recovery pass: the 28 Stage 6 authority files |
| `E:\QANDEEL\QANDEEL PROJECT\QANDEEL_CONNECTED_WORLDS_ASSURANCE_FINDINGS_v1.md` | the assurance register, as evidence only (§8) |

Neither staging tree was modified. The originals those trees were copied from were:

- `E:\QANDEEL\WORK\ASSURE-01-REVIEW\canon\`
- `E:\QANDEEL\ADS\QANDEEL_CONNECTED_WORLDS_V2_MASTER_PACKAGE_v1.0.zip`
- `E:\QANDEEL\QANDEEL DOCUMENTS\`
- the session-transcript captures described in [`experience-architecture/stage6/STAGE6_RECOVERY_RECONCILIATION.md`](experience-architecture/stage6/STAGE6_RECOVERY_RECONCILIATION.md)

Each staging tree records its own originals in its `RECOVERY_MANIFEST.json` and report.

## 3. Source → destination hashes

Every preserved file went through the same four steps: hash at the source, write, hash at the destination,
require equality. The per-file list is each domain's `*_SOURCE_PROVENANCE.sha256`.

| Domain | Files | Bytes | Source | Provenance file |
|---|---:|---:|---|---|
| Connected Worlds v2 | 24 | 287,022 | members of `RECOVERED_MISSING_AUTHORITIES\connected-worlds-v2\QANDEEL_CONNECTED_WORLDS_V2_MASTER_PACKAGE_v1.0.zip` (SHA-256 `fce70dfa7fc3fc58c36a4d812242ab4cca3177305f04ec36b8389c82b95772b8`); the loose staged copies of CW2-00 … 08, the closure and the CW2-03 review were confirmed byte-equal to the members | `connected-worlds-v2/CW2_SOURCE_PROVENANCE.sha256` |
| Core Checkpoint v2 | 1 | 28,097 | `RECOVERED_MISSING_AUTHORITIES\core-checkpoint\` | `experience-architecture/core-checkpoint/CORE_SOURCE_PROVENANCE.sha256` |
| Navigation Checkpoint v1 | 37 | 60,595,169 | members of `…\navigation-checkpoint\QANDEEL_NAVIGATION_CANONICAL_CHECKPOINT_v1\QANDEEL_NAVIGATION_CANONICAL_CHECKPOINT_v1.zip` (SHA-256 `e237f8ef8d82b85a550048b028680aeb46befe70fdd0b5a906826e87388f9a3b`); the loose `START_HERE.md` and `VISUAL_ATLAS_STAGE4.jpg` are byte-equal duplicates and were not preserved twice | `experience-architecture/navigation-checkpoint/NAVIGATION_SOURCE_PROVENANCE.sha256` |
| Stage 5 | 18 | 384,974 | `…\navigation-experience-stages\QANDEEL_STAGE5_FINAL_FREEZE_RECORD_v1\` | `experience-architecture/stage5/STAGE5_SOURCE_PROVENANCE.sha256` |
| Stage 6 final authority | 28 | 494,122 | `RECOVERED_STAGE6_FINAL_AUTHORITIES\` | `experience-architecture/stage6/STAGE6_SOURCE_PROVENANCE.sha256` |
| Stage 6 approved candidates | 12 | 390,882 | `…\navigation-experience-stages\QANDEEL_STAGE6_{2_…_v2,4_…_v2,5_…_v3,6_…_v3}\` | same file |
| Assurance evidence | 1 | 57,604 | project root (§8) | `docs/assurance/connected-worlds/ASSURANCE_SOURCE_PROVENANCE.sha256` |
| **Total** | **121** | **62,237,870** | | |

**Independent identities that agree with the preserved bytes.**

- **CW2-01 … CW2-08.** Each is byte-identical across 14–17 independent copies on the laptop, three of them inside deleted task packages in the Recycle Bin. Every section number that current `main` cites exists in the text, with a matching topic.
- **Core Checkpoint v2.** It sits at the exact path that `LOCAL_ONLY_CANONICAL_ARTIFACT_AUDIT.md` row M records. The anchors `main` cites (`S5-STATE-01/02`, `S5-RET-01`, `S5-TL-02/06`, `S5-RH-05`) are present.
- **Navigation Checkpoint.** Its own `SHA256SUMS.txt` (35/35) and `stage3_foundation/SHA256SUMS.txt` (16/16) verify the preserved files. `START_HERE.md` equals the hash that the Stage 6.6 bundle recorded for `NAVIGATION_CHECKPOINT_START_HERE.md`.
- **Stage 5 approved sources.** Each package's `SHA256SUMS.txt` verifies its preserved files.
- **Stage 6 approved candidates.** Their `SHA256SUMS.txt` verify. The parent Stage 6 Freeze Record's own recorded digests equal the preserved 6.6 v3 files.

## 4. Original bytes vs generated metadata

**Preserved bytes (unchanged).** Every file listed in a `*_SOURCE_PROVENANCE.sha256`, in these locations:

- `connected-worlds-v2/{package-readme,product-vision,architecture,freeze-reviews,closure}/`
- `experience-architecture/core-checkpoint/QANDEEL_*.md`
- all of `experience-architecture/navigation-checkpoint/` except its provenance file
- `experience-architecture/stage5/QANDEEL_*.md` and `stage5/approved-source/`
- `experience-architecture/stage6/final-authority/` and `stage6/approved-candidate-source/`
- the assurance register

**Generated by this preservation (new metadata, creates no authority).**

- `README.md`, `CANONICAL_AUTHORITY_INDEX.md` and this file
- every `*_SOURCE_PROVENANCE.sha256`
- `experience-architecture/stage6/STAGE6_RECOVERY_RECONCILIATION.md`
- `experience-architecture/stage6/implementation-authority-bundle/IMPLEMENTATION_AUTHORITY_BUNDLE_MAP.md`
- `.gitattributes`
- `docs/assurance/connected-worlds/README.md` and its `.gitattributes`

**Layout.** Within the package layouts, filenames are the originals. To keep repository paths portable on
Windows, a few package folders were shortened:

- CW2 package folders: `00_README` → `package-readme`, `01_PRODUCT_VISION` → `product-vision`, `02_CANONICAL_ARCHITECTURE` → `architecture`, `03_FREEZE_REVIEWS` → `freeze-reviews`, `05_CLOSURE` → `closure`;
- Stage package folders: for example `QANDEEL_STAGE6_5_IMPLEMENTATION_CONTRACT_CANDIDATE_v3` → `6.5-v3`;
- the Navigation Checkpoint's outer folder was dropped. Its internal layout, which its `SHA256SUMS.txt` depends on, is unchanged, so its longest path is 168 characters.

The original member paths are listed in §3 and in the staging manifests.

## 5. Stage 6 byte identity — independent external attestation

> Independent external review attestation: all 28 staged Stage 6 authority files were byte-compared by
> ChatGPT against the original Library artifacts and matched exactly. This executor verified the staged
> source/destination hashes but did not independently access that Library source.

The staging report's earlier classification, `TRANSCRIPT-RECOVERED — ORIGINAL BYTE IDENTITY NOT PROVEN` for
26 of the 28, was accurate when it was made. For preservation it is superseded by this attestation. See
[`experience-architecture/stage6/STAGE6_RECOVERY_RECONCILIATION.md`](experience-architecture/stage6/STAGE6_RECOVERY_RECONCILIATION.md).

## 6. Not admitted (rejected / excluded classes)

| Class | Reason |
|---|---|
| `CW-00` / `CW-01` / `CW-02` reports (for example `CW01_…_FINAL_REVIEW_PACKAGE.md`, `CW02_…_SELECTED_DIRECTION.md`) | they state "NOT FROZEN / NOT SELF-APPROVED". CW2-00 supersedes them, and the CW2 master package README excludes them from authority |
| CW2 task charters (8) | pre-freeze task instructions, not authority. They remain inside the recorded master-package ZIP |
| Superseded candidates: Stage 5.2 v1/v2, Stage 5.6 v1, Stage 6.x earlier versions | superseded by the versions their Freeze Records approve |
| Stage pre-flight *readiness reports* | not the Pre-Flight Contract Gates, which are preserved in `stage6/final-authority/preflight-gates/` |
| Stage 5 / Stage 6 proof boards, board HTML / CSS / JS, diagrams | the Freeze Records accept them as proof scaffolding or evidence only. Their hashes remain in each package `SHA256SUMS.txt` |
| Outer ZIP containers | the payload is preserved; the archives stay on the laptop, identified by the SHA-256 above |
| `QANDEEL_VISUAL_CANONICAL_CHECKPOINT_v1` | duplicate of the checkpoint's `stage3_foundation/` |

## 7. Missing sources (recorded, not reconstructed)

| Missing | Effect |
|---|---|
| `QANDEEL_T05_MANDATORY_FREEZE_REFERENCES.zip` | `ORIGINAL CONTAINER NOT RECOVERED — AUTHORITY PAYLOAD PRESERVED SEPARATELY` (Stage 6.2 / 6.4 Freeze Records) |
| `QANDEEL_STAGE6_6_IMPLEMENTATION_AUTHORITY_BUNDLE_v1.zip` | `ORIGINAL CONTAINER NOT RECOVERED — AUTHORITY PAYLOAD PRESERVED SEPARATELY`. 4 of its 8 members are not recovered (bundle map) |
| approved Stage 6.1 v2 and Stage 6.3 v1 candidate sources | `APPROVED CANDIDATE PAYLOAD NOT PRESERVED — FINAL FREEZE RECORD PRESERVED AND AUTHORITATIVE` |
| Stage 5.1 package; the Stage 5.3 / 5.4 / 5.5 Architecture Freeze Addenda; `QANDEEL_STAGE5_6_AMB01_ARCHITECTURE_RULING.md` | named by the Stage 5 Final Freeze Record, and not in either authorized recovery tree. The Freeze Record itself restates AMB-01 (§3) and the integrated Stage 5 core (§4) |
| Standalone Stage 0 / 1 / 2 source records | their `CLOSED / FROZEN` status is preserved in the Navigation Checkpoint. Stage 1.2 and 1.3 are preserved as 6.6 bundle members |

## 8. Assurance evidence

`QANDEEL_CONNECTED_WORLDS_ASSURANCE_FINDINGS_v1.md` (57,604 B,
`53ccf85f4939ef050f30af95732f6cf687c7e363e73c6e84d10c168bf68d8fe4`) is the only full text of `ASSURE-F05`. It
is preserved byte-exact in [`docs/assurance/connected-worlds/`](../assurance/connected-worlds/README.md) as
**assurance evidence only**. Its unresolved future work is registered as backlog item `QAN-BL-CW-01`.

## 9. What this preservation does not do

- It creates no Product, Experience, Architecture or Runtime semantics.
- It reopens no frozen decision and changes no production code, migration or runtime behaviour.
- It does not repair the laptop working copy.
- It does not update `README.md`, `docs/README.md`, a current-state document or a project map. That work is deliberately deferred to a separate task after independent review.
