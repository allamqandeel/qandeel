/**
 * COSMOS-INT-01 Slice B — the words the COSMOS stage itself says, in both Product languages.
 *
 * Reused, already APPROVED words are taken from their owners and never re-stated here: the Personal rung names are
 * T-08's semantic-depth words (`semanticDepthWord`), the zoom labels are the Analysis Map's «إظهار تفاصيل أكثر / أقل»,
 * the stage's own label is each world's approved field label, and the Personal family words are T-08's. The field
 * worlds' three rung names and the three stage-only phrases below are PROPOSED for the COSMOS-INT-01 Product Copy
 * Gate: they are the device proof's words, shown to the Product Owner on the HONOR, and they bind only once approved.
 */

import { semanticDepthWord, type ChromeLanguage } from '../../orientation-chrome';
import type { WorldKind } from '../core/stage';

export const COSMOS_PRODUCT_COPY_GATE = Object.freeze({
  status: 'COSMOS-INT-01 PRODUCT COPY GATE — OPEN — 6 rows PROPOSED (ar + en), presented with the Slice B Draft PR',
  reused: ['semanticDepthWord (T-08 depth words: the Personal rungs)', 'analysisCopy.moreDetail / lessDetail (zoom)', 'analysisCopy.map / fieldLabel (the stage label)', 'analysisCopy.family (the Personal marks and the register)', 'field copy back'],
  proposed: ['rungFar', 'rungMid', 'rungNear', 'nearest', 'regionEmpty', 'overview'],
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
  ar: ['بعيد', 'متوسط', 'قريب'], // PROPOSED — COSMOS-INT-01 Product Copy Gate (rungFar, rungMid, rungNear)
  en: ['Far', 'Mid', 'Near'], // PROPOSED — COSMOS-INT-01 Product Copy Gate (rungFar, rungMid, rungNear)
} as const;

const WORDS = {
  ar: {
    nearest: 'اذهب إلى الأقرب', // PROPOSED — COSMOS-INT-01 Product Copy Gate
    regionEmpty: 'لا شيء في هذه المنطقة.', // PROPOSED — COSMOS-INT-01 Product Copy Gate
    overview: 'نظرة عامة', // PROPOSED — COSMOS-INT-01 Product Copy Gate
  },
  en: {
    nearest: 'Go to the nearest', // PROPOSED — COSMOS-INT-01 Product Copy Gate
    regionEmpty: 'Nothing in this region.', // PROPOSED — COSMOS-INT-01 Product Copy Gate
    overview: 'Overview', // PROPOSED — COSMOS-INT-01 Product Copy Gate
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
