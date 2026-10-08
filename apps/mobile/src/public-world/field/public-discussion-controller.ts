/**
 * S5-04 — the dependent discussion of ONE Public Experience, the one the field focused at NEAR.
 *
 * The discussion is not a World, a feed or a DM: it exists only under its Experience, is opened from that Experience's
 * panel, and Back returns to the same panel in the same field (the field controller holds that order). What it holds is
 * viewer-local and its own: the posts the server served for this Experience on its LATEST read, whether the reader may
 * contribute now, the reply target the reader chose, and the one post in flight.
 *
 * Nothing here is authority. No cache is a source of display: opening, every commit, a retry and a return to the
 * foreground read again, and a read that answers ABSENT empties the discussion at once — no tombstone, no reason. A post
 * carries only the reader's words, the Experience and the post it answers; the server decides the author, identity,
 * version, thread root, ordinal and instant. A failed send keeps its command id, so trying again is the same command,
 * never a second post. Nothing ranks, likes, follows, counts or logs.
 */
import type {
  ForegroundSignal, PublicAuthoringAnswer, PublicDiscussionPage, PublicDiscussionPost, PublicDiscussionPostOutcome, PublicQandeelState,
} from '../../runtime-entry';

export interface PublicDiscussionTransport {
  read(experienceId: string, after: number | null): Promise<PublicAuthoringAnswer<PublicDiscussionPage>>;
  post(experienceId: string, commandId: string, text: string, replyTo: string | null): Promise<PublicAuthoringAnswer<PublicDiscussionPostOutcome>>;
  retryQandeel(experienceId: string, postId: string): Promise<PublicAuthoringAnswer<PublicQandeelState>>;
}

/** One visible thread: a top-level post and the replies beneath it, in canonical ordinal order (one visible depth, D2). */
export interface PublicDiscussionGroup { readonly root: PublicDiscussionPost; readonly replies: ReadonlyArray<PublicDiscussionPost> }

export interface PublicDiscussionState {
  readonly experienceId: string | null;
  readonly status: 'CLOSED' | 'LOADING' | 'SERVED' | 'ABSENT' | 'UNAVAILABLE';
  readonly canContribute: boolean;
  readonly threads: ReadonlyArray<PublicDiscussionGroup>;
  readonly hasMore: boolean;
  /** The post the reader chose to answer (its thread root is where the reply lands), or null for a new post. */
  readonly replyTo: PublicDiscussionPost | null;
  readonly send: 'IDLE' | 'SENDING' | 'UNCONFIRMED' | 'REFUSED';
}

export interface PublicDiscussionController {
  getState(): PublicDiscussionState;
  subscribe(listener: () => void): () => void;
  /** Open the discussion of one Experience: read it now. Nothing of another Experience's discussion is kept. */
  open(experienceId: string): void;
  close(): void;
  loadMore(): void;
  /** Read everything on display again. */
  refresh(): void;
  replyTo(post: PublicDiscussionPost | null): void;
  /** Send the reader's words (a new post, or a reply to the chosen post). Resolves true when committed. */
  send(text: string): Promise<boolean>;
  /** Ask again for the one Public QANDEEL response of the reader's own invoking post. */
  retryQandeel(postId: string): void;
  retire(): void;
}

export interface PublicDiscussionControllerOptions {
  readonly transport: PublicDiscussionTransport | null;
  readonly isCurrent: () => boolean;
  readonly foreground?: ForegroundSignal;
  /** Fresh command identities (the platform's UUID source); one per new send attempt. */
  readonly newId: () => string;
}

/** The server's bound on one post (the 0147 bound), held here so the surface never reaches past the runtime barrel. */
export const PUBLIC_DISCUSSION_TEXT_MAX = 4000;

const CLOSED: PublicDiscussionState = Object.freeze({
  experienceId: null, status: 'CLOSED', canContribute: false, threads: [], hasMore: false, replyTo: null, send: 'IDLE',
});

/** Group served posts into visible threads: roots in ordinal order, each with its replies in ordinal order. */
export function threadsOf(posts: ReadonlyArray<PublicDiscussionPost>): PublicDiscussionGroup[] {
  const roots = new Map<string, { root: PublicDiscussionPost; replies: PublicDiscussionPost[] }>();
  const sorted = [...posts].sort((a, b) => a.ordinal - b.ordinal);
  for (const post of sorted) if (post.threadRootId === post.id) roots.set(post.id, { root: post, replies: [] });
  for (const post of sorted) if (post.threadRootId !== post.id) roots.get(post.threadRootId)?.replies.push(post);
  return [...roots.values()];
}

export function createPublicDiscussionController({ transport, isCurrent, foreground, newId }: PublicDiscussionControllerOptions): PublicDiscussionController {
  const listeners = new Set<() => void>();
  let state: PublicDiscussionState = CLOSED;
  let posts: PublicDiscussionPost[] = [];
  let nextAfter: number | null = null;
  let retired = false;
  let ticket = 0;
  /** The command id of the send in flight or last left unconfirmed: retrying the same words is the same command. */
  let pending: { readonly text: string; readonly replyTo: string | null; readonly commandId: string } | null = null;
  const live = () => !retired && isCurrent();
  const publish = (next: Partial<PublicDiscussionState>) => {
    if (!live()) return;
    state = Object.freeze({ ...state, ...next });
    for (const listener of Array.from(listeners)) listener();
  };

  /** Read the discussion again from its first page through as many pages as are on display. */
  async function read(experienceId: string, pages: number): Promise<void> {
    const mine = ++ticket;
    if (!transport) { publish({ status: 'UNAVAILABLE', threads: [] }); return; }
    const collected: PublicDiscussionPost[] = [];
    let after: number | null = null;
    let canContribute = false;
    for (let page = 0; page < Math.max(1, pages); page += 1) {
      const answer: PublicAuthoringAnswer<PublicDiscussionPage> = await transport.read(experienceId, after).catch(() => ({ kind: 'NO_ANSWER' as const }));
      if (mine !== ticket || state.experienceId !== experienceId) return;
      if (answer.kind !== 'ANSWER') { posts = []; publish({ status: 'UNAVAILABLE', threads: [], hasMore: false, canContribute: false }); return; }
      if (answer.value.kind === 'ABSENT') {
        // No longer served: the discussion goes with its Experience — nothing is kept, nothing says why.
        posts = []; nextAfter = null;
        publish({ status: 'ABSENT', threads: [], hasMore: false, canContribute: false, replyTo: null });
        return;
      }
      canContribute = answer.value.canContribute;
      collected.push(...answer.value.posts);
      after = answer.value.nextAfter;
      if (after === null) break;
    }
    posts = collected;
    nextAfter = after;
    const replyTo = state.replyTo !== null ? posts.find((post) => post.id === state.replyTo?.id) ?? null : null;
    publish({ status: 'SERVED', canContribute, threads: threadsOf(posts), hasMore: nextAfter !== null, replyTo });
  }

  let shownPages = 1;
  const refresh = () => {
    if (state.experienceId !== null && state.status !== 'CLOSED') void read(state.experienceId, shownPages);
  };
  const unsubscribeForeground = foreground?.subscribe((next) => { if (next === 'ACTIVE') refresh(); });

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open(experienceId) {
      ticket += 1; posts = []; nextAfter = null; pending = null; shownPages = 1;
      publish({ ...CLOSED, experienceId, status: 'LOADING' });
      void read(experienceId, 1);
    },
    close() {
      ticket += 1; posts = []; nextAfter = null; pending = null;
      publish(CLOSED);
    },
    loadMore() {
      const experienceId = state.experienceId;
      if (!transport || experienceId === null || nextAfter === null || state.status !== 'SERVED') return;
      const mine = ++ticket;
      void transport.read(experienceId, nextAfter).catch(() => ({ kind: 'NO_ANSWER' as const })).then((answer) => {
        if (mine !== ticket || state.experienceId !== experienceId) return;
        if (answer.kind !== 'ANSWER' || answer.value.kind === 'ABSENT') { refresh(); return; }
        shownPages += 1;
        posts = [...posts, ...answer.value.posts.filter((post) => !posts.some((known) => known.id === post.id))];
        nextAfter = answer.value.nextAfter;
        publish({ canContribute: answer.value.canContribute, threads: threadsOf(posts), hasMore: nextAfter !== null });
      });
    },
    refresh,
    replyTo(post) {
      publish({ replyTo: post });
    },
    async send(text) {
      const experienceId = state.experienceId;
      const words = text.trim().length === 0 ? '' : text;
      if (!transport || experienceId === null || words.length === 0 || state.send === 'SENDING' || !state.canContribute) return false;
      const replyTo = state.replyTo?.id ?? null;
      if (pending === null || pending.text !== words || pending.replyTo !== replyTo) pending = { text: words, replyTo, commandId: newId() };
      const attempt = pending;
      publish({ send: 'SENDING' });
      const answer = await transport.post(experienceId, attempt.commandId, attempt.text, attempt.replyTo).catch(() => ({ kind: 'NO_ANSWER' as const }));
      if (!live() || state.experienceId !== experienceId) return false;
      if (answer.kind !== 'ANSWER') { publish({ send: 'UNCONFIRMED' }); return false; }
      if (answer.value.kind !== 'COMMITTED') {
        pending = null;
        publish({ send: 'REFUSED' });
        refresh();
        return false;
      }
      pending = null;
      publish({ send: 'IDLE', replyTo: null });
      refresh();
      return true;
    },
    retryQandeel(postId) {
      const experienceId = state.experienceId;
      if (!transport || experienceId === null) return;
      void transport.retryQandeel(experienceId, postId).catch(() => undefined).then(() => refresh());
    },
    retire() {
      retired = true;
      unsubscribeForeground?.();
      listeners.clear();
    },
  };
}
