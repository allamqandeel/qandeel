# Source provenance — G2 Product proof (I-08B3.1-G2.1 → G2.3)

## The three reviewed archives

| Package | Local archive | Bytes | Entries | SHA-256 |
|---|---|---:|---:|---|
| G2.1: Analysis screen composition | `E:\QANDEEL\QANDEEL PROJECT\design-workshops\I-08B3.1-G2.1-ANALYSIS-SCREEN-COMPOSITION.zip` | 152,034,307 | 240 | **`7183ed66b313080adc4545d23cc623dcea2bc20d4001928b0731ed0f3ee888e0`** |
| G2.2: Matching process refinement | `E:\QANDEEL\QANDEEL PROJECT\design-workshops\I-08B3.1-G2.2-MATCHING-PROCESS-REFINEMENT.zip` | 6,479,082 | 17 | **`887decefbce86c33be768ce05551bc9f7158e8a6ee3116b554d2c37d139451c7`** |
| G2.3: Matching copy + Return amendment | `E:\QANDEEL\QANDEEL PROJECT\design-workshops\I-08B3.1-G2.3-MATCHING-COPY-RETURN-AMENDMENT.zip` | 4,308,615 | 14 | **`12cca79c35d74da8bc951b87b4827029aa50b2d4eb8fca050934a46c4077c370`** |

All three hashes equal the reviewed hashes recorded in `docs/design/i-08b3.1-g2/QANDEEL_G2_CANONICAL_CLOSURE.md`
§B. The G2.3 hash also equals the one in the G2.3 closure's header.

**Each archive was hashed and matched before anything was read from it.** Every entry was then read
from the archive itself, through its central directory and local header. Each entry's CRC-32 and size
were verified: 240, 17 and 14 entries, 0 failures.

**The loose workshop folders were a cross-check only.** All 271 entries are byte-identical there.

## What was preserved: 3 files, all from the G2.3 archive

| Preserved path (under `g2/`) | Archive entry (G2.3) | Bytes | SHA-256 | Loose folder |
|---|---|---:|---|---|
| `g2.3/prototype/index.html` | `I-08B3.1-G2.3-MATCHING-COPY-RETURN-AMENDMENT/prototype/index.html` | 1,308,967 | `f0b11310ac9561bc7c14f3dfa2864eb450b78d02d9adb6e747ba1d56b9680bec` | byte-identical |
| `g2.3/data/MANIFEST.json` | `I-08B3.1-G2.3-MATCHING-COPY-RETURN-AMENDMENT/data/MANIFEST.json` | 32,906 | `f900935fe653d469b488d63514d79668f613e5356126b81965d0185b320b5660` | byte-identical |
| `g2.3/README.md` | `I-08B3.1-G2.3-MATCHING-COPY-RETURN-AMENDMENT/README.md` | 17,070 | `61299856e5b4712cd568d9720103e4c903df7ac3d5bfbcb99e413ee53d2d88a3` | byte-identical |

Each file was written from the archive bytes, then read back and hashed again. It equals its archive
entry and its loose copy. The prototype and README also equal their entries in the package's own
`data/MANIFEST.json`.

### Why these three are the minimum sufficient set

**`g2.3/prototype/index.html` is the final effective G2 proof.**
- **It is cumulative.** It carries every surface of the G2 line, checked by content:
  - from G2.1, the Analysis composition: the world as the screen, the Timeline with its look and PINNED
    mode, Inspection, Live Call and the Replay entry;
  - from G2.2, the Matching process for both accepters, the dark Analysis and the compact Return;
  - from G2.3, the approved Matching copy and the Return dominance rule.
- **It is self-contained.**
  - Its only absolute URL is the SVG namespace.
  - It has no external script, stylesheet, image, fetch, import or worker.
- **Its runtime source is inline and readable,** for example `presentReturns`, `openProposal` and
  `enterShared`. The proof can be read, run and changed from this one file.
- **Its direct-entry states** are `CONV`, `P1`–`P5`, `P3_OPEN`, `P4_OPEN` and `M1_CUE` … `M6_ENTERED`.

**`g2.3/data/MANIFEST.json` is the verification support.** It records:
- every other package file, with bytes and SHA-256 (its entries for the prototype and the README equal the
  preserved bytes);
- the world's canonical path, blob and SHA-256, with `inlinedInPrototype: true`;
- the seven build inputs and nine tools, by path, bytes and SHA-256, with each input's delta from G2.2
  (`source`, `sourceDelta`);
- the G2.2 base archive hash;
- the G2.2 motion clips (`motionReference`);
- the checks as run.

**`g2.3/README.md` is the reuse support.** It explains how to open and drive the build:
- the states;
- `?appearance=light`, `?rm=1` and `?w=320&h=568`;
- the review panel and its copy-status table;
- the checks as run.

**G2.1 and G2.2 contribute no file.** Their builds and source are superseded by this build. Everything else
they carry is review evidence or is already canonical elsewhere (below).

## Dependencies on already-preserved canonical sources (referenced, not duplicated)

| Dependency | Canonical location | How the G2 build uses it |
|---|---|---|
| **I-08B1 Living Analysis World** | `docs/design/canonical-artifacts/living-analysis/i-08b1/wf-living-constellation.html`, SHA-256 `4dfd9d27d752c3a445168c0cc7067d71df4ada84bc61b806d12c8bb3202bc413` | **Inlined in the sealed build, not preserved as a second file.** See below. |
| **Estedad**, the Product typeface | `typography/` (I-08B3.0-E3); licence `typography/i-08b3.0-e3/fonts-info/LICENSE-OFL.txt` | The build embeds `Estedad-wght-v8.5.woff2` (120,924 B) as a `data:` font, the same bytes the preserved G1.1-R3 and G1.2 prototypes embed. No font binary file is preserved (rule 4). The OFL licence already preserved there is byte-identical to the copy in the G2.1 archive. |
| **IBM Plex Sans Arabic / IBM Plex Mono** | requested from Google Fonts by the I-08B1 world itself | The embedded world requests them online exactly as the canonical source does, and falls back to other fonts offline. The G2 captures replayed vendored copies, which stay in the G2.1 archive (`source/vendor/fonts/google/`, with `FONT_MANIFEST.json`). |
| **Design-system tokens** | `surfaces/`, `living-brass/`, `qandeel-light/`, `interaction-semantic-color/`, `accessibility-appearance/` | Resolved into the build. All 19 token files vendored in the G2.1 archive are byte-identical to files already preserved in this tree. |
| **T-08 copy and types** | `apps/mobile/src/orientation-chrome/product-copy.ts` and `…/types.ts` | The Return words and act identities. The G2.1 archive's vendored extracts are the identical blobs at `main` `a55af616…`. |
| **G1.1 / G1.2 shell** | `../g1.1-r3/`, `../g1.2/` and their closure records | The shell the Analysis sits in: the rail, «المحادثة» / «تحليل المحادثة», the call line. Not duplicated. |

**How the world is inlined.**
- The page carries the world as one base64 block of 517,832 characters.
- Before loading it, the page checks it with `crypto.subtle` against the canonical hash above.
- Here the block was decoded and found to be exactly the canonical 388,374 bytes.
- Removing the block would change the sealed bytes. It is part of the reviewed build, not an added copy.
- The G2.1 archive holds two standalone copies of the world (`prototype/world/…` and
  `source/vendor/canon/…`), both equal to the canonical file. Neither was admitted.

## Deliberately not admitted (still in the sealed archives)

| From | What | Why |
|---|---|---|
| G2.3 | `G2.3_DECISIONS.md`, `G2.3_OPEN_QUESTIONS.md` | review records. The decisions are superseded by the G2.3 and G2 closures; the questions are dispositioned by G2 closure §G and the G3 handoff |
| G2.3 | `G2.3_T11_RETURN_PRESENTATION_AMENDMENT_CANDIDATE.md` | superseded by `docs/design/i-08b3.1-g2.3/T11_RETURN_PRESENTATION_CONTROLLED_AMENDMENT.md` |
| G2.3 | `boards/01…08` (8 PNG, 3,642,462 B) | review boards (rule 4); their hashes are in `g2.3/data/MANIFEST.json` |
| G2.2 | `prototype/index.html` (1,300,356 B) | superseded by the G2.3 build |
| G2.2 | `motion/second-accepter-match.mp4`, `motion/first-accepter-arrival.mp4` (2,728,980 B) | videos (rule 4). They remain the motion reference of record for the two Mutual-Match moments; `g2.3/data/MANIFEST.json` records their bytes and SHA-256 under `motionReference` |
| G2.2 | 9 board PNGs; `README.md`, `G2.2_DECISIONS.md`, `G2.2_OPEN_QUESTIONS.md`, `G2.2_SKILL_DELTA.md`, `data/MANIFEST.json` | review evidence and records. The Product Owner's decisions D1–D5 are carried by the G2 closure |
| G2.1 | `prototype/index.html`, `prototype/index-en.html` | superseded by the G2.2 and G2.3 builds. `index-en.html` is the only English build in the G2 line; it predates G2.2 |
| G2.1 | `prototype/world/wf-living-constellation.html`, `source/vendor/canon/wf-living-constellation.html` | byte-identical duplicates of the canonical I-08B1 source |
| G2.1 | `source/src/*` (7 files) | superseded. G2.2 / G2.3 changed five of them (`app.js`, `bridge.js`, `build.mjs`, `content.mjs`, `tokens.mjs`). Only `bidi.js` and `glyphs.mjs` equal the final inputs, and a partial source rebuilds nothing |
| G2.1 | `source/vendor/tokens/**` (19 files); `source/vendor/canon/product-copy.ts`, `orientation-types.ts`, `MAIN_EXTRACT_INDEX.json` | already canonical elsewhere (above). The index is an extract list of `main` at `b089c86f…` |
| G2.1 | `source/vendor/fonts/**` | font binaries (rule 4); the licence is already preserved |
| G2.1 | `tools/**`, `data/**`, `boards/**` JSON, `motion/*.truth.json`, 105 PNG, 14 MP4 | G2.1's own verification tooling and review evidence |
| G2.1 | `README.md`, `G2.1_PRODUCT_COMPOSITION_DECISIONS.md`, `G2.1_CANONICAL_RECONCILIATION.md`, `G2.1_OPEN_QUESTIONS.md`, `G2.1_SKILL_USE.md` | review records. The seam identifiers the G2 closure and G3 handoff cite (S-04, S-06, S-07, S-09, S-10, Q-READING-1) are defined in the reconciliation's §5 and in the open questions. Both canonical records restate each seam in their own words |

## Not rebuildable from preserved material

**The build inputs were never sealed.** G2.3's seven source files and the nine tools that captured and
checked it lived in the local work folder `.i08b31-g23-work/`, not in any archive. Under rule 2 they
cannot be preserved here. `g2.3/data/MANIFEST.json` identifies each one by path, bytes and SHA-256.

**What that means for reuse.** The preserved build carries its runtime source inline, so it can be read,
run and changed without them. It cannot be regenerated byte for byte from anything preserved. The checks
recorded in `g2.3/README.md` (C1–C12 and the 28-step live check) were not re-run here.

## Read before reuse

- **Status wording.** `g2.3/README.md` and `g2.3/data/MANIFEST.json` still call the package
  "WORKSHOP / REVIEW CANDIDATE — NOT FROZEN". The later records below bind.
- **Appearance.** The frozen appearance law covers only the Living Analysis World (G2 closure §F).
  Under system Light the build also draws the rest of the Analysis screen's chrome dark with the world,
  including the rail, status region and call line. That is G2.2's proof answer, evidence only.
  Q-LIGHT-SHELL is open.
- **Orientation above the Timeline.** The build places contextual orientation above the Timeline, over
  the world. That is proof evidence only: T-11's `[world, temporal surface, chrome]` column stays in force
  (G2 closure §E, S-04).
- **Copy.** The review panel labels every Matching word PO-APPROVED or PROOF COPY — OPEN. The exact
  approved copy is owned by the G2.3 closure; the open copy stays open.
- **Arabic only.** The build is `lang="ar-EG"`. No English build of the G2 line is preserved.
- **Files named but not preserved.** `g2.3/README.md` names boards, review records and a tools folder
  that stay in the archive or on the laptop.

## Later canonical records (binding; the later record wins)

| Record | What it binds |
|---|---|
| `docs/design/i-08b3.1-g2.3/QANDEEL_G2_3_CANONICAL_CLOSURE.md` (PR #266, `a55af616…`) | G2.3 CLOSED / FROZEN: the exact Matching opening and QANDEEL-view / privacy copy, the Matching process, the compact Return direction |
| `docs/design/i-08b3.1-g2.3/T11_RETURN_PRESENTATION_CONTROLLED_AMENDMENT.md` | «طرق العودة» as the one permitted Return grouping. It supersedes the package's amendment candidate |
| `docs/design/i-08b3.1-g2/QANDEEL_G2_CANONICAL_CLOSURE.md`, **binding once PR #267 merges** | the G2 Product laws; the narrow F2 → G2 scoped supersession for the Living Analysis World (§F); Q-LIGHT-SHELL open; the S-04 boundary |

The three preserved files are hashed in [`SOURCE-PROVENANCE.sha256`](SOURCE-PROVENANCE.sha256). Check them
with `sha256sum -c` from this folder. As in every domain folder here, the authored `README.md` and this
file are not listed.
