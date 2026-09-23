/**
 * I-08B3.1-B4 - SKILL GATE INVENTORY.
 *
 * Re-enumerated from disk, re-hashed, and diffed against the hashes I-08B3.1-B3R recorded. A skill
 * whose hash moved has been edited since B3R and B4 may not carry a B3R reading of it forward
 * without re-reading it; a hash that did not move is what entitles B4 to.
 *
 * THE PROBE LIST IS B4'S OWN. B3 probed overlays, modality and focus containment. B4 is not building
 * an overlay - it is building a TOKEN ARCHITECTURE, a theme capability and a React Native mapping,
 * so it probes that vocabulary. As always the ZEROES are the useful output: a term with no hits
 * anywhere on this machine is an obligation the Reference Gate carries alone, and the gate has to
 * say so rather than imply that a local skill settled it.
 *
 * Writes its own files. Never `node b4-skills.mjs > out` - the shell owns the encoding of a redirect
 * and the program does not.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { WORK, PKG } from './b4-tokens.mjs';

const HOME = process.env.USERPROFILE;
const PROJECT = 'E:\\QANDEEL\\QANDEEL PROJECT';
const ROOTS = [
  { key: 'user', dir: join(HOME, '.claude', 'skills') },
  { key: 'project', dir: join(PROJECT, '.claude', 'skills') },
  { key: 'plugin', dir: join(HOME, '.claude', 'plugins') },
];

const PROBES = [
  /* the token architecture */
  'design token', 'DTCG', 'tokens.json', '$value', '$type', 'alias', 'semantic token',
  'primitive token', 'design system', 'naming convention',
  /* theming and appearance */
  'theme', 'theming', 'dark mode', 'light mode', 'color scheme', 'useColorScheme', 'Appearance',
  'PlatformColor', 'DynamicColorIOS', 'appearance variant',
  /* React Native production mapping */
  'StyleSheet', 'TextInput', 'accessibilityRole', 'accessibilityViewIsModal', 'AccessibilityInfo',
  'React Native', 'Expo',
  /* the material the B-track froze, and the ones it refused */
  'surface', 'scrim', 'elevation', 'tonalElevation', 'card', 'radius', 'shadow',
  /* accessibility obligations B4 carries or defers */
  'reduce transparency', 'high contrast', '1.4.11', 'contrast ratio',
  /* the discipline itself */
  'invariant', 'lint', 'freeze',
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function findSkills() {
  const skills = [];
  for (const { key, dir } of ROOTS) {
    if (!existsSync(dir)) continue;
    for (const f of walk(dir)) {
      if (!/SKILL\.md$/i.test(f)) continue;
      const parts = f.split(/[\\/]/);
      const name = parts[parts.length - 2];
      const buf = readFileSync(f);
      skills.push({
        scope: key, name, path: f, bytes: buf.length,
        sha256: createHash('sha256').update(buf).digest('hex').toUpperCase(),
        dir: f.slice(0, f.lastIndexOf(parts[parts.length - 1]) - 1),
      });
    }
  }
  return skills.sort((a, b) => (a.scope + a.name).localeCompare(b.scope + b.name));
}

/** Every file read ONCE, every term counted against it. B1 walked 86 trees per term; this finishes. */
function probeTree(skillDir, terms) {
  const counts = new Map(terms.map((t) => [t, 0]));
  const res = terms.map((t) => [t, new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')]);
  for (const f of walk(skillDir)) {
    if (!/\.(md|mdx|txt|json|ts|tsx|js|mjs|css|html)$/i.test(f)) continue;
    let t;
    try { t = readFileSync(f, 'utf8'); } catch { continue; }
    for (const [term, re] of res) {
      re.lastIndex = 0;
      const n = (t.match(re) || []).length;
      if (n) counts.set(term, counts.get(term) + n);
    }
  }
  return counts;
}

const skills = findSkills();
for (const s of skills) s.counts = probeTree(s.dir, PROBES);

const B3R_INV = join(PROJECT, 'I-08B3.1-B3R-OVERLAY-SEMANTICS-FOCUS-LIFECYCLE-VERIFICATION', 'docs', 'B3_SKILL_INVENTORY.md');
/**
 * The prior hashes, keyed by `scope/name` to a LIST.
 *
 * A list rather than a value because of a finding this gate made about itself. Two skill NAMES -
 * `access` and `configure` - are installed twice in the plugin tree with different contents. A map
 * keyed name -> hash silently keeps the last one, so both of today's copies are compared against
 * ONE recorded hash and at least one of each pair reports CHANGED. The first run of this file
 * reported "4 changed since B3R" and not one byte had moved.
 *
 * Keying to a list makes drift mean what it says, and the collision itself becomes something the
 * gate states out loud - see section 1c. Which copy a session would actually load is NOT determined
 * by a disk walk, and this gate does not pretend to know.
 */
const prior = new Map();
let priorFound = false;
if (existsSync(B3R_INV)) {
  priorFound = true;
  for (const m of readFileSync(B3R_INV, 'utf8')
    .matchAll(/\|\s*\d+\s*\|\s*(\w+)\s*\|\s*`([^`]+)`\s*\|\s*(\d+)\s*\|\s*`([0-9A-F]{64})`\s*\|/g)) {
    const k = `${m[1]}/${m[2]}`;
    if (!prior.has(k)) prior.set(k, []);
    prior.get(k).push({ bytes: +m[3], sha: m[4] });
  }
}

const drift = skills.map((s) => {
  const p = prior.get(`${s.scope}/${s.name}`);
  return { ...s, priorShas: p ? p.map((x) => x.sha) : null,
    state: !priorFound ? 'unknown' : !p ? 'NEW since B3R'
      : p.some((x) => x.sha === s.sha256) ? 'unchanged' : 'CHANGED since B3R' };
});
const gone = [...prior.keys()].filter((k) => !skills.some((s) => `${s.scope}/${s.name}` === k));

/** Names installed more than once, with differing content. Reported, never deduplicated away. */
const byName = new Map();
for (const s of skills) {
  const k = `${s.scope}/${s.name}`;
  if (!byName.has(k)) byName.set(k, []);
  byName.get(k).push(s);
}
const collisions = [...byName.entries()].filter(([, v]) => v.length > 1);

/**
 * THE SECOND SOURCE, enumerated live this session with the runtime's own skill listing and pasted
 * verbatim from its output. These are the skills the runtime reports as ENABLED for this account;
 * several have no SKILL.md under any scanned root and therefore cannot be hashed, which is precisely
 * the delta this section exists to make visible.
 */
const SESSION_ENABLED = [
  'docs', 'import-memory', 'morning', 'setup-writing-style', 'skill-creator',
  'xlsx', 'pptx', 'pdf', 'docx',
];

const lines = [];
const L = (s = '') => lines.push(s);

L('# B4_SKILL_INVENTORY (machine-generated)');
L('');
L('Generated by `tools/b4-skills.mjs`, which writes this file itself. Nothing here is hand-entered');
L('except the second-source list in section 1b, which is pasted verbatim from the session tool that');
L('produced it.');
L('');
L(`Skills found on disk: **${skills.length}**  (` +
  ROOTS.map((r) => `${r.key} ${skills.filter((s) => s.scope === r.key).length}`).join(', ') + ')');
L(`Distinct skill names: **${new Set(skills.map((s) => s.name)).size}**. ` +
  `Distinct SKILL.md hashes: **${new Set(skills.map((s) => s.sha256)).size}**.`);
L('');
L('## 1. Inventory, integrity hashes, and drift against I-08B3.1-B3R');
L('');
L(priorFound
  ? `Compared against \`I-08B3.1-B3R.../docs/B3_SKILL_INVENTORY.md\`, which recorded **${prior.size}** skills.`
  : '**B3R inventory not found on disk** - drift cannot be computed and is reported as `unknown` rather than as "no drift".');
L('');
L('| # | scope | skill | bytes | SHA-256 of SKILL.md | vs B3R |');
L('|---|---|---|---|---|---|');
drift.forEach((s, i) => L(`| ${i + 1} | ${s.scope} | \`${s.name}\` | ${s.bytes} | \`${s.sha256}\` | ${s.state} |`));
L('');
L(`Changed since B3R: **${drift.filter((s) => s.state === 'CHANGED since B3R').length}**. ` +
  `New since B3R: **${drift.filter((s) => s.state === 'NEW since B3R').length}**. ` +
  `Present at B3R and absent now: **${gone.length}**${gone.length ? ' (' + gone.join(', ') + ')' : ''}.`);
L('');
L('## 1c. Name collisions on this machine');
L('');
L('**' + collisions.length + '** skill name(s) are installed more than once under the same scope, with');
L('different content at each path. This is reported rather than deduplicated because a walk of the disk');
L('cannot tell which copy a session would load, and a gate that quietly picked one would be inventing an');
L('answer. It also explains a figure that would otherwise be alarming: keying prior hashes by name alone');
L('made the first run of this file report drift on every collided pair when nothing had changed.');
L('');
if (collisions.length) {
  L('| scope/name | copies | distinct hashes | paths |');
  L('|---|---|---|---|');
  for (const [k, v] of collisions) {
    L(`| \`${k}\` | ${v.length} | ${new Set(v.map((s) => s.sha256)).size} | ` +
      v.map((s) => `\`${s.path.replace(HOME, '~').replace(/\\/g, '/')}\``).join('<br>') + ' |');
  }
} else {
  L('(none)');
}
L('');
L('## 1b. What the disk walk misses, enumerated rather than estimated');
L('');
const onDisk = new Set(skills.map((s) => s.name));
const enabledNotOnDisk = SESSION_ENABLED.filter((n) => !onDisk.has(n));
L('A gate that walks only `~/.claude/skills`, the project\'s `.claude/skills` and `~/.claude/plugins`');
L('reports what is INSTALLED, not what is AVAILABLE.');
L('');
L(`The session reports **${SESSION_ENABLED.length}** enabled account-level skills: ` +
  SESSION_ENABLED.map((n) => `\`${n}\``).join(', ') + '.');
L('');
L(`**${enabledNotOnDisk.length}** of them have no \`SKILL.md\` under any scanned root and therefore CANNOT BE HASHED:`);
L('');
L(enabledNotOnDisk.length ? enabledNotOnDisk.map((n) => `- \`${n}\` - enabled for this account, **no SKILL.md on disk, cannot be hashed**`).join('\n') : '- (none)');
L('');
L('**The honest limitation.** The disk walk answers "what is installed and hashable"; the runtime');
L('listing answers "what is enabled at the account level". Neither is a complete list of what a session');
L('can invoke. **What can be verified is every row in section 1, and that is what the USED');
L('classifications in `B4_SKILL_GATE.md` are built on.**');
L('');
L('## 2. B4 keyword probe across every skill tree');
L('');
L('Counted over `.md/.mdx/.txt/.json/.ts/.tsx/.js/.mjs/.css/.html` in each skill directory, not only');
L('`SKILL.md`. **A zero is a result, not an omission**: it is what entitles B4 to say that an obligation');
L('it is under has no local authority behind it, and that the Reference Gate carries it alone.');
L('');
L('| probe term | total hits | skills containing it |');
L('|---|---|---|');
for (const term of PROBES) {
  let total = 0;
  const where = [];
  for (const s of skills) {
    const n = s.counts.get(term);
    if (n) { total += n; where.push(`${s.name} (${n})`); }
  }
  L(`| \`${term}\` | ${total} | ${total ? where.join(', ') : '**none**'} |`);
}
L('');
const zeros = PROBES.filter((t) => !skills.some((s) => s.counts.get(t)));
L(`**${zeros.length} of ${PROBES.length} probes returned zero:** ` +
  (zeros.length ? zeros.map((t) => `\`${t}\``).join(', ') : '(none)') + '.');
L('');
L('That list is the single most useful output of this gate, and it is read in `B4_SKILL_GATE.md`.');
L('');

mkdirSync(join(PKG, 'docs'), { recursive: true });
mkdirSync(WORK, { recursive: true });
writeFileSync(join(PKG, 'docs', 'B4_SKILL_INVENTORY.md'), lines.join('\n') + '\n', { encoding: 'utf8' });
writeFileSync(join(WORK, 'skills.json'),
  JSON.stringify({ sessionEnabled: SESSION_ENABLED, probes: PROBES, zeros,
    skills: drift.map(({ counts, ...r }) => ({ ...r, counts: Object.fromEntries(counts) })) }, null, 2),
  { encoding: 'utf8' });

console.log(`wrote B4_SKILL_INVENTORY.md - ${skills.length} skills, ${PROBES.length} probes`);
console.log(`  changed since B3R: ${drift.filter((s) => s.state === 'CHANGED since B3R').length}`);
console.log(`  new since B3R    : ${drift.filter((s) => s.state === 'NEW since B3R').length}`);
console.log(`  probes returning zero (${zeros.length}): ${zeros.length ? zeros.join(', ') : '(none)'}`);
