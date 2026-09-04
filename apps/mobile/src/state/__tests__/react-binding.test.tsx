import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { CanonicalStateProvider, useCanonicalSelector, useCanonicalStore } from '../CanonicalStateProvider';
import { opaqueRef, sessionPosition } from '../classes';
import { effectiveTC, temporalOrientation } from '../selectors';
import { createCanonicalStore, type CanonicalStateInit } from '../store';

const SP = sessionPosition;

function init(): CanonicalStateInit {
  return {
    session: { id: 'session-1' },
    live: { LH: SP(5), LF: { value: { kind: 'NONE' }, atSp: null } },
    temporal: { kind: 'FOLLOW_LIVE' },
    inspection: null,
    camera: { anchor: opaqueRef('WORLD_ANCHOR', 'a0'), scale: opaqueRef('SCALE_INTENT', 's0'), depth: 'WORLD' },
  };
}

const renderSpy = jest.fn();

function EffectiveTc() {
  renderSpy();
  const tc = useCanonicalSelector(effectiveTC);
  const orientation = useCanonicalSelector(temporalOrientation);
  return <Text testID="tc">{`${orientation.mode}:${tc === null ? 'absent' : tc}`}</Text>;
}

function Bare() {
  useCanonicalStore();
  return null;
}

describe('React binding (subscriber only)', () => {
  beforeEach(() => {
    renderSpy.mockClear();
  });

  it('re-renders from the kernel through useSyncExternalStore and never writes through React', async () => {
    const store = createCanonicalStore(init());
    await render(
      <CanonicalStateProvider store={store}>
        <EffectiveTc />
      </CanonicalStateProvider>,
    );
    expect(screen.getByTestId('tc').props.children).toBe('FOLLOW_LIVE:5');

    await act(async () => {
      store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: SP(7) });
    });
    expect(screen.getByTestId('tc').props.children).toBe('FOLLOW_LIVE:7');

    await act(async () => {
      store.dispatch({ type: 'COMMIT_MOMENT', moment: SP(2) });
    });
    expect(screen.getByTestId('tc').props.children).toBe('PINNED:2');

    const rendersBefore = renderSpy.mock.calls.length;
    await act(async () => {
      expect(store.dispatch({ type: 'COMMIT_MOMENT', moment: SP(2) }).outcome).toBe('NO_OP');
    });
    expect(renderSpy.mock.calls.length).toBe(rendersBefore);
    expect(store.getState().history).toHaveLength(1);
  });

  it('fails loudly without a provider', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    let caught: unknown = null;
    try {
      await render(<Bare />);
    } catch (error) {
      caught = error;
    }
    consoleError.mockRestore();
    expect(String(caught)).toMatch(/CanonicalStateProvider/);
  });
});
