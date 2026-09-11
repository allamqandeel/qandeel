/**
 * T-13 — Recovery / Persistence v1: the layer's whole public surface.
 *
 * > **Persist the user's durable viewpoint and active Session locator. Re-fetch server-authoritative
 * > truth before Product READY. Reconstruct derived state deterministically. Reset ephemeral state.
 * > Never present stale local state as current truth.**
 *
 * This layer is a PERSISTENCE BOUNDARY, not a runtime state model. It holds no canonical state of its
 * own, dispatches nothing, fetches nothing, and competes with nothing: the ONE canonical store is still
 * constructed by the T-12P bootstrap, from the fresh authoritative snapshot plus the validated viewpoint
 * this layer hands it, and the T-12 integration owner is the only production consumer of this barrel.
 *
 * What it owns, exactly:
 *
 *   the record schema and its strict codec       (`schema/recovery-record.ts`)
 *   the explicit migration runner                 (`schema/recovery-migrations.ts`)
 *   the Product recovery store, separate from auth (`store/product-recovery-store.ts`)
 *   the decision a loaded record produces          (`decision/recovery-decision.ts`)
 *   the writer that advances the durable snapshot  (`writer/recovery-writer.ts`)
 *
 * What is deliberately absent: any auth material, the disclosure cache, the effective `TC`, `LH`, `LF`,
 * presentation or motion state, foreground cursors, and the process-local Exact Return origin — which is
 * intentionally reset by restart rather than serialized as if it were durable.
 *
 * This barrel is an allowlist, and the static contract pins the exact set of names below.
 */
export type {
  ProductRecoveryRecord,
  RecoveredViewpoint,
  RecoveryMigration,
  RecoveryMigrationOutcome,
  RecoveryMigrationRejection,
  RecoveryPayloadParse,
  RecoveryRecordDecode,
  RecoveryRecordRejection,
} from './schema';
export {
  PRODUCT_RECOVERY_SCHEMA_VERSION,
  RECOVERED_VIEWPOINT_KEYS,
  RECOVERY_MIGRATIONS,
  RECOVERY_RECORD_KEYS,
  decodeProductRecoveryRecord,
  encodeProductRecoveryRecord,
  migrateRecoveryRecord,
  parseProductRecoveryPayload,
  productRecoveryRecord,
  recoveredViewpointEquals,
  recoveredViewpointOf,
} from './schema';

export type {
  ProductRecoveryStorage,
  ProductRecoveryStore,
  RecoveryLoadOutcome,
  RecoveryLoadRejection,
  RecoveryWriteOptions,
  RecoveryWriteOutcome,
} from './store/product-recovery-store';
export {
  PRODUCT_RECOVERY_DATABASE_NAME,
  PRODUCT_RECOVERY_KEY_PREFIX,
  createEphemeralProductRecoveryStorage,
  createProductRecoveryStorage,
  createProductRecoveryStore,
  namespaceKeyFor,
} from './store/product-recovery-store';

export type { RecoveryDecision, RecoveryRefusal } from './decision/recovery-decision';
export { decideRecovery } from './decision/recovery-decision';

export type { RecoveryWriter, RecoveryWriterOptions, RecoveryWriterStatus } from './writer/recovery-writer';
export { attachRecoveryWriter } from './writer/recovery-writer';
