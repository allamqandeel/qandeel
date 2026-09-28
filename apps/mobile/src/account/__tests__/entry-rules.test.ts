/** W1B-01 — the account entry's local rules. */
import * as account from '..';

const { canonicalName, isPlausibleEmail, judgeLoginId, normalizeEmailCode } = account;

describe('the Login ID grammar is migration 0123’s and the API’s', () => {
  it('accepts the legal shapes and returns the canonical lowercase form', () => {
    for (const [typed, canonical] of [
      ['abc', 'abc'],
      ['Mohamed.Allam87', 'mohamed.allam87'],
      ['a.b-c_d', 'a.b-c_d'],
      ['007', '007'],
      [' spaced.out ', 'spaced.out'],
      ['a'.repeat(30), 'a'.repeat(30)],
    ]) {
      expect(judgeLoginId(typed)).toEqual({ kind: 'WELL_FORMED', canonical });
    }
  });

  it('tells an empty Login ID from a malformed one, because each has its own approved sentence', () => {
    expect(judgeLoginId('')).toEqual({ kind: 'EMPTY' });
    expect(judgeLoginId('   ')).toEqual({ kind: 'EMPTY' });
    for (const malformed of ['ab', 'a'.repeat(31), '.abc', 'abc.', '-abc', 'ab..cd', 'ab_-cd', 'ab cd', 'abc@def', 'ahmed!', String.fromCodePoint(0x645, 0x62d, 0x645, 0x62f)]) {
      expect(judgeLoginId(malformed)).toEqual({ kind: 'MALFORMED' });
    }
  });
});

describe('Name and Email', () => {
  it('the Name is trimmed exactly as it is stored', () => {
    expect(canonicalName('  Mona Ali  ')).toBe('Mona Ali');
    expect(canonicalName('   ')).toBe('');
  });

  it('an Email is only judged implausible when it cannot be one; the provider decides the rest', () => {
    for (const plausible of ['a@b.co', ' reader@example.test ', 'first.last+tag@sub.domain.org']) expect(isPlausibleEmail(plausible)).toBe(true);
    for (const implausible of ['', 'reader', 'reader@', '@example.test', 'reader@example', 'two words@example.test']) expect(isPlausibleEmail(implausible)).toBe(false);
  });
});

describe('the 6-digit code', () => {
  it('keeps digits only, at most six, and reads Arabic-Indic and Extended Arabic-Indic digits as digits', () => {
    expect(normalizeEmailCode('123456')).toBe('123456');
    expect(normalizeEmailCode('123 456 789')).toBe('123456');
    expect(normalizeEmailCode('12a3-4')).toBe('1234');
    const arabicIndic = Array.from({ length: 6 }, (_, i) => String.fromCodePoint(0x0661 + i)).join('');
    const extended = Array.from({ length: 3 }, (_, i) => String.fromCodePoint(0x06f7 + i)).join('');
    expect(normalizeEmailCode(arabicIndic)).toBe('123456');
    expect(normalizeEmailCode(`0${extended}`)).toBe('0789');
  });

  it('no local rule judges a provider-rejected code expired: there is no lifetime clock to judge it by', () => {
    expect(Object.keys(account)).not.toContain('judgeRejectedCode');
    expect(Object.keys(account)).not.toContain('EMAIL_CODE_LIFETIME_MS');
  });
});
