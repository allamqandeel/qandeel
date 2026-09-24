# QANDEEL — Local-Only Canonical Artifact Audit

**Status:** `AUDIT RECORD — PRESERVATION TASK, 2026-09-23. NO REDESIGN, NO RENDER.`

**Scope:** `E:\QANDEEL\QANDEEL PROJECT`, searched recursively. `E:\QANDEEL` and the user's Downloads
folder were checked only for the named packages the brief expected and the root did not contain.
**Canonical `main` at audit:** `d1be3263cf91b969e4c29456e325ec8eece10d8b`.

**Reconciled after independent review (same day).** Five final authorities this audit reported as
not on the laptop were recovered by independent review from the project's ChatGPT Library and
applied to this branch: A3R2, C3R, the latest D2R, F2 FINAL_CANONICAL and G1.2 R1. The rows below
have been corrected to the reconciled state, and section F records the reconciliation itself.

## A. Root inventory (Phase A, read-only)

| Category | Count | Notes |
|---|---:|---|
| Archives at the project root | 42 | 478,691,566 B. 40 are `I-08B2.x` / `I-08B3.x` packages and 2 are Phase VI-03-04 / 04R |
| Archives in `design-workshops\` | 10 | 387,522,210 B. I-08B1 WS4–WS7R, the MID / NEAR / FAR baselines and the closure |
| External `*.manifest.txt` in `design-workshops\` | 4 | closure, FAR, MID-WS7R-R and superseded MID |
| Extracted `I-08*` package folders at the root | 40 | one per archive |
| `.i08b*-work\` folders | 28 | build and work scratch, including reruns and render outputs. Never an authority |
| `design-workshops\I-08B1-WS*\` folders | 5 | WS4, WS5, WS6, WS7, WS7R |
| Untracked Markdown reports at the root | 12 | `CW01_*` (5), `CW02_*` (3), `QANDEEL_CONNECTED_WORLDS_*` (3), `QANDEEL_VI03_03_*` (1) |
| Untracked files overall (outside `node_modules`, `.git`, `dist`) | ≈25,400 | mostly `.i08b*-work` outputs and extracted packages |

Every candidate archive was hashed (SHA-256). The hashes appear in the table in section B and in
each domain's `SOURCE-PROVENANCE.md`.

### Chronology by domain (last-write time, all 2026)

| Domain | Chain on disk (→ = later) |
|---|---|
| I-08B1 Living Analysis | WS4 (09-19 20:26) → WS5 → WS6 → WS7 (22:24) → WS7R (09-20 00:28) → NEAR baseline (01:58) → MID baseline, superseded (03:15) → MID WS7R-R (13:51) → FAR WS7R-F (14:32) → **CANONICAL-CLOSURE (14:33)** |
| I-08B2 Brand | B2.2 (09-20 15:08) → B2.2-REV1 (15:29) → B2.3 (16:14) → B2.4 (16:58) → **B2.5 (17:25)** |
| I-08B3.0 Typography | E1 comparative (18:25) → **E3 system (19:09)** |
| I-08B3.1-A | A1 (20:01) → A2 (20:50) → A2R (21:01) → A3 (21:32) → A3R (21:42) → **A3R2** (Library only) |
| I-08B3.1-B | B0 (22:19) → B0R (22:47) → B1 (23:48) → B1R (09-21 00:19) → B2 (08:57) → B2R (09:16) → B3 (10:28) → B3R (11:02) → B4 (11:37) → **B4R (12:35)** |
| I-08B3.1-C | C0 (18:23) → C0R (18:46) → C1 (19:28) → C1R (20:01) → C2 (20:56) → C3 (21:53) → **C3R** (Library only) |
| I-08B3.1-D | D0 (23:17) → D0R (23:53) → D1 (09-22 01:01) → D2 (02:46) → D2R (09:28) → **latest D2R** (Library only) |
| I-08B3.1-E | **E1, revised in place to E1R (11:14)** |
| I-08B3.1-F | **F1, revised in place to F1R and then F1R2 (13:35)** → F2, revised in place to F2R (09-23 01:05) → **F2 FINAL_CANONICAL** (Library only) |
| I-08B3.1-G1.1 | primary (10:08) → A1 speaker correction (10:56) → **R3 consolidated (12:31)** |
| I-08B3.1-G1.2 | **reviewed proof (14:30)** → **R1 source correction** (Library only) |

## B. Authority table (Phase B)

`PRESERVE FINAL` was the only decision that led to copying. The **evidence** column names the
strongest proof. Timestamps never decided anything.

| Domain / layer | Final authority candidate | SHA-256 | Closure evidence | Already in GitHub? | Decision |
|---|---|---|---|---|---|
| A · I-08B1 unified source + closure | `I-08B1-CANONICAL-CLOSURE.zip` | `9872271d7c7f8006078e076e164ade67dfe3f4151897887ddf870d80e1819c62` | `I-08B1-CANONICAL-STATE.md`: CLOSED / FROZEN. External manifest | No | **PRESERVE FINAL** |
| A · FAR | unified source + FAR manifest + reference hero | `279e4a10c8bec9b337443ea6a559ebada84e8a819b769316ced8b899818651df` (archive) | FAR manifest: APPROVED / FROZEN / CANONICAL | No | **PRESERVE FINAL** (source, manifest, hero, tools) |
| A · MID baseline `6d8efdbc…` | `I-08B1-MID-BASELINE-APPROVED-WS7R-R.zip` | `733d01750fbcb1553c4f53b36e99374abbe09136ddcea1713ac127864501fa15` | closure: baselines "NOT superseded" | No | **HISTORY REQUIRED** (baseline prototype + manifest) |
| A · NEAR baseline `7d7d5b55…` | `I-08B1-NEAR-BASELINE-APPROVED.zip` | `5a7f8e6d1a5e66b7bc4128c1894ff151b79b4849b13155fe80a5e415b81c85ea` | same | No | **HISTORY REQUIRED** (baseline prototype) |
| A · superseded MID `5225b460…` | `I-08B1-MID-BASELINE-APPROVED.zip` | `01fe469ceac18821bc9c468216cdf1ebb26b3ceb8355b7804dc1f2028c3c00f5` | closure: "SUPERSEDED MID … historical / non-canonical" | No | **SUPERSEDED — DO NOT PRESERVE** |
| A · WS4–WS7R workshops | `I-08B1-WS4.zip` … `I-08B1-WS7R.zip` | recorded in `zip` inventory | intermediate | No | **SUPERSEDED — DO NOT PRESERVE** |
| B · Brand | `I-08B2.5-FINAL-BRAND-ASSET-PACKAGE.zip` | `00c8082feb61674e374f6f374023e82878b85ce1c48fc3687374a5be900d962e` | package: final production review. Masters consumed by closed G1.1. B2.4 icon frozen and carried byte-identically | No | **PRESERVE FINAL** (no standalone brand closure record) |
| B · B2.2, B2.2-REV1, B2.3, B2.4 | four archives | `2dc8dcb2…b1f80c26`, `0635ba14…1f3a3a1a`, `74dec6db…36f84cf9`, `6faf74ba…c3b6f6f3` | outputs contained byte-identically in B2.5 | No | **SUPERSEDED — DO NOT PRESERVE** |
| C · Typography | `I-08B3.0-E3-TYPOGRAPHY-SYSTEM-PROOF.zip` | `f074d1057231ae4ad8550288a836f8e2e423fa1cda127458f117bb1eda0a78c5` | F1R2 ledger: "I-08B3.0 … FROZEN". Roles consumed by closed G1.1 | No | **PRESERVE FINAL** (no font binary) |
| C · E1 comparative proof | `I-08B3.0-E1-ARABIC-TYPOGRAPHY-COMPARATIVE-PROOF.zip` | `15f57f14848aa2e75f433a98fde04d580c8ed344e6e065aaff3e491c2cd86b4b` | face selection, restated by E3 | No | **SUPERSEDED — DO NOT PRESERVE** |
| D · Visual foundation | `I-08B3.1-A3R2-FINAL-STATUS-RECONCILIATION.zip` (Library) over `I-08B3.1-A3R-CANONICAL-STATE-CORRECTION.zip` | A3R2 `9663164db8325a6e3fff40f70264e9b07fb2196fbd388c1c73e7d96f30c03ee8`; A3R `01b1b3cd94c021ac5cf6f822110430abeaea7934eaf9666851cb90de49cdaa6c` | B4 freeze record: "I-08B3.1-A (already frozen)". Values in B4R tokens. A3R2 reconciles the status wording | No | **PRESERVE FINAL** (A3R2 applied) |
| D · A1, A2, A2R, A3 | four archives | `5c14a7af…968cf9e8`, `807331af…bd8e57e6`, `3dae620a…f77eea6f`, `603dc611…7fe17fd5` | superseded by A3R | No | **SUPERSEDED — DO NOT PRESERVE** |
| E · Surface | `I-08B3.1-B4R-DTCG-RESOLVER-CONFORMANCE-FINAL.zip` | `68fb674ba392cf308f86f6c4f05cb6a68c94607c9e59349f737f39ad9728ee76` | F1R2 ledger: "B4R Surface FROZEN". Tokens vendored byte-exact into closed G1.1 / G1.2 | No (the `UTTERANCE` amendment is) | **PRESERVE FINAL**. B2R2 / B3R2 exist in the Library and are **superseded by B4R — not promoted** |
| E · B0 … B4 | nine archives | see chronology | superseded by B4R | No | **SUPERSEDED — DO NOT PRESERVE** |
| F · Living Brass | `I-08B3.1-C3R-FINAL-CLOSURE-RECONCILIATION.zip` (Library) over `I-08B3.1-C3-LIVING-BRASS-PRODUCTION-SPEC-FREEZE.zip` | C3R `9380caba31799547b0f698ac0b1de014a011f8b2e48223df3588f7b2ba6ac288`; C3 `e4b6676366a050382d689737f97fdd264c7cad7999e3fa08bc7e9ede84a756c9` | C3R `C3_FINAL_CLOSURE_RECORD.md`: "I-08B3.1-C — LIVING BRASS MATERIAL SYSTEM — CLOSED / FROZEN". Tokens vendored byte-exact into closed G1.1 / G1.2 | No | **PRESERVE FINAL** (C3R applied). C0R2 exists in the Library and is **historical — not promoted** |
| F · C0 … C2 | five archives | see chronology | superseded by C3 | No | **SUPERSEDED — DO NOT PRESERVE** |
| G · QANDEEL Light | `I-08B3.1-D2R-QANDEEL-LIGHT-SYSTEM(2).zip` = `(3)` (Library; latest D2R) over the laptop's `I-08B3.1-D2R-QANDEEL-LIGHT-SYSTEM.zip` | latest `b0f039ec86b1c341f704fa3d444dee944d2b7101d6291698a03a59218c200888`; earlier `be89b41a011a67a39dfe20f732457801abf930ab0240ee819a4dd92d42829e1a` | F1R2 ledger: "D CLOSED / FROZEN (D2R governing)". D2R (not D2) tokens vendored into closed G1, identical in both D2R copies | No | **PRESERVE FINAL** (latest D2R applied: 8 documentation / verifier files) |
| G · D0, D0R, D1, D2 | four archives | D2 `6046b691d770db9914ac1235bead09d690a91fe313c10923df1862fb6e688851` | D2 rejected in part by D2R | No | **SUPERSEDED — DO NOT PRESERVE** |
| H · Interaction / semantic colour | `I-08B3.1-E1-INTERACTION-SYSTEM-SEMANTIC-COLOR.zip` (E1R state; the **only** copy) | `7bb00f86cf6b1762f373bb19c7811a85d3490a0d93e448cdf661e203483ebfc9` | F1R2 ledger: "E CLOSED / FROZEN (E1R governing)" | No | **PRESERVE FINAL** |
| I · Accessibility F1 | `I-08B3.1-F1-ACCESSIBILITY-TRANSFORMATIONS-SEMANTIC-PARITY.zip` (F1R2 state) | `48bdbf9dfd6bc66db80f4217b6c7ecb4503407322b67760f27ee02a1a84179ce` | F1 CLOSED / FROZEN (F2 brief; PR #265 reconciliation). Consumed byte-exact by closed G1 | No | **PRESERVE FINAL** |
| I · Light appearance F2 | `I-08B3.1-F2-…-INTEGRATION_FINAL_CANONICAL.zip` (Library) over the laptop's F2R `I-08B3.1-F2-…-INTEGRATION.zip` | FINAL_CANONICAL `6ca4744d5402108f67edf629fd45b7d3e1290391d50d0f73647b009b3dff8aaa`; F2R `e2a358aa06da69935cac7a316ce4c7abe77f3564073c85e946ca0dc947ff4d13` | **F2 and I-08B3.1-F CLOSED / FROZEN**, recorded by the PR #265 reconciliation instructions. Tokens identical to F2R and consumed byte-exact by closed G1 | No | **PRESERVE FINAL** (FINAL_CANONICAL applied; F2R superseded) |
| J · Matching runtime | `docs/matching-introduction-runtime-v1.md` | — | `**Phase:** I-07 — CLOSED / FROZEN` | **Yes** | **ALREADY DURABLE** |
| J · Matching Product / visual layers | none found | — | — | — | **NOT FOUND LOCALLY.** Nothing preserved and nothing invented |
| K · Replay runtime | `docs/replay-runtime-v1.md` | — | `**Phase:** I-06 — CLOSED / FROZEN` | **Yes** | **ALREADY DURABLE** |
| K · Replay placement | G1.1 closure §1 + R3 source | `0a56a2fb…b434fbcd` | G1.1 CLOSED / FROZEN | closure yes, source no | **PRESERVE FINAL** (as part of G1.1) |
| K · Replay selection | R3 proof screens | — | proof only. `QAN-BL-NAV-02` open | — | **OPEN — DO NOT CANONICALIZE** |
| K · Replay preview / player, render / export, return / source anchor | none found | — | — | — | **OPEN — NO LOCAL SOURCE** |
| K · Replay media | — | — | `QAN-BL-VOICE-01`, `QAN-BL-NAV-02` open | backlog yes | **OPEN — DO NOT CANONICALIZE** |
| L · G1.1 | `…G1.1-R3-CONSOLIDATED-…-CORRECTION.zip` | `0a56a2fbc836168f16fbb3860b1847002e1bdfb376188c7ce0e6b459b434fbcd` | **equals** the closure-recorded hash | closure yes, source no | **PRESERVE FINAL** |
| L · G1.1 primary, G1.1-A1 | two archives | `435a946d…0ba04fac`, `0a7cff44…498b2372` | superseded by R3 | No | **SUPERSEDED — DO NOT PRESERVE** |
| L · G1.2 reviewed proof | `…G1.2-VOICE-LIVE-CONVERSATION-BACKGROUND-SAFE-PROOF.zip` | `1b297be9402960928dfc85574cdf7fc3a88b1c59e6777af806e5a1d9f7ec3e96` | **equals** the closure-recorded reviewed-proof hash | closure yes, source no | **PRESERVE FINAL** (behavioural evidence of record) |
| L · G1.2 R1 correction | `QANDEEL_I-08B3.1-G1.2-R1_DIRECT_CORRECTION.zip` (Library) | `2e5e0ac41b44be19b5a773aec3a8da060b4a5f5221ef6cb0d1999146f8d23e11`, **equal** to the closure-recorded R1 hash | G1.2 closure §9. `R1_SOURCE_PATCH.diff` reproduces the R1 source from the reviewed source | closure yes, source now yes | **PRESERVE FINAL** (R1 source + R1 record) |
| M · Connected Worlds assurance (`QANDEEL_CONNECTED_WORLDS_*_v1.md`, 3 files) | root, untracked | — | "COMPLETE — REMEDIATION REQUIRED". Findings admitted to the backlog as `ASSURE-F0x` and being remediated (`QAN-CW-REM-0x`) | findings yes, reports no | **OPEN — DO NOT CANONICALIZE.** Not a Product / design artifact. **Single-copy risk reported** |
| M · CW-01 / CW-02 architecture reports (8 files) | root, untracked | — | each says "NOT FROZEN / NOT SELF-APPROVED" | No | **OPEN — DO NOT CANONICALIZE.** Candidates, not authority |
| M · Phase VI-03-03 brief, VI-03-04 / 04R archives | root, untracked | `7baa25a1…f547dd17`, `433da977…898585b0` | exploration, superseded by I-08B1 | No | **SUPERSEDED — DO NOT PRESERVE** |
| M · `E:\QANDEEL\QANDEEL DOCUMENTS\QANDEEL_CANONICAL_CORE_CHECKPOINT_v2.md` and the Navigation Canonical Checkpoint | **outside the declared root**. G1.1's SOURCE_TRACE cites them as out-of-repo canon | — | canonical (per G1.1) | No | **REPORTED, NOT PRESERVED.** Outside this task's root, and needs a Product Owner decision |

No other local `CLOSED / FROZEN`, `CANONICAL CLOSURE`, `FINAL CANONICAL`, `FREEZE COMPLETE`,
`APPROVED BASELINE`, `CANONICAL STATE` or `PRODUCTION SPEC FREEZE` authority was found under the
root beyond the rows above. The phrases occur elsewhere only inside the packages already classified,
in their build outputs, or in tracked repository files.

## C. Named packages the brief expected

Each was searched for by name (`*A3R2*`, `*B2R2*`, `*B3R2*`, `*C0R2*`, `*C3R*`, `*FINAL_CANONICAL*`,
`*FINAL-CANONICAL*`, `*(1)*`, `*(2)*`, `*(3)*`, `*R1*`) across `E:\QANDEEL\QANDEEL PROJECT`
(recursive), `E:\QANDEEL` (top level) and Downloads, and none exists on the laptop. Independent
review then found the ones below in the project's ChatGPT Library (section F).

| Expected | Where it is | Outcome |
|---|---|---|
| `I-08B3.1-A3R2 FINAL-STATUS-RECONCILIATION` | Library, `9663164d…30c03ee8` | **applied**: A's status wording is reconciled |
| `I-08B3.1-B2R2`, `I-08B3.1-B3R2` | Library | **not promoted**: B4R supersedes that proof chain |
| `I-08B3.1-C3R FINAL-CLOSURE-RECONCILIATION` | Library, `9380caba…b2ba6ac288` | **applied**: C is CLOSED / FROZEN by its closure record |
| `I-08B3.1-C0R2` | Library | **not promoted**: historical foundation; C3R is the final closure |
| `D2R` copies `(2)`, `(3)` | Library; byte-identical, `b0f039ec…218c200888` | **applied** as the latest D2R. No choice by name was needed |
| E1 later duplicate / correction copy | one E1 (E1R state) only | none. E1R `7bb00f86…483ebfc9` was already correct and is unchanged |
| F1 multiple revisions | revised **in place**. One archive only | none |
| `…F2-…-INTEGRATION_FINAL_CANONICAL.zip` | Library, `6ca4744d…3dff8aaa` | **applied**: F is CLOSED / FROZEN |
| G1.2 R1 correction ZIP `2e5e0ac4…` | Library, hash equal to the closure's | **applied**: R1 source and record preserved |

## D. Files intentionally excluded from preserved packages

Excluded under the final-only policy and still present in the sealed archives: review boards, frame
captures and contact sheets, proof screens, motion recordings (MP4), and upstream font binaries
(`Estedad[wght].ttf`, `Estedad-wght-v8.5.{ttf,woff2}`). The loose F1 folder's `review/src/**`
(84 files added after sealing) was also left out. Each domain's `SOURCE-PROVENANCE.md` lists what
was left in its archive, with size.

## E. Remaining single-copy risk after this branch

Laptop-only, and **not** represented in Git by this change:

1. All 52 archives, including the excluded review / motion evidence of every final package. The
   largest are G1.2 (97.4 MB) and G1.1-R3 (34.1 MB), whose proof renders and MP4s are each closure's
   visual evidence of record.
2. The superseded chains listed in section B, by policy.
3. The Connected Worlds assurance reports and the CW-01 / CW-02 reports at the root.
4. `E:\QANDEEL\QANDEEL DOCUMENTS\` canon (core and navigation checkpoints, backend contract
   `.docx` set), which is outside this task's root.
5. The five Library-only archives of section F. Their **final changed files** are now in Git, but the
   archives themselves (including A3R2's, C3R's, D2R's and F2's review renders and the G1.2 R1
   rebuilt prototypes) are not on the laptop and not in Git.
6. The G1.2 R1-rebuilt prototype HTML. The R1 archive carries only the corrected source, so the
   preserved `product-proofs/g1.2/prototype/*.html` are the pre-R1 build.

## F. PR #265 final-authority reconciliation (independent review)

Independent review supplied `QANDEEL_PR265_FINAL_AUTHORITY_RECONCILIATION_PATCH.zip` (179,475 B,
`a3580fc3fbca66a559b29fb0b1e4120a4118271eada4fc6ed289a019b9e00746`). Its `APPLY_INSTRUCTIONS.md` and
`PATCH_MANIFEST.json` are preserved byte-exact in `reconciliation/pr265-final-authority/`. It
carries only the final-authority delta: 27 files at their repository paths (21 replacing preserved
files, 6 new).

| Domain | Files | Change |
|---|---:|---|
| Visual Foundation (A3R2) | 3 | `docs/A3R2_REVISION_RECORD.md` new; `docs/A3_MANIFEST.md`, `tools/a3-package.mjs` status reconciliation |
| Living Brass (C3R) | 4 | `docs/C3_FINAL_CLOSURE_RECORD.md` new; manifest self-hash removed from `data/C3_MANIFEST.json`, `docs/C3_MANIFEST.md`, `tools/c3-manifest.mjs` |
| QANDEEL Light (latest D2R) | 8 | three stale documentary sentences corrected, final-review cleanup recorded, guard S6 strengthened, manifests re-hashed |
| Light Appearance (F2 FINAL_CANONICAL) | 5 | freeze-candidate split finalised, probe count, manifests re-hashed, one Chrome-launcher tool change in `vendor/f1/`; its 2 changed `review/` files are excluded by policy |
| G1.2 (R1) | 7 | `source/src/{build.mjs, content.mjs, runtime.js}` replaced with R1; `r1/` record, patch, checks and manifest new |

**Verification that ran:**

- all 27 supplied files re-hashed against `PATCH_MANIFEST.json`: size and SHA-256 match, 0 extras;
- `R1_SOURCE_PATCH.diff` applied to the reviewed G1.2 source reproduces the three R1 files byte for
  byte, and `R1_MANIFEST.json` names the preserved reviewed-proof ZIP `1b297be9…f7ec3e96` as its
  parent;
- each recovered package's own manifest (A3R2 `A3_MANIFEST.md`, C3R `C3_MANIFEST.json`, D2R
  `D2_MANIFEST.json`, F2 `F2_MANIFEST.json`) matches every preserved file in its domain, apart from
  the manifests' entries for themselves, a pattern the earlier sealed packages already had;
- the G1.2 closure and backlog on `main` record the same R1 hash;
- the four other archive hashes could **not** be recomputed, because the archives are not on this
  host. They are the hashes the patch records.

## G. Later disposition (2026-09-24, recovered canonical authority preservation)

Sections A–F above are the audit as it stood on 2026-09-23. They are left as written. A later preservation
changed the state of some rows and single-copy risks:

| Row / risk | Then | Now |
|---|---|---|
| M · `QANDEEL_CANONICAL_CORE_CHECKPOINT_v2.md` and the Navigation Canonical Checkpoint | **REPORTED, NOT PRESERVED** (outside that task's root) | **Preserved** byte-exact in [`docs/canonical-authority/experience-architecture/`](../../canonical-authority/CANONICAL_AUTHORITY_INDEX.md): Core Checkpoint v2 as historical upstream authority; the Navigation Checkpoint as the Stage 0–4 chain |
| M · Connected Worlds assurance: `QANDEEL_CONNECTED_WORLDS_ASSURANCE_FINDINGS_v1.md` | **OPEN — DO NOT CANONICALIZE**, single-copy risk | **Preserved as assurance evidence only**, not canonicalized, in [`docs/assurance/connected-worlds/`](../../assurance/connected-worlds/README.md). `ASSURE-F05` is admitted to the backlog as `QAN-BL-CW-01`. The other two assurance reports are still not in Git |
| M · CW-01 / CW-02 architecture reports | **OPEN — DO NOT CANONICALIZE** | **Unchanged.** They are not admitted. The frozen CW2-00 … CW2-08 chain that superseded them is preserved in [`docs/canonical-authority/connected-worlds-v2/`](../../canonical-authority/connected-worlds-v2/CW2_SOURCE_PROVENANCE.sha256) |
| E.3 / E.4 single-copy risk | laptop only | partly retired: the core and navigation checkpoints and the assurance register are now in Git. The backend contract `.docx` set, the other assurance reports and the CW-01 / CW-02 reports remain laptop-only |
