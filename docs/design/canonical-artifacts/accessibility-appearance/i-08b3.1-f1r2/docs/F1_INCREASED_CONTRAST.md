# I-08B3.1-F1 — PART B: INCREASE / HIGH CONTRAST

## 1. What the default already does, which changes what this part is for

| | vs World | vs Surface |
|---|---|---|
| `qandeel.content.primary` `#d8d5ca` | **12.95:1** | 12.08:1 |
| `qandeel.content.secondary` `#afaca3` | **8.38:1** | 7.82:1 |
| `qandeel.content.tertiary` `#8b8982` | **5.44:1** | 5.07:1 |
| `qandeel.status.error.ink` `#fe907e` | 8.61:1 | 8.04:1 |
| `qandeel.identity.material` `#a58e6f` | 6.07:1 | 5.66:1 |

Apple's sentence is conditional: *"**If** your app doesn't provide this minimum contrast by
default, ensure it at least provides a higher contrast color scheme when Increase Contrast is
turned on."* QANDEEL's default provides it. So **Increase Contrast here is not a remedy for a
failing default — it is an additional legitimate expression**, which is exactly what §0 insists
on and what stops this part from becoming a repair job on frozen work.

The two places a low-vision reader has a real problem are not text:

- the **World ↔ functional Surface** separation is **1.072:1**;
- **66 of 90** ambient contour samples sit below 3:1, the worst at **1.734:1**.

## 2. The contradiction the search found

The obvious move is to raise the atmosphere. Do it to its limit — every contour at full opacity,
no colour changed at all — and:

| | value |
|---|---|
| worst contour | 1.734:1 → **2.88:1** (three FAR-layer cases still short of 3) |
| loudest contour | 4.209:1 → **5.286:1** |
| weakest analytical object | 5.435:1, unchanged |
| **analysis : atmosphere ratio** | 1.2914 → **1.028** |

**The quiet thing arrives at the strength of the meaningful thing.** I-08B3.0 froze MEANING
EARNS EMPHASIS and QUIET BEFORE LUMINOUS, and an accessibility expression that flattens that has
changed the product, not its presentation. `tools/f1-derive.mjs` runs the lightness lever twice —
once against the default ceiling and once against a raised one — and **lever 2A is blocked at
delta 0 by the compression guard**, which is the finding rather than a failure.

Reaching for the third lever makes it worse, not better. A uniform lightness lift large enough to
carry the far layer past 3:1 pushes the near layer past the analytical relation, because the
atmosphere's near ink already sits at OkLCh **L 0.6206** against the relation's **L 0.6297**.
**There is no headroom between the atmosphere and the analytical ink.** Raising one without the
other is not available.

## 3. The resolution: both move, and analysis moves further

`qandeel.analysis.relation` is **re-routed** from `{qandeel.content.tertiary}` to
`{qandeel.content.secondary}` — 5.44:1 → 8.38:1. Both are frozen rungs of the I-08B3.0 reading
ramp. **No literal enters QANDEEL.** `qandeel.control.functional` moves with it, so the
interaction plane's resting ink rises too: a **class** moves, not an object.

Then the atmosphere, by a search over two levers in order of how little they change:

| lever | result |
|---|---|
| **1. ALPHA** — every contour to full opacity | changes no colour at all; carries **12 of 15** (world, layer, ring) cases past 3:1 |
| **2. LIGHTNESS** — one delta for all three layers | **+0.011** in OkLCh L closes the residue |

| | default | increased |
|---|---|---|
| layer lightness | 0.62 / 0.55 / 0.48 | **0.631 / 0.561 / 0.491** |
| layer spacing | 0.07 / 0.07 | **0.07 / 0.07** — exactly preserved |
| worst contour | 1.734:1 | **3.02:1** (×1.75) |
| loudest contour | 4.209:1 | **5.501:1** |
| weakest analytical object | 5.435:1 | **8.384:1** |
| **analysis : atmosphere ratio** | 1.2914 | **1.524 — the gap WIDENS** |
| max contrast between any two hues | 1.0228:1 | **1.0289:1 — colour still carries nothing** |

The chroma ceiling **0.0197 does not move**, so no hue becomes more insistent than another. One
delta for all three layers, because a per-layer lift would compress or expand the depth ladder —
a change in the **spatial reading** rather than in its visibility.

## 4. The two moves that were measured and rejected

**Darkening the ground.** Pure black buys **×1.1036** on tertiary reading ink and **×1.0041** on
a far contour. The World is frozen in I-08B3.1-A and a 0.4 % gain is not a reason to unfreeze it.
`qandeel.accessibility.contrast.ground` exists as a token **aliased to the unchanged World**, so
the decision is where a reader will look for it.

**Reusing the availability ink as the boundary.** `#696762` meets the threshold at 3.14:1 against
the Surface. It was rejected **on meaning, not on contrast**: E1 owns that literal as
AVAILABILITY, and a border drawn in it would say *unavailable*. The boundary is
`qandeel.content.tertiary` — an existing rung, 5.07:1 against the Surface — because Apple asks
for *"near-solid backgrounds with a defined, contrasting border"* and QANDEEL had 1.072:1.

## 5. What does not move, and why each absence is a decision

| | why |
|---|---|
| `qandeel.world.fill`, `qandeel.surface.functional` | measured above; ×1.004 on the thing that needed help |
| `qandeel.identity.material` | **LIVING BRASS IS STATE-INVARIANT IN VALUE AND IN APPEARANCE** (E1R) |
| `qandeel.illumination.*` | brightening every meaning event in proportion to a setting is meaning derived from a preference |
| `qandeel.status.error.ink` | `#fe907e` reaches 8.61:1 and is Product-Owner approved. No second error colour is added for this mode |
| `qandeel.state.disabled.ink` | its meaning is its **distance** from the rest ink, not its absolute contrast |
| the reading ramp itself | roles are re-pointed at different **rungs of it**. Moving a rung would move everything that reaches it, including three E1 states and the focus indicator |

**The disabled ink is the subtle one.** Because the rest ink rises under this setting and the
disabled ink does not, the rest→unavailable gap widens from **×1.61 to ×2.49**: unavailability
becomes *more* readable under Increase Contrast, by not being touched. Check **C-08**.

## 6. Focus

2 px → **3 px**, and nothing else. A **non-colour** strengthening, chosen on purpose: thickening
a perimeter cannot make an object look more important, and brightening one can. WCAG 2.2 SC
2.4.13 (AAA) asks for an indicator at least as large as a 2 CSS px perimeter — which the
**default** already meets — so this strengthens something that passes rather than repairing
something that fails. The detached offset and the dark companion are unchanged; check **C-07**
asserts the focus **ink** does not move.

## 7. Checks

`C-01` ground and surface unmoved · `C-02` Brass, Light, error, disabled unmoved · `C-03` every
contour ≥ 3:1 · `C-04` the hierarchy widens · `C-05` no contour reaches the weakest analytical
object · `C-06` the boundary is an existing rung and is not the availability ink · `C-07` the
perimeter thickens and the ink does not · `C-08` the availability distance widens.
Each carries a probe that must reject.
