# T-10.0 — Motion opportunity and anti-opportunity inventory

Produced with the `find-animation-opportunities` gate (frequency → purpose → speed → function) over
the baseline surfaces, before any prototype was built. Every row names the gate answer. The
anti-opportunity list is the point: it records what the shootout deliberately kept still.

## Opportunities (motion may genuinely explain continuity)

| # | Moment | Today (baseline) | Purpose (gate) | Frequency | What the lab tests |
| --- | --- | --- | --- | --- | --- |
| 1 | **Pan release** — the finger lifts with velocity | Progress reset to idle; the world snaps to the committed camera on the next render. | Preventing a jarring change; spatial consistency | Tens/day | 1:1 tracking on the UI runtime, momentum after release (`withDecay`), grab-to-stop, ONE `PAN` committed at rest. Decay deceleration is the only per-direction difference. |
| 2 | **Canonical camera change** — any landed destination (Direct Jump, Return to Live Focus, Go Live + Locate's spatial half, Back, Exact Return, Return to World) | Positions recomputed and painted at once: the world teleports. | Spatial consistency (P1) | Occasional | The residual camera re-bases so the current frame is preserved, then resolves toward the committed camera with the act's own choreography. A: one critically damped slide. B: a short slide, or a resolve-in-place when the flight would be long. C: a spring that carries the plane's velocity. |
| 3 | **Semantic Zoom** — a depth step | Scale ×8 applied at once; the new rung's objects appear at once. | State indication; explanation (P4) | Occasional | Zoom residual 1/8 → 1 (A spring 460 ms; B timing 300 ms after disclosure leads by 90 ms; C spring 540 ms, 0.86) while the new rung's objects resolve (A in place; B unfold from the host Home with a 36 ms stagger; C spring from the host). |
| 4 | **Disclosure arriving through a temporal change** — scrub preview, committed Moment, Return to Live Head, a live advance | Objects appear at once. | Preventing a jarring change; state indication | Tens/day while scrubbing | Entering objects resolve (A fade 160 ms; B unfold 180 ms; C spring size 0.8→1). Leaving objects are removed on the next frame in every direction (no ghost). |
| 5 | **Go Live + Locate** — one transaction, two halves | Both halves paint at once. | Explanation (temporal, then conditional spatial) | Rare | The temporal half resolves first; the spatial half starts after a per-direction delay (A 140, B 260, C 80 ms) — or never, when there is no legitimate landing. |
| 6 | **Exact Return arrival** | Indistinguishable from Back at the pixel level. | State indication (exactness) | Rare | A brief inset ink frame on arrival (240–280 ms), never brass, never persistent. |
| 7 | **Meaning Ignition** (hypothesis, S5) | Nothing. | Delight, rare tier only — *if* it survives | Rare (a live advance that adds an object to the visible scene) | Off / ring (A) / bloom (B) / ripple to neighbours (C), Living Brass only, once, locally. |
| 8 | **Preview weight** | The world shows `K(PTC)` at committed weight. | State indication (preview ≠ commit) | Tens/day while scrubbing | A 160 ms opacity veil to 0.86 while a preview is open — opacity only, so it survives reduced motion. |

## Anti-opportunities (deliberately still)

| # | Candidate | Verdict | Gate question that killed it |
| --- | --- | --- | --- |
| A | Timeline presentation scrolling, refine, widen (T-05) | **Still.** | Frequency: hundreds a day (already rejected by T-06; kept). |
| B | Cross-fading the Map across a committed temporal move | **Still.** | Function: the old projection would be stale `V` presented as current (T-06's rejection, kept for the world). |
| C | A live pulse / breathing on the Live edge or on the current Home | **Still.** | Function: an infinite repeat never starts under reduced motion and is decoration on a dense surface; it would also read as status grammar. |
| D | Ghosting, trailing or interpolating objects between two temporal states | **Still.** | Function: there is no truthful in-between; future-unavailable material must be absent, never ghosted (§3). |
| E | Animating a Home when its Thread's state changes, or moving any Home for any reason | **Still.** | Function: geography is canonical and permanent; motion may not imply that a place moved. |
| F | Chrome band motion (orientation sentences, return controls) | **Still in T-10.0.** | Frequency/scope: the chrome re-derives per act; animating it is production T-10's decision after a North Star exists, not the shootout's. The truth modules may never carry motion at all (contract). |
| G | Press feedback on the T-08 controls | **Still in T-10.0.** | Frequency: tens/day; would be a 120 ms scale on `Pressable` (production T-10 candidate), not a North Star question. |
| H | Stagger on the register (ungeographic identities) | **Still.** | Function: order in the register is a deterministic slot, not a sequence; a stagger would read as ranking. |
| I | Tethers drawn with curvature or "tension" responding to velocity (C candidate) | **Rejected during design.** | Function: a tether's shape would read as relationship strength. The field response is confined to node size. |
| J | Dimming non-inspected objects while an inspection is active (B candidate) | **Rejected during design.** | Function: HL-04's presence floor and the risk of reading dimness as lifecycle or relevance. |
| K | Camera fly-to on a temporal commit | **Still.** | Function: camera motion is not a temporal act's authority (T-06); a commit moves time, not the camera. |
| L | Animating an object's radius to encode confidence, importance or recency | **Still.** | Function: geometry cannot manufacture analytical meaning. |
| M | Rubber-banding at a world edge | **Still.** | The world is unbounded within the canonical coordinate bound; a fake edge would be a claim about the world. |

## Verdict

The Living Analysis Map needs little motion, and most of what it needs is continuity: a pan that
does not snap, a landing that does not teleport, a depth step that resolves from the same locus,
and a temporal change whose arrivals resolve while its departures simply stop existing. The one
genuinely open question is whether a rare signature (Meaning Ignition) earns its place; the
shootout makes it switchable so the human can compare with and without.
