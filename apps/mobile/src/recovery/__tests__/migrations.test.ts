/**
 * T-13 M01…M08 — schema versioning and the explicit migration runner.
 *
 * v1 ships no migration, so the runner is proven with an INJECTED chain: the point is that whatever a
 * future version adds, an older record can only arrive at the current one through declared,
 * deterministic steps, and a newer record can never be guessed at.
 */
import {
  PRODUCT_RECOVERY_SCHEMA_VERSION,
  RECOVERY_MIGRATIONS,
  migrateRecoveryRecord,
  type RecoveryMigration,
} from '..';
import { rawRecord } from '../__fixtures__/records';

const lift = (from: number, to: number, mark: string): RecoveryMigration => ({
  from,
  to,
  migrate: (record) => ({ ...record, schemaVersion: to, [mark]: true }),
});

describe('M01…M04 — the three cases stay three', () => {
  it('M01 — v1 carries no migration, and a current record passes through untouched', () => {
    expect(RECOVERY_MIGRATIONS).toEqual([]);
    const raw = rawRecord();
    const outcome = migrateRecoveryRecord(raw);
    expect(outcome).toEqual({ ok: true, record: raw, applied: [] });
    if (outcome.ok) expect(outcome.record).toBe(raw);
  });

  it('M02 — a newer schema is refused as incompatible, never decoded on a guess', () => {
    const outcome = migrateRecoveryRecord({ ...rawRecord(), schemaVersion: PRODUCT_RECOVERY_SCHEMA_VERSION + 1 });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('INCOMPATIBLE_SCHEMA');
  });

  it('M03 — an older schema with no declared step is refused, never coerced', () => {
    const outcome = migrateRecoveryRecord({ ...rawRecord(), schemaVersion: 1 }, [], 2);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('NO_MIGRATION_PATH');
  });

  it('M04 — a payload without an integer schema version is malformed', () => {
    for (const bad of [{}, { schemaVersion: 0 }, { schemaVersion: '1' }, { schemaVersion: 1.5 }, null, 'text', []]) {
      const outcome = migrateRecoveryRecord(bad);
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.reason).toBe('MALFORMED_PAYLOAD');
    }
  });
});

describe('M05…M08 — a declared chain is followed deterministically, and nothing else is', () => {
  it('M05 — a chain of explicit steps is applied in order, once each, and reports what it applied', () => {
    const chain = [lift(2, 3, 'two'), lift(1, 2, 'one')];
    const outcome = migrateRecoveryRecord({ ...rawRecord(), schemaVersion: 1 }, chain, 3);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error('unreachable');
    expect(outcome.applied).toEqual([1, 2]);
    expect(outcome.record.schemaVersion).toBe(3);
    expect(outcome.record.one).toBe(true);
    expect(outcome.record.two).toBe(true);
  });

  it('M06 — the same input always produces the same output: the runner reads no clock and no environment', () => {
    const chain = [lift(1, 2, 'one')];
    const first = migrateRecoveryRecord({ ...rawRecord(), schemaVersion: 1 }, chain, 2);
    const second = migrateRecoveryRecord({ ...rawRecord(), schemaVersion: 1 }, chain, 2);
    expect(first).toEqual(second);
  });

  it('M07 — a step that does not land on the version it declared is refused, and nothing after it runs', () => {
    const lying: RecoveryMigration = { from: 1, to: 2, migrate: (record) => ({ ...record, schemaVersion: 7 }) };
    const outcome = migrateRecoveryRecord({ ...rawRecord(), schemaVersion: 1 }, [lying, lift(2, 3, 'two')], 3);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('NO_MIGRATION_PATH');
  });

  it('M08 — a chain that revisits a version terminates as a refusal, never as an infinite loop', () => {
    const cycle: RecoveryMigration[] = [
      { from: 1, to: 2, migrate: (record) => ({ ...record, schemaVersion: 2 }) },
      { from: 2, to: 1, migrate: (record) => ({ ...record, schemaVersion: 1 }) },
    ];
    const outcome = migrateRecoveryRecord({ ...rawRecord(), schemaVersion: 1 }, cycle, 3);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('NO_MIGRATION_PATH');
  });
});
