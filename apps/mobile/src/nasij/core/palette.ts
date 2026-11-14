// NASIJ (experimental, isolated) — the cloth's colours. Natural dyes on undyed wool; no glow, no neon.

import type { ColorKey } from './scene';

export interface NasijPalette {
  readonly colors: Readonly<Record<ColorKey, string>>;
  /** The second ground tone the weave is drawn in. */
  readonly weave: string;
  /** The lantern: a warm pool at the focus and a soft shade toward the edges. */
  readonly lanternWarm: string;
  readonly lanternShade: string;
  readonly text: string;
  readonly textQuiet: string;
  readonly card: string;
}

export const DAY_CLOTH: NasijPalette = Object.freeze({
  colors: Object.freeze({
    ground: '#EDE5D4',
    ink: '#2B2620',
    undyed: '#C9BCA3',
    accent: '#B4432F', // madder: the selection
    dye0: '#263E63', // indigo
    dye1: '#8C3B2E', // madder brown
    dye2: '#C4912B', // saffron
    dye3: '#3C7F73', // verdigris
    dye4: '#6B3350', // pomegranate
    dye5: '#5C4A35', // walnut
  }),
  weave: '#B9AA8D',
  lanternWarm: 'rgba(255, 244, 214, 0.55)',
  lanternShade: 'rgba(74, 56, 36, 0.26)',
  text: '#2B2620',
  textQuiet: '#6E6353',
  card: '#F7F1E4',
});

export const NIGHT_CLOTH: NasijPalette = Object.freeze({
  colors: Object.freeze({
    ground: '#1E2230',
    ink: '#E8DFCC',
    undyed: '#4A4B56',
    accent: '#E0694F',
    dye0: '#7C9BD1',
    dye1: '#C97862',
    dye2: '#E0B45A',
    dye3: '#6DB5A6',
    dye4: '#B77A9B',
    dye5: '#A99274',
  }),
  weave: '#3A3F52',
  lanternWarm: 'rgba(255, 214, 150, 0.16)',
  lanternShade: 'rgba(6, 7, 12, 0.5)',
  text: '#EDE5D4',
  textQuiet: '#A39C8E',
  card: '#262B3B',
});
