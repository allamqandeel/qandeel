import { LIVE_FOCUS_TRANSITION, LIVE_FOCUS_TRANSITION_VERSION, toLiveFocusTransitionWireEvent, toLiveFocusWireValue } from './live-focus-wire';

const SESSION = '33333333-3333-4333-8333-333333333333';
const FOCUS = '4ef8538d-ddda-5e11-b7d9-052be85de59a';
const THREAD = 'afc4fd81-fe54-5738-9545-e1053044d919';

describe('the LF wire shape (cases 50-51)', () => {
  it('50. the three values cross as reference identity only', () => {
    expect(toLiveFocusWireValue({ kind: 'NONE' })).toEqual({ kind: 'NONE' });
    expect(toLiveFocusWireValue({ kind: 'EMERGING', emergingFocusId: FOCUS })).toEqual({ kind: 'EMERGING', emergingFocusId: FOCUS });
    expect(toLiveFocusWireValue({ kind: 'THREAD', threadId: THREAD })).toEqual({ kind: 'THREAD', threadId: THREAD });
  });

  it('51. a transition event is exactly type / version / sessionId / atSp / value: no sequence, label, Home, content or timestamp', () => {
    const event = toLiveFocusTransitionWireEvent(SESSION, { sessionPosition: 7, to: { kind: 'THREAD', threadId: THREAD } });
    expect(event).toEqual({ type: 'LIVE_FOCUS_TRANSITION', version: 1, sessionId: SESSION, atSp: 7, value: { kind: 'THREAD', threadId: THREAD } });
    expect([LIVE_FOCUS_TRANSITION, LIVE_FOCUS_TRANSITION_VERSION]).toEqual(['LIVE_FOCUS_TRANSITION', 1]);
    expect(Object.keys(event).sort()).toEqual(['atSp', 'sessionId', 'type', 'value', 'version']);
    const wire = JSON.stringify(event);
    for (const forbidden of ['same_sp', 'sequence', 'label', 'name', 'home', 'placement', 'committed_text', 'created_at', 'reason', 'from']) {
      expect(wire.includes(forbidden)).toBe(false);
    }
  });
});
