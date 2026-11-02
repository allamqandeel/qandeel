// S8B-04 (CP1, items B and C) — the orchestrator's voice-note speech channel.
//
// A deterministic Model Router double returns a scripted candidate; the REAL Behavioral Runtime policy, the REAL QIR-004
// assembler and the REAL InteractionPreferencesService are used, so every assertion is on what the provider would
// receive and on what the turn stores. Proven here:
//   - a typed turn's guidance is byte-identical to Text v5, its output is stored exactly as generated (even when it holds
//     `[[say:` or `[[speech:`), and the speech channel is never touched;
//   - a VOICE_NOTE turn's guidance is Text v5 + TM-01 exactly (TM-03 is off in CP1), its valid markers are separated, the
//     visible text is what is stored, and the expression (GUIDED: never PLAYFUL / JOY) and validated hints are recorded;
//   - a reply whose markers cannot be separated with certainty fails the turn closed: no finalize, no extra provider
//     call, no substitute reply, the canonical failure path (failTurn + 503);
//   - a failure to record the channel never fails the committed turn.
import { ServiceUnavailableException } from '@nestjs/common';
import { HimIntelligenceSnapshotService } from '../human-model/him-intelligence-snapshot.service';
import { HimReasoningConsumptionService } from '../human-model/him-reasoning-consumption.service';
import { HimFastDeepConsumptionService } from '../human-model/him-fast-deep-consumption.service';
import { HimInteractionAdaptationService } from '../human-model/him-interaction-adaptation.service';
import { HimTurnContextSelectionService } from '../human-model/him-turn-context-selection.service';
import { HimSessionReflectionConsumptionService } from '../human-model/him-session-reflection-consumption.service';
import type { HimContextualCurrentIntelligenceService } from '../human-model/him-contextual-current-intelligence.service';
import type { HimCrossContextForegroundAggregationService } from '../human-model/him-cross-context-foreground-aggregation.service';
import type { HimBrainContextService } from '../human-model/him-brain-context.service';
import type { ModelRouter, ModelRouterRequest } from '../model-router/model-router.types';
import { CorrelationService } from '../observability/correlation.service';
import { TelemetryService } from '../observability/telemetry.service';
import { BoundedForegroundIntelligenceGathererService } from '../intelligence-runtime/bounded-foreground-intelligence-gatherer.service';
import type { QuestionForegroundSelectionService } from '../question/question-foreground-selection.service';
import { IntegratedContextBudgetAssemblerService } from '../intelligence-runtime/integrated-context-budget-assembler.service';
import { ConversationOrchestratorService } from './conversation-orchestrator.service';
import type { ConversationRepository } from './conversation.repository';
import type { ConversationTurn } from './conversation.types';
import type { ContextBuilder } from './context-builder.types';
import {
  BehavioralResponsePolicyService, TEXT_V5_BEHAVIORAL_GUIDANCE, VOICE_DELIVERY_LINE_GUIDANCE_TM_01,
  VOICE_PRONUNCIATION_HINT_GUIDANCE_TM_03, VOICE_SPOKEN_REPLY_GUIDANCE_TM_02, withSpokenCallReply, withVoiceNoteChannel,
} from './behavioral-response-policy.service';
import type { SafetyResponseGate, SafetyResponseGateResult } from './safety-response-gate.types';
import type { MemoryRetrieverService } from '../memory/memory-retriever.service';
import type { HypothesisReasoningContextService } from '../hypothesis/hypothesis-reasoning-context.service';
import type { RecommendationGroundingService } from '../recommendation/recommendation-grounding.service';
import { InteractionPreferencesService } from '../interaction-preferences/interaction-preferences.service';
import type { InteractionPreferencesRepository } from '../interaction-preferences/interaction-preferences.repository';
import type { ReplySpeechRepository } from '../voice-media/reply-speech.repository';
import { SPEECH_HINT_POLICY } from '../speech-rendering';

const SESSION = '00000000-0000-4000-8000-000000000401';
const TURN = '00000000-0000-4000-8000-000000000402';
const ASSISTANT = '00000000-0000-4000-8000-000000000403';

describe('S8B-04 — the voice-note speech channel in the orchestrator', () => {
  const turnOf = (content: string, id = TURN): ConversationTurn => ({
    id, session_id: SESSION, role: 'USER', status: 'RECEIVED', content,
    processing_path: null, routing_reason: null, source_turn_id: null, idempotency_key: 'request-1',
    created_at: 'now', updated_at: 'now', completed_at: null,
  });

  let repository: jest.Mocked<ConversationRepository>;
  let router: jest.Mocked<ModelRouter>;
  let safety: { evaluate: jest.Mock };
  let telemetry: TelemetryService;
  let outcomes: jest.SpyInstance;
  let replySpeech: { recordChannel: jest.Mock };
  let orchestrator: ConversationOrchestratorService;

  const dispatched = (): ModelRouterRequest => router.generate.mock.calls[0][0] as ModelRouterRequest;
  const reply = (content: string) => router.generate.mockResolvedValue({ content, routingMetadata: { path: 'FAST' }, usage: { inputTokens: 1, outputTokens: 1 } } as never);
  const decide = (decision: Partial<SafetyResponseGateResult>) => safety.evaluate.mockReturnValue({ category: 'NONE', disposition: 'ALLOW', ...decision });
  const storedContent = () => (repository.finalizeTurn.mock.calls[0][0] as { content: string }).content;
  const channelOutcomes = () => outcomes.mock.calls.filter((c) => c[0] === 'VOICE_REPLY_CHANNEL').map((c) => `${c[1]}/${c[2]}`);
  const voice = { modality: 'VOICE_NOTE' as const };

  beforeEach(() => {
    repository = {
      claimTurn: jest.fn().mockImplementation(() => Promise.resolve({ ...turnOf('x'), status: 'GENERATING', processing_path: 'FAST', routing_reason: 'RUNTIME_ROUTING_V2_FAST_DEFAULT' })),
      finalizeTurn: jest.fn().mockResolvedValue({ userTurn: turnOf('x'), assistantTurn: turnOf('response', ASSISTANT) }),
      finalizeInteractionPreferenceTurn: jest.fn(),
      finalizeMemoryControlTurn: jest.fn(),
      failTurn: jest.fn().mockResolvedValue(undefined),
      findTurn: jest.fn(), findAssistantForSource: jest.fn().mockResolvedValue(undefined), recoverExpiredGeneratingTurn: jest.fn(),
    } as unknown as jest.Mocked<ConversationRepository>;
    router = { generate: jest.fn() } as unknown as jest.Mocked<ModelRouter>;
    reply('response');
    safety = { evaluate: jest.fn() };
    decide({});
    const contextBuilder = {
      build: jest.fn().mockImplementation((_t: string, _u: string, source: { content: string }) => Promise.resolve([{ role: 'USER', content: source.content }])),
    } as unknown as ContextBuilder;
    const correlation = new CorrelationService();
    telemetry = new TelemetryService(correlation);
    outcomes = jest.spyOn(telemetry, 'recordOperationalOutcome');
    const foregroundGatherer = new BoundedForegroundIntelligenceGathererService(
      { retrieve: jest.fn().mockResolvedValue([]) } as unknown as MemoryRetrieverService,
      { build: jest.fn().mockResolvedValue({ coverageState: 'EMPTY', candidateHypothesisCount: 0 }) } as unknown as HypothesisReasoningContextService,
      correlation, telemetry,
    );
    const preferences = new InteractionPreferencesService({ read: jest.fn().mockResolvedValue([]) } as unknown as InteractionPreferencesRepository);
    replySpeech = { recordChannel: jest.fn().mockResolvedValue({ outcome: 'RECORDED' }) };
    orchestrator = new ConversationOrchestratorService(
      repository, contextBuilder, safety as unknown as SafetyResponseGate, new BehavioralResponsePolicyService(),
      new HimTurnContextSelectionService(),
      { getSnapshot: jest.fn().mockRejectedValue(new ServiceUnavailableException()) } as unknown as HimIntelligenceSnapshotService,
      new HimReasoningConsumptionService(), new HimFastDeepConsumptionService(), new HimInteractionAdaptationService(),
      { getCurrentSelection: jest.fn().mockRejectedValue(new Error('none')), getCurrentIntelligence: jest.fn() } as unknown as HimContextualCurrentIntelligenceService,
      new HimSessionReflectionConsumptionService(),
      { read: jest.fn().mockRejectedValue(new Error('none')) } as unknown as HimCrossContextForegroundAggregationService,
      { read: jest.fn().mockResolvedValue(undefined), consumeSourceRows: jest.fn() } as unknown as HimBrainContextService,
      foregroundGatherer,
      { select: jest.fn().mockResolvedValue({ state: 'LEGITIMATE_EMPTY', reason: 'NO_ELIGIBLE_GAP' }) } as unknown as QuestionForegroundSelectionService,
      new IntegratedContextBudgetAssemblerService(telemetry),
      { ground: jest.fn().mockReturnValue({ coverageState: 'EMPTY', reason: 'NO_ACTIVE_HYPOTHESES' }) } as unknown as RecommendationGroundingService,
      router, correlation, telemetry, { plan: jest.fn().mockResolvedValue(null) } as never, preferences,
      undefined, replySpeech as unknown as ReplySpeechRepository,
    );
  });

  describe('a typed turn', () => {
    it('sends Text v5 byte for byte and stores the output exactly as generated, markers and all', async () => {
      const raw = '[[speech:JOY]]\nتمام [[say:مِلْك]] وده نص مكتوب.';
      reply(raw);
      await orchestrator.orchestrate('token', 'user', turnOf('hello'));
      expect(dispatched().behavioralGuidance).toBe(TEXT_V5_BEHAVIORAL_GUIDANCE);
      expect(storedContent()).toBe(raw);
      expect(channelOutcomes()).toEqual([]);
      expect(replySpeech.recordChannel).not.toHaveBeenCalled();
    });

    it('a malformed-looking output is not a failure for a typed turn', async () => {
      reply('شوف [[say:مِلْك وبعدين');
      await orchestrator.orchestrate('token', 'user', turnOf('hello'));
      expect(storedContent()).toBe('شوف [[say:مِلْك وبعدين');
      expect(repository.failTurn).not.toHaveBeenCalled();
    });
  });

  describe('a VOICE_NOTE turn', () => {
    it('sends Text v5 + TM-01 exactly (TM-03 is off in CP1) and nothing else changes', async () => {
      expect(SPEECH_HINT_POLICY).toBe('OFF');
      await orchestrator.orchestrate('token', 'user', turnOf('hello'), voice);
      expect(dispatched().behavioralGuidance).toBe(`${TEXT_V5_BEHAVIORAL_GUIDANCE}\n\n${VOICE_DELIVERY_LINE_GUIDANCE_TM_01}`);
      expect(router.generate).toHaveBeenCalledTimes(1);
    });

    it('separates the delivery line and stores only the visible reply; the expression is recorded after commit', async () => {
      reply('[[speech:JOY]]\nتمام، فرحت لك جدًا.');
      const result = await orchestrator.orchestrate('token', 'user', turnOf('hello'), voice);
      expect(storedContent()).toBe('تمام، فرحت لك جدًا.');
      expect(replySpeech.recordChannel).toHaveBeenCalledWith('user', ASSISTANT, 'JOY', []);
      expect(result.assistantTurn?.id).toBe(ASSISTANT);
      expect(channelOutcomes()).toEqual(['separate/success', 'record/success']);
    });

    it('no delivery line: the text is kept unchanged and the expression is CALM', async () => {
      reply('أهلا، سمعتك.');
      await orchestrator.orchestrate('token', 'user', turnOf('hello'), voice);
      expect(storedContent()).toBe('أهلا، سمعتك.');
      expect(replySpeech.recordChannel).toHaveBeenCalledWith('user', ASSISTANT, 'CALM', []);
    });

    it('a GUIDED Safety reply is never spoken PLAYFUL or JOY', async () => {
      decide({ category: 'HIGH_STAKES_MEDICAL_CRISIS', disposition: 'GUIDED', safetyGuidance: 'Be calm and supportive.' });
      reply('[[speech:PLAYFUL]]\nأنا معاك.');
      await orchestrator.orchestrate('token', 'user', turnOf('hello'), voice);
      expect(storedContent()).toBe('أنا معاك.');
      expect(replySpeech.recordChannel).toHaveBeenCalledWith('user', ASSISTANT, 'CALM', []);
    });

    it('valid hint markers are removed from the text; with the hint policy OFF none is kept', async () => {
      reply('[[speech:CALM]]\nالأرض دي ملك جدي. [[say:مِلْك]]');
      await orchestrator.orchestrate('token', 'user', turnOf('hello'), voice);
      expect(storedContent()).toBe('الأرض دي ملك جدي.');
      expect(replySpeech.recordChannel).toHaveBeenCalledWith('user', ASSISTANT, 'CALM', []);
    });

    it.each([
      ['a truncated marker', '[[speech:CALM]]\nتمام [[say:مِلْ'],
      ['a nested marker', '[[speech:CALM]]\nتمام [[say:[[say:مِلْك]]]] كده.'],
      ['a corrupted marker (one closing bracket)', '[[speech:CALM]]\nتمام [[say:مِلْك] كده.'],
      ['a marker inside a word', '[[speech:CALM]]\nتما[[say:مِلْك]]م'],
      ['markers only, nothing visible', '[[speech:CALM]]\n[[say:مِلْك]]'],
    ])('%s fails the turn closed: no finalize, no extra call, no substitute', async (_name, raw) => {
      reply(raw);
      await expect(orchestrator.orchestrate('token', 'user', turnOf('hello'), voice)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(router.generate).toHaveBeenCalledTimes(1);
      expect(repository.finalizeTurn).not.toHaveBeenCalled();
      expect(repository.failTurn).toHaveBeenCalledWith(SESSION, 'user', TURN);
      expect(replySpeech.recordChannel).not.toHaveBeenCalled();
      expect(channelOutcomes()).toEqual(['separate/malformed']);
    });

    it('a failure to record the channel never fails the committed reply', async () => {
      replySpeech.recordChannel.mockRejectedValue(new Error('down'));
      reply('[[speech:SERIOUS]]\nده مهم.');
      const result = await orchestrator.orchestrate('token', 'user', turnOf('hello'), voice);
      expect(result.assistantTurn?.id).toBe(ASSISTANT);
      expect(repository.failTurn).not.toHaveBeenCalled();
      expect(channelOutcomes()).toEqual(['separate/success', 'record/transport_failure']);
    });

    it('telemetry names classes only: never the reply, a word, a hint or an expression', async () => {
      reply('[[speech:JOY]]\nتمام، فرحت لك.');
      await orchestrator.orchestrate('token', 'user', turnOf('hello'), voice);
      for (const args of outcomes.mock.calls) for (const arg of args) expect(String(arg)).not.toMatch(/فرحت|JOY|\[\[/u);
    });

    it('a lookalike that is not a marker (a spaced opener) stays text, as written', async () => {
      reply('[[speech:CALM]]\nكتبت لي «[[ say:test]]» وده مش علامة.');
      await orchestrator.orchestrate('token', 'user', turnOf('hello'), voice);
      expect(storedContent()).toBe('كتبت لي «[[ say:test]]» وده مش علامة.');
    });
  });

  describe('the TM guidance texts (§11.4, verbatim)', () => {
    it('TM-01 / TM-03 append only to a voice note; TM-02 exists for S8B-05 and is wired nowhere', () => {
      expect(withVoiceNoteChannel('T', { hints: false })).toBe(`T\n\n${VOICE_DELIVERY_LINE_GUIDANCE_TM_01}`);
      expect(withVoiceNoteChannel('T', { hints: true })).toBe(`T\n\n${VOICE_DELIVERY_LINE_GUIDANCE_TM_01}\n\n${VOICE_PRONUNCIATION_HINT_GUIDANCE_TM_03}`);
      expect(withSpokenCallReply('T')).toBe(`T\n\n${VOICE_SPOKEN_REPLY_GUIDANCE_TM_02}`);
      expect(VOICE_DELIVERY_LINE_GUIDANCE_TM_01).toMatch(/^Begin your answer with one line exactly in the form \[\[speech:STYLE\]\]/u);
      expect(VOICE_PRONUNCIATION_HINT_GUIDANCE_TM_03).toContain('separated by |');
      expect(VOICE_SPOKEN_REPLY_GUIDANCE_TM_02).toMatch(/^This reply will be spoken aloud\./u);
    });
  });

  // S8B-04 (CP2, Fast Voice Path, D-S2): the same turn, streamed into the automatic voice reply.
  describe('a VOICE_NOTE turn with an automatic voice reply (CP2, D-S2)', () => {
    type Released = { piece: string; expression: string };
    const liveSink = () => {
      const released: Released[] = [];
      const ends: unknown[] = [];
      return {
        released, ends,
        sink: { replyId: 'reply-1', signal: new AbortController().signal, release: (piece: string, speech: { expression: string }) => released.push({ piece, expression: speech.expression }), end: (e: unknown) => ends.push(e) },
      };
    };
    const streamWith = (pieces: string[], result: Record<string, unknown>) => {
      (router as unknown as { stream: jest.Mock }).stream = jest.fn().mockImplementation(async (_req: unknown, options: { onRelease: (p: string, s: unknown) => void }) => {
        for (const piece of pieces) options.onRelease(piece, { expression: 'JOY', hints: [] });
        return { routingMetadata: { path: 'FAST' }, usage: { inputTokens: 1, outputTokens: 1 }, ...result };
      });
    };

    it('streams: released pieces are spoken while generating, the tail after; the stored reply is the complete text; the end is COMPLETE', async () => {
      const live = liveSink();
      streamWith(['أهلًا بك!'], { kind: 'COMPLETE', text: 'أهلًا بك! كيف حالك؟', tail: ' كيف حالك؟', expression: 'JOY', hints: [] });
      await orchestrator.orchestrate('token', 'user', turnOf('hello'), { ...voice, liveReply: live.sink as never });
      expect(router.generate).not.toHaveBeenCalled();
      expect(live.released.map((r) => r.piece)).toEqual(['أهلًا بك!', ' كيف حالك؟']);
      expect(storedContent()).toBe('أهلًا بك! كيف حالك؟');
      expect(replySpeech.recordChannel).toHaveBeenCalledWith('user', ASSISTANT, 'JOY', []);
      expect(live.ends).toEqual([{ kind: 'COMPLETE', assistantTurnId: ASSISTANT }]);
    });

    it('a whole that fails after a release keeps what was released (it may have been heard), stores it as WITHHELD_TAIL, never as a complete reply', async () => {
      const live = liveSink();
      repository.finalizeVoiceNoteWithheldTail = jest.fn().mockResolvedValue({ userTurn: turnOf('x'), assistantTurn: turnOf('أفهمك تمامًا.', ASSISTANT) });
      streamWith(['أفهمك تمامًا.'], { kind: 'WITHHELD_TAIL', released: 'أفهمك تمامًا.', reason: 'GUIDANCE_ECHO' });
      await orchestrator.orchestrate('token', 'user', turnOf('hello'), { ...voice, liveReply: live.sink as never });
      expect(repository.finalizeTurn).not.toHaveBeenCalled();
      expect(repository.finalizeVoiceNoteWithheldTail).toHaveBeenCalledWith(expect.objectContaining({ content: 'أفهمك تمامًا.', reason: 'GUIDANCE_ECHO', safetyDisposition: 'ALLOW' }));
      expect(replySpeech.recordChannel).not.toHaveBeenCalled();
      expect(live.ends).toEqual([{ kind: 'WITHHELD_TAIL', assistantTurnId: ASSISTANT }]);
    });

    it('nothing released and no complete reply: the turn fails exactly as today and the voice reply ends FAILED', async () => {
      const live = liveSink();
      (router as unknown as { stream: jest.Mock }).stream = jest.fn().mockRejectedValue(new Error('provider'));
      await expect(orchestrator.orchestrate('token', 'user', turnOf('hello'), { ...voice, liveReply: live.sink as never })).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(repository.failTurn).toHaveBeenCalled();
      expect(repository.finalizeTurn).not.toHaveBeenCalled();
      expect(live.released).toEqual([]);
      expect(live.ends).toEqual([{ kind: 'FAILED' }]);
    });

    it('a typed turn never streams, even if a voice reply were passed: the text path is unchanged', async () => {
      const live = liveSink();
      streamWith(['x.'], { kind: 'COMPLETE', text: 'x.', tail: '', expression: 'CALM', hints: [] });
      await orchestrator.orchestrate('token', 'user', turnOf('hello'), { liveReply: live.sink as never });
      expect(router.generate).toHaveBeenCalled();
      expect((router as unknown as { stream: jest.Mock }).stream).not.toHaveBeenCalled();
      expect(live.released).toEqual([]);
    });

    it('a Safety BLOCK reply (no provider) is spoken whole, CALM, then the end is COMPLETE', async () => {
      const live = liveSink();
      decide({ disposition: 'BLOCK', deterministicResponse: 'لا أستطيع المساعدة في هذا.' } as never);
      repository.finalizeTurn.mockResolvedValue({ userTurn: turnOf('x'), assistantTurn: turnOf('لا أستطيع المساعدة في هذا.', ASSISTANT) } as never);
      streamWith([], { kind: 'COMPLETE', text: '', tail: '', expression: 'CALM', hints: [] });
      await orchestrator.orchestrate('token', 'user', turnOf('hello'), { ...voice, liveReply: live.sink as never });
      expect((router as unknown as { stream: jest.Mock }).stream).not.toHaveBeenCalled();
      expect(live.released).toEqual([{ piece: 'لا أستطيع المساعدة في هذا.', expression: 'CALM' }]);
      expect(live.ends).toEqual([{ kind: 'COMPLETE', assistantTurnId: ASSISTANT }]);
    });
  });
});
