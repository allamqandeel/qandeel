import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_INTERACTION_PREFERENCES, type InteractionPreferences } from '../interaction-preferences/interaction-preferences.types';
import { interpretExplicitReplyLanguageRequest, interpretInteractionPreferenceCommand } from '../interaction-preferences/interaction-preference-command.interpreter';
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

  // Review R1 — an explicit TEMPORARY language request in natural form outranks the durable preference in `locale`.
  it('R1: a natural temporary request outranks a conflicting durable reply language, in both directions', () => {
    expect(resolve('Can you answer in English?', withLanguage('EGYPTIAN_ARABIC'))).toBe('en');
    expect(resolve('خلاص قول لي بالعربي', withLanguage('ENGLISH'))).toBe('ar');
    expect(resolve('could you please reply in English for now', withLanguage('GULF_ARABIC'))).toBe('en');
    expect(resolve("Let's switch to Arabic", withLanguage('ENGLISH'))).toBe('ar');
  });

  it.each([
    ['Can you answer in English?', 'en'],
    ['could you please reply in English for now', 'en'],
    ['ok, answer in English this time', 'en'],
    ['switch to English please', 'en'],
    ["let's talk in Arabic", 'ar'],
    ['can we continue in Arabic?', 'ar'],
    ['answer in English', 'en'],
    ['from now on answer in English', 'en'],
    ['خلاص قول لي بالعربي', 'ar'],
    ['طب كلمني بالعربي المرة دي', 'ar'],
    ['ممكن ترد عليا بالإنجليزي؟', 'en'],
    ['رد بالانجليزي بقى', 'en'],
    ['من فضلك كلمني بالشامي', 'ar'],
    ['دايمًا رد عليا بالفصحى', 'ar'],
  ] as const)('R1: «%s» is an explicit language request → %s', (message, language) => {
    expect(interpretExplicitReplyLanguageRequest(message)).toBe(language);
  });

  it.each([
    ['negation (English)', "don't answer in English"],
    ['negation inside a request question', 'can you not answer in English?'],
    ['negation (Egyptian)', 'متكلمنيش بالانجليزي'],
    ['negation (wish)', 'مش عايزك ترد بالانجليزي'],
    ['refusal', 'بلاش تكلمني بالانجليزي'],
    ['quotation (English)', '"answer in English"'],
    ['quotation (Arabic guillemets)', '«كلمني بالانجليزي»'],
    ['reported speech', 'قال لي "رد بالانجليزي"'],
    ['inside a longer message', 'I told him to answer in English yesterday'],
    ['a capability question, not a request', 'Do you speak English?'],
    ['an ambiguous bare capability question', 'Can you speak English?'],
    ['a complaint question', 'ليه بتكلمني بالانجليزي؟'],
    ['an unphrased question', 'answer in English?'],
    ['ambiguous «ما» (invitation or negation)', 'ما تكلمني بالانجليزي'],
    ['mixed scripts', 'خلاص قول لي in English'],
    ['a different instruction', 'keep it short'],
    ['a translation request', 'what is this in English'],
  ])('R1: not an explicit language request → null: %s', (_name, message) => {
    expect(interpretExplicitReplyLanguageRequest(message)).toBeNull();
  });

  it('R1: an unrecognised or ambiguous message leaves the durable preference in charge; mixed scripts stay und', () => {
    expect(resolve('Do you speak English?', withLanguage('EGYPTIAN_ARABIC'))).toBe('ar');
    expect(resolve("don't answer in English", withLanguage('EGYPTIAN_ARABIC'))).toBe('ar');
    expect(resolve('«كلمني بالانجليزي»', withLanguage('LEVANTINE_ARABIC'))).toBe('ar');
    expect(resolve('مش عايزك ترد بالعربي', withLanguage('ENGLISH'))).toBe('en');
    expect(resolve('خلاص قول لي in English')).toBe('und');
  });

  it('R1: a temporary request is never a durable command, so it can never be stored', () => {
    for (const message of [
      'Can you answer in English?', 'خلاص قول لي بالعربي', 'could you please reply in English for now', "let's talk in Arabic",
      'switch to English', 'ممكن ترد عليا بالإنجليزي؟', 'طب كلمني بالعربي المرة دي', 'answer in English', 'كلمني بالمصري',
    ]) expect(interpretInteractionPreferenceCommand(message)).toBeNull();
    // The durable grammar is unchanged: a marked command is still a command.
    expect(interpretInteractionPreferenceCommand('from now on answer in English')).toEqual({ field: 'REPLY_LANGUAGE', value: 'ENGLISH', language: 'en' });
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
