# I-08B3.1-F2 — LIGHT APPEARANCE + CROSS-APPEARANCE INTEGRATION

**REVIEW CANDIDATE. NOTHING HERE IS FROZEN. F IS NOT DECLARED CLOSED BY THIS PACKAGE.**

I-08B3.1-F1 is treated as CLOSED / FROZEN per the F2 brief, and this package does not reopen it.
Whether **I-08B3.1-F — ACCESSIBILITY + ALTERNATE EXPRESSIONS** may proceed to CLOSED / FROZEN is a
decision for the Product Owner and independent review, and F2 does not make it.

---

## The claim, in one sentence

> **APPEARANCE CHANGES THE LUMINANCE ENVIRONMENT. IT DOES NOT CHANGE THE CHROMA ORDER.**

Measured on the frozen dark system, QANDEEL's twelve appearance literals fall into a ladder that is
not a style — it is the Product's semantics written in chroma:

| band | chroma in DARK | chroma in LIGHT |
|---|---|---|
| **ERROR** — the one status colour | 0.1364 | 0.1370 |
| **LIVING BRASS** — identity material | 0.0516 | 0.0511 |
| **QANDEEL LIGHT** — meaning | 0.0317 – 0.0462 | 0.0311 – 0.0316 |
| **ATMOSPHERE** — the world's field | 0.0197 | 0.0193 |
| **INK** — reading | 0.0081 – 0.0153 | 0.0078 – 0.0145 |
| **GROUND** — World and Surface | 0.0000 | 0.0041 – 0.0042 |

**Nobody wrote that ladder down.** I-08B3.1-A, C3, D2R and E1 each chose their own value for their
own reason and this is what fell out — which is why it is a genuine invariant rather than a rule
imposed afterwards, and why F2 adopts it as *the* cross-appearance identity mechanism.

## The three things a reviewer should check first

1. **Did DARK move?** No. `docs/F2_DARK_REGRESSION.md`. The gate re-runs **I-08B3.1-F1's own
   resolver over F1's own token files** and re-renders **F1's own scene with F1's own builder**,
   and requires the raster to be byte-identical to the accepted one — sha256 `0a8cb8e0c2ecaf2d…`,
   the value F1, F1R and F1R2 all shipped. F2's code is not in that path at all.
2. **Is this an inversion?** No, and it is measured rather than asserted. A per-channel inversion
   rotates **every** chromatic role in this system to the opposite side of the wheel — a mean of
   **178.7°**. Living Brass 75° → 256° (**blue**). Error 30° → 214° (**teal**). The reading ramp
   94° → 273° (**blue-violet**). An inversion does not produce different values; it produces a
   different Product. Board J, check **X-06**.
3. **Did the light appearance change any analytical truth?** No.
   `docs/F2_CROSS_APPEARANCE_MAP.md`. **1,452 cells**, read back out of **rendered documents** in
   both appearances under all eleven I-08B3.1-F1 accessibility expressions, with **four planted
   removals** that must each fail the matrix for their own object and for nothing else.

## What F2 actually had to build, and how little of it is new

The architecture was already there, and finding that out is half of the token work. I-08B3.1-B4R
separated the SEMANTIC layer from the EXPRESSION layer before a light appearance was on anyone's
list — *"it names what things ARE, never what they look like"* — and **three of the inherited
resolvers already carry an `appearance` modifier whose `light` context is a deliberately empty set
with an owner named on it.** F2 fills those contexts.

**Resolve the frozen chain and count the literals an appearance owns: there are twelve.** World,
Surface, three reading inks, the scrim, Living Brass, three Light stops, Error, Disabled.
Everything else in the system — every Product Surface role, every interaction state, every status
ink, the identity mark, the navigation machinery, the analysis node and relation — is an **alias**.

That is why a second appearance is **twelve derivations rather than a second design system**, and
why cross-appearance semantic parity is *structural* rather than maintained: the roles cannot
diverge, because there is only one set of them. Check **P-02** walks every alias chain in both
appearances and requires the two route sets to be character-for-character identical.

## The hardest problem, and the number that settled it

§8 of the brief predicted in words that *"make it brighter may fail completely"* on a light ground.
The derivation turns that into a measurement: **the dark appearance's own additive technique,
composited over the light World, reaches dEok 0.0395 at its peak against the dark appearance's
0.6925.** Four expression families were built and **104,835 configurations searched**, and three
failed for three different reasons the brief also predicted:

| family | why it failed |
|---|---|
| **ADDITIVE** — the dark technique unchanged | cannot produce a source on a ground this light |
| **DARKENING** — every insight gets deeper | has no source at all; it is a stain, not a light |
| **CHROMATIC** — spend everything on colour | **dEok 0.0000 once the colour is removed** |
| **SIGNED BLOOM** — the core floods, a narrow warm glaze surrounds it | **admissible** |

The chromatic family is the obvious answer to "how do you show light on a light ground", and the
requirement that kills it is WCAG SC 1.4.1 — colour is not the only visual means. It was excluded
by arithmetic rather than by preference.

## Where to start

| you want | read |
|---|---|
| **what I-08B3.1-F2R changed and why** | `docs/F2R_REVISION.md` |
| **verification from a clean extraction** | `docs/F2R_CLEAN_EXTRACTION.md` |
| the argument | `docs/F2_DESIGN_RATIONALE.md` |
| how every light value was derived | `docs/F2_LIGHT_DERIVATION.md` |
| the role pairs and the parity proof | `docs/F2_CROSS_APPEARANCE_MAP.md` |
| that dark did not move | `docs/F2_DARK_REGRESSION.md` |
| F1's transformations re-run in light | `docs/F2_ACCESSIBILITY_UNDER_LIGHT.md` |
| what happens when the appearance changes | `docs/F2_APPEARANCE_SWITCH.md` |
| the tokens and the freeze boundary | `docs/F2_TOKEN_ARCHITECTURE.md` |
| how it is built in React Native | `docs/F2_IMPLEMENTATION.md` |
| **what is open, and what F2 could not do** | `docs/F2_KNOWN_LIMITATIONS.md` |
| **the contradictions found** | `docs/F2_CONTRADICTIONS.md` |
| the boards | `docs/F2_REVIEW_BOARD.md`, then `review/board/` |
| what the Product Owner should judge | `docs/F2_PRODUCT_OWNER_REVIEW.md` |
| the gates | `docs/F2_SKILL_GATE.md`, `docs/F2_REFERENCE_GATE.md` |
| every check | `docs/F2_VALIDATION_RESULTS.md` |

## What F2 does NOT do

- **It does not declare F frozen.** `docs/F2_FREEZE_CANDIDATE.md` states the candidate and the
  conditions; the decision is not F2's.
- **It does not close the North Star.** F1 froze that requirement as **OPEN, NOT PROVEN BY F1, NOT
  WEAKENED BY F1, OWNED BY G**, and F2 preserves that wording exactly.
  `docs/F2_NORTH_STAR_CARRY_FORWARD.md`.
- **It does not add an in-app appearance toggle.** Apple advises against one and §17 forbids
  inventing one here. `Appearance.setColorScheme` exists and is deliberately not used.
- **It does not add a status colour.** Warning, Success and Informational stay neutral in both
  appearances. Check **E-03**.
- **It does not validate on a device.** No iPhone, no Android, no photometer, no VoiceOver, no
  TalkBack. `docs/F2_DEVICE_VALIDATION.md` says so plainly and names what that leaves open.

## Running it

Every tool runs from a bare extraction with Node and headless Chrome. In order:

```
node tools/f2-vendor.mjs        # re-verify the vendored inputs     -> data/F2_VENDOR.json
node tools/f2-derive.mjs        # THE DERIVATION                    -> data/F2_DERIVATION.json
node tools/f2-tokens.mjs        # tokens vs the derivation          (--write to sync)
node tools/f2-skills.mjs        # the skill gate                    -> data/F2_SKILLS.json
node tools/f2-references.mjs    # the reference gate                -> data/F2_REFERENCES.json
node tools/f2-regression.mjs    # THE DARK-REGRESSION GATE          -> data/F2_DARK_REGRESSION.json
node tools/f2-parity.mjs        # the cross-appearance matrix       -> data/F2_PARITY.json
node tools/f2-switch.mjs        # the appearance-switch contract    -> data/F2_SWITCH.json
node tools/f2-boards.mjs        # the twelve boards                 -> review/board/
node tools/f2-verify.mjs        # all 33 checks and 33 probes       -> data/F2_VALIDATION.json
node tools/f2-consistency.mjs   # every shipped surface, re-read
node tools/f2-docs.mjs          # the generated documents + manifest
```

## Result

**38/38 checks. 38/38 probes rejecting. 1,452 parity cells, 0 failures. 12 boards.**

Every guard is fed an input that must make it fail, because **a check that cannot fail is a
sentence**. Three defects in F2's own checks were found that way and each is recorded on the check
it belongs to — including one where the probe's refusal to reject revealed that the check was
comparing two copies of the same alias string and could never have failed.

**I-08B3.1-F2R added five checks and one of them exists because looking at a render disagreed with
every number.** `C-07` and `C-08` measure the meaning event as a region and test that it vanishes by
shape rather than by a special case; `K-04` binds each delegated record to the token tree by content
so the binding survives archiving; `C-09` forbids a meaning event from being darker than the World
under its own passage scrim; `C-10` measures at scene scale what `R-FOOTPRINT` measures per source.
See `docs/F2R_REVISION.md`.

## Inheritance

```
I-08B3.0      visual foundation     FROZEN
I-08B3.1-B4R  Surface               FROZEN
I-08B3.1-C3   Living Brass          FROZEN
I-08B3.1-D2R  QANDEEL Light         CLOSED / FROZEN
I-08B3.1-E1R  interaction + status  CLOSED / FROZEN
I-08B3.1-F1   accessibility         CLOSED / FROZEN   (F1R2 is the governing state)
I-08B3.1-F2   Light Appearance      REVIEW CANDIDATE  ← this package
I-08B3.1-G    integrated spectacle  NOT STARTED — owns the North Star
```

Every inherited file is vendored **byte-exact** with the sha256 of the package it came from, and
`tools/f2-resolve.mjs` re-checks both ends. A directory name is not provenance.
