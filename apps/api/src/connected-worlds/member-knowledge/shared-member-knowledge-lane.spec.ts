// S8A-04 CP3 — the authorized-disclosure lane (amendment §3 – §4, §8): the frozen I-03 classes composed per request, the
// judge's v2 assessment mapped fail-closed, the Disclosure Authorization bound to its operation, the sender paying, and
// consent changing at every boundary. Free: no provider, no database; the 0176 item row is a fake that can change.
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
import type { SharedSourceDisclosureFindingCategory } from '../source-disclosure/shared-source-disclosure-detector.types';
import { fingerprintSharedPrivacyAuthorityDeliveryReadiness } from '../source-disclosure/shared-privacy-authority-delivery-readiness.service';
import {
  SharedMemberKnowledgeLane, buildSharedDisclosureAuthorization, evaluateSharedMemberKnowledgeGate, mapSharedDisclosureFinding,
} from './shared-member-knowledge-lane';
import {
  SHARED_KNOWLEDGE_ITEM_RPC, type SharedDisclosureJudge, type SharedDisclosureJudgeRequest, type SharedMemberKnowledgeItem,
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

type Answer = { findings: SharedSourceDisclosureFindingCategory[]; attributedTo: string; unsupportedOwnerClaim: boolean };
const NOTHING: Answer = { findings: [], attributedTo: 'NONE', unsupportedOwnerClaim: false };
const MENTION: Answer = { findings: ['DIRECT_PROTECTED_SOURCE_FACT', 'SOURCE_SPECIFIC_ATTRIBUTION'], attributedTo: 'OWNER', unsupportedOwnerClaim: false };

/** A judge that answers per owner label; records every request and the AI-COST-01 scope it ran in. */
class ScriptedJudge implements SharedDisclosureJudge {
  calls: Array<{ request: SharedDisclosureJudgeRequest; scope: unknown }> = [];
  constructor(private readonly answer: (request: SharedDisclosureJudgeRequest) => unknown) {}
  async judge(request: SharedDisclosureJudgeRequest): Promise<unknown> {
    this.calls.push({ request, scope: currentAiUsageAttribution() });
    return this.answer(request);
  }
}
const assessed = (request: SharedDisclosureJudgeRequest, answers: Answer[]) => ({
  state: 'ASSESSED', assessmentRef: `a:${request.owner}`, detectorPolicyRef: 'policy:test', binding: { ...request.binding },
  sources: request.items.map((entry, index) => ({ contentDigest: entry.contentDigest, ...answers[index] })),
});
const answering = (byOwner: Record<string, Answer>) => new ScriptedJudge((request) => assessed(request, request.items.map(() => byOwner[request.owner] ?? NOTHING)));

const LABELS = new Map([[IDS.hala, 'Hala'], [IDS.mohamed, 'Mohamed'], [IDS.sara, 'Sara']]);
const PAYER = { userId: IDS.hala, worldId: IDS.world, materialId: IDS.material };

async function setup(items: SharedMemberKnowledgeItem[] = [item('mohamed')]) {
  const store = new Store(items);
  const lane = new SharedMemberKnowledgeLane(store.server(), store.worldState(), store.audienceResolver(), WORLD, items);
  const context = await lane.effectiveContext.resolve(WORLD, lane.candidates);
  if (context.state !== 'READY') throw new Error('envelope not ready');
  return { store, lane, envelope: context.effectiveContext, items };
}
const REPLY = `${'Mohamed'} ${MOHAMED_ITEM}، فممكن نشوف مواعيد القطار.`;

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

describe('S8A-04 CP3 — the §4 cases as the judge\'s answers', () => {
  const CASES: Array<[string, Answer, string]> = [
    ['natural mention (allowed)', MENTION, 'AUTHORIZED_DISCLOSURE'],
    ['advice influenced, not stated (allowed)', NOTHING, 'CLEAR'],
    ['provenance', { findings: ['SEALED_PROVENANCE_DISCLOSURE', 'DIRECT_PROTECTED_SOURCE_FACT'], attributedTo: 'OWNER', unsupportedOwnerClaim: false }, 'BLOCKED'],
    ['quote', { findings: ['PRIVATE_QUOTE'], attributedTo: 'OWNER', unsupportedOwnerClaim: false }, 'BLOCKED'],
    ['attribution to another', { findings: ['DIRECT_PROTECTED_SOURCE_FACT', 'SOURCE_SPECIFIC_ATTRIBUTION'], attributedTo: 'OTHER', unsupportedOwnerClaim: false }, 'BLOCKED'],
    ['unsupported claim', { findings: ['DIRECT_PROTECTED_SOURCE_FACT'], attributedTo: 'OWNER', unsupportedOwnerClaim: true }, 'BLOCKED'],
    ['subtle / dialect / English (unclear)', { findings: ['DIRECT_PROTECTED_SOURCE_FACT'], attributedTo: 'UNCLEAR', unsupportedOwnerClaim: false }, 'BLOCKED'],
    ['a stated fact tied to no one', { findings: ['DIRECT_PROTECTED_SOURCE_FACT'], attributedTo: 'NONE', unsupportedOwnerClaim: false }, 'BLOCKED'],
  ];
  it.each(CASES)('%s', async (_name, answer, expected) => {
    const { store, envelope, items } = await setup();
    const authorization = await buildSharedDisclosureAuthorization(store.server(), envelope, items);
    const result = await evaluateSharedMemberKnowledgeGate({ envelope, outputText: REPLY, authorization, judge: answering({ Mohamed: answer }), labelOf: LABELS, payer: PAYER });
    expect(result.state).toBe(expected);
    if (result.state === 'AUTHORIZED_DISCLOSURE') {
      expect(result.gate).toMatchObject({ disclosedContextIds: [IDS.memM], basis: 'SERVER_DETECTOR_DETECTED_WITHIN_DISCLOSURE_AUTHORIZATION',
        sourceDisclosureStatus: 'PROTECTED_SOURCE_DISCLOSURE_DETECTED_WITHIN_AUTHORIZATION', directPrivateDisclosureAuthority: 'REQUIRES_DISCLOSURE_REVALIDATION',
        provenanceDisclosure: 'SEALED', deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY', outputDigest: digestProviderOutput(REPLY) });
    }
  });

  it('the mapping never clears on a block-only signal, and never authorizes outside the DA', () => {
    expect(mapSharedDisclosureFinding({ findings: [], attributedTo: 'NONE', unsupportedOwnerClaim: true }, true)).toBe('BLOCKED');
    expect(mapSharedDisclosureFinding({ findings: [], attributedTo: 'OTHER', unsupportedOwnerClaim: false }, true)).toBe('BLOCKED');
    expect(mapSharedDisclosureFinding(MENTION, false)).toBe('BLOCKED');
    expect(mapSharedDisclosureFinding(MENTION, true)).toBe('DISCLOSED');
    expect(mapSharedDisclosureFinding(NOTHING, false)).toBe('NOTHING');
  });
});

describe('S8A-04 CP3 — every judge failure withholds (UNRESOLVED)', () => {
  const BROKEN: Array<[string, (request: SharedDisclosureJudgeRequest) => unknown]> = [
    ['a throw (timeout, provider error)', () => { throw new Error('timeout'); }],
    ['malformed', () => 'not json'],
    ['the v1 shape', (request) => ({ state: 'CLEAR', assessmentRef: 'a', detectorPolicyRef: 'p', binding: request.binding })],
    ['an extra key', (request) => ({ ...assessed(request, [NOTHING]), extra: true })],
    ['a missing item entry', (request) => ({ ...assessed(request, [NOTHING]), sources: [] })],
    ['an unknown category', (request) => assessed(request, [{ findings: ['SOMETHING_ELSE' as SharedSourceDisclosureFindingCategory], attributedTo: 'OWNER', unsupportedOwnerClaim: false }])],
    ['an extra source key', (request) => ({ ...assessed(request, [NOTHING]), sources: [{ ...assessed(request, [NOTHING]).sources[0], confidence: 1 }] })],
  ];
  it.each(BROKEN)('%s', async (_name, answer) => {
    const { store, envelope, items } = await setup();
    const authorization = await buildSharedDisclosureAuthorization(store.server(), envelope, items);
    const result = await evaluateSharedMemberKnowledgeGate({ envelope, outputText: REPLY, authorization, judge: new ScriptedJudge(answer), labelOf: LABELS, payer: PAYER });
    expect(result).toEqual({ state: 'UNRESOLVED', reason: 'DETECTOR_UNRESOLVED' });
  });

  it('an assessment of another output is a binding mismatch', async () => {
    const { store, envelope, items } = await setup();
    const authorization = await buildSharedDisclosureAuthorization(store.server(), envelope, items);
    const judge = new ScriptedJudge((request) => ({ ...assessed(request, [MENTION]), binding: { ...request.binding, outputDigest: digestProviderOutput('another reply') } }));
    const result = await evaluateSharedMemberKnowledgeGate({ envelope, outputText: REPLY, authorization, judge, labelOf: LABELS, payer: PAYER });
    expect(result).toEqual({ state: 'UNRESOLVED', reason: 'DETECTOR_BINDING_MISMATCH' });
  });

  it('a DA bound to another operation, or tampered with, is DISCLOSURE_AUTHORIZATION_MISMATCH, and the judge is not asked', async () => {
    const { store, envelope, items } = await setup();
    const authorization = await buildSharedDisclosureAuthorization(store.server(), envelope, items);
    for (const da of [{ ...authorization, effectiveContextRef: 'sha256:other' }, { ...authorization, audienceSnapshotRef: 'audience:2' },
      { ...authorization, items: [] }, { ...authorization, items: [{ ...authorization.items[0], contextId: IDS.memS }] }]) {
      const judge = answering({ Mohamed: MENTION });
      const result = await evaluateSharedMemberKnowledgeGate({ envelope, outputText: REPLY, authorization: da, judge, labelOf: LABELS, payer: PAYER });
      expect(result).toEqual({ state: 'UNRESOLVED', reason: 'DISCLOSURE_AUTHORIZATION_MISMATCH' });
      expect(judge.calls).toHaveLength(0);
    }
  });
});

describe('S8A-04 CP3 — the judge sees one owner at a time, and the sender pays', () => {
  it('one call per owner, each with only that owner\'s item; every call in the sender\'s AI-COST-01 scope', async () => {
    const { store, envelope, items } = await setup([item('mohamed'), item('sara')]);
    const authorization = await buildSharedDisclosureAuthorization(store.server(), envelope, items);
    const judge = answering({ Mohamed: MENTION, Sara: NOTHING });
    const result = await evaluateSharedMemberKnowledgeGate({ envelope, outputText: REPLY, authorization, judge, labelOf: LABELS, payer: PAYER });
    expect(result.state).toBe('AUTHORIZED_DISCLOSURE');
    expect(judge.calls.map((call) => [call.request.owner, call.request.items.map((entry) => entry.item)])).toEqual([['Mohamed', [MOHAMED_ITEM]], ['Sara', [SARA_ITEM]]]);
    for (const call of judge.calls) {
      expect(call.scope).toEqual({ userId: IDS.hala, sourceWorldId: IDS.world, sourceSharedMaterialId: IDS.material });
      expect(JSON.stringify(call.request)).not.toContain(IDS.mohamed);
      expect(JSON.stringify(call.request)).not.toContain(IDS.hala);
    }
    expect(judge.calls[0].request.members).toEqual(['Hala', 'Sara']);
    // Each owner's items reach only that owner's check (the reply itself is what everyone will read).
    expect(JSON.stringify(judge.calls[0].request.items)).not.toContain(SARA_ITEM);
    expect(JSON.stringify(judge.calls[1].request.items)).not.toContain(MOHAMED_ITEM);
  });

  it('with no admitted item the judge is never called (the frozen gate\'s own CLEAR)', async () => {
    const store = new Store([item('mohamed')]);
    store.set(IDS.mohamed, IDS.memM, { grant_state: 'REVOKED' });
    const lane = new SharedMemberKnowledgeLane(store.server(), store.worldState(), store.audienceResolver(), WORLD, [item('mohamed')]);
    const context = await lane.effectiveContext.resolve(WORLD, lane.candidates);
    if (context.state !== 'READY') throw new Error('not ready');
    const judge = answering({ Mohamed: MENTION });
    const ready = await lane.readiness({ envelope: context.effectiveContext, outputText: REPLY, judge, labelOf: LABELS, payer: PAYER });
    expect(ready.state).toBe('READY_FOR_LATER_DELIVERY_GATES');
    expect(judge.calls).toHaveLength(0);
  });

  it('an owner without a label in this request is never judged anonymously: withheld', async () => {
    const { store, envelope, items } = await setup();
    const authorization = await buildSharedDisclosureAuthorization(store.server(), envelope, items);
    const judge = answering({ Mohamed: MENTION });
    const result = await evaluateSharedMemberKnowledgeGate({ envelope, outputText: REPLY, authorization, judge, labelOf: new Map([[IDS.hala, 'Hala']]), payer: PAYER });
    expect(result.state).toBe('UNRESOLVED');
    expect(judge.calls).toHaveLength(0);
  });
});

describe('S8A-04 CP3 — readiness: I-03F unchanged, then the disclosure revalidation; consent moving at each boundary', () => {
  it('READY with the v1 readiness formula and both references, for a mention within authorization', async () => {
    const { lane, envelope } = await setup();
    const ready = await lane.readiness({ envelope, outputText: REPLY, judge: answering({ Mohamed: MENTION }), labelOf: LABELS, payer: PAYER });
    if (ready.state !== 'READY_FOR_LATER_DELIVERY_GATES') throw new Error(ready.state);
    const detail = ready.readiness;
    expect(detail.sourceDisclosureStatus).toBe('AUTHORIZED_DISCLOSURE_ONLY');
    expect(detail.disclosedContextIds).toEqual([IDS.memM]);
    expect(detail.disclosureRevalidationRef).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(detail.readinessRef).toBe(fingerprintSharedPrivacyAuthorityDeliveryReadiness({
      effectiveContextRef: detail.effectiveContextRef, outputDigest: detail.outputDigest, sourceDisclosureGateRef: detail.sourceDisclosureGateRef,
      authorityRevalidationRef: detail.authorityRevalidationRef,
    }));
  });

  it('used, not mentioned: READY with no disclosure and no disclosure revalidation', async () => {
    const { lane, envelope } = await setup();
    const ready = await lane.readiness({ envelope, outputText: 'القطار ممكن يكون أنسب للمجموعة.', judge: answering({ Mohamed: NOTHING }), labelOf: LABELS, payer: PAYER });
    expect(ready.state === 'READY_FOR_LATER_DELIVERY_GATES' && [ready.readiness.sourceDisclosureStatus, ready.readiness.disclosureRevalidationRef, ready.readiness.disclosedContextIds])
      .toEqual(['NO_PROTECTED_SOURCE_DISCLOSURE_DETECTED', null, []]);
  });

  it('revoked before the DA: the item is absent from it, so its mention BLOCKS', async () => {
    const { store, lane, envelope } = await setup();
    store.set(IDS.mohamed, IDS.memM, { grant_state: 'REVOKED', disclosure_status: 'REVOKED' });
    const ready = await lane.readiness({ envelope, outputText: REPLY, judge: answering({ Mohamed: MENTION }), labelOf: LABELS, payer: PAYER });
    expect(ready.state).toBe('BLOCKED');
  });

  it('revoked between the gate and the revalidation: STALE', async () => {
    const { store, lane, envelope } = await setup();
    const judge = new ScriptedJudge((request) => {
      store.set(IDS.mohamed, IDS.memM, { grant_state: 'REVOKED', disclosure_status: 'REVOKED' });
      return assessed(request, [MENTION]);
    });
    expect((await lane.readiness({ envelope, outputText: REPLY, judge, labelOf: LABELS, payer: PAYER })).state).toBe('STALE');
  });

  it.each([
    ['a member joined during generation', (store: Store) => { store.audience = [...store.audience, IDS.nour]; store.audienceRef = 'audience:2'; }],
    ['the owner left (the episode ended)', (store: Store) => { store.set(IDS.mohamed, IDS.memM, { grant_state: 'ENDED' }); }],
    ['the item was corrected', (store: Store) => { store.set(IDS.mohamed, IDS.memM, { availability: 'UNAVAILABLE', current_content_digest: digestReasoningContent('x'), grant_state: 'ENDED' }); }],
    ['the item was forgotten', (store: Store) => { store.set(IDS.mohamed, IDS.memM, { availability: 'DELETED_BY_OWNER', current_content_digest: null, grant_state: 'ENDED' }); }],
  ])('%s → STALE (never delivered)', async (_name, change) => {
    const { store, lane, envelope } = await setup();
    const judge = new ScriptedJudge((request) => { change(store); return assessed(request, [MENTION]); });
    expect((await lane.readiness({ envelope, outputText: REPLY, judge, labelOf: LABELS, payer: PAYER })).state).toBe('STALE');
  });

  it('an unreadable item state is UNRESOLVED, never CURRENT', async () => {
    const { store, lane, envelope } = await setup();
    const judge = new ScriptedJudge((request) => { store.rows.set(`${IDS.mohamed}:${IDS.memM}`, { broken: true }); return assessed(request, [MENTION]); });
    expect((await lane.readiness({ envelope, outputText: REPLY, judge, labelOf: LABELS, payer: PAYER })).state).toBe('UNRESOLVED');
  });
});

describe('S8A-04 CP3 — the lane never leaks through what it returns', () => {
  it('no result names an item, an owner, a grant or a category', async () => {
    const { lane, envelope } = await setup();
    const QUOTE: Answer = { findings: ['PRIVATE_QUOTE'], attributedTo: 'OWNER', unsupportedOwnerClaim: false };
    for (const answer of [MENTION, NOTHING, QUOTE]) {
      const ready = await lane.readiness({ envelope, outputText: REPLY, judge: answering({ Mohamed: answer }), labelOf: LABELS, payer: PAYER });
      const text = JSON.stringify(ready);
      for (const secret of [MOHAMED_ITEM, IDS.mohamed, IDS.rgM, IDS.dgM, 'PRIVATE_QUOTE', 'Mohamed']) expect(text).not.toContain(secret);
    }
  });

  it('the envelope carries only the consented words, never another item', async () => {
    const { envelope } = await setup();
    const envelopeText = JSON.stringify(envelope as SharedEffectiveContext);
    expect(envelopeText).toContain(MOHAMED_ITEM);
    expect(envelopeText).not.toContain(SARA_ITEM);
  });
});
