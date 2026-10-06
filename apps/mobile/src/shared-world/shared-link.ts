/**
 * S4-04 — Shared World Direct Entry from a QANDEEL link (`E2E-G-15`; S4-01 G-15b).
 *
 * The ONE supported Shared link is `qandeel://shared/world/<World id>`. A link is never authority: it names one exact,
 * opaque World and nothing else, and the reader is taken there only through the existing Shared entry authority, which
 * resolves the World NOW — the neutral transition shell until ALLOW, and one neutral "not available" for every other
 * answer (a World that is not theirs, one they left or were removed from, an ended one, one that never existed). It is
 * read strictly: anything else — another path, a query, a fragment, a second segment, a malformed id — is ignored.
 *
 * Like a notification tap (A3-02), a link waits app-level until the reader's world can take it, is taken ONCE, and is
 * never held across accounts: signed out, it is dropped.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SHARED_WORLD_LINK = /^qandeel:\/\/shared\/world\/([0-9A-Fa-f-]{36})$/u;

/** The exact World a QANDEEL link names, or null. Strict: one form, one id, nothing else read. */
export function sharedWorldOfLink(url: unknown): string | null {
  if (typeof url !== 'string' || url.length > 128) return null;
  const match = SHARED_WORLD_LINK.exec(url);
  return match !== null && UUID.test(match[1]) ? match[1].toLowerCase() : null;
}

/** Where links arrive from. Production: React Native `Linking`; tests and proofs: their own. */
export interface SharedLinkSource {
  /** The link that launched the app, if any. */
  initial(): Promise<string | null>;
  subscribe(listener: (url: string) => void): () => void;
}

/** The one pending Shared Direct Entry (the latest), until the reader's world takes it. */
export interface SharedLinkInbox {
  put(worldId: string): void;
  take(): string | null;
  drop(): void;
  subscribe(listener: () => void): () => void;
}

export function createSharedLinkInbox(): SharedLinkInbox {
  let pending: string | null = null;
  const listeners = new Set<() => void>();
  return {
    put(worldId) {
      pending = worldId;
      for (const listener of Array.from(listeners)) listener();
    },
    take() {
      const taken = pending;
      pending = null;
      return taken;
    },
    drop() {
      pending = null;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** A source that never delivers (no link support in this environment). */
export const NO_SHARED_LINKS: SharedLinkSource = Object.freeze({ initial: async () => null, subscribe: () => () => undefined });
