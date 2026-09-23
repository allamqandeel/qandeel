# I-08B3.1-F2 — FREEZE CANDIDATE

**F2 does not declare F frozen. §36 forbids it and this package does not do it.**

What follows is the candidate: what F2 proposes be frozen, what it proposes be left tunable, and the
conditions under which the proposal should be rejected.

---

## What F2 proposes as PRODUCT CONTRACT — 16 statements

None of them is a colour. **A contract that resolved to a colour would be a contract about one
appearance.**

| token | the statement |
|---|---|
| `appearance.law` | **APPEARANCE IS A PROJECTION OF PRODUCT SEMANTICS.** It may change luminance, chroma, material rendering, edge treatment, local contrast, apparent depth, scrim strategy, atmospheric rendering, the Light's technique and surface separation. It may not change analytical truth, object existence, relationship truth, confidence, importance, ownership, authority, temporal truth, hierarchy, state meaning, world membership or available actions. |
| `appearance.chroma-order` | **ERROR > BRASS > LIGHT > ATMOSPHERE > INK > GROUND**, as a ladder of role families, in both appearances. |
| `appearance.hue-constancy` | every chromatic role holds its hue across appearances, within 3°, measured on the recovered hue of the shipped hex. |
| `appearance.hierarchy-is-a-ratio` | the reading ramp preserves its WCAG contrast ratios against its own ground. |
| `appearance.suppression-is-subtraction` | the PASSAGE scrim darkens in **both** appearances. |
| `appearance.meaning-has-a-source` | at its peak a meaning event is lighter than its ground, measurably, with the colour removed. |
| `appearance.light-not-reduced` | an alternate appearance may not cost the Product analytical quality, depth, atmosphere, colour richness, micro-detail, spatial discovery, identity or emotional impact. |
| `appearance.dark-is-frozen` | no dark value moves for light. |
| `appearance.status-colour-is-earned` | Warning, Success and Informational remain neutral in both appearances. |
| `appearance.system-appearance` | follow the system; no in-app override; platform theming does not author identity. |
| `appearance.switch.is-not-a-meaning-event` | re-project only: no replay, no restart, no state change, no reset, no new history. |
| `appearance.switch.crossfade-reduced-motion` | the cross-fade is **removed** under reduced motion, not shortened. |
| `expression.accessibility.atmosphere.stroke-alpha-multiplier` (both contexts) | the sentinel: which mechanism runs, not what colour comes out. |
| `expression.accessibility.atmosphere.pre-composite` | the opaque substitution is exact because the backdrop is one flat colour. |
| `accessibility.transparency.light-alpha-floor` | QANDEEL Light keeps its translucency under Reduce Transparency. |
| *(the reading-ramp group's classification)* | the three light rungs are a **consequence** of the ratio contract, not contracts themselves. |

## What F2 proposes be left TUNABLE — 29 production defaults

**Every colour F2 ships.** The twelve light expression literals, the computed opaque scrim, the
three atmosphere layer lightnesses, the light chroma ceiling, the three increased-contrast
lightnesses, the bloom's three shape parameters, the cross-fade duration and the Light World's
lightness.

Each names what it `serves`. **Exact calibration values do not become Product law because a
prototype used them**, and the values most likely to move on device evidence are named in
`F2_DEVICE_VALIDATION.md`.

## What F2 proposes as IMPLEMENTATION STRATEGY — 3

The two meaning-light techniques (`additive-over-ground`, `signed-bloom`) and the centralisation
mechanism. **How a contract is currently met, chosen by measured search, re-openable by a better
way.**

---

## The evidence, as a list

| | result |
|---|---|
| checks | **38/38** |
| probes rejecting | **38/38** |
| cross-appearance parity cells | **1,452**, 0 failures |
| planted object removals | **4/4**, each failing for its own object and no other |
| dark regression | **PASS** — 13 values, 28 routes, 5 states, 1 raster, 5 probes |
| the accepted dark raster | `0a8cb8e0c2ecaf2d9e228392` — **byte-identical** |
| appearance-switch prohibitions | **5/5**, probe rejected with 4,559 channels outside the segment |
| consistency claims | **7/7**, 7/7 probes rejecting, 46 authored surfaces re-read |
| skill gate | **PASS** — 6 USED with consequences, 90 files hashed |
| reference gate | **PASS** — 7 references, 5 of which changed a decision |
| boards | **12** |
| configurations searched in Part C | **104,835** |

---

## The conditions under which this candidate should be REJECTED

F2 states these rather than waiting to be told.

### Reject if the Product Owner's answer to question 4 is no

*Does Meaning Light still feel like understanding?* The light event's area mean is **0.1022** against
dark's **0.2846** — 1.005 of the light appearance's own smallest reading steps against 2.483 of the
dark one's — and almost all of it is the glaze rather than the source, a dip-to-rise ratio of
7.32 : 1. **F2 cannot answer this question and says so.** If the answer is no, Part C re-opens —
either by moving the tunable bloom parameters inside their stated bounds, or by a fifth expression
family.

**This question has already been answered NO once, and what came back is on the record.** Independent
review rejected F2's magnitude, and I-08B3.1-F2R found three separate causes, all of them measurement
errors rather than design errors: the floor was on the event's per-pixel peak rather than on its area;
the boards sampled CONNECTION at another category's peak, 1,850 ms past its own; and the floor was
evaluated at an intensity no meaning category reaches. **Anyone answering NO again should know that
the honest way to close the remaining gap was also derived, rendered and rejected** — see
`F2_KNOWN_LIMITATIONS.md` 0c — because what reaches it is darker than the World under its own passage
scrim. Re-opening Part C for magnitude alone now needs a different ground, not a different
configuration.

### Reject if the meaning-light source fails on a real display

The source clears its floor by **about 12%**, with its core near the top of sRGB. **This is the
thinnest margin in the package.** If a panel cannot hold it, the event reads as a stain and the
Light World must come down — the full sweep of 21 candidate grounds is in the record, with what each
one leaves the source.

### Reject if Living Brass reads as brown

Hue is held to 0.13° and chroma to 0.0005, and it still may not read as metal at 4.84:1 on a light
ground. The fix is **not** an appearance fix: it is giving the identity mark its own role, which is a
B-track or E-track decision.

### Do NOT reject for these, and here is why

- **That the two appearances' meaning events differ in magnitude.** They must. A light ground has
  spent the range a dark one lends. What would be a defect is the light event being *inadmissible* —
  a stain, an ink, or invisible without colour — and it is none of the three.
- **That the light World-to-Surface separation is weak.** It is I-08B3.1-B4R's frozen 1.0716:1,
  inherited with its weakness deliberately intact. Widening it would be F2 inventing hierarchy.
- **That the light atmosphere is 2% less chromatic.** That is D2R's own derivation working as it was
  built to work.

---

## What must happen before F is frozen, whatever the review decides

**These are gates, not opinions.**

1. **A real VoiceOver and TalkBack run, in both appearances.** I-08B3.1-F1's mandatory
   implementation / integration validation gate. **Browser accessibility-tree evidence does not
   satisfy it.**
2. **Device validation of the light appearance** — glare, the meaning-light source, Living Brass,
   Error, and banding in the bloom on a weaker panel.
3. **`android:configChanges="uiMode"` and a device test that Product state survives a real system
   appearance change.** The platform's default behaviour recreates the Activity, which is what §16
   forbids.
4. **The exhaustive accessibility mapping against the real canonical V schema** — I-08B3.1-F1R2's
   recorded implementation dependency, still open.

---

## And the one thing that is not a condition

**The North Star spectacle is OPEN, NOT PROVEN BY F1, NOT WEAKENED BY F1, OWNED BY G.** F2 preserves
that wording exactly, gathered no spectacle evidence, and makes no spectacle claim. Four risks that
could make G's work harder are recorded in `F2_NORTH_STAR_CARRY_FORWARD.md`; **none of them closes
the door**, and one of them — the size of the light appearance's meaning event — is explicitly
re-openable by G within stated bounds.

---

**I-08B3.1-F2 IS A REVIEW CANDIDATE. NOTHING IN IT IS FROZEN. WHETHER I-08B3.1-F MAY PROCEED TO
CLOSED / FROZEN IS FOR THE PRODUCT OWNER AND INDEPENDENT REVIEW, AND F2 DOES NOT DECIDE IT.**
