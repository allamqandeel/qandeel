import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { I18nManager, Text } from 'react-native';
import { fixture } from '../testing/fixtures';
import { createPresentationController } from '../window/controller';
import { OUTBOARD_LIVE_EXTENT, TimelinePresentation } from '../virtualization/TimelinePresentation';

// First render in this suite pays cold RN module init, which exceeds Jest's 5s
// default on a CI runner. This raises only the time budget; nothing is relaxed.
jest.setTimeout(60_000);

test('TL05-14 / Stage 6.2 sections 8–9: outboard Live seam consumes no ordinal distance', async () => {
  const c = createPresentationController(fixture(20), 240);
  await render(<TimelinePresentation controller={c} outboardLivePresentation={<Text>Live presentation supplied by owner</Text>} />);
  const outboard = screen.getByTestId('timeline-outboard-live');
  // T-12 §17 / QAN-BL-RSP-02: the slot's extent is now a FLOOR rather than a fixed width, and it no
  // longer clips. What this test is about is unchanged and is asserted below: the seam consumes no
  // ordinal distance, whatever the slot's own extent turns out to be.
  expect(outboard.props.style).toMatchObject({ minWidth: OUTBOARD_LIVE_EXTENT, flexShrink: 0 });
  expect(outboard.props.style.overflow).toBeUndefined();
  expect(outboard.props.style.width).toBeUndefined();
  expect(c.getSnapshot().maximum).toBe(20 * 48 - 240);
  expect(c.getSnapshot().track.targets.at(-1)?.sessionPosition).toBe(20);
  expect(screen.queryByTestId('timeline-sp-21')).toBeNull();
  expect(screen.getByTestId('timeline-discontinuity').props.accessibilityLabel).toBe('Disclosed Track continues');
  await act(async () => c.move({ type: 'PRESENTATION_POSITION_MOVE', position: 1 }));
  expect(screen.queryByTestId('timeline-discontinuity')).toBeNull();
  expect(screen.getByTestId('timeline-outboard-live').props.style).toMatchObject({ minWidth: OUTBOARD_LIVE_EXTENT });
  await act(async () => c.replaceDisclosed(fixture(100)));
  expect(screen.getByTestId('timeline-outboard-live').props.style).toMatchObject({ minWidth: OUTBOARD_LIVE_EXTENT });
  expect(c.getSnapshot().offset).toBe(720);
  expect(screen.getByTestId('timeline-discontinuity')).toBeTruthy();
});

test('TL05-06/14 disclosed-only component data/a11y; no future or Live-as-Moment', async () => {
  const c = createPresentationController(fixture(5), 240);
  await render(<TimelinePresentation controller={c} />);
  expect(screen.getAllByTestId(/^timeline-sp-/)).toHaveLength(5);
  expect(screen.queryByTestId('timeline-sp-6')).toBeNull();
  expect(screen.getByTestId('timeline-position').props.accessibilityState.disabled).toBe(true);
  expect(screen.getByTestId('timeline-position').props.accessibilityValue.text).toContain('All disclosed positions fit');
  for (const view of screen.getAllByTestId(/^timeline-sp-/)) {
    expect(view.props.accessibilityLabel).toMatch(/^Disclosed Moment SP [1-5]$/);
    expect(view.props.accessibilityValue).toBeUndefined();
    expect(view.props.onPress).toBeUndefined();
  }
  await act(async () => c.replaceDisclosed(fixture(6)));
  expect(c.getSnapshot().maximum).toBe(48);
  await act(async () => c.replaceDisclosed(fixture(0)));
  expect(screen.queryAllByTestId(/^timeline-sp-/)).toHaveLength(0);
});

test('session replacement resets command/focus proxy and narrow viewport does not rescale', async () => {
  const c = createPresentationController(fixture(20), 480);
  await render(<TimelinePresentation controller={c} />);
  await fireEvent.changeText(screen.getByTestId('timeline-command'), 'last');
  await fireEvent(screen.getByTestId('timeline-list'), 'layout', { nativeEvent: { layout: { width: 240, height: 48 } } });
  expect(c.getSnapshot().maximum).toBe(20 * 48 - 240);
  expect(screen.getByTestId('timeline-sp-1').props.style.width).toBe(48);
  await act(async () => c.replaceDisclosed(fixture(2, 'different-session')));
  expect(screen.getByTestId('timeline-command').props.value).toBe('');
  expect(screen.queryByTestId('timeline-sp-3')).toBeNull();
});

test('RTL native scroll converts Cartesian offset to disclosed ordinal offset', async () => {
  const original = I18nManager.isRTL;
  I18nManager.isRTL = true;
  try {
    const c = createPresentationController(fixture(20), 240);
    await render(<TimelinePresentation controller={c} />);
    await fireEvent(screen.getByTestId('timeline-list'), 'contentSizeChange', 960, 48);
    await fireEvent.scroll(screen.getByTestId('timeline-list'), { nativeEvent: {
      contentOffset: { x: 480, y: 0 }, contentSize: { width: 960, height: 48 },
      layoutMeasurement: { width: 240, height: 48 },
    } });
    expect(c.getSnapshot().offset).toBe(240);
  } finally { I18nManager.isRTL = original; }
});

test('TL05-13/15/16 production import and nonpersistence firewall', () => {
  function sources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      if (entry.name === '__tests__' || entry.name === 'testing') return [];
      const path = join(dir, entry.name);
      return entry.isDirectory() ? sources(path) : /\.tsx?$/.test(path) ? [readFileSync(path, 'utf8')] : [];
    });
  }
  const text = sources(join(__dirname, '..')).join('\n');
  expect(text).not.toMatch(/from\s+['"][^'"]*(?:\/map\/|skia|state\/(?:store|index|CanonicalStateProvider))/i);
  expect(text).not.toMatch(/\.dispatch\s*\(|AsyncStorage|SecureStore|localStorage|COMMIT_MOMENT|COMMIT_LIVE_EDGE|PREVIEW_TEMPORAL_TARGET|fetch\s*\(/);
  expect(text).toContain("from 'react-native'");
  expect(text).toContain('getItemLayout={itemLayout}');
});
