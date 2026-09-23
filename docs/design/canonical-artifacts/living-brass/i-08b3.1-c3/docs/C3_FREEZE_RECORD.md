# C3_FREEZE_RECORD

**I-08B3.1-C3.13.** What C3 proposes for the I-08B3.1-C freeze, what it explicitly does not freeze,
and what the Design Director is being asked to decide.

> **STATUS: NOT YET FROZEN.**
>
> C3 proposes. The Design Director freezes. Nothing in this package is canonical, and `#A58E6F`
> remains *"sole value eligible for C-stage production freeze"* until that decision is made.

---

## 1. PROPOSED FOR FREEZE

| | Proposed | Evidence |
|---|---|---|
| **LIVING BRASS DARK BODY** | `#A58E6F` | C0R → C1 → C1R → C2; Director-selected. Re-measured in C3: in gamut, unclipped, L 0.6595 / C 0.0516 / H 74.95°, 6.070:1 on the World, 5.664:1 on the Surface |
| **MATERIAL** | QUIET SATIN — one flat tone at ordinary and small scale | `C3_CANONICAL_LIVING_BRASS_SPEC.md` §2 |
| **LARGE IDENTITY EXPRESSION** | restrained BRUSHED / HANDLED character permitted, at a rare identity moment only | measured at 15 widths and 4 dpr conditions; subtractive-only holds at every one |
| **COVERAGE** | **P2 — IDENTITY MACHINERY FAMILY** | Director-selected at the close of C2 |
| **PERSISTENT NAVIGATION** | Living Brass material permitted / expected, **as one family** | reproduced byte-identically from the token graph |
| **STATE** | the material is **state-invariant** | 8 compositions, 4 environments × 4 states, **exactly 2109 chromatic pixels each** |
| **MAP** | no Brass analytical encoding | `qandeel.analysis.*` → frozen neutrals; invariant I-06 |
| **STATUS** | no Brass status meaning | `qandeel.status` reserved and empty; invariant I-05 |
| **LUXURY** | application-discipline contract | `C3_LUXURY_BOUNDARY.md` |
| **SCALE** | **PERMISSION, NOT SIZE** | the one reclassification C3 makes — see §3 |

### 1.1 Supporting the proposal

- **21/21 invariants hold, and all 21 negative probes fired.**
- **DTCG 2025.10 conformance: all four token files CONFORM**, validated against the official schemas
  vendored with their provenance record.
- **9/9 accepted compositions rebuilt byte-identically from the token graph** — four environments,
  four interaction states, and the large identity moment with its character.
- **Every inherited file is byte-identical to the sealed package it came from**, verified against
  I-08B3.1-C2, I-08B3.1-B4R and I-08B2.5.
- **No font binary ships.**

---

## 2. EXPLICITLY NOT FROZEN

| | Owner |
|---|---|
| QANDEEL Light | **D** |
| Light-appearance Brass | **F**, informed by D |
| Increased-contrast expression | **F** |
| Final accessibility transformations | **F** |
| Final selected-tab design | Product/UI integration |
| Tab geometry, tab container form, tab depth | Product/UI integration |
| Tab motion, transitions, active indicator, label behaviour | Product/UI integration |
| Final icon geometry | Product/UI integration |
| Interaction colours | **E** |
| Status colours | **E** |
| Focus expression | **E** |
| Disabled expression | **E** |
| Lantern animation | later |
| Q-thread expression | later |

**A future tab system must be free to become visually distinctive.** C3 has frozen what the navigation
icons are *made of* and nothing about what they *are*. It has not reduced the tab bar to "gold icons
on a black bar", and `C3_EXPRESSIVE_HEADROOM_CONTRACT.md` §3.1 states that boundary as a contract
rather than an assurance.

---

## 3. The one reclassification the Director is asked to accept

| | before | proposed |
|---|---|---|
| the rule keeping the character off ordinary marks | `GRAIN_MIN_PX = 96` — a size threshold | **`permission-not-size`** — entitlement by permission class |
| `96 px` | the rule | `character.scale.proofEraConstant` — **recorded, not frozen** |

**Why.** The brief permits freezing a numeric threshold only if evidence supports a stable one. C1R
and C2 used 96 and **neither ever measured at it.** C3 measured the character at fifteen widths and
found it delivers **82–93 % of its accepted amplitude at every one, navigation size included.** There
is no knee. Freezing 96 would have stated a design decision in the grammar of physics.

**What it changes in the accepted evidence: nothing.** All nine compositions rebuilt with the
permission rule in place of the size rule came back byte-identical.

**What it changes in the contract: the burden.** Under a size rule, ordinary marks are safe
automatically. Under a permission rule, they are safe because someone decided. **The character works
at 24 px; nothing physical stops anyone putting it on the navigation family, and it would look good.**
That is stated in the specification rather than buried, because a rule whose enforcement is purely
social needs to be known to be one.

---

## 4. OPEN — carried into the freeze, not resolved by it

### 4.1 The persistent canonical Q

Current Apple guidance: *"Resist the temptation to display your logo throughout your app or game
unless it's essential for providing context."*

The Q stands on every screen. C2 flagged that this is true under **both** coverage policies, so
choosing between them could not resolve it. **C3 cannot resolve it either**: it is a PLACEMENT
question and `qandeel.identity.mark` grants MATERIAL. Owned by Product/UI integration.

### 4.2 The disabled-ink collision

The disabled neutral sits close enough to the rest-state ink to be argued with, and the collision
worsens as the body gets stronger. `#A58E6F` is the strongest body tested. Recorded by C1R, deferred
by instruction in C2, deferred again here. **A dependency for E.**

### 4.3 The character cannot be shipped by transcribing its filter chain

`feTurbulence` is not supported in `react-native-svg`, and unsupported filters warn rather than fail —
so the native failure mode is a mark **without** its character, silently. Routes that can carry it are
named in `C3_REACT_NATIVE_MAPPING.md` §4; **choosing one is integration's decision on integration's
evidence**, and it is a real cost attached to the large identity moment that did not exist when the
moment was accepted.

### 4.4 The Life Test currently returns INCOMPLETE

Measured on the accepted compositions: roughly **93–97.5 % of QANDEEL's ink is achromatic**, and the
material occupies 2.51–6.64 % of ink depending on environment.

**This is not a deficiency in the material and not a reason to change it** — every move in that
direction is forbidden, and each is forbidden for a reason already proved. It is a measurement of how
much of the Product's visual identity is still owed by systems that do not exist yet.

**The C track can close on the material with this result standing. It should not be read as closing
on the Product.** `C3_VISUAL_VITALITY_DIRECTIVE.md` §4 states it in full.

### 4.5 An icon-consistency obligation passed to integration

Platform guidance requires all interface icons to share size, level of detail, stroke thickness and
perspective. **The C1/C2 proof harness does not satisfy it** — navigation strokes are 1.75 at 24 px,
functional strokes 1.6 at 20 px, different ratios. That is a property of a proof harness and C3
freezes no icon geometry, but the obligation is recorded so it is not lost between a stage that could
not act on it and a stage that will not think to look.

---

## 5. STOP CONDITIONS — none was met

The brief listed ten. Each is recorded with what was actually found.

| Stop condition | Result |
|---|---|
| `#A58E6F` cannot support the production P2 mapping | **NOT MET.** It supports it exactly: 9/9 compositions byte-identical from the token graph |
| P2 requires Brass to encode selected state | **NOT MET.** State invariance holds, and the token system has no state sibling to reach for |
| a second Brass body becomes necessary | **NOT MET.** One literal. Invariants I-01, I-09, I-10 and I-12 make a second one unbuildable, not merely unused |
| interaction or status semantics need to move into C | **NOT MET.** Both namespaces reserved, empty, owned by E |
| analytical Map truth needs reopening | **NOT MET.** The analytical plane is neutral and unchanged |
| final tab design must be invented to complete the material contract | **NOT MET.** The contract grants material; it needed no form |
| QANDEEL Light must be designed | **NOT MET.** Reserved namespace, empty |
| a Light Brass value must be invented | **NOT MET.** None exists; light resolution fails loudly and names what is missing |
| the production spec necessarily makes QANDEEL more timid than the accepted C2 evidence | **NOT MET — and checked rather than asserted.** C3.12 reproduces the accepted compositions **byte-identically**. The Product is exactly as expressive after this specification as the evidence the Director accepted. §4.4's INCOMPLETE is a statement about systems not yet built, not a reduction made here |
| the Skill Gate or Reference Gate cannot be verified | **NOT MET.** Both verified; 89 skills walked from disk, 6 USED with hashes, 7 sources with 6 supporting quotations and 6 recorded departures |

---

## 6. What the Design Director is being asked

1. **Freeze, or do not freeze, the ten items in §1.**
2. **Accept or reject the one reclassification in §3** — `permission-not-size` in place of a 96 px
   threshold, on the evidence that the threshold was never a capability limit.
3. **Note §4.4.** The C track closing on the material is not the Product passing the Life Test, and
   C3 recommends that the two not be conflated in whatever closure statement follows.
4. **Note §4.3.** The large identity moment carries an implementation cost that was not visible when
   it was accepted.

The five open items in §4 are handed forward with named owners. None of them blocks a freeze of the
material; all of them would be lost if the freeze were read as closing them.
