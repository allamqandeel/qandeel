/**
 * VAL-01 — impact → leg selection for isolated device-proof workflows (Task Contract §8, §11).
 *
 * A proof workflow runs one GitHub job per LEG. Before VAL-01 every run executed every leg, so a fix to
 * one iOS Maestro flow (A3-02 head `a7b0386`) re-ran all thirteen Android legs. This module answers, from
 * a changed-file set, which legs can actually be affected — and nothing else.
 *
 * ## No second leg→flow table
 *
 * The mapping is DERIVED from the leg runner itself: the runner's `case "$LEG" in … esac` dispatch names
 * the flows each leg runs, and flows it runs outside that dispatch (the cold-start readiness walk) are
 * shared by every leg on that platform. Each flow's `runFlow` / `runScript` references are followed, so a
 * change to a sub-flow selects every leg whose flow reaches it. A hand-written table would drift from the
 * runner; a derived one cannot.
 *
 * ## The fail-safe direction
 *
 *   - an unestablished or empty delta                       → every leg
 *   - a native build input, validation authority, unknown   → every leg (the binary or its rules moved)
 *   - a platform's runner script                            → every leg of that platform
 *   - a flow reached by a platform's shared (readiness) walk → every leg of that platform
 *   - a flow reached by a leg's own dispatch                → that leg
 *   - an unreferenced non-flow file under the flow tree     → every leg (its role cannot be proven)
 *   - prose, API, database, root contracts                  → no leg (none is a proof input)
 *
 * ## Physical hardware
 *
 * Every leg a runner can execute runs on an emulator or simulator, so it is `SIMULATOR_PROVABLE` by
 * construction. A fact that only physical hardware can establish is declared `PHYSICAL_DEVICE_REQUIRED`
 * in the suite, can never be a runner leg, and is never placed in a simulator matrix.
 *
 * VALIDATION TOOLING. Pure functions; `plan-validation.mjs` supplies the file contents.
 */

import { classifyPath, normalizePath } from './change-planner.mjs';
import { classifyBuildInput } from '../phase-m/native-build-fingerprint.mjs';

export const DISPOSITIONS = Object.freeze({
  SIMULATOR_PROVABLE: 'SIMULATOR_PROVABLE',
  PHYSICAL_DEVICE_REQUIRED: 'PHYSICAL_DEVICE_REQUIRED',
});

const FLOW_DIR = 'apps/mobile/.maestro/';
const FLOW_TOKEN = /[A-Za-z0-9_.-]+\.(?:ya?ml|js)\b/gu;

const stripShellComments = (text) => String(text).replace(/^\s*#[^\n]*$/gmu, '').replace(/\s#\s[^\n]*$/gmu, '');

/**
 * Parses a leg runner. Returns `{ legs, legFlows: { leg: [flow…] }, sharedFlows }`. Legs are the labels of
 * the runner's case blocks over `$LEG` (minus the `*` refusal); a leg's flows are the flow files named in
 * its dispatch branch; every flow named OUTSIDE a `$LEG` case block is shared by all legs.
 */
export function parseLegRunner(text) {
  const lines = stripShellComments(text).split('\n');
  const legs = new Set();
  const legFlows = {};
  const shared = new Set();
  let inCase = false;
  let labels = null;

  const add = (target, line) => {
    for (const match of line.matchAll(FLOW_TOKEN)) target.add(match[0]);
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*case "\$LEG" in\s*$/u.test(line)) { inCase = true; labels = null; continue; }
    if (inCase && /^\s*esac\s*$/u.test(line)) { inCase = false; labels = null; continue; }
    if (!inCase) { add(shared, line); continue; }
    const branch = /^\s*([A-Za-z0-9|*-]+)\)\s?(.*)$/u.exec(line);
    let body = line;
    if (branch !== null && labels === null) {
      labels = branch[1].split('|').filter((label) => label !== '*');
      for (const label of labels) {
        legs.add(label);
        legFlows[label] ??= [];
      }
      body = branch[2];
    }
    if (labels !== null) {
      const flows = new Set();
      add(flows, body);
      for (const label of labels) legFlows[label] = [...new Set([...legFlows[label], ...flows])];
      if (/;;\s*$/u.test(body)) labels = null;
    }
  }
  return { legs: [...legs], legFlows, sharedFlows: [...shared] };
}

/** Flow files a flow references (`runFlow`, `runScript`, …), by name within the flow directory. */
export function flowReferences(text) {
  const refs = new Set();
  for (const match of stripShellComments(text).matchAll(FLOW_TOKEN)) refs.add(match[0]);
  return [...refs];
}

/** Transitive closure of flow names reachable from `roots`, using `readFlow(name) → text | null`. */
export function flowClosure(roots, readFlow) {
  const seen = new Set();
  const stack = [...roots];
  while (stack.length > 0) {
    const name = stack.pop();
    if (seen.has(name)) continue;
    seen.add(name);
    const text = readFlow(name);
    if (text !== null && text !== undefined) for (const ref of flowReferences(text)) if (!seen.has(ref)) stack.push(ref);
  }
  return seen;
}

/**
 * Builds the platform's leg graph: `{ runner, legs: [{ id, disposition, flows: Set }], shared: Set }`.
 * `readFile(path) → text | null`.
 */
export function buildPlatformGraph({ runner, readFile }) {
  const parsed = parseLegRunner(readFile(runner) ?? '');
  const readFlow = (name) => readFile(`${FLOW_DIR}${name}`);
  const shared = flowClosure(parsed.sharedFlows, readFlow);
  const legs = parsed.legs.map((id) => ({
    id,
    disposition: DISPOSITIONS.SIMULATOR_PROVABLE,
    flows: flowClosure(parsed.legFlows[id] ?? [], readFlow),
  }));
  return { runner, legs, shared };
}

/**
 * Selects legs for one platform. `delta` is the changed-path list or null (unestablished).
 * Returns `{ legs: [id…], reason }`.
 */
export function selectPlatformLegs({ graph, delta }) {
  const all = graph.legs.map((leg) => leg.id);
  if (!Array.isArray(delta) || delta.map(normalizePath).filter(Boolean).length === 0) {
    return { legs: all, reason: 'DELTA_UNESTABLISHED_OR_EMPTY — every leg' };
  }
  const selected = new Set();
  const reasons = [];
  for (const path of delta.map(normalizePath).filter(Boolean)) {
    const { kind } = classifyPath(path);
    if (path === graph.runner) return { legs: all, reason: `RUNNER_CHANGED (${path}) — every leg` };
    if (kind === 'INFRA' || kind === 'UNKNOWN') return { legs: all, reason: `${kind} (${path}) — every leg` };
    if (kind === 'FLOW') {
      const name = path.slice(FLOW_DIR.length);
      if (name.includes('/')) return { legs: all, reason: `NESTED_FLOW_PATH (${path}) — every leg` };
      if (graph.shared.has(name)) return { legs: all, reason: `SHARED_FLOW_CHANGED (${name}) — every leg` };
      const hit = graph.legs.filter((leg) => leg.flows.has(name)).map((leg) => leg.id);
      if (hit.length === 0 && !/\.ya?ml$/u.test(name)) return { legs: all, reason: `UNREFERENCED_NON_FLOW_FILE (${name}) — every leg` };
      for (const id of hit) selected.add(id);
      reasons.push(`${name} → ${hit.length > 0 ? hit.join(', ') : 'no leg on this platform'}`);
      continue;
    }
    // A native build input changes the binary every leg installs.
    if (classifyBuildInput(path).included && (kind === 'MOBILE' || kind === 'SHARED_ROOT')) {
      return { legs: all, reason: `NATIVE_BUILD_INPUT_CHANGED (${path}) — every leg` };
    }
    // DOC, API, CONTRACT and other runners' files are not inputs of this proof.
  }
  return { legs: graph.legs.map((leg) => leg.id).filter((id) => selected.has(id)), reason: reasons.join('; ') || 'NO_PROOF_INPUT_CHANGED' };
}

/** Refuses to place a leg in a simulator matrix unless it is SIMULATOR_PROVABLE (Task Contract §11). */
export function assertSimulatorMatrix(graph, legIds, physicalFacts = []) {
  const physical = new Set(physicalFacts.map((fact) => fact.id));
  for (const id of legIds) {
    const leg = graph.legs.find((candidate) => candidate.id === id);
    if (leg === undefined) throw new Error(`leg ${id} is not a leg of ${graph.runner}`);
    if (physical.has(id)) throw new Error(`${id} is PHYSICAL_DEVICE_REQUIRED and can never run in a simulator matrix`);
    if (leg.disposition !== DISPOSITIONS.SIMULATOR_PROVABLE) throw new Error(`${id} is ${leg.disposition}, not SIMULATOR_PROVABLE`);
  }
  return true;
}
