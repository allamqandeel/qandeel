# I-08B1 / WS7R — Visual Recomposition: from global mesh to living constellation

## STATUS — read this first

> **I-08B1 — CORE VISUAL THESIS / VISIBLE MIND — CLOSED / FROZEN.**
> Product decision, 2026-09-20. All three distances are approved and frozen. See **§29**.

| | |
|---|---|
| **I-08B1 overall** | **CLOSED / FROZEN** — 2026-09-20. See **§29**. |
| **I-08B1 / NEAR VISUAL BASELINE** | **APPROVED / FROZEN** — Product decision, 2026-09-20. See §16. |
| **I-08B1 / MID VISUAL + MOTION BASELINE** | **APPROVED / FROZEN / CANONICAL** — Product decision, 2026-09-20. See **§25**. |
| **I-08B1 / FAR VISUAL + MOTION BASELINE** | **APPROVED / FROZEN / CANONICAL** — Product decision, 2026-09-20. Reconstruction **§26**, motion review **§27** (PASS), freeze **§28**. |
| **I-08B1 / WS7R — MOTION REVIEW** | **CLOSED / PASS** — retained, unchanged |

**THE FINAL UNIFIED PROTOTYPE.**

| | |
|---|---|
| file | `wf-living-constellation.html` · **388,374 bytes** |
| SHA-256 | **`4DFD9D27D752C3A445168C0CC7067D71DF4ADA84BC61B806D12C8BB3202BC413`** |

**SHA SEMANTICS — read this before concluding anything from the hashes.** The NEAR baseline
`7D7D5B55…` and the MID baseline `6D8EFDBC…` are **NOT superseded** by the unified prototype
having a later hash. They remain canonical evidence for their own distances. A distance's
baseline is an accepted STATE, and the unified prototype's claim is that it reproduces those
states exactly — measured, not asserted:

| distance | accepted baseline SHA-256 | the unified prototype at that distance |
|---|---|---|
| NEAR, A = 1 | `7D7D5B5502D7B18D6D35F89F8A2DB74213A55851F65DC98068FEC6A726E39A34` | **0** of 2,480,100 pixels differ |
| MID, A = 0.5 | `6D8EFDBCF155BCF6BDCB83CAF9F32D54F88AAC3E8EB6585312048B23A1AEBFF6` | **0** of 2,480,100 pixels differ |
| FAR, A = 0 | — (first approved at the unified SHA) | `4DFD9D27…`, the accepted FAR |

Stronger than the two sampled boards: the FAR window is EXACTLY 0 for every A ≥ 0.12, so every
frame from there to A = 1 renders bit-identically whether the window is on or off — measured at
eleven values of A, 0 of 1,101,800 pixels each (§26.6, §27.1).

**The archives.**

| | |
|---|---|
| FAR / unified | `design-workshops/I-08B1-FAR-BASELINE-APPROVED-WS7R-F.zip` + `.manifest.txt` — see §28 |
| MID | `design-workshops/I-08B1-MID-BASELINE-APPROVED-WS7R-R.zip` + `.manifest.txt` — canonical, untouched |
| NEAR | `design-workshops/I-08B1-NEAR-BASELINE-APPROVED.zip` — canonical, untouched |
| closure package | `design-workshops/I-08B1-CANONICAL-CLOSURE.zip` + `.manifest.txt` — see §29 |
| historical MID | `design-workshops/I-08B1-MID-BASELINE-APPROVED.zip` + `.manifest.txt` — superseded by Product override, preserved as history, never deleted |

**The frozen MID artefact — CANONICAL:**

| | |
|---|---|
| prototype | `wf-living-constellation.html` · 359,265 bytes |
| SHA-256 | `6D8EFDBCF155BCF6BDCB83CAF9F32D54F88AAC3E8EB6585312048B23A1AEBFF6` |
| archive | `design-workshops/I-08B1-MID-BASELINE-APPROVED-WS7R-R.zip` |
| archive manifest | `design-workshops/I-08B1-MID-BASELINE-APPROVED-WS7R-R.manifest.txt` — the archive's own SHA-256, its size and every entry's SHA-256, plus the accepted and superseded prototype SHAs, kept **outside** the archive because a file cannot record the hash of an archive that contains it |
| proof — hero | `ws7rr-mid-hero.png` |
| proof — REFERENCE 01 comparison | `ws7rr-reference01-vs-mid.png` |
| proof — REFERENCE 02 local-pattern comparison | `ws7rr-reference02-vs-local.png` |
| preservation refs | `ws7rv2-near-hero.png`, `ws7rc-far-hero.png` (frozen NEAR and FAR, byte-identical renders) |
| reproduction support | `board-server.mjs`, `ws7rq-measure.js`, `ws7rr-boards.js`, `ws7rr-reference-01.png`, `ws7rr-reference-02-micro.png`, `ws7rm-reference-target.png` |

**§23** is the reconstruction this freezes, **§24** its motion review (PASS), **§25** the freeze
itself.

**The superseded MID artefact — HISTORICAL / NON-CANONICAL.** Retained in full; not deleted:

| | |
|---|---|
| prototype | `wf-living-constellation.html` · 330,640 bytes |
| SHA-256 | `5225B4607CB5339E8E3BEFC33A0DC3B8AAC97F525FCDEFC10F50AA8F21C2CDD0` |
| archive | `design-workshops/I-08B1-MID-BASELINE-APPROVED.zip` (preserved) |
| archive manifest | `design-workshops/I-08B1-MID-BASELINE-APPROVED.manifest.txt` (preserved) |
| status | **SUPERSEDED BY PRODUCT OVERRIDE**, 2026-09-20. Historical record only. |
| its proofs | `ws7rm2-mid-hero.png`, `ws7rm2-reference-vs-mid.png`, `ws7rm2-mid-structure.png`, `ws7rm2-work-frames-crop.png` |

§17 is the first MID pass, **§18** the session-frame morphology correction, **§19** the motion
review, **§20** the closure-hygiene pass, **§21** that freeze. The motion review passed at
the preceding SHA `657275CD…` (327,433 bytes); §20 closed its two follow-ups and left every
stable frame unchanged, so the PASS carried to that SHA. All of it stands as history.

**The frozen NEAR artefact:**

| | |
|---|---|
| prototype | `wf-living-constellation.html` · 299,893 bytes |
| SHA-256 | `7D7D5B5502D7B18D6D35F89F8A2DB74213A55851F65DC98068FEC6A726E39A34` |
| archive | `I-08B1-NEAR-BASELINE-APPROVED.zip` |
| proof — hero | `ws7rv2-near-hero.png` |
| proof — comparison | `ws7rv-to-ws7rv2-colour.png` |
| proof — focus crop | `ws7rv2-focus-crop.png` |
| preservation refs | `ws7rc-far-hero.png`, `ws7rc-mid-hero.png` (FAR and MID, 0 differing pixels) |

**What "frozen" binds.** NEAR is closed to further **aesthetic** iteration — colour, material,
light, composition, shot class and motion are all settled at this SHA, and none of them reopens
on taste. They reopen only on a discovered **contradiction**: a preservation diff that stops
being zero, a semantic claim the render makes that the model does not support, an accessibility
or Arabic-readability failure, or a portability finding from the Skia/Reanimated port. A
preference is not a contradiction.

**The accepted NEAR characteristics**, which any later change must still satisfy:

1. cool celestial cyan / teal atmosphere (frame mean hue 186.9, mean saturation 65.9%)
2. true dark-space pockets (4.73% of the frame below level 18; corner mean 35.29)
3. localised gold accent, not a warm flood (gold confined to the focus and 0.7 session radii)
4. nebular / galactic light quality (structured pockets, per-cloud hue and lightness variation)
5. the current session-field logic — member-shaped, not centred on the bounding circle
6. the current local analytical constellation and relation count (123, unchanged)
7. the current disclosure hierarchy (focus ÷ brightest partner = 1.16)
8. Arabic readability
9. all Motion-PASS behaviour, including reduced-motion settled parity

The full record of how each was reached is §14 (composition) and §15 (colour); the freeze
itself, and what was checked before granting it, is **§16**.

---

Baseline: **WS7**, corrected, not restarted. WS6 remains the historical baseline. Nothing here
asserts canonical runtime semantics; see the placeholder note at the end, which is unchanged by
the freeze.

The deliverable is the **interactive prototype**. The images are frames of it.

**The world data is identical to WS7, WS6 and WS5** — the same 233 objects, 123 relations,
34,847 field vertices, 8,180 filaments, 54,998 links, 96 currents, 19 background worlds,
28 clusters, 138 nebulae, from the same random stream. `__audit()` still reports every one
of those counts. Nothing in this pass deletes, moves or invents world data. What changed is
what **resolves**.

---

## The prototype

`wf-living-constellation.html` — one file, opens by double-click, no server needed.
(As in WS7, the two typefaces come from the Google Fonts CDN, so the Arabic stratum needs
a network connection on first open; `__shot` awaits `document.fonts.ready` before every
board so nothing here was captured in a fallback face.)

| | |
|---|---|
| drag | pan · wheel: zoom at cursor · drag the track: seek FAR → MID → NEAR |
| `F` `M` `N` | jump to the three marked reference positions |
| `space` | play the path (9.8 s; **stepped** under reduced motion) · `R` return to path |
| `1`–`5` | fire an event · `0` reset the world |
| **`L`** | **near LOD on / off — the WS7R control** |
| `K` | MID density proposal (off by default) · `J` FAR subject proposal (off by default) |
| `W` | focus hierarchy on / off — the WS7 control |
| `S` | slow motion 1× / 2× / 4× · `D` motion preference: OS / reduced / full |
| `H` | hide all harness chrome · `X` motion exploration (non-authorized) |

`board-server.mjs` ships beside it — `node design-workshops/I-08B1-WS7R/board-server.mjs`,
then `http://localhost:8731`. It serves the workshop folder (so the page lays out normally;
a `data:` URL gives the canvas a zero-size container and every `drawImage` throws) and
accepts the page's own `window.__shot('name.png', spec)` at `POST /save/`. It also serves
**WS7 alongside WS7R**, which is what makes the §7 preservation diff a two-tab comparison
rather than a claim. WS7's capture pipeline was not kept and had to be rebuilt; this one is
in the folder so the next pass does not rebuild it again.

Two harnesses load into the page from the same server and add only `window.__q*` /
`window.__r*`: `ws7rq-measure.js` (§22: frame statistics, nest structure, radial profile,
preservation diff, settle) and `ws7rr-boards.js` (§23: the REFERENCE 01 board, the REFERENCE 02
local-pattern board, the transit sweep, reduced-motion parity, the stratum toggle table).

---

## 1. What WS7 actually did, measured

Product's verdict was that NEAR was still visually noisy and that the substrate needed its
own semantic-zoom treatment. Read off the delivered WS7 file at `A = 1`:

| term | what it controls | WS7 at NEAR |
|---|---|---|
| `web.a` | connective field alpha | **1.00** |
| `web.cut` | which filaments are drawn at all | **1.00** |
| `web.fine` | the denser fine population | **1.00** |
| `web.trunk` | long chords across the frame | 0.22 |
| `web.spread` | stroke width | 2.25 |
| `cur` | 96 world currents | **1.00** |
| field vertices | *(no census term existed at all)* | **all 34,847** |

Every one of those **rises** on approach. WS5's schedule opens with the rule *"disclosure
means what RESOLVES, never what exists"*, and WS7 applied it to every stratum in the
function except the one Product was complaining about, where it was inverted. WS6's answer
to the density — withdraw the core, widen the stroke — then converted 8,180 wires into
8,180 wide coreless smears at 2.25× the width. That is not weather. It is a crosshatch, and
Product named it exactly: **a hundred faint traces are still a hundred traces.**

WS7's own notes list "the hub read at NEAR is now the point, not a defect" as a resolved
item. It was not resolved; it was the defect, and the gradient was building it (§4).

## 2. The correction: one term

`S.lod` is the substrate's own approach window, and it runs the **other way** from
everything above it in the schedule:

```
S.lod = ss(0.68, 1.00, A)
```

| | at NEAR |
|---|---|
| `web.cut` | 1.00 → **0.12** — a COUNT instruction, not a brightness one |
| `web.a` | 1.00 → **0.28** |
| `web.fine` | a window now: 0 at NEAR |
| `web.trunk` | 0.22 → **0** |
| `web.vcut` (new) | 1.00 → **0.18** |
| `cur` / `curCut` / `curW` | 1.00 → **0.30** / 0.26 of the population / 3.2× wider |
| `aero` / `knot` | 1.00 / 1.00 → **1.30** / **1.38**, and wider |

Measured on the NEAR viewport: **18** coarse filaments stroked (WS7: thousands), **0**
filament cores, **215** coarse vertices, **24** currents at 60px width and ≤0.017 alpha.

**Why this is not a deletion.** A filament is a walk through a point cloud; the cloud's
*density* is the fact and the particular walk is a drawing decision. The weave knots sit at
the density maxima of that very field and the aerosol is its volumetric half, so raising
them while withdrawing the strokes keeps the same claim — *more light where there is more
material* — at the scale the near view can read. The total is deliberately **not**
conserved and the frame gets darker, because Product asked for calm and for real black
rather than for the same light redistributed.

**The window is the regime.** `lod` opens at exactly `A = 0.68`, which is where the readout
already changes to LIVING ANALYSIS. That is not tidiness — it makes "FAR and MID are
untouched" checkable over the whole of both regimes instead of at two sampled boards (§7).

## 3. NEAR, the four depths

| | what carries it |
|---|---|
| **1 · current constellation** | the focus as a luminous body, its tier-2 objects, and the relations between things that are *both in the frame* — cored, curved, coloured threads on cleared ground |
| **2 · direct context** | session objects: mark and glow, no body, no rim, no name |
| **3 · territory / world memory** | territory atmosphere reaching 1.62× further so neighbouring hues overlap into the focal frame; partial boundaries; the session envelope; broad current sweeps |
| **4 · cosmic background** | stars, nebulae, dust lanes — unchanged from WS7 |

### 3.1 The session becomes a place

The reference material builds a territory from three layers — outer glow, inner coloured
field, subtle boundary — and the middle one is what QANDEEL never had. A ring has an edge
and nothing inside it, which is why the current session read as a selection outline.

`ringFill()` closes the same noise wobble WS7 used for the rims, at twice the amplitude and
with **no stroke at all**, and the session is filled with it on approach while its rim
withdraws (`sesRim`). A second, wobblier, much fainter pass at 1.62× carries the outer
reach that the perfectly circular `haloBand` gives up. Two irregular extents at different
scales is what stops a region having a readable radius, which is the whole difference
between an atmosphere and a bubble.

Strength is the session's own share of the focus singleton with a constant floor, so the
current session is a place the reader is *inside* and its neighbours are places the reader
can *see*, on one continuous term with no ranking between them.

### 3.2 The focus is a body, not a target

WS7 drew the singleton as a dark disc, a hard near-white rim and a near-white centre dot,
with the frame's relations converging on it. Each part was doing something real, so each is
replaced rather than dropped:

- the **dark seat** kept the mark legible inside its own bloom. The focus clearing already
  spends darkness over a far wider area, so it is redundant — and removing it is what stops
  the centre of the frame reading as a hole;
- the **hard rim** carried the morphology. It survives at a third of the weight, warmed;
- the **centre dot** was the brightest pixel in the frame. It is now a warm luminous core
  with a real falloff — still the brightest thing, now the brightest thing *in* a world.

The three **morph on `lod`** rather than switching, so at FAR and MID this is WS7's mark to
the digit and the new language arrives with the rest of the resolution change.

The bloom also **halves**. It reached eleven focus radii — about 500px at NEAR — and the
frame's own instrumentation is how that was caught: `ملاحظة` is the focus itself and its
tier-2 neighbours stood inside the bloom. A light that erases what it reaches is not giving
the breathing room the brief asks for.

## 4. Where a thread is brightest — the most load-bearing line in this pass

The arc gradient, inherited unexamined from WS4, was **brightest at its two ends and
dimmest in the middle**. That is a sound way to say *this attaches* when one relation is on
screen, and the exact worst case when six of them share an endpoint: all six reach their
maximum at the one point they have in common.

**That is not a hub in the data. It is a hub the gradient builds.** At NEAR the profile
inverts — brightest along the span, falling away toward the objects, where the bead already
carries the attachment — and the colour comes up as the light comes down, so what is left
is a coloured thread rather than a white wire. At `lod = 0` every stop is WS7's value.

Three more terms finish the radial read:

- **the bow**, ×1.45 at NEAR and **scaled by voice**: curvature is what separates arcs that
  share an endpoint, which is a tier-2 problem. A contextual relation given the same bow
  just sweeps further and crosses more on the way;
- **the focus gap**, ×3.8 at the focus end only, scaled by that endpoint's *share* of the
  singleton so a transfer opens one gap while it closes the other;
- **a body**: one broad soft pass under each speaking core, so a thread reads as something
  lit rather than something ruled.

## 5. Connection disclosure

WS7 kept all 102 withdrawn relations on the frame, arguing that removing them would be a
lie about what is there. Product's correction is that this confuses canonical state with
the visible projection. Two terms, both continuous and both reversible:

- **voice**: at stable NEAR a tier-4 relation falls under the draw threshold and is not in
  the frame; tier-3 is at 43%; the focus's own are at full voice;
- **containment**: a relation is part of the *local* reading when both of the things it
  relates are in the frame. When one is not, it resolves out on that endpoint's own
  distance past the edge — so panning brings it back as the object comes in, and it never
  terminates at the frame edge, which would be the lie.

Plus a **viewport-relative length** term. WS4's length attenuation is against a fixed 1,600
units, which is a statement about the world and not about the frame: at NEAR the viewport is
640 units across, so a 400-unit relation spans two thirds of it and lost almost nothing. It
is now relative to the viewport and applied in proportion to distance from the reader, so a
relation the focus makes keeps its full length whatever it is.

Measured at NEAR: **40** relations drawn of 123, 32 of them fully in frame.
`__world()` still counts 123.

## 6. Object language, and type

Product's note was that the ring / square / oval / capsule glyphs read as telemetry. No icon
*meaning* changes — the five morphology slots are exactly as they were and still assert
nothing. What changes is the **material**: only objects the reader is actually reading keep
a body and an edge; the rest give theirs up and become small bodies with local glow.

**This was got wrong once and the render showed it.** The flat fill is written at
`al*(1-mat*0.80)`, so withdrawing the darkened body handed every background object its
*full* flat alpha back at the radius clamp, and the frame filled with bright teal lozenges —
the chunky-pill failure WS6 named, arriving through the door marked "integration". The mark
now comes down in both quantities that made it read as a symbol: its flat light and its
apparent size. `o.x, o.y` are untouched; geography does not change.

**Type.** WS7 held a tier-4 name at 13% and called it "legible as *a name is here*". A name
at 13% is not a reading — it is texture behind typography, which the brief lists twice. The
census closes: the constellation and its direct context are named, the rest of the world is
not, in the same way and for the same reason its relations are not drawn. Territory names
stay (0.22 at NEAR) so the reader still knows where they are. Arabic gets **more** room, not
less: fewer names, larger, on cleared ground. `__typeAudit()` passes on the delivered file —
`letterSpacing 0px`, `direction rtl`, weight in 400–700, IBM Plex Sans Arabic loaded,
`#evlog` at 1.7 leading, the Arabic HUD row carrying `lang="ar" dir="rtl"`.

## 7. What is preserved — proved, not claimed

Rendered through the **same painter and the same composite** at `now` pinned to 1000, at
700×394, WS7R against the delivered WS7 file:

| A | | |
|---|---|---|
| 0.00 · 0.10 · 0.20 · 0.30 · 0.40 | FAR | **pixel-identical** |
| 0.50 · 0.55 · 0.60 · 0.62 · 0.64 · 0.66 · 0.68 | MID, to the regime boundary | **pixel-identical** |
| 0.70 · 0.80 · 0.90 · 1.00 | LIVING ANALYSIS | differs, by design |

At 1400×788, A = 0 and A = 0.5: **0 differing pixels, max channel delta 0.**

That claim cost five separate corrections, and **none of the five was visible to look at**:

1. the bow **cap** was raised to 58×1.25 unconditionally — a silent geometry change to every
   long relation at FAR and MID;
2. the focus rim was rewritten in HSL, and `hsl(38,100%,95%)` rounds to `rgb(255,246,230)`
   where WS7's rim is `rgb(255,246,228)` — two levels in one channel;
3. `web.spread` was rewritten as `ss(0.46,1.0,A)*2.40`, widening every filament by 3.8% at
   A = 0.5: **77,000 pixels of the MID frame**, up to 5 levels, all brighter;
4. `P.focGnd` was edited in the constant pack, and that stratum first appears at A ≈ 0.58,
   inside MID;
5. the label census was written as one replacement ramp on `hier`, which starts at A = 0.50.

Each is now expressed as WS7's own expression multiplied by a `lod`-gated factor. A term
whose onset sits below 0.68 and is not gated on `lod` is the shape of every one of these
bugs, and it is the thing to check first in any successor pass.

Also unchanged and re-verified: `__rebalance()` finds **0** further moves on the delivered
file, 0 dead cells; `__decay()` reports every window reaching exactly zero; `__audit()`
passes all eleven geometry and authority assertions; all 19 background worlds present.

## 8. The MID inspection — a proposal, shipped OFF

Product asked whether the same over-dense substrate is holding MID back, and said not to
casually redesign it. Measured, it is: at A = 0.5 the census is 0.906 and the alpha 0.947,
so MID draws 91% of 8,180 filaments at 95% weight, and the crosshatch is visibly present
across the MID frame — it is simply out-shouted there by six coloured territories.

`K` applies the same move as §1 at about a third of the amplitude: census 0.906 → 0.63,
alpha 0.947 → 0.79, atmosphere +20%, knots +18%. It hands over to `lod` rather than
compounding with it. **It ships off**, and `ws7r-compare-mid.png` is the two frames side by
side. Flipping the default is one boolean.

## 9. The FAR composition check — also a proposal, also OFF

Judged as composition rather than as cell metrics, the fault at FAR is the **subject**, not
the sky. At A = 0 the user's own territory atmospheres run at 0.56 while the background
world ecology runs at 1.00 — nineteen private, unlabelled, unconnectable bodies lit harder
than the one world the view is about.

`J` raises the subject and lowers the surround: atmosphere +30% (capped at the approved WS4
Primary ceiling, so it discloses territory colour *earlier* and never re-lights past what a
distance already reaches), territory halo +26%, ecology −15%. Brightness in the ecology
population carries no meaning and demonstrably carries none, so a seventh off it costs no
information. **Nothing is done to the stars, the dust lanes, the balance plan or the dark
regions** — some darkness is desirable and none of it is spent here. `__rebalance()` still
finds 0 further moves with it on.

## 10. Performance

**Wall-clock timings on this host are not trustworthy and are not reported.** Draw-call
counts are deterministic. Counted at 1500×860, identical cameras, WS7R against WS7:

| A | strokes | fills | blits | gradients |
|---|---|---|---|---|
| 0.00 FAR | 2185 → **2185** | 7527 → **7527** | 1811 → **1811** | 163 → **163** |
| 0.50 MID | 3522 → **3522** | 6274 → **6274** | 2056 → **2056** | 163 → **163** |
| 0.70 | 8478 → 8438 | 4636 → 4626 | 1925 → 1923 | 192 → 192 |
| 0.85 | 9665 → **1923** (−80%) | 6271 → 5579 | 1319 → 1298 | 73 → 74 |
| 1.00 NEAR | 7586 → **926** (−88%) | 5726 → **2560** (−55%) | 986 → 899 | 58 → 48 |

*(Strokes, fills and blits are deterministic on a cold page. The gradient column is not —
`cachedRadial` allocates into a WeakMap on first sight of each object, so a cold `__count`
over-reports it by up to 45%. The column above is measured warm, on the second pass.)*

FAR and MID are **bit-identical in cost**, which is the arithmetic form of "the approved
compositions are preserved". NEAR is the most expensive distance in the study and it gets
**eight times cheaper in strokes**. Nothing new runs per frame: the tier lookup is a
`Set`/`Map` rebuilt only when an event changes the focus, and the one new geometry —
`ringFill` — is cached like every other world-space path.

**Device validation is still required and mobile performance is NOT solved.** But 926
strokes is a materially different proposition from 7,586 for a Skia port with a batched
atlas, which is what this scene has to become.

## 11. Reduced motion

The resolution change is a **static** compositional term and needed no separate path. The
one moving part in this pass is the thread-language morph, which runs on schedule terms that
are themselves functions of the camera, not of time. Every event still fires, all three
regimes are reachable. Durations were RM-scaled here (620 → 300 ms, 780 → 360 ms); §12 §F-B2
removes that scaling, because after F2 and F-A there is nothing left in the reduced path for
a shorter duration to shorten. `ws7r-reduced-motion.png`.

## 12. The correction pass (WS7R-C)

`/review-animations` blocked WS7R on two findings and Product approved five corrections.
All five are in; nothing else in the composition was touched, and FAR/MID are still
pixel-identical to WS7 at twelve sampled values of `A`.

| | before | after |
| --- | --- | --- |
| **F1** coarse field vertex, max α at which it leaves the frame | 0.2936 | **0.0163** |
| **F4** filament / trunk / current, same measure | 0.0771 / 0.1041 / 0.0569 | **0.0066 / 0.0071 / 0.0047** |
| **F2** object radius shift on a transfer, reduced motion | 7.66 px | **0** |
| **F2** arc bow shift, reduced motion | 71.26 px | **0** |
| **F2** focus-gap shift, reduced motion | 19.46 px | **0** |
| **F7** object radius shift on a transfer, *full* motion | 7.66 px | **0** |
| **F3** one-frame voice jump on an interrupted transfer | 0.46 | **0.051** |

**F1/F4 — the census resolves.** Each quantile cut now carries a fade band centred on
itself, so a member reaches zero before it is excluded rather than switching off at whatever
brightness it had. Two details carry the result. The band's width is *twice the distance
`lod` has withdrawn the cut*, which pins its upper edge and stops the edge sweeping through
the population; and each cut starts 0.06 **above** the top of its own population, so nothing
is excluded for the first third of the approach and the band is wide by the time anything
is. Each cut's coefficient was raised by the same 0.06, so every NEAR endpoint is the
approved one to the digit (`vcut` 0.18, `cut` 0.12, `curCut` 0.26). At stable NEAR the band
changes **0.06% of the frame, max 7/255** — it is a correction to the *transition*, not to
the composition. The trunk is the one exception and keeps a 0.043 residual; see limitation 1.

**F2 — reduced motion drops the geometry, keeps the light.** The three voice-driven spatial
terms are gated on `reduced()`: bow, focus gap, and (via F7) radius. Measured over a real
transfer under `prefers-reduced-motion`, all three now move **exactly zero pixels** while
`bodyK` — the light and material term — still travels its full 0.90. The state change is
fully disclosed; it is just no longer disclosed by moving anything.

**F-A — and the first version of F2 gated the wrong thing.** Forcing `bk` to 1 and `fk` to 0
removed the motion *and the composition*: the independent re-review measured a settled NEAR
frame **5.12% different, max 200/255**, with the threads running back into the focus body —
handing one class of reader the "blazing point with legs" §4c exists to prevent. A
preference about motion had become a different picture.

The correction is one idea in two places: **reduced motion changes the path, not the
destination.** Both terms still read the state; they read the *settled* state.
`relVoiceSettled` is the target membership with no crossfade and no event promotion, and the
focus gain is read as the canonical `o.focus` flag rather than through the crossfading
`focusObjGain`. At rest the settled value and the animated value are the same number, so the
two paths render the same frame; in a transfer the geometry resolves straight to its
destination rather than travelling there.

Measured on a virgin page, no event pending: **0 differing pixels** at A = 0.00 / 0.20 /
0.50 / 0.68 / 0.80 / 0.90 / 1.00, and the same after all five events have fired and settled.
Focus-end clearance **3.8× in both** paths; bow multiplier **max 1.45 in both**. Transition
displacement under reduced motion is still **bow 0px, gap 0px, radius 0px**, so F2's own
result is untouched. `ws7rc-fa-settled-parity.png`.

**F7 — voice no longer drives mark size.** `rd = r`, in both motion paths. 221 of 233 marks
return to their WS7 radius, median +61%. This is the largest visible change in the pass and
the only one that alters the stable NEAR frame: `ws7rc-f7-near-before-after.png`.

**F3 — the working set retargets.** `WORK.from` holds the *displayed* per-member voice at
the instant of an interruption instead of a snapshot of the target sets — the same thing
`EV.xfer` already did with `s0from`/`s0to`, which is why the light layer was sound and this
one was not. The residual 0.051 is smaller than the 0.060 first frame of an *uninterrupted*
transfer: what remains is ordinary motion, not a restart. `workBlend` still begins a new
interpolation at 0, because it is now the progress of a curve whose origin is the current
frame; the value it drives is continuous.

**F-B2 — and then the durations had nothing left to shorten.** Halving the six `MOT`
constants under the preference was right while the reduced path still moved things. Once F2
and F-A emptied it of spatial content, the halving only sharpened the light: measured, the
reduced focus transfer peaked at **1.86×** the default path's per-frame luminance change on
identical endpoints, an object birth at **2.47×**. The preference was handing the readers who
ask for less motion the harshest version of the one thing it still had.

Each of the six was checked against what its *reduced* path still does, not its full-motion
one, and all six turned out to be light-, material- or value-only — so all six take the
full-motion duration. The single exception proves the method rather than breaking it: `relT`
also drives the landing bead's `beadR*(1+land*0.55)`, which F2 never gated, so the reduced
path does still carry **one** spatial term. It is a 1.66px excursion on a 3.02px bead, and
lengthening it makes it **2.7× slower** (0.42 → 0.157 px/frame) — gentler in the spatial
dimension too. Shortening it would have been the only way to make either dimension worse.

Result: every reduced-motion light ramp is now **1.86×–3.00× gentler per frame** and equal to
the default path. Easing, endpoints and curves are untouched; `SLOWMO` still multiplies.
The ungated `land` is reported, not fixed — gating it is new behaviour, not a timing change.

Boards: `ws7rc-f1-vertex-resolves.png`, `ws7rc-f7-near-before-after.png`,
`ws7rc-rm-composition-at-rest.png` (the F-A defect), `ws7rc-fa-settled-parity.png` (its fix).

## 13. Known limitations

1. **The trunk census keeps a 0.043 first-frame step just past A = 0.68.** Its cut is already
   travelling when MID ends, so its band is necessarily born underneath members that are
   already inside it, and the only way to open it earlier is to open it *in MID* — which is
   not this pass's to touch. Down from 0.104; the widest band that fixes more re-admits
   trunks MID had excluded, which is the same defect pointing inwards.
2. **The inherited FAR→MID pop-in is untouched.** The filament cut sweeps from 0.40 to 1.00
   across FAR and MID on WS7's own term, with the same hard threshold. Every band in this
   correction is gated to be exactly zero at and below A = 0.68, because Product's decision
   also says FAR and MID do not move. The defect family is fixed on approach and still
   present on the way out to FAR.
3. **Two inherited rasterisation steps remain, and they are larger than anything F1 fixed.**
   With the camera pinned and A moved by 1e-5, `S.relBead` still steps the frame by up to
   **105/255** and `S.objMat` by **30/255**. Both are WS4/WS6 terms; both reproduce in WS7
   itself at 103 and 31, falling to 2 when the two are pinned. They are outside the approved
   scope and are reported, not fixed — but they mean a whole-frame pixel diff is not a valid
   instrument for census work on this prototype, which is why F1/F4 are verified at model
   level instead.
4. **Under reduced motion the focus clearance and the bow resolve in one step**, at the
   instant of the reader's own action, rather than travelling. That is the intended reading of
   "changes the path, not the destination", and it matches the stepped camera path WS6 already
   accepted as this prototype's reduced-motion idiom — but it is a one-frame change in
   geometry and it is named here rather than buried. Measured against its neighbours it is not
   an outlier: that frame changes 58,465 pixels where the median later frame changes 60,906.
5. **The landing bead still pulses under reduced motion.** `beadR*(1+land*0.55)` at the bead
   pass is the one spatial term F2 did not gate — 1.66px on a 3.02px bead, now spread over
   352ms rather than 132. Gating it is a behaviour change and was out of scope for a timing
   correction; it is the obvious candidate if reduced motion is ever revisited.
6. **A tier-4 name and a tier-4 relation are absent at stable NEAR**, not faint. This is a
   real reduction in what a single NEAR frame discloses. It is continuous and fully
   reversible by zooming out, and Product's correction authorises it in as many words — but
   it is a Product judgement and not a technical one.
7. **The constellation's topology is still radial**, because the data is: one focus with six
   relations is a star whatever the drawing does. §4 changes the language, not the graph. If
   Product wants a NEAR view that is not organised around one focus, that is a different
   Product question and `W` is how to see it.
8. **MID and FAR carry findings, not fixes.** §8 and §9 ship off. That is deliberate — both
   are Product decisions about approved compositions — but it does mean this pass leaves two
   known composition faults standing by default.
9. **The `L`-off frame is WS7 only inside this file.** It reproduces WS7's schedule, not
   WS7's source; the proof is the pixel diff, and it should be re-run rather than trusted if
   either file moves.
10. **No timing numbers.** See §10.

The limitation WS7R listed first — *voice drives the size of a background object's mark* — is
gone: Product rejected it as an unauthorised claim and F7 removed it from both motion paths.

## 14. The visual recomposition (WS7R-V)

Motion review closed PASS. Product then judged the NEAR frame as an image and accepted that
the WS7 mesh noise is gone while finding the result still too diagrammatic: a bright central
node, several long arcs, floating diagram glyphs, and colour that sat behind a graph rather
than being the thing the frame is made of. Five findings, all composition and material, none
of them motion. Everything below rides `S.lod`, so FAR and MID are untouched — proved, not
claimed, in §14.6.

### 14.1 The place is the shape of what is in it

The session's luminous field was a radial centred on `s.x, s.y`. The focus object stands
**109.8 units from that centre — 0.86 of the session radius**, where the gradient is already
down to ~30% of its peak. The warm field therefore peaked in empty space and the
constellation sat on its shoulder. That is the whole of "the session label feels detached":
the centre of a circle drawn around a set of objects is not where those objects are.

On approach the field becomes the **sum of its members** — one soft body of the session's own
light per object it contains — plus its own weather (`sesAero`, 32 overlapping ellipses across
a 3.5:1 size range, seeded on the membership, built once and cached, never animated). The place
is now dense where the work is, thins where nothing is happening, and has no radius to read.
Nothing moved: `s.x, s.y, s.r` and every `o.x, o.y` are untouched.

`S.sesRim` 0.80 → **0.94** and the session halo band 0.58 → **0.86**: at a fifth, the rim was
invisible against WS7R's dark ground and a legible circle against this material — the bubble
language the brief rules out twice. Its job is now done three times over by things with no
readable radius.

### 14.2 One strongest object is not one central sun

The focus was a bloom at 0.46, a soft halo at 0.62 and, on top of both, a **flat near-white
disc at 0.90** — additive, so it clipped to pure white over a wide enough area to be the one
thing in the frame with no falloff at all. A flat maximum is what the eye reads as a specular
point, and a specular point is what makes threads into legs.

All three come down at NEAR and what is left is warm rather than white; the rim gives four
fifths of its weight to a limb, and the centre dot becomes a body with falloff. Measured over a
70px disc at 2100×1181:

| | WS7R | WS7R-V |
| --- | --- | --- |
| focus | 136.0 | 161.0 |
| the four local partners | 61.3 / 59.1 / 37.8 / 42.0 | 138.9 / 102.7 / 67.1 / 105.5 |
| focus ÷ brightest partner | **2.22** | **1.16** |
| focus ÷ mean partner | **2.72** | **1.55** |

Still the strongest object — the singleton rank is untouched — and no longer the only one.

### 14.3 One light in the room

Every body's limb faces the **current focus**. There is one light in this room and it is the
thing QANDEEL is working on, so the light Product asked to see "shared across the meaningful
local relationship" is carried by the bodies themselves. It encodes direction to the focus,
which is a projection quantity of the same class as the off-viewport term, at the same strength
for every body. Same silhouette, same radius — §F7 stands.

### 14.4 A body is lit; a symbol is drawn

A working-set object was a halo at 0.062 — a twentieth of the light its own outline carried —
a body filled at 24% lightness, and an even rim at 1.35× the body's alpha. Read that back as a
recipe and it is an outline icon with a dark interior, which is why the close crop showed holes
where the working set should be.

At NEAR the ratio inverts: halo ×4.6 plus a second much wider one, a luminous core inside the
silhouette, the interior refilled as coloured material rather than near-black, and the even rim
down to a fifth with a limb carrying the rest. Two numbers had to be found by rendering rather
than by argument, and both were wrong first time: a body, a limb and a core stacked additively
on a 20px mark **clip to white**, and a limb at 96% lightness is a specular highlight — a white
hard edge is the strongest "graphic symbol" cue there is, whatever shape it traces. So the
silhouette stays dimmer than its own halo, and the limb goes *up* in saturation as it comes
down in lightness. The five morphology slots, the rotation and the radius are unchanged; no
icon means anything new.

### 14.5 The span is true; the span is not the hero

The focus has **eleven** relations. Their lengths, against a viewport 640 units wide:

```
  76   83   132   190  |  343  362  369  534  598  633  674
  the local reading    |  canonical cross-session links
```

Seven are longer than half the frame and four are longer than all of it. They are true — the
world build wires the current session's first object to five other sessions on purpose — and at
this zoom they were also the entire radial reading.

None is dimmed, shortened or dropped. Each arc **resolves along its own length**: six samples
of the quadratic, each asking how local that point is. The parameter maps exactly — the control
point is the chord's midpoint displaced along the chord *normal*, so the projection of B(t) onto
the gradient axis is t — which is why six stops are enough and no approximation is involved.

Two attempts failed first, and both failures are worth recording. An **end-to-end** ramp changed
nothing visible: a 674-unit relation is only a third of the way along when it leaves the frame,
so its far endpoint's value never reaches the part the reader can see. And a **radial** ramp in
world units changed nothing vertically: a viewport 640 across is 360 tall, so a radius wide
enough to spare the fourth local partner at 190 units was wider than the half-height. The ramp
is therefore measured in *frames* — normalised by the viewport's own half-extents, 1.0 being the
edge whichever way you leave it. Result:

| relation | leaves the frame at | resolution there |
| --- | --- | --- |
| 77, 83, 132, 190 | never | **1.00 end to end** |
| 343, 362, 369 | t = 0.74 / 0.99 / 0.94 | **0.07** |
| 534, 598, 633, 674 | t = 0.65 / 0.55 / 0.51 / 0.48 | **0.07** |

Every member of the local reading is untouched end to end — including the neighbour-to-neighbour
arcs, which is what stops the constellation collapsing back into a star. Nothing terminates at
the frame edge; panning restores an arc as its far end comes back into the local field.

### 14.6 Material density, and what it cost

Product's follow-up: the world is too line-led and too weak in inner fill, broad blurred colour
mass, nebular depth and soft outer glow. Three answers, all `lod`-gated:

- the territory **aerosol** discloses by 85% → **62%** on approach instead of 30%, at 1.62×
  size — WS6 built it to disclose, it was disclosing barely;
- a **colour bed** per territory with the opposite profile to the existing inner atmosphere.
  That atmosphere is dimmest at the territory's centre and peaks at 0.90 of its radius, which
  is right when the territory is a thing you look at and exactly wrong when you are standing in
  it: at NEAR the camera sits 0.27 of a radius from the centre, in the faintest part of its own
  colour. Most of "lines over darkness" was that;
- a **soft outer atmosphere** on the session, seated on the membership, at 2.7 session radii.

Two balance findings came out of rendering it. The first bed was written at 36% lightness and,
being additive, added luminance as fast as colour — the whole frame became an even teal haze and
the cosmic depth on the PRESERVE list was spent on a wash. At 26% with saturation raised
instead, the same pass adds chroma and almost no brightness. The second: amber spread thinly
over teal sums to **olive** — additively, yellow and cyan are complementary and what they make
is mud. The session's material is now more saturated and tighter rather than pale and wide, and
six degrees warmer at NEAR (32, not 38) for the *place's* light only; `P.focusHue` and the focus
body itself are untouched.

Measured at 2100×1181:

| | WS7R | WS7R-V |
| --- | --- | --- |
| frame mean | 42.52 | 60.96 |
| 5th percentile (the floor) | 16.81 | 23.74 |
| corners (cosmos) | 35.75 | 44.06 |
| centre (the place) | 57.37 | 89.19 |
| **centre ÷ corners** | **1.60** | **2.02** |

The frame is brighter, and it is brighter *unevenly*: the place gained 55% and the cosmos 23%,
so the depth structure the four-layer composition depends on came up rather than down.

### 14.7 A place-name is not an object label

Two failures that compound. **Where**: the name sat at the bounding circle's centre, in empty
space beside the constellation; it now sits at the membership centroid and a little above it,
the way a map sets a region's name over its own settlements. **What size**: the session name was
27.8px and an object name 28.1px, at the same lightness on the same plate — a place and the
things inside it were typographically the same rank, so the frame offered no reason to read one
as containing the other. It is now **43.3px** (1.37× an object label, against 0.88× before) and
*quieter*: weight 600 → 500, alpha ×0.62, plate ×0.70. Large and low-contrast is how a map says
"region"; small and bright is how it says "this thing here". Arabic stays the primary identifier
and gets more room, never less, and 1.62 leading clears the diacritics on `الآن`.

### 14.8 Preservation

`S.lod` is **exactly 0 for every A ≤ 0.68**, and every term in this pass is written either as
`lerp(existing, new, S.lod)` or behind an `S.lod > 0.02` gate. Against the boards of the build
that passed the motion review, at 2100×1181:

| | differing pixels | max channel |
| --- | --- | --- |
| FAR (A = 0) | **0** / 2,480,100 | 0 |
| MID (A = 0.5) | **0** / 2,480,100 | 0 |

Continuity across the ramp: mean luminance over A = 0.66 → 1.00 in 20 steps with the camera
pinned rises **43.66 → 64.43** with first differences of 0.17–1.82 and no spike — the largest
steps are mid-ramp, where the smoothstep derivative peaks. No pop at any gate.

Three stops and not six in the relation core pass, deliberately: the colour structure there is
not flat, so an inserted stop would have to carry the colour canvas itself would have
interpolated at that position, in premultiplied RGBA, and getting that wrong is a silent change
to every relation at FAR and at MID. The flat passes take six because a uniform colour is
uniform at any number of stops.

Boards: `ws7rv-near-hero.png`, `ws7rv-compare-ws7rc-to-ws7rv.png`, `ws7rv-focus-crop.png`,
`ws7rv-composition.png`. `window.__geom()` is new instrumentation — it reports the model's own
composition geometry and changes nothing.

Not addressed, and unchanged: motion, semantic-zoom mechanics, reduced motion, FAR, the MID and
FAR proposals (still off), the relation count, and every limitation in §13. Limitation 7 is
worth re-reading against this pass: the topology is still radial because the data is, and §14.5
changes how far each arc is *read*, not the graph.

---

## 15. The colour finish (WS7R-V2)

Product's verdict on §14 was that the composition is close enough and the remaining problem is
colour, material and light quality: the frame reads as olive, as a warm flood over teal, as
generic glow haze, and it wants to read as galactic light — cyan nebula, pale starlight, gold as
an accent, and genuine black between luminous regions. Shot class unchanged, composition
unchanged, disclosure unchanged.

### 15.1 The olive was never the amber

§14.7 had already moved the focus hue six degrees off yellow and it did not work, because the
axis was wrong. `P.focusHue` is not too yellow at 38 or at 32. What was wrong is that the
session handed **one** hue to every term it owns — halo band, interior, envelope, members,
weather, outer atmosphere, rim — through `hueMix(s.hue, P.focusHue, fg)`. A session holding the
focus therefore painted about a third of the viewport one warm colour, and a warm field that
size summed additively over the territory's cyan is olive at **any** yellow you pick. Amber and
cyan are additively complementary; spread thin over each other they make mud, and the area is
what decides, not the hue.

So the NEAR-only half of the session splits onto its own hue (`hueC = s.hue + 18`, i.e. 188)
and the warm comes back as a small sprite with a radius (§15.2). The two never overlap as broad
masses again.

**Why a second hue and not a moved one.** 38 and 188 are 150° apart, and every continuous path
between them runs through green or through magenta. Any term that interpolated from one to the
other would be a green term somewhere on the approach ramp — a visible flash between A 0.68 and
A 1.0. Crossing them **in alpha** costs nothing and is never a colour that is not in the
palette, and the crossing was already built: the warm terms are exactly the ones that retire on
`lod` (the halo band to 14% of its weight, the rim to 6%) as the cool ones arrive.

**What still says "this session is current"** without a warm cast: its field alpha is five times
a neighbour's, it alone gets the member-shaped field, it alone gets weather, its rim is nearly
twice as strong, its name renders warm white, and `الآن` beneath it is gold. Six channels, none
of them a colour wash over a third of the frame.

### 15.2 Gold as an accent means gold with an extent

The warmth removed in §15.1 returns as a third sprite over the cool two, on a falloff from the
focus: `wk` is 1 on the focus, past 0.5 by a third of a session radius, gone by seven tenths.
The nearest other member of this session stands at 0.60 of a radius, so in practice this is the
focus, a breath of it on its closest neighbour, and nothing else. It is a separate sprite and
never a hue mixed into the cool ones, for the reason in §15.1.

The focus's own outermost skirt contracts from 3.3 object radii to 2.8, which is the only gold
in the frame that was ever wide enough to be a field.

And the focus clearing (§12b) deepens 1.18 → 1.40 on `lod`. This was found by looking, not by
arithmetic: at 2× in the focus crop the ring immediately outside the mark had gone chartreuse,
which is the whole pass's disease in miniature. Two lights that must not average are separated
by **darkness between them**, not by tuning either one; the clearing already exists to do that,
it is subtractive so it costs the tone curve nothing, and what it encodes does not change.

### 15.3 The floor was the aerosol, and it was measured, not guessed

Switching each stratum off in a 1050×591 NEAR frame and reading the result:

| stratum off | frame mean | corners | below level 18 |
| --- | --- | --- | --- |
| nothing (V2 mid-pass) | 62.77 | 43.83 | 1.11% |
| territory aerosol | 38.88 (−23.9) | 31.72 (−12.1) | 7.36% |
| territory atmospheres | 50.93 (−11.8) | 33.13 (−10.7) | 8.98% |
| session field | 48.11 (−14.7) | 41.96 (−1.9) | 2.40% |

The aerosol is the largest single light in a NEAR frame, and the session field — the term that
looks like the problem — barely touches the corners at all, which is what it was designed to do.

§14.7 raised the aerosol's alpha **and** grew every cloud by 62%, and the second half undid the
first: at 1.62× reach its 72 clouds overlap into a continuous sheet, and a continuous sheet of
anything is haze. That is the whole of "generic glow haze", and it is also why §14 could be
given colour without ever getting darker — the frame had no gaps left to be dark *in*.

V2 spends the same light the other way: clouds grow by a sixth instead of by three fifths and
carry half again more alpha each. The cores stay where they were and real space opens between
them. **Light floating in darkness is a statement about variance, and a wash has none.**

The territory outward atmosphere also gives up a quarter of its weight on `lod`: 2.2 territory
radii of flat gradient, six of them overlapping, with no structure at any scale the close view
can resolve — inside a territory every level it contributes is a level of black spent on
nothing.

### 15.4 Three cool notes, not one teal at three brightnesses

| stratum | FAR/MID hue | NEAR hue | how |
| --- | --- | --- | --- |
| territory atmosphere (in/out) | 170 | 170 | unchanged — the world's colour, and FAR is made of it |
| territory colour bed | — | **196** | constant; the bed has no existence below A 0.68 |
| session place, weather, members | 170 | **188** | `hueC`, gated on `sesField`/`memb` |
| session weather, per cloud | — | **170–214** | `hueC + dh`, `dh ∈ [−18, +26]` |
| territory halo bands | 170 / 136 | **186 / 152** | `+16·lod`; `haloBand` uses `radial`, not the cache |
| object **atmosphere** | 170 | **186** | `+16·lod` |
| object **body**, fill, limb | 170 | 170 | unchanged — the body keeps what identifies it |
| relations | 170 | **186** | `+16·lod`; 54%/68% at 170 is mint, the most diagram-like colour in the frame |
| focus | 38 | 38 | unchanged |

The cache is the trap here and it is worth stating plainly: `cachedRadial` keys on the object and
a slot name, so **a hue that moves with `A` is served stale for every frame after the first**.
Every lod-dependent hue in this pass is therefore either on an uncached path (`radial`,
`haloBand`, the `glow` atlas, which buckets hue to 10°) or on a stratum that has exactly one hue
because it has no existence outside NEAR (the bed).

`sesAero` also gains a per-cloud lightness jitter of ±6. Thirty-two samples of one colour at one
exposure is fog however well it is shaped; what separates nebula light from smoke in a
photograph is that the colour **varies across the mass**.

### 15.5 Starlight

Points are the one population that can add sparkle without adding haze — they raise the frame's
peak and not its floor, which is the opposite of every broad term this pass took light away
from. `S.clus` recovers ×1.62 and `S.stars.a` ×1.26 at NEAR, and the bright-star halo gets ×1.75
alpha and 18 points more saturation (the star hues are already 192–228 for nine in ten of them).

The magnitude **threshold** is untouched on purpose: moving it would have stars arriving with a
full halo out of nothing, which is a pop. The population is exactly the approved one; only its
light changes, continuously.

### 15.6 What the numbers say

2100×1181 NEAR hero, same camera, same frame:

| | WS7R-C | WS7R-V | **WS7R-V2** |
| --- | --- | --- | --- |
| mean hue of the frame | 169.8 | **160.8** (toward yellow) | **186.9** (cyan) |
| mean saturation | 44.9% | 41.8% | **65.9%** |
| mean RGB | 26·47·44 | 39·**68**·59 (G > B) | 21·57·**61** (B > G) |
| frame mean | 42.52 | 60.96 | 49.53 |
| 5th percentile | 17 | 24 | 18 |
| 95th percentile | 76 | 107 | 95 |
| corner mean | 34.94 | 43.40 | **35.29** |
| centre mean | 58.85 | 93.31 | 75.05 |
| centre ÷ corners | 1.68 | 2.15 | **2.13** |
| share below level 18 | 6.42% | **1.00%** | **4.73%** |
| focus ÷ brightest partner | 2.22 | 1.16 | **1.16** |
| focus ÷ mean partner | 2.65 | 1.35 | 1.32 |

The G>B → B>G inversion in the mean RGB is the olive leaving, in one number. Saturation up half
again while the corners return to the pre-V level and the dark share nearly quintuples is
"richer, but also cleaner": the light stayed in the luminous regions (centre 75 vs C's 59, p95
95 vs C's 76) and left the edges.

### 15.7 The focus rank was restored, not re-cut

The colour work cost the singleton measured rank it was never meant to spend. The place's light
now peaks on every member — including the focus's partners — and the focus's own skirt had been
narrowed in the same pass; integrated over a 70px disc that took the focus from 1.16× its
brightest partner to **1.06×**. 1.16 is the hub reduction Product accepted in §14, not a floor
to keep descending from.

It is restored by concentration, not by reach: the focus's inner radial goes 0.24 → 0.30 and
0.125 → 0.155 on its NEAR alphas, and the skirt keeps its narrower 2.8 radii. Back to 1.16 /
1.32.

Worth recording as method: this was caught only because the ratio was re-measured after a change
that had nothing to do with hierarchy. A colour pass moves light, and light is what rank is
made of.

### 15.8 Preservation

- **FAR (A=0): 0 of 2,480,100 pixels differ**, max channel difference 0, against `ws7rc-far-hero.png`.
- **MID (A=0.5): 0 of 2,480,100 pixels differ**, max channel difference 0, against `ws7rc-mid-hero.png`.
- **Reduced motion, settled: 0 of 620,550 pixels differ** from settled full motion. F-A holds.
- Ramp continuity, camera pinned, A 0.66 → 1.00 in steps of 0.01: 47.62 → 56.11 mean luminance,
  every first difference in [−0.91, +0.76] — under one level, no spike at the 0.68 gate. The one
  negative step is the sprite-resampling noise of §13 limitation 3.
- `__audit()`: every assertion true, 233 objects, 123 relations — both unchanged.
- No motion code, no timing, no easing, no `MOT` constant and no reduced-motion branch was
  touched. No relation was added, removed or re-disclosed. No LOD mechanic, no camera, no
  semantic-zoom term. No geometry: every `x`, `y`, `r` in the model is the byte it was.

### 15.9 What is still weak

1. **The right third of the hero is still the greenest part of the frame.** It is the health
   territory's own 136 arriving at 152, and a neighbour's identity showing through is wanted —
   but it is the one region that still reads jade rather than aqua, and it is the first place to
   look if Product still sees green.
2. **At 2× the material is smoother than at 1×.** The focus crop shows an even cyan with stars;
   the pockets that carry the hero are at session scale and there is nothing below them. A third
   scale of structure inside the aerosol would be the honest answer and it is not in this pass.
3. **The dark share is 4.73%, not the 6.42% of WS7R-C.** The frame is genuinely darker at the
   edges but it is not as black as the pre-V build, and it should not be — that build was the
   one Product called lines over darkness. Where between 4.73 and 6.42 the right answer sits is
   a Product call, not a measurement.
4. **`hueC = s.hue + 18` is a constant, not a token.** Every NEAR hue offset in §15.4 is a
   literal at its call site. That is honest for a workshop prototype and would be wrong in
   product code, where these belong in `P` next to `focusHue`.

---

## 16. The NEAR freeze

Product accepted the WS7R-V2 NEAR result and recorded **I-08B1 / NEAR VISUAL BASELINE —
APPROVED / FROZEN**, retaining **I-08B1 / WS7R — MOTION REVIEW — CLOSED / PASS**. I-08B1 itself
is **not** closed.

### 16.1 What exactly is frozen

The artefact, not the description of it. The frozen thing is one file at one hash:

```
wf-living-constellation.html
299,893 bytes
SHA-256  7D7D5B5502D7B18D6D35F89F8A2DB74213A55851F65DC98068FEC6A726E39A34
```

Archived as `I-08B1-NEAR-BASELINE-APPROVED.zip`, which carries the prototype, the capture
server, these notes, the three V2 proof boards and the two preservation reference frames, so the
baseline can be re-rendered and re-diffed without this session.

The freeze binds the **NEAR** view — the composition, colour, material, light and motion at
A = 1. It does not bind MID or FAR beyond the preservation guarantee that was already in force,
and it does not promote anything in the render to a runtime semantic.

### 16.2 The state as verified at the moment of freezing

Everything below was measured on the frozen SHA, not carried forward from an earlier pass.

| check | result |
| --- | --- |
| **NEAR, A = 1, vs `ws7rv2-near-hero.png`** | **0 of 2,480,100 pixels differ** — the proof board is not *a* render of the baseline, it is *the* render, reproducible from the archived file |
| FAR, A = 0, vs `ws7rc-far-hero.png` | **0 of 2,480,100 pixels differ**, max channel diff 0 |
| MID, A = 0.5, vs `ws7rc-mid-hero.png` | **0 of 2,480,100 pixels differ**, max channel diff 0 |
| reduced motion, settled, vs full motion settled | **0 of 620,550 pixels differ** |
| ramp continuity, camera pinned, A 0.66 → 1.00 step 0.01 | 47.62 → 56.11; every first difference in [−0.91, +0.76] |
| `__audit()` | every assertion true |
| world data | 233 objects · 123 relations · 34,847 field vertices · 8,180 filaments · 54,998 links · 96 currents · 19 background worlds · 28 clusters |
| focus ÷ brightest in-session partner, 70px discs | 1.16 |
| focus ÷ mean in-session partner | 1.32 |
| frame mean hue · saturation | 186.9 · 65.9% |
| corner mean · centre mean · ratio | 35.29 · 75.05 · 2.13 |
| share of frame below level 18 | 4.73% |

### 16.3 What reopens NEAR, and what does not

Closed to **taste**. A later preference, a fresh eye, a different reference image, or a wish for
more or less of any of the nine accepted characteristics is **not** grounds to reopen.

Open only to a **contradiction**, which means one of:

1. a preservation diff in §16.2 that stops being zero;
2. a semantic claim the render makes that the model does not support — brightness, size, glow or
   position encoding something that is not true of the data;
3. an accessibility or Arabic-readability failure at a real viewport or type scale;
4. a portability finding from the Skia / Reanimated port that this composition cannot survive;
5. a motion regression, which reopens the motion review rather than the visual baseline.

Anything reopened this way is a correction to the frozen artefact, recorded against this SHA —
not a new aesthetic pass.

### 16.4 Known weaknesses accepted into the baseline

§15.9 is **not** a to-do list any more; it is the accepted cost of this baseline. Restated so
nobody later reads it as unfinished work:

- the right third of the NEAR frame reads jade rather than aqua, because the neighbouring
  health territory's identity hue is 136 and it correctly shows through;
- the material is smoother at 2× than at 1×, because there is no third scale of structure below
  session scale;
- the dark share sits at 4.73%, between WS7R-C's 6.42% and WS7R-V's 1.00%;
- every NEAR hue offset is a literal at its call site rather than a token in `P`.

The last of these is the only one that should change on the way to product code, and it is a
refactor with no visual consequence — it must land as a zero-pixel diff against this SHA.

Every limitation in §13 also survives the freeze unchanged.

---

## 17. The MID world-territory map (WS7R-M)

Product supplied a reference image as the target visual class for MID and commissioned MID as
the next target: a **living life map** answering "what does my world look like?", where NEAR
answers "what is QANDEEL working on here?". Reference kept as `ws7rm-reference-target.png`.

### 17.1 The same inversion, one distance out

WS5's schedule opens with *"disclosure means what RESOLVES, never what exists"*. §1 of these
notes records that every pass had applied it to every stratum except the global substrate,
where it was inverted, and that WS7R fixed it **at NEAR only**. It was still inverted at MID,
and the numbers are not subtle. At A = 0.5, before this pass:

| stratum | at MID | what it is |
| --- | --- | --- |
| field alpha `web.a` | 0.947 | the global substrate |
| field census `web.cut` | 0.906 | 91% of the surviving filaments |
| filament `core` | **1.000** | every filament still a narrow bright wire |
| currents | 0.968 at unit width | 96 ruled arcs crossing the map |
| territory aerosol | **0.275** | the only volumetric, territory-local colour |
| session interior | **0** | — |
| object interior | **0** | — |

MID drew the world as a global mesh with faint colour behind it. That single fact is what
separated it from the reference, and it is why the fix is not a new aesthetic but the pass the
schedule always implied.

`S.map` is that correction's ramp, and it is a **bump**, not a step:

```
S.map = MAPON ? ss(0.12,0.50,A) * (1 - ss(0.56,0.98,A)) : 0
      A = 0   -> 0     FAR untouched
      A = 0.5 -> 1     full MID correction
      A = 1   -> 0     the frozen NEAR untouched
```

`ss` clamps at both ends, so those two zeros are exact and FAR and the frozen NEAR are
bit-identical **by construction** rather than by tuning. Its fall overlaps `lod`'s rise from
0.68, which is what makes entering NEAR feel like entering INTO this world. Switch: **`MAPON`,
on by default** — Product commissioned this, so it is the composition, not a proposal. The
separate WS7R §8 MID density proposal (`K`) is **not** enabled; mixing an unreviewed change
into a commissioned pass would make neither legible.

### 17.2 §M1 — at MID the field is particles, not lines

The reference and WS7's MID both have a dense connective texture. What separates them is that
the reference's is **particulate** and the map's is 944 filaments each carrying a narrow bright
core — a wire. WS6 named this and WS7R applied the answer at NEAR only: withdraw the core,
widen the wide pass, and a stroke with no centre stops being a line and becomes weather.

- `core` 1.00 → 0.28, `spread` ×1.55. No light leaves the frame — the wide pass carries what
  the core gives up — it leaves **lines**.
- `cut` 0.906 → 0.562 with a 0.393 band beneath it, built the same way as WS7R-C §F1/F4 so
  nothing ever leaves above zero: 1,090 filaments → 944.
- currents: 0.968 → 0.407 at **2.45× width**. The count is untouched; off-viewport
  continuation is on the PRESERVE list and every current still runs off both edges.
- field vertices: ×3.3 light, ×2.3 size, and the fine population's own ramp `fineV` splits off
  `fine` so the fine **particles** arrive at MID while the fine **filaments** stay off.

**§M1b, and this is the part that was got wrong first.** The first render raised every vertex in
the world and the frame filled edge to edge. A uniform lift is the difference between local
texture and global noise — the exact thing the brief rules out. `p.inT` is a point's membership
in the world's regions: 1 inside any territory hull, falling to 0 by 1.10 of the nearest hull's
radius on a smoothstep. Computed from `TER` and the point's own fixed coordinates, cached
lazily in the painter — **not** in the build, because touching the build moves the random
stream and rebuilds the approved world. It asserts nothing; it is a disclosure rule, and what
it resolves toward is where the world's regions actually are.

### 17.3 §M2 — a territory is a region, not a label over a wash

WS7's territory is an inner atmosphere that is **dimmest at its centre** and peaks at 0.90 of
the radius, plus an outward half beyond the hull. At map scale that is two soft blooms and a
name floating above them: the reader cannot see where a territory begins or ends, which is why
`العمل` did not read as the largest field in the world even though it is 468 screen pixels of
radius against its neighbours' 266–315.

Three terms answer it, and the measurement that matters is **edge ÷ interior**:

| territory | WS7 MID | WS7R-M | |
| --- | --- | --- | --- |
| العمل | 1.12 | **1.53** | 41.2 → 57.1 interior, 46.0 → 87.2 edge |
| الصحة | 1.55 | **1.93** | |
| المال | 1.44 | **1.76** | |

- a **fill** (`mbed`), fullest where the territory is, gone by its own hull, in the territory's
  OWN hue — six distinct identities is the multi-colour life map, and hue at this distance is
  how a reader tells one life territory from another;
- the **halo band** ×2.45 — a gradient about a radius, not a stroke, so it has no width to
  trace and cannot read as an outline. Constant across territories, varying only with depth: a
  bigger territory reads as bigger because it **is** bigger, not because it was given more
  light;
- the **rim** ×3.15 and **narrowed** to 0.62/0.66 of its width — crisper, not wider. It stays a
  presence band: the amplitude and the break pattern are untouched, so it is still an irregular
  stroke that thins and vanishes and returns, never the even closed curve QAN-GOV-02 §8 forbids.

### 17.4 §M3 — nesting, and the hole in the middle

A session inside `العمل` was a ring on the same ground as everything else, so nothing said it
was inside anything. The reference solves this the way a map does: a slight fill four lightness
points above the parent's bed in the same hue, plus a thin lit perimeter (`rim` ×2.3, narrowed).
Two weak cues that agree read better than one strong one that has to shout — and after seeing
the reference at full size, the ring carries more of it than the fill does.

The focus's dark seat also loses three quarters of its weight at map scale. It is a 94%-black
disc under a white rim; against WS7's dim MID it read as a mark, and against this one it was the
only hole in a luminous map — a pin dropped on a world. `hier` is still 0 at MID and the focus
asserts exactly what it asserted. **This removes a hole, not a hierarchy.**

### 17.5 §M4 — the floor, measured against the reference itself

The first balance was too bright, and the only honest target for "how dark" was the reference
image, so it was measured rather than judged:

| | reference | WS7 MID | first WS7R-M | **shipped** |
| --- | --- | --- | --- | --- |
| frame mean | 27.5 | 28.3 | 47.4 | **43.7** |
| 50th percentile | 19 | 24 | 39 | **35** |
| 95th percentile | 79 | 59 | 111 | **104** |
| 99th percentile | 181 | 117 | 200 | **194** |
| share below level 18 | **47.9%** | 31.5% | 11.5% | **15.6%** |

The first balance already had the reference's **peaks** (p99 200 against 181). What was wrong
was the **floor**, at twice the reference's. So: the outward atmosphere −68% (2.2 territory
radii of flat gradient, six of them overlapping, and at MID that is precisely the space
*between* the territories), the inner atmosphere −26% (it peaks at 0.90r, so most of what it
gives up is interior floor, and the edge it also lit is now carried several times over by §M2),
and the cosmos −34% (a lit sky behind a lit world, the contributor furthest from anything the
reader is looking at).

**15.6% is not 47.9% and will not become it.** The reference's territories are small circles in
a large black field; ours are six large hulls that nearly tile the frame at this camera. That
is canonical geometry, not a visual choice, and closing the gap would mean shrinking
territories — i.e. inventing data. Recorded as a known divergence, not as unfinished work.

Draw calls at MID: **11,687 → 11,494**. The census cut and the withdrawn cores pay for every
particle and every fill this pass adds.

### 17.6 What the reference was NOT allowed to change

The brief is explicit that canonical truth outranks the image, and four things follow:

1. **Six territories, not fifteen.** `TER` has `work / faith / health / fam / money / learn`.
   Of the fourteen names the brief lists, five are in the world (`المال`, `الإيمان`, `الصحة`,
   `العائلة`, and `مشروع جانبي` as a **session** inside `العمل`) and `التعلّم` covers a sixth.
   The rest — `أحمد`, `العلاقة مع أحمد`, `البيت`, `التطوير الشخصي`, `الموهبة`, `السفر`,
   `مشروع جديد`, `فكرة جديدة` — are not. They were not added, and the decisive reason is not
   taste: `TER` feeds the world build's random stream, so one more territory rebuilds all
   233 objects and **breaks the frozen NEAR baseline and FAR both**. The density gap against
   the reference is a data difference and is stated as one.
2. **No status lines.** The reference labels every territory `(نشط)`, `(خامل)`, `(ناشئة)` and
   `العمل` as `(نشط · ضغط مرتفع)`. Those are **activity level** and **load**, and neither
   exists in canonical state. The only status this map shows is `الآن` under `جلسة ١٢`, which
   is the focus singleton the model actually carries.
3. **No anchor glyphs.** The reference puts an anchor under several territories. Whatever it
   encodes, nothing in canonical state supports it.
4. **No dense inter-territory web.** The reference's signature is a bright particulate web
   filling the space *between* its territories. It is beautiful and it is the one place the
   brief itself diverges from the image: *"Between territories: only canonical / authorized
   relationships. Do NOT create a global technical mesh."* Building it would be the global mesh
   under better lighting. Not built.

### 17.7 Preservation

- **FAR (A=0): 0 of 2,480,100 pixels differ**, max channel difference 0.
- **Frozen NEAR (A=1): 0 of 2,480,100 pixels differ**, max channel difference 0, against
  `ws7rv2-near-hero.png`. The §16 freeze is intact and re-proved at this SHA.
- **MID reproduces bit-identically** from the shipped file against `ws7rm-mid-hero.png`.
- **Reduced motion, settled, at MID: 0 of 620,550 pixels differ** from settled full motion.
- `__audit()`: every assertion true. 233 objects, 123 relations, 34,847 field vertices, 8,180
  filaments, 96 currents, 19 background worlds, 28 clusters, 27 knots, 72 aerosol — every count
  unchanged. `__typeAudit()`: letter-spacing 0px, direction rtl, IBM Plex Sans Arabic loaded.
- **No relation was added, removed or re-disclosed.** No geometry moved.
- FAR was not worked on and the `J` FAR proposal was not enabled or modified.

### 17.8 Known weaknesses

1. **The approach dims faster.** Camera pinned, the steepest relative step on the MID→NEAR
   transit goes from **4.41%** of frame luminance per 0.01 of A to **6.95%**, at A ≈ 0.83–0.85.
   The four steepest steps are consecutive, so it is a slope and not a pop, and at ~1.2% per
   frame on the 9.8 s path it is a smooth dimming — but it is a real change to a path whose
   motion review is CLOSED/PASS. **`/review-animations` should be run by hand before MID is
   frozen**; this session cannot invoke it (see the skill-use note).
2. **15.6% dark against the reference's 47.9%** — §17.5. Geometry, not tuning.
3. **`صلاة الفجر` sits on the densest particle cluster in `الإيمان`** and is the least readable
   label on the board. Every other label clears its ground.
4. **`العمل`'s interior particle density is lower per unit area than its neighbours'**, because
   the same field population is spread over 2.3× the area. Raising it for `العمل` specifically
   would encode importance by density, which is exactly what T-10 forbids. Left alone.
5. **The MID hue offsets are literals at their call sites**, same as §15.9's note for NEAR.

---

## 18. The session-frame morphology correction (WS7R-M2)

Commissioned as a **tight, narrow** pass: change the morphology and edge language of the session
frames and nothing else. No composition change, no territory change, no colour system change, no
motion, no NEAR, no FAR, no new semantics.

### 18.1 The finding, and why the existing ring could not answer it

Product: the frames around `جلسة ١١ / ١٢ / ١٣` still read as smooth, rounded, soft-looped
outlines where the reference's inner fields have a broken, faceted, web-like edge.

The tempting reading is "it is not broken enough". Measured, that is wrong: `ringP2D`'s presence
field already deletes about a third of the perimeter. The problem is one level down — **the curve
being cut is a 240-point sampling of a near-circle**, so every surviving run is itself a smooth
arc and the eye reassembles the circle from them. Breaking it further produces a dashed circle,
not a faceted one. That is why no amount of tuning the existing ring could have answered this,
and it is the same shape of diagnosis as §17.1: the term was right, the thing underneath it was
not.

Two other terms were part of the smooth-loop read and had to be named before anything was built:

- `haloBand` on a session is a **perfect circle** — a soft even glow at exactly `s.r`. Faceting a
  rim underneath a bright circular band leaves the circle winning.
- At the MID rim budget the ring's bright weight came out at **α 1.44** for `جلسة ١٢` and was
  clamped to 1. Three weights and a presence field are all invisible behind a clamp, so the ring
  was drawing every surviving run at the same flat opacity — an even line, which WS5 §3 already
  names as the thing that reads as a diagram outline however much you wobble it.

### 18.2 What was built — §N1, a second skeleton

`ringFacet(x,y,r,seed,amp)`, beside `ringP2D` and cached the same way. Same presence field, same
harmonic wobble, same world-space caching; what differs is the skeleton:

- **Vertices at constant arc-length**, `M = TAU·r / 40` world units, clamped to [9, 26]. Across
  the twelve canonical sessions that is 12–20 vertices, **173 in total**. Constant arc-length
  means `M` encodes circumference — exactly what the canonical `s.r` already encodes — and
  nothing else. No activity, no importance, no recency, no confidence.
- **Two displacements per vertex**, radial (±8.2% of `r`) and **angular** (up to about a third of
  a step). The angular one matters more than it looks: equal facet *lengths* are most of what
  makes the eye call something a polygon. With both, no two facets are the same length or the
  same distance out, and there is no n-gon to read.
- **Dead straight chords** between vertices, each cut into three sub-segments so a gap can fall
  *inside* a facet and not only between two. Whole-facet gaps alone read as a dashed line.
- **Three weights, not the ring's two.** The thresholds are quantiles of the presence field
  measured over all twelve sessions. Shipped distribution: **16.2% bright · 22.5% mid · 25.8%
  faint · 35.5% absent.**
- **Struts.** Where a second band of the node field is low, a sparse `i → i+2` shortcut chord.
  Its sagitta is 5% of the radius, so it rides just inside the perimeter and articulates the edge
  rather than crossing the field. **42 of them.** This is the "triangulated" half of the brief.
- **Nodes.** The vertices the field likes most, returned so the painter can put a small star on
  each — **86 across the world**. A polygon whose corners are lit is a constellation; one whose
  corners are not is a shape. One field, two disjoint bands, so a vertex is never both a node and
  the root of a strut.

### 18.3 §N2 — the painter, and the clamp

The two skeletons **cross in alpha on `S.map`**, which is exactly 0 at both ends of the approach,
so FAR and the frozen NEAR stroke the same bytes: `x·(1−0)` is `x`. A crossfade is legitimate
here only because the two paths are nearly the same curve — the facet vertices sit *on* the
smooth ring and the chords depart from it by one sagitta, about 1% of the radius, under two
pixels at map scale. There is no frame on the ramp where the reader sees two outlines.

The bright facet is **narrower** than the ring it replaces (0.92 against 1.35 of the base width)
and is **not clipped**: `alf = min(al, 1.05)` takes the clip out of the frame instead of out of
the canvas. That also preserves the *rendered* focus-to-neighbour ratio the accepted MID had
(1.05/0.78 = 1.35, against the clamped 1.00/0.78 = 1.28) rather than the nominal 1.90.

Draw order is the read: struts faintest, facets carrying the perimeter, nodes the only bright
thing — so the envelope reads as lit points that a broken line happens to join.

### 18.4 §N3 — the frame pays for itself

The session's circular halo band is cut **28% at MID** and §N2 spends it on the facets and their
nodes. Light moved, not added — the same accounting §W4 used for the outer atmosphere. `S.map` is
exactly 0 at both ends, so the band NEAR and FAR see is untouched to the digit.

### 18.5 Measured, against the accepted first pass

| | WS7R-M (accepted) | WS7R-M2 |
|---|---|---|
| frame mean luminance | 43.69 | **42.66** (−2.4%) |
| p50 / p95 / p99 | 35 / 104 / 194 | 34 / 102 / 190 |
| dark share (< 18) | 14.65% | **15.35%** |
| pixels changed at all (Δ ≥ 6) | — | 22.32% → **16.76% darker, 0.74% brighter** |
| pixels changed materially (Δ ≥ 30) | — | **1.58%** |
| of every changed pixel, share inside a session's own edge band (0.72–1.42 r) | — | **99.7%** |
| stratum counter `drawn` at MID | 11,494 | 11,506 |
| actual canvas ops at MID | — | −24 smooth strokes, +48 facet strokes, +86 node sprites = **+110** |

The last two rows are the honest pair: the `drawn` counter moves by twelve because the facet
block increments once per session, while the real cost is +110 operations. It is stated both ways
rather than quoting the flattering one.

**99.7% inside the session edge band** is the whole claim of a narrow correction, in one number.

### 18.6 Preservation and motion

Proved on the **shipped bytes**, on fresh loads, per the standing technique:

- **FAR (A = 0): the rendered PNG is byte-identical to `ws7rc-far-hero.png`** — same SHA-256, not
  merely 0 differing pixels.
- **NEAR (A = 1): the rendered PNG is byte-identical to `ws7rv2-near-hero.png`**, the approved
  frozen hero. Same SHA-256.
- Both were additionally checked against the **frozen build itself**, extracted from
  `I-08B1-NEAR-BASELINE-APPROVED.zip` and verified at SHA-256 `7D7D5B55…`: **0 of 2,480,100
  differing pixels** at A = 0 and at A = 1.
- **MID is bit-reproducible** from the shipped file.
- **Reduced motion, settled, at MID: 0 of 620,550 differing pixels** from settled full motion.
- **The approach ramp got gentler, not steeper.** Camera pinned, A swept 0.50 → 1.00 in steps of
  0.01, the steepest relative step per step goes **2.433% → 2.304%** of frame luminance, and its
  location moves from A = 0.85 to A = 0.81. The five steepest steps are spread over
  A = 0.81–0.85 and 0.91 with neighbours at 1.5–2.2%: a slope, not a pop. §17.8.1 is unchanged by
  this pass and still stands.
- `__audit()`: **all 16 assertions true.** 233 objects · 123 relations · 34,847 field vertices ·
  8,180 filaments · 96 currents · 19 background worlds · 28 clusters · 27 knots · 72 aerosol ·
  9,501 mesh edges · 54,998 filament links · 9 voids — every count unchanged.
- `__typeAudit()`: letter-spacing 0px, direction rtl, weight in the Arabic range, IBM Plex Sans
  Arabic loaded, `#evlog` at 1.7 leading.
- **The diff is provably exactly three edits.** A byte copy of the shipped file with those three
  edits reversed reproduces the WS7R-M build at its recorded SHA-256
  `BE8E495FB922CAC714F520AD4ADF8C4E397324385B425F9A0CDCC00EE2843FD6` and its recorded 317,925
  bytes. Nothing else in the file moved. That reconstructed build is also what the ramp figures
  above were measured against.

### 18.7 What was deliberately not done

1. **Territory rims were not faceted.** They are a different tier, and the brief's limits rule out
   composition changes. It also turns out to be a gain: the parent now reads as a region with a
   soft circular edge and the child as a faceted constellation envelope, so nesting is carried by
   a difference in *kind* of line and not only by value. Left as it is.
2. **The session's inner fill and envelope were not re-cut to the facet.** The `mfill` gradient
   reaches α 0 at its own edge, so it contributes no circular boundary; clipping it to the polygon
   would change material for no visible gain.
3. **No new semantics.** Vertex count follows circumference, node brightness and strut placement
   come from a static noise field. Nothing in this pass varies with activity, importance,
   recency, confidence or causality, and none of those exists in canonical state.
4. **`review-animations` still not invoked** — §17.8.1's request stands and this pass did not
   change it either way.

### 18.8 Known remaining weaknesses

1. **The frames are quieter than they were**, by design: a perimeter that is 35.5% absent and no
   longer clamped is less continuous than a saturated closed ring. The reference's own envelopes
   are faint dotted chains rather than bright rings, so this is the target class — but it is a
   real change in prominence and Product should judge it as one.
2. **Frame mean −2.4%.** Light was moved out of the circular halo and back into the facets and
   nodes, and the return is not exact. It moves the dark share toward the reference (14.65% →
   15.35% against the reference's 47.9%), which is the right direction, but it is a lighting
   change inside a morphology pass and is stated rather than buried.
3. **The smallest sessions have the fewest facets.** `كتاب` at r = 76 gets 12 vertices, against 20
   for `جلسة ١٢`. The constant-arc-length rule is what keeps `M` free of semantics, and the cost
   is that a small session's envelope is closer to a plain polygon. Judged acceptable; the
   alternative is a vertex count that varies with something, and nothing it could vary with is
   canonical.
4. **§17.8 items 1–5 are all unchanged** and still stand.

---

## 19. Motion review of the MID schedule (`review-animations`, WS7R-M2)

Review only. Nothing was modified: the prototype is the same 327,433 bytes and the same SHA-256
`657275CD…` before and after. Measurements are camera-pinned schedule sweeps at 1050×591
(620,550 px) unless stated, on fresh loads.

**The rate that all per-frame figures are expressed in.** `togglePlay` builds
`PLAY={from,to,dur:|to−from|×9800}` — a constant-rate traverse, 9.8 s for the full 0→1. At 60 fps
that is **dA = 0.0017 per frame**, and every "per frame" number below is a schedule slope
multiplied by it.

### 19.1 The schedule is C0-continuous; `S.map` is mid-pack

45 numeric schedule terms sampled every 0.0005 of A. No term has a discontinuity. Steepest
terms, as a share of their own value per frame:

| term | max slope /A | at A | per frame |
|---|---|---|---|
| `lodB` | 75.0 | 0.690 | **12.75%** |
| `aero` | 8.57 | 0.560 | 1.46% |
| `web.band` | 7.77 | 0.785 | 1.32% |
| `curW` | 7.04 | 0.776 | 1.20% |
| `web.fineV` | 6.48 | 0.843 | 1.10% |
| **`S.map`** | **3.95** | **0.310** | **0.67%** |

`S.map` is the sixth-steepest term in its own schedule and one nineteenth of `lodB`, which is the
pre-existing NEAR substrate ramp (`ss(0.68,0.70,A)`, narrow by design, reviewed and passed in the
WS7R motion review). **The new MID schedule is not the steepest thing on the path.**

`S.map` is exactly 0 at A = 0 and A = 1, and exactly **1 across A ∈ [0.50, 0.56]** — a genuine
plateau, 588 ms of fully-resolved MID at the traverse rate, and indefinite if the reader stops.
MID is a stable state, not a cusp.

### 19.2 The two transits, in pixels

MID camera pinned, A stepped 0.01, frame mean luminance L and a local-change count (pixels
moving ≥ 24 levels between steps, which catches a small bright pop the frame mean would hide):

| | FAR → MID | MID → NEAR |
|---|---|---|
| L at the ends | 22.05 → 54.39 | 56.42 → 35.47 |
| steepest step per 0.01 A | **3.47%** at A = 0.35 | **3.87%** at A = 0.83 |
| the same, per frame | 0.59% | 0.66% |
| shape of the top steps | 0.27–0.38, eight consecutive at 3.1–3.5% | 0.81–0.85 consecutive at 3.3–3.9%, then 0.87/0.88/0.91 at 2.8–3.1% |
| worst local change | 2,818 px ≥ 24 (0.45% of frame) at A = 0.47 | 6,427 px ≥ 24 (1.04%) at A = 0.79 |

Both are **slopes, not pops**: in each case the steepest steps are a consecutive run, and no
isolated step stands above its neighbours. The `lodB` window (A 0.68–0.72) produces frame-mean
steps of only **0.19–0.34%** and a local-change footprint (3,754–6,117 px) no larger than its
neighbours at 0.66 and 0.79 — the steepest schedule term is still invisible in pixels, which is
the F1 result holding.

### 19.3 The hard thresholds — measured, and they are the one real finding

`S.map` gates four call sites with `if(S.map>0.02)` (§M1b line 3797, §M2 3553, §M3 4021, §N2
4230) and one with `sw>0.004` (§N2 4210). Those are genuine C0 discontinuities. Method: straddle
each crossing with an interval of ΔA = 2×10⁻⁵ and compare against a control interval of the same
width, 0.002 away, where no gate lives.

| crossing | ΔmeanL across gate | ΔmeanL, control | verdict |
|---|---|---|---|
| `S.map > 0.02` rising, A = **0.15193** | **+0.0315** | +0.00014 | real step, 225× control |
| `sw > 0.004` rising, A = 0.48595 | +0.00077 | +0.00479 | smaller than control — not a step |
| `sw > 0.004` falling, A = 0.57553 | −0.00657 | +0.00011 | 13% of one frame |
| `S.map < 0.02` falling, A = **0.9447** | **−0.0559** | +0.00055 | real step, 102× control |

The two `S.map` crossings are real. What decides whether they matter is their size against the
motion already on screen at that instant:

| at A = 0.152 | gate (ΔA = 2e-5) | one real frame (ΔA = 0.0017) |
|---|---|---|
| px ≥ 2 | 4,067 | 3,046 |
| px ≥ 8 | 41 | 113 |
| px ≥ 16 | **2** | 67 |
| px ≥ 32 | 0 | 46 |
| worst pixel | **21** | **197** |

| at A = 0.9447 | gate | one real frame |
|---|---|---|
| px ≥ 2 | 5,841 | 23,579 |
| px ≥ 8 | 1 | 616 |
| px ≥ 16 | **0** | 231 |
| worst pixel | **8** | **108** |

Both gates are a one- to two-level dither over about 1% of the frame, scattered (358 of 627
32-px blocks at the falling gate), with a peak of 21 and 8 levels against the 197 and 108 that the
normal frame-to-frame motion is already producing in the same place. **99.8% of the rising gate's
pixels and 99.97% of the falling gate's are inside a territory hull** — the gate governs the map
material and nothing leaks outside it. Sub-perceptual, and recorded as a Minor finding because a
hard threshold is a hard threshold: raise the 0.02 constant, or strengthen the material behind
it, and this becomes visible.

### 19.4 Reversibility and hysteresis — zero

Four byte-level results, on a **fresh load**:

- MID rendered as the very first frame the build ever draws, and MID rendered again after a
  103-frame round trip 0.5 → 1 → 0 → 0.5 that exercises every lazy cache
  (`p.inT`, `ringFacet`, `WOB`, `cachedRadial` `mbed`/`mfill`): **identical SHA-256**, and both
  identical to the shipped `ws7rm2-mid-hero.png`.
- NEAR after the round trip: **byte-identical to `ws7rv2-near-hero.png`**, the approved frozen
  hero.
- FAR after the round trip: **byte-identical to `ws7rc-far-hero.png`**.

The lazily-built state is a pure function of fixed geometry, so nothing is path-dependent. No
hysteresis in either direction, at either end, or at MID.

### 19.5 Reduced motion — 0 differing pixels at six points on the path

`togglePlay` under `reduced()` runs `seq=[0,0.5,1]` at 1500 ms per stop instead of a 9800 ms
traverse: the path changes, the destinations do not. Settled parity, full motion vs reduced:

| A | 0 | 0.30 | 0.50 | 0.53 | 0.85 | 1 |
|---|---|---|---|---|---|---|
| differing px of 620,550 | **0** | **0** | **0** | **0** | **0** | **0** |

Parity holds not only at the three stops but at both transit points and across the MID plateau,
so reduced motion never ships a different composition at any A.

### 19.6 Interruptibility, and load

- **Retarget, not restart.** `PLAY={from:PATH.t,…}` is built from the *current* value, and
  `dur=|to−from|×9800` keeps the rate constant, so an interrupted-and-resumed travel covers its
  remaining distance at the same speed rather than lunging. Stopping mid-flight sets `PLAY=null`
  and holds position; scrubbing the track and the milestone labels both null `PLAY` before
  seeking, so input never fights the tween.
- **Nothing this pass added carries transition state.** Every new term reads `S.map` fresh each
  frame, so interrupting anywhere on the ramp is safe by construction.
- **Keyboard navigation does not animate.** `f` / `m` / `n` and the arrow keys set `PATH.t`
  directly.
- **Load.** Stratum counter at FAR 11,369 · **MID 11,506** · NEAR 6,917 · A = 0.30 11,149 ·
  A = 0.85 11,155. MID is the peak at 1.2% above FAR, and there is no transient spike mid-transit.

### 19.7 Semantic leakage — none

`S.map` appears at 32 sites. **None of them is in the relations stratum (§13) or the objects
stratum (§14).** The only object-adjacent site is line 5059, the focus's subtractive dark seat,
which is a ground and not a mark. Relation disclosure, relation count, object disclosure and the
working-set retargeting fixed in the earlier review are all untouched by the map ramp. Every term
this pass added is a product of canonical geometry and `S.map`; nothing branches on a new data
source, and nothing appears during transit that is not MID material resolving.

### 19.8 Findings

1. **Minor — the `S.map > 0.02` hard gate.** §19.3. Sub-perceptual today; it is a threshold, and
   thresholds are worth naming. Remedy if it ever matters: ramp the four sites off a
   `ss(0.00,0.04,S.map)` factor instead of a boolean, keeping the boolean only as a work-skip at
   a value low enough that the ramp has already reached zero.
2. **Minor / portability — the `p.inT` burst.** The first frame that crosses the gate computes
   `p.inT` for **34,825 of 34,847 vertices**, each against 6 territories: ~209,000
   `hypot` + `smoothstep` operations on one frame, and that frame is the *first* frame of the
   FAR → MID travel. Once per page load, not per traverse. It does not show on this host, and per
   the standing rule no wall-clock number from the preview pane is quoted. It is a real risk on
   the Skia/Reanimated port's 8 ms budget. Remedy: compute `p.inT` in the world build **after**
   the random stream is consumed — it is derived, not random, so it cannot move any geometry.
3. **Pre-existing, unchanged — the approach curve is `easeInOutQuad`.** `PATH.t` is driven by
   `p<0.5 ? 2p² : 1−(−2p+2)²/2`. Ease-in-out is the correct *family* for on-screen movement, but
   this is a built-in-strength curve where the house value for movement is
   `cubic-bezier(0.77, 0, 0.175, 1)`. Not introduced by this pass and inside the CLOSED/PASS
   motion review; recorded so it is not mistaken for new.
4. **Pre-existing, unchanged — `lodB` is the steepest term on the path** at 12.75% of its range
   per frame, nineteen times `S.map`. Measured in pixels it is still invisible (§19.2).
5. **Pre-existing, unchanged — sprite resampling.** At ΔA = 1e-5, about one 170th of a frame,
   ~21,000 px move by ≥ 2 near A ≈ 0.576 — in the control interval as much as at the gate, so it
   is `drawImage` resampling of the glow atlas and not a schedule effect. Already recorded as not
   perceptually relevant.

**Nothing found blocks MID freeze.** Findings 1 and 2 are follow-ups, not gates; 3–5 are
pre-existing and already inside a passed review. **Both were subsequently closed — see §20.**

### 19.9 What §17.8.1 said, and what it says now

§17.8.1 recorded that the approach's steepest relative step rose from 4.41% to 6.95% per 0.01 of
A when the MID map arrived, and asked for `/review-animations` by hand before freezing. That
review is this section. Re-measured against the WS7R-M build reconstructed byte-exactly (§18.6),
the steepest step **fell** from 2.433% to 2.304% per 0.01 with WS7R-M2's morphology pass, and the
absolute figures here (3.47% and 3.87% per 0.01, i.e. 0.59% and 0.66% per frame, in consecutive
runs) are a slope with no pop anywhere on either transit. **§17.8.1 is answered and closed.**

---

## 20. Closure hygiene — the two MID follow-ups, closed (WS7R-M2b)

Not a visual pass. Two corrections only, both from §19.8, both required to leave every stable
frame byte-identical. Artefact: **330,640 bytes · SHA-256 `5225B460…`**.

### 20.1 §N5 — `S.mapA`, the map material's amplitude

`S.map` is the schedule; **`S.mapA = S.map · ss(0, 0.04, S.map)`** is what the map material is
drawn at. Four sites were gated `if(S.map>0.02)`; they now ride `S.mapA` and skip only on
`if(S.mapA>0)`.

Three properties make it a shape rather than a smaller step:

- **exact at the ends** — `mapA` is exactly 0 when `map` is 0 and exactly 1 when `map` is 1, so
  FAR, the frozen NEAR and the whole MID plateau are bit-identical: `x·1` is `x`;
- **C1 at the join** — the ramp meets the identity line at `map = 0.04` with slope 1 on both
  sides, so there is no corner where the gate used to be;
- **it leaves zero with zero slope** — the material does not merely arrive smoothly, it arrives
  from nothing.

The boolean that remains is a **boundary, not a threshold**: `mapA > 0` is false exactly when the
amplitude is exactly 0.0. It is also strictly safer than `map > 0` — if `map` is small enough
that the ramp underflows, the skip follows the amplitude rather than the schedule.

Two thresholds inside the same blocks were taken down to zero-boundaries with it, because the
acceptance is *no mathematical switch in map material*: §M3's `if(mf>0.004)` → `if(mf>0)`, and
§N2's `if(sw>0.004)` → `if(sw>0)`. §N2's crossfade now runs on exact complements, `mapA` and
`1 − mapA`, so the pair sums to one everywhere and neither end of it has a gate.

**Every already-continuous use of `S.map` was left alone** — the territory halo and rim, the
aerosol, the currents, the census, the cosmos, the focus seat, `al`. This is a threshold fix, not
a retune.

### 20.2 §N4 — `p.inT` baked in the build

Territory membership for the MID local-particle disclosure moved out of the painter into the
`mp.forEach` pass that already bakes `p.css` — same loop, same phase, one line of arithmetic.

The original comment gave the reason it was lazy: *"touching the build would move the random
stream and rebuild the approved world."* That reason was wrong. `Math.hypot` and `ss` are pure,
`TER`'s `x/y/r` are literals that no part of the build ever assigns to, and `p.x, p.y` are final
by that line — so the generator's stream is untouched **by construction**, which the byte-identical
FAR/MID/NEAR renders then confirm.

It is exactly equivalent, not merely equivalent in practice: the painter's assign pass and draw
pass walked the *identical* `cellItems(W.mpCells,V)` set with the assign pass first, so every
vertex that could ever be drawn was already assigned before it was read.

**Evidence it is no longer lazy:** on a fresh load, before any frame is rendered,
`W.mp.filter(p => p.inT !== undefined).length` is **34,847 of 34,847**. The old lazy path could
only ever reach **34,825** from a MID frame — the 22-vertex difference is itself the proof of
where the work now happens. The ~209,000-operation burst on the first frame of the approach is
gone.

### 20.3 Exact sites

| file:line | change |
|---|---|
| `wf-living-constellation.html:1204–1214` | §N4 — `p.inT` computed in the build's `mp.forEach` bake pass |
| `:1866–1896` | §N5 — `S.mapA = S.map*ss(0,0.04,S.map)` added to `schedule()` |
| `:3598` · `:3613` | §M2 territory bed — `if(S.mapA>0)`, alpha on `S.mapA` |
| `:3823–3832` (was `:3797–3802`) | §M1b — the lazy assign loop **deleted** |
| `:3850` | §M1b — `const loc = S.mapA * p.inT` |
| `:4063–4065` | §M3 session fill — `if(S.mapA>0)`, `mf` on `S.mapA`, `if(mf>0)` |
| `:4253–4259` | §N2 smooth ring — `sw = 1 − S.mapA`, `if(sw>0)`, lerps and hue on `S.mapA` |
| `:4274–4275` | §N2 facet — `if(S.mapA>0)`, `fm = S.mapA` |

### 20.4 The thresholds, before and after

Same method as §19.3: straddle the old crossing with ΔA = 2×10⁻⁵, camera pinned, 1050×591.

| at the old rising gate, A = 0.15193 | before | after |
|---|---|---|
| Δ mean L | 0.03151 | **0.00824** (−74%) |
| px ≥ 2 | 4,067 | **282** (−93%) |
| px ≥ 16 | 2 | **0** |
| worst pixel | 21 | **8** |

| at the old falling gate, A = 0.9447 | before | after |
|---|---|---|
| Δ mean L | −0.05594 | **+0.00016** (−99.7%) |
| px ≥ 2 | 5,841 | **803** |
| worst pixel | 8 | 8 |

**What the residual is, and why it is not a switch.** Two controls settle it. Where `S.map` is
exactly 0 and no map material exists at all (A 0.050–0.058), the same straddle gives a median
step of **0** and a maximum of **0.00035**, worst pixel 2 — the measurement floor is clean. Where
the map ramp is fully engaged and nobody claims a gate (A 0.300–0.308), the same straddle gives a
median of **0.00235**, a maximum of **0.02148**, up to **8,163** changing pixels and a worst pixel
of **127**. The 0.00824 / 282 px / 8 levels left at the old gate is therefore *smaller than what
the same ramp routinely does where there is no gate* — ordinary per-element rasterization and
early-out quantization, spread across scattered A rather than landing coherently at one value.
The coherent frame-wide switch is gone.

The remaining per-element early-outs (`glow`'s `alpha<=0.004`, the vertex `a<0.012` cutoff) are
global helpers that fire for every stratum at every A, including FAR and the frozen NEAR. They
are out of this pass's scope by instruction and by risk, and §20.5 shows they change nothing at
the frame level.

### 20.5 Verification

| check | result |
|---|---|
| stable MID, A = 0.5 | rendered PNG **byte-identical** to `ws7rm2-mid-hero.png` |
| frozen NEAR, A = 1 | rendered PNG **byte-identical** to `ws7rv2-near-hero.png` |
| FAR, A = 0 | rendered PNG **byte-identical** to `ws7rc-far-hero.png` |
| MID plateau | `S.mapA` exactly 1 across A ∈ [0.50, 0.56], unchanged |
| FAR → MID slope | steepest step **3.473% at A = 0.35**; top six A-values and values identical to §19.2 |
| MID → NEAR slope | steepest step **3.874% at A = 0.83**, run 0.81–0.85 consecutive; identical to §19.2 |
| across the old falling gate | 0.93 → 0.97 decays 1.94 → 0.33% with no spike |
| reversibility | MID as the **first frame of a fresh load** == MID after a 103-frame round trip 0.5→1→0→0.5 == the approved hero, all three **the same SHA-256**; NEAR and FAR after the round trip byte-identical to their approved boards |
| reduced motion, settled | **0 of 620,550** differing pixels at A = 0, 0.15, 0.30, 0.50, 0.53, 0.85, 0.945, 1 |
| `p.inT` at load, before any frame | **34,847 of 34,847** defined, all in [0,1], 33,315 non-zero |
| `__audit()` | all 16 assertions true |
| canonical counts | 233 objects · 123 relations · 34,847 vertices · 8,180 filaments · 96 currents · 19 worlds · 28 clusters · 27 knots · 72 aerosol · 9,501 mesh edges · 54,998 filament links · 9 voids — **every one unchanged** |
| load | `drawn` FAR 11,369 · MID 11,506 · NEAR 6,917 — unchanged |

§19.8 findings 1 and 2 are **closed**. Findings 3–5 were left alone by instruction.

---

## 21. The MID freeze

**`I-08B1 / MID VISUAL + MOTION BASELINE — APPROVED / FROZEN`**, Product decision, 2026-09-20, at
prototype SHA-256 `5225B4607CB5339E8E3BEFC33A0DC3B8AAC97F525FCDEFC10F50AA8F21C2CDD0`
(330,640 bytes).

### 21.1 What the freeze binds

Fourteen things, and all of them are measured somewhere in §17–§20 rather than asserted:

1. the world-territory-map composition (§17.1–17.4)
2. territory placement and visual hierarchy — edge ÷ interior 1.53 / 1.93 / 1.76 (§17.3)
3. the multi-colour material language — six territory hues as identities, not ranks (§17.4)
4. the local constellation texture — `p.inT`-bounded, never a global mesh (§17.2, §20.2)
5. nested-session presentation (§18.3, §M3)
6. the faceted / broken session-frame morphology — 173 vertices, 86 nodes, 42 struts,
   16.2/22.5/25.8/35.5 bright/mid/faint/absent (§18.2)
7. Arabic typography — `__typeAudit()` clean on the frozen file
8. density and disclosure — `drawn` MID 11,506; census and label tiers unchanged
9. FAR → MID transition behaviour — steepest step 3.473% at A = 0.35, consecutive run (§19.2)
10. the MID stable state — `S.mapA` exactly 1 across A ∈ [0.50, 0.56] (§19.1)
11. MID → NEAR transition behaviour — steepest step 3.874% at A = 0.83, consecutive run (§19.2)
12. reduced-motion parity — 0 of 620,550 at eight points on the path (§20.5)
13. reversibility / zero hysteresis — first-frame MID == post-round-trip MID == the hero, one
    SHA-256 (§20.5)
14. continuous `S.map` material resolution (§20.1) and `p.inT` build-time precomputation (§20.2)

### 21.2 The archive

`design-workshops/I-08B1-MID-BASELINE-APPROVED.zip`. Its size and SHA-256, and the SHA-256 of
every entry, are in `I-08B1-MID-BASELINE-APPROVED.manifest.txt` beside it — outside the archive,
because this file is inside it and cannot state the hash of something that contains it.

Twelve entries, **every one verified byte-for-byte against disk — 0 mismatches, 0 extras, 0
missing**: the prototype, the four MID proof boards, the notes, the skill-use record,
`board-server.mjs` (the capture pipeline, so the boards are reproducible from the archive alone),
the Product reference image in both formats, and the frozen NEAR and FAR heroes so preservation
can be re-proved without any other file. The prototype extracted from the archive hashes to the
accepted SHA.

**The structure board was re-rendered for this freeze** and the previous one
(`ws7rm-mid-structure.png`) is superseded: it annotated the WS7R-M map, whose session frames the
morphology correction replaced, and an archive whose structure board contradicts its own hero is
a defect in the record. The new board is annotation only, and that is checked rather than
claimed — its map band differs from `ws7rm2-mid-hero.png` in 35,453 pixels and **every one of
them is inside the annotation mask; 0 pixels outside it differ.** The accepted prototype was not
touched while archiving: its SHA is the same before and after.

### 21.3 The reopen rule

MID is closed to aesthetic and motion iteration. It reopens **only on an actual contradiction**:

- a preservation diff against this SHA that stops being zero;
- an unsupported semantic claim in the render;
- an accessibility failure;
- an Arabic-readability failure at a real target viewport;
- a portability finding from the Skia/Reanimated port that requires a visual correction;
- a motion regression.

**Preference, fresh-eye critique, or a new visual reference alone does not reopen it.** Any
correction must be recorded against
`5225B4607CB5339E8E3BEFC33A0DC3B8AAC97F525FCDEFC10F50AA8F21C2CDD0`.

### 21.4 What is still open

The frozen NEAR baseline (§16) is unchanged and was re-proved at this SHA: A = 1 renders a PNG
byte-identical to `ws7rv2-near-hero.png`. **FAR is unfinished and not approved** — it has never
had a visual pass, it is bit-identical to WS7, and A = 0 renders byte-identical to
`ws7rc-far-hero.png`. The `J` FAR proposal and the `K` MID density proposal both remain off.
**I-08B1 itself is not closed.**

---

## 22. The calm map (WS7R-Q) — MID reopened against the reference

**`I-08B1 / MID VISUAL + MOTION BASELINE` is REOPENED**, Product decision, 2026-09-20, later the same
day as the §21 freeze. §21.3 says a new visual reference alone does not reopen the freeze; Product
overrode that rule in as many words — the frozen MID was judged not to be the reference class it was
commissioned against — so this is recorded as a Product reopening, not as a contradiction found.
The §21 freeze at `5225B460…` stands as the **last approved MID**. What follows is a **candidate**,
not an approval:

| | |
|---|---|
| candidate prototype | `wf-living-constellation.html` · 347,665 bytes |
| SHA-256 | `05AC429A0A27A0DF5A094FDDBB1FD59139EEABC5246644BDF8081856B2D0B707` |
| diff against the frozen MID | 315 insertions, 48 deletions, one file |
| proof — hero | `ws7rq-mid-hero.png` (A = 0.5, 2100×1181, `now` 0) |
| proof — reference comparison | `ws7rq-reference-vs-mid.png` |
| proof — session-frame detail | `ws7rq-work-crop.png` (field 1000 about `العمل`, census NOT forced) |
| measurement harness | `ws7rq-measure.js`, loaded into the page from the board server; every number below is one of its functions |

Product's finding, in its own words: the glow is higher than the reference and not comfortable; the
frames around the territories are not like the reference's; the stars are not good; the scene is
not alive; the background is a black screen with white dots where the reference's is a coloured
nebula. Every one of those was measured before anything was changed.

### 22.1 What the reference actually is — measured, and two earlier readings corrected

The reference (`ws7rm-reference-target.png`, 726×419) against the frozen MID hero, same statistics:

| | reference | frozen MID (§21) | |
|---|---|---|---|
| frame mean luminance | 27.5 | 41.0 | |
| p50 / p90 / p95 / p99 | 18.7 / 54.5 / 78.7 / 181 | 32.5 / 77 / 99 / 187 | the PEAKS already matched |
| share below level 18 | 47.9% | 18.8% | |
| mean chroma | 15.2 | 27.9 | nearly twice the colour |
| **saturation of the bright pixels** (L > 120) | **10.4%** | **36.7%** | the reference's bright things are white; ours were coloured |
| ground — mean of the darkest 40% | (4, 10, 13) | (16, 18, 22) | darker AND tinted, against lighter and neutral |

The radial profile of the reference's largest circle, angle-averaged, is the whole rim story in one
row. Interior (0.3–0.85 r): luminance 25–31, **saturation 74–85%** — a dark, strongly tinted field.
Rim (peak at 1.03 r): luminance 56, **saturation 31%** — the rim is the *least* saturated place on
the circle, a pale line about a fifth of a radius wide. Outside (1.2–1.6 r): 19–32, saturation
50–64%. The frozen MID's `العمل`: interior 36–63 at 50%, rim peak **95.6 at 60%** and 0.3 r wide,
outside 34–45. Twice as bright at the rim, twice as wide, and saturated where the reference is pale.

**Which stratum.** Each schedule term switched off alone in a 1050×591 frozen-MID frame:

| switched off | frame mean | share < 18 | `العمل` interior floor (< 22) | bright-pixel sat |
|---|---|---|---|---|
| nothing | 54.4 | 10.8% | 2.8% | 32.8% |
| **territory halo band** | **33.3** | **41.8%** | 12.5% | **22.4%** |
| the field (filaments + vertices) | 43.1 | 15.8% | 6.8% | 37.5% |
| territory atmospheres (in / out / bed) | 48.3 | 17.0% | 14.7% | 28.3% |
| sessions | 50.1 | 13.4% | 7.7% | 32.1% |
| currents | 50.9 | 13.9% | 8.0% | 32.0% |
| aerosol | 51.0 | 14.1% | 4.8% | 32.1% |
| cosmos | 51.3 | 13.6% | 4.5% | 32.3% |
| stars · clusters · knots · veil · membrane · relations · rim | each within 1.6 of nothing | | | |

**The band was the glow.** One term — a saturated gradient 1.2 radii wide around each territory,
six of them overlapping — was two fifths of the light in the frame and most of its floor.
**§17.5 was wrong** when it attributed the 15.6%-against-47.9% dark share to canonical geometry
("six large hulls that nearly tile the frame"): with the band alone off, the frozen composition
sits at 41.8% below level 18 with no geometry touched.

**§M1b was wrong too.** It read the reference as "dense inside its territories and genuinely empty
between them", and built `p.inT` to make the map so. Measured with the same detector (a local
maximum at least 22 levels above its 7×7 surround), the reference carries **167** lit points per
10k px in a patch *between* its circles against **155** inside its largest one. The reference is a
uniform particulate field over a dark floor; what changes across a rim is the tint and the rim,
never the dust. The frozen MID had **7** per 10k px between territories — stars — which is the
"black screen with circles" reading exactly. Inside `العمل`, the frozen MID already had the
reference's particle count (146 against 155): its particles were not missing, they were sitting on
a mid-tone wash (52% of the interior between levels 36 and 100, against the reference's 12%) and
could not read as life.

### 22.2 What changed — every term rides the existing bump

Nothing new is scheduled. Every change is a factor of `S.map` or `S.mapA` (§17.1, §20.1), which
are exactly 0 at A = 0 and A = 1, so FAR and the frozen NEAR are bit-identical by construction
(proved in §22.4). Sites, in draw order:

- **§Q2 the floor.** The map's ground takes a tint before any light is laid on it —
  `rgba(5,18,24)` at 0.42 · `mapA`, source-over, over `P.ground` — because darker-and-tinted is not
  reachable additively over a neutral black. The grey deep clouds come down 55%; the nebulae get a
  second dark saturated pass (`gm`, lightness 30%, saturation +34) at 2.8× on `mapA`; the lit
  outward skirt goes to a tenth and a dark saturated one (`outM`, lightness 25%) takes its place.
  The vignette halves at map scale.
- **§Q1 the band and the interior.** Territory halo band: spread ×0.28, weight ×0.36 of M2's
  (`(1+map·1.45)(1−map·0.64)`), saturation 64 → 18, lightness 58 → 82. The inner atmosphere (peaks at
  0.90 r, 40% lightness) −78% instead of −26%; the bed `mbed` re-cut dark and saturated (lightness
  24 → 18 across its stops, saturation +26, weight 0.26); the aerosol 2.35× → 0.80×; currents −75%
  instead of −58%.
- **§Q3 the rim.** A pale line that does not vanish: `al` 3.15× → 1.75×, the bright pass to
  saturation 12 / lightness 91 at ×1.05, the wide pass to 16 / 84 at ×0.42, and a third **ghost**
  pass over the third of the perimeter `ringP2D` had left absent — the same noise field, a fourth
  weight at 0.18, `gh` built for every ring and stroked only here, only while `mapA > 0`. Still an
  uneven line whose presence varies; never the even closed curve QAN-GOV-02 §8 forbids.
- **§Q3b the session frames.** Same correction one tier down: halo band ×0.38 and narrowed 70%,
  paler; `mfill` dark and saturated; the M2 facets keep their skeleton, presence field, struts and
  nodes but go paler (saturation −20 pts, lightness up) and quieter (every weight −⅓, nodes to
  0.55). The "web-like edge" is now carried by actual web (§Q4b), which the boundary population
  traces.
- **§Q4 dust between, constellation inside.** `dust = mapA·(1−inT)` beside `loc = mapA·inT`: the
  population outside the hulls gets a lift of its own (×2.2 light, ×1.55 size, at about half the
  interior's), particles never links. The fine census **opens** — `fineCut ×(1+1.30·loc+0.40·dust)`,
  2.3× inside a hull — and what it admits resolves in from exactly zero on its own distance from
  the cut MID had (`a ×= 1−ss(fineC2, fc, q)`), so nothing pops. Interior lift 2.30 → 1.80.
- **§Q4b the local web, eighteen strokes.** `me`, the WS4 k-NN mesh over the coarse cloud, kept
  since WS5 "only so the two field languages can be compared", is at map scale the reference's own
  texture: **8,794** of its 9,501 edges have both ends inside a hull (`inE = 1−ss(0.96,1.16,mT)`, a
  membership slightly wider than `inT` so the rim population is included). They are batched at
  build into **18 `Path2D`** — six territory hues × three weight terciles (2,932 / 2,931 / 2,931
  edges) — and stroked as hairlines (0.9 px, saturation 24, lightness 76, alpha 0.12 / 0.20 / 0.31
  × `mapA` × `wa`) under the particles. Derived data: `p.mT` is baked beside `p.inT` and the build
  consumes no randomness. The brief's rule against a global mesh is a rule about the space between
  territories; that space gets dust and no links.
- **§Q5 dust, and the stars.** The gaps needed an order of magnitude more points than the star
  field has in view (~4,500 at MID), so the dust is a **texture**: one seamless 768-unit tile,
  12,000 specks in two colours (amber 42%, teal 58%) and two sizes, built once from its own
  generator (`dustTile`, seed 6120233) and blitted in world space under the map's transform at
  0.80 · `mapA` — six blits a frame, pans and scales with the world, encodes nothing. Stars: alpha
  −25% and their point halos −75% at map scale; the census opens 30% with the same resolve-from-zero
  band. Clusters −45%.
- **Type and marks.** Name plates to 15% at map scale (they had become dark ovals over a textured
  floor); object marks two fifths less saturated and five points lighter (`Sc`, `L`), same
  silhouette, radius and alpha.

Everything in the list is written as *the predecessor's expression × a factor that is exactly 1
at map = 0*, or inside `if(S.mapA>0)`. The one change outside the painter is `ringP2D` building
its ghost path for every ring; it is read by exactly one site.

### 22.3 Measured, against the reference and against the frozen MID

Hero frame (2100×1181, A = 0.5, every second pixel), reference at its own size:

| | reference | frozen MID | **WS7R-Q** |
|---|---|---|---|
| frame mean | 27.5 | 41.0 | **29.5** |
| p50 / p90 / p95 / p99 | 18.7 / 54.5 / 78.7 / 181 | 32.5 / 77 / 99 / 187 | **22 / 51 / 72 / 182** |
| share below level 18 | 47.9% | 18.8% | **36.1%** |
| bright-pixel saturation | 10.4% | 36.7% | **22.7%** |
| mean chroma | 15.2 | 27.9 | **18.7** |
| ground (darkest 40%) | (4,10,13) | (16,18,22) | **(8,15,19)** |
| `العمل` rim peak: luminance / saturation | 55.6 / 31% | 95.6 / 60% | **55 / 38%** |
| `العمل` interior 0.6–0.9 r: luminance | 25–31 | 36–63 | **28–40** |
| `العمل` interior: floor (< 22) / mid-tone (36–100) | 60% / 12% | 8% / 52% | **18% / 36%** |
| `العمل` interior: lit points per 10k px | 155 | 146 | 218 |
| `الصحة` interior: points / floor / mid-tone | 194 / 54% / 16% | 108 / 26% / 37% | **199 / 27% / 28%** |
| `المال` interior: points / floor / mid-tone | — | — | 153 / 46% / 14% |
| between territories: points / floor | 167 / 65% | 7 / 94% | **57 / 92%** |

Four rounds, each measured before the next: the first (band off, beds dark, web on) overshot into
darkness — mean 20.3, 62.7% below 18, rims nearly gone; the second put the pale rim, the floor tint
and the opened star census in and overshot the floor (ground (9,18,24), interiors +10 levels); the
third took the tint to 0.42, added the dust tile and paled the marks; the fourth trimmed the
interior lift, the aerosol and the web, and gave the beds three more points of lightness so
`الصحة` and `المال` carry their hue. Every board in the table is the fourth.

**Draw calls at MID** (1500×860, warm, deterministic — §10): strokes 2,794 → **2,797**, fills
16,360 → **22,815** (+6,455: the opened fine census), blits 2,142 → **2,386**, gradients unchanged.
The web is +18 strokes for 8,794 edges; the dust is +6 blits for 12,000 specks. FAR and NEAR
counts are unchanged, because FAR and NEAR are unchanged.

### 22.4 Preservation, parity, and what a fresh page lies about

- **FAR (A = 0): 0 of 2,480,100 pixels differ** from `ws7rc-far-hero.png`, max channel difference 0.
- **Frozen NEAR (A = 1): 0 of 2,480,100 pixels differ** from `ws7rv2-near-hero.png`. The §16 freeze
  is intact and re-proved at this SHA.
- **MID is bit-reproducible**: two renders of the same spec, 0 differing pixels; the hero reproduces
  from the shipped file.
- **Reduced motion, settled, at MID: 0 of 620,550 pixels differ** from settled full motion. Every
  new term is a static function of the camera; none reads `reduced()`.
- `__audit()`: every assertion true. 233 objects · 123 relations · 34,847 field vertices · 8,180
  filaments · 54,998 filament links · 9,501 mesh edges · 96 currents · 19 background worlds · 28
  clusters · 27 knots · 72 aerosol · 9 voids — every count unchanged. `__typeAudit()`: letter-spacing
  0px, direction rtl, weight in the Arabic range, IBM Plex Sans Arabic loaded, `#evlog` at 1.7 leading.
- **A measurement trap, new to the record.** For about a second after a page loads, the FAR diff
  reports **15,654** differing pixels (max 219) and NEAR 8,557 — on the *frozen* file too. The
  initial focus assignment is a pending transfer (`WORK.from`) that a render at `now = 0` does not
  settle, so a fresh page renders the pre-transfer state. One throwaway render at the default `now`
  (`__qSettle`) clears it; every diff above was taken after it. A preservation check run in the
  first second after load is a false regression.

### 22.5 The transits

Camera on the path, A swept 0 → 1 in steps of 0.01, frame mean at 1050×591:

| | §19.2 (frozen) | WS7R-Q |
|---|---|---|
| FAR → MID, steepest step per 0.01 | 3.473% at A = 0.35 | **5.359% at A = 0.23** |
| the five steepest | consecutive run | A = 0.19 / 0.23 / 0.27 / 0.31 / 0.37 — a slope, not a pop |
| MID → NEAR, steepest step | 3.874% at A = 0.83 | **2.052% at A = 0.82** — gentler |
| stable MID, A ∈ [0.51, 0.56] | — | 0.4–1.1% per step, the camera's own travel |

The approach into MID is **steeper** than the frozen build's, by about half again: more material
now arrives on the same `mapA` ramp (the floor, the dust, the web, the opened censuses), and it
arrives from nothing, C1, on the ramp §20.1 built. On the 9.8 s path a step of 0.01 is about six
frames, so the steepest run is under 1% of frame luminance per frame. It is a real change to a
path whose motion review is CLOSED/PASS, and it is reported as one: **`/review-animations` should
be run by hand before this candidate is considered for a freeze.** This session cannot invoke it
(§17.8.1, skill-use note).

### 22.6 Known weaknesses and divergences

1. **Between territories the dust is a third of the reference's** (57 against 167 lit points per
   10k px) and inside `العمل` it is 40% above it (218 against 155). The tile could be doubled and
   the interior lift halved; both were tried at the margin and the interior went flat. Left at the
   balance the fourth round found.
2. **The interiors are still ~10 levels above the reference's** at 0.5–0.7 r (the web and the
   opened fine census are mid-tone by nature) and the bright-pixel saturation is 22.7% against
   10.4%: additive compositing sums a pale line with the saturated bed beneath it.
3. **The floor tint is one colour.** The reference's ground is teal-navy everywhere; so is this one.
   A per-territory floor would be the `outM` skirt, which is there and weak.
4. **`صلاة الفجر` still sits on the densest cluster in `الإيمان`** (§17.8.3) and the web now runs
   under it too. Every other label clears its ground.
5. **The FAR → MID slope** (§22.5).
6. **The dust tile scales with the camera** rather than holding constant apparent size like the
   stars. Across the stable MID window that is 7%; across the whole bump the tile is invisible where
   the scale is far off, because `mapA` is.
7. **Object marks at map scale are a judgement**, as §F7 said of the last change to them: paler,
   not smaller, not moved.

### 22.7 What was deliberately not done

- **No links between territories.** The reference has them; the brief rules them out; dust is
  what the gaps get. Widening the web is one constant (`inE`'s 1.16).
- **No new territories, status lines or anchor glyphs** (§17.6 stands).
- **No change to the tone curve, `P.ground`, or any pack constant.** Everything lives at map scale.
- **`review-animations`** — gated on this host, and the brief did not ask; §22.5 measures instead.
- **No archive and no freeze.** The §21 archive is the last approved MID. If Product approves this
  candidate, the archive, manifest and structure board are made then, against this SHA.

---

## 23. The reconstruction (WS7R-R) — MID rebuilt against REFERENCE 01 and REFERENCE 02

Product rejected the §22 candidate on 2026-09-20 and superseded it visually with two new
references: **REFERENCE 01**, a 2000×1125 frame of this same world (kept as
`ws7rr-reference-01.webp` / `.png`, with four 2× crops `ws7rr-ref01-crop-*.png`), the primary
global reference for atmosphere, colour distribution, depth, calmness and material; and
**REFERENCE 02**, a 132×147 patch (`ws7rr-reference-02-micro.png`) cut from the §17 reference,
the direct morphology reference for the small-scale pattern — short lit fractures, local
clusters, tiny facets, subtle branching, restrained light, large dark gaps. NEAR, FAR and motion
were out of scope. What follows is a **candidate**, not an approval:

| | |
|---|---|
| candidate prototype | `wf-living-constellation.html` · 359,265 bytes |
| SHA-256 | `6D8EFDBCF155BCF6BDCB83CAF9F32D54F88AAC3E8EB6585312048B23A1AEBFF6` |
| proof — hero | `ws7rr-mid-hero.png` (A = 0.5, 2100×1181, `now` 0) |
| proof — REFERENCE 01 comparison | `ws7rr-reference01-vs-mid.png` |
| proof — REFERENCE 02 local-pattern comparison | `ws7rr-reference02-vs-local.png` (the patch at 3.2× beside four 1:1 crops of the hero: the focus nest, the money nest, the learning nest, `تمرين`) |
| harness | `ws7rr-boards.js`, beside `ws7rq-measure.js` |

### 23.1 The diagnosis

Product's finding, in its own words: far too many visible lines, too much global mesh, excessive
noise, unattractive irregular large boundaries, uncomfortable lighting, poor background colour
distribution, labels too small and crowded, insufficient macro calmness — and the conceptual
error underneath all of it: *the local morphology of REFERENCE 02 was expanded into a global
network.* §22 had read the WS4 k-NN mesh as "the reference's own texture" and drawn 8,794 of its
edges uniformly inside every hull, then opened the fine census 2.3× and lifted every interior
point by the same factor to carry it. Three uniform lifts one scale apart, and the map was a net.

What REFERENCE 01 asks globally: a teal-navy near-black ground; each territory a broad dark
field of strong tint whose colour bleeds past the rim into the gap; the rim one thin pale line
with a soft faint breath around it, not a band; light carried by particles — fine dust
everywhere, a few dense bright NESTS per territory (`تمرين`, `ميزانية`, `صلاة الفجر`), a share of
them soft defocused discs — and by the one warm focus glow; few lines, pale, short, local; large
pale territory names with quiet ground under them. What REFERENCE 02 asks locally: the crackle —
hairline fractures joining lit nodes into small irregular cells, branching, breaking, with dark
gaps between the clusters — used **selectively**, inside nests and along edges, never as a fill.

### 23.2 What changed — every term still rides the bump

Nothing is newly scheduled; every site is `predecessor × (1 ± map·k)`, inside `if(S.mapA>0)`, or
a build-time derivation consuming no randomness. `S.map` and `S.mapA` are exactly 0 at A = 0 and
A = 1, so FAR and the frozen NEAR are bit-identical by construction (proved, §23.5).

- **§R1 local density, baked.** `p.dn` — the count of coarse points within 64 units, over the
  coarse population's 90th percentile, clamped — is derived in the build beside `p.inT`, from
  final coordinates only. 6,611 coarse points; 2,831 above 0.55 (the nests).
- **§R2 the web is local, or it is a mesh.** The eighteen batched paths keep their structure and
  lose their census: an edge survives only where both ends sit in a nest
  (`ss(0.34,0.72,(a.dn+b.dn)/2)`) AND inside a patch of a low-frequency field
  (`ss(0.47,0.60,fbm(x/230,y/230))`, features about a third of a territory). **8,794 → 3,396
  edges**, and the dark gaps REFERENCE 02 shows are gaps in the web, not in the dust. The line goes
  nearer white (sat 24 → 14, light 76 → 86) at 0.85 px.
- **§R3 the lift follows density.** The vertex light (`1+loc·(0.45+dn·1.70)`), the fine census
  (`1+loc·(0.45+dn·1.15)`) and the radius (`1+loc·(0.55+dn·1.05)`) all weight on `dn`; a sparse
  interior point barely rises above its FAR value, a nest point rises more than §Q4 gave anyone.
  **§R3b bokeh**: over the nest population only (`dn > 0.55`, `w > 0.50`, coarse), one 'point'
  sprite at 5.2 radii, sat 16 / light 90 as constants — about 985 blits at MID.
- **§R4 the cloud goes dark.** The lit aerosol pass −30% at map scale; a second pass in its own
  cache slot (`gm`) lays the same cloud at lightness 26–28 and +24 saturation at 1.9× — chroma
  without luminance. The territory bed `mbed` down two points of lightness and up to 0.29; the
  inner atmosphere −88%; the lit skirt −94%; the dark skirt `outM` to 2.3 radii at 0.18,
  lightness 22 — the hue bleeding into the gap.
- **§R5 one thin pale line.** The halo band to 0.22 of M2's weight (was 0.36), spread ×0.45,
  sat 12 / light 88 — the breath, nothing more. The rim's three weights **converge** (ghost 0.18 →
  0.34 at 2.2 w, `lo` 0.46, `hi` 1.05 → 0.70 at 1.35×0.80 w; `al` ×1.90) so the boundary is one
  continuous pale line whose presence breathes about two to one, no longer bright dashes over a
  ghost. Still one noise field, still varying.
- **§R6 the session frame.** The M2 facets go to 40% of the crossfade and the smooth ring keeps
  60% (`sw = 1 − mapA·0.40`, `fm = mapA·0.40`, exact at both ends, sum one); the ring goes pale
  (sat −24, light +12) and its absent third is stroked as a ghost at 0.20; the session halo band
  −82%; the fill 0.200 → 0.140; `al` ×1.30 → ×1.30 → ×1.30 replaced by ×1.30 → **×1.30 → ×1.30**… —
  in one line: session rim budget `(1+map·1.30)` → `(1+map·0.30)`.
- **§R7 type.** Territory names ×1.42 at map scale (32 → ~45 px on the 2100 frame; REFERENCE 01's
  `العمل` is ~46 px on 2000), sat −16, alpha −10%; session names ×1.24. `label()` takes a ninth
  argument `sp` that widens the plate's ellipse (×1.85 territories, ×1.60 sessions) at
  0.26 / 0.20 alpha — a **quiet optical zone**: no edge, no fill, no rule, never a card. Weight
  stays 600: a weight switch mid-ramp would pop. Default `sp` is 1, so every other call is
  byte-identical.
- **§R8 clustered dust.** `dustTile` rebuilt from the same generator and seed: 9,000 candidate
  specks accepted through a **periodic** density mask (a product of sines with integer periods in
  the tile, so it still tiles seamlessly; acceptance 0.16–1.0), one in twelve a soft disc at a
  tenth of the alpha; blitted at 0.95. Floor tint `rgba(4,15,24)` at 0.44; vignette keeps 75% at
  map scale (was 45%); stars −42% and the census opening 0.30 → 0.10; clusters −55%.
- **Lines elsewhere.** Filament census `(1−map·0.62)` (was 0.38) with the resolve band moved with
  it; core `(1−map·0.90)`; smear `(1−map·0.80)`; currents `(1−map·0.85)`; knots `(1+map·0.20)`.

### 23.3 Measured, against REFERENCE 01 and against the rejected candidate

Hero frame (2100×1181, A = 0.5, every second pixel), reference at its own size (the §22
statistics were taken on the §17 reference at 726×419; REFERENCE 01 measures the same to a
decimal on every row below — frame mean 27.5, p99 181, dark share 47.9%, bright-sat 10.4%):

| | REFERENCE 01 | WS7R-Q (rejected) | **WS7R-R** |
|---|---|---|---|
| frame mean | 27.5 | 29.5 | **27.1** |
| p50 / p90 / p95 / p99 | 18.7 / 54.5 / 78.7 / 181 | 22 / 51 / 72 / 182 | **20.8 / 42 / 62 / 188** |
| share below level 18 | 47.9% | 36.1% | **38.0%** |
| bright-pixel saturation | 10.4% | 22.7% | **19.4%** |
| mean chroma | 15.2 | 18.7 | 19.3 |
| ground (darkest 40%) | (4,10,13) | (8,15,19) | (9,14,19) |
| `العمل` rim peak: luminance / saturation | 59.8 / 29% | 55 / 38% | 44.6 / 45% |
| `العمل` 0.4–0.8 r: luminance | 21 / 26 / 31 / 33 / 26 | 49 / 44 / 37 / 40 / 28 | **42 / 36 / 33 / 37 / 25** |
| `العمل` interior: lit points per 10k px | 155 | 218 | **152** |
| `العمل` interior: floor (< 22) / mid-tone (36–100) | 60% / 12% | 18% / 36% | 22% / 27% |
| `الصحة` interior: points / floor / mid-tone | 194 / 54% / 16% | 199 / 27% / 28% | 160 / 30% / 21% |
| `المال` interior: points / floor / mid-tone | — | 153 / 46% / 14% | 128 / 53% / 11% |
| between territories: points / floor | 167 / 65% | 57 / 92% | 41 / 94% |

Three renders, each measured before the next: the first cut (everything in §23.2 at its first
values) already sat at mean 24.8 and 44.6% dark; the second put the session rings back toward the
smooth ring, took the filament smear down further, darkened and weighted the bed and raised the
dust; the third raised the gap dust and the rim, softened the nests (light lift 2.10 → 1.70 on
`dn`, bokeh 0.42 → 0.50) and put a fifth more weight under the colour fields. The third is the
candidate; nothing was tuned after it.

**Stratum table** (1050×591, each term zeroed alone; frozen MID's "nothing" was 54.4 in §22.1):

| switched off | frame mean | share < 18 |
|---|---|---|
| nothing | 37.1 | 24.3% |
| territory atmospheres (in / bed / skirts) | 28.0 | 54.1% |
| cosmos | 32.8 | 36.8% |
| territory halo band | 33.7 | 34.6% |
| aerosol | 35.5 | 26.6% |
| sessions | 35.8 | 25.2% |
| territory rim | 36.4 | 24.4% |
| currents | 36.1 | 27.0% |
| knots · clusters · membrane | each within 0.3 of nothing | |

No single term is two fifths of the frame any more; the largest is the territory colour itself,
which is where REFERENCE 01 keeps its light.

### 23.4 How global line density was reduced

Four instruments, in order of effect. (1) **The web census moved into the build** and became
local: 8,794 → 3,396 edges, gated on nest density and on a patch field, so what remains is
REFERENCE 02's fractures where the material is already dense and nothing between. (2) **The
filaments**: census ×0.38 (was ×0.62) with its resolve band moved to match, cores ×0.10, the wide
smear ×0.20, so a filament at map scale is a faint weather trace and never a wire. (3) **The
long arcs**: currents ×0.15. (4) **The frames**: session halo band ×0.18, the facet skeleton at
40% with the pale smooth ring at 60%, the territory rim converged to one line. Draw calls at MID
(1500×860, warm): strokes **2,797 → 2,002**, fills 22,815 → 20,494, blits 2,386 → 3,371 (+985,
the bokeh), gradients 163 unchanged. Life now comes from the material — dark tinted fields,
nests, bokeh, clustered dust, the one warm glow — and not from connections.

### 23.5 Preservation, parity, reproducibility

- **FAR (A = 0): 0 of 2,480,100 pixels differ** from `ws7rc-far-hero.png`, max channel 0.
- **Frozen NEAR (A = 1): 0 of 2,480,100 pixels differ** from `ws7rv2-near-hero.png`, at `now` 0
  and at the default `now`. The §16 freeze is intact and re-proved at this SHA.
- **MID bit-reproducible**: two reports of the same spec identical to the digit.
- **Reduced motion, settled, at MID: 0 of 620,550 pixels differ** (`__rParity`, `RMFORCE`
  toggled around two renders). Every new term is a static function of the camera.
- `__audit()`: every boolean assertion true; 233 objects · 123 relations · 34,847 field vertices
  · 8,180 filaments · 54,998 links · 9,501 mesh edges · 96 currents · 19 worlds · 28 clusters ·
  27 knots · 72 aerosol · 9 voids — every count unchanged. `__typeAudit()`: letter-spacing 0px,
  direction rtl, weight in the Arabic range, IBM Plex Sans Arabic loaded.
- **The §22.4 settle trap, seen again.** In one batch the NEAR diff reported **8,557** differing
  pixels (max 205) — the exact fresh-page signature — although `__qSettle` had run earlier in
  the same batch and `WORK.from` was null before and after. Re-run with `__qSettle` immediately
  before the diff: 0. Rule tightened: settle *immediately before each* preservation diff, not
  once per page.

### 23.6 The transits

Camera on the path, A swept 0 → 1 in steps of 0.01, frame mean at 1050×591:

| | §19.2 (frozen) | WS7R-Q | **WS7R-R** |
|---|---|---|---|
| FAR → MID, steepest step per 0.01 | 3.473% at A = 0.35 | 5.359% at A = 0.23 | **5.305% at A = 0.28** |
| the five steepest | consecutive run | 0.19 / 0.23 / 0.27 / 0.31 / 0.37 | 0.28 / 0.19 / 0.24 / 0.32 / 0.25 — a slope, not a pop |
| MID → NEAR, steepest step | 3.874% at A = 0.83 | 2.052% at A = 0.82 | **2.285% at A = 0.73** |
| stable MID, A ∈ [0.51, 0.56] | — | 0.4–1.1% per step | 0.56–0.93% per step, the camera's own travel |

The FAR → MID approach is the same class as the rejected candidate's (less material arrives, but
the dust and the colour fields arrive on the same ramp); it is still steeper than the frozen
build's. **`/review-animations` should be run by hand before this candidate is considered for
a freeze** — this session cannot invoke it. Motion was not changed in this pass.

### 23.7 Known weaknesses and divergences

1. **Between territories the dust is a quarter of REFERENCE 01's** (41 against 167 lit points per
   10k px). The tile is deliberately clustered — Product's own list asks for sparse areas and
   genuine dark pockets — and the peak detector does not count specks under 22 levels. Left
   here; one constant (the blit alpha, 0.95) if Product wants dustier gaps.
2. **The interiors are still lifted against the reference**: `العمل` floor share 22% against 60%,
   mid-tone 27% against 12%, and the 0.4 r ring 42 against 21. The reference's interior is
   darker *between* its particles than the bed + dust + bokeh sum here; the bright-pixel
   saturation (19.4% against 10.4%) is the same residual — pale things over a saturated bed.
3. **The rim peaks under the reference's** (44.6 against 59.8) and is more saturated (45% against
   29%): the pale line is there, the reference's is a shade brighter and whiter.
4. **The nests are harder than the reference's** — `المال` and `التعلّم` read as dense white
   clusters where REFERENCE 01's are softer, with more bokeh and less point. The bokeh share is
   one constant.
5. **`صلاة الفجر` still sits on the densest cluster in `الإيمان`** (§17.8.3); the quiet zone
   helps and does not solve it.
6. **The facet chords still show faintly beside the ring** on `جلسة ١٢` at 1:1 (one sagitta apart).
7. **+985 blits at MID** for the bokeh; a real-device number is still not obtainable on this host.
8. **The FAR → MID slope** (§23.6).

### 23.8 What was deliberately not done

- **No links between territories**, no new territories, status lines or anchor glyphs (§17.6).
- **No change to FAR, to NEAR, to the schedule's ramps, to the tone curve or to any pack
  constant.** Everything lives at map scale and is proved to.
- **No motion change.** The dust, the bokeh and the fields are static functions of the camera;
  nothing loops.
- **No cards, badges or plates with edges** under the Arabic — the quiet zone is a gradient.
- **`review-animations`** — gated on this host; §23.6 measures instead.
- **No archive and no freeze.** The §21 archive is the last approved MID. If Product approves
  this candidate, the archive, manifest and structure board are made then, against this SHA.

---

## 24. Motion review of the WS7R-R MID (`review-animations`, Product-invoked, 2026-09-20)

Review only. Nothing was modified: the prototype is the same 359,265 bytes and the same SHA-256
`6D8EFDBCF155BCF6BDCB83CAF9F32D54F88AAC3E8EB6585312048B23A1AEBFF6` before and after. Product
accepted the WS7R-R visual as-is before this review and named motion compatibility as the only
remaining gate for the final MID freeze; the freeze itself is not performed here.

Method is §19's: 1050×591 frames at `now` 0 on a fresh load, `__qSettle` immediately before every
preservation diff (§23.5). Two camera conditions are reported and kept apart: **pinned** at the
MID camera (field 1517.9, look-at 1292.9 / 734.3), which measures the schedule alone, and **on the
path**, which measures what the reader sees. The frozen approved MID `5225B460…` was extracted
from `I-08B1-MID-BASELINE-APPROVED.zip` into a temporary folder (deleted afterwards), verified
against its own hero (0 of 2,480,100 pixels), and measured by the identical code as the baseline.

### 24.1 The two transits — and a correction to §22.5 / §23.6

Those two tables compared an **on-path** steepest step against §19.2's **pinned** 3.47%. The two
are not comparable; the on-path figure carries the camera's own travel. Both, for both builds:

| steepest step per 0.01 A | frozen MID `5225B460…` | **WS7R-R** |
|---|---|---|
| FAR → MID, pinned (schedule only) | 3.473% at A = 0.35 | **3.414% at A = 0.19** |
| FAR → MID, on the path | 4.961% at A = 0.35 | **5.073% at A = 0.28** |
| MID → NEAR, pinned | −3.874% at A = 0.83 | **−2.570% at A = 0.91** |
| MID → NEAR, on the path | −2.550% at A = 0.81 | **−2.285% at A = 0.73** |
| worst local change, pinned (px ≥ 24 per 0.01), FAR→MID / MID→NEAR | 1,889 / 3,692 | 2,149 / 3,973 |
| stable MID plateau, pinned, per 0.01 | — | 0.06–0.61% |

So the "5.31%" of §23.6 (5.07% here at full-pixel sampling) is the same class as the frozen
build's own 4.96% on the same path, and the schedule alone is a shade *gentler* than the frozen
build's on both transits. **Perceptually**: the traverse is constant-rate (9.8 s, dA = 0.0017 per
frame at 60 fps) on an ease-in-out curve that runs 1.5× that at A = 0.28, so the steepest on-path
step is **1.29% of frame luminance per frame**; the run A = 0.17–0.34 is eighteen consecutive
steps between 1.7% and 5.1% (pinned 0.3–3.4%), a monotone brightening from mean 15.5 to 25.3
over about 1.1 s with no isolated step above its neighbours. A slope, not a pop. The `lodB`
window 0.68–0.72 reads 0.49–2.12% per 0.01 pinned (§19.2 had 0.19–0.34%; the map's fall now
overlaps it), still below the frozen build's own steepest steps and with a local-change footprint
(1,252–2,800 px) no larger than its neighbours'.

### 24.2 Schedule continuity

62 numeric terms sampled every 0.0005 of A: no discontinuity. Steepest per frame as a share of
the term's own range: `lodB` 12.74% (pre-existing), `web.tband` 5.39%, `web.vband` 2.38%,
`curBand` 2.22%, `web.band` 1.49%; **`map` / `mapA` 0.671% at A = 0.31** — identical to §19.1.
`map` and `mapA` are exactly 0 at A = 0 and A = 1 and `mapA` exactly 1 across A ∈ [0.50, 0.56].

### 24.3 The zero boundaries

Every WS7R-R site is gated `if(S.mapA>0)` or `loc>0` — boundaries at an exact zero (§20.1), not
thresholds. Straddled with ΔA = 2×10⁻⁵, pinned, against a control interval 0.002 away: at
A = 0.12 the gate moves **0 px ≥ 2** (control 0); at A = 0.98 the gate moves 77 px ≥ 2 / 42 ≥ 8
(control 84 / 43). No step. `sw = 1 − mapA·0.40` never reaches 0, so the session ring's branch
never closes. The per-element early-outs (web `al < 0.004`, `glow` ≤ 0.004, vertex `a < 0.012`)
are all under one level.

### 24.4 What appears and disappears — fine steps of ΔA = 0.001, pinned

Windows [0.10, 0.22] (map onset), [0.44, 0.60] (plateau and both edges), [0.92, 1.00] (map exit).
**No step is attributable to the map material.** The local clusters and fracture web, the bokeh,
the clustered dust, the dark cloud pass, the ghost rims and the session crossfade all arrive and
leave on the ramp: zeroing `web.a`, `aero`, `cur`, `knot`, `clus`, `eco`, `cosmos` or `mem`
across every flagged step changes nothing. The flagged steps are two pre-existing mechanisms:

- **(a) Label re-raster.** Every ≥ 100-level pixel in a flagged step sits on a label: at
  0.199 → 0.200 all ten visible session names (their shared px crosses 19.0: 831 px ≥ 16,
  max 177), at 0.200 → 0.201 `العائلة` (a sub-pixel position snap, 89 px, mean −3), at
  0.954 → 0.955 and 0.964 → 0.965 the object labels and the moving focus-session name. Canvas
  `fillText` at a continuously varying size re-snaps its glyphs — measured on a scratch canvas,
  19.49 → 19.51 px moves 684 px by ≥ 16 (max 255), 18.99 → 19.01 moves 210 (max 93). Every label
  size has ridden A since WS5, so the mechanism is the frozen build's too: its window
  [0.19, 0.22] is clean (max 11 px ≥ 100) only because its session px is constant until A = 0.30.
  WS7R-R's larger map-scale type roughly **doubles** the number of integer crossings on the
  FAR → MID travel (territory names ≈ 33 against 9, session names ≈ 12 against 9); the
  continuous size change peaks at 0.116 px per frame (territory, A = 0.37). Label **positions**
  are fixed for the pinned camera; only the focus session's name moves, on `lod·fg`, as before.
- **(b) Star census.** 12–20 stars per 0.001 A cross the hard `rank > cut` at A ≈ 0.20 (max
  26–94 levels) and again on the falling cut at 0.93–0.96 — §F1/F4's inherited FAR → MID pop-in,
  untouched by this pass (R only narrowed the opened census, 0.30 → 0.10).

### 24.5 Reversibility, hysteresis, preservation

Fresh load: MID rendered first, then again after a 103-frame round trip 0.5 → 1 → 0 → 0.5 that
exercises every lazy cache — **identical**. FAR **0 of 2,480,100** against `ws7rc-far-hero.png`;
frozen NEAR **0** against `ws7rv2-near-hero.png`; MID **0** against `ws7rr-mid-hero.png`. No
path dependence in either direction.

### 24.6 Reduced motion

Settled parity, full against reduced, at A = 0 / 0.30 / 0.50 / 0.53 / 0.85 / 1: **0 differing
pixels of 620,550** at every point.

### 24.7 Interruption, retargeting, load

Unchanged from §19.6 and re-read at this SHA: `togglePlay` builds `PLAY` from the *current*
`PATH.t` with `dur = |to − from| × 9800` (constant rate, retarget not restart); the track, the
milestone labels, `f`/`m`/`n` and the arrow keys all null `PLAY` and set `PATH.t` directly, so
input never fights the tween and keyboard navigation does not animate. Nothing WS7R-R added
carries transition state: every term reads `S.map` fresh each frame, and `webQ`, `dustTile` and
`p.dn` are static build data. Load (strata drawn): FAR 11,500 · A = 0.30 11,627 · **MID 12,205** ·
A = 0.85 11,389 · NEAR 7,024 — MID is the peak at 6.1% over FAR (frozen: 1.2%; the bokeh blits),
with no transient spike mid-transit. No wall-clock figure is quoted, per the standing rule.

### 24.8 Semantic truth

`S.map` / `S.mapA` / `p.dn` / `loc` / `dust` sites are in strata 1–4 (cosmos), 8b, 9, 10, 11 and
12 only. **None in 13 (relations).** In 14 (objects) the one site is the pre-existing Q mark
colour (line 5279: paler, same radius, same alpha, no disclosure); in 16 the focus's subtractive
seat (pre-existing). No new block reads `now`, `WORK`, events or `reduced()`; `p.dn` is derived
from final coordinates and every audit count is unchanged. Nothing appears during transit that
is not MID material resolving.

### 24.9 Findings

1. **Minor — label size re-raster events on the map ramp** (§24.4a). Not a scene pop and not a
   change of mechanism; a change of degree. Remedy, if it ever matters, not applied: draw the
   type at an integer px and scale the context, or quantize px to 0.5 and cross-fade at crossings.
2. **Minor / pre-existing — the star census hard cut** on both transits (§24.4b), §F1/F4.
3. **Pre-existing, unchanged** — `lodB` the steepest term on the path; the `easeInOutQuad`
   approach curve (§19.8.3–4).
4. **Note — MID draw load +6.1% over FAR**; real-device validation still outstanding.
5. **Record correction** — §22.5 and §23.6 compared on-path steps to a pinned figure (§24.1).

**Verdict: PASS. Nothing found blocks the final MID freeze.** The freeze, archive, manifest and
structure board remain Product's act against this SHA.

---

## 25. The MID freeze — final and canonical (WS7R-R)

**`I-08B1 / MID VISUAL + MOTION BASELINE` is APPROVED / FROZEN / CANONICAL**, Product and
Architecture decision, 2026-09-20, following the §24 motion review's PASS.

| | |
|---|---|
| accepted prototype | `wf-living-constellation.html` · 359,265 bytes |
| SHA-256 | `6D8EFDBCF155BCF6BDCB83CAF9F32D54F88AAC3E8EB6585312048B23A1AEBFF6` |
| archive | `design-workshops/I-08B1-MID-BASELINE-APPROVED-WS7R-R.zip` |
| manifest | `design-workshops/I-08B1-MID-BASELINE-APPROVED-WS7R-R.manifest.txt` |

### 25.1 Supersession

The previous MID baseline, frozen at §21 and carrying SHA-256
`5225B4607CB5339E8E3BEFC33A0DC3B8AAC97F525FCDEFC10F50AA8F21C2CDD0`, is **SUPERSEDED BY PRODUCT
OVERRIDE** and is now **HISTORICAL / NON-CANONICAL**. Its archive
(`I-08B1-MID-BASELINE-APPROVED.zip`), its manifest and its proof boards are **preserved, not
deleted**; §21 and its proofs stand as the record of what was superseded and why. §21.3's rule —
that a new reference alone does not reopen a freeze — was overridden by Product twice on this
date, in as many words, and both overrides are recorded as Product decisions rather than as
contradictions found. The WS7R-R SHA above is the **single canonical MID visual and motion
baseline**.

### 25.2 What this freeze binds

MID is closed to further **preference-driven** iteration. Frozen exactly as reviewed:

1. the global visual composition of `ws7rr-mid-hero.png` (A = 0.5)
2. the territory material language — dark saturated bed, dark cloud pass, dark hue-bleeding
   skirt, one thin pale converged rim, the soft faint band (§23.2 R4, R5)
3. the background and nebular treatment — floor tint `rgba(4,15,24)` at 0.44·`mapA`, the dark
   saturated nebula pass, the map-scale vignette (§Q2, §R8)
4. the local particle system — the density-weighted lift, census and radius on `p.dn`, and the
   bokeh over the nest population (§R1, §R3, §R3b)
5. the REFERENCE 02 local fracture / cluster morphology — the build-time nest-and-patch web
   census, 3,396 edges in eighteen batched paths (§R2)
6. the reduced global line density — strokes 2,002 at MID (§23.4)
7. the session presentation — 60% pale smooth ring / 40% facets, the ghost rim, the reduced fill
   and band (§R6)
8. the territory and session typography and its quiet optical zones — `label()`'s `sp` argument,
   territory ×1.42 and session ×1.24 at map scale (§R7)
9. the Arabic readability treatment, as audited (`__typeAudit()` clean; `صلاة الفجر` remains the
   one listed weakness, §23.7.5)
10. the FAR → MID transition behaviour (§24.1)
11. the MID stable state, `mapA` exactly 1 across A ∈ [0.50, 0.56] (§24.2)
12. the MID → NEAR transition behaviour (§24.1)
13. reduced-motion parity — 0 differing pixels at six points (§24.6)
14. reversibility and zero hysteresis (§24.5)
15. the current disclosure behaviour — every schedule term at this SHA

### 25.3 Accepted non-blocking notes

Carried into the baseline as accepted, not as unfinished work:

- **canvas text rasterization size snapping** — Minor (§24.9.1)
- **inherited star census threshold behaviour** — Minor (§24.9.2)
- **MID draw load +6.1% against FAR** — portability / device-validation note (§24.9.4)
- the visual residuals of §23.7, all of which Product accepted as the visual compromise

None of these blocks the freeze and none of them reopens it.

### 25.4 The state at the moment of freezing — verified, not asserted

Re-measured on a fresh load at this SHA, immediately before the archive was built:

- FAR (A = 0): **0 of 2,480,100 pixels differ** from `ws7rc-far-hero.png`
- frozen NEAR (A = 1): **0 of 2,480,100 pixels differ** from `ws7rv2-near-hero.png`
- MID (A = 0.5): **0 of 2,480,100 pixels differ** from `ws7rr-mid-hero.png`
- reduced-motion settled parity at MID: **0 of 620,550**
- MID reproduces after a 103-frame round trip: identical
- `__audit()`: every **assertion** true, and every count unchanged — 233 objects · 123 relations
  · 34,847 field vertices · 8,180 filaments · 54,998 filament links · 9,501 mesh edges ·
  96 currents · 19 background worlds · 28 clusters · 27 knots · 72 aerosol · 9 voids.
  (`reducedMotion` and `loopRunning` read false in that object; both are **state reports**
  beside `slowMo` and `hierarchy`, not assertions — the OS preference is unset on this host and
  the render loop is idle after a settle. Recorded here so a future reader does not mistake them
  for failures.)
- `__typeAudit()`: letter-spacing 0px, direction rtl, weight in the Arabic range, IBM Plex Sans
  Arabic loaded, `#evlog` at 1.7 leading

### 25.5 The archive

Built after the freeze record above was written, so the archived notes carry the freeze.
Fourteen entries, flat, no folder prefix: the accepted prototype; the three canonical proofs;
these notes and the skill-use record; the reproduction support (`board-server.mjs`,
`ws7rq-measure.js`, `ws7rr-boards.js`) and the three reference images those harnesses load
(`ws7rr-reference-01.png`, `ws7rr-reference-02-micro.png`, `ws7rm-reference-target.png`); and
the two preservation references (`ws7rv2-near-hero.png`, `ws7rc-far-hero.png`). Every entry was
extracted after writing and compared **byte-for-byte by SHA-256** against its source. The
prototype was not modified at any point: its SHA-256 is identical before the review, after the
review and after the archive.

The manifest is **outside** the archive and carries the archive's own SHA-256 and size, every
entry's SHA-256 and size, the accepted prototype SHA and the superseded prototype SHA.

### 25.6 The reopen rule

MID reopens **only** on a genuine contradiction:

- a preservation diff that stops being zero
- a semantic claim the render makes that the canonical model does not support
- a real accessibility or Arabic-readability failure
- a portability defect requiring a visible correction
- an actual motion regression
- a canonical-state contradiction

**A new visual preference, a fresh-eye critique, or a new reference image does not reopen MID.**
This rule is the same one §21.3 carried; Product overrode it twice on 2026-09-20 by explicit
decision, which is the only mechanism that can override it, and neither override was a finding.

### 25.7 What is NOT frozen

- **FAR** — unfinished, never given a visual pass, bit-identical to WS7. Not started here.
- **I-08B1 overall** — **OPEN**.
- The `K` (MID density) and `J` (FAR subject) proposals remain implemented and **off**.

---

Placeholder status unchanged: hues, rings, node morphologies and states assert no canonical
runtime semantics. Territory hue is an identity, not a state or a rank. Nothing from the
reference image has been promoted to a runtime state — the constellation spec was used as
**visual material** only, and its activity-driven encodings (count ∝ activity, glow ∝
importance, size ∝ rank) were **not** imported. Background-world brightness carries no
meaning. Not screen design, not logo work, not production implementation. Nothing frozen.

---

## 26. The FAR reconstruction (WS7R-F) — the world seen from outside

Product's brief: FAR is the last unfinished visual target in I-08B1. It must answer *"where is
my world inside QANDEEL's larger cosmos?"*, read as a real luminous body seen from far away,
stay visually continuous with the frozen MID, and be **much simpler** than MID. NEAR and MID are
not to be reopened. Motion is explicitly out of scope for this pass.

### 26.1 Diagnosis of the inherited FAR

The frozen FAR was never a distant view of a world. It was the MID map drawn small. Measured and
looked at on `far-audit` renders at A = 0:

1. **Every name in the world was legible at the widest view.** All six territory names and
   eleven session names, plus the focus's `الآن`, at full weight. That is not a composition
   fault, it is a **privacy fault**: the frame a reader sees first was carrying the whole of the
   world's private semantic content. The brief prohibits it twice.
2. **The world read as a drawn container.** A continuous pale membrane outline around six
   circular territory rims around twelve smaller session rings — nested circles, i.e. a diagram.
   The brief's list of things the active world must NOT look like is "a UI circle, a glowing
   badge, a flat halo, a blurred blob"; the inherited FAR was the first.
3. **No body anywhere.** WS6 §6 established that what separates a body from a cosmic phenomenon
   is ILLUMINATION — a limb, a terminator, a dark side — and gave it to all nineteen background
   worlds. The user's own world was the one object in the frame that never got it, so the
   nineteen private bodies read as bodies and the subject read as a smudge with colour in it.
4. **The sky was uniform star wallpaper.** 34,000 stars at flat density over one rectangle, a
   near-black ground and essentially no nebular colour. Frame mean 12.01, dark share 83%,
   mean chroma 8.4.
5. **The subject was underlit relative to its surround** — J's own diagnosis, and correct.
6. **The background worlds read as bokeh.** Their body pass is a wide symmetric gradient
   reaching 1.66 radii and carries about four fifths of each world's light; two sit half off the
   frame edge, where a wide symmetric disc is indistinguishable from a lens artefact.

### 26.2 What happened to J

**Diagnosis kept, calibration rejected, ramp replaced.** J (`FARCAL`, WS7R §9) was three gain
changes: territory atmospheres ×1.30, their halo bands ×1.26, the background ecology ×0.85. Its
reading — the subject is lit below its surround — is right and this pass keeps it and raises it:
the atmospheres now go to **1.0**, the ceiling the schedule's own rule allows and no further
(`Math.min` enforces it), rather than J's 0.73. Everything else went:

- J's **halo lift is reversed**. The halo band is a circular edge cue on a territory, and with
  the atmospheres at their ceiling it was drawing six perfect circles. `terHaloF` is back to 1
  and the band itself drops 80% at FAR.
- J's **ramp is replaced**. `1 - ss(0, 0.46, A)` runs a third of the way into MID; that was
  acceptable for a proposal shipped off and is not acceptable for shipped material after the MID
  freeze. See §26.3.
- J **shipped OFF as a proposal**. `FARCAL` now defaults **ON** and is the composition. The flag
  and the `J` key survive as the A/B: pressing it holds the whole FAR window at zero in place and
  what is left is the inherited WS7 FAR, to the pixel.

### 26.3 The window, and why MID cannot be reached from here

```
S.far  = FARCAL ? (1 - ss(0.00, 0.12, A)) : 0        the light
S.farL = FARCAL ? (1 - ss(0.045, 0.12, A)) : 0       the type, later
```

`map` — the frozen MID material's own ramp — is `ss(0.12,0.50,A)·(1-ss(0.56,0.98,A))` and is
exactly 0 for A ≤ 0.12. So the FAR window and the MID window have **disjoint supports**: no
frame ever carries both. Every use of `far` below is written `x·(1 ± far·k)`, `x + far·k`, or
sits inside `if(S.far>0)` — a boundary, not a threshold (§N5's rule). `ss` clamps at both ends,
so the zero at 0.12 is exact and the value at A = 0 is exactly 1, and the derivative is zero at
both, so the treatment neither starts nor ends with a corner.

That is why "MID is untouched" is checkable over the **whole regime** rather than at two sampled
boards. Measured, FARCAL on against FARCAL off at 1400×787:

| A | 0.12 | 0.16 | 0.24 | 0.34 | 0.46 | 0.50 | 0.62 | 0.74 | 0.86 | 1.00 |
|---|---|---|---|---|---|---|---|---|---|---|
| differing px | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

`farL` is the type's own window inside it. Type is the one stratum where the requirement is
categorical rather than aesthetic, so it holds absence longer and arrives last; the first name
appears at **A = 0.055**.

### 26.4 The six instruments

**§F1 — the lines collapse, the mass does not.** Four strata made the widest view a diagram of
circles, and each is a drawn container asserting a boundary a reader at this distance cannot
use: the membrane (−94%), the territory rims (−88%), the session rings (−90%) and the semantic
relations (−84%). The currents keep their count — off-viewport continuation is on the PRESERVE
list at every distance — but lose 82% of their light and gain 2.3× width, the same
"sweep-not-line" move MID made. The filament census drops 74% with a fade band under it, the
wire cores 86%, and what survives spreads 1.95×. The object marks are **halved, not removed**:
233 marks each under two pixels is what collapsing detail looks like, and the world still has
things in it. `S.web.a` is deliberately NOT reduced — it is the alpha of the field's vertices as
well as its filaments, and the vertices are the internal particulate light this view wants more
of. The focus ring keeps a seventh: at FAR it was a UI target dropped on the middle of the frame.

**§F2 — the seed of MID, at distance.** The mandatory continuity requirement is met by drawing
the *same stratum*, not by imitation.
- `fbed` is MID's `mbed` — the dark saturated territory fill — at the same six positions, radii
  and identity hues, in its own cache slot, reaching 1.42 r with no edge anywhere in it so the
  six **overlap** into one body instead of six bubbles.
- The aerosol was **exactly zero at FAR**: the one volumetric, coloured, territory-local stratum
  in the painter was switched off in the one view whose subject is a coloured body. It is added
  back at 0.66. The clouds a reader sees as the distant world's internal colour are the same 72
  clouds, in the same places, at the same hues, that resolve into MID's territory interiors.
- The field vertices are weighted by **`p.dn`**, the baked local density that decides which
  points are nests at MID. The bright patches inside the distant body are literally the places
  that become `تمرين`, `ميزانية` and `صلاة الفجر` on approach, and the dark parts stay dark all
  the way in.
- The knots gain 115%: a knot is where there is more material, at every distance.
- The inner atmosphere loses 80%. It peaks at 0.90 r and is zero at 1.00 — it is a **ring**, and
  with nothing left to compete with it, it was drawing six perfect circles on its own.

**§F3 — the world is a lit body.** The signature instrument, and WS6 §6's own, at the scale of
the user's world, from the **same `LIGHT_DIR`** the nineteen background worlds use — which is
what makes the subject a member of its cosmos rather than a graphic in front of it. Three passes
through hull-shaped annuli (`bandPath`, so there is still exactly one shape in the world and the
irregular organic extent is free):
1. a faint cool **connective mass** over the hull, so the space between the six coloured regions
   is material and they read as regions OF something;
2. the **night side** — a linear gradient along the light axis, near-black at the anti-lit limb,
   transparent by the terminator, subtractive like `relGnd` and `objGnd`. It occludes the sky
   behind that side of the world, which is most of what separates a mass from a wash;
3. the **limb and its atmosphere** — one continuous stack crossing the silhouette, filled with a
   gradient centred outside the world on the lit side. No stroke, no clip: a profile, never an
   outline.

**§F4 — at FAR the world has no names.** `labTer`, `labSes`, `labObj` and `labNow` are all
multiplied by `1 - farL`, which is **exactly 0** at A = 0, so every `if(S.lab*>0.02)` gate is
skipped outright — not a faint name, no name. Proved rather than asserted: `TYPESTATE` records
what `label()` last set, and after a full FAR render it is `null`.

**§F5 — the sky is not wallpaper.** `s.fk` is a low-frequency density field sampled at each
star's own position and baked in the build (derived data, `fbm` consumes no randomness — the
§N4 rule; the world's random stream and all 233 objects are byte-identical). Applied as
`1 - far·(1 - fk)`, so it is exactly 1 outside the window and **no star ever changes
membership** — a star in a hole dims, it does not disappear. Range 0.13 – 1.00, mean 0.596. The
nebula population gains a second **dark saturated** pass in its own cache slot (lightness 24–30,
+22…30 saturation): chroma without luminance, §W5's accounting, so the sky gains colour mass at
a luminance barely above the floor and nothing is fogged.

**§F6 — a world, not a lens artefact.** The background worlds' light moves from the symmetric
half to the directional halves: body −34%, limb +52%, granulation +34%, and the shared world's
corona — the most lens-like thing in the population — −50%. And they are separated by **depth**:
the projection is normalised so the widest view shows every stratum at true scale, so they
cannot be separated by size here; `dep` is a real spatial fact the painter already carries, and
at FAR the furthest sits 36% below the nearest. Nothing changes membership, no world moves,
`dim` (the balance plan) is untouched.

### 26.5 Two defects this pass made and caught

1. **The 150-degrees-apart trap, again.** The first `fbed` applied "aerial perspective" as
   `lerp(t.hue, 200, 0.40)`. `lerp` is linear in the hue number, `العائلة` is at 6 and `المال`
   at 38, and two fifths of the way from 6 to 200 is **83 — a yellow-green**. The whole world
   went green. Going the short way round is no better: red to blue the short way is through
   magenta. What distance takes from a colour is **chroma and weight, not identity**, so the hue
   is `t.hue` exactly — which also makes it the strictest possible continuity statement — and
   the restraint the brief asks for on warm accents is spent as `warmK`, a constant of the hue
   that takes a little under a third off the two warm territories' weight.
2. **A band stack is a visible object.** The limb was first built as 9 + 13 annuli and drew six
   or seven concentric contour arcs — a topographic map of the hull, which is the drawn-outline
   defect wearing a different hat. Worse, the rim stack's outermost band ended at 58% of peak: a
   hard edge at 58% following the hull. Fixed at 34 + 40 bands on a profile that reaches zero at
   both ends; the step is now about two levels out of 255.

### 26.6 Verification

| | |
|---|---|
| frozen MID hero, A = 0.5 | **0** of 2,480,100 differing |
| frozen NEAR hero, A = 1 | **0** of 2,480,100 differing |
| FARCAL on vs off, ten A from 0.12 to 1.0 | **0** of 1,101,800 each |
| reduced-motion parity at FAR | **0** of 620,550 |
| FAR → MID → FAR, 103 frames | **0** of 455,400 |
| reproducibility (fresh load vs `ws7rf-far-hero.png`) | **0** of 2,480,100 |
| type drawn at FAR | `TYPESTATE === null` after a full render |
| `__audit()` | every count unchanged — 233 objects, 123 relations, 34,847 vertices, 8,180 filaments, 54,998 links, 9,501 mesh edges, 96 currents, 19 worlds, 28 clusters, 27 knots, 72 aerosol, 9 voids; every assertion true (`reducedMotion` and `loopRunning` are state reports, §25.4) |
| `__typeAudit()` | clean |
| draw load at A = 0 | 11,391 with the window on against **11,435** with it off — 0.4% **fewer**. The 102 band fills are more than paid for by the filaments and currents that no longer resolve. |

Frame statistics at A = 0, 1500×843:

| | old FAR | WS7R-F |
|---|---|---|
| mean | 12.01 | 14.66 |
| dark share (< 18) | 83.0% | 76.8% |
| mean chroma | 8.4 | **12.5** |
| p99 | 63.8 | 60.3 |
| over 200 (clipped) | 0.15% | **0.01%** |
| quadrant means | — | 17.9 / 12.0 / 12.1 / 10.4 — no dead half |

Colour up 49%, peaks and clipping **down**: the frame gained colour mass and kept its black,
which is the §W5 trade applied to a cosmos instead of to a map.

### 26.7 Motion — measured, not reviewed

Out of scope for this pass and recorded only so the later review has a starting number. On-path
frame mean across the window (1050×591; **on-path**, never comparable to a camera-pinned slope —
§24.1):

```
A      0.00   0.02   0.04   0.06   0.08   0.10   0.12   0.14   0.16
mean  14.26  14.39  14.37  14.08  13.79  13.60  13.99  14.43  14.94
```

Steepest step over the whole scan **1.84% per 0.01 A, at A = 0.13** — which is *outside* the FAR
window, i.e. it is the frozen build's own travel. Inside the window the steepest is ≈1.5%.
Against the frozen build's own on-path steepest of 4.96% and the MID material's 5.07%, the FAR
window is about a third of the motion already in the build. It is not a verdict. `review-animations`
is user-invoked on this host ([[claude-review-animations-user-invoked-only]]).

### 26.8 Known remaining weaknesses

1. **The whole FAR treatment dissolves over 0.12 of A, which is only 1.23× of zoom.** That is
   the price of making "MID is untouched" provable over the entire regime rather than at sample
   points, and it is the right price — but it means the labels, rims and session rings all
   arrive inside a narrow window. The measured slope says it is comfortable; a human eye on the
   travel is the only thing that settles it, and that is the motion gate's call.
2. **The body reads as a body mainly on its lit side.** The brief asks for "partial edge / limb
   light" and that is what it gets, but on the anti-lit side the world thins into space with no
   felt extent at all. A reader who wants to know *how big* the world is cannot tell from the
   dark half. Deliberate, and the alternative is an outline.
3. **The subject is still less body-like than its own background worlds.** Nineteen small discs
   with hard-won limbs read more decisively as objects than one large diffuse mass does. The gap
   is narrower than it was; it has not closed.
4. **Several background worlds are clipped by the frame edge**, where a partial disc is the
   hardest case for "world, not lens artefact". Their positions are WS4 Primary's and were not
   moved.
5. **The `fbed` tail extends past the hull** on the right, where `المال` and `العائلة` sit near
   the boundary, so the world's colour bleeds into space there. Capping it at the hull would
   have drawn the hull.
6. **The aerial-perspective restraint on warm hues is a constant, not a measurement.** `warmK`
   was chosen by eye against the brief's "restrained warm accents", not derived from a reference.
7. **No reference image was supplied for FAR.** REFERENCE 01 informed atmosphere, colour comfort
   and luminous material, as the brief allows, but there is no FAR target to measure against the
   way §23 could measure MID. Every number in §26.6 is internal.

### 26.9 What this pass did NOT do

No motion work. No freeze. No archive. I-08B1 is not closed. NEAR and MID are not reopened —
they are unreachable from this pass by construction, and §26.6 proves it. `K` (the MID density
proposal) and `L` (the near LOD hold) are unchanged; `J` is no longer a proposal.

---

## 27. Motion review of WS7R-F FAR (`review-animations`, Product-invoked, 2026-09-20)

Review only. The prototype was not modified: SHA-256
`4DFD9D27D752C3A445168C0CC7067D71DF4ADA84BC61B806D12C8BB3202BC413`, 388,374 bytes, identical
before and after. Everything below was measured through `window.__v*` helpers added to the live
page, never to the file.

### 27.1 Results

| | |
|---|---|
| stable FAR at A = 0 | **static.** Identical at `now` = 0, 5 s and 60 s (0 of 455,400 each); `loopRunning` false, no pending transfer. No perpetual decorative motion. |
| FAR → MID, A = 0 … 0.08, ΔA = 0.002 | mean **4,334** px/step change ≥16 levels against the frozen build's **7,237** in the same range. Max channel 200 against 228. The window makes the early travel **calmer** than the build it replaces. |
| FAR → MID, A = 0.08 … 0.16 | mean 7,220 against the control's 7,409. |
| A = 0.12 handoff, ΔA = 0.0005 | mean 1,221 px/step, worst 1,438, **the step at exactly 0.12 is 1,390** — mid-distribution, not an outlier. Frozen control over the same range: mean 1,221, worst 1,436, 1,388 at 0.12. **Identical to within 2 pixels.** |
| handoff, analytically | `far(0.12) = 0` with left slope → 0 and right slope 0; `map(0.12) = 0` with left 0 and right → 0. Both C1. `mem` continuous with matching slopes (1.5328 / 1.5315). |
| §F3 band decay tail, A = 0.095 … 0.118 | the 102 hull bands drop past their `a<0.004` / `a<0.0025` skip guards one at a time. Mean 2,649 px/step ≥8 levels against the frozen control's **2,690** — below the control's own floor. |
| label emergence | a clean smoothstep: 0 until A = 0.045, then 0.013 · 0.049 · 0.104 · 0.175 · 0.259 · 0.352 · 0.450 · 0.550 · 0.648 · 0.741 · 0.825 · 0.896 · 0.951 · 0.987 · 1.000 at 0.12. Zero slope at both ends. Rendered name-band mean rises 40.8 → 45.9 monotonically with no jump. |
| the three type render gates | `labTer` opens at A = 0.05132, `labSes` 0.05238, `labNow` 0.0536 — thresholds the frozen build never crossed, because it holds these strata at full weight at FAR. Measured across each at ΔA = 1e-5: max channel **31 / 32 / 38** against a no-gate control step of **45** at A = 0.07. Below ordinary travel. |
| reduced motion | destination parity **0 of 455,400** at A = 0, 0.04, 0.06, 0.09, 0.12, 0.5 and 1.0. |
| settled time-independence | 0 of 325,280 between `now` = 0 and 120,000 at A = 0, 0.06 and 0.115. |
| reversibility | 121-frame round trip to A = 0.35 and back: **0** at FAR and at the boundary. 40 crossings of A = 0.12: **0**. Path-independent. |
| interruption / retargeting | §F3's contract holds inside the window. Interrupting a transfer at blend 0.15, 0.45 and 0.80 gave a worst voice jump of **0.00000** — the second transfer re-snapshots from the displayed state. A single transfer decays on ease-out (154 → 109 → 77 → 53 → 22 → 4 → 0 px/step) and settles to exactly 0 by 609 ms. |
| `schedule` purity | takes `A` only, references no `EV.` and no clock — so none of the 25 FAR-term uses is an animation and none can be interrupted. `S.focus = 1 - far·0.86` is a time-constant scalar and cannot turn a retarget into a restart. |
| camera / semantic zoom | look-at pinned at `WC` through the whole window and past it to t = 0.28 — no pan during FAR → MID. Field width exponential and smooth across the boundary (z 0.6251 · 0.6698 · 0.7115 · **0.7177** · 0.7239), steepest 0.0148 z per 0.01 t, constant-rate in log space by construction. |
| frozen MID | **0** of 2,480,100. FARCAL on vs off at eleven A from 0.12 to 1.0: **0** of 1,101,800 each. |
| frozen NEAR | **0** of 2,480,100. |
| FAR reproducibility | fresh load against `ws7rf-far-hero.png`: **0** of 2,480,100. |
| readable private content at FAR | `TYPESTATE` is `null` after a full 2100×1181 render at A = 0 — `label()` is never called. First glyph rasterised at **A = 0.052**. |
| semantic leakage | all fifteen authority and non-semantic assertions true at FAR; all twelve population counts unchanged. |

### 27.2 Findings

| # | Severity | Finding |
|---|---|---|
| 1 | **Minor — craft** | **The colour sags over the first tenth of the approach.** Mean chroma 12.6 (A = 0) → 12.5 → 11.4 → 10.0 → **9.0 at A = 0.10**, then 9.1 · 9.3 · 10.0 · 12.0 · 13.5 · 17.4 at A = 0.40. The frozen build rises monotonically from 8.7. So the world's colour *recedes* for a tenth of the travel before it resolves. It is not a hole: at the trough WS7R-F sits on the control's own curve (chroma 9.0 vs 8.9, mean 13.28 vs 13.36) — the FAR uplift decays onto the frozen values without overshoot or undershoot, which is exactly what disjoint supports require. Rate is 0.36 chroma units per 0.01 A, gradual. **Unfixable without reopening MID**, which is forbidden: if FAR is richer than the frozen early-MID frames, travelling between them must reduce richness. |
| 2 | **Minor — visual, not motion** | **`المال` loses its amber identity at FAR.** Warm-pixel share inside its own disc at A = 0: **4.8%**, against **43.1%** in the inherited FAR and 84.8% at MID. `العائلة` is unaffected (18.1% against 16.0%). Cause is the §F3 cool connective mass and limb atmosphere over a small, deep, hull-edge territory whose `fbed` carries `warmK` = 0.712. It **resolves continuously and monotonically** — 4.8 · 5.3 · 4.2 · 9.2 · 15 · 33 · 42.7 — rejoining the inherited value exactly at the boundary, so nothing teleports. Product approved the FAR visual as-is; recorded for the record, not acted on. |
| 3 | **Cosmetic — inherited** | **Canvas text re-raster at size steps.** Of 104 pixels with a ≥100-level delta across ΔA = 0.0005 near the boundary, **103 sit on a name box** and one is a star. Already accepted at the MID freeze (§24, §25.3). WS7R-F does not worsen it — the boundary scan matches the frozen control to 2 pixels. |
| 4 | **Cosmetic** | **The §F3 band stacks have skip guards.** `if(a<0.004)` / `<0.0025` drop 102 hull bands one at a time as `far` decays — a C0 step each, largest ≈1 level of 255. Measured in the decay tail the build changes **fewer** pixels than the frozen control, so the family is below the existing noise floor. |
| — | Note, not a finding | **`المال` and `العائلة` swing non-monotonically at A = 0.18 – 0.30** (amber share 40.9 → 14.7 → 19.6; red 14 → 40.8). Entirely inside the frozen canonical build — bit-identical with the window on or off. Inherited, and MID is frozen. |

A first pass read the warm territories' *circular mean* hue sweeping through green (121°) and violet (289°) and nearly reported a colour-identity discontinuity. The hue **histogram** showed no green pass at all: a circular mean between amber and cyan lands on green even when no green pixel exists. The finding was withdrawn and replaced with #2, which is a share, not a mean.

### 27.3 Verdict

**PASS.** Nothing blocks the FAR freeze. No discontinuity, no teleport, no dead frame, no
hysteresis, no reduced-motion divergence, no preservation loss, no readable private content and
no semantic leakage. Findings 1 and 2 are for Product's judgement, not gates; 3 and 4 are below
the build's existing floor. FAR was **not** frozen and **not** archived by this review, and
I-08B1 remains OPEN.

---

## 28. The FAR freeze — final and canonical (WS7R-F)

Product decision, 2026-09-20, following the §27 motion review's PASS:

> **I-08B1 / FAR VISUAL + MOTION BASELINE — APPROVED / FROZEN / CANONICAL**

### 28.1 The accepted artefact

| | |
|---|---|
| prototype | `wf-living-constellation.html` · 388,374 bytes |
| SHA-256 | `4DFD9D27D752C3A445168C0CC7067D71DF4ADA84BC61B806D12C8BB3202BC413` |
| reconstruction | §26 |
| motion review | §27 — PASS |

The prototype was not modified at any point in the review or the freeze: the hash above is
identical before §27, after §27, and after both archives were built.

### 28.2 What the freeze binds

Frozen at this SHA, closed to further aesthetic iteration:

1. the FAR composition as a whole;
2. the active world's body treatment — §F3's connective mass, night side, limb and atmosphere,
   and the shared `LIGHT_DIR` that binds the subject to its own ecology;
3. the cosmic field — nebular dark-saturated pass, ground, vignette, galactic band, dust lanes;
4. the distant-world ecology — body/limb/granulation balance, the shared corona, and the `dep`
   value separation;
5. the FAR colour material — the six territory `fbed` masses at their own identity hues, `warmK`,
   the aerosol at FAR, the knots, and the `p.dn` density weighting;
6. the star treatment — the baked `fk` clustering field and its `lerp(1, fk, far)` application;
7. the FAR → MID resolution — the `far` window `1 - ss(0, 0.12, A)` and every one of its 25 uses;
8. label emergence — the `farL` window `1 - ss(0.045, 0.12, A)` and the A = 0.052 first glyph;
9. semantic-zoom behaviour — the camera pinned at `WC` through the window, exponential field;
10. reduced-motion behaviour — settled destination parity at every distance.

### 28.3 Accepted non-blocking findings

Recorded as accepted limitations. **None of these reopens FAR.**

1. **Minor** — chroma reduces during the first tenth of the approach (12.6 → 9.0) before
   rejoining the frozen MID material. It decays onto the frozen curve without undershoot; it is
   the arithmetic consequence of an enriched FAR meeting an untouched MID.
2. **Minor** — `المال` carries weaker amber identity at stable FAR (4.8% warm share) than at MID
   (84.8%). It resolves continuously and monotonically and rejoins the inherited value at the
   boundary.
3. **Cosmetic, inherited** — canvas text re-rasterisation at size steps (§24, §25.3).
4. **Cosmetic** — the §F3 band skip guards drop bands below the existing visual noise floor.

Also carried forward: the seven remaining weaknesses recorded at §26.8. All accepted.

### 28.4 Verified state at the freeze

Measured on a clean load at this SHA, immediately before archiving:

| | |
|---|---|
| FAR hero, A = 0 | 0 of 2,480,100 |
| frozen MID hero, A = 0.5 | 0 of 2,480,100 |
| frozen NEAR hero, A = 1 | 0 of 2,480,100 |
| reduced-motion parity at A = 0, 0.5, 1 | 0 of 620,550 each |
| 103-frame FAR → NEAR → FAR round trip | 0 at all three distances |
| `__audit()` | every count unchanged — 233 objects, 123 relations, 34,847 vertices, 8,180 filaments, 54,998 links, 9,501 mesh edges, 96 currents, 19 worlds, 28 clusters, 27 knots, 72 aerosol, 9 voids; every assertion true |
| `__typeAudit()` | clean |

`reducedMotion` and `loopRunning` read false and are **state reports, not assertions** — they sit
beside `slowMo` and `hierarchy`. The OS preference is unset on this host and the render loop is
idle after a settle. §25.4 records the same thing; it is not a regression.

### 28.5 The archive

`design-workshops/I-08B1-FAR-BASELINE-APPROVED-WS7R-F.zip`, twelve flat entries, every one
extracted and compared by SHA-256 against its source. Its external manifest
`…-WS7R-F.manifest.txt` carries the archive's own SHA-256 and size, every entry's SHA-256 and
size, and the unified, MID and NEAR baseline SHAs. The manifest stays **outside** the archive
because a file cannot record the hash of an archive that contains it. The notes were written
before the archive was built, so the archived notes carry this freeze.

**No earlier archive was overwritten or deleted.** The MID archive `733D0175…`, its manifest, the
NEAR archive `5A7F8E6D…` and the historical superseded MID archive `01FE469C…` are all present
and unchanged.

---

## 29. I-08B1 — CLOSED / FROZEN

Product decision, 2026-09-20, after the FAR archive verified.

> **I-08B1 — CORE VISUAL THESIS / VISIBLE MIND — CLOSED / FROZEN**

### 29.1 What is approved

The visual analysis-world foundation now has an approved, frozen answer at all three distances
and for the travel between them:

- the FAR world-at-distance view (§26, §27, §28);
- the MID living life-map view (§23, §24, §25);
- the NEAR local analytical constellation (§14, §15, §16);
- FAR ↔ MID ↔ NEAR semantic-zoom continuity, proved reversible to 0 pixels;
- the world material language, the cosmic atmosphere, the territory language, the session and
  local morphology, and the local constellation texture;
- Arabic readability behaviour, asserted by `__typeAudit()` rather than assumed;
- motion compatibility at every boundary, reduced-motion parity, and zero hysteresis;
- semantic and authority preservation — fifteen assertions, true at every distance.

The two principles the work was judged against, and which it is frozen against:

> **Nothing teleports. Meaning resolves.**
> **Macro simplicity. Micro richness.**

### 29.2 The reopen rule

I-08B1 is closed against preference-driven visual iteration. FAR, MID and NEAR do **not** reopen
for a fresh-eye critique, a new aesthetic reference, a change of preference, or a wish for more
polish. A frozen state reopens only for a genuine **contradiction**:

- a preservation diff that stops being zero;
- a semantic representation the model does not support;
- a real accessibility failure;
- a real Arabic-readability failure;
- a portability defect from the Skia/Reanimated port that requires a visible correction;
- a motion regression;
- a canonical-state contradiction.

Any such reopening is **targeted to the contradiction only**. It is not a licence to re-tune
anything else in the frame.

### 29.3 The closure package

`design-workshops/I-08B1-CANONICAL-CLOSURE.zip` — the minimum material that establishes the
final state, with an external manifest and every entry verified byte-for-byte. It deliberately
does not duplicate the large intermediate workshop material: the dedicated NEAR, MID and FAR
archives hold that, and `I-08B1-CANONICAL-STATE.md` inside the package names them with their
hashes.

### 29.4 What is NOT closed by this

I-08B1 is the visual thesis. It is not the implementation. The Skia/Reanimated port, the
responsive and device-class work, and every downstream product task remain open and are governed
by their own briefs. `K` (the MID density proposal) and `L` (the near LOD hold) remain available
as toggles and remain **off**; `J` is no longer a proposal — it is the FAR composition and ships
**on**.
