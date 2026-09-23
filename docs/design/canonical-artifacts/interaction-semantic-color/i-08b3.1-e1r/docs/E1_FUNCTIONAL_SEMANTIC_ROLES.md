# E1_FUNCTIONAL_SEMANTIC_ROLES

**I-08B3.1-E1.** Which functional semantic roles QANDEEL genuinely needs, and which of
them genuinely need a colour. Those are two different questions and this document keeps
them apart.

---

## 1. The decision, in one table

| role | KEPT? | classification | resolves to | overturn condition |
|---|---|---|---|---|
| **ERROR** | KEPT | **1 — DEDICATED HUE, EARNED** | `qandeel.expression.status.error` `#fe907e` | — |
| **WARNING** | KEPT | **3 — HAS NOT EARNED A HUE** | `qandeel.content.primary` | **MET ONCE** — §4 |
| **SUCCESS / CONFIRMATION** | KEPT | **3 — HAS NOT EARNED A HUE** | `qandeel.content.primary` | **MET ONCE** — §5 |
| **INFORMATIONAL** | KEPT | **3 — HAS NOT EARNED A HUE** | `qandeel.content.secondary` | not met — §6 |

**All four roles are kept. One has a hue.** Nothing is merged and nothing is deleted: a
role that exists in the Product exists in the token tree, and the token tree shows which
ones have a colour of their own by *what they resolve to*. A reviewer reads the decision
off the graph without reading a word of prose, and check **R03** asserts it.

---

## 2. The governing principle, as I-08B3.1-E1R states it

> **STATUS COLOUR IS EARNED, NOT ASSIGNED BY TAXONOMY.**
> A role does not receive a dedicated hue because it has a name.
>
> **QANDEEL DOES NOT USE A GENERIC TRAFFIC-LIGHT PALETTE.** That is the part that is frozen.

**ERROR currently owns the only dedicated system-status hue.** The other three remain
neutral **until a real Product case proves** that their required attention, persistence or
detached presentation cannot be carried truthfully and accessibly by position, copy, glyph,
state change, boundary or hierarchy. A future dedicated status expression requires **Product
evidence**. It is **not prohibited**, and **the count is not a cap**.

### 2.1 What E1 said, and why the wording had to change

E1 froze the **number** of dedicated status hues as a Product contract — the wording is
quoted in `E1R_REVISION_RECORD.md` §3, which is the one document allowed to hold it. It read
as a finding. It was an absolute about every status role QANDEEL will ever have, established
on evidence about one of them — and the three refusals it locked in had never been tested against a
real Product surface, which E1's own limitations document admitted.

The reasoning survives. The **interruption budget** is still the right instinct: warning is
carried by position, success by the state it reports, informational by rank. What changes is
that those are now the **current expressions with a stated route out**, rather than a
ceiling. The asymmetry they produce is still the point — *if only the thing needing
attention is coloured, the coloured thing is always the thing needing attention* — and it
is a reason to hold the line, not a reason the line can never move.

### 2.2 And the audit found the route was already open, twice

`E1R_PRODUCT_SURFACE_AUDIT.md` classified eight QANDEEL surface categories. **Two of the
three refusals have a real case that meets their own stated overturn condition** — ambient
service degradation for WARNING, and out-of-place background completion for SUCCESS.

**Neither is answered with a hue here.** A condition being met means the refusal is no
longer automatic, not that a colour is owed: in both cases the first answers are still
position, a glyph, copy, and somewhere for the result to land. Both are handed to Product
with the exact case named. **Under E1's wording there would have been nowhere to put this
finding except a contradiction.**

---

## 3. ERROR — class 1, a dedicated hue, earned

**What it is.** Something failed, or what is here is not valid. **Retrospective, and about
state** — which is what colour is good at marking.

**Why it needs one.**

1. It is the one status the user must not act past. Every other status tolerates being
   missed for a moment; an invalid field acted on is a cost the user pays.
2. It is the one status the platforms agree about. Both Apple and Material give error a
   colour, and users arrive carrying that expectation. **Familiarity is a real design
   input**, and error red is the single convention E1 keeps — declared as a decision in
   `E1_COLOUR_DERIVATION.md`, not disguised as a measurement.
3. Material 3 ships 26 standard colour roles in six groups and **error is the only status
   role among them**. Two independent systems converged on the same shape.

**One value, not a family.** A second tone would be a ladder, and a ladder is how a
palette starts. The single ink carries text, glyph and the field boundary.

**The value is PRODUCT-OWNER VISUALLY APPROVED**, and its acceptance rests on Product visual
judgement plus contrast and accessibility evidence plus semantic-separation evidence. The
OkLCh and dichromacy derivation in `E1_COLOUR_DERIVATION.md` is **engineering evidence about
this palette on this ground** — the perceptual floor is QANDEEL's own, derived from how far
Living Brass already sits from the reading ramp. It is not a universal accessibility law and
it does not prove that no other valid error red could exist. See `E1_FREEZE_BOUNDARY.md` §3.

**Colour is never the sole carrier**, and in QANDEEL that is not a formality: the
alternative WCAG 2.2 SC 1.4.1 offers — a lightness difference at 3:1 — reaches only
**1.03:1** against the secondary reading ink and **1.58:1** against the tertiary. The
glyph, the copy and the promoted boundary are load-bearing. See
`E1_NON_COLOUR_COMPANION.md`.

---

## 4. WARNING — class 3, has not earned a hue

**What it is.** *This will happen if you proceed.* **Prospective, and about consequence.**

**Why it has not earned one yet.** Three reasons, in descending order of how much they
should be trusted.

1. **A Product reason.** In every QANDEEL commit surface audited, a warning is attached to a
   commit the user is performing — publishing a world publicly, leaving one, disclosing a
   source, deleting. The boundary the user commits across is therefore already the right
   carrier, and the frozen Surface contract already owns it: *"a FIELD is a boundary, not
   a box: the line does the work."* Apple puts the same restraint on the pattern: a
   confirmation belongs to "genuinely destructive, irreversible actions (use sparingly;
   overusing it trains people to click through)".
2. **A measured reason.** The hues an amber or orange warning would occupy — roughly
   OkLCh 55–90 — are **inside the band QANDEEL already paints**. Every chromatic value in
   the frozen system lives in **hue 74.8 to 94.2**, a 19.4° band: the reading ramp at
   91–94, QANDEEL Light at 89–90, Living Brass at 75. A warning hue there would put a
   status colour inside the identity material's neighbourhood and the "BRASS IS MATTER"
   boundary would stop being checkable by measurement.
3. **A systems reason.** Three hues is a traffic light. The brief lists that as a failure
   condition and it is right to.

**Expression.** The commit boundary promoted to the primary reading ink at double weight,
a triangle glyph, and copy that names the **consequence** rather than the risk. Board
`b07`, left cell.

**THE CONDITION THAT OVERTURNS THIS.** A warning that must appear **ambiently** — detached
from any commit the user is performing.

### 4.1 The condition is MET, and here is the case

**Transient connection or service degradation in a Shared or Public world.** It is
persistent, it is detached from any commit, it is not a failure of anything the user just
did, and it changes what the user should believe about what they are writing — that it may
not be reaching anyone. Nothing about it is prospective-at-a-boundary, which is the entire
basis of the refusal above.

E1 had already half-seen this and disposed of it in a single table row: *"an offline /
degraded colour — a persistent system condition, not a per-action status … if it ever has to
interrupt, it is an error and already has a colour."* That is the disposal that its own
overturn condition contradicts, and its own wording made the contradiction unsayable.

**E1R does not create a hue for it**, and the reason is an argument rather than a rule:
degradation must be *noticed without interrupting*, which is the one thing a status hue is
worst at — and the hue QANDEEL has is the one that means *act on this now*. The likely right
answer remains a persistent banner carried by position, a glyph and copy. **But that is a
Product judgement about a real surface, and it is handed up as one**, with the evidence a
hue would require named in `qandeel.status.warning.$extensions`.

---

## 5. SUCCESS / CONFIRMATION — class 3, has not earned a hue

**What it is.** An operation resolved.

**Why it does not get a hue.** A successful operation in QANDEEL resolves **into state**:
the world is now public, the member has joined, the answer has arrived. The interface is
already showing that, and the state system E1 just specified shows it better than a colour
could. A persistent green would be a second, weaker statement of a fact already on screen,
and it would spend the interruption budget on the one outcome that needs none of it.

There is also a smaller, real argument from the copy: an action keeps the same name
through the whole flow, so the commit «اجعله عامًّا» produces the confirmation
«أصبح العالَم عامًّا» — one root, carried through. The confirmation is the *verb of the
action in the perfect tense*, which is a stronger signal of success than a hue and costs
nothing.

**Expression.** The changed state, shown changed; a bare check glyph; copy in the perfect
tense. Board `b07`, middle cell.

**THE CONDITION THAT OVERTURNS THIS.** An operation whose result **cannot be shown in
place** — a background job whose outcome has no visible home.

### 5.1 The condition is MET, and here is the case

**A background analysis or replay that completes after the user has navigated away.**
QANDEEL has this shape in the record already — replay distribution, analytical projection,
post-finalisation source availability — and the whole argument above depends on the result
resolving *into a state the user is looking at*. When they are not looking at it, it does
not.

**E1R does not create a hue for it.** The first missing thing is not a colour, it is a
**place to land**: where does a completed background result go, and what does the user see
when they return? That is a Product and navigation question, and until it is answered a hue
would be decorating a gap. The glyph-and-copy answer stands for the in-place case. **Handed
up**, with the evidence a hue would require named in the token.

---

## 6. INFORMATIONAL — class 3, has not earned a hue

**What it is.** Present, true, and subordinate.

**Why it does not get a hue.** This is precisely what the frozen three-step reading ramp
was built for. A blue would add a fourth hue to a product that has three, to say something
the ramp already says by rank. Apple's guidance on dynamic roles is the same shape:
"don't use the separator color as a text color, or secondary text label color as a
background color" — the semantic ladder means something and is not a set of tints.

**Expression.** Secondary reading ink, plus a glyph **only where the information is a
distinct KIND** rather than a subordinate detail. Board `b07`, right cell.

**THE CONDITION THAT OVERTURNS THIS.** Information that is a distinct kind rather than a
rank — and then the answer is the glyph, not the hue.

**NOT MET in the audit.** The closest case is a privacy or authority-boundary statement —
*who can see this* — which is a genuinely different kind of fact from a subordinate detail.
It reads correctly at secondary rank with a lock glyph, which is the glyph answer the
condition itself points at. Recorded as checked rather than assumed.

---

## 7. Roles NOT created, and why they were even considered

| candidate | verdict |
|---|---|
| **a "new / unread" colour** | Not a status. Unread is a state of an object, and C0's permission model already forbids Brass from carrying it. If the Product needs it, it is a new decision with the same channel problem every state has. |
| **a "confidence" or "certainty" colour** | Forbidden upstream and correctly: D2R's contract says geometry does not manufacture meaning, and a colour scale for confidence is the same error in a different channel. |
| **an "offline / degraded" colour** | **RECLASSIFIED BY E1R.** E1 disposed of this as "a persistent system condition, not a per-action status", which is true and is not a reason. It is precisely the case its own WARNING overturn condition names, and it is now recorded as such in §4.1 and handed to Product rather than dismissed in a table. |
| **a container / fill family for each status** | QANDEEL has one Surface tone and no elevation ladder. A tonal container per status would reopen the entire B track. |
