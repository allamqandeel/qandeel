/**
 * S6-07 (CP3) — the governed enrollment device-proof stand-in. VALIDATION ONLY: reachable only in the S4-01 proof build
 * (`select-s401-proof-entry.mjs --apply`), never in the production bundle.
 *
 * Until a scenario is seeded nothing answers here, so the proof world behaves exactly as before (the enrollment read
 * fails and the S6-01 sentence stays). The seeds:
 *
 *   qandeel://s401-proof/introductions/enroll-closed    production: no gate, no consent text (nothing is offered)
 *   qandeel://s401-proof/introductions/enroll-open      a FIXTURE gate with the APPROVED version-1 texts: the ENROLL step
 *   qandeel://s401-proof/introductions/enroll-outdated  as enroll-open, but the first act meets a newer participation
 *                                                       version (the same approved words under a new version id)
 *   qandeel://s401-proof/introductions/enroll-enrolled  enrolled, the gate closed again: only the consent controls
 *
 * The consent texts below are copies of `database/matching-consent-texts-v1.mjs` (the one source, approved 2026-10-18),
 * so the photographs show exactly what a reader would be shown; the static contract checks they are identical. It answers
 * in the shapes `apps/api/src/introductions-enrollment` returns, and decides like 0165 only as far as the screens need.
 */
type Json = Record<string, unknown>;
type Consent = 'participation' | 'contextGrant' | 'disclosureAuthority';
type Answer = { ok: boolean; status: number; json: () => Promise<unknown> };

export const S607_PROOF_CONSENT_TEXTS = Object.freeze({
  participation: {
    version: 'MATCHING_PARTICIPATION_V1',
    textAr: 'أوافق على المشاركة في مقترحات التعارف التي يقدّمها لي قنديل، ويمكنني إيقاف مشاركتي في أي وقت.',
    textEn: 'I agree to take part in the introduction proposals QANDEEL offers me, and I can stop taking part at any time.',
  },
  contextGrant: {
    version: 'MATCHING_CONTEXT_GRANT_V1',
    textAr: 'أوافق على أن يستند قنديل إلى ما كتبته بنفسي في عالمي الخاص، لغرض التعارف وحده. لا يُنقل شيء منه إلى أي عالم آخر، ويمكنني سحب هذه الموافقة في أي وقت.',
    textEn: 'I agree that QANDEEL may draw on what I wrote myself in My World, for Introductions only. Nothing of it is moved into any other World, and I can withdraw this consent at any time.',
  },
  disclosureAuthority: {
    version: 'PRE_MATCH_DISCLOSURE_AUTHORITY_V1',
    textAr: 'أوافق على أن يقدّم قنديل للطرف الآخر مقترح تعارف خاصًا ومستقلًا قبل التوافق المتبادل، دون مشاركة أي حقل من ملف التعارف الخاص بي. ويمكنني سحب هذه الموافقة في أي وقت.',
    textEn: 'I agree that QANDEEL may show the other person a separate, private introduction proposal before a mutual match, without sharing any fields from my introduction profile. I can withdraw this consent at any time.',
  },
});

export type S607ProofAction = 'enroll-closed' | 'enroll-open' | 'enroll-outdated' | 'enroll-enrolled';

export interface S607ProofEnrollment {
  route(path: string, method: string, body: Json | undefined): Answer | undefined;
  seed(action: S607ProofAction): void;
}

export function createS607ProofEnrollment(): S607ProofEnrollment {
  let seeded = false;
  let available = false;
  let texts: Record<Consent, { version: string; textAr: string; textEn: string } | null> = { participation: null, contextGrant: null, disclosureAuthority: null };
  let outdatedOnce = false;
  let setup = { participationState: 'OFF', pauseReason: null as string | null, contextGrant: false, disclosureAuthority: false, matchable: false };
  let enrollment: Json | null = null;
  const json = (status: number, body: unknown): Answer => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const view = () => ({ available, accountDeletionPending: false, consents: { ...texts }, setup: { ...setup }, enrollment });
  const answer = (outcome: string) => json(200, { outcome, view: view() });
  const inForce = (c: Consent) => (c === 'participation' ? setup.participationState !== 'OFF' : setup[c]);
  return {
    route(path, method, body) {
      if (!seeded || !path.startsWith('/introductions/enrollment')) return undefined;
      if (path === '/introductions/enrollment' && method === 'GET') return json(200, view());
      if (method !== 'POST' || body === undefined) return json(400, { outcome: 'INVALID_REQUEST' });
      if (path === '/introductions/enrollment/revocation') {
        const consent = body.consent as Consent;
        if (!inForce(consent)) return answer('NOT_ACTIVE');
        if (consent === 'participation') setup = { ...setup, participationState: 'OFF', pauseReason: null, matchable: false };
        else setup = { ...setup, [consent]: false, matchable: false };
        return answer('REVOKED');
      }
      if (path !== '/introductions/enrollment') return json(404, {});
      if (!available) return answer('NOT_AVAILABLE_NOW');
      const consents = body.consents as Record<Consent, string | null>;
      if (outdatedOnce) {
        outdatedOnce = false;
        texts = { ...texts, participation: { ...S607_PROOF_CONSENT_TEXTS.participation, version: 'MATCHING_PARTICIPATION_V2' } };
        return answer('CONSENT_OUTDATED');
      }
      for (const c of ['participation', 'contextGrant', 'disclosureAuthority'] as const) {
        if (consents[c] !== null && consents[c] !== texts[c]?.version) return answer('CONSENT_OUTDATED');
      }
      const now = new Date().toISOString();
      if (body.kind === 'ENROLL') {
        setup = { participationState: 'ACTIVE', pauseReason: null, contextGrant: true, disclosureAuthority: true, matchable: true };
        enrollment = { enrolledDraftVersion: body.expectedDraftVersion, lastAct: 'ENROLL', lastActAt: now };
        return answer('ENROLLED');
      }
      if (body.kind === 'RECONFIRM_CONSENT') {
        setup = { ...setup, contextGrant: setup.contextGrant || consents.contextGrant !== null, disclosureAuthority: setup.disclosureAuthority || consents.disclosureAuthority !== null };
        enrollment = { ...(enrollment ?? {}), lastAct: 'RECONFIRM_CONSENT', lastActAt: now };
        return answer('RECONFIRMED');
      }
      return answer('NO_CHANGE');
    },
    seed(action) {
      seeded = true;
      outdatedOnce = action === 'enroll-outdated';
      available = action === 'enroll-open' || action === 'enroll-outdated';
      texts = action === 'enroll-closed' ? { participation: null, contextGrant: null, disclosureAuthority: null }
        : action === 'enroll-enrolled' ? { participation: null, contextGrant: null, disclosureAuthority: null } : { ...S607_PROOF_CONSENT_TEXTS };
      if (action === 'enroll-enrolled') {
        setup = { participationState: 'ACTIVE', pauseReason: null, contextGrant: true, disclosureAuthority: true, matchable: true };
        enrollment = { enrolledDraftVersion: 17, lastAct: 'ENROLL', lastActAt: new Date().toISOString() };
      } else {
        setup = { participationState: 'OFF', pauseReason: null, contextGrant: false, disclosureAuthority: false, matchable: false };
        enrollment = null;
      }
    },
  };
}
