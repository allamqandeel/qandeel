/**
 * S7-05 — the real-device proof world (VALIDATION ONLY) answers only what the captured journey answered, or drops a
 * connection: each fault once, then the captured answer; revocation is the captured withdrawn scene.
 */
import { createS705ProofWorld, s705ProofScenario } from '../__validation__/s705-proof-world';
import { S704_PROOF_CONFIG } from '../__validation__/s704-proof-world';
import { PLAYER_IDS, PLAYER_WIRE } from '../../replay-player/__fixtures__/player-wire';

const BASE = S704_PROOF_CONFIG.apiBaseUrl;
const source = `${BASE}/replay/${PLAYER_IDS.source}/versions/${PLAYER_IDS.sourceVersion}`;
const draftBody = () => JSON.stringify(PLAYER_WIRE.steps.draft.request.body);

describe('S7-05 proof world', () => {
  it('reads its scenario from the launch link alone, and anything else is the plain journey', () => {
    expect(s705ProofScenario('qandeel://s705-proof/faults')).toBe('faults');
    expect(s705ProofScenario('qandeel://s705-proof/revoked')).toBe('revoked');
    expect(s705ProofScenario('qandeel://s705-proof/journey')).toBe('journey');
    expect(s705ProofScenario('qandeel://s705-proof/anything')).toBe('journey');
    expect(s705ProofScenario(null)).toBe('journey');
  });

  it('faults: the first save is dropped, the retry gets the captured answer', async () => {
    const world = createS705ProofWorld('faults');
    await expect(world.fetch(`${BASE}/replay/drafts`, { method: 'POST', body: draftBody() })).rejects.toThrow('the network dropped');
    const again = await world.fetch(`${BASE}/replay/drafts`, { method: 'POST', body: draftBody() });
    expect(again.status).toBe(PLAYER_WIRE.steps.draft.status);
    expect(await again.json()).toEqual(PLAYER_WIRE.steps.draft.body);
  });

  it('journey and revoked drop nothing; revoked reads the source version as the captured withdrawn scene', async () => {
    const journey = createS705ProofWorld('journey');
    expect((await journey.fetch(`${BASE}/replay/drafts`, { method: 'POST', body: draftBody() })).status).toBe(PLAYER_WIRE.steps.draft.status);
    expect(await (await journey.fetch(source)).json()).toEqual(PLAYER_WIRE.scenes.source.version);

    const revoked = createS705ProofWorld('revoked');
    expect(await (await revoked.fetch(source)).json()).toEqual(PLAYER_WIRE.scenes.sourceWithdrawn.version);
    expect(await (await revoked.fetch(`${source}/moments`)).json()).toEqual(PLAYER_WIRE.scenes.sourceWithdrawn.moments);
  });
});
