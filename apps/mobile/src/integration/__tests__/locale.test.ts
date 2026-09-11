/**
 * T-12 — A91…A94: `QAN-BL-T12-02`, the one locale authority.
 *
 * The two axes are independent, the region is explicit, and the v1 numeral policy is pinned in ONE
 * place. What makes the pin real rather than incidental is the `-u-nu-latn` extension: without it
 * `ar-EG` resolves Eastern Arabic-Indic digits on any conforming runtime, so the policy would hold
 * only by accident of which engine happened to be running.
 */
import {
  LAYOUT_DIRECTIONS,
  PRODUCT_LANGUAGES,
  V1_NUMBERING_SYSTEM,
  V1_REGION,
  isCodeSwitched,
  numberFormattingTag,
  productLocale,
} from '../locale/product-locale';
import { deviceLayoutDirection, deviceProductLanguage, deviceProductLocale } from '../locale/device-locale';

describe('T12-A91…A94 — language, direction, region and digits', () => {
  it('T12-A91 — language and layout direction are independent axes', () => {
    // All four combinations are representable, and two of them are the code-switched readers a rule
    // like `direction = language === 'ar' ? 'RTL' : 'LTR'` would make unreachable.
    const all = PRODUCT_LANGUAGES.flatMap((language) => LAYOUT_DIRECTIONS.map((direction) => productLocale(language, direction)));
    expect(all).toHaveLength(4);
    expect(all.filter(isCodeSwitched)).toHaveLength(2);
    expect(productLocale('ar', 'LTR').direction).toBe('LTR');
    expect(productLocale('en', 'RTL').direction).toBe('RTL');
  });

  it('T12-A93 — v1 pins Western digits in BOTH Product languages, explicitly', () => {
    for (const language of PRODUCT_LANGUAGES) {
      const locale = productLocale(language, 'LTR');
      expect(locale.numbering).toBe('latn');
      expect(locale.region).toBe('EG');
      // The pin is carried into the formatting tag, so it survives the runtime rather than depending
      // on which digits an engine happens to resolve for `ar-EG`.
      expect(numberFormattingTag(locale)).toBe(`${language}-EG-u-nu-latn`);
    }
  });

  it('T12-A93 — and the pinned tag really produces Western digits for Arabic', () => {
    const arabic = numberFormattingTag(productLocale('ar', 'RTL'));
    // Without the extension this is `١٢٣٤` on a conforming runtime. This is the whole reason the
    // policy is a tag rather than a comment.
    expect(new Intl.NumberFormat(arabic).format(1234)).toBe(new Intl.NumberFormat('en-US').format(1234));
    expect(new Intl.NumberFormat(arabic).format(7)).toBe('7');
  });

  it('the numeral policy has exactly one source, and it is not a per-surface choice', () => {
    expect(V1_NUMBERING_SYSTEM).toBe('latn');
    expect(V1_REGION).toBe('EG');
    // Every locale this module can build carries the same policy: there is no argument that changes
    // it, so no surface can quietly pick a different one.
    for (const language of PRODUCT_LANGUAGES) {
      for (const direction of LAYOUT_DIRECTIONS) {
        expect(productLocale(language, direction).numbering).toBe(V1_NUMBERING_SYSTEM);
      }
    }
  });

  it('T12-A94 — the device resolves the two axes from two different platform facts', () => {
    const locale = deviceProductLocale();
    expect(PRODUCT_LANGUAGES).toContain(locale.language);
    expect(LAYOUT_DIRECTIONS).toContain(locale.direction);
    // Read separately, and neither derived from the other.
    expect(locale.language).toBe(deviceProductLanguage());
    expect(locale.direction).toBe(deviceLayoutDirection());
    // A device speaking neither Product language resolves to English; it never resolves to nothing.
    expect(deviceProductLanguage()).toMatch(/^(ar|en)$/u);
  });

  it('the locale is presentation configuration and carries no Product truth', () => {
    const locale = productLocale('ar', 'RTL');
    // No Session, no position, no camera, no inspection, no act — four fields and nothing else.
    expect(Object.keys(locale).sort()).toEqual(['direction', 'language', 'numbering', 'region']);
    expect(Object.isFrozen(locale)).toBe(true);
  });
});
