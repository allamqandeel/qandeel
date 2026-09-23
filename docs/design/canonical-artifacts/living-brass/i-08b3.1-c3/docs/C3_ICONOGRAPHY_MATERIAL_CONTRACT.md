# C3_ICONOGRAPHY_MATERIAL_CONTRACT

**I-08B3.1-C3.3 / C3.4.** Production permissions: which marks are made of Living Brass, which are not,
and how an argument for a new one has to be made.

**This contract grants MATERIAL. It never grants FORM, GEOMETRY or PLACEMENT.**

---

## 1. The scope sentence, because this is the thing that will be misread

> **"BRASS ICON FAMILY" ≠ "EVERY ICON GOLD."**

Coverage policy P2 makes **one persistent, QANDEEL-owned navigation family** carry **one material**
as **one family**. It does not make glyphs warm because they are visible, persistent, or important.

The boundary between those two readings is the boundary between a material identity and a generic
accent system. Invariant **I-15** guards it, with a probe that makes the send button Brass.

---

## 2. The permission classes

### A. PERSISTENT QANDEEL IDENTITY / NAVIGATION MACHINERY — **Brass permitted / expected**

| Member | Token | Notes |
|---|---|---|
| the canonical QANDEEL Q as the product mark | `qandeel.identity.mark` | material granted; **placement is an open question, see §8** |
| a rare, large, exceptional identity moment | `qandeel.identity.moment` | the **only** place the brushed/handled character may exist |
| the persistent navigation icon family | `qandeel.navigation.machinery` | **as one family, at every state, without exception** |

### B. ORDINARY FUNCTIONAL AND ACTION ICONS — **neutral by default**

send · plus / add · back · close · overflow · edit · settings actions · checkbox · radio · toggle ·
switch · utility affordances · row chevrons.

`qandeel.control.functional` → `#8b8982`.

**Brass is not automatic here and never becomes automatic.** It requires an *independent
identity-material permission* — which means an addition to `qandeel.identity`, argued on the record
against §5, not a local override at a call site.

### C. STATUS AND SEMANTIC ICONS — **Brass forbidden as the status code**

Status semantics are owned by I-08B3.1-E. `qandeel.status` is reserved and empty. Colour may not be
the sole carrier of status in any case (WCAG 2.2 SC 1.4.1), which survives whatever values E chooses.

### D. ANALYTICAL MAP MARKS — **Brass forbidden as analytical encoding**

Nodes, relations, clusters, rank, confidence, evidence, depth, FAR / MID / NEAR.

`qandeel.analysis.*` → frozen neutrals, permanently. This is the prohibition that has survived
unchanged since C0: the Living Analysis Map is the proprietary QANDEEL world and its truth is carried
by geometry, position, depth and rank.

### E. INTERACTION STATE — **Brass forbidden as the mechanism that distinguishes state**

See §6.

---

## 3. Counterexamples — the arrangements that are forbidden, and why each is tempting

| Arrangement | Why it is tempting | Why it is forbidden |
|---|---|---|
| Only the **selected** tab icon is Brass | It looks good. It is also what the platform's own current guidance recommends, on two separate pages. | Brass would encode selection. C2's `F04` capture shows it and records honestly that it looks better. |
| The **send** button is Brass | It is the primary action, and the platform says to use brand colour for primary actions. | Living Brass is not an accent colour. Marking primary actions would make it encode interactivity. |
| Brass **borders** on dark cards | It reads as "premium". | **BRASS NEVER ENCLOSES.** A warm frame on a dark card is gold trim, and it is the single fastest route from a material identity to a luxury relabel. Invariant **I-08**. |
| Brass **headings** or pull-quotes | It warms a long reading screen. | **BRASS NEVER SETS TYPE.** A reading ramp with a warm member is a ramp whose rungs no longer mean only rank. Invariant **I-07**. |
| Brass **dividers** | It is decorative and cheap. | Repeated ornamental warm lines are the accumulation failure in its most respectable form. Invariant **I-08**. |
| A Brass **analytical node** for the most important finding | It is the most important finding. | The material would encode analytical importance. Invariant **I-06**. |
| A Brass **premium** badge | Entitlement feels like an identity moment. | It is a status code wearing identity's clothes. Invariant **I-05**. |
| The character on **navigation** icons | **It works. C3 measured it.** | Nothing physical stops it. Only the permission does. See `C3_CANONICAL_LIVING_BRASS_SPEC.md` §4.4. |

**The last row is the one to take seriously.** Every other forbidden arrangement is forbidden by a
rule that some measurement backs up. That one is forbidden by a rule and nothing else.

---

## 4. Examples that ARE permitted

- The canonical Q in the standing machinery, quiet satin, at 30 px — **on every screen, under this
  contract's material grant** (its *presence* on every screen is §8's open question, not this
  contract's answer).
- All five persistent navigation icons, quiet satin, at 24 px, **identical at inactive, selected,
  focused, pressed and disabled**.
- One large identity moment carrying the brushed/handled character.
- A future QANDEEL-owned identity object that passes §5 and is added to `qandeel.identity` on the
  record.

---

## 5. THE TEST a new member must pass

An object may be added to `qandeel.identity` only if **all five** answers are strong. C2's material
story audit established these; C3 makes them the admission criteria.

1. **What is it?** Not "where is it" or "how big is it".
2. **Why is it QANDEEL-owned?** Would it exist in a competitor's product performing the same function?
   If yes, it is machinery, not identity.
3. **What permission is it claiming?** Identity material, or emphasis wearing identity's clothes?
4. **Would the reason survive a state change?** If the argument weakens when the object is disabled,
   the argument was about state.
5. **Is it the same material story?** Or a second warm thing that happens to share a hex?

**If any answer is weak: it stays neutral.** The default is neutral, and the burden is on the
addition.

---

## 6. STATE INVARIANCE — C3.4

```
If an element has Living Brass permission, its Brass material reference does not change because it is
selected, focused, pressed, disabled, hovered, unread, successful or in warning.
```

**Implemented as unavailability, not as discipline.** There is no state sibling of
`qandeel.navigation.machinery` to reach for; `qandeel.state` is reserved and empty; and the sealed C2
tab builder takes *one* material for all five positions with no per-index argument.

### 6.1 What carries state instead

Neutral type weight, neutral ink rank, and a 2 px achromatic rule above the selected item — each
achromatic, each satisfying WCAG 2.2 SC 1.4.1 without colour. **C3 does not freeze this.** Final
interaction expression is owned by I-08B3.1-E; this is the diagnostic carrier the proofs used, and it
is recorded so that E inherits a working baseline rather than a blank.

### 6.2 The measurement

C3's reproduction rasters put a number on it that no markup guard can: the four environments and the
four interaction states contain **exactly 2109 chromatic pixels each — identical, not similar.** The
material's footprint does not move when an item is selected, pressed, focused or disabled.

### 6.3 The platform agrees, on this point

> *"You don't need to provide selected and unselected appearances for an icon that's used in standard
> system components such as toolbars, tab bars, and buttons."* — Apple HIG, Icons

State invariance is not a QANDEEL eccentricity fighting the platform. On this specific point the
platform says the same thing — even though on the *colour* of a selected tab it says the opposite, on
two separate pages. Both are recorded in `C3_REFERENCE_GATE.md`.

### 6.4 The known collision, carried forward unsolved

The disabled neutral sits close enough to the rest-state ink to be argued with, and the collision gets
worse as the body gets stronger. `#A58E6F` is the strongest body tested. **C1R recorded it, C2 was
instructed not to solve it, and C3 does not solve it either** — it is a dependency for E, and it is
better handed over than quietly fixed and lost from the record.

---

## 7. What this contract does NOT grant, and an obligation it passes on

**C3 freezes no icon geometry.** Not stroke weight, not corner treatment, not the glyph set, not
sizes, not the tab container, not motion, not an active indicator. The material contract says what a
mark is *made of* if it exists. It says nothing about its shape.

### 7.1 An RTL obligation that the material grant does not settle

QANDEEL is Arabic-first. RTL is a **directional system, not a mirrored one**: icons that encode
direction must be mirrored by *meaning*, and logical properties must be used rather than physical
ones. In C2 this caught a real defect — a send arrow pointing the wrong way.

C3 changed no glyph, because it freezes none. **Any future navigation icon set inherits these
obligations in full**, and the fact that a mark is entitled to the material must not be read as
evidence that its direction has been settled.

### 7.2 A consistency obligation from the platform, passed to integration

> *"Whether you use only custom icons or mix custom and system-provided ones, all interface icons in
> your app need to use a consistent size, level of detail, stroke thickness (or weight), and
> perspective."* — Apple HIG, Icons

**The C1/C2 proof harness does not currently satisfy this**: navigation strokes are 1.75 at 24 px and
functional strokes 1.6 at 20 px — different stroke-to-size ratios. That is a property of a proof
harness, not of a frozen icon set, and C3 freezes neither. It is recorded here so the obligation is
not lost between a stage that could not act on it and a stage that will not think to look.

---

## 8. THE OPEN QUESTION C3 DOES NOT CLOSE

> *"Resist the temptation to display your logo throughout your app or game unless it's essential for
> providing context."* — Apple HIG, Branding

The canonical Q stands on every screen. C2 flagged this and noted that choosing between the coverage
policies could not resolve it, because it is true under both.

**C3 cannot resolve it either, and does not pretend to.** It is a **placement** question;
`qandeel.identity.mark` grants **material**. The token says what the mark is made of if it is there,
and says nothing about whether it should be.

Carried forward in `C3_FREEZE_RECORD.md` as an open dependency of later Product/UI integration.
