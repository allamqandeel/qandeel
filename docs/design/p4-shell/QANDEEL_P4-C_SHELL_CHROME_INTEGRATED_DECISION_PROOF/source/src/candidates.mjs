// P4-C — the candidates under study, and nothing else. Every option is a CANDIDATE — NOT SELECTED. None is a decision.
//
// One registry drives the page (build.mjs ships it in), the checks and the boards, so a candidate cannot be drawn one way
// and measured another. Per decision: the named viable options of the Decision Queue, at most one evidence-earned
// alternative where the queue allows it, and the options authority rejects, kept visible as rejections.
export const DECISIONS = {
  settings: {
    dq: 'P4-DQ-01', title: 'General Settings entry placement', param: 's',
    options: {
      A: { name: 'Upper-chrome utility', short: 'S-A', what: 'an icon-only Settings entry in the non-Analysis upper chrome, beside P3\'s Activity entry, on every non-Analysis surface' },
      B: { name: 'Personal QANDEEL surface entry', short: 'S-B', what: 'a stable Settings entry on the Personal QANDEEL surface only (its Personal row); Shared and Public reach the one destination through QANDEEL' },
    },
    notEarned: [
      { name: 'inside Activity', why: 'Activity is not Settings (P3 §3); its header already carries a shortcut into the Notifications & Activity section of the same one destination (P3-A) — a second route would blur the two' },
      { name: 'an overflow / "more" menu', why: 'hides the one Settings destination behind a generic menu; nothing in QANDEEL authority needs one, and it is the hidden-settings anti-pattern the task names' },
      { name: 'a fourth Global Switcher item', why: 'FAILS AUTHORITY — I-08A4 §19 rejects "Settings as primary Area"; P1 §8 "secondary Global Shell utility"' },
    ],
  },
  understanding: {
    dq: 'P4-DQ-02', title: 'QANDEEL Understanding entry placement and form', param: 'u',
    options: {
      A: { name: 'Personal row control', short: 'U-A', what: 'a persistent text control «فهم قنديل» with a depth chevron, in a quiet Personal row under the upper chrome, on Personal QANDEEL only' },
      B: { name: 'Conversation-context sibling', short: 'U-B', what: 'a text control beside «تحليل المحادثة» in the Personal Conversation\'s upper chrome — the two Personal depths side by side' },
    },
    rejected: [{ name: 'a General Settings item', short: 'U-S', why: 'FAILS AUTHORITY — P1 §11: Understanding "is not Settings" and "has a stable, discoverable entry from Personal QANDEEL"; the queue already excludes it (DQ-02 option C)' }],
  },
  q: {
    dq: 'P4-DQ-03', title: 'Canonical Q presence and placement', param: 'q',
    options: {
      A: { name: 'Identity moments only', short: 'Q-A', what: 'no Q in ordinary shell chrome; the Q only at named identity moments (the frozen Matching cue, the conversation\'s opening turn as G3.2 draws it; launch / gateway stay DQ-06)' },
      B: { name: 'Persistent shell Q', short: 'Q-B', what: 'the canonical Q centred in the upper chrome of every non-Analysis surface' },
      C: { name: 'Personal QANDEEL only', short: 'Q-C', what: 'the canonical Q centred in the upper chrome of Personal QANDEEL only' },
    },
  },
  switcher: {
    dq: 'P4-DQ-04A', title: 'Global Switcher physical form', param: 'sw',
    options: {
      plate: { name: 'Plate · crown rule', short: 'SW-1', what: 'an attached full-width APPARATUS plate (the one Surface tone) continuous with the composer; SELECTED = the E1R marker as a short crown rule at the item\'s top edge + word weight (the P2-A / P3-A incumbent)' },
      ground: { name: 'Ground · word rule', short: 'SW-2', what: 'no plate: the switcher stands on the page ground below a hairline seam; SELECTED = the E1R marker as a rule under the word, the word\'s own width, + word weight' },
      seam: { name: 'Keyed seam', short: 'SW-3', what: 'the plate with a full-width hairline seam at its top edge; SELECTED = the seam itself thickens to the E1R marker across the whole item cell, + word weight (Call Rail A\'s seam grammar)' },
    },
  },
  context: {
    dq: 'P4-DQ-04B', title: '«سياق الكلام» placement in the Analysis', param: 'x',
    options: {
      end: { name: 'Chrome · beside Replay', short: 'X-A', what: 'a text action in the Analysis upper chrome row, grouped with Replay at the END — both are acts on the current conversation' },
      centre: { name: 'Chrome · centred', short: 'X-B', what: 'the same text action alone at the centre of the Analysis upper chrome row' },
      top: { name: 'World · upper edge', short: 'X-C', rejected: 'measured below the 160 pt world floor in the densest reviewed state (T-11 §3; G3 T-11 / T-12 amendment §3 rule 1)', what: 'a text action standing just inside the world\'s upper edge, at START, over the world\'s own top falloff' },
    },
  },
};

/** The two strongest combination directions. Each is labelled INTEGRATED CANDIDATE — NOT SELECTED everywhere it appears. */
export const DIRECTIONS = {
  I: { name: 'Direction I — Personal-centred', s: 'B', u: 'A', q: 'A', sw: 'plate', x: 'end',
    why: 'every Personal-only entry lives on Personal QANDEEL\'s own row; the global chrome keeps only P3\'s Activity; no pervasive Q' },
  II: { name: 'Direction II — Global utility', s: 'A', u: 'A', q: 'A', sw: 'seam', x: 'end',
    why: 'Settings joins Activity as the global utility pair on every non-Analysis surface; Understanding keeps its Personal row' },
};
export const LABEL_INTEGRATED = 'INTEGRATED CANDIDATE — NOT SELECTED';
export const LABEL_CANDIDATE = 'CANDIDATE — NOT SELECTED';

/** Defaults when a parameter is absent: the incumbent shell exactly as P3-A / G3.2 accepted it — no Settings, Understanding or chrome Q
 *  entry, the incumbent switcher plate, no «سياق الكلام» — so live review does not open on any candidate. */
export const DEFAULTS = { s: 'none', u: 'none', q: 'A', sw: 'plate', x: 'none' };

/** Where each policy puts the chrome Q (the checks compare the pixels against this table). */
export const Q_POLICY = { A: { personal: false, shared: false }, B: { personal: true, shared: true }, C: { personal: true, shared: false } };

/** Planted defects: validator-only modes. The normal build never activates one (checks C-DEF-0). */
export const DEFECTS = {
  fourthtab: 'a fourth Global Switcher destination (Settings as a World tab)',
  brasssel: 'selected-only Brass (the selected nav glyph Brass, the others neutral)',
  nosel: 'SELECTED carried by colour alone (no marker, no weight)',
  glyphbelow: 'the nav glyph drawn below the destination word',
  dupsettings: 'two Settings entries on one surface',
  hiddensettings: 'the Settings entry hidden behind an overflow',
  settingsname: 'an icon-only Settings entry with no accessible name',
  smalltarget: 'a Settings entry under the 44 pt target',
  understandinginsettings: 'QANDEEL Understanding only as a General Settings row',
  activityinanalysis: 'the Activity entry inside the Analysis chrome',
  wrongq: 'a chrome Q drawn while the policy is identity-moments only',
  qstatus: 'the Q used as the selected-state marker',
  redrawnq: 'a Q redrawn by eye (not the canonical geometry)',
  ctxdup: '«سياق الكلام» shown twice',
  ctxoverlap: '«سياق الكلام» laid over Replay',
  activityend: 'the Activity entry moved to the END edge',
  focusorder: 'Settings before Activity in reading order while the DOM says the opposite (focus order ≠ visual order)',
  settingsroute: 'a Settings entry that leads somewhere other than the one destination',
  doorcopy: 'the frozen «تحليل المحادثة» label rewritten',
  mirrornav: 'a World glyph mirrored in RTL',
  navname: 'a nav glyph exposed to assistive technology beside its word',
  lightanalysis: 'the Analysis painted Light under a Light preference',
  wrongdir: 'the Arabic shell laid out LTR',
};
