/**
 * T-13 §3 / §13 / §14 — the Product recovery record: what survives a restart, and nothing else.
 *
 * > **The persisted record is a recovery locator + user viewpoint, not a cached authoritative world.**
 *
 * Exactly five keys, and every one of them is either the reader's own committed intent or the
 * metadata needed to write that intent deterministically:
 *
 *   `ownerUserId`   the authenticated identity's namespace locator (non-secret; never a credential)
 *   `sessionId`     the active QANDEEL conversation Session locator (server-minted; never synthesised)
 *   `viewpoint`     `TM`, `IF_ref`, `MC` and `RH` — the four client-owned Class-A facts, verbatim
 *   `sequence`      write-ordering metadata so an older async write can never overwrite a newer one
 *   `schemaVersion` the explicit version this record was written under
 *
 * What has NO key here, by construction: `LH` and `LF` (server-authoritative mirrors that are re-fetched
 * before the Product is READY), the effective `TC` (derived from `TM` and the fresh `LH` — never a second
 * authority), `K(TC)`, `V`, any disclosure or projection, the Map scene, presentation geometry, motion or
 * animation state, `PTC`, foreground cursors, and every credential. The exact-shape rule at every level
 * makes a smuggled key a decoding failure, not a silently ignored one.
 *
 * ## Strict, never repaired
 *
 * Decoding is fail-closed and whole: a malformed key, an unknown key, an invalid enum, a camera the Map
 * cannot decode, a checkpoint the kernel would refuse, an owner that is not a non-empty string or a
 * Session locator that is not a UUID all reject the WHOLE record. No field is defaulted, coerced or
 * guessed, and no semantic field is loaded while another is ignored: a corrupt record never reaches
 * Product READY. Coherence against the fresh Live Head (`PINNED(t)` with `t <= LH`, every checkpoint
 * `tc <= LH`) cannot be judged here and is judged by the bootstrap after the authoritative snapshot.
 *
 * The validators are the kernel's own — `temporalModeShapeIssue`, `inspectionRefShapeIssue`,
 * `cameraIntentShapeIssue`, `rhEntryShapeIssue` — so a record can never admit a shape the canonical store
 * would refuse, and T-04's `decodeCameraIntent` decides whether a camera intent is a camera at all.
 */
import { decodeCameraIntent } from '../../map';
import {
  cameraIntentEquals,
  cameraIntentShapeIssue,
  exactShapeIssue,
  inspectionRefEquals,
  inspectionRefShapeIssue,
  isPlainRecord,
  isRhActionId,
  rhEntryShapeIssue,
  temporalModeEquals,
  temporalModeShapeIssue,
  type CameraIntent,
  type CanonicalState,
  type InspectionRef,
  type RhEntry,
  type TemporalMode,
} from '../../state';

/** The one schema version this build decodes strictly. A different one is migrated or refused, never guessed. */
export const PRODUCT_RECOVERY_SCHEMA_VERSION = 1 as const;

/** The exact keys of a record. An allowlist, applied at decoding as an exact-shape rule. */
export const RECOVERY_RECORD_KEYS = Object.freeze(['schemaVersion', 'ownerUserId', 'sessionId', 'viewpoint', 'sequence'] as const);

/** The exact keys of the persisted viewpoint: the four client-owned Class-A facts, and never `LH` or `LF`. */
export const RECOVERED_VIEWPOINT_KEYS = Object.freeze(['temporal', 'inspection', 'camera', 'history'] as const);

/**
 * The reader's durable viewpoint. `temporal` is the MODE — `FOLLOW_LIVE` persists no position at all,
 * and `PINNED(t)` persists exactly `t` — so the effective `TC` is always re-derived from the fresh Live
 * Head after a restart and is never stored as a competing authority.
 */
export interface RecoveredViewpoint {
  readonly temporal: TemporalMode;
  readonly inspection: InspectionRef | null;
  readonly camera: CameraIntent;
  readonly history: readonly RhEntry[];
}

export interface ProductRecoveryRecord {
  readonly schemaVersion: typeof PRODUCT_RECOVERY_SCHEMA_VERSION;
  /** The authenticated owner's identity locator. A namespace key, never a secret. */
  readonly ownerUserId: string;
  /** The active conversation Session locator, exactly as the server minted it. */
  readonly sessionId: string;
  readonly viewpoint: RecoveredViewpoint;
  /** Monotonic per owner. Local write-ordering metadata (§3.1); never Product truth. */
  readonly sequence: number;
}

export type RecoveryRecordRejection =
  | 'MALFORMED_PAYLOAD'
  | 'INCOMPATIBLE_SCHEMA'
  | 'INVALID_OWNER'
  | 'INVALID_SESSION'
  | 'INVALID_SEQUENCE'
  | 'INVALID_TEMPORAL'
  | 'INVALID_INSPECTION'
  | 'INVALID_CAMERA'
  | 'INVALID_HISTORY';

export type RecoveryRecordDecode =
  | { readonly ok: true; readonly record: ProductRecoveryRecord }
  | { readonly ok: false; readonly reason: RecoveryRecordRejection; readonly detail: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const reject = (reason: RecoveryRecordRejection, detail: string): RecoveryRecordDecode => ({ ok: false, reason, detail });

/** Whether a camera intent is not merely well-shaped but decodable by the Map's own encodings. */
function cameraIssue(value: unknown, path: string): string | null {
  const shape = cameraIntentShapeIssue(value, path);
  if (shape !== null) return shape;
  const decoded = decodeCameraIntent(value as CameraIntent);
  return decoded.ok ? null : `${path}: ${decoded.detail}`;
}

/**
 * Decode ONE record of the current schema version strictly.
 *
 * Every level is an exact-key check followed by the kernel's own value validator. The first violation
 * rejects the whole record with its path, and nothing is returned for a record that is not entirely
 * legal — a partially usable record is not a recovery source.
 */
export function decodeProductRecoveryRecord(raw: unknown): RecoveryRecordDecode {
  const shape = exactShapeIssue(raw, 'record', RECOVERY_RECORD_KEYS);
  if (shape !== null) return reject('MALFORMED_PAYLOAD', shape);
  const record = raw as Record<(typeof RECOVERY_RECORD_KEYS)[number], unknown>;

  if (record.schemaVersion !== PRODUCT_RECOVERY_SCHEMA_VERSION) {
    return reject('INCOMPATIBLE_SCHEMA', `record.schemaVersion: expected ${PRODUCT_RECOVERY_SCHEMA_VERSION}, got ${String(record.schemaVersion)}`);
  }
  if (typeof record.ownerUserId !== 'string' || record.ownerUserId.length === 0) {
    return reject('INVALID_OWNER', 'record.ownerUserId: must be a non-empty identity locator');
  }
  if (typeof record.sessionId !== 'string' || !UUID_PATTERN.test(record.sessionId)) {
    return reject('INVALID_SESSION', 'record.sessionId: must be a server-minted UUID');
  }
  if (typeof record.sequence !== 'number' || !Number.isSafeInteger(record.sequence) || record.sequence < 0) {
    return reject('INVALID_SEQUENCE', 'record.sequence: must be a non-negative safe integer');
  }

  const viewpointShape = exactShapeIssue(record.viewpoint, 'record.viewpoint', RECOVERED_VIEWPOINT_KEYS);
  if (viewpointShape !== null) return reject('MALFORMED_PAYLOAD', viewpointShape);
  const viewpoint = record.viewpoint as Record<(typeof RECOVERED_VIEWPOINT_KEYS)[number], unknown>;

  const temporal = temporalModeShapeIssue(viewpoint.temporal, 'record.viewpoint.temporal');
  if (temporal !== null) return reject('INVALID_TEMPORAL', temporal);

  if (viewpoint.inspection !== null) {
    const inspection = inspectionRefShapeIssue(viewpoint.inspection, 'record.viewpoint.inspection');
    if (inspection !== null) return reject('INVALID_INSPECTION', inspection);
  }

  const camera = cameraIssue(viewpoint.camera, 'record.viewpoint.camera');
  if (camera !== null) return reject('INVALID_CAMERA', camera);

  if (!Array.isArray(viewpoint.history)) return reject('INVALID_HISTORY', 'record.viewpoint.history: must be an array of checkpoints');
  for (let index = 0; index < viewpoint.history.length; index += 1) {
    const path = `record.viewpoint.history[${index}]`;
    const entry = rhEntryShapeIssue(viewpoint.history[index], path, isRhActionId);
    if (entry !== null) return reject('INVALID_HISTORY', entry);
    // A checkpoint whose captured camera the Map cannot decode could never be restored truthfully.
    const captured = cameraIssue((viewpoint.history[index] as RhEntry).captured.camera, `${path}.captured.camera`);
    if (captured !== null) return reject('INVALID_HISTORY', captured);
  }

  return {
    ok: true,
    record: {
      schemaVersion: PRODUCT_RECOVERY_SCHEMA_VERSION,
      ownerUserId: record.ownerUserId,
      sessionId: record.sessionId,
      viewpoint: {
        temporal: viewpoint.temporal as TemporalMode,
        inspection: viewpoint.inspection as InspectionRef | null,
        camera: viewpoint.camera as CameraIntent,
        history: viewpoint.history as readonly RhEntry[],
      },
      sequence: record.sequence,
    },
  };
}

/**
 * The persisted subset of canonical state, read by NAME from the four client-owned fields.
 *
 * `state.live` is never read: `LH` and `LF` are server truth and are re-fetched on recovery. Reading the
 * fields by name rather than spreading the state is what keeps a future canonical key from being
 * persisted by accident.
 */
export function recoveredViewpointOf(state: CanonicalState): RecoveredViewpoint {
  return { temporal: state.temporal, inspection: state.inspection, camera: state.camera, history: state.history };
}

/**
 * Whether two viewpoints are the same durable intent.
 *
 * The three single fields compare by the kernel's own value equality. History compares by ENTRY
 * IDENTITY per position: the store never edits an entry in place — it appends a new object or slices
 * consumed ones off — so identity per index is exact, and it is what lets the writer stay silent while
 * only `LH` or `LF` changed underneath an unchanged viewpoint.
 */
export function recoveredViewpointEquals(a: RecoveredViewpoint, b: RecoveredViewpoint): boolean {
  if (!temporalModeEquals(a.temporal, b.temporal)) return false;
  if (!inspectionRefEquals(a.inspection, b.inspection)) return false;
  if (!cameraIntentEquals(a.camera, b.camera)) return false;
  if (a.history.length !== b.history.length) return false;
  return a.history.every((entry, index) => entry === b.history[index]);
}

/**
 * Build the record for one owner, one Session and one viewpoint. Built field by field from the
 * allowlist, never from a spread, so nothing outside the five keys can be encoded.
 */
export function productRecoveryRecord(ownerUserId: string, sessionId: string, viewpoint: RecoveredViewpoint, sequence: number): ProductRecoveryRecord {
  return {
    schemaVersion: PRODUCT_RECOVERY_SCHEMA_VERSION,
    ownerUserId,
    sessionId,
    viewpoint: {
      temporal: viewpoint.temporal,
      inspection: viewpoint.inspection,
      camera: viewpoint.camera,
      history: viewpoint.history,
    },
    sequence,
  };
}

/** The wire form of a record: the exact keys, and nothing the type does not declare. */
export function encodeProductRecoveryRecord(record: ProductRecoveryRecord): string {
  return JSON.stringify({
    schemaVersion: record.schemaVersion,
    ownerUserId: record.ownerUserId,
    sessionId: record.sessionId,
    viewpoint: {
      temporal: record.viewpoint.temporal,
      inspection: record.viewpoint.inspection,
      camera: record.viewpoint.camera,
      history: record.viewpoint.history,
    },
    sequence: record.sequence,
  });
}

export type RecoveryPayloadParse = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly detail: string };

/** Parse a stored payload without trusting it. A payload that is not JSON, or not an object, is a typed failure. */
export function parseProductRecoveryPayload(text: string): RecoveryPayloadParse {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    return { ok: false, detail: cause instanceof Error && cause.message !== '' ? cause.message : 'the payload is not JSON' };
  }
  if (!isPlainRecord(value)) return { ok: false, detail: 'the payload is not a plain object' };
  return { ok: true, value };
}
