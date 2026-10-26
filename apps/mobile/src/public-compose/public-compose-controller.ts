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
 */
import type {
  ForegroundSignal, PublicAuthoringAnswer, PublicTopicDeleteOutcome, PublicTopicDiscardOutcome, PublicTopicDraft, PublicTopicDraftRead,
  PublicTopicDraftSummary, PublicTopicPrepareOutcome, PublicTopicPreview, PublicTopicPreviewRead, PublicTopicSaveResult, PublicTopicSection,
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

export type PublicComposeScreen = 'CLOSED' | 'LIST' | 'EDIT' | 'PREVIEW';
export type PublicComposeNotice =
  | 'NONE' | 'STALE' | 'LIMIT_REACHED' | 'DELETION_PENDING' | 'INVALID' | 'NOT_OPEN' | 'TITLE_TOO_SHORT' | 'TEXT_REQUIRED'
  | 'SECTION_REQUIRED' | 'DELETED' | 'ACTION_UNAVAILABLE';
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
}

export interface PublicComposeControllerOptions {
  readonly transport: PublicComposeTransport | null;
  readonly isCurrent: () => boolean;
  /** A fresh UUID: a new draft's id, and each command's id. */
  readonly newId: () => string;
  /** The runtime entry's ONE foreground signal (T-12P §2.7): leaving the foreground saves what is unsaved at once. */
  readonly foreground?: ForegroundSignal;
}

/** How long typing rests before the draft is saved to the account. */
export const PUBLIC_COMPOSE_AUTOSAVE_MS = 1200;

const CLOSED: PublicComposeState = Object.freeze<PublicComposeState>({
  screen: 'CLOSED', status: 'READY', drafts: [], draft: null, preview: null, confirmingDelete: false, busy: false, notice: 'NONE', saving: 'IDLE',
});
const NO: { readonly kind: 'NO_ANSWER' } = Object.freeze({ kind: 'NO_ANSWER' as const });
const SAVE_NOTICE: Readonly<Partial<Record<PublicTopicSaveResult['outcome'], PublicComposeNotice>>> = {
  LIMIT_REACHED: 'LIMIT_REACHED', INVALID: 'INVALID', ACCOUNT_DELETION_PENDING: 'DELETION_PENDING',
};
const PREPARE_NOTICE: Readonly<Partial<Record<PublicTopicPrepareOutcome, PublicComposeNotice>>> = {
  PUBLICATION_NOT_OPEN: 'NOT_OPEN', ACCOUNT_DELETION_PENDING: 'DELETION_PENDING', TITLE_TOO_SHORT: 'TITLE_TOO_SHORT', TEXT_REQUIRED: 'TEXT_REQUIRED',
  SECTION_REQUIRED: 'SECTION_REQUIRED',
};
const sameWords = (a: PublicTopicDraft, b: PublicTopicDraft) => a.title === b.title && a.text === b.text && a.section === b.section;

export function createPublicComposeController({ transport, isCurrent, newId, foreground }: PublicComposeControllerOptions): PublicComposeController {
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
    publish({ screen: 'LIST', status: 'LOADING', draft: null, preview: null, confirmingDelete: false, notice, saving: 'IDLE' });
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
    publish({ status: 'READY', draft: { ...read.value.draft, dirty: false } });
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
    publish({ status: 'READY', preview: read.value.preview });
  }

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
      if (state.screen === 'PREVIEW' && state.draft) { ticket += 1; publish({ screen: 'EDIT', status: 'READY', preview: null, notice: 'NONE' }); return; }
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
      publish({ screen: 'EDIT', status: 'READY', preview: null, confirmingDelete: false, notice: 'NONE', saving: 'IDLE',
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
    retire() {
      // The Public area is going: unsaved words are saved on the way out, then nothing more is told to anyone.
      flush();
      retired = true;
      unsubscribeForeground?.();
      listeners.clear();
    },
  };
}
