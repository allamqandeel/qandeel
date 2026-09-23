# E1_COLOUR_DERIVATION

**I-08B3.1-E1.** Where the two values E1 adds came from, and which of their coordinates
were decided rather than derived.

Everything below is produced by `tools/e1-derive.mjs`, which the token emitter and the
results document both read. Not one figure is typed twice.

---

## 1. The one declared decision

> **THE ERROR BELONGS TO THE RED FAMILY.**

That is FAMILIARITY, and it is named as a Product decision rather than disguised as a
measurement. It is the single convention E1 keeps from ordinary UI, and it is kept on the
record: both platforms give error a red, users arrive carrying the expectation, and
"only break a familiar pattern if you can prove it's better" is a reason, not a reflex.

**Everything else is derived.** If the Design Director rejects the red family, the
derivation runs again with a different declared family and produces a different value; the
machinery is not attached to the answer.

---

## 2. The derived inputs

### FLOOR — what the system already treats as a usable distinction

Living Brass's full OkLab distance from the frozen reading ramp:

| | dEok |
|---|---|
| LIVING BRASS vs PRIMARY | 0.21608 |
| LIVING BRASS vs SECONDARY | 0.09338 |
| LIVING BRASS vs TERTIARY | **0.05129** |

**FLOOR = 0.05129**, the closest of them. The argument is in one sentence: *the system
already relies on Brass-against-the-ramp being a distinction a reader can use, so nothing
E1 adds may be a weaker one.*

Cross-check: I-08B3.1-C2 independently measured SECONDARY → BRASS at dEok 0.0934. The
second row above agrees with a sealed package's number to four decimals.

### CHROMATIC — what makes something a colour rather than a light grey

**0.05159**, Living Brass's own chroma.

This constraint exists because of a failure found during the derivation and worth
recording: **without it, the FLOOR is satisfiable by a light GREY sitting at an unused
lightness.** A full-gamut sweep (`e1-feasibility` in the work record) found
`#a19998`-class neutrals passing every distance test purely on lightness. A grey cannot be
the colour that reports a failure, so the error must be at least as chromatic as the value
the system already treats as a colour.

### The measured hue band nothing may enter

Every chromatic value QANDEEL paints:

| | OkLCh hue | chroma |
|---|---|---|
| PRIMARY `#d8d5ca` | 94.2 | 0.0153 |
| SECONDARY `#afaca3` | 91.6 | 0.0131 |
| TERTIARY `#8b8982` | 93.6 | 0.0106 |
| LIGHT core / mid / low | 89.1 / 88.5 / 90.4 | 0.0317 / 0.0378 / 0.0462 |
| LIVING BRASS `#a58e6f` | 75.0 | 0.0516 |

**The occupied band is hue 74.8 → 94.2, a span of 19.4°.** The whole visual identity of
QANDEEL lives in nineteen degrees of hue. That measurement is what rules out an amber
warning on evidence rather than on taste, and it is a fact about this product that no
generic guidance would have produced.

---

## 3. The error ink — `#fe907e`

### HUE: anchored, then moved only as far as robustness forced it

The anchor is the **OkLCh hue of the sRGB red primary**, 29.2339 — the one red the display
is actually built to make. **No hue arc was declared and no width was typed.** The search
starts at the anchor and steps outward in both directions, stopping at the first hue where
a value exists that keeps every floor under ±1 least-significant bit per channel.

**It moved 0.75° toward orange.** Resulting hue: 29.9839.

### LIGHTNESS: not pinned. It fell out.

An earlier attempt pinned lightness to the midpoint of the widest gap in the frozen ink
ladder. **That attempt failed, and the failure is informative**: protanopia does not merely
remove a red's hue, it *moves its lightness down* into the neutral it was separated from,
so a gap constructed for a normal observer does not survive. The lightness was released
and allowed to fall out of the search. It landed at **0.7675**.

### CHROMA: the smallest value that satisfies every floor

Objective: minimum chroma, tie-broken on the largest worst-case distance. **C = 0.1370.**

### The floors, in full

1. chroma at least Living Brass's;
2. contrast at least 4.5:1 on the World **and** on the functional Surface;
3. full OkLab distance at least FLOOR from **every** ink QANDEEL can paint, including
   Living Brass and all three Light stops;
4. (2) and (3) again under simulated **protanopia** and **deuteranopia**;
5. and all of it again for each of the **27** one-bit perturbations of the quantised
   triple, because a quantised value is not its authoring value and a panel does not
   reproduce an 8-bit triple exactly. A value that passes only at its exact triple passes
   only on paper.

### The result, and the uncomfortable half

```
authored   oklch(0.7675 0.1370 29.98)
quantised  #fe907e   rgb(254, 144, 126)
recovered  L 0.7671   C 0.1364   H 30.32
contrast   8.61:1 on the World   8.04:1 on the functional Surface
```

**Only 3 sampled points are feasible at this hue, and the sRGB gamut edge is 0.0010 of
chroma away.** The accessibility floors consume very nearly the whole of the red region of
the gamut at this lightness. There was almost nowhere to stand, and that is the result
rather than a coincidence — it is also why the exact value is classified product-contract
in `E1_FREEZE_BOUNDARY.md`: there is nowhere else for it to go.

### The binding constraints

| | measured | floor |
|---|---|---|
| `protan: dEok from SECONDARY` | 0.05303 | 0.05129 |
| `protan: dEok from BRASS` | 0.05541 | 0.05129 |

**Both binding constraints belong to a red-blind reader**, and the second one is worth
stating plainly: **for a protanope, the error ink and the identity material are the two
closest things in QANDEEL.** That is an argument for the non-colour channel and an
argument for keeping Brass scarce, and it is the kind of thing only a measurement finds.

### What happens to the obvious candidates

The identical floors, applied to the two reds a designer would otherwise reach for:

| candidate | result |
|---|---|
| **Material 3 dark error `#f2b8b5`** | **3 floors unmet.** It collides with QANDEEL LIGHT under dichromacy: `deutan: dEok from LIGHT-low` = 0.0181 against a floor of 0.0513. Both are pale warm values, and a dichromat cannot separate them. |
| **Apple systemRed dark `#ff453a`** | **2 floors unmet.** Under simulated protanopia it falls to 3.74:1 on the World and 3.49:1 on the functional Surface — below the 4.5:1 it needs as text. |

This is check **R14**'s probe, not a paragraph. It is the reason E1 derived a value
instead of adopting one, and it makes "these floors are specific to THIS palette"
something a reviewer can re-run.

---

## 4. The unavailable ink — `#696762`

**The frozen reading ramp extended by its own rule.** Not an opacity, not a status colour,
and not a value anyone chose.

```
L = TERTIARY 0.6297  minus the ramp's own smallest rung 0.1146   = 0.5151
C = TERTIARY 0.0106  minus the ramp's last chroma step  0.0026   = 0.0080
H = the ramp's mean hue                                           = 93.14
```

The rung is the **smaller** of the ramp's two lightness steps (0.1280 and 0.1146), so the
extension is the ramp's most conservative step rather than its most generous.

```
authored   oklch(0.5151 0.0080 93.14)
quantised  #696762   recovered L 0.5140  C 0.0081  H 88.7
contrast   3.37:1 on the World   3.14:1 on the functional Surface
below the dimmest enabled ink by dL 0.1157, dEok 0.1157 — a full rung, by construction
```

**A quantisation note, recorded rather than smoothed.** The authored hue is 93.14 and the
quantised hex recovers 88.7. At chroma 0.008 one 8-bit step is a large fraction of the
whole chromatic signal, so a 4.4° hue drift is expected. The value is achromatic for every
practical purpose and nothing in E1 depends on its hue; it is recorded because a reader
who compares the authored triple with the recovered one should find the discrepancy
explained rather than discover it.

**Independent confirmation.** Apple's own foreground ladder for iOS is Label / Secondary /
Tertiary / **Quaternary** — four rungs, with the fourth below tertiary, used for things
like watermark text. E1 derived the same fourth rung from QANDEEL's own three, without
consulting it.

**What it retires.** The I-08B3.1-C1/C2 diagnostic disabled literal `#5a5a58`, which C3
assigned to E in `C3_PROOF_TO_PRODUCTION_MAP.md` §3. Check **R06** finds the retired hex
in exactly one place in E1's token output — the provenance record that names it as
retired — located **structurally by path**, not by a text heuristic.

---

## 5. The dichromacy model, and the boundary it has

**Viénot, Brettel & Mollon (1999)**, single plane, applied to **linear-light** sRGB.
Transcribed here rather than taken from a dependency.

Because it is transcribed, it is exercised by **property tests that do not depend on
remembering the constants** — 26 of them, all passing:

- the grey axis is a fixed point at five levels, for all three kinds;
- each projection is **idempotent** (simulating an already-simulated colour changes
  nothing), which is a property of the matrix *product* and fails loudly if any single
  constant is mistyped;
- pure red and pure green collapse to one hue under protan and deutan, and blue does not
  join them;
- protanopia loses most of pure red's luminance (0.2126 → 0.1046) and deuteranopia does
  not (0.2126 → 0.2716).

**IT IS A DESIGN INSTRUMENT USED TO SET A FLOOR, NEVER A CLAIM ABOUT WHAT A PERSON SEES.**
Every accessibility *claim* in E1 rests on the non-colour channel.

### Tritanopia is excluded, and the exclusion was found by a check

Brettel 1997 needs **two half-planes** for tritanopia; the single-plane simplification
Viénot validates for protan and deutan leaves pure blue on the plane, i.e. unmoved. A
property test caught exactly that, and the response was to **narrow the claim rather than
loosen the check**: `tritan` is implemented, exercised, and deliberately excluded from
every derived floor, because a number from a model outside its validated range cannot
support a claim standing on it. The limit is now asserted as its own check, so anyone who
starts feeding tritan into a floor fails loudly.

Tritanopes retain red–green discrimination — which this model's own property test
confirms — so the error's identifiability for them rests where it rests for everyone: on
the glyph, the copy and the boundary.
