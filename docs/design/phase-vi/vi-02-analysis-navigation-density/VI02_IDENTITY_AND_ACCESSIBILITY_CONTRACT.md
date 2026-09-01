# QANDEEL — VI-02 · IDENTITY & ACCESSIBILITY CONTRACT

**Canonical.** How "which reading is this?" is answered on every surface, for every reader —
and what that answer costs.

- **Task:** VI-02 — Analysis Navigation & Density Scalability
- **Closure task:** VI-02-FREEZE-01
- **Governs:** clauses F-03, F-05, F-06, F-09, F-10, F-11 of
  [`VI02_BEHAVIORAL_NAVIGATION_FREEZE.md`](VI02_BEHAVIORAL_NAVIGATION_FREEZE.md)

---

## 1. The identity rule

> **The full statement is the canonical human-facing identity source for a reading under the
> current runtime. A derived title, excerpt, ordinal, letter, position, machine ID, or
> set-relative fragment must never be the sole human-facing discriminator on a choosing
> surface. Compact excerpts may exist only as clearly secondary references/pointers when the
> full statement is reachable under F-06 without commitment.**

The full statement is the field VI-02 **validated** as the canonical human-facing identity source
across the tested peer sets. It is not the only human-language material a record carries — it is
the one proven to do this job.

**Other existing fields are not a reliable replacement for that role:**

| Field | Why it cannot carry identity on its own |
|---|---|
| `scope`, `type`, `domain` | Required and human-readable, but routinely **shared across peers** — in the hardest tested case all three were identical for both readings |
| `assumptions`, `disconfirming_conditions` | Human-language, but **may be empty or non-distinguishing**; the tested late-divergence pair carried none |
| `created_at` / record date | Shared across peers in the tested case; provenance, not identity |
| `id` and other machine identifiers | **Not human-facing identity** at all |
| `origin`, `status`, `version` | Enumerated state, not a discriminator between peers |

The conclusion is a validated product finding, not a claim about what the record contains.

### 1.1 What the rule binds equally — FROZEN

The accessible name of a peer is bound exactly as strictly as its visible text.

> **An accessible name may not replace the full statement with a shorter or different identity.**

A name computed from an excerpt is the same defect as a visible excerpt-as-identity — it is
simply invisible to the people who can check it. Assistive technology must receive the full
identity truth, never a lesser one.

**This is a rule about *truth*, not about attributes.** `aria-labelledby` is **not forbidden**
where it references the truthful full statement, or equivalent full identity. What is forbidden
is any naming mechanism — attribute, hidden text, generated string — that substitutes a shorter
or different identity for the statement.

> **Prototype evidence — NOT FROZEN.** The validated prototype computed the name from content
> using a visually-hidden action verb, the whole statement, and the record date, with no naming
> attribute in play. That is one proven way to satisfy the rule above. It is not the required
> implementation.

### 1.2 What is forbidden outright

| Forbidden | Why |
|---|---|
| Ordinal identity (numbers, letters, first/second/last) | A position is not what a reading *is*; and it renames every peer when the set changes |
| Position identity | Same defect, stated spatially |
| User-visible machine ID (UUID or internal identifier) | Not human-facing identity; leaks implementation as meaning |
| Set-relative disambiguation | Identity that changes when the peer set changes is identity derived from position |
| Fabricated distinction between records that carry none | VI-02 does not invent a UI distinction for data that does not contain one |
| An accessible name that differs in truth from the visible identity | Assistive technology must receive the same truth, never a lesser one |

### 1.3 What is permitted

A **compact reference** — a role line, a cross-reference, a pointer from a shared record or
from a conversation — may carry an excerpt. It must be clearly a pointer, honest about being
opening words rather than an identity (including to assistive technology), and it must land on
the reading. It is never the discriminator a reader is expected to choose by.

---

## 2. F-06 — identity reachable without commitment

> Wherever a reading is represented by less than its whole statement, the reader must be able
> to reach the whole statement **on that surface**, without foregrounding it, choosing it,
> dismissing the choosing surface, or losing their place.

**Inspecting a reading is not choosing it.** Disclosure must not require commitment: it may not
foreground a reading, choose it, dismiss the choosing surface, or cost the reader their place.

### 2.1 Frozen requirements

- **Disclosure must not require commitment** — inspecting is not choosing.
- **No nested interactive content.** A control inside a control is invalid and behaves
  unpredictably for assistive technology.
- **Disclosure must be structurally associated with the reading it governs**, so that the
  relationship is programmatically determinable and not merely visual.
- **Its state must be exposed** before and after use, through the same truth visually and to
  assistive technology.
- **Disclosure is offered where the presentation actually abbreviates**, and not where the
  statement is already whole — the reader is never asked to operate an affordance that reveals
  nothing.

### 2.2 Prototype evidence / implementation example — NOT FROZEN

> The validated prototype placed the disclosure control as a **direct sibling** of the peer's own
> control inside the shared list item, and decided when to offer it by **detecting visual
> clipping from live layout**, re-measured after any text-scaling change. Its handler changed one
> class and one attribute and nothing else.
>
> **Direct sibling DOM placement is not frozen** — the frozen requirement is valid structural
> association plus no nested interactive content, which many structures can satisfy.
> **Live-layout clipping detection is one validated method, not the only future method** — it was
> chosen over a character threshold because where a presentation cuts depends on script, width and
> the reader's text size, but any method that reliably identifies abbreviated readings satisfies
> the rule.

**The mechanism is not frozen.** A per-row control satisfies F-06 today. A node that opens in
place, a preview that expands inside a spatial field, or a composition that never abbreviates
would satisfy it equally.

---

## 3. The late-divergence finding — why F-06 exists

The runtime permits two readings that are materially identical for a long opening and diverge
only afterwards. Built as a fixture and measured in real headless Chrome inside a **true
375×812 viewport**:

| | shared opening | 4-line preview holds | previews identical? |
|---|---|---|---|
| Arabic pair | 262 chars | 173 chars | **yes** |
| English pair | 336 chars | 171 chars | **yes** |

Both readings shared record date, type, domain and scope, carried no assumptions and no review
conditions, and the divergence was a real inversion of the claim — not a lost detail.

Tested against excerpt-scale identity at every plausible length, the pair **collides** at 40,
60, 80, 160 and 240 characters, and separates only at 340 — longer than the Arabic statement
itself. This is why F-05 forbids excerpt-as-sole-identity as a **truth** rule and not a
stylistic preference.

With F-06 the pair is separable **on the choosing surface, before any commitment**, using
nothing but the field that already exists. What the sighted reader was missing was not *data*
but *space* — and space is a presentation-layer problem with a presentation-layer answer.

---

## 4. Current-state exposure — where it is legitimate and where it is not

**A surface that foregrounds nothing exposes no current peer.** In the frozen reference
architecture, the whole-set surface carries no `aria-current`, no state word, no emphasis, and
no current-reading value in its URL — on entry *and* after a return round trip. Restoring
scroll position and keyboard focus to the reading the reader opened is **orientation, not
currency** (F-09).

**A surface that has an actual foregrounded reading may say so.** The evaluated runner-up F2
legitimately marks its open reading with `aria-current` **together with** the visible state
word, because it genuinely has one foregrounded reading and the two channels say the same
thing. The rule is not "never expose state"; it is **state words, never rank, and never a
state only one class of reader can perceive**.

An `aria-current` that only assistive technology could perceive was treated as a freeze
blocker during review, because a peer marked *current* on a surface that foregrounds nothing
is a rank leaking in through a side door.

---

## 5. The honest costs, recorded rather than hidden

**Assistive-technology users receive more than sighted users, by default.** A peer's accessible
name is the whole statement even while the visible presentation abbreviates it, because the
abbreviation is a presentation effect and the text is in the document. This is the safe
direction of asymmetry — nobody is denied identity — but at 24–32 peers it is **verbose**.

The verbosity was accepted rather than traded for truncation, because truncation is exactly
what F-05 exists to forbid. It is recorded here as a live design question that VI-03 may answer
presentationally — a heading-per-peer structure that lets AT users skim by heading, or a list
semantics that exposes the statement once per item — both of which are presentational decisions
about the same truth, and therefore explicitly open.

**Whole-statement AT verbosity is deferred to VI-10 live screen-reader validation.** The model
is proven structurally and programmatically; that is strong and is not a substitute for a live
NVDA/JAWS session. This freeze raises the stakes of that pass rather than lowering them.

**A per-peer disclosure control is redundant for AT.** A screen-reader user already has the
whole statement, so the control adds a focus stop and no information. Hiding it from AT was
rejected — a focusable element assistive technology cannot perceive is a worse defect than a
redundant one — so it stays exposed and plainly named. Recorded, not hidden.

**Repeated control names.** Per-item controls in a list share a name, with the list item
supplying context. Naming each control with its reading's statement would double an already
long name for no gain.

---

## 6. Exact-duplicate boundary *(C2 — binding)*

> **VI-02 does not assume that full statements are globally unique across all valid Hypothesis
> records. Exact human-facing duplicates must never be cosmetically disambiguated with
> ordinals, letters, UUIDs, rank, or invented labels. If a production exposure path can surface
> materially distinct records whose human-facing identity is indistinguishable even with the
> full statement shown, that exposure requires a separate truth/runtime/product-contract
> investigation before shipping that state. VI-02 does not invent a UI distinction for data
> that does not contain one.**

Runtime truth at the reviewed baseline:

- the controlled generation path rejects normalized duplicate `statement + scope`;
- `HypothesisService.create()` itself does **not** enforce a general collision/uniqueness
  invariant;
- therefore **"guaranteed distinct peers" remains forbidden** as a design assumption.

This is an **implementation / exposure precondition**, not a request to modify runtime. It is
restated in full, with the same authority, in
[`VI02_RUNTIME_DEPENDENCY_AND_EDGE_BOUNDARIES.md`](VI02_RUNTIME_DEPENDENCY_AND_EDGE_BOUNDARIES.md).

---

## 7. Accessibility invariants carried by the freeze

WCAG 2.2 AA is the floor, and the following are architectural rather than cosmetic:

| Invariant | Requirement |
|---|---|
| **Label in Name (2.5.3)** | An accessible name may not rephrase away a visible label — the visible label must remain part of the name. *(The prototype satisfied this with visually-hidden text placed around the visible label; that is one proven technique, not the frozen one.)* |
| **Name, Role, Value (4.1.2)** | Every control is a real control with a real name and live state |
| **Info and Relationships (1.3.1)** | A peer and its disclosure are structurally associated, and the association is programmatically determinable rather than only visual |
| **Keyboard (2.1.1)** | Every route is reachable by keyboard, in document order, with no trap; no route depends on a gesture |
| **Focus Visible (2.4.7)** | Focus is visible, including after a foreground→return round trip |
| **Use of Colour (1.4.1)** | No state is carried by colour alone |
| **Resize & Reflow (1.4.4 / 1.4.10)** | No horizontal overflow at 375px at 200% text size, in either script, with every statement revealed |
| **Nested interactive content** | Forbidden — a control inside a control is invalid and behaves unpredictably for AT |
| **Position semantics** | No `aria-posinset` / `aria-setsize` used as identity; no numeric or alphabetic peer markers |

**Direction is logical, never physical.** Layout uses logical properties end-to-end; forward and
back follow reading direction; Arabic line-height stays generous; no `letter-spacing` and no
italics on Arabic.

**Announcement carries no excerpt — FROZEN as a semantic requirement.** Arrival at a reading must
be announced *after* it happens, and the identity a reader receives on arrival must be the full
statement, never an excerpt of it.

> **Prototype evidence / implementation example — NOT FROZEN.** The validated prototype met that
> requirement by announcing synchronously with the focus move, taking identity from the focused
> element's own accessible name and using a live region that confirmed only the arrival. **The
> exact announcement mechanics, sequencing and timing are open to implementation and to VI-10
> live screen-reader validation**; only the semantic truth requirement above is frozen.

---

## 8. What is NOT settled here

Numeral policy remains **open** (unfrozen). Arabic chrome strings used in the prototypes are
**provisional for rendered-surface testing** and remain subject to a later
VI-01-application review. Inline foreign terms inside statement text still need
presentation-layer handling in production and were deliberately not faked in fixture data.
