/**
 * S8A-04 CP3-C — the device-proof fixture of the owner's permissions (VALIDATION fixture guard).
 *
 * The S4-01 proof world answers the permission routes only after `knowledge('seed')` (so every earlier device leg meets
 * exactly what it met before), and what it answers is what the production strict client accepts — so a device run of the
 * CP3-C journey cannot silently fall back to an unavailable or empty state. The semantics themselves are the real-PostgreSQL
 * verifiers' (database/verify-migration-0176.mjs, 0177) and the integrated proof's; this guards the stand-in.
 */
import { SharedWorldApiClient } from '../../runtime-entry';
import { createS401ProofWorld, S8A04_PROOF_LINES } from '../__validation__/s401-proof-world';
import { S8A04_PROOF_ITEMS } from '../__validation__/s8a04-proof-permissions';

const command = (n: number) => `58a04c00-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function seeded(language: 'ar' | 'en') {
  const world = createS401ProofWorld(language);
  const client = new SharedWorldApiClient({ baseUrl: world.config.apiBaseUrl, fetch: world.fetch });
  world.knowledge('seed');
  const root = await client.root();
  const worldId = root.kind === 'READ' ? root.root.worlds.find((w) => w.name === S8A04_PROOF_LINES.world[language])?.worldId ?? '' : '';
  return { world, client, worldId };
}

describe('S8A-04 CP3-C — the permissions fixture of the proof world', () => {
  it('is off until knowledge/seed: an earlier conversation World reads as no permission at all', async () => {
    const world = createS401ProofWorld('en');
    const client = new SharedWorldApiClient({ baseUrl: world.config.apiBaseUrl, fetch: world.fetch });
    world.converse();
    const root = await client.root();
    const worldId = root.kind === 'READ' ? root.root.worlds[0]?.worldId ?? '' : '';
    expect(await client.permissions(worldId)).toEqual({ kind: 'READ', permissions: { audienceRef: null, members: [], requests: [], allowed: [], reconfirm: [], declined: [], ended: [] } });
  });

  it('seeds every section, answers once per command, refuses a stale audience, and asks again after growth', async () => {
    const { world, client, worldId } = await seeded('ar');
    const read = await client.permissions(worldId);
    if (read.kind !== 'READ') throw new Error('not read');
    const p = read.permissions;
    expect(p.members).toEqual(['هدير الاختبار']);
    expect(p.requests.map((r) => r.text)).toEqual([S8A04_PROOF_ITEMS.request.ar]);
    expect(p.allowed.map((r) => r.text)).toEqual([S8A04_PROOF_ITEMS.allowed.ar]);
    expect(p.declined.map((r) => r.text)).toEqual([S8A04_PROOF_ITEMS.declined.ar]);
    expect(p.ended.map((r) => [r.text, r.reason])).toEqual([[S8A04_PROOF_ITEMS.left.ar, 'LEFT'], [null, 'FORGOTTEN']]);

    const stale = await client.answerPermission(worldId, p.requests[0].requestId, command(1), 'ALLOW', `sha256:${'0'.repeat(64)}`);
    expect(stale).toEqual({ kind: 'AUDIENCE_CHANGED' });
    expect(await client.answerPermission(worldId, p.requests[0].requestId, command(2), 'ALLOW', p.audienceRef)).toEqual({ kind: 'ALLOWED' });
    expect(await client.answerPermission(worldId, p.requests[0].requestId, command(2), 'ALLOW', p.audienceRef)).toEqual({ kind: 'ALLOWED' });
    expect(await client.answerPermission(worldId, p.requests[0].requestId, command(3), 'ALLOW', p.audienceRef)).toEqual({ kind: 'REFUSED' });

    world.knowledge('grow');
    const grown = await client.permissions(worldId);
    if (grown.kind !== 'READ') throw new Error('not read');
    expect(grown.permissions.members).toEqual(['هدير الاختبار', 'رنا الاختبار']);
    expect(grown.permissions.allowed).toEqual([]);
    expect(grown.permissions.reconfirm.map((r) => r.newMembers)).toEqual([['رنا الاختبار'], ['رنا الاختبار']]);
    expect(await client.allowPermission(worldId, grown.permissions.reconfirm[0].itemId, command(4), p.audienceRef ?? '')).toEqual({ kind: 'AUDIENCE_CHANGED' });
    expect(await client.allowPermission(worldId, grown.permissions.reconfirm[0].itemId, command(5), grown.permissions.audienceRef ?? '')).toEqual({ kind: 'ALLOWED' });
    expect(await client.withdrawPermission(worldId, grown.permissions.reconfirm[0].itemId, command(6))).toEqual({ kind: 'WITHDRAWN' });
    expect(await client.allowPermission(worldId, p.declined[0].itemId, command(7), grown.permissions.audienceRef ?? '')).toEqual({ kind: 'ALLOWED' });

    world.knowledge('correct');
    const corrected = await client.permissions(worldId);
    if (corrected.kind !== 'READ') throw new Error('not read');
    expect(corrected.permissions.ended.filter((r) => r.reason === 'CORRECTED')).toHaveLength(2);
    expect(corrected.permissions.allowed.concat(corrected.permissions.reconfirm)).toEqual([]);
  });

  it('a World the reader is not in reads as the one neutral denial', async () => {
    const { client } = await seeded('en');
    expect(await client.permissions('58a04c00-0000-4000-8000-ffffffffffff')).toEqual({ kind: 'DENIED' });
  });
});
