import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { failureLineLanguage, loadSpokenFailureLine, SPOKEN_FAILURE_LINE } from './spoken-failure-line';

/** S8B-04 CP1, contract v1.2 §11.3 / AC-18 — the contract and the structure; no audio file ships in CP1. */
describe('S8B-04 spoken failure line F-01', () => {
  it('is F-01 verbatim, both languages', () => {
    expect(SPOKEN_FAILURE_LINE).toEqual({
      id: 'F-01', ar: 'تعذّر إكمال الرد الصوتي. الكتابة متاحة.', en: "The spoken reply couldn't be completed. Writing is available.",
    });
  });

  it('the shipped manifest declares NOT_INSTALLED, with no file', () => {
    expect(loadSpokenFailureLine()).toEqual({ state: 'NOT_INSTALLED' });
  });

  it('once installed, each file loads only under its pinned sha256', () => {
    const dir = mkdtempSync(join(tmpdir(), 'f01-'));
    try {
      const ar = Buffer.from('RIFF-ar');
      const en = Buffer.from('RIFF-en');
      writeFileSync(join(dir, 'f-01-ar.wav'), ar);
      writeFileSync(join(dir, 'f-01-en.wav'), en);
      const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
      const manifest = (enSha: string) => JSON.stringify({ line: 'F-01', state: 'INSTALLED', files: {
        ar: { file: 'f-01-ar.wav', sha256: sha(ar), contentType: 'audio/wav' },
        en: { file: 'f-01-en.wav', sha256: enSha, contentType: 'audio/wav' },
      } });
      writeFileSync(join(dir, 'manifest.json'), manifest(sha(en)));
      expect(loadSpokenFailureLine(dir)).toEqual({ state: 'READY', audio: { ar, en } });
      writeFileSync(join(dir, 'manifest.json'), manifest('0'.repeat(64)));
      expect(() => loadSpokenFailureLine(dir)).toThrow('SPOKEN_FAILURE_LINE_DIGEST_MISMATCH');
      writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ line: 'F-01', state: 'NOT_INSTALLED', files: { ar: { file: 'x.wav' }, en: null } }));
      expect(() => loadSpokenFailureLine(dir)).toThrow('SPOKEN_FAILURE_LINE_MANIFEST_INVALID');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the line speaks the reply\'s language', () => {
    expect(failureLineLanguage('تمام، فهمتك.')).toBe('ar');
    expect(failureLineLanguage('Sure, I understand.')).toBe('en');
  });
});
