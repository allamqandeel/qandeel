/** T-13 — the recovery record schema, its strict codec, and the explicit migration runner. */
export type {
  ProductRecoveryRecord,
  RecoveredViewpoint,
  RecoveryPayloadParse,
  RecoveryRecordDecode,
  RecoveryRecordRejection,
} from './recovery-record';
export {
  PRODUCT_RECOVERY_SCHEMA_VERSION,
  RECOVERED_VIEWPOINT_KEYS,
  RECOVERY_RECORD_KEYS,
  decodeProductRecoveryRecord,
  encodeProductRecoveryRecord,
  parseProductRecoveryPayload,
  productRecoveryRecord,
  recoveredViewpointEquals,
  recoveredViewpointOf,
} from './recovery-record';

export type { RecoveryMigration, RecoveryMigrationOutcome, RecoveryMigrationRejection } from './recovery-migrations';
export { RECOVERY_MIGRATIONS, migrateRecoveryRecord } from './recovery-migrations';
