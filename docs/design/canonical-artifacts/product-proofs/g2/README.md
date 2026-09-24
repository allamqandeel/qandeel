# G2 Product proof — I-08B3.1-G2 (G2.1 → G2.3)

This folder holds the final reusable proof artifact of the G2 Living Analysis + Product composition work. The
canonical records are the authority for what was decided:

- `docs/design/i-08b3.1-g2/QANDEEL_G2_CANONICAL_CLOSURE.md`: the G2 parent closure, binding once PR #267
  merges;
- `docs/design/i-08b3.1-g2.3/QANDEEL_G2_3_CANONICAL_CLOSURE.md`: the exact Matching copy and the compact
  Return direction;
- `docs/design/i-08b3.1-g2.3/T11_RETURN_PRESENTATION_CONTROLLED_AMENDMENT.md`.

## What is here

- **`g2.3/prototype/index.html`: the final effective G2 proof build.**
  - It is one self-contained, offline HTML file.
  - It embeds the canonical I-08B1 world and hash-checks it in the page.
  - Its runtime source is inline.
  - Open it from disk in Chrome or Edge. `g2.3/README.md` lists its states and parameters.
- **`g2.3/data/MANIFEST.json`: the package's own integrity record.** It covers every package file, the
  build inputs and tools by hash, the world's provenance, the G2.2 motion clips and the checks.
- **`g2.3/README.md`:** the package's usage and validation notes, as reviewed.

## Where it came from

All three are byte-exact from the sealed G2.3 archive. G2.1 and G2.2 contribute no file: their builds
and source are superseded by this build, and everything else they carry is review evidence or already
canonical elsewhere. [`SOURCE-PROVENANCE.md`](SOURCE-PROVENANCE.md) records:
- the three archives;
- what was left in them;
- the dependencies;
- which later records bind.

## Read before reuse

- **The build shows two proof answers that are not canon:**
  - the Analysis screen's chrome (the rail, status region and call line) goes dark with the world under
    system Light, but Q-LIGHT-SHELL is open;
  - orientation sits above the Timeline (S-04).
- **It cannot be regenerated from preserved material.** Its build inputs are identified by hash in its
  manifest.
