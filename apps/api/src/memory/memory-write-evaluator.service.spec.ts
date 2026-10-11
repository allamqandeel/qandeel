import { MEMORY_IMPORTANCE, MemoryWriteEvaluatorService, memoryDuplicateKeys, normalizeMemoryContent, screenMemoryCapture } from './memory-write-evaluator.service';

describe('MemoryWriteEvaluatorService', () => {
  const evaluator = new MemoryWriteEvaluatorService();
  const now = new Date('2026-08-17T12:00:00.000Z');

  it.each([
    'hello', 'thanks', 'تمام', 'What is the capital of France?', 'Egypt is hot in summer.',
    'أنا متضايق النهارده.', 'الشغل ده هيقتلني.', 'يمكن أنا شخص عصبي.',
    'Maybe I am just a difficult person.', 'He said "I live in Cairo."', 'أعمل إيه لو مديري بيضغط عليا؟',
  ])('skips unsupported, transient, speculative, or third-party content: %s', (content) => {
    expect(evaluator.evaluate(content, now).decision).toBe('SKIP');
  });

  it.each([
    ['I prefer short answers.', 'STABLE_PREFERENCE', 'I prefer short answers.'],
    ['أنا بفضل الردود المختصرة.', 'STABLE_PREFERENCE', 'أنا بفضل الردود المختصرة.'],
    ['By the way, I live in Cairo for 3 years.', 'PERSONAL_FACT', 'I live in Cairo.'],
    // MEM-AR-01A (PD-4): the Arabic clause is kept as said (only the «بالمناسبة» preamble is not part of it); English
    // keeps its documented template.
    ['بالمناسبة أنا ساكن في أكتوبر من 3 سنين.', 'PERSONAL_FACT', 'أنا ساكن في أكتوبر من 3 سنين.'],
    ['My goal is to lose 10 kg this year.', 'GOAL', 'My goal is to lose 10 kg this year.'],
    ['هدفي إني أسيب الشغل خلال 6 شهور.', 'GOAL', 'هدفي إني أسيب الشغل خلال 6 شهور.'],
    ['I decided to start training on Saturday.', 'DECISION_COMMITMENT', 'I decided to start training on Saturday.'],
    ['قررت أبدأ الجيم من السبت.', 'DECISION_COMMITMENT', 'قررت أبدأ الجيم من السبت.'],
    ['Nora is my sister.', 'RELATIONSHIP_CONTEXT', 'Nora is my sister.'],
    ['سلمى أختي.', 'RELATIONSHIP_CONTEXT', 'سلمى أختي.'],
    ['Speak to me in Egyptian Arabic.', 'INTERACTION_PREFERENCE', 'Speak to me in Egyptian Arabic.'],
    ['كلمني بالمصري.', 'INTERACTION_PREFERENCE', 'كلمني بالمصري.'],
  ])('writes one explicit candidate for %s', (content, type, normalized) => {
    const decision = evaluator.evaluate(content, now);
    expect(decision).toMatchObject({
      decision: 'WRITE',
      candidate: { type, content: normalized, source: 'USER_STATED', status: 'ACTIVE', confidence: 0.95 },
    });
    if (decision.decision === 'WRITE') {
      expect(decision.candidate.importance).toBe(MEMORY_IMPORTANCE[type as keyof typeof MEMORY_IMPORTANCE]);
      expect(decision.candidate.confidence).toBeGreaterThanOrEqual(0);
      expect(decision.candidate.confidence).toBeLessThanOrEqual(1);
      expect(decision.candidate.type).not.toBe('DERIVED_INSIGHT');
      expect(decision.candidate.source).not.toBe('SYSTEM_DERIVED');
    }
  });

  it('writes a bounded temporary state with deterministic expiration', () => {
    const decision = evaluator.evaluate("I'm traveling to Riyadh next week.", now);
    expect(decision).toMatchObject({
      decision: 'WRITE', candidate: { type: 'TEMPORARY_STATE', importance: 0.5, expiresAt: '2026-08-31T12:00:00.000Z' },
    });
  });

  it('uses explicit remember confidence only for a supported safe fact', () => {
    expect(evaluator.evaluate('Remember that I live in Giza.', now)).toMatchObject({
      decision: 'WRITE', candidate: { type: 'PERSONAL_FACT', confidence: 0.98, source: 'USER_STATED' },
    });
    expect(evaluator.evaluate('Remember to buy milk.', now).decision).toBe('SKIP');
    expect(evaluator.evaluate('افتكر إني ساكن في الجيزة.', now)).toMatchObject({
      decision: 'WRITE', candidate: { type: 'PERSONAL_FACT', confidence: 0.98, content: 'أنا ساكن في الجيزة.' },
    });
  });

  it.each([
    'Remember my password is ABC123', 'Remember my API key is test-value',
    'Remember my OTP is 123456', 'Remember my card is 4111 1111 1111 1111',
    'افتكر الرقم القومي 29801011234567',
  ])('denies obvious sensitive data without returning its content: %s', (content) => {
    expect(evaluator.evaluate(content, now)).toEqual({ decision: 'SKIP', reason: 'SENSITIVE_DATA' });
  });

  // W3-MEGA-M: JavaScript's \b is ASCII-only, so these Arabic phrases used to pass the screen.
  it.each([
    'افتكر إن كلمة السر بتاعتي هي 123456', 'الباسورد بتاعي abc123', 'كود التحقق 4431', 'الرقم السري للكارت 9911',
    // Arabic clitics on the keyword, and identifiers beyond passwords (security review of W3-MEGA-M).
    'إيميلي x وكلمة السر بتاعتي 1234', 'والباسورد 55', 'my pin is 4821', 'the CVV is 123', 'رقم الحساب بتاعي 100200300',
    'IBAN EG380019000500000000263180002', 'رقم الباسبور A1234567', 'الرقم القومي بتاعي معايا',
  ])('denies Arabic secrets too: %s', (content) => {
    expect(evaluator.evaluate(content, now)).toEqual({ decision: 'SKIP', reason: 'SENSITIVE_DATA' });
    expect(evaluator.explicitStatementCandidate(content, now)).toEqual({ decision: 'SKIP', reason: 'SENSITIVE_DATA' });
  });

  it.each(['أنا ساكن في طنطا', 'بحب الشاي بالنعناع', 'أحمد عنده امتحان الخميس', 'I work at the bank', 'رقم أوضتي في الفندق 12'])('ordinary statements still pass the screen: %s', (content) => {
    expect(evaluator.explicitStatementCandidate(content, now).decision).toBe('WRITE');
  });

  it('W3-MEGA-M a remembered fact is one statement, not a document', () => {
    expect(evaluator.explicitStatementCandidate('كلام '.repeat(80), now)).toEqual({ decision: 'SKIP', reason: 'EMPTY' });
  });

  it('W3-MEGA-M explicit statements: typed when the grammar knows them, otherwise kept in the user\'s own words', () => {
    expect(evaluator.explicitStatementCandidate('إني ساكن في طنطا', now)).toEqual({ decision: 'WRITE', candidate: {
      type: 'PERSONAL_FACT', content: 'أنا ساكن في طنطا.', source: 'USER_STATED', status: 'ACTIVE', confidence: 0.98, importance: MEMORY_IMPORTANCE.PERSONAL_FACT,
    } });
    expect(evaluator.explicitStatementCandidate('إني بحب القهوة', now)).toMatchObject({ decision: 'WRITE', candidate: { type: 'STABLE_PREFERENCE', content: 'أنا بحب القهوة.' } });
    expect(evaluator.explicitStatementCandidate('أحمد عنده امتحان الخميس', now)).toMatchObject({ decision: 'WRITE', candidate: { type: 'PERSONAL_FACT', content: 'أحمد عنده امتحان الخميس.' } });
    expect(evaluator.explicitStatementCandidate('we meet on Fridays', now, 'RELATIONSHIP_CONTEXT')).toMatchObject({ decision: 'WRITE', candidate: { type: 'RELATIONSHIP_CONTEXT', content: 'we meet on Fridays.' } });
    expect(evaluator.explicitStatementCandidate('.', now)).toEqual({ decision: 'SKIP', reason: 'EMPTY' });
  });

  it('never expands a multi-fact turn into multiple candidates', () => {
    const decision = evaluator.evaluate('I prefer short answers. My goal is to run a marathon.', now);
    expect(decision.decision).toBe('SKIP');
  });

  // ---- MEM-AR-01A (F-1) -----------------------------------------------------------------------------------------
  describe('MEM-AR-01A wording fidelity (PD-4)', () => {
    const asSaid = [
      ['أنا ساكنة في مدينة نصر', 'PERSONAL_FACT', 'أنا ساكنة في مدينة نصر.'],
      ['أنا عايشة في المعادي', 'PERSONAL_FACT', 'أنا عايشة في المعادي.'],
      ['أنا مسافرة الإسكندرية بكرة', 'TEMPORARY_STATE', 'أنا مسافرة الإسكندرية بكرة.'],
      ['انا ساكنة في مدينة نصر', 'PERSONAL_FACT', 'أنا ساكنة في مدينة نصر.'],
      ['أنا عايش طنطا', 'PERSONAL_FACT', 'أنا عايش طنطا.'],
      ['أنا مسافر إلى أسوان الأسبوع الجاي!', 'TEMPORARY_STATE', 'أنا مسافر إلى أسوان الأسبوع الجاي.'],
    ] as const;

    it.each(asSaid)('background capture keeps «%s» as said', (text, type, stored) => {
      expect(evaluator.evaluate(text, now)).toMatchObject({ decision: 'WRITE', candidate: { type, content: stored } });
    });

    it.each(asSaid)('explicit remember keeps «%s» as said', (text, type, stored) => {
      expect(evaluator.explicitStatementCandidate(text, now)).toMatchObject({ decision: 'WRITE', candidate: { type, content: stored, confidence: 0.98 } });
      expect(evaluator.explicitStatementCandidate(text.replace(/^(?:انا|أنا)/u, 'إني'), now)).toMatchObject({ decision: 'WRITE', candidate: { content: stored } });
    });

    it.each(asSaid)('a correction replacement keeps «%s» as said (the replacement path, with the target type as fallback)', (text, type, stored) => {
      expect(evaluator.explicitStatementCandidate(text, now, 'STABLE_PREFERENCE')).toMatchObject({ decision: 'WRITE', candidate: { type, content: stored } });
    });

    it('the travel expiry still follows the stated day', () => {
      expect(evaluator.evaluate('أنا مسافرة الإسكندرية بكرة', now)).toMatchObject({ candidate: { expiresAt: '2026-08-19T12:00:00.000Z' } });
    });

    it('English keeps its documented templates', () => {
      expect(evaluator.evaluate('By the way, I live in Cairo for 3 years.', now)).toMatchObject({ candidate: { content: 'I live in Cairo.' } });
      expect(evaluator.evaluate("I'm traveling to Riyadh tomorrow.", now)).toMatchObject({ candidate: { content: "I'm traveling to Riyadh tomorrow." } });
      expect(evaluator.explicitStatementCandidate('I live in Giza', now)).toMatchObject({ candidate: { content: 'I live in Giza.' } });
    });
  });

  describe('MEM-AR-01A bounded Egyptian cues (PD-5)', () => {
    it.each([
      ['بحب السفر جدا', 'STABLE_PREFERENCE', 'بحب السفر جدا.'],
      ['بحب الشاي بالنعناع.', 'STABLE_PREFERENCE', 'بحب الشاي بالنعناع.'],
      ['بطلت أشرب قهوة', 'PERSONAL_FACT', 'بطلت أشرب قهوة.'],
      ['أنا بطلت السجاير', 'PERSONAL_FACT', 'أنا بطلت السجاير.'],
      ['انا بطلت السهر', 'PERSONAL_FACT', 'أنا بطلت السهر.'],
    ])('captures «%s» in the user\'s words', (text, type, stored) => {
      expect(evaluator.evaluate(text, now)).toMatchObject({ decision: 'WRITE', candidate: { type, content: stored, confidence: 0.95 } });
    });

    it.each([
      'نفسي أعيش قريب من أهلي', 'مش عايز حد بيشرب سجاير', 'بحب الشاي؟', 'بطلت تشرب سجاير؟', 'بطلت تكلمني',
      'بطلت يرد عليا', 'بحب', 'بطلت', 'بحب الشاي. وبطلت القهوة',
    ])('does not capture «%s»', (text) => {
      expect(evaluator.evaluate(text, now).decision).toBe('SKIP');
    });
  });

  describe('MEM-AR-01A I-F3: every background pattern stays anchored to the first person or to the user', () => {
    it.each([
      'أختي بتحب الكشري', 'هو ساكن في طنطا', 'هي ساكنة في طنطا', 'ساكنة في طنطا', 'بيحب الشاي', 'بتحب الشاي', 'بنحب السفر',
      'هي بطلت التدخين', 'أحمد بطل السجاير', 'أحمد عنده امتحان الخميس', 'He lives in Cairo.', 'She prefers short answers.',
    ])('a third-person or subject-less statement is not background-captured: %s', (text) => {
      expect(evaluator.evaluate(text, now)).toEqual({ decision: 'SKIP', reason: 'NO_SUPPORTED_EXPLICIT_PATTERN' });
    });
  });

  describe('MEM-AR-01A duplicates: Unicode, and the frozen legacy template (rows never rewritten)', () => {
    const memory = (type: string, content: string) => Object.freeze({ type: type as never, content });

    it('Unicode variants of one statement are one Memory (U2)', () => {
      expect(normalizeMemoryContent('أنا بحب الشــاي')).toBe(normalizeMemoryContent('أنا بحب الشاي.'));
      expect(normalizeMemoryContent('عندي ٢٩ سنة.')).toBe(normalizeMemoryContent('عندي 29 سنة'));
      expect(screenMemoryCapture({ type: 'STABLE_PREFERENCE', content: 'أنا بحب الشــاي.' }, [memory('STABLE_PREFERENCE', 'أنا بحب الشاي.')])).toBe('EXACT_NORMALIZED_DUPLICATE');
    });

    it.each([
      ['أنا ساكنة في مدينة نصر.', 'PERSONAL_FACT', 'أنا ساكن في مدينة نصر.'],
      ['أنا عايشة في المعادي.', 'PERSONAL_FACT', 'أنا ساكن في المعادي.'],
      ['أنا عايشة المعادي.', 'PERSONAL_FACT', 'أنا ساكن في المعادي.'],
      ['أنا ساكن في أكتوبر من 3 سنين.', 'PERSONAL_FACT', 'أنا ساكن في أكتوبر.'],
      ['أنا مسافرة الإسكندرية بكرة.', 'TEMPORARY_STATE', 'أنا مسافر الإسكندرية بكرة.'],
      ['أنا مسافرة إلى أسوان بكرة.', 'TEMPORARY_STATE', 'أنا مسافر أسوان بكرة.'],
    ])('a new «%s» is a duplicate of the legacy %s row «%s», which is left untouched', (content, type, legacy) => {
      const legacyRow = memory(type, legacy);
      expect(screenMemoryCapture({ type: type as never, content }, [legacyRow])).toBe('EXACT_NORMALIZED_DUPLICATE');
      expect(memoryDuplicateKeys(content).has(normalizeMemoryContent(legacy))).toBe(true);
      expect(legacyRow).toEqual({ type, content: legacy });
    });

    it.each([
      ['another place', 'أنا ساكنة في طنطا.', 'PERSONAL_FACT', 'أنا ساكن في مدينة نصر.', 'PERSONAL_FACT'],
      ['another subject', 'أنا ساكنة في طنطا.', 'PERSONAL_FACT', 'صاحبي ساكن في طنطا.', 'PERSONAL_FACT'],
      ['another type', 'أنا ساكنة في طنطا.', 'PERSONAL_FACT', 'أنا ساكن في طنطا.', 'STABLE_PREFERENCE'],
      ['another day', 'أنا مسافرة أسوان بكرة.', 'TEMPORARY_STATE', 'أنا مسافر أسوان الأسبوع الجاي.', 'TEMPORARY_STATE'],
      ['a preference is never folded to a template', 'أنا بحب طنطا.', 'STABLE_PREFERENCE', 'أنا ساكن في طنطا.', 'STABLE_PREFERENCE'],
    ])('%s is not a duplicate', (_label, content, type, existing, existingType) => {
      expect(screenMemoryCapture({ type: type as never, content }, [memory(existingType, existing)])).toBeUndefined();
    });

    it('a masculine row in the user\'s own words never swallows a later feminine one, nor the reverse', () => {
      expect(screenMemoryCapture({ type: 'PERSONAL_FACT', content: 'أنا ساكن في طنطا.' }, [memory('PERSONAL_FACT', 'أنا ساكنة في طنطا.')])).toBeUndefined();
    });
  });

  describe('MEM-AR-01A «بطلت» fails closed beside a Memory it may reverse (01B owns the correction)', () => {
    const memory = (type: string, content: string) => ({ type: type as never, content });

    it.each([
      ['بطلت أشرب قهوة.', 'أنا بحب القهوة.'],
      ['أنا بطلت السجاير.', 'قررت أقلل السجاير.'],
      ['بطلت أروح الجيم.', 'قررت أبدأ الجيم من السبت.'],
    ])('«%s» beside «%s» writes nothing', (content, existing) => {
      expect(screenMemoryCapture({ type: 'PERSONAL_FACT', content }, [memory('STABLE_PREFERENCE', existing)])).toBe('REVERSAL_NEEDS_CORRECTION');
    });

    it('with no related Memory it is captured, and other cues are not screened', () => {
      expect(screenMemoryCapture({ type: 'PERSONAL_FACT', content: 'بطلت أشرب قهوة.' }, [memory('PERSONAL_FACT', 'أنا ساكن في طنطا.')])).toBeUndefined();
      expect(screenMemoryCapture({ type: 'PERSONAL_FACT', content: 'بطلت أشرب قهوة.' }, [])).toBeUndefined();
      expect(screenMemoryCapture({ type: 'STABLE_PREFERENCE', content: 'بحب القهوة.' }, [memory('STABLE_PREFERENCE', 'أنا بحب القهوة باللبن.')])).toBeUndefined();
    });

    it('a predicate word alone («بحب») is not a link', () => {
      expect(screenMemoryCapture({ type: 'PERSONAL_FACT', content: 'بطلت بحب السهر.' }, [memory('STABLE_PREFERENCE', 'أنا بحب الشاي.')])).toBeUndefined();
    });
  });
});
