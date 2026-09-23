# Source provenance — I-08B3.1-C3 Living Brass

## Authority

| Evidence | Value |
|---|---|
| Final local package | `I-08B3.1-C3-LIVING-BRASS-PRODUCTION-SPEC-FREEZE`. Chain on the host: C0 → C0R → C1 → C1R → C2 → **C3** |
| Downstream freeze ledger | `accessibility-appearance/i-08b3.1-f1r2/README.md`: `I-08B3.1-C3  Living Brass  FROZEN` |
| Downstream use | C3 `material` base and dark tokens are vendored **byte-exact** into the closed G1.1-R3 and G1.2 sources. G1.1's source trace: `qandeel.navigation.machinery` → `qandeel.identity.material` → `#a58e6f`, "at EVERY state" |
| Package self-status | `docs/C3_FREEZE_RECORD.md`: "STATUS: NOT YET FROZEN. C3 proposes. The Design Director freezes." |

**Lifecycle, stated exactly.** FROZEN per the downstream ledger. **The `C0R2` and `C3R
FINAL-CLOSURE-RECONCILIATION` packages named by the preservation brief are NOT on this host.** A
recursive search found them under neither the project root, `E:\QANDEEL` nor Downloads. If C3R
exists elsewhere, it is the closure wording for C, and this record should be reconciled against it.
The token files the closed G1 proofs consume are the ones preserved here.

## Source archive (local, not in Git)

| Archive | Size (B) | Entries | SHA-256 |
|---|---:|---:|---|
| `E:\QANDEEL\QANDEEL PROJECT\I-08B3.1-C3-LIVING-BRASS-PRODUCTION-SPEC-FREEZE.zip` | 1,579,362 | 79 | `e4b6676366a050382d689737f97fdd264c7cad7999e3fa08bc7e9ede84a756c9` |

70 files were preserved, each byte-identical to its archive entry and to the loose folder. Hashes are
in [`SOURCE-PROVENANCE.sha256`](SOURCE-PROVENANCE.sha256).

## Deliberately not preserved

- `review/proof/*.png`: 9 token-proof renders, 1.42 MB, kept in the archive.
- C0, C0R, C1, C1R and C2 packages and ZIPs: **superseded** contract, visual-proof and integration
  chain. C3 carries the surviving specification. Its `vendor/c2/` keeps only the C2 model code its
  tools execute.

## Later amendments (binding)

- **I-08B3.1-E1R** (preserved in `interaction-semantic-color/`). The disabled-ink collision as
  restated in `C3_FREEZE_RECORD.md` §4.2 and `C3_ICONOGRAPHY_MATERIAL_CONTRACT.md` §6.4 does not
  survive measurement. E1R closes the real collision through availability semantics and narrows
  the rule to **"LIVING BRASS IS STATE-INVARIANT IN VALUE AND IN APPEARANCE"**. No C3 value moves.
- **I-08B3.1-F2R** fills C3's declared-empty `light` context
  (`accessibility-appearance/i-08b3.1-f2r/tokens/appearance/light/c3.light.material.tokens.json`).
