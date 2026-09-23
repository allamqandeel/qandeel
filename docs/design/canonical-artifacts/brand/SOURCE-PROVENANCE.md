# Source provenance — I-08B2.5 Brand (Q mark, wordmark, app icon)

## Authority

| Evidence | Value |
|---|---|
| Final package | `I-08B2.5-FINAL-BRAND-ASSET-PACKAGE`. It is the last brand package on the host, and the chain B2.2 → B2.2-REV1 → B2.3 → B2.4 → B2.5 ends here |
| Containment, re-verified by hash | the four `masters/*.svg` are **byte-identical** to I-08B2.3's `masters/`. `app-icon/APP_ICON_B_DARK_LUMINOUS.svg` (`859665d86a7bbf4248ff479034031a8df1f08833c7db36336b3d29832bcddd09`) is **byte-identical** to the frozen I-08B2.4 `variants/B_DARK_LUMINOUS.svg` |
| Downstream use | the closed **I-08B3.1-G1.1** proof (`docs/design/i-08b3.1-g1.1/…`, SOURCE_TRACE §2) names "I-08B2.5 brand masters" as its brand authority. The Q master `6c483aadc1492af2606539f870b878686b6c9f672c975b5e11c599d91bceaf05` is the file vendored as the canonical reference by C3, D2R, E1R and F1R2 |
| Package self-status | `docs/I-08B2.5_REVIEW_MANIFEST.md`: "READY FOR FINAL PRODUCT / PRODUCTION REVIEW. Not closed, not frozen, not canonical." |
| Verification inside the package | 39/39 geometry-identity checks (`review/GEOMETRY_VERIFICATION.json`); small-size validation (`review/small-size-validation.json`) |

**Lifecycle, stated exactly.** This is the final production asset package, and closed downstream
work consumes it. **No standalone brand closure / freeze record exists on this host.** The Variant B
app icon was frozen at I-08B2.4. The package's own open items remain open, including L-1 (the icon
SVG keeps its pre-freeze header comment so that its hash still matches the frozen artefact) and the
Android 48 dp framing, which was flagged for Product confirmation.

## Source archive (local, not in Git)

| Archive | Size (B) | Entries | SHA-256 |
|---|---:|---:|---|
| `E:\QANDEEL\QANDEEL PROJECT\I-08B2.5-FINAL-BRAND-ASSET-PACKAGE.zip` | 1,203,324 | 82 | `00c8082feb61674e374f6f374023e82878b85ce1c48fc3687374a5be900d962e` |

78 files were preserved, each byte-identical to its archive entry and to
`…\I-08B2.5-FINAL-BRAND-ASSET-PACKAGE\`. Hashes are in
[`SOURCE-PROVENANCE.sha256`](SOURCE-PROVENANCE.sha256). The production PNGs are brand assets, not
evidence, so they are preserved.

## Deliberately not preserved

- `review/FINAL_APP_ICON_PLATFORM_BOARD.png`, `FINAL_LIGHT_DARK_MONO_BOARD.png`,
  `FINAL_SMALL_SIZE_BOARD.png` and `FINAL_WORDMARK_VARIANTS_BOARD.png`: review boards, 0.46 MB, kept
  in the archive. The review JSON they summarise is preserved.
- `I-08B2.2-RECONSTRUCTION-SPEC(.zip)`, `I-08B2.2-RECONSTRUCTION-SPEC-REV1(.zip)`,
  `I-08B2.3-Q-WORDMARK-PRODUCTION-RECONSTRUCTION(.zip)` and
  `I-08B2.4-APP-ICON-PRESENTATION-SYSTEM(.zip)`: **superseded and contained**. Their final outputs
  are carried byte-identically in B2.5. B2.4 Variants A and C were not selected.

## Later amendments

None in this repository. Colour tokens are not frozen by this package, and every value in it is
inherited.
