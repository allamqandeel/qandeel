// S8A-04 CP3 — the authorized-disclosure lane (amendment §3 – §4, §8, as R4 / §11 binds over them): the frozen I-03 classes
// composed per request, the Disclosure Authorization built before generation and bound to its operation, the claim spans
// parsed and rendered by the server, ONE check per reply paid by the sender, and consent changing at every boundary. Free:
// no provider, no database; the 0176 item row is a fake that can change.
//
// R4 replaced the V1 judge (one call per owner, its v2 assessment mapped per item). Each V1 case below is kept as its V2
// counterpart, and where the intended behaviour changed the test says so:
//   * one check per reply, never one per owner (R4-2 step 4) — "one call per owner" became "one call per reply";
//   * the §4 cases are decided from span verdicts and reported passages, not from findings / attributedTo (R4-2 step 5);
//   * a withheld reply cools only the items the check proved unsafe; a failure cools nothing (R4-3) — BLOCKED carries them;
//   * an owner the request cannot label, or whose Name the audience does not share, can never be STATED (no ref), where V1
//     withheld the reply; the item may still shape the reply (R4-1);
//   * READY carries the rendered text, which the delivery chain commits, so "nothing in the result" now excludes that text.

import type { HumanPrincipal } from '../kernel/principal.types';
import type { SharedWorldBirthRequest } from '../kernel/shared-world.types';
import type { SharedWorldId } from '../kernel/world.types';
import { attemptSharedWorldBirth } from '../kernel/world-invariants';
import { currentAiUsageAttribution } from '../../ai-usage/ai-usage-attribution';
import type { SupabaseServiceRoleApiService } from '../../conversation/supabase-service-role-api.service';
import type { SharedHumanAudienceResolverService } from '../audience/shared-human-audience-resolver.service';
import type { SharedPreModelWorldStateResolverService } from '../effective-context/shared-pre-model-world-state-resolver.service';
import { digestReasoningContent } from '../effective-context/shared-effective-context.service';
import type { SharedEffectiveContext } from '../effective-context/shared-effective-context.types';
import { digestProviderOutput } from '../delivery-authority/shared-delivery-authority-revalidator.service';
import { fingerprintSharedPrivacyAuthorityDeliveryReadiness } from '../source-disclosure/shared-privacy-authority-delivery-readiness.service';
import { parseSharedClaimSpans, renderSharedClaims, sharedClaimCheckerView } from './shared-claim-spans';
import {
  SharedMemberKnowledgeLane, buildSharedDisclosureAuthorization, decodeSharedDisclosureCheck, evaluateSharedMemberKnowledgeGate,
  type SharedClaimPreparation,
} from './shared-member-knowledge-lane';
import { decodeSharedAudienceNames } from './shared-member-knowledge.service';
import {
  SHARED_KNOWLEDGE_ITEM_RPC, type SharedDisclosureAuthorization, type SharedDisclosureCheckRequest, type SharedDisclosureJudge,
  type SharedMemberKnowledgeItem,
} from './shared-member-knowledge.types';

const IDS = {
  world: '10000000-0000-4000-8000-00000000000a',
  hala: '20000000-0000-4000-8000-000000000001',
  mohamed: '20000000-0000-4000-8000-000000000002',
  sara: '20000000-0000-4000-8000-000000000003',
  nour: '20000000-0000-4000-8000-000000000004',
  memM: '50000000-0000-4000-8000-000000000001',
  memS: '50000000-0000-4000-8000-000000000002',
  rgM: '60000000-0000-4000-8000-000000000001',
  dgM: '60000000-0000-4000-8000-000000000002',
  rgS: '60000000-0000-4000-8000-000000000003',
  dgS: '60000000-0000-4000-8000-000000000004',
  epM: '70000000-0000-4000-8000-000000000001',
  epS: '70000000-0000-4000-8000-000000000002',
  material: '80000000-0000-4000-8000-000000000001',
};
const human = (humanId: string): HumanPrincipal => ({ kind: 'HUMAN', humanId });

function bornWorldId(): SharedWorldId {
  const request: SharedWorldBirthRequest = {
    worldId: IDS.world,
    phase: 'STANDARD',
    participantsAtBirth: [human(IDS.hala), human(IDS.mohamed)],
    event: {
      basis: 'ACCEPTED_INVITATION',
      invitation: { prospective: 'SHARED_INVITATION', inviter: human(IDS.hala), target: human(IDS.mohamed) },
      acceptance: { kind: 'INVITATION_ACCEPTANCE', acceptedBy: human(IDS.mohamed) },
    },
  };
  const outcome = attemptSharedWorldBirth(request);
  if (!outcome.born) throw new Error('fixture birth failed');
  return outcome.world.worldId;
}
const WORLD = bornWorldId();
const MOHAMED_ITEM = 'يفضل السفر بالقطار';
const SARA_ITEM = 'تحب القهوة بدون سكر';

function item(owner: 'mohamed' | 'sara'): SharedMemberKnowledgeItem {
  const m = owner === 'mohamed';
  const content = m ? MOHAMED_ITEM : SARA_ITEM;
  return {
    ownerUserId: m ? IDS.mohamed : IDS.sara, ownerName: m ? 'Mohamed' : 'Sara', memoryId: m ? IDS.memM : IDS.memS, content,
    contentDigest: digestReasoningContent(content), reasoningGrantId: m ? IDS.rgM : IDS.rgS, disclosureGrantId: m ? IDS.dgM : IDS.dgS,
    membershipEpisodeId: m ? IDS.epM : IDS.epS, ceilingUserIds: [IDS.hala, IDS.mohamed, IDS.sara],
  };
}

/** The fake 0176: one row per (owner, memory), mutable between steps. */
class Store {
  audience = [IDS.hala, IDS.mohamed, IDS.sara];
  audienceRef = 'audience:1';
  rows = new Map<string, Record<string, unknown>>();
  reads: Array<Record<string, unknown>> = [];
  constructor(items: ReadonlyArray<SharedMemberKnowledgeItem>) {
    for (const it of items) {
      this.rows.set(`${it.ownerUserId}:${it.memoryId}`, {
        availability: 'AVAILABLE', current_content_digest: it.contentDigest, reasoning_grant_id: it.reasoningGrantId,
        disclosure_grant_id: it.disclosureGrantId, membership_episode_id: it.membershipEpisodeId, grant_content_digest: it.contentDigest,
        ceiling_user_ids: [...it.ceilingUserIds], grant_state: 'ACTIVE', disclosure_status: 'ACTIVE',
      });
    }
  }
  set(owner: string, memory: string, patch: Record<string, unknown>) {
    this.rows.set(`${owner}:${memory}`, { ...(this.rows.get(`${owner}:${memory}`) as Record<string, unknown>), ...patch });
  }
  server(): SupabaseServiceRoleApiService {
    return {
      rpc: async (name: string, body: Record<string, unknown>) => {
        if (name !== SHARED_KNOWLEDGE_ITEM_RPC) throw new Error(`unexpected ${name}`);
        this.reads.push(body);
        const row = this.rows.get(`${body.p_owner_user_id as string}:${body.p_memory_id as string}`);
        return row === undefined ? [] : [{ ...row }];
      },
    } as unknown as SupabaseServiceRoleApiService;
  }
  worldState(): SharedPreModelWorldStateResolverService {
    return { resolveCurrent: async () => ({ state: 'RESOLVED', snapshot: { worldId: WORLD, lifecycle: 'ACTIVE', phase: 'STANDARD', snapshotRef: 'world:1' } }) } as unknown as SharedPreModelWorldStateResolverService;
  }
  audienceResolver(): SharedHumanAudienceResolverService {
    return { resolveCurrent: async () => ({ state: 'RESOLVED', snapshot: { snapshotRef: this.audienceRef, humans: this.audience.map(human) } }) } as unknown as SharedHumanAudienceResolverService;
  }
}

type Answer = { spans: Array<{ id: string; verdict: string }>; outside: Array<{ id: string; passage: string }>; sealed: Array<{ id: string; passage: string }> };

/** A checker that answers from the request it sees; records every request and the AI-COST-01 scope it ran in. */
class ScriptedChecker implements SharedDisclosureJudge {
  calls: Array<{ request: SharedDisclosureCheckRequest; scope: unknown }> = [];
  constructor(private readonly result: (request: SharedDisclosureCheckRequest) => unknown) {}
  async judge(request: SharedDisclosureCheckRequest): Promise<unknown> {
    this.calls.push({ request, scope: currentAiUsageAttribution() });
    return this.result(request);
  }
}
const checked = (request: SharedDisclosureCheckRequest, answer: unknown) => ({ state: 'CHECKED', checkRef: 'check:1', policyRef: 'policy:test', binding: { ...request.binding }, answer });
const answering = (answer: (request: SharedDisclosureCheckRequest) => Answer) => new ScriptedChecker((request) => checked(request, answer(request)));
const ENTAILED = (verdict = 'ENTAILED') => (request: SharedDisclosureCheckRequest): Answer => ({ spans: request.spans.map((id) => ({ id, verdict })), outside: [], sealed: [] });
const SILENT = answering(ENTAILED());

const NAMES = [{ userId: IDS.hala, name: 'Hala' }, { userId: IDS.mohamed, name: 'Mohamed' }, { userId: IDS.sara, name: 'Sara' }];
const LABELS = new Map([[IDS.hala, 'Hala'], [IDS.mohamed, 'Mohamed'], [IDS.sara, 'Sara']]);
const PAYER = { userId: IDS.hala, worldId: IDS.world, materialId: IDS.material };
const NONCE = 'k7q2ab';
const F1 = `F1·${NONCE}`;
const F2 = `F2·${NONCE}`;

async function setup(items: SharedMemberKnowledgeItem[] = [item('mohamed')]) {
  const store = new Store(items);
  const lane = new SharedMemberKnowledgeLane(store.server(), store.worldState(), store.audienceResolver(), WORLD, items);
  const context = await lane.effectiveContext.resolve(WORLD, lane.candidates);
  if (context.state !== 'READY') throw new Error('envelope not ready');
  const envelope = context.effectiveContext;
  const authorization = await lane.authorize(envelope);
  const preparation = lane.claims({ envelope, authorization, names: NAMES, labelOf: LABELS, nonce: NONCE });
  return { store, lane, envelope, items, authorization, preparation };
}
/** The marked reply (Mohamed's item stated inside its span) and what the audience reads. */
const MARKED = `⟦${F1}: ${MOHAMED_ITEM}⟧، فممكن نشوف مواعيد القطار.`;
const RENDERED = `Mohamed ${MOHAMED_ITEM}، فممكن نشوف مواعيد القطار.`;

/** The gate lane over one generated text, exactly as the readiness runs it. */
async function gate(s: Awaited<ReturnType<typeof setup>>, text: string, checker: SharedDisclosureJudge, authorization: SharedDisclosureAuthorization = s.authorization, preparation: SharedClaimPreparation = s.preparation) {
  const parsed = parseSharedClaimSpans(text, preparation.table);
  if (!parsed.ok) throw new Error(parsed.reason);
  const rendered = renderSharedClaims(text, parsed);
  if (!rendered.ok) throw new Error(rendered.reason);
  return evaluateSharedMemberKnowledgeGate({ envelope: s.envelope, authorization, table: preparation.table, marked: text, parsed, rendered, checker, payer: PAYER });
}

describe('S8A-04 CP3 — I-03E admits exactly the consented items, under their item grants', () => {
  it('admits one item per owner, bound to the reasoning grant, under the unchanged I-03A constraints', async () => {
    const { envelope } = await setup([item('mohamed'), item('sara')]);
    expect(envelope.privateReasoningContexts.map((entry) => [entry.source.originWorld.owner.humanId, entry.source.contextId, entry.authority.binding.grantId]))
      .toEqual([[IDS.mohamed, IDS.memM, IDS.rgM], [IDS.sara, IDS.memS, IDS.rgS]]);
    for (const entry of envelope.privateReasoningContexts) expect(entry.authority.constraints.directPrivateDisclosureAuthority).toBe('NOT_GRANTED');
  });

  it('admits nothing when the audience exceeds the ceiling (a new member, before reconfirmation)', async () => {
    const store = new Store([item('mohamed')]);
    store.audience = [IDS.hala, IDS.mohamed, IDS.sara, IDS.nour];
    store.set(IDS.mohamed, IDS.memM, { grant_state: 'NEEDS_RECONFIRMATION' });
    const lane = new SharedMemberKnowledgeLane(store.server(), store.worldState(), store.audienceResolver(), WORLD, [item('mohamed')]);
    const context = await lane.effectiveContext.resolve(WORLD, lane.candidates);
    expect(context.state === 'READY' && context.effectiveContext.privateReasoningContexts).toEqual([]);
  });

  it.each([['REVOKED'], ['ENDED'], ['NONE']])('admits nothing for a pair that is %s, or another pair of the same item', async (state) => {
    const store = new Store([item('mohamed')]);
    store.set(IDS.mohamed, IDS.memM, { grant_state: state });
    const lane = new SharedMemberKnowledgeLane(store.server(), store.worldState(), store.audienceResolver(), WORLD, [item('mohamed')]);
    const context = await lane.effectiveContext.resolve(WORLD, lane.candidates);
    expect(context.state === 'READY' && context.effectiveContext.privateReasoningContexts).toEqual([]);
    store.set(IDS.mohamed, IDS.memM, { grant_state: 'ACTIVE', reasoning_grant_id: IDS.rgS });
    const again = await lane.effectiveContext.resolve(WORLD, lane.candidates);
    expect(again.state === 'READY' && again.effectiveContext.privateReasoningContexts).toEqual([]);
  });
});

describe('S8A-04 CP3 — the Disclosure Authorization, before generation (R4-1, R4-2 step 1)', () => {
  it('lists exactly the admitted items whose disclosure grant covers this exact audience', async () => {
    const { authorization, envelope } = await setup([item('mohamed'), item('sara')]);
    expect(authorization.items.map((entry) => [entry.ownerHumanId, entry.contextId, entry.disclosureGrantId, entry.scope]))
      .toEqual([[IDS.mohamed, IDS.memM, IDS.dgM, 'MENTION_ATTRIBUTED_TO_OWNER'], [IDS.sara, IDS.memS, IDS.dgS, 'MENTION_ATTRIBUTED_TO_OWNER']]);
    expect([authorization.effectiveContextRef, authorization.audienceSnapshotRef]).toEqual([envelope.effectiveContextRef, envelope.audienceSnapshot.snapshotRef]);
  });

  it.each([
    ['the disclosure grant revoked', { disclosure_status: 'REVOKED' }],
    ['another disclosure grant', { disclosure_grant_id: IDS.dgS }],
    ['a ceiling short of the audience', { ceiling_user_ids: [IDS.hala, IDS.mohamed] }],
    ['the words changed', { current_content_digest: digestReasoningContent('x') }],
    ['an unreadable row', { broken: true }],
  ])('%s → the item is not in the DA, and so is never sent (no ref, no influence)', async (_name, patch) => {
    const store = new Store([item('mohamed')]);
    const lane = new SharedMemberKnowledgeLane(store.server(), store.worldState(), store.audienceResolver(), WORLD, [item('mohamed')]);
    const context = await lane.effectiveContext.resolve(WORLD, lane.candidates);
    if (context.state !== 'READY') throw new Error('not ready');
    store.set(IDS.mohamed, IDS.memM, patch);
    const authorization = await lane.authorize(context.effectiveContext);
    expect(authorization.items).toEqual([]);
    const { table } = lane.claims({ envelope: context.effectiveContext, authorization, names: NAMES, labelOf: LABELS, nonce: NONCE });
    expect([table.excluded, table.generatorItems, table.claims.size]).toEqual([[IDS.memM], [], 0]);
  });

  it('an owner whose Name the audience does not share (0178 NULL), or who has no label here, can never be stated', async () => {
    const s = await setup([item('mohamed'), item('sara')]);
    const nameless = s.lane.claims({ envelope: s.envelope, authorization: s.authorization, names: NAMES.map((n) => (n.userId === IDS.mohamed ? { ...n, name: null } : n)), labelOf: LABELS, nonce: NONCE });
    expect(nameless.table.generatorItems).toEqual([{ ref: null, member: 'Mohamed', item: MOHAMED_ITEM }, { ref: F1, member: 'Sara', item: SARA_ITEM }]);
    // V1 withheld the reply for an unlabelled owner; V2 never sends that item at all (R4-1).
    const unlabelled = s.lane.claims({ envelope: s.envelope, authorization: s.authorization, names: NAMES, labelOf: new Map([[IDS.hala, 'Hala'], [IDS.sara, 'Sara']]), nonce: NONCE });
    expect([unlabelled.table.excluded, unlabelled.table.generatorItems.map((g) => g.item)]).toEqual([[IDS.memM], [SARA_ITEM]]);
  });
});

describe('S8A-04 CP3 — the §4 cases as the check\'s answers (R4-2 step 5)', () => {
  const CASES: Array<[string, string, (request: SharedDisclosureCheckRequest) => Answer, string]> = [
    ['natural mention (allowed): inside its span, ENTAILED', MARKED, ENTAILED(), 'AUTHORIZED_DISCLOSURE'],
    ['advice influenced, not stated (allowed)', 'القطار ممكن يكون أنسب للمجموعة.', ENTAILED(), 'CLEAR'],
    ['provenance', `⟦${F1}: قال لي إنه ${MOHAMED_ITEM}⟧`, (r) => ({ ...ENTAILED()(r), sealed: [{ id: 'K1', passage: 'قال لي' }] }), 'BLOCKED'],
    ['quote', `⟦${F1}: قال بالحرف «${MOHAMED_ITEM}»⟧`, (r) => ({ ...ENTAILED()(r), sealed: [{ id: 'K1', passage: `«${MOHAMED_ITEM}»` }] }), 'BLOCKED'],
    ['attribution to another (outside the span)', `Sara ${MOHAMED_ITEM}.`, (r) => ({ ...ENTAILED()(r), outside: [{ id: 'K1', passage: `Sara ${MOHAMED_ITEM}` }] }), 'BLOCKED'],
    ['attribution to another (inside the span)', `⟦${F1}: ${MOHAMED_ITEM} وهي كمان⟧`, ENTAILED('OTHER_PERSON'), 'BLOCKED'],
    ['unsupported claim', `⟦${F1}: عنده فوبيا من الطيران⟧`, ENTAILED('ADDS'), 'BLOCKED'],
    ['subtle / dialect / English (unclear)', `⟦${F1}: زي ما كان فهمني قبل كده⟧`, ENTAILED('UNCLEAR'), 'BLOCKED'],
    ['a stated fact tied to no one', `في حد هنا ${MOHAMED_ITEM}.`, (r) => ({ ...ENTAILED()(r), outside: [{ id: 'K1', passage: `في حد هنا ${MOHAMED_ITEM}` }] }), 'BLOCKED'],
  ];
  it.each(CASES)('%s', async (_name, text, answer, expected) => {
    const s = await setup();
    const result = await gate(s, text, answering(answer));
    expect(result.state).toBe(expected);
    if (result.state === 'AUTHORIZED_DISCLOSURE') {
      expect(result.gate).toMatchObject({ disclosedContextIds: [IDS.memM], basis: 'SERVER_DETECTOR_DETECTED_WITHIN_DISCLOSURE_AUTHORIZATION',
        sourceDisclosureStatus: 'PROTECTED_SOURCE_DISCLOSURE_DETECTED_WITHIN_AUTHORIZATION', directPrivateDisclosureAuthority: 'REQUIRES_DISCLOSURE_REVALIDATION',
        provenanceDisclosure: 'SEALED', deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY', outputDigest: digestProviderOutput(RENDERED) });
    }
    if (result.state === 'BLOCKED') expect(result.coolDown).toEqual([IDS.memM]);
  });

  it('only the unsafe item is returned to cool; the safe one is not (R4-3)', async () => {
    const s = await setup([item('mohamed'), item('sara')]);
    const text = `⟦${F1}: ${MOHAMED_ITEM}⟧، وإنتي ${SARA_ITEM}.`;
    const result = await gate(s, text, answering((r) => ({ ...ENTAILED()(r), outside: [{ id: 'K2', passage: `وإنتي ${SARA_ITEM}` }] })));
    expect(result).toEqual({ state: 'BLOCKED', reason: 'PROTECTED_SOURCE_DISCLOSURE_DETECTED', coolDown: [IDS.memS] });
  });
});

describe('S8A-04 CP3 — every check failure withholds (UNRESOLVED), and cools nothing', () => {
  const BROKEN: Array<[string, (request: SharedDisclosureCheckRequest) => unknown]> = [
    ['a throw (timeout, provider error)', () => { throw new Error('timeout'); }],
    ['malformed', () => 'not json'],
    ['the V1 shape', (request) => ({ state: 'ASSESSED', assessmentRef: 'a', detectorPolicyRef: 'p', binding: request.binding, sources: [] })],
    ['an extra key', (request) => ({ ...checked(request, ENTAILED()(request)), extra: true })],
    ['a missing span verdict', (request) => checked(request, { spans: [], outside: [], sealed: [] })],
    ['an unknown verdict', (request) => checked(request, ENTAILED('OWNER')(request))],
    ['an extra answer key', (request) => checked(request, { ...ENTAILED()(request), confidence: 1 })],
    ['a passage that is not in the reply', (request) => checked(request, { ...ENTAILED()(request), outside: [{ id: 'K1', passage: 'جملة مش موجودة' }] })],
  ];
  it.each(BROKEN)('%s', async (_name, answer) => {
    const s = await setup();
    expect(await gate(s, MARKED, new ScriptedChecker(answer))).toEqual({ state: 'UNRESOLVED', reason: 'DETECTOR_UNRESOLVED' });
    expect(await s.lane.readiness({ envelope: s.envelope, preparation: s.preparation, generatedText: MARKED, checker: new ScriptedChecker(answer), payer: PAYER }))
      .toEqual({ state: 'UNRESOLVED' });
  });

  it('a check bound to another output, operation, audience or DA is a binding mismatch', async () => {
    const s = await setup();
    for (const key of ['outputDigest', 'effectiveContextRef', 'audienceSnapshotRef', 'disclosureAuthorizationRef'] as const) {
      const checker = new ScriptedChecker((request) => ({ ...checked(request, ENTAILED()(request)), binding: { ...request.binding, [key]: digestProviderOutput('another') } }));
      expect(await gate(s, MARKED, checker)).toEqual({ state: 'UNRESOLVED', reason: 'DETECTOR_BINDING_MISMATCH' });
    }
    expect(decodeSharedDisclosureCheck({ state: 'CHECKED', checkRef: 'c', policyRef: 'p', binding: { effectiveContextRef: 'x' }, answer: {} }, { effectiveContextRef: 'x', audienceSnapshotRef: 'a', disclosureAuthorizationRef: 'd', outputDigest: 'o' })).toBeNull();
  });

  it('a DA bound to another operation, or tampered with, is DISCLOSURE_AUTHORIZATION_MISMATCH, and the checker is not asked', async () => {
    const s = await setup();
    const authorization = s.authorization;
    for (const da of [{ ...authorization, effectiveContextRef: 'sha256:other' }, { ...authorization, audienceSnapshotRef: 'audience:2' },
      { ...authorization, items: [] }, { ...authorization, items: [{ ...authorization.items[0], contextId: IDS.memS }] }]) {
      const checker = SILENT_FRESH();
      expect(await gate(s, MARKED, checker, da)).toEqual({ state: 'UNRESOLVED', reason: 'DISCLOSURE_AUTHORIZATION_MISMATCH' });
      expect(checker.calls).toHaveLength(0);
    }
  });

  it('a claim table of another operation is DISCLOSURE_AUTHORIZATION_MISMATCH, and the checker is not asked', async () => {
    const s = await setup();
    const other = await setup();
    other.store.audienceRef = 'audience:2';
    const context = await other.lane.effectiveContext.resolve(WORLD, other.lane.candidates);
    if (context.state !== 'READY') throw new Error('not ready');
    const foreign = other.lane.claims({ envelope: context.effectiveContext, authorization: await other.lane.authorize(context.effectiveContext), names: NAMES, labelOf: LABELS, nonce: NONCE });
    const checker = SILENT_FRESH();
    expect(await gate(s, MARKED, checker, s.authorization, foreign)).toEqual({ state: 'UNRESOLVED', reason: 'DISCLOSURE_AUTHORIZATION_MISMATCH' });
    expect(checker.calls).toHaveLength(0);
  });
});
function SILENT_FRESH() { return answering(ENTAILED()); }

describe('S8A-04 CP3 — ONE check per reply, sealed from identity, and the sender pays', () => {
  it('one call per reply with every sent item (V1: one per owner); in the sender\'s AI-COST-01 scope; no Name, id or ref in it', async () => {
    const s = await setup([item('mohamed'), item('sara')]);
    const checker = SILENT_FRESH();
    const text = `⟦${F1}: ${MOHAMED_ITEM}⟧ و⟦${F2}: ${SARA_ITEM}⟧.`;
    const result = await gate(s, text, checker);
    expect(result.state).toBe('AUTHORIZED_DISCLOSURE');
    expect(checker.calls).toHaveLength(1);
    const [{ request, scope }] = checker.calls;
    expect(scope).toEqual({ userId: IDS.hala, sourceWorldId: IDS.world, sourceSharedMaterialId: IDS.material });
    expect(request.items).toEqual([{ id: 'K1', item: MOHAMED_ITEM }, { id: 'K2', item: SARA_ITEM }]);
    expect(request.spans).toEqual(['K1', 'K2']);
    expect(request.reply).toBe(`⟦K1: ${MOHAMED_ITEM}⟧ و⟦K2: ${SARA_ITEM}⟧.`);
    expect(request.binding.outputDigest).toBe(digestProviderOutput(`Mohamed ${MOHAMED_ITEM} وSara ${SARA_ITEM}.`));
    const sent = JSON.stringify(request);
    for (const secret of [IDS.mohamed, IDS.sara, IDS.hala, IDS.memM, IDS.rgM, IDS.dgM, 'Mohamed', 'Sara', 'Hala', NONCE]) expect(sent).not.toContain(secret);
  });

  it('with no admitted item the checker is never called (the frozen gate\'s own CLEAR)', async () => {
    const store = new Store([item('mohamed')]);
    store.set(IDS.mohamed, IDS.memM, { grant_state: 'REVOKED' });
    const lane = new SharedMemberKnowledgeLane(store.server(), store.worldState(), store.audienceResolver(), WORLD, [item('mohamed')]);
    const context = await lane.effectiveContext.resolve(WORLD, lane.candidates);
    if (context.state !== 'READY') throw new Error('not ready');
    const authorization = await lane.authorize(context.effectiveContext);
    const preparation = lane.claims({ envelope: context.effectiveContext, authorization, names: NAMES, labelOf: LABELS, nonce: NONCE });
    const checker = SILENT_FRESH();
    const ready = await lane.readiness({ envelope: context.effectiveContext, preparation, generatedText: 'القطار ممكن يكون أنسب.', checker, payer: PAYER });
    expect(ready.state).toBe('READY_FOR_LATER_DELIVERY_GATES');
    expect(checker.calls).toHaveLength(0);
  });

  it('a malformed, foreign or named span is withheld before any check (nothing paid, nothing cooled)', async () => {
    const s = await setup();
    for (const text of [`⟦F1·zzzzzz: ${MOHAMED_ITEM}⟧`, `⟦${F1}: Sara ${MOHAMED_ITEM}⟧`, `⟦${F1}: ${MOHAMED_ITEM}`, `${F1} ${MOHAMED_ITEM}`]) {
      const checker = SILENT_FRESH();
      expect(await s.lane.readiness({ envelope: s.envelope, preparation: s.preparation, generatedText: text, checker, payer: PAYER })).toEqual({ state: 'UNRESOLVED' });
      expect(checker.calls).toHaveLength(0);
    }
  });
});

describe('S8A-04 CP3 — readiness: I-03F unchanged, then the disclosure revalidation; consent moving at each boundary', () => {
  it('READY with the rendered text, the v1 readiness formula and both references, for a claim within authorization', async () => {
    const { lane, envelope, preparation } = await setup();
    const ready = await lane.readiness({ envelope, preparation, generatedText: MARKED, checker: SILENT_FRESH(), payer: PAYER });
    if (ready.state !== 'READY_FOR_LATER_DELIVERY_GATES') throw new Error(ready.state);
    expect(ready.text).toBe(RENDERED);
    const detail = ready.readiness;
    expect(detail.outputDigest).toBe(digestProviderOutput(RENDERED));
    expect(detail.sourceDisclosureStatus).toBe('AUTHORIZED_DISCLOSURE_ONLY');
    expect(detail.disclosedContextIds).toEqual([IDS.memM]);
    expect(detail.disclosureRevalidationRef).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(detail.readinessRef).toBe(fingerprintSharedPrivacyAuthorityDeliveryReadiness({
      effectiveContextRef: detail.effectiveContextRef, outputDigest: detail.outputDigest, sourceDisclosureGateRef: detail.sourceDisclosureGateRef,
      authorityRevalidationRef: detail.authorityRevalidationRef,
    }));
  });

  it('used, not stated: READY with the text unchanged, no disclosure and no disclosure revalidation', async () => {
    const { lane, envelope, preparation } = await setup();
    const text = 'القطار ممكن يكون أنسب للمجموعة.';
    const ready = await lane.readiness({ envelope, preparation, generatedText: text, checker: SILENT_FRESH(), payer: PAYER });
    expect(ready.state === 'READY_FOR_LATER_DELIVERY_GATES' && [ready.text, ready.readiness.sourceDisclosureStatus, ready.readiness.disclosureRevalidationRef, ready.readiness.disclosedContextIds])
      .toEqual([text, 'NO_PROTECTED_SOURCE_DISCLOSURE_DETECTED', null, []]);
  });

  it('revoked before the DA: the item has no ref, so its span is withheld before any check', async () => {
    const s = await setup();
    s.store.set(IDS.mohamed, IDS.memM, { grant_state: 'REVOKED', disclosure_status: 'REVOKED' });
    const authorization = await s.lane.authorize(s.envelope);
    const preparation = s.lane.claims({ envelope: s.envelope, authorization, names: NAMES, labelOf: LABELS, nonce: NONCE });
    const checker = SILENT_FRESH();
    expect(await s.lane.readiness({ envelope: s.envelope, preparation, generatedText: MARKED, checker, payer: PAYER })).toEqual({ state: 'UNRESOLVED' });
    expect(checker.calls).toHaveLength(0);
  });

  it('revoked between the check and the revalidation: STALE (nothing cooled)', async () => {
    const s = await setup();
    const checker = new ScriptedChecker((request) => {
      s.store.set(IDS.mohamed, IDS.memM, { grant_state: 'REVOKED', disclosure_status: 'REVOKED' });
      return checked(request, ENTAILED()(request));
    });
    expect(await s.lane.readiness({ envelope: s.envelope, preparation: s.preparation, generatedText: MARKED, checker, payer: PAYER })).toEqual({ state: 'STALE' });
  });

  it.each([
    ['a member joined during generation', (store: Store) => { store.audience = [...store.audience, IDS.nour]; store.audienceRef = 'audience:2'; }],
    ['the owner left (the episode ended)', (store: Store) => { store.set(IDS.mohamed, IDS.memM, { grant_state: 'ENDED' }); }],
    ['the item was corrected', (store: Store) => { store.set(IDS.mohamed, IDS.memM, { availability: 'UNAVAILABLE', current_content_digest: digestReasoningContent('x'), grant_state: 'ENDED' }); }],
    ['the item was forgotten', (store: Store) => { store.set(IDS.mohamed, IDS.memM, { availability: 'DELETED_BY_OWNER', current_content_digest: null, grant_state: 'ENDED' }); }],
    ['only the disclosure grant was withdrawn', (store: Store) => { store.set(IDS.mohamed, IDS.memM, { disclosure_status: 'REVOKED' }); }],
  ])('%s → STALE (never delivered)', async (_name, change) => {
    const s = await setup();
    const checker = new ScriptedChecker((request) => { change(s.store); return checked(request, ENTAILED()(request)); });
    expect(await s.lane.readiness({ envelope: s.envelope, preparation: s.preparation, generatedText: MARKED, checker, payer: PAYER })).toEqual({ state: 'STALE' });
  });

  it('an unreadable item state is UNRESOLVED, never CURRENT', async () => {
    const s = await setup();
    const checker = new ScriptedChecker((request) => { s.store.rows.set(`${IDS.mohamed}:${IDS.memM}`, { broken: true }); return checked(request, ENTAILED()(request)); });
    expect(await s.lane.readiness({ envelope: s.envelope, preparation: s.preparation, generatedText: MARKED, checker, payer: PAYER })).toEqual({ state: 'UNRESOLVED' });
  });
});

describe('S8A-04 CP3 — the lane never leaks through what it returns', () => {
  it('no result names an item, an owner, a grant or a category — beyond the delivered text itself', async () => {
    const s = await setup();
    for (const answer of [ENTAILED(), ENTAILED('ADDS'), (r: SharedDisclosureCheckRequest) => ({ ...ENTAILED()(r), sealed: [{ id: 'K1', passage: MOHAMED_ITEM }] })]) {
      const ready = await s.lane.readiness({ envelope: s.envelope, preparation: s.preparation, generatedText: MARKED, checker: answering(answer), payer: PAYER });
      const { text: delivered, ...rest } = ready as { text?: string };
      if (delivered !== undefined) expect(delivered).toBe(RENDERED);
      const serialized = JSON.stringify(rest);
      for (const secret of [MOHAMED_ITEM, IDS.mohamed, IDS.rgM, IDS.dgM, 'SEALED_PROVENANCE_DISCLOSURE', 'Mohamed', NONCE]) expect(serialized).not.toContain(secret);
    }
  });

  it('the envelope carries only the consented words, never another item', async () => {
    const { envelope } = await setup();
    const envelopeText = JSON.stringify(envelope as SharedEffectiveContext);
    expect(envelopeText).toContain(MOHAMED_ITEM);
    expect(envelopeText).not.toContain(SARA_ITEM);
  });

  it('the view the checker receives is the marked text with checker ids: the rendered Name never reaches it', async () => {
    const s = await setup();
    const parsed = parseSharedClaimSpans(MARKED, s.preparation.table);
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(sharedClaimCheckerView(MARKED, parsed, s.preparation.table).text).toBe(`⟦K1: ${MOHAMED_ITEM}⟧، فممكن نشوف مواعيد القطار.`);
  });

  it('buildSharedDisclosureAuthorization is exactly the lane\'s DA', async () => {
    const s = await setup();
    expect(await buildSharedDisclosureAuthorization(s.store.server(), s.envelope, s.items)).toEqual(s.authorization);
  });
});

describe('S8A-04 CP3 — R4-2 step 1: the 0178 Names, decoded exactly or not at all', () => {
  const row = (userId: string, name: string | null) => ({ user_id: userId, name });
  it('exactly its shape: one row per member, a Name or NULL', () => {
    expect(decodeSharedAudienceNames([row(IDS.hala, 'هالة'), row(IDS.mohamed, null)])).toEqual([{ userId: IDS.hala, name: 'هالة' }, { userId: IDS.mohamed, name: null }]);
  });
  it.each([
    ['a member twice', [row(IDS.hala, 'هالة'), row(IDS.mohamed, 'محمد'), row(IDS.hala, 'هالة')]],
    ['a blank Name', [row(IDS.hala, '  ')]],
    ['an extra key', [{ ...row(IDS.hala, 'هالة'), extra: 1 }]],
    ['a missing Name key', [{ user_id: IDS.hala }]],
    ['a user id that is not a uuid', [row('hala', 'هالة')]],
    ['no row', []],
    ['not a list', { user_id: IDS.hala, name: 'هالة' }],
  ])('anything else (%s) is no Names at all', (_name, rows) => {
    expect(decodeSharedAudienceNames(rows)).toBeNull();
  });
});
