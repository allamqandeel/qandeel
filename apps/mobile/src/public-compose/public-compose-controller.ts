/**
 * S8A-05 CP1 — the «اكتب موضوعك» / Write your topic controller, drawn inside the «العالم العام» / Public World root.
 *
 *   LIST     the reader's own private topic drafts («مسوداتي»), from the account — any session of it;
 *   EDIT     one draft: a human title, the reader's own text and one section they choose. Nothing is suggested. A save is a
 *            compare-and-set on the draft's revision; a draft changed elsewhere is reloaded, never overwritten;
 *   PREVIEW  exactly what Public World would show — the title, the text, the section and the CURRENT public display —
 *            with the deterministic privacy notes, and «تجهيز للنشر», which is closed until Stage 9: the honest answer
 *            leaves the draft as it is.
 *
 * Saving is automatic (WP1 §1 step 3): once the reader's typing rests for `PUBLIC_COMPOSE_AUTOSAVE_MS`, and at once when
 * the reader leaves the editor, the workspace closes, the Public area is retired or the app leaves the foreground. Saves
 * run one at a time, each against the revision the account last confirmed, so a save never races another into a false
 * conflict. `saving` says only what is known: SAVING while a save is out, FAILED when the last one got no definite answer
 * (the words stay in the editor and the next rest or «حفظ» tries again), IDLE otherwise — and the draft counts as saved
 * only when the account confirmed exactly what is shown (`isDraftSaved`).
 *
 * A prepared, never-published topic can go back to its draft: the prepared copy is erased. Deleting a draft erases its
 * words. Unsaved words live in memory only: nothing is stored on the device. The Personal world and the Shared area are
 * never read; nothing is logged.
 *
 * S8A-05 CP2 — «انشر من قنديل» / Publish from QANDEEL (`sources`, optional): a draft may take its material from the
 * reader's own conversation or from one «فهم قنديل» item, by REFERENCE only — this controller never holds, sends or copies
 * the conversation's words. A draft is created from a source (`createFromSource`) by the entry that chose it, then opened
 * here like any draft. Its preview reads the items the topic would contain one page of 50 at a time — speakers, emphasis
 * and gaps — the reader may emphasize or un-emphasize a whole message, and QANDEEL material asks the reader's ONE
 * acknowledgement for the exact revision previewed. Removing the material keeps the draft and its words.
 */
import type {
  ForegroundSignal, PublicAuthoringAnswer, PublicTopicAcknowledgeOutcome, PublicTopicClearOutcome, PublicTopicConversationChoice, PublicTopicDeleteOutcome,
  PublicTopicDiscardOutcome, PublicTopicDraft, PublicTopicDraftRead, PublicTopicDraftSummary, PublicTopicItem, PublicTopicItemsPage, PublicTopicItemsRead,
  PublicTopicPrepareOutcome, PublicTopicPreview, PublicTopicPreviewRead, PublicTopicSaveResult, PublicTopicSection, PublicTopicSource,
  PublicTopicSourceRead, PublicTopicSourceResult, PublicTopicUnderstandingOutcome,
} from '../runtime-entry';
import { PUBLIC_TOPIC_TEXT_MAX, PUBLIC_TOPIC_TITLE_MAX } from '../runtime-entry';

export interface PublicComposeTransport {
  drafts(): Promise<PublicAuthoringAnswer<readonly PublicTopicDraftSummary[]>>;
  draft(draftId: string): Promise<PublicAuthoringAnswer<PublicTopicDraftRead>>;
  save(draftId: string, expectedRevision: number, title: string, text: string, section: PublicTopicSection | null): Promise<PublicAuthoringAnswer<PublicTopicSaveResult>>;
  remove(draftId: string, commandId: string): Promise<PublicAuthoringAnswer<PublicTopicDeleteOutcome>>;
  preview(draftId: string): Promise<PublicAuthoringAnswer<PublicTopicPreviewRead>>;
  prepare(draftId: string, commandId: string, expectedRevision: number): Promise<PublicAuthoringAnswer<PublicTopicPrepareOutcome>>;
  discard(experienceId: string, commandId: string): Promise<PublicAuthoringAnswer<PublicTopicDiscardOutcome>>;
}

/** S8A-05 CP2 — the source commands and reads (the S8A-05 CP2 `PublicComposeApiClient` methods). */
export interface PublicComposeSourceTransport {
  setConversationSource(draftId: string, expectedRevision: number, choice: PublicTopicConversationChoice): Promise<PublicAuthoringAnswer<PublicTopicSourceResult>>;
  setUnderstandingSource(ref: string, revision: string, draftId: string, expectedRevision: number):
  Promise<PublicAuthoringAnswer<{ readonly outcome: PublicTopicUnderstandingOutcome; readonly revision: number | null }>>;
  clearSource(draftId: string, expectedRevision: number): Promise<PublicAuthoringAnswer<{ readonly outcome: PublicTopicClearOutcome; readonly revision: number | null }>>;
  acknowledgeSource(draftId: string, revision: number): Promise<PublicAuthoringAnswer<PublicTopicAcknowledgeOutcome>>;
  source(draftId: string): Promise<PublicAuthoringAnswer<PublicTopicSourceRead>>;
  items(draftId: string, page: number): Promise<PublicAuthoringAnswer<PublicTopicItemsRead>>;
}

/** A source an entry chose: positions in the reader's own conversation, or one «فهم قنديل» item at the revision shown. */
export type PublicComposeSourceChoice =
  | { readonly kind: 'CONVERSATION'; readonly choice: PublicTopicConversationChoice }
  | { readonly kind: 'UNDERSTANDING'; readonly ref: string; readonly revision: string };
/** CREATED: a new draft holds the source; REFUSED: the account answered why not; FAILED: no definite answer. */
export type PublicComposeCreateResult =
  | { readonly kind: 'CREATED'; readonly draftId: string }
  | { readonly kind: 'REFUSED'; readonly outcome: Exclude<PublicTopicUnderstandingOutcome, 'CREATED' | 'SAVED'> }
  | { readonly kind: 'FAILED' };

/** The page of items shown, and which items begin a whole message (the ones that can be emphasized). */
export interface PublicComposeItems {
  readonly page: PublicTopicItemsPage;
  /** Item position → the Session Position of its message's first unit, for the items that begin a message. */
  readonly messageStarts: ReadonlyMap<number, number>;
}

export type PublicComposeScreen = 'CLOSED' | 'LIST' | 'EDIT' | 'PREVIEW';
export type PublicComposeNotice =
  | 'NONE' | 'STALE' | 'LIMIT_REACHED' | 'DELETION_PENDING' | 'INVALID' | 'NOT_OPEN' | 'TITLE_TOO_SHORT' | 'TEXT_REQUIRED'
  | 'SECTION_REQUIRED' | 'DELETED' | 'ACTION_UNAVAILABLE' | 'ACKNOWLEDGED';
/** What is known about saving the draft being edited (see the header). */
export type PublicComposeSaving = 'IDLE' | 'SAVING' | 'FAILED';

/** The draft being edited. `revision` 0 is a new draft the account does not hold yet. */
export interface PublicComposeDraft extends PublicTopicDraft { readonly dirty: boolean }

export interface PublicComposeState {
  readonly screen: PublicComposeScreen;
  readonly status: 'LOADING' | 'READY' | 'UNAVAILABLE';
  readonly drafts: readonly PublicTopicDraftSummary[];
  readonly draft: PublicComposeDraft | null;
  readonly preview: PublicTopicPreview | null;
  readonly confirmingDelete: boolean;
  readonly busy: boolean;
  readonly notice: PublicComposeNotice;
  readonly saving: PublicComposeSaving;
  /** S8A-05 CP2: the draft's source, once read (null: not read, or no source transport). */
  readonly source: { readonly revision: number; readonly source: PublicTopicSource; readonly acknowledged: boolean } | null;
  /** S8A-05 CP2: the page of items shown in the preview (or of a prepared topic), when the draft has a source. */
  readonly items: PublicComposeItems | null;
  readonly itemsStatus: 'IDLE' | 'LOADING' | 'UNAVAILABLE';
}

/** True only when the account confirmed exactly the words shown: the one condition for saying the draft is saved. */
export const isDraftSaved = (state: Pick<PublicComposeState, 'draft' | 'saving'>): boolean =>
  state.draft !== null && state.draft.state === 'EDITING' && state.draft.revision > 0 && !state.draft.dirty && state.saving === 'IDLE';

export interface PublicComposeController {
  getState(): PublicComposeState;
  subscribe(listener: () => void): () => void;
  open(): void;
  close(): void;
  back(): void;
  refresh(): void;
  newDraft(): void;
  openDraft(draftId: string): void;
  setTitle(title: string): void;
  setText(text: string): void;
  setSection(section: PublicTopicSection): void;
  /** Save now (also the way to try again after a failed save). */
  save(): void;
  showPreview(): void;
  prepare(): void;
  backToDraft(): void;
  askDelete(): void;
  confirmDelete(): void;
  retire(): void;
  /** S8A-05 CP2 — a new draft holding this source. Nothing is shown here: the entry opens the draft (`openDraft`). */
  createFromSource(choice: PublicComposeSourceChoice): Promise<PublicComposeCreateResult>;
  /** S8A-05 CP2 — one page of the items, 1-based. */
  showItemsPage(page: number): void;
  /** S8A-05 CP2 — emphasize or un-emphasize the whole message the item at this position begins. */
  toggleEmphasis(itemPosition: number): void;
  /** S8A-05 CP2 — the ONE acknowledgement, for the revision previewed. */
  acknowledge(): void;
  /** S8A-05 CP2 — remove the draft's source; the draft and its words stay. */
  clearSource(): void;
}

export interface PublicComposeControllerOptions {
  readonly transport: PublicComposeTransport | null;
  readonly isCurrent: () => boolean;
  /** A fresh UUID: a new draft's id, and each command's id. */
  readonly newId: () => string;
  /** The runtime entry's ONE foreground signal (T-12P §2.7): leaving the foreground saves what is unsaved at once. */
  readonly foreground?: ForegroundSignal;
  /** S8A-05 CP2: the source commands and reads. Absent: the controller is exactly CP1's. */
  readonly sources?: PublicComposeSourceTransport | null;
}

/** How long typing rests before the draft is saved to the account. */
export const PUBLIC_COMPOSE_AUTOSAVE_MS = 1200;

const CLOSED: PublicComposeState = Object.freeze<PublicComposeState>({
  screen: 'CLOSED', status: 'READY', drafts: [], draft: null, preview: null, confirmingDelete: false, busy: false, notice: 'NONE', saving: 'IDLE',
  source: null, items: null, itemsStatus: 'IDLE',
});
const SOURCE_REFUSALS: readonly string[] = ['SOURCE_UNAVAILABLE', 'NOT_WHOLE_MESSAGES', 'SELECTION_INVALID', 'NOTHING_SELECTED', 'TOO_LARGE',
  'UNDERSTANDING_CHANGED', 'UNDERSTANDING_UNDER_REVIEW', 'UNDERSTANDING_WITHHELD', 'ACKNOWLEDGEMENT_REQUIRED'];
/** Which items of a page begin a whole message: the first unit of each message, by its message ordinal. */
function messageStartsOf(items: readonly PublicTopicItem[], before: PublicTopicItem | null): ReadonlyMap<number, number> {
  const starts = new Map<number, number>();
  let previous = before;
  for (const item of items) {
    const begins = (item.role === 'YOUR_MESSAGE' || item.role === 'QANDEEL_REPLY') && item.message !== null && item.sessionPosition !== null
      && (previous === null || previous.message !== item.message);
    if (begins) starts.set(item.position, item.sessionPosition as number);
    previous = item;
  }
  return starts;
}
const NO: { readonly kind: 'NO_ANSWER' } = Object.freeze({ kind: 'NO_ANSWER' as const });
const SAVE_NOTICE: Readonly<Partial<Record<PublicTopicSaveResult['outcome'], PublicComposeNotice>>> = {
  LIMIT_REACHED: 'LIMIT_REACHED', INVALID: 'INVALID', ACCOUNT_DELETION_PENDING: 'DELETION_PENDING',
};
const PREPARE_NOTICE: Readonly<Partial<Record<PublicTopicPrepareOutcome, PublicComposeNotice>>> = {
  PUBLICATION_NOT_OPEN: 'NOT_OPEN', ACCOUNT_DELETION_PENDING: 'DELETION_PENDING', TITLE_TOO_SHORT: 'TITLE_TOO_SHORT', TEXT_REQUIRED: 'TEXT_REQUIRED',
  SECTION_REQUIRED: 'SECTION_REQUIRED',
};
const sameWords = (a: PublicTopicDraft, b: PublicTopicDraft) => a.title === b.title && a.text === b.text && a.section === b.section;

export function createPublicComposeController({ transport, isCurrent, newId, foreground, sources = null }: PublicComposeControllerOptions): PublicComposeController {
  const listeners = new Set<() => void>();
  let state: PublicComposeState = CLOSED;
  let retired = false;
  let ticket = 0;
  // One command per act and target until a definite answer: a retry after a lost answer is the SAME command.
  const commands = new Map<string, string>();
  const commandFor = (act: string) => {
    const existing = commands.get(act);
    if (existing) return existing;
    const fresh = newId();
    commands.set(act, fresh);
    return fresh;
  };
  const settle = (act: string) => { commands.delete(act); };
  const live = () => !retired && isCurrent();
  // The state always follows what happened (a save that lands after the workspace closed still counts); only a live
  // controller tells anyone.
  const publish = (next: Partial<PublicComposeState>) => {
    state = Object.freeze({ ...state, ...next });
    if (!live()) return;
    for (const listener of Array.from(listeners)) listener();
  };
  const call = <T>(work: () => Promise<PublicAuthoringAnswer<T>>): Promise<PublicAuthoringAnswer<T>> => work().catch(() => NO);

  // ---- saving: one save at a time, each against the revision the account last confirmed for that draft.
  const confirmed = new Map<string, number>();
  let inFlight: Promise<boolean> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancelTimer = () => {
    if (timer !== null) { clearTimeout(timer); timer = null; }
  };
  const shows = (draftId: string) => state.draft !== null && state.draft.draftId === draftId;

  async function loadList(notice: PublicComposeNotice = 'NONE'): Promise<void> {
    const mine = ++ticket;
    publish({ screen: 'LIST', status: 'LOADING', draft: null, preview: null, confirmingDelete: false, notice, saving: 'IDLE', source: null, items: null, itemsStatus: 'IDLE' });
    if (!transport) { publish({ status: 'UNAVAILABLE' }); return; }
    const drafts = await call(() => transport.drafts());
    if (mine !== ticket) return;
    publish(drafts.kind === 'ANSWER' ? { status: 'READY', drafts: drafts.value } : { status: 'UNAVAILABLE' });
  }

  async function loadDraft(draftId: string, notice: PublicComposeNotice = 'NONE'): Promise<void> {
    const mine = ++ticket;
    publish({ screen: 'EDIT', status: 'LOADING', preview: null, confirmingDelete: false, notice, saving: 'IDLE' });
    if (!transport) { publish({ status: 'UNAVAILABLE' }); return; }
    const read = await call(() => transport.draft(draftId));
    if (mine !== ticket) return;
    if (read.kind !== 'ANSWER') { publish({ status: 'UNAVAILABLE' }); return; }
    // Not the reader's, or gone: back to the list, which is the truth now.
    if (read.value.kind === 'ABSENT') { await loadList('ACTION_UNAVAILABLE'); return; }
    confirmed.set(draftId, read.value.draft.revision);
    const source = await readSource(draftId);
    if (mine !== ticket) return;
    publish({ status: 'READY', draft: { ...read.value.draft, dirty: false }, source, items: null, itemsStatus: 'IDLE' });
    // A prepared topic made from a source shows its sealed items.
    if (read.value.draft.state === 'PREPARED' && source !== null && source.source.kind !== 'NONE') await readItems(draftId, 1);
  }

  /** S8A-05 CP2: the draft's source; null without a source transport or a definite answer (shown as no source). */
  async function readSource(draftId: string): Promise<PublicComposeState['source']> {
    if (!sources) return null;
    const read = await call(() => sources.source(draftId));
    return read.kind === 'ANSWER' && read.value.kind === 'SOURCE'
      ? { revision: read.value.revision, source: read.value.source, acknowledged: read.value.acknowledged } : null;
  }

  // Pages already read for the draft revision shown: the previous page tells whether a page's first item begins a message.
  let pages = new Map<number, PublicTopicItemsPage>();
  let pagesOf = '';
  async function readItems(draftId: string, page: number): Promise<void> {
    if (!sources) return;
    const mine = ticket;
    publish({ itemsStatus: 'LOADING' });
    const read = await call(() => sources.items(draftId, page));
    if (mine !== ticket) return;
    if (read.kind !== 'ANSWER' || read.value.kind !== 'PAGE') { publish({ itemsStatus: 'UNAVAILABLE' }); return; }
    const shown = read.value.page;
    const key = `${draftId}:${shown.revision}`;
    if (pagesOf !== key) { pages = new Map(); pagesOf = key; }
    pages.set(page, shown);
    let before: PublicTopicItem | null = null;
    if (page > 1) {
      let previous = pages.get(page - 1);
      if (previous === undefined) {
        const earlier = await call(() => sources.items(draftId, page - 1));
        if (mine !== ticket) return;
        if (earlier.kind === 'ANSWER' && earlier.value.kind === 'PAGE' && earlier.value.page.revision === shown.revision) {
          previous = earlier.value.page;
          pages.set(page - 1, previous);
        }
      }
      // Unknown: the page's first item is not offered for emphasis, rather than guessed.
      before = previous === undefined ? shown.items[0] ?? null : previous.items[previous.items.length - 1] ?? null;
    }
    const starts = new Map(messageStartsOf(shown.items, before));
    if (page > 1 && pages.get(page - 1) === undefined && shown.items.length > 0) starts.delete(shown.items[0].position);
    publish({ items: { page: shown, messageStarts: starts }, itemsStatus: 'IDLE' });
  }

  async function act(work: () => Promise<void>): Promise<void> {
    if (state.busy || !transport) return;
    publish({ busy: true, notice: 'NONE' });
    try {
      await work();
    } finally {
      publish({ busy: false });
    }
  }

  /** One save of exactly these words. True when the account now holds exactly what is shown (or, if closed, what was sent). */
  async function saveOnce(draft: PublicComposeDraft): Promise<boolean> {
    if (!transport) return false;
    const expected = Math.max(confirmed.get(draft.draftId) ?? 0, draft.revision);
    if (shows(draft.draftId)) publish({ saving: 'SAVING' });
    const answer = await call(() => transport.save(draft.draftId, expected, draft.title, draft.text, draft.section));
    if (answer.kind !== 'ANSWER') {
      if (shows(draft.draftId)) publish({ saving: 'FAILED' });
      return false;
    }
    const { outcome, revision } = answer.value;
    if ((outcome === 'CREATED' || outcome === 'SAVED') && revision !== null) {
      confirmed.set(draft.draftId, revision);
      const now = state.draft;
      if (now === null || now.draftId !== draft.draftId) return true;
      // Only what was sent is saved: words typed meanwhile stay unsaved, and are saved at the next rest.
      const same = sameWords(now, draft);
      publish({ draft: { ...now, revision, dirty: !same }, saving: 'IDLE' });
      if (!same) schedule();
      return same;
    }
    if (!shows(draft.draftId)) return false;
    publish({ saving: 'IDLE' });
    if (outcome === 'STALE' || outcome === 'PREPARED') { await loadDraft(draft.draftId, 'STALE'); return false; }
    if (outcome === 'NOT_FOUND') { await loadList('ACTION_UNAVAILABLE'); return false; }
    publish({ notice: SAVE_NOTICE[outcome] ?? 'ACTION_UNAVAILABLE' });
    return false;
  }

  /** Saves the draft being edited (or `snapshot`, the words of a draft just closed), after any save already out. */
  async function persist(snapshot: PublicComposeDraft | null = state.draft): Promise<boolean> {
    cancelTimer();
    if (!transport || snapshot === null || snapshot.state !== 'EDITING') return false;
    if (!snapshot.dirty && snapshot.revision > 0) return true;
    while (inFlight !== null) await inFlight;
    // While it waited the reader may have typed more: the newest words of the SAME draft are what is saved.
    const draft = shows(snapshot.draftId) ? state.draft as PublicComposeDraft : snapshot;
    if (draft.state !== 'EDITING') return false;
    if (!draft.dirty && Math.max(confirmed.get(draft.draftId) ?? 0, draft.revision) > 0) return true;
    const mine = saveOnce(draft);
    inFlight = mine;
    try {
      return await mine;
    } finally {
      if (inFlight === mine) inFlight = null;
    }
  }

  /** The words shown and not yet saved, if any — what leaving must not lose. */
  const unsaved = (): PublicComposeDraft | null => {
    const draft = state.draft;
    return state.screen === 'EDIT' && draft !== null && draft.state === 'EDITING' && draft.dirty ? draft : null;
  };
  const flush = () => {
    const words = unsaved();
    if (words !== null) void persist(words);
  };

  function schedule(): void {
    cancelTimer();
    if (!transport) return;
    timer = setTimeout(() => {
      timer = null;
      if (unsaved() !== null) void persist();
    }, PUBLIC_COMPOSE_AUTOSAVE_MS);
  }

  async function readPreview(draftId: string): Promise<void> {
    const mine = ++ticket;
    publish({ screen: 'PREVIEW', status: 'LOADING', confirmingDelete: false });
    const read = await call(() => transport!.preview(draftId));
    if (mine !== ticket) return;
    if (read.kind !== 'ANSWER') { publish({ status: 'UNAVAILABLE' }); return; }
    if (read.value.kind === 'ABSENT') { await loadList('ACTION_UNAVAILABLE'); return; }
    const source = await readSource(draftId);
    if (mine !== ticket) return;
    publish({ status: 'READY', preview: read.value.preview, source, items: null, itemsStatus: 'IDLE' });
    if (source !== null && source.source.kind !== 'NONE') await readItems(draftId, 1);
  }

  /** The revision the account last confirmed for the draft shown (a source change moves it). */
  const revisionNow = (draft: PublicComposeDraft) => Math.max(confirmed.get(draft.draftId) ?? 0, draft.revision);
  const moved = (draft: PublicComposeDraft, revision: number) => {
    confirmed.set(draft.draftId, revision);
    if (shows(draft.draftId)) publish({ draft: { ...(state.draft as PublicComposeDraft), revision } });
  };

  const close = () => {
    // Words not yet saved are saved on the way out: closing never loses them.
    const words = unsaved();
    cancelTimer();
    ticket += 1;
    commands.clear();
    publish(CLOSED);
    if (words !== null) void persist(words);
  };

  const edit = (next: Partial<Pick<PublicTopicDraft, 'title' | 'text' | 'section'>>) => {
    const draft = state.draft;
    if (!draft || draft.state !== 'EDITING' || state.screen !== 'EDIT') return;
    publish({ draft: { ...draft, ...next, dirty: true }, notice: 'NONE', confirmingDelete: false });
    schedule();
  };

  const unsubscribeForeground = foreground?.subscribe((next) => { if (next !== 'ACTIVE') flush(); });

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open() { void loadList(); },
    close,
    back() {
      if (state.busy) return;
      if (state.screen === 'PREVIEW' && state.draft) { ticket += 1; publish({ screen: 'EDIT', status: 'READY', preview: null, notice: 'NONE', items: null, itemsStatus: 'IDLE' }); return; }
      if (state.screen === 'EDIT') {
        // Words the reader wrote are kept: leaving saves them first, and stays if they could not be saved.
        if (unsaved() !== null) {
          void act(async () => { if (await persist()) await loadList(); });
          return;
        }
        cancelTimer();
        void loadList();
        return;
      }
      close();
    },
    refresh() {
      if (state.screen === 'EDIT' && state.draft && state.draft.revision > 0) void loadDraft(state.draft.draftId);
      else if (state.screen === 'PREVIEW' && state.draft) void readPreview(state.draft.draftId);
      else void loadList();
    },
    newDraft() {
      if (state.busy) return;
      ticket += 1;
      publish({ screen: 'EDIT', status: 'READY', preview: null, confirmingDelete: false, notice: 'NONE', saving: 'IDLE', source: null, items: null, itemsStatus: 'IDLE',
        draft: { draftId: newId(), revision: 0, title: '', text: '', section: null, state: 'EDITING', experienceId: null, dirty: false } });
    },
    openDraft(draftId) { if (!state.busy) void loadDraft(draftId); },
    setTitle(title) { edit({ title: title.slice(0, PUBLIC_TOPIC_TITLE_MAX) }); },
    setText(text) { edit({ text: text.slice(0, PUBLIC_TOPIC_TEXT_MAX) }); },
    setSection(section) { edit({ section }); },
    save() { void act(async () => { await persist(); }); },
    showPreview() {
      void act(async () => {
        const draft = state.draft;
        if (!draft || !(await persist())) return;
        await readPreview(draft.draftId);
      });
    },
    prepare() {
      void act(async () => {
        const draft = state.draft;
        const preview = state.preview;
        if (!draft || !preview || state.screen !== 'PREVIEW') return;
        const key = `PREPARE:${draft.draftId}:${preview.revision}`;
        const answer = await call(() => transport!.prepare(draft.draftId, commandFor(key), preview.revision));
        if (answer.kind !== 'ANSWER') { publish({ notice: 'ACTION_UNAVAILABLE' }); return; }
        settle(key);
        const outcome = answer.value;
        if (outcome === 'PREPARED' || outcome === 'ALREADY_PREPARED') { await loadDraft(draft.draftId); return; }
        if (outcome === 'STALE') { await readPreview(draft.draftId); publish({ notice: 'STALE' }); return; }
        if (outcome === 'NOT_FOUND') { await loadList('ACTION_UNAVAILABLE'); return; }
        // S8A-05 CP2: a source's own refusal, or the acknowledgement it needs, is the preview's readiness: read it again.
        if (SOURCE_REFUSALS.includes(outcome)) { await readPreview(draft.draftId); return; }
        publish({ notice: PREPARE_NOTICE[outcome] ?? 'ACTION_UNAVAILABLE' });
      });
    },
    backToDraft() {
      void act(async () => {
        const draft = state.draft;
        if (!draft || draft.state !== 'PREPARED' || draft.experienceId === null) return;
        const key = `DISCARD:${draft.experienceId}`;
        const answer = await call(() => transport!.discard(draft.experienceId as string, commandFor(key)));
        if (answer.kind !== 'ANSWER') { publish({ notice: 'ACTION_UNAVAILABLE' }); return; }
        settle(key);
        if (answer.value === 'DISCARDED' || answer.value === 'ALREADY_DISCARDED') { await loadDraft(draft.draftId); return; }
        publish({ notice: 'ACTION_UNAVAILABLE' });
      });
    },
    askDelete() { if (state.draft && !state.busy) publish({ confirmingDelete: true, notice: 'NONE' }); },
    confirmDelete() {
      void act(async () => {
        const draft = state.draft;
        if (!draft || !state.confirmingDelete) return;
        cancelTimer();
        // Never let a save land after the delete: wait for one already out.
        while (inFlight !== null) await inFlight;
        const revision = Math.max(confirmed.get(draft.draftId) ?? 0, draft.revision);
        // A draft the account never held has nothing to erase.
        if (revision === 0) { await loadList('DELETED'); return; }
        const key = `DELETE:${draft.draftId}`;
        const answer = await call(() => transport!.remove(draft.draftId, commandFor(key)));
        if (answer.kind !== 'ANSWER') { publish({ notice: 'ACTION_UNAVAILABLE' }); return; }
        settle(key);
        if (answer.value === 'DELETED' || answer.value === 'NOT_FOUND') { confirmed.delete(draft.draftId); await loadList('DELETED'); return; }
        publish({ confirmingDelete: false, notice: answer.value === 'ACCOUNT_DELETION_PENDING' ? 'DELETION_PENDING' : 'ACTION_UNAVAILABLE' });
      });
    },
    async createFromSource(choice) {
      if (!sources) return { kind: 'FAILED' };
      const draftId = newId();
      const answer = choice.kind === 'CONVERSATION'
        ? await call(() => sources.setConversationSource(draftId, 0, choice.choice))
        : await call(() => sources.setUnderstandingSource(choice.ref, choice.revision, draftId, 0));
      if (answer.kind !== 'ANSWER') return { kind: 'FAILED' };
      const { outcome, revision } = answer.value;
      if ((outcome === 'CREATED' || outcome === 'SAVED') && revision !== null) {
        confirmed.set(draftId, revision);
        return { kind: 'CREATED', draftId };
      }
      return { kind: 'REFUSED', outcome: outcome as Exclude<PublicTopicUnderstandingOutcome, 'CREATED' | 'SAVED'> };
    },
    showItemsPage(page) {
      const draft = state.draft;
      const items = state.items;
      if (!draft || items === null || state.busy || page < 1 || page > items.page.pageCount) return;
      void readItems(draft.draftId, page);
    },
    toggleEmphasis(itemPosition) {
      void act(async () => {
        const draft = state.draft;
        const held = state.source;
        const start = state.items?.messageStarts.get(itemPosition);
        if (!sources || !draft || draft.state !== 'EDITING' || held === null || held.source.kind !== 'CONVERSATION' || start === undefined) return;
        if (!(await persist())) return;
        const current = held.source;
        const emphasized = current.emphasizedMessagePositions.includes(start)
          ? current.emphasizedMessagePositions.filter((sp: number) => sp !== start) : [...current.emphasizedMessagePositions, start].sort((a, b) => a - b);
        const shownDraft = state.draft as PublicComposeDraft;
        const answer = await call(() => sources.setConversationSource(draft.draftId, revisionNow(shownDraft), {
          sessionId: current.sessionId, firstPosition: current.firstPosition, lastPosition: current.lastPosition,
          includeQandeelReplies: current.includeQandeelReplies, excludedMessagePositions: current.excludedMessagePositions, emphasizedMessagePositions: emphasized,
        }));
        if (answer.kind !== 'ANSWER') { publish({ notice: 'ACTION_UNAVAILABLE' }); return; }
        const { outcome, revision } = answer.value;
        if ((outcome === 'SAVED' || outcome === 'CREATED') && revision !== null) {
          moved(shownDraft, revision);
          const page = state.items?.page.page ?? 1;
          await readPreview(draft.draftId);
          if (page > 1) await readItems(draft.draftId, page);
          return;
        }
        if (outcome === 'STALE' || outcome === 'PREPARED') { await loadDraft(draft.draftId, 'STALE'); return; }
        await readPreview(draft.draftId);
      });
    },
    acknowledge() {
      void act(async () => {
        const draft = state.draft;
        const preview = state.preview;
        if (!sources || !draft || !preview || state.screen !== 'PREVIEW') return;
        const answer = await call(() => sources.acknowledgeSource(draft.draftId, preview.revision));
        if (answer.kind !== 'ANSWER') { publish({ notice: 'ACTION_UNAVAILABLE' }); return; }
        if (answer.value === 'ACKNOWLEDGED') { await readPreview(draft.draftId); publish({ notice: 'ACKNOWLEDGED' }); return; }
        if (answer.value === 'STALE') { await readPreview(draft.draftId); publish({ notice: 'STALE' }); return; }
        if (answer.value === 'NOT_FOUND') { await loadList('ACTION_UNAVAILABLE'); return; }
        publish({ notice: answer.value === 'ACCOUNT_DELETION_PENDING' ? 'DELETION_PENDING' : 'ACTION_UNAVAILABLE' });
      });
    },
    clearSource() {
      void act(async () => {
        const draft = state.draft;
        if (!sources || !draft || draft.state !== 'EDITING' || state.screen !== 'EDIT') return;
        if (!(await persist())) return;
        const shownDraft = state.draft as PublicComposeDraft;
        const answer = await call(() => sources.clearSource(draft.draftId, revisionNow(shownDraft)));
        if (answer.kind !== 'ANSWER') { publish({ notice: 'ACTION_UNAVAILABLE' }); return; }
        if (answer.value.outcome === 'SAVED') { await loadDraft(draft.draftId); return; }
        if (answer.value.outcome === 'STALE' || answer.value.outcome === 'PREPARED') { await loadDraft(draft.draftId, 'STALE'); return; }
        if (answer.value.outcome === 'NOT_FOUND') { await loadList('ACTION_UNAVAILABLE'); return; }
        publish({ notice: 'DELETION_PENDING' });
      });
    },
    retire() {
      // The Public area is going: unsaved words are saved on the way out, then nothing more is told to anyone.
      flush();
      retired = true;
      unsubscribeForeground?.();
      listeners.clear();
    },
  };
}
