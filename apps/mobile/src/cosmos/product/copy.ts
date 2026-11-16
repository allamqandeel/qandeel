/**
 * COSMOS-INT-01 Slice B — the words the COSMOS stage itself says, in both Product languages.
 *
 * Reused, already APPROVED words are taken from their owners and never re-stated here: the Personal rung names are
 * T-08's semantic-depth words (`semanticDepthWord`), the zoom labels are the Analysis Map's «إظهار تفاصيل أكثر / أقل»,
 * the stage's own label is each world's approved field label, and the Personal family words are T-08's. The field
 * worlds' three rung names and the three stage-only phrases below were PROPOSED for the COSMOS-INT-01 Product Copy
 * Gate with the Slice B Draft PR and APPROVED by the Product Owner on 2026-11-15, exactly as documented in Contract v1.2
 * §13.6 (six Arabic / English pairs). The gate is CLOSED; the words bind.
 *
 * Second batch (Slice C closure): the PO APPROVED six concise labels for T-08's six return acts on 2026-11-16
 * (Contract v1.4 §17). The words are written in their owner, `orientation-chrome/product-copy.ts` (and T-06's twin
 * `analysisCopy.rejoinConversation` for RETURN_LIVE_HEAD); each act keeps its executor, identity, availability and
 * its detailed hint. `COSMOS_ACT_LABELS_APPROVED` is the gate's record of the six pairs, asserted against the owners.
 */

import { semanticDepthWord, type ChromeLanguage } from '../../orientation-chrome';
import type { WorldKind } from '../core/stage';

export const COSMOS_PRODUCT_COPY_GATE = Object.freeze({
  status: 'COSMOS-INT-01 PRODUCT COPY GATE — CLOSED — 12 rows APPROVED (ar + en) by the Product Owner: 6 on 2026-11-15 (Contract v1.2 §13.6), 6 concise act labels on 2026-11-16 (Contract v1.4 §17)',
  reused: ['semanticDepthWord (T-08 depth words: the Personal rungs)', 'analysisCopy.moreDetail / lessDetail (zoom)', 'analysisCopy.map / fieldLabel (the stage label)', 'analysisCopy.family (the Personal marks and the register)', 'field copy back'],
  proposed: [],
  approved: ['rungFar', 'rungMid', 'rungNear', 'nearest', 'regionEmpty', 'overview', 'BACK_ONE_STEP', 'EXACT_RETURN', 'RETURN_LIVE_HEAD', 'RETURN_LIVE_FOCUS', 'RETURN_WORLD', 'GO_LIVE_AND_LOCATE'],
} as const);

/** The six concise act labels APPROVED by the PO on 2026-11-16 (labels only; the hints are unchanged). */
export const COSMOS_ACT_LABELS_APPROVED = Object.freeze({
  BACK_ONE_STEP: { ar: 'تراجع خطوة', en: 'Previous step' },
  EXACT_RETURN: { ar: 'بداية المعاينة', en: 'Original view' },
  RETURN_LIVE_HEAD: { ar: 'متابعة الآن', en: 'Follow live' },
  RETURN_LIVE_FOCUS: { ar: 'الاهتمام الآن', en: 'Current focus' },
  RETURN_WORLD: { ar: 'العالم كله', en: 'Whole world' },
  GO_LIVE_AND_LOCATE: { ar: 'متابعة + موضع', en: 'Live + locate' },
} as const);

export interface CosmosProductCopy {
  /** The rail's rung names per world; the Personal ones are T-08's depth words. */
  readonly rungs: Readonly<Record<WorldKind, readonly string[]>>;
  /** The act that pans to the nearest served place when nothing is in view. */
  readonly nearest: string;
  /** The world is known to hold places, but none is in this region. */
  readonly regionEmpty: string;
  /** The presentation-only whole-world framing (eases out; writes no canonical camera). */
  readonly overview: string;
  /** At the first rung, away from the origin: the way back to the world's centre (T-08's WORLD depth word). */
  readonly wholeWorld: string;
}

const FIELD_RUNGS = {
  ar: ['بعيد', 'متوسط', 'قريب'], // APPROVED 2026-11-15 — COSMOS-INT-01 Product Copy Gate (rungFar, rungMid, rungNear)
  en: ['Far', 'Mid', 'Near'], // APPROVED 2026-11-15 — COSMOS-INT-01 Product Copy Gate (rungFar, rungMid, rungNear)
} as const;

const WORDS = {
  ar: {
    nearest: 'اذهب إلى الأقرب', // APPROVED 2026-11-15 — COSMOS-INT-01 Product Copy Gate
    regionEmpty: 'لا شيء في هذه المنطقة.', // APPROVED 2026-11-15 — COSMOS-INT-01 Product Copy Gate
    overview: 'نظرة عامة', // APPROVED 2026-11-15 — COSMOS-INT-01 Product Copy Gate
  },
  en: {
    nearest: 'Go to the nearest', // APPROVED 2026-11-15 — COSMOS-INT-01 Product Copy Gate
    regionEmpty: 'Nothing in this region.', // APPROVED 2026-11-15 — COSMOS-INT-01 Product Copy Gate
    overview: 'Overview', // APPROVED 2026-11-15 — COSMOS-INT-01 Product Copy Gate
  },
} as const;

const PERSONAL_DEPTHS = ['WORLD', 'THREAD', 'SESSION', 'ANALYTICAL_OBJECT', 'SOURCE_PROVENANCE'] as const;

export function cosmosProductCopy(language: ChromeLanguage): CosmosProductCopy {
  const personal = PERSONAL_DEPTHS.map((depth) => semanticDepthWord(language, depth));
  return {
    rungs: { PERSONAL: personal, SHARED: FIELD_RUNGS[language], PUBLIC: FIELD_RUNGS[language] },
    ...WORDS[language],
    wholeWorld: semanticDepthWord(language, 'WORLD'),
  };
}
