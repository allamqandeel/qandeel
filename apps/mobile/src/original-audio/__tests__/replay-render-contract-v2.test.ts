/**
 * S8B-07 CP1-B step 5 (Sheet B) — the composite's two approved render contracts: V2 (0195, D-04) is honoured exactly, value
 * for value, and only under V2 is an ORIGINAL_AUDIO moment renderable; V1 keeps refusing audio, MIXED is refused under
 * both, and any other tuple is refused whole. The V1 pins of S7-03 are unchanged (`replay-composite.test.tsx`).
 */
import type { ReplayHistoryMoment, ReplayHistoryVersion } from '../../runtime-entry';
import {
  REPLAY_RENDER_CONTRACT_V1, REPLAY_RENDER_CONTRACT_V2, discloseReplayMoment, honoursRenderContract, isRenderableMedium, renderContractOf,
} from '../../replay-composite';
import { REPLAY_WIRE, replayWireClient } from '../../replay-composite/__fixtures__/replay-wire';

const scene = REPLAY_WIRE.scenes.main;
let MAIN_VERSION: ReplayHistoryVersion;
let MAIN_MOMENTS: readonly ReplayHistoryMoment[];
let ANALYSIS: Parameters<typeof discloseReplayMoment>[2];

beforeAll(async () => {
  const client = replayWireClient(scene);
  const version = await client.version(scene.replayId, scene.versionId);
  const moments = await client.moments(scene.replayId, scene.versionId);
  const answer = await client.momentAnalysis(scene.replayId, scene.versionId, 4, 'SOURCE_PROVENANCE');
  if (version.kind !== 'FOUND' || moments.kind !== 'FOUND' || answer.kind !== 'ANSWERED' || answer.analysis.outcome !== 'AVAILABLE') throw new Error('the fixture scene must decode');
  MAIN_VERSION = version.version;
  MAIN_MOMENTS = moments.moments;
  ANALYSIS = answer.analysis;
});

const under = (contract: typeof REPLAY_RENDER_CONTRACT_V1 | typeof REPLAY_RENDER_CONTRACT_V2): ReplayHistoryVersion => ({
  ...MAIN_VERSION,
  renderContract: { ...MAIN_VERSION.renderContract, schema: contract.schema, sourceMediumClass: contract.sourceMediumClass, policies: { ...contract.policies } },
});
const fresh = () => JSON.parse(JSON.stringify(ANALYSIS)) as typeof ANALYSIS;

describe('the V2 render contract', () => {
  it('mirrors the API\'s tuple value for value: V1\'s policies except the source text and the timing', () => {
    expect(REPLAY_RENDER_CONTRACT_V2.schema).toBe('QANDEEL_REPLAY_RENDER_CONTRACT_V2');
    expect(REPLAY_RENDER_CONTRACT_V2.sourceMediumClass).toBe('ORIGINAL_MEDIA_PRESERVED');
    expect(REPLAY_RENDER_CONTRACT_V2.policies).toEqual({
      ...REPLAY_RENDER_CONTRACT_V1.policies,
      sourceText: 'EXACT_SOURCE_TEXT_AUDIO_TRANSCRIPT_DERIVED',
      timingIntegrity: 'ORIGINAL_SOURCE_CLOCK_WITH_DECLARED_TEXT_PACING',
    });
    expect(Object.isFrozen(REPLAY_RENDER_CONTRACT_V2.policies)).toBe(true);
  });

  it('is honoured exactly; any other value under its schema, or a V1 / V2 hybrid, is refused whole', () => {
    expect(renderContractOf(MAIN_VERSION)).toBe('V1');
    expect(renderContractOf(under(REPLAY_RENDER_CONTRACT_V2))).toBe('V2');
    const v2 = under(REPLAY_RENDER_CONTRACT_V2);
    const hybrid = { ...v2, renderContract: { ...v2.renderContract, policies: { ...v2.renderContract.policies, timingIntegrity: 'PRESENTATION_PACING_DECLARED' } } };
    expect(renderContractOf(hybrid)).toBeNull();
    expect(honoursRenderContract(hybrid)).toBe(false);
    const wrongClass = { ...v2, renderContract: { ...v2.renderContract, sourceMediumClass: 'ORIGINAL_TEXT_ONLY' } };
    expect(renderContractOf(wrongClass)).toBeNull();
    const unknown = { ...v2, renderContract: { ...v2.renderContract, schema: 'QANDEEL_REPLAY_RENDER_CONTRACT_V3' } };
    expect(renderContractOf(unknown)).toBeNull();
  });

  it('renders an ORIGINAL_AUDIO moment only under V2; MIXED never; text always', () => {
    const moment = MAIN_MOMENTS[3]!;
    const audio = { ...moment, originalMedium: 'ORIGINAL_AUDIO' as const };
    const mixed = { ...moment, originalMedium: 'MIXED' as unknown as ReplayHistoryMoment['originalMedium'] };
    expect(isRenderableMedium(moment)).toBe(true);
    expect(isRenderableMedium(audio)).toBe(false);
    expect(isRenderableMedium(audio, MAIN_VERSION)).toBe(false);
    expect(isRenderableMedium(audio, under(REPLAY_RENDER_CONTRACT_V2))).toBe(true);
    expect(isRenderableMedium(mixed, under(REPLAY_RENDER_CONTRACT_V2))).toBe(false);
    expect(isRenderableMedium(mixed, MAIN_VERSION)).toBe(false);
  });

  it('discloses an audio moment\'s analysis under V2 as it does a text moment\'s, and refuses it under V1', () => {
    const moment = MAIN_MOMENTS[3]!;
    const audio = { ...moment, originalMedium: 'ORIGINAL_AUDIO' as const };
    expect(discloseReplayMoment(MAIN_VERSION, audio, fresh())).toEqual({ status: 'REFUSED', reason: 'MEDIUM_NOT_RENDERABLE' });
    const v2 = discloseReplayMoment(under(REPLAY_RENDER_CONTRACT_V2), audio, fresh());
    const v1 = discloseReplayMoment(MAIN_VERSION, moment, fresh());
    expect(v2.status).toBe('DISCLOSED');
    expect(v1.status).toBe('DISCLOSED');
    if (v2.status !== 'DISCLOSED' || v1.status !== 'DISCLOSED') return;
    // The same analysis, the same projection: the medium changes what is heard, never what is drawn (§ audio / graphics).
    expect(v2.entry.value).toEqual(v1.entry.value);
  });
});
