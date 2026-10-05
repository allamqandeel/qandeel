#!/usr/bin/env node
/**
 * VAL-01 — the planner's I/O shell. Everything that decides lives in `change-planner.mjs` and
 * `proof-legs.mjs` and is unit-tested there; this file only gathers facts (git, the event payload, the
 * GitHub API through the runner's preinstalled `gh`) and writes job outputs and the step summary.
 *
 * ## Fail safe, including against itself
 *
 * Any exception while PLANNING answers RUN for every gate. The workflows skip a heavy gate only on the
 * literal output `CARRY_FORWARD` (or, for native smoke, `NOT_RELEVANT`), so a planner that crashed, printed
 * nothing, or was skipped can only ever cause a gate to run.
 *
 * Subcommands:
 *
 *   plan   --workflow api-ci|mobile-ci
 *          GITHUB_OUTPUT: <gate>=RUN|CARRY_FORWARD|NOT_RELEVANT, <gate>_contracts, <gate>_source_run_id,
 *          <gate>_source_head_sha, for each gate of that workflow.
 *
 *   legs   --suite a3 [--since <sha>]
 *          GITHUB_OUTPUT: <platform>_legs (a JSON array, possibly empty) for each platform of the suite.
 *
 *   record --workflow W --gate G --decision D --gate-result R --bound-result B --contracts "<list>"
 *          [--source-run-id N --source-head-sha S] --out <dir>
 *          Writes <dir>/evidence.json when, and only when, the gate is green in THIS run; exits 1 when a
 *          gate that was due is not green.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

import {
  DOMAINS,
  EVIDENCE_JOB_NAME,
  EVIDENCE_SCHEMA,
  LIGHT_KINDS,
  analyzeLightPaths,
  authorityDigest,
  classifyPath,
  evidenceArtifactName,
  planGate,
  selectPredecessorRun,
  validateEvidence,
  workflowContracts,
} from './change-planner.mjs';
import { assertSimulatorMatrix, buildPlatformGraph, flowClosure, selectPlatformLegs } from './proof-legs.mjs';
import { PROOF_SUITES } from './proof-suites.mjs';
import { readTreeEntries } from '../phase-m/native-build-fingerprint.mjs';
import { classifyChangedFiles } from '../classify-mobile-native-impact.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

export const WORKFLOWS = Object.freeze({
  'api-ci': Object.freeze({ file: '.github/workflows/api-ci.yml', gates: Object.freeze([DOMAINS.API_HEAVY]) }),
  'mobile-ci': Object.freeze({
    file: '.github/workflows/mobile-ci.yml',
    gates: Object.freeze([DOMAINS.MOBILE_CONTRACT, DOMAINS.MOBILE_NATIVE_BINARY]),
  }),
});

const SHA = /^[0-9a-f]{40}$/u;
const ZERO = '0000000000000000000000000000000000000000';
const TEXT_EXTENSIONS = /\.(?:[cm]?js|jsx|ts|tsx|json|ya?ml|sh|sql|toml|txt|html|css|xml|gradle|properties|plist|swift|kt|java|rb)$/u;

const git = (args) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return result.status === 0 ? result.stdout : null;
};
const readRepoFile = (path) => {
  try {
    return readFileSync(join(root, path), 'utf8');
  } catch {
    return null;
  }
};

/** Makes sure a commit object is local; a force-pushed predecessor may need one fetch. */
function haveCommit(sha) {
  if (!SHA.test(String(sha)) || sha === ZERO) return false;
  if (git(['cat-file', '-e', `${sha}^{commit}`]) !== null) return true;
  git(['fetch', '--no-tags', '--quiet', 'origin', sha]);
  return git(['cat-file', '-e', `${sha}^{commit}`]) !== null;
}

/** `git diff --name-only --no-renames from to`, or null when it cannot be established. */
export function changedPaths(from, to) {
  if (!haveCommit(from) || !haveCommit(to)) return null;
  // --no-renames: a rename is a deletion AND an addition, and both paths must be classified.
  const out = git(['diff', '--name-only', '--no-renames', from, to]);
  return out === null ? null : out.split('\n').map((line) => line.trim()).filter(Boolean);
}

/** Every tracked text file, for reference analysis. Binary and very large files are not sources. */
function trackedSources() {
  const sources = new Map();
  for (const path of (git(['ls-files', '-z']) ?? '').split('\0').filter(Boolean)) {
    if (!TEXT_EXTENSIONS.test(path) && !/(?:^|\/)[^./]+$/u.test(path)) continue;
    const text = readRepoFile(path);
    if (text === null || text.length > 4 * 1024 * 1024 || text.includes('\0')) continue;
    sources.set(path, text);
  }
  return sources;
}

function readEvent() {
  try {
    return JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH ?? '', 'utf8'));
  } catch {
    return {};
  }
}

function writeOutputs(outputs) {
  const lines = Object.entries(outputs).map(([key, value]) => `${key}=${String(value).replace(/\n/gu, ' ')}`);
  process.stdout.write(`${lines.join('\n')}\n`);
  if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`, { flag: 'a' });
}

function summary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`, { flag: 'a' });
  process.stderr.write(`${markdown}\n`);
}

const gh = (args) => {
  const result = spawnSync('gh', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return result.status === 0 ? result.stdout : null;
};
const ghJson = (path) => {
  const out = gh(['api', path]);
  if (out === null) return null;
  try {
    return JSON.parse(out);
  } catch {
    return null;
  }
};

/**
 * Reads the predecessor head's evidence for one gate from GitHub, and validates it against what this run
 * knows independently. Every gap is a refusal, so a lookup that cannot complete answers "not proven".
 */
export function lookupPredecessorEvidence({ repository, workflowKey, gate, predecessorSha, baseSha, digest }) {
  const workflow = WORKFLOWS[workflowKey];
  const base = { workflow: workflowKey, gate, predecessorSha, baseSha, authorityDigest: digest };
  const runs = ghJson(`repos/${repository}/actions/workflows/${workflow.file.split('/').at(-1)}/runs?head_sha=${predecessorSha}&event=pull_request&per_page=30`);
  const run = selectPredecessorRun(runs?.workflow_runs, predecessorSha);
  if (run === null) return { verdict: validateEvidence(null, base), run: null };
  if (run.status !== 'completed') {
    return { verdict: { ok: false, refusals: [`PREDECESSOR_RUN_NOT_COMPLETE: run ${run.id} is ${run.status}`] }, run };
  }
  const jobs = ghJson(`repos/${repository}/actions/runs/${run.id}/jobs?filter=latest&per_page=100`);
  const evidenceJob = (jobs?.jobs ?? []).find((job) => job.name === EVIDENCE_JOB_NAME);
  const expected = { ...base, runId: run.id, latestAttempt: run.run_attempt, evidenceJobConclusion: evidenceJob?.conclusion ?? null };

  const dir = mkdtempSync(join(tmpdir(), 'val01-evidence-'));
  const name = evidenceArtifactName(workflowKey, gate);
  if (gh(['run', 'download', String(run.id), '--repo', repository, '--name', name, '--dir', dir]) === null || !existsSync(join(dir, 'evidence.json'))) {
    return { verdict: validateEvidence(null, expected), run };
  }
  let record = null;
  try {
    record = JSON.parse(readFileSync(join(dir, 'evidence.json'), 'utf8'));
  } catch {
    record = null;
  }
  return { verdict: validateEvidence(record, expected), run, record };
}

/** The flows (full paths) a workflow's device consumers execute, closed over runFlow references. */
export function workflowFlows(workflowText) {
  const names = [...String(workflowText).matchAll(/apps\/mobile\/\.maestro\/([A-Za-z0-9_.-]+\.ya?ml)/gu)].map((m) => m[1]);
  return [...flowClosure(names, (name) => readRepoFile(`apps/mobile/.maestro/${name}`))].map((name) => `apps/mobile/.maestro/${name}`);
}

function planWorkflow(workflowKey) {
  const workflow = WORKFLOWS[workflowKey];
  if (workflow === undefined) throw new Error(`unknown workflow ${workflowKey}`);
  const eventName = process.env.GITHUB_EVENT_NAME;
  const event = readEvent();
  const context = { event: eventName, action: event.action, predecessorSha: event.before };
  const headSha = event.pull_request?.head?.sha;
  const baseSha = event.pull_request?.base?.sha;

  const delta = eventName === 'pull_request' && event.action === 'synchronize' ? changedPaths(event.before, headSha) : null;
  const light = (delta ?? []).filter((path) => LIGHT_KINDS.includes(classifyPath(path).kind));
  const analysis = light.length > 0 ? analyzeLightPaths({ lightPaths: light, sources: trackedSources() }) : { contracts: [], heavyBinders: [], consumers: [] };
  const suite = workflowContracts(readRepoFile(workflow.file) ?? '', JSON.parse(readRepoFile('package.json') ?? '{}').scripts ?? {});
  const nativeConsumerFlows = workflowFlows(readRepoFile(workflow.file) ?? '');
  const digest = authorityDigest(readTreeEntries('HEAD', root), workflow.file);

  const outputs = {};
  const rows = [];
  for (const gate of workflow.gates) {
    const key = gate.toLowerCase();
    // Mobile native smoke keeps its cumulative relevance test (MOB-CI-01): a PR that never touched a native
    // input does not run it at all, on any head.
    if (gate === DOMAINS.MOBILE_NATIVE_BINARY) {
      const cumulative = eventName === 'pull_request'
        ? changedPaths(git(['merge-base', baseSha ?? '', headSha ?? ''])?.trim() ?? '', headSha ?? '')
        : changedPaths(event.before, process.env.GITHUB_SHA);
      const relevance = classifyChangedFiles(cumulative ?? []);
      if (!relevance.nativeImpact) {
        outputs[key] = 'NOT_RELEVANT';
        rows.push(`| ${gate} | NOT_RELEVANT | ${relevance.reason} |`);
        continue;
      }
    }
    let plan = planGate({ gate, context, delta, analysis, suite, nativeConsumerFlows, evidence: { ok: false, refusals: ['NOT_LOOKED_UP'] } });
    let looked = null;
    if (plan.reason === 'PREDECESSOR_NOT_PROVEN_GREEN') {
      looked = lookupPredecessorEvidence({
        repository: process.env.GITHUB_REPOSITORY, workflowKey, gate, predecessorSha: event.before, baseSha, digest,
      });
      plan = planGate({ gate, context, delta, analysis, suite, nativeConsumerFlows, evidence: looked.verdict });
    }
    outputs[key] = plan.decision;
    outputs[`${key}_contracts`] = plan.contracts.join(' ');
    outputs[`${key}_source_run_id`] = plan.decision === 'CARRY_FORWARD' ? looked.record.sourceRunId : '';
    outputs[`${key}_source_head_sha`] = plan.decision === 'CARRY_FORWARD' ? looked.record.sourceHeadSha : '';
    const why = [plan.reason, ...(plan.relevant ?? []).slice(0, 8), ...(plan.refusals ?? [])].join('<br>');
    rows.push(`| ${gate} | ${plan.decision} | ${why} |`);
    if (plan.decision === 'CARRY_FORWARD') {
      rows.push(`| ↳ prior successful run used | | run \`${looked.record.sourceRunId}\` at \`${looked.record.sourceHeadSha}\` (via predecessor run \`${looked.run.id}\`, ${looked.record.disposition}) |`);
      rows.push(`| ↳ contracts re-run at this head | | ${plan.contracts.length > 0 ? plan.contracts.map((c) => `\`${c}\``).join(' ') : 'none — no root contract reads the changed paths'} |`);
    }
  }

  summary([
    `### VAL-01 change-aware plan — \`${workflowKey}\``,
    '',
    `- event: \`${eventName}\` / \`${event.action ?? '—'}\``,
    `- predecessor head: \`${event.before ?? '—'}\` → current head: \`${headSha ?? process.env.GITHUB_SHA ?? '—'}\` (base \`${baseSha ?? '—'}\`)`,
    `- latest delta: ${delta === null ? '**not established — fail safe**' : delta.map((p) => `\`${p}\``).join(', ') || '(empty)'}`,
    '',
    '| gate | decision | why |',
    '|---|---|---|',
    ...rows,
  ].join('\n'));
  writeOutputs(outputs);
}

function planLegs(suiteKey, since) {
  const suite = PROOF_SUITES[suiteKey];
  if (suite === undefined) throw new Error(`unknown proof suite ${suiteKey}`);
  const event = readEvent();
  let delta = null;
  if (process.env.GITHUB_EVENT_NAME === 'push') delta = changedPaths(event.before, process.env.GITHUB_SHA);
  else if (since) delta = changedPaths(since, process.env.GITHUB_SHA ?? 'HEAD');
  const outputs = {};
  const rows = [];
  for (const [platform, config] of Object.entries(suite.platforms)) {
    const graph = buildPlatformGraph({ runner: config.runner, readFile: readRepoFile });
    const selection = selectPlatformLegs({ graph, delta });
    assertSimulatorMatrix(graph, selection.legs, suite.physicalDeviceFacts);
    outputs[`${platform}_legs`] = JSON.stringify(selection.legs);
    rows.push(`| ${platform} | ${selection.legs.length} of ${graph.legs.length} | ${selection.legs.join(', ') || '—'} | ${selection.reason} |`);
  }
  summary([
    `### VAL-01 leg selection — \`${suiteKey}\``,
    '',
    `- delta: ${delta === null ? '**not established — every leg**' : delta.map((p) => `\`${p}\``).join(', ') || '(empty)'}`,
    '',
    '| platform | selected | legs | why |',
    '|---|---|---|---|',
    ...rows,
    '',
    `Physical-device-only facts (never simulated here): ${suite.physicalDeviceFacts.map((f) => f.id).join(', ')}.`,
  ].join('\n'));
  writeOutputs(outputs);
}

/**
 * The outcome of one gate in THIS run, from the results GitHub reports for its jobs. Pure.
 * Returns `{ due, green, disposition }`.
 */
export function gateOutcome({ decision, gateResult, boundResult, contracts }) {
  if (decision === 'NOT_RELEVANT') return { due: false, green: true, disposition: null };
  if (decision === 'CARRY_FORWARD') {
    const green = String(contracts ?? '').trim() === '' ? boundResult !== 'failure' && boundResult !== 'cancelled' : boundResult === 'success';
    return { due: true, green, disposition: green ? 'CARRIED_FORWARD' : null };
  }
  // RUN, or anything unrecognized — which the workflows also treat as RUN.
  return { due: true, green: gateResult === 'success', disposition: gateResult === 'success' ? 'EXECUTED' : null };
}

function record(flags) {
  const event = readEvent();
  const workflow = WORKFLOWS[flags.workflow];
  if (workflow === undefined || !workflow.gates.includes(flags.gate)) throw new Error(`unknown workflow/gate ${flags.workflow}/${flags.gate}`);
  const outcome = gateOutcome({ decision: flags.decision, gateResult: flags['gate-result'], boundResult: flags['bound-result'], contracts: flags.contracts });
  const line = `${flags.workflow} ${flags.gate}: decision ${flags.decision || '(none)'}, gate ${flags['gate-result'] || '—'}, contracts ${flags['bound-result'] || '—'} → ${outcome.due ? (outcome.green ? `GREEN (${outcome.disposition})` : 'NOT GREEN') : 'not relevant to this PR'}`;
  summary(`- ${line}`);
  if (!outcome.due) return;
  if (!outcome.green) {
    process.stdout.write(`::error title=VAL-01 evidence::${line}\n`);
    process.exit(1);
  }
  if (process.env.GITHUB_EVENT_NAME !== 'pull_request') return; // evidence is only ever consulted by a PR update
  const headSha = event.pull_request?.head?.sha;
  const executed = outcome.disposition === 'EXECUTED';
  const evidence = {
    schema: EVIDENCE_SCHEMA,
    workflow: flags.workflow,
    gate: flags.gate,
    outcome: 'SUCCESS',
    disposition: outcome.disposition,
    headSha,
    baseSha: event.pull_request?.base?.sha,
    authorityDigest: authorityDigest(readTreeEntries('HEAD', root), workflow.file),
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
    sourceRunId: executed ? process.env.GITHUB_RUN_ID : flags['source-run-id'],
    sourceHeadSha: executed ? headSha : flags['source-head-sha'],
    recordedAt: new Date().toISOString(),
  };
  const out = join(flags.out, flags.gate);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
}

function main() {
  const [command, ...argv] = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) if (argv[i].startsWith('--')) flags[argv[i].slice(2)] = argv[i + 1] ?? '';

  if (command === 'plan') {
    try {
      planWorkflow(flags.workflow);
    } catch (error) {
      const workflow = WORKFLOWS[flags.workflow];
      summary(`### VAL-01 planner error — every gate RUNS\n\n\`${String(error?.stack ?? error).split('\n')[0]}\``);
      writeOutputs(Object.fromEntries((workflow?.gates ?? []).map((gate) => [gate.toLowerCase(), 'RUN'])));
    }
    return;
  }
  if (command === 'legs') {
    planLegs(flags.suite, flags.since);
    return;
  }
  if (command === 'record') {
    record(flags);
    return;
  }
  process.stderr.write('usage: plan-validation.mjs plan|legs|record …\n');
  process.exit(2);
}

if (process.argv[1] !== undefined && process.argv[1].replace(/\\/gu, '/').endsWith('scripts/validation/plan-validation.mjs')) {
  main();
}
