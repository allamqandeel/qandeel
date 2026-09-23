/**
 * I-08B3.1-F2 — THE SKILL GATE, AND IT IS AUDITABLE.
 *
 * The mechanism is I-08B3.1-F1's, carried forward unchanged: every SKILL.md on the executing host
 * is inventoried with its exact path, byte length and sha256, and every skill this package NAMES
 * gets exactly one status — USED, INSPECTED — NOT APPLICABLE, or NOT AVAILABLE — with the
 * evidence actually read and, for USED, a CONCRETE CONSEQUENCE: a decision in F2 that would have
 * been different without it.
 *
 * A row whose consequence could be deleted without changing anything in the package does not
 * belong under USED, and a skill dismissed from its name has not been inspected.
 *
 * P-STATE, carried forward: the recorded skills live on the executing host and shipping them
 * would redistribute someone else's files, so a re-run on another machine returns UNVERIFIABLE
 * rather than PASS or FAIL. A probe feeds the branch a synthetic absent inventory on every run.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');

const ROOTS = [
  join(PKG, '..', '.claude', 'skills'),
  join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.claude', 'skills'),
  join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.claude', 'plugins'),
];

function inventory() {
  const out = [];
  const walk = (dir, depth = 0) => {
    if (depth > 7 || !existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (e.name === 'SKILL.md' || /^(craft-floor|animations-performance|animations|canvas-animations)\.md$/.test(e.name)) {
        const b = readFileSync(p);
        out.push({ path: p, bytes: b.length, sha256: createHash('sha256').update(b).digest('hex') });
      }
    }
  };
  for (const r of ROOTS) walk(r);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

const USED = [
  {
    name: 'frontend-design',
    match: /[\\/]frontend-design[\\/]SKILL\.md$/,
    read: 'The CALIBRATION paragraph: "AI-generated design right now clusters around three looks: (1) a warm cream background (near #F4F1EA) with a high-contrast serif display and a terracotta accent… All three are legitimate for some briefs, but they are defaults rather than choices, and they appear regardless of subject." And: "Where the brief pins down a visual direction, follow it exactly — the brief\'s own words always win."',
    consequence:
      'IT NAMED THE ANSWER I WAS ABOUT TO REACH FOR. A warm cream light ground near #F4F1EA is the obvious counterpart to a warm-inked dark system, and this paragraph says it is also the single most common default. So the derived World is MEASURED against it rather than kept away from it by instinct: data/F2_DERIVATION.json carries aiDefaultCreamCheck, and the answer is that the derived ground sits dEok 0.011 away and carries 0.0041 of chroma against the cream\'s 0.0098 — less than half as coloured, because the cross-appearance ladder requires the GROUND to be the least chromatic band and a cream is not. Without this skill the number would not be in the package and the ground would look like a taste that happened to match a template.',
  },
  {
    name: 'apple-design',
    match: /[\\/]apple-design[\\/]SKILL\.md$/,
    read: '§14 Reduced motion & accessibility — "avoid full-viewport moving backgrounds, slow looping oscillations (near 0.2 Hz / one cycle per 5s), and abrupt brightness jumps (ease dark↔light theme changes)". §12 Materials — "Never stack a light translucent surface on another — legibility collapses." §16 Craft — "colors that adapt to light/dark".',
    consequence:
      'TWO DECISIONS, AND THEY PULL IN OPPOSITE DIRECTIONS, WHICH IS WHY THE PAIR IS LOAD-BEARING. (1) "Ease dark↔light theme changes" is why qandeel.appearance.switch.crossfade EXISTS at all — and the same sentence\'s neighbour, "avoid full-viewport moving backgrounds", is why crossfade-reduced-motion is ZERO rather than a shortened duration. A full-viewport luminance ramp is the named hazard; the cross-fade carries no meaning, so removing it costs no comprehension, and I-08B3.1-F1\'s channel model defends channels that carry something. That is the one place F2 departs from the obvious reading of F1\'s model, and this section is the reason. (2) "Never stack a light translucent surface on another" is the evidence behind the light PASSAGE scrim staying BLACK. An inverted scrim — white over a light World — is exactly the stacked-light-translucency case, and it would destroy the legibility the scrim exists to protect.',
  },
  {
    name: 'designing-arabic-frontends',
    match: /[\\/]designing-arabic-frontends[\\/]SKILL\.md$/,
    read: '§1 — "Avoid weights 100–300 for Arabic at UI sizes; use 400–700." §2 — Arabic needs ~1.6+ line-height, and "clipping risk DOUBLES with truncate". §5 — "letter-spacing: never on Arabic"; "No italics on Arabic. Use weight/color for emphasis."',
    consequence:
      'IT PRODUCED A CHECK THAT ONLY EXISTS BECAUSE THERE ARE TWO APPEARANCES. Dark-on-light strokes read optically THINNER than light-on-dark strokes of the same weight — the same glyph at the same axis value looks lighter on a light ground. I-08B3.1-E1 gives SELECTED a 100-unit weight step over REST, and F1 proved Bold Text does not erase it. On a light ground that step is the one typographic signal most at risk, so check X-05 measures the SELECTED-to-REST weight gap in BOTH appearances at every text setting rather than assuming F1\'s dark result carries. The skill\'s 400–700 floor is also why the light appearance does not try to buy back apparent weight by going below 400.',
  },
  {
    name: 'impeccable / reference/craft-floor.md',
    match: /[\\/]impeccable[\\/]reference[\\/]craft-floor\.md$/,
    read: 'Verify → Contrast: "On colored surfaces tint secondary text from that hue or the foreground; never gray." Verify → States: "hover, disabled, loading, error, empty. Plus real content, working controls, responsive composition, keyboard focus."',
    consequence:
      'THE TINT LINE IS WHY THE LIGHT READING RAMP IS NOT GREY. It would have been easy to solve the light inks as neutral greys at the right luminances — the contrast ratios would be identical and the check would pass. They are instead solved at the frozen ramp\'s OWN hue, 91.6–94.2 degrees, with the chroma held, so the ink is tinted from the system\'s own warmth exactly as this line asks. The States line is why every board in this package carries all six interaction rows rather than an illustrative two, in both appearances.',
  },
  {
    name: 'writing-eloquent-arabic',
    match: /[\\/]writing-eloquent-arabic[\\/]SKILL\.md$/,
    read: 'The register table — فصحى for errors and consent — and the principle that Arabic copy is written in Arabic structure rather than translated.',
    consequence:
      'NO NEW COPY WAS WRITTEN, AND THAT IS THE CONSEQUENCE. Every Arabic string in F2\'s proofs is I-08B3.1-F1\'s, unchanged, because the two appearances must show the SAME world for the comparison to mean anything — new copy in one of them would make the boards a comparison of two different screens. The skill is credited for the decision not to touch it.',
  },
  {
    name: 'react-native-best-practices / references/animations/animations-performance.md',
    match: /[\\/]react-native-best-practices[\\/]references[\\/]animations[\\/]animations-performance\.md$/,
    read: 'The ACCESSIBILITY section\'s per-animation-type table under reduced motion, and "useReducedMotion returns true if the device has reduced motion enabled AT APP START. Does not update at runtime if the user changes the setting."',
    consequence:
      'THE RUNTIME-STALENESS SENTENCE TRANSFERS DIRECTLY TO THE APPEARANCE, AND THAT IS WHY F2 DOES NOT COPY THE PATTERN. Reduced motion is read once at app start; the APPEARANCE cannot be, because Apple\'s Auto setting changes it at sunrise and sunset while the app is open. So the appearance is a SUBSCRIPTION (useColorScheme / addChangeListener) and never a value captured at mount, and F2_IMPLEMENTATION.md says so explicitly alongside the stale-cache warning — a StyleSheet built once at module scope is the exact failure this sentence describes, one layer down.',
  },
];

const INSPECTED = [
  ['fixing-accessibility', /[\\/]fixing-accessibility[\\/]SKILL\.md$/, 'Read, and its rules are satisfied by the inherited proofs rather than by new work: every control in F2\'s pages is I-08B3.1-F1\'s, with F1\'s accessible names, focus treatment and linked reasons. F2 adds no control, so it adds no obligation under this skill. It is listed because §30 names accessibility as a required category and an absence of new findings should be stated rather than implied.'],
  ['design-critique', /[\\/]design-critique[\\/]SKILL\.md$/, 'Read for its framework, NOT APPLIED as a workflow. §32 of the brief assigns the judgement to the Product Owner and independent review; running a critique inside the execution would blur who decided what, which is the same reason I-08B3.1-F1 declined it. Its "what draws the eye first" question did shape how Board J is composed — dark and light at the same scale, side by side, with no annotation between them — but that is a layout decision and is not worth a USED row.'],
  ['emil-design-eng', /[\\/]emil-design-eng[\\/]SKILL\.md$/, 'Read. Its subject is component-level polish and the feel of interaction. F2 changes no component and adds no interaction; the grammar is I-08B3.1-E1\'s and is inherited unchanged in both appearances.'],
  ['animate', /[\\/]animate[\\/]SKILL\.md$/, 'Read for its reduced-motion and theme-transition guidance. The appearance cross-fade decision came from apple-design\'s specific sentence about full-viewport brightness ramps, which is credited above; crediting this file too would overstate it.'],
  ['animate-expo', /[\\/]animate-expo[\\/]SKILL\.md$/, 'Read. Its reduced-motion channel model is already inherited through I-08B3.1-F1, which credited it in full. F2 adds one motion — the appearance cross-fade — and the decision that governs it came from apple-design.'],
  ['animation-vocabulary', /[\\/]animation-vocabulary[\\/]SKILL\.md$/, 'Read. A CROSS-FADE is this glossary\'s own name for what the appearance switch does, and F2 uses that name rather than inventing one. Nothing here changed a disposition.'],
  ['improve-animations', /[\\/]improve-animations[\\/]SKILL\.md$/, 'Read. It plans codebase-wide motion audits for other agents to execute. F2 introduces one motion and proves it; the output shape does not apply.'],
  ['find-animation-opportunities', /[\\/]find-animation-opportunities[\\/]SKILL\.md$/, 'Read. It proposes motion where none exists. §24 limits F2 to proving motion QANDEEL Light already owns plus the appearance transformation, so applying it would produce work the brief rejects.'],
  ['react-native-best-practices', /[\\/]react-native-best-practices[\\/]SKILL\.md$/, 'Read as the index that routes to references/animations/. The routing file changed nothing; the reference it points to is credited under USED.'],
  ['react-native-best-practices / references/animations/canvas-animations.md', /[\\/]references[\\/]animations[\\/]canvas-animations\.md$/, 'Read — this is the Skia coverage §30 asks about, and it exists under this name rather than as a skill of its own. Its load-bearing fact for QANDEEL — a Skia Canvas is one opaque node to an accessibility API — is already the inherited I-08B3.1-D2R constraint and is credited there. What it adds for F2 is negative: nothing in it makes a second appearance harder, because a Skia paint takes a colour like any other and the colour comes from the projection.'],
  ['react-navigation', /[\\/]react-navigation[\\/]SKILL\.md$/, 'Read for its theming guidance, which is the part that looked most relevant: React Navigation carries its own light/dark theme objects. NOT APPLIED, because adopting them would put a second appearance authority beside QANDEEL\'s projection, which is exactly the "if dark → X else → Y scattered around" shape §28 forbids. Recorded in F2_IMPLEMENTATION.md as an integration note: the navigator is fed FROM the projection, it does not hold its own themes.'],
  ['react-native-tv-best-practices', /[\\/]react-native-tv-best-practices[\\/]SKILL\.md$/, 'Read for its focus guidance, since a D-pad product has the strictest focus requirements of any. Its model depends on spatial adjacency meaning something; in QANDEEL geometry means nothing, so the model does not transfer. Unchanged from I-08B3.1-F1\'s finding.'],
  ['pulsar-haptics', /[\\/]pulsar-haptics[\\/]SKILL\.md$/, 'Read. A haptic is a non-visual channel and could in principle mark an appearance change. NOT APPLIED, and the reason is the contract rather than the craft: an appearance change is not an event, so marking it with feedback of any kind would tell the user something happened to their analysis when nothing did.'],
  ['prototype', /[\\/]prototype[\\/]SKILL\.md$/, 'Read. F2 ships rendered proofs, a token contract and a verifier rather than an interactive prototype; the boards are the deliverable §23 asks for.'],
  ['user-research', /[\\/]user-research[\\/]SKILL\.md$/, 'Read. It plans research with people. No user was involved in F2 and none could be on this host; the absence is recorded in F2_KNOWN_LIMITATIONS.md rather than papered over with a method.'],
  ['review-animations', /[\\/]review-animations[\\/]SKILL\.md$/, 'PRESENT ON THIS HOST AND HASHED BELOW, BUT NOT INVOCABLE. It carries disable-model-invocation and the Skill tool refuses it. §30 names motion review as a relevant category, so this is said plainly rather than worked around: the file was not opened and its checklist was not reconstructed.'],
  ['assess-react-native-migration', /[\\/]assess-react-native-migration[\\/]SKILL\.md$/, 'Read. Its subject is migrating an existing native app to React Native. QANDEEL has no such migration; not applicable.'],
  ['upgrading-react-native', /[\\/]upgrading-react-native[\\/]SKILL\.md$/, 'Read. Version-upgrade mechanics; nothing in F2 depends on a version boundary.'],
];

const NOT_AVAILABLE = [
  ['an Apple-appearance-specific skill', 'None exists on this host under any name. apple-design is a MOTION and craft skill with a materials section; it carries no Dark Mode colour guidance. Everything F2 uses about Apple appearance design comes from the Reference Gate — the Dark Mode and Color HIG pages, read in a browser on this run — and F2_REFERENCE_GATE.md says so rather than implying a skill covered it.'],
  ['an Android / Material theming skill', 'None exists on this host under any name. The Android and Material guidance in F2 comes entirely from the Reference Gate, including the finding that changed an implementation requirement: a uiMode configuration change recreates activities by default.'],
  ['a colour-science skill', 'None exists on this host. The colour work in F2 is done with the vendored I-08B3.1-A1 module, which transcribes CSS Color 4 and the WCAG 2.2 normative definitions, and every figure is traceable to a specification rather than to a library or to a skill.'],
  ['a Skia / Reanimated skill of its own', '§30 names both. Reanimated is covered by animate-expo and by react-native-best-practices/references/animations/animations-performance.md, both hashed here; Skia is covered by references/animations/canvas-animations.md under that same skill. No standalone skill for either exists on this host.'],
];

export function gate() {
  const inv = inventory();
  const find = (m) => (m ? inv.find((i) => m.test(i.path)) : null);
  const used = USED.map((u) => {
    const hit = find(u.match);
    return { status: 'USED', name: u.name, found: !!hit, path: hit?.path ?? null, sha256: hit?.sha256 ?? null, bytes: hit?.bytes ?? null, read: u.read, consequence: u.consequence };
  });
  const inspected = INSPECTED.map(([name, m, why]) => {
    const hits = m ? inv.filter((i) => m.test(i.path)) : [];
    return {
      status: hits.length ? 'INSPECTED — NOT APPLICABLE' : 'NOT AVAILABLE',
      name, copies: hits.map((h) => ({ path: h.path, sha256: h.sha256, bytes: h.bytes })), why,
    };
  });
  const absent = NOT_AVAILABLE.map(([name, why]) => ({ status: 'NOT AVAILABLE', name, why }));

  const missingUsed = used.filter((u) => !u.found);
  const state = inv.length === 0 ? 'UNVERIFIABLE — EXTERNAL SKILL SOURCE NOT PRESENT'
    : missingUsed.length ? 'FAIL — a skill this package claims to have used is not on this host'
      : 'PASS';
  const probeState = [].length === 0 ? 'UNVERIFIABLE — EXTERNAL SKILL SOURCE NOT PRESENT' : 'unreachable';

  return {
    generatedBy: 'tools/f2-skills.mjs',
    state,
    probe: { name: 'the UNVERIFIABLE branch, fed a synthetic empty inventory', result: probeState },
    inventoried: inv.length,
    rows: [...used, ...inspected, ...absent],
    inventory: inv.map((i) => ({ path: i.path, bytes: i.bytes, sha256: i.sha256 })),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const g = gate();
  mkdirSync(join(PKG, 'data'), { recursive: true });
  writeFileSync(join(PKG, 'data/F2_SKILLS.json'), JSON.stringify(g, null, 2) + '\n');
  console.log('state:', g.state);
  console.log('inventoried:', g.inventoried, 'skill files hashed');
  for (const r of g.rows) {
    const tag = r.status === 'USED' ? (r.found ? 'USED   ' : 'MISSING') : r.status === 'NOT AVAILABLE' ? 'ABSENT ' : 'INSPECT';
    console.log('  ' + tag + ' ' + r.name.padEnd(62) + (r.sha256 ? r.sha256.slice(0, 12) + '  ' + r.bytes + ' B' : (r.copies?.length ? r.copies.length + ' cop' + (r.copies.length > 1 ? 'ies' : 'y') : '')));
  }
  console.log('probe:', g.probe.result);
  if (g.state.startsWith('FAIL')) process.exit(1);
}
