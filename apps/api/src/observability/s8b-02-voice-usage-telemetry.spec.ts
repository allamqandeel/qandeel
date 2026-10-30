// S8B-02 CP1 (migration 0184; Product Owner decision D-2, 2026-10-30): the voice AI usage telemetry. A voice settlement
// always carries its usage source, so a GATEWAY_MEASURED quantity is never merged into, or presented as, a
// provider-reported one; audio milliseconds are never counted as tokens; the text settlement's labels are unchanged.
import { TelemetryService } from './telemetry.service';
import { CorrelationService } from './correlation.service';
import {
  AI_FEATURE_FAMILIES, AI_LEDGER_FEATURE_FAMILIES, AI_LEDGER_USAGE_KINDS, AI_PROVIDERS, AI_USAGE_KINDS, AI_VOICE_COMPLETE_USAGE_KINDS,
} from '../ai-usage/ai-usage.types';

function instrumented() {
  const t = new TelemetryService(new CorrelationService());
  const sinks = { calls: jest.fn(), tokens: jest.fn(), audio: jest.fn() };
  Object.assign(t as unknown as Record<string, unknown>, {
    aiUsageProviderCalls: { add: sinks.calls }, aiUsageTokens: { add: sinks.tokens }, aiUsageAudioInput: { add: sinks.audio },
  });
  return { t, sinks };
}

describe('S8B-02 CP1: the voice ledger vocabulary', () => {
  it('keeps the text registries exactly and holds the 0184 CHECKs in the ledger unions', () => {
    expect(AI_PROVIDERS).toEqual(['OPENAI', 'ANTHROPIC', 'GEMINI', 'DEEPSEEK']);
    expect(AI_USAGE_KINDS).toEqual(['INPUT_TOKEN', 'OUTPUT_TOKEN', 'CACHE_READ_INPUT_TOKEN', 'CACHE_WRITE_INPUT_TOKEN']);
    expect(AI_FEATURE_FAMILIES).not.toContain('SPEECH_SYNTHESIS');
    expect(AI_LEDGER_USAGE_KINDS).toEqual([...AI_USAGE_KINDS, 'AUDIO_INPUT_MS', 'AUDIO_OUTPUT_TOKEN']);
    expect(AI_LEDGER_FEATURE_FAMILIES.slice(-4)).toEqual(['VOICE_NOTE_TRANSCRIPTION', 'LIVE_CALL_TRANSCRIPTION', 'SPEECH_SYNTHESIS', 'SPEECH_RENDERING']);
    expect(AI_VOICE_COMPLETE_USAGE_KINDS).toEqual({
      SPEECHMATICS_REALTIME_TRANSCRIPTION: ['AUDIO_INPUT_MS'],
      SPEECHMATICS_BATCH_TRANSCRIPTION: ['AUDIO_INPUT_MS'],
      GEMINI_SPEECH_GENERATION: ['AUDIO_OUTPUT_TOKEN', 'INPUT_TOKEN'],
    });
  });
});

describe('S8B-02 CP1: voice settlement telemetry', () => {
  it('labels a gateway-measured transcription by its source and counts milliseconds apart from tokens', () => {
    const { t, sinks } = instrumented();
    t.recordAiVoiceProviderCallSettlement('SPEECHMATICS', 'SPEECHMATICS_REALTIME_TRANSCRIPTION', 'LIVE_CALL_TRANSCRIPTION', 'SUCCEEDED', 'GATEWAY_MEASURED',
      { completeness: 'COMPLETE', quantities: { AUDIO_INPUT_MS: 61250 } });
    expect(sinks.calls).toHaveBeenCalledWith(1, { provider: 'SPEECHMATICS', feature_family: 'LIVE_CALL_TRANSCRIPTION', outcome: 'SUCCEEDED', usage_completeness: 'COMPLETE', usage_source: 'GATEWAY_MEASURED', policy_version: '1' });
    expect(sinks.audio).toHaveBeenCalledWith(61250, { provider: 'SPEECHMATICS', feature_family: 'LIVE_CALL_TRANSCRIPTION', usage_kind: 'AUDIO_INPUT_MS', usage_source: 'GATEWAY_MEASURED', policy_version: '1' });
    expect(sinks.tokens).not.toHaveBeenCalled();
  });

  it('labels Gemini speech as provider-reported tokens of its own partition only', () => {
    const { t, sinks } = instrumented();
    t.recordAiVoiceProviderCallSettlement('GEMINI', 'GEMINI_SPEECH_GENERATION', 'SPEECH_SYNTHESIS', 'SUCCEEDED', 'PROVIDER_REPORTED',
      { completeness: 'COMPLETE', quantities: { INPUT_TOKEN: 40, AUDIO_OUTPUT_TOKEN: 900, OUTPUT_TOKEN: 7 } });
    expect(sinks.tokens.mock.calls).toEqual([
      [40, { provider: 'GEMINI', feature_family: 'SPEECH_SYNTHESIS', usage_kind: 'INPUT_TOKEN', usage_source: 'PROVIDER_REPORTED', policy_version: '1' }],
      [900, { provider: 'GEMINI', feature_family: 'SPEECH_SYNTHESIS', usage_kind: 'AUDIO_OUTPUT_TOKEN', usage_source: 'PROVIDER_REPORTED', policy_version: '1' }],
    ]);
    expect(sinks.audio).not.toHaveBeenCalled();
  });

  it('drops a gateway source outside transcription, an unknown pair, family, outcome or source; ABSENT emits no quantity', () => {
    const { t, sinks } = instrumented();
    const usage = { completeness: 'COMPLETE' as const, quantities: { INPUT_TOKEN: 1, AUDIO_OUTPUT_TOKEN: 1 } };
    t.recordAiVoiceProviderCallSettlement('GEMINI', 'GEMINI_SPEECH_GENERATION', 'SPEECH_SYNTHESIS', 'SUCCEEDED', 'GATEWAY_MEASURED', usage);
    t.recordAiVoiceProviderCallSettlement('GEMINI', 'GEMINI_GENERATE_CONTENT', 'SPEECH_SYNTHESIS', 'SUCCEEDED', 'PROVIDER_REPORTED', usage);
    t.recordAiVoiceProviderCallSettlement('SPEECHMATICS', 'GEMINI_SPEECH_GENERATION', 'SPEECH_SYNTHESIS', 'SUCCEEDED', 'PROVIDER_REPORTED', usage);
    t.recordAiVoiceProviderCallSettlement('GEMINI', 'GEMINI_SPEECH_GENERATION', 'CONVERSATION_REPLY', 'SUCCEEDED', 'PROVIDER_REPORTED', usage);
    t.recordAiVoiceProviderCallSettlement('GEMINI', 'GEMINI_SPEECH_GENERATION', 'SPEECH_SYNTHESIS', 'MAYBE', 'PROVIDER_REPORTED', usage);
    t.recordAiVoiceProviderCallSettlement('GEMINI', 'GEMINI_SPEECH_GENERATION', 'SPEECH_SYNTHESIS', 'SUCCEEDED', 'ESTIMATED', usage);
    expect([sinks.calls, sinks.tokens, sinks.audio].map((sink) => sink.mock.calls.length)).toEqual([0, 0, 0]);
    t.recordAiVoiceProviderCallSettlement('SPEECHMATICS', 'SPEECHMATICS_BATCH_TRANSCRIPTION', 'VOICE_NOTE_TRANSCRIPTION', 'FAILED', 'PROVIDER_REPORTED', { completeness: 'ABSENT' });
    expect(sinks.calls).toHaveBeenCalledTimes(1);
    expect([sinks.tokens, sinks.audio].map((sink) => sink.mock.calls.length)).toEqual([0, 0]);
  });

  it('the text settlement keeps its exact labels and never accepts a voice family', () => {
    const { t, sinks } = instrumented();
    t.recordAiProviderCallSettlement('GEMINI', 'SPEECH_SYNTHESIS', 'SUCCEEDED', { completeness: 'ABSENT' });
    expect(sinks.calls).not.toHaveBeenCalled();
    t.recordAiProviderCallSettlement('DEEPSEEK', 'CONVERSATION_REPLY', 'SUCCEEDED', { completeness: 'COMPLETE', quantities: { OUTPUT_TOKEN: 3 } });
    expect(sinks.calls).toHaveBeenCalledWith(1, { provider: 'DEEPSEEK', feature_family: 'CONVERSATION_REPLY', outcome: 'SUCCEEDED', usage_completeness: 'COMPLETE', policy_version: '1' });
    expect(sinks.tokens).toHaveBeenCalledWith(3, { provider: 'DEEPSEEK', feature_family: 'CONVERSATION_REPLY', usage_kind: 'OUTPUT_TOKEN', policy_version: '1' });
  });
});
