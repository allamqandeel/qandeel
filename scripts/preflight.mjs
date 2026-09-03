import { spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import process from 'node:process';
import { integrationVariables, loadLocalEnvironment } from './local-environment.mjs';

let failed = false;

function status(kind, message) {
  console.log(`${kind}: ${message}`);
}

function commandVersion(label, command, args, { required = true, shell = false } = {}) {
  // With a shell, pass one fixed command line and no separate args (avoids Node's DEP0190 warning).
  const result = shell
    ? spawnSync([command, ...args].join(' '), { encoding: 'utf8', windowsHide: true, shell: true })
    : spawnSync(command, args, { encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) {
    status(required ? 'MISSING' : 'OPTIONAL', `${label} is not available${required ? '.' : '; required only when publishing a PR.'}`);
    if (required) failed = true;
    return null;
  }
  const version = result.stdout.trim().split(/\r?\n/u)[0];
  status('OK', `${label} ${version}`);
  return version;
}

const minimumNode = { major: 22, minor: 13, patch: 0 };
const [nodeMajor, nodeMinor, nodePatch] = process.versions.node
  .split('.')
  .map((part) => Number.parseInt(part, 10));
const nodeSupported =
  nodeMajor > minimumNode.major ||
  (nodeMajor === minimumNode.major &&
    (nodeMinor > minimumNode.minor ||
      (nodeMinor === minimumNode.minor && nodePatch >= minimumNode.patch)));
if (nodeSupported) status('OK', `Node v${process.versions.node}`);
else {
  status('UNSUPPORTED', `Node v${process.versions.node}; Node 22.13.0 or newer is required.`);
  failed = true;
}

// Node 20.12+/22 refuse to spawn .cmd shims without a shell on Windows; the argument list is fixed.
const npmVersion = commandVersion('npm', 'npm', ['--version'], { shell: process.platform === 'win32' });
if (npmVersion && Number.parseInt(npmVersion.split('.')[0], 10) < 10) {
  status('UNSUPPORTED', `npm ${npmVersion}; npm 10 or newer is required.`);
  failed = true;
}
commandVersion('Git', 'git', ['--version']);
commandVersion('GitHub CLI', 'gh', ['--version'], { required: false });

for (const file of ['package.json', 'package-lock.json']) {
  try {
    await access(new URL(`../${file}`, import.meta.url));
    status('OK', `${file} is present.`);
  } catch {
    status('MISSING', `${file} is required at the repository root.`);
    failed = true;
  }
}

const environment = await loadLocalEnvironment();
const present = integrationVariables.filter((name) => environment[name]);
const missing = integrationVariables.filter((name) => !environment[name]);
status('INFO', `Integration configuration names present: ${present.length}/${integrationVariables.length}.`);
if (missing.length) status('INFO', `Integration configuration names missing: ${missing.join(', ')}.`);
status('INFO', 'Integration values were not displayed. Real integration checks remain explicit.');

if (failed) {
  status('ACTION', 'Install the missing prerequisite through your normal machine setup, then rerun npm run preflight.');
  process.exitCode = 1;
} else {
  status('READY', 'Local implementation prerequisites are available.');
}
