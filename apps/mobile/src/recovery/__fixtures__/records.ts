/**
 * T-13 — shared test scaffolding for the recovery layer.
 *
 * Every value here is built with the REAL encoders — T-04's world refs, the kernel's opaque refs, the
 * layer's own record builder — so a record used in a test is one the Product could actually have
 * written, and a defect planted in it is a defect against the real shape.
 */
import { canonicalWorldAddress, initialCameraIntent, worldAnchorRef } from '../../map';
import { opaqueRef, sessionPosition, type CameraIntent, type InspectionRef, type RhEntry, type TemporalMode } from '../../state';
import {
  PRODUCT_RECOVERY_SCHEMA_VERSION,
  encodeProductRecoveryRecord,
  namespaceKeyFor,
  productRecoveryRecord,
  type ProductRecoveryRecord,
  type ProductRecoveryStorage,
  type RecoveredViewpoint,
} from '..';

export const OWNER_A = 'user-a';
export const OWNER_B = 'user-b';
export const SESSION_R = '44444444-4444-4444-8444-444444444444';

/** A real, decodable inspection reference at the analytical-object rung. */
export function inspectionRef(id = 'reading-7'): InspectionRef {
  return Object.freeze({
    canonicalIdentity: opaqueRef('CANONICAL_IDENTITY', { family: 'READING', id }),
    depth: 'ANALYTICAL_OBJECT',
    lineage: opaqueRef('LINEAGE', { route: `WORLD/THREAD:thread-a/READING:${id}` }),
  });
}

/** A camera the Map can decode, away from the World/Z0 target so a restoration is observable. */
export function offsetCamera(x = 1_000_000n, y = -250_000n): CameraIntent {
  const address = canonicalWorldAddress(x, y);
  if (!address.ok) throw new Error('fixture address must be canonical');
  return { ...initialCameraIntent(), anchor: worldAnchorRef(address.address), depth: 'THREAD' };
}

/** A checkpoint an effective act would have appended, captured at `tc`. */
export function checkpoint(tc: number, over: Partial<RhEntry['captured']> & { readonly act?: RhEntry['act'] } = {}): RhEntry {
  const { act, ...captured } = over;
  return {
    act: act ?? 'PAN',
    captured: {
      tmProvenance: { kind: 'FOLLOW_LIVE' },
      tc: sessionPosition(tc),
      ifRef: null,
      camera: initialCameraIntent(),
      ...captured,
    },
  };
}

export function viewpoint(over: Partial<RecoveredViewpoint> = {}): RecoveredViewpoint {
  return {
    temporal: { kind: 'FOLLOW_LIVE' } as TemporalMode,
    inspection: null,
    camera: initialCameraIntent(),
    history: [],
    ...over,
  };
}

export function record(over: { owner?: string; sessionId?: string; sequence?: number; viewpoint?: Partial<RecoveredViewpoint> } = {}): ProductRecoveryRecord {
  return productRecoveryRecord(over.owner ?? OWNER_A, over.sessionId ?? SESSION_R, viewpoint(over.viewpoint), over.sequence ?? 1);
}

/** The exact JSON object the record encodes to, so a test can plant one defect in an otherwise legal payload. */
export function rawRecord(over: Parameters<typeof record>[0] = {}): Record<string, unknown> {
  return JSON.parse(encodeProductRecoveryRecord(record(over))) as Record<string, unknown>;
}

/** Put one owner's raw payload straight into a storage, exactly as a previous process would have left it. */
export async function seed(storage: ProductRecoveryStorage, owner: string, payload: unknown): Promise<void> {
  await storage.setItem(namespaceKeyFor(owner), typeof payload === 'string' ? payload : JSON.stringify(payload));
}

export { PRODUCT_RECOVERY_SCHEMA_VERSION };

/** A storage that records every operation, can be made to throw, and can hold one write open. */
export interface RecordingStorage extends ProductRecoveryStorage {
  readonly log: { op: 'get' | 'set' | 'remove'; key: string; value?: string }[];
  readonly values: Map<string, string>;
  failReads(detail: string | null): void;
  /** Hold the NEXT `setItem` open until released; later ones queue behind it in the store's chain. */
  holdNextWrite(): { release(): void };
}

export function recordingStorage(): RecordingStorage {
  const log: RecordingStorage['log'] = [];
  const values = new Map<string, string>();
  let readFailure: string | null = null;
  let hold: { promise: Promise<void>; release: () => void } | null = null;
  return {
    log,
    values,
    failReads: (detail) => {
      readFailure = detail;
    },
    holdNextWrite() {
      let release: () => void = () => undefined;
      const promise = new Promise<void>((resolve) => {
        release = resolve;
      });
      hold = { promise, release };
      return { release };
    },
    async getItem(key) {
      log.push({ op: 'get', key });
      if (readFailure !== null) throw new Error(readFailure);
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      const pending = hold;
      hold = null;
      if (pending !== null) await pending.promise;
      log.push({ op: 'set', key, value });
      values.set(key, value);
    },
    async removeItem(key) {
      log.push({ op: 'remove', key });
      values.delete(key);
    },
  };
}
