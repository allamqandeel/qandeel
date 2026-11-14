# NASIJ — measurements and the Replay feasibility model

**Experiment:** `experiment/living-world-independent-v4` · 2026-11-14
**Machine for everything below:** this session's cloud container, 4 vCPU Intel Xeon 2.30 GHz, no GPU, no
`/dev/kvm`. **No phone and no emulator was used. Nothing here is a HONOR result.**

## 1. What was and was not measured

| Requested | Status |
|---|---|
| Pan fps and frame p95 on the HONOR | **Not measured.** Needs the PO's phone and the proof APK |
| Zoom IN / OUT pacing on the HONOR | **Not measured** |
| Cold and warm open on the HONOR | **Not measured.** The proof build shows open-to-first-draw on screen |
| Touch-to-visible latency | **Not measured** |
| CPU / GPU usage, JS-thread work on device | **Not measured.** By construction the mobile host does no JS work per frame; unverified on device |
| Native memory over repeated opens | **Not measured.** No claim that the 0.7 MB/open growth is fixed |
| Scene complexity at realistic volume | Measured (section 2) |
| Frame pacing of the same scene core in a browser | Measured, software rendering (section 3) |
| Replay rasterisation and encode cost | Measured (section 4) |

The proof build carries its own frame probe: after each gesture it prints p50, p95, max and fps of the frames
of that gesture. Those numbers, read on the HONOR, are the comparison this document cannot make.

## 2. Scene complexity

Compiled draw lists, counted by `drawOpsAtRest` and by the hosts' own draw counters.

| Scene | Entities | Compile | Draws at rest | Draws during a rung change |
|---|---:|---:|---:|---:|
| Public, repository fixture | 29 | 4.8 ms | 4 | 5 to 6 |
| Public, synthetic stress field | 400 (the server's read bound) | 12.6 ms | 4 | 5 to 6 |
| Shared, fixture World A | 12 | under 5 ms | 7 (includes the woven border) | 8 to 9 |
| Personal, 8 threads and 17 hosted readings | 25 | under 5 ms | 5 | 6 to 7 |

Compile times are Node 22 on the container. The draw count is flat in the number of entities.

## 3. Frame pacing of the browser preview

Headless Chromium with **software rendering**, viewport 412×892 at device scale 2.625 (1081×2341 pixels, close
to the HONOR's width), scripted 700 ms drags and canonical zoom steps. This measures the scene core and its
Canvas2D host on a CPU. It is evidence about where the cost is, not a prediction for a phone GPU.

Before the refinement (ground fill, two weave fills and a lantern gradient every frame):

| | Pan | Zoom IN | Zoom OUT |
|---|---|---|---|
| All four scenes | 42 to 44 fps, p95 33 ms | 30 fps, p95 33 to 50 ms | 35 to 42 fps |

The four scenes were indistinguishable, 29 entities or 400. So the cost was full-screen fill, not geometry.
That was the one refinement: bake the ground into an opaque weave tile, draw the second weave gauge only
during a rung change, and hand the static lantern shade to the compositor.

After the refinement:

| Scene | Pan | Zoom IN | Zoom OUT |
|---|---|---|---|
| Personal | 59.8 fps, p50 16.7, p95 16.7, max 33.3 ms | 52.2 fps, p95 33.3 | 58.9 fps, p95 16.8 |
| Shared | 60.0 fps, p95 16.7, max 16.8 | 54.4 fps, p95 33.3 | 57.9 fps, p95 16.8 |
| Public, 29 | 60.0 fps, p95 16.7, max 16.8 | 50.0 fps, p95 33.4 | 56.7 fps, p95 33.3 |
| Public, 400 | 60.0 fps, p95 16.8, max 16.8 | 55.6 fps, p95 33.3 | 56.7 fps, p95 33.2 |

With the CPU throttled 4× and still no GPU, pan falls to about 20 fps in every scene. That is a CPU painting
2.5 million pixels per frame, which a phone does on its GPU. It shows the remaining cost is fill rate, and
that is the thing to watch on the HONOR.

A build was running on the same machine during these runs, so they are conservative rather than clean.

## 4. Replay: a five-minute video, measured

The same draw list, rasterised headlessly by Skia on the CPU (`@napi-rs/canvas`), 720×1280 at 30 fps, which is
the repository's approved target (S8B-01, D-C1). Script: `apps/mobile/experiments/nasij-replay-bench/bench.ts`.
Camera script: continuous drift, a rung change every 20 s, across all three Public rungs.

| | Value |
|---|---|
| Frames in five minutes at 30 fps | 9,000 |
| Draw-list compile, once per video | 12.6 ms (400 entities) |
| Rasterise 9,000 frames, one core, 29 entities | 35.8 s, 4.0 ms per frame, p95 5.0 ms |
| Rasterise 9,000 frames, one core, 400 entities | 40.8 s, 4.5 ms per frame, p95 6.0 ms, max 13.1 ms |
| Rasterise + H.264 Main 4.0 yuv420p `-preset medium`, full five minutes | **393.8 CPU-seconds**, 148 s wall on 4 vCPU, peak 2.1 GB |
| Output | 9,000 frames, 300.0 s, 818 kbps, 30.7 MB |

The sample is `experiment-artifacts/nasij-replay-feasibility-5min-720x1280.mp4`
(SHA-256 `4019821273f2978e66d7e89219285549201550930e4637c35a803ff6079c88bf`). Picture only: no audio, no
captions, no source text, synthetic stress data. It is a cost measurement, not a Replay.

### What the numbers say

- Drawing the world is about 41 of the 394 CPU-seconds. **The encoder is roughly nine tenths of the cost.**
  The world is no longer the expensive part of a Replay video.
- At the reference price the repository already uses (USD 0.000024 per vCPU-second, S8B-01 record), 394
  vCPU-seconds is **about USD 0.0095 for the five-minute picture track**, plus memory. That is an arithmetic
  consequence of one measurement on one machine at one list price. It is not a production cost: it excludes
  audio muxing, captions, storage, egress, queueing, retries and idle capacity.
- The repository's earlier placeholder-picture spike measured 28 vCPU-seconds per minute. This measured 79
  per minute with a real moving picture. The difference is the encoder working on a textured, moving image.

### Answers to the eight Replay questions

1. **Deterministic compact description?** Yes. The draw list is plain data with a digest. A Replay needs the
   draw list per disclosed position plus a camera track.
2. **Static elements generated once?** Yes. Paths are built once per draw list. In a Personal Replay a new
   list is compiled only when `TC` advances to a position that discloses something, at about 5 to 13 ms each.
3. **Changes as cheap transforms?** Yes. A frame is a matrix, a few opacities and one weave offset.
4. **Frames reuse assets?** Yes: the same paths and the same weave tile for every frame of a position.
5. **Expensive procedural work prepared once?** There is none per frame. The weave is one 96-pixel tile.
6. **API, AI or GPU work per frame?** None. No GPU was used at all.
7. **Parallel?** Frames depend only on (draw list, time), so a video splits into independent chunks. This
   bench rendered in eighteen separate 500-frame processes and concatenated them. Parallelism shortens wall
   time and does not reduce CPU-seconds.
8. **Independent of the gesture engine?** Yes. The bench imports the scene core and nothing from React
   Native.

### Cost drivers that remain

- **Encoding.** Preset, bitrate and resolution dominate. A woven ground that moves costs bits: 818 kbps here
  against about 141 kbps for the placeholder picture. A calmer camera, a flatter ground for video, or a
  faster preset each lower it. Untested.
- **Colour conversion and the raw-frame pipe** between rasteriser and encoder, counted inside the 394 s.
- **Audio, captions and sync** are not in this measurement at all. The 33.33 ms A/V requirement is untouched
  by this work.
- **Labels.** Arabic shaping in a headless rasteriser needs its own font and shaping check against R-3.

Not done here: CP2-A, CP2-B, any hosted resource, any spend.
