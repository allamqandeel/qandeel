# Source provenance — I-08B3.1-D2R QANDEEL Light

## D2 / D2R authority resolution

| Question | Finding |
|---|---|
| Which D2R state is final? | **The latest D2R, archive SHA-256 `b0f039ec86b1c341f704fa3d444dee944d2b7101d6291698a03a59218c200888`** (13,595,775 B). It exists as `I-08B3.1-D2R-QANDEEL-LIGHT-SYSTEM(2).zip` and `…(3).zip` in the project ChatGPT Library, and the two are byte-identical, so no copy was chosen by name. It was recovered by independent review and is **not on the laptop** |
| What does it change against the laptop's D2R (`be89b41a…42829e1a`)? | 8 files, documentation and the verifier only. Three stale documentary sentences are corrected: one described contour morphology as a permanent topic identity, and two Truth Audit rows implied depth-as-time and shape-as-identity. `D2R_CORRECTION.md` gains a "FINAL INDEPENDENT REVIEW CLEANUP" section. `source/tools/d2-verify.mjs` strengthens guard **S6** to scan the shipped final-state documents line by line. `data/D2_MANIFEST.json` and `D2R_MANIFEST.md` re-hash the changed files. **No scene, token, motion, prototype, still or film changed** |
| Was that verified here? | Yes, against the package's own manifest. The final `data/D2_MANIFEST.json` lists 87 files with SHA-256. All 56 of them that are preserved here match byte for byte, including every token, prototype and scene file. 30 are the excluded `frames/` and `video/` files. The one remaining entry is the manifest's hash of itself, which cannot match, and the same was true of the earlier D2R. The package's "11/11 state + semantic checks, 10/10 planted probes" result was **not** re-run here |
| D2 or D2R? | **D2R.** The `illumination` base and dark tokens vendored **byte-exact** into the closed G1.1-R3 and G1.2 sources match **D2R's** files and **not** D2's (D2 base is 13,641 B; D2R base is 30,299 B). Those token files are identical in both D2R copies |
| Is D closed? | `accessibility-appearance/i-08b3.1-f1r2/README.md`, "Inheritance": `I-08B3.1-D  QANDEEL Light  CLOSED / FROZEN  (D2R is the governing state)`. The F2 FINAL_CANONICAL README repeats `I-08B3.1-D2R  QANDEEL Light  CLOSED / FROZEN` |
| Package self-status | `D2R_FREEZE_CANDIDATE.md`: "This package does not declare anything frozen." Its bytes keep the language they were authored with, and later packages record the freeze |
| Four categories intact? | Yes. `D2R_FREEZE_CANDIDATE.md` §1 lists A · AMBIENT, B · CONNECTION, C · PATTERN and D · INSIGHT, and `tokens/base/illumination.tokens.json` carries all four. Nothing here reinterprets them |

## Source archives (not in Git)

| Archive | Where | Size (B) | SHA-256 | Role |
|---|---|---:|---|---|
| `I-08B3.1-D2R-QANDEEL-LIGHT-SYSTEM(2).zip` = `…(3).zip` | project ChatGPT Library | 13,595,775 | `b0f039ec86b1c341f704fa3d444dee944d2b7101d6291698a03a59218c200888` | **final** |
| `I-08B3.1-D2R-QANDEEL-LIGHT-SYSTEM.zip` | `E:\QANDEEL\QANDEEL PROJECT\` | 13,594,553 | `be89b41a011a67a39dfe20f732457801abf930ab0240ee819a4dd92d42829e1a` | earlier D2R; source of the 50 unchanged files |

58 files are preserved: every document, `data/`, `tokens/`, `prototypes/` and `source/`. 50 are
byte-identical to their entry in the laptop's D2R archive and to the loose folder. The 8 changed
files came through the PR #265 reconciliation patch (`../reconciliation/pr265-final-authority/`) and
match its `PATCH_MANIFEST.json`. The final archive hash above is the one that patch records; it was
not re-hashed here because the archive is not on this host. Hashes are in
[`SOURCE-PROVENANCE.sha256`](SOURCE-PROVENANCE.sha256).

## Deliberately not preserved

- `video/*.mp4` (9 motion recordings, standard and Reduced Motion) and `frames/**` (stills, contact
  sheets and proof boards): 14.67 MB, kept in the archive. `data/D2_MANIFEST.json` records every one
  by hash, and the prototype plus `source/tools/` regenerate them.
- The earlier D2R state (`be89b41a…42829e1a`) as a separate copy: **superseded** by the final D2R
  for the 8 changed files. Its other 50 files are the final bytes.
- `I-08B3.1-D2-QANDEEL-LIGHT-SYSTEM(.zip)` (13,005,514 B,
  `6046b691d770db9914ac1235bead09d690a91fe313c10923df1862fb6e688851`): **superseded and rejected
  in part.** D2's invented geometry semantics and its PATTERN expression were removed by D2R.
- D0 (motion language), D0R (guided-thread P2 correction) and D1 (arrival) packages: **superseded**
  diagnostic proofs. D1's scene code that D2R still runs is vendored in `source/vendor/d1/`.

## Later amendments (binding)

- **I-08B3.1-F1R2** reads D2R's `PRESENTATION_CONTRACT` (`encodes: null` properties) as its
  depth-cue authority. D2R is not changed.
- **I-08B3.1-F2 (FINAL_CANONICAL)** fills D2R's declared-empty `light` context
  (`accessibility-appearance/i-08b3.1-f2r/tokens/appearance/light/d2r.light.illumination.tokens.json`,
  meaning family `#fff6df` / `#ddd4be` / `#bcb39e`) and adds the light meaning-event technique.
  **The dark appearance does not move.**
- Device validation is a mandatory **implementation** gate, not a D freeze blocker (D2R).
