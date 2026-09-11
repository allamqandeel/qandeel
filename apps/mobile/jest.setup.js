/* global jest, globalThis */
// T-04 — Jest setup for the Map layer; extended by T-06 for the temporal motion binding.
//
// `@shopify/react-native-skia` ships an ES-module entry point that the Expo Jest preset does not
// transform, and its real entry requires the native Skia runtime. The structural renderer is
// therefore exercised against a declarative stand-in: every Skia element becomes a plain React
// Native `View`, so a component test proves the element tree the renderer produces without
// pretending to prove GPU output. What the renderer draws where is proven separately and purely
// by `placeScene`, which is the same placement hit testing uses.
//
// Gesture Handler's own Jest setup installs its native-module mocks so a `GestureDetector` can
// mount in a test renderer.
require('react-native-gesture-handler/jestSetup');

// T-06 — Reanimated 4 and Worklets require the native Worklets TurboModule at IMPORT time: without
// it `react-native-worklets` throws while installing its unpackers, and the module graph of anything
// that imports Reanimated fails to load at all. Reanimated's own shipped mock cannot help, because
// it imports the same real entry point.
//
// So the two runtimes are stood in for declaratively, with the SAME semantics the library's own mock
// documents: a shared value is a plain box, an animated style is its updater's result evaluated
// immediately, and every animation function returns its target value. That makes the motion
// binding's OUTPUT assertable in a component test — the style object a test reads is exactly the one
// the updater produced — while proving nothing about GPU timing, which a unit test cannot prove and
// should not pretend to.
//
// `useAnimatedReaction` is a no-op here, exactly as in the library's own mock. That is why every
// Product decision of the scrub lives in `createScrubHandlers` as an ordinary function: what the
// reaction would schedule is tested directly, and the reaction itself is only the glue that decides
// WHEN, on the UI runtime, where no Product rule lives.
//
// `useReducedMotion` reads a global so a single test can prove reduced-motion parity: the same
// targets, the same preview, the same commit, the same cancellation and the same Live/Pinned
// distinction, with only the transition changed.
jest.mock('react-native-worklets', () => ({
  // On the real UI runtime this defers to the RN runtime. Here the two runtimes are one, so it runs
  // the function directly, preserving argument order and call count.
  scheduleOnRN: (fn, ...args) => fn(...args),
  scheduleOnUI: (fn, ...args) => fn(...args),
  createSerializable: (value) => value,
}));

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, Text, Image, ScrollView, FlatList } = require('react-native');

  const identity = (value) => value;
  const box = (initial) => {
    const state = { value: initial };
    return {
      get value() {
        return state.value;
      },
      set value(next) {
        state.value = next;
      },
      get: () => state.value,
      set: (next) => {
        state.value = typeof next === 'function' ? next(state.value) : next;
      },
    };
  };

  const withAnimation = (toValue, _config, callback) => {
    callback?.(true);
    return toValue;
  };

  return {
    __esModule: true,
    default: { View, Text, Image, ScrollView, FlatList, createAnimatedComponent: identity },
    useSharedValue: (initial) => React.useRef(box(initial)).current,
    useAnimatedStyle: (updater) => updater(),
    // A derived value is a STABLE HANDLE whose current value tracks its inputs, and the stability is
    // not cosmetic. Returning a fresh object per render made every consumer's `useMemo` miss: the
    // presentation camera's binding depends on three derived values, so its identity changed on every
    // render, and `MapCanvas`'s `useLayoutEffect(() => () => motion.reset(), [motion])` therefore
    // reset the plane on EVERY render here while resetting it only on unmount in production. A test
    // could not observe a live drag at all — the drag was cancelled a render after it began, by the
    // mock rather than by anything in the code. The handle is now stable and the value still
    // re-evaluates on every read, which is exactly what the real one does.
    useDerivedValue: (processor) => {
      const latest = React.useRef(processor);
      latest.current = processor;
      const handle = React.useRef(null);
      if (handle.current === null) {
        handle.current = {
          get value() {
            return latest.current();
          },
          get: () => latest.current(),
        };
      }
      return handle.current;
    },
    useAnimatedReaction: () => undefined,
    useAnimatedRef: () => ({ current: null }),
    // Gesture Handler reaches for these three when Reanimated is installed, so a `GestureDetector`
    // can mount at all. They carry no Product meaning: the gesture's own callbacks are never
    // dispatched by a test, and every decision they would make lives in `createScrubHandlers`.
    useEvent: () => () => undefined,
    setGestureState: () => undefined,
    makeMutable: (initial) => box(initial),
    useReducedMotion: () => globalThis.__QANDEEL_TEST_REDUCED_MOTION__ === true,
    withTiming: withAnimation,
    withSpring: withAnimation,
    withDelay: (_ms, next) => next,
    // The sequence is reported by its FINAL resting value: a settle that plays and returns to rest
    // is at rest, which is exactly what a test should be able to assert about it.
    withSequence: (...animations) => (animations.length === 0 ? 0 : animations[animations.length - 1]),
    withRepeat: identity,
    cancelAnimation: () => undefined,
    interpolate: () => 0,
    Easing: { bezier: (a, b, c, d) => ({ bezier: [a, b, c, d] }) },
    ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
  };
});

jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  const { View } = require('react-native');

  // Every declared prop is forwarded onto the stand-in view, so a component test can see exactly
  // what the renderer asked Skia to paint — including the two OPEN-17 paint values.
  const element = (displayName) => {
    const Component = ({ children, ...rest }) => React.createElement(View, { ...rest, skiaElement: displayName }, children ?? null);
    Component.displayName = displayName;
    return Component;
  };

  return {
    Canvas: element('Canvas'),
    Group: element('Group'),
    Circle: element('Circle'),
    Rect: element('Rect'),
    Line: element('Line'),
    Path: element('Path'),
    vec: (x, y) => ({ x, y }),
  };
});
