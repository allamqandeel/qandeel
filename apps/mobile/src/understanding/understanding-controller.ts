/**
 * W3-MEGA-U (E2E-D-14) — the reader's «فهم قنديل» / QANDEEL Understanding, for ONE runtime generation.
 *
 * It holds exactly what the server projected — the current items, one opened item's explanation, and the one item the
 * reader chose to talk to QANDEEL about — and nothing it has not been told. It owns no identity, no credential and no
 * persistence; the integration owner builds one per runtime generation over the Understanding transport bound to that
 * identity and retires it with the generation.
 *
 *   - Reads happen when the surface asks (it is opened, an item is opened, the reader asks again). Nothing polls.
 *   - "Talk to QANDEEL about this" is bound to the exact revision the reader is looking at. When the item changed in
 *     the meantime nothing is recorded: the item is read again and the reader sees the current interpretation before
 *     choosing again. An objection or a choice is never silently moved onto a newer interpretation.
 *   - One talk request at a time.
 */
import type {
  UnderstandingDetailOutcome,
  UnderstandingDetailView,
  UnderstandingDiscussionOutcome,
  UnderstandingItemView,
  UnderstandingListOutcome,
  UnderstandingTheme,
} from '../runtime-entry';

export type UnderstandingReadStatus = 'LOADING' | 'READY' | 'UNAVAILABLE';

export interface UnderstandingDetailState {
  readonly ref: string;
  /** GONE: no longer one of the reader's current items. */
  readonly status: UnderstandingReadStatus | 'GONE';
  readonly view: UnderstandingDetailView | null;
}

/** The one item the reader chose to talk to QANDEEL about, as they saw it when they chose it. */
export interface UnderstandingDiscussion {
  readonly ref: string;
  readonly theme: UnderstandingTheme;
  readonly summary: string;
}

export interface UnderstandingState {
  readonly list: UnderstandingReadStatus;
  readonly items: readonly UnderstandingItemView[];
  readonly detail: UnderstandingDetailState | null;
  readonly talk: 'IDLE' | 'OPENING' | 'FAILED';
  readonly discussion: UnderstandingDiscussion | null;
}

export interface UnderstandingTransport {
  readItems(): Promise<UnderstandingListOutcome>;
  readItem(ref: string): Promise<UnderstandingDetailOutcome>;
  openDiscussion(ref: string, revision: string): Promise<UnderstandingDiscussionOutcome>;
  closeDiscussion(ref: string): Promise<boolean>;
}

/**
 * What a talk request came to:
 *   OPENED   QANDEEL now knows which item the reader chose; return to the Conversation;
 *   CHANGED  the item changed since it was shown — it was read again and nothing was recorded;
 *   GONE     it is no longer one of the reader's current items;
 *   FAILED   it is not known to have been recorded; the reader may ask again.
 */
export type UnderstandingTalkResult = 'OPENED' | 'CHANGED' | 'GONE' | 'FAILED';

export interface UnderstandingController {
  getState(): UnderstandingState;
  subscribe(listener: () => void): () => void;
  /** Read the current items. Called when the surface is shown and when the reader asks again. */
  refresh(): void;
  openItem(ref: string): void;
  closeItem(): void;
  /** "Talk to QANDEEL about this" for the opened item. `null` when refused (nothing opened, or one in flight). */
  talk(): Promise<UnderstandingTalkResult | null>;
  /** The reader ends the discussion context. Local first; the server is told once. */
  endDiscussion(): void;
  retire(): void;
}

export interface UnderstandingControllerOptions {
  readonly transport: UnderstandingTransport;
  readonly isCurrent: () => boolean;
}

const INITIAL: UnderstandingState = Object.freeze({ list: 'LOADING', items: [], detail: null, talk: 'IDLE', discussion: null });

export function createUnderstandingController({ transport, isCurrent }: UnderstandingControllerOptions): UnderstandingController {
  let state: UnderstandingState = INITIAL;
  let retired = false;
  let listRead = 0;
  let detailRead = 0;
  let talking = false;
  const listeners = new Set<() => void>();
  const live = () => !retired && isCurrent();

  const update = (next: Partial<UnderstandingState>) => {
    state = { ...state, ...next };
    for (const listener of Array.from(listeners)) listener();
  };

  const readDetail = (ref: string) => {
    const read = ++detailRead;
    update({ detail: { ref, status: 'LOADING', view: state.detail?.ref === ref ? state.detail.view : null } });
    return transport.readItem(ref).then(
      (outcome) => {
        if (!live() || read !== detailRead || state.detail?.ref !== ref) return;
        if (outcome.kind === 'READ') update({ detail: { ref, status: 'READY', view: outcome.view } });
        else update({ detail: { ref, status: outcome.kind === 'GONE' ? 'GONE' : 'UNAVAILABLE', view: null } });
      },
      () => {
        if (live() && read === detailRead && state.detail?.ref === ref) update({ detail: { ref, status: 'UNAVAILABLE', view: null } });
      },
    );
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
      if (!live()) return;
      const read = ++listRead;
      update({ list: 'LOADING' });
      void transport.readItems().then(
        (outcome) => {
          if (!live() || read !== listRead) return;
          if (outcome.kind === 'READ') update({ list: 'READY', items: outcome.items });
          else update({ list: 'UNAVAILABLE' });
        },
        () => {
          if (live() && read === listRead) update({ list: 'UNAVAILABLE' });
        },
      );
    },
    openItem(ref) {
      if (!live()) return;
      update({ talk: 'IDLE' });
      void readDetail(ref);
    },
    closeItem() {
      if (!live()) return;
      detailRead += 1;
      update({ detail: null, talk: 'IDLE' });
    },
    async talk() {
      const detail = state.detail;
      if (!live() || talking || detail === null || detail.status !== 'READY' || detail.view === null) return null;
      const view = detail.view;
      talking = true;
      update({ talk: 'OPENING' });
      try {
        const outcome = await transport.openDiscussion(view.ref, view.revision).catch((): UnderstandingDiscussionOutcome => ({ kind: 'FAILED' }));
        if (!live()) return 'FAILED';
        switch (outcome.kind) {
          case 'OPENED':
            update({ talk: 'IDLE', discussion: { ref: view.ref, theme: view.theme, summary: view.summary } });
            return 'OPENED';
          case 'CHANGED':
            // The interpretation moved: show the current one first; the reader chooses again.
            update({ talk: 'IDLE' });
            await readDetail(view.ref);
            return 'CHANGED';
          case 'GONE':
            update({ talk: 'IDLE', detail: { ref: view.ref, status: 'GONE', view: null } });
            return 'GONE';
          case 'FAILED':
            update({ talk: 'FAILED' });
            return 'FAILED';
        }
      } finally {
        talking = false;
      }
    },
    endDiscussion() {
      const discussion = state.discussion;
      if (!live() || discussion === null) return;
      update({ discussion: null });
      // Told once; if it does not land the server's own bounded window lets it lapse.
      void transport.closeDiscussion(discussion.ref).catch(() => false);
    },
    retire() {
      retired = true;
      listeners.clear();
    },
  };
}
