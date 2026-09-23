# I-08B3.1-A3 — SKILL GATE — VERIFIED EVIDENCE

**Status: PASSED.** The local skill inventory was inspected reliably; no stop condition was met.

The A2R gate was used as a **baseline to check against, not as something to copy**. The whole
inventory was re-enumerated from disk in this session, every `SKILL.md` was hashed, the hashes
A2 recorded were compared, and the classification below was re-decided against A3's questions —
which are not A2's questions. A3 asks about one reading value, a three-level content ramp, a
small-text weight, and a second raster condition; A2 asked about a World.

Every skill is given exactly one of **USED**, **INSPECTED — NOT APPLICABLE**, or **NOT
AVAILABLE**, with the evidence actually read, the principle actually taken, and the concrete
effect on A3. Nothing is claimed to have influenced work that preceded reading it. No skill is
invented, and no skill is listed that does not exist on this host.

---

## 1. How the inventory was established

Not from what happened to load into the session. Every `SKILL.md` on disk was enumerated across
all three scopes and the SHA-256 of each was recorded, so two installations of the same name can
be told apart and so a change since A2R would be visible rather than assumed away.

| Scope | Path | `SKILL.md` found | A2R baseline |
|---|---|---|---|
| project | `E:\QANDEEL\QANDEEL PROJECT\.claude\skills` | 9 | 9 |
| user | `C:\Users\Al Asil Stores\.claude\skills` | 41 | 41 |
| plugin cache | `C:\Users\Al Asil Stores\.claude\plugins\cache` | 5 | 5 |
| | **total** | **55** | **55** |

`ListSkills` was not used for this. It returns the claude.ai **account** skills, which are a
different set and do not include any of the local specialist skills.

### Hashes checked against the A2R baseline

| Skill | Scope | SHA-256 prefix | A2R recorded | Changed? |
|---|---|---|---|---|
| `frontend-design` | plugin | `D9197063` | `D9197063` | no |
| `frontend-design` | project | `1608EA77` | `1608EA77` | no |
| `designing-arabic-frontends` | project + plugin (identical) | `AB70493B` | `AB70493B` | no |
| `writing-eloquent-arabic` | project + plugin (identical) | `6A673BD7` | `6A673BD7` | no |
| `ui-ux-pro-max` | plugin, v2.13.0 | `EA087C34` | (not recorded at A2R) | version unchanged at 2.13.0 |
| `apple-design` | project | `11840B24` | (not recorded at A2R) | — |
| `impeccable` | user, v4.1.2 | `125F7328` | (not recorded at A2R) | version unchanged at 4.1.2 |
| `fixing-accessibility` | project | `549261E8` | (not recorded at A2R) | — |
| `design-critique` | project | `3A4F260E` | (not recorded at A2R) | — |
| `emil-design-eng` | project + user (identical) | `E71DE849` | (not recorded at A2R) | — |

**No relevant skill changed between A2R and A3.** The four hashes A2R recorded are identical, the
scope counts are identical, and the two versioned skills report the same versions. The six
hashes A2R did not record are captured here so A4 can make the same check without guessing.

`frontend-design` is installed **twice with different content**, so every citation below says
which copy. `designing-arabic-frontends`, `writing-eloquent-arabic` and `emil-design-eng` are
byte-identical across their two installations, so the copy does not matter for those.

## 2. Category probe — run again for A3's vocabulary, not A2's

All 55 files were searched for the terms A3 specifically needs. The result decides what is
genuinely available rather than what sounds available.

| Term | Skills containing it |
|---|---|
| `oklch` | **none** |
| `luminance` | **none** |
| `device pixel ratio` / `devicePixelRatio` / `pixel density` / `deviceScaleFactor` | **none** |
| `raster` | **none** |
| `just noticeable` / `psychophysic` | **none** |
| `long-form` / `reading comfort` / `reading neutral` / `text contrast` | **none** |
| `font weight` | **none** |
| `line length` | `frontend-design` (both copies) |
| `body text` | `frontend-design` (both copies) |
| `small text` | `apple-design` |
| `perceptual` | `animation-vocabulary` (motion easing — not this sense) |

**There is no colour-science skill, no OKLCH skill, no dark-mode skill, no design-system skill,
no typography skill, no render/raster-validation skill and no perceptual-measurement skill on
this host.** That was A1's finding, it was A2's finding, and it is still true. It is stated
rather than worked around, and it is why the conversion mathematics in `tools/color.mjs` comes
from W3C CSS Color 4 directly and carries 40 known-answer tests, and why A3 does not make any
claim of the kind a perceptual study would be needed to support.

---

## 3. The matrix

| Skill | Status | Evidence read | Applied principle | Concrete effect on A3 |
|---|---|---|---|---|
| **`ui-ux-pro-max`** v2.13.0 *(`EA087C34`)* | **USED** | `references/pro-rules.md` — the Light/Dark Mode Contrast table and the pre-delivery checklist, both re-read in this session; `references/quick-reference.md` §6 (`color-dark-mode`, `visual-hierarchy`, `color-contrast`). `scripts/search.py` **still cannot run**: `python` resolves on PATH but is a Microsoft Store alias stub, re-executed here and returning exit 9009 | "**Normal primary and secondary text contrast >= 4.5:1** in both light and dark mode" — the floor is stated for the *secondary* level too, not only the primary. "Tested on **375px (small phone)** and in landscape". `visual-hierarchy`: "Establish hierarchy via size, spacing, contrast — **not color alone**" | Three things that are new at A3. (1) The secondary-level floor is why `HIERARCHY_RAMP.png` measures **Secondary and Tertiary against both surfaces**, not just the Primary — and it is how the Tertiary's shortfall against Apple's 7:1 was found rather than missed. (2) The small-phone checklist item is the direct reason A3.7 exists at all and why the second condition is a **real phone-class width at its real density** rather than a nominal resize. (3) "not colour alone" is why `CONTROL_COLLAPSED_HIERARCHY.png` was rendered: a ramp claim needs a zero-separation floor to be measured against. **The skill's `data/colors.csv` was deliberately NOT used at A3** — A3 makes no claim about any external population, so there is nothing for a reference corpus to support |
| **`frontend-design`** *(plugin, `D9197063`)* | **USED** | Whole file, re-read | Its tell list — "a tracked-out ALL-CAPS eyebrow label above every heading; meta strings joined with middle dots; … a monospace face for small data labels; a '→' appended to link and button text", plus "the SaaS-card kit: content chopped into identical rounded cards … gradient washes as decoration" | Carried forward as **executable refusal**: `assertNoDecor()` in `tools/a3-env.mjs` is 14 patterns run against the exact markup of **every** product frame before it is rasterised, including the three failure captures and both mobile renders. A3's own boards are then held to the same standard: the reading boards are bare columns of type on the World with no hero, no card, no eyebrow and no accent, because a hero treatment on one candidate would be the exact way to make it look stronger |
| **`frontend-design`** *(project, `1608EA77`)* | **USED** | Whole file, re-read | "A near-black background with a single bright acid-green or vermilion accent" is an AI default; "spend your boldness in one place" | A3 spends it in **no** place. There is no accent anywhere in this package, confirmed by preflight check 6, which is a chroma census of the values actually painted (highest chroma 0.0153, ceiling 0.016) plus a vocabulary scan of every text file |
| **`apple-design`** *(`11840B24`)* | **USED** | §15 typography in full; §16 design foundations (Craft); §12 re-checked and again applied as a negative | §15: "**Build hierarchy from weight + size + leading as a set, not size alone.** Emphasize with weight — it adds presence without taking more space." §16 Craft: "every spacing, timing, and alignment value is a deliberate choice you can defend" | §15 is the reasoning behind A3.6 being a **weight** question rather than a colour question: the lever A3 is permitted to use is the 500 weight already inside the frozen role, and the Tertiary colour is left alone. §16 is why every geometry constant in `tools/a3-env.mjs` is a literal with a stated reason and why the mobile geometry refuses to lay out the Analysis Map rather than improvising one. §12's material/translucency hierarchy is again applied as a **negative** — QANDEEL is matte, so the hierarchy job is given to tone and weight alone |
| **`apple-design`** — one rule **refused** | **USED (refused, recorded)** | §15 | "small text wants slightly *positive* tracking for legibility" | **Refused.** That is Latin-derived and is wrong for Arabic, where letter-spacing breaks the connected script outright. The frozen zero-tracking rule wins, and preflight check 10 now verifies it from **computed style on a real render** rather than from the source |
| **`designing-arabic-frontends`** *(`AB70493B`, identical in both installs)* | **USED** | §1 weights, §2 leading, §3 digits, §4 mixed-direction boundaries, §5 letter-spacing | "Avoid weights 100–300 for Arabic at UI sizes"; "Arabic body … need ~1.6+ line-height"; "ONE numeral system per user per view"; "letter-spacing: **never** on Arabic"; LTR islands belong on inline spans | All eight frozen roles were re-checked against the leading rule and all clear it (17/30 = 1.765, 15/25 = 1.667, 14/23 = 1.643, 12/20 = 1.667, 20/33 = 1.650, 26/42 = 1.615, 32/52 = 1.625); every weight used is 400–600, and **A3's move to Metadata 500 makes the small text heavier, which is the direction this skill points**. §5 is enforced three ways at A3: `letter-spacing:0` on every element, a refusal pattern in `assertNoDecor()`, and **preflight check 10, which reads the computed `letter-spacing` and `direction` off a rendered ENVIRONMENT 3 and reports the distinct states found** — an upgrade on A2, which asserted it from source. §4 is why the email value is an inline `dir="ltr"` span |
| **`writing-eloquent-arabic`** *(`6A673BD7`)* | **USED** | Overview, register table, and the eight failure modes in full | "If a sentence can be back-translated to the exact English word-for-word, it is probably calqued"; the modes `english-word-order` (trailing time adverbial, fronted intro clause, SVO in فصحى), `weak-connector` (choppy full stop between bound ideas) | **A3 adds two paragraphs of Arabic to the shared corpus**, because A3.3 asks for *sustained* reading and four paragraphs is a sample rather than a session. Both were then checked against the eight modes and **both changed**: `ولا تكلف شيئًا الآن` (trailing time adverbial) became `ولا ثمن لها بعد`; `حين يظل … أما حين` became `ما دام … فإذا` so the verb leads; and `هو وصف لنمط` (bare-pronoun opening, and a choppy full stop between two bound ideas) became the idiomatic `ليس … وإنما`, which binds them. The four inherited paragraphs were reviewed against the same modes and **left unchanged** — they were composed for QANDEEL, they trip nothing, and rewriting them would break comparability with the A2 rasters for no gain. The new copy is identical for the control and both finalists, so fairness is unaffected |
| **`impeccable`** v4.1.2 *(`125F7328`)* | **USED** | `SKILL.md`; `reference/craft-floor.md` in full; `reference/audit.md` re-checked | craft-floor: "**Contrast:** body and placeholder text ≥4.5:1, large text ≥3:1 … never gray"; "A kicker or eyebrow above a heading. **This one is a ban, not a default**"; "tight groups, generous separation" | The contrast floor was re-verified against all three candidates on **both** surfaces and every value clears it — which is precisely why A3_FINDINGS says a ratio cannot decide this board and the raster has to. No product region in this package carries an eyebrow or a kicker. `audit.md`'s "structure interchangeable with an unrelated product" dimension was **deliberately not re-run**: A2 answered it with the swap test, the Director has since settled the World direction, and re-running it at A3 would be decoration |
| **`impeccable`** — two rules **refused** | **USED (refused, recorded)** | Same | (a) "body measure **65–75ch**"; (b) "Depth: shadows carry an offset and a soft blur" | (a) **Conflicts** with the frozen 520–600 px Arabic comfort zone — `ch` is a Latin metric and Estedad's Arabic advance widths make the two incompatible. The frozen zone wins; 560 px is used on every desktop reading board. At the mobile condition the measure is 350 px, which neither rule chooses — the device imposes it — and A3_FINDINGS records that as a limit on what that condition proves. (b) **Refused outright**: shadow is one of the 14 refusal patterns, QANDEEL is matte, and depth here is tone alone |
| **`fixing-accessibility`** *(`549261E8`)* | **USED** — narrowly | Priority table; §7 contrast and states | "Disabled states must not rely on colour alone"; "ensure sufficient contrast for text and icons" | The unavailable row in ENVIRONMENT 4 says **غير متاح الآن** in words and gives the reason underneath as well as dropping to the Tertiary tone. Reported as narrow: this is a component-level skill and it was not otherwise load-bearing at A3, because A3 changes no component and adds no control |
| **`design-critique`** *(`3A4F260E`)* | **USED** — dimensions only, format refused | Whole file | "Be specific, explain why, acknowledge what works, match the stage" | Shaped the shape of A3_FINDINGS: what the boards show, what holds, what does not, what remains open. Its mandated severity table and "Priority Recommendations 1 / 2 / 3" are **refused again** — A3 is forbidden to rank the finalists, and a priority list would be a ranking wearing a different hat |
| **`user-research`** *(`FA18FC13`)* | **INSPECTED — NOT APPLICABLE**, and load-bearing as an absence | Scope and posture | Study planning: participants, recruitment, protocol | Nothing was taken from it and no study was run — and that is exactly why **A3_FINDINGS contains no perceptual-threshold claim of any kind**. The A2R correction that controlled renders are not a psychophysical study is carried forward as a standing constraint on A3's wording, not as a thing to be worked around |
| `emil-design-eng` *(`E71DE849`)* | **INSPECTED — NOT APPLICABLE** | Full section list; "Component Building Principles" checked specifically | Every rule in it is about motion or state transition — press response, origin-aware popovers, tooltip delay, interruptible transitions, spring parameters | Nothing. A3 renders static rasters with no interaction and no motion. No influence is claimed |
| `prototype` *(`2AD8401C`)* | **INSPECTED — NOT APPLICABLE** | Frontmatter and posture | `disable-model-invocation: true` — user-invoked only | Nothing, and it could not have been invoked. Its model — several genuinely different versions behind a picker — is also the opposite of what A3 needs, which is two variants differing in exactly one dimension |
| `review-animations` *(`61CF8AC0`)* | **INSPECTED — NOT AVAILABLE TO INVOKE** | Frontmatter | `disable-model-invocation: true`; reviews motion code only | Nothing. A3 contains no motion code |
| `radon-mcp` *(`1391DEAC`)* | **INSPECTED — NOT APPLICABLE** | Frontmatter | Radon IDE MCP tools for live React Native app inspection | Nothing. Those MCP tools are not connected in this session. Worth noting for a later stage: this is the kind of tool that could answer the **native** point-parity question A3 explicitly does not answer |
| 41 user-scope React Native / Expo / animation / media / tooling skills, including the nested `rich-text`, `svg`, `platform`, `animations`, `gestures` sub-skills | **INSPECTED — NOT APPLICABLE** | Names **and** descriptions; the five nested ones were opened again because their bare names sound in scope | — | Not used. Padding the gate is forbidden, and a skill dismissed from its name alone has not been inspected — which is why these five were opened rather than assumed |
| Dedicated **colour-science / OKLCH** skill | **NOT AVAILABLE** | Directory scan of all three scopes; keyword probe over all 55 files | — | Conversion and contrast built from W3C CSS Color 4 and WCAG 2.2 directly, with 40 known-answer tests in `tools/color.test.mjs`, all passing in this tree |
| Dedicated **dark-mode**, **design-system**, **typography** skill | **NOT AVAILABLE** | Same | — | Depth and content-role models taken from Apple HIG Dark Mode and Material 3 colour roles instead — see `A3_REFERENCE_GATE.md` |
| Dedicated **render / raster-validation / visual-regression** skill | **NOT AVAILABLE** | Same — `raster`, `deviceScaleFactor` and `pixel density` return zero across all 55 files | — | The render guards in `tools/a3-render.mjs` (font fingerprint, overflow, blank render, forced sRGB, forced greyscale AA, raster-width assertion, devicePixelRatio assertion) and the structural fairness proof in `tools/a3-fairness.mjs` were written for this package |
| Dedicated **perceptual measurement / psychophysics** skill | **NOT AVAILABLE** | Same — `just noticeable` and `psychophysic` return zero | — | No perceptual-threshold claim is made anywhere in A3. Every statement about what separates is a statement about **these boards under these conditions** |

---

## 4. Honest notes

- **Nothing in this package was built before the skill that is credited with it was read.** The
  secondary-level contrast floor, the mobile condition, the collapsed-hierarchy control, the
  computed-style direction check and both Arabic copy revisions were all written after the
  corresponding file was opened, in this session.
- **`writing-eloquent-arabic` was NOT read during A2**, where it was classified
  INSPECTED — NOT APPLICABLE on the grounds that the copy was frozen. At A3 the copy is not
  entirely frozen — two paragraphs are new — so the skill became applicable, was read, and
  **changed both of them**. That reclassification is the reason the gate is re-decided rather
  than copied.
- **`ui-ux-pro-max`'s reference palette corpus was deliberately not used.** A2R established
  what it is entitled to support; A3 makes no claim about any external population, so using it
  would be ornamental.
- **Python remains absent** despite `python.exe` appearing on PATH; the Store alias stub was
  executed again in this session and returned exit 9009. `search.py` therefore did not run, in
  A1, A2 or A3.
- **Four skills contributed rules that were refused**, and the refusals are recorded above
  rather than quietly dropped: `apple-design`'s positive small-text tracking, `impeccable`'s
  `ch` measure rule and its shadow-based depth rule, and `design-critique`'s ranked output.
