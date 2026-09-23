# E1_FREEZE_BOUNDARY

**I-08B3.1-E1.** Product contract versus tunable craft, on every token and on the
statements that are not tokens.

> A token exists so an implementation is **CONSISTENT**. Freezing exists so a **PRODUCT
> DECISION** is irreversible. They are different jobs, and a value can have the first
> without the second.

Every token carries `com.qandeel.freeze` saying which it has. **`classify()` THROWS on an
unclassified path**, so a token added later cannot inherit "frozen" by sitting in the file.
Check **R04** asserts every authored token is classified, and its probe asks `classify()`
for a path that has none and requires it to throw.

---

## 1. PRODUCT CONTRACT — changing it changes what the product MEANS

### The statements that are not tokens

These are the important half, and they live in
`com.qandeel.freeze-boundary.productContract` at the root of the semantic document.

1. **STATE IS THE USER'S POSITION.** BRASS IS MATTER. LIGHT IS MEANING. ACTIVITY IS
   PROCESS. A fourth term is a new Product decision.
2. **THE STATE COMPOSITION MODEL.** PRESSED owns the ground, FOCUS owns a detached
   perimeter, SELECTED owns the marker's presence and the type weight, DISABLED owns
   availability. **The INK is shared by SELECTED and DISABLED** and is resolved by
   precedence rule P1. Three precedence rules govern every combination and all sixteen are
   enumerated with a verdict, in `com.qandeel.composition`.
3. **Interaction state introduces NO colour.** Every state colour is an alias into the
   frozen reading ramp, except the disabled ink, which is that ramp extended by its own rung.
4. **FOCUS IS DETACHED AND SELECTED IS ATTACHED.** That is the whole of how they are told
   apart, and it holds when both are true at once.
5. **PRESSED IS TRANSIENT AND BELONGS TO THE GROUND; SELECTED IS PERSISTENT AND BELONGS TO
   THE OBJECT.** A press never leaves a residue.
6. **PRESS FEEDBACK BEGINS ON POINTER-DOWN**, never on release — and is suppressed entirely
   on an unavailable control, which is precedence rule P2.
7. **DISABLED DESCRIBES AVAILABILITY, NOT FOCUSABILITY.** An unavailable control cannot be
   activated and states the reason. Whether it stays in the focus order is decided by its
   control pattern, and `com.qandeel.availability` defines exactly two — NATIVE
   NON-DISCOVERABLE UNAVAILABLE and DISCOVERABLE UNAVAILABLE. **The two are visually
   identical.**
8. **LIVING BRASS IS STATE-INVARIANT IN VALUE AND IN APPEARANCE.** No interaction state and
   no availability state may dim, recolour or composite a Brass-bearing object. E1R
   supplies no unavailable expression for one, and does not claim the Product can never
   need one.
9. **STATUS COLOUR IS EARNED, NOT ASSIGNED BY TAXONOMY**, and **QANDEEL DOES NOT USE A
   GENERIC TRAFFIC-LIGHT PALETTE.** ERROR currently owns the only dedicated system-status
   hue. **The count is not a cap**: a future dedicated status expression requires Product
   evidence and is not prohibited.
10. **COLOUR IS NEVER THE SOLE CARRIER** of a state or a status.
11. **THE ERROR ROLE HAS EXACTLY ONE VALUE.** A second tone would be a ladder.
12. **NOTHING IN `qandeel.state` OR `qandeel.status` MAY EVER RESOLVE TO THE IDENTITY
    MATERIAL OR TO THE ILLUMINATION.**
13. **HOVER IS NOT A QANDEEL STATE.**

**Four of these thirteen are I-08B3.1-E1R revisions of statements I-08B3.1-E1 froze.**
Numbers 2, 7, 8 and 9. Each is named in `revisedByE1R` beside the list in the token
document, and the withdrawn wording — with what was wrong with it — is in
`E1R_REVISION_RECORD.md`. **No accepted visual expression changed in any of the four.**

### The tokens

| token | why it is contract |
|---|---|
| `qandeel.state.rest.ink` | REST belongs to the control's permission class, which C3 owns. Reaching a different value would mean E1 had taken ownership of something frozen. |
| `qandeel.state.pressed.ink` | *which ink the press is made of* is the separation from the Light, and it is the claim check R11 holds. |
| `qandeel.state.focus.indicator` · `.companion` | the two-tone construction is what makes the indicator work against everything QANDEEL paints. Dropping the companion fails 8 of 13 adjacency tests. |
| `qandeel.state.selected.ink` · `.marker` | selection is a marker plus a promotion up the ramp. Both are the decision. |
| `qandeel.state.disabled.ink` | one ink for the whole control, derived from the ramp, and it is the same ink under both availability patterns. |
| `qandeel.status.error.ink` | the role exists and it is the only role that has earned a hue. |
| `qandeel.status.warning.ink` · `success.ink` · `informational.ink` | **the aliases ARE the current decisions.** That they resolve into the frozen ramp rather than to a literal is what "has not earned a hue" means, made visible in the graph. Each carries the condition that would overturn its refusal and the Product evidence a hue would require. |
| `qandeel.expression.status.error` `#fe907e` | see §3. |
| `qandeel.expression.state.disabled` `#696762` | derived from the frozen ramp by the ramp's own rule; changing it means changing the ramp. |

---

## 2. PRODUCTION DEFAULT — tunable craft, expected to move once a device has been seen

| token | value | bound |
|---|---|---|
| `qandeel.state.pressed.presence` | 0.10 | must move the ground by at least the frozen World→Surface lightness step, 0.03599. The value is Material 3's pressed state-layer opacity, cited, not derived. |
| `qandeel.state.focus.thickness` | 2 px | a **floor** taken from WCAG 2.2 SC 2.4.13's own wording. An implementation may exceed it, never go below. |
| `qandeel.state.focus.companion-thickness` | 1 px | the companion carries no area requirement of its own; one device-independent pixel does its job. |
| `qandeel.state.focus.offset` | 2 px | **detachment is the contract; the exact gap is craft.** Currently equal to the indicator's thickness. |
| `qandeel.state.selected.marker-thickness` | 2 px | the marker's *presence* is contract; its weight is not. |
| `qandeel.state.rest.weight` · `selected.weight` | 500 · 600 | **the RELATION is the contract** — selected is heavier than rest. Both values must stay inside 400–700, which Arabic requires at UI sizes. |

Also craft, and not tokens at all: the press scale response and its duration; the exact
marker length and its inset; icon geometry; the corner radius; every spacing value in the
proof.

---

## 3. The error value's classification, and why it is contract rather than default

`#fe907e` is classified **product-contract**, and the reason is not that it is beautiful.

**IT IS PRODUCT-OWNER VISUALLY APPROVED, AND THAT IS THE FIRST REASON.** The acceptance of
this value rests on three things together: **Product visual judgement**, contrast and
accessibility evidence, and semantic-separation evidence. The order matters, and
I-08B3.1-E1R corrects the order: E1 presented the derivation first and let it carry the
weight of an accessibility law, which it is not.

**The derivation is engineering evidence, and its scope is this palette on this ground.**
Only 3 sampled points are feasible at its hue; the lightness range of the feasible set is
a single step; the sRGB gamut edge is 0.0010 of chroma away; and the two binding
constraints belong to a red-blind reader. Those figures are real and they are why the value
is not nudgeable *within E1's own floors*. They are **not** a proof that no other valid
error red could exist: the ΔEok and dichromacy floors are QANDEEL-derived instruments —
the perceptual floor is literally "as far apart as Living Brass already is from the reading
ramp" — and a different system, a different ground, or a differently-argued floor would
admit different values. **E1R does not claim mathematics chose this colour.** Product
judgement chose the family and accepted the value; the measurements say it does not break
anything the system already relies on.

**What remains genuinely open about it is not its coordinates.** It is whether the RED
FAMILY is right for an Arabic-native product — see `E1_KNOWN_LIMITATIONS.md` §2 — and that
is a Product question for the Owner, not a calibration.

---

## 4. What E1 freezes nothing about

- icon geometry, and the four status glyphs are silhouette specifications, not a final set;
- navigation form, tab depth, the active-indicator's final shape, label behaviour;
- placement of anything, including the canonical Q, which remains C2's open question;
- the light appearance and the increased-contrast contexts, owned by **F**;
- any transition, screen choreography or motion beyond the press response;
- the Arabic product copy, which is specified as a *contract* in
  `E1_ARABIC_COPY_CONTRACT.md` and whose final wording is a Product content decision.

---

## 5. Count

**13 statements that are not tokens**, four of them revised by I-08B3.1-E1R. **13
product-contract tokens.** **7 production-default tokens.** Every one classified;
`classify()` throws on anything else.

## 6. What I-08B3.1-E1R did NOT move

No token value changed. `#fe907e` and `#696762` are byte-identical to what E1 shipped, and
so is every alias. The freeze boundary gained no token and lost none. **Everything the
revision touched was a sentence** — four of them frozen as Product contract, each one
either false, too absolute, or outside this package's authority to state.
