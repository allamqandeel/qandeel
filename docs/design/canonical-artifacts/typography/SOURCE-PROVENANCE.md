# Source provenance — I-08B3.0-E3 Typography System

## Authority

| Evidence | Value |
|---|---|
| Final package | `I-08B3.0-E3-TYPOGRAPHY-SYSTEM-PROOF`, the last I-08B3.0 package on the host. It follows `I-08B3.0-E1-ARABIC-TYPOGRAPHY-COMPARATIVE-PROOF`, which selected the face |
| Downstream freeze ledger | `accessibility-appearance/i-08b3.1-f1r2/README.md`, "Inheritance": `I-08B3.0  visual foundation  FROZEN` |
| Downstream use | the closed **G1.1** proof takes "the I-08B3.0-E3 type roles" as its typography authority (G1.1 SOURCE_TRACE §2) |
| Package self-status | `docs/I-08B3.0-E3_REVIEW_MANIFEST.md`: "READY FOR DESIGN DIRECTOR TYPOGRAPHY FREEZE REVIEW" |

**Lifecycle, stated exactly.** The later ledger records the freeze. **No standalone typography freeze
record exists on this host.** The package's single blocking clarification was whether leading is
a unitless multiple of size or an absolute value. It is recorded in the report. G1.1's source
trace applies "leading as a unitless multiple".

## Font binary policy

No font binary is added. `main` carries no font assets and no font-asset policy. The package
itself chose not to redistribute the binary (see `fonts-info/README.md`). Identity is recorded
instead: Estedad `Version 8.5`, upstream release tag `8.5`, `Estedad[wght].ttf`, 284,180 B,
SHA-256 `3134e31a27d58e615967e714c7799fbfa2de952876f8597b33dc57ffe0e99d03`, SIL OFL 1.1
(`fonts-info/LICENSE-OFL.txt`). The Google Fonts copy is **not** byte-identical to it.

## Source archive (local, not in Git)

| Archive | Size (B) | Entries | SHA-256 |
|---|---:|---:|---|
| `E:\QANDEEL\QANDEEL PROJECT\I-08B3.0-E3-TYPOGRAPHY-SYSTEM-PROOF.zip` | 13,283,817 | 37 | `f074d1057231ae4ad8550288a836f8e2e423fa1cda127458f117bb1eda0a78c5` |

23 files were preserved, each byte-identical to its archive entry and to the loose folder. Hashes are
in [`SOURCE-PROVENANCE.sha256`](SOURCE-PROVENANCE.sha256).

## Deliberately not preserved

- `review/*.png`: 14 review boards, 13.98 MB, kept in the archive.
- `I-08B3.0-E1-ARABIC-TYPOGRAPHY-COMPARATIVE-PROOF(.zip)` (8,379,728 B,
  `15f57f14848aa2e75f433a98fde04d580c8ed344e6e065aaff3e491c2cd86b4b`): the comparative proof that
  chose the face. It is **superseded**, because the E3 report re-states what it relies on and five
  candidate faces' boards are not needed to use the system.
- `.i08b3-work\raw\Estedad-v8.5.zip`: the upstream font release, recorded by hash above.

## Later amendments

- **I-08B3.1-F1R2 REV-05** (preserved in `accessibility-appearance/`) makes the Arabic outcome the
  contract (`text.arabic-must-not-clip`). The numeric 1.6 leading floor becomes a production default
  serving it, and the measured minimum is 1.7.
- VI-01 language contracts on `main` are not affected.
