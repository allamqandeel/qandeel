/**
 * A3-01 — the «النشاط» / Activity feed, for ONE runtime generation (P3 §3–§4; I-08N-01 D28–D31, D38–D40, D47).
 *
 *   - One quiet chronological feed, «الكل» / All by default; the lightweight filters are a presentation of the five
 *     semantic categories over the same feed, never five destinations.
 *   - Pages are read when the surface asks: on opening, on a filter change, and, near the end, the next older page
 *     (bounded keyset pages). Nothing polls here.
 *   - SEEN is attention only: rows the reader actually looked at are batched and sent; opening Activity does not
 *     clear everything (D47).
 *   - OPENED is attention only, and opening revalidates the Direct Entry at that moment (D38): the answer decides
 *     where the reader goes, and a stale or not-yet-available destination never guesses a replacement (D39).
 */
import type { ActivityCategory, ActivityItem, ActivityOpenOutcome, ActivityPage } from '../runtime-entry';

export const ACTIVITY_PAGE_LIMIT = 30;
const SEEN_BATCH_MAX = 64;

export interface FeedTransport {
  readPage(options: { readonly category: ActivityCategory | null; readonly before: string | null; readonly limit: number }): Promise<ActivityPage>;
  markSeen(itemIds: readonly string[]): Promise<boolean>;
  open(itemId: string): Promise<ActivityOpenOutcome>;
}

export interface FeedState {
  readonly status: 'IDLE' | 'LOADING' | 'READY' | 'UNAVAILABLE';
  readonly filter: ActivityCategory | null;
  readonly items: readonly ActivityItem[];
  readonly before: string | null;
  readonly loadingOlder: boolean;
}

export interface ActivityFeedController {
  getState(): FeedState;
  subscribe(listener: () => void): () => void;
  /** Read the first page of the given filter (null = All). */
  show(filter: ActivityCategory | null): void;
  retry(): void;
  loadOlder(): void;
  /** Rows the reader has looked at (P3-A: half on screen for a readable moment — craft). */
  seen(itemIds: readonly string[]): void;
  /** The reader entered a row: OPENED, and the destination revalidated now. */
  open(itemId: string): Promise<ActivityOpenOutcome>;
  retire(): void;
}

const IDLE: FeedState = Object.freeze({ status: 'IDLE', filter: null, items: [], before: null, loadingOlder: false });

export function createActivityFeedController(options: { readonly transport: FeedTransport; readonly isCurrent: () => boolean; readonly onAttentionChanged?: () => void }): ActivityFeedController {
  const listeners = new Set<() => void>();
  let state: FeedState = IDLE;
  let generation = 0;
  let retired = false;
  const sentSeen = new Set<string>();
  const live = () => !retired && options.isCurrent();
  const publish = (next: FeedState) => {
    state = next;
    for (const listener of Array.from(listeners)) listener();
  };
  const replace = (itemId: string, change: (item: ActivityItem) => ActivityItem) =>
    publish({ ...state, items: state.items.map((item) => (item.id === itemId ? change(item) : item)) });

  function load(filter: ActivityCategory | null): void {
    if (!live()) return;
    const mine = ++generation;
    publish({ status: 'LOADING', filter, items: state.filter === filter ? state.items : [], before: null, loadingOlder: false });
    void options.transport.readPage({ category: filter, before: null, limit: ACTIVITY_PAGE_LIMIT }).then((page) => {
      if (!live() || mine !== generation) return;
      publish(page.kind === 'READ'
        ? { status: 'READY', filter, items: page.items, before: page.before, loadingOlder: false }
        : { status: 'UNAVAILABLE', filter, items: [], before: null, loadingOlder: false });
    });
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    show: (filter) => load(filter),
    retry: () => load(state.filter),
    loadOlder() {
      if (!live() || state.status !== 'READY' || state.before === null || state.loadingOlder) return;
      const mine = generation;
      const { filter, before } = state;
      publish({ ...state, loadingOlder: true });
      void options.transport.readPage({ category: filter, before, limit: ACTIVITY_PAGE_LIMIT }).then((page) => {
        if (!live() || mine !== generation) return;
        if (page.kind !== 'READ') {
          publish({ ...state, loadingOlder: false });
          return;
        }
        const known = new Set(state.items.map((item) => item.id));
        publish({ ...state, items: [...state.items, ...page.items.filter((item) => !known.has(item.id))], before: page.before, loadingOlder: false });
      });
    },
    seen(itemIds) {
      if (!live()) return;
      const fresh = itemIds.filter((id) => !sentSeen.has(id) && state.items.some((item) => item.id === id && item.attention === 'NEW'));
      if (fresh.length === 0) return;
      for (const id of fresh) sentSeen.add(id);
      const batch = fresh.slice(0, SEEN_BATCH_MAX);
      void options.transport.markSeen(batch).then((ok) => {
        if (!live()) return;
        if (!ok) {
          // Unknown stays unknown: the rows keep their state, and may be sent again next time they are seen.
          for (const id of batch) sentSeen.delete(id);
          return;
        }
        // Seen quietens a NEW row; a waiting (actionable) row keeps its WAITING mark (P3 §4).
        publish({ ...state, items: state.items.map((item) => (batch.includes(item.id) && item.attention === 'NEW'
          ? { ...item, attention: 'SEEN', waiting: item.actionable && !item.stale, mark: item.mark && item.actionable }
          : item)) });
        options.onAttentionChanged?.();
      });
    },
    async open(itemId) {
      const outcome = await options.transport.open(itemId);
      if (live() && outcome.kind !== 'FAILED' && outcome.kind !== 'GONE') {
        replace(itemId, (item) => ({ ...item, attention: 'OPENED', waiting: false, mark: false, stale: item.stale || outcome.kind === 'STALE' }));
        options.onAttentionChanged?.();
      }
      return outcome;
    },
    retire() {
      retired = true;
      listeners.clear();
    },
  };
}
