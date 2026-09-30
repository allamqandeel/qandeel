/**
 * W3-MEGA-S (E2E-D-12) — Reduce Motion is honoured when the platform setting CHANGES mid-session, not only as it was at
 * launch (F1R2 platform mapping §3, item 4). The launch value is Reanimated's; a change is the platform's own event.
 */
import { act, render } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';

import { useReduceMotion } from '..';

declare global {
  // eslint-disable-next-line no-var
  var __QANDEEL_TEST_REDUCED_MOTION__: boolean | undefined;
}

function Probe() {
  return <Text testID="probe">{useReduceMotion() ? 'reduced' : 'full'}</Text>;
}

afterEach(() => {
  globalThis.__QANDEEL_TEST_REDUCED_MOTION__ = undefined;
  jest.restoreAllMocks();
});

it('starts from the launch value and follows the platform’s reduceMotionChanged event', async () => {
  let emit: (enabled: boolean) => void = () => undefined;
  const remove = jest.fn();
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((event: string, handler: (enabled: boolean) => void) => {
    if (event === 'reduceMotionChanged') emit = handler;
    return { remove };
  }) as never);
  const view = await render(<Probe />);
  expect(view.getByTestId('probe').props.children).toBe('full');
  await act(async () => emit(true));
  expect(view.getByTestId('probe').props.children).toBe('reduced');
  await act(async () => emit(false));
  expect(view.getByTestId('probe').props.children).toBe('full');
  await view.unmount();
  expect(remove).toHaveBeenCalled();
});

it('a reader who launched with Reduce Motion on keeps it until the platform says otherwise', async () => {
  globalThis.__QANDEEL_TEST_REDUCED_MOTION__ = true;
  const view = await render(<Probe />);
  expect(view.getByTestId('probe').props.children).toBe('reduced');
  await view.unmount();
});
