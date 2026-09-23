/**
 * I-08B3.1-D2R — THE PRODUCT CHROME, RESOLVED FROM THE FROZEN TOKEN FILES.
 *
 * Carried forward from I-08B3.1-D0R unchanged in mechanism, and extended by one name.
 *
 * D0 painted its product chrome from hex constants it declared itself, and inherited the
 * WRONG COVERAGE POLICY while doing it: the five persistent navigation icons were drawn in
 * the frozen tertiary neutral, at 82% opacity, which is the pre-C2 state of the system. The
 * Design Director closed C2 on **P2 — IDENTITY MACHINERY FAMILY**, and I-08B3.1-C3 froze it.
 *
 * The fix is not to type a different hex. A package that swapped `#8b8982` for `#a58e6f`
 * would be correct today and would drift the moment anything upstream moved, and it would
 * still be making the same category of claim D0 made — that the chrome colour is a decision
 * this package gets to hold. It is not. So the chrome is RESOLVED out of the token files
 * I-08B3.1-C3 froze, vendored here byte-identical, and the build fails if what comes out
 * disagrees with what the scene paints.
 *
 * WHAT D1 ADDS. D0R resolved `qandeel.analysis.relation` and then painted the settled relation
 * with a literal anyway — `#4a4740`, held inside the proof, resolved from nothing. It found
 * that, recorded it, and deliberately left it, because re-pointing it changes the settled frame
 * and D0R had no remit to change the selected artefact. D1 does, and `analysisRelation` is now
 * a painting name rather than a name the resolver merely knows about. See the note on
 * CHROME.analysisRelation in d2-scene.mjs and D2_FOUNDATION_ALIGNMENT.md.
 *
 * WHY THE CHAIN IS CHECKED AND NOT ONLY THE VALUE. C3's invariant I-03 probes for a subtler
 * failure than a wrong colour: a navigation token that still resolves to Brass but reaches
 * the body BY ITS OWN ROUTE rather than through `qandeel.identity.material`. Such a token
 * paints identically and survives any check that compares colours, while having quietly left
 * the material story — it is no longer the same material as the mark, it is a second thing
 * that happens to match. So `resolve()` returns the whole chain, and the guard asserts the
 * shape of it.
 *
 * DTCG aliasing only, deliberately. `{a.b.c}` means "this token IS that token". There is no
 * modifier, no computed value and no local override, because every one of those is a way for
 * a call site to hold a colour the token tree does not know about.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const C3_VENDOR = join(HERE, '..', 'vendor', 'c3');

/**
 * The four files, and what each one is for. They are resolved TOGETHER and none of them is
 * complete alone: the material semantic layer aliases into the material expression layer,
 * and the control and analysis classes alias into the B4R Surface layers.
 */
export const TOKEN_FILES = [
  ['c3/base', join(C3_VENDOR, 'tokens', 'base', 'material.tokens.json')],
  ['c3/appearance/dark', join(C3_VENDOR, 'tokens', 'appearance', 'dark.material.tokens.json')],
  ['b4r/semantic', join(C3_VENDOR, 'b4r', 'semantic.tokens.json')],
  ['b4r/dark', join(C3_VENDOR, 'b4r', 'dark.tokens.json')],
];

/** Flatten a DTCG document to `dotted.name -> { value, file }`, keeping $-keys out. */
function flatten(node, prefix, file, out) {
  for (const key of Object.keys(node)) {
    if (key.startsWith('$')) continue;
    const v = node[key];
    if (!v || typeof v !== 'object') continue;
    const name = prefix ? `${prefix}.${key}` : key;
    if ('$value' in v) {
      const raw = v.$value;
      // A colour value is either a DTCG colour object carrying a `hex`, or an alias string.
      const value = (raw && typeof raw === 'object') ? raw.hex : raw;
      if (typeof value === 'string') out.set(name, { value, file });
    }
    flatten(v, name, file, out);
  }
}

export function loadTokens() {
  const flat = new Map();
  const sources = [];
  for (const [label, path] of TOKEN_FILES) {
    const text = readFileSync(path, 'utf8');
    flatten(JSON.parse(text), '', label, flat);
    sources.push({ label, path, bytes: Buffer.byteLength(text) });
  }
  return { flat, sources };
}

const ALIAS = /^\{([^}]+)\}$/;

/**
 * Resolve a token name to its literal, returning every hop on the way.
 *
 * Cycles terminate rather than hang: a token tree with a loop in it is a corrupted tree, and
 * a resolver that spins on one is a build that never finishes and never says why.
 */
export function resolve(flat, name, seen = []) {
  if (seen.includes(name)) throw new Error(`d2-chrome: alias cycle at ${name} (${seen.join(' -> ')})`);
  const entry = flat.get(name);
  if (!entry) throw new Error(`d2-chrome: no such token: ${name}`);
  const chain = [...seen, name];
  const m = ALIAS.exec(entry.value.trim());
  if (!m) return { value: entry.value.toLowerCase(), chain, file: entry.file };
  return resolve(flat, m[1].trim(), chain);
}

/**
 * THE PERMISSION CLASSES D1'S ONE SCENE ACTUALLY USES.
 *
 * This list is not a token file and must never become one — C3 owns the tree, and a sibling
 * copy of it is how a system ends up with two answers. It is the set of NAMES this scene
 * asks for, and everything about their values and their routes comes from the frozen files.
 *
 * `throughIdentity` records which of them are members of the identity material family, which
 * is exactly the P2 coverage policy: the names that reach the material ARE P2, and the names
 * that reach a neutral are everything P2 excludes.
 */
export const CHROME_CLASSES = [
  { role: 'identityMark', token: 'qandeel.identity.mark', throughIdentity: true,
    what: 'the canonical QANDEEL Q in the functional header' },
  { role: 'navigationMachinery', token: 'qandeel.navigation.machinery', throughIdentity: true,
    what: 'the five persistent navigation icons, as ONE family, at every state' },
  { role: 'controlFunctional', token: 'qandeel.control.functional', throughIdentity: false,
    what: 'ordinary functional and action controls — neutral by default' },
  { role: 'analysisNode', token: 'qandeel.analysis.node', throughIdentity: false,
    what: 'an analytical node — neutral, permanently' },
  { role: 'analysisRelation', token: 'qandeel.analysis.relation', throughIdentity: false,
    what: 'an analytical relation stroke — neutral, permanently' },
];

/** The frozen visual foundation, resolved from the same sealed files rather than restated. */
export const FOUNDATION_CLASSES = [
  { role: 'WORLD', token: 'qandeel.world.fill' },
  { role: 'SURFACE', token: 'qandeel.surface.functional' },
  { role: 'PRIMARY', token: 'qandeel.content.primary' },
  { role: 'SECONDARY', token: 'qandeel.content.secondary' },
  { role: 'TERTIARY', token: 'qandeel.content.tertiary' },
  { role: 'BRASS', token: 'qandeel.identity.material' },
];

export const IDENTITY_MATERIAL = 'qandeel.identity.material';

/** Everything the build and the guard need, resolved once. */
export function resolveChrome() {
  const { flat, sources } = loadTokens();
  const chrome = {};
  for (const c of CHROME_CLASSES) chrome[c.role] = { ...c, ...resolve(flat, c.token) };
  const foundation = {};
  for (const f of FOUNDATION_CLASSES) foundation[f.role] = { ...f, ...resolve(flat, f.token) };
  return { flat, sources, chrome, foundation };
}
