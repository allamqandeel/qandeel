# QANDEEL — Stage 6.6 Implementation Authority Bundle v1 — Map

**Status:** `LOCATOR / RECONSTRUCTION MAP — NOT AN AUTHORITY, NOT A REBUILT BUNDLE`

## Where the bundle came from

`QANDEEL_STAGE6_6_IMPLEMENTATION_AUTHORITY_BUNDLE_v1.zip` supplied Stage 6.6 with eight upstream artifacts. It
is **not recovered** and was **not recreated**:

`ORIGINAL CONTAINER NOT RECOVERED — AUTHORITY PAYLOAD PRESERVED SEPARATELY`

This map records where each member's bytes are preserved, if they are.

## Sources for the member list and hashes

- **Member list.** The bundle's own [`AUTHORITY_MANIFEST.md`](../final-authority/supporting-authority/AUTHORITY_MANIFEST.md) lists the members and their original ChatGPT Library artifact names.
- **Recorded hashes.** These come from the Stage 6.6 readiness verification (§0 "Bundle integrity verification"), which recorded each member's SHA-256 in truncated `prefix…suffix` form. That readiness report is not preserved in this repository; it is a readiness report, not an authority.

## Members

| Bundle member | Role in the bundle | Original Library artifact | Recorded SHA-256 | Preserved at | State |
|---|---|---|---|---|---|
| `AUTHORITY_MANIFEST.md` | bundle manifest and authority status chain | (bundle-authored) | `05817b69…c3836f` | `../final-authority/supporting-authority/AUTHORITY_MANIFEST.md` (`05817b693902…565c3836f`) | `BYTE-EXACT ORIGINAL SOURCE PRESERVED`: equals the recorded hash, and is within the 28-file external attestation |
| `STAGE1_2_CONVERSATIONAL_UNIT_MODEL.md` | INPUT-01 / INPUT-02 | `Pasted markdown(20260902-123701).md` | `526b9dae…3ee010` | `../final-authority/supporting-authority/STAGE1_2_CONVERSATIONAL_UNIT_MODEL.md` (`526b9dae0c3d…bf3ee010`) | `BYTE-EXACT ORIGINAL SOURCE PRESERVED`: equals the recorded hash, and is within the external attestation |
| `STAGE1_3_THREAD_ESTABLISHMENT_GRAMMAR.md` | INPUT-02 / INPUT-03 | `Pasted markdown(20260902-124307).md` | `bc48a774…6fc840` | `../final-authority/supporting-authority/STAGE1_3_THREAD_ESTABLISHMENT_GRAMMAR.md` (`bc48a774eaef…46fc840f`) | `BYTE-EXACT ORIGINAL SOURCE PRESERVED` **by the external attestation**. The recorded 8-character prefix matches; the recorded 6-character suffix matches the actual hash one character before its end, so the truncated record alone is not treated as proof |
| `NAVIGATION_CHECKPOINT_START_HERE.md` | final canonical closure evidence (Stages 0–2 `CLOSED / FROZEN`) | — | `176a8e5f…58cb09` | `../../navigation-checkpoint/START_HERE.md` (`176a8e5f485f…41358cb09`) | `BYTE-EXACT EQUIVALENT SOURCE PRESERVED`: same bytes under the Navigation Checkpoint's own filename |
| `STAGE0_EXPERIENCE_ARCHITECTURE_FINAL_FREEZE_REVIEW.md` | upstream Stage 0 dependency | `Pasted markdown(20260902-114223).md` | `7cf9e9b0…f12b80` | — | `NOT RECOVERED` |
| `STAGE1_10_FINAL_FREEZE_CANDIDATE.md` | Stage 1 final validation / closure evidence | `Pasted markdown(20260902-134532).md` | `44b303ed…1c3408` | — | `NOT RECOVERED` |
| `STAGE2_2_THREAD_HOME_ANCHOR.md` | downstream Stage 2.2 Home Anchor dependency | `Pasted markdown(20260902-145457).md` | `0b8bffc8…466398fe` | — | `NOT RECOVERED` |
| `STAGE2_3_CLOSURE_EVIDENCE_FOR_STAGE2_2.md` | closure evidence for Stage 2.2 | (see `AUTHORITY_MANIFEST.md` §6) | `3a30de15…f17222` | — | `NOT RECOVERED` |

**Result: 3 byte-exact originals, 1 byte-exact equivalent, 4 not recovered.**

- **How the missing four were searched for.** Only exact names were searched, in the already-identified session transcripts and the two recovery trees. No capture of them exists there, and nothing was paraphrased or reconstructed in their place.
- **What still binds.** The Stage 0 / 1 / 2 closure status they would corroborate is independently recorded by the preserved Navigation Checkpoint (`START_HERE.md`: Stages 0–4 `CLOSED / FROZEN`) and by `AUTHORITY_MANIFEST.md` §1.
- **Where they may still exist.** Their Library artifact names above are the identity to ask for.
