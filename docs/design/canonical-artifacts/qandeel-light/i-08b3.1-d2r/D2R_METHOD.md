# I-08B3.1-D2R — METHOD

How this package was built, and how each of its claims is checked rather than promised.

**What changed in D2R is in `D2R_CORRECTION.md`.** This document describes the machinery, which
the correction extended in three places: a sixth build gate, five semantic guards, and a
replaced check C5.

---

## 0. The instrument the correction actually needed

I-08B3.1-D2's two blockers were not caught by anything here, and the reason is the same for both:
**the false claims lived in prose, and prose is not an input to anything.** A document saying
"ring radius is how much material the topic holds" is not reachable by a gate.

So the fix is structural rather than editorial.

- **`PRESENTATION_CONTRACT`** is a data structure listing every ambient visual property and what
  it encodes. Build **gate 6** reads it and refuses to emit a page if any property claims an
  encoding without naming a canonical source, if a topic record carries an undeclared key, if an
  undeclared key crosses to the page, or if a world treatment holds anything per-topic.
- **Guards S1–S6** read data structures and **attributes written on live elements** — never rule
  text. The capture records, per frame, the width and opacity of every membership link, the dash
  of every contour, and the opacity of every label, so a guard can measure what the document did
  rather than what a document says it did.
- **Check C5 was replaced, not adjusted.** D2's C5 rigorously verified a property of a statistic
  that should not have existed. A check can be rigorous about the wrong object.

---

## 1. One page, four categories

D1 established that capturing several sequences from **one document** is a stricter control than
one document each: one browser, one layer tree, one font activation, and no cross-page variance
to explain away. D2 has four categories instead of three directions, so the same architecture is
used and the same risk is larger.

It is only safe because of one discipline: **hiding an element writes its ENTIRE hidden state**.
`clear()` in `source/scene/d2-render.mjs` removes the geometry attributes and resets dash, width,
filter, transform, transform-origin and opacity, so an element that is not in use is in the same
condition no matter what used it last.

That discipline is not trusted. It is measured — see §4.

---

## 2. The build gates

Five, and they throw. The page is not written if one fails.

| | |
|---|---|
| **1 · chrome** | every Product colour resolved from the token files I-08B3.1-C3 sealed — by **value** and by **alias route**. A hex that happens to be right today is a copy, not an inheritance. The whole frozen foundation is asserted, not only the colours this scene paints with |
| **2 · font** | Estedad v8.5 resolved from the project-local runtime and recorded by hash. No font byte enters this package |
| **3 · relation contrast** | the settled relation measures **5.44 : 1** on the World against the 3:1 that SC 1.4.11 carries. The value it replaced measured 2.05 : 1 |
| **4 · the candidate Light** | the separation from Living Brass re-derived from the colour that is about to be written into the page, and required to meet its own stated 0.020 |
| **5 · atmosphere** | every ring ink's chroma below both the identity material's and the Light's dimmest stop |
| **6 · geometry** | **GEOMETRY DOES NOT MANUFACTURE MEANING.** Every ambient visual property declared; none claiming an encoding without a canonical source; no undeclared key on a topic or crossing to the page; no per-topic value in a world treatment |

---

## 3. The bundler, and why it had to be one

D1 inlined its modules by stripping `import`/`export` and concatenating. That works when modules
share no export names. D2 inlines **nine**, three of them D1's own, and they collide six times
over — `T`, `LIGHT`, `CHROME`, `FOUNDATION`, `VIEW`, `KEYFRAMES`, `mix`, `makeRenderer` all exist
twice. Concatenating produces a duplicate `const` in one scope, which is a SyntaxError, and the
page renders nothing.

So each module becomes a closure returning its own exports, and each module's imports become a
destructure from the namespace it named. The transform is crude and **checked**: an unresolved
import name, a surviving ES token, or a module that exports nothing all throw.

---

## 4. The instruments

Three families, kept apart because they fail independently.

**C1–C9, on the state trace, with no browser in the room.** These are claims about what the
system was *asked* to draw, and a rasteriser can neither make them true nor false. They cover
the inheritance, the exact-zero settle, the three topologies, the membership geometry — that it
carries no fitted key and that every member holds an equal level at every frame — the inward
gather, the ambient stillness and the reduced-motion parity.

**R1–R8, on 2,106 captured frames.** Claims about what actually appeared.

**G1–G6 and S1–S6, guards, each with a probe.** A probe feeds the guard an input that must be flagged, and
a guard whose probe does not detect its planted violation is a sentence, not a check.

**S1–S6, the semantic guards added in D2R.** Each reads a data structure or an attribute written
on a live element. Eight probes between them, all of which detected their planted violation: a
contract entry claiming an encoding with no source, a topic carrying a `shared` fraction, a
quantity crossing to the page, a per-topic world value, one link written wider than its siblings,
a suppressed label, and three different dash patterns.

### The probe helper was wrong and reported success

Its first version ran a probe's body and recorded whether it **threw**, which made every probe's
polarity depend on how its author happened to phrase the body. Two of six were phrased the other
way round and reported "did not fire" for guards that were working perfectly.

D1 lost two guard runs to the same shape of mistake — a NaN comparison whose branch depended on
the caller's polarity. A probe now **returns true when the guard's own logic, run on a
deliberately broken input, says "broken"**. One direction, written down.

---

## 5. The DOM digest, and the defect it found

Every frame records a SHA-256 of every attribute of every identified element in the stage,
sorted, with **no rasteriser anywhere in it** — because "the four categories are drawn from one
document" was never a claim about Chrome.

The determinism control is `pattern-again`: the same sequence captured a second time, after five
other sequences have used the same elements. It came back with **all 210 digests differing and 0
rasters differing**.

`src-4` is the fifth light source. INSIGHT uses five, PATTERN uses four, so it is hidden whenever
PATTERN runs — and it kept INSIGHT's `transform-origin`. `clear()` had never reset that property,
or `stroke-width`. Nothing painted, because an element at opacity 0 paints nothing.

**This is the same defect class D1 found and fixed, returning as two different properties.**
Hiding by listing properties is a list that goes stale every time the renderer learns to write a
new one. After the fix: **0 of 210 digests and 0 of 210 rasters differ.**

---

## 6. Where a measurement was wrong

Four, and every one was found by running it and reading the number rather than by reading the
code. They are set out in `D2R_TRUTH_AUDIT.md` §4; the short form:

- **the Light line no longer bounded what it was named after** — D2 introduced a third chromatic
  family, and the inherited ink/Light midpoint ran through the middle of it
- **a check that could not see the Light passed** — the corrected line put the faint washes below
  its own threshold, and the check that bounds brightness reported `0.0` and held
- **the navigation check asked a wider question than the one that mattered** — the residual is 2
  pixels at 1/255 between compositions, not the navigation reacting to anything
- **a font scanner found the sentence that forbids fonts** — for the fifth time in this project

And one that was not a measurement error but a design one, found the same way: **R8 revealed that
the two largest meaning events differed in presence by nearly half**, for no reason anyone had
decided. INSIGHT's amplitude was a number written on a different day from PATTERN's.

---

## 7. Three renders that overturned an argument

Each was argued for in prose, looked right on paper, and did not survive a picture: **the
insight's gather was an orb**, **the pattern's light was fog**, and **the structure finished
after the light had gone**. `D2R_DESIGN_RATIONALE.md` §3 sets out what each one taught.

The pattern is consistent enough across D1 and D2 to be worth naming: *an argument about what a
frame will mean is not evidence about what it will mean.*

---

## 8. The typeface is a dependency, not a payload

The brief forbids shipping font binaries, and the constraint is about **redistributing a font**
rather than about file extensions — so the test is on bytes. Guard **G6** scans every file for a
run of base64 that **decodes** to a font signature, and for font file extensions. Nothing anyone
writes about fonts decodes to `wOF2`.

Estedad v8.5 is recorded with its SHA-256 in `data/D2_RESOLUTION.json`. The prototypes reference
it by `file://` URL, which needs `--allow-file-access-from-files` to render with the real face.
**The videos and stills carry the typeface as pixels and are unaffected.**

---

## 9. The tools, in order

| Tool | What it produces |
|---|---|
| `d2-lightsearch.mjs` | the Light derivation and the whole search front |
| `d2-chrome.mjs` | the chrome resolved from C3's vendored tokens, with every alias hop |
| `d2-font.mjs` | Estedad resolved and recorded as a dependency |
| `d2-build.mjs` | six gates, the bundler, one prototype |
| `d2-capture.mjs` | 2,106 frames and their DOM digests; seven pre-capture guards |
| `d2-verify.mjs` | C1–C9, R1–R8, G1–G6 and S1–S6, with 22 probes |
| `d2-stills.mjs` | keyframes, four contact sheets, three composited proof boards |
| `d2-encode.mjs` | nine films, each verified by decoding it back |
| `d2-tokens.mjs` | the candidate token family, emitted and resolved, invariants asserted |
| `d2-gates.mjs` | the skill and reference gates, hashed from disk |
| `d2-board.mjs` | the Product Owner review surface |
| `d2-manifest.mjs` | every file's SHA-256, and the preflight |
| `d2-zip.mjs` | the archive, re-opened from its own bytes and CRC-checked |

`d2-main.mjs` exists because the idiom everyone writes for "is this module the one that was run"
is **false for every path on this machine and fails silently** — the project root contains a
space, which `import.meta.url` percent-encodes, and a Windows file URL carries a third slash
before the drive letter. A tool with that bug runs, exits 0, prints nothing and writes nothing,
and looks exactly like a tool whose work was already done.
