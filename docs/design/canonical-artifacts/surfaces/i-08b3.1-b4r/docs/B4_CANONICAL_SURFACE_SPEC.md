# B4_CANONICAL_SURFACE_SPEC

**I-08B3.1-B4.3.** The canonical Surface specification, in the form it would be frozen in.

**STATUS: FREEZE CANDIDATE. Not frozen.** The Design Director's freeze decision is what makes this
canonical; this document is what that decision would be about.

---

## 1. The frozen values

### 1.1 Carried unchanged from I-08B3.1-A (already CLOSED / FROZEN)

| role | value | token |
|---|---|---|
| WORLD | `#101010` | `qandeel.world.fill` |
| PRIMARY READING | `#d8d5ca` | `qandeel.content.primary` |
| SECONDARY READING | `#afaca3` | `qandeel.content.secondary` |
| TERTIARY NEUTRAL | `#8b8982` | `qandeel.content.tertiary` |

Reproduced, never redefined. B4 has no authority over them and changes nothing.

### 1.2 Proposed for freeze by B4

| property | value | token |
|---|---|---|
| **FUNCTIONAL SURFACE** | `#181818` | `qandeel.surface.functional` → `qandeel.expression.surface` |
| **MATERIAL** | opaque matte | alpha 1, no blur, no backdrop filter |
| **PASSAGE SCRIM — dark expression** | neutral black, alpha **0.50** | `qandeel.role.passage.scrim` → `qandeel.passage.scrim` → `qandeel.expression.scrim` |

`#181818` measures relative luminance **0.009134** against the World's **0.005182** — lighter than
the World, achromatic by construction (r = g = b), and opaque.

---

## 2. The one-tone rule

**APPARATUS, ASIDE, PASSAGE and FIELD all reference the same Surface token.**

```
qandeel.role.apparatus.fill ┐
qandeel.role.aside.fill     ├─→ qandeel.surface.functional ─→ qandeel.expression.surface = #181818
qandeel.role.passage.fill   │
qandeel.role.field.fill     ┘
```

`#181818` exists **once** in the architecture. The rule is enforced structurally, not by comparing
colours — see `B4_TOKEN_ARCHITECTURE.md` §3.

**Nesting adds no tonal step.** An ASIDE raised over a PASSAGE is the same tone as the PASSAGE. The
strongest form of this rule is that there is **no second tone to step to**: exactly one literal
Surface value exists in the whole system, so an elevation function would have a domain and no range.

**ASIDE over PASSAGE** (the N2 case): same tone; **one Class S seam only when the overlap destroys
the boundary**, which B3 found to be scarce — 3,150 px, 0.0602 % of the frame.

**Submenu furniture**: same material, no new Surface role, no tonal step. A submenu is a branch of
the ASIDE that raised it, not a second layer.

---

## 3. What the Surface is told apart by

Not by tone. Each role is told apart by the mechanism B0R froze for it:

| role | told apart by | never told apart by |
|---|---|---|
| APPARATUS | position and adjacency — outside the content plane, along its edge, always there | a lighter tone, a shadow, a card radius, a second page background |
| ASIDE | an anchor to the control or phrase that raised it, plus local occlusion | a scrim, an elevation step, a tone of its own |
| PASSAGE | occlusion, a uniform scrim, and modal **behaviour** | being darker, bigger, or carrying a heavier shadow than an ASIDE |
| FIELD | a Class S structural line on the boundary the user commits across | a filled box, a bright outline on four sides, a card |

---

## 4. The Class S structural boundary

**Frozen by B4:**

- Class S is **load-bearing only**. It marks a boundary something genuinely crosses.
- **≥ 3:1** where WCAG 2.2 SC 1.4.11 applies.
- **1 logical/CSS px** is the proven normal baseline.
- A stronger accessibility expression **may** increase thickness or contrast later.

**NOT frozen by B4, and explicitly not:**

- **The colour.** B1 and B3 used an achromatic diagnostic sufficient for ≥ 3:1. That diagnostic is a
  proof instrument and must not leak into production. The final semantic/accessibility colour belongs
  to **I-08B3.1-E / I-08B3.1-F**.
- **There is no general border token.** Class S is a duty, not a decoration, and a general border
  token would let it be applied because it exists.

---

## 5. Class O organisational edge

**DEFAULT: NONE.**

An organisational edge exists only if it independently passes the Edge Removal Test: remove it, and
something functional must break. It is not a divider, a tidy-up or a texture.

---

## 6. Shadow

**No shadow is required for the canonical Surface distinction, and B4 creates no shadow token.**

There is no Surface-elevation shadow scale and no identity shadow. A future component-specific
shadow may exist for a separately justified platform interaction; the B-track provides no token for
it and no precedent.

The anti-cardification guard's rule **C1** rejects any box-shadow outside the diagnostic focus
indicator, and it fires on all four of the sealed predecessor's cardification captures.

---

## 7. Radius

**No Product-personality radius is frozen.** Corner radius remains component- and context-specific.

> Corner radius is not personality.

The token file deliberately does not supply `--radius`. The integration render keeps it at the B3
diagnostic value in **both** variants, which is this rule in executable form.

---

## 8. What the Surface may never do

- **No chromatic Surface family.** Achromatic, r = g = b. INV-04.
- **No Surface elevation ladder.** INV-07, INV-10.
- **No darker-than-World Surface family.** A Surface darker than its ground is a hole and separates
  by a mechanism the B-track does not have. INV-05.
- **No role-specific tone.** INV-01, INV-02.
- **No analytical meaning.** A Surface may not encode confidence, evidence, importance, recency or
  FAR/MID/NEAR. INV-08, and SG-1 before it.
- **No brand accent controlling it.** INV-09.
- **No translucency.** Retired from the B-track. INV-11.

---

## 9. Reduce Transparency

**The canonical B-track Surface truth is unchanged by Reduce Transparency, and requires no code.**

The Surface is opaque matte, so the transform is the identity on it — there is nothing to undo.
Proven twice: INV-11 at the token layer (every Surface token alpha 1; the only alpha in the system is
the scrim chain), and by B3 at the pixel layer (0 of 5,235,264 pixels changed).

`AccessibilityInfo.isReduceTransparencyEnabled()` is **iOS-only**
(`B4_REFERENCE_GATE.md` §8). This is the rare case where a platform capability requires no branch,
and the reason is written down so nobody later adds one to be safe.

---

## 10. The PASSAGE scrim, as verified

The selected **neutral black at alpha 0.50** was verified in the accepted B3 PASSAGE contexts. Not a
search: one value, tested against predictions computed from CSS Color 4 alpha compositing **before**
anything was rendered.

| measurement | predicted | measured |
|---|---|---|
| World fill, live | `#101010` | `#101010` |
| World fill, suppressed | `#080808` | `#080808` |
| APPARATUS fill, live | `#181818` | `#181818` |
| APPARATUS fill, suppressed | `#0c0c0c` | `#0c0c0c` |
| PASSAGE fill (foreground) | `#181818` | `#181818` |

**5 of 5 exact.** Full results and reasoning in `B4_VALIDATION_RESULTS.md` §4.

Two consequences worth stating here:

1. **The Surface is stable where it is foreground and suppressed where it is World.** The PASSAGE's
   own fill stays `#181818`; the APPARATUS behind the scrim composites to `#0c0c0c`. That is not an
   inconsistency — it is the scrim doing exactly what it is for. The APPARATUS is part of the
   suspended World.
2. **Background legibility is not a pass criterion.** Reading behind the scrim falls from 12.95:1 to
   3.75:1. The World behind a PASSAGE is suspended, so text still legible there is not a benefit and
   text that is not is not a defect. This is the Design Director's D-5 direction, measured.

---

## 11. Deferred, named, and not frozen here

| item | owner |
|---|---|
| Class S final **colour** | I-08B3.1-E / F |
| Focus indicator token | I-08B3.1-E / F |
| Interaction and status colours | I-08B3.1-E |
| Accessibility alternate expressions (increased contrast) | I-08B3.1-F |
| Light appearance values | I-08B3.1-F / later theme work |
| Living Brass | I-08B3.1-C |
| QANDEEL Light | I-08B3.1-D |
| Component-specific radii and any justified component shadow | component work |
| Screen-reader behaviour of the four roles | open dependency D-6 |
| Native `accessibilityRole` mapping for the ASIDE patterns | open dependency D-7 |
