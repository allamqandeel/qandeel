# I-08B3.1-F1 — SKILL GATE

**GENERATED from `data/F1_SKILLS.json` by `tools/f1-skills.mjs`.** Every row below is a
file hashed on the executing host, not a name recalled from a listing.

**STATE: PASS.** 90 skill files enumerated from disk across all three
scopes — the project `.claude/skills`, the user `~/.claude/skills`, and `~/.claude/plugins`.

> **P-STATE.** The recorded skills live on the executing host and shipping them would
> redistribute someone else's files, so a re-run on another machine returns
> `UNVERIFIABLE` rather than PASS or FAIL. A probe feeds that branch a synthetic empty
> inventory on every run: **UNVERIFIABLE — EXTERNAL SKILL SOURCE NOT PRESENT**

## USED — with the principle read and the concrete consequence in F1

### fixing-accessibility

`E:\QANDEEL\QANDEEL PROJECT\.claude\skills\fixing-accessibility\SKILL.md`

`sha256 549261e8a53b53a1a20c0ddbf736821e5fc0876ad82eee76e0efab8e9ee9dadf` · 4718 B

**Evidence read.** §8 media and motion — "respect prefers-reduced-motion for NON-ESSENTIAL motion"; §7 contrast and states — "disabled states must not rely on color alone", "do not remove focus outlines without a visible replacement"; §5 forms and errors — "disabled submit actions must explain why", errors linked by aria-describedby; §1 accessible names — every interactive control must have one; §6 — "toasts must not be the only way to convey critical information".

**Concrete consequence.** THE WORD "NON-ESSENTIAL" IS THE HINGE OF PART A. It is what licenses a motion audit by CATEGORY rather than a global switch, and it is why tools/f1-motion.mjs classifies eleven motions into KEEP / REDUCE / REPLACE / REMOVE instead of reporting "reduced motion: supported". §5 and §7 together are why the UNAVAILABLE row in every board carries a REASON in words, carried by aria-describedby on a real control rather than as a board caption — and why qandeel.accessibility.nonColorCue.unavailable is "ink+stated-reason" rather than just the ink. §1 is what check R-01 asserts, per object, against the tree the browser engine computed.

### apple-design

`E:\QANDEEL\QANDEEL PROJECT\.claude\skills\apple-design\SKILL.md`

`sha256 11840b24a11d7f94f39c6aaab074750ae4e4de4ef54ee4b1dd97e16ebd485e61` · 22715 B

**Evidence read.** §14 Reduced motion & accessibility — "Reduced motion doesn't mean NO feedback — it means a gentler, non-vestibular equivalent", and the THREE INDEPENDENT SIGNALS: prefers-reduced-motion, prefers-reduced-transparency, prefers-contrast: more, with "near-solid backgrounds with a defined, contrasting border" for the last; also "avoid slow looping oscillations (near 0.2 Hz)". §12 Materials — "Never stack a light translucent surface on another"; material weight encodes hierarchy. §15 Typography — "Respect the user's text-size setting. Scale layout WITH the text — spacing in rem/em, not fixed px."

**Concrete consequence.** THREE STRUCTURAL CONSEQUENCES. (1) THREE SIGNALS, THREE MODIFIERS — the resolver has a contrast modifier and a transparency modifier and deliberately does NOT have a motion one, because motion resolves to no colour; that split is this section's shape applied honestly rather than copied. (2) "A DEFINED, CONTRASTING BORDER" IS WHY qandeel.accessibility.contrast.boundary EXISTS AT ALL. Without it the increased-contrast expression would have had no answer for a World and a functional Surface separated by 1.072:1, and the tempting answer — lighten the Surface — would have moved a frozen value. (3) The 0.2 Hz line is why the ambient field's STILLNESS is recorded in the motion inventory as a decision already taken rather than as an absence.

### animate-expo

`C:\Users\Al Asil Stores\.claude\skills\animate-expo\SKILL.md`

`sha256 2121fc72ffa476492c1b91ccf96c7b26aade9d1a332dc5834ba3526e1102b00d` · 17564 B

**Evidence read.** §9 Reduced motion and accessibility — "Reduced motion means FEWER AND GENTLER, not zero: keep opacity and color changes that explain a state change, drop translation, scale, parallax and overshoot"; the useReducedMotion / ReduceMotion.System API; and "Text scales. allowFontScaling is on by default, so any height you measured at default type size is wrong at 200%. Never animate to a hardcoded height." §7 Press — feedback on press-in; 44x44pt minimum target.

**Concrete consequence.** THE CHANNEL MODEL IS THIS SENTENCE TURNED INTO TOKENS. "Keep opacity and colour changes, drop translation, scale, parallax and overshoot" is exactly qandeel.accessibility.motion.{level,ink,draw} = 1 against {travel,scale,parallax-differential,decay,blur} = 0. And §9's SCALE clause is the reason F1 added interaction.press to a table D2R left implicit, splitting one behaviour into a ground response that survives and a scale that goes. The allowFontScaling note is why qandeel.accessibility.text.label-escape-scale exists as a LAYOUT switch rather than as a font-size clamp.

### react-native-best-practices / references/animations/animations-performance.md

`C:\Users\Al Asil Stores\.claude\skills\react-native-best-practices\references\animations\animations-performance.md`

`sha256 7e65406d6dc1d09c3fc60ea051b62870ba0cf4498c18e35c6c3c173b3bad385e` · 5983 B

**Evidence read.** The ACCESSIBILITY section: the full per-animation-type behaviour table under reduced motion — withSpring/withTiming "jump to toValue immediately", withRepeat infinite "do not start", "Exiting / shared element transitions — OMITTED ENTIRELY"; and "useReducedMotion returns true if the device has reduced motion enabled AT APP START. Does not update at runtime if the user changes the setting."

**Concrete consequence.** THE SINGLE MOST LOAD-BEARING SKILL LINE IN THIS PACKAGE, AND IT WENT AGAINST THE OBVIOUS DESIGN. The obvious implementation of Reduced Motion is a global <ReducedMotionConfig mode={ReduceMotion.System} />. This table says that global default DELETES the exit — and QANDEEL's exit is the 1,150 ms settle that carries the result. So the token file carries a scalar literally named system-default-is-wrong-here, tools/f1-motion.mjs ships RUNTIME_DEFAULT with the documented behaviour quoted and four specific remedies, check M-03 asserts the record contains the omitted-exit row, and Board D states it. Without this file F1 would have shipped a contract that the runtime silently violates.

### designing-arabic-frontends

`C:\Users\Al Asil Stores\.claude\plugins\cache\sibawayh\sibawayh\0.1.0\skills\designing-arabic-frontends\SKILL.md`

`sha256 ab70493bf1b15461ab5ff6cba9848871e27a7e5144042b7458d566070c2d87b2` · 13757 B

**Evidence read.** §2 Line-height — "Arabic ascenders, descenders, and diacritics need ~1.6+ line-height… clipping risk DOUBLES with truncate (overflow-hidden)"; §5 — "letter-spacing: never on Arabic"; "No italics on Arabic"; logical-first CSS; §1 — avoid weights 100–300, use 400–700; §4 — "lang matters as much as dir: it drives OS/browser Arabic font fallback and SCREEN-READER VOICE SELECTION"; §7 — "Arabic counted nouns: 3–10 take the plural".

**Concrete consequence.** FOUR, AND ONE OF THEM CHANGED AN ANSWER. (1) The line-height clause plus the TRUNCATE clause together are why Part E's answer to a growing label is a SEPARATE INSPECTION VIEW and never a truncation — the skill says the clipping risk doubles exactly where the tempting fix lives. (2) letter-spacing and italics are absent from every stylesheet F1 emits, and the absence is stated in the CSS so a reviewer can see it is deliberate. (3) lang="ar" on the projection root is a SCREEN-READER decision, not a font one, and it is in Part F because of this sentence. (4) The counted-noun rule caught a defect: the projection summary read «1 علاقة، 1 نمط», an English sentence in Arabic words. tools/f1-sr.mjs now carries an arabicCount() with the 1 / 2 / 3–10 / 11+ rules and gender agreement, and the line reads «8 مواضيع، علاقة واحدة، نمط واحد، وفهم جديد واحد».

### writing-eloquent-arabic

`C:\Users\Al Asil Stores\.claude\plugins\cache\sibawayh\sibawayh\0.1.0\skills\writing-eloquent-arabic\SKILL.md`

`sha256 6a673bd773a9245bd38f817edee4687fbf1d92612f680c80aa33f9b67e96150d` · 9513 B

**Evidence read.** The register table — فصحى for errors and consent; the failure modes, in particular calque structure and robotic tone; and the principle that Arabic copy is written in Arabic structure rather than translated.

**Concrete consequence.** THE PATTERN SENTENCE IS COPY AND IT IS LOAD-BEARING. A PATTERN is the largest accessibility obligation QANDEEL creates — a locus and four links is not readable to anyone who cannot see them — so the sentence that replaces it had to be written rather than assembled. It reads «نمط يجمع 4 مواضيع: «…» و«…»», where يجمع frames the pattern as GATHERING a set rather than as ordering a list, and the members are joined by و, which carries no ordinal reading. A comma-separated list in Arabic would have implied a sequence the Product does not have.

### impeccable / reference/craft-floor.md

`C:\Users\Al Asil Stores\.claude\skills\impeccable\reference\craft-floor.md`

`sha256 96e2e6bd4fcf9a2c6da65fb029f96d9176308fae2efd9d8653d3b8d838960e07` · 4484 B

**Evidence read.** Verify → Motion: "Reach past transform and opacity: blur, backdrop-filter, clip-path, mask, and shadow belong to the palette when they stay smooth." Verify → Contrast: "On colored surfaces tint secondary text from that hue or the foreground; never gray." Verify → States: "hover, disabled, loading, error, empty. Plus real content, working controls, responsive composition, keyboard focus."

**Concrete consequence.** THE MOTION LINE IS WHY "DRAW" IS A SURVIVING CHANNEL AND NOT AN OVERSIGHT. The naive reduced-motion palette is opacity only; this line says a clip-path or mask REVEAL is a legitimate technique, and a reveal at a fixed position is not vestibular motion. qandeel.accessibility.motion.draw = 1 is that distinction, and it is what lets a PATTERN's membership links and an INSIGHT's keel still ARRIVE rather than simply appear. The States line is why the interaction strip on every board carries six rows rather than an illustrative two.

### ui-ux-pro-max / data/ux-guidelines.csv

`C:\Users\Al Asil Stores\.claude\plugins\cache\ui-ux-pro-max-skill\ui-ux-pro-max\2.13.0\.claude\skills\ui-ux-pro-max\SKILL.md`

`sha256 ea087c341bfb5b23195c7302027268ede86da802554c18a5c4896a6017b439f9` · 15969 B

**Evidence read.** Rows 99–103 of data/ux-guidelines.csv, which are WCAG 2.2 specific: Focus Not Obscured (Minimum, AA) and (Enhanced, AAA); Focus Appearance (AAA, "an indicator at least as large as a 2 CSS px perimeter with 3:1 state contrast"); and row 103, DRAGGING MOVEMENTS — "WCAG 2.2 AA requires a single-pointer alternative for author-controlled drag operations… Make dragging the only way to reorder resize or select" is the failure.

**Concrete consequence.** ROW 103 FOUND AN OBLIGATION NOTHING ELSE IN THE STACK NAMED. The Living Analysis Map's camera is panned by dragging, and SC 2.5.7 requires a single-pointer alternative for it. That is not a motion question and not a contrast question, so no other part of this brief would have surfaced it. It is recorded in F1_KNOWN_LIMITATIONS.md and in the F2/Product carry-forward as an open obligation on the camera, alongside SC 2.3.3 — and the camera row in the motion inventory carries the disposition CARRY FORWARD rather than a design F1 is forbidden to make. Row 102 is why the increased-contrast focus perimeter is described as strengthening something that already passes rather than repairing something that fails.

## INSPECTED — NOT APPLICABLE

| skill | copies hashed | why it was not applied |
|---|---|---|
| animate | `f6317335da26` 11575 B | Read for its reduced-motion section. It is the WEB sibling of animate-expo and its guidance here is the same; the RN-specific runtime behaviour that changed F1's design came from animations-performance.md, so crediting this file would overstate it. |
| animation-vocabulary | `d718b48fe3c7` 13128 B | Read. I-08B3.1-D2R already named every QANDEEL motion in this glossary's own vocabulary — PARALLAX, ORCHESTRATION, LINE DRAWING, REVEAL, FOLLOW-THROUGH — and F1 inherits those names rather than renaming anything. Nothing here changed a disposition. |
| improve-animations | `68f17bbc4671` 7915 B | Read. It plans codebase-wide motion audits and produces implementation plans for other agents. F1 audits a frozen PROOF system it may not modify, so the output shape does not apply. |
| find-animation-opportunities | `91c124316405` 9491 B | Read. It proposes motion where none exists. §19 forbids F1 from designing any new motion, so applying it would have produced work the brief rejects. |
| emil-design-eng | `e71de8493470` 27226 B<br>`e71de8493470` 27226 B | Read. Its subject is component-level polish and the feel of interaction. F1 changes no component and adds no interaction; the interaction grammar is E1's and is inherited unchanged. |
| frontend-design | `d91970639e9f` 9390 B<br>`d91970639e9f` 9390 B<br>`d91970639e9f` 9390 B<br>`1608ea77fbb6` 8260 B | Read, in BOTH installed copies — the project copy and the plugin-cache copy differ in content and both are hashed below. Its subject is choosing a visual direction. F1 has no direction to choose: every value it may touch is either frozen or derived by search. |
| react-native-best-practices | `2cafec6f9819` 4489 B | Read as the index that routes to references/animations/. The routing file itself changed nothing; the reference it pointed to changed a great deal, and is credited under USED separately. |
| react-navigation | `f127331ac68f` 3419 B | Read for its safe-area and header guidance under larger text. QANDEEL's navigation morphology is unreconciled and out of scope for F1 — E1 recorded that — so applying it would have decided something F1 has no authority over. |
| react-native-tv-best-practices | `46b4524c57ce` 11166 B | Read specifically for its FOCUS guidance, since a D-pad product has the strictest focus requirements of any. Its model is directional focus between spatially adjacent elements, which depends on geometry meaning something. In QANDEEL geometry means nothing, so the model does not transfer. |
| pulsar-haptics | `fb58618ee457` 10272 B | Read, and the reason is specific: haptics are a NON-VISUAL channel, and Apple's Motion page says to "supplement visual feedback by also using alternatives like haptics and audio". A haptic could in principle carry a meaning event under Reduced Motion. NOT APPLIED, because animate-expo's rule is absolute — "never the only feedback… haptics are off system-wide for many users, and silent on most Android hardware" — so a haptic could only ever be additive, and adding one would be designing new feedback, which §19 forbids. Recorded as an F2/Product option rather than taken. |
| design-critique | `3a4f260eb9f6` 3923 B | Not opened for application. Independent Product and Design review owns the critique of this package, and inviting a second opinion into the execution would blur who decided what. |
| user-research | `fa18fc13d0f4` 1751 B | Read. It plans research with people. No user was involved in F1 and none could be on this host; the absence is recorded in F1_KNOWN_LIMITATIONS.md rather than papered over with a method. |
| prototype | `2ad8401c4dea` 7488 B<br>`2ad8401c4dea` 7488 B | Read. F1 ships rendered proofs and a token contract rather than an interactive prototype; the boards are the deliverable §22 asks for. |
| react-native-best-practices / references/animations/canvas-animations.md | `039a49b67158` 14623 B | Read — this is the Skia coverage the brief asks about, and it exists under this name rather than as a skill of its own. Read for ONE fact: a Skia Canvas is a single opaque node to an accessibility API, so analytical content cannot live only inside it. That fact is already the inherited I-08B3.1-D2R §5 constraint, so it is credited there and restated as qandeel.accessibility.projection.canvas rather than claimed as new here. |
| review-animations | `61cf8ac0c4c8` 8108 B | PRESENT ON THIS HOST AND HASHED BELOW, BUT NOT INVOCABLE. It carries disable-model-invocation, and the Skill tool refuses it with "Ask the user to run /review-animations themselves — it cannot be invoked via the Skill tool. Do not replicate this skill's workflow by other means." §20 names motion review as a relevant category, so this is said plainly rather than worked around: the file was not opened and its checklist was not reconstructed. animate-expo and react-native-best-practices/references/animations cover the runtime and reduced-motion ground, and both are credited above. |

> **`frontend-design` is installed in more than one scope with DIFFERENT content.** Every
> copy is hashed above rather than the name being treated as one thing.

## NOT AVAILABLE

| named | why it is listed |
|---|---|
| dataviz | Not installed on this host under any scope — the inventory below is the evidence. Listed because a reader may expect it: F1 paints no chart and encodes no quantity, so its absence changes nothing. |
| an Android-accessibility skill | None exists on this host under any name. Android guidance in F1 comes entirely from the Reference Gate — the React Native AccessibilityInfoModule.kt source on the main branch — and F1_PLATFORM_MAPPING.md says so rather than implying a skill covered it. |
| a screen-reader-semantics skill | None exists on this host. The VoiceOver model in Part F comes from Apple's VoiceOver HIG page and from the browser accessibility tree, both recorded in the Reference Gate. |

## The full inventory

| sha256 | bytes | path |
|---|---|---|
| `d91970639e9f5c37` | 9390 | `C:\Users\Al Asil Stores\.claude\plugins\cache\claude-plugins-official\frontend-design\85cce0381e78\skills\frontend-design\SKILL.md` |
| `d91970639e9f5c37` | 9390 | `C:\Users\Al Asil Stores\.claude\plugins\cache\claude-plugins-official\frontend-design\unknown\skills\frontend-design\SKILL.md` |
| `ab70493bf1b15461` | 13757 | `C:\Users\Al Asil Stores\.claude\plugins\cache\sibawayh\sibawayh\0.1.0\skills\designing-arabic-frontends\SKILL.md` |
| `6a673bd773a9245b` | 9513 | `C:\Users\Al Asil Stores\.claude\plugins\cache\sibawayh\sibawayh\0.1.0\skills\writing-eloquent-arabic\SKILL.md` |
| `ea087c341bfb5b23` | 15969 | `C:\Users\Al Asil Stores\.claude\plugins\cache\ui-ux-pro-max-skill\ui-ux-pro-max\2.13.0\.claude\skills\ui-ux-pro-max\SKILL.md` |
| `4fc3da872e033c37` | 4357 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\external_plugins\discord\skills\access\SKILL.md` |
| `9364d7895d6f38b9` | 4324 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\external_plugins\discord\skills\configure\SKILL.md` |
| `ac994a86aab3a272` | 4754 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\external_plugins\imessage\skills\access\SKILL.md` |
| `3afdc7e9faa36aa0` | 3546 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\external_plugins\imessage\skills\configure\SKILL.md` |
| `6c87f59841c55a4a` | 4463 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\external_plugins\telegram\skills\access\SKILL.md` |
| `16b06bf2ac5ede25` | 4308 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\external_plugins\telegram\skills\configure\SKILL.md` |
| `441c57e26f0931b6` | 10995 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\claude-code-setup\skills\claude-automation-recommender\SKILL.md` |
| `b06c7420be08ca1c` | 6028 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\claude-md-management\skills\claude-md-improver\SKILL.md` |
| `7e7b345240a34339` | 5246 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\claude-security\skills\claude-security\SKILL.md` |
| `dae31d1459c8ee7b` | 1887 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\cwc-makers\skills\cardputer-buddy\SKILL.md` |
| `c6ba88fd06f59a3e` | 23913 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\cwc-makers\skills\m5-onboard\SKILL.md` |
| `d561981660827f38` | 1226 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\example-plugin\skills\example-command\SKILL.md` |
| `87d90442621ace03` | 2725 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\example-plugin\skills\example-skill\SKILL.md` |
| `d91970639e9f5c37` | 9390 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\frontend-design\skills\frontend-design\SKILL.md` |
| `2994b5d3152243b1` | 8423 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\hookify\skills\writing-rules\SKILL.md` |
| `f697e195d343520f` | 19961 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\math-olympiad\skills\math-olympiad\SKILL.md` |
| `d2fd94f009650646` | 19391 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\mcp-server-dev\skills\build-mcp-app\SKILL.md` |
| `088cd04be7f03ebb` | 12084 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\mcp-server-dev\skills\build-mcp-server\SKILL.md` |
| `6bb90afd0415754e` | 7867 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\mcp-server-dev\skills\build-mcpb\SKILL.md` |
| `521a3d62211e5f47` | 3824 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\playground\skills\playground\SKILL.md` |
| `6a2826571320828c` | 11168 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\plugin-dev\skills\agent-development\SKILL.md` |
| `c55ad02cfe4cbb2a` | 19233 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\plugin-dev\skills\command-development\SKILL.md` |
| `f47e2d42f6360294` | 16246 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\plugin-dev\skills\hook-development\SKILL.md` |
| `b9319d8e44c8f058` | 12530 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\plugin-dev\skills\mcp-integration\SKILL.md` |
| `028b955244b937eb` | 12097 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\plugin-dev\skills\plugin-settings\SKILL.md` |
| `a2dbc1e5502aacb3` | 13796 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\plugin-dev\skills\plugin-structure\SKILL.md` |
| `d51b4e20043b13e4` | 22825 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\plugin-dev\skills\skill-development\SKILL.md` |
| `34e13249dba8a066` | 20425 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\project-artifact\skills\project-artifact\SKILL.md` |
| `5b2f407ff4063972` | 17254 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\receipts\skills\receipts\SKILL.md` |
| `ef0fbc4259a41b7f` | 3149 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\session-report\skills\session-report\SKILL.md` |
| `dcd4803e61e913e6` | 33168 | `C:\Users\Al Asil Stores\.claude\plugins\marketplaces\claude-plugins-official\plugins\skill-creator\skills\skill-creator\SKILL.md` |
| `2121fc72ffa47649` | 17564 | `C:\Users\Al Asil Stores\.claude\skills\animate-expo\SKILL.md` |
| `f6317335da2662e9` | 11575 | `C:\Users\Al Asil Stores\.claude\skills\animate\SKILL.md` |
| `d718b48fe3c78988` | 13128 | `C:\Users\Al Asil Stores\.claude\skills\animation-vocabulary\SKILL.md` |
| `31730be40e4ecbe6` | 14591 | `C:\Users\Al Asil Stores\.claude\skills\assess-react-native-migration\SKILL.md` |
| `72fc31f0dbf032ce` | 2736 | `C:\Users\Al Asil Stores\.claude\skills\create-react-native-library\SKILL.md` |
| `c19bbca057880f1c` | 11230 | `C:\Users\Al Asil Stores\.claude\skills\detour\detour-onboarding\SKILL.md` |
| `955703ab3e2cd667` | 15692 | `C:\Users\Al Asil Stores\.claude\skills\detour\migrate-to-detour\SKILL.md` |
| `e71de849347050c2` | 27226 | `C:\Users\Al Asil Stores\.claude\skills\emil-design-eng\SKILL.md` |
| `45a2b58e17824ccd` | 11267 | `C:\Users\Al Asil Stores\.claude\skills\expo-horizon\SKILL.md` |
| `91c1243164057fbf` | 9491 | `C:\Users\Al Asil Stores\.claude\skills\find-animation-opportunities\SKILL.md` |
| `397ae0fae63708ed` | 5525 | `C:\Users\Al Asil Stores\.claude\skills\fishjam\references\js-server-sdk\SKILL.md` |
| `4c0fc5e352b80eaa` | 6675 | `C:\Users\Al Asil Stores\.claude\skills\fishjam\references\platform\SKILL.md` |
| `9b218ff0fc09f69e` | 5333 | `C:\Users\Al Asil Stores\.claude\skills\fishjam\references\python-server-sdk\SKILL.md` |
| `e313b94b3c7e5012` | 5964 | `C:\Users\Al Asil Stores\.claude\skills\fishjam\references\react-client\SKILL.md` |
| `8b83dede86648302` | 7617 | `C:\Users\Al Asil Stores\.claude\skills\fishjam\references\react-native-client\SKILL.md` |
| `dba4eb81c9ac54d4` | 3721 | `C:\Users\Al Asil Stores\.claude\skills\fishjam\SKILL.md` |
| `0d656b3361161b11` | 2812 | `C:\Users\Al Asil Stores\.claude\skills\github-actions\SKILL.md` |
| `96e2e6bd4fcf9a2c` | 4484 | `C:\Users\Al Asil Stores\.claude\skills\impeccable\reference\craft-floor.md` |
| `125f732891f3f319` | 10771 | `C:\Users\Al Asil Stores\.claude\skills\impeccable\SKILL.md` |
| `68f17bbc4671593d` | 7915 | `C:\Users\Al Asil Stores\.claude\skills\improve-animations\SKILL.md` |
| `d0d5e071e22ed6e0` | 19986 | `C:\Users\Al Asil Stores\.claude\skills\moq-kit\SKILL.md` |
| `2ad8401c4deaddb5` | 7488 | `C:\Users\Al Asil Stores\.claude\skills\prototype\SKILL.md` |
| `fb58618ee4572ff6` | 10272 | `C:\Users\Al Asil Stores\.claude\skills\pulsar-haptics\SKILL.md` |
| `1391deacb9d4ab04` | 2660 | `C:\Users\Al Asil Stores\.claude\skills\radon-mcp\SKILL.md` |
| `7e65406d6dc1d09c` | 5983 | `C:\Users\Al Asil Stores\.claude\skills\react-native-best-practices\references\animations\animations-performance.md` |
| `ed73feae28707748` | 11838 | `C:\Users\Al Asil Stores\.claude\skills\react-native-best-practices\references\animations\animations.md` |
| `039a49b67158542f` | 14623 | `C:\Users\Al Asil Stores\.claude\skills\react-native-best-practices\references\animations\canvas-animations.md` |
| `cbf41937f716feb6` | 3745 | `C:\Users\Al Asil Stores\.claude\skills\react-native-best-practices\references\animations\SKILL.md` |
| `8e3d4d7b87ee7455` | 4019 | `C:\Users\Al Asil Stores\.claude\skills\react-native-best-practices\references\audio\SKILL.md` |
| `c86a39fe84a20d1a` | 15938 | `C:\Users\Al Asil Stores\.claude\skills\react-native-best-practices\references\enable-worklets-bundle-mode\SKILL.md` |
| `8608158a6b2979c4` | 6941 | `C:\Users\Al Asil Stores\.claude\skills\react-native-best-practices\references\gestures\SKILL.md` |
| `a70674691164d4c9` | 3628 | `C:\Users\Al Asil Stores\.claude\skills\react-native-best-practices\references\jsi\SKILL.md` |
| `087d8fe9868f5453` | 4786 | `C:\Users\Al Asil Stores\.claude\skills\react-native-best-practices\references\multithreading\SKILL.md` |
| `10570525ac88f34d` | 9574 | `C:\Users\Al Asil Stores\.claude\skills\react-native-best-practices\references\on-device-ai\SKILL.md` |
| `79a0e06e4be4179d` | 21622 | `C:\Users\Al Asil Stores\.claude\skills\react-native-best-practices\references\rich-text\SKILL.md` |
| `92353d60d2a42cf1` | 1017 | `C:\Users\Al Asil Stores\.claude\skills\react-native-best-practices\references\svg\SKILL.md` |
| `2cafec6f98199a23` | 4489 | `C:\Users\Al Asil Stores\.claude\skills\react-native-best-practices\SKILL.md` |
| `a01b34e0e03a0bc2` | 7035 | `C:\Users\Al Asil Stores\.claude\skills\react-native-brownfield-migration\SKILL.md` |
| `235709c3c1be94cd` | 6449 | `C:\Users\Al Asil Stores\.claude\skills\react-native-moq\SKILL.md` |
| `46b4524c57ce315b` | 11166 | `C:\Users\Al Asil Stores\.claude\skills\react-native-tv-best-practices\SKILL.md` |
| `f127331ac68f2966` | 3419 | `C:\Users\Al Asil Stores\.claude\skills\react-navigation\SKILL.md` |
| `61cf8ac0c4c8e1f6` | 8108 | `C:\Users\Al Asil Stores\.claude\skills\review-animations\SKILL.md` |
| `0effa7af402853b4` | 2452 | `C:\Users\Al Asil Stores\.claude\skills\rnrepo\SKILL.md` |
| `34e249af012a1ffb` | 22400 | `C:\Users\Al Asil Stores\.claude\skills\typegpu\SKILL.md` |
| `5d81737d25e48a32` | 4210 | `C:\Users\Al Asil Stores\.claude\skills\upgrading-react-native\SKILL.md` |
| `11840b24a11d7f94` | 22715 | `E:\QANDEEL\QANDEEL PROJECT\.claude\skills\apple-design\SKILL.md` |
| `3a4f260eb9f60b43` | 3923 | `E:\QANDEEL\QANDEEL PROJECT\.claude\skills\design-critique\SKILL.md` |
| `ab70493bf1b15461` | 13757 | `E:\QANDEEL\QANDEEL PROJECT\.claude\skills\designing-arabic-frontends\SKILL.md` |
| `e71de849347050c2` | 27226 | `E:\QANDEEL\QANDEEL PROJECT\.claude\skills\emil-design-eng\SKILL.md` |
| `549261e8a53b53a1` | 4718 | `E:\QANDEEL\QANDEEL PROJECT\.claude\skills\fixing-accessibility\SKILL.md` |
| `1608ea77fbb6fc30` | 8260 | `E:\QANDEEL\QANDEEL PROJECT\.claude\skills\frontend-design\SKILL.md` |
| `2ad8401c4deaddb5` | 7488 | `E:\QANDEEL\QANDEEL PROJECT\.claude\skills\prototype\SKILL.md` |
| `fa18fc13d0f44aa8` | 1751 | `E:\QANDEEL\QANDEEL PROJECT\.claude\skills\user-research\SKILL.md` |
| `6a673bd773a9245b` | 9513 | `E:\QANDEEL\QANDEEL PROJECT\.claude\skills\writing-eloquent-arabic\SKILL.md` |
