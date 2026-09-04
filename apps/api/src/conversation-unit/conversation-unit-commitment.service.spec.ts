import { ConversationUnitCommitmentService } from './conversation-unit-commitment.service';
import {
  CU_BOUNDARY_EVALUATOR_VERSION,
  CU_COMMITMENT_POLICY_VERSION,
  CommitmentRejectedError,
  type CommitmentSource,
} from './conversation-unit.types';
import { codePointLength, sliceByCodePoints } from './cu-anchor-mapper';
import { CU_SEGMENTATION_PROMPT_VERSION } from './cu-segmentation-provider.config';
import { FakeCuSegmentationProvider } from './fake-cu-segmentation.provider';

const E1 = 'أنا سبت الشغل امبارح. وبالمناسبة أحمد كلمني. ممكن نرجع لموضوع السفر؟';
const E9 = 'فاهمك، بس مش مقتنع إن ده السبب.';

const SOURCE: CommitmentSource = {
  sessionId: '33333333-3333-4333-8333-333333333333',
  userId: '44444444-4444-4444-8444-444444444444',
  turnId: '55555555-5555-4555-8555-555555555555',
  role: 'USER',
  status: 'COMPLETED',
  channel: 'TEXT',
  content: E1,
  sourceFrontier: 0,
};

const ids = (...values: string[]) => {
  let index = 0;
  return () => values[index++] ?? `99999999-9999-4999-8999-${String(index).padStart(12, '0')}`;
};

const service = (provider: FakeCuSegmentationProvider) =>
  new ConversationUnitCommitmentService(provider, 'OPENAI', 'gpt-5-mini');

const rejection = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CommitmentRejectedError) return error.reason;
    throw error;
  }
  throw new Error('expected a commitment rejection');
};

describe('committed CU constitution', () => {
  it('turns one completed turn into multiple independently addressable units (Stage 1.2 E1)', async () => {
    const provider = FakeCuSegmentationProvider.withAnchors([
      { text: 'أنا سبت الشغل امبارح.', occurrence: 1 },
      { text: 'وبالمناسبة أحمد كلمني.', occurrence: 1 },
      { text: 'ممكن نرجع لموضوع السفر؟', occurrence: 1 },
    ]);
    const batch = await service(provider).evaluate(SOURCE, {
      batchId: '66666666-6666-4666-8666-666666666666',
      newUnitId: ids('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
    });

    expect(batch.units).toHaveLength(3);
    expect(batch.units.map((unit) => sliceByCodePoints(E1, { start: unit.spanStart, end: unit.spanEnd }))).toEqual([
      'أنا سبت الشغل امبارح.',
      'وبالمناسبة أحمد كلمني.',
      'ممكن نرجع لموضوع السفر؟',
    ]);
    expect(batch.evaluatorVersion).toBe(CU_BOUNDARY_EVALUATOR_VERSION);
    expect(batch.policyVersion).toBe(CU_COMMITMENT_POLICY_VERSION);
    expect(batch.segmentationPromptVersion).toBe(CU_SEGMENTATION_PROMPT_VERSION);
  });

  it('carries no wording, role, speaker state, modality, digest, ordinal, SP or fingerprint to the database', async () => {
    const provider = FakeCuSegmentationProvider.withAnchors([{ text: E1, occurrence: 1 }]);
    const batch = await service(provider).evaluate(SOURCE);
    expect(Object.keys(batch.units[0]).sort()).toEqual(['spanEnd', 'spanStart', 'unitId']);
    expect(JSON.stringify(batch)).not.toMatch(
      /committedText|committed_text|sourceRole|source_role|speakerState|speaker_state|modality|sha256|digest|ordinal|fingerprint|sessionPosition|liveHead/u,
    );
  });

  it('keeps a multi-function contribution as one unit (Stage 1.2 CU-04 / E9)', async () => {
    const provider = FakeCuSegmentationProvider.withAnchors([
      { text: 'فاهمك،', occurrence: 1 },
      { text: 'بس مش مقتنع إن ده السبب.', occurrence: 1 },
    ]);
    const batch = await service(provider).evaluate({ ...SOURCE, content: E9 });
    // Acknowledgment and challenge are two contributions, not four labelled copies.
    expect(batch.units).toHaveLength(2);
    expect(new Set(batch.units.map((unit) => unit.unitId)).size).toBe(2);
  });

  it('accepts the legal zero-CU result without inventing a unit', async () => {
    const batch = await service(FakeCuSegmentationProvider.withAnchors([])).evaluate(SOURCE);
    expect(batch.units).toEqual([]);
  });

  it('is reusable for a retry: the same prepared batch keeps its identities', async () => {
    const provider = FakeCuSegmentationProvider.withAnchors([{ text: E1, occurrence: 1 }]);
    const batch = await service(provider).evaluate(SOURCE, {
      batchId: '77777777-7777-4777-8777-777777777777',
      newUnitId: ids('dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
    });
    expect(batch.batchId).toBe('77777777-7777-4777-8777-777777777777');
    expect(batch.units[0].unitId).toBe('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  });
});

describe('eligibility gate (the four INPUT-01 conditions, fail-fast)', () => {
  it('refuses provisional, cancelled, failed and superseded source', async () => {
    const provider = FakeCuSegmentationProvider.withAnchors([{ text: E1, occurrence: 1 }]);
    for (const status of ['RECEIVED', 'GENERATING', 'STREAMING', 'CANCELLED', 'FAILED', 'SUPERSEDED']) {
      expect(await rejection(service(provider).evaluate({ ...SOURCE, status }))).toBe('SOURCE_TURN_NOT_COMMITTABLE');
    }
    expect(provider.requests).toHaveLength(0);
  });

  it('refuses a SYSTEM source turn', async () => {
    const provider = FakeCuSegmentationProvider.withAnchors([]);
    expect(await rejection(service(provider).evaluate({ ...SOURCE, role: 'SYSTEM' }))).toBe('UNSUPPORTED_SOURCE_ROLE');
    expect(provider.requests).toHaveLength(0);
  });

  it('refuses a non-TEXT modality', async () => {
    const provider = FakeCuSegmentationProvider.withAnchors([]);
    expect(await rejection(service(provider).evaluate({ ...SOURCE, channel: 'VOICE' }))).toBe(
      'UNSUPPORTED_SOURCE_MODALITY',
    );
    expect(provider.requests).toHaveLength(0);
  });
});

describe('fail-closed evaluation', () => {
  it('never collapses a turn to one CU when the provider is unavailable', async () => {
    for (const failure of ['UNAVAILABLE', 'TIMEOUT', 'INVALID_STRUCTURED_OUTPUT', 'PROVIDER_ERROR'] as const) {
      expect(await rejection(service(FakeCuSegmentationProvider.failing(failure)).evaluate(SOURCE))).toBe(
        'SEGMENTATION_UNAVAILABLE',
      );
    }
  });

  it('rejects a paraphrase rather than committing invented wording', async () => {
    const provider = FakeCuSegmentationProvider.withAnchors([{ text: 'I left my job yesterday', occurrence: 1 }]);
    expect(await rejection(service(provider).evaluate(SOURCE))).toBe('NON_EXTRACTIVE_ANCHOR');
  });

  it('rejects out-of-order anchors', async () => {
    const provider = FakeCuSegmentationProvider.withAnchors([
      { text: 'ممكن نرجع لموضوع السفر؟', occurrence: 1 },
      { text: 'أنا سبت الشغل امبارح.', occurrence: 1 },
    ]);
    expect(await rejection(service(provider).evaluate(SOURCE))).toBe('ANCHOR_BEFORE_CURSOR');
  });

  it('applies the committed source frontier to a new evaluation', async () => {
    const provider = FakeCuSegmentationProvider.withAnchors([{ text: 'أنا سبت الشغل امبارح.', occurrence: 1 }]);
    const frontier = codePointLength('أنا سبت الشغل امبارح.');
    expect(await rejection(service(provider).evaluate({ ...SOURCE, sourceFrontier: frontier }))).toBe(
      'ANCHOR_BEFORE_CURSOR',
    );
  });

  it('permits a later suffix evaluation after the frontier', async () => {
    const provider = FakeCuSegmentationProvider.withAnchors([{ text: 'ممكن نرجع لموضوع السفر؟', occurrence: 1 }]);
    const frontier = codePointLength('أنا سبت الشغل امبارح.');
    const batch = await service(provider).evaluate({ ...SOURCE, sourceFrontier: frontier });
    expect(batch.units[0].spanStart).toBeGreaterThanOrEqual(frontier);
  });
});
