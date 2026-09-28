/**
 * T-06 — the nonvisual temporal surface, derived from the same Class-A facts the visual one uses.
 *
 * Parity here is structural, not aspirational: every capability this task owns has a route that
 * needs neither a drag nor a precision pointer — exact disclosed Moment targeting, preview,
 * commit, cancel, relative forward continuation, the Live target and the contextual-locus choice —
 * and each one goes through the same addressability gate, the same preview controller and the same
 * commit boundary as its pointer equivalent. There is no accessibility-only path to state, and no
 * action is offered that the pointer route could not reach.
 *
 * Three things this model refuses to say:
 *
 *   - it never announces a preview as committed truth. A preview is named as a preview, in its own
 *     sentence, and the committed stance is stated separately and unchanged beside it;
 *   - it never announces presentation movement as temporal movement. Scrolling, refining and
 *     widening the Timeline belong to T-05's own labels, which say "presentation" and are untouched
 *     here; nothing in this model is derived from a window, an offset or a percentage;
 *   - it never states projection truth. No count of what exists at a position, no hint of what is
 *     coming, no residue of a projection the store has already left. It states the temporal mode,
 *     the committed Session Position and the previewed Session Position, all of which are Class A
 *     or ephemeral intent — never `K(TC)`, never `V`.
 *
 * `PINNED(LH)` and `FOLLOW_LIVE` are distinguished by `stance`, which is derived from the temporal
 * MODE and never from the position. At the instant a reader pins the Live Head the two describe the
 * same Session Position, and they still read differently — which is the point, because when the
 * Live Head next advances they describe different ones.
 *
 * The words are the reader's language, from the W1A-01 Analysis copy (`analysis-language`): the
 * Product Owner's current-edge wording («تتابع المحادثة الآن» / "Following the conversation",
 * «العودة لمتابعة المحادثة» / "Rejoin the conversation") and T-08 / P4-C4's moment wording. "Live"
 * stays a runtime term; it is never said. Nothing here states an analytical fact about anything.
 */
import { analysisCopy, type AnalysisLanguage } from '../../analysis-language';
import type { SessionPosition } from '../../state';
import type { TemporalBounds } from '../targeting/addressability';
import { nextDisclosedTarget, type TemporalTargeting } from '../targeting/disclosed-availability';
import type { TemporalPreview } from '../preview/preview-state';

export const TEMPORAL_ACCESSIBILITY_ACTIONS = Object.freeze([
  'preview-later-moment',
  'commit-previewed-moment',
  'cancel-preview',
  'commit-live-edge',
] as const);
export type TemporalAccessibilityActionName = (typeof TEMPORAL_ACCESSIBILITY_ACTIONS)[number];

export interface TemporalAccessibilityAction {
  readonly name: TemporalAccessibilityActionName;
  readonly label: string;
}

export type TemporalStance = 'FOLLOWING_LIVE' | 'PINNED_TO_MOMENT' | 'NO_COMMITTED_POSITION';

export interface TemporalAccessibilityModel {
  readonly stance: TemporalStance;
  /** The committed temporal truth, stated on its own. A preview never changes this sentence. */
  readonly stanceLabel: string;
  /** The ephemeral preview, stated as a preview, or `null` when none exists. */
  readonly previewLabel: string | null;
  /** The surface's own name. Names the temporal surface, never a disclosure and never a window. */
  readonly surfaceLabel: string;
  readonly actions: readonly TemporalAccessibilityAction[];
  readonly commitAvailable: boolean;
  readonly cancelAvailable: boolean;
  readonly forwardAvailable: boolean;
  readonly liveAvailable: boolean;
  /**
   * The highest Session Position the exact route may target right now: the DISCLOSURE HORIZON, not
   * the Live Head (R1-01). A later Moment may exist and simply not be disclosed yet, and the exact
   * route must not offer what it would then refuse.
   */
  readonly exactTargetMaximum: SessionPosition | null;
}

function stanceLabelFor(bounds: TemporalBounds, language: AnalysisLanguage): { readonly stance: TemporalStance; readonly label: string } {
  const copy = analysisCopy(language);
  if (bounds.committedTc === null) {
    return { stance: 'NO_COMMITTED_POSITION', label: copy.noMomentYet };
  }
  // Derived from the MODE, never from the position: at the Live Head these two are the same Session
  // Position and must still read differently.
  return bounds.mode === 'FOLLOW_LIVE'
    ? { stance: 'FOLLOWING_LIVE', label: copy.followingConversation }
    : { stance: 'PINNED_TO_MOMENT', label: copy.atMoment(bounds.committedTc) };
}

export function temporalAccessibilityModel(
  targeting: TemporalTargeting,
  preview: TemporalPreview,
  language: AnalysisLanguage = 'en',
): TemporalAccessibilityModel {
  const copy = analysisCopy(language);
  const bounds: TemporalBounds = targeting.bounds;
  const { stance, label } = stanceLabelFor(bounds, language);
  const previewing = preview.status === 'PREVIEWING';
  const cursor = previewing ? preview.ptc : bounds.committedTc;
  // Forward availability is asked of the DISCLOSED sequence, so the accessible route offers a step
  // exactly when one exists — never one that the interaction gate would then refuse.
  const forwardAvailable = nextDisclosedTarget(targeting, cursor).outcome === 'STEP';
  const liveAvailable = bounds.liveHead !== null;

  const actions: TemporalAccessibilityAction[] = [];
  if (forwardAvailable) actions.push({ name: 'preview-later-moment', label: copy.previewNextMoment });
  if (previewing) {
    actions.push({ name: 'commit-previewed-moment', label: copy.goToMoment(preview.ptc) });
    actions.push({ name: 'cancel-preview', label: copy.cancelTemporaryLook });
  }
  // Offered whenever a live edge exists, including while already following it: committing it then is
  // a true no-op that writes nothing and records nothing, which is a better answer than hiding the
  // control and leaving a reader unable to confirm where they are.
  if (liveAvailable) actions.push({ name: 'commit-live-edge', label: copy.rejoinConversation });

  return Object.freeze({
    stance,
    stanceLabel: label,
    previewLabel: previewing ? copy.temporaryLookAt(preview.ptc) : null,
    surfaceLabel: copy.temporalNavigation,
    actions: Object.freeze(actions),
    commitAvailable: previewing,
    cancelAvailable: previewing,
    forwardAvailable,
    liveAvailable,
    exactTargetMaximum: targeting.disclosed.horizon,
  });
}

/**
 * The one sentence a surface may announce when temporal state changes. Committed truth first and
 * always; the preview, when there is one, in its own clause and explicitly as a preview.
 */
export function temporalAnnouncement(model: TemporalAccessibilityModel): string {
  return model.previewLabel === null ? model.stanceLabel : `${model.previewLabel} ${model.stanceLabel}`;
}

/**
 * Parses an exact Moment entry. Presentation percentages and window commands are not accepted.
 * Arabic-Indic and Extended Arabic-Indic digits are read as their Western forms, so an Arabic keyboard
 * can enter a moment number as it is.
 */
export function parseExactMomentEntry(input: string): number | null {
  const text = String(input ?? '')
    .trim()
    .replace(/[٠-٩]/gu, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/gu, (d) => String(d.charCodeAt(0) - 0x06f0));
  if (!/^\d{1,9}$/u.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : null;
}
