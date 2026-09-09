import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  buildCanonicalWorld, EXPECTED_WORLD, FIXTURE_TEXTS, FORBIDDEN_PROVENANCE_TOKENS,
  PROVENANCE, FOCUS_PROVENANCE, THREAD_PROVENANCE, CONTINUITY_PROVENANCE, LF_REDUCER_VERSION,
  NEUTRAL_PROVIDER, NEUTRAL_MODEL, spanOf, threadIdOf,
} from '../scripts/phase-m/canonical-world-fixture.mjs';

// T-12 Phase M — the provider-neutral canonical-world seeder's focused contract.
//
// The seeder writes canonical semantic state to a live project, so the properties that make that
// safe have to be checkable WITHOUT a database: that the fixture is deterministic, that its
// provenance names no real provider, that the executor owns no path that writes a Product table by
// hand, and that the world it describes is the shape the remaining validation items actually need.
//
// Everything here is pure. No database, no network, no Product import.

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (relative) => readFileSync(join(root, relative), 'utf8').replace(/\r\n/gu, '\n');

const SESSION_A = '11111111-2222-4333-8444-555555555555';
const SESSION_B = '66666666-7777-4888-8999-aaaaaaaaaaaa';
const OWNER = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';

const worldA = buildCanonicalWorld({ sessionId: SESSION_A, userId: OWNER });

/** Every identifier the fixture mints, flattened, so collision and determinism are checkable. */
function identifiers(world) {
  const found = [];
  const walk = (value) => {
    if (typeof value === 'string') {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value)) found.push(value);
      return;
    }
    if (Array.isArray(value)) { for (const entry of value) walk(entry); return; }
    if (value && typeof value === 'object') { for (const entry of Object.values(value)) walk(entry); }
  };
  walk(world.exchanges);
  return found;
}

// ---------------------------------------------------------------------------------------------
// Deterministic fixture generation.
// ---------------------------------------------------------------------------------------------

test('the same Session and owner reproduce a byte-identical fixture', () => {
  const again = buildCanonicalWorld({ sessionId: SESSION_A, userId: OWNER });
  assert.equal(JSON.stringify(again.exchanges), JSON.stringify(worldA.exchanges));
  // Not merely equal — derived. A fixture that reached for randomness anywhere would differ here.
  assert.deepEqual(again.thread, worldA.thread);
  assert.deepEqual(again.cu, worldA.cu);
});

test('a different validation Session shares NOT ONE identifier with the previous one', () => {
  // This is what makes a re-run harmless: a failed or repeated seed builds a disjoint world rather
  // than colliding with, or mutating, a Session that already succeeded.
  const worldB = buildCanonicalWorld({ sessionId: SESSION_B, userId: OWNER });
  const a = new Set(identifiers(worldA));
  const shared = identifiers(worldB).filter((id) => a.has(id));
  assert.deepEqual(shared, []);
});

test('Thread identity is the canonical derivation, not an invention of this fixture', () => {
  for (const [name, focusId] of Object.entries(worldA.focus)) {
    assert.equal(worldA.thread[name], threadIdOf(OWNER, focusId));
  }
});

test('every minted identifier is a well-formed v5 UUID and none repeats', () => {
  const all = identifiers(worldA);
  assert.ok(all.length > 0);
  for (const id of all) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  const unitIds = worldA.exchanges.flatMap((e) => [...e.userUnits, ...e.assistantUnits]).map((u) => u.unit_id);
  assert.equal(new Set(unitIds).size, unitIds.length, 'every committed unit id is distinct');
});

test('it refuses to build without both identities', () => {
  for (const bad of [{}, { sessionId: SESSION_A }, { userId: OWNER }, { sessionId: '', userId: OWNER }]) {
    assert.throws(() => buildCanonicalWorld(bad), /requires a sessionId and a userId/u);
  }
});

// ---------------------------------------------------------------------------------------------
// Provenance neutrality.
// ---------------------------------------------------------------------------------------------

test('no provenance value names a real AI provider', () => {
  const values = [...PROVENANCE, ...FOCUS_PROVENANCE, ...THREAD_PROVENANCE, ...CONTINUITY_PROVENANCE, LF_REDUCER_VERSION]
    .filter((value) => typeof value === 'string');
  for (const value of values) {
    for (const token of FORBIDDEN_PROVENANCE_TOKENS) {
      assert.ok(!value.toLowerCase().includes(token), `provenance ${JSON.stringify(value)} names ${token}`);
    }
  }
  // And the provider/model slots are the declared neutral identities, in every layer.
  for (const layer of [PROVENANCE, FOCUS_PROVENANCE, THREAD_PROVENANCE, CONTINUITY_PROVENANCE]) {
    assert.equal(layer[2], NEUTRAL_PROVIDER);
    assert.equal(layer[3], NEUTRAL_MODEL);
  }
  assert.equal(NEUTRAL_PROVIDER, 'PHASE_M_VALIDATION');
  assert.equal(NEUTRAL_MODEL, 'DETERMINISTIC_FIXTURE');
});

test('every provenance value satisfies the live length constraints', () => {
  // `conversation_unit_commit_batches` bounds provider at 64, model at 128 and prompt version at 64,
  // and requires each to be non-blank. A value that failed this would be refused at commit time.
  for (const layer of [PROVENANCE, FOCUS_PROVENANCE, THREAD_PROVENANCE, CONTINUITY_PROVENANCE]) {
    const [evaluator, policy, provider, model, prompt] = layer;
    for (const value of [evaluator, policy, provider, model, prompt]) {
      assert.equal(typeof value, 'string');
      assert.ok(value.trim().length > 0);
    }
    assert.ok(provider.length <= 64);
    assert.ok(model.length <= 128);
    assert.ok(prompt.length <= 64);
  }
});

test('the seeder states in its own output that this is not provider evidence', () => {
  const source = read('scripts/phase-m/seed-canonical-world.mjs');
  assert.match(source, /NOT evidence of AI semantic quality or provider integration/u);
});

// ---------------------------------------------------------------------------------------------
// No direct Product-table mutation path.
// ---------------------------------------------------------------------------------------------

test('the seeder issues no INSERT, UPDATE, DELETE or TRUNCATE of its own', () => {
  // The whole safety claim rests on this: every row exists because a canonical authority created it.
  // Comments and string literals are stripped first so the scan reads statements, not prose.
  for (const file of ['scripts/phase-m/seed-canonical-world.mjs', 'scripts/phase-m/canonical-world-fixture.mjs']) {
    const source = read(file)
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/^\s*\/\/[^\n]*$/gmu, '')
      .replace(/'(?:[^'\\]|\\.)*'/gu, "''")
      .replace(/"(?:[^"\\]|\\.)*"/gu, '""');
    for (const verb of [/\bINSERT\s+INTO\b/iu, /\bUPDATE\s+public\./iu, /\bDELETE\s+FROM\b/iu, /\bTRUNCATE\b/iu, /\bDROP\s+/iu, /\bALTER\s+TABLE\b/iu, /\bGRANT\b/iu, /\bREVOKE\b/iu]) {
      assert.doesNotMatch(source, verb, `${file} must reach a semantic table only through an authority`);
    }
  }
});

test('every database call the seeder makes is a SELECT from a function, or transaction plumbing', () => {
  const source = read('scripts/phase-m/seed-canonical-world.mjs');
  const statements = [...source.matchAll(/(?:client\.query|rows)\(\s*(?:`([^`]*)`|'([^']*)')/gu)]
    .map((match) => (match[1] ?? match[2]).trim().replace(/\s+/gu, ' '));
  assert.ok(statements.length >= 6, `expected the seeder to issue several statements, found ${statements.length}`);
  const ALLOWED = [
    /^SELECT \* FROM public\.[a-z0-9_]+\(/iu,      // a canonical authority, and nothing else
    /^SELECT set_config\('request\.jwt\.claims'/iu,
    /^BEGIN$/iu, /^COMMIT$/iu, /^ROLLBACK$/iu, /^RESET ROLE$/iu, /^SET LOCAL ROLE /iu,
  ];
  for (const statement of statements) {
    assert.ok(ALLOWED.some((pattern) => pattern.test(statement)), `unexpected statement: ${statement}`);
  }
  // Not one statement names a table. Even the optimistic-concurrency token is read through the
  // canonical runtime-context authority, which is what the real application path reads it from.
  assert.doesNotMatch(source.replace(/^\s*(?:\/\/|\*)[^\n]*$/gmu, ''), /FROM public\.(?!\w+\()/u);
});

test('no Product module reaches the Phase-M scripts', () => {
  // The seeder is tooling. If any shipped module imported it, it would stop being tooling.
  const offenders = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory)) {
      if (entry === 'node_modules' || entry === '.expo' || entry === 'dist' || entry === 'build' || entry === 'android' || entry === 'ios') continue;
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) { walk(path); continue; }
      if (!/\.(?:ts|tsx|js|jsx|mjs|cjs)$/u.test(entry)) continue;
      if (readFileSync(path, 'utf8').includes('phase-m/')) offenders.push(path.slice(root.length).replace(/\\/gu, '/'));
    }
  };
  walk(join(root, 'apps'));
  assert.deepEqual(offenders, []);
});

// ---------------------------------------------------------------------------------------------
// Required world-shape coverage.
// ---------------------------------------------------------------------------------------------

test('the fixture describes exactly the declared world shape', () => {
  assert.equal(worldA.exchanges.length, EXPECTED_WORLD.exchanges);
  const units = worldA.exchanges.flatMap((e) => [...e.userUnits, ...e.assistantUnits]);
  assert.equal(units.length, EXPECTED_WORLD.committedUnits);
  // One Session Position per committed CU, so the Live Head is the unit count.
  assert.equal(units.length, EXPECTED_WORLD.liveHead);
  const established = worldA.exchanges
    .flatMap((e) => [...e.userThreads, ...e.assistantThreads])
    .filter((decision) => decision.decision === 'ESTABLISH_THREAD');
  assert.equal(established.length, EXPECTED_WORLD.threads, 'one destination per established Thread');
  assert.equal(new Set(established.map((d) => d.thread_id)).size, EXPECTED_WORLD.threads, 'the destinations are distinct');
  const transitions = worldA.exchanges
    .flatMap((e) => [...e.userLiveFocus, ...e.assistantLiveFocus])
    .filter((entry) => entry.transition);
  assert.equal(transitions.length, EXPECTED_WORLD.liveFocusTransitions);
});

test('the world carries what MOT-03, MOT-04 and RSP-01 each actually need', () => {
  const established = worldA.exchanges.flatMap((e) => e.userThreads).filter((d) => d.decision === 'ESTABLISH_THREAD');
  // MOT-03 travel bands need more than a there-and-back pair of destinations, and MOT-04 needs
  // objects that can sit outside the cull margin — both are a function of destination COUNT.
  assert.ok(established.length >= 3, 'short, medium and long camera travel need at least three destinations');
  // GO_LIVE_AND_LOCATE needs history to be pinned INSIDE rather than at the head.
  assert.ok(EXPECTED_WORLD.liveHead >= 10, 'a pinned TC must be able to sit well inside history');
  // Every destination is reachable as a Live Focus at some Session Position, or it can never be the
  // referent of a Locate.
  const lfRefs = new Set(worldA.exchanges.flatMap((e) => [...e.userLiveFocus, ...e.assistantLiveFocus])
    .filter((entry) => entry.transition).map((entry) => entry.effective_ref));
  for (const decision of established) assert.ok(lfRefs.has(decision.thread_id), 'each destination becomes the Live Focus');
  // RSP-01's Arabic rows need Arabic wording actually committed.
  const arabic = /[؀-ۿ]/u;
  for (const exchange of worldA.exchanges) {
    assert.match(exchange.userText, arabic);
    assert.match(exchange.assistantText, arabic);
  }
});

test('every layer covers exactly the units of its own batch, in the same order', () => {
  // The authority pairs each unit with its focus, thread, lifecycle and Live-Focus decision by
  // position. A layer that drifted would be refused live; catching it here costs nothing.
  for (const exchange of worldA.exchanges) {
    for (const side of ['user', 'assistant']) {
      const ids = exchange[`${side}Units`].map((u) => u.unit_id);
      for (const layer of ['Bundles', 'Threads', 'Lifecycle', 'LiveFocus']) {
        assert.deepEqual(exchange[`${side}${layer}`].map((entry) => entry.unit_id), ids, `${exchange.label} ${side}${layer}`);
      }
    }
  }
});

test('every unit span is a real code-point span of its own source text', () => {
  for (const exchange of worldA.exchanges) {
    for (const [side, text] of [['user', exchange.userText], ['assistant', exchange.assistantText]]) {
      for (const unit of exchange[`${side}Units`]) {
        assert.ok(unit.span_end > unit.span_start, 'a unit spans at least one code point');
        assert.ok(unit.span_end <= Array.from(text).length, 'a unit stays inside its source text');
      }
    }
    // And the spans of one batch do not overlap, which is what makes the ordinals canonical.
    for (const side of ['user', 'assistant']) {
      const spans = [...exchange[`${side}Units`]].sort((a, b) => a.span_start - b.span_start);
      for (let i = 1; i < spans.length; i += 1) assert.ok(spans[i].span_start >= spans[i - 1].span_end, 'spans do not overlap');
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Failure on malformed data.
// ---------------------------------------------------------------------------------------------

test('an excerpt that is not in its source text is refused rather than mis-spanned', () => {
  // The failure this prevents is silent: a wrong span still commits, and produces a Moment whose
  // committed text is not what the fixture meant to say.
  assert.throws(() => spanOf(FIXTURE_TEXTS.E1_USER, 'نص غير موجود'), /fixture excerpt not found/u);
  assert.throws(() => spanOf(FIXTURE_TEXTS.E1_USER, FIXTURE_TEXTS.E1_U1, 2), /fixture excerpt not found/u);
});

test('the seeder refuses to run without an explicit confirmation', () => {
  const source = read('scripts/phase-m/seed-canonical-world.mjs');
  assert.match(source, /refused: pass --confirm/u);
  assert.match(source, /flag\('--confirm'\)/u);
});

test('a failed exchange rolls back whole and stops', () => {
  const source = read('scripts/phase-m/seed-canonical-world.mjs');
  assert.match(source, /await client\.query\('ROLLBACK'\)/u, 'a failure unwinds the whole exchange');
  assert.match(source, /process\.exit\(1\)/u, 'and the seeder stops rather than continuing');
  // One transaction per exchange: turns and their Moments land together or not at all.
  assert.equal((source.match(/await client\.query\('BEGIN'\)/gu) ?? []).length, 1);
  assert.equal((source.match(/await client\.query\('COMMIT'\)/gu) ?? []).length, 1);
});
