# E1R_REVISION_RECORD

**I-08B3.1-E1R — TARGETED INTERACTION / STATUS CONTRACT CORRECTION.**

**This is the one document in the package permitted to quote the withdrawn wording.** Every
other shipped surface is scanned by `tools/e1-consistency.mjs` and fails if it states any of
the four claims below; a record of withdrawn claims has to be able to name them, and the
guard allows exactly this file and — for the Brass statement — the document that resolves it.

**NO TOKEN VALUE CHANGED. `#fe907e` AND `#696762` ARE BYTE-IDENTICAL TO WHAT E1 SHIPPED.**
Four frozen sentences changed, one stylesheet rule was removed, and one combination that had
no expression now has one.

---

## 1. REV-01 — DISABLED FOCUSABILITY IS NOT UNIVERSAL

### What was frozen

> **A DISABLED CONTROL IS NOT FOCUSABLE**, is not in the tab ring, and states the reason
> it is unavailable.
> — `E1_FREEZE_BOUNDARY.md` §1, product-contract statement 7, and
> `com.qandeel.freeze-boundary.productContract` in the shipped token document

### What is wrong with it

It is one of two legitimate patterns, frozen as though it were the only one — **and it is
the pattern with the accessibility cost.** W3C's ARIA Authoring Practices Guide, *Developing
a Keyboard Interface*, read at its URL on 2026-09-22:

> "there are some contexts where it is useful for an element to convey a disabled state
> while remaining focusable, especially inside of composite widgets"

> "Screen reader users are far less likely to discover disabled elements that are not
> focusable because moving focus is one of their primary methods of discovery."

The same page asks for *"consistent pattern-based conventions for the focusability of
disabled elements"* — which is a request for exactly what E1 failed to produce. **E1 had read
accessibility sources and still wrote the absolute**, because the ONE-CHANNEL RULE (REV-02)
made "DISABLED + focus cannot occur" sound like a consequence of the model rather than the
separate accessibility claim it was.

### What replaced it

**DISABLED DESCRIBES AVAILABILITY, NOT FOCUSABILITY.** Two patterns, in
`com.qandeel.availability` on the shipped token:

| | NATIVE NON-DISCOVERABLE UNAVAILABLE | DISCOVERABLE UNAVAILABLE |
|---|---|---|
| available / can activate | no / no | no / no |
| in the focus order | **no** | **yes** |
| web | HTML `disabled` | `aria-disabled="true"`, activation suppressed in script |
| cost | a screen-reader user may never find it | every keyboard user spends a keystroke |

**The two are visually identical**, which is itself contract: a visible difference would
encode an implementation decision as a Product meaning.

### What proves it

- **R26** — the shipped declaration: two patterns, both unavailable, both unable to
  activate, differing only in focusability. Its probe is E1's own absolute fed back in.
- **R31** and six behavioural obligations under real `Tab` and real `Enter` keys: the native
  one is skipped, the discoverable one is reached, neither activates, **and an available
  control does activate under the same key** so the obligation is not vacuous.
- **Three new behavioural probes**, none invented: the discoverable control with its
  activation not suppressed (reachable, painted unavailable, fully operable); only the
  native pattern styled (MDN: `aria-disabled` *"doesn't"* bring user-agent styling); and the
  availability override taking the record of the user's choice along with the ink.
- Board **b15**, which puts the same two controls under both patterns side by side.

### What it cost

`E1_REACT_NATIVE_MAPPING.md` **D-E1-6**: the DISCOVERABLE pattern has no verified React
Native form. The web half is fully proved; the native half is specified and untested, and
`reactnative.dev` could not be read from this host, so no first-party wording is quoted and
none is invented.

---

## 2. REV-02 — THE "ONE-CHANNEL RULE" WAS FALSE

### What was frozen

> **THE ONE-CHANNEL RULE** — PRESSED owns the ground, FOCUS owns a detached perimeter,
> SELECTED owns an attached marker plus ink and weight, DISABLED owns the ink of the whole
> control. **No channel is used by two states.**
> — product-contract statement 2, repeated in four documents, one token description and
> two board captions

### What is wrong with it

**The last sentence contradicts the one before it.** SELECTED writes the ink. DISABLED
writes the ink. It was untrue on the day it was written, and it was checked by a check that
looked at *different named channels* rather than at what any state actually does.

The damage was not cosmetic. A wrong explanation **stops people looking**, and this one did
two things: it made REV-01's absolute look like a structural consequence, and it left
`SELECTED + UNAVAILABLE` with no expression at all.

### What replaced it

**The STATE COMPOSITION / OWNERSHIP MODEL**, in `com.qandeel.composition`. Three channels
exclusively owned, **one shared**, one state that is an override:

| channel | owner | also written by | resolved by |
|---|---|---|---|
| GROUND | PRESSED | — | — |
| DETACHED PERIMETER | FOCUS | — | — |
| ATTACHED MARKER — presence | SELECTED | — | — |
| **INK** | SELECTED | **DISABLED** | **P1** |
| TYPE WEIGHT | SELECTED | — | — |
| AVAILABILITY *(not visual)* | DISABLED | — | — |

**P1** availability overrides ink, including the marker's — but takes neither the marker's
presence nor the weight. **P2** availability suppresses the press response. **P3** focus is
orthogonal and is never suppressed by another state.

**All sixteen combinations are enumerated with a verdict and a rule.** Nine reachable, four
unreachable (all four by P2), three conditional.

**Nothing accepted was removed.** Every expression on every approved board is unchanged; the
model explains them instead of contradicting them.

### SELECTED + UNAVAILABLE, ruled at the control type

E1 would have answered "impossible" from a universal it did not have.

| control type | verdict |
|---|---|
| a chosen **value** in a set — filter, scope chip, option row | **REACHABLE, AND EXPRESSED** |
| a list row that is the current destination | **PRODUCT-OWNED — not ruled out** |
| a persistent navigation item | **NOT EXPRESSIBLE IN E1R** — a scope statement, not a Product law |
| a button | **NOT APPLICABLE** — a button has no selected state |

Marker present **in the unavailable ink**, weight promotion **retained**, every ink
collapsed. Two channels distinguish it from UNAVAILABLE, one from SELECTED, and the reason
sentence — «واختيارك محفوظ» — is the third and load-bearing channel.

### What proves it

- **R27** — all sixteen combinations present with a verdict and a rule. Its probe removes
  `focus+disabled`, which is the state E1 shipped in.
- **R28** — derives each channel's writers **from the shipped matrix** and requires the
  ownership table to declare exactly those. It therefore fails on an undeclared writer *and*
  on a declared writer nothing writes. **Its probe is the withdrawn claim's exact shape.**
- Three behavioural obligations measuring the composed control's computed marker, weight and
  ink, and a probe that collapses the record.
- Board **b17**, which prints the matrix out of the shipped token file.

---

## 3. REV-03 — THE STATUS-COLOUR CAP

### What was frozen

> **QANDEEL HAS FOUR STATUS ROLES AND ONE STATUS COLOUR.** Error is the only role that must
> interrupt.
> — product-contract statement 9, and, in the token document, *"QANDEEL has FOUR status
> ROLES and ONE status COLOUR"*

### What is wrong with it

It reads as a finding. It is an **absolute about every status role QANDEEL will ever have,
established on evidence about one of them** — and E1's own limitations document admitted the
three refusals had never been tested against a real Product surface. Check R03 asserted the
*count*, which made the cap look verified when what was verified was arithmetic.

### What replaced it

**STATUS COLOUR IS EARNED, NOT ASSIGNED BY TAXONOMY**, and **QANDEEL DOES NOT USE A GENERIC
TRAFFIC-LIGHT PALETTE** — that second part is what is frozen. ERROR currently owns the only
dedicated system-status hue. The others remain neutral until a real Product case proves
position, copy, glyph, state change, boundary and hierarchy cannot carry them. **A future
dedicated status expression requires Product evidence and is not prohibited. The count is
not a cap.**

**Every current expression is preserved.** Board `b07` is unchanged apart from its caption.

### And the audit found the route already open, twice

`E1R_PRODUCT_SURFACE_AUDIT.md` classified eight categories. **Two of the three refusals have
a real QANDEEL case that meets their own overturn condition** — ambient service degradation
for WARNING, out-of-place background completion for SUCCESS. **Neither is answered with a
hue**; both are handed to Product with the case named.

**Under E1's wording there was nowhere to put that finding except a contradiction.** That is
the practical argument for the revision, and it was not available before the audit ran.

### What proves it

- **R03**, rewritten: the roles reaching a status literal are exactly the roles the shipped
  policy declares as having earned one, and every role without one carries an overturn
  condition **and** a Product-evidence route. Its probe adds a hue by taxonomy and is
  rejected — **removing the cap must not remove the discipline.**
- **R29** — no shipped product-contract statement caps the number of hues, the policy names
  the route out, and it still forbids a traffic-light palette. Its probe restores E1's
  statement 9 into the shipped list.

### The error colour's rationale, corrected

**`#fe907e` is preserved and is Product-Owner visually approved.** What changed is the order
of the argument: acceptance rests on **Product visual judgement**, plus contrast and
accessibility evidence, plus semantic-separation evidence. The OkLCh / ΔEok / dichromacy
derivation remains as **engineering evidence about this palette on this ground** — its
perceptual floor is literally "as far apart as Living Brass already is from the reading
ramp", which is a QANDEEL-derived instrument and not an accessibility law. **E1R does not
claim mathematics proves no other valid error red could exist.**

---

## 4. THE BRASS-BEARING UNIVERSAL

### What was frozen

> **NO BRASS-BEARING OBJECT HAS A DISABLED STATE.** An identity object that must become
> unavailable is absent or empty-stated, never dimmed.
> — product-contract statement 8, supported by *"A persistent navigation destination is
> never unavailable: a destination that exists is reachable."*

### What is wrong with it

**It is a navigation and entitlement law, made by a colour package.** E1R looked for the
authority and did not find it: the canonical navigation track (Stages 0–4, frozen) settles
architecture, spatial model and visual language and says nothing about capability
availability; which authority governs navigation morphology is itself an open reconciliation
the Owner has not answered; and the Apple guidance cited is about *selection* appearances in
a tab bar, not about availability.

### What replaced it

> **LIVING BRASS IS STATE-INVARIANT IN VALUE AND IN APPEARANCE.** No interaction state and
> no availability state may dim, recolour or composite a Brass-bearing object. **E1R
> supplies no unavailable expression for one**, and does not claim the Product can never
> need one.

Two of the three obvious expressions are forbidden by the material; the third — absence, or
an empty state at the destination — is a navigation-contract decision handed up.

### And the withdrawn law was hiding a live defect

For two packages the stylesheet contained a rule repainting the navigation item's icon —
**Living Brass** — to the unavailable ink whenever the item carried the disabled state. It
never rendered, because no board ever marked a navigation item unavailable, because the law
said that could not happen. **A rule that cannot be reached is a rule nobody reads.**

The rule is removed. **R30** parses the stylesheet the proof actually serves and rejects any
rule that paints a Brass-bearing element, or applies opacity or a filter, under a state
selector — **and its probe is that exact rule, fed back in.**

---

## 5. What the revision did not touch

- **every token value**, including both literals and every alias;
- **the error expression** — field, boundary, glyph, copy, contrast, position;
- the five state expressions, the focus construction, the press response, the selection
  marker;
- the derivation, the dichromacy model, the vendored inheritance, the Arabic copy contract;
- **checks R01, R02, R04–R25** and their probes, all unchanged and all still passing.

## 6. What remains open after it

1. **§3.7 and §3.8 of the audit** — the two overturn conditions that are met. Product's.
2. **How availability is expressed around a Brass-bearing object**, if it ever must be.
   Navigation contract's.
3. **SELECTED + UNAVAILABLE on a list row that is the current destination** — what QANDEEL
   does when the world you are standing in stops being available to you. Connected Worlds'.
4. **Which availability pattern each QANDEEL control type uses.** Integration's, made once
   per control type and written down, per the APG's request for pattern-based conventions.
5. **D-E1-6** — the DISCOVERABLE pattern on a device, with a screen reader.
