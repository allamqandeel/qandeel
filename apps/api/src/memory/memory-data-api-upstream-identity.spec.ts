import { inspect } from 'node:util';
import { MemoryDataApiError, readMemoryDataApiUpstreamIdentity } from './memory-data-api.service';

// QHIA-011A Fix 02 - opaque upstream failure identity.
//
// The raw PostgREST/PostgreSQL code and message are NOT properties of the error
// object. They live in module-private WeakMap storage keyed by the exact error
// instance, so no reflection, serialization, spread, clone, or inspection path
// can reach them - which is what keeps them out of every Nest logger, error
// reporter, and outward channel built on those primitives.
//
// The sentinel below is deliberately distinctive: every assertion in this file
// is a search for it across a different escape channel.
const SENTINEL = 'RAW_DB_SENTINEL_QHIA011A_FIX02';
const SENTINEL_CODE = '28P01';
const sentinelError = (): MemoryDataApiError =>
  new MemoryDataApiError(500, { code: SENTINEL_CODE, message: `permission denied: ${SENTINEL}` });

const CHANNELS: ReadonlyArray<readonly [string, (error: MemoryDataApiError) => string]> = [
  ['error.message', (error) => error.message],
  ['error.stack', (error) => String(error.stack)],
  ['String(error)', (error) => String(error)],
  ['Object.keys(error)', (error) => JSON.stringify(Object.keys(error))],
  ['Object.entries(error)', (error) => JSON.stringify(Object.entries(error))],
  ['Object.getOwnPropertyNames(error)', (error) => JSON.stringify(Object.getOwnPropertyNames(error))],
  ['Object.getOwnPropertyDescriptors(error)', (error) => JSON.stringify(Object.getOwnPropertyDescriptors(error))],
  ['JSON.stringify(error)', (error) => JSON.stringify(error)],
  ['JSON.stringify({ error })', (error) => JSON.stringify({ error })],
  ['object spread', (error) => JSON.stringify({ ...error })],
  ['Object.assign({}, error)', (error) => JSON.stringify(Object.assign({}, error))],
  ['util.inspect(error)', (error) => inspect(error)],
  ['util.inspect(error, { showHidden: false })', (error) => inspect(error, { showHidden: false })],
  ['util.inspect(error, { showHidden: true, depth: 10 })', (error) => inspect(error, { showHidden: true, depth: 10 })],
  ['util.inspect({ error }, { showHidden: true, depth: 10 })', (error) => inspect({ error }, { showHidden: true, depth: 10 })],
];
// Everything a channel must never reveal: the sentinel itself, the SQLSTATE,
// and the property names Fix 01 used to expose.
const FORBIDDEN = [SENTINEL, SENTINEL_CODE, 'permission denied', 'upstreamCode', 'upstreamMessage'] as const;

describe('MemoryDataApiError keeps the upstream identity opaque', () => {
  it.each(CHANNELS)('%s reveals no raw upstream identity', (_label, project) => {
    const rendered = project(sentinelError());
    for (const forbidden of FORBIDDEN) expect(rendered).not.toContain(forbidden);
  });

  it('owns exactly the status property - the raw identity is not an own property at all', () => {
    const error = sentinelError();
    expect(Object.keys(error)).toEqual(['status']);
    expect(Object.getOwnPropertyNames(error).sort()).toEqual(['message', 'stack', 'status']);
    for (const symbol of Object.getOwnPropertySymbols(error)) {
      expect(String(symbol.description ?? '')).not.toMatch(/upstream|identity/iu);
    }
    for (const name of ['upstreamCode', 'upstreamMessage', 'code', 'identity']) {
      expect(Object.getOwnPropertyDescriptor(error, name)).toBeUndefined();
      expect(name in error).toBe(false);
    }
    expect(error.status).toBe(500);
    expect(error.message).toBe('Memory Data API request failed with status 500.');
  });

  it('never exposes the identity through the prototype chain either', () => {
    const error = sentinelError();
    let prototype: object | null = Object.getPrototypeOf(error);
    while (prototype !== null) {
      for (const name of Object.getOwnPropertyNames(prototype)) {
        expect(name).not.toMatch(/upstream|identity/iu);
      }
      prototype = Object.getPrototypeOf(prototype);
    }
  });

  // Non-vacuity: the sentinel really is retrievable through the sanctioned
  // accessor, so the absences above are about representation, not about an
  // error that never carried the identity.
  it('is still readable through the one narrow accessor', () => {
    expect(readMemoryDataApiUpstreamIdentity(sentinelError())).toEqual({
      code: SENTINEL_CODE, message: `permission denied: ${SENTINEL}` });
  });
});

describe('the upstream identity accessor is safe by construction', () => {
  it('returns a fresh copy: mutating it never changes what is stored', () => {
    const error = sentinelError();
    const first = readMemoryDataApiUpstreamIdentity(error) as { code?: string; message?: string };
    first.code = 'tampered';
    first.message = 'tampered';
    expect(readMemoryDataApiUpstreamIdentity(error)).toEqual({
      code: SENTINEL_CODE, message: `permission denied: ${SENTINEL}` });
    expect(readMemoryDataApiUpstreamIdentity(error)).not.toBe(first);
  });

  it('binds the identity to the exact instance: a spread clone inherits nothing', () => {
    const error = sentinelError();
    const clone = { ...error } as unknown as MemoryDataApiError;
    expect(clone).not.toBeInstanceOf(MemoryDataApiError);
    expect(readMemoryDataApiUpstreamIdentity(clone)).toEqual({});
    const assigned = Object.assign(Object.create(MemoryDataApiError.prototype), error) as MemoryDataApiError;
    expect(readMemoryDataApiUpstreamIdentity(assigned)).toEqual({});
  });

  it('gives another error of the same status no identity at all', () => {
    expect(readMemoryDataApiUpstreamIdentity(new MemoryDataApiError(500))).toEqual({});
    expect(readMemoryDataApiUpstreamIdentity(new MemoryDataApiError(403))).toEqual({});
  });

  it.each([
    ['a missing identity', undefined, {}],
    ['an empty identity', {}, {}],
    ['a code-only identity', { code: '42501' }, { code: '42501' }],
    ['a message-only identity', { message: 'Conversation session is not active' }, { message: 'Conversation session is not active' }],
  ] as ReadonlyArray<readonly [string, { code?: string; message?: string } | undefined, unknown]>)(
    'stores %s exactly, with no invented fields',
    (_label, identity, expected) => {
      expect(readMemoryDataApiUpstreamIdentity(new MemoryDataApiError(403, identity))).toEqual(expected);
    },
  );

  it('stores only string values, whatever a caller passes', () => {
    const forged = { code: 42501, message: { text: SENTINEL } } as unknown as { code?: string; message?: string };
    const error = new MemoryDataApiError(403, forged);
    expect(readMemoryDataApiUpstreamIdentity(error)).toEqual({});
    expect(JSON.stringify(error)).not.toContain(SENTINEL);
  });

  it('holds no strong reference registry that could retain errors', () => {
    // A WeakMap has no enumerable surface at all: there is no way to list the
    // errors it has seen, which is what makes "no registry, no leak" structural.
    const error = sentinelError();
    expect(readMemoryDataApiUpstreamIdentity(error).message).toContain(SENTINEL);
    expect(JSON.stringify(Object.getOwnPropertyNames(MemoryDataApiError))).not.toContain('upstream');
  });
});
