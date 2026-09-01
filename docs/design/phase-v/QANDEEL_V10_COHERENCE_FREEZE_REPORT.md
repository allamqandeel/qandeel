# QANDEEL — V10 COHERENCE FREEZE REPORT

## Cross-Screen Coherence + Structural Visual Grammar Freeze

**Phase:** V — Visual Language Discovery
**Task:** V10 — final adversarial freeze gate
**Type:** COHERENCE / SCALABILITY / TRUTH / ACCESSIBILITY FREEZE — not a visual exploration
**Canonical visual decision:** NOT TAKEN HERE
**Production changes:** none
**V9:** byte-unchanged
**Verdict:** `FREEZE WITH EXPLICIT OPEN ITEMS`

---

> ## Post-review semantic clarification — `V10-FIX-01`
>
> **This report is historical and is left as measured. It is not the canonical freeze.**
> Everything below records what was tested, measured and found in the V10 harness before the
> independent Phase V closure review. Nothing in it was rewritten by the amendment; no test
> result, measurement or count was altered.
>
> One reading of this report must not be carried forward. Where it states the truth
> constraint as *nothing may be placed nearer than anything else* — §5.3 most directly, and
> the "not spatial value" line in §7 — that is a true description of **this harness at this
> baseline**, where no relevance signal exists to place anything by. It is **not** a
> permanent prohibition on QANDEEL ever repositioning Live Context items by their relation
> to the current conversation.
>
> The canonical rule now lives in `QANDEEL_V10_STRUCTURAL_GRAMMAR_FREEZE.md`: **rank-like**
> near/far is forbidden permanently (A15, D7), while **contextual-relevance** near/far is a
> `RESERVED FUTURE CAPABILITY — SIMULATED ONLY UNTIL RUNTIME SUPPORT EXISTS` (A22, A23, and
> the runtime gate in "Runtime / Truth Boundaries"). Contextual relevance is not importance,
> truth, confidence, evidence strength, priority, certainty, correctness or rank.
>
> **This report tested no runtime relevance and makes no claim about one.** Its Live Context
> findings measured a field with no relevance signal behind it, which is exactly why they
> could not and did not evaluate the reserved capability.
>
> Two pointers are superseded by the amendment, and only these two: the principle counts
> quoted in §9 are now **23** locked experience/semantic principles (A22 and A23 were added),
> and the pager-ceiling risk carried forward in §8.3 is now the **#1 HIGH-PRIORITY OPEN
> ITEM** for Final Visual Design — *Large / double-digit peer navigation* — recorded in
> `QANDEEL_PHASE_V_Closure_Structural_Grammar_Freeze.md`. The measurement itself (six
> controls at 375px; seven wrap and clip) stands unchanged.

---

# 0. METHOD

V9 was read in full as source (1,509 lines), then opened in a real browser and exercised.
Its own self-report was not accepted as evidence: every claim the freeze would rest on was
re-derived from the live DOM, computed styles and measured geometry.

V9's self-check was re-run independently — **21/21 on desktop two-peer, 24/24 on the 375
stage** — and its documented behaviours were confirmed (stage height 270px on the shared
pane against a tallest pane of 593px; one ground; single-instance shared material).

Then the runtime conditions V9's fixtures never reach were forced into V9 at runtime, and
three defects were reproduced by measurement. Those defects, not a design opinion, set
V10's agenda.

The V10 harness was built at `prototypes/v10-coherence-freeze/`, the mandated stress tests
were run in it, and every state was verified by a live assertion suite in headless Chrome
across five modes.

**Skills loaded and used:** `design-critique`, `frontend-design`,
`designing-arabic-frontends`, `fixing-accessibility`, `emil-design-eng`, `prototype`.
Not invoked: `apple-design`, `user-research`. `writing-eloquent-arabic` was not loaded;
the two copy changes made (§3, B7 and B8) are truth corrections, not style edits, and are
both reductions.

Where a verdict rests on a measurement, the measurement is quoted.

---

# 1. HEADLINE

The V9 grammar **survives** dense sessions, three peer readings, a five-item context
field, long Arabic, RTL, accessibility, reduced motion and every V7/V9 state-stability
blocker — but only after three defects in V9 are repaired, and only if the exact margin
artwork is **not** frozen.

V9's structural claim was true for the fixtures V9 held. It was not true for the fixtures
the runtime permits. Two of the three defects are truth failures, not layout failures: one
hid a whole peer reading from the user, another asserted a relation that does not exist.

That is the value V10 produced. The grammar is sound; V9's implementation of it assumed a
world with exactly two readings and at most one shared record, and the runtime guarantees
neither.

---

# 2. THE THREE V9 DEFECTS, REPRODUCED

All three were measured **in V9**, at runtime, without editing V9. None is reachable from
V9's own fixtures S0–S5. V9 remains byte-unchanged; they are fixed in the V10 harness only.

## B1 — three or more peers are silently dropped at 375px · TRUTH

V9 builds the paged stage as `readings[0]`, the shared row, `readings[1]`. A third reading
gets no pane, no pager control and no trace.

```
readings loaded : [قراءة أ, قراءة ب, قراءة ج]
panes rendered  : [قراءة أ, اللي في القراءتين, قراءة ب]
pager labels    : [قراءة أ, المشترك, قراءة ب]
pane[data-pane="c"] present : false
```

The user is shown two readings and told they are the readings. This is the exact failure
mode Risk C named — "the grammar must not break or silently privilege the first two" —
and it is worse than privileging: the third does not exist on screen at all.

## B2 — three or more peers on desktop: unequal columns and a mis-attributed role · ORDINAL LEAK + FALSE RELATION

V9's grid is `grid-template-columns: 1fr 1fr` with per-id column rules for `a` and `b`
only. Measured at a 1440px viewport:

```
grid-template-columns : 260.225px  260.237px  407.538px
peer أ  column 1  width 260px
peer ب  column 2  width 260px
peer ج  column auto  width 408px      ← 57% wider than its equals
```

Size is the most direct ordinal channel there is, and §12 makes it a hard gate. Two
columns at 260px are also **34 characters** of Arabic measure — below the readable floor.

Worse, in the shared row:

```
role «بتسند قراءة أ»   right edge 1392   (peer أ's column)
role «بتشدّ ضد قراءة ب» right edge  920   (peer ب's column)
role «بتسند قراءة ج»   right edge 1392   ← peer أ's column
```

The alignment *is* the relation in V9's own account of itself. A role line stating "this
supports reading ج" rendered in reading أ's track asserts a membership the data does not
contain.

## B3 — two or more shared records are painted on top of each other · DATA LOSS

Every `.band` carries `grid-row: 3`. Grid stacks same-area items. Measured with two shared
records:

```
band 1  grid-row 3  top 654  bottom 843
band 2  grid-row 3  top 654  bottom 843   ← identical
```

Only the last is visible. §6 mandates *at least two* shared materials in the dense
fixture, so this was unreachable in V9 and unavoidable in V10.

---

# 3. FIVE MORE DEFECTS FOUND WHILE BUILDING THE STRESS STATES

All are in V9's mechanism, carried into V10, and fixed there.

**B4 — the cross-surface move's landing depends on an animation · ACCESSIBILITY + FALSE ANNOUNCEMENT.**
`goToRole` runs entirely inside `requestAnimationFrame`, scrolls with `behavior:'smooth'`,
and announces arrival on the same frame. Two measured failures: with the page hidden,
`requestAnimationFrame` never fires (`visibilityState:"hidden"`, `rafFired:0`) and the move
does nothing at all while the live region has already said it arrived; and in the dense
scene with an item raised, the smooth scroll did not land within 1.4s, leaving keyboard
focus on an element at `top:1299` with a 900px viewport — focus moved off-screen, which is
a WCAG 2.4.7 failure, plus an announcement of an arrival that had not happened.
*Fixed:* the move no longer runs inside `requestAnimationFrame` (`render()` writes the DOM
synchronously and `getBoundingClientRect()` flushes layout, so the frame bought nothing),
a settle loop guarantees a landing within ~600ms by falling back to an instant scroll, and
the announcement is made only after the target is actually in the viewport.
**Motion is allowed to make an arrival legible. It is never allowed to be the arrival.**

**B5 — dialog focus return can lose a race · ACCESSIBILITY.**
`close` is dispatched as a queued task and the background's inertness lifts on its own
schedule. A single `focus()` from the `close` handler intermittently landed while the
target was still inert and dropped focus to `<body>` — reproduced repeatedly across
routes. *Fixed:* a one-shot re-assert on the next task.

**B6 — the pending-correction note repeats · TRUTH.**
V9 prints the pending note on every turn with `recites:true`. V9's fixtures have exactly
one reciting turn; the dense session has two, so one correction rendered as two pending
notices. *Fixed:* the note belongs to the most recent recitation — the one the correction
was made against.

**B7 — the shared-record heading repeats and under-informs · COHERENCE.**
V9 prints «حاجة واحدة، داخلة في القراءتين» above *every* shared record. With three, the
same sentence appears three times and reads as boilerplate; and at three peers the
generalised form would say "two of these" and leave the reader to find which two. It is
also redundant: the role lines directly beneath each record already name every reading it
stands in and the role it carries there. *Fixed:* one heading for the region
(«حاجات من كلامك داخلة في أكتر من قراءة»), membership carried by the role lines. The
"some but not all" case became more explicit, not less.

**B8 — "below" is false on the paged stage · TRUTH.**
A reading with no own material said its material is «في الحتة المشتركة تحت» — "in the
shared part *below*". On the paged stage the shared region is a sibling pane, not below.
*Fixed:* stage-aware wording («في مساحة المشترك»).

**B9 — V10's own adaptation introduced a measure ceiling · CAUGHT BEFORE FREEZE.**
Moving the paged stage onto wide viewports handed Arabic a 130-character measure. *Fixed:*
the pane's blocks take the same 62ch cap the build already applies to its other prose. At
375px every block is already narrower, so no narrow state changed.

---

# 4. THE ONE STRUCTURAL ADAPTATION

§7 permits adapting the navigation "structurally but minimally" if the exact geometry
cannot scale. It cannot: three columns inside V9's 1040px scene are 309px, which is 40
characters of Arabic.

**The rule added — and it is a single rule:**

> Peers stay equal columns for as long as **every** column still holds a readable Arabic
> measure. When they cannot, **all** peers move to the paged stage together — the same RTL
> paged stage the build already uses at 375px.

Never two columns and an orphan. Never a main and a secondary. Never a narrower column for
a later peer. The composition's outer measure grows with the column count (1040px at one
or two peers — V9's value, unchanged — 1360px above that) instead of squeezing columns.

The floor is **42 Arabic characters**, measured live from the rendered face at boot rather
than assumed, so it survives a type change in the next phase. Below 42 characters a peer
column stops being a column and becomes a sidebar, and a sidebar beside two columns is a
rank.

**Measured consequences:**

| Viewport | Peers | Stage | Column width |
|---|---|---|---|
| 1440px | 2 | grid | 492 / 492px (V9's exact geometry, unchanged) |
| 1440px | 3 | grid | **415 / 415 / 415px** — equal, floor 321px |
| 1280px | 3 | grid | 368 / 368 / 368px — equal, above floor |
| ~1140px and below | 3 | **paged** | all four panes equal, no hierarchy |

This invents no art direction. It reuses an interaction already in the build, already
non-ordinal, already RTL-correct, already keyboard- and pager-driven.

---

# 5. STRESS-TEST FINDINGS

## 5.1 Dense analysis (§6) — **PASS, with a named degradation**

Fixture `d1`: 2 peers · 11 recorded fragments (10 carrying a role) · **3** shared records
(one same-role in both readings, two dual-role) · 3 assumptions and 2 disconfirming
conditions per reading · 3 named unknowns · long Arabic in four fragments · a longer session.

**Desktop — the required questions:**

- *Does Deep Analysis become a report?* **Yes.** 2,511 CSS px at a 1280px viewport with
  both readings' ground opened. It is a long, calm, correct document. This is the honest
  answer and it is not a blocker — but it is the finding the next phase inherits.
- *Does the margin grammar become repetitive?* **Yes.** Peer ب carries five consecutive
  records, each with an identical hairline. At that density the rule stops distinguishing
  and starts patterning: it becomes texture rather than a mark. Nothing false is asserted —
  every rule still means exactly what it means — but the *distinguishing* work the mark does
  at low density is not work it does at high density.
- *Does the reading order remain obvious?* **Yes.** Peer statements → each reading's own
  material → the shared region → what each stands on → what is missing. The order held
  under every stress state tested.
- *Is shared material still discoverable?* **Yes**, and more so after B7: one region, one
  heading, three records, each naming its readings.
- *Does the single ground still work?* **Yes** — and it is what makes the density legible
  rather than busy. One ground and one material type size are asserted live in this state.
- *Does the scene require a second surface value?* **Not for correctness. Yes for
  navigation.** This answers V9's own biggest stated uncertainty. Nothing at density
  becomes ambiguous or unreadable on one paper. What is missing at density is a way to
  *skim* — and a skim affordance is a navigation problem, not necessarily a surface-value
  problem. The next phase must not reach for a second value assuming it solves
  comprehension; it solves nothing there.

**375px:**

- *Is paging still usable?* **Yes.** Three panes (أ / المشترك / ب), stage 1,480px, the
  shared pane reachable in one press from either peer.
- *Does content length destroy orientation?* **No.** The pager is always at the top of the
  stage and always says which pane you are on; the marked pane is asserted to be the pane
  on screen.
- *Can the reader return to the shared material?* **Yes**, in one press, from any pane.
- *Do unknowns remain distinguishable?* **Yes** — the broken rule plus «لسه ناقصة» in
  words. The words carry it; the rule reinforces it.
- *Does the scene become an endless document?* **Per pane, it is long.** The pager keeps
  each pane bounded and orientation intact, which is exactly the value of the paged model
  at density.

## 5.2 Three peer readings (§7) — **PASS**

Fixture `p3`: three equal readings, ج a near-duplicate of أ, `m2` carrying a role in all
three, `m8` carrying a role in أ and ج only, one unknown belonging to ب alone.

**Desktop, the required questions — all four answered no:**

- *main/secondary hierarchy?* No. Columns 415/415/415px, identical type, weight, colour and
  ground; asserted live.
- *tiny columns?* No. 415px = 54 characters, against a 42-character floor.
- *unreadable line lengths?* No.
- *a forced dashboard grid?* No. It is three columns and one crossing region — the same
  composition as two, with one more column.

Role placement is now by index, so the alignment is true for any N. Measured:

```
peer column right edges : 1392 / 920 / 448
m2 role lines           : 1392 (أ, بتسند) · 920 (ب, بتشدّ ضد) · 448 (ج, بتسند)
m8 role lines           : 1392 (أ, بتسند) ·  —  ·  448 (ج, بتسند)
```

The `m8` case is the interesting one: a record shared by two of three peers leaves the
middle column empty at that row. **The gap reads**, because the two role lines that are
present name their readings in words. The alignment is *redundant with the words*, which
is precisely why it cannot mislead — and precisely why the alignment is a visual candidate
rather than a locked primitive.

**375px:**

- *Can the stage scale beyond Reading A / Shared / Reading B?* **Yes.** Four panes, four
  equal pager controls (أ / ب / ج / المشترك), labels not clipped, every peer present.
- *Ranking invented?* No. Controls are equal in width, size, weight and ground; the mark
  says what you are viewing.
- *Colour used to distinguish peers?* No — the build has no hue that carries meaning.
- *A permanent primary first peer?* No. The first pane is first in sequence, not first by
  merit, and every deep link opens whichever pane is named.

**Pane ordering.** At two peers the shared region stays physically between them, exactly as
V9 has it. At three or more it follows the peers, because with three it no longer sits
"between" any particular pair — placing it after peer 1 would manufacture an adjacency the
data does not contain.

**Measured ceiling of the pager.** At 375px it holds **six controls (five peers + shared)**
at 55px each with no clipping and no wrapping. At seven, labels wrap to two lines and
«المشترك» clips. The frozen lock is "no peer may be dropped", so the answer beyond six is
not truncation; it is an open item for the next phase.

**Below the column floor.** A wide viewport with a 1000px content column flips all three
peers to the paged stage together. Verified: four equal panes, no hierarchy, no orphan.

## 5.3 Live Context at five items (§8) — **PASS structurally; FAILS to earn a distinct spatial layer**

All required conditions present in one state: five active items, long Arabic in two of
them, one item raised by the reader, one removed from the current field, one entering
through prototype recomposition, conversation visibly adjacent behind the drawer.

Asserted live: every item identical at rest (type, weight, colour, margin geometry), and
nothing brought forward unless the reader did it. No ranking, no relevance score, no item
nearer or larger at rest.

**The judgement §8 asks for, answered honestly: at the maximum intended handful, Live
Context is a styled list.** Its only spatial behaviour is the reader's own foreground. That
is not a failure of craft — the surface is calm, truthful and legible — it is a
consequence of the truth constraint: when nothing may be placed nearer than anything else,
there is very little legitimate spatial work left to do.

What it *does* earn, and what is worth freezing, is not spatial:

1. **A boundary.** It states what is in play now, and that this is not everything recorded.
2. **The two controls the runtime actually supports** — explicit context activation, and
   removal from the current field.
3. **Identity continuity** — the same record, recognisably the same object, on the way to
   the scene.

One weakness worth naming: at five items with long Arabic, the boundary statement
(«دي الحاجات اللي داخلة دلوقتي وبس، مش كل اللي مسجّل») sits below the fold. The most
truth-critical line on the surface is in its least visible position. Not a blocker —
nothing false is shown — but it is a real item for the next phase.

## 5.4 Cross-screen continuity (§9) — **PASS**

`m2` («أكتر حاجة مضايقاه في شغله الحالي…») followed through Home → Conversation → Live
Context → Deep Analysis, at 375px and desktop.

- Same conceptual identity: one sentence, one provenance line, three surfaces.
- No accidental quotation claim: «مسجّل من كلامك» everywhere, and the expanded accounting
  states it is not a literal transcription.
- Provenance semantics consistent: the same disclosure control, the same wording, the same
  accounting.
- No conflicting controls: foreground is one device with one label in both places it exists.
- **No semantic role shown before Deep Analysis** — asserted live: the conversation and the
  context field are scanned for role vocabulary and contain none.
- Depth increases naturally: recited in a turn → an item with controls → a record standing
  once under a doubled rule with its memberships named.
- No cinematic gimmick required. There is no morph, no trail, no glow, no transition
  between surfaces. Continuity comes from shared information structure and one interaction
  logic — which is what makes it freezable as a principle.

The continuity **principle** works and is frozen. The cross-surface *move* needed the B4
fix before it could be trusted.

## 5.5 State stability (§10) — **PASS**, all ten, under the dense fixture

Every item re-tested under `d1`/`p3`, with the assertions running in the live page.

| Blocker | Result |
|---|---|
| Composer draft survives breakpoint crossing | PASS — verified across four crossings (wide→narrow→wide→narrow) with a live draft |
| Caret survives | PASS — selection range preserved exactly |
| Focus survives | PASS |
| Current peer survives | PASS — including the grid↔paged transition |
| Open disclosures survive | PASS |
| Foreground survives benign recomposition | PASS — a *different* item removed from the field leaves the raised item raised |
| Target navigation lands on the actual record | PASS — after the B4 fix; asserted physically (pane index, track band, viewport rect), not by state variable |
| Modal focus trapped and returned | PASS — after the B5 fix; native `<dialog>` + `:modal`, initial focus inside, focus returned to the trigger |
| Closed Live Context inert | PASS — `inert` set and zero visible width inside the clipping layer |
| Reduced motion preserves meaning | PASS — the scene's full text content is byte-identical with motion on and off |

## 5.6 "No explanation" test (§11) — **PARTIAL — and this is the freeze argument**

With every reviewer-facing word removed, the product surface still works, because each
primitive reaches the reader **in words** as well as in a mark:

| Primitive | Carried in words by |
|---|---|
| shared material | «حاجات من كلامك داخلة في أكتر من قراءة» + a role line naming each reading |
| unknown marker | «لسه ناقصة» / «اتقفلت» / «اتغيّرت» |
| peer equality | «كل القراءات دي معروضة هنا بالتساوي» + the reading's own name on each column and control |
| foreground state | «مرفوعة قدّام دلوقتي» + the in-product focus note |
| Live Context boundary | «دي الحاجات اللي داخلة دلوقتي وبس، مش كل اللي مسجّل» |
| provenance disclosure | «مسجّل من كلامك · ⟨التاريخ⟩» as the control itself |

**But the marks alone do not teach themselves.** Nothing on screen says one rule = X, two
rules = Y, broken rule = Z. A reader who ignored the words entirely would not derive the
mark system from the composition. Because the words are always present and never
contradicted, nothing is lost — the marks reinforce, they do not carry.

Per §11 that is decisive: **the exact marks are not freeze-worthy.** It does not touch the
semantic primitives, which are carried by the words and the structure and which survived
every test.

## 5.7 Visual-semantic non-ordinal test (§12) — **PASS, with one named residual**

| Dimension | Finding |
|---|---|
| size | One material type size and weight across all structural grounds — asserted live in every state |
| darkness | One ground value across all structural grounds — asserted live. The only ink step is the reversible, reader-created foreground |
| contrast | Every Arabic run meets WCAG AA; the structural rule meets the 3:1 non-text floor — measured, not asserted in prose |
| position | Peer order is holding order. Column right edges asserted equal-width; pane order stated in §5.2 |
| depth | No plane, no elevation, no blur. The anchor's occlusion on scroll is the only depth cue and it belongs to no reading |
| motion | Nothing carries state; reduced-motion text content is byte-identical. Nothing on the correction path animates |
| line count | One / two / broken are *kinds* of line, not amounts. Two hairlines are a kind of membership |
| line thickness | One value. No line joins two objects, so there is no thickness to read as strength |
| spacing | Uniform per element class; no per-reading spacing |
| surface values | One paper |

**The one residual: column and pane content volume.** A reading standing on fewer of its
own records produces a shorter column — visibly so in the three-peer desktop state, where
ج stands only on shared records and its column carries a single sentence. This cannot be
equalised without padding, and padding would be a lie. It is a fact about the stored
memberships, not an encoding.

Three things keep it from becoming a rank: type, weight, ground and column width are
identical; the paged stage shows one pane at a time, so at 375px the comparison is never
made side by side; and the parity line states equality in the product's own voice without
reaching for ranking vocabulary. It is recorded in the manifest as forbidden to infer, and
carried to the next phase as a known residual rather than claimed solved.

## 5.8 Arabic-first (§13) — **PASS**

Long subject anchor, long peer statements, long recorded material, Arabic punctuation
(؛ ، ؟), at 375px, on the dense fixture and the three-peer fixture, all in one state.

- Long subject wraps to four display lines at leading 1.5 — no collision, no clipping.
- Long records wrap to five to seven body lines at leading 1.85.
- No letter-spacing on Arabic anywhere; no italics; nothing below 13px — all asserted live.
- No clipped line endings; no page-level horizontal overflow in any state.
- No English-first geometry: the grid's first column is the right-hand column, the drawer
  docks at the outward edge, the stage pages right-to-left, arrow keys follow reading
  direction, rules sit on the start edge.
- Logical DOM order throughout; focus order is DOM order (no positive tabindex, asserted).
- Counts are morphology; digits only in record dates, Arabic-Indic.

One small item: at 375px with a long subject, the app-bar subtitle truncates to
«المشهد · قرار الش…». Nothing is lost — the anchor sits in full immediately below — but the
bar subtitle is a duplicate at that width and is a candidate for deletion in the next phase.

## 5.9 Accessibility freeze gate (§14) — **PASS**

| Requirement | How it is met |
|---|---|
| Peer equality exposed semantically | Each reading is a named region (`aria-label`) with its own tab control; `role="tablist"` with `aria-selected` / `aria-current`; equality also stated in text |
| Shared material relation readable in text | Each role line names the reading and the role in words; it does not depend on the column alignment |
| Unknown meaning not dependent on broken-line geometry | «لسه ناقصة» / «اتقفلت» / «اتغيّرت» as text |
| Foreground not dependent on opacity alone | Brackets, an outdent, an ink step **and** a screen-reader-only sentence; no opacity is used to carry it |
| Focus order matches logical reading order | DOM order throughout; no positive tabindex — asserted |
| Native modal behaviour | `<dialog>` + `showModal()`: real trap, genuinely inert background, Escape, focus returned (after the B5 fix) |
| Drawer non-gesture entry | Opened by a button on two surfaces, closed by a button, the scrim and Escape; the swipe is never the only route to any pane |
| Reduced motion | Both the OS preference and the reviewer toggle; text content byte-identical with motion off |
| High zoom / reflow | No page-level horizontal overflow asserted in every state and mode; the 375 clamp is the reflow proxy |
| Touch targets | Every pressable target ≥44px tall — asserted live, in every state |
| Colour independence | Near-achromatic by construction; the whole assertion suite passes unchanged in grayscale |

The cross-surface move's focus behaviour (B4) was an accessibility defect — focus moved to
an off-screen element — and is fixed.

## 5.10 Truth contract — **PASS**

No confidence, rank, strength or weight vocabulary anywhere, in any state, with nothing
stripped before scanning. No Western digits in the product surface. A correction leaves
material, readings, roles and unknowns identical. No relation without a stored membership.
No line joins two objects. Stress fixtures declared in the page, in the route names and in
the manifest.

---

# 6. SELF-CHECK RESULT

**2,955 / 2,955 assertions pass** — 591 per mode, across 17 routes × 5 modes (plain,
grayscale, reduced motion, long Arabic, 375 clamp), run in headless Chrome.

Two intermediate failures during development were traced to the harness rather than the
build and are recorded here for honesty, because both looked like product defects at first:
the in-app preview browser never fires `<dialog>`'s `close` event at all and never runs
`requestAnimationFrame` while hidden, and a fixed millisecond wait measured the harness's
patience rather than the move. Both were re-verified in real Chrome. Two *other* failures
that looked like harness noise turned out to be real (B4, B5) and were fixed in the build.

---

# 7. INTERNAL ADVERSARIAL REVIEW (§22)

| Challenge | Answer |
|---|---|
| Is the margin system becoming a gimmick? | **At density, partly.** Five consecutive records with identical hairlines read as texture, not as marks. It asserts nothing false, but it stops distinguishing. This is the single strongest reason not to freeze the artwork |
| Is dense analysis turning into a document? | **Yes** — 2,511px, calm and correct, with no skim affordance. Named, not hidden |
| Does three-peer support force a new hierarchy? | **No.** Equal columns measured at 415/415/415px, or all peers paged together. The rule has no branch that produces a primary |
| Is mobile becoming tab-heavy? | **Not yet.** Four controls at 375px are comfortable; six is the measured ceiling; seven wraps and clips. Named as an open item |
| Does shared material remain legible? | **Yes, and more legible than in V9** after B7 — the region says it once and each record names its readings |
| Does Live Context still have product value? | **Yes — boundary, controls, identity.** Not spatial value. Stated plainly rather than defended |
| Does single ground survive density? | **Yes**, and it is what makes density legible. Asserted live in the dense state |
| Is any visual variable leaking rank? | **No**, on every variable that can be equalised — all asserted. Content volume cannot be equalised without lying and is recorded as a residual |
| Does Arabic remain comfortable? | **Yes**, under long subject + long statements + long material at 375px simultaneously |
| Is the system becoming too sparse or too textual? | **Textual, deliberately.** The words carry every primitive and the marks reinforce. That is the honest state of it, and it is why the semantics freeze and the graphics do not |
| Are we freezing graphics too early? | **We are not freezing them.** §16's default holds; §11 and §5.6 give the positive reason |

Corrections made were surgical: three structural fixes (B1–B3), four correctness fixes
(B4–B6, B9) and two copy reductions (B7, B8). Nothing was restyled. No colour, type,
spacing, radius, motion curve or object form was changed.

---

# 8. UNRESOLVED RISKS CARRIED FORWARD

1. **Dense analysis has no skim affordance.** Correct and readable, but long. The next
   phase must solve navigation at density — and must not assume a second surface value
   solves it, because comprehension is not what breaks.
2. **The margin becomes texture at density.** The mark's distinguishing power is
   inversely related to how many records are on screen. A graphic language that survives
   ten consecutive records is a real requirement for the next phase.
3. **The pager ceiling is six controls at 375px.** The runtime does not cap readings. The
   frozen lock forbids dropping a peer, so the answer beyond six must be found, not
   avoided.
4. **Column and pane content volume is visible** and cannot be equalised truthfully.
5. **The Live Context boundary statement sits below the fold at five items.**
6. **The bar subtitle duplicates the anchor and truncates at 375px.**
7. **If a second surface value is admitted, the V7 question returns**: is it a *place* or
   a *level*? V10 did not need one and did not answer it.

None is an experience-level blocker. Every one is a next-phase item with a named owner
surface.

---

# 9. FINAL PHASE V RECOMMENDATION

## `FREEZE WITH EXPLICIT OPEN ITEMS`

The structural-semantic grammar survived dense, three-peer, mobile, long-Arabic,
accessibility, reduced-motion, state-stability and truth stress — after eight defects were
repaired, three of them in V9's own build and two of them truth failures.

The specific visual expressions that carry that grammar today — the one-rule / two-rule /
broken-rule drawing, the brackets, the exact margin geometry, the crossing-row alignment —
did **not** earn a freeze. They are not self-explanatory (§5.6), they degrade into texture
at density (§5.1), and the alignment is redundant with the words that actually carry the
relation (§5.2). Freezing them would constrain the Final Graphic Language phase for no
evidential gain.

**Exact margin artwork frozen: NO.**

The classification of every primitive is in `QANDEEL_V10_STRUCTURAL_GRAMMAR_FREEZE.md`:
**21** locked experience/semantic principles, **12** locked structural interactions,
**12** visual candidates carried forward unfrozen, **7** items rejected or not carried.

Phase V's remaining work is not another exploration round. It is the independent closure
review of this freeze.
