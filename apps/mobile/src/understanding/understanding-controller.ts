/**
 * W3-MEGA-U (E2E-D-14 / D-15) — the reader's «فهم قنديل» / QANDEEL Understanding, for ONE runtime generation.
 *
 * It holds exactly what the server projected — the current items, one opened item's explanation, and the one item the
 * reader chose to talk to QANDEEL about — and nothing it has not been told. It owns no identity, no credential and no
 * persistence; the integration owner builds one per runtime generation over the Understanding transport bound to that
 * identity and retires it with the generation.
 *
 *   - Reads happen when the surface asks (it is opened, an item is opened, the reader asks again). Nothing polls.
 *   - "Talk to QANDEEL about this" is bound to the exact revision the reader is looking at. When the item changed in
 *     the meantime nothing is recorded: the item is read again and the reader sees the current interpretation before
 *     choosing again. A choice is never silently moved onto a newer interpretation.
 *   - U3 — "I see it differently" (P1 §11.4, PG-01) is an EXPLICIT act on the discussed item, bound to the revision the
 *     reader was shown and to ONE command identity. A retry after a lost answer is the SAME command, so the server
 *     records it once. When the item changed, nothing is recorded: the current interpretation is shown first and the
 *     reader decides again — an objection is never applied to an interpretation they did not see. No words the reader
 *     typed are ever sent with it.
 *   - W3-CORR-U — «أوافق عليه الآن» / "I agree with this now" is the ONE explicit way to resolve the reader's own
 *     disagreement, offered only while the discussed item is under review. It is bound to the revision shown and to ONE
 *     command identity of its own (never the disagreement's); a retry after a lost answer is the SAME command. It is not
 *     an undo: the disagreement stays in the item's history, the discussion stays open, and a later "I see it
 *     differently" is a new disagreement.
 *   - One talk, one disagreement and one resolution request at a time.
 */
import type {
  UnderstandingDetailOutcome,
  UnderstandingDetailView,
  UnderstandingDisagreementOutcome,
  UnderstandingDiscussionOutcome,
  UnderstandingItemView,
  UnderstandingListOutcome,
  UnderstandingResolutionOutcome,
  UnderstandingTheme,
} from '../runtime-entry';

export type UnderstandingReadStatus = 'LOADING' | 'READY' | 'UNAVAILABLE';

export interface UnderstandingDetailState {
  readonly ref: string;
  /** GONE: no longer one of the reader's current items. */
  readonly status: UnderstandingReadStatus | 'GONE';
  readonly view: UnderstandingDetailView | null;
}

/** The one item the reader chose to talk to QANDEEL about, as they were last shown it. */
export interface UnderstandingDiscussion {
  readonly ref: string;
  readonly revision: string;
  readonly theme: UnderstandingTheme;
  readonly summary: string;
  /** U3: the reader explicitly disagreed and it is Contested / Under Review. */
  readonly underReview: boolean;
  /** U3: the state of the reader's disagreement request. */
  readonly disagreement: 'IDLE' | 'SENDING' | 'FAILED';
  /** W3-CORR-U: the state of the reader's resolution ("I agree with this now") request. */
  readonly resolution: 'IDLE' | 'SENDING' | 'FAILED';
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
  disagree(ref: string, commandId: string, revision: string): Promise<UnderstandingDisagreementOutcome>;
  resolveDisagreement(ref: string, commandId: string, revision: string): Promise<UnderstandingResolutionOutcome>;
}

/**
 * What a talk request came to:
 *   OPENED   QANDEEL now knows which item the reader chose; return to the Conversation;
 *   CHANGED  the item changed since it was shown — it was read again and nothing was recorded;
 *   GONE     it is no longer one of the reader's current items;
 *   FAILED   it is not known to have been recorded; the reader may ask again.
 */
export type UnderstandingTalkResult = 'OPENED' | 'CHANGED' | 'GONE' | 'FAILED';

/**
 * What an explicit disagreement came to:
 *   UNDER_REVIEW  recorded (now, as the same command replayed, or already): the item is Contested / Under Review;
 *   CHANGED       the item changed since it was shown — nothing was recorded; the current one is shown;
 *   GONE          it is no longer one of the reader's current items;
 *   FAILED        it is not known whether it was recorded; asking again is the SAME command.
 */
export type UnderstandingDisagreementResult = 'UNDER_REVIEW' | 'CHANGED' | 'GONE' | 'FAILED';

/**
 * What an explicit resolution came to:
 *   RESOLVED  recorded (now, or as the same command replayed): the item is no longer under review; its history stays;
 *   CHANGED   the item changed, or is no longer under review — nothing was resolved; the current one is shown;
 *   GONE      it is no longer one of the reader's current items;
 *   FAILED    it is not known whether it was resolved; asking again is the SAME command.
 */
export type UnderstandingResolutionResult = 'RESOLVED' | 'CHANGED' | 'GONE' | 'FAILED';

export interface UnderstandingController {
  getState(): UnderstandingState;
  subscribe(listener: () => void): () => void;
  /** Read the current items. Called when the surface is shown and when the reader asks again. */
  refresh(): void;
  openItem(ref: string): void;
  closeItem(): void;
  /** "Talk to QANDEEL about this" for the opened item. `null` when refused (nothing opened, or one in flight). */
  talk(): Promise<UnderstandingTalkResult | null>;
  /** U3 — "I see it differently" for the discussed item. `null` when refused (nothing discussed, done, or in flight). */
  disagree(): Promise<UnderstandingDisagreementResult | null>;
  /** W3-CORR-U — "I agree with this now" for the discussed item. `null` when refused (not under review, or in flight). */
  agree(): Promise<UnderstandingResolutionResult | null>;
  /** The reader ends the discussion context. Local first; the server is told once. */
  endDiscussion(): void;
  retire(): void;
}

export interface UnderstandingControllerOptions {
  readonly transport: UnderstandingTransport;
  readonly isCurrent: () => boolean;
  readonly newCommandId?: () => string;
}

/**
 * A command identity: UUID-shaped, unique per disagreement within this account. It is never a credential and carries
 * no reader data; the database compares it only with that account's own contests, so no cryptographic source is needed.
 */
export function mintUnderstandingCommandId(): string {
  const hex = (count: number) => Array.from({ length: count }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const variant = (8 + Math.floor(Math.random() * 4)).toString(16);
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
}

const INITIAL: UnderstandingState = Object.freeze({ list: 'LOADING', items: [], detail: null, talk: 'IDLE', discussion: null });

export function createUnderstandingController({
  transport,
  isCurrent,
  newCommandId = mintUnderstandingCommandId,
}: UnderstandingControllerOptions): UnderstandingController {
  let state: UnderstandingState = INITIAL;
  let retired = false;
  let listRead = 0;
  let detailRead = 0;
  let talking = false;
  let disagreeing = false;
  let agreeing = false;
  /** The ONE command identity for the disagreement the reader is making: same item, same revision → same command. */
  let command: { readonly ref: string; readonly revision: string; readonly id: string } | null = null;
  /** W3-CORR-U: the resolution's OWN command identity, by the same rule and never shared with a disagreement. */
  let resolutionCommand: { readonly ref: string; readonly revision: string; readonly id: string } | null = null;
  const listeners = new Set<() => void>();
  const live = () => !retired && isCurrent();

  const update = (next: Partial<UnderstandingState>) => {
    state = { ...state, ...next };
    for (const listener of Array.from(listeners)) listener();
  };
  const updateDiscussion = (ref: string, next: Partial<UnderstandingDiscussion>) => {
    if (state.discussion === null || state.discussion.ref !== ref) return;
    update({ discussion: { ...state.discussion, ...next } });
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
            update({
              talk: 'IDLE',
              discussion: {
                ref: view.ref, revision: view.revision, theme: view.theme, summary: view.summary, underReview: view.underReview,
                disagreement: 'IDLE', resolution: 'IDLE',
              },
            });
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
    async disagree() {
      const discussion = state.discussion;
      if (!live() || disagreeing || discussion === null || discussion.underReview) return null;
      const { ref, revision } = discussion;
      if (command === null || command.ref !== ref || command.revision !== revision) command = { ref, revision, id: newCommandId() };
      const commandId = command.id;
      disagreeing = true;
      updateDiscussion(ref, { disagreement: 'SENDING' });
      try {
        const outcome = await transport.disagree(ref, commandId, revision).catch((): UnderstandingDisagreementOutcome => ({ kind: 'FAILED' }));
        if (!live()) return 'FAILED';
        switch (outcome.kind) {
          case 'UNDER_REVIEW':
            command = null;
            updateDiscussion(ref, { underReview: true, revision: outcome.revision, disagreement: 'IDLE', resolution: 'IDLE' });
            return 'UNDER_REVIEW';
          case 'CHANGED': {
            // Never applied to an interpretation the reader did not see: show the current one; they decide again.
            command = null;
            const fresh = await transport.readItem(ref).catch((): UnderstandingDetailOutcome => ({ kind: 'UNAVAILABLE' }));
            if (!live()) return 'CHANGED';
            if (fresh.kind === 'READ') {
              updateDiscussion(ref, { revision: fresh.view.revision, summary: fresh.view.summary, theme: fresh.view.theme, underReview: fresh.view.underReview, disagreement: 'IDLE' });
            } else if (fresh.kind === 'GONE') {
              update({ discussion: null });
            } else {
              updateDiscussion(ref, { disagreement: 'FAILED' });
            }
            return 'CHANGED';
          }
          case 'GONE':
            command = null;
            update({ discussion: null });
            return 'GONE';
          case 'CONFLICT':
            // This identity was spent elsewhere: the next attempt is a new command; nothing is known to be recorded.
            command = null;
            updateDiscussion(ref, { disagreement: 'FAILED' });
            return 'FAILED';
          case 'FAILED':
            // Unknown: the SAME command is sent again next time, so it is recorded at most once.
            updateDiscussion(ref, { disagreement: 'FAILED' });
            return 'FAILED';
        }
      } finally {
        disagreeing = false;
      }
    },
    async agree() {
      const discussion = state.discussion;
      if (!live() || agreeing || discussion === null || !discussion.underReview) return null;
      const { ref, revision } = discussion;
      if (resolutionCommand === null || resolutionCommand.ref !== ref || resolutionCommand.revision !== revision) {
        resolutionCommand = { ref, revision, id: newCommandId() };
      }
      const commandId = resolutionCommand.id;
      agreeing = true;
      updateDiscussion(ref, { resolution: 'SENDING' });
      try {
        const outcome = await transport.resolveDisagreement(ref, commandId, revision).catch((): UnderstandingResolutionOutcome => ({ kind: 'FAILED' }));
        if (!live()) return 'FAILED';
        switch (outcome.kind) {
          case 'RESOLVED':
            // The discussion stays open; a later disagreement is a new one, with a new command.
            resolutionCommand = null;
            command = null;
            updateDiscussion(ref, { underReview: false, revision: outcome.revision, resolution: 'IDLE', disagreement: 'IDLE' });
            return 'RESOLVED';
          case 'CHANGED':
          case 'NOT_UNDER_REVIEW': {
            // Never applied to an interpretation the reader did not see: show the current one; they decide again.
            resolutionCommand = null;
            const fresh = await transport.readItem(ref).catch((): UnderstandingDetailOutcome => ({ kind: 'UNAVAILABLE' }));
            if (!live()) return 'CHANGED';
            if (fresh.kind === 'READ') {
              updateDiscussion(ref, { revision: fresh.view.revision, summary: fresh.view.summary, theme: fresh.view.theme, underReview: fresh.view.underReview, resolution: 'IDLE' });
            } else if (fresh.kind === 'GONE') {
              update({ discussion: null });
            } else {
              updateDiscussion(ref, { resolution: 'FAILED' });
            }
            return 'CHANGED';
          }
          case 'GONE':
            resolutionCommand = null;
            update({ discussion: null });
            return 'GONE';
          case 'CONFLICT':
            // This identity was spent elsewhere: the next attempt is a new command; nothing is known to be resolved.
            resolutionCommand = null;
            updateDiscussion(ref, { resolution: 'FAILED' });
            return 'FAILED';
          case 'FAILED':
            // Unknown: the SAME command is sent again next time, so it is resolved at most once.
            updateDiscussion(ref, { resolution: 'FAILED' });
            return 'FAILED';
        }
      } finally {
        agreeing = false;
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
