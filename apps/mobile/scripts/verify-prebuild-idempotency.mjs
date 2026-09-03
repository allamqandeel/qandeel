// T-01 Continuous Native Generation gate (escape-hatch Level 2 policy):
// `expo prebuild` must be idempotent, its generated `android/` and `ios/` output is
// never canonical source, and running it must leave the repository state unchanged.
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

function prebuild() {
  for (const platform of platforms) {
    run(process.execPath, [expoCli, 'prebuild', '--platform', platform, '--no-install']);
  }
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

function hashGeneratedDirectories() {
  const hash = createHash('sha256');
  let count = 0;
  for (const directory of generatedDirectories) {
    const root = join(projectDir, directory);
    if (!existsSync(root)) throw new Error(`expected generated directory is missing: ${directory}`);
    for (const file of walk(root)) {
      hash.update(relative(projectDir, file).split(sep).join('/'));
      hash.update('\0');
      hash.update(readFileSync(file));
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
prebuild();
const first = hashGeneratedDirectories();

prebuild();
const second = hashGeneratedDirectories();

removeGeneratedDirectories();
const statusAfter = capture('git', ['status', '--porcelain', '--untracked-files=all']);

console.log(`prebuild #1 (${platforms.join('+')}): ${first.count} generated files, sha256 ${first.digest}`);
console.log(`prebuild #2 (${platforms.join('+')}): ${second.count} generated files, sha256 ${second.digest}`);

let failed = false;
if (first.digest !== second.digest || first.count !== second.count) {
  console.error('FAIL: expo prebuild is not idempotent; generated output differs between two runs.');
  failed = true;
}
if (statusBefore !== statusAfter) {
  console.error('FAIL: expo prebuild changed the repository state.');
  console.error(`before:\n${statusBefore}\nafter:\n${statusAfter}`);
  failed = true;
}
if (failed) process.exit(1);
console.log('PASS: prebuild is idempotent, generated native directories were discarded, repository state unchanged.');
