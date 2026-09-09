/**
 * T-12 Phase M — the preconditions a cloud validation job must satisfy BEFORE it builds anything.
 *
 * A build that starts without them does not fail; it succeeds and produces an artifact that proves
 * nothing, which is worse. `app.config.js` leaves a missing value as `null` on purpose so the bundle
 * fails closed at runtime rather than pointing somewhere wrong — but a job that discovers that on a
 * phone has already spent an hour. This runs first, in seconds, and says exactly what is missing.
 *
 * VALIDATION TOOLING. It reads the mobile manifest and the environment, and writes nothing.
 *
 * Every diagnostic here reports SHAPES — a scheme, a prefix, a length, a boolean — and never a value.
 * The identity checks in particular run in a job that holds four credentials in its environment, and
 * an error message that echoed one would put it in a public log.
 *
 * Usage:
 *   node scripts/phase-m/assert-validation-preconditions.mjs entry product
 *   node scripts/phase-m/assert-validation-preconditions.mjs entry validation
 *   node scripts/phase-m/assert-validation-preconditions.mjs configuration
 *   node scripts/phase-m/assert-validation-preconditions.mjs identities
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const problems = [];
const notes = [];

const fail = (message) => problems.push(message);
const note = (message) => notes.push(message);

const PRODUCT_ENTRY = 'expo-router/entry';
const VALIDATION_ENTRY = 'src/integration/__validation__/validation-entry.tsx';

function assertEntry(expected) {
  const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('apps/mobile/package.json', root)), 'utf8'));
  const wanted = expected === 'product' ? PRODUCT_ENTRY : VALIDATION_ENTRY;
  if (manifest.main !== wanted) {
    fail(`this job builds the ${expected.toUpperCase()} root, so "main" must be ${JSON.stringify(wanted)} — found ${JSON.stringify(manifest.main)}`);
    return;
  }
  note(`entry: ${expected.toUpperCase()} — main=${JSON.stringify(manifest.main)}`);
  if (expected === 'product') {
    note('this artifact mounts NO validation harness, so nothing observed in it can close QAN-BL-T12-04');
  } else {
    note('this artifact mounts NO Product root, so nothing observed in it may be recorded against MOT-03, MOT-04 or RSP-01');
  }
}

/** A https origin with no trailing slash, no path of its own beyond a base path, and no credential. */
function assertOrigin(name, value) {
  if (!value) {
    fail(`${name} is empty. The build would embed null and fail closed at runtime.`);
    return;
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${name} is not a URL (${value.length} characters).`);
    return;
  }
  // Cleartext is refused outright: a Release artifact that talks HTTP would carry the credential
  // exchange in the open, and no Product loopback exception exists or is authorized.
  if (url.protocol !== 'https:') fail(`${name} must be https, found ${url.protocol}`);
  if (value.endsWith('/')) fail(`${name} must not end with a trailing slash`);
  if (url.username !== '' || url.password !== '') fail(`${name} carries credentials in the URL`);
  if (url.search !== '' || url.hash !== '') fail(`${name} must be an origin plus an optional base path, with no query or fragment`);
  note(`${name}: ${url.protocol}//${url.hostname.replace(/^[^.]+/u, '<host>')}${url.pathname === '/' ? '' : url.pathname}`);
}

function assertConfiguration() {
  assertOrigin('QANDEEL_API_BASE_URL', process.env.QANDEEL_API_BASE_URL);
  assertOrigin('QANDEEL_SUPABASE_URL', process.env.QANDEEL_SUPABASE_URL);

  const key = process.env.QANDEEL_SUPABASE_PUBLIC_KEY ?? '';
  if (key === '') {
    fail('QANDEEL_SUPABASE_PUBLIC_KEY is empty. The build would embed null and fail closed at runtime.');
  } else if (key.startsWith('sb_secret_')) {
    // The one refusal that matters more than a build: a secret key in `extra` ships inside the binary
    // and is readable by anyone who has it. The runtime refuses it too; refusing here means it never
    // reaches an artifact at all.
    fail('QANDEEL_SUPABASE_PUBLIC_KEY is a SECRET key. Everything in `extra` ships inside the bundle. Use the PUBLISHABLE key.');
  } else if (/^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./u.test(key)) {
    // A legacy JWT key. Its role sits in the payload, so a service_role key is indistinguishable from
    // an anon one by prefix alone, and this is exactly the case the runtime's FORBIDDEN_SECRET guard
    // exists for. Decode only the role claim; nothing else is read and nothing is printed.
    let role = 'unknown';
    try {
      role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role ?? 'unknown';
    } catch {
      role = 'undecodable';
    }
    if (role !== 'anon') fail(`QANDEEL_SUPABASE_PUBLIC_KEY is a legacy JWT whose role is "${role}". Only an anon/publishable key may ship in a bundle.`);
    else note(`QANDEEL_SUPABASE_PUBLIC_KEY: legacy anon JWT, ${key.length} characters`);
  } else {
    note(`QANDEEL_SUPABASE_PUBLIC_KEY: ${key.startsWith('sb_publishable_') ? 'publishable' : 'unrecognised prefix'}, ${key.length} characters`);
  }

  // The Product artifact and the auth-validation artifact must target ONE Supabase project and ONE
  // API origin, or the two identities do not exist for the verifier and nothing is proved.
  note('both artifacts in this run are built from these same three values');
}

function assertIdentities() {
  const required = ['T12_TEST_EMAIL_A', 'T12_TEST_PASSWORD_A', 'T12_TEST_EMAIL_B', 'T12_TEST_PASSWORD_B'];
  const missing = required.filter((name) => (process.env[name] ?? '') === '');
  if (missing.length > 0) {
    fail(`QAN-BL-T12-04 needs two identities in the SAME Supabase project as the API's verifier. Missing: ${missing.join(', ')}`);
    return;
  }
  if (process.env.T12_TEST_EMAIL_A === process.env.T12_TEST_EMAIL_B) {
    // Identity replacement is the claim; one identity signing in twice demonstrates nothing about it.
    fail('T12_TEST_EMAIL_A and T12_TEST_EMAIL_B are the same identity. Claim T12-04.5 needs two.');
    return;
  }
  note(`identities: two distinct, emails ${process.env.T12_TEST_EMAIL_A.length} and ${process.env.T12_TEST_EMAIL_B.length} characters`);
}

const mode = process.argv[2];
if (mode === 'entry') {
  const which = process.argv[3];
  if (which !== 'product' && which !== 'validation') {
    fail('usage: assert-validation-preconditions.mjs entry <product|validation>');
  } else {
    assertEntry(which);
  }
} else if (mode === 'configuration') {
  assertConfiguration();
} else if (mode === 'identities') {
  assertIdentities();
} else {
  fail('usage: assert-validation-preconditions.mjs <entry product|entry validation|configuration|identities>');
}

for (const line of notes) process.stdout.write(`ok   ${line}\n`);
for (const line of problems) process.stderr.write(`STOP ${line}\n`);
process.exit(problems.length === 0 ? 0 : 1);
