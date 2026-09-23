# B4_SURFACE_ROLE_CONTRACTS

**I-08B3.1-B4.6.** One production contract per frozen Product Surface role.

Short on purpose. These are meant to be usable in code review, next to
`B4_SURFACE_EARNING_TEST.md`.

---

## 0. The rule that governs all four

**PRODUCT ROLE ≠ ACCESSIBILITY ROLE.**

APPARATUS, ASIDE, PASSAGE and FIELD are **QANDEEL Product roles**. They answer *what is this layer
and what does it do to the World*. They do **not** dictate an ARIA or native accessibility role;
that is derived from the interaction actually inside the layer.

This is I-08B3.1-B3R's finding and it is not reopened. Concretely: an ASIDE holding a menu takes
menu semantics with a roving tab stop; an ASIDE holding an excerpt takes disclosure semantics and
`role="note"` — **never `role="dialog"` merely because it floats**. A layer is nonmodal because it
leaves the World live, takes no scrim and makes nothing inert. **It does not become nonmodal by
announcing that it is not modal.**

Every fill below is a token reference. **No role may ever carry its own colour value** — not even
the correct one. See `B4_TOKEN_ARCHITECTURE.md` §3.

---

## 1. APPARATUS

**Token:** `qandeel.role.apparatus.fill` → `qandeel.surface.functional`

**Earning condition.** There is standing Product machinery that must remain available while the
analytical plane is read. Remove the APPARATUS and the machinery has nowhere to live that is not
*in* the content.

**World relationship.** Adjacent. The World stays **live** and fully interactive. The APPARATUS sits
outside the content plane, along its edge.

**Persistence.** Always there. It does not appear, dismiss or animate in; if it comes and goes it is
not an APPARATUS.

**Allowed containment.** Controls, chips, utility rows, status text. More than one utility row is
permitted — density is a layout question, not a Surface question.

**Forbidden.**

- A lighter tone, a shadow, a card radius, or a second background for the page.
- Containing analytical content. Machinery only.
- A scrim, ever.
- Being suspended by anything other than a real PASSAGE. When a PASSAGE is up the APPARATUS **is**
  part of the suspended World and goes inert with it — B3 found the opposite in its own first
  implementation, where three standing machine controls stayed tabbable behind a modal and nothing
  visual said so.

---

## 2. ASIDE

**Token:** `qandeel.role.aside.fill` → `qandeel.surface.functional`
**Scrim token: none, and the absence is the contract.**

**Earning condition.** Something must be raised *from* a specific control or phrase, and the user
must be able to walk away from it without consequence.

**World relationship.** The World remains **LIVE**. The parent context keeps running and stays
interactive. Nothing behind an ASIDE is inert.

**No modal scrim.** A scrim follows from **blocking**, and an anchored light-dismiss layer blocks
nothing. Corroborated independently by Apple's guidance — *"A parallel, non-blocking panel uses
translucency and offset without a scrim so the flow isn't broken"* — though QANDEEL's ASIDE is
**opaque matte**, not translucent (`B4_SKILL_GATE.md` §1.3).

**Adaptive presentation allowed.** On a compact layout an ASIDE may present differently — anchored
popover geometry has nowhere to go on a phone. It remains an ASIDE: live parent context, nonmodal
behaviour, bounded contextual presentation. **No third mechanism is required and no tone difference
is permitted** (D-4, CLOSED / ACCEPTED).

**Accessibility pattern is derived, not assumed.** A menu-like ASIDE takes menu-button + menu
semantics, `menuitem` children, one roving tab stop, arrow traversal and Escape. An informational
ASIDE takes disclosure semantics with `role="note"`. Never `aria-modal` on either: it is defined on
`window` and inherits into `alertdialog` and `dialog` — `menu` is nowhere in that chain, so
`aria-modal="false"` on a menu is not a weaker claim, it is no claim at all.

**Forbidden.**

- A scrim, an elevation step, or a tone of its own.
- Making the World inert.
- Cardification of its contents.
- Being told apart from a PASSAGE by tone.

**Submenu.** Furniture of the ASIDE that raised it: same material, no new role, no tonal step, owned
by its parent row.

---

## 3. PASSAGE

**Tokens:** `qandeel.role.passage.fill` → `qandeel.surface.functional`;
`qandeel.role.passage.scrim` → `qandeel.passage.scrim`

**Earning condition — the Modality Test.** Walking away without choosing must **not** be a complete,
consequence-free outcome. If it is, this is an ASIDE.

**World relationship.** **SUSPENDED.** Nothing behind it is available — not the plane, not the FIELD,
and not the APPARATUS.

**Scrim.** Neutral black, alpha **0.50**, if the freeze passes. Uniform. It expresses **WORLD
SUPPRESSION**, not background-reading eligibility (D-5). Reading behind it falls to 3.75:1 and that
is neither a benefit nor a defect, because the World is suspended.

**Same Surface tone.** A PASSAGE is not lighter, bigger or heavier than an ASIDE. It is **blocking**,
and that is the difference.

**Focus lifecycle obligations — all four, proven behaviourally in I-08B3.1-B3R and carried forward
unchanged:**

1. On presentation, focus **moves to an appropriate element inside** the PASSAGE.
2. While it is up, focus **cannot escape** — Tab and Shift+Tab both cycle within it.
3. **Escape dismisses it**, and the World becomes operable again.
4. **Dismissal restores focus** to the invoking trigger or another explicitly justified target — on
   *every* dismissal path, including a visible Passage action, not only Escape.

**And the thing that must not be assumed.** `inert` is a containment mechanism. It is **not** a
focus-containment mechanism and **not** a focus-placement mechanism: it does not close the tab ring
(traversal goes last control → BODY → first control), and it places no focus at all. A package can
report perfect static containment on every frame it draws and still ship a modal a keyboard user
walks out of. The wrap and the placement must be implemented.

**Forbidden.**

- A second tonal step for a nested layer.
- A scrim that preserves background reading as a design goal.
- `aria-modal="true"` standing in for the behaviour. It does not make the element modal.

---

## 4. FIELD

**Token:** `qandeel.role.field.fill` → `qandeel.surface.functional`

**Earning condition.** There is a boundary the user **commits across** — text becomes an utterance,
a draft becomes a record. The boundary is the reason the FIELD exists.

**The fill is subordinate to the boundary duty.** A FIELD is told apart by a **Class S structural
line** on the commit boundary, not by its fill. If the line were removed and the FIELD still read as
a FIELD, the fill is doing work it should not be doing.

**Production text-input semantics are required when editable.** An editable FIELD must map to real
platform text-input semantics — `TextInput` or the platform-native equivalent — with the label, hint
and state the platform expects.

**This is a correction, and it is named as one.** B3's proof harness used a focusable `div` in
places. That was adequate for a *visual and containment* proof and is **not** a production textbox
specification. Proof markup must not be frozen as component architecture.

**Not B4's to freeze:** whether the input is controlled (`value` + `onChangeText`) or uncontrolled
(`defaultValue` + `onChangeText`). That is a state-ownership decision with real trade-offs — the
controlled form can flicker and drop characters during fast typing on the legacy architecture — and
it is a component decision, not a Surface decision (`B4_SKILL_GATE.md` §1.2).

**Forbidden.**

- **No card treatment.** No four-sided bright outline, no drop shadow, no card radius. The sealed
  predecessor's `field-as-card` failure capture is one of the four fixtures the anti-cardification
  guard is fired at, and it is rejected on rule C1.
- Encoding draft state, confidence or importance in the fill.
- Growing into a panel as its content grows. A composer grows; it does not become a container.

---

## 5. What every contract shares

| | APPARATUS | ASIDE | PASSAGE | FIELD |
|---|---|---|---|---|
| fill token | `role.apparatus.fill` | `role.aside.fill` | `role.passage.fill` | `role.field.fill` |
| resolves to | `expression.surface` | `expression.surface` | `expression.surface` | `expression.surface` |
| World state | live | live | **suspended** | live |
| scrim | never | never | **required** | never |
| own tone | never | never | never | never |
| shadow | never | never | never | never |
| accessibility pattern | derived from its controls | derived from its content | modal dialog | platform text input when editable |
