# P2-A — Reference Gate

**Status:** `P2-A EVIDENCE — NOT A FREEZE`.
**Research refreshed:** 2026-09-26, before any proof geometry was drawn.

Every figure below comes from a primary source that was read on that date. The sources are:
- the npm registry (`registry.npmjs.org`);
- each project's own GitHub repository;
- the Expo SDK package on jsDelivr, which mirrors npm byte-for-byte;
- Apple's Human Interface Guidelines data;
- W3C WCAG 2.2 Understanding.

No community blog or summary site was used.

---

## 1. Icon libraries

| Library | Primary sources read | React Native | Licence | Findings |
|---|---|---|---|---|
| **Hugeicons Free** | `registry.npmjs.org/@hugeicons/react-native` (1.0.16, 2026-08-21); `@hugeicons/core-free-icons` (4.3.5, 2026-09-21); `github.com/hugeicons/hugeicons` README, `LICENSE.md` and `packages/react-native/README.md` | **Official**, `@hugeicons/react-native`, from the same repository | **MIT** (`LICENSE.md`, "Copyright (c) 2025 Hugeicons"). Free: "6,000+ Stroke Rounded icons … for unlimited personal and commercial projects" | Two packages: the renderer (`HugeiconsIcon`) and the free icon data. **Pro** is `@hugeicons-pro/core-*`, 60,000+ icons in 10 styles, and "requires license". Pro is out of scope. The free style is **Stroke Rounded only**, on a 24 × 24 grid at `strokeWidth` 1.5, and it is customisable. The package ships per-icon ESM files and describes itself as "Tree shakeable builds (ESM, CJS) for bundlers like Metro". Peers: `react-native-svg >= 12` and `react-native >= 0.60` |
| **Lucide** | `lucide.dev/guide/packages/lucide-react-native`; `registry.npmjs.org/lucide-react-native` (1.48.0, 2026-09-24) | **Official**, `lucide-react-native` | **ISC** | Icons are individual components with `size`, `color`, `strokeWidth` and `absoluteStrokeWidth`. It says it is tree-shakable. Peer: `react-native-svg` ^12–^15. 24 grid, stroke 2 |
| **Tabler** | `registry.npmjs.org/@tabler/icons-react-native` (3.48.0, 2026-09-22); `github.com/tabler/tabler-icons` | **Official**, `@tabler/icons-react-native` | **MIT** | Peer: `react-native-svg >= 13`. 24 grid, stroke 2, dense outline set |
| **Iconoir** | `registry.npmjs.org/iconoir-react-native` (7.12.1, 2026-08-12); `github.com/iconoir-icons/iconoir` | **Official**, `iconoir-react-native` | **MIT** | Peers: `react-native >= 0.78` and `react-native-svg ^15.12.0`, both satisfied by the repository's RN 0.86.3 and Expo's svg 15.15.4. 24 grid, stroke 1.5, airy drawings |
| **Phosphor** | `github.com/phosphor-icons` (organisation repository list); `github.com/phosphor-icons/react-native` (last push **2023-05-14**, 7 stars); `github.com/duongdev/phosphor-react-native` README (3.0.6, 2026-04-23, owner `duongdev`) | **Not first-party-maintained.** The first-party repository is dormant. The maintained package is a **community wrapper** by a different owner, so it is not treated as equivalent to first-party support (task §5.5) | MIT | Its own README warns: "Metro does not tree-shake by default … pulls **all 1512 icons**" (+182 % bundle), and "a single icon always carries all 6 weights". Designed on a 16 px grid; 256-unit viewBox |

For the visual comparison, every glyph was fetched from the library's **own npm package** through jsDelivr. The script is `source/tools/vendor-utility.mjs`, and the stored copy records each glyph's URL and SHA-256 in `source/vendor/utility/utility-glyphs.json`, beside each licence text. They are evidence only. **Nothing was installed**, and `apps/mobile/package.json` is unchanged.

## 2. The platform, and the repository's versions

The repository's dependencies are read from `apps/mobile/package.json`:

| Package | Declared |
|---|---|
| `react-native` | `0.86.3` |
| `expo` | `~57.0.21` |
| `react-native-reanimated` | `4.5.1` |
| `react-native-worklets` | `0.10.1` |
| `@shopify/react-native-skia` | `2.6.2` |
| `react-native-gesture-handler` | `~2.32.0` |

`react-native-svg` is **not** a dependency.

Expo SDK 57's own pins come from `cdn.jsdelivr.net/npm/expo@57.0.21/bundledNativeModules.json`:

| Package | Expo pin |
|---|---|
| `react-native-svg` | **15.15.4** |
| `@shopify/react-native-skia` | 2.6.2 |
| `react-native-reanimated` | 4.5.1 |
| `react-native-worklets` | 0.10.1 |
| `react-native-gesture-handler` | ~2.32.0 |

The repository's pins **equal** Expo's.

Compatibility, from each package's declared peer range in the registry:
- `react-native-reanimated@4.5.1` peers on `react-native 0.83 – 0.86` and `react-native-worklets 0.10.x`. RN 0.86.3 and worklets 0.10.1 **satisfy** both.
- `@shopify/react-native-skia@2.6.2` peers on `react-native-reanimated >= 3.19.1`, and declares **no** worklets peer. Reanimated 4.5.1 satisfies it.
- The latest Skia, **2.13.0** (2026-09-24), peers on `react-native-reanimated >= 4.0.0` and `react-native-worklets >= 0.7.0`. Its Reanimated/worklets integration contract therefore changed after 2.6.2.

**Conclusion.** The declared ranges are consistent. Whether a Skia ↔ Reanimated shared-value integration behaves correctly at 2.6.2 + 4.5.1 was **not** verified on a device here. That is the reason this proof does not need Skia (P2_IMPLEMENTATION_FEASIBILITY.md §4). **Nothing was upgraded.**

The latest `react-native-reanimated` is 4.7.0, which peers on RN 0.86–0.88 and worklets 0.13.x. It is recorded for the future implementation task only.

## 3. Platform guidance, quoted from the source

**Apple HIG, Icons** (`developer.apple.com/tutorials/data/design/human-interface-guidelines/icons.json`):
- "all interface icons in your app need to use a consistent size, level of detail, stroke thickness (or weight), and perspective. Depending on the visual weight of an icon, you may need to adjust its dimensions …" → the optical-stroke rule in `P2_ICON_GEOMETRY_SPEC.md` §3.
- "Create a recognizable, highly simplified design … icons work best when they use familiar visual metaphors" → universal mic, handset and speaker semantics are kept (task §4.2).
- "Provide a selected-state version of an interface icon only if necessary." → the navigation glyph has **no** selected variant (C3 §6).

**Apple HIG, Right to left** (`…/right-to-left.json`):
- "Flip controls that show progress from one value to another … sliders and progress indicators" → the Temporal Spine's direction follows T-06's logical mirror.
- "Reverse the order of numerals … never flip the numerals themselves."

**Apple HIG, Buttons** (`…/buttons.json`):
- "a button needs a hit region of at least 44x44 pt" → every Call Rail and Timeline target is ≥ 44 pt (check K08).

**Apple HIG, Accessibility** (`…/accessibility.json`):
- "When this setting is active … reducing automatic and repetitive animations, including zooming, scaling, and peripheral motion … Replacing transitions in x-, y-, and z-axes with fades" → matches F1R2 and T-10's Reduced Motion rules, which the proof consumes.

**W3C WCAG 2.2, SC 2.5.8 Target Size (Minimum), AA** (`w3.org/WAI/WCAG22/Understanding/target-size-minimum.html`):
- "at least 24 by 24 CSS pixels". QANDEEL's own 44-pt floor is stricter, and it governs.

## 4. What the research changed

- **The utility family is sourced, not depended on.** Every candidate renders through `react-native-svg`, which the app does not yet depend on. Metro does not tree-shake by default (Phosphor's README measures this). The recommendation is therefore:
  - use Hugeicons Free drawings, vendored as a curated subset with the MIT notice;
  - render them with the same renderer as the signature family;
  - add **no** runtime icon-library dependency (P2_UTILITY_LIBRARY_COMPARISON.md §4).
- **Phosphor is excluded as a utility family.** The React Native path is not first-party, and a single icon carries all six weights.
- **Skia is not required.** Every mark and morph in P2 is a vector path, a mask, a dash offset or an opacity, all of which `react-native-svg` + Reanimated animated props express. P2 therefore does not depend on the unverified Skia 2.6.2 ↔ Reanimated 4.5.1 integration.

## 5. The Skill Gate

The installed skills were inventoried at task start. They live in `~/.claude/skills/`, in the plugin cache, and in `E:\QANDEEL\.claude\skills\`, which is the one G3 used. The relevant skills were read before designing. The table below lists what each one changed.

| Skill | Path | Why used | Concrete effect (where to see it) |
|---|---|---|---|
| `fixing-accessibility` | `E:\QANDEEL\.claude\skills\fixing-accessibility\SKILL.md` | Icon-only controls, focus, names, states | Every glyph is `aria-hidden` and the control carries the name (check K19; planted "mic glyph exposed" rejected). State is never colour alone: Mute = slash + negative-space cut, Route = fill + wave count (K21). The focus perimeter is kept visible. The Live act's HIT region was narrowed without removing its focus ring (F-P2-02) |
| `designing-arabic-frontends` | `~/.claude/plugins/cache/sibawayh/…/designing-arabic-frontends/SKILL.md` | Direction, mirroring by meaning | §6 "mirror by meaning": chevron mirrored; media, handset, speaker, world and Q glyphs **never** mirrored (K20; planted "mirrored mic" rejected). Layout art uses logical `inset-inline-*` and mirrors as layout. Placement is described in start / end terms throughout. No `letter-spacing` on Arabic (inherited `#phone *{letter-spacing:0}`) |
| `animate-expo` | `~/.claude/skills/animate-expo/SKILL.md` | The motion layer and its RN feasibility | The gate "should it animate?": the tab / rail switch does not animate, and only state changes of a toggle and the temporal commit do. Toggles run 150–200 ms (the morphs are 180 ms). "If a finger was involved" the finger is tracked 1:1 on the UI thread. Reduced Motion ships with the animation. `P2_IMPLEMENTATION_FEASIBILITY.md` maps each morph to Reanimated animated props rather than Skia ("do not force Skia", task §15) |
| `apple-design` | `E:\QANDEEL\.claude\skills\apple-design\SKILL.md` | Direct manipulation and interruptibility | §2 "touch and content should move together": the preview aperture is drawn **at** the finger (K11: ≤ 0.04 pt). §7 symmetric paths: a cancel returns the preview to where it came from, and Return Live closes **in place** rather than travelling (K14) |
| `ui-ux-pro-max` | `~/.claude/plugins/cache/ui-ux-pro-max-skill/…/SKILL.md` | Icon-system QA checklist | Its search script needs Python, which this host lacks, so its `references/quick-reference.md` rules were read instead. Applied: SVG icons from one family; consistent stroke; touch ≥ 44 × 44; no reliance on colour; reduced motion. The generic advice that "primary actions use brand colour" **loses** to C3 (Brass never marks a primary action, so End Call is not Brass) |
| `sibawayh:writing-eloquent-arabic` | plugin cache | Arabic wording | **No Arabic copy was written or changed.** Every Arabic string in the proof is the existing canonical / G3.2 copy. The skill was used only to confirm that none of P2's English design labels leaked into Product surfaces |

Not installed, and not installed by this task: an official Hugeicons agent skill, and any icon-library skill. Their absence did not change the evidence: the library research above was done from primary sources directly.
