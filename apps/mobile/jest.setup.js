/* global jest */
// T-04 — Jest setup for the Map layer.
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
