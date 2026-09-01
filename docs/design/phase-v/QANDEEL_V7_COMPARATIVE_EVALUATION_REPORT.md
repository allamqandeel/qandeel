# QANDEEL — V7 COMPARATIVE EVALUATION REPORT

## V5B Neutral Experience Floor (control) vs V6 Salvaged Spatial Intelligence (challenger)

**Phase:** V — Visual Language Discovery
**Task:** V7 — Comparative Evaluation
**Type:** ADVERSARIAL COMPARATIVE REVIEW — no design implementation
**Canonical visual decision:** NOT TAKEN HERE
**Production changes:** none
**Prototype changes:** none — V5B and V6 are byte-unchanged
**Next task:** V8 — Art / Experience Direction Decision

---

# 0. METHOD

Both prototypes were read in full as source, then opened in a real browser and
exercised. Neither prototype's self-report was accepted as evidence: every claim
that mattered was re-derived from the live DOM, computed styles and measured
geometry, in the same fixture states.

**Inspected**

| V5B | V6 |
|---|---|
| `index.html` (1,088 lines) | `index.html` (1,637 lines) |
| `README.md` | `README.md` |
| `TRUTH-MANIFEST.md` | `TRUTH-MANIFEST.md` |
| 8 review screenshots | 10 review screenshots |

**Exercised live:** every fixture state S0–S5 on both; Deep Analysis desktop and
375px; Live Context desktop and 375px; Conversation; the peer switcher (V5B) and
the paged stage (V6); focus / foreground; progressive formation; the correction
path; provenance disclosure; the field's cross-surface move; keyboard, Escape and
dialog focus behaviour; grayscale; reduced motion; V6's own truth self-check.

**Skills loaded and used:** `design-critique`, `frontend-design`,
`designing-arabic-frontends`, `fixing-accessibility`, `emil-design-eng`.
Not invoked: `writing-eloquent-arabic`, `apple-design`, `user-research`.

Where a verdict rests on a measurement, the measurement is quoted.

---

# 1. THE FOUR INDEPENDENT-REVIEW FINDINGS, TESTED

## Finding A — "the channel is the strongest V6 advance"

**Upheld on the record, but its stated mechanism does not hold.**

The record-once claim is real and verified independently. In S2 on desktop:

| | dual-role record `مرتاح مع الفريق…` rendered |
|---|---|
| **V5B** | **3 times, all simultaneously visible** — inside Reading A, inside Reading B, and again in the `.shared` block below both |
| **V6** | **1 time** — only in the channel |

V6 excludes dual-role ids from each territory's fragment list (`own = id =>
!dualIds.includes(id)`), so the exclusion is structural, not cosmetic. This is
the single largest genuine advance in V6 and it is not in dispute.

**But the device that is supposed to carry it — the *opening* — does not.**
Measured geometry, S2, 1280px wide:

```
channel record (.chan .inner)   y  419 →  793
channel is then EMPTY for                 299 px
channel tail sentence           y 1092 → 1201
opening in territory A          y  915 → 1000
opening in territory B          y  849 →  934
vertical offset between the two openings:  66 px
```

The two openings are horizontally contiguous with the channel (they share the
exact `--between` value, `L=214.1`, and meet it at x=782 and x=482). But they sit
**122–496px below the bottom of the record**, at two different heights, and they
meet the channel in a region where the channel is **empty**. The claimed reading
— "a territory's own ground gives way into the channel, where the shared record
stands" — is never composed. What is composed is tonal continuity into a void.

The openings also carry no information of their own. Each states a role
(`بتسند القراءة دي` / `بتشدّ ضد القراءة دي`) that the channel already states, in
the same words, in its own `roles` list. **Delete both openings and no fact is
lost.** Under `design-critique` that is decorative structure: an element whose
only job is to assert a spatial metaphor the composition does not deliver.

**Does the darker plane read as weight?** See §3 — yes, and this is the report's
most serious finding.

**Does it survive 375px?** The *channel* does. The *opening* does not. See §2.

## Finding B — "mobile shared ground may look like missing UI"

**Confirmed, and worse than stated: the emptiness is not a reservation, it is a
layout by-product with a sentence attached.**

On the 375px paged stage the three panes are laid out with `align-items: stretch`,
so the channel pane is stretched to the height of the tallest *reading*. Measured:

| state | channel pane height | content ends at | empty ground below |
|---|---|---|---|
| **S2** | 897 px | 513 px | **384 px (43%)** |
| **S3** | 1057 px | 513 px | **543 px (51%)** |

S3 differs from S2 only by a pending-correction note added inside **territory A**.
That change — which has nothing to do with the shared record — grew the
"deliberately empty" channel space by **159 px**.

The prototype's copy says:

> «باقي المساحة دي فاضية عن قصد: مفيش حاجة تانية مسجّلة داخلة في القراءتين بدورين مختلفين لحد دلوقتي.»
> *(the rest of this space is deliberately empty: nothing else recorded enters both readings in different roles yet)*

The sentence asserts intent for a void whose size is set by the length of an
unrelated column. Over six months of real content the void grows with the
readings. This is the exact failure mode `design-critique` calls over-explained
semantics: the grammar does not carry the meaning, so prose is asked to.

Remove the sentence and the pane is a tall grey rectangle that is half empty. It
reads as a rendering fault or a loading state, not as restraint.

## Finding C — "Live Context is cleaner, but its spatial advantage is not obvious at rest"

**Confirmed. At rest V6's Live Context contains no spatial device at all.**

At its resting state the field is: a note, four filter chips, and a linear list of
records separated by hairlines, each with provenance and two actions. There is no
plane, no territory, no channel, no opening. The only spatial device on the
surface — the raised foreground plane — exists solely as the result of the user
pressing «هاتها قدّام», and the resting plane is explicitly and correctly flat.

That flatness is the right truth decision (`TRUTH-MANIFEST` §"What presence does
not mean" — QANDEEL must never place one item nearer than another). But it means
the honest description of V6's Live Context is **a better-built drawer**, not a
spatial surface. The improvement over V5B is real and is craft: no boxes, no
bordered buttons, provenance as the disclosure control, an explicit boundary
statement. None of it is spatial intelligence.

**Verdict on the framing offered:** legitimate quiet default *and* evidence that
the spatial concept adds little here. Both are true, and they are compatible.

## Finding D — "desktop Deep Analysis risks becoming an editorial triptych"

**Confirmed.** The desktop stage is `grid-template-columns: 410px 300px 410px`
with a large display heading above it, hairline rules between fragments, near-zero
radius on every structural plane, and a tonal middle column. Three independent
vertical flows, no fixed reading order across them, and a sticky middle column
while the sides scroll.

That is a broadsheet composition. `frontend-design`'s own calibration names
"a broadsheet-style layout with hairline rules, zero border-radius, and dense
newspaper-like columns" as one of the three current AI-design defaults. V6 lands
close to it. This does not make V6 bad — it makes V6's distinctiveness rest on its
*primitives* (channel, seat, anchor occlusion, paged stage), not on its
composition, which is a well-executed magazine spread.

---

# 2. MOBILE — THE HARD GATE

### V6 paged stage

**Structurally meaningful, and correctly built in RTL.** Measured at 375px: a real
horizontal scroll-snap track (`display:flex`, `scrollWidth 965 / clientWidth 335`,
`scroll-snap-type: x mandatory`), three equal 309px panes, `flex: 0 0 calc(100% -
26px)` leaving a 26px sliver of the neighbouring pane visible — a genuinely good
craft cue that there is more sideways.

RTL mapping is correct and native, not translated: panes right→left are
A / channel / B (x = 491, 172, −147), and the paging buttons are in the same
physical order (x = 690, 579, 469). A translated-from-LTR build would have
inverted one of the two. The channel really is in the middle, and it keeps its own
`--between` ground, so it is visibly the same place as on desktop.

**Is it "just a third tab"?** The control is a stock segmented pill — visually
identical to an iOS segmented control, active segment filled white. The middle
segment is labelled «اللي في النص». So: the *pane* is more than a tab, because it
keeps its plane and its position between the peers. The *control* is exactly a
tab bar. The concept is carried by the pane, undermined by the control.

**Peer parity across panes:** preserved. Equal widths, identical type and ground
(verified by computed style), never stacked vertically. Both default to peer A —
so does V5B. One mild asymmetry V5B does not have: by gesture, peer B is two
swipes away and peer A is zero, because the channel sits between them. By button
both are one press.

**Mental model across panes:** helped materially by `activePane` surviving every
re-render (verified: after a full re-render the reader's pane is restored). This
was the right call and it is the difference between a usable and an unusable
paged stage.

### V6 channel on mobile

Survives as a place. Its content is clear («نفس الحاجة، بدورين» is the single best
label in either prototype). But 43–51% of the pane is empty ground whose spatial
logic is only available through the explanatory sentence — see §1 Finding B.

### V6 opening on mobile

**Does not survive.** On 375px the opening becomes a free-floating darker box
inside the territory, immediately adjacent to the seat's slightly-lighter box. The
channel it is supposed to open into is on a different pane. It is a label naming a
place it does not link to, with no affordance connecting them — the user must
notice the tab bar. Two adjacent grey boxes of near-identical value,
distinguishable only by reading them.

### V6 Live Context on mobile

Not spatial. A well-styled drawer. See §1 Finding C. One craft defect visible at
375px: `.q` controls carry a `border-bottom` while `.prov` overrides it to
transparent, so an orphaned short rule floats under «هاتها قدّام» while the
provenance line beside it has none, and the second action wraps to its own line —
each record consumes ~180px for one sentence.

### Two mobile regressions V5B does not have

**1. A `resize` event destroys the composer draft and drops focus.** V6 binds
`window.addEventListener('resize', render)`, and `render()` rebuilds `#vConv`
with `innerHTML`. Verified live:

| | draft after `resize` | focus after `resize` |
|---|---|---|
| **V5B** | preserved | still on the textarea |
| **V6** | **lost** | **`<body>`** |

On mobile `resize` fires when the soft keyboard opens, when the URL bar collapses
on scroll, and on rotation. This is a material usability regression on the surface
the architecture calls primary.

**2. The cross-surface move lands on the wrong pane and says it didn't.**
`شوف دورها في القراءات` from the Live Context field at 375px navigates to the
stage and sets focus correctly, then announces:

> «روحنا للقراءات، والحاجة دي في مكانها في المشهد.»
> *(we went to the readings, and this thing is in its place in the scene)*

Measured immediately after: active pane = «قراءة أ», the landed pane does not
contain the record (it cannot — territories exclude dual-role ids), and the
channel pane overlaps the visible track by **16 px of 309**. The cause is that the
handler calls `scrollYTo()`, which by design moves only the vertical axis, and
never calls `gotoPane()`. V6's flagship continuity primitive is broken on the
surface the gate cares most about, and its live region asserts the opposite.

### Gate result

V6's signature value **partially** survives mobile. The channel and the paged
stage survive; the opening dies; the empty ground is an artifact; cross-surface
continuity is broken. Not a clean pass.

---

# 3. TRUTH CONTRACT — RE-AUDIT

Both prototypes hold the frozen prohibitions in **words**. Neither renders numeric
confidence, bands, percentages, ranking vocabulary, causal arrows, verbatim-quote
framing, turn-level provenance, refusal states, or any structural consequence of a
correction. V6's correction path was verified byte-identical over material,
readings, roles and unknowns; V5B's correction writes only `S.corrections[id]` and
touches nothing else, giving the same guarantee. Counts are morphology in both
(«خمس حاجات», never a figure). One numeral policy each. No Western digits in
either product surface.

**The failure is not in the words. It is in the planes.**

V6's four structural grounds are a strictly monotonic, near-evenly-spaced
luminance ladder:

| plane | means | measured luminance |
|---|---|---|
| `--raise` — user focus | the one you brought forward | **251.8** |
| `--ground` — a reading's own territory | established | **234.5** (−17.3) |
| `--recess` — a named unknown (the seat) | missing | **224.3** (−10.2) |
| `--between` — the channel | shared / dual-role | **214.1** (−10.2) |

Four steps of one visual variable mapped onto four semantic categories is an
**ordinal scale**. Nothing in the composition distinguishes "these are different
places" from "these are ranked". The order it reads as — *what I focused on >
what is established > what is missing > what is contested* — is a ranking of
epistemic states that the runtime does not contain and the architecture forbids.

Three things make this worse rather than better:

1. **The shared record is permanently the most prominent object on the screen.**
   It sits on the darkest plane, at the largest body size (17.5px), at the
   heaviest body weight (520), in the centre column. Verified: when the user
   focuses a fragment in territory A, *everything recedes to `--ink-3` except the
   channel record*, which stays at full `--ink`. There is no state in which the
   shared record is not visually first.

2. **The prototype must deny in prose what the composition asserts.** The channel
   carries a 177-character paragraph whose only job is
   «مش مقياس لقوة العلاقة، ومفيش وزن ولا ترجيح هنا». The `TRUTH-MANIFEST` similarly
   has to state that the darker value is "a plane, not a quantity". A grammar that
   needs a disclaimer attached to its signature element has not solved the
   problem; it has documented it.

3. **The self-check cannot see it.** V6's twelve live assertions all pass, and I
   independently confirmed the substantive ones. But every one of them tests
   *vocabulary, structure or typography*. There is no assertion for "no plane
   value, position or size encodes a quantity" — which is precisely the claim the
   manifest makes and the one thing most at risk. The check is rigorous on the
   axes where V6 is strong and silent on the axis where it is weak.

**Second truth issue.** The mobile channel's «باقي المساحة دي فاضية عن قصد»
claims deliberateness for a `align-items: stretch` by-product that grows with
unrelated content (§1 Finding B). It is a small lie, but it is a lie the interface
tells about itself.

**Third, minor.** Focusing the shared record lights both openings with `--mark`
(`#1f4a46`), the accent that V6's own CSS declares
`/* interaction only — never encodes meaning */`. Here it encodes a relation. The
signal does survive grayscale (it is a dark ring on a light band), so
colour-independence holds — but the rule does not.

**V5B has no equivalent exposure.** Its hierarchy is carried by size, weight,
spacing and rules on one surface value; nothing in it can be read as a quantity.
That is the whole point of a neutral floor, and on this axis the floor holds and
the challenger does not.

---

# 4. THE "REMOVE THE EXPLANATION" TEST

Measured on the Deep Analysis surface, S2, desktop — characters of text whose job
is to explain the interface rather than convey the user's own content:

| | explanatory chars | total visible chars | share |
|---|---|---|---|
| **V5B** | 316 | 2,321 | **13.6%** |
| **V6** | 500 | 1,756 | **28.5%** |

V6's Deep Analysis is **twice as prose-dependent, proportionally**, as the floor
it is meant to beat.

Device by device, with the explanation mentally removed:

| device | survives? | why |
|---|---|---|
| **Channel** | **Partially** | The heading «نفس الحاجة، بدورين» plus one record and two named roles carries it. What does **not** survive is the denial: without «مش مقياس لقوة العلاقة…», the darkest, centre, largest element reads as the most important. The *fact* survives; the *non-ranking* does not. |
| **Opening** | **No** | Without its words it is a darker stub at an arbitrary height that touches empty channel. It states nothing the channel has not already stated. |
| **Empty shared ground** | **No** | Without «باقي المساحة دي فاضية عن قصد» it is 43–51% of a mobile pane left blank. It reads as broken. |
| **Peer parity** | **Yes** | Identical type, identical ground, equal columns, equal panes — verified by computed style. The parity sentence is reassurance, not load-bearing. This is V6's cleanest device. |
| **Foreground focus** | **Yes, for fragments** | Plane + scale + ink + marker is legible without prose. **But it does not exist for the channel record** — focusing the shared record raises nothing (`raisedCount = 0`); only the openings ring and everything else recedes. The primitive is inconsistent on the one object the direction is built around. |
| **Named-unknown seat** | **Yes** | Recessed ground, a sill, and it always names what is missing. Works without prose. Its *plane value* is the problem (§3), not its legibility. |

Three of six devices fail the test. Two of the three failures are the channel's
supporting cast — which is where V6's whole hypothesis lives.

---

# 5. MANDATORY COMPARISON DIMENSIONS

Same fixture, same states, same content throughout. V6 uses V5B's fixture verbatim
(verified by source diff of `M`, `R_A`, `R_B`, `R_A2`, `R_B2`, `CONV_BASE`,
`CONV_THIN` and all six `FIXTURES` entries) — neither direction was handed easier
material.

### 6.1 Immediate comprehension — **V5B WINS**

V6 orients faster in the first screen (a real anchor, a 46px subject, one parity
line). V5B is faster to *understand as a structure*: one column order, anchor →
parity → two equal readings → shared section → restraint, unambiguous on first
sight. V6 gives three independent vertical flows with no fixed reading order, a
sticky middle column while the sides scroll, a four-step tonal ladder to decode,
and 28.5% explanatory prose against V5B's 13.6%. Faster to *look at* is not faster
to *understand*.

### 6.2 Deep Analysis scene-ness — **V6 WINS**

In S2/S3/S4 the channel is a genuine place: material stands somewhere rather than
being listed, and standing there is what states the relation. V5B is only ever a
layout, by design. The win is real but scoped — see 6.7, §7.6 and the
one-scenario finding: V6 has no scene at all in S0, S1 or S5.

### 6.3 Document / card dependence — **V6 WINS (decisively)**

Counted on the live Deep Analysis surface, S2, desktop:

| | elements with both a visible border and a radius |
|---|---|
| **V5B** | **33** (6 item cards × 2 bordered buttons, plus reading cards, anchor card, shared block, unknown boxes, role pills, restraint) |
| **V6** | **3** |

V5B is boxes inside boxes inside boxes; V6's material reads as language separated
by a 38px hairline. This is the clearest craft difference between the two, and it
is not close.

### 6.4 Peer-reading equality — **TIE / INCONCLUSIVE**

*Desktop:* both place Reading A in the RTL first-read (right) column; both give
identical type and ground (V6's is verified by computed style — same font-size,
weight, colour and background). Neither privileges by weight.

*375px:* both default to peer A; both use equal-width controls; neither stacks
vertically. V6 keeps all three panes in the accessibility tree, so an AT user
reads both peers without operating anything; V5B sets `hidden` on the non-active
peer, removing it from the tree until the switcher is used — a disclosure pattern,
operable, but weaker on equality. Against that, V6's channel sits between the
peers, so by gesture B is two swipes away and A is zero.

Small advantages both ways, none decisive.

### 6.5 Shared dual-role comprehension — **V6 WINS (decisively)** *(high weight)*

3 renders → 1. V5B forces the reader to notice that three identical sentences on
one screen are one record; V6 removes the error at source and states both roles
where the record stands, under a plain heading. No duplication, no weight implied
in words, no line or arrow to misread.

The caveat that belongs to 6.7 and §7.5, not here: the channel handles only the
support-in-A + contradict-in-B case. In S5 (same record supporting *both* peers)
V6 has no channel and renders the record **twice**, falling back to an appended
sentence — but V5B renders it twice in S5 as well, with no note at all. V6 wins
both cases.

### 6.6 Provenance discoverability — **V6 WINS**

«مسجّل من كلامك · ⟨التاريخ⟩» *is* the disclosure control, with a drawn caret, a
44px target, `aria-expanded`, and correction living inside the accounting where it
belongs. V5B needs the same metadata line **plus** a «منين جت دي؟» button **plus**
a «مش مظبوط؟» button on every item — 12 bordered buttons across the analysis
surface, which are the visually heaviest objects on the screen after the reading
statements. V6's rest-state affordance is quieter (transparent underline, small
caret), which is the fair objection; it is still a labelled 44px control that
announces its state, and it removes an entire tier of chrome.

### 6.7 Named unknowns — **TIE / INCONCLUSIVE**

V6 removes the cardification: the seat is recessed ground bled to the territory's
edge under a sill, never blank, always naming what is missing, with the correct
"no answer of yours closed this" note in S4. V5B's is a bordered box with a
3px start-border inside a card inside a card — generic.

But the criterion also forbids implying a score, and V6's seat sits on
`--recess`, one step *below* a reading's own ground on the same monotonic ladder
that ends at the channel (§3). "Missing" is therefore rendered as lower than
"established". V5B's unknown implies no level at all.

Each fixes what the other breaks.

### 6.8 Thin-data grace — **V6 WINS**

S1 (one reading, two records, one open unknown). V6 collapses to a single centred
64ch column with the anchor, the statement, its material, one seat and the
single-reading parity line — it reads as composed and deliberate. V5B's S1 is the
same card layout with one card removed; it reads like a form with a missing row.

Recorded against V6 elsewhere (§7.6): what collapses in S1 is the *entire spatial
grammar* — `panes=1`, no channel, no opening, no territory-vs-territory. V6's
thin state is graceful precisely because it stops being spatial.

### 6.9 Correction truth — **V6 WINS (narrowly)**

Both are honest: RECEIVED/PENDING only, a warning before sending, the correction
visible in conversation, a pending note on the record wherever it appears, nothing
structural moved. V6 is better on three counts: its warning enumerates exactly
what will not move («والقراءات والأدوار والناقص هيفضلوا زي ما هم بالظبط»);
correction is reached from inside the provenance accounting rather than from a
separate per-item button; and **nothing on the correction path animates**, so
motion cannot imply a consequence that does not exist — a deliberate restraint
`emil-design-eng` would endorse and V5B does not make explicit.

### 6.10 Live Context distinctiveness — **V6 WINS**

Lighter than Deep Analysis (no readings, no roles, no channel, no seats), clearly
adjacent to Conversation (a real second column on wide, a drawer with the
conversation still visible behind on narrow), and it does not become a dashboard.
The one analysis-flavoured move is correctly gated behind the user first bringing
an item forward. V5B's is the same list in cards with twice the chrome.

The win is craft, not spatial intelligence — the surface has no spatial device at
rest (§1 Finding C) — and it is discounted by the mobile action-wrapping defect
and the broken cross-surface move (§2).

### 6.11 Cross-surface coherence — **V6 WINS**

V6 composes an explicit restraint gradient: Conversation carries exactly one
spatial trace (the presence line) and no fragment, plane, channel or territory;
the field carries one plane; Deep Analysis carries the full grammar. That reads as
one intelligence at three depths, and it is deliberate. V5B's three surfaces share
one card system and nothing else; there is no route at all from the field into the
readings.

Discounted, not overturned, by the 375px continuity bug (§2) — a defect in one
handler, not a failure of the gradient.

### 6.12 Arabic / RTL integrity — **V6 WINS**

| | V5B | V6 |
|---|---|---|
| smallest Arabic | **12 px** (`.turn .who`, `.turn .time`) | **12.5 px** |
| body line-height | 1.75 | 1.85–1.95 |
| sub-1.6 Arabic leading | none | **one: anchor `h2` at 1.30** |
| letter-spacing on Arabic | none | none |
| italics on Arabic | none | none |
| horizontal overflow | none | none |
| RTL spatial mapping | n/a | correct and native (panes and controls both right→left A / channel / B) |

V6 is better on every floor and is genuinely composed in Arabic rather than
translated into it — the paged stage's RTL order is the proof, and the drawer's
deliberate use of physical `left` at a direction-critical boundary, with a comment
saying why, is the mature choice.

Its one flaw is real and its own check misses it: the anchor `h2` is
`clamp(29px, 6vw, 46px)` at `line-height: 1.3`, and the self-check's line-height
assertion scans `.txt/.stmt/.body/li/.tx/.r/.rl/.what` — not `h2`. The current
subject is one line at 16ch, so nothing clips today; a longer real subject wrapping
to two lines at 46px/1.3 will collide ascenders and descenders.

### 6.13 Accessibility robustness — **V6 WINS**

**V5B has a genuine WCAG failure.** Its correction sheet declares
`role="dialog" aria-modal="true"` but implements **no Tab trap and no inert
background**. Verified live: with the sheet open, 29 focusable product controls
remain reachable behind it, and focus can be moved out of the dialog. That is both
a keyboard failure and a false statement to assistive technology on the one flow
where the user is telling QANDEEL it got something wrong.

V6 traps Tab in all three dialogs (verified: focus placed outside is pulled back
on the next Tab), cascades Escape sheet → field → focus, restores focus to the
opening control, keeps the field `inert` while closed, gives the field button
`aria-controls` and a state, keeps both peers in the AT tree on mobile, and its
lowest measured contrast is **4.71:1** against V5B's **4.49:1** (`.unknown .st`,
12.5px/600 — marginally sub-AA).

Both share one flaw equally: every disclosure re-renders its surface with
`innerHTML`, so pressing a provenance control destroys the pressed button and
drops focus to `<body>`; neither moves focus to the revealed content.

**V6 also introduces one regression V5B does not have** — the `resize` handler
that drops focus and wipes the composer draft (§2). Weighed against four
substantive advantages and an outright WCAG failure on the other side, V6 still
takes the dimension, but not cleanly.

### 6.14 Reduced-motion equivalence — **TIE / INCONCLUSIVE**

Both reach full equivalence: no state in either is carried by animation, and both
honour `prefers-reduced-motion` and a reviewer toggle. V5B kills motion absolutely
(`transition: none; animation: none`); V6 reduces to 1ms but adds three things
V5B does not — motion suppressed on the first painted frame (`body.booting`),
hover gated behind `(hover: hover) and (pointer: fine)`, and progressive formation
stepped by the reader rather than a timer so it reads identically with motion off.
More thorough on one side, more absolute on the other; the outcome is the same.

### 6.15 Anti-AI-generic quality — **TIE / INCONCLUSIVE**

The criterion names four traps and the two prototypes fall into different ones.

V5B risks *generic AI SaaS* and *dashboard template*: a card stack with 10px radii,
bordered ghost buttons and a teal accent is what any framework produces by default.
Nobody would mistake it for concept art.

V6 risks *AI concept art* and *fashionable Dribbble UI*: a three-column broadsheet
with a 46px display heading, hairline rules, near-zero radius, a tonal middle
column and an achromatic palette is one of the three current AI-design defaults,
and its mobile pager and filter chips are stock components. It is far better made,
and being better made is exactly what makes the concept-art reading available.

Neither is safe; they are unsafe in opposite directions.

### 6.16 QANDEEL specificity without logo/colour — **V6 WINS (decisively)**

With branding mentally removed, V5B is any competent neutral application; nothing
in it is QANDEEL. V6 still has the channel, the seat, the anchor's occlusion, the
opening and a paged stage with a shared middle — devices that exist nowhere else
and are not borrowed from Matn, Threshold or Wizn. Even the ones that do not work
are *particular*. This is V6's real achievement and the strongest argument for
carrying something forward.

### 6.17 Premium potential — **V6 WINS**

Not current polish — capacity. V6 already demonstrates the vocabulary that
"futuristic intelligence without sci-fi cosplay" requires from craft rather than
effects: structure by plane rather than line, an achromatic palette carrying all
hierarchy by lightness so grayscale is trivially passed (max chroma across every
background: **4/255**), custom easing curves, `:active` scale on every pressable,
durations governed by frequency (140ms for paging and focus, 260ms for the
drawer), first-paint suppression, 44px targets throughout, and no glow, glass,
blur-as-depth, particles, orbit or node map anywhere.

V5B refuses refinement on principle and its ceiling is structural: a card stack
cannot become premium, it can only be replaced.

### 6.18 Cognitive load — **V6 WINS (narrowly)**

The single largest reduction in either direction is the shared record existing
once. In V5B the reader must reconcile three identical sentences into one object,
every visit, and the reconciliation is a semantic correction the interface forces
on them.

Against that, V6 charges: three vertical flows with no fixed order, a sticky
middle column, a three-pane model to hold on mobile, a four-step tonal ladder to
decode, and twice the proportional explanatory prose. Real costs. But they are
costs of navigation, and V5B's cost is a cost of *truth reconstruction* — the
reader has to undo an error the layout introduced. Removing the error is worth
more.

---

# 6. TALLY

| verdict | count | dimensions |
|---|---|---|
| **V6 WINS** | **13** | 6.2, 6.3, 6.5, 6.6, 6.8, 6.9, 6.10, 6.11, 6.12, 6.13, 6.16, 6.17, 6.18 |
| **V5B WINS** | **1** | 6.1 |
| **TIE / INCONCLUSIVE** | **4** | 6.4, 6.7, 6.14, 6.15 |

**The tally is not the finding.** Thirteen of V6's wins are craft, density,
typography, accessibility and specificity — real, durable, and largely separable
from the territory/channel geometry. The geometry itself is carried by exactly one
dimension (6.2) and one high-weight dimension (6.5, where the win is the *rule*
"render it once", not the *shape* that renders it). §4 of the task is explicit
that V6 wins only *without* semantic lies or material usability regressions, and
there is one of each.

---

# 7. REQUIRED SYNTHESIS

### 7.1 What does V6 unquestionably improve?

1. **The shared dual-role record exists once** (3 → 1), with both roles stated
   where it stands. A semantic error removed at source.
2. **Card dependence** — 33 bordered boxes → 3. Material reads as the user's own
   language, not as rows in a report.
3. **Provenance** — the metadata line *is* the disclosure control; correction lives
   inside the accounting. One whole tier of chrome removed.
4. **Arabic typography floors** — 12.5px minimum, 1.85–1.95 body leading, and an
   RTL model that is composed rather than translated.
5. **Dialog accessibility** — a working Tab trap and Escape cascade against V5B's
   untrapped `aria-modal` dialog.
6. **Experience identity** — with branding removed, V6 is still recognisably
   something; V5B is not.

### 7.2 What does V5B unquestionably preserve better?

1. **A composition that cannot be read as a quantity.** One surface value, hierarchy
   by size/weight/spacing. Nothing to misread — which is the floor's entire job,
   and on this axis it holds and the challenger does not.
2. **Unambiguous reading order.** One column, one sequence, no decoding.
3. **Robustness.** Survives `resize` with draft and focus intact; no re-render
   coupled to viewport events.
4. **Honesty about what it is.** V5B never claims a metaphor it does not deliver.
   V6 makes three claims — the opening gives way, the empty ground is deliberate,
   the plane is not a quantity — that the composition does not honour.

### 7.3 Which V6 primitive is worth protecting even if the full direction is rejected?

**Single-instance shared material: the record renders once, and each reading's
role is stated at the record rather than beside a copy of it.**

This is the only V6 device that removes a comprehension error rather than
restyling one, and it is independent of territories, channels and columns. It can
be carried into a single-column composition unchanged. If V8 keeps one thing, keep
this rule.

Close seconds, all separable from the geometry: fragment-as-sentence,
provenance-as-disclosure-control, the seat (with its plane value re-solved),
progressive formation as a reader-stepped teacher, and the RTL paged stage with a
persistent active pane.

### 7.4 Which V6 primitive is most likely to become a gimmick?

**The opening.** It already is one.

It carries no information the channel does not already state, so deleting it loses
nothing. On desktop it meets the channel 122–496px away from the record, at two
different heights, in a region where the channel is empty — the "giving way" never
happens. On mobile it degenerates into a labelled box pointing at a pane it does
not link to. It exists to assert that a metaphor is present.

Runner-up: **progressive formation**. Excellent as a teaching device and a review
instrument, and correctly built. But in six months of daily use nobody steps
through it, and its necessity is itself the finding — a grammar that ships with a
five-step tutorial is a grammar that needs one.

### 7.5 Is the channel a genuine QANDEEL interaction primitive or only a good one-scenario device?

**A good one-scenario device — and the rarer scenario.**

The channel appears only when a record supports one reading *and* contradicts
another. Across the six fixture states it exists in three (S2, S3, S4) and is
absent from three (S0, S1, S5). In S5 — where one record supports *both* peers —
V6 has no channel, renders the record twice, and falls back to an appended
sentence («ودي كمان داخلة في القراءة التانية بنفس الدور»), i.e. to V5B's solution.

The runtime does not make support+contradict the common case. `hypotheses`
enforces disjointness only *within* one reading; a record may sit in
`supporting_evidence_ids` on many hypotheses. Same-role sharing across peers is
the case that will dominate real data, and it is the case the channel does not
cover.

V6's own self-check reports **PASS — "no dual-role item in this state"** for S5,
so the one state where V6 duplicates a shared record is definitionally outside its
own assertion.

**The rule the channel embodies is a primitive. The channel is a special case of it.**

### 7.6 Is the territory model durable across other types of analysis?

**Not as built.** It requires exactly two readings and degrades rather than scales:

- 0 readings → no stage at all
- 1 reading → `panes=1`, a single centred 64ch column; every spatial device except
  the anchor and the seat disappears
- 2 readings, no dual role → `panes=2`, no channel, no openings
- 2 readings + dual role → the full grammar
- 3+ readings → **untested and unaddressed.** The runtime guarantees neither two
  readings nor exactly two; `readingsAr()` in both prototypes falls through to
  «كذا قراءة» for n>2, and the mobile pager and the desktop 3-column grid have no
  defined behaviour beyond two peers.

The territory as *a reading's own ground* is durable. The two-territories-plus-
centre-channel *composition* is a shape fitted to one fixture.

### 7.7 Is Live Context actually improved by spatial intelligence?

**No. It is improved by craft.**

At rest V6's field is a drawer, a list and actions — no plane, no territory, no
channel. Its only spatial device, the raised foreground plane, exists solely as a
result of the user pressing «هاتها قدّام», and the resting plane is correctly and
deliberately flat because QANDEEL must never place one item nearer than another.

That truth constraint means spatial intelligence has almost nothing legitimate to
do on this surface. Everything that improved — no boxes, no bordered buttons,
provenance as control, an explicit boundary statement — is craft that a
non-spatial direction could adopt tomorrow.

### 7.8 Does mobile prove or weaken V6?

**Both, and the ledger is close to even.**

*Proves:* the paged stage is real, RTL-native and correctly mapped; the channel
keeps its plane and its position between the peers, so it is visibly the same
place as on desktop; the active pane survives re-render, which is what makes the
model holdable; peer parity is intact; the 26px sliver of the next pane is a good
craft cue.

*Weakens:* the opening does not survive at all; 43–51% of the channel pane is
empty ground produced by flex-stretch and justified by a sentence; the flagship
cross-surface move lands on the wrong pane while announcing success; a `resize`
event — routine on mobile — wipes the composer draft and drops focus; the pager is
a stock segmented control, so the concept is carried by the pane and undermined by
its own navigation.

### 7.9 Is the result closer to old QANDEEL's strongest DNA without reviving old AI aesthetics?

**Yes — and this is the clearest positive result of V7.**

Anchor, scene, peer readings, the shared seam and the reserved seat are all
present and all rebuilt from first principles. And the old aesthetics are
genuinely absent: no node map, no orbit, no constellation, no starfield, no glow,
no glass, no blur-as-depth, no particles, no circles as the object language, no
gold, no purple, no sci-fi HUD. Verified structurally — there is no line, arrow or
thickness anywhere in the prototype, and every background in Deep Analysis is
effectively achromatic (max chroma 4/255).

The DNA was recovered without the costume. That is a real result and it should
survive V7 regardless of what happens to the geometry.

### 7.10 What should V8 decide between?

Not "V5B or V6". The evidence separates V6's craft layer from V6's geometry, and
V8 should decide which spine to put the craft layer on:

1. **Single-column spatial spine.** Keep single-instance shared material,
   fragment-as-sentence, provenance-as-control, the seat, the anchor, and the
   restraint gradient across surfaces — on one column, with the shared record
   sitting *between* the two readings in reading order rather than in a third
   geometric column. Drops the opening, the four-plane ladder and the stretch-void.
   Retains almost every measured win and removes every measured semantic problem.

2. **Two territories + channel, repaired.** Keep the composition and solve three
   things explicitly: (a) replace the monotonic four-step lightness ladder with a
   non-ordinal way to say "different place"; (b) make the opening meet the record
   or delete it; (c) make the channel's empty ground a designed, bounded
   reservation rather than a stretch artifact — or remove the emptiness. Also
   define behaviour for one reading, for same-role sharing, and for 3+ readings.

3. **V5B's structure with V6's craft layer.** The floor's unambiguous reading order
   and quantity-free surface, re-set in V6's typography, de-carded material,
   provenance model and dialog accessibility.

V8 must also decide the **non-ordinal encoding of "different ground"** — it is
prerequisite to options 1 and 2 alike, and it is the single unresolved question
this evaluation surfaced.

---

# 8. THE LONG-TERM PRODUCT TEST

Six months, many topics, long Arabic content, sparse and dense sessions,
phone-first.

**V6's channel becomes:**

- *space-inefficient* — measurably. Its "deliberately empty" mobile ground is set
  by the tallest reading, so it grows with content: 384px at S2, 543px at S3 after
  a single note was added to a territory. Long Arabic readings make it larger, not
  smaller.
- *ceremonious* — it is the darkest, largest, most central object on every visit,
  in every state, whether or not it is what the user came for.
- *absent, often* — it exists in three of six states and only for
  support+contradict sharing, so the signature moment of the direction will simply
  not be there much of the time. A signature that appears intermittently reads as
  an inconsistency, not a grammar.
- *not repetitive* — one expressive event per scene is the right budget, and V6
  holds to it. This part of the design is correct.

**V6's other primitives age well.** Fragment-as-sentence, provenance-as-control,
the seat and the restraint gradient get better with volume, not worse — they are
the devices that remove chrome rather than add it. Under long Arabic content V6's
typography is the clear winner: 1.85–1.95 leading, no letter-spacing, a 12.5px
floor, and 64ch measures.

**One durability defect to name:** the anchor is `clamp(29px, 6vw, 46px)` at 1.30
leading with `max-width: 16ch`. Real subjects will wrap. At 46px, Arabic at 1.30
will collide.

**V5B's neutrality becomes:** boring and generic — yes, both, immediately. But
*durable* in the specific sense that matters here: it has no mechanism that can
decay into a false claim, and nothing in it needs to be true for it to keep
working. Its real cost compounds instead — 33 bordered boxes per screen, three
copies of every shared record, and two buttons on every item mean that dense
sessions make it worse at exactly the rate V6 makes them better.

Neither is the answer. V6's craft layer on a spine that does not carry an ordinal
reading is.

---

# 9. RECOMMENDATION

> ## B — `ADVANCE SELECTED V6 PRIMITIVES TO V8`

V6 clearly beats the floor on craft, density, typography, accessibility, Arabic
integrity and experience identity, and it recovered old QANDEEL's spatial DNA
without reviving its aesthetics. Those gains are real, measured, and must not be
lost.

But §4 permits a V6 win only where the spatial grammar improves the product
*without semantic lies or material usability regressions*, and there is one of
each: a four-step monotonic lightness ladder that reads as an ordinal scale and is
denied only in prose, and a mobile `resize` handler that destroys the composer
draft plus a cross-surface move that lands on the wrong pane while announcing
success. §7 further requires that the signature value survive mobile; the channel
does, the opening does not, and the channel's mobile emptiness is a layout
by-product wearing an explanation.

The territory/channel *system* should therefore not be adopted wholesale. The
primitives should.

### Primitives to carry to V8

1. **Single-instance shared material** — one record, roles stated in place, never
   duplicated. *(The rule, not necessarily the channel geometry. Extend it to the
   same-role case, which V6 does not cover.)*
2. **Fragment-as-sentence** — recorded material as the user's own language,
   separated by a short mark, never a card.
3. **Provenance-as-disclosure-control** — «مسجّل من كلامك · ⟨التاريخ⟩» is the
   button; the accounting and correction live inside it.
4. **The seat** — a named unknown holding space open under a sill, always naming
   what is missing. *Carry the form; re-solve its plane value.*
5. **The anchor** — the subject organising the scene and occluding it on scroll.
   *Fix the 1.30 display leading before it ships.*
6. **The RTL paged stage** — equal panes, the shared thing physically between the
   peers, the active pane surviving every re-render, gesture never the only route.
7. **Progressive formation** — reader-stepped, motion-independent. As a teaching
   and review instrument, not as product furniture.
8. **The restraint gradient across surfaces** — Conversation one trace, field one
   plane, analysis the full grammar. V6's most under-recognised achievement.
9. **The motion discipline** — frequency-governed durations, transform/opacity
   only, hover gated, nothing on first paint, nothing on the correction path.
10. **The dialog accessibility model** — Tab trap, Escape cascade, focus restore,
    `inert` while closed.

### Primitives NOT to carry

- **The opening.** No information of its own; the "giving way" is not composed on
  desktop and is absent on mobile.
- **The monotonic four-plane lightness ladder as the structural language.** Replace
  with a non-ordinal encoding of "different ground". This is V8's prerequisite
  decision.
- **The channel's stretch-derived empty ground and the sentence justifying it.**

### Defects to fix before any of this ships

- `window.addEventListener('resize', render)` destroying the composer draft and
  focus.
- `شوف دورها في القراءات` not calling `gotoPane()` on narrow, landing on
  territory A while announcing arrival at the record.
- Anchor `h2` at `line-height: 1.3` on Arabic display type.
- V5B's `aria-modal="true"` correction sheet with no Tab trap and no inert
  background — carried forward as a warning, since the same sheet pattern appears
  in both prototypes.

**This recommendation is advisory. V8 makes the direction decision.**

---

# 10. SCOPE STATEMENT

Nothing outside this folder was created or modified. `prototypes/v5b-neutral-
experience-floor/` and `prototypes/v6-salvaged-spatial-intelligence/` are
byte-unchanged; both were driven only through their own reviewer chrome, reviewer
deep links and product controls. No production code was touched. No new direction,
prototype or visual decision was produced. V8 was not started.

**V7 COMPARATIVE EVALUATION — READY FOR V8 DIRECTION DECISION**
