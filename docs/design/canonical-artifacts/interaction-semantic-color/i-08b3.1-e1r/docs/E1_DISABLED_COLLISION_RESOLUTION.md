# E1_DISABLED_COLLISION_RESOLUTION

**I-08B3.1-E1.** The dependency I-08B3.1-C1R opened, C2 was instructed not to solve, and
C3 handed forward intact — and what E1 found when it went to solve it.

---

## 1. There are two different statements of the collision, and only one of them is true

### C1R's statement, which is real

> *"Convention dims a disabled control; the permission forbids the material changing with
> state; so only the neutral label drops. The result is legible but weak — a disabled item
> whose mark is at full material strength does not look disabled at a glance. … It gets
> worse as the body gets stronger."*
> — `C1R_FINDINGS.md` §7

This is about the **BRASS MARK**. It is a real and correctly-described problem.

### C2's restatement, which does not survive measurement

> *"The disabled ink `#5a5a58` sits close enough to the rest-state ink `#8b8982` to be
> argued with"*
> — `C2_FINDINGS.md`, restated in `C3_FREEZE_RECORD.md` §4.2 and
> `C3_ICONOGRAPHY_MATERIAL_CONTRACT.md` §6.4

This is about the **INK**, and it is a different claim. E1 measured it three ways:

| measure | the two inks | for comparison |
|---|---|---|
| lightness gap, OkLCh ΔL | **0.1628** | the ramp's own rungs are 0.1280 and 0.1146 |
| perceptual, full dEok | **0.1629** | E1's derived FLOOR is 0.05129 |
| contrast on the functional Surface | 5.07:1 against 2.57:1 | — |

**By every one of them the two inks are FURTHER apart than two adjacent rungs of the
frozen reading ramp.** `#5a5a58` was never too close to `#8b8982`. The ink restatement
entered the record at C2, propagated into C3's freeze record and into C3's iconography
contract, and was carried forward for two packages as the thing that needed solving.

Check **R15** asserts this, and its own probe records the half that is *not* measured:
C1R's statement is about the mark, and E1 resolves it by a Product rule rather than by
arithmetic.

**Nothing in C1R, C2 or C3 is invalidated by this.** No frozen value moves, no raster
changes, and the diagnostic carrier was always classified proof-only. What changes is what
E1 was asked to fix.

---

## 2. The real collision — and the answer E1 gave, which I-08B3.1-E1R withdraws

The real collision needs three things at once: an object that **carries Living Brass**,
that is a **control**, and that can be **unavailable**.

### 2.1 What E1 answered, and why it is not E1's to answer

E1 ruled the case out of the Product. Its reasoning was that a persistent navigation
destination cannot be unavailable — *a destination that exists is reachable* — and from
that it froze, as Product contract, a universal: no object bearing identity material ever
has an unavailable state.

**That is a navigation and entitlement law, and this is a colour package.** E1R went
looking for the authority that would support it and did not find one:

- the canonical navigation track (Stages 0–4, frozen) settles experience architecture,
  spatial model, visual language and semantic zoom. **It says nothing about capability
  availability**, gating or entitlement;
- the repo-side VI-03 gate and that track disagree about visual morphology, and **which
  authority governs is itself an open reconciliation the Owner has not answered** — so the
  bottom tab bar the proof draws is not even settled as the navigation form;
- the Apple guidance E1 cited says you don't need distinct selected and unselected
  appearances for a standard tab-bar icon. That is a statement about *selection*. It is not
  a statement that a destination can never be unavailable, and it was doing more work in
  E1's argument than it can carry.

The claim may well be true. **Nothing in the canonical record establishes it, and E1R is
not the package that gets to decide it.**

### 2.2 What is actually frozen, stated at the width the evidence supports

> **LIVING BRASS IS STATE-INVARIANT IN VALUE AND IN APPEARANCE.** No interaction state and
> no availability state may dim, recolour or composite a Brass-bearing object.
>
> **E1R therefore supplies NO unavailable expression for a Brass-bearing object**, and does
> not claim the Product can never need one. How availability is expressed around an
> identity object is a Product and navigation-contract decision, and it is handed up as one.

Of the three obvious expressions, **two are forbidden by the material** — compositing the
control down, and repainting the mark in the unavailable ink — and the third, absence or an
empty state at the destination, is a navigation decision rather than a colour one. That is
the whole of what E1R can say without borrowing authority.

### 2.3 And E1 was shipping the forbidden one

The withdrawn universal did more than overreach. **It made a defect unreachable, and
therefore unexamined.** For two packages the stylesheet contained a rule repainting the
navigation item's icon — Living Brass — to the unavailable ink whenever the item carried
the disabled state. It never rendered, because no board ever marked a navigation item
unavailable, because the law said that could not happen.

The rule is gone. Check **R30** now parses the stylesheet the proof actually serves and
rejects any rule that paints a Brass-bearing element, or applies opacity or a filter, under
a state selector — and its probe is that exact rule, fed back in.

### Why "never dimmed" and not "dimmed a little"

Compositing the whole control down — mark included — is superficially defensible: the
material *token* is untouched, the material *reference* has not changed, and 0.42 × Brass
is not a second Brass any more than a smaller icon is a second icon.

**It is still forbidden, and the reason is not about the token.** Two packages were spent
proving that the material's appearance does not depend on state. A reviewer looking at a
screen where the Brass icons visibly dim when an item becomes unavailable concludes that
Brass encodes state, and is not wrong to. **The appearance of the material may not depend
on state any more than its value may.**

Board `b15-disabled.png` shows the forbidden alternative rather than describing it, beside
the permitted one, so a reviewer can see what is being given up.

---

## 3. What E1 ships for ordinary controls

No Brass is involved in any of it.

**One ink for the whole control.** A disabled control resolves every ink it carries to
`qandeel.state.disabled.ink` = `#696762` and so loses its internal hierarchy. Hierarchy is
for reading and acting, and the control is doing neither. That is a *different* statement
from "dimmer", and a stronger one.

**The ink is derived, not chosen** — the frozen reading ramp extended by its own rung. See
`E1_COLOUR_DERIVATION.md` §4. Check **R09** asserts it sits a full rung below the dimmest
enabled ink, so **no disabled control can be confused with an enabled one whatever ink it
started from**.

**Why not an opacity.** One alpha applied to the whole control reduces every ink by the
same factor. E1 tried it: the largest alpha at which a disabled PRIMARY label clears the
tertiary lands that label at **5.01:1**, against an enabled tertiary label's **5.07:1** —
indistinguishable. That is the inherited collision relocated, not closed. Apple expresses
disabled the same way E1 ended up doing: `disabledControlTextColor` is a **text colour**,
not an alpha.

**Two channels that are not paint.** The control **cannot be activated** — verified
behaviourally under a real Enter key, against an available control that does activate under
the same key, with a probe that drops the suppression and requires the obligation to reject
it. And the control **states why it is unavailable**, in a real adjacent element linked by
`aria-describedby`.

**Whether it is also removed from the focus order is a separate question**, answered by the
control pattern rather than by this expression — see `E1_STATE_SEMANTIC_MAP.md` §5.1. E1
froze the two together and was wrong to.

**Contrast, stated rather than claimed.** 3.37:1 on the World and 3.14:1 on the functional
Surface. WCAG 2.2 exempts inactive components (SC 1.4.11's "except for inactive
components", and 1.4.3's incidental exception), and **E1 does not claim AA for the
disabled ink.** It claims legible and clearly unavailable, and the three non-colour
channels carry the meaning.

---

## 4. Status

| | |
|---|---|
| the collision as C1R stated it | **NOT CLOSED BY E1R — HANDED UP.** E1 closed it by ruling the case out of the Product; E1R withdraws that ruling as outside this package's authority. What E1R gives is the constraint any answer must satisfy, not the answer |
| the collision as C2/C3 restated it | **WITHDRAWN** — it does not survive measurement, and the measurement is check R15 |
| the disabled expression for ordinary controls | **SPECIFIED**, and the ink is derived |
| the retired diagnostic literal `#5a5a58` | **RETIRED**, and check R06 locates the one permitted mention structurally |
| the stylesheet rule that repainted the Brass icon | **REMOVED**, and check R30 rejects its return |

Two packages carried the collision forward rather than quietly fixing it. That was the
right call: had C2 or C3 "solved" it, the mis-statement would have been solved too, and
nobody would have measured it. **E1 then closed it with a Product law instead — which is a
third way of not measuring something**, and it cost two packages' worth of attention on a
rule that was in the stylesheet the whole time.
