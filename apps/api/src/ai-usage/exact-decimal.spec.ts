import {
  addExact, compareExact, exactInteger, formatExact, formatExactAtScale, multiplyExact, parseExactDecimal, roundExact, shiftExact,
} from './exact-decimal';

const d = parseExactDecimal;

describe('AI-COST-01 exact decimal', () => {
  it('has no floating-point drift where a JS number does', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(formatExact(addExact(d('0.1'), d('0.2')))).toBe('0.3');
    // A million tokens at a sub-cent price, added a thousand times, stays exact.
    let total = exactInteger(0);
    for (let i = 0; i < 1000; i += 1) total = addExact(total, shiftExact(multiplyExact(exactInteger(1_000_001), d('0.000000123')), 0));
    expect(formatExact(total)).toBe('123.000123');
  });

  it('parses only plain decimal strings and never a number', () => {
    expect(formatExact(d('3'))).toBe('3');
    expect(formatExact(d('3.1400'))).toBe('3.14');
    expect(formatExact(d('-2.50'))).toBe('-2.5');
    for (const bad of ['1e3', ' 1', '1.', '.5', 'NaN', '', '0x10', '1,000']) expect(() => d(bad)).toThrow(RangeError);
    expect(() => parseExactDecimal(0.1 as unknown as string)).toThrow(TypeError);
  });

  it('shifts by a power of ten exactly (price bases 1, 1 000 and 1 000 000)', () => {
    expect(formatExact(shiftExact(d('2.5'), 0))).toBe('2.5');
    expect(formatExact(shiftExact(d('2.5'), 3))).toBe('0.0025');
    expect(formatExact(shiftExact(d('2.5'), 6))).toBe('0.0000025');
  });

  it('rounds CEILING / FLOOR / HALF_UP exactly, never through a float', () => {
    expect(formatExact(roundExact(d('12.341'), 2, 'CEILING'))).toBe('12.35');
    expect(formatExact(roundExact(d('12.349'), 2, 'FLOOR'))).toBe('12.34');
    expect(formatExact(roundExact(d('12.345'), 2, 'HALF_UP'))).toBe('12.35');
    expect(formatExact(roundExact(d('12.344999'), 2, 'HALF_UP'))).toBe('12.34');
    expect(formatExact(roundExact(d('12.3'), 2, 'CEILING'))).toBe('12.3');
    expect(formatExact(roundExact(d('0.0000001'), 0, 'CEILING'))).toBe('1');
    expect(() => roundExact(d('-1.5'), 0, 'CEILING')).toThrow(RangeError);
  });

  it('formats at a fixed scale and compares exactly', () => {
    expect(formatExactAtScale(d('12.3'), 2)).toBe('12.30');
    expect(formatExactAtScale(d('7'), 0)).toBe('7');
    expect(formatExactAtScale(d('0'), 3)).toBe('0.000');
    expect(compareExact(d('0.30'), d('0.3'))).toBe(0);
    expect(compareExact(d('0.31'), d('0.3'))).toBe(1);
    expect(() => exactInteger(1.5)).toThrow(RangeError);
  });
});
