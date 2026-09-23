# C3_README

**I-08B3.1-C3 — LIVING BRASS: PRODUCTION SPECIFICATION + EXPRESSIVE CAPACITY + FREEZE.**

**STATUS: PRODUCTION SPECIFICATION COMPLETE. READY FOR FINAL DESIGN DIRECTOR C FREEZE REVIEW.
NOT YET FROZEN.**

C3 has two responsibilities and they pull in different directions on purpose. The first is to turn
the accepted Living Brass direction into a production-ready material system. The second is to make
sure that system does not accidentally freeze QANDEEL into a visually timid product. A specification
stage is exactly where that second failure happens, because every rule it writes is a rule about what
must *not* be done.

---

## 1. What entered C3, and what C3 was not allowed to touch

C0 and C1 are closed. **C2 is closed and accepted by the Design Director**, who selected:

| | |
|---|---|
| **Living Brass body** | `#A58E6F` — sole value eligible for C-stage production freeze |
| **Material at ordinary / small scale** | QUIET SATIN |
| **Material at a large identity moment** | the SAME body may carry restrained BRUSHED / HANDLED character |
| **Coverage policy** | **P2 — IDENTITY MACHINERY FAMILY** |
| Retired | D-2 FORMED · BODY A `#857867` · BODY B `#95836c` |

C3 did not reopen colour exploration, redesign a screen, or begin QANDEEL Light. It resolved no
question C2 left to the Director, and it created no new visual comparison.

**Nothing in this package is canonical.** `#A58E6F` is *eligible for freeze*; the Design Director
freezes.

---

## 2. What C3 found

Four things, none of them anticipated by the brief.

### 2.1 The character's scale threshold is not a threshold

C1R and C2 both used `GRAIN_MIN_PX = 96` and both were right to — it kept the brushed/handled
character off every ordinary mark. But **neither stage ever measured at 96.** C3 measured the
character at fifteen rendered widths, isolating it from antialiasing by rendering identical geometry
with and without it.

**It delivers 82–93 % of its accepted amplitude at every width from 24 px to 420 px.** There is no
knee. The size rule was never a capability limit; it was a restraint expressed as a number.

So C3 freezes the **principle** — the character belongs to the rare identity moment, by permission —
and records 96 px as a proof-era constant rather than a production threshold, which is precisely the
fallback the brief describes. The consequence is uncomfortable and is written into the contract
rather than buried: **because the character works at navigation size, nothing physical stops anyone
putting it there, and it would look good.** Only the permission stops it.

### 2.2 The obvious way to derive the character tone produces a colour nobody approved

The darker tone is one lightness step below the body. Derive it from the body's **authored** OkLCh
triple and you get `#967f60`, the tone every accepted C1R and C2 raster was made with. Derive it from
the **8-bit sRGB value the token actually paints with** — the obvious choice — and you get `#957f60`,
one step darker in red, because quantising to 8 bits costs 0.00047 of lightness and the subtraction
carries that loss forward.

No colour test would catch it: both values are plausible Brass. The specification therefore names its
derivation source explicitly, and invariant **I-21** asserts *both* halves — that the specified route
reproduces the accepted tone, and that the obvious one does not.

### 2.3 The accepted character cannot be shipped by transcribing its filter chain

The character is built from `feTurbulence` + `feColorMatrix` + `feFlood` + `feComposite`. Three of
those four are implemented in `react-native-svg`. **`FeTurbulence` is listed in the library's own
documentation under "Not supported yet"**, and unsupported filters warn rather than fail — so the
failure mode on native is a silent downgrade to a mark without its character, at the one composition
where the material is allowed to have any.

`C3_REACT_NATIVE_MAPPING.md` §4 names the routes that can carry it.

### 2.4 The material's footprint does not move — at all

Measured off C3's own reproduction rasters, the four environments and four interaction states contain
**exactly the same number of chromatic pixels: 2109.** Not similar. Identical. The share of ink
varies only because the amount of neutral ink varies.

That is an independent confirmation of state invariance, arrived at from the raster rather than from
the markup guard designed to prove it — and an independent confirmation of C2's environment ordering
on a different instrument: Utility concentrates the material most (6.64 % of ink), Reading dilutes it
most (2.51 %).

---

## 3. What C3 built

**The token architecture extends the frozen I-08B3.1-B4R Surface system rather than standing beside
it.** That is the most consequential architectural decision in the package. A Living Brass token file
alongside B4R would have been a second architecture with its own conventions and its own idea of what
"dark" means, and the first time the two disagreed the disagreement would have been invisible, because
nothing would have been resolving them together.

So C3's resolver names B4R's sets and C3's sets in one resolution order; the B4R files are vendored
**exact-byte** and verified against the sealed package; and Living Brass and the frozen neutrals come
out of **one resolution**.

```
qandeel.navigation.machinery → qandeel.identity.material → qandeel.expression.material.living-brass.body
qandeel.control.functional   → qandeel.content.tertiary  → qandeel.expression.content.tertiary
```

One literal. Everything else is an alias.

---

## 4. The evidence, and what each layer needs to run

| Layer | What it checks | Needs | Result |
|---|---|---|---|
| **A** | 21 invariants, each with a negative probe | nothing — pure Node | **21/21 hold and all 21 probes fired** |
| **B** | DTCG 2025.10 schema conformance | `ajv` | **CONFORMS** |
| **C** | the character scale sweep | headless Chrome | **NOT_A_CAPABILITY_THRESHOLD** |
| **D** | the accepted compositions rebuilt from tokens | Chrome + local font + sealed C2 | **9/9 byte-identical** |

Nothing in layer A depends on B, C or D. The claims that matter most — one body, no ladder, no state
alias, no invented Light — are the ones that survive the barest environment.

**An invariant here is a pair, not a function that returns true.** `check` must pass on the real
package; `probe` returns a deliberately corrupted package on which `check` must *fail*. A green row
means two things were observed, not one.

---

## 5. Reading order

| | |
|---|---|
| `C3_CANONICAL_LIVING_BRASS_SPEC.md` | the material itself: body, satin, character, scale |
| `C3_TOKEN_ARCHITECTURE.md` | the token graph, and why it extends B4R |
| `C3_ICONOGRAPHY_MATERIAL_CONTRACT.md` | who may be made of it, with counterexamples |
| `C3_INVARIANTS.md` | the 21 machine-testable rules and their probes |
| `C3_VALIDATION_RESULTS.md` | **generated** — every figure, none typed by hand |
| `C3_PROOF_TO_PRODUCTION_MAP.md` | what is canonical, what is proof-only, what belongs to D/E/F |
| `C3_REACT_NATIVE_MAPPING.md` | consumption; specifies, builds nothing |
| `C3_VISUAL_VITALITY_DIRECTIVE.md` | the Product Owner directive, and the Life Test |
| `C3_EXPRESSIVE_HEADROOM_CONTRACT.md` | what later stages remain authorised to do |
| `C3_ANTI_MINIMALISM_MISREAD.md` | the frozen rules that will be misquoted, and the correction |
| `C3_LUXURY_BOUNDARY.md` | application discipline, not a weaker material |
| `C3_SKILL_GATE.md` · `C3_REFERENCE_GATE.md` | **generated** |
| `C3_FREEZE_RECORD.md` | what is proposed for freeze, and what is explicitly not |
| `C3_MANIFEST.md` | **generated** — every file, hashed |

---

## 6. The two things most likely to be misread

**"P2" does not mean "every icon gold."** It means one persistent, QANDEEL-owned navigation family
carries one material as one family. Ordinary functional controls — send, add, back, close, overflow,
edit, settings actions, checkboxes, radios — stay neutral by default and require an independent
identity-material permission argued on the record. That boundary is the difference between a material
identity and a generic accent system, and invariant **I-15** guards it with a probe.

**Restraint is not the same as timidity.** The Product Owner directive is authoritative and C3 records
it as such: QANDEEL must not become grey and white, or technically excellent and visually lifeless.
`C3_VISUAL_VITALITY_DIRECTIVE.md` puts the Life Test and answers it honestly for the current state of
the Product — and the honest answer is that **Living Brass alone does not satisfy the directive**,
which is a statement about how much work is left for later systems, not a reason to change the
material.

---

## 7. Provenance

Everything inherited is vendored byte-identical and verified against its sealed source by invariant
**I-17**: the C2 tools and the canonical mark, the B4R resolver and token sets, and the DTCG 2025.10
schemas with their provenance record.

**No font binary ships.** The Arabic face is a local runtime dependency — referenced, hashed before
use, never redistributed. Invariant **I-18** scans the whole package for one.
