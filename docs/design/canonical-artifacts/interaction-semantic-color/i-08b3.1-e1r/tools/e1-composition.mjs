/**
 * I-08B3.1-E1R — THE STATE COMPOSITION / OWNERSHIP MODEL, THE AVAILABILITY PATTERNS,
 * AND THE STATUS-COLOUR POLICY.
 *
 * THIS FILE EXISTS BECAUSE E1 SHIPPED A SLOGAN THAT WAS FALSE.
 *
 * E1 said: "each state owns a different visual channel and NO CHANNEL IS USED TWICE."
 * It was a good sentence and it made the composition sound inevitable. It is not true:
 * SELECTED writes the ink, and DISABLED writes the ink. Two states, one channel. The
 * expression was right; the explanation of WHY it worked was wrong, and a wrong
 * explanation is worse than no explanation because it stops anyone looking.
 *
 * What actually makes the composition work is not exclusivity. It is that THREE channels
 * are exclusively owned, ONE is shared and resolved by a declared precedence, and ONE
 * state is not a peer at all but an OVERRIDE. That is what is written down here, and it
 * is emitted into the SHIPPING token file so the checks read the contract rather than
 * this module's prose.
 *
 * Nothing in this file is a colour and nothing here is derived. These are Product
 * statements, and they are kept in one place so that the tokens, the boards, the
 * behavioural proof and the check suite cannot drift apart from each other.
 */

/* ===================================================================== channels ===== */
/**
 * `owner` is the state that may INTRODUCE a change on the channel.
 * `alsoWritten` lists every other state that writes it — which is the half E1 denied.
 */
export const CHANNELS = [
  {
    channel: 'GROUND',
    field: 'ground',
    owner: 'pressed',
    alsoWritten: [],
    exclusive: true,
    precedenceRule: null,
    note: 'The control’s own ground, washed with the Product’s reading ink. Transient, on pointer-down.',
  },
  {
    channel: 'DETACHED PERIMETER',
    field: 'perimeter',
    owner: 'focus',
    alsoWritten: [],
    exclusive: true,
    precedenceRule: null,
    note: 'Two-tone, outside the control, separated by a gap. It is apparatus adjacent to the object, not a property of it, which is why it contests nothing. DISABLED does not write it: availability decides whether focus can ARRIVE, which is a question about the focus order and not about paint.',
  },
  {
    channel: 'ATTACHED MARKER — PRESENCE',
    field: 'marker',
    owner: 'selected',
    alsoWritten: [],
    exclusive: true,
    precedenceRule: null,
    note: 'The marker’s PRESENCE is owned by selection and by nothing else. Its INK is not: see the INK channel.',
  },
  {
    channel: 'INK',
    field: 'ink',
    owner: 'selected',
    alsoWritten: ['disabled'],
    exclusive: false,
    precedenceRule: 'P1',
    note: 'SHARED, AND THIS IS THE CHANNEL THE OLD SLOGAN DENIED. SELECTED promotes the control’s inks one rung up the frozen ramp; DISABLED collapses every ink the control carries — including the selection marker’s — to the single unavailable ink. Resolved by precedence rule P1, not by ownership.',
  },
  {
    channel: 'TYPE WEIGHT',
    field: 'weight',
    owner: 'selected',
    alsoWritten: [],
    exclusive: true,
    precedenceRule: null,
    note: 'Weight is the record of a choice, and availability is not a reason to withdraw a record. DISABLED does not write it, which is what keeps SELECTED + UNAVAILABLE distinguishable from UNAVAILABLE.',
  },
  {
    channel: 'AVAILABILITY',
    field: null,
    owner: 'disabled',
    alsoWritten: [],
    exclusive: true,
    precedenceRule: null,
    note: 'NOT A VISUAL CHANNEL, which is why it carries no matrix field. It is the affordance itself, and that is why DISABLED is an override rather than a peer state.',
  },
];

/* =================================================================== precedence ===== */
/**
 * THREE RULES, NOT ONE ORDERING. A single linear precedence would be another slogan:
 * the states do not queue for one channel, they interact in three specific ways.
 */
export const PRECEDENCE = [
  {
    id: 'P1',
    rule: 'AVAILABILITY OVERRIDES INK.',
    detail: 'When a control is unavailable every ink it carries resolves to qandeel.state.disabled.ink, INCLUDING the selection marker’s. Selection’s ink promotion is suppressed. Selection’s marker and selection’s weight are not.',
    why: 'A control that is not acting has no internal hierarchy to express, because hierarchy is for reading and acting. The choice the user already made is a different fact from the control’s availability, and it survives.',
  },
  {
    id: 'P2',
    rule: 'AVAILABILITY SUPPRESSES THE PRESS RESPONSE.',
    detail: 'An unavailable control produces no ground response at any point in a pointer interaction.',
    why: 'The ground response means "I am receiving your physical interaction." An unavailable control is not. This is the rule that makes four of the sixteen combinations unreachable rather than merely unusual.',
  },
  {
    id: 'P3',
    rule: 'FOCUS IS ORTHOGONAL AND IS NEVER SUPPRESSED BY ANOTHER STATE.',
    detail: 'The perimeter is detached apparatus; it contests no channel. Whether it can appear on an UNAVAILABLE control is decided by that control’s availability pattern — see com.qandeel.availability — and not by precedence.',
    why: 'Focus is a fact about the input system, not about the object. E1 previously concluded from its own expression rule that focus and unavailability could never co-occur; that was an accessibility claim dressed as a composition claim, and it was wrong.',
  },
];

/* ================================================== the availability patterns (REV-01) */
/**
 * DISABLED DESCRIBES AVAILABILITY. FOCUSABILITY IS A SEPARATE QUESTION, ANSWERED BY THE
 * CONTROL PATTERN AND BY WHETHER THE CONTROL HAS TO REMAIN DISCOVERABLE.
 *
 * Source, read at its URL on 2026-09-22: W3C ARIA Authoring Practices Guide, "Developing
 * a Keyboard Interface", Focusability of disabled controls —
 *   "there are some contexts where it is useful for an element to convey a disabled state
 *    while remaining focusable, especially inside of composite widgets"
 *   "Screen reader users are far less likely to discover disabled elements that are not
 *    focusable because moving focus is one of their primary methods of discovery"
 * and its instruction to adopt "consistent pattern-based conventions for the focusability
 * of disabled elements" — which is precisely what the two patterns below are.
 */
export const AVAILABILITY = {
  contract: 'DISABLED DESCRIBES AVAILABILITY, NOT FOCUSABILITY. A control that is unavailable cannot be activated. Whether it stays in the focus order is determined by the control pattern and by whether its absence can be inferred from its neighbours.',
  patterns: [
    {
      name: 'NATIVE NON-DISCOVERABLE UNAVAILABLE',
      available: false,
      focusable: false,
      activates: false,
      when: 'A standalone control whose unavailability a keyboard or screen-reader user can reasonably infer from what is around it — the commit button at the foot of a form whose fields are visibly incomplete, an action whose reason is stated in the adjacent text the user has just read.',
      web: 'the HTML `disabled` attribute. Browsers remove it from the tab sequence.',
      native: 'Pressable `disabled` plus accessibilityState={{ disabled: true }}.',
      cost: 'It is skipped, which costs a screen-reader user the chance to discover it at all. That is the trade being made, and it is only acceptable when the neighbourhood carries the information.',
    },
    {
      name: 'DISCOVERABLE UNAVAILABLE',
      available: false,
      focusable: true,
      activates: false,
      when: 'A control inside a set, where skipping it would hide the shape of the set: an option in a list of options, an item in a menu or a toolbar, a tab, a filter or scope chip, a row in a chooser. Also any single control whose existence is itself the information — a capability the user is meant to know about and does not yet have.',
      web: '`aria-disabled="true"` with the control kept in the tab order, and activation suppressed in script. aria-disabled does not change focusability and applies no user-agent styling, so the expression below must be applied explicitly.',
      native: 'accessibilityState={{ disabled: true }} with the control left focusable and onPress suppressed. NOT VERIFIED ON A DEVICE — see E1_REACT_NATIVE_MAPPING.md D-E1-6.',
      cost: 'It is reachable, which costs every keyboard user a keystroke. That is acceptable where the set would otherwise be misread.',
    },
  ],
  visualInvariance: 'THE TWO PATTERNS ARE VISUALLY IDENTICAL. Both are the single unavailable ink applied to the whole control. Nothing in the expression depends on whether the control stayed focusable, because the user is being told the same thing in both cases: this is unavailable. A visible difference would encode an implementation decision as a Product meaning.',
  focusOnAnUnavailableControl: 'In the DISCOVERABLE pattern the focus perimeter appears exactly as it does anywhere else, drawn in the focus indicator’s own tokens. It is not dimmed with the control: the perimeter belongs to the input system and the input system is not unavailable.',
  whatEveryPatternShips: [
    'the single unavailable ink across the whole control',
    'the platform-appropriate programmatic disabled state',
    'activation suppressed, by the attribute or in script',
    'a stated reason, in a real adjacent element the control points at',
  ],
};

/* ============================================ the composition matrix, all 16 (REV-02) */
const R = 'REACHABLE', U = 'UNREACHABLE', C = 'CONDITIONAL';

/** Canonical order. Every combination below is a subset of these four, in this order. */
export const STATES = ['pressed', 'focus', 'selected', 'disabled'];

const rest = { ground: 'rest', perimeter: 'none', marker: 'absent', ink: 'rest ink', weight: 'rest' };

export const MATRIX = [
  { states: [], verdict: R, ...rest, rule: '—', why: 'REST is the absence of state.' },

  { states: ['pressed'], verdict: R, ...rest, ground: 'wash', rule: '—', why: 'The ground moves and returns. Nothing persists.' },

  { states: ['focus'], verdict: R, ...rest, perimeter: 'indicator + companion', rule: '—', why: 'Input is going here.' },

  { states: ['selected'], verdict: R, ...rest, marker: 'present, selected marker ink', ink: 'promoted one rung', weight: 'promoted', rule: '—', why: 'The user chose this and it stayed chosen.' },

  { states: ['disabled'], verdict: R, ...rest, ink: 'unavailable ink, whole control', rule: 'P1, P2', why: 'Unavailable. Every ink the control carries resolves to one value, the press response is suppressed, and the reason is stated in a real adjacent element. Whether focus can ARRIVE here is the next row’s question, not this one’s.' },

  { states: ['pressed', 'focus'], verdict: R, ...rest, ground: 'wash', perimeter: 'indicator + companion', rule: 'P3', why: 'Ordinary on every platform E1 targets: a pointer press on an already-focused control, and a keyboard activation held down. The two channels are disjoint, so nothing has to be decided.' },

  { states: ['pressed', 'selected'], verdict: R, ground: 'wash', perimeter: 'none', marker: 'present, selected marker ink', ink: 'promoted one rung', weight: 'promoted', rule: '—', why: 'A chosen thing being pressed again. The ground moves under an object that keeps its marker.' },

  { states: ['pressed', 'disabled'], verdict: U, ground: 'rest — the press response is suppressed', perimeter: 'none', marker: 'absent', ink: 'unavailable ink, whole control', weight: 'rest', rule: 'P2', why: 'NOT REACHABLE AS AN EXPRESSION. A pointer-down on an unavailable control is discarded: a ground response would say the interaction was received, and it was not. The control may still be touched; there is no state to paint.' },

  { states: ['focus', 'selected'], verdict: R, ground: 'rest', perimeter: 'indicator + companion', marker: 'present, selected marker ink', ink: 'promoted one rung', weight: 'promoted', rule: 'P3', why: 'THE PAIR THE WHOLE EXPRESSION WAS BUILT TO KEEP APART. Detached apparatus outside, attached marker inside, ground between them.' },

  { states: ['focus', 'disabled'], verdict: C, ground: 'rest', perimeter: 'indicator + companion, in the DISCOVERABLE pattern only', marker: 'absent', ink: 'unavailable ink, whole control', weight: 'rest', rule: 'P3 + availability pattern', why: 'CONDITIONAL ON THE PATTERN. In NATIVE NON-DISCOVERABLE UNAVAILABLE it cannot occur, because the control is not in the focus order. In DISCOVERABLE UNAVAILABLE it occurs routinely and must be expressed — this is the combination E1 declared impossible.' },

  { states: ['selected', 'disabled'], verdict: C, ground: 'rest', perimeter: 'none', marker: 'PRESENT, in the unavailable ink', ink: 'unavailable ink, whole control', weight: 'promoted — RETAINED', rule: 'P1', why: 'CONDITIONAL ON THE CONTROL TYPE — see com.qandeel.selected-unavailable. Where it is reachable, the choice is a record and the record survives: the marker stays and the weight stays, and the ink obeys the availability override. Two channels distinguish it from UNAVAILABLE (marker, weight) and one from SELECTED (ink).' },

  { states: ['pressed', 'focus', 'selected'], verdict: R, ground: 'wash', perimeter: 'indicator + companion', marker: 'present, selected marker ink', ink: 'promoted one rung', weight: 'promoted', rule: 'P3', why: 'All three channels are disjoint. A keyboard user activating the row they have focused and already chosen.' },

  { states: ['pressed', 'focus', 'disabled'], verdict: U, ground: 'rest — suppressed', perimeter: 'indicator + companion, in the DISCOVERABLE pattern only', marker: 'absent', ink: 'unavailable ink, whole control', weight: 'rest', rule: 'P2', why: 'Unreachable for the same reason as pressed + disabled. Focus may be present; the press response is not.' },

  { states: ['pressed', 'selected', 'disabled'], verdict: U, ground: 'rest — suppressed', perimeter: 'none', marker: 'PRESENT, in the unavailable ink', ink: 'unavailable ink, whole control', weight: 'promoted — RETAINED', rule: 'P2', why: 'Unreachable. P2 removes the press wherever unavailability is present.' },

  { states: ['focus', 'selected', 'disabled'], verdict: C, ground: 'rest', perimeter: 'indicator + companion, in the DISCOVERABLE pattern only', marker: 'PRESENT, in the unavailable ink', ink: 'unavailable ink, whole control', weight: 'promoted — RETAINED', rule: 'P1 + P3 + availability pattern', why: 'CONDITIONAL, and it is the ordinary case for a chosen option that has become unavailable inside a set the user is tabbing through. Board b17.' },

  { states: ['pressed', 'focus', 'selected', 'disabled'], verdict: U, ground: 'rest — suppressed', perimeter: 'indicator + companion, in the DISCOVERABLE pattern only', marker: 'PRESENT, in the unavailable ink', ink: 'unavailable ink, whole control', weight: 'promoted — RETAINED', rule: 'P2', why: 'Unreachable. P2.' },
];

/* ============================= SELECTED + UNAVAILABLE, ruled at the control type ===== */
/**
 * E1 would have answered "impossible" here, from a universal it did not have the
 * authority to state. The question is a control-type question and it is answered one
 * control type at a time. Where E1R does not have Product authority it says so instead
 * of deciding.
 */
export const SELECTED_UNAVAILABLE = {
  question: 'Can a control be SELECTED and UNAVAILABLE at the same time?',
  answer: 'AT SOME CONTROL TYPES, YES. E1R does not have the Product authority to rule it out everywhere, and does not try to: the question is answered one control type at a time, below.',
  byControlType: [
    {
      controlType: 'a chosen value in a set — a filter, a scope chip, an option row',
      verdict: 'REACHABLE, AND EXPRESSED',
      why: 'The selection is a VALUE the user chose. A value can stop being available while remaining the value that was chosen: the user must be able to see both what they picked and that it no longer applies. Hiding the marker would silently rewrite their choice; hiding the control would silently rewrite the set.',
      proof: 'board b17, and the behavioural obligations in data/E1_FOCUS.json',
    },
    {
      controlType: 'a list row that is the current destination',
      verdict: 'PRODUCT-OWNED — NOT RULED OUT',
      why: 'Here the selection is a POSITION rather than a value, and a position that becomes unavailable is arguably a navigation event rather than a control state. E1R does not decide this: it depends on what QANDEEL does when the world you are standing in stops being available to you, which is a Connected Worlds question and not a colour question.',
      proof: 'open — E1R_REVISION_RECORD.md §6',
    },
    {
      controlType: 'a persistent navigation item',
      verdict: 'NOT EXPRESSIBLE IN E1R — AND THAT IS A SCOPE STATEMENT, NOT A PRODUCT LAW',
      why: 'The item carries LIVING BRASS, and Living Brass is state-invariant in value AND in appearance. E1R therefore supplies NO unavailable expression for it, and does not claim that the Product can never need one. If a destination must be shown as unavailable, that is a navigation-contract decision; two of the three obvious expressions — dimming the Brass and recolouring it — are forbidden by the material, and the third is absence or an empty state at the destination.',
      proof: 'board b15, and check R30 on the shipping stylesheet',
    },
    {
      controlType: 'a button',
      verdict: 'NOT APPLICABLE',
      why: 'E1 gives a button no SELECTED expression at all. A button is pressed, never chosen. The combination has nothing to resolve.',
      proof: 'the shipped stylesheet has no selected rule for .btn',
    },
  ],
};

/* ================================================= the status-colour policy (REV-03) */
/**
 * WHAT IS PRESERVED: status colour is EARNED, and QANDEEL does not use a generic
 * traffic-light palette.
 *
 * WHAT IS WITHDRAWN: the absolute. "QANDEEL HAS FOUR STATUS ROLES AND ONE STATUS COLOUR"
 * was a cap on a future nobody had evidence about, frozen into a product contract by a
 * package whose evidence was about ONE role.
 */
export const STATUS_POLICY = {
  principle: 'STATUS COLOUR IS EARNED, NOT ASSIGNED BY TAXONOMY. A role does not receive a dedicated hue because it has a name.',
  preserved: 'QANDEEL DOES NOT USE A GENERIC TRAFFIC-LIGHT PALETTE. Three hues assigned by category is the failure this policy exists to prevent, and nothing below reopens it.',
  current: 'ERROR CURRENTLY OWNS THE ONLY DEDICATED SYSTEM-STATUS HUE IN QANDEEL.',
  route: 'WARNING, SUCCESS and INFORMATIONAL remain neutral UNTIL a real Product case proves that their required attention, persistence or detached presentation cannot be carried truthfully and accessibly by position, copy, glyph, state change, boundary or hierarchy. A future dedicated status expression requires PRODUCT EVIDENCE. It is NOT prohibited by E1R, and the count of dedicated hues is NOT a frozen cap.',
  whatIsFrozen: 'That a hue must be EARNED, and that the evidence is a Product case rather than a taxonomy. Not the number.',
};

export const ROLE_EVIDENCE = {
  error: {
    dedicatedHue: true,
    earnedBy: [
      'it is the one status a user must not act past — every other status tolerates being missed for a moment, and an invalid field acted on is a cost the user pays',
      'it is the one status the platforms agree about, so users arrive carrying the expectation. Familiarity is a real design input and it is declared as a decision, not disguised as a measurement',
      'Material 3 ships 26 standard colour roles in six groups and error is the only status role among them',
    ],
    productOwnerJudgement: 'THE VALUE #fe907e IS PRODUCT-OWNER VISUALLY APPROVED. Its acceptance rests on Product visual judgement, plus contrast and accessibility evidence, plus semantic-separation evidence. The OkLCh / dichromacy derivation is engineering evidence for THIS palette on THIS ground; it is not a universal accessibility law and it does not prove that no other valid error red could exist.',
  },
  warning: {
    dedicatedHue: false,
    currentExpression: 'the commit boundary promoted to the primary reading ink at double weight, a triangle glyph, and copy that names the consequence',
    whyNotYet: 'In every QANDEEL warning surface audited, the warning is attached to a commit the user is performing, so the boundary they are committing across is already the carrier and the frozen Surface contract already owns it.',
    overturnedBy: 'A warning that must appear AMBIENTLY — persistent, detached from any commit the user is performing.',
    auditFinding: 'MET, ONCE. Transient connection or service degradation in a Shared or Public world is persistent, ambient and not a failure of anything the user just did. See E1R_PRODUCT_SURFACE_AUDIT.md §3.7. The condition being met does NOT itself create a hue; it means the refusal is no longer automatic and the case is handed to Product.',
    productEvidenceRequired: 'A surface where the ambient warning must be noticed without interrupting, and where position, copy, glyph and boundary have been tried and are demonstrably insufficient.',
  },
  success: {
    dedicatedHue: false,
    currentExpression: 'the changed state shown changed, a bare check glyph, and copy in the perfect tense of the verb the commit used',
    whyNotYet: 'A successful operation in QANDEEL resolves INTO STATE, and the state system shows it better than a colour could.',
    overturnedBy: 'An operation whose result CANNOT be shown in place — a background job whose outcome has no visible home.',
    auditFinding: 'MET, ONCE. A background analysis or replay whose result lands after the user has navigated away has no visible home. See E1R_PRODUCT_SURFACE_AUDIT.md §3.8. The answer is still a place to land, a glyph and copy before it is a hue.',
    productEvidenceRequired: 'A surface where the result genuinely cannot be shown in place AND a glyph plus copy in that surface has been tried and is demonstrably insufficient.',
  },
  informational: {
    dedicatedHue: false,
    currentExpression: 'rank in the frozen reading ramp, plus a glyph where the information is a distinct KIND rather than a subordinate detail',
    whyNotYet: 'This is what the frozen three-step reading ramp was built for. A blue would add a fourth hue to say what the ramp already says by rank.',
    overturnedBy: 'Information that is a distinct KIND rather than a rank — and then the first answer is the glyph, not the hue.',
    auditFinding: 'NOT MET in the audited surfaces. Privacy and authority-boundary statements are the closest case and they read correctly at secondary rank with a lock glyph.',
    productEvidenceRequired: 'A kind of information that a glyph cannot distinguish and that rank actively misreports.',
  },
};

/** The subsets, in canonical order, so the check and the emitter agree on the shape. */
export function allCombinations() {
  const out = [];
  for (let mask = 0; mask < 16; mask++) {
    out.push(STATES.filter((_, i) => mask & (1 << i)));
  }
  return out;
}

export const key = (states) => STATES.filter((s) => states.includes(s)).join('+') || 'rest';
