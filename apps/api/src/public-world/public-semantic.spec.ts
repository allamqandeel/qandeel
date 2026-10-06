import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ROUTE_RATE_LIMIT_CENSUS } from '../http-security/route-rate-limit.census';
import {
  FakePublicSemanticInterpreter, PUBLIC_SEMANTIC_INTERPRETATION_CONTRACT, UnconfiguredPublicSemanticInterpreter,
  createConfiguredPublicSemanticInterpreter, decodePublicSemanticAssessment, decodePublicSemanticProposal,
  type PublicSemanticInterpreter, type PublicSemanticPackageInput,
} from './public-semantic-interpreter';
import type { PublicSemanticRepository } from './public-semantic.repository';
import { PublicSemanticService } from './public-semantic.service';

const TOKEN = 'reader-token';
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const COMMAND = id(1);
const EXPERIENCE = id(2);
const WORK = id(3);
const INTERPRETATION = id(4);

const PROPOSAL = {
  meaning: 'Fear for a family while work feels uncertain', primaryThemes: ['fear', 'family'], secondaryThemes: ['work'],
  explanation: 'The words keep returning to the people who depend on the speaker.', placementIntent: { lensKey: 'family.fear' },
};
const inputRows = (kind: 'PROPOSAL' | 'CORRECTION' = 'PROPOSAL', correction: Record<string, unknown> = {}) => [
  { work_kind: kind, item_ordinal: 1, item_kind: 'SOURCE_CONTENT', item_text: 'the exact committed human sentence',
    correction_meaning: null, correction_primary_themes: null, correction_secondary_themes: null, ...correction },
  { work_kind: kind, item_ordinal: 2, item_kind: 'ANALYSIS', item_text: 'the analysis QANDEEL produced',
    correction_meaning: null, correction_primary_themes: null, correction_secondary_themes: null, ...correction },
];
const reviewRow = (extra: Record<string, unknown> = {}) => ({
  semantic_state: 'AWAITING_REVIEW', current_lifecycle: 'READY_FOR_REVIEW', version_ordinal: 1, interpretation_id: INTERPRETATION,
  interpretation_revision: 1, interpretation_origin: 'QANDEEL_PROPOSAL', meaning: PROPOSAL.meaning, primary_themes: PROPOSAL.primaryThemes,
  secondary_themes: PROPOSAL.secondaryThemes, explanation: PROPOSAL.explanation, review_decision: null, semantically_ready: false, ...extra,
});

function repository(overrides: Partial<Record<keyof PublicSemanticRepository, jest.Mock>> = {}) {
  return {
    review: jest.fn(async () => [reviewRow()]),
    requestProposal: jest.fn(async () => [{ outcome: 'WORK_OPEN', work_id: WORK }]),
    requestCorrection: jest.fn(async () => [{ outcome: 'WORK_OPEN', work_id: WORK }]),
    commit: jest.fn(async () => [{ outcome: 'PROPOSED', interpretation_id: INTERPRETATION, interpretation_revision: 1 }]),
    accept: jest.fn(async () => [{ outcome: 'ACCEPTED' }]),
    workInput: jest.fn(async () => inputRows()),
    recordOutcome: jest.fn(async () => [{ outcome: 'RECORDED' }]),
    ...overrides,
  };
}
function interpreter(overrides: Partial<Record<keyof PublicSemanticInterpreter, jest.Mock>> = {}) {
  return {
    propose: jest.fn(async () => PROPOSAL),
    assessCorrection: jest.fn(async () => ({ verdict: 'CONSISTENT', placementIntent: { lensKey: 'parenthood.fear' } })),
    ...overrides,
  };
}
const service = (repo = repository(), semantic = interpreter()) =>
  new PublicSemanticService(repo as unknown as PublicSemanticRepository, semantic as unknown as PublicSemanticInterpreter);

describe('S5-03A — PUBLIC PACKAGE ONLY: the interpreter sees exactly what the database served, and nothing else', () => {
  it('builds the input from the package-only reader alone — no token, user, identity, alias or private context', async () => {
    const repo = repository();
    const semantic = interpreter();
    await expect(service(repo, semantic).proposal(TOKEN, EXPERIENCE, { commandId: COMMAND })).resolves.toEqual({ outcome: 'PROPOSED' });
    expect(repo.workInput).toHaveBeenCalledWith(WORK);
    expect(semantic.propose).toHaveBeenCalledTimes(1);
    const [given] = semantic.propose.mock.calls[0] as unknown as [PublicSemanticPackageInput];
    expect(given).toEqual({ contract: PUBLIC_SEMANTIC_INTERPRETATION_CONTRACT, items: [
      { ordinal: 1, kind: 'SOURCE_CONTENT', text: 'the exact committed human sentence' },
      { ordinal: 2, kind: 'ANALYSIS', text: 'the analysis QANDEEL produced' },
    ] });
    expect(JSON.stringify(given)).not.toContain(TOKEN);
    expect(Object.keys(given).sort()).toEqual(['contract', 'items']);
  });

  it('assesses a correction with the words the DATABASE stored, never the client body', async () => {
    const stored = { correction_meaning: 'A parent afraid of losing work', correction_primary_themes: ['parenthood'], correction_secondary_themes: ['work'] };
    const repo = repository({
      workInput: jest.fn(async () => inputRows('CORRECTION', stored)),
      commit: jest.fn(async () => [{ outcome: 'CORRECTED', interpretation_id: id(5), interpretation_revision: 2 }]),
    });
    const semantic = interpreter();
    await expect(service(repo, semantic).correction(TOKEN, EXPERIENCE, {
      commandId: COMMAND, interpretationId: INTERPRETATION, meaning: 'A parent afraid of losing work', primaryThemes: ['parenthood'], secondaryThemes: ['work'],
    })).resolves.toEqual({ outcome: 'CORRECTED' });
    const [given] = semantic.assessCorrection.mock.calls[0] as unknown as [{ correction: unknown; items: unknown[] }];
    expect(given.correction).toEqual({ meaning: stored.correction_meaning, primaryThemes: ['parenthood'], secondaryThemes: ['work'] });
    expect(given.items).toHaveLength(2);
    expect(repo.recordOutcome).toHaveBeenCalledWith(WORK, 'CONSISTENT', { lensKey: 'parenthood.fear', meaning: null, primaryThemes: null, secondaryThemes: null, explanation: null });
  });

  it('holds no Personal, Shared, memory, Human Intelligence or account source to give the interpreter', () => {
    for (const file of ['public-semantic.service.ts', 'public-semantic.repository.ts', 'public-semantic-interpreter.ts', 'public-semantic.controller.ts']) {
      const text = readFileSync(join(__dirname, file), 'utf8').replace(/^\s*(\/\/|\*|\/\*\*).*$/gmu, '');
      expect(text).not.toMatch(/memory|bhimb|humanIntelligence|hypothes|shared_world|SharedWorld|provenance|matching|MODEL_ROUTER|ModelRouter|console\.|Logger|telemetry/iu);
    }
  });
});

describe('S5-03A — the client supplies its own command and its own words, and nothing it could forge', () => {
  it('asks for a proposal with a command id alone', async () => {
    const repo = repository();
    for (const body of [{ commandId: COMMAND, userId: id(9) }, { commandId: COMMAND, lensKey: 'x' }, { commandId: COMMAND, ready: true },
      { commandId: COMMAND, semanticReadiness: 'SEMANTICALLY_READY' }, { commandId: COMMAND, meaning: 'mine' }, { commandId: 'x' }, {}, null, []]) {
      expect(() => service(repo).proposal(TOKEN, EXPERIENCE, body)).toThrow(BadRequestException);
    }
    expect(repo.requestProposal).not.toHaveBeenCalled();
  });

  it('refuses a correction that is a map control, an authority claim or malformed — before any database call', async () => {
    const repo = repository();
    const base = { commandId: COMMAND, interpretationId: INTERPRETATION, meaning: 'A parent afraid of losing work', primaryThemes: ['parenthood'], secondaryThemes: [] };
    for (const extra of [{ x: 0.2, y: 0.7 }, { coordinates: [1, 2] }, { lensKey: 'family' }, { nearExperienceId: id(8) }, { rank: 1 },
      { weight: 3 }, { vector: [0.1, 0.2] }, { embedding: [1] }, { proximityTarget: id(8) }, { userId: id(9) }, { controller: id(9) },
      { lifecycle: 'PUBLISHED' }, { semanticReadiness: 'SEMANTICALLY_READY' }, { fingerprint: 'sha256:00' }]) {
      expect(() => service(repo).correction(TOKEN, EXPERIENCE, { ...base, ...extra })).toThrow(BadRequestException);
    }
    for (const bad of [{ meaning: '' }, { meaning: ' padded' }, { meaning: 'x'.repeat(121) }, { meaning: 'two\nlines' }, { meaning: `next to ${id(8)}` },
      { primaryThemes: [] }, { primaryThemes: ['a', 'b', 'c', 'd'] }, { primaryThemes: ['fear', 'Fear'] }, { primaryThemes: ['t'.repeat(41)] },
      { primaryThemes: ['fear'], secondaryThemes: ['fear'] }, { secondaryThemes: ['a', 'b', 'c', 'd'] }, { interpretationId: 'x' }, { primaryThemes: 'fear' }]) {
      expect(() => service(repo).correction(TOKEN, EXPERIENCE, { ...base, ...bad })).toThrow(BadRequestException);
    }
    expect(repo.requestCorrection).not.toHaveBeenCalled();
    await service(repo).correction(TOKEN, EXPERIENCE, base);
    expect(repo.requestCorrection).toHaveBeenCalledWith(TOKEN, COMMAND, EXPERIENCE, INTERPRETATION, base.meaning, ['parenthood'], []);
  });

  it('accepts exactly the revision seen, by its id', async () => {
    const repo = repository();
    await expect(service(repo).accept(TOKEN, EXPERIENCE, { commandId: COMMAND, interpretationId: INTERPRETATION })).resolves.toEqual({ outcome: 'ACCEPTED' });
    expect(repo.accept).toHaveBeenCalledWith(TOKEN, COMMAND, EXPERIENCE, INTERPRETATION);
    for (const body of [{ commandId: COMMAND }, { commandId: COMMAND, interpretationId: INTERPRETATION, decision: 'ACCEPTED' }, { commandId: COMMAND, interpretationId: 'x' }]) {
      expect(() => service(repo).accept(TOKEN, EXPERIENCE, body)).toThrow(BadRequestException);
    }
    const odd = repository({ accept: jest.fn(async () => [{ outcome: 'PUBLISHED' }]) });
    await expect(service(odd).accept(TOKEN, EXPERIENCE, { commandId: COMMAND, interpretationId: INTERPRETATION })).rejects.toThrow(ServiceUnavailableException);
  });

  it('answers a guessed or malformed Experience id with one neutral outcome and no call', async () => {
    const repo = repository();
    await expect(service(repo).review(TOKEN, 'nope')).resolves.toEqual({ state: 'UNAVAILABLE', ready: false });
    await expect(service(repo).proposal(TOKEN, 'nope', { commandId: COMMAND })).resolves.toEqual({ outcome: 'UNAVAILABLE' });
    expect(repo.review).not.toHaveBeenCalled();
    const none = repository({ review: jest.fn(async () => []) });
    await expect(service(none).review(TOKEN, EXPERIENCE)).resolves.toEqual({ state: 'UNAVAILABLE', ready: false });
  });
});

describe('S5-03A — the proposal and the correction fail closed', () => {
  it('adopts a staged answer without calling the interpreter again', async () => {
    const repo = repository({ requestProposal: jest.fn(async () => [{ outcome: 'WORK_STAGED', work_id: WORK }]) });
    const semantic = interpreter();
    await expect(service(repo, semantic).proposal(TOKEN, EXPERIENCE, { commandId: COMMAND })).resolves.toEqual({ outcome: 'PROPOSED' });
    expect(semantic.propose).not.toHaveBeenCalled();
    expect(repo.workInput).not.toHaveBeenCalled();
    expect(repo.commit).toHaveBeenCalledWith(TOKEN, WORK);
  });

  it('turns an unavailable, hung, malformed or widened interpreter answer into INTERPRETATION_UNAVAILABLE, recording nothing', async () => {
    for (const propose of [
      jest.fn(async () => { throw new Error('provider down'); }),
      jest.fn(async () => ({ ...PROPOSAL, coordinates: { x: 1, y: 2 } })),
      jest.fn(async () => ({ ...PROPOSAL, placementIntent: { lensKey: 'family', x: 0.4 } })),
      jest.fn(async () => ({ ...PROPOSAL, meaning: 'two\nlines' })),
      jest.fn(async () => ({ ...PROPOSAL, primaryThemes: [] })),
      jest.fn(async () => ({ ...PROPOSAL, placementIntent: { lensKey: 'Not A Key' } })),
      jest.fn(async () => 'free prose only'),
      jest.fn(async () => null),
    ]) {
      const repo = repository();
      await expect(service(repo, interpreter({ propose })).proposal(TOKEN, EXPERIENCE, { commandId: COMMAND })).resolves.toEqual({ outcome: 'INTERPRETATION_UNAVAILABLE' });
      expect(repo.recordOutcome).not.toHaveBeenCalled();
      expect(repo.commit).not.toHaveBeenCalled();
    }
  });

  it('maps the database\'s refusals: a copying answer, a stale or an erased package', async () => {
    const copying = repository({ recordOutcome: jest.fn(async () => [{ outcome: 'COPIES_PACKAGE' }]) });
    await expect(service(copying).proposal(TOKEN, EXPERIENCE, { commandId: COMMAND })).resolves.toEqual({ outcome: 'INTERPRETATION_UNAVAILABLE' });
    expect(copying.commit).not.toHaveBeenCalled();
    const erased = repository({ workInput: jest.fn(async () => []) });
    const semantic = interpreter();
    await expect(service(erased, semantic).proposal(TOKEN, EXPERIENCE, { commandId: COMMAND })).resolves.toEqual({ outcome: 'STALE' });
    expect(semantic.propose).not.toHaveBeenCalled();
    for (const outcome of ['STALE', 'UNAVAILABLE']) {
      const repo = repository({ recordOutcome: jest.fn(async () => [{ outcome }]) });
      await expect(service(repo).proposal(TOKEN, EXPERIENCE, { commandId: COMMAND })).resolves.toEqual({ outcome });
    }
    for (const outcome of ['ALREADY_INTERPRETED', 'NOT_READY_FOR_REVIEW', 'UNAVAILABLE', 'STALE', 'LIMITED']) {
      const repo = repository({ requestProposal: jest.fn(async () => [{ outcome, work_id: null }]) });
      await expect(service(repo).proposal(TOKEN, EXPERIENCE, { commandId: COMMAND })).resolves.toEqual({ outcome });
      expect(repo.workInput).not.toHaveBeenCalled();
    }
  });

  it('records NOT_SUPPORTED for a correction the package does not support, and commits nothing new', async () => {
    const stored = { correction_meaning: 'A story about sailing', correction_primary_themes: ['sailing'], correction_secondary_themes: [] };
    const repo = repository({
      workInput: jest.fn(async () => inputRows('CORRECTION', stored)),
      commit: jest.fn(async () => [{ outcome: 'NOT_SUPPORTED', interpretation_id: null, interpretation_revision: null }]),
    });
    const semantic = interpreter({ assessCorrection: jest.fn(async () => ({ verdict: 'NOT_SUPPORTED_BY_PACKAGE' })) });
    await expect(service(repo, semantic).correction(TOKEN, EXPERIENCE, {
      commandId: COMMAND, interpretationId: INTERPRETATION, meaning: 'A story about sailing', primaryThemes: ['sailing'],
    })).resolves.toEqual({ outcome: 'NOT_SUPPORTED' });
    expect(repo.recordOutcome).toHaveBeenCalledWith(WORK, 'NOT_SUPPORTED', { lensKey: null, meaning: null, primaryThemes: null, secondaryThemes: null, explanation: null });
  });

  it('passes the correction refusals through unchanged', async () => {
    for (const outcome of ['UNCHANGED', 'QUOTES_CONTENT', 'NO_PROPOSAL', 'STALE', 'UNAVAILABLE', 'NOT_READY_FOR_REVIEW', 'LIMITED']) {
      const repo = repository({ requestCorrection: jest.fn(async () => [{ outcome, work_id: null }]) });
      await expect(service(repo).correction(TOKEN, EXPERIENCE, {
        commandId: COMMAND, interpretationId: INTERPRETATION, meaning: 'A parent afraid', primaryThemes: ['parenthood'],
      })).resolves.toEqual({ outcome });
    }
  });

  it('surfaces a missing server channel as unavailable, never as an interpretation', async () => {
    const repo = repository({ workInput: jest.fn(async () => { throw new ServiceUnavailableException('Server conversation authority is not configured.'); }) });
    await expect(service(repo).proposal(TOKEN, EXPERIENCE, { commandId: COMMAND })).rejects.toThrow(ServiceUnavailableException);
  });
});

describe('S5-03A — the review is decoded strictly and shows no internal state', () => {
  it('decodes an awaiting and a reviewed interpretation, and a dark state with no meaning', async () => {
    await expect(service().review(TOKEN, EXPERIENCE)).resolves.toEqual({
      state: 'AWAITING_REVIEW', interpretationId: INTERPRETATION, revision: 1, origin: 'QANDEEL', meaning: PROPOSAL.meaning,
      primaryThemes: PROPOSAL.primaryThemes, secondaryThemes: PROPOSAL.secondaryThemes, explanation: PROPOSAL.explanation, decision: null, ready: false,
    });
    const reviewed = repository({ review: jest.fn(async () => [reviewRow({ semantic_state: 'REVIEWED', review_decision: 'ACCEPTED', semantically_ready: true })]) });
    await expect(service(reviewed).review(TOKEN, EXPERIENCE)).resolves.toMatchObject({ state: 'REVIEWED', decision: 'ACCEPTED', ready: true });
    for (const state of ['UNAVAILABLE', 'NO_PROPOSAL', 'NOT_READY_FOR_REVIEW']) {
      const dark = repository({ review: jest.fn(async () => [reviewRow({ semantic_state: state })]) });
      await expect(service(dark).review(TOKEN, EXPERIENCE)).resolves.toEqual({ state, ready: false });
    }
    for (const bad of [{ semantic_state: 'PUBLISHED' }, { semantic_state: 'REVIEWED' }, { interpretation_origin: 'SOMEONE' }, { interpretation_id: 'x' }]) {
      const odd = repository({ review: jest.fn(async () => [reviewRow(bad)]) });
      await expect(service(odd).review(TOKEN, EXPERIENCE)).rejects.toThrow(ServiceUnavailableException);
    }
    const view = await service().review(TOKEN, EXPERIENCE);
    expect(JSON.stringify(view)).not.toMatch(/lens|fingerprint|coordinate|userId|ref"/u);
  });
});

describe('S5-03A — the interpreter port is provider-neutral, deterministic in tests, and refuses outside them', () => {
  const input: PublicSemanticPackageInput = { contract: PUBLIC_SEMANTIC_INTERPRETATION_CONTRACT, items: [{ ordinal: 1, kind: 'SOURCE_CONTENT', text: 'a public sentence' }] };

  it('the test interpreter is deterministic and well formed', async () => {
    const fake: PublicSemanticInterpreter = new FakePublicSemanticInterpreter();
    const signal = new AbortController().signal;
    const first = await fake.propose(input, signal);
    expect(await fake.propose(input, signal)).toEqual(first);
    expect(decodePublicSemanticProposal(first)).not.toBeNull();
    expect(JSON.stringify(first)).not.toContain('a public sentence');
    expect(decodePublicSemanticAssessment(await fake.assessCorrection({ ...input, correction: { meaning: 'm', primaryThemes: ['p'], secondaryThemes: [] } }, signal))).not.toBeNull();
  });

  it('selects the test interpreter only under test, and otherwise refuses — no provider, no fallback', async () => {
    expect(createConfiguredPublicSemanticInterpreter({ NODE_ENV: 'test' })).toBeInstanceOf(FakePublicSemanticInterpreter);
    for (const environment of [{ NODE_ENV: 'production' }, { NODE_ENV: 'production', MODEL_PROVIDER: 'anthropic' }, { MODEL_PROVIDER: 'openai' }]) {
      const chosen = createConfiguredPublicSemanticInterpreter(environment as NodeJS.ProcessEnv);
      expect(chosen).toBeInstanceOf(UnconfiguredPublicSemanticInterpreter);
      await expect(chosen.propose(input, new AbortController().signal)).rejects.toThrow('unavailable');
    }
  });

  it('decodes exactly five proposal fields and two assessment shapes', () => {
    expect(decodePublicSemanticProposal({ ...PROPOSAL, score: 0.9 })).toBeNull();
    expect(decodePublicSemanticAssessment({ verdict: 'CONSISTENT', placementIntent: { lensKey: 'x' }, rank: 1 })).toBeNull();
    expect(decodePublicSemanticAssessment({ verdict: 'NOT_SUPPORTED_BY_PACKAGE' })).toEqual({ verdict: 'NOT_SUPPORTED_BY_PACKAGE' });
    expect(decodePublicSemanticAssessment({ verdict: 'MAYBE' })).toBeNull();
  });
});

describe('S5-03A — routes and publication', () => {
  it('classifies the four semantic routes, and no route publishes', () => {
    expect(ROUTE_RATE_LIMIT_CENSUS['GET /public/authoring/drafts/:experienceId/semantic']).toBe('AUTHENTICATED');
    expect(ROUTE_RATE_LIMIT_CENSUS['POST /public/authoring/drafts/:experienceId/semantic/proposal']).toBe('SECURITY_SENSITIVE');
    expect(ROUTE_RATE_LIMIT_CENSUS['POST /public/authoring/drafts/:experienceId/semantic/accept']).toBe('AUTHENTICATED');
    expect(ROUTE_RATE_LIMIT_CENSUS['POST /public/authoring/drafts/:experienceId/semantic/correction']).toBe('SECURITY_SENSITIVE');
    expect(Object.keys(ROUTE_RATE_LIMIT_CENSUS).filter((route) => /publish/iu.test(route))).toEqual([]);
    for (const file of ['public-semantic.service.ts', 'public-semantic.repository.ts', 'public-semantic.controller.ts']) {
      expect(readFileSync(join(__dirname, file), 'utf8')).not.toMatch(/publish_public_experience|resolve_public_publication_prerequisites|record_public_experience_semantic_placement|CLEARED/u);
    }
  });
});
