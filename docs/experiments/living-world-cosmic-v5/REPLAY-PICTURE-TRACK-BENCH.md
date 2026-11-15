# COSMOS — headless Replay picture-track benchmark

**Scope:** a cost measurement for a future Replay picture track. Not the Replay renderer, not CP2-A or CP2-B.
Picture only: no audio, no captions, no source text, no A/V sync. Synthetic Public fixture (29 entries).
**Machine:** this session's cloud container, 4 vCPU Intel Xeon 2.30 GHz, no GPU. An Android build was running on
the same machine at the time, so wall-clock times are inflated; CPU-seconds are the figures to read.
**Script:** `apps/mobile/experiments/cosmos-replay-bench/bench.ts`, using the same baked assets the app ships
(`src/cosmos/assets`) and the same stage compiler. Rasteriser: Skia on the CPU through `@napi-rs/canvas`.
**Target:** 720×1280, 30 fps, H.264 Main 4.0, yuv420p (the repository's approved Replay target, S8B-01 D-C1).

## Result for five minutes (9,000 frames)

| Part | Measured |
|---|---|
| Stage compile, once per disclosed position | 5.2 ms for two stages |
| **Rendering, including the raw-frame pipe** | **285.3 CPU-seconds** |
| **Encoding** (`libx264 -preset medium`, 2 threads) | **213.3 CPU-seconds** |
| **Total** | **498.6 CPU-seconds**, 300 s wall |
| Render memory | 151 MB resident in the timing run |
| Encoder memory | 278 MB peak |
| Output | 9,000 frames, 300.0 s, 617 kbps, 23.1 MB |

Sample: `experiment-artifacts/cosmos-replay-feasibility-5min-720x1280.mp4`,
SHA-256 `31faa3e818d2eb354165cca5822ac5259195d4efd575141586e9b3b647e885e2`.

Render cost by depth, from a separate one-minute timing run (1,800 frames, mean 29.8 ms, p95 56.7 ms, max 86 ms):

| Depth | Mean per frame |
|---|---:|
| FAR (every body in view, heavy overlap) | 53.2 ms |
| MID | 25.3 ms |
| NEAR | 11.1 ms |

## Reading it

- **COSMOS costs about seven times more to draw than NASIJ did** (29.8 ms against 4.5 ms per frame on the same
  machine). Drawing is now the larger share, 57% of the total, where for NASIJ the encoder was nine tenths.
- **The cost is the translucent bodies.** FAR is five times NEAR, and FAR is where the large additive bodies
  overlap most. This is the same overdraw the phone will face, measured here on a CPU.
- **At the reference price the repository uses** (USD 0.000024 per vCPU-second, S8B-01 record), 499 vCPU-seconds
  is about USD 0.012 for a five-minute picture track. That is arithmetic on one run at one list price. It
  excludes audio, captions, storage, egress, queueing, retries and idle capacity, and it is not a production
  cost.
- A pipe-mode render process showed about 2.1 GB resident. That is the benchmark library's frame-export call
  retaining buffers (the same behaviour seen in the NASIJ bench), which is why frames were produced in
  500-frame processes. A real renderer must own its frame buffer; the 151 MB figure is the renderer itself.

## Not measured

- The prepared-tile strategy (bodies composed once per position, then only transformed). It should cut the FAR
  cost most. It is unproven here.
- More than 29 entries. The 400-entry stress case was not run for COSMOS.
- Arabic shaping fidelity in a headless rasteriser against the R-3 text test.
- Anything about audio or the 33.33 ms A/V requirement.
