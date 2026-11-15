# COSMOS — Visual Gate (awaiting Product Owner aesthetic approval)

**Branch:** `experiment/living-world-cosmic-v5`, from `a06181b0` (#393). Experimental and isolated. Not for merge.
**Status:** STOPPED at the Visual Gate. No Android implementation, no APK, no phone measurement exists for this
direction. NASIJ (`experiment/living-world-independent-v4`) is kept intact as an engineering reference; its look
was rejected and none of it is used here.

## Direction

Set by the Product Owner's two reference images (2026-11-14): fibrous multi-colour nebulae, one hue per body,
luminous nodes joined by curved glowing strands, large clear titles. Not a reproduction of S3-R2.

## What is executable and what is concept

| Element | Status |
|---|---|
| Stage compiler, camera, absence states, adapters (`src/cosmos/core`) | Executable, pure TypeScript, typechecked |
| Atmosphere plates, nebula bodies, light sprites (`atmosphere.ts`) | Executable, baked deterministically from a seed |
| Browser gate (`experiments/cosmos-gate`) | Executable. Canvas2D stands in for Skia |
| Authority in the gate | **Simulated** over the repository's labelled synthetic fixtures |
| Personal names (thread and reading titles) | **Concept only. Needs N4.** Synthetic, toggled off in "authorised today" |
| Public section titles at FAR, and a section per fixture entry | **Concept.** The fixture has no sections; the gate assigns them |
| Motion film | Rendered frame by frame from the gate. It shows the look and motion, **not performance** |

## Truth rules kept

- Every position is the server's coordinate. Nothing is laid out by the client.
- A strand is drawn for exactly two facts: a Thread hosting a Reading, and an explicit served relation of the
  focused Experience. Neither reference image's free web of links between topics is reproduced.
- A dye comes from an entity's own identity (Personal threads, Shared places) or its section (Public). It never
  groups by an inferred topic.
- Shared draws a membership horizon and nothing outside it.
- Personal shows only what is known at the viewed position; unplaced objects are a count.

## Decisions that belong to the Product Owner

1. **Names in the Personal world.** The reference depends on them. They need N4.
2. **Free links between nodes.** Not authorised by any contract today.
3. **"Most discussed", "Rising" and view counts** in the Public reference contradict the current Public rule of
   no ranking, counts or popularity.
4. **Section titles placed on the map**, and colouring by section.

## Known weaknesses of this gate

- Canonical FAR scale decides the framing: bodies run off the edges and some titles are cut.
- At MID, entries of one section are one hue and their bodies merge into a single mass.
- Large additive bodies overlap heavily. NASIJ showed frame cost follows fill rate, so this look is the
  expensive case. It is unmeasured on a phone and may need per-region bodies baked together.
- Each tinted body is a separate copy in the browser; on Skia a tint is a draw-time colour.
- The earlier Replay cost figure does not apply to this renderer. No new one has been measured.
