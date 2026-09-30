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
      .toEqual({ kind: 'CORRECT', previous: 'ساكن في أكتوبر دلوقتي', replacement: 'أنا ساكن في طنطا', copula: false });
    expect(interpretMemoryControl("I don't live in October anymore, I live in Tanta."))
      .toEqual({ kind: 'CORRECT', previous: 'live in October', replacement: 'I live in Tanta', copula: false });
    expect(interpretMemoryControl("I'm not a student anymore, I'm an engineer"))
      .toEqual({ kind: 'CORRECT', previous: 'a student', replacement: "I'm an engineer", copula: true });
    // «بس» opening the second clause is not part of the new statement.
    expect(interpretMemoryControl('أنا مش بحب الشغل ده، بس لازم أروح')).toEqual({ kind: 'CORRECT', previous: 'بحب الشغل ده', replacement: 'أنا لازم أروح', copula: false });
  });

  it('forget: anchored to Memory is EXPLICIT; unanchored words are SOFT and only count on a full match', () => {
    expect(interpretMemoryControl('Forget about work, let us talk about movies')).toEqual({ kind: 'FORGET', target: 'work, let us talk about movies', strength: 'SOFT' });
    expect(interpretMemoryControl('انسى إني بحب المكان ده.')).toEqual({ kind: 'FORGET', target: 'إني بحب المكان ده', strength: 'EXPLICIT' });
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
    // Security / correctness review of W3-MEGA-M: watch-out, conversation references, habits, other people.
    'خلي بالك إن الطريق زحمة النهارده', 'Remember that movie I told you about', 'remember I told you about my sister',
    'I want to sleep better and stop relying on coffee', 'هو قالي، متعتمدش على حد', 'متبنيش آمال كبيرة على الشغل ده',
    'انسى الموضوع ده', 'Forget it, never mind', 'forget it, let us move on',
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
    // Pointing is a yes (asked again when there are several options); a verb only repeats the request.
    ['that one', { type: 'YES' }],
    ['it is this one', { type: 'YES' }],
    ['انسى التانية', { type: 'OPTION', index: 1 }],
    ['forget the second one', { type: 'OPTION', index: 1 }],
    ['I mean the first', { type: 'OPTION', index: 0 }],
  ])('%s', (content, expected) => {
    expect(readClarificationAnswer(content)).toEqual(expected);
  });

  it('longer text or a question is not an answer', () => {
    expect(readClarificationAnswer('I was thinking about what we discussed yesterday and the day before')).toBeNull();
    expect(readClarificationAnswer('ليه بتسأل ده كله يعني؟')).toBeNull();
    expect(readClarificationAnswer('تاني؟')).toBeNull();
  });
});
