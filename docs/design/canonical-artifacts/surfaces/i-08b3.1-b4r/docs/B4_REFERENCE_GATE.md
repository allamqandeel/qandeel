# B4_REFERENCE_GATE

**I-08B3.1-B4 — SURFACE SYSTEM: INTEGRATION + PRODUCTION SPECIFICATION + FREEZE**
Primary-source refresh performed **2026-09-21**, before any production specification was authored.

Every entry below records four things, because three of them are what a citation usually leaves out:

1. **the exact source and version**, and how it was reached;
2. **the principle**, quoted where the wording carries the weight;
3. **the concrete production consequence** for this package — a file, a token, a rule or a test;
4. **what QANDEEL explicitly does NOT inherit**, where that applies.

---

## 0. What could not be retrieved, and what was substituted

This section is first because a gate that only lists successes is a gate whose failures are invisible.

### 0.1 The rendered DTCG technical reports were unreachable from this environment

`https://www.designtokens.org/tr/2025.10/format/`, `https://tr.designtokens.org/format/`,
`https://second-editors-draft.tr.designtokens.org/format/` and
`https://www.designtokens.org/schemas/2025.10/format.json` each returned no content through the
fetch tool. The in-app browser was **denied the `designtokens.org` origin** by policy, so the
rendered documents could not be read there either. Four URLs, two independent transports.

**Substituted:** the **repository source of the same technical reports**, at
`github.com/design-tokens/community-group`, `main` branch — `technical-reports/format/*.md`,
`technical-reports/color/*.md` and `technical-reports/resolver/*.md`. These are the documents the
published report is built from, not a third-party summary.

**The limitation, stated rather than buried:** the repository `main` branch is not a frozen snapshot
of the 2025.10 publication, so it may carry editorial changes made after 2025-10-28. The version
string and date were confirmed independently from the **W3C Community Group announcement**
(`w3.org/community/design-tokens/2025/10/28/...`), which states version **2025.10**, published
**28 October 2025**, and gives the specification's home as `designtokens.org/tr/2025.10/`.

> ### 0.1.1 THE DISCLOSED RISK MATERIALISED — B4R-REV-01
>
> **An independent freeze review reached the published report and found the resolver document
> non-conformant.** The paragraph above is not a near-miss that was written down and survived: it
> names the exact mechanism that then produced a real defect. That is worth more than a clean record.
>
> **What was wrong.** `tokens/qandeel-surface.resolver.json` declared `sets` and `modifiers` as
> **arrays** of named objects and a `resolutionOrder` of `{ type, name }` pairs. The stable 2025.10
> Resolver Module declares `sets` as `Map[string, Set]` and `modifiers` as `Map[string, Modifier]`;
> a root-declared set or modifier is named from `resolutionOrder` by a **reference object**,
> `{ "$ref": "#/sets/semantic" }`. The `{ type, name }` form is genuine but belongs to a set or
> modifier declared **inline**, where `name` and `type` are added *on top of* the body. B4 wrote the
> inline form's marker keys with neither a body nor a reference: a shape that is neither of the two
> the specification defines. The official schema rejects it in **17 places**.
>
> **Why `main` was the wrong pin, precisely.** The repository has **no `2025.10` tag** — its only
> tags are `first-public-draft`, `editors-drafts/1` and `editors-drafts/2` — so `main` is a moving
> editor's draft, not a release. `technical-reports/resolver/syntax.md` has been committed **four
> times since** the publication commit (`f0f32a7dce0b`, 2025-10-28, *"Publish 2025.10"*): #352 and
> #357 (version), #356 (adds the JSON Schema) and #408 (version field type). Reading `main` meant
> reading post-publication drafting.
>
> **What supersedes it.** For resolver syntax, the authority is now the **publication commit**
> `f0f32a7dce0b` of `technical-reports/resolver/*.md`, and the **official JSON Schema**, vendored
> into `schemas/2025.10/` and enforced by `tools/b4r-schema.mjs`. Where the report text and the
> schema could differ on syntax, **the schema wins** — that is this package's standing rule, and it
> is the rule that would have prevented the defect.
>
> **One place where the publication commit is *not* authoritative, stated because it cuts against
> the pin.** At `f0f32a7dce0b` the report contradicts itself on the version literal: the root-property
> table says the type is `YYYY-MM-DD` and the value must be `2025-10-01`, while the prose immediately
> below says it must be `2025-11-01`. Neither is what the specification settled on. The official
> schema constrains `version` to `const: "2025.10"`, and commits #352, #357 and #408 are the repair
> of exactly this. QANDEEL ships `"version": "2025.10"` — unchanged from B4, and correct. *A pin is a
> defence against drift, not a claim that the pinned text is flawless; where it is self-contradictory
> the schema settles it.*
>
> **Retrieval, again.** `designtokens.org` remained unreachable from this environment for B4R on
> **three** transports — the fetch tool, direct HTTPS from the host (`Unable to connect to the remote
> server`) and the in-app browser (origin denied). `raw.githubusercontent.com` **is** reachable
> directly, so the schema bytes were retrieved, hashed, and pinned rather than summarised. Each
> vendored file's **git blob SHA-1 was recomputed locally and matches the blob sha the GitHub tree
> API reports** for the official repository — 22 of 22 — so "this is the official file" is a checked
> statement here, not a filename. `schemas/schemas.config.json` declares
> `outputDirs: ["dist", "../www/public/schemas"]`, which is how these sources become the files
> `designtokens.org/schemas/` serves.

**How the package errs, given that:** `tools/b4-dtcg.mjs` implements the spec's *constraints* and
QANDEEL's own rules are enforced separately in `tools/b4-invariants.mjs`. Where the two could be
confused — the list of permitted colour spaces, for instance — the implementation accepts the
spec's full set and the package's narrower rule (sRGB only) is applied by a QANDEEL check that says
so. A later correction to the spec text would therefore loosen or tighten a *conformance* message,
not change what QANDEEL froze.

### 0.2 Several vendor documentation pages are client-rendered

`reactnative.dev/docs/*`, `m3.material.io/*`, `developer.android.com/reference/*` and
`developer.apple.com/design/*` returned navigation shells with no body text.

**Substituted, in every case, with the source the page is generated from:**

| page | substituted with |
|---|---|
| reactnative.dev/docs/appearance, /accessibilityinfo | `github.com/react/react-native-website`, `main`, `docs/appearance.md`, `docs/accessibilityinfo.md` |
| Apple HIG Dark Mode, Color | `developer.apple.com/tutorials/data/design/human-interface-guidelines/{dark-mode,color}.json` — the JSON the HIG page renders from |
| Compose `Surface` / `ColorScheme` | `github.com/androidx/androidx`, `androidx-main`, `compose/material3/.../Surface.kt`, `ColorScheme.kt` |
| Material Components elevation-overlay change | `github.com/material-components/material-components-android`, release `1.11.0` notes |

Apple's HIG JSON and the androidx Kotlin sources are **more** primary than the rendered pages, not
less. The React Native website repository is the docs' own source of truth.

---

## 1. Design Tokens Community Group — Format Module 2025.10

**Source.** DTCG Format Module, version **2025.10** (first stable, 2025-10-28), read from the
technical-report source: `format/design-token.md`, `format/groups.md`, `format/aliases.md`.

### 1.1 What a token is

> "An object with a `$value` property is a token. Thus, `$value` is a reserved word."

A group is an object **without** `$value`. An object carrying both `$value` and child members is an
invalid structure that tools must flag.

**Consequence.** `tools/b4-dtcg.mjs` `parse()` classifies on the presence of `$value` and reports
the both-at-once case as an error. Validation probe `v-n1` is exactly that structure, and it is
rejected. Nothing in a diff makes this failure visible; only a parser does.

### 1.2 Typing and group inheritance

> "The `$type` property MUST be a plain JSON string, whose value is one of the values specified in
> this specification's respective type definitions."

> "A token must either have a `$type` property specifying the chosen type, inherit a type from one
> of its parent groups, or be an alias of a token that has the desired type."

**Consequence.** `$type: "color"` is declared **once** on the root `qandeel` group of
`tokens/base/semantic.tokens.json` and inherited by all seventeen tokens — group inheritance used,
not merely described.

**And a correction this rule forced.** `tokens/appearance/dark.tokens.json` originally relied on the
semantic layer's root group for its typing. It resolved perfectly in every real build and was an
**invalid DTCG document on its own** — every token in it untyped. Validation check V-01 caught it.
`$type` is now declared in the appearance source as well. A source file that cannot be validated by
itself is a source file whose errors only surface once it is someone else's problem.

### 1.3 Names

> Names "cannot begin with `$` or contain: `{`, `}`, or `.` (period)."

**Consequence.** Enforced in `parse()`. It also settles a question the brief raises: the conceptual
`surface.role.apparatus.fill` is expressed as **nested groups**, never as a dotted name.

### 1.4 Aliases

> "The curly brace syntax is specifically designed for referencing complete token values and always
> resolves to the `$value` property of the target token."

> "Aliases MAY reference other aliases. In this case, tools MUST follow each reference until they
> find a token with an explicit value."

> "References MUST NOT be circular. If a design token file contains circular references, then the
> value of all tokens in that chain is unknown and an appropriate error or warning message SHOULD be
> displayed to the user."

**Consequence, and it is the central one in this package.** Deep aliases being legal is what makes
the three-tier architecture possible: `role.aside.fill → surface.functional → expression.surface`.
`resolve()` follows the chain **and keeps it**, because the one-tone invariant is a statement about
chains. Four tokens each holding the literal `#181818` resolve to four equal colours and would
satisfy any value comparison; they are precisely the duplication the brief forbids. Only the chain
tells those two situations apart. Cycles are detected and reported as `CIRCULAR`; probe `v-n2` is a
cycle and is rejected.

**Not inherited.** The spec also requires JSON Pointer support for property-level references. This
package authors none — every reference here is a whole-token alias — so pointer resolution is not
implemented rather than implemented badly.

---

## 2. DTCG — Color Module 2025.10

**Source.** `technical-reports/color/color-type.md`, same repository and branch.

**Principle.** A colour `$value` is an object: `colorSpace` and `components` required, `alpha` and
`hex` optional. Components are numbers or the `none` keyword. For sRGB, components are `[R, G, B]`,
each **ranging 0 to 1**.

> "If omitted, the alpha value of the color MUST be assumed to be 1 (fully opaque)."

> `hex` "MUST be formatted in 6 digit CSS hex color notation format to avoid conflicts with the
> provided alpha value."

**Consequences.**

- Every QANDEEL colour token carries `colorSpace: "srgb"`, `components` and a 6-digit `hex`
  fallback. The generator computes components from the sealed hex, recomputes the hex from the
  components, and **refuses to write the file if they disagree** — otherwise a conforming reader
  (components) and a legacy reader (hex) could paint different colours with nothing in the JSON
  looking wrong.
- Alpha-defaults-to-1 is implemented once, in `alphaOf()`, and is what makes invariant INV-11
  expressible: every Surface token is opaque, so Reduce Transparency is the identity on it.
- The 0..1 range is enforced **for the RGB family only**. This caught a real hole: probe `v-n3`
  pastes 8-bit values into `components`, which is the single most natural mistake anyone who has
  ever written a hex could make, and **every serialiser clamps them silently** — a `[24, 24, 24]`
  Surface becomes white with no error anywhere. The other colour spaces are deliberately not
  range-checked, because their ranges were not among the text read for this package and a guessed
  range is worse than no range.

**Not inherited.** The Module defines sixteen colour spaces including Display P3 and OKLCH. QANDEEL
authors **sRGB only** in the token file. OKLCH remains the *analysis* space throughout the B-track —
it is how the values were chosen and measured — but the shipped token expresses what a display
paints, which is what WCAG is defined over and what a component consumes.

---

## 3. DTCG — Resolver Module 2025.10 — **CORRECTED IN I-08B3.1-B4R**

**Source.** `technical-reports/resolver/syntax.md` and `resolution-logic.md` **pinned to the
publication commit `f0f32a7dce0b` (2025-10-28, "Publish 2025.10")**, and the **official JSON Schema**
`https://www.designtokens.org/schemas/2025.10/resolver.json` together with its three sub-schemas,
vendored under `schemas/2025.10/` with per-file provenance. Superseding B4's use of repo `main`
(§0.1.1).

**Principle — structure.** A resolver document requires `version` (`const: "2025.10"`) and
`resolutionOrder`; the schema sets `additionalProperties: false` at the root. `sets` is
**`Map[string, Set]`** and `modifiers` is **`Map[string, Modifier]`** — *the name is the key.* A Set
requires `sources`; a Modifier requires `contexts` and may carry a `default`. `resolutionOrder` is a
non-empty array whose items are **`oneOf`**: a reference object (`$ref`), an inline Set
(`sources` + `name` + `type: "set"`), or an inline Modifier (`contexts` + `name` + `type: "modifier"`).
Root-declared sets and modifiers are referenced as `#/sets/<name>` and `#/modifiers/<name>`; nothing
may reference `#/resolutionOrder/…`, and sets and modifiers may not reference a modifier.

**Principle — obligations placed on tools, not on syntax.** The report requires a tool to throw when
a modifier's `default` is not one of its `contexts`, and when an inline `name` is duplicated within
`resolutionOrder`. The official schema **says in its own `$comment` that JSON Schema cannot express
either**. It also cannot know whether a `$ref` lands on a declared set. The report says a modifier
*SHOULD* have two or more contexts; the schema is stricter, `minProperties: 2`.

**Consequence.** `tokens/qandeel-surface.resolver.json` declares one set (`semantic`) and **two**
modifiers — `appearance` ∈ {dark, light} and `contrast` ∈ {standard, increased} — as **maps**, with
a `resolutionOrder` of three **reference objects**, giving four representable combinations, one of
which has values today. Conformance is settled by **two validators that partition the specification**:
`tools/b4r-schema.mjs` runs the official schema through **ajv**, a third-party implementation
(S-01…S-05); `V-11` covers the runtime obligations the schema delegates. Five negative probes are run
through **both**, and probes D and E — an undeclared `$ref` and a bad `default` — are **accepted by
the official schema and rejected only by V-11**, which is why replacing the custom validator with
schema validation would have been a downgrade disguised as rigour.

**Why two modifiers rather than one three-context `theme`.** See §5: Apple asks for light and dark
variants **and an increased-contrast option for each variant**. Increased contrast is an override
applied *within* an appearance, not a third appearance. A single modifier would have modelled
QANDEEL's future wrongly, and the wrongness would only have surfaced when someone tried to build
dark + increased contrast and found it unrepresentable.

---

## 4. DTCG — colour token naming guidance

**Source.** `technical-reports/color/token-naming.md`.

**Principle.** The guidance distinguishes **base**, **alias** and **component** tokens, and for base
tokens describes ordered scales (`color.blue.100` … `.900`), bounded scales and computer-generated
scales. For alias tokens it advises "grouping tokens with similar intentions by prioritizing the
category + property" and "avoid abbreviations. For example, use 'background' instead of 'bg.'"

**Consequence.** The three-tier structure follows the base/alias distinction directly: tier 1 is
base, tiers 2 and 3 are aliases. No abbreviations appear in any token name.

**Not inherited — and this is a deliberate refusal, not an oversight.** QANDEEL adopts **no
numbered scale of any kind**. An ordered scale is a set of names for a set of distinctions; QANDEEL
has one Surface tone, so a scale would be names for distinctions that do not exist, and the names
would then invite the distinctions. Invariant INV-07 forbids any token path encoding a level, step,
tier or depth, and INV-10 forbids z-order vocabulary. This is the point at which a conventional
design system would quietly be created, and the invariants exist to make that impossible rather than
merely discouraged.

---

## 5. Apple — Dark Mode, and adaptive custom colours

**Source.** Apple Human Interface Guidelines, *Dark Mode* and *Color*, read from the HIG data JSON,
2026-09-21.

**Principles.**

> "Embrace colors that adapt to the current appearance. … When you need a custom color, add a Color
> Set asset to your app's asset catalog in Xcode, and specify the bright and dim variants of the
> color. **Avoid using hard-coded color values or colors that don't adapt.**"

> "If you define a custom color, make sure to supply **light and dark variants, and an increased
> contrast option for each variant** that provides a significantly higher amount of visual
> differentiation."

> "Avoid hard-coding system color values in your app. Documented color values are for your reference
> during the app design process. The actual color values may fluctuate from release to release."

> "Test your content to make sure that it remains comfortably legible in both appearance modes. For
> example, in Dark Mode with Increase Contrast and Reduce Transparency turned on (both separately
> and together)…"

> "In rare cases, consider using only a dark appearance in the interface."

**Consequences.**

- *Never hard-code* is the architecture: components consume semantic tokens, never `#181818`.
  `B4_REACT_NATIVE_MAPPING.md` states it as a rule and INV-02 tests the token-file half of it.
- *Light and dark variants, plus an increased-contrast option for each* is why `contrast` is a
  separate modifier (§3).
- *Dark-only is acceptable in rare cases* is the honest citation for QANDEEL being **dark-led**. It
  is not a licence to be dark-**locked**, which is why the semantic layer names nothing an
  appearance owns (INV-12).

**Not inherited, and named because it is the closest call in this gate.** Apple's iOS guidance says:

> "Prefer the system background colors. Dark Mode is dynamic, which means that the background color
> automatically changes **from base to elevated** when an interface is in the foreground, such as a
> popover or modal sheet."

That is a platform system **raising the background tone for exactly the two things QANDEEL calls
ASIDE and PASSAGE**. QANDEEL does not inherit it. The B-track's accepted finding is that a PASSAGE
is told apart by occlusion, a uniform scrim and modal behaviour, not by being lighter than the layer
below it; B3 proved the one-tone N2 overlap survives. Apple's own text says the cost of declining is
that people lose a system-provided visual distinction — recorded here as a known, accepted cost
rather than an unnoticed one.

---

## 6. Apple — inclusive colour

**Source.** HIG *Color*, same read.

> "Avoid relying solely on color to differentiate between objects, indicate interactivity, or
> communicate essential information. … you can use text labels or glyph shapes to identify objects
> or states."

**Consequence.** This is the platform statement of a rule the B-track reached independently. B3's
unavailable action carries its unavailability **lexically** — the row says so — rather than through
a greyed colour, precisely because B3 was forbidden from inventing a status colour. `B4.6`'s ASIDE
contract carries that forward as a production rule, and the final interaction/status colours remain
deferred to I-08B3.1-E.

---

## 7. React Native — Appearance and useColorScheme

**Source.** `react-native-website`, `main`, `docs/appearance.md`, `docs/usecolorscheme.md`.

**Principles.**

- `Appearance.getColorScheme(): 'light' | 'dark' | null` — "This value may change at runtime, either
  at the system level … or when overridden at the app level via `setColorScheme()`."
- `Appearance.setColorScheme('light' | 'dark' | 'auto' | 'unspecified')` — enforces an interface
  style at the application level without affecting system settings or other apps. `'unspecified'` is
  deprecated.
- `Appearance.addChangeListener(listener)` — on iOS and Android the callback's `colorScheme` is
  always `'light'` or `'dark'`.
- `useColorScheme()` returns `'light' | 'dark' | null` and subscribes to updates; the value "may be
  updated later, either through direct user action … or on a schedule".

**Consequences.** `B4_REACT_NATIVE_MAPPING.md` specifies that appearance resolution happens **once,
at a theme provider**, from `useColorScheme()` — not per component, and never by reading a colour
constant. The DTCG `appearance` modifier maps one-to-one onto this hook's two meaningful values.
`null` is mapped explicitly to the **dark** default rather than left to a falsy check, because
QANDEEL is dark-led and a `null` that silently became light would be a theme nobody designed.

**Not inherited.** `setColorScheme()` gives an app its own appearance override. Apple's guidance is
to **avoid** an app-specific appearance setting ("people may think your app is broken because it
doesn't respond to their systemwide appearance choice"). QANDEEL follows Apple here: the override
exists in the platform and is deliberately not exposed as a product setting. Recorded so that a
future request for an in-app theme switch meets a decision rather than a blank.

---

## 8. React Native — AccessibilityInfo

**Source.** `react-native-website`, `main`, `docs/accessibilityinfo.md`.

**Principle — the platform support matrix, which is the part that matters:**

| capability | availability |
|---|---|
| `isReduceTransparencyEnabled()` / `reduceTransparencyChanged` | **iOS only** |
| `isHighTextContrastEnabled()` | **Android only** |
| `isDarkerSystemColorsEnabled()` | **iOS only** |
| `isReduceMotionEnabled()` / `reduceMotionChanged` | cross-platform |
| `isBoldTextEnabled()`, `isGrayscaleEnabled()`, `isInvertColorsEnabled()`, `prefersCrossFadeTransitions()` | **iOS only** |
| `isScreenReaderEnabled()` | cross-platform |

**Consequences.**

- **Reduce Transparency is iOS-only and QANDEEL needs no branch for it.** The canonical Surface is
  opaque matte, so the transform is the identity: there is nothing to undo. INV-11 proves this at
  the token layer, and B3 measured it at the pixel layer — 0 of 5,235,264 pixels changed. This is
  the rare case where a platform capability requires *no* code, and the reason is recorded so that
  nobody later adds a branch to be safe.
- **Increased contrast is expressed by two different, single-platform APIs.** iOS surfaces
  `isDarkerSystemColorsEnabled()`; Android surfaces `isHighTextContrastEnabled()`. There is no
  cross-platform "increase contrast" signal. `B4_REACT_NATIVE_MAPPING.md` therefore specifies the
  `contrast` modifier's **input** as a product-level resolution of both signals, and the values it
  would resolve to remain unassigned and owned by I-08B3.1-F.

---

## 9. Material 3 — inspected ONLY to record what is not inherited

**Sources.** `androidx-main`, `compose/material3/.../Surface.kt` and `ColorScheme.kt`;
material-components-android release 1.11.0 notes.

**Principle, quoted because the sentence is the mechanism:**

> "When [color] is [ColorScheme.surface], a higher the elevation will result in a darker color in
> light theme and **lighter color in dark theme**." — `Surface.kt` KDoc, `tonalElevation`

> "This color will be used by components that apply tonal elevation and is applied on top of
> [surface]. **The higher the elevation the more this color is used.**" — `ColorScheme.kt`,
> `surfaceTint`

> "Elevation Overlays within default component styles have been replaced by the new Tonal Surface
> Color system." — material-components-android 1.11.0

`ColorScheme` declares `surface`, `surfaceDim`, `surfaceBright`, `surfaceContainerLowest`,
`surfaceContainerLow`, `surfaceContainer`, `surfaceContainerHigh`, `surfaceContainerHighest`,
`surfaceVariant`, `surfaceTint`, `inverseSurface` and `scrim` — **eleven surface roles and a scrim.**

**NOT INHERITED — the complete list:**

| Material 3 mechanism | QANDEEL |
|---|---|
| `tonalElevation` deriving a lighter dark-theme surface from an elevation value | **No elevation function exists.** INV-10 tests it three ways: no z-order vocabulary in any token path, no colour-deriving expression in any `$extensions`, and exactly one literal Surface value in the whole system — so such a function would have a domain and **no range**. Probe `n12` is this mechanism arriving as metadata, and is rejected. |
| `surfaceTint` blending the primary colour into raised surfaces | **No brand colour controls the Surface.** INV-09 requires the Surface source to be a literal that nothing aliases into. Probe `n9` is an accent quietly taking over, and is rejected. |
| A ladder of eight `surfaceContainer*` roles | **One functional Surface.** Four Product roles, one source token, chains checked by INV-01. |
| `surfaceDim` / `surfaceBright` | Not present. INV-07 forbids `dim` and `bright` as token-path words. |
| `inverseSurface` | Not present; QANDEEL has no inverted region. |
| `scrim` as a colour role | **Adopted in substance, not in structure.** QANDEEL has exactly one scrim and it belongs to PASSAGE alone, because a scrim follows from blocking. INV-06 tests the *absence* on the other three roles, not just the presence on PASSAGE. |

The B3 Reference Gate already recorded Material 3's measured dark values
(`surface #141218`, `surface-container-high #2b2930`, `scrim #000000`) as calibration. B4 adds the
*function*, which is the part a production specification has to refuse explicitly — a value can be
declined by not typing it, but a function has to be designed out.

---

## 10. W3C — WCAG 2.2

**Sources.** `w3.org/WAI/WCAG22/Understanding/` — `non-text-contrast`, `focus-not-obscured-minimum`,
`focus-appearance`. Read directly; `w3.org` was reachable.

### 10.1 SC 1.4.11 Non-text Contrast (AA)

> "The visual presentation of the following have a contrast ratio of at least 3:1 against adjacent
> color(s): **User Interface Components** — Visual information required to identify user interface
> components and states, except for inactive components or where the appearance of the component is
> determined by the user agent and not modified by the author; **Graphical Objects** — Parts of
> graphics required to understand the content, except when a particular presentation of graphics is
> essential to the information being conveyed."

**Consequences.**

- The Class S structural boundary is frozen as **load-bearing only, ≥ 3:1 where 1.4.11 applies, 1
  logical/CSS px as the proven normal baseline**. Its **colour is not frozen** — B1/B3 used an
  achromatic diagnostic and B4 is explicitly forbidden from freezing it. See
  `B4_PROOF_TO_PRODUCTION_MAP.md`.
- A Map relation stroke is a **graphical object**, not text, and is therefore governed by this
  criterion rather than by the Loss Test.
- **And the honest figure.** The PASSAGE panel measures **1.128:1** against the World it suspends
  (§ `B4_VALIDATION_RESULTS.md` B4.4). The scrim improves that boundary by a factor of 1.053 — from
  1.072:1 — which is real and small. The PASSAGE is not told apart from the suspended World by
  tonal contrast at its edge; it is told apart by occlusion, by the uniform scrim over everything
  else, and by modal behaviour. That is the frozen B0R mechanism, measured in production form. **If
  a later accessibility expression requires this boundary to clear 3:1, the answer is a Class S line
  on the PASSAGE, and its colour is not B4's to choose.** Recorded as an open dependency.

### 10.2 SC 2.4.11 Focus Not Obscured (Minimum) (AA)

> "When a user interface component receives keyboard focus, the component is not entirely hidden due
> to author-created content."

Modal dialogs pass when properly constructed, because they take focus and keep it. Non-modal
overlays that let focus move behind them risk failing.

**Consequence.** Carried from B3R unchanged. It is the criterion behind the ASIDE contract's
requirement that the World stay live *and* operable, and behind the PASSAGE contract's focus
obligations. B3R proved all four lifecycle obligations behaviourally; B4 carries them into
`B4_SURFACE_ROLE_CONTRACTS.md` and `B4_REACT_NATIVE_MAPPING.md` rather than re-proving them.

### 10.3 SC 2.4.13 Focus Appearance (AAA)

> "When the keyboard focus indicator is visible, an area of the focus indicator meets all the
> following: is at least as large as the area of a **2 CSS pixel thick perimeter** of the unfocused
> component or sub-component, and has a **contrast ratio of at least 3:1** between the same pixels
> in the focused and unfocused states."

**Consequence.** The focus indicator is an **area** requirement, which a 1 px structural line cannot
satisfy however high its contrast — the reason B3's diagnostic ring is 2 px. The **final focus
token, including its colour, is deferred to I-08B3.1-E/F** and B4 freezes nothing about it. The
token file deliberately does not supply `--focus-ring` or `--focus-w`; the integration render keeps
them at their B3 diagnostic values in both variants, which is the proof-to-production split in
executable form.

---

## 11. What this gate does NOT establish

- It does not establish a Light appearance. No source consulted here contains QANDEEL's light
  values, because they do not exist. The architecture is built so that resolving into Light
  **fails loudly** rather than returning dark values or an invented colour (check V-09).
- It does not establish a final Class S colour, focus colour, status colour or accessibility
  alternate expression. Those belong to I-08B3.1-E and I-08B3.1-F.
- It does not establish anything about motion, Living Brass (I-08B3.1-C) or QANDEEL Light
  (I-08B3.1-D).
- It does not establish screen-reader behaviour. B3R's D-6 remains open: the lifecycle evidence is
  keyboard-only, one engine.

---

## 12. Source ledger

| # | source | version / branch | reached via | used in |
|---|---|---|---|---|
| 1 | DTCG Format Module | 2025.10 (repo `main`) | repository source; rendered report unreachable (§0.1) | `b4-dtcg.mjs`, token architecture |
| 2 | DTCG Color Module | 2025.10 (repo `main`) | repository source | colour value shape, range check |
| 3 | DTCG Resolver Module — report | 2025.10, **publication commit `f0f32a7dce0b`** | repository source, pinned (§0.1.1) | resolver manifest, theme capability |
| 3a | **DTCG Resolver JSON Schema** (+3 sub-schemas) | **2025.10, official, vendored** | `raw.githubusercontent.com`, blob shas verified | S-02 conformance; supersedes `main` on syntax |
| 3b | **DTCG Format JSON Schema** (+17 refs) | **2025.10, official, vendored** | same | S-03: all 6 token files |
| 3c | **ajv 8.18.0** | third-party JSON Schema implementation | repository `node_modules` | the validator this package did **not** author |
| 3d | React Native — `Modal` | docs `main` | docs repository source | `onRequestClose` scope narrowed (B4R-REV-02) |
| 4 | DTCG colour token naming | 2025.10 (repo `main`) | repository source | base/alias tiers; scales refused |
| 5 | W3C CG announcement | 2025-10-28 | `w3.org` | version string and date |
| 6 | Apple HIG — Dark Mode | current, 2026-09-21 | HIG data JSON | never hard-code; dark-led; elevated background NOT inherited |
| 7 | Apple HIG — Color | current, 2026-09-21 | HIG data JSON | light + dark + increased-contrast variants; colour alone |
| 8 | React Native — Appearance / useColorScheme | docs `main` | docs repository source | theme provider mapping |
| 9 | React Native — AccessibilityInfo | docs `main` | docs repository source | Reduce Transparency iOS-only; no cross-platform contrast signal |
| 10 | Compose Material3 `Surface.kt` | `androidx-main` | androidx source | `tonalElevation` — NOT inherited |
| 11 | Compose Material3 `ColorScheme.kt` | `androidx-main` | androidx source | surface role ladder, `surfaceTint` — NOT inherited |
| 12 | material-components-android | release 1.11.0 | GitHub release notes | elevation overlays → tonal surface system |
| 13 | WCAG 2.2 SC 1.4.11 | WCAG 2.2 | `w3.org` | Class S ≥ 3:1; PASSAGE boundary figure |
| 14 | WCAG 2.2 SC 2.4.11 | WCAG 2.2 | `w3.org` | focus obligations carried from B3R |
| 15 | WCAG 2.2 SC 2.4.13 | WCAG 2.2 | `w3.org` | 2 px area; focus token deferred |
