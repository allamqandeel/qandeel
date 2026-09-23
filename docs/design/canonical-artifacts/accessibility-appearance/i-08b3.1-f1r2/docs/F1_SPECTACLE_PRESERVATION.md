# I-08B3.1-F1 — THE SPECTACLE PRESERVATION GATE

The Product Owner's non-negotiable is §0: accessibility work must not reduce the quality,
richness, glow, depth or visual spectacle of the Living Analysis World in its normal expression.

This gate has **two halves that must not be confused**, and confusing them is how a package
would pass it dishonestly.

---

## HALF ONE — did F1 weaken the default?

This is the gate the brief actually sets, and it is **mechanical**.

### D-01 — the token tree

With **no accessibility setting on**, every inherited role resolves to **I-08B3.1-E1's literal
by E1's route**. Comparing values alone would pass a token that reached the same colour by its
own path, so the check compares the **chain**. 23 roles, **0 differences**.

### D-02 — THE ABLATION

Every accessibility override file is replaced with an **empty stub** and the default document is
rendered again.

| | |
|---|---|
| default HTML sha256 | identical |
| default PNG sha256 | **identical** — `0a8cb8e0c2ecaf2d…` |

If any accessibility value had leaked into the default path — a contrast value read
unconditionally, a motion scalar consulted where it should not be — **removing the override
files would change the default**, and the hash would say so.

> A check that merely rendered the default twice would pass no matter how badly the default was
> contaminated, because it would be contaminated identically both times. The ablation is the
> version with teeth, and it is why §6's "accessibility code paths must be conditional" is a
> measurement here rather than a promise.

### D-03 — the structural reason it holds

Every accessibility modifier's **default context declares zero token values**. The default path
resolves through none of them. There is nothing to leak.

**ANSWER: DEFAULT VISUAL RICHNESS DID NOT CHANGE. Byte-identical, proved by ablation.**

---

## HALF TWO — does the system retain the CAPACITY for the North Star's level of awe?

This is **not** a gate F1 can pass or fail by changing something, and pretending otherwise would
be the dishonest move available here. So this half **measures the distance** and hands the number
up.

The Product Owner's North Star image was decoded and compared against the default render, on the
dimensions §13 names.

| dimension | North Star | current default | ratio | kind |
|---|---|---|---|---|
| mean chroma | 0.0353 | 0.0004 | ×88.25 | policy + framing |
| 95th-percentile chroma, **whole frame** | 0.0727 | 0.0016 | ×45.44 | **framing** |
| **95th-percentile chroma, PAINTED PIXELS ONLY** | **0.0730** | **0.0516** | **×1.41** | **POLICY** |
| share of chromatic pixels (C > 0.02) | 0.7805 | 0.0017 | ×459.12 | framing |
| 10° hue bins occupied | 36 | 3 | ×12 | framing + policy |
| lightness range p05–p95 | 0.3587 | 0.0360 | ×9.96 | framing |
| spatial detail (mean \|ΔL\| between neighbours) | 9.765 | 2.625 | ×3.72 | framing + density |

### The decomposition is the result

**The headline ratios are mostly a crop.** The North Star is a full-bleed 1920 px landscape in
which six worlds fill the frame; the capture is a 390 pt phone screen showing **one** world on a
deliberately quiet ground. Reading ×459 as a policy failure would be reading a crop.

**Among the pixels that are actually painted, the gap is ×1.41** — and that is the surprising
one. **QANDEEL is not a desaturated product.** Its painted 95th-percentile chroma is 0.0516,
carried by **Living Brass at C 0.0516** and the **error ink at C 0.1364**, which is more chroma
than the North Star reaches at its own 95th percentile.

**The real, narrow, policy gap is in the ATMOSPHERE.**
`qandeel.atmosphere.chroma-ceiling` = **0.0197** against a North Star 95th percentile of
**0.0727** — **×3.69**.

So the honest statement is not *"QANDEEL is too quiet."* It is:

> **QANDEEL's WORLD is 3.69× quieter than the reference image, by a deliberate semantic
> decision, while its identity material and its status colour are not quiet at all.**

### And that decision is not F1's

The ceiling is I-08B3.1-D2R's, derived at **0.62 of the minimum chroma of the three QANDEEL LIGHT
stops** so that ATMOSPHERE could never compete with LIGHT. It is a **semantic separation**, not a
taste preference. Raising it is a D-track and Product question, and F1 is forbidden from touching
it.

### The dimension that is neither crop nor ceiling

**Density.** The North Star draws thousands of points; this map draws **eight topics** with
three, two and one level line, and the measured spatial-detail gap is **3.72×**.

No token in any package constrains density. **I-08B3.1-F1R withdraws what F1 then said about
that.** F1 called density "the cheapest available route toward the North Star's level of
richness", which reads as though the absence of a prohibition were an authorisation to raise it.

> **ABSENCE OF A PROHIBITION IS NOT PRODUCT AUTHORITY. IT IS NOT A PERMISSION.**

Nothing in the frozen record grants density to anyone, and F1 has no standing to grant it. What
may be said is narrower and true: **F1 imposes no ceiling on density**, so whatever the Product
later decides about it, no accessibility expression in this package has to change. Deciding it is
G's and Product's, and it is carried forward as an obligation rather than as a suggestion.

---

## What F1 guarantees about the capacity — and what it does not

**F1 NEITHER REDUCES NOR CAPS THE CAPACITY**, and two independent proofs stand behind that rather
than a promise:

- **DEFAULT ACCESSIBILITY-OVERRIDE ISOLATION** (D-02) — every accessibility transformation is an
  override in a modifier context whose default overrides nothing; the default path resolves
  through none of them; emptying every override file leaves the default document byte-identical.
- **INHERITED-DEFAULT NON-REGRESSION** (I-01 / I-02 / I-03) — the inherited atmosphere layer's
  every written attribute equals what I-08B3.1-D2R's own exported functions produce, and its
  raster is **pixel-identical** to a reference page built from those functions with no F1 code in
  it at all.

And the forward-compatibility is structural rather than incidental: if the Product raises the
chroma ceiling or the field's density tomorrow, **every expression in this package follows it
without one token changing** — because not one of them names a chroma, and the increased-contrast
derivation is a **search over whatever the ceiling then is** rather than a set of values copied
out of today's one.

### What is NOT proven, and F1R says so plainly

**THE NORTH STAR SPECTACLE CAPACITY IS NOT PROVEN BY THIS PACKAGE.** F1 measured the distance on
seven dimensions and decomposed it honestly into framing, policy and density. It did not
demonstrate that the final default dark Living Analysis World can *reach* the Product Owner's
required level of awe, and nothing here should be read as demonstrating it.

The North Star remains the **SPECTACLE / RICHNESS NORTH STAR** at full strength. It is neither
weakened nor met. The obligation is **OPEN** and it belongs to:

> ### G — INTEGRATED PRODUCT PROOF
>
> G must prove that the final default dark Living Analysis World reaches the Product Owner's
> required level of **world-scale awe**, **atmospheric richness**, **colour richness**, **spatial
> depth**, **authored micro-detail**, **discovery** and **meaningful luminous impact** — while
> preserving all frozen semantic truth.
>
> **If G cannot achieve that spectacle within the frozen I-08B3.1-D contract, THEN and only then
> a TARGETED D reconciliation may be required.** F1R does not reopen D, does not propose
> reopening it, and does not treat the measurements above as grounds for it.

---

## The board

`review/board/b01-default-spectacle.png` shows the normal full-expression Living Analysis World
after F1, in all three worlds. It is what the invariance above protects — and its caption carries
the North Star numbers rather than an adjective.
