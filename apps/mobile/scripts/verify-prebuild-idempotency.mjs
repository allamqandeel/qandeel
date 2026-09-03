// T-01 Continuous Native Generation gate (escape-hatch Level 2 policy). Two proofs:
//  1. Idempotent re-application: running `expo prebuild --no-clean` over the generated
//     project must leave every generated file byte-identical (config plugins never drift).
//  2. Reproducible generation: two clean generations must be identical modulo the random
//     Xcode object identifiers that the pbxproj generator assigns on every run.
// Generated `android/` and `ios/` output is never canonical source, and the gate must
// leave the repository state unchanged.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectDir = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]+$/u, '');
const nativeDirectories = ['android', 'ios'];
// Expo CLI refuses to generate the iOS project on Windows hosts; CI (Linux/macOS) proves both.
const platforms = process.platform === 'win32' ? ['android'] : ['android', 'ios'];
const generatedDirectories = platforms;
const require = createRequire(import.meta.url);
const expoCli = join(dirname(require.resolve('expo/package.json')), 'bin', 'cli');
const environment = { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' };

function capture(command, args) {
  const result = spawnSync(command, args, { cwd: projectDir, encoding: 'utf8', windowsHide: true, env: environment });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '');
    throw new Error(`${command} ${args.join(' ')} exited ${result.status}`);
  }
  return result.stdout;
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: projectDir, stdio: 'inherit', windowsHide: true, env: environment });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited ${result.status}`);
}

function assertGeneratedDirectoriesUntracked() {
  const tracked = capture('git', ['ls-files', '--', ...nativeDirectories]).trim();
  if (tracked) {
    throw new Error(`generated native directories must never be tracked, but git tracks:\n${tracked}`);
  }
}

function removeGeneratedDirectories() {
  for (const directory of nativeDirectories) {
    rmSync(join(projectDir, directory), { recursive: true, force: true });
  }
}

function prebuild({ clean }) {
  for (const platform of platforms) {
    const args = [expoCli, 'prebuild', '--platform', platform, '--no-install'];
    if (!clean) args.push('--no-clean');
    run(process.execPath, args);
  }
}

// The `xcode` project generator assigns random 24-hex object identifiers on every clean run;
// they carry no configuration, so clean-generation comparisons neutralise them.
const XCODE_ID_FILES = /\.(?:pbxproj|xcscheme)$/u;
function normalizeXcodeIds(relativePath, bytes) {
  if (!relativePath.startsWith('ios/') || !XCODE_ID_FILES.test(relativePath)) return bytes;
  return Buffer.from(bytes.toString('utf8').replace(/\b[0-9A-F]{24}\b/gu, 'XCODE_OBJECT_ID'), 'utf8');
}

function walk(directory, files = []) {
  const entries = readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'));
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function hashGeneratedDirectories({ normalize }) {
  const hash = createHash('sha256');
  let count = 0;
  for (const directory of generatedDirectories) {
    const root = join(projectDir, directory);
    if (!existsSync(root)) throw new Error(`expected generated directory is missing: ${directory}`);
    for (const file of walk(root)) {
      const relativePath = relative(projectDir, file).split(sep).join('/');
      const bytes = readFileSync(file);
      hash.update(relativePath);
      hash.update('\0');
      hash.update(normalize ? normalizeXcodeIds(relativePath, bytes) : bytes);
      hash.update('\0');
      count += 1;
    }
  }
  return { digest: hash.digest('hex'), count };
}

assertGeneratedDirectoriesUntracked();
if (platforms.length !== nativeDirectories.length) {
  console.log(`NOTE: platforms proven on this host: ${platforms.join(', ')} (Expo CLI cannot generate the iOS project on Windows; CI proves iOS).`);
}
const statusBefore = capture('git', ['status', '--porcelain', '--untracked-files=all']);

removeGeneratedDirectories();
prebuild({ clean: true });
const cleanFirst = hashGeneratedDirectories({ normalize: false });
const cleanFirstNormalized = hashGeneratedDirectories({ normalize: true });

prebuild({ clean: false });
const reapplied = hashGeneratedDirectories({ normalize: false });

removeGeneratedDirectories();
prebuild({ clean: true });
const cleanSecondNormalized = hashGeneratedDirectories({ normalize: true });

removeGeneratedDirectories();
const statusAfter = capture('git', ['status', '--porcelain', '--untracked-files=all']);

const label = platforms.join('+');
console.log(`clean generation #1 (${label}): ${cleanFirst.count} files, raw sha256 ${cleanFirst.digest}`);
console.log(`re-application --no-clean (${label}): ${reapplied.count} files, raw sha256 ${reapplied.digest}`);
console.log(`clean generation #1 normalized (${label}): sha256 ${cleanFirstNormalized.digest}`);
console.log(`clean generation #2 normalized (${label}): sha256 ${cleanSecondNormalized.digest}`);

let failed = false;
if (cleanFirst.digest !== reapplied.digest || cleanFirst.count !== reapplied.count) {
  console.error('FAIL: re-applying expo prebuild over the generated project changed it (config plugins are not idempotent).');
  failed = true;
}
if (cleanFirstNormalized.digest !== cleanSecondNormalized.digest) {
  console.error('FAIL: two clean generations differ beyond Xcode object identifiers (generation is not reproducible).');
  failed = true;
}
if (statusBefore !== statusAfter) {
  console.error('FAIL: expo prebuild changed the repository state.');
  console.error(`before:\n${statusBefore}\nafter:\n${statusAfter}`);
  failed = true;
}
if (failed) process.exit(1);
console.log('PASS: re-application is byte-identical, clean generation is reproducible, generated native directories were discarded, repository state unchanged.');
