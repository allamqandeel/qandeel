import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canTransitionHypothesis } from './hypothesis-lifecycle';
import { HYPOTHESIS_STATUSES, type HypothesisStatus } from './hypothesis.types';

// The canonical lifecycle graph is FROZEN. This spec is the drift guard for
// both halves of it: the TypeScript early-validation mirror, and the migration
// 0036 PostgreSQL policy primitive that is authoritative at mutation time. The
// executable database proof lives in database/verify-migration-0036.mjs against
// real PostgreSQL; this keeps the two statements of the graph identical without
// infrastructure.
const CANONICAL_GRAPH: Readonly<Record<HypothesisStatus, readonly HypothesisStatus[]>> = {
  CANDIDATE: ['ACTIVE'],
  ACTIVE: ['SUPPORTED', 'MIXED', 'WEAK', 'REJECTED', 'RETIRED'],
  SUPPORTED: ['MIXED', 'WEAK', 'REJECTED', 'RETIRED'],
  MIXED: ['SUPPORTED', 'WEAK', 'REJECTED', 'RETIRED'],
  WEAK: ['ACTIVE', 'MIXED', 'REJECTED', 'RETIRED'],
  REJECTED: ['REOPENED'],
  RETIRED: ['REOPENED'],
  REOPENED: ['ACTIVE'],
};

const migration = readFileSync(
  join(__dirname, '../../../../database/migrations/0036_hypothesis_lifecycle_completion_v1.sql'), 'utf8',
);

// The exact policy primitive body, isolated so no other CASE in the migration
// can satisfy the parse below.
function policyBody(): string {
  const start = migration.indexOf('CREATE FUNCTION public.hypothesis_lifecycle_transition_allowed_v1');
  expect(start).toBeGreaterThan(-1);
  const end = migration.indexOf('END;$$;', start);
  expect(end).toBeGreaterThan(start);
  return migration.slice(start, end);
}

function sqlGraph(): Record<string, string[]> {
  const body = policyBody();
  const graph: Record<string, string[]> = {};
  for (const [, from, single, list] of body.matchAll(
    /WHEN\s+'([A-Z_]+)'\s+THEN\s+p_to_status\s+(?:=\s+'([A-Z_]+)'|IN\s+\(([^)]*)\))/gu,
  )) {
    graph[from] = single
      ? [single]
      : (list ?? '').split(',').map((value) => value.trim().replace(/'/gu, ''));
  }
  return graph;
}

describe('canonical Hypothesis lifecycle graph', () => {
  it('states exactly the frozen status vocabulary with no CONFIRMED status', () => {
    expect([...HYPOTHESIS_STATUSES]).toEqual([
      'CANDIDATE', 'ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK', 'REJECTED', 'RETIRED', 'REOPENED',
    ]);
    expect(HYPOTHESIS_STATUSES).not.toContain('CONFIRMED' as never);
  });

  it('keeps the TypeScript transition graph byte-for-byte canonical over every ordered pair', () => {
    for (const from of HYPOTHESIS_STATUSES) {
      for (const to of HYPOTHESIS_STATUSES) {
        expect(canTransitionHypothesis(from, to)).toBe(CANONICAL_GRAPH[from].includes(to));
      }
    }
  });

  it('forbids every self-transition', () => {
    for (const status of HYPOTHESIS_STATUSES) expect(canTransitionHypothesis(status, status)).toBe(false);
  });

  it('treats REJECTED, RETIRED and REOPENED exactly as the canonical graph does', () => {
    expect(canTransitionHypothesis('REJECTED', 'REOPENED')).toBe(true);
    expect(canTransitionHypothesis('RETIRED', 'REOPENED')).toBe(true);
    expect(canTransitionHypothesis('REOPENED', 'ACTIVE')).toBe(true);
    for (const forbidden of ['ACTIVE', 'SUPPORTED', 'MIXED', 'WEAK', 'RETIRED'] as HypothesisStatus[]) {
      expect(canTransitionHypothesis('REJECTED', forbidden)).toBe(false);
    }
    for (const forbidden of ['SUPPORTED', 'MIXED', 'WEAK', 'REJECTED', 'RETIRED'] as HypothesisStatus[]) {
      expect(canTransitionHypothesis('REOPENED', forbidden)).toBe(false);
    }
  });

  it('mirrors the migration 0036 PostgreSQL policy primitive for every ordered pair', () => {
    const graph = sqlGraph();
    expect(Object.keys(graph).sort()).toEqual([...HYPOTHESIS_STATUSES].sort());
    for (const from of HYPOTHESIS_STATUSES) {
      for (const to of HYPOTHESIS_STATUSES) {
        expect(graph[from].includes(to)).toBe(canTransitionHypothesis(from, to));
      }
    }
  });

  it('keeps the database policy primitive pure, internal and free of any semantic threshold', () => {
    const body = policyBody();
    expect(body).toMatch(/IMMUTABLE PARALLEL SAFE SET search_path=''/u);
    // No table read, no caller-controlled authority, no side effect.
    expect(body).not.toMatch(/\b(?:SELECT|INSERT|UPDATE|DELETE|auth\.uid)\b/u);
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.hypothesis_lifecycle_transition_allowed_v1\(text,text\) FROM PUBLIC,anon,authenticated,service_role;/u,
    );
    expect(migration).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.hypothesis_lifecycle_transition_allowed_v1/u);
  });

  it('introduces no automatic semantic lifecycle rule anywhere in migration 0036', () => {
    // The ONLY automatic transition added is the generated CANDIDATE -> ACTIVE
    // admission. Nothing counts Evidence, reads Confidence or applies a band.
    const transitionTargets = [...migration.matchAll(
      /transition_hypothesis_core_v1\([^)]*'([A-Z_]+)',\s*'SYSTEM_GENERATION_ACTIVATION'\)/gu,
    )].map((match) => match[1]);
    expect(transitionTargets).toEqual(['ACTIVE']);
    const executable = migration.replace(/^\s*--.*$/gmu, '');
    expect(executable).not.toMatch(/confidence_evaluations|post_response_confidence_batch_items/iu);
    expect(executable).not.toMatch(/(?:cardinality|array_length|count)\s*\(\s*(?:supporting_evidence_ids|contradicting_evidence_ids)/iu);
    // The single Hypothesis status write in the migration assigns the caller's
    // requested status, never a literal SUPPORTED / MIXED / WEAK / REJECTED /
    // RETIRED / REOPENED chosen by a rule inside the database.
    expect([...executable.matchAll(/SET\s+status\s*=\s*([^,\s]+)/gu)].map((match) => match[1])).toEqual(['p_status']);
  });
});