# E1_IMPLEMENTATION_BOUNDARIES

**I-08B3.1-E1.** What an implementation may tune without changing Product meaning, and
what it may not touch at all.

---

## 1. May be tuned, on device evidence, without asking

| | bound |
|---|---|
| the press wash alpha | must still move the ground by at least the frozen World→Surface lightness step (0.03599 in OkLCh L), and must not make the pressed World equal the one functional Surface value |
| the press scale response and its duration | must begin on pointer-down; must return to rest on release with no residue |
| the focus indicator thickness | **2 px is a floor from WCAG 2.2 SC 2.4.13.** Up, never down |
| the focus offset | must remain > 0. Detachment is the contract |
| the companion thickness | must remain ≥ 1 device-independent pixel |
| the selection marker thickness, length and inset | the marker must stay a **segment on the anchored edge**, not a full edge and not a fill |
| the two type weights | the relation (selected heavier) is fixed; both values stay inside 400–700 |
| corner radius, spacing, icon geometry | E1 freezes none of it |
| small contrast calibration that preserves semantic identity | every floor in `E1_VALIDATION_RESULTS.md` §6 must still hold |

**Reduced motion.** Under `prefers-reduced-motion` / `isReduceMotionEnabled`, drop the
press **scale** and keep the **ground** response. That is an implementation note, not an
alternate expression: the ground response is not vestibular, and removing the feedback
entirely would make the control feel dead for exactly the people who most need it to feel
answered. E1 does not design a reduced-motion expression, because its only motion is one
duration and one scale.

---

## 2. May NOT be changed by implementation tuning

- **role meaning** — what error, warning, success, informational and each of the five
  states *mean*;
- **the composition model** — the channel owners, the three precedence rules, and the
  verdict on every one of the sixteen combinations. An implementation may not resolve a
  combination differently, and may not leave one undefined;
- **the two availability patterns** — which one a control uses is an integration decision
  and should be recorded per control type; that they are **visually identical**, that
  neither can activate, and that the DISCOVERABLE one suppresses activation explicitly, are
  not negotiable;
- **the Brass boundary** — nothing in state or status may reach the identity material, and
  no state or availability rule may dim, recolour or composite a Brass-bearing object;
- **the Meaning Light boundary** — nothing in state or status may reach the illumination;
- **the colour-only prohibition** — every critical role ships the non-colour channels named
  in its `com.qandeel.companion` extension;
- **FOCUS detached versus SELECTED attached**;
- **the error meaning**, and the fact that the error role has exactly one value;
- **the two literals**, which are product-contract for the reasons in
  `E1_FREEZE_BOUNDARY.md` §3.

---

## 3. Obligations E1 hands to integration

1. **A device has seen nothing.** Every measurement is headless Chrome at dpr 2 with LCD
   antialiasing and subpixel positioning disabled. Device validation is a mandatory
   implementation gate and is **not** an E1 freeze blocker — the semantic contract and the
   device calibration are different claims.
2. **Hit targets.** E1 specifies no minimum touch target. Integration owns it, and the
   proof's 48 px row is a proof metric, not a specification.
3. **The `:focus-visible` equivalent.** On the web the distinction between focus and
   focus-visible is the browser's; in React Native it is not, and integration must decide
   when the indicator appears for a pointer-driven focus. E1's contract is that the
   indicator means *input is going here*, which is a statement about intent rather than
   about an API.
4. **A screen reader has not been heard.** The attributes are present and correct; the
   announcements were not verified.
5. **The Arabic copy is a contract, not final strings.** See `E1_ARABIC_COPY_CONTRACT.md`.
   A native reviewer has not signed the wording off.
6. **The numeral policy is not E1's.** The proof pins Eastern Arabic-Indic digits for
   internal consistency, because mixing systems within one view is a real observed failure.
   Which system the Product ships is a content decision belonging to Product, taken once
   and centralised in one formatter.
7. **Which availability pattern each control type uses.** E1R specifies the two patterns and
   the rule for choosing between them; it does not enumerate QANDEEL's controls. W3C's APG
   asks for *"consistent pattern-based conventions"*, which means the decision is made once
   per control type and written down, not per screen. **The default for a control inside a
   set is DISCOVERABLE**, and a standalone commit whose reason is visible beside it is the
   case for NATIVE.
8. **Availability around a Brass-bearing object.** E1R supplies no expression and forbids
   two of the three obvious ones. If the Product needs an unavailable navigation
   destination, the decision belongs to the navigation contract and comes back here as a
   requirement, not the other way round.

---

## 4. The one thing an implementer is most likely to get wrong

**Reaching for the error ink as "the app's accent colour."**

E1 adds a colour to a product that had almost none, and it is the most chromatic value in
the system by a factor of 2.6. The pull will be real. There is no token called `accent`,
the role has exactly one value so there is no family to spread, and the check that would
catch the misuse is not in this package — it is the coverage discipline C2 established for
Living Brass, which integration should extend to the error ink: **measure what fraction of
ink is error-coloured on each screen, and expect it to be zero on almost all of them.**
