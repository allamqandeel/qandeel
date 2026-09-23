# B4_SKILL_GATE

**I-08B3.1-B4.** Re-enumerated from disk this session by `tools/b4-skills.mjs`, which writes
`B4_SKILL_INVENTORY.md` itself. **86 SKILL.md files** were found and hashed across three roots.
Every classification below names a hash, and every USED entry names the file that was read and the
concrete thing in this package that changed because of it.

**Drift against I-08B3.1-B3R: 0 changed, 0 new, 0 removed.** Every B3R reading may therefore be
carried forward, and every B4 reading is a first reading.

---

## 0. A finding this gate made about itself

The first run reported **"4 changed since B3R"** and not one byte had moved.

Two skill *names* — `access` and `configure` — are installed **twice** in the plugin tree with
different content at each path. The prior-hash map was keyed `scope/name`, so both of today's copies
were compared against the single hash that happened to be written last, and one of each pair was
reported as edited.

The fix is in `tools/b4-skills.mjs`: prior hashes are keyed to a **list**, a skill is `unchanged` if
its hash is among the hashes recorded for that name, and the collision itself is now stated out loud
in `B4_SKILL_INVENTORY.md` §1c. **Which copy a session would actually load is not determined by a
disk walk, and this gate does not pretend to know.** It reports the collision instead of
deduplicating it away.

This is recorded because it is the second time a QANDEEL gate has produced an alarming figure from
its own bookkeeping rather than from the world, and because a "4 changed" line is exactly the kind of
number that gets copied into a summary and believed.

---

## 1. USED

### 1.1 `react-native-tv-best-practices` — user scope

`C:\Users\Al Asil Stores\.claude\skills\react-native-tv-best-practices\SKILL.md`
SHA-256 `46B4524C57CE315B7BE7A4D6C4A342BA31B020576FF50F76B949D61818BC39C5`, 11,166 bytes.
**Read:** `references/a11y-implementation.md`, `references/a11y-overview.md`.

**Principle taken.** The React Native expression of a modal, quoted:

> ```jsx
> <Modal visible={isVisible} accessibilityViewIsModal={true} onRequestClose={handleClose}>
> ```
> — with the inline warning: *"Don't wrap the body in `accessible` — it collapses children into one
> element and hides the buttons from focus. Label a header node instead."*

and the four obligations stated plainly: *"Set initial focus inside modal / Trap focus within modal
/ Announce dialog opening"*, plus, from the agent-check list: *"Modal opening moves focus inside the
modal and hides or de-prioritizes background controls"* and *"Closing a modal restores focus to the
invoking control or another predictable target."*

**Concrete B4 consequence.** This is the single most valuable local reading in the package, because
it **partially answers B3R's open dependency D-7** — how the DOM patterns B3R proved map onto React
Native. `B4_REACT_NATIVE_MAPPING.md` §4 now specifies the PASSAGE mapping as
`accessibilityViewIsModal` plus the four lifecycle obligations, scopes `onRequestClose` to the
platform dismissal paths React Native actually documents (**corrected in I-08B3.1-B4R**: B4 called it
"the platform's Escape", which overstated a prop that covers Android back, the Apple TV menu button
and iOS drag/swipe dismissal — and no keyboard Escape), and records the `accessible={true}` collapse
trap as a named production hazard —
a trap with no DOM analogue, which B3R could not have found and which would have silently destroyed
the focus containment B3R spent a whole revision proving.

**What it does not settle.** It is written for TV. D-7 remains open for phone: `accessibilityRole`
mapping for a menu-like ASIDE, and whether an informational ASIDE has a native analogue, are not
answered here and are not invented.

### 1.2 `react-native-best-practices` — user scope

`C:\Users\Al Asil Stores\.claude\skills\react-native-best-practices\SKILL.md`
SHA-256 `2CAFEC6F98199A23D58DCE764A07BC815D4675CB4296D052428B51ABFD8A64FD`, 4,489 bytes.
**Read:** `references/js-uncontrolled-components.md`.

**Principle taken.** `TextInput` may be controlled (`value` + `onChangeText`) or uncontrolled
(`defaultValue` + `onChangeText`); the uncontrolled form is preferred where "React does not need to
transform, mask, validate, or own the value on every keystroke", and the controlled form on the
legacy architecture can flicker and drop characters during fast typing.

**Concrete B4 consequence.** `B4_SURFACE_ROLE_CONTRACTS.md` FIELD and `B4_REACT_NATIVE_MAPPING.md`
§5 require a real `TextInput` for an editable FIELD and state explicitly that **the
controlled/uncontrolled choice is a component decision B4 does not freeze** — it is a state-ownership
question, not a Surface question. That sentence exists because this file made the distinction
visible; without it the mapping would have said "use TextInput" and left a real decision looking
settled.

### 1.3 `apple-design` — project scope

`E:\QANDEEL PROJECT\.claude\skills\apple-design\SKILL.md`
SHA-256 `11840B24A11D7F94F39C6AAAB074750AE4E4DE4EF54EE4B1DD97E16EBD485E61`, 22,715 bytes.
**Read:** SKILL.md, the materials and layering section (lines ~176–180).

**Principle taken, quoted:**

> "**Dim to focus, separate to keep flow.** A modal task pairs the surface with a dimming scrim and
> pushes the background back/down. A parallel, non-blocking panel uses translucency and offset
> *without* a scrim so the flow isn't broken. For stacked sheets, progressively dim and push back
> each parent layer."

**Concrete B4 consequence.** The first two sentences are an **independent statement of B0R's frozen
rule** — a scrim follows from blocking — arrived at from platform design rather than from QANDEEL's
ontology. `B4_SURFACE_ROLE_CONTRACTS.md` cites it in the PASSAGE and ASIDE contracts, and INV-06
tests the *absence* of a scrim on the three non-blocking roles rather than only its presence on
PASSAGE. Two independent traditions reaching the same rule is worth more than either reaching it
alone, and it is cited as corroboration, never as the authority.

**Explicitly NOT inherited, from the same file:**

- *"A parallel, non-blocking panel uses **translucency** and offset"* — QANDEEL's ASIDE is **opaque
  matte**. Translucency is retired from the B-track.
- *"For stacked sheets, **progressively dim and push back** each parent layer"* — QANDEEL's N2
  overlap adds **no** tonal step. This is the same refusal as Apple's base-to-elevated background
  (`B4_REFERENCE_GATE.md` §5) and Material's `tonalElevation` (§9), arriving a third time from a
  third direction, which is a fair measure of how strong the convention is that the B-track declined.
- *"Material weight encodes hierarchy"*, *"Bigger surfaces should read as thicker: stronger blur +
  a deeper shadow"* — QANDEEL has **no shadow scale and no material weight**. B4 creates no
  identity or elevation shadow token.

---

## 2. INSPECTED — NOT APPLICABLE

Each of these was found, hashed and probed. None contributed a rule to B4, and the reason is given
rather than implied.

| skill | scope | why not applicable to B4 |
|---|---|---|
| `ui-ux-pro-max` | plugin | Highest probe counts in the inventory (`dark mode` 19, `alias` 19, `theme` 16, `design system` 8, `design token` 3) — and they are **query examples for a retrieval backend**, not design authority. The skill is an interface to a search service this session does not have, and its own instruction is *"If that retry fails, state that no verified match was found… **Do not persist unverified output.**"* Citing it as a source would break its own rule. Counted, read, and declined. |
| `frontend-design` | plugin ×3, project | Web UI craft. Its probe hits are `card`, `radius`, `shadow` — the exact vocabulary B4.8 exists to forbid. Useful elsewhere in this project; here it is the convention being declined. |
| `impeccable` | user | `design token` 2, `theming` 5, `design system` 3. General front-end quality guidance with no token-format or appearance-API content; nothing it says is specific enough to change a token, a rule or a test. |
| `design-critique` | project | A critique method, not a production-specification method. B4 authors no visual judgement. |
| `emil-design-eng` | project + user | Design-engineering craft; the `Appearance` hits are incidental. B4 builds no components. |
| `fixing-accessibility` | project | Returns **zero** hits on every B4 accessibility probe (`1.4.11`, `high contrast`, `reduce transparency`, `contrast ratio`, `AccessibilityInfo`). The WCAG criteria B4 reasons about are not in it. |
| `designing-arabic-frontends` | plugin + project | Binding authority for B0–B3, which authored layout and Arabic copy. **B4 authors neither.** The token file carries no text, no direction and no layout, and the integration proof renders the sealed package's own accepted compositions unchanged. Declining to cite it here is the honest call: it governed the screens, not the tokens. |
| `react-navigation`, `animate*`, `animations`, `gestures`, `prototype`, `svg`, `rich-text`, `platform`, `assess-react-native-migration`, `upgrading-react-native`, `react-native-brownfield-migration`, `expo-horizon`, `jsi`, `multithreading`, `on-device-ai`, `typegpu`, `audio`, `fishjam`, `moq-kit`, `pulsar-haptics`, `radon-mcp`, `rnrepo`, `create-react-native-library` | user | React Native and media skills with no bearing on a Surface token architecture. `react-navigation`'s three `elevation` hits are navigator shadow defaults — again, the convention being declined. |
| `agent-development`, `build-mcp-*`, `claude-*`, `command-development`, `hook-development`, `mcp-integration`, `plugin-*`, `skill-*`, `session-report`, `project-artifact`, `receipts`, `playground`, `math-olympiad`, `cardputer-buddy`, `m5-onboard`, `access`, `configure`, `example-*`, `writing-rules`, `writing-eloquent-arabic`, `user-research`, `detour-onboarding`, `migrate-to-detour`, `github-actions`, `js-server-sdk`, `python-server-sdk`, `react-client`, `react-native-client`, `react-native-moq`, `enable-worklets-bundle-mode`, `find-animation-opportunities`, `improve-animations`, `review-animations`, `animation-vocabulary`, `moq-kit` | user / plugin / project | Tooling, agent-authoring, server and content skills. Several return high counts on `surface` (`agent-development` 17, `build-mcp-server` 10) and on `lint` — **these are the word "surface" as a verb and linting of plugin manifests**, not UI material. Counted honestly and excluded on inspection rather than on the count. |

`writing-eloquent-arabic` deserves one line of its own: it is binding authority for QANDEEL copy and
was used in B0–B3. **B4 writes no product copy.** Every Arabic string in this package's renders comes
from the sealed predecessor's `b3-model.mjs`, unedited.

---

## 3. NOT AVAILABLE

**13 of 41 probe terms returned zero across all 86 skill trees:**

`DTCG` · `tokens.json` · `$type` · `semantic token` · `primitive token` · `color scheme` ·
`useColorScheme` · `PlatformColor` · `DynamicColorIOS` · `appearance variant` · `tonalElevation` ·
`reduce transparency` · `1.4.11`

That list is this gate's most useful output, and it is unusually clean. Grouped:

1. **No local skill contains the design-token format vocabulary.** `DTCG`, `tokens.json`, `$type`,
   `semantic token` and `primitive token` are all zero. The three `design token` hits are query
   examples in a retrieval skill. **The entire token architecture in `B4_TOKEN_ARCHITECTURE.md`
   rests on the Reference Gate alone**, and `tools/b4-dtcg.mjs` is written from the specification
   source rather than adapted from anything on this machine.
2. **No local skill contains the appearance API.** `useColorScheme`, `PlatformColor`,
   `DynamicColorIOS`, `color scheme` and `appearance variant` are all zero. The eight `Appearance`
   hits are the ordinary English word. **The theme-capability design rests on the React Native and
   Apple sources alone.**
3. **No local skill names the mechanism QANDEEL refuses.** `tonalElevation` is zero — the 14
   `elevation` hits are navigator and animation defaults. Nothing here was going to warn about the
   convention; it had to be read from Material's own source and designed out.
4. **No local skill names the accessibility criteria B4 carries.** `1.4.11` and `reduce
   transparency` are zero, including in `fixing-accessibility`. The `contrast ratio` hits (7) are
   generic. **Those obligations are carried by the Reference Gate alone.**

**What is genuinely missing from this machine, named:** a design-token/DTCG skill, a
theming/appearance skill, and a WCAG-criterion skill. Their absence is not a defect in the machine —
it is the reason `B4_REFERENCE_GATE.md` is as long as it is.

---

## 4. Second source, and the limit of both

`B4_SKILL_INVENTORY.md` §1b records the runtime's own listing of enabled account-level skills:
`docs`, `import-memory`, `morning`, `setup-writing-style`, `skill-creator`, `xlsx`, `pptx`, `pdf`,
`docx` — **nine, of which seven have no `SKILL.md` under any scanned root and cannot be hashed.**
None is relevant to a Surface token architecture.

The two sources answer different questions. The disk walk answers *what is installed and hashable*;
the runtime listing answers *what is enabled at the account level*. Neither is a complete list of
what a session can invoke. **What can be verified is every row in `B4_SKILL_INVENTORY.md` §1, and
that is what every classification above is built on.**

---

## 5. Gate status

**VERIFIED.** 86 skills enumerated and hashed; 0 drift against B3R; 3 USED with named files, quoted
principles and concrete consequences; the remainder classified with reasons; 13 zero-return probes
recorded as obligations the Reference Gate carries alone; one bookkeeping defect in the gate itself
found, fixed and written down.
