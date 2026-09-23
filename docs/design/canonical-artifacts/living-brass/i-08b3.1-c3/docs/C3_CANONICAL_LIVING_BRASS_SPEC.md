# C3_CANONICAL_LIVING_BRASS_SPEC

**I-08B3.1-C3.1 / C3.2.** The material itself, as a production specification.

**Nothing here is canonical until the Design Director freezes C.** Every value below is *eligible for
freeze* and is written in the form it would take if frozen.

---

## 1. THE BODY

```
LIVING BRASS — BODY
#A58E6F
```

| | |
|---|---|
| authored as | `oklch(0.660 0.052 75)` |
| resolves to | `#a58e6f` — in gamut, unclipped |
| measured | Oklab **L 0.6595 · C 0.0516 · H 74.95°** |
| contrast on the World `#101010` | **6.070 : 1** |
| contrast on the Surface `#181818` | **5.664 : 1** |
| provenance | C0R → C1 → C1R → C2; selected by the Independent Design Director at the close of C2 |

**There is exactly one Living Brass value in QANDEEL.** Every identity and navigation-machinery name
in the token architecture reaches it through an alias chain, and nothing else in the system carries
this literal. That is not a style preference — it is what makes "there is one body" a property a build
can test (invariant **I-01**), rather than a convention someone maintains.

### 1.1 The value is authored in sRGB, and the OkLCh triple is ALSO a production input

The token stores **sRGB** as the value it paints with. An OkLCh token would be re-converted by every
consuming resolver, and a resolver whose matrix or rounding differs by half a step emits `#a58e70`
while reporting success — a colour nobody approved, shipping under the name of one they did. The
accepted evidence is 8-bit: every raster, every contrast figure, every measurement in C1R and C2.

**But the authored triple is not decoration.** It is the derivation source for the character tone —
see §3.3, where the distinction has consequences that no colour comparison would catch.

### 1.2 What the body does NOT encode

selection · pressed · focus · hover · disabled · unread · status · success · warning · confidence ·
evidence · recency · analytical importance · FAR / MID / NEAR · premium entitlement.

> **BRASS IS MATTER. LIGHT IS MEANING. ACTIVITY IS PROCESS.**

---

## 2. THE MATERIAL AT ORDINARY AND SMALL SCALE — QUIET SATIN

**One flat tone.**

No grain. No texture. No gradient. No second tone. No bevel. No emboss. No gloss. No ramp. No
reflection. No specular response. No jewellery polish.

This is what a Living Brass object **is**, unless it is the one composition that has been granted the
character in §3. A navigation icon at 24 px, the canonical Q in the standing machinery at 30 px, and
any future identity-bearing mark at ordinary scale are all quiet satin, painted with the body and
nothing else.

**The quiet satin body is the whole material at every size the Product routinely draws.** §3 is the
exception, and it is meant to feel like one.

---

## 3. THE MATERIAL AT A LARGE IDENTITY MOMENT — BRUSHED / HANDLED CHARACTER

The **same body**, carrying a restrained directional character. The moment is *larger*, never
*brighter*.

### 3.1 The behaviour, specified as algorithmic intent

Specified as behaviour and not as an exported bitmap, so that it is reproducible at any size on any
renderer, and so that a future implementation is bound by what the material *does* rather than by one
image of it.

| | value | what it is |
|---|---|---|
| amplitude | **0.032** Oklab L | the peak-to-trough lightness excursion the character delivers |
| frequency along the grain | **0.0035** | in the mark's own user space |
| frequency across the grain | **0.040** | — |
| octaves | **2** | enough for a handled surface, too few for visual noise |
| seed | **11** | the field is seeded, therefore deterministic |
| coverage gain | **1.8** | the linear map from the noise field to the darker tone's coverage |
| coverage bias | **−0.72** | — |
| tone depth ratio | **0.63** | the fraction of the tone's full depth that survives the coverage map |

**The anisotropy is the whole of the "brushed".** The frequency along the grain is roughly a
*tenth* of the frequency across it. That is what makes the field directional rather than speckled,
and it is the single parameter that must not be "tidied" toward isotropy.

**The coverage map is one channel, one gain, one bias, no transfer curve** — so the delivered
amplitude is the product of two numbers and can be reasoned about instead of tuned by eye.

> The two coverage numbers are deliberately **not** called `alpha`. They land in an alpha channel in
> the SVG implementation, and naming them after that put a token called `material…alpha` into a system
> whose single most important prohibition is that the material has no opacity ladder. Invariant I-09
> fired on it, correctly. The name was changed rather than the check taught an exception.

### 3.2 SUBTRACTIVE-ONLY — the load-bearing constraint

**The character may only darken from the body.** No pixel it produces may be lighter than the body.

This is what makes **BRASS NEVER GLEAMS** a property of the construction rather than a promise about
taste. It is measured, not asserted: across fifteen rendered widths and four device-pixel-ratio
conditions, the brightest interior pixel equals the body's own lightness exactly, every time.

### 3.3 The darker tone is DERIVED, and the derivation source is part of the specification

The tone is **not stored as a colour token**. Storing it would create a two-value Brass ladder, and a
two-value ladder is how a five-value ladder starts. Invariant **I-10** forbids it and probes for it.

```
tone = oklch( L_authored − (amplitude / toneDepthRatio),  C_authored,  H_authored )
     = oklch( 0.660 − 0.050794, 0.052, 75 )
     = #967f60
```

**Derive it from the authored triple, not from the 8-bit body.** The two disagree:

| derivation source | result |
|---|---|
| the **authored** OkLCh triple — *the specification* | **`#967f60`** — the tone every accepted C1R and C2 raster was made with |
| the 8-bit sRGB body `#a58e6f` — *the obvious choice* | `#957f60` — one step darker in red |

Quantising the body to 8 bits costs 0.00047 of lightness, and the subtraction carries that loss
forward. **No colour test would catch the difference, because both values are plausible Brass.** An
implementation that takes the obvious route produces a character nobody approved at the one
composition where the material is allowed to have character at all.

Invariant **I-21** asserts both halves: that the specified route reproduces the accepted tone, and
that the obvious route does not.

### 3.4 Never

no glow · no highlight · no metallic ramp · no specular response · no gradient · no bevel · no emboss ·
no gloss · no reflection · no jewellery polish.

---

## 4. THE SCALE CONTRACT

### 4.1 What C3 was asked

> *"Define a scale threshold as an IMPLEMENTATION RULE only if evidence supports a stable one. Do not
> invent one merely for convenience. If the C1/C2 threshold remains proof-specific: freeze the
> principle and leave component threshold to integration."*

### 4.2 The evidence was gathered, and it does not support one

C1R and C2 both used `GRAIN_MIN_PX = 96`. **Neither ever measured at 96.** C2 emitted the character
at 260 px and refused it at 24 and 30 — which establishes that 96 lies somewhere in an untested gap,
not that 96 is where anything happens.

C3 measured the character at fifteen widths from 24 px to 420 px, isolating it from antialiasing by
rendering identical geometry with and without it. The full table is in
`C3_VALIDATION_RESULTS.md` §3. The result:

**The character delivers 82–93 % of its accepted amplitude at every width, navigation size included.
There is no knee.**

A structural floor does exist — at **device pixel ratio 1 and 24 px the fully-covered interior
collapses to four pixels**, and a material character has nowhere to live — but that is below every
shipping device, so it cannot carry a production threshold either.

### 4.3 THE FROZEN RULE: PERMISSION, NOT SIZE

```
The brushed/handled character belongs to  qandeel.identity.moment  and to nothing else.
Entitlement is by PERMISSION CLASS, never by pixel width.
```

`96 px` is recorded in the token file as `character.scale.proofEraConstant` — **recorded, not
frozen.** A component-level threshold, if integration wants one, is owned by integration and must be
argued on its own evidence.

### 4.4 The uncomfortable consequence, stated rather than buried

**Because the character renders correctly at 24 px, a size rule will not stop anyone putting it on
the navigation family — and it would look good.**

Nothing physical prevents the accumulation failure that C2's F06 capture demonstrates. Only the
permission does. A specification that implied otherwise would be lending the authority of physics to
a design decision, and the first implementer to test it at small size would discover the rule was
never load-bearing.

This is why the iconography contract grants material **by class**, and why the token architecture has
no per-component character switch to reach for.

---

## 5. What this specification does NOT cover

- **QANDEEL Light.** Reserved namespace, empty, owned by D. The material is matter; Light is meaning.
- **A light-appearance Brass.** No value exists and none is derived. A light Brass is not a lighter
  Brass — the body was selected against a near-black World on evidence gathered entirely in the dark,
  and the coverage policy was never tested on a light ground. Resolving the light appearance leaves
  every Living Brass name **unresolved and named**, by design (invariant **I-13**).
- **Interaction state expression, status colours, focus and disabled treatment.** Reserved namespaces,
  empty, owned by E.
- **Final navigation or tab design, geometry, motion, or icon shapes.** Owned by later Product/UI
  integration. This specification grants **material**, never **form** and never **placement**.
