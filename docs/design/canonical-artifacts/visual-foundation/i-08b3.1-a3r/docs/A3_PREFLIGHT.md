# I-08B3.1-A3 — PREFLIGHT

**PASSED — no stop condition was met.**
Run on 2026-09-20. Reproduce with `node tools/a3-preflight.mjs`;
it exits non-zero on any failure, so it cannot pass silently.

These are the ten checks the A3 brief requires before any board may be trusted, plus two the
Reference Gate added. Each is answered by a measurement taken from this host, not by an
assurance. Checks 9 and 10 in particular are computed from a **real ENVIRONMENT 3 render**
rather than read back out of the source that produced it.

```
I-08B3.1-A3 PREFLIGHT
renderer: Opening in existing browser session.

PASS   1. Estedad v8.5 binary identity
         path   E:\QANDEEL\QANDEEL PROJECT\.i08b3-work\raw\estedad-v8.5\Estedad-v8.5\Estedad[wght].ttf
         sha256 3134e31a27d58e615967e714c7799fbfa2de952876f8597b33dc57ffe0e99d03
         pinned 3134e31a27d58e615967e714c7799fbfa2de952876f8597b33dc57ffe0e99d03
         This host carries a SECOND file also called Estedad[wght].ttf, under .i08b3-work/fonts/,
         which is a different binary (328,340 bytes vs 284,180). The hash is checked rather than
         the path, so the wrong one cannot be embedded silently.
PASS   2. World Base is exactly #101010
         authored #101010; measured OKLCH L 0.1730 C 0.0000 (achromatic)
         A3 does not search for another World value and does not micro-adjust this one.
         It is preserved, and it is still NOT canonical until independent Design Director review.
PASS   3. Secondary is exactly #afaca3 and unchanged
         authored #afaca3; measured OKLCH L 0.7443 C 0.0131 H 91.6
PASS   4. Tertiary is exactly #8b8982 and unchanged
         authored #8b8982; measured OKLCH L 0.6297 C 0.0106 H 93.6
         It was NOT brightened to compensate for the Metadata weight question. See A3.6.
PASS   5. P1 and P2 are the ONLY candidate-dependent variables
         the template receives 6 custom properties; 1 differs between the finalists: --ink-1
         identical in both: --world  --subtle  --ink-2  --ink-3  --edge
         P1 #d8d5ca regenerated from the control by OKLCH L -0.0275 with chroma and hue held: #d8d5ca (matches the brief exactly)
         P2 #d2cfc4 regenerated from the control by OKLCH L -0.0475 with chroma and hue held: #d2cfc4 (matches the brief exactly)
         The brief supplied the finalist hexes; they are re-derived here rather than taken on trust.
PASS   6. no Brass, QANDEEL Light, interaction or status colour is present
         highest chroma among all 12 colours: 0.0153 (#d2cfc4)
         ceiling for this stage: C 0.016 - above that a value is an accent whatever it is called
         the achromatic diagnostic probe is chroma exactly 0.0000 and carries no hue at all
         13 rendering and measurement files scanned for later-stage vocabulary used affirmatively: none
         (the 10 prose documents are deliberately not scanned - they have to be able
         to say "no brass, no QANDEEL Light, no accent", and prose paints nothing; the chroma census above is what
         guarantees them, because it measures the values that exist rather than the words used about them)
PASS   7. no thesis B and no thesis C value remains anywhere in the package
         thesis B was retired as challenger by the Design Director after A2R; thesis C remains retired.
         10 retired hex values searched across 23 text files
         none found - neither thesis can be rendered by accident because neither exists in the model
PASS   8. every authored colour is painted bit-identically
         12 distinct colours checked in the rendered PNG, 0 mismatched
         --force-color-profile=srgb on both the measure pass and the screenshot pass, and the PNG
         carries no embedded profile, so nothing downstream can re-map it either
PASS   9. Estedad is applied, the wght axis works, and no fallback face is in use
         weights 400 / 500 / 600 measured 1695.5 / 1702.3 / 1706.5 px
         expected 1695.5 / 1702.31 / 1706.5 px, drift 0.00 / 0.01 / 0.00 (tol 1)
         three distinct widths: true - if the axis were being ignored all three would be equal
         this host's fallback face measures 1386.58 px, which is 308.9 px away
         font is embedded base64 in the document, so no network or system lookup can substitute it
         A3 depends on the 400/500 distinction more than any earlier stage, because A3.6 asks whether
         weight 500 rescues the Metadata role. A board with a dead wght axis would answer that falsely.
PASS  10. Arabic direction and tracking are correct in the rendered product
         computed on the real ENVIRONMENT 3 markup, not asserted from the source
         frame: rtl/right (direction / text-align)
         distinct paragraph states (direction / letter-spacing / text-align): rtl/normal/right
         letter-spacing is zero on every Arabic element - banned outright on Arabic, and also one of
         the 14 refusal patterns run against every product frame before it is rasterised
PASS  11. every colour is inside the sRGB gamut, so gamut mapping never runs
         The current CSS Color 4 draft names THREE gamut-mapping algorithms - Binary Search with
         Local MINDE, EdgeSeeker and Ray Trace - and lets an implementation pick any of them. A value
         that needs mapping therefore has an implementation-dependent displayed colour. None of these
         12 values needs mapping, so the question does not arise for this package.
PASS  12. both raster conditions are what they claim, and are structurally fair in both
         condition A2: 1440 CSS px at deviceScaleFactor 2; a board raster measured 2880 px wide
         condition MOBILE: product laid out at 390 CSS px at deviceScaleFactor 3, cut from a 780 CSS px window because Chrome on Windows refuses a window below ~500 CSS px
         colour profile, antialiasing, virtual time budget and compositor flags are IDENTICAL in both
         conditions - they are controls, not variables; only viewport and deviceScaleFactor differ
         deep   A2       15 elements  identical
         deep   MOBILE   15 elements  identical
         map    A2       39 elements  identical
         quiet  A2       12 elements  identical
         util   A2       38 elements  identical
         compared as laid-out geometry with colour excluded, not as source text

PREFLIGHT PASSED - no stop condition met.
```

## Three traps this preflight exists to catch

**Two different files on this host are called `Estedad[wght].ttf`** — 284,180 bytes under
`.i08b3-work/raw/` and 328,340 bytes under `.i08b3-work/fonts/`. Only the first is the
pinned v8.5. Check 1 hashes the file it is about to embed rather than trusting the path.

**Chrome on Windows refuses a browser window narrower than about 500 CSS px.** Ask for 390 and
the layout viewport comes back 488 while the screenshot is still taken at 390, so the
right-hand end of the document is silently cut off the raster. The first mobile run of this
package had exactly that defect. The product frame is therefore laid out at a fixed 390 CSS px
inside a wider window and cut out of the raster by its own reported box, and check 12 records
both numbers.

**A magnification crop must be anchored to the ink, not to the element box.** An RTL
paragraph's border box is the full column width while its glyphs occupy only part of it. Every
magnified tile in this package is cut from the rightmost inked column inside the reported box,
so the crop ends where the glyphs end whatever the box says.
