# COSMOS — Visual Gate, revision 2 (the single bounded refinement)

**Branch:** `experiment/living-world-cosmic-v5`. Experimental and isolated. Not for merge.
**Status:** STOPPED for final Product Owner aesthetic acceptance. No Android code, no APK, no phone measurement,
no Replay code exists for COSMOS. `VISUAL-GATE.md` is the first gate and is superseded by this record.

## Product Owner decisions applied (2026-11-14)

| Decision | Applied as |
|---|---|
| 1. No N4 | The candidate draws no Personal names. The names survive only behind `?concept=names`, off by default, with an on-screen "future concept, not authorised" label, and in one separately labelled reference image |
| 2. No free relationships | Strands exist for a Thread hosting a Reading and for an explicit served relation of the focused Experience. Nothing else joins two entities |
| 3. No popularity or ranking | None exists. Size, brightness, hue, position and order carry no such meaning anywhere |
| 4. No synthetic sections | Removed, with the section titles. A Public Experience's hue now comes from its own identity and groups nothing. A real section is used only as the existing contract uses it: the reader's filter recedes what is outside it |

## What changed visually, and why

1. **FAR framing.** Canonical coordinates and the canonical camera are untouched. The lens now darkens the left and
   right edges as well as top and bottom, so a body that the canonical view cuts dissolves into the dark instead
   of ending at a hard screen edge. No text is drawn at FAR in any world, so nothing can be clipped there.
2. **Labels are whole or absent.** A label whose entity is at or beyond an edge is not drawn. Labels are kept
   clear of the depth rail on whichever side the language puts it.
3. **MID differentiation.** Each place is a compact body in its own hue with a bright halo and a label in the
   same hue, so neighbours read as separate lights with their own names rather than one mass.
4. **Public FAR without sections.** With every entry in its own hue, stacked full-size bodies mixed to a pale
   wash. Each entry now contributes one lighter body, slightly offset in its own direction, under a clear
   coloured node. A region reads as a cluster of distinct lights in shared gas.
5. **Personal without names.** Kept: a nebula body per Thread in its own hue, luminous hosting strands, depth and
   time. Added: a current Reading is a lit body with its own small fibre; a Reading that is no longer current is
   an open ring. Both facts are on the wire. Entity type and state are told by material, never by a word or a
   score.

## Remaining composition defects, honestly

- **The canonical FAR view still frames nothing on purpose.** In the Personal fixture two Threads lie beyond the
  screen at WORLD and are simply not visible until the reader pans. The edge fade hides the cut; it does not
  solve the framing. Solving it means a presentation-only "show everything" framing, which is a camera decision
  for the Product Owner and was not taken here.
- **Public FAR is quieter than the first gate.** Saturated region-sized clouds came from the synthetic sections.
  Without them, colour at FAR lives in the nodes and their wisps. This is the truthful result of decision 4.
- **Hue is identity only.** Two neighbours may share a hue by chance (eight hues). It means nothing, and a reader
  could still wonder. Worth a look in acceptance.
- **Shared at MID** is dense where the fixture's places are 30 to 60 points apart; labels thin out by collision.
- **Focused view:** a small bright streak can appear inside the focused core in the Public fixture. Unexplained;
  not yet traced.
- **Arabic and Latin labels** use web fonts in the gate. The app would bundle its own faces; metrics will differ.

## How the layered light stays cheap (preliminary, unmeasured)

Nothing below has been measured for COSMOS. The NASIJ numbers do not transfer: NASIJ drew opaque flat shapes,
and COSMOS draws large translucent additive bodies, which is the expensive case for a phone GPU.

**What is prepared once, never per frame**

| Asset | Size | Count |
|---|---|---|
| Atmosphere plates per world (deep, gas, veil), seamless | 512 to 1024 px | 3 |
| Nebula bodies, single channel | 512 px | 3, shared by every body in every world |
| Light sprites (halo, core, spark, mote, puff), single channel | 48 to 160 px | 5 |

All are deterministic from a seed and would ship as files baked at build time. Hue and rotation are applied at
draw time, so eight hues cost no extra texture memory on Skia (the browser gate copies per hue; that is a
limitation of the stand-in, not the design).

**What a frame is**

- 3 plate draws (two behind the world, one in front), each a single tiled quad.
- 1 atlas draw per visible rung: every body, halo and node of that rung in one `drawAtlas` call with
  per-instance transform and colour. Two rungs only during a depth change.
- A handful of batched strokes for strands and the focus instrument.
- No offscreen layer, no blur, no image filter, no per-entity React node, no JavaScript per frame.

**Where the real cost is, and the plan for it**

The draw-call count is small. The risk is overdraw: at FAR, hundreds of 250-point additive bodies cover the
same pixels many times. The intended answer is to **pre-compose each rung's bodies into a few cached tiles** when
the data changes (render-to-texture, off the gesture path), so a moving frame draws a tile per visible region
plus the crisp nodes, strands and labels on top. A body then costs once per data change instead of once per
frame. This is the first thing to prove on the phone; if it fails, the fallbacks are smaller bodies and a lower
internal resolution for the gas, both of which change the look and would come back to this gate.

**Replay.** The same plates, body tiles and stage serve a video: a frame is a camera transform over prepared
tiles plus a reveal by position. Whether a CPU rasteriser can composite these additive layers at an acceptable
cost per frame is unknown and must be measured before any figure is quoted.
