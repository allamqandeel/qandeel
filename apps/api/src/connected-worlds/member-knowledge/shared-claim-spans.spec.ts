// S8A-04 CP3-D V2 — Trusted Claim Spans (Controlled Amendment R4, §11): the 63 tests of the free prototype proof, ported to
// the production module and the production lane. Synthetic; no provider; no database (the 0176 item row is a fake).
// Every test labelled RESIDUAL shows what the code does NOT guarantee: a silent checker lets the reply through (R4-4).
//
// Ported, not weakened. Where the production shape differs from the prototype's it is stated: the prototype's decision
// carried `coolDown: []` on UNRESOLVED / STALE, production carries no field there (R4-3: nothing to cool), and BLOCKED also
// says whether provenance was sealed; the prototype's `check()` wrapper is the lane's detector in production, so a checker
// throw or timeout is proved through `SharedMemberKnowledgeLane.readiness`; group 6 runs the V2 lane end to end instead of
// mirroring the V1 judge; and production uses 0178's Names only when they are exactly the envelope's audience, so group 1's
// Name-collision cases put the other member into the World's audience too (the prototype took any list).

import type { HumanPrincipal } from '../kernel/principal.types';
import type { SharedWorldBirthRequest } from '../kernel/shared-world.types';
import type { SharedWorldId } from '../kernel/world.types';
import { attemptSharedWorldBirth } from '../kernel/world-invariants';
import type { SupabaseServiceRoleApiService } from '../../conversation/supabase-service-role-api.service';
import type { SharedHumanAudienceResolverService } from '../audience/shared-human-audience-resolver.service';
import type { SharedPreModelWorldStateResolverService } from '../effective-context/shared-pre-model-world-state-resolver.service';
import { digestReasoningContent } from '../effective-context/shared-effective-context.service';
import { digestProviderOutput } from '../delivery-authority/shared-delivery-authority-revalidator.service';
import { bindSharedQandeelMaterialCommit } from '../material-commit/shared-qandeel-material-commit-binding';
import { SharedMemberKnowledgeLane, buildSharedDisclosureAuthorization } from './shared-member-knowledge-lane';
import {
  SHARED_KNOWLEDGE_ITEM_RPC, sharedKnowledgeReasoningRef, type SharedDisclosureCheckRequest, type SharedDisclosureJudge, type SharedMemberKnowledgeItem,
} from './shared-member-knowledge.types';
import {
  containsClaimName, decideSharedClaims, normalizeClaimText, parseSharedClaimSpans, prepareSharedClaimTable, renderSharedClaims, sharedClaimCheckerView,
  type SharedClaimCheckerAnswer, type SharedClaimCheckerView, type SharedClaimParse, type SharedClaimTable,
} from './shared-claim-spans';

// ---------------------------------------------------------------------------------------------------------------------
// Fixtures: one synthetic World — Rania (the sender), Mohamed and Karim; Mohamed's item, and Rania's.
// ---------------------------------------------------------------------------------------------------------------------

const IDS = {
  world: '10000000-0000-4000-8000-00000000000b',
  rania: '20000000-0000-4000-8000-000000000011',
  mohamed: '20000000-0000-4000-8000-000000000012',
  karim: '20000000-0000-4000-8000-000000000013',
  memM: '50000000-0000-4000-8000-000000000011',
  memR: '50000000-0000-4000-8000-000000000012',
  rgM: '60000000-0000-4000-8000-000000000011', dgM: '60000000-0000-4000-8000-000000000012',
  rgR: '60000000-0000-4000-8000-000000000013', dgR: '60000000-0000-4000-8000-000000000014',
  epM: '70000000-0000-4000-8000-000000000011', epR: '70000000-0000-4000-8000-000000000012',
  material: '80000000-0000-4000-8000-000000000011',
};
const human = (humanId: string): HumanPrincipal => ({ kind: 'HUMAN', humanId });
function bornWorldId(): SharedWorldId {
  const request: SharedWorldBirthRequest = {
    worldId: IDS.world, phase: 'STANDARD', participantsAtBirth: [human(IDS.rania), human(IDS.mohamed)],
    event: { basis: 'ACCEPTED_INVITATION', invitation: { prospective: 'SHARED_INVITATION', inviter: human(IDS.rania), target: human(IDS.mohamed) },
      acceptance: { kind: 'INVITATION_ACCEPTANCE', acceptedBy: human(IDS.mohamed) } },
  };
  const outcome = attemptSharedWorldBirth(request);
  if (!outcome.born) throw new Error('fixture birth failed');
  return outcome.world.worldId;
}
const WORLD = bornWorldId();
const M_ITEM = 'بحب الأماكن الهادية';
const R_ITEM = 'بحب القهوة من غير سكر';
function item(owner: 'mohamed' | 'rania'): SharedMemberKnowledgeItem {
  const m = owner === 'mohamed';
  const content = m ? M_ITEM : R_ITEM;
  return {
    ownerUserId: m ? IDS.mohamed : IDS.rania, ownerName: m ? 'محمد' : 'رانيا', memoryId: m ? IDS.memM : IDS.memR, content,
    contentDigest: digestReasoningContent(content), reasoningGrantId: m ? IDS.rgM : IDS.rgR, disclosureGrantId: m ? IDS.dgM : IDS.dgR,
    membershipEpisodeId: m ? IDS.epM : IDS.epR, ceilingUserIds: [IDS.rania, IDS.mohamed, IDS.karim],
  };
}
class Store {
  audience = [IDS.rania, IDS.mohamed, IDS.karim];
  audienceRef = 'audience:1';
  rows = new Map<string, Record<string, unknown>>();
  constructor(items: ReadonlyArray<SharedMemberKnowledgeItem>) {
    for (const it of items) this.rows.set(`${it.ownerUserId}:${it.memoryId}`, {
      availability: 'AVAILABLE', current_content_digest: it.contentDigest, reasoning_grant_id: it.reasoningGrantId, disclosure_grant_id: it.disclosureGrantId,
      membership_episode_id: it.membershipEpisodeId, grant_content_digest: it.contentDigest, ceiling_user_ids: [...it.ceilingUserIds], grant_state: 'ACTIVE', disclosure_status: 'ACTIVE',
    });
  }
  set(owner: string, memory: string, patch: Record<string, unknown>) { this.rows.set(`${owner}:${memory}`, { ...(this.rows.get(`${owner}:${memory}`) as Record<string, unknown>), ...patch }); }
  server(): SupabaseServiceRoleApiService {
    return { rpc: async (name: string, body: Record<string, unknown>) => {
      if (name !== SHARED_KNOWLEDGE_ITEM_RPC) throw new Error(`unexpected ${name}`);
      const row = this.rows.get(`${body.p_owner_user_id as string}:${body.p_memory_id as string}`);
      return row === undefined ? [] : [{ ...row }];
    } } as unknown as SupabaseServiceRoleApiService;
  }
  worldState(): SharedPreModelWorldStateResolverService {
    return { resolveCurrent: async () => ({ state: 'RESOLVED', snapshot: { worldId: WORLD, lifecycle: 'ACTIVE', phase: 'STANDARD', snapshotRef: 'world:1' } }) } as unknown as SharedPreModelWorldStateResolverService;
  }
  audienceResolver(): SharedHumanAudienceResolverService {
    return { resolveCurrent: async () => ({ state: 'RESOLVED', snapshot: { snapshotRef: this.audienceRef, humans: this.audience.map(human) } }) } as unknown as SharedHumanAudienceResolverService;
  }
}
const AUDIENCE = [{ userId: IDS.rania, name: 'رانيا' }, { userId: IDS.mohamed, name: 'محمد' }, { userId: IDS.karim, name: 'كريم' }];
const LABELS = new Map([[IDS.rania, 'رانيا'], [IDS.mohamed, 'محمد'], [IDS.karim, 'كريم']]);
const N = 'k7q2ab';
const F1 = `F1·${N}`;
const F2 = `F2·${N}`;
const PAYER = { userId: IDS.rania, worldId: IDS.world, materialId: IDS.material };

/** The request: I-03E's envelope, the DA, then the claim table — all production. */
async function request(items = [item('mohamed'), item('rania')], audience = AUDIENCE, nonce = N) {
  const store = new Store(items);
  const lane = new SharedMemberKnowledgeLane(store.server(), store.worldState(), store.audienceResolver(), WORLD, items);
  const context = await lane.effectiveContext.resolve(WORLD, lane.candidates);
  if (context.state !== 'READY') throw new Error('envelope not ready');
  const envelope = context.effectiveContext;
  const da = await lane.authorize(envelope);
  const preparation = lane.claims({ envelope, authorization: da, names: audience, labelOf: LABELS, nonce });
  const table = preparation.table;
  const binding = table.binding;
  const authorized = new Set(da.items.map((entry) => entry.contextId));
  return { store, lane, envelope, da, binding, authorized, table, preparation, items };
}

const ok = (parsed: SharedClaimParse) => { if (!parsed.ok) throw new Error(`parse refused: ${parsed.reason}`); return parsed; };
const SILENT = (view: SharedClaimCheckerView): SharedClaimCheckerAnswer => ({ spans: view.spanIds.map((id) => ({ id, verdict: 'ENTAILED' as const })), outside: [], sealed: [] });
type Verdict = SharedClaimCheckerAnswer['spans'][number]['verdict'];

/** One reply through parse → render → view → decide, with a scripted answer (the production module, no lane). */
async function run(text: string, answer: (view: SharedClaimCheckerView) => unknown, setup?: Awaited<ReturnType<typeof request>>) {
  const r = setup ?? await request();
  const parsed = parseSharedClaimSpans(text, r.table);
  if (!parsed.ok) return { r, parsed, rendered: null, decision: null };
  const rendered = renderSharedClaims(text, parsed);
  const view = sharedClaimCheckerView(text, parsed, r.table);
  const decision = decideSharedClaims(answer(view), view, parsed, r.table, { binding: r.binding, authorized: r.authorized });
  return { r, parsed, rendered, view, decision };
}
const idOf = (table: SharedClaimTable, memoryId: string) => [...table.checked].find(([, v]) => v.memoryId === memoryId)?.[0] as string;

/** The production checker contract: the adapter's CHECKED result, bound to the request, around a scripted answer. */
class ScriptedChecker implements SharedDisclosureJudge {
  calls: SharedDisclosureCheckRequest[] = [];
  constructor(private readonly answer: (request: SharedDisclosureCheckRequest) => unknown) {}
  async judge(request: SharedDisclosureCheckRequest): Promise<unknown> {
    this.calls.push(request);
    return { state: 'CHECKED', checkRef: `check:${this.calls.length}`, policyRef: 'policy:proof', binding: { ...request.binding }, answer: this.answer(request) };
  }
}
const SILENT_CHECK = (request: SharedDisclosureCheckRequest) => ({ spans: request.spans.map((id) => ({ id, verdict: 'ENTAILED' })), outside: [], sealed: [] });

// ---------------------------------------------------------------------------------------------------------------------

describe('1 · the consent correction: use not covered never reaches the model; a shared Name only stops the claim', () => {
  it('items consented for this audience become claimable refs bound to the request nonce', async () => {
    const { table } = await request();
    expect(table.generatorItems).toEqual([{ ref: F1, member: 'محمد', item: M_ITEM }, { ref: F2, member: 'رانيا', item: R_ITEM }]);
    expect([...table.claims.values()].map((c) => [c.ref, c.ownerUserId, c.memoryId])).toEqual([[F1, IDS.mohamed, IDS.memM], [F2, IDS.rania, IDS.memR]]);
    expect(table.excluded).toEqual([]);
  });

  it('an item I-03E did not admit (the ceiling does not cover a new member) is not sent at all', async () => {
    const store = new Store([item('mohamed')]);
    store.audience = [IDS.rania, IDS.mohamed, IDS.karim, '20000000-0000-4000-8000-000000000099'];
    store.set(IDS.mohamed, IDS.memM, { grant_state: 'NEEDS_RECONFIRMATION' });
    const lane = new SharedMemberKnowledgeLane(store.server(), store.worldState(), store.audienceResolver(), WORLD, [item('mohamed')]);
    const context = await lane.effectiveContext.resolve(WORLD, lane.candidates);
    expect(context.state === 'READY' && context.effectiveContext.privateReasoningContexts).toEqual([]);
  });

  it('an admitted item missing from the DA (the 0176 pair says impossible) is excluded entirely — no ref, no influence, no checker id', async () => {
    const r = await request();
    const table = prepareSharedClaimTable({
      admitted: r.items.map((it) => ({ ownerUserId: it.ownerUserId, memoryId: it.memoryId, contentDigest: it.contentDigest, content: it.content })),
      authorized: new Set([IDS.memR]), audience: AUDIENCE, labelOf: LABELS, binding: r.binding, nonce: N,
    });
    expect(table.excluded).toEqual([IDS.memM]);
    expect(table.generatorItems.map((g) => g.item)).toEqual([R_ITEM]);
    expect([...table.checked.values()].map((c) => c.memoryId)).toEqual([IDS.memR]);
  });

  it.each([
    ['the identical Name', 'محمد'],
    ['the same Name with diacritics', 'مُحَمَّد'],
  ])('another member with %s: the item still informs the reply, but has no ref — no claim can be made about it', async (_label, otherName) => {
    const audience = [...AUDIENCE, { userId: '20000000-0000-4000-8000-000000000014', name: otherName }];
    const store = new Store([item('mohamed')]);
    store.audience = audience.map((member) => member.userId);
    const lane = new SharedMemberKnowledgeLane(store.server(), store.worldState(), store.audienceResolver(), WORLD, [item('mohamed')]);
    store.set(IDS.mohamed, IDS.memM, { ceiling_user_ids: store.audience });
    const context = await lane.effectiveContext.resolve(WORLD, lane.candidates);
    if (context.state !== 'READY') throw new Error('not ready');
    const authorization = await lane.authorize(context.effectiveContext);
    const { table } = lane.claims({ envelope: context.effectiveContext, authorization, names: audience, labelOf: LABELS, nonce: N });
    expect(table.generatorItems).toEqual([{ ref: null, member: 'محمد', item: M_ITEM }]);
    expect(table.claims.size).toBe(0);
    expect(table.checked.size).toBe(1);
    expect(parseSharedClaimSpans(`⟦${F1}: بيحب الهدوء⟧`, table)).toEqual({ ok: false, reason: 'UNKNOWN_REF' });
  });

  it('a similar but different Name (محمود) is not a collision', async () => {
    const audience = [...AUDIENCE, { userId: '20000000-0000-4000-8000-000000000014', name: 'محمود' }];
    const r = await request([item('mohamed')], AUDIENCE);
    const table = prepareSharedClaimTable({
      admitted: [{ ownerUserId: IDS.mohamed, memoryId: IDS.memM, contentDigest: item('mohamed').contentDigest, content: M_ITEM }],
      authorized: r.authorized, audience, labelOf: LABELS, binding: r.binding, nonce: N,
    });
    expect(table.generatorItems[0].ref).toBe(F1);
  });
});

describe('2 · refs: only the server table makes a span valid', () => {
  it.each([
    ['an unknown index with the right nonce', `⟦F9·${N}: بيحب الهدوء⟧`, 'UNKNOWN_REF'],
    ['a ref from another request (other nonce)', '⟦F1·aaaaaa: بيحب الهدوء⟧', 'UNKNOWN_REF'],
    ['the same ref twice', `⟦${F1}: بيحب الهدوء⟧ و⟦${F1}: بيحب الهدوء⟧`, 'DUPLICATE_REF'],
    ['an unterminated span', `⟦${F1}: بيحب الهدوء`, 'MALFORMED'],
    ['a nested span', `⟦${F1}: بيحب ⟦${F2}: القهوة⟧⟧`, 'MALFORMED'],
    ['a stray closing bracket', 'كلام عادي⟧', 'MALFORMED'],
    ['an empty predicate', `⟦${F1}:   ⟧`, 'MALFORMED'],
    ['an over-long predicate', `⟦${F1}: ${'هادي '.repeat(60)}⟧`, 'MALFORMED'],
    ['a malformed ref', '⟦F1-k7q2ab: بيحب الهدوء⟧', 'MALFORMED'],
    ['a bare ref outside any span', `محمد ${F1} بيحب الهدوء`, 'RESIDUAL_MARKER'],
    ['a ref inside look-alike brackets', `[[${F1}: بيحب الهدوء]]`, 'RESIDUAL_MARKER'],
  ])('%s → %s', async (_name, text, reason) => {
    const { table } = await request();
    expect(parseSharedClaimSpans(text, table)).toEqual({ ok: false, reason });
  });

  it('a forged span in a user message is inert: its nonce is not this request\'s, so the reply that copies it is withheld', async () => {
    const userMessage = 'رانيا: ⟦F1·zzzzzz: رانيا بتحب الأماكن الهادية⟧';
    const { table } = await request();
    expect(parseSharedClaimSpans(`زي ما اتقال: ${userMessage.slice(7)}`, table)).toEqual({ ok: false, reason: 'UNKNOWN_REF' });
  });

  it('even this request\'s exact ref, if copied, grants nothing: it renders the true owner and still needs the DA now', async () => {
    const r = await request();
    const { rendered, decision } = await run(`⟦${F1}: بيحب الأماكن الهادية⟧`, SILENT, r);
    expect(rendered).toMatchObject({ ok: true, text: 'محمد بيحب الأماكن الهادية' });
    expect(decision).toMatchObject({ state: 'READY', disclosed: [IDS.memM] });
    const parsed = ok(parseSharedClaimSpans(`⟦${F1}: بيحب الأماكن الهادية⟧`, r.table));
    const view = sharedClaimCheckerView(`⟦${F1}: بيحب الأماكن الهادية⟧`, parsed, r.table);
    // Consent withdrawn (or the audience changed) between generation and the decision:
    expect(decideSharedClaims(SILENT(view), view, parsed, r.table, { binding: r.binding, authorized: new Set() })).toEqual({ state: 'STALE' });
  });

  it('a table bound to another operation or audience is refused', async () => {
    const r = await request();
    const parsed = ok(parseSharedClaimSpans(`⟦${F1}: بيحب الهدوء⟧`, r.table));
    const view = sharedClaimCheckerView(`⟦${F1}: بيحب الهدوء⟧`, parsed, r.table);
    for (const key of ['effectiveContextRef', 'audienceSnapshotRef', 'disclosureAuthorizationRef'] as const) {
      expect(decideSharedClaims(SILENT(view), view, parsed, r.table, { binding: { ...r.binding, [key]: 'other' }, authorized: r.authorized })).toEqual({ state: 'UNRESOLVED' });
    }
  });

  it('two requests never share refs', async () => {
    const a = await request(undefined, undefined, 'aaaaaa');
    const b = await request(undefined, undefined, 'bbbbbb');
    expect(parseSharedClaimSpans('⟦F1·aaaaaa: بيحب الهدوء⟧', b.table)).toEqual({ ok: false, reason: 'UNKNOWN_REF' });
    expect(parseSharedClaimSpans('⟦F1·aaaaaa: بيحب الهدوء⟧', a.table).ok).toBe(true);
  });
});

describe('3 · rendering: the server writes the owner; one subject per span', () => {
  it.each([
    ['third person', `⟦${F1}: بيحب الأماكن الهادية⟧، فالكافيه ده ممكن يناسبه.`, 'محمد بيحب الأماكن الهادية، فالكافيه ده ممكن يناسبه.'],
    ['addressed (Arabic)', `⟦${F1}@: إنت بتحب الهدوء⟧، فالمكان ده هيعجبك.`, 'محمد، إنت بتحب الهدوء، فالمكان ده هيعجبك.'],
    ['addressed (English)', `⟦${F1}@: you like quiet places⟧, so this one is for you.`, 'محمد, you like quiet places, so this one is for you.'],
    ['two owners, two spans', `⟦${F1}: بيحب الهدوء⟧ و⟦${F2}: بتحب القهوة من غير سكر⟧.`, 'محمد بيحب الهدوء ورانيا بتحب القهوة من غير سكر.'],
  ])('%s', async (_name, text, expected) => {
    const { table } = await request();
    const rendered = renderSharedClaims(text, ok(parseSharedClaimSpans(text, table)));
    expect(rendered).toEqual({ ok: true, text: expected, outputDigest: digestProviderOutput(expected) });
  });

  it.each([
    ['another member inside the span', `⟦${F1}: ورانيا الاتنين بيحبوا الهدوء⟧`],
    ['another member with a proclitic and diacritics', `⟦${F1}: بيحب الهدوء زي لِرَانيا⟧`],
    ['the owner\'s own Name inside the span', `⟦${F1}: محمد بيحب الهدوء⟧`],
    ['a third member', `⟦${F1}: بيحب الهدوء وكريم كمان⟧`],
  ])('%s → NAME_IN_SPAN (structural; never a rule outside spans)', async (_name, text) => {
    const { table } = await request();
    expect(parseSharedClaimSpans(text, table)).toEqual({ ok: false, reason: 'NAME_IN_SPAN' });
  });

  it('English Names and possessives are matched too', () => {
    expect(containsClaimName("so is Rania's", ['rania'])).toBe(true);
    expect(containsClaimName('Raniaa likes it', ['rania'])).toBe(false);
    expect(normalizeClaimText('أَحْمَد')).toBe('احمد');
  });

  it('no span can be anonymous: every rendered claim begins with its owner\'s Name', async () => {
    const { table } = await request();
    const text = `فيه حد معانا ⟦${F1}: بيحب الهدوء⟧`;
    expect(renderSharedClaims(text, ok(parseSharedClaimSpans(text, table)))).toMatchObject({ ok: true, text: 'فيه حد معانا محمد بيحب الهدوء' });
  });
});

describe('4 · the checker sees no owner, and can only block', () => {
  it('the view carries checker ids and the items, never the owner\'s Name or the request ref', async () => {
    const { table } = await request();
    const text = `⟦${F1}: بيحب الهدوء⟧، فممكن نختار كافيه هادي.`;
    const view = sharedClaimCheckerView(text, ok(parseSharedClaimSpans(text, table)), table);
    expect(view.text).toBe('⟦K1: بيحب الهدوء⟧، فممكن نختار كافيه هادي.');
    expect(view.items).toEqual([{ id: 'K1', item: M_ITEM }, { id: 'K2', item: R_ITEM }]);
    expect(JSON.stringify(view)).not.toMatch(/محمد|رانيا|k7q2ab/u);
  });

  it.each([
    ['a missing span verdict', () => ({ spans: [], outside: [], sealed: [] }) as unknown],
    ['an unknown verdict', (v: SharedClaimCheckerView) => ({ spans: v.spanIds.map((id) => ({ id, verdict: 'OWNER' })), outside: [], sealed: [] })],
    ['an extra key', (v: SharedClaimCheckerView) => ({ ...SILENT(v), ok: true })],
    ['a passage not in the reply', (v: SharedClaimCheckerView) => ({ ...SILENT(v), outside: [{ id: 'K1', passage: 'جملة مش موجودة' }] })],
    ['a passage that exists only inside a span, reported as outside', (v: SharedClaimCheckerView) => ({ ...SILENT(v), outside: [{ id: 'K1', passage: 'بيحب الهدوء' }] })],
    ['an unknown item id', (v: SharedClaimCheckerView) => ({ ...SILENT(v), outside: [{ id: 'K9', passage: 'كافيه' }] })],
    ['not an object', () => 'ENTAILED'],
  ])('%s → UNRESOLVED, nothing cooled', async (_name, answer) => {
    const { decision } = await run(`⟦${F1}: بيحب الهدوء⟧، فممكن نختار كافيه هادي.`, answer);
    expect(decision).toEqual({ state: 'UNRESOLVED' });
  });

  it.each([['a throw'], ['a timeout']])('%s → UNRESOLVED, nothing cooled, and the next reply may use the item again', async (kind) => {
    const r = await request();
    const text = `⟦${F1}: بيحب الأماكن الهادية⟧`;
    const failing: SharedDisclosureJudge = {
      judge: kind === 'a throw' ? async () => { throw new Error('UNAVAILABLE'); } : () => new Promise<unknown>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 5)),
    };
    expect(await r.lane.readiness({ envelope: r.envelope, preparation: r.preparation, generatedText: text, checker: failing, payer: PAYER })).toEqual({ state: 'UNRESOLVED' });
    const next = await r.lane.readiness({ envelope: r.envelope, preparation: r.preparation, generatedText: text, checker: new ScriptedChecker(SILENT_CHECK), payer: PAYER });
    expect(next).toMatchObject({ state: 'READY_FOR_LATER_DELIVERY_GATES', readiness: { disclosedContextIds: [IDS.memM] } });
  });

  it('only the unsafe item is cooled; the safe one is not', async () => {
    const r = await request();
    const text = `⟦${F1}: بيحب الهدوء⟧، وإنتِ بتحبي القهوة من غير سكر.`;
    const { decision } = await run(text, (v) => ({ ...SILENT(v), outside: [{ id: idOf(r.table, IDS.memR), passage: 'وإنتِ بتحبي القهوة من غير سكر' }] }), r);
    expect(decision).toEqual({ state: 'BLOCKED', coolDown: [IDS.memR], sealed: false });
  });
});

describe('5 · the Product Owner\'s examples: what the code decides, and what only the checker can', () => {
  type Row = [string, string, (v: SharedClaimCheckerView, t: SharedClaimTable) => unknown, string, string];
  const outside = (passage: string, who: string = IDS.memM) => (v: SharedClaimCheckerView, t: SharedClaimTable) => ({ ...SILENT(v), outside: [{ id: idOf(t, who), passage }] });
  const spanVerdict = (verdict: Verdict) => (v: SharedClaimCheckerView) => ({ spans: v.spanIds.map((id) => ({ id, verdict })), outside: [], sealed: [] });
  const ROWS: Row[] = [
    ['A advice, no span', 'إيه رأيكم نختار مكان هادي بعيد عن الزحمة؟', SILENT, 'READY', 'KNOWLEDGE_INFLUENCE: no span needed, nothing disclosed'],
    ['B «محمد بيحب الهدوء» via span', `⟦${F1}: بيحب الهدوء⟧`, SILENT, 'READY', 'PERSONAL_CLAIM: owner written by the server'],
    ['B′ the same, plain text, reported', 'محمد بيحب الهدوء', outside('محمد بيحب الهدوء'), 'BLOCKED', 'a claim outside its span is blocked once reported (false block: the generator skipped the span)'],
    ['C «رانيا بتحب الهدوء», reported', 'رانيا بتحب الهدوء', outside('رانيا بتحب الهدوء'), 'BLOCKED', 'blocked whoever it is said of — no attribution decision'],
    ['C RESIDUAL: the checker is silent', 'رانيا بتحب الهدوء', SILENT, 'READY', 'RESIDUAL — detection is the checker\'s; the code cannot see meaning'],
    ['D two people, outside the span, reported', `⟦${F1}: بيحب الهدوء⟧ ورانيا كمان.`, outside('ورانيا كمان'), 'BLOCKED', 'ellipsis co-subject caught only by the checker'],
    ['D RESIDUAL: silent on «ورانيا كمان»', `⟦${F1}: بيحب الهدوء⟧ ورانيا كمان.`, SILENT, 'READY', 'RESIDUAL'],
    ['D pronoun co-subject inside the span, judged', `⟦${F1}: وهي كمان بيحبوا الهدوء⟧`, spanVerdict('OTHER_PERSON'), 'BLOCKED', 'a pronoun is not a Name: the checker decides'],
    ['D RESIDUAL: pronoun inside the span, checker wrong', `⟦${F1}: وهي كمان بيحبوا الهدوء⟧`, SILENT, 'READY', 'RESIDUAL'],
    ['E Mohamed + Rania may like it', `⟦${F1}: بيحب الهدوء⟧، ورانيا ممكن يعجبها المكان كمان.`, SILENT, 'READY', 'no Name rule outside spans'],
    ['F «إنت بتحب الهدوء», reported', 'إنت بتحب الهدوء، فالمكان ده ليك.', outside('إنت بتحب الهدوء'), 'BLOCKED', 'the pronoun never decides the owner'],
    ['F′ addressed through the span', `⟦${F1}@: إنت بتحب الهدوء⟧`, SILENT, 'READY', 'the server names the addressee'],
    ['G «في حد معانا…», reported', 'في حد معانا بيحب الأماكن الهادية.', outside('في حد معانا بيحب الأماكن الهادية'), 'BLOCKED', 'no anonymous disclosure'],
    ['H an added personal fact, judged', `⟦${F1}: بيحب الهدوء ومبيخرجش بالليل⟧`, spanVerdict('ADDS'), 'BLOCKED', 'entailment is semantic'],
    ['H RESIDUAL: the checker misses the addition', `⟦${F1}: بيحب الهدوء ومبيخرجش بالليل⟧`, SILENT, 'READY', 'RESIDUAL'],
    ['I pronoun across two sentences', `⟦${F1}: جاي النهارده⟧. وهو بيحب الهدوء.`,
      (v, t) => ({ spans: v.spanIds.map((id) => ({ id, verdict: 'ADDS' as const })), outside: [{ id: idOf(t, IDS.memM), passage: 'وهو بيحب الهدوء' }], sealed: [] }), 'BLOCKED', 'the fact must sit in its span'],
    ['J provenance inside a span', `⟦${F1}: قالّي إنه بيحب الهدوء⟧`, (v, t) => ({ ...SILENT(v), sealed: [{ id: idOf(t, IDS.memM), passage: 'قالّي' }] }), 'BLOCKED', 'sealed provenance'],
    ['K the wrong item\'s content in a span', `⟦${F2}: بتحب الأماكن الهادية⟧`, spanVerdict('OTHER_ITEM'), 'BLOCKED', 'Mohamed\'s fact under Rania\'s ref: semantic'],
  ];
  it.each(ROWS)('%s', async (_name, text, answer, expected) => {
    const r = await request();
    const { decision } = await run(text, (v) => answer(v, r.table), r);
    expect(decision?.state).toBe(expected);
  });
});

describe('6 · the binding: gates and commit see exactly the rendered text (the V2 lane end to end)', () => {
  async function commitInput(r: Awaited<ReturnType<typeof request>>, generatedText: string, commitText: (rendered: string) => string) {
    const checker = new ScriptedChecker(SILENT_CHECK);
    const readiness = await r.lane.readiness({ envelope: r.envelope, preparation: r.preparation, generatedText, checker, payer: PAYER });
    if (readiness.state !== 'READY_FOR_LATER_DELIVERY_GATES') throw new Error(readiness.state);
    const revalidation = await r.lane.revalidator.revalidate(r.envelope, readiness.text);
    return { checker, readiness, binding: bindSharedQandeelMaterialCommit({
      targetWorldId: WORLD, materialKind: 'QANDEEL_OUTPUT', outputText: commitText(readiness.text), currentAudienceSnapshotRef: r.envelope.audienceSnapshot.snapshotRef,
      revalidation, readiness, materialSourceIds: [], reasoningSourceRefs: r.items.map((it) => sharedKnowledgeReasoningRef(it.reasoningGrantId)),
    }) };
  }

  it('the rendered text passes the frozen I-03G gate, I-03F, the disclosure revalidation and the commit binder, with its own digest', async () => {
    const r = await request();
    const marked = `⟦${F1}: بيحب الأماكن الهادية⟧، فالكافيه ده ممكن يناسبه.`;
    const rendered = renderSharedClaims(marked, ok(parseSharedClaimSpans(marked, r.table)));
    if (!rendered.ok) throw new Error('render');
    const { checker, readiness, binding } = await commitInput(r, marked, (text) => text);
    expect(readiness).toMatchObject({ state: 'READY_FOR_LATER_DELIVERY_GATES', text: rendered.text, readiness: { outputDigest: rendered.outputDigest, disclosedContextIds: [IDS.memM] } });
    expect(binding.state).toBe('BOUND');
    // One check, bound to the rendered digest, over a view with no Name and no request ref.
    expect(checker.calls).toHaveLength(1);
    expect(checker.calls[0].binding.outputDigest).toBe(rendered.outputDigest);
    expect(JSON.stringify(checker.calls[0])).not.toMatch(/محمد|رانيا|k7q2ab/u);
  });

  it('readiness on the rendered text cannot commit the marked text (OUTPUT_MISMATCH), nor any other bytes', async () => {
    const r = await request();
    const marked = `⟦${F1}: بيحب الأماكن الهادية⟧، فالكافيه ده ممكن يناسبه.`;
    expect((await commitInput(r, marked, () => marked)).binding).toMatchObject({ state: 'REFUSED', reason: 'OUTPUT_MISMATCH' });
    expect((await commitInput(r, marked, (text) => `${text} `)).binding).toMatchObject({ state: 'REFUSED', reason: 'OUTPUT_MISMATCH' });
  });

  it('nothing span-shaped can leave: a residue after rendering is refused before any gate', async () => {
    const r = await request();
    const text = `⟦${F1}: بيحب الهدوء⟧ ${F1}`;
    expect(parseSharedClaimSpans(text, r.table)).toEqual({ ok: false, reason: 'RESIDUAL_MARKER' });
    const checker = new ScriptedChecker(SILENT_CHECK);
    expect(await r.lane.readiness({ envelope: r.envelope, preparation: r.preparation, generatedText: text, checker, payer: PAYER })).toEqual({ state: 'UNRESOLVED' });
    expect(checker.calls).toHaveLength(0);
  });
});

describe('7 · production additions: the DA before generation, the exact audience, and the build path', () => {
  it('Names that are not exactly this audience (one missing, one extra, a duplicate, the read failed) give no ref at all', async () => {
    const r = await request();
    const stranger = { userId: '20000000-0000-4000-8000-000000000099', name: 'سلمى' };
    for (const names of [AUDIENCE.slice(0, 2), [...AUDIENCE, stranger], [...AUDIENCE.slice(0, 2), AUDIENCE[1]], null]) {
      const { table } = r.lane.claims({ envelope: r.envelope, authorization: r.da, names, labelOf: LABELS, nonce: N });
      expect(table.claims.size).toBe(0);
      expect(table.generatorItems.map((entry) => entry.ref)).toEqual([null, null]);
    }
  });

  it('a member without a Name (0178 NULL: not the same for every viewer) cannot be stated; the others still can', async () => {
    const r = await request();
    const names = AUDIENCE.map((member) => (member.userId === IDS.mohamed ? { ...member, name: null } : member));
    const { table } = r.lane.claims({ envelope: r.envelope, authorization: r.da, names, labelOf: LABELS, nonce: N });
    expect(table.generatorItems).toEqual([{ ref: null, member: 'محمد', item: M_ITEM }, { ref: F1, member: 'رانيا', item: R_ITEM }]);
  });

  it('the DA built by the lane is the one buildSharedDisclosureAuthorization builds, before any generation', async () => {
    const r = await request();
    expect(r.da).toEqual(await buildSharedDisclosureAuthorization(r.store.server(), r.envelope, r.items));
    expect(r.da.items.map((entry) => entry.contextId)).toEqual([IDS.memM, IDS.memR]);
  });

  it('a request ref never reaches a request for another World\'s table: refs carry the request nonce, the table the operation', async () => {
    const r = await request();
    expect(r.table.binding).toEqual({ effectiveContextRef: r.envelope.effectiveContextRef, audienceSnapshotRef: r.envelope.audienceSnapshot.snapshotRef, disclosureAuthorizationRef: r.da.disclosureAuthorizationRef });
  });
});
