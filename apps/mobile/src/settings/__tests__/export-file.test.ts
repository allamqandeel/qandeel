/**
 * W3-MEGA-S (E2E-D-16) — saving the server's package where the reader chose. iOS refuses to create a file that already
 * exists, so a second copy saved the same day takes the next free name instead of failing.
 */
import { Directory } from 'expo-file-system';

import { exportFileName, saveExportDocument } from '../export-file';

jest.mock('expo-file-system', () => ({ Directory: { pickDirectoryAsync: jest.fn() } }));

const NOW = new Date('2026-10-07T09:00:00.000Z');
const pick = Directory.pickDirectoryAsync as unknown as jest.Mock;

function folder(taken: readonly string[] = []) {
  const written = new Map<string, string>();
  const createFile = jest.fn((name: string) => {
    if (taken.includes(name) || written.has(name)) throw new Error('FileAlreadyExistsException');
    return { write: (text: string) => written.set(name, text) };
  });
  return { directory: { createFile }, written, createFile };
}

it('names the file by what it is and the day, in Latin letters', () => {
  expect(exportFileName(NOW)).toBe('qandeel-data-2026-10-07.json');
  expect(exportFileName(NOW, 2)).toBe('qandeel-data-2026-10-07-2.json');
});

it('writes the package as one readable JSON document where the reader chose', async () => {
  const f = folder();
  pick.mockResolvedValueOnce(f.directory);
  await expect(saveExportDocument({ format: 'qandeel.personal-data-export.v1' }, NOW)).resolves.toBe('SAVED');
  expect(JSON.parse(f.written.get('qandeel-data-2026-10-07.json') ?? '')).toEqual({ format: 'qandeel.personal-data-export.v1' });
});

it('a second copy the same day never replaces the first and never fails for the name alone', async () => {
  const f = folder(['qandeel-data-2026-10-07.json', 'qandeel-data-2026-10-07-2.json']);
  pick.mockResolvedValueOnce(f.directory);
  await expect(saveExportDocument({ a: 1 }, NOW)).resolves.toBe('SAVED');
  expect([...f.written.keys()]).toEqual(['qandeel-data-2026-10-07-3.json']);
});

it('a closed picker is CANCELLED; a folder that cannot be written is FAILED', async () => {
  pick.mockRejectedValueOnce(new Error('cancelled'));
  await expect(saveExportDocument({}, NOW)).resolves.toBe('CANCELLED');
  pick.mockResolvedValueOnce({ createFile: () => { throw new Error('read-only'); } });
  await expect(saveExportDocument({}, NOW)).resolves.toBe('FAILED');
});
