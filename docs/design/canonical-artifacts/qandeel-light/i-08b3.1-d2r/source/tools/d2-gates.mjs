/**
 * I-08B3.1-D2R — THE SKILL GATE AND THE REFERENCE GATE, generated from one source.
 *
 * Both are BLOCKING and both were run before any D2 prototype existed. Every skill hash below is
 * re-derived from disk by this tool, which REFUSES TO EMIT if a file it claims to have read is
 * not there. If a skill has changed since this package was built, its hash will not match and
 * the gate should be re-read rather than believed.
 *
 * A skill listed as USED without a concrete consequence does not count, and none is listed that
 * way here. The same rule is applied to the references: each one records what it CHANGED, and
 * — because that is where the honesty usually leaks — what it did NOT change.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { isMain } from './d2-main.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..', '..');

const ROOTS = [
  ['project', 'E:/QANDEEL/QANDEEL PROJECT/.claude/skills'],
  ['user', 'C:/Users/Al Asil Stores/.claude/skills'],
  ['plugin', 'C:/Users/Al Asil Stores/.claude/plugins'],
];

function enumerateSkills() {
  const rows = [];
  const walk = (root, scope, dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { walk(root, scope, p); continue; }
      if (e.name !== 'SKILL.md') continue;
      const buf = readFileSync(p);
      const fm = (buf.toString('utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/) || [, ''])[1];
      rows.push({
        scope,
        path: p.replace(/\\/g, '/'),
        rel: p.replace(/\\/g, '/').replace(root + '/', ''),
        bytes: statSync(p).size,
        sha256: createHash('sha256').update(buf).digest('hex'),
        disableModelInvocation: /disable-model-invocation:\s*true/.test(fm),
      });
    }
  };
  for (const [scope, root] of ROOTS) if (existsSync(root)) walk(root, scope, root);
  return rows.sort((a, b) => a.rel.localeCompare(b.rel));
}

/** A file read that is NOT a SKILL.md — a skill's own reference document. */
function hashFile(p) {
  if (!existsSync(p)) return null;
  const buf = readFileSync(p);
  return { path: p.replace(/\\/g, '/'), bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') };
}

const U = 'C:/Users/Al Asil Stores/.claude/skills';
const P = 'E:/QANDEEL/QANDEEL PROJECT/.claude/skills';

export const USED = [
  {
    name: 'animate', file: `${U}/animate/SKILL.md`,
    read: '§1 "Should this animate at all?" — the frequency table; §2 the six permitted purposes; §5 easing and duration; §7 reduced motion; "Never Ship"',
    principle: 'Decide whether it animates at all before deciding anything else, and let the frequency tier bound how much motion the moment may have.',
    changed: [
      'THIS IS WHY THE AMBIENT FIELD DOES NOT MOVE. The table\'s top tier — "100+ times/day" — reads "No animation. Ever. Stop here." Ambient is not seen a hundred times a day; it is on screen the whole time the product is open, which is OFF the top of that table. The world is therefore rich and completely still, and the richness comes from form: `source/scene/d2-world.mjs`, and check R1 measures 162 resting frames that are byte-identical.',
      'Each category names its purpose in one of the six words before it was built — AMBIENT is not on the list at all and is not an animation; CONNECTION, PATTERN and INSIGHT are all STATE INDICATION. `D2R_DESIGN_RATIONALE.md` §2.',
      'Every "Never Ship" row is walked by hand in `D2R_SKILL_GATE.md` §3, because the skill that automates that review cannot be invoked on this host.',
    ],
  },
  {
    name: 'animation-vocabulary', file: `${U}/animation-vocabulary/SKILL.md`,
    read: 'Glossary — "Looping & Ambient Motion"; "Polish & Effects"; "Transitions Between States"; "Principles to Know"',
    principle: 'Name the effect with the term the craft already has, so a direction can be checked against what it claims to be — and so a prohibited effect is recognised when it is arrived at under a friendlier name.',
    changed: [
      'THE DECISIVE FINDING FOR AMBIENT. Every term the craft has for making a static thing feel alive — Pulse, Float, Orbit, Idle animation, Loop, Alternate, Marquee, Shimmer — is in ONE glossary section, "Looping & Ambient Motion", and the brief forbids every one of them by name or by effect. There was no vocabulary left for "make the rings feel alive", which is what a missing word usually means.',
      'The three meaning events are named in the glossary\'s own terms in `D2R_MOTION_AND_REDUCED_MOTION.md` §2: PATTERN is ORCHESTRATION of a LINE DRAWING and deliberately WITHOUT a STAGGER — the glossary\'s default is the one thing this category inverts, because a stagger is an ORDER and a member set has none; INSIGHT is a REVEAL bridged by BLUR with FOLLOW-THROUGH; AMBIENT is PARALLAX over a static field, which is in the SCROLL section and not the looping one.',
    ],
  },
  {
    name: 'emil-design-eng', file: `${U}/emil-design-eng/SKILL.md`,
    also: `${P}/emil-design-eng/SKILL.md`,
    read: '"Use blur to mask imperfect transitions"; "clip-path for Animation"; "Asymmetric enter/exit timing"; "Review Checklist"; "Debugging Animations"',
    principle: 'A transient blur bridges a crossing so the eye reads ONE transformation instead of two objects swapping. A clipped reveal produces a state change no per-property timing can match.',
    changed: [
      'INSIGHT\'S EMERGENCE IS THAT BRIDGE. The new conclusion is genuinely crossing from not-existing to existing, so a blur peaks in the middle of the crossing and is exactly zero at both ends — `nodeBlur`, 0.9 px at full. It is the one place in D2 that a blur is animated at all, and it is removed entirely under reduced motion.',
      'THE STRUCTURE IS A REVEAL, NOT A BRIGHTENING. The pattern\'s four membership links and the insight keel are drawn — dash-offset reveals — and arrive at exactly `qandeel.analysis.relation`. Neither is ever brighter than that at any millisecond. The four links share ONE draw channel, so the reveal cannot acquire an order.',
      'The asymmetric envelope is inherited from D1 with its inversion of the checklist row intact, and the reason restated where a reader meets it: here the "exit" is the world returning to rest after an answer, and a snappy one reads as the insight being retracted.',
    ],
  },
  {
    name: 'find-animation-opportunities', file: `${U}/find-animation-opportunities/SKILL.md`,
    read: '"Operating Posture" — expect to reject most candidates; "The Gate" §1 Frequency, §3 Speed, §4 Function; "Part 2 — Rejected candidates (REQUIRED)"',
    principle: 'Expect to reject most candidates, and PUBLISH the rejections. A moment that only works as a slow showy animation fails the gate.',
    changed: [
      '`D2R_TRUTH_AUDIT.md` §6 carries a REJECTED-INGREDIENTS list in this skill\'s own format — seven things that were considered for this system and dropped, each with the gate question that killed it. Breathing rings and a per-topic idle drift are the first two, and they are the ideas this brief most invites.',
      'It is also why the pattern\'s light was rebuilt after the first render: "does motion help or hinder here?" is answerable only by looking, and the first version helped nothing.',
    ],
  },
  {
    name: 'animate-expo', file: `${U}/animate-expo/SKILL.md`,
    read: '§1 the two runtimes; §3 "Pick the tool" — the Skia row; §4 properties and BlurView; §8 haptics; §9 reduced motion; "Judging feel in Expo Go or the simulator"',
    principle: 'Keep motion on the UI runtime. Never animate a blur\'s intensity on Android. Feel is judged on a release build on the slowest device you support, and nothing else counts.',
    changed: [
      'THE AMBIENT FIELD IS SPECIFIED AS ONE CANVAS, NOT AS RINGS. Eight topics x up to three contours x a fill is around thirty vector nodes before any event; the skill\'s tool table sends "a huge animated scene" to Skia precisely so the view hierarchy stops being the bottleneck. `D2R_IMPLEMENTATION_FEASIBILITY.md` §2.',
      'INSIGHT\'S BRIDGING BLUR IS SPECIFIED FOR PRODUCTION AS A CROSSFADE BETWEEN TWO PRE-RENDERED LAYERS, not as an animated filter radius — the pattern this skill forbids on Android. The proof animates the radius because a proof can; the specification does not.',
      'NO HAPTIC ANYWHERE, and that is a decision rather than an omission. §8 is explicit that a haptic fires one per USER ACTION and "never on an entrance animation the user did not cause". All three meaning events are QANDEEL understanding something, which is exactly that.',
    ],
  },
  {
    name: 'react-native-best-practices', file: `${U}/react-native-best-practices/SKILL.md`,
    read: '"Critical Rules"; the reference table',
    principle: 'Software Mansion\'s production patterns; load the reference for the topic at hand.',
    changed: ['Routed to `references/animations` and `references/svg`, both read and recorded below.'],
  },
  {
    name: 'react-native-best-practices/references/animations', file: `${U}/react-native-best-practices/references/animations/SKILL.md`,
    read: 'the reference index; "Critical Rules"',
    principle: 'Load the reference for the question: Skia for canvas scenes, performance for fps and accessibility.',
    changed: ['Routed to `canvas-animations.md` and `animations-performance.md`, both recorded below.'],
  },
  {
    name: 'react-native-best-practices/references/animations/animations-performance.md',
    file: `${U}/react-native-best-practices/references/animations/animations-performance.md`,
    read: '"Simultaneous Animation Limits"; "Prefer Non-Layout Properties"; "Accessibility" — useReducedMotion, ReducedMotionConfig, and the per-animation behaviour table',
    principle: 'Roughly 100 animated components on low-end Android and 500 on iOS; beyond that, Skia. Under reduced motion `withTiming` jumps to its target, entering animations jump to their endpoint, and `withRepeat` infinite DOES NOT START.',
    changed: [
      'THE THIRD INDEPENDENT ARGUMENT FOR A STILL FIELD, and the most mechanical one: a world whose life came from `withRepeat` breathing would arrive DEAD for every user who has reduced motion enabled. Richness that a preference can switch off was never richness.',
      'THE REDUCED-MOTION COUNTERPARTS ARE SEPARATE FUNCTIONS, NOT A FLAG, for the reason this table makes unarguable: a global `ReduceMotion.System` would not make an arrival gentler, it would make it a CUT. `source/scene/d2-events.mjs` carries real counterparts and check C8 proves each reaches the same settled meaning.',
      'The component budget is the reason the ambient field is one Skia canvas rather than thirty animated views — `D2R_IMPLEMENTATION_FEASIBILITY.md` §2 counts them.',
    ],
  },
  {
    name: 'react-native-best-practices/references/animations/canvas-animations.md',
    file: `${U}/react-native-best-practices/references/animations/canvas-animations.md`,
    read: '"Reanimated Integration" — Group blendMode; "Color Interpolation" — interpolateColors; "Path Animations" — usePathValue / usePathInterpolation; "Rules" — Group transform origin, radians, Canvas accessibility',
    principle: 'Skia renders a whole scene to one canvas and Reanimated shared values drive its props directly. Its colour interpolation, transform origin and rotation units are NOT React Native\'s, and a direct port gets each of them wrong in a way that still renders.',
    changed: [
      'The `screen` blend that lights the Living Brass mark has a native equivalent — `<Group blendMode="screen">` — which is what closes an item D0R handed forward as "a CSS property react-native-svg has no engine for".',
      '`D2R_IMPLEMENTATION_FEASIBILITY.md` §3 names four port hazards this reference makes concrete: the renderer mixes colours every frame and must use Skia\'s own `interpolateColors`; the light sources are rotated about their own centres and Skia\'s Group origin is the top-left; every rotation in this scene is in degrees and Skia\'s are in radians; and a Canvas is one accessibility node, so the analytical content needs an explicit tree beside it.',
      'The eight contour paths are built with an IDENTICAL COMMAND COUNT by construction (`CONTOUR.samples`, one closed polyline each), which is the precondition `usePathInterpolation` states and would otherwise be discovered at integration.',
    ],
  },
  {
    name: 'react-native-best-practices/references/svg', file: `${U}/react-native-best-practices/references/svg/SKILL.md`,
    read: 'the whole file',
    principle: 'react-native-svg implements the SVG standard as a React component tree — so every element becomes a native view.',
    changed: ['The basis for the react-native-svg column of the port table in `D2R_IMPLEMENTATION_FEASIBILITY.md` §3, and for the finding that this scene\'s node count is exactly what makes that route the wrong one.'],
  },
  {
    name: 'react-native-best-practices/references/animations/svg-animations.md',
    file: `${U}/react-native-best-practices/references/animations/svg-animations.md`,
    read: 'the whole file — createAnimatedComponent, animating a Path\'s `d`',
    principle: 'Animate SVG through `useAnimatedProps`, converting inside the callback.',
    changed: ['Recorded as the fallback path in `D2R_IMPLEMENTATION_FEASIBILITY.md` §3 for the one element whose geometry genuinely changes per frame, and as the reason the CONTOURS deliberately do not: they are constants, so they never need it.'],
  },
  {
    name: 'apple-design', file: `${P}/apple-design/SKILL.md`,
    read: '§2 direct manipulation; §3 interruptibility; §5 velocity handoff; §6 momentum projection; §11 frame-level smoothness; §14 reduced motion and accessibility; §16 the eight principles',
    principle: 'An interface feels alive when motion starts from the current on-screen value, inherits the user\'s velocity and projects momentum forward. Reduced motion means a gentler, non-vestibular equivalent — not no feedback.',
    changed: [
      'THE AMBIENT PAN IS A GESTURE, NOT AN ANIMATION, AND IS BUILT AS ONE. The map tracks the finger 1:1 with no duration and no easing, and on release it continues at the finger\'s exact velocity to the position the gesture was GOING to, using Apple\'s own projection function — `project(v) = (v/1000)·d/(1−d)`, `d = 0.998` — which is in `source/scene/d2-world.mjs` and is a production token. That is also why the pan is not on `animate`\'s frequency table: the table governs motion the SYSTEM starts.',
      'SECOND INDEPENDENT CITATION OF 0.2 Hz. §14 names "slow looping oscillations (near 0.2 Hz / one cycle per 5s)" among the things to avoid — the same frequency Apple\'s own HIG names — and four to six seconds is exactly the period a designer reaches for when they want a calm breath. The instinctive value IS the named frequency.',
      'Under reduced motion the parallax DIFFERENTIAL is removed rather than the parallax: every plane moves at the near rate, so there is no relative motion and the vestibular part is gone, while depth — carried by scale, luminance and contour count — is untouched.',
      '§16.6 "Simplicity — not minimalism" is the answer this package gives to the brief\'s LIFE TEST, and it is quoted where that argument is made rather than paraphrased.',
    ],
  },
  {
    name: 'frontend-design', file: `${P}/frontend-design/SKILL.md`,
    read: '"Design principles"; the calibration paragraph naming the three AI-default looks; "Restraint and self-critique"',
    principle: 'Spend your boldness in ONE place and let the signature element be the one memorable thing. Machine-generated design clusters around three looks, and one of them is a near-black background with a single bright accent.',
    changed: [
      'THE BOLDNESS IS SPENT ON THE LEVEL SET. A topic is drawn as contour lines, so the world is dense, layered and specific while completely still — and everything around that is kept quiet. The shape comes from an AUTHORED PRESENTATION SEED, not from the topic: it is composition, it identifies nothing, and it promises nothing across releases, devices or users. The identity channel is the TOPIC NAME.',
      'THE NAMED DEFAULT IS THE ONE QANDEEL IS CLOSEST TO, and saying so changed a measurement. A near-black ground with one warm accent IS cluster (2), so this package bounds the accent rather than trusting taste: the Light\'s chroma is capped at 0.046 and the atmosphere below it, and check R6 reports the numbers. Restraint that is measured is a different claim from restraint that is asserted.',
    ],
  },
  {
    name: 'designing-arabic-frontends', file: `${P}/designing-arabic-frontends/SKILL.md`,
    read: '§1 declare an Arabic font; §2 line-height; §4 mixed-direction boundaries; §5 logical-first CSS; the letter-spacing and italics rules',
    principle: 'An Arabic UI is not a Latin UI with translated strings. Arabic needs ~1.6+ leading, never letter-spacing, and logical properties.',
    changed: [
      'Every Arabic-bearing element in the prototype and on the review board is at line-height 1.7 or above, and letter-spacing exists in exactly one place on either surface — the Latin direction letter on the board, which carries no Arabic glyph.',
      'The board is built entirely on logical properties (`padding-inline-start`, `border-inline-start`, `margin-block`), and both surfaces declare `dir="rtl" lang="ar"` at the root because `lang` is what drives Arabic font fallback and screen-reader voice.',
    ],
  },
  {
    name: 'writing-eloquent-arabic', file: `${P}/writing-eloquent-arabic/SKILL.md`,
    read: '"Register: match the context"; the 8 failure modes — register-mismatch, english-word-order, calque, weak-connector',
    principle: 'Arabic composed by mapping an English sentence is grammatical and reads as translated. Compose in Arabic structure; lead with the verb; bind related ideas rather than stacking full stops.',
    changed: [
      'The four «الإحساس هنا هو…» sentences and the seven Product questions are composed in Arabic, not translated from this package\'s English. The category descriptions lead with the verb — «يجتمع الضوء عليها»، «ينجذب الضوء… إليه» — rather than carrying an English subject-verb-object order into فصحى.',
      'Register is فصحى on the Product Owner surface throughout, which is the register a decision document takes; the lived-colloquial register the skill prefers for nudges would be wrong here and is not used.',
    ],
  },
  {
    name: 'fixing-accessibility', file: `${P}/fixing-accessibility/SKILL.md`,
    read: '§1 accessible names; §4 semantics and heading levels; §7 contrast and states; §8 media and motion',
    principle: 'Prefer native semantics; never skip heading levels; every image carries alt text; respect prefers-reduced-motion for non-essential motion.',
    changed: [
      'The board\'s heading outline is h1 then h2 throughout with no skipped level, every image carries Arabic alt text that says what it shows rather than naming the file, every video carries `controls` and an `aria-label`, and the disclosure summaries have a visible focus ring.',
      'No video autoplays, and the page still cancels autoplay under a reduced-motion preference in script — because CSS cannot cancel an autoplay, and a future edit that adds one should not silently defeat the setting.',
    ],
  },
];

export const NOT_USED = [
  {
    name: 'improve-animations', file: `${U}/improve-animations/SKILL.md`,
    read: 'frontmatter and Operating Posture',
    why: 'NOT APPLICABLE. It surveys an existing codebase\'s motion and produces an audit plus plans for other agents to execute. There is no codebase of motion here — D2 builds four moments from scratch on a selected language. Enumerated so the omission is a decision rather than an oversight.',
  },
  {
    name: 'pulsar-haptics', file: `${U}/pulsar-haptics/SKILL.md`,
    read: 'frontmatter',
    why: 'NOT APPLICABLE, DELIBERATELY. None of the four categories is user-initiated, and `animate-expo` §8 is explicit that a haptic fires one per user action and never on something the user did not cause. Recorded because a haptic on "QANDEEL understood something" is a real temptation and refusing it is a decision.',
  },
  {
    name: 'impeccable', file: `${U}/impeccable/SKILL.md`,
    read: 'the whole file — Setup, "How to design", Modes, Commands',
    why: 'AVAILABLE AND DELIBERATELY NOT RUN. Its operating model is to establish or replace a project\'s design artifacts (PRODUCT.md, DESIGN.md) and, on its new-work path, to treat the incumbent look as "evidence and anti-reference". QANDEEL\'s visual world is frozen three tracks upstream and D2 is forbidden from treating it that way; running the skill as designed would have written project files this brief does not authorise. ONE PRINCIPLE WAS TAKEN FROM IT AND IS NAMED HERE RATHER THAN CLAIMED AS USE: "verify in bounded passes, not a loop" — this package ran three bounded render-and-correct passes over the four categories and then stopped.',
  },
  {
    name: 'design-critique', file: `${P}/design-critique/SKILL.md`,
    read: 'frontmatter',
    why: 'NOT USED. It produces heuristic design feedback on a mockup. The critique D2 needed was of SEMANTIC TRUTH rather than usability heuristics, and that is what `D2R_TRUTH_AUDIT.md` is — written against the brief\'s own failure conditions, which are sharper here than a general heuristic set.',
  },
  {
    name: 'user-research', file: `${P}/user-research/SKILL.md`,
    read: 'frontmatter',
    why: 'NOT APPLICABLE. No research was conducted and none is claimed.',
  },
];

export const UNAVAILABLE = [
  {
    name: 'review-animations', file: `${U}/review-animations/SKILL.md`,
    read: 'frontmatter only',
    why: 'UNAVAILABLE — CANNOT BE INVOKED. Its frontmatter carries `disable-model-invocation: true`, so it cannot be run on this host. NO review-animations PASS WAS RUN ON THIS PACKAGE, and that is recorded rather than worked around. Its bar was applied through `animate` and `emil-design-eng`, which state the same rules, and every "Never Ship" row was walked by hand in §3.',
  },
  {
    name: 'prototype', file: `${U}/prototype/SKILL.md`,
    read: 'frontmatter only',
    why: 'UNAVAILABLE — CANNOT BE INVOKED. Also carries `disable-model-invocation: true`. It would have been genuinely useful: it builds several versions of a UI piece behind a picker to flip through live, which is close to what a four-category comparison wants. The substitute used instead was a single prototype with a switchable category and a capture harness that renders any of them to an exact millisecond — weaker for feel, stronger for evidence.',
  },
];

/* =============================================================== the reference gate === */
export const REFERENCES = [
  {
    source: 'Apple — Human Interface Guidelines, Motion',
    url: 'https://developer.apple.com/design/human-interface-guidelines/motion',
    how: 'read in a browser; the page is client-rendered and returns an empty shell to a plain fetch',
    principle: '"Add motion purposefully, supporting the experience without overshadowing it. Don\'t add motion for the sake of adding motion." / "In apps, generally avoid adding motion to UI interactions that occur frequently." / visionOS: avoid sustained oscillation, "in particular… around 0.2 Hz because people can be very sensitive to this frequency".',
    changed: 'The 0.2 Hz figure is the first of two independent sources naming the exact frequency a "breathing ring" would land on, and it is why the ambient field is still. "Avoid motion on frequently occurring interactions" is the same argument `animate`\'s frequency table makes, from a second direction.',
    didNotChange: 'Nothing about the three meaning events. They are infrequent, purposeful and state-indicating, which is what this page asks for; it neither permits nor forbids anything D2 does with them.',
  },
  {
    source: 'Apple — Human Interface Guidelines, Accessibility',
    url: 'https://developer.apple.com/design/human-interface-guidelines/accessibility',
    how: 'read in a browser',
    principle: 'Under Reduce Motion, "ensure your app or game responds by reducing automatic and repetitive animations, including zooming, scaling, and peripheral motion", and specifically: "Replacing transitions in x-, y-, and z-axes with fades", "Avoiding animating into and out of blurs". Also: "Convey information with more than color alone."',
    changed: 'THE ONE REAL CONTRADICTION THIS GATE FOUND, and it is inside work that was already accepted. I-08B3.1-D1\'s reduced-motion counterpart KEEPS its bridging blur, for a good craft reason it states. This list says the opposite, in a document written for exactly this setting. D2 corrects that one channel — `source/scene/d2-connection.mjs`, check C2 — and reports it as a contradiction rather than folding it in. "More than colour alone" is why a topic\'s CONTOUR and its hue both come from the same identity.',
    didNotChange: 'The full-motion Connection, which is I-08B3.1-D1\'s function unmodified and is proved so at fourteen decimal places by check C1.',
  },
  {
    source: 'Material Design 3 — Motion (physics system)',
    url: 'https://m3.material.io/styles/motion/overview',
    how: 'read in a browser',
    principle: 'M3 replaced its easing-and-duration system with springs in May 2025, and splits them: SPATIAL springs "overshoot the final value and bounce into place"; EFFECTS springs are for "color and opacity animations, where there shouldn\'t be any overshoot". Three speeds each, and "larger elements may use slow".',
    changed: 'TWO THINGS. First, it is the stated reason QANDEEL Light\'s intensity is a curve and not a spring: light intensity is an EFFECT in M3\'s own sense, and an overshoot there would be the insight arriving, retracting and arriving again. Second, the speed split is why PATTERN and INSIGHT run the shared lifecycle at 1.25x while CONNECTION runs at 1.0 — they are the larger elements, and that is a reason rather than a nudge for feel.',
    didNotChange: 'QANDEEL does not adopt the spring system. Its motion is system-initiated and non-interruptible by design, which is the case springs exist for and this one is not. Recorded as a divergence with its reason rather than passed over.',
  },
  {
    source: 'Software Mansion — React Native Reanimated, Accessibility',
    url: 'https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/',
    how: 'fetched',
    principle: '`withTiming` and `withSpring` "return the toValue immediately"; entering, keyframe and layout animations "instantaneously reach their endpoints"; exiting animations and shared transitions "are omitted". `useReducedMotion` reports the setting AS IT WAS AT APP START.',
    changed: 'The reduced-motion counterparts are separate functions rather than a global flag, and `withDecay`\'s documented behaviour — return the current value immediately — is implemented literally in the ambient pan: under reduced motion the map STOPS WHERE THE FINGER LET GO rather than gliding. That is the rule\'s real behaviour, not an approximation of it.',
    didNotChange: 'The full-motion expressions. Nothing here argues for changing what a user without the setting sees.',
  },
  {
    source: 'Shopify — React Native Skia, Animations',
    url: 'https://shopify.github.io/react-native-skia/docs/animations/animations/',
    how: 'fetched',
    principle: 'Reanimated values are passed directly as Skia props — "no need for functions like createAnimatedComponent or useAnimatedProps" — and Skia ships its own `interpolateColors` because its colour storage differs from Reanimated\'s.',
    changed: 'Confirms the production path for the whole light layer runs on the UI thread with no bridge crossing per frame, and is the specific citation behind the colour-interpolation hazard in `D2R_IMPLEMENTATION_FEASIBILITY.md` §3.',
    didNotChange: 'Nothing visual. This is a route, not a design input.',
  },
  {
    source: 'Shopify — React Native Skia, Atlas',
    url: 'https://shopify.github.io/react-native-skia/docs/shapes/atlas/',
    how: 'fetched',
    principle: '"The Atlas component is used for efficient rendering of multiple instances of the same texture or image", for "a very large number of similar objects", and "Atlas transforms can be animated with near-zero cost using worklets".',
    changed: 'THIS IS THE FEASIBILITY ANSWER FOR THE AMBIENT FIELD, and it arrived because the field was designed to need it. Because the contours are BUILD-TIME CONSTANTS, the whole field is a fixed set of sprites whose only per-frame change is a transform — which is precisely the case Atlas exists for. `D2R_IMPLEMENTATION_FEASIBILITY.md` §2.',
    didNotChange: 'The design. The field was already static before this was read; the reference told us what that buys, not what to draw.',
  },
  {
    source: 'Shopify — React Native Skia, Blur image filter',
    url: 'https://shopify.github.io/react-native-skia/docs/image-filters/blur/',
    how: 'fetched',
    principle: 'Blur takes a Gaussian sigma and a TileMode; `decal` is the default and governs what happens where the kernel runs off the input.',
    changed: 'The light sources carry a 3.4 px Gaussian in this proof, which maps to a sigma and a tile mode rather than to a CSS filter; recorded in the port table with the note that `decal` is the correct mode for a source that must fade to nothing at its edge.',
    didNotChange: 'The magnitude. 3.4 px is a proof value and is listed as an implementation craft parameter, not a token.',
  },
  {
    source: 'Design Tokens Community Group — format specification status',
    url: 'https://github.com/design-tokens/community-group',
    how: 'fetched (the specification site itself could not be reached from this host — see below)',
    principle: 'The DTCG format reached STABLE at version 2025.10, published 2025-10-28.',
    changed: 'Confirms the version the emitted resolver declares. It is the same `$schema` and the same `version` string the FROZEN I-08B3.1-C3 resolver already carries, so D2 extends that tree at its own declared version rather than introducing a second one.',
    didNotChange: 'The token shapes, which are copied from the C3 tree\'s own conventions — the colour object with `colorSpace`, `components` and `hex`, the `{alias}` syntax, and `$extensions` for provenance.',
    limitation: 'HONESTLY RECORDED: `tr.designtokens.org` and `www.designtokens.org` could not be fetched or browsed from this host — one was refused outright and the others returned nothing. The structural authority actually used is therefore the frozen C3 token tree, which is a first-party artefact of this project and declares the 2025.10 schema itself. The clause-level spec text was NOT read for this package and is not claimed to have been.',
  },
];

/* ========================================================================= emit ======= */
function requireFiles(rows) {
  const missing = [];
  const out = rows.map((r) => {
    const h = hashFile(r.file);
    if (!h) missing.push(r.file);
    const also = r.also ? hashFile(r.also) : null;
    return { ...r, ...(h || {}), alsoAt: also };
  });
  if (missing.length) {
    throw new Error('d2-gates: this gate claims to have read files that are not on disk —\n  - ' + missing.join('\n  - '));
  }
  return out;
}

export const NEVER_SHIP = [
  ['`transition: all`', 'No — there is no CSS transition anywhere. Every visual property is written imperatively from `apply(t)`; the capture harness scans the page for `@keyframes`, `animation:` and `transition:` before it keeps a single frame.'],
  ['`transform: scale(0)` entrance', 'No — nothing enters by scaling. The insight node enters by opacity and a 3 px rise; the pattern\'s membership links by a dash reveal.'],
  ['`ease-in` on a UI element', 'No — the vocabulary is the three curves I-08B3.1-D0 derived, none of which starts at zero slope and accelerates into the move.'],
  ['Built-in `ease-out` on a deliberate animation', 'No — every curve is an explicit bezier or a named function, and D0 recorded why the three sanctioned house curves tear at this timescale.'],
  ['Animation on a keyboard shortcut or a 100+/day action', '**THE AMBIENT FIELD IS EXACTLY THIS CASE, AND THE ANSWER IS NO ANIMATION.** It is the reason the field is still. The three meaning events remain a Product question — how often QANDEEL claims to have understood something — and it is escalated, not answered here.'],
  ['UI duration over 300 ms with no reason', '**Yes, deliberately, with the reason recorded.** The events run 900 ms with a 2,300 ms settle. This is an analytical state change in a Living Analysis Map, not a dropdown, and D0 measured that a state change completing faster than about a quarter of a second is not SHOWN to the user, it is presented as already done.'],
  ['`transform-origin: center` on a trigger-anchored popover', 'Not applicable — there is no popover. `transform-origin` is written on light sources, which are anchored to their own centres because that is where they are.'],
  ['Keyframes on toasts, toggles, rapidly-triggered elements', 'Not applicable, and there are no keyframes.'],
  ['Animating `width`/`height`/`margin`/`padding`/`top`/`left`', 'No in D2\'s own categories — the field moves by `transform`, the node by `transform`. The inherited CONNECTION writes the destination\'s `left`/`top` per frame and is specified as a transform for production, unchanged from D1\'s finding.'],
  ['Motion `x`/`y`/`scale` props under load', 'Not applicable — no Motion, no React.'],
  ['Ungated `:hover` motion', 'No — there is no hover anywhere, which is also why the navigation family\'s state-invariance is proved on pixels rather than on the absence of a hover rule.'],
  ['Missing `prefers-reduced-motion`', 'No — four real counterparts, captured, encoded and compared, with one of them correcting an inherited defect.'],
  ['Everything entering at once', '**In PATTERN, YES — deliberately, and it is the one house default this package inverts.** The four membership links appear SIMULTANEOUSLY and identically, because a stagger is an ORDER and a member set has none; staggering them would have drawn a sequence the Product does not have. The inversion is declared in `D2R_MOTION_AND_REDUCED_MOTION.md` §2 rather than quietly taken, and check C5 asserts every member carries an equal level at every frame. Elsewhere the rule holds: the insight\'s beats are 430 ms and 900 ms apart.'],
];

function skillGateDoc(used, notUsed, unavailable, all) {
  const short = (h) => h.slice(0, 16) + '…';
  const block = (r, status) => [
    `### ${r.name}`, '',
    `**${status}** · \`${r.path.replace('C:/Users/Al Asil Stores', '~')}\` · ${r.bytes.toLocaleString()} bytes · sha256 \`${short(r.sha256)}\``,
    r.alsoAt ? `\nAlso present at \`${r.alsoAt.path}\`, ${r.alsoAt.sha256 === r.sha256 ? 'byte-identical' : `**DIFFERENT** (sha256 \`${short(r.alsoAt.sha256)}\`)`}.` : '',
    '', `**Read:** ${r.read}`, '',
    r.principle ? `**Principle.** ${r.principle}\n` : '',
    r.changed ? `**What it changed, concretely:**\n\n${r.changed.map((c) => `- ${c}`).join('\n')}\n` : '',
    r.why ? `${r.why}\n` : '',
    '---', '',
  ].filter((x) => x !== '').join('\n');

  return `# I-08B3.1-D2R — SKILL GATE

**BLOCKING, and run before any D2 prototype existed.** Every hash below is re-derived from disk
by \`source/tools/d2-gates.mjs\`, which also writes \`data/D2_GATE_INVENTORY.json\` and **refuses
to emit if a file this gate claims to have read is not there**.

**${used.length} specialist skills USED**, each with a concrete consequence. **${notUsed.length} available and
deliberately not used**, with reasons. **${unavailable.length} unavailable**, recorded honestly. **${all.length} skills exist
on this host in total** and every one is listed in the inventory JSON, so "enumerate all" is a
listing rather than a selection.

A skill listed as USED without a concrete consequence does not count, and none is listed that
way here.

---

## 1. The skills that decided the work

${used.map((r) => block(r, 'USED')).join('\n')}
## 2. Available, and deliberately not used

${notUsed.map((r) => block(r, 'AVAILABLE — NOT USED')).join('\n')}
## 3. Unavailable on this host

${unavailable.map((r) => block(r, 'UNAVAILABLE')).join('\n')}
## 4. Every "Never Ship" row in \`animate\`, checked by hand

\`review-animations\` carries \`disable-model-invocation: true\` and cannot be run here, so no
automated craft review passed over this package. That is stated rather than worked around. What
can be done instead is to walk its sibling's automatic-block list one row at a time:

| Never | Present here? |
|---|---|
${NEVER_SHIP.map(([a, b]) => `| ${a} | ${b} |`).join('\n')}

---

## 5. What this gate does NOT claim

- **No \`review-animations\` pass was run**, and no \`prototype\` session either. Both are disabled
  for model invocation on this host.
- **No device.** Feel is judged on a release build on the slowest supported device and nothing
  else counts — \`animate-expo\`, hard rule. Nothing here has been on a phone.
- **No production implementation.** This is a visual proof. \`D2R_IMPLEMENTATION_FEASIBILITY.md\`
  records whether each category has a realistic native path; it does not provide one.
`;
}

function referenceGateDoc(refs) {
  return `# I-08B3.1-D2R — REFERENCE GATE

**MANDATORY, and the one gate in this package that changed an already-accepted decision.**

${refs.length} first-party sources. For each: what was read, what it CHANGED in QANDEEL, and —
because this is where honesty usually leaks — what it did **not** change. No secondary blog is
cited anywhere; where a first-party source could not be reached, that is recorded as a
limitation rather than substituted.

---

${refs.map((r) => [
    `## ${r.source}`, '',
    `\`${r.url}\` · ${r.how}`, '',
    `**Principle.** ${r.principle}`, '',
    `**What it changed.** ${r.changed}`, '',
    `**What it did NOT change.** ${r.didNotChange}`,
    r.limitation ? `\n**Limitation.** ${r.limitation}` : '',
    '', '---', '',
  ].filter((x) => x !== '').join('\n')).join('\n')}
## What this gate does NOT claim

- **The DTCG specification text was not read clause by clause.** The site would not load from
  this host. The version and status were confirmed from the community group's own repository,
  and the structural authority actually used is the frozen I-08B3.1-C3 token tree.
- **No device measurement of any kind.** Every performance statement in
  \`D2R_IMPLEMENTATION_FEASIBILITY.md\` is a reading of first-party guidance plus a count taken
  from this package's own scene, and it is labelled as such at every figure.
`;
}

export function emit() {
  const all = enumerateSkills();
  const used = requireFiles(USED);
  const notUsed = requireFiles(NOT_USED);
  const unavailable = requireFiles(UNAVAILABLE);

  /* The claim about invocability is checked against the file, not taken from memory. */
  for (const r of unavailable) {
    const row = all.find((a) => a.path === r.path);
    if (!row || !row.disableModelInvocation) {
      throw new Error(`d2-gates: '${r.name}' is listed as UNAVAILABLE but its frontmatter does not carry disable-model-invocation: true`);
    }
  }

  mkdirSync(join(PKG, 'data'), { recursive: true });
  writeFileSync(join(PKG, 'D2R_SKILL_GATE.md'), skillGateDoc(used, notUsed, unavailable, all));
  writeFileSync(join(PKG, 'D2R_REFERENCE_GATE.md'), referenceGateDoc(REFERENCES));
  writeFileSync(join(PKG, 'data', 'D2_GATE_INVENTORY.json'), JSON.stringify({
    generated: 'source/tools/d2-gates.mjs',
    skillsOnHost: all.length,
    used: used.map(({ changed, ...r }) => r),
    notUsed, unavailable,
    references: REFERENCES,
    inventory: all,
  }, null, 2) + '\n');
  return { all, used, notUsed, unavailable };
}

if (isMain(import.meta.url)) {
  console.log('D2 GATES');
  const r = emit();
  console.log(`  ${r.all.length} skills on this host, all enumerated and hashed`);
  console.log(`  ${r.used.length} USED with concrete consequences`);
  console.log(`  ${r.notUsed.length} available and deliberately not used`);
  console.log(`  ${r.unavailable.length} unavailable — ${r.unavailable.map((u) => u.name).join(', ')} (disable-model-invocation, verified on the file)`);
  console.log(`  ${REFERENCES.length} first-party references, each with what it changed and what it did not`);
  console.log('  wrote D2R_SKILL_GATE.md, D2R_REFERENCE_GATE.md, data/D2_GATE_INVENTORY.json');
}
