# NASIJ — status of this branch

**2026-11-14. Kept as an intact experimental reference. Not for merge.**

- **Visual direction: REJECTED by the Product Owner** after reviewing the previews (woven-cloth look, small
  geometric motifs, beige texture, largely empty field). This is a visual rejection, not an engineering one.
- **Engineering evidence kept:** the deterministic draw list, batched geometry, the presentation camera, the
  five absence states, the fill-rate finding and the headless Replay measurement (`C1`).
- **Not finished, and not to be read as finished:**
  - No APK was produced. The arm64 build was stopped when the direction was rejected.
  - The mobile Skia host and proof root (`src/nasij/skia`, `src/nasij/proof`, commit `3d824bc`) were written
    by a delegated agent and were never run on a device or emulator, and never reviewed line by line.
  - No comparison report (Phase D) was written.
  - No HONOR measurement of any kind exists for this branch.
- The cosmic direction continues on a separate branch and reuses only engineering components.
