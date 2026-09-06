import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { FlatList } from 'react-native';
import { TimelinePresentation } from '../virtualization/TimelinePresentation';
import { createPresentationController } from '../window/controller';
import { TIMELINE_STEP } from '../model/disclosedTrack';
import { fixture } from '../testing/fixtures';

// Real RN FlatList/VirtualizedList and window algorithm, not a replacement list.
// Native layout/scroll events are supplied by the harness because Jest has no native host.
// 10k/100k fixtures plus real RN windowing exceed Jest's 5s default on a cold CI
// runner. This raises only the harness time budget; no assertion is relaxed.
jest.setTimeout(60_000);
describe.each([10_000, 100_000])('T-05 observable large-history harness: %i disclosed', size => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  async function mount() {
    const controller = createPresentationController(fixture(size), 480);
    await render(<TimelinePresentation controller={controller} />);
    await fireEvent(screen.getByTestId('timeline-list'), 'layout', { nativeEvent: { layout: { width: 480, height: 48, x: 0, y: 0 } } });
    await fireEvent(screen.getByTestId('timeline-list'), 'contentSizeChange', size * 48, 48);
    await fireEvent(screen.getByTestId('timeline-position-rail'), 'layout', { nativeEvent: { layout: { width: 320 } } });
    return controller;
  }
  async function nativeScroll(offset: number) {
    await fireEvent.scroll(screen.getByTestId('timeline-list'), { nativeEvent: {
      contentOffset: { x: offset, y: 0 }, contentSize: { width: size * 48, height: 48 },
      layoutMeasurement: { width: 480, height: 48 }, zoomScale: 1,
    } });
    await act(async () => { jest.runOnlyPendingTimers(); });
  }
  test('TL05-09/12 pointer distant reach issues native scroll; actual list mounts bounded distant SP Views', async () => {
    const scroll = jest.spyOn(FlatList.prototype, 'scrollToOffset'); // call-through, never mocked
    const c = await mount();
    expect(screen.getAllByTestId(/^timeline-sp-/).length).toBeLessThan(100);
    await fireEvent(screen.getByTestId('timeline-position-rail'), 'responderGrant', { nativeEvent: { locationX: 288 } });
    const offset = c.getSnapshot().maximum * 0.9;
    expect(c.getSnapshot().offset).toBe(offset);
    expect(scroll).toHaveBeenLastCalledWith({ offset, animated: false });
    await nativeScroll(offset);
    expect(screen.getByTestId(`timeline-sp-${Math.floor(offset / TIMELINE_STEP) + 1}`)).toBeTruthy();
    const mounted = screen.getAllByTestId(/^timeline-sp-/).length;
    expect(mounted).toBeLessThan(100);
    await fireEvent(screen.getByTestId('timeline-position-rail'), 'responderMove', { nativeEvent: { locationX: 320 } });
    await nativeScroll(c.getSnapshot().offset);
    expect(screen.getByTestId(`timeline-sp-${size}`)).toBeTruthy();
    expect(screen.getAllByTestId(/^timeline-sp-/).length).toBeLessThan(100);
    console.log(`TL05 ${size}: distant mounted=${mounted}; last mounted=${screen.getAllByTestId(/^timeline-sp-/).length}; pointer reach=1 position event`);
    // Repeated long jumps cannot accumulate mounted history behind the viewport.
    for (const fraction of [0.2, 0.6, 0.1, 0.8, 0]) {
      await fireEvent(screen.getByTestId('timeline-position-rail'), 'responderGrant', { nativeEvent: { locationX: fraction * 320 } });
      await nativeScroll(c.getSnapshot().offset);
      expect(screen.getAllByTestId(/^timeline-sp-/).length).toBeLessThan(100);
    }
    scroll.mockRestore();
  });
  test('TL05-10 keyboard text + submit: first/last/page/direct/refine/widen', async () => {
    const c = await mount();
    async function command(value: string) {
      await fireEvent.changeText(screen.getByTestId('timeline-command'), value);
      await fireEvent(screen.getByTestId('timeline-command'), 'submitEditing', { nativeEvent: { text: value } });
    }
    await command('last'); expect(c.getSnapshot().position).toBe(1);
    await nativeScroll(c.getSnapshot().offset);
    expect(screen.getByTestId(`timeline-sp-${size}`)).toBeTruthy();
    await command('first'); expect(c.getSnapshot().offset).toBe(0);
    await command('next'); expect(c.getSnapshot().offset).toBe(480);
    await command('previous'); expect(c.getSnapshot().offset).toBe(0);
    await command('75%'); expect(c.getSnapshot().position).toBeCloseTo(0.75);
    const before = c.getSnapshot().offset;
    await command('refine'); expect(c.getSnapshot().offset).toBe(before);
    await command('widen'); expect(c.getSnapshot().offset).toBe(before);
    await command('+'); expect(c.getSnapshot().position).toBeCloseTo(0.875);
    await command('-'); expect(c.getSnapshot().position).toBeCloseTo(0.75);
  });
  test('TL05-11 assistive control reaches end in eight increments or one named action', async () => {
    const c = await mount();
    for (let n = 0; n < 8; n++) {
      await fireEvent(screen.getByTestId('timeline-position'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    }
    expect(c.getSnapshot().position).toBe(1);
    await nativeScroll(c.getSnapshot().offset);
    expect(screen.getByTestId(`timeline-sp-${size}`)).toBeTruthy();
    await fireEvent(screen.getByTestId('timeline-position'), 'accessibilityAction', { nativeEvent: { actionName: 'first' } });
    expect(c.getSnapshot().position).toBe(0);
    await fireEvent(screen.getByTestId('timeline-position'), 'accessibilityAction', { nativeEvent: { actionName: 'last' } });
    expect(c.getSnapshot().position).toBe(1);
    expect(screen.getByTestId('timeline-position').props.accessibilityValue).toMatchObject({ min: 0, max: 100, now: 100 });
  });
});
