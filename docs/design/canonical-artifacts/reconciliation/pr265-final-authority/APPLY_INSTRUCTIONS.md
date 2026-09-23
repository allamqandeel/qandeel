# QANDEEL — PR #265 Final-Authority Reconciliation Patch

This bundle exists because independent review found that several packages reported "missing" by the
laptop-only audit are preserved in the project's ChatGPT Library.

## Hard scope

Apply to the EXISTING branch / PR only:

- branch: `preservation/canonical-final-product-design-artifacts`
- PR: `#265`

Do NOT restart the audit.
Do NOT render.
Do NOT redesign.
Do NOT create a new Product decision.
Do NOT merge.

`repo-files/` mirrors the exact repository destination paths. Existing-source files in that tree are
byte-exact bytes recovered from the final archives. Do not reformat them.

## Corrections

1. Visual Foundation: replace A3R's changed manifest/package files and add
   `A3R2_REVISION_RECORD.md`. A3R2 is the final status reconciliation; it changes no raster, measurement,
   colour or Product decision.

2. Living Brass: apply C3R's changed manifest files and add `C3_FINAL_CLOSURE_RECORD.md`.
   C3R explicitly closes/freezes C and fixes closure/manifest bookkeeping without changing the material.

3. QANDEEL Light: replace the 8 files supplied from the latest D2R archive.
   The final recovered D2R archive is SHA-256
   `b0f039ec86b1c341f704fa3d444dee944d2b7101d6291698a03a59218c200888`.
   Library copies `(2)` and `(3)` are byte-identical. This is later than the currently preserved
   `be89b41a...` archive and removes stale semantic/depth wording plus strengthens the S6 stale check.
   Scene/tokens/motion/prototype output do not change.

4. Light Appearance: replace the supplied non-review files from
   `...FINAL_CANONICAL.zip`, SHA-256
   `6ca4744d5402108f67edf629fd45b7d3e1290391d50d0f73647b009b3dff8aaa`.
   This is the final canonical F package. Do not preserve the superseded `e2a358aa...` state as final.

5. G1.2: overwrite the three `source/src/*` files with the R1-corrected source and preserve the four
   R1 record/check/patch/manifest files under `product-proofs/g1.2/r1/`.
   The R1 archive SHA-256 is
   `2e5e0ac41b44be19b5a773aec3a8da060b4a5f5221ef6cb0d1999146f8d23e11`.

## Deliberately NOT promoted

- B2R2 and B3R2: they exist in Library but B4R supersedes them.
- C0R2: it exists, but C3R is the final Living Brass closure and the final-only policy does not require
  carrying the earlier C0 closure separately unless a concrete missing contract is discovered.
- E1: current PR already preserved the correct E1R state (`7bb00f86...`), so no replacement is needed.

## Authored docs to update

Update the master index, local audit, and affected per-domain README / SOURCE-PROVENANCE /
SOURCE-PROVENANCE.sha256 so they no longer say the following are missing:

- A3R2
- C3R
- later D2R copies
- F2 FINAL_CANONICAL
- G1.2 R1

Record:

- A3R2 ZIP SHA-256: `9663164db8325a6e3fff40f70264e9b07fb2196fbd388c1c73e7d96f30c03ee8`
- C3R ZIP SHA-256: `9380caba31799547b0f698ac0b1de014a011f8b2e48223df3588f7b2ba6ac288`
- latest D2R ZIP SHA-256: `b0f039ec86b1c341f704fa3d444dee944d2b7101d6291698a03a59218c200888`
- F2 FINAL_CANONICAL ZIP SHA-256: `6ca4744d5402108f67edf629fd45b7d3e1290391d50d0f73647b009b3dff8aaa`
- G1.2 R1 ZIP SHA-256: `2e5e0ac41b44be19b5a773aec3a8da060b4a5f5221ef6cb0d1999146f8d23e11`

F2 final closure state is:

- F1 CLOSED / FROZEN
- F2 CLOSED / FROZEN
- I-08B3.1-F ACCESSIBILITY + ALTERNATE EXPRESSIONS CLOSED / FROZEN

Final Light appearance:
- World `#efeeeb`
- Functional Surface `#e7e6e3`
- Living Brass `#7a6446`
- Error `#ad4739`
- Meaning family `#fff6df / #ddd4be / #bcb39e`
- Dark remains unchanged

G1.2 R1 final Product corrections:
- Arabic Product-area name: `العالم المشترك`
- English Product-area name: `Shared World`
- no persistent normal-state call prose
- one assistive live-status channel
- microphone education first-need/recovery only
- iconography and audio strip remain proof-only / not frozen

## Verification

After copying:
- re-hash every file listed in `PATCH_MANIFEST.json`;
- ensure all match;
- regenerate affected SHA lists;
- validate every hash quoted in authored preservation docs;
- run `git diff --check` on authored docs;
- run the same closure-governance test used in the original preservation pass;
- inspect the PR diff;
- confirm no production code changed;
- confirm no visual render was regenerated.

Then push the SAME branch and return the new head SHA and updated PR #265 status.

Do NOT merge.
