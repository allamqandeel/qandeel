# Accessibility + Light Appearance — I-08B3.1-F1R2 and I-08B3.1-F2R

Two linked authorities. They are kept separate because they answer different questions.

**F1R2: accessibility transformations and semantic parity** (`i-08b3.1-f1r2/`)
- `README.md` and `docs/F1R2_REVISION.md`, then `docs/F1R_REVISION.md`. Read the latest revision
  first and never read F1 alone.
- `docs/F1_ACCESSIBILITY_CONTRACT.md`, `F1_ANALYTICAL_TRUTH_PARITY.md`,
  `F1_SCREEN_READER_PROJECTION.md` and `F1_NON_COLOUR_CARRIERS.md`: the contract.
- `tokens/`: the resolver, the `accessibility` base, the dark context, the increased-contrast and
  reduced-transparency contexts.

**F2R: Light appearance + cross-appearance integration** (`i-08b3.1-f2r/`)
- `README.md` and `docs/F2R_REVISION.md` (the repair of F2's too-quiet light meaning event) and
  `docs/F2R_CLEAN_EXTRACTION.md`.
- **Dark / Light appearance mapping**: `docs/F2_CROSS_APPEARANCE_MAP.md` + `tokens/base/appearance.tokens.json`.
  Twelve literals are appearance-dependent and everything else is an alias.
- **Meaning Light appearance mapping**: `tokens/appearance/light/d2r.light.illumination.tokens.json`
  + `tokens/appearance/dark/f2.dark.illumination-technique.tokens.json` + `docs/F2_LIGHT_DERIVATION.md`.
- `tokens/appearance/light/*.tokens.json`: the light contexts that fill B4R, C3, D2R, E1 and F1's
  declared-empty `light` sets.

Provenance, the F1 / F2 resolution, the missing `FINAL_CANONICAL` package and exclusions:
[`SOURCE-PROVENANCE.md`](SOURCE-PROVENANCE.md).
