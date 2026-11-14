# COSMOS — Android feasibility proof (experimental, isolated)

**Status:** EXPERIMENT. Not a product surface, not authorised for production, not merged. Branch
`experiment/living-world-cosmic-v5`. **Nothing here has been run on a device or an emulator**: the code was written
against the installed libraries' sources and types, type-checked, linted, unit-tested and rasterised headlessly. The
Product Owner's phone is the first place it runs.

Everything the proof shows is a labelled synthetic fixture (`SYNTHETIC FIXTURE · NOT REAL ANALYSIS` / its Arabic
equivalent, on screen at all times). No Personal names are drawn (N4 is not authorised).

## What it is

One Skia canvas that draws the cosmic stage (`apps/mobile/src/cosmos/core`) the way the browser gate
(`apps/mobile/experiments/cosmos-gate`) draws it, over the **production** authorities:

| Part | File |
|---|---|
| The Skia host (camera on the UI thread, gestures, labels, probe) | `apps/mobile/src/cosmos/skia/CosmosCanvas.tsx` |
| What one frame draws, as pure elements | `apps/mobile/src/cosmos/skia/parts.tsx` |
| A stage prepared once for Skia (atlas instances, paths) | `apps/mobile/src/cosmos/skia/prepare.ts` |
| The UI-thread twins of the camera and plate maths | `apps/mobile/src/cosmos/skia/worklets.ts` |
| The three world owners over the production controllers | `apps/mobile/src/cosmos/__validation__/owners.ts` |
| The fixture network under the production clients | `apps/mobile/src/cosmos/__validation__/fixture-transports.ts` |
| The proof root (chrome, Measurements sheet, Overview) | `apps/mobile/src/cosmos/__validation__/CosmosProofRoot.tsx` |
| Deep links and the JS-heap reading | `apps/mobile/src/cosmos/__validation__/measure.ts` |
| Entry and its selector | `apps/mobile/src/cosmos/__validation__/cosmos-proof-entry.tsx`, `apps/mobile/scripts/select-cosmos-proof-entry.mjs` |
| The on-device measurement run | `apps/mobile/experiments/cosmos-proof/measure-honor.sh` |

A frame is: the DEEP plate (one tiled fill), the GAS plate (additive), then under one camera matrix, per visible rung,
**one atlas draw** for all of its sprites (additive) and one stroked path per hairline set (plus the Shared horizon),
then the VEIL plate in front (additive) and a static lens. The camera lives only in Reanimated shared values; no React
render and no JS-thread work happens per frame during a gesture or a settle.

## Measurement

- **Overdraw modes — measurement only.** `FULL` (default; the look), `NO_BODIES` (hides only the three FIBRE plates and
  PUFF), `PLATES_ONLY` (the atmosphere alone). The difference in frame time between them at FAR is the primary evidence
  of what the nebula bodies cost. A prepared-tile strategy is **deliberately not implemented**: the Product Owner
  decided no such optimisation is introduced before device measurements identify the bottleneck.
- **Frame probe (in the app's HUD).** UI-thread frame-callback intervals during a gesture and its settle: frames,
  average fps, p50, p95, max, stalls (> 50 ms), freezes (> 100 ms), for the last PAN and the last ZOOM, with the mode.
  These are **not** display-presented frame times.
- **Gesture event → next UI frame.** Both stamps are `performance.now()` on the UI runtime. This is **not**
  touch-to-photon latency; that needs external capture.
- **Open times.** From the switch to (a) the authority's READY and (b) the first UI frame after a non-empty stage and
  its images were committed to the canvas (a proxy, not a presented-frame time); COLD for the first open of the
  process, WARM after.
- **Memory.** "Open/close ×20" mounts and unmounts the world canvas 20 times and reads the JS heap. Native and graphics
  memory are read with adb.
- **Presented frames, opening and memory from outside:** `measure-honor.sh <package-id>` (SurfaceFlinger present times
  on the app's layer; `am start -W`; `dumpsys meminfo`). Written without a device; its header marks what may need a fix
  on first run, and says what the HWUI overdraw view can and cannot show for a Skia canvas.

Deep links (scheme `qandeel-cosmos-proof://`, registered only in the generated manifest of the proof build):
`world/personal|shared|public`, `mode/full|no-bodies|plates`, `step/in|out`, `cycle/<n>`, `drift/on|off`,
`surface/texture|surface`, `lang/ar|en`.

## Experimental departures that need the Product Owner's approval

1. **The world magnifies under the fingers during a pinch** (production applies nothing until release). The canonical
   act is still one semantic step at the end of the gesture (`core/camera.ts`).
2. **Overview** — presentation only. It eases the presentation camera out to frame every entity the client holds, may
   go below the first rung, dispatches nothing canonical, shows an "overview (presentation only)" tag, disables entity
   taps, and returns on any tap, gesture end or Back.

## What is verified, and what is not

Verified here: TypeScript, ESLint, Jest (stage determinism, layer opacities, absences, adapters, the owners against the
production controllers headlessly, a mount / switch smoke test of the proof root), and a headless raster of the frame's
own elements with CanvasKit (the atlas tint and additive blend, sprite placement, plates, modes).

Not verified, and only a phone can: that it runs at all on the device; frame pacing; gesture behaviour (pan with pinch,
tap against drag); the native recorder's handling of the atlas and its mip-mapped sampling; label placement and Arabic
shaping in scaled views; image decoding from the release bundle; memory behaviour; the measurement script.

## Build (the repository's proof recipe)

```
COSMOS_PROOF=1 node apps/mobile/scripts/select-cosmos-proof-entry.mjs --apply
cd apps/mobile && npx expo prebuild --platform android --no-install
#   in the GENERATED project only: applicationId "com.qandeel.mobile.cosmosproof", app_name "QANDEEL Cosmos Proof",
#   and a VIEW intent-filter for the scheme qandeel-cosmos-proof on MainActivity
cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
COSMOS_PROOF=1 node apps/mobile/scripts/select-cosmos-proof-entry.mjs --restore
```

The `main` switch and the generated `android/` are never committed.
