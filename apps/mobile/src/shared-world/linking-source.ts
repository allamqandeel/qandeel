import { Linking } from 'react-native';
import type { SharedLinkSource } from './shared-link';

/** S4-04 — the production Shared link source: React Native `Linking`. Every failure reads as "no link". */
export function createLinkingSharedLinkSource(): SharedLinkSource {
  return {
    async initial() {
      try {
        const url = await Linking.getInitialURL();
        return typeof url === 'string' ? url : null;
      } catch {
        return null;
      }
    },
    subscribe(listener) {
      try {
        const subscription = Linking.addEventListener('url', (event: { readonly url?: unknown }) => {
          if (typeof event?.url === 'string') listener(event.url);
        });
        return () => subscription?.remove?.();
      } catch {
        return () => undefined;
      }
    },
  };
}
