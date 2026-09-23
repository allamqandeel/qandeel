# C3_REFERENCE_GATE

**I-08B3.1-C3.** Targeted reference gate. **GENERATED** from `tools/c3-reference.mjs`.

Only sources a production freeze needs. **No broad research loop** — C0 through C2 did the
brand-colour research and it is closed.

Sentences that run TOWARD QANDEEL's choices and sentences that run AGAINST them are kept apart on
purpose. A gate that records only the supporting half is an advocacy document with citations.

---

## 1. Sources

| Source | Read | Change log | Note |
|---|---|---|---|
| **Apple Human Interface Guidelines — Branding**<br>`https://developer.apple.com/design/human-interface-guidelines/branding` | 2026-09-21 | September 9, 2026 — "Refined guidance for using brand color." | Re-read for C3 and UNCHANGED since I-08B3.1-C2 read it. The change-log line is identical, which is itself the verification: the guidance C2 weighed is the guidance C3 freezes against. |
| **Apple Human Interface Guidelines — Color**<br>`https://developer.apple.com/design/human-interface-guidelines/color` | 2026-09-21 | (no change-log entry surfaced on this reading) | Re-read for C3. The conditional sentence about monochromatic content is the strongest primary-source support available for the coverage policy the Director selected. |
| **Apple Human Interface Guidelines — Icons**<br>`https://developer.apple.com/design/human-interface-guidelines/icons` | 2026-09-21 | (no change-log entry surfaced on this reading) | NEW IN C3. C2 did not read this page. It is the page that governs an iconography material contract, and it supplies both the strongest platform support for state invariance and a second, independent statement of the selected-tint model QANDEEL departs from. |
| **Material Design — Start building with Material 3 Expressive**<br>`https://m3.material.io/blog/building-with-m3-expressive` | 2026-09-21 | n/a | Read ONLY for the documented expressiveness principle, per the brief. None of Material's visual language, components, shapes, motion or colour system is imported. |
| **react-native-svg — USAGE.md (main)**<br>`https://raw.githubusercontent.com/software-mansion/react-native-svg/main/USAGE.md` | 2026-09-21 | n/a | Read to VERIFY a claim taken from an installed skill rather than to trust it. The claim held and it is the most consequential production constraint C3 found. |
| **Design Tokens Community Group format + resolver, 2025.10**<br>`https://www.designtokens.org/schemas/2025.10/` | vendored — designtokens.org is unreachable from this environment on every transport tried | publication commit f0f32a7dce0b (2025-10-28, "Publish 2025.10") | The schemas are VENDORED in this package at vendor/schemas/2025.10/, byte-identical to the copy the frozen I-08B3.1-B4R package pinned, with that package's PROVENANCE.json carried alongside. Pinning a standard to its publication commit rather than fetching it at validation time is the behaviour an earlier independent freeze review asked for. |
| **I-08B3.1-B4R — B4_REACT_NATIVE_MAPPING.md (frozen, internal)**<br>`package-local: I-08B3.1-B4R-DTCG-RESOLVER-CONFORMANCE-FINAL/docs/B4_REACT_NATIVE_MAPPING.md` | 2026-09-21 | frozen | reactnative.dev is NOT REACHABLE from this environment, so React Native appearance architecture is INHERITED from the frozen B4R mapping rather than re-derived from a source this session cannot open. That is stated as a limit, not presented as a fresh reading. |

---

## 2. What C3 VERIFIED rather than assumed

### FALSE, AND CONFIRMED AGAINST THE LIBRARY'S OWN DOCUMENTATION.

**Claim tested:** The accepted brushed/handled character can be shipped in React Native by transcribing its SVG filter chain.

react-native-svg USAGE.md lists the implemented filters as FeBlend, FeComposite, FeColorMatrix, FeDropShadow, FeFlood, FeGaussianBlur, FeMerge and FeOffset, and lists FeTurbulence explicitly under "Not supported yet". The character chain is feTurbulence + feColorMatrix + feFlood + feComposite: three of the four are available and the NOISE GENERATOR is not. The page also notes that unimplemented filters "will display a warning indicating they are not currently supported" — so the failure mode on native is a warning and a mark WITHOUT its character, not a crash. A silent downgrade of the one composition where the material is allowed to have character. Routes that can carry it are named in C3_REACT_NATIVE_MAPPING.md §4.

### NO. Unchanged.

**Claim tested:** Apple's brand-colour guidance changed between C2 and C3.

The change-log still reads "September 9, 2026 — Refined guidance for using brand color." The guidance C2 weighed is the guidance C3 freezes against, which is worth establishing rather than assuming across a stage boundary.

### NO — the host denies navigation to reactnative.dev.

**Claim tested:** reactnative.dev can be consulted for appearance architecture.

Recorded as a LIMIT. React Native appearance architecture is inherited from the frozen B4R mapping, which derived it when the source was reachable, rather than restated from memory as though it had been re-read.

---

## 3. Sentences that run TOWARD QANDEEL's frozen choices

> By contrast, in apps with primarily monochromatic content or backgrounds, choosing your brand color as the app accent color can be an effective way to tailor your app experience and reflect your company's identity.

*— apple-color*

THE CONDITION IS MEASURED, NOT ASSUMED. C2 measured 2.77-7.18 % of any QANDEEL frame as chromatic at all; C3 re-measures it off its own reproduction rasters. QANDEEL is a primarily monochromatic product by measurement, so it meets the condition of the one sentence in current Apple guidance that points toward a brand colour in the navigation. Recorded in C3_LUXURY_BOUNDARY.md and C3_ICONOGRAPHY_MATERIAL_CONTRACT.md as support for P2 that is conditional and whose condition holds.

> You don't need to provide selected and unselected appearances for an icon that's used in standard system components such as toolbars, tab bars, and buttons.

*— apple-icons*

Direct platform support for C3.4. The state-invariance contract is not a QANDEEL eccentricity that fights the platform; on this point the platform says the same thing.

> Whether you use only custom icons or mix custom and system-provided ones, all interface icons in your app need to use a consistent size, level of detail, stroke thickness (or weight), and perspective.

*— apple-icons*

Custom iconography is sanctioned, which the coverage policy needs. It also imposes a constraint C3 passes to integration rather than freezing: the Brass navigation family and the NEUTRAL functional icons must share size, detail, stroke weight and perspective. The C1/C2 proof harness does not currently satisfy it — navigation strokes are 1.75 at 24 px and functional strokes 1.6 at 20 px, which are different stroke-to-size ratios. That is a property of a proof harness, not of a frozen icon set, and C3 freezes no icon geometry. Recorded in C3_ICONOGRAPHY_MATERIAL_CONTRACT.md §7 as an integration obligation so it is not lost.

> Use color consistently throughout your interface, especially when you use it to help communicate information like status or interactivity.

*— apple-color*

The strongest external argument against the third coverage policy C2 was forbidden to invent ("different screens use whichever looks better"). QANDEEL's rule and the platform's rule agree. It is also why the material contract grants permission by CLASS rather than by screen.

> Expressive designs are easier to use, with participants spotting key UI elements up to four times faster in expressive screens.

*— m3-expressive*

The documented form of USABILITY AND EXPRESSIVENESS ARE NOT OPPOSITES, which is the one thing the brief asks be taken from Material. It is the evidential backbone of C3_VISUAL_VITALITY_DIRECTIVE.md. RECORDED WITH ITS PROVENANCE: this is the design system's own research reported on its own blog, so it is a vendor claim rather than independent evidence, and it is cited as a documented position rather than as a measured fact about QANDEEL.

> Where the brief pins down a visual direction, follow it exactly — the brief's own words always win, including when it asks for one of these looks.

*— frontend-design skill (project-scoped)*

Applies directly to the Product Owner directive. The directive pins the direction; C3 records it as authoritative Product direction and does not relitigate it.

---

## 4. Sentences that run AGAINST them — the departures

QANDEEL does **not** inherit a platform's accent-colour model. The honest way to say so is to
name the sentence being departed from and the reason.

> Minimize its use on controls and instead use it intentionally for primary actions or status indicators, like badges for unread content or an icon for the selected tab in a tab bar.

*— apple-branding*

QANDEEL TAKES THE WARNING AND REFUSES THE REMEDY. The first half — brand colour applied too broadly overwhelms the interface — is accepted and is the entire reason C2 tested coverage rather than assuming it. The remedy is refused three times over: Living Brass is not an accent colour but a material identity; it may not mark primary actions, because that would make it encode interactivity; it may not mark status, because that is forbidden outright; and it may not mark THE SELECTED TAB, because Brass never turns on because an item is selected. C2's F04 capture shows the forbidden arrangement and records honestly that it looks good.

> In a toolbar, a selected icon receives the app's accent color.

*— apple-icons*

THE SAME DEPARTURE, FOUND ON A SECOND PAGE, AND THAT MATTERS. C2 met this model once and could reasonably have read it as one sentence. Meeting it again on the Icons page establishes that selected-state tinting is the platform's CONSISTENT model, not a stray line. QANDEEL departs from it deliberately: state is carried by achromatic weight, ink rank and a 2 px rule, which satisfies WCAG 2.2 SC 1.4.1 without colour and leaves the material free to mean only identity.

> If your app features colorful backgrounds or visually rich content, prefer a monochromatic appearance for toolbars and tab bars, or choose an accent color with sufficient visual differentiation.

*— apple-color*

NOT A DEPARTURE, AND LISTED HERE SO IT CANNOT BE QUOTED AS ONE. The sentence is CONDITIONAL and QANDEEL fails its condition: the Product has neither colourful backgrounds nor visually rich content. A partisan reading in either direction would quote this as an unconditional preference for monochromatic tab bars. It is not one.

> Resist the temptation to display your logo throughout your app or game unless it's essential for providing context.

*— apple-branding*

AN OPEN QUESTION, NOT A RESOLVED DEPARTURE, AND C3 DOES NOT CLOSE IT. C2 flagged that the canonical Q stands on every screen under BOTH coverage policies, so choosing between them could not resolve it. C3 cannot resolve it either, because it is a PLACEMENT question and the material contract grants material, not placement — `qandeel.identity.mark` says what the mark is made of if it is there, and says nothing about whether it should be. Carried forward explicitly in C3_FREEZE_RECORD.md as an open dependency of later Product/UI integration.

> To express your brand through color, consider moving it into the content layer, where it scrolls beneath Liquid Glass controls and gets picked up dynamically.

*— apple-branding*

DEPARTED FROM, AND THE REASON IS QANDEEL's, not a preference. The content layer of QANDEEL is analytical truth: conversation, analysis and the Living Analysis Map. Putting the identity material there would make the material land on content whose meaning is carried by rank, geometry and depth — which is the prohibition that has survived unchanged since C0. This is the sharpest single point at which a material identity and an accent-colour model come apart.

> AI-generated design right now clusters around three looks: … (2) a near-black background with a single bright acid-green or vermilion accent …

*— frontend-design skill (project-scoped and plugin copies)*

CORRECTING C2's OWN RECORD, WHICH WAS LOOSER THAN THE SENTENCE. C2 recorded this as corroboration that QANDEEL is structurally adjacent to a current AI default. The structural adjacency is real and stays on the record. But the sentence names a BRIGHT acid-green or vermilion accent, and Living Brass is the opposite of bright: C1R measured it 2.3-3.2x less chromatic than the census golds, and C3 measures it at Oklab C 0.0516. On the axis the sentence actually names, QANDEEL is distinguished rather than implicated. Both halves are recorded because overstating the corroboration would be as wrong as ignoring it.

---

## 5. The vendored DTCG 2025.10 schemas

`designtokens.org` is unreachable from this environment on every transport tried, so the
specification is **pinned** here with provenance rather than fetched at validation time — the
behaviour an earlier independent freeze review asked for. The files are byte-identical to the copy
the frozen I-08B3.1-B4R package pinned, and that package's `PROVENANCE.json` is carried alongside.

23 files:

| file | bytes | SHA-256 |
|---|---|---|
| `format/group.json` | 1834 | `bff8d3b46f005fad4f78b50d41fde3b2…` |
| `format/groupOrToken.json` | 552 | `48f80d667161e61ffd12c26aab214cc9…` |
| `format/token.json` | 11845 | `e42d903f33dd57e875bb8eef67b74018…` |
| `format/tokenType.json` | 471 | `fcc4672f4fb0346cf872f6924d8fb622…` |
| `format/values/border.json` | 1397 | `d316b38fbb9f7657d8ba49e0d62661c1…` |
| `format/values/color.json` | 15823 | `b721abec749fb2206cc397722861cce4…` |
| `format/values/cubicBezier.json` | 1792 | `b99b9896fbb99fc60f0e8ddbd82b2368…` |
| `format/values/dimension.json` | 1228 | `90e6fc121a7e7cb6697959172f93b5be…` |
| `format/values/duration.json` | 1112 | `ff8490104550b44258a744901b4ba24b…` |
| `format/values/fontFamily.json` | 1099 | `6f8082ae06eab783f4cc2790cae25948…` |
| `format/values/fontWeight.json` | 1010 | `ff4e05a302e2e1bdd92abc2dc4b7bd38…` |
| `format/values/gradient.json` | 1606 | `77acff5dbf54c009a5d32d3c209c7979…` |
| `format/values/number.json` | 367 | `a8c0074125f0833e1cce1db28582b4d3…` |
| `format/values/shadow.json` | 3448 | `006827759f277106f5c2a2324f0fb597…` |
| `format/values/strokeStyle.json` | 1974 | `eee4c04cae1104853c8fd5eb742f68fe…` |
| `format/values/transition.json` | 1497 | `77fcef3a44f7d817456f12cceed7c5e3…` |
| `format/values/typography.json` | 2272 | `991bb82c54166a8fba7a7d521f40e0a1…` |
| `format.json` | 3529 | `7f40fe678340b756e6464a0c20facfc2…` |
| `PROVENANCE.json` | 12132 | `4afe74d361dffe0b73ad12e75572795e…` |
| `resolver/modifier.json` | 3610 | `110124517cea87dfa3a231b729ef88cd…` |
| `resolver/resolutionOrder.json` | 5666 | `168d4948ff078fffff432ef199d40dfa…` |
| `resolver/set.json` | 2756 | `ba1c318d93ae6fece70c1c97ccda3e7f…` |
| `resolver.json` | 2019 | `c405cf595461a9650495dd5093cd0a87…` |

