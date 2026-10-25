import { Inject, Injectable, Optional } from '@nestjs/common';
import { runWithAiUsageAttribution } from '../ai-usage/ai-usage-attribution';
import type {
  SharedQandeelReplyGenerator,
  SharedReplyGeneration,
  SharedReplyGenerationInput,
} from '../connected-worlds/material-commit/shared-qandeel-reply.types';
import { SafetyResponseGateService } from '../conversation/safety-response-gate.service';
import { MODEL_ROUTER, type ModelRouter, type ModelRouterContextMessage } from '../model-router/model-router.types';
import { SHARED_ATTRIBUTION_READING_BUDGET_MS, SHARED_ATTRIBUTION_TURN_BUDGET_MS, sharedAttributionTier, withSharedAttribution } from './shared-attribution-layer';
import { ModelRouterAttributionReader, type SharedAttributionReader } from './shared-attribution-reading';
import { assembleSharedConversationRequest, sharedConversationLabels } from './shared-conversation-model-input';
import {
  SHARED_KNOWLEDGE_RECALLER, SHARED_KNOWLEDGE_RECALL_CONTRACT, UnconfiguredSharedKnowledgeRecaller, decodeSharedKnowledgeRecall, type SharedKnowledgeRecaller,
} from './shared-knowledge-recall';
import {
  inlineSharedKnowledge, recallEntry, recalledSharedKnowledge, safeSharedKnowledge, sharedRecallConversation, sharedRecallIndex, sharedWorldKnowledgeBlock,
  type SharedKnowledgeEntry,
} from './shared-world-knowledge';

/** S8A-04 CP2 §3.2.4: recall's own bound, within the slack the turn already has. */
export const SHARED_KNOWLEDGE_RECALL_BUDGET_MS = 2_500;

/** How the reply's knowledge was chosen (S8A-04 CP2 §3.2). Internal; never user-facing. */
export type SharedKnowledgePath = 'NONE' | 'INLINE' | 'RECALLED' | 'SAFE_NO_SLACK' | 'SAFE_FAILED' | 'SAFE_TIMED_OUT';

const monotonic = () => Number(process.hrtime.bigint()) / 1e6;
class RecallTimeout extends Error {}

/**
 * S8A-04 CP2 §3.2 — the reply's knowledge, chosen by size: a small World whole; a larger one recalled within `deadlineMs`
 * (no slack: not started); and the safe path on no slack, a timeout or any failure. Never throws, never blocks the reply
 * beyond the deadline, and never reaches beyond the entries it was given.
 */
export async function chooseSharedKnowledge(
  entries: ReadonlyArray<SharedKnowledgeEntry>, conversation: SharedReplyGenerationInput['conversation'], recaller: SharedKnowledgeRecaller, deadlineMs: number,
): Promise<{ readonly path: SharedKnowledgePath; readonly entries: ReadonlyArray<SharedKnowledgeEntry> }> {
  try {
    if (entries.length === 0) return { path: 'NONE', entries: [] };
    const inline = inlineSharedKnowledge(entries);
    if (inline !== null) return { path: 'INLINE', entries: inline };
    if (deadlineMs <= 0) return { path: 'SAFE_NO_SLACK', entries: safeSharedKnowledge(entries) };
    const labels = sharedConversationLabels(conversation);
    // M2: the request's refs run K1…Kn over the index, in commit order — above 48 KB the index is a subset of the entries,
    // so each request ref stands for its entry and what recall chose is read back through it.
    const index = sharedRecallIndex(entries);
    const entryRef = new Map(index.map((entry, position) => [`K${position + 1}`, entry.ref]));
    const input = Object.freeze({
      contract: SHARED_KNOWLEDGE_RECALL_CONTRACT,
      knowledge: index.map((entry, position) => ({ ...recallEntry(entry), ref: `K${position + 1}` })),
      conversation: sharedRecallConversation(conversation.flatMap((turn, index) => (turn.producer === 'HUMAN' ? [{ from: labels[index] as string, text: turn.text }] : []))),
    });
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    try {
      const raw = await Promise.race([
        recaller.recall(input, controller.signal),
        new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new RecallTimeout()); }, deadlineMs); }),
      ]);
      const refs = decodeSharedKnowledgeRecall(raw, input);
      if (refs === null) return { path: 'SAFE_FAILED', entries: safeSharedKnowledge(entries) };
      return { path: 'RECALLED', entries: recalledSharedKnowledge(entries, refs.map((ref) => entryRef.get(ref) as string)) };
    } catch (error) {
      return { path: error instanceof RecallTimeout ? 'SAFE_TIMED_OUT' : 'SAFE_FAILED', entries: safeSharedKnowledge(entries) };
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  } catch {
    return { path: 'SAFE_FAILED', entries: [] };
  }
}

const MESSAGE_REF = /^M[1-9][0-9]*$/u;
const SPEAKER_REF = /^S[1-9][0-9]*$/u;

/**
 * S8A-02 CP1: every message names itself once with a request-local token, every person's message carries its trusted
 * author's token, and QANDEEL's carries none. Anything else is refused rather than told apart by Name alone.
 */
function hasTrustedProvenance(conversation: SharedReplyGenerationInput['conversation']): boolean {
  const messages = new Set(conversation.map((turn) => turn.messageRef));
  return messages.size === conversation.length && conversation.every((turn) => MESSAGE_REF.test(turn.messageRef)
    && (turn.producer === 'HUMAN' ? typeof turn.speakerRef === 'string' && SPEAKER_REF.test(turn.speakerRef) : turn.speakerRef === null));
}

/**
 * S4-02 — the words of one request-driven QANDEEL reply, over the provider-neutral Model Router.
 *
 *   1. the canonical Safety Response Gate on the answered message (and the earlier people's words): BLOCK answers with its
 *      own deterministic words and calls no provider; GUIDED carries its guidance into the request;
 *   2. the one Shared model-input assembler, over messages that carry their trusted request-local provenance (S8A-02 CP1);
 *   3. the S8A-02 CP2 attribution layer (`shared-attribution-layer.ts`): tier 0 leaves the request untouched; tiers 1 / 2 add
 *      one attribution reading (2.5 s) and the server's notes, the reply keeping what remains of the 6 s reading turn;
 *   4. the Model Router, inside the AI-COST-01 attribution scope of the human whose request started it — so every call, the
 *      reading included, is accounted (and refused before any provider request if it could not be), never untracked spend.
 *      S8A-04 CP2: the scope also carries the World and the answered message (§5);
 *   5. S8A-04 CP2 §3 — the World's knowledge: recall starts with the turn, concurrently with the attribution reading, and
 *      waits no longer than the slack the turn already has (`min(2.5 s, turn cap − the reply's budget)`; with an attribution
 *      reading, 2.5 s). With no slack (DEEP without a reading) it is not started. The chosen positions follow the unchanged
 *      frame as one system block (M3); the reply's own budget is never shortened, and the turn never extended.
 *
 * No provider is named here; the deterministic test seam is the Model Router's own (NODE_ENV=test). Nothing is logged.
 */
@Injectable()
export class SharedConversationReplyGenerator implements SharedQandeelReplyGenerator {
  private readonly reader: SharedAttributionReader;

  constructor(
    @Inject(MODEL_ROUTER) private readonly router: ModelRouter,
    private readonly safety: SafetyResponseGateService,
    @Optional() @Inject(SHARED_KNOWLEDGE_RECALLER) private readonly recaller: SharedKnowledgeRecaller = new UnconfiguredSharedKnowledgeRecaller(),
  ) {
    this.reader = new ModelRouterAttributionReader(router, SHARED_ATTRIBUTION_READING_BUDGET_MS);
  }

  async generate(input: SharedReplyGenerationInput): Promise<SharedReplyGeneration> {
    const current = input.conversation.at(-1);
    if (current === undefined || current.producer !== 'HUMAN' || !hasTrustedProvenance(input.conversation)) return { state: 'UNAVAILABLE' };
    const earlier: ModelRouterContextMessage[] = input.conversation.slice(0, -1)
      .filter((turn) => turn.producer === 'HUMAN').map((turn) => ({ role: 'USER', content: turn.text }));
    const gate = this.safety.evaluate(current.text, [...earlier, { role: 'USER', content: current.text }]);
    if (gate.disposition === 'BLOCK') {
      return gate.deterministicResponse ? { state: 'GENERATED', text: gate.deterministicResponse } : { state: 'UNAVAILABLE' };
    }
    const request = assembleSharedConversationRequest(input.conversation, gate.disposition === 'GUIDED' ? gate.safetyGuidance : undefined);
    if (request === null) return { state: 'UNAVAILABLE' };
    const attribution = input.source === undefined
      ? { userId: input.requesterUserId }
      : { userId: input.requesterUserId, sourceWorldId: input.source.worldId, sourceSharedMaterialId: input.source.materialId };
    try {
      const result = await runWithAiUsageAttribution(attribution, async () => {
        const started = monotonic();
        const tier = sharedAttributionTier(input.conversation);
        const cap = SHARED_ATTRIBUTION_TURN_BUDGET_MS[request.path];
        const deadline = tier > 0 ? SHARED_KNOWLEDGE_RECALL_BUDGET_MS : Math.min(SHARED_KNOWLEDGE_RECALL_BUDGET_MS, cap - request.latencyBudgetMs);
        const knowledge = chooseSharedKnowledge(input.knowledge ?? [], input.conversation, this.recaller, deadline);
        const attributed = (await withSharedAttribution(input.conversation, request, this.reader)).request;
        const chosen = await knowledge;
        const block = sharedWorldKnowledgeBlock(chosen.entries);
        const reply = block === null ? attributed : { ...attributed, behavioralGuidance: `${attributed.behavioralGuidance}\n\n${block}` };
        // With an attribution reading, the reply keeps what remains of the reading turn, measured after recall too.
        const budgeted = tier > 0 ? { ...reply, latencyBudgetMs: Math.max(0, Math.floor(cap - (monotonic() - started))) } : reply;
        return { generated: await this.router.generate(budgeted), knowledgeRefs: chosen.entries.map((entry) => entry.ref) };
      });
      return result.generated.content.trim().length > 0
        ? { state: 'GENERATED', text: result.generated.content, ...(result.knowledgeRefs.length === 0 ? {} : { knowledgeRefs: result.knowledgeRefs }) }
        : { state: 'UNAVAILABLE' };
    } catch {
      return { state: 'UNAVAILABLE' };
    }
  }
}
