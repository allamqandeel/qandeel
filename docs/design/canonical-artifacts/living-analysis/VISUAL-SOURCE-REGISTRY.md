# QANDEEL — Living Analysis Map — Visual Source Registry v1

**Status:** `MAP-CLOSE-01 STEP 2 — VISUAL SOURCE REGISTRY — DRAFT FOR PO REVIEW — NOT APPROVED — DOCUMENTATION ONLY`
**Task:** MAP-CLOSE-01 Step 2, the Visual Source of Truth for the Personal Living Analysis map.
**Date:** 2026-11-10. **Baseline:** `main` at `bd80c755` (the merge of PR #388). **Branch:** `map/map-close-01-visual-source-registry`.
**Authority:** Product Owner, MAP-CLOSE-01 Step 2 (2026-11-10). It is documentation only.
- It changes no renderer, data, generated token or frozen contract.
- It opens no AD-5, V-3, Replay, N4 or CAL-2 work.

**Why it exists:** so that no development, test or rebuild of the map falls back by mistake to an older look. Every map reference sits in exactly one of four categories (§1), and work starts under the rule in §2.

**Machine check:** `sha256sum -c` run from the repository root on
[`visual-source/VISUAL-SOURCE.sha256`](visual-source/VISUAL-SOURCE.sha256) (17 fixed references) and on
[`visual-source/PRODUCTION-CODE-SNAPSHOT-bd80c755.sha256`](visual-source/PRODUCTION-CODE-SNAPSHOT-bd80c755.sha256).
- The second file is a snapshot of the production code at `bd80c755`.
- It **will** drift whenever production code changes. That drift is expected, and it is not a registry failure.

**Comparison board:** [`visual-source/comparison/MAP-CLOSE-01-VISUAL-SOURCE-COMPARISON.png`](visual-source/comparison/MAP-CLOSE-01-VISUAL-SOURCE-COMPARISON.png).

---

## 1. The four categories
| # | Category | What it is | Authority | Use |
|---|---|---|---|---|
| 1 | **CURRENT PRODUCTION** | the map the app draws today: I-08B1 → VPORT-01 → LA-VIS-01 → SHARED-VIS-01 → S8B-06 F-G | **in force.** I-08B1 is `CLOSED / FROZEN`; the production code and its contracts govern | production, regression and tests of today's app. **It is not the visual target of new work** |
| 2 | **TARGET REFERENCE** | `Dashboard01` | the art reference the new direction started from (PO, 2026-11-09) | the comparison standard for **visual quality** only (§2.3) |
| 3 | **CURRENT ART BASE** | `AD-4` | the latest base the PO kept, as **temporary**: not final, not approved, not North Star (2026-11-09) | the starting point for finishing the art design (next step) |
| 4 | **HISTORICAL / REJECTED FOR NEW DESIGN** | older study rounds, older references and older captures | none for new design | history and provenance only. **Never presented as the required look** |

## 2. The rule (proposed; binding once the PO approves this registry)
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

## 3. Registry
Hashes are SHA-256. They were recomputed on 2026-11-10 from the files at the paths shown.
- "Repo" paths are relative to the repository root.
- "Local" paths are on the PO's machine and are **not in Git.**

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
| `Dashboard01` (`Arabic Semantic Galaxy Dashboard01.png`, 958 × 714, 1,347,688 B) | repo `visual-source/target/arabic-semantic-galaxy-dashboard01.png`, a byte-identical copy; local original `C:\Users\MG\Downloads\Arabic Semantic Galaxy Dashboard01.png` | **TARGET REFERENCE**. Supplied by the PO on 2026-11-09; recorded as `NS-CANDIDATE` in the study's V-1 metrics | the visual-quality standard that every new art round is compared with | `5ddaae4c9edae19d3684326bf3da38e77e5eb455e743217844677a3ba64abccb`, equal to the study's record | future design only. **Not a shipped asset.** Its origin and licence are not recorded (§4) |

### 3.3 Category 3: CURRENT ART BASE (AD-4; temporary; not final; not approved)
| Name | Path | Status | Function | SHA-256 | Use |
|---|---|---|---|---|---|
| AD-4 prototype | repo `visual-source/art-base/ad-4/proto/web.js` | `TEMPORARY ART BASE — NOT FINAL — NOT APPROVED` | the drawing code of the base | `2414dd5676ea51163d0435e78f2fe5a43a4a3a3e4460f53006c602fafd6d03ca` | future design |
| AD-4 hero page | repo `visual-source/art-base/ad-4/proto/hero.html` | same | its render parameters: W 1200, H 894, seed 20261109, 1.5 M particles, 700 k dust, 1,800 walkers | `c7a681443cfad88ec23548a99803259ad53bf4e06c5e27f138709af0576ad311` | future design |
| AD-4 fonts | the page expects `proto/fonts/Estedad-Regular.ttf` and `Estedad-Medium.ttf` (OFL). Not duplicated: they are byte-identical to repo `apps/mobile/assets/fonts/estedad/` | same | — | Regular `6fa532c2f732eda9d935…`, Medium `eefaca1209c25cbb9555…` (equal to the app's copies) | future design |
| AD-4 review and annex | repo `visual-source/art-base/ad-4/AD4_REVIEW.md`, `AD4_PT10_PT13_ANNEX.md` (study copies; their relative paths point into the study folder) | historical text of the round | what AD-4 changed and checked | `e496664b879d4e3a…`, `f24d236e4405d9a4…` (full values in `VISUAL-SOURCE.sha256`) | future design |
| AD-4 hero, preview | repo `visual-source/art-base/ad-4/AD4-hero.preview-1200.png`, **derived** (scaled to 1200 × 894 from the original) | same | quick look only; not for measurement | `6469c38f895adb84…` | future design |
| AD-4 hero, original 2400 × 1788 | **local** `E:\QANDEEL_REPORTS\MAP-VISUAL-REFRESH-01\AD4\out\AD4-hero.png` (8.1 MB; not committed) | same | the base frame | `be16f2b70d809f4ca2aed2c2063130ea528e50e93059f6de44108cad59d3c80d` | future design |
| AD-4 world-only | local `…\AD4\out\AD4-world-only.png` | same | the data-free world. Byte-identical to AD-2's and AD-3's, re-verified | `ad6ff8be7793b753d895e526a8e4ba30e2513877497fbecd550bf98f80c29fb8` | future design |
| AD-4 board / render results / belonging test | local `…\AD4\board-AD4.png`, `…\AD4\out\AD4-hero.json`, `…\AD4\belong\AD4-annotated.png` | same | review evidence | `37b6ec299cea28a0139fe765de83c349e18352d70e75f7f53284a1a4f111202f`, `b4a41f4bc842a30cb5b08d69cb0d1bbb5c5f751ee70c250f6753f3853176bf03`, `7126d8a238cb8cf53820f71db538ced05f3ffbcc63c48222b82eaa827c368b84` | future design |

All AD-4 data is declared synthetic: names, elements, relations, colours and memberships.

### 3.4 Category 4: HISTORICAL / REJECTED FOR NEW DESIGN
| Name | Path | Status | SHA-256 |
|---|---|---|---|
| LA-VIS-01 reference `Arabic Cosmic Mind Map Interface.png` (2026-10-06; 1,912,779 B) | local `C:\Users\MG\Downloads\` | the reference LA-VIS-01 was built against; **superseded as the target by Dashboard01** | `de1f18dabfefaa76b56bd5e0f8615b3ab30158a7367788400b8e0d742c067b51` |
| VPORT-01 device captures (2026-10-01) | repo `docs/e2e/visual-production/vport-01/*` | production evidence **from before LA-VIS-01**; historical for the look | e.g. FAR `ff541605dd03e6666b3a886c98ea6af3d9c76a98bb389068a640a43f63e31b6c`, MID `431e438f…`, NEAR `8f7b4391…` |
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
- The 17 fixed in-repo references and the 19 snapshot entries pass `sha256sum -c`.
- The I-08B1 provenance passes 15 / 15.
- Dashboard01 matches the hash the study recorded.
- The AD-4 copies are byte-identical to the study files.
- AD-4's world-only render is byte-identical to AD-2's and AD-3's.
- The R-6C captures come from `apps/` code identical to `bd80c755`.

**Missing or unconfirmed.** None of these blocks the PO's review of this registry.

| # | Gap | Effect | Resolve |
|---|---|---|---|
| G-1 | Dashboard01's **origin and licence** are not recorded | it is safe as an internal art reference only | the PO confirms the right to use it before any external use |
| G-2 | **No full-screen device capture of the current code** exists after SHARED-VIS-01 (2026-10-09) and S8B-06 F-G (2026-11-04). The R-6C captures show the map inside the Replay preview; the LA-VIS-01 capture predates those two changes | category 1 is identified by its code; its full-screen picture is slightly out of date | capture Personal FAR / MID / NEAR from `main` when a device run is authorized |
| G-3 | **Reproducing AD-4 from the pinned source was not run.** No re-render was compared with `be16f2b7…` | AD-4's frame is pinned by hash; its rebuild from the source is unproven | the first check of the next step, before any change to AD-4 |
| G-4 | AD-4's full-resolution hero, board and belonging test are **local only** (8–20 MB each); the repo holds hashes and a preview | losing the local folder would lose the originals | the PO decides whether to keep them in Git (size) or in another archive |
| G-5 | The study's render harness (`tools/shootf.sh`, `tools/ad4-*.mjs`) is not in the repo. It depends on Chrome and on `sharp` from `E:\s8b07spike` | a rebuild needs the local tools | carried into the next step with G-3 |
| G-6 | **No art base is approved as final**; AD-4 is temporary | the next step must produce one | Step 3 (§5) |

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
| **Step 2** | **Visual Source of Truth (this registry)** | **current**: Draft PR for PO review |
| Step 3 (named; not authorized) | finish the art design **from AD-4**, compared with Dashboard01 | after this registry is approved |
| later (stated goals; not yet numbered by the PO) | approve the new graphic → implement it through governance → test it → close the map → return to Replay | not started |

**Not opened:** AD-5, V-3, Replay, N4, CAL-2. Topic intelligence (CP-A) remains planning only.

## 6. Not done
- No renderer, data, generated-token, test or frozen-contract change.
- `living-analysis/README.md`, `SOURCE-PROVENANCE.*` and `i-08b1/` are untouched.
- No production authority is retired.
- No device or CI run, and no AI call.
- The comparison board was rendered locally, with headless Chrome, from scaled copies of the files above. Its HTML source stays in the local report folder.
