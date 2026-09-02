/**
 * English is the *type source* for the locale shape: `ar.ts` is annotated with
 * `typeof en`, so a missing or misspelled key in either file is a compile error
 * rather than a silent fallback at runtime.
 */
export const en = {
  app: {
    title: 'Qandeel — Live Analysis',
    subtitle: 'Render spike',
    placeholderNotice: 'Exploratory build. Colour and type are placeholders, not decisions.',
  },
  controls: {
    play: 'Play',
    pause: 'Pause',
    restart: 'From the start',
    switchLanguage: 'العربية',
    beatCount: '{{done}} of {{total}}',
  },
  transcript: {
    heading: 'Transcript',
    waiting: 'Press play to run the recorded session.',
  },
  focus: {
    backToWhole: 'Back to the full picture',
    focusedOn: 'Focused on',
    noRanking: 'Readings are shown side by side. Nothing here is ranked or picked as the winner.',
  },
  legend: {
    heading: 'What you are looking at',
    anchor: 'Anchor',
    anchorGloss: 'A place in your own words that the analysis leaned on.',
    card: 'Note',
    cardGloss: 'A short remark set beside an anchor.',
    thread: 'Thread',
    threadGloss: 'A drawn relation between this anchor and an earlier one.',
    meter: 'Meter',
    meterGloss: 'A tracked value, shown together with what moved it.',
    spine: 'Track',
    spineGloss: 'The running strip: one mark per meaningful beat.',
    emergingFrame: 'Emerging frame',
    emergingFrameGloss: 'A wider reading gathering across several beats.',
    openGap: 'Open gap',
    openGapGloss: 'Something still unsettled. It is not a finding.',
  },
  thread: {
    SUPPORT: 'Supports',
    CONTRADICT: 'Contradicts',
    EVOLVE: 'Evolves',
    CONNECT: 'Relates to',
  },
  weight: {
    LOW: 'Light',
    MEDIUM: 'Medium',
    HIGH: 'Strong',
  },
  meter: {
    cause: 'Moved by',
    unbound: 'No cause recorded',
  },
  spine: {
    heading: 'Track',
    scrubHint: 'Drag the track to move through the session.',
    beat: 'Beat',
  },
  gap: {
    stillOpen: 'Still open',
  },
  evidence: {
    level: 'Analysis level',
    confidence: 'Confidence',
  },
  direction: {
    nativeMismatch:
      'The native layout direction still follows the device locale. Restart the app to apply it.',
  },
  honesty: {
    heading: 'What the data would not let us draw',
    capped:
      '{{primitive}} on beat {{beat}}: asked for {{asked}}, drawn at {{drawn}} — {{levels}} does not carry more.',
    dropped: '{{primitive}} on beat {{beat}} was not drawn — {{reason}}.',
    clean: 'Every primitive on screen is drawn at the weight its evidence supports.',
    reasonFrameThreshold:
      'an emerging frame needs two or more primary objects and an INFERRED level',
    reasonNoGeometry: 'one of its two ends has no measured position yet',
    noScale: 'No scale recorded — only the direction of each recorded move.',
  },
} ;

export type LocaleShape = typeof en;
