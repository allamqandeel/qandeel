# QANDEEL — T-11 Controlled Amendment
## Secondary Return Acts under «طرق العودة»

**Status:** `CANONICAL CONTROLLED AMENDMENT — FROZEN WITH I-08B3.1-G2.3`  
**Amends:** `docs/responsive-recomposition-v1.md` §4, §10 and §14 only  
**Does not amend:** T-08 Return meanings, availability, canonical order, labels, hints or executors  
**Product proof:** `I-08B3.1-G2.3-MATCHING-COPY-RETURN-AMENDMENT`  
**Reviewed proof ZIP SHA-256:** `12CCA79C35D74DA8BC951B87B4827029AA50B2D4EB8FCA050934A46C4077C370`

This record is additive. The original T-11 document remains the historical closure record. For the
narrow Return-presentation question below, this later controlled amendment is authoritative.

---

## 1. Why an amendment is needed

T-11 originally froze three absolute presentation statements:

- §4: nothing is put behind a generic "More";
- §10: no act is hidden, collapsed or deferred to a menu;
- §14: a "More" control, overflow menu or collapsed group is rejected.

G2.2 and G2.3 proved a more compact Analysis composition in which the world remains visually dominant
without changing any Return truth.

The Product Owner approved that compact direction.

The amendment therefore narrows those T-11 statements without weakening their purpose.

---

## 2. The only grouping now permitted

The prohibition on generic collapsed / overflow presentation remains binding.

One narrow exception is canonical:

> When the Product context has one clearly dominant Return act, that act remains directly visible and
> the secondary offered Return acts may be grouped under the explicit semantic affordance
> **«طرق العودة»**.

All of the following conditions are mandatory:

1. **Return-only content.** «طرق العودة» may contain Return acts only.
2. **No generic overflow.** It is not More, Options, an ellipsis, a generic overflow menu, settings,
   navigation, Replay or Matching.
3. **One direct primary act.** A clearly dominant Return act remains directly visible.
4. **No semantic rewrite.** Every secondary act keeps T-08's exact meaning, availability, canonical
   order, label, hint and executor.
5. **No merging.** There is no generic Back / Home / Reset act.
6. **No capability loss.** Every offered secondary act remains reachable one activation away by
   pointer, keyboard and screen reader.
7. **No responsive authority.** Width, device, breakpoint, font scale and screen class may not decide
   which act is dominant or whether the grouping exists.
8. **No duplicate act.** The directly visible act does not also appear inside «طرق العودة».
9. **No canonical state.** Open / closed is presentation state only and changes no canonical state,
   temporal truth, camera, disclosed `V`, inspection truth or reversible history.
10. **No group without a dominant act.** If the Product context has no clearly dominant Return act,
    the exception does not apply and the offered acts remain directly presented.
11. **Single / empty sets stay simple.** One offered act needs no secondary group; an empty offered set
    renders no Return group.

---

## 3. Ownership boundary

T-11 owns responsive recomposition, not Product Return semantics.

Therefore:

- the responsive owner does not select or rank Return acts;
- the grouping rule is width-independent;
- the Product / Return presentation owner supplies the directly visible act and presentation state;
- T-08 remains the authority over what acts are actually offered and what each act means.

G2.3 does **not** freeze a universal semantic ranking of all six T-08 Return acts. The reviewed P3/P4
contexts are accepted evidence of the presentation direction, not a license for T-11 to invent rank.

---

## 4. Accessibility and interaction requirements

Any production implementation of this amendment must preserve:

- a 44-point minimum target for «طرق العودة» and every disclosed act;
- keyboard and screen-reader reachability;
- visual order = focus order;
- T-08 canonical act order inside the disclosed group;
- `aria-expanded` / equivalent expanded-state truth on the affordance;
- no published item count, rank or position that T-08 does not own;
- pointer-through outside real controls;
- focus recovery after Escape and after a Return act causes the group to recompose;
- reduced-motion parity.

These requirements do not create a new Return act.

---

## 5. Exact supersession of the old T-11 wording

For future interpretation, the old absolute statements are read as follows:

### T-11 §4

Old meaning:
> compactness may not hide Product truth behind a generic "More".

Amended meaning:
> that prohibition remains, **except** for secondary Return acts under the exact «طرق العودة» rule
> above, which is width-independent and keeps one clearly dominant Return act directly visible.

### T-11 §10

Old meaning:
> every control remains reachable and no act is collapsed.

Amended meaning:
> every control remains reachable; secondary Return acts may be one activation behind «طرق العودة»
> under this amendment, with equivalent pointer, keyboard and screen-reader reachability.

### T-11 §14

The rejected pattern remains:
> a generic More / Options / overflow or unrelated collapsed group.

The following is **not** that rejected pattern:
> «طرق العودة», because it is semantically named for exactly what it contains, contains Return acts
> only, is width-independent, preserves T-08 truth and exists only beside a directly visible dominant
> Return act.

No other §14 rejection changes.

---

## 6. Historical traceability

The original T-11 closure evidence proving "no More indirection" remains valid evidence for the
implementation that originally closed T-11. It is no longer a perpetual ceiling against this one
later Product-approved Return grouping.

This amendment does not reopen:
- T-11's responsive bands or breakpoints;
- world sizing;
- map geometry;
- RTL world behavior;
- timeline semantics;
- T-08's Return truth;
- T-07 executors.

The old T-11 reference to `QAN-BL-T12-03` is historical. That backlog item was later closed by T-12.
G2.3 does not reopen it and creates no replacement backlog item.

---

## 7. Implementation status

This amendment freezes the Product / presentation contract only.

It does **not** claim that production `ReturnControls` already implements the grouping.

A later implementation task may add the bounded presentation seam required to realize this contract,
provided it leaves T-08's Product truth untouched.

> **T-11 RETURN PRESENTATION CONTROLLED AMENDMENT — FROZEN**
