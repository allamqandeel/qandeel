/**
 * I-08B3.1-C3 — THE SKILL GATE, AS DATA.
 *
 * The gate is auditable or it is decoration. For every skill recorded as USED this file carries the
 * exact path, the exact SHA-256 of the file that was read, the principle taken from it and the
 * CONCRETE CONSEQUENCE in this package — a consequence being something a reviewer can go and look at,
 * not a sentiment. A skill that was read and changed nothing is recorded as read and changing
 * nothing, which is a more useful thing to know than a list of everything available.
 *
 * The inventory is produced by walking the disk, not by recalling what exists, so a skill that was
 * installed since the last stage appears whether or not anyone remembered it.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PKG = join(HERE, '..');
export const PROJECT = join(PKG, '..');

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

const ROOTS = [join(homedir(), '.claude'), join(PROJECT, '.claude')];

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'SKILL.md') out.push(p);
  }
  return out;
}

export function inventory() {
  const all = [];
  for (const r of ROOTS) all.push(...walk(r));
  return all.sort().map((p) => ({ path: p, sha256: sha(p), bytes: readFileSync(p).length }));
}

/**
 * USED — each entry names a file that was read, what was taken from it, and where the effect is.
 *
 * `evidence` is deliberately a place in THIS package. "Informed the approach" is not an effect.
 */
export const USED = [
  {
    skill: 'react-native-best-practices / references/svg',
    path: join(homedir(), '.claude', 'skills', 'react-native-best-practices', 'references', 'svg', 'SKILL.md'),
    also: [join(homedir(), '.claude', 'skills', 'react-native-best-practices', 'references', 'svg', 'svg.md'),
      join(homedir(), '.claude', 'skills', 'react-native-best-practices', 'references', 'svg', 'when-to-use.md')],
    principle:
      'react-native-svg implements FeBlend, FeComposite, FeColorMatrix, FeDropShadow, FeFlood, ' +
      'FeGaussianBlur, FeMerge and FeOffset on native; other filters are web-only and warn. Every SVG ' +
      'element becomes a native view with no drawing cache, so static SVG is better served by other ' +
      'renderers, and complex SVGs with filters point to react-native-skia.',
    consequence:
      'THE SINGLE MOST CONSEQUENTIAL FINDING IN C3.10. The accepted brushed/handled character is built ' +
      'from feTurbulence + feColorMatrix + feFlood + feComposite. Three of those four are production-' +
      'available in react-native-svg; feTurbulence is NOT — confirmed against the library\'s own ' +
      'USAGE.md, which lists it under "Not supported yet". So the identity moment cannot be shipped by ' +
      'transcribing the proof\'s filter chain, and C3_REACT_NATIVE_MAPPING.md §4 names the routes that ' +
      'can carry it instead. It also supplies the production reason for confining the character to the ' +
      'rare identity moment: the renderer that can do it is heavy per instance.',
    evidence: 'docs/C3_REACT_NATIVE_MAPPING.md §4; docs/C3_REFERENCE_GATE.md §5',
  },
  {
    skill: 'react-navigation (+ references/bottom-tabs, references/native-bottom-tabs)',
    path: join(homedir(), '.claude', 'skills', 'react-navigation', 'SKILL.md'),
    also: [join(homedir(), '.claude', 'skills', 'react-navigation', 'references', 'bottom-tabs.md'),
      join(homedir(), '.claude', 'skills', 'react-navigation', 'references', 'native-bottom-tabs.md')],
    principle:
      'React Navigation 7 renders a tab icon through `tabBarIcon({ focused, color, size })`, where ' +
      '`color` is computed by the navigator from `tabBarActiveTintColor` / `tabBarInactiveTintColor`. ' +
      'On the native tab navigator, tint support "varies based on platform".',
    consequence:
      'THE LIBRARY\'S DEFAULT MODEL IS THE THING QANDEEL FORBIDS: the idiomatic implementation is ' +
      '`<Icon color={color} />`, which makes the navigation icon change colour on selection. ' +
      'C3_REACT_NATIVE_MAPPING.md §3 therefore states the rule as an explicit instruction — the ' +
      'QANDEEL navigation icon IGNORES the injected `color` and both tint options are set to the same ' +
      'material token, so the library\'s model is neutralised deliberately rather than by omission — ' +
      'and flags the native navigator\'s platform-varying tint as something that must be VERIFIED per ' +
      'platform, because a native tab bar that applies its own tint would break state invariance in a ' +
      'way no token check can see.',
    evidence: 'docs/C3_REACT_NATIVE_MAPPING.md §3; docs/C3_INVARIANTS.md §4 (scope note)',
  },
  {
    skill: 'apple-design (project-scoped)',
    path: join(PROJECT, '.claude', 'skills', 'apple-design', 'SKILL.md'),
    principle:
      'Reach for current primary Apple guidance and quote it rather than paraphrasing remembered ' +
      'guidance; treat platform conventions as things to depart from deliberately and on the record.',
    consequence:
      'C3_REFERENCE_GATE.md re-reads Branding, Color and Icons at their live URLs, records the ' +
      'change-log date on each, and states five DEPARTURES with the sentence each departs from. It ' +
      'also records the two sentences that run TOWARD QANDEEL\'s choice, including the conditional one ' +
      'whose condition QANDEEL measurably meets.',
    evidence: 'docs/C3_REFERENCE_GATE.md §2-§4',
  },
  {
    skill: 'fixing-accessibility (project-scoped)',
    path: join(PROJECT, '.claude', 'skills', 'fixing-accessibility', 'SKILL.md'),
    principle:
      'Establish which success criterion actually applies before asserting a threshold, and never let ' +
      'colour be the sole carrier of information.',
    consequence:
      'Invariant I-19 re-measures rather than citing C2: under P2 the persistent navigation family is ' +
      'an ESSENTIAL UI COMPONENT VISUAL, SC 1.4.11 applies, and the material clears 3:1 on both frozen ' +
      'grounds by measurement made in this package (6.070:1 and 5.664:1). The reserved-and-empty ' +
      '{qandeel.status} namespace carries SC 1.4.1 forward as a constraint on values E has not chosen ' +
      'yet, rather than leaving it to be rediscovered.',
    evidence: 'tools/c3-invariants.mjs I-19; docs/C3_ICONOGRAPHY_MATERIAL_CONTRACT.md §6',
  },
  {
    skill: 'frontend-design (project-scoped)',
    path: join(PROJECT, '.claude', 'skills', 'frontend-design', 'SKILL.md'),
    principle:
      'Named AI-default looks to avoid, one of which is a near-black background carrying a single ' +
      'bright accent.',
    consequence:
      'Recorded in C3_LUXURY_BOUNDARY.md as EXTERNAL CORROBORATION of the generic risk rather than as ' +
      'a reason to weaken the material — the corroboration is that QANDEEL is structurally adjacent to ' +
      'a current default, which is an argument about COVERAGE DISCIPLINE, which is what that document ' +
      'contains. NOTE: this skill exists at four installed paths on this host with two distinct ' +
      'contents; the hash recorded here is of the file actually read.',
    evidence: 'docs/C3_LUXURY_BOUNDARY.md §5',
  },
  {
    skill: 'designing-arabic-frontends (project-scoped)',
    path: join(PROJECT, '.claude', 'skills', 'designing-arabic-frontends', 'SKILL.md'),
    principle:
      'RTL is a directional system, not a mirrored one: icons that encode direction must be mirrored ' +
      'by MEANING, and logical properties must be used rather than physical ones.',
    consequence:
      'C3 freezes no icon geometry, so this skill changed no glyph here. It is recorded as USED ' +
      'because it produced a STANDING CONSTRAINT written into C3_ICONOGRAPHY_MATERIAL_CONTRACT.md §7: ' +
      'the material contract grants paint and never geometry, and any future navigation icon set ' +
      'inherits the RTL obligations rather than the material\'s permission implying they are settled. ' +
      'In C2 this same skill caught a real defect — a send arrow pointing the wrong way in RTL — which ' +
      'is why it is consulted rather than assumed.',
    evidence: 'docs/C3_ICONOGRAPHY_MATERIAL_CONTRACT.md §7',
  },
];

/**
 * INSPECTED — NOT APPLICABLE. Read far enough to decide, and the decision recorded.
 *
 * This list exists because "not applicable" is a claim. A reader who disagrees with one of these can
 * check the reasoning instead of wondering whether the skill was seen at all.
 */
export const INSPECTED = [
  ['emil-design-eng', 'Design-engineering craft for building interfaces. C3 builds no interface: it freezes a material contract and specifies a mapping. Its craft rules bind the stage that builds components.'],
  ['ui-ux-pro-max', 'Broad UI/UX generation guidance. C3 makes no design decisions — every visual decision it records was made in C0 through C2 and accepted by the Design Director.'],
  ['design-critique', 'Critique of a design artefact. C3 ships no new visual artefact to critique; the reproduction proof is deliberately NOT an aesthetic comparison, by instruction.'],
  ['impeccable', 'Craft-floor and audit references. Read; its audit discipline is already the operating method of this package. NOTE: reference/colorize.md — "Add strategic color to monochromatic UIs", the single most on-point document this host could hold for a Living Brass coverage stage — is STILL ABSENT, for the fifth consecutive stage.'],
  ['animate / animate-expo / animation-vocabulary / improve-animations / find-animation-opportunities', 'Motion. C3 must NOT design or freeze motion, and explicitly leaves it to later contracts. Recorded in C3_EXPRESSIVE_HEADROOM_CONTRACT.md as reserved capacity, not exercised here.'],
  ['react-native-best-practices / references/animations', 'Reanimated and GPU animation. Same boundary as above — and relevant later, because the lantern gateway moment and the Q-thread expression will need it.'],
  ['prototype / playground', 'Prototyping harnesses. C3 produces a specification and a reproduction proof, not a prototype.'],
  ['writing-eloquent-arabic', 'Arabic prose quality. C3 authors no new Arabic copy; the reproduction proof uses the sealed C2 copy verbatim so that the compositions remain the accepted ones.'],
  ['assess-react-native-migration / react-native-brownfield-migration / upgrading-react-native / create-react-native-library / rnrepo / expo-horizon / detour', 'React Native project operations. C3 specifies consumption, builds nothing, and touches no project configuration.'],
  ['claude-security, hookify, plugin-dev, mcp-server-dev, skill-creator, github-actions, session-report, receipts, project-artifact, math-olympiad, cwc-makers, discord/imessage/telegram, fishjam, moq-kit, typegpu, pulsar-haptics, radon-mcp, react-native-tv-best-practices, user-research, claude-md-management, claude-code-setup, example-plugin', 'Outside the subject matter of a material production specification.'],
];

/** NOT AVAILABLE — named because absence is information, especially when it recurs. */
export const NOT_AVAILABLE = [
  ['impeccable/reference/colorize.md',
    'Referenced by the impeccable skill as "Add strategic color to monochromatic UIs" and not present ' +
    'on disk. FIFTH CONSECUTIVE STAGE. It is the most directly relevant missing document this host ' +
    'could have offered a Living Brass coverage and freeze stage, and its absence is recorded here ' +
    'rather than passed over so that the gap does not read as a gap in the work.'],
  ['a design-token architecture skill',
    'No installed skill covers DTCG token architecture, resolver design or token-system freezing. ' +
    'That work rests on the DTCG 2025.10 specification itself, vendored in this package, and on the ' +
    'frozen I-08B3.1-B4R architecture it extends.'],
];

export function build() {
  const inv = inventory();
  const used = USED.map((u) => {
    const files = [u.path, ...(u.also || [])].filter((p) => existsSync(p));
    return {
      skill: u.skill,
      files: files.map((p) => ({ path: p, sha256: sha(p), bytes: readFileSync(p).length })),
      missing: [u.path, ...(u.also || [])].filter((p) => !existsSync(p)),
      principle: u.principle, consequence: u.consequence, evidence: u.evidence,
    };
  });
  return {
    inventoryCount: inv.length,
    roots: ROOTS,
    inventory: inv,
    used,
    inspectedNotApplicable: INSPECTED.map(([k, v]) => ({ skill: k, why: v })),
    notAvailable: NOT_AVAILABLE.map(([k, v]) => ({ item: k, note: v })),
    duplicates: (() => {
      const byName = new Map();
      for (const s of inv) {
        const name = s.path.split(/[\\/]/).slice(-2)[0];
        if (!byName.has(name)) byName.set(name, []);
        byName.get(name).push(s);
      }
      return [...byName.entries()]
        .filter(([, v]) => v.length > 1)
        .map(([name, v]) => ({
          name, installations: v.length,
          distinctContents: new Set(v.map((x) => x.sha256)).size,
          paths: v.map((x) => ({ path: x.path, sha256: x.sha256 })),
        }))
        .filter((d) => d.distinctContents > 1 || d.installations > 2);
    })(),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const b = build();
  console.log(`SKILL.md on disk: ${b.inventoryCount}`);
  console.log(`USED: ${b.used.length}`);
  for (const u of b.used) {
    console.log(`  ${u.skill}`);
    for (const f of u.files) console.log(`      ${f.sha256.slice(0, 16)}  ${f.path}`);
    if (u.missing.length) console.log(`      MISSING: ${u.missing.join(', ')}`);
  }
  console.log(`duplicate installations with differing content: ${b.duplicates.length}`);
  for (const d of b.duplicates) console.log(`  ${d.name}: ${d.installations} installs, ${d.distinctContents} distinct contents`);
  console.log(`NOT AVAILABLE: ${b.notAvailable.length}`);
}
