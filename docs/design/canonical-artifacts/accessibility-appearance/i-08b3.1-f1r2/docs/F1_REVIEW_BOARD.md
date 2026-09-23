# I-08B3.1-F1 — THE REVIEW BOARDS

Eleven boards — the ten §22 requires, plus BOARD K, which I-08B3.1-F1R added because the inherited-default non-regression proof is a claim a reviewer should be able to check by LOOKING before reading a hash. Every one is rendered from the **same scene builder** with
a different accessibility state vector, so a reviewer comparing two boards is comparing two
**expressions of one system** rather than two drawings.

**The captions carry numbers, not adjectives.** A caption that says *"clearer"* is a claim a
reviewer cannot check.

| board | file | what to look at |
|---|---|---|
| **A** | `b01-default-spectacle.png` | the three worlds in the **default** expression after F1. The North Star numbers are in the notes, decomposed into framing and policy |
| **B** | `b02-increase-contrast.png` | default vs increased, with the hierarchy ratio under each — **1.2914 → 1.524, the gap widens** — and the five values that do not move |
| **C** | `b03-reduce-transparency.png` | the same 90 strokes and 18 fills, opaque. The table of the three real subjects, and the one that deliberately does not change |
| **D** | `b04-reduced-motion-light.png` | one INSIGHT, two expressions, six timestamps, **the differing channels named numerically under each pair**. The last pair is identical |
| **E** | `b05-combined-contrast-transparency.png` | the two settings and their combination. No third set of values exists |
| **F** | `b06-no-colour-dependence.png` | default / grayscale / protanopia / deuteranopia — and the measurement that makes it a quiet board |
| **G** | `b07-larger-text-arabic.png` | 100 % → 200 % → **AX5 (311.8 %)** → Bold Text. Nothing truncated, nothing shrunk |
| **H** | `b08-focus-selected-error.png` | FOCUS · SELECTED · UNAVAILABLE · ERROR, and what each setting does and does not do to them |
| **I** | `b09-screen-reader-projection.png` | the projection rendered, plus the table of the four refusals |
| **J** | `b10-truth-parity.png` | 11 objects × 12 expressions = **132 cells**, a **bounded** proof over the tested semantic dimensions — plus the four **planted removals**, each deleting one object from the RENDERING while leaving it in the truth JSON |
| **K** | `b11-inherited-default.png` | F1’s default inherited layer beside the SAME layer built from I-08B3.1-D2R’s own exports. **Pixel-identical**, and the list of what the comparison could NOT reach |

## Reading Board D

The frames read **right to left**, because the board is built on an RTL root and the product is
Arabic-native — time flows in the reading direction. Each cell shows the **full** expression above
and the **reduced** expression below, at the same millisecond, with the channels that differ named
underneath.

`t = 2600 ms` is **identical** — nothing has happened yet.
`t = 5800 ms` is **identical** — the settled residue does not depend on which version you saw.
Everything between differs, and the caption says by exactly how much in which channel.

## How the boards are built

`tools/f1-boards.mjs` renders every scene through headless Chrome, then composes the boards as
pages and rasterises those. The intermediate captures live in `review/src/` and are excluded from
the manifest: they are a build artefact, not a deliverable.

**A bidi note, because this track has shipped the defect before.** The boards are built on an RTL
root, and an unisolated English run inside an RTL paragraph is reordered by the bidi algorithm.
The first build of these boards put every English note's bold lead-in at the far end of its line.
Every Latin run is now wrapped in an LTR isolate and every mixed block carries `dir="auto"`, which
resolves direction from its first strong character.
