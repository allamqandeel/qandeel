/**
 * S6-06 (CP2) — what a human shares in the ONE Introduction World open now, for one runtime generation: the World's
 * shares as the server lets this reader see them, the reader's own text shares and three-stage photo, the display-name
 * consent, and SUCCESS (drawn only when the server returns a real transition — nothing produces one before Stage 8A).
 *
 * It holds exactly what the server answered. No identity, credential or persistence of its own; the integration owner
 * builds one per runtime generation and retires it with the generation.
 *
 *   - Every act is the server's to decide: the bounded types and keys, the contact floor (D-10), the gate (CW2-08: in
 *     production every share answers NOT_AVAILABLE_NOW and nothing is written), the series rules (D-05). The device
 *     hides nothing as a protection: an act the server refuses is said, never pretended.
 *   - An act whose answer was lost (FAILED / OFFLINE) keeps its command id, so asking again is the SAME request and the
 *     server decides it once. A definitive answer forgets the id. One act at a time.
 *   - A photo's bytes are read from the picker's copy into memory ONCE; the copy is deleted right after the upload attempt
 *     (photo-source.ts). A lost upload keeps those bytes in memory, with its id, until the panel closes — never on disk.
 *   - A rendition is fetched only to be drawn, re-authorized by the server on that request; it is held as an in-memory
 *     `data:` URI for the open World only, dropped as soon as its share leaves the server's read, and everything is
 *     dropped — with expo-image's memory cache — when the World closes.
 *   - Nothing here reaches QANDEEL's reply, Living Analysis, Activity or Push.
 */
import type {
  ForegroundSignal, IntroductionDiscloseResult, IntroductionDisclosures, IntroductionDisclosuresRead, IntroductionGrantResult,
  IntroductionMediaRead, IntroductionPersonalKey, IntroductionRemoveResult, IntroductionRevokeResult, IntroductionStage, IntroductionSuccessRead,
  IntroductionSuccessResult, IntroductionTextType, IntroductionUploadResult, SharedDeleteResult,
} from '../runtime-entry';
import { mintIntroductionsCommandId } from './introductions-controller';
import type { PhotoSource } from './photo-source';

export interface IntroductionSharingTransport {
  disclosures(worldId: string): Promise<IntroductionDisclosuresRead>;
  shareText(worldId: string, commandId: string, textType: IntroductionTextType, fieldKey: IntroductionPersonalKey | null, text: string): Promise<IntroductionDiscloseResult>;
  uploadImage(worldId: string, commandId: string, bytes: Uint8Array, mimeType: string): Promise<IntroductionUploadResult>;
  shareStage(worldId: string, commandId: string, seriesId: string, stage: IntroductionStage): Promise<IntroductionDiscloseResult>;
  removeImage(worldId: string, commandId: string, seriesId: string): Promise<IntroductionRemoveResult>;
  media(worldId: string, handle: string): Promise<IntroductionMediaRead>;
  grantDisplayName(worldId: string, commandId: string, versionId: string): Promise<IntroductionGrantResult>;
  revokeDisplayName(worldId: string, commandId: string): Promise<IntroductionRevokeResult>;
}
export interface IntroductionSuccessTransport {
  success(worldId: string): Promise<IntroductionSuccessRead>;
  approve(worldId: string, commandId: string, versionId: string, expectedEventId: string | null): Promise<IntroductionSuccessResult>;
  withdraw(worldId: string, commandId: string, versionId: string, expectedEventId: string): Promise<IntroductionSuccessResult>;
}
/** The existing Shared owner deletion (R-5): a text share is the reader's own material in this World. */
export interface IntroductionShareDeletionTransport {
  deleteMaterial(worldId: string, materialId: string, commandId: string): Promise<SharedDeleteResult>;
}

/** One rendition as the device holds it: being fetched, refused now, not fetched (retry), or drawable from memory. */
export type IntroductionMediaState =
  | { readonly kind: 'LOADING' | 'UNAVAILABLE' | 'FAILED' }
  | { readonly kind: 'DRAWABLE'; readonly dataUri: string };

export type IntroductionSharingAct = 'TEXT' | 'UPLOAD' | 'STAGE' | 'REMOVE' | 'DELETE' | 'GRANT' | 'REVOKE';

/** SUCCESS as this reader may know it: their own approval only, never the other person's decision. */
export interface IntroductionSuccessView {
  /** UNKNOWN — not read (yet); NONE — no transition (production, always, before Stage 8A); TRANSITION; COMPLETED. */
  readonly status: 'UNKNOWN' | 'NONE' | 'TRANSITION' | 'COMPLETED';
  readonly versionId: string | null;
  readonly myState: 'NONE' | 'APPROVED' | 'WITHDRAWN';
  readonly expectedEventId: string | null;
  readonly busy: boolean;
  /** CHANGED — PD-47; FAILED — the neutral failure with a retry (same id). */
  readonly notice: 'CHANGED' | 'FAILED' | null;
}

export interface IntroductionSharingView {
  readonly worldId: string;
  /** LOADING — no authorized read yet; READY; UNAVAILABLE — not this reader's; FAILED / OFFLINE — no usable answer. */
  readonly status: 'LOADING' | 'READY' | 'UNAVAILABLE' | 'FAILED' | 'OFFLINE';
  readonly disclosures: IntroductionDisclosures | null;
  readonly busy: IntroductionSharingAct | null;
  /** A photo upload whose answer was lost: its bytes are held in memory, retried with the same id. */
  readonly uploadRetry: boolean;
  readonly media: Readonly<Record<string, IntroductionMediaState>>;
  readonly success: IntroductionSuccessView;
}

export interface IntroductionSharingState {
  readonly open: IntroductionSharingView | null;
}

/** What one act came to, for the step that asked: the surface says it in the approved words. */
export type SharingOutcome =
  | 'DONE' | 'CONTACT_REFUSED' | 'NOT_AVAILABLE_NOW' | 'DELETED' | 'RETIRED' | 'NOT_SHARED' | 'IMAGE_REFUSED' | 'CANCELLED'
  | 'UNAVAILABLE' | 'FAILED' | 'OFFLINE';

export interface IntroductionSharingController {
  getState(): IntroductionSharingState;
  subscribe(listener: () => void): () => void;
  open(worldId: string): void;
  /** Read the open World's shares (and SUCCESS) again. */
  refresh(): void;
  close(): void;
  shareText(textType: IntroductionTextType, fieldKey: IntroductionPersonalKey | null, text: string): Promise<SharingOutcome>;
  /** Choose one photo with the system picker and upload it; the picker's copy is deleted whatever the answer. */
  choosePhoto(): Promise<SharingOutcome>;
  /** The upload whose answer was lost, again, with the SAME id and the bytes held in memory. */
  retryUpload(): Promise<SharingOutcome>;
  /** Before stage 1 only: the current photo is removed, then a new one is chosen (a new series, D-05). */
  changePhoto(seriesId: string): Promise<SharingOutcome>;
  shareStage(seriesId: string, stage: IntroductionStage): Promise<SharingOutcome>;
  removePhoto(seriesId: string): Promise<SharingOutcome>;
  deleteShare(materialId: string): Promise<SharingOutcome>;
  grantDisplay(versionId: string): Promise<SharingOutcome>;
  revokeDisplay(): Promise<SharingOutcome>;
  /** Fetch one rendition to draw it, unless it is already held or being fetched. */
  ensureMedia(handle: string): void;
  approveSuccess(): Promise<IntroductionSuccessResult['kind'] | null>;
  withdrawSuccess(): Promise<IntroductionSuccessResult['kind'] | null>;
  /** Sweep the picker's cache: on opening the photo flow, and once at start. */
  sweepPhotos(): void;
  retire(): void;
}

export interface IntroductionSharingControllerOptions {
  readonly transport: IntroductionSharingTransport;
  readonly success: IntroductionSuccessTransport;
  readonly deletion: IntroductionShareDeletionTransport;
  readonly photos: PhotoSource;
  readonly isCurrent: () => boolean;
  /** Drops the image engine's decoded memory (expo-image's `Image.clearMemoryCache`). */
  readonly clearImageMemory?: () => void;
  readonly foreground?: ForegroundSignal;
  readonly newCommandId?: () => string;
}

const NO_MEDIA: Readonly<Record<string, IntroductionMediaState>> = Object.freeze({});
const NO_SUCCESS: IntroductionSuccessView = Object.freeze({ status: 'UNKNOWN', versionId: null, myState: 'NONE', expectedEventId: null, busy: false, notice: null });
const fresh = (worldId: string): IntroductionSharingView => Object.freeze({
  worldId, status: 'LOADING', disclosures: null, busy: null, uploadRetry: false, media: NO_MEDIA, success: NO_SUCCESS,
});

/** Every rendition handle the reader may be shown in a read: shared stages and their own unshared ones. */
export const handlesOf = (view: IntroductionDisclosures): ReadonlySet<string> => new Set([
  ...view.items.flatMap((item) => (item.kind === 'IMAGE' ? [item.handle] : [])),
  ...(view.myPhoto?.unsharedStages.map((s) => s.handle) ?? []),
]);

export function createIntroductionSharingController({
  transport, success, deletion, photos, isCurrent, clearImageMemory, foreground, newCommandId = mintIntroductionsCommandId,
}: IntroductionSharingControllerOptions): IntroductionSharingController {
  let state: IntroductionSharingState = Object.freeze({ open: null });
  let retired = false;
  const listeners = new Set<() => void>();
  const live = () => !retired && isCurrent();
  const publish = (next: IntroductionSharingState) => {
    if (!live()) return;
    state = Object.freeze(next);
    for (const listener of listeners) listener();
  };
  /** One number per opening: an answer about an earlier opening (or another World) is never applied. */
  let opening = 0;
  let reads = 0;
  let successReads = 0;
  /** Acts whose answer was lost, by what they ask: asking the same again reuses the id. */
  const lost = new Map<string, string>();
  /** The one upload whose answer was lost, held in memory for this opening only. */
  let heldUpload: { readonly id: string; readonly bytes: Uint8Array; readonly mimeType: string } | null = null;

  const current = (token: number, worldId: string): IntroductionSharingView | null =>
    (token === opening && state.open !== null && state.open.worldId === worldId ? state.open : null);
  const patch = (token: number, worldId: string, next: Partial<IntroductionSharingView>) => {
    const open = current(token, worldId);
    if (open === null) return;
    publish({ open: Object.freeze({ ...open, ...next }) });
  };
  const patchSuccess = (token: number, worldId: string, next: Partial<IntroductionSuccessView>) => {
    const open = current(token, worldId);
    if (open === null) return;
    publish({ open: Object.freeze({ ...open, success: Object.freeze({ ...open.success, ...next }) }) });
  };

  const read = async (token: number, worldId: string): Promise<void> => {
    if (current(token, worldId) === null) return;
    const mine = ++reads;
    const answer = await transport.disclosures(worldId);
    const now = current(token, worldId);
    if (now === null || mine !== reads) return;
    if (answer.kind === 'READY') {
      // A rendition no longer in the server's read is dropped from memory at once (deleted, removed or unshared).
      const keep = handlesOf(answer.view);
      const media = Object.fromEntries(Object.entries(now.media).filter(([handle]) => keep.has(handle)));
      if (Object.keys(media).length !== Object.keys(now.media).length) clearImageMemory?.();
      patch(token, worldId, { status: 'READY', disclosures: answer.view, media: Object.freeze(media) });
      if (answer.view.introductionState === 'ACTIVE') void readSuccess(token, worldId);
      return;
    }
    if (answer.kind === 'UNAVAILABLE') {
      clearImageMemory?.();
      patch(token, worldId, { ...fresh(worldId), status: 'UNAVAILABLE' });
      return;
    }
    // A failed re-read keeps what was authorized moments ago; a first read that fails shows nothing.
    if (now.status !== 'READY') patch(token, worldId, { status: answer.kind });
  };

  const readSuccess = async (token: number, worldId: string): Promise<void> => {
    const mine = ++successReads;
    const answer = await success.success(worldId);
    if (current(token, worldId) === null || mine !== successReads) return;
    if (answer.kind === 'TRANSITION') {
      patchSuccess(token, worldId, { status: 'TRANSITION', versionId: answer.versionId, myState: answer.myState, expectedEventId: answer.expectedEventId });
    } else if (answer.kind === 'COMPLETED') {
      patchSuccess(token, worldId, { status: 'COMPLETED' });
    } else if (answer.kind !== 'FAILED' && answer.kind !== 'OFFLINE') {
      patchSuccess(token, worldId, { status: 'NONE', versionId: null, myState: 'NONE', expectedEventId: null });
    }
  };

  /**
   * One act: refused while another runs; its command id reused for the same request after a lost answer, forgotten after
   * any answer the server gave; the World re-read after it.
   */
  const act = async <K extends string>(kind: IntroductionSharingAct, key: string, run: (worldId: string, id: string) => Promise<{ readonly kind: K }>,
    settle: (answer: K) => SharingOutcome): Promise<SharingOutcome> => {
    const open = state.open;
    if (!live() || open === null || open.busy !== null) return 'FAILED';
    const token = opening;
    const { worldId } = open;
    const ledgerKey = `${worldId}|${kind}|${key}`;
    const id = lost.get(ledgerKey) ?? newCommandId();
    lost.set(ledgerKey, id);
    patch(token, worldId, { busy: kind });
    const answer = await run(worldId, id);
    const unknown = answer.kind === 'FAILED' || answer.kind === 'OFFLINE';
    if (!unknown && lost.get(ledgerKey) === id) lost.delete(ledgerKey);
    // INVALID and COMMAND_CONFLICT are refusals of the request itself: the same id would be refused again.
    if (answer.kind === 'INVALID' || answer.kind === 'COMMAND_CONFLICT') lost.delete(ledgerKey);
    patch(token, worldId, { busy: null });
    if (current(token, worldId) === null) return 'FAILED';
    if (!unknown) void read(token, worldId);
    return settle(answer.kind);
  };
  const common = (kind: string): SharingOutcome => {
    switch (kind) {
      case 'NOT_AVAILABLE_NOW': case 'DELETED': case 'RETIRED': case 'CONTACT_REFUSED': case 'NOT_SHARED': case 'UNAVAILABLE': case 'OFFLINE':
        return kind;
      default:
        return 'FAILED';
    }
  };

  const upload = async (token: number, worldId: string, held: { readonly id: string; readonly bytes: Uint8Array; readonly mimeType: string }): Promise<SharingOutcome> => {
    patch(token, worldId, { busy: 'UPLOAD', uploadRetry: false });
    const answer = await transport.uploadImage(worldId, held.id, held.bytes, held.mimeType);
    const unknown = answer.kind === 'FAILED' || answer.kind === 'OFFLINE';
    // Held in memory only while the answer is not known, for this opening only.
    heldUpload = unknown && token === opening ? held : null;
    patch(token, worldId, { busy: null, uploadRetry: unknown });
    if (current(token, worldId) === null) return 'FAILED';
    if (!unknown) void read(token, worldId);
    switch (answer.kind) {
      case 'READY': return 'DONE';
      // One active photo already: the read shows it.
      case 'PHOTO_ACTIVE': return 'DONE';
      case 'IMAGE_REFUSED': return 'IMAGE_REFUSED';
      default: return common(answer.kind);
    }
  };

  const choose = async (): Promise<SharingOutcome> => {
    const open = state.open;
    if (!live() || open === null || open.busy !== null) return 'FAILED';
    const token = opening;
    const { worldId } = open;
    heldUpload = null;
    patch(token, worldId, { busy: 'UPLOAD', uploadRetry: false });
    const choice = await photos.choose();
    if (choice.kind !== 'CHOSEN') {
      patch(token, worldId, { busy: null });
      return choice.kind === 'REFUSED' ? 'IMAGE_REFUSED' : choice.kind === 'CANCELLED' ? 'CANCELLED' : 'FAILED';
    }
    // The bytes are in memory now: the picker's copy goes before the upload's answer is even known.
    photos.discard(choice.uri);
    if (current(token, worldId) === null) return 'FAILED';
    return upload(token, worldId, { id: newCommandId(), bytes: choice.bytes, mimeType: choice.mimeType });
  };

  const forgetOpening = () => {
    opening += 1;
    reads += 1;
    successReads += 1;
    heldUpload = null;
  };

  const unsubscribeForeground = foreground?.subscribe((next) => {
    if (next !== 'ACTIVE' || state.open === null) return;
    void read(opening, state.open.worldId);
  });

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open(worldId) {
      forgetOpening();
      publish({ open: fresh(worldId) });
      void read(opening, worldId);
    },
    refresh() {
      if (state.open !== null) void read(opening, state.open.worldId);
    },
    close() {
      forgetOpening();
      const held = state.open !== null && Object.keys(state.open.media).length > 0;
      publish({ open: null });
      if (held) clearImageMemory?.();
    },
    shareText(textType, fieldKey, text) {
      return act('TEXT', `${textType}|${fieldKey ?? ''}|${text}`, (worldId, id) => transport.shareText(worldId, id, textType, fieldKey, text),
        (kind) => (kind === 'DISCLOSED' ? 'DONE' : common(kind)));
    },
    choosePhoto: choose,
    async retryUpload() {
      const open = state.open;
      if (!live() || open === null || open.busy !== null || heldUpload === null) return 'FAILED';
      return upload(opening, open.worldId, heldUpload);
    },
    async changePhoto(seriesId) {
      const removed = await act('REMOVE', seriesId, (worldId, id) => transport.removeImage(worldId, id, seriesId), (kind) => (kind === 'REMOVED' ? 'DONE' : common(kind)));
      return removed === 'DONE' ? choose() : removed;
    },
    shareStage(seriesId, stage) {
      return act('STAGE', `${seriesId}|${stage}`, (worldId, id) => transport.shareStage(worldId, id, seriesId, stage),
        (kind) => (kind === 'DISCLOSED' ? 'DONE' : common(kind)));
    },
    removePhoto(seriesId) {
      return act('REMOVE', seriesId, (worldId, id) => transport.removeImage(worldId, id, seriesId), (kind) => (kind === 'REMOVED' ? 'DONE' : common(kind)));
    },
    deleteShare(materialId) {
      // The Shared deletion answers DELETED, or UNAVAILABLE when the answer is not known (retried with the same id).
      return act('DELETE', materialId, async (worldId, id) => {
        const answer = await deletion.deleteMaterial(worldId, materialId, id);
        return { kind: answer.kind === 'DELETED' ? 'DELETED' as const : answer.kind === 'UNAVAILABLE' ? 'FAILED' as const : 'REFUSED' as const };
      }, (kind) => (kind === 'DELETED' ? 'DONE' : 'FAILED'));
    },
    grantDisplay(versionId) {
      return act('GRANT', versionId, (worldId, id) => transport.grantDisplayName(worldId, id, versionId), (kind) => (kind === 'GRANTED' ? 'DONE' : common(kind)));
    },
    revokeDisplay() {
      return act('REVOKE', 'revoke', (worldId, id) => transport.revokeDisplayName(worldId, id), (kind) => (kind === 'REVOKED' ? 'DONE' : common(kind)));
    },
    ensureMedia(handle) {
      const open = state.open;
      if (!live() || open === null || open.status !== 'READY' || open.disclosures === null) return;
      const held = open.media[handle];
      if (held !== undefined && held.kind !== 'FAILED') return;
      if (!handlesOf(open.disclosures).has(handle)) return;
      const token = opening;
      const { worldId } = open;
      patch(token, worldId, { media: Object.freeze({ ...open.media, [handle]: Object.freeze({ kind: 'LOADING' as const }) }) });
      void transport.media(worldId, handle).then((answer) => {
        const now = current(token, worldId);
        // The share may have gone while its bytes were on their way: then they are not kept.
        if (now === null || now.disclosures === null || !handlesOf(now.disclosures).has(handle)) return;
        const next: IntroductionMediaState = answer.kind === 'DRAWABLE' ? Object.freeze({ kind: 'DRAWABLE', dataUri: answer.dataUri })
          : Object.freeze({ kind: answer.kind === 'UNAVAILABLE' ? 'UNAVAILABLE' as const : 'FAILED' as const });
        patch(token, worldId, { media: Object.freeze({ ...now.media, [handle]: next }) });
        // A refusal means the share is gone for this reader: the read says what remains.
        if (answer.kind === 'UNAVAILABLE') void read(token, worldId);
      });
    },
    async approveSuccess() {
      const open = state.open;
      if (!live() || open === null || open.success.status !== 'TRANSITION' || open.success.busy || open.success.versionId === null) return null;
      const token = opening;
      const { worldId } = open;
      const { versionId, expectedEventId } = open.success;
      const ledgerKey = `${worldId}|APPROVE|${versionId}`;
      const id = lost.get(ledgerKey) ?? newCommandId();
      lost.set(ledgerKey, id);
      patchSuccess(token, worldId, { busy: true, notice: null });
      const answer = await success.approve(worldId, id, versionId, expectedEventId);
      if (answer.kind !== 'FAILED' && answer.kind !== 'OFFLINE') lost.delete(ledgerKey);
      if (current(token, worldId) === null) return null;
      patchSuccess(token, worldId, {
        busy: false,
        notice: answer.kind === 'CHANGED' ? 'CHANGED' : answer.kind === 'APPROVED' || answer.kind === 'COMPLETED' ? null : 'FAILED',
        ...(answer.kind === 'APPROVED' ? { myState: 'APPROVED' as const, expectedEventId: answer.eventId } : {}),
        ...(answer.kind === 'COMPLETED' ? { status: 'COMPLETED' as const } : {}),
      });
      if (answer.kind === 'CHANGED' || answer.kind === 'UNAVAILABLE' || answer.kind === 'NOT_AVAILABLE_NOW') void readSuccess(token, worldId);
      return answer.kind;
    },
    async withdrawSuccess() {
      const open = state.open;
      if (!live() || open === null || open.success.status !== 'TRANSITION' || open.success.busy || open.success.versionId === null
          || open.success.myState !== 'APPROVED' || open.success.expectedEventId === null) return null;
      const token = opening;
      const { worldId } = open;
      const { versionId, expectedEventId } = open.success;
      const ledgerKey = `${worldId}|WITHDRAW|${versionId}|${expectedEventId}`;
      const id = lost.get(ledgerKey) ?? newCommandId();
      lost.set(ledgerKey, id);
      patchSuccess(token, worldId, { busy: true, notice: null });
      const answer = await success.withdraw(worldId, id, versionId, expectedEventId);
      if (answer.kind !== 'FAILED' && answer.kind !== 'OFFLINE') lost.delete(ledgerKey);
      if (current(token, worldId) === null) return null;
      patchSuccess(token, worldId, {
        busy: false,
        notice: answer.kind === 'CHANGED' ? 'CHANGED' : answer.kind === 'WITHDRAWN' ? null : 'FAILED',
        ...(answer.kind === 'WITHDRAWN' ? { myState: 'WITHDRAWN' as const, expectedEventId: answer.eventId } : {}),
      });
      if (answer.kind === 'CHANGED' || answer.kind === 'UNAVAILABLE') void readSuccess(token, worldId);
      return answer.kind;
    },
    sweepPhotos() {
      void photos.sweep();
    },
    retire() {
      retired = true;
      heldUpload = null;
      unsubscribeForeground?.();
      listeners.clear();
      clearImageMemory?.();
    },
  };
}

/** The photo state of the reader's own series, derived from one read: what is shared, what is next, what is locked. */
export interface MyPhotoProgress {
  readonly seriesId: string;
  /** PENDING — still being prepared on the server; READY — no stage shared; PROGRESS — some shared; DONE — all three. */
  readonly phase: 'PENDING' | 'READY' | 'PROGRESS' | 'DONE';
  readonly shared: readonly { readonly stage: IntroductionStage; readonly handle: string; readonly materialId: string }[];
  readonly next: { readonly stage: IntroductionStage; readonly handle: string } | null;
  /** The latest stage drawn for this photo: the newest shared one, or the strong preview before stage 1. */
  readonly face: { readonly stage: IntroductionStage; readonly handle: string } | null;
}

export function myPhotoOf(view: IntroductionDisclosures): MyPhotoProgress | null {
  const sharedItems = view.items.flatMap((item) => (item.kind === 'IMAGE' && item.mine && item.seriesId !== null ? [item] : []));
  const seriesId = view.myPhoto?.seriesId ?? sharedItems[sharedItems.length - 1]?.seriesId ?? null;
  if (seriesId === null) return null;
  const shared = sharedItems.filter((item) => item.seriesId === seriesId).map((item) => ({ stage: item.stage, handle: item.handle, materialId: item.materialId }))
    .sort((a, b) => a.stage - b.stage);
  const unshared = view.myPhoto?.seriesId === seriesId ? view.myPhoto.unsharedStages : [];
  // The next stage is the one right after the newest shared (strictly in order); none is skipped (AR-11, D-05).
  const after = shared.length === 0 ? 0 : shared[shared.length - 1].stage;
  const nextStage = unshared.find((s) => s.stage === after + 1) ?? null;
  const pending = view.myPhoto?.seriesId === seriesId && view.myPhoto.state === 'PENDING';
  const newest = shared[shared.length - 1];
  return {
    seriesId,
    phase: pending ? 'PENDING' : shared.length === 0 ? 'READY' : nextStage === null ? 'DONE' : 'PROGRESS',
    shared,
    next: pending ? null : nextStage,
    face: newest !== undefined ? { stage: newest.stage, handle: newest.handle } : unshared[0] !== undefined && !pending ? unshared[0] : null,
  };
}

/** The other person's photo as this reader may see it: only the newest stage they shared (never anything clearer). */
export function theirPhotoOf(view: IntroductionDisclosures): { readonly stage: IntroductionStage; readonly handle: string } | null {
  const theirs = view.items.flatMap((item) => (item.kind === 'IMAGE' && !item.mine ? [item] : []));
  if (theirs.length === 0) return null;
  const newest = theirs.reduce((a, b) => (b.stage > a.stage ? b : a));
  return { stage: newest.stage, handle: newest.handle };
}
