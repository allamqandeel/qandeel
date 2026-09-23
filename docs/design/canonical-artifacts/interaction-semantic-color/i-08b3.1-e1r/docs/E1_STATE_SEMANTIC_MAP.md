# E1_STATE_SEMANTIC_MAP

**I-08B3.1-E1.** The Product contract for REST, PRESSED, FOCUS, SELECTED and DISABLED.

---

## 0. The question asked first

Not *what colour is this state*. **What actually changed?**

| state | what actually changed |
|---|---|
| REST | nothing |
| PRESSED | the user's finger is on it, right now |
| FOCUS | input is going here |
| SELECTED | the user chose this, and it stayed chosen |
| DISABLED | the user may not |

**DISABLED is the odd one, and E1R is the package that admits it.** The other four describe
where the user is. DISABLED describes what the system permits, which is why it behaves as
an **override** rather than as a fifth peer — and why "is it focusable?" turned out to be a
separate question with a separate answer (§5.1) rather than a consequence of the expression.

Three of those five are facts about the *user*, one is a fact about the *input system*,
and one is a fact about *permission*. Not one of them is a fact about what the control is
made of or about what the system understood. That is why none of them may reach Living
Brass or QANDEEL Light, and why **only one of them introduces a colour** — and even that
one is the reading ramp continued rather than a new hue.

---

## 1. REST

**Contract.** REST is the ABSENCE of state. It is not a state with a colour of its own.

The ink belongs to the control's permission class, which I-08B3.1-C3 owns:
`qandeel.control.functional` → `qandeel.content.tertiary`. E1's
`qandeel.state.rest.ink` aliases straight to it, so REST is visible in the graph and is
obviously not something E1 decided.

A **row's title** is not control ink. `qandeel.state.rest.ink` governs a *control's own*
ink — a button label, a navigation label — and a row title is the thing the row is about,
so it reads at secondary rank. SELECTED promotes it one rung, secondary → primary, which
is a move up the frozen ramp and not a new colour.

Type weight at rest: **500**. Inside 400–700, which is the band Arabic needs at UI sizes;
below 400 the connected script thins to illegibility.

---

## 2. PRESSED

**Contract.** PRESSED says *I am receiving your physical interaction*. It is TRANSIENT and
it belongs to the **GROUND**, not to the ink and not to the object.

It is not selection, not meaning emergence, not success, and not identity.

**Expression.** The control's ground takes the Product's own primary reading ink at a low
presence, plus a small scale response. Both begin on **pointer-down, never on release** —
that is a product-contract statement, not an implementation note. Waiting for the release
to show feedback is the thing that makes an interface feel dead.

**Why the Product's own ink and not white.** QANDEEL has no pure white; a white wash would
introduce a neutral colder than anything in the system. Material 3 states the same
construction independently: a state layer "uses the same color as the content".

**The mechanical separation from QANDEEL Light, and an honest correction.** The first
version of this contract asserted that the pressed ground's *chroma* proves it cannot be a
meaning event. Its probe — a wash made from the Light instead of the ink — stayed silent:
at these alphas over a near-black ground almost anything composites to a nearly achromatic
value, so the measurement passes whatever ink you feed it. **That was a check that could
not fail.** What is falsifiable is the CHAIN: `qandeel.state.pressed.ink` resolves into
`qandeel.expression.content.primary` and reaching the illumination is rejected. Check
**R11**, and its probe shows the Light-based wash compositing to chroma 0.00383 — which a
chroma ceiling would have waved straight through.

**Lifecycle.** REST → PRESSED → RELEASED leaves the control exactly as it was found.
REST → PRESSED → SELECTED leaves a marker, and the ground returns to rest either way. A
press never leaves a residue; that is the whole of how it differs from selection.

---

## 3. FOCUS

**Contract.** FOCUS says *this control currently receives interaction*. It belongs to the
INPUT SYSTEM, not to the content — so it is drawn **OUTSIDE the control, DETACHED by a
gap**: a piece of apparatus adjacent to the object rather than a property of it.

That detachment is the entire mechanism by which FOCUS and SELECTED stay distinct, and it
holds when both are true at once.

**Expression.** A two-tone perimeter.

| part | value | role |
|---|---|---|
| indicator | `qandeel.content.primary` `#d8d5ca`, 2 px | what you see |
| gap | the ground, 2 px — equal to the indicator's own thickness | what makes it detached |
| companion | `qandeel.world.fill` `#101010`, 1 px, outside the indicator | what makes it work everywhere |

**The 2 px is the specification's own figure**, not a number chosen here: WCAG 2.2
SC 2.4.13 states the area requirement as "at least as large as the area of a 2 CSS pixel
thick perimeter of the unfocused component". E1 treats it as a floor.

**The companion is not decoration, and this is measured.** SC 2.4.13 measures the change
of contrast between the *same pixels* focused and unfocused — the indicator reaches
12.95:1 on the World and 12.08:1 on the functional Surface. But SC 1.4.11 measures a focus
indicator against its **adjacent** colours, and there the indicator alone reaches 3:1
against only **5 of the 13** colours QANDEEL can paint beside it. It fails against every
ink, against the identity material, against the Light and against the error. **The pair
reaches 3:1 against all 13.** Check **R10**, table in `E1_VALIDATION_RESULTS.md` §6.

**Focus is NOT Meaning Light and is NOT Brass.** It introduces no colour: both tones are
frozen values the Product already paints.

**The behavioural half, which no still could show.** `tools/e1-focus.mjs` drives real
`Input.dispatchKeyEvent` Tab events and a real Enter key, and reads the computed style of
whatever focus landed on: **15 of 15 obligations met, 5 of 5 probes fired**. **It caught a
real defect.** An earlier
build styled only the simulated `[data-state~="focus"]` attribute, so every board painted
an indicator the real focus state never produced — the keyboard got Chrome's 1 px default
outline. A synthetic `KeyboardEvent` from page script carries no default action, so a Tab
test written in page JS measures its own `focus()` calls and always passes.

---

## 4. SELECTED

**Contract.** SELECTED says *the user chose this*. It is STABLE and it survives the
interaction that produced it. It is **ATTACHED** to the control.

**Expression — three channels, none of them a hue.**

1. **A marker** on the control's own edge, on the side its group is anchored to: the top
   edge for a bottom navigation item, the inline-start edge for a list row — which in RTL
   is the **RIGHT** edge. One rule, every morphology.
   The marker is a **segment**, inset from the control's top and bottom, not a full edge.
   That is what keeps it readable beside the focus indicator's continuous perimeter.
2. **Ink promotion** — one rung up the frozen ramp, secondary → primary.
3. **Weight promotion** — 500 → 600.

**Weight is load-bearing here for a reason specific to the script.** Arabic has no italic
tradition and browsers fake-slant it; letter-spacing visibly breaks the connected script.
Weight is the only typographic emphasis channel Arabic leaves open, and both values sit
inside the 400–700 band.

**Selection is deliberately NOT Living Brass.** C3 left no state sibling of
`qandeel.navigation.machinery` to reach for; this is the expression that makes that
absence workable rather than merely forbidden. The platform on this point says the
opposite on two separate pages, and C2 captured what is being given up rather than
claiming it was nothing.

---

## 5. DISABLED / UNAVAILABLE

**Contract.** DISABLED says *this action is currently unavailable*. **DISABLED DESCRIBES
AVAILABILITY. IT DOES NOT DESCRIBE FOCUSABILITY.**

**Expression — one ink, plus two things that are not paint.**

1. **A disabled control resolves every ink it carries to ONE value**, and so loses its
   internal hierarchy. Hierarchy is for reading and acting, and the control is doing
   neither. That is a stronger statement than dimming, and it is a *different* statement.
2. **It cannot be activated.** Behavioural, and verified under a real Enter key — against
   an available control that *does* activate under the same key, so the obligation is not
   vacuous.
3. **It states why.** A disabled commit in every proof carries a real adjacent control
   with `aria-describedby`, not a caption on the board.

### 5.1 The two availability patterns, and the absolute E1R withdrew

I-08B3.1-E1 froze, as Product contract, that an unavailable control is never focusable and
never in the tab ring. **That is true of one pattern and wrong as a rule**, and the sources
E1 had already read say so. W3C's ARIA Authoring Practices Guide, *Developing a Keyboard
Interface*: *"there are some contexts where it is useful for an element to convey a
disabled state while remaining focusable, especially inside of composite widgets"*, and —
the sentence that settles it — *"screen reader users are far less likely to discover
disabled elements that are not focusable because moving focus is one of their primary
methods of discovery."* The same page asks for *"consistent pattern-based conventions for
the focusability of disabled elements"*, which is exactly what the two patterns below are.

| | NATIVE NON-DISCOVERABLE UNAVAILABLE | DISCOVERABLE UNAVAILABLE |
|---|---|---|
| available | no | no |
| can activate | no | no |
| **in the focus order** | **no** | **yes** |
| when | a standalone control whose unavailability is inferable from its neighbours — the commit button under a visibly incomplete form | a control inside a set, where skipping it hides the shape of the set: an option, a menu item, a tab, a filter or scope chip, a row in a chooser. Also any control whose *existence* is the information |
| web | the HTML `disabled` attribute; the browser removes it from the tab sequence | `aria-disabled="true"`, kept in the tab order, **activation suppressed in script** |
| native | `Pressable disabled` + `accessibilityState={{ disabled: true }}` | `accessibilityState={{ disabled: true }}`, left focusable, `onPress` suppressed — **not verified on a device**, `E1_REACT_NATIVE_MAPPING.md` D-E1-6 |
| what it costs | a screen-reader user may never discover it | every keyboard user spends a keystroke |

**THE TWO ARE VISUALLY IDENTICAL, and that is the contract.** The user is being told the
same thing in both cases. A visible difference would encode an implementation decision as a
Product meaning. Board `b15` puts the same two controls side by side under both patterns;
check **R26** asserts the shipped declaration; the behavioural proof measures the computed
colour of one of each and requires them equal.

**`aria-disabled` does two fewer things than people expect, and both had to be written.**
MDN: it *"does not change the focusability of such elements, nor will the elements be
dimmed by default browser styling"*, and *"web developers must manually ensure such
elements have their functionality suppressed."* So the DISCOVERABLE pattern needs its paint
asked for explicitly and its activation blocked explicitly — and a probe drops the
suppression to prove the obligation would catch it. That defect is the same shape as
painting a control disabled and forgetting the attribute: it looks unavailable and it is
fully operable.

**The ink is the frozen reading ramp extended by its own rule** — L one rung below the
tertiary, chroma continuing the ramp's last step, hue the ramp's mean. `#696762`.
Check **R09**: dEok 0.1157 below the tertiary, which is a full rung by construction, so no
disabled control can be confused with an enabled one *whatever ink it started from*.

**Why an ink and not an opacity.** One alpha on the whole control reduces every ink by the
same factor, which pushes the dimmest toward illegibility while barely touching the
brightest — at the alpha where a disabled PRIMARY label only just clears the tertiary, it
lands at the *same contrast* as an enabled tertiary label. That is the inherited collision
relocated, not closed. Apple expresses the same thing the same way: `disabledControlTextColor`
is a text colour, not an alpha. And Apple's own foreground ladder has exactly the fourth
rung E1 derived — `quaternaryLabel`, below tertiary — arrived at independently.

**Contrast.** 3.37:1 on the World, 3.14:1 on the functional Surface. WCAG 2.2 exempts
inactive components from the contrast minimums (SC 1.4.11 and the 1.4.3 incidental
exception), and E1 does not claim AA for it; it claims *legible and clearly unavailable*,
and the three non-colour channels carry the meaning.

**Living Brass is state-invariant in value AND in appearance**, so E1R supplies no
unavailable expression for a Brass-bearing object — and does not claim the Product can
never need one. See `E1_DISABLED_COLLISION_RESOLUTION.md`.

---

## 6. The composition model, which is the real test

### 6.1 What replaced the slogan, and why it had to be replaced

E1 said each state owned a different channel and that **no channel was used twice**. It was
a clean sentence and it was **false as it was written**: SELECTED writes the ink and
DISABLED writes the ink. Every expression it described was right; the explanation of why
they worked was not — and a wrong explanation is worse than none, because it stops anyone
looking. It also did real damage: it is what made "DISABLED + focus cannot occur" sound
like a consequence of the model rather than the accessibility claim it actually was.

**Three channels are exclusively owned. One is shared. One state is an override.**

| channel | owner | also written by | resolved by |
|---|---|---|---|
| GROUND | PRESSED | — | — |
| DETACHED PERIMETER | FOCUS | — | — |
| ATTACHED MARKER — presence | SELECTED | — | — |
| **INK** | SELECTED | **DISABLED** | **P1** |
| TYPE WEIGHT | SELECTED | — | — |
| AVAILABILITY *(not visual)* | DISABLED | — | — |

**The three precedence rules.**

- **P1 — AVAILABILITY OVERRIDES INK.** Every ink an unavailable control carries resolves to
  the unavailable ink, *including the selection marker's*. Selection's ink promotion is
  suppressed; **selection's marker and selection's weight are not.** A choice the user made
  is a record, and availability is not a reason to withdraw a record.
- **P2 — AVAILABILITY SUPPRESSES THE PRESS RESPONSE.** A ground response says *I am
  receiving your physical interaction*, and an unavailable control is not. This is the rule
  that makes four combinations unreachable rather than merely unusual.
- **P3 — FOCUS IS ORTHOGONAL** and is never suppressed by another state. Whether focus can
  *arrive* at an unavailable control is decided by §5.1's pattern, not by precedence.

### 6.2 Every combination, and where to see it

| combination | verdict | how it reads | proof |
|---|---|---|---|
| SELECTED, not focused | reachable | marker + promoted ink and weight | `b04` row A |
| FOCUSED, not selected | reachable | detached perimeter, ink unchanged | `b04` row B |
| SELECTED **and** FOCUSED | reachable | both, as two objects with ground between them | `b04` row C |
| neither | reachable | rest | `b04` row D |
| PRESSED then RELEASED | reachable | ground moves and returns; nothing persists | `b05` strip 1 |
| PRESSED then SELECTED | reachable | ground returns, marker stays | `b05` strip 2 |
| SELECTED being PRESSED | reachable | ground moves under an object that keeps its marker | `b05` strip 3 |
| FOCUS + PRESSED | reachable | disjoint channels; a press on an already-focused control, or a held keyboard activation | `b17` matrix |
| **SELECTED + UNAVAILABLE** | **conditional — see §6.3** | marker and weight retained, every ink collapsed | `b17`, and measured behaviourally |
| **FOCUS + UNAVAILABLE** | **conditional on the pattern** | in DISCOVERABLE it is ordinary; in NATIVE it cannot occur | `b17`, `E1_FOCUS.json` |
| PRESSED + UNAVAILABLE *(any combination containing both)* | **unreachable** | P2 — there is no state to paint | `b17` matrix |

All sixteen subsets are enumerated with a verdict and a rule in
`com.qandeel.composition.matrix` in the shipped token file, printed on board `b17`, and
check **R27** fails if any one of them becomes undefined. Check **R28** derives the writers
of every channel *from that matrix* and rejects an ownership table that claims exclusivity
the matrix contradicts — so the withdrawn slogan cannot come back as an assertion.

### 6.3 SELECTED + UNAVAILABLE, ruled at the control type

E1 would have answered "impossible" from a universal it did not have. The question is a
control-type question.

| control type | verdict | why |
|---|---|---|
| a chosen **value** in a set — filter, scope chip, option row | **REACHABLE, AND EXPRESSED** | a value can stop being available while remaining the value that was chosen. Hiding the marker would silently rewrite the user's choice; hiding the control would silently rewrite the set |
| a list row that is the **current destination** | **PRODUCT-OWNED — not ruled out** | here the selection is a position, not a value, and what QANDEEL does when the world you are standing in becomes unavailable is a Connected Worlds question, not a colour question |
| a persistent **navigation item** | **NOT EXPRESSIBLE IN E1R** — a scope statement, not a Product law | it carries Living Brass. Two of the three obvious expressions are forbidden by the material; the third is absence or an empty state at the destination, and that belongs to the navigation contract |
| a **button** | **NOT APPLICABLE** | E1 gives a button no selected expression. A button is pressed, never chosen |

**The expression, where it is reachable.** Marker present, **in the unavailable ink**; every
other ink the same; **weight promotion retained**. Two channels distinguish it from plain
UNAVAILABLE and one from plain SELECTED, and the reason sentence — «واختيارك محفوظ», *and
your choice is retained* — is the third channel and the load-bearing one.

---

## 7. Hover

**Not designed, and not reserved.** QANDEEL ships touch-first, and a touch device fires
hover on tap, which turns any hover expression into a false press. If a pointer-device
surface is ever a Product requirement, hover is a new decision, and §6.1 is now the place
it would have to be argued: every visual channel already has an owner, so hover would have
to either take one by precedence or introduce a sixth. That is recorded as open rather than
pre-answered — and note that E1's version of this paragraph rested on the exclusivity
slogan, which is no longer available as an argument.
