# Source provenance — G3 Product proof (I-08B3.1-G3.1 → G3.2)

## The reviewed archives

| Package | Local archive | Bytes | Entries | SHA-256 | Role |
|---|---|---:|---:|---|---|
| G3.2: Targeted coherence refinement | `E:\QANDEEL\QANDEEL PROJECT\design-workshops\I-08B3.1-G3.2-TARGETED-COHERENCE-REFINEMENT.zip` | 26,909,573 | 145 | **`d6af79daeee0b6f09197084e8e35961112b5a30bc2b4cf2524d1fd2b769ce9b0`** | **final accepted proof. Preserved whole** |
| G3.1: Integrated end-to-end Product proof | `E:\QANDEEL\QANDEEL PROJECT\design-workshops\I-08B3.1-G3.1-INTEGRATED-END-TO-END-PRODUCT-PROOF.zip` | 40,331,309 | 149 | **`a5d286a888b7b851193aa4c2805c443766284fc45b3521daae356677f7e3316e`** | predecessor evidence. Stays local |

Both hashes equal the identities recorded in `docs/design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md` §B. Each archive
was re-hashed before anything was read from it.

## What was preserved: the whole G3.2 package

All 145 entries of the G3.2 archive were written **directly from the archive**, entry by entry, into `g3.2/`. Only the
archive's single root folder, `I-08B3.1-G3.2-TARGETED-COHERENCE-REFINEMENT/`, was dropped. Nothing was renamed,
regenerated, normalised or re-encoded. [`.gitattributes`](../../.gitattributes) keeps git from converting line endings
here.

| Part | Files | Bytes |
|---|---:|---:|
| `boards/` (PNG) | 12 | 9,924,032 |
| `motion/` (MP4) | 7 | 16,707,580 |
| everything else: `README.md`, `MANIFEST.json`, `prototype/`, `source/`, `data/`, `docs/` | 126 | 3,999,947 |
| **total** | **145** | **30,631,559** |

Identities worth naming:

| File | Bytes | SHA-256 |
|---|---:|---|
| `g3.2/prototype/index.html` | 1,354,593 | `10611f35cdcfd031d74ad0b065634a19f530e2b1e28acfd2c944d4f2d4983d71` |
| `g3.2/MANIFEST.json` | 25,143 | `94e5419f123590106153c88209c171d03d0f30867dc5dd1bb658639cd44b5b9e` |
| `g3.2/README.md` | 7,210 | `be926fe01b4adbe52c7155db972f45ab0d8afddc26bb55f4163df82ce6bd036a` |
| `g3.2/source/vendor/canon/wf-living-constellation.html` | 388,374 | `4dfd9d27d752c3a445168c0cc7067d71df4ada84bc61b806d12c8bb3202bc413`, equal to the canonical I-08B1 source |

## How it was verified

1. **ZIP identity.** 26,909,573 B, SHA-256 `D6AF79DA…E9B0`, equal to the reviewed identity.
2. **Two independent readers.** The ZIP was extracted twice to scratch folders, once with the package's own
   `source/tools/lib/zipr.mjs` and once with .NET `System.IO.Compression.ZipFile`. Both give 145 files. All 144
   `MANIFEST.json` entries match by bytes and SHA-256, and there is no unlisted file.
3. **The preserved tree.** Every one of the 145 preserved files was checked three ways, with 0 differences:
   - against its ZIP entry;
   - against the .NET extraction;
   - against its `MANIFEST.json` entry (all but `MANIFEST.json` itself).
4. **Rebuild.** `node src/build.mjs <out>`, run from `g3.2/source/`, reproduced `prototype/index.html` byte for byte
   (`10611f35…83d71`). It did so from both extractions and from the preserved tree. The build writes only to `<out>`,
   and the tree still held 145 files afterwards.
5. **The recorded results.** `g3.2/data/CHECKS.json` records 29 / 29, `PROBES.json` 10 / 10 rejected and
   `LIVECHECK.json` 38 / 38. K14's tightest reviewed case, 320 × 568 in a Live Call while PINNED, is 161 pt of world
   against a 160 pt floor.
6. **The git index.** After staging, every index blob was compared with the preserved file's git blob hash (see the
   closure pull request).

## Why the whole package, and why that departs from rule 4

The preservation directory's rule 4 (`docs/design/canonical-artifacts/README.md`) records that earlier passes did not
copy review boards, videos or font binaries. **G3.2 is a deliberate exception**, made by the G3 closure:
- **Why whole.** G3 is the final integrated Product-coherence proof, and motion is a first-class Product pillar, so its
  boards and clips must not survive only on a laptop.
- **What that brings in.** Keeping the package whole also keeps `source/` complete. That means the 31 vendored WOFF2
  font files (583,176 B, identified in `source/vendor/fonts/google/FONT_MANIFEST.json`, with the Estedad OFL licence
  beside them), which the capture tools need in order to regenerate the evidence.
- **Nothing blocks it.** No file exceeds 3.5 MB, and no repository test, hook or CI job enforces rule 4.

**The ZIP itself is not committed.** Its payload is preserved whole, so the archive would only duplicate it. Its path,
size and hash above are its identity.

## What stays local

| What | Why |
|---|---|
| The G3.2 ZIP | duplicate of the preserved payload |
| The whole G3.1 archive | predecessor evidence, superseded by G3.2. Its three changed build inputs are vendored in `g3.2/source/vendor/upstream-g31/`, and `g3.2/source/tools/upstream.mjs` rebuilds G3.1's reviewed prototype (`47dfe29e…b264`) from the preserved tree. That tool's ZIP-identity step needs the G3.1 ZIP beside the package |
| The scratch work folders (`.g32-work`, captures, frames) | intermediate output; `source/REGENERATE.md` regenerates it |

## Dependencies on other canonical sources

| Dependency | Canonical location | Relationship |
|---|---|---|
| I-08B1 Living Analysis World | `../../living-analysis/i-08b1/wf-living-constellation.html` | vendored byte-identical at `g3.2/source/vendor/canon/`; the build refuses to run unless the pin holds |
| Design-system tokens | `surfaces/`, `living-brass/`, `qandeel-light/`, `interaction-semantic-color/`, `accessibility-appearance/` | vendored in `g3.2/source/vendor/tokens/`; `g3.2/source/CANON_DEPENDENCIES.json` records the vendored canon against its `main` blobs (check K04) |
| G1.1 / G1.2 / G2 / G2.3 records and G1.2 R1 source | `../g1.1-r3/`, `../g1.2/`, `../g2/`, `docs/design/i-08b3.1-g*` | vendored copies at the baseline, for the build and the checks |

## Later canonical records (binding; the later record wins)

| Record | What it binds |
|---|---|
| `docs/design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md` | G3 and parent G `CLOSED / FROZEN`; the Matching / Live-Call rule; the North Star disposition; the lifecycle of this package |
| `docs/design/i-08b3.1-g3/T11_T12_TEMPORAL_ORIENTATION_CONTROLLED_AMENDMENT.md` | Decision B, supersedes the package's candidate wording |
| `docs/design/i-08b3.1-g3/G2_F2_ANALYSIS_SHELL_CONTROLLED_AMENDMENT.md` | Decision A, supersedes the package's candidate wording |

The preserved files are hashed in [`SOURCE-PROVENANCE.sha256`](SOURCE-PROVENANCE.sha256). Check them with
`sha256sum -c` from this folder. As in every domain folder here, the authored `README.md` and this file are not listed.
