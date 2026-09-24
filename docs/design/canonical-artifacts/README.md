# QANDEEL — Canonical Final Artifact Preservation

**Status:** `PRESERVATION RECORD — NOT A DESIGN DECISION`

This directory holds byte-exact copies of the final Product / design sources that existed only on
the Product Owner's laptop, under `E:\QANDEEL\QANDEEL PROJECT`. It records authority; it does not
create any. Nothing here was redesigned, re-rendered, reformatted or line-ending-normalised.

**Start here:** [`QANDEEL_CANONICAL_ARTIFACT_INDEX.md`](QANDEEL_CANONICAL_ARTIFACT_INDEX.md) is the one-page
locator for every domain. The audit that produced it, including what was found missing and why each
package was admitted or refused, is
[`LOCAL_ONLY_CANONICAL_ARTIFACT_AUDIT.md`](LOCAL_ONLY_CANONICAL_ARTIFACT_AUDIT.md).

## Rules this directory follows

1. **Final only.** One authority per domain: the final state, plus the minimum support needed to
   verify and reuse it. Superseded packages, rejected explorations and duplicate copies were not
   admitted. The two exceptions are recorded in the I-08B1 provenance: the MID and NEAR baseline
   prototypes. Product ruled that they remain canonical states.
2. **Sealed ZIP first.** Every file was copied out of the domain's final **sealed ZIP**, the object
   whose SHA-256 the closure records name. The loose on-disk folder was used only as a cross-check.
   All 731 files of the first pass are identical in both places. The PR #265 reconciliation then
   applied, byte-exact, 27 files from five final archives that exist only in the project's ChatGPT
   Library (A3R2, C3R, the latest D2R, F2 FINAL_CANONICAL and G1.2 R1): 21 of the 731 were
   replaced and 6 were added. See [`reconciliation/`](reconciliation/README.md).
3. **Byte-identical.** Each file was hashed at the source, copied and then hashed again at the
   destination. A second, independent pass re-hashed every destination file. There are 0 mismatches.
   [`.gitattributes`](.gitattributes) disables line-ending conversion here, because four I-08B1 files
   carry CRLF.
4. **No historical ZIPs in Git.** Archives stay on the laptop. Each domain's `SOURCE-PROVENANCE.md`
   gives the archive's path, size and SHA-256, and lists what was left in it. Review boards, frame
   captures, videos and font binaries were not copied. **One recorded exception:** the final G3.2
   integrated Product-coherence proof is preserved whole in `product-proofs/g3/g3.2/`, boards, motion
   clips and vendored fonts included, by the G3 closure's direction. Its ZIP is still not committed
   (`product-proofs/g3/SOURCE-PROVENANCE.md`).
5. **Later amendments stay binding.** A preserved source is the original final authority for its
   own phase. Where a later canonical record already in this repository amends it, the later record
   wins. Each provenance file names the amendments that apply.

## Verify

Every domain folder carries a `SOURCE-PROVENANCE.sha256` in `sha256sum -c` format:

```bash
cd docs/design/canonical-artifacts/living-analysis && sha256sum -c SOURCE-PROVENANCE.sha256
```

## Layout

| Folder | Domain |
|---|---|
| `living-analysis/` | I-08B1 Living Analysis World — FAR / MID / NEAR |
| `brand/` | I-08B2.5 final brand asset package (Q mark, wordmark, app icon) |
| `typography/` | I-08B3.0-E3 typography system |
| `visual-foundation/` | I-08B3.1-A3R2 World / Reading neutral (A3R + A3R2 reconciliation) |
| `surfaces/` | I-08B3.1-B4R Surface / Content hierarchy |
| `living-brass/` | I-08B3.1-C3 Living Brass, closed by C3R |
| `qandeel-light/` | I-08B3.1-D2R QANDEEL Light (latest D2R state) |
| `interaction-semantic-color/` | I-08B3.1-E1R interaction + system semantic colour |
| `accessibility-appearance/` | I-08B3.1-F1R2 accessibility, I-08B3.1-F2 FINAL_CANONICAL Light appearance |
| `product-proofs/` | I-08B3.1-G1.1-R3, I-08B3.1-G1.2 (+ R1), the preserved final I-08B3.1-G2 proof artifact, and the complete final I-08B3.1-G3.2 proof |
| `reconciliation/` | the PR #265 final-authority patch instructions and manifest, byte-exact |

There are no `matching/` or `replay/` folders. No final local Matching or Replay Product/visual
source exists beyond what `product-proofs/` already carries. The index explains this layer by layer.
