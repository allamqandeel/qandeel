# E1_REVIEW_BOARD

**I-08B3.1-E1**, revised by **I-08B3.1-E1R**. What to look at, in what order, and what
question each thing answers.

The Product Owner should be able to **SEE** the system. Start here, not in the token files.

> **If you reviewed I-08B3.1-E1 already, look at two things.** `b17-state-composition.png`
> is new and carries SELECTED + UNAVAILABLE, which the earlier package declared impossible.
> `b15-disabled.png` is rebuilt around the two availability patterns. **Everything else you
> approved is unchanged** — including the error boards, whose specimens are untouched;
> `b06`, `b07` and `b11` differ only in caption wording that stated a withdrawn claim.

---

## 1. Look at this first — sixty seconds

**`review/board/b10-integrated-screen.png`** — one real QANDEEL screen, 390 × 844, Arabic,
Estedad, carrying **all four systems at once**:

- the canonical **Q** and five navigation icons in **Living Brass** — identity material;
- a **QANDEEL Light** meaning event at the top — warm, edgeless, emergent;
- a **selected** row (marker on the right edge, ink and weight promoted);
- a **focused** row (a detached two-tone perimeter);
- an **unavailable** row (one ink, hierarchy gone);
- an **error** field (coral boundary, coral label, a crossed-circle glyph, Arabic copy);
- an **informational** line (secondary ink, bare letterform);
- a **disabled commit** that says why it is disabled.

**The question:** does the error read as failure rather than as a dim light, and does the
light read as meaning rather than as a status? If yes, the central separation holds.

---

## 2. Then the three separations, in order of risk

| board | question |
|---|---|
| `b11-separation.png` | Brass, Light, state and status side by side, and the five values measured apart. Is Brass still identity material? Is the Light still meaning? |
| `b04-selected-vs-focus.png` | Four rows in one list: selected-not-focused, focused-not-selected, **both**, neither. Plus the same distinction in the navigation. If these cannot be told apart, the system fails. |
| `b05-pressed-vs-selected.png` | Three lifecycles. Press-and-release leaves nothing. Press-and-commit leaves a marker. A selected row being pressed shows both. |

---

## 3. Then the states themselves

| board | what |
|---|---|
| `b01-state-matrix-surface.png` | five states × three control morphologies, on the functional Surface |
| `b02-state-matrix-world.png` | the same five on the World |
| `b03-focus.png` | focus on four morphologies and on both grounds |
| `b15-disabled.png` | **the two availability patterns, pixel-for-pixel identical**, the Brass case E1R narrows, and the forbidden alternative shown rather than described |
| `b17-state-composition.png` | **NEW.** SELECTED + UNAVAILABLE at the control type where it is reachable, the same thing focused, the channel-ownership table, the three precedence rules, and **all sixteen combinations with a verdict** |

---

## 4. Then the status roles

| board | what |
|---|---|
| `b06-error.png` | field validation in Arabic, a mixed-direction error with an LTR island, a failed operation, the error field focused, and the same field on the World |
| `b07-roles-without-colour.png` | **warning, success and informational — all kept, none with a hue yet.** This is the board to argue with if you disagree, and §6.2 below is the specific place to start |

---

## 5. Then the accessibility transforms

All three are derived **from the raster Chrome drew**, not re-rendered with different
tokens.

| board | what |
|---|---|
| `b12-integrated-greyscale.png` | WCAG relative luminance. **0 chromatic pixels.** Is everything still identifiable? |
| `b13-integrated-protanopia.png` | simulated protanopia |
| `b14-integrated-deuteranopia.png` | simulated deuteranopia |
| `b16-text-200.png` | the states and the error field at 200 percent text |

---

## 6. The decisions the Product Owner actually owns

E1 chose the reversible craft. These are the questions that are not craft, and the Owner's
answer changes the package rather than a number in it.

### 6.1 The two cases the audit found, which are the newest and sharpest questions

`E1R_PRODUCT_SURFACE_AUDIT.md` tested the three status refusals against eight real QANDEEL
surface categories. **Two of them met their own stated overturn condition.** E1R answers
neither with a colour and gives its reasons; both are the Owner's to settle.

1. **Ambient service or connection degradation in a Shared or Public world.** Persistent,
   detached from any commit, not a failure of anything the user did — every clause of the
   warning refusal is false of it. E1R's position: it must be *noticed without
   interrupting*, which is what a status hue is worst at, and QANDEEL's one hue means *act
   now*. Position, glyph and copy instead. **Audit §3.7.**
2. **A background result that arrives after the user has navigated away.** The success
   refusal depends entirely on the result resolving into a state the user is looking at.
   E1R's position: the missing thing is a **place for the result to land**, and a colour
   before that would decorate a gap. **Audit §3.8.**

### 6.2 The standing questions

3. **Is RED right for an Arabic-native product?** The one convention E1 kept. Apple's own
   guidance flags cultural colour meaning, and no Arabic-speaking user was asked. The
   **value** `#fe907e` is already Product-Owner approved; the **family** is the open
   question. `E1_KNOWN_LIMITATIONS.md` §2.
4. **Is one earned hue the right shape today?** Material 3 independently ships exactly that
   — 26 colour roles, error the only status role. It means a successful publish is confirmed
   in the Product's own ink and a warning stands on a boundary rather than glowing. `b07`.
   **Note that E1R no longer freezes the count**, so this is a question about now, not about
   forever.
5. **Is the warning expression strong enough?** It is a promoted boundary, a triangle and a
   sentence, and the thing it guards is an irreversible public disclosure.
6. **Where can a chosen value become unavailable?** E1R rules SELECTED + UNAVAILABLE at four
   control types and leaves one open: a list row that is the **current destination**. What
   QANDEEL does when the world you are standing in stops being available to you is a
   Connected Worlds decision. `b17`.
7. **How is availability expressed around a Brass-bearing object, if it ever must be?** E1
   answered with a universal law; E1R withdrew it as outside a colour package's authority
   and supplies no expression. Two of the three obvious answers are forbidden by the
   material.
8. **Is the focus indicator right, or too loud?** It is the brightest ink in the system at
   full strength, 2 px, detached, with a dark companion. It is deliberately not subtle:
   "aesthetically subtle but practically invisible" is a listed failure condition.
9. **Does the product still feel authored?** E1 adds one colour and spends the rest of its
   budget on form. If the answer is no, the honest question is whether the identity that is
   still owed belongs to E at all, or to the motion and navigation-form work C3 named.

---

## 7. What is NOT being asked of the Product Owner

No hexadecimal values. No opacity. No pixel widths. No easing. No durations. Those are in
`E1_FREEZE_BOUNDARY.md` §2 as production defaults, and they are the executor's to hold.

---

## 8. If you want the argument rather than the pictures

| | |
|---|---|
| **what I-08B3.1-E1R changed, and the withdrawn wording** | **`E1R_REVISION_RECORD.md`** |
| **the bounded audit, and the two conditions it found met** | **`E1R_PRODUCT_SURFACE_AUDIT.md`** |
| the thesis | `E1_DESIGN_RATIONALE.md` |
| the five states, the two availability patterns, the sixteen combinations | `E1_STATE_SEMANTIC_MAP.md` |
| which roles have earned a hue, with the conditions that overturn each | `E1_FUNCTIONAL_SEMANTIC_ROLES.md` |
| how the one colour was found, and what rejected the platform reds | `E1_COLOUR_DERIVATION.md` |
| the inherited collision, and the correction | `E1_DISABLED_COLLISION_RESOLUTION.md` |
| what is open or possibly wrong | `E1_KNOWN_LIMITATIONS.md` |
| every number | `E1_VALIDATION_RESULTS.md` |
