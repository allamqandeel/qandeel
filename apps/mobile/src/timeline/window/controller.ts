import { type DisclosedTrack, TIMELINE_STEP } from '../model/disclosedTrack';
import { clamp, finite, INITIAL_FRACTION, MIN_FRACTION, position } from '../position/scale';

export type PresentationAction =
  | { readonly type: 'PRESENTATION_WINDOW_MOVE'; readonly offset: number }
  | { readonly type: 'PRESENTATION_POSITION_MOVE'; readonly position: number }
  | { readonly type: 'PRESENTATION_POSITION_REFINE' }
  | { readonly type: 'PRESENTATION_POSITION_WIDEN' };
export interface PresentationSnapshot {
  readonly track: DisclosedTrack;
  readonly viewport: number;
  readonly offset: number;
  readonly maximum: number;
  readonly position: number;
  readonly fraction: number;
}

/** Ephemeral Class D controller. Deliberately has no canonical store, dispatch,
 * persistence, selection, Live intent or history-provider dependency. */
export function createPresentationController(track: DisclosedTrack, viewport = 0) {
  const listeners = new Set<() => void>();
  function snapshot(track: DisclosedTrack, viewport: number, offset: number, fraction: number): PresentationSnapshot {
    const width = Math.max(0, finite(viewport));
    const maximum = width > 0 ? Math.max(0, track.targets.length * TIMELINE_STEP - width) : 0;
    const bounded = clamp(offset, maximum);
    return Object.freeze({ track, viewport: width, offset: bounded, maximum, position: position(bounded, maximum), fraction });
  }
  let state = snapshot(track, viewport, 0, INITIAL_FRACTION);
  function publish(next: PresentationSnapshot) {
    if (Object.keys(next).every(key => next[key as keyof PresentationSnapshot] === state[key as keyof PresentationSnapshot])) return;
    state = next;
    listeners.forEach(listener => listener());
  }
  function move(action: PresentationAction) {
    let { offset, fraction } = state;
    switch (action.type) {
      case 'PRESENTATION_WINDOW_MOVE': offset = finite(action.offset); break;
      case 'PRESENTATION_POSITION_MOVE': offset = clamp(action.position) * state.maximum; break;
      case 'PRESENTATION_POSITION_REFINE': fraction = Math.max(MIN_FRACTION, fraction / 2); break;
      case 'PRESENTATION_POSITION_WIDEN': fraction = Math.min(1, fraction * 2); break;
      default: throw new TypeError('Unknown presentation action');
    }
    publish(snapshot(state.track, state.viewport, offset, fraction));
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    move,
    setViewport: (width: number) => publish(snapshot(state.track, width, state.offset, state.fraction)),
    // Same-session replacement preserves pixel/SP geometry, even at the previous end.
    // New session clears all local navigation granularity and position.
    replaceDisclosed: (next: DisclosedTrack) => publish(snapshot(next, state.viewport,
      next.sessionId === state.track.sessionId ? state.offset : 0,
      next.sessionId === state.track.sessionId ? state.fraction : INITIAL_FRACTION)),
    page: (direction: -1 | 1) => move({ type: 'PRESENTATION_WINDOW_MOVE', offset: state.offset + direction * state.viewport }),
    adjust: (direction: -1 | 1) => move({ type: 'PRESENTATION_POSITION_MOVE', position: state.position + direction * state.fraction }),
  };
}
export type PresentationController = ReturnType<typeof createPresentationController>;
