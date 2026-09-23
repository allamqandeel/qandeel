# C3_VALIDATION_RESULTS

**I-08B3.1-C3.11 / C3.12.** Every check this package makes, and what it returned.

**GENERATED FROM `data/C3_VALIDATION.json`.** No figure below is typed by hand. Regenerate with
`node tools/c3-validate.mjs && node tools/c3-docs.mjs`.

Run: `2026-09-21T18:51:39.909Z`

---

## 0. The four layers, and what each one needs to run

A reviewer extracting this package into an empty directory should know in advance which checks
will run there and which will not. **Nothing in layer A depends on B, C or D** — the claims that
matter most are the ones that survive the barest environment.

| Layer | What it checks | Needs | Result |
|---|---|---|---|
| **A** | invariants and negative probes | none — pure Node | **21/21** |
| **B** | DTCG 2025.10 schema conformance | ajv | **CONFORMS** |
| **C** | character scale sweep | headless Chrome (no font) | **NOT_A_CAPABILITY_THRESHOLD** |
| **D** | token-driven reproduction of the accepted compositions | headless Chrome + the local Arabic font + the sealed I-08B3.1-C2 package | **9/9 byte-identical** |

---

## 1. Invariants and negative probes

**An invariant here is a PAIR, not a function that returns true.** `check` must pass on the real
package; `probe` returns a deliberately corrupted package on which `check` must FAIL. A green row
means two things were observed: that the package satisfies the rule, and that the checker can
tell when a package does not.

This is the stronger form of a lesson that cost I-08B3.1-C1 two decorative checks — one that
compared a constant with itself, one whose scan was narrower than the sentence describing it.
Neither was found by reading the documents.

**21 of 21 verifiable invariants hold AND their probes fired.**

A check that cannot RUN gets its own outcome. In a bare extraction there is no sealed predecessor
to compare against, so **I-17 reports UNVERIFIABLE rather than PASS or FAIL** — reporting FAIL
would be wrong, since nothing is broken, and reporting PASS would claim a verification that did
not happen, which is the exact failure this layer exists to prevent.

| | Invariant | Result | Probe | What the check found |
|---|---|---|---|---|
| I-01 | Exactly one dark Living Brass body literal exists | PASS | fired | 1 literal(s): darkMaterial:qandeel.expression.material.living-brass.body |
| I-02 | Identity aliases resolve to the one body | PASS | fired | qandeel.identity.material, qandeel.identity.mark, qandeel.identity.moment |
| I-03 | Persistent navigation machinery resolves to the one body under P2 | PASS | fired | #a58e6f via qandeel.navigation.machinery -> qandeel.identity.material -> qandeel.expression.material.living-brass.body |
| I-04 | No state token resolves to the material, and no state sibling of the family exists | PASS | fired | no state name reaches the material; {qandeel.state} holds 0 value(s) |
| I-05 | No status token aliases the material, and the status namespace is empty | PASS | fired | status reserved and empty |
| I-06 | No analytical token resolves to the material | PASS | fired | analytical plane entirely neutral |
| I-07 | No text or content token resolves to the material — BRASS NEVER SETS TYPE | PASS | fired | no type role reaches the material |
| I-08 | No border, divider, rule or outline token resolves to the material — BRASS NEVER ENCLOSES | PASS | fired | no enclosure reaches the material |
| I-09 | No Brass opacity ladder exists | PASS | fired | the material is opaque and has one rung |
| I-10 | No Brass lightness or chroma ladder exists — the character tone is derived, not stored | PASS | fired | one warm value above the derived floor C 0.0334 (frozen neutrals top out at 0.0153, the body sits at 0.0516); the character tone is a ratio (0.63) and a direction |
| I-11 | The retired bodies appear nowhere except where they are named as retired | PASS | fired | 2 retired value(s) named ONLY in the retirement record at qandeel.expression.material.living-brass.body.$extensions["com.qandeel.provenance"].retired |
| I-12 | No second Living Brass body exists, under any name | PASS | fired | 1 value(s) above the derived chroma floor C 0.0334: #a58e6f — the frozen reading ramp sits below it at C 0.0153 and is correctly NOT counted as a second body |
| I-13 | No Light appearance value is invented — light resolution FAILS LOUDLY | PASS | fired | light carries no value; all 4 material names UNRESOLVED and named |
| I-14 | The QANDEEL Light namespace is reserved, empty, and not aliased to the material | PASS | fired | reserved, empty, and unaliased |
| I-15 | Functional control families do not inherit the material | PASS | fired | functional controls resolve to #8b8982 (the frozen tertiary neutral) |
| I-16 | The sRGB literal round-trips from the authored OkLCh triple | PASS | fired | oklch(0.66 0.052 75) -> #a58e6f; components -> #a58e6f; stored #a58e6f |
| I-17 | Every inherited file is byte-identical to the sealed package it came from | PASS | fired | 9 file(s) byte-identical to their sealed source |
| I-18 | No font binary and no forbidden token name ships | PASS | fired | no font binary; no forbidden token name |
| I-19 | The material clears 3:1 on both frozen grounds where it is an essential component visual | PASS | fired | #a58e6f: 6.070:1 on the World #101010, 5.664:1 on the Surface #181818 |
| I-20 | Every resolver $ref resolves to a file that exists | PASS | fired | 8 file $ref(s), all present |
| I-21 | The character tone derives from the AUTHORED triple, and the obvious derivation is wrong | PASS | fired | spec route (authored oklch 0.66 0.052 75, depth 0.050794) -> #967f60 = accepted #967f60; obvious route (quantised #a58e6f) -> #957f60, which is DIFFERENT and is why the spec names a source |

### The two thresholds the checks depend on are DERIVED, not chosen

QANDEEL's frozen reading ramp is not perfectly achromatic — a warm-leaning neutral was a
deliberate A-stage decision. So "is this a second Brass?" cannot be answered with a hand-picked
chroma cutoff, and the first version of invariants I-10 and I-12 used one (0.012) and duly
reported the frozen reading ramp as two extra Brass bodies: a true result about the numbers and a
false one about the system.

| | Oklab C |
|---|---|
| warmest frozen neutral | 0.0153 |
| **derived floor** (midpoint) | **0.0334** |
| the Living Brass body | 0.0516 |

---

## 2. DTCG 2025.10 schema conformance

Validated against the **vendored official schemas**, whose integrity is checked first against
the provenance record carried with them. Publication commit `f0f32a7dce0b (2025-10-28, "Publish 2025.10" #340)`,
22 schema files, all hashes matching.

| Token file | Schema | Result |
|---|---|---|
| `tokens/base/material.tokens.json` | format.json | CONFORMS |
| `tokens/appearance/dark.material.tokens.json` | format.json | CONFORMS |
| `tokens/appearance/light.material.tokens.json` | format.json | CONFORMS |
| `tokens/qandeel-living-brass.resolver.json` | resolver.json | CONFORMS |

### This section earned its place on the first run

The material behaviour rules — *quiet satin*, *subtractive-only*, *permission-not-size*,
*authored-oklch* — were first authored as tokens with `$type: "other"`. **DTCG 2025.10 defines
exactly thirteen types and `other` is not among them**, so this check rejected them.

The fix is better than the original rather than a workaround. A DTCG token carries a **design
value** that a build consumes; *"the character may only darken"* is not a value, it is a
contract a human obeys. They now live in the group's `$extensions`, which is what `$extensions`
is for. The numbers stayed tokens, because a build really does consume those.

---

## 3. The character scale sweep — IS THE THRESHOLD EARNED?

The brief is explicit: *"Define a scale threshold as an IMPLEMENTATION RULE only if evidence
supports a stable one. Do not invent one merely for convenience."*

C1R and C2 both used `GRAIN_MIN_PX = 96` and both were right to — it kept the character off
every ordinary mark. But **neither stage ever measured at 96.** C2 emitted the character at
260 px and refused it at 24 and 30, which establishes that 96 lies somewhere in an untested gap,
not that 96 is where anything happens.

### The obvious measurement is wrong, and believing it would invert the finding

Rendering the mark with the character at each size and taking the p05–p95 lightness spread
produces a number that RISES as the mark gets smaller. A small mark is nearly all antialiased
edge, and edge pixels blend toward the near-black World, so the spread they contribute swamps
and then impersonates the character.

So the character is isolated **by difference**. At every width the same mark is rendered twice,
with the character and without. Identical geometry, identical edges, identical antialiasing;
the only thing that differs is the noise field. The **interior mask** is taken from the
character-free render — pixels within one 8-bit step of the pure body on all three channels,
i.e. fully covered, no ground mixed in — and the amplitude is read over that mask in the
character render.

| width | interior px @2x | share of object | distinct values | delivered amplitude | % of target | never brighter than body |
|---|---|---|---|---|---|---|
| 24 px | 174 | 56.9 % | 47 | 0.0264 | 82 % | true |
| 30 px | 326 | 64.8 % | 62 | 0.0264 | 82 % | true |
| 40 px | 663 | 76.0 % | 71 | 0.0276 | 86 % | true |
| 48 px | 993 | 78.4 % | 80 | 0.0297 | 93 % | true |
| 56 px | 1366 | 81.5 % | 79 | 0.0287 | 90 % | true |
| 64 px | 1858 | 84.1 % | 79 | 0.0276 | 86 % | true |
| 80 px | 3027 | 86.8 % | 89 | 0.0287 | 90 % | true |
| 96 px | 4418 | 89.5 % | 90 | 0.0295 | 92 % | true |
| 112 px | 6176 | 90.7 % | 94 | 0.0287 | 90 % | true |
| 128 px | 8163 | 91.9 % | 97 | 0.0287 | 90 % | true |
| 160 px | 12952 | 93.5 % | 99 | 0.0285 | 89 % | true |
| 200 px | 20526 | 94.7 % | 102 | 0.0287 | 90 % | true |
| 260 px | 35103 | 95.8 % | 110 | 0.0287 | 90 % | true |
| 320 px | 53441 | 96.5 % | 109 | 0.0287 | 90 % | true |
| 420 px | 93025 | 97.4 % | 110 | 0.0287 | 90 % | true |

**CLASSIFICATION: NOT_A_CAPABILITY_THRESHOLD.**

Nothing fails anywhere in the sweep. The character renders at **every size the Product uses**,
navigation size included, delivering 82–93 % of its accepted amplitude from 24 px to 420 px.
The inherited 96 px constant is therefore **not a capability threshold**, and freezing it would
state a design decision in the grammar of physics.

### Two things the sweep cannot say, checked separately

`feTurbulence`'s `baseFrequency` is in user space, so device pixels per noise feature scale with
device pixel ratio. Every figure in this track is taken at dpr 2. The extremes were re-measured
at **dpr 1 — worse than any shipping phone** — to find where the floor actually is.

| width | dpr | interior px | distinct values | delivered amplitude | % of target |
|---|---|---|---|---|---|
| 24 px | 1x | 4 | 4 | 0.0254 | 79 % |
| 24 px | 2x | 174 | 47 | 0.0264 | 82 % |
| 260 px | 1x | 8424 | 96 | 0.0287 | 90 % |
| 260 px | 2x | 35103 | 110 | 0.0287 | 90 % |

**There it is: at dpr 1 and 24 px the interior collapses to 4 pixels.** A structural floor does
exist — the mark has essentially no body for a material to be made of — but it is below every
shipping device, which is why it cannot carry a production threshold either.

**Determinism.** The field is seeded, so the same mark must rasterise to the same bytes. C2
checked this once at 260 px; a seeded generator that is stable when it has room to work is not
evidence that it is stable when it does not.

| width | dpr | two renders byte-identical |
|---|---|---|
| 24 px | 1x | **true** |
| 24 px | 2x | **true** |
| 260 px | 1x | **true** |
| 260 px | 2x | **true** |

**"Never gleams" is a measurement, not a promise:** the brightest interior pixel equals the
body's own lightness at all 15 widths and all 4 conditions. The character is subtractive by
construction and the raster agrees.

---

## 4. C3.12 — the accepted compositions, rebuilt from the token graph

The compositions are **not redrawn**. They are built by the sealed C2 builders — imported from
the sealed I-08B3.1-C2 package after asserting byte-identity with the copies vendored here — so
the only thing C3 contributes is **where the colours come from**.

Each composition is built twice from one builder: once through `policyMaterials('P2')`,
constants in a module, and once through `tokenMaterials()`, which resolves the DTCG graph and
knows no constants.

| Permission class | model path | token path | token chain |
|---|---|---|---|
| mark | `#a58e6f` | `#a58e6f` | `qandeel.identity.mark -> qandeel.identity.material -> qandeel.expression.material.living-brass.body` |
| identity | `#a58e6f` | `#a58e6f` | `qandeel.identity.moment -> qandeel.identity.material -> qandeel.expression.material.living-brass.body` |
| nav | `#a58e6f` | `#a58e6f` | `qandeel.navigation.machinery -> qandeel.identity.material -> qandeel.expression.material.living-brass.body` |
| functional | `#8b8982` | `#8b8982` | `qandeel.control.functional -> qandeel.content.tertiary -> qandeel.expression.content.tertiary` |

Character tone: token path `#967f60`, accepted `#967f60` — **match**.

| Composition | raster bytes identical | differing pixels | markup identical |
|---|---|---|---|
| PERSONAL CONVERSATION WORLD — "THE QUIET CORE" | **true** | 0 / 2314400 | true |
| LIVING ANALYSIS MAP — "THE PROPRIETARY WORLD" | **true** | 0 / 2314400 | true |
| DEEP ANALYSIS READING — "THE INTELLECTUAL TEST" | **true** | 0 / 2314400 | true |
| UTILITY / SYSTEM UI — "THE BORING-SCREEN TEST" | **true** | 0 / 2314400 | true |
| analytical plane, SELECTED state | **true** | 0 / 2314400 | true |
| analytical plane, PRESSED state | **true** | 0 / 2314400 | true |
| analytical plane, FOCUSED state | **true** | 0 / 2314400 | true |
| analytical plane, DISABLED state | **true** | 0 / 2314400 | true |
| the large identity moment, brushed/handled character | **true** | 0 / 1953600 | true |

### What this proves that is not obvious

**The two paths decide the character by different rules.** C2 decided it by SIZE — the builder
emits the character only at 96 rendered pixels or more. C3 decides it by PERMISSION — the
character belongs to `qandeel.identity.moment` and nothing else, because §3 measured the size
rule and found it is not a capability threshold.

If those rules disagreed anywhere in the accepted compositions the rasters would differ. They do
not. **That agreement is the whole basis on which C3 declines to freeze the number:** replacing
a size rule with a permission rule changes nothing anyone has approved.

---

## 5. The material footprint — an unplanned result, and the strongest one here

Measured off this package's own reproduction rasters. **Ink** is everything above Oklab L
0.3760 — the midpoint between the hairline
`#2a2a2a` and the dimmest ink the Product paints, the disabled carrier `#5a5a58`, so ground and
hairline chrome are excluded. **Chromatic** is everything above Oklab C 0.0334,
the same derived floor the invariants use.

| Composition | chromatic px | ink px | chromatic share of ink |
|---|---|---|---|
| PERSONAL CONVERSATION WORLD — "THE QUIET CORE" | 2109 | 53676 | **3.93 %** |
| LIVING ANALYSIS MAP — "THE PROPRIETARY WORLD" | 2109 | 60166 | **3.51 %** |
| DEEP ANALYSIS READING — "THE INTELLECTUAL TEST" | 2109 | 83866 | **2.51 %** |
| UTILITY / SYSTEM UI — "THE BORING-SCREEN TEST" | 2109 | 31780 | **6.64 %** |
| analytical plane, SELECTED state | 2109 | 60134 | **3.51 %** |
| analytical plane, PRESSED state | 2109 | 60241 | **3.50 %** |
| analytical plane, FOCUSED state | 2109 | 62069 | **3.40 %** |
| analytical plane, DISABLED state | 2109 | 60053 | **3.51 %** |
| the large identity moment, brushed/handled character | 36429 | 37495 | **97.16 %** |

**THE EIGHT PRODUCT SCREENS CONTAIN EXACTLY THE SAME NUMBER OF CHROMATIC PIXELS: 2109.** Not similar — identical, across four environments AND four
interaction states. The material's footprint does not move between a conversation and an
analytical map, and it does not move when an item is selected, pressed, focused or disabled.
The share of ink varies only because the amount of NEUTRAL ink varies, which is the content
doing its work.

That is an **independent** confirmation of state invariance, arrived at from the raster rather
than from the markup guard designed to prove it — and an independent confirmation of C2's
environment ordering, on a different instrument:

- 6.64 % — UTILITY / SYSTEM UI — "THE BORING-SCREEN TEST"
- 3.93 % — PERSONAL CONVERSATION WORLD — "THE QUIET CORE"
- 3.51 % — LIVING ANALYSIS MAP — "THE PROPRIETARY WORLD"
- 2.51 % — DEEP ANALYSIS READING — "THE INTELLECTUAL TEST"

Utility concentrates the material most and Reading dilutes it most, exactly as C2 found and
exactly opposite to what the C2 brief predicted.

### This instrument needed two corrections, and both are recorded

Neither was caught by the code failing. Both were caught by a number being plausible and wrong.

1. **The ink floor was set at Oklab L 0.20** as an eyeballed "above the grounds" line. The frozen
   Surface `#181818` measures **L 0.2090 — above it** — so every Surface pixel was counted as
   ink. The denominator was mostly ground and every share came out three to seven times too
   small.
2. **The chroma threshold was set at the warmest frozen neutral.** But the warmest frozen neutral
   IS the primary reading ink `#d8d5ca`, so its own pixels sat exactly ON the boundary and
   floating-point noise put about half of them on the chromatic side. The conversation screen
   came back as 13.95 % chromatic — roughly four times what a screen carrying six Brass objects
   can possibly be.

Both floors are now derived from frozen constants rather than picked, so they move only if the
system moves.

---

## 6. What this document does NOT establish

- **It is not an aesthetic comparison.** C3.12 is token/spec verification by instruction, and a
  byte-identical raster says the mapping is faithful, not that the design is good. That judgement
  was made in C2 and accepted by the Design Director.
- **It says nothing about any future component tree.** Every invariant here is about the TOKEN
  OUTPUT. A React Native component can always hard-code a colour and no token check will see it.
  `C3_REACT_NATIVE_MAPPING.md` says what would have to be checked there, and says plainly that C3
  does not check it.
- **The chromatic-share figures are a proxy, and a limited one.** The Life Test asks whether a
  screen feels interchangeable with a competent grey utility app. No pixel statistic answers that.
  These figures bound the question; `C3_VISUAL_VITALITY_DIRECTIVE.md` puts it.

