// S8B-04 CP2 (migration 0188): what the earlier voice verifiers (0183, 0185, 0186, 0187) re-anchor on once 0188 is applied.
//
// 0188 adds four voice_private internals (each named by its own ACL block; no role executes them; verify-migration-0188
// proves their shape) and installs VOICE_RECORDING_V3 (K-01 ... K-15, V2 with K-07, K-08 and K-13 replaced) as the one
// current consent version, in the same transaction as the Fast Voice Path. VOICE_RECORDING_V1 and V2 stay installed as
// history, unchanged and no longer current. Nothing else of 0183 / 0185 / 0186 / 0187 changes.
import { readFileSync } from 'node:fs';
import { qandeelVoiceApplied, VOICE_CONSENT_V1, VOICE_CONSENT_V2 } from './qandeel-voice-0187-anchor.mjs';

export const MIGRATION_0188 = '0188_s8b_04_fast_voice_path_v1.sql';
export const VOICE_CONSENT_V3 = 'VOICE_RECORDING_V3';
export const VOICE_CONSENT_V3_AR_SHA256 = '2550241d69c0cf2fc510c3b09e9fa857012ad4fe0360e3febb2b0d7452e0226b';
export const VOICE_CONSENT_V3_EN_SHA256 = 'b593945f15f8e0858e35befeef191d89273ab3149cdee28cd5fbcda3e080bec9';

export async function fastVoiceApplied(rows) {
  const [{ applied }] = await rows("SELECT to_regclass('voice_private.live_reply_streams') IS NOT NULL AS applied");
  return applied;
}

/** The voice_private functions 0188's ACL block names (four). */
export function voiceInternals0188() {
  const text = readFileSync(new URL(`./migrations/${MIGRATION_0188}`, import.meta.url), 'utf8');
  const acl = text.indexOf('  FOREACH fn IN ARRAY ARRAY[');
  return [...text.slice(acl, text.indexOf('] LOOP', acl)).matchAll(/'(voice_private\.[a-z_0-9]+\([^']*\))'/gu)].map((m) => m[1]);
}

/** The consent version a fixture grants: the current one (V3 once 0188 is applied, V2 once 0187 is, V1 before). */
export async function currentVoiceConsentVersion(rows) {
  if (await fastVoiceApplied(rows)) return VOICE_CONSENT_V3;
  return await qandeelVoiceApplied(rows) ? VOICE_CONSENT_V2 : VOICE_CONSENT_V1;
}

/** The approved versions kept as history beside the current one (unchanged, never current again). */
export function historicalVoiceConsentVersions(current) {
  return { [VOICE_CONSENT_V3]: [VOICE_CONSENT_V1, VOICE_CONSENT_V2], [VOICE_CONSENT_V2]: [VOICE_CONSENT_V1] }[current] ?? [];
}
