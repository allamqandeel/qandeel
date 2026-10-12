import { normalizeArabicComparison } from '../memory/arabic-text';
import type { InteractionPreferenceCommand, InteractionPreferenceField, InteractionPreferenceValue } from './interaction-preferences.types';

// IP-IMP-01 (WP2) — the deterministic recognizer of an EXPLICIT DURABLE interaction-preference command.
//
// Pure and CPU-only: no I/O, no model, no classifier. The whole message must be the command (anchored patterns over the
// shared comparison normalizer), so a request inside a longer message, a question, a negation or anything this closed
// grammar does not name is NOT a command and stays ordinary conversation. A command must carry an explicit durable marker
// («دايمًا», «من هنا ورايح», «بعد كده», "always", "from now on" …); a reset names the stored preference and "Automatic".
// A TEMPORARY request («كلمني بالمصري», «المرة دي اشرح بالتفصيل», "answer in English") carries no durable marker, so it
// is never a command: it is honoured in that conversation as ordinary history and is never stored.
//
// The patterns are written in the normalizer's output form: no harakat or tatweel, ا for أ / إ / آ, ي for ى, ه for ة,
// ASCII lower case, terminal punctuation removed.

const DURABLE_MARKERS = [
  'دايما', 'دائما', 'من هنا ورايح', 'من هنا و رايح', 'من النهارده', 'من دلوقتي', 'من الان ورايح', 'من الان فصاعدا',
  'من الان', 'بعد كده', 'بعد كدا', 'كل مره', 'بشكل دائم',
  'always', 'from now on', 'going forward', 'from here on', 'by default', 'every time', 'permanently',
] as const;

const POLITE = /^(?:لو سمحت|من فضلك|بليز|يا قنديل|قنديل|please|pls|qandeel)\s+|\s+(?:لو سمحت|من فضلك|بليز|please|pls)$/u;

// ------------------------------------------------------------------------------------------------------------------
// Reply language / dialect. Only an exact, named variety; «بالعربي» alone names no variety and is not a command.
// ------------------------------------------------------------------------------------------------------------------
const AR_LANGUAGE_VERB = '(?:ت?كلمني|اتكلم معايا|اتكلم معاي|اتكلم معي|ت?تكلم معي|ت?تحدث معي|ت?رد عليا|ت?رد علي|ت?جاوبني|ت?كتبلي|خلي ردودك|ردودك تكون|ردودك)';
const AR_VARIETIES: ReadonlyArray<readonly [string, InteractionPreferenceValue]> = [
  ['(?:بالمصري|باللهجه المصريه|بالعاميه المصريه|بالعربي المصري)', 'EGYPTIAN_ARABIC'],
  ['(?:بالفصحي|بالعربيه الفصحي|باللغه العربيه الفصحي|بالعربي الفصيح|بالعربي الفصحي|باللغه الفصحي)', 'MODERN_STANDARD_ARABIC'],
  ['(?:بالشامي|باللهجه الشاميه|بالعربي الشامي)', 'LEVANTINE_ARABIC'],
  ['(?:بالخليجي|باللهجه الخليجيه|بالعربي الخليجي)', 'GULF_ARABIC'],
  ['(?:بالمغاربي|باللهجه المغاربيه|بالعربي المغاربي|بالدارجه المغاربيه)', 'MAGHREBI_ARABIC'],
  ['(?:بالانجليزي|بالانجليزيه|باللغه الانجليزيه|بالانجلش|بالانكليزي|بالانكليزيه)', 'ENGLISH'],
];
const EN_LANGUAGE_VERB = '(?:speak|talk|reply|respond|answer|write)(?: to me| me)?';
const EN_VARIETIES: ReadonlyArray<readonly [string, InteractionPreferenceValue]> = [
  ['(?:egyptian arabic|egyptian)', 'EGYPTIAN_ARABIC'],
  ['(?:modern standard arabic|standard arabic|msa|fusha)', 'MODERN_STANDARD_ARABIC'],
  ['(?:levantine arabic|levantine)', 'LEVANTINE_ARABIC'],
  ['(?:gulf arabic|khaleeji)', 'GULF_ARABIC'],
  ['(?:maghrebi arabic|maghrebi)', 'MAGHREBI_ARABIC'],
  ['english', 'ENGLISH'],
];

interface Core { readonly field: InteractionPreferenceField; readonly value: InteractionPreferenceValue; readonly pattern: RegExp }

const SET_CORES: readonly Core[] = [
  ...AR_VARIETIES.map(([variety, value]): Core => ({ field: 'REPLY_LANGUAGE', value, pattern: new RegExp(`^${AR_LANGUAGE_VERB} ${variety}$`, 'u') })),
  ...EN_VARIETIES.map(([variety, value]): Core => ({ field: 'REPLY_LANGUAGE', value, pattern: new RegExp(`^${EN_LANGUAGE_VERB} in ${variety}$`, 'u') })),

  // Reply length.
  { field: 'REPLY_LENGTH', value: 'ALWAYS_BRIEF', pattern: /^(?:خلي|خللي) ردودك (?:مختصره|قصيره)$/u },
  { field: 'REPLY_LENGTH', value: 'ALWAYS_BRIEF', pattern: /^ردودك (?:تكون )?(?:مختصره|قصيره)$/u },
  { field: 'REPLY_LENGTH', value: 'ALWAYS_BRIEF', pattern: /^ت?اختصر(?: في (?:ردودك|الرد|كلامك))?$/u },
  { field: 'REPLY_LENGTH', value: 'ALWAYS_BRIEF', pattern: /^ت?رد(?: عليا)? باختصار$/u },
  { field: 'REPLY_LENGTH', value: 'ALWAYS_BRIEF', pattern: /^خليك مختصر$/u },
  { field: 'REPLY_LENGTH', value: 'ALWAYS_BRIEF', pattern: /^(?:keep|make) (?:your )?(?:replies|answers|responses|it) (?:short|brief|concise)$/u },
  { field: 'REPLY_LENGTH', value: 'ALWAYS_BRIEF', pattern: /^be (?:brief|concise)$/u },
  { field: 'REPLY_LENGTH', value: 'ALWAYS_BRIEF', pattern: /^(?:reply|answer|respond) (?:briefly|concisely)$/u },

  // Humour.
  { field: 'HUMOUR', value: 'WELCOME', pattern: /^(?:عادي|ممكن|براحتك) ت?هزر(?: معايا)?$/u },
  { field: 'HUMOUR', value: 'WELCOME', pattern: /^هزر معايا$/u },
  { field: 'HUMOUR', value: 'WELCOME', pattern: /^الهزار (?:عادي|مسموح)$/u },
  { field: 'HUMOUR', value: 'WELCOME', pattern: /^يمكنك المزاح(?: معي)?$/u },
  { field: 'HUMOUR', value: 'WELCOME', pattern: /^(?:feel free to|you can|you may) (?:joke|use humou?r|be funny)(?: with me)?$/u },
  { field: 'HUMOUR', value: 'WELCOME', pattern: /^(?:humou?r is|jokes are) welcome$/u },
  { field: 'HUMOUR', value: 'DECLINED', pattern: /^(?:ما ?)?تهزرش(?: معايا)?$/u },
  { field: 'HUMOUR', value: 'DECLINED', pattern: /^متهزرش(?: معايا)?$/u },
  { field: 'HUMOUR', value: 'DECLINED', pattern: /^(?:بلاش|من غير|بدون) (?:هزار|فكاهه)$/u },
  { field: 'HUMOUR', value: 'DECLINED', pattern: /^مش عايز هزار$/u },
  { field: 'HUMOUR', value: 'DECLINED', pattern: /^لا تمزح(?: معي)?$/u },
  { field: 'HUMOUR', value: 'DECLINED', pattern: /^(?:don't|do not) (?:joke|use humou?r|make jokes)(?: with me)?$/u },
  { field: 'HUMOUR', value: 'DECLINED', pattern: /^no (?:jokes|humou?r)$/u },

  // Explanation style. The combined forms are listed first.
  { field: 'EXPLANATION_STYLE', value: 'SIMPLER_AND_DIRECT', pattern: /^ت?اشرح(?:لي| لي)? (?:ببساطه|بشكل بسيط) و ?(?:بشكل )?مباشر$/u },
  { field: 'EXPLANATION_STYLE', value: 'SIMPLER_AND_DIRECT', pattern: /^خليك بسيط و ?مباشر$/u },
  { field: 'EXPLANATION_STYLE', value: 'SIMPLER_AND_DIRECT', pattern: /^(?:be|keep it) simple and direct$/u },
  { field: 'EXPLANATION_STYLE', value: 'SIMPLER_AND_DIRECT', pattern: /^explain (?:things )?simply and directly$/u },
  { field: 'EXPLANATION_STYLE', value: 'SIMPLER', pattern: /^ت?اشرح(?:لي| لي)? (?:ببساطه|بشكل ابسط|بشكل بسيط|بطريقه ابسط|بطريقه بسيطه|بلغه بسيطه)$/u },
  { field: 'EXPLANATION_STYLE', value: 'SIMPLER', pattern: /^بسط(?:لي)? (?:الشرح|الكلام)$/u },
  { field: 'EXPLANATION_STYLE', value: 'SIMPLER', pattern: /^خلي شرحك (?:بسيط|ابسط)$/u },
  { field: 'EXPLANATION_STYLE', value: 'SIMPLER', pattern: /^explain (?:things )?(?:simply|more simply|in simple terms|in simpler terms|in plain language)$/u },
  { field: 'EXPLANATION_STYLE', value: 'SIMPLER', pattern: /^keep (?:explanations|it) simple$/u },
  { field: 'EXPLANATION_STYLE', value: 'DIRECT', pattern: /^(?:خليك مباشر|كن مباشرا|خليك دغري)$/u },
  { field: 'EXPLANATION_STYLE', value: 'DIRECT', pattern: /^ادخل في الموضوع(?: علي طول| مباشره)?$/u },
  { field: 'EXPLANATION_STYLE', value: 'DIRECT', pattern: /^(?:من غير|بدون) لف ودوران$/u },
  { field: 'EXPLANATION_STYLE', value: 'DIRECT', pattern: /^(?:be (?:direct|straightforward)|get (?:straight )?to the point|answer directly)$/u },
];

// A durable form that needs no separate marker: "never …" says "from now on" by itself.
const SELF_DURABLE_CORES: readonly Core[] = [
  { field: 'HUMOUR', value: 'DECLINED', pattern: /^never (?:joke|use humou?r|make jokes)(?: with me)?$/u },
];

// ------------------------------------------------------------------------------------------------------------------
// Reset to Automatic: the stored preference is named explicitly, so no durable marker is needed.
// ------------------------------------------------------------------------------------------------------------------
const AR_FIELD_NAMES: ReadonlyArray<readonly [string, InteractionPreferenceField]> = [
  ['طول الرد', 'REPLY_LENGTH'],
  ['(?:اللغه واللهجه|اللغه و اللهجه|لغه الرد|اللغه|اللهجه)', 'REPLY_LANGUAGE'],
  ['(?:الفكاهه|الهزار)', 'HUMOUR'],
  ['(?:طريقه الشرح|الشرح)', 'EXPLANATION_STYLE'],
];
const EN_FIELD_NAMES: ReadonlyArray<readonly [string, InteractionPreferenceField]> = [
  ['(?:reply length|length)', 'REPLY_LENGTH'],
  ['(?:reply language(?: (?:and|&) dialect)?|language(?: (?:and|&) dialect)?|dialect)', 'REPLY_LANGUAGE'],
  ['humou?r', 'HUMOUR'],
  ['(?:explanation style|explanations?)', 'EXPLANATION_STYLE'],
];
const RESET_CORES: readonly Core[] = [
  ...AR_FIELD_NAMES.map(([name, field]): Core => ({
    field, value: 'DEFAULT', pattern: new RegExp(`^(?:رجع|ارجع|رجعلي|خلي) ${name} (?:لل|ل|الي |علي )?(?:ال)?(?:وضع ال)?تلقائي$`, 'u'),
  })),
  ...EN_FIELD_NAMES.map(([name, field]): Core => ({
    field, value: 'DEFAULT', pattern: new RegExp(`^(?:reset (?:my )?${name}(?: (?:back )?to (?:automatic|default))?|set (?:my )?${name} (?:back )?to (?:automatic|default))$`, 'u'),
  })),
];

const ARABIC_LETTER = /[؀-ۿ]/u;
const QUESTION = /[?؟]/u;

/** Normalized for matching only: the comparison normalizer, commas dropped, polite words and vocatives removed. */
function prepare(content: string): string {
  let text = normalizeArabicComparison(content).replace(/[،,]/gu, ' ').replace(/ {2,}/gu, ' ').trim();
  for (let i = 0; i < 4; i += 1) {
    const next = text.replace(POLITE, '').trim();
    if (next === text) break;
    text = next;
  }
  return text;
}

/** The text with ONE durable marker removed, or undefined when it carries none. */
function withoutDurableMarker(text: string): string | undefined {
  for (const marker of DURABLE_MARKERS) {
    const found = new RegExp(`(?:^| )${marker}(?: |$)`, 'u').exec(text);
    if (!found) continue;
    return `${text.slice(0, found.index)} ${text.slice(found.index + found[0].length)}`.replace(/ {2,}/gu, ' ').trim();
  }
  return undefined;
}

function first(cores: readonly Core[], text: string): Core | undefined {
  return cores.find((core) => core.pattern.test(text));
}

/**
 * WP3 — the preference one of the owner's legacy INTERACTION_PREFERENCE Memories states, read with the SAME closed grammar
 * (e.g. the pre-IP-IMP-01 templates «كلمني بالمصري.» / "Speak to me in English."), or null when it names no approved
 * value exactly. It only proposes; nothing is adopted without the owner's explicit choice in the review.
 */
export function interpretLegacyInteractionPreference(content: string): Pick<InteractionPreferenceCommand, 'field' | 'value'> | null {
  if (typeof content !== 'string' || content.length === 0 || content.length > 280 || QUESTION.test(content)) return null;
  const text = prepare(content);
  if (text.length === 0) return null;
  const core = first(SET_CORES, text) ?? first(SELF_DURABLE_CORES, text) ?? (() => {
    const stripped = withoutDurableMarker(text);
    return stripped === undefined ? undefined : first(SET_CORES, stripped);
  })();
  return core ? { field: core.field, value: core.value } : null;
}

/**
 * ACE-01 (WP2) — the reply language / dialect this whole message explicitly asks for, with or without a durable marker
 * («كلمني بالانجليزي», "answer in English"), read with the SAME closed grammar; null for anything else. It stores nothing
 * and is not a command: it only tells the current turn which explicit language request it carries.
 */
export function interpretExplicitReplyLanguageRequest(content: string): InteractionPreferenceValue | null {
  if (typeof content !== 'string' || content.length === 0 || content.length > 200 || QUESTION.test(content)) return null;
  const text = prepare(content);
  if (text.length === 0) return null;
  const languageCores = SET_CORES.filter((core) => core.field === 'REPLY_LANGUAGE');
  const core = first(languageCores, text) ?? (() => {
    const stripped = withoutDurableMarker(text);
    return stripped === undefined ? undefined : first(languageCores, stripped);
  })();
  return core ? core.value : null;
}

/**
 * The explicit durable command this whole message is, or null. Never throws; anything it does not recognise is null.
 */
export function interpretInteractionPreferenceCommand(content: string): InteractionPreferenceCommand | null {
  if (typeof content !== 'string' || content.length === 0 || content.length > 200 || QUESTION.test(content)) return null;
  const language = ARABIC_LETTER.test(content) ? 'ar' : 'en';
  const text = prepare(content);
  if (text.length === 0) return null;

  const reset = first(RESET_CORES, text);
  if (reset) return { field: reset.field, value: reset.value, language };
  const selfDurable = first(SELF_DURABLE_CORES, text);
  if (selfDurable) return { field: selfDurable.field, value: selfDurable.value, language };

  const core = withoutDurableMarker(text);
  if (core === undefined || core.length === 0) return null;
  const set = first(SET_CORES, core);
  return set ? { field: set.field, value: set.value, language } : null;
}
