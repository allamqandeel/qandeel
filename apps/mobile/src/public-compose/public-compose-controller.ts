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
 * A prepared, never-published topic can go back to its draft: the prepared copy is erased. Deleting a draft erases its
 * words. Unsaved words live in memory only: nothing is stored on the device. The Personal world and the Shared area are
 * never read; nothing is logged.
 */
import type {
  PublicAuthoringAnswer, PublicTopicDeleteOutcome, PublicTopicDiscardOutcome, PublicTopicDraft, PublicTopicDraftRead, PublicTopicDraftSummary,
  PublicTopicPrepareOutcome, PublicTopicPreview, PublicTopicPreviewRead, PublicTopicSaveResult, PublicTopicSection,
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
  | 'NONE' | 'SAVED' | 'STALE' | 'LIMIT_REACHED' | 'DELETION_PENDING' | 'INVALID' | 'NOT_OPEN' | 'TITLE_TOO_SHORT' | 'TEXT_REQUIRED'
  | 'SECTION_REQUIRED' | 'DELETED' | 'ACTION_UNAVAILABLE';

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
}

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
}

const CLOSED: PublicComposeState = Object.freeze<PublicComposeState>({
  screen: 'CLOSED', status: 'READY', drafts: [], draft: null, preview: null, confirmingDelete: false, busy: false, notice: 'NONE',
});
const NO: { readonly kind: 'NO_ANSWER' } = Object.freeze({ kind: 'NO_ANSWER' as const });
const SAVE_NOTICE: Readonly<Partial<Record<PublicTopicSaveResult['outcome'], PublicComposeNotice>>> = {
  LIMIT_REACHED: 'LIMIT_REACHED', INVALID: 'INVALID', ACCOUNT_DELETION_PENDING: 'DELETION_PENDING',
};
const PREPARE_NOTICE: Readonly<Partial<Record<PublicTopicPrepareOutcome, PublicComposeNotice>>> = {
  PUBLICATION_NOT_OPEN: 'NOT_OPEN', ACCOUNT_DELETION_PENDING: 'DELETION_PENDING', TITLE_TOO_SHORT: 'TITLE_TOO_SHORT', TEXT_REQUIRED: 'TEXT_REQUIRED',
  SECTION_REQUIRED: 'SECTION_REQUIRED',
};

export function createPublicComposeController({ transport, isCurrent, newId }: PublicComposeControllerOptions): PublicComposeController {
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
  const publish = (next: Partial<PublicComposeState>) => {
    if (!live()) return;
    state = Object.freeze({ ...state, ...next });
    for (const listener of Array.from(listeners)) listener();
  };
  const call = <T>(work: () => Promise<PublicAuthoringAnswer<T>>): Promise<PublicAuthoringAnswer<T>> => work().catch(() => NO);

  async function loadList(notice: PublicComposeNotice = 'NONE'): Promise<void> {
    const mine = ++ticket;
    publish({ screen: 'LIST', status: 'LOADING', draft: null, preview: null, confirmingDelete: false, notice });
    if (!transport) { publish({ status: 'UNAVAILABLE' }); return; }
    const drafts = await call(() => transport.drafts());
    if (mine !== ticket) return;
    publish(drafts.kind === 'ANSWER' ? { status: 'READY', drafts: drafts.value } : { status: 'UNAVAILABLE' });
  }

  async function loadDraft(draftId: string, notice: PublicComposeNotice = 'NONE'): Promise<void> {
    const mine = ++ticket;
    publish({ screen: 'EDIT', status: 'LOADING', preview: null, confirmingDelete: false, notice });
    if (!transport) { publish({ status: 'UNAVAILABLE' }); return; }
    const read = await call(() => transport.draft(draftId));
    if (mine !== ticket) return;
    if (read.kind !== 'ANSWER') { publish({ status: 'UNAVAILABLE' }); return; }
    // Not the reader's, or gone: back to the list, which is the truth now.
    if (read.value.kind === 'ABSENT') { await loadList('ACTION_UNAVAILABLE'); return; }
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

  /** Saves the draft being edited; true when the account now holds exactly what is shown. */
  async function persist(announce: boolean): Promise<boolean> {
    const draft = state.draft;
    if (!transport || !draft || draft.state !== 'EDITING') return false;
    if (!draft.dirty && draft.revision > 0) return true;
    const answer = await call(() => transport.save(draft.draftId, draft.revision, draft.title, draft.text, draft.section));
    if (answer.kind !== 'ANSWER') { publish({ notice: 'ACTION_UNAVAILABLE' }); return false; }
    const { outcome, revision } = answer.value;
    if ((outcome === 'CREATED' || outcome === 'SAVED') && revision !== null) {
      // Only what was sent is saved: words typed meanwhile stay unsaved.
      const now = state.draft;
      const same = now !== null && now.draftId === draft.draftId && now.title === draft.title && now.text === draft.text && now.section === draft.section;
      publish({ draft: { ...(now ?? draft), revision, dirty: !same }, notice: announce ? 'SAVED' : state.notice });
      return same;
    }
    if (outcome === 'STALE' || outcome === 'PREPARED') { await loadDraft(draft.draftId, 'STALE'); return false; }
    if (outcome === 'NOT_FOUND') { await loadList('ACTION_UNAVAILABLE'); return false; }
    publish({ notice: SAVE_NOTICE[outcome] ?? 'ACTION_UNAVAILABLE' });
    return false;
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
    ticket += 1;
    commands.clear();
    publish(CLOSED);
  };

  const edit = (next: Partial<Pick<PublicTopicDraft, 'title' | 'text' | 'section'>>) => {
    const draft = state.draft;
    if (!draft || draft.state !== 'EDITING' || state.screen !== 'EDIT') return;
    publish({ draft: { ...draft, ...next, dirty: true }, notice: 'NONE', confirmingDelete: false });
  };

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
        const draft = state.draft;
        // Words the reader wrote are kept: leaving saves them first, and stays if they could not be saved.
        if (draft && draft.state === 'EDITING' && draft.dirty) {
          void act(async () => { if (await persist(false)) await loadList(); });
          return;
        }
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
      publish({ screen: 'EDIT', status: 'READY', preview: null, confirmingDelete: false, notice: 'NONE',
        draft: { draftId: newId(), revision: 0, title: '', text: '', section: null, state: 'EDITING', experienceId: null, dirty: false } });
    },
    openDraft(draftId) { if (!state.busy) void loadDraft(draftId); },
    setTitle(title) { edit({ title: title.slice(0, PUBLIC_TOPIC_TITLE_MAX) }); },
    setText(text) { edit({ text: text.slice(0, PUBLIC_TOPIC_TEXT_MAX) }); },
    setSection(section) { edit({ section }); },
    save() { void act(async () => { await persist(true); }); },
    showPreview() {
      void act(async () => {
        const draft = state.draft;
        if (!draft || !(await persist(false))) return;
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
        // A draft the account never held has nothing to erase.
        if (draft.revision === 0) { await loadList('DELETED'); return; }
        const key = `DELETE:${draft.draftId}`;
        const answer = await call(() => transport!.remove(draft.draftId, commandFor(key)));
        if (answer.kind !== 'ANSWER') { publish({ notice: 'ACTION_UNAVAILABLE' }); return; }
        settle(key);
        if (answer.value === 'DELETED' || answer.value === 'NOT_FOUND') { await loadList('DELETED'); return; }
        publish({ confirmingDelete: false, notice: answer.value === 'ACCOUNT_DELETION_PENDING' ? 'DELETION_PENDING' : 'ACTION_UNAVAILABLE' });
      });
    },
    retire() {
      retired = true;
      listeners.clear();
    },
  };
}
