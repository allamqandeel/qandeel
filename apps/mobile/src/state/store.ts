/**
 * T-02 — Canonical state kernel: the store boundary.
 *
 * Two entry points with separate authority paths:
 * - `dispatch(action)`: explicit Product acts (kernel only). Runs the transition, the per-field
 *   writer guard, `Φ_eff` no-op detection and the RH append. Never accepts an event, a Class
 *   C / D identity or a later-owner identity.
 * - `ingest(event)`: passive authoritative events (closed catalog). Runs the event transition
 *   and the guard restricted to the event's single authoritative field. Never appends RH and
 *   never borrows transaction authority.
 *
 * The store is constructed only from an explicit authoritative snapshot. It performs no
 * persistence, no restart behaviour and no entry-state behaviour. No UI or control exposes
 * the kernel actions in T-02.
 */
import { catalogEntry, type AuthoritativeEvent, type KernelAction } from './actions';
import {
  InvalidInitialState,
  OwnedByLaterTask,
  UnauthorizedActionClass,
  UnknownAction,
  UnknownEvent,
  assertAuthorizedClassAWrites,
} from './authority';
import {
  deepFreeze,
  isCameraIntent,
  isInspectionRef,
  isLiveFocus,
  isSessionPosition,
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

/** Test seam: injected tables never widen authority; the guard runs on every result regardless. */
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

function validateInit(init: CanonicalStateInit): void {
  if (!init || typeof init !== 'object') throw new InvalidInitialState('snapshot must be an object');
  if (typeof init.session?.id !== 'string' || init.session.id.length === 0) {
    throw new InvalidInitialState('session.id must be a non-empty string');
  }
  const live = init.live;
  if (!live || (live.LH !== null && !isSessionPosition(live.LH))) {
    throw new InvalidInitialState('live.LH must be null (technical absence sentinel) or a Session Position >= 1');
  }
  if (!live.LF || !isLiveFocus(live.LF.value) || (live.LF.atSp !== null && !isSessionPosition(live.LF.atSp))) {
    throw new InvalidInitialState('live.LF must be a three-valued Live Focus mirror anchored at null or a Session Position');
  }
  const temporal = init.temporal;
  if (!temporal || (temporal.kind !== 'FOLLOW_LIVE' && temporal.kind !== 'PINNED')) {
    throw new InvalidInitialState('temporal must be FOLLOW_LIVE or PINNED(t)');
  }
  if (temporal.kind === 'PINNED') {
    if (live.LH === null) throw new InvalidInitialState('PINNED(t) requires a mirrored LH; LH = null is never a pinnable position');
    if (!isSessionPosition(temporal.at) || temporal.at > live.LH) {
      throw new InvalidInitialState('PINNED(t) requires 1 <= t <= LH');
    }
  }
  if (init.inspection !== null && !isInspectionRef(init.inspection)) {
    throw new InvalidInitialState('inspection must be null or an exact InspectionRef');
  }
  if (!isCameraIntent(init.camera)) throw new InvalidInitialState('camera must be an abstract CameraIntent');
  if (init.history !== undefined && !Array.isArray(init.history)) {
    throw new InvalidInitialState('history must be an array of RH entries');
  }
}

const STATE_KEYS: readonly (keyof CanonicalState)[] = ['session', 'live', 'temporal', 'inspection', 'camera', 'history'];

/**
 * Overlays whatever a transition returned onto the state, restricted to real state keys, so
 * the guard sees any attempted write, including keys the TypeScript return type excludes.
 */
function overlay(state: CanonicalState, result: object): CanonicalState {
  const candidate: Record<string, unknown> = { ...state };
  for (const key of STATE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(result, key)) candidate[key] = (result as Record<string, unknown>)[key];
  }
  return candidate as unknown as CanonicalState;
}

export function createCanonicalStore(init: CanonicalStateInit, deps: StoreDependencies = {}): CanonicalStore {
  validateInit(init);
  const actionTransitions: ActionTransitionTable = { ...KERNEL_ACTION_TRANSITIONS, ...deps.actionTransitions };
  const eventTransitions: EventTransitionTable = { ...KERNEL_EVENT_TRANSITIONS, ...deps.eventTransitions };

  let state: CanonicalState = deepFreeze({
    session: { id: init.session.id },
    live: { LH: init.live.LH, LF: { value: init.live.LF.value, atSp: init.live.LF.atSp } },
    temporal: init.temporal,
    inspection: init.inspection,
    camera: init.camera,
    history: [...(init.history ?? [])],
  });
  const listeners = new Set<() => void>();

  function publish(next: CanonicalState): void {
    state = deepFreeze(next);
    for (const listener of Array.from(listeners)) listener();
  }

  function dispatch(action: KernelAction): DispatchResult {
    const id = action && typeof action === 'object' ? (action as { type?: unknown }).type : undefined;
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
    const transition = actionTransitions[entry.id as KernelAction['type']] as (s: CanonicalState, a: KernelAction) => object;
    const result = transition(before, action);
    const candidate = overlay(before, result);
    const changed = assertAuthorizedClassAWrites(before, candidate, entry.authority, entry.id);
    if (changed.length === 0) return { outcome: 'NO_OP' };

    const appended = appendIfEffective(before, candidate, entry.id);
    if (appended.entry === null) return { outcome: 'NO_OP' };
    publish({ ...candidate, history: appended.history });
    return { outcome: 'APPLIED', entry: appended.entry };
  }

  function ingest(event: AuthoritativeEvent): IngestResult {
    const id = event && typeof event === 'object' ? (event as { type?: unknown }).type : undefined;
    const entry = catalogEntry(id);
    if (!entry || entry.cls !== 'EVENT') {
      if (entry) {
        throw new UnauthorizedActionClass(entry.id, entry.cls, `${entry.id} is a Product identity; it cannot enter through the authoritative event path`);
      }
      throw new UnknownEvent(String(id));
    }

    const before = state;
    const transition = eventTransitions[entry.id as AuthoritativeEvent['type']] as (s: CanonicalState, e: AuthoritativeEvent) => LiveTruth;
    const live = transition(before, event);
    if (live === before.live) return { outcome: 'IDEMPOTENT' };
    const candidate: CanonicalState = { ...before, live };
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
