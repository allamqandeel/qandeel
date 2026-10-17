/**
 * S6-06 (CP2) — the device photo source (WP0 correction 1): the system picker with no camera, editing, EXIF or base64; the
 * picker's copy read into memory once and mockDeleted exactly; the ImagePicker cache sub-directory swept and nothing else;
 * Android's pending result mockDeleted unused; nothing mockWritten anywhere.
 */
const mockFiles = new Map<string, Uint8Array>();
const mockDirectories = new Set<string>(['cache/ImagePicker']);
const mockDeleted: string[] = [];
const mockWritten: string[] = [];

jest.mock('expo-file-system', () => {
  class File {
    readonly uri: string;
    constructor(uri: string) { this.uri = uri; }
    get exists() { return mockFiles.has(this.uri); }
    delete() { mockFiles.delete(this.uri); mockDeleted.push(this.uri); }
    async bytes() { const b = mockFiles.get(this.uri); if (b === undefined) throw new Error('missing'); return b; }
    write() { mockWritten.push(this.uri); }
  }
  class Directory {
    readonly uri: string;
    constructor(base: { uri: string }, name: string) { this.uri = `${base.uri}/${name}`; }
    get exists() { return mockDirectories.has(this.uri); }
    delete() { mockDirectories.delete(this.uri); mockDeleted.push(`${this.uri}/`); }
  }
  return { File, Directory, Paths: { cache: { uri: 'cache' } } };
});

import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { createDevicePhotoSource, photoTypeOf } from '../photo-source';

const launch = ImagePicker.launchImageLibraryAsync as jest.Mock;
const pending = ImagePicker.getPendingResultAsync as jest.Mock;

beforeEach(() => {
  mockFiles.clear();
  mockDeleted.length = 0;
  mockWritten.length = 0;
  mockDirectories.clear();
  mockDirectories.add('cache/ImagePicker');
  launch.mockReset();
  pending.mockReset();
  pending.mockResolvedValue(null);
});

describe('S6-06 — the device photo source', () => {
  it('opens the system picker for one photo only: no editing, EXIF or base64; HEIC comes back compatible', async () => {
    launch.mockResolvedValueOnce({ canceled: true, assets: null });
    const source = createDevicePhotoSource();
    expect(await source.choose()).toEqual({ kind: 'CANCELLED' });
    expect(launch).toHaveBeenCalledWith({
      mediaTypes: ['images'], allowsEditing: false, allowsMultipleSelection: false, exif: false, base64: false, quality: 1,
      preferredAssetRepresentationMode: 'compatible', shouldDownloadFromNetwork: false,
    });
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('reads the chosen copy into memory once; discarding deletes exactly that copy; nothing is written', async () => {
    mockFiles.set('file:///cache/ImagePicker/a.jpg', new Uint8Array([9, 9]));
    launch.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///cache/ImagePicker/a.jpg', mimeType: 'image/jpeg', fileSize: 2 }] });
    const source = createDevicePhotoSource();
    const choice = await source.choose();
    expect(choice).toEqual({ kind: 'CHOSEN', uri: 'file:///cache/ImagePicker/a.jpg', mimeType: 'image/jpeg', bytes: new Uint8Array([9, 9]) });
    source.discard('file:///cache/ImagePicker/a.jpg');
    expect(mockDeleted).toEqual(['file:///cache/ImagePicker/a.jpg']);
    expect(mockFiles.size).toBe(0);
    expect(mockWritten).toEqual([]);
  });

  it('a refused type or size is deleted at once and never read', async () => {
    mockFiles.set('file:///c/b.heic', new Uint8Array([1]));
    mockFiles.set('file:///c/big.jpg', new Uint8Array([1]));
    launch.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///c/b.heic', mimeType: 'image/heic' }] });
    launch.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///c/big.jpg', mimeType: 'image/jpeg', fileSize: 10 * 1024 * 1024 + 1 }] });
    const source = createDevicePhotoSource();
    expect(await source.choose()).toEqual({ kind: 'REFUSED' });
    expect(await source.choose()).toEqual({ kind: 'REFUSED' });
    expect(mockDeleted).toEqual(['file:///c/b.heic', 'file:///c/big.jpg']);
  });

  it('the sweep deletes every copy the ledger knows (even outside the sub-directory) and the ImagePicker sub-directory only', async () => {
    // iOS: with a caches path ending in "/", the picker writes into the Caches root (MediaHandler.swift).
    mockFiles.set('file:///Caches/x.jpg', new Uint8Array([1]));
    mockFiles.set('file:///Caches/unrelated.db', new Uint8Array([1]));
    launch.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///Caches/x.jpg', mimeType: 'image/jpeg', fileSize: 1 }] });
    const source = createDevicePhotoSource();
    await source.choose();
    await source.sweep();
    expect(mockDeleted).toEqual(['file:///Caches/x.jpg', 'cache/ImagePicker/']);
    expect(mockFiles.has('file:///Caches/unrelated.db')).toBe(true);
  });

  it('Android: a result delivered after the app was stopped is deleted unused', async () => {
    const os = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    try {
      mockFiles.set('file:///cache/ImagePicker/late.jpg', new Uint8Array([1]));
      pending.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///cache/ImagePicker/late.jpg' }] });
      await createDevicePhotoSource().sweep();
      expect(mockDeleted).toContain('file:///cache/ImagePicker/late.jpg');
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    }
  });

  it('the type is the picker\'s, or the file name\'s when the picker gives none; only JPEG, PNG or WebP', () => {
    expect(photoTypeOf('image/png', 'x')).toBe('image/png');
    expect(photoTypeOf('image/heic', 'x.jpg')).toBeNull();
    expect(photoTypeOf(undefined, 'file:///a/b.WEBP')).toBe('image/webp');
    expect(photoTypeOf('application/octet-stream', 'file:///a/b.jpeg')).toBe('image/jpeg');
    expect(photoTypeOf(null, 'file:///a/b.gif')).toBeNull();
  });
});
