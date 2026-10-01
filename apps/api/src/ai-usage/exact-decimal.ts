// AI-COST-01 - exact decimal arithmetic for money and Credits.
//
// A JavaScript number is a binary floating-point value: 0.1 + 0.2 !== 0.3, and a sub-cent per-token price multiplied
// by millions of tokens drifts. Money in QANDEEL is therefore never a `number`. A decimal here is an exact
// (BigInt units, scale) pair - the value is units x 10^-scale - and the only operations are the ones the formulas need:
// addition, multiplication and an explicit rounding. There is no division, so no repeating fraction can arise.
//
// The database is the accounting authority and computes with PostgreSQL `numeric`; this module mirrors it exactly so
// the simulator reproduces a stored rating digit for digit.

export interface ExactDecimal {
  readonly units: bigint;
  readonly scale: number;
}

const DECIMAL_TEXT = /^(-?)([0-9]+)(?:\.([0-9]+))?$/u;
const MAX_SCALE = 40;

/** Parses a plain decimal string ("0.15", "3", "-2.5"). Exponents, spaces and `number` values are refused. */
export function parseExactDecimal(text: string): ExactDecimal {
  if (typeof text !== 'string') throw new TypeError('An exact decimal is written as a string, never a number.');
  const match = DECIMAL_TEXT.exec(text);
  if (!match) throw new RangeError(`Not a plain decimal: ${JSON.stringify(text)}`);
  const fraction = match[3] ?? '';
  if (fraction.length > MAX_SCALE) throw new RangeError('Too many decimal places.');
  const magnitude = BigInt(`${match[2]}${fraction}`);
  return normalize({ units: match[1] === '-' ? -magnitude : magnitude, scale: fraction.length });
}

/** An exact decimal from a whole-number quantity (token counts). */
export function exactInteger(value: number | bigint): ExactDecimal {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new RangeError('Not a safe whole number.');
  return { units: BigInt(value), scale: 0 };
}

export function addExact(left: ExactDecimal, right: ExactDecimal): ExactDecimal {
  const scale = Math.max(left.scale, right.scale);
  return normalize({ units: rescaleUnits(left, scale) + rescaleUnits(right, scale), scale });
}

export function multiplyExact(left: ExactDecimal, right: ExactDecimal): ExactDecimal {
  return normalize({ units: left.units * right.units, scale: left.scale + right.scale });
}

/** Multiplies by 10^-exponent exactly (a price basis of 1, 1 000 or 1 000 000 units). */
export function shiftExact(value: ExactDecimal, exponent: number): ExactDecimal {
  if (!Number.isSafeInteger(exponent) || exponent < 0) throw new RangeError('Invalid shift.');
  return normalize({ units: value.units, scale: value.scale + exponent });
}

export type ExactRoundingMode = 'CEILING' | 'FLOOR' | 'HALF_UP';

/** Rounds a NON-NEGATIVE decimal to `scale` places, exactly as migration 0135's Credit formula does. */
export function roundExact(value: ExactDecimal, scale: number, mode: ExactRoundingMode): ExactDecimal {
  if (value.units < 0n) throw new RangeError('Only non-negative amounts are rounded.');
  if (value.scale <= scale) return value;
  const divisor = 10n ** BigInt(value.scale - scale);
  const quotient = value.units / divisor;
  const remainder = value.units % divisor;
  let units = quotient;
  if (mode === 'CEILING' && remainder > 0n) units += 1n;
  if (mode === 'HALF_UP' && remainder * 2n >= divisor) units += 1n;
  return normalize({ units, scale });
}

export function compareExact(left: ExactDecimal, right: ExactDecimal): -1 | 0 | 1 {
  const scale = Math.max(left.scale, right.scale);
  const a = rescaleUnits(left, scale);
  const b = rescaleUnits(right, scale);
  return a === b ? 0 : a < b ? -1 : 1;
}

/** The canonical text: no exponent, no trailing fractional zeros ("0.00105", "12", "0"). */
export function formatExact(value: ExactDecimal): string {
  const negative = value.units < 0n;
  const digits = (negative ? -value.units : value.units).toString().padStart(value.scale + 1, '0');
  const whole = digits.slice(0, digits.length - value.scale);
  const fraction = digits.slice(digits.length - value.scale);
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

/** The same value written with exactly `scale` places (for display of a rounded Credit amount). */
export function formatExactAtScale(value: ExactDecimal, scale: number): string {
  if (value.scale > scale) throw new RangeError('Round before formatting at a smaller scale.');
  const units = rescaleUnits(value, scale);
  const negative = units < 0n;
  const digits = (negative ? -units : units).toString().padStart(scale + 1, '0');
  const whole = digits.slice(0, digits.length - scale);
  const fraction = digits.slice(digits.length - scale);
  return `${negative ? '-' : ''}${whole}${scale > 0 ? `.${fraction}` : ''}`;
}

function rescaleUnits(value: ExactDecimal, scale: number): bigint {
  return value.units * 10n ** BigInt(scale - value.scale);
}

function normalize(value: ExactDecimal): ExactDecimal {
  let { units, scale } = value;
  while (scale > 0 && units % 10n === 0n) {
    units /= 10n;
    scale -= 1;
  }
  return { units, scale };
}
