# I-08B3.1-F1R2 — THE ACCESSIBILITY CONTRACT

**REVIEW CANDIDATE. Nothing here is frozen.** Independent Product and Design review owns that
decision, and **F itself stays OPEN until I-08B3.1-F2 completes.**

**Governing state of what this package inherits:**
**I-08B3.1-D — QANDEEL LIGHT SYSTEM: CLOSED / FROZEN.**
**I-08B3.1-E — INTERACTION + SYSTEM SEMANTIC COLORS: CLOSED / FROZEN.**
Neither is reopened here. (The vendored copies under `vendor/d2r/**` and `vendor/e1/**` still
carry their authoring-time "FREEZE CANDIDATE" wording because they are byte-for-byte sealed
copies; see `README.md` and check **W-01**.)

The revision records are `F1R_REVISION.md` and `F1R2_REVISION.md`.

---

## 0. The five sentences a reader should take from this contract

> **1. AN ACCESSIBILITY SETTING CHANGES REPRESENTATION AND NOTHING ELSE.**
> **2. ACCESSIBLE SEMANTICS = PROJECT(V) — the accessibility layer may project semantic truth and
>    may not author it.**
> **3. ACCESSIBLE EXPRESSION ≠ REDUCED ANALYSIS — and existence is proved on the RENDERED object,
>    never on a path count and never on a JSON entry.**
> **4. WHERE V SUPPLIES NO VALUE, THE PROJECTION ANNOUNCES NO VALUE — absence is not a state, and
>    the accessibility layer may not choose one.**
> **5. ACCESSIBILITY OPERATES FROM THE SAME DISCLOSED V — it may not expand disclosure, and it
>    fails CLOSED rather than falling back to a raw identifier.**

The second and third were added by I-08B3.1-F1R; the fourth and fifth by I-08B3.1-F1R2. Each exists
because the package had violated it somewhere and nothing in the contract had forbidden it.

### And the contract on SCOPE, which is wider than any proof in this package

> **NO USER-EXPOSABLE DISCLOSED ANALYTICAL TRUTH MAY BE LOST SOLELY BECAUSE THE EXPRESSION IS
> ACCESSIBLE.** Every user-exposable semantic fact legitimately disclosed in canonical V and
> required for understanding or operation must have an equivalent accessible expression — evidence,
> provenance, uncertainty, epistemic status, temporal truth, relationships, actions, and anything
> else canonical V discloses. **No accessibility projection may silently drop such a fact.**

The proofs below are **bounded to the semantic dimensions this package's synthetic fixture
supplies**. The complete production mapping is validated against the **real canonical V schema**
during integration, and that dependency is recorded rather than answered:
`qandeel.accessibility.projection.completeness`.

---

## 1. The law, and the one sentence it reduces to

> **AN ACCESSIBILITY SETTING IN QANDEEL CHANGES REPRESENTATION AND NOTHING ELSE.**

Not privacy. Not ownership. Not authority. Not confidence. Not evidence strength. Not
importance. Not temporal truth. Not relationship truth. Not world membership. Not Product
eligibility.

This is not a slogan in a document. It is a statement about **reachability in a graph**, and it
is checkable because F1 does not create a sixth token system: it extends the chain the project
already has — B4R Surface → C3 Living Brass → D2R QANDEEL Light → E1 interaction and status —
so the accessibility overrides and the things they must never reach resolve out of **one** tree.

Check **S-01** is that law: no accessibility override may reach a **colour** under the identity
material, QANDEEL LIGHT, a state ink or a status ink.

---

## 2. The three transformations, and what each one is actually about

| setting | what it is about in QANDEEL | what it touches |
|---|---|---|
| **Reduced Motion** | which **channels** of a motion survive | `qandeel.accessibility.motion.*` — eight scalars, no colour |
| **Increase Contrast** | which **rung of the frozen reading ramp** a class points at, and the atmosphere's lightness | a modifier context; **no new literal** |
| **Reduce Transparency** | the **mechanism** a contour is drawn by, and the scrim | a modifier context; one computed substitution |

**Larger Text** and **Bold Text** are metrics and layout, not colour, so they resolve to no
token value in the colour tree and are proved by rendering. **Grayscale** and **Invert Colours**
are display-level transforms the OS applies after the app has drawn; F1 treats them as
**diagnostics** and ships no override for either, because an app repainting itself for them
would be fighting the compositor.

---

## 3. What "accessibility transforms expression" means mechanically

Every accessibility modifier's **default context declares zero token values** — check **D-03**.
The default path therefore resolves through none of them. That is why the Default Preservation
Gate is not a promise:

- **D-01** — with no setting on, every inherited role resolves to **E1's literal by E1's route**.
  Comparing values alone would pass a token that reached the same colour by its own path.
- **D-02** — **the ablation.** Every accessibility override file is replaced with an empty stub
  and the default document is rendered again. It is **byte-identical**, HTML and PNG. A check
  that merely rendered the default twice would pass no matter how badly the default was
  contaminated, because it would be contaminated identically both times.

---

## 4. The three laws the transformations obey

### HIGH CONTRAST IS NOT HIGH IMPORTANCE — and importance is a ratio

So the guard is on the **ratio**, not on either value. The gap between the weakest analytical
object and the loudest atmosphere contour may **widen** under Increase Contrast and may not
shrink. Default `5.435 / 4.209 = 1.2914`; increased `8.384 / 5.501 = 1.524`. Check **C-04**.

This is not decoration. Raising the atmosphere **alone** — the naive reading of the setting —
compresses that ratio to `1.028` immediately, which is the quiet thing arriving at the strength
of the meaningful thing. See `F1_INCREASED_CONTRAST.md` §2.

### A CLASS MOVES ALONG THE FROZEN RAMP; NO LITERAL IS INTRODUCED

Count the new hex values in `tokens/contrast/increased.accessibility.tokens.json`: there are
none. The whole package introduces exactly one literal, `#080808`, and it is the **computed**
opaque equivalent of the scrim over the World rather than a colour anybody chose. Check **S-02**.

### ACCESSIBLE EXPRESSION ≠ REDUCED ANALYSIS

132 cells of the parity matrix, read back out of **rendered documents** rather than imported from
the generator. Check **P-01**. It is a **bounded** proof: every cell is evidence about the semantic
dimensions the fixture supplies, and the matrix says so in its own `scope` block rather than in a
document. See `F1_ANALYTICAL_TRUTH_PARITY.md` §2.

And since I-08B3.1-F1R, **existence is decided by an object's own rendered presence and by nothing
else**: an element carrying *that object's* `data-qandeel-object-id` must exist and have a
laid-out box. Not "some SVG path exists", which is how a pattern could vanish while its cell
stayed green. Not an entry in the truth JSON, which is serialised straight from the generator.

Four **planted removals** — one Topic, the Connection, the Pattern, the Insight — each delete one
object from the rendering, leave it in the JSON, and must fail parity **for that object and for no
other**. Checks **P-02**, **P-03**.

And an accessible expression may not name **fewer** objects than the default names: check
**P-04**. That rule caught a real defect — above the label-escape scale the connection, pattern
and insight had no reading at all, and the inspection view now carries every kind.

---

## 5. Where a non-colour magnitude may move, and it is a list rather than a loophole

Increase Contrast overrides exactly one thing inside a protected namespace:
`qandeel.state.focus.thickness`, 2 px → 3 px. That list is **generated from the token files** by
check S-01, not maintained by hand, so an override added later is caught by its own presence.

The first version of that check forbade reaching `qandeel.state.*` at all, and failed on F1's own
shipped design. The correction is the precise law: **a state's COLOUR may never be reached; a
state's non-colour MAGNITUDE may be, and every such override is enumerated.** Thickening a
perimeter cannot make an object look more important. Brightening one can.

---

## 6. What F1 is forbidden from doing, and did not do

- **No Light Appearance.** The palette is not inverted, and no provisional light mode exists to
  fill a matrix. Resolving into `appearance: light` still fails loudly. §18.
- **No global motion system.** Not one millisecond of the frozen lifecycle is retuned; check
  **M-02** asserts rise 260 and fall 1,150 are read and never written. §19.
- **No new colour.** §24 asked for the transformation tokens needed and no token explosion: **56**
  token values across five files, of which exactly one is a literal. That number grew across two
  revisions and every value added was a **semantic requirement previously implicit inside an
  implementation value's description**.
- **No reopening of a frozen argument.** WCAG 2.2 SC 1.4.11's 3:1 is **adopted as a target** for
  the increased-contrast expression and explicitly not imposed on the default, because D2R
  argued on the record that a contour is not a graphical object under it.

---

## 7. What Brass, Light and Error do under every setting

| | Increase Contrast | Reduce Transparency | Reduced Motion | Larger / Bold Text |
|---|---|---|---|---|
| **Living Brass `#a58e6f`** | unchanged | unchanged | unchanged | unchanged |
| **QANDEEL Light `#fbf2db` / `#e8ddc2` / `#d6caa9`** | unchanged | **keeps its alpha** | keeps its meaning; loses travel, scale and blur | unchanged |
| **Error `#fe907e`** | unchanged | unchanged | unchanged | unchanged |

**LIVING BRASS IS STATE-INVARIANT IN VALUE AND IN APPEARANCE** (I-08B3.1-E1R). An accessibility
setting is not an exception to that invariant; it is the kind of thing the invariant was written
against. **QANDEEL LIGHT remains MEANING** — Increase Contrast does not brighten it, because
brightening every meaning event in proportion to a preference is meaning derived from a setting,
and Reduce Transparency does not solidify it, because the Light is **content, not material**.

---

## 8. Status

59/59 checks pass, and 59/59 probes reject the input built to make them fail.
**RECOMMENDED READY FOR FINAL INDEPENDENT CLOSURE REVIEW. NOT FROZEN. F REMAINS OPEN.**

> This line read `31/31` until I-08B3.1-F1R2 — F1's count, left behind when F1R took the verifier
> to 52 checks. The consistency check asserted that the *current* count appears **somewhere**, and
> it did, in a different document. It now also asserts that **no surface quotes a stale one**,
> which is the check that would have caught this.
