# Source provenance — I-08B3.1-C3 Living Brass

## Authority

| Evidence | Value |
|---|---|
| Final package | **`I-08B3.1-C3R-FINAL-CLOSURE-RECONCILIATION`**, applied over the local C3 package. Chain: C0 → C0R → C1 → C1R → C2 → C3 → **C3R** |
| Closure record | `i-08b3.1-c3/docs/C3_FINAL_CLOSURE_RECORD.md`: "I-08B3.1-C3 — CLOSED / ACCEPTED" and "**I-08B3.1-C — LIVING BRASS MATERIAL SYSTEM — CLOSED / FROZEN**". It is additive: the executor's pre-freeze `C3_FREEZE_RECORD.md` is not rewritten |
| What C3R changed | bookkeeping only. C3's `data/C3_MANIFEST.json` hashed itself, which cannot stay stable after serialisation, so the final package excludes both manifest outputs from the hashed set (`data/C3_MANIFEST.json`, `docs/C3_MANIFEST.md`, `tools/c3-manifest.mjs`). No token, source value, raster, composition or decision changed |
| Canonical freeze content | dark body `#A58E6F`; QUIET SATIN at ordinary scale; restrained BRUSHED / HANDLED only for rare large identity expression; coverage P2 — IDENTITY MACHINERY FAMILY; Living Brass is state-invariant; permission by class, not by a size threshold (the proof-era `96 px` is not canonical) |
| Explicitly not frozen by C | QANDEEL Light, Light-appearance Brass, interaction / status / focus / disabled expressions, final navigation geometry and motion, final icon geometry, lantern animation, Q-thread expression, final accessibility transformations |
| Downstream agreement | `accessibility-appearance/i-08b3.1-f1r2/README.md`: `I-08B3.1-C3  Living Brass  FROZEN`. C3 `material` base and dark tokens are vendored **byte-exact** into the closed G1.1-R3 and G1.2 sources |
| Consistency check | C3R's own `data/C3_MANIFEST.json` lists 78 files with SHA-256. All 69 of them that are preserved here match byte for byte; the other 9 are the excluded `review/proof/` renders. The two preserved files it does not list are the manifests themselves, which C3R deliberately excludes |

**Lifecycle, stated exactly.** **CLOSED / FROZEN**, by C3R's closure record.

## Source archives (not in Git)

| Archive | Where | Size (B) | SHA-256 |
|---|---|---:|---|
| `I-08B3.1-C3-LIVING-BRASS-PRODUCTION-SPEC-FREEZE.zip` | `E:\QANDEEL\QANDEEL PROJECT\` | 1,579,362 | `e4b6676366a050382d689737f97fdd264c7cad7999e3fa08bc7e9ede84a756c9` |
| `I-08B3.1-C3R-FINAL-CLOSURE-RECONCILIATION.zip` | project ChatGPT Library (recovered by independent review; **not on the laptop**) | 1,580,100 | `9380caba31799547b0f698ac0b1de014a011f8b2e48223df3588f7b2ba6ac288` |

71 files are preserved. 67 are byte-identical to their C3 archive entry and to the loose folder. The
four C3R files (`docs/C3_FINAL_CLOSURE_RECORD.md`, `data/C3_MANIFEST.json`, `docs/C3_MANIFEST.md`,
`tools/c3-manifest.mjs`) came through the PR #265 reconciliation patch
(`../reconciliation/pr265-final-authority/`) and match its `PATCH_MANIFEST.json`. The C3R archive
hash above is the one that patch records; it was not re-hashed here because the archive is not on
this host. Hashes are in [`SOURCE-PROVENANCE.sha256`](SOURCE-PROVENANCE.sha256).

## Deliberately not preserved

- `review/proof/*.png`: 9 token-proof renders, 1.42 MB, kept in the archive.
- C0, C0R, C1, C1R and C2 packages and ZIPs: **superseded** contract, visual-proof and integration
  chain. C3 carries the surviving specification. Its `vendor/c2/` keeps only the C2 model code its
  tools execute.
- `I-08B3.1-C0R2-FINAL-CLOSURE-RECONCILIATION.zip`: recovered by independent review but **not
  promoted**. It is historical foundation; C3R is the final Living Brass closure.

## Later amendments (binding)

- **I-08B3.1-E1R** (preserved in `interaction-semantic-color/`). The disabled-ink collision as
  restated in `C3_FREEZE_RECORD.md` §4.2 and `C3_ICONOGRAPHY_MATERIAL_CONTRACT.md` §6.4 does not
  survive measurement. E1R closes the real collision through availability semantics and narrows
  the rule to **"LIVING BRASS IS STATE-INVARIANT IN VALUE AND IN APPEARANCE"**. No C3 value moves.
- **I-08B3.1-F2 (FINAL_CANONICAL)** fills C3's declared-empty `light` context
  (`accessibility-appearance/i-08b3.1-f2r/tokens/appearance/light/c3.light.material.tokens.json`,
  Light-appearance Brass `#7a6446`).
