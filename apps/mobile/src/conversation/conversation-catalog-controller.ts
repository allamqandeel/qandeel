/**
 * COSMOS E-2 corrections, Slice B (the Product Owner's D-2, 2026-11-20) — the presentation controller of the Personal
 * conversation catalog for ONE runtime generation.
 *
 * It holds the list as the server last answered it and the one in-progress rename, and nothing else: no Session, no
 * credential, no persistence, no second catalog (the list is `GET /conversation/sessions`, owner-scoped on the server;
 * T-13 keeps only the ONE active Session locator per identity). Switching conversations is NOT done here — the
 * integration owner rebuilds the session runtime, because a switch replaces everything bound to a generation — this
 * controller only names which Session is open now, so the list can mark it.
 *
 * Retired with the generation like every other controller: a late answer never reaches a replaced list.
 */
import type { ConversationCatalogApiClient, ConversationCatalogEntry } from '../runtime-entry';

export type ConversationCatalogStatus = 'IDLE' | 'LOADING' | 'READY' | 'UNAVAILABLE';

export interface ConversationCatalogState {
  readonly status: ConversationCatalogStatus;
  /** As the server ordered them: newest activity first. */
  readonly entries: readonly ConversationCatalogEntry[];
  /** The Session open in this generation. The list marks it; selecting it is a no-op switch. */
  readonly currentSessionId: string;
  /** The row whose title is being edited, if any. */
  readonly renaming: string | null;
  /** A rename the server refused (bad words) or could not take; cleared by the next edit. */
  readonly renameFailed: boolean;
}

export interface ConversationCatalogController {
  getState(): ConversationCatalogState;
  subscribe(listener: () => void): () => void;
  /** Read the list now (opening the surface, after a switch, after a rename). A read already in flight is not doubled. */
  refresh(): void;
  beginRename(sessionId: string): void;
  cancelRename(): void;
  /** Append the title on the server; on success the row is updated from the server's own answer. */
  rename(sessionId: string, title: string): Promise<boolean>;
  /** COSMOS E-2 Slice A: append the person's alias for one of their Personal topics; the projection is re-read by the caller. */
  renameThread(threadId: string, alias: string): Promise<boolean>;
  retire(): void;
}

export interface ConversationCatalogControllerOptions {
  readonly transport: Pick<ConversationCatalogApiClient, 'listSessions' | 'renameSession' | 'setThreadAlias'>;
  readonly currentSessionId: string;
  readonly isCurrent: () => boolean;
}

export function createConversationCatalogController(options: ConversationCatalogControllerOptions): ConversationCatalogController {
  const listeners = new Set<() => void>();
  let state: ConversationCatalogState = { status: 'IDLE', entries: [], currentSessionId: options.currentSessionId, renaming: null, renameFailed: false };
  let retired = false;
  let reading = false;
  const live = () => !retired && options.isCurrent();
  const set = (next: Partial<ConversationCatalogState>) => {
    if (!live()) return;
    state = { ...state, ...next };
    for (const listener of Array.from(listeners)) listener();
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh() {
      if (!live() || reading) return;
      reading = true;
      set({ status: state.status === 'READY' ? 'READY' : 'LOADING' });
      void options.transport.listSessions().then((outcome) => {
        reading = false;
        if (!live()) return;
        if (outcome.kind === 'LISTED') set({ status: 'READY', entries: outcome.entries });
        else set({ status: 'UNAVAILABLE' });
      }, () => {
        reading = false;
        set({ status: 'UNAVAILABLE' });
      });
    },
    beginRename(sessionId) {
      set({ renaming: sessionId, renameFailed: false });
    },
    cancelRename() {
      set({ renaming: null, renameFailed: false });
    },
    async rename(sessionId, title) {
      if (!live()) return false;
      const outcome = await options.transport.renameSession(sessionId, title);
      if (!live()) return false;
      if (outcome.kind !== 'RENAMED') {
        set({ renameFailed: true });
        return false;
      }
      set({
        renaming: null,
        renameFailed: false,
        entries: state.entries.map((entry) => (entry.sessionId === sessionId ? { ...entry, title: outcome.title } : entry)),
      });
      return true;
    },
    async renameThread(threadId, alias) {
      if (!live()) return false;
      const outcome = await options.transport.setThreadAlias(threadId, alias);
      return live() && outcome.kind === 'ALIASED';
    },
    retire() {
      retired = true;
      listeners.clear();
    },
  };
}

/** The name a row is shown under: the person's title, else their first words, else nothing (the surface says "untitled"). */
export function conversationDisplayName(entry: Pick<ConversationCatalogEntry, 'title' | 'opening'>): string | null {
  if (entry.title !== null && entry.title.trim() !== '') return entry.title;
  if (entry.opening !== null && entry.opening.trim() !== '') return entry.opening;
  return null;
}
