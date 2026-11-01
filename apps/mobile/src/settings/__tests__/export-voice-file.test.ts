/**
 * S8B-03 (CP2, B9) — saving the reader's own voice recordings that a READY export lists: each file streamed with the
 * bearer in a header, checked by length and SHA-256 on its way in and as read back, the manifest LAST; a file the server
 * no longer has is skipped and said (C-52); any other failure removes the folder and says whether that was confirmed
 * (C-51) or not (C-53). Nothing stays in the cache.
 */
import { exportVoiceFolderName, exportVoiceManifestName, saveExportVoices, type VoiceExportDevice, type VoiceExportFolder } from '../export-file';
import { sha256Hex } from '../../voice-note/sha256';
import type { ExportVoiceSet } from '../../runtime-entry';

jest.mock('expo-file-system', () => ({ Directory: jest.fn(), File: jest.fn(), Paths: {} }));

const NOW = new Date('2026-10-31T12:00:00.000Z');
const A = 'qandeel-voice-note-20261031T100000000000Z.m4a';
const B = 'qandeel-voice-note-20261031T101500000000Z.m4a';
const bytesOf = (n: number, seed: number) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed) % 256);
const VOICES: ExportVoiceSet = {
  manifest: { format: 'qandeel.personal-data-export.voice.v1', files: [{ fileName: A, bytes: 300 }, { fileName: B, bytes: 200 }] },
  files: [{ fileName: A, bytes: 300 }, { fileName: B, bytes: 200 }],
};
const ACCESS = { url: (name: string) => `https://api.test/account/privacy/export/download/bundle/voice/${name}`, authorization: () => ({ Authorization: 'Bearer reader' }) };

function device(options: { gone?: string[]; corrupt?: string; shortFile?: string; cancel?: boolean; deleteFails?: boolean; failWrite?: string } = {}) {
  const written = new Map<string, Uint8Array>();
  const texts = new Map<string, string>();
  const requests: { url: string; headers: Record<string, string> }[] = [];
  const folderNames: string[] = [];
  let exists = true;
  const folder: VoiceExportFolder = {
    write(fileName, _mime, bytes) {
      if (options.failWrite === fileName) throw new Error('disk full');
      const copy = new Uint8Array(bytes);
      if (options.corrupt === fileName) copy[0] ^= 0xff;
      written.set(fileName, copy);
      return copy;
    },
    writeText(fileName, text) {
      texts.set(fileName, text);
    },
    delete() {
      if (options.deleteFails) throw new Error('cannot delete');
      exists = false;
    },
    exists: () => exists,
  };
  const port: VoiceExportDevice = {
    pickFolder: async (name) => {
      if (options.cancel) return null;
      folderNames.push(name(1));
      return folder;
    },
    download: async (url, headers) => {
      requests.push({ url, headers });
      const name = url.slice(url.lastIndexOf('/') + 1);
      if (options.gone?.includes(name)) return 'GONE';
      const size = name === A ? 300 : 200;
      return bytesOf(options.shortFile === name ? size - 1 : size, name === A ? 1 : 2);
    },
  };
  return { port, written, texts, requests, folderNames, exists: () => exists };
}

describe('saving the reader’s voice recordings from an export', () => {
  it('SAVED: every file, byte for byte, with the bearer in a header only; the manifest last and verbatim', async () => {
    const d = device();
    await expect(saveExportVoices(VOICES, ACCESS, d.port, NOW)).resolves.toBe('SAVED');
    expect(d.folderNames).toEqual([exportVoiceFolderName(NOW)]);
    expect(exportVoiceFolderName(NOW)).toBe('qandeel-voice-2026-10-31');
    expect(d.requests.map((r) => r.headers)).toEqual([{ Authorization: 'Bearer reader' }, { Authorization: 'Bearer reader' }]);
    for (const r of d.requests) expect(r.url).not.toMatch(/bearer|token|reader/iu);
    expect(sha256Hex(d.written.get(A)!)).toBe(sha256Hex(bytesOf(300, 1)));
    expect(sha256Hex(d.written.get(B)!)).toBe(sha256Hex(bytesOf(200, 2)));
    expect(JSON.parse(d.texts.get(exportVoiceManifestName(NOW))!)).toEqual(VOICES.manifest);
  });

  it('C-52: a file the server no longer has is skipped; the rest and the manifest are saved', async () => {
    const d = device({ gone: [B] });
    await expect(saveExportVoices(VOICES, ACCESS, d.port, NOW)).resolves.toBe('SOME_UNAVAILABLE');
    expect([...d.written.keys()]).toEqual([A]);
    expect(d.texts.size).toBe(1);
    expect(d.exists()).toBe(true);
  });

  it('C-51: a short file, a copy that reads back differently, a write that fails, or nothing left — the folder is removed and confirmed gone', async () => {
    for (const options of [{ shortFile: B }, { corrupt: A }, { failWrite: B }, { gone: [A, B] }]) {
      const d = device(options);
      await expect(saveExportVoices(VOICES, ACCESS, d.port, NOW)).resolves.toBe('FAILED_REMOVED');
      expect(d.exists()).toBe(false);
      expect(d.texts.size).toBe(0);
    }
  });

  it('C-53: when the folder cannot be confirmed removed, the reader is told files may remain', async () => {
    const d = device({ corrupt: A, deleteFails: true });
    await expect(saveExportVoices(VOICES, ACCESS, d.port, NOW)).resolves.toBe('FAILED_REMAINS');
  });

  it('a closed picker says nothing; no identity, or a name of another form, saves nothing', async () => {
    await expect(saveExportVoices(VOICES, ACCESS, device({ cancel: true }).port, NOW)).resolves.toBe('CANCELLED');
    const noOne = device();
    await expect(saveExportVoices(VOICES, { ...ACCESS, authorization: () => null }, noOne.port, NOW)).resolves.toBe('FAILED_REMOVED');
    expect(noOne.requests).toEqual([]);
    const badName = device();
    await expect(saveExportVoices(VOICES, { ...ACCESS, url: () => null }, badName.port, NOW)).resolves.toBe('FAILED_REMOVED');
    expect(badName.requests).toEqual([]);
  });
});
