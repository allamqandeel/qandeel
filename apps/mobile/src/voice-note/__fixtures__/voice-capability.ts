/**
 * Test fixture: the voice capability route and a current-consent answer, for a test outside voice-note/ that drives a
 * harness over the real runtime (S8B-03: only voice-note/ names a voice route; S8B-06 CP3's call composition test needs
 * the consent the call asks for).
 */
import { VOICE_CONSENT_VERSION } from '../voice-note-copy';

export const VOICE_CAPABILITY_ROUTE = '/voice/capability';

export function currentConsentCapability(): { readonly status: 200; readonly body: Record<string, unknown> } {
  return {
    status: 200,
    body: { voiceNotesAvailable: true, consentState: 'GRANTED_CURRENT', grantedVersion: VOICE_CONSENT_VERSION, currentVersion: VOICE_CONSENT_VERSION },
  };
}
