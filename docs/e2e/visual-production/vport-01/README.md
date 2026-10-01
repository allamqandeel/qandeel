# VPORT-01 — production visual proof (device captures)

**Run:** GitHub Actions `vport-01-visual-proof.yml`, run [36819624480](https://github.com/allamqandeel/qandeel/actions/runs/36819624480)
**Head:** `baa3f072de4e5ee5138f47134ab3eb1b47e1a23e`
**Device:** `sdk_gphone64_x86_64`, Android 16 / API 36, 1080×2400 at 420 dpi (narrow leg: 720×1520 at 320 dpi), CI emulator, software-rendered
**Build:** the Release APK, root swapped to the VPORT-01 proof root by `VPORT01_VISUAL_PROOF=1` (production `RuntimePhaseSurface`,
in-memory identity, scripted network). Every pixel of the world is the shipped Skia renderer; no capture is retouched.
**Result:** 8 / 8 Maestro flows PASS (`results.txt`).

These are evidence, not visual goldens. No test compares against them.

| File | Shows |
|---|---|
| `ar-standard-01-far-world.png` | FAR: the whole world. Thread Homes as places, each in its world atmosphere, over the cloud / star / dust strata |
| `ar-standard-02-mid-thread.png` | MID, one ×8 step in: a Thread Home with its hosted Readings (contextual appearances) on connection-grammar tethers |
| `ar-standard-03-near-session.png` | NEAR, two steps in: Emerging Focuses in the ungeographic register (open arcs, bottom-start), with no false place |
| `ar-standard-04-near-selected.png` | NEAR with the Thread Home inspected: the E1R attached SELECTED marker |
| `ar-standard-05-analytical-register.png` | one more step in (ANALYTICAL_OBJECT): the ungrounded Readings join the ungeographic register, settled after arrival |
| `en-standard-*.png` | the same world under English (LTR chrome; the world itself is direction-free) |
| `ar-increased-*.png` | Android high-text-contrast → F1 increased: opaque relation cores and marks. The text plates are Android's own |
| `ar-reduced-*.png` | Reduce Motion (animator scales 0): the same settled states as standard (parity) |
| `ar-narrow-*.png` | a 360 dp phone |
| `ar-landscape-*.png` | landscape. T-11 recomposes the chrome; the world is the same world |
| `travel-standard-travel.mp4`, `-back-at-far.png` | FAR → MID → NEAR → MID → FAR in one continuous world, and the settled return |
| `travel-reduced-travel.mp4`, `-back-at-far.png` | the same under Reduce Motion (cut-and-resolve) |
| `travel-standard-gfxinfo.txt` | `dumpsys gfxinfo` for the travel. This is a GPU-less CI emulator: the numbers are **not** a device performance claim |

Observed outside VPORT-01 scope: in the narrow and landscape legs the orientation / temporal chrome below the world
rendered dark-on-dark. VPORT-01 changed no chrome file. This is recorded for VPORT-02 (OrientationChrome visuals).
