// QAN-INF-03 - the verifier-hazard detectors.
//
// Seven defect classes that a real-PostgreSQL verifier can carry while looking
// completely correct, and that no unit test on a host without PostgreSQL can
// find. Every one of them cost this repository at least one full API CI round
// during I-06A; between them they cost six.
//
// ## What this is NOT
//
// Not a proof that a verifier is correct - nothing static can promise that. Each
// detector targets ONE shape with a known, named failure, and each was
// calibrated against every verifier this repository already has: a detector that
// fires on healthy historical code is worse than no detector, because the next
// author learns to ignore the gate.
//
// ## How to add one
//
// Add the rule, then add its recorded defect to the anti-vacuity half of
// `database/tests/verifier-hazard-contract-v1.test.mjs`, then run the contract:
// it fails if the new rule fires on any existing verifier, and it fails if the
// rule does not catch the defect it was written for. A rule that can do neither
// is not a rule.
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Blanks comments while PRESERVING every line and column.
 *
 * Deleting them would shift every line number after the first block comment, and
 * a finding that points at the wrong line is a finding nobody acts on.
 */
export function withoutComments(source) {
  const blank = (match) => match.replace(/[^\n]/gu, ' ');
  return source.replace(/\r\n/gu, '\n').replace(/\/\*[\s\S]*?\*\//gu, blank).replace(/^([^\n]*?)\/\/[^\n]*$/gmu, (line, code) => code + blank(line.slice(code.length)));
}

/** Every quoted span that reads like SQL, with the offset it started at. */
function sqlLiterals(text) {
  const found = [];
  for (const match of text.matchAll(/`([^`]*)`|'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/gu)) {
    const body = match[1] ?? match[2] ?? match[3] ?? '';
    if (/\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER)\b/u.test(body)) found.push({ body, at: match.index });
  }
  return found;
}

const lineOf = (text, offset) => text.slice(0, offset).split('\n').length;

/**
 * A call into the runtime being proven: a helper wrapper, or a stored function
 * invoked directly. Plain DML is deliberately NOT this - a best-effort teardown
 * DELETE that swallows its error is an established idiom here and breaks
 * nothing, while a swallowed COMMAND leaves the transaction aborted and turns
 * every later statement in that transaction into 25P02.
 */
const RUNTIME_CALL = /\brt\.\w+\(|SELECT\s+(?:\*\s+FROM\s+)?(?:public\.)?\w+_v\d+\s*\(/u;

/**
 * Columns whose value is written once, when the row is created.
 *
 * `now()` is the TRANSACTION timestamp, so an UPDATE that re-sets one of these
 * to `now()` inside the transaction that inserted the row writes back the value
 * that is already there: an immutability trigger sees no change and correctly
 * allows it, and the probe proves nothing. A lifecycle terminus - `ended_at`,
 * `closed_at`, `expires_at` - starts NULL, so `now()` is a real change there and
 * is not this hazard.
 */
const CREATION_STAMP = /\b(?:created_at|updated_at|committed_at|established_at|registered_at|occurred_at|measured_at|born_at)\b/u;

const INSTANT_COLUMN = /\b\w+\.(?:occurred_at|established_at|created_at|committed_at|updated_at|born_at|closed_at|registered_at|joined_at|ended_at|measured_at)\b/u;

/** One finding. `hazard` is the class, `line` is 1-based in the ORIGINAL file. */
const finding = (hazard, file, line, detail) => ({ hazard, file, line, detail });

// ---------------------------------------------------------------- H1 .. H4
function transactionTimestamps(file, text) {
  const found = [];
  for (const { body, at } of sqlLiterals(text)) {
    for (const match of body.matchAll(/SET\s+(?:\w+\.)?(\w+)\s*=\s*now\(\)(\s*[-+]\s*interval)?/giu)) {
      if (match[2] || !CREATION_STAMP.test(match[1])) continue;
      found.push(finding('H1-transaction-timestamp', file, lineOf(text, at),
        `SET ${match[1]} = now() writes back the transaction timestamp the row already carries; use clock_timestamp() or explicit arithmetic`));
    }
  }
  return found;
}

function swallowedErrors(file, text) {
  const found = [];
  for (const match of text.matchAll(/await\s+([\s\S]{0,200}?)\.catch\(/gu)) {
    const call = match[1];
    if (!RUNTIME_CALL.test(call) || /SAVEPOINT/u.test(call)) continue;
    found.push(finding('H2-aborted-transaction', file, lineOf(text, match.index),
      'a refusal swallowed with .catch leaves the transaction ABORTED and every later statement fails 25P02; use the savepoint-taking rejected() helper'));
  }
  for (const match of text.matchAll(/try\s*\{([\s\S]{0,400}?)\}\s*catch/gu)) {
    if (!RUNTIME_CALL.test(match[1]) || /SAVEPOINT/u.test(match[1])) continue;
    if (/ROLLBACK|SAVEPOINT/u.test(text.slice(match.index, match.index + 900))) continue;
    found.push(finding('H2-aborted-transaction', file, lineOf(text, match.index),
      'an expected refusal caught without a savepoint leaves the transaction ABORTED'));
  }
  return found;
}

function timestampPrecision(file, text) {
  const found = [];
  const aliases = new Map();
  for (const { body, at } of sqlLiterals(text)) {
    for (const match of body.matchAll(/(\w+\.\w+)(::text)?\s+(?:AS\s+)?"(\w+)"/gu)) {
      if (match[2] || !INSTANT_COLUMN.test(match[1])) continue;
      aliases.set(match[3], { column: match[1], at });
    }
  }
  for (const [alias, { column, at }] of aliases) {
    const reSent = new RegExp(`[\\[,]\\s*\\w*\\.?${alias}\\b|\\b${alias}\\s*[,\\]]`, 'u');
    if (!reSent.test(text)) continue;
    found.push(finding('H3-timestamp-precision', file, lineOf(text, at),
      `${column} read as "${alias}" and sent back: a timestamptz becomes a JavaScript Date with MILLISECOND precision, so clock_timestamp() microseconds are silently truncated; select it as ::text`));
  }
  return found;
}

/**
 * A large literal asserted against a running fixture total.
 *
 * A small literal is a semantic cardinality - "both commands were recorded",
 * "all three history rows survived" - and the existing corpus uses those
 * correctly. A large one is almost always a total the verifier itself maintains,
 * and the next scenario that adds a fixture makes it wrong in a way that reads
 * as a MIGRATION failure: I-06A asserted 4 where its own new cross-pairing
 * fixtures had made the answer 7, and spent CI round #673 on it.
 *
 * The threshold is the largest literal the existing corpus uses, plus one. That
 * is deliberately a calibration rather than a principle: the shape is identical
 * at 3, and `verify-migration-0097.mjs` carries one that is correct today, so a
 * stricter rule would fail healthy historical code and teach the next author to
 * ignore this gate. The scope is likewise narrow - `count(` of a relation, not
 * `.length` of a resolver result, which genuinely is a semantic cardinality.
 */
export const MAGIC_COUNT_THRESHOLD = 4;

function magicCounts(file, text) {
  const found = [];
  text.split('\n').forEach((line, index) => {
    const match = /assert\.equal\(\s*(?:Number\()?\s*await\s+count\([\s\S]{0,160}?,\s*(\d+)\s*[,)]/u.exec(line);
    if (match && Number(match[1]) >= MAGIC_COUNT_THRESHOLD) {
      found.push(finding('H4-magic-fixture-count', file, index + 1,
        `expected count ${match[1]} is a running fixture total, not a semantic cardinality; snapshot the count before the section and assert the delta`));
    }
  });
  return found;
}

// ---------------------------------------------------------------- H5 .. H6
/** Signature and body regions of every function one migration declares. */
function migrationRegions(sql) {
  const regions = new Map();
  for (const match of sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(\w+)\(/gu)) {
    const open = sql.indexOf('AS $$', match.index);
    if (open < 0) continue;
    const end = sql.indexOf('$$;', open + 5);
    regions.set(match[1], { signature: sql.slice(match.index, open), body: sql.slice(open + 5, end < 0 ? undefined : end) });
  }
  return regions;
}

/**
 * H5 and H6, which are two halves of the same probe.
 *
 * `pg_get_functiondef` does NOT return the migration's text. It regenerates the
 * signature in PostgreSQL's own canonical form - one line, single spaces,
 * `timestamp with time zone` where the migration wrote `timestamptz` - and only
 * the BODY comes back verbatim. So a weakening probe anchored on the migration's
 * line wrapping matches nothing, recreates the function unchanged, and then
 * reports that the canonical contract ACCEPTED a weakening that was never made.
 * That defect alone cost CI rounds #674 and #675.
 *
 * The second half is what makes the first survivable: bind the mutation to a
 * name and prove it CHANGED the text. An inline `q(definition.replace(...))` has
 * nowhere to put that proof, so it is refused outright.
 */
function functiondefProbes(file, text, migration) {
  const found = [];
  const definitions = new Set();
  for (const match of text.matchAll(/(?:const|let)\s+(\w+)\s*=\s*\(await rows\(\s*[`'"]SELECT pg_get_functiondef/gu)) definitions.add(match[1]);
  for (const match of text.matchAll(/(?:const|let)\s*\{\s*(\w+)[^}]*\}\s*=\s*[\s\S]{0,80}?pg_get_functiondef/gu)) definitions.add(match[1]);
  if (definitions.size === 0) return found;

  const regions = migration ? migrationRegions(migration) : new Map();
  for (const name of definitions) {
    const inline = new RegExp(`\\bq\\(\\s*${name}\\s*\\n?\\s*\\.replace\\(`, 'gu');
    const inlined = [...text.matchAll(inline)];
    for (const match of inlined) {
      found.push(finding('H6-unproven-mutation', file, lineOf(text, match.index),
        `the weakening of ${name} is applied inline, so nothing proves it changed the text; bind it to a name and assert.notEqual it against the pristine definition`));
    }
    const mutations = [...text.matchAll(new RegExp(`\\b${name}\\b\\s*\\n?\\s*\\.replace\\(\\s*('(?:[^'\\\\]|\\\\.)*')`, 'gu'))];
    for (const mutation of mutations) {
      const anchor = mutation[1].slice(1, -1).replace(/\\n/gu, '\n').replace(/\\'/gu, "'").replace(/\\\\/gu, '\\');
      if (!migration) continue;
      let placed = null;
      for (const [fn, region] of regions) {
        if (region.body.includes(anchor)) { placed = 'body'; break; }
        if (region.signature.includes(anchor)) { placed = `signature of ${fn}`; break; }
      }
      if (placed === null) {
        found.push(finding('H5-functiondef-anchor', file, lineOf(text, mutation.index),
          `the ${name} anchor ${JSON.stringify(anchor.slice(0, 60))} matches no text in the migration, so the weakening silently matches nothing`));
      } else if (placed !== 'body') {
        found.push(finding('H5-functiondef-anchor', file, lineOf(text, mutation.index),
          `the ${name} anchor is taken from the ${placed}, which pg_get_functiondef REGENERATES in its own canonical form; anchor on the canonical text or on the body`));
      }
    }
    // The inline form is already reported above, and says the same thing more
    // precisely; reporting both would make one defect read as two.
    if (inlined.length === 0 && mutations.length > 0 && !new RegExp(`assert\\.notEqual\\([\\s\\S]{0,120}?\\b${name}\\b`, 'u').test(text)) {
      found.push(finding('H6-unproven-mutation', file, lineOf(text, mutations[0].index),
        `nothing asserts that the weakening of ${name} changed the text; a mutation that matched nothing reads as "the contract accepted a weakening"`));
    }
  }
  return found;
}

// ---------------------------------------------------------------------- H7
/**
 * A shared helper that opens a SAVEPOINT must say so when it cannot.
 *
 * PostgreSQL answers 25P01 for SAVEPOINT outside a transaction block, and a
 * verifier section that commits as it goes is in autocommit - which is exactly
 * how CI round #676 ended, with a message about savepoints that said nothing
 * about the caller's transaction state.
 */
function transactionContextHelpers(file, text) {
  if (/^verify-/u.test(file)) return [];
  if (!/\bSAVEPOINT\b/u.test(text)) return [];
  if (/25P01|open transaction|transaction block/iu.test(text)) return [];
  return [finding('H7-transaction-context', file, lineOf(text, text.indexOf('SAVEPOINT')),
    'this helper opens a SAVEPOINT but never says what a caller in autocommit should do; name the requirement in the diagnostic')];
}

// -------------------------------------------------------------------- entry
/** Every hazard in one verifier or support module. */
export function inspectVerifier(file, source, migration = null) {
  const text = withoutComments(source);
  return [
    ...transactionTimestamps(file, text),
    ...swallowedErrors(file, text),
    ...timestampPrecision(file, text),
    ...magicCounts(file, text),
    ...functiondefProbes(file, text, migration),
    ...transactionContextHelpers(file, text),
  ];
}

/** Every hazard in the whole `database/` directory of one repository root. */
export function inspectRepository(root) {
  const directory = join(root, 'database');
  const migrations = join(directory, 'migrations');
  const available = readdirSync(migrations).filter((name) => name.endsWith('.sql'));
  const findings = [];
  for (const file of readdirSync(directory).filter((name) => name.endsWith('.mjs')).sort()) {
    const number = /^verify-migration-(\d{4})\.mjs$/u.exec(file)?.[1];
    const paired = number ? available.find((name) => name.startsWith(`${number}_`)) : null;
    findings.push(...inspectVerifier(file, readFileSync(join(directory, file), 'utf8'),
      paired ? readFileSync(join(migrations, paired), 'utf8').replace(/\r\n/gu, '\n') : null));
  }
  return findings;
}

// Run it directly - `npm run verify:db:hazards` - to get the same answer the
// contract gets, without waiting for the whole database test suite.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const findings = inspectRepository(resolve(process.argv[2] ?? process.cwd()));
  for (const found of findings) console.log(`${found.hazard}  ${found.file}:${found.line}  ${found.detail}`);
  console.log(`${findings.length} finding(s)`);
  process.exit(findings.length === 0 ? 0 : 1);
}
