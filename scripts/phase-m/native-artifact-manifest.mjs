/**
 * QAN-INF-04 — the native artifact identity manifest.
 *
 * `record-artifact-identity.mjs` writes the HUMAN evidence record that travels in the Phase-M
 * evidence bundle, and it keeps doing exactly that. This writes the MACHINE record that decides
 * whether a binary may be installed at all: one JSON document, produced beside the artifact by the
 * build job, uploaded with it, and re-verified by every consumer before the first `adb install` or
 * `simctl install`.
 *
 * ## What it must answer
 *
 * A consumer holding a downloaded file has to establish, without trusting the run page or the person
 * who dispatched it, that:
 *
 *   - these bytes are the bytes that job produced         -> `artifact.sha256`
 *   - they were produced from inputs identical to mine    -> `buildInputFingerprint`
 *   - by the build recipe I am the consumer of            -> `buildRecipe`
 *   - for my platform, role and device target             -> `platform`, `role`, `entry`, `target`
 *   - against the same public configuration I will use    -> `configuration`
 *
 * Anything that cannot be answered is a refusal, never a default. The verifier that reads this
 * document is `verify-native-artifact-manifest.mjs`, and the fields below exist because it checks
 * every one of them.
 *
 * ## Configuration is recorded as digests
 *
 * `QANDEEL_API_BASE_URL` is a build-time value: `app.config.js` embeds it in `extra`, so a binary
 * built for a dead Cloudflare Quick Tunnel is a binary that points at a dead origin, whatever the
 * rest of its provenance says. It therefore participates in reuse, and a differing origin refuses.
 *
 * The three values are recorded as SHA-256 digests plus an explicit `present` flag, never as values.
 * `QANDEEL_SUPABASE_URL` and `QANDEEL_SUPABASE_PUBLIC_KEY` come from repository secrets and must not
 * appear in an uploaded artifact. The API origin is a public dispatch input rather than a credential,
 * and `assert-validation-preconditions.mjs` has already refused any URL carrying userinfo, a query or
 * a fragment — so its HOSTNAME is additionally recorded in clear, because a refusal that can only say
 * "two digests differ" is a refusal nobody can act on.
 *
 * `present: false` is a first-class recorded state, not an absence. Mobile CI builds with no
 * configuration at all on purpose; that artifact is genuinely a different artifact from a Phase-M one,
 * and recording "unset" as a value rather than a gap is what makes the two provably non-interchangeable.
 *
 * VALIDATION TOOLING. It reads build outputs and the environment, and writes one JSON file.
 *
 * Usage:
 *   node scripts/phase-m/native-artifact-manifest.mjs \
 *     --platform android --role AUTH_VALIDATION --recipe t13-recovery-validation \
 *     --abis x86_64 --artifact <path to .apk> --out <path to .json>
 *
 *   node scripts/phase-m/native-artifact-manifest.mjs \
 *     --platform ios --role AUTH_VALIDATION --recipe t13-recovery-validation \
 *     --artifact <path to packaged .app.zip> --out <path to .json>
 */

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

import { computeFingerprint, readTreeEntries } from './native-build-fingerprint.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

/** The manifest schema. A consumer requires this value exactly; an older or newer one is refused. */
export const MANIFEST_SCHEMA = 'qandeel.native-artifact-identity/1';

/**
 * The build recipes that exist. A consumer names the one it is the consumer of, so an artifact built
 * for one purpose can never be installed by a job validating another — the existing validation-artifact
 * role separation, extended from the ROOT COMPONENT to the whole build recipe.
 */
export const BUILD_RECIPES = Object.freeze({
  /** The T-13 recovery validation root: harness entry, configured, driven against the live API. */
  't13-recovery-validation': 1,
  /** The canonical Mobile CI native gate: Product entry, unconfigured, boot smoke. */
  'mobile-ci-boot-smoke': 1,
  /** QAN-INF-04's own demonstration of the pipeline: Product entry, unconfigured, boot smoke. */
  'qan-inf-04-demonstration': 1,
});

export const PRODUCT_ENTRY = 'expo-router/entry';
export const VALIDATION_ENTRY = 'src/integration/__validation__/validation-entry.tsx';

/** The three build-time configuration variables `apps/mobile/app.config.js` reads, and only those. */
export const CONFIGURATION_KEYS = Object.freeze([
  'QANDEEL_API_BASE_URL',
  'QANDEEL_SUPABASE_URL',
  'QANDEEL_SUPABASE_PUBLIC_KEY',
]);

const fail = (message) => {
  process.stderr.write(`native-artifact-manifest: STOP ${message}\n`);
  process.exit(1);
};

const run = (command, args) => {
  const result = spawnSync(command, args, { encoding: 'utf8', cwd: root });
  return result.status === 0 ? (result.stdout ?? '').trim() : null;
};

/**
 * Digests one configuration value. The digest is domain-separated so a value's hash here cannot be
 * compared against, or confused with, the same string hashed anywhere else.
 */
export function digestConfigurationValue(key, value) {
  if (value === undefined || value === null || value === '') return { present: false, sha256: null };
  return {
    present: true,
    sha256: createHash('sha256').update(`qandeel.mobile-build-config/1\n${key}\n${value}`, 'utf8').digest('hex'),
  };
}

/** The configuration section, read from the environment the build actually ran under. */
export function describeConfiguration(env = process.env) {
  const section = {};
  for (const key of CONFIGURATION_KEYS) section[key] = digestConfigurationValue(key, env[key]);

  // Diagnosability, bounded: the hostname of a public dispatch input, never the Supabase values.
  let apiHost = null;
  try {
    apiHost = env.QANDEEL_API_BASE_URL ? new URL(env.QANDEEL_API_BASE_URL).hostname : null;
  } catch {
    apiHost = 'unparseable';
  }
  section.apiBaseUrlHost = apiHost;
  return section;
}

function packageVersion(name) {
  const installed = join(root, 'node_modules', name, 'package.json');
  if (existsSync(installed)) {
    try {
      return JSON.parse(readFileSync(installed, 'utf8')).version ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

function describeToolchain(platform) {
  const toolchain = {
    node: process.version,
    expo: packageVersion('expo'),
    reactNative: packageVersion('react-native'),
  };
  if (platform === 'android') {
    const java = spawnSync('java', ['-version'], { encoding: 'utf8' });
    toolchain.java = ((java.stderr ?? '') + (java.stdout ?? '')).split('\n')[0].trim() || null;
    const wrapper = join(root, 'apps/mobile/android/gradle/wrapper/gradle-wrapper.properties');
    toolchain.gradleWrapper = existsSync(wrapper)
      ? (readFileSync(wrapper, 'utf8').match(/gradle-([0-9][^-]*)-(?:all|bin)\.zip/u)?.[1] ?? null)
      : null;
  } else {
    toolchain.xcode = run('xcodebuild', ['-version'])?.split('\n')[0] ?? null;
  }
  return toolchain;
}

function describeTarget(platform, abis) {
  if (platform === 'android') {
    return { kind: 'android-device', abis: abis.slice().sort() };
  }
  return {
    kind: 'ios-simulator',
    sdk: 'iphonesimulator',
    configuration: 'Release',
    simulatorName: process.env.IOS_SIMULATOR_NAME ?? null,
    simulatorRuntime: process.env.IOS_SIMULATOR_RUNTIME_SUFFIX ?? null,
  };
}

/** Which root component the build registered. Read from the manifest the build actually used. */
function entryPoint() {
  return JSON.parse(readFileSync(join(root, 'apps/mobile/package.json'), 'utf8')).main ?? null;
}

function main() {
  const argv = process.argv.slice(2);
  const flag = (name) => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  const platform = flag('platform');
  const role = flag('role');
  const recipe = flag('recipe');
  const artifactPath = flag('artifact');
  const out = flag('out');
  const commit = flag('commit') ?? process.env.GITHUB_SHA ?? run('git', ['rev-parse', 'HEAD']);
  const abis = (flag('abis') ?? '').split(',').map((value) => value.trim()).filter(Boolean);

  if (!['android', 'ios'].includes(platform)) fail('--platform must be android or ios');
  if (!['PRODUCT', 'AUTH_VALIDATION'].includes(role)) fail('--role must be PRODUCT or AUTH_VALIDATION');
  if (!Object.hasOwn(BUILD_RECIPES, recipe)) fail(`--recipe must be one of ${Object.keys(BUILD_RECIPES).join(', ')}`);
  if (!artifactPath || !out) fail('--artifact and --out are required');
  if (!commit) fail('no commit SHA: pass --commit or set GITHUB_SHA');
  if (platform === 'android' && abis.length === 0) fail('--abis is required for android (the ABI the build was asked for)');

  if (!existsSync(artifactPath)) fail(`the artifact does not exist at ${artifactPath}`);
  const stat = statSync(artifactPath);
  if (!stat.isFile()) {
    fail(`${artifactPath} is not a file. Package a directory (ditto -c -k --keepParent) before recording it.`);
  }

  // The entry must agree with the role, here, at the moment the binary exists. This is the check that
  // catches a job that selected the validation entry and then recorded itself as a PRODUCT artifact.
  const entry = entryPoint();
  const expectedEntry = role === 'PRODUCT' ? PRODUCT_ENTRY : VALIDATION_ENTRY;
  if (entry !== expectedEntry) {
    fail(`role ${role} requires main=${JSON.stringify(expectedEntry)}, but the manifest says ${JSON.stringify(entry)}`);
  }

  const fingerprint = computeFingerprint(readTreeEntries(commit));

  const manifest = {
    schema: MANIFEST_SCHEMA,
    buildRecipe: { id: recipe, version: BUILD_RECIPES[recipe] },
    commit,
    platform,
    role,
    entry,
    artifact: {
      name: basename(artifactPath),
      bytes: stat.size,
      sha256: createHash('sha256').update(readFileSync(artifactPath)).digest('hex'),
    },
    buildInputFingerprint: fingerprint,
    target: describeTarget(platform, abis),
    toolchain: describeToolchain(platform),
    configuration: describeConfiguration(),
    provenance: {
      runId: process.env.GITHUB_RUN_ID ?? null,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
      workflow: process.env.GITHUB_WORKFLOW ?? null,
      job: process.env.GITHUB_JOB ?? null,
      recordedAt: new Date().toISOString(),
    },
  };

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

if (process.argv[1] !== undefined && process.argv[1].replace(/\\/gu, '/').endsWith('scripts/phase-m/native-artifact-manifest.mjs')) {
  main();
}
