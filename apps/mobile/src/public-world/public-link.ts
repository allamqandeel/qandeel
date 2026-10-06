/**
 * S5-01 — Public World Direct Entry from a QANDEEL link.
 *
 * The ONE supported Public link is the singleton root, `qandeel://public`, read exactly: another path, a trailing
 * slash, a query, a fragment, a second segment, another case — anything else — is ignored. There is no Public
 * Experience or object link in S5-01. A link is never authority: it only asks the ONE Public entry controller (the
 * same one the Global Switcher uses) to resolve the entry verdict NOW, and nothing of Public World is drawn before
 * ALLOW. Like a Shared link it waits app-level until the reader's world can take it, is taken ONCE, and is never held
 * across accounts: signed out, it is dropped.
 */

const PUBLIC_WORLD_LINK = 'qandeel://public';

/** Whether a QANDEEL link names the Public World root. Strict: one exact form. */
export function isPublicWorldLink(url: unknown): boolean {
  return url === PUBLIC_WORLD_LINK;
}

/** The one pending Public World Direct Entry, until the reader's world takes it. */
export interface PublicLinkInbox {
  put(): void;
  take(): boolean;
  drop(): void;
  subscribe(listener: () => void): () => void;
}

export function createPublicLinkInbox(): PublicLinkInbox {
  let pending = false;
  const listeners = new Set<() => void>();
  return {
    put() {
      pending = true;
      for (const listener of Array.from(listeners)) listener();
    },
    take() {
      const taken = pending;
      pending = false;
      return taken;
    },
    drop() {
      pending = false;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
