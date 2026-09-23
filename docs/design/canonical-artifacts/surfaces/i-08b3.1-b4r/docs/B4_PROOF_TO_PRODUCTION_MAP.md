# B4_PROOF_TO_PRODUCTION_MAP

**I-08B3.1-B4.11.** Every diagnostic concept from B0–B3R, classified.

This document exists to stop a **proof instrument** from becoming a **product decision** by the
passage of time. Every value below was made for a reason; several of those reasons were "we needed a
number to measure against", and a number invented to be measured against will be treated as a
decision by the first person who finds it in a file and does not know its history.

Five classifications:

- **CANONICAL PRODUCTION TOKEN** — ships in `tokens/qandeel-surface.tokens.json`.
- **CANONICAL PRODUCT CONTRACT** — a rule, frozen, in a B4 document.
- **DEFERRED TO B3.1-E** — interaction, status and semantic colour work.
- **DEFERRED TO B3.1-F** — accessibility alternate expressions and Light.
- **RETIRED / PROOF-ONLY** — existed to be measured or to fail. Must never appear in production.

---

## 1. The required classifications

| concept | origin | classification | where it lives now |
|---|---|---|---|
| **`#181818`** | B1 direction, B2 selection, B3 stress, B3R untouched | **CANONICAL PRODUCTION TOKEN** | `qandeel.expression.surface`, once |
| **50 % scrim** | B2 diagnostic, B3 probe range, Director selection for B4 | **CANONICAL PRODUCTION TOKEN** | `qandeel.expression.scrim` — neutral black, alpha 0.50 |
| **Diagnostic Class S `#646464`** | B1 solver output against `#181818` for ≥ 3:1 | **DEFERRED TO B3.1-E / F** | **Not in the token file.** The *rules* are frozen in `B4_CANONICAL_SURFACE_SPEC.md` §4; the colour is not B4's. |
| **Focus diagnostic** (2 px achromatic ring) | B3.8, sized for SC 2.4.13's area requirement | **DEFERRED TO B3.1-E / F** | Not in the token file. The 2 px *area* reasoning is recorded; the indicator is not designed. |
| **0.5 px line** | B1 hairline probe | **RETIRED / PROOF-ONLY** | Nothing. 1 logical/CSS px is the proven normal baseline. |
| **1 px line** | B1 | **CANONICAL PRODUCT CONTRACT** | `B4_CANONICAL_SURFACE_SPEC.md` §4 — baseline thickness for Class S, colour deferred |
| **Translucency** (alpha 0.72, blur 18) | B1R/B3.10 controlled comparison | **RETIRED / PROOF-ONLY** | Nothing. Retired from the B-track. INV-11 rejects any alpha on a Surface token; probe `n6` is this value returning, and it is rejected. |
| **Role-specific tones** | B1 hypothesis, tested and refused | **RETIRED / PROOF-ONLY** | Nothing. INV-01/INV-02; probes `n1`, `n2`, `n11` rejected. |
| **Darker-than-World** | B1 sunken direction, retired | **RETIRED / PROOF-ONLY** | Nothing. INV-05; probe `n4` rejected. |
| **Minimal tint** | B1 parametric family, uncontrollable near black | **RETIRED / PROOF-ONLY** | Nothing. INV-04; probe `n3` — a one-step tint on one channel — rejected. |
| **Class O divider** | B0R | **CANONICAL PRODUCT CONTRACT** | `B4_CANONICAL_SURFACE_SPEC.md` §5 — **default NONE**, exists only on the Edge Removal Test. No token. |
| **Proof radii** (`--radius: 10px`, 14 px in failure captures) | B3 rig | **RETIRED / PROOF-ONLY** | Nothing. Corner radius is component/context-specific. Corner radius is not personality. |
| **Proof shadows** (`--card-shadow`) | B3 cardification failure captures only | **RETIRED / PROOF-ONLY** | Nothing, and it never was anything: it was only ever set on failure boards. Guard rule C1 rejects any shadow. |

---

## 2. Everything else the B-track produced

| concept | classification | note |
|---|---|---|
| WORLD `#101010`, reading neutrals `#d8d5ca` / `#afaca3` / `#8b8982` | **CANONICAL PRODUCTION TOKEN** | Frozen in I-08B3.1-A. Reproduced, never redefined. |
| Opaque matte material | **CANONICAL PRODUCT CONTRACT** | Expressed as alpha 1 on every Surface token. |
| The four Product Surface roles | **CANONICAL PRODUCT CONTRACT** | `qandeel.role.*` and `B4_SURFACE_ROLE_CONTRACTS.md`. |
| The Surface Earning Test, the Substitution Test | **CANONICAL PRODUCT CONTRACT** | `B4_SURFACE_EARNING_TEST.md`. |
| The Modality Test | **CANONICAL PRODUCT CONTRACT** | PASSAGE earning condition. |
| PRODUCT ROLE ≠ ACCESSIBILITY ROLE | **CANONICAL PRODUCT CONTRACT** | B3R. `B4_SURFACE_ROLE_CONTRACTS.md` §0. |
| The four PASSAGE focus-lifecycle obligations | **CANONICAL PRODUCT CONTRACT** | B3R, proven behaviourally. Carried, not re-proven. |
| N2 same-tone overlap, one scarce Class S seam | **CANONICAL PRODUCT CONTRACT** | Seam colour deferred with Class S. |
| Submenu is furniture, not a second layer | **CANONICAL PRODUCT CONTRACT** | No token, no tonal step. |
| `#1b1b1b` (B2 challenger), `#161616` (B2 lower-bound control) | **RETIRED / PROOF-ONLY** | Absent from every shipped file. INV-03 scans for them with needles assembled from halves at runtime, so the scan covers its own source and carries no exemption. Probe `n7` is one of them returning, and it is rejected. |
| B3's focusable-`div` FIELD value | **RETIRED / PROOF-ONLY** | Explicitly corrected. Proof markup is not component architecture — `B4_SURFACE_ROLE_CONTRACTS.md` §4. |
| B3's `role="menu" aria-modal="false"` on every ASIDE | **RETIRED / PROOF-ONLY** | Corrected in B3R. It is one of B3R's five negative probes, imported from the sealed package rather than reconstructed. |
| Structural fingerprinting, focus-topology reporting, the CDP lifecycle harness | **PROOF METHOD** | Instruments, not product. They stay in their packages. |
| Bench chrome (`#333333` board background, caption inks) | **RETIRED / PROOF-ONLY** | Board furniture. Never product. |

---

## 3. The split, made executable

The classification above is not only a table. It is enforced by what
`tools/b4-integration.mjs` does and does not supply.

The token file supplies exactly the canonical custom properties:

```
--world  --surface  --s-apparatus  --s-aside  --s-passage  --s-field
--s-sub  --s-nested  --ink-1  --ink-2  --ink-3  --scrim
```

and deliberately **does not** supply:

```
--edge-s  --edge-o  --edge-w  --nested-ring  --focus-ring  --focus-w
--radius  --card-shadow  --glass-blur  --glow  --s-diag  --s-card  --ts
```

Those keep their B3 diagnostic values in **both** variants of the integration render. If a future
version of this package quietly began supplying `--edge-s`, the Class S colour would have been
frozen by a token file rather than by a decision — and the list above is where that would show.

---

## 4. The one-way rule

A **RETIRED / PROOF-ONLY** entry may not be promoted by a later package without a Design Director
decision that names it. This matters most for the three that will be most tempting:

- **translucency**, because every platform offers it and it looks expensive;
- **a role-specific tone**, because it is the obvious fix the first time two layers overlap
  awkwardly;
- **a shadow**, because it is the obvious fix the second time.

All three were tested. All three were refused with evidence. The invariants make each of them a
failing test rather than a discussion.
