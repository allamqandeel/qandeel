/**
 * S6-06 (CP2) — choosing ONE photo to share, and leaving nothing of it on the device (WP0 §5, correction 1).
 *
 *   - The system photo picker only (Android Photo Picker / iOS PHPicker): no camera, no microphone, no library access, no
 *     editing, no EXIF, no base64. The picker copies the chosen photo into this app's cache; its bytes are read into
 *     memory once for the upload, and the copy is deleted right after — on success, failure and cancel alike.
 *   - Every URI the picker hands back is written in an in-memory ledger the moment it arrives and deleted exactly
 *     (`new File(uri).delete()` after `.exists`; expo-file-system 57's legacy `deleteAsync` throws at runtime). On opening
 *     the photo flow and on app start, the picker's own `ImagePicker` cache sub-directory is swept — and nothing else.
 *     On Android a result the system delivered after the app was killed (`getPendingResultAsync`) is deleted unused.
 *   - Nothing is processed here: the server decodes, strips and derives every rendition. Nothing is persisted: no file,
 *     no database, no ledger on disk.
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { INTRODUCTION_IMAGE_MAX_BYTES, INTRODUCTION_IMAGE_TYPES } from '../runtime-entry';

/** CHOSEN: the bytes, in memory, and the copy to delete. The other words say why nothing was chosen. */
export type PhotoChoice =
  | { readonly kind: 'CHOSEN'; readonly uri: string; readonly mimeType: string; readonly bytes: Uint8Array }
  | { readonly kind: 'CANCELLED' | 'REFUSED' | 'FAILED' };

export interface PhotoSource {
  /** Opens the system picker for one photo. */
  choose(): Promise<PhotoChoice>;
  /** Deletes the picker's copy of a chosen photo. Never throws. */
  discard(uri: string): void;
  /** Deletes every copy the ledger knows and the picker's own cache sub-directory. Never throws. */
  sweep(): Promise<void>;
}

const PICKER_DIRECTORY = 'ImagePicker';
const EXTENSION_TYPES: Readonly<Record<string, string>> = Object.freeze({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' });

/** The photo's type as the picker reports it, or from its file name; only the three the server accepts. */
export function photoTypeOf(mimeType: string | null | undefined, uri: string): string | null {
  const reported = mimeType?.toLowerCase() ?? null;
  if (reported !== null && INTRODUCTION_IMAGE_TYPES.includes(reported)) return reported;
  if (reported !== null && reported !== '' && reported !== 'application/octet-stream') return null;
  const extension = /\.([a-z0-9]+)(?:[?#].*)?$/iu.exec(uri)?.[1]?.toLowerCase();
  return extension === undefined ? null : EXTENSION_TYPES[extension] ?? null;
}

const remove = (uri: string): void => {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone, or not a file the app owns: nothing of it remains to delete.
  }
};

/** The device photo source. One per runtime generation is enough; the ledger lives only in memory. */
export function createDevicePhotoSource(): PhotoSource {
  const ledger = new Set<string>();
  const forget = (uri: string) => {
    remove(uri);
    ledger.delete(uri);
  };
  return {
    async choose() {
      let result: ImagePicker.ImagePickerResult;
      try {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          allowsMultipleSelection: false,
          exif: false,
          base64: false,
          quality: 1,
          // iOS hands back a JPEG for a HEIC original instead of a format the server refuses.
          preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
          shouldDownloadFromNetwork: false,
        });
      } catch {
        return { kind: 'FAILED' };
      }
      if (result.canceled) return { kind: 'CANCELLED' };
      const assets = result.assets ?? [];
      for (const asset of assets) ledger.add(asset.uri);
      const [asset, ...extra] = assets;
      for (const other of extra) forget(other.uri);
      if (asset === undefined) return { kind: 'FAILED' };
      const mimeType = photoTypeOf(asset.mimeType, asset.uri);
      if (mimeType === null || (asset.fileSize !== undefined && asset.fileSize > INTRODUCTION_IMAGE_MAX_BYTES)) {
        forget(asset.uri);
        return { kind: 'REFUSED' };
      }
      try {
        const bytes = await new File(asset.uri).bytes();
        if (bytes.length === 0 || bytes.length > INTRODUCTION_IMAGE_MAX_BYTES) {
          forget(asset.uri);
          return { kind: 'REFUSED' };
        }
        return { kind: 'CHOSEN', uri: asset.uri, mimeType, bytes };
      } catch {
        forget(asset.uri);
        return { kind: 'FAILED' };
      }
    },
    discard(uri) {
      forget(uri);
    },
    async sweep() {
      for (const uri of [...ledger]) forget(uri);
      try {
        const directory = new Directory(Paths.cache, PICKER_DIRECTORY);
        if (directory.exists) directory.delete();
      } catch {
        // Nothing the app can delete there.
      }
      if (Platform.OS !== 'android') return;
      try {
        // A photo chosen while the system had stopped the app: delivered now, never used, deleted at once.
        const pending = await ImagePicker.getPendingResultAsync();
        if (pending !== null && 'assets' in pending && pending.assets !== null) for (const asset of pending.assets) remove(asset.uri);
      } catch {
        // No pending result.
      }
    },
  };
}
