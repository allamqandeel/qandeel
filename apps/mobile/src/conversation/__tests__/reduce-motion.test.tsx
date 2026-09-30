/**
 * W3-MEGA-S (E2E-D-12) — Reduce Motion is honoured when the platform setting CHANGES mid-session, not only as it was at
 * launch (F1R2 platform mapping §3, item 4). The launch value is Reanimated's; a change is the platform's own event,
 * and it holds for surfaces mounted after it.
 */
import { act, render } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';

import { useReduceMotion } from '..';
import { resetReduceMotionForTests } from '../visual/reduce-motion';

const testGlobal = globalThis as Record<string, unknown>;

function Probe() {
  return <Text testID="probe">{useReduceMotion() ? 'reduced' : 'full'}</Text>;
}

let emit: (enabled: boolean) => void = () => undefined;
let listening = 0;

beforeEach(() => {
  resetReduceMotionForTests();
  emit = () => undefined;
  listening = 0;
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((event: string, handler: (enabled: boolean) => void) => {
    if (event === 'reduceMotionChanged') {
      emit = handler;
      listening += 1;
    }
    return { remove: jest.fn() };
  }) as never);
});

afterEach(() => {
  testGlobal.__QANDEEL_TEST_REDUCED_MOTION__ = undefined;
  resetReduceMotionForTests();
  jest.restoreAllMocks();
});

it('starts from the launch value and follows the platform’s reduceMotionChanged event', async () => {
  const view = await render(<Probe />);
  expect(view.getByTestId('probe').props.children).toBe('full');
  await act(async () => emit(true));
  expect(view.getByTestId('probe').props.children).toBe('reduced');
  await act(async () => emit(false));
  expect(view.getByTestId('probe').props.children).toBe('full');
  await view.unmount();
});

it('a surface mounted AFTER the change starts from the change, not from the launch value', async () => {
  const first = await render(<Probe />);
  await act(async () => emit(true));
  await first.unmount();
  const later = await render(<Probe />);
  expect(later.getByTestId('probe').props.children).toBe('reduced');
  await later.unmount();
});

it('one platform listener serves every surface', async () => {
  const a = await render(<Probe />);
  const b = await render(<Probe />);
  expect(listening).toBe(1);
  await act(async () => emit(true));
  expect(a.getByTestId('probe').props.children).toBe('reduced');
  expect(b.getByTestId('probe').props.children).toBe('reduced');
  await a.unmount();
  await b.unmount();
});

it('a reader who launched with Reduce Motion on keeps it until the platform says otherwise', async () => {
  testGlobal.__QANDEEL_TEST_REDUCED_MOTION__ = true;
  const view = await render(<Probe />);
  expect(view.getByTestId('probe').props.children).toBe('reduced');
  await view.unmount();
});
