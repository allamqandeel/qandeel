# I-08B3.1-A3R — REVISION RECORD

**CANONICAL-STATE CORRECTION COMPLETE / READY FOR FINAL DESIGN DIRECTOR FREEZE REVIEW / NOT FROZEN**

A3's visual and perceptual evidence **passed** independent review. One canonical-state
documentation contradiction had to be corrected before formal closure. This revision corrects it
and records the Design Director's post-review decisions.

**Summary: no raster changed. No measurement changed. No colour value changed. No new evidence
was produced and no new Product exploration was performed.** The original A3 package and archive
are untouched at `I-08B3.1-A3-WORLD-READING-NEUTRAL-CLOSURE-PROOF/` and `.zip`.

---

## What was NOT touched

Nothing in A3's execution was redone. Unchanged in every respect: all 22 rasters; the reading
boards; the blind board; the hierarchy board; the headroom board; the metadata boards; the eight
product environments; both mobile robustness renders; the three failure and control captures;
`A3_MEASUREMENTS.csv`; every colour value — World, Secondary, Tertiary, control, P1 and P2; the
frozen typography contract; the geometry; the fairness implementation and its proof; the Skill
Gate's inventory, statuses and per-skill effects; the Reference Gate's sources, quotations and
principles; the preflight; and the tooling that produces all of it.

No board was re-rendered. No colour was generated. No theme was designed. No thesis, finalist or
candidate was added, removed or altered.

---

## A3R-REV-01 — DARK-LED ≠ PERMANENTLY DARK

### Previous claim

Two A3 documents described the Product's canonical state as:

> "**QANDEEL is a permanently dark product** with entirely custom colours…"

It appeared once in `docs/A3_REFERENCE_GATE.md` (principle 8) and once in `docs/A3_FAILURES.md`
(§1.1), in both cases as the premise for why Apple's Dark Mode 7:1 guidance applies to QANDEEL's
reading values.

### Why it is wrong

**This is not canonical QANDEEL state.** The frozen Visual Constitution states **DARK-LED, NOT
DARK-LOCKED**. QANDEEL must therefore not be described as permanently dark, as dark-only by
Product definition, or as structurally incapable of another theme or expression. The current
B3.1 work is establishing QANDEEL's canonical **dark visual expression**, while the architecture
remains **theme-capable**.

### Corrected claim

> **QANDEEL's current canonical visual expression is dark-led, and this A3 proof evaluates custom
> foreground/background colours in that dark expression.**

Both locations now carry that wording, state the Visual Constitution's **DARK-LED, NOT
DARK-LOCKED** position explicitly, and are marked as corrected at A3R with a pointer to this
record.

### The Apple conclusion is preserved, unchanged

Apple's Dark Mode guidance states that custom foreground and background colours should strive for
a contrast ratio of **7:1, especially in small text**. That guidance is relevant here because the
colours under test are custom foreground and background colours **in a dark expression**, which
is exactly the case it addresses. **Its relevance never depended on claiming QANDEEL is
permanently dark**, and the measured result is untouched:

| Role | hex | vs World `#101010` | vs Diagnostic Subtle `#181818` | WCAG 4.5:1 | Apple dark 7:1 |
|---|---|---|---|---|---|
| Control Primary | `#e1ded3` | 14.127:1 | 13.182:1 | pass | meets |
| **P1** Primary | `#d8d5ca` | 12.948:1 | 12.083:1 | pass | meets |
| P2 Primary | `#d2cfc4` | 12.198:1 | 11.383:1 | pass | meets |
| Secondary | `#afaca3` | 8.384:1 | 7.823:1 | pass | meets |
| Tertiary | `#8b8982` | 5.435:1 | 5.072:1 | pass | **below** |

### Affected files

| File | Change |
|---|---|
| `docs/A3_REFERENCE_GATE.md` | Principle 8, "Effect on A3" — the premise sentence replaced with the corrected canonical-state wording, plus an explicit DARK-LED / NOT DARK-LOCKED statement |
| `docs/A3_FAILURES.md` | §1.1 "The failure" — same correction, same explicit statement |

**Scanned, and clean:** the phrases *permanently dark*, *dark-only*, *dark-locked* and *dark
product* were searched across every file in the package. They occurred **only** in those two
locations, and occur nowhere now except inside the quoted withdrawn claim in this record.
`docs/A3_METHOD.md` lists "a light theme, a high-contrast theme" among the things A3 does not
design — that is a statement of A3's scope, not of the Product's capability, and is consistent
with dark-led. It was left unchanged.

### Raster changed

**No.** The phrase never appeared in any board caption — it lived only in two prose documents.
No board was re-rendered and none needed to be.

---

## Design Director decisions — recorded, not reinterpreted

These are the Design Director's Product/Design decisions taken **after** independent visual
review of A3. **They are not results produced by A3, and nothing in A3's evidence has been
reinterpreted to make them look like results.** A3 stated a trade-off and declined to choose; the
choice below was made by the Director.

### 1. World Base — SELECTED

**`#101010`.** A3 preserved this value as the sole incumbent, did not search for an alternative,
did not micro-adjust it, and found no contradiction under it across all four environments, both
finalists, both raster conditions and all three captures. A3 recorded it as *preserved, not
confirmed*; the Director has now selected it.

### 2. Primary Reading Neutral — SELECTED

**P1 `#d8d5ca`.** **P2 `#d2cfc4` is retired as the Primary finalist.**

The Director's stated reason boundary:

> P1 preserves stronger Primary→Secondary hierarchy while already creating materially more
> luminous headroom than A1.

**This is not a numeric winner produced by A3.** A3's evidence was that both finalists were
viable, that no contrast ratio could separate them, and that the trade-off was real: P1 keeps the
larger Primary→Secondary step (ΔL 0.1280 against P2's 0.1095) while opening 28 % more headroom
above the reading than A1 (0.1277 against A1's 0.1001); P2 opened more headroom still (0.1462).
A3 declined to choose between them and still does. The selection above is the Director's.

### 3. Secondary — REMAINS SELECTED

**`#afaca3`**, unchanged. It was not under test at A3 and did not move.

### 4. Tertiary Neutral — REMAINS IN THE NEUTRAL SYSTEM, application rule DEFERRED

**`#8b8982`** remains in the neutral system, unchanged.

**A3R does not declare that every 12/20 Metadata instance canonically uses Tertiary**, and A3
never did. A3's use of the Tertiary for Metadata in these proofs is a **proof usage**, not an
application rule.

What A3 established about it stands unchanged:

- it **passes** the 4.5:1 minimum on both tested surfaces (5.435:1 and 5.072:1);
- it remains **below** Apple's 7:1 custom-colour Dark Mode target on both tested surfaces;
- that matters especially because **small text is the use Apple calls out**, and the Metadata
  role is the small text.

The Director has routed the open item rather than closing it here:

- the exact **semantic / application rule** for when small Metadata uses Secondary versus
  Tertiary belongs to **I-08B3.1-B — SURFACE / CONTENT HIERARCHY REFINEMENT**;
- **accessibility-expression behaviour** belongs later to **B3.1-F**.

**In A3R: the Tertiary was not brightened, no new Tertiary was created, and no further colour
candidate was created.**

### 5. Metadata weight evidence — PRESERVED

The A3 finding stands, unchanged:

> **12/20/500 performs materially better than 12/20/400 under the tested dark raster conditions,
> and 500 is already within the frozen typography contract.**

Evidenced by `review/METADATA_MAGNIFIED.png` (4× nearest-neighbour from the pixels Chrome drew),
`review/METADATA_TRUE_SIZE.png`, `review/ROBUSTNESS_METADATA_4X.png` (both raster conditions) and
`review/failures/FAILURE_METADATA_400_IN_PRODUCT.png`.

**The frozen typography contract was not modified.** Weight 500 sits inside the existing
12/20/400–500 role; no size, leading or tracking moved, and Estedad v8.5 was not reopened.

---

## Verification

### Rasters — 0 of 22 changed

Every PNG was hashed **before any A3R edit** and again after the package was rebuilt.
**All 22 are byte-identical**, and all 22 also match the original A3 submission.

| File | SHA-256 prefix |
|---|---|
| `review/BLIND_READING_X_Y.png` | `32F36FBD…` |
| `review/ENV_P1_1_QUIET.png` | `8BFD47A1…` |
| `review/ENV_P1_2_MAP.png` | `642750A1…` |
| `review/ENV_P1_3_DEEP.png` | `CEA007E2…` |
| `review/ENV_P1_4_UTIL.png` | `446B1EE6…` |
| `review/ENV_P2_1_QUIET.png` | `2ACBC446…` |
| `review/ENV_P2_2_MAP.png` | `80870EDD…` |
| `review/ENV_P2_3_DEEP.png` | `D0AFA389…` |
| `review/ENV_P2_4_UTIL.png` | `7FE8C128…` |
| `review/HEADROOM_P1_P2.png` | `B67DF1D6…` |
| `review/HIERARCHY_RAMP.png` | `A5359F2E…` |
| `review/METADATA_MAGNIFIED.png` | `14CE8D89…` |
| `review/METADATA_TRUE_SIZE.png` | `115E6F72…` |
| `review/READING_01_ROLE_MATRIX.png` | `45A8B6D0…` |
| `review/READING_02_LONG_FORM.png` | `1CD59F2A…` |
| `review/ROBUSTNESS_METADATA_4X.png` | `3130097B…` |
| `review/ROBUSTNESS_MOBILE_P1.png` | `B9E4E1EC…` |
| `review/ROBUSTNESS_MOBILE_P2.png` | `815F730E…` |
| `review/ROBUSTNESS_MOBILE_PAIR.png` | `7DA19201…` |
| `review/failures/CONTROL_COLLAPSED_HIERARCHY.png` | `8F3D2A2D…` |
| `review/failures/FAILURE_METADATA_400_IN_PRODUCT.png` | `F0C89F0D…` |
| `review/failures/FAILURE_TERTIARY_BELOW_APPLE_7TO1.png` | `73AAF9B4…` |

### Measurements — unchanged

`docs/A3_MEASUREMENTS.csv` is **byte-identical**, SHA-256 prefix `4863070B…`. It was not
regenerated; it was carried across untouched, and its hash is checked rather than assumed.

`docs/A3_MEASUREMENTS.json` is likewise carried across untouched.

### The evidence was re-verified in this tree rather than assumed

| Check | Result |
|---|---|
| `node tools/color.test.mjs` | **40 passed, 0 failed** |
| `node tools/a3-fairness.mjs` | **PASS** — quiet 12 / map 39 / deep 15 / util 38 elements, identical, in both raster conditions |
| `node tools/a3-preflight.mjs` | **PASSED** — all 12 checks, no stop condition |
| `node tools/a3-package.mjs` | archive verified by re-parsing its own central directory; 0 backslash entries, 0 directory entries, all required artefacts present, no unexpected boards, retired thesis B/C values absent |

---

## Stop condition

**Not met.** The correction required no colour change, no re-render, no theme redesign, no Light
Mode, no Living Brass, no QANDEEL Light, and no resolution of B3.1-B's content hierarchy — that
last item is explicitly **routed onward, not resolved**. A3R is a documentation and
canonical-state correction plus the recording of decisions made elsewhere, and it was made by
correcting wording and adding a record, not by adding evidence.

**No Product colour was altered in this revision.** No colour was generated, no value moved, no
new candidate was created, and nothing is frozen.

**QANDEEL is recorded throughout this package as DARK-LED, NOT DARK-LOCKED.**
