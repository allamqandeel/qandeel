/**
 * T-02 — Canonical state kernel: the store boundary.
 *
 * Four entry points with separate authority paths:
 * - `dispatch(action)`: the T-02 kernel Product acts, and ONLY those. Runs the transition, the
 *   exact canonical-shape validator, the immutable-context guard, the per-field writer guard,
 *   `Φ_eff` no-op detection and the RH append. Never accepts an event, a Class C / D identity, a
 *   later-owner identity, or any promoted act.
 * - `dispatchMap(action)`: the ONE seam a promoted Map act can reach canonical state through
 *   (R1-01). It runs exactly the same admission, guard, `Φ_eff` and RH path, and it runs it only
 *   after the store's own `MapActionAuthority` has consumed a runtime authorization for that
 *   exact action object. The store never inspects `V`, never learns an entitlement rule and
 *   never mints an authorization: it only asks whether its authority vouches for this act.
 * - `dispatchTemporal(action)`: the same seam for the two promoted temporal acts, with a SEPARATE
 *   `TemporalActionAuthority`. The two promoted families never share an authority, so an act
 *   minted by one owner is refused by the other's seam by construction, not by convention; and
 *   each seam admits only identities of its own family, so a promoted act cannot be smuggled
 *   sideways through the neighbouring door either.
 * - `ingest(event)`: passive authoritative events (closed catalog). Runs the event transition,
 *   the exact shape validator and the guard restricted to the event's single authoritative
 *   field. Never appends RH and never borrows transaction authority.
 *
 * Fail-closed by default: a store constructed WITHOUT an authority for a family executes no act of
 * that family at all, so forgetting to wire one cannot silently open the boundary.
 *
 * Trust boundary (FIX-T02-02): every candidate, and the initial snapshot, must match the exact
 * canonical shape (allowlisted keys at every level); `session.id` is immutable store context
 * that no transition or event may change. The store is constructed only from an explicit
 * authoritative snapshot. It performs no persistence, no restart behaviour and no entry-state
 * behaviour. No UI or control exposes the kernel actions in T-02.
 */
import {
  MAP_ACTION_TYPES,
  TEMPORAL_ACTION_TYPES,
  catalogEntry,
  isRhActionId,
  type AuthoritativeEvent,
  type CatalogEntry,
  type KernelAction,
  type MapAction,
  type StoreAction,
  type TemporalAction,
} from './actions';
import {
  ImmutableContextViolation,
  InvalidCanonicalShape,
  InvalidInitialState,
  OwnedByLaterTask,
  UnauthorizedActionClass,
  UnauthorizedMapAction,
  UnauthorizedTemporalAction,
  UnknownAction,
  UnknownEvent,
  assertAuthorizedClassAWrites,
} from './authority';
import {
  canonicalStateShapeIssue,
  deepFreeze,
  exactShapeIssue,
  isPlainRecord,
  type CameraIntent,
  type CanonicalState,
  type InspectionRef,
  type LiveTruth,
  type RhEntry,
  type TemporalMode,
} from './classes';
import { appendIfEffective } from './history';
import {
  KERNEL_EVENT_TRANSITIONS,
  STORE_ACTION_TRANSITIONS,
  type ActionTransitionTable,
  type EventTransitionTable,
} from './transitions';

export interface CanonicalStateInit {
  readonly session: { readonly id: string };
  readonly live: LiveTruth;
  readonly temporal: TemporalMode;
  readonly inspection: InspectionRef | null;
  readonly camera: CameraIntent;
  readonly history?: readonly RhEntry[];
}

/**
 * The runtime authority that vouches for a promoted Map act (R1-01).
 *
 * `consume` answers ONE question: did this authority itself authorize this exact action object,
 * and has that authorization not been used yet? It is a runtime property of the object's
 * identity, not a claim carried inside the action, so nothing a caller can construct — a
 * structurally perfect `InspectionRef`, a `true` flag, a copied token, a replayed action — can
 * satisfy it. The owning task holds the minting side privately; the store holds only this
 * verifier and can therefore neither mint an authorization nor learn an entitlement rule.
 */
export interface MapActionAuthority {
  /** True exactly once per authorization this authority minted for this action object. */
  consume(action: MapAction): boolean;
}

/**
 * The runtime authority that vouches for a promoted temporal act (T-06).
 *
 * Identical in kind to `MapActionAuthority` and deliberately a DIFFERENT object: the two promoted
 * families are authorized by different owners against different rules, so sharing one verifier
 * would let either owner's mint satisfy the other's seam. It answers ONE question — did this
 * authority itself authorize this exact action object, and is that authorization unused — and it
 * can never mint one, so nothing a caller can construct satisfies it.
 */
export interface TemporalActionAuthority {
  /** True exactly once per authorization this authority minted for this action object. */
  consume(action: TemporalAction): boolean;
}

/**
 * Store construction seam. The injected transition tables are a test seam and never widen
 * authority — the shape validator and the per-field guard run on every result regardless. The two
 * promoted-act authorities are production wiring inputs: a store built without one runs no act of
 * that family at all.
 */
export interface StoreDependencies {
  readonly actionTransitions?: Partial<ActionTransitionTable>;
  readonly eventTransitions?: Partial<EventTransitionTable>;
  readonly mapActionAuthority?: MapActionAuthority;
  readonly temporalActionAuthority?: TemporalActionAuthority;
}

export type DispatchResult = { readonly outcome: 'APPLIED'; readonly entry: RhEntry | null } | { readonly outcome: 'NO_OP' };
export type IngestResult = { readonly outcome: 'APPLIED' } | { readonly outcome: 'IDEMPOTENT' };

export interface CanonicalStore {
  getState(): CanonicalState;
  subscribe(listener: () => void): () => void;
  /** T-02 kernel Product acts only. Any promoted act dispatched here fails closed (R1-01). */
  dispatch(action: KernelAction): DispatchResult;
  /** The authorized Map seam. Fails closed unless this store's Map authority consumes the act. */
  dispatchMap(action: MapAction): DispatchResult;
  /** The authorized temporal seam. Fails closed unless this store's Temporal authority consumes the act. */
  dispatchTemporal(action: TemporalAction): DispatchResult;
  ingest(event: AuthoritativeEvent): IngestResult;
}

const isMapActionType = (id: string): boolean => (MAP_ACTION_TYPES as readonly string[]).includes(id);
const isTemporalActionType = (id: string): boolean => (TEMPORAL_ACTION_TYPES as readonly string[]).includes(id);

const INIT_KEYS = ['session', 'live', 'temporal', 'inspection', 'camera'] as const;

function buildInitialState(init: CanonicalStateInit): CanonicalState {
  const initIssue = exactShapeIssue(init, 'snapshot', INIT_KEYS, ['history']);
  if (initIssue) throw new InvalidInitialState(initIssue);
  if (init.history !== undefined && !Array.isArray(init.history)) {
    throw new InvalidInitialState('snapshot.history: must be an array of RH entries');
  }
  const state: CanonicalState = {
    session: init.session,
    live: init.live,
    temporal: init.temporal,
    inspection: init.inspection,
    camera: init.camera,
    history: [...(init.history ?? [])],
  };
  const issue = canonicalStateShapeIssue(state, isRhActionId);
  if (issue) throw new InvalidInitialState(issue);
  if (state.temporal.kind === 'PINNED') {
    if (state.live.LH === null) throw new InvalidInitialState('PINNED(t) requires a mirrored LH; LH = null is never a pinnable position');
    if (state.temporal.at > state.live.LH) throw new InvalidInitialState('PINNED(t) requires 1 <= t <= LH');
  }
  return state;
}

export function createCanonicalStore(init: CanonicalStateInit, deps: StoreDependencies = {}): CanonicalStore {
  const actionTransitions: ActionTransitionTable = { ...STORE_ACTION_TRANSITIONS, ...deps.actionTransitions };
  const eventTransitions: EventTransitionTable = { ...KERNEL_EVENT_TRANSITIONS, ...deps.eventTransitions };
  const mapActionAuthority = deps.mapActionAuthority;
  const temporalActionAuthority = deps.temporalActionAuthority;

  let state: CanonicalState = deepFreeze(buildInitialState(init));
  const listeners = new Set<() => void>();

  function publish(next: CanonicalState): void {
    state = deepFreeze(next);
    for (const listener of Array.from(listeners)) listener();
  }

  /** Exact-shape and immutable-context checks shared by both entry points. */
  function admit(before: CanonicalState, candidate: CanonicalState, actId: string): void {
    const issue = canonicalStateShapeIssue(candidate, isRhActionId);
    if (issue) throw new InvalidCanonicalShape(`${actId}: ${issue}`);
    if (candidate.session.id !== before.session.id) {
      throw new ImmutableContextViolation(`${actId} attempted to change session identity from ${before.session.id} to ${candidate.session.id}`);
    }
  }

  /**
   * The one transaction body. It is reached only after the caller-facing entry point has decided
   * that this identity may run at all, so admission, the per-field guard, `Φ_eff` and the RH
   * append are literally the same code for a kernel act and for an authorized Map act.
   */
  function runTransaction(action: StoreAction, entry: CatalogEntry): DispatchResult {
    const before = state;
    const transition = actionTransitions[action.type] as (s: CanonicalState, a: StoreAction) => unknown;
    const result = transition(before, action);
    if (!isPlainRecord(result)) throw new InvalidCanonicalShape(`${entry.id}: transition result must be a plain object`);
    // Every returned key is overlaid so the validator and the guard see any attempted write, including keys the
    // TypeScript return type excludes; nothing is silently dropped.
    const candidate = { ...before, ...result } as CanonicalState;
    admit(before, candidate, entry.id);
    const changed = assertAuthorizedClassAWrites(before, candidate, entry.authority, entry.id);
    if (changed.length === 0) return { outcome: 'NO_OP' };

    const appended = appendIfEffective(before, candidate, action.type);
    if (appended.entry === null) return { outcome: 'NO_OP' };
    publish({ ...candidate, session: before.session, history: appended.history });
    return { outcome: 'APPLIED', entry: appended.entry };
  }

  /** Shared identity admission. Returns the registry entry, or throws the exact typed refusal. */
  function admitIdentity(action: unknown): CatalogEntry {
    const id = isPlainRecord(action) ? action.type : undefined;
    const entry = catalogEntry(id);
    if (!entry) throw new UnknownAction(String(id));
    if (entry.cls === 'EVENT') {
      throw new UnauthorizedActionClass(entry.id, entry.cls, `${entry.id} is an authoritative event; it cannot be dispatched as a Product action`);
    }
    if (entry.level === 'NOT_STORE_ACTION') {
      throw new UnauthorizedActionClass(entry.id, entry.cls, `${entry.id} is a Class ${entry.cls} identity; it never reaches the canonical store`);
    }
    if (entry.level === 'METADATA_ONLY') throw new OwnedByLaterTask(entry.id, entry.owner);
    return entry;
  }

  function dispatch(action: KernelAction): DispatchResult {
    const entry = admitIdentity(action);
    // R1-01, extended by T-06: NO promoted act ever runs on this path, whatever it carries. The
    // raw public dispatch surface therefore cannot reach `IF_ref`, `TM`, the camera or RH for a
    // promoted act at all, and the refusal names the boundary that was crossed.
    if (entry.level === 'EXECUTABLE') {
      if (isTemporalActionType(entry.id)) {
        throw new UnauthorizedTemporalAction(entry.id, 'a temporal act reaches canonical state only through the authorized temporal seam');
      }
      throw new UnauthorizedMapAction(entry.id, 'a Map act reaches canonical state only through the authorized Map seam');
    }
    return runTransaction(action, entry);
  }

  function dispatchMap(action: MapAction): DispatchResult {
    const entry = admitIdentity(action);
    // Family admission, not merely level admission: a promoted TEMPORAL act is also EXECUTABLE, so
    // without this the neighbouring family would reach the Map authority and depend on a WeakSet
    // miss to be refused. Here it is refused by identity, before any authority is consulted.
    if (!isMapActionType(entry.id)) {
      throw new UnauthorizedActionClass(entry.id, entry.cls, `${entry.id} is not a promoted Map act; the Map seam runs only those`);
    }
    if (mapActionAuthority === undefined) {
      throw new UnauthorizedMapAction(entry.id, 'this store was constructed without a Map authority');
    }
    // The authority answers about THIS action object. A structurally identical copy, a replay of
    // an already-consumed act, or anything the authority did not mint is refused here — before
    // the transition runs, so a refusal writes nothing and appends nothing.
    if (mapActionAuthority.consume(action) !== true) {
      throw new UnauthorizedMapAction(entry.id, 'the authority did not mint an unused authorization for this exact act');
    }
    return runTransaction(action, entry);
  }

  function dispatchTemporal(action: TemporalAction): DispatchResult {
    const entry = admitIdentity(action);
    if (!isTemporalActionType(entry.id)) {
      throw new UnauthorizedActionClass(entry.id, entry.cls, `${entry.id} is not a promoted temporal act; the temporal seam runs only those`);
    }
    if (temporalActionAuthority === undefined) {
      throw new UnauthorizedTemporalAction(entry.id, 'this store was constructed without a Temporal authority');
    }
    // Identical rule, separate authority: an act the Map owner minted is not in this set, and a
    // replay of an already-consumed temporal act is not either. A refusal writes nothing.
    if (temporalActionAuthority.consume(action) !== true) {
      throw new UnauthorizedTemporalAction(entry.id, 'the authority did not mint an unused authorization for this exact act');
    }
    return runTransaction(action, entry);
  }

  function ingest(event: AuthoritativeEvent): IngestResult {
    const id = isPlainRecord(event) ? event.type : undefined;
    const entry = catalogEntry(id);
    if (!entry || entry.cls !== 'EVENT') {
      if (entry) {
        throw new UnauthorizedActionClass(entry.id, entry.cls, `${entry.id} is a Product identity; it cannot enter through the authoritative event path`);
      }
      throw new UnknownEvent(String(id));
    }

    const before = state;
    const transition = eventTransitions[event.type] as (s: CanonicalState, e: AuthoritativeEvent) => LiveTruth;
    const live = transition(before, event);
    if (live === before.live) return { outcome: 'IDEMPOTENT' };
    const candidate: CanonicalState = { ...before, live };
    admit(before, candidate, entry.id);
    const changed = assertAuthorizedClassAWrites(before, candidate, entry.authority, entry.id);
    if (changed.length === 0) return { outcome: 'IDEMPOTENT' };
    publish(candidate);
    return { outcome: 'APPLIED' };
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch,
    dispatchMap,
    dispatchTemporal,
    ingest,
  };
}
