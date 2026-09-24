# Product proofs — I-08B3.1-G1.1-R3, I-08B3.1-G1.2 (+ R1) and I-08B3.1-G2

The source and built prototypes of the two closed G1 Product proofs. Their canonical **closure
records** were already on `main`, and those records are the authority for what was decided:

- `docs/design/i-08b3.1-g1.1/QANDEEL_G1_1_CANONICAL_CLOSURE_AND_AMENDMENTS.md`
- `docs/design/i-08b3.1-g1.2/QANDEEL_G1_2_CANONICAL_CLOSURE.md`

What was local-only is preserved here.

- `g1.1-r3/`: the reviewed R3 package. It contains `prototype/*.html` (built), `source/` (`src/`,
  `tools/`, `vendor/` tokens and canon, the `out/world/` crop inputs, `REGENERATE.md`), `data/`
  (checks, manifest, screens, token resolution, motion truth) and the R3 reports, including the B4
  `UTTERANCE` reconciliation note.
- `g1.2/`: the reviewed G1.2 proof, with the same layout plus the audio-runtime and
  background-call platform notes. **`g1.2/source/src/` is the final R1-corrected source**, and
  `g1.2/r1/` holds the R1 correction record, source patch, targeted checks and manifest.
- `g2/`: the final G2 proof (G2.1 → G2.3). It holds the self-contained G2.3 build with its manifest and
  README, byte-exact from the sealed G2.3 archive. Its closure record is
  `docs/design/i-08b3.1-g2/QANDEEL_G2_CANONICAL_CLOSURE.md`, binding once PR #267 merges. `g2/` carries
  its own `README.md`, `SOURCE-PROVENANCE.md` and `SOURCE-PROVENANCE.sha256`; the two provenance files at
  this level cover G1 only.

**Read before reuse:** in `g1.2/`, only `source/src/` and `r1/` carry R1. The built
`prototype/*.html`, `data/G12_CHECKS.json`, `source/tools/checks.mjs` and the G1.2 reports are the
reviewed proof's pre-R1 evidence and still use the superseded Product-area name and persistent call
prose. [`SOURCE-PROVENANCE.md`](SOURCE-PROVENANCE.md) explains exactly what is superseded.
