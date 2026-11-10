# QANDEEL — MAP-CLOSE-01 Step 4 / V-3 — Production Visual Port of S3-R2 — Record v1

**Status:** `MAP-CLOSE-01 STEP 4 / V-3 — PART A SLICE 1 (NODES AND RELATIONS) DELIVERED ON A DRAFT PR — PART A SLICE 2 AND PART B (ANALYSIS SCREEN UI) NOT STARTED — NOT MERGED`
**Task:** MAP-CLOSE-01 Step 4 / V-3, the production visual port of the approved S3-R2 art direction into the existing Personal Living Analysis map.
**Date:** 2026-11-10. **Baseline:** `main` at `5a21971d` (the merge of PR #390, MAP-CLOSE-01 Step 2). **Branch:** `map/map-close-01-v3-production-port`.
**Authority:** Product Owner, 2026-11-10, two messages:
1. **"PO Final Visual Approval & Step 4 / V-3":** S3-R2 is the FINAL APPROVED VISUAL ART DIRECTION; close Step 3; V-3 is authorized.
2. **"إضافة محدودة إلى V-3 قبل الإغلاق":** the Analysis screen UI around the map joins V-3's scope, as a separate reviewable part after the drawing is proven (§11).

**Merge rule:** production changes are not merged before the PO's approval.

> **The production map now draws its nodes and relations in the S3-R2 grammar, from real data only. The engine, the placement, the interactions and every meaning underneath it did not move.**

---

## 1. Scope and limits
**In scope (PO):**
- port S3-R2 into the existing production map: the current engine, real data, its interactions, the contracts in force;
- space depth, coloured lighting, node shapes, relations, organic threads, quiet fill;
- keep interaction, zoom, pan and accessibility;
- phone performance from the start; the priority of active calls;
- test the real Personal map on Android: FAR / MID / NEAR, empty and full, touch and zoom, Arabic font, performance;
- keep the drawing reusable for Replay, without starting Replay.

**Limits (PO), all held:**
- no N4 and no CAL-2;
- no change to Qandeel's intelligence, to data facts or to their semantic order;
- no silent change to a frozen contract: every amendment is named in §6;
- Dashboard01 and the private references are not published (none is in this change);
- no art redesign from scratch, no new engine, no research phase.

## 2. The source, pinned
- **Target:** S3-R2, as pinned in the [Visual Source Registry](../design/canonical-artifacts/living-analysis/VISUAL-SOURCE-REGISTRY.md) §3.3: `proto/web.js` `ffc81c4b…`, `proto/hero.html` `0bcb1f3d…`, the approved frame `6bd02896…`.
- **Reproduced before any port work:** S3-R2 re-renders byte for byte (`6bd02896…`) from the repo copy alone, with the app's Estedad fonts (registry §3.5).
- **No fallback:** the registry's rule §2.6 binds V-3 to S3-R2. It never falls back to I-08B1, AD-4, S3-R1 or Dashboard01 as the target. A missing or mismatched S3-R2 file stops the work.
- **Historical contracts kept as they are:** I-08B1 / VPORT-01 and their frozen contracts stay in force for everything V-3 does not amend (§6).

## 3. Technical review: the smallest change
**The owners that draw the Personal map:**
- `DepthComposition` → `LivingAnalysisMap` → `LivingAnalysisSurface` → `MapSurface` → `WorldViewSurface` → `useWorldSurface`;
- `MapCanvas`: the Personal owner of the paint (what a Home is, what a hosted appearance is, which tether joins them);
- `WorldCanvas`: the generic composition (tone, ground, atmosphere strata, plane, place atmospheres, objects, veil, register);
- `WorldMarks`: the node and relation grammar; `WorldStrata`: ground, nebula, stars, dust, veil; `world-chroma`: the six presentation families.

**What production data offers (and what it does not):**

| S3-R2 element | Production data | Ported |
|---|---|---|
| node light (coloured bloom, hot core, rays, ring) | every disclosed Home (`THREAD_HOME`) and hosted appearance (`CONTEXTUAL_APPEARANCE`) | **yes**, Slice 1 |
| relations as lines of light | the Home → appearance hosting relation (the tether), and nothing else | **yes**, Slice 1, on the hosting relation only |
| colour around each place | the world's chroma at the Home's canonical address (LA-VIS-01), meaning-free | **yes**: a mark and its tether take their PLACE's chroma |
| deep-space depth, fine threads inside a place's own mass, quiet fill | world-anchored strata and the place masses already in production | **not yet** (Slice 2, §10) |
| named groups / clusters, colour by group | **none in production** | **no: needs L2** |
| topic labels or Arabic names on the map | **none in production** | **no: needs L2** |
| relations between nodes of different places | **none in production** (only hosting tethers) | **no: needs L2** |
| "transition" threads between groups | **none** | **no: needs L2** |

The L2 elements wait for the governed L2 / N4 contract (CP-A record, planning only). Drawing them now would invent semantic groups. **Proximity and colour never mean membership here:** a colour is a function of a Home's canonical address only.

**The smallest change that does the port:** two files of paint, and nothing that decides.
- `MapCanvas` hands each mark and each tether one optional `chroma`: the chroma at its place — its own Home's address, or the address of the Home that hosts it (one helper, `placeChromaOf`). The register is unchanged.
- `WorldMarks` draws the S3-R2 node grammar (`ChromaticMark`) and the S3-R2 relation (a line of light with a gentle bow) when a chroma is given, under standard contrast. Under increased contrast, and wherever no chroma is given, the frozen grammar is drawn exactly as before.

## 4. Truth and meaning (unchanged)
- **Placement, hit testing, camera, membership, accessibility:** untouched. The structural diff of both goldens proves the host tree and every anchor are identical in every case (§7).
- **Selection** is still a shape: the frozen SELECTED marker replaces the ring; the ring is drawn as light (a gradient-filled disc), never as a second outline.
- **Family** is still a shape: each mark's centre is its family's own morphology, smaller and near-white.
- **The bow of a relation** is presentation only: its side is a fixed function of its two ends, and its ends are exactly the placement's.
- **Ray angles and lengths** come from the mark's meaning-free presentation angle, like its rotation.
- **Shared and Public worlds** keep the frozen grammar: only the Personal owner passes a chroma.
- **Increased contrast** keeps F1's full-width relation core and the frozen grammar.

## 5. What changed
| File | Change |
|---|---|
| `apps/mobile/src/map/renderer/MapCanvas.tsx` | `placeChromaOf`; `chroma` on each `WorldTether` and `WorldObject` |
| `apps/mobile/src/map/visual/WorldMarks.tsx` | optional `chroma` on the object, mark and tether props; `ChromaticMark`, `LitRim`, `rayPath`, `bowedPath`; the `CHROMATIC` shares and lifts (sizes, weights and lifts only; every hue and saturation is the place's chroma) |
| both goldens | re-recorded after the structural diff (§7) |
| `tests/vport-02-…` | controlled re-anchor of the two pins (§6) |
| `tests/vport-01-…` | the V-3 chroma rule made explicit (§6) |
| registry, `VISUAL-SOURCE.sha256`, `approved-art/s3-r2/` | Step 3's closure (§8) |

**R1 (after the first device comparison):** the first build drew a large white centre inside a pale ring, and the relations read as dim rails. R1 makes the centre smaller and the hot point whiter, draws the ring closer and more saturated, strengthens the bloom, and draws each relation as a single bowed line of light (no dark ground and no wide body under it).

## 6. Controlled amendments (named; none silent)
| Contract | Amendment | Why it is allowed |
|---|---|---|
| VPORT-02 world pins (`tests/vport-02-temporal-orientation-p2-contract.test.mjs`) | `MapCanvas` `a82f761f` → `cabef8ef`; `WorldMarks` `8b81a4e4` → the R1 blob; recorded in the test as "MAP-CLOSE-01 V-3 — CONTROLLED RE-ANCHOR" with the previous pins | PO authorization of V-3 (2026-11-10); paint-only by the structural diff |
| VPORT-01 chroma rule (`tests/vport-01-world-visual-contract.test.mjs`) | **tightened**, not relaxed: the Personal owner reads the chroma in `placeChromaOf` only, by a Home's address or its host Home's, and passes it to a tether and an object only. A mutation that colours a mark by anything else fails the test | makes the V-3 extension explicit |
| Personal map and screen goldens | re-recorded | paint-only by the structural diff (§7) |

No other frozen file changed. The chroma families (`world-chroma.ts`) and every token are unchanged.

## 7. Verification
_(filled in §7 after the device run.)_

## 8. Step 3's closure (recorded here and in the registry)
- S3-R2 is the FINAL APPROVED VISUAL ART DIRECTION; no S3-R3; AD-4 and S3-R1 are historical.
- The registry gains the S3-R2 rows (§3.3), the archive row (§3.5) and rule §2.6; its hash file checks 25 / 25.
- The S3-R2 archive v1 is a private draft release (`archive-map-close-01-s3-r2-final-art-v1`), with no third-party image.

## 9. Performance and the active call
_(filled after the device run.)_

## 10. Not done yet
- **Part A Slice 2:** deep-space depth, fine threads inside each place's own mass in its own chroma, quiet fill (S3-R2 `fine`, `fill`, `farweb`), with phone-sized particle counts.
- **Part B:** the Analysis screen UI (§11).
- **A physical phone:** none is connected. Every device result in this record is from the Android emulator, and is never claimed as phone proof.

## 11. Part B — the Analysis screen UI (PO addition, 2026-11-10; not started)
_(design note filled when Part B starts, after the drawing is proven.)_

## 12. Backlog
_(reconciled at V-3's closure.)_
