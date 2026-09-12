/**
 * T-13 R01…R20 — the strict record codec.
 *
 * The claim under test is not "a good record decodes". It is that NOTHING ELSE does: every planted
 * defect below is one field away from a legal record, and every one of them must reject the record
 * whole — never be defaulted, coerced, clamped or loaded beside the fields that were fine.
 */
import { initialCameraIntent } from '../../map';
import { sessionPosition } from '../../state';
import {
  PRODUCT_RECOVERY_SCHEMA_VERSION,
  RECOVERED_VIEWPOINT_KEYS,
  RECOVERY_RECORD_KEYS,
  decodeProductRecoveryRecord,
  encodeProductRecoveryRecord,
  parseProductRecoveryPayload,
  recoveredViewpointEquals,
  recoveredViewpointOf,
} from '..';
import { checkpoint, inspectionRef, offsetCamera, rawRecord, record } from '../__fixtures__/records';

const decode = (raw: unknown) => decodeProductRecoveryRecord(raw);
const rejectedAs = (raw: unknown) => {
  const outcome = decode(raw);
  if (outcome.ok) throw new Error('expected the record to be rejected');
  return outcome.reason;
};

describe('R01…R04 — a legal record round-trips exactly, and only the allowlisted keys exist', () => {
  it('R01 — encode then decode reproduces the record field for field', () => {
    const original = record({
      sequence: 9,
      viewpoint: {
        temporal: { kind: 'PINNED', at: sessionPosition(3) },
        inspection: inspectionRef(),
        camera: offsetCamera(),
        history: [checkpoint(1), checkpoint(2, { ifRef: inspectionRef('reading-2'), camera: offsetCamera(5n, 5n), act: 'INSPECT_OBJECT' })],
      },
    });
    const outcome = decode(JSON.parse(encodeProductRecoveryRecord(original)));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error('unreachable');
    expect(outcome.record).toEqual(original);
    expect(outcome.record.schemaVersion).toBe(PRODUCT_RECOVERY_SCHEMA_VERSION);
  });

  it('R02 — the persisted keys are exactly the five record keys and the four viewpoint keys', () => {
    expect([...RECOVERY_RECORD_KEYS]).toEqual(['schemaVersion', 'ownerUserId', 'sessionId', 'viewpoint', 'sequence']);
    expect([...RECOVERED_VIEWPOINT_KEYS]).toEqual(['temporal', 'inspection', 'camera', 'history']);
    const wire = JSON.parse(encodeProductRecoveryRecord(record())) as Record<string, unknown>;
    expect(Object.keys(wire).sort()).toEqual([...RECOVERY_RECORD_KEYS].sort());
    expect(Object.keys(wire.viewpoint as object).sort()).toEqual([...RECOVERED_VIEWPOINT_KEYS].sort());
  });

  it('R03 — `LH`, `LF`, an effective `TC`, a token or any other key is a rejection, at either level', () => {
    for (const smuggled of ['LH', 'LF', 'live', 'tc', 'effectiveTC', 'accessToken', 'refreshToken', 'projection', 'cursors']) {
      expect(rejectedAs({ ...rawRecord(), [smuggled]: 1 })).toBe('MALFORMED_PAYLOAD');
      const raw = rawRecord();
      expect(rejectedAs({ ...raw, viewpoint: { ...(raw.viewpoint as object), [smuggled]: 1 } })).toBe('MALFORMED_PAYLOAD');
    }
  });

  it('R04 — a missing key is a rejection, never a default', () => {
    for (const key of RECOVERY_RECORD_KEYS) {
      const raw = rawRecord();
      delete raw[key];
      expect(rejectedAs(raw)).toBe('MALFORMED_PAYLOAD');
    }
    for (const key of RECOVERED_VIEWPOINT_KEYS) {
      const raw = rawRecord();
      const viewpoint = { ...(raw.viewpoint as Record<string, unknown>) };
      delete viewpoint[key];
      expect(rejectedAs({ ...raw, viewpoint })).toBe('MALFORMED_PAYLOAD');
    }
  });
});

describe('R05…R12 — every semantic field is validated by the kernel’s own rule, and refused whole', () => {
  it('R05 — an unknown future schema version is INCOMPATIBLE_SCHEMA', () => {
    expect(rejectedAs({ ...rawRecord(), schemaVersion: PRODUCT_RECOVERY_SCHEMA_VERSION + 1 })).toBe('INCOMPATIBLE_SCHEMA');
    expect(rejectedAs({ ...rawRecord(), schemaVersion: '1' })).toBe('INCOMPATIBLE_SCHEMA');
  });

  it('R06 — the owner locator must be a non-empty string', () => {
    expect(rejectedAs({ ...rawRecord(), ownerUserId: '' })).toBe('INVALID_OWNER');
    expect(rejectedAs({ ...rawRecord(), ownerUserId: 42 })).toBe('INVALID_OWNER');
  });

  it('R07 — the Session locator must be a server-minted UUID, never a synthesised string', () => {
    for (const bad of ['session-1', '', 'not-a-uuid', '44444444-4444-4444-4444-444444444444']) {
      expect(rejectedAs({ ...rawRecord(), sessionId: bad })).toBe('INVALID_SESSION');
    }
  });

  it('R08 — the write sequence must be a non-negative safe integer', () => {
    for (const bad of [-1, 1.5, Number.NaN, '3', Number.MAX_SAFE_INTEGER + 1]) {
      expect(rejectedAs({ ...rawRecord(), sequence: bad })).toBe('INVALID_SEQUENCE');
    }
  });

  it('R09 — a third temporal mode, a null cursor or a non-positive pinned time is INVALID_TEMPORAL', () => {
    for (const bad of [{ kind: 'LIVE' }, { kind: 'PINNED' }, { kind: 'PINNED', at: 0 }, { kind: 'PINNED', at: 2.5 }, { kind: 'FOLLOW_LIVE', at: 3 }, null]) {
      expect(rejectedAs(rawRecord({ viewpoint: { temporal: bad as never } }))).toBe('INVALID_TEMPORAL');
    }
  });

  it('R10 — an inspection reference is exact: a wrong depth or a wrong ref kind is INVALID_INSPECTION', () => {
    const ref = inspectionRef();
    expect(rejectedAs(rawRecord({ viewpoint: { inspection: { ...ref, depth: 'READING' } as never } }))).toBe('INVALID_INSPECTION');
    expect(rejectedAs(rawRecord({ viewpoint: { inspection: { ...ref, canonicalIdentity: { kind: 'VERSION', value: 'x' } } as never } }))).toBe('INVALID_INSPECTION');
    expect(rejectedAs(rawRecord({ viewpoint: { inspection: { ...ref, extra: true } as never } }))).toBe('INVALID_INSPECTION');
  });

  it('R11 — a camera intent must be one the Map can DECODE, not merely one shaped like one', () => {
    const camera = initialCameraIntent();
    // Well-shaped opaque refs carrying a scheme the Map does not know: shape passes, decoding does not.
    const foreignScheme = { ...camera, anchor: { kind: 'WORLD_ANCHOR', value: { scheme: 'SOMEBODY_ELSES_V9', x: '0', y: '0' } } };
    expect(rejectedAs(rawRecord({ viewpoint: { camera: foreignScheme as never } }))).toBe('INVALID_CAMERA');
    const floatAnchor = { ...camera, anchor: { kind: 'WORLD_ANCHOR', value: { ...(camera.anchor.value as object), x: '1.5' } } };
    expect(rejectedAs(rawRecord({ viewpoint: { camera: floatAnchor as never } }))).toBe('INVALID_CAMERA');
    expect(rejectedAs(rawRecord({ viewpoint: { camera: { ...camera, depth: 'MATERIAL' } as never } }))).toBe('INVALID_CAMERA');
  });

  it('R12 — a malformed checkpoint rejects the whole history, and the whole record with it', () => {
    const good = checkpoint(2);
    expect(rejectedAs(rawRecord({ viewpoint: { history: 'nope' as never } }))).toBe('INVALID_HISTORY');
    // An act identity that is not RH-eligible.
    expect(rejectedAs(rawRecord({ viewpoint: { history: [good, { ...good, act: 'PREVIEW_TEMPORAL_TARGET' }] as never } }))).toBe('INVALID_HISTORY');
    // A checkpoint over the technical absence sentinel: unrepresentable, so refused.
    expect(rejectedAs(rawRecord({ viewpoint: { history: [{ ...good, captured: { ...good.captured, tc: null } }] as never } }))).toBe('INVALID_HISTORY');
    // A captured camera the Map cannot decode.
    const bad = { ...good, captured: { ...good.captured, camera: { ...good.captured.camera, scale: { kind: 'SCALE_INTENT', value: 'huge' } } } };
    expect(rejectedAs(rawRecord({ viewpoint: { history: [good, bad] as never } }))).toBe('INVALID_HISTORY');
    // And the ONE good entry beside the bad one is not salvaged: there is no partial decode.
    expect(decode(rawRecord({ viewpoint: { history: [good, bad] as never } })).ok).toBe(false);
  });
});

describe('R13…R16 — the payload parser and the viewpoint helpers', () => {
  it('R13 — a payload that is not JSON, or not an object, is a typed parse failure', () => {
    expect(parseProductRecoveryPayload('{not json').ok).toBe(false);
    expect(parseProductRecoveryPayload('"a string"').ok).toBe(false);
    expect(parseProductRecoveryPayload('[1,2]').ok).toBe(false);
    expect(parseProductRecoveryPayload('null').ok).toBe(false);
    expect(parseProductRecoveryPayload('{}').ok).toBe(true);
  });

  it('R14 — the persisted subset is read by NAME from canonical state and never carries `live`', () => {
    const state = {
      session: { id: 'ignored' },
      live: { LH: sessionPosition(30), LF: { value: { kind: 'NONE' as const }, atSp: null } },
      temporal: { kind: 'FOLLOW_LIVE' as const },
      inspection: null,
      camera: initialCameraIntent(),
      history: [],
    };
    const subset = recoveredViewpointOf(state);
    expect(Object.keys(subset).sort()).toEqual([...RECOVERED_VIEWPOINT_KEYS].sort());
    expect('live' in subset).toBe(false);
    expect(JSON.stringify(subset)).not.toContain('"LH"');
  });

  it('R15 — viewpoint equality ignores a Live Head advance and notices every persisted field', () => {
    const base = recoveredViewpointOf({
      session: { id: 's' },
      live: { LH: sessionPosition(1), LF: { value: { kind: 'NONE' }, atSp: null } },
      temporal: { kind: 'FOLLOW_LIVE' },
      inspection: null,
      camera: initialCameraIntent(),
      history: [],
    });
    expect(recoveredViewpointEquals(base, { ...base })).toBe(true);
    expect(recoveredViewpointEquals(base, { ...base, temporal: { kind: 'PINNED', at: sessionPosition(1) } })).toBe(false);
    expect(recoveredViewpointEquals(base, { ...base, inspection: inspectionRef() })).toBe(false);
    expect(recoveredViewpointEquals(base, { ...base, camera: offsetCamera() })).toBe(false);
    expect(recoveredViewpointEquals(base, { ...base, history: [checkpoint(1)] })).toBe(false);
  });

  it('R16 — history equality is by entry identity per position, which is what the store itself guarantees', () => {
    const entry = checkpoint(1);
    const a = viewpointWith([entry]);
    expect(recoveredViewpointEquals(a, viewpointWith([entry]))).toBe(true);
    // A structurally identical COPY is a different object: the store never edits an entry in place, so
    // a new object at the same position is a new transaction, and the writer must notice it.
    expect(recoveredViewpointEquals(a, viewpointWith([{ ...entry }]))).toBe(false);
  });
});

function viewpointWith(history: readonly ReturnType<typeof checkpoint>[]) {
  return { temporal: { kind: 'FOLLOW_LIVE' as const }, inspection: null, camera: initialCameraIntent(), history };
}
