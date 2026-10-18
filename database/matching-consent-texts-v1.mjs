// S6-07 (CP3) — version 1 of the three Matching enrollment consent texts (group B of the CP3 Product Copy Gate), APPROVED
// word for word by the Product Owner on 2026-10-18 («S6-07 — CP3 Copy Gate APPROVED / Resume Implementation»): CT-P and
// CT-D as amended by that decision, CT-C unchanged. Recorded in docs/e2e/QANDEEL_S6_07_IMPLEMENTATION_RECORD_v1.md §11.5.
//
// This module is the ONE source of these texts in the repository. Nothing ships them: the app shows exactly the current
// text the server returns, and only the operator installer (`install-matching-consent-texts.mjs`) puts them into the
// 0165 catalogue, through its own operator function. Each text carries the SHA-256 of its UTF-8 bytes; the module refuses
// to load if a text and its pin disagree, so changing a single character is a visible, reviewed change of BOTH — and a
// changed text is a NEW version (an installed version is never rewritten: 0165 consent_texts_immutable).
import { createHash } from 'node:crypto';

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

export const MATCHING_CONSENT_TEXTS_V1 = Object.freeze([
  Object.freeze({
    copyId: 'CT-P',
    purpose: 'MATCHING_PARTICIPATION',
    version: 'MATCHING_PARTICIPATION_V1',
    textAr: 'أوافق على المشاركة في مقترحات التعارف التي يقدّمها لي قنديل، ويمكنني إيقاف مشاركتي في أي وقت.',
    textEn: 'I agree to take part in the introduction proposals QANDEEL offers me, and I can stop taking part at any time.',
    sha256Ar: 'f3e839091f7485f46dc57d67b1a9de3e3cc39038a49fe6817b303f6bd48c65a0',
    sha256En: '803b56aed60d09f87b0eea140df4e008d1d24ad0f549862890be990d9570d49e',
  }),
  Object.freeze({
    copyId: 'CT-C',
    purpose: 'MATCHING_CONTEXT_GRANT',
    version: 'MATCHING_CONTEXT_GRANT_V1',
    textAr: 'أوافق على أن يستند قنديل إلى ما كتبته بنفسي في عالمي الخاص، لغرض التعارف وحده. لا يُنقل شيء منه إلى أي عالم آخر، ويمكنني سحب هذه الموافقة في أي وقت.',
    textEn: 'I agree that QANDEEL may draw on what I wrote myself in My World, for Introductions only. Nothing of it is moved into any other World, and I can withdraw this consent at any time.',
    sha256Ar: '25a0b509d8f9367120629fa8dbf876d7a58087601dc008b781df5548d8f324c6',
    sha256En: '74a69ae7748f457aa5a9f1246c40171ac14c80409e18b963cf82a749cace3a15',
  }),
  Object.freeze({
    copyId: 'CT-D',
    purpose: 'PRE_MATCH_DISCLOSURE_AUTHORITY',
    version: 'PRE_MATCH_DISCLOSURE_AUTHORITY_V1',
    textAr: 'أوافق على أن يقدّم قنديل للطرف الآخر مقترح تعارف خاصًا ومستقلًا قبل التوافق المتبادل، دون مشاركة أي حقل من ملف التعارف الخاص بي. ويمكنني سحب هذه الموافقة في أي وقت.',
    textEn: 'I agree that QANDEEL may show the other person a separate, private introduction proposal before a mutual match, without sharing any fields from my introduction profile. I can withdraw this consent at any time.',
    sha256Ar: '78b89a29bad20269772d623f9a8c730b5aaf8015fb3a8bc71cc94edf9c2899d4',
    sha256En: '2e948091b87e85f8f9c3b8a323f253bc04ed2d9c69531550e438d6d3460b410b',
  }),
]);

for (const text of MATCHING_CONSENT_TEXTS_V1) {
  if (sha256(text.textAr) !== text.sha256Ar || sha256(text.textEn) !== text.sha256En) {
    throw new Error(`matching-consent-texts-v1: ${text.copyId} does not match its approved pin; a changed text is a new version, approved again`);
  }
}
