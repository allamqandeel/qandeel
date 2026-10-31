// S8B-03 (CP1, E5 / A15): the foreground reply's memory section - the sixth model boundary. A MACHINE_ASR item carries its
// source and typed confirmation and brings M-01; a section without one is byte for byte the section before S8B-03.
import { memoryContextFixedBytes, renderMemoryContextGuidance, type ModelRouterMemoryContext } from './model-router.types';
import { MACHINE_ASR_SOURCE_GUIDANCE } from '../memory/machine-asr-model-copy';

const typed: ModelRouterMemoryContext = { type: 'PERSONAL_FACT', content: 'أنا ساكن في طنطا', source: 'USER_STATED' };
const voiced: ModelRouterMemoryContext = { type: 'PERSONAL_FACT', content: 'أنا بحب الرسم', source: 'MACHINE_ASR', confirmedByTyping: true };

describe('S8B-03 foreground memory context (E5)', () => {
  it('a typed section carries no MACHINE_ASR line', () => {
    expect(renderMemoryContextGuidance([typed])).not.toContain(MACHINE_ASR_SOURCE_GUIDANCE);
  });

  it('a MACHINE_ASR item brings M-01 and its typed confirmation', () => {
    const section = renderMemoryContextGuidance([typed, voiced]);
    expect(section).toContain(MACHINE_ASR_SOURCE_GUIDANCE);
    expect(section).toContain('"source":"MACHINE_ASR"');
    expect(section).toContain('"confirmedByTyping":true');
  });

  it('the fixed budget bytes cover the longest preamble, M-01 included', () => {
    const preamble = Buffer.byteLength(renderMemoryContextGuidance([voiced]).split('\n<user_memory_context>')[0], 'utf8');
    expect(memoryContextFixedBytes()).toBeGreaterThanOrEqual(preamble);
  });
});
