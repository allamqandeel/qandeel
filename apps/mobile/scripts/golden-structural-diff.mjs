// Controlled golden re-anchor aid (COSMOS-INT-01 Slice E D-1, PO 2026-11-18): a STRUCTURAL comparison of two recordings of
// `living-analysis-screen.golden.json`. It walks both trees in parallel and lists EVERY differing leaf, with its path and
// the host element that owns it. Arrays must keep their lengths and keys their sets except where a leaf is added; an
// added or removed host element, a changed type, a changed order or a changed child count is reported as STRUCTURE and
// fails. Each leaf difference is then classified against an explicit allow-list; anything not allowed fails.
//
// Allowed (D-1, the only authorised changes):
//   BEAD_ALIGN  a depth-rail bead (role button, the bead's own style: minHeight 44, row, justifyContent flex-end, gap 8)
//               gains `alignSelf: 'flex-end'` in its style;
//   BEAD_TOUCH  a depth-rail bead's `pointerEvents` becomes 'none' when it is the selected (current) depth, and stays
//               'auto' otherwise.
//
// Allowed (D-3 CP2/CP3, PO 2026-11-18: SE-FU-2, E-1 option (a), the rail below the top controls; contract §25):
//   BEAD_TOUCH  extended: a bead's `pointerEvents` becomes 'none' whenever it is disabled (the current depth or a deeper
//               one); a shallower bead, which acts, keeps its touch;
//   RAIL_LINE   the rail's 1-point line gains `pointerEvents: 'none'`;
//   RAIL_TOP    the rail's top moves from the style sheet's '36%' to a number in its own style (36 % of the glass, or
//               just below the top controls when they reach it);
//   BACK_HOME   Back at home (disabled) gains `pointerEvents: 'none'`, `accessibilityElementsHidden: true` and
//               `importantForAccessibility: 'no-hide-descendants'`; Back's style gains `flexShrink: 1`;
//   BACK_AWAY   away from home, the same three props are now written out at their defaults ('auto', false, 'auto'):
//               no behaviour changes;
//   OVERVIEW    Overview's style gains `flexShrink: 0`.
// usage: node golden-structural-diff.mjs <old.json> <new.json>   (exit 0 only when every difference is allowed)
import fs from 'node:fs';

const [oldFile, newFile] = process.argv.slice(2);
const before = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
const after = JSON.parse(fs.readFileSync(newFile, 'utf8'));
const diffs = [];
const structure = [];

const isHost = (n) => n !== null && typeof n === 'object' && !Array.isArray(n) && typeof n.type === 'string' && 'props' in n;
const flatStyle = (style) => (Array.isArray(style) ? Object.assign({}, ...style.flat(4).filter((s) => s && typeof s === 'object')) : style ?? {});
const isBead = (host) => {
  if (!host || host.props?.accessibilityRole !== 'button') return false;
  const s = flatStyle(host.props.style);
  return s.minHeight === 44 && s.flexDirection === 'row' && s.justifyContent === 'flex-end' && s.gap === 8;
};
const describe = (host) => (host ? `${host.type}${host.props?.testID ? `#${host.props.testID}` : ''}${host.props?.accessibilityLabel ? `[${host.props.accessibilityLabel}]` : ''}` : '(root)');

function walk(a, b, path, hostA, hostB) {
  if (isHost(a) !== isHost(b)) return structure.push(`${path}: host element ${isHost(a) ? 'removed' : 'added'}`);
  if (isHost(a)) {
    if (a.type !== b.type) return structure.push(`${path}: type ${a.type} -> ${b.type}`);
    hostA = a; hostB = b;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return diffs.push({ path, a, b, hostA, hostB });
    if (path.endsWith('.children') && a.length !== b.length) return structure.push(`${path}: ${a.length} -> ${b.length} children`);
    if (a.length !== b.length) return diffs.push({ path, a, b, hostA, hostB });
    a.forEach((v, i) => walk(v, b[i], `${path}[${i}]`, hostA, hostB));
    return;
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], `${path}.${k}`, hostA, hostB);
    return;
  }
  if (a !== b) diffs.push({ path, a, b, hostA, hostB });
}

const cases = new Set([...Object.keys(before), ...Object.keys(after)]);
for (const name of cases) {
  if (!(name in before) || !(name in after)) { structure.push(`${name}: case ${name in before ? 'removed' : 'added'}`); continue; }
  walk(before[name], after[name], name, null, null);
}

const tally = {};
const disallowed = [];
for (const d of diffs) {
  const bead = isBead(d.hostB) && isBead(d.hostA);
  let kind = null;
  if (bead && /\.props\.style(\[\d+\])*\.alignSelf$/.test(d.path) && d.a === undefined && d.b === 'flex-end') kind = 'BEAD_ALIGN';
  if (bead && /\.props\.pointerEvents$/.test(d.path)) {
    const disabled = d.hostB.props.accessibilityState?.disabled === true;
    if (disabled && d.b === 'none') kind = 'BEAD_TOUCH';
  }
  const id = d.hostB?.props?.testID;
  const sA = flatStyle(d.hostA?.props?.style), sB = flatStyle(d.hostB?.props?.style);
  const sameBut = (key, value) => {
    const expected = { ...sA, [key]: value };
    return Object.keys(expected).length === Object.keys(sB).length && Object.entries(expected).every(([k, v]) => sB[k] === v);
  };
  const styleLeaf = /\.props\.style(\[\d+\])*(\.\w+)?$/.test(d.path);
  if (id === undefined && sB.position === 'absolute' && sB.width === 1 && sB.top === 22 && sB.bottom === 22
    && /\.props\.pointerEvents$/.test(d.path) && d.a === undefined && d.b === 'none') kind = 'RAIL_LINE';
  if (id === 'qandeel-cosmos-rail' && ((/\.props\.style\[0\]\.top$/.test(d.path) && d.a === '36%' && d.b === undefined)
    || (/\.props\.style\[1\]\.top$/.test(d.path) && d.a === undefined && typeof d.b === 'number' && d.b > 0))) kind = 'RAIL_TOP';
  if (id === 'qandeel-cosmos-back') {
    const home = d.hostB.props.accessibilityState?.disabled === true;
    if (home && d.a === undefined && ((/\.props\.pointerEvents$/.test(d.path) && d.b === 'none')
      || (/\.props\.accessibilityElementsHidden$/.test(d.path) && d.b === true)
      || (/\.props\.importantForAccessibility$/.test(d.path) && d.b === 'no-hide-descendants'))) kind = 'BACK_HOME';
    if (!home && d.a === undefined && ((/\.props\.pointerEvents$/.test(d.path) && d.b === 'auto')
      || (/\.props\.accessibilityElementsHidden$/.test(d.path) && d.b === false)
      || (/\.props\.importantForAccessibility$/.test(d.path) && d.b === 'auto'))) kind = 'BACK_AWAY';
    if (styleLeaf && sameBut('flexShrink', 1)) kind = 'BACK_HOME';
  }
  if (id === 'qandeel-cosmos-overview' && styleLeaf && sameBut('flexShrink', 0)) kind = 'OVERVIEW';
  if (kind === null) disallowed.push(d);
  else tally[kind] = (tally[kind] ?? 0) + 1;
}

// Every bead in the NEW tree: its touch must follow whether it acts (D-3: only a shallower, enabled bead takes touch),
// and its style must carry the alignment.
let beads = 0, beadFaults = 0;
const visit = (n) => {
  if (Array.isArray(n)) return n.forEach(visit);
  if (!isHost(n)) return;
  if (isBead(n)) {
    beads += 1;
    const disabled = n.props.accessibilityState?.disabled === true;
    if ((disabled ? 'none' : 'auto') !== (n.props.pointerEvents ?? 'auto') || flatStyle(n.props.style).alignSelf !== 'flex-end') beadFaults += 1;
  }
  (n.children ?? []).forEach(visit);
};
Object.values(after).forEach(visit);

console.log(`cases: ${cases.size}; leaf differences: ${diffs.length}; structural differences: ${structure.length}`);
console.log(`allowed: ${JSON.stringify(tally)}; beads in the new tree: ${beads}, of which inconsistent: ${beadFaults}`);
for (const s of structure.slice(0, 20)) console.log(`STRUCTURE ${s}`);
for (const d of disallowed.slice(0, 40)) console.log(`DISALLOWED ${d.path} (${describe(d.hostB)}): ${JSON.stringify(d.a)} -> ${JSON.stringify(d.b)}`);
const perCase = {};
for (const d of diffs) { const c = d.path.split('.')[0]; perCase[c] = (perCase[c] ?? 0) + 1; }
console.log(`per case: ${JSON.stringify(perCase)}`);
process.exit(structure.length === 0 && disallowed.length === 0 && beadFaults === 0 ? 0 : 1);
