/**
 * T-12 Phase M — collect the `QAN-BL-T12-04` evidence, with every credential redacted.
 *
 * The harness's own report is safe by construction: it carries kinds, booleans and character counts,
 * never a value. Maestro's debug output is NOT. It dumps the view hierarchy of whatever was on screen,
 * so a run that typed an identity email into a text field leaves that email in a text file — and an
 * uploaded artifact is not masked the way a log line is.
 *
 * Two independent measures, because either alone is a single point of failure:
 *
 *   the flows erase the email field before any screenshot is taken, so the IMAGES never contain one;
 *   this script redacts the four supplied values out of every text file before anything is uploaded.
 *
 * A file that cannot be decoded as text is copied only when it is a screenshot. Anything else that is
 * unreadable is left behind rather than shipped unexamined.
 *
 * VALIDATION TOOLING. It reads Maestro's output and the working directory, and writes a copy.
 *
 * Usage: node scripts/phase-m/collect-validation-evidence.mjs <maestro tests dir> <out dir>
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

const [source, out] = process.argv.slice(2);
if (!source || !out) {
  process.stderr.write('usage: collect-validation-evidence.mjs <maestro tests dir> <out dir>\n');
  process.exit(1);
}

/**
 * The values that must never leave this runner.
 *
 * Passwords are included even though nothing is expected to render one: `secureTextEntry` masks a
 * field visually, and a hierarchy dump is not a visual surface. Sorted longest-first so a value that
 * contains another is redacted whole rather than leaving a fragment behind.
 */
const secrets = ['T12_TEST_EMAIL_A', 'T12_TEST_PASSWORD_A', 'T12_TEST_EMAIL_B', 'T12_TEST_PASSWORD_B']
  .map((name) => process.env[name])
  .filter((value) => typeof value === 'string' && value.length >= 4)
  .sort((a, b) => b.length - a.length);

const IMAGE = /\.(?:png|jpg|jpeg)$/iu;
const TEXT = /\.(?:txt|log|json|xml|yaml|yml|html|md|tap)$/iu;
const MAX_BYTES = 8 * 1024 * 1024;

let copied = 0;
let redactions = 0;
let skipped = 0;

function redact(text) {
  let result = text;
  for (const secret of secrets) {
    // A plain split/join: the values are arbitrary strings and building a regex out of one would be
    // both slower and wrong for anything containing a metacharacter.
    const parts = result.split(secret);
    if (parts.length > 1) redactions += parts.length - 1;
    result = parts.join('<REDACTED>');
  }
  return result;
}

function place(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  if (IMAGE.test(from)) {
    copyFileSync(from, to);
    copied += 1;
    return;
  }
  if (!TEXT.test(from)) {
    skipped += 1;
    return;
  }
  writeFileSync(to, redact(readFileSync(from, 'utf8')));
  copied += 1;
}

/**
 * Copy a tree, KEEPING its shape.
 *
 * The `root` argument is the whole repair. This used to recurse with the subdirectory as the base and
 * then compute the destination as `relative(subdirectory, file)`, which threw the directory away and
 * flattened every file to its own basename. Each Maestro run writes a `commands.json` and a
 * `maestro.log`, so every phase after the first silently overwrote the one before it — and the
 * counter still counted each write, which is how the evidence could report 35 files collected while
 * 21 reached the artifact. The files that vanished were exactly the ones that could say where a
 * credential was lost.
 */
function walk(directory, into, root = directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const from = join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(from, into, root);
      continue;
    }
    if (!entry.isFile()) continue;
    if (statSync(from).size > MAX_BYTES) {
      skipped += 1;
      continue;
    }
    // A leading dot on any segment makes the whole subtree HIDDEN, and the artifact uploader drops
    // hidden files by default. Maestro writes its diagnostics under `.maestro/tests/...`, so the very
    // files that explain a failure were being collected and then silently left out of the upload. The
    // segments are un-hidden here rather than relying on an uploader flag, so the evidence survives
    // whatever the packaging step happens to default to.
    const shaped = relative(root, from)
      .split(/[\\/]/u)
      .map((segment) => (segment.startsWith('.') ? `dot-${segment.slice(1)}` : segment))
      .join('/');
    place(from, join(into, shaped));
  }
}

/** Every file actually on disk under a directory, so "collected" can be checked against reality. */
function present(directory) {
  if (!existsSync(directory)) return [];
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const at = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...present(at));
    else if (entry.isFile()) found.push(at);
  }
  return found;
}

// Maestro's `takeScreenshot` writes into the working directory; its debug output goes to its own
// tests directory. Both are collected, and neither is uploaded unredacted.
mkdirSync(out, { recursive: true });
for (const entry of readdirSync(process.cwd(), { withFileTypes: true })) {
  // T-13 adds its own screenshot prefix beside the two Phase-M ones.
  if (entry.isFile() && IMAGE.test(entry.name) && /^(?:t1204|t13|product-root)-/u.test(entry.name)) {
    place(join(process.cwd(), entry.name), join(out, 'screenshots', basename(entry.name)));
  }
}
if (existsSync(source)) walk(source, join(out, 'maestro'));
else writeFileSync(join(out, 'maestro-output-absent.txt'), `${source} did not exist when the evidence was collected.\n`);

writeFileSync(
  join(out, 'REDACTION.txt'),
  `${secrets.length} supplied value(s) were redacted from the text evidence; ${redactions} occurrence(s) replaced.\n` +
    `${copied} file(s) collected, ${skipped} skipped as neither a screenshot nor a readable text file.\n` +
    'Screenshots are safe by a second, independent measure: the flows erase the identity field before\n' +
    'any image is taken, and the harness report carries kinds, booleans and character counts only.\n',
);

process.stdout.write(`collected ${copied} file(s); redacted ${redactions} occurrence(s) of ${secrets.length} supplied value(s); skipped ${skipped}\n`);

// ---------------------------------------------------------------------------------------------
// Completeness. Counting what was WRITTEN is not the same as counting what SURVIVED, and the
// difference is the whole of the defect above: the evidence claimed 35 files while 21 existed. So the
// two numbers are compared here, and every phase directory the run was told to expect must be on
// disk. A missing diagnostic fails this step explicitly rather than being discovered later as an
// absence nobody can explain.
// ---------------------------------------------------------------------------------------------
// The collector's OWN outputs are not evidence it collected, so they are excluded from the count.
// Including them made the two numbers differ by one and reported a complete evidence set as
// incomplete — a gate that cries wolf is worth no more than the silence it replaced.
const SELF_WRITTEN = new Set([
  'REDACTION.txt',
  'COMPLETENESS.txt',
  'maestro-output-absent.txt',
  'ios-auth-validation-identity.txt',
  'ios-recovery-validation-identity.txt',
  'android-recovery-validation-identity.txt',
  't13-phase-results.txt',
]);
const onDisk = present(out).filter((file) => !SELF_WRITTEN.has(basename(file)));
const expected = (process.env.T12_REQUIRED_PHASES ?? '')
  .split(',')
  .map((name) => name.trim())
  .filter((name) => name.length > 0);
const missing = expected.filter((phase) => !onDisk.some((file) => file.split(/[\\/]/u).includes(phase)));
const failures = [];
if (onDisk.length !== copied) failures.push(`collected ${copied} file(s) but ${onDisk.length} reached the evidence directory`);
if (missing.length > 0) failures.push(`no diagnostic output for phase(s): ${missing.join(', ')}`);

writeFileSync(
  join(out, 'COMPLETENESS.txt'),
  `collected=${copied}\nonDisk=${onDisk.length}\nskipped=${skipped}\n` +
    `expectedPhases=${expected.length === 0 ? '(none declared)' : expected.join(',')}\n` +
    `missingPhases=${missing.length === 0 ? '(none)' : missing.join(',')}\n` +
    `result=${failures.length === 0 ? 'COMPLETE' : 'INCOMPLETE'}\n`,
);

if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`evidence incomplete: ${failure}\n`);
  process.exit(1);
}
process.stdout.write(`evidence complete: ${onDisk.length} file(s) on disk, ${expected.length} required phase directory(ies) present\n`);
