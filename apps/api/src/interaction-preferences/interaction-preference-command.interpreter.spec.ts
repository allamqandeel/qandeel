import { interpretInteractionPreferenceCommand, interpretLegacyInteractionPreference } from './interaction-preference-command.interpreter';

describe('IP-IMP-01 — the deterministic durable interaction-preference command grammar', () => {
  it.each([
    // All seven approved reply languages / dialects, Arabic and English, with the durable marker anywhere.
    ['كلمني دايمًا بالمصري', 'REPLY_LANGUAGE', 'EGYPTIAN_ARABIC', 'ar'],
    ['من هنا ورايح رد عليّ بالفصحى', 'REPLY_LANGUAGE', 'MODERN_STANDARD_ARABIC', 'ar'],
    ['اتكلم معايا بالشامي من هنا ورايح', 'REPLY_LANGUAGE', 'LEVANTINE_ARABIC', 'ar'],
    ['بعد كده كلّمني باللهجة الخليجية', 'REPLY_LANGUAGE', 'GULF_ARABIC', 'ar'],
    ['دائمًا كلمني بالمغاربي', 'REPLY_LANGUAGE', 'MAGHREBI_ARABIC', 'ar'],
    ['لو سمحت دايما كلمني بالإنجليزي', 'REPLY_LANGUAGE', 'ENGLISH', 'ar'],
    ['Always speak to me in Egyptian Arabic.', 'REPLY_LANGUAGE', 'EGYPTIAN_ARABIC', 'en'],
    ['From now on, reply in Modern Standard Arabic', 'REPLY_LANGUAGE', 'MODERN_STANDARD_ARABIC', 'en'],
    ['always talk to me in Levantine Arabic', 'REPLY_LANGUAGE', 'LEVANTINE_ARABIC', 'en'],
    ['going forward answer in Gulf Arabic', 'REPLY_LANGUAGE', 'GULF_ARABIC', 'en'],
    ['Please always respond in Maghrebi Arabic', 'REPLY_LANGUAGE', 'MAGHREBI_ARABIC', 'en'],
    ['from now on speak to me in English', 'REPLY_LANGUAGE', 'ENGLISH', 'en'],
    // Reply length.
    ['دايمًا اختصر', 'REPLY_LENGTH', 'ALWAYS_BRIEF', 'ar'],
    ['من هنا ورايح خلي ردودك مختصرة', 'REPLY_LENGTH', 'ALWAYS_BRIEF', 'ar'],
    ['From now on, keep your replies short.', 'REPLY_LENGTH', 'ALWAYS_BRIEF', 'en'],
    ['always be brief', 'REPLY_LENGTH', 'ALWAYS_BRIEF', 'en'],
    // Humour: welcome / declined.
    ['من هنا ورايح عادي تهزر معايا', 'HUMOUR', 'WELCOME', 'ar'],
    ['دايمًا متهزرش معايا', 'HUMOUR', 'DECLINED', 'ar'],
    ['بعد كده بلاش هزار', 'HUMOUR', 'DECLINED', 'ar'],
    ['from now on feel free to joke with me', 'HUMOUR', 'WELCOME', 'en'],
    ['never joke with me', 'HUMOUR', 'DECLINED', 'en'],
    ['from now on, no jokes', 'HUMOUR', 'DECLINED', 'en'],
    // Explanation style.
    ['دايمًا اشرحلي ببساطة', 'EXPLANATION_STYLE', 'SIMPLER', 'ar'],
    ['من هنا ورايح ادخل في الموضوع على طول', 'EXPLANATION_STYLE', 'DIRECT', 'ar'],
    ['دايمًا اشرحلي ببساطة وبشكل مباشر', 'EXPLANATION_STYLE', 'SIMPLER_AND_DIRECT', 'ar'],
    ['always explain things simply', 'EXPLANATION_STYLE', 'SIMPLER', 'en'],
    ['from now on, get straight to the point', 'EXPLANATION_STYLE', 'DIRECT', 'en'],
    ['always be simple and direct', 'EXPLANATION_STYLE', 'SIMPLER_AND_DIRECT', 'en'],
    // Explicit reset to Automatic: names the stored preference, needs no durable marker.
    ['رجّع طول الرد للتلقائي', 'REPLY_LENGTH', 'DEFAULT', 'ar'],
    ['رجّع اللغة واللهجة للتلقائي', 'REPLY_LANGUAGE', 'DEFAULT', 'ar'],
    ['خلي الفكاهة تلقائي', 'HUMOUR', 'DEFAULT', 'ar'],
    ['ارجع طريقة الشرح إلى التلقائي', 'EXPLANATION_STYLE', 'DEFAULT', 'ar'],
    ['reset my reply language', 'REPLY_LANGUAGE', 'DEFAULT', 'en'],
    ['set humour back to automatic', 'HUMOUR', 'DEFAULT', 'en'],
  ])('recognises the durable command %s', (content, field, value, language) => {
    expect(interpretInteractionPreferenceCommand(content)).toEqual({ field, value, language });
  });

  it.each([
    // TEMPORARY requests: no durable marker, so never a command (never stored; honoured in that conversation only).
    'كلمني بالمصري', 'كلّمني بالمصري.', 'المرة دي اشرح بالتفصيل', 'اختصر', 'رد عليا بالفصحى', 'answer in English',
    'Speak to me in Egyptian Arabic.', 'be brief', 'this time, keep it short', 'explain things simply',
    'كلمني بالمصري المرة دي', 'for now, speak to me in English', 'كلمني بالمصري دلوقتي',
    // A variety the closed grammar does not name exactly is never guessed.
    'كلمني دايمًا بالعربي', 'always speak to me in Arabic', 'دايمًا كلمني باللبناني',
    // Questions, negations, longer messages and unrelated text are ordinary conversation.
    'ممكن تكلمني بالمصري دايمًا؟', 'can you always speak to me in English?', "don't always be brief",
    'دايمًا كلمني بالمصري وقولي رأيك في الموضوع', 'I always speak to my mother in Egyptian Arabic', 'دايمًا', 'always', '',
    'أنا دايمًا بحب الردود المختصرة', 'remember that I like short answers',
  ])('is not a command: %s', (content) => {
    expect(interpretInteractionPreferenceCommand(content)).toBeNull();
  });

  it('never throws and refuses an over-long message', () => {
    expect(interpretInteractionPreferenceCommand('دايمًا اختصر '.repeat(40))).toBeNull();
    expect(interpretInteractionPreferenceCommand(undefined as never)).toBeNull();
  });

  it.each([
    // The pre-IP-IMP-01 capture templates, as stored.
    ['Speak to me in Egyptian Arabic.', { field: 'REPLY_LANGUAGE', value: 'EGYPTIAN_ARABIC' }],
    ['Speak to me in English.', { field: 'REPLY_LANGUAGE', value: 'ENGLISH' }],
    ['كلمني بالمصري.', { field: 'REPLY_LANGUAGE', value: 'EGYPTIAN_ARABIC' }],
    ['رد عليّ بالفصحى.', { field: 'REPLY_LANGUAGE', value: 'MODERN_STANDARD_ARABIC' }],
    ['رد عليا باختصار.', { field: 'REPLY_LENGTH', value: 'ALWAYS_BRIEF' }],
    ['Speak to me in Arabic.', null],
    ['كلمني براحة.', null],
    ['Speak to me in a calm voice.', null],
  ])('reads the legacy Memory %s exactly or not at all', (content, expected) => {
    expect(interpretLegacyInteractionPreference(content)).toEqual(expected);
  });
});
