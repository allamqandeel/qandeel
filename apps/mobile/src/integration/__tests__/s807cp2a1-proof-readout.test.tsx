/**
 * S8B-07 CP2-A.1 — the iOS Replay gate's proof readout is where the gate can read it (validation only).
 *
 * CI on 385c1b36: the readout drawn BESIDE the player was hidden from Maestro (the player's root is
 * `accessibilityViewIsModal`), so every continuous case was NOT TESTED. It is drawn inside the player now, in the
 * timeline's held status line, absolutely placed: it takes no room and the Product's layout is the shipped one.
 */
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';

import { REPLAY_PLAYER_TEST_ID, REPLAY_TIMELINE_TEST_ID } from '../../replay-player';
import { CP2A1_PROOF_READOUT_TEST_ID, S807Cp2a1ProofRoot } from '../__validation__/S807Cp2a1ProofRoot';

type Node = ReturnType<RenderResult['getByTestId']>;

// The proof root's SafeAreaProvider waits for the window's metrics, which the test renderer never measures.
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  initialWindowMetrics: { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } },
}));
jest.setTimeout(60000);
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const ancestorsOf = (node: Node): Node[] => {
  const out: Node[] = [];
  for (let at = node.parent; at !== null; at = at.parent) out.push(at);
  return out;
};
const flat = (style: unknown): Record<string, unknown> =>
  Array.isArray(style) ? Object.assign({}, ...style.map(flat)) : ((style ?? {}) as Record<string, unknown>);

async function openContinuous(): Promise<RenderResult> {
  const view = await render(<S807Cp2a1ProofRoot />);
  await act(async () => { fireEvent.press(view.getByTestId('irg-choose-continuous')); });
  for (let i = 0; i < 100 && view.queryByTestId(CP2A1_PROOF_READOUT_TEST_ID, { includeHiddenElements: true }) === null; i += 1) {
    await act(async () => { await jest.advanceTimersByTimeAsync(100); });
  }
  return view;
}

it('the readout is inside the modal player, in the timeline\'s status line, and takes no room there', async () => {
  const view = await openContinuous();
  const readout = view.getByTestId(CP2A1_PROOF_READOUT_TEST_ID);
  const above = ancestorsOf(readout);
  // Inside the accessibility-modal player root: iOS shows it to the tree Maestro reads.
  expect(above.some((node) => node.props.testID === REPLAY_PLAYER_TEST_ID)).toBe(true);
  expect(above.some((node) => node.props.testID === `${REPLAY_TIMELINE_TEST_ID}-status`)).toBe(true);
  // Absolutely placed, touch-transparent: the status line keeps its held height, nothing moves.
  const holder = readout.parent!;
  expect(flat(holder.props.style).position).toBe('absolute');
  expect(holder.props.pointerEvents).toBe('none');
  expect(readout.props.accessibilityLabel).toMatch(/^ord=\S+ t=\S+ dur=\S+ play=[01] /u);
  view.unmount();
});
