#!/usr/bin/env node
/**
 * INTEL-LIVE-01 CP1 — the iOS World gate's impact analysis (PO direction of 2026-11-25 on the CP1 resolution: "make the
 * full World Gate genuinely impact-aware, including its main-push policy"; backlog BG-10 clarification).
 *
 * The World gate proves COSMOS on an iOS simulator: rendering, the camera, gestures, the Personal / Shared / Public stages
 * and their sheets, and the navigation into and out of them. It is expensive (three cells of about 80 – 110 minutes). It
 * must run whenever a change can actually affect what it proves, and only then. This module decides that from the change
 * itself, by dependency analysis rather than by directory:
 *
 *   RUN           a changed file is the gate's own input, a shared dependency (the lock, the manifests, the app config,
 *                 the native project inputs of the iOS binary, the shared packages, the assets), or a mobile source file
 *                 the PROTECTED SURFACES import, directly or through any chain of imports (below); or the decision
 *                 cannot be made safely (no base, an unreadable file, a deleted mobile source, an unknown mobile file).
 *   NOT_AFFECTED  every changed file is outside the binary's inputs (the API, the database, documentation, other
 *                 workflows, Jest tests, Android-only native code), or a mobile source no protected surface imports.
 *
 * A RUN carries a SCOPE: FULL (every cell, World and native gesture) or COSMOS_CASES, when every reaching file belongs
 * to a surface with its own mandatory iOS Targeted Gate (TARGETED_SURFACES, below) and so needs only the COSMOS cases
 * that surface can affect. Reachability decides whether COSMOS can be affected; the functional classification decides
 * how much of the gate that warrants.
 *
 * The protected surfaces (PROTECTED_ROOTS) are COSMOS itself, the composition that navigates into and out of the Analysis
 * and the stages, the orientation and return chrome, temporal navigation, the map layer COSMOS draws through, and the
 * gate's synthetic proof world. The import graph follows SYMBOLS through barrels: `import { A } from '../x'` reaches the
 * module that defines A, never every module a barrel `index.ts` re-exports. Type-only imports carry no runtime code and are
 * not followed (Mobile CI's type check and contracts judge types). Every other import of an included module is followed in
 * full, so a module is either wholly in the protected closure or not reached by it at all.
 *
 * It never skips an affected test: a NOT_AFFECTED decision names every changed file and why it cannot reach the gate, and
 * any doubt answers RUN. The gate's suites, cases and assertions are unchanged; this decides only whether they run.
 *
 * CLI: node scripts/cosmos-ios-world/world-gate-impact.mjs [--base <rev>] <file> [<file> ...]   (or the files on stdin)
 *      prints one JSON object {decision, scope, reasons:[{file, class, reason, decision, scope}]}; it exits 0 either way.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { classifyPath } from '../validation/change-planner.mjs';

export const REPO = fileURLToPath(new URL('../../', import.meta.url));
const MOBILE_SRC = 'apps/mobile/src/';
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
// Metro resolves a platform file first; the iOS binary bundles `.ios.*` and `.native.*` and the plain file.
const RESOLUTION_SUFFIXES = ['.ios', '.native', ''];

/** The protected surfaces: what the World gate's cases render, touch and navigate (directories or files). */
export const PROTECTED_ROOTS = Object.freeze([
  'apps/mobile/src/cosmos/',
  'apps/mobile/src/map/',
  'apps/mobile/src/orientation-chrome/',
  'apps/mobile/src/return-navigation/',
  'apps/mobile/src/temporal-navigation/',
  'apps/mobile/src/integration/composition/DepthComposition.tsx',
  'apps/mobile/src/integration/composition/LivingAnalysisMap.tsx',
  // The gate's synthetic proof world: what its stages show. Its entry and root render the whole application, so they
  // are the gate's own inputs (a change to them runs it), not roots of the closure.
  'apps/mobile/src/integration/__validation__/s401-proof-world.ts',
]);

/** The gate's own inputs: any change to them runs it. */
export const GATE_OWN = Object.freeze({
  prefixes: ['scripts/cosmos-ios-world/'],
  files: [
    '.github/workflows/cosmos-ios-world-gate.yml',
    'scripts/validation/bounded-run.mjs',
    'apps/mobile/scripts/select-s401-proof-entry.mjs',
    'apps/mobile/src/integration/__validation__/s401-proof-entry.tsx',
    'apps/mobile/src/integration/__validation__/S401ProofRoot.tsx',
    // The gate runs `test:cosmos-ios-world-gate-composition-contract` before it builds: both its files are its inputs.
    'tests/cosmos-ios-world-gate-composition-contract.test.mjs',
    'tests/cosmos-ios-world-gate-impact.test.mjs',
  ],
});

/** The manifests whose `scripts` reach no binary: a change confined to them is NOT_AFFECTED, read against the base. */
const MANIFESTS = Object.freeze(['package.json', 'apps/mobile/package.json']);

/** Whether a manifest changed only in its `scripts` (both versions read and compared); false when either is unreadable. */
export function manifestScriptsOnly(before, after) {
  try {
    const a = JSON.parse(before);
    const b = JSON.parse(after);
    delete a.scripts;
    delete b.scripts;
    const canon = (v) => (v && typeof v === 'object' && !Array.isArray(v)
      ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`
      : JSON.stringify(v));
    return canon(a) === canon(b);
  } catch {
    return false;
  }
}

/** Shared dependencies of the iOS binary: any change to them runs the gate. */
export const SHARED_DEPENDENCIES = Object.freeze({
  prefixes: ['packages/', 'apps/mobile/assets/', 'apps/mobile/plugins/', 'apps/mobile/locales/'],
  files: ['package.json', 'package-lock.json', 'apps/mobile/package.json', 'apps/mobile/app.json', 'apps/mobile/app.config.js'],
  // The native module's iOS half is compiled into the binary; its Android half and its Android tests are not.
  nativeIos: /^apps\/mobile\/modules\/[^/]+\/(?!android\/)/u,
});

/**
 * Functional impact classification (PO, 2026-11-25, after the CP1 report: reachability alone is too broad a scope). A
 * mobile surface that has its OWN mandatory iOS Targeted Gate is proven there; COSMOS meets it only where the Analysis
 * mounts it. A change confined to such a surface runs the relevant COSMOS cases (COSMOS_CASES: the Analysis entered with
 * the surface mounted, a stage tap and its PEEK, in the reference cell), never the full matrix. `paths` are the targeted
 * gate's own pull_request paths, which the impact test holds. A protected surface itself, a shared dependency, the gate's
 * own inputs and any doubt still run the full gate.
 */
export const TARGETED_SURFACES = Object.freeze([
  {
    name: 'the live call',
    gate: '.github/workflows/ios-targeted-gate.yml',
    paths: ['apps/mobile/src/call/**', 'apps/mobile/src/voice-call/**', 'apps/mobile/modules/qandeel-voice-call/**'],
    sources: /^apps\/mobile\/src\/(?:call|voice-call)\//u,
    // The call engine's own Swift. The vendored codec and the module's build files change how the binary builds: FULL.
    native: /^apps\/mobile\/modules\/qandeel-voice-call\/ios\/(?:Core|Expo)\/[^/]+\.swift$/u,
  },
]);
const targetedSurface = (file) => TARGETED_SURFACES.find((s) => s.sources.test(file) || s.native.test(file)) ?? null;
const SCOPE_OF = (decision, cls) => (decision === 'NOT_AFFECTED' ? 'NOT_AFFECTED' : cls === 'TARGETED_SURFACE' ? 'COSMOS_CASES' : 'FULL');

/** What cannot reach the iOS binary or the gate. */
const OUTSIDE = /^(?:apps\/api\/|database\/|docs\/|tests\/|\.github\/|scripts\/(?!cosmos-ios-world\/))/u;
const MOBILE_NOT_IN_BINARY = /^apps\/mobile\/(?:\.maestro\/|scripts\/|experiments\/|eslint\.config\.js$|jest\.setup\.js$|tsconfig\.json$|modules\/[^/]+\/android\/)/u;
// Prose is recognised by VAL-01's own classifier, so this analysis and the change planner never disagree on what a doc is.
const isProse = (path) => classifyPath(path).kind === 'DOC';
const TEST_FILE = /(?:\.test\.[jt]sx?$|\/__tests__\/)/u;

const read = (path) => readFileSync(join(REPO, path), 'utf8');
const isFile = (path) => existsSync(join(REPO, path)) && statSync(join(REPO, path)).isFile();
const toRepo = (absolute) => relative(REPO, absolute).replaceAll('\\', '/');

function listSources(dir) {
  const out = [];
  for (const entry of readdirSync(join(REPO, dir), { withFileTypes: true })) {
    const path = `${dir}${entry.name}`;
    if (entry.isDirectory()) {
      // Another proof's harness (`__validation__`) is not part of this gate's app; the S401 world is named as a root itself.
      if (entry.name !== '__tests__' && entry.name !== '__validation__' && entry.name !== 'node_modules') out.push(...listSources(`${path}/`));
    } else if (SOURCE_EXTENSIONS.some((e) => entry.name.endsWith(e)) && !TEST_FILE.test(path)) {
      out.push(path);
    }
  }
  return out;
}

/** The module files a relative specifier can resolve to in the iOS bundle (platform files included). */
function resolveAll(fromFile, spec) {
  if (!spec.startsWith('.')) return [];
  const base = toRepo(join(REPO, dirname(fromFile), spec));
  if (isFile(base)) return [base];
  const found = [];
  for (const stem of [base, `${base}/index`]) {
    for (const suffix of RESOLUTION_SUFFIXES) {
      for (const ext of SOURCE_EXTENSIONS) if (isFile(`${stem}${suffix}${ext}`)) found.push(`${stem}${suffix}${ext}`);
    }
    if (found.length > 0) return found;
  }
  return found;
}

const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/gu, '$1');

/** One module's imports and re-exports, type-only ones dropped. */
export function parseModule(text) {
  const src = stripComments(text);
  const imports = []; // {spec, names: Set|'ALL'}
  const reexports = []; // {spec, map: Map<exported, imported>} | {spec, star: true} | {spec, starAs: name}
  const locals = new Set();
  const names = (list) => list.split(',').map((s) => s.trim()).filter((s) => s && !s.startsWith('type '));
  for (const m of src.matchAll(/\bimport\s+(type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]/gu)) {
    if (m[1]) continue;
    const clause = m[2].trim();
    const want = new Set();
    let all = false;
    const braces = /\{([^}]*)\}/u.exec(clause);
    if (braces) for (const n of names(braces[1])) want.add(n.split(/\s+as\s+/u)[0].trim());
    const outside = clause.replace(/\{[^}]*\}/u, '').replace(/,/gu, ' ').trim();
    if (/\*\s+as\s+\w+/u.test(outside)) all = true;
    else if (outside) want.add('default');
    if (!all && want.size === 0) continue; // `import { type A } from` only
    imports.push({ spec: m[3], names: all ? 'ALL' : want });
  }
  for (const m of src.matchAll(/\bimport\s*['"]([^'"]+)['"]/gu)) imports.push({ spec: m[1], names: 'ALL' });
  for (const m of src.matchAll(/\b(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/gu)) imports.push({ spec: m[1], names: 'ALL' });
  for (const m of src.matchAll(/\bexport\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/gu)) {
    if (m[1]) continue;
    const map = new Map();
    for (const n of names(m[2])) {
      const [imported, exported] = n.split(/\s+as\s+/u).map((s) => s.trim());
      map.set(exported ?? imported, imported);
    }
    if (map.size > 0) reexports.push({ spec: m[3], map });
  }
  for (const m of src.matchAll(/\bexport\s+\*\s+as\s+(\w+)\s+from\s*['"]([^'"]+)['"]/gu)) reexports.push({ spec: m[2], starAs: m[1] });
  for (const m of src.matchAll(/\bexport\s+\*\s+from\s*['"]([^'"]+)['"]/gu)) reexports.push({ spec: m[1], star: true });
  for (const m of src.matchAll(/\bexport\s+(?:declare\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|enum)\s+(\w+)/gu)) locals.add(m[1]);
  if (/\bexport\s+default\b/u.test(src)) locals.add('default');
  for (const m of src.matchAll(/\bexport\s+\{([^}]*)\}\s*(?!from)/gu)) {
    for (const n of names(m[1])) locals.add((n.split(/\s+as\s+/u)[1] ?? n).trim());
  }
  return { imports, reexports, locals };
}

/** The protected closure: every file the protected surfaces reach at runtime. */
export function protectedClosure(roots = PROTECTED_ROOTS) {
  const parsed = new Map();
  const parse = (file) => {
    if (!parsed.has(file)) parsed.set(file, parseModule(read(file)));
    return parsed.get(file);
  };
  const included = new Set();
  const requested = new Set();
  const provides = new Map();
  // Whether `file` exports `name`, locally or through its re-exports.
  const exportsName = (file, name, seen = new Set()) => {
    const key = `${file}#${name}`;
    if (provides.has(key)) return provides.get(key);
    if (seen.has(file)) return false;
    seen.add(file);
    const mod = parse(file);
    let ok = mod.locals.has(name)
      || mod.reexports.some((r) => (r.map && r.map.has(name)) || r.starAs === name)
      || mod.reexports.some((r) => r.star && resolveAll(file, r.spec).some((t) => exportsName(t, name, seen)));
    provides.set(key, ok);
    return ok;
  };
  const stack = [];
  const want = (file, name) => {
    const key = `${file}#${name}`;
    if (!requested.has(key)) {
      requested.add(key);
      stack.push([file, name]);
    }
  };
  for (const root of roots) {
    const files = root.endsWith('/') ? listSources(root) : [root];
    for (const f of files) want(f, '*');
  }
  while (stack.length > 0) {
    const [file, name] = stack.pop();
    const mod = parse(file);
    const local = name === '*' || mod.locals.has(name);
    if (local && !included.has(file)) {
      included.add(file);
      for (const imp of mod.imports) {
        for (const target of resolveAll(file, imp.spec)) {
          if (!SOURCE_EXTENSIONS.some((e) => target.endsWith(e))) included.add(target); // an asset
          else if (imp.names === 'ALL') want(target, '*');
          else for (const n of imp.names) want(target, n);
        }
      }
    }
    for (const r of mod.reexports) {
      const targets = resolveAll(file, r.spec);
      if (name === '*') {
        for (const t of targets) {
          if (r.map) for (const imported of r.map.values()) want(t, imported);
          else want(t, '*');
        }
      } else if (r.map && r.map.has(name)) {
        for (const t of targets) want(t, r.map.get(name));
      } else if (r.starAs === name) {
        for (const t of targets) want(t, '*');
      } else if (r.star) {
        for (const t of targets) if (exportsName(t, name)) want(t, name);
      }
    }
    // A barrel reached for one symbol is evaluated too (its own top-level code), but not the modules it re-exports.
    if (!local && name !== '*' && mod.reexports.length > 0) included.add(file);
  }
  return included;
}

/**
 * The decision for a changed-file set. `closure` may be passed in (tests); it is computed only when needed. `readBase(file)`
 * returns a file's content at the change's base, or null; without it a manifest change always runs the gate.
 */
export function planWorldGate(changed, { closure, readBase } = {}) {
  const files = [...new Set(changed.map((f) => f.trim()).filter(Boolean))];
  if (files.length === 0) return { decision: 'RUN', scope: 'FULL', reasons: [{ file: null, class: 'NO_CHANGE_SET', reason: 'no changed-file set: run' }] };
  let reach = closure ?? null;
  const reasons = [];
  for (const file of files) {
    let verdict;
    if (GATE_OWN.files.includes(file) || GATE_OWN.prefixes.some((p) => file.startsWith(p)) || file === 'scripts/cosmos-ios-world/world-gate-impact.mjs') {
      verdict = ['RUN', 'GATE_OWN', 'the gate\'s own input'];
    } else if (MANIFESTS.includes(file) && isFile(file) && manifestScriptsOnly(readBase?.(file) ?? '', read(file))) {
      verdict = ['NOT_AFFECTED', 'MANIFEST_SCRIPTS_ONLY', 'only the manifest\'s `scripts` changed (read against the base): no dependency, entry or config of the binary'];
    } else if (SHARED_DEPENDENCIES.files.includes(file) || SHARED_DEPENDENCIES.prefixes.some((p) => file.startsWith(p))) {
      verdict = ['RUN', 'SHARED_DEPENDENCY', 'a shared dependency of the iOS binary'];
    } else if (targetedSurface(file)?.native.test(file)) {
      verdict = ['RUN', 'TARGETED_SURFACE', `the native engine of ${targetedSurface(file).name}: proven by ${targetedSurface(file).gate}; COSMOS runs its relevant cases with it linked`];
    } else if (SHARED_DEPENDENCIES.nativeIos.test(file)) {
      verdict = ['RUN', 'SHARED_DEPENDENCY', 'native code compiled into the iOS binary'];
    } else if (isProse(file)) {
      verdict = ['NOT_AFFECTED', 'OUTSIDE_BINARY', 'prose: never bundled into the iOS binary'];
    } else if (file.startsWith(MOBILE_SRC) && TEST_FILE.test(file)) {
      verdict = ['NOT_AFFECTED', 'TEST_ONLY', 'a Jest test: never bundled'];
    } else if (file.startsWith(MOBILE_SRC)) {
      if (!isFile(file)) verdict = ['RUN', 'DELETED_SOURCE', 'a deleted mobile source: run'];
      else {
        if (reach === null) {
          try {
            reach = protectedClosure();
          } catch (error) {
            return { decision: 'RUN', scope: 'FULL', reasons: [{ file, class: 'ANALYSIS_FAILED', reason: `the import analysis failed (${error.message}): run` }] };
          }
        }
        let reached;
        try {
          reached = reach.has(file);
        } catch (error) {
          return { decision: 'RUN', scope: 'FULL', reasons: [{ file, class: 'ANALYSIS_FAILED', reason: `the import analysis failed (${error.message}): run` }] };
        }
        const owner = targetedSurface(file);
        if (!reached) verdict = ['NOT_AFFECTED', 'UNREACHED_SOURCE', 'no protected surface imports it, directly or through any chain of imports'];
        else if (owner) verdict = ['RUN', 'TARGETED_SURFACE', `${owner.name}, mounted by the Analysis: proven by ${owner.gate}; COSMOS runs its relevant cases`];
        else verdict = ['RUN', 'PROTECTED_SURFACE', 'imported by a protected surface (COSMOS rendering, camera, gestures or navigation)'];
      }
    } else if (MOBILE_NOT_IN_BINARY.test(file)) {
      verdict = ['NOT_AFFECTED', 'NOT_IN_BINARY', 'not an input of the iOS binary or of this gate'];
    } else if (file.startsWith('apps/mobile/')) {
      verdict = ['RUN', 'UNKNOWN_MOBILE', 'a mobile file this analysis does not classify: run'];
    } else if (OUTSIDE.test(file)) {
      verdict = ['NOT_AFFECTED', 'OUTSIDE_BINARY', 'outside the iOS binary (the API, the database, documentation, other tooling)'];
    } else {
      verdict = ['RUN', 'UNKNOWN', 'a path this analysis does not classify: run'];
    }
    reasons.push({ file, class: verdict[1], reason: verdict[2], decision: verdict[0], scope: SCOPE_OF(verdict[0], verdict[1]) });
  }
  // The widest scope any file needs: FULL over COSMOS_CASES over NOT_AFFECTED.
  const scope = ['FULL', 'COSMOS_CASES'].find((s) => reasons.some((r) => r.scope === s)) ?? 'NOT_AFFECTED';
  return { decision: scope === 'NOT_AFFECTED' ? 'NOT_AFFECTED' : 'RUN', scope, reasons };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  // `--base <rev>`: the change's base, read with git for the manifests; anything unreadable is null (and runs the gate).
  let args = process.argv.slice(2);
  let base = null;
  if (args[0] === '--base') {
    base = args[1] ?? null;
    args = args.slice(2);
  }
  const readBase = (file) => {
    if (!base) return null;
    const shown = spawnSync('git', ['show', `${base}:${file}`], { cwd: REPO, encoding: 'utf8' });
    return shown.status === 0 ? shown.stdout : null;
  };
  let files = args;
  if (files.length === 0 && !process.stdin.isTTY) files = readFileSync(0, 'utf8').split('\n');
  let result;
  try {
    result = planWorldGate(files, { readBase });
  } catch (error) {
    result = { decision: 'RUN', scope: 'FULL', reasons: [{ file: null, class: 'ANALYSIS_FAILED', reason: `${error.message}: run` }] };
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
