import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_INTERACTION_PREFERENCES, type InteractionPreferences } from '../interaction-preferences/interaction-preferences.types';
import { interpretExplicitReplyLanguageRequest } from '../interaction-preferences/interaction-preference-command.interpreter';
import { MIN_SCRIPT_LETTERS, resolveConversationLocale, scriptLocaleOf } from './conversation-turn-locale';

const withLanguage = (replyLanguage: InteractionPreferences['replyLanguage']): InteractionPreferences => ({ ...DEFAULT_INTERACTION_PREFERENCES, replyLanguage });
const resolve = (currentUserContent: string, preferences = DEFAULT_INTERACTION_PREFERENCES) => resolveConversationLocale({ currentUserContent, preferences });

describe('ACE-01 WP2 — the conservative, deterministic conversation locale', () => {
  it.each([
    ['إزيك يا قنديل؟', 'ar'],
    ['شو رأيك أعمل بهاد الوضع؟', 'ar'],
    ['أبي أشوف حل بس ما أدري من وين أبدأ', 'ar'],
    ['السَّلامُ عَلَيْكُم، ١٢٣', 'ar'],
    ['Hey Qandeel, good morning.', 'en'],
    ['I made a small mistake at work and feel silly.', 'en'],
  ] as const)('a single reliable script: «%s» → %s', (text, locale) => {
    expect(scriptLocaleOf(text)).toBe(locale);
  });

  it.each([
    ['mixed Arabic and Latin', 'I sent the email لمديري'],
    ['an Arabic sentence with a Latin brand', 'اشتريت iPhone جديد'],
    ['Arabizi (Latin letters with digits as Arabic letters)', '3amel eh ya 7abibi'],
    ['Persian letters outside the core Arabic letters', 'سلام، چطوری؟'],
    ['accented Latin', 'Ça va très bien'],
    ['another script', 'Привет, как дела'],
    ['too few letters', 'ok'],
    ['too few Arabic letters', 'اه'],
    ['no letters at all', '😂👍 123 ...'],
    ['empty', ''],
  ])('uncertain → und: %s', (_name, text) => {
    expect(scriptLocaleOf(text)).toBe('und');
  });

  it('never claims a dialect: every Arabic dialect is the language `ar`, and the resolver only ever returns ar | en | und', () => {
    for (const text of ['إزيك عامل إيه', 'شو أخبارك', 'شلونك', 'كيداير لاباس']) expect(resolve(text)).toBe('ar');
    expect(MIN_SCRIPT_LETTERS).toBe(3);
  });

  it('precedence: an explicit current request > the durable preference > the script indication > und', () => {
    // Explicit request in the current message wins over the durable preference, in both directions.
    expect(resolve('answer in English', withLanguage('EGYPTIAN_ARABIC'))).toBe('en');
    expect(resolve('كلمني بالمصري', withLanguage('ENGLISH'))).toBe('ar');
    expect(resolve('رد عليا بالانجليزي', withLanguage('LEVANTINE_ARABIC'))).toBe('en');
    // Otherwise the durable reply language decides, whatever the script of this message.
    expect(resolve('ok', withLanguage('GULF_ARABIC'))).toBe('ar');
    expect(resolve('صباح الخير', withLanguage('ENGLISH'))).toBe('en');
    // Otherwise the conservative script indication; otherwise und.
    expect(resolve('صباح الخير')).toBe('ar');
    expect(resolve('ok')).toBe('und');
  });

  it('only a WHOLE-message explicit language request counts; «بالعربي» names no variety and a request inside a sentence is not one', () => {
    expect(interpretExplicitReplyLanguageRequest('answer in English')).toBe('ENGLISH');
    expect(interpretExplicitReplyLanguageRequest('من فضلك كلمني بالشامي')).toBe('LEVANTINE_ARABIC');
    expect(interpretExplicitReplyLanguageRequest('دايمًا رد عليا بالفصحى')).toBe('MODERN_STANDARD_ARABIC');
    expect(interpretExplicitReplyLanguageRequest('خلاص قول لي بالعربي')).toBeNull();
    expect(interpretExplicitReplyLanguageRequest('can you answer in English?')).toBeNull();
    expect(interpretExplicitReplyLanguageRequest('I told him to answer in English yesterday')).toBeNull();
    expect(interpretExplicitReplyLanguageRequest('keep it short')).toBeNull();
    // Mixed scripts stay und unless an explicit request decides.
    expect(resolve('خلاص قول لي in English')).toBe('und');
  });

  it('is pure and provider-neutral: no I/O, no model, no clock, no randomness, no tone vocabulary', () => {
    const source = readFileSync(join(__dirname, 'conversation-turn-locale.ts'), 'utf8');
    const imports = [...source.matchAll(/from '([^']+)'/gu)].map(([, path]) => path);
    expect(imports.sort()).toEqual([
      '../interaction-preferences/interaction-preference-command.interpreter',
      '../interaction-preferences/interaction-preferences.types',
    ]);
    expect(source).not.toMatch(/fetch\(|await |Date\.|Math\.random|ModelRouter|process\.env/u);
    expect(source).not.toMatch(/(?:warm|serious|playful|sad|happy|stress|emotion|sentiment)/iu);
    expect(resolve('صباح الخير')).toBe(resolve('صباح الخير'));
  });
});
