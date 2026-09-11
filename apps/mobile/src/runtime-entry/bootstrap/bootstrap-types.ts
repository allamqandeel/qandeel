/**
 * T-12P §2.6 / §8 — the bootstrap vocabulary.
 *
 * The bootstrap is the first legitimate path into `CanonicalStore`. Its whole job is to make that
 * path deterministic: either every required authoritative fact is coherent and one store exists, or
 * no store exists at all. There is no partial runtime.
 */
import type { CameraIntent, CanonicalStore, InspectionRef, RhEntry, SessionPosition, TemporalMode } from '../../state';
import type { HistoricalDisclosureCache } from '../../projection';
import type { MobilePublicConfigFailure } from '../config/mobile-public-config';
import type { ConversationSessionOutcome } from '../conversation/conversation-session-api';

/**
 * T-13 — a validated durable viewpoint the store is constructed from INSTEAD of the fresh entry laws.
 *
 * Exactly the four client-owned Class-A facts. `LH` and `LF` have no key here and never could: they
 * come from the fresh authoritative snapshot the bootstrap fetches, so a recovered viewpoint is always
 * reconciled against current server truth before a store exists. The bootstrap still judges coherence
 * — a pinned position or a checkpoint beyond the fresh Live Head fails the whole attempt closed.
 */
export interface InitialViewpoint {
  readonly temporal: TemporalMode;
  readonly inspection: InspectionRef | null;
  readonly camera: CameraIntent;
  readonly history: readonly RhEntry[];
}

export type BootstrapPhase =
  | 'WAITING_FOR_AUTH'
  | 'ACQUIRING_CONVERSATION_SESSION'
  | 'FETCHING_INITIAL_SNAPSHOT'
  | 'FETCHING_INITIAL_DISCLOSURE'
  | 'READY'
  | 'FAILED';

/**
 * What happened to the one initial WORLD disclosure request.
 *
 * `NOT_APPLICABLE` is the empty/new-Session case: with no addressable Live Head there is no legal
 * `tc`, so no request is made and none is invented. The other three are the frozen T-03C states and
 * are deliberately kept apart — a transport failure is `NOT_FETCHED` (retryable, nothing is known),
 * never `UNAVAILABLE` (the server gave a typed refusal) and never an empty world.
 */
export type InitialDisclosureDisposition = 'NOT_APPLICABLE' | 'FETCHED' | 'UNAVAILABLE' | 'NOT_FETCHED';

/** The cursors the live driver starts from. `null` means "from the beginning of delivery". */
export interface LiveDeliveryCursors {
  readonly committedAfterSp: SessionPosition | null;
  readonly liveFocusAfterSp: SessionPosition | null;
}

/**
 * The ready runtime. This is the bundle T-12 composes; T-12P builds it and mounts nothing.
 *
 * `runtimeGeneration` is the identity of this whole bundle. Everything bound to it — the store, the
 * projection cache, the live driver — is retired together when it is replaced, and nothing from an
 * older generation may write into a newer one.
 */
export interface CanonicalRuntimeBundle {
  readonly runtimeGeneration: number;
  readonly authGeneration: number;
  readonly userId: string;
  /** The QANDEEL conversation Session. A different identity from the Supabase auth session. */
  readonly sessionId: string;
  readonly store: CanonicalStore;
  readonly projection: HistoricalDisclosureCache;
  readonly initialDisclosure: InitialDisclosureDisposition;
  readonly cursors: LiveDeliveryCursors;
}

export type BootstrapFailure =
  | { readonly kind: 'CONFIG'; readonly failure: MobilePublicConfigFailure }
  /** The reader is not authenticated. Not an error — the runtime simply cannot start yet. */
  | { readonly kind: 'NOT_AUTHENTICATED' }
  | { readonly kind: 'SESSION_ACQUISITION'; readonly outcome: Exclude<ConversationSessionOutcome, { kind: 'CREATED' }> }
  | { readonly kind: 'SNAPSHOT'; readonly detail: string }
  /** The authoritative facts were internally incoherent; no store was created. */
  | { readonly kind: 'INVALID_INITIAL_STATE'; readonly detail: string }
  /**
   * T-13 — a supplied durable viewpoint is impossible under the fresh authoritative snapshot (a pinned
   * position or a recorded checkpoint beyond the Live Head). Refused whole, never clamped or repaired;
   * no store was created.
   */
  | { readonly kind: 'VIEWPOINT_INCOHERENT'; readonly detail: string }
  /** A newer generation replaced this one mid-flight. Nothing was created. */
  | { readonly kind: 'RETIRED' };

export type BootstrapResult =
  | { readonly kind: 'READY'; readonly bundle: CanonicalRuntimeBundle }
  | { readonly kind: 'FAILED'; readonly failure: BootstrapFailure };
