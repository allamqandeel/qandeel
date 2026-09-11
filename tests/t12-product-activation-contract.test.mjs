/**
 * T-12 — a Product act is not integrated because its kernel exists.
 *
 * Semantic Zoom passed every test it had for two whole tasks. The canonical action existed, the
 * camera resolver existed, the rung lineage was proved, the boundary refusal was proved, and reversible
 * history was proved across it. On the physical device it did nothing at all, because nothing a reader
 * could touch dispatched it: the Map carried a single pan, and the only production caller was the
 * accessibility layer. Every green test was true, and the feature was still absent.
 *
 * So this gate asks the question those tests could not. For a reader-facing act it distinguishes FIVE
 * separate facts, and a claim of integration needs all of them:
 *
 *   1. the canonical action and its executor exist;
 *   2. at least one genuine PRODUCTION activation path exists — a non-test module that dispatches it;
 *   3. the required non-gesture / accessibility equivalent exists;
 *   4. that path is reachable by import from the real Product root, not merely present in the tree;
 *   5. a test exercises the production dependency graph rather than calling the executor directly.
 *
 * It is deliberately not a file count and not a whole-file hash: both would break on unrelated edits
 * and neither says anything about reachability. What is pinned is the SHAPE of the integration.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootPath = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mobileSrc = join(rootPath, 'apps/mobile/src');

function listFiles(directory) {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const at = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...listFiles(at));
    else if (entry.isFile() && /\.(?:ts|tsx)$/u.test(entry.name)) found.push(at);
  }
  return found;
}

const isScaffolding = (file) => /(?:^|[\\/])__(?:tests|fixtures|validation)__[\\/]/u.test(file) || /\.test\.tsx?$/u.test(file);
const read = (file) => readFileSync(file, 'utf8');
const rel = (file) => relative(mobileSrc, file).replace(/\\/gu, '/');

/** Resolve one relative specifier to a real file, honouring directory barrels. */
function resolveSpecifier(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), specifier);
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // not this one
    }
  }
  return null;
}

/** Every production module reachable by import from the Product root. */
function reachableFromProductRoot() {
  const start = join(mobileSrc, 'integration/composition/ProductRoot.tsx');
  const seen = new Set();
  const queue = [start];
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file) || isScaffolding(file)) continue;
    seen.add(file);
    for (const match of read(file).matchAll(/from\s+'([^']+)'/gu)) {
      const next = resolveSpecifier(file, match[1]);
      if (next !== null && !seen.has(next)) queue.push(next);
    }
  }
  return seen;
}

const ALL = listFiles(mobileSrc);
const PRODUCTION = ALL.filter((file) => !isScaffolding(file));
const REACHABLE = reachableFromProductRoot();

/**
 * The reader-facing acts this gate covers.
 *
 * Semantic Zoom is the one this pass proves, and it is the one that was absent. `activation` is the
 * touch/pointer route; `accessible` is the route that must exist without it.
 */
const ACTS = [
  {
    id: 'SEMANTIC_ZOOM',
    canonicalAction: 'ZOOM_SEMANTIC',
    executor: 'zoomSemanticStep',
    activationEvidence: /Gesture\.Pinch\(\)/u,
    accessibleEvidence: /'zoom-in'|'zoom-out'/u,
  },
];

for (const act of ACTS) {
  test(`${act.id} — the canonical action and its executor exist`, () => {
    const transitions = read(join(mobileSrc, 'state/transitions.ts'));
    assert.match(transitions, new RegExp(`\\b${act.canonicalAction}\\b`, 'u'), `${act.canonicalAction} is a canonical action`);
    const executors = PRODUCTION.filter((file) => new RegExp(`export function ${act.executor}\\b`, 'u').test(read(file)));
    assert.equal(executors.length, 1, `exactly one executor declares ${act.executor}`);
  });

  test(`${act.id} — at least one PRODUCTION module dispatches it, and it is reachable from the Product root`, () => {
    const callers = PRODUCTION.filter((file) => {
      const text = read(file);
      return new RegExp(`${act.executor}\\s*\\(`, 'u').test(text) && !new RegExp(`export function ${act.executor}\\b`, 'u').test(text);
    });
    assert.ok(callers.length > 0, `${act.executor} has at least one production caller — a kernel with no caller is not an integrated act`);
    const reachable = callers.filter((file) => REACHABLE.has(file));
    assert.ok(
      reachable.length > 0,
      `${act.executor} is dispatched from a module the Product root can actually reach; callers were ${callers.map(rel).join(', ')}`,
    );
  });

  test(`${act.id} — a reader can activate it by touch`, () => {
    const activators = PRODUCTION.filter((file) => act.activationEvidence.test(read(file)) && REACHABLE.has(file));
    assert.ok(
      activators.length > 0,
      `${act.id} has a production touch route reachable from the Product root — the defect this gate exists for was a canonical act with no gesture at all`,
    );
  });

  test(`${act.id} — and without touch, through the accessibility route`, () => {
    const accessible = PRODUCTION.filter(
      (file) => act.accessibleEvidence.test(read(file)) && new RegExp(`${act.executor}\\s*\\(`, 'u').test(read(file)) && REACHABLE.has(file),
    );
    assert.ok(
      accessible.length > 0,
      `${act.id} stays available without the gesture, dispatched through the SAME executor rather than a second authority`,
    );
  });

  test(`${act.id} — a test exercises the production dependency graph, not the executor alone`, () => {
    // A suite that only imports the executor proves the kernel. What has to exist is a suite that
    // mounts the real surface the reader touches and drives the act through it.
    const suites = ALL.filter((file) => /\.test\.tsx$/u.test(file)).filter((file) => {
      const text = read(file);
      return /MapSurface|ProductRoot|LivingAnalysisMap/u.test(text) && new RegExp(act.canonicalAction, 'u').test(text);
    });
    assert.ok(
      suites.length > 0,
      `${act.id} is exercised through a mounted production surface; found none referencing ${act.canonicalAction}`,
    );
  });
}

test('the gate itself names no file count and no whole-file hash', () => {
  // The needles are assembled rather than written, because a literal one would appear in this file
  // and the check would fail on its own source — which is the same class of mistake as pinning a
  // whole-file hash: a rule that reacts to the text of a file rather than to what the file does.
  const self = read(fileURLToPath(import.meta.url));
  const hashing = new RegExp(['create', 'Hash'].join('') + '|' + ['sha', '256'].join(''), 'u');
  const counting = new RegExp(['ALL', '\\.length'].join(''), 'u');
  assert.doesNotMatch(self, hashing, 'a whole-file hash would break on any unrelated edit and prove nothing about reachability');
  assert.doesNotMatch(self, counting, 'a file count is not an integration fact');
});
