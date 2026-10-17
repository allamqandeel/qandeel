/**
 * S6-06 (CP2) — drops what the native image engine decoded for the Introduction renditions it drew from memory. The
 * renditions themselves are never cached (`cachePolicy: 'none'`, `data:` URIs); this releases the decoded bitmaps too when
 * the World closes, a share leaves the read, or the runtime generation ends.
 */
import { Image } from 'expo-image';

export function releaseIntroductionRenditions(): void {
  void Image.clearMemoryCache().catch(() => undefined);
}
