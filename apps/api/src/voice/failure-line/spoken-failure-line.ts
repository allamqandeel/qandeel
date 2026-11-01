import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { replyLanguage } from '../../speech-rendering/arabic-text';

/**
 * S8B-04 (CP1, contract v1.2 §11.3, AC-18) — the fixed spoken failure line, Copy Gate row F-01, APPROVED by the Product
 * Owner for CP1 (2026-11-01), verbatim. It covers both cases: audio that never started and audio cut off mid-way. It is a
 * pre-recorded file per language (chosen by listening), never synthesized at run time; S8B-05 plays it in calls. Its
 * language is the reply's (an English reply hears the English line), which narrows contract §4.5 «in neutral MSA».
 *
 * CP1 ships the contract and the structure only - NO audio file (the Product Owner: «لا تولّد ملفات صوت جديدة الآن»):
 * `apps/api/fixtures/voice-tts/manifest.json` declares the state, NOT_INSTALLED until the files are chosen. Once installed,
 * each file is pinned by its sha256 and verified when loaded; a file that does not match refuses to load.
 */
export const SPOKEN_FAILURE_LINE = Object.freeze({
  id: 'F-01',
  ar: 'تعذّر إكمال الرد الصوتي. الكتابة متاحة.',
  en: "The spoken reply couldn't be completed. Writing is available.",
});

export type FailureLineLanguage = 'ar' | 'en';

interface ManifestFile { readonly file: string; readonly sha256: string; readonly contentType: 'audio/wav' }
interface FailureLineManifest {
  readonly line: 'F-01';
  readonly state: 'NOT_INSTALLED' | 'INSTALLED';
  readonly files: { readonly ar: ManifestFile | null; readonly en: ManifestFile | null };
}

export type LoadedFailureLine =
  | { readonly state: 'NOT_INSTALLED' }
  | { readonly state: 'READY'; readonly audio: Readonly<Record<FailureLineLanguage, Buffer>> };

export const VOICE_TTS_FIXTURES_DIR = resolve(__dirname, '../../../fixtures/voice-tts');

/** Reads the manifest and, when installed, both files, each verified against its pinned sha256. Throws on any mismatch. */
export function loadSpokenFailureLine(dir: string = VOICE_TTS_FIXTURES_DIR): LoadedFailureLine {
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as FailureLineManifest;
  if (manifest.line !== SPOKEN_FAILURE_LINE.id) throw new Error('SPOKEN_FAILURE_LINE_MANIFEST_INVALID');
  if (manifest.state === 'NOT_INSTALLED') {
    if (manifest.files.ar !== null || manifest.files.en !== null) throw new Error('SPOKEN_FAILURE_LINE_MANIFEST_INVALID');
    return { state: 'NOT_INSTALLED' };
  }
  if (manifest.state !== 'INSTALLED') throw new Error('SPOKEN_FAILURE_LINE_MANIFEST_INVALID');
  const load = (entry: ManifestFile | null): Buffer => {
    if (!entry || entry.contentType !== 'audio/wav' || !/^[a-z0-9-]+\.wav$/u.test(entry.file) || !/^[0-9a-f]{64}$/u.test(entry.sha256)) {
      throw new Error('SPOKEN_FAILURE_LINE_MANIFEST_INVALID');
    }
    const bytes = readFileSync(join(dir, entry.file));
    if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error('SPOKEN_FAILURE_LINE_DIGEST_MISMATCH');
    return bytes;
  };
  return { state: 'READY', audio: Object.freeze({ ar: load(manifest.files.ar), en: load(manifest.files.en) }) };
}

/** The line's language is the reply's: Arabic unless the reply is English. */
export function failureLineLanguage(replyText: string): FailureLineLanguage {
  return replyLanguage(replyText);
}
