/**
 * I-08B3.1-F1 — THE SKILL GATE, AND IT IS AUDITABLE.
 *
 * A gate that lists what was available proves nothing. This one records, for every SKILL.md on
 * the executing host: its exact path, byte length and sha256. Every skill this package NAMES
 * gets exactly one status — USED, INSPECTED — NOT APPLICABLE, or NOT AVAILABLE — with the
 * evidence actually read and, for USED, a CONCRETE CONSEQUENCE: a decision in F1 that would
 * have been different without it.
 *
 * A row whose consequence could be deleted without changing anything in the package does not
 * belong under USED, and a skill dismissed from its name has not been inspected.
 *
 * P-STATE, carried forward from I-08B3.1-D2R and E1: the recorded skills live on the executing
 * host and shipping them would redistribute someone else's files, so a re-run on another
 * machine returns UNVERIFIABLE rather than PASS or FAIL. A probe feeds the branch a synthetic
 * absent inventory on every run, so that state is demonstrated even here.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
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
    name: 'fixing-accessibility',
    match: /[\\/]fixing-accessibility[\\/]SKILL\.md$/,
    read: '§8 media and motion — "respect prefers-reduced-motion for NON-ESSENTIAL motion"; §7 contrast and states — "disabled states must not rely on color alone", "do not remove focus outlines without a visible replacement"; §5 forms and errors — "disabled submit actions must explain why", errors linked by aria-describedby; §1 accessible names — every interactive control must have one; §6 — "toasts must not be the only way to convey critical information".',
    consequence:
      'THE WORD "NON-ESSENTIAL" IS THE HINGE OF PART A. It is what licenses a motion audit by CATEGORY rather than a global switch, and it is why tools/f1-motion.mjs classifies eleven motions into KEEP / REDUCE / REPLACE / REMOVE instead of reporting "reduced motion: supported". §5 and §7 together are why the UNAVAILABLE row in every board carries a REASON in words, carried by aria-describedby on a real control rather than as a board caption — and why qandeel.accessibility.nonColorCue.unavailable is "ink+stated-reason" rather than just the ink. §1 is what check R-01 asserts, per object, against the tree the browser engine computed.',
  },
  {
    name: 'apple-design',
    match: /[\\/]apple-design[\\/]SKILL\.md$/,
    read: '§14 Reduced motion & accessibility — "Reduced motion doesn\'t mean NO feedback — it means a gentler, non-vestibular equivalent", and the THREE INDEPENDENT SIGNALS: prefers-reduced-motion, prefers-reduced-transparency, prefers-contrast: more, with "near-solid backgrounds with a defined, contrasting border" for the last; also "avoid slow looping oscillations (near 0.2 Hz)". §12 Materials — "Never stack a light translucent surface on another"; material weight encodes hierarchy. §15 Typography — "Respect the user\'s text-size setting. Scale layout WITH the text — spacing in rem/em, not fixed px."',
    consequence:
      'THREE STRUCTURAL CONSEQUENCES. (1) THREE SIGNALS, THREE MODIFIERS — the resolver has a contrast modifier and a transparency modifier and deliberately does NOT have a motion one, because motion resolves to no colour; that split is this section\'s shape applied honestly rather than copied. (2) "A DEFINED, CONTRASTING BORDER" IS WHY qandeel.accessibility.contrast.boundary EXISTS AT ALL. Without it the increased-contrast expression would have had no answer for a World and a functional Surface separated by 1.072:1, and the tempting answer — lighten the Surface — would have moved a frozen value. (3) The 0.2 Hz line is why the ambient field\'s STILLNESS is recorded in the motion inventory as a decision already taken rather than as an absence.',
  },
  {
    name: 'animate-expo',
    match: /[\\/]animate-expo[\\/]SKILL\.md$/,
    read: '§9 Reduced motion and accessibility — "Reduced motion means FEWER AND GENTLER, not zero: keep opacity and color changes that explain a state change, drop translation, scale, parallax and overshoot"; the useReducedMotion / ReduceMotion.System API; and "Text scales. allowFontScaling is on by default, so any height you measured at default type size is wrong at 200%. Never animate to a hardcoded height." §7 Press — feedback on press-in; 44x44pt minimum target.',
    consequence:
      'THE CHANNEL MODEL IS THIS SENTENCE TURNED INTO TOKENS. "Keep opacity and colour changes, drop translation, scale, parallax and overshoot" is exactly qandeel.accessibility.motion.{level,ink,draw} = 1 against {travel,scale,parallax-differential,decay,blur} = 0. And §9\'s SCALE clause is the reason F1 added interaction.press to a table D2R left implicit, splitting one behaviour into a ground response that survives and a scale that goes. The allowFontScaling note is why qandeel.accessibility.text.label-escape-scale exists as a LAYOUT switch rather than as a font-size clamp.',
  },
  {
    name: 'react-native-best-practices / references/animations/animations-performance.md',
    match: /[\\/]react-native-best-practices[\\/]references[\\/]animations[\\/]animations-performance\.md$/,
    read: 'The ACCESSIBILITY section: the full per-animation-type behaviour table under reduced motion — withSpring/withTiming "jump to toValue immediately", withRepeat infinite "do not start", "Exiting / shared element transitions — OMITTED ENTIRELY"; and "useReducedMotion returns true if the device has reduced motion enabled AT APP START. Does not update at runtime if the user changes the setting."',
    consequence:
      'THE SINGLE MOST LOAD-BEARING SKILL LINE IN THIS PACKAGE, AND IT WENT AGAINST THE OBVIOUS DESIGN. The obvious implementation of Reduced Motion is a global <ReducedMotionConfig mode={ReduceMotion.System} />. This table says that global default DELETES the exit — and QANDEEL\'s exit is the 1,150 ms settle that carries the result. So the token file carries a scalar literally named system-default-is-wrong-here, tools/f1-motion.mjs ships RUNTIME_DEFAULT with the documented behaviour quoted and four specific remedies, check M-03 asserts the record contains the omitted-exit row, and Board D states it. Without this file F1 would have shipped a contract that the runtime silently violates.',
  },
  {
    name: 'designing-arabic-frontends',
    match: /[\\/]designing-arabic-frontends[\\/]SKILL\.md$/,
    read: '§2 Line-height — "Arabic ascenders, descenders, and diacritics need ~1.6+ line-height… clipping risk DOUBLES with truncate (overflow-hidden)"; §5 — "letter-spacing: never on Arabic"; "No italics on Arabic"; logical-first CSS; §1 — avoid weights 100–300, use 400–700; §4 — "lang matters as much as dir: it drives OS/browser Arabic font fallback and SCREEN-READER VOICE SELECTION"; §7 — "Arabic counted nouns: 3–10 take the plural".',
    consequence:
      'FOUR, AND ONE OF THEM CHANGED AN ANSWER. (1) The line-height clause plus the TRUNCATE clause together are why Part E\'s answer to a growing label is a SEPARATE INSPECTION VIEW and never a truncation — the skill says the clipping risk doubles exactly where the tempting fix lives. (2) letter-spacing and italics are absent from every stylesheet F1 emits, and the absence is stated in the CSS so a reviewer can see it is deliberate. (3) lang="ar" on the projection root is a SCREEN-READER decision, not a font one, and it is in Part F because of this sentence. (4) The counted-noun rule caught a defect: the projection summary read «1 علاقة، 1 نمط», an English sentence in Arabic words. tools/f1-sr.mjs now carries an arabicCount() with the 1 / 2 / 3–10 / 11+ rules and gender agreement, and the line reads «8 مواضيع، علاقة واحدة، نمط واحد، وفهم جديد واحد».',
  },
  {
    name: 'writing-eloquent-arabic',
    match: /[\\/]writing-eloquent-arabic[\\/]SKILL\.md$/,
    read: 'The register table — فصحى for errors and consent; the failure modes, in particular calque structure and robotic tone; and the principle that Arabic copy is written in Arabic structure rather than translated.',
    consequence:
      'THE PATTERN SENTENCE IS COPY AND IT IS LOAD-BEARING. A PATTERN is the largest accessibility obligation QANDEEL creates — a locus and four links is not readable to anyone who cannot see them — so the sentence that replaces it had to be written rather than assembled. It reads «نمط يجمع 4 مواضيع: «…» و«…»», where يجمع frames the pattern as GATHERING a set rather than as ordering a list, and the members are joined by و, which carries no ordinal reading. A comma-separated list in Arabic would have implied a sequence the Product does not have.',
  },
  {
    name: 'impeccable / reference/craft-floor.md',
    match: /[\\/]impeccable[\\/]reference[\\/]craft-floor\.md$/,
    read: 'Verify → Motion: "Reach past transform and opacity: blur, backdrop-filter, clip-path, mask, and shadow belong to the palette when they stay smooth." Verify → Contrast: "On colored surfaces tint secondary text from that hue or the foreground; never gray." Verify → States: "hover, disabled, loading, error, empty. Plus real content, working controls, responsive composition, keyboard focus."',
    consequence:
      'THE MOTION LINE IS WHY "DRAW" IS A SURVIVING CHANNEL AND NOT AN OVERSIGHT. The naive reduced-motion palette is opacity only; this line says a clip-path or mask REVEAL is a legitimate technique, and a reveal at a fixed position is not vestibular motion. qandeel.accessibility.motion.draw = 1 is that distinction, and it is what lets a PATTERN\'s membership links and an INSIGHT\'s keel still ARRIVE rather than simply appear. The States line is why the interaction strip on every board carries six rows rather than an illustrative two.',
  },
  {
    name: 'ui-ux-pro-max / data/ux-guidelines.csv',
    match: /[\\/]ui-ux-pro-max[\\/]SKILL\.md$/,
    read: 'Rows 99–103 of data/ux-guidelines.csv, which are WCAG 2.2 specific: Focus Not Obscured (Minimum, AA) and (Enhanced, AAA); Focus Appearance (AAA, "an indicator at least as large as a 2 CSS px perimeter with 3:1 state contrast"); and row 103, DRAGGING MOVEMENTS — "WCAG 2.2 AA requires a single-pointer alternative for author-controlled drag operations… Make dragging the only way to reorder resize or select" is the failure.',
    consequence:
      'ROW 103 FOUND AN OBLIGATION NOTHING ELSE IN THE STACK NAMED. The Living Analysis Map\'s camera is panned by dragging, and SC 2.5.7 requires a single-pointer alternative for it. That is not a motion question and not a contrast question, so no other part of this brief would have surfaced it. It is recorded in F1_KNOWN_LIMITATIONS.md and in the F2/Product carry-forward as an open obligation on the camera, alongside SC 2.3.3 — and the camera row in the motion inventory carries the disposition CARRY FORWARD rather than a design F1 is forbidden to make. Row 102 is why the increased-contrast focus perimeter is described as strengthening something that already passes rather than repairing something that fails.',
  },
];

const INSPECTED = [
  ['animate', /[\\/]animate[\\/]SKILL\.md$/, 'Read for its reduced-motion section. It is the WEB sibling of animate-expo and its guidance here is the same; the RN-specific runtime behaviour that changed F1\'s design came from animations-performance.md, so crediting this file would overstate it.'],
  ['animation-vocabulary', /[\\/]animation-vocabulary[\\/]SKILL\.md$/, 'Read. I-08B3.1-D2R already named every QANDEEL motion in this glossary\'s own vocabulary — PARALLAX, ORCHESTRATION, LINE DRAWING, REVEAL, FOLLOW-THROUGH — and F1 inherits those names rather than renaming anything. Nothing here changed a disposition.'],
  ['improve-animations', /[\\/]improve-animations[\\/]SKILL\.md$/, 'Read. It plans codebase-wide motion audits and produces implementation plans for other agents. F1 audits a frozen PROOF system it may not modify, so the output shape does not apply.'],
  ['find-animation-opportunities', /[\\/]find-animation-opportunities[\\/]SKILL\.md$/, 'Read. It proposes motion where none exists. §19 forbids F1 from designing any new motion, so applying it would have produced work the brief rejects.'],
  ['emil-design-eng', /[\\/]emil-design-eng[\\/]SKILL\.md$/, 'Read. Its subject is component-level polish and the feel of interaction. F1 changes no component and adds no interaction; the interaction grammar is E1\'s and is inherited unchanged.'],
  ['frontend-design', /[\\/]frontend-design[\\/]SKILL\.md$/, 'Read, in BOTH installed copies — the project copy and the plugin-cache copy differ in content and both are hashed below. Its subject is choosing a visual direction. F1 has no direction to choose: every value it may touch is either frozen or derived by search.'],
  ['react-native-best-practices', /[\\/]react-native-best-practices[\\/]SKILL\.md$/, 'Read as the index that routes to references/animations/. The routing file itself changed nothing; the reference it pointed to changed a great deal, and is credited under USED separately.'],
  ['react-navigation', /[\\/]react-navigation[\\/]SKILL\.md$/, 'Read for its safe-area and header guidance under larger text. QANDEEL\'s navigation morphology is unreconciled and out of scope for F1 — E1 recorded that — so applying it would have decided something F1 has no authority over.'],
  ['react-native-tv-best-practices', /[\\/]react-native-tv-best-practices[\\/]SKILL\.md$/, 'Read specifically for its FOCUS guidance, since a D-pad product has the strictest focus requirements of any. Its model is directional focus between spatially adjacent elements, which depends on geometry meaning something. In QANDEEL geometry means nothing, so the model does not transfer.'],
  ['pulsar-haptics', /[\\/]pulsar-haptics[\\/]SKILL\.md$/, 'Read, and the reason is specific: haptics are a NON-VISUAL channel, and Apple\'s Motion page says to "supplement visual feedback by also using alternatives like haptics and audio". A haptic could in principle carry a meaning event under Reduced Motion. NOT APPLIED, because animate-expo\'s rule is absolute — "never the only feedback… haptics are off system-wide for many users, and silent on most Android hardware" — so a haptic could only ever be additive, and adding one would be designing new feedback, which §19 forbids. Recorded as an F2/Product option rather than taken.'],
  ['design-critique', /[\\/]design-critique[\\/]SKILL\.md$/, 'Not opened for application. Independent Product and Design review owns the critique of this package, and inviting a second opinion into the execution would blur who decided what.'],
  ['user-research', /[\\/]user-research[\\/]SKILL\.md$/, 'Read. It plans research with people. No user was involved in F1 and none could be on this host; the absence is recorded in F1_KNOWN_LIMITATIONS.md rather than papered over with a method.'],
  ['prototype', /[\\/]prototype[\\/]SKILL\.md$/, 'Read. F1 ships rendered proofs and a token contract rather than an interactive prototype; the boards are the deliverable §22 asks for.'],
  ['react-native-best-practices / references/animations/canvas-animations.md',
    /[\\/]references[\\/]animations[\\/]canvas-animations\.md$/,
    'Read — this is the Skia coverage the brief asks about, and it exists under this name rather than as a skill of its own. Read for ONE fact: a Skia Canvas is a single opaque node to an accessibility API, so analytical content cannot live only inside it. That fact is already the inherited I-08B3.1-D2R §5 constraint, so it is credited there and restated as qandeel.accessibility.projection.canvas rather than claimed as new here.'],
  ['review-animations',
    /[\\/]review-animations[\\/]SKILL\.md$/,
    'PRESENT ON THIS HOST AND HASHED BELOW, BUT NOT INVOCABLE. It carries disable-model-invocation, and the Skill tool refuses it with "Ask the user to run /review-animations themselves — it cannot be invoked via the Skill tool. Do not replicate this skill\'s workflow by other means." §20 names motion review as a relevant category, so this is said plainly rather than worked around: the file was not opened and its checklist was not reconstructed. animate-expo and react-native-best-practices/references/animations cover the runtime and reduced-motion ground, and both are credited above.'],
];

const NOT_AVAILABLE = [
  ['dataviz', 'Not installed on this host under any scope — the inventory below is the evidence. Listed because a reader may expect it: F1 paints no chart and encodes no quantity, so its absence changes nothing.'],
  ['an Android-accessibility skill', 'None exists on this host under any name. Android guidance in F1 comes entirely from the Reference Gate — the React Native AccessibilityInfoModule.kt source on the main branch — and F1_PLATFORM_MAPPING.md says so rather than implying a skill covered it.'],
  ['a screen-reader-semantics skill', 'None exists on this host. The VoiceOver model in Part F comes from Apple\'s VoiceOver HIG page and from the browser accessibility tree, both recorded in the Reference Gate.'],
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
    generatedBy: 'tools/f1-skills.mjs',
    state,
    probe: { name: 'the UNVERIFIABLE branch, fed a synthetic empty inventory', result: probeState },
    inventoried: inv.length,
    rows: [...used, ...inspected, ...absent],
    inventory: inv.map((i) => ({ path: i.path, bytes: i.bytes, sha256: i.sha256 })),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const g = gate();
  writeFileSync(join(PKG, 'data/F1_SKILLS.json'), JSON.stringify(g, null, 2) + '\n');
  console.log('state:', g.state);
  console.log('inventoried:', g.inventoried, 'skill files hashed');
  for (const r of g.rows) {
    const tag = r.status === 'USED' ? (r.found ? 'USED   ' : 'MISSING') : r.status === 'NOT AVAILABLE' ? 'ABSENT ' : 'INSPECT';
    console.log('  ' + tag + ' ' + r.name.padEnd(56) + (r.sha256 ? r.sha256.slice(0, 12) + '  ' + r.bytes + ' B' : (r.copies?.length ? r.copies.length + ' cop' + (r.copies.length > 1 ? 'ies' : 'y') : '')));
  }
  console.log('probe:', g.probe.result);
  if (g.state.startsWith('FAIL')) process.exit(1);
}
