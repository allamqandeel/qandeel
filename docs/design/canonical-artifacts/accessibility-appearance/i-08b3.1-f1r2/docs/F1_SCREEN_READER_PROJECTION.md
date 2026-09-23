# I-08B3.1-F1 — PART F: SCREEN-READER SEMANTIC PARITY

## 1. What this is, and what it is not

**It is not permission to turn the Living Analysis Map into a list.** The visible Map stays
spatial, stays atmospheric, and is not simplified by one pixel for anyone.

The projection is a **parallel semantic layer over the same objects** — the only arrangement in
which both statements are true at once: *the Map is a world*, and *a reader who cannot see it
reaches the same analytical truth.*

## 2. The constraint that forces the architecture

> **A Skia `Canvas` exposes nothing inside it to an accessibility API.**

So the analytical content **cannot live in the drawing**. Every analytical object must be a real
view with a real accessible name **composed over** the canvas. That is I-08B3.1-D2R §5's
constraint, restated here as `qandeel.accessibility.projection.canvas` because F1 is where it
becomes checkable — and it is why this package's own proof page is built the same way: the field
is one SVG carrying `aria-hidden`, and every topic, relation, pattern and insight is a real DOM
element beside it.

## 3. The four decisions, each of which is a refusal

### TRAVERSAL IS BY KIND, NOT BY GEOMETRY

Apple: *"VoiceOver reads elements in the same order people read content in their active language
and locale."* For an Arabic UI that is **right-to-left and top-to-bottom** — a **geometric**
order. Geometry in QANDEEL carries no analytical meaning by contract, so the platform default is
**overridden, not inherited**.

The axis is **kind**: topics · connections · patterns · insights. A reader chooses an axis and
moves within it.

> This is the sentence that changed a decision by being a warning rather than a recommendation.
> Without it the projection would plausibly have been left to the platform — and would have
> shipped a reading order derived from x/y, which §12 forbids in as many words.

### NO RANKING IS INVENTED — and I-08B3.1-F1R had to correct how this was said

F1 described the within-axis order as *"the Product's own stable identity order"*. **No supplied
Product contract establishes the authored array order as a semantic identity order.** That
sentence gave a technical accident Product authority it does not have — a smaller version of
exactly the failure this axis exists to avoid. It is **withdrawn**.

**The rule now**, implemented by `neutralOrder()` in `tools/f1-sr.mjs`:

1. **GROUP BY KIND.** A legitimate Product distinction: a topic is not a pattern. The
   accessibility model needs it to offer an axis at all.
2. **WITHIN AN EQUAL, UNRANKED GROUP** — if the disclosed view supplies a canonical presentation
   order for that kind, use it. `V.canonicalOrder` is the **implementation seam** and it is
   deliberately `null` today. If a runtime later has such an order, it arrives there.
3. **OTHERWISE**, an explicitly **NON-SEMANTIC deterministic order**: ascending **Unicode
   code-point order of the object's stable id**. Stable, reproducible, independent of whatever
   order anything happened to be authored in — and it **means nothing**, which is the requirement.

> `localeCompare` was rejected deliberately. A locale collation is a *reading convention*; it
> differs between platforms and ICU versions, and it would make the order of an Arabic id set
> depend on which device the reader is holding.

Peers are declared `EQUAL, UNRANKED`. The order is **never** importance, confidence, merit, truth,
priority, recency, position or size, and no wording anywhere gives it Product meaning.

**Check R-02 verifies the ALGORITHM, not the sentence.** It recomputes the emitted order from the
ids and compares them; it rejects the withdrawn wording by name; and it scans every projection row
for the whole vocabulary of ranking — `rank`, `score`, `weight`, `confidence`, `priority`,
`importance`, `strength`, `relevance`, `position`, `index` — because what is forbidden is a value,
not a spelling.

**Check R-03 is the planted test.** The source array is reversed and re-sorted, and neither the
traversal order nor one semantic fact moves. Underneath it, the same comparison is run against an
order sorted by a **fabricated per-object strength**, which must be rejected — otherwise the first
half could pass because nothing could ever change.

### PEERS STAY PEERS

Several legitimate readings of the same material are announced as **peers**. The projection may
not select a "main" one, because no Product authority ranks them.

### THE LIGHT IS NOT ANNOUNCED

It is a transient carrying nothing the settled state does not also carry — the same property that
lets the settled state be read with no animation at all. What is announced is the **result**,
**once**.

## 4. What each object carries — and where every field comes from

> ### ACCESSIBLE SEMANTICS = PROJECT(V)
>
> and never `= INFER FROM VISUAL GEOMETRY / F1 RENDERER`.

The contract is a token: `qandeel.accessibility.projection.derivation`, class
**product-contract**. The projection **may project** semantic truth and **may not author** it.

| field | source |
|---|---|
| **accessible name** | the object's own name — never a description of its appearance |
| **Product role** | موضوع · علاقة · نمط · فهم. A **Product** role, kept in a separate column from the ARIA role so the two are never confused |
| **relationship** | stated **in words** wherever it is carried visually by adjacency, a line or a shared mark |
| **epistemic status** | **from V.** `observed` / `hypothesis` → ملاحَظ / فرضية. A reader who cannot see the difference must still be told it. **Not supplied → not announced** |
| **temporal state** | **from V.** `current` / `historical` → الآن / سابق |
| **actionable** | **from V.** A `<button>` when the object can be opened, a `<span>` when it cannot, plus «لا يمكن فتحه» in the accessible name — a reader who cannot see that a row is inert will spend their attention trying to activate it |

### Where V says nothing, the projection says nothing — and F1R2 made that true

This is the F1R correction, and it is the sharp end of *do not invent runtime data*.
`epistemicText` used to be `o.epistemic === 'hypothesis' ? 'فرضية' : 'ملاحَظ'` — an expression that
announces **observed** for an object whose epistemic status the view never asserted.

A value is announced in words **only if the view supplied it and the projection has a word for it**.
It does not guess, and it does not read a raw enum aloud.

**F1R then broke its own rule in the next sentence.** Where V asserted nothing it announced
«**غير مُحدَّد**» — *unspecified* — and defended it as reporting an absence rather than asserting a
status. The independent review was right: it **is** an authored semantic statement. It says the
Product state is UNSPECIFIED. The absence of a field does not mean that. The field may be:

- **not applicable** to this object family;
- **not disclosed** at this depth;
- **unavailable**;
- **absent** from this kind of object;
- or simply **not supplied**.

The accessibility layer has no authority to choose among those, and choosing one was a smaller
version of exactly the invention this layer exists to prevent.

> **IF V DOES NOT SUPPLY A SEMANTIC VALUE, THE ACCESSIBLE PROJECTION DOES NOT ANNOUNCE THAT
> SEMANTIC VALUE.** Nothing is spoken and nothing is rendered in its place. The row records
> `epistemicSuppliedByV: false` as **metadata about the view** — never announced, never readable as
> a status — because the parity matrix must be able to tell *"the view stated nothing"* from
> *"the projection lost it"*.

**If QANDEEL genuinely needs an explicit UNKNOWN / UNSPECIFIED / NOT DETERMINED state, canonical V
supplies it as a value** and the projection carries it like any other. It is not the projection's
to manufacture from a gap.

The important negative result is preserved: a missing epistemic status must not become `observed`,
must not become `hypothesis`, and must not become any other status. Check **A-05** asserts all four
halves — the value stays absent, nothing is spoken in its place, the withdrawn string appears
**nowhere in the shipped page**, and a value that *is* supplied is still announced. Without that
last half, "nothing is spoken" would be satisfied by a projection silent about everything. Its
planted probe is the **withdrawn composer**, run over the same row, which must be detected.

### The projection may not expand disclosure — and F1R's fallback did

> ### ACCESSIBILITY OPERATES FROM THE SAME DISCLOSED V.
>
> A relationship description may use only objects **legitimately present in that V**.

F1R's projector resolved a reference as `disclosed name ?? raw id`. An undisclosed endpoint would
have been announced to a screen-reader user as **its raw technical identifier** — content the
visual expression, which simply draws nothing there, never shows.

**An accessible expression that discloses MORE than the default is as serious a failure as one that
discloses less, and it is the harder one to notice, because every test that looks for loss passes.**

A Connection or a Pattern must never cause the projection to expose a hidden object's name, an
undisclosed object's id, hidden membership, or an unavailable context, merely because a disclosed
object references it. The contract is a token:
`qandeel.accessibility.projection.disclosure-boundary` = `same-V-fail-closed`.

**FAIL CLOSED.** Where a reference is not disclosed:

- no raw id is announced, and the undisclosed id does not travel into any field;
- no name is recovered from any other source — not from `TOPICS`, not from the visual scene;
- **no relationship prose is written at all.** For a Pattern, the member count goes too: naming
  three members of a four-member set discloses that a fourth exists, which is the membership the
  boundary withholds;
- the inconsistency is **recorded** as a referential-integrity failure, naming only the *disclosed*
  object that carries the broken reference, so an inconsistent V is **detectable** rather than
  silently becoming a sentence.

**Canonical V is required to be referentially closed** — every referenced id must itself be
disclosed in the same V. That is stated as an **upstream invariant**, and the projector does not
rely on it: a projector that trusts an invariant it cannot check leaks the first time the invariant
is broken.

Check **A-06** runs three planted broken views:

| planted fixture | raw id leaked | hidden name recovered | prose written | detected |
|---|---|---|---|---|
| a CONNECTION whose destination is absent from V | **no** | — | **no** | **yes** |
| a PATTERN one of whose members is absent from V | **no** | — | **no** | **yes** |
| a CONNECTION pointing at a **real D2R topic** V does not disclose | **no** | **no** | **no** | **yes** |

The third exists because it is the only one that can catch a projector reaching *outside* V for a
name: the first two use a marker id nothing has ever heard of, so a leak there could only be the id
itself. Underneath them the **withdrawn `?? id` resolver** is run over the same broken view and
must leak the marker — otherwise the three passes above could mean the detector is blind.

Checks **A-01** (no renderer file writes a semantic literal — a source scan, so that there is
nothing to fall back to tomorrow either), **A-02** (every supplied value preserved, every omitted
one omitted, proved against a fixture that deliberately varies all three fields), **A-03**
(provenance stamped into every surface), **A-04** (the contract is in the token tree), **A-05**,
**A-06**.

### The largest obligation the system creates

A **PATTERN** is a locus and four links. That is not readable to anyone who cannot see it, so it
has to become a **sentence** — and the sentence had to be *written*, not assembled:

> «نمط يجمع 4 مواضيع: «الرغبة في الإتقان» و«قلّة النوم» و«الخوف من التقصير» و«تراجع الطاقة»»

`يجمع` frames the pattern as **gathering a set** rather than as ordering a list, and the members
are joined by **و**, which carries no ordinal reading. A comma-separated list in Arabic would
have implied a sequence the Product does not have.

The summary line went the same way. Its first version read «1 علاقة، 1 نمط» — an English sentence
in Arabic words; Arabic does not put a numeral before a single thing. `tools/f1-sr.mjs` now
carries an `arabicCount()` implementing the 1 / 2 / 3–10 / 11+ rules with gender agreement, and
the line reads «8 مواضيع، علاقة واحدة، نمط واحد، وفهم جديد واحد.»

## 5. What is proved, and by what

The projection is rendered as a real page and its **accessibility tree is read back out of the
browser** over the DevTools protocol. Every name below is what the **engine computed**, not what
the generator intended.

| | result |
|---|---|
| AX nodes in the tree | 183 |
| nodes with a computed accessible name | 130 |
| analytical objects expected | **11** |
| objects **missing** an accessible name | **0** |
| the four axis headings present | **yes** |
| the PATTERN states its four members in words | **yes** |
| the CONNECTION states its source and destination | **yes** |
| a deliberately fabricated name is rejected | **yes** |

Check **R-01**.

## 6. What this is NOT evidence of

**A browser accessibility tree is not VoiceOver and is not TalkBack.** No screen reader was run.
No device was used. This is the single largest gap in the package and it is in
`F1_KNOWN_LIMITATIONS.md` as such.

## 7. The platform gap, named rather than designed around

Apple's VoiceOver guidance recommends the **custom rotor** for exactly this traversal —
`UIAccessibilityCustomRotor` / `AccessibilityRotorEntry`. **React Native does not expose it.**

Headings are the closest mechanism RN can express, and they are real: both VoiceOver's heading
rotor and TalkBack's heading navigation traverse them. But the difference matters — **a rotor
lets a reader jump between members of one kind from anywhere; headings require walking to the
group first** — and it is recorded in `F1_PLATFORM_MAPPING.md` as **NOT CURRENTLY EXPOSED**, with
the native API it would need, rather than smoothed over.

## 8. The implementation dependency this creates

§12 asks for the exact dependency to be recorded where the runtime does not expose enough
semantics. It is this:

> Every analytical object the Map draws must exist as a **real accessibility element** with a
> stable identity, a name, a role, and whatever semantic fields V discloses for it — and the
> PATTERN's membership sentence is **Product copy**, not a visual decision. The Map's renderer
> cannot produce any of it, because a Canvas has nothing inside it to expose.

And the second one, added by I-08B3.1-F1R2:

> **PRODUCTION ACCESSIBILITY MAPPING MUST BE EXHAUSTIVE AGAINST THE ACTUAL USER-EXPOSABLE V
> SCHEMA.** This package's fixture supplies three semantic dimensions; canonical V may legitimately
> expose evidence, provenance, uncertainty and more. The contract
> (`qandeel.accessibility.projection.completeness`) is that **no user-exposable disclosed
> analytical truth may be lost solely because the expression is accessible**; the exhaustive
> mapping is written and validated **when the canonical V schema is integrated**, and cannot be
> written before.

## 9. What changed in the shipped projection at F1R2

Only one thing a reader would see: **the object whose epistemic status V never supplied no longer
carries a spoken «غير مُحدَّد»** — it carries nothing there. The accessible tree went from 187
nodes to **183** for exactly that reason. Everything else — the axes, the order, the pattern
sentence, the connection sentence, the summary line, the counted-noun agreement — is unchanged.

**No Living Analysis World pixel changed.** The default raster is byte-identical to the one F1 and
F1R shipped.
