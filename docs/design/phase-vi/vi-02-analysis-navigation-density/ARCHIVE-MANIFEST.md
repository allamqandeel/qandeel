# QANDEEL — VI-02 · ARCHIVE MANIFEST

Provenance record for the canonical VI-02 archive.

- **Phase:** VI — Final Visual Design + Design Systemization
- **Task:** VI-02 — Analysis Navigation & Density Scalability
- **Closure task:** **VI-02-FREEZE-01** — Canonical Behavioral/Navigation Freeze Archive
- **Date:** 2026-09-01
- **Canonical source baseline:** `main` `7c111f016bf44c93248d32cee0c940099525cb1a`
  (repository `allamqandeel/qandeel`; live `origin/main` verified against the expected SHA at
  task start — exact match, no drift, no intervening commits to inspect)

---

## 1. Nature of this task

**Documentation / archive only.**

- Production code changes: **NONE**
- Runtime / schema / database / migration changes: **NONE**
- New runtime contract requested: **NONE**
- Prototypes, captures, ZIPs or visual renders committed: **NONE**
- VI-03 or any visual language frozen: **NO**
- Phase V or VI-01 reopened: **NO**

Repository files added or changed by this task: **9** — the eight documents below plus
`docs/README.md`.

---

## 2. Source review packages

These are **handoff evidence in the source workspace only**. They are not committed to the
repository, and no prototype, capture, ZIP or visual render from them enters this archive.

| Package | Role in this archive |
|---|---|
| `QANDEEL_VI-02-REV-01_REVIEW.zip` | **Primary authoritative source** for the final behavioural truth |
| `QANDEEL_VI-02-EXPLORE-01_REVIEW.zip` | The exploration under revision — family provenance, identity strategies, the original evaluation matrix (superseded where REV-01 corrects it) |
| `QANDEEL_VI-02-VIS-01_REVIEW.zip` | **Visual research only — non-canonical.** Referenced solely to record that it lies *outside* the freeze boundary |
| `QANDEEL_VI-02_LEGACY_QUALITY_BENCHMARK.zip` | **Quality benchmark only.** Read to judge preserved ambition and named liabilities; nothing copied |

Within REV-01, the authoritative behavioural sources were `10_VI02_FREEZE_BOUNDARY.md`,
`02_IDENTITY_A11Y_RESOLUTION.md`, `03_LATE_DIVERGENCE_EVIDENCE.md`,
`04_DENSITY_REASSESSMENT.md`, `05_BILINGUAL_RTL_ACCESSIBILITY_RECHECK.md`,
`06_RUNTIME_DEPENDENCY_RECHECK.md`, `08_LOW_COUNT_CHECK.md` and
`09_LEGACY_ANTI_REGRESSION_GATE.md`.

**This archive synthesizes the final truth. It is not a copy of the review prose**, and the
review packages remain the evidence of record for method, measurement and proof detail.

---

## 3. Archive file list

| File | Classification |
|---|---|
| `README.md` | CANONICAL STATUS + BOUNDARY |
| `ARCHIVE-MANIFEST.md` | PROVENANCE RECORD (this file) |
| `VI02_BEHAVIORAL_NAVIGATION_FREEZE.md` | **CANONICAL FREEZE — highest authority** |
| `VI02_IDENTITY_AND_ACCESSIBILITY_CONTRACT.md` | CANONICAL CONTRACT |
| `VI02_DENSITY_AND_SCALABILITY_FINDINGS.md` | CANONICAL FINDINGS (not frozen UI metrics) |
| `VI02_RUNTIME_DEPENDENCY_AND_EDGE_BOUNDARIES.md` | CANONICAL VERDICT + EXPOSURE PRECONDITION |
| `VI02_LEGACY_ANTI_REGRESSION_GUARDRAIL.md` | CANONICAL GUARDRAIL |
| `VI02_OPEN_ITEMS_AND_VI03_CARRYFORWARDS.md` | CANONICAL OPEN-ITEMS REGISTER |

Also updated: `docs/README.md` — Phase VI section only.

---

## 4. Independent-review corrections applied — C1 / C2 / C3

The independent freeze review returned **PASS WITH CANONICAL WORDING CORRECTIONS**. The three
corrections below are authoritative and are applied in this archive **even where the source
review wording differs**.

### C1 — F-05 is a canonical identity **source**, not a ban on all excerpts

The source wording ("Nothing may stand in for a reading's own words — no title, no excerpt…")
is too absolute when read beside F-06 and the already-approved compact-reference rule. The
canonical meaning is:

> **The full statement is the canonical human-facing identity source for a reading under the
> current runtime. A derived title, excerpt, ordinal, letter, position, machine ID, or
> set-relative fragment must never be the sole human-facing discriminator on a choosing
> surface. Compact excerpts may exist only as clearly secondary references/pointers when the
> full statement is reachable under F-06 without commitment.**

Preserved: no ordinal identity; no position identity; no user-visible machine ID; no fake
set-relative disambiguation; accessible identity truth.

A future runtime-supplied label is **not** permanently banned. It remains
**`DEFERRED POSSIBILITY — NOT REQUESTED`**, subject to its own future contract and review.

*Applied in:* `VI02_BEHAVIORAL_NAVIGATION_FREEZE.md` F-05 ·
`VI02_IDENTITY_AND_ACCESSIBILITY_CONTRACT.md` §1 · `README.md`.

### C2 — Exact-duplicate boundary: statement uniqueness is not implied

Canonical runtime truth at the reviewed baseline:

- the controlled generation path rejects normalized duplicate `statement + scope`;
- `HypothesisService.create()` itself does **not** enforce a general collision/uniqueness
  invariant;
- therefore "guaranteed distinct peers" remains forbidden.

The canonical freeze states explicitly:

> **VI-02 does not assume that full statements are globally unique across all valid Hypothesis
> records. Exact human-facing duplicates must never be cosmetically disambiguated with
> ordinals, letters, UUIDs, rank, or invented labels. If a production exposure path can surface
> materially distinct records whose human-facing identity is indistinguishable even with the
> full statement shown, that exposure requires a separate truth/runtime/product-contract
> investigation before shipping that state. VI-02 does not invent a UI distinction for data
> that does not contain one.**

This is an explicit **implementation / exposure precondition**, not a request to modify runtime
in this task. This archive does **not** claim that exact duplicates are impossible, that the
statement is globally unique, or that current data guarantees distinct human-readable peers.

*Applied in:* `VI02_RUNTIME_DEPENDENCY_AND_EDGE_BOUNDARIES.md` §3 ·
`VI02_IDENTITY_AND_ACCESSIBILITY_CONTRACT.md` §6 ·
`VI02_OPEN_ITEMS_AND_VI03_CARRYFORWARDS.md` §4.

### C3 — F-12 scoped to this validated architecture

`NO NEW RUNTIME CONTRACT NEEDED` carries the precise canonical meaning:

> **No new runtime contract is required to freeze and later implement the currently validated
> Overview ⇄ Focus behavioral architecture for the tested current-data cases, including
> late-divergence peers, provided full-statement identity remains reachable without
> commitment. This is not a permanent prohibition on future runtime evolution.**

Explicit carry-forward: persistent chip-scale labels, voice shorthand or future dense spatial
references may justify a separate label-contract investigation later; **no label contract is
requested now.**

*Applied in:* `VI02_BEHAVIORAL_NAVIGATION_FREEZE.md` F-12 ·
`VI02_RUNTIME_DEPENDENCY_AND_EDGE_BOUNDARIES.md` §2 ·
`VI02_OPEN_ITEMS_AND_VI03_CARRYFORWARDS.md` §5.

---

## 5. What was deliberately not committed

**Evidence only — not committed to the repository:**

- the review ZIPs (`REV-01`, `EXPLORE-01`, `VIS-01`, `LEGACY_QUALITY_BENCHMARK`);
- the VI-02 prototypes (`proto-f3-overview`, `proto-f2-chooser`, shared fixtures, measurement
  and derivation harnesses);
- all PNG captures at 375×812, in Arabic and English, including the late-divergence and
  text-scaling evidence;
- the VI-02-VIS-01 visual-direction renders (A / B / C / D);
- the legacy benchmark images;
- any temporary HTML/JS used for measurement or capture.

**The prototype is evidence. It is not the product.** Committing it would risk converting a
scalability proof into a canonical visual answer — precisely what this freeze exists to prevent.

---

## 6. Freeze-state authority

This archive is the authority on VI-02's freeze state. Status lines inside the source review
documents were written before the independent review and are superseded by
[`README.md`](README.md) and
[`VI02_BEHAVIORAL_NAVIGATION_FREEZE.md`](VI02_BEHAVIORAL_NAVIGATION_FREEZE.md).

**VI-02 closes as a behavioural and navigation architecture. The final visual morphology remains
open and is carried into `VI-03 — Visual North Star + Graphic Language`.**
