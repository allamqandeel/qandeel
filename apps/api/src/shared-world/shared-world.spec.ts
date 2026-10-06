import { randomBytes } from 'node:crypto';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { DataApiError } from '../conversation/supabase-data-api.service';
import { ROUTE_RATE_LIMIT_CENSUS } from '../http-security/route-rate-limit.census';
import { drawSharedId, parseSealingKeys, SharedIdSealing, sharedIdLookupRef } from './shared-id-sealing';
import type { SharedWorldLifecycleRepository } from './shared-world-lifecycle.repository';
import { fromBytea, toBytea, type SharedIdRow, type SharedWorldRepository } from './shared-world.repository';
import { SharedWorldService } from './shared-world.service';

const KEY_1 = randomBytes(32).toString('base64');
const KEY_2 = randomBytes(32).toString('base64');
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const WORLD = '33333333-3333-4333-8333-333333333333';
const INVITATION = '44444444-4444-4444-8444-444444444444';
const COMMAND = '55555555-5555-4555-8555-555555555555';
const CANONICAL = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/u;

function withKeys<T>(env: Record<string, string | undefined>, build: () => T): T {
  const saved = { keys: process.env.QANDEEL_SHARED_ID_SEALING_KEYS, active: process.env.QANDEEL_SHARED_ID_SEALING_ACTIVE_VERSION };
  process.env.QANDEEL_SHARED_ID_SEALING_KEYS = env.keys;
  process.env.QANDEEL_SHARED_ID_SEALING_ACTIVE_VERSION = env.active;
  if (env.keys === undefined) delete process.env.QANDEEL_SHARED_ID_SEALING_KEYS;
  if (env.active === undefined) delete process.env.QANDEEL_SHARED_ID_SEALING_ACTIVE_VERSION;
  try {
    return build();
  } finally {
    if (saved.keys === undefined) delete process.env.QANDEEL_SHARED_ID_SEALING_KEYS; else process.env.QANDEEL_SHARED_ID_SEALING_KEYS = saved.keys;
    if (saved.active === undefined) delete process.env.QANDEEL_SHARED_ID_SEALING_ACTIVE_VERSION; else process.env.QANDEEL_SHARED_ID_SEALING_ACTIVE_VERSION = saved.active;
  }
}
const sealing = (active = '1') => withKeys({ keys: `1:${KEY_1},2:${KEY_2}`, active }, () => new SharedIdSealing());
/** S4-03 (migration 0140): the committed World names and the reader's closed Worlds, as the root and the entry read them. */
const CLOSED = '66666666-6666-4666-8666-666666666666';
const REQUEST = '77777777-7777-4777-8777-777777777777';
const JOINABLE = '88888888-8888-4888-8888-888888888888';
const lifecycle = (named: string | null = null) => ({
  worldNames: jest.fn(async () => (named === null ? [] : [{ world_id: WORLD, world_name: named }])),
  closedWorlds: jest.fn(async () => [{ world_id: CLOSED, closed_at: '2026-10-05T00:00:00Z', world_name: null }]),
  closedMembers: jest.fn(async () => [{ world_id: CLOSED, is_self: true, member_name: 'Amal' }, { world_id: CLOSED, is_self: false, member_name: 'Chadi' }]),
  membershipRequests: jest.fn(async () => [{ request_id: REQUEST, world_id: JOINABLE, request_kind: 'ADD_MEMBER', proposer_name: 'Dalia', created_at: '2026-10-05T00:00:00Z' }]),
}) as unknown as SharedWorldLifecycleRepository;

/** An in-memory stand-in for migration 0138: one account's credential and sealed value. */
function fakeDatabase(start: { state?: SharedIdRow['state']; provisioning?: boolean } = {}) {
  let epoch = start.state && start.state !== 'ABSENT' ? 1 : 0;
  let ref: string | null = epoch ? 'sid1:legacy' : null;
  let sealed: { epoch: number; ref: string; keyVersion: number; nonce: Buffer; ciphertext: Buffer; tag: Buffer } | null = null;
  const committed = new Map<string, number>();
  const calls: { name: string; body: Record<string, unknown> }[] = [];
  const repository = {
    readSharedId: jest.fn(async () => {
      calls.push({ name: 'read', body: {} });
      const row: SharedIdRow = epoch === 0
        ? { state: 'ABSENT', credential_epoch: null, credential_lookup_ref: null, key_version: null, nonce: null, ciphertext: null, auth_tag: null, provisioning_available: start.provisioning ?? true }
        : sealed && sealed.epoch === epoch && sealed.ref === ref
          ? { state: 'SEALED', credential_epoch: String(epoch), credential_lookup_ref: ref, key_version: sealed.keyVersion, nonce: toBytea(sealed.nonce), ciphertext: toBytea(sealed.ciphertext), auth_tag: toBytea(sealed.tag), provisioning_available: true }
          : { state: 'UNSEALED', credential_epoch: String(epoch), credential_lookup_ref: null, key_version: null, nonce: null, ciphertext: null, auth_tag: null, provisioning_available: true };
      return [row];
    }),
    rotateSharedId: jest.fn(async (_token: string, commandId: string, expected: string | null, value: string, s: { keyVersion: number; nonce: Buffer; ciphertext: Buffer; tag: Buffer }) => {
      calls.push({ name: 'rotate', body: { commandId, expected, value } });
      if (committed.has(commandId)) return [{ outcome: 'ROTATED', credential_epoch: String(committed.get(commandId)) }];
      if (expected === null && start.provisioning === false) return [{ outcome: 'UNAVAILABLE', credential_epoch: null }];
      if ((expected === null ? 0 : Number(expected)) !== epoch) throw new DataApiError(409, { databaseCode: '40001', databaseMessage: 'SHARED_INVITE_CREDENTIAL_STALE_STATE' });
      epoch += 1;
      ref = sharedIdLookupRef(value);
      sealed = { epoch, ref, ...s };
      committed.set(commandId, epoch);
      return [{ outcome: 'ROTATED', credential_epoch: String(epoch) }];
    }),
    capabilities: jest.fn(async () => [{ invitation_available: true, birth_available: true }]),
    listWorlds: jest.fn(async () => [{ world_id: WORLD, born_at: '2026-10-05T00:00:00Z', joined_at: '2026-10-05T00:00:00Z' }]),
    listMembers: jest.fn(async () => [
      { world_id: WORLD, is_self: true, member_name: 'Amal', joined_at: '2026-10-05T00:00:00Z' },
      { world_id: WORLD, is_self: false, member_name: 'Bassem', joined_at: '2026-10-05T00:00:00Z' },
    ]),
    listInvitations: jest.fn(async () => [{ invitation_id: INVITATION, inviter_name: 'Bassem', created_at: '2026-10-05T00:00:00Z' }]),
    submitInvitation: jest.fn(async () => [{ outcome: 'SUBMITTED' }]),
    accept: jest.fn(async () => [{ outcome: 'BORN', world_id: WORLD }]),
    decline: jest.fn(async () => [{ outcome: 'DECLINED' }]),
    resolveEntry: jest.fn(async (_token: string, worldId: string) => [
      worldId === WORLD ? { outcome: 'ALLOW', world_id: WORLD, born_at: '2026-10-05T00:00:00Z', joined_at: '2026-10-05T00:00:00Z' }
        : { outcome: 'UNAVAILABLE', world_id: null, born_at: null, joined_at: null }]),
  };
  return { repository: repository as unknown as SharedWorldRepository, raw: repository, calls, tamper: () => { if (sealed) sealed.ciphertext[0] ^= 1; } };
}

describe('S4-01 Shared ID sealing', () => {
  it('draws canonical 60-bit Shared IDs and derives 0129\'s lookup reference', () => {
    const drawn = new Set(Array.from({ length: 200 }, drawSharedId));
    for (const value of drawn) expect(value).toMatch(CANONICAL);
    expect(drawn.size).toBe(200);
    expect(sharedIdLookupRef('K7QM-4XWD-P9TR')).toMatch(/^sid1:[0-9a-f]{64}$/u);
  });

  it('seals and opens only for the same account, epoch and reference', () => {
    const s = sealing();
    const value = drawSharedId();
    const sealed = s.seal(USER, '3', value);
    expect(sealed.ciphertext.length).toBe(14);
    expect(sealed.nonce.length).toBe(12);
    expect(sealed.tag.length).toBe(16);
    expect(sealed.ciphertext.toString('utf8')).not.toContain(value.slice(0, 4));
    expect(s.open(USER, '3', sharedIdLookupRef(value), sealed)).toBe(value);
    expect(s.open(OTHER, '3', sharedIdLookupRef(value), sealed)).toBeNull();
    expect(s.open(USER, '4', sharedIdLookupRef(value), sealed)).toBeNull();
    expect(s.open(USER, '3', sharedIdLookupRef(drawSharedId()), sealed)).toBeNull();
  });

  it('opens values sealed under an older key version after the active version moves', () => {
    const value = drawSharedId();
    const old = sealing('1').seal(USER, '1', value);
    const rotated = sealing('2');
    expect(rotated.seal(USER, '2', value).keyVersion).toBe(2);
    expect(rotated.open(USER, '1', sharedIdLookupRef(value), old)).toBe(value);
  });

  it('fails closed on absent, malformed or partial key configuration', () => {
    expect(parseSealingKeys({})).toBeNull();
    expect(parseSealingKeys({ QANDEEL_SHARED_ID_SEALING_KEYS: `1:${KEY_1}` })).toBeNull();
    expect(parseSealingKeys({ QANDEEL_SHARED_ID_SEALING_KEYS: `1:${KEY_1}`, QANDEEL_SHARED_ID_SEALING_ACTIVE_VERSION: '2' })).toBeNull();
    expect(parseSealingKeys({ QANDEEL_SHARED_ID_SEALING_KEYS: '1:short', QANDEEL_SHARED_ID_SEALING_ACTIVE_VERSION: '1' })).toBeNull();
    expect(parseSealingKeys({ QANDEEL_SHARED_ID_SEALING_KEYS: `1:${KEY_1},1:${KEY_2}`, QANDEEL_SHARED_ID_SEALING_ACTIVE_VERSION: '1' })).toBeNull();
    const none = withKeys({}, () => new SharedIdSealing());
    expect(none.available).toBe(false);
    expect(() => none.seal(USER, '1', drawSharedId())).toThrow('Shared ID sealing is not configured.');
  });

  it('carries bytea as PostgREST hex text both ways', () => {
    const bytes = randomBytes(14);
    expect(fromBytea(toBytea(bytes))?.equals(bytes)).toBe(true);
    expect(fromBytea('not hex')).toBeNull();
  });
});

describe('S4-01 Shared World Product boundary', () => {
  it('provisions a first Shared ID automatically, then reads the same value back', async () => {
    const db = fakeDatabase();
    const service = new SharedWorldService(db.repository, sealing(), lifecycle());
    const first = await service.identity(USER, 'token');
    expect(first.status).toBe('READY');
    if (first.status !== 'READY') return;
    expect(first.sharedId).toMatch(CANONICAL);
    expect(await service.identity(USER, 'token')).toEqual(first);
    expect(db.raw.rotateSharedId).toHaveBeenCalledTimes(1);
  });

  it('provisions nothing while Shared is closed', async () => {
    const db = fakeDatabase({ provisioning: false });
    const service = new SharedWorldService(db.repository, sealing(), lifecycle());
    expect(await service.identity(USER, 'token')).toEqual({ status: 'UNAVAILABLE' });
    expect(db.raw.rotateSharedId).not.toHaveBeenCalled();
  });

  it('replaces an UNSEALED credential and regenerates on request with a new value', async () => {
    const db = fakeDatabase({ state: 'UNSEALED' });
    const service = new SharedWorldService(db.repository, sealing(), lifecycle());
    const first = await service.identity(USER, 'token');
    expect(first.status).toBe('READY');
    const regenerated = await service.regenerate(USER, 'token', { commandId: COMMAND });
    expect(regenerated.status).toBe('READY');
    expect(regenerated).not.toEqual(first);
    // A lost answer retried with the same command answers the committed truth and rotates nothing more.
    expect(await service.regenerate(USER, 'token', { commandId: COMMAND })).toEqual(regenerated);
    expect(db.calls.filter((c) => c.name === 'rotate' && c.body.commandId === COMMAND)).toHaveLength(2);
  });

  it('never shows a sealed value it cannot prove current, and never silently replaces it', async () => {
    const db = fakeDatabase();
    const service = new SharedWorldService(db.repository, sealing(), lifecycle());
    await service.identity(USER, 'token');
    db.tamper();
    await expect(service.identity(USER, 'token')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(db.raw.rotateSharedId).toHaveBeenCalledTimes(1);
  });

  it('fails the Shared ID routes closed without a key', async () => {
    const db = fakeDatabase();
    const service = new SharedWorldService(db.repository, withKeys({}, () => new SharedIdSealing()), lifecycle());
    await expect(service.identity(USER, 'token')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(db.raw.readSharedId).not.toHaveBeenCalled();
  });

  it('returns Product-safe root, invitation and entry answers', async () => {
    const db = fakeDatabase();
    const service = new SharedWorldService(db.repository, sealing(), lifecycle());
    expect(await service.root('token')).toEqual({
      capabilities: { invitation: true, birth: true },
      worlds: [{ worldId: WORLD, name: null, members: [{ name: 'Amal', self: true }, { name: 'Bassem', self: false }] }],
      invitations: [{ invitationId: INVITATION, inviterName: 'Bassem' }],
      closedWorlds: [{ worldId: CLOSED, name: null, members: [{ name: 'Amal', self: true }, { name: 'Chadi', self: false }] }],
      // The target of an add sees who proposed it, and nothing of the World.
      memberRequests: [{ requestId: REQUEST, worldId: JOINABLE, kind: 'ADD', proposerName: 'Dalia' }],
    });
    expect(await service.invite('token', { commandId: COMMAND, sharedId: 'k7qm 4xwd p9tr' })).toEqual({ outcome: 'SUBMITTED' });
    expect(await service.accept('token', INVITATION, { commandId: COMMAND })).toEqual({ outcome: 'BORN', worldId: WORLD });
    expect(await service.decline('token', INVITATION, { commandId: COMMAND })).toEqual({ outcome: 'DECLINED' });
    expect(await service.entry('token', WORLD)).toEqual({ outcome: 'ALLOW',
      world: { worldId: WORLD, bornAt: '2026-10-05T00:00:00Z', name: null, members: [{ name: 'Amal', self: true }, { name: 'Bassem', self: false }] } });
    expect(await service.entry('token', OTHER)).toEqual({ outcome: 'UNAVAILABLE' });
    expect(await service.entry('token', 'not-a-world')).toEqual({ outcome: 'UNAVAILABLE' });
    expect(db.raw.resolveEntry).toHaveBeenCalledTimes(2);
  });

  it('S4-03: a committed World name becomes the label in the root and the entry; before it, the S4-01 member-name label stays', async () => {
    const db = fakeDatabase();
    const service = new SharedWorldService(db.repository, sealing(), lifecycle('Our Lantern'));
    const root = await service.root('token');
    expect(root.worlds).toEqual([{ worldId: WORLD, name: 'Our Lantern', members: [{ name: 'Amal', self: true }, { name: 'Bassem', self: false }] }]);
    expect(await service.entry('token', WORLD)).toMatchObject({ outcome: 'ALLOW', world: { name: 'Our Lantern' } });
  });

  it('takes no account, inviter or target from a request and refuses malformed commands', async () => {
    const db = fakeDatabase();
    const service = new SharedWorldService(db.repository, sealing(), lifecycle());
    await expect(service.invite('token', { commandId: COMMAND, sharedId: 'x', targetUserId: OTHER })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.invite('token', { commandId: 'nope', sharedId: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.accept('token', INVITATION, { commandId: COMMAND, worldId: WORLD })).rejects.toBeInstanceOf(BadRequestException);
    expect(await service.accept('token', 'nope', { commandId: COMMAND })).toEqual({ outcome: 'NOT_ACCEPTABLE' });
    expect(db.raw.submitInvitation).not.toHaveBeenCalled();
  });

  it('turns a transport failure into one neutral unavailability', async () => {
    const db = fakeDatabase();
    db.raw.submitInvitation.mockRejectedValueOnce(new DataApiError(500));
    const service = new SharedWorldService(db.repository, sealing(), lifecycle());
    await expect(service.invite('token', { commandId: COMMAND, sharedId: 'K7QM-4XWD-P9TR' })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('classifies every Shared route, throttling Shared ID submission and regeneration', () => {
    expect(ROUTE_RATE_LIMIT_CENSUS['POST /shared/invitations']).toBe('SECURITY_SENSITIVE');
    expect(ROUTE_RATE_LIMIT_CENSUS['POST /shared/identity/regenerate']).toBe('SECURITY_SENSITIVE');
    expect(ROUTE_RATE_LIMIT_CENSUS['GET /shared/worlds/:worldId']).toBe('AUTHENTICATED');
  });
});
