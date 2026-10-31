// S8B-02 CP1 (migration 0183; Product Owner decisions D-7 and P-1, 2026-10-30): the background Memory capture of a voice
// turn. A LOW band keeps nothing; HIGH / MEDIUM keep the typed grammar's candidate as MACHINE_ASR at the configured
// confidence (default 0.90 / 0.75, tunable below 0.95 - configuration, not accuracy); such a Memory is never fresh Evidence; a typed turn is unchanged.
import { BackgroundIntelligenceAuthorityService, type BackgroundIntelligenceExecutionContext } from './background-intelligence-authority.service';
import { BackgroundIntelligenceContextFactory } from './background-intelligence-context.factory';
import { BackgroundIntelligenceDataApiService, turnVoiceProvenance } from './background-intelligence-data-api.service';
import { BackgroundIntelligenceEnrichmentService } from './background-intelligence-enrichment.service';
import { MACHINE_ASR_MEMORY_CONFIDENCE_CEILING, MACHINE_ASR_MEMORY_CONFIDENCE_DEFAULTS, MemoryWriteEvaluatorService, loadMachineAsrMemoryConfidence, machineAsrMemoryCandidate } from '../memory/memory-write-evaluator.service';
import { MEMORY_SOURCES } from '../memory/memory.types';
import { HimReasoningConsumptionService } from '../human-model/him-reasoning-consumption.service';
import { HypothesisGenerationTriggerClassificationService } from '../hypothesis/hypothesis-generation-trigger-classification.service';
import type { RuntimeEventEnvelope } from '../runtime-events/runtime-event.types';

const IDS = { event: '10000000-0000-4000-8000-000000000001', user: '10000000-0000-4000-8000-000000000002', session: '10000000-0000-4000-8000-000000000003', turn: '10000000-0000-4000-8000-000000000004' };
const event: RuntimeEventEnvelope = {
  event_id: IDS.event, event_type: 'ConversationTurnCompleted', event_version: '2.0', occurred_at: '2026-01-01T00:00:00Z', producer: 'conversation-service',
  subject_user_id: IDS.user, subject_session_id: IDS.session, subject_turn_id: IDS.turn, correlation_id: null, causation_id: null, classification: 'SENSITIVE',
  schema_ref: 'qandeel.runtime.conversation-turn-completed.v2',
  payload: { user_id: IDS.user, session_id: IDS.session, source_turn_id: IDS.turn, terminal_status: 'COMPLETED', processing_path: 'FAST', routing_reason: 'FAST_DEFAULT', orchestration_id: null, safety_disposition: 'ALLOW' },
  contains_content: false, retention_class: 'OPERATIONAL_EVENT_V1',
} as RuntimeEventEnvelope;

async function authorize(): Promise<BackgroundIntelligenceExecutionContext> {
  const dataApi = {
    findSession: jest.fn().mockResolvedValue({ id: IDS.session, status: 'ACTIVE', channel: 'TEXT' }),
    findSourceTurn: jest.fn().mockResolvedValue({ id: IDS.turn, session_id: IDS.session, role: 'USER', status: 'COMPLETED', source_turn_id: null }),
    findCompletedAssistant: jest.fn().mockResolvedValue({ id: '10000000-0000-4000-8000-000000000005', session_id: IDS.session, role: 'ASSISTANT', status: 'COMPLETED', source_turn_id: IDS.turn }),
  } as unknown as BackgroundIntelligenceDataApiService;
  const result = await new BackgroundIntelligenceAuthorityService(new BackgroundIntelligenceContextFactory(), dataApi).authorize(event);
  if (result.outcome !== 'AUTHORIZED' || !result.context) throw new Error('test authority issuance failed');
  return result.context;
}

function enrichment(provenance: unknown) {
  const data = {
    readTurnVoiceProvenance: jest.fn().mockResolvedValue(provenance),
    listActiveMemories: jest.fn().mockResolvedValue([]),
    recordMemory: jest.fn().mockImplementation(async (_context: unknown, input: { id: string }) => ({ outcome: 'CREATED', memoryId: input.id })),
  } as unknown as jest.Mocked<BackgroundIntelligenceDataApiService>;
  const service = new BackgroundIntelligenceEnrichmentService(data, new MemoryWriteEvaluatorService(), new HypothesisGenerationTriggerClassificationService(), new HimReasoningConsumptionService());
  return { data, service };
}
const voice = (band: 'HIGH' | 'MEDIUM' | 'LOW') => ({ sourceModality: 'VOICE_NOTE', transcriptOrigin: 'MACHINE_ASR', asrConfidenceBand: band });
const FACT = 'أنا ساكنة في مدينة نصر';

describe('S8B-02 CP1: P-1 is controlled configuration', () => {
  it('defaults to exactly the Product Owner values, below the typed-text 0.95 / 0.98', () => {
    expect(MACHINE_ASR_MEMORY_CONFIDENCE_DEFAULTS).toEqual({ HIGH: 0.90, MEDIUM: 0.75 });
    expect(Object.isFrozen(MACHINE_ASR_MEMORY_CONFIDENCE_DEFAULTS)).toBe(true);
    expect(MACHINE_ASR_MEMORY_CONFIDENCE_CEILING).toBe(0.95);
    expect(loadMachineAsrMemoryConfidence({})).toEqual({ HIGH: 0.90, MEDIUM: 0.75 });
    expect(loadMachineAsrMemoryConfidence({ MACHINE_ASR_MEMORY_CONFIDENCE_HIGH: ' ', MACHINE_ASR_MEMORY_CONFIDENCE_MEDIUM: '' })).toEqual({ HIGH: 0.90, MEDIUM: 0.75 });
    expect(MEMORY_SOURCES).toContain('MACHINE_ASR');
  });

  it('is tuned without a code change, inside the safe bounds', () => {
    expect(loadMachineAsrMemoryConfidence({ MACHINE_ASR_MEMORY_CONFIDENCE_HIGH: '0.85', MACHINE_ASR_MEMORY_CONFIDENCE_MEDIUM: '0.6' })).toEqual({ HIGH: 0.85, MEDIUM: 0.6 });
    expect(loadMachineAsrMemoryConfidence({ MACHINE_ASR_MEMORY_CONFIDENCE_HIGH: '0.949' }).HIGH).toBe(0.949);
  });

  it('refuses to start on an unsafe value: at or above 0.95, not above 0, not a number, or MEDIUM above HIGH', () => {
    for (const value of ['0.95', '0.98', '1', '0', '-0.1', 'abc', 'NaN', 'Infinity']) {
      expect(() => loadMachineAsrMemoryConfidence({ MACHINE_ASR_MEMORY_CONFIDENCE_HIGH: value })).toThrow(/MACHINE_ASR_MEMORY_CONFIDENCE_HIGH must be greater than 0 and below 0.95/u);
      expect(() => loadMachineAsrMemoryConfidence({ MACHINE_ASR_MEMORY_CONFIDENCE_MEDIUM: value })).toThrow(/MACHINE_ASR_MEMORY_CONFIDENCE_MEDIUM must be greater than 0 and below 0.95/u);
    }
    expect(() => loadMachineAsrMemoryConfidence({ MACHINE_ASR_MEMORY_CONFIDENCE_HIGH: '0.7', MACHINE_ASR_MEMORY_CONFIDENCE_MEDIUM: '0.8' })).toThrow(/must not exceed/u);
  });

  it('maps a band: LOW keeps nothing, HIGH / MEDIUM keep the same candidate as MACHINE_ASR', () => {
    const typed = new MemoryWriteEvaluatorService().evaluate(FACT);
    if (typed.decision !== 'WRITE') throw new Error('the typed grammar must keep the fixture fact');
    expect(machineAsrMemoryCandidate(typed.candidate, 'LOW')).toEqual({ decision: 'SKIP', reason: 'LOW_CONFIDENCE_MACHINE_ASR' });
    expect(machineAsrMemoryCandidate(typed.candidate, 'HIGH')).toEqual({ decision: 'WRITE', candidate: { ...typed.candidate, source: 'MACHINE_ASR', confidence: 0.90 } });
    expect(machineAsrMemoryCandidate(typed.candidate, 'MEDIUM')).toEqual({ decision: 'WRITE', candidate: { ...typed.candidate, source: 'MACHINE_ASR', confidence: 0.75 } });
    expect(machineAsrMemoryCandidate(typed.candidate, 'UNKNOWN' as never)).toEqual({ decision: 'SKIP', reason: 'LOW_CONFIDENCE_MACHINE_ASR' });
    expect(machineAsrMemoryCandidate(typed.candidate, 'MEDIUM', { HIGH: 0.85, MEDIUM: 0.6 })).toEqual({ decision: 'WRITE', candidate: { ...typed.candidate, source: 'MACHINE_ASR', confidence: 0.6 } });
    expect(machineAsrMemoryCandidate(typed.candidate, 'LOW', { HIGH: 0.85, MEDIUM: 0.6 })).toEqual({ decision: 'SKIP', reason: 'LOW_CONFIDENCE_MACHINE_ASR' });
  });

  it('the background capture writes the configured value, read once when the service is built', async () => {
    const saved = { HIGH: process.env.MACHINE_ASR_MEMORY_CONFIDENCE_HIGH, MEDIUM: process.env.MACHINE_ASR_MEMORY_CONFIDENCE_MEDIUM };
    process.env.MACHINE_ASR_MEMORY_CONFIDENCE_HIGH = '0.82';
    try {
      const context = await authorize();
      const { data, service } = enrichment(voice('HIGH'));
      process.env.MACHINE_ASR_MEMORY_CONFIDENCE_HIGH = '0.5';
      await service.evaluateAndWriteMemory(context, FACT);
      expect(data.recordMemory).toHaveBeenCalledWith(context, expect.objectContaining({ source: 'MACHINE_ASR', confidence: 0.82 }));
      process.env.MACHINE_ASR_MEMORY_CONFIDENCE_HIGH = '0.97';
      expect(() => enrichment(voice('HIGH'))).toThrow(/below 0.95/u);
    } finally {
      for (const [band, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[`MACHINE_ASR_MEMORY_CONFIDENCE_${band}`];
        else process.env[`MACHINE_ASR_MEMORY_CONFIDENCE_${band}`] = value;
      }
    }
  });
});

describe('S8B-02 CP1: the background capture of a voice turn', () => {
  it('a typed turn is unchanged: USER_STATED at the typed confidence, fresh Evidence', async () => {
    const context = await authorize();
    const { data, service } = enrichment(undefined);
    await expect(service.evaluateAndWriteMemory(context, FACT)).resolves.toMatchObject({ decision: 'WRITE', type: 'PERSONAL_FACT' });
    expect(data.recordMemory).toHaveBeenCalledWith(context, expect.objectContaining({ source: 'USER_STATED', confidence: 0.95 }));
  });

  it('LOW keeps nothing and reads nothing more', async () => {
    const context = await authorize();
    const { data, service } = enrichment(voice('LOW'));
    await expect(service.evaluateAndWriteMemory(context, FACT)).resolves.toEqual({ decision: 'SKIP', reason: 'LOW_CONFIDENCE_MACHINE_ASR' });
    expect(data.listActiveMemories).not.toHaveBeenCalled();
    expect(data.recordMemory).not.toHaveBeenCalled();
  });

  // RE-ANCHORED by S8B-03 (CP1, E4): the S8B-02 skip line is removed - a HIGH / MEDIUM MACHINE_ASR Memory is fresh Evidence
  // (0186 E1 / E2) and proceeds to association, like a typed one.
  it.each([['HIGH', 0.90], ['MEDIUM', 0.75]] as const)('%s writes MACHINE_ASR at %s and it is fresh Evidence (S8B-03 E4)', async (band, confidence) => {
    const context = await authorize();
    const { data, service } = enrichment(voice(band));
    await expect(service.evaluateAndWriteMemory(context, FACT))
      .resolves.toEqual({ decision: 'WRITE', type: 'PERSONAL_FACT', memoryId: expect.any(String), evidenceId: expect.stringMatching(/^memory:/u) });
    expect(data.recordMemory).toHaveBeenCalledWith(context, expect.objectContaining({ source: 'MACHINE_ASR', confidence, content: 'أنا ساكنة في مدينة نصر.' }));
  });

  it('the typed grammar still decides first: a voice turn that would keep nothing reads no provenance', async () => {
    const context = await authorize();
    const { data, service } = enrichment(voice('HIGH'));
    await expect(service.evaluateAndWriteMemory(context, 'hello')).resolves.toEqual({ decision: 'SKIP', reason: 'NO_SUPPORTED_EXPLICIT_PATTERN' });
    expect(data.readTurnVoiceProvenance).not.toHaveBeenCalled();
  });
});

describe('S8B-02 CP1: the provenance read and the writer answer', () => {
  const saved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://database.invalid';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'SENTINEL_SERVICE_ROLE';
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => [] } as Response);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (saved.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = saved.url;
    if (saved.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key;
  });

  it('reads the content-free provenance through the server-channel definer, named by the context', async () => {
    const context = await authorize();
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ source_modality: 'LIVE_CALL_SPEECH', transcript_origin: 'MACHINE_ASR', asr_confidence_band: 'MEDIUM' }] } as Response);
    await expect(new BackgroundIntelligenceDataApiService().readTurnVoiceProvenance(context))
      .resolves.toEqual({ sourceModality: 'LIVE_CALL_SPEECH', transcriptOrigin: 'MACHINE_ASR', asrConfidenceBand: 'MEDIUM' });
    const [url, init] = (fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://database.invalid/rest/v1/rpc/server_read_turn_voice_provenance_v1');
    expect(JSON.parse(init.body as string)).toEqual({ p_user_id: context.userId, p_turn_id: context.sourceTurnId });
    await expect(new BackgroundIntelligenceDataApiService().readTurnVoiceProvenance(context)).resolves.toBeUndefined();
  });

  it('fails closed on any provenance shape the database cannot answer', () => {
    for (const rows of [null, {}, [{}, {}], [{ source_modality: 'TEXT', transcript_origin: 'MACHINE_ASR', asr_confidence_band: 'HIGH' }],
      [{ source_modality: 'VOICE_NOTE', transcript_origin: 'USER_STATED', asr_confidence_band: 'HIGH' }],
      [{ source_modality: 'VOICE_NOTE', transcript_origin: 'MACHINE_ASR', asr_confidence_band: null }]]) {
      expect(() => turnVoiceProvenance(rows, 'X')).toThrow('X');
    }
  });

  it('maps the writer LOW_CONFIDENCE_MACHINE_ASR answer, and only with no Memory', async () => {
    const context = await authorize();
    const service = new BackgroundIntelligenceDataApiService();
    const input = { id: '20000000-0000-4000-8000-000000000001', type: 'PERSONAL_FACT' as const, content: 'x', source: 'MACHINE_ASR' as const, confidence: 0.9, importance: 0.65, status: 'ACTIVE' as const };
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ outcome: 'LOW_CONFIDENCE_MACHINE_ASR', memory_id: null }] } as Response);
    await expect(service.recordMemory(context, input)).resolves.toEqual({ outcome: 'LOW_CONFIDENCE_MACHINE_ASR' });
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ outcome: 'LOW_CONFIDENCE_MACHINE_ASR', memory_id: input.id }] } as Response);
    await expect(service.recordMemory(context, input)).rejects.toThrow('BACKGROUND_MEMORY_RECORD_INTEGRITY');
  });
});
