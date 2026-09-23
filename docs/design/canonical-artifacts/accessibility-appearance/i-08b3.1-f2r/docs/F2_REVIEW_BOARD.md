# I-08B3.1-F2 — THE REVIEW BOARDS

Twelve boards, in `review/board/`. **Every tile is a real rendered QANDEEL surface** at 390 × 844
CSS px, DPR 2, Estedad v8.5, Arabic content — not a swatch, not a mockup, and not a re-creation.
The only board with swatches on it is **L**, whose entire subject is the role map, and it shows the
value beside the surface it came from rather than instead of it.

**The boards are a mirror, not a case.** Where the light appearance is weaker than the dark one it
is shown side by side at the same scale with the measurement underneath, because a board that only
showed the light appearance at its best would be asking for agreement rather than judgement.

| board | subject | the question it answers |
|---|---|---|
| **A** | Living Analysis World — **DARK control** | did the appearance F2 may not touch move? |
| **B** | Living Analysis World — **LIGHT** | is this still QANDEEL's world? |
| **C** | CONNECTION — directional relation, **5 beats in both appearances** | does a relation still arrive? |
| **D** | PATTERN — convergence, 5 beats in both | does a set still gather? |
| **E** | INSIGHT — emergence, 5 beats in both | **does it still feel like understanding?** |
| **F** | Personal conversation — light and dark | is the quiet surface comfortable? |
| **G** | Deep analysis reading — light and dark | **is long-form Arabic comfortable on this ground?** |
| **H** | Utility, form and error — light, dark, and light under grayscale | is it the same Error? |
| **I** | Rest · Pressed · Focus · Selected · Unavailable · Error — light | do the states stay distinct? |
| **J** | **Dark ↔ Light**, same scale, no annotation between them | same Product at the same quality level? |
| **K** | Light × the nine accessibility combinations | do F1's laws still work? |
| **L** | The cross-appearance role map — 26 roles, both values, hue drift | role identity, not hex identity |

## The three to look at first

### Board J — the comparison
Dark and light at the same size with nothing written between them, and the chroma ladder beside
them as a table. If the light appearance is going to be rejected as a fallback mode, this is where
it happens.

### Board E — the insight
**The board F2 is least able to argue for.** Five lobes gathering, in both appearances, at the same
five beats. The dark strip is what the light strip is a counterpart of, and the measured gap —
area mean dEok 0.2846 against 0.1022 — is printed under it rather than left to be noticed.

### Board G — the reading
Long-form Arabic on the light ground, with the three contrast ratios measured. **If the light
appearance is going to be chosen voluntarily rather than tolerated, it will be chosen for reading.**

## The motion evidence

§24 asks for real motion evidence where a still cannot judge honestly. Boards C, D and E each carry
**ten frames** — five beats × two appearances — at I-08B3.1-D2R's own phase structure:

| beat | t |
|---|---|
| REST | 800 ms |
| RISE | 2,750 ms |
| PEAK | 2,900 ms |
| FALL | 3,400 ms |
| SETTLE | 5,800 ms |

**The source list, the geometry, the falloff, the envelope and the settle are D2R's functions called
at a time in milliseconds.** F2 changes what the intensity paints, never when — so the two strips
are frame-for-frame comparable by construction.

The **appearance cross-fade** is not on a board because it is not a picture: it is proved as
arithmetic on two rendered projections, in `F2_APPEARANCE_SWITCH.md`, with its five phases written
to `review/switch/`.

## A note on Board A

The dark control is **the accepted raster**, not a re-creation. `tools/f2-regression.mjs`
re-renders it with I-08B3.1-F1's own scene builder on every run and requires byte identity with
sha256 `0a8cb8e0c2ecaf2d9e228392` — the value F1, F1R and F1R2 all shipped.

**A control a package draws for itself is not a control.**
