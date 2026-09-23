/**
 * I-08B3.1-C3 — THE TARGETED REFERENCE GATE, AS DATA.
 *
 * Only sources a PRODUCTION FREEZE needs. No broad research loop: C0 through C2 did the brand-colour
 * research and it is closed.
 *
 * Every quotation below was read from the live page or the vendored specification in this session,
 * and each carries where it came from and what it changed. The two directions are kept apart on
 * purpose — sentences that run TOWARD QANDEEL's choices and sentences that run AGAINST them — because
 * a gate that records only the supporting half is an advocacy document with citations.
 *
 * DEPARTURES are stated as departures. QANDEEL does not inherit a platform's accent-colour model, and
 * the honest way to say that is to name the sentence being departed from and the reason.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PKG = join(HERE, '..');

export const SOURCES = [
  {
    id: 'apple-branding',
    title: 'Apple Human Interface Guidelines — Branding',
    url: 'https://developer.apple.com/design/human-interface-guidelines/branding',
    read: '2026-09-21',
    changeLog: 'September 9, 2026 — "Refined guidance for using brand color."',
    note: 'Re-read for C3 and UNCHANGED since I-08B3.1-C2 read it. The change-log line is identical, ' +
      'which is itself the verification: the guidance C2 weighed is the guidance C3 freezes against.',
  },
  {
    id: 'apple-color',
    title: 'Apple Human Interface Guidelines — Color',
    url: 'https://developer.apple.com/design/human-interface-guidelines/color',
    read: '2026-09-21',
    changeLog: '(no change-log entry surfaced on this reading)',
    note: 'Re-read for C3. The conditional sentence about monochromatic content is the strongest ' +
      'primary-source support available for the coverage policy the Director selected.',
  },
  {
    id: 'apple-icons',
    title: 'Apple Human Interface Guidelines — Icons',
    url: 'https://developer.apple.com/design/human-interface-guidelines/icons',
    read: '2026-09-21',
    changeLog: '(no change-log entry surfaced on this reading)',
    note: 'NEW IN C3. C2 did not read this page. It is the page that governs an iconography material ' +
      'contract, and it supplies both the strongest platform support for state invariance and a ' +
      'second, independent statement of the selected-tint model QANDEEL departs from.',
  },
  {
    id: 'm3-expressive',
    title: 'Material Design — Start building with Material 3 Expressive',
    url: 'https://m3.material.io/blog/building-with-m3-expressive',
    read: '2026-09-21',
    changeLog: 'n/a',
    note: 'Read ONLY for the documented expressiveness principle, per the brief. None of Material\'s ' +
      'visual language, components, shapes, motion or colour system is imported.',
  },
  {
    id: 'rn-svg',
    title: 'react-native-svg — USAGE.md (main)',
    url: 'https://raw.githubusercontent.com/software-mansion/react-native-svg/main/USAGE.md',
    read: '2026-09-21',
    changeLog: 'n/a',
    note: 'Read to VERIFY a claim taken from an installed skill rather than to trust it. The claim ' +
      'held and it is the most consequential production constraint C3 found.',
  },
  {
    id: 'dtcg-2025-10',
    title: 'Design Tokens Community Group format + resolver, 2025.10',
    url: 'https://www.designtokens.org/schemas/2025.10/',
    read: 'vendored — designtokens.org is unreachable from this environment on every transport tried',
    changeLog: 'publication commit f0f32a7dce0b (2025-10-28, "Publish 2025.10")',
    note: 'The schemas are VENDORED in this package at vendor/schemas/2025.10/, byte-identical to the ' +
      'copy the frozen I-08B3.1-B4R package pinned, with that package\'s PROVENANCE.json carried ' +
      'alongside. Pinning a standard to its publication commit rather than fetching it at validation ' +
      'time is the behaviour an earlier independent freeze review asked for.',
  },
  {
    id: 'b4r-rn',
    title: 'I-08B3.1-B4R — B4_REACT_NATIVE_MAPPING.md (frozen, internal)',
    url: 'package-local: I-08B3.1-B4R-DTCG-RESOLVER-CONFORMANCE-FINAL/docs/B4_REACT_NATIVE_MAPPING.md',
    read: '2026-09-21',
    changeLog: 'frozen',
    note: 'reactnative.dev is NOT REACHABLE from this environment, so React Native appearance ' +
      'architecture is INHERITED from the frozen B4R mapping rather than re-derived from a source ' +
      'this session cannot open. That is stated as a limit, not presented as a fresh reading.',
  },
];

/** Sentences that run TOWARD QANDEEL's frozen choices. Quoted, attributed, and used. */
export const SUPPORTS = [
  {
    source: 'apple-color',
    quote: 'By contrast, in apps with primarily monochromatic content or backgrounds, choosing your ' +
      'brand color as the app accent color can be an effective way to tailor your app experience and ' +
      'reflect your company\'s identity.',
    effect:
      'THE CONDITION IS MEASURED, NOT ASSUMED. C2 measured 2.77-7.18 % of any QANDEEL frame as ' +
      'chromatic at all; C3 re-measures it off its own reproduction rasters. QANDEEL is a primarily ' +
      'monochromatic product by measurement, so it meets the condition of the one sentence in current ' +
      'Apple guidance that points toward a brand colour in the navigation. Recorded in ' +
      'C3_LUXURY_BOUNDARY.md and C3_ICONOGRAPHY_MATERIAL_CONTRACT.md as support for P2 that is ' +
      'conditional and whose condition holds.',
  },
  {
    source: 'apple-icons',
    quote: 'You don\'t need to provide selected and unselected appearances for an icon that\'s used ' +
      'in standard system components such as toolbars, tab bars, and buttons.',
    effect:
      'Direct platform support for C3.4. The state-invariance contract is not a QANDEEL eccentricity ' +
      'that fights the platform; on this point the platform says the same thing.',
  },
  {
    source: 'apple-icons',
    quote: 'Whether you use only custom icons or mix custom and system-provided ones, all interface ' +
      'icons in your app need to use a consistent size, level of detail, stroke thickness (or ' +
      'weight), and perspective.',
    effect:
      'Custom iconography is sanctioned, which the coverage policy needs. It also imposes a ' +
      'constraint C3 passes to integration rather than freezing: the Brass navigation family and the ' +
      'NEUTRAL functional icons must share size, detail, stroke weight and perspective. The C1/C2 ' +
      'proof harness does not currently satisfy it — navigation strokes are 1.75 at 24 px and ' +
      'functional strokes 1.6 at 20 px, which are different stroke-to-size ratios. That is a property ' +
      'of a proof harness, not of a frozen icon set, and C3 freezes no icon geometry. Recorded in ' +
      'C3_ICONOGRAPHY_MATERIAL_CONTRACT.md §7 as an integration obligation so it is not lost.',
  },
  {
    source: 'apple-color',
    quote: 'Use color consistently throughout your interface, especially when you use it to help ' +
      'communicate information like status or interactivity.',
    effect:
      'The strongest external argument against the third coverage policy C2 was forbidden to invent ' +
      '("different screens use whichever looks better"). QANDEEL\'s rule and the platform\'s rule ' +
      'agree. It is also why the material contract grants permission by CLASS rather than by screen.',
  },
  {
    source: 'm3-expressive',
    quote: 'Expressive designs are easier to use, with participants spotting key UI elements up to ' +
      'four times faster in expressive screens.',
    effect:
      'The documented form of USABILITY AND EXPRESSIVENESS ARE NOT OPPOSITES, which is the one thing ' +
      'the brief asks be taken from Material. It is the evidential backbone of ' +
      'C3_VISUAL_VITALITY_DIRECTIVE.md. RECORDED WITH ITS PROVENANCE: this is the design system\'s ' +
      'own research reported on its own blog, so it is a vendor claim rather than independent ' +
      'evidence, and it is cited as a documented position rather than as a measured fact about ' +
      'QANDEEL.',
  },
  {
    source: 'frontend-design skill (project-scoped)',
    quote: 'Where the brief pins down a visual direction, follow it exactly — the brief\'s own words ' +
      'always win, including when it asks for one of these looks.',
    effect:
      'Applies directly to the Product Owner directive. The directive pins the direction; C3 records ' +
      'it as authoritative Product direction and does not relitigate it.',
  },
];

/** Sentences that run AGAINST QANDEEL's frozen choices. Quoted, attributed, and DEPARTED FROM. */
export const DEPARTURES = [
  {
    source: 'apple-branding',
    quote: 'Minimize its use on controls and instead use it intentionally for primary actions or ' +
      'status indicators, like badges for unread content or an icon for the selected tab in a tab bar.',
    departure:
      'QANDEEL TAKES THE WARNING AND REFUSES THE REMEDY. The first half — brand colour applied too ' +
      'broadly overwhelms the interface — is accepted and is the entire reason C2 tested coverage ' +
      'rather than assuming it. The remedy is refused three times over: Living Brass is not an accent ' +
      'colour but a material identity; it may not mark primary actions, because that would make it ' +
      'encode interactivity; it may not mark status, because that is forbidden outright; and it may ' +
      'not mark THE SELECTED TAB, because Brass never turns on because an item is selected. ' +
      'C2\'s F04 capture shows the forbidden arrangement and records honestly that it looks good.',
  },
  {
    source: 'apple-icons',
    quote: 'In a toolbar, a selected icon receives the app\'s accent color.',
    departure:
      'THE SAME DEPARTURE, FOUND ON A SECOND PAGE, AND THAT MATTERS. C2 met this model once and could ' +
      'reasonably have read it as one sentence. Meeting it again on the Icons page establishes that ' +
      'selected-state tinting is the platform\'s CONSISTENT model, not a stray line. QANDEEL departs ' +
      'from it deliberately: state is carried by achromatic weight, ink rank and a 2 px rule, which ' +
      'satisfies WCAG 2.2 SC 1.4.1 without colour and leaves the material free to mean only identity.',
  },
  {
    source: 'apple-color',
    quote: 'If your app features colorful backgrounds or visually rich content, prefer a ' +
      'monochromatic appearance for toolbars and tab bars, or choose an accent color with sufficient ' +
      'visual differentiation.',
    departure:
      'NOT A DEPARTURE, AND LISTED HERE SO IT CANNOT BE QUOTED AS ONE. The sentence is CONDITIONAL and ' +
      'QANDEEL fails its condition: the Product has neither colourful backgrounds nor visually rich ' +
      'content. A partisan reading in either direction would quote this as an unconditional ' +
      'preference for monochromatic tab bars. It is not one.',
  },
  {
    source: 'apple-branding',
    quote: 'Resist the temptation to display your logo throughout your app or game unless it\'s ' +
      'essential for providing context.',
    departure:
      'AN OPEN QUESTION, NOT A RESOLVED DEPARTURE, AND C3 DOES NOT CLOSE IT. C2 flagged that the ' +
      'canonical Q stands on every screen under BOTH coverage policies, so choosing between them ' +
      'could not resolve it. C3 cannot resolve it either, because it is a PLACEMENT question and the ' +
      'material contract grants material, not placement — `qandeel.identity.mark` says what the mark ' +
      'is made of if it is there, and says nothing about whether it should be. Carried forward ' +
      'explicitly in C3_FREEZE_RECORD.md as an open dependency of later Product/UI integration.',
  },
  {
    source: 'apple-branding',
    quote: 'To express your brand through color, consider moving it into the content layer, where it ' +
      'scrolls beneath Liquid Glass controls and gets picked up dynamically.',
    departure:
      'DEPARTED FROM, AND THE REASON IS QANDEEL\'s, not a preference. The content layer of QANDEEL is ' +
      'analytical truth: conversation, analysis and the Living Analysis Map. Putting the identity ' +
      'material there would make the material land on content whose meaning is carried by rank, ' +
      'geometry and depth — which is the prohibition that has survived unchanged since C0. This is ' +
      'the sharpest single point at which a material identity and an accent-colour model come apart.',
  },
  {
    source: 'frontend-design skill (project-scoped and plugin copies)',
    quote: 'AI-generated design right now clusters around three looks: … (2) a near-black background ' +
      'with a single bright acid-green or vermilion accent …',
    departure:
      'CORRECTING C2\'s OWN RECORD, WHICH WAS LOOSER THAN THE SENTENCE. C2 recorded this as ' +
      'corroboration that QANDEEL is structurally adjacent to a current AI default. The structural ' +
      'adjacency is real and stays on the record. But the sentence names a BRIGHT acid-green or ' +
      'vermilion accent, and Living Brass is the opposite of bright: C1R measured it 2.3-3.2x less ' +
      'chromatic than the census golds, and C3 measures it at Oklab C 0.0516. On the axis the ' +
      'sentence actually names, QANDEEL is distinguished rather than implicated. Both halves are ' +
      'recorded because overstating the corroboration would be as wrong as ignoring it.',
  },
];

/** What C3 verified rather than assumed, and what it found. */
export const VERIFICATIONS = [
  {
    claim: 'The accepted brushed/handled character can be shipped in React Native by transcribing its ' +
      'SVG filter chain.',
    source: 'rn-svg',
    result: 'FALSE, AND CONFIRMED AGAINST THE LIBRARY\'S OWN DOCUMENTATION.',
    detail:
      'react-native-svg USAGE.md lists the implemented filters as FeBlend, FeComposite, FeColorMatrix, ' +
      'FeDropShadow, FeFlood, FeGaussianBlur, FeMerge and FeOffset, and lists FeTurbulence explicitly ' +
      'under "Not supported yet". The character chain is feTurbulence + feColorMatrix + feFlood + ' +
      'feComposite: three of the four are available and the NOISE GENERATOR is not. The page also ' +
      'notes that unimplemented filters "will display a warning indicating they are not currently ' +
      'supported" — so the failure mode on native is a warning and a mark WITHOUT its character, not a ' +
      'crash. A silent downgrade of the one composition where the material is allowed to have ' +
      'character. Routes that can carry it are named in C3_REACT_NATIVE_MAPPING.md §4.',
  },
  {
    claim: 'Apple\'s brand-colour guidance changed between C2 and C3.',
    source: 'apple-branding',
    result: 'NO. Unchanged.',
    detail: 'The change-log still reads "September 9, 2026 — Refined guidance for using brand color." ' +
      'The guidance C2 weighed is the guidance C3 freezes against, which is worth establishing rather ' +
      'than assuming across a stage boundary.',
  },
  {
    claim: 'reactnative.dev can be consulted for appearance architecture.',
    source: 'b4r-rn',
    result: 'NO — the host denies navigation to reactnative.dev.',
    detail: 'Recorded as a LIMIT. React Native appearance architecture is inherited from the frozen ' +
      'B4R mapping, which derived it when the source was reachable, rather than restated from memory ' +
      'as though it had been re-read.',
  },
];

export function schemaIntegrity() {
  const dir = join(PKG, 'vendor', 'schemas', '2025.10');
  const out = [];
  const walk = (d, base = '') => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p, `${base}${e.name}/`);
      else out.push({ file: `${base}${e.name}`, bytes: readFileSync(p).length,
        sha256: createHash('sha256').update(readFileSync(p)).digest('hex') });
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

export function build() {
  return {
    sources: SOURCES,
    supports: SUPPORTS,
    departures: DEPARTURES,
    verifications: VERIFICATIONS,
    schemas: schemaIntegrity(),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const b = build();
  console.log(`sources: ${b.sources.length}  supports: ${b.supports.length}  departures: ${b.departures.length}`);
  console.log(`verifications: ${b.verifications.length}  vendored schema files: ${b.schemas.length}`);
  for (const v of b.verifications) console.log(`  ${v.result.padEnd(46)} ${v.claim.slice(0, 70)}`);
}
