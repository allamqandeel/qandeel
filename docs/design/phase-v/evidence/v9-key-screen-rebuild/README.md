# V9 — Key-Screen Rebuild · Spatial Intelligence Core v1

**NON-CANONICAL prototype.** Phase V — Visual Language Discovery, task V9.
Not a visual language, not an art direction, not a design system, not production code.
**No canonical visual decision is taken here.**

Open `index.html` directly in a browser. No build, no server, no dependency, no network
request (system fonts only; no webfont, no image, no generated artwork).

**Read `TRUTH-MANIFEST.md` before reviewing anything.**

---

## What V9 is

The first coherent multi-screen rebuild after the V8 direction decision. It applies

> **V5B CLARITY FLOOR + SELECTED V6 SPATIAL-INTELLIGENCE PRIMITIVES
> = QANDEEL SPATIAL INTELLIGENCE CORE**

across four surfaces — Home, Conversation, Live Context, Deep Analysis — using the
same fixture V5B and V6 used, so no direction is flattered by easier content.

V9 freezes only the **cross-screen experience structure and visual-behavioural
grammar**, strongly enough for V10 to evaluate. See "Do not freeze" at the bottom.

---

## The one structural idea

V7 left exactly one unresolved question: **how to say "different ground" without an
ordinal encoding.** V6 answered it with a four-step monotonic lightness ladder, which
reads as a ranking of epistemic states and had to be denied in prose.

V9 answers it with **one ground and a nominal margin.** Every block QANDEEL holds sits
on the *same* paper and carries a rule on its start edge. What changes is the **kind**
of rule, never its value:

| Mark | Means | Never means |
|---|---|---|
| **one rule** | this stands in one reading | anything about how much it matters |
| **two rules** | the same recorded thing stands in **both** readings | closeness, strength, a relation weight |
| **broken rule** | a named unknown — the rule does not close | an error, a refusal, a scored gap |
| **brackets + outdent** | the reader brought this forward | a system judgement of importance |

A solid rule, a doubled rule and a broken rule are different *kinds* of line, not
different *amounts* of one thing. There is no lighter or darker plane to read as more
or less, and no line joins two objects, so there is no thickness, arrow or distance to
misread. Grayscale is a non-event because the grammar carries no value at all — it is
geometry.

**The shared record spans rather than sits between.** On desktop the two peer readings
are equal columns and the shared material is one row that **crosses** them: the record
once, under a doubled rule, with each reading's role stated directly beneath it in that
reading's own column track, picking up that column's exact margin position. The
alignment *is* the relation. This replaces V6's channel-and-opening, and unlike the
channel it also covers **same-role sharing** (the case V6 duplicated and the case real
data will be dominated by — see S5).

---

## Surfaces

| Surface | What it is here |
|---|---|
| **Home** | The quiet front door. The subject anchor, the real last exchange of the session in the same object grammar Conversation uses, one continuation, and — only when readings exist — one quiet way into the scene. No metric, no count widget, no feed, no card. |
| **Conversation** | The quietest surface. Ordinary Arabic turns with timestamps, correction entry on the turn that recites recorded material, one visible way into the context field, one into the scene. Exactly **one** spatial trace: QANDEEL's own turns carry the same start-edge rule that recorded material carries in the scene. No fragment, plane, band or relationship line ever appears here. |
| **Live Context** | Adjacent to Conversation — a real second column on wide, a drawer from the outward (left) edge on narrow with the conversation still visible behind. The active recorded material as sentences, provenance as the disclosure control, the user's own explicit context activation, foreground / remove-from-active, and one route into the readings. No readings, no roles, no unknowns, no band. |
| **Deep Analysis** | The scene: anchor, peer readings, each reading's own material, the shared row that crosses them, what each reading stands on (behind one disclosure per reading), named unknowns, provenance disclosure, correction routed to conversation, one restraint statement. |

**Restraint gradient:** Conversation carries one trace, the field carries one device
(the reader's own foreground), the scene carries the full grammar.

---

## Reviewer states and routes

Evaluator chrome sits in the top strip and is **not product UI**. Numbered buttons
`1`–`17` are the reviewer routes; `S0`–`S5` are the fixture states, identical to
V5B's and V6's:

| State | Scenario |
|---|---|
| **S0** | Early days: zero readings, no relation, two recorded items. |
| **S1** | Thin: one reading, one relation, one open unknown. |
| **S2** | Two peer readings, shared dual-role record, open unknowns. |
| **S3** | Correction RECEIVED / PENDING — nothing structural moved. |
| **S4** | One unknown RESOLVED and one SUPERSEDED, with no causal link to any answer. |
| **S5** | Near-duplicate peers, **same-role** shared record — the degenerate case the runtime does not prevent. |

Routes 1–15 are the required review states; 16–17 are the optional resolved /
superseded unknown states.

```
1  home-desktop                          9  deep-analysis-375-peer-b
2  conversation-desktop                 10  deep-analysis-375-shared-material
3  live-context-desktop                 11  deep-analysis-375-thin-one-reading
4  deep-analysis-desktop-two-peers      12  deep-analysis-375-zero-reading
5  home-375                             13  deep-analysis-375-near-duplicate-peers
6  conversation-375                     14  deep-analysis-375-open-unknown
7  live-context-375                     15  correction-pending-375
8  deep-analysis-375-peer-a             16  unknown-resolved-375
                                        17  unknown-superseded-375
```

Other chrome: `375px` (frame clamp — behaves exactly like a 375px viewport, because
every layout decision is keyed on `body[data-w]` and never on a media query),
`Grayscale`, `Reduced motion`, `Mark simulated` (outlines every simulated element in
place), `Long Arabic` (swaps in a long subject to stress the display line), `Truth
manifest`, `Truth self-check`.

### Reviewer deep link

`index.html?r=<route-name>` reproduces any state exactly. It drives the same controls a
reviewer would click, adds no product behaviour, and is unreachable from any product
control. `;` is accepted instead of `&` so the link survives shells that treat `&` as a
control character.

```
index.html?r=deep-analysis-375-shared-material;shot=1
index.html?state=s2;view=scene;narrow=1;pane=1;field=1;gray=1;rm=1;long=1
```

`shot=1` hides the evaluator chrome and pins the clamped 375px frame to the capture
origin — headless Chrome refuses a layout viewport below ~504px, so without that pin a
375px capture would slice a wider layout. It changes nothing inside the frame.
`probe=1` prints live geometry into a small overlay so a headless capture run can be
verified without reading a screenshot.

`review-screenshots/` was captured with these links and is review evidence only —
NON-CANONICAL, unedited, actual rendered states.

---

## Truth self-check

`Truth self-check` runs **21 assertions on desktop and 24 on the 375 stage** against
the live DOM and live fixture in whatever state is on screen. Run it on a settled
state. It includes the assertion V6's check did not have — the one covering the axis
V7 found V6 weakest on:

- no Western digits in the product surface;
- no confidence / rank / weight vocabulary — **and V9 needs no denial-stripping pass,
  because the surface carries none of that vocabulary at all, not even to deny it**;
- no page-level horizontal overflow;
- **all structural grounds share ONE background value**, and all recorded material one
  type size and weight — there is no plane ladder and no size ramp to read as rank;
- the shared material rendered exactly once in the scene;
- **focusing an ordinary fragment recedes the shared material too**, and the shared
  material can itself be brought forward — focus is state-dependent in both directions;
- peer readings share identical type and ground; peer controls are equal in width,
  size and weight;
- the marked pane is the pane on screen;
- **the stage is as tall as the pane you are on, not the tallest pane**;
- the closed context field is inert and shows nothing;
- Arabic: no letter-spacing, no italics, leading never below 1.7 at body sizes or 1.5
  at display sizes, nothing below 13px;
- every Arabic text run meets WCAG AA contrast, and the structural rule meets the 3:1
  non-text floor;
- a correction leaves material, readings, roles and unknowns identical;
- the composer draft, the caret and focus survive a full re-render;
- shared-material target navigation lands on the target and keeps it in the viewport.

**1400 / 1400 pass** across all 17 routes × 4 modes (plain, grayscale, reduced motion,
long Arabic).

---

## The V7 blockers, and how each is closed

| V7 blocker | What V9 does |
|---|---|
| **Resize destroys user input** | The composer and the correction textarea are static DOM and are never rebuilt, so value, caret and focus survive by construction. Everything that *is* rebuilt syncs drafts first and restores focus by a stable key plus the caret range. Layout is keyed on `body[data-w]`, so only a real breakpoint crossing re-renders at all. Verified across wide → narrow → wide with a live draft and a selection range. |
| **Resize drops focus** | Same mechanism; verified. |
| **"See its role" misses the target** | The move computes which pane actually contains the record, pages to it, scrolls the record into the viewport, moves focus to it, and announces the destination it actually reached. Asserted live, on both desktop and the 375 stage. |
| **Compressed Arabic display** | Display leading is 1.5, never below. Asserted globally, and stress-tested with a long subject that wraps to four lines with no collision. |
| **Modal correctness** | The correction sheet and the manifest are native `<dialog>` + `showModal()`: a real focus trap, a genuinely inert background (top layer), Escape, and focus returned to the trigger. The context field is `inert` while closed. |
| **Visual rank leakage** | One ground, one type size for material, a nominal margin instead of a lightness ladder, and live assertions on all of it. |

Two defects V7 recorded against **both** predecessors are also closed: a disclosure now
keeps focus on its own control instead of dropping it to `<body>`, and the shared record
is no longer permanently the most prominent object on the screen.

---

## 375px

Peers are never stacked vertically — vertical order would read as rank. The stage is a
real RTL horizontal scroll-snap track: peer A, the shared row, peer B, right to left,
with the shared thing physically between the peers as it is on desktop. Paging works by
three equal labelled controls, by keyboard (arrows follow RTL reading direction), and
by swipe; the gesture is never the only route. The active pane survives every re-render
and every resize.

Two deliberate departures from V6's stage:

- **No sliver of the neighbouring pane.** A 26px sliver is a good cue in a Latin
  layout; in RTL it exposes the *ends* of Arabic lines — mid-word fragments — and it
  costs the measure that long Arabic needs. The labelled pager is the affordance.
- **The stage is exactly as tall as the pane you are on.** A flex row is otherwise as
  tall as its tallest child, which is how V6's shared pane ended up 43–51% empty — a
  void whose size was set by the length of an unrelated reading, and which then needed
  a sentence to explain it away. Measured here: the shared pane is 270px while the
  tallest is 593px, and the stage is 270px. The emptiness cannot arise, so nothing has
  to claim it was deliberate.

---

## Interaction notes

- **Provenance is the disclosure control.** «مسجّل من كلامك · ⟨التاريخ⟩» is itself the
  button that opens the accounting, and correction lives inside it.
- **Foreground** raises one item with brackets, an outdent and full ink while the rest
  recede — never a plane, never a size change, never opacity alone. While it is active
  the scene says, in its own voice, that focus changed what you are looking at and
  nothing at QANDEEL's end.
- **Progressive formation** is carried as reader-stepped layered disclosure — the scene
  opens composed, and what each reading stands on is one press away — not as V6's
  five-step scene-builder. There is no timer, so it reads identically with motion off.
- **Correction** is received in conversation and **not applied**. The sheet says so
  before you send, the record keeps a pending note wherever it appears, and material,
  readings, roles and unknowns are identical before and after. **Nothing on the
  correction path animates**, so motion cannot imply a consequence that does not exist.
- **Escape** closes the dialog, then the field, then clears focus; focus returns to the
  control that opened it.

## Motion

Custom easing, transform/opacity only, hover gated behind `(hover: hover) and
(pointer: fine)`, `:active` scale on every pressable thing, and nothing transitions on
the first painted frame. Frequency governs everything: paging and foreground are
frequent, so they are 120–140ms or native; the drawer is occasional, so it gets 240ms.
`prefers-reduced-motion` and the reviewer toggle both reduce motion to nothing while
every state stays readable, because no state is carried by animation.

## Arabic-first

Composed RTL from the start, not translated into it: the grid's first column is the
right-hand column, the drawer docks at the outward edge, the stage pages right-to-left,
arrow keys follow reading direction, and the rules sit on the start edge. Arabic font
stack declared (system faces only, by task mandate). No letter-spacing on Arabic
anywhere, no italics, leading 1.85 for body and never below 1.5 anywhere, nothing below
13px. One numeral policy — Arabic-Indic, and only in record dates and times. Real
counts are stated as morphology («قراءتين»), never as a figure, so a count can never
read as a score.

## How prose-dependent is it?

V7 measured the share of visible characters whose job is to explain the interface
rather than carry the user's own content: **V5B 13.6%, V6 28.5%.** The same measure on
the same surface and state here is **11.6%** with both readings' ground opened (the
state comparable to V5B and V6, which showed assumptions inline) and **17.0%** as the
scene rests, where the reader's own content is deliberately still folded away.

## Deliberately not borrowed

Not Matn, not Threshold, not Wizn. No full territory system, no fixed central channel,
no opening device, no four-plane luminance ladder, no stretch-derived empty ground, no
permanently dominant shared record. No node map, no orbit, no constellation, no
starfield, no glow, no glass, no blur-as-depth, no particles, no circles as the object
language, no gold, no purple, no notebook or handwriting skin, no sci-fi HUD, no
gradient-as-intelligence, no icon-per-object, no score widget.

## Do not freeze

Palette, type stack, radii, spacing, surfaces, object forms, navigation labels, motion
curves and the Arabic-Indic numeral choice are all **temporary**. They exist only to
test the cross-screen grammar. Hierarchy is carried by size, weight, space and the
margin's *kind*, so grayscale is a non-event and colour never carries meaning.
