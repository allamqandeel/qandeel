# QANDEEL — Living Analysis Map — Visual Source Registry v1

**Status:** `MAP-CLOSE-01 — VISUAL SOURCE REGISTRY — STEP 3 CLOSED / FROZEN: S3-R2 IS THE FINAL APPROVED VISUAL ART DIRECTION (PO, 2026-11-10) — STEP 4 / V-3 PRODUCTION VISUAL PORT AUTHORIZED (IN PROGRESS)`

**Step 3 closure (PO, 2026-11-10), recorded in the V-3 change:**
- **S3-R2** — S3-R1 with all three improvements `core`, `fine` and `fill` — is the **FINAL APPROVED VISUAL ART DIRECTION** of the Personal Living Analysis map (§3.3). There is no S3-R3 and no further art round.
- **AD-4 and S3-R1** become historical references (§3.4). They are not targets.
- **Step 4 / V-3** — the production visual port of S3-R2 into the existing production map, on the existing engine, with real data, its interactions and the contracts in force — is authorized. Its record is [`QANDEEL_MAP_CLOSE_01_V3_PRODUCTION_VISUAL_PORT_RECORD_v1.md`](../../../e2e/QANDEEL_MAP_CLOSE_01_V3_PRODUCTION_VISUAL_PORT_RECORD_v1.md).
- **What stays the same:** I-08B1 / VPORT-01 and their frozen contracts keep their authority over everything V-3 does not amend through governance (§2.4). Every amendment V-3 makes is named in its record.
- **Step 2** was merged through PR #390 as `5a21971d`. The Step 2 text below is kept as written; where it says "current" or "not authorized", §5 is the current state.

**Step 2 status, as written at Step 2:** `MAP-CLOSE-01 STEP 2 — VISUAL SOURCE REGISTRY — APPROVED IN PRINCIPLE BY THE PO (2026-11-10) — AD-4 NOT FINAL — DOCUMENTATION ONLY`
**Task:** MAP-CLOSE-01 Step 2, the Visual Source of Truth for the Personal Living Analysis map.
**Date:** 2026-11-10. **Baseline:** `main` at `bd80c755` (the merge of PR #388). **Branch:** `map/map-close-01-visual-registry-clean`. It is a clean branch from `main` that replaces Draft PR #389 under the PO's decision B-3 (§7).
**Authority:** Product Owner, MAP-CLOSE-01 Step 2 (2026-11-10). It is documentation only.
- It changes no renderer, data, generated token or frozen contract.
- It opens no AD-5, V-3, Replay, N4 or CAL-2 work.

**PO decisions (2026-11-10), after reviewing PR #389 and its R1:**
1. **The registry is approved in principle**, together with its rule:
   - **AD-4** is the temporary art base;
   - **Dashboard01** is the visual-quality reference;
   - **I-08B1** is today's production implementation, not the new art target.
2. **AD-4 is not approved as a final design.**
3. **Option B-3** applies to the references whose rights are not recorded. This registry moves to a clean branch from `main`. No commit from PR #389 is reused or cherry-picked.
   - **Dashboard01, the LA-VIS-01 reference, and the original comparison board** that showed them are **not** in this branch.
   - Those references are kept only in private storage (§3.5).
4. **B-2 is rejected:** no force-push and no history rewrite.

"R1" below means the corrections made after the PO's final review of PR #389:
- the durable archive;
- the byte-for-byte reproduction of AD-4;
- the corrected render parameters.

**Why it exists:** so that no development, test or rebuild of the map falls back by mistake to an older look. Every map reference sits in exactly one of four categories (§1), and work starts under the rule in §2.

**Machine check:** `sha256sum -c` run from the repository root on
[`visual-source/VISUAL-SOURCE.sha256`](visual-source/VISUAL-SOURCE.sha256) (25 fixed references since Step 3: the 18 of Step 2 and the 7 S3-R2 files) and on
[`visual-source/PRODUCTION-CODE-SNAPSHOT-bd80c755.sha256`](visual-source/PRODUCTION-CODE-SNAPSHOT-bd80c755.sha256).
- The second file is a snapshot of the production code at `bd80c755`.
- It **will** drift whenever production code changes. That drift is expected, and it is not a registry failure.

**Comparison board (Option B):** [`visual-source/comparison/MAP-CLOSE-01-VISUAL-SOURCE-COMPARISON-OPTION-B.png`](visual-source/comparison/MAP-CLOSE-01-VISUAL-SOURCE-COMPARISON-OPTION-B.png).
- **Images with unrecorded rights** (Dashboard01 and the LA-VIS-01 reference) appear on it **only as name and SHA-256**, never as pictures.
- **Every other image** on it is the project's own work: app captures, I-08B1 and the study renders.

---

## 1. The four categories
| # | Category | What it is | Authority | Use |
|---|---|---|---|---|
| 1 | **CURRENT PRODUCTION** | the map the app draws today: I-08B1 → VPORT-01 → LA-VIS-01 → SHARED-VIS-01 → S8B-06 F-G | **in force.** I-08B1 is `CLOSED / FROZEN`; the production code and its contracts govern | production, regression and tests of today's app. **It is not the visual target of new work** |
| 2 | **TARGET REFERENCE** | `Dashboard01` | the art reference the new direction started from (PO, 2026-11-09) | the comparison standard for **visual quality** only (§2.3) |
| 3 | **FINAL APPROVED ART DIRECTION** (since Step 3; until Step 3 it was **CURRENT ART BASE**, `AD-4`) | `S3-R2` | **FINAL APPROVED VISUAL ART DIRECTION** (PO, 2026-11-10). It closes Step 3 | the one visual target V-3 ports into production (§2.6) |
| 4 | **HISTORICAL / REJECTED FOR NEW DESIGN** | older study rounds, older references and older captures; **since Step 3 also AD-4 and S3-R1** | none for new design | history and provenance only. **Never presented as the required look** |

**Category 2 after Step 3:** Dashboard01 keeps its row, as the quality reference Step 3 was compared with. V-3 is compared with **S3-R2**, not with Dashboard01.

## 2. The rule (approved in principle by the PO on 2026-11-10; binding from the merge of this change)
1. **Where to start.** New work under MAP-CLOSE-01 starts from the latest art base the PO has kept for this track, which is **AD-4 today** (category 3), and is compared with **Dashboard01** (category 2).
   - It does **not** start from I-08B1 as the art target.
   - It does **not** start from an older AD round, R2, V-1 or V-2.
   - It does **not** start from the LA-VIS-01 reference.
2. **Missing or unconfirmed assets: stop.** If a required asset is missing, or its SHA-256 does not match this registry, work stops and names what is missing.
   - It **never** falls back automatically to an older look.
   - It never substitutes a look-alike file (§3.4 lists two known look-alikes).
3. **Dashboard01 sets visual quality, not meaning.** It fixes the target for light, depth, texture, density and Arabic labelling. Its content is **not** product semantics: its named life domains, groupings, colour-as-category and layout carry no meaning for the product. The PO's standing decisions still hold:
   - no fixed life domains;
   - colour never carries meaning alone;
   - Home proximity never implies membership;
   - Homes never move;
   - topics come only through the governed L2 contract (CP-A record, planning only).
4. **Production authority is unchanged.** I-08B1 / VPORT-01, and the production code and contracts that implement them, stay the production authority until a replacement is approved **and** implemented through the proper governance. This registry retires nothing.
5. **AD-4 is not final.** It is never described as `FINAL`, `APPROVED` or North Star. Any later art base enters category 3 only by the PO's decision, recorded in this registry.
6. **Since Step 3 (PO, 2026-11-10): V-3 implements S3-R2.** This rule binds over rule 1 for all work after Step 3.
   - **The target** is S3-R2 as pinned in §3.3, with the parameters in its `REPRODUCE` file.
   - **No fallback.** V-3 never falls back automatically to I-08B1, AD-4, S3-R1 or Dashboard01 as the visual target. If an S3-R2 file is missing or its SHA-256 does not match, the work stops and names the file (rule 2).
   - **Meaning is unchanged.** S3-R2's names, groups, relations and colour memberships are synthetic study data. None of them enters the app; production draws only real Qandeel data. No group is invented, and proximity or colour is never treated as membership (rule 3).
   - **Contracts.** I-08B1 / VPORT-01 and their frozen contracts stay in force for everything V-3 does not amend. Each V-3 amendment is a named controlled amendment in the V-3 record, never a silent change.
   - **No redesign.** V-3 ports S3-R2. It opens no new art round, no new engine and no new research phase.

## 3. Registry
Hashes are SHA-256. They were recomputed on 2026-11-10 from the files at the paths shown.
- "Repo" paths are relative to the repository root.
- "Local" paths are on the PO's machine and are **not in Git.**
- "Archive" means a durable, off-device private copy (§3.5).

### 3.1 Category 1: CURRENT PRODUCTION
| Name | Path | Status | Function | SHA-256 | Use |
|---|---|---|---|---|---|
| Production renderer and visual stack | repo `apps/mobile/src/map/renderer/*`, `apps/mobile/src/map/visual/*` | in force | draws the map | per file in `PRODUCTION-CODE-SNAPSHOT-bd80c755.sha256` | production |
| World-visual generator | repo `apps/mobile/scripts/generate-world-visual.mjs` → `world-visual.generated.ts`, `world-field.generated.ts` | in force | ports I-08B1 tokens into code | in the snapshot file | production |
| I-08B1 unified source | repo `docs/design/canonical-artifacts/living-analysis/i-08b1/wf-living-constellation.html` | `CLOSED / FROZEN` | the frozen source the port derives from | `4dfd9d27d752c3a445168c0cc7067d71df4ada84bc61b806d12c8bb3202bc413` | production authority; **not the new art target** |
| I-08B1 FAR / MID / NEAR heroes | repo `…/i-08b1/ws7rf-far-hero.png`, `ws7rr-mid-hero.png`, `ws7rv2-near-hero.png` | `CLOSED / FROZEN` | the frozen reference frames | `a6b179ff1ba3e63f4720e0c19a1133274798b6bb0416e062fde02a241f421b28`, `630c7b4ec1c05f849f4505c8b2f9a1de34f904a95ca8b5991c858e03f13ce19d`, `92a1db238e12e41a10d02feedb5fb4b59464eb54271cbdbb26f2cbdf46afb44f` | same as the source |
| I-08B1 provenance | repo `…/living-analysis/README.md`, `SOURCE-PROVENANCE.md`, `SOURCE-PROVENANCE.sha256` | unchanged by this registry | — | 15 / 15 entries re-verified on 2026-11-10 | provenance |
| Records | repo `docs/e2e/QANDEEL_VPORT_01_LIVING_ANALYSIS_WORLD_PRODUCTION_VISUAL_PORT_v1.md`; `docs/e2e/QANDEEL_S5_03B_PUBLIC_SEMANTIC_FIELD_VIEWER_RUNTIME_IMPLEMENTATION_RECORD_v1.md` §27 (LA-VIS-01); `docs/e2e/QANDEEL_SHARED_VIS_01_SHARED_WORLD_LIVING_ANALYSIS_IMPLEMENTATION_RECORD_v1.md`; `docs/e2e/QANDEEL_S8B_06_CALL_UI_LIVE_MAP_DEVICE_CLOSURE_RECORD_v1.md` (F-G) | merged | why the production look is what it is | — | production history |
| Tests guarding production | repo `tests/vport-01-world-visual-contract.test.mjs`, `tests/vport-02-temporal-orientation-p2-contract.test.mjs`, `tests/living-analysis-map-runtime-contract.test.mjs`, `tests/shared-vis-01-shared-living-analysis-contract.test.mjs`; workflows `vport-01-visual-proof.yml`, `vport-02-visual-proof.yml` | in force | stop production drift | — | production |
| Device capture, current code: 11 Threads, FAR | repo `visual-source/current-production/r6c-L-5-far-11-threads.png` (local original `E:\QANDEEL_REPORTS\S8B-07\CP2-A\SPIKE\03-reference\reference\L-5\ref-L-5-1.png`) | evidence | the current production look | `098a1ffbc6e46c0012bc794b28d4c67e3bb8c5bf82a610362d4206604f4e0174` | production evidence |
| Device capture, current code: 6 Threads, FAR | repo `visual-source/current-production/r6c-MIX-far-6-threads.png` (local original `…\reference\MIX\ref-MIX-1.png`) | evidence | the same | `505027740bae8bc110f229449146095c7072f2946214e842f4e37e97e1fa9883` | production evidence |
| Personal FAR, full screen, at the LA-VIS-01 closure | repo `visual-source/current-production/la-vis-01-closure-personal-far.png` (local original `E:\QANDEEL_APP\.la-vis01-visual\closure\device\phone-personal-far.png`) | evidence, 2026-10-07 (`550ce07`) | the full-screen look after LA-VIS-01 | `7eabbd2b6c8fc0d560cea8805499fb2ba055b5edbf51c5ae59898a7b260e0688` | production evidence; two later paint changes followed (§4) |

**Notes on the device captures:**
- **The two R-6C captures** were taken on an emulator (720 × 1280, swiftshader), with the map shown inside the Replay preview. They come from APK-R, built from `main` `06f24a73`. The `apps/` tree is identical between `06f24a73` and `bd80c755`, because PR #388 was documentation only.
- **The LA-VIS-01 capture** is 1080 × 2400, Android 16.
- **None of these captures is a golden.** No test compares against them.

### 3.2 Category 2: TARGET REFERENCE
| Name | Path | Status | Function | SHA-256 | Use |
|---|---|---|---|---|---|
| `Dashboard01` (`Arabic Semantic Galaxy Dashboard01.png`, 958 × 714, 1,347,688 B) | **private storage only, never in this repository:** private references v1 (§3.5); local original `C:\Users\MG\Downloads\Arabic Semantic Galaxy Dashboard01.png`. **Identified here by name and SHA-256 only** (PO decision B-3, §7) | **TARGET REFERENCE**. Supplied by the PO on 2026-11-09; recorded as `NS-CANDIDATE` in the study's V-1 metrics | the visual-quality standard that every new art round is compared with | `5ddaae4c9edae19d3684326bf3da38e77e5eb455e743217844677a3ba64abccb`, equal to the study's record | future design only. **Not a shipped asset.** Its origin and licence are not recorded (§4, G-1). Work that needs the image itself must fetch it from private storage and check its SHA-256 (§2.2) |

### 3.3 Category 3: FINAL APPROVED ART DIRECTION (S3-R2; PO, 2026-11-10)
S3-R2 is S3-R1 (AD-4 with five accepted changes) with the three accepted improvements `core`, `fine` and `fill`. Its repo copy lives in `visual-source/approved-art/s3-r2/`. All 7 files are in `VISUAL-SOURCE.sha256`.

| Name | Path | Status | Function | SHA-256 | Use |
|---|---|---|---|---|---|
| S3-R2 prototype | repo `visual-source/approved-art/s3-r2/proto/web.js` | `FINAL APPROVED VISUAL ART DIRECTION` | the drawing code; the `core`, `fine` and `fill` parameters are fixed as its defaults | `ffc81c4bf4531376bd8648056f569309be28da69c6103ab3c43fded7cc47b2c1` | the V-3 target |
| S3-R2 hero page | repo `visual-source/approved-art/s3-r2/proto/hero.html` | same | the render page. **S3-R2 renders only with** `?p=6000000&wk=2600&s3=amb,bloom,edgeglow,smooth,farweb,core,fine,fill`; the page defaults do not reproduce it | `0bcb1f3de1adf78c542db6fd558656cb9e1ede5d5f4a6ce6a5a4aa84762446b6` | the V-3 target |
| S3-R2 fonts | the page expects `proto/fonts/Estedad-Regular.ttf` and `Estedad-Medium.ttf` (OFL). Not duplicated: byte-identical to repo `apps/mobile/assets/fonts/estedad/` (as for AD-4) | same | — | equal to the app's copies | the V-3 target |
| S3-R2 reproduction note | repo `visual-source/approved-art/s3-r2/S3-R2-ARCHIVE-v1.REPRODUCE.md` | same | the render queries and hashes (S3-R2, S3-R1 and the four single-switch renders), the toolchain and the approved parameters | `f4f1232abfff02471ba00c7b2d31cd5b50e8ce45bba05f646a149d29df59e4bb` | the V-3 target |
| S3-R2 archive manifest | repo `visual-source/approved-art/s3-r2/S3-R2-ARCHIVE-v1.MANIFEST.sha256` | same | the 90 files of the S3-R2 archive v1 (§3.5) | `9fdb70fd7bb5f4d9058fafdcbb7018e646a075280cc2f4720efa5e82f850c518` | provenance |
| S3-R2 review and diff | repo `visual-source/approved-art/s3-r2/S3-R2_VISUAL_REVIEW.md`, `S3-R2-web.js.diff` (against S3-R1) | the text of the approved round | what S3-R2 changed and checked | `d3b5fce9a953147f…`, `2e93f0e413b43cf8…` (full values in `VISUAL-SOURCE.sha256`) | provenance |
| S3-R2 hero, preview | repo `visual-source/approved-art/s3-r2/S3-R2-hero.preview-1200.png`, **derived** (scaled to 1200 × 894) | same | quick look only; not for measurement | `203d2cb9053572f7efe542cdb6139a67e3b567f7253fe9bfc380b5c87d99e4b5` | the V-3 target |
| **S3-R2 hero, original 2400 × 1788** | **local** `E:\QANDEEL_REPORTS\MAP-CLOSE-01\STEP3\…`; **archive:** S3-R2 archive v1 (§3.5) | same | **the approved frame.** It **re-renders byte for byte** from the repo copy (§3.5) | **`6bd028962b4a91e54c541d70232e7a3d820bc6389cf4eac3bf07497c59ae5371`** | the V-3 target |

All S3-R2 data is declared synthetic: names, elements, relations, colours and memberships. **None of it is product data** (rule §2.6).

### 3.3b Category 4 since Step 3: AD-4 (was the temporary art base; historical, not a target)
| Name | Path | Status | Function | SHA-256 | Use |
|---|---|---|---|---|---|
| AD-4 prototype | repo `visual-source/art-base/ad-4/proto/web.js` | `HISTORICAL SINCE STEP 3 — WAS THE TEMPORARY ART BASE — NOT A TARGET` | the drawing code of the base | `2414dd5676ea51163d0435e78f2fe5a43a4a3a3e4460f53006c602fafd6d03ca` | history and provenance |
| AD-4 hero page | repo `visual-source/art-base/ad-4/proto/hero.html` | same | the render page. Its defaults are W 1200, H 894, seed 20261109, 1.5 M particles, 700 k dust and 1,800 walkers, but **AD-4 was rendered with `?p=3000000&wk=2600`** (3 M particles, 2,600 walkers; `AD4_REVIEW.md`). The defaults do **not** reproduce AD-4 (R1 correction) | `c7a681443cfad88ec23548a99803259ad53bf4e06c5e27f138709af0576ad311` | history and provenance |
| AD-4 fonts | the page expects `proto/fonts/Estedad-Regular.ttf` and `Estedad-Medium.ttf` (OFL). Not duplicated: they are byte-identical to repo `apps/mobile/assets/fonts/estedad/` | same | — | Regular `6fa532c2f732eda9d935…`, Medium `eefaca1209c25cbb9555…` (equal to the app's copies) | history and provenance |
| AD-4 review and annex | repo `visual-source/art-base/ad-4/AD4_REVIEW.md`, `AD4_PT10_PT13_ANNEX.md` (study copies; their relative paths point into the study folder) | historical text of the round | what AD-4 changed and checked | `e496664b879d4e3a…`, `f24d236e4405d9a4…` (full values in `VISUAL-SOURCE.sha256`) | history and provenance |
| AD-4 hero, preview | repo `visual-source/art-base/ad-4/AD4-hero.preview-1200.png`, **derived** (scaled to 1200 × 894 from the original) | same | quick look only; not for measurement | `6469c38f895adb84…` | history and provenance |
| AD-4 hero, original 2400 × 1788 | **local** `E:\QANDEEL_REPORTS\MAP-VISUAL-REFRESH-01\AD4\out\AD4-hero.png` (8.1 MB; not committed); **archive:** AD-4 archive v1 (§3.5) | same | the base frame. It **re-renders byte for byte** from the pinned source (§3.5) | `be16f2b70d809f4ca2aed2c2063130ea528e50e93059f6de44108cad59d3c80d` | history and provenance |
| AD-4 world-only | local `…\AD4\out\AD4-world-only.png`; archive: AD-4 archive v1 | same | the data-free world. Byte-identical to AD-2's and AD-3's, and it re-renders byte for byte (`&data=0`) | `ad6ff8be7793b753d895e526a8e4ba30e2513877497fbecd550bf98f80c29fb8` | history and provenance |
| AD-4 board / render results / belonging test | local `…\AD4\board-AD4.png`, `…\AD4\out\AD4-hero.json`, `…\AD4\belong\AD4-annotated.png`; archive: AD-4 archive v1, with every other file in `belong/`, `crops/` and `out/` | same | review evidence | `37b6ec299cea28a0139fe765de83c349e18352d70e75f7f53284a1a4f111202f`, `b4a41f4bc842a30cb5b08d69cb0d1bbb5c5f751ee70c250f6753f3853176bf03`, `7126d8a238cb8cf53820f71db538ced05f3ffbcc63c48222b82eaa827c368b84` | history and provenance |

All AD-4 data is declared synthetic: names, elements, relations, colours and memberships.

### 3.5 Durable archives (R1)
There are two private archives. Each is a zip file attached to a **draft** GitHub release of this repository.
- **Who can see them:** a draft release is visible only to accounts with write access.
- **Checked on 2026-11-10 without signing in:**
  - the public release list is empty;
  - both release pages return 404;
  - no tag was created.
- **What they are not:** outside Git history and not published. **They must never be published without a PO decision.**
- **How to retrieve them:** with write access, `gh release download <tag>`.

| Archive | Draft release tag | zip SHA-256 | Contents | Verified |
|---|---|---|---|---|
| **AD-4 archive v1** (`qandeel-map-ad4-art-base-archive-v1.zip`, 118,815,282 B) | `archive-map-close-01-ad4-art-base-v1` | `3e99669fb6833c4613688411fd1fb50883aad2892c365990adff167ad354362b` | 54 files, listed in [`AD4-ARCHIVE-v1.MANIFEST.sha256`](visual-source/art-base/ad-4/AD4-ARCHIVE-v1.MANIFEST.sha256):<br>• AD-4 `proto/` (with fonts and OFL), `out/`, `board-AD4.*`, `belong/`, `crops/`, review and annex;<br>• the `AD3-hero` the board uses;<br>• the study harness `tools/`;<br>• [`REPRODUCE`](visual-source/art-base/ad-4/AD4-ARCHIVE-v1.REPRODUCE.md).<br>**No third-party image.** | downloaded again: the zip hash matches, and the extracted manifest checks 54 / 54 |
| **Private references v1** (`qandeel-map-private-references-v1.zip`, 3,237,114 B). **Never committed to this repository** | `archive-map-close-01-private-references-v1` | `58f9e14795f938664164a2c4f204e99f52eda1d6699088754f7a45f482c90ac1` | Dashboard01 (`5ddaae4c…`), the LA-VIS-01 reference (`de1f18da…`) and a `NOTICE.md`. **Licence unknown: never publish** | downloaded again: the zip hash matches, and the manifest checks 3 / 3 |

| **S3-R2 archive v1** (`qandeel-map-s3-r2-final-art-archive-v1.zip`, 209,840,836 B), added at Step 3's closure | `archive-map-close-01-s3-r2-final-art-v1` | `247cc5e5a11054e14832565fc9813668d3b1d0adc333d3fe5b07c35e8c0b1994` | 90 files, listed in [`S3-R2-ARCHIVE-v1.MANIFEST.sha256`](visual-source/approved-art/s3-r2/S3-R2-ARCHIVE-v1.MANIFEST.sha256):<br>• S3-R2 `proto/` (with fonts and OFL) and `out/` (the six renders of the REPRODUCE note, each with its result JSON);<br>• the review package the PO approved and the S3-R1 package, kept as history;<br>• the diff, metrics, review and harness `tools/`;<br>• [`REPRODUCE`](visual-source/approved-art/s3-r2/S3-R2-ARCHIVE-v1.REPRODUCE.md).<br>**No third-party image:** Dashboard01 and the private comparison boards are not in it. | downloaded again: the zip hash matches; the release is a draft; the release page returns 404 without signing in; the public release list is empty; no archive tag exists on the remote |

The local working copy is `E:\QANDEEL_REPORTS\MAP-CLOSE-01\archive\`. Its originals in the study folder are unchanged.

**S3-R2 reproduction, proven on 2026-11-10 at Step 3's closure:**
- **Inputs:** only the repo copy in `visual-source/approved-art/s3-r2/proto/` (`web.js`, `hero.html`), with the repo's Estedad fonts from `apps/mobile/assets/fonts/estedad/`.
- **Toolchain:** the same as for AD-4 below.
- **Result:** `?p=6000000&wk=2600&s3=amb,bloom,edgeglow,smooth,farweb,core,fine,fill` gives `6bd028962b4a91e54c541d70232e7a3d820bc6389cf4eac3bf07497c59ae5371`, **byte-identical** to the approved S3-R2 frame.

**Protection against accidental publication (open; G-7).**
- **The risk:** a draft release is private, but anyone with write access can still publish it.
- **Already done:** every release (three since Step 3) is titled "PRIVATE DRAFT", and the private-references release says "never publish".
- **Not done:** no move to storage that **cannot** be published by mistake, such as a separate private repository. That is the PO's decision.

**AD-4 reproduction (G-3), proven on 2026-11-10:**
- **Inputs:** the repo-pinned `web.js` and `hero.html`, with the repo's Estedad fonts.
- **Toolchain:** `tools/shootf.sh`, Chrome 157.0.8103.39 headless with `--disable-gpu`, `sharp` 0.35.5, Node 24.19.0, Windows 11.
- **Results** (both against the original files):

  | Render | Parameters | Result |
  |---|---|---|
  | `AD4-hero.png` | `?p=3000000&wk=2600` | `be16f2b7…`, **byte-identical**; 0 of 4,291,200 pixels differ; the result JSON is equal, timings aside |
  | `AD4-world-only.png` | `&data=0` | `ad6ff8be…`, **byte-identical** |

- **Not re-run:** the board, crops, belonging and colour-vision images.
- The proof holds for this toolchain. Step 3 therefore re-runs it as its first check (§5).

### 3.4 Category 4: HISTORICAL / REJECTED FOR NEW DESIGN
| Name | Path | Status | SHA-256 |
|---|---|---|---|
| LA-VIS-01 reference `Arabic Cosmic Mind Map Interface.png` (2026-10-06; 1,912,779 B) | local `C:\Users\MG\Downloads\`; archive: private references v1. Its origin and licence are not recorded. **It is not in this repository, nor on the comparison board** (§7) | the reference LA-VIS-01 was built against; **superseded as the target by Dashboard01** | `de1f18dabfefaa76b56bd5e0f8615b3ab30158a7367788400b8e0d742c067b51` |
| VPORT-01 device captures (2026-10-01) | repo `docs/e2e/visual-production/vport-01/*` | production evidence **from before LA-VIS-01**; historical for the look | e.g. FAR `ff541605dd03e6666b3a886c98ea6af3d9c76a98bb389068a640a43f63e31b6c`, MID `431e438f…`, NEAR `8f7b4391…` |
| **S3-R1** hero (AD-4 with five accepted changes; approved at Step 3 round 1, superseded by S3-R2) | local `E:\QANDEEL_REPORTS\MAP-CLOSE-01\STEP3\…`; archive: S3-R2 archive v1 (`review-S3-R1-historical/`), and it re-renders from the S3-R2 source with `s3=amb,bloom,edgeglow,smooth,farweb` | **historical since Step 3's closure; not a target** | `b7275b4c00e6870222d382e55715214cb10b485c1fb0c5a7eb5ae72eadadbfd6` |
| R2 hero / board | local `…\MAP-VISUAL-REFRESH-01\R2\out\hero.png`, `R2\board-R2.png` | **visually NOT approved** (PO, 2026-11-09) | `9395f4d89d0efd0507bb547c8a61fee092e778a9ce56a9bda494f2695ba99fe0`, `5ea0a0e82e59b06bcc4594351a408ae696cc4bc0d0c5ddd4bc7682845edf701e` |
| AD-1 hero / board | local `…\AD1\out\AD1-hero.png`, `AD1\board-AD1.png` | superseded | `e61b3f0da7a511829aa7228d476535c2c11b8bb9bb08adbe082bc43225f0e0d4`, `47fa36f59bfd050d4061372b73a876aac1ae7a3ff43e138caef9a998dc5529ac` |
| AD-2 hero / board | local `…\AD2\out\AD2-hero.png`, `AD2\board-AD2.png` | superseded | `746f683014eed12ed542bb4e15782a223bbc2c67ba8984d0a96fdab061a97dca`, `c64b27f877c16c3b4558dbd56057b781cc12ab941234e7a492778d80e9f134bc` |
| AD-3 hero / board | local `…\AD3\out\AD3-hero.png`, `AD3\board-AD3.png` | superseded by AD-4 | `26256ab9c02fece5bf1197fb61485a38870be35aa9c3f0717ea69190eab65399`, `a773708e31d1cdfcbd4926ff866adb7a591c061eaaa7c59d4459843cf3272642` |
| V-1 board | local `…\V-1\board-V1.png` | analysis | `8325002a510ffb90368cc993b246be66803b4a828cb4b8e53bf2209312195602` |
| V-2 boards A / B / C | local `…\V-2\board-A.png`, `board-B.png`, `board-C.png` | **rejected** (PO, R2 review) | `54087a7c826e1d2cab40ac001289ad2dd9ed1a7b5355103c43f1eee52678925c`, `048e064f6c8b6e35e589aaa9d692a89c6cf76538e42e63b251b95696e243677d`, `aa6a98bb0c10131ff34b7254b7ee25b3131e5549f2420f3f203cc2736d63c88d` |
| IA-GATE board | local `…\IA-GATE\board-IA.png` | an information-architecture study, not art | `0f0d9e94897ccd63874de2449bbe168681188528e299a50521238e3effb0772f` |
| Stage 3 navigation-checkpoint images | repo `docs/canonical-authority/experience-architecture/navigation-checkpoint/stage3_foundation/images/*` (e.g. `S3.2_Nebular_Organic_Living_Field_CANONICAL.png`) | historical for the map's look; **their own authority is unchanged** | S3.2 `e217ede3c66ebc02c45969bb3614eb681cd254efd3a179c89418f6c03d878454` |
| Product-proof world images | repo `docs/design/canonical-artifacts/product-proofs/g1.1-r3/…/world-*.png`, `g1.2/…/world-*.png`, `g3/g3.2/boards/*` | historical for the map's look; their own authority is unchanged | `world-dark.png` (g1.1-r3 = g1.2) `1070e96077a0ccefb5895adffa06b95236b4e4acb91374b767c9c39daaea5195` |
| **Unregistered look-alikes. Do not use.** | local `C:\Users\MG\Downloads\Arabic Semantic Galaxy Dashboard.png` (2026-10-06) and `…Dashboard(1).png` (2026-10-07) | **cited by no record. They are not Dashboard01** | `b8ff4df74ce851e9b5bb104550fd49dc74889e65c1bc6aa6e1a5cfb5c1762a1b`, `de39b00505578603204760f6335f3c5a8ab076f0dd306e5454b492d577d35b39` |

## 4. What is proven, and what is missing
**Proven on 2026-11-10:**
- Every SHA-256 above was recomputed from the file.
- The 18 fixed in-repo references and the 19 snapshot entries pass `sha256sum -c`.
- The I-08B1 provenance passes 15 / 15.
- Dashboard01 matches the hash the study recorded.
- The AD-4 copies are byte-identical to the study files.
- AD-4's world-only render is byte-identical to AD-2's and AD-3's.
- The R-6C captures come from `apps/` code identical to `bd80c755`.
- **R1:**
  - AD-4's hero and world-only renders reproduce byte for byte from the pinned source (§3.5).
  - Both private archives were downloaded again and checked against their hashes and manifests.
- **Step 3's closure (2026-11-10):**
  - the 7 S3-R2 repo files match their SHA-256 (25 / 25 with Step 2's 18);
  - S3-R2 re-renders byte for byte (`6bd02896…`) from the repo copy alone (§3.5);
  - the S3-R2 archive v1 is a private draft release, and it holds no third-party image (§3.5).

**Missing or unconfirmed.** None of these blocks the PO's review of this registry. G-1 needs a PO decision before merge (§7).

| # | Gap | Effect | Resolve |
|---|---|---|---|
| G-1 | Dashboard01's **origin and licence** are not recorded, and this repository is **public**. The same holds for the LA-VIS-01 reference | a copy in this repository would be a publication | **Decided (B-3):** neither image is in this branch; both are held privately (§3.5). Publishing either needs the right to publish to be recorded first |
| G-2 | **No full-screen device capture of the current code** exists after SHARED-VIS-01 (2026-10-09) and S8B-06 F-G (2026-11-04). The R-6C captures show the map inside the Replay preview; the LA-VIS-01 capture predates those two changes | category 1 is identified by its code; its full-screen picture is slightly out of date | capture Personal FAR / MID / NEAR from `main` when a device run is authorized |
| G-3 | **R1: resolved for this toolchain.** AD-4's hero and world-only renders reproduce byte for byte (§3.5). The board, crops and belonging images were not re-run | the proof holds only for the recorded toolchain | **mandatory first check of Step 3:** re-run the reproduction on the toolchain in use, and stop if it differs |
| G-4 | **R1: resolved.** AD-4's originals are archived off-device, in private, with a manifest (§3.5) | — | — |
| G-5 | **R1: mostly resolved.** The harness is in the AD-4 archive. Still external: Chrome and `sharp` 0.35.5, which `shootf.sh` loads from `E:\s8b07spike` | a rebuild on another machine needs those two, at the recorded versions | recorded in `AD4-ARCHIVE-v1.REPRODUCE.md` |
| G-6 | **Resolved at Step 3's closure.** S3-R2 is the FINAL APPROVED VISUAL ART DIRECTION (PO, 2026-11-10; §3.3) | — | — |
| G-7 | The private references sit in a **draft release**. A person with write access could publish it by mistake | they could be exposed in public | the PO decides on storage that cannot be published by mistake (§3.5) |
| G-8 | Dashboard01 is still readable in PR #389's commit `05de5286`, as a branch and as `refs/pull/389/head` | exposure that has already happened | the rest of B-3 (§7), on the PO's instruction |

## 5. MAP-CLOSE-01: context
**Goal (PO):**
1. approve the new map graphic;
2. implement it;
3. test it;
4. close the Living Analysis map completely;
5. then return to Replay.

| Step | What | State |
|---|---|---|
| Step 1 | close CP-A as planning only | **done**. PR #388 merged as `bd80c755` (2026-11-10) |
| Step 2 | Visual Source of Truth (this registry) | **done**. Merged through PR #390 as `5a21971d` (2026-11-10) |
| Step 3 | finish the art design from AD-4, compared with Dashboard01; its mandatory first check (AD-4 reproduces byte for byte) passed | **`CLOSED / FROZEN`** (PO, 2026-11-10): S3-R2 is the FINAL APPROVED VISUAL ART DIRECTION; no S3-R3; AD-4 and S3-R1 are historical (§3.3, §3.4). Closed in the V-3 change |
| **Step 4 / V-3** | **production visual port of S3-R2** into the existing production map: the current engine, real data, its interactions and the contracts in force; the Analysis screen UI around the map is added to its scope (PO, 2026-11-10), as a separate reviewable part after the drawing is proven | **current, authorized** (PO, 2026-11-10). Record: [`QANDEEL_MAP_CLOSE_01_V3_PRODUCTION_VISUAL_PORT_RECORD_v1.md`](../../../e2e/QANDEEL_MAP_CLOSE_01_V3_PRODUCTION_VISUAL_PORT_RECORD_v1.md). Production changes merge only on the PO's approval |
| after V-3 | close the map completely, then return to S8B-07 Replay | not started |

**Not opened:** AD-5, any further art round, N4, CAL-2. Topic intelligence (CP-A) remains planning only. Replay work does not start inside V-3.

## 6. Not done
**At Step 3's closure:** this registry gains the S3-R2 entries and the Step 3 decisions only. What V-3 changes in production, and every amendment it makes, is in the V-3 record, not here.

**At Step 2:**
- No renderer, data, generated-token, test or frozen-contract change.
- `living-analysis/README.md`, `SOURCE-PROVENANCE.*` and `i-08b1/` are untouched.
- No production authority is retired.
- No device or CI run, and no AI call.
- The comparison board was rendered locally, with headless Chrome, from scaled copies of the files above. Its HTML source stays in the local report folder `E:\QANDEEL_REPORTS\MAP-CLOSE-01\step2-board\`.
- **R1:**
  - the AD-4 re-renders are verification only. Nothing in AD-4 changed, and no AD-5 was opened;
  - the archives are draft releases and are **not published**;
  - no history is rewritten anywhere (B-2 is rejected).

## 7. Dashboard01 and the public repository: decision B-3 (PO, 2026-11-10)
**Facts:**
- The repository is **public**.
- Draft PR #389 put Dashboard01 (`5ddaae4c…`, Git blob `b915d275…`) into Git in commit `05de5286`. Its comparison board also showed Dashboard01 and the LA-VIS-01 reference.

**Decision:**
- **B-3:** the approved content moves to this clean branch from `main`, without reusing or cherry-picking any commit from PR #389.
- **B-2 (force-push) is rejected.**

**This branch:**
- **Excluded:**
  - Dashboard01;
  - the LA-VIS-01 reference;
  - the original comparison board.
- **Included:**
  - the registry, adapted;
  - the Option B board;
  - the AD-4 base files, the archive manifest and the reproduction note;
  - the production captures and both hash files.
- **Verified:** no object reachable from this branch is Dashboard01's blob `b915d275…`, the original board's blob, or the LA-VIS-01 reference's blob. Checked with `git rev-list --objects HEAD`.
- **What `main` receives:** this branch carries no protected image, so merging it brings none into `main`.

**Not done in this change.** Each waits for the PO's explicit instruction:
- closing PR #389;
- deleting its branch;
- asking GitHub Support to purge `05de5286` and `refs/pull/389/head`;
- moving the private references to storage that cannot be published by mistake (G-7).

None of these can reach copies that others have already made.
