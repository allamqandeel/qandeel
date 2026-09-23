# I-08B3.1-F2 — TOKEN ARCHITECTURE AND THE FREEZE BOUNDARY

> **Extend the frozen role system rather than creating a parallel palette.** — §26

## F2 creates no semantic role

Every role a light value is supplied for already existed. §27 offers example names —
`world.background`, `surface.functional`, `content.primary`, `identity.brass`, `meaning.light`,
`semantic.error` — and says not to use them if canonical equivalents exist. **They do**, and they
are used instead:

`qandeel.world.fill` · `qandeel.surface.functional` · `qandeel.content.{primary,secondary,tertiary}`
· `qandeel.passage.scrim` · `qandeel.identity.material` · `qandeel.illumination.{core,mid,low}` ·
`qandeel.status.error.ink` · `qandeel.state.disabled.ink`

## The structure was inherited, not invented

I-08B3.1-B4R separated the SEMANTIC layer from the EXPRESSION layer before a light appearance was on
anyone's list:

> *"Appearance-independent: it names what things ARE, never what they look like. Colours live in the
> expression layer that an appearance set supplies."*

And three inherited resolvers already carry an `appearance` modifier whose `light` context is an
**empty set with an owner named on it**:

| package | what its empty light context says |
|---|---|
| **B4R** | *"DELIBERATELY EMPTY… the light expression has not been designed… Owned by I-08B3.1-F."* |
| **C3** | invariant I-13 — *"a light expression that returned the dark body would be a value nobody designed, shipping under a name someone trusted."* |
| **D2R** | *"light is owned by later work and resolving into it fails loudly rather than returning a colour nobody designed."* |
| **E1** | *"DELIBERATELY EMPTY, AND THE EMPTINESS IS THE DELIVERABLE… THE DARK ERROR VALUE CANNOT SIMPLY BE REUSED."* |

**F2 fills four declared-empty contexts and adds one modifier the chain did not have.**

## What F2 ships

```
tokens/
  base/appearance.tokens.json                       THE APPEARANCE LAW — no colour in it at all
  appearance/dark/f2.dark.illumination-technique…   ONE NAME, NO VALUE MOVED
  appearance/light/b4r.light.tokens.json            World, Surface, the reading ramp, the scrim
  appearance/light/c3.light.material.tokens.json    Living Brass
  appearance/light/d2r.light.illumination…          QANDEEL Light, the bloom shape, the atmosphere
  appearance/light/e1.light.interaction…            Error, Disabled
  appearance/light/f1.light.accessibility…          the atmosphere's three layer lightnesses
  contrast/light.increased.tokens.json              increased contrast IN LIGHT
  transparency/light.reduced.tokens.json            reduce transparency IN LIGHT
  (the resolver is tools/f2-resolve.mjs)
```

**Nothing in `tokens/base/appearance.tokens.json` is a colour**, and that is the test of whether a
statement belongs in the appearance-independent layer: *a contract that resolved to a colour would
be a contract about one appearance.* Its entries are strings, numbers and durations — the law,
the chroma order, the hue tolerance, the ratio rule, the suppression rule, the switch contract, the
system-appearance decision, the Light World's lightness, the source requirement, the
not-reduced requirement, the dark-is-frozen requirement, the status-colour policy and the
centralisation requirement.

## The one name F2 adds to the dark appearance

`qandeel.expression.illumination.technique` = `"additive-over-ground"` in dark,
`"signed-bloom"` in light.

It moves no dark value and contains no colour. It exists because §28 forbids
`if dark → X else → Y` scattered through Product logic — **a system with that shape has as many
appearance decisions as it has call sites and no way to check any of them.** The renderer reads the
token and dispatches on it. Check **A-02** asserts that none of the names F2 adds is a Product role.

## The three-way classification

§26 requires PRODUCT CONTRACT to be distinguished from PRODUCTION DEFAULT / TUNABLE CRAFT and from
IMPLEMENTATION STRATEGY. Check **K-01** walks every value F2 authors and requires a class **and a
stated reason**, with every non-contract value naming what it `serves`.

| class | count | what it means |
|---|---|---|
| **product-contract** | 16 | a statement about the Product that a later package may not quietly move |
| **production-default** | 29 | a searched or measured calibration on one renderer, tunable on evidence |
| **implementation-strategy** | 3 | how a contract is currently met, re-openable by a better way |

**Exact calibration values do not become Product law because a prototype used them.** Every colour
F2 ships is a production default; every contract is a sentence.

Examples of the boundary:

| contract | the default that serves it |
|---|---|
| `meaning-has-a-source` — at peak the event is lighter than its ground | the Light World's lightness 0.95; the three Light stops; the bloom's split, gain and width |
| `hierarchy-is-a-ratio` — the reading ratios are preserved | the three light ink hexes; the Surface hex |
| `suppression-is-subtraction` — the scrim darkens in both appearances | the scrim's alpha 0.532; the computed opaque `#706f6e` |
| `hue-constancy` — 3° | Light Brass `#7a6446`; Light Error `#ad4739` |

And the two classified as **implementation-strategy** are the two meaning-light techniques plus the
centralisation requirement's mechanism — *how* the contract is met, chosen by a measured search and
re-openable by a better one.

## The literals F2 introduces, counted

**Twelve expression literals for the light appearance, plus one computed opaque scrim.** Check
**K-03** asserts the count and asserts that the computed one *is* the composite it claims to be.

Compare: **I-08B3.1-E1 added exactly one colour and said so. I-08B3.1-F1 added none.** F2 adds a
second appearance, which is the one kind of work that legitimately requires new literals — and it
requires exactly as many as the frozen chain has appearance-dependent roles, which is the definition
of adding no new *role*.

## The resolver

```
BASE (appearance-independent)
  b4r/semantic · c3/base · d2r/base · e1/base · f1/base · f2/base
MODIFIER appearance   { dark | light }      ← the one F2 adds; default DARK, inherited not chosen
MODIFIER contrast     { standard | increased }   per-appearance
MODIFIER transparency { full | reduced }         per-appearance
```

`resolveAll()` **with no options must return exactly the tree I-08B3.1-F1 returns**, token for
token and literal for literal — not "the same values", the same tree, produced by loading the same
files in the same order. A light value that leaked into the default would change a literal and be
caught by **A-01** before any raster is drawn.

**The accessibility modifiers are per-appearance, and the split is smaller than it looks.** The
increased-contrast and reduce-transparency files F1 wrote are loaded for **both** appearances; the
light contexts add one small file each.

## The rule an appearance may not break

```
FORBIDDEN_REROUTE = 'an appearance set may supply expression VALUES and may never change an alias ROUTE'
```

Check **P-02** walks every alias chain in both appearances and compares them as strings. If an
appearance could re-point a role, *"the same semantics in both appearances"* would be a promise
instead of a graph.

Apple's Color guidance says the same thing from the other side: *"Avoid redefining the semantic
meanings of dynamic system colors."*

## Tokens and the derivation cannot drift

`tools/f2-tokens.mjs` binds **28 authored token values** to the place in `data/F2_DERIVATION.json`
each comes from, and **checks** rather than generates:

> The obvious way to keep a token file in step with a derivation is to generate it. That would make
> the agreement true by construction and therefore worth nothing. The token files are **authored** —
> they carry the Product's reasoning, its freeze classification and its prose, and those are not
> derivable from arithmetic — and the tool asserts that every value in them is the value the
> derivation reached. Check **K-02**.

And `tools/f2-consistency.mjs` goes further, because a value can agree while the sentence describing
it does not: **every `oklch(L C H)` quoted anywhere must match the hex nearest it.** That claim
caught three drifted triples in this very file's sibling, after the search moved.
