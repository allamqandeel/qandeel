import {
  AUTOMATIC_COMMIT_BATCH_NAMESPACE,
  AUTOMATIC_COMMIT_UNIT_NAMESPACE,
  automaticCommitBatchId,
  automaticCommitUnitId,
  uuidV5,
} from './deterministic-runtime-id';

// The producer's frozen caller-payload validation (migration 0064) admits only
// versions 1-5 and RFC variant 10xx. A derived identity that cannot satisfy it
// would be refused by the database, so the shape is part of the contract.
const PRODUCER_UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

const USER_TURN = '11111111-1111-4111-8111-111111111111';
const ASSISTANT_TURN = '22222222-2222-4222-8222-222222222222';

describe('deterministic automatic commitment identity', () => {
  it('derives the two fixed domain namespaces from their documented URIs', () => {
    expect(AUTOMATIC_COMMIT_BATCH_NAMESPACE).toBe('acf1e305-495b-5d89-b83e-5ef9a59bbce7');
    expect(AUTOMATIC_COMMIT_UNIT_NAMESPACE).toBe('cc41e384-2aff-56c4-8394-d049d4667f44');
    expect(AUTOMATIC_COMMIT_BATCH_NAMESPACE).not.toBe(AUTOMATIC_COMMIT_UNIT_NAMESPACE);
  });

  it('matches the RFC 4122 §4.3 name-based version 5 test vector', () => {
    // The canonical published vector for the DNS namespace and "python.org".
    expect(uuidV5('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'python.org')).toBe('886313e1-3b8a-5372-9b90-0c9aee199e5d');
  });

  it('produces stable batch identities across separate calls and processes', () => {
    expect(automaticCommitBatchId(USER_TURN)).toBe('3adcd05e-c3b7-5f6e-9ab6-49059003e0e1');
    expect(automaticCommitBatchId(ASSISTANT_TURN)).toBe('ae272d75-9e48-5e4f-bf96-5cd614f48430');
    expect(automaticCommitBatchId(USER_TURN)).toBe(automaticCommitBatchId(USER_TURN));
    expect(automaticCommitBatchId(USER_TURN)).not.toBe(automaticCommitBatchId(ASSISTANT_TURN));
  });

  it('produces stable unit identities from batch, index and canonical source span', () => {
    const batch = automaticCommitBatchId(USER_TURN);
    expect(automaticCommitUnitId(batch, { index: 0, spanStart: 0, spanEnd: 10 })).toBe('d608f64c-bc51-5b71-8268-a4090bd21358');
    expect(automaticCommitUnitId(batch, { index: 1, spanStart: 10, spanEnd: 25 })).toBe('96aef45c-2fc0-5f3a-8fa7-d2beda124b42');
    // A different boundary decision is a different identity: one code point of
    // span difference changes the derived unit id.
    expect(automaticCommitUnitId(batch, { index: 1, spanStart: 10, spanEnd: 26 })).toBe('90705bd4-e9fa-5eac-975a-0cead545faf4');
  });

  it('separates identity by index, by span and by batch', () => {
    const batch = automaticCommitBatchId(USER_TURN);
    const other = automaticCommitBatchId(ASSISTANT_TURN);
    const span = { spanStart: 0, spanEnd: 10 } as const;
    expect(automaticCommitUnitId(batch, { index: 0, ...span })).not.toBe(automaticCommitUnitId(batch, { index: 1, ...span }));
    expect(automaticCommitUnitId(batch, { index: 0, ...span })).not.toBe(automaticCommitUnitId(other, { index: 0, ...span }));
    expect(automaticCommitUnitId(batch, { index: 0, ...span }))
      .not.toBe(automaticCommitUnitId(batch, { index: 0, spanStart: 1, spanEnd: 10 }));
  });

  it('produces identities the frozen producer payload validation accepts', () => {
    const batch = automaticCommitBatchId(USER_TURN);
    expect(batch).toMatch(PRODUCER_UUID_SHAPE);
    expect(AUTOMATIC_COMMIT_BATCH_NAMESPACE).toMatch(PRODUCER_UUID_SHAPE);
    expect(AUTOMATIC_COMMIT_UNIT_NAMESPACE).toMatch(PRODUCER_UUID_SHAPE);
    for (let index = 0; index < 8; index += 1) {
      expect(automaticCommitUnitId(batch, { index, spanStart: index * 3, spanEnd: index * 3 + 3 })).toMatch(PRODUCER_UUID_SHAPE);
    }
  });

  it('keeps a later, deliberately distinct batch representable', () => {
    // The automatic identity is technical idempotency, never a
    // one-batch-per-turn constraint: any other UUID remains a legal batch id
    // for the same source turn.
    const automatic = automaticCommitBatchId(USER_TURN);
    expect(automatic).not.toBe('99999999-9999-4999-8999-999999999999');
  });

  it('refuses a malformed source turn, batch id, index or span', () => {
    expect(() => automaticCommitBatchId('not-a-uuid')).toThrow(TypeError);
    expect(() => automaticCommitBatchId('')).toThrow(TypeError);
    const batch = automaticCommitBatchId(USER_TURN);
    expect(() => automaticCommitUnitId('not-a-uuid', { index: 0, spanStart: 0, spanEnd: 1 })).toThrow(TypeError);
    for (const unit of [
      { index: -1, spanStart: 0, spanEnd: 1 },
      { index: 0.5, spanStart: 0, spanEnd: 1 },
      { index: 0, spanStart: -1, spanEnd: 1 },
      { index: 0, spanStart: 5, spanEnd: 5 },
      { index: 0, spanStart: 5, spanEnd: 4 },
    ]) {
      expect(() => automaticCommitUnitId(batch, unit)).toThrow(TypeError);
    }
  });
});
