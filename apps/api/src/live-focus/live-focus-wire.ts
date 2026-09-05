// T-03D - the ONE place effective Live Focus becomes the frozen wire shape.
//
// Reference identity only: `NONE`, `EMERGING(emergingFocusId)` or
// `THREAD(threadId)`, anchored at the Session Position at which it became
// effective. No label, name, Home, direction, relation count, confidence,
// importance, committed text or same-SP sequence can pass through here.

import type { LiveFocusTransitionWireEvent, LiveFocusWireValue } from '@qandeel/runtime';
import type { StoredLiveFocusTransition } from './conversation-semantic-runtime.types';
import type { EffectiveLiveFocus } from './live-focus.types';

export const LIVE_FOCUS_TRANSITION = 'LIVE_FOCUS_TRANSITION';
export const LIVE_FOCUS_TRANSITION_VERSION = 1;

export function toLiveFocusWireValue(value: EffectiveLiveFocus): LiveFocusWireValue {
  if (value.kind === 'EMERGING') return { kind: 'EMERGING', emergingFocusId: value.emergingFocusId };
  if (value.kind === 'THREAD') return { kind: 'THREAD', threadId: value.threadId };
  return { kind: 'NONE' };
}

export function toLiveFocusTransitionWireEvent(sessionId: string, transition: StoredLiveFocusTransition): LiveFocusTransitionWireEvent {
  return {
    type: LIVE_FOCUS_TRANSITION,
    version: LIVE_FOCUS_TRANSITION_VERSION,
    sessionId,
    atSp: transition.sessionPosition,
    value: toLiveFocusWireValue(transition.to),
  };
}
