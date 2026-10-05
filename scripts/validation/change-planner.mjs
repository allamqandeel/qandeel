/**
 * VAL-01 — the change planner. ONE deterministic, tested law that decides, for each heavy validation
 * gate, whether a pull-request update must run it or may carry forward the predecessor's proven result.
 *
 * ## Why it exists
 *
 * GitHub's `pull_request.paths` matches the PR's CUMULATIVE diff. Once a PR has touched `apps/api`, every
 * later push to it — a typo in an implementation record, one Maestro flow — replays the full API suite
 * against real PostgreSQL and Redis, and Mobile CI replays its contract gate and both device boot
 * smokes. A3-02 measured it: a record-only head (`682cead`) re-ran ~17 + ~13 minutes of gates that no
 * file in that head could affect.
 *
 * The cumulative diff still decides whether a workflow is relevant to the PR at all (the trigger does
 * that). This module adds the LATEST-UPDATE DELTA: what changed since the immediately previous PR head.
 *
 * ## The one-way rule
 *
 * A gate is skipped ONLY when skipping is positively proven safe. Every unknown — an unclassified path,
 * an unestablished delta, a missing or red predecessor, a changed workflow, a moved base — answers RUN.
 * A wrong RUN costs minutes; a wrong CARRY_FORWARD reports green for code no gate looked at.
 *
 * ## Documentation and flows are not automatically irrelevant
 *
 * Measured, not assumed: most root contracts read documentation (implementation records, banners, the
 * backlog), the mobile generators read `docs/design/canonical-artifacts/**`, and the database static
 * tests read canonical records. So a "docs-only" path is LIGHT only when every file that references it
 * is a root contract (`tests/*.test.mjs`): those contracts — and any contract that executes them — re-run
 * at the current head, and the heavy remainder carries forward. Any other referencing file (a generator,
 * a database test, a helper, source code) fails safe to the heavy gate. The same analysis applies to a
 * Maestro flow or a proof runner, whose expected consumers (workflows, leg runners, other flows) are
 * handled by leg selection instead (`proof-legs.mjs`).
 *
 * VALIDATION TOOLING. Pure functions only; the I/O lives in `plan-validation.mjs`.
 */

import { createHash } from 'node:crypto';

/** The six change domains (Task Contract §7). */
export const DOMAINS = Object.freeze({
  API_HEAVY: 'API_HEAVY',
  MOBILE_CONTRACT: 'MOBILE_CONTRACT',
  MOBILE_NATIVE_BINARY: 'MOBILE_NATIVE_BINARY',
  DEVICE_PROOF_FLOW: 'DEVICE_PROOF_FLOW',
  CI_PROVENANCE_INFRA: 'CI_PROVENANCE_INFRA',
  DOCS_ONLY: 'DOCS_ONLY',
});

/** The heavy gates a carry-forward can be decided for. */
export const GATES = Object.freeze([DOMAINS.API_HEAVY, DOMAINS.MOBILE_CONTRACT, DOMAINS.MOBILE_NATIVE_BINARY]);

const ALL_DOMAINS = Object.freeze([
  DOMAINS.API_HEAVY, DOMAINS.MOBILE_CONTRACT, DOMAINS.MOBILE_NATIVE_BINARY, DOMAINS.DEVICE_PROOF_FLOW, DOMAINS.CI_PROVENANCE_INFRA,
]);

/**
 * Validation AUTHORITY: the files that decide what a gate means. A change to any of them fails safe to
 * broad validation, because no static rule can prove a workflow or provenance edit harmless — the same
 * reason the native fingerprint keeps `.github/workflows/` as a build input.
 */
export const INFRA_PREFIXES = Object.freeze(['.github/', 'scripts/validation/']);
export const INFRA_FILES = Object.freeze([
  'scripts/classify-mobile-native-impact.mjs',
  'scripts/phase-m/native-build-fingerprint.mjs',
  'scripts/phase-m/native-artifact-manifest.mjs',
  'scripts/phase-m/verify-native-artifact-manifest.mjs',
]);

/** Runner-only proof orchestration (excluded from the native fingerprint; never bundled). */
export const PROOF_RUNNER_PREFIXES = Object.freeze(['scripts/a3/', 'scripts/phase-m/']);
export const FLOW_PREFIX = 'apps/mobile/.maestro/';

/** Files and trees every workspace builds from. */
export const SHARED_ROOT_FILES = Object.freeze(['package.json', 'package-lock.json', 'tsconfig.base.json']);
export const SHARED_ROOT_PREFIXES = Object.freeze(['packages/']);

/** Which domains each path kind is relevant to. UNKNOWN is everything: an unclassified path never skips. */
export const KIND_DOMAINS = Object.freeze({
  INFRA: ALL_DOMAINS,
  DOC: Object.freeze([DOMAINS.DOCS_ONLY]),
  FLOW: Object.freeze([DOMAINS.DEVICE_PROOF_FLOW]),
  PROOF_RUNNER: Object.freeze([DOMAINS.DEVICE_PROOF_FLOW]),
  API: Object.freeze([DOMAINS.API_HEAVY]),
  CONTRACT: Object.freeze([DOMAINS.API_HEAVY, DOMAINS.MOBILE_CONTRACT]),
  SHARED_ROOT: Object.freeze([DOMAINS.API_HEAVY, DOMAINS.MOBILE_CONTRACT, DOMAINS.MOBILE_NATIVE_BINARY]),
  MOBILE: Object.freeze([DOMAINS.MOBILE_CONTRACT, DOMAINS.MOBILE_NATIVE_BINARY]),
  UNKNOWN: ALL_DOMAINS,
});

/** Kinds whose relevance to a heavy gate is decided by reference analysis rather than by the kind alone. */
export const LIGHT_KINDS = Object.freeze(['DOC', 'FLOW', 'PROOF_RUNNER']);

export function normalizePath(entry) {
  return String(entry ?? '').trim().replace(/\\/gu, '/').replace(/^\.\//u, '');
}

/** Classifies ONE path. Order matters: authority first, so `.github/x.md` is infrastructure, not prose. */
export function classifyPath(entry) {
  const path = normalizePath(entry);
  if (path.length === 0) return { path, kind: 'UNKNOWN', reason: 'EMPTY_PATH' };
  if (INFRA_FILES.includes(path) || INFRA_PREFIXES.some((p) => path.startsWith(p))) return { path, kind: 'INFRA', reason: 'VALIDATION_AUTHORITY' };
  if (path.startsWith('docs/') || path.endsWith('.md')) return { path, kind: 'DOC', reason: 'PROSE' };
  if (path.startsWith(FLOW_PREFIX)) return { path, kind: 'FLOW', reason: 'MAESTRO_FLOW' };
  if (PROOF_RUNNER_PREFIXES.some((p) => path.startsWith(p))) return { path, kind: 'PROOF_RUNNER', reason: 'RUNNER_ONLY_ORCHESTRATION' };
  if (path.startsWith('apps/api/') || path.startsWith('database/')) return { path, kind: 'API', reason: 'API_OR_DATABASE' };
  if (path.startsWith('tests/')) return { path, kind: 'CONTRACT', reason: 'ROOT_CONTRACT' };
  if (SHARED_ROOT_FILES.includes(path) || SHARED_ROOT_PREFIXES.some((p) => path.startsWith(p))) return { path, kind: 'SHARED_ROOT', reason: 'SHARED_ROOT_INPUT' };
  if (path.startsWith('apps/mobile/')) return { path, kind: 'MOBILE', reason: 'MOBILE_WORKSPACE' };
  return { path, kind: 'UNKNOWN', reason: 'UNCLASSIFIED_PATH_FAILS_SAFE' };
}

export function domainsOf(entry) {
  return KIND_DOMAINS[classifyPath(entry).kind];
}

// -------------------------------------------------------------------------------------------------
// Reference analysis for LIGHT paths
// -------------------------------------------------------------------------------------------------

export const isRootContract = (path) => /^tests\/[^/]+\.test\.mjs$/u.test(path);

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/**
 * Workspace roots. Naming one of these as a whole directory is how a file declares a workspace (`"apps/mobile":`
 * in the lockfile, `"scripts":` in a manifest) far more often than how it reads one, so they are never
 * ancestor tokens. A recursive read under them still binds through the extension filter.
 */
export const WORKSPACE_ROOTS = Object.freeze(['apps', 'apps/mobile', 'apps/api', 'scripts', 'packages', 'database']);

/**
 * Content roots a ROOT CONTRACT may enumerate whole (`readdirSync(join(root, 'docs'))`, the forward-safety
 * sweep over `tests`). Contracts are the light set, so over-including one is cheap. A NON-contract file that
 * names a whole content root is instead pinned by the VAL-01 contract to a reviewed list — the place a
 * future whole-tree reader has to be classified before it can exist.
 */
export const CONTENT_ROOTS = Object.freeze(['docs', 'tests']);

/**
 * The tokens by which a file can reach `path`: the path itself, its basename, every ancestor directory
 * named as a WHOLE directory reference (a walk of `docs/e2e` names `'docs/e2e'`, not `'docs/e2e/OTHER.md'`),
 * and the extension used as a FILTER (`'.md'`, `\.md`, `\.ya?ml`) — the form a recursive enumeration takes.
 */
export function bindingPatterns(entry, { contentRoots = false } = {}) {
  const path = normalizePath(entry);
  const segments = path.split('/');
  const basename = segments.at(-1);
  const patterns = [new RegExp(escapeRegExp(path), 'u'), new RegExp(escapeRegExp(basename), 'u')];
  for (let i = segments.length - 1; i >= 1; i -= 1) {
    const dir = segments.slice(0, i).join('/');
    if (WORKSPACE_ROOTS.includes(dir)) continue;
    if (CONTENT_ROOTS.includes(dir) && !contentRoots) continue;
    patterns.push(new RegExp(`(?:^|['"\`/(\\s])${escapeRegExp(dir)}/?['"\`]`, 'u'));
  }
  const dot = basename.lastIndexOf('.');
  if (dot > 0) {
    const raw = basename.slice(dot);
    const ext = /^\.ya?ml$/u.test(raw) ? '\\.ya\\??ml' : escapeRegExp(raw);
    patterns.push(new RegExp(`['"\`]${ext}['"\`]|\\\\${ext}(?![A-Za-z0-9_])`, 'u'));
  }
  return patterns;
}

/**
 * Removes FULL-LINE comments only. A trailing comment is kept — it can only add a reference, and over-
 * inclusion is the safe direction. Stripping inline `//` would also strip `https://…` inside a string
 * and could hide a real reference.
 */
export function stripFullLineComments(path, source) {
  const text = String(source ?? '');
  if (/\.(?:[cm]?js|jsx|ts|tsx)$/u.test(path)) return text.replace(/^\s*(?:\/\/|\/\*|\*)[^\n]*$/gmu, '');
  if (/\.(?:sh|ya?ml|toml|py)$/u.test(path) || /(?:^|\/)[^./]+$/u.test(path)) return text.replace(/^\s*#[^\n]*$/gmu, '');
  if (/\.sql$/u.test(path)) return text.replace(/^\s*--[^\n]*$/gmu, '');
  return text;
}

/** True when `source` (of `binderPath`) references `targetPath` by any binding token. */
export function references(binderPath, source, targetPath) {
  const contract = isRootContract(binderPath);
  const code = contract ? String(source ?? '') : stripFullLineComments(binderPath, source);
  return bindingPatterns(targetPath, { contentRoots: contract }).some((pattern) => pattern.test(code));
}

/**
 * Expected consumers of a flow or a proof runner: workflows, leg runners (`scripts/<proof>/run-*.sh`),
 * other flows, and the validation tooling that classifies flow paths without executing them. They are
 * DEVICE_PROOF_FLOW business (leg selection), not a reason to replay API or Mobile contract gates.
 */
export const isFlowConsumer = (path) => path.startsWith('.github/workflows/') || path.startsWith(FLOW_PREFIX)
  || PROOF_RUNNER_PREFIXES.some((p) => path.startsWith(p)) || /^scripts\/[^/]+\/run-[^/]+\.sh$/u.test(path);

/**
 * The validation tooling CLASSIFIES paths (`.md` is prose, `.maestro/` is runner-only) and never reads the
 * content of a doc or a flow, so naming one is not a dependency on it. A change to the tooling itself is
 * validation authority, which is broad on its own.
 */
export const isValidationTooling = (path) => INFRA_FILES.includes(path) || path.startsWith('scripts/validation/');

/**
 * Analyzes the LIGHT paths of a delta against every tracked, non-prose source file.
 *
 * Returns the root contracts that must re-run at the current head (`contracts`, closed under "a contract
 * that executes or enumerates a bound contract is bound too"), and every NON-contract file that
 * references a light path (`heavyBinders`) — each of which makes the heavy gates relevant.
 */
export function analyzeLightPaths({ lightPaths, sources }) {
  const files = [...sources.keys()].map(normalizePath).filter((p) => classifyPath(p).kind !== 'DOC');
  const bound = new Set();
  const heavyBinders = [];
  const consumers = [];

  for (const light of lightPaths.map(normalizePath)) {
    const lightKind = classifyPath(light).kind;
    for (const file of files) {
      if (file === light || isValidationTooling(file)) continue;
      if (!references(file, sources.get(file), light)) continue;
      if (isRootContract(file)) bound.add(file);
      else if (lightKind !== 'DOC' && isFlowConsumer(file)) consumers.push({ path: light, consumer: file });
      else heavyBinders.push({ path: light, binder: file });
    }
  }

  // Closure: a contract that names a bound contract — or the `tests` directory it enumerates — executes or
  // reads it (the forward-safety sweep re-runs every contract in a mirror), so its verdict moved too.
  const contracts = files.filter(isRootContract);
  let grew = true;
  while (grew) {
    grew = false;
    for (const contract of contracts) {
      if (bound.has(contract)) continue;
      if ([...bound].some((target) => references(contract, sources.get(contract), target))) {
        bound.add(contract);
        grew = true;
      }
    }
  }

  return { contracts: [...bound].sort(), heavyBinders, consumers };
}

// -------------------------------------------------------------------------------------------------
// Which root contracts a workflow runs
// -------------------------------------------------------------------------------------------------

/**
 * The root contracts a workflow executes: every `npm run <script>` it names, expanded recursively through
 * `package.json`, reduced to the `tests/<name>.test.mjs` files those commands reach.
 */
export function workflowContracts(workflowText, packageScripts) {
  const seen = new Set();
  const found = new Set();
  const visit = (command) => {
    for (const match of String(command).matchAll(/tests\/[A-Za-z0-9_.-]+\.test\.mjs/gu)) found.add(match[0]);
    for (const match of String(command).matchAll(/npm run (?:--silent )?([A-Za-z0-9_:.-]+)/gu)) {
      const name = match[1];
      if (seen.has(name)) continue;
      seen.add(name);
      if (Object.hasOwn(packageScripts, name)) visit(packageScripts[name]);
    }
  };
  visit(stripFullLineComments('workflow.yml', workflowText));
  return [...found].sort();
}

// -------------------------------------------------------------------------------------------------
// Evidence and the carry-forward law
// -------------------------------------------------------------------------------------------------

export const EVIDENCE_SCHEMA = 'qandeel.validation-evidence/1';
export const AUTHORITY_DOMAIN = 'qandeel.validation-authority/1';
export const EVIDENCE_JOB_NAME = 'Validation evidence (VAL-01)';
export const evidenceArtifactName = (workflowKey, gate) => `val01-evidence-${workflowKey}-${gate}`;

/** The authority governing every gate of `workflowFile`: that workflow plus the validation tooling. */
export function authorityPaths(workflowFile) {
  return [workflowFile, ...INFRA_FILES, 'scripts/validation/'];
}

/**
 * Digest of the validation authority at a commit, over committed blob ids (CRLF-neutral, the same
 * reasoning as the native fingerprint). It is not an artifact identity: it only answers "did the rules
 * that define this gate change between the evidence and now".
 */
export function authorityDigest(treeEntries, workflowFile) {
  const governed = authorityPaths(workflowFile);
  const lines = treeEntries
    .map((entry) => ({ path: normalizePath(entry.path), oid: String(entry.oid) }))
    .filter((entry) => governed.some((g) => (g.endsWith('/') ? entry.path.startsWith(g) : entry.path === g)))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map((entry) => `${entry.oid} ${entry.path}`);
  return createHash('sha256').update(`${AUTHORITY_DOMAIN}\n${lines.join('\n')}\n`, 'utf8').digest('hex');
}

const SHA = /^[0-9a-f]{40}$/u;

/**
 * The run that speaks for the predecessor head: its LATEST run of this workflow (highest run number) for that
 * exact head SHA. An older green run never outvotes a newer red, cancelled or still-running one.
 */
export function selectPredecessorRun(runs, predecessorSha) {
  const candidates = (Array.isArray(runs) ? runs : []).filter((run) => run?.head_sha === predecessorSha);
  candidates.sort((a, b) => Number(b.run_number) - Number(a.run_number));
  return candidates[0] ?? null;
}

/**
 * Verifies a predecessor's evidence record. Pure; every gap is a refusal. `expected` carries what the
 * CURRENT run knows independently of the record: the predecessor head it is the successor of, the base
 * it merges onto, the authority it validates under, and — read from the GitHub API, not from the record —
 * the run id, that run's latest attempt and the latest-attempt conclusion of its evidence job.
 */
export function validateEvidence(record, expected) {
  const refusals = [];
  const refuse = (code, detail) => refusals.push(`${code}: ${detail}`);
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    refuse('EVIDENCE_MISSING', 'no evidence record for the predecessor head');
    return { ok: false, refusals };
  }
  if (record.schema !== EVIDENCE_SCHEMA) refuse('EVIDENCE_SCHEMA_MISMATCH', String(record.schema));
  if (record.workflow !== expected.workflow) refuse('EVIDENCE_WORKFLOW_MISMATCH', `${record.workflow} ≠ ${expected.workflow}`);
  if (record.gate !== expected.gate) refuse('EVIDENCE_GATE_MISMATCH', `${record.gate} ≠ ${expected.gate}`);
  if (record.outcome !== 'SUCCESS') refuse('PREDECESSOR_NOT_GREEN', `outcome ${JSON.stringify(record.outcome)}`);
  if (!['EXECUTED', 'CARRIED_FORWARD'].includes(record.disposition)) refuse('EVIDENCE_DISPOSITION_INVALID', String(record.disposition));
  if (!SHA.test(String(expected.predecessorSha)) || record.headSha !== expected.predecessorSha) {
    refuse('NOT_THE_EXACT_PREDECESSOR', `evidence head ${record.headSha}, predecessor ${expected.predecessorSha}`);
  }
  if (!SHA.test(String(expected.baseSha)) || record.baseSha !== expected.baseSha) {
    refuse('BASE_MOVED', `evidence merged onto ${record.baseSha}, this head onto ${expected.baseSha}`);
  }
  if (record.authorityDigest !== expected.authorityDigest) refuse('AUTHORITY_CHANGED', 'the rules governing this gate differ from the evidence');
  if (String(record.runId) !== String(expected.runId)) refuse('EVIDENCE_RUN_MISMATCH', `${record.runId} ≠ ${expected.runId}`);
  if (Number(record.runAttempt) !== Number(expected.latestAttempt)) {
    refuse('EVIDENCE_NOT_FROM_LATEST_ATTEMPT', `recorded in attempt ${record.runAttempt}, the run is at attempt ${expected.latestAttempt}`);
  }
  if (expected.evidenceJobConclusion !== 'success') {
    refuse('EVIDENCE_JOB_NOT_GREEN', `the predecessor's evidence job concluded ${JSON.stringify(expected.evidenceJobConclusion)}`);
  }
  if (!SHA.test(String(record.sourceHeadSha)) || !/^\d+$/u.test(String(record.sourceRunId))) {
    refuse('EVIDENCE_SOURCE_MISSING', 'the evidence does not name the run that executed the gate');
  }
  return { ok: refusals.length === 0, refusals };
}

/**
 * Plans one gate for one PR update (Task Contract §6.2). Returns `{ decision, reason, contracts }` where
 * `contracts` are the root contracts a CARRY_FORWARD must still run at this head (possibly none).
 *
 * `context`: `{ event, action, predecessorSha }`. `delta`: the latest-update paths, or null when it could
 * not be established. `analysis`: `analyzeLightPaths` over the delta's light paths. `suite`: the root
 * contracts this gate's workflow runs. `nativeConsumerFlows`: for MOBILE_NATIVE_BINARY only, the flows (and
 * their runFlow closure) this gate's device consumers execute. `evidence`: `validateEvidence` output.
 */
export function planGate({ gate, context, delta, analysis, suite = [], nativeConsumerFlows = [], evidence }) {
  const run = (reason, extra = {}) => ({ decision: 'RUN', reason, contracts: [], ...extra });
  if (!GATES.includes(gate)) return run(`UNKNOWN_GATE:${gate}`);
  if (context?.event !== 'pull_request') return run('NOT_A_PULL_REQUEST_UPDATE — main, push and dispatch stay conservative');
  if (context.action !== 'synchronize') return run(`FIRST_HEAD_OF_PULL_REQUEST (${context.action ?? 'unknown action'})`);
  if (!SHA.test(String(context.predecessorSha ?? ''))) return run('PREDECESSOR_UNESTABLISHED');
  if (!Array.isArray(delta) || delta.map(normalizePath).filter(Boolean).length === 0) return run('DELTA_UNESTABLISHED_OR_EMPTY');

  const paths = delta.map(normalizePath).filter(Boolean);
  const relevant = paths.filter((p) => domainsOf(p).includes(gate));
  if (relevant.length > 0) return run('DELTA_TOUCHES_GATE', { relevant });

  if (gate === DOMAINS.MOBILE_NATIVE_BINARY) {
    const flows = paths.filter((p) => nativeConsumerFlows.includes(p));
    if (flows.length > 0) return run('DELTA_CHANGES_A_FLOW_THE_NATIVE_CONSUMERS_RUN', { relevant: flows });
  } else if ((analysis?.heavyBinders ?? []).length > 0) {
    return run('A_NON_CONTRACT_FILE_READS_A_CHANGED_PATH', { relevant: analysis.heavyBinders.map((b) => `${b.path} ← ${b.binder}`) });
  }

  if (evidence?.ok !== true) return run('PREDECESSOR_NOT_PROVEN_GREEN', { refusals: evidence?.refusals ?? ['EVIDENCE_NOT_EVALUATED'] });

  const contracts = gate === DOMAINS.MOBILE_NATIVE_BINARY ? [] : (analysis?.contracts ?? []).filter((c) => suite.includes(c));
  return { decision: 'CARRY_FORWARD', reason: 'LATEST_DELTA_IRRELEVANT_AND_PREDECESSOR_PROVEN_GREEN', contracts };
}
