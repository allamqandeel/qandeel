/**
 * S6-07 (CP3) — the two new wire shapes, decoded STRICTLY: the Introductions Direct Entry destination of Activity's
 * `open`, and the per-Introduction alerts. A doubtful answer is never interpreted.
 */
import { decodeOpen } from '../activity-api';
import { IntroductionAlertsApiClient, decodeIntroductionWorldAlert } from '../introduction-alerts-api';

const W = '33333333-3333-4333-8333-333333333333';
const P = '66666666-6666-4666-8666-666666666666';
const enter = (destination: unknown) => decodeOpen({ outcome: 'ENTER', destination });

describe('S6-07 — the Introductions Direct Entry destination', () => {
  it('names one exact World or one exact proposal, and nothing else', () => {
    expect(enter({ kind: 'INTRODUCTIONS', target: { kind: 'WORLD', worldId: W } })).toEqual({ kind: 'ENTER', destination: { kind: 'INTRODUCTIONS', target: { kind: 'WORLD', worldId: W } } });
    expect(enter({ kind: 'INTRODUCTIONS', target: { kind: 'PROPOSAL', proposalId: P } })).toEqual({ kind: 'ENTER', destination: { kind: 'INTRODUCTIONS', target: { kind: 'PROPOSAL', proposalId: P } } });
  });

  it('anything doubtful is FAILED, never a guessed destination', () => {
    for (const destination of [
      { kind: 'INTRODUCTIONS' }, { kind: 'INTRODUCTIONS', target: { kind: 'WORLD', worldId: 'x' } },
      { kind: 'INTRODUCTIONS', target: { kind: 'WORLD', worldId: W, proposalId: P } }, { kind: 'INTRODUCTIONS', target: { kind: 'PROPOSAL', worldId: W } },
      { kind: 'INTRODUCTIONS', target: { kind: 'RELATIONS', experienceId: W } }, { kind: 'INTRODUCTIONS', target: { kind: 'WORLD', worldId: W }, extra: 1 },
    ]) expect(enter(destination)).toEqual({ kind: 'FAILED' });
  });
});

describe('S6-07 — the per-Introduction alerts', () => {
  it('decodes exactly a World, its state, the presented first name or null, and its mute', () => {
    expect(decodeIntroductionWorldAlert({ worldId: W, state: 'ACTIVE', otherFirstName: 'Mona', muted: true })).toEqual({ worldId: W, state: 'ACTIVE', otherFirstName: 'Mona', muted: true });
    for (const bad of [{ worldId: W, state: 'MATCHED', otherFirstName: null, muted: false }, { worldId: W, state: 'ACTIVE', otherFirstName: ' ', muted: false },
      { worldId: W, state: 'ACTIVE', otherFirstName: null, muted: 'no' }, { worldId: W, state: 'ACTIVE', otherFirstName: null, muted: false, name: 'x' }]) {
      expect(decodeIntroductionWorldAlert(bad)).toBeNull();
    }
  });

  it('a set answer is the server\'s word; UNAVAILABLE is NOT_A_WORLD; anything else UNAVAILABLE', async () => {
    const client = (status: number, body: unknown) => new IntroductionAlertsApiClient({ baseUrl: 'https://api.test', fetch: async () => ({ ok: status < 300, status, json: async () => body }) });
    await expect(client(200, { outcome: 'MUTED' }).setAlerts(W, true)).resolves.toEqual({ kind: 'MUTED' });
    await expect(client(200, { outcome: 'UNAVAILABLE' }).setAlerts(W, true)).resolves.toEqual({ kind: 'NOT_A_WORLD' });
    await expect(client(503, {}).setAlerts(W, true)).resolves.toEqual({ kind: 'UNAVAILABLE' });
    await expect(client(200, { worlds: [{ worldId: W, state: 'ENDED', otherFirstName: null, muted: false }, { worldId: W, state: 'ENDED', otherFirstName: null, muted: false }] }).alerts())
      .resolves.toEqual({ kind: 'UNAVAILABLE' });
  });
});
