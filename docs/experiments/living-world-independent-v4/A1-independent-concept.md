# NASIJ (نسيج) — the lantern-lit weave

**Experiment:** `experiment/living-world-independent-v4` · **Status:** experimental, isolated, not approved for production
**Recorded:** 2026-11-14, before any inspection of the current map's visuals, goldens, S3-R2 artwork,
WorldContinuity output or earlier art proposals. At the time of writing I had read only the Product Owner
brief, `AGENTS.md`, the repository layout and `apps/mobile/package.json`. Functional contracts were being
extracted by read-only agents instructed not to report anything about appearance.

The approved S3-R2 direction stays binding on the production path. Nothing here replaces it.

---

## 1. Where the idea comes from

I started from three facts about the product, not from a look.

1. **The product's own noun is "thread".** The Personal hierarchy is THREAD → SESSION → ANALYTICAL_OBJECT →
   SOURCE_PROVENANCE. A thread that runs through sessions, gathers objects, and is made of source material is
   not a metaphor I have to invent. It is a description of woven cloth.
2. **The world is made of time.** Personal has a temporal axis with a hard truth rule: nothing after the
   viewed instant may be shown. Cloth on a loom has exactly this property. Behind the working edge it is
   woven and fixed; ahead of it there is only bare warp. An unwoven loom does not hide a future, it has none
   yet.
3. **The product is called a lantern.** A قنديل gives a small warm pool of light that you carry to what you
   want to examine. Light is attention. What you bring the lantern to becomes legible; the rest stays
   present but quiet.

The Arabic word نسيج means woven fabric, and also the fabric *of* something: a life, a community, a society.
That covers all three worlds with one word.

## 2. The concept

**The Living Analysis world is a cloth, read by lantern light.** It is a surface with material, grain and
depth of weave, not a void with objects floating in it. You do not fly through it. You bring your light
closer to it, and closer cloth shows finer structure, the way real fabric does.

One material language, three different textiles, because the three worlds are organised differently:

| World | Textile | Why this organisation is truthful |
|---|---|---|
| **Personal** | **The strand weave.** A long cloth woven along time. Each authoritative thread is a dyed strand running along the cloth. Each session is a woven band across it. A strand surfaces in a band only where the data says that thread was present in that session. Analytical objects are knots tied on a strand inside a band. Source provenance is the fibres a knot is made of. | Position carries only two meanings, both true: *when* (along the cloth) and *which thread* (across it). There is no free 2-D placement, so nothing ends up "near" something else by accident and reads as a relationship nobody established. The only crossings are real co-presence in a session. |
| **Shared** | **The bordered carpet.** A finite cloth with a woven border. Inside the field are the real shared places, as medallions. | A border is what a carpet has and an open field does not. The closed edge *is* the membership boundary: this space has an inside, and you are in it because you were admitted. Nothing is drawn outside the border. |
| **Public** | **The open field.** An unbordered ground that continues past the screen in every direction, with public topics as dyed regions and public experiences as motifs inside them. | Public has no membership edge, so it has no border. Because the ground visibly continues, an area with no motifs reads as "nothing woven here", never as "the world is empty". |

### What each semantic level looks like (Personal)

Zoom is geometric and continuous over **one** cloth. Deeper levels are nested inside their parents, so there
is never a scene change to hide.

| Level | You see | Rest framing |
|---|---|---|
| WORLD | The whole cloth up to the viewed instant: strands as lines of colour, sessions as a rhythm of bands. | Entire woven extent |
| THREAD | One strand under the lantern, at full dye strength. Other strands remain as undyed warp. Its sessions become distinct. | The strand's extent |
| SESSION | One band fills the view. The strands present in it, and the knots on each. | One band |
| ANALYTICAL_OBJECT | One knot: its label, kind, and the strand and band it belongs to. | One knot and its neighbours |
| SOURCE_PROVENANCE | The knot's fibres: one fibre per real source item, each ending at the band it came from. | The knot's fibres |

Shared and Public use the same mechanism with their own three levels: FAR is the whole textile, MID is one
region or medallion, NEAR is one motif and its immediate ground.

### What is deliberately absent

- No stars, dust, nebulae, orbits, glows or particles. Nothing drifts.
- No neon. Colour comes from a small natural-dye palette on a deep ground: indigo, madder, saffron,
  verdigris, undyed wool. Dyes are assigned to threads by stable identity, never by inferred topic.
- No ambient animation at rest. The cloth is still until you move. Life comes from response: the light
  follows your attention, strands take dye as you approach, the working edge advances when history advances.
- No decoration that could be read as data. Every drawn mark is an authorised entity or the ground.

## 3. Experience and navigation philosophy

**Always one cloth.** World changes and level changes are camera moves over persistent geometry. The
question "where am I" is answered by the cloth itself, because the parent is still on screen around the
child.

**The fingers own the camera.** Pinch and drag move the cloth 1:1 with no threshold, no snap during the
gesture and no semantic computation in the gesture path. Semantic level is *derived* from where the camera
is, with hysteresis. On release, the camera eases to the nearest canonical rest framing. The canonical
levels therefore still exist exactly as specified; they are the places the camera comes to rest. The
in-between is presentation only.

*Flagged for PO decision:* if the frozen camera contract requires discrete steps as the only reachable
states, the continuous in-between is an experimental departure. It is isolated in this branch's camera
module and changes no shared contract.

**A preview shows containers, never contents.** While zooming toward a level whose data is not loaded or
not authorised, the cloth shows the real parent and an unwoven placeholder. It never draws guessed content.

**The lantern card instead of a details panel.** Selection opens a compact card that floats over the lower
edge of the cloth at a fixed peek height. The camera's target framing is computed for the area above the
card *before* the move starts, so there is one motion and no second jump. Because the card overlays rather
than resizes the world, nothing is reserved and nothing is empty: slow or failed loading happens inside a
card that is already its final size. Pull up for more.

**Five distinct absence states**, never one "empty" message: nothing anywhere in the authorised world;
nothing in this region (with a pointer to the nearest woven area, computed from authorised data only);
loading; unavailable; refused.

**Wayfinding in three compact elements:** a depth rail (the levels as beads, current one lit, tap to
return to any shallower level), a one-line "where" label, and a single return control. In RTL the cloth
itself is mirrored for Personal, so time runs right to left as Arabic reading does, and every control swaps
sides.

**Reduced motion:** camera moves become short cross-dissolves between rest framings. Nothing else in the
design depends on motion.

**Screen readers:** the cloth exposes the current level as an ordered list of its real entities with the
same activation the touch target has. Hit targets are never smaller than 44 pt regardless of drawn size.

## 4. Rendering thesis (decided on first principles, to be tested against the code next)

> **The cloth is prepared. The camera is a transform.**

The expensive thing in an interactive map is drawing during movement. A textile is static geometry, so
almost all of it can be prepared once and only *transformed* while the user moves.

1. **Scene compiler** (pure TypeScript, deterministic, no renderer dependency): authorised world data in,
   a compact **display list** out. Flat arrays of a handful of primitive kinds (ribbon, band, knot, fibre,
   label, ground), each with a level-of-detail band saying at which camera scales it is visible. Same input
   gives byte-identical output.
2. **Preparation** (once per data change, off the gesture path): the display list is recorded into a small
   fixed number of retained pictures, one per level-of-detail band, with geometry batched by dye so a band
   is a few draw operations regardless of entity count.
3. **Presentation** (per frame, UI thread only): one camera matrix and a few opacities. No React render, no
   JS-thread work, no per-object paint, no layer, no image filter, no blur.
4. **Ground and light**: one full-screen pass for the cloth grain and the lantern pool.

Budget I am committing to before measuring: at most about 12 draw operations per frame at any level in any
world, zero offscreen layers, zero image filters, and no allocation in the gesture path.

**Engine choice, provisional:** keep React Native Skia as the rasteriser, discard the rendering
*architecture*. Reasons: it is already shipped in the app on both platforms (no package-size, licence or
integration cost), it can drive a transform from the UI thread, and the same drawing vocabulary exists
headless on a server, which matters for Replay. A second engine would need to beat it by a margin that
justifies a new native dependency; I expect the frame cost to be decided by how much is drawn per frame,
not by which library draws it. I will confirm or overturn this in technical reconnaissance and say so.

**Resource ownership:** one owner object per mounted world holds every retained picture, shader and
subscription and releases all of them on unmount. No module-level caches of GPU objects. Repeat-open
memory is to be measured, not asserted.

## 5. Why this is the right shape for Replay

Replay is a camera moving along time over a world that is revealed as time advances. In this concept that
is literally: slide along the cloth, advance the working edge.

- The display list is the deterministic, compact scene description. It is plain data and has no dependency
  on the mobile gesture engine or a mobile GPU cache.
- A whole video shares one cloth. Static content is rasterised once per level of detail; a frame is then an
  affine placement of that raster plus a reveal edge. No AI call, no API call and no scene rebuild per
  frame.
- Frames are independent given (display list, time), so rendering splits across workers without shared
  state.
- A five-minute video at 30 fps is 9,000 frames. The claim to test is that most of them cost one composite
  rather than one world render. I will measure a headless rasteriser on this machine and report frames per
  core-second with the assumptions stated, rather than quote a price.

## 6. What would make me abandon this

- If the Personal data has no authoritative thread-in-session relation, the strand weave cannot be drawn
  truthfully and the organisation must change.
- If Shared or Public entities carry authoritative coordinates or regions, those take precedence over any
  layout of mine.
- If a retained-picture Skia canvas cannot hold 30 fps on the reference phone at realistic volume, the
  engine choice is wrong and I will say so.
