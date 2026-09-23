# I-08B3.1-D2R — SKILL GATE

**BLOCKING, and run before any D2 prototype existed.** Every hash below is re-derived from disk
by `source/tools/d2-gates.mjs`, which also writes `data/D2_GATE_INVENTORY.json` and **refuses
to emit if a file this gate claims to have read is not there**.

**16 specialist skills USED**, each with a concrete consequence. **5 available and
deliberately not used**, with reasons. **2 unavailable**, recorded honestly. **86 skills exist
on this host in total** and every one is listed in the inventory JSON, so "enumerate all" is a
listing rather than a selection.

A skill listed as USED without a concrete consequence does not count, and none is listed that
way here.

---

## 1. The skills that decided the work

### animate
**USED** · `~/.claude/skills/animate/SKILL.md` · 11,575 bytes · sha256 `f6317335da2662e9…`
**Read:** §1 "Should this animate at all?" — the frequency table; §2 the six permitted purposes; §5 easing and duration; §7 reduced motion; "Never Ship"
**Principle.** Decide whether it animates at all before deciding anything else, and let the frequency tier bound how much motion the moment may have.

**What it changed, concretely:**

- THIS IS WHY THE AMBIENT FIELD DOES NOT MOVE. The table's top tier — "100+ times/day" — reads "No animation. Ever. Stop here." Ambient is not seen a hundred times a day; it is on screen the whole time the product is open, which is OFF the top of that table. The world is therefore rich and completely still, and the richness comes from form: `source/scene/d2-world.mjs`, and check R1 measures 162 resting frames that are byte-identical.
- Each category names its purpose in one of the six words before it was built — AMBIENT is not on the list at all and is not an animation; CONNECTION, PATTERN and INSIGHT are all STATE INDICATION. `D2R_DESIGN_RATIONALE.md` §2.
- Every "Never Ship" row is walked by hand in `D2R_SKILL_GATE.md` §3, because the skill that automates that review cannot be invoked on this host.

---
### animation-vocabulary
**USED** · `~/.claude/skills/animation-vocabulary/SKILL.md` · 13,128 bytes · sha256 `d718b48fe3c78988…`
**Read:** Glossary — "Looping & Ambient Motion"; "Polish & Effects"; "Transitions Between States"; "Principles to Know"
**Principle.** Name the effect with the term the craft already has, so a direction can be checked against what it claims to be — and so a prohibited effect is recognised when it is arrived at under a friendlier name.

**What it changed, concretely:**

- THE DECISIVE FINDING FOR AMBIENT. Every term the craft has for making a static thing feel alive — Pulse, Float, Orbit, Idle animation, Loop, Alternate, Marquee, Shimmer — is in ONE glossary section, "Looping & Ambient Motion", and the brief forbids every one of them by name or by effect. There was no vocabulary left for "make the rings feel alive", which is what a missing word usually means.
- The three meaning events are named in the glossary's own terms in `D2R_MOTION_AND_REDUCED_MOTION.md` §2: PATTERN is ORCHESTRATION of a LINE DRAWING and deliberately WITHOUT a STAGGER — the glossary's default is the one thing this category inverts, because a stagger is an ORDER and a member set has none; INSIGHT is a REVEAL bridged by BLUR with FOLLOW-THROUGH; AMBIENT is PARALLAX over a static field, which is in the SCROLL section and not the looping one.

---
### emil-design-eng
**USED** · `~/.claude/skills/emil-design-eng/SKILL.md` · 27,226 bytes · sha256 `e71de849347050c2…`

Also present at `E:/QANDEEL/QANDEEL PROJECT/.claude/skills/emil-design-eng/SKILL.md`, byte-identical.
**Read:** "Use blur to mask imperfect transitions"; "clip-path for Animation"; "Asymmetric enter/exit timing"; "Review Checklist"; "Debugging Animations"
**Principle.** A transient blur bridges a crossing so the eye reads ONE transformation instead of two objects swapping. A clipped reveal produces a state change no per-property timing can match.

**What it changed, concretely:**

- INSIGHT'S EMERGENCE IS THAT BRIDGE. The new conclusion is genuinely crossing from not-existing to existing, so a blur peaks in the middle of the crossing and is exactly zero at both ends — `nodeBlur`, 0.9 px at full. It is the one place in D2 that a blur is animated at all, and it is removed entirely under reduced motion.
- THE STRUCTURE IS A REVEAL, NOT A BRIGHTENING. The pattern's four membership links and the insight keel are drawn — dash-offset reveals — and arrive at exactly `qandeel.analysis.relation`. Neither is ever brighter than that at any millisecond. The four links share ONE draw channel, so the reveal cannot acquire an order.
- The asymmetric envelope is inherited from D1 with its inversion of the checklist row intact, and the reason restated where a reader meets it: here the "exit" is the world returning to rest after an answer, and a snappy one reads as the insight being retracted.

---
### find-animation-opportunities
**USED** · `~/.claude/skills/find-animation-opportunities/SKILL.md` · 9,491 bytes · sha256 `91c1243164057fbf…`
**Read:** "Operating Posture" — expect to reject most candidates; "The Gate" §1 Frequency, §3 Speed, §4 Function; "Part 2 — Rejected candidates (REQUIRED)"
**Principle.** Expect to reject most candidates, and PUBLISH the rejections. A moment that only works as a slow showy animation fails the gate.

**What it changed, concretely:**

- `D2R_TRUTH_AUDIT.md` §6 carries a REJECTED-INGREDIENTS list in this skill's own format — seven things that were considered for this system and dropped, each with the gate question that killed it. Breathing rings and a per-topic idle drift are the first two, and they are the ideas this brief most invites.
- It is also why the pattern's light was rebuilt after the first render: "does motion help or hinder here?" is answerable only by looking, and the first version helped nothing.

---
### animate-expo
**USED** · `~/.claude/skills/animate-expo/SKILL.md` · 17,564 bytes · sha256 `2121fc72ffa47649…`
**Read:** §1 the two runtimes; §3 "Pick the tool" — the Skia row; §4 properties and BlurView; §8 haptics; §9 reduced motion; "Judging feel in Expo Go or the simulator"
**Principle.** Keep motion on the UI runtime. Never animate a blur's intensity on Android. Feel is judged on a release build on the slowest device you support, and nothing else counts.

**What it changed, concretely:**

- THE AMBIENT FIELD IS SPECIFIED AS ONE CANVAS, NOT AS RINGS. Eight topics x up to three contours x a fill is around thirty vector nodes before any event; the skill's tool table sends "a huge animated scene" to Skia precisely so the view hierarchy stops being the bottleneck. `D2R_IMPLEMENTATION_FEASIBILITY.md` §2.
- INSIGHT'S BRIDGING BLUR IS SPECIFIED FOR PRODUCTION AS A CROSSFADE BETWEEN TWO PRE-RENDERED LAYERS, not as an animated filter radius — the pattern this skill forbids on Android. The proof animates the radius because a proof can; the specification does not.
- NO HAPTIC ANYWHERE, and that is a decision rather than an omission. §8 is explicit that a haptic fires one per USER ACTION and "never on an entrance animation the user did not cause". All three meaning events are QANDEEL understanding something, which is exactly that.

---
### react-native-best-practices
**USED** · `~/.claude/skills/react-native-best-practices/SKILL.md` · 4,489 bytes · sha256 `2cafec6f98199a23…`
**Read:** "Critical Rules"; the reference table
**Principle.** Software Mansion's production patterns; load the reference for the topic at hand.

**What it changed, concretely:**

- Routed to `references/animations` and `references/svg`, both read and recorded below.

---
### react-native-best-practices/references/animations
**USED** · `~/.claude/skills/react-native-best-practices/references/animations/SKILL.md` · 3,745 bytes · sha256 `cbf41937f716feb6…`
**Read:** the reference index; "Critical Rules"
**Principle.** Load the reference for the question: Skia for canvas scenes, performance for fps and accessibility.

**What it changed, concretely:**

- Routed to `canvas-animations.md` and `animations-performance.md`, both recorded below.

---
### react-native-best-practices/references/animations/animations-performance.md
**USED** · `~/.claude/skills/react-native-best-practices/references/animations/animations-performance.md` · 5,983 bytes · sha256 `7e65406d6dc1d09c…`
**Read:** "Simultaneous Animation Limits"; "Prefer Non-Layout Properties"; "Accessibility" — useReducedMotion, ReducedMotionConfig, and the per-animation behaviour table
**Principle.** Roughly 100 animated components on low-end Android and 500 on iOS; beyond that, Skia. Under reduced motion `withTiming` jumps to its target, entering animations jump to their endpoint, and `withRepeat` infinite DOES NOT START.

**What it changed, concretely:**

- THE THIRD INDEPENDENT ARGUMENT FOR A STILL FIELD, and the most mechanical one: a world whose life came from `withRepeat` breathing would arrive DEAD for every user who has reduced motion enabled. Richness that a preference can switch off was never richness.
- THE REDUCED-MOTION COUNTERPARTS ARE SEPARATE FUNCTIONS, NOT A FLAG, for the reason this table makes unarguable: a global `ReduceMotion.System` would not make an arrival gentler, it would make it a CUT. `source/scene/d2-events.mjs` carries real counterparts and check C8 proves each reaches the same settled meaning.
- The component budget is the reason the ambient field is one Skia canvas rather than thirty animated views — `D2R_IMPLEMENTATION_FEASIBILITY.md` §2 counts them.

---
### react-native-best-practices/references/animations/canvas-animations.md
**USED** · `~/.claude/skills/react-native-best-practices/references/animations/canvas-animations.md` · 14,623 bytes · sha256 `039a49b67158542f…`
**Read:** "Reanimated Integration" — Group blendMode; "Color Interpolation" — interpolateColors; "Path Animations" — usePathValue / usePathInterpolation; "Rules" — Group transform origin, radians, Canvas accessibility
**Principle.** Skia renders a whole scene to one canvas and Reanimated shared values drive its props directly. Its colour interpolation, transform origin and rotation units are NOT React Native's, and a direct port gets each of them wrong in a way that still renders.

**What it changed, concretely:**

- The `screen` blend that lights the Living Brass mark has a native equivalent — `<Group blendMode="screen">` — which is what closes an item D0R handed forward as "a CSS property react-native-svg has no engine for".
- `D2R_IMPLEMENTATION_FEASIBILITY.md` §3 names four port hazards this reference makes concrete: the renderer mixes colours every frame and must use Skia's own `interpolateColors`; the light sources are rotated about their own centres and Skia's Group origin is the top-left; every rotation in this scene is in degrees and Skia's are in radians; and a Canvas is one accessibility node, so the analytical content needs an explicit tree beside it.
- The eight contour paths are built with an IDENTICAL COMMAND COUNT by construction (`CONTOUR.samples`, one closed polyline each), which is the precondition `usePathInterpolation` states and would otherwise be discovered at integration.

---
### react-native-best-practices/references/svg
**USED** · `~/.claude/skills/react-native-best-practices/references/svg/SKILL.md` · 1,017 bytes · sha256 `92353d60d2a42cf1…`
**Read:** the whole file
**Principle.** react-native-svg implements the SVG standard as a React component tree — so every element becomes a native view.

**What it changed, concretely:**

- The basis for the react-native-svg column of the port table in `D2R_IMPLEMENTATION_FEASIBILITY.md` §3, and for the finding that this scene's node count is exactly what makes that route the wrong one.

---
### react-native-best-practices/references/animations/svg-animations.md
**USED** · `~/.claude/skills/react-native-best-practices/references/animations/svg-animations.md` · 2,236 bytes · sha256 `e5d3951ba2feaca0…`
**Read:** the whole file — createAnimatedComponent, animating a Path's `d`
**Principle.** Animate SVG through `useAnimatedProps`, converting inside the callback.

**What it changed, concretely:**

- Recorded as the fallback path in `D2R_IMPLEMENTATION_FEASIBILITY.md` §3 for the one element whose geometry genuinely changes per frame, and as the reason the CONTOURS deliberately do not: they are constants, so they never need it.

---
### apple-design
**USED** · `E:/QANDEEL/QANDEEL PROJECT/.claude/skills/apple-design/SKILL.md` · 22,715 bytes · sha256 `11840b24a11d7f94…`
**Read:** §2 direct manipulation; §3 interruptibility; §5 velocity handoff; §6 momentum projection; §11 frame-level smoothness; §14 reduced motion and accessibility; §16 the eight principles
**Principle.** An interface feels alive when motion starts from the current on-screen value, inherits the user's velocity and projects momentum forward. Reduced motion means a gentler, non-vestibular equivalent — not no feedback.

**What it changed, concretely:**

- THE AMBIENT PAN IS A GESTURE, NOT AN ANIMATION, AND IS BUILT AS ONE. The map tracks the finger 1:1 with no duration and no easing, and on release it continues at the finger's exact velocity to the position the gesture was GOING to, using Apple's own projection function — `project(v) = (v/1000)·d/(1−d)`, `d = 0.998` — which is in `source/scene/d2-world.mjs` and is a production token. That is also why the pan is not on `animate`'s frequency table: the table governs motion the SYSTEM starts.
- SECOND INDEPENDENT CITATION OF 0.2 Hz. §14 names "slow looping oscillations (near 0.2 Hz / one cycle per 5s)" among the things to avoid — the same frequency Apple's own HIG names — and four to six seconds is exactly the period a designer reaches for when they want a calm breath. The instinctive value IS the named frequency.
- Under reduced motion the parallax DIFFERENTIAL is removed rather than the parallax: every plane moves at the near rate, so there is no relative motion and the vestibular part is gone, while depth — carried by scale, luminance and contour count — is untouched.
- §16.6 "Simplicity — not minimalism" is the answer this package gives to the brief's LIFE TEST, and it is quoted where that argument is made rather than paraphrased.

---
### frontend-design
**USED** · `E:/QANDEEL/QANDEEL PROJECT/.claude/skills/frontend-design/SKILL.md` · 8,260 bytes · sha256 `1608ea77fbb6fc30…`
**Read:** "Design principles"; the calibration paragraph naming the three AI-default looks; "Restraint and self-critique"
**Principle.** Spend your boldness in ONE place and let the signature element be the one memorable thing. Machine-generated design clusters around three looks, and one of them is a near-black background with a single bright accent.

**What it changed, concretely:**

- THE BOLDNESS IS SPENT ON THE LEVEL SET. A topic is drawn as contour lines, so the world is dense, layered and specific while completely still — and everything around that is kept quiet. The shape comes from an AUTHORED PRESENTATION SEED, not from the topic: it is composition, it identifies nothing, and it promises nothing across releases, devices or users. The identity channel is the TOPIC NAME.
- THE NAMED DEFAULT IS THE ONE QANDEEL IS CLOSEST TO, and saying so changed a measurement. A near-black ground with one warm accent IS cluster (2), so this package bounds the accent rather than trusting taste: the Light's chroma is capped at 0.046 and the atmosphere below it, and check R6 reports the numbers. Restraint that is measured is a different claim from restraint that is asserted.

---
### designing-arabic-frontends
**USED** · `E:/QANDEEL/QANDEEL PROJECT/.claude/skills/designing-arabic-frontends/SKILL.md` · 13,757 bytes · sha256 `ab70493bf1b15461…`
**Read:** §1 declare an Arabic font; §2 line-height; §4 mixed-direction boundaries; §5 logical-first CSS; the letter-spacing and italics rules
**Principle.** An Arabic UI is not a Latin UI with translated strings. Arabic needs ~1.6+ leading, never letter-spacing, and logical properties.

**What it changed, concretely:**

- Every Arabic-bearing element in the prototype and on the review board is at line-height 1.7 or above, and letter-spacing exists in exactly one place on either surface — the Latin direction letter on the board, which carries no Arabic glyph.
- The board is built entirely on logical properties (`padding-inline-start`, `border-inline-start`, `margin-block`), and both surfaces declare `dir="rtl" lang="ar"` at the root because `lang` is what drives Arabic font fallback and screen-reader voice.

---
### writing-eloquent-arabic
**USED** · `E:/QANDEEL/QANDEEL PROJECT/.claude/skills/writing-eloquent-arabic/SKILL.md` · 9,513 bytes · sha256 `6a673bd773a9245b…`
**Read:** "Register: match the context"; the 8 failure modes — register-mismatch, english-word-order, calque, weak-connector
**Principle.** Arabic composed by mapping an English sentence is grammatical and reads as translated. Compose in Arabic structure; lead with the verb; bind related ideas rather than stacking full stops.

**What it changed, concretely:**

- The four «الإحساس هنا هو…» sentences and the seven Product questions are composed in Arabic, not translated from this package's English. The category descriptions lead with the verb — «يجتمع الضوء عليها»، «ينجذب الضوء… إليه» — rather than carrying an English subject-verb-object order into فصحى.
- Register is فصحى on the Product Owner surface throughout, which is the register a decision document takes; the lived-colloquial register the skill prefers for nudges would be wrong here and is not used.

---
### fixing-accessibility
**USED** · `E:/QANDEEL/QANDEEL PROJECT/.claude/skills/fixing-accessibility/SKILL.md` · 4,718 bytes · sha256 `549261e8a53b53a1…`
**Read:** §1 accessible names; §4 semantics and heading levels; §7 contrast and states; §8 media and motion
**Principle.** Prefer native semantics; never skip heading levels; every image carries alt text; respect prefers-reduced-motion for non-essential motion.

**What it changed, concretely:**

- The board's heading outline is h1 then h2 throughout with no skipped level, every image carries Arabic alt text that says what it shows rather than naming the file, every video carries `controls` and an `aria-label`, and the disclosure summaries have a visible focus ring.
- No video autoplays, and the page still cancels autoplay under a reduced-motion preference in script — because CSS cannot cancel an autoplay, and a future edit that adds one should not silently defeat the setting.

---
## 2. Available, and deliberately not used

### improve-animations
**AVAILABLE — NOT USED** · `~/.claude/skills/improve-animations/SKILL.md` · 7,915 bytes · sha256 `68f17bbc4671593d…`
**Read:** frontmatter and Operating Posture
NOT APPLICABLE. It surveys an existing codebase's motion and produces an audit plus plans for other agents to execute. There is no codebase of motion here — D2 builds four moments from scratch on a selected language. Enumerated so the omission is a decision rather than an oversight.

---
### pulsar-haptics
**AVAILABLE — NOT USED** · `~/.claude/skills/pulsar-haptics/SKILL.md` · 10,272 bytes · sha256 `fb58618ee4572ff6…`
**Read:** frontmatter
NOT APPLICABLE, DELIBERATELY. None of the four categories is user-initiated, and `animate-expo` §8 is explicit that a haptic fires one per user action and never on something the user did not cause. Recorded because a haptic on "QANDEEL understood something" is a real temptation and refusing it is a decision.

---
### impeccable
**AVAILABLE — NOT USED** · `~/.claude/skills/impeccable/SKILL.md` · 10,771 bytes · sha256 `125f732891f3f319…`
**Read:** the whole file — Setup, "How to design", Modes, Commands
AVAILABLE AND DELIBERATELY NOT RUN. Its operating model is to establish or replace a project's design artifacts (PRODUCT.md, DESIGN.md) and, on its new-work path, to treat the incumbent look as "evidence and anti-reference". QANDEEL's visual world is frozen three tracks upstream and D2 is forbidden from treating it that way; running the skill as designed would have written project files this brief does not authorise. ONE PRINCIPLE WAS TAKEN FROM IT AND IS NAMED HERE RATHER THAN CLAIMED AS USE: "verify in bounded passes, not a loop" — this package ran three bounded render-and-correct passes over the four categories and then stopped.

---
### design-critique
**AVAILABLE — NOT USED** · `E:/QANDEEL/QANDEEL PROJECT/.claude/skills/design-critique/SKILL.md` · 3,923 bytes · sha256 `3a4f260eb9f60b43…`
**Read:** frontmatter
NOT USED. It produces heuristic design feedback on a mockup. The critique D2 needed was of SEMANTIC TRUTH rather than usability heuristics, and that is what `D2R_TRUTH_AUDIT.md` is — written against the brief's own failure conditions, which are sharper here than a general heuristic set.

---
### user-research
**AVAILABLE — NOT USED** · `E:/QANDEEL/QANDEEL PROJECT/.claude/skills/user-research/SKILL.md` · 1,751 bytes · sha256 `fa18fc13d0f44aa8…`
**Read:** frontmatter
NOT APPLICABLE. No research was conducted and none is claimed.

---
## 3. Unavailable on this host

### review-animations
**UNAVAILABLE** · `~/.claude/skills/review-animations/SKILL.md` · 8,108 bytes · sha256 `61cf8ac0c4c8e1f6…`
**Read:** frontmatter only
UNAVAILABLE — CANNOT BE INVOKED. Its frontmatter carries `disable-model-invocation: true`, so it cannot be run on this host. NO review-animations PASS WAS RUN ON THIS PACKAGE, and that is recorded rather than worked around. Its bar was applied through `animate` and `emil-design-eng`, which state the same rules, and every "Never Ship" row was walked by hand in §3.

---
### prototype
**UNAVAILABLE** · `~/.claude/skills/prototype/SKILL.md` · 7,488 bytes · sha256 `2ad8401c4deaddb5…`
**Read:** frontmatter only
UNAVAILABLE — CANNOT BE INVOKED. Also carries `disable-model-invocation: true`. It would have been genuinely useful: it builds several versions of a UI piece behind a picker to flip through live, which is close to what a four-category comparison wants. The substitute used instead was a single prototype with a switchable category and a capture harness that renders any of them to an exact millisecond — weaker for feel, stronger for evidence.

---
## 4. Every "Never Ship" row in `animate`, checked by hand

`review-animations` carries `disable-model-invocation: true` and cannot be run here, so no
automated craft review passed over this package. That is stated rather than worked around. What
can be done instead is to walk its sibling's automatic-block list one row at a time:

| Never | Present here? |
|---|---|
| `transition: all` | No — there is no CSS transition anywhere. Every visual property is written imperatively from `apply(t)`; the capture harness scans the page for `@keyframes`, `animation:` and `transition:` before it keeps a single frame. |
| `transform: scale(0)` entrance | No — nothing enters by scaling. The insight node enters by opacity and a 3 px rise; the pattern's membership links by a dash reveal. |
| `ease-in` on a UI element | No — the vocabulary is the three curves I-08B3.1-D0 derived, none of which starts at zero slope and accelerates into the move. |
| Built-in `ease-out` on a deliberate animation | No — every curve is an explicit bezier or a named function, and D0 recorded why the three sanctioned house curves tear at this timescale. |
| Animation on a keyboard shortcut or a 100+/day action | **THE AMBIENT FIELD IS EXACTLY THIS CASE, AND THE ANSWER IS NO ANIMATION.** It is the reason the field is still. The three meaning events remain a Product question — how often QANDEEL claims to have understood something — and it is escalated, not answered here. |
| UI duration over 300 ms with no reason | **Yes, deliberately, with the reason recorded.** The events run 900 ms with a 2,300 ms settle. This is an analytical state change in a Living Analysis Map, not a dropdown, and D0 measured that a state change completing faster than about a quarter of a second is not SHOWN to the user, it is presented as already done. |
| `transform-origin: center` on a trigger-anchored popover | Not applicable — there is no popover. `transform-origin` is written on light sources, which are anchored to their own centres because that is where they are. |
| Keyframes on toasts, toggles, rapidly-triggered elements | Not applicable, and there are no keyframes. |
| Animating `width`/`height`/`margin`/`padding`/`top`/`left` | No in D2's own categories — the field moves by `transform`, the node by `transform`. The inherited CONNECTION writes the destination's `left`/`top` per frame and is specified as a transform for production, unchanged from D1's finding. |
| Motion `x`/`y`/`scale` props under load | Not applicable — no Motion, no React. |
| Ungated `:hover` motion | No — there is no hover anywhere, which is also why the navigation family's state-invariance is proved on pixels rather than on the absence of a hover rule. |
| Missing `prefers-reduced-motion` | No — four real counterparts, captured, encoded and compared, with one of them correcting an inherited defect. |
| Everything entering at once | **In PATTERN, YES — deliberately, and it is the one house default this package inverts.** The four membership links appear SIMULTANEOUSLY and identically, because a stagger is an ORDER and a member set has none; staggering them would have drawn a sequence the Product does not have. The inversion is declared in `D2R_MOTION_AND_REDUCED_MOTION.md` §2 rather than quietly taken, and check C5 asserts every member carries an equal level at every frame. Elsewhere the rule holds: the insight's beats are 430 ms and 900 ms apart. |

---

## 5. What this gate does NOT claim

- **No `review-animations` pass was run**, and no `prototype` session either. Both are disabled
  for model invocation on this host.
- **No device.** Feel is judged on a release build on the slowest supported device and nothing
  else counts — `animate-expo`, hard rule. Nothing here has been on a phone.
- **No production implementation.** This is a visual proof. `D2R_IMPLEMENTATION_FEASIBILITY.md`
  records whether each category has a realistic native path; it does not provide one.
