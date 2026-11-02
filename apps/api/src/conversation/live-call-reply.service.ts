import { Inject, Injectable, Optional, type OnModuleInit } from '@nestjs/common';
import { runWithAiUsageAttribution } from '../ai-usage/ai-usage-attribution';
import { BoundedForegroundIntelligenceGathererService } from '../intelligence-runtime/bounded-foreground-intelligence-gatherer.service';
import { IntegratedContextBudgetAssemblerService } from '../intelligence-runtime/integrated-context-budget-assembler.service';
import { InteractionPreferencesService } from '../interaction-preferences/interaction-preferences.service';
import type { ModelRouter, ModelRouterContextMessage } from '../model-router/model-router.types';
import { callRetrievalTerms } from '../voice/call-turn/call-reply';
import {
  LiveCallConversationBinding, type LiveCallConversation, type LiveCallReleasedSpeech, type LiveCallReplyOutcome, type LiveCallReplyRequest,
} from '../voice/call-turn/live-call-conversation.port';
import { withSpokenCallReply } from './behavioral-response-policy.service';
import { BEHAVIORAL_RESPONSE_POLICY, type BehavioralResponsePolicy } from './behavioral-response-policy.types';
import { resolveConversationLocale } from './conversation-turn-locale';
import { SAFETY_RESPONSE_GATE, type SafetyResponseGate } from './safety-response-gate.types';
import { SupabaseDataApiService } from './supabase-data-api.service';

/** S8B-05 CP2 (contract §5, L1): the live call's own streaming router (REALTIME); null where no call reply may be generated. */
export const LIVE_CALL_MODEL_ROUTER = Symbol('LIVE_CALL_MODEL_ROUTER');

/**
 * D-05-08 (A1 §4): the spoken path's context window and its in-call retrieval. Tokens are an ESTIMATE (UTF-8 bytes / 4,
 * which over-counts Arabic, so the window errs short); the provider's reported usage is measured in S8B-08.
 */
export const CALL_CONTEXT_POLICY = {
  maxExchanges: 12,
  maxEstimatedTokens: 1_500,
  minExchanges: 4,
  /** Rows read per kind: enough to fill the window when some pairs fold. */
  readLimit: 16,
  retrievalTimeoutMs: 80,
  retrievalMaxExchanges: 2,
  retrievalMaxBytes: 1_536,
  /** The REALTIME request's whole budget (VA-4); the router also holds its own 5 000 ms ceiling and 2 000 ms first token. */
  latencyBudgetMs: 5_000,
} as const;

/** The recall cues of A1 §4: with one of them, one shared term is enough to retrieve an earlier exchange. */
export const CALL_RECALL_CUES = ['فاكر', 'قلتلك', 'زي ما قلت'] as const;

export const estimateCallTokens = (text: string): number => Math.ceil(Buffer.byteLength(text, 'utf8') / 4);

interface ContextRow { exchange_kind: 'PRE_CALL' | 'CALL'; call_turn_index: number | null; user_content: string; reply_content: string | null }
interface RetrievalRow { call_turn_index: number; user_content: string; reply_content: string | null; matched_terms: number }
interface Exchange { readonly user: string; readonly reply: string }

export type CallRetrievalOutcome = 'HIT' | 'NONE' | 'NOT_ASKED' | 'TIMEOUT' | 'FAILED';

/**
 * C2 + D-05-08: the call's own exchanges, newest first, until 12 or ~1 500 estimated tokens, never fewer than four while
 * there are four; the Session's pre-call exchanges only fill up to those four (the text path's window). Returned in
 * conversation order: pre-call, then the call by `call_turn_index`. C3: a reply's content is what was heard.
 */
export function selectCallWindow(rows: readonly ContextRow[]): { readonly exchanges: readonly Exchange[]; readonly oldestCallIndex: number | null } {
  const valid = rows.filter((row) => typeof row.user_content === 'string');
  const call = valid.filter((row) => row.exchange_kind === 'CALL' && row.call_turn_index !== null)
    .sort((a, b) => b.call_turn_index! - a.call_turn_index!);
  const preCall = valid.filter((row) => row.exchange_kind === 'PRE_CALL');
  const chosenCall: ContextRow[] = [];
  let tokens = 0;
  for (const row of call) {
    const cost = estimateCallTokens(row.user_content) + estimateCallTokens(row.reply_content ?? '');
    if (chosenCall.length >= CALL_CONTEXT_POLICY.maxExchanges) break;
    if (chosenCall.length >= CALL_CONTEXT_POLICY.minExchanges && tokens + cost > CALL_CONTEXT_POLICY.maxEstimatedTokens) break;
    chosenCall.push(row);
    tokens += cost;
  }
  const chosenPre = preCall.slice(0, Math.max(0, CALL_CONTEXT_POLICY.minExchanges - chosenCall.length));
  const ordered = [...chosenPre.reverse(), ...chosenCall.reverse()];
  return {
    exchanges: ordered.map((row) => ({ user: row.user_content, reply: row.reply_content ?? '' })),
    oldestCallIndex: chosenCall.length === 0 ? null : chosenCall[0]!.call_turn_index,
  };
}

/**
 * Contract §3 (empty heard reply): the user's words stay in the context and an empty reply is not inserted. The model's
 * history alternates USER / ASSISTANT, so a user turn whose reply was empty is joined, in order, to the next user message
 * (the current turn included). Returns the messages and the current user content they end with.
 */
export function foldCallExchanges(exchanges: readonly Exchange[], current: string): { readonly messages: ModelRouterContextMessage[]; readonly currentUserContent: string } {
  const messages: ModelRouterContextMessage[] = [];
  let pending: string[] = [];
  for (const exchange of exchanges) {
    pending.push(exchange.user);
    if (exchange.reply.trim() === '') continue;
    messages.push({ role: 'USER', content: pending.join('\n') }, { role: 'ASSISTANT', content: exchange.reply });
    pending = [];
  }
  const currentUserContent = [...pending, current].join('\n');
  messages.push({ role: 'USER', content: currentUserContent });
  return { messages, currentUserContent };
}

/** A1 §4: two distinct shared terms, or one with a recall cue. */
export function retrievalAsk(content: string): { readonly terms: string[]; readonly recallCue: boolean } | null {
  const terms = callRetrievalTerms(content);
  const recallCue = CALL_RECALL_CUES.some((cue) => content.includes(cue));
  return terms.length >= 2 || (terms.length >= 1 && recallCue) ? { terms, recallCue } : null;
}

/** At most two exchanges and 1.5 KB, in call order; an exchange that does not fit whole is left out. */
export function boundRetrieved(rows: readonly RetrievalRow[]): Exchange[] {
  const kept: RetrievalRow[] = [];
  let bytes = 0;
  for (const row of rows.slice(0, CALL_CONTEXT_POLICY.retrievalMaxExchanges)) {
    const size = Buffer.byteLength(row.user_content, 'utf8') + Buffer.byteLength(row.reply_content ?? '', 'utf8');
    if (bytes + size > CALL_CONTEXT_POLICY.retrievalMaxBytes) continue;
    kept.push(row);
    bytes += size;
  }
  return kept.sort((a, b) => a.call_turn_index - b.call_turn_index).map((row) => ({ user: row.user_content, reply: row.reply_content ?? '' }));
}

/**
 * S8B-05 CP2 (contract §5, §10) — the Orchestrator's LIVE_CALL REALTIME path. Voice owns the audio; this owns the
 * generation of one committed spoken turn's reply:
 *
 *   1. S1 / S2: the ONE Safety gate, unchanged, over exactly the messages the reply receives (C2 window, folded, the turn
 *      last; in-call retrieval is never shown to it), stored once before anything is generated. BLOCK: the deterministic
 *      response is the reply, spoken whole and CALM, with no provider call.
 *   2. In parallel: the window, the in-call retrieval (80 ms, zero provider calls; a late or failed read is skipped and
 *      counted), the durable preferences and the bounded Memory foreground gather.
 *   3. Guidance: the turn's text guidance then TM-02 (VA-7). The ONE assembler. The REALTIME router (FAST, no thinking,
 *      first token 2 000 ms, 5 000 ms, max_tokens 160) through the incremental release guard; GUIDED keeps early release
 *      off (the guard's own rule). Every released piece reaches the call's reply sink while the rest is generated.
 *
 * Its words never leave the request it builds: nothing here logs content, and the outcome carries only counts and times.
 */
@Injectable()
export class LiveCallReplyService implements LiveCallConversation, OnModuleInit {
  constructor(
    private readonly binding: LiveCallConversationBinding,
    private readonly dataApi: SupabaseDataApiService,
    @Inject(SAFETY_RESPONSE_GATE) private readonly safetyGate: SafetyResponseGate,
    @Inject(BEHAVIORAL_RESPONSE_POLICY) private readonly behavioralPolicy: BehavioralResponsePolicy,
    private readonly interactionPreferences: InteractionPreferencesService,
    private readonly foregroundIntelligenceGatherer: BoundedForegroundIntelligenceGathererService,
    private readonly integratedContextBudget: IntegratedContextBudgetAssemblerService,
    @Optional() @Inject(LIVE_CALL_MODEL_ROUTER) private readonly router: ModelRouter | null = null,
  ) {}

  onModuleInit(): void {
    if (this.router?.stream) this.binding.bind(this);
  }

  reply(request: LiveCallReplyRequest): Promise<LiveCallReplyOutcome> {
    return runWithAiUsageAttribution({ userId: request.userId, sessionId: request.sessionId, sourceTurnId: request.userTurnId }, () => this.replyOnce(request));
  }

  private async replyOnce(request: LiveCallReplyRequest): Promise<LiveCallReplyOutcome> {
    const started = performance.now();
    const stages: Record<string, number> = {};
    const mark = (stage: string): void => { stages[stage] = Math.round(performance.now() - started); };
    const router = this.router;
    if (!router?.stream) return { kind: 'FAILED', stages };

    const windowRead = this.dataApi.request<ContextRow[]>(request.accessToken, 'rpc/call_context_exchanges_v1', {
      method: 'POST', body: JSON.stringify({ p_session_id: request.sessionId, p_call_id: request.callId, p_limit: CALL_CONTEXT_POLICY.readLimit }),
    });
    const preferencesRead = this.interactionPreferences.readForTurn(request.accessToken, request.userId);
    preferencesRead.catch(() => undefined);

    let rows: ContextRow[];
    try {
      rows = await windowRead;
    } catch {
      return { kind: 'FAILED', stages };
    }
    if (!Array.isArray(rows)) return { kind: 'FAILED', stages };
    mark('context_read');
    const window = selectCallWindow(rows);
    const safetyView = foldCallExchanges(window.exchanges, request.content);
    const safety = this.safetyGate.evaluate(request.content, safetyView.messages);
    try {
      await request.storeSafety(safety.disposition);
    } catch {
      return { kind: 'FAILED', stages };
    }
    mark('safety_stored');
    if (request.signal.aborted) return { kind: 'FAILED', stages };
    if (safety.disposition === 'BLOCK') {
      request.release(safety.deterministicResponse!, { expression: 'CALM', hints: [] });
      return { kind: 'COMPLETE', stages, context: { windowExchanges: window.exchanges.length, retrievedExchanges: 0, estimatedTokens: 0 } };
    }

    // The retrieval and Memory start only for a turn Safety lets through (a blocked turn reads nothing more).
    const retrievalPromise = this.retrieve(request, window.oldestCallIndex);
    const gatherPromise = this.foregroundIntelligenceGatherer.gather({ userId: request.userId, accessToken: request.accessToken, content: request.content, path: 'FAST' });
    gatherPromise.catch(() => undefined);

    let preferences;
    let gathered;
    try {
      preferences = (await preferencesRead).preferences;
      gathered = await gatherPromise;
    } catch {
      return { kind: 'FAILED', stages };
    }
    const retrieval = await retrievalPromise;
    mark('context_ready');

    const { messages, currentUserContent } = foldCallExchanges([...retrieval.exchanges, ...window.exchanges], request.content);
    const textGuidance = this.behavioralPolicy.buildTextGuidance({ preferences, safetyGuided: safety.disposition === 'GUIDED' });
    const memoryContext = gathered.memory.state === 'AVAILABLE' ? gathered.memory.value : [];
    const hypothesis = gathered.hypothesis.state === 'AVAILABLE' ? gathered.hypothesis.value : undefined;
    let assembled;
    try {
      assembled = this.integratedContextBudget.assemble({
        task: 'CONVERSATIONAL_RESPONSE', path: 'FAST', complexity: 'LOW',
        behavioralGuidance: withSpokenCallReply(textGuidance),
        ...(safety.safetyGuidance ? { safetyGuidance: safety.safetyGuidance } : {}),
        messages, currentUserContent, memoryContext,
        ...(hypothesis?.coverageState === 'AVAILABLE' ? { hypothesisContext: hypothesis.context } : {}),
        locale: resolveConversationLocale({ currentUserContent: request.content, preferences }),
        modality: 'TEXT', latencyBudgetMs: CALL_CONTEXT_POLICY.latencyBudgetMs, costBudget: 'LOW', safetyLevel: 'STANDARD',
      });
    } catch {
      return { kind: 'FAILED', stages };
    }
    const context = {
      windowExchanges: window.exchanges.length,
      retrievedExchanges: retrieval.exchanges.length,
      retrieval: retrieval.outcome,
      estimatedTokens: assembled.request.context.reduce((sum, message) => sum + estimateCallTokens(message.content), 0),
    };
    if (request.signal.aborted) return { kind: 'FAILED', stages, context };

    let first = true;
    const release = (piece: string, speech: LiveCallReleasedSpeech): void => {
      if (first) {
        first = false;
        mark('first_release');
      }
      request.release(piece, speech);
    };
    try {
      const streamed = await router.stream(assembled.request, { safetyGuided: safety.disposition === 'GUIDED', onRelease: release, signal: request.signal });
      mark('generation_end');
      if (streamed.kind === 'WITHHELD_TAIL') return { kind: 'WITHHELD_TAIL', stages, context };
      if (streamed.tail.trim() !== '' && !request.signal.aborted) {
        const tailStart = streamed.text.length - streamed.tail.length;
        release(streamed.tail, {
          expression: streamed.expression,
          hints: streamed.hints.filter((hint) => hint.at > tailStart).map((hint) => ({ word: hint.word, at: hint.at - tailStart })),
        });
      }
      return { kind: 'COMPLETE', stages, context };
    } catch {
      mark('generation_end');
      return { kind: 'FAILED', stages, context };
    }
  }

  /** In-call retrieval (A1 §4): one owner-scoped indexed read, raced against 80 ms; never an error for the reply. */
  private async retrieve(request: LiveCallReplyRequest, oldestCallIndex: number | null): Promise<{ readonly outcome: CallRetrievalOutcome; readonly exchanges: Exchange[] }> {
    const ask = retrievalAsk(request.content);
    if (!ask) return { outcome: 'NOT_ASKED', exchanges: [] };
    const read = this.dataApi.request<RetrievalRow[]>(request.accessToken, 'rpc/call_turn_retrieval_v1', {
      method: 'POST',
      body: JSON.stringify({ p_call_id: request.callId, p_terms: ask.terms, p_recall_cue: ask.recallCue, p_before_index: oldestCallIndex ?? request.callTurnIndex }),
    }).then((rows) => ({ rows }), () => 'FAILED' as const);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<'TIMEOUT'>((resolve) => { timer = setTimeout(() => resolve('TIMEOUT'), CALL_CONTEXT_POLICY.retrievalTimeoutMs); });
    const settled = await Promise.race([read, late]);
    clearTimeout(timer);
    if (settled === 'TIMEOUT' || settled === 'FAILED') return { outcome: settled, exchanges: [] };
    if (!Array.isArray(settled.rows)) return { outcome: 'FAILED', exchanges: [] };
    const exchanges = boundRetrieved(settled.rows);
    return { outcome: exchanges.length > 0 ? 'HIT' : 'NONE', exchanges };
  }
}

/**
 * Defers the live call router's SELECTION to its first generation (as `deferredModelRouter` does for the text reply), so a
 * process without a provider still starts; an unconfigured provider then fails the reply closed, never silently.
 */
export function deferredLiveCallRouter(resolve: () => ModelRouter): ModelRouter {
  let resolved: ModelRouter | undefined;
  const router = (): ModelRouter => (resolved ??= resolve());
  return {
    generate: async (request) => router().generate(request),
    stream: async (request, options) => {
      const target = router();
      if (!target.stream) throw new Error('LIVE_CALL_ROUTER_CANNOT_STREAM');
      return target.stream(request, options);
    },
  };
}
