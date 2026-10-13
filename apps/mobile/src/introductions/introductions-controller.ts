/**
 * S6-01 — «التعارف مع قنديل» / Introductions with QANDEEL, the owner's preparation, for ONE runtime generation.
 *
 * It holds exactly what the server answered — the availability hint, and the preparation view with its objective plan —
 * and nothing it has not been told. No identity, credential or persistence of its own: the integration owner builds one
 * per runtime generation and retires it with the generation, so nothing of one account reaches the next.
 *
 *   - Reads happen when asked (the entry when the Personal world is drawn; the surface when it is opened). Nothing polls.
 *   - Every change is bound to the draft version the owner was shown. A change the server refuses as stale changes
 *     nothing, and the latest version is shown with a notice — never silently re-applied.
 *   - A change whose answer was lost is retried with the SAME command id, so the server applies it once.
 *   - One change at a time.
 */
import type {
  IntroductionsAvailability,
  IntroductionsAvailabilityRead,
  IntroductionsChange,
  IntroductionsCommandKind,
  IntroductionsRead,
  IntroductionsView,
} from '../runtime-entry';

export type IntroductionsNotice = 'CHANGED_ELSEWHERE' | 'UNAVAILABLE' | 'DELETION_PENDING' | 'NOTE_LIMIT' | 'FAILED' | 'INVALID' | null;

export interface IntroductionsState {
  /** The entry's hint: UNKNOWN until read; the entry is drawn only when preparation is available or a draft exists. */
  readonly availability: IntroductionsAvailability | null;
  readonly status: 'IDLE' | 'LOADING' | 'READY' | 'UNAVAILABLE';
  readonly view: IntroductionsView | null;
  readonly busy: boolean;
  readonly notice: IntroductionsNotice;
}

export interface IntroductionsTransport {
  availability(): Promise<IntroductionsAvailabilityRead>;
  read(): Promise<IntroductionsRead>;
  command(commandId: string, expectedVersion: number, kind: IntroductionsCommandKind, payload: Record<string, unknown>): Promise<IntroductionsChange>;
  discard(commandId: string): Promise<IntroductionsChange>;
  grantAssistance(commandId: string, consentVersion: string): Promise<IntroductionsChange>;
  revokeAssistance(commandId: string): Promise<IntroductionsChange>;
}

export interface IntroductionsController {
  getState(): IntroductionsState;
  subscribe(listener: () => void): () => void;
  /** Whether the entry is drawn: one read of the hint. */
  refreshAvailability(): void;
  /** The surface is shown: read the preparation afresh. */
  open(): void;
  command(kind: IntroductionsCommandKind, payload: Record<string, unknown>): Promise<boolean>;
  grantAssistance(): Promise<boolean>;
  revokeAssistance(): Promise<boolean>;
  discard(): Promise<boolean>;
  dismissNotice(): void;
  retire(): void;
}

export interface IntroductionsControllerOptions {
  readonly transport: IntroductionsTransport;
  readonly isCurrent: () => boolean;
  readonly newCommandId?: () => string;
}

/** UUID-shaped and unique per change within this account; never a credential and carries no data. */
export function mintIntroductionsCommandId(): string {
  const hex = (count: number) => Array.from({ length: count }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const variant = (8 + Math.floor(Math.random() * 4)).toString(16);
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
}

const INITIAL: IntroductionsState = Object.freeze({ availability: null, status: 'IDLE', view: null, busy: false, notice: null });

const NOTICE: Readonly<Record<string, IntroductionsNotice>> = Object.freeze({
  STALE_VERSION: 'CHANGED_ELSEWHERE',
  COMMAND_ID_REUSED: 'CHANGED_ELSEWHERE',
  UNAVAILABLE: 'UNAVAILABLE',
  ACCOUNT_DELETION_PENDING: 'DELETION_PENDING',
  NOTE_LIMIT_REACHED: 'NOTE_LIMIT',
  CONSENT_VERSION_NOT_CURRENT: 'CHANGED_ELSEWHERE',
});

export function createIntroductionsController({ transport, isCurrent, newCommandId = mintIntroductionsCommandId }: IntroductionsControllerOptions): IntroductionsController {
  let state = INITIAL;
  let retired = false;
  const listeners = new Set<() => void>();
  const live = () => !retired && isCurrent();
  const set = (next: Partial<IntroductionsState>) => {
    if (!live()) return;
    state = Object.freeze({ ...state, ...next });
    for (const listener of listeners) listener();
  };
  let reads = 0;
  /** The last change whose answer was lost: retried with the same id when the owner repeats exactly that change. */
  let pending: { readonly key: string; readonly id: string } | null = null;

  const change = async (key: string, run: (commandId: string) => Promise<IntroductionsChange>): Promise<boolean> => {
    if (state.busy || !live()) return false;
    const id = pending !== null && pending.key === key ? pending.id : newCommandId();
    pending = { key, id };
    set({ busy: true, notice: null });
    const answer = await run(id);
    if (!live()) return false;
    if (answer.kind === 'FAILED') {
      set({ busy: false, notice: 'FAILED' });
      return false;
    }
    pending = null;
    if (answer.kind === 'INVALID') {
      set({ busy: false, notice: 'INVALID' });
      return false;
    }
    const notice = NOTICE[answer.outcome] ?? null;
    set({
      busy: false, view: answer.view, status: 'READY', notice,
      availability: { preparation: answer.view.availability.preparation, assistance: answer.view.availability.assistance, hasDraft: answer.view.draft !== null },
    });
    return notice === null;
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refreshAvailability() {
      void transport.availability().then((answer) => {
        if (answer.kind === 'READ') set({ availability: answer.availability });
      });
    },
    open() {
      const read = ++reads;
      set({ status: state.view === null ? 'LOADING' : state.status, notice: null });
      void transport.read().then((answer) => {
        if (read !== reads) return;
        if (answer.kind === 'READ') {
          set({
            status: 'READY', view: answer.view,
            availability: { preparation: answer.view.availability.preparation, assistance: answer.view.availability.assistance, hasDraft: answer.view.draft !== null },
          });
        } else {
          set({ status: 'UNAVAILABLE' });
        }
      });
    },
    command(kind, payload) {
      const version = state.view?.draft?.version ?? 0;
      return change(`${kind}|${version}|${JSON.stringify(payload)}`, (id) => transport.command(id, version, kind, payload));
    },
    grantAssistance() {
      const consentVersion = state.view?.assistance.currentVersion;
      if (!consentVersion) return Promise.resolve(false);
      return change(`GRANT|${consentVersion}`, (id) => transport.grantAssistance(id, consentVersion));
    },
    revokeAssistance() {
      return change('REVOKE', (id) => transport.revokeAssistance(id));
    },
    discard() {
      return change('DISCARD', (id) => transport.discard(id));
    },
    dismissNotice() {
      set({ notice: null });
    },
    retire() {
      retired = true;
      listeners.clear();
    },
  };
}
