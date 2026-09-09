/**
 * T-12 §13 / `QAN-BL-T12-02` — the ONE app-level locale authority.
 *
 * The backlog item exists because T-08 owns a *language* seam and nothing else: `ChromeLanguage` is
 * `'ar' | 'en'`, it carries no region, and `ar` alone does not determine digits. So there was no
 * place in the repository where "which language, laid out which way, in which region, with which
 * digits" was answered once. This is that place, and it is the only one.
 *
 * ## Four axes, deliberately kept apart
 *
 * **Language** is which of the two Product languages the reader is being spoken to in. It reaches
 * T-08's copy boundary and nothing else.
 *
 * **Layout direction** is which way the interface is laid out. It is INDEPENDENT of language: an
 * Arabic reader on a device configured LTR is a real reader, and so is the mirror case. Nothing here
 * derives one from the other, and the static contract proves that no module does.
 *
 * **Region** is `EG` for v1, and exists because a numeral policy is a regional question rather than
 * a linguistic one — `ar-EG` and `ar-MA` legitimately resolve different digits under CLDR.
 *
 * **Numbering** is the digit shape. See the stability rule below.
 *
 * ## The v1 numeral stability rule (§13)
 *
 * Both numeral systems are correct Arabic. CLDR would resolve Eastern Arabic-Indic digits for
 * `ar-EG`, and adopting that silently — as a side effect of introducing a locale provider — would
 * change what every existing reader sees, in a task whose whole discipline is that integration
 * connects owners rather than redeciding for them. So v1 pins `latn` in BOTH Product languages,
 * exactly as the repository already presents numbers through T-08's single formatter.
 *
 * The pin is recorded here, in one constant, rather than applied per surface. That is the rule the
 * Arabic-frontend craft guidance states as non-negotiable: ONE numeral system per reader per view,
 * routed through one shared formatter, never hand-built digit strings. A future digit-policy change
 * is an explicit Product language/locale decision for a later canonical authority to take — not an
 * integration side effect, and not something a surface may take locally.
 *
 * ## What this is not
 *
 * It is not VI-01. The register law over Arabic vocabulary and tone remains VI-01's, and no word is
 * written here: this module contains no reader-facing string at all. It writes no canonical field,
 * it is not part of `CanonicalState`, and changing it changes no Product truth — the same Session,
 * the same `TC`, the same `V`, the same reversible history, the same acts.
 */

import type { ChromeLanguage } from '../../orientation-chrome';

/** How the interface is laid out. Never derived from the language. */
export type LayoutDirection = 'LTR' | 'RTL';

/** The region a regional policy is resolved for. Egypt, for v1. */
export type ProductRegion = 'EG';

/**
 * The digit shape. `latn` is the only member in v1, and it is a type of one deliberately: adding
 * `arab` is a Product language decision that must be taken by a canonical authority, and making the
 * type wider before that decision exists would invite a surface to choose.
 */
export type ProductNumberingSystem = 'latn';

export interface ProductLocale {
  /** Which Product language the reader is spoken to in. Reaches T-08's copy boundary only. */
  readonly language: ChromeLanguage;
  /** How the interface is laid out. Independent of `language`, always. */
  readonly direction: LayoutDirection;
  readonly region: ProductRegion;
  readonly numbering: ProductNumberingSystem;
}

/**
 * The v1 numeral policy, pinned in exactly one place.
 *
 * @see the module comment for why this is `latn` in both Product languages rather than the CLDR
 * default for `ar-EG`.
 */
export const V1_NUMBERING_SYSTEM: ProductNumberingSystem = 'latn';

/** The region v1 resolves regional policy for. */
export const V1_REGION: ProductRegion = 'EG';

export const PRODUCT_LANGUAGES: readonly ChromeLanguage[] = Object.freeze(['ar', 'en'] as const);
export const LAYOUT_DIRECTIONS: readonly LayoutDirection[] = Object.freeze(['LTR', 'RTL'] as const);

/**
 * Builds the app-level locale from the two facts that are genuinely independent inputs.
 *
 * There is no default language. Defaulting one would quietly make it the Product's default, which is
 * not a decision an integration layer is entitled to take — the same reason T-08 refuses to default
 * its own `language` prop.
 */
export function productLocale(language: ChromeLanguage, direction: LayoutDirection): ProductLocale {
  return Object.freeze({ language, direction, region: V1_REGION, numbering: V1_NUMBERING_SYSTEM });
}

/**
 * The BCP-47 tag this locale formats numbers with, digits pinned explicitly.
 *
 * The `-u-nu-latn` extension is what makes the pin real rather than incidental: without it,
 * `ar-EG` resolves Eastern Arabic-Indic digits on any conforming runtime, so the policy would hold
 * only by accident of which engine happens to be running. `nu` and `ca` are independent extensions
 * and this sets only `nu` — no calendar is pinned here, because nothing in v1 formats a date.
 */
export function numberFormattingTag(locale: ProductLocale): string {
  return `${locale.language}-${locale.region}-u-nu-${locale.numbering}`;
}

/** True when the two axes disagree — a legitimate, supported reader configuration, never a defect. */
export function isCodeSwitched(locale: ProductLocale): boolean {
  return (locale.language === 'ar') !== (locale.direction === 'RTL');
}
