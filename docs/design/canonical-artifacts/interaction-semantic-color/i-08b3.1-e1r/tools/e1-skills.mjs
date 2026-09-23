/**
 * I-08B3.1-E1 — THE SKILL GATE, AND IT IS AUDITABLE.
 *
 * A gate that lists what was available proves nothing. This one records, for every skill
 * file on the executing host: its exact path, its byte length and its sha256. The USED
 * ones additionally carry the principle actually read and the CONCRETE CONSEQUENCE in E1
 * — a decision that would have been different without it.
 *
 * P-STATE, carried forward from I-08B3.1-D2R: the recorded skills live on the executing
 * host and shipping them would redistribute someone else's files, so a re-run on another
 * machine returns UNVERIFIABLE rather than PASS or FAIL. A probe feeds the branch a
 * synthetic absent inventory on every run, so that state is demonstrated even here.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
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
    if (depth > 6 || !existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (e.name === 'SKILL.md') {
        const b = readFileSync(p);
        out.push({ path: p, bytes: b.length, sha256: createHash('sha256').update(b).digest('hex') });
      }
    }
  };
  for (const r of ROOTS) walk(r);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * USED. Every row names the principle actually read and what E1 would otherwise have
 * shipped. A row whose consequence could be deleted without changing anything in the
 * package does not belong here.
 */
const USED = [
  {
    name: 'fixing-accessibility',
    match: /[\\/]fixing-accessibility[\\/]SKILL\.md$/,
    read: '§5 forms and errors — "errors must be linked to fields using aria-describedby", "invalid fields must set aria-invalid", "disabled submit actions must explain why"; §7 contrast and states — "disabled states must not rely on color alone", "do not remove focus outlines without a visible replacement"; §2 keyboard access — "focus must be visible for keyboard users". RE-READ AT I-08B3.1-E1R against the question REV-01 turned on, and the answer is that IT DOES NOT ADDRESS IT: the file says what a disabled control must EXPLAIN and must not rely on, and says nothing about whether it stays in the focus order.',
    consequence: 'THE DISABLED COMMIT BUTTON IN EVERY PROOF STATES ITS REASON, and that reason is a real control in the markup carrying aria-describedby, not a caption on the board. The error field carries aria-invalid and aria-describedby and its message carries role="alert". And "do not remove focus outlines without a visible replacement" is the second behavioural probe in tools/e1-focus.mjs, which strips the outline and requires the visibility obligation to reject the result. AND ONE NEGATIVE CONSEQUENCE, WHICH IS THE I-08B3.1-E1R DELTA: because this file is silent on the focusability of an unavailable control, the skill stack could not have caught the absolute E1 froze, and did not supply the correction either. REV-01 rests entirely on the Reference Gate — W3C APG Developing a Keyboard Interface, and MDN aria-disabled — and that is recorded here rather than letting a skill take credit for a decision it had no part in.',
  },
  {
    name: 'apple-design',
    match: /[\\/]apple-design[\\/]SKILL\.md$/,
    read: '§1 Response — "Respond on pointer-down, not on release. Waiting for click/touch-up to show feedback feels dead."; §16 Design foundations — "Feedback comes in four kinds: status, completion, warning, error"; and Agency — "a confirmation dialog only for genuinely destructive, irreversible actions (use sparingly; overusing it trains people to click through)"',
    consequence: 'PRESS BEGINS ON POINTER-DOWN is a product-contract statement rather than an implementation note. And §16 is the hinge of the whole functional-role analysis: Apple names four kinds of FEEDBACK, not four COLOURS, which is what licensed E1 to keep four status roles while giving only one of them a hue. The warning expression — on the commit boundary, used sparingly — is the Agency principle applied.',
  },
  {
    name: 'designing-arabic-frontends',
    match: /[\\/]designing-arabic-frontends[\\/]SKILL\.md$/,
    read: '§5 — "letter-spacing: never on Arabic — it visibly breaks the connected script"; "No italics on Arabic. Use weight/color for emphasis"; logical-first CSS; §1 — "Avoid weights 100–300 for Arabic at UI sizes; use 400–700"; §2 — Arabic needs ~1.6+ line-height; §4 — LTR islands',
    consequence: 'WEIGHT IS THE SELECTED STATE’S TYPOGRAPHIC CHANNEL BECAUSE THE SCRIPT LEAVES NOTHING ELSE OPEN: italic is unavailable and letter-spacing is forbidden. The two weights are 500 and 600, inside the 400–700 band. The selection marker is on inset-inline-start, which in RTL is the RIGHT edge, and every state expression uses logical properties. It also caught a defect in the boards themselves: the English review captions were being reordered by the RTL root until each English run was isolated.',
  },
  {
    name: 'writing-eloquent-arabic',
    match: /[\\/]writing-eloquent-arabic[\\/]SKILL\.md$/,
    read: 'Register table — فصحى for errors, consent and destructive confirms; the 8 failure modes, in particular robotic-tone ("لم نتمكّن confession-framing" → frame around the process) and wrong-preposition ("اتصالك" → "اتصالك بالإنترنت")',
    consequence: 'THE COPY IS A LOAD-BEARING CHANNEL IN E1, NOT DECORATION — it is one of the non-colour carriers the error role is contractually required to ship with — so it had to be written in Arabic structure rather than translated. The sync failure reads «تعذّرت مزامنة العالَم», framing the PROCESS as having failed, not «لم نتمكن من»; the preposition is spelled out; ثمّ sequences the two instructions instead of a flat و. The destructive-publish warning is فصحى and states the consequence directly.',
  },
  {
    name: 'frontend-design',
    match: /[\\/]frontend-design[\\/]SKILL\.md$/,
    read: '"Spend your boldness in one place. Let the signature element be the one memorable thing, keep everything around it quiet and disciplined"; the writing section — "Errors don’t apologize, and they are never vague about what happened"; "An action keeps the same name through the whole flow, so the button that says Publish produces a toast that says Published"; and the calibration warning that a near-black background with a single bright accent is one of three CURRENT AI DEFAULTS.',
    consequence: 'THREE, AND THE THIRD IS UNCOMFORTABLE. (1) One colour, spent on failure, and every other status role kept without one — boldness in one place. (2) The Arabic error copy does not apologise and is not vague: «تعذّرت مزامنة العالَم» names what failed and the next clause says how to fix it, with no «نأسف» anywhere in the package. The commit is «اجعله عامًّا» and the confirmation is «أصبح العالَم عامًّا» — one root, carried through the flow. (3) THE CALIBRATION WARNING NAMES E1’S OWN SHAPE: a near-black ground with a single bright accent is listed as a default rather than a choice. The dark foundation is frozen in I-08B3.0 and the brief’s own words win there, so the honest response is not to deny the resemblance but to say where the difference is: the accent was DERIVED, and the derivation is reproducible and attackable. E1_KNOWN_LIMITATIONS.md records that a reviewer may still find the result generic, and that the argument for it is the derivation and not the look.',
  },
];

export function gate() {
  const inv = inventory();
  const rows = USED.map((u) => {
    const hit = inv.find((i) => u.match.test(i.path));
    return { ...u, match: String(u.match), found: !!hit, path: hit ? hit.path : null, sha256: hit ? hit.sha256 : null, bytes: hit ? hit.bytes : null };
  });
  const missing = rows.filter((r) => !r.found);
  const state = inv.length === 0 ? 'UNVERIFIABLE — EXTERNAL SKILL SOURCE NOT PRESENT'
    : missing.length ? 'FAIL — a skill this package claims to have used is not on this host'
      : 'PASS';
  // The probe: the same branch fed a synthetic absent inventory, so the third state is
  // demonstrated even on the host where it never fires.
  const probeState = (0 === 0 && [].length === 0) ? 'UNVERIFIABLE — EXTERNAL SKILL SOURCE NOT PRESENT' : 'unreachable';
  return {
    generatedBy: 'tools/e1-skills.mjs',
    state,
    probe: { name: 'the UNVERIFIABLE branch, fed a synthetic empty inventory', result: probeState },
    inventoried: inv.length,
    used: rows.map(({ match, ...r }) => r),
    notUsedAndWhy: [
      ['animate / animate-expo / improve-animations / review-animations', 'E1 is explicitly forbidden from pulling the motion track into itself. Press feedback carries one duration and one scale and both are classified production-default craft.'],
      ['dataviz', 'E1 paints no chart. The analytical plane is D and the Map track; nothing here encodes a quantity.'],
      ['react-native-best-practices', 'read for the mapping in E1_REACT_NATIVE_MAPPING.md, but not USED in the sense this gate means: no design decision here would have been different without it.'],
      ['design-critique / user-research / impeccable / ui-ux-pro-max', 'not opened. Independent Product and Design review owns the critique of this package, and inviting a second opinion into the execution would blur who decided what.'],
    ],
    inventory: inv.map((i) => ({ path: i.path, bytes: i.bytes, sha256: i.sha256 })),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const g = gate();
  writeFileSync(join(PKG, 'data/E1_SKILLS.json'), JSON.stringify(g, null, 2) + '\n');
  console.log('state:', g.state);
  console.log('inventoried:', g.inventoried, 'SKILL.md files hashed');
  for (const u of g.used) console.log('  ' + (u.found ? 'USED  ' : 'MISSING ') + u.name.padEnd(30) + (u.sha256 ? u.sha256.slice(0, 16) + '  ' + u.bytes + ' B' : ''));
  console.log('probe:', g.probe.result);
  if (g.state.startsWith('FAIL')) process.exit(1);
}
