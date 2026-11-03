import type {
  BargeInResult, CallTurnStore, CloseReason, CloseResult, CommitInput, CommitResult, DeliveryState, GenerationEnd, OpenExchange, PlayoutResult,
  ProviderSettleOutcome, SafetyDisposition, TextReplyState,
} from '../call-turn.store';

interface Exchange {
  readonly index: number;
  readonly userTurnId: string;
  readonly content: string;
  readonly channel: 'SPEECH' | 'TEXT';
  readonly commitId: string;
  safety: SafetyDisposition | null;
  bargeInMs: number | null;
  textReply: { state: TextReplyState; text: string; terms: readonly string[] } | null;
  generation: 'GENERATING' | GenerationEnd;
  producedMs: number;
  markMs: number;
  clockStartMs: number | null;
  readonly segments: Array<{ seq: number; text: string; startMs: number; endMs: number }>;
  closed: { deliveryState: DeliveryState; heardMarkMs: number; text: string; reason: CloseReason | 'NEXT_TURN' | 'TEXT_REPLIED' } | null;
}

/**
 * S8B-05 CP2 — an in-memory call turn authority for unit tests only (never composed by a module). It follows 0190's rules
 * that the API depends on: one open exchange (N1 closes it in the commit), Safety stored once before a close, only a
 * higher playout mark advances and the first fixes the clock, ONE close whose heard mark is bounded by the produced audio
 * in whole 20 ms packets, its text the registered segments whose end ≤ the mark, and its delivery state. The epoch fence
 * and the recording bound are proven against real PostgreSQL (verify-migration-0190), not here.
 *
 * S8B-05 CP4 (0192): a commit is idempotent by its commitId (a typed turn's clientTurnId); a barge-in onset is kept once
 * while the exchange is open; a typed exchange closes TEXT_REPLIED with its text (or FAILED without), never by audio.
 */
export class InMemoryCallTurnStore implements CallTurnStore {
  readonly exchanges: Exchange[] = [];
  readonly ledger = new Map<string, { kind: 'SPEECH' | 'TRANSCRIPTION'; callTurnIndex: number | null; outcome: ProviderSettleOutcome | 'PENDING'; usage: Record<string, number> }>();
  readonly calls: string[] = [];
  readonly commits: CommitInput[] = [];
  /** A test may make one command fail. */
  failNext: string | null = null;
  epoch = 1;

  private gate(name: string): void {
    this.calls.push(name);
    if (this.failNext === name) {
      this.failNext = null;
      throw new Error('STORE_DOWN');
    }
  }

  private open(): Exchange | undefined {
    return this.exchanges.find((e) => e.closed === null);
  }

  private find(index: number): Exchange | undefined {
    return this.exchanges.find((e) => e.index === index);
  }

  async commit(input: CommitInput): Promise<CommitResult> {
    this.gate('commit');
    this.commits.push(input);
    if (input.epoch !== this.epoch) return { outcome: 'FENCED', callTurnIndex: null, turnId: null, closed: null };
    const again = this.exchanges.find((e) => e.commitId === input.commitId);
    if (again) return { outcome: 'ALREADY_COMMITTED', callTurnIndex: again.index, turnId: again.userTurnId, closed: null };
    const previous = this.open();
    let closed: CommitResult['closed'] = null;
    if (previous) {
      if (previous.safety === null) throw new Error('CALL_EXCHANGE_SAFETY_UNSETTLED');
      const result = this.closeExchange(previous, 'NEXT_TURN');
      closed = { callTurnIndex: previous.index, assistantTurnId: input.closeAssistantTurnId, deliveryState: result.deliveryState, heardMarkMs: result.heardMarkMs };
    }
    // As 0189 reserves it: the call's next_call_turn_index, from 1, +1 per committed turn.
    const index = this.exchanges.length === 0 ? 1 : this.exchanges[this.exchanges.length - 1]!.index + 1;
    this.exchanges.push({
      index, userTurnId: input.turnId, content: input.content, channel: input.channel, commitId: input.commitId, safety: null, bargeInMs: null,
      textReply: null, generation: 'GENERATING', producedMs: 0, markMs: 0, clockStartMs: null, segments: [], closed: null,
    });
    return { outcome: 'COMMITTED', callTurnIndex: index, turnId: input.turnId, closed };
  }

  async storeSafety(input: { callTurnIndex: number; disposition: SafetyDisposition }) {
    this.gate('storeSafety');
    const exchange = this.find(input.callTurnIndex);
    if (!exchange) return 'NOT_FOUND' as const;
    if (exchange.safety === null) {
      exchange.safety = input.disposition;
      return 'STORED' as const;
    }
    if (exchange.safety !== input.disposition) throw new Error('CALL_SAFETY_CONFLICT');
    return 'SAME' as const;
  }

  async registerSegment(input: { epoch: number; callTurnIndex: number; seq: number; text: string; startMs: number; endMs: number }) {
    this.gate('registerSegment');
    if (input.epoch !== this.epoch) return 'FENCED' as const;
    const exchange = this.find(input.callTurnIndex);
    if (!exchange) return 'NOT_FOUND' as const;
    if (exchange.closed) return 'CLOSED' as const;
    exchange.segments.push({ seq: input.seq, text: input.text, startMs: input.startMs, endMs: input.endMs });
    return 'REGISTERED' as const;
  }

  async finishGeneration(input: { epoch: number; callTurnIndex: number; state: GenerationEnd; producedMs: number }) {
    this.gate('finishGeneration');
    if (input.epoch !== this.epoch) return 'FENCED';
    const exchange = this.find(input.callTurnIndex);
    if (!exchange) return 'NOT_FOUND';
    if (exchange.closed) return 'CLOSED';
    if (exchange.generation !== 'GENERATING') return 'ALREADY_FINISHED';
    if ((input.state === 'FAILED') !== (input.producedMs === 0)) throw new Error('CALL_GENERATION_INVALID');
    exchange.generation = input.state;
    exchange.producedMs = input.producedMs;
    return 'FINISHED';
  }

  async confirmPlayout(input: { epoch: number; callTurnIndex: number; playedMs: number; clockStartMs: number | null }): Promise<PlayoutResult> {
    this.gate('confirmPlayout');
    if (input.epoch !== this.epoch) return { outcome: 'FENCED', markMs: null, clockStartMs: null };
    const exchange = this.find(input.callTurnIndex);
    if (!exchange) return { outcome: 'NOT_FOUND', markMs: null, clockStartMs: null };
    if (exchange.closed) return { outcome: 'CLOSED', markMs: exchange.markMs, clockStartMs: exchange.clockStartMs };
    if (input.playedMs <= exchange.markMs) return { outcome: 'IGNORED', markMs: exchange.markMs, clockStartMs: exchange.clockStartMs };
    exchange.markMs = input.playedMs;
    exchange.clockStartMs ??= input.clockStartMs;
    return { outcome: 'ADVANCED', markMs: exchange.markMs, clockStartMs: exchange.clockStartMs };
  }

  async close(input: { epoch: number; callTurnIndex: number; reason: CloseReason; assistantTurnId: string }): Promise<CloseResult> {
    this.gate('close');
    if (input.epoch !== this.epoch) return { outcome: 'FENCED', assistantTurnId: null, deliveryState: null, heardMarkMs: null };
    const exchange = this.find(input.callTurnIndex);
    if (!exchange) return { outcome: 'NOT_FOUND', assistantTurnId: null, deliveryState: null, heardMarkMs: null };
    if (exchange.closed) return { outcome: 'ALREADY_CLOSED', assistantTurnId: input.assistantTurnId, deliveryState: exchange.closed.deliveryState, heardMarkMs: exchange.closed.heardMarkMs };
    if (exchange.safety === null) throw new Error('CALL_EXCHANGE_SAFETY_UNSETTLED');
    const result = this.closeExchange(exchange, input.reason);
    return { outcome: 'CLOSED', assistantTurnId: input.assistantTurnId, deliveryState: result.deliveryState, heardMarkMs: result.heardMarkMs };
  }

  async recordBargeIn(input: { epoch: number; callTurnIndex: number; captureMs: number }): Promise<BargeInResult> {
    this.gate('recordBargeIn');
    if (input.epoch !== this.epoch) return { outcome: 'FENCED', captureMs: null };
    const exchange = this.find(input.callTurnIndex);
    if (!exchange) return { outcome: 'NOT_FOUND', captureMs: null };
    if (exchange.closed) return { outcome: 'CLOSED', captureMs: exchange.bargeInMs };
    if (exchange.bargeInMs !== null) return { outcome: 'ALREADY_RECORDED', captureMs: exchange.bargeInMs };
    exchange.bargeInMs = input.captureMs;
    return { outcome: 'RECORDED', captureMs: input.captureMs };
  }

  async closeText(input: { callTurnIndex: number; state: TextReplyState; text: string; terms: readonly string[]; assistantTurnId: string }): Promise<CloseResult> {
    this.gate('closeText');
    const exchange = this.find(input.callTurnIndex);
    if (!exchange) return { outcome: 'NOT_FOUND', assistantTurnId: null, deliveryState: null, heardMarkMs: null };
    if (exchange.channel !== 'TEXT' || (input.state === 'FAILED') !== (input.text.trim() === '')) throw new Error('CALL_TEXT_REPLY_INVALID');
    if (exchange.closed) return { outcome: 'ALREADY_CLOSED', assistantTurnId: input.assistantTurnId, deliveryState: exchange.closed.deliveryState, heardMarkMs: 0 };
    if (exchange.safety === null) throw new Error('CALL_EXCHANGE_SAFETY_UNSETTLED');
    if (input.state !== 'FAILED') exchange.textReply = { state: input.state, text: input.text, terms: input.terms };
    const deliveryState: DeliveryState = input.state;
    exchange.closed = { deliveryState, heardMarkMs: 0, text: input.text, reason: input.state === 'FAILED' ? 'GENERATION_FAILED' : 'TEXT_REPLIED' };
    return { outcome: 'CLOSED', assistantTurnId: input.assistantTurnId, deliveryState, heardMarkMs: 0 };
  }

  async readOpenExchange(input: { epoch: number }): Promise<OpenExchange> {
    this.gate('readOpenExchange');
    if (input.epoch !== this.epoch) return { outcome: 'FENCED', callTurnIndex: null, userTurnId: null, content: null, channel: null, safety: null };
    const open = this.open();
    if (!open) return { outcome: 'NONE', callTurnIndex: null, userTurnId: null, content: null, channel: null, safety: null };
    return { outcome: 'OPEN', callTurnIndex: open.index, userTurnId: open.userTurnId, content: open.content, channel: open.channel, safety: open.safety };
  }

  private closeExchange(exchange: Exchange, reason: CloseReason | 'NEXT_TURN'): { deliveryState: DeliveryState; heardMarkMs: number } {
    // A typed exchange has no audio: closed before its text reply, it is INTERRUPTED with nothing heard.
    if (exchange.channel === 'TEXT') {
      exchange.closed = { deliveryState: 'INTERRUPTED', heardMarkMs: 0, text: '', reason };
      return { deliveryState: 'INTERRUPTED', heardMarkMs: 0 };
    }
    let mark = exchange.clockStartMs === null ? 0 : Math.min(exchange.markMs, exchange.generation === 'GENERATING' ? exchange.markMs : exchange.producedMs);
    mark -= mark % 20;
    const text = exchange.segments.filter((s) => s.endMs <= mark).sort((a, b) => a.seq - b.seq).map((s) => s.text).join('');
    const deliveryState: DeliveryState = exchange.generation === 'FAILED' ? 'FAILED'
      : exchange.generation !== 'GENERATING' && exchange.producedMs > 0 && mark >= exchange.producedMs ? exchange.generation : 'INTERRUPTED';
    exchange.closed = { deliveryState, heardMarkMs: mark, text, reason };
    return { deliveryState, heardMarkMs: mark };
  }

  async beginSpeech(input: { epoch: number; callTurnIndex: number; providerCallId: string }) {
    this.gate('beginSpeech');
    if (input.epoch !== this.epoch) return 'FENCED';
    const exchange = this.find(input.callTurnIndex);
    if (!exchange || exchange.closed) return 'CLOSED';
    this.ledger.set(input.providerCallId, { kind: 'SPEECH', callTurnIndex: input.callTurnIndex, outcome: 'PENDING', usage: {} });
    return 'BEGUN';
  }

  async beginTranscription(input: { epoch: number; providerCallId: string }) {
    this.gate('beginTranscription');
    if (input.epoch !== this.epoch) return 'FENCED';
    this.ledger.set(input.providerCallId, { kind: 'TRANSCRIPTION', callTurnIndex: null, outcome: 'PENDING', usage: {} });
    return 'BEGUN';
  }

  async settle(input: { providerCallId: string; outcome: ProviderSettleOutcome; usage: Record<string, number> }) {
    this.gate('settle');
    const row = this.ledger.get(input.providerCallId);
    if (!row) return 'NOT_FOUND';
    if (row.outcome !== 'PENDING') return 'ALREADY_SETTLED';
    row.outcome = input.outcome;
    row.usage = input.usage;
    return 'SETTLED';
  }
}
