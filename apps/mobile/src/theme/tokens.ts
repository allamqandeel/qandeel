/**
 * PLACEHOLDER STYLING — NOT A DESIGN DECISION.
 *
 * Task 01 §7 puts the final palette and typography explicitly out of scope. Every
 * value here exists only so the spike is legible while the render contract is being
 * proven. Nothing in this file should be read as a chosen visual language.
 *
 * The one thing that IS load-bearing: the emphasis ramp below is monotonic and
 * bounded. `LOW` must never be able to out-shout `MEDIUM`, and `MEDIUM` must never
 * out-shout `HIGH` (Task 01 §5, principle 3).
 */

export const palette = {
  paper: '#FBFAF7',
  paperSunk: '#F2F0EA',
  ink: '#1B1A17',
  inkSoft: '#4A4741',
  inkFaint: '#8B867C',
  rule: '#DCD8CE',

  // Relationship hues. These carry NO ranking — they are labels, not scores.
  support: '#3F6E4F',
  contradict: '#A24B3B',
  evolve: '#5A5B96',
  connect: '#7A6A3E',

  // Unresolved things. Deliberately the least saturated ink in the set.
  gap: '#9A958A',
} as const;

export type ThreadStyleKey = 'SUPPORT' | 'CONTRADICT' | 'EVOLVE' | 'CONNECT';

export const threadColor: Record<ThreadStyleKey, string> = {
  SUPPORT: palette.support,
  CONTRADICT: palette.contradict,
  EVOLVE: palette.evolve,
  CONNECT: palette.connect,
};

export type AnchorWeightKey = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Emphasis ramp. Strictly increasing on every channel, and capped well below
 * "shouting" — an ANCHOR decorates the user's own words, it never replaces them.
 */
export const anchorEmphasis: Record<
  AnchorWeightKey,
  {
    backgroundOpacity: number;
    underlineWidth: number;
    underlineDashed: boolean;
    fontWeight: '400' | '500' | '600';
    sideRule: boolean;
  }
> = {
  LOW: {
    backgroundOpacity: 0,
    underlineWidth: 1,
    underlineDashed: true,
    fontWeight: '400',
    sideRule: false,
  },
  MEDIUM: {
    backgroundOpacity: 0.1,
    underlineWidth: 1.5,
    underlineDashed: false,
    fontWeight: '500',
    sideRule: false,
  },
  HIGH: {
    backgroundOpacity: 0.2,
    underlineWidth: 2,
    underlineDashed: false,
    fontWeight: '600',
    sideRule: true,
  },
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 28,
} as const;

export const radius = {
  sm: 4,
  md: 8,
} as const;

export const type = {
  transcript: 19,
  transcriptLineHeight: 34,
  card: 13,
  cardLineHeight: 20,
  label: 11,
  frame: 15,
  frameLineHeight: 24,
} as const;

export const motion = {
  /** A CARD is a small aside: quick, unobtrusive. */
  cardEnterMs: 220,
  /** An EMERGING_FRAME aggregates several beats: it must arrive heavier and later. */
  frameEnterMs: 900,
  frameDelayMs: 120,
  /** A METER change must be readable as a change, not a jump. */
  meterMs: 520,
  threadDrawMs: 480,
} as const;
