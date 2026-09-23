# I-08B3.1-F1R2 — FINAL ACCESSIBLE-SEMANTICS CLOSURE REPAIR

**A targeted revision. Not a redesign.** F1R's repairs are preserved whole; six semantic-authority
defects are closed.

**REVIEW CANDIDATE. Nothing here is frozen. F stays OPEN until I-08B3.1-F2 completes. F2 not
started.**

Every defect below has the same shape: **a bounded, local or instrumental fact was written down at
a higher authority than it has.** F1 invented semantic values; F1R fixed that and then froze the
fixture's field list, a measured line-height, and a decorative depth cue as though each were
Product law. That is a smaller version of the same error, and it is what this revision closes.

---

## 0. What did NOT change

**The Living Analysis World's pixels did not move.** The default raster sha256 is
`0a8cb8e0c2ecaf2d9e2283920d28ce3736ef17e64573c81db40f09a0369f4d17` — byte-identical to the one F1
and F1R shipped. The inherited-layer reference raster is `0c52861c66b6427cecb61b93…`, also
unchanged, and still pixel-identical to a page built from D2R's exports alone.

Living Brass, QANDEEL Light, Error `#fe907e`, Reduced Motion, Increase Contrast, Reduce
Transparency, the combined settings, larger-text behaviour, the inherited D2R geometry, the North
Star measurements and the North Star's ownership by **G** are all untouched.

**What did change in the shipped bytes** — disclosed rather than hidden:

| surface | change | visible? |
|---|---|---|
| `#qd-truth` in every rendered page | carries the fixture's `scope` and `unmappedFields` blocks | no — a JSON script block |
| the screen-reader projection | the object with no supplied epistemic status no longer carries a spoken «غير مُحدَّد» | **yes**, in the projection only — 187 AX nodes → **183** |
| the parity census | `anyLineHeightBelow1_6` → `anyArabicLeadingBelowThreshold`, plus a new measured `minMeasuredLeadingRatio` | no |
| the token files | 3 new contract tokens; `depth` and `leading-floor` reclassified | no |

The projection change is the one expected visible delta, and it is the point of REV-02.

---

## 1. REV-01 — the fixture's field list was not the Product's semantic model

`SEMANTIC_FIELDS = ['epistemic', 'temporal', 'actionable']` was documented as *"the complete list
of what a projection may carry"*. **Three fields a synthetic fixture happens to supply are not the
complete semantic model of canonical V.** The parity matrix proves preservation **for the
dimensions supplied**, and a real V may legitimately expose evidence, provenance, uncertainty and
more.

The two statements are now kept apart, and neither is allowed to wear the other's clothes:

**A — PRODUCT CONTRACT**, a token, `qandeel.accessibility.projection.completeness`:

> Every user-exposable semantic fact legitimately disclosed in canonical V and required for
> understanding or operation must have an equivalent accessible expression. **No accessibility
> projection may silently drop such a fact.**

covering, *where canonical V exposes them*: evidence · provenance · uncertainty / qualification ·
epistemic status · temporal truth · relationships · actions · any other user-exposable semantic
field. Those are **kinds of analytical fact**, deliberately **not** runtime field names — inventing
canonical field names to look exhaustive is the same failure as inventing semantic values.

**B — TEST FIXTURE COVERAGE**, shipped as data in `FIXTURE_SCOPE` and carried into `#qd-truth`, the
projection and the matrix's own `scope` block: `exhaustive: false`, what the proof establishes, and
what it does not.

**The implementation dependency, recorded rather than answered:**

> **PRODUCTION ACCESSIBILITY MAPPING MUST BE EXHAUSTIVE AGAINST THE ACTUAL USER-EXPOSABLE V
> SCHEMA** — writable only once the canonical V schema is integrated. Carried in
> `F1_F2_CARRY_FORWARD.md` §C.1 as a **gate**.

**And the one thing that could be fixed without a schema was.** `project(V)` no longer drops an
unrecognised field in silence: a supplied field the projector has no mapping for is reported in
`$unmappedFields`. A bounded projector cannot carry a field it has no vocabulary for; it can refuse
to be quiet about it, and that is the difference between a known limit and an undetected loss.

Checks **B-01**, **B-02**, **B-03**.

---

## 2. REV-02 — absence in V must remain absence

The documentation said *WHERE V SAYS NOTHING, THE PROJECTION SAYS NOTHING*, and the implementation
announced «**غير مُحدَّد**» when `epistemic` was absent. F1R defended it as reporting an absence
rather than asserting a status. **It is an authored semantic statement.** It says the Product state
is UNSPECIFIED, and the absence of a field does not mean that. The field may be:

not applicable · not disclosed at this depth · unavailable · absent from this object family ·
simply not supplied

**The accessibility layer has no authority to choose among those**, and choosing one was a smaller
version of exactly the invention this layer exists to prevent.

> **IF V DOES NOT SUPPLY A SEMANTIC VALUE, THE ACCESSIBLE PROJECTION DOES NOT ANNOUNCE THAT
> SEMANTIC VALUE.**

`epistemicSpoken` lost its `??` tail. The row carries `epistemicSuppliedByV: false` as **metadata
about the view** — never spoken, never rendered, not readable as a status — because the matrix has
to tell *"the view stated nothing"* from *"the projection lost it"*. If QANDEEL needs an explicit
unknown state, **canonical V supplies it as a value**; whether it should, and which of those five
things it would mean, is a Product question and is recorded as one in
`F1_KNOWN_LIMITATIONS.md` §10d.

The negative result is preserved and strengthened. Check **A-05** asserts four things at once:

| | result |
|---|---|
| the absent value did not become `observed`, `hypothesis` or anything else | **absent** |
| nothing is announced in its place — no epistemic vocabulary in the accessible label | **silent** |
| the withdrawn string appears **nowhere in the rendered page** | **nowhere** |
| a value that **is** supplied is still announced | **announced** |

The fourth matters as much as the second: without it, "nothing is spoken" would be satisfied by a
projection silent about everything. The planted probe is the **withdrawn composer**, run over the
same row, which must be detected as announcing a status.

---

## 3. REV-03 — accessibility must not expand disclosure through references

The projector resolved a reference as `disclosed name ?? raw id`.

**An undisclosed endpoint would have been announced to a screen-reader user as its raw technical
identifier** — content the visual expression, which simply draws nothing there, never shows.

> **An accessible expression that discloses MORE than the default is as serious a failure as one
> that discloses less, and it is the harder one to notice, because every test that looks for loss
> passes.**

The contract is a token — `qandeel.accessibility.projection.disclosure-boundary` =
`same-V-fail-closed` — and the projector **fails closed**:

- no raw id is announced, and an undisclosed id does not travel into any field;
- **no name is recovered from any other source** — not from `TOPICS`, not from the visual scene;
- **no relationship prose is written at all.** For a Pattern the member **count** goes too: naming
  three members of a four-member set discloses that a fourth exists;
- the inconsistency is **recorded** — naming only the disclosed object that carries the broken
  reference — so an inconsistent V is detectable rather than silently fluent.

**Canonical V is required to be referentially closed.** That is stated as an **upstream invariant**
and the projector does not rely on it, because a projector that trusts an invariant it cannot check
leaks the first time the invariant is broken.

**Three planted fixtures, check A-06:**

| planted V | raw id leaked | hidden name recovered | prose written | detected |
|---|---|---|---|---|
| a CONNECTION whose destination is absent from V | **no** | — | **no** | **yes** |
| a PATTERN one of whose members is absent from V | **no** | — | **no** | **yes** |
| a CONNECTION pointing at a **real D2R topic** V does not disclose | **no** | **no** | **no** | **yes** |

The third is the only one that can catch a projector reaching *outside* V for a name — the first
two use a marker id nothing has ever heard of. Underneath them, the **withdrawn `?? id` resolver**
is run over the same broken view and **must leak the marker**, so the three passes above are not a
statement about a blind detector.

---

## 4. REV-04 — presentation depth is not accessibility semantic truth

`nonColorCue.depth` = `level-line-count+scale` was a **product-contract**, in the group whose
meaning is *the companion channel a colour-bearing **distinction** ships with* — beside topic
identity, pattern membership and error.

I-08B3.1-D2R's `PRESENTATION_CONTRACT` declares `ring.radius`, `ring.layer`, `ring.contourCount`,
`ring.contourShape`, `ring.hue` and `field.parallax` all **`encodes: null`**. Requiring a non-colour
carrier for near-from-far therefore **attached a semantic parity obligation to something with no
semantics** — quietly making "near" a thing an accessible expression was required to preserve,
which is to say a thing that means something. **That is authority D2R explicitly removed,
reintroduced from inside the accessibility layer.**

**The craft is kept; nothing visual changes.** It moved to
`qandeel.accessibility.presentationCraft.depth`, class **production-default**, declaring
`carriesNoAnalyticalMeaning: true`, `serves: null` and the `encodes: null` properties it is about.
3 / 2 / 1 level lines and a scale remain in the default and in the grayscale diagnostic. `depth`
left check **N-02**'s required list (7 companions → 6).

> **Accessibility preserves the analytical OBJECTS and TRUTHS. It is not made responsible for a
> decorative presentation distinction that encodes nothing.**

Check **K-05** reads D2R's own table rather than a list kept here, so a property that later acquires
a canonical meaning leaves the forbidden set by itself. Its planted probe is the withdrawn token.

---

## 5. REV-05 — Arabic no-clipping is the contract; 1.6 is not a universal Product law

`text.leading-floor` = **1.6**, product-contract, described as irreversible for every Arabic-bearing
element at every size, forever. **That over-froze a measurement.** The line-height that avoids
clipping depends on the **font, the size, the renderer, the platform metrics and the content**.

The contract is now the **outcome**:

> **`text.arabic-must-not-clip`** = `adequate-glyph-extents` — *product-contract.*
> **ARABIC TEXT MUST NOT CLIP, LOSE DIACRITICS, COLLIDE DESTRUCTIVELY, OR BECOME UNREADABLE AT ANY
> SUPPORTED TEXT SCALE.**

**1.6 remains** as the **CURRENT TEST / PRODUCTION THRESHOLD** — `production-default`,
`serves: text.arabic-must-not-clip`. `leading-ratio` 1.7 remains tunable craft above it. Lowering
the threshold is legitimate **only as a measured result**, never as a space saving.

**X-02 was rewritten**: it validates the current proof against the current threshold while naming
the contract, which is independent of the literal, and it now reports the **measured** minimum
rendered leading ratio — **1.7 at every text setting including AX5, on every expression**. The
census field was renamed off the number, because freezing a production default into an identifier
is how a tunable value starts looking like a law. Checks **X-02**, **K-06**.

---

## 6. REV-06 — the parity claim, stated precisely

The matrix is unchanged and keeps everything it had: 12 expressions · 11 objects · **132 cells** ·
object-specific rendered presence · relationship, temporal, epistemic and actionability
preservation · naming-regression checks · four planted removals.

What changed is how it is **described**, everywhere it is quoted:

> **THE CURRENT FIXTURE PASSES ALL TESTED SEMANTIC DIMENSIONS.**

and no longer as though the matrix alone settled what canonical V can carry. The wider contract
stands:

> **NO USER-EXPOSABLE DISCLOSED ANALYTICAL TRUTH MAY BE LOST SOLELY BECAUSE THE EXPRESSION IS
> ACCESSIBLE.** The complete production mapping is validated against the real canonical V schema
> during integration.

Check **B-03** requires every document quoting the cell count to carry the bounding qualification,
and the matrix carries its own `scope` block so the qualification travels with the data.

---

## 7. And two stale numbers this revision found on its way past

Neither was in the brief; both were wrong in the shipped package.

- **`F1_ACCESSIBILITY_CONTRACT.md` §8 still read `31/31` checks and probes** — F1's count, left
  behind when F1R took the verifier to 52. The consistency check asserted that the *current* count
  appears **somewhere**, and it did, in a different document. **"At least one surface is right" is
  a weaker property than anyone reading that line would assume.** A new claim now requires **every**
  `n/n checks` or `n/n probes` figure anywhere in the corpus to be the current one, with the same
  withdrawal window so a revision record can still say what the count used to be.
- **The same document said "40 token values across five files"**, two revisions out of date.

---

## 8. The new guards, each with a planted probe

| # | guard | check | its probe |
|---|---|---|---|
| 1 | the fixture's field set is not described as exhaustive canonical V | **B-01** | the withdrawn sentence, standing alone |
| 2 | an absent epistemic field produces no invented status announcement | **A-05** | the withdrawn composer, over the same row |
| 3 | absent ≠ observed | **A-05** | ↑ |
| 4 | absent ≠ hypothesis | **A-05** | ↑ |
| 5 | an undisclosed Connection endpoint cannot leak a raw id | **A-06** | the withdrawn `?? id` resolver, which does leak it |
| 6 | an undisclosed Pattern member cannot leak a raw id | **A-06** | ↑ |
| 7 | no hidden name is recovered outside V | **A-06** | a real D2R topic removed from V, name recoverable from `TOPICS` |
| 8 | dangling references are detected and fail closed | **A-06** | ↑ |
| 9 | an `encodes: null` Ambient property cannot become a required semantic carrier | **K-05** | the withdrawn `depth` token |
| 10 | Arabic no-clipping is the Product contract | **K-06** | the threshold classified as contract, which is what F1R shipped |
| 11 | the numeric 1.6 is not an irreversible Product law | **K-06** / **X-02** | a row measured below the current threshold |
| 12 | the parity proof is described as bounded to the tested dimensions | **B-03** | a document quoting the cells with no bounding language |
| + | the completeness contract exists and an unmapped field is detected | **B-02** | a view supplying a field the projector has no mapping for |

---

## 9. Result

| | |
|---|---|
| checks | **59 / 59** |
| probes rejecting | **59 / 59** |
| consistency surfaces | see `data/F1_CONSISTENCY.json` |
| parity cells | **132**, 0 failures — bounded to the tested dimensions |
| planted object removals | **4 / 4** caught, none disturbing another object |
| planted disclosure fixtures | **3 / 3** fail-closed, probe leaks |
| token values | **56** — 38 product-contract, 16 production-default, 2 implementation-strategy |
| new colour introduced | **none** |
| **default raster** | **`0a8cb8e0c2ecaf2d…` — unchanged** |

**RECOMMENDED READY FOR FINAL INDEPENDENT CLOSURE REVIEW. NOT FROZEN. F REMAINS OPEN. F2 NOT
STARTED.**

**No real VoiceOver or TalkBack run exists.** It is a mandatory implementation / integration
validation gate, not another F1 stage, and browser AX-tree evidence does not stand in for it.
