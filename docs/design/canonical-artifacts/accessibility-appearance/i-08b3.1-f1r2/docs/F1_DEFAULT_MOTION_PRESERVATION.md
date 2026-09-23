# I-08B3.1-F1 — THE DEFAULT MOTION PRESERVATION GATE

§6 is mandatory and separate from the spectacle gate: *prove that supporting Reduced Motion has
not weakened normal motion.*

The default must not have become **shorter, flatter, less spatial, less expressive, less
luminous, less rich or less distinctive** because an accessibility path exists.

---

## 1. The strongest form of the proof: F1 wrote no motion at all

F1 does not author a single duration, curve, easing or magnitude of the default choreography.
Every default value in `data/F1_MOTION.json` is a **READ** of a frozen number:

| | frozen value | where F1 gets it |
|---|---|---|
| lifecycle rise | **260 ms** | `LIFECYCLE.RISE`, imported from D2R's scene foundation |
| lifecycle fall | **1,150 ms** | `LIFECYCLE.FALL`, imported |
| settle easing | `cubic-bezier(.38, 0, .32, 1)` | D2R's token |
| large-event scale | 1.25 | D2R's token |
| parallax rates | 1.00 / 0.72 / 0.48 | D2R's `PARALLAX` |
| deceleration | 0.998 | D2R's `DECELERATION` |

Check **M-02** asserts rise = 260 and fall = 1,150 by reading them out of the imported module. If
F1 had shortened the default *"a little, for accessibility"*, the import would still carry 260 and
1,150 and the check would catch the divergence.

**There is no F1 code path that writes a default timing.** The default cannot have been shortened
because nothing in this package is able to shorten it.

## 2. The accessibility code paths are conditional, and that is measured

§6 asks for conditional accessibility paths and no contamination of the default choreography.
Three mechanisms, each checked:

- **D-03** — every accessibility modifier's default context declares **zero token values**. The
  default path resolves through none of them.
- **D-01** — with no setting on, every inherited role resolves to **E1's literal by E1's route**.
  Routes, not just values, so a token that reached the same colour by its own path would fail.
- **D-02 — THE ABLATION** — every accessibility override file is replaced with an empty stub and
  the default document is rendered again. **Byte-identical**, HTML and PNG.

The ablation is what makes this a proof rather than an inspection. A check that rendered the
default twice would pass no matter how contaminated the default was, because it would be
contaminated identically both times.

## 3. The reduced counterparts are counterparts, not the default made cheaper

The direction of the work matters here. Every reduced expression is **built by suppressing named
channels of the full expression**, never by the full expression being rebuilt out of what the
reduced one could support:

```
default        = level + ink + draw + travel + scale + blur + parallax-differential + decay
reduced        = level + ink + draw
```

Subtraction in one direction only. `travel`, `blur` and `parallax-differential` are aliases to
**D2R's own reduced scalars**, so even the suppression values are inherited rather than authored.

## 4. What F1 added to the motion track, and none of it touches the default

Five rows: **GUIDED THREAD**, **PRESS**, **FOCUS**, **SELECTED**, **CAMERA**. Of these:

- two are **KEEP** — nothing changes in either expression;
- one is **CARRY FORWARD** — a stated requirement, not a design;
- two describe a **reduced** counterpart only. The GUIDED THREAD's default is explicitly recorded
  as *"Inherited from I-08B3.1-D0R and NOT retuned here"*; PRESS's default is E1's ground response
  at presence 0.10, read from the token tree by the scene rather than typed into it.

## 5. What this gate does NOT prove

It does not prove the default motion is **good**. It proves it is **unchanged** — and
`review/board/b01-default-spectacle.png` shows what that invariance protects.

It also does not compare against a D2R raster, and does not claim to: F1's scene is F1's drawing
of D2R's world, with a composition built to make the accessibility questions answerable. The
preservation claim is about **F1's own default** and about **inheritance from the token tree**,
which is what D-01 and D-02 measure. `F1_KNOWN_LIMITATIONS.md` §10 says so plainly.
