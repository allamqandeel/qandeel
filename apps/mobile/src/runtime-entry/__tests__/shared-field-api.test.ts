/**
 * SHARED-VIS-01 — the strict Shared field client (`shared-field-api.ts`): exact integer places only, exact keys, one
 * neutral denial or absence, anything else is no answer.
 */
import { canonicalWorldAddress } from '../../map/world';
import { decodeSharedField, decodeSharedPlace } from '../shared-field-api';

const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const at = (x: bigint, y: bigint) => {
  const a = canonicalWorldAddress(x, y);
  if (!a.ok) throw new Error('fixture');
  return a.address;
};

describe('SHARED-VIS-01 — the strict Shared field client', () => {
  it('decodes the field exactly: exact integer places only, one neutral denial, anything else is no answer', () => {
    const place = { placeId: id(1), x: '300000', y: '-4611686018427387904', meaning: 'm', region: 'r' };
    const read = decodeSharedField({ outcome: 'ALLOW', places: [place] });
    expect(read.kind).toBe('READ');
    if (read.kind === 'READ') expect(read.entries[0].address).toEqual(at(300_000n, -(2n ** 62n)));
    expect(decodeSharedField({ outcome: 'UNAVAILABLE' })).toEqual({ kind: 'DENIED' });
    for (const bad of [
      { outcome: 'ALLOW', places: [{ ...place, x: 1.5 }] },
      { outcome: 'ALLOW', places: [{ ...place, x: '4611686018427387904' }] },
      { outcome: 'ALLOW', places: [{ ...place, author: 'x' }] },
      { outcome: 'ALLOW', places: [place], count: 1 },
      { outcome: 'ALLOW', places: Array.from({ length: 401 }, () => place) },
      null,
    ]) expect(decodeSharedField(bad).kind).toBe('UNAVAILABLE');
  });

  it('decodes one place with its exact sources, or one neutral ABSENT', () => {
    const body = { outcome: 'ALLOW', place: { placeId: id(1), x: '1', y: '2', meaning: 'm', region: 'r', primaryThemes: ['a'], secondaryThemes: [],
      establishedAt: '2026-10-08T10:00:00Z', sources: [{ materialId: id(2), producer: 'SELF', authorName: null, text: 't', establishedAt: '2026-10-08T09:00:00Z' }] } };
    expect(decodeSharedPlace(body, id(1)).kind).toBe('READ');
    expect(decodeSharedPlace(body, id(9)).kind).toBe('UNAVAILABLE');
    expect(decodeSharedPlace({ outcome: 'ABSENT' }, id(1))).toEqual({ kind: 'ABSENT' });
    expect(decodeSharedPlace({ outcome: 'UNAVAILABLE' }, id(1))).toEqual({ kind: 'DENIED' });
    expect(decodeSharedPlace({ ...body, place: { ...body.place, sources: [] } }, id(1)).kind).toBe('UNAVAILABLE');
    expect(decodeSharedPlace({ ...body, place: { ...body.place, sources: [{ ...body.place.sources[0], producer: 'ADMIN' }] } }, id(1)).kind).toBe('UNAVAILABLE');
  });
});

