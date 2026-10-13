/**
 * S6-01 — VALIDATION guard for the device proof stand-in `qandeel://s401-proof/introductions/*`: until a scenario is
 * seeded it answers nothing (every earlier proof leg is unchanged and no entry is drawn); it never claims enrollment; the
 * N walk reaches the review and then "nothing more"; the K and C seeds plan their own first objectives.
 */
import { createS601ProofIntroductions } from '../__validation__/s601-proof-introductions';

const body = async (answer: { json: () => Promise<unknown> } | undefined) => (answer === undefined ? undefined : await answer.json()) as Record<string, any>;

describe('S6-01 proof stand-in', () => {
  it('answers nothing until seeded', () => {
    const proof = createS601ProofIntroductions('ar');
    expect(proof.route('/introductions/availability', 'GET', undefined)).toBeUndefined();
  });

  it('N: offer, decline, then one fact at a time to the review — and enrollment is never available', async () => {
    const proof = createS601ProofIntroductions('en');
    proof.seedNew();
    let view = await body(proof.route('/introductions/preparation', 'GET', undefined));
    expect(view.plan.next).toEqual({ kind: 'OFFER_ASSISTANCE' });
    expect(view.availability.enrollment).toBe(false);
    let version = 0;
    const send = async (kind: string, payload: Record<string, unknown>) => {
      const answer = await body(proof.route('/introductions/preparation/commands', 'POST', { commandId: 'c', expectedVersion: version, kind, payload }));
      expect(answer.outcome).toBe('APPLIED');
      version = answer.view.draft.version;
      return answer.view;
    };
    view = await send('SKIP_STEP', { step: 'ASSISTANCE_OFFER' });
    expect(view.plan).toMatchObject({ path: 'NEW', next: { kind: 'ESTABLISH_FACT', fact: 'INTRODUCTION_FIRST_NAME' } });
    for (const [fact, payload] of [['INTRODUCTION_FIRST_NAME', { firstName: 'Sara' }], ['SEX', { sex: 'FEMALE' }], ['BIRTH_YEAR_MONTH', { year: 1996, month: 5 }],
      ['BROAD_AREA', { countryCode: 'EG', regionCode: 'EG-ALX' }], ['MARITAL_STATUS', { maritalStatus: 'NEVER_MARRIED' }]] as const) {
      await send('SET_FACT', { fact, ...payload });
      view = await send('CONFIRM_FACT', { fact });
    }
    await send('SET_REQUIREMENTS', { strength: 'HARD', answer: 'NONE_ADDITIONAL', items: [] });
    view = await send('SET_REQUIREMENTS', { strength: 'SOFT', answer: 'NONE', items: [] });
    for (const step of ['NOTES', 'SHORT_INTRODUCTION', 'WORK_FIELD']) view = await send('SKIP_STEP', { step });
    expect(view.plan.next).toEqual({ kind: 'REVIEW' });
    view = await send('CONFIRM_REVIEW', {});
    expect(view.plan).toMatchObject({ stage: 'REVIEWED', next: null, enrollment: 'UNAVAILABLE' });
  });

  it('K and C plan their own first objectives; closing leaves a draft readable and refuses writes', async () => {
    const known = createS601ProofIntroductions('ar');
    known.seedKnown();
    expect((await body(known.route('/introductions/preparation', 'GET', undefined))).plan).toMatchObject({ path: 'KNOWN', next: { kind: 'CONFIRM_PRIOR_ITEM' } });
    const mixed = createS601ProofIntroductions('ar');
    mixed.seedMixed();
    expect((await body(mixed.route('/introductions/preparation', 'GET', undefined))).plan).toMatchObject({ path: 'MIXED', next: { kind: 'RESOLVE_DISCREPANCY' } });
    mixed.close();
    const closed = await body(mixed.route('/introductions/preparation', 'GET', undefined));
    expect(closed.availability.preparation).toBe(false);
    expect(closed.draft).not.toBeNull();
    expect((await body(mixed.route('/introductions/preparation/commands', 'POST', { commandId: 'c', expectedVersion: 7, kind: 'SKIP_STEP', payload: { step: 'NOTES' } }))).outcome).toBe('UNAVAILABLE');
  });
});
