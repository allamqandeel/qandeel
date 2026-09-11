/**
 * T-13 §14 — schema versioning, and the ONE way an older record may become a current one.
 *
 * Three cases, kept apart because they mean different things:
 *
 *   current version    decoded strictly by `decodeProductRecoveryRecord`; nothing happens here;
 *   older version      admitted ONLY through an explicit, deterministic, tested migration step for
 *                      exactly that version — never through generic coercion, field guessing or an
 *                      implicit default that could change what the reader's viewpoint means;
 *   newer version      refused as incompatible. A build cannot know what a future field means, and
 *                      guessing would present a viewpoint the reader never committed.
 *
 * v1 is the first schema, so the migration table is EMPTY. The runner exists so that the next version
 * has one deterministic path and one test for it rather than an ad-hoc repair in a decoder. It is a
 * pure function of its inputs: no clock, no environment, no storage.
 */
import { isPlainRecord } from '../../state';
import { PRODUCT_RECOVERY_SCHEMA_VERSION } from './recovery-record';

/** One explicit step from one exact version to the next. `migrate` is pure and total for its version. */
export interface RecoveryMigration {
  readonly from: number;
  readonly to: number;
  migrate(record: Readonly<Record<string, unknown>>): Record<string, unknown>;
}

/** The migrations this build carries. v1 is the first schema, so there are none. */
export const RECOVERY_MIGRATIONS: readonly RecoveryMigration[] = Object.freeze([]);

export type RecoveryMigrationRejection = 'MALFORMED_PAYLOAD' | 'INCOMPATIBLE_SCHEMA' | 'NO_MIGRATION_PATH';

export type RecoveryMigrationOutcome =
  | { readonly ok: true; readonly record: Readonly<Record<string, unknown>>; readonly applied: readonly number[] }
  | { readonly ok: false; readonly reason: RecoveryMigrationRejection; readonly detail: string };

function schemaVersionOf(record: Readonly<Record<string, unknown>>): number | null {
  const version = record.schemaVersion;
  return typeof version === 'number' && Number.isSafeInteger(version) && version >= 1 ? version : null;
}

/**
 * Bring a raw record to `target`, one explicit step at a time.
 *
 * A record already at `target` passes through untouched. An older record follows exactly the chain
 * the table declares; a version with no declared step is refused rather than coerced, and a step that
 * does not land on the version it declared is refused too — a migration is a promise about its output,
 * and the runner holds it to that promise before trusting it. A newer record is refused outright.
 */
export function migrateRecoveryRecord(
  raw: unknown,
  migrations: readonly RecoveryMigration[] = RECOVERY_MIGRATIONS,
  target: number = PRODUCT_RECOVERY_SCHEMA_VERSION,
): RecoveryMigrationOutcome {
  if (!isPlainRecord(raw)) return { ok: false, reason: 'MALFORMED_PAYLOAD', detail: 'record: must be a plain object' };
  const version = schemaVersionOf(raw);
  if (version === null) return { ok: false, reason: 'MALFORMED_PAYLOAD', detail: 'record.schemaVersion: must be an integer >= 1' };
  if (version > target) {
    return { ok: false, reason: 'INCOMPATIBLE_SCHEMA', detail: `record.schemaVersion: ${version} is newer than this build's ${target}; refusing to guess` };
  }

  let current: Readonly<Record<string, unknown>> = raw;
  let at = version;
  const applied: number[] = [];
  // Bounded by the table: a chain longer than the table has revisited a version, which is a defect.
  while (at < target) {
    if (applied.length > migrations.length) {
      return { ok: false, reason: 'NO_MIGRATION_PATH', detail: `record.schemaVersion: the migration chain from ${version} does not terminate` };
    }
    const step = migrations.find((migration) => migration.from === at);
    if (step === undefined) {
      return { ok: false, reason: 'NO_MIGRATION_PATH', detail: `record.schemaVersion: no explicit migration from ${at} toward ${target}` };
    }
    const migrated = step.migrate(current);
    if (!isPlainRecord(migrated) || schemaVersionOf(migrated) !== step.to) {
      return { ok: false, reason: 'NO_MIGRATION_PATH', detail: `migration ${step.from} -> ${step.to} did not produce a record at version ${step.to}` };
    }
    current = migrated;
    applied.push(step.from);
    at = step.to;
  }
  return { ok: true, record: current, applied };
}
