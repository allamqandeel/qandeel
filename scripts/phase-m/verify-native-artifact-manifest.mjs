/**
 * QAN-INF-04 — the artifact provenance gate.
 *
 * This runs in a validation consumer job, after the artifact is downloaded and BEFORE anything is
 * installed on an emulator, a simulator or a device. It is the only thing standing between a
 * downloaded file and a test result attributed to it.
 *
 * ## It fails closed, and it fails closed by construction
 *
 * Every check below is a refusal with a named reason. There is no default-accept path, no "could not
 * determine, continuing", and no flag that softens a verdict. A manifest that is missing, malformed,
 * of the wrong schema, or short one field is refused for that reason — an artifact whose validity
 * cannot be PROVEN is not an artifact whose validity is merely unknown; for this gate they are the
 * same thing, and the answer to both is no.
 *
 * ## The five questions, in the order a failure is cheapest to diagnose
 *
 *   1. STRUCTURE     the manifest parses, is this schema, and carries every field
 *   2. IDENTITY      platform, role, entry and build recipe are the ones this consumer consumes
 *   3. BYTES         the downloaded file digests to the value the producer recorded
 *   4. INPUTS        the producer's build-input fingerprint equals this checkout's
 *   5. CONFIGURATION the three build-time values this job will validate against are the three the
 *                    binary was built with
 *
 * Check 4 is what makes cross-run reuse safe at all, and check 5 is what stops a binary built for a
 * dead Cloudflare Quick Tunnel being pointed at a live one and reported as a pass.
 *
 * ## Two modes
 *
 *   --mode same-run    the artifact came from a producer job in THIS run. The commit must match
 *                      `--commit` exactly; the fingerprint must match too, which is then trivially
 *                      true and is still asserted, because a trivially true assertion costs nothing
 *                      and a silently skipped one costs everything.
 *
 *   --mode prior-run   the artifact came from an earlier workflow run, at the operator's explicit
 *                      request. The commit MAY differ. Nothing else may. This is the mode in which
 *                      the fingerprint is the entire argument, and the mode this script exists for.
 *
 * ## What is recorded but not compared
 *
 * `toolchain`. The consumer does not build, so it cannot re-derive the compiler that produced the
 * binary; asserting equality against the consumer's own runner would compare two unrelated things and
 * read like a guarantee. It is required to be STRUCTURALLY present, printed in the evidence, and left
 * as a documented residual: a prior-run artifact built on an older GitHub runner image is accepted on
 * the strength of identical inputs, identical configuration and identical bytes.
 *
 * VALIDATION TOOLING. It reads a manifest, a file and the git object store, and writes nothing.
 *
 * Usage:
 *   node scripts/phase-m/verify-native-artifact-manifest.mjs \
 *     --manifest <path> --artifact <path> --mode same-run|prior-run \
 *     --platform android --role AUTH_VALIDATION --recipe t13-recovery-validation --abis x86_64 \
 *     [--commit <sha>]
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import process from 'node:process';

import {
  FINGERPRINT_DOMAIN,
  FINGERPRINT_SCHEMA_VERSION,
  computeFingerprint,
  readTreeEntries,
} from './native-build-fingerprint.mjs';
import {
  BUILD_RECIPES,
  CONFIGURATION_KEYS,
  MANIFEST_SCHEMA,
  PRODUCT_ENTRY,
  VALIDATION_ENTRY,
  digestConfigurationValue,
} from './native-artifact-manifest.mjs';

/**
 * Verifies a parsed manifest against an expectation. Pure: no filesystem, no git, no process exit —
 * so the contract can drive it over hand-built malformed manifests without a repository around it.
 *
 * `expected` carries `{ platform, role, recipe, abis, mode, commit, fingerprint, artifactSha256,
 * artifactBytes, configuration }`. Returns `{ ok, refusals[], notes[] }`.
 */
export function verifyManifest(manifest, expected) {
  const refusals = [];
  const notes = [];
  const refuse = (code, detail) => refusals.push(`${code}: ${detail}`);

  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    refuse('MANIFEST_NOT_AN_OBJECT', 'the manifest did not parse to a JSON object');
    return { ok: false, refusals, notes };
  }

  // 1. STRUCTURE. Shape first: every later check reads a field, and a missing field must be reported
  //    as a missing field rather than as the mismatch it would masquerade as.
  if (manifest.schema !== MANIFEST_SCHEMA) {
    refuse('SCHEMA_MISMATCH', `expected ${MANIFEST_SCHEMA}, found ${JSON.stringify(manifest.schema ?? null)}`);
    return { ok: false, refusals, notes };
  }
  for (const path of [
    'buildRecipe.id', 'buildRecipe.version', 'commit', 'platform', 'role', 'entry',
    'artifact.name', 'artifact.bytes', 'artifact.sha256',
    'buildInputFingerprint.domain', 'buildInputFingerprint.schemaVersion', 'buildInputFingerprint.value',
    'target.kind', 'toolchain.node', 'configuration',
  ]) {
    const value = path.split('.').reduce((node, key) => (node === null || node === undefined ? undefined : node[key]), manifest);
    if (value === undefined || value === null || value === '') refuse('MANIFEST_FIELD_MISSING', path);
  }
  if (refusals.length > 0) return { ok: false, refusals, notes };

  if (!/^[0-9a-f]{40}$/u.test(String(manifest.commit))) {
    refuse('COMMIT_MALFORMED', `commit is not a 40-character object name: ${JSON.stringify(manifest.commit)}`);
  }
  if (!/^[0-9a-f]{64}$/u.test(String(manifest.artifact.sha256))) {
    refuse('ARTIFACT_DIGEST_MALFORMED', `artifact.sha256 is not a SHA-256: ${JSON.stringify(manifest.artifact.sha256)}`);
  }

  // 2. IDENTITY.
  if (manifest.platform !== expected.platform) {
    refuse('PLATFORM_MISMATCH', `artifact is ${JSON.stringify(manifest.platform)}, this consumer needs ${JSON.stringify(expected.platform)}`);
  }
  if (manifest.role !== expected.role) {
    refuse('ROLE_MISMATCH', `artifact role is ${JSON.stringify(manifest.role)}, this consumer needs ${JSON.stringify(expected.role)}`);
  }
  const entryForRole = manifest.role === 'PRODUCT' ? PRODUCT_ENTRY : VALIDATION_ENTRY;
  if (manifest.entry !== entryForRole) {
    refuse('ENTRY_ROLE_DISAGREEMENT', `role ${manifest.role} requires entry ${JSON.stringify(entryForRole)}, manifest says ${JSON.stringify(manifest.entry)}`);
  }
  if (manifest.buildRecipe.id !== expected.recipe) {
    refuse('RECIPE_MISMATCH', `artifact was built by recipe ${JSON.stringify(manifest.buildRecipe.id)}, this consumer consumes ${JSON.stringify(expected.recipe)}`);
  } else if (manifest.buildRecipe.version !== BUILD_RECIPES[expected.recipe]) {
    refuse('RECIPE_VERSION_MISMATCH', `recipe ${expected.recipe} is at version ${BUILD_RECIPES[expected.recipe]}, artifact carries ${manifest.buildRecipe.version}`);
  }

  // Device target. An APK built arm64-only cannot run on the x86_64 emulator, and an artifact for a
  // different simulator runtime is a different artifact.
  if (expected.platform === 'android') {
    const recorded = Array.isArray(manifest.target.abis) ? manifest.target.abis.slice().sort() : null;
    const wanted = expected.abis.slice().sort();
    if (recorded === null || recorded.join(',') !== wanted.join(',')) {
      refuse('TARGET_ABI_MISMATCH', `artifact ABIs ${JSON.stringify(recorded)}, this consumer needs ${JSON.stringify(wanted)}`);
    }
  } else {
    if (manifest.target.kind !== 'ios-simulator' || manifest.target.sdk !== 'iphonesimulator') {
      refuse('TARGET_KIND_MISMATCH', `expected an iphonesimulator artifact, found ${JSON.stringify(manifest.target)}`);
    }
    for (const [field, value] of [['simulatorName', expected.simulatorName], ['simulatorRuntime', expected.simulatorRuntime]]) {
      if (value && manifest.target[field] !== value) {
        refuse('TARGET_SIMULATOR_MISMATCH', `${field}: artifact ${JSON.stringify(manifest.target[field])}, this consumer boots ${JSON.stringify(value)}`);
      }
    }
  }

  // 3. BYTES.
  if (expected.artifactSha256 !== undefined && expected.artifactSha256 !== manifest.artifact.sha256) {
    refuse('ARTIFACT_HASH_MISMATCH', `the downloaded file digests to ${expected.artifactSha256}, the manifest records ${manifest.artifact.sha256}`);
  }
  if (expected.artifactBytes !== undefined && expected.artifactBytes !== manifest.artifact.bytes) {
    refuse('ARTIFACT_SIZE_MISMATCH', `the downloaded file is ${expected.artifactBytes} bytes, the manifest records ${manifest.artifact.bytes}`);
  }

  // 4. INPUTS.
  if (manifest.buildInputFingerprint.domain !== FINGERPRINT_DOMAIN
    || manifest.buildInputFingerprint.schemaVersion !== FINGERPRINT_SCHEMA_VERSION) {
    refuse('FINGERPRINT_SCHEMA_MISMATCH',
      `artifact fingerprint is ${manifest.buildInputFingerprint.domain}/${manifest.buildInputFingerprint.schemaVersion}, `
      + `this checkout computes ${FINGERPRINT_DOMAIN}/${FINGERPRINT_SCHEMA_VERSION}`);
  } else if (expected.fingerprint !== undefined && manifest.buildInputFingerprint.value !== expected.fingerprint) {
    refuse('BUILD_INPUT_FINGERPRINT_MISMATCH',
      `artifact built from inputs ${manifest.buildInputFingerprint.value}, this checkout is ${expected.fingerprint}. `
      + 'A build-affecting file differs. Rebuild; do not reuse.');
  }

  if (expected.mode === 'same-run') {
    if (expected.commit !== undefined && manifest.commit !== expected.commit) {
      refuse('COMMIT_MISMATCH', `same-run reuse requires the producer's commit ${expected.commit}, artifact carries ${manifest.commit}`);
    }
  } else if (expected.mode === 'prior-run') {
    notes.push(`prior-run reuse: artifact commit ${manifest.commit}, this checkout ${expected.commit ?? '(unknown)'}`);
    notes.push('accepted on identical build inputs, not on identical commit — the fingerprint is the argument');
  } else {
    refuse('MODE_INVALID', `--mode must be same-run or prior-run, got ${JSON.stringify(expected.mode)}`);
  }

  // 5. CONFIGURATION.
  const recordedConfig = manifest.configuration;
  if (recordedConfig === null || typeof recordedConfig !== 'object') {
    refuse('CONFIGURATION_MISSING', 'the manifest records no build-time configuration section');
  } else {
    for (const key of CONFIGURATION_KEYS) {
      const recorded = recordedConfig[key];
      const current = expected.configuration?.[key];
      if (recorded === null || typeof recorded !== 'object' || typeof recorded.present !== 'boolean') {
        refuse('CONFIGURATION_FIELD_MALFORMED', `configuration.${key}`);
        continue;
      }
      if (recorded.present !== current?.present) {
        refuse('CONFIGURATION_PRESENCE_MISMATCH',
          `${key}: the artifact was built ${recorded.present ? 'with' : 'WITHOUT'} this value, this job runs ${current?.present ? 'with' : 'WITHOUT'} it`);
        continue;
      }
      if (recorded.present && recorded.sha256 !== current.sha256) {
        refuse('CONFIGURATION_VALUE_MISMATCH',
          key === 'QANDEEL_API_BASE_URL'
            ? `${key} differs. The binary embeds the origin at BUILD time, so an artifact built for `
              + `${JSON.stringify(recordedConfig.apiBaseUrlHost ?? 'an unrecorded host')} cannot be validated against a different one. Rebuild.`
            : `${key} differs between the artifact's build and this job`);
      }
    }
  }

  if (manifest.toolchain) {
    notes.push(`build toolchain (recorded, not compared): ${JSON.stringify(manifest.toolchain)}`);
  }
  notes.push(`producer run: ${manifest.provenance?.runId ?? 'unrecorded'} attempt ${manifest.provenance?.runAttempt ?? '?'} recorded ${manifest.provenance?.recordedAt ?? '?'}`);

  return { ok: refusals.length === 0, refusals, notes };
}

function main() {
  const argv = process.argv.slice(2);
  const flag = (name) => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  const manifestPath = flag('manifest');
  const artifactPath = flag('artifact');
  const mode = flag('mode');
  const platform = flag('platform');
  const role = flag('role');
  const recipe = flag('recipe');
  const abis = (flag('abis') ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  const commit = flag('commit') ?? process.env.GITHUB_SHA;

  const stop = (message) => {
    process.stderr.write(`STOP ${message}\n`);
    process.exit(1);
  };

  if (!manifestPath || !artifactPath || !mode || !platform || !role || !recipe) {
    stop('usage: --manifest <p> --artifact <p> --mode same-run|prior-run --platform <p> --role <r> --recipe <r> [--abis <list>]');
  }

  // A missing manifest is the commonest real failure — an artifact uploaded by an older workflow, or
  // a download that landed in a different directory. It is refused here by name, not by a crash.
  if (!existsSync(manifestPath)) stop(`ARTIFACT_IDENTITY_MISSING: no manifest at ${manifestPath}. Refusing to install an artifact with no provenance.`);
  if (!existsSync(artifactPath)) stop(`ARTIFACT_MISSING: no artifact at ${artifactPath}`);

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    stop(`ARTIFACT_IDENTITY_MALFORMED: ${manifestPath} is not valid JSON (${error.message})`);
  }

  const configuration = {};
  for (const key of CONFIGURATION_KEYS) configuration[key] = digestConfigurationValue(key, process.env[key]);

  const verdict = verifyManifest(manifest, {
    platform,
    role,
    recipe,
    abis,
    mode,
    commit,
    simulatorName: process.env.IOS_SIMULATOR_NAME,
    simulatorRuntime: process.env.IOS_SIMULATOR_RUNTIME_SUFFIX,
    artifactSha256: createHash('sha256').update(readFileSync(artifactPath)).digest('hex'),
    artifactBytes: statSync(artifactPath).size,
    fingerprint: computeFingerprint(readTreeEntries('HEAD')).value,
    configuration,
  });

  for (const note of verdict.notes) process.stdout.write(`ok   ${note}\n`);
  if (verdict.ok) {
    process.stdout.write(`ok   PROVENANCE VERIFIED — ${platform} ${role} (${recipe}), ${mode}, artifact ${manifest.artifact.sha256}\n`);
    process.stdout.write('ok   this artifact may be installed and validated\n');
    return;
  }
  for (const refusal of verdict.refusals) process.stderr.write(`STOP ${refusal}\n`);
  process.stderr.write('STOP REUSE REFUSED. No test claim may be made from this artifact.\n');
  process.exit(1);
}

if (process.argv[1] !== undefined && process.argv[1].replace(/\\/gu, '/').endsWith('scripts/phase-m/verify-native-artifact-manifest.mjs')) {
  main();
}
