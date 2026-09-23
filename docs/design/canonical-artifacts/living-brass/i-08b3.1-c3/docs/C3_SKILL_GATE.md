# C3_SKILL_GATE

**I-08B3.1-C3.** Mandatory skill gate. **GENERATED** from a walk of the disk by
`tools/c3-skills.mjs` — not from recall, so a skill installed since the last stage appears whether
or not anyone remembered it.

**89 `SKILL.md` files on disk**, across:
- `C:\Users\Al Asil Stores\.claude`
- `E:\QANDEEL\QANDEEL PROJECT\.claude`

A gate is auditable or it is decoration. Every USED entry carries the exact path, the exact
SHA-256 of the file that was read, the principle taken from it, and a **concrete consequence** —
something a reviewer can go and look at. A skill that was read and changed nothing is recorded as
read and changing nothing, which is more useful than a list of everything available.

---

## 1. USED — 6

### react-native-best-practices / references/svg

| file | SHA-256 | bytes |
|---|---|---|
| `C:\Users\Al Asil Stores\.claude\skills\react-native-best-practices\references\svg\SKILL.md` | `92353d60d2a42cf16d5206aa930edcf352c6ba71bc04de004bba75a38928f1f3` | 1017 |
| `C:\Users\Al Asil Stores\.claude\skills\react-native-best-practices\references\svg\svg.md` | `65cf837356bb1e73a8d9069225f122429a229859b065b44cfaf55d4c339a2827` | 5337 |
| `C:\Users\Al Asil Stores\.claude\skills\react-native-best-practices\references\svg\when-to-use.md` | `41e5a1edf2285bb32290726485342c4bace3929cdd7ea328dd24832fa0b02bd4` | 2708 |

**Principle.** react-native-svg implements FeBlend, FeComposite, FeColorMatrix, FeDropShadow, FeFlood, FeGaussianBlur, FeMerge and FeOffset on native; other filters are web-only and warn. Every SVG element becomes a native view with no drawing cache, so static SVG is better served by other renderers, and complex SVGs with filters point to react-native-skia.

**Consequence in C3.** THE SINGLE MOST CONSEQUENTIAL FINDING IN C3.10. The accepted brushed/handled character is built from feTurbulence + feColorMatrix + feFlood + feComposite. Three of those four are production-available in react-native-svg; feTurbulence is NOT — confirmed against the library's own USAGE.md, which lists it under "Not supported yet". So the identity moment cannot be shipped by transcribing the proof's filter chain, and C3_REACT_NATIVE_MAPPING.md §4 names the routes that can carry it instead. It also supplies the production reason for confining the character to the rare identity moment: the renderer that can do it is heavy per instance.

**Evidence.** docs/C3_REACT_NATIVE_MAPPING.md §4; docs/C3_REFERENCE_GATE.md §5

### react-navigation (+ references/bottom-tabs, references/native-bottom-tabs)

| file | SHA-256 | bytes |
|---|---|---|
| `C:\Users\Al Asil Stores\.claude\skills\react-navigation\SKILL.md` | `f127331ac68f2966168c5c12bb65217eac310804b91d2210f447672d1cbd0f1c` | 3419 |
| `C:\Users\Al Asil Stores\.claude\skills\react-navigation\references\bottom-tabs.md` | `a3a5531fbd9e4f61801c490d5292dc69483678bf09fdac5c71c561eff529fda3` | 13020 |
| `C:\Users\Al Asil Stores\.claude\skills\react-navigation\references\native-bottom-tabs.md` | `365348895d64f9b5df64e2abc50edfa5ef249069960a6baab83b2157c13efd5b` | 8925 |

**Principle.** React Navigation 7 renders a tab icon through `tabBarIcon({ focused, color, size })`, where `color` is computed by the navigator from `tabBarActiveTintColor` / `tabBarInactiveTintColor`. On the native tab navigator, tint support "varies based on platform".

**Consequence in C3.** THE LIBRARY'S DEFAULT MODEL IS THE THING QANDEEL FORBIDS: the idiomatic implementation is `<Icon color={color} />`, which makes the navigation icon change colour on selection. C3_REACT_NATIVE_MAPPING.md §3 therefore states the rule as an explicit instruction — the QANDEEL navigation icon IGNORES the injected `color` and both tint options are set to the same material token, so the library's model is neutralised deliberately rather than by omission — and flags the native navigator's platform-varying tint as something that must be VERIFIED per platform, because a native tab bar that applies its own tint would break state invariance in a way no token check can see.

**Evidence.** docs/C3_REACT_NATIVE_MAPPING.md §3; docs/C3_INVARIANTS.md §4 (scope note)

### apple-design (project-scoped)

| file | SHA-256 | bytes |
|---|---|---|
| `E:\QANDEEL\QANDEEL PROJECT\.claude\skills\apple-design\SKILL.md` | `11840b24a11d7f94f39c6aaab074750ae4e4de4ef54ee4b1dd97e16ebd485e61` | 22715 |

**Principle.** Reach for current primary Apple guidance and quote it rather than paraphrasing remembered guidance; treat platform conventions as things to depart from deliberately and on the record.

**Consequence in C3.** C3_REFERENCE_GATE.md re-reads Branding, Color and Icons at their live URLs, records the change-log date on each, and states five DEPARTURES with the sentence each departs from. It also records the two sentences that run TOWARD QANDEEL's choice, including the conditional one whose condition QANDEEL measurably meets.

**Evidence.** docs/C3_REFERENCE_GATE.md §2-§4

### fixing-accessibility (project-scoped)

| file | SHA-256 | bytes |
|---|---|---|
| `E:\QANDEEL\QANDEEL PROJECT\.claude\skills\fixing-accessibility\SKILL.md` | `549261e8a53b53a1a20c0ddbf736821e5fc0876ad82eee76e0efab8e9ee9dadf` | 4718 |

**Principle.** Establish which success criterion actually applies before asserting a threshold, and never let colour be the sole carrier of information.

**Consequence in C3.** Invariant I-19 re-measures rather than citing C2: under P2 the persistent navigation family is an ESSENTIAL UI COMPONENT VISUAL, SC 1.4.11 applies, and the material clears 3:1 on both frozen grounds by measurement made in this package (6.070:1 and 5.664:1). The reserved-and-empty {qandeel.status} namespace carries SC 1.4.1 forward as a constraint on values E has not chosen yet, rather than leaving it to be rediscovered.

**Evidence.** tools/c3-invariants.mjs I-19; docs/C3_ICONOGRAPHY_MATERIAL_CONTRACT.md §6

### frontend-design (project-scoped)

| file | SHA-256 | bytes |
|---|---|---|
| `E:\QANDEEL\QANDEEL PROJECT\.claude\skills\frontend-design\SKILL.md` | `1608ea77fbb6fc30d13a97d12cfa8ebf31358d40f0dd97beed24829d6b3f45dd` | 8260 |

**Principle.** Named AI-default looks to avoid, one of which is a near-black background carrying a single bright accent.

**Consequence in C3.** Recorded in C3_LUXURY_BOUNDARY.md as EXTERNAL CORROBORATION of the generic risk rather than as a reason to weaken the material — the corroboration is that QANDEEL is structurally adjacent to a current default, which is an argument about COVERAGE DISCIPLINE, which is what that document contains. NOTE: this skill exists at four installed paths on this host with two distinct contents; the hash recorded here is of the file actually read.

**Evidence.** docs/C3_LUXURY_BOUNDARY.md §5

### designing-arabic-frontends (project-scoped)

| file | SHA-256 | bytes |
|---|---|---|
| `E:\QANDEEL\QANDEEL PROJECT\.claude\skills\designing-arabic-frontends\SKILL.md` | `ab70493bf1b15461ab5ff6cba9848871e27a7e5144042b7458d566070c2d87b2` | 13757 |

**Principle.** RTL is a directional system, not a mirrored one: icons that encode direction must be mirrored by MEANING, and logical properties must be used rather than physical ones.

**Consequence in C3.** C3 freezes no icon geometry, so this skill changed no glyph here. It is recorded as USED because it produced a STANDING CONSTRAINT written into C3_ICONOGRAPHY_MATERIAL_CONTRACT.md §7: the material contract grants paint and never geometry, and any future navigation icon set inherits the RTL obligations rather than the material's permission implying they are settled. In C2 this same skill caught a real defect — a send arrow pointing the wrong way in RTL — which is why it is consulted rather than assumed.

**Evidence.** docs/C3_ICONOGRAPHY_MATERIAL_CONTRACT.md §7

---

## 2. INSPECTED — NOT APPLICABLE

"Not applicable" is a claim. A reader who disagrees with one of these can check the reasoning
instead of wondering whether the skill was seen at all.

| Skill | Why not applicable to a material production specification |
|---|---|
| emil-design-eng | Design-engineering craft for building interfaces. C3 builds no interface: it freezes a material contract and specifies a mapping. Its craft rules bind the stage that builds components. |
| ui-ux-pro-max | Broad UI/UX generation guidance. C3 makes no design decisions — every visual decision it records was made in C0 through C2 and accepted by the Design Director. |
| design-critique | Critique of a design artefact. C3 ships no new visual artefact to critique; the reproduction proof is deliberately NOT an aesthetic comparison, by instruction. |
| impeccable | Craft-floor and audit references. Read; its audit discipline is already the operating method of this package. NOTE: reference/colorize.md — "Add strategic color to monochromatic UIs", the single most on-point document this host could hold for a Living Brass coverage stage — is STILL ABSENT, for the fifth consecutive stage. |
| animate / animate-expo / animation-vocabulary / improve-animations / find-animation-opportunities | Motion. C3 must NOT design or freeze motion, and explicitly leaves it to later contracts. Recorded in C3_EXPRESSIVE_HEADROOM_CONTRACT.md as reserved capacity, not exercised here. |
| react-native-best-practices / references/animations | Reanimated and GPU animation. Same boundary as above — and relevant later, because the lantern gateway moment and the Q-thread expression will need it. |
| prototype / playground | Prototyping harnesses. C3 produces a specification and a reproduction proof, not a prototype. |
| writing-eloquent-arabic | Arabic prose quality. C3 authors no new Arabic copy; the reproduction proof uses the sealed C2 copy verbatim so that the compositions remain the accepted ones. |
| assess-react-native-migration / react-native-brownfield-migration / upgrading-react-native / create-react-native-library / rnrepo / expo-horizon / detour | React Native project operations. C3 specifies consumption, builds nothing, and touches no project configuration. |
| claude-security, hookify, plugin-dev, mcp-server-dev, skill-creator, github-actions, session-report, receipts, project-artifact, math-olympiad, cwc-makers, discord/imessage/telegram, fishjam, moq-kit, typegpu, pulsar-haptics, radon-mcp, react-native-tv-best-practices, user-research, claude-md-management, claude-code-setup, example-plugin | Outside the subject matter of a material production specification. |

---

## 3. NOT AVAILABLE

**`impeccable/reference/colorize.md`** — Referenced by the impeccable skill as "Add strategic color to monochromatic UIs" and not present on disk. FIFTH CONSECUTIVE STAGE. It is the most directly relevant missing document this host could have offered a Living Brass coverage and freeze stage, and its absence is recorded here rather than passed over so that the gap does not read as a gap in the work.

**`a design-token architecture skill`** — No installed skill covers DTCG token architecture, resolver design or token-system freezing. That work rests on the DTCG 2025.10 specification itself, vendored in this package, and on the frozen I-08B3.1-B4R architecture it extends.

---

## 4. Duplicate installations, and why this matters

A skill installed more than once **with different contents** means "I read skill X" is an
ambiguous statement. Recorded so the hashes above are unambiguous about which file was read.

| Skill | Installations | Distinct contents |
|---|---|---|
| frontend-design | 4 | 2 |
| designing-arabic-frontends | 3 | 1 |
| writing-eloquent-arabic | 3 | 1 |
| access | 3 | 3 |
| configure | 3 | 3 |

`frontend-design` is the one that bit: **four installations, two distinct contents.** C2 quoted a
calibration sentence from it. C3 checked the *project-scoped* copy, found a condensed form of the
same passage, and read the exact wording — which turned out to be more specific than C2's summary
of it. See `C3_REFERENCE_GATE.md` §4, where C2's own record is corrected.

