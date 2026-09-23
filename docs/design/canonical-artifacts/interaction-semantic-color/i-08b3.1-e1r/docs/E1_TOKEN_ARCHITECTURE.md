# E1_TOKEN_ARCHITECTURE

**I-08B3.1-E1.** The production token family, and the one decision that shapes it.

Format: **DTCG 2025.10**, the same as B4R, C3 and D2R.

---

## 1. E1 does not create a fifth token system

I-08B3.1-B4R froze the Surface system with a resolver. C3 extended that resolver with
Living Brass rather than standing beside it. D2R extended C3's with QANDEEL Light. **E1
extends D2R's.**

```
qandeel-interaction.resolver.json
  └─ sets/qandeel-light         →  ../vendor/d2r/tokens/qandeel-light.resolver.json
                                     └─ C3 Living Brass → B4R Surface
  └─ sets/interaction-semantic  →  ./base/interaction.tokens.json          (E1)
  └─ modifiers/appearance
       dark  →  ./appearance/dark.interaction.tokens.json                  (E1)
       light →  ./appearance/light.interaction.tokens.json                 (deliberately empty)
```

The reason is not tidiness. Every separation claim in this package is a statement about a
**graph**, and it is only a statement about a graph if all four systems are in the same
one. Check **R01** walks every hop of every chain; check **R16** re-verifies the vendored
inherited files against the sealed packages they came from rather than trusting a
directory name.

---

## 2. The two tiers, and the one place values live

```
EXPRESSION   qandeel.expression.status.error    = #fe907e   ← E1's first literal
             qandeel.expression.state.disabled  = #696762   ← E1's second
             qandeel.expression.content.primary = #d8d5ca   (B4R, frozen)
                      ▲
SEMANTIC     qandeel.status.error.ink ─────────┘
             qandeel.state.focus.indicator ─────┘
```

Resolved chains, as the build reports them:

```
qandeel.state.rest.ink        → qandeel.control.functional → qandeel.content.tertiary  → …  #8b8982
qandeel.state.pressed.ink     → qandeel.content.primary    → …                              #d8d5ca
qandeel.state.focus.indicator → qandeel.content.primary    → …                              #d8d5ca
qandeel.state.focus.companion → qandeel.world.fill         → …                              #101010
qandeel.state.selected.ink    → qandeel.content.primary    → …                              #d8d5ca
qandeel.state.selected.marker → qandeel.content.primary    → …                              #d8d5ca
qandeel.state.disabled.ink    → qandeel.expression.state.disabled                           #696762
qandeel.status.error.ink      → qandeel.expression.status.error                             #fe907e
qandeel.status.warning.ink    → qandeel.content.primary    → …                              #d8d5ca
qandeel.status.success.ink    → qandeel.content.primary    → …                              #d8d5ca
qandeel.status.informational.ink → qandeel.content.secondary → …                            #afaca3
```

**Read the decisions off the graph.** `state.rest.ink` reaches C3's permission class, so
E1 has not taken ownership of something C3 froze. `warning`, `success` and `informational`
reach the frozen reading ramp, so *"they have no colour of their own"* is visible without
prose. Exactly two names terminate in an E1 literal.

---

## 3. What is a token and what is not

The **rules** are not tokens. *"Press begins on pointer-down"*, *"Living Brass is
state-invariant"*, *"colour is never the sole carrier"* — none of those is a design value a
build consumes, and forcing them into a token type would use the format to make a rule look
like data. They live in `$extensions`:

- **`com.qandeel.freeze-boundary.productContract`** — 13 statements, at the root of the
  semantic document. The important half of the contract is not tokens at all. Beside it,
  **`revisedByE1R`** names the four that I-08B3.1-E1R corrected — **without restating them**,
  because a shipping contract that quotes a claim it has withdrawn can be grepped for that
  claim and found. The verbatim wording lives in one document, `E1R_REVISION_RECORD.md`.
- **`com.qandeel.companion`** — on each of the four status roles, naming the non-colour
  channels that role must ship with and why.
- **`com.qandeel.composition`** — on the `qandeel.state` group. The channel ownership table,
  the three precedence rules, and **all sixteen state combinations with a verdict and the
  rule that produced it**. Checks R27 and R28 read it back from here.
- **`com.qandeel.availability`** and **`com.qandeel.selected-unavailable`** — on
  `qandeel.state.disabled`. The two control patterns, and the control-type-by-control-type
  ruling on whether a chosen value can become unavailable. Checks R26 and R32.
- **`com.qandeel.status-policy`** — on the `qandeel.status` group and on each role. What
  the policy is, which roles have earned a hue, and for each that has not: the current
  expression, the condition that would overturn the refusal, whether the audit found that
  condition met, and the Product evidence a hue would require. Checks R03 and R29.

**THE EXTENSIONS ARE WHERE THE CHECKS LOOK, AND THAT IS THE POINT OF PUTTING THEM THERE.**
A rule kept only in prose can be checked only by grepping prose, which tests the wording. A
rule emitted into the shipping token document can be read back and reasoned over — which is
how R28 is able to **derive** each channel's writers from the matrix and reject an ownership
table that disagrees with it, rather than trusting either.

The **numbers** stayed tokens — the wash alpha, the indicator thickness, the offset, the
marker thickness, the two type weights — because a build really does consume those.

---

## 4. The groups C3 reserved, now filled

C3 left `qandeel.state` and `qandeel.status` **reserved and deliberately empty**, each with
a description naming E as its owner and asserting that no member may ever alias the identity
material. E1 fills both.

**A stale description is a real hazard here**, so it is checked. Check **R08** asserts that
after resolution both groups carry E1's description and *not* C3's "RESERVED AND
DELIBERATELY EMPTY" — a resolved tree that still says empty has not picked up E1. Its probe
resolves the chain **without** E1's file and confirms C3 alone still says it, which is
correct for C3 and wrong for the product.

C3's invariants **I-04** and **I-05** guarded those groups while they were empty. E1's
**R01** is the same guard against a populated group, and it now has a real surface.

---

## 5. Naming

The names C3 forbade — `gold`, `amber`, `yellow`, `accent`, `brandAccent`, `selectedColor` —
appear nowhere in E1's token output. Check **R05** scans by **key**, so a description may
discuss the words while no group may be called one.

`accent` is the one worth naming again. E1 adds a colour to a product that had almost none,
and the single most likely future misuse is for someone to reach for the error ink as "the
app's accent". There is no token called that, the error role's description says what it is
for, and the role has exactly one value so there is no family to spread.

---

## 6. Dark-led, not dark-locked

`appearance/light.interaction.tokens.json` is **empty, and the emptiness is the
deliverable.** Resolving the semantic layer against the light appearance leaves both E1
values **UNRESOLVED and names what is missing** — check **R17**.

A light set containing a copy of the dark values would be a light-mode error colour
invented by accident, shipping under a name someone trusted. **The dark error value cannot
simply be reused**: every floor that produced it is a statement about a near-black ground.
On a light ground its contrast relationships invert, and the dichromacy floors are measured
against different simulated neutrals. Owned by **I-08B3.1-F**.

Apple is explicit that a custom colour needs light and dark variants **and an
increased-contrast option for each**. E1 supplies none and names F as the owner of all
four.

---

## 7. Files

| file | authored by | contents |
|---|---|---|
| `tokens/base/interaction.tokens.json` | **E1** | state and status roles, the companion contracts, the freeze boundary |
| `tokens/appearance/dark.interaction.tokens.json` | **E1** | the two literals, with provenance |
| `tokens/appearance/light.interaction.tokens.json` | **E1** | deliberately empty |
| `tokens/qandeel-interaction.resolver.json` | **E1** | one resolution order over four systems |
| `vendor/d2r/**`, `vendor/c3/**` | inherited, frozen | vendored exact-byte, digests in `data/E1_VENDOR.json` |

**Everything under `vendor/` is inherited and byte-identical to the sealed package it came
from; everything under `tokens/` is authored by E1.** A reviewer can tell which is which
without reading a word of prose.

**The token files are GENERATED** by `tools/e1-tokens.mjs` from `tools/e1-derive.mjs`. Not
one colour component is typed: the hex and the sRGB components are computed from the
authored OkLCh triple by the same code that derived it. A token file someone edited by
hand is a token file that can disagree with the evidence that produced it.
