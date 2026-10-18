/**
 * S6-07 (CP3) — the reader's own governed enrollment and its three consents, for ONE runtime generation.
 *
 * It holds exactly what the server answered (migration 0165's view: availability, the current text and version of each
 * consent, the reader's own setup state and last act) and nothing it has not been told. No identity, credential or
 * persistence of its own: the integration owner builds one per runtime generation and retires it with the generation.
 *
 *   - ONE act is offered at a time, chosen from the view (`enrollmentOffer`): ENROLL, CORRECTION, RESUME or
 *     RECONFIRM_CONSENT — never while the gate is closed or an account deletion is pending. The server decides.
 *   - An act names exactly the consents it exercises, each by the version of the text the reader was shown; a text that
 *     changed in between is CONSENT_OUTDATED, and the new text is shown with nothing agreed (Q8(A)).
 *   - Each consent is withdrawn on its own, always (a closed gate or a pending deletion never blocks a withdrawal).
 *   - An act or a withdrawal whose answer was lost is retried with the SAME command id, so the server applies it once.
 *   - No optional field is ever required (D-CP1-1 = B): the offer depends on the reviewed draft only, never on a field.
 */
import type {
  EnrollmentActKind, EnrollmentActResult, EnrollmentConsentKind, EnrollmentOutcome, EnrollmentRead, EnrollmentRevocationOutcome,
  EnrollmentRevocationResult, EnrollmentView, IntroductionsDraft,
} from '../runtime-entry';
import type { EnrollmentCopyKey } from './enrollment-copy';
import { mintIntroductionsCommandId } from './introductions-controller';

export interface EnrollmentTransport {
  read(): Promise<EnrollmentRead>;
  act(commandId: string, kind: EnrollmentActKind, expectedDraftVersion: number | null,
    consents: { readonly [K in EnrollmentConsentKind]: string | null }): Promise<EnrollmentActResult>;
  revoke(commandId: string, consent: EnrollmentConsentKind): Promise<EnrollmentRevocationResult>;
}

/** The one act offered now, and the consents it asks the reader to agree to (in their fixed order). */
export interface EnrollmentOffer {
  readonly kind: EnrollmentActKind;
  readonly consents: readonly EnrollmentConsentKind[];
  /** The reviewed draft version the act confirms (ENROLL, CORRECTION), or null. */
  readonly draftVersion: number | null;
}

/** What the server answered to an act (`ACT`) or to a withdrawal (`WITHDRAWAL`), shown beside that request only. */
export interface EnrollmentNotice {
  readonly key: EnrollmentCopyKey; readonly tone: 'DONE' | 'INFO' | 'ERROR'; readonly origin: 'ACT' | 'WITHDRAWAL';
  /** A withdrawal's answer belongs to the one consent it was about, and is shown in that consent's row. */
  readonly consent?: EnrollmentConsentKind;
}

export interface EnrollmentState {
  readonly status: 'IDLE' | 'LOADING' | 'READY' | 'UNAVAILABLE';
  readonly view: EnrollmentView | null;
  readonly busy: boolean;
  /** Which kind of request is running (the act's EN-08 line, or a withdrawal). */
  readonly running: 'ACT' | EnrollmentConsentKind | null;
  readonly notice: EnrollmentNotice | null;
  /** A reviewed draft version the server answered NO_CHANGE for: its CORRECTION is not offered again. */
  readonly settledDraftVersion: number | null;
}

export interface EnrollmentController {
  getState(): EnrollmentState;
  subscribe(listener: () => void): () => void;
  /** Read afresh (the surface is shown, or something changed). */
  open(): void;
  /** The offered act, with the consents the reader agreed to; refused locally unless every consent it needs is agreed. */
  act(offer: EnrollmentOffer, agreed: ReadonlySet<EnrollmentConsentKind>): Promise<EnrollmentOutcome | 'FAILED' | null>;
  /** Withdraw ONE consent. */
  revoke(consent: EnrollmentConsentKind): Promise<EnrollmentRevocationOutcome | 'FAILED' | null>;
  dismissNotice(): void;
  retire(): void;
}

export interface EnrollmentControllerOptions {
  readonly transport: EnrollmentTransport;
  readonly isCurrent: () => boolean;
  readonly newCommandId?: () => string;
}

/** Whether a consent is in force now, from the reader's own setup. */
export function consentInForce(view: EnrollmentView, consent: EnrollmentConsentKind): boolean {
  if (consent === 'participation') return view.setup.participationState !== 'OFF';
  return consent === 'contextGrant' ? view.setup.contextGrant : view.setup.disclosureAuthority;
}

/** The consent controls exist once the reader has ever enrolled (an act), or while any consent is in force. */
export function hasConsentControls(view: EnrollmentView): boolean {
  return view.enrollment !== null || (['participation', 'contextGrant', 'disclosureAuthority'] as const).some((c) => consentInForce(view, c));
}

/**
 * The ONE act offered now, or null. Nothing is offered while the gate is closed or a deletion is pending; ENROLL and
 * CORRECTION need a reviewed draft (any reviewed draft: no field is required, D-CP1-1 = B).
 */
export function enrollmentOffer(view: EnrollmentView, draft: IntroductionsDraft | null, settledDraftVersion: number | null = null): EnrollmentOffer | null {
  if (!view.available || view.accountDeletionPending) return null;
  const reviewed = draft !== null && draft.review.state === 'REVIEWED' ? draft.version : null;
  const { setup } = view;
  if (setup.participationState === 'OFF') {
    return reviewed === null ? null : { kind: 'ENROLL', consents: ['participation', 'contextGrant', 'disclosureAuthority'], draftVersion: reviewed };
  }
  if (view.enrollment === null) return null;
  if (setup.participationState === 'PAUSED' && setup.pauseReason === 'USER_PAUSED') return { kind: 'RESUME', consents: ['participation'], draftVersion: null };
  const missing = (['contextGrant', 'disclosureAuthority'] as const).filter((c) => !consentInForce(view, c));
  if (missing.length > 0) return { kind: 'RECONFIRM_CONSENT', consents: missing, draftVersion: null };
  const enrolled = view.enrollment.enrolledDraftVersion;
  if (reviewed !== null && enrolled !== null && reviewed > enrolled && reviewed !== settledDraftVersion) {
    // An active authority bound to a profile the correction moves needs a fresh disclosure consent; the server decides
    // whether the basis moved, so the consent is asked whenever the authority is in force.
    return { kind: 'CORRECTION', consents: setup.disclosureAuthority ? ['disclosureAuthority'] : [], draftVersion: reviewed };
  }
  return null;
}

type Said = Omit<EnrollmentNotice, 'origin' | 'consent'>;
const ACT_NOTICE: Readonly<Record<EnrollmentOutcome, Said | null>> = Object.freeze({
  ENROLLED: { key: 'enrolled', tone: 'DONE' },
  CORRECTED: { key: 'corrected', tone: 'DONE' },
  RESUMED: { key: 'resumed', tone: 'DONE' },
  RECONFIRMED: { key: 'reconfirmed', tone: 'DONE' },
  NOT_AVAILABLE_NOW: { key: 'closed', tone: 'INFO' },
  DELETION_PENDING: { key: 'deletionPending', tone: 'INFO' },
  CHANGED: { key: 'changed', tone: 'INFO' },
  CONSENT_OUTDATED: { key: 'consentOutdated', tone: 'INFO' },
  INCOMPLETE: { key: 'incomplete', tone: 'INFO' },
  // The reader's state moved since it was shown: the refreshed view is drawn, with EN-12.
  ALREADY_ENROLLED: { key: 'changed', tone: 'INFO' },
  NOT_ENROLLED: { key: 'changed', tone: 'INFO' },
  NOT_RESUMABLE: { key: 'changed', tone: 'INFO' },
  // Nothing to update: the correction is simply no longer offered for this reviewed version.
  NO_CHANGE: null,
  COMMAND_CONFLICT: { key: 'failed', tone: 'ERROR' },
});
const REVOCATION_NOTICE: Readonly<Record<EnrollmentRevocationOutcome, Said>> = Object.freeze({
  REVOKED: { key: 'withdrawn', tone: 'DONE' },
  CHANGED: { key: 'withdrawChanged', tone: 'INFO' },
  NOT_ACTIVE: { key: 'nothingToWithdraw', tone: 'INFO' },
  COMMAND_CONFLICT: { key: 'failed', tone: 'ERROR' },
});
const FAILED: Said = Object.freeze({ key: 'failed', tone: 'ERROR' });
const from = (origin: EnrollmentNotice['origin'], said: Said | null, consent?: EnrollmentConsentKind): EnrollmentNotice | null =>
  (said === null ? null : Object.freeze({ ...said, origin, ...(consent === undefined ? {} : { consent }) }));
const INITIAL: EnrollmentState = Object.freeze({ status: 'IDLE', view: null, busy: false, running: null, notice: null, settledDraftVersion: null });

export function createEnrollmentController({ transport, isCurrent, newCommandId = mintIntroductionsCommandId }: EnrollmentControllerOptions): EnrollmentController {
  let state = INITIAL;
  let retired = false;
  let reads = 0;
  /** The last request whose answer was lost: retried with the same id when the reader repeats exactly that request. */
  let lost: { readonly key: string; readonly id: string } | null = null;
  const listeners = new Set<() => void>();
  const live = () => !retired && isCurrent();
  const set = (next: Partial<EnrollmentState>) => {
    if (!live()) return;
    state = Object.freeze({ ...state, ...next });
    for (const listener of listeners) listener();
  };
  const idFor = (key: string) => {
    const id = lost !== null && lost.key === key ? lost.id : newCommandId();
    lost = { key, id };
    return id;
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open() {
      const mine = ++reads;
      set({ status: state.view === null ? 'LOADING' : state.status });
      void transport.read().then((answer) => {
        if (mine !== reads) return;
        // A failed read shows nothing it cannot vouch for: no act, no consent state.
        if (answer.kind === 'READ') set({ status: 'READY', view: answer.view });
        else set({ status: 'UNAVAILABLE', view: null });
      });
    },
    async act(offer, agreed) {
      const view = state.view;
      if (!live() || state.busy || view === null) return null;
      // Exactly the consents the act exercises, each by the version of the text the reader was shown — and only when the
      // reader agreed to every one of them.
      const versions: Record<EnrollmentConsentKind, string | null> = { participation: null, contextGrant: null, disclosureAuthority: null };
      for (const consent of offer.consents) {
        const text = view.consents[consent];
        if (text === null || !agreed.has(consent)) return null;
        versions[consent] = text.version;
      }
      const id = idFor(`${offer.kind}|${offer.draftVersion ?? ''}|${versions.participation ?? ''}|${versions.contextGrant ?? ''}|${versions.disclosureAuthority ?? ''}`);
      ++reads;
      set({ busy: true, running: 'ACT', notice: null });
      const answer = await transport.act(id, offer.kind, offer.draftVersion, versions);
      if (!live()) return null;
      if (answer.kind === 'FAILED') {
        set({ busy: false, running: null, notice: from('ACT', FAILED) });
        return 'FAILED';
      }
      lost = null;
      set({
        busy: false, running: null, status: 'READY', view: answer.view, notice: from('ACT', ACT_NOTICE[answer.outcome]),
        settledDraftVersion: answer.outcome === 'NO_CHANGE' ? offer.draftVersion : state.settledDraftVersion,
      });
      return answer.outcome;
    },
    async revoke(consent) {
      if (!live() || state.busy || state.view === null) return null;
      const id = idFor(`REVOKE|${consent}`);
      ++reads;
      set({ busy: true, running: consent, notice: null });
      const answer = await transport.revoke(id, consent);
      if (!live()) return null;
      if (answer.kind === 'FAILED') {
        set({ busy: false, running: null, notice: from('WITHDRAWAL', FAILED, consent) });
        return 'FAILED';
      }
      lost = null;
      set({ busy: false, running: null, status: 'READY', view: answer.view, notice: from('WITHDRAWAL', REVOCATION_NOTICE[answer.outcome], consent) });
      return answer.outcome;
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
