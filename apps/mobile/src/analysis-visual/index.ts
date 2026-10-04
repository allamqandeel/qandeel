/**
 * VPORT-02 — the ink, ground and type of the Analysis support chrome: the Timeline, the temporal surface, the temporal
 * orientation line and OrientationChrome.
 *
 * ## Why this exists
 *
 * Until VPORT-02 those surfaces painted no ground and set no ink at all. Their words and marks were React Native's
 * defaults — black — on whatever lay behind them, which on a device was the window's own background: light in one
 * VPORT-01 proof leg, near-black in the narrow and landscape legs, where the chrome rendered dark-on-dark. Neither
 * was the Analysis: the Analysis is ONE dark place under every appearance preference (G3 Decision A; P1 §12.2).
 *
 * ## What it is
 *
 * Nothing here is chosen. Every value is the Dark family the frozen token tree already resolves, as generated into
 * `conversation/visual/canonical-visual.generated.ts` for W1A-01 — Standard, or F1's Increased resolution when the
 * platform asks for more contrast. The Analysis never reads the reader's Dark / Light / System preference, so this hook
 * does not either: it is Dark by construction, not by scope. The type is E3's roles, in the Estedad faces W1A-01 ships,
 * and a role names its face only once the faces are registered, so no frame ever asks for a family that is not there.
 *
 * It decides no Product fact: no word, no availability, no order, no state. Colour never carries state alone here
 * either — every state the chrome shows is already carried by words, form or position.
 */
import { CANONICAL_VISUAL } from '../conversation/visual/canonical-visual.generated';
import { useConversationTypeface } from '../conversation/visual/fonts';
import { typeStyle, useIncreasedContrast, type ConversationPalette, type TypeRole } from '../conversation/visual/theme';

/** The Analysis family: always Dark (G3 Decision A), Standard or F1 Increased. */
export type AnalysisInk = ConversationPalette;

export function analysisInk(increased: boolean): AnalysisInk {
  const family = CANONICAL_VISUAL.palettes.DARK;
  return increased ? family.increased : family.standard;
}

/** The Analysis chrome's ink and ground, following the platform's increased-contrast setting. */
export function useAnalysisInk(): AnalysisInk {
  return analysisInk(useIncreasedContrast());
}

export interface AnalysisTypeStyle {
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly fontFamily?: string;
  readonly includeFontPadding?: false;
}

const ROLES: readonly TypeRole[] = ['body', 'supporting', 'action', 'metadata', 'statement'];
/** One frozen style object per role and face state, so a windowed list's `renderItem` never churns on a scroll. */
const CACHE = Object.freeze({
  ready: Object.freeze(Object.fromEntries(ROLES.map((role) => [role, Object.freeze(typeStyle(role))]))) as Readonly<Record<TypeRole, AnalysisTypeStyle>>,
  fallback: Object.freeze(
    Object.fromEntries(ROLES.map((role) => {
      const style = typeStyle(role);
      return [role, Object.freeze({ fontSize: style.fontSize, lineHeight: style.lineHeight })];
    })),
  ) as Readonly<Record<TypeRole, AnalysisTypeStyle>>,
});
const readyType = (role: TypeRole): AnalysisTypeStyle => CACHE.ready[role];
const fallbackType = (role: TypeRole): AnalysisTypeStyle => CACHE.fallback[role];

/**
 * E3's type roles for the Analysis chrome. Until the Estedad faces are registered a role carries only its size and
 * leading, so the platform face sets the same measure instead of a family that does not exist yet. The function and
 * every style it returns are stable references.
 */
export function useAnalysisType(): (role: TypeRole) => AnalysisTypeStyle {
  return useConversationTypeface() ? readyType : fallbackType;
}
