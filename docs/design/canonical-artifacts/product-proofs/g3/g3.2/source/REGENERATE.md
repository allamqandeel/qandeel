# Regenerating I-08B3.1-G3.2

Everything in the package can be rebuilt from `source/` alone, apart from the G3.1 ZIP identity check (step 2), which
reads the sealed G3.1 ZIP if it sits beside the package.

## Requirements

- **Node.js 24** or later (global `WebSocket`, `fetch`). No npm install: the tools use only Node built-ins.
- **Google Chrome** at `C:\Program Files\Google\Chrome\Application\chrome.exe`, for the headless capture driver
  `tools/lib/cdp.mjs`. That path is fixed in the driver; edit it for another install.
- **For the motion clips only:** an ffmpeg with an H.264 encoder. The default is CapCut's bundled `ffmpeg.exe`
  (`h264_mf`); set `G32_FFMPEG` to use another.
- **Scratch directory:** `G32_WORK`, default `<package>/../.g32-work`. It holds captures, frames, the G3.1 rebuild and
  probe builds.

## One command

```bash
node tools/pipeline.mjs
```

It runs, in order, stopping at the first failure:

| Step | Command | What it proves or produces |
|---|---|---|
| 1 build | `node src/build.mjs` | `prototype/index.html`. It refuses to build unless the vendored world equals the pin `4DFD9D27…`. |
| 2 upstream | `node tools/upstream.mjs` | G3.1 rebuilt from `vendor/upstream-g31/src` byte-identically to its reviewed prototype (`47dfe29e…`); the shared files unchanged; the G3.1 ZIP identity (`data/UPSTREAM.json`) |
| 3 snaps | `node tools/capture.mjs snaps` | the Product captures, including the G3.1 twins from the rebuilt G3.1, the world-alone renders and the legibility grounds |
| 4 clips | `node tools/capture.mjs clips` | `motion/*.mp4`, 30 fps, each decoded back and counted; `data/motion/*.truth.json` |
| 5 live | `node tools/livecheck.mjs` | real-input run (`data/LIVECHECK.json`) |
| 6 boards | `node tools/boards.mjs` | `boards/*.png` (`data/BOARDS.json`) |
| 7 probes | `node tools/probes.mjs` | planted-build defects, each of which must be rejected (`data/PROBES.json`) |
| 8 checks | `node tools/checks.mjs` | `data/CHECKS.json` and `data/STATE_MATRIX.json` |

**Options:**
- `--from <step>` and `--until <step>` run part of the pipeline.
- `node tools/checks.mjs --no-git` runs the checks outside the repository. K01, K04 (blob part) and K05 then report
  git as unavailable.
- `node tools/deps.mjs` re-verifies the vendored canon against `origin/main` blobs and rewrites
  `CANON_DEPENDENCIES.json`. It needs the repository.

## Packaging

```bash
node tools/package.mjs
```

It seals the package in seven steps:
1. It moves the reviewed prototype aside.
2. It rebuilds it from a clean copy of `source/` and requires the rebuild to be **byte-identical**.
3. It re-runs the checks on the rebuild.
4. It writes `MANIFEST.json`: every file, with bytes and SHA-256.
5. It writes the ZIP beside the folder and reads every entry back.
6. It extracts the ZIP to a clean folder and verifies every manifest-listed file there.
7. It rebuilds from the **extracted** source, again byte-identically.

## Determinism

- **The build** is a pure function of `source/`.
- **Captures** use the page's virtual clock (`?capture=1`). System appearance and Reduced Motion are emulated media
  features, never Product parameters.
- **What is not byte-stable:** clip encodes. The frames are, and each encode is verified by decoding it back to its
  exact frame count.
