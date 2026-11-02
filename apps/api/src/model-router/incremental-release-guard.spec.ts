import { releaseModelOutput } from './model-output-release-guard';
import { FIRST_CLAUSE_MIN_CHARS, IncrementalReleaseGuard } from './incremental-release-guard';
import { stripSpeechMarkup } from '../speech-rendering/speech-markup';

const GUIDANCE = [
  'You are Qandeel. Keep ordinary conversation concise and never lecture the person about anything at all.',
  '<user_memory_context>The person likes long walks by the Nile in the early morning before work.</user_memory_context>',
].join('\n');
const ECHO = 'Keep ordinary conversation concise and never lecture the person about anything at all.';

function chunks(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

function stream(raw: string, size: number, safetyGuided = false) {
  const guard = new IncrementalReleaseGuard({ serverGuidance: GUIDANCE, safetyGuided });
  const pieces: string[] = [];
  for (const chunk of chunks(raw, size)) {
    const piece = guard.push(chunk);
    if (piece) pieces.push(piece);
  }
  return { guard, pieces, outcome: guard.end() };
}

/** What the unchanged non-streaming path stores for this raw reply. */
function nonStreaming(raw: string, safetyGuided = false): string {
  releaseModelOutput(raw, GUIDANCE);
  const parsed = stripSpeechMarkup(raw, { safetyGuided });
  if (parsed.kind !== 'OK') throw new Error('malformed');
  return parsed.text;
}

describe('IncrementalReleaseGuard (S8B-04 CP2, D-S2)', () => {
  const reply = '[[speech:JOY]]\nأهلًا بك! سعيد أنك كتبت لي اليوم. كيف كان يومك؟ أخبرني بما حدث.';

  it('releases whole sentences in order, and the released pieces plus the tail are exactly the non-streaming text', () => {
    for (const size of [1, 2, 3, 5, 8, 13, 64]) {
      const { pieces, outcome } = stream(reply, size);
      expect(outcome.kind).toBe('COMPLETE');
      if (outcome.kind !== 'COMPLETE') return;
      expect(pieces.join('') + outcome.tail).toBe(nonStreaming(reply));
      expect(outcome.text).toBe(nonStreaming(reply));
      expect(outcome.expression).toBe('JOY');
      for (const piece of pieces) {
        expect(piece).not.toContain('[[');
        expect(piece).not.toContain(']]');
        expect(piece.trimEnd()).toMatch(/[.!?؟…]$/u);
      }
    }
  });

  it('releases the first sentence before the reply is complete', () => {
    const guard = new IncrementalReleaseGuard({ serverGuidance: GUIDANCE, safetyGuided: false });
    // A sentence end is released once the next character shows it is one.
    expect(guard.push('[[speech:CALM]]\nأهلًا بك! ')).toBe('');
    expect(guard.push('كيف كان')).toBe('أهلًا بك!');
    expect(guard.push(' يومك؟ ')).toBe('');
    expect(guard.push('أخبرني')).toBe(' كيف كان يومك؟');
  });

  it('never releases a hint marker or any part of one, and never a sentence still being decided', () => {
    const raw = '[[speech:CALM]]\nقرأت الكتاب [[say:الكِتاب]] أمس. ثم نمت مبكرًا.';
    for (const size of [1, 2, 4, 7]) {
      const { pieces, outcome } = stream(raw, size);
      expect(outcome.kind).toBe('COMPLETE');
      for (const piece of pieces) expect(piece).not.toMatch(/\[|\]|say:/u);
      if (outcome.kind === 'COMPLETE') expect(pieces.join('') + outcome.tail).toBe(nonStreaming(raw));
    }
  });

  it('does not release early on a GUIDED (Safety) turn: the reply is released whole at the end, CALM', () => {
    const { guard, pieces, outcome } = stream(reply, 3, true);
    expect(pieces).toEqual([]);
    expect(guard.earlyReleaseStop).toBe('SAFETY_GUIDED');
    expect(outcome.kind).toBe('COMPLETE');
    if (outcome.kind === 'COMPLETE') {
      expect(outcome.tail).toBe(nonStreaming(reply, true));
      expect(outcome.expression).toBe('CALM');
    }
  });

  it('holds back a possible echo of server guidance; a full echo stops early release and withholds the tail', () => {
    const raw = `[[speech:CALM]]\nأفهمك تمامًا. ${ECHO} وهذا كل شيء.`;
    for (const size of [1, 3, 9]) {
      const { guard, pieces, outcome } = stream(raw, size);
      const released = pieces.join('');
      expect(released).toBe('أفهمك تمامًا.');
      expect(released).not.toContain('Keep');
      expect(guard.earlyReleaseStop).toBe('GUIDANCE_ECHO');
      expect(outcome).toEqual({ kind: 'WITHHELD_TAIL', released: 'أفهمك تمامًا.', reason: 'GUIDANCE_ECHO' });
    }
  });

  it('holds a possible echo while it could still grow, and releases a short coincidence once it diverges (as the whole guard does)', () => {
    const guard = new IncrementalReleaseGuard({ serverGuidance: GUIDANCE, safetyGuided: false });
    expect(guard.push('[[speech:CALM]]\nحسنًا. Keep ordinary conversation concise. ')).toBe('حسنًا.');
    // Diverged after 37 characters of a server sentence (under GUIDANCE_ECHO_MIN_LENGTH): the whole guard accepts it too.
    expect(guard.push('ثم شيء آخر. ')).toBe(' Keep ordinary conversation concise.');
    expect(guard.push('و')).toBe(' ثم شيء آخر.');
    expect(guard.end().kind).toBe('COMPLETE');
  });

  it('a nothing-released failure is WITHHELD (the turn fails exactly as today)', () => {
    const { pieces, outcome } = stream(`[[speech:CALM]]\n${ECHO}`, 4);
    expect(pieces).toEqual([]);
    expect(outcome).toEqual({ kind: 'WITHHELD', reason: 'GUIDANCE_ECHO' });
  });

  it('an internal container or unreadable text stops early release; the tail is withheld with the existing reason', () => {
    const container = stream('[[speech:CALM]]\nجملة أولى. <think>plan</think> جملة.', 2);
    expect(container.pieces.join('')).toBe('جملة أولى.');
    expect(container.outcome).toEqual({ kind: 'WITHHELD_TAIL', released: 'جملة أولى.', reason: 'INTERNAL_CONTAINER' });
    const unreadable = stream('[[speech:CALM]]\nجملة أولى. ثم \u0007 جملة.', 2);
    expect(unreadable.outcome).toEqual({ kind: 'WITHHELD_TAIL', released: 'جملة أولى.', reason: 'UNREADABLE' });
  });

  it('holds text after an unclosed `<` until it closes', () => {
    const guard = new IncrementalReleaseGuard({ serverGuidance: GUIDANCE, safetyGuided: false });
    expect(guard.push('[[speech:CALM]]\nأولى. 3 < 5 دائمًا. ')).toBe('أولى.');
    // The last sentence end is released once the next character shows it is one (`4.` could still become `4.5`).
    expect(guard.push('ثم 6 > 4. ')).toBe(' 3 < 5 دائمًا.');
    expect(guard.push('تم')).toBe(' ثم 6 > 4.');
  });

  it('a malformed marker at the end withholds the tail (fail closed, nothing substituted)', () => {
    const { pieces, outcome } = stream('[[speech:CALM]]\nجملة أولى. ثم [[say:كلمة جملة ثانية.', 3);
    expect(pieces.join('')).toBe('جملة أولى.');
    expect(outcome.kind).toBe('WITHHELD_TAIL');
  });

  it('a decimal point is not a sentence boundary; Arabic question marks and line breaks are', () => {
    const guard = new IncrementalReleaseGuard({ serverGuidance: GUIDANCE, safetyGuided: false });
    expect(guard.push('[[speech:CALM]]\nالسعر 3.5 جنيه')).toBe('');
    expect(guard.push(' فقط؟ ')).toBe('');
    expect(guard.push('نعم\nثم')).toBe('السعر 3.5 جنيه فقط؟ نعم\n');
  });

  it('a long first sentence may be released at a clause boundary after FIRST_CLAUSE_MIN_CHARS', () => {
    const clause = 'ك'.repeat(FIRST_CLAUSE_MIN_CHARS);
    const guard = new IncrementalReleaseGuard({ serverGuidance: GUIDANCE, safetyGuided: false });
    expect(guard.push(`[[speech:CALM]]\n${clause}، ثم`)).toBe(`${clause}،`);
  });

  it('a released piece carries the expression and the hints its sentences already have, as the one parser reads them', () => {
    const guard = new IncrementalReleaseGuard({ serverGuidance: GUIDANCE, safetyGuided: false });
    expect(guard.push('[[speech:JOY]]\nقرأت الكتاب [[say:الكِتاب]] أمس. ثم ')).toBe('قرأت الكتاب أمس.');
    const early = guard.releasedSpeech;
    expect(early.expression).toBe('JOY');
    expect(early.hints).toHaveLength(1);
    expect(early.hints[0]!.word).toBe('الكِتاب');
    expect(early.hints[0]!.at).toBeLessThanOrEqual(guard.releasedText.length);
    const whole = stripSpeechMarkup('[[speech:JOY]]\nقرأت الكتاب [[say:الكِتاب]] أمس. ثم نمت.', { safetyGuided: false });
    if (whole.kind !== 'OK') throw new Error('malformed');
    expect(early.hints).toEqual(whole.hints);
    // A GUIDED turn's expression is constrained exactly as the parser constrains it, before anything is released.
    expect(new IncrementalReleaseGuard({ serverGuidance: GUIDANCE, safetyGuided: true }).releasedSpeech.expression).toBe('CALM');
  });

  it('random chunkings of many replies keep the prefix invariant and equal the non-streaming text', () => {
    const replies = [
      reply,
      '[[speech:SERIOUS]]\nThis matters. Take a breath first, then decide. I will be here.',
      '[[speech:EMPATHY]]\nأنا آسف لما حدث… هل تريد أن تحكي لي أكثر؟\nخذ وقتك.',
      'بلا سطر نبرة. جملة ثانية! وثالثة؟',
    ];
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (const raw of replies) {
      for (let trial = 0; trial < 40; trial += 1) {
        const guard = new IncrementalReleaseGuard({ serverGuidance: GUIDANCE, safetyGuided: false });
        const pieces: string[] = [];
        for (let i = 0; i < raw.length;) {
          const n = 1 + Math.floor(rnd() * 9);
          const piece = guard.push(raw.slice(i, i + n));
          if (piece) pieces.push(piece);
          i += n;
        }
        const outcome = guard.end();
        expect(outcome.kind).toBe('COMPLETE');
        if (outcome.kind === 'COMPLETE') expect(pieces.join('') + outcome.tail).toBe(nonStreaming(raw));
      }
    }
  });
});
