// T-03B2b1 - separate-process replay of the Canonical Home Placement Engine v1
// golden vectors and the 100 / 1,000 / 10,000 Thread append proofs.
//
// Spawned by tests/canonical-home-placement-engine-contract.test.mjs under
// `node -r ts-node/register` (TS_NODE_PROJECT=apps/api/tsconfig.json,
// transpile-only; tsc gates the types separately). Writes ONE JSON report to
// stdout and nothing else. No repository file is touched.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const engine = require('../apps/api/src/thread-establishment/home-placement/home-placement-engine');
const scenario = require('../apps/api/src/thread-establishment/home-placement/home-placement-scenario');
const vectors = require('../apps/api/src/thread-establishment/home-placement/home-placement-vectors');
const { MAX_ATTEMPTS, MIN_HOME_SEPARATION } = require('../apps/api/src/thread-establishment/home-placement/home-placement.types');

const bigints = (_key, value) => (typeof value === 'bigint' ? `${value}n` : value);
const same = (left, right) => JSON.stringify(left, bigints) === JSON.stringify(right, bigints);

const report = { ok: true, platform: process.platform, node: process.version, vectors: [], stress: [] };

for (const vector of vectors.CANONICAL_HOME_PLACEMENT_GOLDEN_VECTORS) {
  const placed = engine.placeCanonicalHome(vector.request);
  const matched = same(placed, vector.expected);
  if (!matched) report.ok = false;
  report.vectors.push({ id: vector.id, matched, x: String(placed.x), y: String(placed.y), attempt: placed.attempt });
}

for (const golden of vectors.CANONICAL_HOME_PLACEMENT_STRESS_GOLDENS) {
  const started = Date.now();
  const run = scenario.runStressScenario(golden.threads);
  const elapsedMs = Date.now() - started;

  // Uniqueness and exact pairwise separation, each Home against every earlier Home.
  const index = new engine.SeparationIndex();
  const seen = new Set();
  let unique = true;
  let separated = true;
  for (const committed of run.world) {
    const key = `${committed.x}\t${committed.y}`;
    if (seen.has(key)) unique = false;
    seen.add(key);
    if (!index.isAdmissible(committed)) separated = false;
    index.insert(committed);
  }
  // Brute-force spot check of the separation index on a sample.
  for (let position = 0; position < run.world.length; position += 997) {
    const earlier = run.world.slice(0, position);
    if (!earlier.every((existing) => engine.chebyshevDistance(run.world[position], existing) >= MIN_HOME_SEPARATION)) separated = false;
  }
  // Zero movement: replaying a placement against the world as it then stood (presented reversed) reproduces it exactly.
  const step = golden.threads >= 10 ? golden.threads / 10 : 1;
  let replayed = 0;
  let replayMismatch = 0;
  for (let position = 0; position < golden.threads; position += step) {
    const prefix = run.world.slice(0, position);
    const again = engine.placeCanonicalHome({
      userWorldId: scenario.STRESS_USER_WORLD_ID,
      newThreadId: scenario.stressThreadId(position),
      origin: scenario.stressOrigin(position, prefix),
      existingHomes: [...prefix].reverse(),
    });
    replayed += 1;
    if (!same(again, run.placements[position])) replayMismatch += 1;
  }
  const worldFingerprint = engine.fingerprintWorld(run.world);
  const entry = {
    threads: golden.threads,
    placed: run.world.length,
    worldFingerprint,
    expectedWorldFingerprint: golden.worldFingerprint,
    fingerprintMatched: worldFingerprint === golden.worldFingerprint,
    maxAttempt: run.maxAttempt,
    expectedMaxAttempt: golden.maxAttempt,
    withinMaxAttempts: run.maxAttempt < MAX_ATTEMPTS,
    unique,
    separated,
    replayed,
    replayMismatch,
    originCounts: run.originCounts,
    elapsedMs,
  };
  if (run.world.length !== golden.threads || !entry.fingerprintMatched || run.maxAttempt !== golden.maxAttempt || !unique || !separated || replayMismatch > 0) report.ok = false;
  report.stress.push(entry);
}

process.stdout.write(JSON.stringify(report));
