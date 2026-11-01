// S8B-04 CP1 (migration 0187): what the earlier voice verifiers (0183, 0185, 0186) re-anchor on once 0187 is applied.
//
// 0187 adds six voice_private internals (each named by its own ACL block; no role executes them; verify-migration-0187
// proves their shape) and installs VOICE_RECORDING_V2 (K-01 ... K-15) as the one current consent version. VOICE_RECORDING_V1
// stays installed as history, no longer current. Nothing else of 0183 / 0185 / 0186 changes.
import { readFileSync } from 'node:fs';

export const MIGRATION_0187 = '0187_s8b_04_qandeel_voice_v1.sql';
export const VOICE_CONSENT_V1 = 'VOICE_RECORDING_V1';
export const VOICE_CONSENT_V2 = 'VOICE_RECORDING_V2';
export const VOICE_CONSENT_V2_AR_SHA256 = '84b546b49ed718f683bc38388c9191310da125b853a6d6d0e2a97466d3141740';
export const VOICE_CONSENT_V2_EN_SHA256 = 'c3297ff4142651fb7b175060172c92769570ca636ec3f0572d15bb479dc5ccce';

export async function qandeelVoiceApplied(rows) {
  const [{ applied }] = await rows("SELECT to_regclass('voice_private.reply_speech_segments') IS NOT NULL AS applied");
  return applied;
}

/** The voice_private functions 0187's ACL block names (six). */
export function voiceInternals0187() {
  const text = readFileSync(new URL(`./migrations/${MIGRATION_0187}`, import.meta.url), 'utf8');
  const acl = text.indexOf('  FOREACH fn IN ARRAY ARRAY[');
  return [...text.slice(acl, text.indexOf('] LOOP', acl)).matchAll(/'(voice_private\.[a-z_0-9]+\([^']*\))'/gu)].map((m) => m[1]);
}

/** The consent version a fixture grants: the current one (V2 once 0187 is applied, V1 before). */
export async function currentVoiceConsentVersion(rows) {
  return await qandeelVoiceApplied(rows) ? VOICE_CONSENT_V2 : VOICE_CONSENT_V1;
}
