# I-08B3.1-F1 — CARRY-FORWARD

§18 allows F1 to record requirements F2 must satisfy, **and nothing more**. No Light Appearance is
designed here, the palette is not inverted, and no provisional light mode exists to fill a matrix.

---

## A. REQUIREMENTS ON I-08B3.1-F2 — LIGHT APPEARANCE

F2 derives Light World, Light Surface, Light reading neutrals, Living Brass in light, QANDEEL
Light in light, Error in light, the interaction states and the high-contrast combinations as
**one coherent appearance**. When it does, these must hold:

1. **The `increased` contrast context must be filled for LIGHT too.** B4R's model is that
   increased contrast is an **override of the appearance it applies to, not a third appearance**.
   F1 filled it for dark only. Resolving `appearance: light, contrast: increased` currently
   returns nothing, by design.

2. **The non-compression law must be restated in light and re-measured.** *The gap between the
   weakest analytical object and the loudest atmosphere contour may widen and may not shrink.*
   The dark numbers — 1.2914 → 1.524 — are dark's. Light's own default ratio has to be measured
   and then defended.

3. **The technique F1 used may not transfer.** Increase Contrast in dark works by moving a class
   **up** the reading ramp. In a light appearance the ramp runs the other way, and the rung above
   may be the one that reduces contrast against a light ground. F2 must derive its own direction
   rather than mirroring this one. See `F1_CONTRADICTIONS.md` C-1 for the ceiling on the method.

4. **The scrim substitution must be recomputed, not copied.** `#080808` is black at alpha 0.5
   **over the World `#101010`**. Over a light World it is a different number, and check T-01
   recomputes rather than compares to a constant — it will work unchanged in light.

5. **The atmosphere derivation must be re-run, not transcribed.** `tools/f1-derive.mjs` is a
   **search** over whatever the ceiling and the ground then are. It should be re-run for light,
   and its four constraints re-stated, rather than its outputs copied.

6. **Living Brass, QANDEEL Light and Error must stay separable in light under every accessibility
   expression.** In dark, E1 measured the error ink and Living Brass as the two closest things in
   QANDEEL for a protanope — 0.0554 against a floor of 0.0513. Light has its own version of that
   measurement and F1 has not made it.

7. **Grayscale and dichromacy diagnostics must be re-run in light.** The finding that hue carries
   nothing is a measurement of the dark atmosphere at a chroma ceiling of 0.0197. It does not
   transfer by assertion.

---

## B. REQUIREMENTS ON THE MOTION TRACK (out of F1's scope by §19)

8. **The CAMERA needs a single-pointer alternative.** WCAG 2.2 **SC 2.5.7 Dragging Movements**
   requires one for author-controlled dragging, and the Map is panned by dragging. **Open.**

9. **Camera travel needs a reduced counterpart** that lands the user at the same place with the
   same objects visible, without requiring them to watch the journey to know where they are. SC
   2.3.3 (AAA) applies.

10. **A lint rule or a wrapper for reduced motion.** Because every QANDEEL animation must opt out
    of `ReduceMotion.System` in order to be accessible, a new animation written the ordinary way
    will be wrong and nothing will say so. See `F1_CONTRADICTIONS.md` C-4.

---

## C. REQUIREMENTS ON PRODUCT

11. **The atmosphere chroma ceiling and the field's DENSITY — carried to G, not to F2.** The
    North Star measurement is in `F1_SPECTACLE_PRESERVATION.md`: the ceiling gap is **×3.69** and
    the spatial-detail gap is **×3.72**. Density is constrained by **no token in any package** —
    which is an observation and **not a permission**. F1 said density was "the cheapest route"
    toward the North Star and F1R withdraws that: absence of a prohibition is not Product
    authority, and nothing here grants density to anyone. The ceiling at 0.0197 is a D-track
    decision and D is CLOSED / FROZEN. **Neither is an accessibility question**, and both belong
    to **G — INTEGRATED PRODUCT PROOF**, which owns the open obligation to show that the final
    default dark world reaches the required spectacle while preserving every frozen semantic
    truth. Only if G cannot do that within the frozen D contract does a targeted D reconciliation
    arise.

12. **The PATTERN membership sentence is Product copy.** F1 ships a working sentence so the
    projection could be proved; the real one is Product's, and it must name a **set** rather than
    a sequence.

13. **The digit policy.** One numeral system per user per view, including validation copy and
    inline examples. F1 renders Western digits consistently; the policy — locale-decided, or a
    deliberate product-wide pin — has not been set anywhere in the track.

14. **Whether the opaque scrim should become the default.** See `F1_CONTRADICTIONS.md` C-2.

15. **An app-level Reduce Transparency and Bold Text preference for Android**, since the platform
    exposes neither. Legitimate as APP-DERIVED; not F1's to decide.

16. **Haptics as an additive channel for meaning events.** Considered, rejected within F1's scope
    because adding one would be designing new feedback. A real option for the Product.

---

## C.1 THE PRODUCTION MAPPING — A MANDATORY INTEGRATION GATE, added by I-08B3.1-F1R2

16b. **THE ACCESSIBLE SEMANTIC MAPPING MUST BE MADE EXHAUSTIVE AGAINST THE ACTUAL USER-EXPOSABLE
    CANONICAL V SCHEMA.** The contract is
    `qandeel.accessibility.projection.completeness`: *no user-exposable disclosed analytical truth
    may be lost solely because the expression is accessible.* This package proves preservation for
    the three semantic dimensions its synthetic fixture supplies — `epistemic`, `temporal`,
    `actionable`. A real V may expose evidence, provenance, uncertainty and more, and **no field
    names are invented here to fill that gap**. At integration, every user-exposable field of the
    real schema is enumerated and given an accessible expression, and `project(V)`'s
    `$unmappedFields` report must be **empty** against it. **This is a gate, not a nice-to-have.**

16c. **CANONICAL V MUST BE REFERENTIALLY CLOSED**, and the runtime must be able to say so. The
    projector fails closed on a dangling reference — no id, no name, no prose — and reports it.
    That is containment, not a repair: a reference V does not disclose is a defect upstream.

16d. **WHETHER QANDEEL WANTS AN EXPLICIT UNKNOWN STATE IS A PRODUCT DECISION.** The projection no
    longer manufactures one from an absent field. If a reader should be told that a status is
    undetermined, canonical V supplies that as a **value** — and which of *not applicable*, *not
    disclosed at this depth*, *unavailable*, *absent from this family* or *not supplied* it means
    is Product's to decide, not the accessibility layer's.

---

## D. REQUIREMENTS ON VALIDATION

17. **A DEVICE PASS, WITH VOICEOVER AND WITH TALKBACK, IN ARABIC — A MANDATORY IMPLEMENTATION /
    INTEGRATION VALIDATION GATE.** This is the largest open item in the package. **No real screen
    reader has been run anywhere in this track.** The evidence here is a browser accessibility tree
    read over the DevTools protocol, and **browser AX-tree evidence is not screen-reader
    validation**. I-08B3.1-F1R2 deliberately did **not** open another F1 stage to chase it: a
    design package on this host cannot produce it. It is owned by implementation and it must be
    passed before the accessible expression ships.

18. **A native Arabic copy review** of the projection strings and the unavailability reason.

19. **A re-measurement of the label escape scale on real viewports.** 1.6 is a property of a
    390 pt frame and is classified production-default for that reason.

19b. **A RE-MEASUREMENT OF THE ARABIC LEADING THRESHOLD on the production face, at production
    sizes, on the production renderer.** The contract is `text.arabic-must-not-clip`; the 1.6
    threshold is Estedad's, measured here, and is classified production-default for that reason.
    Moving it is legitimate **only as a measured result**.

20. **Android nonlinear font scaling above 1.3×** needs its own text ladder; F1's is iOS's.
