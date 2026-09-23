# I-08B3.1-F1 — TOKEN ARCHITECTURE

## 1. One resolution over five systems

```
B4R Surface  →  C3 Living Brass  →  D2R QANDEEL Light  →  E1 interaction + status  →  F1 accessibility
```

F1 **extends** that chain rather than standing beside it. That is the only way the law can be
*checked* rather than asserted: *"an accessibility setting changes representation and nothing
else"* is a statement about **reachability in a graph**, and it is only that if the overrides and
the things they must never reach are in the **same graph**.

`tokens/qandeel-accessibility.resolver.json`, DTCG 2025.10.

## 2. The modifiers

| modifier | default | other context | owned by |
|---|---|---|---|
| `appearance` | `dark` | `light` — **empty; resolving into it fails loudly** | I-08B3.1-F2 |
| `contrast` | `standard` — *empty by design* | `increased` | **F1 fills the context B4R declared** |
| `transparency` | `full` — *empty by design* | `reduced` | **F1** |

B4R declared the `contrast` modifier and left `increased` empty with a note assigning it to
I-08B3.1-F. **F1 fills it, for the dark appearance only.**

### Three settings deliberately do NOT appear as modifiers

- **Reduced Motion** resolves to no colour. Its tokens are plain scalars in the base set, because
  a colour resolver that owned motion would be the authority on something it cannot check. The
  motion contract is proved by **rendering frames**, not by resolving a tree.
- **Larger / Bold Text** resolve to no colour either. They change metrics and layout, and their
  proof is a rendered page at ×3.118.
- **Grayscale / Invert** are **diagnostics**, not target expressions — display-level transforms
  the OS applies after the app has drawn.

## 3. The default context overrides nothing, and that is checked

Every accessibility modifier's default context declares **zero token values** — check **D-03**.
`transparency/full.accessibility.tokens.json` is deliberately empty **and deliberately present**:
B4R's own form, copied on purpose so a reader who knows one recognises the other.

## 4. What F1 authors

**56 token values across five files** — 41 base, 4 dark appearance, 7 increased contrast, 0 in
the deliberately-empty `full` transparency context, 4 reduced transparency. By family:

| family | count | what it carries | freeze class |
|---|---|---|---|
| `accessibility.motion.*` | 10 | which channels survive Reduced Motion, plus the requirement and the current strategy | 9 product-contract, 1 implementation-strategy |
| `accessibility.contrast.*` | 5 | the boundary, the unmoved ground, the ceiling, two magnitudes | 3 product-contract, 2 production-default |
| `accessibility.transparency.*` | 5 | the scrim, the field, the alpha mode, the Light's floor (declared twice, on purpose) | product-contract |
| `accessibility.text.*` | 7 | the Arabic no-clipping contract and the selected-step rule, plus five calibration numbers | 2 product-contract, 5 production-default |
| `accessibility.nonColorCue.*` | 6 | the companion channel each **meaning-bearing** distinction ships with | product-contract |
| `accessibility.presentationCraft.*` | 1 | visual craft that carries **no** analytical meaning | production-default |
| `accessibility.projection.*` | 8 | the screen-reader contract: `derivation`, `completeness`, `disclosure-boundary` and the rest | 7 product-contract, 1 implementation-strategy |
| `expression.accessibility.atmosphere.*` | 10 | the derived layer lightness and alpha mode, per context | 7 production-default, 3 product-contract |
| **overrides of inherited roles** | **4** | `analysis.relation`, `control.functional`, `state.focus.thickness`, `expression.scrim` | 3 product-contract, 1 production-default |

## 4.1 Three freeze classes, because two were not enough

I-08B3.1-F1 had two, and froze library technique at the same height as Product meaning. The
independent review was right; the third class is the repair.

| class | meaning | count |
|---|---|---|
| **`product-contract`** | **what the product MEANS** under a setting. Changing it changes the product. A reviewer freezing this package freezes these. | **38** |
| **`production-default`** | **tunable craft.** A number measured on one viewport, with one face, at one density. It is expected to move. | **16** |
| **`implementation-strategy`** | **the current technique** for meeting a requirement with today's libraries. Correct now, not the contract, expected to be replaced. | **2** |

Every `production-default` and every `implementation-strategy` token **names the
product-contract requirement it serves**, in `$extensions["com.qandeel.freeze"].serves`. Check
**K-02** rejects one whose `serves` names a token that does not exist or is not itself a contract,
so the link is verified rather than asserted.

**One token declares `serves: null`, and that is the honest value:**
`presentationCraft.depth`. It serves no product-contract requirement because there is no analytical
truth underneath it to require anything — see the next section.

### The two mechanisms that were frozen too high

| token | was | is | and the contract underneath it |
|---|---|---|---|
| `motion.system-default-is-wrong-here` | product-contract | **implementation-strategy** | new `motion.semantic-events-must-survive` — *Reduced Motion must preserve required semantic events and final meaning.* The contract is **not** "Reanimated must use `ReduceMotion.Never` forever". |
| `projection.canvas` | product-contract | **implementation-strategy** | new `projection.derivation` = `project-V` — *every disclosed analytical object that needs accessible exposure has an accessible semantic representation derived from V.* `text-views-over-canvas` is how that is achieved with **this renderer**. |

**Both findings are unchanged and both are still binding today.** `ReduceMotion.System` omits
exiting animations entirely, which deletes the settle that carries the result; a Skia Canvas
exposes nothing inside it to an accessibility API. What changed is the **authority level**, and
each strategy token now records the library it is about and **when it becomes replaceable**.

### A property that encodes nothing cannot be a required semantic carrier — the F1R2 correction

`nonColorCue.depth` = `level-line-count+scale` was shipped as a **product-contract**, in the group
whose meaning is *the companion channel a colour-bearing **distinction** ships with* — beside topic
identity, pattern membership and error.

I-08B3.1-D2R's `PRESENTATION_CONTRACT` declares `ring.contourCount` and `ring.layer`
**`encodes: null`**. The level-line count is a depth cue; the depth is composition. Requiring a
non-colour carrier for near-from-far therefore attached a **semantic parity obligation** to
something with no semantics — quietly making "near" a thing an accessible expression was *required*
to preserve, which is to say a thing that means something. **That is authority D2R explicitly
removed, reintroduced from inside the accessibility layer.**

**The craft is kept and nothing visual changes.** It now lives under
`accessibility.presentationCraft.depth`, class **production-default**, declaring
`carriesNoAnalyticalMeaning: true` and naming the `encodes: null` properties it is about. 3 / 2 / 1
level lines and a scale remain good work in the default and in the grayscale diagnostic; they are
not something accessibility must preserve in order to preserve the analysis.

> **Accessibility preserves the analytical OBJECTS and TRUTHS. It is not made responsible for a
> decorative distinction that the inherited package already declared meaningless.**

Check **K-05** reads D2R's own table rather than a list kept here, so a property that later acquires
a canonical meaning leaves the forbidden set by itself. Its planted probe is the withdrawn token.

### The Arabic contract is NO CLIPPING; 1.6 is not a universal law

`text.leading-floor` **1.6** was classified **product-contract** and described as irreversible for
every Arabic-bearing element at every size, forever. That over-froze a measurement: **the exact
line-height needed depends on the font, the size, the renderer, the platform metrics and the
content.**

The real contract is the **outcome**, and it is now a token of its own:

> **`text.arabic-must-not-clip`** = `adequate-glyph-extents` — **product-contract.**
> ARABIC TEXT MUST NOT CLIP, LOSE DIACRITICS, COLLIDE DESTRUCTIVELY, OR BECOME UNREADABLE AT ANY
> SUPPORTED TEXT SCALE.

**1.6 remains, as the CURRENT TEST / PRODUCTION THRESHOLD** — what Estedad measured at this proof's
sizes on this renderer, and the number check **X-02** validates the current proof against. It is
`production-default`, `serves: text.arabic-must-not-clip`. Lowering it is only ever legitimate as a
**measured result**, never as a space saving. Check **K-06**.

**Nothing was weakened.** X-02 now reports the **measured** minimum rendered leading ratio per
expression — **1.7 at every text setting, including AX5** — alongside the verdict against the
threshold, so a later face can re-instantiate the number on evidence rather than on this package's
say-so. The parity census field was renamed from `anyLineHeightBelow1_6`, because freezing a
production default into an identifier is how a tunable number starts looking like a law.

### The numeric calibration constants

| token | class | the irreversible requirement it instantiates |
|---|---|---|
| `text.leading-ratio` **1.7** | production-default | **`text.arabic-must-not-clip`** — the outcome, not a number |
| `text.leading-floor` **1.6** | production-default | **`text.arabic-must-not-clip`** — the current tested threshold, measured for this face on this renderer |
| `text.bold-weight-delta` **100** | production-default | **`text.selected-step-must-survive-bold`** — the delta applies to **every** rung, so Bold Text cannot erase SELECTED |
| `text.max-scale` **3.118** | production-default | *whatever the platform's maximum is.* 3.118 instantiates it for iOS today; Android's nonlinear scaling gives another number |
| `text.label-escape-scale` **1.6** | production-default | a label that no longer fits moves to a **full-size inspection view** rather than truncating or shrinking |
| `contrast.boundary-width` **1 px** | production-default | a **defined, contrasting border** exists under increased contrast |
| `contrast.focus-thickness` **3 px** | production-default | the focus perimeter is strengthened **without changing its colour** |

**Nothing was weakened; only the authority level was corrected.** The checks moved with the
tokens: **X-02** measures every rendered line-height against the **threshold token** rather than
against a literal typed into the census script, and **X-03** measures the **rendered** weight step
rather than trusting the delta.

### The three values F1R2 added, all of them scope

| token | class | what it fixes |
|---|---|---|
| `projection.completeness` = `exhaustive-against-user-exposable-V` | product-contract | the fixture's three fields were described as the Product's whole semantic model. This is the obligation the fixture does **not** discharge, and it records the production-mapping dependency |
| `projection.disclosure-boundary` = `same-V-fail-closed` | product-contract | the projector's `?? raw id` fallback would have announced an undisclosed object's identifier |
| `text.arabic-must-not-clip` = `adequate-glyph-extents` | product-contract | the contract is the outcome; 1.6 is the current instrument |

§24 asked for the transformation tokens needed and no token explosion: **56 values, of which
exactly one is a colour literal**, and the four overrides of inherited roles are the entire
surface on which F1 touches anything it did not author. Every value F1R and F1R2 added is a
**semantic requirement that was previously implicit inside an implementation value's description**
— and **F1R2 still adds no colour to QANDEEL**.

## 5. The one literal, and it is computed

`#080808` — the opaque scrim under Reduce Transparency. It is exactly what black at alpha 0.5
produces over the World, **computed rather than chosen**, and check **T-01** recomputes it.

Every other colour F1 authors is an **alias to a frozen rung of the I-08B3.0 reading ramp**.
Check **S-02** scans all five files and requires exactly this one.

> Compare I-08B3.1-E1, which added **one colour** to QANDEEL and said so. F1 adds **none**, and
> that is not modesty — it is the consequence of the law. A transformation that needed a new
> colour would be describing something the default cannot express, which would make it a design
> change wearing an accessibility name.

## 6. Aliasing only, and one declared crossing

DTCG aliasing only: `{a.b.c}` means *this token IS that token*. No modifier arithmetic, no
computed value, no local override — every one of those is a way for a call site to hold a colour
the token tree does not know about.

Three motion tokens **alias D2R's own reduced scalars** under `qandeel.illumination.reduced.*`
rather than restating the numbers, so the two can never drift. That crossing is **named as a
declared exemption** in check S-01 rather than passing silently: F1 reads a *number* there; it
does not write a *colour*.

## 7. The separation law, stated precisely

> **NO ACCESSIBILITY OVERRIDE MAY REACH A COLOUR** under the identity material, QANDEEL LIGHT, a
> state ink or a status ink. A **non-colour MAGNITUDE** of a state may be overridden, and every
> such override is enumerated.

The enumeration is **generated from the token files**, so an override added later is caught by
its own presence. Today it contains exactly one entry:
`qandeel.state.focus.thickness`, 2 px → 3 px.

> The first version of that check forbade reaching `qandeel.state.*` at all — and failed on F1's
> own shipped design. The failure was in the law's wording, not in the design: thickening a
> perimeter cannot make an object look more important, and brightening one can. **A law that
> cannot distinguish the sanctioned case from the forbidden one is the wrong law**, and the
> correction is the precise version above.
