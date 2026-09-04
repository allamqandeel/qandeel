/**
 * T-02 — Canonical state kernel: the store boundary.
 *
 * Two entry points with separate authority paths:
 * - `dispatch(action)`: explicit Product acts (kernel only). Runs the transition, the exact
 *   canonical-shape validator, the immutable-context guard, the per-field writer guard,
 *   `Φ_eff` no-op detection and the RH append. Never accepts an event, a Class C / D identity
 *   or a later-owner identity.
 * - `ingest(event)`: passive authoritative events (closed catalog). Runs the event transition,
 *   the exact shape validator and the guard restricted to the event's single authoritative
 *   field. Never appends RH and never borrows transaction authority.
 *
 * Trust boundary (FIX-T02-02): every candidate, and the initial snapshot, must match the exact
 * canonical shape (allowlisted keys at every level); `session.id` is immutable store context
 * that no transition or event may change. The store is constructed only from an explicit
 * authoritative snapshot. It performs no persistence, no restart behaviour and no entry-state
 * behaviour. No UI or control exposes the kernel actions in T-02.
 */
import { catalogEntry, isRhActionId, type AuthoritativeEvent, type KernelAction } from './actions';
import {
  ImmutableContextViolation,
  InvalidCanonicalShape,
  InvalidInitialState,
  OwnedByLaterTask,
  UnauthorizedActionClass,
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
  KERNEL_ACTION_TRANSITIONS,
  KERNEL_EVENT_TRANSITIONS,
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

/** Test seam: injected tables never widen authority; the shape validator and guard run on every result regardless. */
export interface StoreDependencies {
  readonly actionTransitions?: Partial<ActionTransitionTable>;
  readonly eventTransitions?: Partial<EventTransitionTable>;
}

export type DispatchResult = { readonly outcome: 'APPLIED'; readonly entry: RhEntry | null } | { readonly outcome: 'NO_OP' };
export type IngestResult = { readonly outcome: 'APPLIED' } | { readonly outcome: 'IDEMPOTENT' };

export interface CanonicalStore {
  getState(): CanonicalState;
  subscribe(listener: () => void): () => void;
  dispatch(action: KernelAction): DispatchResult;
  ingest(event: AuthoritativeEvent): IngestResult;
}

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
  const actionTransitions: ActionTransitionTable = { ...KERNEL_ACTION_TRANSITIONS, ...deps.actionTransitions };
  const eventTransitions: EventTransitionTable = { ...KERNEL_EVENT_TRANSITIONS, ...deps.eventTransitions };

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

  function dispatch(action: KernelAction): DispatchResult {
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

    const before = state;
    const transition = actionTransitions[action.type] as (s: CanonicalState, a: KernelAction) => unknown;
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
    ingest,
  };
}
