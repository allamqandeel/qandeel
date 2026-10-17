import type { IntroductionWorldRepository } from './introduction-world.repository';
import { IntroductionWorldService } from './introduction-world.service';

// ACCT-DEL-01 (P-2) — after the other human's account erasure, the counterpart's retained view reaches this service
// through the frozen S6-05 shapes and nothing new (migration 0164): the list row keeps the proposal identity they held
// (a UUID, which `worldOf` requires) with no name; the live read is one empty ENDED row, so the client opens the closed
// history; the closed history is their own words only, each deletable by them. These are exactly the rows 0164's
// replaced readers answer (verify-migration-0164 E01 / E12 prove the database side against real PostgreSQL).

const WORLD = '11111111-1111-4111-8111-111111111111';
const PROPOSAL = '22222222-2222-4222-8222-222222222222';
const MINE = '44444444-4444-4444-8444-444444444444';
const MINE_EARLIER = '55555555-5555-4555-8555-555555555555';
const AT = '2026-10-17T09:40:19.123456+00:00';
const EARLIER = '2026-10-17T09:40:18.000001+00:00';

describe('ACCT-DEL-01 — a retained Introduction World through IntroductionWorldService', () => {
  const service = (rows: { worlds?: unknown[]; messages?: unknown[]; history?: unknown[] }) => new IntroductionWorldService({
    worlds: jest.fn().mockResolvedValue(rows.worlds ?? []),
    messages: jest.fn().mockResolvedValue(rows.messages ?? []),
    history: jest.fn().mockResolvedValue(rows.history ?? []),
    send: jest.fn(),
  } as unknown as IntroductionWorldRepository);

  it('is listed ENDED with the proposal identity the reader held and no name - alongside every other World, none rejected', async () => {
    const s = service({ worlds: [
      { world_id: WORLD, matching_proposal_id: PROPOSAL, introduction_state: 'ENDED', other_first_name: null },
      { world_id: MINE, matching_proposal_id: MINE_EARLIER, introduction_state: 'ACTIVE', other_first_name: 'Lina' },
    ] });
    await expect(s.worlds('token')).resolves.toEqual({ worlds: [
      { worldId: WORLD, proposalId: PROPOSAL, state: 'ENDED', otherFirstName: null },
      { worldId: MINE, proposalId: MINE_EARLIER, state: 'ACTIVE', otherFirstName: 'Lina' },
    ] });
  });

  it('the live read answers ENDED, exactly as after an ordinary END', async () => {
    const s = service({ messages: [{ introduction_state: 'ENDED', material_id: null, established_at: null, is_self: null, text_body: null }] });
    await expect(s.messages('token', WORLD)).resolves.toEqual({ outcome: 'ENDED' });
  });

  it('the closed history is the reader\'s own words, oldest first, each deletable by them', async () => {
    const s = service({ history: [
      { introduction_state: 'ENDED', material_id: MINE, established_at: AT, is_self: true, text_body: 'my second' },
      { introduction_state: 'ENDED', material_id: MINE_EARLIER, established_at: EARLIER, is_self: true, text_body: 'my first' },
    ] });
    await expect(s.history('token', WORLD)).resolves.toEqual({ outcome: 'ENDED', hasOlder: false, messages: [
      { materialId: MINE_EARLIER, producer: 'SELF', text: 'my first', establishedAt: EARLIER, canDelete: true },
      { materialId: MINE, producer: 'SELF', text: 'my second', establishedAt: AT, canDelete: true },
    ] });
  });

  it('after the reader deletes their last retained word, the history is the truthful empty ENDED answer', async () => {
    const s = service({ history: [{ introduction_state: 'ENDED', material_id: null, established_at: null, is_self: null, text_body: null }] });
    await expect(s.history('token', WORLD)).resolves.toEqual({ outcome: 'ENDED', messages: [], hasOlder: false });
  });
});
