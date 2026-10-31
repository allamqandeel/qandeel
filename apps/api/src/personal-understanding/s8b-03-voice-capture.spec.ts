// S8B-03 (CP1, E5 / E6 / E9 / E11, A10 / A14 / A15 / A22) — Open Understanding and a MACHINE_ASR source: the model lines
// M-01 … M-03 (approved verbatim), the per-band operations capture v4 allows, and the typed path left byte for byte as it
// was. The database refuses anything else (0186 v4) and is proven by database/verify-migration-0186.mjs.
import { PERSONAL_UNDERSTANDING_CAPTURE_INSTRUCTIONS, captureInstructions } from './deepseek-personal-understanding-capture.provider';
import { PersonalUnderstandingCaptureService } from './personal-understanding-capture.service';
import type { PersonalUnderstandingCaptureCommandV3, PersonalUnderstandingCaptureRequestV3 } from './personal-understanding.types';
import { MACHINE_ASR_SOURCE_GUIDANCE, TYPED_CONFIRMATION_GUIDANCE, voiceMessageGuidance } from '../memory/machine-asr-model-copy';
import type { TelemetryService } from '../observability/telemetry.service';

const request = (overrides: Partial<PersonalUnderstandingCaptureRequestV3> = {}): PersonalUnderstandingCaptureRequestV3 => ({
  schemaVersion: 3,
  currentUserText: 'أنا بقيت بشتغل من البيت',
  recentTurns: [],
  memories: [],
  known: [{ handle: 'k1', type: 'PERSONAL_FACT', content: 'أنا ساكن في طنطا', about: 'USER', temporal: 'CURRENT', ended: false }],
  ...overrides,
});
const voiceKnown = { handle: 'k2', type: 'PERSONAL_FACT' as const, content: 'أنا بحب الرسم', about: 'USER', temporal: null, ended: false,
  source: 'MACHINE_ASR' as const, confirmedByTyping: false };

describe('S8B-03 capture instructions (M-01 … M-03)', () => {
  it('a request with no voice anywhere is exactly the S8A-03 instructions', () => {
    expect(captureInstructions(request())).toBe(PERSONAL_UNDERSTANDING_CAPTURE_INSTRUCTIONS);
  });

  it('a MACHINE_ASR known item brings M-01, and on a typed message M-03', () => {
    expect(captureInstructions(request({ known: [voiceKnown] })))
      .toBe([PERSONAL_UNDERSTANDING_CAPTURE_INSTRUCTIONS, MACHINE_ASR_SOURCE_GUIDANCE, TYPED_CONFIRMATION_GUIDANCE].join(' '));
  });

  it.each(['HIGH', 'MEDIUM'] as const)('a %s voice message brings M-02 for its band and never M-03', (band) => {
    expect(captureInstructions(request({ voiceBand: band, known: [voiceKnown] })))
      .toBe([PERSONAL_UNDERSTANDING_CAPTURE_INSTRUCTIONS, MACHINE_ASR_SOURCE_GUIDANCE, voiceMessageGuidance(band)].join(' '));
  });

  it('M-02 replaces the band placeholder only', () => {
    expect(voiceMessageGuidance('HIGH')).toBe("This message was transcribed automatically from the user's voice (band HIGH). Recognition errors are possible, especially in negation, names and numbers. Do not propose forgetting anything from it.");
  });
});

describe('S8B-03 capture operations by band (§4.9.3, E6 / E11)', () => {
  const recordOperationalOutcome = jest.fn();
  const service = new PersonalUnderstandingCaptureService({} as never, {} as never, { recordOperationalOutcome } as unknown as TelemetryService);
  const command = {
    items: [{ memoryId: 'n1', subject: 'SELF' }, { memoryId: 'n2', subject: 'OTHER' }],
    index: [{ memoryId: 'n1' }, { memoryId: 'n2' }, { memoryId: 'old' }, { memoryId: 'c1' }],
    reaffirmed: ['r1'], ended: ['e1'], forget: ['f1'],
    corrections: [{ memoryId: 'c1', targetMemoryId: 't1' }], confirmed: ['k1'], audit: [],
  } as unknown as PersonalUnderstandingCaptureCommandV3;
  const ids = (entries: ReadonlyArray<{ memoryId: string }>) => entries.map((entry) => entry.memoryId);

  beforeEach(() => recordOperationalOutcome.mockClear());

  it('a typed turn passes unchanged and counts nothing', () => {
    expect(service.withinVoiceBand(command, null)).toBe(command);
    expect(recordOperationalOutcome).not.toHaveBeenCalled();
  });

  it('LOW keeps only the backfilled index; every operation is withheld and counted', () => {
    const kept = service.withinVoiceBand(command, 'LOW');
    expect(kept).toMatchObject({ items: [], reaffirmed: [], ended: [], corrections: [], forget: [], confirmed: [] });
    expect(ids(kept.index)).toEqual(['old']);
    expect(recordOperationalOutcome).toHaveBeenCalledTimes(7);
    expect(recordOperationalOutcome).toHaveBeenCalledWith('VOICE_CAPTURE_OPERATION_WITHHELD', 'capture', 'withheld');
  });

  it('MEDIUM keeps the user\'s own facts and restatements only', () => {
    const kept = service.withinVoiceBand(command, 'MEDIUM');
    expect(ids(kept.items)).toEqual(['n1']);
    expect(kept).toMatchObject({ reaffirmed: ['r1'], ended: [], corrections: [], forget: [], confirmed: [] });
    expect(ids(kept.index)).toEqual(['n1', 'old']);
    expect(recordOperationalOutcome).toHaveBeenCalledTimes(5);
  });

  it('HIGH keeps everything but forgetting (and never a typed confirmation)', () => {
    const kept = service.withinVoiceBand(command, 'HIGH');
    expect(ids(kept.items)).toEqual(['n1', 'n2']);
    expect(kept).toMatchObject({ reaffirmed: ['r1'], ended: ['e1'], forget: [], confirmed: [] });
    expect(ids(kept.corrections)).toEqual(['c1']);
    expect(recordOperationalOutcome).toHaveBeenCalledTimes(2);
  });

  it('E11: without facts about someone else, when the database refused a person label', () => {
    const kept = service.withoutOtherPeople(command);
    expect(ids(kept.items)).toEqual(['n1']);
    expect(ids(kept.index)).toEqual(['n1', 'old', 'c1']);
    expect(recordOperationalOutcome).toHaveBeenCalledTimes(1);
  });
});
