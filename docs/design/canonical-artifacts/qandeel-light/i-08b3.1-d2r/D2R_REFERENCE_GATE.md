# I-08B3.1-D2R — REFERENCE GATE

**MANDATORY, and the one gate in this package that changed an already-accepted decision.**

8 first-party sources. For each: what was read, what it CHANGED in QANDEEL, and —
because this is where honesty usually leaks — what it did **not** change. No secondary blog is
cited anywhere; where a first-party source could not be reached, that is recorded as a
limitation rather than substituted.

---

## Apple — Human Interface Guidelines, Motion
`https://developer.apple.com/design/human-interface-guidelines/motion` · read in a browser; the page is client-rendered and returns an empty shell to a plain fetch
**Principle.** "Add motion purposefully, supporting the experience without overshadowing it. Don't add motion for the sake of adding motion." / "In apps, generally avoid adding motion to UI interactions that occur frequently." / visionOS: avoid sustained oscillation, "in particular… around 0.2 Hz because people can be very sensitive to this frequency".
**What it changed.** The 0.2 Hz figure is the first of two independent sources naming the exact frequency a "breathing ring" would land on, and it is why the ambient field is still. "Avoid motion on frequently occurring interactions" is the same argument `animate`'s frequency table makes, from a second direction.
**What it did NOT change.** Nothing about the three meaning events. They are infrequent, purposeful and state-indicating, which is what this page asks for; it neither permits nor forbids anything D2 does with them.
---
## Apple — Human Interface Guidelines, Accessibility
`https://developer.apple.com/design/human-interface-guidelines/accessibility` · read in a browser
**Principle.** Under Reduce Motion, "ensure your app or game responds by reducing automatic and repetitive animations, including zooming, scaling, and peripheral motion", and specifically: "Replacing transitions in x-, y-, and z-axes with fades", "Avoiding animating into and out of blurs". Also: "Convey information with more than color alone."
**What it changed.** THE ONE REAL CONTRADICTION THIS GATE FOUND, and it is inside work that was already accepted. I-08B3.1-D1's reduced-motion counterpart KEEPS its bridging blur, for a good craft reason it states. This list says the opposite, in a document written for exactly this setting. D2 corrects that one channel — `source/scene/d2-connection.mjs`, check C2 — and reports it as a contradiction rather than folding it in. "More than colour alone" is why a topic's CONTOUR and its hue both come from the same identity.
**What it did NOT change.** The full-motion Connection, which is I-08B3.1-D1's function unmodified and is proved so at fourteen decimal places by check C1.
---
## Material Design 3 — Motion (physics system)
`https://m3.material.io/styles/motion/overview` · read in a browser
**Principle.** M3 replaced its easing-and-duration system with springs in May 2025, and splits them: SPATIAL springs "overshoot the final value and bounce into place"; EFFECTS springs are for "color and opacity animations, where there shouldn't be any overshoot". Three speeds each, and "larger elements may use slow".
**What it changed.** TWO THINGS. First, it is the stated reason QANDEEL Light's intensity is a curve and not a spring: light intensity is an EFFECT in M3's own sense, and an overshoot there would be the insight arriving, retracting and arriving again. Second, the speed split is why PATTERN and INSIGHT run the shared lifecycle at 1.25x while CONNECTION runs at 1.0 — they are the larger elements, and that is a reason rather than a nudge for feel.
**What it did NOT change.** QANDEEL does not adopt the spring system. Its motion is system-initiated and non-interruptible by design, which is the case springs exist for and this one is not. Recorded as a divergence with its reason rather than passed over.
---
## Software Mansion — React Native Reanimated, Accessibility
`https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/` · fetched
**Principle.** `withTiming` and `withSpring` "return the toValue immediately"; entering, keyframe and layout animations "instantaneously reach their endpoints"; exiting animations and shared transitions "are omitted". `useReducedMotion` reports the setting AS IT WAS AT APP START.
**What it changed.** The reduced-motion counterparts are separate functions rather than a global flag, and `withDecay`'s documented behaviour — return the current value immediately — is implemented literally in the ambient pan: under reduced motion the map STOPS WHERE THE FINGER LET GO rather than gliding. That is the rule's real behaviour, not an approximation of it.
**What it did NOT change.** The full-motion expressions. Nothing here argues for changing what a user without the setting sees.
---
## Shopify — React Native Skia, Animations
`https://shopify.github.io/react-native-skia/docs/animations/animations/` · fetched
**Principle.** Reanimated values are passed directly as Skia props — "no need for functions like createAnimatedComponent or useAnimatedProps" — and Skia ships its own `interpolateColors` because its colour storage differs from Reanimated's.
**What it changed.** Confirms the production path for the whole light layer runs on the UI thread with no bridge crossing per frame, and is the specific citation behind the colour-interpolation hazard in `D2R_IMPLEMENTATION_FEASIBILITY.md` §3.
**What it did NOT change.** Nothing visual. This is a route, not a design input.
---
## Shopify — React Native Skia, Atlas
`https://shopify.github.io/react-native-skia/docs/shapes/atlas/` · fetched
**Principle.** "The Atlas component is used for efficient rendering of multiple instances of the same texture or image", for "a very large number of similar objects", and "Atlas transforms can be animated with near-zero cost using worklets".
**What it changed.** THIS IS THE FEASIBILITY ANSWER FOR THE AMBIENT FIELD, and it arrived because the field was designed to need it. Because the contours are BUILD-TIME CONSTANTS, the whole field is a fixed set of sprites whose only per-frame change is a transform — which is precisely the case Atlas exists for. `D2R_IMPLEMENTATION_FEASIBILITY.md` §2.
**What it did NOT change.** The design. The field was already static before this was read; the reference told us what that buys, not what to draw.
---
## Shopify — React Native Skia, Blur image filter
`https://shopify.github.io/react-native-skia/docs/image-filters/blur/` · fetched
**Principle.** Blur takes a Gaussian sigma and a TileMode; `decal` is the default and governs what happens where the kernel runs off the input.
**What it changed.** The light sources carry a 3.4 px Gaussian in this proof, which maps to a sigma and a tile mode rather than to a CSS filter; recorded in the port table with the note that `decal` is the correct mode for a source that must fade to nothing at its edge.
**What it did NOT change.** The magnitude. 3.4 px is a proof value and is listed as an implementation craft parameter, not a token.
---
## Design Tokens Community Group — format specification status
`https://github.com/design-tokens/community-group` · fetched (the specification site itself could not be reached from this host — see below)
**Principle.** The DTCG format reached STABLE at version 2025.10, published 2025-10-28.
**What it changed.** Confirms the version the emitted resolver declares. It is the same `$schema` and the same `version` string the FROZEN I-08B3.1-C3 resolver already carries, so D2 extends that tree at its own declared version rather than introducing a second one.
**What it did NOT change.** The token shapes, which are copied from the C3 tree's own conventions — the colour object with `colorSpace`, `components` and `hex`, the `{alias}` syntax, and `$extensions` for provenance.

**Limitation.** HONESTLY RECORDED: `tr.designtokens.org` and `www.designtokens.org` could not be fetched or browsed from this host — one was refused outright and the others returned nothing. The structural authority actually used is therefore the frozen C3 token tree, which is a first-party artefact of this project and declares the 2025.10 schema itself. The clause-level spec text was NOT read for this package and is not claimed to have been.
---
## What this gate does NOT claim

- **The DTCG specification text was not read clause by clause.** The site would not load from
  this host. The version and status were confirmed from the community group's own repository,
  and the structural authority actually used is the frozen I-08B3.1-C3 token tree.
- **No device measurement of any kind.** Every performance statement in
  `D2R_IMPLEMENTATION_FEASIBILITY.md` is a reading of first-party guidance plus a count taken
  from this package's own scene, and it is labelled as such at every figure.
