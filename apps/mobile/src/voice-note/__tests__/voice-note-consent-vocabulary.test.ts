/**
 * S8B-04 (CP2, D4) — the phone reads the consent states the real server sends (`voice_private.consent_state_v1`, passed
 * through by the API), not words of its own. Before this, every state from a real server was refused and Voice Notes were
 * never offered. A consent to an earlier version permits nothing: it is asked for again, with R-01 above the text.
 */
import { SERVER_VOICE_CONSENT_STATES, VoiceNoteApiClient, type VoiceNoteFetch } from '../voice-note-api';
import { VOICE_CONSENT_VERSION } from '../voice-note-copy';

function client(body: unknown, status = 200) {
  const fetch = (async () => ({ status, json: async () => body })) as unknown as VoiceNoteFetch;
  return new VoiceNoteApiClient({ baseUrl: 'https://api.test', fetch });
}

const capability = (consentState: string, grantedVersion: string | null = VOICE_CONSENT_VERSION) =>
  client({ voiceNotesAvailable: true, consentState, grantedVersion, currentVersion: VOICE_CONSENT_VERSION }).capability();

describe('S8B-04 CP2 — the consent words of the real server', () => {
  it('maps exactly the four states consent_state_v1 returns', () => {
    expect(SERVER_VOICE_CONSENT_STATES).toEqual({
      GRANTED_CURRENT: 'GRANTED',
      VERSION_NOT_CURRENT: 'OUTDATED',
      NOT_GRANTED: 'NONE',
      WITHDRAWN: 'WITHDRAWN',
    });
  });

  it('GRANTED_CURRENT for the version this build carries is the only current consent', async () => {
    expect(await capability('GRANTED_CURRENT')).toEqual({
      kind: 'CAPABILITY', view: { voiceNotesAvailable: true, consentState: 'GRANTED', consentCurrent: true },
    });
    // A version this build does not carry is never current here, whatever the server says.
    const other = await capability('GRANTED_CURRENT', 'VOICE_RECORDING_V0');
    expect(other).toMatchObject({ view: { consentState: 'GRANTED', consentCurrent: false } });
  });

  it('a consent to an earlier version is OUTDATED and permits nothing; the others are read as they are', async () => {
    expect(await capability('VERSION_NOT_CURRENT', 'VOICE_RECORDING_V1')).toMatchObject({ view: { consentState: 'OUTDATED', consentCurrent: false } });
    expect(await capability('NOT_GRANTED', null)).toMatchObject({ view: { consentState: 'NONE', consentCurrent: false } });
    expect(await capability('WITHDRAWN', null)).toMatchObject({ view: { consentState: 'WITHDRAWN', consentCurrent: false } });
  });

  it("the phone's own words, or any other, are not understood: nothing is offered on them", async () => {
    for (const word of ['GRANTED', 'NONE', 'granted_current', '', 'hasOwnProperty']) {
      expect(await capability(word)).toEqual({ kind: 'UNAVAILABLE' });
    }
    expect(await client({ voiceNotesAvailable: true, grantedVersion: null, currentVersion: VOICE_CONSENT_VERSION }).capability()).toEqual({ kind: 'UNAVAILABLE' });
  });

  it('the consent read carries the mapped state', async () => {
    const read = await client({ consentState: 'VERSION_NOT_CURRENT', consentVersion: VOICE_CONSENT_VERSION, rows: [{ id: 'K-01', ar: 'أ', en: 'a' }] }).consent();
    expect(read).toEqual({ kind: 'CONSENT', version: VOICE_CONSENT_VERSION, state: 'OUTDATED', rows: [{ id: 'K-01', ar: 'أ', en: 'a' }] });
    expect(await client({ consentState: 'GRANTED', consentVersion: VOICE_CONSENT_VERSION, rows: [] }).consent()).toEqual({ kind: 'UNAVAILABLE' });
  });
});
