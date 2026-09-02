import { I18nManager, Platform, type FlexStyle, type TextStyle } from 'react-native';

/**
 * Reconciles the two directions that exist at once.
 *
 * `engineIsRTL` is what the LAYOUT ENGINE is already doing: on iOS and Android a true
 * `I18nManager.isRTL` means Yoga lays `flexDirection: 'row'` out right-to-left and
 * `alignItems: 'flex-start'` already means the right edge, fixed for the life of the
 * process. On react-native-web the flag exists but nothing acts on it — `row` stays
 * physically left-to-right — so trusting it there mirrors the layout a second time and
 * renders English backwards. Hence the platform check: it is not defensive, it is the
 * difference between two genuinely different engines.
 *
 * `isRTL` is the direction the SELECTED LANGUAGE wants, which changes the moment the user
 * hits the toggle.
 *
 * When the two agree, the plain values are correct. When they disagree, every
 * direction-relative value has to be mirrored back. Getting this wrong is the classic
 * "RTL works on my Arabic phone and is broken on my English one" bug, so no component
 * hard-codes `row-reverse` or `flex-end` — they all come from here.
 */
export interface LayoutDirection {
  isRTL: boolean;
  /** What the layout engine mirrors on its own, before this module does anything. */
  engineIsRTL: boolean;
  /** True when the selected language disagrees with the native layout direction. */
  mirrored: boolean;
  row: FlexStyle['flexDirection'];
  rowReverse: FlexStyle['flexDirection'];
  /** Cross-axis alignment that lands on the edge reading begins from. */
  alignStart: FlexStyle['alignItems'];
  alignEnd: FlexStyle['alignItems'];
  selfStart: FlexStyle['alignSelf'];
  selfEnd: FlexStyle['alignSelf'];
  textAlign: TextStyle['textAlign'];
  writingDirection: TextStyle['writingDirection'];
}

export function engineIsRTL(): boolean {
  return Platform.OS !== 'web' && I18nManager.isRTL;
}

export function layoutDirection(isRTL: boolean): LayoutDirection {
  const engine = engineIsRTL();
  const mirrored = isRTL !== engine;

  return {
    isRTL,
    engineIsRTL: engine,
    mirrored,
    row: mirrored ? 'row-reverse' : 'row',
    rowReverse: mirrored ? 'row' : 'row-reverse',
    alignStart: mirrored ? 'flex-end' : 'flex-start',
    alignEnd: mirrored ? 'flex-start' : 'flex-end',
    selfStart: mirrored ? 'flex-end' : 'flex-start',
    selfEnd: mirrored ? 'flex-start' : 'flex-end',
    // `textAlign` is resolved physically by the text engine, so it is driven by the
    // selected language alone and never by the native flag.
    textAlign: isRTL ? 'right' : 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr',
  };
}
