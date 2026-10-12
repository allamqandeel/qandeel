/**
 * IP-IMP-01 — the reader's «تفضيلات التعامل» / Interaction Preferences, for ONE runtime generation.
 *
 * Read when the page is shown; changed one field at a time, directly (no Save button). A choice is PENDING until the
 * server answers, and the page keeps showing the last CONFIRMED value meanwhile: an uncommitted choice is never shown as
 * saved. The SERVER's answer is what the page shows afterwards. A change the server refused as stale shows the newer
 * value it holds and says the change was not saved; a change that failed keeps the confirmed value and says so. One act
 * at a time across the page. The optional review of previous preferences is read only when the reader opens it; an
 * empty list is a legitimate answer; skipping is the reader's own and changes nothing anywhere.
 */
import type {
  InteractionPreferenceChange, InteractionPreferenceField, InteractionPreferencesRead, InteractionPreferencesRecord,
  LegacyPreferenceCandidate, LegacyPreferenceReview,
} from '../runtime-entry';

export interface InteractionPreferencesTransport {
  read(): Promise<InteractionPreferencesRead>;
  set(field: InteractionPreferenceField, value: string, expectedVersion: number): Promise<InteractionPreferenceChange>;
  legacyReview(): Promise<LegacyPreferenceReview>;
  applyLegacy(memoryId: string, expectedVersion: number): Promise<InteractionPreferenceChange>;
}

/** What the last act came to, said once: saved, reset to Automatic, or not saved. */
export type InteractionPreferenceNotice = 'SAVED' | 'RESET' | 'NOT_SAVED';

export interface InteractionPreferencesReviewState {
  readonly status: 'CLOSED' | 'LOADING' | 'READY' | 'UNAVAILABLE';
  readonly candidates: readonly LegacyPreferenceCandidate[];
}

export interface InteractionPreferencesState {
  readonly status: 'LOADING' | 'READY' | 'UNAVAILABLE';
  /** The last CONFIRMED record. */
  readonly record: InteractionPreferencesRecord | null;
  /** The choice the server has not answered yet (never shown as saved). */
  readonly pending: { readonly field: InteractionPreferenceField; readonly value: string } | { readonly memoryId: string } | null;
  readonly notice: InteractionPreferenceNotice | null;
  readonly review: InteractionPreferencesReviewState;
}

export interface InteractionPreferencesController {
  getState(): InteractionPreferencesState;
  subscribe(listener: () => void): () => void;
  /** Read (or read again after a failure). */
  start(): void;
  /** One field, one value; DEFAULT is the reset to Automatic. */
  choose(field: InteractionPreferenceField, value: string): Promise<boolean>;
  openReview(): void;
  closeReview(): void;
  adopt(memoryId: string): Promise<boolean>;
  skip(memoryId: string): void;
  retire(): void;
}

const CLOSED: InteractionPreferencesReviewState = Object.freeze({ status: 'CLOSED', candidates: Object.freeze([]) });
const LOADING: InteractionPreferencesState = Object.freeze({ status: 'LOADING', record: null, pending: null, notice: null, review: CLOSED });

export function createInteractionPreferencesController(options: {
  readonly transport: InteractionPreferencesTransport;
  readonly isCurrent: () => boolean;
}): InteractionPreferencesController {
  const listeners = new Set<() => void>();
  let state: InteractionPreferencesState = LOADING;
  let retired = false;
  let busy = false;
  let reading = 0;
  const live = () => !retired && options.isCurrent();
  const publish = (next: InteractionPreferencesState) => {
    state = next;
    for (const listener of Array.from(listeners)) listener();
  };
  /** Candidates the confirmed record already holds are not offered again. */
  const stillOffered = (record: InteractionPreferencesRecord, candidates: readonly LegacyPreferenceCandidate[]) =>
    candidates.filter((c) => record.preferences[keyOf(c.field)] !== c.value);

  async function act(pending: NonNullable<InteractionPreferencesState['pending']>, send: (version: number) => Promise<InteractionPreferenceChange>, reset: boolean, adopted?: string): Promise<boolean> {
    const record = state.record;
    if (!live() || busy || state.status !== 'READY' || record === null) return false;
    busy = true;
    publish({ ...state, pending, notice: null });
    const outcome = await send(record.version);
    busy = false;
    if (!live()) return false;
    if (outcome.kind === 'FAILED') {
      publish({ ...state, pending: null, notice: 'NOT_SAVED' });
      return false;
    }
    const saved = outcome.kind === 'SAVED' || outcome.kind === 'UNCHANGED';
    const candidates = state.review.candidates.filter((c) => !(adopted !== undefined && c.memoryId === adopted && (saved || outcome.kind === 'NOT_ELIGIBLE')));
    publish({
      status: 'READY', record: outcome.record, pending: null,
      notice: saved ? (reset ? 'RESET' : 'SAVED') : 'NOT_SAVED',
      review: { ...state.review, candidates: stillOffered(outcome.record, candidates) },
    });
    return saved;
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (!live() || busy) return;
      const ticket = ++reading;
      if (state.status !== 'READY') publish(LOADING);
      void options.transport.read().then((outcome) => {
        if (!live() || ticket !== reading || busy) return;
        publish(outcome.kind === 'READ'
          ? { ...state, status: 'READY', record: outcome.record, notice: null }
          : (state.status === 'READY' ? state : { ...LOADING, status: 'UNAVAILABLE' }));
      });
    },
    choose(field, value) {
      return act({ field, value }, (version) => options.transport.set(field, value, version), value === 'DEFAULT');
    },
    openReview() {
      if (!live() || state.status !== 'READY') return;
      publish({ ...state, notice: null, review: { status: 'LOADING', candidates: [] } });
      void options.transport.legacyReview().then((outcome) => {
        if (!live() || state.review.status !== 'LOADING') return;
        publish(outcome.kind === 'READ'
          ? { ...state, record: busy ? state.record : outcome.record, review: { status: 'READY', candidates: stillOffered(busy || state.record === null ? outcome.record : state.record, outcome.candidates) } }
          : { ...state, review: { status: 'UNAVAILABLE', candidates: [] } });
      });
    },
    closeReview() {
      if (!live() || busy) return;
      publish({ ...state, review: CLOSED });
    },
    adopt(memoryId) {
      if (!state.review.candidates.some((c) => c.memoryId === memoryId)) return Promise.resolve(false);
      return act({ memoryId }, (version) => options.transport.applyLegacy(memoryId, version), false, memoryId);
    },
    skip(memoryId) {
      if (!live() || busy) return;
      publish({ ...state, notice: null, review: { ...state.review, candidates: state.review.candidates.filter((c) => c.memoryId !== memoryId) } });
    },
    retire() {
      retired = true;
      listeners.clear();
    },
  };
}

function keyOf(field: InteractionPreferenceField): 'replyLength' | 'replyLanguage' | 'humour' | 'explanationStyle' {
  return field === 'REPLY_LENGTH' ? 'replyLength' : field === 'REPLY_LANGUAGE' ? 'replyLanguage' : field === 'HUMOUR' ? 'humour' : 'explanationStyle';
}
