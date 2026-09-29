/**
 * W3-01 — the General Settings layer: the ONE destination (P1 §8, P4-C1 S-B), bounded to Appearance &
 * Accessibility and Support & About. W3-02 adds Account & Identity with its one function, the Public ID and
 * its one lifetime manual change (P1 §6).
 */
export type { PublicIdCopy, SettingsCopy } from './copy';
export { settingsCopy } from './copy';
export type { SettingsSurfaceProps } from './SettingsSurface';
export { SETTINGS_SURFACE_TEST_ID, SettingsSurface } from './SettingsSurface';
export type { PublicIdCommitResult, PublicIdController, PublicIdControllerOptions, PublicIdState, PublicIdStatus, PublicIdTransport } from './public-id-controller';
export { PUBLIC_ID_READ_RETRY_DELAYS_MS, createPublicIdController, mintPublicIdCommandId } from './public-id-controller';
export { PUBLIC_ID_MAX_LENGTH, PUBLIC_ID_MIN_LENGTH, PUBLIC_ID_PATTERN, isWellFormedPublicId, normalizePublicId, publicIdHandle } from './public-id';
