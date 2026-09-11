/**
 * T-12 Phase M — the artifact identity record.
 *
 * The Phase-M runbook's first rule is that a claim with no recorded build identity is `NOT TESTED`,
 * whatever it looked like at the time. This writes that identity INTO the artifact, so the evidence
 * travels with the binary rather than in someone's memory of which run produced it.
 *
 * It records only what was MEASURED from the built artifact — the checkpoint SHA, the file digest, the
 * ABIs actually present, the signer, whether Hermes is really in there, which root component was
 * registered. Nothing is inferred from a template, because an earlier draft of the runbook inferred
 * installability from template knowledge and was wrong to.
 *
 * VALIDATION TOOLING. It reads build outputs and writes one text file.
 *
 * Usage:
 *   node scripts/phase-m/record-artifact-identity.mjs android <PRODUCT|AUTH_VALIDATION> <sha> <out>
 *   node scripts/phase-m/record-artifact-identity.mjs ios     <PRODUCT|AUTH_VALIDATION> <sha> <out>
 */

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const [platform, role, sha, out] = process.argv.slice(2);

if (!['android', 'ios'].includes(platform) || !['PRODUCT', 'AUTH_VALIDATION'].includes(role) || !sha || !out) {
  process.stderr.write('usage: record-artifact-identity.mjs <android|ios> <PRODUCT|AUTH_VALIDATION> <sha> <out>\n');
  process.exit(1);
}

const lines = [];
const say = (label, value) => lines.push(`${label.padEnd(28)} ${value}`);

const run = (command, args) => {
  const result = spawnSync(command, args, { encoding: 'utf8', cwd: root });
  return result.status === 0 ? (result.stdout ?? '').trim() : null;
};

function digest(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** The one property of the manifest this record is about: which root component the build registered. */
function entryPoint() {
  return JSON.parse(readFileSync(join(root, 'apps/mobile/package.json'), 'utf8')).main;
}

function gradleProperty(name) {
  const path = join(root, 'apps/mobile/android/gradle.properties');
  if (!existsSync(path)) return 'gradle.properties absent';
  const match = readFileSync(path, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'mu'));
  return match ? match[1].trim() : 'unset';
}

say('artifact role', role);
say('checkpoint SHA', sha);
say('entry (package.json main)', JSON.stringify(entryPoint()));
say('recorded at', new Date().toISOString());

if (platform === 'android') {
  const apk = join(root, 'apps/mobile/android/app/build/outputs/apk/release/app-release.apk');
  if (!existsSync(apk)) {
    say('APK', 'ABSENT — the Gradle build produced no artifact at the expected path');
  } else {
    say('APK path', 'apps/mobile/android/app/build/outputs/apk/release/app-release.apk');
    say('APK size', `${statSync(apk).size} bytes`);
    say('APK SHA-256', digest(apk));

    // ABIs, read from the archive rather than from the build flag: the flag is the request, the
    // archive is the fact, and a physical ARM device needs `arm64-v8a` to actually be in there.
    const entries = run('unzip', ['-Z1', apk, 'lib/*']) ?? '';
    const abis = [...new Set(entries.split('\n').map((line) => line.split('/')[1]).filter(Boolean))].sort();
    say('ABIs present', abis.length > 0 ? abis.join(', ') : 'none found');
    say('installable on ARM64', abis.includes('arm64-v8a') ? 'YES' : 'NO — this artifact cannot be sideloaded onto the Honor X9b');

    // Hermes, measured the same way: the engine is in the archive or it is not.
    const hermes = entries.split('\n').filter((line) => /libhermes/u.test(line));
    say('Hermes in the APK', hermes.length > 0 ? `YES (${hermes.length} library file(s))` : 'NO');
    say('hermesEnabled', gradleProperty('hermesEnabled'));
    say('newArchEnabled', gradleProperty('newArchEnabled'));

    // The signing disposition is REPORTED, never changed. The repository signs Release with the
    // prebuild-generated debug keystore, which `adb install` accepts and a store would not.
    const sdk = process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME ?? '';
    let apksigner = null;
    const buildTools = sdk ? join(sdk, 'build-tools') : '';
    if (buildTools && existsSync(buildTools)) {
      const versions = readdirSync(buildTools).sort();
      for (const version of versions.reverse()) {
        const candidate = join(buildTools, version, 'apksigner');
        if (existsSync(candidate)) {
          apksigner = candidate;
          break;
        }
      }
    }
    const certs = apksigner ? run(apksigner, ['verify', '--print-certs', apk]) : null;
    if (certs) {
      for (const line of certs.split('\n')) {
        const match = line.match(/^Signer #1 certificate (DN|SHA-256 digest):\s*(.+)$/u);
        if (match) say(`signer ${match[1]}`, match[2].trim());
      }
    } else {
      say('signing', 'apksigner unavailable on this runner — signing not measured');
    }
    // The signer digest is what decides whether `adb install -r` can replace one of these artifacts
    // with the other WITHOUT wiping the app's data. That matters: the Product build carries no login
    // gateway, so the only way it can reach an authenticated identity on a device is to inherit the
    // auth store the validation build wrote — which Android permits only for a matching signature.
    // The keystore digest is recorded so the two artifacts can be compared instead of assumed equal.
    const keystore = join(root, 'apps/mobile/android/app/debug.keystore');
    say('debug.keystore SHA-256', existsSync(keystore) ? digest(keystore) : 'absent');
    say('signing disposition', 'debug keystore: SIDELOADABLE Release-type build, NOT a distributable production-signed artifact');
  }
} else {
  const products = join(root, 'apps/mobile/ios/build/Build/Products/Release-iphonesimulator');
  const app = existsSync(products) ? readdirSync(products).find((entry) => entry.endsWith('.app')) : undefined;
  if (!app) {
    say('.app', 'ABSENT — xcodebuild produced no simulator app at the expected path');
  } else {
    const bundle = join(products, app);
    say('.app', app);
    say('configuration', 'Release / iphonesimulator / CODE_SIGNING_ALLOWED=NO');
    say('bundle identifier', run('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleIdentifier', join(bundle, 'Info.plist')]) ?? 'unreadable');
    say('Hermes framework', existsSync(join(bundle, 'Frameworks/hermes.framework')) ? 'YES' : 'NO');
    say('evidence class', 'IOS RELEASE SIMULATOR — never a physical or tactile claim');
  }
  say('Xcode', run('xcodebuild', ['-version'])?.split('\n')[0] ?? 'unknown');
  say('simulator', `${process.env.IOS_SIMULATOR_NAME ?? '?'} / ${process.env.IOS_SIMULATOR_RUNTIME_SUFFIX ?? '?'} / ${process.env.IOS_SIM_UDID ?? '?'}`);
}

// The four T12-04 phase outcomes ride along when the caller has them, so the artifact says what it
// witnessed rather than requiring the run page to be open beside it.
for (const [label, name] of [['phase 1 before restart', 'PHASE_1'], ['phase 2 after restart', 'PHASE_2'],
  ['phase 3 signout + B', 'PHASE_3'], ['phase 4 signed out', 'PHASE_4']]) {
  if (process.env[name]) say(`T12-04 ${label}`, process.env[name]);
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${lines.join('\n')}\n`);
process.stdout.write(`${lines.join('\n')}\n`);
