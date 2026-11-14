# NASIJ — what the contracts changed, and the architecture

**Experiment:** `experiment/living-world-independent-v4` · experimental, isolated, not approved for production
**Written after** A1 was committed (`8218701`) and after reading the functional contracts. Still without opening
the current map's goldens, S3-R2 artwork or paint files.

## 1. The three worlds, as the repository defines them

| | Personal | Shared | Public |
|---|---|---|---|
| What it is | One session's analytical history at a viewed position `TC` | One permissioned World's places | The one global field of published Experiences |
| Entities on the map | Threads (at a Home), Readings (hosted on a Thread, once per appearance), Emerging Focuses and ungrounded Readings (no place) | Places only. Members and QANDEEL are never map objects | Experiences, with optional title and section |
| Coordinates | Server-authoritative exact integers. Homes are never computed or fitted | Server-authoritative, one space per World, a place never moves | Server-authoritative, one global space |
| Levels | WORLD, THREAD, SESSION, ANALYTICAL_OBJECT, SOURCE_PROVENANCE. Each is a separate authorised read; a rung can be `DEPTH_WITHHELD` | FAR, MID, NEAR. NEAR is always a focused place | FAR, MID, NEAR. NEAR is always a focused Experience |
| Read model | Whole disclosure per `(session, TC, depth)` | Whole World, at most 400 | By visible rectangle, at most 400 per read, re-read on every camera change |
| Text allowed | None. The Personal map draws no names (N4 not authorised) | The place's meaning | Title or meaning |
| Relations allowed | Thread hosts Reading, nothing else | None | The focused Experience's explicit relations only |
| Time | `1 ≤ TC ≤ LiveHead`; nothing after `TC` is known | None | None |
| Detail | Inspection sets a reference; today it resolves to "this view does not cover what you are inspecting" | Panel: themes, sources with attribution | Panel: publisher, content pages, nearby, relations, discussion |
| Refusal | Typed unavailable codes | DENIED closes the field and forgets the anchor | Fails closed, no existence oracle |

Scale is canonical in all three: 8192 world units per point at the first rung and one frozen ×8 per rung.

## 2. What I got wrong in A1, and what changed

A1 said I would abandon the layout if entities carried authoritative coordinates. They do, in all three worlds.

- **Dropped:** the Personal "strand weave" with time along the cloth and one lane per thread. Personal is one
  session, not many, and a Thread has a Home the client may not move. A lane layout would have been my
  geometry replacing the server's.
- **Dropped:** "sessions as bands" and "fibres for provenance". Provenance participations exist on the wire but
  no surface is authorised to draw them as edges, so NASIJ does not either.
- **Dropped:** mirroring the cloth in RTL. Coordinates are facts; only labels and controls change side.
- **Kept:** the identity. A cloth with grain, natural dyes, lozenge motifs, lantern shade, stillness at rest.
- **Kept:** the bordered carpet for Shared and the open field for Public. They follow from membership, not
  from layout.
- **Kept and strengthened:** one persistent world, a continuous presentation camera, one draw list, prepared
  geometry, the card that overlays instead of resizing, and five separate absence states.
- **Time in Personal** is now the selvedge: one tick per position up to the live head, woven up to `TC`. The
  objects with no place are a count on the fringe, never positioned.

The weave now carries scale instead of time: its gauge is ×8 finer per rung, the same ratio as the canonical
reinforcement, so every rung has cloth of a readable gauge and a zoom always has something to move against.

## 3. Architecture

```
authority (unchanged)            NASIJ core (pure TS)                 hosts
─────────────────────            ─────────────────────                ─────
store / field controllers ──▶ adapters ──▶ scene input ──▶ compile ──▶ draw list ──▶ Skia host (app)
        ▲                     exact-int      entities,      layers       batches,     Canvas2D host (preview)
        │                     subtraction    focus, ties    per rung     labels,      CPU Skia host (Replay bench)
        └── one canonical act per gesture ◀── presentation camera ◀───── hits
```

- **`src/nasij/core/adapters.ts`** reads `MapScene`, `SharedFieldEntry[]`, `PublicFieldEntry[]`. It subtracts
  coordinates as exact integers and only the difference from the scene origin becomes a float.
- **`src/nasij/core/scene.ts`** compiles a deterministic draw list: one layer per rung, each a handful of
  batches (one path per colour per paint band). It has a digest; same input, same digest on every host.
- **`src/nasij/core/camera.ts`** is presentation only. It never chooses a rung. A gesture ends in exactly one
  canonical act (`pan`, `step`, `focus`, `tapField`, or the Personal store actions), then the camera eases to
  the camera the authority answered with.
- **`src/nasij/core/absence.ts`** keeps LOADING, UNAVAILABLE, REFUSED, WORLD_EMPTY and REGION_EMPTY apart.
  WORLD_EMPTY needs a completed whole-world read; a viewport read can never produce it.

### Frame budget

| | At rest and while panning | During a rung change |
|---|---|---|
| Full-screen passes | 2 (opaque weave, lantern shade) | 4 |
| Geometry draws | border + one layer's batches | border + two layers' batches |
| Measured draw operations | 4 to 7 | 6 to 9 |
| Offscreen layers, image filters, blurs | 0 | 0 |
| React renders, JS-thread work per frame | 0 (mobile host) | 0 |

The draw count does not grow with the number of entities: 29 and 400 Public entries cost the same number of
draws, because a batch is one path however many lozenges it holds.

### Engine decision

React Native Skia stays as the rasteriser. The old renderer's costs that the PO listed (thousands of draws per
frame, per-object tone layers, repeated picture draws, React work during a drag) are properties of how much
was drawn and where the camera lived, not of Skia. Changing engine would add a native dependency, package
size and an iOS/Android integration risk to solve a problem the engine did not cause. What changes is the
architecture: the camera lives in UI-thread shared values, geometry is built once per data change, and a
frame is a matrix plus a few opacities.

I did not evaluate a native OpenGL/Vulkan/Metal or a game-engine renderer by building one. That is a judgment
from the measured shape of the cost, not a benchmark, and the phone test is what can overturn it.

### Experimental departures that need a PO decision before any adoption

1. **Optical magnification during a pinch.** Production applies nothing until the pinch ends. NASIJ magnifies
   the cloth under the fingers and cross-fades to the next rung's layer if the client already holds it. The
   canonical step is still one act at the end. Isolated in `core/camera.ts` and the hosts.
2. **Personal rungs are read ahead.** To cross-fade, the host holds the disclosures of neighbouring depths.
   Production already prefetches adjacent rungs (MAP-PERF-01); NASIJ draws a rung it holds while the fingers
   are still down. An unheld or withheld rung never fades in.
3. **New sentences.** "Nothing in this part of the cloth", "Go to the nearest" and the other absence strings
   have not passed the Copy Gate.
4. **Dye by Public section.** A visible use of an authoritative field that the current surface may not show
   this way.
5. **The lantern card** replaces the chrome-band panel for Shared and Public. It needs the visual gate.

### Known limits of the prototype

- Float precision at the two deepest Personal rungs is about half a point far from the scene origin. Rebasing
  each layer near the camera anchor removes it; not done.
- The Shared and Public canonical FAR camera starts at the world origin and frames nothing, by contract. A
  world whose places are far from the origin opens on empty cloth. NASIJ says so and points to the nearest
  place; it does not move the canonical camera.
- Above the 400-entry read bound the product has no dense-world rule (`LA-SCALE-01`). NASIJ inherits that gap.
