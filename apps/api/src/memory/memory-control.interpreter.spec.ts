import { interpretMemoryControl, memoryControlLanguage, readClarificationAnswer } from './memory-control.interpreter';

describe('W3-MEGA-M conversational Memory command interpretation', () => {
  it.each([
    'إنت فاكر عني إيه؟',
    'إيه اللي فاكره عني؟',
    'قنديل، انت فاكر عني ايه',
    'فاكر إيه عني؟',
    'What do you remember about me?',
    "what's in your memory about me",
    'Can you tell me what you remember about me?',
  ])('asks what QANDEEL remembers: %s', (content) => {
    expect(interpretMemoryControl(content)).toEqual({ kind: 'INSPECT' });
  });

  it.each([
    ['افتكر إن أحمد عنده امتحان الخميس.', 'أحمد عنده امتحان الخميس'],
    ['افتكر إني بحب القهوة', 'إني بحب القهوة'],
    ['خليك فاكر إن مراتي اسمها سارة', 'مراتي اسمها سارة'],
    ['Remember that my sister Mona lives in Alexandria.', 'my sister Mona lives in Alexandria'],
    ['please remember I prefer short answers', 'I prefer short answers'],
  ])('explicit remember: %s', (content, statement) => {
    expect(interpretMemoryControl(content)).toEqual({ kind: 'REMEMBER', statement });
  });

  it('a correction keeps the old words for resolution and the new words for the successor', () => {
    expect(interpretMemoryControl('أنا مش ساكن في أكتوبر دلوقتي، أنا ساكن في طنطا.'))
      .toEqual({ kind: 'CORRECT', previous: 'ساكن في أكتوبر دلوقتي', replacement: 'أنا ساكن في طنطا' });
    expect(interpretMemoryControl("I don't live in October anymore, I live in Tanta."))
      .toEqual({ kind: 'CORRECT', previous: 'live in October', replacement: 'I live in Tanta' });
    expect(interpretMemoryControl("I'm not a student anymore, I'm an engineer"))
      .toEqual({ kind: 'CORRECT', previous: 'a student', replacement: "I'm an engineer" });
  });

  it('forget: explicit verbs, and the soft «امسح» that only counts when something remembered matches', () => {
    expect(interpretMemoryControl('انسى إني بحب كافيه النيل.')).toEqual({ kind: 'FORGET', target: 'إني بحب كافيه النيل', strength: 'EXPLICIT' });
    expect(interpretMemoryControl('متفتكرش إني بشتغل في البنك تاني')).toEqual({ kind: 'FORGET', target: 'إني بشتغل في البنك', strength: 'EXPLICIT' });
    expect(interpretMemoryControl('امسح موضوع الشغل.')).toEqual({ kind: 'FORGET', target: 'موضوع الشغل', strength: 'SOFT' });
    expect(interpretMemoryControl('امسح من ذاكرتك موضوع الشغل')).toEqual({ kind: 'FORGET', target: 'موضوع الشغل', strength: 'EXPLICIT' });
    expect(interpretMemoryControl('Forget that I like tea')).toEqual({ kind: 'FORGET', target: 'that I like tea', strength: 'EXPLICIT' });
    expect(interpretMemoryControl('Delete the memory about my old job')).toEqual({ kind: 'FORGET', target: 'the memory about my old job', strength: 'EXPLICIT' });
  });

  it('do-not-rely is DISABLE, never FORGET — including «متنساش …، بس متعتمدش …»', () => {
    expect(interpretMemoryControl('متنساش المعلومة، بس متعتمدش عليها معايا.'))
      .toEqual({ kind: 'DISABLE', target: 'معايا', alternateTarget: 'المعلومة' });
    expect(interpretMemoryControl('متعتمدش على إني بحب الشاي')).toEqual({ kind: 'DISABLE', target: 'بحب الشاي' });
    expect(interpretMemoryControl("Keep it, but don't rely on the fact that I like tea"))
      .toEqual({ kind: 'DISABLE', target: 'I like tea', alternateTarget: 'it' });
    expect(interpretMemoryControl("Don't rely on my old address anymore")).toEqual({ kind: 'DISABLE', target: 'my old address anymore' });
  });

  it.each([
    // "never mind", reminders, questions, reported speech, the user themself, and ordinary talk.
    'انسى', 'انساها', 'forget it', 'Forget about it', 'forget that',
    'افتكر تجيب العيش', 'متنساش تكلمني بكرة', 'remember to call mom', 'افتكر إن ده صح؟',
    'Remember what I told you about training every morning?',
    "Don't rely on me", 'متعتمدش عليا', "My boss said don't rely on me", 'مديري قالي متعتمدش عليا',
    'أنا بحب القهوة', 'How are you?', 'I decided to train every morning even though I keep skipping my sessions',
    'أنا مش متأكد، بس أظن إن ده صح؟',
  ])('is ordinary conversation: %s', (content) => {
    expect(interpretMemoryControl(content)).toBeNull();
  });

  it('chooses the reply language from the words, falling back to the earlier turn for digits', () => {
    expect(memoryControlLanguage('امسح موضوع الشغل')).toBe('ar');
    expect(memoryControlLanguage('Forget that I like tea')).toBe('en');
    expect(memoryControlLanguage('2', 'Forget my job')).toBe('en');
    expect(memoryControlLanguage('2', 'امسح موضوع الشغل')).toBe('ar');
  });
});

describe('W3-MEGA-M reply to "which one do you mean?"', () => {
  it.each([
    ['2', { type: 'OPTION', index: 1 }],
    ['التانية', { type: 'OPTION', index: 1 }],
    ['رقم ١', { type: 'OPTION', index: 0 }],
    ['الأولى', { type: 'OPTION', index: 0 }],
    ['the first one', { type: 'OPTION', index: 0 }],
    ['third', { type: 'OPTION', index: 2 }],
    ['أيوه', { type: 'YES' }],
    ['yes', { type: 'YES' }],
    ['هي دي', { type: 'YES' }],
    ['لا', { type: 'NO' }],
    ['ولا واحدة', { type: 'NO' }],
    ['no', { type: 'NO' }],
    ['الاتنين', { type: 'ALL' }],
    ['both', { type: 'ALL' }],
    ['اللي عن البنك', { type: 'WORDS', text: 'اللي عن البنك' }],
  ])('%s', (content, expected) => {
    expect(readClarificationAnswer(content)).toEqual(expected);
  });

  it('longer text or a question is not an answer', () => {
    expect(readClarificationAnswer('I was thinking about what we discussed yesterday and the day before')).toBeNull();
    expect(readClarificationAnswer('ليه بتسأل ده كله يعني؟')).toBeNull();
  });
});
