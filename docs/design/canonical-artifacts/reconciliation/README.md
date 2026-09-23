# PR #265 final-authority reconciliation

`pr265-final-authority/` holds, byte-exact, the two instrument files of
`QANDEEL_PR265_FINAL_AUTHORITY_RECONCILIATION_PATCH.zip` (179,475 B, SHA-256
`a3580fc3fbca66a559b29fb0b1e4120a4118271eada4fc6ed289a019b9e00746`). Independent review supplied that
patch after the laptop-only audit, because five final authorities that the laptop did not hold are
preserved in the project's ChatGPT Library.

- `APPLY_INSTRUCTIONS.md`: the corrections, the archives they come from, and the recorded final
  lifecycle. It is **the only record in this directory of the I-08B3.1-F closure** (F1, F2 and F all
  CLOSED / FROZEN). The FINAL_CANONICAL package's own bytes keep their candidate wording.
- `PATCH_MANIFEST.json`: every supplied file's destination, status (`new` / `changed`), size and
  SHA-256, plus the six source archives' sizes and hashes.

They are kept as provenance, not as a design authority. Each affected domain's `SOURCE-PROVENANCE.md`
says what the patch changed there and how it was checked:

| Domain | Final authority applied | Archive SHA-256 |
|---|---|---|
| Visual Foundation | A3R2 final-status reconciliation | `9663164db8325a6e3fff40f70264e9b07fb2196fbd388c1c73e7d96f30c03ee8` |
| Living Brass | C3R final closure (C CLOSED / FROZEN) | `9380caba31799547b0f698ac0b1de014a011f8b2e48223df3588f7b2ba6ac288` |
| QANDEEL Light | latest D2R (`(2)` = `(3)`) | `b0f039ec86b1c341f704fa3d444dee944d2b7101d6291698a03a59218c200888` |
| Light Appearance | F2 FINAL_CANONICAL (F CLOSED / FROZEN) | `6ca4744d5402108f67edf629fd45b7d3e1290391d50d0f73647b009b3dff8aaa` |
| G1.2 | R1 corrected source | `2e5e0ac41b44be19b5a773aec3a8da060b4a5f5221ef6cb0d1999146f8d23e11` |

**Deliberately not promoted:** B2R2 and B3R2, which B4R supersedes, and C0R2, which is historical
foundation; C3R is the final Living Brass closure. E1 was already correct (E1R state,
`7bb00f86…483ebfc9`) and is unchanged.

**What could and could not be checked here.** The five archives are not on the laptop, so their
hashes are the ones the patch records and were not recomputed. Every supplied file was re-hashed
against `PATCH_MANIFEST.json`, and three checks independent of it also ran:

- the R1 source patch reproduces the R1 source from the reviewed G1.2 source;
- each recovered package's own manifest (A3R2, C3R, D2R, F2 FINAL_CANONICAL) matches every preserved
  file in its domain, apart from each manifest's entry for itself;
- the G1.2 closure on `main` records the same R1 hash.
