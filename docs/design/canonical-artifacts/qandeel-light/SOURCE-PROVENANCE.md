# Source provenance — I-08B3.1-D2R QANDEEL Light

## D2 / D2R authority resolution

| Question | Finding |
|---|---|
| How many D2R copies exist on this host? | **One**: `I-08B3.1-D2R-QANDEEL-LIGHT-SYSTEM.zip` plus its extracted folder. **No `(1)`, `(2)` or `(3)` duplicate exists** under `E:\QANDEEL\QANDEEL PROJECT`, `E:\QANDEEL` or Downloads, so no copy had to be chosen by name or timestamp |
| Is the ZIP the reviewed D2R state? | Yes. SHA-256 `be89b41a…42829e1a`, 13,594,553 B, 88 entries, the state that includes the final closure-consistency repair (guard S6) |
| D2 or D2R? | **D2R.** The `illumination` base and dark tokens vendored **byte-exact** into the closed G1.1-R3 and G1.2 sources match **D2R's** files and **not** D2's (D2 base is 13,641 B; D2R base is 30,299 B) |
| Is D closed? | `accessibility-appearance/i-08b3.1-f1r2/README.md`, "Inheritance": `I-08B3.1-D  QANDEEL Light  CLOSED / FROZEN  (D2R is the governing state)`. F1R2 adds: "I-08B3.1-D — QANDEEL LIGHT SYSTEM is CLOSED / FROZEN" |
| Package self-status | `D2R_FREEZE_CANDIDATE.md`: "This package does not declare anything frozen." Its sealed bytes keep the language they were authored with, and later packages record the freeze |
| Four categories intact? | Yes. `D2R_FREEZE_CANDIDATE.md` §1 lists A · AMBIENT, B · CONNECTION, C · PATTERN and D · INSIGHT, and `tokens/base/illumination.tokens.json` carries all four. Nothing here reinterprets them |

## Source archive (local, not in Git)

| Archive | Size (B) | Entries | SHA-256 |
|---|---:|---:|---|
| `E:\QANDEEL\QANDEEL PROJECT\I-08B3.1-D2R-QANDEEL-LIGHT-SYSTEM.zip` | 13,594,553 | 88 | `be89b41a011a67a39dfe20f732457801abf930ab0240ee819a4dd92d42829e1a` |

58 files were preserved: every document, `data/`, `tokens/`, `prototypes/` and `source/`. Each is
byte-identical to its archive entry and to the loose folder. Hashes are in
[`SOURCE-PROVENANCE.sha256`](SOURCE-PROVENANCE.sha256).

## Deliberately not preserved

- `video/*.mp4` (9 motion recordings, standard and Reduced Motion) and `frames/**` (stills, contact
  sheets and proof boards): 14.67 MB, kept in the archive. `data/D2_MANIFEST.json` records every one
  by hash, and the prototype plus `source/tools/` regenerate them.
- `I-08B3.1-D2-QANDEEL-LIGHT-SYSTEM(.zip)` (13,005,514 B,
  `6046b691d770db9914ac1235bead09d690a91fe313c10923df1862fb6e688851`): **superseded and rejected
  in part.** D2's invented geometry semantics and its PATTERN expression were removed by D2R.
- D0 (motion language), D0R (guided-thread P2 correction) and D1 (arrival) packages: **superseded**
  diagnostic proofs. D1's scene code that D2R still runs is vendored in `source/vendor/d1/`.

## Later amendments (binding)

- **I-08B3.1-F1R2** reads D2R's `PRESENTATION_CONTRACT` (`encodes: null` properties) as its
  depth-cue authority. D2R is not changed.
- **I-08B3.1-F2R** fills D2R's declared-empty `light` context
  (`accessibility-appearance/i-08b3.1-f2r/tokens/appearance/light/d2r.light.illumination.tokens.json`)
  and adds the light meaning-event technique. **The dark appearance does not move.**
- Device validation is a mandatory **implementation** gate, not a D freeze blocker (D2R).
