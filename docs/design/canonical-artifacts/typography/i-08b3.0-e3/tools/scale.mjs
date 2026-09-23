/**
 * I-08B3.0-E3 - Android 14+ NONLINEAR font scaling.
 *
 * The brief forbids simulating 200% by multiplying every dimension by 2, because that is
 * not what the platform does. Android 14 (API 34) replaced linear sp->px scaling with a
 * lookup-and-interpolate curve in which SMALL text grows much more than LARGE text.
 *
 * The tables below are transcribed from AOSP
 *   frameworks/base/core/java/android/content/res/FontScaleConverterFactory.java
 * and the lookup rule from
 *   frameworks/base/core/java/android/content/res/FontScaleConverterImpl.java
 * read at source during the reference gate. They are not reconstructed from memory and not
 * taken from a blog.
 *
 * Consequence worth stating up front: at 200% a 12sp label doubles (12 -> 24) while a 30sp
 * heading grows by a quarter (30 -> 38). Type hierarchy COMPRESSES as text scales up. That
 * is deliberate platform behaviour, not a defect, and any type contract has to survive it.
 */

const FROM_SP = [8, 10, 12, 14, 18, 20, 24, 30, 100];

/** scale key -> toDp array, aligned to FROM_SP. Verbatim from FontScaleConverterFactory. */
const TABLES = {
  1.05: [8.4, 10.5, 12.6, 14.8, 18.6, 20.6, 24.4, 30, 100],
  1.10: [8.8, 11, 13.2, 15.6, 19.2, 21.2, 24.8, 30, 100],
  1.15: [9.2, 11.5, 13.8, 16.4, 19.8, 21.8, 25.2, 30, 100],
  1.20: [9.6, 12, 14.4, 17.2, 20.4, 22.4, 25.6, 30, 100],
  1.30: [10.4, 13, 15.6, 18.8, 21.6, 23.6, 26.4, 30, 100],
  1.50: [12, 15, 18, 22, 24, 26, 28, 30, 100],
  1.80: [14.4, 18, 21.6, 24.4, 27.6, 30.8, 32.8, 34.8, 100],
  2.00: [16, 20, 24, 26, 30, 34, 36, 38, 100],
};
const KEYS = Object.keys(TABLES).map(Number).sort((a, b) => a - b);

const lerp = (a, b, t) => a + (b - a) * t;

/** FontScaleConverterFactory.forScale: exact key, else lerp between the two nearest tables. */
export function tableForScale(scale) {
  if (TABLES[scale]) return TABLES[scale].slice();
  if (scale <= KEYS[0] || scale >= KEYS[KEYS.length - 1]) return null; // outside -> linear
  let lo = KEYS[0], hi = KEYS[KEYS.length - 1];
  for (const k of KEYS) { if (k <= scale) lo = k; }
  for (let i = KEYS.length - 1; i >= 0; i--) { if (KEYS[i] >= scale) hi = KEYS[i]; }
  const t = (scale - lo) / (hi - lo);
  return TABLES[lo].map((v, i) => lerp(v, TABLES[hi][i], t));
}

/**
 * FontScaleConverterImpl.convertSpToDp / lookupAndInterpolate.
 *  - inside the table: interpolate between the bracketing entries
 *  - below the first entry (8sp): interpolate from 0
 *  - above the last entry (100sp): apply the final entry's ratio
 */
export function spToDp(sp, scale) {
  if (scale === 1) return sp;
  const toDp = tableForScale(scale);
  if (!toDp) return sp * scale; // beyond the table bounds Android falls back to linear
  const sign = Math.sign(sp) || 1;
  const v = Math.abs(sp);
  if (v < FROM_SP[0]) return sign * lerp(0, toDp[0], v / FROM_SP[0]);
  for (let i = 0; i < FROM_SP.length - 1; i++) {
    if (v >= FROM_SP[i] && v <= FROM_SP[i + 1]) {
      const t = (v - FROM_SP[i]) / (FROM_SP[i + 1] - FROM_SP[i]);
      return sign * lerp(toDp[i], toDp[i + 1], t);
    }
  }
  const last = FROM_SP.length - 1;
  return sign * v * (toDp[last] / FROM_SP[last]);
}

/**
 * Scale one role. Two leading models, because which one the implementation picks decides
 * whether the system survives 200% - and the proposed contract does not say which it is.
 *
 *   'sp'  - the leading is an absolute sp value and goes through the SAME curve as the size.
 *           This is what you get from `lineHeight = 50.sp` or React Native `lineHeight: 50`.
 *   'mul' - the leading is a unitless multiplier of the size, so the ratio is preserved.
 *           This is what you get from CSS `line-height: 1.5625` or Compose `TextUnit.Em`.
 */
export function scaleRole(role, scale, leadingModel = 'mul') {
  const size = spToDp(role.size, scale);
  const ratio0 = role.leading / role.size;
  const leading = leadingModel === 'sp' ? spToDp(role.leading, scale) : size * ratio0;
  return {
    size: round1(size),
    leading: round1(leading),
    ratio: +(leading / size).toFixed(3),
    ratio0: +ratio0.toFixed(3),
    sizeFactor: +(size / role.size).toFixed(3),
  };
}

const round1 = (v) => Math.round(v * 10) / 10;

/** Self-check: anchor values read straight off the AOSP tables. Run on import. */
function selfCheck() {
  const cases = [
    [12, 2.00, 24], [30, 2.00, 38], [8, 2.00, 16], [24, 2.00, 36],
    [12, 1.30, 15.6], [30, 1.30, 30], [18, 1.50, 24],
    [16, 2.00, 28], // between 14->26 and 18->30
    [17, 2.00, 29], // between 14->26 and 18->30
  ];
  for (const [sp, s, want] of cases) {
    const got = spToDp(sp, s);
    if (Math.abs(got - want) > 0.051) {
      throw new Error(`scale.mjs self-check FAILED: spToDp(${sp}, ${s}) = ${got}, expected ${want}`);
    }
  }
  // 160% is not a table key; it must interpolate between 1.50 and 1.80 at t=1/3.
  const g = spToDp(12, 1.60);
  const want = 18 + (21.6 - 18) / 3;
  if (Math.abs(g - want) > 0.001) throw new Error(`scale.mjs self-check FAILED: 160% interpolation ${g} != ${want}`);
}
selfCheck();

export { FROM_SP, TABLES };
