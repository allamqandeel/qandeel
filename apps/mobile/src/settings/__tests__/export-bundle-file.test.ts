/**
 * S6-07 (CP4, QAN-BL-PRIV-04) — saving the export with the reader's own photos: ONE folder, the photos first, the server's
 * manifest next, the package LAST; each photo checked on disk before the next; any failure removes the folder and is
 * FAILED — never a partial SAVED. Without a photo the package is saved exactly as before (export-file.test.ts).
 */
import { Directory } from 'expo-file-system';

import { exportFolderName, exportManifestName, saveExportBundle } from '../export-file';
import type { ExportPhotosToSave } from '../privacy-data-controller';

jest.mock('expo-file-system', () => ({ Directory: { pickDirectoryAsync: jest.fn() } }));

const NOW = new Date('2026-10-18T09:00:00.000Z');
const pick = Directory.pickDirectoryAsync as unknown as jest.Mock;
const DOCUMENT = { format: 'qandeel.personal-data-export.v1', matchingAndIntroductions: { introductions: [] } };
const MANIFEST = { format: 'qandeel.personal-data-export.photos.v1', files: [], notIncluded: [] };
const b64 = (text: string) => Buffer.from(text).toString('base64');
const photo = (fileName: string, text = fileName) => ({ fileName, bytes: Buffer.byteLength(text), bytesBase64: b64(text) });

/** A picked place on a fake disk: folders, files with their bytes, the order of every write, and what was deleted. */
function disk({ takenFolders = [] as string[], shortWrite = '' as string, failCreate = '' as string } = {}) {
  const files = new Map<string, Buffer>();
  const folders = new Set<string>(takenFolders.map((n) => `picked/${n}`));
  const order: string[] = [];
  const deleted: string[] = [];
  const dir = (path: string): unknown => ({
    createDirectory: (name: string) => {
      const full = `${path}/${name}`;
      if (folders.has(full)) throw new Error('exists');
      folders.add(full);
      return dir(full);
    },
    createFile: (name: string) => {
      const full = `${path}/${name}`;
      if (files.has(full) || name === failCreate) throw new Error('cannot create');
      files.set(full, Buffer.alloc(0));
      return {
        write: (content: string, options?: { encoding?: string }) => {
          const bytes = options?.encoding === 'base64' ? Buffer.from(content, 'base64') : Buffer.from(content, 'utf8');
          files.set(full, name === shortWrite ? bytes.subarray(1) : bytes);
          order.push(name);
        },
        get exists() { return files.has(full); },
        get size() { return files.get(full)?.length ?? 0; },
      };
    },
    delete: () => {
      deleted.push(path);
      for (const key of [...files.keys()]) if (key.startsWith(`${path}/`)) files.delete(key);
      folders.delete(path);
    },
  });
  return { root: dir('picked'), files, folders, order, deleted };
}
function photos(names: string[], inlineCount: number, fetched: Record<string, ReturnType<typeof photo> | null> = {}): ExportPhotosToSave & { fetch: jest.Mock } {
  return {
    manifest: { ...MANIFEST, files: names.map((fileName) => ({ fileName })) },
    fileNames: names,
    inline: names.slice(0, inlineCount).map((n) => photo(n)),
    fetch: jest.fn(async (name: string) => (name in fetched ? fetched[name] : photo(name))),
  };
}

beforeEach(() => pick.mockReset());

it('names the folder and the manifest by what they are and the day', () => {
  expect(exportFolderName(NOW)).toBe('qandeel-data-2026-10-18');
  expect(exportFolderName(NOW, 3)).toBe('qandeel-data-2026-10-18-3');
  expect(exportManifestName(NOW)).toBe('qandeel-photos-2026-10-18.json');
});

it('writes the photos first, the manifest next and the package LAST, all in one fresh folder, with exactly their bytes', async () => {
  const d = disk();
  pick.mockResolvedValueOnce(d.root);
  const p = photos(['qandeel-photo-01-stage-1.jpg', 'qandeel-photo-01-stage-2.jpg', 'qandeel-photo-02-stage-3.jpg'], 2);
  await expect(saveExportBundle(DOCUMENT, p, NOW)).resolves.toBe('SAVED');
  expect(d.order).toEqual(['qandeel-photo-01-stage-1.jpg', 'qandeel-photo-01-stage-2.jpg', 'qandeel-photo-02-stage-3.jpg',
    'qandeel-photos-2026-10-18.json', 'qandeel-data-2026-10-18.json']);
  expect(p.fetch.mock.calls).toEqual([['qandeel-photo-02-stage-3.jpg']]);
  const base = 'picked/qandeel-data-2026-10-18';
  expect(d.files.get(`${base}/qandeel-photo-02-stage-3.jpg`)?.toString()).toBe('qandeel-photo-02-stage-3.jpg');
  expect(JSON.parse(d.files.get(`${base}/qandeel-photos-2026-10-18.json`)?.toString() ?? '')).toEqual(p.manifest);
  expect(JSON.parse(d.files.get(`${base}/qandeel-data-2026-10-18.json`)?.toString() ?? '')).toEqual(DOCUMENT);
  expect(d.deleted).toEqual([]);
});

it('a second export the same day takes the next free folder; nothing of the first is touched', async () => {
  const d = disk({ takenFolders: ['qandeel-data-2026-10-18'] });
  pick.mockResolvedValueOnce(d.root);
  await expect(saveExportBundle(DOCUMENT, photos(['qandeel-photo-01-stage-1.jpg'], 1), NOW)).resolves.toBe('SAVED');
  expect([...d.files.keys()].every((k) => k.startsWith('picked/qandeel-data-2026-10-18-2/'))).toBe(true);
});

it('a photo that cannot be had now (CHANGED, lost) removes the folder: FAILED, and no package exists anywhere', async () => {
  const d = disk();
  pick.mockResolvedValueOnce(d.root);
  const p = photos(['qandeel-photo-01-stage-1.jpg', 'qandeel-photo-01-stage-2.jpg'], 1, { 'qandeel-photo-01-stage-2.jpg': null });
  await expect(saveExportBundle(DOCUMENT, p, NOW)).resolves.toBe('FAILED');
  expect(d.deleted).toEqual(['picked/qandeel-data-2026-10-18']);
  expect(d.files.size).toBe(0);
  expect(d.order).not.toContain('qandeel-data-2026-10-18.json');
});

it('a photo written short, a file the place refuses, or a mislabelled answer is FAILED with the folder removed', async () => {
  for (const options of [{ shortWrite: 'qandeel-photo-01-stage-1.jpg' }, { failCreate: 'qandeel-photos-2026-10-18.json' }, { failCreate: 'qandeel-data-2026-10-18.json' }]) {
    const d = disk(options);
    pick.mockResolvedValueOnce(d.root);
    await expect(saveExportBundle(DOCUMENT, photos(['qandeel-photo-01-stage-1.jpg'], 1), NOW)).resolves.toBe('FAILED');
    expect(d.deleted).toEqual(['picked/qandeel-data-2026-10-18']);
    expect(d.files.size).toBe(0);
  }
  const d = disk();
  pick.mockResolvedValueOnce(d.root);
  const wrong = photos(['qandeel-photo-01-stage-1.jpg', 'qandeel-photo-01-stage-2.jpg'], 1, { 'qandeel-photo-01-stage-2.jpg': photo('qandeel-photo-01-stage-3.jpg') });
  await expect(saveExportBundle(DOCUMENT, wrong, NOW)).resolves.toBe('FAILED');
  expect(d.files.size).toBe(0);
});

it('a closed picker writes nothing and asks for nothing; a place where no folder can be made is FAILED', async () => {
  pick.mockRejectedValueOnce(new Error('cancelled'));
  const p = photos(['qandeel-photo-01-stage-1.jpg'], 0);
  await expect(saveExportBundle(DOCUMENT, p, NOW)).resolves.toBe('CANCELLED');
  expect(p.fetch).not.toHaveBeenCalled();
  pick.mockResolvedValueOnce({ createDirectory: () => { throw new Error('read-only'); } });
  await expect(saveExportBundle(DOCUMENT, p, NOW)).resolves.toBe('FAILED');
  expect(p.fetch).not.toHaveBeenCalled();
});

it('without photos it is exactly today\'s single package file, in the picked place itself', async () => {
  const written = new Map<string, string>();
  pick.mockResolvedValueOnce({ createFile: (name: string) => ({ write: (text: string) => written.set(name, text) }) });
  await expect(saveExportBundle(DOCUMENT, null, NOW)).resolves.toBe('SAVED');
  expect([...written.keys()]).toEqual(['qandeel-data-2026-10-18.json']);
});
