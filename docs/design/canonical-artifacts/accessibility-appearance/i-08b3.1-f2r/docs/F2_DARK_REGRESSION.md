# I-08B3.1-F2 — THE DARK-REGRESSION GATE

> **F2 IS AUTHORIZED TO CREATE LIGHT. F2 IS NOT AUTHORIZED TO "NORMALIZE" DARK.** — §21

## Result

**PASS.** 13 values · 28 routes · 5 accessibility states · 1 raster · 5 probes.

The accepted Living Analysis World raster — sha256 **`0a8cb8e0c2ecaf2d9e228392`**, the value
I-08B3.1-F1, F1R and F1R2 all shipped — **re-renders byte-identically.**

## Why the gate is built the way it is

The usual way a second appearance damages the first is not vandalism. It is **unification**.

A value nudged so one token can serve both appearances. A ramp flattened so one formula works in
both directions. A scrim softened so the same alpha reads on both grounds. Every one of those is
described afterwards as *consistency*, and every one of them is a Product change nobody decided.

So this gate **does not compare F2's idea of dark against F2's idea of dark.**

> It re-runs **I-08B3.1-F1's own resolver over F1's own token files** and re-renders **F1's own
> scene with F1's own scene builder**, all vendored byte-exact, and compares the result to the
> raster F1 shipped. **F2's code is not in that path at all.**

A gate that only compares F2 against F2 is a gate against nothing — which is the lesson
I-08B3.1-F1R had to learn about its own ablation, and the reason the inherited package's own code is
carried here rather than its numbers.

## Four layers, because they fail differently

### 1 — VALUES · 13/13

Every frozen dark literal, resolved through F1's chain, against the record:

| token | expected |
|---|---|
| `qandeel.world.fill` | `#101010` |
| `qandeel.surface.functional` | `#181818` |
| `qandeel.content.primary` | `#d8d5ca` |
| `qandeel.content.secondary` | `#afaca3` |
| `qandeel.content.tertiary` | `#8b8982` |
| `qandeel.identity.material` | `#a58e6f` |
| `qandeel.illumination.core` | `#fbf2db` |
| `qandeel.illumination.mid` | `#e8ddc2` |
| `qandeel.illumination.low` | `#d6caa9` |
| `qandeel.status.error.ink` | `#fe907e` |
| `qandeel.state.disabled.ink` | `#696762` |
| `qandeel.passage.scrim` | `#000000` |
| `qandeel.passage.scrim` alpha | 0.5 |

> **THESE THIRTEEN ARE TYPED, AND IT IS THE ONLY PLACE IN F2 WHERE A QANDEEL COLOUR IS TYPED RATHER
> THAN RESOLVED.** A gate whose expected values are read from the same tree it is checking has no
> opinion — it would pass whatever the tree said. The expected side of a regression gate has to be
> independent of the thing under test, so it is transcribed from the Product record, and a
> transcription error fails the gate rather than hiding in it.

### 2 — ROUTES · 28/28

Every name F1 resolves, compared to F2's **dark** resolution by **value AND by chain**. A value can
be right by a new route, and a re-pointed role is a Product change that no colour comparison would
ever see.

### 3 — STATES · 5/5

All five I-08B3.1-F1 accessibility states, not just the default: DEFAULT, INCREASED CONTRAST, REDUCE
TRANSPARENCY, CONTRAST + TRANSPARENCY, and STANDARD + FULL restated. **A default-only gate is
satisfied by a package that changed only the overrides.**

### 4 — PIXELS · 1/1

F1's default Living Analysis World, re-rendered by F1's own builder, compared to the accepted raster
byte for byte.

## The five planted probes

| probe | rejected |
|---|---|
| a World **normalised** from `#101010` to `#121212` — the single most likely real regression | yes |
| the identity mark **re-pointed** straight at the body: same colour, one hop shorter | yes |
| the increased-contrast far-layer lightness moved **in a non-default state only** | yes |
| the scrim **alpha** softened 0.5 → 0.45 with the ink unchanged | yes |
| the same scene with the World lifted `#101010` → `#111111`, compared to the accepted raster | yes |

The second is the one worth dwelling on: it changes **no pixel**. Only the route comparison can see
it, and only because the chain is compared as a string.

The fourth is the one a value-only comparison misses: the ink stays `#000000` and the alpha is a
separate field.

## What F2 added to the dark appearance, and why it is not a regression

**One name, no value.** `qandeel.expression.illumination.technique` = `"additive-over-ground"`.

The meaning-light technique never had to be named while there was only one — it lived in the
renderer as the renderer's only behaviour. The moment two exist, the choice between them is a
Product fact that belongs in the token tree where it can be resolved, inspected and checked, because
§28 forbids `if dark → X else → Y` scattered through Product logic.

**Check A-01 states this rather than being silent about it:** it asserts that every name
I-08B3.1-F1 has resolves to exactly the literal F1 resolves it to, and lists the names F2 adds
alongside, with an assertion that none of them is a Product role.

> **A-01 WAS A CHECK THAT COULD NOT FAIL, AND ITS PROBE IS WHAT GAVE IT AWAY.** The first version
> compared `flat.get(name).value` between the two trees — but for a semantic name that value is the
> alias string `{qandeel.expression.world}`, which is identical in every appearance by construction.
> The check compared two copies of the same alias and reported agreement; its probe, which
> substituted the **light** tree, reported agreement too. It now resolves through the full chain to
> the literal.
