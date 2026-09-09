/**
 * T-12 §13 — resolving the app-level locale from the platform, on the two axes SEPARATELY.
 *
 * This is where the independence stops being a claim in a type and becomes a fact about the running
 * app: the two axes are read from two different platform facts, and neither is derived from the
 * other at any point.
 *
 * **Language** comes from the device's own resolved locale. `Intl` is part of the JavaScript runtime
 * this app already ships — no package is added, and nothing is read from a native module directly.
 * A device speaking neither Product language gets English, and that fallback is written down here
 * rather than left implicit: it is a resolution rule for an out-of-range input, not a Product default
 * quietly promoted. When a reader-facing language preference eventually exists, it replaces this one
 * call and nothing else.
 *
 * **Direction** comes from `I18nManager.isRTL`, which is the platform's own layout direction for this
 * app. It is deliberately NOT `language === 'ar'`. An Arabic reader on an LTR-configured device and
 * an English reader on an RTL-configured device are both real, both supported, and both get exactly
 * what they configured — the Map is not mirrored for either, and the Timeline's single physical scrub
 * law follows the direction rather than the language.
 *
 * Neither read is Product truth. Changing either changes wording and layout and nothing else: the
 * same Session, the same `TC`, the same `V`, the same reversible history, the same acts.
 */

import { I18nManager } from 'react-native';

import type { ChromeLanguage } from '../../orientation-chrome';
import { productLocale, type LayoutDirection, type ProductLocale } from './product-locale';

/**
 * The Product language this device resolves to.
 *
 * The primary subtag alone is consulted: `ar`, `ar-EG`, `ar-MA` and `arb` are all the Arabic Product
 * language, and the region within them is not what selects it — v1's region is fixed, and the digit
 * policy is pinned regardless.
 */
export function deviceProductLanguage(): ChromeLanguage {
  try {
    const resolved = new Intl.DateTimeFormat().resolvedOptions().locale;
    return resolved.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  } catch {
    // A runtime without a resolvable locale is not evidence about the reader. English is the
    // resolution for an unknown input, and it is the only place this value is chosen.
    return 'en';
  }
}

/** The layout direction the platform is actually laying this app out in. Never the language. */
export function deviceLayoutDirection(): LayoutDirection {
  return I18nManager.isRTL ? 'RTL' : 'LTR';
}

/** The one app-level locale, read from the two independent platform facts above. */
export function deviceProductLocale(): ProductLocale {
  return productLocale(deviceProductLanguage(), deviceLayoutDirection());
}
