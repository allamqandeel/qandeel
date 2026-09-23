# I-08B1 — CORE VISUAL THESIS / VISIBLE MIND — CANONICAL STATE RECORD

**CLOSED / FROZEN.** Product decision, 2026-09-20.

This file is the short answer. The long answer is `I-08B1-WS7R-NOTES.md`: §26 the FAR
reconstruction, §27 its motion review (PASS), §28 the FAR freeze, §29 the closure.

---

## The final unified prototype

| | |
|---|---|
| file | `wf-living-constellation.html` |
| size | 388,374 bytes |
| SHA-256 | `4DFD9D27D752C3A445168C0CC7067D71DF4ADA84BC61B806D12C8BB3202BC413` |

One file renders all three distances. `A` is the approach parameter: 0 at the widest overview,
1 at the closest.

---

## The three distances

| distance | state | accepted baseline SHA-256 | the unified prototype there |
|---|---|---|---|
| **FAR** · A = 0 | APPROVED / FROZEN / CANONICAL | `4DFD9D27D752C3A445168C0CC7067D71DF4ADA84BC61B806D12C8BB3202BC413` | 0 of 2,480,100 px differ from `ws7rf-far-hero.png` |
| **MID** · A = 0.5 | APPROVED / FROZEN / CANONICAL | `6D8EFDBCF155BCF6BDCB83CAF9F32D54F88AAC3E8EB6585312048B23A1AEBFF6` | 0 of 2,480,100 px differ from `ws7rr-mid-hero.png` |
| **NEAR** · A = 1 | APPROVED / FROZEN | `7D7D5B5502D7B18D6D35F89F8A2DB74213A55851F65DC98068FEC6A726E39A34` | 0 of 2,480,100 px differ from `ws7rv2-near-hero.png` |

### SHA semantics — read this before concluding anything from the hashes

The NEAR and MID baselines are **NOT superseded** by the unified prototype carrying a later
hash. A distance's baseline is an accepted **state**; the unified prototype's claim is that it
reproduces those states exactly, and that claim is measured rather than asserted.

Stronger than the two sampled boards: the FAR window is exactly 0 for every A ≥ 0.12, so every
frame from there to A = 1 renders **bit-identically whether the FAR window is on or off** —
measured at eleven values of A, 0 of 1,101,800 pixels each.

The one genuinely superseded artefact is the earlier MID baseline
`5225B4607CB5339E8E3BEFC33A0DC3B8AAC97F525FCDEFC10F50AA8F21C2CDD0`, replaced by Product override
on 2026-09-20. Its archive and manifest are **preserved as history and were never deleted**.

---

## Verified at closure

Measured on a clean load at the unified SHA, immediately before archiving:

| | |
|---|---|
| FAR hero, A = 0 | 0 of 2,480,100 |
| MID hero, A = 0.5 | 0 of 2,480,100 |
| NEAR hero, A = 1 | 0 of 2,480,100 |
| reduced-motion destination parity, A = 0 / 0.5 / 1 | 0 of 620,550 each |
| 103-frame FAR → NEAR → FAR round trip | 0 at all three distances |
| `__audit()` | 233 objects · 123 relations · 34,847 field vertices · 8,180 filaments · 54,998 links · 9,501 mesh edges · 96 currents · 19 background worlds · 28 clusters · 27 knots · 72 aerosol · 9 voids — every count unchanged, every assertion true |
| `__typeAudit()` | clean — Arabic family loaded, rtl, no letter-spacing, weight in range |

`reducedMotion` and `loopRunning` read false and are **state reports, not assertions**: the OS
preference is unset on this host and the render loop is idle after a settle.

---

## The archives

| archive | SHA-256 | holds |
|---|---|---|
| `I-08B1-FAR-BASELINE-APPROVED-WS7R-F.zip` | `279E4A10C8BEC9B337443EA6A559EBADA84E8A819B769316CED8B899818651DF` | the FAR freeze — unified prototype, FAR boards, notes, harnesses, MID and NEAR preservation heroes. 13 entries, 13/13 verified. |
| `I-08B1-MID-BASELINE-APPROVED-WS7R-R.zip` | `733D01750FBCB1553C4F53B36E99374ABBE09136DDCEA1713AC127864501FA15` | the canonical MID freeze. 14 entries, 14/14 verified. Untouched. |
| `I-08B1-NEAR-BASELINE-APPROVED.zip` | `5A7F8E6D1A5E66B7BC4128C1894FF151B79B4849B13155FE80A5E415B81C85EA` | the NEAR freeze. Untouched. |
| `I-08B1-MID-BASELINE-APPROVED.zip` | `01FE469CEAC18821BC9C468216CDF1EBB26B3CEB8355B7804DC1F2028C3C00F5` | the **superseded** MID baseline. Historical / non-canonical. Preserved, never deleted. |

Each has an external `.manifest.txt` carrying its own SHA-256, its size and every entry's
SHA-256 — kept outside the archive because a file cannot record the hash of an archive that
contains it.

---

## What is approved

FAR world-at-distance · MID living life-map · NEAR local analytical constellation ·
FAR ↔ MID ↔ NEAR semantic-zoom continuity · world material language · cosmic atmosphere ·
territory language · session and local morphology · local constellation texture ·
Arabic readability behaviour · motion compatibility · reduced-motion parity ·
reversibility with zero hysteresis · semantic and authority preservation.

> **Nothing teleports. Meaning resolves.**
> **Macro simplicity. Micro richness.**

---

## Accepted non-blocking limitations

None of these reopens anything.

1. *Minor* — chroma reduces over the first tenth of the approach (12.6 → 9.0) before rejoining
   the frozen MID material, decaying onto the frozen curve without undershoot.
2. *Minor* — `المال` carries weaker amber identity at stable FAR (4.8% warm share) than at MID
   (84.8%); it resolves continuously and monotonically.
3. *Cosmetic, inherited* — canvas text re-rasterisation at size steps.
4. *Cosmetic* — the FAR band skip guards fall below the existing visual noise floor.

Plus the seven remaining FAR weaknesses at notes §26.8 and the MID notes at §25.3.

---

## Reopen rule

I-08B1 is closed against preference-driven visual iteration. FAR, MID and NEAR do **not** reopen
for a fresh-eye critique, a new aesthetic reference, a change of preference, or a wish for more
polish.

A frozen state reopens only for a genuine **contradiction**: a preservation diff that stops being
zero, a semantic representation the model does not support, a real accessibility failure, a real
Arabic-readability failure, a portability defect from the Skia/Reanimated port requiring visible
correction, a motion regression, or a canonical-state contradiction. Any reopening is **targeted
to the contradiction only**.

---

## What this closure does NOT cover

I-08B1 is the visual thesis, not the implementation. The Skia/Reanimated port, the responsive and
device-class work, and every downstream product task remain open under their own briefs.

`K` (the MID density proposal) and `L` (the near LOD hold) remain available as toggles and remain
**off**. `J` is no longer a proposal — it is the FAR composition and ships **on**; pressing it
holds the FAR window at zero and leaves the inherited WS7 FAR, to the pixel.
