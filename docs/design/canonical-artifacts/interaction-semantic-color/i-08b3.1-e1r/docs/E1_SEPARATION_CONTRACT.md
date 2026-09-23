# E1_SEPARATION_CONTRACT

**I-08B3.1-E1.** How Living Brass, QANDEEL Light, interaction state and system status stay
separable — and how each separation is CHECKED rather than asserted.

---

## 1. The architectural decision that makes any of this checkable

**E1 does not create a fifth token system.** It extends the chain the project already has —
B4R Surface → C3 Living Brass → D2R QANDEEL Light — and adds state and status to the same
resolution.

That is not tidiness. *"A state or status name never reaches the identity material and
never reaches the Light"* is a statement about a **graph**, and it is only a statement
about a graph if both are in the same graph. A parallel token file standing beside the
others would have made every disagreement between them structurally invisible.

Check **R01** walks **every hop of every chain** under `qandeel.state` and
`qandeel.status`, not just the final value — because a token that reached the material by
its own route would paint identically and survive any check that only compared colours.

---

## 2. Brass — MATTER

| the boundary | how it is held |
|---|---|
| no state or status token may reach `qandeel.identity.material` or the Brass body | **R01**, every hop, with a probe that aliases the marker to the material |
| Brass never turns on because an item is selected | there is no state sibling of `qandeel.navigation.machinery` to reach for — C3 made it *unavailable*, and E1's selection expression is what makes that absence workable |
| Brass's **appearance** does not depend on state either | **LIVING BRASS IS STATE-INVARIANT IN VALUE AND IN APPEARANCE**, product-contract — and since I-08B3.1-E1R that is checked rather than declared. **R30** parses the shipping stylesheet and rejects any rule that paints a Brass-bearing element, or applies opacity or a filter, under a state selector. Its probe is the rule E1 actually shipped for two packages, which repainted the navigation icon to the unavailable ink. `b15` shows the forbidden alternative |
| how availability is expressed *around* a Brass-bearing object | **NOT E1R's TO DECIDE.** E1 froze a universal that no such object ever has an unavailable state; there is no canonical authority for it, and it is withdrawn. `E1_DISABLED_COLLISION_RESOLUTION.md` §2 |
| E1 writes nothing into C3's namespaces | **R07**, with the frozen prefixes named |

**What a reviewer should be able to answer from `b11-separation.png`:** the Q in the header
and the five navigation icons are the same material at the same value, in a panel that also
contains a selected row, a focused row and an error — and none of the three moved it.

---

## 3. Light — MEANING

| the boundary | how it is held |
|---|---|
| no state or status token may reach `qandeel.illumination.*` | **R01**, by prefix |
| the press wash is not a dim Light | **R11** — the chain, deliberately, and not the composited chroma. Its probe shows a Light-based wash compositing to chroma 0.00383, which a chroma ceiling would have waved through |
| focus is not Light | focus resolves to `qandeel.content.primary`; it is an achromatic-family neutral and a *perimeter*, where Light has no edge at all |
| the error is not Light | dEok 0.1408 from LIGHT-low at full strength; and the error is **static** where Light rises, decays and reaches exactly zero |

**The strongest separation is behavioural, not chromatic.** A meaning event *ends*: D2R's
contract says every one reaches exactly zero and leaves a neutral residue. Nothing in E1
does that. An error persists until the input changes; a selection persists until the user
changes it; a press ends the instant the finger lifts, with no decay at all. **Light has a
lifecycle. State and status do not.** That is why `b10-integrated-screen.png` can carry a
light event and an error in the same frame without either reading as the other.

---

## 4. State — THE USER'S POSITION

| the boundary | how it is held |
|---|---|
| interaction state introduces **no colour** | **R02** — zero literals under `qandeel.state`, exactly one under `qandeel.expression.state`, and that one is the reading ramp extended |
| the five states cannot be confused with one another | the **composition / ownership model**: three channels exclusively owned, the ink shared and resolved by precedence rule P1, and all sixteen combinations enumerated with a verdict. **R27** fails on an undefined combination; **R28** derives each channel's writers from the shipped matrix and rejects an ownership table that claims exclusivity the matrix contradicts |
| availability is not focusability | **R26** on the two shipped patterns, **R31** on their behaviour under real keys |
| the proof holds no colour of its own | **R25** — not one hex literal in `e1-scene.mjs` or `e1-boards.mjs`; every colour arrives through `resolveAll()` |

---

## 5. Status — WHAT NEEDS ATTENTION

| the boundary | how it is held |
|---|---|
| a hue is EARNED, not assigned by taxonomy | **R03** — the roles reaching a status literal are exactly the roles the shipped policy declares as having earned one, and every role without one carries an overturn condition and a Product-evidence route. **R29** — no shipped Product-contract statement caps the number of hues |
| no generic traffic-light palette | preserved, and it is the part that is frozen. The count is not |
| the error is the most chromatic thing QANDEEL paints | **R13** — 0.1364, against Living Brass's 0.0516 and LIGHT-low's 0.0462 |
| colour is never the sole carrier | the `com.qandeel.companion` extension on every status role names the channels it must ship with, and `E1_NON_COLOUR_COMPANION.md` measures why they are load-bearing |
| the error role has exactly one value | one token. A second tone would be a ladder |

---

## 6. The five questions independent review should be able to answer, and where

| question | board |
|---|---|
| Is Brass still clearly identity material? | `b11`, `b10` |
| Is Meaning Light still clearly meaning emergence? | `b10`, `b11` |
| Does Error look like Error rather than Meaning Light? | `b10` — both in one frame; `b11` — measured apart |
| Does Focus look interactive rather than analytical? | `b03`, `b04` |
| Does Selected look selected rather than "QANDEEL understood"? | `b04`, `b10` |
| Can all four coexist on one screen without semantic collision? | `b10`, `b11` |

---

## 7. The one separation E1 cannot fully deliver, and says so

**For a red-blind reader, the error ink and Living Brass are the two closest things in
QANDEEL** — dEok 0.0554 after protanopic simulation, against a floor of 0.0513. It clears
the floor, and it clears it by less than any other pair in the system.

That is not fixable by choosing a different red: the floors already consume very nearly
the whole red region of the gamut at this lightness. It is handled where it has to be
handled — the error always ships with a glyph, copy and a promoted boundary, and Living
Brass is scarce by construction (0.32–4.22 % of ink, per C2). But it is a real residual
and it belongs in this document rather than in a footnote.
